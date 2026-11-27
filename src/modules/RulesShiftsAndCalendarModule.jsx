// =============================================================================
// REGRAS DE ESCALA, JORNADAS CONTRATUAIS E CALENDÁRIO OPERACIONAL (v9.0)
// =============================================================================

import { useState, useMemo } from "react";
import {
  ABERTURA_MERCADO_META,
  DIAS_SEMANA_CURTO,
  FAIXAS_ALMOCO_DOMINGO,
  calculateShiftMetrics,
  computeBaseWorkload,
  deriveRuleType,
  normalizeScheduleRule,
  parseTimeToMinutes,
  validateScheduleRuleConfig,
} from "../domain/scheduleEngine.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";

const SHIFT_COLUMNS = [
  { key: "shiftPeriod", num: null, label: "Turno", kind: "text", align: "center" },
  { key: "name", num: null, label: "Descrição", kind: "text", align: "left" },
  { key: "entryTime", num: "01", label: "Entrada", kind: "time", align: "center" },
  { key: "breakStart", num: "02", label: "Início intervalo", kind: "time", align: "center" },
  { key: "breakEnd", num: "03", label: "Fim intervalo", kind: "time", align: "center" },
  { key: "exitBaseTime", num: "04", label: "Saída base", kind: "time", align: "center" },
  { key: "baseWorkload", num: "05", label: "C.H. Base", kind: "duration", align: "center" },
  { key: "extensionWorkload", num: "06", label: "Adic. / Compl.", kind: "duration", align: "center" },
  { key: "effectiveExitTime", num: "07", label: "Saída real", kind: "time", align: "center" },
  { key: "totalEffective", num: null, label: "Total efetivo", kind: "duration", align: "center" },
];

export default function RulesShiftsAndCalendarModule({
  db,
  selectedUnitId,
  initialTab = "rules",
  onMutateDb,
}) {
  const [subTab, setSubTab] = useState(
    initialTab === "calendar"
      ? "calendar"
      : initialTab === "shifts"
        ? "shifts"
        : "rules"
  );
  const unitsById = Object.fromEntries((db.units || []).map((u) => [u.id, u]));
  const selectedUnitLabel =
    unitsById[selectedUnitId]?.name || unitsById[selectedUnitId]?.code || selectedUnitId || "Unidade";

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ESTADO DO CALENDÁRIO OPERACIONAL
  // ───────────────────────────────────────────────────────────────────────────
  const [editingCalId, setEditingCalId] = useState(null);
  const [calDate, setCalDate] = useState("2026-11-15");
  const [calType, setCalType] = useState("HOLIDAY");
  const [calMode, setCalMode] = useState("FULL_DAY");
  const [calDesc, setCalDesc] = useState("");
  const [calHalfTime, setCalHalfTime] = useState("13:00");
  const [calLunch, setCalLunch] = useState(true);

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ESTADO DAS REGRAS DE ESCALA (FORMULÁRIO ÚNICO + VIGÊNCIAS)
  // ───────────────────────────────────────────────────────────────────────────
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleCode, setRuleCode] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleWorkDays, setRuleWorkDays] = useState(5);
  const [ruleRestDays, setRuleRestDays] = useState(2);
  const [ruleMaxConsec, setRuleMaxConsec] = useState(5);
  const [ruleAllowedDows, setRuleAllowedDows] = useState([0, 6]);
  const [ruleFixedDows, setRuleFixedDows] = useState([0, 6]);
  const [ruleSundayLunch, setRuleSundayLunch] = useState(false);
  const [ruleClosedCountsRest, setRuleClosedCountsRest] = useState(true);
  const [ruleFormErrors, setRuleFormErrors] = useState([]);

  // Alteração de regra por colaborador e vigência
  const [ovEmpId, setOvEmpId] = useState(db.employees[0]?.id || "");
  const [ovRuleId, setOvRuleId] = useState(db.scheduleRules[0]?.id || "RULE_5X2");
  const [ovFromDate, setOvFromDate] = useState("2026-11-16");
  const [ovToDate, setOvToDate] = useState("");

  // ───────────────────────────────────────────────────────────────────────────
  // 3. ESTADO DE JORNADAS CONTRATUAIS (7 COLUNAS + ORDENAÇÃO)
  // ───────────────────────────────────────────────────────────────────────────
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [shiftCode, setShiftCode] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [shiftPeriod, setShiftPeriod] = useState("MANHÃ");
  const [entryTime, setEntryTime] = useState("07:00");
  const [breakStart, setBreakStart] = useState("11:30");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [exitBaseTime, setExitBaseTime] = useState("15:50");
  const [extensionWorkload, setExtensionWorkload] = useState("01:40");
  const [effectiveExitTime, setEffectiveExitTime] = useState("17:30");
  const [shiftSort, setShiftSort] = useState({ key: "shiftPeriod", direction: "asc" });

  // C.H. Base calculada reativamente: (Saída base - Entrada) - (Fim do intervalo - Início do intervalo)
  const computedBase = useMemo(
    () => computeBaseWorkload(entryTime, breakStart, breakEnd, exitBaseTime),
    [entryTime, breakStart, breakEnd, exitBaseTime]
  );
  const baseWorkload = computedBase.formatted;

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
        contractDailyWorkload: baseWorkload,
      }),
    [entryTime, breakStart, breakEnd, exitBaseTime, baseWorkload, extensionWorkload, effectiveExitTime]
  );

  const unitCalendarDays = useMemo(
    () =>
      (db.marketCalendarDays || []).filter(
        (c) => !selectedUnitId || c.unitId === selectedUnitId
      ),
    [db.marketCalendarDays, selectedUnitId]
  );

  const sortedWorkShifts = useMemo(() => {
    const colMeta = SHIFT_COLUMNS.find((c) => c.key === shiftSort.key);
    const dir = shiftSort.direction === "desc" ? -1 : 1;
    return [...(db.workShifts || [])].sort((a, b) => {
      if (!colMeta) return 0;
      if (colMeta.kind === "text") {
        const va = String(a[colMeta.key] || "");
        const vb = String(b[colMeta.key] || "");
        return dir * va.localeCompare(vb, "pt-BR", { sensitivity: "base" });
      }
      const getVal = (sh) => {
        if (colMeta.key === "baseWorkload") {
          return sh.baseWorkload
            ? parseTimeToMinutes(sh.baseWorkload)
            : computeBaseWorkload(sh.entryTime, sh.breakStart, sh.breakEnd, sh.exitBaseTime).minutes;
        }
        if (colMeta.key === "totalEffective") {
          return calculateShiftMetrics(sh).derivedTotalEffectiveMinutes;
        }
        return parseTimeToMinutes(sh[colMeta.key] || "00:00");
      };
      return dir * (getVal(a) - getVal(b));
    });
  }, [db.workShifts, shiftSort]);

  const handleToggleShiftSort = (key) => {
    setShiftSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
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
              contractDailyWorkload: baseWorkload,
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
            contractDailyWorkload: baseWorkload,
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
    setExtensionWorkload(sh.extensionWorkload || "01:40");
    setEffectiveExitTime(sh.effectiveExitTime || "17:30");
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
      resetRuleForm();
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

  // Salvar dia no Calendário Operacional
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
      summary: `Data ${calDate} (${selectedUnitId}) salva como ${calType} — "${ABERTURA_MERCADO_META[calMode]?.label}"${hasExistingSchedule ? ` (Competência ${yearMonthAffected} possui escala ativa: use 'Gerar com continuidade' para aplicar nas células automáticas)` : ""}.`,
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

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleCode("");
    setRuleName("");
    setRuleWorkDays(5);
    setRuleRestDays(2);
    setRuleMaxConsec(5);
    setRuleAllowedDows([0, 6]);
    setRuleFixedDows([0, 6]);
    setRuleSundayLunch(false);
    setRuleClosedCountsRest(true);
    setRuleFormErrors([]);
  };

  const toggleAllowedDow = (dowNum) => {
    setRuleFormErrors([]);
    setRuleAllowedDows((prev) => {
      if (prev.includes(dowNum)) {
        setRuleFixedDows((fPrev) => fPrev.filter((d) => d !== dowNum));
        return prev.filter((d) => d !== dowNum);
      }
      return [...prev, dowNum];
    });
  };

  const toggleFixedDow = (dowNum) => {
    setRuleFormErrors([]);
    if (!ruleAllowedDows.includes(dowNum)) return;
    setRuleFixedDows((prev) =>
      prev.includes(dowNum) ? prev.filter((d) => d !== dowNum) : [...prev, dowNum]
    );
  };

  // Criar ou Editar Regra de Escala (formulário único)
  const handleSaveRule = (e) => {
    e.preventDefault();
    const cleanCode = ruleCode.trim().toUpperCase().replace(/\s+/g, " ");
    const cleanName = ruleName.trim();
    const workDays = Number(ruleWorkDays);
    const restDays = Number(ruleRestDays);
    const maxConsec = Number(ruleMaxConsec);

    const validation = validateScheduleRuleConfig({
      workDaysInCycle: workDays,
      restDaysInCycle: restDays,
      maxConsecutiveWorkDays: maxConsec,
      allowedRestDows: ruleAllowedDows,
      fixedRestDows: ruleFixedDows,
    });

    const errors = [...validation.errors];
    if (!cleanCode) errors.unshift("Informe o código da regra.");
    if (!cleanName) errors.unshift("Informe o nome da regra.");

    const duplicateCode = (db.scheduleRules || []).some(
      (r) =>
        r.id !== editingRuleId &&
        String(r.code || "").trim().toUpperCase().replace(/\s+/g, " ") === cleanCode
    );
    if (duplicateCode) {
      errors.push(`Já existe uma regra cadastrada com o código "${cleanCode}".`);
    }

    if (errors.length > 0) {
      setRuleFormErrors(errors);
      return;
    }
    setRuleFormErrors([]);

    const derivedType = deriveRuleType({
      workDaysInCycle: workDays,
      restDaysInCycle: restDays,
      allowedRestDows: ruleAllowedDows,
      fixedRestDows: ruleFixedDows,
    });

    const isFullyFixedWeek =
      ruleFixedDows.length > 0 &&
      ruleFixedDows.length === restDays &&
      ruleAllowedDows.length === ruleFixedDows.length;

    onMutateDb({
      permission: "MANAGE_RULES_SHIFTS",
      module: "MOTOR_DE_REGRAS",
      action: editingRuleId ? "EDITAR_REGRA_ESCALA" : "CRIAR_REGRA_ESCALA",
      entityType: "SCHEDULE_RULE",
      entityId: editingRuleId || cleanCode,
      summary: `${editingRuleId ? "Atualizada" : "Criada"} regra de escala "${cleanCode} — ${cleanName}" (${workDays}x${restDays}).`,
      updater: (draft) => {
        const payload = {
          code: cleanCode,
          name: cleanName,
          description: `Ciclo ${workDays}x${restDays} — máx. ${maxConsec} dias consecutivos`,
          ruleType: derivedType,
          workDaysInCycle: workDays,
          restDaysInCycle: restDays,
          allowedRestDows: [...ruleAllowedDows],
          fixedRestDows: [...ruleFixedDows],
          fixedWeekdays: isFullyFixedWeek,
          maxConsecutiveWorkDays: maxConsec,
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
            id: `RULE_${cleanCode.replace(/\W+/g, "_")}_${Date.now()}`,
            ...payload,
          });
        }
      },
    });
    resetRuleForm();
  };

  const loadRuleIntoForm = (r, asDuplicate = false) => {
    const norm = normalizeScheduleRule(r);
    setEditingRuleId(asDuplicate ? null : r.id);
    setRuleCode(asDuplicate ? `${r.code}_COPIA` : r.code);
    setRuleName(asDuplicate ? `${r.name} (Cópia)` : r.name);
    setRuleWorkDays(norm?.workDaysInCycle || 5);
    setRuleRestDays(norm?.restDaysInCycle || 2);
    setRuleMaxConsec(norm?.maxConsecutiveWorkDays || 5);
    setRuleAllowedDows(norm?.allowedRestDows || []);
    setRuleFixedDows(norm?.fixedRestDows || []);
    setRuleSundayLunch(r.requiresSundayLunchSlot !== false);
    setRuleClosedCountsRest(r.closedMarketCountsAsRest !== false);
    setRuleFormErrors([]);
  };

  // Atribuir alteração de regra com data de vigência a um colaborador
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

  const formatDowsList = (dows) =>
    dows && dows.length > 0
      ? dows.map((d) => DIAS_SEMANA_CURTO[d]).join(" / ")
      : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setSubTab("rules")}
          style={subTab === "rules" ? ui.subTabActive : ui.subTab}
        >
          Regras de escala
        </button>
        <button
          type="button"
          onClick={() => setSubTab("shifts")}
          style={subTab === "shifts" ? ui.subTabActive : ui.subTab}
        >
          Jornadas contratuais
        </button>
        <button
          type="button"
          onClick={() => setSubTab("calendar")}
          style={subTab === "calendar" ? ui.subTabActive : ui.subTab}
        >
          Calendário operacional — {selectedUnitLabel} ({unitCalendarDays.length})
        </button>
      </div>

      {subTab === "calendar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              {editingCalId
                ? `Editar data do calendário operacional (${selectedUnitLabel})`
                : `Calendário operacional — ${selectedUnitLabel}`}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Define o funcionamento da unidade <strong>{selectedUnitLabel}</strong> em feriados e datas especiais.
            </div>

            <form
              onSubmit={handleSaveCalendarDay}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Data</label>
                <input
                  type="date"
                  required
                  value={calDate}
                  onChange={(e) => setCalDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Classificação do dia</label>
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
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Regime de abertura</label>
                <select
                  value={calMode}
                  onChange={(e) => setCalMode(e.target.value)}
                  style={ui.select}
                >
                  <option value="FULL_DAY">Dia Inteiro (Normal)</option>
                  <option value="HALF_DAY">Meio Dia (Meio Expediente)</option>
                  <option value="CLOSED">Fechado (Não Abre)</option>
                </select>
              </div>
              {calMode === "HALF_DAY" && (
                <div style={{ minWidth: 0 }}>
                  <label style={ui.label}>Fechamento meio dia</label>
                  <input
                    type="time"
                    value={calHalfTime}
                    onChange={(e) => setCalHalfTime(e.target.value)}
                    style={ui.input}
                  />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Finados / Natal / Aniversário da Cidade"
                  value={calDesc}
                  onChange={(e) => setCalDesc(e.target.value)}
                  style={ui.input}
                />
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 4,
                }}
              >
                <label
                  htmlFor="chk_lunch_cal"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    color: "#334155",
                    cursor: calMode === "CLOSED" ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    id="chk_lunch_cal"
                    checked={calLunch}
                    disabled={calMode === "CLOSED"}
                    onChange={(e) => setCalLunch(e.target.checked)}
                  />
                  <span>Exigir escala de almoço (N 01 a N 04)</span>
                </label>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="submit" style={ui.btnPrimary}>
                    {editingCalId ? "Salvar alteração" : "Salvar no calendário"}
                  </button>
                  {editingCalId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCalId(null);
                        setCalDesc("");
                      }}
                      style={ui.btnSecondary}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Calendário operacional — {selectedUnitLabel} ({unitCalendarDays.length} datas)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={ui.table}>
                <thead>
                  <tr style={{ background: "var(--uniao-table-header-bg, #F1F5F9)" }}>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Data</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Unidade</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Tipo</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Regime de abertura</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Descrição</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Escala almoço</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {unitCalendarDays.map((c) => {
                    const meta = ABERTURA_MERCADO_META[c.openingMode] || ABERTURA_MERCADO_META.FULL_DAY;
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {c.calendarDate.split("-").reverse().join("/")}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {unitsById[c.unitId]?.name || unitsById[c.unitId]?.code || c.unitId}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontSize: 11.5, whiteSpace: "nowrap" }}>{c.dayType}</td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-block",
                              background: meta.bg,
                              color: meta.cor,
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {meta.label}
                            {c.openingMode === "HALF_DAY" ? ` (até ${c.halfDayClosingTime})` : ""}
                          </span>
                        </td>
                        <td style={{ ...ui.td, fontWeight: 600 }}>{c.description}</td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                          {c.requiresLunchScale ? "Sim (N 01 a N 04)" : "Não"}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: 6, justifyContent: "center", flexWrap: "nowrap" }}>
                            <button
                              type="button"
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
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveCalendarDay(c.id)}
                              style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                            >
                              Excluir
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
        </div>
      )}

      {subTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. Formulário de Cadastro / Edição de Regra de Escala */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              {editingRuleId
                ? `Editar regra de escala: ${ruleCode}`
                : "Cadastrar / Editar regra de escala"}
            </div>

            {ruleFormErrors.length > 0 && (
              <div
                role="alert"
                style={{
                  marginTop: 8,
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {ruleFormErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSaveRule}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                gap: 12,
                alignItems: "end",
                marginTop: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Código *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 5X2 DOM QUA QUI"
                  value={ruleCode}
                  onChange={(e) => {
                    setRuleFormErrors([]);
                    setRuleCode(e.target.value);
                  }}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0, gridColumn: "span 2" }}>
                <label style={ui.label}>Nome *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Escala 5x2 (Domingo fixo + Quarta ou Quinta)"
                  value={ruleName}
                  onChange={(e) => {
                    setRuleFormErrors([]);
                    setRuleName(e.target.value);
                  }}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Dias de trabalho</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={ruleWorkDays}
                  onChange={(e) => {
                    setRuleFormErrors([]);
                    setRuleWorkDays(e.target.value);
                  }}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Dias de descanso</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={ruleRestDays}
                  onChange={(e) => {
                    setRuleFormErrors([]);
                    setRuleRestDays(e.target.value);
                  }}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Máx. dias consecutivos</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={ruleMaxConsec}
                  onChange={(e) => {
                    setRuleFormErrors([]);
                    setRuleMaxConsec(e.target.value);
                  }}
                  style={ui.input}
                />
              </div>

              <div style={{ minWidth: 0, gridColumn: "1 / -1" }}>
                <label style={ui.label}>Dias da semana permitidos para folga</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DIAS_SEMANA_CURTO.map((lb, idx) => {
                    const selected = ruleAllowedDows.includes(idx);
                    return (
                      <button
                        type="button"
                        key={`allowed_${lb}`}
                        aria-pressed={selected}
                        onClick={() => toggleAllowedDow(idx)}
                        style={selected ? ui.pillActive : ui.pill}
                      >
                        {lb}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ minWidth: 0, gridColumn: "1 / -1" }}>
                <label style={ui.label}>
                  Dias de folga fixa na geração automática (subconjunto dos dias permitidos)
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DIAS_SEMANA_CURTO.map((lb, idx) => {
                    const isAllowed = ruleAllowedDows.includes(idx);
                    const isFixed = ruleFixedDows.includes(idx);
                    return (
                      <button
                        type="button"
                        key={`fixed_${lb}`}
                        aria-pressed={isFixed}
                        disabled={!isAllowed}
                        title={
                          isAllowed
                            ? `Marcar ${lb} como folga fixa na geração automática`
                            : `Selecione ${lb} nos dias permitidos para poder marcá-lo como fixo`
                        }
                        onClick={() => toggleFixedDow(idx)}
                        style={{
                          ...(isFixed ? ui.pillActive : ui.pill),
                          opacity: isAllowed ? 1 : 0.45,
                          cursor: isAllowed ? "pointer" : "not-allowed",
                        }}
                      >
                        {lb}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 4,
                }}
              >
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={ruleSundayLunch}
                      onChange={(e) => setRuleSundayLunch(e.target.checked)}
                    />
                    <span>Exigir faixa de almoço aos domingos</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={ruleClosedCountsRest}
                      onChange={(e) => setRuleClosedCountsRest(e.target.checked)}
                    />
                    <span>Mercado fechado conta como descanso no ciclo</span>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="submit" style={ui.btnPrimary}>
                    {editingRuleId ? "Salvar alterações da regra" : "Salvar regra"}
                  </button>
                  {editingRuleId && (
                    <button type="button" onClick={resetRuleForm} style={ui.btnSecondary}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* 2. Tabela de Regras Cadastradas */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Regras de escala cadastradas ({db.scheduleRules.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={ui.table}>
                <thead>
                  <tr style={{ background: "var(--uniao-table-header-bg, #F1F5F9)" }}>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Código</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Nome da regra</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Ciclo</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Dias permitidos</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Folga fixa (automática)</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Máx. consecutivos</th>
                    <th style={{ ...ui.th, textAlign: "center", whiteSpace: "nowrap" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {db.scheduleRules.map((r) => {
                    const norm = normalizeScheduleRule(r);
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#1d4ed8", whiteSpace: "nowrap" }}>
                          {r.code}
                        </td>
                        <td style={{ ...ui.td, fontWeight: 600 }}>{r.name}</td>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {norm.workDaysInCycle} × {norm.restDaysInCycle}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                          {norm.allowedRestDows.length > 0
                            ? formatDowsList(norm.allowedRestDows)
                            : "Contínuo"}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                          {norm.fixedRestDows.length > 0
                            ? formatDowsList(norm.fixedRestDows)
                            : "Variável"}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                          {norm.maxConsecutiveWorkDays} dias
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: 6, justifyContent: "center", flexWrap: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => loadRuleIntoForm(r, false)}
                              style={ui.btnSmall}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => loadRuleIntoForm(r, true)}
                              style={ui.btnSmall}
                            >
                              Duplicar
                            </button>
                            {db.scheduleRules.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRule(r)}
                                style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                              >
                                Excluir
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

          {/* 3. Alteração de Regra de Escala por Colaborador e Vigências */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Alteração de regra de escala
            </div>
            <form
              onSubmit={handleAddRuleAssignment}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                alignItems: "end",
                marginTop: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
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
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Nova regra de escala</label>
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
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Início da vigência</label>
                <input
                  type="date"
                  required
                  value={ovFromDate}
                  onChange={(e) => setOvFromDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>Fim da vigência (opcional)</label>
                <input
                  type="date"
                  value={ovToDate}
                  onChange={(e) => setOvToDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <button type="submit" style={ui.btnPrimary}>
                Aplicar vigência
              </button>
            </form>

            {(db.ruleAssignments || []).length > 0 && (
              <div style={{ marginTop: 14, overflowX: "auto" }}>
                <table style={ui.table}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ ...ui.th, textAlign: "left" }}>Colaborador</th>
                      <th style={{ ...ui.th, textAlign: "center" }}>Regra aplicada</th>
                      <th style={{ ...ui.th, textAlign: "center" }}>Período de vigência</th>
                      <th style={{ ...ui.th, textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(db.ruleAssignments || []).map((ra) => {
                      const emp = db.employees.find((x) => x.id === ra.employeeId);
                      const rule = db.scheduleRules.find((x) => x.id === ra.ruleId);
                      return (
                        <tr key={ra.id}>
                          <td style={{ ...ui.td, fontWeight: 700 }}>{emp?.fullName}</td>
                          <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#1d4ed8", whiteSpace: "nowrap" }}>
                            {rule?.code}
                          </td>
                          <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                            A partir de {ra.effectiveFrom.split("-").reverse().join("/")}
                            {ra.effectiveTo ? ` até ${ra.effectiveTo.split("-").reverse().join("/")}` : " (Indeterminado)"}
                          </td>
                          <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteRuleAssignment(ra)}
                              style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                            >
                              Excluir
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
          {/* Formulário de Cadastro / Edição de Jornada Contratual (7 colunas) */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              {editingShiftId
                ? `Editar jornada contratual: ${shiftCode}`
                : "Cadastrar / Editar jornada contratual"}
            </div>

            <form
              onSubmit={handleSaveShift}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                alignItems: "end",
                marginTop: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
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
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>1. Entrada</label>
                <input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>2. Início do intervalo</label>
                <input
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>3. Fim do intervalo</label>
                <input
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>4. Saída base</label>
                <input
                  type="time"
                  value={exitBaseTime}
                  onChange={(e) => setExitBaseTime(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>5. C.H. Base</label>
                <input
                  type="time"
                  value={baseWorkload}
                  readOnly
                  aria-readonly="true"
                  style={{ ...ui.input, background: "#f1f5f9", fontWeight: 700 }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>6. Adicional / Complemento</label>
                <input
                  type="time"
                  value={extensionWorkload}
                  onChange={(e) => setExtensionWorkload(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={ui.label}>7. Saída real</label>
                <input
                  type="time"
                  value={effectiveExitTime}
                  onChange={(e) => setEffectiveExitTime(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ minWidth: 0, gridColumn: "span 2" }}>
                <label style={ui.label}>Descrição (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 07:00 às 15:50 (c/ 1h40 compl. → 17:30)"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="submit" style={ui.btnPrimary}>
                  {editingShiftId ? "Salvar jornada" : "Cadastrar jornada"}
                </button>
                {editingShiftId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingShiftId(null);
                      setShiftCode("");
                      setShiftName("");
                    }}
                    style={ui.btnSecondary}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {liveShiftMetrics.warnings.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  fontSize: 12,
                  color: "#92400e",
                }}
              >
                {liveShiftMetrics.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela das Jornadas Contratuais */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              Jornadas contratuais cadastradas ({db.workShifts.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={ui.table}>
                <thead>
                  <tr style={{ background: "var(--uniao-table-header-bg, #F1F5F9)" }}>
                    {SHIFT_COLUMNS.map((col) => {
                      const isSorted = shiftSort.key === col.key;
                      const ariaSort = isSorted
                        ? shiftSort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none";
                      const indicator = isSorted
                        ? shiftSort.direction === "asc"
                          ? "↑"
                          : "↓"
                        : "↕";
                      return (
                        <th
                          key={col.key}
                          aria-sort={ariaSort}
                          style={{
                            ...ui.th,
                            textAlign: col.align,
                            padding: 0,
                            verticalAlign: "bottom",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleShiftSort(col.key)}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              font: "inherit",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: col.align === "left" ? "flex-start" : "center",
                              gap: 2,
                            }}
                          >
                            {col.num && (
                              <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>
                                {col.num}
                              </span>
                            )}
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span>{col.label}</span>
                              <span
                                aria-hidden="true"
                                style={{
                                  fontSize: 10.5,
                                  opacity: isSorted ? 0.95 : 0.35,
                                }}
                              >
                                {indicator}
                              </span>
                            </span>
                          </button>
                        </th>
                      );
                    })}
                    <th style={{ ...ui.th, textAlign: "center", verticalAlign: "bottom", whiteSpace: "nowrap" }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkShifts.map((sh) => {
                    const m = calculateShiftMetrics(sh);
                    const computedRowBase = computeBaseWorkload(
                      sh.entryTime,
                      sh.breakStart,
                      sh.breakEnd,
                      sh.exitBaseTime
                    ).formatted;
                    return (
                      <tr
                        key={sh.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          opacity: sh.active === false ? 0.55 : 1,
                        }}
                      >
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              display: "inline-block",
                              background: sh.shiftPeriod === "MANHÃ" ? "#dbeafe" : "#fef3c7",
                              color: sh.shiftPeriod === "MANHÃ" ? "#1e40af" : "#92400e",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {sh.shiftPeriod}
                          </span>
                        </td>
                        <td style={{ ...ui.td, fontWeight: 600 }}>
                          {sh.name}
                          {!m.valid && (
                            <div style={{ fontSize: 10.5, color: "#b45309", marginTop: 2 }}>
                              {m.warnings[0]}
                            </div>
                          )}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>{sh.entryTime}</td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>{sh.breakStart}</td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>{sh.breakEnd}</td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>{sh.exitBaseTime}</td>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {sh.baseWorkload || computedRowBase}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", color: "#64748b", whiteSpace: "nowrap" }}>
                          +{sh.extensionWorkload || "00:00"}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                          {sh.effectiveExitTime}
                        </td>
                        <td
                          style={{
                            ...ui.td,
                            textAlign: "center",
                            fontWeight: 700,
                            color: m.valid ? "#166534" : "#b45309",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.derivedTotalEffectiveFormatted}h
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: 6, justifyContent: "center", flexWrap: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => loadShiftIntoForm(sh, false)}
                              style={ui.btnSmall}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => loadShiftIntoForm(sh, true)}
                              style={ui.btnSmall}
                            >
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleDeactivateShift(sh)}
                              style={{ ...ui.btnSmall, color: "#475569" }}
                            >
                              {sh.active === false ? "Ativar" : "Desativar"}
                            </button>
                            {db.workShifts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteShift(sh)}
                                style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                              >
                                Excluir
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
              Faixas de almoço aos domingos e feriados (N 01 a N 04)
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
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#166534" }}>
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
