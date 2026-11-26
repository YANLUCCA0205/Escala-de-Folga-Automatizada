-- =============================================================================
-- MIGRATION 20261201000400 — GOVERNANÇA DIRETA MASTER SEM DEPENDÊNCIA DE EDGE FUNCTION
--
-- Permite que um administrador MASTER ativo execute operações de governança
-- (criar perfil de operador provisionado, atualizar unidades/permissões,
-- suspender/reativar/desativar, sinalizar troca obrigatória de senha e revogar
-- sessões) diretamente via RPC `public.master_manage_user` autenticada por
-- `auth.uid()` (SECURITY DEFINER), eliminando o erro "Failed to send a request
-- to the Edge Function" caso a Edge Function `admin-users` não tenha sido
-- publicada separadamente via Supabase CLI.
-- =============================================================================

create or replace function public.master_manage_user(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_action text := coalesce(p_payload ->> 'action', '');
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_role text;
  v_status text;
  v_reason text;
  v_units text[];
  v_extra text[];
  v_denied text[];
  v_must_change boolean;
  v_row public.erp_profiles;
  v_revoked integer;
begin
  if not private.is_active_user() then
    return jsonb_build_object('ok', false, 'error', 'UNAUTHENTICATED', 'message', 'Sessão inválida ou expirada.');
  end if;

  -- Valida que o chamador real (auth.uid()) é um MASTER ativo
  perform private.assert_actor_master(v_actor);

  if v_action = 'invite' or v_action = 'create_profile' then
    v_user_id := (p_payload ->> 'userId')::uuid;
    v_email := lower(btrim(coalesce(p_payload ->> 'email', '')));
    v_full_name := btrim(coalesce(p_payload ->> 'fullName', ''));
    v_role := upper(btrim(coalesce(p_payload ->> 'role', 'OPERATOR')));
    v_must_change := coalesce((p_payload ->> 'mustChangePassword')::boolean, false);

    select coalesce(array_agg(x), '{}') into v_units
      from jsonb_array_elements_text(coalesce(p_payload -> 'authorizedUnits', '[]'::jsonb)) as t(x);
    select coalesce(array_agg(x), '{}') into v_extra
      from jsonb_array_elements_text(coalesce(p_payload -> 'extraPermissions', '[]'::jsonb)) as t(x);
    select coalesce(array_agg(x), '{}') into v_denied
      from jsonb_array_elements_text(coalesce(p_payload -> 'deniedPermissions', '[]'::jsonb)) as t(x);

    v_row := public.admin_create_profile(
      v_actor, v_user_id, v_email, v_full_name, v_role,
      case when v_role = 'MASTER' then '{}'::text[] else v_units end,
      v_extra, v_denied
    );

    if v_must_change then
      perform public.admin_flag_credential_reset(v_actor, v_user_id);
      select * into v_row from public.erp_profiles where id = v_user_id;
    end if;

    return jsonb_build_object('ok', true, 'profile', row_to_json(v_row));
  end if;

  if v_action = 'update_profile' then
    v_user_id := (p_payload ->> 'userId')::uuid;
    v_full_name := btrim(coalesce(p_payload ->> 'fullName', ''));
    v_role := upper(btrim(coalesce(p_payload ->> 'role', 'OPERATOR')));

    select coalesce(array_agg(x), '{}') into v_units
      from jsonb_array_elements_text(coalesce(p_payload -> 'authorizedUnits', '[]'::jsonb)) as t(x);
    select coalesce(array_agg(x), '{}') into v_extra
      from jsonb_array_elements_text(coalesce(p_payload -> 'extraPermissions', '[]'::jsonb)) as t(x);
    select coalesce(array_agg(x), '{}') into v_denied
      from jsonb_array_elements_text(coalesce(p_payload -> 'deniedPermissions', '[]'::jsonb)) as t(x);

    v_row := public.admin_update_profile(
      v_actor, v_user_id, v_full_name, v_role,
      case when v_role = 'MASTER' then '{}'::text[] else v_units end,
      v_extra, v_denied
    );

    return jsonb_build_object('ok', true, 'profile', row_to_json(v_row));
  end if;

  if v_action = 'set_status' then
    v_user_id := (p_payload ->> 'userId')::uuid;
    v_status := upper(btrim(coalesce(p_payload ->> 'status', '')));
    v_reason := nullif(btrim(coalesce(p_payload ->> 'reason', '')), '');

    v_row := public.admin_set_status(v_actor, v_user_id, v_status, v_reason);
    return jsonb_build_object('ok', true, 'profile', row_to_json(v_row));
  end if;

  if v_action = 'revoke_sessions' then
    v_user_id := (p_payload ->> 'userId')::uuid;
    v_revoked := public.admin_revoke_sessions(v_actor, v_user_id);
    return jsonb_build_object('ok', true, 'revokedSessions', coalesce(v_revoked, 0));
  end if;

  if v_action = 'reset_credentials' then
    v_user_id := (p_payload ->> 'userId')::uuid;
    perform public.admin_flag_credential_reset(v_actor, v_user_id);
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'UNKNOWN_ACTION', 'message', 'Ação administrativa desconhecida.');
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'ADMIN_RPC_ERROR', 'message', sqlerrm);
end;
$$;

revoke execute on function public.master_manage_user(jsonb) from public, anon;
grant execute on function public.master_manage_user(jsonb) to authenticated, service_role;
