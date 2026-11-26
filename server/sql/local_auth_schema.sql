-- =============================================================================
-- SCHEMA DE AUTENTICAÇÃO DO BACKEND LOCAL POSTGRESQL (PGlite)
-- Compatível 100% com as migrations de segurança do Supabase (`auth.uid()`,
-- `auth.jwt()`, `auth.users`, `auth.sessions`, `auth.mfa_factors` e papéis RLS).
-- Idempotente para reinicializações seguras do servidor.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  encrypted_password text,
  full_name          text,
  email_confirmed_at timestamptz default now(),
  last_sign_in_at    timestamptz,
  banned_until       timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists auth.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  aal        text not null default 'aal1' check (aal in ('aal1','aal2')),
  amr        jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists auth.mfa_factors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  factor_type   text not null default 'totp',
  friendly_name text,
  secret        text not null,
  status        text not null default 'unverified' check (status in ('unverified','verified')),
  created_at    timestamptz not null default now()
);

create table if not exists auth.one_time_tokens (
  token_hash text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  token_type text not null check (token_type in ('invite','recovery')),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

create table if not exists auth.applied_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
