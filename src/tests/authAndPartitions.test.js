// =============================================================================
// SUÍTE DE SEGURANÇA DE AUTENTICAÇÃO, PARTIÇÕES, EDGE FUNCTION E SENHAS (v9.0)
// Utiliza exclusivamente dados fictícios.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluatePassword } from "../domain/passwordPolicy.js";
import {
  splitDatabaseIntoPartitions,
  assembleDatabaseFromPartitions,
  diffChangedPartitions,
  verifyPartitionRoundtrip,
} from "../services/partitionCodec.js";
import {
  ROLE_HIERARCHY,
  PERMISSIONS_BY_ROLE,
  computeEffectivePermissions,
  assertPermission,
  assertUnitAccess,
  canSimulateRbacRole,
  resolveAuthenticatedOperatorSession,
  registerOperatorAccount,
  authenticateOperatorWithPassword,
  ErpRepository,
} from "../services/erpRepository.js";
import {
  signInOperator,
  resolveAuthGateState,
  GENERIC_LOGIN_ERROR_MESSAGE,
  clearFailedLoginAttempts,
} from "../services/authService.js";
import {
  handleAdminUsersRequest,
  generateCryptographicTempPassword,
} from "../../supabase/functions/admin-users/handler.mjs";
import { buildFictitiousErpDatabase } from "../../scripts/tutorial-generator/security/fictitiousSeed.js";

function makeFakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

test("SEC-01: Política de senhas impõe >= 8 caracteres, classes, bloqueio de dados pessoais e senhas comuns", () => {
  const ctx = { email: "marcos.silva@exemplo.invalid", fullName: "Marcos Silva" };

  assert.equal(evaluatePassword("Curta@123", ctx).valid, false, "< 8 caracteres");
  assert.equal(evaluatePassword("uniao@2026!!", ctx).valid, false, "sem maiúscula + lista comum");
  assert.equal(evaluatePassword("Uniao@2026!!", ctx).valid, false, "variação institucional óbvia");
  assert.equal(evaluatePassword("Senh@1234567", ctx).valid, false, "leet de senha comum");
  assert.equal(evaluatePassword("Marcos@948271", ctx).valid, false, "contém nome do operador");
  assert.equal(evaluatePassword("Abcdef!92837", ctx).valid, false, "contém sequência alfabética trivial");
  assert.equal(evaluatePassword("AAAAbc!92837", ctx).valid, false, "contém repetição 4x");

  const strong = evaluatePassword("Tr0v@o#M4rfim92!Qp", ctx);
  assert.equal(strong.valid, true, "senha aleatória forte de 18 caracteres deve ser aprovada");
  assert.equal(strong.score, 5);
});

test("SEC-02: Cadastro público e fallback local de senha estão permanentemente bloqueados", async () => {
  await assert.rejects(
    () =>
      registerOperatorAccount({
        email: "invasor@exemplo.invalid",
        password: "qualquer",
        roleProfile: "ADMIN",
      }),
    /PUBLIC_SIGNUP_DISABLED/
  );

  await assert.rejects(
    () =>
      authenticateOperatorWithPassword({
        email: "invasor@exemplo.invalid",
        password: "qualquer",
      }),
    /LOCAL_AUTH_REMOVED/
  );
});

test("SEC-03: Hierarquia RBAC aplica menor privilégio e impede escalonamento ou acesso default a todas as lojas", () => {
  assert.deepEqual(ROLE_HIERARCHY, ["MASTER", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]);

  // ADMIN não detém governança de contas, backups ou configurações críticas
  for (const gov of ["MANAGE_USERS", "MANAGE_ACCESS", "MANAGE_BACKUP", "MANAGE_SYSTEM_SETTINGS"]) {
    assert.ok(PERMISSIONS_BY_ROLE.MASTER.includes(gov));
    assert.ok(!PERMISSIONS_BY_ROLE.ADMIN.includes(gov));
    assert.throws(() => assertPermission("ADMIN", gov), /Acesso negado/);
  }

  // Elevação individual de permissão de governança em perfil não-MASTER é ignorada
  const effOp = computeEffectivePermissions("OPERATOR", ["MANAGE_USERS", "MANAGE_MARKET_CALENDAR"], ["EDIT_SCHEDULE"]);
  assert.ok(!effOp.includes("MANAGE_USERS"), "governança nunca é concedida a OPERATOR");
  assert.ok(effOp.includes("MANAGE_MARKET_CALENDAR"));
  assert.ok(!effOp.includes("EDIT_SCHEDULE"));

  // Isolamento por unidade vale também para ADMIN; lista vazia NUNCA libera todas as unidades
  assert.throws(
    () => assertUnitAccess({ email: "adm@x.invalid", role: "ADMIN", authorizedUnits: ["LOJA_03"] }, "LOJA_01"),
    /Acesso negado à unidade/
  );
  assert.throws(
    () => assertUnitAccess({ email: "op@x.invalid", role: "OPERATOR", authorizedUnits: [] }, "LOJA_03"),
    /Acesso negado à unidade/
  );
  assert.equal(assertUnitAccess({ email: "m@x.invalid", role: "MASTER", authorizedUnits: [] }, "LOJA_01"), true);

  // Pré-visualização de perfil restrita a MASTER
  assert.equal(canSimulateRbacRole({ role: "ADMIN" }), false);
  assert.equal(canSimulateRbacRole({ role: "MASTER" }), true);

  // resolveAuthenticatedOperatorSession exige conta provisionada, ignora requestedRole e recusa origem local
  const profiles = [
    {
      id: "u1",
      email: "consulta@exemplo.invalid",
      fullName: "Consulta Fictícia",
      role: "VIEWER",
      authorizedUnits: ["LOJA_03"],
      status: "ACTIVE",
    },
  ];
  const resolved = resolveAuthenticatedOperatorSession({
    email: "consulta@exemplo.invalid",
    requestedRole: "MASTER",
    userProfiles: profiles,
    authVerificationStatus: "VERIFIED_SUPABASE_AUTH",
  });
  assert.equal(resolved.role, "VIEWER");
  assert.deepEqual(resolved.authorizedUnits, ["LOJA_03"]);

  assert.throws(
    () =>
      resolveAuthenticatedOperatorSession({
        email: "nao.cadastrado@exemplo.invalid",
        userProfiles: profiles,
        authVerificationStatus: "VERIFIED_SUPABASE_AUTH",
      }),
    /não provisionada/
  );
  assert.throws(
    () =>
      resolveAuthenticatedOperatorSession({
        email: "consulta@exemplo.invalid",
        userProfiles: profiles,
        authVerificationStatus: "VERIFIED_LOCAL_AUTH",
      }),
    /autenticação criptográfica/
  );
});

test("SEC-04: Indisponibilidade do serviço de autenticação nega acesso (fail-closed) e login usa erro genérico + rate limit", async () => {
  // 1. Sem cliente configurado -> fail-closed
  const noClient = await signInOperator({ email: "a@b.invalid", password: "x" }, null);
  assert.equal(noClient.ok, false);
  assert.equal(noClient.serviceUnavailable, true);

  // 2. Com falha de rede ("Failed to fetch") -> fail-closed, sem fallback local
  const offlineClient = {
    auth: {
      async signInWithPassword() {
        throw new Error("TypeError: Failed to fetch");
      },
    },
  };
  const netFail = await signInOperator({ email: "op@b.invalid", password: "x" }, offlineClient);
  assert.equal(netFail.ok, false);
  assert.equal(netFail.serviceUnavailable, true);

  // 3. Mensagens idênticas para conta inexistente vs senha incorreta + bloqueio por tentativas
  const targetEmail = "alvo.bruteforce@exemplo.invalid";
  clearFailedLoginAttempts(targetEmail);
  const wrongClient = {
    auth: {
      async signInWithPassword({ email }) {
        return {
          data: null,
          error: new Error(email.includes("inexistente") ? "User not found" : "Invalid login credentials"),
        };
      },
    },
  };
  const r1 = await signInOperator({ email: "inexistente@exemplo.invalid", password: "x" }, wrongClient);
  const r2 = await signInOperator({ email: targetEmail, password: "x" }, wrongClient);
  assert.equal(r1.message, GENERIC_LOGIN_ERROR_MESSAGE);
  assert.equal(r2.message, GENERIC_LOGIN_ERROR_MESSAGE);

  for (let i = 0; i < 4; i++) {
    await signInOperator({ email: targetEmail, password: "x" }, wrongClient);
  }
  const locked = await signInOperator({ email: targetEmail, password: "x" }, wrongClient);
  assert.equal(locked.ok, false);
  assert.equal(locked.rateLimited, true);
  clearFailedLoginAttempts(targetEmail);
});

test("SEC-05: resolveAuthGateState bloqueia sessão revogada, conta desativada, conta pendente e MASTER sem MFA", async () => {
  const mkClient = (profileReturn) => ({
    auth: {
      async getSession() {
        return { data: { session: { user: { id: "u-1" } } }, error: null };
      },
      async signOut() { },
    },
    async rpc(fn) {
      if (fn === "my_profile") return { data: profileReturn, error: null };
      return { data: null, error: null };
    },
  });

  // Sessão revogada no banco (my_profile retorna null)
  assert.equal((await resolveAuthGateState(mkClient(null))).gate, "session_expired");

  // Conta desativada
  const deact = await resolveAuthGateState(mkClient({ id: "u-1", status: "DEACTIVATED", role: "OPERATOR" }));
  assert.equal(deact.gate, "account_blocked");
  assert.equal(deact.blockVariant, "deactivated");

  // Conta pendente (convite ainda sem senha definitiva)
  assert.equal(
    (await resolveAuthGateState(mkClient({ id: "u-1", status: "PENDING", role: "OPERATOR" }))).gate,
    "set_password_invite"
  );

  // Senha temporária / redefinida pelo MASTER
  assert.equal(
    (await resolveAuthGateState(mkClient({ id: "u-1", status: "ACTIVE", mustChangePassword: true, role: "OPERATOR" }))).gate,
    "set_password_forced"
  );

  // MASTER ativo em aal1 sem fator MFA cadastrado -> obrigado a cadastrar MFA
  assert.equal(
    (
      await resolveAuthGateState(
        mkClient({ id: "m-1", status: "ACTIVE", role: "MASTER", mfaRequired: true, mfaEnrolled: false, aal: "aal1" })
      )
    ).gate,
    "mfa_enroll_required"
  );

  // MASTER ativo em aal1 com fator já cadastrado -> obrigado a verificar TOTP
  assert.equal(
    (
      await resolveAuthGateState(
        mkClient({ id: "m-1", status: "ACTIVE", role: "MASTER", mfaRequired: true, mfaEnrolled: true, aal: "aal1" })
      )
    ).gate,
    "mfa_verify_required"
  );

  // MASTER ativo em aal2 -> liberado
  assert.equal(
    (
      await resolveAuthGateState(
        mkClient({ id: "m-1", status: "ACTIVE", role: "MASTER", mfaRequired: true, mfaEnrolled: true, aal: "aal2" })
      )
    ).gate,
    "authenticated"
  );
});

test("SEC-06: Edge Function admin-users exige MASTER em aal2 e provisiona convites/senhas temporárias CSPRNG de uso único", async () => {
  const tempPwd = generateCryptographicTempPassword();
  assert.equal(tempPwd.length, 20);
  assert.equal(evaluatePassword(tempPwd).valid, true, "senha temporária CSPRNG atende à política corporativa");

  let flaggedResetUserId = null;
  let bannedState = null;

  const mockServiceClient = (actorRole = "MASTER", actorStatus = "ACTIVE") => ({
    auth: {
      async getUser(token) {
        if (!token) return { data: null, error: new Error("no token") };
        return { data: { user: { id: "actor-uuid" } }, error: null };
      },
      admin: {
        async inviteUserByEmail(email) {
          return { data: { user: { id: "new-user-uuid", email } }, error: null };
        },
        async createUser({ email }) {
          return { data: { user: { id: "temp-user-uuid", email } }, error: null };
        },
        async updateUserById(id, attrs) {
          bannedState = { id, attrs };
          return { data: { user: { id } }, error: null };
        },
        async deleteUser() { },
      },
    },
    from(table) {
      assert.equal(table, "erp_profiles");
      return {
        select() {
          return {
            eq(_col, val) {
              return {
                async maybeSingle() {
                  if (val === "actor-uuid") {
                    return { data: { id: "actor-uuid", email: "m@x.invalid", role: actorRole, status: actorStatus }, error: null };
                  }
                  return { data: { id: val, email: "alvo@x.invalid", status: "ACTIVE" }, error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc(fn, args) {
      if (fn === "admin_create_profile") {
        return {
          data: {
            id: args.p_user_id,
            email: args.p_email,
            role: args.p_role,
            status: "PENDING",
            authorized_units: args.p_units,
          },
          error: null,
        };
      }
      if (fn === "admin_flag_credential_reset") {
        flaggedResetUserId = args.p_user_id;
        return { data: null, error: null };
      }
      if (fn === "admin_set_status") {
        return { data: { id: args.p_user_id, status: args.p_status }, error: null };
      }
      return { data: null, error: null };
    },
  });

  // 1. Rejeita perfil não-MASTER (ex.: ADMIN ou OPERATOR) mesmo com aal2
  const nonMasterRes = await handleAdminUsersRequest({
    serviceClient: mockServiceClient("OPERATOR"),
    bearerToken: makeFakeJwt({ sub: "actor-uuid", aal: "aal1" }),
    body: { action: "invite", email: "op@x.invalid", fullName: "Operador", role: "OPERATOR", authorizedUnits: ["LOJA_03"] },
  });
  assert.equal(nonMasterRes.status, 403);
  assert.equal(nonMasterRes.payload.error, "FORBIDDEN");

  // 2. Rejeita ADMIN mesmo com aal2
  const adminRes = await handleAdminUsersRequest({
    serviceClient: mockServiceClient("ADMIN"),
    bearerToken: makeFakeJwt({ sub: "actor-uuid", aal: "aal2" }),
    body: { action: "invite", email: "op@x.invalid", fullName: "Operador", role: "OPERATOR", authorizedUnits: ["LOJA_03"] },
  });
  assert.equal(adminRes.status, 403);
  assert.equal(adminRes.payload.error, "FORBIDDEN");

  // 3. Provisiona conta pendente com senha temporária de uso único (sem SMTP)
  const okTemp = await handleAdminUsersRequest({
    serviceClient: mockServiceClient("MASTER"),
    bearerToken: makeFakeJwt({ sub: "actor-uuid", aal: "aal2" }),
    body: {
      action: "invite",
      email: "op@x.invalid",
      fullName: "Operador Fictício",
      role: "OPERATOR",
      authorizedUnits: ["LOJA_03"],
      deliveryMode: "temp_password",
    },
  });
  assert.equal(okTemp.status, 200);
  assert.equal(okTemp.payload.profile.status, "PENDING");
  assert.equal(okTemp.payload.oneTimeTempPassword.length, 20);
  assert.equal(flaggedResetUserId, "temp-user-uuid", "marca troca obrigatória de senha no primeiro acesso");

  // 4. Desativação bloqueia também no GoTrue (ban_duration)
  const deactRes = await handleAdminUsersRequest({
    serviceClient: mockServiceClient("MASTER"),
    bearerToken: makeFakeJwt({ sub: "actor-uuid", aal: "aal2" }),
    body: { action: "set_status", userId: "target-uuid", status: "DEACTIVATED", reason: "Desligamento" },
  });
  assert.equal(deactRes.status, 200);
  assert.equal(bannedState.id, "target-uuid");
  assert.equal(bannedState.attrs.ban_duration, "876000h");
});

test("SEC-07: Codec de partições preserva 100% dos registros fictícios, espelha rateio e isola lojas", async () => {
  const demoDb = buildFictitiousErpDatabase();
  // Adiciona colaborador fictício na LOJA_01 e um colaborador em RATEIO (LOJA_03 + LOJA_01)
  demoDb.employees.push(
    {
      id: "EMP_FIC_LJ01",
      registrationCode: "FIC-901",
      fullName: "COLABORADOR EXCLUSIVO LOJA 01",
      hireDate: "2026-01-10",
      employmentStatus: "ACTIVE",
      homeUnitId: "LOJA_01",
      isSharedRateio: false,
      authorizedUnitIds: ["LOJA_01"],
    },
    {
      id: "EMP_FIC_RATEIO",
      registrationCode: "FIC-902",
      fullName: "SUPERVISOR RATEIO FICTÍCIO",
      hireDate: "2026-01-10",
      employmentStatus: "ACTIVE",
      homeUnitId: "LOJA_03",
      isSharedRateio: true,
      authorizedUnitIds: ["LOJA_03", "LOJA_01"],
    }
  );

  const partitionsMap = splitDatabaseIntoPartitions(demoDb);
  const report = verifyPartitionRoundtrip(demoDb, partitionsMap);
  assert.equal(report.ok, true, "ida-e-volta completa sem perda de nenhum registro");

  // Simula RLS: um operador autorizado apenas para LOJA_01 recebe somente GLOBAL + LOJA_01
  const loja01OnlyRows = Array.from(partitionsMap.values())
    .filter((p) => p.scope === "GLOBAL" || p.scope === "LOJA_01")
    .map((p) => ({ ...p, revision: 1 }));

  const { db: isolatedLoja01 } = assembleDatabaseFromPartitions(loja01OnlyRows);
  assert.ok(
    isolatedLoja01.employees.some((e) => e.id === "EMP_FIC_LJ01"),
    "vê colaborador exclusivo da LOJA_01"
  );
  assert.ok(
    isolatedLoja01.employees.some((e) => e.id === "EMP_FIC_RATEIO"),
    "vê colaborador em rateio compartilhado com a LOJA_01"
  );
  assert.equal(
    isolatedLoja01.employees.some((e) => e.homeUnitId === "LOJA_03" && !e.isSharedRateio),
    false,
    "NÃO recebe nenhum colaborador exclusivo da LOJA_03"
  );
  assert.equal(
    Object.values(isolatedLoja01.dailyEntriesByMonth)
      .flat()
      .some((en) => en.unitId === "LOJA_03"),
    false,
    "NÃO recebe nenhum lançamento de escala da LOJA_03"
  );

  // Verifica que saveMutation envia somente a partição tocada a partir do baseline canônico
  const allRows = Array.from(partitionsMap.values()).map((p) => ({ ...p, revision: 3 }));
  const { db: loadedDb, revisionsByKey } = assembleDatabaseFromPartitions(allRows);
  const baselineMap = splitDatabaseIntoPartitions(loadedDb);
  const mutated = structuredClone(loadedDb);
  mutated.employees.find((e) => e.id === "EMP_FIC_LJ01").notes = "Ajuste pontual";

  const writes = diffChangedPartitions(baselineMap, splitDatabaseIntoPartitions(mutated), revisionsByKey);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].scope, "LOJA_01");
  assert.equal(writes[0].kind, "employees");
  assert.equal(writes[0].expected_revision, 3);
  void ErpRepository;
});

test("SEC-08: Código-fonte dos serviços não contém chaves/URLs fixas nem importa seed real no bundle", () => {
  const serviceFiles = [
    "src/services/erpRepository.js",
    "src/services/authService.js",
    "src/services/partitionCodec.js",
  ];
  for (const rel of serviceFiles) {
    const content = fs.readFileSync(path.resolve(rel), "utf8");
    assert.equal(content.includes("supabase.co"), false, `${rel} não pode conter URL Supabase hardcoded`);
    assert.equal(content.includes("eyJhbGciOiJIUzI1NiIs"), false, `${rel} não pode conter JWT hardcoded`);
    assert.equal(content.includes("seedLoja03"), false, `${rel} não pode importar seed real no cliente`);
  }
});

test("SEC-09: Ambiente de produção zerado (0 unidades) permite ao MASTER cadastrar a primeira empresa e a primeira unidade e persiste em GLOBAL/structure", async () => {
  // 1. Monta banco vazio (0 linhas em erp_partitions) como ocorre num ambiente novo de produção na Vercel
  const { db: emptyDb, revisionsByKey } = assembleDatabaseFromPartitions([]);
  assert.deepEqual(emptyDb.units, [], "ambiente novo inicia com zero unidades");
  assert.deepEqual(emptyDb.companies, [], "ambiente novo inicia com zero empresas");

  const baselineMap = splitDatabaseIntoPartitions(emptyDb);
  // Nenhuma partição espúria de loja fictícia (como LOJA_03) deve ser criada num banco vazio
  assert.equal(
    Array.from(baselineMap.keys()).some((k) => k.startsWith("LOJA_")),
    false,
    "banco vazio não gera partições de loja fantasma"
  );

  // 2. MASTER cria a primeira empresa e a primeira unidade diretamente (sem nenhuma unidade prévia selecionada)
  const nextDb = structuredClone(emptyDb);
  nextDb.companies = [
    {
      id: "comp_default",
      legalName: "União Supermercados Ltda",
      tradeName: "União Supermercados",
      cnpj: "",
      active: true,
    },
  ];
  nextDb.units = [
    {
      id: "UNIT_LJ01_001",
      companyId: "comp_default",
      code: "LJ01",
      name: "LOJA 01",
      city: "União",
      state: "MG",
      active: true,
    },
  ];

  let savedWrites = null;
  let savedAudit = null;
  const mockProdClient = {
    async rpc(fn, args) {
      assert.equal(fn, "erp_save_batch");
      savedWrites = args.p_writes;
      savedAudit = args.p_audit;
      return {
        data: {
          ok: true,
          revisions: args.p_writes.map((w) => ({
            scope: w.scope,
            kind: w.kind,
            period: w.period || "",
            revision: 1,
          })),
        },
        error: null,
      };
    },
  };

  const saveRes = await ErpRepository.saveMutation({
    client: mockProdClient,
    prevPartitionsMap: baselineMap,
    nextDb,
    revisionsByKey,
    auditPayload: {
      module: "ESTRUTURA_ORGANIZACIONAL",
      action: "CRIAR_UNIDADE",
      entityType: "UNIT",
      entityId: "UNIT_LJ01_001",
      unitId: null,
      summary: 'Criada unidade operacional "LOJA 01" (LJ01).',
    },
  });

  assert.equal(saveRes.ok, true);
  assert.ok(
    savedWrites.some((w) => w.scope === "GLOBAL" && w.kind === "structure" && w.data.units.length === 1),
    "persiste a primeira unidade em GLOBAL/structure com expected_revision 0"
  );
  assert.equal(savedAudit[0].module, "ESTRUTURA_ORGANIZACIONAL");

  // 3. Confirma que App.jsx libera `organization` e `rules_shifts` mesmo quando availableUnits.length === 0
  const appSource = fs.readFileSync(path.resolve("src/App.jsx"), "utf8");
  assert.ok(
    appSource.includes('activeModuleKey === "organization"'),
    "App.jsx permite acesso direto ao módulo organization mesmo sem unidades cadastradas"
  );
  assert.ok(
    appSource.includes("Cadastrar primeira unidade"),
    "App.jsx exibe atalho direto para o MASTER cadastrar a primeira unidade em ambiente vazio"
  );
});

test("SEC-10: Fluxo de login e logout na Vercel/Supabase funciona com thenable PostgrestFilterBuilder (sem .catch) na primeira tentativa sem exigir F5", async () => {
  const email = "master.producao@exemplo.invalid";
  clearFailedLoginAttempts(email);

  let sessionStored = null;

  // Em produção no Supabase (@supabase/postgrest-js), `client.rpc()` retorna um
  // PostgrestFilterBuilder (objeto thenable que possui APENAS `.then()`, sem `.catch()`).
  const makePostgrestThenable = (factory) => ({
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(factory).then(onFulfilled, onRejected);
    },
  });

  const prodLikeSupabaseClient = {
    auth: {
      async signInWithPassword({ email: em, password: pw }) {
        if (pw !== "SenhaForte#2026!") {
          return { data: { session: null, user: null }, error: new Error("Invalid login credentials") };
        }
        sessionStored = {
          access_token: "jwt-token-valido",
          refresh_token: "refresh-valido",
          user: { id: "master-uuid", email: em },
        };
        return { data: { session: sessionStored, user: sessionStored.user }, error: null };
      },
      async getSession() {
        return { data: { session: sessionStored }, error: null };
      },
      async signOut() {
        sessionStored = null;
        return { error: null };
      },
    },
    rpc(fn) {
      // Retorna estritamente um thenable sem método `.catch` (idêntico ao PostgrestBuilder real)
      return makePostgrestThenable(() => {
        if (fn === "record_auth_event") {
          return { data: null, error: null };
        }
        if (fn === "my_profile") {
          return {
            data: {
              id: "master-uuid",
              email,
              fullName: "Master Produção",
              role: "MASTER",
              status: "ACTIVE",
              mustChangePassword: false,
              authorizedUnits: [],
              permissions: PERMISSIONS_BY_ROLE.MASTER,
              aal: "aal1",
              mfaRequired: false,
              mfaEnrolled: false,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });
    },
  };

  const loginRes = await signInOperator(
    { email, password: "SenhaForte#2026!" },
    prodLikeSupabaseClient
  );

  assert.equal(loginRes.ok, true, "login válido retorna ok=true na primeira tentativa sem exigir F5");
  assert.equal(loginRes.gate, "authenticated");
  assert.equal(loginRes.profile?.role, "MASTER");

  // Testa também o encerramento de sessão com PostgrestFilterBuilder sem .catch()
  const { signOutSecurely, invokeAdminUsers } = await import("../services/authService.js");
  await assert.doesNotReject(
    () => signOutSecurely(prodLikeSupabaseClient),
    "signOutSecurely encerra a sessão sem lançar TypeError: client.rpc(...).catch is not a function"
  );
  assert.equal(sessionStored, null, "sessão revogada após signOutSecurely");

  // SEC-11: Quando a Edge Function admin-users não está implantada ("Failed to send a request to the Edge Function"),
  // invokeAdminUsers utiliza o fallback seguro via auth.signUp efêmero + RPC master_manage_user
  let capturedRpcPayload = null;
  const edgeUnavailableClient = {
    functions: {
      async invoke() {
        const err = new Error("Failed to send a request to the Edge Function");
        err.name = "FunctionsFetchError";
        return { data: null, error: err };
      },
    },
    auth: {
      async signUp({ email: em }) {
        return {
          data: { user: { id: "new-op-uuid", email: em } },
          error: null,
        };
      },
    },
    async rpc(fn, args) {
      assert.equal(fn, "master_manage_user");
      capturedRpcPayload = args.p_payload;
      return {
        data: {
          ok: true,
          profile: {
            id: args.p_payload.userId,
            email: args.p_payload.email,
            role: args.p_payload.role,
            status: "PENDING",
          },
        },
        error: null,
      };
    },
  };

  const fallbackRes = await invokeAdminUsers(
    {
      action: "invite",
      email: "novo.admin@exemplo.invalid",
      fullName: "Novo Admin",
      role: "ADMIN",
      authorizedUnits: ["LOJA_01", "LOJA_02", "LOJA_03"],
      deliveryMode: "temp_password",
    },
    edgeUnavailableClient
  );

  assert.equal(fallbackRes.ok, true);
  assert.equal(fallbackRes.oneTimeTempPassword.length, 20);
  assert.equal(capturedRpcPayload.action, "create_profile");
  assert.equal(capturedRpcPayload.userId, "new-op-uuid");
  assert.equal(capturedRpcPayload.mustChangePassword, true);
});
