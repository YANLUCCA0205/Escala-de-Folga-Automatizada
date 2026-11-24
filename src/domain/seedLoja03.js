// =============================================================================
// SEED OFICIAL DO ERP — EXTRAÍDO INTEGRALMENTE DA PLANILHA REAL DA LOJA 03
// EMPRESA: YUARA PRESTADORA SERVIÇOS LJ 03 LTDA - CNPJ: 40.633.037/0001-71
// Inclui: Empresas, Unidades, Setores, Categorias, Funções, Jornadas Contratuais,
// Regras de Escala (5x1, 5x2, 6x1 Dom, 6x1 Flex), 74 Postos (70 Próprios + 4 Rateio),
// Colaboradores, Eventos de Férias/INSS/Aviso Prévio, Calendário de Mercado e
// Continuidade Real Setembro -> Outubro -> Novembro/2026.
// =============================================================================

import {
  generateEmployeeScheduleForMonth,
  balanceSectorSundayLunchSlots,
} from "./scheduleEngine.js";

export function buildInitialErpDatabase() {
  const companies = [
    {
      id: "comp_yuara_03",
      legalName: "YUARA PRESTADORA SERVIÇOS LJ 03 LTDA",
      tradeName: "União Supermercados — Loja 03",
      cnpj: "40.633.037/0001-71",
      active: true,
    },
  ];

  const units = [
    {
      id: "LOJA_03",
      companyId: "comp_yuara_03",
      code: "LJ03",
      name: "LOJA 03",
      address: "Rod. BR 262 KM 876 N. 345",
      phone: "(34) 3322-1010",
      city: "Campo Florido",
      state: "MG",
      active: true,
    },
    {
      id: "LOJA_01",
      companyId: "comp_yuara_03",
      code: "LJ01",
      name: "LOJA 01",
      address: "Av. Brasil, 740",
      phone: "(34) 3321-3147",
      city: "Conceição das Alagoas",
      state: "MG",
      active: true,
    },
    {
      id: "LOJA_02",
      companyId: "comp_yuara_03",
      code: "LJ02",
      name: "LOJA 02",
      address: "R. Presidente Vargas, 451",
      phone: "(34) 3321-3809",
      city: "Conceição das Alagoas",
      state: "MG",
      active: true,
    },
  ];

  const sectors = [
    { id: "SEC_ADM_OP", code: "ADM_OP", name: "ADMINISTRATIVO OPERACIONAL", displayOrder: 1, minDailyCoverage: 1 },
    { id: "SEC_ACOUGUE", code: "ACOUGUE", name: "AÇOUGUE", displayOrder: 2, minDailyCoverage: 4 },
    { id: "SEC_CAIXA", code: "CAIXA", name: "CAIXA", displayOrder: 3, minDailyCoverage: 8 },
    { id: "SEC_PACOTE", code: "CAIXA_PACOTE", name: "CAIXA/PACOTE", displayOrder: 4, minDailyCoverage: 0 },
    { id: "SEC_ENTREGA", code: "ENTREGA", name: "ENTREGA", displayOrder: 5, minDailyCoverage: 3 },
    { id: "SEC_ESTOQUE", code: "ESTOQUE", name: "ESTOQUE", displayOrder: 6, minDailyCoverage: 2 },
    { id: "SEC_HORTI", code: "HORTIFRUTI", name: "HORTIFRUTI", displayOrder: 7, minDailyCoverage: 1 },
    { id: "SEC_LIMPEZA", code: "LIMPEZA", name: "LIMPEZA", displayOrder: 8, minDailyCoverage: 1 },
    { id: "SEC_PADARIA", code: "PADARIA", name: "PADARIA", displayOrder: 9, minDailyCoverage: 6 },
    { id: "SEC_REPOSICAO", code: "REPOSICAO", name: "REPOSIÇÃO/MERCEARIA", displayOrder: 10, minDailyCoverage: 6 },
    { id: "SEC_FINANCEIRO", code: "FINANCEIRO", name: "FINANCEIRO", displayOrder: 11, minDailyCoverage: 1 },
    { id: "SEC_TI", code: "TI", name: "TI / LANÇAMENTO DE NOTAS", displayOrder: 12, minDailyCoverage: 1 },
    { id: "SEC_PREVENCAO", code: "PREVENCAO", name: "PREVENÇÃO DE PERDAS", displayOrder: 13, minDailyCoverage: 1 },
  ];

  const unitSectors = sectors.map((s) => ({
    id: `us_lj03_${s.id}`,
    unitId: "LOJA_03",
    sectorId: s.id,
    minDailyCoverage: s.minDailyCoverage,
    minSundayCoverage: Math.max(0, Math.floor(s.minDailyCoverage * 0.6)),
    active: true,
  }));

  const functionalCategories = [
    { id: "CAT_GESTAO", code: "GESTAO", name: "Gestão e Liderança Operacional", hierarchyLevel: 1 },
    { id: "CAT_PERECIVEIS", code: "PERECIVEIS", name: "Operação de Perecíveis (Açougue, Padaria, FLV)", hierarchyLevel: 2 },
    { id: "CAT_ATENDIMENTO", code: "ATENDIMENTO", name: "Frente de Caixa e Atendimento", hierarchyLevel: 3 },
    { id: "CAT_MERCEARIA", code: "MERCEARIA", name: "Abastecimento e Mercearia", hierarchyLevel: 4 },
    { id: "CAT_LOGISTICA", code: "LOGISTICA", name: "Estoque, Recebimento e Entrega", hierarchyLevel: 5 },
    { id: "CAT_APOIO", code: "APOIO", name: "Administrativo, Financeiro, TI, Prevenção e Zelo", hierarchyLevel: 6 },
  ];

  const workShifts = [
    {
      id: "SH_SUP_0800",
      code: "SUP_0800_1940",
      name: "08:00 às 18:00 (c/ 1h40 compl. → 19:40)",
      shiftPeriod: "MANHÃ",
      entryTime: "08:00",
      breakStart: "12:00",
      breakEnd: "14:00",
      exitBaseTime: "18:00",
      baseWorkload: "08:00",
      extensionWorkload: "01:40",
      effectiveExitTime: "19:40",
      contractDailyWorkload: "08:00",
      weeklyHours: 44,
    },
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
    },
    {
      id: "SH_SUB_1000",
      code: "SUB_1000_2100",
      name: "10:00 às 19:20 (c/ 1h40 compl. → 21:00)",
      shiftPeriod: "TARDE",
      entryTime: "10:00",
      breakStart: "13:00",
      breakEnd: "15:00",
      exitBaseTime: "19:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "21:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_OP_MANHA_0640",
      code: "MANHA_0640_1710",
      name: "06:40 às 15:30 (c/ 1h40 compl. → 17:10)",
      shiftPeriod: "MANHÃ",
      entryTime: "06:40",
      breakStart: "11:30",
      breakEnd: "13:00",
      exitBaseTime: "15:30",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "17:10",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_OP_TARDE_1130",
      code: "TARDE_1130_2200",
      name: "11:30 às 20:20 (c/ 1h40 compl. → 22:00)",
      shiftPeriod: "TARDE",
      entryTime: "11:30",
      breakStart: "14:00",
      breakEnd: "15:30",
      exitBaseTime: "20:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "22:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_FISC_0640",
      code: "FISC_0640_1740",
      name: "06:40 às 16:00 (c/ 1h40 compl. → 17:40)",
      shiftPeriod: "MANHÃ",
      entryTime: "06:40",
      breakStart: "11:00",
      breakEnd: "13:00",
      exitBaseTime: "16:00",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "17:40",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_TRANSP_0730",
      code: "TRANSP_0730_1830",
      name: "07:30 às 16:50 (c/ 1h40 compl. → 18:30)",
      shiftPeriod: "MANHÃ",
      entryTime: "07:30",
      breakStart: "11:00",
      breakEnd: "13:00",
      exitBaseTime: "16:50",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "18:30",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_MOT_1030",
      code: "MOT_1030_2100",
      name: "10:30 às 19:20 (c/ 1h40 compl. → 21:00)",
      shiftPeriod: "TARDE",
      entryTime: "10:30",
      breakStart: "13:00",
      breakEnd: "14:30",
      exitBaseTime: "19:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "21:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_EST_0700",
      code: "EST_0700_1810",
      name: "07:00 às 16:30 (c/ 1h40 compl. → 18:10)",
      shiftPeriod: "MANHÃ",
      entryTime: "07:00",
      breakStart: "12:00",
      breakEnd: "13:30",
      exitBaseTime: "16:30",
      baseWorkload: "08:00",
      extensionWorkload: "01:40",
      effectiveExitTime: "18:10",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_FLV_MANHA_0700",
      code: "FLV_0700_1730",
      name: "07:00 às 15:50 (c/ 1h40 compl. → 17:30)",
      shiftPeriod: "MANHÃ",
      entryTime: "07:00",
      breakStart: "11:30",
      breakEnd: "13:00",
      exitBaseTime: "15:50",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "17:30",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_FLV_TARDE_1130",
      code: "FLV_1130_2200",
      name: "11:30 às 20:20 (Int. 13:00-14:30 → 22:00)",
      shiftPeriod: "TARDE",
      entryTime: "11:30",
      breakStart: "13:00",
      breakEnd: "14:30",
      exitBaseTime: "20:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "22:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_PAD_ENC_0600",
      code: "PAD_0600_1700",
      name: "06:00 às 15:20 (c/ 1h40 compl. → 17:00)",
      shiftPeriod: "MANHÃ",
      entryTime: "06:00",
      breakStart: "11:00",
      breakEnd: "13:00",
      exitBaseTime: "15:20",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "17:00",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_PAD_AUX_0600",
      code: "PAD_0600_1630",
      name: "06:00 às 14:50 (c/ 1h40 compl. → 16:30)",
      shiftPeriod: "MANHÃ",
      entryTime: "06:00",
      breakStart: "11:30",
      breakEnd: "13:00",
      exitBaseTime: "14:50",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "16:30",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
    {
      id: "SH_PAD_INT_0800",
      code: "PAD_0800_1830",
      name: "08:00 às 16:50 (c/ 1h40 compl. → 18:30)",
      shiftPeriod: "MANHÃ",
      entryTime: "08:00",
      breakStart: "13:00",
      breakEnd: "14:30",
      exitBaseTime: "16:50",
      baseWorkload: "07:20",
      extensionWorkload: "01:40",
      effectiveExitTime: "18:30",
      contractDailyWorkload: "07:20",
      weeklyHours: 44,
    },
  ];

  const scheduleRules = [
    {
      id: "RULE_5X1",
      code: "5X1",
      name: "5x1 Contínuo (5 dias trab. / 1 folga)",
      description: "Ciclo corrido de 5 dias de trabalho seguidos por 1 dia de descanso, contínuo entre meses. Trabalha domingos conforme escala com intervalo N01-N04.",
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
      name: "5x2 Administrativo / Operacional (Sáb/Dom)",
      description: "5 dias trabalhados de segunda a sexta com 2 dias de descanso no final de semana (Sábado e Domingo).",
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
      description: "Trabalha de segunda a sábado com descanso semanal remunerado fixo aos domingos (ou revezamento pontual em feriados/domingos autorizados).",
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
      description: "Revezamento semanal da folga entre Domingo e Segunda-feira para assegurar cobertura de equipe aos domingos.",
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
      id: "RULE_6X1_SAB_DOM",
      code: "6X1 (SAB/DOM)",
      name: "6x1 Revezamento (Sáb / Dom)",
      description: "Revezamento semanal da folga entre Sábado e Domingo (comum no setor Hortifruti/FLV).",
      ruleType: "6X1_FLEX",
      workDaysInCycle: 6,
      restDaysInCycle: 1,
      allowedRestDows: [6, 0],
      maxConsecutiveWorkDays: 7,
      requiresSundayLunchSlot: true,
      closedMarketCountsAsRest: false,
      effectiveFrom: "2026-01-01",
    },
    {
      id: "RULE_6X1_SAB_DOM_SEG",
      code: "6X1 (SAB/DOM/SEG)",
      name: "6x1 Revezamento (Sáb / Dom / Seg)",
      description: "Revezamento semanal da folga entre Sábado, Domingo e Segunda-feira (comum no setor Reposição/Mercearia).",
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

  // Catálogo de Funções (Roles)
  const roles = [
    { id: "R_SUP_OP", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ADM_OP", code: "SUP_OP", name: "SUPERVISOR OPERACIONAL", hierarchyRank: 1 },
    { id: "R_GERENTE", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ADM_OP", code: "GERENTE", name: "GERENTE", hierarchyRank: 2 },
    { id: "R_SUB_GER", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ADM_OP", code: "SUB_GERENTE", name: "SUB GERENTE", hierarchyRank: 3 },
    { id: "R_ENC_ACOUGUE", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ACOUGUE", code: "ENC_ACOUGUE", name: "ENCAR. AÇOUGUE", hierarchyRank: 4 },
    { id: "R_ACOUGUEIRO", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_ACOUGUE", code: "ACOUGUEIRO", name: "AÇOUGUEIRO", hierarchyRank: 15 },
    { id: "R_AUX_ACOUGUE", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_ACOUGUE", code: "AUX_ACOUGUE", name: "AUXILIAR DE AÇOUGUE", hierarchyRank: 20 },
    { id: "R_FISC_CAIXA", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_CAIXA", code: "FISCAL_CAIXA", name: "FISCAL DE CAIXA", hierarchyRank: 10 },
    { id: "R_OP_CX_REC", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_CAIXA", code: "OP_CX_RECEP", name: "OPERADOR DE CAIXA/ RECEPÇÃO", hierarchyRank: 16 },
    { id: "R_OP_CX_DEL", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_CAIXA", code: "OP_CX_DELIV", name: "OPERADOR DE CAIXA/ DELIVERY", hierarchyRank: 17 },
    { id: "R_OP_CAIXA", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_CAIXA", code: "OP_CAIXA", name: "OPERADOR DE CAIXA", hierarchyRank: 18 },
    { id: "R_OP_LOJA_PAC", categoryId: "CAT_ATENDIMENTO", defaultSectorId: "SEC_PACOTE", code: "OP_LOJA_PAC", name: "OPERADOR DE LOJA (PACOTE)", hierarchyRank: 22 },
    { id: "R_ENC_TRANSP", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ENTREGA", code: "ENC_TRANSP", name: "ENCAR. DE TRANSPORTES", hierarchyRank: 5 },
    { id: "R_MOTORISTA", categoryId: "CAT_LOGISTICA", defaultSectorId: "SEC_ENTREGA", code: "MOTORISTA", name: "MOTORISTA", hierarchyRank: 25 },
    { id: "R_AJUD_MOT", categoryId: "CAT_LOGISTICA", defaultSectorId: "SEC_ENTREGA", code: "AJUD_MOT", name: "AJUDANTE DE MOTORISTA", hierarchyRank: 26 },
    { id: "R_ENC_ESTOQUE", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_ESTOQUE", code: "ENC_ESTOQUE", name: "ENCAR. DE ESTOQUE", hierarchyRank: 6 },
    { id: "R_CONFERENTE", categoryId: "CAT_LOGISTICA", defaultSectorId: "SEC_ESTOQUE", code: "CONFERENTE", name: "CONFERENTE", hierarchyRank: 24 },
    { id: "R_AUX_ESTOQUE", categoryId: "CAT_LOGISTICA", defaultSectorId: "SEC_ESTOQUE", code: "AUX_ESTOQUE", name: "AUXILIAR DE ESTOQUE", hierarchyRank: 27 },
    { id: "R_ENC_FLV", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_HORTI", code: "ENC_FLV", name: "ENCAR. FLV", hierarchyRank: 7 },
    { id: "R_OP_LOJA_FLV", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_HORTI", code: "OP_LOJA_FLV", name: "OPERADOR DE LOJA (FLV)", hierarchyRank: 21 },
    { id: "R_AUX_LIMPEZA", categoryId: "CAT_APOIO", defaultSectorId: "SEC_LIMPEZA", code: "AUX_LIMPEZA", name: "AUXILIAR LIMPEZA", hierarchyRank: 30 },
    { id: "R_ENC_PADARIA", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_PADARIA", code: "ENC_PADARIA", name: "ENCAR. PADARIA", hierarchyRank: 8 },
    { id: "R_SUB_PADARIA", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_PADARIA", code: "SUB_ENC_PAD", name: "SUB ENCAR PADARIA", hierarchyRank: 9 },
    { id: "R_CONFEITEIRA", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_PADARIA", code: "CONFEITEIRA", name: "CONFEITEIRA", hierarchyRank: 19 },
    { id: "R_AUX_PADARIA", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_PADARIA", code: "AUX_PADARIA", name: "AUXILIAR DE PADARIA", hierarchyRank: 22 },
    { id: "R_BALCONISTA", categoryId: "CAT_PERECIVEIS", defaultSectorId: "SEC_PADARIA", code: "BALCONISTA", name: "BALCONISTA", hierarchyRank: 21 },
    { id: "R_SUB_REPOS", categoryId: "CAT_GESTAO", defaultSectorId: "SEC_REPOSICAO", code: "SUB_ENC_REP", name: "SUB ENCAR. REPOSIÇÃO", hierarchyRank: 9 },
    { id: "R_REP_ASSIST", categoryId: "CAT_MERCEARIA", defaultSectorId: "SEC_REPOSICAO", code: "REP_ASSIST", name: "REPOSITOR ASSISTENTE", hierarchyRank: 18 },
    { id: "R_REPOSITOR", categoryId: "CAT_MERCEARIA", defaultSectorId: "SEC_REPOSICAO", code: "REPOSITOR", name: "REPOSITOR", hierarchyRank: 19 },
    { id: "R_AUX_TESOUR", categoryId: "CAT_APOIO", defaultSectorId: "SEC_FINANCEIRO", code: "AUX_TESOUR", name: "AUXILIAR TESOURARIA", hierarchyRank: 14 },
    { id: "R_LANC_NOTA", categoryId: "CAT_APOIO", defaultSectorId: "SEC_TI", code: "LANC_NOTA", name: "LANÇADOR DE NOTA", hierarchyRank: 14 },
    { id: "R_AUX_PREV", categoryId: "CAT_APOIO", defaultSectorId: "SEC_PREVENCAO", code: "AUX_PREV", name: "AUXILIAR DE PREV. DE PERDAS", hierarchyRank: 23 },
  ];

  // Definição integral dos 74 postos da Loja 03 (extraídos linha a linha da planilha de Outubro/2026)
  // Inclui âncora de última folga em Setembro/Outubro e escala de intervalos de almoço nos Domingos/Feriado (04/10, 11/10, 12/10, 18/10, 25/10)
  const rawRows = [
    // ADMINISTRATIVO OPERACIONAL
    { code: "RATEIO-01", posNum: null, rateio: true, sec: "SEC_ADM_OP", role: "R_SUP_OP", title: "SUPERVISOR OPERACIONAL", shift: "SH_SUP_0800", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED", notes: "Posto compartilhado (Rateio)" },
    { code: "01", posNum: 1, rateio: false, sec: "SEC_ADM_OP", role: "R_GERENTE", title: "GERENTE", shift: "SH_GER_0700", rule: "RULE_6X1_DOM", empName: "ANDRÉ LUIZ", posStatus: "FILLED" },
    { code: "02", posNum: 2, rateio: false, sec: "SEC_ADM_OP", role: "R_SUB_GER", title: "SUB GERENTE", shift: "SH_SUB_1000", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED" },

    // AÇOUGUE
    { code: "03", posNum: 3, rateio: false, sec: "SEC_ACOUGUE", role: "R_ENC_ACOUGUE", title: "ENCAR. AÇOUGUE", shift: "SH_GER_0700", rule: "RULE_6X1_DOM", empName: "ELIAS SANTIAGO", posStatus: "FILLED" },
    { code: "04", posNum: 4, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "DANIEL ANTUNES", posStatus: "FILLED", notes: "6X1 (DOM) - DESOSSADOR" },
    { code: "05", posNum: 5, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "ARLINDO EMANUEL", posStatus: "FILLED", anchorRest: "2026-09-29", octSlots: { "2026-10-12": "3", "2026-10-18": "2", "2026-10-25": "1" } },
    { code: "06", posNum: 6, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 03", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "GABRIEL MENZOTTI", posStatus: "FILLED", anchorRest: "2026-09-30", octSlots: { "2026-10-04": "1", "2026-10-11": "4", "2026-10-25": "2" } },
    { code: "07", posNum: 7, rateio: false, sec: "SEC_ACOUGUE", role: "R_ACOUGUEIRO", title: "AÇOUGUEIRO 04", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "WANDER MACHADO", posStatus: "FILLED", anchorRest: "2026-09-25", notes: "AUMENTO DE QUADRO DE AÇOUGUEIRO AUTORIZADO PELA NINIVE EM 28/07", octSlots: { "2026-10-04": "2", "2026-10-11": "1", "2026-10-12": "4", "2026-10-18": "3" } },
    { code: "08", posNum: 8, rateio: false, sec: "SEC_ACOUGUE", role: "R_AUX_ACOUGUE", title: "AUXILIAR DE AÇOUGUE 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "AKSUELSON ALVES", posStatus: "FILLED", anchorRest: "2026-09-26", notes: "FOLGA EM 01/11", octSlots: { "2026-10-04": "3", "2026-10-12": "1", "2026-10-18": "4", "2026-10-25": "3" } },
    { code: "09", posNum: 9, rateio: false, sec: "SEC_ACOUGUE", role: "R_AUX_ACOUGUE", title: "AUXILIAR DE AÇOUGUE 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "ZAIR HENRIQUE", posStatus: "FILLED", anchorRest: "2026-09-27", notes: "FOLGA EM 02/11", octSlots: { "2026-10-04": "4", "2026-10-11": "2", "2026-10-25": "4" } },
    { code: "10", posNum: 10, rateio: false, sec: "SEC_ACOUGUE", role: "R_AUX_ACOUGUE", title: "AUXILIAR DE AÇOUGUE 04", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "LUCAS JEAN", posStatus: "FILLED", anchorRest: "2026-09-28", notes: "CONTRATADO PARA A VAGA DO JOSÉ MARCONES - MODIFICAR AS FOLGAS NA PROXIMA ESCALA (FOLGA EM 03/11)", octSlots: { "2026-10-11": "3", "2026-10-12": "2", "2026-10-18": "1", "2026-10-25": "4" } },

    // CAIXA
    { code: "11", posNum: 11, rateio: false, sec: "SEC_CAIXA", role: "R_FISC_CAIXA", title: "FISCAL DE CAIXA 01", shift: "SH_FISC_0640", rule: "RULE_6X1_DOM_SEG", empName: "DENIS FERREIRA", posStatus: "FILLED" },
    { code: "12", posNum: 12, rateio: false, sec: "SEC_CAIXA", role: "R_FISC_CAIXA", title: "FISCAL DE CAIXA 02", shift: "SH_SUB_1000", rule: "RULE_6X1_DOM_SEG", empName: "EVANILDA DIAS", posStatus: "FILLED" },
    { code: "13", posNum: 13, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CX_REC", title: "OPERADOR DE CAIXA/ RECEPÇÃO 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "CRISLANE ALVES", posStatus: "FILLED", octSlots: { "2026-10-12": "1" } },
    { code: "14", posNum: 14, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CX_REC", title: "OPERADOR DE CAIXA/ RECEPÇÃO 02", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: "INDIARA MATIAS", posStatus: "FILLED" },
    { code: "15", posNum: 15, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CX_DEL", title: "OPERADOR DE CAIXA/ DELIVERY 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "DANIELA FAGUNDES", posStatus: "FILLED", octSlots: { "2026-10-12": "2" } },
    { code: "16", posNum: 16, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CX_DEL", title: "OPERADOR DE CAIXA/ DELIVERY 02", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: "JARDIELE SILVA", posStatus: "FILLED" },
    { code: "17", posNum: 17, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "TAISLAINE SANTOS", posStatus: "FILLED", anchorRest: "2026-09-29", octSlots: { "2026-10-04": "1", "2026-10-12": "3", "2026-10-25": "2" } },
    { code: "18", posNum: 18, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "IARA GONÇALVES", posStatus: "OPEN_AUTHORIZED", noticeEnd: "2026-10-28", anchorRest: "2026-09-25", notes: "IARA GONÇALVES - FINAL DO AVISO EM 28/10 (Vaga em aberto para Novembro)", octSlots: { "2026-10-04": "2", "2026-10-11": "4", "2026-10-12": "4", "2026-10-18": "3" } },
    { code: "19", posNum: 19, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 03", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "ELAINE GOMES", posStatus: "OPEN_AUTHORIZED", noticeEnd: "2026-10-24", anchorRest: "2026-09-28", notes: "ELAINE GOMES - FINAL DO AVISO EM 24/10 (Vaga em aberto para Novembro)", octSlots: { "2026-10-11": "1", "2026-10-12": "1", "2026-10-18": "4", "2026-10-25": "3" } },
    { code: "20", posNum: 20, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 04", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "ELIANE ARAUJO", posStatus: "FILLED", vacation: { start: "2026-10-01", end: "2026-10-30" }, anchorRest: "2026-10-30", notes: "FÉRIAS EM 01/10 ATÉ 30/10 (Retorna em 31/10)" },
    { code: "21", posNum: 21, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 05", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: null, posStatus: "FROZEN", notes: "EDUARDO ROCHA - Não vai contratar no momento" },
    { code: "22", posNum: 22, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 06", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "TATIANE TEIXEIRA", posStatus: "FILLED", anchorRest: "2026-09-29", octSlots: { "2026-10-04": "3", "2026-10-12": "2", "2026-10-18": "1", "2026-10-25": "4" } },
    { code: "23", posNum: 23, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 07", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "CLEONICE SANTOS", posStatus: "FILLED", anchorRest: "2026-09-30", octSlots: { "2026-10-04": "4", "2026-10-11": "2", "2026-10-25": "1" } },
    { code: "24", posNum: 24, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 08", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "MARIA CAROLAYNE", posStatus: "FILLED", anchorRest: "2026-09-25", octSlots: { "2026-10-04": "1", "2026-10-12": "3", "2026-10-18": "2" } },
    { code: "25", posNum: 25, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 09", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "LAUANDA SILVA", posStatus: "FILLED", anchorRest: "2026-09-26", notes: "FOLGA EM 01/11", octSlots: { "2026-10-04": "2", "2026-10-11": "4", "2026-10-12": "4", "2026-10-25": "2" } },
    { code: "26", posNum: 26, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 10", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "FLÁVIA GOMES", posStatus: "FILLED", anchorRest: "2026-09-27", notes: "FOLGA EM 02/11", octSlots: { "2026-10-04": "3", "2026-10-12": "1", "2026-10-18": "3", "2026-10-25": "3" } },
    { code: "27", posNum: 27, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 11", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "ALICE JACIELLE", posStatus: "FILLED", anchorRest: "2026-09-28", notes: "FOLGA EM 03/11", octSlots: { "2026-10-11": "3", "2026-10-18": "4", "2026-10-25": "4" } },
    { code: "28", posNum: 28, rateio: false, sec: "SEC_CAIXA", role: "R_OP_CAIXA", title: "OPERADOR DE CAIXA 12", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: null, posStatus: "FROZEN", notes: "CARGO VAGO - MARIA DARLLA foi demitida - Não vai contratar no momento" },

    // CAIXA/PACOTE
    { code: "29", posNum: 29, rateio: false, sec: "SEC_PACOTE", role: "R_OP_LOJA_PAC", title: "OPERADOR DE LOJA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: null, posStatus: "OPEN_UNPLANNED" },
    { code: "30", posNum: 30, rateio: false, sec: "SEC_PACOTE", role: "R_OP_LOJA_PAC", title: "OPERADOR DE LOJA 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: null, posStatus: "OPEN_UNPLANNED" },
    { code: "31", posNum: 31, rateio: false, sec: "SEC_PACOTE", role: "R_OP_LOJA_PAC", title: "OPERADOR DE LOJA 03", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: null, posStatus: "OPEN_UNPLANNED" },

    // ENTREGA
    { code: "RATEIO-02", posNum: null, rateio: true, sec: "SEC_ENTREGA", role: "R_ENC_TRANSP", title: "ENCAR. DE TRANSPORTES", shift: "SH_TRANSP_0730", rule: "RULE_6X1_DOM", empName: "WELLINGTON RAMOS", posStatus: "FILLED", notes: "Posto compartilhado (Rateio)" },
    { code: "32", posNum: 32, rateio: false, sec: "SEC_ENTREGA", role: "R_MOTORISTA", title: "MOTORISTA 01", shift: "SH_MOT_1030", rule: "RULE_6X1_DOM", empName: "DIEGO HENRIQUE", posStatus: "FILLED" },
    { code: "33", posNum: 33, rateio: false, sec: "SEC_ENTREGA", role: "R_MOTORISTA", title: "MOTORISTA 02", shift: "SH_MOT_1030", rule: "RULE_6X1_DOM", empName: "JOAO VICTOR", posStatus: "FILLED" },
    { code: "34", posNum: 34, rateio: false, sec: "SEC_ENTREGA", role: "R_AJUD_MOT", title: "AJUDANTE DE MOTORISTA 01", shift: "SH_MOT_1030", rule: "RULE_6X1_DOM", empName: "RICHARLISSON PERREIRA", posStatus: "FILLED" },
    { code: "35", posNum: 35, rateio: false, sec: "SEC_ENTREGA", role: "R_AJUD_MOT", title: "AJUDANTE DE MOTORISTA 02", shift: "SH_MOT_1030", rule: "RULE_6X1_DOM", empName: "JOSÉ CÂNDIDO", posStatus: "FILLED" },

    // ESTOQUE
    { code: "RATEIO-03", posNum: null, rateio: true, sec: "SEC_ESTOQUE", role: "R_ENC_ESTOQUE", title: "ENCAR. DE ESTOQUE", shift: "SH_EST_0700", rule: "RULE_6X1_DOM", empName: "JEFERSON JUSTINO", posStatus: "FILLED", notes: "Posto compartilhado (Rateio)" },
    { code: "36", posNum: 36, rateio: false, sec: "SEC_ESTOQUE", role: "R_CONFERENTE", title: "CONFERENTE 01", shift: "SH_EST_0700", rule: "RULE_6X1_DOM", empName: "JANDSON FONSECA", posStatus: "FILLED" },
    { code: "37", posNum: 37, rateio: false, sec: "SEC_ESTOQUE", role: "R_AUX_ESTOQUE", title: "AUXILIAR DE ESTOQUE 01", shift: "SH_EST_0700", rule: "RULE_6X1_DOM", empName: "JOCIEL SOARES", posStatus: "FILLED" },

    // HORTIFRUTI
    { code: "RATEIO-04", posNum: null, rateio: true, sec: "SEC_HORTI", role: "R_ENC_FLV", title: "ENCAR. FLV", shift: "SH_GER_0700", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED", notes: "Posto compartilhado (Rateio)" },
    { code: "38", posNum: 38, rateio: false, sec: "SEC_HORTI", role: "R_OP_LOJA_FLV", title: "OPERADOR DE LOJA 01", shift: "SH_FLV_MANHA_0700", rule: "RULE_6X1_SAB_DOM", empName: "JOSINETE SANTOS", posStatus: "FILLED", octSlots: { "2026-10-11": "3", "2026-10-25": "3" } },
    { code: "39", posNum: 39, rateio: false, sec: "SEC_HORTI", role: "R_OP_LOJA_FLV", title: "OPERADOR DE LOJA 02", shift: "SH_FLV_TARDE_1130", rule: "RULE_6X1_SAB_DOM", empName: "PALOMA MARIA", posStatus: "FILLED", octSlots: { "2026-10-04": "3", "2026-10-12": "3", "2026-10-18": "3" } },

    // LIMPEZA
    { code: "40", posNum: 40, rateio: false, sec: "SEC_LIMPEZA", role: "R_AUX_LIMPEZA", title: "AUXILIAR LIMPEZA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "MARIA EDNA", posStatus: "FILLED" },
    { code: "41", posNum: 41, rateio: false, sec: "SEC_LIMPEZA", role: "R_AUX_LIMPEZA", title: "AUXILIAR LIMPEZA 02", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: "MARCIA ALINE", posStatus: "FILLED", octSlots: { "2026-10-12": "2" } },

    // PADARIA
    { code: "42", posNum: 42, rateio: false, sec: "SEC_PADARIA", role: "R_ENC_PADARIA", title: "ENCAR. PADARIA", shift: "SH_PAD_ENC_0600", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED" },
    { code: "43", posNum: 43, rateio: false, sec: "SEC_PADARIA", role: "R_SUB_PADARIA", title: "SUB ENCAR PADARIA", shift: "SH_PAD_ENC_0600", rule: "RULE_6X1_DOM", empName: "ANA PAULA", posStatus: "FILLED", notes: "Férias realizadas em 01/09 até 30/09" },
    { code: "44", posNum: 44, rateio: false, sec: "SEC_PADARIA", role: "R_CONFEITEIRA", title: "CONFEITEIRA 01", shift: "SH_PAD_AUX_0600", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED" },
    { code: "45", posNum: 45, rateio: false, sec: "SEC_PADARIA", role: "R_AUX_PADARIA", title: "AUXILIAR DE PADARIA 01", shift: "SH_PAD_AUX_0600", rule: "RULE_6X1_DOM_SEG", empName: "MARIA DE JESUS", posStatus: "FILLED", octSlots: { "2026-10-04": "1" } },
    { code: "46", posNum: 46, rateio: false, sec: "SEC_PADARIA", role: "R_AUX_PADARIA", title: "AUXILIAR DE PADARIA 02", shift: "SH_PAD_AUX_0600", rule: "RULE_6X1_DOM_SEG", empName: "JOANA TIBURCIO", posStatus: "FILLED", octSlots: { "2026-10-12": "1" } },
    { code: "47", posNum: 47, rateio: false, sec: "SEC_PADARIA", role: "R_AUX_PADARIA", title: "AUXILIAR DE PADARIA 03", shift: "SH_PAD_AUX_0600", rule: "RULE_6X1_DOM_SEG", empName: "MARIA JUCIENE", posStatus: "FILLED", notes: "Substituição de Edileuza Correia (afastada no INSS)", octSlots: { "2026-10-18": "1" } },
    { code: "48", posNum: 48, rateio: false, sec: "SEC_PADARIA", role: "R_AUX_PADARIA", title: "AUXILIAR DE PADARIA 04", shift: "SH_PAD_AUX_0600", rule: "RULE_6X1_DOM_SEG", empName: "THALIA MARIA", posStatus: "FILLED", octSlots: { "2026-10-25": "1" } },
    { code: "49", posNum: 49, rateio: false, sec: "SEC_PADARIA", role: "R_AUX_PADARIA", title: "AUXILIAR DE PADARIA 05", shift: "SH_PAD_INT_0800", rule: "RULE_6X1_DOM_SEG", empName: "ANA CAROLINA", posStatus: "FILLED", octSlots: { "2026-10-11": "1" } },
    { code: "50", posNum: 50, rateio: false, sec: "SEC_PADARIA", role: "R_BALCONISTA", title: "BALCONISTA 01", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "RITA MARIA", posStatus: "FILLED", anchorRest: "2026-09-25", octSlots: { "2026-10-04": "1", "2026-10-11": "4", "2026-10-12": "3", "2026-10-18": "3" } },
    { code: "51", posNum: 51, rateio: false, sec: "SEC_PADARIA", role: "R_BALCONISTA", title: "BALCONISTA 02", shift: "SH_OP_MANHA_0640", rule: "RULE_5X1", empName: "ANGELA SOUSA", posStatus: "FILLED", anchorRest: "2026-09-26", notes: "FOLGA EM 01/11", octSlots: { "2026-10-04": "2", "2026-10-11": "1", "2026-10-12": "4", "2026-10-25": "2" } },
    { code: "52", posNum: 52, rateio: false, sec: "SEC_PADARIA", role: "R_BALCONISTA", title: "BALCONISTA 03", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "MÔNICA SANTOS", posStatus: "FILLED", hireDate: "2026-10-15", anchorRest: "2026-10-15", notes: "ADM EM 15/10 — FOLGA EM 02/11", octSlots: { "2026-10-18": "4" } },
    { code: "53", posNum: 53, rateio: false, sec: "SEC_PADARIA", role: "R_BALCONISTA", title: "BALCONISTA 04", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "MARIA CLARA", posStatus: "FILLED", hireDate: "2026-10-09", anchorRest: "2026-10-10", notes: "ADM EM 09/10 — FOLGA EM 03/11", octSlots: { "2026-10-11": "3", "2026-10-12": "2", "2026-10-18": "1", "2026-10-25": "3" } },
    { code: "54", posNum: 54, rateio: false, sec: "SEC_PADARIA", role: "R_BALCONISTA", title: "BALCONISTA 05", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: "PATRICIA SANTOS", posStatus: "FILLED", anchorRest: "2026-09-29", octSlots: { "2026-10-04": "4", "2026-10-12": "2", "2026-10-18": "2", "2026-10-25": "4" } },
    { code: "55", posNum: 55, rateio: false, sec: "SEC_PADARIA", role: "R_BALCONISTA", title: "BALCONISTA 06", shift: "SH_OP_TARDE_1130", rule: "RULE_5X1", empName: null, posStatus: "FROZEN", notes: "CARGO VAGO - Joyce Fernandes foi mandada embora - NÃO VAI CONTRATAR NO MOMENTO" },

    // REPOSIÇÃO/MERCEARIA
    { code: "56", posNum: 56, rateio: false, sec: "SEC_REPOSICAO", role: "R_SUB_REPOS", title: "SUB ENCAR. REPOSIÇÃO", shift: "SH_SUB_1000", rule: "RULE_6X1_DOM", empName: null, posStatus: "OPEN_AUTHORIZED" },
    { code: "57", posNum: 57, rateio: false, sec: "SEC_REPOSICAO", role: "R_REP_ASSIST", title: "REPOSITOR ASSISTENTE 01", shift: "SH_MOT_1030", rule: "RULE_6X1_DOM", empName: "DANILO HENRIQUE", posStatus: "FILLED", octSlots: { "2026-10-18": "3" } },
    { code: "58", posNum: 58, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 01", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "JOSILENE SANTIAGO", posStatus: "FILLED", notes: "Verificar o comentário no cargo" },
    { code: "59", posNum: 59, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 02", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_DOM", empName: "GEANE SILVA", posStatus: "FILLED", octSlots: { "2026-10-12": "1" } },
    { code: "60", posNum: 60, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 03", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_SAB_DOM_SEG", empName: "WILLIAM WEVITON", posStatus: "FILLED", octSlots: { "2026-10-04": "3", "2026-10-12": "2" } },
    { code: "61", posNum: 61, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 04", shift: "SH_OP_MANHA_0640", rule: "RULE_6X1_SAB_DOM_SEG", empName: "KAUAN CALEBE", posStatus: "FILLED", octSlots: { "2026-10-25": "3" } },
    { code: "62", posNum: 62, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 05", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: "JAQUELINE SILVA", posStatus: "FILLED" },
    { code: "63", posNum: 63, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 06", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: "VERÔNICA OLIVEIRA", posStatus: "FILLED", octSlots: { "2026-10-12": "3" } },
    { code: "64", posNum: 64, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 07", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_SAB_DOM_SEG", empName: "KAUAN EUGÊNIO", posStatus: "FILLED", octSlots: { "2026-10-11": "3", "2026-10-12": "4" } },
    { code: "65", posNum: 65, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 08", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_SAB_DOM_SEG", empName: "PEDRO HENRIQUE", posStatus: "FILLED", notes: "Férias realizadas em 01/09 até 30/09", octSlots: { "2026-10-12": "1" } },
    { code: "66", posNum: 66, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 09", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_SAB_DOM_SEG", empName: null, posStatus: "OPEN_AUTHORIZED", notes: "LINHA DE SUPLENTE PARA AUMENTO DE QUADRO - CARGO VAGO - LAUANDA FOI PRO CAIXA" },
    { code: "67", posNum: 67, rateio: false, sec: "SEC_REPOSICAO", role: "R_REPOSITOR", title: "REPOSITOR 10", shift: "SH_OP_TARDE_1130", rule: "RULE_6X1_DOM", empName: null, posStatus: "FROZEN", notes: "DANILO HENRIQUE - CLASSIFICADO - LINHA DE SUPLENTE PARA AUMENTO DE QUADRO NÃO VAI CONTRATAR NO MOMENTO" },

    // FINANCEIRO
    { code: "68", posNum: 68, rateio: false, sec: "SEC_FINANCEIRO", role: "R_AUX_TESOUR", title: "AUXILIAR TESOURARIA", shift: "SH_FISC_0640", rule: "RULE_6X1_DOM", empName: "LONELLY RIBEIRO", posStatus: "FILLED" },

    // TI
    { code: "69", posNum: 69, rateio: false, sec: "SEC_TI", role: "R_LANC_NOTA", title: "LANÇADOR DE NOTA 01", shift: "SH_EST_0700", rule: "RULE_6X1_DOM", empName: "CARLILANE ALVES", posStatus: "FILLED", notes: "Férias realizadas em 01/09 até 30/09" },

    // PREVENÇÃO DE PERDAS
    { code: "70", posNum: 70, rateio: false, sec: "SEC_PREVENCAO", role: "R_AUX_PREV", title: "AUXILIAR DE PREV. DE PERDAS", shift: "SH_FLV_MANHA_0700", rule: "RULE_6X1_DOM", empName: "ANA LUIZA", posStatus: "FILLED" },
  ];

  const workPositions = [];
  const employees = [];
  const allocations = [];
  const unavailabilityEvents = [];
  const octSlotsByEmpId = {};

  rawRows.forEach((r, idx) => {
    const posId = `POS_LJ03_${r.code}`;
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
      const empId = `EMP_LJ03_${String(idx + 1).padStart(3, "0")}`;
      const hireDate = r.hireDate || "2025-02-01";
      const empStatus = r.noticeEnd
        ? "NOTICE_PERIOD"
        : r.vacation
          ? "ON_VACATION"
          : "ACTIVE";

      employees.push({
        id: empId,
        registrationCode: `MAT-${String(1000 + idx + 1)}`,
        fullName: r.empName,
        homeUnitId: "LOJA_03",
        isSharedRateio: Boolean(r.rateio),
        authorizedUnitIds: r.rateio ? ["LOJA_03", "LOJA_01", "LOJA_02"] : ["LOJA_03"],
        rateioScheduleByDow: r.rateio
          ? {
              "1": { unitId: "LOJA_03", period: "INTEGRAL" },
              "2": { unitId: "LOJA_03", period: "INTEGRAL" },
              "3": { unitId: "LOJA_03", period: "INTEGRAL" },
              "4": { unitId: "LOJA_03", period: "INTEGRAL" },
              "5": { unitId: "LOJA_03", period: "INTEGRAL" },
              "6": { unitId: "LOJA_03", period: "INTEGRAL" },
            }
          : null,
        hireDate,
        terminationDate: r.noticeEnd || null,
        noticePeriodEndDate: r.noticeEnd || null,
        employmentStatus: empStatus,
        anchorLastRestDate: r.anchorRest || null,
        anchorCycleOffset: idx % 5,
        notes: r.notes || "",
      });

      allocations.push({
        id: `ALLOC_${empId}_01`,
        employeeId: empId,
        workPositionId: posId,
        unitId: "LOJA_03",
        sectorId: r.sec,
        roleId: r.role,
        workShiftId: r.shift,
        scheduleRuleId: r.rule,
        startDate: hireDate,
        endDate: r.noticeEnd || null,
        transferReason: "Alocação inicial no quadro da Loja 03",
      });

      if (r.vacation) {
        unavailabilityEvents.push({
          id: `UNAV_${empId}_VAC`,
          employeeId: empId,
          eventType: "VACATION",
          startDate: r.vacation.start,
          endDate: r.vacation.end,
          cycleBehavior: "RESET_ON_RETURN",
          notes: "Férias programadas 01/10 a 30/10",
        });
      }

      if (r.noticeEnd) {
        unavailabilityEvents.push({
          id: `UNAV_${empId}_NOTICE`,
          employeeId: empId,
          eventType: "NOTICE_PERIOD",
          startDate: "2026-10-01",
          endDate: r.noticeEnd,
          cycleBehavior: "PRESERVE_PHASE",
          notes: `Final do aviso prévio em ${r.noticeEnd.split("-").reverse().join("/")}`,
        });
      }

      if (r.octSlots) {
        octSlotsByEmpId[empId] = r.octSlots;
      }
    }
  });

  // Registra também Edileuza Correia (afastada no INSS conforme observação do posto 47 da Padaria)
  employees.push({
    id: "EMP_LJ03_INSS_EDILEUZA",
    registrationCode: "MAT-0947",
    fullName: "EDILEUZA CORREIA",
    hireDate: "2024-03-10",
    terminationDate: null,
    noticePeriodEndDate: null,
    employmentStatus: "MEDICAL_LEAVE",
    anchorLastRestDate: null,
    anchorCycleOffset: 0,
    notes: "Afastada pelo INSS — observação do posto 47 (Auxiliar de Padaria 03)",
  });
  unavailabilityEvents.push({
    id: "UNAV_EDILEUZA_INSS",
    employeeId: "EMP_LJ03_INSS_EDILEUZA",
    eventType: "MEDICAL_LEAVE",
    startDate: "2026-06-01",
    endDate: "2026-12-31",
    cycleBehavior: "RESET_ON_RETURN",
    notes: "Afastamento Previdenciário (INSS)",
  });

  // Calendário Operacional de Abertura do Mercado (Outubro e Novembro/2026)
  const marketCalendarDays = [
    {
      id: "MC_2026_10_12",
      unitId: "LOJA_03",
      calendarDate: "2026-10-12",
      dayType: "HOLIDAY",
      openingMode: "FULL_DAY",
      description: "Nossa Senhora Aparecida (Aberto c/ Escala de Almoço N01-N04)",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.5,
    },
    {
      id: "MC_2026_11_02",
      unitId: "LOJA_03",
      calendarDate: "2026-11-02",
      dayType: "HOLIDAY",
      openingMode: "HALF_DAY",
      description: "Dia de Finados (Abertura Meio Expediente até 13:00)",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.0,
    },
    {
      id: "MC_2026_11_15",
      unitId: "LOJA_03",
      calendarDate: "2026-11-15",
      dayType: "HOLIDAY",
      openingMode: "FULL_DAY",
      description: "Proclamação da República (Domingo / Feriado)",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.5,
    },
    {
      id: "MC_2026_11_20",
      unitId: "LOJA_03",
      calendarDate: "2026-11-20",
      dayType: "HOLIDAY",
      openingMode: "FULL_DAY",
      description: "Dia da Consciência Negra",
      halfDayClosingTime: "13:00",
      requiresLunchScale: true,
      weight: 2.0,
    },
  ];

  const rulesById = Object.fromEntries(scheduleRules.map((r) => [r.id, r]));
  const calByDate = Object.fromEntries(marketCalendarDays.map((c) => [c.calendarDate, c]));

  // Gera automaticamente Outubro/2026 (VALIDATED) e Novembro/2026 (com Continuidade Real de Outubro!)
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

    // Aplica os números exatos de intervalo de almoço de Outubro da planilha original quando presentes
    const empOctSlots = octSlotsByEmpId[emp.id] || {};
    const octEntriesWithRealSlots = octRes.entries.map((entry) => {
      if (empOctSlots[entry.workDate]) {
        return {
          ...entry,
          lunchSlot: empOctSlots[entry.workDate],
          origin: "VALIDATED",
        };
      }
      return { ...entry, origin: "VALIDATED" };
    });

    octoberEntries.push(...octEntriesWithRealSlots);
    cycleStates.push({
      ...octRes.endCycleState,
      yearMonth: "2026-10",
    });

    // Gera Novembro/2026 alimentado diretamente pelo histórico real de Outubro/2026
    const novRes = generateEmployeeScheduleForMonth({
      employee: emp,
      yearMonth: "2026-11",
      allocations,
      rulesById,
      unavailabilityEvents,
      marketCalendarByDate: calByDate,
      previousMonthEntries: octEntriesWithRealSlots,
      previousCycleState: octRes.endCycleState,
      employeeRotationRank: empIdx,
    });

    novemberEntries.push(...novRes.entries);
    cycleStates.push({
      ...novRes.endCycleState,
      yearMonth: "2026-11",
    });
  });

  const shiftsById = Object.fromEntries(workShifts.map((s) => [s.id, s]));
  const balancedNovemberEntries = balanceSectorSundayLunchSlots({
    entries: novemberEntries,
    allocations,
    shiftsById,
    preserveManual: true,
  });

  const monthlySchedules = [
    {
      id: "MS_LJ03_2026_10",
      unitId: "LOJA_03",
      yearMonth: "2026-10",
      status: "PUBLISHED",
      versionNumber: 1,
      versionHistory: [],
      impactWarning: null,
      validatedAt: "2026-10-01T10:00:00Z",
      publishedAt: "2026-10-01T12:00:00Z",
    },
    {
      id: "MS_LJ03_2026_11",
      unitId: "LOJA_03",
      yearMonth: "2026-11",
      status: "VALIDATED",
      versionNumber: 1,
      versionHistory: [],
      impactWarning: null,
      validatedAt: "2026-10-28T15:00:00Z",
      publishedAt: null,
    },
  ];

  const auditLogs = [
    {
      id: "LOG_INIT_01",
      actorEmail: "arquitetura@uniaosupermercados.com.br",
      actorRole: "ADMIN",
      originType: "SYSTEM_MIGRATION",
      authVerificationStatus: "SYSTEM_SEED",
      module: "SISTEMA / MIGRAÇÃO",
      action: "MIGRACAO_PLANILHA_REFERENCIA",
      entityType: "UNIT",
      entityId: "LOJA_03",
      summary: "Base relacional inicializada com os 74 postos (70 próprios + 4 rateio), jornadas contratuais, histórico de Outubro/2026 e projeção contínua de Novembro/2026.",
      createdAt: "2026-10-28T15:00:00Z",
    },
  ];

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
    monthlySchedules,
    dailyEntriesByMonth: {
      "2026-10": octoberEntries,
      "2026-11": balancedNovemberEntries,
    },
    cycleStates,
    auditLogs,
    userProfiles: [
      {
        id: "USR_ADMIN_01",
        email: "admin@uniaosupermercados.com.br",
        fullName: "Administrador Geral ERP",
        roleProfile: "ADMIN",
        authorizedUnits: ["LOJA_03", "LOJA_01", "LOJA_02"],
        active: true,
      },
    ],
  };
}
