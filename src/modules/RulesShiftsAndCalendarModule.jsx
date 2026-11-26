// =============================================================================
// JORNADAS CONTRATUAIS (CRUD COMPLETO + CÁLCULO ARITMÉTICO ATIVO DAS 8 COLUNAS),
// MOTOR DE REGRAS EM 2 NÍVEIS (SIMPLES / AVANÇADO) E CALENDÁRIO OPERACIONAL (v8.0)
// =============================================================================

import { useState, useMemo } from "react";
import {
  ABERTURA_MERCADO_META,
  FAIXAS_ALMOCO_DOMINGO,
  calculateShiftMetrics,
} from "../domain/scheduleEngine.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";

const SIMPLE_RULE_TEMPLATES = [
  {
    id: "TPL_5X1",
    label: "5x1 Contínuo (Trabalha 5 dias seguidos, folga 1)",
    ruleType: "5X1",
    workDays: 5,
    restDays: 1,
    maxConsec: 5,
    dows: [],
    fixedWeekdays: false,
    preview: ["T", "T", "T", "T", "T", "F", "T", "T", "T", "T", "T", "F", "T", "T"],
  },
  {
    id: "TPL_5X2_FIXED",
    label: "5x2 Fim de Semana Fixo (Seg a Sex, folga Sáb e Dom)",
    ruleType: "5X2",
    workDays: 5,
    restDays: 2,
    maxConsec: 5,
    dows: [6, 0],
    fixedWeekdays: true,
    preview: ["F", "T", "T", "T", "T", "T", "F", "F", "T", "T", "T", "T", "T", "F"],
  },
  {
    id: "TPL_5X2_ROT",
    label: "5x2 Corrido Rotativo (5 dias trab. / 2 dias de folga contínuos)",
    ruleType: "5X2",
    workDays: 5,
    restDays: 2,
    maxConsec: 5,
    dows: [],
    fixedWeekdays: false,
    preview: ["T", "T", "T", "T", "T", "F", "F", "T", "T", "T", "T", "T", "F", "F"],
  },
  {
    id: "TPL_6X1_DOM",
    label: "6x1 Folga Fixa no Domingo (Seg a Sáb)",
    ruleType: "6X1_DOM",
    workDays: 6,
    restDays: 1,
    maxConsec: 6,
    dows: [0],
    fixedWeekdays: true,
    preview: ["F", "T", "T", "T", "T", "T", "T", "F", "T", "T", "T", "T", "T", "T"],
  },
  {
    id: "TPL_6X1_DOM_SEG",
    label: "6x1 Revezamento Domingo / Segunda-feira",
    ruleType: "6X1_FLEX",
    workDays: 6,
    restDays: 1,
    maxConsec: 7,
    dows: [0, 1],
    fixedWeekdays: false,
    preview: ["F", "T", "T", "T", "T", "T", "T", "T", "F", "T", "T", "T", "T", "T"],
  },
  {
    id: "TPL_6X1_SAB_DOM",
    label: "6x1 Revezamento Sábado / Domingo (FLV / Hortifruti)",
    ruleType: "6X1_FLEX",
    workDays: 6,
    restDays: 1,
    maxConsec: 7,
    dows: [6, 0],
    fixedWeekdays: false,
    preview: ["T", "T", "T", "T", "T", "T", "F", "F", "T", "T", "T", "T", "T", "T"],
  },
  {
    id: "TPL_6X1_SAB_DOM_SEG",
    label: "6x1 Revezamento Sábado / Domingo / Segunda (Mercearia)",
    ruleType: "6X1_FLEX",
    workDays: 6,
    restDays: 1,
    maxConsec: 7,
    dows: [6, 0, 1],
    fixedWeekdays: false,
    preview: ["T", "T", "T", "T", "T", "T", "F", "F", "T", "T", "T", "T", "T", "T"],
  },
];

export default function RulesShiftsAndCalendarModule({
  db,
  selectedUnitId,
  initialTab = "rules",
  onMutateDb,
}) {
  const [subTab, setSubTab] = useState(
    initialTab === "calendar" ? "calendar" : "rules"
  );
  const unitsById = Object.fromEntries((db.units || []).map((u) => [u.id, u]));
  const selectedUnitLabel =
    unitsById[selectedUnitId]?.name || unitsById[selectedUnitId]?.code || selectedUnitId || "Unidade";

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ESTADO DO CALENDÁRIO OPERACIONAL DO MERCADO (Com Edição e Filtro de Loja)
  // ───────────────────────────────────────────────────────────────────────────
  const [editingCalId, setEditingCalId] = useState(null);
  const [calDate, setCalDate] = useState("2026-11-15");
  const [calType, setCalType] = useState("HOLIDAY");
  const [calMode, setCalMode] = useState("FULL_DAY");
  const [calDesc, setCalDesc] = useState("");
  const [calHalfTime, setCalHalfTime] = useState("13:00");
  const [calLunch, setCalLunch] = useState(true);

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ESTADO DO MOTOR DE REGRAS (Modo Simples vs Modo Avançado + Edição)
  // ───────────────────────────────────────────────────────────────────────────
  const [ruleConfigMode, setRuleConfigMode] = useState("simple"); // 'simple' | 'advanced'
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("TPL_5X2_FIXED");
  const [ruleCode, setRuleCode] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("5X2");
  const [ruleWorkDays, setRuleWorkDays] = useState(5);
  const [ruleRestDays, setRuleRestDays] = useState(2);
  const [ruleMaxConsec, setRuleMaxConsec] = useState(5);
  const [ruleDows, setRuleDows] = useState([6, 0]);
  const [ruleFixedWeekdays, setRuleFixedWeekdays] = useState(true);
  const [ruleSundayLunch, setRuleSundayLunch] = useState(true);
  const [ruleClosedCountsRest, setRuleClosedCountsRest] = useState(false);

  // Mudança de Regra com Vigência Temporal
  const [ovEmpId, setOvEmpId] = useState(db.employees[0]?.id || "");
  const [ovRuleId, setOvRuleId] = useState("RULE_5X2");
  const [ovFromDate, setOvFromDate] = useState("2026-11-16");
  const [ovToDate, setOvToDate] = useState("");

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ESTADO DE JORNADAS CONTRATUAIS (CRUD COMPLETO DAS 8 COLUNAS DE HORÁRIO)
  // ───────────────────────────────────────────────────────────────────────────
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [shiftCode, setShiftCode] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [shiftPeriod, setShiftPeriod] = useState("MANHÃ");
  const [entryTime, setEntryTime] = useState("07:00");
  const [breakStart, setBreakStart] = useState("11:30");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [exitBaseTime, setExitBaseTime] = useState("15:50");
  const [baseWorkload, setBaseWorkload] = useState("07:20");
  const [extensionWorkload, setExtensionWorkload] = useState("01:40");
  const [effectiveExitTime, setEffectiveExitTime] = useState("17:30");
  const [contractDailyWorkload, setContractDailyWorkload] = useState("07:20");

  // Cálculo aritmético em tempo real das 8 colunas do formulário de jornada
  const liveShiftMetrics = useMemo(
    () =>
      calculateShiftMetrics({
        entryTime,
        breakStart,
        breakEnd,
        exitBaseTime,
        baseWorkload,
        extensionWorkload,
        effectiveExitTime,
        contractDailyWorkload,
      }),
    [
      entryTime,
      breakStart,
      breakEnd,
      exitBaseTime,
      baseWorkload,
      extensionWorkload,
      effectiveExitTime,
      contractDailyWorkload,
    ]
  );

  const unitCalendarDays = useMemo(
    () =>
      (db.marketCalendarDays || []).filter(
        (c) => !selectedUnitId || c.unitId === selectedUnitId
      ),
    [db.marketCalendarDays, selectedUnitId]
  );

  // Auto-preencher campos de carga horária a partir dos horários digitados
  const handleAutoCalculateShiftWorkloads = () => {
    setBaseWorkload(liveShiftMetrics.derivedBaseFormatted);
    setExtensionWorkload(liveShiftMetrics.derivedExtensionFormatted);
    setContractDailyWorkload(liveShiftMetrics.derivedBaseFormatted);
  };

  // Salvar Jornada Contratual (Criar ou Editar)
  const handleSaveShift = (e) => {
    e.preventDefault();
    const autoName =
      shiftName.trim() ||
      `${entryTime} às ${exitBaseTime} (c/ ${extensionWorkload} compl. → ${effectiveExitTime})`;
    const autoCode =
      shiftCode.trim().toUpperCase() ||
      `${shiftPeriod}_${entryTime.replace(":", "")}_${effectiveExitTime.replace(":", "")}`;

    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: editingShiftId ? "EDITAR_JORNADA_HORARIO" : "CRIAR_JORNADA_HORARIO",
      entityType: "WORK_SHIFT",
      entityId: editingShiftId || autoCode,
      summary: `${editingShiftId ? "Atualizada" : "Criada"} jornada contratual "${autoName}" [${shiftPeriod}] (C.H. Base: ${baseWorkload}, Compl.: ${extensionWorkload}, Saída Real: ${effectiveExitTime}).`,
      updater: (draft) => {
        if (editingShiftId) {
          const idx = draft.workShifts.findIndex((s) => s.id === editingShiftId);
          if (idx >= 0) {
            draft.workShifts[idx] = {
              ...draft.workShifts[idx],
              code: autoCode,
              name: autoName,
              shiftPeriod,
              entryTime,
              breakStart,
              breakEnd,
              exitBaseTime,
              baseWorkload,
              extensionWorkload,
              effectiveExitTime,
              contractDailyWorkload,
            };
          }
        } else {
          draft.workShifts.push({
            id: `SH_${autoCode}_${Date.now()}`,
            code: autoCode,
            name: autoName,
            shiftPeriod,
            entryTime,
            breakStart,
            breakEnd,
            exitBaseTime,
            baseWorkload,
            extensionWorkload,
            effectiveExitTime,
            contractDailyWorkload,
            weeklyHours: 44,
            active: true,
          });
        }
      },
    });

    setEditingShiftId(null);
    setShiftCode("");
    setShiftName("");
  };

  const loadShiftIntoForm = (sh, asDuplicate = false) => {
    setEditingShiftId(asDuplicate ? null : sh.id);
    setShiftCode(asDuplicate ? `${sh.code}_COPIA` : sh.code);
    setShiftName(asDuplicate ? `${sh.name} (Cópia)` : sh.name);
    setShiftPeriod(sh.shiftPeriod || "MANHÃ");
    setEntryTime(sh.entryTime || "07:00");
    setBreakStart(sh.breakStart || "11:30");
    setBreakEnd(sh.breakEnd || "13:00");
    setExitBaseTime(sh.exitBaseTime || "15:50");
    setBaseWorkload(sh.baseWorkload || "07:20");
    setExtensionWorkload(sh.extensionWorkload || "01:40");
    setEffectiveExitTime(sh.effectiveExitTime || "17:30");
    setContractDailyWorkload(sh.contractDailyWorkload || "07:20");
  };

  const handleToggleDeactivateShift = (sh) => {
    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: sh.active === false ? "REATIVAR_JORNADA" : "DESATIVAR_JORNADA",
      entityType: "WORK_SHIFT",
      entityId: sh.id,
      summary: `Jornada "${sh.name}" ${sh.active === false ? "reativada" : "desativada (preservando histórico)"}.`,
      updater: (draft) => {
        const target = draft.workShifts.find((x) => x.id === sh.id);
        if (target) target.active = target.active === false ? true : false;
      },
    });
  };

  const handleDeleteShift = (sh) => {
    if (!sh || (db.workShifts || []).length <= 1) return;
    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: "EXCLUIR_JORNADA_HORARIO",
      entityType: "WORK_SHIFT",
      entityId: sh.id,
      summary: `Excluída jornada contratual "${sh.name}" [${sh.shiftPeriod}].`,
      updater: (draft) => {
        draft.workShifts = (draft.workShifts || []).filter((x) => x.id !== sh.id);
        const fallbackShiftId = draft.workShifts[0]?.id || null;
        if (fallbackShiftId) {
          (draft.workPositions || []).forEach((p) => {
            if (p.defaultShiftId === sh.id) p.defaultShiftId = fallbackShiftId;
          });
          (draft.allocations || []).forEach((a) => {
            if (a.workShiftId === sh.id) a.workShiftId = fallbackShiftId;
          });
        }
      },
    });
    if (editingShiftId === sh.id) {
      setEditingShiftId(null);
      setShiftCode("");
      setShiftName("");
    }
  };

  const handleDeleteRule = (r) => {
    if (!r || (db.scheduleRules || []).length <= 1) return;
    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: "EXCLUIR_REGRA_ESCALA",
      entityType: "SCHEDULE_RULE",
      entityId: r.id,
      summary: `Excluída regra de escala "${r.code} — ${r.name}".`,
      updater: (draft) => {
        draft.scheduleRules = (draft.scheduleRules || []).filter((x) => x.id !== r.id);
        draft.ruleAssignments = (draft.ruleAssignments || []).filter((ra) => ra.ruleId !== r.id);
        const fallbackRuleId = draft.scheduleRules[0]?.id || null;
        if (fallbackRuleId) {
          (draft.workPositions || []).forEach((p) => {
            if (p.defaultRuleId === r.id) p.defaultRuleId = fallbackRuleId;
          });
          (draft.allocations || []).forEach((a) => {
            if (a.scheduleRuleId === r.id) a.scheduleRuleId = fallbackRuleId;
          });
        }
      },
    });
    if (editingRuleId === r.id) {
      setEditingRuleId(null);
      setRuleCode("");
      setRuleName("");
    }
  };

  const handleDeleteRuleAssignment = (ra) => {
    if (!ra) return;
    const emp = db.employees.find((x) => x.id === ra.employeeId);
    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: "EXCLUIR_VIGENCIA_REGRA",
      entityType: "RULE_ASSIGNMENT",
      entityId: ra.id,
      summary: `Excluída vigência temporal de regra de escala de ${emp?.fullName || ra.employeeId} (${ra.effectiveFrom}).`,
      updater: (draft) => {
        draft.ruleAssignments = (draft.ruleAssignments || []).filter((x) => x.id !== ra.id);
      },
    });
  };

  // Salvar dia no Calendário Operacional do Mercado
  const handleSaveCalendarDay = (e) => {
    e.preventDefault();
    if (!calDate) return;

    const yearMonthAffected = calDate.slice(0, 7);
    const hasExistingSchedule = Boolean(db.dailyEntriesByMonth?.[yearMonthAffected]?.length);

    const newEntry = {
      id: editingCalId || `MC_${selectedUnitId}_${calDate}`,
      unitId: selectedUnitId,
      calendarDate: calDate,
      dayType: calType,
      openingMode: calMode,
      description: calDesc.trim() || `Configuração operacional (${calType})`,
      halfDayClosingTime: calHalfTime,
      requiresLunchScale: Boolean(calLunch && calMode !== "CLOSED"),
      weight: calType === "HOLIDAY" ? 2.5 : 1.8,
    };

    onMutateDb({
      permission: "MANAGE_MARKET_CALENDAR",
      module: "CALENDARIO_MERCADO",
      action: editingCalId ? "EDITAR_DIA_CALENDARIO" : "CONFIGURAR_DIA_ABERTURA",
      entityType: "MARKET_CALENDAR_DAY",
      entityId: newEntry.id,
      unitId: selectedUnitId,
      summary: `Data ${calDate} (${selectedUnitId}) salva como ${calType} — "${ABERTURA_MERCADO_META[calMode]?.label}"${hasExistingSchedule ? ` (Competência ${yearMonthAffected} possui escala ativa: use 'Gerar c/ Continuidade' para aplicar nas células automáticas)` : ""}.`,
      updater: (draft) => {
        draft.marketCalendarDays = draft.marketCalendarDays.filter(
          (c) =>
            c.id !== editingCalId &&
            !(c.unitId === selectedUnitId && c.calendarDate === calDate)
        );
        draft.marketCalendarDays.push(newEntry);
        draft.marketCalendarDays.sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
      },
    });
    setEditingCalId(null);
    setCalDesc("");
  };

  const handleRemoveCalendarDay = (id) => {
    onMutateDb({
      permission: "MANAGE_MARKET_CALENDAR",
      module: "CALENDARIO_MERCADO",
      action: "REMOVER_DIA_CALENDARIO",
      entityType: "MARKET_CALENDAR_DAY",
      entityId: id,
      unitId: selectedUnitId,
      summary: `Removida configuração especial de calendário ${id} (${selectedUnitId}).`,
      updater: (draft) => {
        draft.marketCalendarDays = draft.marketCalendarDays.filter((c) => c.id !== id);
      },
    });
  };

  // Aplicar template no Modo Simples de Regras
  const handleSelectRuleTemplate = (tplId) => {
    setSelectedTemplateId(tplId);
    const tpl = SIMPLE_RULE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setRuleType(tpl.ruleType);
    setRuleWorkDays(tpl.workDays);
    setRuleRestDays(tpl.restDays);
    setRuleMaxConsec(tpl.maxConsec);
    setRuleDows(tpl.dows);
    setRuleFixedWeekdays(tpl.fixedWeekdays);
    if (!editingRuleId) {
      setRuleCode(tpl.id.replace("TPL_", ""));
      setRuleName(tpl.label);
    }
  };

  // Criar ou Editar Regra de Escala
  const handleSaveRule = (e) => {
    e.preventDefault();
    if (!ruleCode.trim() || !ruleName.trim()) return;

    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: editingRuleId ? "EDITAR_REGRA_ESCALA" : "CRIAR_REGRA_ESCALA",
      entityType: "SCHEDULE_RULE",
      entityId: editingRuleId || ruleCode.trim().toUpperCase(),
      summary: `${editingRuleId ? "Atualizada" : "Criada"} regra de escala "${ruleCode.trim().toUpperCase()} — ${ruleName.trim()}" (${ruleType}, Ciclo ${ruleWorkDays}x${ruleRestDays}).`,
      updater: (draft) => {
        const payload = {
          code: ruleCode.trim().toUpperCase(),
          name: ruleName.trim(),
          description: `Ciclo ${ruleWorkDays}x${ruleRestDays} (${ruleType}) — máx. ${ruleMaxConsec} dias seguidos`,
          ruleType,
          workDaysInCycle: Number(ruleWorkDays) || 5,
          restDaysInCycle: Number(ruleRestDays) || 1,
          allowedRestDows: ruleDows,
          fixedWeekdays: Boolean(ruleFixedWeekdays),
          maxConsecutiveWorkDays: Number(ruleMaxConsec) || 6,
          requiresSundayLunchSlot: Boolean(ruleSundayLunch),
          closedMarketCountsAsRest: Boolean(ruleClosedCountsRest),
          effectiveFrom: "2026-01-01",
        };

        if (editingRuleId) {
          const idx = draft.scheduleRules.findIndex((r) => r.id === editingRuleId);
          if (idx >= 0) {
            draft.scheduleRules[idx] = {
              ...draft.scheduleRules[idx],
              ...payload,
            };
          }
        } else {
          draft.scheduleRules.push({
            id: `RULE_${ruleCode.trim().toUpperCase().replace(/\W+/g, "_")}_${Date.now()}`,
            ...payload,
          });
        }
      },
    });
    setEditingRuleId(null);
    setRuleCode("");
    setRuleName("");
  };

  const loadRuleIntoForm = (r, asDuplicate = false) => {
    setEditingRuleId(asDuplicate ? null : r.id);
    setRuleCode(asDuplicate ? `${r.code}_COPIA` : r.code);
    setRuleName(asDuplicate ? `${r.name} (Cópia)` : r.name);
    setRuleType(r.ruleType || "6X1_DOM");
    setRuleWorkDays(r.workDaysInCycle || 6);
    setRuleRestDays(r.restDaysInCycle || 1);
    setRuleMaxConsec(r.maxConsecutiveWorkDays || 6);
    setRuleDows(r.allowedRestDows || []);
    setRuleFixedWeekdays(Boolean(r.fixedWeekdays));
    setRuleSundayLunch(r.requiresSundayLunchSlot !== false);
    setRuleClosedCountsRest(Boolean(r.closedMarketCountsAsRest));
  };

  // Atribuir mudança de regra com data de vigência a um colaborador
  const handleAddRuleAssignment = (e) => {
    e.preventDefault();
    if (!ovEmpId || !ovRuleId || !ovFromDate) return;
    const emp = db.employees.find((x) => x.id === ovEmpId);
    const rule = db.scheduleRules.find((r) => r.id === ovRuleId);

    const newAssign = {
      id: `RA_${ovEmpId}_${Date.now()}`,
      employeeId: ovEmpId,
      ruleId: ovRuleId,
      effectiveFrom: ovFromDate,
      effectiveTo: ovToDate || null,
    };

    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: "VIGENCIA_REGRA_COLABORADOR",
      entityType: "RULE_ASSIGNMENT",
      entityId: newAssign.id,
      summary: `Definida vigência da regra ${rule?.code} para ${emp?.fullName} a partir de ${ovFromDate}${ovToDate ? ` até ${ovToDate}` : ""}.`,
      updater: (draft) => {
        draft.ruleAssignments = draft.ruleAssignments || [];
        draft.ruleAssignments.push(newAssign);
      },
    });
  };

  const toggleDow = (dowNum) => {
    setRuleDows((prev) =>
      prev.includes(dowNum) ? prev.filter((d) => d !== dowNum) : [...prev, dowNum]
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setSubTab("rules")}
          style={subTab === "rules" ? ui.subTabActive : ui.subTab}
        >
          ⚙️ Regras de Escala (Modo Simples / Avançado & Vigências)
        </button>
        <button
          onClick={() => setSubTab("shifts")}
          style={subTab === "shifts" ? ui.subTabActive : ui.subTab}
        >
          ⏱️ Jornadas Contratuais (CRUD 8 Colunas + Cálculo Aritmético Ativo)
        </button>
        <button
          onClick={() => setSubTab("calendar")}
          style={subTab === "calendar" ? ui.subTabActive : ui.subTab}
        >
          🗓️ Calendário Operacional — {selectedUnitLabel} ({unitCalendarDays.length} datas)
        </button>
      </div>

      {subTab === "calendar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              {editingCalId
                ? `✏️ Editar Data do Calendário Operacional (${selectedUnitLabel})`
                : `🏪 Configurar Dias de Abertura do Mercado — Unidade ${selectedUnitLabel}`}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Define como a loja <strong>{selectedUnitLabel}</strong> opera em datas específicas: <strong>Dia Inteiro (Normal)</strong>, <strong>Meio Dia (Meio Expediente)</strong> ou <strong>Fechado (Não Abre)</strong>.
            </div>

            <form
              onSubmit={handleSaveCalendarDay}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={ui.label}>Data</label>
                <input
                  type="date"
                  required
                  value={calDate}
                  onChange={(e) => setCalDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Classificação do Dia</label>
                <select
                  value={calType}
                  onChange={(e) => setCalType(e.target.value)}
                  style={ui.select}
                >
                  <option value="HOLIDAY">Feriado Nacional / Local</option>
                  <option value="OPTIONAL_HOLIDAY">Ponto Facultativo</option>
                  <option value="SUNDAY">Domingo Especial</option>
                  <option value="CRITICAL_OFFER">Dia de Oferta / Promoção</option>
                  <option value="PAYDAY">Dia de Pagamento Salarial</option>
                </select>
              </div>
              <div>
                <label style={ui.label}>Regime de Abertura do Mercado</label>
                <select
                  value={calMode}
                  onChange={(e) => setCalMode(e.target.value)}
                  style={ui.select}
                >
                  <option value="FULL_DAY">🟢 Abre Dia Inteiro (Horário Normal)</option>
                  <option value="HALF_DAY">🟡 Abre Meio Dia (Meio Expediente)</option>
                  <option value="CLOSED">🔴 Não Abre (Mercado Fechado)</option>
                </select>
              </div>
              {calMode === "HALF_DAY" && (
                <div>
                  <label style={ui.label}>Fechamento Meio Dia</label>
                  <input
                    type="time"
                    value={calHalfTime}
                    onChange={(e) => setCalHalfTime(e.target.value)}
                    style={ui.input}
                  />
                </div>
              )}
              <div>
                <label style={ui.label}>Descrição / Feriado</label>
                <input
                  type="text"
                  placeholder="Ex: Finados / Natal / Aniversário da Cidade"
                  value={calDesc}
                  onChange={(e) => setCalDesc(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 6 }}>
                <input
                  type="checkbox"
                  id="chk_lunch_cal"
                  checked={calLunch}
                  disabled={calMode === "CLOSED"}
                  onChange={(e) => setCalLunch(e.target.checked)}
                />
                <label htmlFor="chk_lunch_cal" style={{ fontSize: 12, color: "#334155" }}>
                  Exigir Escala de Almoço (1 a 4)
                </label>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit" style={ui.btnPrimary}>
                  {editingCalId ? "Salvar Alteração" : "Salvar no Calendário"}
                </button>
                {editingCalId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCalId(null);
                      setCalDesc("");
                    }}
                    style={ui.btnSmall}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Calendário Operacional — {selectedUnitLabel} ({unitCalendarDays.length} datas configuradas)
            </div>
            <table style={ui.table}>
              <thead>
                <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                  <th style={ui.th}>Data</th>
                  <th style={ui.th}>Unidade</th>
                  <th style={ui.th}>Tipo</th>
                  <th style={ui.th}>Regime de Abertura</th>
                  <th style={{ ...ui.th, textAlign: "left" }}>Descrição</th>
                  <th style={ui.th}>Escala Almoço (1..4)</th>
                  <th style={ui.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {unitCalendarDays.map((c) => {
                  const meta = ABERTURA_MERCADO_META[c.openingMode] || ABERTURA_MERCADO_META.FULL_DAY;
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ ...ui.td, textAlign: "center", fontWeight: 700 }}>
                        {c.calendarDate.split("-").reverse().join("/")}
                      </td>
                      <td style={{ ...ui.td, textAlign: "center", fontSize: 11, fontWeight: 700 }}>
                        {unitsById[c.unitId]?.name || unitsById[c.unitId]?.code || c.unitId}
                      </td>
                      <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>{c.dayType}</td>
                      <td style={{ ...ui.td, textAlign: "center" }}>
                        <span
                          style={{
                            background: meta.bg,
                            color: meta.cor,
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {meta.label}
                          {c.openingMode === "HALF_DAY" ? ` (até ${c.halfDayClosingTime})` : ""}
                        </span>
                      </td>
                      <td style={{ ...ui.td, fontWeight: 600 }}>{c.description}</td>
                      <td style={{ ...ui.td, textAlign: "center" }}>
                        {c.requiresLunchScale ? "Sim (N 01 a N 04)" : "Não"}
                      </td>
                      <td style={{ ...ui.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => {
                              setEditingCalId(c.id);
                              setCalDate(c.calendarDate);
                              setCalType(c.dayType);
                              setCalMode(c.openingMode);
                              setCalDesc(c.description);
                              setCalHalfTime(c.halfDayClosingTime || "13:00");
                              setCalLunch(Boolean(c.requiresLunchScale));
                            }}
                            style={ui.btnSmall}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleRemoveCalendarDay(c.id)}
                            style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Catálogo de Regras com Edição e Duplicação */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Regras de Escala Configuradas no Motor Central ({db.scheduleRules.length})
            </div>
            <table style={{ ...ui.table, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                  <th style={ui.th}>Código</th>
                  <th style={{ ...ui.th, textAlign: "left" }}>Nome da Regra</th>
                  <th style={ui.th}>Modelo</th>
                  <th style={ui.th}>Ciclo</th>
                  <th style={ui.th}>Dias Permitidos p/ Folga</th>
                  <th style={ui.th}>Máx. Dias Seguidos</th>
                  <th style={ui.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {db.scheduleRules.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {r.code}
                    </td>
                    <td style={{ ...ui.td, fontWeight: 700 }}>{r.name}</td>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>{r.ruleType}</td>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 700 }}>
                      {r.workDaysInCycle} × {r.restDaysInCycle}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>
                      {r.allowedRestDows?.length
                        ? r.allowedRestDows
                            .map((d) => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d])
                            .join(" / ")
                        : "Corrido (Contínuo)"}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>{r.maxConsecutiveWorkDays} dias</td>
                    <td style={{ ...ui.td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button
                          onClick={() => {
                            setRuleConfigMode("advanced");
                            loadRuleIntoForm(r, false);
                          }}
                          style={ui.btnSmall}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => {
                            setRuleConfigMode("advanced");
                            loadRuleIntoForm(r, true);
                          }}
                          style={ui.btnSmall}
                        >
                          📋 Duplicar
                        </button>
                        {db.scheduleRules.length > 1 && (
                          <button
                            onClick={() => handleDeleteRule(r)}
                            style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                          >
                            🗑️ Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Formulário de Configuração em 2 Níveis (Modo Simples vs Modo Avançado — Seção 21) */}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                  {editingRuleId
                    ? `✏️ Editando Regra: ${ruleCode}`
                    : "➕ Configurar Regra de Escala (Modo Simples ou Avançado)"}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setRuleConfigMode("simple")}
                    style={ruleConfigMode === "simple" ? ui.subTabActive : ui.subTab}
                  >
                    ✨ Modo Simples (Modelos Prontos + Prévia Visual)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleConfigMode("advanced")}
                    style={ruleConfigMode === "advanced" ? ui.subTabActive : ui.subTab}
                  >
                    🔧 Modo Avançado (Parâmetros Técnicos)
                  </button>
                </div>
              </div>

              {ruleConfigMode === "simple" && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <label style={ui.label}>Escolha um Modelo de Ciclo Operacional:</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectRuleTemplate(e.target.value)}
                    style={{ ...ui.select, marginBottom: 10 }}
                  >
                    {SIMPLE_RULE_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  {(() => {
                    const tpl =
                      SIMPLE_RULE_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
                      SIMPLE_RULE_TEMPLATES[0];
                    return (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                          Prévia Visual de 14 Dias do Ciclo ({tpl.workDays}x{tpl.restDays}):
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {tpl.preview.map((st, idx) => (
                            <span
                              key={idx}
                              style={{
                                width: 32,
                                padding: "4px 0",
                                textAlign: "center",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 800,
                                background: st === "F" ? "#1e3a8a" : "#dcfce7",
                                color: st === "F" ? "#fff" : "#166534",
                              }}
                            >
                              D{idx + 1}:{st}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <form
                onSubmit={handleSaveRule}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <div>
                  <label style={ui.label}>Código da Regra *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 5X2 (DOM/SEG)"
                    value={ruleCode}
                    onChange={(e) => setRuleCode(e.target.value)}
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={ui.label}>Nome Descritivo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Escala 5x2 Operacional"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    style={ui.input}
                  />
                </div>

                {ruleConfigMode === "advanced" && (
                  <>
                    <div>
                      <label style={ui.label}>Tipo do Motor</label>
                      <select
                        value={ruleType}
                        onChange={(e) => setRuleType(e.target.value)}
                        style={ui.select}
                      >
                        <option value="5X2">5X2 (5 Trab. / 2 Descanso)</option>
                        <option value="5X1">5X1 (Ciclo Contínuo)</option>
                        <option value="6X1_FLEX">6X1 Revezamento de Dias</option>
                        <option value="6X1_DOM">6X1 Folga Fixa Domingo</option>
                      </select>
                    </div>
                    <div>
                      <label style={ui.label}>Dias de Trabalho</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={ruleWorkDays}
                        onChange={(e) => setRuleWorkDays(e.target.value)}
                        style={ui.input}
                      />
                    </div>
                    <div>
                      <label style={ui.label}>Dias de Descanso</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={ruleRestDays}
                        onChange={(e) => setRuleRestDays(e.target.value)}
                        style={ui.input}
                      />
                    </div>
                    <div>
                      <label style={ui.label}>Máx. Dias Consecutivos</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={ruleMaxConsec}
                        onChange={(e) => setRuleMaxConsec(e.target.value)}
                        style={ui.input}
                      />
                    </div>
                    <div>
                      <label style={ui.label}>Dias Permitidos p/ Folga</label>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((lb, idx) => (
                          <button
                            type="button"
                            key={lb}
                            onClick={() => toggleDow(idx)}
                            style={{
                              fontSize: 10,
                              padding: "4px 6px",
                              borderRadius: 4,
                              border: "1px solid #cbd5e1",
                              background: ruleDows.includes(idx) ? "#0f172a" : "#fff",
                              color: ruleDows.includes(idx) ? "#fff" : "#334155",
                              cursor: "pointer",
                            }}
                          >
                            {lb}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" style={ui.btnPrimary}>
                    {editingRuleId ? "Salvar Alterações da Regra" : "Salvar Regra"}
                  </button>
                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRuleId(null);
                        setRuleCode("");
                        setRuleName("");
                      }}
                      style={ui.btnSmall}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Mudança de Regra com Vigência Temporal */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              📅 Mudança de Regra de Escala durante o Mês (Vigência Temporal por Colaborador)
            </div>
            <form
              onSubmit={handleAddRuleAssignment}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={ui.label}>Colaborador</label>
                <select
                  value={ovEmpId}
                  onChange={(e) => setOvEmpId(e.target.value)}
                  style={ui.select}
                >
                  {db.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Nova Regra de Escala</label>
                <select
                  value={ovRuleId}
                  onChange={(e) => setOvRuleId(e.target.value)}
                  style={ui.select}
                >
                  {db.scheduleRules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Início da Vigência</label>
                <input
                  type="date"
                  required
                  value={ovFromDate}
                  onChange={(e) => setOvFromDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Fim da Vigência (Opcional)</label>
                <input
                  type="date"
                  value={ovToDate}
                  onChange={(e) => setOvToDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <button type="submit" style={ui.btnPrimary}>
                Aplicar Vigência
              </button>
            </form>

            {(db.ruleAssignments || []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <table style={ui.table}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ ...ui.th, textAlign: "left" }}>Colaborador</th>
                      <th style={ui.th}>Regra Aplicada</th>
                      <th style={ui.th}>Período de Vigência</th>
                      <th style={ui.th}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(db.ruleAssignments || []).map((ra) => {
                      const emp = db.employees.find((x) => x.id === ra.employeeId);
                      const rule = db.scheduleRules.find((x) => x.id === ra.ruleId);
                      return (
                        <tr key={ra.id}>
                          <td style={{ ...ui.td, fontWeight: 700 }}>{emp?.fullName}</td>
                          <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#1d4ed8" }}>
                            {rule?.code}
                          </td>
                          <td style={{ ...ui.td, textAlign: "center" }}>
                            A partir de {ra.effectiveFrom.split("-").reverse().join("/")}
                            {ra.effectiveTo ? ` até ${ra.effectiveTo.split("-").reverse().join("/")}` : " (Indeterminado)"}
                          </td>
                          <td style={{ ...ui.td, textAlign: "center" }}>
                            <button
                              onClick={() => handleDeleteRuleAssignment(ra)}
                              style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                            >
                              🗑️ Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "shifts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Formulário CRUD Completo das 8 Colunas de Horário + Cálculo Aritmético Ativo (Seção 20) */}
          <div style={ui.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div>
                <div style={ui.cardTitle}>
                  {editingShiftId
                    ? `✏️ Editando Jornada Contratual: ${shiftCode}`
                    : "➕ Cadastrar / Editar Jornada Contratual (8 Colunas Ativas no Motor)"}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                  O motor utiliza estas 8 colunas para calcular carga contratual, complemento, intervalo intrajornada e validar o descanso mínimo interjornada de 11h entre dias seguidos.
                </div>
              </div>
              <button
                type="button"
                onClick={handleAutoCalculateShiftWorkloads}
                style={{ ...ui.btnSmall, background: "#eff6ff", color: "#1d4ed8", borderColor: "#93c5fd" }}
              >
                ⚡ Calcular Carga Base e Complemento Automaticamente
              </button>
            </div>

            <form
              onSubmit={handleSaveShift}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={ui.label}>Turno</label>
                <select
                  value={shiftPeriod}
                  onChange={(e) => setShiftPeriod(e.target.value)}
                  style={ui.select}
                >
                  <option value="MANHÃ">MANHÃ</option>
                  <option value="TARDE">TARDE</option>
                  <option value="INTERMEDIÁRIO">INTERMEDIÁRIO</option>
                  <option value="NOITE">NOITE</option>
                </select>
              </div>
              <div>
                <label style={ui.label}>1. Entrada</label>
                <input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>2. Início Intervalo</label>
                <input
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>3. Fim Intervalo</label>
                <input
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>4. Saída Base</label>
                <input
                  type="time"
                  value={exitBaseTime}
                  onChange={(e) => setExitBaseTime(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>5. C.H. Base</label>
                <input
                  type="time"
                  value={baseWorkload}
                  onChange={(e) => setBaseWorkload(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>6. Adic. / Compl.</label>
                <input
                  type="time"
                  value={extensionWorkload}
                  onChange={(e) => setExtensionWorkload(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>7. Saída Real</label>
                <input
                  type="time"
                  value={effectiveExitTime}
                  onChange={(e) => setEffectiveExitTime(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>8. C.H. Contratual</label>
                <input
                  type="time"
                  value={contractDailyWorkload}
                  onChange={(e) => setContractDailyWorkload(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={ui.label}>Nome Descritivo (Opcional — gerado auto se vazio)</label>
                <input
                  type="text"
                  placeholder="Ex: 07:00 às 15:50 (c/ 1h40 compl. → 17:30)"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit" style={ui.btnPrimary}>
                  {editingShiftId ? "Salvar Jornada" : "+ Criar Jornada"}
                </button>
                {editingShiftId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingShiftId(null);
                      setShiftCode("");
                      setShiftName("");
                    }}
                    style={ui.btnSmall}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {/* Painel de Verificação Aritmética em Tempo Real */}
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                background: liveShiftMetrics.valid ? "#f0fdf4" : "#fffbeb",
                border: `1px solid ${liveShiftMetrics.valid ? "#bbf7d0" : "#fde68a"}`,
                fontSize: 11.5,
                color: liveShiftMetrics.valid ? "#166534" : "#92400e",
              }}
            >
              <div>
                🧮 <strong>Cálculo do Motor em Tempo Real:</strong> Intervalo Intrajornada ={" "}
                <strong>{liveShiftMetrics.breakDurationFormatted}h</strong> · Carga Base Calculada ={" "}
                <strong>{liveShiftMetrics.derivedBaseFormatted}h</strong> · Complemento Calculado ={" "}
                <strong>+{liveShiftMetrics.derivedExtensionFormatted}h</strong> · Jornada Efetiva Total ={" "}
                <strong>{liveShiftMetrics.derivedTotalEffectiveFormatted}h</strong>
              </div>
              {liveShiftMetrics.warnings.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {liveShiftMetrics.warnings.map((w, i) => (
                    <div key={i}>⚠️ {w}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabela das Jornadas Contratuais Extraídas da Planilha + Auditoria Aritmética */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              ⏰ Quadro de Jornadas Contratuais Cadastradas ({db.workShifts.length} horários)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={ui.table}>
                <thead>
                  <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                    <th style={ui.th}>Turno</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Descrição da Jornada</th>
                    <th style={ui.th}>1. Entrada</th>
                    <th style={ui.th}>2. Início Int.</th>
                    <th style={ui.th}>3. Fim Int.</th>
                    <th style={ui.th}>4. Saída Base</th>
                    <th style={ui.th}>5. C.H. Base</th>
                    <th style={ui.th}>6. Compl.</th>
                    <th style={ui.th}>7. Saída Real</th>
                    <th style={ui.th}>8. Contratual</th>
                    <th style={ui.th}>Total Efetivo</th>
                    <th style={ui.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {db.workShifts.map((sh) => {
                    const m = calculateShiftMetrics(sh);
                    return (
                      <tr
                        key={sh.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          opacity: sh.active === false ? 0.5 : 1,
                        }}
                      >
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700 }}>
                          <span
                            style={{
                              background: sh.shiftPeriod === "MANHÃ" ? "#dbeafe" : "#fef3c7",
                              color: sh.shiftPeriod === "MANHÃ" ? "#1e40af" : "#92400e",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 10.5,
                            }}
                          >
                            {sh.shiftPeriod}
                          </span>
                        </td>
                        <td style={{ ...ui.td, fontWeight: 600 }}>
                          {sh.name}
                          {!m.valid && (
                            <div style={{ fontSize: 10, color: "#b45309", marginTop: 2 }}>
                              ⚠ {m.warnings[0]}
                            </div>
                          )}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center" }}>{sh.entryTime}</td>
                        <td style={{ ...ui.td, textAlign: "center" }}>{sh.breakStart}</td>
                        <td style={{ ...ui.td, textAlign: "center" }}>{sh.breakEnd}</td>
                        <td style={{ ...ui.td, textAlign: "center" }}>{sh.exitBaseTime}</td>
                        <td style={{ ...ui.td, textAlign: "center" }}>{sh.baseWorkload}</td>
                        <td style={{ ...ui.td, textAlign: "center", color: "#64748b" }}>
                          +{sh.extensionWorkload}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#0f172a" }}>
                          {sh.effectiveExitTime}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700 }}>
                          {sh.contractDailyWorkload}
                        </td>
                        <td
                          style={{
                            ...ui.td,
                            textAlign: "center",
                            fontWeight: 800,
                            color: m.valid ? "#166534" : "#b45309",
                          }}
                        >
                          {m.derivedTotalEffectiveFormatted}h
                        </td>
                        <td style={{ ...ui.td, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button
                              onClick={() => loadShiftIntoForm(sh, false)}
                              style={ui.btnSmall}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => loadShiftIntoForm(sh, true)}
                              style={ui.btnSmall}
                            >
                              📋 Duplicar
                            </button>
                            <button
                              onClick={() => handleToggleDeactivateShift(sh)}
                              style={{ ...ui.btnSmall, color: "#64748b" }}
                            >
                              {sh.active === false ? "Ativar" : "Desativar"}
                            </button>
                            {db.workShifts.length > 1 && (
                              <button
                                onClick={() => handleDeleteShift(sh)}
                                style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                              >
                                🗑️ Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela de Faixas de Almoço de Domingo / Feriado */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              🍽️ Escala de Intervalos de Almoço aos Domingos e Feriados (N 01 a N 04)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {Object.entries(FAIXAS_ALMOCO_DOMINGO).map(([num, info]) => (
                <div
                  key={num}
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#166534" }}>
                    Célula "{num}" → {info.codigo}
                  </div>
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                    Horário de almoço: <strong>{info.horario}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ui = createUniaoModuleUi({
  select: {
    width: "100%",
  },
  input: {
    width: "100%",
  },
});
