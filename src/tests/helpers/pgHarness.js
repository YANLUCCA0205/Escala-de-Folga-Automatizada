// Harness de testes de banco: Postgres real (PGlite) + stub do Supabase + migrations reais.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

export function readSql(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export async function createDatabase({ includeLockdown = false } = {}) {
  const db = new PGlite();
  await db.exec(readSql("supabase/tests/supabase_stub.sql"));
  await db.exec(readSql("supabase/migrations/20261201000100_security_foundation.sql"));
  await db.exec(readSql("supabase/migrations/20261201000200_partitioned_storage.sql"));
  if (includeLockdown) {
    await db.exec(readSql("supabase/migrations/20261201000300_lockdown_legacy_tables.sql"));
  }
  return db;
}

const nowSec = () => Math.floor(Date.now() / 1000);

/** Cria usuário no "Auth" (stub) e, opcionalmente, uma sessão. Retorna { id, sessionId }. */
export async function createAuthUser(db, email, { password = "hash-definitivo", withSession = true } = {}) {
  const u = await db.query(
    "insert into auth.users (email, encrypted_password) values ($1, $2) returning id",
    [email, password]
  );
  const id = u.rows[0].id;
  let sessionId = null;
  if (withSession) {
    const s = await db.query("insert into auth.sessions (user_id) values ($1) returning id", [id]);
    sessionId = s.rows[0].id;
  }
  return { id, sessionId, email };
}

/** Claims no formato do Supabase. */
export function claims(user, { aal = "aal1", totpAgeSeconds = null, role = "authenticated" } = {}) {
  const amr = [{ method: "password", timestamp: nowSec() - 5 }];
  if (aal === "aal2") amr.push({ method: "totp", timestamp: nowSec() - (totpAgeSeconds ?? 5) });
  return { sub: user.id, role, session_id: user.sessionId, aal, amr, email: user.email };
}

/** Executa fn com a identidade/papel de API informados (equivale a uma requisição PostgREST). */
export async function asRole(db, apiRole, jwtClaims, fn) {
  await db.query("select set_config('request.jwt.claims', $1, false)", [jwtClaims ? JSON.stringify(jwtClaims) : ""]);
  await db.exec(`set role ${apiRole}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}

export const asUser = (db, jwtClaims, fn) => asRole(db, "authenticated", jwtClaims, fn);
export const asAnon = (db, fn) => asRole(db, "anon", null, fn);
export const asService = (db, fn) => asRole(db, "service_role", { role: "service_role" }, fn);

/** Retorna { ok:true, rows } ou { ok:false, error } sem lançar (para asserções de negativa). */
export async function attempt(db, sql, params = []) {
  try {
    const r = await db.query(sql, params);
    return { ok: true, rows: r.rows };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** Nova sessão do Auth para o usuário (simula novo login). Executa como superusuário do stub. */
export async function newSession(db, user) {
  const s = await db.query("insert into auth.sessions (user_id) values ($1) returning id", [user.id]);
  return s.rows[0].id;
}

/** Simula a gravação da senha definitiva (hash) no Auth. */
export async function setPassword(db, user, hash) {
  await db.query("update auth.users set encrypted_password = $2 where id = $1", [user.id, hash]);
}