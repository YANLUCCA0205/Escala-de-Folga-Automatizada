// =============================================================================
// CAMADA DE DOMÍNIO PURA — MOTOR DE ESCALAS, CONTINUIDADE TEMPORAL, JORNADAS,
// VALIDAÇÃO EM 10 NÍVEIS, RATEIO MULTIUNIDADE E INTELIGÊNCIA ANALÍTICA (v8.0)
// 100% determinístico, sem dependência de UI/React, testável via Node Test Runner
// =============================================================================

export const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_SEMANA_CODIGO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
export const DOW_POR_CODIGO = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6, SÁB: 6 };

export const FAIXAS_ALMOCO_DOMINGO = {
  "1": { codigo: "N 01", horario: "09:00 às 10:00", curto: "1 (09h-10h)" },
  "2": { codigo: "N 02", horario: "10:00 às 11:00", curto: "2 (10h-11h)" },
  "3": { codigo: "N 03", horario: "11:00 às 12:00", curto: "3 (11h-12h)" },
  "4": { codigo: "N 04", horario: "12:00 às 13:00", curto: "4 (12h-13h)" },
};

export const STATUS_CELULA_META = {
  T:        { code: "T", label: "Trabalhando (T)", shortLabel: "T", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  F:        { code: "F", label: "Folga Normal (F)", shortLabel: "F", bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  A:        { code: "A", label: "Folga Adicional (A)", shortLabel: "A", bg: "#ede9fe", color: "#6d28d9", border: "#c4b5fd" },
  MEIO_EXP: { code: "MEIO_EXP", label: "Meio Expediente (1/2)", shortLabel: "1/2", bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
  FECHADO:  { code: "FECHADO", label: "Mercado Fechado", shortLabel: "FECH", bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  V:        { code: "V", label: "Férias (FÉRIAS)", shortLabel: "FÉR", bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" },
  LM:       { code: "LM", label: "Licença Maternidade (LM)", shortLabel: "LM", bg: "#fce7f3", color: "#be185d", border: "#fbcfe8" },
  INSS:     { code: "INSS", label: "Afastamento INSS", shortLabel: "INSS", bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff" },
  ADM:      { code: "ADM", label: "Pré-Admissão", shortLabel: "ADM", bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
  DEM:      { code: "DEM", label: "Desligado / Pós-Aviso", shortLabel: "DEM", bg: "#f1f5f9", color: "#94a3b8", border: "#e2e8f0" },
  EMPTY:    { code: "EMPTY", label: "Célula Vazia (Pendente)", shortLabel: "—", bg: "#ffffff", color: "#94a3b8", border: "#cbd5e1" },
};

export const STATUS_VAGA_META = {
  FILLED:          { label: "Preenchida", cor: "#166534", bg: "#dcfce7" },
  OPEN_AUTHORIZED: { label: "Vaga Aberta (Autorizada)", cor: "#1d4ed8", bg: "#dbeafe" },
  OPEN_UNPLANNED:  { label: "Vaga Não Preenchida", cor: "#b45309", bg: "#fef3c7" },
  FROZEN:          { label: "Vaga Congelada", cor: "#4b5563", bg: "#f3f4f6" },
  DEACTIVATED:     { label: "Desativada (Histórico)", cor: "#991b1b", bg: "#fee2e2" },
};

export const ABERTURA_MERCADO_META = {
  FULL_DAY: { label: "Dia Inteiro (Normal)", badge: "100%", cor: "#166534", bg: "#dcfce7" },
  HALF_DAY: { label: "Meio Dia (Meio Expediente)", badge: "Meio Dia", cor: "#b45309", bg: "#fef3c7" },
  CLOSED:   { label: "Fechado (Não Abre)", badge: "Fechado", cor: "#991b1b", bg: "#fee2e2" },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. UTILITÁRIOS DE DATA E HORÁRIO DETERMINÍSTICOS (ISO YYYY-MM-DD e HH:MM)
// ─────────────────────────────────────────────────────────────────────────────
export function parseISODate(isoStr) {
  const [y, m, d] = String(isoStr).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function toISODate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

export function addDaysISO(isoStr, days) {
  const dt = parseISODate(isoStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODate(dt);
}

export function diffDaysISO(isoA, isoB) {
  const a = parseISODate(isoA).getTime();
  const b = parseISODate(isoB).getTime();
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

export function getDayOfWeekISO(isoStr) {
  return parseISODate(isoStr).getUTCDay(); // 0=Dom .. 6=Sab
}

export function getDaysInYearMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function listDatesInYearMonth(yearMonth) {
  const total = getDaysInYearMonth(yearMonth);
  const list = [];
  for (let d = 1; d <= total; d++) {
    list.push(`${yearMonth}-${String(d).padStart(2, "0")}`);
  }
  return list;
}

export function listDatesBetweenISO(startDateISO, endDateISO) {
  if (!startDateISO || !endDateISO || startDateISO > endDateISO) return [];
  const list = [];
  let cur = startDateISO;
  let guard = 0;
  while (cur <= endDateISO && guard < 3660) {
    list.push(cur);
    cur = addDaysISO(cur, 1);
    guard += 1;
  }
  return list;
}

export function getPreviousYearMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function getNextYearMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.trim().split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes) {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.1 MOTOR ARITMÉTICO DE JORNADAS (7/8 COLUNAS DE HORÁRIO + INTRA/INTERJORNADA)
// ─────────────────────────────────────────────────────────────────────────────
export function computeBaseWorkload(entryTime, breakStart, breakEnd, exitBaseTime) {
  const entryMinutes = parseTimeToMinutes(entryTime || "00:00");
  const breakStartMinutes = parseTimeToMinutes(breakStart || "00:00");
  const breakEndMinutes = parseTimeToMinutes(breakEnd || "00:00");
  const exitBaseMinutes = parseTimeToMinutes(exitBaseTime || "00:00");

  const rawBreakDuration =
    breakEndMinutes >= breakStartMinutes
      ? breakEndMinutes - breakStartMinutes
      : 24 * 60 - breakStartMinutes + breakEndMinutes;
  const rawSpanBase =
    exitBaseMinutes >= entryMinutes
      ? exitBaseMinutes - entryMinutes
      : 24 * 60 - entryMinutes + exitBaseMinutes;

  const isInvertedBreak =
    breakEndMinutes < breakStartMinutes && rawBreakDuration >= rawSpanBase;
  const breakDurationMinutes = isInvertedBreak ? 0 : rawBreakDuration;
  const minutes = Math.max(0, rawSpanBase - breakDurationMinutes);

  return {
    minutes,
    formatted: formatMinutesToTime(minutes),
    breakDurationMinutes,
    rawSpanBase,
    isInvertedBreak,
  };
}

export function calculateShiftMetrics(shift) {
  if (!shift) {
    return {
      valid: false,
      derivedBaseMinutes: 0,
      derivedExtensionMinutes: 0,
      derivedTotalEffectiveMinutes: 0,
      warnings: ["Turno não informado."],
    };
  }

  const entryMinutes = parseTimeToMinutes(shift.entryTime || "08:00");
  const breakStartMinutes = parseTimeToMinutes(shift.breakStart || "12:00");
  const breakEndMinutes = parseTimeToMinutes(shift.breakEnd || "14:00");
  const exitBaseMinutes = parseTimeToMinutes(shift.exitBaseTime || "18:00");
  const effectiveExitMinutes = parseTimeToMinutes(
    shift.effectiveExitTime || shift.exitBaseTime || "18:00"
  );

  const baseCalc = computeBaseWorkload(
    shift.entryTime || "08:00",
    shift.breakStart || "12:00",
    shift.breakEnd || "14:00",
    shift.exitBaseTime || "18:00"
  );
  const declaredBaseMinutes = parseTimeToMinutes(shift.baseWorkload || baseCalc.formatted || "07:20");
  const declaredExtensionMinutes = parseTimeToMinutes(shift.extensionWorkload || "00:00");
  const declaredContractMinutes = parseTimeToMinutes(
    shift.contractDailyWorkload || shift.baseWorkload || baseCalc.formatted || "07:20"
  );

  const { breakDurationMinutes, rawSpanBase, isInvertedBreak, minutes: derivedBaseMinutes } = baseCalc;
  const derivedExtensionMinutes =
    effectiveExitMinutes >= exitBaseMinutes
      ? effectiveExitMinutes - exitBaseMinutes
      : 24 * 60 - exitBaseMinutes + effectiveExitMinutes;
  const derivedTotalEffectiveMinutes = derivedBaseMinutes + derivedExtensionMinutes;

  const hasBaseWorkloadDivergence = Math.abs(derivedBaseMinutes - declaredBaseMinutes) > 1;
  const hasContractDivergence = Math.abs(derivedBaseMinutes - declaredContractMinutes) > 1;
  const hasExtensionDivergence = Math.abs(derivedExtensionMinutes - declaredExtensionMinutes) > 1;

  const warnings = [];
  if (isInvertedBreak || (breakEndMinutes === breakStartMinutes && rawSpanBase > 360)) {
    warnings.push("Fim do intervalo deve ser posterior ao início do intervalo.");
  }
  if (derivedBaseMinutes > 360 && breakDurationMinutes < 60) {
    warnings.push(
      `Intervalo intrajornada (${formatMinutesToTime(breakDurationMinutes)}) inferior a 01:00 para jornada acima de 6h.`
    );
  }
  if (breakDurationMinutes > 120) {
    warnings.push(
      `Intervalo intrajornada (${formatMinutesToTime(breakDurationMinutes)}) superior a 02:00 (requer acordo escrito).`
    );
  }
  if (hasBaseWorkloadDivergence) {
    warnings.push(
      `Divergência na Carga Base: calculada ${formatMinutesToTime(derivedBaseMinutes)} vs declarada ${shift.baseWorkload}.`
    );
  }
  if (hasContractDivergence) {
    warnings.push(
      `Divergência na Carga Contratual: base ${formatMinutesToTime(derivedBaseMinutes)} vs contratual ${shift.contractDailyWorkload}.`
    );
  }
  if (hasExtensionDivergence) {
    warnings.push(
      `Divergência no Complemento: calculado ${formatMinutesToTime(derivedExtensionMinutes)} (Saída ${shift.exitBaseTime} → ${shift.effectiveExitTime}) vs declarado ${shift.extensionWorkload}.`
    );
  }

  return {
    valid: warnings.length === 0,
    entryMinutes,
    breakStartMinutes,
    breakEndMinutes,
    breakDurationMinutes,
    breakDurationFormatted: formatMinutesToTime(breakDurationMinutes),
    exitBaseMinutes,
    effectiveExitMinutes,
    derivedBaseMinutes,
    derivedBaseFormatted: formatMinutesToTime(derivedBaseMinutes),
    derivedExtensionMinutes,
    derivedExtensionFormatted: formatMinutesToTime(derivedExtensionMinutes),
    derivedTotalEffectiveMinutes,
    derivedTotalEffectiveFormatted: formatMinutesToTime(derivedTotalEffectiveMinutes),
    declaredBaseMinutes,
    declaredExtensionMinutes,
    declaredContractMinutes,
    hasBaseWorkloadDivergence,
    hasContractDivergence,
    hasExtensionDivergence,
    warnings,
  };
}

export function checkInterjornadaRest({
  prevShift,
  prevStatus,
  currShift,
  currStatus,
  prevHalfDayClosingTime = "13:00",
}) {
  const prevWorked = prevStatus === "T" || prevStatus === "MEIO_EXP";
  const currWorked = currStatus === "T" || currStatus === "MEIO_EXP";
  if (!prevWorked || !currWorked || !prevShift || !currShift) {
    return { violated: false, restMinutes: null, minRequiredMinutes: 660 };
  }

  const prevExitStr =
    prevStatus === "MEIO_EXP"
      ? prevHalfDayClosingTime || "13:00"
      : prevShift.effectiveExitTime || prevShift.exitBaseTime || "18:00";
  const currEntryStr = currShift.entryTime || "08:00";

  const prevEntryMinutes = parseTimeToMinutes(prevShift.entryTime || "08:00");
  const prevExitMinutes = parseTimeToMinutes(prevExitStr);
  const currEntryMinutes = parseTimeToMinutes(currEntryStr);
  const prevCrossedMidnight = prevStatus !== "MEIO_EXP" && prevExitMinutes < prevEntryMinutes;
  const restMinutes = prevCrossedMidnight
    ? Math.max(0, currEntryMinutes - prevExitMinutes)
    : 24 * 60 - prevExitMinutes + currEntryMinutes;
  const minRequiredMinutes = 11 * 60; // 11h CLT Art. 66

  return {
    violated: restMinutes < minRequiredMinutes,
    restMinutes,
    restFormatted: formatMinutesToTime(restMinutes),
    minRequiredMinutes,
    prevExitTime: prevExitStr,
    currEntryTime: currEntryStr,
  };
}

export function calculateEmployeeMonthlyWorkload({
  employeeEntries = [],
  allocations = [],
  shiftsById = {},
  marketCalendarByDate = {},
}) {
  let fullDaysCount = 0;
  let halfDaysCount = 0;
  let restDaysCount = 0;
  let absenceOrVacationDaysCount = 0;
  let totalContractMinutes = 0;
  let totalExtensionMinutes = 0;
  let totalEffectiveMinutes = 0;
  let totalHalfDayMinutes = 0;

  for (const entry of employeeEntries) {
    const st = entry.status;
    if (st === "F" || st === "A" || st === "FECHADO") {
      restDaysCount += 1;
      continue;
    }
    if (st === "V" || st === "LM" || st === "INSS") {
      absenceOrVacationDaysCount += 1;
      continue;
    }
    if (st !== "T" && st !== "MEIO_EXP") continue;

    const alloc = getActiveAllocationOnDate(allocations, entry.employeeId, entry.workDate);
    const shift = alloc ? shiftsById[alloc.workShiftId] : null;
    const metrics = calculateShiftMetrics(shift);

    if (st === "T") {
      fullDaysCount += 1;
      const contractMin = metrics.declaredContractMinutes || metrics.derivedBaseMinutes || 440;
      const extMin = metrics.derivedExtensionMinutes || 0;
      totalContractMinutes += contractMin;
      totalExtensionMinutes += extMin;
      totalEffectiveMinutes += contractMin + extMin;
    } else if (st === "MEIO_EXP") {
      halfDaysCount += 1;
      const marketDay = marketCalendarByDate[entry.workDate];
      const closingTime = marketDay?.halfDayClosingTime || "13:00";
      const entryMin = shift ? parseTimeToMinutes(shift.entryTime) : 420;
      const closeMin = parseTimeToMinutes(closingTime);
      const halfSpan = Math.max(180, closeMin - entryMin);
      totalHalfDayMinutes += halfSpan;
      totalContractMinutes += halfSpan;
      totalEffectiveMinutes += halfSpan;
    }
  }

  return {
    workedDaysCount: fullDaysCount + halfDaysCount,
    fullDaysCount,
    halfDaysCount,
    restDaysCount,
    absenceOrVacationDaysCount,
    totalContractMinutes,
    totalContractFormatted: formatMinutesToTime(totalContractMinutes),
    totalExtensionMinutes,
    totalExtensionFormatted: formatMinutesToTime(totalExtensionMinutes),
    totalHalfDayMinutes,
    totalHalfDayFormatted: formatMinutesToTime(totalHalfDayMinutes),
    totalEffectiveMinutes,
    totalEffectiveFormatted: formatMinutesToTime(totalEffectiveMinutes),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CRIAÇÃO AUTOMÁTICA DE POSTOS DE TRABALHO SEQUENCIAIS (Módulo B / Seção 5)
// ─────────────────────────────────────────────────────────────────────────────
export function createSequentialPositions({
  unitId,
  sectorId,
  role,
  quantity,
  startNumber = 1,
  defaultShiftId = null,
  defaultRuleId = null,
  isSharedRateio = false,
  initialStatus = "OPEN_AUTHORIZED",
  estimatedMonthlyCost = null,
}) {
  const created = [];
  for (let i = 0; i < quantity; i++) {
    const seqNum = startNumber + i;
    const padNum = String(seqNum).padStart(2, "0");
    const posId = `pos_${unitId}_${role.code}_${padNum}_${Date.now()}_${i}`;
    created.push({
      id: posId,
      unitId,
      sectorId,
      roleId: role.id,
      defaultShiftId,
      defaultRuleId,
      positionNumber: isSharedRateio ? null : seqNum,
      code: isSharedRateio ? "RATEIO" : padNum,
      title: quantity === 1 && isSharedRateio ? role.name : `${role.name} ${padNum}`,
      isSharedRateio: Boolean(isSharedRateio),
      status: initialStatus,
      estimatedMonthlyCost: estimatedMonthlyCost ?? role.projectedMonthlyCost ?? null,
      authorizedBudget: estimatedMonthlyCost ?? role.projectedMonthlyCost ?? null,
      notes: "",
    });
  }
  return created;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESOLUÇÃO TEMPORAL DE ALOCAÇÕES, REGRAS E STATUS DINÂMICO (Módulos C e D)
// ─────────────────────────────────────────────────────────────────────────────
export function getActiveAllocationOnDate(allocations, employeeId, isoDate, unitId = null) {
  const empAllocs = (allocations || []).filter(
    (a) => a.employeeId === employeeId && (!unitId || a.unitId === unitId)
  );
  return (
    empAllocs.find(
      (a) => a.startDate <= isoDate && (!a.endDate || a.endDate >= isoDate)
    ) || null
  );
}

export function getEffectiveRuleForDate({
  employeeId,
  isoDate,
  allocations,
  ruleAssignments = [],
  rulesById,
}) {
  // 1. Verifica se há mudança explícita de regra com vigência temporal (Cenário 3)
  const override = (ruleAssignments || [])
    .filter((ra) => ra.employeeId === employeeId)
    .find((ra) => ra.effectiveFrom <= isoDate && (!ra.effectiveTo || ra.effectiveTo >= isoDate));
  if (override && rulesById[override.ruleId]) {
    return rulesById[override.ruleId];
  }

  // 2. Caso contrário, usa a regra vinculada à alocação funcional ativa naquela data
  const alloc = getActiveAllocationOnDate(allocations, employeeId, isoDate);
  if (alloc && rulesById[alloc.scheduleRuleId]) {
    return rulesById[alloc.scheduleRuleId];
  }

  return null;
}

export function getUnavailabilityOnDate(unavailabilityEvents, employeeId, isoDate) {
  return (
    (unavailabilityEvents || []).find(
      (ev) =>
        ev.employeeId === employeeId &&
        ev.startDate <= isoDate &&
        ev.endDate >= isoDate
    ) || null
  );
}

export function computeDynamicEmploymentStatus({
  employee,
  unavailabilityEvents = [],
  referenceDate = "2026-11-01",
}) {
  if (!employee) return "ACTIVE";
  if (employee.terminationDate && referenceDate > employee.terminationDate) {
    return "TERMINATED";
  }
  if (employee.noticePeriodEndDate && referenceDate > employee.noticePeriodEndDate) {
    return "TERMINATED";
  }
  const activeEvents = (unavailabilityEvents || []).filter(
    (ev) =>
      ev.employeeId === employee.id &&
      ev.startDate <= referenceDate &&
      ev.endDate >= referenceDate
  );
  if (activeEvents.some((ev) => ev.eventType === "MEDICAL_LEAVE")) return "MEDICAL_LEAVE";
  if (activeEvents.some((ev) => ev.eventType === "MATERNITY_LEAVE")) return "MATERNITY_LEAVE";
  if (activeEvents.some((ev) => ev.eventType === "VACATION")) return "ON_VACATION";
  if (
    activeEvents.some((ev) => ev.eventType === "NOTICE_PERIOD") ||
    (employee.noticePeriodEndDate && referenceDate <= employee.noticePeriodEndDate)
  ) {
    return "NOTICE_PERIOD";
  }
  return "ACTIVE";
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONSOLIDAÇÃO DO ESTADO DO CICLO AO FIM DE UM PERÍODO (Seção 9 / 13)
// ─────────────────────────────────────────────────────────────────────────────
export function computeCycleStateFromEntries({
  employee,
  entriesUpToDate, // array de { workDate, status, lunchSlot } ordenado por workDate ASC
  lastFlexRotationIndex = 0,
  unavailabilityEvents = [],
}) {
  const sorted = [...(entriesUpToDate || [])].sort((a, b) =>
    a.workDate.localeCompare(b.workDate)
  );
  let lastRestDate = employee?.anchorLastRestDate || null;
  let consecutiveWorkDays = 0;
  let consecutiveRestDays = 0;
  let sundaysWorkedStreak = 0;
  let lastLunchSlot = null;

  for (const entry of sorted) {
    const st = entry.status;
    const dow = getDayOfWeekISO(entry.workDate);

    if (st === "F" || st === "A" || st === "FECHADO") {
      lastRestDate = entry.workDate;
      consecutiveWorkDays = 0;
      consecutiveRestDays += 1;
      if (dow === 0) sundaysWorkedStreak = 0;
    } else if (st === "T" || st === "MEIO_EXP") {
      consecutiveWorkDays += 1;
      consecutiveRestDays = 0;
      if (dow === 0) sundaysWorkedStreak += 1;
      if (entry.lunchSlot) lastLunchSlot = entry.lunchSlot;
    } else if (st === "V" || st === "LM" || st === "INSS") {
      const unav = getUnavailabilityOnDate(unavailabilityEvents, employee?.id, entry.workDate);
      if (unav?.cycleBehavior === "PRESERVE_PHASE") {
        // Preserva consecutiveWorkDays anterior ao afastamento
        consecutiveRestDays = 0;
      } else {
        lastRestDate = entry.workDate;
        consecutiveWorkDays = 0;
        consecutiveRestDays = 0;
      }
      if (dow === 0) sundaysWorkedStreak = 0;
    } else if (st === "ADM" || st === "DEM") {
      consecutiveWorkDays = 0;
      consecutiveRestDays = 0;
    }
  }

  return {
    employeeId: employee.id,
    lastRestDate,
    consecutiveWorkDays,
    consecutiveRestDays,
    flexRotationIndex: lastFlexRotationIndex,
    sundaysWorkedStreak,
    lastLunchSlot,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.1 REGRAS PADRÃO 5X2, NORMALIZAÇÃO E VALIDAÇÃO DE CONFIGURAÇÃO DE REGRAS
// ─────────────────────────────────────────────────────────────────────────────
export const STANDARD_5X2_SCHEDULE_RULES = [
  {
    id: "RULE_5X2_DOM_SAB_TER",
    code: "5X2 DOM SAB TER",
    name: "5x2 Dom / Sáb / Ter (Domingo fixo)",
    description: "5 dias de trabalho, 2 dias de descanso (Domingo fixo + Sábado ou Terça-feira), máximo 5 dias consecutivos.",
    ruleType: "5X2",
    workDaysInCycle: 5,
    restDaysInCycle: 2,
    allowedRestDows: [0, 6, 2],
    fixedRestDows: [0],
    fixedWeekdays: false,
    maxConsecutiveWorkDays: 5,
    requiresSundayLunchSlot: false,
    closedMarketCountsAsRest: true,
    effectiveFrom: "2026-01-01",
  },
  {
    id: "RULE_5X2_DOM_SAB",
    code: "5X2 DOM SAB",
    name: "5x2 Dom / Sáb (Fixos)",
    description: "5 dias de trabalho, 2 dias de descanso fixos no Sábado e Domingo, máximo 5 dias consecutivos.",
    ruleType: "5X2",
    workDaysInCycle: 5,
    restDaysInCycle: 2,
    allowedRestDows: [0, 6],
    fixedRestDows: [0, 6],
    fixedWeekdays: true,
    maxConsecutiveWorkDays: 5,
    requiresSundayLunchSlot: false,
    closedMarketCountsAsRest: true,
    effectiveFrom: "2026-01-01",
  },
  {
    id: "RULE_5X2_DOM_TER_QUA_QUI",
    code: "5X2 DOM TER QUA QUI",
    name: "5x2 Dom / Ter / Qua / Qui (Domingo fixo)",
    description: "5 dias de trabalho, 2 dias de descanso (Domingo fixo + Terça, Quarta ou Quinta-feira), máximo 5 dias consecutivos.",
    ruleType: "5X2",
    workDaysInCycle: 5,
    restDaysInCycle: 2,
    allowedRestDows: [0, 2, 3, 4],
    fixedRestDows: [0],
    fixedWeekdays: false,
    maxConsecutiveWorkDays: 5,
    requiresSundayLunchSlot: false,
    closedMarketCountsAsRest: true,
    effectiveFrom: "2026-01-01",
  },
  {
    id: "RULE_5X2_DOM_QUA_SEX",
    code: "5X2 DOM QUARTA SEXTA",
    name: "5x2 Dom / Quarta / Sexta (Domingo fixo)",
    description: "5 dias de trabalho, 2 dias de descanso (Domingo fixo + Quarta ou Sexta-feira), máximo 5 dias consecutivos.",
    ruleType: "5X2",
    workDaysInCycle: 5,
    restDaysInCycle: 2,
    allowedRestDows: [0, 3, 5],
    fixedRestDows: [0],
    fixedWeekdays: false,
    maxConsecutiveWorkDays: 5,
    requiresSundayLunchSlot: false,
    closedMarketCountsAsRest: true,
    effectiveFrom: "2026-01-01",
  },
];

function normalizeRuleCodeKey(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function ensureStandardScheduleRules(scheduleRules = [], deletedEntityIds = []) {
  const existing = Array.isArray(scheduleRules) ? [...scheduleRules] : [];
  const deletedSet = new Set((deletedEntityIds || []).map(String));
  const existingIds = new Set(existing.map((r) => r?.id).filter(Boolean));
  const existingCodes = new Set(existing.map((r) => normalizeRuleCodeKey(r?.code)).filter(Boolean));

  for (const stdRule of STANDARD_5X2_SCHEDULE_RULES) {
    const codeKey = normalizeRuleCodeKey(stdRule.code);
    if (deletedSet.has(stdRule.id) || existingIds.has(stdRule.id) || existingCodes.has(codeKey)) {
      continue;
    }
    existing.push({ ...stdRule });
    existingIds.add(stdRule.id);
    existingCodes.add(codeKey);
  }
  return existing;
}

function dedupeValidDows(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 6 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function normalizeScheduleRule(rule) {
  if (!rule) return null;
  const workDaysInCycle = Math.max(1, Number(rule.workDaysInCycle ?? 5) || 5);
  const restDaysInCycle = Math.max(1, Number(rule.restDaysInCycle ?? 1) || 1);
  const maxConsecutiveWorkDays = Math.max(
    1,
    Number(rule.maxConsecutiveWorkDays ?? (rule.ruleType === "6X1_FLEX" ? 7 : workDaysInCycle)) ||
      workDaysInCycle
  );

  let allowedRestDows = dedupeValidDows(rule.allowedRestDows);
  if (allowedRestDows.length === 0 && rule.ruleType === "6X1_DOM") {
    allowedRestDows = [0];
  } else if (allowedRestDows.length === 0 && rule.ruleType === "5X2" && rule.fixedWeekdays !== false) {
    allowedRestDows = [0, 6];
  }

  let fixedRestDows;
  if (Array.isArray(rule.fixedRestDows)) {
    fixedRestDows = dedupeValidDows(rule.fixedRestDows);
  } else if (rule.ruleType === "6X1_DOM") {
    fixedRestDows = [0];
  } else if (
    rule.ruleType === "5X2" &&
    rule.fixedWeekdays !== false &&
    allowedRestDows.length > 0 &&
    allowedRestDows.length <= restDaysInCycle
  ) {
    fixedRestDows = [...allowedRestDows];
  } else {
    fixedRestDows = [];
  }

  const ruleType =
    rule.ruleType ||
    deriveRuleType({
      workDaysInCycle,
      restDaysInCycle,
      allowedRestDows,
      fixedRestDows,
    });

  return {
    ...rule,
    ruleType,
    workDaysInCycle,
    restDaysInCycle,
    maxConsecutiveWorkDays,
    allowedRestDows,
    fixedRestDows,
  };
}

export function deriveRuleType({
  workDaysInCycle,
  restDaysInCycle,
  allowedRestDows = [],
  fixedRestDows = [],
}) {
  const w = Number(workDaysInCycle) || 0;
  const r = Number(restDaysInCycle) || 0;
  const allowed = dedupeValidDows(allowedRestDows);
  const fixed = dedupeValidDows(fixedRestDows);

  if (w === 5 && r === 1 && allowed.length === 0 && fixed.length === 0) {
    return "5X1";
  }
  if (w === 5 && r === 2) {
    return "5X2";
  }
  if (w === 6 && r === 1) {
    if (
      allowed.length === 1 &&
      allowed[0] === 0 &&
      (fixed.length === 0 || (fixed.length === 1 && fixed[0] === 0))
    ) {
      return "6X1_DOM";
    }
    return "6X1_FLEX";
  }
  return "CUSTOM";
}

function buildDowCombinations(pool, chooseCount) {
  if (chooseCount <= 0) return [[]];
  if (pool.length < chooseCount) return [];
  const results = [];
  const helper = (startIdx, current) => {
    if (current.length === chooseCount) {
      results.push([...current]);
      return;
    }
    for (let i = startIdx; i < pool.length; i++) {
      current.push(pool[i]);
      helper(i + 1, current);
      current.pop();
    }
  };
  helper(0, []);
  return results;
}

export function validateScheduleRuleConfig(rule) {
  const errors = [];
  const w = Number(rule?.workDaysInCycle);
  const r = Number(rule?.restDaysInCycle);
  const maxC = Number(rule?.maxConsecutiveWorkDays);
  const allowed = dedupeValidDows(rule?.allowedRestDows);
  const fixed = dedupeValidDows(rule?.fixedRestDows);

  if (!Number.isFinite(w) || w < 1) {
    errors.push("Informe pelo menos 1 dia de trabalho.");
  }
  if (!Number.isFinite(r) || r < 1) {
    errors.push("Informe pelo menos 1 dia de descanso.");
  }
  if (!Number.isFinite(maxC) || maxC < 1) {
    errors.push("Informe o máximo de dias consecutivos de trabalho.");
  }
  if (Number.isFinite(w) && Number.isFinite(maxC) && maxC < w) {
    errors.push(
      `O máximo de dias consecutivos (${maxC}) não pode ser menor que os dias de trabalho (${w}).`
    );
  }
  if (fixed.some((d) => !allowed.includes(d))) {
    errors.push("Os dias de folga fixa devem fazer parte dos dias da semana permitidos para folga.");
  }
  if (Number.isFinite(r) && fixed.length > r) {
    errors.push(
      `A quantidade de dias de folga fixa (${fixed.length}) não pode ultrapassar os dias de descanso da regra (${r}).`
    );
  }
  if (Number.isFinite(r) && allowed.length > 0 && allowed.length < r) {
    errors.push(
      `Selecione ao menos ${r} dia(s) permitido(s) para folga ou deixe sem dias fixos de semana para ciclo contínuo.`
    );
  }

  if (
    errors.length === 0 &&
    w + r === 7 &&
    allowed.length > 0 &&
    allowed.length >= r &&
    fixed.length <= r
  ) {
    const variablePool = allowed.filter((d) => !fixed.includes(d));
    const combos = buildDowCombinations(variablePool, r - fixed.length);
    const hasFeasibleWeek = combos.some((combo) => {
      const restSet = new Set([...fixed, ...combo]);
      let streak = 0;
      let maxGap = 0;
      for (let i = 0; i < 14; i++) {
        if (restSet.has(i % 7)) {
          streak = 0;
        } else {
          streak += 1;
          if (streak > maxGap) maxGap = streak;
        }
      }
      return maxGap <= maxC;
    });
    if (!hasFeasibleWeek) {
      errors.push(
        `Nenhuma combinação dos dias permitidos respeita o máximo de ${maxC} dias consecutivos de trabalho.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function posMod(n, m) {
  return ((n % m) + m) % m;
}

function solveConstrainedWeeklyRestDows({
  employee,
  weekStartISO,
  currentDateISO,
  firstMonthDateISO,
  lastMonthDateISO,
  consecutiveWorkAtCurrentDate,
  allocations,
  ruleAssignments,
  rulesById,
  unavailabilityEvents,
  marketCalendarByDate,
  existingManualEntriesByDate,
  preserveManualOverrides,
  priorEntriesByDate,
  employeeRotationRank,
  warnings,
}) {
  const weekDates = [0, 1, 2, 3, 4, 5, 6].map((d) => addDaysISO(weekStartISO, d));
  const currentDow = getDayOfWeekISO(currentDateISO);

  // Determina a regra efetiva predominante nesta semana (primeiro dia ativo a partir de currentDateISO)
  let baseRuleRaw = null;
  for (let d = currentDow; d < 7; d++) {
    const dt = weekDates[d];
    if (dt >= firstMonthDateISO && dt <= lastMonthDateISO) {
      const candidateRule = getEffectiveRuleForDate({
        employeeId: employee.id,
        isoDate: dt,
        allocations,
        ruleAssignments,
        rulesById,
      });
      if (candidateRule) {
        baseRuleRaw = candidateRule;
        break;
      }
    }
  }
  const baseRule = normalizeScheduleRule(baseRuleRaw);
  if (!baseRule || baseRule.allowedRestDows.length === 0) {
    return new Set();
  }

  const targetRestCount = baseRule.restDaysInCycle;
  const maxConsec = baseRule.maxConsecutiveWorkDays;

  const dayKinds = [];
  const existingRestDows = [];
  let closedFixedCount = 0;

  for (let d = 0; d < 7; d++) {
    const dt = weekDates[d];
    const dayRule = normalizeScheduleRule(
      getEffectiveRuleForDate({
        employeeId: employee.id,
        isoDate: dt,
        allocations,
        ruleAssignments,
        rulesById,
      }) || baseRule
    );
    const countsClosed = dayRule.closedMarketCountsAsRest !== false;

    if (d < currentDow) {
      const prev = priorEntriesByDate[dt];
      const st = prev?.status;
      if (st === "F" || st === "A") {
        dayKinds[d] = "REST";
        existingRestDows.push(d);
      } else if (st === "FECHADO") {
        dayKinds[d] = countsClosed ? "CLOSED_REST" : "NEUTRAL_PRESERVE";
        if (countsClosed && baseRule.fixedRestDows.includes(d)) closedFixedCount += 1;
      } else if (st === "T" || st === "MEIO_EXP") {
        dayKinds[d] = "WORK";
      } else if (st === "V" || st === "LM" || st === "INSS") {
        const unavPrev = getUnavailabilityOnDate(unavailabilityEvents, employee.id, dt);
        dayKinds[d] =
          unavPrev?.cycleBehavior === "PRESERVE_PHASE" ? "NEUTRAL_PRESERVE" : "NEUTRAL_RESET";
      } else {
        dayKinds[d] = "NEUTRAL_RESET";
      }
      continue;
    }

    if (dt > lastMonthDateISO) {
      dayKinds[d] = "OPEN_FUTURE";
      continue;
    }

    const alloc = getActiveAllocationOnDate(allocations, employee.id, dt);
    if (
      (employee.hireDate && dt < employee.hireDate) ||
      (employee.terminationDate && dt > employee.terminationDate) ||
      (employee.noticePeriodEndDate && dt > employee.noticePeriodEndDate) ||
      !alloc
    ) {
      dayKinds[d] = "NEUTRAL_RESET";
      continue;
    }

    const unav = getUnavailabilityOnDate(unavailabilityEvents, employee.id, dt);
    if (unav && unav.eventType !== "NOTICE_PERIOD") {
      dayKinds[d] =
        unav.cycleBehavior === "PRESERVE_PHASE" ? "NEUTRAL_PRESERVE" : "NEUTRAL_RESET";
      continue;
    }

    const marketDay = marketCalendarByDate[dt];
    if (marketDay && marketDay.openingMode === "CLOSED") {
      dayKinds[d] = countsClosed ? "CLOSED_REST" : "NEUTRAL_PRESERVE";
      if (countsClosed && dayRule.fixedRestDows.includes(d)) {
        closedFixedCount += 1;
      }
      continue;
    }

    const manual = preserveManualOverrides ? existingManualEntriesByDate[dt] : null;
    if (manual && manual.origin === "MANUAL_OVERRIDE") {
      if (manual.status === "F" || manual.status === "A") {
        dayKinds[d] = "REST";
        existingRestDows.push(d);
      } else if (manual.status === "T" || manual.status === "MEIO_EXP") {
        dayKinds[d] = "WORK";
      } else {
        dayKinds[d] = "OPEN";
      }
      continue;
    }

    dayKinds[d] = "OPEN";
  }

  const needed = Math.max(0, targetRestCount - existingRestDows.length - closedFixedCount);
  if (needed === 0) {
    return new Set();
  }

  const openAllowedDows = [];
  const mandatoryOpenFixed = [];

  for (let d = currentDow; d < 7; d++) {
    if (dayKinds[d] !== "OPEN") continue;
    const dt = weekDates[d];
    const dayRule = normalizeScheduleRule(
      getEffectiveRuleForDate({
        employeeId: employee.id,
        isoDate: dt,
        allocations,
        ruleAssignments,
        rulesById,
      }) || baseRule
    );
    if (dayRule.allowedRestDows.includes(d)) {
      openAllowedDows.push(d);
      if (dayRule.fixedRestDows.includes(d)) {
        mandatoryOpenFixed.push(d);
      }
    }
  }

  const openFutureAllowedDows = [];
  for (let d = currentDow; d < 7; d++) {
    if (dayKinds[d] === "OPEN_FUTURE" && baseRule.allowedRestDows.includes(d)) {
      openFutureAllowedDows.push(d);
    }
  }

  const allSimOpenAllowed = [...openAllowedDows, ...openFutureAllowedDows];
  const simMandatoryFixed = [
    ...mandatoryOpenFixed,
    ...openFutureAllowedDows.filter((d) => baseRule.fixedRestDows.includes(d)),
  ];

  let candidateCombos = [];
  if (simMandatoryFixed.length <= needed && allSimOpenAllowed.length >= needed) {
    const varPool = allSimOpenAllowed.filter((d) => !simMandatoryFixed.includes(d));
    const varNeeded = needed - simMandatoryFixed.length;
    candidateCombos = buildDowCombinations(varPool, varNeeded).map((c) => [
      ...simMandatoryFixed,
      ...c,
    ]);
  } else if (openAllowedDows.length > 0 && openAllowedDows.length < needed) {
    if (mandatoryOpenFixed.length > 0) {
      return new Set(mandatoryOpenFixed.slice(0, needed));
    }
  }

  const simulateWeekMaxConsec = (chosenDows) => {
    const chosenSet = new Set(chosenDows);
    let streak = consecutiveWorkAtCurrentDate;
    for (let d = currentDow; d < 7; d++) {
      const kind = dayKinds[d];
      if (
        kind === "REST" ||
        kind === "CLOSED_REST" ||
        kind === "NEUTRAL_RESET" ||
        chosenSet.has(d)
      ) {
        streak = 0;
      } else if (kind === "NEUTRAL_PRESERVE") {
        // mantém streak
      } else {
        streak += 1;
        if (streak > maxConsec) return { ok: false, endStreak: streak };
      }
    }
    return { ok: true, endStreak: streak };
  };

  const nextWeekStart = addDaysISO(weekStartISO, 7);
  const nextWeekRule = normalizeScheduleRule(
    getEffectiveRuleForDate({
      employeeId: employee.id,
      isoDate: nextWeekStart,
      allocations,
      ruleAssignments,
      rulesById,
    }) || baseRule
  );
  const minDaysUntilNextFixed =
    nextWeekRule.fixedRestDows.length > 0 ? Math.min(...nextWeekRule.fixedRestDows) : 0;

  const validWithinWeek = [];
  const validWithRollover = [];
  for (const combo of candidateCombos) {
    const sim = simulateWeekMaxConsec(combo);
    if (!sim.ok) continue;
    validWithinWeek.push(combo);
    if (sim.endStreak + minDaysUntilNextFixed <= maxConsec) {
      validWithRollover.push(combo);
    }
  }

  const poolToPick = validWithRollover.length > 0 ? validWithRollover : validWithinWeek;
  if (poolToPick.length > 0) {
    const weekNumber = Math.floor(diffDaysISO(weekStartISO, "2026-01-04") / 7);
    const picked = poolToPick[posMod((employeeRotationRank || 0) + weekNumber, poolToPick.length)];
    return new Set(picked.filter((d) => openAllowedDows.includes(d)));
  }

  warnings.push({
    type: "NO_VALID_REST_DISTRIBUTION",
    employeeId: employee.id,
    employeeName: employee.fullName,
    workDate: weekStartISO,
    ruleId: baseRule.id,
    message: `Não foi possível distribuir ${targetRestCount} folga(s) nos dias permitidos respeitando o limite de ${maxConsec} dias consecutivos na semana de ${weekStartISO} para ${employee.fullName}.`,
  });

  if (mandatoryOpenFixed.length > 0) {
    return new Set(mandatoryOpenFixed.slice(0, needed));
  }
  return new Set();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MOTOR TEMPORAL DE GERAÇÃO DE ESCALA COM CONTINUIDADE ENTRE MESES
// ─────────────────────────────────────────────────────────────────────────────
export function generateEmployeeScheduleForMonth({
  employee,
  yearMonth,
  allocations,
  ruleAssignments = [],
  rulesById,
  unavailabilityEvents = [],
  marketCalendarByDate = {},
  previousMonthEntries = [],
  previousCycleState = null,
  employeeRotationRank = 0,
  existingManualEntriesByDate = {},
  preserveManualOverrides = true,
  requireExplicitAnchor = false,
}) {
  const dates = listDatesInYearMonth(yearMonth);
  const warnings = [];

  // Determina o estado inicial do ciclo na virada do mês anterior -> mês atual
  let state;
  if (previousMonthEntries && previousMonthEntries.length > 0) {
    state = computeCycleStateFromEntries({
      employee,
      entriesUpToDate: previousMonthEntries,
      lastFlexRotationIndex: previousCycleState?.flexRotationIndex ?? employeeRotationRank,
      unavailabilityEvents,
    });
  } else if (previousCycleState) {
    state = { ...previousCycleState };
  } else if (employee.anchorLastRestDate) {
    const firstDateOfMonth = dates[0];
    const diff = diffDaysISO(firstDateOfMonth, employee.anchorLastRestDate) - 1;
    state = {
      employeeId: employee.id,
      lastRestDate: employee.anchorLastRestDate,
      consecutiveWorkDays: Math.max(0, diff),
      flexRotationIndex: employee.anchorCycleOffset ?? employeeRotationRank,
      sundaysWorkedStreak: 0,
      lastLunchSlot: null,
    };
  } else {
    // Sem histórico anterior e sem âncora explícita: alerta formal de lacuna histórica (Seção 13.4)
    warnings.push({
      type: "MISSING_HISTORICAL_ANCHOR",
      requiresOperatorAction: Boolean(requireExplicitAnchor),
      employeeId: employee.id,
      employeeName: employee.fullName,
      message: `Colaborador ${employee.fullName} não possui escala do mês anterior nem data-âncora de última folga configurada. Defina a data da última folga ou estado inicial antes de publicar.`,
    });
    state = {
      employeeId: employee.id,
      lastRestDate: null,
      consecutiveWorkDays: employeeRotationRank % 5,
      flexRotationIndex: employeeRotationRank,
      sundaysWorkedStreak: 0,
      lastLunchSlot: null,
    };
  }

  let consecutiveWork = state.consecutiveWorkDays;
  let lastRestDate = state.lastRestDate;
  let flexWeekIndex = state.flexRotationIndex ?? employeeRotationRank;
  const firstDayRule = dates[0]
    ? getEffectiveRuleForDate({
        employeeId: employee.id,
        isoDate: dates[0],
        allocations,
        ruleAssignments,
        rulesById,
      })
    : null;
  const targetRestInCycle = firstDayRule?.restDaysInCycle || 1;
  let restDaysRemainingInCycle =
    (state.consecutiveRestDays || 0) > 0 && (state.consecutiveRestDays || 0) < targetRestInCycle
      ? targetRestInCycle - state.consecutiveRestDays
      : 0; // Usado em ciclos 5x2 rotativos

  const firstMonthDateISO = dates[0] || `${yearMonth}-01`;
  const lastMonthDateISO = dates[dates.length - 1] || `${yearMonth}-28`;
  const previousEntriesByDate = Object.fromEntries(
    (previousMonthEntries || []).map((e) => [e.workDate, e])
  );
  const solvedWeekRestDowsByWeekStart = {};
  const generatedEntries = [];

  for (let idx = 0; idx < dates.length; idx++) {
    const isoDate = dates[idx];
    const dow = getDayOfWeekISO(isoDate);
    const alloc = getActiveAllocationOnDate(allocations, employee.id, isoDate);

    // Se o colaborador não possui alocação ativa na data, verifica admissão/demissão
    if (employee.hireDate && isoDate < employee.hireDate) {
      generatedEntries.push({
        employeeId: employee.id,
        workPositionId: alloc?.workPositionId || null,
        unitId: alloc?.unitId || null,
        sectorId: alloc?.sectorId || null,
        workDate: isoDate,
        status: "ADM",
        origin: "AUTO_GENERATED",
        lunchSlot: null,
        ruleId: null,
      });
      consecutiveWork = 0;
      continue;
    }

    if (
      (employee.terminationDate && isoDate > employee.terminationDate) ||
      (employee.noticePeriodEndDate && isoDate > employee.noticePeriodEndDate)
    ) {
      generatedEntries.push({
        employeeId: employee.id,
        workPositionId: alloc?.workPositionId || null,
        unitId: alloc?.unitId || null,
        sectorId: alloc?.sectorId || null,
        workDate: isoDate,
        status: "DEM",
        origin: "AUTO_GENERATED",
        lunchSlot: null,
        ruleId: null,
      });
      consecutiveWork = 0;
      continue;
    }

    if (!alloc) {
      continue;
    }

    const rule = getEffectiveRuleForDate({
      employeeId: employee.id,
      isoDate,
      allocations,
      ruleAssignments,
      rulesById,
    });
    const normRule = normalizeScheduleRule(rule);

    // 1. Verifica eventos de indisponibilidade (Férias, Licença Maternidade, INSS)
    const unav = getUnavailabilityOnDate(unavailabilityEvents, employee.id, isoDate);
    if (unav && unav.eventType !== "NOTICE_PERIOD") {
      const codeMap = {
        VACATION: "V",
        MATERNITY_LEAVE: "LM",
        MEDICAL_LEAVE: "INSS",
      };
      const st = codeMap[unav.eventType] || "V";
      generatedEntries.push({
        employeeId: employee.id,
        workPositionId: alloc.workPositionId,
        unitId: alloc.unitId,
        sectorId: alloc.sectorId,
        workDate: isoDate,
        status: st,
        origin: "AUTO_GENERATED",
        lunchSlot: null,
        ruleId: rule?.id || null,
      });
      if (unav.cycleBehavior === "PRESERVE_PHASE") {
        // Mantém a fase de consecutiveWork intacta durante o afastamento
      } else {
        consecutiveWork = 0;
        restDaysRemainingInCycle = 0;
        lastRestDate = isoDate;
      }
      continue;
    }

    // 2. Verifica Calendário de Abertura do Mercado (Fechamento prevalece sobre lançamentos manuais e folgas)
    const marketDay = marketCalendarByDate[isoDate];
    const manualExisting = existingManualEntriesByDate[isoDate];
    if (marketDay && marketDay.openingMode === "CLOSED") {
      if (
        preserveManualOverrides &&
        manualExisting &&
        manualExisting.origin === "MANUAL_OVERRIDE" &&
        (manualExisting.status === "T" || manualExisting.status === "MEIO_EXP")
      ) {
        warnings.push({
          type: "MANUAL_OVERRIDE_SUPERSEDED_BY_CLOSED_MARKET",
          employeeId: employee.id,
          employeeName: employee.fullName,
          workDate: isoDate,
          message: `Alteração manual de trabalho para ${employee.fullName} em ${isoDate} foi sobreposta porque a loja está configurada como FECHADA no Calendário Operacional.`,
        });
      }
      if (rule?.closedMarketCountsAsRest !== false) {
        consecutiveWork = 0;
        lastRestDate = isoDate;
      }
      generatedEntries.push({
        employeeId: employee.id,
        workPositionId: alloc.workPositionId,
        unitId: alloc.unitId,
        sectorId: alloc.sectorId,
        workDate: isoDate,
        status: "FECHADO",
        origin: "AUTO_GENERATED",
        lunchSlot: null,
        ruleId: rule?.id || null,
      });
      continue;
    }

    // 3. Verifica se existe lançamento manual preservado (Seção 10)
    if (preserveManualOverrides && manualExisting && manualExisting.origin === "MANUAL_OVERRIDE") {
      const st = manualExisting.status;
      if (st === "F" || st === "A" || st === "FECHADO") {
        consecutiveWork = 0;
        lastRestDate = isoDate;
      } else if (st === "T" || st === "MEIO_EXP") {
        consecutiveWork += 1;
      }
      generatedEntries.push({
        ...manualExisting,
        workPositionId: alloc.workPositionId,
        unitId: alloc.unitId,
        sectorId: alloc.sectorId,
        ruleId: rule?.id || manualExisting.ruleId || null,
      });
      continue;
    }

    // 4. Avaliação do Motor de Regras para o dia
    let isRestDay = false;
    const ruleType = normRule?.ruleType || rule?.ruleType || "6X1_DOM";

    if (ruleType === "5X1") {
      const workLimit = normRule?.workDaysInCycle || 5;
      if (employee.anchorLastRestDate && isoDate === employee.anchorLastRestDate) {
        isRestDay = true;
      } else if (consecutiveWork >= workLimit) {
        isRestDay = true;
      }
    } else if (
      ruleType === "5X2" ||
      (ruleType === "CUSTOM" &&
        normRule &&
        normRule.workDaysInCycle + normRule.restDaysInCycle === 7 &&
        normRule.restDaysInCycle >= 2 &&
        normRule.allowedRestDows.length > 0)
    ) {
      const allowedDows = normRule?.allowedRestDows || [];
      if (allowedDows.length > 0) {
        const weekStartISO = addDaysISO(isoDate, -dow);
        if (!solvedWeekRestDowsByWeekStart[weekStartISO]) {
          const priorEntriesByDate = {
            ...previousEntriesByDate,
            ...Object.fromEntries(generatedEntries.map((e) => [e.workDate, e])),
          };
          solvedWeekRestDowsByWeekStart[weekStartISO] = solveConstrainedWeeklyRestDows({
            employee,
            weekStartISO,
            currentDateISO: isoDate,
            firstMonthDateISO,
            lastMonthDateISO,
            consecutiveWorkAtCurrentDate: consecutiveWork,
            allocations,
            ruleAssignments,
            rulesById,
            unavailabilityEvents,
            marketCalendarByDate,
            existingManualEntriesByDate,
            preserveManualOverrides,
            priorEntriesByDate,
            employeeRotationRank,
            warnings,
          });
        }
        isRestDay = solvedWeekRestDowsByWeekStart[weekStartISO].has(dow);
      } else {
        // 5x2 rotativo contínuo sem restrição de dia da semana
        if (restDaysRemainingInCycle > 0) {
          isRestDay = true;
          restDaysRemainingInCycle -= 1;
        } else if (consecutiveWork >= (normRule?.workDaysInCycle || 5)) {
          isRestDay = true;
          restDaysRemainingInCycle = (normRule?.restDaysInCycle || 2) - 1;
        }
      }
    } else if (ruleType === "6X1_DOM") {
      isRestDay = dow === 0;
    } else if (ruleType === "6X1_FLEX") {
      const allowedDows = normRule?.allowedRestDows?.length ? normRule.allowedRestDows : [0, 1];
      const maxConsec = normRule?.maxConsecutiveWorkDays || 7;
      const minWorkBeforeNextRest = Math.max(4, (normRule?.workDaysInCycle || 6) - 1);

      if (allowedDows.includes(dow)) {
        const chosenDow = allowedDows[flexWeekIndex % allowedDows.length];
        if (dow === chosenDow && (!lastRestDate || consecutiveWork >= minWorkBeforeNextRest)) {
          isRestDay = true;
        }
        if (!isRestDay && consecutiveWork >= maxConsec) {
          isRestDay = true;
        }
        if (dow === allowedDows[allowedDows.length - 1]) {
          flexWeekIndex += 1;
        }
      }
      if (!isRestDay && consecutiveWork >= maxConsec) {
        isRestDay = true;
      }
    } else if (ruleType === "CUSTOM" && normRule) {
      if (restDaysRemainingInCycle > 0) {
        isRestDay = true;
        restDaysRemainingInCycle -= 1;
      } else if (consecutiveWork >= normRule.workDaysInCycle) {
        isRestDay = true;
        restDaysRemainingInCycle = Math.max(0, normRule.restDaysInCycle - 1);
      }
    }

    let finalStatus;
    if (isRestDay) {
      finalStatus = "F";
      consecutiveWork = 0;
      lastRestDate = isoDate;
    } else {
      consecutiveWork += 1;
      if (marketDay && marketDay.openingMode === "HALF_DAY") {
        finalStatus = "MEIO_EXP";
      } else {
        finalStatus = "T";
      }
    }

    // 5. Atribuição da Escala de Intervalo de Almoço aos Domingos e Feriados (1 a 4: 09h às 13h)
    let lunchSlot = null;
    const isSundayOrHoliday =
      dow === 0 ||
      (marketDay && ["HOLIDAY", "OPTIONAL_HOLIDAY", "SUNDAY"].includes(marketDay.dayType));

    if (
      (finalStatus === "T" || finalStatus === "MEIO_EXP") &&
      isSundayOrHoliday &&
      (rule?.requiresSundayLunchSlot !== false || marketDay?.requiresLunchScale)
    ) {
      const slotIndex = ((employeeRotationRank + Math.floor(idx / 7)) % 4) + 1;
      lunchSlot = String(slotIndex);
    }

    generatedEntries.push({
      employeeId: employee.id,
      workPositionId: alloc.workPositionId,
      unitId: alloc.unitId,
      sectorId: alloc.sectorId,
      workDate: isoDate,
      status: finalStatus,
      origin: "AUTO_GENERATED",
      lunchSlot,
      ruleId: rule?.id || null,
    });
  }

  const endCycleState = computeCycleStateFromEntries({
    employee,
    entriesUpToDate: [...(previousMonthEntries || []), ...generatedEntries],
    lastFlexRotationIndex: flexWeekIndex,
    unavailabilityEvents,
  });

  return {
    entries: generatedEntries,
    endCycleState,
    warnings,
  };
}

/**
 * Equilibra a distribuição das faixas de almoço aos domingos e feriados (1 a 4)
 * entre os colaboradores que efetivamente trabalham no mesmo (unitId, sectorId, shiftPeriod, workDate).
 */
export function balanceSectorSundayLunchSlots({
  entries = [],
  allocations = [],
  shiftsById = {},
  preserveManual = true,
}) {
  const result = entries.map((e) => ({ ...e }));
  const groups = {};

  for (const entry of result) {
    if ((entry.status !== "T" && entry.status !== "MEIO_EXP") || !entry.lunchSlot) {
      continue;
    }
    const alloc = getActiveAllocationOnDate(allocations, entry.employeeId, entry.workDate);
    const shiftPeriod = (alloc && shiftsById[alloc.workShiftId]?.shiftPeriod) || "INTEGRAL";
    const key = `${entry.unitId || "GLOBAL"}__${entry.sectorId || "SEC"}__${shiftPeriod}__${entry.workDate}`;
    (groups[key] = groups[key] || []).push(entry);
  }

  for (const group of Object.values(groups)) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.employeeId.localeCompare(b.employeeId));

    const slotCounts = { "1": 0, "2": 0, "3": 0, "4": 0 };
    const autoEntries = [];

    for (const entry of group) {
      if (preserveManual && (entry.origin === "MANUAL_OVERRIDE" || entry.origin === "VALIDATED")) {
        if (slotCounts[entry.lunchSlot] !== undefined) {
          slotCounts[entry.lunchSlot] += 1;
        }
      } else {
        autoEntries.push(entry);
      }
    }

    const dayNum = Number(group[0].workDate.slice(8, 10)) || 1;
    const weekOffset = Math.floor((dayNum - 1) / 7);
    const orderedSlots = ["1", "2", "3", "4"].map(
      (_, i) => String(((i + weekOffset) % 4) + 1)
    );

    for (const entry of autoEntries) {
      let bestSlot = orderedSlots[0];
      let bestCount = slotCounts[bestSlot];
      for (const candidate of orderedSlots) {
        if (slotCounts[candidate] < bestCount) {
          bestSlot = candidate;
          bestCount = slotCounts[candidate];
        }
      }
      entry.lunchSlot = bestSlot;
      slotCounts[bestSlot] += 1;
    }
  }

  return result;
}

/**
 * Projeta a data ISO da 1ª folga do colaborador no mês seguinte, utilizando os lançamentos
 * já salvos ou simulando o motor de regras real do colaborador (evitando cálculo fixo 6 - trailingWork).
 */
export function projectNextMonthFirstRestDate({
  employee,
  nextYearMonth,
  nextMonthEntries = [],
  currentMonthEntries = [],
  allocations = [],
  ruleAssignments = [],
  rulesById = {},
  unavailabilityEvents = [],
  marketCalendarByDate = {},
  employeeRotationRank = 0,
}) {
  if (!employee || !nextYearMonth) return null;
  const savedRest = (nextMonthEntries || [])
    .filter((e) => e.employeeId === employee.id && (e.status === "F" || e.status === "A"))
    .sort((a, b) => a.workDate.localeCompare(b.workDate));
  if (savedRest.length > 0) {
    return savedRest[0].workDate;
  }

  const empCur = (currentMonthEntries || [])
    .filter((e) => e.employeeId === employee.id)
    .sort((a, b) => a.workDate.localeCompare(b.workDate));
  if (empCur.length === 0) return null;

  const projected = generateEmployeeScheduleForMonth({
    employee,
    yearMonth: nextYearMonth,
    allocations,
    ruleAssignments,
    rulesById,
    unavailabilityEvents,
    marketCalendarByDate,
    previousMonthEntries: empCur,
    employeeRotationRank,
    preserveManualOverrides: false,
  });

  const firstProjectedRest = projected.entries.find(
    (e) => e.status === "F" || e.status === "A"
  );
  return firstProjectedRest ? firstProjectedRest.workDate : null;
}

/**
 * Verifica se uma tentativa de edição de célula (Popover ou Pincel) é redundante (no-op),
 * evitando empilhar snapshots duplicados no Undo ou disparar mutações desnecessárias.
 */
export function isCellModificationNoOp({
  currentEntry,
  targetStatus = null,
  targetLunchSlot = undefined,
  restoreAuto = false,
  isSundayOrHoliday = false,
}) {
  const curStatus = currentEntry?.status || "T";
  if (["V", "LM", "INSS", "ADM", "DEM"].includes(curStatus)) return true;
  if (restoreAuto) {
    return Boolean(currentEntry && currentEntry.origin === "AUTO_GENERATED");
  }
  const nextStatus = targetStatus !== null ? targetStatus : curStatus;
  let nextLunchSlot =
    targetLunchSlot !== undefined ? targetLunchSlot : currentEntry?.lunchSlot || null;

  if (nextStatus !== "T" && nextStatus !== "MEIO_EXP") {
    nextLunchSlot = null;
  } else if (isSundayOrHoliday && !nextLunchSlot && targetLunchSlot === undefined) {
    nextLunchSlot = currentEntry?.lunchSlot || "1";
  }

  return Boolean(
    currentEntry &&
      curStatus === nextStatus &&
      (currentEntry.lunchSlot || null) === nextLunchSlot
  );
}

/**
 * Valida uma edição manual de célula (edição direta, pincel ou troca bilateral)
 * considerando fechamento de mercado e os dias da semana permitidos na regra vigente da data.
 */
export function validateManualCellEdit({
  employee,
  isoDate,
  targetStatus,
  allocations = [],
  ruleAssignments = [],
  rulesById = {},
  marketCalendarByDate = {},
}) {
  if (!employee || !isoDate) {
    return { allowed: false, code: "INVALID_PARAMS", message: "Dados inválidos para edição." };
  }

  const marketDay = marketCalendarByDate[isoDate];
  if (
    marketDay?.openingMode === "CLOSED" &&
    ["T", "MEIO_EXP", "F", "A"].includes(targetStatus)
  ) {
    return {
      allowed: false,
      code: "CLOSED_MARKET_WORK_BLOCKED",
      message: `Não é permitido alterar manualmente ${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}: o mercado está configurado como FECHADO no Calendário Operacional.`,
    };
  }

  const effectiveRule = getEffectiveRuleForDate({
    employeeId: employee.id,
    isoDate,
    allocations,
    ruleAssignments,
    rulesById,
  });
  const normRule = normalizeScheduleRule(effectiveRule);

  if (targetStatus === "F" && normRule && normRule.allowedRestDows.length > 0) {
    const dow = getDayOfWeekISO(isoDate);
    if (!normRule.allowedRestDows.includes(dow)) {
      const allowedNames = normRule.allowedRestDows
        .map((d) => DIAS_SEMANA_CURTO[d])
        .join(", ");
      return {
        allowed: false,
        code: "DISALLOWED_REST_DAY",
        rule: normRule,
        message: `Folga ordinária (F) não permitida em ${DIAS_SEMANA_CURTO[dow]} (${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}) pela regra vigente "${normRule.code}". Dias permitidos: ${allowedNames}.`,
      };
    }
  }

  return { allowed: true, rule: normRule };
}

/**
 * Avalia e aplica uma troca bilateral de folga entre dois colaboradores, verificando
 * compatibilidade de turno (shiftPeriod), regras vigentes e calculando impacto no mês seguinte.
 */
export function evaluateBilateralRestSwap({
  targetEmp,
  targetRestDate,
  candidateEmp,
  candidateRestDate,
  monthEntries = [],
  nextYearMonth = null,
  nextMonthEntries = [],
  allocations = [],
  ruleAssignments = [],
  rulesById = {},
  shiftsById = {},
  unavailabilityEvents = [],
  marketCalendarByDate = {},
}) {
  const checkTargetWork = validateManualCellEdit({
    employee: targetEmp,
    isoDate: targetRestDate,
    targetStatus: "T",
    allocations,
    ruleAssignments,
    rulesById,
    marketCalendarByDate,
  });
  const checkTargetRest = validateManualCellEdit({
    employee: targetEmp,
    isoDate: candidateRestDate,
    targetStatus: "F",
    allocations,
    ruleAssignments,
    rulesById,
    marketCalendarByDate,
  });
  const checkCandRest = validateManualCellEdit({
    employee: candidateEmp,
    isoDate: targetRestDate,
    targetStatus: "F",
    allocations,
    ruleAssignments,
    rulesById,
    marketCalendarByDate,
  });
  const checkCandWork = validateManualCellEdit({
    employee: candidateEmp,
    isoDate: candidateRestDate,
    targetStatus: "T",
    allocations,
    ruleAssignments,
    rulesById,
    marketCalendarByDate,
  });

  const failedCheck = [checkTargetWork, checkTargetRest, checkCandRest, checkCandWork].find(
    (c) => !c.allowed
  );

  const allocA = getActiveAllocationOnDate(allocations, targetEmp?.id, targetRestDate);
  const allocB = getActiveAllocationOnDate(allocations, candidateEmp?.id, candidateRestDate);
  const shiftA = allocA ? shiftsById[allocA.workShiftId] : null;
  const shiftB = allocB ? shiftsById[allocB.workShiftId] : null;
  const periodA = shiftA?.shiftPeriod || "INTEGRAL";
  const periodB = shiftB?.shiftPeriod || "INTEGRAL";
  const hasShiftPeriodMismatch = periodA !== periodB;

  const updatedMonthEntries = monthEntries.map((e) => ({ ...e }));
  const findEntry = (eId, dt) =>
    updatedMonthEntries.find((x) => x.employeeId === eId && x.workDate === dt);

  const aRest = findEntry(targetEmp?.id, targetRestDate);
  const aWork = findEntry(targetEmp?.id, candidateRestDate);
  const bWork = findEntry(candidateEmp?.id, targetRestDate);
  const bRest = findEntry(candidateEmp?.id, candidateRestDate);

  if (aRest) {
    aRest.status = "T";
    aRest.origin = "MANUAL_OVERRIDE";
  }
  if (aWork) {
    aWork.status = "F";
    aWork.origin = "MANUAL_OVERRIDE";
    aWork.lunchSlot = null;
  }
  if (bWork) {
    bWork.status = "F";
    bWork.origin = "MANUAL_OVERRIDE";
    bWork.lunchSlot = null;
  }
  if (bRest) {
    bRest.status = "T";
    bRest.origin = "MANUAL_OVERRIDE";
  }

  const impacts = [];
  if (nextYearMonth && nextMonthEntries.length > 0) {
    for (const emp of [targetEmp, candidateEmp]) {
      if (!emp) continue;
      const empNext = nextMonthEntries.filter((e) => e.employeeId === emp.id);
      if (empNext.length > 0) {
        const empCur = updatedMonthEntries.filter((e) => e.employeeId === emp.id);
        impacts.push(
          detectFutureScheduleImpact({
            employee: emp,
            nextYearMonth,
            currentNextMonthEntries: empNext,
            updatedCurrentMonthEntries: empCur,
            allocations,
            ruleAssignments,
            rulesById,
            unavailabilityEvents,
            marketCalendarByDate,
          })
        );
      }
    }
  }

  return {
    allowed: !failedCheck,
    blockedReason: failedCheck ? failedCheck.message : null,
    hasShiftPeriodMismatch,
    targetShiftPeriod: periodA,
    candidateShiftPeriod: periodB,
    updatedMonthEntries,
    impacts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PROPAGAÇÃO DE ALTERAÇÕES MANUAIS E DETECÇÃO DE IMPACTO FUTURO (Seção 10)
// ─────────────────────────────────────────────────────────────────────────────
export function detectFutureScheduleImpact({
  employee,
  nextYearMonth,
  currentNextMonthEntries, // Lançamentos atuais salvos para o mês seguinte
  updatedCurrentMonthEntries, // Lançamentos do mês atual após a edição manual
  allocations,
  ruleAssignments = [],
  rulesById,
  unavailabilityEvents = [],
  marketCalendarByDate = {},
  employeeRotationRank = 0,
}) {
  const { entries: projectedEntries } = generateEmployeeScheduleForMonth({
    employee,
    yearMonth: nextYearMonth,
    allocations,
    ruleAssignments,
    rulesById,
    unavailabilityEvents,
    marketCalendarByDate,
    previousMonthEntries: updatedCurrentMonthEntries,
    employeeRotationRank,
    preserveManualOverrides: false,
  });

  const existingByDate = {};
  (currentNextMonthEntries || []).forEach((e) => {
    existingByDate[e.workDate] = e;
  });

  const differences = [];
  for (const proj of projectedEntries) {
    const cur = existingByDate[proj.workDate];
    if (!cur) continue;
    if (cur.status !== proj.status) {
      differences.push({
        workDate: proj.workDate,
        previousStatus: cur.status,
        previousOrigin: cur.origin,
        newProjectedStatus: proj.status,
        hasManualConflict: cur.origin === "MANUAL_OVERRIDE",
      });
    }
  }

  return {
    employeeId: employee.id,
    employeeName: employee.fullName,
    nextYearMonth,
    isImpacted: differences.length > 0,
    differences,
    projectedEntries,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MOTOR DE VALIDAÇÃO EM 10 NÍVEIS E DETECÇÃO DE CONFLITOS (Seções 12 e 14)
// ─────────────────────────────────────────────────────────────────────────────
export function verifyScheduleConflicts({
  unitId,
  yearMonth,
  employees,
  allocations,
  ruleAssignments = [],
  rulesById,
  shiftsById = {},
  sectorsById,
  unitSectors = [],
  unavailabilityEvents = [],
  marketCalendarByDate = {},
  monthEntries = [],
  previousMonthEntries = [],
}) {
  const conflicts = [];
  const dates = listDatesInYearMonth(yearMonth);

  const entriesByEmp = {};
  monthEntries.forEach((e) => {
    if (e.unitId && e.unitId !== unitId) return;
    (entriesByEmp[e.employeeId] = entriesByEmp[e.employeeId] || []).push(e);
  });

  const prevByEmp = {};
  previousMonthEntries.forEach((e) => {
    if (e.unitId && e.unitId !== unitId) return;
    (prevByEmp[e.employeeId] = prevByEmp[e.employeeId] || []).push(e);
  });

  // 1. Verifica restrições individuais (Lacunas vazias, Férias, Admissão/Demissão, Sobrecarga, Interjornada 11h, Almoço, Regras Semanais)
  for (const emp of employees) {
    const empEntries = (entriesByEmp[emp.id] || []).sort((a, b) =>
      a.workDate.localeCompare(b.workDate)
    );
    const empEntriesByDate = Object.fromEntries(empEntries.map((e) => [e.workDate, e]));

    // Check 1: Colaborador ativo com alocação na unidade mas sem lançamento ou com célula EMPTY
    for (const isoDate of dates) {
      const alloc = getActiveAllocationOnDate(allocations, emp.id, isoDate, unitId);
      if (!alloc) continue;
      if (emp.hireDate && isoDate < emp.hireDate) continue;
      if (
        (emp.terminationDate && isoDate > emp.terminationDate) ||
        (emp.noticePeriodEndDate && isoDate > emp.noticePeriodEndDate)
      ) {
        continue;
      }
      const entry = empEntriesByDate[isoDate];
      if (!entry || entry.status === "EMPTY" || !entry.status) {
        conflicts.push({
          id: `conf_empty_${emp.id}_${isoDate}`,
          severity: "CRITICAL",
          blocking: true,
          type: "UNFILLED_MANDATORY_DAY",
          workDate: isoDate,
          employeeId: emp.id,
          employeeName: emp.fullName,
          sectorId: alloc.sectorId,
          message: `${emp.fullName} possui dia obrigatório sem preenchimento (${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}).`,
        });
      }
    }

    if (!empEntries.length) continue;

    const prevEntries = (prevByEmp[emp.id] || [])
      .sort((a, b) => a.workDate.localeCompare(b.workDate))
      .slice(-10);

    const combined = [...prevEntries, ...empEntries];
    let streak = 0;
    let streakStart = null;
    let prevEntry = null;
    const weekBuckets = {};

    for (const entry of combined) {
      const alloc = getActiveAllocationOnDate(allocations, emp.id, entry.workDate);
      const rule = getEffectiveRuleForDate({
        employeeId: emp.id,
        isoDate: entry.workDate,
        allocations,
        ruleAssignments,
        rulesById,
      });
      const normRule = normalizeScheduleRule(rule);
      const shift = alloc ? shiftsById[alloc.workShiftId] : null;
      const maxAllowed = normRule?.maxConsecutiveWorkDays || 7;
      const inCurrentMonth = entry.workDate.startsWith(yearMonth);
      const dow = getDayOfWeekISO(entry.workDate);
      const weekStartISO = addDaysISO(entry.workDate, -dow);
      if (!weekBuckets[weekStartISO]) weekBuckets[weekStartISO] = [];
      weekBuckets[weekStartISO].push({ entry, normRule, inCurrentMonth });

      // Check 2: Trabalho antes da admissão ou após desligamento
      if (
        inCurrentMonth &&
        (entry.status === "T" || entry.status === "MEIO_EXP") &&
        ((emp.hireDate && entry.workDate < emp.hireDate) ||
          (emp.terminationDate && entry.workDate > emp.terminationDate) ||
          (emp.noticePeriodEndDate && entry.workDate > emp.noticePeriodEndDate))
      ) {
        conflicts.push({
          id: `conf_contract_${emp.id}_${entry.workDate}`,
          severity: "CRITICAL",
          blocking: true,
          type: "WORK_OUTSIDE_CONTRACT_DATES",
          workDate: entry.workDate,
          employeeId: emp.id,
          employeeName: emp.fullName,
          sectorId: entry.sectorId,
          message: `${emp.fullName} está escalado para trabalhar em ${entry.workDate} fora da vigência contratual (Admissão/Desligamento).`,
        });
      }

      // Check 3: Escalado para trabalhar durante Férias ou Afastamento
      const unav = getUnavailabilityOnDate(unavailabilityEvents, emp.id, entry.workDate);
      if (
        unav &&
        unav.eventType !== "NOTICE_PERIOD" &&
        (entry.status === "T" || entry.status === "MEIO_EXP") &&
        inCurrentMonth
      ) {
        conflicts.push({
          id: `conf_unav_${emp.id}_${entry.workDate}`,
          severity: "CRITICAL",
          blocking: true,
          type: "WORK_DURING_UNAVAILABILITY",
          workDate: entry.workDate,
          employeeId: emp.id,
          employeeName: emp.fullName,
          sectorId: entry.sectorId,
          message: `${emp.fullName} está escalado para trabalhar em ${entry.workDate} durante período de ${unav.eventType === "VACATION" ? "Férias" : "Afastamento"}.`,
        });
      }

      // Check 4: Coerência com Mercado Fechado
      const marketDay = marketCalendarByDate[entry.workDate];
      if (
        inCurrentMonth &&
        marketDay?.openingMode === "CLOSED" &&
        (entry.status === "T" || entry.status === "MEIO_EXP")
      ) {
        conflicts.push({
          id: `conf_closed_${emp.id}_${entry.workDate}`,
          severity: "CRITICAL",
          blocking: true,
          type: "WORK_ON_CLOSED_MARKET",
          workDate: entry.workDate,
          employeeId: emp.id,
          employeeName: emp.fullName,
          sectorId: entry.sectorId,
          message: `${emp.fullName} está escalado como trabalhando em ${entry.workDate}, mas a loja está configurada como FECHADA no Calendário Operacional.`,
        });
      }

      // Check 4.1: Folga ordinária em dia da semana não permitido pela regra vigente
      if (
        inCurrentMonth &&
        entry.status === "F" &&
        normRule &&
        normRule.allowedRestDows.length > 0 &&
        !normRule.allowedRestDows.includes(dow)
      ) {
        conflicts.push({
          id: `conf_disallowed_rest_${emp.id}_${entry.workDate}`,
          severity: "CRITICAL",
          blocking: true,
          type: "REST_ON_DISALLOWED_DAY",
          workDate: entry.workDate,
          employeeId: emp.id,
          employeeName: emp.fullName,
          sectorId: entry.sectorId,
          message: `${emp.fullName} possui folga ordinária (F) em ${DIAS_SEMANA_CURTO[dow]} (${entry.workDate.slice(8, 10)}/${entry.workDate.slice(5, 7)}), dia não permitido na regra ${normRule.code}.`,
        });
      }

      // Check 5: Descanso Interjornada mínimo de 11h entre dois dias trabalhados consecutivos
      if (inCurrentMonth && prevEntry && diffDaysISO(entry.workDate, prevEntry.workDate) === 1) {
        const prevAlloc = getActiveAllocationOnDate(allocations, emp.id, prevEntry.workDate);
        const prevShift = prevAlloc ? shiftsById[prevAlloc.workShiftId] : shift;
        const prevMarket = marketCalendarByDate[prevEntry.workDate];
        const interCheck = checkInterjornadaRest({
          prevShift,
          prevStatus: prevEntry.status,
          currShift: shift,
          currStatus: entry.status,
          prevHalfDayClosingTime: prevMarket?.halfDayClosingTime || "13:00",
        });
        if (interCheck.violated) {
          conflicts.push({
            id: `conf_interjornada_${emp.id}_${entry.workDate}`,
            severity: "HIGH",
            blocking: false,
            type: "INTERJORNADA_REST_VIOLATION",
            workDate: entry.workDate,
            employeeId: emp.id,
            employeeName: emp.fullName,
            sectorId: entry.sectorId,
            message: `Interjornada inferior a 11h para ${emp.fullName} em ${entry.workDate}: saída às ${interCheck.prevExitTime} e retorno às ${interCheck.currEntryTime} (descanso de ${interCheck.restFormatted}).`,
          });
        }
      }

      // Check 6: Excesso de dias consecutivos trabalhados
      if (entry.status === "T" || entry.status === "MEIO_EXP") {
        if (streak === 0) streakStart = entry.workDate;
        streak += 1;
        if (streak > maxAllowed && inCurrentMonth) {
          conflicts.push({
            id: `conf_streak_${emp.id}_${entry.workDate}`,
            severity: "HIGH",
            blocking: false,
            type: "EXCESS_CONSECUTIVE_DAYS",
            workDate: entry.workDate,
            employeeId: emp.id,
            employeeName: emp.fullName,
            sectorId: entry.sectorId,
            message: `Sobrecarga: ${emp.fullName} acumula ${streak} dias consecutivos de trabalho (início em ${streakStart}, limite da regra ${normRule?.name || "padrão"}: ${maxAllowed} dias).`,
          });
        }

        // Check 7: Domingo/Feriado trabalhado sem faixa de almoço quando exigido
        const isSundayOrHoliday =
          dow === 0 ||
          (marketDay && ["HOLIDAY", "OPTIONAL_HOLIDAY", "SUNDAY"].includes(marketDay.dayType));
        if (
          inCurrentMonth &&
          isSundayOrHoliday &&
          (normRule?.requiresSundayLunchSlot !== false || marketDay?.requiresLunchScale) &&
          !entry.lunchSlot
        ) {
          conflicts.push({
            id: `conf_lunch_${emp.id}_${entry.workDate}`,
            severity: "MEDIUM",
            blocking: false,
            type: "MISSING_SUNDAY_LUNCH_SLOT",
            workDate: entry.workDate,
            employeeId: emp.id,
            employeeName: emp.fullName,
            sectorId: entry.sectorId,
            message: `${emp.fullName} trabalha no domingo/feriado ${entry.workDate.slice(8, 10)}/${entry.workDate.slice(5, 7)} sem faixa de almoço (1 a 4) atribuída.`,
          });
        }
      } else {
        streak = 0;
        streakStart = null;
      }

      prevEntry = entry;
    }

    // Check 8: Quantidade semanal de folgas ordinárias para ciclos semanais com dias permitidos definidos
    for (const [weekStartISO, items] of Object.entries(weekBuckets)) {
      if (items.length !== 7) continue;
      if (!items.some((x) => x.inCurrentMonth)) continue;
      const hasNonOperational = items.some((x) =>
        ["V", "LM", "INSS", "ADM", "DEM", "EMPTY"].includes(x.entry.status)
      );
      if (hasNonOperational) continue;

      const firstRule = items[0].normRule;
      if (!firstRule || firstRule.allowedRestDows.length === 0) continue;
      if (firstRule.workDaysInCycle + firstRule.restDaysInCycle !== 7) continue;
      const uniformRule = items.every((x) => x.normRule?.id === firstRule.id);
      if (!uniformRule) continue;

      const fCount = items.filter((x) => x.entry.status === "F").length;
      const closedCount = items.filter((x) => x.entry.status === "FECHADO").length;
      const targetRest = firstRule.restDaysInCycle;
      const countsClosedAsRest = firstRule.closedMarketCountsAsRest !== false;

      const hasMismatch =
        closedCount === 0
          ? fCount !== targetRest
          : countsClosedAsRest
            ? fCount > targetRest || fCount + closedCount < targetRest
            : fCount !== targetRest;

      if (hasMismatch) {
        const anchorItem =
          items.find((x) => x.inCurrentMonth && x.entry.status === "F") ||
          items.find((x) => x.inCurrentMonth) ||
          items[0];
        conflicts.push({
          id: `conf_week_rest_${emp.id}_${weekStartISO}`,
          severity: "CRITICAL",
          blocking: true,
          type: "WEEKLY_REST_COUNT_MISMATCH",
          workDate: anchorItem.entry.workDate,
          employeeId: emp.id,
          employeeName: emp.fullName,
          sectorId: anchorItem.entry.sectorId,
          message: `${emp.fullName} possui ${fCount} folga(s) ordinária(s) na semana de ${weekStartISO.slice(8, 10)}/${weekStartISO.slice(5, 7)} para a regra ${firstRule.code}, que prevê ${targetRest} dia(s) de descanso.`,
        });
      }
    }
  }

  // 2. Nota de Domínio (Rateio Multiunidade):
  // A agenda/configuração de rateio (isSharedRateio / authorizedUnitIds / rateioScheduleByDow)
  // serve exclusivamente para que o colaborador conste nas lojas em que é rateado,
  // NÃO constituindo fator impeditivo nem gerando bloqueios ou alertas na escala.

  // 3. Verifica cobertura mínima diária por setor (respeitando dias em que o mercado está FECHADO)
  const activeSectorIds = [
    ...new Set(monthEntries.filter((e) => e.unitId === unitId).map((e) => e.sectorId)),
  ];

  for (const sectorId of activeSectorIds) {
    const sector = sectorsById[sectorId];
    const unitSectorCfg = unitSectors.find(
      (us) => us.unitId === unitId && us.sectorId === sectorId
    );
    const minWeekday = unitSectorCfg?.minDailyCoverage ?? sector?.minDailyCoverage ?? 1;
    const minSunday = unitSectorCfg?.minSundayCoverage ?? minWeekday;

    for (const isoDate of dates) {
      const marketDay = marketCalendarByDate[isoDate];
      if (marketDay?.openingMode === "CLOSED") continue;

      const dow = getDayOfWeekISO(isoDate);
      const requiredMin = dow === 0 ? minSunday : minWeekday;
      if (requiredMin <= 0) continue;

      const entriesInSectorDay = monthEntries.filter(
        (e) => e.unitId === unitId && e.sectorId === sectorId && e.workDate === isoDate
      );
      const workingCount = entriesInSectorDay.filter(
        (e) => e.status === "T" || e.status === "MEIO_EXP"
      ).length;

      if (workingCount < requiredMin) {
        conflicts.push({
          id: `conf_cov_${sectorId}_${isoDate}`,
          severity: "CRITICAL",
          blocking: false,
          type: "MINIMUM_COVERAGE_BREACH",
          workDate: isoDate,
          sectorId,
          sectorName: sector?.name || sectorId,
          message: `Déficit de cobertura em ${sector?.name || sectorId} no dia ${isoDate.slice(8, 10)} (${DIAS_SEMANA_CURTO[dow]}): ${workingCount} escalado(s) para o mínimo de ${requiredMin}.`,
        });
      }
    }
  }

  // 4. Verifica concentração de faixa de almoço aos domingos e feriados no mesmo setor e turno
  const lunchGroups = {};
  for (const e of monthEntries) {
    if (
      (!unitId || !e.unitId || e.unitId === unitId) &&
      (e.status === "T" || e.status === "MEIO_EXP") &&
      e.lunchSlot
    ) {
      const alloc = getActiveAllocationOnDate(allocations, e.employeeId, e.workDate);
      const shiftPeriod = (alloc && shiftsById[alloc.workShiftId]?.shiftPeriod) || "INTEGRAL";
      const key = `${e.sectorId}__${shiftPeriod}__${e.workDate}`;
      (lunchGroups[key] = lunchGroups[key] || []).push(e);
    }
  }

  for (const [key, list] of Object.entries(lunchGroups)) {
    if (list.length < 2) continue;
    const [sectorId, shiftPeriod, workDate] = key.split("__");
    const counts = { "1": 0, "2": 0, "3": 0, "4": 0 };
    for (const item of list) {
      if (counts[item.lunchSlot] !== undefined) {
        counts[item.lunchSlot] += 1;
      }
    }
    const vals = Object.values(counts);
    const maxSlotCount = Math.max(...vals);
    const minSlotCount = Math.min(...vals);
    if (maxSlotCount - minSlotCount >= 2) {
      const sector = sectorsById[sectorId];
      conflicts.push({
        id: `conf_lunch_imb_${sectorId}_${shiftPeriod}_${workDate}`,
        severity: "MEDIUM",
        blocking: false,
        type: "LUNCH_SLOT_SECTOR_IMBALANCE",
        workDate,
        sectorId,
        sectorName: sector?.name || sectorId,
        message: `Concentração de almoço em ${sector?.name || sectorId} (${shiftPeriod}) no dia ${workDate.slice(8, 10)}/${workDate.slice(5, 7)}: ${maxSlotCount} colaboradores na mesma faixa enquanto há faixas com ${minSlotCount}.`,
      });
    }
  }

  return conflicts;
}

export function validateMonthlyScheduleChecklist({
  unitId,
  yearMonth,
  employees,
  allocations,
  ruleAssignments = [],
  rulesById,
  shiftsById = {},
  sectorsById,
  unitSectors = [],
  unavailabilityEvents = [],
  marketCalendarByDate = {},
  monthEntries = [],
  previousMonthEntries = [],
}) {
  const allConflicts = verifyScheduleConflicts({
    unitId,
    yearMonth,
    employees,
    allocations,
    ruleAssignments,
    rulesById,
    shiftsById,
    sectorsById,
    unitSectors,
    unavailabilityEvents,
    marketCalendarByDate,
    monthEntries,
    previousMonthEntries,
  });

  const blockingErrors = allConflicts.filter((c) => c.blocking === true);
  const operationalWarnings = allConflicts.filter((c) => !c.blocking);

  // Consolida cycleStates ao final do mês para alimentar o próximo mês com continuidade exata
  const computedCycleStates = [];
  employees.forEach((emp, idx) => {
    const empEntries = monthEntries.filter(
      (e) => e.employeeId === emp.id && (!e.unitId || e.unitId === unitId)
    );
    if (empEntries.length > 0) {
      const prevEmpEntries = previousMonthEntries.filter(
        (e) => e.employeeId === emp.id && (!e.unitId || e.unitId === unitId)
      );
      const cs = computeCycleStateFromEntries({
        employee: emp,
        entriesUpToDate: [...prevEmpEntries, ...empEntries],
        lastFlexRotationIndex: emp.anchorCycleOffset ?? idx,
        unavailabilityEvents,
      });
      computedCycleStates.push({
        ...cs,
        yearMonth,
      });
    }
  });

  return {
    canValidate: blockingErrors.length === 0,
    canPublish: blockingErrors.length === 0,
    blockingErrors,
    operationalWarnings,
    allConflicts,
    computedCycleStates,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.1 BLOQUEIO E REABERTURA AUDITADA DE ESCALA PUBLICADA (Seção 15)
// ─────────────────────────────────────────────────────────────────────────────
export function isScheduleLockedForEditing(monthlySchedule) {
  return monthlySchedule?.status === "PUBLISHED";
}

export function reopenPublishedSchedule({
  monthlySchedule,
  reason,
  actorEmail,
  actorRole,
}) {
  if (!reason || String(reason).trim().length < 5) {
    throw new Error(
      "Para reabrir uma escala publicada é obrigatório informar uma justificativa formal (mínimo de 5 caracteres)."
    );
  }
  const prevVersion = monthlySchedule?.versionNumber || 1;
  const nextVersion = prevVersion + 1;
  const nowIso = new Date().toISOString();
  const historyEntry = {
    versionNumber: prevVersion,
    previousStatus: monthlySchedule?.status || "PUBLISHED",
    reopenedAt: nowIso,
    reopenedBy: actorEmail,
    reopenedByRole: actorRole,
    reason: String(reason).trim(),
  };

  return {
    ...monthlySchedule,
    status: "DRAFT",
    versionNumber: nextVersion,
    reopenedAt: nowIso,
    reopenedBy: actorEmail,
    reopenReason: String(reason).trim(),
    versionHistory: [...(monthlySchedule?.versionHistory || []), historyEntry],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. BUSINESS INTELLIGENCE — POSIÇÃO DO QUADRO NA DATA E CONSULTA FLEXÍVEL
// ─────────────────────────────────────────────────────────────────────────────
export function computeWorkforceAnalytics({
  unitId,
  referenceDate, // Data de referência para Posição do Quadro na Data (ex: '2026-11-10')
  yearMonth,     // Mês de referência para indicadores de FLUXO (ex: '2026-11')
  workPositions,
  employees,
  allocations,
  unavailabilityEvents = [],
  monthEntries = [],
  sectorsById = {},
  rolesById = {},
}) {
  const isPositionVisibleInUnit = (pos) => {
    if (!unitId) return true;
    if (pos.unitId === unitId) return true;
    if (!pos.isSharedRateio) return false;
    if (Array.isArray(pos.authorizedUnitIds) && pos.authorizedUnitIds.length > 0) {
      return pos.authorizedUnitIds.includes(unitId);
    }
    return true;
  };

  const unitPositions = workPositions.filter(
    (p) => isPositionVisibleInUnit(p) && p.status !== "DEACTIVATED"
  );
  const deactivatedPositions = workPositions.filter(
    (p) => isPositionVisibleInUnit(p) && p.status === "DEACTIVATED"
  );

  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-${String(getDaysInYearMonth(yearMonth)).padStart(2, "0")}`;

  const sectorStatsMap = {};

  const ensureSectorBucket = (sectorId) => {
    if (!sectorStatsMap[sectorId]) {
      sectorStatsMap[sectorId] = {
        sectorId,
        sectorName: sectorsById[sectorId]?.name || sectorId,
        displayOrder: sectorsById[sectorId]?.displayOrder ?? 999,
        plannedOwnPositions: 0,
        plannedRateioPositions: 0,
        filledOwnPositions: 0,
        filledRateioPositions: 0,
        vacantPositions: 0,
        openAuthorizedPositions: 0,
        openUnplannedPositions: 0,
        frozenPositions: 0,
        onVacationOnRefDate: 0,
        onLeaveOnRefDate: 0,
        onVacationInMonthFlow: 0,
        availableOnRefDate: 0,
        scheduledWorkingOnRefDate: 0,
        estimatedFullCost: 0,
        estimatedFilledCost: 0,
        hasCostData: false,
      };
    }
    return sectorStatsMap[sectorId];
  };

  for (const pos of unitPositions) {
    const bucket = ensureSectorBucket(pos.sectorId);
    const roleCost = pos.estimatedMonthlyCost ?? rolesById[pos.roleId]?.projectedMonthlyCost ?? null;

    if (pos.isSharedRateio) {
      bucket.plannedRateioPositions += 1;
    } else {
      bucket.plannedOwnPositions += 1;
    }

    if (roleCost !== null && roleCost !== undefined) {
      bucket.hasCostData = true;
      bucket.estimatedFullCost += Number(roleCost);
    }

    const activeAlloc = allocations.find(
      (a) =>
        a.workPositionId === pos.id &&
        a.startDate <= referenceDate &&
        (!a.endDate || a.endDate >= referenceDate)
    );
    const occupant = activeAlloc
      ? employees.find(
          (e) =>
            e.id === activeAlloc.employeeId &&
            (!e.terminationDate || e.terminationDate >= referenceDate) &&
            (!e.noticePeriodEndDate || e.noticePeriodEndDate >= referenceDate)
        )
      : null;

    if (occupant) {
      if (pos.isSharedRateio) {
        bucket.filledRateioPositions += 1;
      } else {
        bucket.filledOwnPositions += 1;
      }

      if (roleCost !== null && roleCost !== undefined) {
        bucket.estimatedFilledCost += Number(roleCost);
      }

      const unavOnDate = getUnavailabilityOnDate(unavailabilityEvents, occupant.id, referenceDate);
      if (unavOnDate && unavOnDate.eventType === "VACATION") {
        bucket.onVacationOnRefDate += 1;
      } else if (
        unavOnDate &&
        ["MATERNITY_LEAVE", "MEDICAL_LEAVE", "UNPAID_LEAVE"].includes(unavOnDate.eventType)
      ) {
        bucket.onLeaveOnRefDate += 1;
      } else {
        bucket.availableOnRefDate += 1;
      }

      const hadVacationInMonth = unavailabilityEvents.some(
        (ev) =>
          ev.employeeId === occupant.id &&
          ev.eventType === "VACATION" &&
          ev.startDate <= monthEnd &&
          ev.endDate >= monthStart
      );
      if (hadVacationInMonth) {
        bucket.onVacationInMonthFlow += 1;
      }

      const entryOnRef = monthEntries.find(
        (e) => e.employeeId === occupant.id && e.workDate === referenceDate
      );
      if (entryOnRef && (entryOnRef.status === "T" || entryOnRef.status === "MEIO_EXP")) {
        bucket.scheduledWorkingOnRefDate += 1;
      }
    } else if (!pos.isSharedRateio) {
      bucket.vacantPositions += 1;
      if (pos.status === "OPEN_AUTHORIZED") {
        bucket.openAuthorizedPositions += 1;
      } else if (pos.status === "FROZEN") {
        bucket.frozenPositions += 1;
      } else {
        bucket.openUnplannedPositions += 1;
      }
    }
  }

  const sectorBreakdown = Object.values(sectorStatsMap).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const totals = sectorBreakdown.reduce(
    (acc, s) => {
      acc.plannedOwnPositions += s.plannedOwnPositions;
      acc.plannedRateioPositions += s.plannedRateioPositions;
      acc.filledOwnPositions += s.filledOwnPositions;
      acc.filledRateioPositions += s.filledRateioPositions;
      acc.vacantPositions += s.vacantPositions;
      acc.openAuthorizedPositions += s.openAuthorizedPositions;
      acc.openUnplannedPositions += s.openUnplannedPositions;
      acc.frozenPositions += s.frozenPositions;
      acc.onVacationOnRefDate += s.onVacationOnRefDate;
      acc.onLeaveOnRefDate += s.onLeaveOnRefDate;
      acc.onVacationInMonthFlow += s.onVacationInMonthFlow;
      acc.availableOnRefDate += s.availableOnRefDate;
      acc.scheduledWorkingOnRefDate += s.scheduledWorkingOnRefDate;
      acc.estimatedFullCost += s.estimatedFullCost;
      acc.estimatedFilledCost += s.estimatedFilledCost;
      if (s.hasCostData) acc.hasCostData = true;
      return acc;
    },
    {
      plannedOwnPositions: 0,
      plannedRateioPositions: 0,
      filledOwnPositions: 0,
      filledRateioPositions: 0,
      vacantPositions: 0,
      openAuthorizedPositions: 0,
      openUnplannedPositions: 0,
      frozenPositions: 0,
      deactivatedPositions: deactivatedPositions.length,
      onVacationOnRefDate: 0,
      onLeaveOnRefDate: 0,
      onVacationInMonthFlow: 0,
      availableOnRefDate: 0,
      scheduledWorkingOnRefDate: 0,
      estimatedFullCost: 0,
      estimatedFilledCost: 0,
      hasCostData: false,
    }
  );

  const occupancyRate =
    totals.plannedOwnPositions > 0
      ? Number(((totals.filledOwnPositions / totals.plannedOwnPositions) * 100).toFixed(1))
      : 0;
  const vacancyRate =
    totals.plannedOwnPositions > 0
      ? Number(((totals.vacantPositions / totals.plannedOwnPositions) * 100).toFixed(1))
      : 0;

  return {
    referenceDate,
    yearMonth,
    totals: {
      ...totals,
      occupancyRate,
      vacancyRate,
    },
    sectorBreakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. INTELIGÊNCIA ANALÍTICA POR PERÍODO FLEXÍVEL (Seção 23 — Dia, Semana, Quinzena, Mês, Intervalo)
// ─────────────────────────────────────────────────────────────────────────────
export function computeFlexiblePeriodAnalytics({
  unitId,
  startDate,
  endDate,
  sectorFilter = "ALL",
  roleFilter = "ALL",
  shiftPeriodFilter = "ALL",
  dailyEntriesByMonth = {},
  employees = [],
  allocations = [],
  workPositions = [],
  sectorsById = {},
  unitSectors = [],
  rolesById = {},
  shiftsById = {},
  marketCalendarDays = [],
}) {
  const dates = listDatesBetweenISO(startDate, endDate);
  const allEntries = Object.values(dailyEntriesByMonth).flat();
  const marketByDate = Object.fromEntries(
    (marketCalendarDays || [])
      .filter((m) => !unitId || m.unitId === unitId)
      .map((m) => [m.calendarDate, m])
  );

  const employeesById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const positionsById = Object.fromEntries(workPositions.map((p) => [p.id, p]));

  const filteredEntries = [];
  const uniqueWorkingEmpIds = new Set();
  const uniqueRestEmpIds = new Set();
  const uniqueVacationEmpIds = new Set();
  const uniqueLeaveEmpIds = new Set();

  let workingPersonDays = 0;
  let halfDayPersonDays = 0;
  let restPersonDays = 0;
  let vacationPersonDays = 0;
  let leavePersonDays = 0;

  const dailySummaryMap = {};
  dates.forEach((d) => {
    dailySummaryMap[d] = {
      workDate: d,
      dow: getDayOfWeekISO(d),
      workingCount: 0,
      halfDayCount: 0,
      restCount: 0,
      vacationCount: 0,
      leaveCount: 0,
      deficits: [],
    };
  });

  for (const entry of allEntries) {
    if (entry.workDate < startDate || entry.workDate > endDate) continue;
    if (unitId && entry.unitId && entry.unitId !== unitId) continue;
    if (sectorFilter !== "ALL" && entry.sectorId !== sectorFilter) continue;

    const alloc = getActiveAllocationOnDate(allocations, entry.employeeId, entry.workDate);
    const pos = positionsById[entry.workPositionId || alloc?.workPositionId];
    const roleId = alloc?.roleId || pos?.roleId;
    if (roleFilter !== "ALL" && roleId !== roleFilter) continue;

    const shiftId = alloc?.workShiftId || pos?.defaultShiftId;
    const shift = shiftsById[shiftId];
    if (shiftPeriodFilter !== "ALL" && shift?.shiftPeriod !== shiftPeriodFilter) continue;

    const emp = employeesById[entry.employeeId];
    if (!emp) continue;

    const enriched = {
      ...entry,
      employeeName: emp.fullName,
      registrationCode: emp.registrationCode,
      positionCode: pos?.code || "—",
      positionTitle: pos?.title || "—",
      isSharedRateio: Boolean(pos?.isSharedRateio),
      sectorName: sectorsById[entry.sectorId]?.name || entry.sectorId,
      roleName: rolesById[roleId]?.name || roleId || "—",
      shiftName: shift?.name || "—",
      shiftPeriod: shift?.shiftPeriod || "—",
    };
    filteredEntries.push(enriched);

    const dayBucket = dailySummaryMap[entry.workDate];
    if (entry.status === "T" || entry.status === "MEIO_EXP") {
      uniqueWorkingEmpIds.add(entry.employeeId);
      workingPersonDays += 1;
      if (entry.status === "MEIO_EXP") {
        halfDayPersonDays += 1;
        if (dayBucket) dayBucket.halfDayCount += 1;
      }
      if (dayBucket) dayBucket.workingCount += 1;
    } else if (entry.status === "F" || entry.status === "A" || entry.status === "FECHADO") {
      uniqueRestEmpIds.add(entry.employeeId);
      restPersonDays += 1;
      if (dayBucket) dayBucket.restCount += 1;
    } else if (entry.status === "V") {
      uniqueVacationEmpIds.add(entry.employeeId);
      vacationPersonDays += 1;
      if (dayBucket) dayBucket.vacationCount += 1;
    } else if (entry.status === "LM" || entry.status === "INSS") {
      uniqueLeaveEmpIds.add(entry.employeeId);
      leavePersonDays += 1;
      if (dayBucket) dayBucket.leaveCount += 1;
    }
  }

  // Avalia cobertura diária por setor dentro do período selecionado
  const sectorsToEvaluate =
    sectorFilter !== "ALL"
      ? [sectorFilter]
      : Object.keys(sectorsById);

  const insufficientCoverageDays = [];
  for (const isoDate of dates) {
    const marketDay = marketByDate[isoDate];
    if (marketDay?.openingMode === "CLOSED") continue;
    const dow = getDayOfWeekISO(isoDate);

    for (const secId of sectorsToEvaluate) {
      const sec = sectorsById[secId];
      if (!sec) continue;
      const us = (unitSectors || []).find((u) => (!unitId || u.unitId === unitId) && u.sectorId === secId);
      const minRequired = dow === 0 ? (us?.minSundayCoverage ?? sec.minDailyCoverage ?? 0) : (us?.minDailyCoverage ?? sec.minDailyCoverage ?? 0);
      if (minRequired <= 0) continue;

      const workingInSec = filteredEntries.filter(
        (e) => e.workDate === isoDate && e.sectorId === secId && (e.status === "T" || e.status === "MEIO_EXP")
      ).length;

      if (workingInSec < minRequired) {
        const deficitItem = {
          workDate: isoDate,
          sectorId: secId,
          sectorName: sec.name,
          workingCount: workingInSec,
          minRequired,
          deficit: minRequired - workingInSec,
        };
        insufficientCoverageDays.push(deficitItem);
        if (dailySummaryMap[isoDate]) {
          dailySummaryMap[isoDate].deficits.push(deficitItem);
        }
      }
    }
  }

  return {
    startDate,
    endDate,
    totalDaysInPeriod: dates.length,
    uniqueEmployees: {
      working: uniqueWorkingEmpIds.size,
      resting: uniqueRestEmpIds.size,
      onVacation: uniqueVacationEmpIds.size,
      onLeave: uniqueLeaveEmpIds.size,
    },
    personDays: {
      working: workingPersonDays,
      halfDay: halfDayPersonDays,
      resting: restPersonDays,
      onVacation: vacationPersonDays,
      onLeave: leavePersonDays,
    },
    dailyTimeline: Object.values(dailySummaryMap),
    insufficientCoverageDays,
    records: filteredEntries,
  };
}
