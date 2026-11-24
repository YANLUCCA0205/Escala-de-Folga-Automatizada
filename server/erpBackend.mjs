// =============================================================================
// SERVIDOR BACKEND SOBERANO LOCAL — WORKFORCE ERP v9.0 (Node.js + PostgreSQL PGlite)
//
// Executa exatamente as mesmas migrations SQL, políticas RLS, triggers de auditoria
// imutável e RPCs transacionais do ambiente Supabase Cloud, utilizando:
//   • PostgreSQL real via `@electric-sql/pglite` persistido em `.data/pgdata`
//   • Hashing de senhas `scrypt` (`node:crypto`) — zero texto puro
//   • Tokens JWT `HS256` vinculados a `auth.sessions` (revogação imediata)
//   • Convites e links de recuperação de uso único com hash SHA-256 e expiração
//   • Segundo fator TOTP RFC 6238 real para o perfil MASTER (`aal2`)
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
  generateOneTimeToken,
  hashOneTimeToken,
  signJwtHs256,
  verifyJwtHs256,
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotpCode,
} from "./totp.mjs";
import { evaluatePassword } from "../src/domain/passwordPolicy.js";
import { upgradeDatabaseToV8 } from "../src/services/erpRepository.js";
import {
  splitDatabaseIntoPartitions,
  verifyPartitionRoundtrip,
} from "../src/services/partitionCodec.js";
import { handleAdminUsersRequest } from "../supabase/functions/admin-users/handler.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");

const ALLOWED_SELECT_TABLES = new Set([
  "erp_partitions",
  "erp_settings",
  "erp_audit_logs",
  "erp_permissions",
  "erp_role_permissions",
  "erp_profiles",
]);

const ALLOWED_PUBLIC_RPCS = new Set([
  "my_profile",
  "complete_activation",
  "complete_password_change",
  "admin_list_users",
  "record_auth_event",
  "erp_save_batch",
  "erp_set_setting",
  "erp_create_backup",
  "erp_list_backups",
  "erp_get_backup",
  "erp_restore_backup",
]);

function readOrCreateSecretFile(filePath) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf8").trim();
    if (existing.length >= 32) return existing;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fresh = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(filePath, fresh, { encoding: "utf8", mode: 0o600 });
  return fresh;
}

export async function createErpBackend({
  dataDir = path.join(PROJECT_ROOT, ".data"),
  inMemory = false,
  autoMigrateBackupFile = path.join(PROJECT_ROOT, "backups/backup_pre_v8_20261028.json"),
} = {}) {
  const pgPath = inMemory ? undefined : path.join(dataDir, "pgdata");
  if (!inMemory) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const jwtSecret = inMemory
    ? crypto.randomBytes(32).toString("hex")
    : readOrCreateSecretFile(path.join(dataDir, "jwt.secret"));

  const bootstrapSecret = inMemory
    ? crypto.randomBytes(32).toString("hex")
    : readOrCreateSecretFile(path.join(dataDir, "admin.secret"));

  const db = new PGlite(pgPath);

  // Fila sequencial para isolar SET LOCAL ROLE / request.jwt.claims por requisição
  let mutexChain = Promise.resolve();
  const runExclusive = (fn) => {
    const next = mutexChain.then(fn, fn);
    mutexChain = next.catch(() => {});
    return next;
  };

  // 1. Inicializa schema auth + migrations de segurança (idempotente)
  await runExclusive(async () => {
    const authSql = fs.readFileSync(path.join(HERE, "sql/local_auth_schema.sql"), "utf8");
    await db.exec(authSql);

    const migrations = [
      ["20261201000100_security_foundation", "supabase/migrations/20261201000100_security_foundation.sql"],
      ["20261201000200_partitioned_storage", "supabase/migrations/20261201000200_partitioned_storage.sql"],
    ];

    for (const [version, relFile] of migrations) {
      const check = await db.query("select 1 from auth.applied_migrations where version = $1", [version]);
      if (check.rows.length === 0) {
        const sql = fs.readFileSync(path.join(PROJECT_ROOT, relFile), "utf8");
        await db.exec(sql);
        await db.query("insert into auth.applied_migrations (version) values ($1)", [version]);
      }
    }

    // 2. Migração inicial automática e não destrutiva da base operacional caso erp_partitions esteja vazia
    if (autoMigrateBackupFile && fs.existsSync(autoMigrateBackupFile)) {
      const countRes = await db.query("select count(*)::int as n from public.erp_partitions");
      if (countRes.rows[0].n === 0) {
        const rawBackup = JSON.parse(fs.readFileSync(autoMigrateBackupFile, "utf8"));
        const normalized = upgradeDatabaseToV8(rawBackup);
        const partitionsMap = splitDatabaseIntoPartitions(normalized);
        const verification = verifyPartitionRoundtrip(normalized, partitionsMap);

        if (verification.ok) {
          for (const part of partitionsMap.values()) {
            await db.query(
              `insert into public.erp_partitions (scope, kind, period, data, revision, updated_at)
               values ($1, $2, $3, $4::jsonb, 1, now())
               on conflict (scope, kind, period) do nothing`,
              [part.scope, part.kind, part.period || "", JSON.stringify(part.data)]
            );
          }

          // Grava snapshot inicial PRE_MIGRATION em erp_backups
          const allPayload = JSON.stringify(
            Array.from(partitionsMap.values()).map((p) => ({ ...p, revision: 1 }))
          );
          const checksum = crypto.createHash("md5").update(allPayload).digest("hex");
          await db.query(
            `insert into public.erp_backups (created_by, kind, label, partition_count, size_bytes, checksum, payload)
             values (null, 'PRE_MIGRATION', 'Base inicial migrada automaticamente (v8 -> v9)', $1, $2, $3, $4::jsonb)`,
            [partitionsMap.size, Buffer.byteLength(allPayload, "utf8"), checksum, allPayload]
          );

          // Importa trilha histórica sinalizando explicitamente autoria não verificada quando legada
          for (const l of normalized.auditLogs || []) {
            const isSeed = l.authVerificationStatus === "SYSTEM_SEED";
            await db.query(
              `insert into public.erp_audit_logs
                (created_at, actor_id, actor_email, actor_name, actor_role, origin_type, auth_verification,
                 unit_id, module, action, entity_type, entity_id, result, summary)
               values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SUCCESS', $12)`,
              [
                l.createdAt || new Date().toISOString(),
                l.actorEmail || "legado@sistema",
                l.actorName || l.actorEmail || "Registro Inicial",
                l.actorRole || "LEGACY",
                isSeed ? "SYSTEM_MIGRATION" : "LEGACY_IMPORT",
                isSeed ? "SYSTEM_SEED" : "UNVERIFIED_LEGACY",
                l.unitId || (l.entityType === "UNIT" ? l.entityId : null),
                String(l.module || "MIGRACAO").slice(0, 60),
                String(l.action || "IMPORTACAO").slice(0, 80),
                l.entityType ? String(l.entityType).slice(0, 60) : null,
                l.entityId ? String(l.entityId).slice(0, 120) : null,
                String(l.summary || "Importado da base anterior.").slice(0, 1000),
              ]
            );
          }
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Limitador de taxa no servidor (por IP + rota)
  // ---------------------------------------------------------------------------
  const rateMap = new Map();
  function checkServerRateLimit(bucketKey, maxHits = 15, windowMs = 10 * 60 * 1000) {
    const now = Date.now();
    const cur = rateMap.get(bucketKey);
    if (!cur || now - cur.start > windowMs) {
      rateMap.set(bucketKey, { count: 1, start: now });
      return true;
    }
    if (cur.count >= maxHits) return false;
    cur.count += 1;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Emissão de sessão + JWT autenticado
  // ---------------------------------------------------------------------------
  async function createSessionAndToken(user, { aal = "aal1", method = "password" } = {}) {
    const nowSec = Math.floor(Date.now() / 1000);
    const amr = [{ method, timestamp: nowSec }];
    const sRes = await db.query(
      "insert into auth.sessions (user_id, aal, amr) values ($1, $2, $3::jsonb) returning id",
      [user.id, aal, JSON.stringify(amr)]
    );
    const sessionId = sRes.rows[0].id;
    await db.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]);

    const accessToken = signJwtHs256(
      {
        sub: user.id,
        email: user.email,
        role: "authenticated",
        session_id: sessionId,
        aal,
        amr,
      },
      jwtSecret,
      3600
    );

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name || user.email },
      },
    };
  }

  async function issueOneTimeActionLink({ userId, tokenType, origin, hoursValid = 24 }) {
    // Invalida tokens anteriores do mesmo tipo ainda não consumidos
    await db.query(
      "update auth.one_time_tokens set used_at = now() where user_id = $1 and token_type = $2 and used_at is null",
      [userId, tokenType]
    );
    const { rawToken, tokenHash } = generateOneTimeToken();
    const expiresAt = new Date(Date.now() + hoursValid * 3600 * 1000).toISOString();
    await db.query(
      "insert into auth.one_time_tokens (token_hash, user_id, token_type, expires_at) values ($1, $2, $3, $4)",
      [tokenHash, userId, tokenType, expiresAt]
    );
    const base = String(origin || "http://localhost:5173").replace(/\/+$/, "");
    return `${base}/?type=${tokenType}&token=${encodeURIComponent(rawToken)}`;
  }

  // Executa operação SQL sob o contexto RLS exato do usuário autenticado
  async function withAuthenticatedRls(jwtClaims, callback) {
    return runExclusive(async () => {
      await db.exec("begin");
      try {
        await db.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify(jwtClaims),
        ]);
        await db.exec("set local role authenticated");
        const result = await callback();
        await db.exec("commit");
        return result;
      } catch (err) {
        await db.exec("rollback").catch(() => {});
        throw err;
      }
    });
  }

  // Valida Bearer token e confirma que a sessão ainda existe em auth.sessions
  async function authenticateBearer(authHeader) {
    const raw = String(authHeader || "");
    if (!raw.toLowerCase().startsWith("bearer ")) return null;
    const token = raw.slice(7).trim();
    const claims = verifyJwtHs256(token, jwtSecret);
    if (!claims?.sub || !claims?.session_id) return null;

    return runExclusive(async () => {
      const check = await db.query(
        `select s.id as session_id, s.aal, s.amr, u.id, u.email, u.full_name, u.banned_until
           from auth.sessions s
           join auth.users u on u.id = s.user_id
          where s.id = $1 and u.id = $2`,
        [claims.session_id, claims.sub]
      );
      if (check.rows.length === 0) return null;
      const row = check.rows[0];
      if (row.banned_until && new Date(row.banned_until) > new Date()) {
        return null;
      }
      return {
        token,
        user: { id: row.id, email: row.email, full_name: row.full_name },
        claims: {
          ...claims,
          aal: row.aal,
          amr: row.amr,
        },
      };
    });
  }

  // Adaptador interno `serviceClient` para reutilizar `handleAdminUsersRequest` da Edge Function
  function buildInternalServiceClient(origin) {
    return {
      auth: {
        async getUser(bearerToken) {
          const verified = verifyJwtHs256(bearerToken, jwtSecret);
          if (!verified?.sub) return { data: null, error: new Error("Token inválido") };
          const r = await db.query("select id, email, full_name from auth.users where id = $1", [
            verified.sub,
          ]);
          if (r.rows.length === 0) return { data: null, error: new Error("Não encontrado") };
          return { data: { user: r.rows[0] }, error: null };
        },
        admin: {
          async createUser({ email, password, user_metadata }) {
            const cleanEmail = String(email).trim().toLowerCase();
            const dup = await db.query("select id from auth.users where lower(email) = $1", [cleanEmail]);
            if (dup.rows.length > 0) {
              return { data: null, error: new Error("Já existe um usuário com este e-mail.") };
            }
            const hash = password ? hashPasswordScrypt(password) : null;
            const ins = await db.query(
              "insert into auth.users (email, encrypted_password, full_name) values ($1, $2, $3) returning id, email",
              [cleanEmail, hash, user_metadata?.full_name || ""]
            );
            return { data: { user: ins.rows[0] }, error: null };
          },
          async generateLink({ type, email, options }) {
            const cleanEmail = String(email).trim().toLowerCase();
            let uRes = await db.query("select id, email from auth.users where lower(email) = $1", [
              cleanEmail,
            ]);
            if (uRes.rows.length === 0) {
              if (type !== "invite") {
                return { data: null, error: new Error("Conta não localizada.") };
              }
              uRes = await db.query(
                "insert into auth.users (email, encrypted_password, full_name) values ($1, null, $2) returning id, email",
                [cleanEmail, options?.data?.full_name || ""]
              );
            }
            const user = uRes.rows[0];
            const actionLink = await issueOneTimeActionLink({
              userId: user.id,
              tokenType: type === "invite" ? "invite" : "recovery",
              origin: options?.redirectTo || origin,
              hoursValid: type === "invite" ? 48 : 2,
            });
            return {
              data: { user, properties: { action_link: actionLink } },
              error: null,
            };
          },
          async inviteUserByEmail(email, opts) {
            // Em ambiente local sem servidor SMTP, cria o usuário e gera o link de convite seguro
            return this.generateLink({
              type: "invite",
              email,
              options: { data: opts?.data, redirectTo: opts?.redirectTo },
            });
          },
          async updateUserById(userId, attrs) {
            if (attrs.password) {
              const h = hashPasswordScrypt(attrs.password);
              await db.query("update auth.users set encrypted_password = $2 where id = $1", [
                userId,
                h,
              ]);
            }
            if (attrs.ban_duration) {
              const bannedUntil =
                attrs.ban_duration === "none"
                  ? null
                  : new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
              await db.query("update auth.users set banned_until = $2 where id = $1", [
                userId,
                bannedUntil,
              ]);
            }
            return { data: { user: { id: userId } }, error: null };
          },
          async deleteUser(userId) {
            await db.query("delete from auth.users where id = $1", [userId]);
            return { data: {}, error: null };
          },
        },
      },
      from(table) {
        return {
          select(cols) {
            const safeCols = cols === "*" ? "*" : "id, email, role, status";
            return {
              eq(col, val) {
                const safeCol = col === "email" ? "email" : "id";
                return {
                  async maybeSingle() {
                    const r = await db.query(
                      `select ${safeCols} from public.${table} where ${safeCol} = $1 limit 1`,
                      [val]
                    );
                    return { data: r.rows[0] || null, error: null };
                  },
                };
              },
            };
          },
        };
      },
      async rpc(fnName, args = {}) {
        try {
          if (fnName === "admin_create_profile") {
            const r = await db.query(
              "select row_to_json(public.admin_create_profile($1,$2,$3,$4,$5,$6,$7,$8)) as res",
              [
                args.p_actor,
                args.p_user_id,
                args.p_email,
                args.p_full_name,
                args.p_role,
                args.p_units || [],
                args.p_extra || [],
                args.p_denied || [],
              ]
            );
            return { data: r.rows[0]?.res, error: null };
          }
          if (fnName === "admin_update_profile") {
            const r = await db.query(
              "select row_to_json(public.admin_update_profile($1,$2,$3,$4,$5,$6,$7)) as res",
              [
                args.p_actor,
                args.p_user_id,
                args.p_full_name,
                args.p_role,
                args.p_units || [],
                args.p_extra || [],
                args.p_denied || [],
              ]
            );
            return { data: r.rows[0]?.res, error: null };
          }
          if (fnName === "admin_set_status") {
            const r = await db.query(
              "select row_to_json(public.admin_set_status($1,$2,$3,$4)) as res",
              [args.p_actor, args.p_user_id, args.p_status, args.p_reason || null]
            );
            return { data: r.rows[0]?.res, error: null };
          }
          if (fnName === "admin_flag_credential_reset") {
            await db.query("select public.admin_flag_credential_reset($1,$2)", [
              args.p_actor,
              args.p_user_id,
            ]);
            return { data: null, error: null };
          }
          if (fnName === "admin_revoke_sessions") {
            const r = await db.query("select public.admin_revoke_sessions($1,$2) as n", [
              args.p_actor,
              args.p_user_id,
            ]);
            return { data: r.rows[0]?.n ?? 0, error: null };
          }
          return { data: null, error: new Error(`RPC administrativa não mapeada: ${fnName}`) };
        } catch (err) {
          return { data: null, error: err };
        }
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Provisionamento controlado do Primeiro MASTER / Break-Glass (exclusivo CLI local)
  // ---------------------------------------------------------------------------
  async function bootstrapFirstMaster({
    email,
    fullName,
    recover = false,
    origin = "http://localhost:5173",
  }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(fullName || "").trim();
    if (!cleanEmail || !cleanEmail.includes("@") || cleanName.length < 3) {
      throw new Error("Informe e-mail e nome completo válidos.");
    }

    return runExclusive(async () => {
      let uRes = await db.query("select id, email from auth.users where lower(email) = $1", [
        cleanEmail,
      ]);
      let userId;
      if (uRes.rows.length > 0) {
        userId = uRes.rows[0].id;
        if (recover) {
          await db.query("delete from auth.mfa_factors where user_id = $1", [userId]);
        }
      } else {
        const ins = await db.query(
          "insert into auth.users (email, encrypted_password, full_name) values ($1, null, $2) returning id",
          [cleanEmail, cleanName]
        );
        userId = ins.rows[0].id;
      }

      const fn = recover ? "admin_recover_master" : "admin_bootstrap_first_master";
      const profRes = await db.query(`select row_to_json(public.${fn}($1, $2, $3)) as profile`, [
        userId,
        cleanEmail,
        cleanName,
      ]);

      const actionLink = await issueOneTimeActionLink({
        userId,
        tokenType: recover ? "recovery" : "invite",
        origin,
        hoursValid: 24,
      });

      return {
        profile: profRes.rows[0].profile,
        actionLink,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Roteador HTTP `/api/v9/*` (usado tanto no Vite Dev Server quanto em standalone)
  // ---------------------------------------------------------------------------
  async function handleApiRequest(req, res) {
    const sendJson = (status, obj) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(obj));
    };

    const readBody = () =>
      new Promise((resolve, reject) => {
        if (req.readableEnded) return resolve({});
        const chunks = [];
        let total = 0;
        req.on("data", (chunk) => {
          total += chunk.length;
          if (total > 15 * 1024 * 1024) {
            reject(new Error("Payload excede o limite permitido."));
            req.destroy?.();
            return;
          }
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("end", () => {
          if (chunks.length === 0) return resolve({});
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("JSON inválido."));
          }
        });
        req.on("error", reject);
      });

    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = urlObj.pathname;
    const clientIp = req.socket?.remoteAddress || "local";
    const origin = req.headers.origin || `${urlObj.protocol}//${urlObj.host}`;

    try {
      // Consome o stream HTTP imediatamente antes de awaits de banco para nunca perder o evento 'end'
      const parsedBody = req.method === "POST" ? await readBody() : {};
      const getBody = async () => parsedBody;
      // Saúde do serviço (sem expor segredos ou contagens internas)
      if (pathname === "/api/v9/health" && req.method === "GET") {
        const masterCheck = await runExclusive(() =>
          db.query(
            "select exists(select 1 from public.erp_profiles where role='MASTER' and status in ('PENDING','ACTIVE')) as has_master"
          )
        );
        return sendJson(200, {
          ok: true,
          mode: "local_postgres",
          masterProvisioned: Boolean(masterCheck.rows[0]?.has_master),
        });
      }

      // Endpoint interno de bootstrap — restrito a loopback + segredo de arquivo local `.data/admin.secret`
      if (pathname === "/api/v9/internal/bootstrap" && req.method === "POST") {
        const isLoopback =
          clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1";
        const providedSecret = String(req.headers["x-admin-bootstrap-secret"] || "");
        const secretValid =
          providedSecret.length === bootstrapSecret.length &&
          crypto.timingSafeEqual(
            Buffer.from(providedSecret, "utf8"),
            Buffer.from(bootstrapSecret, "utf8")
          );
        if (!isLoopback || !secretValid) {
          return sendJson(403, { ok: false, error: "FORBIDDEN" });
        }
        const body = await getBody();
        const out = await bootstrapFirstMaster({
          email: body.email,
          fullName: body.fullName,
          recover: Boolean(body.recover),
          origin: body.origin || origin,
        });
        return sendJson(200, { ok: true, ...out });
      }

      // 1. Login por e-mail e senha (scrypt)
      if (pathname === "/api/v9/auth/login" && req.method === "POST") {
        const body = await getBody();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!checkServerRateLimit(`login:${clientIp}:${email}`, 10, 10 * 60 * 1000)) {
          return sendJson(429, {
            ok: false,
            error: "RATE_LIMITED",
            message: "Muitas tentativas de autenticação. Aguarde alguns minutos.",
          });
        }

        const sessionOut = await runExclusive(async () => {
          const uRes = await db.query(
            "select id, email, encrypted_password, full_name, banned_until from auth.users where lower(email) = $1",
            [email]
          );
          const user = uRes.rows[0];
          if (!user || !user.encrypted_password) return null;
          if (user.banned_until && new Date(user.banned_until) > new Date()) return null;
          if (!verifyPasswordScrypt(password, user.encrypted_password)) return null;
          return createSessionAndToken(user, { aal: "aal1", method: "password" });
        });

        if (!sessionOut) {
          return sendJson(401, {
            ok: false,
            error: "INVALID_CREDENTIALS",
            message: "Invalid login credentials",
          });
        }
        return sendJson(200, { ok: true, session: sessionOut });
      }

      // 2. Consumo de token único de convite ou recuperação (?type=invite|recovery&token=...)
      if (pathname === "/api/v9/auth/consume-token" && req.method === "POST") {
        if (!checkServerRateLimit(`token:${clientIp}`, 20, 10 * 60 * 1000)) {
          return sendJson(429, { ok: false, error: "RATE_LIMITED" });
        }
        const body = await getBody();
        const rawToken = String(body.token || "").trim();
        if (!rawToken) return sendJson(400, { ok: false, error: "INVALID_TOKEN" });

        const tokenHash = hashOneTimeToken(rawToken);
        const consumed = await runExclusive(async () => {
          const r = await db.query(
            `update auth.one_time_tokens
                set used_at = now()
              where token_hash = $1
                and used_at is null
                and expires_at > now()
          returning user_id, token_type`,
            [tokenHash]
          );
          if (r.rows.length === 0) return null;
          const { user_id: userId, token_type: tokenType } = r.rows[0];
          const uRes = await db.query(
            "select id, email, full_name, banned_until from auth.users where id = $1",
            [userId]
          );
          const user = uRes.rows[0];
          if (!user || (user.banned_until && new Date(user.banned_until) > new Date())) {
            return null;
          }
          const session = await createSessionAndToken(user, { aal: "aal1", method: tokenType });
          return { session, tokenType };
        });

        if (!consumed) {
          return sendJson(401, {
            ok: false,
            error: "TOKEN_INVALID_OR_EXPIRED",
            message: "Este link de acesso já foi utilizado ou expirou. Solicite um novo ao administrador.",
          });
        }
        return sendJson(200, { ok: true, ...consumed });
      }

      // 3. Solicitação pública de recuperação de senha (resposta sempre neutra contra enumeração)
      if (pathname === "/api/v9/auth/recover" && req.method === "POST") {
        checkServerRateLimit(`recover:${clientIp}`, 8, 10 * 60 * 1000);
        await getBody();
        return sendJson(200, { ok: true });
      }

      // A partir daqui todas as rotas exigem Bearer JWT ativo e não revogado
      const authCtx = await authenticateBearer(req.headers.authorization);
      if (!authCtx) {
        return sendJson(401, { ok: false, error: "UNAUTHENTICATED" });
      }

      if (pathname === "/api/v9/auth/session" && req.method === "GET") {
        return sendJson(200, {
          ok: true,
          user: {
            id: authCtx.user.id,
            email: authCtx.user.email,
            user_metadata: { full_name: authCtx.user.full_name },
          },
          aal: authCtx.claims.aal,
        });
      }

      if (pathname === "/api/v9/auth/logout" && req.method === "POST") {
        await runExclusive(() =>
          db.query("delete from auth.sessions where id = $1", [authCtx.claims.session_id])
        );
        return sendJson(200, { ok: true });
      }

      // Atualização de senha pelo próprio usuário autenticado (ativação, recuperação ou troca forçada)
      if (pathname === "/api/v9/auth/update-user" && req.method === "POST") {
        const body = await getBody();
        const newPassword = String(body.password || "");
        const policy = evaluatePassword(newPassword, {
          email: authCtx.user.email,
          fullName: authCtx.user.full_name,
        });
        if (!policy.valid) {
          return sendJson(400, {
            ok: false,
            error: "WEAK_PASSWORD",
            message: "A senha não atende aos requisitos mínimos da política corporativa.",
          });
        }

        const samePassword = await runExclusive(async () => {
          const cur = await db.query(
            "select encrypted_password from auth.users where id = $1",
            [authCtx.user.id]
          );
          const existingHash = cur.rows[0]?.encrypted_password;
          if (existingHash && verifyPasswordScrypt(newPassword, existingHash)) {
            return true;
          }
          const nextHash = hashPasswordScrypt(newPassword);
          await db.query("update auth.users set encrypted_password = $2 where id = $1", [
            authCtx.user.id,
            nextHash,
          ]);
          return false;
        });

        if (samePassword) {
          return sendJson(400, {
            ok: false,
            error: "SAME_PASSWORD",
            message: "A nova senha deve ser diferente da senha atual.",
          });
        }
        return sendJson(200, { ok: true, user: authCtx.user });
      }

      // MFA TOTP: listagem, enrolamento, desafio, verificação (eleva sessão para aal2) e remoção
      if (pathname === "/api/v9/auth/mfa/factors" && req.method === "GET") {
        const rows = await runExclusive(() =>
          db.query(
            "select id, factor_type, friendly_name, status, created_at from auth.mfa_factors where user_id = $1 order by created_at",
            [authCtx.user.id]
          )
        );
        const all = rows.rows;
        return sendJson(200, {
          ok: true,
          all,
          totp: all.filter((f) => f.factor_type === "totp"),
        });
      }

      if (pathname === "/api/v9/auth/mfa/enroll" && req.method === "POST") {
        const body = await getBody();
        const secret = generateTotpSecret();
        const uri = buildOtpAuthUri({ secret, email: authCtx.user.email });
        const ins = await runExclusive(() =>
          db.query(
            `insert into auth.mfa_factors (user_id, factor_type, friendly_name, secret, status)
             values ($1, 'totp', $2, $3, 'unverified') returning id`,
            [authCtx.user.id, body.friendlyName || "União Workforce ERP", secret]
          )
        );
        return sendJson(200, {
          ok: true,
          id: ins.rows[0].id,
          type: "totp",
          totp: { secret, uri, qr_code: "" },
        });
      }

      if (pathname === "/api/v9/auth/mfa/unenroll" && req.method === "POST") {
        const body = await getBody();
        await runExclusive(() =>
          db.query(
            "delete from auth.mfa_factors where id = $1 and user_id = $2 and status = 'unverified'",
            [body.factorId, authCtx.user.id]
          )
        );
        return sendJson(200, { ok: true });
      }

      if (pathname === "/api/v9/auth/mfa/verify" && req.method === "POST") {
        if (!checkServerRateLimit(`mfa:${authCtx.user.id}`, 10, 5 * 60 * 1000)) {
          return sendJson(429, { ok: false, error: "RATE_LIMITED" });
        }
        const body = await getBody();
        const factorId = String(body.factorId || "");
        const code = String(body.code || "");

        const verifiedSession = await runExclusive(async () => {
          const fRes = await db.query(
            "select id, secret, status from auth.mfa_factors where id = $1 and user_id = $2",
            [factorId, authCtx.user.id]
          );
          const factor = fRes.rows[0];
          if (!factor) return null;
          if (!verifyTotpCode(factor.secret, code)) return null;

          if (factor.status !== "verified") {
            await db.query("update auth.mfa_factors set status = 'verified' where id = $1", [
              factor.id,
            ]);
          }

          const nowSec = Math.floor(Date.now() / 1000);
          const nextAmr = [
            ...(Array.isArray(authCtx.claims.amr)
              ? authCtx.claims.amr.filter((a) => a.method !== "totp")
              : []),
            { method: "totp", timestamp: nowSec },
          ];

          await db.query(
            "update auth.sessions set aal = 'aal2', amr = $2::jsonb where id = $1",
            [authCtx.claims.session_id, JSON.stringify(nextAmr)]
          );

          const upgradedToken = signJwtHs256(
            {
              sub: authCtx.user.id,
              email: authCtx.user.email,
              role: "authenticated",
              session_id: authCtx.claims.session_id,
              aal: "aal2",
              amr: nextAmr,
            },
            jwtSecret,
            3600
          );

          return {
            access_token: upgradedToken,
            token_type: "bearer",
            expires_in: 3600,
            user: {
              id: authCtx.user.id,
              email: authCtx.user.email,
              user_metadata: { full_name: authCtx.user.full_name },
            },
          };
        });

        if (!verifiedSession) {
          return sendJson(400, { ok: false, error: "INVALID_TOTP", message: "Código MFA inválido." });
        }
        return sendJson(200, { ok: true, session: verifiedSession });
      }

      // Leitura de tabelas filtrada por RLS real do PostgreSQL (`authenticated`)
      if (pathname === "/api/v9/data/select" && req.method === "POST") {
        const body = await getBody();
        const table = String(body.table || "");
        if (!ALLOWED_SELECT_TABLES.has(table)) {
          return sendJson(400, { ok: false, error: "TABLE_NOT_ALLOWED" });
        }

        const params = [];
        const whereClauses = [];
        for (const f of body.filters || []) {
          if (!/^[a-z_][a-z0-9_]*$/.test(String(f.column || ""))) continue;
          params.push(f.value);
          const idx = params.length;
          if (f.op === "eq") whereClauses.push(`${f.column} = $${idx}`);
          else if (f.op === "ilike") whereClauses.push(`${f.column} ilike $${idx}`);
          else if (f.op === "gte") whereClauses.push(`${f.column} >= $${idx}`);
          else if (f.op === "lte") whereClauses.push(`${f.column} <= $${idx}`);
        }

        let sql = `select * from public.${table}`;
        if (whereClauses.length > 0) {
          sql += ` where ${whereClauses.join(" and ")}`;
        }
        if (body.order?.column && /^[a-z_][a-z0-9_]*$/.test(body.order.column)) {
          sql += ` order by ${body.order.column} ${body.order.ascending ? "asc" : "desc"}`;
        }
        if (body.limit) {
          sql += ` limit ${Math.min(1000, Math.max(1, Number(body.limit) || 250))}`;
        }

        const rows = await withAuthenticatedRls(authCtx.claims, async () => {
          const r = await db.query(sql, params);
          return r.rows;
        });
        return sendJson(200, { ok: true, data: rows });
      }

      // Execução de RPCs sob o papel `authenticated`
      if (pathname.startsWith("/api/v9/rpc/") && req.method === "POST") {
        const fnName = pathname.slice("/api/v9/rpc/".length);
        if (!ALLOWED_PUBLIC_RPCS.has(fnName)) {
          return sendJson(403, { ok: false, error: "RPC_NOT_ALLOWED" });
        }
        const args = await getBody();

        const data = await withAuthenticatedRls(authCtx.claims, async () => {
          if (fnName === "my_profile" || fnName === "complete_activation" || fnName === "complete_password_change") {
            const r = await db.query(`select public.${fnName}() as res`);
            return r.rows[0]?.res ?? null;
          }
          if (fnName === "admin_list_users" || fnName === "erp_list_backups") {
            const r = await db.query(`select * from public.${fnName}()`);
            return r.rows;
          }
          if (fnName === "record_auth_event") {
            await db.query("select public.record_auth_event($1)", [args.p_event]);
            return null;
          }
          if (fnName === "erp_save_batch") {
            const r = await db.query("select public.erp_save_batch($1::jsonb, $2::jsonb) as res", [
              JSON.stringify(args.p_writes || []),
              JSON.stringify(args.p_audit || []),
            ]);
            return r.rows[0]?.res;
          }
          if (fnName === "erp_set_setting") {
            const r = await db.query("select public.erp_set_setting($1, $2::jsonb) as res", [
              args.p_key,
              JSON.stringify(args.p_value ?? {}),
            ]);
            return r.rows[0]?.res;
          }
          if (fnName === "erp_create_backup") {
            const r = await db.query("select public.erp_create_backup($1, $2) as res", [
              args.p_label || "Backup manual",
              args.p_kind || "MANUAL",
            ]);
            return r.rows[0]?.res;
          }
          if (fnName === "erp_get_backup") {
            const r = await db.query("select public.erp_get_backup($1::uuid) as res", [args.p_id]);
            return r.rows[0]?.res;
          }
          if (fnName === "erp_restore_backup") {
            const r = await db.query("select public.erp_restore_backup($1::uuid, $2) as res", [
              args.p_id,
              args.p_confirmation,
            ]);
            return r.rows[0]?.res;
          }
          return null;
        });

        return sendJson(200, { ok: true, data });
      }

      // Edge Function `admin-users` executada com o mesmo handler validado
      if (pathname === "/api/v9/functions/admin-users" && req.method === "POST") {
        const body = await getBody();
        const result = await runExclusive(() =>
          handleAdminUsersRequest({
            serviceClient: buildInternalServiceClient(origin),
            bearerToken: authCtx.token,
            body,
            redirectTo: origin,
          })
        );
        return sendJson(result.status, result.payload);
      }

      return sendJson(404, { ok: false, error: "NOT_FOUND" });
    } catch (err) {
      return sendJson(400, {
        ok: false,
        error: "REQUEST_FAILED",
        message: String(err?.message || err),
      });
    }
  }

  return {
    db,
    jwtSecret,
    bootstrapSecret,
    bootstrapFirstMaster,
    handleApiRequest,
    close: () => db.close(),
  };
}
