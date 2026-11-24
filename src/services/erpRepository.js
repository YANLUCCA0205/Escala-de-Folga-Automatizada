// =============================================================================
// CAMADA DE SERVIÇOS E REPOSITÓRIO CENTRAL DO ERP v8.0
// Persistência Particionada/Relacional, Controle de Concorrência Otimista (Revision),
// Migração Segura v7.0 -> v8.0 (preservando backup), RBAC e Auditoria Verificada
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { buildInitialErpDatabase } from "../domain/seedLoja03.js";

const SUPA_URL = import.meta.env?.VITE_SUPABASE_URL || "https://jvvjhcfqvitnxdutfije.supabase.co";
const SUPA_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dmpoY2Zxdml0bnhkdXRmaWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mjk5ODksImV4cCI6MjA5NTQwNTk4OX0.aJJX3kP1jgVaK1mtiwZ5bZzNxSSxtm4cDb1ducx3Jvk";

// NOTA ARQUITETURAL DE SEGURANÇA (Seção 15 / BUG-009):
// Em produção, a proteção definitiva contra bypass client-side deve ser complementada no Supabase
// por Políticas de Row-Level Security (RLS) vinculadas a `auth.uid() IS NOT NULL` e checagem da
// tabela `public.user_profiles` (ex: `EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)`).
export const sb = createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const LOCAL_AUTH_ACCOUNTS_KEY = "erp_v8_auth_accounts";
// Se não houver VITE_SUPABASE_URL configurada (o host legado jvvjhcfqvitnxdutfije.supabase.co foi desativado),
// opera 100% localmente sem disparar chamadas de rede que resultariam em "Failed to fetch".
let supabaseNetworkOffline = !import.meta.env?.VITE_SUPABASE_URL;

function isNetworkFetchError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("fetch") ||
    msg.includes("err_name_not_resolved")
  );
}

export function getLocalAuthAccounts() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalAuthAccounts(accounts) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LOCAL_AUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignora erro de quota
  }
}

export function removeLocalAuthAccount(email) {
  if (!email) return;
  const clean = String(email).trim().toLowerCase();
  const next = getLocalAuthAccounts().filter(
    (a) => String(a.email || "").trim().toLowerCase() !== clean
  );
  saveLocalAuthAccounts(next);
}

/**
 * Cria uma conta de operador funcionando 100% local/híbrido (sem falhar com "Failed to fetch"
 * quando o servidor Supabase externo estiver offline ou pausado).
 */
export async function registerOperatorAccount({
  email,
  password,
  fullName = "",
  roleProfile = "ADMIN",
  units = [],
  userProfiles = [],
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "");
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Informe um e-mail corporativo válido (ex: nome@uniaosupermercados.com.br).");
  }
  if (cleanEmail === "gestao.loja03@uniaosupermercados.com.br") {
    throw new Error(
      "A conta genérica legada não pode ser utilizada. Informe seu e-mail nominal."
    );
  }
  if (cleanPass.length < 4) {
    throw new Error("A senha deve conter pelo menos 4 caracteres.");
  }

  const derivedName =
    String(fullName || "").trim() ||
    cleanEmail
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  const authorizedUnits =
    units.length > 0 ? units.map((u) => u.id || u) : ["LOJA_03", "LOJA_01", "LOJA_02"];

  // 1. Salva no registro local de contas autenticadas por senha
  const accounts = getLocalAuthAccounts();
  const existingIdx = accounts.findIndex(
    (a) => String(a.email || "").trim().toLowerCase() === cleanEmail
  );
  const accountRecord = {
    id: existingIdx >= 0 ? accounts[existingIdx].id : `ACC_${Date.now()}`,
    email: cleanEmail,
    fullName: derivedName,
    password: cleanPass,
    roleProfile: roleProfile || "ADMIN",
    authorizedUnits,
    active: true,
    createdAt: existingIdx >= 0 ? accounts[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    accounts[existingIdx] = accountRecord;
  } else {
    accounts.push(accountRecord);
  }
  saveLocalAuthAccounts(accounts);

  // 2. Tenta sincronizar opcionalmente com Supabase Auth se online (com timeout curto e fallback silencioso)
  let authStatus = "VERIFIED_LOCAL_AUTH";
  if (!supabaseNetworkOffline) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Failed to fetch")), 2500)
      );
      const res = await Promise.race([
        sb.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: { data: { full_name: derivedName, role_profile: roleProfile } },
        }),
        timeoutPromise,
      ]);
      if (!res?.error && res?.data?.user) {
        authStatus = "VERIFIED_SUPABASE_AUTH";
      } else if (res?.error && isNetworkFetchError(res.error)) {
        supabaseNetworkOffline = true;
      }
    } catch (err) {
      if (isNetworkFetchError(err)) {
        supabaseNetworkOffline = true;
      }
    }
  }

  const updatedProfiles = [...(userProfiles || [])];
  const profIdx = updatedProfiles.findIndex(
    (u) => String(u.email || "").trim().toLowerCase() === cleanEmail
  );
  const userProfileRecord = {
    id: profIdx >= 0 ? updatedProfiles[profIdx].id : `USR_${Date.now()}`,
    email: cleanEmail,
    fullName: derivedName,
    roleProfile: roleProfile || "ADMIN",
    authorizedUnits,
    active: true,
  };
  if (profIdx >= 0) {
    updatedProfiles[profIdx] = { ...updatedProfiles[profIdx], ...userProfileRecord };
  } else {
    updatedProfiles.push(userProfileRecord);
  }

  const sessionPayload = resolveAuthenticatedOperatorSession({
    email: cleanEmail,
    fullName: derivedName,
    requestedRole: roleProfile || "ADMIN",
    userProfiles: updatedProfiles,
    units,
    authVerificationStatus: authStatus,
  });

  return {
    account: accountRecord,
    userProfile: userProfileRecord,
    sessionPayload,
  };
}

/**
 * Autentica operador com e-mail e senha (suporta contas locais + fallback transparente se Supabase offline).
 */
export async function authenticateOperatorWithPassword({
  email,
  password,
  userProfiles = [],
  units = [],
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "");
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Informe um e-mail corporativo válido.");
  }
  if (!cleanPass) {
    throw new Error("Informe a sua senha de acesso.");
  }

  // 1. Verifica registro local de contas
  const accounts = getLocalAuthAccounts();
  const localAcc = accounts.find(
    (a) => String(a.email || "").trim().toLowerCase() === cleanEmail
  );

  if (localAcc) {
    if (localAcc.password !== cleanPass) {
      throw new Error("Senha incorreta para esta conta. Verifique os dados informados.");
    }
    return resolveAuthenticatedOperatorSession({
      email: cleanEmail,
      fullName: localAcc.fullName,
      requestedRole: localAcc.roleProfile || "ADMIN",
      userProfiles,
      units,
      authVerificationStatus: "VERIFIED_LOCAL_AUTH",
    });
  }

  // 2. Se não estiver no registro local ainda, tenta Supabase Auth (com proteção contra Failed to fetch)
  if (!supabaseNetworkOffline) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Failed to fetch")), 2500)
      );
      const res = await Promise.race([
        sb.auth.signInWithPassword({ email: cleanEmail, password: cleanPass }),
        timeoutPromise,
      ]);

      if (!res?.error && res?.data?.session?.user) {
        const supaUser = res.data.session.user;
        return resolveAuthenticatedOperatorSession({
          email: supaUser.email,
          fullName: supaUser.user_metadata?.full_name || supaUser.email,
          requestedRole: "ADMIN",
          userProfiles,
          units,
          authVerificationStatus: "VERIFIED_SUPABASE_AUTH",
        });
      }
      if (res?.error) {
        if (isNetworkFetchError(res.error)) {
          supabaseNetworkOffline = true;
        } else if (!res.error.message?.toLowerCase().includes("invalid login")) {
          throw new Error(res.error.message);
        }
      }
    } catch (err) {
      if (isNetworkFetchError(err)) {
        supabaseNetworkOffline = true;
      } else {
        throw err;
      }
    }
  }

  // 3. Se o e-mail já consta nos operadores autorizados (userProfiles), vincula a senha no primeiro login local
  const registeredProfile = (userProfiles || []).find(
    (u) => String(u.email || "").trim().toLowerCase() === cleanEmail
  );
  if (registeredProfile) {
    const created = await registerOperatorAccount({
      email: cleanEmail,
      password: cleanPass,
      fullName: registeredProfile.fullName,
      roleProfile: registeredProfile.roleProfile,
      units: (registeredProfile.authorizedUnits || []).map((id) => ({ id })),
      userProfiles,
    });
    return created.sessionPayload;
  }

  throw new Error(
    "Conta ainda não cadastrada neste dispositivo. Clique na aba 'Criar Conta' acima para cadastrar seu e-mail e senha."
  );
}

// Matriz de Permissões por Perfil (Seção 15 / Seção 4)
export const PERMISSIONS_BY_ROLE = {
  ADMIN: [
    "MANAGE_STRUCTURE",
    "CREATE_POSITIONS",
    "MANAGE_EMPLOYEES",
    "TRANSFER_EMPLOYEES",
    "MANAGE_UNAVAILABILITY",
    "MANAGE_RULES_SHIFTS",
    "MANAGE_MARKET_CALENDAR",
    "EDIT_SCHEDULE",
    "VALIDATE_PUBLISH_SCHEDULE",
    "RECALCULATE_PROJECTIONS",
    "VIEW_BI",
    "MANAGE_USERS",
  ],
  MANAGER: [
    "CREATE_POSITIONS",
    "MANAGE_EMPLOYEES",
    "TRANSFER_EMPLOYEES",
    "MANAGE_UNAVAILABILITY",
    "MANAGE_MARKET_CALENDAR",
    "EDIT_SCHEDULE",
    "VALIDATE_PUBLISH_SCHEDULE",
    "RECALCULATE_PROJECTIONS",
    "VIEW_BI",
  ],
  OPERATOR: [
    "MANAGE_EMPLOYEES",
    "MANAGE_UNAVAILABILITY",
    "EDIT_SCHEDULE",
    "RECALCULATE_PROJECTIONS",
    "VIEW_BI",
  ],
  VIEWER: ["VIEW_BI"],
};

export function hasPermission(roleProfile = "ADMIN", permission) {
  const allowed = PERMISSIONS_BY_ROLE[roleProfile] || [];
  return allowed.includes(permission);
}

export function assertPermission(roleProfile, permission) {
  if (!hasPermission(roleProfile, permission)) {
    throw new Error(
      `Acesso negado: o perfil "${roleProfile}" não possui permissão para a operação "${permission}".`
    );
  }
}

export function assertUnitAccess(userProfile, unitId) {
  if (!userProfile || userProfile.roleProfile === "ADMIN") return true;
  const allowedUnits = userProfile.authorizedUnits || [];
  if (unitId && allowedUnits.length > 0 && !allowedUnits.includes(unitId)) {
    throw new Error(
      `Acesso negado à unidade "${unitId}": o operador ${userProfile.email} possui autorização apenas para [${allowedUnits.join(", ")}].`
    );
  }
  return true;
}

export function canSimulateRbacRole(sessao) {
  return sessao?.roleProfile === "ADMIN";
}

export function resolveAuthenticatedOperatorSession({
  email,
  fullName,
  requestedRole = "OPERATOR",
  userProfiles = [],
  units = [],
  authVerificationStatus = "VERIFIED_OPERATOR_SESSION",
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(fullName || "").trim();
  const registered = (userProfiles || []).find(
    (u) => String(u.email || "").trim().toLowerCase() === cleanEmail
  );

  if (registered && registered.active === false) {
    throw new Error(`O operador ${cleanEmail} encontra-se desativado no cadastro de acesso.`);
  }

  const effectiveRole = registered ? registered.roleProfile : requestedRole;
  const effectiveUnits =
    registered?.authorizedUnits?.length > 0
      ? registered.authorizedUnits
      : units.length > 0
        ? units.map((u) => u.id)
        : ["LOJA_03", "LOJA_01", "LOJA_02"];

  return {
    user: {
      email: cleanEmail,
      fullName: registered?.fullName || cleanName || cleanEmail,
    },
    roleProfile: effectiveRole,
    authVerificationStatus,
    authorizedUnits: effectiveUnits,
  };
}

const ERP_V7_LEGACY_NAMESPACE_UNIT = "__ERP_RELATIONAL_CORE_V7__";
const ERP_V8_CORE_NAMESPACE_UNIT = "__ERP_PARTITIONED_CORE_V8__";
const ERP_V8_SCHEDULE_PARTITION_PREFIX = "__ERP_SCHED_V8__";
const ERP_DB_NAMESPACE_MES = "2026-ERP";
const LOCAL_CACHE_KEY_V8 = "erp_relational_db_v8_cache";
const LOCAL_CACHE_KEY_V7 = "erp_relational_db_v7_cache";

/**
 * Normaliza e migra com segurança uma base v7.0.0-ERP para v8.0.0-ERP
 * sem perder nenhum lançamento histórico, posto, colaborador ou auditoria.
 */
export function upgradeDatabaseToV8(rawDb) {
  if (!rawDb) return null;
  const db = structuredClone(rawDb);

  db.version = "8.0.0-ERP";
  db.schemaRevision = Number(db.schemaRevision || 1);

  // 1. Garante campos de Rateio multiunidade nos colaboradores existentes
  db.employees = (db.employees || []).map((emp) => {
    const alloc = (db.allocations || []).find((a) => a.employeeId === emp.id);
    const pos = (db.workPositions || []).find((p) => p.id === alloc?.workPositionId);
    const isRateio = Boolean(emp.isSharedRateio ?? pos?.isSharedRateio);
    return {
      ...emp,
      homeUnitId: emp.homeUnitId || alloc?.unitId || "LOJA_03",
      isSharedRateio: isRateio,
      authorizedUnitIds:
        emp.authorizedUnitIds?.length > 0
          ? emp.authorizedUnitIds
          : isRateio
            ? ["LOJA_03", "LOJA_01", "LOJA_02"]
            : [alloc?.unitId || "LOJA_03"],
      rateioScheduleByDow:
        emp.rateioScheduleByDow ||
        (isRateio
          ? {
              "1": { unitId: "LOJA_03", period: "INTEGRAL" },
              "2": { unitId: "LOJA_03", period: "INTEGRAL" },
              "3": { unitId: "LOJA_01", period: "INTEGRAL" },
              "4": { unitId: "LOJA_03", period: "INTEGRAL" },
              "5": { unitId: "LOJA_02", period: "INTEGRAL" },
              "6": { unitId: "LOJA_03", period: "INTEGRAL" },
            }
          : null),
    };
  });

  // 2. Garante versionamento nas escalas mensais
  db.monthlySchedules = (db.monthlySchedules || []).map((ms) => ({
    ...ms,
    versionNumber: ms.versionNumber || 1,
    versionHistory: ms.versionHistory || [],
  }));

  // 3. Classifica logs legados gerados pelo auto-login antigo (Seção 4)
  db.auditLogs = (db.auditLogs || []).map((log) => {
    if (log.authVerificationStatus) return log;
    if (log.actorEmail === "arquitetura@uniaosupermercados.com.br") {
      return {
        ...log,
        originType: "SYSTEM_MIGRATION",
        authVerificationStatus: "SYSTEM_SEED",
      };
    }
    if (log.actorEmail === "gestao.loja03@uniaosupermercados.com.br") {
      return {
        ...log,
        originType: "LEGACY_AUTO_SESSION",
        authVerificationStatus: "AUTORIA_NAO_VERIFICADA_LEGADO",
      };
    }
    return {
      ...log,
      originType: log.originType || "OPERATOR_ACTION",
      authVerificationStatus: "VERIFIED_SESSION",
    };
  });

  return db;
}

/**
 * Mescla alterações concorrentes em coleções distintas ou registros distintos
 * para evitar que dois operadores sobrescrevam o trabalho um do outro.
 */
export function mergeConcurrentDatabaseStates({
  localDb,
  remoteDb,
  mutationMeta = {},
}) {
  if (!remoteDb) return { mergedDb: localDb, hasConflict: false };

  const localRev = Number(localDb.schemaRevision || 1);
  const remoteRev = Number(remoteDb.schemaRevision || 1);

  if (remoteRev <= localRev) {
    return { mergedDb: localDb, hasConflict: false };
  }

  // Se houve atualização remota simultânea, verifica se a mesma entidade/mês foi tocada
  const lastRemoteAudit = (remoteDb.auditLogs || [])[0];
  const sameEntityConflict =
    lastRemoteAudit &&
    mutationMeta.entityType &&
    mutationMeta.entityId &&
    lastRemoteAudit.entityType === mutationMeta.entityType &&
    String(lastRemoteAudit.entityId) === String(mutationMeta.entityId) &&
    lastRemoteAudit.id !== (localDb.auditLogs || [])[0]?.id;

  // Começa com o estado remoto mais recente e reaplica a partição modificada localmente
  const merged = structuredClone(remoteDb);
  merged.schemaRevision = Math.max(localRev, remoteRev) + 1;

  // Mescla escalas mensais por competência (YYYY-MM) preservando competências remotas não alteradas localmente
  merged.dailyEntriesByMonth = {
    ...(localDb.dailyEntriesByMonth || {}),
    ...(remoteDb.dailyEntriesByMonth || {}),
  };

  if (mutationMeta.yearMonth && localDb.dailyEntriesByMonth?.[mutationMeta.yearMonth]) {
    if (
      mutationMeta.unitId &&
      Array.isArray(remoteDb.dailyEntriesByMonth?.[mutationMeta.yearMonth])
    ) {
      const remoteOtherUnits = remoteDb.dailyEntriesByMonth[mutationMeta.yearMonth].filter(
        (e) => e.unitId && e.unitId !== mutationMeta.unitId
      );
      const localTargetUnit = localDb.dailyEntriesByMonth[mutationMeta.yearMonth].filter(
        (e) => !e.unitId || e.unitId === mutationMeta.unitId
      );
      merged.dailyEntriesByMonth[mutationMeta.yearMonth] = [
        ...remoteOtherUnits,
        ...localTargetUnit,
      ];
    } else {
      merged.dailyEntriesByMonth[mutationMeta.yearMonth] =
        localDb.dailyEntriesByMonth[mutationMeta.yearMonth];
    }
  }

  // Mescla coleções cadastrais por identificador único (id) preservando adições e edições remotas e locais
  const collections = [
    "companies",
    "units",
    "sectors",
    "unitSectors",
    "functionalCategories",
    "roles",
    "workShifts",
    "scheduleRules",
    "ruleAssignments",
    "workPositions",
    "employees",
    "allocations",
    "unavailabilityEvents",
    "marketCalendarDays",
    "monthlySchedules",
    "cycleStates",
    "userProfiles",
  ];

  const getItemKey = (item) =>
    item?.id ||
    (item?.employeeId && item?.yearMonth ? `${item.employeeId}_${item.yearMonth}` : null) ||
    (item?.unitId && item?.sectorId ? `${item.unitId}_${item.sectorId}` : null) ||
    JSON.stringify(item);

  const combinedTombstones = new Set([
    ...(localDb.deletedEntityIds || []),
    ...(remoteDb.deletedEntityIds || []),
  ]);
  merged.deletedEntityIds = Array.from(combinedTombstones);

  for (const col of collections) {
    const remoteList = Array.isArray(remoteDb[col]) ? remoteDb[col] : [];
    const localList = Array.isArray(localDb[col]) ? localDb[col] : [];
    const localKeys = new Set(localList.map(getItemKey));
    const byKey = new Map();

    for (const rItem of remoteList) {
      const rk = getItemKey(rItem);
      const deletedLocally =
        combinedTombstones.has(String(rItem?.id || rk)) ||
        (mutationMeta.entityId &&
          String(mutationMeta.entityId) === String(rItem?.id || rk) &&
          !localKeys.has(rk));
      if (!deletedLocally) {
        byKey.set(rk, rItem);
      }
    }

    for (const lItem of localList) {
      const k = getItemKey(lItem);
      if (combinedTombstones.has(String(lItem?.id || k))) continue;
      if (!byKey.has(k)) {
        const removedRemotely =
          lastRemoteAudit &&
          (String(lastRemoteAudit.action || "").includes("REMOVER") ||
            String(lastRemoteAudit.action || "").includes("EXCLUIR")) &&
          String(lastRemoteAudit.entityId) === String(lItem?.id || k);
        if (!removedRemotely) {
          byKey.set(k, lItem);
        }
      } else if (
        mutationMeta.entityId &&
        String(mutationMeta.entityId) === String(lItem?.id || k)
      ) {
        byKey.set(k, lItem);
      } else if (
        !lastRemoteAudit ||
        String(lastRemoteAudit.entityId) !== String(lItem?.id || k)
      ) {
        byKey.set(k, lItem);
      }
    }

    merged[col] = Array.from(byKey.values());
  }

  // Preserva todos os logs de auditoria combinados sem duplicidade
  const seenLogIds = new Set();
  const combinedLogs = [...(localDb.auditLogs || []), ...(remoteDb.auditLogs || [])].filter(
    (l) => {
      if (!l || seenLogIds.has(l.id)) return false;
      seenLogIds.add(l.id);
      return true;
    }
  );
  merged.auditLogs = combinedLogs.slice(0, 400);

  return {
    mergedDb: merged,
    hasConflict: Boolean(sameEntityConflict),
    conflictingAudit: sameEntityConflict ? lastRemoteAudit : null,
  };
}

export class ErpRepository {
  static async loadDatabase() {
    let dbState = null;

    // 1. Tenta carregar a partição principal v8.0 do Supabase (se online)
    if (!supabaseNetworkOffline) {
      try {
        const { data: v8Row, error: v8Err } = await sb
          .from("configuracoes")
          .select("dados")
          .eq("unidade", ERP_V8_CORE_NAMESPACE_UNIT)
          .eq("mes", ERP_DB_NAMESPACE_MES)
          .maybeSingle();

        if (v8Err && isNetworkFetchError(v8Err)) {
          supabaseNetworkOffline = true;
        } else if (!v8Err && v8Row?.dados && v8Row.dados.version === "8.0.0-ERP") {
          dbState = upgradeDatabaseToV8(v8Row.dados);
        }
      } catch (err) {
        if (isNetworkFetchError(err)) supabaseNetworkOffline = true;
      }
    }

    // 2. Se v8 ainda não existir remotamente, migra automaticamente do registro v7.0 (mantendo o v7 intacto como backup!)
    if (!dbState && !supabaseNetworkOffline) {
      try {
        const { data: v7Row, error: v7Err } = await sb
          .from("configuracoes")
          .select("dados")
          .eq("unidade", ERP_V7_LEGACY_NAMESPACE_UNIT)
          .eq("mes", ERP_DB_NAMESPACE_MES)
          .maybeSingle();

        if (v7Err && isNetworkFetchError(v7Err)) {
          supabaseNetworkOffline = true;
        } else if (!v7Err && v7Row?.dados) {
          dbState = upgradeDatabaseToV8(v7Row.dados);
          await ErpRepository.saveDatabase(dbState, {
            entityType: "SYSTEM",
            entityId: "MIGRATION_V7_TO_V8",
          });
        }
      } catch (err) {
        if (isNetworkFetchError(err)) supabaseNetworkOffline = true;
      }
    }

    // 3. Fallback para cache local se o banco remoto estiver offline/indisponível
    if (!dbState) {
      try {
        const cachedV8 = localStorage.getItem(LOCAL_CACHE_KEY_V8);
        const cachedV7 = localStorage.getItem(LOCAL_CACHE_KEY_V7);
        const rawCached = cachedV8 || cachedV7;
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (parsed) {
            dbState = upgradeDatabaseToV8(parsed);
          }
        }
      } catch (err) {
        console.warn("Aviso ao ler cache local:", err);
      }
    }

    // 4. Se for o primeiro acesso absoluto, inicializa com a base oficial da Loja 03
    if (!dbState) {
      dbState = upgradeDatabaseToV8(buildInitialErpDatabase());
      await ErpRepository.saveDatabase(dbState, {
        entityType: "SYSTEM",
        entityId: "INITIAL_SEED_V8",
      });
    }

    // 5. Carrega partições mensais de escalas salvas individualmente para garantir atomicidade por competência
    if (!supabaseNetworkOffline) {
      try {
        const { data: schedPartitions, error: partErr } = await sb
          .from("configuracoes")
          .select("unidade, mes, dados")
          .like("unidade", `${ERP_V8_SCHEDULE_PARTITION_PREFIX}%`);

        if (!partErr && Array.isArray(schedPartitions)) {
          for (const part of schedPartitions) {
            if (part.dados?.yearMonth && Array.isArray(part.dados?.entries)) {
              const ym = part.dados.yearMonth;
              const partUnitId = part.dados.unitId;
              if (partUnitId && Array.isArray(dbState.dailyEntriesByMonth[ym])) {
                const otherUnits = dbState.dailyEntriesByMonth[ym].filter(
                  (e) => e.unitId && e.unitId !== partUnitId
                );
                const unitEntries = part.dados.entries.filter(
                  (e) => !e.unitId || e.unitId === partUnitId
                );
                dbState.dailyEntriesByMonth[ym] = [...otherUnits, ...unitEntries];
              } else {
                dbState.dailyEntriesByMonth[ym] = part.dados.entries;
              }
            }
          }
        }
      } catch {
        // Ignora silenciosamente caso offline
      }
    }

    return dbState;
  }

  /**
   * Salva o estado no Supabase com Controle de Concorrência Otimista (schemaRevision)
   * e persistência particionada da competência mensal quando aplicável.
   */
  static async saveDatabase(dbState, mutationMeta = {}) {
    let finalState = structuredClone(dbState);
    finalState.version = "8.0.0-ERP";

    if (!supabaseNetworkOffline) {
      try {
        // Verifica revisão remota para controle de concorrência entre operadores
        const { data: remoteRow, error: remErr } = await sb
          .from("configuracoes")
          .select("dados")
          .eq("unidade", ERP_V8_CORE_NAMESPACE_UNIT)
          .eq("mes", ERP_DB_NAMESPACE_MES)
          .maybeSingle();

        if (remErr && isNetworkFetchError(remErr)) {
          supabaseNetworkOffline = true;
          finalState.schemaRevision = Number(finalState.schemaRevision || 1) + 1;
        } else if (remoteRow?.dados) {
          const mergeResult = mergeConcurrentDatabaseStates({
            localDb: finalState,
            remoteDb: remoteRow.dados,
            mutationMeta,
          });
          finalState = mergeResult.mergedDb;
        } else {
          finalState.schemaRevision = Number(finalState.schemaRevision || 1) + 1;
        }

        if (!supabaseNetworkOffline) {
          // 1. Se a mutação envolveu uma competência de escala específica, grava a partição mensal isolada
          if (mutationMeta.yearMonth && finalState.dailyEntriesByMonth?.[mutationMeta.yearMonth]) {
            const ym = mutationMeta.yearMonth;
            const unitId = mutationMeta.unitId || "LOJA_03";
            await sb.from("configuracoes").upsert(
              {
                unidade: `${ERP_V8_SCHEDULE_PARTITION_PREFIX}${unitId}`,
                mes: ym,
                dados: {
                  unitId,
                  yearMonth: ym,
                  schemaRevision: finalState.schemaRevision,
                  entries: finalState.dailyEntriesByMonth[ym],
                  updatedAt: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              },
              { onConflict: "unidade,mes" }
            );
          }

          // 2. Persiste o estado consolidado v8 no Supabase (preservando __ERP_RELATIONAL_CORE_V7__ intacto)
          await sb.from("configuracoes").upsert(
            {
              unidade: ERP_V8_CORE_NAMESPACE_UNIT,
              mes: ERP_DB_NAMESPACE_MES,
              dados: finalState,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "unidade,mes" }
          );
        }
      } catch (err) {
        if (isNetworkFetchError(err)) {
          supabaseNetworkOffline = true;
        } else {
          console.error("Erro ao sincronizar base ERP v8 no Supabase:", err);
        }
      }
    } else {
      finalState.schemaRevision = Number(finalState.schemaRevision || 1) + 1;
    }

    // Atualiza cache local imediatamente
    try {
      localStorage.setItem(LOCAL_CACHE_KEY_V8, JSON.stringify(finalState));
    } catch (err) {
      console.warn("Aviso ao atualizar espelho local:", err);
    }

    return finalState;
  }

  static createAuditEntry({
    actorEmail,
    actorName = null,
    actorRole = "ADMIN",
    authVerificationStatus = "VERIFIED_SESSION",
    originType = "OPERATOR_ACTION",
    module,
    action,
    entityType,
    entityId,
    summary,
    beforeState = null,
    afterState = null,
  }) {
    if (!actorEmail) {
      throw new Error("Operação bloqueada: usuário/operador não identificado para registro de auditoria.");
    }
    return {
      id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      actorEmail,
      actorName: actorName || actorEmail,
      actorRole,
      authVerificationStatus,
      originType,
      module,
      action,
      entityType,
      entityId: String(entityId || ""),
      summary,
      beforeState,
      afterState,
      createdAt: new Date().toISOString(),
    };
  }
}
