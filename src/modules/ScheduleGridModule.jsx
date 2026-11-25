// =============================================================================
// MÓDULO DE ESCALAS MENSAIS (v8.0) — REENGENHARIA COMPLETA DE UX, EDIÇÃO E MOTOR
// Inclui: Colunas Fixas (Sticky), Rolagem Horizontal Fluida, Modo Compacto/Detalhado,
// Popover Contextual de Célula, Modo Pincel de Edição Rápida, Desfazer/Refazer,
// Construir Escala Manual, Limpar Mês, Validação em 10 Níveis e Governança Publicada
// =============================================================================

import { Fragment, useState, useMemo, useCallback } from "react";
import {
  listDatesInYearMonth,
  getPreviousYearMonth,
  getNextYearMonth,
  getDayOfWeekISO,
  generateEmployeeScheduleForMonth,
  balanceSectorSundayLunchSlots,
  projectNextMonthFirstRestDate,
  isCellModificationNoOp,
  evaluateBilateralRestSwap,
  detectFutureScheduleImpact,
  validateMonthlyScheduleChecklist,
  getActiveAllocationOnDate,
  calculateEmployeeMonthlyWorkload,
  isScheduleLockedForEditing,
  reopenPublishedSchedule,
  DIAS_SEMANA_CURTO,
  FAIXAS_ALMOCO_DOMINGO,
  STATUS_VAGA_META,
  STATUS_CELULA_META,
} from "../domain/scheduleEngine.js";
import UniaoLogo from "../components/UniaoLogo.jsx";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";
import {
  Icon,
  Button,
  Badge,
  PopoverMenu,
  SearchInput,
} from "../ui/index.jsx";
import { buildSchedulePrintDocument } from "../domain/schedulePrintDocument.js";
import { downloadSchedulePdf } from "../domain/schedulePdfExporter.js";
import SchedulePrintPreviewModal, {
  ScheduleDefaultPrintPortal,
} from "./schedule/SchedulePrintPreviewModal.jsx";

const BRUSH_TOOLS = [
  { id: "T", group: "Jornada", label: "Trabalhando (T)" },
  { id: "F", group: "Folgas", label: "Folga normal (F)" },
  { id: "A", group: "Folgas", label: "Folga adicional (A)" },
  { id: "MEIO_EXP", group: "Jornada", label: "Meio expediente (1/2)" },
  { id: "LUNCH_1", group: "Intervalos", label: "Almoço 1 (09–10h)" },
  { id: "LUNCH_2", group: "Intervalos", label: "Almoço 2 (10–11h)" },
  { id: "LUNCH_3", group: "Intervalos", label: "Almoço 3 (11–12h)" },
  { id: "LUNCH_4", group: "Intervalos", label: "Almoço 4 (12–13h)" },
  { id: "AUTO_RESTORE", group: "Correção", label: "Borracha (Restaurar regra)" },
  { id: "EMPTY", group: "Correção", label: "Limpar célula (—)" },
];

export default function ScheduleGridModule({
  db,
  selectedUnitId,
  selectedYearMonth,
  setSelectedYearMonth,
  currentUserRole = "ADMIN",
  currentUserEmail = "operador@uniaosupermercados.com.br",
  syncStatus = "idle",
  onMutateDb,
  onNavigate,
}) {
  // Filtros e modos visuais (Seção 10)
  const [filterSectorId, setFilterSectorId] = useState("");
  const [filterShiftPeriod, setFilterShiftPeriod] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchEmp, setSearchEmp] = useState("");
  const [showVacantPositions, setShowVacantPositions] = useState(true);
  const [showPrevMonthTail, setShowPrevMonthTail] = useState(true);
  const [viewDensity, setViewDensity] = useState("compact"); // 'compact' | 'detailed'
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isExpandedFullscreen, setIsExpandedFullscreen] = useState(false);
  const [collapsedSectorIds, setCollapsedSectorIds] = useState(() => new Set());

  // Modo Pincel Contextual, Popover de Célula e Histórico Undo/Redo
  const [brushModeActive, setBrushModeActive] = useState(false);
  const [activeBrush, setActiveBrush] = useState("NONE");
  const [isMousePainting, setIsMousePainting] = useState(false);
  const [cellPopover, setCellPopover] = useState(null); // { emp, pos, isoDate, anchorRect }
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Modais Operacionais (Seções 11, 12, 14, 15)
  const [impactReport, setImpactReport] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [manualBuildModalOpen, setManualBuildModalOpen] = useState(false);
  const [manualCopySourceMonth, setManualCopySourceMonth] = useState("2026-10");
  const [clearMonthModalOpen, setClearMonthModalOpen] = useState(false);
  const [validationModalData, setValidationModalData] = useState(null);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReasonText, setReopenReasonText] = useState("");
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  const prevYearMonth = useMemo(() => getPreviousYearMonth(selectedYearMonth), [selectedYearMonth]);
  const nextYearMonth = useMemo(() => getNextYearMonth(selectedYearMonth), [selectedYearMonth]);

  const monthDates = useMemo(() => listDatesInYearMonth(selectedYearMonth), [selectedYearMonth]);
  const prevTailDates = useMemo(
    () => listDatesInYearMonth(prevYearMonth).slice(-6),
    [prevYearMonth]
  );

  const sectorsById = useMemo(
    () => Object.fromEntries(db.sectors.map((s) => [s.id, s])),
    [db.sectors]
  );
  const shiftsById = useMemo(
    () => Object.fromEntries(db.workShifts.map((s) => [s.id, s])),
    [db.workShifts]
  );
  const rulesById = useMemo(
    () => Object.fromEntries(db.scheduleRules.map((r) => [r.id, r])),
    [db.scheduleRules]
  );
  const marketCalendarByDate = useMemo(
    () =>
      Object.fromEntries(
        db.marketCalendarDays
          .filter((c) => c.unitId === selectedUnitId)
          .map((c) => [c.calendarDate, c])
      ),
    [db.marketCalendarDays, selectedUnitId]
  );

  const allMonthEntries = useMemo(
    () => db.dailyEntriesByMonth[selectedYearMonth] || [],
    [db.dailyEntriesByMonth, selectedYearMonth]
  );
  const monthEntries = useMemo(
    () => allMonthEntries.filter((e) => !e.unitId || e.unitId === selectedUnitId),
    [allMonthEntries, selectedUnitId]
  );
  const prevMonthEntries = useMemo(
    () =>
      (db.dailyEntriesByMonth[prevYearMonth] || []).filter(
        (e) => !e.unitId || e.unitId === selectedUnitId
      ),
    [db.dailyEntriesByMonth, prevYearMonth, selectedUnitId]
  );
  const nextMonthEntries = useMemo(
    () =>
      (db.dailyEntriesByMonth[nextYearMonth] || []).filter(
        (e) => !e.unitId || e.unitId === selectedUnitId
      ),
    [db.dailyEntriesByMonth, nextYearMonth, selectedUnitId]
  );

  const entriesByEmpDate = useMemo(() => {
    const map = {};
    [...prevMonthEntries, ...monthEntries].forEach((e) => {
      if (!map[e.employeeId]) map[e.employeeId] = {};
      map[e.employeeId][e.workDate] = e;
    });
    return map;
  }, [prevMonthEntries, monthEntries]);

  const currentMonthlySchedule = useMemo(
    () =>
      (db.monthlySchedules || []).find(
        (ms) => ms.unitId === selectedUnitId && ms.yearMonth === selectedYearMonth
      ) || {
        unitId: selectedUnitId,
        yearMonth: selectedYearMonth,
        status: "DRAFT",
        versionNumber: 1,
        versionHistory: [],
        impactWarning: null,
      },
    [db.monthlySchedules, selectedUnitId, selectedYearMonth]
  );

  const isLockedPublished = isScheduleLockedForEditing(currentMonthlySchedule);

  // Validação e Conflitos em tempo real (Checklist de 10 níveis — Seção 12)
  const validationChecklist = useMemo(
    () =>
      validateMonthlyScheduleChecklist({
        unitId: selectedUnitId,
        yearMonth: selectedYearMonth,
        employees: db.employees,
        allocations: db.allocations,
        rulesById,
        shiftsById,
        sectorsById,
        unitSectors: db.unitSectors,
        unavailabilityEvents: db.unavailabilityEvents,
        marketCalendarByDate,
        monthEntries,
        previousMonthEntries: prevMonthEntries,
        allUnitsMonthEntries: allMonthEntries,
      }),
    [
      selectedUnitId,
      selectedYearMonth,
      db.employees,
      db.allocations,
      rulesById,
      shiftsById,
      sectorsById,
      db.unitSectors,
      db.unavailabilityEvents,
      marketCalendarByDate,
      monthEntries,
      prevMonthEntries,
      allMonthEntries,
    ]
  );

  // Índice rápido de erros/alertas por (employeeId, workDate) para sinalização direta na célula
  const conflictsByEmpDate = useMemo(() => {
    const map = {};
    for (const c of validationChecklist.allConflicts || []) {
      const empId = c.employeeId;
      const dt = c.workDate || c.date;
      if (!empId || !dt) continue;
      if (!map[empId]) map[empId] = {};
      if (!map[empId][dt]) map[empId][dt] = [];
      map[empId][dt].push(c);
    }
    return map;
  }, [validationChecklist.allConflicts]);

  const toggleSectorCollapse = (sectorId) => {
    setCollapsedSectorIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectorId)) next.delete(sectorId);
      else next.add(sectorId);
      return next;
    });
  };

  const expandAllSectors = () => setCollapsedSectorIds(new Set());
  const collapseAllSectors = () =>
    setCollapsedSectorIds(new Set((db.sectors || []).map((s) => s.id)));

  // Empilha snapshot para Desfazer / Refazer na sessão
  const pushUndoSnapshot = useCallback(
    (label) => {
      const snapshot = structuredClone(db.dailyEntriesByMonth[selectedYearMonth] || []);
      setUndoStack((prev) => [...prev.slice(-24), { label, yearMonth: selectedYearMonth, entries: snapshot }]);
      setRedoStack([]);
    },
    [db.dailyEntriesByMonth, selectedYearMonth]
  );

  const handleUndo = () => {
    if (isLockedPublished || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const currentSnapshot = structuredClone(db.dailyEntriesByMonth[last.yearMonth] || []);
    setRedoStack((prev) => [
      ...prev,
      { label: last.label, yearMonth: last.yearMonth, entries: currentSnapshot },
    ]);
    setUndoStack((prev) => prev.slice(0, -1));

    onMutateDb({
      permission: "EDIT_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: "DESFAZER_EDICAO_ESCALA",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${last.yearMonth}`,
      unitId: selectedUnitId,
      yearMonth: last.yearMonth,
      summary: `Desfeita ação na escala (${last.label}) em ${last.yearMonth}.`,
      updater: (draft) => {
        draft.dailyEntriesByMonth[last.yearMonth] = last.entries;
      },
    });
  };

  const handleRedo = () => {
    if (isLockedPublished || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const currentSnapshot = structuredClone(db.dailyEntriesByMonth[next.yearMonth] || []);
    setUndoStack((prev) => [
      ...prev,
      { label: next.label, yearMonth: next.yearMonth, entries: currentSnapshot },
    ]);
    setRedoStack((prev) => prev.slice(0, -1));

    onMutateDb({
      permission: "EDIT_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: "REFAZER_EDICAO_ESCALA",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${next.yearMonth}`,
      unitId: selectedUnitId,
      yearMonth: next.yearMonth,
      summary: `Refeita ação na escala (${next.label}) em ${next.yearMonth}.`,
      updater: (draft) => {
        draft.dailyEntriesByMonth[next.yearMonth] = next.entries;
      },
    });
  };

  // Gera ou Recalcula a escala do mês selecionado com Continuidade Histórica do mês anterior
  const handleGenerateMonthSchedule = (preserveManual = true) => {
    if (isLockedPublished) return;
    pushUndoSnapshot("Gerar Escala com Continuidade");

    onMutateDb({
      permission: "RECALCULATE_PROJECTIONS",
      module: "ESCALA_MENSAL",
      action: "GERAR_ESCALA_COM_CONTINUIDADE",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${selectedYearMonth}`,
      unitId: selectedUnitId,
      yearMonth: selectedYearMonth,
      summary: `Gerada/Recalculada escala de ${selectedYearMonth} (${selectedUnitId}) utilizando continuidade histórica de ${prevYearMonth} (${preserveManual ? "preservando edições manuais" : "recalculando integralmente"}).`,
      updater: (draft) => {
        const prevAll = draft.dailyEntriesByMonth[prevYearMonth] || [];
        const existingCur = draft.dailyEntriesByMonth[selectedYearMonth] || [];
        const otherUnitsEntries = existingCur.filter(
          (e) => e.unitId && e.unitId !== selectedUnitId
        );
        const newMonthList = [...otherUnitsEntries];

        draft.employees.forEach((emp, empIdx) => {
          const empPrev = prevAll.filter((e) => e.employeeId === emp.id);
          const empCurManualMap = {};
          existingCur
            .filter((e) => e.employeeId === emp.id && e.origin === "MANUAL_OVERRIDE")
            .forEach((e) => {
              empCurManualMap[e.workDate] = e;
            });

          const prevCycle = (draft.cycleStates || []).find(
            (cs) => cs.employeeId === emp.id && cs.yearMonth === prevYearMonth
          );

          const res = generateEmployeeScheduleForMonth({
            employee: emp,
            yearMonth: selectedYearMonth,
            allocations: draft.allocations,
            ruleAssignments: draft.ruleAssignments || [],
            rulesById,
            unavailabilityEvents: draft.unavailabilityEvents,
            marketCalendarByDate,
            previousMonthEntries: empPrev,
            previousCycleState: prevCycle || null,
            employeeRotationRank: empIdx,
            existingManualEntriesByDate: empCurManualMap,
            preserveManualOverrides: preserveManual,
          });

          newMonthList.push(...res.entries.filter((e) => !e.unitId || e.unitId === selectedUnitId));

          draft.cycleStates = (draft.cycleStates || []).filter(
            (cs) => !(cs.employeeId === emp.id && cs.yearMonth === selectedYearMonth)
          );
          draft.cycleStates.push({
            ...res.endCycleState,
            yearMonth: selectedYearMonth,
          });
        });

        draft.dailyEntriesByMonth[selectedYearMonth] = balanceSectorSundayLunchSlots({
          entries: newMonthList,
          allocations: draft.allocations,
          shiftsById,
          preserveManual,
        });

        const existingHeader = draft.monthlySchedules.find(
          (ms) => ms.unitId === selectedUnitId && ms.yearMonth === selectedYearMonth
        );
        if (existingHeader) {
          existingHeader.status = "DRAFT";
          existingHeader.impactWarning = null;
        } else {
          draft.monthlySchedules.push({
            id: `MS_${selectedUnitId}_${selectedYearMonth}`,
            unitId: selectedUnitId,
            yearMonth: selectedYearMonth,
            status: "DRAFT",
            versionNumber: 1,
            versionHistory: [],
            impactWarning: null,
          });
        }
      },
    });
    setImpactReport(null);
  };

  // Aplicação explícita de status ou faixa de almoço em uma célula (Popover ou Pincel — Seções 9 e 10)
  const applyCellModification = useCallback(
    ({
      emp,
      pos,
      isoDate,
      targetStatus = null,
      targetLunchSlot = undefined,
      restoreAuto = false,
      skipUndoSnapshot = false,
    }) => {
      if (isLockedPublished) return;
      const curEntry = entriesByEmpDate[emp.id]?.[isoDate];
      const curStatus = curEntry?.status || "T";
      if (["V", "LM", "INSS", "ADM", "DEM"].includes(curStatus)) return;

      const dow = getDayOfWeekISO(isoDate);
      const isSundayOrHoliday = dow === 0 || Boolean(marketCalendarByDate[isoDate]);

      if (
        isCellModificationNoOp({
          currentEntry: curEntry,
          targetStatus,
          targetLunchSlot,
          restoreAuto,
          isSundayOrHoliday,
        })
      ) {
        return;
      }

      if (!skipUndoSnapshot) {
        pushUndoSnapshot(`Edição ${emp.fullName} (${isoDate})`);
      }

      if (restoreAuto) {
        onMutateDb({
          permission: "EDIT_SCHEDULE",
          module: "ESCALA_MENSAL",
          action: "RESTAURAR_CELULA_AUTOMATICA",
          entityType: "DAILY_SCHEDULE_ENTRY",
          entityId: `${emp.id}_${isoDate}`,
          unitId: selectedUnitId,
          yearMonth: selectedYearMonth,
          summary: `Célula de ${emp.fullName} em ${isoDate} restaurada para o cálculo automático da regra.`,
          updater: (draft) => {
            const list = draft.dailyEntriesByMonth[selectedYearMonth] || [];
            const target = list.find((e) => e.employeeId === emp.id && e.workDate === isoDate);
            if (target) {
              target.origin = "AUTO_GENERATED";
            }
            const empIdx = draft.employees.findIndex((x) => x.id === emp.id);
            const empPrev = (draft.dailyEntriesByMonth[prevYearMonth] || []).filter(
              (e) => e.employeeId === emp.id
            );
            const empCurManualMap = {};
            list
              .filter(
                (e) =>
                  e.employeeId === emp.id &&
                  e.workDate !== isoDate &&
                  e.origin === "MANUAL_OVERRIDE"
              )
              .forEach((e) => {
                empCurManualMap[e.workDate] = e;
              });

            const res = generateEmployeeScheduleForMonth({
              employee: emp,
              yearMonth: selectedYearMonth,
              allocations: draft.allocations,
              ruleAssignments: draft.ruleAssignments || [],
              rulesById,
              unavailabilityEvents: draft.unavailabilityEvents,
              marketCalendarByDate,
              previousMonthEntries: empPrev,
              employeeRotationRank: Math.max(0, empIdx),
              existingManualEntriesByDate: empCurManualMap,
              preserveManualOverrides: true,
            });
            const autoForDay = res.entries.find((e) => e.workDate === isoDate);
            if (autoForDay && target) {
              Object.assign(target, autoForDay);
            }
          },
        });
        return;
      }

      const nextStatus = targetStatus !== null ? targetStatus : curStatus;
      let nextLunchSlot =
        targetLunchSlot !== undefined ? targetLunchSlot : curEntry?.lunchSlot || null;

      if (nextStatus !== "T" && nextStatus !== "MEIO_EXP") {
        nextLunchSlot = null;
      } else if (isSundayOrHoliday && !nextLunchSlot && targetLunchSlot === undefined) {
        nextLunchSlot = curEntry?.lunchSlot || "1";
      }

      onMutateDb({
        permission: "EDIT_SCHEDULE",
        module: "ESCALA_MENSAL",
        action: "EDICAO_DIRETA_CELULA",
        entityType: "DAILY_SCHEDULE_ENTRY",
        entityId: `${emp.id}_${isoDate}`,
        unitId: selectedUnitId,
        yearMonth: selectedYearMonth,
        beforeState: curEntry || null,
        afterState: { status: nextStatus, lunchSlot: nextLunchSlot },
        summary: `Edição em ${isoDate} (${emp.fullName}): Status ${curStatus} → ${nextStatus}${nextLunchSlot ? ` | Almoço N 0${nextLunchSlot}` : ""}.`,
        updater: (draft) => {
          if (!draft.dailyEntriesByMonth[selectedYearMonth]) {
            draft.dailyEntriesByMonth[selectedYearMonth] = [];
          }
          const list = draft.dailyEntriesByMonth[selectedYearMonth];
          const idx = list.findIndex((e) => e.employeeId === emp.id && e.workDate === isoDate);
          const updatedEntry = {
            employeeId: emp.id,
            workPositionId: pos.id,
            unitId: pos.unitId,
            sectorId: pos.sectorId,
            workDate: isoDate,
            status: nextStatus,
            origin: "MANUAL_OVERRIDE",
            lunchSlot: nextLunchSlot,
            ruleId: curEntry?.ruleId || pos.defaultRuleId,
          };

          if (idx >= 0) {
            list[idx] = updatedEntry;
          } else {
            list.push(updatedEntry);
          }

          // Verifica impacto em competência futura (Seção 14)
          const nextList = draft.dailyEntriesByMonth[nextYearMonth] || [];
          const empNextEntries = nextList.filter((e) => e.employeeId === emp.id);
          if (empNextEntries.length > 0) {
            const empUpdatedCur = list.filter((e) => e.employeeId === emp.id);
            const impact = detectFutureScheduleImpact({
              employee: emp,
              nextYearMonth,
              currentNextMonthEntries: empNextEntries,
              updatedCurrentMonthEntries: empUpdatedCur,
              allocations: draft.allocations,
              ruleAssignments: draft.ruleAssignments || [],
              rulesById,
              unavailabilityEvents: draft.unavailabilityEvents,
              marketCalendarByDate,
            });

            if (impact.isImpacted) {
              setImpactReport(impact);
              const nextHeader = draft.monthlySchedules.find(
                (ms) => ms.unitId === selectedUnitId && ms.yearMonth === nextYearMonth
              );
              if (nextHeader && nextHeader.status !== "PUBLISHED") {
                nextHeader.status = "IMPACTED_BY_PAST_CHANGE";
                nextHeader.impactWarning = `Edição manual de ${emp.fullName} em ${isoDate} impacta ${impact.differences.length} dia(s) em ${nextYearMonth}.`;
              }
            }
          }
        },
      });
    },
    [
      isLockedPublished,
      entriesByEmpDate,
      pushUndoSnapshot,
      marketCalendarByDate,
      onMutateDb,
      selectedUnitId,
      selectedYearMonth,
      prevYearMonth,
      nextYearMonth,
      rulesById,
    ]
  );

  // Clique em uma célula da grade: executa Pincel se ativo, ou abre Popover Contextual (Seções 9 e 10)
  const handleCellInteraction = (emp, pos, isoDate, ev, skipUndoSnapshot = false) => {
    if (!emp || isLockedPublished) return;
    const curEntry = entriesByEmpDate[emp.id]?.[isoDate];
    const curStatus = curEntry?.status || "T";
    if (["V", "LM", "INSS", "ADM", "DEM"].includes(curStatus)) return;

    if (activeBrush !== "NONE") {
      if (activeBrush === "AUTO_RESTORE") {
        applyCellModification({ emp, pos, isoDate, restoreAuto: true, skipUndoSnapshot });
      } else if (activeBrush.startsWith("LUNCH_")) {
        const slot = activeBrush.replace("LUNCH_", "");
        applyCellModification({
          emp,
          pos,
          isoDate,
          targetStatus: curStatus === "MEIO_EXP" ? "MEIO_EXP" : "T",
          targetLunchSlot: slot,
          skipUndoSnapshot,
        });
      } else {
        applyCellModification({ emp, pos, isoDate, targetStatus: activeBrush, skipUndoSnapshot });
      }
      return;
    }

    const rect = ev.currentTarget.getBoundingClientRect();
    setCellPopover({
      emp,
      pos,
      isoDate,
      top: Math.min(window.innerHeight - 360, rect.bottom + 6),
      left: Math.min(window.innerWidth - 320, Math.max(12, rect.left - 80)),
    });
  };

  // Fluxo "Construir Escala Manual" (Seção 11.1 — 3 opções)
  const handleExecuteManualBuild = (mode) => {
    if (isLockedPublished) return;
    pushUndoSnapshot(`Construir Escala Manual (${mode})`);

    onMutateDb({
      permission: "EDIT_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: `CONSTRUIR_ESCALA_MANUAL_${mode}`,
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${selectedYearMonth}`,
      unitId: selectedUnitId,
      yearMonth: selectedYearMonth,
      summary:
        mode === "EMPTY"
          ? `Iniciada escala manual vazia para ${selectedYearMonth} (${selectedUnitId}), preservando férias, afastamentos, admissões e feriados fechados.`
          : mode === "COPY"
            ? `Escala manual de ${selectedYearMonth} inicializada copiando padrão de ${manualCopySourceMonth}.`
            : `Escala automática de ${selectedYearMonth} convertida em rascunho manual editável.`,
      updater: (draft) => {
        const existingOtherUnits = (draft.dailyEntriesByMonth[selectedYearMonth] || []).filter(
          (e) => e.unitId && e.unitId !== selectedUnitId
        );
        const curUnitEntries = (draft.dailyEntriesByMonth[selectedYearMonth] || []).filter(
          (e) => !e.unitId || e.unitId === selectedUnitId
        );

        if (mode === "EMPTY") {
          const emptyEntries = [];
          for (const emp of draft.employees) {
            for (const isoDate of monthDates) {
              const alloc = getActiveAllocationOnDate(
                draft.allocations,
                emp.id,
                isoDate,
                selectedUnitId
              );
              if (!alloc) continue;

              // Preserva eventos obrigatórios (Admissão, Demissão, Férias/INSS, Mercado Fechado)
              const existing = curUnitEntries.find(
                (e) => e.employeeId === emp.id && e.workDate === isoDate
              );
              const marketDay = marketCalendarByDate[isoDate];
              let preservedStatus = null;
              if (emp.hireDate && isoDate < emp.hireDate) preservedStatus = "ADM";
              else if (
                (emp.terminationDate && isoDate > emp.terminationDate) ||
                (emp.noticePeriodEndDate && isoDate > emp.noticePeriodEndDate)
              ) {
                preservedStatus = "DEM";
              } else if (existing && ["V", "LM", "INSS"].includes(existing.status)) {
                preservedStatus = existing.status;
              } else if (marketDay?.openingMode === "CLOSED") {
                preservedStatus = "FECHADO";
              }

              emptyEntries.push({
                employeeId: emp.id,
                workPositionId: alloc.workPositionId,
                unitId: selectedUnitId,
                sectorId: alloc.sectorId,
                workDate: isoDate,
                status: preservedStatus || "EMPTY",
                origin: preservedStatus ? "AUTO_GENERATED" : "MANUAL_OVERRIDE",
                lunchSlot: null,
                ruleId: alloc.scheduleRuleId,
              });
            }
          }
          draft.dailyEntriesByMonth[selectedYearMonth] = [...existingOtherUnits, ...emptyEntries];
        } else if (mode === "COPY") {
          const sourceEntries = (draft.dailyEntriesByMonth[manualCopySourceMonth] || []).filter(
            (e) => !e.unitId || e.unitId === selectedUnitId
          );
          const copiedEntries = [];
          for (const emp of draft.employees) {
            for (let i = 0; i < monthDates.length; i++) {
              const isoDate = monthDates[i];
              const alloc = getActiveAllocationOnDate(
                draft.allocations,
                emp.id,
                isoDate,
                selectedUnitId
              );
              if (!alloc) continue;
              const dayStr = isoDate.slice(8, 10);
              const srcMatch = sourceEntries.find(
                (e) => e.employeeId === emp.id && e.workDate.endsWith(`-${dayStr}`)
              );
              copiedEntries.push({
                employeeId: emp.id,
                workPositionId: alloc.workPositionId,
                unitId: selectedUnitId,
                sectorId: alloc.sectorId,
                workDate: isoDate,
                status: srcMatch?.status || "T",
                origin: "MANUAL_OVERRIDE",
                lunchSlot: srcMatch?.lunchSlot || null,
                ruleId: alloc.scheduleRuleId,
              });
            }
          }
          draft.dailyEntriesByMonth[selectedYearMonth] = [...existingOtherUnits, ...copiedEntries];
        } else if (mode === "CONVERT_DRAFT") {
          const converted = curUnitEntries.map((e) => ({
            ...e,
            origin: ["V", "LM", "INSS", "ADM", "DEM"].includes(e.status)
              ? e.origin
              : "MANUAL_OVERRIDE",
          }));
          draft.dailyEntriesByMonth[selectedYearMonth] = [...existingOtherUnits, ...converted];
        }

        let ms = draft.monthlySchedules.find(
          (x) => x.unitId === selectedUnitId && x.yearMonth === selectedYearMonth
        );
        if (ms) {
          ms.status = "DRAFT";
        } else {
          draft.monthlySchedules.push({
            id: `MS_${selectedUnitId}_${selectedYearMonth}`,
            unitId: selectedUnitId,
            yearMonth: selectedYearMonth,
            status: "DRAFT",
            versionNumber: 1,
            versionHistory: [],
          });
        }
      },
    });

    setManualBuildModalOpen(false);
  };

  // Fluxo "Limpar Lançamentos do Mês" (Seção 11.2)
  const handleConfirmClearMonth = () => {
    if (isLockedPublished) return;
    pushUndoSnapshot(`Limpar Lançamentos de ${selectedYearMonth}`);

    const affectedCount = monthEntries.filter(
      (e) =>
        (!e.unitId || e.unitId === selectedUnitId) &&
        !["V", "LM", "INSS", "ADM", "DEM", "FECHADO"].includes(e.status)
    ).length;

    onMutateDb({
      permission: "EDIT_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: "LIMPAR_LANCAMENTOS_MES",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${selectedYearMonth}`,
      unitId: selectedUnitId,
      yearMonth: selectedYearMonth,
      summary: `Limpos ${affectedCount} lançamentos operacionais de ${selectedYearMonth} (${selectedUnitId}), preservando férias, afastamentos, admissões e feriados fechados.`,
      updater: (draft) => {
        const list = draft.dailyEntriesByMonth[selectedYearMonth] || [];
        draft.dailyEntriesByMonth[selectedYearMonth] = list.map((e) => {
          if (e.unitId && e.unitId !== selectedUnitId) return e;
          if (["V", "LM", "INSS", "ADM", "DEM", "FECHADO"].includes(e.status)) return e;
          return {
            ...e,
            status: "EMPTY",
            lunchSlot: null,
            origin: "MANUAL_OVERRIDE",
          };
        });
        const ms = draft.monthlySchedules.find(
          (x) => x.unitId === selectedUnitId && x.yearMonth === selectedYearMonth
        );
        if (ms) ms.status = "DRAFT";
      },
    });
    setClearMonthModalOpen(false);
  };

  // Propagar recálculo para o mês seguinte impactado preservando edições manuais (Seção 14)
  const handleApplyImpactRecalculation = () => {
    if (!impactReport) return;
    const emp = db.employees.find((e) => e.id === impactReport.employeeId);
    if (!emp) return;

    onMutateDb({
      permission: "RECALCULATE_PROJECTIONS",
      module: "ESCALA_MENSAL",
      action: "RECALCULAR_PERIODO_FUTURO_IMPACTADO",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${impactReport.nextYearMonth}`,
      unitId: selectedUnitId,
      yearMonth: impactReport.nextYearMonth,
      summary: `Recalculada escala futura de ${emp.fullName} em ${impactReport.nextYearMonth} após edição em ${selectedYearMonth}, preservando lançamentos manuais.`,
      updater: (draft) => {
        const curList = (draft.dailyEntriesByMonth[selectedYearMonth] || []).filter(
          (e) => e.employeeId === emp.id
        );
        const nextList = draft.dailyEntriesByMonth[impactReport.nextYearMonth] || [];
        const manualNextMap = {};
        nextList
          .filter((e) => e.employeeId === emp.id && e.origin === "MANUAL_OVERRIDE")
          .forEach((e) => {
            manualNextMap[e.workDate] = e;
          });

        const res = generateEmployeeScheduleForMonth({
          employee: emp,
          yearMonth: impactReport.nextYearMonth,
          allocations: draft.allocations,
          ruleAssignments: draft.ruleAssignments || [],
          rulesById,
          unavailabilityEvents: draft.unavailabilityEvents,
          marketCalendarByDate,
          previousMonthEntries: curList,
          preserveManualOverrides: true,
          existingManualEntriesByDate: manualNextMap,
        });

        draft.dailyEntriesByMonth[impactReport.nextYearMonth] = [
          ...nextList.filter((e) => e.employeeId !== emp.id),
          ...res.entries,
        ];
      },
    });
    setImpactReport(null);
  };

  // Validar ou Publicar escala mensal (Seção 12)
  const handleOpenValidationModal = () => {
    setValidationModalData(validationChecklist);
  };

  const handleConfirmLifecycleChange = (newStatus) => {
    if (!validationChecklist.canValidate) {
      setValidationModalData(validationChecklist);
      return;
    }

    onMutateDb({
      permission: "VALIDATE_PUBLISH_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: newStatus === "PUBLISHED" ? "PUBLICAR_ESCALA" : "VALIDAR_ESCALA",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${selectedYearMonth}`,
      unitId: selectedUnitId,
      yearMonth: selectedYearMonth,
      summary: `Escala mensal ${selectedYearMonth} (${selectedUnitId}) ${newStatus === "PUBLISHED" ? "PUBLICADA oficialmente" : "VALIDADA no checklist de 10 níveis"} (Versão #${currentMonthlySchedule.versionNumber || 1}).`,
      updater: (draft) => {
        let ms = draft.monthlySchedules.find(
          (x) => x.unitId === selectedUnitId && x.yearMonth === selectedYearMonth
        );
        if (!ms) {
          ms = {
            id: `MS_${selectedUnitId}_${selectedYearMonth}`,
            unitId: selectedUnitId,
            yearMonth: selectedYearMonth,
            status: newStatus,
            versionNumber: 1,
            versionHistory: [],
          };
          draft.monthlySchedules.push(ms);
        } else {
          ms.status = newStatus;
          ms.impactWarning = null;
        }
        if (newStatus === "VALIDATED") ms.validatedAt = new Date().toISOString();
        if (newStatus === "PUBLISHED") ms.publishedAt = new Date().toISOString();

        // Persiste o snapshot de cycleStates consolidado ao fim do mês
        draft.cycleStates = (draft.cycleStates || []).filter(
          (cs) => cs.yearMonth !== selectedYearMonth
        );
        draft.cycleStates.push(...validationChecklist.computedCycleStates);

        (draft.dailyEntriesByMonth[selectedYearMonth] || []).forEach((e) => {
          if (e.unitId === selectedUnitId && e.origin === "AUTO_GENERATED") {
            e.origin = newStatus;
          }
        });
      },
    });
    setValidationModalData(null);
  };

  // Reabrir Escala Publicada com Justificativa Obrigatória e Nova Versão (Seção 15)
  const handleConfirmReopenPublished = () => {
    try {
      const reopened = reopenPublishedSchedule({
        monthlySchedule: currentMonthlySchedule,
        reason: reopenReasonText,
        actorEmail: currentUserEmail,
        actorRole: currentUserRole,
      });

      onMutateDb({
        permission: "VALIDATE_PUBLISH_SCHEDULE",
        module: "ESCALA_MENSAL",
        action: "REABRIR_ESCALA_PUBLICADA",
        entityType: "MONTHLY_SCHEDULE",
        entityId: `${selectedUnitId}_${selectedYearMonth}`,
        unitId: selectedUnitId,
        yearMonth: selectedYearMonth,
        beforeState: {
          status: currentMonthlySchedule.status,
          versionNumber: currentMonthlySchedule.versionNumber || 1,
        },
        afterState: {
          status: reopened.status,
          versionNumber: reopened.versionNumber,
          reopenReason: reopened.reopenReason,
        },
        summary: `Escala publicada de ${selectedYearMonth} (${selectedUnitId}) REABERTA para Versão #${reopened.versionNumber}. Justificativa: "${reopened.reopenReason}".`,
        updater: (draft) => {
          const idx = draft.monthlySchedules.findIndex(
            (x) => x.unitId === selectedUnitId && x.yearMonth === selectedYearMonth
          );
          if (idx >= 0) {
            draft.monthlySchedules[idx] = reopened;
          }
        },
      });
      setReopenModalOpen(false);
      setReopenReasonText("");
    } catch (err) {
      window.alert(err.message);
    }
  };

  // Troca bilateral de folga entre dois colaboradores do mesmo setor
  const handleExecuteSwap = (candidateEmp, candidateRestDate) => {
    if (!swapTarget || isLockedPublished) return;
    const { emp: targetEmp, isoDate: targetRestDate } = swapTarget;

    const previewSwap = evaluateBilateralRestSwap({
      targetEmp,
      targetRestDate,
      candidateEmp,
      candidateRestDate,
      monthEntries,
      nextYearMonth,
      nextMonthEntries,
      allocations: db.allocations,
      ruleAssignments: db.ruleAssignments || [],
      rulesById,
      shiftsById,
      unavailabilityEvents: db.unavailabilityEvents,
      marketCalendarByDate,
    });

    if (
      previewSwap.hasShiftPeriodMismatch &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Atenção: ${targetEmp.fullName} (${previewSwap.targetShiftPeriod}) e ${candidateEmp.fullName} (${previewSwap.candidateShiftPeriod}) atuam em turnos distintos. Deseja confirmar a troca bilateral de folga mesmo assim?`
      )
    ) {
      return;
    }

    pushUndoSnapshot(`Troca ${targetEmp.fullName} ↔ ${candidateEmp.fullName}`);

    onMutateDb({
      permission: "EDIT_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: "TROCA_BILATERAL_FOLGA",
      entityType: "DAILY_SCHEDULE_ENTRY",
      entityId: `${targetEmp.id}_${candidateEmp.id}`,
      unitId: selectedUnitId,
      yearMonth: selectedYearMonth,
      summary: `Troca de folga realizada: ${targetEmp.fullName} cedeu folga do dia ${targetRestDate.slice(8, 10)} para ${candidateEmp.fullName} em troca do dia ${candidateRestDate.slice(8, 10)}.`,
      updater: (draft) => {
        const list = draft.dailyEntriesByMonth[selectedYearMonth] || [];
        const findEntry = (eId, dt) => list.find((x) => x.employeeId === eId && x.workDate === dt);

        const aRest = findEntry(targetEmp.id, targetRestDate);
        const aWork = findEntry(targetEmp.id, candidateRestDate);
        const bWork = findEntry(candidateEmp.id, targetRestDate);
        const bRest = findEntry(candidateEmp.id, candidateRestDate);

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

        const firstImpacted = previewSwap.impacts.find((imp) => imp.isImpacted);
        if (firstImpacted) {
          setImpactReport(firstImpacted);
          const nextHeader = draft.monthlySchedules.find(
            (ms) => ms.unitId === selectedUnitId && ms.yearMonth === nextYearMonth
          );
          if (nextHeader && nextHeader.status !== "PUBLISHED") {
            nextHeader.status = "IMPACTED_BY_PAST_CHANGE";
            nextHeader.impactWarning = `Troca bilateral entre ${targetEmp.fullName} e ${candidateEmp.fullName} impacta a projeção de ${nextYearMonth}.`;
          }
        }
      },
    });
    setSwapTarget(null);
  };

  const getNextMonthFirstRestLabel = (emp) => {
    if (!emp) return "—";
    const empIdx = db.employees.findIndex((x) => x.id === emp.id);
    const projectedDate = projectNextMonthFirstRestDate({
      employee: emp,
      nextYearMonth,
      nextMonthEntries,
      currentMonthEntries: monthEntries,
      allocations: db.allocations,
      ruleAssignments: db.ruleAssignments || [],
      rulesById,
      unavailabilityEvents: db.unavailabilityEvents,
      marketCalendarByDate,
      employeeRotationRank: Math.max(0, empIdx),
    });
    if (!projectedDate) return "—";
    return `FOLGA ${projectedDate.slice(8, 10)}/${projectedDate.slice(5, 7)}`;
  };

  // Agrupa postos e colaboradores por Setor na competência selecionada
  const sectorsToRender = useMemo(() => {
    return db.sectors
      .filter((sec) => !filterSectorId || sec.id === filterSectorId)
      .map((sec) => {
        const positionsInSector = db.workPositions
          .filter(
            (p) =>
              p.unitId === selectedUnitId &&
              p.sectorId === sec.id &&
              p.status !== "DEACTIVATED"
          )
          .map((pos) => {
            const alloc = db.allocations.find(
              (a) =>
                a.workPositionId === pos.id &&
                a.startDate <= `${selectedYearMonth}-31` &&
                (!a.endDate || a.endDate >= `${selectedYearMonth}-01`)
            );
            const emp = alloc ? db.employees.find((e) => e.id === alloc.employeeId) : null;
            const shift = shiftsById[alloc?.workShiftId || pos.defaultShiftId];
            const rule = rulesById[alloc?.scheduleRuleId || pos.defaultRuleId];
            const empEntries = emp
              ? monthEntries.filter((e) => e.employeeId === emp.id)
              : [];
            const workloadSummary = emp
              ? calculateEmployeeMonthlyWorkload({
                  employeeEntries: empEntries,
                  allocations: db.allocations,
                  shiftsById,
                  marketCalendarByDate,
                })
              : null;

            return { pos, emp, alloc, shift, rule, workloadSummary, empEntries };
          })
          .filter((row) => {
            if (!showVacantPositions && !row.emp) return false;
            if (filterShiftPeriod && row.shift?.shiftPeriod !== filterShiftPeriod) return false;
            if (filterStatus) {
              if (!row.emp) return false;
              const hasTargetStatus = row.empEntries.some((e) => e.status === filterStatus);
              if (!hasTargetStatus) return false;
            }
            if (searchEmp.trim()) {
              const q = searchEmp.toLowerCase();
              const matchEmp = row.emp?.fullName.toLowerCase().includes(q);
              const matchPos = row.pos.title.toLowerCase().includes(q);
              return matchEmp || matchPos;
            }
            return true;
          });

        return {
          sector: sec,
          rows: positionsInSector,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [
    db.sectors,
    db.workPositions,
    db.allocations,
    db.employees,
    filterSectorId,
    selectedUnitId,
    selectedYearMonth,
    shiftsById,
    rulesById,
    monthEntries,
    marketCalendarByDate,
    showVacantPositions,
    filterShiftPeriod,
    filterStatus,
    searchEmp,
  ]);

  const dayColWidth = viewDensity === "detailed" ? 44 : 34;

  const activeAdvancedFilterCount = [
    filterShiftPeriod,
    filterStatus,
    !showPrevMonthTail ? "no_tail" : "",
    !showVacantPositions ? "no_vacant" : "",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterSectorId("");
    setSearchEmp("");
    setFilterShiftPeriod("");
    setFilterStatus("");
    setShowPrevMonthTail(true);
    setShowVacantPositions(true);
  };

  const handleExportCsv = () => {
    const headerCols = [
      "Posto",
      "Setor",
      "Funcao_Posto",
      "Colaborador",
      "Regra",
      "Turno",
      ...monthDates.map((d) => d.slice(8, 10)),
      "Projecao_Prox_Mes",
    ];
    const csvLines = [headerCols.join(";")];
    for (const { sector, rows } of sectorsToRender) {
      for (const { pos, emp, shift, rule } of rows) {
        const dayVals = monthDates.map((d) => {
          if (!emp) return "";
          const en = entriesByEmpDate[emp.id]?.[d];
          const st = en?.status || "T";
          return en?.lunchSlot && (st === "T" || st === "MEIO_EXP")
            ? `${st}(N0${en.lunchSlot})`
            : st;
        });
        const rowVals = [
          pos.isSharedRateio ? "RATEIO" : pos.code,
          sector.name,
          pos.title,
          emp ? emp.fullName : `VAGA (${pos.status})`,
          rule?.code || "",
          shift ? `${shift.entryTime}-${shift.effectiveExitTime}` : "",
          ...dayVals,
          emp ? getNextMonthFirstRestLabel(emp) : "",
        ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
        csvLines.push(rowVals.join(";"));
      }
    }
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-${selectedUnitId.toLowerCase()}-${selectedYearMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleRebalanceSundayLunch = () => {
    if (isLockedPublished) return;
    pushUndoSnapshot("Balancear Almoços de Domingo/Feriado");
    onMutateDb({
      permission: "EDIT_SCHEDULE",
      module: "ESCALA_MENSAL",
      action: "BALANCEAR_ALMOCOS_DOMINGO",
      entityType: "MONTHLY_SCHEDULE",
      entityId: `${selectedUnitId}_${selectedYearMonth}`,
      unitId: selectedUnitId,
      yearMonth: selectedYearMonth,
      summary: `Redistribuídas faixas de almoço (1..4) por setor e turno em ${selectedYearMonth} (${selectedUnitId}).`,
      updater: (draft) => {
        const cur = draft.dailyEntriesByMonth[selectedYearMonth] || [];
        draft.dailyEntriesByMonth[selectedYearMonth] = balanceSectorSundayLunchSlots({
          entries: cur,
          allocations: draft.allocations,
          shiftsById,
          preserveManual: true,
        });
      },
    });
  };

  const handleGridCellKeyDown = (ev, emp, pos, isoDate) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      handleCellInteraction(emp, pos, isoDate, ev, false);
      return;
    }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(ev.key)) return;
    ev.preventDefault();
    const td = ev.currentTarget;
    const tr = td.parentElement;
    if (!tr) return;
    const colIndex = Array.from(tr.children).indexOf(td);
    let targetCell = null;
    if (ev.key === "ArrowRight") targetCell = td.nextElementSibling;
    else if (ev.key === "ArrowLeft") targetCell = td.previousElementSibling;
    else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      let siblingRow = ev.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling;
      while (siblingRow && siblingRow.dataset.sectorHeader === "true") {
        siblingRow =
          ev.key === "ArrowDown"
            ? siblingRow.nextElementSibling
            : siblingRow.previousElementSibling;
      }
      if (siblingRow && siblingRow.children[colIndex]) {
        targetCell = siblingRow.children[colIndex];
      }
    }
    if (targetCell && typeof targetCell.focus === "function" && targetCell.tabIndex >= 0) {
      targetCell.focus();
    }
  };

  const activeUnitObj = (db.units || []).find((u) => u.id === selectedUnitId);
  const totalDayCols = (showPrevMonthTail ? prevTailDates.length : 0) + monthDates.length;

  return (
    <div
      style={
        isExpandedFullscreen
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 1800,
              background: "var(--erp-bg-canvas)",
              padding: "12px 16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }
          : { display: "flex", flexDirection: "column", gap: 10 }
      }
      onMouseUp={() => setIsMousePainting(false)}
    >
      {/* 1. CABEÇALHO OPERACIONAL COMPACTO */}
      <div
        className="erp-surface no-print"
        style={{
          padding: "10px 14px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontSize: "var(--erp-text-lg)", color: "var(--erp-ink)" }}>
            Escala mensal · {selectedYearMonth}
          </strong>
          <Badge tone="neutral">{activeUnitObj?.name || selectedUnitId}</Badge>
          <ScheduleStatusPill
            status={currentMonthlySchedule.status}
            version={currentMonthlySchedule.versionNumber || 1}
          />
          <button
            type="button"
            onClick={handleOpenValidationModal}
            className={`erp-badge ${
              validationChecklist.blockingErrors.length > 0
                ? "erp-badge--danger"
                : validationChecklist.operationalWarnings.length > 0
                  ? "erp-badge--warning"
                  : "erp-badge--success"
            }`}
            style={{ cursor: "pointer" }}
            title="Abrir diagnóstico completo de validação em 10 níveis"
          >
            {validationChecklist.blockingErrors.length} erros ·{" "}
            {validationChecklist.operationalWarnings.length} alertas
          </button>
          {syncStatus === "saving" && (
            <Badge tone="warning" dot>
              Gravando alterações...
            </Badge>
          )}
          {undoStack.length > 0 && syncStatus !== "saving" && (
            <span style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>
              {undoStack.length} ajuste(s) na sessão
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLockedPublished ? (
            <Button
              variant="secondary"
              size="sm"
              icon="unlock"
              onClick={() => setReopenModalOpen(true)}
            >
              Reabrir escala (nova versão)
            </Button>
          ) : currentMonthlySchedule.status === "VALIDATED" ||
            validationChecklist.blockingErrors.length === 0 ? (
            <Button
              variant="primary"
              size="sm"
              icon="check"
              onClick={() => handleConfirmLifecycleChange("PUBLISHED")}
            >
              Publicar escala oficial
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon="shield"
              onClick={handleOpenValidationModal}
            >
              Revisar pendências ({validationChecklist.blockingErrors.length})
            </Button>
          )}

          <Button
            variant="tertiary"
            size="sm"
            icon={isExpandedFullscreen ? "minimize" : "maximize"}
            onClick={() => setIsExpandedFullscreen((v) => !v)}
            title={isExpandedFullscreen ? "Sair da tela ampliada" : "Ampliar área da grade"}
          >
            {isExpandedFullscreen ? "Reduzir" : "Ampliar"}
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS + FERRAMENTAS ORGANIZADAS POR FINALIDADE */}
      <div
        className="erp-surface no-print"
        style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <input
              type="month"
              aria-label="Competência"
              value={selectedYearMonth}
              onChange={(e) => e.target.value && setSelectedYearMonth(e.target.value)}
              className="erp-input erp-input--sm"
              style={{ width: 142 }}
            />
            <select
              aria-label="Filtrar por setor"
              value={filterSectorId}
              onChange={(e) => setFilterSectorId(e.target.value)}
              className="erp-select erp-select--sm"
              style={{ width: 195 }}
            >
              <option value="">Todos os setores</option>
              {db.sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <SearchInput
              size="sm"
              value={searchEmp}
              onChange={setSearchEmp}
              onClear={() => setSearchEmp("")}
              placeholder="Colaborador ou posto..."
              style={{ width: 195 }}
            />
            <Button
              variant="secondary"
              size="sm"
              icon="filter"
              onClick={() => setAdvancedFiltersOpen((v) => !v)}
            >
              Filtros{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ""}
            </Button>
            {(filterSectorId || searchEmp || activeAdvancedFilterCount > 0) && (
              <Button variant="tertiary" size="sm" icon="x" onClick={clearAllFilters}>
                Limpar
              </Button>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <PopoverMenu
              trigger={({ toggle }) => (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  iconRight="chevronDown"
                  disabled={isLockedPublished}
                  onClick={toggle}
                >
                  Planejamento
                </Button>
              )}
              items={[
                {
                  id: "gen_cont",
                  icon: "refresh",
                  label: `Gerar com continuidade (${prevYearMonth})`,
                  onClick: () => handleGenerateMonthSchedule(true),
                },
                {
                  id: "lunch_bal",
                  icon: "clock",
                  label: "Balancear intervalos de domingo",
                  onClick: handleRebalanceSundayLunch,
                },
                {
                  id: "manual_build",
                  icon: "sliders",
                  label: "Construir escala manual...",
                  onClick: () => setManualBuildModalOpen(true),
                },
              ]}
            />

            <Button
              variant={brushModeActive ? "primary" : "secondary"}
              size="sm"
              icon="brush"
              disabled={isLockedPublished}
              onClick={() => {
                setBrushModeActive((prev) => {
                  const next = !prev;
                  setActiveBrush(next ? "F" : "NONE");
                  return next;
                });
              }}
            >
              {brushModeActive ? "Pincel ativo" : "Modo pincel"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon="undo"
              disabled={isLockedPublished || undoStack.length === 0}
              onClick={handleUndo}
              title={
                undoStack.length
                  ? `Desfazer: ${undoStack[undoStack.length - 1].label}`
                  : "Nada para desfazer"
              }
            />
            <Button
              variant="secondary"
              size="sm"
              icon="redo"
              disabled={isLockedPublished || redoStack.length === 0}
              onClick={handleRedo}
              title="Refazer última edição"
            />

            <Button
              variant="secondary"
              size="sm"
              icon="shield"
              onClick={handleOpenValidationModal}
            >
              Validação
            </Button>

            <PopoverMenu
              trigger={({ toggle }) => (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="eye"
                  iconRight="chevronDown"
                  onClick={toggle}
                >
                  Exibição
                </Button>
              )}
              items={[
                {
                  id: "density",
                  icon: "layers",
                  label:
                    viewDensity === "compact"
                      ? "Alternar para modo detalhado (+Horas)"
                      : "Alternar para modo compacto",
                  onClick: () =>
                    setViewDensity((d) => (d === "compact" ? "detailed" : "compact")),
                },
                {
                  id: "expand_all",
                  icon: "chevronDown",
                  label: "Expandir todos os setores",
                  onClick: expandAllSectors,
                },
                {
                  id: "collapse_all",
                  icon: "chevronRight",
                  label: "Recolher todos os setores",
                  onClick: collapseAllSectors,
                },
                { separator: true },
                {
                  id: "legend",
                  icon: "info",
                  label: legendOpen ? "Ocultar legenda de siglas" : "Exibir legenda de siglas",
                  onClick: () => setLegendOpen((v) => !v),
                },
              ]}
            />

            <PopoverMenu
              trigger={({ toggle }) => (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="printer"
                  iconRight="chevronDown"
                  onClick={toggle}
                >
                  Documentos
                </Button>
              )}
              items={[
                {
                  id: "print_preview",
                  icon: "printer",
                  label: "Imprimir / Visualizar escala (A4 Paisagem)",
                  onClick: () => setPrintPreviewOpen(true),
                },
                {
                  id: "export_pdf_direct",
                  icon: "fileText",
                  label: "Salvar em PDF (Escala completa A4)",
                  onClick: () => {
                    const doc = buildSchedulePrintDocument({
                      db,
                      unitId: selectedUnitId,
                      yearMonth: selectedYearMonth,
                      sectorScope: "ALL",
                      includeJourneyDetails: false,
                    });
                    downloadSchedulePdf(doc);
                  },
                },
                { separator: true },
                {
                  id: "export_csv",
                  icon: "download",
                  label: "Exportar competência (CSV)",
                  onClick: handleExportCsv,
                },
                ...(isLockedPublished
                  ? [
                      { separator: true },
                      {
                        id: "reopen",
                        icon: "unlock",
                        label: "Reabrir escala publicada...",
                        onClick: () => setReopenModalOpen(true),
                      },
                    ]
                  : []),
              ]}
            />

            {!isLockedPublished && (
              <PopoverMenu
                trigger={({ toggle }) => (
                  <Button
                    variant="tertiary"
                    size="sm"
                    icon="more"
                    onClick={toggle}
                    title="Ações avançadas"
                  />
                )}
                items={[
                  {
                    id: "regen_overwrite",
                    icon: "refresh",
                    label: "Recalcular descartando ajustes manuais",
                    danger: true,
                    onClick: () => {
                      if (
                        window.confirm(
                          "Recalcular integralmente a competência substituindo todas as edições manuais?"
                        )
                      ) {
                        handleGenerateMonthSchedule(false);
                      }
                    },
                  },
                  { separator: true },
                  {
                    id: "clear_month",
                    icon: "trash",
                    label: "Limpar lançamentos da competência...",
                    danger: true,
                    onClick: () => setClearMonthModalOpen(true),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {advancedFiltersOpen && (
          <div
            style={{
              paddingTop: 8,
              borderTop: "1px solid var(--erp-border)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 14,
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, color: "var(--erp-ink-secondary)" }}>Turno:</span>
              <select
                value={filterShiftPeriod}
                onChange={(e) => setFilterShiftPeriod(e.target.value)}
                className="erp-select erp-select--sm"
              >
                <option value="">Todos</option>
                <option value="MANHÃ">Manhã</option>
                <option value="TARDE">Tarde</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, color: "var(--erp-ink-secondary)" }}>Ocorrência:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="erp-select erp-select--sm"
              >
                <option value="">Todas</option>
                <option value="F">Com folga normal (F)</option>
                <option value="A">Com folga adicional (A)</option>
                <option value="V">Em férias (FÉR)</option>
                <option value="INSS">Afastamento INSS / LM</option>
                <option value="EMPTY">Com células vazias (—)</option>
              </select>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPrevMonthTail}
                onChange={(e) => setShowPrevMonthTail(e.target.checked)}
              />
              Exibir transição ({prevYearMonth})
            </label>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showVacantPositions}
                onChange={(e) => setShowVacantPositions(e.target.checked)}
              />
              Exibir postos vagos / congelados
            </label>
          </div>
        )}

        {brushModeActive && !isLockedPublished && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              background: "var(--erp-surface-subtle)",
              border: "1px solid var(--erp-brand-blue-border)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-brand-blue)" }}>
                Pincel selecionado:
              </span>
              {BRUSH_TOOLS.map((tool) => {
                const isSelected = activeBrush === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveBrush(tool.id)}
                    className={`erp-btn erp-btn--sm ${
                      isSelected ? "erp-btn--primary" : "erp-btn--secondary"
                    }`}
                  >
                    {tool.label}
                  </button>
                );
              })}
            </div>
            <Button
              variant="tertiary"
              size="sm"
              icon="x"
              onClick={() => {
                setBrushModeActive(false);
                setActiveBrush("NONE");
              }}
            >
              Sair do pincel
            </Button>
          </div>
        )}

        {legendOpen && (
          <div
            style={{
              paddingTop: 8,
              borderTop: "1px solid var(--erp-border)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              fontSize: 12,
            }}
          >
            <LegendItem bg="#ffffff" color="#15803d" text="T · Trabalhando" />
            <LegendItem bg="#2B5690" color="#ffffff" text="F · Folga normal" />
            <LegendItem bg="#5B21B6" color="#ffffff" text="A · Folga adicional" />
            <LegendItem bg="#fef3c7" color="#92400e" text="1/2 · Meio expediente" />
            <LegendItem bg="#fee2e2" color="#991b1b" text="FECH · Mercado fechado" />
            <LegendItem bg="#B91C1C" color="#ffffff" text="FÉR / LM / INSS" />
            <span style={{ color: "var(--erp-ink-muted)" }}>
              Faixas de almoço (Dom/Feriado): <strong>1</strong> (09–10h) ·{" "}
              <strong>2</strong> (10–11h) · <strong>3</strong> (11–12h) ·{" "}
              <strong>4</strong> (12–13h)
            </span>
          </div>
        )}
      </div>

      {impactReport && (
        <div
          className="erp-alert erp-alert--warning no-print"
          style={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>
              Impacto temporal detectado em {impactReport.nextYearMonth}
            </div>
            <div style={{ fontSize: 12 }}>
              O ajuste de <strong>{impactReport.employeeName}</strong> em {selectedYearMonth} altera{" "}
              <strong>{impactReport.differences.length} dia(s)</strong> na competência seguinte (
              {impactReport.differences
                .slice(0, 4)
                .map(
                  (d) =>
                    `${d.workDate.slice(8, 10)}/${d.workDate.slice(5, 7)}: ${d.previousStatus}→${d.newProjectedStatus}`
                )
                .join(", ")}
              ).
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" onClick={handleApplyImpactRecalculation}>
              Recalcular {impactReport.nextYearMonth}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImpactReport(null)}>
              Manter como está
            </Button>
          </div>
        </div>
      )}

      {/* 3. GRADE CENTRAL DE ESCALAS — PRIORIDADE MÁXIMA DE ESPAÇO */}
      <div
        className="erp-surface"
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "var(--erp-surface-subtle)",
            borderBottom: "1px solid var(--erp-border)",
            padding: "6px 12px",
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UniaoLogo variant="original" size="sm" idSuffix="grid_hdr" />
            <span style={{ fontWeight: 600, color: "var(--erp-ink-secondary)" }}>
              {db.companies[0]?.legalName} · CNPJ {db.companies[0]?.cnpj}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="no-print" style={{ display: "inline-flex", gap: 6 }}>
              <button
                type="button"
                onClick={expandAllSectors}
                className="erp-btn erp-btn--tertiary erp-btn--sm"
              >
                Expandir todos
              </button>
              <button
                type="button"
                onClick={collapseAllSectors}
                className="erp-btn erp-btn--tertiary erp-btn--sm"
              >
                Recolher todos
              </button>
            </span>
            <strong style={{ color: "var(--erp-ink)" }}>
              {activeUnitObj?.name || selectedUnitId} · {selectedYearMonth} · v
              {currentMonthlySchedule.versionNumber || 1}
            </strong>
          </div>
        </div>

        <div
          style={{
            overflow: "auto",
            maxWidth: "100%",
            maxHeight: isExpandedFullscreen ? "calc(100vh - 160px)" : "calc(100vh - 250px)",
            position: "relative",
          }}
        >
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: viewDensity === "detailed" ? 12 : 11.5,
              minWidth: "max-content",
              width: "100%",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    ...ui.thSticky,
                    top: 0,
                    left: 0,
                    zIndex: 30,
                    width: 52,
                    minWidth: 52,
                    background: "#1B3963",
                    color: "#FFFFFF",
                  }}
                >
                  Posto
                </th>
                <th
                  style={{
                    ...ui.thSticky,
                    top: 0,
                    left: 52,
                    zIndex: 30,
                    width: 158,
                    minWidth: 158,
                    textAlign: "left",
                    background: "#1B3963",
                    color: "#FFFFFF",
                  }}
                >
                  Função / Cargo
                </th>
                <th
                  style={{
                    ...ui.thSticky,
                    top: 0,
                    left: 210,
                    zIndex: 30,
                    width: 170,
                    minWidth: 170,
                    textAlign: "left",
                    background: "#1B3963",
                    color: "#FFFFFF",
                  }}
                >
                  Colaborador / Vaga
                </th>
                <th
                  style={{
                    ...ui.thSticky,
                    top: 0,
                    left: 380,
                    zIndex: 30,
                    width: viewDensity === "detailed" ? 148 : 118,
                    minWidth: viewDensity === "detailed" ? 148 : 118,
                    background: "#1B3963",
                    color: "#FFFFFF",
                    borderRight: "2px solid #2B5690",
                  }}
                >
                  Jornada · Regra
                </th>

                {showPrevMonthTail &&
                  prevTailDates.map((d, idx) => {
                    const dow = getDayOfWeekISO(d);
                    const isLastTail = idx === prevTailDates.length - 1;
                    return (
                      <th
                        key={d}
                        style={{
                          ...ui.thGrid,
                          position: "sticky",
                          top: 0,
                          zIndex: 20,
                          width: dayColWidth,
                          minWidth: dayColWidth,
                          background: "#E2E8F0",
                          color: "#475569",
                          borderRight: isLastTail ? "2px solid #2B5690" : "1px solid #CBD5E1",
                        }}
                        title={`Transição competência anterior: ${d}`}
                      >
                        <div style={{ fontSize: 10 }}>{DIAS_SEMANA_CURTO[dow]}</div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{Number(d.slice(8, 10))}</div>
                      </th>
                    );
                  })}

                {monthDates.map((d) => {
                  const dow = getDayOfWeekISO(d);
                  const mDay = marketCalendarByDate[d];
                  const isSunday = dow === 0;
                  const isSaturday = dow === 6;
                  const bgHeader =
                    mDay?.openingMode === "CLOSED"
                      ? "#FEE2E2"
                      : mDay?.openingMode === "HALF_DAY"
                        ? "#FEF3C7"
                        : mDay || isSunday
                          ? "#DBEAFE"
                          : isSaturday
                            ? "#EEF2F6"
                            : "#F8FAFC";
                  const colorHeader =
                    mDay?.openingMode === "CLOSED"
                      ? "#991B1B"
                      : mDay?.openingMode === "HALF_DAY"
                        ? "#92400E"
                        : mDay || isSunday
                          ? "#1E3A8A"
                          : "#1E293B";

                  return (
                    <th
                      key={d}
                      style={{
                        ...ui.thGrid,
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                        width: dayColWidth,
                        minWidth: dayColWidth,
                        background: bgHeader,
                        color: colorHeader,
                      }}
                      title={
                        mDay
                          ? `${mDay.description} (${mDay.openingMode})`
                          : `${DIAS_SEMANA_CURTO[dow]}, ${d}`
                      }
                    >
                      <div style={{ fontSize: 10, fontWeight: 600 }}>{DIAS_SEMANA_CURTO[dow]}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700 }}>{Number(d.slice(8, 10))}</div>
                    </th>
                  );
                })}

                <th
                  style={{
                    ...ui.thGrid,
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                    width: 98,
                    minWidth: 98,
                    background: "#1B3963",
                    color: "#FFFFFF",
                  }}
                >
                  Próx. folga
                </th>
              </tr>
            </thead>

            <tbody>
              {sectorsToRender.map(({ sector, rows }) => {
                const isCollapsed = collapsedSectorIds.has(sector.id);
                const filledCount = rows.filter((r) => Boolean(r.emp)).length;
                const sectorErrors = rows.reduce((acc, r) => {
                  if (!r.emp) return acc;
                  const empMap = conflictsByEmpDate[r.emp.id] || {};
                  return acc + Object.values(empMap).flat().length;
                }, 0);

                return (
                  <Fragment key={sector.id}>
                    <tr data-sector-header="true">
                      <td
                        colSpan={4}
                        onClick={() => toggleSectorCollapse(sector.id)}
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 14,
                          padding: "6px 10px",
                          background: "#EEF2F7",
                          borderBottom: "1px solid #CBD5E1",
                          borderRight: "2px solid #2B5690",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                          color: "#0F1E36",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Icon name={isCollapsed ? "chevronRight" : "chevronDown"} size={14} />
                            <span>{sector.name}</span>
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            <span>
                              {filledCount}/{rows.length} ocupados
                            </span>
                            {sectorErrors > 0 && (
                              <span
                                style={{
                                  background: "#FEE2E2",
                                  color: "#B91C1C",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  fontWeight: 700,
                                }}
                              >
                                {sectorErrors} alerta(s)
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td
                        colSpan={totalDayCols + 1}
                        onClick={() => toggleSectorCollapse(sector.id)}
                        style={{
                          background: "#F4F7FA",
                          borderBottom: "1px solid #CBD5E1",
                          cursor: "pointer",
                          padding: "4px 10px",
                          fontSize: 11,
                          color: "#64748B",
                        }}
                      >
                        {isCollapsed
                          ? `Setor recolhido (${rows.length} postos) — clique para expandir`
                          : `Cobertura mínima diária: ${sector.minDailyCoverage || 1} colaborador(es)`}
                      </td>
                    </tr>

                    {!isCollapsed &&
                      rows.map(({ pos, emp, shift, rule, workloadSummary }) => {
                        const isVacant = !emp;
                        const posMeta =
                          STATUS_VAGA_META[pos.status] || STATUS_VAGA_META.OPEN_UNPLANNED;
                        const stickyRowBg = isVacant ? "#F8FAFC" : "#FFFFFF";

                        return (
                          <tr key={pos.id} style={{ background: stickyRowBg }}>
                            <td
                              style={{
                                ...ui.tdSticky,
                                left: 0,
                                width: 52,
                                minWidth: 52,
                                background: stickyRowBg,
                                textAlign: "center",
                                fontWeight: 700,
                                fontSize: 11,
                                color: pos.isSharedRateio ? "#6D28D9" : "#1E293B",
                              }}
                            >
                              {pos.isSharedRateio ? "RAT" : pos.code}
                            </td>

                            <td
                              style={{
                                ...ui.tdSticky,
                                left: 52,
                                width: 158,
                                minWidth: 158,
                                background: stickyRowBg,
                                color: "#334155",
                                fontWeight: 500,
                                fontSize: 11.5,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={pos.notes || pos.title}
                            >
                              {pos.title}
                            </td>

                            <td
                              style={{
                                ...ui.tdSticky,
                                left: 210,
                                width: 170,
                                minWidth: 170,
                                background: isVacant ? posMeta.bg : "#FFFFFF",
                                color: isVacant ? posMeta.cor : "#0F1E36",
                                fontWeight: 600,
                                fontSize: 12,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={pos.notes || emp?.fullName || posMeta.label}
                            >
                              {emp ? emp.fullName : `VAGA (${posMeta.label})`}
                            </td>

                            <td
                              style={{
                                ...ui.tdSticky,
                                left: 380,
                                width: viewDensity === "detailed" ? 148 : 118,
                                minWidth: viewDensity === "detailed" ? 148 : 118,
                                background: stickyRowBg,
                                textAlign: "center",
                                fontSize: 11,
                                borderRight: "2px solid #2B5690",
                              }}
                            >
                              <div style={{ fontWeight: 700, color: "#2B5690" }}>
                                {rule?.code || "—"} ·{" "}
                                <span style={{ color: "#475569", fontWeight: 500 }}>
                                  {shift ? `${shift.entryTime}-${shift.effectiveExitTime}` : "—"}
                                </span>
                              </div>
                              {viewDensity === "detailed" && workloadSummary && (
                                <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 1 }}>
                                  {workloadSummary.workedDaysCount}d ·{" "}
                                  <strong>{workloadSummary.totalEffectiveFormatted}h</strong>
                                </div>
                              )}
                            </td>

                            {showPrevMonthTail &&
                              prevTailDates.map((d, idx) => {
                                const isLastTail = idx === prevTailDates.length - 1;
                                if (isVacant) {
                                  return (
                                    <td
                                      key={d}
                                      style={{
                                        ...ui.tdGrid,
                                        background: "#F1F5F9",
                                        borderRight: isLastTail
                                          ? "2px solid #2B5690"
                                          : "1px solid #E2E8F0",
                                      }}
                                    />
                                  );
                                }
                                const prevEntry = entriesByEmpDate[emp.id]?.[d];
                                const st = prevEntry?.status || "T";
                                return (
                                  <td
                                    key={d}
                                    style={{
                                      ...ui.tdGrid,
                                      textAlign: "center",
                                      background:
                                        st === "F"
                                          ? "#DBEAFE"
                                          : st === "V"
                                            ? "#FEE2E2"
                                            : "#F8FAFC",
                                      color:
                                        st === "F"
                                          ? "#1E40AF"
                                          : st === "V"
                                            ? "#991B1B"
                                            : "#64748B",
                                      fontSize: 10.5,
                                      fontWeight: 600,
                                      borderRight: isLastTail
                                        ? "2px solid #2B5690"
                                        : "1px solid #E2E8F0",
                                    }}
                                    title={`Competência anterior (${d}): ${st}`}
                                  >
                                    {st === "F" ? "F" : st === "V" ? "FÉR" : prevEntry?.lunchSlot || "T"}
                                  </td>
                                );
                              })}

                            {monthDates.map((d) => {
                              if (isVacant) {
                                return <td key={d} style={{ ...ui.tdGrid, background: "#F1F5F9" }} />;
                              }

                              const entry = entriesByEmpDate[emp.id]?.[d];
                              const st = entry?.status || "T";
                              const dow = getDayOfWeekISO(d);
                              const mDay = marketCalendarByDate[d];
                              const isSunOrHoliday = dow === 0 || Boolean(mDay);
                              const isManual = entry?.origin === "MANUAL_OVERRIDE";
                              const cellConflicts = conflictsByEmpDate[emp.id]?.[d] || [];
                              const hasBlockingErr = cellConflicts.some(
                                (c) => c.severity === "ERROR" || c.blocking
                              );

                              let cellBg = isSunOrHoliday ? "#F8FAFC" : "#FFFFFF";
                              let cellColor = "#15803D";
                              let mainBadge = viewDensity === "detailed" ? "T" : "";

                              if (st === "F") {
                                cellBg = "#2B5690";
                                cellColor = "#FFFFFF";
                                mainBadge = "F";
                              } else if (st === "A") {
                                cellBg = "#5B21B6";
                                cellColor = "#FFFFFF";
                                mainBadge = "A";
                              } else if (st === "FECHADO") {
                                cellBg = "#FEE2E2";
                                cellColor = "#991B1B";
                                mainBadge = "FECH";
                              } else if (st === "MEIO_EXP") {
                                cellBg = "#FEF3C7";
                                cellColor = "#92400E";
                                mainBadge = "1/2";
                              } else if (st === "V") {
                                cellBg = "#B91C1C";
                                cellColor = "#FFFFFF";
                                mainBadge = "FÉR";
                              } else if (st === "LM" || st === "INSS") {
                                cellBg = "#6D28D9";
                                cellColor = "#FFFFFF";
                                mainBadge = st;
                              } else if (st === "ADM" || st === "DEM") {
                                cellBg = "#E2E8F0";
                                cellColor = "#475569";
                                mainBadge = st;
                              } else if (st === "EMPTY") {
                                cellBg = "#FFF1F2";
                                cellColor = "#BE123C";
                                mainBadge = "—";
                              } else if (st === "T" && isSunOrHoliday) {
                                cellBg = "#ECFDF5";
                                cellColor = "#166534";
                              }

                              const showLunchTag =
                                (st === "T" || st === "MEIO_EXP") &&
                                isSunOrHoliday &&
                                entry?.lunchSlot;

                              const conflictText =
                                cellConflicts.length > 0
                                  ? ` | Alertas: ${cellConflicts
                                      .map((c) => c.message || c.type)
                                      .join("; ")}`
                                  : "";

                              return (
                                <td
                                  key={d}
                                  tabIndex={isLockedPublished ? -1 : 0}
                                  onKeyDown={(ev) => handleGridCellKeyDown(ev, emp, pos, d)}
                                  onMouseDown={(ev) => {
                                    if (ev.button !== 0) return;
                                    if (activeBrush !== "NONE") setIsMousePainting(true);
                                    handleCellInteraction(emp, pos, d, ev, false);
                                  }}
                                  onMouseEnter={(ev) => {
                                    if (isMousePainting && activeBrush !== "NONE") {
                                      handleCellInteraction(emp, pos, d, ev, true);
                                    }
                                  }}
                                  style={{
                                    ...ui.tdGrid,
                                    width: dayColWidth,
                                    minWidth: dayColWidth,
                                    height: viewDensity === "detailed" ? 30 : 25,
                                    background: cellBg,
                                    color: cellColor,
                                    textAlign: "center",
                                    fontWeight: 700,
                                    fontSize: 11,
                                    cursor: isLockedPublished ? "not-allowed" : "pointer",
                                    position: "relative",
                                    boxShadow:
                                      cellConflicts.length > 0
                                        ? `inset 0 0 0 2px ${
                                            hasBlockingErr ? "#DC2626" : "#D97706"
                                          }`
                                        : isManual
                                          ? "inset 0 -2px 0 0 #2B5690"
                                          : "none",
                                    userSelect: "none",
                                  }}
                                  title={`${emp.fullName} — ${d.slice(8, 10)}/${d.slice(5, 7)} (${
                                    DIAS_SEMANA_CURTO[dow]
                                  }): ${st}${
                                    entry?.lunchSlot
                                      ? ` | Almoço ${FAIXAS_ALMOCO_DOMINGO[entry.lunchSlot]?.horario}`
                                      : ""
                                  }${isManual ? " | Ajuste manual" : ""}${conflictText}`}
                                >
                                  {cellConflicts.length > 0 && (
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        position: "absolute",
                                        top: 0,
                                        right: 0,
                                        width: 0,
                                        height: 0,
                                        borderStyle: "solid",
                                        borderWidth: "0 7px 7px 0",
                                        borderColor: `transparent ${
                                          hasBlockingErr ? "#DC2626" : "#D97706"
                                        } transparent transparent`,
                                      }}
                                    />
                                  )}
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 2,
                                    }}
                                  >
                                    <span>{mainBadge}</span>
                                    {showLunchTag && (
                                      <span
                                        style={{
                                          background: st === "MEIO_EXP" ? "#92400E" : "#15803D",
                                          color: "#FFFFFF",
                                          borderRadius: 2,
                                          padding: "0 3px",
                                          fontSize: 9.5,
                                          fontWeight: 700,
                                          lineHeight: "14px",
                                        }}
                                      >
                                        {entry.lunchSlot}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            <td
                              style={{
                                ...ui.tdGrid,
                                fontSize: 10.5,
                                fontWeight: 600,
                                textAlign: "center",
                                color: "#1E3A8A",
                                background: "#F8FAFC",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {emp ? getNextMonthFirstRestLabel(emp) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé Oficial da Planilha: Escala de Intervalos e Contagem de Quadro */}
        <div
          style={{
            background: "var(--uniao-surface-subtle, #f8fafc)",
            borderTop: "3px solid #2B5690",
            padding: "10px 16px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
          }}
        >
          <div style={{ fontWeight: 800, color: "var(--uniao-text-primary, #142B4D)" }}>
            TOTAL DO QUADRO PRÓPRIO PREENCHIDO:{" "}
            {
              db.workPositions.filter(
                (p) =>
                  p.unitId === selectedUnitId &&
                  !p.isSharedRateio &&
                  db.allocations.some(
                    (a) =>
                      a.workPositionId === p.id &&
                      a.startDate <= `${selectedYearMonth}-31` &&
                      (!a.endDate || a.endDate >= `${selectedYearMonth}-01`)
                  )
              ).length
            }{" "}
            COLABORADORES (+{" "}
            {
              db.workPositions.filter((p) => p.unitId === selectedUnitId && p.isSharedRateio)
                .length
            }{" "}
            POSTOS DE RATEIO COMPARTILHADO)
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontWeight: 700, color: "#2B5690" }}>
            <span>ESCALA DE INTERVALOS (DOMINGOS / FERIADOS):</span>
            <span>N 01 — 09:00 às 10:00</span>
            <span>N 02 — 10:00 às 11:00</span>
            <span>N 03 — 11:00 às 12:00</span>
            <span>N 04 — 12:00 às 13:00</span>
          </div>
        </div>
      </div>

      {/* POPOVER CONTEXTUAL DE EDIÇÃO DIRETA DE CÉLULA (Seção 9 — Corrige BUG-01 e BUG-02) */}
      {cellPopover && (
        <div
          className="no-print"
          style={ui.modalBackdropTransparent}
          onClick={() => setCellPopover(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: cellPopover.top,
              left: cellPopover.left,
              width: 315,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              boxShadow: "0 20px 40px rgba(15,23,42,0.28)",
              padding: "14px 14px",
              zIndex: 2500,
            }}
          >
            {(() => {
              const { emp, pos, isoDate } = cellPopover;
              const entry = entriesByEmpDate[emp.id]?.[isoDate];
              const curStatus = entry?.status || "T";
              const dow = getDayOfWeekISO(isoDate);
              const mDay = marketCalendarByDate[isoDate];
              const isSunOrHoliday = dow === 0 || Boolean(mDay);

              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>
                        {emp.fullName}
                      </div>
                      <div style={{ fontSize: 11, color: "#475569" }}>
                        {pos.title} · Dia{" "}
                        <strong>
                          {isoDate.slice(8, 10)}/{isoDate.slice(5, 7)} ({DIAS_SEMANA_CURTO[dow]})
                        </strong>
                      </div>
                    </div>
                    <button
                      onClick={() => setCellPopover(null)}
                      style={{
                        border: "none",
                        background: "#f1f5f9",
                        borderRadius: 6,
                        padding: "2px 7px",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 8,
                      fontSize: 10.5,
                      color: "#64748b",
                      background: "#f8fafc",
                      padding: "5px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Status Atual: <strong>{STATUS_CELULA_META[curStatus]?.label || curStatus}</strong> ·
                    Origem: <strong>{entry?.origin || "AUTO_GENERATED"}</strong>
                  </div>

                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#334155", marginBottom: 5 }}>
                    1. Selecionar Status do Dia:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[
                      { code: "T", label: "🟢 Trabalhando (T)" },
                      { code: "F", label: "🔵 Folga Normal (F)" },
                      { code: "A", label: "🟣 Folga Adicional (A)" },
                      { code: "MEIO_EXP", label: "🟡 Meio Expediente" },
                      { code: "EMPTY", label: "🗑️ Excluir / Limpar Dia (—)" },
                    ].map((opt) => (
                      <button
                        key={opt.code}
                        onClick={() => {
                          applyCellModification({
                            emp,
                            pos,
                            isoDate,
                            targetStatus: opt.code,
                          });
                          setCellPopover(null);
                        }}
                        style={{
                          padding: "7px 8px",
                          fontSize: 11,
                          fontWeight: curStatus === opt.code ? 800 : 600,
                          borderRadius: 6,
                          border:
                            curStatus === opt.code ? "2px solid #0f172a" : "1px solid #cbd5e1",
                          background: curStatus === opt.code ? "#e2e8f0" : "#fff",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Seletor Independente de Faixa de Almoço aos Domingos e Feriados */}
                  {isSunOrHoliday && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#166534", marginBottom: 5 }}>
                        2. Escala de Almoço (Domingo / Feriado):
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                        {Object.entries(FAIXAS_ALMOCO_DOMINGO).map(([slotKey, meta]) => {
                          const isSelected =
                            (curStatus === "T" || curStatus === "MEIO_EXP") &&
                            entry?.lunchSlot === slotKey;
                          return (
                            <button
                              key={slotKey}
                              onClick={() => {
                                applyCellModification({
                                  emp,
                                  pos,
                                  isoDate,
                                  targetStatus: curStatus === "MEIO_EXP" ? "MEIO_EXP" : "T",
                                  targetLunchSlot: slotKey,
                                });
                                setCellPopover(null);
                              }}
                              style={{
                                padding: "5px 6px",
                                fontSize: 10.5,
                                fontWeight: isSelected ? 800 : 600,
                                borderRadius: 6,
                                border: isSelected ? "2px solid #15803d" : "1px solid #bbf7d0",
                                background: isSelected ? "#dcfce7" : "#f0fdf4",
                                color: "#166534",
                                cursor: "pointer",
                              }}
                            >
                              🍽️ {meta.curto}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ações Complementares: Restaurar Automático, Troca de Folga e Calendário */}
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                    }}
                  >
                    <button
                      onClick={() => {
                        applyCellModification({ emp, pos, isoDate, restoreAuto: true });
                        setCellPopover(null);
                      }}
                      style={{ ...ui.btnSecondary, width: "100%", textAlign: "left" }}
                    >
                      🔄 Restaurar Cálculo Automático da Regra
                    </button>

                    {(curStatus === "F" || curStatus === "A") && (
                      <button
                        onClick={() => {
                          setSwapTarget({ emp, pos, isoDate });
                          setCellPopover(null);
                        }}
                        style={{ ...ui.btnSecondary, width: "100%", textAlign: "left", color: "#1d4ed8" }}
                      >
                        🤝 Sugerir Troca Bilateral de Folga no Setor
                      </button>
                    )}

                    {onNavigate && (
                      <button
                        onClick={() => {
                          setCellPopover(null);
                          onNavigate("calendar");
                        }}
                        style={{
                          ...ui.btnSecondary,
                          width: "100%",
                          textAlign: "left",
                          fontSize: 10.5,
                          color: "#64748b",
                        }}
                      >
                        🗓️ Configurar Feriado / Mercado Fechado no Calendário
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: CONSTRUIR ESCALA MANUAL (Seção 11.1 — 3 Modos) */}
      {manualBuildModalOpen && (
        <div style={ui.modalBackdrop}>
          <div style={{ ...ui.modalCard, width: 520 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>
              🛠️ Construir Escala Manual ({selectedYearMonth} · {selectedUnitId})
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
              Escolha como deseja iniciar ou estruturar a construção manual desta competência. Após concluir, valide a escala para que ela alimente automaticamente o próximo mês ({nextYearMonth}).
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={ui.optionBox}>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a" }}>
                  1. Iniciar Escala Vazia (Células em Branco)
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 8px" }}>
                  Limpa todos os dias operacionais para preenchimento do zero com o Pincel ou Clique Contextual, preservando apenas Férias, Afastamentos, Admissões e Feriados Fechados.
                </div>
                <button
                  onClick={() => handleExecuteManualBuild("EMPTY")}
                  style={ui.btnPrimary}
                >
                  Iniciar Grade Vazia para Preenchimento Manual
                </button>
              </div>

              <div style={ui.optionBox}>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a" }}>
                  2. Copiar Escala de Outro Período
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 8px" }}>
                  Importa os lançamentos de outra competência como rascunho manual editável:
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="month"
                    value={manualCopySourceMonth}
                    onChange={(e) => setManualCopySourceMonth(e.target.value)}
                    style={ui.input}
                  />
                  <button
                    onClick={() => handleExecuteManualBuild("COPY")}
                    style={ui.btnPrimary}
                  >
                    Copiar de {manualCopySourceMonth}
                  </button>
                </div>
              </div>

              <div style={ui.optionBox}>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a" }}>
                  3. Converter Escala Automática Atual em Rascunho Editável
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", margin: "4px 0 8px" }}>
                  Fixa os lançamentos automáticos atuais como base manual (`MANUAL_OVERRIDE`) para ajustes finos.
                </div>
                <button
                  onClick={() => handleExecuteManualBuild("CONVERT_DRAFT")}
                  style={ui.btnSecondary}
                >
                  Converter Grade Atual em Rascunho Manual
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setManualBuildModalOpen(false)} style={ui.btnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIMPAR LANÇAMENTOS DO MÊS (Seção 11.2) */}
      {clearMonthModalOpen && (
        <div style={ui.modalBackdrop}>
          <div style={ui.modalCard}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#b45309", marginBottom: 8 }}>
              🧹 Confirmar Limpeza dos Lançamentos de {selectedYearMonth}
            </div>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, marginBottom: 14 }}>
              Esta operação irá redefinir para <strong>Vazio (—)</strong> todos os lançamentos de trabalho e folga dos colaboradores da unidade <strong>{selectedUnitId}</strong> na competência <strong>{selectedYearMonth}</strong>.
              <br />
              <br />
              ✅ <strong>Serão preservados automaticamente:</strong> Férias (`FÉR`), Licenças (`LM`/`INSS`), datas de Admissão (`ADM`), Desligamentos (`DEM`) e dias de Mercado Fechado (`FECH`).
              <br />
              ↩ Você poderá reverter esta ação imediatamente usando o botão <strong>Desfazer</strong>.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setClearMonthModalOpen(false)} style={ui.btnSecondary}>
                Cancelar
              </button>
              <button
                onClick={handleConfirmClearMonth}
                style={{ ...ui.btnPrimary, background: "#b45309" }}
              >
                Confirmar Limpeza do Mês
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHECKLIST DE VALIDAÇÃO EM 10 NÍVEIS (Seção 12) */}
      {validationModalData && (
        <div style={ui.modalBackdrop}>
          <div style={{ ...ui.modalCard, width: 620 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              ✓ Checklist Oficial de Validação da Escala ({selectedYearMonth} · {selectedUnitId})
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
              A validação consolida o estado final do ciclo (`cycleStates`) de cada colaborador para garantir continuidade exata no mês seguinte (<strong>{nextYearMonth}</strong>).
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 12,
                background: validationModalData.canValidate ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${validationModalData.canValidate ? "#bbf7d0" : "#fecaca"}`,
                color: validationModalData.canValidate ? "#166534" : "#991b1b",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {validationModalData.canValidate
                ? `✅ Nenhum erro bloqueante encontrado! (${validationModalData.operationalWarnings.length} alerta(s) operacional(is) de cobertura/jornada). A escala está apta para Validação e Publicação.`
                : `⛔ Existem ${validationModalData.blockingErrors.length} erro(s) bloqueante(s) que precisam ser corrigidos antes de validar ou publicar.`}
            </div>

            {validationModalData.blockingErrors.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#991b1b", marginBottom: 4 }}>
                  Erros Bloqueantes ({validationModalData.blockingErrors.length}):
                </div>
                <div
                  style={{
                    maxHeight: 150,
                    overflowY: "auto",
                    background: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 11,
                    color: "#881337",
                  }}
                >
                  {validationModalData.blockingErrors.slice(0, 25).map((err) => (
                    <div key={err.id} style={{ marginBottom: 3 }}>
                      • <strong>[{err.type}]</strong> {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validationModalData.operationalWarnings.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#b45309", marginBottom: 4 }}>
                  Alertas Operacionais Não-Bloqueantes ({validationModalData.operationalWarnings.length}):
                </div>
                <div
                  style={{
                    maxHeight: 150,
                    overflowY: "auto",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 11,
                    color: "#78350f",
                  }}
                >
                  {validationModalData.operationalWarnings.slice(0, 25).map((w) => (
                    <div key={w.id} style={{ marginBottom: 3 }}>
                      • <strong>[{w.type}]</strong> {w.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => setValidationModalData(null)} style={ui.btnSecondary}>
                Fechar
              </button>
              {validationModalData.canValidate && !isLockedPublished && (
                <>
                  <button
                    onClick={() => handleConfirmLifecycleChange("VALIDATED")}
                    style={{ ...ui.btnPrimary, background: "#1d4ed8" }}
                  >
                    ✓ Confirmar Validação e Salvar Ciclo p/ {nextYearMonth}
                  </button>
                  <button
                    onClick={() => handleConfirmLifecycleChange("PUBLISHED")}
                    style={{ ...ui.btnPrimary, background: "#166534" }}
                  >
                    📢 Validar e Publicar Oficialmente
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REABRIR ESCALA PUBLICADA COM JUSTIFICATIVA OBRIGATÓRIA (Seção 15) */}
      {reopenModalOpen && (
        <div style={ui.modalBackdrop}>
          <div style={ui.modalCard}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              🔓 Reabrir Escala Publicada ({selectedYearMonth} · Versão #{currentMonthlySchedule.versionNumber || 1})
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
              A reabertura cria a <strong>Versão #{(currentMonthlySchedule.versionNumber || 1) + 1}</strong> em modo Rascunho e registra a justificativa na trilha de auditoria.
            </div>
            <div>
              <label style={ui.label}>Justificativa Obrigatória da Reabertura *</label>
              <textarea
                rows={3}
                value={reopenReasonText}
                onChange={(e) => setReopenReasonText(e.target.value)}
                placeholder="Ex: Ajuste de cobertura no setor de Caixa após atestado médico..."
                style={{ ...ui.input, width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => setReopenModalOpen(false)} style={ui.btnSecondary}>
                Cancelar
              </button>
              <button onClick={handleConfirmReopenPublished} style={ui.btnPrimary}>
                Confirmar Reabertura Auditada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Troca Bilateral de Folga */}
      {swapTarget && (
        <div style={ui.modalBackdrop}>
          <div style={ui.modalCard}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              🤝 Sugestão de Troca Bilateral de Folga
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
              Transferir a folga de <strong>{swapTarget.emp.fullName}</strong> no dia{" "}
              <strong>{swapTarget.isoDate.split("-").reverse().join("/")}</strong> para um colega do
              mesmo setor que esteja trabalhando nessa data:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
              {db.employees
                .filter((cand) => {
                  if (cand.id === swapTarget.emp.id) return false;
                  const alloc = getActiveAllocationOnDate(
                    db.allocations,
                    cand.id,
                    swapTarget.isoDate
                  );
                  if (!alloc || alloc.sectorId !== swapTarget.pos.sectorId) return false;
                  const entryOnTarget = entriesByEmpDate[cand.id]?.[swapTarget.isoDate];
                  return entryOnTarget?.status === "T";
                })
                .map((cand) => {
                  const candRestEntry = monthEntries.find(
                    (e) =>
                      e.employeeId === cand.id &&
                      e.workDate !== swapTarget.isoDate &&
                      e.status === "F"
                  );
                  if (!candRestEntry) return null;
                  return (
                    <div
                      key={cand.id}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "8px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{cand.fullName}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          Cede a folga do dia{" "}
                          <strong>{candRestEntry.workDate.split("-").reverse().join("/")}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => handleExecuteSwap(cand, candRestEntry.workDate)}
                        style={ui.btnPrimary}
                      >
                        Confirmar Troca
                      </button>
                    </div>
                  );
                })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setSwapTarget(null)} style={ui.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISUALIZAÇÃO PRÉVIA DOCUMENTAL A4 PAISAGEM + IMPRESSÃO FÍSICA E EXPORTAÇÃO PDF */}
      {printPreviewOpen && (
        <SchedulePrintPreviewModal
          open
          onClose={() => setPrintPreviewOpen(false)}
          db={db}
          unitId={selectedUnitId}
          yearMonth={selectedYearMonth}
          initialFilterSectorId={filterSectorId}
        />
      )}
      <ScheduleDefaultPrintPortal
        db={db}
        unitId={selectedUnitId}
        yearMonth={selectedYearMonth}
        disabled={printPreviewOpen}
      />
    </div>
  );
}

function ScheduleStatusPill({ status, version = 1 }) {
  const map = {
    DRAFT: { label: `Rascunho (v${version})`, bg: "#f1f5f9", color: "#475569" },
    VALIDATED: { label: `Validada (v${version})`, bg: "#dbeafe", color: "#1d4ed8" },
    PUBLISHED: { label: `Publicada (v${version})`, bg: "#dcfce7", color: "#166534" },
    IMPACTED_BY_PAST_CHANGE: {
      label: `Impactada p/ Recálculo (v${version})`,
      bg: "#fef3c7",
      color: "#b45309",
    },
  };
  const m = map[status] || map.DRAFT;
  return (
    <span
      style={{
        background: m.bg,
        color: m.color,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      ● {m.label}
    </span>
  );
}

function LegendItem({ bg, color, text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 12,
          height: 12,
          background: bg,
          color,
          border: "1px solid #94a3b8",
          borderRadius: 2,
          display: "inline-block",
        }}
      />
      <span>{text}</span>
    </span>
  );
}

const ui = createUniaoModuleUi({
  card: {
    padding: "12px 15px",
  },
  label: {
    fontSize: 10,
    marginBottom: 2,
  },
  select: {
    fontSize: 11.5,
    padding: "5px 8px",
  },
  input: {
    fontSize: 11.5,
    padding: "5px 8px",
  },
  btnPrimary: {
    fontSize: 11.5,
    padding: "6px 11px",
  },
  btnSecondary: {
    fontSize: 11.5,
    padding: "6px 11px",
  },
  thSticky: {
    position: "sticky",
    zIndex: 12,
    padding: "5px 6px",
    borderBottom: "1px solid #1B3963",
    borderRight: "1px solid #3A69A8",
    fontSize: 9.5,
    fontWeight: 800,
    textAlign: "center",
  },
  tdSticky: {
    position: "sticky",
    zIndex: 8,
    padding: "3px 6px",
    borderBottom: "1px solid #cbd5e1",
    borderRight: "1px solid #cbd5e1",
  },
  thGrid: {
    padding: "4px 2px",
    borderBottom: "1px solid #3A69A8",
    borderRight: "1px solid #3A69A8",
    fontSize: 9,
    fontWeight: 700,
    textAlign: "center",
  },
  tdGrid: {
    padding: "2px 2px",
    borderBottom: "1px solid #cbd5e1",
    borderRight: "1px solid #cbd5e1",
  },
  modalCard: {
    width: 470,
    maxWidth: "92%",
  },
});
