-- =============================================================================
-- STUB DO AMBIENTE SUPABASE — SOMENTE PARA TESTES LOCAIS (PGlite). NÃO É UMA MIGRATION.
-- Reproduz o mínimo do projeto Supabase necessário para executar as migrations reais:
-- papéis de API, schema auth (users/sessions/mfa_factors), auth.uid()/auth.jwt() e os
-- privilégios padrão do schema public (que concedem ALL a anon/authenticated e que as
-- migrations de segurança precisam revogar).
-- =============================================================================
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz default now()
);
create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
);
create table auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_type text not null default 'totp',
  status text not null default 'unverified'
);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
