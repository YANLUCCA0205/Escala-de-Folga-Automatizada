// =============================================================================
// TESTES DE SEGURANÇA DO BANCO — executados em Postgres real (PGlite) com as MIGRATIONS REAIS.
// Cada teste mapeia um critério de aceitação do projeto (seção 16 do escopo).
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDatabase,
  createAuthUser,
  claims,
  asUser,
  asAnon,
  asService,
  attempt,
  newSession,
  setPassword,
} from "./helpers/pgHarness.js";

const rpc = (db, fn, args = []) => {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  return attempt(db, `select public.${fn}(${placeholders}) as r`, args);
};

/** Monta o mundo de teste: 1 MASTER ativo (aal2) + usuários de cada perfil provisionados por ele. */
async function buildWorld() {
  const db = await createDatabase();
  const master = await createAuthUser(db, "master@teste.invalid");
  await asService(db, () =>
    db.query("select public.admin_bootstrap_first_master($1, $2, $3)", [master.id, master.email, "Master Teste"])
  );
  // Ativação do MASTER (senha já definida no stub) — aal1 é suficiente para ativar, mas não para operar.
  await asUser(db, claims(master), () => db.query("select public.complete_activation()"));

  const mk = async (email, name, role, units, extra = [], denied = []) => {
    const u = await createAuthUser(db, email);
    await asService(db, () =>
      db.query("select public.admin_create_profile($1,$2,$3,$4,$5,$6,$7,$8)", [
        master.id, u.id, email, name, role, units, extra, denied,
      ])
    );
    await asUser(db, claims(u), () => db.query("select public.complete_activation()"));
    return u;
  };

  const admin = await mk("admin@teste.invalid", "Admin Teste", "ADMIN", ["LOJA_03", "LOJA_01"]);
  const manager = await mk("manager@teste.invalid", "Gerente Teste", "MANAGER", ["LOJA_03"]);
  const operator = await mk("operator@teste.invalid", "Operador Teste", "OPERATOR", ["LOJA_03"]);
  const operator01 = await mk("operator01@teste.invalid", "Operador 01", "OPERATOR", ["LOJA_01"]);
  const viewer = await mk("viewer@teste.invalid", "Consulta Teste", "VIEWER", ["LOJA_03"]);

  // Dados operacionais fictícios de duas lojas + catálogo global (inseridos pelo service_role).
  await asService(db, async () => {
    const ins = (scope, kind, period, data) =>
      db.query("insert into public.erp_partitions (scope, kind, period, data) values ($1,$2,$3,$4::jsonb)", [
        scope, kind, period, JSON.stringify(data),
      ]);
    await ins("GLOBAL", "structure", "", { units: [{ id: "LOJA_03" }, { id: "LOJA_01" }] });
    await ins("LOJA_03", "employees", "", { employees: [{ id: "E3", fullName: "FICTICIO TRES" }] });
    await ins("LOJA_01", "employees", "", { employees: [{ id: "E1", fullName: "FICTICIO UM" }] });
    await ins("LOJA_03", "schedule", "2026-11", {
      monthlySchedule: { id: "MS", status: "DRAFT" }, entries: [{ employeeId: "E3", status: "T" }], cycleStates: [],
    });
  });

  return { db, master, admin, manager, operator, operator01, viewer, masterClaims: claims(master, { aal: "aal2" }) };
}

const save = (db, jwt, writes, audit = []) =>
  asUser(db, jwt, () => rpc(db, "erp_save_batch", [JSON.stringify(writes), JSON.stringify(audit)]));

const read = (db, jwt, sql, params = []) => asUser(db, jwt, () => attempt(db, sql, params));

// -----------------------------------------------------------------------------
test("DB-01: um visitante (anon) não consulta dados operacionais nem executa RPCs", async () => {
  const { db } = await buildWorld();
  for (const t of ["erp_partitions", "erp_profiles", "erp_audit_logs", "erp_backups", "erp_settings", "erp_permissions"]) {
    const r = await asAnon(db, () => attempt(db, `select * from public.${t}`));
    assert.equal(r.ok, false, `anon não deveria ler ${t}`);
    assert.match(r.error, /permission denied/i);
  }
  for (const fn of ["my_profile()", "erp_save_batch('[]','[]')", "erp_list_backups()", "admin_list_users()"]) {
    const r = await asAnon(db, () => attempt(db, `select public.${fn}`));
    assert.equal(r.ok, false, `anon não deveria executar ${fn}`);
  }
});

test("DB-02: visitante não cria conta nem perfil (nenhum INSERT/UPDATE/DELETE para anon/authenticated)", async () => {
  const { db, operator } = await buildWorld();
  const stranger = await createAuthUser(db, "estranho@teste.invalid");
  for (const who of [
    (fn) => asAnon(db, fn),
    (fn) => asUser(db, claims(stranger), fn),
    (fn) => asUser(db, claims(operator), fn),
  ]) {
    const ins = await who(() =>
      attempt(db, "insert into public.erp_profiles (id,email,full_name,role,status) values (gen_random_uuid(),'x@x.invalid','X','ADMIN','ACTIVE')")
    );
    assert.equal(ins.ok, false);
    const fnCall = await who(() =>
      attempt(db, "select public.admin_create_profile(null, gen_random_uuid(), 'a@a.invalid','A','ADMIN','{LOJA_03}','{}','{}')")
    );
    assert.equal(fnCall.ok, false, "funções administrativas são exclusivas do service_role");
  }
});

test("DB-03: usuário autenticado no Auth, mas sem perfil provisionado, não enxerga nem grava nada", async () => {
  const { db } = await buildWorld();
  const stranger = await createAuthUser(db, "autocadastro@teste.invalid");
  const jwt = claims(stranger);
  const rows = await read(db, jwt, "select * from public.erp_partitions");
  assert.deepEqual(rows.rows, []);
  const prof = await asUser(db, jwt, () => rpc(db, "my_profile"));
  assert.equal(prof.rows[0].r.status, "NO_PROFILE");
  const w = await save(db, jwt, [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: {} }]);
  assert.equal(w.rows[0].r.error, "UNAUTHENTICATED");
});

test("DB-04: um operador não eleva o próprio perfil nem altera unidades/permissões", async () => {
  const { db, operator } = await buildWorld();
  const jwt = claims(operator);
  for (const sql of [
    "update public.erp_profiles set role = 'MASTER' where id = auth.uid()",
    "update public.erp_profiles set authorized_units = '{LOJA_01,LOJA_02,LOJA_03}' where id = auth.uid()",
    "update public.erp_profiles set extra_permissions = '{MANAGE_USERS}' where id = auth.uid()",
    "update public.erp_profiles set status = 'ACTIVE', must_change_password = false where id = auth.uid()",
    "delete from public.erp_profiles where id = auth.uid()",
  ]) {
    const r = await read(db, jwt, sql);
    assert.equal(r.ok, false, sql);
  }
  for (const call of [
    "select public.admin_update_profile(auth.uid(), auth.uid(), 'X', 'MASTER', '{LOJA_03}', '{}', '{}')",
    "select public.admin_set_status(auth.uid(), auth.uid(), 'ACTIVE')",
  ]) {
    const r = await read(db, jwt, call);
    assert.equal(r.ok, false, call);
    assert.match(r.error, /permission denied/i);
  }
  const { rows } = await asService(db, () => attempt(db, "select role, authorized_units from public.erp_profiles where id = $1", [operator.id]));
  assert.equal(rows[0].role, "OPERATOR");
  assert.deepEqual(rows[0].authorized_units, ["LOJA_03"]);
});

test("DB-05: isolamento entre lojas — leitura limitada às unidades autorizadas (+ catálogo global)", async () => {
  const { db, operator, operator01, admin, viewer } = await buildWorld();
  const scopes = async (u) =>
    (await read(db, claims(u), "select scope from public.erp_partitions order by scope")).rows.map((r) => r.scope);
  assert.deepEqual(await scopes(operator), ["GLOBAL", "LOJA_03", "LOJA_03"]);
  assert.deepEqual(await scopes(viewer), ["GLOBAL", "LOJA_03", "LOJA_03"]);
  assert.deepEqual(await scopes(operator01), ["GLOBAL", "LOJA_01"]);
  assert.deepEqual([...new Set(await scopes(admin))].sort(), ["GLOBAL", "LOJA_01", "LOJA_03"]);
  // Consulta direta filtrando a loja alheia (equivale a requisição REST forjada): vazio.
  const direct = await read(db, claims(operator), "select * from public.erp_partitions where scope = 'LOJA_01'");
  assert.deepEqual(direct.rows, []);
});

test("DB-06: gravação em unidade não autorizada é negada e a tentativa é auditada", async () => {
  const { db, operator, master } = await buildWorld();
  const r = await save(db, claims(operator), [
    { scope: "LOJA_01", kind: "employees", expected_revision: 1, data: { employees: [{ id: "HACK" }] } },
  ]);
  assert.equal(r.rows[0].r.ok, false);
  assert.equal(r.rows[0].r.error, "FORBIDDEN_UNIT");
  const data = await asService(db, () => attempt(db, "select data from public.erp_partitions where scope='LOJA_01' and kind='employees'"));
  assert.equal(data.rows[0].data.employees[0].id, "E1", "dados da loja alheia intactos");
  const log = await asUser(db, claims(master, { aal: "aal2" }), () =>
    attempt(db, "select result, actor_email, unit_id from public.erp_audit_logs where action = 'ESCRITA_NEGADA_UNIDADE'")
  );
  assert.equal(log.rows.length, 1);
  assert.equal(log.rows[0].result, "DENIED");
  assert.equal(log.rows[0].actor_email, "operator@teste.invalid");
});

test("DB-07: perfil VIEWER não grava; perfil sem permissão da partição é negado (RBAC no servidor)", async () => {
  const { db, viewer, operator } = await buildWorld();
  const v = await save(db, claims(viewer), [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: {} }]);
  assert.equal(v.rows[0].r.error, "FORBIDDEN");
  // OPERATOR não possui MANAGE_STRUCTURE: o catálogo global é inalterável por ele.
  const g = await save(db, claims(operator), [{ scope: "GLOBAL", kind: "structure", expected_revision: 1, data: { units: [] } }]);
  assert.equal(g.rows[0].r.error, "FORBIDDEN");
  const calendar = await save(db, claims(operator), [{ scope: "LOJA_03", kind: "calendar", expected_revision: 0, data: {} }]);
  assert.equal(calendar.rows[0].r.error, "FORBIDDEN");
});

test("DB-08: gravação autorizada incrementa a revisão, é atômica e a auditoria usa o autor real do servidor", async () => {
  const { db, operator, master } = await buildWorld();
  const ok = await save(
    db, claims(operator),
    [
      { scope: "LOJA_03", kind: "schedule", period: "2026-11", expected_revision: 1,
        data: { monthlySchedule: { id: "MS", status: "DRAFT" }, entries: [{ employeeId: "E3", status: "F" }], cycleStates: [] } },
    ],
    [{ module: "ESCALA_MENSAL", action: "EDITAR_CELULA", entity_type: "CELL", entity_id: "E3", unit_id: "LOJA_03",
       summary: "teste", actor_email: "forjado@evil.invalid", actor_role: "MASTER" }]
  );
  assert.equal(ok.rows[0].r.ok, true);
  assert.equal(ok.rows[0].r.revisions[0].revision, 2);
  const log = await asUser(db, claims(master, { aal: "aal2" }), () =>
    attempt(db, "select actor_email, actor_role, auth_verification, origin_type from public.erp_audit_logs where action = 'EDITAR_CELULA'")
  );
  assert.equal(log.rows[0].actor_email, "operator@teste.invalid", "autor derivado de auth.uid(), não do payload");
  assert.equal(log.rows[0].actor_role, "OPERATOR");
  assert.equal(log.rows[0].origin_type, "OPERATOR_ACTION");

  // Atomicidade: uma partição inválida (outra unidade) impede a gravação das demais.
  const partial = await save(db, claims(operator), [
    { scope: "LOJA_03", kind: "employees", expected_revision: 1, data: { employees: [{ id: "MUDOU" }] } },
    { scope: "LOJA_01", kind: "employees", expected_revision: 1, data: {} },
  ]);
  assert.equal(partial.rows[0].r.ok, false);
  const still = await asService(db, () => attempt(db, "select data, revision from public.erp_partitions where scope='LOJA_03' and kind='employees'"));
  assert.equal(still.rows[0].data.employees[0].id, "E3");
  assert.equal(Number(still.rows[0].revision), 1);
});

test("DB-09: concorrência otimista — revisão desatualizada é rejeitada sem sobrescrever", async () => {
  const { db, manager, operator } = await buildWorld();
  const write = (jwt, rev, id) =>
    save(db, jwt, [{ scope: "LOJA_03", kind: "employees", expected_revision: rev, data: { employees: [{ id }] } }]);
  assert.equal((await write(claims(manager), 1, "A")).rows[0].r.ok, true);
  const stale = await write(claims(operator), 1, "B");
  assert.equal(stale.rows[0].r.error, "REVISION_CONFLICT");
  assert.equal(stale.rows[0].r.conflicts[0].current_revision, 2);
  const d = await asService(db, () => attempt(db, "select data from public.erp_partitions where scope='LOJA_03' and kind='employees'"));
  assert.equal(d.rows[0].data.employees[0].id, "A");
});

test("DB-10: escala PUBLICADA é imutável no servidor; publicar/reabrir exige permissão específica", async () => {
  const { db, manager, operator } = await buildWorld();
  const sched = (status, entries = [{ employeeId: "E3", status: "T" }]) => ({
    scope: "LOJA_03", kind: "schedule", period: "2026-11",
    data: { monthlySchedule: { id: "MS", status }, entries, cycleStates: [] },
  });
  // OPERATOR não publica
  const noPub = await save(db, claims(operator), [{ ...sched("PUBLISHED"), expected_revision: 1 }]);
  assert.equal(noPub.rows[0].r.error, "FORBIDDEN");
  // MANAGER (VALIDATE_PUBLISH_SCHEDULE) publica
  const pub = await save(db, claims(manager), [{ ...sched("PUBLISHED"), expected_revision: 1 }]);
  assert.equal(pub.rows[0].r.ok, true);
  // Edição de célula em escala publicada: recusada
  const edit = await save(db, claims(manager), [{ ...sched("PUBLISHED", [{ employeeId: "E3", status: "F" }]), expected_revision: 2 }]);
  assert.equal(edit.rows[0].r.error, "SCHEDULE_LOCKED");
  // Reabertura por OPERATOR: negada; por MANAGER: permitida
  const reopenOp = await save(db, claims(operator), [{ ...sched("DRAFT"), expected_revision: 2 }]);
  assert.equal(reopenOp.rows[0].r.error, "FORBIDDEN");
  const reopenMg = await save(db, claims(manager), [{ ...sched("DRAFT"), expected_revision: 2 }]);
  assert.equal(reopenMg.rows[0].r.ok, true);
});

test("DB-11: conta desativada perde acesso imediatamente e a sessão antiga não autoriza mais nada", async () => {
  const { db, master, operator, masterClaims } = await buildWorld();
  const jwt = claims(operator);
  assert.equal((await read(db, jwt, "select * from public.erp_partitions")).rows.length > 0, true);
  await asService(db, () => db.query("select public.admin_set_status($1,$2,'DEACTIVATED','teste')", [master.id, operator.id]));
  // O mesmo JWT (ainda não expirado) não funciona mais.
  assert.deepEqual((await read(db, jwt, "select * from public.erp_partitions")).rows, []);
  const w = await save(db, jwt, [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: {} }]);
  assert.equal(w.rows[0].r.error, "UNAUTHENTICATED");
  // Mesmo com novo login (nova sessão) segue sem acesso: status DEACTIVATED.
  const fresh = await createAuthUser(db, "x-operator-relogin@teste.invalid", { withSession: false });
  void fresh;
  const relogin = { ...claims(operator), session_id: await newSession(db, operator) };
  assert.deepEqual((await read(db, relogin, "select * from public.erp_partitions")).rows, []);
  const prof = await asUser(db, relogin, () => rpc(db, "my_profile"));
  assert.equal(prof.rows[0].r.status, "DEACTIVATED");
  assert.deepEqual(prof.rows[0].r.permissions, []);
  void masterClaims;
});

test("DB-12: sessão revogada deixa de autorizar operações, mesmo com a conta ativa", async () => {
  const { db, master, manager } = await buildWorld();
  const jwt = claims(manager);
  assert.equal((await read(db, jwt, "select * from public.erp_partitions")).rows.length > 0, true);
  await asService(db, () => db.query("select public.admin_revoke_sessions($1,$2)", [master.id, manager.id]));
  assert.deepEqual((await read(db, jwt, "select * from public.erp_partitions")).rows, []);
  const w = await save(db, jwt, [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: {} }]);
  assert.equal(w.rows[0].r.error, "UNAUTHENTICATED");
});

test("DB-13: conta pendente não acessa dados e só ativa depois de definir a senha definitiva", async () => {
  const { db, master } = await buildWorld();
  const pending = await createAuthUser(db, "novo@teste.invalid", { password: "" }); // convite: sem senha ainda
  await asService(db, () =>
    db.query("select public.admin_create_profile($1,$2,$3,$4,'OPERATOR','{LOJA_03}','{}','{}')", [master.id, pending.id, pending.email, "Novo"])
  );
  const jwt = claims(pending);
  assert.deepEqual((await read(db, jwt, "select * from public.erp_partitions")).rows, []);
  const early = await asUser(db, jwt, () => rpc(db, "complete_activation"));
  assert.equal(early.ok, false);
  assert.match(early.error, /PASSWORD_NOT_SET/);
  const st = await asUser(db, jwt, () => rpc(db, "my_profile"));
  assert.equal(st.rows[0].r.status, "PENDING");
  // Define a senha (stub: grava hash) e ativa
  await setPassword(db, pending, "hash-novo");
  const ok = await asUser(db, jwt, () => rpc(db, "complete_activation"));
  assert.equal(ok.rows[0].r.status, "ACTIVE");
  assert.equal((await read(db, jwt, "select * from public.erp_partitions")).rows.length > 0, true);
});

test("DB-14: troca obrigatória após redefinição administrativa — só libera quando a senha realmente muda", async () => {
  const { db, master, operator } = await buildWorld();
  await asService(db, () => db.query("select public.admin_flag_credential_reset($1,$2)", [master.id, operator.id]));
  // sessões foram encerradas; novo login com a conta marcada
  const jwt = { ...claims(operator), session_id: await newSession(db, operator) };
  assert.deepEqual((await read(db, jwt, "select * from public.erp_partitions")).rows, [], "bloqueado até trocar a senha");
  const same = await asUser(db, jwt, () => rpc(db, "complete_password_change"));
  assert.equal(same.ok, false);
  assert.match(same.error, /PASSWORD_NOT_CHANGED/);
  await setPassword(db, operator, "outro-hash");
  const done = await asUser(db, jwt, () => rpc(db, "complete_password_change"));
  assert.equal(done.rows[0].r.mustChangePassword, false);
  assert.equal((await read(db, jwt, "select * from public.erp_partitions")).rows.length > 0, true);
});

test("DB-15: MASTER só opera com MFA verificado (aal2); sem MFA não enxerga nem administra nada", async () => {
  const { db, master } = await buildWorld();
  const aal1 = claims(master);
  assert.deepEqual((await read(db, aal1, "select * from public.erp_partitions")).rows, []);
  const list1 = await asUser(db, aal1, () => rpc(db, "admin_list_users"));
  assert.equal(list1.ok, false);
  const prof = await asUser(db, aal1, () => rpc(db, "my_profile"));
  assert.equal(prof.rows[0].r.mfaRequired, true);
  const aal2 = claims(master, { aal: "aal2" });
  assert.equal((await read(db, aal2, "select * from public.erp_partitions")).rows.length > 0, true);
  const list2 = await asUser(db, aal2, () => attempt(db, "select * from public.admin_list_users()"));
  assert.equal(list2.ok, true);
  assert.equal(list2.rows.length, 6);
});

test("DB-16: o último MASTER ativo não pode ser desativado, rebaixado ou excluído", async () => {
  const { db, master } = await buildWorld();
  const run = (sql, params) => asService(db, () => attempt(db, sql, params));
  const demote = await run("select public.admin_update_profile($1,$1,'M','ADMIN','{LOJA_03}','{}','{}')", [master.id]);
  assert.equal(demote.ok, false); // bloqueado (autoalteração e último MASTER)
  const deact = await run("update public.erp_profiles set status='DEACTIVATED' where id = $1", [master.id]);
  assert.equal(deact.ok, false);
  assert.match(deact.error, /LAST_MASTER_PROTECTED/);
  const del = await run("delete from public.erp_profiles where id = $1", [master.id]);
  assert.equal(del.ok, false);
  assert.match(del.error, /LAST_MASTER_PROTECTED/);
  // Com um segundo MASTER ativo, a troca é permitida.
  const m2 = await createAuthUser(db, "master2@teste.invalid");
  await run("select public.admin_create_profile($1,$2,$3,'Master 2','MASTER','{}','{}','{}')", [master.id, m2.id, m2.email]);
  await asUser(db, claims(m2), () => db.query("select public.complete_activation()"));
  const ok = await run("select public.admin_set_status($1,$2,'DEACTIVATED','rodízio')", [m2.id, master.id]);
  assert.equal(ok.ok, true);
  const last = await run("select public.admin_set_status($1,$2,'DEACTIVATED','x')", [m2.id, m2.id]);
  assert.equal(last.ok, false);
});

test("DB-17: provisionamento do primeiro MASTER é único; recuperação break-glass só sem MASTER ativo", async () => {
  const { db } = await buildWorld();
  const again = await createAuthUser(db, "intruso@teste.invalid");
  const r = await asService(db, () => attempt(db, "select public.admin_bootstrap_first_master($1,$2,'Intruso')", [again.id, again.email]));
  assert.equal(r.ok, false);
  assert.match(r.error, /MASTER_ALREADY_PROVISIONED/);
  const rec = await asService(db, () => attempt(db, "select public.admin_recover_master($1,$2,'Intruso')", [again.id, again.email]));
  assert.equal(rec.ok, false);
  assert.match(rec.error, /ACTIVE_MASTER_EXISTS/);
  // Simula perda de todos os MASTER (ex.: via SQL administrativo direto) e recupera com auditoria BREAK_GLASS.
  await db.exec("alter table public.erp_profiles disable trigger profiles_guard_trg");
  await db.exec("update public.erp_profiles set status='DEACTIVATED' where role='MASTER'");
  await db.exec("alter table public.erp_profiles enable trigger profiles_guard_trg");
  const ok = await asService(db, () => attempt(db, "select public.admin_recover_master($1,$2,'Recuperado')", [again.id, again.email]));
  assert.equal(ok.ok, true);
  const log = await asService(db, () => attempt(db, "select origin_type, auth_verification from public.erp_audit_logs where action='RECUPERAR_MASTER'"));
  assert.equal(log.rows[0].origin_type, "BREAK_GLASS");
  // O recuperado fica com troca de senha obrigatória: sem acesso até trocar a senha.
  const prof = await asService(db, () => attempt(db, "select must_change_password from public.erp_profiles where id=$1", [again.id]));
  assert.equal(prof.rows[0].must_change_password, true);
});

test("DB-18: permissões de governança não podem ser concedidas individualmente a quem não é MASTER", async () => {
  const { db, master, operator } = await buildWorld();
  const r = await asService(db, () =>
    attempt(db, "select public.admin_update_profile($1,$2,'Operador','OPERATOR','{LOJA_03}','{MANAGE_USERS}','{}')", [master.id, operator.id])
  );
  assert.equal(r.ok, false);
  assert.match(r.error, /GOVERNANCE_PERMISSION_RESERVED/);
  // Permissão operacional individual é aceita e passa a valer; negação individual remove a do perfil.
  const ok = await asService(db, () =>
    attempt(db, "select public.admin_update_profile($1,$2,'Operador','OPERATOR','{LOJA_03}','{MANAGE_RULES_SHIFTS}','{EDIT_SCHEDULE}')", [master.id, operator.id])
  );
  assert.equal(ok.ok, true);
  const jwt = { ...claims(operator), session_id: await newSession(db, operator) };
  const prof = await asUser(db, jwt, () => rpc(db, "my_profile"));
  assert.ok(prof.rows[0].r.permissions.includes("MANAGE_RULES_SHIFTS"));
  assert.ok(!prof.rows[0].r.permissions.includes("EDIT_SCHEDULE"));
});

test("DB-19: ninguém altera o próprio perfil/unidades; mudança de privilégio encerra as sessões do alvo", async () => {
  const { db, master, admin } = await buildWorld();
  const self = await asService(db, () =>
    attempt(db, "select public.admin_update_profile($1,$1,'Master','MASTER','{LOJA_01}','{}','{}')", [master.id])
  );
  assert.equal(self.ok, false);
  assert.match(self.error, /SELF_PRIVILEGE_CHANGE_BLOCKED/);
  const nonMaster = await asService(db, () =>
    attempt(db, "select public.admin_update_profile($1,$2,'Admin','ADMIN','{LOJA_03}','{}','{}')", [admin.id, admin.id])
  );
  assert.equal(nonMaster.ok, false, "ADMIN não é ator válido de governança");
  assert.match(nonMaster.error, /FORBIDDEN/);
  await asService(db, () =>
    db.query("select public.admin_update_profile($1,$2,'Admin','ADMIN','{LOJA_03}','{}','{}')", [master.id, admin.id])
  );
  const sess = await attempt(db, "select count(*)::int as n from auth.sessions where user_id=$1", [admin.id]);
  assert.equal(sess.rows[0].n, 0);
});

test("DB-20: auditoria é imutável e protegida por escopo de leitura", async () => {
  const { db, master, admin, operator, masterClaims } = await buildWorld();
  // gera eventos em duas unidades
  await save(db, claims(operator), [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: { employees: [] } }],
    [{ module: "COLABORADORES", action: "A3", entity_type: "E", entity_id: "1", unit_id: "LOJA_03", summary: "loja3" }]);
  await save(db, claims(admin), [{ scope: "LOJA_01", kind: "employees", expected_revision: 1, data: { employees: [] } }],
    [{ module: "COLABORADORES", action: "A1", entity_type: "E", entity_id: "2", unit_id: "LOJA_01", summary: "loja1" }]);
  // Nenhum perfil de API altera/apaga logs
  for (const sql of ["update public.erp_audit_logs set summary='x'", "delete from public.erp_audit_logs", "truncate public.erp_audit_logs"]) {
    const r = await asUser(db, masterClaims, () => attempt(db, sql));
    assert.equal(r.ok, false, sql);
    const rs = await asService(db, () => attempt(db, sql));
    assert.equal(rs.ok, false, `mesmo o service_role não altera: ${sql}`);
  }
  // OPERATOR (sem VIEW_AUDIT) não lê; ADMIN lê só as próprias unidades; MASTER lê tudo
  assert.deepEqual((await read(db, claims(operator), "select * from public.erp_audit_logs")).rows, []);
  const forAdmin = await read(db, claims(admin), "select distinct unit_id from public.erp_audit_logs");
  assert.ok(forAdmin.rows.every((r) => ["LOJA_03", "LOJA_01"].includes(r.unit_id)));
  const all = await read(db, masterClaims, "select count(*)::int as n from public.erp_audit_logs");
  assert.ok(all.rows[0].n >= 2);
  void master;
});

test("DB-21: backup/restauração — só MASTER com MFA recente, com confirmação, ponto de retorno e auditoria", async () => {
  const { db, master, admin, operator, masterClaims } = await buildWorld();
  // ADMIN e OPERATOR não acessam backups (nem pela RPC, nem pela tabela)
  for (const who of [admin, operator]) {
    const list = await asUser(db, claims(who), () => attempt(db, "select * from public.erp_list_backups()"));
    assert.equal(list.ok, false);
    const direct = await asUser(db, claims(who), () => attempt(db, "select * from public.erp_backups"));
    assert.equal(direct.ok, false);
    const create = await asUser(db, claims(who), () => rpc(db, "erp_create_backup", ["x"]));
    assert.equal(create.rows[0].r.error, "FORBIDDEN");
  }
  const created = await asUser(db, masterClaims, () => rpc(db, "erp_create_backup", ["Antes do teste"]));
  assert.equal(created.rows[0].r.ok, true);
  const id = created.rows[0].r.id;

  // Altera dado depois do backup
  await save(db, masterClaims, [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: { employees: [{ id: "ALTERADO" }] } }]);

  // Sem MFA recente (TOTP há 2h) o download/restauração são recusados
  const stale = claims(master, { aal: "aal2", totpAgeSeconds: 7200 });
  const dl = await asUser(db, stale, () => rpc(db, "erp_get_backup", [id]));
  assert.equal(dl.rows[0].r.error, "REAUTH_REQUIRED");
  const rs = await asUser(db, stale, () => rpc(db, "erp_restore_backup", [id, `RESTAURAR ${id.slice(0, 8)}`]));
  assert.equal(rs.rows[0].r.error, "REAUTH_REQUIRED");

  // Confirmação errada
  const bad = await asUser(db, masterClaims, () => rpc(db, "erp_restore_backup", [id, "sim"]));
  assert.equal(bad.rows[0].r.error, "CONFIRMATION_MISMATCH");

  // Restauração correta
  const ok = await asUser(db, masterClaims, () => rpc(db, "erp_restore_backup", [id, `RESTAURAR ${id.slice(0, 8)}`]));
  assert.equal(ok.rows[0].r.ok, true);
  const d = await asService(db, () => attempt(db, "select data, revision from public.erp_partitions where scope='LOJA_03' and kind='employees'"));
  assert.equal(d.rows[0].data.employees[0].id, "E3");
  assert.equal(Number(d.rows[0].revision) > 2, true, "revisão sempre cresce para invalidar clientes");
  const backups = await asUser(db, masterClaims, () => attempt(db, "select kind from public.erp_list_backups()"));
  assert.deepEqual(backups.rows.map((r) => r.kind).sort(), ["MANUAL", "PRE_RESTORE"]);
  const log = await asUser(db, masterClaims, () => attempt(db, "select action, result from public.erp_audit_logs where module='BACKUP' order by created_at"));
  const actions = log.rows.map((r) => `${r.action}:${r.result}`);
  assert.ok(actions.includes("RESTAURACAO_NEGADA:DENIED"));
  assert.ok(actions.includes("RESTAURAR_BACKUP:SUCCESS"));
});

test("DB-22: modo de manutenção bloqueia gravações de não-MASTER e só MASTER altera a configuração", async () => {
  const { db, operator, masterClaims, admin } = await buildWorld();
  const denied = await asUser(db, claims(admin), () => rpc(db, "erp_set_setting", ["maintenance_mode", JSON.stringify({ enabled: true })]));
  assert.equal(denied.rows[0].r.error, "FORBIDDEN");
  const on = await asUser(db, masterClaims, () => rpc(db, "erp_set_setting", ["maintenance_mode", JSON.stringify({ enabled: true, message: "janela" })]));
  assert.equal(on.rows[0].r.ok, true);
  const w = await save(db, claims(operator), [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: {} }]);
  assert.equal(w.rows[0].r.error, "MAINTENANCE_MODE");
  const unknown = await asUser(db, masterClaims, () => rpc(db, "erp_set_setting", ["qualquer_coisa", "{}"]));
  assert.equal(unknown.rows[0].r.error, "UNKNOWN_SETTING");
});

test("DB-23: payloads malformados e partições inconsistentes são rejeitados", async () => {
  const { db, manager } = await buildWorld();
  const jwt = claims(manager);
  const cases = [
    [{ scope: "GLOBAL", kind: "employees", expected_revision: 0, data: {} }], // escopo x tipo
    [{ scope: "LOJA_03", kind: "employees", expected_revision: 1, data: [] }], // data não é objeto
    [{ scope: "LOJA_03", kind: "inexistente", expected_revision: 0, data: {} }],
  ];
  for (const writes of cases) {
    const r = await save(db, jwt, writes);
    assert.equal(r.rows[0].r.ok, false);
  }
  const notArray = await asUser(db, jwt, () => rpc(db, "erp_save_batch", ['{"a":1}', "[]"]));
  assert.equal(notArray.rows[0].r.error, "INVALID_PAYLOAD");
  // período inválido para escala é barrado por CHECK (service_role também)
  const bad = await asService(db, () => attempt(db, "insert into public.erp_partitions (scope,kind,period) values ('LOJA_03','schedule','2026-13')"));
  assert.equal(bad.ok, false);
});

test("DB-24: lockdown das tabelas legadas remove o acesso anônimo à chave pública", async () => {
  const db = await createDatabase();
  // Reproduz o estado legado: tabela criada com os privilégios padrão do Supabase, sem RLS.
  await db.exec("create table public.configuracoes (unidade text, mes text, dados jsonb, primary key (unidade, mes))");
  await db.exec("insert into public.configuracoes values ('__ERP_PARTITIONED_CORE_V8__','2026-ERP','{\"employees\":[{\"fullName\":\"FICTICIO\"}]}')");
  const before = await asAnon(db, () => attempt(db, "select * from public.configuracoes"));
  assert.equal(before.ok, true, "premissa: o estado legado é legível por anon");
  assert.equal(before.rows.length, 1);
  const fs = await import("node:fs");
  const path = await import("node:path");
  const sql = fs.readFileSync(path.resolve("supabase/migrations/20261201000300_lockdown_legacy_tables.sql"), "utf8");
  await db.exec(sql);
  const after = await asAnon(db, () => attempt(db, "select * from public.configuracoes"));
  assert.equal(after.ok, false);
  const write = await asAnon(db, () => attempt(db, "update public.configuracoes set dados = '{}'"));
  assert.equal(write.ok, false);
  const auth = await db.query("insert into auth.users (email, encrypted_password) values ('a@a.invalid','x') returning id");
  const s = await db.query("insert into auth.sessions (user_id) values ($1) returning id", [auth.rows[0].id]);
  const asAuthed = await asUser(db, { sub: auth.rows[0].id, session_id: s.rows[0].id, aal: "aal1" }, () => attempt(db, "select * from public.configuracoes"));
  assert.equal(asAuthed.ok, false);
  // Os dados continuam existindo para o service_role (rollback/auditoria).
  const kept = await asService(db, () => attempt(db, "select count(*)::int as n from public.configuracoes"));
  assert.equal(kept.rows[0].n, 1);
});

test("DB-25: eventos de autenticação registram o autor real e só aceitam tipos permitidos", async () => {
  const { db, operator, masterClaims } = await buildWorld();
  const ok = await asUser(db, claims(operator), () => rpc(db, "record_auth_event", ["LOGIN"]));
  assert.equal(ok.ok, true);
  const bad = await asUser(db, claims(operator), () => rpc(db, "record_auth_event", ["PROMOVER_A_MASTER"]));
  assert.equal(bad.ok, false);
  const log = await asUser(db, masterClaims, () => attempt(db, "select actor_email, origin_type from public.erp_audit_logs where action='LOGIN'"));
  assert.equal(log.rows[0].actor_email, "operator@teste.invalid");
  assert.equal(log.rows[0].origin_type, "AUTH_EVENT");
});

test("DB-26: matriz de permissões do banco mantém ADMIN sem governança e MASTER com todas as permissões", async () => {
  const { db } = await buildWorld();
  const r = await asService(db, () =>
    attempt(db, "select role, array_agg(permission order by permission) as perms from public.erp_role_permissions group by role")
  );
  const by = Object.fromEntries(r.rows.map((x) => [x.role, x.perms]));
  const gov = ["MANAGE_USERS", "MANAGE_ACCESS", "MANAGE_BACKUP", "MANAGE_SYSTEM_SETTINGS"];
  for (const g of gov) {
    assert.ok(by.MASTER.includes(g));
    for (const role of ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]) assert.ok(!by[role].includes(g), `${role} não deve ter ${g}`);
  }
  assert.deepEqual(by.VIEWER, ["VIEW_BI"]);
  const total = await asService(db, () => attempt(db, "select count(*)::int as n from public.erp_permissions"));
  assert.equal(by.MASTER.length, total.rows[0].n);
});
