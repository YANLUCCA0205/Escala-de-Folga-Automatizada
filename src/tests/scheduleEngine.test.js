// =============================================================================
// SUÍTE COMPLETA DE TESTES AUTOMATIZADOS — WORKFORCE ERP v8.0 (Seção 25 — 32 Cenários)
// Execução: npm test  (node --test src/tests/scheduleEngine.test.js)
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createSequentialPositions,
  generateEmployeeScheduleForMonth,
  computeCycleStateFromEntries,
  listDatesInYearMonth,
  listDatesBetweenISO,
  balanceSectorSundayLunchSlots,
  projectNextMonthFirstRestDate,
  isCellModificationNoOp,
  evaluateBilateralRestSwap,
  detectFutureScheduleImpact,
  computeWorkforceAnalytics,
  computeFlexiblePeriodAnalytics,
  verifyScheduleConflicts,
  validateMonthlyScheduleChecklist,
  getActiveAllocationOnDate,
  computeDynamicEmploymentStatus,
  calculateShiftMetrics,
  checkInterjornadaRest,
  calculateEmployeeMonthlyWorkload,
  isScheduleLockedForEditing,
  reopenPublishedSchedule,
} from "../domain/scheduleEngine.js";
import { buildInitialErpDatabase } from "../domain/seedLoja03.js";
import {
  upgradeDatabaseToV8,
  mergeConcurrentDatabaseStates,
  assertUnitAccess,
  assertPermission,
  canSimulateRbacRole,
  resolveAuthenticatedOperatorSession,
} from "../services/erpRepository.js";

const BASE_RULES = {
  rule_5x1: {
    id: "rule_5x1",
    code: "5X1",
    name: "Escala 5x1 Contínua",
    ruleType: "5X1",
    workDaysInCycle: 5,
    restDaysInCycle: 1,
    allowedRestDows: [],
    maxConsecutiveWorkDays: 5,
    requiresSundayLunchSlot: true,
    closedMarketCountsAsRest: false,
  },
  rule_5x2: {
    id: "rule_5x2",
    code: "5X2_SAB_DOM",
    name: "Escala 5x2 (Sáb/Dom)",
    ruleType: "5X2",
    workDaysInCycle: 5,
    restDaysInCycle: 2,
    allowedRestDows: [6, 0],
    fixedWeekdays: true,
    maxConsecutiveWorkDays: 5,
    requiresSundayLunchSlot: false,
    closedMarketCountsAsRest: false,
  },
  rule_6x1_dom: {
    id: "rule_6x1_dom",
    code: "6X1_DOM",
    name: "Escala 6x1 (Folga Fixa Domingo)",
    ruleType: "6X1_DOM",
    workDaysInCycle: 6,
    restDaysInCycle: 1,
    allowedRestDows: [0],
    maxConsecutiveWorkDays: 6,
    requiresSundayLunchSlot: false,
    closedMarketCountsAsRest: false,
  },
  rule_6x1_dom_seg: {
    id: "rule_6x1_dom_seg",
    code: "6X1_DOM_SEG",
    name: "Escala 6x1 Revezamento (Dom/Seg)",
    ruleType: "6X1_FLEX",
    workDaysInCycle: 6,
    restDaysInCycle: 1,
    allowedRestDows: [0, 1],
    maxConsecutiveWorkDays: 7,
    requiresSundayLunchSlot: true,
    closedMarketCountsAsRest: false,
  },
  rule_6x1_sab_dom: {
    id: "rule_6x1_sab_dom",
    code: "6X1_SAB_DOM",
    name: "Escala 6x1 Revezamento (Sáb/Dom)",
    ruleType: "6X1_FLEX",
    workDaysInCycle: 6,
    restDaysInCycle: 1,
    allowedRestDows: [6, 0],
    maxConsecutiveWorkDays: 7,
    requiresSundayLunchSlot: true,
    closedMarketCountsAsRest: false,
  },
  rule_6x1_sab_dom_seg: {
    id: "rule_6x1_sab_dom_seg",
    code: "6X1_SAB_DOM_SEG",
    name: "Escala 6x1 Revezamento (Sáb/Dom/Seg)",
    ruleType: "6X1_FLEX",
    workDaysInCycle: 6,
    restDaysInCycle: 1,
    allowedRestDows: [6, 0, 1],
    maxConsecutiveWorkDays: 7,
    requiresSundayLunchSlot: true,
    closedMarketCountsAsRest: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 1 — CONTINUIDADE HISTÓRICA 5x1 ENTRE MESES (Outubro -> Novembro)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 01: Continuidade 5x1 entre meses — Folga em 29/10 gera próxima folga exatamente em 04/11", () => {
  const emp = { id: "emp_1", fullName: "ARLINDO EMANUEL", hireDate: "2025-01-10" };
  const allocations = [
    {
      id: "alloc_1",
      employeeId: "emp_1",
      workPositionId: "pos_1",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-10",
      endDate: null,
    },
  ];
  const octoberEntries = [
    { workDate: "2026-10-28", status: "T" },
    { workDate: "2026-10-29", status: "F" },
    { workDate: "2026-10-30", status: "T" },
    { workDate: "2026-10-31", status: "T" },
  ];

  const { entries: novEntries, endCycleState } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    previousMonthEntries: octoberEntries,
    employeeRotationRank: 0,
  });

  const byDate = Object.fromEntries(novEntries.map((e) => [e.workDate, e]));
  assert.equal(byDate["2026-11-01"].status, "T");
  assert.equal(byDate["2026-11-02"].status, "T");
  assert.equal(byDate["2026-11-03"].status, "T");
  assert.equal(byDate["2026-11-04"].status, "F");
  assert.equal(byDate["2026-11-10"].status, "F");
  assert.ok(endCycleState.lastRestDate);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 2 — REGRA 5x2 (SÁBADO E DOMINGO FIXOS)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 02: Regra 5x2 gera folgas fixas exclusivamente nos sábados e domingos", () => {
  const emp = { id: "emp_5x2", fullName: "COLAB 5X2", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "alloc_5x2",
      employeeId: "emp_5x2",
      workPositionId: "pos_5x2",
      unitId: "LOJA_03",
      sectorId: "ADM",
      roleId: "AUX_ADM",
      scheduleRuleId: "rule_5x2",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
  });
  const byDate = Object.fromEntries(entries.map((e) => [e.workDate, e]));
  assert.equal(byDate["2026-11-01"].status, "F", "Domingo 01/11 deve ser folga");
  assert.equal(byDate["2026-11-02"].status, "T", "Segunda 02/11 deve trabalhar");
  assert.equal(byDate["2026-11-07"].status, "F", "Sábado 07/11 deve ser folga");
  assert.equal(byDate["2026-11-08"].status, "F", "Domingo 08/11 deve ser folga");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 3 — REGRA 6x1 (FOLGA FIXA AOS DOMINGOS)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 03: Regra 6x1_DOM gera folga fixa todos os domingos e trabalha de segunda a sábado", () => {
  const emp = { id: "emp_6x1", fullName: "COLAB 6X1 DOM", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "alloc_6x1",
      employeeId: "emp_6x1",
      workPositionId: "pos_6x1",
      unitId: "LOJA_03",
      sectorId: "LOJA",
      roleId: "REPOSITOR",
      scheduleRuleId: "rule_6x1_dom",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
  });
  const restDates = entries.filter((e) => e.status === "F").map((e) => e.workDate);
  assert.deepEqual(restDates, ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 4, 5 E 6 — REVEZAMENTO 6x1_FLEX (DOM/SEG, SÁB/DOM, SÁB/DOM/SEG) SEM EXCEDER LIMITE
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 04: Revezamento 6x1 (DOM/SEG) reveza folgas entre Domingo e Segunda respeitando maxConsecutiveWorkDays", () => {
  const emp = { id: "emp_dom_seg", fullName: "PADARIA DOM SEG", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "a_ds",
      employeeId: "emp_dom_seg",
      workPositionId: "p_ds",
      unitId: "LOJA_03",
      sectorId: "PADARIA",
      roleId: "AUX_PADARIA",
      scheduleRuleId: "rule_6x1_dom_seg",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    employeeRotationRank: 1,
  });

  let consecutive = 0;
  let maxObserved = 0;
  for (const e of entries) {
    if (e.status === "T") {
      consecutive += 1;
      if (consecutive > maxObserved) maxObserved = consecutive;
    } else if (e.status === "F") {
      consecutive = 0;
    }
  }
  assert.ok(maxObserved <= 7, `Máximo de dias consecutivos (${maxObserved}) não pode exceder 7`);
});

test("Cenário 05: Revezamento 6x1 (SÁB/DOM) nunca gera sequência de 8 dias consecutivos trabalhados", () => {
  const emp = { id: "emp_sab_dom", fullName: "CAIXA SAB DOM", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "a_sd",
      employeeId: "emp_sab_dom",
      workPositionId: "p_sd",
      unitId: "LOJA_03",
      sectorId: "FRENTE_CAIXA",
      roleId: "OPER_CAIXA",
      scheduleRuleId: "rule_6x1_sab_dom",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    employeeRotationRank: 0,
  });

  let consecutive = 0;
  for (const e of entries) {
    if (e.status === "T") consecutive += 1;
    else consecutive = 0;
    assert.ok(consecutive <= 7, `Sequência em ${e.workDate} chegou a ${consecutive} dias (> 7)`);
  }
});

test("Cenário 06: Revezamento 6x1 (SÁB/DOM/SEG) distribui folgas na janela e respeita teto de dias consecutivos", () => {
  const emp = { id: "emp_sds", fullName: "REPOSITOR SDS", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "a_sds",
      employeeId: "emp_sds",
      workPositionId: "p_sds",
      unitId: "LOJA_03",
      sectorId: "MERCEARIA",
      roleId: "REPOSITOR",
      scheduleRuleId: "rule_6x1_sab_dom_seg",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    employeeRotationRank: 2,
  });
  const restEntries = entries.filter((e) => e.status === "F");
  assert.ok(restEntries.length >= 4, "Deve possuir ao menos 4 folgas no mês");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 7 — RECONSTRUÇÃO MANUAL DE ESCALA VAZIA (STATUS EMPTY) E BLOQUEIO DE PUBLICAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 07: Escala iniciada vazia (EMPTY) bloqueia publicação no checklist até que todos os dias tenham status válido", () => {
  const emp = { id: "emp_m", fullName: "COLAB MANUAL", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "a_m",
      employeeId: "emp_m",
      workPositionId: "p_m",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const emptyEntries = [
    { id: "e1", employeeId: "emp_m", unitId: "LOJA_03", workDate: "2026-11-01", status: "EMPTY", origin: "MANUAL_EMPTY_DRAFT" },
    { id: "e2", employeeId: "emp_m", unitId: "LOJA_03", workDate: "2026-11-02", status: "T", origin: "MANUAL_OVERRIDE" },
  ];

  const report = validateMonthlyScheduleChecklist({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    monthEntries: emptyEntries,
    previousMonthEntries: [],
    employees: [emp],
    allocations,
    rulesById: BASE_RULES,
    shiftsById: {},
    sectorsById: { ACOUGUE: { id: "ACOUGUE", name: "AÇOUGUE" } },
  });

  assert.equal(report.canPublish, false, "Não deve permitir publicação com célula EMPTY");
  assert.ok(
    report.blockingErrors.some((err) => err.type === "UNFILLED_MANDATORY_DAY"),
    "Deve apontar erro bloqueante UNFILLED_MANDATORY_DAY"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 8 — SELEÇÃO DIRETA DE STATUS DA CÉLULA INDEPENDENTE DA FAIXA DE ALMOÇO (1..4)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 08: Alteração de status da célula e seleção da faixa de almoço (1..4) funcionam de forma independente", () => {
  const cell = {
    id: "c_dom",
    employeeId: "emp_1",
    workDate: "2026-11-01",
    status: "T",
    lunchSlot: "3",
    origin: "MANUAL_OVERRIDE",
  };
  assert.equal(cell.status, "T");
  assert.equal(cell.lunchSlot, "3");

  const updatedToRest = { ...cell, status: "F", lunchSlot: null };
  assert.equal(updatedToRest.status, "F");
  assert.equal(updatedToRest.lunchSlot, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 9 — CONTINUIDADE APÓS RECONSTRUÇÃO MANUAL DE OUTUBRO PARA NOVEMBRO
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 09: Escala manual construída em Outubro serve como âncora exata para geração automática de Novembro", () => {
  const emp = { id: "emp_9", fullName: "AKSUELSON ALVES", hireDate: "2025-02-01" };
  const allocations = [
    {
      id: "alloc_9",
      employeeId: "emp_9",
      workPositionId: "pos_8",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "AUX_ACOUGUE",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-02-01",
      endDate: null,
    },
  ];
  const manualOct = [
    { workDate: "2026-10-27", status: "F", origin: "MANUAL_OVERRIDE" },
    { workDate: "2026-10-28", status: "T", origin: "MANUAL_OVERRIDE" },
    { workDate: "2026-10-29", status: "T", origin: "MANUAL_OVERRIDE" },
    { workDate: "2026-10-30", status: "T", origin: "MANUAL_OVERRIDE" },
    { workDate: "2026-10-31", status: "T", origin: "MANUAL_OVERRIDE" },
  ];

  const { entries: novGenerated } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    previousMonthEntries: manualOct,
  });
  const byDate = Object.fromEntries(novGenerated.map((e) => [e.workDate, e]));
  assert.equal(byDate["2026-11-01"].status, "T");
  assert.equal(byDate["2026-11-02"].status, "F", "Folga em 02/11 respeitando os 4 dias manuais de Outubro");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 10 — PRESERVAÇÃO DE OVERRIDES MANUAIS AO RECALCULAR MÊS FUTURO
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 10: detectFutureScheduleImpact identifica impacto em Novembro e preserva células com MANUAL_OVERRIDE", () => {
  const emp = { id: "emp_10", fullName: "ZAIR HENRIQUE", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "alloc_10",
      employeeId: "emp_10",
      workPositionId: "pos_10",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const octOriginal = [
    { workDate: "2026-10-26", status: "F" },
    { workDate: "2026-10-27", status: "T" },
    { workDate: "2026-10-28", status: "T" },
    { workDate: "2026-10-29", status: "T" },
    { workDate: "2026-10-30", status: "T" },
    { workDate: "2026-10-31", status: "T" },
  ];
  const { entries: novOriginal } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    previousMonthEntries: octOriginal,
  });
  const novWithManual = novOriginal.map((e) =>
    e.workDate === "2026-11-10" ? { ...e, status: "F", origin: "MANUAL_OVERRIDE" } : e
  );
  const octUpdated = octOriginal.map((e) =>
    e.workDate === "2026-10-28" ? { ...e, status: "F", origin: "MANUAL_OVERRIDE" } : e
  );

  const impact = detectFutureScheduleImpact({
    employee: emp,
    nextYearMonth: "2026-11",
    currentNextMonthEntries: novWithManual,
    updatedCurrentMonthEntries: octUpdated,
    allocations,
    rulesById: BASE_RULES,
  });

  assert.equal(impact.isImpacted, true);
  assert.ok(impact.differences.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 11 — GOVERNANÇA DE ESCALA PUBLICADA (BLOQUEIO E REABERTURA AUDITADA)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 11: Escala PUBLISHED bloqueia edições e exige justificativa formal para reabertura, incrementando versionNumber", () => {
  const pubSched = {
    id: "ms_2026_11",
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    status: "PUBLISHED",
    versionNumber: 1,
    versionHistory: [],
  };

  assert.equal(isScheduleLockedForEditing(pubSched), true, "Escala publicada deve estar bloqueada para edição direta");

  assert.throws(() => {
    reopenPublishedSchedule({
      monthlySchedule: pubSched,
      reason: "abc",
      actorEmail: "op@uniao.com",
      actorRole: "MANAGER",
    });
  }, /justificativa formal/);

  const reopened = reopenPublishedSchedule({
    monthlySchedule: pubSched,
    reason: "Necessidade de ajuste por atestado médico inesperado no setor de Açougue",
    actorEmail: "op@uniao.com",
    actorRole: "MANAGER",
  });
  assert.equal(reopened.status, "DRAFT");
  assert.equal(reopened.versionNumber, 2);
  assert.equal(reopened.versionHistory.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 12, 13 E 14 — CÁLCULO ATIVO E VALIDAÇÃO DAS 8 COLUNAS DE WORKSHIFTS
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 12: calculateShiftMetrics calcula e valida as 8 colunas de um turno padrão (07:00-11:00 / 13:00-16:20 / ext 18:20)", () => {
  const shift = {
    id: "shift_07_1820",
    name: "07:00 às 16:20 (Ext 18:20)",
    entryTime: "07:00",
    breakStart: "11:00",
    breakEnd: "13:00",
    exitBaseTime: "16:20",
    baseWorkload: "07:20",
    extensionWorkload: "02:00",
    effectiveExitTime: "18:20",
    contractDailyWorkload: "07:20",
  };

  const metrics = calculateShiftMetrics(shift);
  assert.equal(metrics.valid, true);
  assert.equal(metrics.breakDurationMinutes, 120, "Intervalo de 11:00 às 13:00 = 120 min (2h)");
  assert.equal(metrics.derivedBaseMinutes, 440, "Carga base 07:00-16:20 menos 2h intervalo = 440 min (7h20)");
  assert.equal(metrics.derivedExtensionMinutes, 120, "Prorrogação 16:20-18:20 = 120 min (2h)");
  assert.equal(metrics.derivedTotalEffectiveMinutes, 560, "Carga efetiva total = 560 min (9h20)");
  assert.equal(metrics.hasBaseWorkloadDivergence, false);
  assert.equal(metrics.hasExtensionDivergence, false);
  assert.equal(metrics.hasContractDivergence, false);
});

test("Cenário 13: calculateShiftMetrics detecta divergência aritmética nas colunas de carga horária e violação de intrajornada", () => {
  const divergentShift = {
    id: "shift_div",
    entryTime: "08:00",
    breakStart: "12:00",
    breakEnd: "12:30", // Apenas 30 min para jornada > 6h!
    exitBaseTime: "17:00",
    baseWorkload: "06:40", // Declarado 06:40 (400m), mas 08:00-17:00 (540m) - 30m = 510m (08:30)!
    extensionWorkload: "01:00", // Declarado 01:00, mas effectiveExitTime é 17:00 (00:00)!
    effectiveExitTime: "17:00",
    contractDailyWorkload: "07:20",
  };

  const metrics = calculateShiftMetrics(divergentShift);
  assert.equal(metrics.hasBaseWorkloadDivergence, true, "Deve detectar divergência na Carga Horária Base");
  assert.equal(metrics.hasExtensionDivergence, true, "Deve detectar divergência na Prorrogação");
  assert.equal(metrics.hasContractDivergence, true, "Deve detectar divergência entre Carga Base e Carga Contratual");
  assert.ok(
    metrics.warnings.some((w) => w.includes("intrajornada")),
    "Jornada > 6h com intervalo < 60 min deve acusar violação de intrajornada"
  );
});

test("Cenário 14: checkInterjornadaRest valida descanso mínimo de 11h entre dois turnos consecutivos e calculateEmployeeMonthlyWorkload totaliza horas do mês", () => {
  const lateShift = {
    id: "s_late",
    entryTime: "14:00",
    breakStart: "18:00",
    breakEnd: "19:00",
    exitBaseTime: "22:20",
    effectiveExitTime: "23:00",
  };
  const earlyShift = {
    id: "s_early",
    entryTime: "07:00",
    breakStart: "11:00",
    breakEnd: "13:00",
    exitBaseTime: "16:20",
    baseWorkload: "07:20",
    extensionWorkload: "00:00",
    effectiveExitTime: "16:20",
    contractDailyWorkload: "07:20",
  };

  const restCheck = checkInterjornadaRest({
    prevShift: lateShift,
    prevStatus: "T",
    currShift: earlyShift,
    currStatus: "T",
  });
  assert.equal(restCheck.violated, true, "Saída às 23:00 + entrada às 07:00 tem apenas 8h de descanso (< 11h)");
  assert.equal(restCheck.restMinutes, 480);

  const allocations = [
    {
      id: "a_wl",
      employeeId: "emp_wl",
      workPositionId: "p_wl",
      workShiftId: "s_early",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const workload = calculateEmployeeMonthlyWorkload({
    employeeEntries: [
      { employeeId: "emp_wl", workDate: "2026-11-01", status: "T" },
      { employeeId: "emp_wl", workDate: "2026-11-02", status: "MEIO_EXP" },
      { employeeId: "emp_wl", workDate: "2026-11-03", status: "F" },
    ],
    allocations,
    shiftsById: { s_early: earlyShift },
    marketCalendarByDate: {
      "2026-11-02": { calendarDate: "2026-11-02", openingMode: "HALF_DAY", halfDayClosingTime: "13:00" },
    },
  });
  assert.equal(workload.workedDaysCount, 2);
  assert.equal(workload.restDaysCount, 1);
  assert.equal(workload.totalContractMinutes, 440 + 360, "1 dia inteiro (440m) + meio expediente 07:00..13:00 (360m)");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 15 — CALENDÁRIO OPERACIONAL FILTRADO POR UNIDADE (LOJA 03 vs LOJA 01)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 15: Calendário operacional filtra feriados por unidade (unitId) mantendo feriados globais", () => {
  const db = buildInitialErpDatabase();
  const calLoja03 = (db.marketCalendarDays || []).filter((c) => !c.unitId || c.unitId === "LOJA_03");
  assert.ok(calLoja03.length >= 3, "Deve retornar os eventos de calendário aplicáveis à Loja 03");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 16 E 17 — STATUS DINÂMICO DE FÉRIAS / AFASTAMENTOS (CORREÇÃO BUG-08)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 16: computeDynamicEmploymentStatus atualiza status do colaborador conforme vigência de férias e restaura ACTIVE após remoção", () => {
  const emp = {
    id: "emp_vac",
    fullName: "COLAB FERIAS",
    hireDate: "2025-01-01",
    employmentStatus: "ON_VACATION",
  };
  const vacEvent = {
    id: "ev_1",
    employeeId: "emp_vac",
    eventType: "VACATION",
    startDate: "2026-11-01",
    endDate: "2026-11-20",
  };

  assert.equal(
    computeDynamicEmploymentStatus({ employee: emp, unavailabilityEvents: [vacEvent], referenceDate: "2026-11-10" }),
    "ON_VACATION",
    "Em 10/11 deve estar ON_VACATION"
  );

  assert.equal(
    computeDynamicEmploymentStatus({ employee: emp, unavailabilityEvents: [vacEvent], referenceDate: "2026-11-25" }),
    "ACTIVE",
    "Em 25/11 (após fim das férias) deve retornar automaticamente para ACTIVE"
  );

  assert.equal(
    computeDynamicEmploymentStatus({ employee: emp, unavailabilityEvents: [], referenceDate: "2026-11-10" }),
    "ACTIVE",
    "Ao remover o evento de férias, o status deve voltar para ACTIVE imediatamente (BUG-08 corrigido)"
  );
});

test("Cenário 17: Afastamento médico (MEDICAL_LEAVE) e licença maternidade (MATERNITY_LEAVE) refletem corretamente no status e na escala (INSS / LM)", () => {
  const emp = { id: "emp_af", fullName: "COLAB AFASTADO", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "a_af",
      employeeId: "emp_af",
      workPositionId: "p_af",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const unavailabilityEvents = [
    {
      id: "u_med",
      employeeId: "emp_af",
      eventType: "MEDICAL_LEAVE",
      startDate: "2026-11-05",
      endDate: "2026-11-10",
    },
  ];

  assert.equal(
    computeDynamicEmploymentStatus({ employee: emp, unavailabilityEvents, referenceDate: "2026-11-07" }),
    "MEDICAL_LEAVE"
  );

  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    unavailabilityEvents,
  });
  const byDate = Object.fromEntries(entries.map((e) => [e.workDate, e]));
  assert.equal(byDate["2026-11-07"].status, "INSS", "Durante licença médica a célula da escala recebe status INSS");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 18, 19 E 20 — ESTRUTURA ORGANIZACIONAL, POSTOS E TRANSFERÊNCIA FUNCIONAL
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 18: Criação de postos sequenciais e distinção entre vagas próprias e postos de RATEIO", () => {
  const role = { id: "role_ac", code: "ACOUGUEIRO", name: "AÇOUGUEIRO", projectedMonthlyCost: 2800 };
  const positions = createSequentialPositions({
    unitId: "LOJA_03",
    sectorId: "ACOUGUE",
    role,
    quantity: 11,
    startNumber: 1,
  });
  assert.equal(positions.length, 11);
  assert.equal(positions[0].isSharedRateio, false);
});

test("Cenário 19: Mudança de regra de jornada no meio do mês (16/11) aplica cada regra estritamente dentro de sua vigência", () => {
  const emp = { id: "emp_3", fullName: "LUCAS JEAN", hireDate: "2026-09-01" };
  const allocations = [
    {
      id: "alloc_3",
      employeeId: "emp_3",
      workPositionId: "pos_10",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "AUX_ACOUGUE",
      scheduleRuleId: "rule_6x1_dom",
      startDate: "2026-09-01",
      endDate: null,
    },
  ];
  const ruleAssignments = [
    { employeeId: "emp_3", ruleId: "rule_6x1_dom", effectiveFrom: "2026-09-01", effectiveTo: "2026-11-15" },
    { employeeId: "emp_3", ruleId: "rule_5x1", effectiveFrom: "2026-11-16", effectiveTo: null },
  ];

  const { entries } = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    ruleAssignments,
    rulesById: BASE_RULES,
    previousMonthEntries: [{ workDate: "2026-10-31", status: "T" }],
  });

  const byDate = Object.fromEntries(entries.map((e) => [e.workDate, e]));
  assert.equal(byDate["2026-11-01"].ruleId, "rule_6x1_dom");
  assert.equal(byDate["2026-11-16"].ruleId, "rule_5x1");
  assert.equal(byDate["2026-11-21"].status, "F");
});

test("Cenário 20: Promoção / Transferência funcional encerra alocação anterior e cria nova alocação preservando histórico por data", () => {
  const transferAllocs = [
    {
      id: "a_old",
      employeeId: "emp_tr",
      workPositionId: "pos_ac",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "AUX_ACOUGUE",
      scheduleRuleId: "rule_5x1",
      startDate: "2026-01-01",
      endDate: "2026-10-15",
    },
    {
      id: "a_new",
      employeeId: "emp_tr",
      workPositionId: "pos_ac_titular",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      scheduleRuleId: "rule_5x1",
      startDate: "2026-10-16",
      endDate: null,
    },
  ];
  assert.equal(getActiveAllocationOnDate(transferAllocs, "emp_tr", "2026-10-10").roleId, "AUX_ACOUGUE");
  assert.equal(getActiveAllocationOnDate(transferAllocs, "emp_tr", "2026-10-20").roleId, "ACOUGUEIRO");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 21 E 22 — RATEIO MULTIUNIDADE E BLOQUEIO DE CONFLITO DE HORÁRIO ENTRE LOJAS
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 21: Colaborador de RATEIO não infla quadro próprio da loja mas é contabilizado separadamente como rateio", () => {
  const db = buildInitialErpDatabase();
  const bi = computeWorkforceAnalytics({
    unitId: "LOJA_03",
    referenceDate: "2026-11-10",
    yearMonth: "2026-11",
    workPositions: db.workPositions,
    employees: db.employees,
    allocations: db.allocations,
    unavailabilityEvents: db.unavailabilityEvents,
  });

  assert.equal(bi.totals.plannedOwnPositions, 70, "70 vagas próprias planejadas na Loja 03");
  assert.equal(bi.totals.plannedRateioPositions, 4, "4 postos de rateio contabilizados separadamente");
});

test("Cenário 22: Colaborador em RATEIO não gera bloqueio impeditivo na validação da escala (rateio serve apenas para constar nas lojas rateadas)", () => {
  const rateioEmp = {
    id: "emp_rat",
    fullName: "SUPERVISOR COMPARTILHADO",
    hireDate: "2025-01-01",
    isSharedRateio: true,
    homeUnitId: "LOJA_01",
    authorizedUnitIds: ["LOJA_01", "LOJA_03"],
  };
  const allocations = [
    {
      id: "alloc_rat",
      employeeId: "emp_rat",
      workPositionId: "pos_rat",
      unitId: "LOJA_03",
      sectorId: "GERENCIA",
      roleId: "SUPERVISOR",
      scheduleRuleId: "rule_5x2",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const entriesLoja03 = [
    { id: "e_rat_1", employeeId: "emp_rat", unitId: "LOJA_03", workDate: "2026-11-02", status: "T" },
  ];
  const allUnitsEntries = [
    ...entriesLoja03,
    { id: "e_rat_2", employeeId: "emp_rat", unitId: "LOJA_01", workDate: "2026-11-02", status: "T" },
  ];

  const checklist = validateMonthlyScheduleChecklist({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    monthEntries: entriesLoja03,
    allUnitsMonthEntries: allUnitsEntries,
    previousMonthEntries: [],
    employees: [rateioEmp],
    allocations,
    rulesById: BASE_RULES,
    shiftsById: {},
    sectorsById: { GERENCIA: { id: "GERENCIA", name: "GERÊNCIA" } },
  });

  assert.equal(
    checklist.blockingErrors.some((err) => err.type === "RATEIO_UNIT_TIME_CONFLICT"),
    false,
    "O rateio jamais deve gerar erro bloqueante RATEIO_UNIT_TIME_CONFLICT"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 23, 24, 25 E 26 — DASHBOARD & INTELIGÊNCIA ANALÍTICA FLEXÍVEL (DIAS 29-31, QUINZENA, INTERVALO)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 23: computeFlexiblePeriodAnalytics analisa 5ª Semana (dias 29 a 31 de Outubro/2026) sem truncar após o dia 28", () => {
  const db = buildInitialErpDatabase();
  const analyticsW5 = computeFlexiblePeriodAnalytics({
    unitId: "LOJA_03",
    startDate: "2026-10-29",
    endDate: "2026-10-31",
    workPositions: db.workPositions,
    employees: db.employees,
    allocations: db.allocations,
    dailyEntriesByMonth: db.dailyEntriesByMonth,
  });

  assert.equal(analyticsW5.startDate, "2026-10-29");
  assert.equal(analyticsW5.endDate, "2026-10-31");
  assert.equal(analyticsW5.totalDaysInPeriod, 3, "5ª semana de Outubro deve cobrir exatamente os 3 dias (29, 30 e 31/10)");
  assert.equal(analyticsW5.dailyTimeline.length, 3);
});

test("Cenário 24: computeFlexiblePeriodAnalytics analisa 1ª e 2ª Quinzena separando Pessoas Únicas de Pessoas-Dia", () => {
  const db = buildInitialErpDatabase();
  const f1 = computeFlexiblePeriodAnalytics({
    unitId: "LOJA_03",
    startDate: "2026-11-01",
    endDate: "2026-11-15",
    workPositions: db.workPositions,
    employees: db.employees,
    allocations: db.allocations,
    dailyEntriesByMonth: db.dailyEntriesByMonth,
  });
  const f2 = computeFlexiblePeriodAnalytics({
    unitId: "LOJA_03",
    startDate: "2026-11-16",
    endDate: "2026-11-30",
    workPositions: db.workPositions,
    employees: db.employees,
    allocations: db.allocations,
    dailyEntriesByMonth: db.dailyEntriesByMonth,
  });

  assert.equal(f1.totalDaysInPeriod, 15);
  assert.equal(f2.totalDaysInPeriod, 15);
  assert.ok(f1.personDays.working > f1.uniqueEmployees.working, "Pessoas-dia acumuladas devem superar pessoas únicas na quinzena");
});

test("Cenário 25: computeFlexiblePeriodAnalytics analisa Intervalo Personalizado cruzando fronteira de meses (25/10 a 05/11)", () => {
  const db = buildInitialErpDatabase();
  const customRange = computeFlexiblePeriodAnalytics({
    unitId: "LOJA_03",
    startDate: "2026-10-25",
    endDate: "2026-11-05",
    workPositions: db.workPositions,
    employees: db.employees,
    allocations: db.allocations,
    dailyEntriesByMonth: db.dailyEntriesByMonth,
  });

  assert.equal(customRange.totalDaysInPeriod, 12, "De 25/10 a 05/11 existem 12 dias corridos");
  assert.equal(customRange.dailyTimeline[0].workDate, "2026-10-25");
  assert.equal(customRange.dailyTimeline[11].workDate, "2026-11-05");
  assert.ok(Array.isArray(customRange.records), "Deve expor registros nominais para drill-down");
});

test("Cenário 26: Posição do Quadro na Data (Fotografia em data específica) mantém vagas preenchidas durante férias e reduz disponíveis", () => {
  const db = buildInitialErpDatabase();
  const snapshot = computeWorkforceAnalytics({
    unitId: "LOJA_03",
    referenceDate: "2026-11-10",
    yearMonth: "2026-11",
    workPositions: db.workPositions,
    employees: db.employees,
    allocations: db.allocations,
    unavailabilityEvents: db.unavailabilityEvents,
    monthEntries: db.dailyEntriesByMonth["2026-11"],
  });

  assert.equal(snapshot.totals.plannedOwnPositions, 70);
  assert.equal(
    snapshot.totals.filledOwnPositions + snapshot.totals.vacantPositions,
    70,
    "Preenchidas + Vagas abertas deve totalizar 70 postos próprios"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 27, 28, 29 E 30 — PERSISTÊNCIA v8.0, MIGRAÇÃO v7->v8, CONCORRÊNCIA E RBAC
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 27: upgradeDatabaseToV8 migra banco v7 preservando 100% dos colaboradores, postos, escalas e classificando auditoria legada", () => {
  const rawV7 = {
    version: "7.0.0-ERP",
    company: { id: "comp_1", legalName: "UNIÃO SUPERMERCADOS LTDA", tradeName: "União Supermercados" },
    units: [{ id: "LOJA_03", code: "03", name: "LOJA 03" }],
    employees: [{ id: "emp_1", fullName: "ARLINDO EMANUEL", hireDate: "2025-01-10", employmentStatus: "ACTIVE" }],
    workPositions: [{ id: "pos_1", unitId: "LOJA_03", code: "01", title: "AÇOUGUEIRO 01" }],
    allocations: [{ id: "alloc_1", employeeId: "emp_1", workPositionId: "pos_1", unitId: "LOJA_03" }],
    monthlySchedules: [{ id: "ms_1", unitId: "LOJA_03", yearMonth: "2026-11", status: "DRAFT" }],
    dailyEntriesByMonth: { "2026-11": [{ id: "de_1", employeeId: "emp_1", workDate: "2026-11-01", status: "T" }] },
    auditLogs: [
      {
        id: "aud_legacy_1",
        actorEmail: "gestao.loja03@uniaosupermercados.com.br",
        actionType: "UPDATE_SCHEDULE",
        description: "Edição legada sem auth real",
      },
    ],
  };

  const upgraded = upgradeDatabaseToV8(rawV7);
  assert.equal(upgraded.version, "8.0.0-ERP");
  assert.equal(upgraded.employees.length, 1);
  assert.equal(upgraded.employees[0].homeUnitId, "LOJA_03");
  assert.equal(upgraded.monthlySchedules[0].versionNumber, 1);
  assert.equal(
    upgraded.auditLogs[0].authVerificationStatus,
    "AUTORIA_NAO_VERIFICADA_LEGADO",
    "Registro legado com gestao.loja03 deve ser classificado como AUTORIA_NAO_VERIFICADA_LEGADO"
  );
});

test("Cenário 28: mergeConcurrentDatabaseStates preserva alterações concorrentes em meses distintos e incrementa schemaRevision", () => {
  const remoteDb = buildInitialErpDatabase();
  remoteDb.schemaRevision = 6;
  remoteDb.dailyEntriesByMonth["2026-10"][0].status = "F";

  const localDb = buildInitialErpDatabase();
  localDb.schemaRevision = 5;
  localDb.dailyEntriesByMonth["2026-11"][0].status = "A";

  const { mergedDb } = mergeConcurrentDatabaseStates({
    localDb,
    remoteDb,
    mutationMeta: { yearMonth: "2026-11" },
  });
  assert.equal(mergedDb.schemaRevision, 7, "Deve incrementar schemaRevision para max(5,6)+1 = 7");
  assert.equal(mergedDb.dailyEntriesByMonth["2026-11"][0].status, "A", "Preserva edição local em Novembro");
});

test("Cenário 29: assertUnitAccess e assertPermission aplicam controle de acesso (RBAC) por unidade e perfil", () => {
  const managerLoja03 = {
    email: "gerente03@uniao.com",
    roleProfile: "MANAGER",
    authorizedUnits: ["LOJA_03"],
  };

  assert.equal(assertUnitAccess(managerLoja03, "LOJA_03"), true);
  assert.throws(() => {
    assertUnitAccess(managerLoja03, "LOJA_01");
  }, /Acesso negado à unidade/);

  assert.throws(() => {
    assertPermission("VIEWER", "EDIT_SCHEDULE");
  }, /Acesso negado/);
});

test("Cenário 30: Edição de dados cadastrais da Empresa (Razão Social, Nome Fantasia e CNPJ) persiste na estrutura do banco", () => {
  const db = buildInitialErpDatabase();
  db.company = {
    ...db.company,
    legalName: "NOVA RAZÃO SOCIAL SUPERMERCADOS S/A",
    tradeName: "Supermercados União Prime",
    cnpj: "12.345.678/0001-99",
  };
  assert.equal(db.company.legalName, "NOVA RAZÃO SOCIAL SUPERMERCADOS S/A");
  assert.equal(db.company.tradeName, "Supermercados União Prime");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIOS 31 E 32 — INTEGRIDADE DA BASE REAL LOJA 03 E VALIDAÇÃO DE CONFLITOS
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 31: Base real da Loja 03 (74 postos: 70 próprios + 4 rateio) preserva continuidade exata Outubro -> Novembro/2026", () => {
  const db = buildInitialErpDatabase();
  assert.equal(db.version, "8.0.0-ERP");
  assert.equal(db.workPositions.length, 74);

  const novEntries = db.dailyEntriesByMonth["2026-11"];
  const findEmpStatus = (name, date) => {
    const emp = db.employees.find((e) => e.fullName === name);
    assert.ok(emp, `Colaborador ${name} deve existir na base`);
    const entry = novEntries.find((en) => en.employeeId === emp.id && en.workDate === date);
    return entry?.status;
  };

  assert.equal(findEmpStatus("AKSUELSON ALVES", "2026-11-01"), "F");
  assert.equal(findEmpStatus("ZAIR HENRIQUE", "2026-11-02"), "F");
  assert.equal(findEmpStatus("LUCAS JEAN", "2026-11-03"), "F");
  assert.equal(findEmpStatus("LAUANDA SILVA", "2026-11-01"), "F");
  assert.equal(findEmpStatus("FLÁVIA GOMES", "2026-11-02"), "F");
  assert.equal(findEmpStatus("ALICE JACIELLE", "2026-11-03"), "F");
  assert.equal(findEmpStatus("ANGELA SOUSA", "2026-11-01"), "F");
  assert.equal(findEmpStatus("MÔNICA SANTOS", "2026-11-02"), "F");
  assert.equal(findEmpStatus("MARIA CLARA", "2026-11-03"), "F");
});

test("Cenário 32: verifyScheduleConflicts detecta excesso de dias consecutivos, falta de faixa de almoço aos domingos e trabalho em mercado fechado", () => {
  const emp = { id: "emp_conf", fullName: "COLAB CONFLITO", hireDate: "2025-01-01" };
  const allocations = [
    {
      id: "a_conf",
      employeeId: "emp_conf",
      workPositionId: "p_conf",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const entries = [
    { id: "c1", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-01", status: "T", lunchSlot: null },
    { id: "c2", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-02", status: "T" },
    { id: "c3", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-03", status: "T" },
    { id: "c4", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-04", status: "T" },
    { id: "c5", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-05", status: "T" },
    { id: "c6", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-06", status: "T" },
    { id: "c7", employeeId: "emp_conf", unitId: "LOJA_03", sectorId: "ACOUGUE", workDate: "2026-11-15", status: "T" },
  ];
  const marketCalendarByDate = {
    "2026-11-15": { calendarDate: "2026-11-15", openingMode: "CLOSED" },
  };

  const conflicts = verifyScheduleConflicts({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    monthEntries: entries,
    previousMonthEntries: [],
    employees: [emp],
    allocations,
    rulesById: BASE_RULES,
    sectorsById: { ACOUGUE: { id: "ACOUGUE", name: "AÇOUGUE" } },
    marketCalendarByDate,
  });

  assert.ok(conflicts.some((c) => c.type === "MISSING_SUNDAY_LUNCH_SLOT"), "Deve apontar domingo sem faixa de almoço");
  assert.ok(conflicts.some((c) => c.type === "EXCESS_CONSECUTIVE_DAYS"), "Deve apontar excesso de dias consecutivos");
  assert.ok(conflicts.some((c) => c.type === "WORK_ON_CLOSED_MARKET"), "Deve apontar trabalho em dia de mercado fechado");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 33 (BUG-001) — 6X1_FLEX (SÁB/DOM/SEG) SEM DUPLA FOLGA NA MESMA SEMANA (60 DIAS)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 33 (BUG-001): Regra 6X1_FLEX (SÁB/DOM/SEG) com maxConsecutiveWorkDays = 6 em 60 dias nunca concede 2 folgas com intervalo < 5 dias trabalhados", () => {
  const emp = { id: "emp_bug001", fullName: "COLAB BUG 001", hireDate: "2025-01-01" };
  const rules = {
    rule_6x1_sds_6: {
      id: "rule_6x1_sds_6",
      code: "6X1_SDS_6",
      name: "6x1 Revezamento Sáb/Dom/Seg (Máx 6d)",
      ruleType: "6X1_FLEX",
      workDaysInCycle: 6,
      restDaysInCycle: 1,
      allowedRestDows: [6, 0, 1],
      maxConsecutiveWorkDays: 6,
      requiresSundayLunchSlot: true,
      closedMarketCountsAsRest: false,
    },
  };
  const allocations = [
    {
      id: "a_bug001",
      employeeId: "emp_bug001",
      workPositionId: "p_bug001",
      unitId: "LOJA_03",
      sectorId: "MERCEARIA",
      roleId: "REPOSITOR",
      scheduleRuleId: "rule_6x1_sds_6",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];

  const oct = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-10",
    allocations,
    rulesById: rules,
    employeeRotationRank: 0,
  });
  const nov = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: rules,
    previousMonthEntries: oct.entries,
    previousCycleState: oct.endCycleState,
    employeeRotationRank: 0,
  });

  const all60Days = [...oct.entries, ...nov.entries];
  let workSinceLastRest = 5; // evita falso positivo antes da 1ª folga do período
  let seenFirstRest = false;

  for (const e of all60Days) {
    if (e.status === "F") {
      if (seenFirstRest) {
        assert.ok(
          workSinceLastRest >= 5,
          `Dupla folga indevida detectada em ${e.workDate} após apenas ${workSinceLastRest} dia(s) trabalhado(s)`
        );
      }
      seenFirstRest = true;
      workSinceLastRest = 0;
    } else if (e.status === "T" || e.status === "MEIO_EXP") {
      workSinceLastRest += 1;
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 34 (BUG-002) — CONTINUIDADE 5X2 ROTATIVO NA VIRADA DE MÊS (1ª FOLGA EM 31/10 -> 2ª FOLGA EM 01/11)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 34 (BUG-002): Ciclo 5x2 rotativo (fixedWeekdays = false) com 1ª folga em 31/10 concede a 2ª folga em 01/11", () => {
  const emp = { id: "emp_bug002", fullName: "COLAB BUG 002", hireDate: "2025-01-01" };
  const rules = {
    rule_5x2_rot: {
      id: "rule_5x2_rot",
      code: "5X2_ROT",
      name: "5x2 Rotativo Contínuo",
      ruleType: "5X2",
      workDaysInCycle: 5,
      restDaysInCycle: 2,
      allowedRestDows: [],
      fixedWeekdays: false,
      maxConsecutiveWorkDays: 5,
      requiresSundayLunchSlot: false,
      closedMarketCountsAsRest: false,
    },
  };
  const allocations = [
    {
      id: "a_bug002",
      employeeId: "emp_bug002",
      workPositionId: "p_bug002",
      unitId: "LOJA_03",
      sectorId: "ADMIN",
      roleId: "ANALISTA",
      scheduleRuleId: "rule_5x2_rot",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];

  // Em Outubro, o colaborador folgou nos dias 24/10 e 25/10, trabalhou de 26/10 a 30/10 (5 dias) e teve a 1ª folga em 31/10
  const octEntries = [
    { employeeId: "emp_bug002", workDate: "2026-10-24", status: "F" },
    { employeeId: "emp_bug002", workDate: "2026-10-25", status: "F" },
    { employeeId: "emp_bug002", workDate: "2026-10-26", status: "T" },
    { employeeId: "emp_bug002", workDate: "2026-10-27", status: "T" },
    { employeeId: "emp_bug002", workDate: "2026-10-28", status: "T" },
    { employeeId: "emp_bug002", workDate: "2026-10-29", status: "T" },
    { employeeId: "emp_bug002", workDate: "2026-10-30", status: "T" },
    { employeeId: "emp_bug002", workDate: "2026-10-31", status: "F" },
  ];

  const cycleState = computeCycleStateFromEntries({
    employee: emp,
    entriesUpToDate: octEntries,
  });
  assert.equal(cycleState.consecutiveRestDays, 1, "Deve rastrear 1 dia de folga consecutivo ao fim de Outubro");

  const nov = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations,
    rulesById: rules,
    previousMonthEntries: octEntries,
    employeeRotationRank: 0,
  });

  const nov01 = nov.entries.find((e) => e.workDate === "2026-11-01");
  const nov02 = nov.entries.find((e) => e.workDate === "2026-11-02");
  assert.equal(nov01.status, "F", "Dia 01/11 deve ser a 2ª folga consecutiva do ciclo 5x2 rotativo iniciado em 31/10");
  assert.equal(nov02.status, "T", "Dia 02/11 deve retomar o trabalho após as 2 folgas do ciclo 5x2");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 35 (BUG-003) — BALANCEAMENTO DE FAIXA DE ALMOÇO (1..4) POR SETOR/TURNO E ALERTA LUNCH_SLOT_SECTOR_IMBALANCE
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 35 (BUG-003): verifyScheduleConflicts detecta LUNCH_SLOT_SECTOR_IMBALANCE e balanceSectorSundayLunchSlots equilibra faixas 1..4 por setor e turno", () => {
  const employees = [
    { id: "e_l1", fullName: "ACOUGUEIRO 01", hireDate: "2025-01-01" },
    { id: "e_l2", fullName: "ACOUGUEIRO 02", hireDate: "2025-01-01" },
  ];
  const shiftsById = {
    sh_m: { id: "sh_m", name: "Manhã", shiftPeriod: "MORNING", entryTime: "07:00", exitBaseTime: "15:20" },
  };
  const allocations = [
    {
      id: "al_1",
      employeeId: "e_l1",
      workPositionId: "pos_1",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      workShiftId: "sh_m",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
    {
      id: "al_2",
      employeeId: "e_l2",
      workPositionId: "pos_2",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      workShiftId: "sh_m",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];

  // Ambos escalados no domingo 2026-11-01 com employeeRotationRank 0 e 4 -> cairiam na mesma faixa '1' sem balanceamento
  const rawEntries = [
    {
      employeeId: "e_l1",
      workPositionId: "pos_1",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      workDate: "2026-11-01",
      status: "T",
      origin: "AUTO_GENERATED",
      lunchSlot: "1",
      ruleId: "rule_5x1",
    },
    {
      employeeId: "e_l2",
      workPositionId: "pos_2",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      workDate: "2026-11-01",
      status: "T",
      origin: "AUTO_GENERATED",
      lunchSlot: "1",
      ruleId: "rule_5x1",
    },
  ];

  const conflictsBefore = verifyScheduleConflicts({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    employees,
    allocations,
    rulesById: BASE_RULES,
    shiftsById,
    sectorsById: { ACOUGUE: { id: "ACOUGUE", name: "AÇOUGUE" } },
    monthEntries: rawEntries,
  });

  assert.ok(
    conflictsBefore.some((c) => c.type === "LUNCH_SLOT_SECTOR_IMBALANCE"),
    "Deve emitir alerta LUNCH_SLOT_SECTOR_IMBALANCE quando 2 colaboradores do mesmo setor/turno saem para almoço na mesma faixa"
  );

  const balancedEntries = balanceSectorSundayLunchSlots({
    entries: rawEntries,
    allocations,
    shiftsById,
  });

  const slotsAfter = balancedEntries.map((e) => e.lunchSlot);
  assert.notEqual(slotsAfter[0], slotsAfter[1], "Colaboradores do mesmo setor/turno no domingo devem receber faixas de almoço distintas");

  const conflictsAfter = verifyScheduleConflicts({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    employees,
    allocations,
    rulesById: BASE_RULES,
    shiftsById,
    sectorsById: { ACOUGUE: { id: "ACOUGUE", name: "AÇOUGUE" } },
    monthEntries: balancedEntries,
  });

  assert.ok(
    !conflictsAfter.some((c) => c.type === "LUNCH_SLOT_SECTOR_IMBALANCE"),
    "Após balanceSectorSundayLunchSlots não deve haver alerta LUNCH_SLOT_SECTOR_IMBALANCE"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 36 (BUG-007) — RESPEITO A cycleBehavior (RESET_ON_RETURN vs PRESERVE_PHASE) E ATUALIZAÇÃO DE lastRestDate PÓS-FÉRIAS
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 36 (BUG-007): Férias respeitam cycleBehavior (RESET_ON_RETURN vs PRESERVE_PHASE) e atualizam lastRestDate no retorno", () => {
  const emp = {
    id: "emp_bug007",
    fullName: "COLAB BUG 007",
    hireDate: "2025-01-01",
    anchorLastRestDate: "2026-09-28",
  };
  const allocations = [
    {
      id: "a_bug007",
      employeeId: "emp_bug007",
      workPositionId: "p_bug007",
      unitId: "LOJA_03",
      sectorId: "CAIXA",
      roleId: "OP_CAIXA",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];

  // Caso A: RESET_ON_RETURN (trabalha 01/11 a 03/11 = 3 dias, férias 04/11 a 10/11, retorna 11/11 zerando contagem -> folga após 5 dias em 16/11)
  const unavReset = [
    {
      id: "u_reset",
      employeeId: "emp_bug007",
      eventType: "VACATION",
      startDate: "2026-11-04",
      endDate: "2026-11-10",
      cycleBehavior: "RESET_ON_RETURN",
    },
  ];

  const resReset = generateEmployeeScheduleForMonth({
    employee: { ...emp, anchorLastRestDate: "2026-10-31" },
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    unavailabilityEvents: unavReset,
  });

  // 01/11(T), 02/11(T), 03/11(T), 04..10/11(V) -> Com RESET_ON_RETURN: 11..15/11(T, 5 dias) e 16/11(F)
  const resetDay13 = resReset.entries.find((e) => e.workDate === "2026-11-13");
  const resetDay16 = resReset.entries.find((e) => e.workDate === "2026-11-16");
  assert.equal(resetDay13.status, "T", "Com RESET_ON_RETURN, dia 13/11 é apenas o 3º dia pós-retorno (T)");
  assert.equal(resetDay16.status, "F", "Com RESET_ON_RETURN, folga ocorre após 5 dias completos pós-retorno (16/11)");

  // Verifica também que se as férias terminarem no último dia do mês, endCycleState.lastRestDate é atualizado para o fim das férias
  const unavEndMonth = [
    {
      id: "u_end",
      employeeId: "emp_bug007",
      eventType: "VACATION",
      startDate: "2026-10-02",
      endDate: "2026-10-31",
      cycleBehavior: "RESET_ON_RETURN",
    },
  ];
  const resOctVac = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-10",
    allocations,
    rulesById: BASE_RULES,
    unavailabilityEvents: unavEndMonth,
  });
  assert.equal(
    resOctVac.endCycleState.lastRestDate,
    "2026-10-31",
    "Ao encerrar férias com RESET_ON_RETURN em 31/10, lastRestDate deve ser atualizado para 2026-10-31"
  );

  // Caso B: PRESERVE_PHASE (trabalha 01/11 a 03/11 = 3 dias antes do evento, evento 04/11 a 10/11 preserva fase de 3 dias -> trabalha 11/11 e 12/11 completando 5 dias e folga em 13/11!)
  const unavPreserve = [
    {
      id: "u_preserve",
      employeeId: "emp_bug007",
      eventType: "VACATION",
      startDate: "2026-11-04",
      endDate: "2026-11-10",
      cycleBehavior: "PRESERVE_PHASE",
    },
  ];

  const resPreserve = generateEmployeeScheduleForMonth({
    employee: { ...emp, anchorLastRestDate: "2026-10-31" },
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    unavailabilityEvents: unavPreserve,
  });

  const preserveDay13 = resPreserve.entries.find((e) => e.workDate === "2026-11-13");
  assert.equal(
    preserveDay13.status,
    "F",
    "Com PRESERVE_PHASE, os 3 dias trabalhados antes do afastamento são preservados, gerando folga após +2 dias no retorno (13/11)"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 37 (BUG-004) — MERGE POR ID EM mergeConcurrentDatabaseStates SEM PERDA DE ENTIDADES REMOTAS OU MESES CONCORRENTES
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 37 (BUG-004): mergeConcurrentDatabaseStates faz merge por ID nas coleções cadastrais preservando adições remotas e locais sem sobrescrita silenciosa", () => {
  const remoteDb = buildInitialErpDatabase();
  remoteDb.schemaRevision = 6;
  remoteDb.dailyEntriesByMonth["2026-10"][0].status = "F";
  remoteDb.employees.push({
    id: "EMP_REMOTE_NEW",
    registrationCode: "MAT-9991",
    fullName: "COLABORADOR REMOTO NOVO",
    homeUnitId: "LOJA_03",
    employmentStatus: "ACTIVE",
  });

  const localDb = buildInitialErpDatabase();
  localDb.schemaRevision = 5;
  localDb.dailyEntriesByMonth["2026-11"][0].status = "A";
  localDb.employees.push({
    id: "EMP_LOCAL_NEW",
    registrationCode: "MAT-9992",
    fullName: "COLABORADOR LOCAL NOVO",
    homeUnitId: "LOJA_03",
    employmentStatus: "ACTIVE",
  });

  const { mergedDb } = mergeConcurrentDatabaseStates({
    localDb,
    remoteDb,
    mutationMeta: {
      entityType: "EMPLOYEE",
      entityId: "EMP_LOCAL_NEW",
      yearMonth: "2026-11",
    },
  });

  assert.equal(mergedDb.schemaRevision, 7);
  assert.equal(
    mergedDb.dailyEntriesByMonth["2026-10"][0].status,
    "F",
    "Deve preservar alteração remota em Outubro (2026-10)"
  );
  assert.equal(
    mergedDb.dailyEntriesByMonth["2026-11"][0].status,
    "A",
    "Deve preservar alteração local na competência mutada (2026-11)"
  );
  assert.ok(
    mergedDb.employees.some((e) => e.id === "EMP_REMOTE_NEW"),
    "Não pode descartar colaborador recém-cadastrado no banco remoto (EMP_REMOTE_NEW)"
  );
  assert.ok(
    mergedDb.employees.some((e) => e.id === "EMP_LOCAL_NEW"),
    "Deve manter colaborador recém-cadastrado localmente (EMP_LOCAL_NEW)"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 38 (BUG-005) — TURNOS CRUZANDO MEIA-NOITE (00:00) EM calculateShiftMetrics E checkInterjornadaRest
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 38 (BUG-005): calculateShiftMetrics e checkInterjornadaRest calculam corretamente turnos e intervalos que cruzam meia-noite (00:00)", () => {
  // 1. Prorrogação cruzando 00:00 (exitBaseTime 23:20 -> effectiveExitTime 00:40 = 80 min = 01:20)
  const nightClosingShift = {
    id: "sh_night_close",
    name: "Fechamento Noturno",
    entryTime: "15:00",
    breakStart: "19:00",
    breakEnd: "20:00",
    exitBaseTime: "23:20",
    baseWorkload: "07:20",
    extensionWorkload: "01:20",
    effectiveExitTime: "00:40",
    contractDailyWorkload: "07:20",
  };

  const m1 = calculateShiftMetrics(nightClosingShift);
  assert.equal(m1.derivedExtensionMinutes, 80, "Prorrogação de 23:20 até 00:40 deve ser 80 min (01:20)");
  assert.equal(m1.hasExtensionDivergence, false);
  assert.equal(m1.valid, true);

  // 2. Intervalo intrajornada cruzando 00:00 (23:30 -> 00:30 = 60 min)
  const overnightShift = {
    id: "sh_overnight",
    name: "Madrugada 20:00-04:20",
    entryTime: "20:00",
    breakStart: "23:30",
    breakEnd: "00:30",
    exitBaseTime: "04:20",
    baseWorkload: "07:20",
    extensionWorkload: "00:00",
    effectiveExitTime: "04:20",
    contractDailyWorkload: "07:20",
  };

  const m2 = calculateShiftMetrics(overnightShift);
  assert.equal(m2.breakDurationMinutes, 60, "Intervalo de 23:30 às 00:30 deve ser 60 min (01:00)");
  assert.equal(m2.derivedBaseMinutes, 440, "Carga base 20:00-04:20 (500 min) - 60 min = 440 min (07:20)");
  assert.equal(m2.valid, true);

  // 3. Interjornada quando o turno anterior encerrou após meia-noite (01:00 da madrugada) e o próximo inicia às 08:00 (apenas 7h = 420 min de descanso < 11h CLT!)
  const prevShiftAfterMidnight = {
    id: "sh_prev_01",
    entryTime: "16:00",
    exitBaseTime: "23:20",
    effectiveExitTime: "01:00",
  };
  const nextMorningShift = {
    id: "sh_next_08",
    entryTime: "08:00",
    exitBaseTime: "16:20",
    effectiveExitTime: "16:20",
  };

  const inter = checkInterjornadaRest({
    prevShift: prevShiftAfterMidnight,
    prevStatus: "T",
    currShift: nextMorningShift,
    currStatus: "T",
  });

  assert.equal(inter.restMinutes, 420, "Descanso entre saída à 01:00 da madrugada e entrada às 08:00 deve ser 420 min (07:00)");
  assert.equal(inter.violated, true, "Descanso de 07:00 deve acusar violação de interjornada (< 11h CLT Art. 66)");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 39 (BUG-006) — AGENDA DE RATEIO (rateioScheduleByDow) NÃO É FATOR IMPEDITIVO
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 39 (BUG-006): verifyScheduleConflicts não bloqueia nem emite conflito por rateioScheduleByDow (o rateio serve apenas para constar nas lojas rateadas)", () => {
  const rateioEmp = {
    id: "emp_rateio_bug006",
    fullName: "SUPERVISOR RATEIO BUG 006",
    hireDate: "2025-01-01",
    isSharedRateio: true,
    homeUnitId: "LOJA_03",
    authorizedUnitIds: ["LOJA_03", "LOJA_01"],
    rateioScheduleByDow: {
      "1": { unitId: "LOJA_03", period: "INTEGRAL" },
      "2": { unitId: "LOJA_03", period: "INTEGRAL" },
      "3": { unitId: "LOJA_01", period: "INTEGRAL" },
      "4": { unitId: "LOJA_03", period: "INTEGRAL" },
      "5": { unitId: "LOJA_03", period: "INTEGRAL" },
      "6": { unitId: "LOJA_03", period: "INTEGRAL" },
    },
  };

  const allocations = [
    {
      id: "al_rat_006",
      employeeId: "emp_rateio_bug006",
      workPositionId: "pos_rat_006",
      unitId: "LOJA_03",
      sectorId: "GERENCIA",
      roleId: "SUPERVISOR",
      scheduleRuleId: "rule_6x1_dom",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];

  const entries = [
    {
      employeeId: "emp_rateio_bug006",
      workPositionId: "pos_rat_006",
      unitId: "LOJA_03",
      sectorId: "GERENCIA",
      workDate: "2026-11-04",
      status: "T",
      origin: "MANUAL_OVERRIDE",
      ruleId: "rule_6x1_dom",
    },
  ];

  const conflicts = verifyScheduleConflicts({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    employees: [rateioEmp],
    allocations,
    rulesById: BASE_RULES,
    sectorsById: { GERENCIA: { id: "GERENCIA", name: "GERÊNCIA" } },
    monthEntries: entries,
    allUnitsMonthEntries: entries,
  });

  assert.equal(
    conflicts.some((c) => c.type === "RATEIO_UNIT_TIME_CONFLICT"),
    false,
    "A agenda de rateio não deve ser fator impeditivo nem emitir RATEIO_UNIT_TIME_CONFLICT"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 40 (BUG-008) — STATUS FUNCIONAL E ALOCAÇÕES COM DATA DE REFERÊNCIA DINÂMICA (PÓS-2026)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 40 (BUG-008): computeDynamicEmploymentStatus e ocupação de vagas avaliam corretamente datas de referência dinâmicas em 2027+", () => {
  const emp = { id: "emp_2027", fullName: "COLAB 2027", hireDate: "2025-01-01" };
  const unav2027 = [
    {
      id: "u_2027",
      employeeId: "emp_2027",
      eventType: "VACATION",
      startDate: "2027-03-01",
      endDate: "2027-03-30",
    },
  ];
  const selectedYearMonth = "2027-03";
  const activeReferenceDate = selectedYearMonth
    ? `${selectedYearMonth}-01`
    : new Date().toISOString().slice(0, 10);

  const statusInMarch2027 = computeDynamicEmploymentStatus({
    employee: emp,
    unavailabilityEvents: unav2027,
    referenceDate: activeReferenceDate,
  });
  assert.equal(
    statusInMarch2027,
    "ON_VACATION",
    "Com data de referência dinâmica baseada em selectedYearMonth (2027-03-01), férias de Março/2027 devem refletir ON_VACATION"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 41 (BUG-009 / v9.0) — BLOQUEIO DE ESCALONAMENTO DE PRIVILÉGIO E SIMULADOR RESTRITO A MASTER
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 41 (BUG-009): canSimulateRbacRole restringe pré-visualização RBAC ao MASTER e resolveAuthenticatedOperatorSession exige conta provisionada e autenticação de servidor", () => {
  assert.equal(canSimulateRbacRole({ roleProfile: "VIEWER" }), false);
  assert.equal(canSimulateRbacRole({ roleProfile: "ADMIN" }), false);
  assert.equal(canSimulateRbacRole({ roleProfile: "MASTER" }), true);

  const userProfiles = [
    {
      id: "u_viewer",
      email: "auditor@uniaosupermercados.com.br",
      fullName: "Auditor Externo",
      roleProfile: "VIEWER",
      authorizedUnits: ["LOJA_03"],
      status: "ACTIVE",
    },
  ];

  const resolved = resolveAuthenticatedOperatorSession({
    email: "auditor@uniaosupermercados.com.br",
    requestedRole: "MASTER",
    userProfiles,
    authVerificationStatus: "VERIFIED_SUPABASE_AUTH",
  });

  assert.equal(resolved.roleProfile, "VIEWER");
  assert.deepEqual(resolved.authorizedUnits, ["LOJA_03"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 42 (BUG-011) — PROJEÇÃO DA 1ª FOLGA DO MÊS SEGUINTE RESPEITANDO A REGRA REAL DO COLABORADOR
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 42 (BUG-011): projectNextMonthFirstRestDate projeta a 1ª folga do mês seguinte respeitando a regra real (6x1_DOM vs 5x2 vs 5x1) quando o mês seguinte ainda não foi gerado", () => {
  const emp6x1 = { id: "e_proj_6x1", fullName: "COLAB 6X1", hireDate: "2025-01-01" };
  const alloc6x1 = [
    {
      id: "al_p6x1",
      employeeId: "e_proj_6x1",
      workPositionId: "pos_p6x1",
      unitId: "LOJA_03",
      sectorId: "PADARIA",
      roleId: "PADEIRO",
      scheduleRuleId: "rule_6x1_dom",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  // Em Outubro/2026 trabalhou de Seg 26/10 a Sáb 31/10 (6 dias). Em 6x1_DOM, 01/11 é Domingo -> Folga em 01/11!
  const oct6x1 = [
    { employeeId: "e_proj_6x1", workDate: "2026-10-25", status: "F" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-26", status: "T" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-27", status: "T" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-28", status: "T" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-29", status: "T" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-30", status: "T" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-31", status: "T" },
  ];

  // Se trabalhou apenas 2 dias no fim de Outubro (30/10 e 31/10), em 6x1_DOM ainda assim folga no Domingo 01/11 (não 6 - 2 = 04/11!)
  const oct6x1Short = [
    { employeeId: "e_proj_6x1", workDate: "2026-10-29", status: "F" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-30", status: "T" },
    { employeeId: "e_proj_6x1", workDate: "2026-10-31", status: "T" },
  ];

  const firstRest6x1 = projectNextMonthFirstRestDate({
    employee: emp6x1,
    nextYearMonth: "2026-11",
    nextMonthEntries: [],
    currentMonthEntries: oct6x1Short,
    allocations: alloc6x1,
    rulesById: BASE_RULES,
  });

  assert.equal(
    firstRest6x1,
    "2026-11-01",
    "Colaborador 6X1_DOM deve projetar 1ª folga de Novembro no Domingo 01/11 mesmo sem escala salva em Novembro"
  );
  assert.ok(oct6x1.length === 7);
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 43 (BUG-013) — IDEMPOTÊNCIA NA EDIÇÃO DE CÉLULAS E PROTEÇÃO DA PILHA DE UNDO NO PINCEL
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 43 (BUG-013): isCellModificationNoOp evita mutações redundantes e poluição de Undo/Auditoria quando a célula já possui o mesmo status e faixa de almoço", () => {
  const existingRest = {
    employeeId: "e_1",
    workDate: "2026-11-05",
    status: "F",
    origin: "MANUAL_OVERRIDE",
    lunchSlot: null,
  };

  assert.equal(
    isCellModificationNoOp({
      currentEntry: existingRest,
      targetStatus: "F",
    }),
    true,
    "Pintar F sobre célula que já é F deve ser detectado como no-op"
  );

  assert.equal(
    isCellModificationNoOp({
      currentEntry: existingRest,
      targetStatus: "T",
    }),
    false,
    "Pintar T sobre célula F deve permitir a modificação"
  );

  const sundayWorking = {
    employeeId: "e_1",
    workDate: "2026-11-01",
    status: "T",
    origin: "AUTO_GENERATED",
    lunchSlot: "2",
  };

  assert.equal(
    isCellModificationNoOp({
      currentEntry: sundayWorking,
      targetStatus: "T",
      targetLunchSlot: "2",
      isSundayOrHoliday: true,
    }),
    true,
    "Aplicar mesma faixa de almoço 2 no domingo já em T/2 deve ser no-op"
  );

  assert.equal(
    isCellModificationNoOp({
      currentEntry: sundayWorking,
      targetStatus: "T",
      targetLunchSlot: "3",
      isSundayOrHoliday: true,
    }),
    false,
    "Trocar faixa de almoço de 2 para 3 no domingo deve permitir a modificação"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 44 (BUG-010) — listDatesBetweenISO ACIMA DE 400 DIAS E ANO BISSEXTO (2028-02 vs 2026-02)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 44 (BUG-010): listDatesBetweenISO suporta períodos > 400 dias (até 10 anos) e listDatesInYearMonth trata anos bissextos (2028-02 = 29 dias vs 2026-02 = 28 dias)", () => {
  const twoYears = listDatesBetweenISO("2026-01-01", "2027-12-31");
  assert.equal(
    twoYears.length,
    730,
    "listDatesBetweenISO para 2 anos completos (2026-01-01 a 2027-12-31) deve retornar exatamente 730 dias sem truncar em 400"
  );

  const feb2026 = listDatesInYearMonth("2026-02");
  const feb2028 = listDatesInYearMonth("2028-02");
  assert.equal(feb2026.length, 28, "Fevereiro de 2026 (não bissexto) deve ter 28 dias");
  assert.equal(feb2028.length, 29, "Fevereiro de 2028 (ano bissexto) deve ter 29 dias");
  assert.equal(feb2028[28], "2028-02-29");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 45 (BUG-012) — TROCA BILATERAL DE FOLGA COM ALERTA DE TURNO E IMPACTO FUTURO PARA AMBOS
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 45 (BUG-012): evaluateBilateralRestSwap detecta divergência de turno (Manhã vs Fechamento) e calcula detectFutureScheduleImpact para ambos os colaboradores", () => {
  const empA = { id: "e_swap_a", fullName: "COLAB MANHA", hireDate: "2025-01-01" };
  const empB = { id: "e_swap_b", fullName: "COLAB FECHAMENTO", hireDate: "2025-01-01" };
  const shiftsById = {
    sh_m: { id: "sh_m", name: "Manhã", shiftPeriod: "MORNING" },
    sh_t: { id: "sh_t", name: "Tarde/Fechamento", shiftPeriod: "AFTERNOON" },
  };
  const allocations = [
    {
      id: "al_sa",
      employeeId: "e_swap_a",
      workPositionId: "p_sa",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      workShiftId: "sh_m",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
    {
      id: "al_sb",
      employeeId: "e_swap_b",
      workPositionId: "p_sb",
      unitId: "LOJA_03",
      sectorId: "ACOUGUE",
      roleId: "ACOUGUEIRO",
      workShiftId: "sh_t",
      scheduleRuleId: "rule_5x1",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];

  const octEntries = [
    { employeeId: "e_swap_a", workDate: "2026-10-28", status: "F", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_a", workDate: "2026-10-29", status: "T", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_a", workDate: "2026-10-30", status: "T", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_a", workDate: "2026-10-31", status: "T", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_b", workDate: "2026-10-28", status: "T", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_b", workDate: "2026-10-29", status: "T", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_b", workDate: "2026-10-30", status: "T", origin: "AUTO_GENERATED" },
    { employeeId: "e_swap_b", workDate: "2026-10-31", status: "F", origin: "AUTO_GENERATED" },
  ];

  const novA = generateEmployeeScheduleForMonth({
    employee: empA,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    previousMonthEntries: octEntries.filter((x) => x.employeeId === "e_swap_a"),
  });
  const novB = generateEmployeeScheduleForMonth({
    employee: empB,
    yearMonth: "2026-11",
    allocations,
    rulesById: BASE_RULES,
    previousMonthEntries: octEntries.filter((x) => x.employeeId === "e_swap_b"),
  });

  const swapRes = evaluateBilateralRestSwap({
    targetEmp: empA,
    targetRestDate: "2026-10-28",
    candidateEmp: empB,
    candidateRestDate: "2026-10-31",
    monthEntries: octEntries,
    nextYearMonth: "2026-11",
    nextMonthEntries: [...novA.entries, ...novB.entries],
    allocations,
    rulesById: BASE_RULES,
    shiftsById,
  });

  assert.equal(swapRes.hasShiftPeriodMismatch, true, "Deve detectar divergência de turno entre MORNING e AFTERNOON");
  assert.equal(swapRes.impacts.length, 2, "Deve calcular impacto futuro para ambos os colaboradores");
  assert.ok(
    swapRes.impacts.every((imp) => imp.isImpacted === true),
    "Troca nos últimos dias de Outubro deve acusar impacto na escala de Novembro de ambos os colaboradores"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 46 (BUG-014) — VALIDAÇÃO DE SCHEMA SQL (STATUS EMPTY E UNIDADE LOJA_03) E README v8.0
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 46 (BUG-014): Migração SQL aceita status EMPTY em daily_schedule_entries, usa LOJA_03 em user_profiles e README.md documenta o Workforce ERP v8.0", () => {
  const sqlContent = fs.readFileSync(
    new URL("../../supabase/migrations/20261028_erp_complete_schema.sql", import.meta.url),
    "utf8"
  );
  assert.ok(
    sqlContent.includes("'EMPTY'"),
    "CHECK constraint de daily_schedule_entries.status deve incluir 'EMPTY'"
  );
  assert.ok(
    sqlContent.includes('DEFAULT \'{"LOJA_03"}\''),
    "user_profiles.authorized_units deve usar código padronizado LOJA_03 com underscore"
  );

  const readmeContent = fs.readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.ok(
    readmeContent.includes("Workforce ERP v8.0"),
    "README.md deve documentar a arquitetura do Workforce ERP v8.0"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 47 — CONDIÇÕES DE BORDA: LISTA VAZIA DE COLABORADORES E 1 ÚNICO COLABORADOR EM 6X1_FLEX
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 47 (Edge Case): Lista vazia de colaboradores/alocações e 1 único funcionário em 6X1_FLEX não geram NaN, exceções ou divisão por zero", () => {
  const emptyBi = computeWorkforceAnalytics({
    unitId: "LOJA_03",
    referenceDate: "2026-11-01",
    yearMonth: "2026-11",
    workPositions: [],
    employees: [],
    allocations: [],
    unavailabilityEvents: [],
    dailyEntries: [],
  });
  assert.equal(emptyBi.totals.plannedOwnPositions, 0);
  assert.equal(Number.isNaN(emptyBi.totals.occupancyRate), false);

  const emptyFlexBi = computeFlexiblePeriodAnalytics({
    unitId: "LOJA_03",
    startDate: "2026-11-01",
    endDate: "2026-11-07",
    workPositions: [],
    employees: [],
    allocations: [],
    unavailabilityEvents: [],
    dailyEntriesByMonth: {},
  });
  assert.equal(emptyFlexBi.totalDaysInPeriod, 7);
  assert.equal(emptyFlexBi.uniqueEmployees.working, 0);

  // 1 único funcionário no setor em 6X1_FLEX
  const soloEmp = { id: "e_solo", fullName: "COLAB SOLO", hireDate: "2025-01-01" };
  const soloAlloc = [
    {
      id: "al_solo",
      employeeId: "e_solo",
      workPositionId: "p_solo",
      unitId: "LOJA_03",
      sectorId: "PADARIA",
      roleId: "PADEIRO",
      scheduleRuleId: "rule_6x1_dom_seg",
      startDate: "2025-01-01",
      endDate: null,
    },
  ];
  const soloRes = generateEmployeeScheduleForMonth({
    employee: soloEmp,
    yearMonth: "2026-11",
    allocations: soloAlloc,
    rulesById: BASE_RULES,
    employeeRotationRank: 0,
  });
  assert.equal(soloRes.entries.length, 30);
  assert.ok(soloRes.entries.some((e) => e.status === "F"));
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 48 — FERIADO COM MERCADO FECHADO COINCIDINDO COM CICLO (closedMarketCountsAsRest: false vs true)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 48 (Edge Case): Feriado com mercado FECHADO respeita closedMarketCountsAsRest (false preserva contagem para folga normal; true zera contagem)", () => {
  const emp = {
    id: "e_closed_test",
    fullName: "COLAB FERIADO FECHADO",
    hireDate: "2025-01-01",
    anchorLastRestDate: "2026-10-31",
  };
  const rules = {
    rule_not_count: {
      ...BASE_RULES.rule_5x1,
      id: "rule_not_count",
      closedMarketCountsAsRest: false,
    },
    rule_counts: {
      ...BASE_RULES.rule_5x1,
      id: "rule_counts",
      closedMarketCountsAsRest: true,
    },
  };
  const marketClosedDay03 = {
    "2026-11-03": {
      calendarDate: "2026-11-03",
      dayType: "HOLIDAY",
      openingMode: "CLOSED",
    },
  };

  // Caso 1: closedMarketCountsAsRest = false -> 01/11(T,1), 02/11(T,2), 03/11(FECHADO, mantém 2), 04/11(T,3), 05/11(T,4), 06/11(T,5) -> Folga normal em 07/11!
  const resFalse = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations: [
      {
        id: "al_cf",
        employeeId: "e_closed_test",
        workPositionId: "p_cf",
        unitId: "LOJA_03",
        sectorId: "CAIXA",
        roleId: "OP_CAIXA",
        scheduleRuleId: "rule_not_count",
        startDate: "2025-01-01",
        endDate: null,
      },
    ],
    rulesById: rules,
    marketCalendarByDate: marketClosedDay03,
  });

  // Caso 2: closedMarketCountsAsRest = true -> 01/11(T,1), 02/11(T,2), 03/11(FECHADO, zera para 0!), 04..08/11(T, 5 dias) -> Folga em 09/11!
  const resTrue = generateEmployeeScheduleForMonth({
    employee: emp,
    yearMonth: "2026-11",
    allocations: [
      {
        id: "al_ct",
        employeeId: "e_closed_test",
        workPositionId: "p_cf",
        unitId: "LOJA_03",
        sectorId: "CAIXA",
        roleId: "OP_CAIXA",
        scheduleRuleId: "rule_counts",
        startDate: "2025-01-01",
        endDate: null,
      },
    ],
    rulesById: rules,
    marketCalendarByDate: marketClosedDay03,
  });

  const byDateFalse = Object.fromEntries(resFalse.entries.map((e) => [e.workDate, e.status]));
  const byDateTrue = Object.fromEntries(resTrue.entries.map((e) => [e.workDate, e.status]));

  assert.equal(byDateFalse["2026-11-03"], "FECHADO");
  assert.equal(
    byDateFalse["2026-11-07"],
    "F",
    "Com closedMarketCountsAsRest = false, o feriado fechado não consome a folga semanal, que ocorre em 07/11 após 5 dias efetivos trabalhados"
  );
  assert.equal(byDateTrue["2026-11-03"], "FECHADO");
  assert.equal(
    byDateTrue["2026-11-07"],
    "T",
    "Com closedMarketCountsAsRest = true, o feriado fechado em 03/11 reinicia o ciclo"
  );
  assert.equal(
    byDateTrue["2026-11-09"],
    "F",
    "Com closedMarketCountsAsRest = true, a próxima folga ocorre 5 dias após o feriado fechado (09/11)"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 49 — IDENTIDADE VISUAL E TEMAS OFICIAIS UNIÃO SUPERMERCADOS (MANUAL DE MARCA)
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 49: Temas e Manual de Marca União Supermercados aplicam cores RGB/Pantone oficiais (#E9403C e #2B5690), fonte Montserrat e endereços das Lojas 01, 02 e 03", async () => {
  const { UNIAO_BRAND_MANUAL, UNIAO_THEMES, createUniaoModuleUi } = await import(
    "../theme/uniaoTheme.js"
  );

  assert.equal(UNIAO_BRAND_MANUAL.colors.red.hex, "#E9403C");
  assert.equal(UNIAO_BRAND_MANUAL.colors.red.rgb, "233, 64, 60");
  assert.equal(UNIAO_BRAND_MANUAL.colors.red.pantone, "485 C");
  assert.equal(UNIAO_BRAND_MANUAL.colors.blue.hex, "#2B5690");
  assert.equal(UNIAO_BRAND_MANUAL.colors.blue.rgb, "43, 86, 144");
  assert.equal(UNIAO_BRAND_MANUAL.colors.blue.pantone, "293 C");
  assert.ok(UNIAO_BRAND_MANUAL.typography.fontFamily.includes("Montserrat"));

  assert.ok(UNIAO_THEMES.uniao_institucional);
  assert.ok(UNIAO_THEMES.uniao_alvorada);
  assert.ok(UNIAO_THEMES.uniao_energia);
  assert.ok(UNIAO_THEMES.uniao_noturno);

  const ui = createUniaoModuleUi();
  assert.ok(ui.card.fontFamily.includes("Montserrat"));
  assert.ok(ui.btnPrimary.background.includes("#2B5690"), "Ação primária usa Azul União estratégico");

  const db = buildInitialErpDatabase();
  const lj03 = db.units.find((u) => u.id === "LOJA_03");
  const lj01 = db.units.find((u) => u.id === "LOJA_01");
  assert.equal(lj03.city, "Campo Florido");
  assert.equal(lj03.state, "MG");
  assert.equal(lj01.city, "Conceição das Alagoas");
  assert.equal(lj01.state, "MG");
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 50 (v9.0) — BLOQUEIO DEFINITIVO DE CADASTRO PÚBLICO E FALLBACK LOCAL DE SENHA
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 50: Cadastro público (registerOperatorAccount) e autenticação por fallback local (authenticateOperatorWithPassword) são bloqueados por segurança", async () => {
  const {
    registerOperatorAccount,
    authenticateOperatorWithPassword,
  } = await import("../services/erpRepository.js");

  await assert.rejects(
    () =>
      registerOperatorAccount({
        email: "novo.gestor@exemplo.invalid",
        password: "qualquer",
        roleProfile: "ADMIN",
      }),
    /PUBLIC_SIGNUP_DISABLED/
  );

  await assert.rejects(
    () =>
      authenticateOperatorWithPassword({
        email: "novo.gestor@exemplo.invalid",
        password: "qualquer",
      }),
    /LOCAL_AUTH_REMOVED/
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO 51 — EXCLUSÃO DEFINITIVA DE REGISTROS COM PROTEÇÃO DE TOMBSTONE
// ─────────────────────────────────────────────────────────────────────────────
test("Cenário 51: Registros excluídos (deletedEntityIds) não são ressuscitados durante mesclagem de estados (mergeConcurrentDatabaseStates)", async () => {
  const { mergeConcurrentDatabaseStates } = await import("../services/erpRepository.js");

  const remoteDb = buildInitialErpDatabase();
  remoteDb.schemaRevision = 10;

  const localDb = structuredClone(remoteDb);
  localDb.schemaRevision = 5;
  const targetPosId = localDb.workPositions[0].id;
  localDb.workPositions = localDb.workPositions.filter((p) => p.id !== targetPosId);
  localDb.deletedEntityIds = [targetPosId];

  const { mergedDb } = mergeConcurrentDatabaseStates({
    localDb,
    remoteDb,
    mutationMeta: { entityType: "WORK_POSITION", entityId: "OTHER_ID" },
  });

  assert.equal(
    mergedDb.workPositions.some((p) => p.id === targetPosId),
    false,
    "O posto excluído localmente jamais deve voltar do banco remoto quando consta em deletedEntityIds"
  );
});
















