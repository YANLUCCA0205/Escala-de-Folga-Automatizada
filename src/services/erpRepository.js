// =============================================================================
// CAMADA DE REPOSITÓRIO, RBAC E PERSISTÊNCIA PARTICIONADA — WORKFORCE ERP v9.0
//
// Segurança corporativa:
//   - Nenhuma URL ou chave de API fixada em código (exige variáveis de ambiente).
//   - Nenhum armazenamento de senhas, sessões forjáveis ou cache de PII em localStorage.
//   - Nenhum import de planilha ou base nominal real no bundle do navegador.
//   - Autorização real imposta no PostgreSQL via RLS + RPC `public.erp_save_batch`;
//     as checagens abaixo atuam como defesa em profundidade e feedback imediato na UI.
// =============================================================================

import {
  splitDatabaseIntoPartitions,
  assembleDatabaseFromPartitions,
  diffChangedPartitions,
  partitionKey,
} from "./partitionCodec.js";

// Chaves legadas inseguras que são ativamente expurgadas do navegador
const LEGACY_INSECURE_KEYS = [
  "erp_v8_auth_accounts",
  "erp_relational_db_v8_cache",
  "erp_relational_db_v7_cache",
  "erp_v8_verified_operator_session",
];

export function purgeLegacyInsecureStorage() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    if (!storage) continue;
    for (const key of LEGACY_INSECURE_KEYS) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignora bloqueio de storage em modo restrito
      }
    }
  }
}

// Hierarquia oficial de perfis (do maior para o menor privilégio)
export const ROLE_HIERARCHY = ["MASTER", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"];

export const ROLE_METADATA = {
  MASTER: {
    code: "MASTER",
    rank: 100,
    label: "Governança Global",
    shortLabel: "Master",
    description:
      "Autoridade máxima de governança: provisionamento de contas, definição de acessos, MFA obrigatório, auditoria global, backups e configurações críticas.",
  },
  ADMIN: {
    code: "ADMIN",
    rank: 80,
    label: "Administração Operacional",
    shortLabel: "Administrador",
    description:
      "Administração operacional completa da estrutura, jornadas, regras, quadro, escalas e consulta de auditoria nas unidades autorizadas.",
  },
  MANAGER: {
    code: "MANAGER",
    rank: 60,
    label: "Gestão Operacional",
    shortLabel: "Gestor",
    description:
      "Gestão de quadro, movimentações, calendário operacional, geração, validação e publicação de escalas nas unidades autorizadas.",
  },
  OPERATOR: {
    code: "OPERATOR",
    rank: 40,
    label: "Operação",
    shortLabel: "Operador",
    description:
      "Rotina diária de colaboradores, férias/afastamentos e edição de escalas em rascunho nas unidades autorizadas.",
  },
  VIEWER: {
    code: "VIEWER",
    rank: 20,
    label: "Consulta",
    shortLabel: "Consulta",
    description:
      "Acesso estritamente de leitura a indicadores, escalas e cadastros das unidades autorizadas.",
  },
};

export const PERMISSIONS_CATALOG = [
  {
    code: "VIEW_BI",
    category: "Consulta",
    label: "Consultar indicadores e dados operacionais",
    description: "Visualiza painéis analíticos, escalas e cadastros das unidades autorizadas.",
    isGovernance: false,
  },
  {
    code: "MANAGE_STRUCTURE",
    category: "Estrutura Organizacional",
    label: "Gerenciar estrutura corporativa",
    description: "Cadastra e edita empresas, unidades, setores e funções.",
    isGovernance: false,
  },
  {
    code: "CREATE_POSITIONS",
    category: "Estrutura Organizacional",
    label: "Gerenciar quadro de postos e vagas",
    description: "Cria postos de trabalho, define status de ocupação e vagas de rateio.",
    isGovernance: false,
  },
  {
    code: "MANAGE_EMPLOYEES",
    category: "Gestão de Pessoas",
    label: "Cadastrar e atualizar colaboradores",
    description: "Admite colaboradores, atualiza dados funcionais e agenda de rateio.",
    isGovernance: false,
  },
  {
    code: "TRANSFER_EMPLOYEES",
    category: "Gestão de Pessoas",
    label: "Movimentar e transferir colaboradores",
    description: "Realiza promoções, mudanças de função/setor e transferências entre unidades autorizadas.",
    isGovernance: false,
  },
  {
    code: "MANAGE_UNAVAILABILITY",
    category: "Gestão de Pessoas",
    label: "Gerenciar férias e afastamentos",
    description: "Programa férias, licenças médicas (INSS), licença-maternidade e ausências.",
    isGovernance: false,
  },
  {
    code: "MANAGE_RULES_SHIFTS",
    category: "Planejamento Operacional",
    label: "Configurar jornadas e regras de escala",
    description: "Administra o catálogo de horários contratuais e regras 5x1, 5x2 e 6x1.",
    isGovernance: false,
  },
  {
    code: "MANAGE_MARKET_CALENDAR",
    category: "Planejamento Operacional",
    label: "Configurar calendário operacional",
    description: "Define feriados, fechamentos, meios expedientes e domingos especiais.",
    isGovernance: false,
  },
  {
    code: "EDIT_SCHEDULE",
    category: "Escalas Mensais",
    label: "Gerar e editar escalas mensais",
    description: "Gera escalas, ajusta folgas, intervalos de almoço e realiza trocas bilaterais.",
    isGovernance: false,
  },
  {
    code: "RECALCULATE_PROJECTIONS",
    category: "Escalas Mensais",
    label: "Recalcular projeções futuras",
    description: "Propaga ajustes de ciclo para competências seguintes impactadas.",
    isGovernance: false,
  },
  {
    code: "VALIDATE_PUBLISH_SCHEDULE",
    category: "Escalas Mensais",
    label: "Validar, publicar e reabrir escalas",
    description: "Homologa checklist trabalhista, publica escalas oficiais e reabre versões justificadas.",
    isGovernance: false,
  },
  {
    code: "VIEW_AUDIT",
    category: "Auditoria",
    label: "Consultar trilha de auditoria",
    description: "Inspeciona o histórico imutável de ações operacionais e administrativas.",
    isGovernance: false,
  },
  {
    code: "MANAGE_USERS",
    category: "Governança Global (MASTER)",
    label: "Provisionar e administrar contas",
    description: "Convida operadores, suspende/desativa contas, redefine credenciais e revoga sessões.",
    isGovernance: true,
  },
  {
    code: "MANAGE_ACCESS",
    category: "Governança Global (MASTER)",
    label: "Definir perfis, unidades e permissões",
    description: "Atribui perfis RBAC, escopo de lojas e exceções individuais de permissão.",
    isGovernance: true,
  },
  {
    code: "MANAGE_BACKUP",
    category: "Governança Global (MASTER)",
    label: "Executar backups e restaurações",
    description: "Cria snapshots criptograficamente verificados, exporta e restaura com MFA recente.",
    isGovernance: true,
  },
  {
    code: "MANAGE_SYSTEM_SETTINGS",
    category: "Governança Global (MASTER)",
    label: "Alterar configurações críticas",
    description: "Controla modo de manutenção e parâmetros globais de segurança.",
    isGovernance: true,
  },
];

export const PERMISSIONS_BY_ROLE = {
  MASTER: PERMISSIONS_CATALOG.map((p) => p.code),
  ADMIN: [
    "VIEW_BI",
    "MANAGE_STRUCTURE",
    "CREATE_POSITIONS",
    "MANAGE_EMPLOYEES",
    "TRANSFER_EMPLOYEES",
    "MANAGE_UNAVAILABILITY",
    "MANAGE_RULES_SHIFTS",
    "MANAGE_MARKET_CALENDAR",
    "EDIT_SCHEDULE",
    "RECALCULATE_PROJECTIONS",
    "VALIDATE_PUBLISH_SCHEDULE",
    "VIEW_AUDIT",
  ],
  MANAGER: [
    "VIEW_BI",
    "CREATE_POSITIONS",
    "MANAGE_EMPLOYEES",
    "TRANSFER_EMPLOYEES",
    "MANAGE_UNAVAILABILITY",
    "MANAGE_MARKET_CALENDAR",
    "EDIT_SCHEDULE",
    "VALIDATE_PUBLISH_SCHEDULE",
    "RECALCULATE_PROJECTIONS",
  ],
  OPERATOR: [
    "VIEW_BI",
    "MANAGE_EMPLOYEES",
    "MANAGE_UNAVAILABILITY",
    "EDIT_SCHEDULE",
    "RECALCULATE_PROJECTIONS",
  ],
  VIEWER: ["VIEW_BI"],
};

export function computeEffectivePermissions(
  role = "VIEWER",
  extraPermissions = [],
  deniedPermissions = []
) {
  const base = new Set(PERMISSIONS_BY_ROLE[role] || []);
  const governanceSet = new Set(
    PERMISSIONS_CATALOG.filter((p) => p.isGovernance).map((p) => p.code)
  );
  for (const extra of extraPermissions || []) {
    if (role !== "MASTER" && governanceSet.has(extra)) continue;
    base.add(extra);
  }
  for (const denied of deniedPermissions || []) {
    base.delete(denied);
  }
  return Array.from(base);
}

/**
 * Verifica permissão aceitando tanto uma lista efetiva de permissões (sessão v9)
 * quanto o código do perfil (compatibilidade com chamadas diretas).
 */
export function hasPermission(roleOrPermissions, permission) {
  if (!permission) return true;
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }
  if (roleOrPermissions && typeof roleOrPermissions === "object") {
    const perms =
      roleOrPermissions.permissions ||
      computeEffectivePermissions(
        roleOrPermissions.role || roleOrPermissions.roleProfile,
        roleOrPermissions.extraPermissions,
        roleOrPermissions.deniedPermissions
      );
    return perms.includes(permission);
  }
  const allowed = PERMISSIONS_BY_ROLE[roleOrPermissions] || [];
  return allowed.includes(permission);
}

export function assertPermission(roleOrPermissions, permission) {
  if (!hasPermission(roleOrPermissions, permission)) {
    const label =
      typeof roleOrPermissions === "string"
        ? roleOrPermissions
        : roleOrPermissions?.role || roleOrPermissions?.roleProfile || "ATUAL";
    const meta = PERMISSIONS_CATALOG.find((p) => p.code === permission);
    throw new Error(
      `Acesso negado: o perfil "${label}" não possui permissão para "${meta?.label || permission}".`
    );
  }
}

/**
 * Impõe isolamento estrito por unidade (menor privilégio).
 * - Apenas MASTER possui governança global irrestrita de unidades.
 * - Lista vazia de unidades autorizadas NUNCA concede acesso a todas as lojas.
 */
export function assertUnitAccess(userProfile, unitId) {
  if (!unitId) return true;
  if (!userProfile) {
    throw new Error("Acesso negado: sessão de operador não verificada.");
  }
  const role = userProfile.role || userProfile.roleProfile;
  if (role === "MASTER") return true;

  const allowedUnits = Array.isArray(userProfile.authorizedUnits)
    ? userProfile.authorizedUnits
    : [];
  if (allowedUnits.length === 0 || !allowedUnits.includes(unitId)) {
    throw new Error(
      `Acesso negado à unidade "${unitId}": o operador ${userProfile.email || ""} não possui autorização para esta filial.`
    );
  }
  return true;
}

/**
 * Pré-visualização estritamente visual de perfil (exclusiva para MASTER, incapaz de elevar privilégios).
 */
export function canSimulateRbacRole(sessao) {
  const role = sessao?.role || sessao?.roleProfile;
  return role === "MASTER";
}

/**
 * Resolve sessão exclusivamente para perfis previamente provisionados e ativos.
 * Recusa contas não cadastradas, contas desativadas, escopo vazio e ignora `requestedRole`.
 */
export function resolveAuthenticatedOperatorSession({
  email,
  userProfiles = [],
  authVerificationStatus = "VERIFIED_SUPABASE_AUTH",
}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Identidade inválida.");
  }
  if (authVerificationStatus !== "VERIFIED_SUPABASE_AUTH" && authVerificationStatus !== "VERIFIED_MFA") {
    throw new Error("Sessão recusada: exigida autenticação criptográfica verificada pelo servidor.");
  }

  const registered = (userProfiles || []).find(
    (u) => String(u.email || "").trim().toLowerCase() === cleanEmail
  );
  if (!registered) {
    throw new Error("Acesso não autorizado: conta não provisionada pelo administrador do sistema.");
  }

  const status = registered.status || (registered.active === false ? "DEACTIVATED" : "ACTIVE");
  if (status !== "ACTIVE") {
    throw new Error("Conta inativa ou pendente de ativação.");
  }

  const role = registered.role || registered.roleProfile;
  if (!ROLE_METADATA[role]) {
    throw new Error("Perfil de acesso inválido.");
  }

  const authorizedUnits = Array.isArray(registered.authorizedUnits)
    ? registered.authorizedUnits.filter(Boolean)
    : [];
  if (role !== "MASTER" && authorizedUnits.length === 0) {
    throw new Error("Conta sem unidades operacionais autorizadas.");
  }

  return {
    user: {
      id: registered.id,
      email: cleanEmail,
      fullName: registered.fullName || cleanEmail,
    },
    role,
    roleProfile: role,
    status,
    authVerificationStatus,
    authorizedUnits,
    permissions: computeEffectivePermissions(
      role,
      registered.extraPermissions,
      registered.deniedPermissions
    ),
  };
}

// -----------------------------------------------------------------------------
// BLOQUEIOS EXPLÍCITOS DAS FUNÇÕES LEGADAS INSEGURAS
// Mantidos com assinatura nominal para que qualquer chamada residual falhe fechada.
// -----------------------------------------------------------------------------
export function getLocalAuthAccounts() {
  return [];
}

export function removeLocalAuthAccount() {
  purgeLegacyInsecureStorage();
}

export async function registerOperatorAccount() {
  throw new Error(
    "PUBLIC_SIGNUP_DISABLED: O cadastro público e o armazenamento local de contas foram desativados. O provisionamento é exclusivo do perfil MASTER."
  );
}

export async function authenticateOperatorWithPassword() {
  throw new Error(
    "LOCAL_AUTH_REMOVED: A autenticação ocorre exclusivamente via Supabase Auth sem fallback local."
  );
}

// -----------------------------------------------------------------------------
// UTILITÁRIOS PUROS DE MIGRAÇÃO E MESCLAGEM (preservados para migração v7->v8->v9)
// -----------------------------------------------------------------------------
export function upgradeDatabaseToV8(rawDb) {
  if (!rawDb) return null;
  const db = structuredClone(rawDb);

  db.version = "8.0.0-ERP";
  db.schemaRevision = Number(db.schemaRevision || 1);

  if (!Array.isArray(db.companies) && db.company) {
    db.companies = [db.company];
  }

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

  db.monthlySchedules = (db.monthlySchedules || []).map((ms) => ({
    ...ms,
    versionNumber: ms.versionNumber || 1,
    versionHistory: ms.versionHistory || [],
  }));

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
      originType: log.originType || "LEGACY_IMPORT",
      authVerificationStatus: "UNVERIFIED_LEGACY",
    };
  });

  return db;
}

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

  const lastRemoteAudit = (remoteDb.auditLogs || [])[0];
  const sameEntityConflict =
    lastRemoteAudit &&
    mutationMeta.entityType &&
    mutationMeta.entityId &&
    lastRemoteAudit.entityType === mutationMeta.entityType &&
    String(lastRemoteAudit.entityId) === String(mutationMeta.entityId) &&
    lastRemoteAudit.id !== (localDb.auditLogs || [])[0]?.id;

  const merged = structuredClone(remoteDb);
  merged.schemaRevision = Math.max(localRev, remoteRev) + 1;

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

  return {
    mergedDb: merged,
    hasConflict: Boolean(sameEntityConflict),
    conflictingAudit: sameEntityConflict ? lastRemoteAudit : null,
  };
}

// -----------------------------------------------------------------------------
// REPOSITÓRIO SEGURO v9 — OPERA EXCLUSIVAMENTE SOBRE SUPABASE RLS + RPC
// -----------------------------------------------------------------------------
export class ErpRepository {
  /**
   * Carrega apenas as partições permitidas pelo RLS para o usuário autenticado.
   * Sem sessão válida ou com serviço indisponível, lança erro (fail-closed).
   */
  static async loadAuthorizedDatabase(client) {
    if (!client) {
      throw new Error("Serviço de dados não configurado.");
    }
    purgeLegacyInsecureStorage();

    const [{ data: partRows, error: partErr }, { data: settingRows, error: setErr }] =
      await Promise.all([
        client.from("erp_partitions").select("scope, kind, period, data, revision, updated_at"),
        client.from("erp_settings").select("key, value, updated_at"),
      ]);

    if (partErr) {
      throw new Error(`Falha ao carregar dados operacionais: ${partErr.message}`);
    }
    if (setErr) {
      throw new Error(`Falha ao carregar configurações do sistema: ${setErr.message}`);
    }

    const { db, revisionsByKey } = assembleDatabaseFromPartitions(partRows || []);
    // Baseline canônico gerado pela mesma função determinística usada em saveMutation,
    // garantindo que apenas partições efetivamente alteradas no estado entrem no diff.
    const baselinePartitionsMap = splitDatabaseIntoPartitions(db);

    const settings = {};
    for (const s of settingRows || []) {
      settings[s.key] = s.value;
    }

    return {
      db,
      partitionsMap: baselinePartitionsMap,
      revisionsByKey,
      settings,
    };
  }

  /**
   * Persiste atomicamente apenas as partições alteradas via RPC `erp_save_batch`.
   * O autor e o carimbo de auditoria são determinados no PostgreSQL por `auth.uid()`.
   */
  static async saveMutation({
    client,
    prevPartitionsMap,
    nextDb,
    revisionsByKey,
    auditPayload = null,
  }) {
    if (!client) {
      throw new Error("Serviço de dados indisponível.");
    }

    const nextPartitionsMap = splitDatabaseIntoPartitions(nextDb);
    const writes = diffChangedPartitions(prevPartitionsMap, nextPartitionsMap, revisionsByKey);

    if (writes.length === 0) {
      return {
        ok: true,
        noOp: true,
        partitionsMap: prevPartitionsMap,
        revisionsByKey,
      };
    }

    const auditArray = auditPayload
      ? [
          {
            module: auditPayload.module || "OPERACAO",
            action: auditPayload.action || "ATUALIZAR",
            entity_type: auditPayload.entityType || null,
            entity_id: auditPayload.entityId ? String(auditPayload.entityId) : null,
            unit_id: auditPayload.unitId || null,
            summary: auditPayload.summary || "",
            before_state: auditPayload.beforeState || null,
            after_state: auditPayload.afterState || null,
          },
        ]
      : [];

    const { data: res, error: rpcErr } = await client.rpc("erp_save_batch", {
      p_writes: writes,
      p_audit: auditArray,
    });

    if (rpcErr) {
      throw new Error(rpcErr.message || "Erro ao gravar alterações no servidor.");
    }
    if (!res?.ok) {
      const code = res?.error || "SAVE_REJECTED";
      const messages = {
        UNAUTHENTICATED: "Sua sessão expirou ou foi encerrada. Faça login novamente.",
        FORBIDDEN: "Operação recusada pelo servidor: seu perfil não possui permissão para esta alteração.",
        FORBIDDEN_UNIT: `Operação recusada pelo servidor: acesso não autorizado à unidade ${res?.scope || ""}.`,
        SCHEDULE_LOCKED:
          "Operação recusada: a escala mensal encontra-se PUBLICADA e bloqueada contra alterações diretas.",
        REVISION_CONFLICT:
          "Outro operador atualizou estes registros simultaneamente. Os dados serão recarregados para evitar perda de informações.",
        MAINTENANCE_MODE:
          "O sistema encontra-se temporariamente em modo de manutenção administrativa.",
      };
      const err = new Error(messages[code] || `Operação recusada pelo servidor (${code}).`);
      err.code = code;
      err.details = res;
      throw err;
    }

    const nextRevisions = new Map(revisionsByKey);
    for (const r of res.revisions || []) {
      nextRevisions.set(partitionKey(r.scope, r.kind, r.period), Number(r.revision));
    }

    return {
      ok: true,
      noOp: false,
      partitionsMap: nextPartitionsMap,
      revisionsByKey: nextRevisions,
    };
  }

  /**
   * Consulta a trilha de auditoria protegida (`public.erp_audit_logs`) aplicando filtros no servidor.
   */
  static async queryAuditLogs(client, filters = {}) {
    if (!client) throw new Error("Cliente não configurado.");
    let q = client
      .from("erp_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filters.limit || 250);

    if (filters.module) q = q.eq("module", filters.module);
    if (filters.unitId) q = q.eq("unit_id", filters.unitId);
    if (filters.result) q = q.eq("result", filters.result);
    if (filters.authVerification) q = q.eq("auth_verification", filters.authVerification);
    if (filters.actorQuery) {
      const clean = String(filters.actorQuery).trim();
      if (clean) q = q.ilike("actor_email", `%${clean}%`);
    }
    if (filters.actionQuery) {
      const clean = String(filters.actionQuery).trim();
      if (clean) q = q.ilike("action", `%${clean}%`);
    }
    if (filters.dateFrom) q = q.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo) q = q.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }
}
