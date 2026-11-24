-- =============================================================================
-- MIGRATION 20261201000300 — LOCKDOWN DAS TABELAS LEGADAS  (APLICAR SOMENTE APÓS A MIGRAÇÃO DE DADOS)
--
-- Contexto: a tabela `configuracoes` (documento único do ERP v7/v8) e o esquema relacional
-- da migration 20261028 foram criados SEM RLS, com privilégios padrão do Supabase para
-- anon/authenticated. Qualquer pessoa com a chave anônima — que está pública no repositório —
-- consegue ler e sobrescrever esses dados.
--
-- Esta migration NÃO apaga dados: habilita RLS e revoga os privilégios de anon/authenticated.
-- Sem políticas, o único acesso restante é do service_role (backup/rollback por administrador).
--
-- ATENÇÃO — REQUER AUTORIZAÇÃO EXPRESSA DO RESPONSÁVEL: a aplicação legada (v8) deixa de
-- funcionar a partir daqui. Execute depois de:
--   1) node scripts/migrate-legacy-to-partitions.mjs (sem --dry-run) com contagens conferidas;
--   2) backup do projeto (Dashboard > Database > Backups) confirmado.
--
-- REVERSÍVEL: para voltar ao estado anterior (NÃO recomendado), conceda novamente os
-- privilégios — veja docs/security/MIGRATIONS.md.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'configuracoes',
    'companies', 'units', 'sectors', 'unit_sectors', 'functional_categories', 'roles',
    'work_shifts', 'schedule_rules', 'schedule_rule_versions', 'work_positions',
    'employees', 'employee_allocations', 'unavailability_events', 'market_calendar_days',
    'monthly_schedules', 'daily_schedule_entries', 'cycle_states',
    'user_profiles', 'audit_logs'
  ] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      raise notice 'lockdown aplicado em public.%', t;
    end if;
  end loop;
end;
$$;
