// =============================================================================
// TESTE DE INTEGRAÇÃO FIM-A-FIM (ROTEADOR HTTP + POSTGRESQL PGLITE + SCRYPT + JWT + TOTP)
// Valida todo o ciclo real do servidor `/api/v9` integrado ao `npm run dev`.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createErpBackend } from "../../server/erpBackend.mjs";
import { generateCurrentTotpCode } from "../../server/totp.mjs";
import { createLocalErpClient } from "../services/localApiClient.js";
import { ErpRepository } from "../services/erpRepository.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.get(k) ?? null; },
    setItem(k, v) { map.set(k, v); },
    removeItem(k) { map.delete(k); },
  };
}

/**
 * Executa requisições HTTP diretamente sobre `backend.handleApiRequest(req, res)` em memória,
 * validando cabeçalhos, códigos HTTP, serialização JSON, JWT, scrypt, TOTP e RLS sem abrir porta TCP.
 */
function createInProcessFetch(backend) {
  return async function inProcessFetch(urlStr, opts = {}) {
    const u = new URL(urlStr, "http://localhost:5173");
    const chunks = opts.body !== undefined ? [Buffer.from(String(opts.body), "utf8")] : [];
    const req = Readable.from(chunks);
    req.url = `${u.pathname}${u.search}`;
    req.method = opts.method || "GET";
    req.socket = { remoteAddress: "127.0.0.1" };
    req.headers = { host: u.host, origin: u.origin };
    for (const [k, v] of Object.entries(opts.headers || {})) {
      req.headers[k.toLowerCase()] = v;
    }

    const resHeaders = new Map();
    let statusCode = 200;
    let responseBody = "";

    await new Promise((resolve) => {
      const res = {
        get statusCode() { return statusCode; },
        set statusCode(v) { statusCode = v; },
        setHeader(k, v) { resHeaders.set(k.toLowerCase(), String(v)); },
        end(chunk = "") {
          responseBody = String(chunk);
          resolve();
        },
      };
      backend.handleApiRequest(req, res);
    });
    return {
      status: statusCode,
      ok: statusCode >= 200 && statusCode < 300,
      headers: {
        get(k) { return resHeaders.get(String(k).toLowerCase()) || null; },
      },
      async json() {
        return JSON.parse(responseBody);
      },
    };
  };
}

test("E2E-01: Ciclo completo HTTP + PostgreSQL RLS + scrypt + convite único + TOTP MFA + revogação", async () => {
  const backend = await createErpBackend({
    inMemory: true,
    autoMigrateBackupFile: "",
  });

  await backend.db.query(
    `insert into public.erp_partitions (scope, kind, period, data) values
      ('GLOBAL','structure','','{"units":[{"id":"LOJA_03","code":"LJ03","name":"LOJA 03"},{"id":"LOJA_01","code":"LJ01","name":"LOJA 01"}]}'::jsonb),
      ('LOJA_03','employees','','{"employees":[{"id":"E_FIC_03","fullName":"FICTICIO LOJA 03","homeUnitId":"LOJA_03"}],"allocations":[]}'::jsonb),
      ('LOJA_01','employees','','{"employees":[{"id":"E_FIC_01","fullName":"FICTICIO LOJA 01","homeUnitId":"LOJA_01"}],"allocations":[]}'::jsonb)`
  );

  const fetchImpl = createInProcessFetch(backend);
  const baseUrl = "http://localhost:5173/api/v9";

  try {
    // 1. Visitante não autenticado recebe 401 ao tentar ler partições diretamente via HTTP
    const anonRes = await fetchImpl(`${baseUrl}/data/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "erp_partitions" }),
    });
    assert.equal(anonRes.status, 401);

    // 2. Provisiona o primeiro MASTER e comprova bloqueio de segundo bootstrap
    const boot = await backend.bootstrapFirstMaster({
      email: "master.e2e@exemplo.invalid",
      fullName: "Master E2E",
      origin: "http://localhost:5173",
    });
    assert.equal(boot.profile.role, "MASTER");
    assert.equal(boot.profile.status, "PENDING");
    const rawMasterInviteToken = new URL(boot.actionLink).searchParams.get("token");
    assert.ok(rawMasterInviteToken.length > 20);

    await assert.rejects(
      () =>
        backend.bootstrapFirstMaster({
          email: "outro@exemplo.invalid",
          fullName: "Outro",
        }),
      /MASTER_ALREADY_PROVISIONED/
    );

    // 3. Consome o convite do MASTER uma vez (OK) e comprova que o reuso é bloqueado (401)
    const consume1 = await fetchImpl(`${baseUrl}/auth/consume-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawMasterInviteToken }),
    });
    assert.equal(consume1.status, 200);
    const consume1Json = await consume1.json();

    const consumeReplay = await fetchImpl(`${baseUrl}/auth/consume-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawMasterInviteToken }),
    });
    assert.equal(consumeReplay.status, 401, "Convite de uso único jamais pode ser reutilizado");

    // 4. Configura cliente MASTER com a sessão do convite, define senha scrypt e ativa a conta
    const masterStorage = createMemoryStorage();
    masterStorage.setItem("uniao_erp_v9_local_session", JSON.stringify(consume1Json.session));
    const masterClient = createLocalErpClient({ baseUrl, storage: masterStorage, fetchImpl });

    // Enquanto PENDING, RLS retorna zero partições
    const pendingParts = await masterClient.from("erp_partitions").select("*");
    assert.deepEqual(pendingParts.data, []);

    // Senha contendo parte do e-mail/nome ("Master") é rejeitada pelo backend
    const weakAttempt = await masterClient.auth.updateUser({ password: "Master#Uniao94!Xz72" });
    assert.ok(weakAttempt.error, "Política de senha no backend bloqueia termos pessoais/corporativos");

    const strongMasterPwd = "Governanca#79!Xz52";
    const updRes = await masterClient.auth.updateUser({ password: strongMasterPwd });
    assert.equal(updRes.error, null);

    // Verifica no PostgreSQL que a senha foi gravada como hash scrypt (nunca texto puro!)
    const dbHashRow = await backend.db.query(
      "select encrypted_password from auth.users where email = 'master.e2e@exemplo.invalid'"
    );
    assert.ok(dbHashRow.rows[0].encrypted_password.startsWith("scrypt$"));
    assert.equal(dbHashRow.rows[0].encrypted_password.includes(strongMasterPwd), false);

    const actProf = await masterClient.rpc("complete_activation");
    assert.equal(actProf.data.status, "ACTIVE");

    // 5. Mesmo ACTIVE, MASTER em aal1 ainda não lê partições nem gerencia usuários até verificar TOTP MFA
    assert.deepEqual((await masterClient.from("erp_partitions").select("*")).data, []);

    const enrolled = await masterClient.auth.mfa.enroll({ factorType: "totp" });
    assert.ok(enrolled.data.totp.secret);
    const validTotp = generateCurrentTotpCode(enrolled.data.totp.secret);
    const mfaVer = await masterClient.auth.mfa.verify({
      factorId: enrolled.data.id,
      code: validTotp,
    });
    assert.equal(mfaVer.error, null);

    // Agora em aal2, MASTER enxerga todas as partições e provisiona um OPERATOR restrito à LOJA_03
    const allParts = await masterClient.from("erp_partitions").select("*");
    assert.equal(allParts.data.length, 3);

    const inviteOp = await masterClient.functions.invoke("admin-users", {
      body: {
        action: "invite",
        email: "op.loja03@exemplo.invalid",
        fullName: "Operador Filial 03",
        role: "OPERATOR",
        authorizedUnits: ["LOJA_03"],
        deliveryMode: "invite_link",
      },
    });
    assert.equal(inviteOp.error, null);
    const opToken = new URL(inviteOp.data.oneTimeInviteLink).searchParams.get("token");

    // 6. Operador ativa sua conta, faz login por senha e recebe SOMENTE GLOBAL + LOJA_03 via RLS
    const opConsume = await (
      await fetchImpl(`${baseUrl}/auth/consume-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: opToken }),
      })
    ).json();

    const opStorage = createMemoryStorage();
    opStorage.setItem("uniao_erp_v9_local_session", JSON.stringify(opConsume.session));
    const opClient = createLocalErpClient({ baseUrl, storage: opStorage, fetchImpl });

    const opPwd = "VarejoForte#84!Qw91";
    assert.equal((await opClient.auth.updateUser({ password: opPwd })).error, null);
    await opClient.rpc("complete_activation");
    await opClient.auth.signOut();

    // Login normal por e-mail e senha
    const loginRes = await opClient.auth.signInWithPassword({
      email: "op.loja03@exemplo.invalid",
      password: opPwd,
    });
    assert.equal(loginRes.error, null);

    const loaded = await ErpRepository.loadAuthorizedDatabase(opClient);
    assert.equal(loaded.db.employees.length, 1);
    assert.equal(loaded.db.employees[0].id, "E_FIC_03", "RLS isolou LOJA_01 completamente");

    // Grava alteração legítima na LOJA_03 via RPC erp_save_batch
    const nextDb = structuredClone(loaded.db);
    nextDb.employees[0].notes = "Observação gravada via RPC";
    const saved = await ErpRepository.saveMutation({
      client: opClient,
      prevPartitionsMap: loaded.partitionsMap,
      nextDb,
      revisionsByKey: loaded.revisionsByKey,
      auditPayload: {
        module: "COLABORADORES",
        action: "ATUALIZAR_COLABORADOR",
        entityType: "EMPLOYEE",
        entityId: "E_FIC_03",
        unitId: "LOJA_03",
        summary: "Atualização E2E",
      },
    });
    assert.equal(saved.ok, true);

    // 7. MASTER revoga sessões do operador -> token do operador perde efeito imediatamente
    await masterClient.functions.invoke("admin-users", {
      body: { action: "revoke_sessions", userId: inviteOp.data.profile.id },
    });
    const afterRevoke = await opClient.auth.getSession();
    assert.equal(afterRevoke.data.session, null, "Sessão revogada invalidada imediatamente");
  } finally {
    await backend.close();
  }
});

test("E2E-02: Migração automática do backup operacional em 19 partições + proteção do endpoint interno de bootstrap", async () => {
  const backend = await createErpBackend({
    inMemory: true,
  });
  const fetchImpl = createInProcessFetch(backend);
  const baseUrl = "http://localhost:5173/api/v9";

  try {
    // Confirma que as 19 partições do backup pré-v8 foram importadas no PostgreSQL
    const countRes = await backend.db.query("select count(*)::int as c from public.erp_partitions");
    assert.equal(countRes.rows[0].c, 19);

    // Endpoint interno /api/v9/internal/bootstrap nega acesso sem o segredo administrativo local
    const forbidden = await fetchImpl(`${baseUrl}/internal/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-bootstrap-secret": "segredo-errado" },
      body: JSON.stringify({ email: "invasor@exemplo.invalid", fullName: "Invasor" }),
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await backend.close();
  }
});
