-- =============================================================================
-- MIGRATION 20261201000200 — ARMAZENAMENTO PARTICIONADO COM ISOLAMENTO POR UNIDADE
--
-- Substitui o "documento único" (configuracoes.__ERP_PARTITIONED_CORE_V8__), que mantinha
-- TODAS as lojas, usuários e auditoria em um JSON, por partições endereçáveis:
--     (scope, kind, period)    scope = 'GLOBAL' | id da unidade (ex.: 'LOJA_03')
-- RLS permite SELECT apenas das partições de unidades autorizadas; toda gravação passa
-- pela RPC erp_save_batch (SECURITY DEFINER), que valida permissão, unidade, revisão
-- otimista e as regras de status da escala, e grava a auditoria na MESMA transação.
--
-- ADITIVA: a tabela legada `configuracoes` permanece intacta até a migration de lockdown.
-- =============================================================================

create table public.erp_partitions (
  scope      text not null,
  kind       text not null check (kind in
               ('structure','rules','positions','employees','availability','calendar',
                'rule_assignments','schedule')),
  period     text not null default '',
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  revision   bigint not null default 1 check (revision >= 1),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (scope, kind, period),
  -- catálogos globais <-> partições de unidade; 'schedule' exige competência YYYY-MM
  constraint erp_partitions_scope_kind check ((scope = 'GLOBAL') = (kind in ('structure','rules'))),
  constraint erp_partitions_period check (
    (kind = 'schedule' and period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') or (kind <> 'schedule' and period = ''))
);

create table public.erp_settings (
  key        text primary key check (key in ('maintenance_mode')),
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.erp_settings (key, value)
values ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb);

create table public.erp_backups (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  kind            text not null check (kind in ('MANUAL','PRE_RESTORE','PRE_MIGRATION')),
  label           text not null,
  partition_count integer not null,
  size_bytes      bigint not null,
  checksum        text not null,
  payload         jsonb not null
);

-- -----------------------------------------------------------------------------
-- Permissões exigidas por tipo de partição (qualquer uma das listadas).
-- Observação de projeto: operações de domínio têm efeitos em cascata (ex.: admitir um
-- colaborador atualiza o posto; lançar férias grava a escala). Por isso a autorização no
-- servidor é por PARTIÇÃO e aceita as permissões relacionadas; a semântica fina continua
-- no cliente e é um risco residual documentado.
-- -----------------------------------------------------------------------------
create or replace function private.partition_permissions(p_kind text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_kind
    when 'structure'        then array['MANAGE_STRUCTURE']
    when 'rules'            then array['MANAGE_RULES_SHIFTS']
    when 'positions'        then array['CREATE_POSITIONS','MANAGE_STRUCTURE','MANAGE_EMPLOYEES','TRANSFER_EMPLOYEES']
    when 'employees'        then array['MANAGE_EMPLOYEES','TRANSFER_EMPLOYEES','MANAGE_STRUCTURE']
    when 'availability'     then array['MANAGE_UNAVAILABILITY']
    when 'calendar'         then array['MANAGE_MARKET_CALENDAR']
    when 'rule_assignments' then array['MANAGE_RULES_SHIFTS']
    when 'schedule'         then array['EDIT_SCHEDULE','RECALCULATE_PROJECTIONS','MANAGE_UNAVAILABILITY',
                                       'MANAGE_EMPLOYEES','TRANSFER_EMPLOYEES','MANAGE_MARKET_CALENDAR',
                                       'VALIDATE_PUBLISH_SCHEDULE','CREATE_POSITIONS']
    else array[]::text[]
  end;
$$;

create or replace function private.has_any_permission(p_perms text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from unnest(p_perms) x where private.has_permission(x));
$$;

create or replace function private.setting_maintenance()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.erp_settings where key = 'maintenance_mode'), false);
$$;

-- -----------------------------------------------------------------------------
-- RPC DE GRAVAÇÃO: erp_save_batch
--   p_writes: [{scope, kind, period?, expected_revision, data}]   (0 = criar)
--   p_audit : [{module, action, entity_type, entity_id, unit_id, summary, before_state?, after_state?}]
-- Atômica: valida TODAS as partições antes de gravar qualquer uma.
-- Nunca lança exceção por negativa de autorização (para que o DENIED seja auditado e persistido).
-- -----------------------------------------------------------------------------
create or replace function public.erp_save_batch(p_writes jsonb, p_audit jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  w jsonb;
  a jsonb;
  v_scope text; v_kind text; v_period text; v_expected bigint; v_data jsonb;
  v_cur public.erp_partitions;
  v_old_status text; v_new_status text;
  v_conflicts jsonb := '[]'::jsonb;
  v_revs jsonb := '[]'::jsonb;
  v_new_rev bigint;
  v_n integer;
begin
  if not private.is_active_user() then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED');
  end if;
  v_role := private.current_role_code();

  if jsonb_typeof(p_writes) is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
  end if;
  v_n := jsonb_array_length(p_writes);
  if v_n = 0 or v_n > 200 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
  end if;

  if private.setting_maintenance() and v_role <> 'MASTER' then
    perform private.write_audit('SISTEMA', 'ESCRITA_BLOQUEADA_MANUTENCAO', 'ERP_PARTITION', null, null,
                                'Gravação recusada: sistema em modo de manutenção.', 'DENIED');
    return jsonb_build_object('ok', false, 'error', 'MAINTENANCE_MODE');
  end if;

  -- PASSO 1: validar tudo (ordem determinística evita deadlock entre operadores)
  for w in
    select value from jsonb_array_elements(p_writes) as t(value)
     order by value ->> 'scope', value ->> 'kind', coalesce(value ->> 'period', '')
  loop
    v_scope := w ->> 'scope';
    v_kind := w ->> 'kind';
    v_period := coalesce(w ->> 'period', '');
    v_expected := coalesce((w ->> 'expected_revision')::bigint, 0);
    v_data := w -> 'data';

    if v_scope is null or v_kind is null or jsonb_typeof(v_data) is distinct from 'object'
       or v_kind not in ('structure','rules','positions','employees','availability','calendar','rule_assignments','schedule') then
      return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
    end if;
    if (v_scope = 'GLOBAL') <> (v_kind in ('structure','rules')) then
      return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
    end if;
    if pg_column_size(v_data) > 12582912 then
      return jsonb_build_object('ok', false, 'error', 'PAYLOAD_TOO_LARGE');
    end if;

    if not private.has_any_permission(private.partition_permissions(v_kind)) then
      perform private.write_audit('SEGURANCA', 'ESCRITA_NEGADA_PERMISSAO', 'ERP_PARTITION',
                                  v_scope || '/' || v_kind || '/' || v_period, nullif(v_scope, 'GLOBAL'),
                                  'Gravação negada: perfil sem permissão para ' || v_kind || '.', 'DENIED');
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN', 'scope', v_scope, 'kind', v_kind);
    end if;
    if v_scope <> 'GLOBAL' and not private.can_access_unit(v_scope) then
      perform private.write_audit('SEGURANCA', 'ESCRITA_NEGADA_UNIDADE', 'ERP_PARTITION',
                                  v_scope || '/' || v_kind || '/' || v_period, v_scope,
                                  'Gravação negada: unidade não autorizada (' || v_scope || ').', 'DENIED');
      return jsonb_build_object('ok', false, 'error', 'FORBIDDEN_UNIT', 'scope', v_scope, 'kind', v_kind);
    end if;

    select * into v_cur from public.erp_partitions
     where scope = v_scope and kind = v_kind and period = v_period for update;

    if (v_cur.scope is null and v_expected <> 0) or (v_cur.scope is not null and v_cur.revision <> v_expected) then
      v_conflicts := v_conflicts || jsonb_build_object('scope', v_scope, 'kind', v_kind, 'period', v_period,
                                                       'current_revision', coalesce(v_cur.revision, 0));
      continue;
    end if;

    -- Regras de governança da escala mensal (aplicadas no servidor)
    if v_kind = 'schedule' and v_cur.scope is not null then
      v_old_status := v_cur.data -> 'monthlySchedule' ->> 'status';
      v_new_status := v_data -> 'monthlySchedule' ->> 'status';
      if v_old_status = 'PUBLISHED' then
        if v_new_status = 'PUBLISHED' then
          if v_data is distinct from v_cur.data then
            perform private.write_audit('ESCALA_MENSAL', 'ESCRITA_NEGADA_ESCALA_PUBLICADA', 'MONTHLY_SCHEDULE',
                                        v_scope || '_' || v_period, v_scope,
                                        'Alteração recusada: escala publicada é imutável até ser reaberta.', 'DENIED');
            return jsonb_build_object('ok', false, 'error', 'SCHEDULE_LOCKED', 'scope', v_scope, 'period', v_period);
          end if;
        elsif v_new_status = 'DRAFT' then
          if not private.has_permission('VALIDATE_PUBLISH_SCHEDULE') then
            perform private.write_audit('ESCALA_MENSAL', 'REABERTURA_NEGADA', 'MONTHLY_SCHEDULE',
                                        v_scope || '_' || v_period, v_scope,
                                        'Reabertura negada: exige permissão de publicação.', 'DENIED');
            return jsonb_build_object('ok', false, 'error', 'FORBIDDEN', 'scope', v_scope, 'kind', v_kind);
          end if;
        else
          return jsonb_build_object('ok', false, 'error', 'SCHEDULE_LOCKED', 'scope', v_scope, 'period', v_period);
        end if;
      end if;
    end if;
    if v_kind = 'schedule' then
      v_new_status := v_data -> 'monthlySchedule' ->> 'status';
      v_old_status := case when v_cur.scope is null then null else v_cur.data -> 'monthlySchedule' ->> 'status' end;
      if v_new_status in ('VALIDATED','PUBLISHED') and v_new_status is distinct from v_old_status
         and not private.has_permission('VALIDATE_PUBLISH_SCHEDULE') then
        perform private.write_audit('ESCALA_MENSAL', 'PUBLICACAO_NEGADA', 'MONTHLY_SCHEDULE',
                                    v_scope || '_' || v_period, v_scope,
                                    'Validação/publicação negada: exige permissão específica.', 'DENIED');
        return jsonb_build_object('ok', false, 'error', 'FORBIDDEN', 'scope', v_scope, 'kind', v_kind);
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object('ok', false, 'error', 'REVISION_CONFLICT', 'conflicts', v_conflicts);
  end if;

  -- PASSO 2: aplicar
  for w in
    select value from jsonb_array_elements(p_writes) as t(value)
     order by value ->> 'scope', value ->> 'kind', coalesce(value ->> 'period', '')
  loop
    v_scope := w ->> 'scope';
    v_kind := w ->> 'kind';
    v_period := coalesce(w ->> 'period', '');
    insert into public.erp_partitions (scope, kind, period, data, revision, updated_by, updated_at)
    values (v_scope, v_kind, v_period, w -> 'data', 1, auth.uid(), now())
    on conflict (scope, kind, period) do update
       set data = excluded.data,
           revision = public.erp_partitions.revision + 1,
           updated_by = auth.uid(),
           updated_at = now()
    returning revision into v_new_rev;
    v_revs := v_revs || jsonb_build_object('scope', v_scope, 'kind', v_kind, 'period', v_period, 'revision', v_new_rev);
  end loop;

  -- Auditoria na mesma transação; autor/papel/horário derivados do servidor.
  if jsonb_typeof(p_audit) = 'array' then
    for a in select value from jsonb_array_elements(p_audit) as t(value) limit 50 loop
      perform private.write_audit(a ->> 'module', a ->> 'action', a ->> 'entity_type', a ->> 'entity_id',
                                  a ->> 'unit_id', a ->> 'summary', 'SUCCESS',
                                  a -> 'before_state', a -> 'after_state');
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'revisions', v_revs);
end;
$$;

-- -----------------------------------------------------------------------------
-- CONFIGURAÇÕES CRÍTICAS
-- -----------------------------------------------------------------------------
create or replace function public.erp_set_setting(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
begin
  if not private.has_permission('MANAGE_SYSTEM_SETTINGS') then
    perform private.write_audit('SEGURANCA', 'CONFIGURACAO_NEGADA', 'APP_SETTING', p_key, null,
                                'Alteração de configuração crítica negada.', 'DENIED');
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_key = 'maintenance_mode' then
    if jsonb_typeof(p_value -> 'enabled') is distinct from 'boolean' then
      return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
    end if;
    p_value := jsonb_build_object('enabled', (p_value ->> 'enabled')::boolean,
                                  'message', left(coalesce(p_value ->> 'message', ''), 300));
  else
    return jsonb_build_object('ok', false, 'error', 'UNKNOWN_SETTING');
  end if;
  select value into v_old from public.erp_settings where key = p_key;
  update public.erp_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  perform private.write_audit('CONFIGURACOES', 'ALTERAR_CONFIGURACAO', 'APP_SETTING', p_key, null,
                              'Configuração crítica alterada: ' || p_key, 'SUCCESS', v_old, p_value);
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- BACKUP E RECUPERAÇÃO (apenas MANAGE_BACKUP; MFA recente para baixar/restaurar)
-- -----------------------------------------------------------------------------
create or replace function public.erp_create_backup(p_label text, p_kind text default 'MANUAL')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_id uuid;
  v_count integer;
begin
  if not private.has_permission('MANAGE_BACKUP') then
    perform private.write_audit('BACKUP', 'BACKUP_NEGADO', 'ERP_BACKUP', null, null, 'Criação de backup negada.', 'DENIED');
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if p_kind not in ('MANUAL') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PAYLOAD');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('scope', scope, 'kind', kind, 'period', period,
                                               'revision', revision, 'data', data)), '[]'::jsonb),
         count(*)
    into v_payload, v_count
    from public.erp_partitions;
  insert into public.erp_backups (created_by, kind, label, partition_count, size_bytes, checksum, payload)
  values (auth.uid(), p_kind, left(coalesce(nullif(btrim(p_label), ''), 'Backup manual'), 120), v_count,
          pg_column_size(v_payload), md5(v_payload::text), v_payload)
  returning id into v_id;
  perform private.write_audit('BACKUP', 'CRIAR_BACKUP', 'ERP_BACKUP', v_id::text, null,
                              'Backup criado com ' || v_count || ' partições.');
  return jsonb_build_object('ok', true, 'id', v_id, 'partitions', v_count);
end;
$$;

create or replace function public.erp_list_backups()
returns table (id uuid, created_at timestamptz, created_by_email text, kind text, label text,
               partition_count integer, size_bytes bigint, checksum text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_permission('MANAGE_BACKUP') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select b.id, b.created_at, p.email, b.kind, b.label, b.partition_count, b.size_bytes, b.checksum
      from public.erp_backups b
      left join public.erp_profiles p on p.id = b.created_by
     order by b.created_at desc;
end;
$$;

create or replace function public.erp_get_backup(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_b public.erp_backups;
begin
  if not private.has_permission('MANAGE_BACKUP') or not private.recent_mfa(600) then
    perform private.write_audit('BACKUP', 'DOWNLOAD_NEGADO', 'ERP_BACKUP', p_id::text, null,
                                'Download de backup negado (permissão ou reautenticação MFA ausente).', 'DENIED');
    return jsonb_build_object('ok', false, 'error', 'REAUTH_REQUIRED');
  end if;
  select * into v_b from public.erp_backups where id = p_id;
  if v_b.id is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  perform private.write_audit('BACKUP', 'BAIXAR_BACKUP', 'ERP_BACKUP', p_id::text, null,
                              'Backup exportado: ' || v_b.label);
  return jsonb_build_object('ok', true, 'id', v_b.id, 'label', v_b.label, 'checksum', v_b.checksum,
                            'created_at', v_b.created_at, 'payload', v_b.payload);
end;
$$;

-- Restauração: confirmação textual + MFA recente + backup automático PRÉ-RESTAURAÇÃO.
create or replace function public.erp_restore_backup(p_id uuid, p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_b public.erp_backups;
  v_pre uuid;
  v_payload jsonb;
  v_count integer;
  v_old_rev jsonb;
begin
  if not private.has_permission('MANAGE_BACKUP') or not private.recent_mfa(600) then
    perform private.write_audit('BACKUP', 'RESTAURACAO_NEGADA', 'ERP_BACKUP', p_id::text, null,
                                'Restauração negada (permissão ou reautenticação MFA ausente).', 'DENIED');
    return jsonb_build_object('ok', false, 'error', 'REAUTH_REQUIRED');
  end if;
  select * into v_b from public.erp_backups where id = p_id;
  if v_b.id is null then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if p_confirmation is distinct from ('RESTAURAR ' || left(p_id::text, 8)) then
    return jsonb_build_object('ok', false, 'error', 'CONFIRMATION_MISMATCH');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('scope', scope, 'kind', kind, 'period', period,
                                               'revision', revision, 'data', data)), '[]'::jsonb), count(*)
    into v_payload, v_count from public.erp_partitions;
  insert into public.erp_backups (created_by, kind, label, partition_count, size_bytes, checksum, payload)
  values (auth.uid(), 'PRE_RESTORE', 'Automático antes de restaurar ' || left(p_id::text, 8), v_count,
          pg_column_size(v_payload), md5(v_payload::text), v_payload)
  returning id into v_pre;

  select coalesce(jsonb_object_agg(scope || '|' || kind || '|' || period, revision), '{}'::jsonb)
    into v_old_rev from public.erp_partitions;
  delete from public.erp_partitions where true;
  insert into public.erp_partitions (scope, kind, period, data, revision, updated_by, updated_at)
  select e ->> 'scope', e ->> 'kind', coalesce(e ->> 'period', ''), e -> 'data',
         coalesce((v_old_rev ->> ((e ->> 'scope') || '|' || (e ->> 'kind') || '|' || coalesce(e ->> 'period', '')))::bigint, 0) + 1,
         auth.uid(), now()
    from jsonb_array_elements(v_b.payload) e;
  perform private.write_audit('BACKUP', 'RESTAURAR_BACKUP', 'ERP_BACKUP', p_id::text, null,
                              'Backup restaurado: ' || v_b.label || '. Ponto de retorno: ' || v_pre::text,
                              'SUCCESS', null, jsonb_build_object('pre_restore_backup', v_pre));
  return jsonb_build_object('ok', true, 'pre_restore_backup', v_pre);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS E PRIVILÉGIOS
-- -----------------------------------------------------------------------------
alter table public.erp_partitions enable row level security;
alter table public.erp_settings   enable row level security;
alter table public.erp_backups    enable row level security;

revoke all on public.erp_partitions, public.erp_settings, public.erp_backups from public, anon, authenticated;
grant select on public.erp_partitions, public.erp_settings to authenticated;
grant all on public.erp_partitions, public.erp_settings, public.erp_backups to service_role;

create policy partitions_read on public.erp_partitions
  for select to authenticated
  using (private.is_active_user()
         and (scope = 'GLOBAL' or private.can_access_unit(scope)));

create policy settings_read on public.erp_settings
  for select to authenticated using (private.session_is_valid());

-- erp_backups: sem nenhuma política e sem GRANT para authenticated — somente via RPC.

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.session_is_valid(), private.is_active_user(), private.current_role_code(),
  private.has_permission(text), private.can_access_unit(text)
  to authenticated, service_role;

revoke execute on function
  public.erp_save_batch(jsonb,jsonb), public.erp_set_setting(text,jsonb),
  public.erp_create_backup(text,text), public.erp_list_backups(),
  public.erp_get_backup(uuid), public.erp_restore_backup(uuid,text)
  from public, anon;
grant execute on function
  public.erp_save_batch(jsonb,jsonb), public.erp_set_setting(text,jsonb),
  public.erp_create_backup(text,text), public.erp_list_backups(),
  public.erp_get_backup(uuid), public.erp_restore_backup(uuid,text)
  to authenticated;
