// =============================================================================
// GERADOR DE BASE DE DEMONSTRAÇÃO 100% FICTÍCIA (SANDBOX ISOLADO — AUTOTOUR AI)
// Não reutiliza nomes reais, CNPJ real ou dados pessoais do seed de produção.
// =============================================================================

import {
  generateEmployeeScheduleForMonth,
  balanceSectorSundayLunchSlots,
} from "../../../src/domain/scheduleEngine.js";

/**
 * Padrões estritamente proibidos nos artefatos, DOM e gravações de demonstração.
 * Usados pelo SecurityGuard para comprovar que nenhum dado real ou endpoint
 * de produção vazou para a interface ou relatórios.
 */
export const FORBIDDEN_PRODUCTION_TOKENS = [
  "YUARA PRESTADORA",
  "40.633.037/0001-71",
  "jvvjhcfqvitnxdutfije",
  "ANDRÉ LUIZ",
  "ELIAS SANTIAGO",
  "DANIEL ANTUNES",
  "ARLINDO EMANUEL",
  "GABRIEL MENZOTTI",
  "WANDER MACHADO",
  "AKSUELSON ALVES",
  "ZAIR HENRIQUE",
  "EDILEUZA CORREIA",
  "DENIS FERREIRA",
  "EVANILDA DIAS",
];

export const DEMO_OPERATOR_SESSION = {
  user: {
    email: "instrutor.autotour@horizontedemo.com.br",
    fullName: " Helena Martins (Instrutora AutoTour)",
  },
  roleProfile: "ADMIN",
  authorizedUnits: ["LOJA_03", "LOJA_01", "LOJA_02"],
  authVerificationStatus: "VERIFIED_OPERATOR_SESSION",
  authenticatedAt: "2026-11-05T12:00:00.000Z",
};

export function buildFictitiousErpDatabase() {
  const companies = [
    {
      id: "comp_demo_horizonte",
      legalName: "HORIZONTE VAREJO ALIMENTAR DEMO S.A.",
      tradeName: "Supermercados Horizonte — Unidade Demo 03",
      cnpj: "12.345.678/0001-90",
      active: true,
    },
  ];

  const units = [
    {
      id: "LOJA_03",
      companyId: "comp_demo_horizonte",
      code: "FIL03",
      name: "LOJA 03 (DEMO CENTRO)",
      city: "Cidade Exemplo",
      state: "SP",
      active: true,
    },
    {
      id: "LOJA_01",
      companyId: "comp_demo_horizonte",
      code: "FIL01",
      name: "LOJA 01 (DEMO NORTE)",
      city: "Cidade Exemplo",
      state: "SP",
      active: true,
    },
    {
      id: "LOJA_02",
      companyId: "comp_demo_horizonte",
      code: "FIL02",
      name: "LOJA 02 (DEMO SUL)",
      city: "Cidade Exemplo",
      state: "SP",
      active: true,
    },
  ];

  const sectors = [
    { id: "SEC_ADM_OP", code: "ADM_OP", name: "GESTÃO OPERACIONAL", displayOrder: 1, minDailyCoverage: 1 },
    { id: "SEC_ACOUGUE", code: "ACOUGUE", name: "AÇOUGUE", displayOrder: 2, minDailyCoverage: 3 },
    { id: "SEC_CAIXA", code: "CAIXA", name: "FRENTE DE CAIXA", displayOrder: 3, minDailyCoverage: 4 },
    { id: "SEC_PADARIA", code: "PADARIA", name: "PADARIA E CONFEITARIA", displayOrder: 4, minDailyCoverage: 3 },
    { id: "SEC_REPOSICAO", code: "REPOSICAO", name: "MERCEARIA E REPOSIÇÃO", displayOrder: 5, minDailyCoverage: 3 },
    { id: "SEC_HORTI", code: "HORTIFRUTI", name: "HORTIFRUTI (FLV)", displayOrder: 6, minDailyCoverage: 2 },
    { id: "SEC_ESTOQUE", code: "ESTOQUE", name: "LOGÍSTICA E ESTOQUE", displayOrder: 7, minDailyCoverage: 2 },
    { id: "SEC_TI", code: "TI", name: "TECNOLOGIA E NOTAS", displayOrder: 8, minDailyCoverage: 1 },
  ];

  const unitSectors = sectors.map((s) => ({
    id: `us_demo_${s.id}`,
    unitId: "LOJA_03",
    sectorId: s.id,
    minDailyCoverage: s.minDailyCoverage,
    minSundayCoverage: Math.max(1, Math.floor(s.minDailyCoverage * 0.65)),
    active: true,
  }));

  const functionalCategories = [
    { id: "CAT_GESTAO", code: "GESTAO", name: "Gestão e Liderança Operacional", hierarchyLevel: 1 },
    { id: "CAT_PERECIVEIS", code: "PERECIVEIS", name: "Operação de Perecíveis", hierarchyLevel: 2 },
    { id: "CAT_ATENDIMENTO", code: "ATENDIMENTO", name: "Frente de Caixa e Atendimento", hierarchyLevel: 3 },
    { id: "CAT_MERCEARIA", code: "MERCEARIA", name: "Abastecimento e Mercearia", hierarchyLevel: 4 },
    { id: "CAT_LOGISTICA", code: "LOGISTICA", name: "Estoque e Logística", hierarchyLevel: 5 },
    { id: "CAT_APOIO", code: "APOIO", name: "Administrativo e TI", hierarchyLevel: 6 },
  ];

  const workShifts = [
    {
      id: "SH_GER_0700",
      code: "GER_0700_1800",
      name: "07:00 às 16:20 (c/ 1h40 compl. → 18:00)",
      shiftPeriod: "MANHÃ",
      entryTime: "07:00",
      breakStart: "11:00",
      breakEnd: "13:00",
      exitBaseTime: "16:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "18:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
      active: true,
    },
    {
      id: "SH_OP_MANHA_0640",
      code: "MANHA_0640_1700",
      name: "06:40 às 15:20 (c/ 1h40 compl. → 17:00)",
      shiftPeriod: "MANHÃ",
      entryTime: "06:40",
      breakStart: "11:00",
      breakEnd: "12:20",
      exitBaseTime: "15:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "17:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
      active: true,
    },
    {
      id: "SH_OP_TARDE_1130",
      code: "TARDE_1130_2150",
      name: "11:30 às 20:10 (c/ 1h40 compl. → 21:50)",
      shiftPeriod: "TARDE",
      entryTime: "11:30",
      breakStart: "15:30",
      breakEnd: "16:50",
      exitBaseTime: "20:10",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "21:50",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
      active: true,
    },
    {
      id: "SH_ADM_0800",
      code: "ADM_0800_1800",
      name: "08:00 às 17:20 (c/ 0h40 compl. → 18:00)",
      shiftPeriod: "INTEGRAL",
      entryTime: "08:00",
      breakStart: "12:00",
      breakEnd: "14:00",
      exitBaseTime: "17:20",
      baseWorkload: "07:20",
      extensionWorkload: "00:40",
      effectiveExitTime: "18:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
      active: true,
    },
  ];

  const scheduleRules = [
    {
      id: "RULE_5X1",
      code: "5X1",
      name: "5x1 Contínuo (5 dias trab. / 1 folga)",
      description: "Ciclo corrido de 5 dias trabalhados para 1 dia de folga, contínuo entre meses.",
      ruleType: "5X1",
      workDaysInCycle: 5,
      restDaysInCycle: 1,
      allowedRestDows: [],
      maxConsecutiveWorkDays: 5,
      requiresSundayLunchSlot: true,
      closedMarketCountsAsRest: false,
      effectiveFrom: "2026-01-01",
    },
    {
      id: "RULE_5X2",
      code: "5X2 (SAB/DOM)",
      name: "5x2 Administrativo (Sáb/Dom)",
      description: "Segunda a sexta com descanso fixo no Sábado e Domingo.",
      ruleType: "5X2",
      workDaysInCycle: 5,
      restDaysInCycle: 2,
      allowedRestDows: [6, 0],
      fixedWeekdays: true,
      maxConsecutiveWorkDays: 5,
      requiresSundayLunchSlot: false,
      closedMarketCountsAsRest: true,
      effectiveFrom: "2026-01-01",
    },
    {
      id: "RULE_6X1_DOM",
      code: "6X1 (DOM)",
      name: "6x1 Folga Fixa Domingo",
      description: "Segunda a sábado com folga fixa aos domingos.",
      ruleType: "6X1_DOM",
      workDaysInCycle: 6,
      restDaysInCycle: 1,
      allowedRestDows: [0],
      maxConsecutiveWorkDays: 6,
      requiresSundayLunchSlot: true,
      closedMarketCountsAsRest: true,
      effectiveFrom: "2026-01-01",
    },
    {
      id: "RULE_6X1_DOM_SEG",
      code: "6X1 (DOM/SEG)",
      name: "6x1 Revezamento (Dom / Seg)",
      description: "Revezamento semanal da folga entre Domingo e Segunda-feira.",
      ruleType: "6X1_FLEX",
      workDaysInCycle: 6,
      restDaysInCycle: 1,
      allowedRestDows: [0, 1],
      maxConsecutiveWorkDays: 7,
      requiresSundayLunchSlot: true,
      closedMarketCountsAsRest: false,
      effectiveFrom: "2026-01-01",
    },
    {
      id: "RULE_6X1_SAB_DOM_SEG",
      code: "6X1 (SAB/DOM/SEG)",
      name: "6x1 Revezamento (Sáb / Dom / Seg)",
      description: "Revezamento semanal da folga entre Sábado, Domingo e Segunda-feira.",
      ruleType: "6X1_FLEX",
      workDaysInCycle: 6,
      restDaysInCycle: 1,
      allowedRestDows: [6, 0, 1],
      maxConsecutiveWorkDays: 7,
      requiresSundayLunchSlot: true,
      closedMarketCountsAsRest: false,
      effectiveFrom: "2026-01-01",
    },
  ];

  const roles = [
    { id: "R_SUP_OP", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ADM_OP", code: "SUP_OP", name: "SUPERVISOR REGIONAL", hierarchyRank: 1, projectedMonthlyCost: 5200 },
    { id: "R_GERENTE", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ADM_OP", code: "GERENTE", name: "GERENTE DE LOJA", hierarchyRank: 2, projectedMonthlyCost: 4800 },
    { id: "R_SUB_GER", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ADM_OP", code: "SUB_GERENTE", name: "SUBGERENTE OPERACIONAL", hierarchyRank: 3, projectedMonthlyCost: 3600 },
    { id: "R_ENC_ACOUGUE", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ACOUGUE", code: "ENC_ACOUGUE", name: "ENCARREGADO DE AÇOUGUE", hierarchyRank: 4, projectedMonthlyCost: 3100 },
    { id: "R_ACOUGUEIRO", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_ACOUGUE", code: "ACOUGUEIRO", name: "AÇOUGUEIRO", hierarchyRank: 10, projectedMonthlyCost: 2450 },
    { id: "R_FISC_CAIXA", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_CAIXA", code: "FISCAL_CAIXA", name: "FISCAL DE CAIXA", hierarchyRank: 8, projectedMonthlyCost: 2300 },
    { id: "R_OP_CAIXA", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_CAIXA", code: "OP_CAIXA", name: "OPERADOR DE CAIXA", hierarchyRank: 15, projectedMonthlyCost: 1950 },
    { id: "R_ENC_PADARIA", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_PADARIA", code: "ENC_PADARIA", name: "ENCARREGADO DE PADARIA", hierarchyRank: 5, projectedMonthlyCost: 3000 },
    { id: "R_PADEIRO", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_PADARIA", code: "PADEIRO", name: "PADEIRO / CONFEITEIRO", hierarchyRank: 12, projectedMonthlyCost: 2350 },
    { id: "R_REPOSITOR", categoryId: "CAT_MERCEARIA", defaultSectorId: "SEC_REPOSICAO", code: "REPOSITOR", name: "REPOSITOR DE MERCEARIA", hierarchyRank: 18, projectedMonthlyCost: 1900 },
    { id: "R_OP_FLV", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_HORTI", code: "OP_FLV", name: "OPERADOR DE HORTIFRUTI", hierarchyRank: 18, projectedMonthlyCost: 1900 },
    { id: "R_CONFERENTE", categoryId: "CAT_LOGISTICA", defaultSectorId: "SEC_ESTOQUE", code: "CONFERENTE", name: "CONFERENTE DE ESTOQUE", hierarchyRank: 14, projectedMonthlyCost: 2200 },
    { id: "R_ANALISTA_TI", categoryId: "CAT_APOIO", defaultSectorId: "SEC_TI", code: "ANALISTA_TI", name: "TÉCNICO DE TI / NOTAS", hierarchyRank: 11, projectedMonthlyCost: 2800 },
  ];

  // Quadro Fictício de Postos e Colaboradores (26 postos: 24 próprios + 2 rateio)
  const demoRows = [
    // GESTÃO OPERACIONAL
    { code: "RAT-01", posNum: null, rateio: true, sec: "SEC_ADM_OP", role: "R_SUP_OP", title: "SUPERVISOR REGIONAL (RATEIO)", shift: "SH_GER_0700", rule: "RULE_6X1_DOM", empName: "RODRIGO MONTEIRO (DEMO)", posStatus: "FILLED" },
    { code: "01", posNum: 1, rateio: false, sec: "SEC_ADM_OP", role: "R_GERENTE", title: "GERENTE DE LOJA 01", shift: "SH_GER_0700", rule: "RULE_6X1_DOM", empName: "FERNANDA ALENCAR (DEMO)", posStatus: "FILLED" },
    { code: "02", posNum: 2, rateio: false, sec: "SEC_ADM_OP", role: "R_SUB_GER", title: "SUBGERENTE OPERACIONAL 01", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED", notes: "Vaga aberta autorizada para demonstração" },

    // AÇOUGUE
    { code: "03", posNum: 3, rateio: false, sec: "SEC_ACOUGUE", role: "R_ENC_ACOUGUE", title: "ENCARREGADO AÇOUGUE 01", shift: "SH_GER_0700", rule: "RULE_6X1_DOM", empName: "GUSTAVO NOGUEIRA (DEMO)", posStatus: "FILLED" },
    { code: "04", posNum: 4, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "MARCELO TAVARES (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-29" },
    { code: "05", posNum: 5, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "LEANDRO BARBOSA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-30" },
    { code: "06", posNum: 6, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 03", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "DIEGO SANTANA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-27", vacation: { start: "2026-11-05", end: "2026-11-19" } },
    { code: "07", posNum: 7, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 04", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "BRUNO CARDOSO (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-28" },

    // FRENTE DE CAIXA
    { code: "08", posNum: 8, rateio: false, sec: "SEC_CAIXA", role: "R_FISC_CAIXA", title: "FISCAL DE CAIXA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM_SEG", empName: "PATRICIA MOURA (DEMO)", posStatus: "FILLED" },
    { code: "09", posNum: 9, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "CAMILA ROCHA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-26" },
    { code: "10", posNum: 10, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "JULIANA CORREIA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-29", vacation: { start: "2026-10-05", end: "2026-10-24" } },
    { code: "11", posNum: 11, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 03", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "LARISSA MENDES (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-30" },
    { code: "12", posNum: 12, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 04", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "ALINE TEIXEIRA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-25" },
    { code: "13", posNum: 13, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 05", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: null, posStatus: "OPEN_AUTHORIZED" },

    // PADARIA E CONFEITARIA
    { code: "14", posNum: 14, rateio: false, sec: "SEC_PADARIA", role: "R_ENC_PADARIA", title: "ENCARREGADO PADARIA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "HENRIQUE DIAS (DEMO)", posStatus: "FILLED" },
    { code: "15", posNum: 15, rateio: false, sec: "SEC_PADARIA", role: "R_PADEIRO", title: "PADEIRO 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "EDUARDO FARIA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-28" },
    { code: "16", posNum: 16, rateio: false, sec: "SEC_PADARIA", role: "R_PADEIRO", title: "PADEIRO 02", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "BEATRIZ FREITAS (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-29" },
    { code: "17", posNum: 17, rateio: false, sec: "SEC_PADARIA", role: "R_PADEIRO", title: "CONFEITEIRA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "VANESSA LIMA (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-30", maternity: { start: "2026-10-15", end: "2026-12-31" } },

    // MERCEARIA E REPOSIÇÃO
    { code: "18", posNum: 18, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR MERCEARIA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_SAB_DOM_SEG", empName: "THIAGO ARAUJO (DEMO)", posStatus: "FILLED" },
    { code: "19", posNum: 19, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR MERCEARIA 02", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_SAB_DOM_SEG", empName: "CAIO VIANA (DEMO)", posStatus: "FILLED" },
    { code: "20", posNum: 20, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR MERCEARIA 03", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_SAB_DOM_SEG", empName: "RENATO PIRES (DEMO)", posStatus: "FILLED" },
    { code: "21", posNum: 21, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR MERCEARIA 04", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_SAB_DOM_SEG", empName: null, posStatus: "OPEN_UNPLANNED" },

    // HORTIFRUTI (FLV)
    { code: "22", posNum: 22, rateio: false, sec: "SEC_HORTI", role: "R_OP_FLV", title: "OPERADOR FLV 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "FELIPE CASTRO (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-27" },
    { code: "23", posNum: 23, rateio: false, sec: "SEC_HORTI", role: "R_OP_FLV", title: "OPERADOR FLV 02", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "IGOR RAMOS (DEMO)", posStatus: "FILLED", anchorRest: "2026-09-29" },

    // LOGÍSTICA E ESTOQUE
    { code: "24", posNum: 24, rateio: false, sec: "SEC_ESTOQUE", role: "R_CONFERENTE", title: "CONFERENTE DE ESTOQUE 01", shift: "SH_ADM_0800", rule: "RULE_5X2", empName: "SERGIO BATISTA (DEMO)", posStatus: "FILLED" },
    { code: "25", posNum: 25, rateio: false, sec: "SEC_ESTOQUE", role: "R_CONFERENTE", title: "CONFERENTE DE ESTOQUE 02", shift: "SH_ADM_0800", rule: "RULE_5X2", empName: "OTAVIO GOMES (DEMO)", posStatus: "FILLED" },

    // TECNOLOGIA E NOTAS (RATEIO)
    { code: "RAT-02", posNum: null, rateio: true, sec: "SEC_TI", role: "R_ANALISTA_TI", title: "TÉCNICO DE TI / NOTAS (RATEIO)", shift: "SH_ADM_0800", rule: "RULE_5X2", empName: "CLARA FONSECA (DEMO)", posStatus: "FILLED" },
  ];

  const workPositions = [];
  const employees = [];
  const allocations = [];
  const unavailabilityEvents = [];

  demoRows.forEach((r, idx) => {
    const posId = `POS_DEMO_${r.code}`;
    workPositions.push({
      id: posId,
      unitId: "LOJA_03",
      sectorId: r.sec,
      roleId: r.role,
      defaultShiftId: r.shift,
      defaultRuleId: r.rule,
      positionNumber: r.posNum,
      code: r.code,
      title: r.title,
      isSharedRateio: r.rateio,
      status: r.posStatus,
      estimatedMonthlyCost: null,
      authorizedBudget: null,
      notes: r.notes || "",
    });

    if (r.empName) {
      const empId = `EMP_DEMO_${String(idx + 1).padStart(3, "0")}`;
      const hireDate = "2025-03-01";
      const empStatus = r.vacation
        ? "ON_VACATION"
        : r.maternity
          ? "MATERNITY_LEAVE"
          : "ACTIVE";

      employees.push({
        id: empId,
        registrationCode: `DEMO-${String(5000 + idx + 1)}`,
        fullName: r.empName,
        homeUnitId: "LOJA_03",
        isSharedRateio: Boolean(r.rateio),
        authorizedUnitIds: r.rateio ? ["LOJA_03", "LOJA_01", "LOJA_02"] : ["LOJA_03"],
        rateioScheduleByDow: r.rateio
          ? {
              "1": { unitId: "LOJA_03", period: "INTEGRAL" },
              "2": { unitId: "LOJA_03", period: "INTEGRAL" },
              "3": { unitId: "LOJA_01", period: "INTEGRAL" },
              "4": { unitId: "LOJA_03", period: "INTEGRAL" },
              "5": { unitId: "LOJA_02", period: "INTEGRAL" },
              "6": { unitId: "LOJA_03", period: "INTEGRAL" },
            }
          : null,
        hireDate,
        terminationDate: null,
        noticePeriodEndDate: null,
        employmentStatus: empStatus,
        anchorLastRestDate: r.anchorRest || null,
        anchorCycleOffset: idx % 5,
        notes: "Colaborador fictício gerado para ambiente de demonstração isolado",
      });

      allocations.push({
        id: `ALLOC_DEMO_${empId}`,
        employeeId: empId,
        workPositionId: posId,
        unitId: "LOJA_03",
        sectorId: r.sec,
        roleId: r.role,
        workShiftId: r.shift,
        scheduleRuleId: r.rule,
        startDate: hireDate,
        endDate: null,
        transferReason: "Alocação fictícia inicial",
      });

      if (r.vacation) {
        unavailabilityEvents.push({
          id: `UNAV_DEMO_${empId}_VAC`,
          employeeId: empId,
          eventType: "VACATION",
          startDate: r.vacation.start,
          endDate: r.vacation.end,
          cycleBehavior: "RESET_ON_RETURN",
          notes: "Férias programadas (Dados Fictícios Demo)",
        });
      }

      if (r.maternity) {
        unavailabilityEvents.push({
          id: `UNAV_DEMO_${empId}_MAT`,
          employeeId: empId,
          eventType: "MATERNITY_LEAVE",
          startDate: r.maternity.start,
          endDate: r.maternity.end,
          cycleBehavior: "RESET_ON_RETURN",
          notes: "Licença Maternidade (Dados Fictícios Demo)",
        });
      }
    }
  });

  const marketCalendarDays = [
    {
      id: "MC_DEMO_2026_10_12",
      unitId: "LOJA_03",
      calendarDate: "2026-10-12",
      dayType: "HOLIDAY",
      openingMode: "FULL_DAY",
      description: "Feriado Nacional Outubro (Demo)",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.5,
    },
    {
      id: "MC_DEMO_2026_11_02",
      unitId: "LOJA_03",
      calendarDate: "2026-11-02",
      dayType: "HOLIDAY",
      openingMode: "HALF_DAY",
      description: "Feriado Finados — Meio Expediente até 13:00 (Demo)",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.0,
    },
    {
      id: "MC_DEMO_2026_11_15",
      unitId: "LOJA_03",
      calendarDate: "2026-11-15",
      dayType: "HOLIDAY",
      openingMode: "FULL_DAY",
      description: "Proclamação da República (Demo)",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.5,
    },
  ];

  const rulesById = Object.fromEntries(scheduleRules.map((r) => [r.id, r]));
  const shiftsById = Object.fromEntries(workShifts.map((s) => [s.id, s]));
  const calByDate = Object.fromEntries(marketCalendarDays.map((c) => [c.calendarDate, c]));

  const octoberEntries = [];
  const novemberEntries = [];
  const cycleStates = [];

  employees.forEach((emp, empIdx) => {
    const octRes = generateEmployeeScheduleForMonth({
      employee: emp,
      yearMonth: "2026-10",
      allocations,
      rulesById,
      unavailabilityEvents,
      marketCalendarByDate: calByDate,
      employeeRotationRank: empIdx,
    });

    octoberEntries.push(...octRes.entries.map((e) => ({ ...e, origin: "VALIDATED" })));
    cycleStates.push({
      ...octRes.endCycleState,
      yearMonth: "2026-10",
    });

    const novRes = generateEmployeeScheduleForMonth({
      employee: emp,
      yearMonth: "2026-11",
      allocations,
      rulesById,
      unavailabilityEvents,
      marketCalendarByDate: calByDate,
      previousMonthEntries: octRes.entries,
      previousCycleState: octRes.endCycleState,
      employeeRotationRank: empIdx,
    });

    novemberEntries.push(...novRes.entries);
    cycleStates.push({
      ...novRes.endCycleState,
      yearMonth: "2026-11",
    });
  });

  const balancedOctober = balanceSectorSundayLunchSlots({
    entries: octoberEntries,
    allocations,
    shiftsById,
    preserveManual: true,
  });

  const balancedNovember = balanceSectorSundayLunchSlots({
    entries: novemberEntries,
    allocations,
    shiftsById,
    preserveManual: true,
  });

  return {
    version: "8.0.0-ERP",
    schemaRevision: 1,
    companies,
    units,
    sectors,
    unitSectors,
    functionalCategories,
    roles,
    workShifts,
    scheduleRules,
    ruleAssignments: [],
    workPositions,
    employees,
    allocations,
    unavailabilityEvents,
    marketCalendarDays,
    monthlySchedules: [
      {
        id: "MS_DEMO_LOJA_03_2026_10",
        unitId: "LOJA_03",
        yearMonth: "2026-10",
        status: "VALIDATED",
        versionNumber: 1,
        versionHistory: [],
        impactWarning: null,
      },
      {
        id: "MS_DEMO_LOJA_03_2026_11",
        unitId: "LOJA_03",
        yearMonth: "2026-11",
        status: "DRAFT",
        versionNumber: 1,
        versionHistory: [],
        impactWarning: null,
      },
    ],
    dailyEntriesByMonth: {
      "2026-10": balancedOctober,
      "2026-11": balancedNovember,
    },
    cycleStates,
    userProfiles: [
      {
        id: "USR_DEMO_01",
        email: "instrutor.autotour@horizontedemo.com.br",
        fullName: "Helena Martins (Instrutora AutoTour)",
        roleProfile: "ADMIN",
        authorizedUnits: ["LOJA_03", "LOJA_01", "LOJA_02"],
        active: true,
      },
    ],
    auditLogs: [
      {
        id: "LOG_DEMO_INIT_01",
        timestamp: "2026-11-05T12:00:00.000Z",
        actorEmail: "sistema.sandbox@horizontedemo.com.br",
        actorName: "Sandbox Isolado AutoTour AI",
        actorRole: "ADMIN",
        authVerificationStatus: "SYSTEM_SEED",
        originType: "SYSTEM_MIGRATION",
        module: "SANDBOX_SECURITY",
        action: "INICIALIZAR_BASE_FICTICIA_ISOLADA",
        entityType: "SYSTEM",
        entityId: "DEMO_SEED_V8",
        summary: "Ambiente de demonstração inicializado exclusivamente com dados fictícios e bloqueio de rede ativo.",
      },
    ],
  };
}
