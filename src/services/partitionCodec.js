// =============================================================================
// CODEC DE PARTICIONAMENTO DO WORKFORCE ERP (v9.0)
// Converte sem perda (lossless roundtrip) entre:
//   • O estado de domínio em memória `db` consumido pelo motor `scheduleEngine.js`
//   • As partições isoladas `(scope, kind, period)` armazenadas em `public.erp_partitions`
//
// Isolamento por loja:
//   - Catálogos estruturais (`GLOBAL/structure` e `GLOBAL/rules`) não contêm PII.
//   - Colaboradores, alocações, postos, indisponibilidades, calendário e escalas
//     ficam particionados por `unitId` (`LOJA_03`, `LOJA_01`, `LOJA_02`, ...).
//   - Colaboradores em RATEIO multiunidade são espelhados nas partições `employees`
//     das unidades listadas em `authorizedUnitIds`, mantendo `homeUnitId` como origem.
//   - `userProfiles` e `auditLogs` NÃO viajam em partições de dados: vivem em
//     `public.erp_profiles` e `public.erp_audit_logs` sob RLS próprio.
// =============================================================================

export function partitionKey(scope, kind, period = "") {
  return `${scope}|${kind}|${period || ""}`;
}

function resolveEmployeeUnits(emp, allocationsByEmpId, fallbackUnitId) {
  const units = new Set();
  if (emp.homeUnitId) units.add(emp.homeUnitId);
  if (Array.isArray(emp.authorizedUnitIds)) {
    for (const u of emp.authorizedUnitIds) {
      if (u) units.add(u);
    }
  }
  const empAllocs = allocationsByEmpId.get(emp.id) || [];
  for (const al of empAllocs) {
    if (al.unitId) units.add(al.unitId);
  }
  if (units.size === 0 && fallbackUnitId) {
    units.add(fallbackUnitId);
  }
  return Array.from(units);
}

/**
 * Divide o banco em memória em um mapa determinístico de partições `(scope, kind, period)`.
 * @param {object} db Objeto consolidado do ERP
 * @returns {Map<string, {scope:string, kind:string, period:string, data:object}>}
 */
export function splitDatabaseIntoPartitions(db) {
  const map = new Map();
  if (!db) return map;

  const units = Array.isArray(db.units) ? db.units : [];
  const fallbackUnitId = units[0]?.id || "";
  const allUnitIds = new Set(units.map((u) => u.id).filter(Boolean));

  // Coleta qualquer unitId adicional referenciado nos registros
  for (const col of ["workPositions", "allocations", "unitSectors", "marketCalendarDays", "monthlySchedules"]) {
    for (const item of db[col] || []) {
      if (item?.unitId) allUnitIds.add(item.unitId);
    }
  }
  for (const list of Object.values(db.dailyEntriesByMonth || {})) {
    for (const entry of list || []) {
      if (entry?.unitId) allUnitIds.add(entry.unitId);
    }
  }

  // 1. GLOBAL / structure (sem PII)
  map.set(partitionKey("GLOBAL", "structure", ""), {
    scope: "GLOBAL",
    kind: "structure",
    period: "",
    data: {
      version: "9.0.0-ERP",
      companies: db.companies || [],
      units: db.units || [],
      sectors: db.sectors || [],
      functionalCategories: db.functionalCategories || [],
      roles: db.roles || [],
      deletedEntityIds: db.deletedEntityIds || [],
    },
  });

  // 2. GLOBAL / rules (catálogo de jornadas e regras trabalhistas)
  map.set(partitionKey("GLOBAL", "rules", ""), {
    scope: "GLOBAL",
    kind: "rules",
    period: "",
    data: {
      workShifts: db.workShifts || [],
      scheduleRules: db.scheduleRules || [],
    },
  });

  // Índices auxiliares por colaborador
  const allocationsByEmpId = new Map();
  for (const al of db.allocations || []) {
    if (!allocationsByEmpId.has(al.employeeId)) allocationsByEmpId.set(al.employeeId, []);
    allocationsByEmpId.get(al.employeeId).push(al);
  }

  const empUnitsMap = new Map();
  const employeesById = new Map();
  for (const emp of db.employees || []) {
    employeesById.set(emp.id, emp);
    const eu = resolveEmployeeUnits(emp, allocationsByEmpId, fallbackUnitId);
    empUnitsMap.set(emp.id, eu);
    for (const u of eu) allUnitIds.add(u);
  }

  const sortedUnits = Array.from(allUnitIds).sort();

  // 3. Partições cadastrais por unidade
  for (const unitId of sortedUnits) {
    const unitPositions = (db.workPositions || []).filter((p) => (p.unitId || fallbackUnitId) === unitId);
    const unitSectors = (db.unitSectors || []).filter((us) => (us.unitId || fallbackUnitId) === unitId);

    map.set(partitionKey(unitId, "positions", ""), {
      scope: unitId,
      kind: "positions",
      period: "",
      data: {
        workPositions: unitPositions,
        unitSectors,
      },
    });

    const unitEmployees = (db.employees || []).filter((emp) =>
      (empUnitsMap.get(emp.id) || []).includes(unitId)
    );
    const unitEmpIds = new Set(unitEmployees.map((e) => e.id));
    // Inclui alocações da unidade + histórico de alocações dos colaboradores rateados visíveis à unidade
    const unitAllocations = (db.allocations || []).filter(
      (al) => (al.unitId || fallbackUnitId) === unitId || unitEmpIds.has(al.employeeId)
    );

    map.set(partitionKey(unitId, "employees", ""), {
      scope: unitId,
      kind: "employees",
      period: "",
      data: {
        employees: unitEmployees,
        allocations: unitAllocations,
      },
    });

    const unitUnavailability = (db.unavailabilityEvents || []).filter((ev) => {
      if (ev.unitId) return ev.unitId === unitId;
      return unitEmpIds.has(ev.employeeId);
    });

    map.set(partitionKey(unitId, "availability", ""), {
      scope: unitId,
      kind: "availability",
      period: "",
      data: {
        unavailabilityEvents: unitUnavailability,
      },
    });

    const unitCalendar = (db.marketCalendarDays || []).filter(
      (c) => !c.unitId || c.unitId === unitId
    );
    map.set(partitionKey(unitId, "calendar", ""), {
      scope: unitId,
      kind: "calendar",
      period: "",
      data: {
        marketCalendarDays: unitCalendar,
      },
    });

    const unitRuleAssignments = (db.ruleAssignments || []).filter((ra) => {
      if (ra.unitId) return ra.unitId === unitId;
      return unitEmpIds.has(ra.employeeId);
    });
    map.set(partitionKey(unitId, "rule_assignments", ""), {
      scope: unitId,
      kind: "rule_assignments",
      period: "",
      data: {
        ruleAssignments: unitRuleAssignments,
      },
    });
  }

  // 4. Partições mensais de escala: (unitId, 'schedule', YYYY-MM)
  const months = new Set(Object.keys(db.dailyEntriesByMonth || {}));
  for (const ms of db.monthlySchedules || []) {
    if (ms?.yearMonth) months.add(ms.yearMonth);
  }
  for (const cs of db.cycleStates || []) {
    if (cs?.yearMonth) months.add(cs.yearMonth);
  }

  for (const ym of Array.from(months).sort()) {
    if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(ym)) continue;
    const monthEntries = (db.dailyEntriesByMonth || {})[ym] || [];
    const monthHeaders = (db.monthlySchedules || []).filter((ms) => ms.yearMonth === ym);
    const monthCycles = (db.cycleStates || []).filter((cs) => cs.yearMonth === ym);

    // Determina quais unidades possuem dados nesta competência
    const activeUnitsInMonth = new Set();
    for (const ms of monthHeaders) {
      if (ms.unitId) activeUnitsInMonth.add(ms.unitId);
    }
    for (const en of monthEntries) {
      const u =
        en.unitId ||
        employeesById.get(en.employeeId)?.homeUnitId ||
        fallbackUnitId;
      activeUnitsInMonth.add(u);
    }
    for (const cs of monthCycles) {
      const u = employeesById.get(cs.employeeId)?.homeUnitId || fallbackUnitId;
      activeUnitsInMonth.add(u);
    }

    for (const unitId of Array.from(activeUnitsInMonth).sort()) {
      const header =
        monthHeaders.find((ms) => (ms.unitId || fallbackUnitId) === unitId) || null;
      const entries = monthEntries.filter((en) => {
        const u =
          en.unitId ||
          employeesById.get(en.employeeId)?.homeUnitId ||
          fallbackUnitId;
        return u === unitId;
      });
      const unitEmpIds = new Set(
        (map.get(partitionKey(unitId, "employees", ""))?.data?.employees || []).map((e) => e.id)
      );
      const cycleStates = monthCycles.filter(
        (cs) =>
          unitEmpIds.has(cs.employeeId) ||
          (employeesById.get(cs.employeeId)?.homeUnitId || fallbackUnitId) === unitId
      );

      if (header || entries.length > 0 || cycleStates.length > 0) {
        map.set(partitionKey(unitId, "schedule", ym), {
          scope: unitId,
          kind: "schedule",
          period: ym,
          data: {
            monthlySchedule: header,
            entries,
            cycleStates,
          },
        });
      }
    }
  }

  return map;
}

function dedupeById(items, keyFn = (x) => x?.id) {
  const map = new Map();
  for (const item of items) {
    if (!item) continue;
    const k = keyFn(item);
    if (!k) continue;
    // Se for colaborador espelhado em múltiplas unidades, preserva o registro mais recente ou de homeUnit
    if (!map.has(k)) {
      map.set(k, item);
    } else {
      const prev = map.get(k);
      if (item.updatedAt && (!prev.updatedAt || item.updatedAt > prev.updatedAt)) {
        map.set(k, item);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Reconstrói o objeto `db` consolidado a partir das linhas retornadas por `public.erp_partitions`.
 * @param {Array<{scope:string, kind:string, period:string, data:object, revision?:number}>} rows
 * @returns {{ db: object, revisionsByKey: Map<string, number> }}
 */
export function assembleDatabaseFromPartitions(rows = []) {
  const revisionsByKey = new Map();
  const db = {
    version: "9.0.0-ERP",
    schemaRevision: 1,
    companies: [],
    units: [],
    sectors: [],
    unitSectors: [],
    functionalCategories: [],
    roles: [],
    workShifts: [],
    scheduleRules: [],
    ruleAssignments: [],
    workPositions: [],
    employees: [],
    allocations: [],
    unavailabilityEvents: [],
    marketCalendarDays: [],
    monthlySchedules: [],
    dailyEntriesByMonth: {},
    cycleStates: [],
    deletedEntityIds: [],
    userProfiles: [],
    auditLogs: [],
  };

  let maxRev = 1;
  const rawPositions = [];
  const rawUnitSectors = [];
  const rawEmployees = [];
  const rawAllocations = [];
  const rawUnavailability = [];
  const rawCalendar = [];
  const rawRuleAssignments = [];
  const rawMonthlySchedules = [];
  const rawCycleStates = [];

  // Ordena por escopo/tipo/período para montagem determinística
  const sorted = [...rows].sort((a, b) =>
    partitionKey(a.scope, a.kind, a.period).localeCompare(partitionKey(b.scope, b.kind, b.period))
  );

  for (const row of sorted) {
    const key = partitionKey(row.scope, row.kind, row.period);
    const rev = Number(row.revision || 1);
    revisionsByKey.set(key, rev);
    if (rev > maxRev) maxRev = rev;

    const d = row.data || {};
    if (row.scope === "GLOBAL" && row.kind === "structure") {
      db.companies = d.companies || [];
      db.units = d.units || [];
      db.sectors = d.sectors || [];
      db.functionalCategories = d.functionalCategories || [];
      db.roles = d.roles || [];
      db.deletedEntityIds = d.deletedEntityIds || [];
    } else if (row.scope === "GLOBAL" && row.kind === "rules") {
      db.workShifts = d.workShifts || [];
      db.scheduleRules = d.scheduleRules || [];
    } else if (row.kind === "positions") {
      rawPositions.push(...(d.workPositions || []));
      rawUnitSectors.push(...(d.unitSectors || []));
    } else if (row.kind === "employees") {
      rawEmployees.push(...(d.employees || []));
      rawAllocations.push(...(d.allocations || []));
    } else if (row.kind === "availability") {
      rawUnavailability.push(...(d.unavailabilityEvents || []));
    } else if (row.kind === "calendar") {
      rawCalendar.push(...(d.marketCalendarDays || []));
    } else if (row.kind === "rule_assignments") {
      rawRuleAssignments.push(...(d.ruleAssignments || []));
    } else if (row.kind === "schedule" && row.period) {
      if (d.monthlySchedule) rawMonthlySchedules.push(d.monthlySchedule);
      if (!db.dailyEntriesByMonth[row.period]) db.dailyEntriesByMonth[row.period] = [];
      db.dailyEntriesByMonth[row.period].push(...(d.entries || []));
      rawCycleStates.push(...(d.cycleStates || []));
    }
  }

  db.schemaRevision = maxRev;
  db.workPositions = dedupeById(rawPositions);
  db.unitSectors = dedupeById(rawUnitSectors, (x) => x.id || `${x.unitId}_${x.sectorId}`);
  db.employees = dedupeById(rawEmployees);
  db.allocations = dedupeById(rawAllocations);
  db.unavailabilityEvents = dedupeById(rawUnavailability);
  db.marketCalendarDays = dedupeById(rawCalendar, (x) => x.id || `${x.unitId || "GLOBAL"}_${x.calendarDate}`);
  db.ruleAssignments = dedupeById(
    rawRuleAssignments,
    (x) => x.id || `${x.employeeId}_${x.ruleId}_${x.effectiveFrom}`
  );
  db.monthlySchedules = dedupeById(rawMonthlySchedules, (x) => x.id || `${x.unitId}_${x.yearMonth}`);
  db.cycleStates = dedupeById(rawCycleStates, (x) => x.id || `${x.employeeId}_${x.yearMonth}`);

  // Deduplica lançamentos diários por (unitId, employeeId, workDate)
  for (const ym of Object.keys(db.dailyEntriesByMonth)) {
    db.dailyEntriesByMonth[ym] = dedupeById(
      db.dailyEntriesByMonth[ym],
      (e) => e.id || `${e.unitId || ""}_${e.employeeId}_${e.workDate}`
    );
  }

  return { db, revisionsByKey };
}

/**
 * Compara o estado anterior e o novo de partições e devolve apenas as partições alteradas,
 * já no formato esperado pela RPC `public.erp_save_batch`.
 */
export function diffChangedPartitions(prevPartitionsMap, nextPartitionsMap, revisionsByKey) {
  const writes = [];
  for (const [key, nextPart] of nextPartitionsMap.entries()) {
    const prevPart = prevPartitionsMap.get(key);
    const nextJson = JSON.stringify(nextPart.data);
    const prevJson = prevPart ? JSON.stringify(prevPart.data) : null;
    if (nextJson !== prevJson) {
      writes.push({
        scope: nextPart.scope,
        kind: nextPart.kind,
        period: nextPart.period || "",
        expected_revision: revisionsByKey.get(key) ?? 0,
        data: nextPart.data,
      });
    }
  }
  return writes;
}

/**
 * Verifica integridade matemática da conversão `db -> partitions -> reassembled` sem perda de registros.
 */
export function verifyPartitionRoundtrip(originalDb, partitionsMap) {
  const rows = Array.from(partitionsMap.values()).map((p) => ({ ...p, revision: 1 }));
  const { db: rebuilt } = assembleDatabaseFromPartitions(rows);

  const checks = [
    ["companies", (originalDb.companies || []).length, rebuilt.companies.length],
    ["units", (originalDb.units || []).length, rebuilt.units.length],
    ["sectors", (originalDb.sectors || []).length, rebuilt.sectors.length],
    ["roles", (originalDb.roles || []).length, rebuilt.roles.length],
    ["workShifts", (originalDb.workShifts || []).length, rebuilt.workShifts.length],
    ["scheduleRules", (originalDb.scheduleRules || []).length, rebuilt.scheduleRules.length],
    ["workPositions", (originalDb.workPositions || []).length, rebuilt.workPositions.length],
    ["employees", (originalDb.employees || []).length, rebuilt.employees.length],
    ["allocations", (originalDb.allocations || []).length, rebuilt.allocations.length],
    ["unavailabilityEvents", (originalDb.unavailabilityEvents || []).length, rebuilt.unavailabilityEvents.length],
    ["marketCalendarDays", (originalDb.marketCalendarDays || []).length, rebuilt.marketCalendarDays.length],
    ["monthlySchedules", (originalDb.monthlySchedules || []).length, rebuilt.monthlySchedules.length],
    ["cycleStates", (originalDb.cycleStates || []).length, rebuilt.cycleStates.length],
  ];

  for (const [ym, entries] of Object.entries(originalDb.dailyEntriesByMonth || {})) {
    checks.push([
      `dailyEntries[${ym}]`,
      (entries || []).length,
      (rebuilt.dailyEntriesByMonth[ym] || []).length,
    ]);
  }

  const mismatches = checks
    .filter(([, expected, actual]) => expected !== actual)
    .map(([name, expected, actual]) => ({ name, expected, actual }));

  return {
    ok: mismatches.length === 0,
    partitionCount: partitionsMap.size,
    checks: Object.fromEntries(checks.map(([n, e, a]) => [n, { expected: e, actual: a }])),
    mismatches,
  };
}
