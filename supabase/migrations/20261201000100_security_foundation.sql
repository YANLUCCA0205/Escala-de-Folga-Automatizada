-- =============================================================================
-- MIGRATION 20261201000100 — FUNDAÇÃO DE SEGURANÇA (identidade, perfis, RBAC, auditoria)
--
-- Escopo: ADITIVA. Não altera nem remove nenhuma tabela existente.
-- Princípios:
--   1. Identidade = auth.users.id (UUID). Nunca e-mail digitado, nunca localStorage.
--   2. Papel, unidades, status e permissões ficam em public.erp_profiles e só podem
--      ser alterados por funções administrativas executáveis EXCLUSIVAMENTE pelo
--      service_role (Edge Function admin-users / scripts de provisionamento).
--      O papel `authenticated` NÃO possui INSERT/UPDATE/DELETE nessas tabelas.
--   3. Toda tabela tem RLS habilitado; privilégios padrão do Supabase (que concedem
--      ALL a anon/authenticated) são revogados explicitamente.
--   4. O acesso é reavaliado a cada requisição (perfil ativo + sessão existente em
--      auth.sessions): desativar a conta ou revogar a sessão vale imediatamente,
--      sem esperar a expiração do JWT.
--   5. O papel MASTER só é autorizado com aal2 (TOTP verificado na sessão).
--
-- ROLLBACK: ver docs/security/MIGRATIONS.md (seção "Rollback"). Esta migration
-- pode ser revertida com o script de down documentado, pois não toca em dados legados.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. CATÁLOGO DE PERMISSÕES E MATRIZ POR PERFIL (fonte confiável do RBAC)
-- -----------------------------------------------------------------------------
create table public.erp_permissions (
  code          text primary key,
  category      text not null,
  description   text not null,
  is_governance boolean not null default false
);

create table public.erp_role_permissions (
  role       text not null check (role in ('MASTER','ADMIN','MANAGER','OPERATOR','VIEWER')),
  permission text not null references public.erp_permissions(code) on delete cascade,
  primary key (role, permission)
);

insert into public.erp_permissions (code, category, description, is_governance) values
  ('VIEW_BI',                  'Consulta',       'Consultar painel, indicadores e dados das unidades autorizadas', false),
  ('MANAGE_STRUCTURE',         'Estrutura',      'Gerenciar empresas, unidades, setores e funções', false),
  ('CREATE_POSITIONS',         'Estrutura',      'Criar e editar postos e vagas', false),
  ('MANAGE_EMPLOYEES',         'Pessoas',        'Cadastrar e editar colaboradores', false),
  ('TRANSFER_EMPLOYEES',       'Pessoas',        'Movimentar e transferir colaboradores entre postos e unidades', false),
  ('MANAGE_UNAVAILABILITY',    'Pessoas',        'Lançar férias, afastamentos e indisponibilidades', false),
  ('MANAGE_RULES_SHIFTS',      'Planejamento',   'Gerenciar jornadas e regras de escala', false),
  ('MANAGE_MARKET_CALENDAR',   'Planejamento',   'Gerenciar o calendário operacional (feriados, domingos, meio expediente)', false),
  ('EDIT_SCHEDULE',            'Escalas',        'Editar e gerar escalas mensais', false),
  ('RECALCULATE_PROJECTIONS',  'Escalas',        'Recalcular projeções e continuidade entre competências', false),
  ('VALIDATE_PUBLISH_SCHEDULE','Escalas',        'Validar, publicar e reabrir escalas', false),
  ('VIEW_AUDIT',               'Auditoria',      'Consultar a trilha de auditoria das unidades autorizadas', false),
  ('MANAGE_USERS',             'Governança',     'Criar contas, ativar/desativar operadores, redefinir credenciais e encerrar sessões', true),
  ('MANAGE_ACCESS',            'Governança',     'Definir perfis, unidades autorizadas e permissões individuais', true),
  ('MANAGE_BACKUP',            'Governança',     'Criar, baixar e restaurar backups', true),
  ('MANAGE_SYSTEM_SETTINGS',   'Governança',     'Alterar configurações críticas do sistema', true);

-- MASTER: todas as permissões.
insert into public.erp_role_permissions (role, permission) select 'MASTER', code from public.erp_permissions;

-- ADMIN (administração operacional): operação completa + consulta de auditoria.
-- Mudança deliberada vs. v8: ADMIN deixa de ter MANAGE_USERS (governança centralizada no MASTER).
insert into public.erp_role_permissions (role, permission) values
  ('ADMIN','VIEW_BI'),('ADMIN','MANAGE_STRUCTURE'),('ADMIN','CREATE_POSITIONS'),
  ('ADMIN','MANAGE_EMPLOYEES'),('ADMIN','TRANSFER_EMPLOYEES'),('ADMIN','MANAGE_UNAVAILABILITY'),
  ('ADMIN','MANAGE_RULES_SHIFTS'),('ADMIN','MANAGE_MARKET_CALENDAR'),('ADMIN','EDIT_SCHEDULE'),
  ('ADMIN','RECALCULATE_PROJECTIONS'),('ADMIN','VALIDATE_PUBLISH_SCHEDULE'),('ADMIN','VIEW_AUDIT');

-- MANAGER (gestão operacional): inalterado em relação à v8.
insert into public.erp_role_permissions (role, permission) values
  ('MANAGER','VIEW_BI'),('MANAGER','CREATE_POSITIONS'),('MANAGER','MANAGE_EMPLOYEES'),
  ('MANAGER','TRANSFER_EMPLOYEES'),('MANAGER','MANAGE_UNAVAILABILITY'),('MANAGER','MANAGE_MARKET_CALENDAR'),
  ('MANAGER','EDIT_SCHEDULE'),('MANAGER','VALIDATE_PUBLISH_SCHEDULE'),('MANAGER','RECALCULATE_PROJECTIONS');

-- OPERATOR (operação): inalterado em relação à v8.
insert into public.erp_role_permissions (role, permission) values
  ('OPERATOR','VIEW_BI'),('OPERATOR','MANAGE_EMPLOYEES'),('OPERATOR','MANAGE_UNAVAILABILITY'),
  ('OPERATOR','EDIT_SCHEDULE'),('OPERATOR','RECALCULATE_PROJECTIONS');

-- VIEWER (consulta)
insert into public.erp_role_permissions (role, permission) values ('VIEWER','VIEW_BI');

-- -----------------------------------------------------------------------------
-- 2. PERFIS DE USUÁRIO (um por auth.users)
-- -----------------------------------------------------------------------------
create table public.erp_profiles (
  id                  uuid primary key references auth.users(id) on delete restrict,
  email               text not null,
  full_name           text not null,
  role                text not null check (role in ('MASTER','ADMIN','MANAGER','OPERATOR','VIEWER')),
  authorized_units    text[] not null default '{}',
  extra_permissions   text[] not null default '{}',
  denied_permissions  text[] not null default '{}',
  status              text not null default 'PENDING'
                        check (status in ('PENDING','ACTIVE','SUSPENDED','DEACTIVATED')),
  must_change_password boolean not null default false,
  invited_at          timestamptz not null default now(),
  activated_at        timestamptz,
  deactivated_at      timestamptz,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Sem unidade autorizada = sem acesso. Nunca "todas as lojas" por omissão.
  constraint profiles_units_required
    check (role = 'MASTER' or status <> 'ACTIVE' or cardinality(authorized_units) > 0)
);
create unique index profiles_email_unique on public.erp_profiles (lower(email));
create index profiles_role_status_idx on public.erp_profiles (role, status);

-- Estado de redefinição de credencial (impressão digital do hash vigente). Fora de public.
create table private.credential_resets (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  fingerprint text not null,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. FUNÇÕES AUXILIARES (private; não expostas pela API REST)
-- -----------------------------------------------------------------------------
create or replace function private.session_is_valid()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and (auth.jwt() ->> 'session_id') is not null
     and exists (
       select 1 from auth.sessions s
        where s.id = ((auth.jwt() ->> 'session_id')::uuid)
          and s.user_id = auth.uid()
     );
$$;

create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.session_is_valid()
     and exists (
       select 1 from public.erp_profiles p
        where p.id = auth.uid()
          and p.status = 'ACTIVE'
          and not p.must_change_password
          and (p.role <> 'MASTER' or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
     );
$$;

create or replace function private.current_role_code()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.erp_profiles p where p.id = auth.uid() and private.is_active_user();
$$;

create or replace function private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user()
     and exists (
       select 1 from public.erp_profiles p
        where p.id = auth.uid()
          and not (p_permission = any (p.denied_permissions))
          and (
            p_permission = any (p.extra_permissions)
            or exists (select 1 from public.erp_role_permissions rp
                        where rp.role = p.role and rp.permission = p_permission)
          )
     );
$$;

create or replace function private.can_access_unit(p_unit text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_user()
     and exists (
       select 1 from public.erp_profiles p
        where p.id = auth.uid()
          and (p.role = 'MASTER' or p_unit = any (p.authorized_units))
     );
$$;

-- Reautenticação por MFA recente: o claim amr traz o carimbo de tempo do último TOTP.
create or replace function private.recent_mfa(p_max_age_seconds integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
     and exists (
       select 1
         from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
        where a ->> 'method' = 'totp'
          and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_max_age_seconds
     );
$$;

create or replace function private.effective_permissions(p_user uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x order by x), '{}')
    from (
      select rp.permission as x
        from public.erp_profiles p
        join public.erp_role_permissions rp on rp.role = p.role
       where p.id = p_user
      union
      select unnest(p.extra_permissions) from public.erp_profiles p where p.id = p_user
    ) s
   where x <> all (coalesce((select denied_permissions from public.erp_profiles where id = p_user), '{}'));
$$;

-- -----------------------------------------------------------------------------
-- 4. AUDITORIA PROTEGIDA (append-only, autor derivado do servidor)
-- -----------------------------------------------------------------------------
create table public.erp_audit_logs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  actor_id          uuid,
  actor_email       text,
  actor_name        text,
  actor_role        text,
  origin_type       text not null check (origin_type in
                      ('OPERATOR_ACTION','ADMIN_FUNCTION','AUTH_EVENT','SYSTEM_BOOTSTRAP',
                       'BREAK_GLASS','LEGACY_IMPORT','SYSTEM_MIGRATION')),
  auth_verification text not null check (auth_verification in
                      ('VERIFIED_SESSION','VERIFIED_MFA','SERVICE_ROLE','SYSTEM_SEED','UNVERIFIED_LEGACY')),
  unit_id           text,
  module            text not null,
  action            text not null,
  entity_type       text,
  entity_id         text,
  result            text not null default 'SUCCESS' check (result in ('SUCCESS','DENIED','FAILED')),
  summary           text not null,
  before_state      jsonb,
  after_state       jsonb
);
create index audit_logs_created_idx on public.erp_audit_logs (created_at desc);
create index audit_logs_unit_idx    on public.erp_audit_logs (unit_id, created_at desc);
create index audit_logs_actor_idx   on public.erp_audit_logs (actor_id, created_at desc);

create or replace function private.audit_logs_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE: a trilha de auditoria é somente de inserção' using errcode = '42501';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.erp_audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.erp_audit_logs
  for each statement execute function private.audit_logs_immutable();

-- Escrita interna: o autor SEMPRE vem de auth.uid() (nunca de parâmetro do cliente).
create or replace function private.write_audit(
  p_module text, p_action text, p_entity_type text, p_entity_id text, p_unit text,
  p_summary text, p_result text default 'SUCCESS',
  p_before jsonb default null, p_after jsonb default null,
  p_origin text default 'OPERATOR_ACTION'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_p public.erp_profiles;
  v_verif text;
begin
  select * into v_p from public.erp_profiles where id = auth.uid();
  v_verif := case when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then 'VERIFIED_MFA' else 'VERIFIED_SESSION' end;
  insert into public.erp_audit_logs (actor_id, actor_email, actor_name, actor_role, origin_type,
                                 auth_verification, unit_id, module, action, entity_type,
                                 entity_id, result, summary, before_state, after_state)
  values (auth.uid(), v_p.email, v_p.full_name, v_p.role, p_origin, v_verif,
          left(p_unit, 60), left(coalesce(p_module,'SISTEMA'), 60), left(coalesce(p_action,'ACAO'), 80),
          left(p_entity_type, 60), left(p_entity_id, 120), p_result, left(coalesce(p_summary,''), 1000),
          case when p_before is not null and pg_column_size(p_before) < 32768 then p_before end,
          case when p_after  is not null and pg_column_size(p_after)  < 32768 then p_after  end)
  returning id into v_id;
  return v_id;
end;
$$;

-- Escrita administrativa (service_role): o ator é informado pela Edge Function após verificação do JWT.
create or replace function public.admin_write_audit(
  p_actor uuid, p_origin text, p_module text, p_action text, p_entity_type text,
  p_entity_id text, p_unit text, p_summary text, p_result text default 'SUCCESS',
  p_before jsonb default null, p_after jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_p public.erp_profiles;
begin
  if p_actor is not null then select * into v_p from public.erp_profiles where id = p_actor; end if;
  insert into public.erp_audit_logs (actor_id, actor_email, actor_name, actor_role, origin_type,
                                 auth_verification, unit_id, module, action, entity_type,
                                 entity_id, result, summary, before_state, after_state)
  values (p_actor, v_p.email, v_p.full_name, v_p.role, p_origin,
          case when p_actor is null then 'SERVICE_ROLE' else 'VERIFIED_MFA' end,
          left(p_unit, 60), left(p_module, 60), left(p_action, 80),
          left(p_entity_type, 60), left(p_entity_id, 120), p_result, left(p_summary, 1000),
          p_before, p_after)
  returning id into v_id;
  return v_id;
end;
$$;

-- Eventos de autenticação registrados pelo próprio usuário (autor = auth.uid(), evento em lista fechada).
create or replace function public.record_auth_event(p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.session_is_valid() then return; end if;
  if p_event not in ('LOGIN','LOGOUT','PASSWORD_CHANGED','MFA_ENROLLED','ACCOUNT_BLOCKED','SESSION_EXPIRED') then
    raise exception 'EVENT_NOT_ALLOWED';
  end if;
  perform private.write_audit('AUTENTICACAO', p_event, 'SESSION', auth.uid()::text, null,
                              'Evento de autenticação: ' || p_event, 'SUCCESS', null, null, 'AUTH_EVENT');
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGERS DE PROTEÇÃO DE PERFIS
-- -----------------------------------------------------------------------------
create or replace function private.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_bad text[];
begin
  -- Defesa em profundidade: mesmo que um GRANT seja concedido por engano, quem chega aqui
  -- com os papéis de API (anon/authenticated) jamais altera perfis.
  if current_user in ('anon', 'authenticated') then
    raise exception 'PRIVILEGE_ESCALATION_BLOCKED: perfis só podem ser alterados por funções administrativas'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'MASTER' and old.status = 'ACTIVE' then
      perform pg_advisory_xact_lock(hashtext('private.last_master'));
      if not exists (select 1 from public.erp_profiles
                      where role = 'MASTER' and status = 'ACTIVE' and id <> old.id) then
        raise exception 'LAST_MASTER_PROTECTED: não é permitido excluir o último MASTER ativo';
      end if;
    end if;
    return old;
  end if;

  new.email := lower(btrim(new.email));
  new.updated_at := now();

  -- Permissões individuais: devem existir; governança é exclusiva do MASTER.
  select array_agg(x) into v_bad
    from unnest(new.extra_permissions || new.denied_permissions) x
   where x not in (select code from public.erp_permissions);
  if v_bad is not null then
    raise exception 'UNKNOWN_PERMISSION: %', v_bad;
  end if;
  if new.role <> 'MASTER' and exists (
       select 1 from public.erp_permissions g
        where g.is_governance and g.code = any (new.extra_permissions)) then
    raise exception 'GOVERNANCE_PERMISSION_RESERVED: permissões de governança são exclusivas do perfil MASTER';
  end if;

  if tg_op = 'UPDATE' then
    if old.role = 'MASTER' and old.status = 'ACTIVE'
       and (new.role <> 'MASTER' or new.status <> 'ACTIVE') then
      perform pg_advisory_xact_lock(hashtext('private.last_master'));
      if not exists (select 1 from public.erp_profiles
                      where role = 'MASTER' and status = 'ACTIVE' and id <> old.id) then
        raise exception 'LAST_MASTER_PROTECTED: não é permitido rebaixar ou desativar o último MASTER ativo';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_trg before insert or update or delete on public.erp_profiles
  for each row execute function private.profiles_guard();

-- -----------------------------------------------------------------------------
-- 6. RPCs DO USUÁRIO AUTENTICADO
-- -----------------------------------------------------------------------------
create or replace function public.my_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_p public.erp_profiles;
begin
  if not private.session_is_valid() then
    return null;
  end if;
  select * into v_p from public.erp_profiles where id = auth.uid();
  if v_p.id is null then
    -- Autenticado no Auth, porém sem perfil provisionado: nenhum acesso.
    return jsonb_build_object('status', 'NO_PROFILE');
  end if;
  return jsonb_build_object(
    'id', v_p.id,
    'email', v_p.email,
    'fullName', v_p.full_name,
    'role', v_p.role,
    'status', v_p.status,
    'mustChangePassword', v_p.must_change_password,
    'authorizedUnits', case when v_p.status = 'ACTIVE' then to_jsonb(v_p.authorized_units) else '[]'::jsonb end,
    'permissions', case when v_p.status = 'ACTIVE' and not v_p.must_change_password
                        then to_jsonb(private.effective_permissions(v_p.id)) else '[]'::jsonb end,
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'mfaRequired', v_p.role = 'MASTER',
    'mfaEnrolled', exists (select 1 from auth.mfa_factors f
                            where f.user_id = v_p.id and f.status = 'verified'),
    'lastSignInAt', (select u.last_sign_in_at from auth.users u where u.id = v_p.id)
  );
end;
$$;

-- Ativação: só ocorre depois que a senha definitiva foi gravada no Auth (hash não vazio).
create or replace function public.complete_activation()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p public.erp_profiles;
  v_has_password boolean;
begin
  if not private.session_is_valid() then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_p from public.erp_profiles where id = auth.uid();
  if v_p.id is null then raise exception 'NO_PROFILE'; end if;
  if v_p.status = 'PENDING' then
    select coalesce(u.encrypted_password, '') <> '' into v_has_password from auth.users u where u.id = v_p.id;
    if not coalesce(v_has_password, false) then
      raise exception 'PASSWORD_NOT_SET: defina a senha definitiva antes de ativar a conta';
    end if;
    if v_p.role <> 'MASTER' and cardinality(v_p.authorized_units) = 0 then
      raise exception 'UNITS_REQUIRED: conta sem unidade autorizada não pode ser ativada';
    end if;
    update public.erp_profiles set status = 'ACTIVE', activated_at = now() where id = v_p.id;
    perform private.write_audit('ADMIN_RBAC', 'ATIVAR_CONTA', 'USER_PROFILE', v_p.id::text, null,
                                'Conta ativada após definição da senha definitiva: ' || v_p.email,
                                'SUCCESS', null, null, 'AUTH_EVENT');
  end if;
  return public.my_profile();
end;
$$;

-- Troca obrigatória (senha temporária / redefinição administrativa): exige que o hash tenha mudado.
create or replace function public.complete_password_change()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p public.erp_profiles;
  v_fp text;
  v_now text;
begin
  if not private.session_is_valid() then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_p from public.erp_profiles where id = auth.uid();
  if v_p.id is null then raise exception 'NO_PROFILE'; end if;
  if v_p.must_change_password then
    select fingerprint into v_fp from private.credential_resets where user_id = v_p.id;
    select md5(coalesce(u.encrypted_password, '')) into v_now from auth.users u where u.id = v_p.id;
    if v_fp is not null and v_fp = v_now then
      raise exception 'PASSWORD_NOT_CHANGED: defina uma nova senha antes de continuar';
    end if;
    update public.erp_profiles set must_change_password = false where id = v_p.id;
    delete from private.credential_resets where user_id = v_p.id;
    perform private.write_audit('ADMIN_RBAC', 'SENHA_ALTERADA', 'USER_PROFILE', v_p.id::text, null,
                                'Senha redefinida pelo próprio usuário após redefinição obrigatória.',
                                'SUCCESS', null, null, 'AUTH_EVENT');
  end if;
  return public.my_profile();
end;
$$;

-- Listagem para o módulo "Usuários e acessos" (somente quem possui MANAGE_USERS).
create or replace function public.admin_list_users()
returns table (
  id uuid, email text, full_name text, role text, authorized_units text[],
  extra_permissions text[], denied_permissions text[], status text,
  must_change_password boolean, invited_at timestamptz, activated_at timestamptz,
  last_sign_in_at timestamptz, mfa_enrolled boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_permission('MANAGE_USERS') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.full_name, p.role, p.authorized_units, p.extra_permissions,
           p.denied_permissions, p.status, p.must_change_password, p.invited_at, p.activated_at,
           u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
      from public.erp_profiles p
      left join auth.users u on u.id = p.id
     order by p.full_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. FUNÇÕES ADMINISTRATIVAS (somente service_role; chamadas pela Edge Function)
-- -----------------------------------------------------------------------------
create or replace function private.assert_actor_master(p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or not exists (
       select 1 from public.erp_profiles
        where id = p_actor and role = 'MASTER' and status = 'ACTIVE') then
    raise exception 'FORBIDDEN: operação restrita a um MASTER ativo' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_create_profile(
  p_actor uuid, p_user_id uuid, p_email text, p_full_name text, p_role text,
  p_units text[], p_extra text[] default '{}', p_denied text[] default '{}'
) returns public.erp_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_row public.erp_profiles;
begin
  perform private.assert_actor_master(p_actor);
  if p_role not in ('MASTER','ADMIN','MANAGER','OPERATOR','VIEWER') then
    raise exception 'INVALID_ROLE';
  end if;
  if p_role <> 'MASTER' and coalesce(cardinality(p_units), 0) = 0 then
    raise exception 'UNITS_REQUIRED: informe ao menos uma unidade autorizada';
  end if;
  insert into public.erp_profiles (id, email, full_name, role, authorized_units, extra_permissions,
                               denied_permissions, status, created_by)
  values (p_user_id, p_email, btrim(p_full_name), p_role,
          case when p_role = 'MASTER' then '{}' else coalesce(p_units, '{}') end,
          coalesce(p_extra, '{}'), coalesce(p_denied, '{}'), 'PENDING', p_actor)
  returning * into v_row;
  perform public.admin_write_audit(p_actor, 'ADMIN_FUNCTION', 'ADMIN_RBAC', 'CRIAR_CONTA_PENDENTE',
    'USER_PROFILE', p_user_id::text, null,
    'Conta pendente de ativação criada para ' || v_row.email || ' com perfil ' || p_role ||
      ' e unidades [' || array_to_string(v_row.authorized_units, ', ') || '].',
    'SUCCESS', null,
    jsonb_build_object('role', p_role, 'units', v_row.authorized_units));
  return v_row;
end;
$$;

create or replace function public.admin_update_profile(
  p_actor uuid, p_user_id uuid, p_full_name text, p_role text, p_units text[],
  p_extra text[] default '{}', p_denied text[] default '{}'
) returns public.erp_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_old public.erp_profiles;
  v_new public.erp_profiles;
begin
  perform private.assert_actor_master(p_actor);
  select * into v_old from public.erp_profiles where id = p_user_id for update;
  if v_old.id is null then raise exception 'USER_NOT_FOUND'; end if;
  if p_actor = p_user_id and (p_role <> v_old.role
       or coalesce(p_units,'{}') is distinct from v_old.authorized_units
       or coalesce(p_extra,'{}') is distinct from v_old.extra_permissions
       or coalesce(p_denied,'{}') is distinct from v_old.denied_permissions) then
    raise exception 'SELF_PRIVILEGE_CHANGE_BLOCKED: ninguém altera o próprio perfil, unidades ou permissões';
  end if;
  if p_role not in ('MASTER','ADMIN','MANAGER','OPERATOR','VIEWER') then
    raise exception 'INVALID_ROLE';
  end if;
  if p_role <> 'MASTER' and v_old.status = 'ACTIVE' and coalesce(cardinality(p_units), 0) = 0 then
    raise exception 'UNITS_REQUIRED: informe ao menos uma unidade autorizada';
  end if;
  update public.erp_profiles
     set full_name = btrim(p_full_name), role = p_role,
         authorized_units = case when p_role = 'MASTER' then '{}' else coalesce(p_units, '{}') end,
         extra_permissions = coalesce(p_extra, '{}'), denied_permissions = coalesce(p_denied, '{}')
   where id = p_user_id returning * into v_new;
  perform public.admin_write_audit(p_actor, 'ADMIN_FUNCTION', 'ADMIN_RBAC', 'ATUALIZAR_ACESSO',
    'USER_PROFILE', p_user_id::text, null,
    'Acesso atualizado de ' || v_new.email || ': perfil ' || v_old.role || ' → ' || v_new.role || '.',
    'SUCCESS',
    jsonb_build_object('role', v_old.role, 'units', v_old.authorized_units, 'extra', v_old.extra_permissions, 'denied', v_old.denied_permissions),
    jsonb_build_object('role', v_new.role, 'units', v_new.authorized_units, 'extra', v_new.extra_permissions, 'denied', v_new.denied_permissions));
  -- Mudança de privilégio exige nova sessão: encerra as existentes.
  delete from auth.sessions where user_id = p_user_id;
  return v_new;
end;
$$;

create or replace function public.admin_set_status(
  p_actor uuid, p_user_id uuid, p_status text, p_reason text default null
) returns public.erp_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_old public.erp_profiles;
  v_new public.erp_profiles;
begin
  perform private.assert_actor_master(p_actor);
  if p_status not in ('ACTIVE','SUSPENDED','DEACTIVATED') then raise exception 'INVALID_STATUS'; end if;
  select * into v_old from public.erp_profiles where id = p_user_id for update;
  if v_old.id is null then raise exception 'USER_NOT_FOUND'; end if;
  if p_actor = p_user_id and p_status <> 'ACTIVE' then
    raise exception 'SELF_DEACTIVATION_BLOCKED: não é permitido desativar a própria conta';
  end if;
  if v_old.status = 'PENDING' and p_status = 'ACTIVE' then
    raise exception 'PENDING_MUST_SET_PASSWORD: a ativação ocorre quando o operador define a senha';
  end if;
  update public.erp_profiles
     set status = p_status,
         deactivated_at = case when p_status = 'ACTIVE' then null else now() end
   where id = p_user_id returning * into v_new;
  if p_status <> 'ACTIVE' then
    delete from auth.sessions where user_id = p_user_id;
  end if;
  perform public.admin_write_audit(p_actor, 'ADMIN_FUNCTION', 'ADMIN_RBAC',
    case p_status when 'ACTIVE' then 'REATIVAR_CONTA' when 'SUSPENDED' then 'SUSPENDER_CONTA' else 'DESATIVAR_CONTA' end,
    'USER_PROFILE', p_user_id::text, null,
    'Situação da conta ' || v_new.email || ': ' || v_old.status || ' → ' || p_status ||
      coalesce(' (' || p_reason || ')', ''),
    'SUCCESS', jsonb_build_object('status', v_old.status), jsonb_build_object('status', v_new.status));
  return v_new;
end;
$$;

create or replace function public.admin_flag_credential_reset(p_actor uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.erp_profiles;
begin
  perform private.assert_actor_master(p_actor);
  select * into v_p from public.erp_profiles where id = p_user_id for update;
  if v_p.id is null then raise exception 'USER_NOT_FOUND'; end if;
  insert into private.credential_resets (user_id, fingerprint)
  values (p_user_id, (select md5(coalesce(encrypted_password, '')) from auth.users where id = p_user_id))
  on conflict (user_id) do update set fingerprint = excluded.fingerprint, created_at = now();
  update public.erp_profiles set must_change_password = true where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform public.admin_write_audit(p_actor, 'ADMIN_FUNCTION', 'ADMIN_RBAC', 'REDEFINIR_CREDENCIAIS',
    'USER_PROFILE', p_user_id::text, null,
    'Credenciais de ' || v_p.email || ' invalidadas; nova senha obrigatória no próximo acesso.');
end;
$$;

create or replace function public.admin_revoke_sessions(p_actor uuid, p_user_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
  v_email text;
begin
  perform private.assert_actor_master(p_actor);
  select email into v_email from public.erp_profiles where id = p_user_id;
  if v_email is null then raise exception 'USER_NOT_FOUND'; end if;
  with d as (delete from auth.sessions where user_id = p_user_id returning 1) select count(*) into v_n from d;
  perform public.admin_write_audit(p_actor, 'ADMIN_FUNCTION', 'ADMIN_RBAC', 'ENCERRAR_SESSOES',
    'USER_PROFILE', p_user_id::text, null,
    'Sessões de ' || v_email || ' encerradas (' || v_n || ').');
  return v_n;
end;
$$;

-- Provisionamento do PRIMEIRO MASTER (script controlado, service_role). Recusa se já existir MASTER.
create or replace function public.admin_bootstrap_first_master(p_user_id uuid, p_email text, p_full_name text)
returns public.erp_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_row public.erp_profiles;
begin
  if exists (select 1 from public.erp_profiles where role = 'MASTER' and status in ('PENDING','ACTIVE')) then
    raise exception 'MASTER_ALREADY_PROVISIONED: já existe um MASTER; use o procedimento de recuperação documentado';
  end if;
  insert into public.erp_profiles (id, email, full_name, role, authorized_units, status)
  values (p_user_id, p_email, btrim(p_full_name), 'MASTER', '{}', 'PENDING')
  returning * into v_row;
  perform public.admin_write_audit(null, 'SYSTEM_BOOTSTRAP', 'ADMIN_RBAC', 'PROVISIONAR_PRIMEIRO_MASTER',
    'USER_PROFILE', p_user_id::text, null, 'Primeiro MASTER provisionado: ' || v_row.email);
  return v_row;
end;
$$;

-- Recuperação "break-glass": só quando NÃO há MASTER ativo, ou para reiniciar credenciais/MFA de um MASTER.
create or replace function public.admin_recover_master(p_user_id uuid, p_email text, p_full_name text)
returns public.erp_profiles language plpgsql security definer set search_path = '' as $$
declare
  v_row public.erp_profiles;
begin
  if exists (select 1 from public.erp_profiles
              where role = 'MASTER' and status = 'ACTIVE' and id <> p_user_id) then
    raise exception 'ACTIVE_MASTER_EXISTS: há outro MASTER ativo; a recuperação deve ser feita por ele no módulo Usuários e acessos';
  end if;
  insert into public.erp_profiles (id, email, full_name, role, authorized_units, status, must_change_password)
  values (p_user_id, p_email, btrim(p_full_name), 'MASTER', '{}', 'ACTIVE', true)
  on conflict (id) do update
     set role = 'MASTER', status = 'ACTIVE', must_change_password = true, deactivated_at = null
  returning * into v_row;
  insert into private.credential_resets (user_id, fingerprint)
  values (p_user_id, (select md5(coalesce(encrypted_password, '')) from auth.users where id = p_user_id))
  on conflict (user_id) do update set fingerprint = excluded.fingerprint, created_at = now();
  delete from auth.sessions where user_id = p_user_id;
  perform public.admin_write_audit(null, 'BREAK_GLASS', 'ADMIN_RBAC', 'RECUPERAR_MASTER',
    'USER_PROFILE', p_user_id::text, null,
    'Recuperação administrativa (break-glass) do MASTER ' || v_row.email || '.', 'SUCCESS');
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS E PRIVILÉGIOS
-- -----------------------------------------------------------------------------
alter table public.erp_permissions      enable row level security;
alter table public.erp_role_permissions enable row level security;
alter table public.erp_profiles         enable row level security;
alter table public.erp_audit_logs       enable row level security;

revoke all on public.erp_permissions, public.erp_role_permissions, public.erp_profiles, public.erp_audit_logs
  from public, anon, authenticated;
grant select on public.erp_permissions, public.erp_role_permissions to authenticated;
grant select on public.erp_profiles   to authenticated;
grant select on public.erp_audit_logs to authenticated;
grant all on public.erp_permissions, public.erp_role_permissions, public.erp_profiles to service_role;
grant select, insert on public.erp_audit_logs to service_role;
grant select, insert, update, delete on private.credential_resets to service_role;

create policy permissions_read on public.erp_permissions
  for select to authenticated using (private.session_is_valid());
create policy role_permissions_read on public.erp_role_permissions
  for select to authenticated using (private.session_is_valid());

create policy profiles_read_own on public.erp_profiles
  for select to authenticated using (id = auth.uid() and private.session_is_valid());
create policy profiles_read_managers on public.erp_profiles
  for select to authenticated using (private.has_permission('MANAGE_USERS'));

-- Auditoria: MASTER vê tudo; quem tem VIEW_AUDIT vê somente eventos das suas unidades.
create policy audit_read on public.erp_audit_logs
  for select to authenticated
  using (
    private.has_permission('VIEW_AUDIT')
    and (private.current_role_code() = 'MASTER'
         or (unit_id is not null and private.can_access_unit(unit_id)))
  );

-- Funções: nada é executável por padrão; concede-se explicitamente.
revoke execute on all functions in schema private from public, anon, authenticated;
-- Apenas os predicados usados por políticas RLS são executáveis pelos papéis de API.
grant execute on function
  private.session_is_valid(), private.is_active_user(), private.current_role_code(),
  private.has_permission(text), private.can_access_unit(text)
  to authenticated, service_role;

revoke execute on function
  public.admin_write_audit(uuid,text,text,text,text,text,text,text,text,jsonb,jsonb),
  public.admin_create_profile(uuid,uuid,text,text,text,text[],text[],text[]),
  public.admin_update_profile(uuid,uuid,text,text,text[],text[],text[]),
  public.admin_set_status(uuid,uuid,text,text),
  public.admin_flag_credential_reset(uuid,uuid),
  public.admin_revoke_sessions(uuid,uuid),
  public.admin_bootstrap_first_master(uuid,text,text),
  public.admin_recover_master(uuid,text,text)
  from public, anon, authenticated;
grant execute on function
  public.admin_write_audit(uuid,text,text,text,text,text,text,text,text,jsonb,jsonb),
  public.admin_create_profile(uuid,uuid,text,text,text,text[],text[],text[]),
  public.admin_update_profile(uuid,uuid,text,text,text[],text[],text[]),
  public.admin_set_status(uuid,uuid,text,text),
  public.admin_flag_credential_reset(uuid,uuid),
  public.admin_revoke_sessions(uuid,uuid),
  public.admin_bootstrap_first_master(uuid,text,text),
  public.admin_recover_master(uuid,text,text)
  to service_role;

revoke execute on function
  public.my_profile(), public.complete_activation(), public.complete_password_change(),
  public.admin_list_users(), public.record_auth_event(text)
  from public, anon;
grant execute on function
  public.my_profile(), public.complete_activation(), public.complete_password_change(),
  public.admin_list_users(), public.record_auth_event(text)
  to authenticated;
