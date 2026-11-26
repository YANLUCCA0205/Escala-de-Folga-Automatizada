// =============================================================================
// GESTÃO DE COLABORADORES, CENTRAL UNIFICADA DO COLABORADOR (PROMOÇÃO GUIADA,
// TRANSFERÊNCIA COM CRIAÇÃO DE VAGA INLINE, RATEIO MULTIUNIDADE E HISTÓRICO)
// E FÉRIAS / AFASTAMENTOS COM RECÁLCULO DINÂMICO DE STATUS (v8.0 — Seções 17-19)
// =============================================================================

import { useState, useMemo } from "react";
import {
  addDaysISO,
  computeDynamicEmploymentStatus,
  createSequentialPositions,
} from "../domain/scheduleEngine.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";

const DOW_LABELS = [
  ["1", "Segunda-feira"],
  ["2", "Terça-feira"],
  ["3", "Quarta-feira"],
  ["4", "Quinta-feira"],
  ["5", "Sexta-feira"],
  ["6", "Sábado"],
  ["0", "Domingo"],
];

export default function EmployeesAndAvailabilityModule({
  db,
  selectedUnitId,
  selectedYearMonth,
  initialTab = "employees",
  onMutateDb,
}) {
  const activeReferenceDate = selectedYearMonth
    ? `${selectedYearMonth}-01`
    : new Date().toISOString().slice(0, 10);
  const [subTab, setSubTab] = useState(
    initialTab === "unavailability" ? "availability" : "employees"
  );
  const [searchEmp, setSearchEmp] = useState("");
  const [showAllUnitsEmployees, setShowAllUnitsEmployees] = useState(false);

  // CENTRAL DE GESTÃO DO COLABORADOR (Seção 17)
  const [centralEmpId, setCentralEmpId] = useState(null);
  const [centralTab, setCentralTab] = useState("profile"); // 'profile' | 'movement' | 'rateio' | 'history'

  // Estado para Admissão de Novo Colaborador em Vaga Aberta
  const [hireName, setHireName] = useState("");
  const [hireRegCode, setHireRegCode] = useState("");
  const [hireDate, setHireDate] = useState("2026-11-01");
  const [hirePositionId, setHirePositionId] = useState("");
  const [hireAnchorRest, setHireAnchorRest] = useState("");

  // Estado para Edição de Dados Cadastrais dentro da Central
  const [editEmpForm, setEditEmpForm] = useState(null);

  // Estado para Promoção / Movimentação Guiada dentro da Central (Seção 17.2)
  const [movType, setMovType] = useState("PROMOTION_TRANSFER"); // 'PROMOTION_TRANSFER' | 'SAME_POS_SHIFT_RULE' | 'CREATE_NEW_POS'
  const [movTargetUnitId, setMovTargetUnitId] = useState(selectedUnitId || "LOJA_03");
  const [movPositionId, setMovPositionId] = useState("");
  const [movNewSectorId, setMovNewSectorId] = useState("SEC_ACOUGUE");
  const [movNewRoleId, setMovNewRoleId] = useState("R_ACOUGUEIRO");
  const [movShiftId, setMovShiftId] = useState("SH_OP_MANHA_0640");
  const [movRuleId, setMovRuleId] = useState("RULE_5X1");
  const [movStartDate, setMovStartDate] = useState("2026-11-16");
  const [movReason, setMovReason] = useState("Promoção / Movimentação funcional autorizada");

  // Estado para Registro e Edição de Férias / Afastamento (Seção 19 — Corrige BUG-08)
  const [editingUnavId, setEditingUnavId] = useState(null);
  const [unavEmpId, setUnavEmpId] = useState(db.employees[0]?.id || "");
  const [unavType, setUnavType] = useState("VACATION");
  const [unavStart, setUnavStart] = useState("2026-11-01");
  const [unavEnd, setUnavEnd] = useState("2026-11-30");
  const [unavNotes, setUnavNotes] = useState("");

  const sectorsById = useMemo(
    () => Object.fromEntries(db.sectors.map((s) => [s.id, s])),
    [db.sectors]
  );
  const rolesById = useMemo(
    () => Object.fromEntries(db.roles.map((r) => [r.id, r])),
    [db.roles]
  );
  const positionsById = useMemo(
    () => Object.fromEntries(db.workPositions.map((p) => [p.id, p])),
    [db.workPositions]
  );
  const shiftsById = useMemo(
    () => Object.fromEntries(db.workShifts.map((s) => [s.id, s])),
    [db.workShifts]
  );
  const rulesById = useMemo(
    () => Object.fromEntries(db.scheduleRules.map((r) => [r.id, r])),
    [db.scheduleRules]
  );

  // Postos vagos disponíveis para alocação
  const vacantPositions = useMemo(() => {
    const occupiedIds = new Set(
      db.allocations
        .filter((a) => !a.endDate || a.endDate >= activeReferenceDate)
        .map((a) => a.workPositionId)
    );
    return db.workPositions.filter(
      (p) =>
        (!selectedUnitId || p.unitId === selectedUnitId) &&
        !occupiedIds.has(p.id) &&
        p.status !== "DEACTIVATED"
    );
  }, [db.allocations, db.workPositions, selectedUnitId, activeReferenceDate]);

  const vacantPositionsInTargetUnit = useMemo(() => {
    const occupiedIds = new Set(
      db.allocations
        .filter((a) => !a.endDate || a.endDate >= movStartDate)
        .map((a) => a.workPositionId)
    );
    return db.workPositions.filter(
      (p) =>
        (!movTargetUnitId || p.unitId === movTargetUnitId) &&
        !occupiedIds.has(p.id) &&
        p.status !== "DEACTIVATED"
    );
  }, [db.allocations, db.workPositions, movTargetUnitId, movStartDate]);

  // Filtra colaboradores respeitando o Contexto Global de Unidade (Seção 5) + Rateio Compartilhado (Seção 18)
  const filteredEmployees = useMemo(() => {
    return db.employees
      .filter((emp) => {
        if (showAllUnitsEmployees || !selectedUnitId) return true;
        if (emp.homeUnitId === selectedUnitId) return true;
        if (emp.isSharedRateio && (emp.authorizedUnitIds || []).includes(selectedUnitId)) {
          return true;
        }
        const hasAllocInUnit = db.allocations.some(
          (a) => a.employeeId === emp.id && a.unitId === selectedUnitId
        );
        // Também mostra colaboradores sem alocação que pertençam à Loja 03 (como Edileuza INSS)
        if (!db.allocations.some((a) => a.employeeId === emp.id) && selectedUnitId === "LOJA_03") {
          return true;
        }
        return hasAllocInUnit;
      })
      .filter((emp) => {
        if (!searchEmp.trim()) return true;
        const q = searchEmp.toLowerCase();
        return (
          emp.fullName.toLowerCase().includes(q) ||
          emp.registrationCode.toLowerCase().includes(q) ||
          (emp.notes && emp.notes.toLowerCase().includes(q))
        );
      });
  }, [db.employees, db.allocations, selectedUnitId, showAllUnitsEmployees, searchEmp]);

  const centralEmp = useMemo(
    () => db.employees.find((e) => e.id === centralEmpId) || null,
    [db.employees, centralEmpId]
  );

  const openCentralForEmployee = (emp, defaultTab = "profile") => {
    const empAllocs = db.allocations
      .filter((a) => a.employeeId === emp.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const curAlloc = empAllocs[0];

    setCentralEmpId(emp.id);
    setCentralTab(defaultTab);
    setEditEmpForm({
      fullName: emp.fullName,
      registrationCode: emp.registrationCode,
      hireDate: emp.hireDate,
      terminationDate: emp.terminationDate || "",
      noticePeriodEndDate: emp.noticePeriodEndDate || "",
      anchorLastRestDate: emp.anchorLastRestDate || "",
      notes: emp.notes || "",
      isSharedRateio: Boolean(emp.isSharedRateio),
      homeUnitId: emp.homeUnitId || curAlloc?.unitId || selectedUnitId || "LOJA_03",
      authorizedUnitIds: emp.authorizedUnitIds?.length
        ? emp.authorizedUnitIds
        : [curAlloc?.unitId || selectedUnitId || "LOJA_03"],
      rateioScheduleByDow: emp.rateioScheduleByDow || null,
    });
    setMovTargetUnitId(curAlloc?.unitId || selectedUnitId || "LOJA_03");
    setMovPositionId(vacantPositions[0]?.id || "");
    setMovShiftId(curAlloc?.workShiftId || "SH_OP_MANHA_0640");
    setMovRuleId(curAlloc?.scheduleRuleId || "RULE_5X1");
  };

  // Admissão de novo colaborador
  const handleHireEmployee = (e) => {
    e.preventDefault();
    if (!hireName.trim() || !hirePositionId) return;
    const pos = positionsById[hirePositionId];
    if (!pos) return;

    const empId = `EMP_${Date.now()}`;
    const regCode = hireRegCode.trim() || `MAT-${Math.floor(2000 + Math.random() * 7999)}`;
    const newEmp = {
      id: empId,
      registrationCode: regCode,
      fullName: hireName.trim().toUpperCase(),
      homeUnitId: pos.unitId,
      isSharedRateio: Boolean(pos.isSharedRateio),
      authorizedUnitIds: pos.isSharedRateio ? ["LOJA_03", "LOJA_01", "LOJA_02"] : [pos.unitId],
      rateioScheduleByDow: null,
      hireDate,
      terminationDate: null,
      noticePeriodEndDate: null,
      employmentStatus: "ACTIVE",
      anchorLastRestDate: hireAnchorRest || null,
      anchorCycleOffset: 0,
      notes: `Admitido na vaga ${pos.title}`,
    };

    const newAlloc = {
      id: `ALLOC_${empId}_01`,
      employeeId: empId,
      workPositionId: pos.id,
      unitId: pos.unitId,
      sectorId: pos.sectorId,
      roleId: pos.roleId,
      workShiftId: pos.defaultShiftId || db.workShifts[0].id,
      scheduleRuleId: pos.defaultRuleId || db.scheduleRules[0].id,
      startDate: hireDate,
      endDate: null,
      transferReason: "Admissão / Alocação Inicial",
    };

    onMutateDb({
      permission: "MANAGE_EMPLOYEES",
      module: "COLABORADORES",
      action: "ADMITIR_COLABORADOR",
      entityType: "EMPLOYEE",
      entityId: empId,
      summary: `Admitido colaborador ${newEmp.fullName} (${regCode}) e vinculado ao posto ${pos.title} a partir de ${hireDate}.`,
      updater: (draft) => {
        draft.employees.push(newEmp);
        draft.allocations.push(newAlloc);
        const targetPos = draft.workPositions.find((p) => p.id === pos.id);
        if (targetPos) targetPos.status = "FILLED";
      },
    });

    setHireName("");
    setHireRegCode("");
    setHirePositionId("");
    setHireAnchorRest("");
  };

  // Salvar Dados Cadastrais / Ciclo / Rateio do Colaborador na Central
  const handleSaveEmployeeProfileAndRateio = (e) => {
    e.preventDefault();
    if (!centralEmp || !editEmpForm) return;

    onMutateDb({
      permission: "MANAGE_EMPLOYEES",
      module: "COLABORADORES",
      action: "ATUALIZAR_CADASTRO_COLABORADOR",
      entityType: "EMPLOYEE",
      entityId: centralEmp.id,
      summary: `Atualizado cadastro e configuração de ciclo/rateio de ${editEmpForm.fullName.trim().toUpperCase()}.`,
      updater: (draft) => {
        const idx = draft.employees.findIndex((x) => x.id === centralEmp.id);
        if (idx >= 0) {
          const updated = {
            ...draft.employees[idx],
            fullName: editEmpForm.fullName.trim().toUpperCase(),
            registrationCode: editEmpForm.registrationCode.trim(),
            hireDate: editEmpForm.hireDate,
            terminationDate: editEmpForm.terminationDate || null,
            noticePeriodEndDate: editEmpForm.noticePeriodEndDate || null,
            anchorLastRestDate: editEmpForm.anchorLastRestDate || null,
            notes: editEmpForm.notes,
            isSharedRateio: Boolean(editEmpForm.isSharedRateio),
            homeUnitId: editEmpForm.homeUnitId,
            authorizedUnitIds: editEmpForm.authorizedUnitIds,
            rateioScheduleByDow: editEmpForm.isSharedRateio
              ? editEmpForm.rateioScheduleByDow
              : null,
          };
          updated.employmentStatus = computeDynamicEmploymentStatus({
            employee: updated,
            unavailabilityEvents: draft.unavailabilityEvents,
            referenceDate: activeReferenceDate,
          });
          draft.employees[idx] = updated;
        }
      },
    });
  };

  // Executar Promoção / Movimentação Guiada (Seção 17.2)
  const handleExecuteGuidedMovement = (e) => {
    e.preventDefault();
    if (!centralEmp || !movStartDate) return;
    const prevEndDate = addDaysISO(movStartDate, -1);

    onMutateDb({
      permission: "TRANSFER_EMPLOYEES",
      module: "COLABORADORES",
      action: "MOVIMENTACAO_PROMOCAO_GUIADA",
      entityType: "EMPLOYEE_ALLOCATION",
      entityId: centralEmp.id,
      summary: `Movimentação funcional guiada de ${centralEmp.fullName} com vigência em ${movStartDate} (${movReason}). Histórico anterior preservado até ${prevEndDate}.`,
      updater: (draft) => {
        const curAllocs = draft.allocations
          .filter((a) => a.employeeId === centralEmp.id)
          .sort((a, b) => b.startDate.localeCompare(a.startDate));
        const currentAlloc = curAllocs[0];

        let targetPos = null;

        if (movType === "SAME_POS_SHIFT_RULE" && currentAlloc) {
          targetPos = draft.workPositions.find((p) => p.id === currentAlloc.workPositionId);
        } else if (movType === "CREATE_NEW_POS") {
          const roleObj = draft.roles.find((r) => r.id === movNewRoleId) || draft.roles[0];
          const existingForRole = draft.workPositions.filter(
            (p) => p.unitId === movTargetUnitId && p.roleId === roleObj.id && !p.isSharedRateio
          );
          const createdArr = createSequentialPositions({
            unitId: movTargetUnitId,
            sectorId: movNewSectorId,
            role: roleObj,
            quantity: 1,
            startNumber: existingForRole.length + 1,
            defaultShiftId: movShiftId,
            defaultRuleId: movRuleId,
            initialStatus: "FILLED",
          });
          targetPos = createdArr[0];
          draft.workPositions.push(targetPos);
        } else {
          targetPos = draft.workPositions.find((p) => p.id === movPositionId);
        }

        if (!targetPos) return;

        // Fecha alocação anterior na véspera da nova vigência
        draft.allocations.forEach((a) => {
          if (a.employeeId === centralEmp.id && (!a.endDate || a.endDate >= movStartDate)) {
            a.endDate = prevEndDate;
            if (a.workPositionId !== targetPos.id) {
              const oldPos = draft.workPositions.find((p) => p.id === a.workPositionId);
              if (oldPos) oldPos.status = "OPEN_AUTHORIZED";
            }
          }
        });

        // Cria nova alocação histórica
        draft.allocations.push({
          id: `ALLOC_${centralEmp.id}_${Date.now()}`,
          employeeId: centralEmp.id,
          workPositionId: targetPos.id,
          unitId: targetPos.unitId,
          sectorId: targetPos.sectorId,
          roleId: targetPos.roleId,
          workShiftId: movShiftId || targetPos.defaultShiftId,
          scheduleRuleId: movRuleId || targetPos.defaultRuleId,
          startDate: movStartDate,
          endDate: null,
          transferReason: movReason,
        });

        targetPos.status = "FILLED";

        // Registra também em ruleAssignments para rastreabilidade de versão de regra
        if (!draft.ruleAssignments) draft.ruleAssignments = [];
        draft.ruleAssignments.forEach((ra) => {
          if (ra.employeeId === centralEmp.id && (!ra.effectiveTo || ra.effectiveTo >= movStartDate)) {
            ra.effectiveTo = prevEndDate;
          }
        });
        draft.ruleAssignments.push({
          id: `RA_${centralEmp.id}_${Date.now()}`,
          employeeId: centralEmp.id,
          ruleId: movRuleId || targetPos.defaultRuleId,
          effectiveFrom: movStartDate,
          effectiveTo: null,
          reason: movReason,
        });
      },
    });

    setCentralTab("history");
  };

  // Registrar ou Editar Férias / Afastamento (Corrige BUG-08 recalculando status dinamicamente)
  const handleSaveUnavailability = (e) => {
    e.preventDefault();
    if (!unavEmpId || !unavStart || !unavEnd || unavStart > unavEnd) return;
    const emp = db.employees.find((x) => x.id === unavEmpId);

    onMutateDb({
      permission: "MANAGE_UNAVAILABILITY",
      module: "DISPONIBILIDADE_FERIAS",
      action: editingUnavId ? "EDITAR_INDISPONIBILIDADE" : "REGISTRAR_INDISPONIBILIDADE",
      entityType: "UNAVAILABILITY_EVENT",
      entityId: editingUnavId || `${unavEmpId}_${unavStart}`,
      summary: `${editingUnavId ? "Atualizado" : "Registrado"} evento ${unavType} para ${emp?.fullName} (${unavStart} até ${unavEnd}).`,
      updater: (draft) => {
        if (editingUnavId) {
          const idx = draft.unavailabilityEvents.findIndex((x) => x.id === editingUnavId);
          if (idx >= 0) {
            draft.unavailabilityEvents[idx] = {
              ...draft.unavailabilityEvents[idx],
              employeeId: unavEmpId,
              eventType: unavType,
              startDate: unavStart,
              endDate: unavEnd,
              notes: unavNotes || "",
            };
          }
        } else {
          draft.unavailabilityEvents.push({
            id: `UNAV_${unavEmpId}_${Date.now()}`,
            employeeId: unavEmpId,
            eventType: unavType,
            startDate: unavStart,
            endDate: unavEnd,
            cycleBehavior: "RESET_ON_RETURN",
            notes: unavNotes || "",
          });
        }

        // Recalcula dinamicamente o employmentStatus de todos os colaboradores afetados
        draft.employees.forEach((empItem) => {
          if (unavType === "NOTICE_PERIOD" && empItem.id === unavEmpId) {
            empItem.noticePeriodEndDate = unavEnd;
            empItem.terminationDate = unavEnd;
          }
          empItem.employmentStatus = computeDynamicEmploymentStatus({
            employee: empItem,
            unavailabilityEvents: draft.unavailabilityEvents,
            referenceDate: activeReferenceDate,
          });
        });
      },
    });

    setEditingUnavId(null);
    setUnavNotes("");
  };

  // Remover Indisponibilidade e recalcular imediatamente o status funcional do colaborador (Corrige BUG-08!)
  const handleRemoveUnavailability = (evId) => {
    const targetEv = db.unavailabilityEvents.find((x) => x.id === evId);
    const emp = db.employees.find((x) => x.id === targetEv?.employeeId);

    onMutateDb({
      permission: "MANAGE_UNAVAILABILITY",
      module: "DISPONIBILIDADE_FERIAS",
      action: "EXCLUIR_INDISPONIBILIDADE",
      entityType: "UNAVAILABILITY_EVENT",
      entityId: evId,
      summary: `Excluído evento de indisponibilidade (${targetEv?.eventType || evId}) de ${emp?.fullName || "colaborador"} e recalculado status funcional.`,
      updater: (draft) => {
        draft.unavailabilityEvents = draft.unavailabilityEvents.filter((x) => x.id !== evId);
        draft.employees.forEach((empItem) => {
          if (targetEv?.eventType === "NOTICE_PERIOD" && empItem.id === targetEv.employeeId) {
            empItem.noticePeriodEndDate = null;
            empItem.terminationDate = null;
          }
          empItem.employmentStatus = computeDynamicEmploymentStatus({
            employee: empItem,
            unavailabilityEvents: draft.unavailabilityEvents,
            referenceDate: activeReferenceDate,
          });
        });
      },
    });
  };

  // Excluir Colaborador e liberar seus postos/alocações
  const handleDeleteEmployee = (emp) => {
    if (!emp) return;
    onMutateDb({
      permission: "MANAGE_EMPLOYEES",
      module: "COLABORADORES",
      action: "EXCLUIR_COLABORADOR",
      entityType: "EMPLOYEE",
      entityId: emp.id,
      unitId: emp.homeUnitId || selectedUnitId,
      summary: `Excluído colaborador ${emp.fullName} (${emp.registrationCode}) e liberadas as vagas vinculadas.`,
      updater: (draft) => {
        const occupiedPosIds = new Set(
          (draft.allocations || [])
            .filter((a) => a.employeeId === emp.id && !a.endDate)
            .map((a) => a.workPositionId)
        );
        draft.employees = (draft.employees || []).filter((x) => x.id !== emp.id);
        draft.allocations = (draft.allocations || []).filter((a) => a.employeeId !== emp.id);
        draft.unavailabilityEvents = (draft.unavailabilityEvents || []).filter(
          (ev) => ev.employeeId !== emp.id
        );
        draft.ruleAssignments = (draft.ruleAssignments || []).filter(
          (ra) => ra.employeeId !== emp.id
        );
        draft.cycleStates = (draft.cycleStates || []).filter((cs) => cs.employeeId !== emp.id);

        Object.keys(draft.dailyEntriesByMonth || {}).forEach((ym) => {
          draft.dailyEntriesByMonth[ym] = (draft.dailyEntriesByMonth[ym] || []).filter(
            (e) => e.employeeId !== emp.id
          );
        });

        (draft.workPositions || []).forEach((p) => {
          if (occupiedPosIds.has(p.id) && p.status === "FILLED") {
            const stillOccupied = (draft.allocations || []).some(
              (a) => a.workPositionId === p.id && !a.endDate
            );
            if (!stillOccupied) p.status = "OPEN_AUTHORIZED";
          }
        });
      },
    });
    if (centralEmpId === emp.id) {
      setCentralEmpId(null);
    }
  };

  // Excluir uma Alocação Histórica específica do Colaborador
  const handleDeleteAllocation = (alloc) => {
    if (!alloc) return;
    onMutateDb({
      permission: "MANAGE_EMPLOYEES",
      module: "COLABORADORES",
      action: "EXCLUIR_ALOCACAO_COLABORADOR",
      entityType: "EMPLOYEE_ALLOCATION",
      entityId: alloc.id,
      unitId: alloc.unitId || selectedUnitId,
      summary: `Excluído registro de alocação (${alloc.startDate}) do colaborador ${centralEmp?.fullName || alloc.employeeId}.`,
      updater: (draft) => {
        draft.allocations = (draft.allocations || []).filter((a) => a.id !== alloc.id);
        const pos = (draft.workPositions || []).find((p) => p.id === alloc.workPositionId);
        if (pos && pos.status === "FILLED") {
          const stillOccupied = (draft.allocations || []).some(
            (a) => a.workPositionId === pos.id && !a.endDate
          );
          if (!stillOccupied) pos.status = "OPEN_AUTHORIZED";
        }
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setSubTab("employees")}
            style={subTab === "employees" ? ui.subTabActive : ui.subTab}
          >
            👥 Colaboradores, Central de Movimentação e Rateio ({filteredEmployees.length})
          </button>
          <button
            onClick={() => setSubTab("availability")}
            style={subTab === "availability" ? ui.subTabActive : ui.subTab}
          >
            🏖️ Férias, Afastamentos, INSS e Aviso Prévio ({db.unavailabilityEvents.length})
          </button>
        </div>

        <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showAllUnitsEmployees}
            onChange={(e) => setShowAllUnitsEmployees(e.target.checked)}
          />
          Exibir colaboradores de todas as lojas (Visão Consolidada)
        </label>
      </div>

      {subTab === "employees" ? (
        <>
          {/* Formulário de Admissão / Alocação em Vaga Aberta */}
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              ➕ Admitir / Vincular Novo Colaborador a um Posto Vago ({selectedUnitId})
            </div>
            <form
              onSubmit={handleHireEmployee}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={ui.label}>Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: JOÃO DA SILVA"
                  value={hireName}
                  onChange={(e) => setHireName(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Matrícula (Opcional)</label>
                <input
                  type="text"
                  placeholder="Auto: MAT-XXXX"
                  value={hireRegCode}
                  onChange={(e) => setHireRegCode(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Posto / Vaga Disponível ({vacantPositions.length}) *</label>
                <select
                  required
                  value={hirePositionId}
                  onChange={(e) => setHirePositionId(e.target.value)}
                  style={ui.select}
                >
                  <option value="">Selecione um posto vago...</option>
                  {vacantPositions.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.title} — {sectorsById[p.sectorId]?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Data de Admissão *</label>
                <input
                  type="date"
                  required
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Data-Âncora Última Folga</label>
                <input
                  type="date"
                  value={hireAnchorRest}
                  onChange={(e) => setHireAnchorRest(e.target.value)}
                  style={ui.input}
                />
              </div>
              <button type="submit" style={ui.btnPrimary}>
                Cadastrar & Alocar
              </button>
            </form>
          </div>

          {/* Tabela de Colaboradores com acesso direto à Central de Gestão */}
          <div style={ui.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={ui.cardTitle}>
                Quadro Nominal de Colaboradores — {showAllUnitsEmployees ? "Todas as Unidades" : selectedUnitId} ({filteredEmployees.length})
              </div>
              <input
                type="text"
                placeholder="🔍 Buscar por nome, matrícula ou observação..."
                value={searchEmp}
                onChange={(e) => setSearchEmp(e.target.value)}
                style={{ ...ui.input, width: 280 }}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={ui.table}>
                <thead>
                  <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                    <th style={ui.th}>Matrícula</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Colaborador</th>
                    <th style={ui.th}>Admissão</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Alocação Vigente (Posto / Setor)</th>
                    <th style={{ ...ui.th, textAlign: "left" }}>Jornada & Regra</th>
                    <th style={ui.th}>Situação Funcional</th>
                    <th style={ui.th}>Central de Gestão</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const empAllocs = db.allocations
                      .filter((a) => a.employeeId === emp.id)
                      .sort((a, b) => b.startDate.localeCompare(a.startDate));
                    const currentAlloc = empAllocs[0];
                    const pos = currentAlloc ? positionsById[currentAlloc.workPositionId] : null;
                    const sec = currentAlloc ? sectorsById[currentAlloc.sectorId] : null;
                    const shift = currentAlloc ? shiftsById[currentAlloc.workShiftId] : null;
                    const rule = currentAlloc ? rulesById[currentAlloc.scheduleRuleId] : null;
                    const dynStatus = computeDynamicEmploymentStatus({
                      employee: emp,
                      unavailabilityEvents: db.unavailabilityEvents,
                      referenceDate: activeReferenceDate,
                    });

                    return (
                      <tr key={emp.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ ...ui.td, textAlign: "center", fontFamily: "monospace", fontSize: 11 }}>
                          {emp.registrationCode}
                        </td>
                        <td style={ui.td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{emp.fullName}</span>
                            {emp.isSharedRateio && (
                              <span
                                style={{
                                  background: "#f3e8ff",
                                  color: "#6b21a8",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                }}
                              >
                                RATEIO ({(emp.authorizedUnitIds || []).join("/")})
                              </span>
                            )}
                          </div>
                          {emp.notes && (
                            <div style={{ fontSize: 10, color: "#64748b" }}>{emp.notes}</div>
                          )}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>
                          {emp.hireDate.split("-").reverse().join("/")}
                        </td>
                        <td style={ui.td}>
                          {pos ? (
                            <div>
                              <div style={{ fontWeight: 600, color: "#1e293b" }}>
                                [{pos.code}] {pos.title} ({currentAlloc.unitId})
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>
                                {sec?.name} · Vigência:{" "}
                                {currentAlloc.startDate.split("-").reverse().join("/")}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>
                              Sem posto ativo (Afastado/Desligado)
                            </span>
                          )}
                        </td>
                        <td style={{ ...ui.td, fontSize: 11 }}>
                          {shift ? (
                            <div>
                              <strong>{shift.shiftPeriod}</strong> ({shift.entryTime}–
                              {shift.effectiveExitTime}) ·{" "}
                              <span style={{ color: "#1d4ed8", fontWeight: 700 }}>{rule?.code}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ ...ui.td, textAlign: "center" }}>
                          <StatusBadge status={dynStatus} />
                        </td>
                        <td style={{ ...ui.td, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                              onClick={() => openCentralForEmployee(emp, "movement")}
                              style={{ ...ui.btnSmall, background: "var(--uniao-blue, #2B5690)", color: "#fff", borderColor: "var(--uniao-blue, #2B5690)" }}
                            >
                              ⚙️ Central / Promover
                            </button>
                            <button
                              onClick={() => openCentralForEmployee(emp, "history")}
                              style={ui.btnSmall}
                            >
                              📜 Histórico ({empAllocs.length})
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
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
        </>
      ) : (
        /* ABA DE FÉRIAS, AFASTAMENTOS E DISPONIBILIDADE (Seção 19) */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={ui.card}>
            <div style={ui.cardTitle}>
              {editingUnavId ? "✏️ Editar Evento de Férias / Afastamento" : "🏖️ Registrar Férias, Licença Maternidade, INSS ou Aviso Prévio"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              O registro ou remoção de férias/afastamentos recalcula automaticamente a situação funcional do colaborador e preserva a ocupação titular do posto de trabalho.
            </div>

            <form
              onSubmit={handleSaveUnavailability}
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
                  value={unavEmpId}
                  onChange={(e) => setUnavEmpId(e.target.value)}
                  style={ui.select}
                >
                  {db.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.registrationCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={ui.label}>Tipo de Evento</label>
                <select
                  value={unavType}
                  onChange={(e) => setUnavType(e.target.value)}
                  style={ui.select}
                >
                  <option value="VACATION">🌴 Férias Regulamentares</option>
                  <option value="MATERNITY_LEAVE">👶 Licença Maternidade</option>
                  <option value="MEDICAL_LEAVE">🏥 Afastamento Previdenciário (INSS)</option>
                  <option value="NOTICE_PERIOD">⚠️ Aviso Prévio / Desligamento Programado</option>
                </select>
              </div>
              <div>
                <label style={ui.label}>Data de Início</label>
                <input
                  type="date"
                  required
                  value={unavStart}
                  onChange={(e) => setUnavStart(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Data de Término</label>
                <input
                  type="date"
                  required
                  value={unavEnd}
                  onChange={(e) => setUnavEnd(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Observação</label>
                <input
                  type="text"
                  placeholder="Ex: Período aquisitivo 2025/2026"
                  value={unavNotes}
                  onChange={(e) => setUnavNotes(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit" style={ui.btnPrimary}>
                  {editingUnavId ? "Salvar Alteração" : "Registrar Evento"}
                </button>
                {editingUnavId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUnavId(null);
                      setUnavNotes("");
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
              Eventos de Indisponibilidade e Afastamentos Registrados ({db.unavailabilityEvents.length})
            </div>
            <table style={ui.table}>
              <thead>
                <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                  <th style={{ ...ui.th, textAlign: "left" }}>Colaborador</th>
                  <th style={ui.th}>Tipo de Evento</th>
                  <th style={ui.th}>Período</th>
                  <th style={{ ...ui.th, textAlign: "left" }}>Observações</th>
                  <th style={ui.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {db.unavailabilityEvents.map((ev) => {
                  const emp = db.employees.find((x) => x.id === ev.employeeId);
                  return (
                    <tr key={ev.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ ...ui.td, fontWeight: 700 }}>{emp?.fullName || ev.employeeId}</td>
                      <td style={{ ...ui.td, textAlign: "center" }}>
                        {ev.eventType === "VACATION"
                          ? "🌴 Férias"
                          : ev.eventType === "MEDICAL_LEAVE"
                            ? "🏥 Afastamento INSS"
                            : ev.eventType === "MATERNITY_LEAVE"
                              ? "👶 Licença Maternidade"
                              : "⚠️ Aviso Prévio"}
                      </td>
                      <td style={{ ...ui.td, textAlign: "center", fontWeight: 600 }}>
                        {ev.startDate.split("-").reverse().join("/")} até{" "}
                        {ev.endDate.split("-").reverse().join("/")}
                      </td>
                      <td style={{ ...ui.td, fontSize: 11, color: "#475569" }}>
                        {ev.notes || "—"}
                      </td>
                      <td style={{ ...ui.td, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => {
                              setEditingUnavId(ev.id);
                              setUnavEmpId(ev.employeeId);
                              setUnavType(ev.eventType);
                              setUnavStart(ev.startDate);
                              setUnavEnd(ev.endDate);
                              setUnavNotes(ev.notes || "");
                            }}
                            style={ui.btnSmall}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleRemoveUnavailability(ev.id)}
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

      {/* MODAL UNIFICADO: CENTRAL DE GESTÃO DO COLABORADOR (Seções 17 e 18) */}
      {centralEmp && editEmpForm && (
        <div style={ui.modalBackdrop}>
          <div style={{ ...ui.modalCard, width: 680 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                  ⚙️ Central de Gestão do Colaborador — {centralEmp.fullName}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b" }}>
                  Matrícula: {centralEmp.registrationCode} · Admissão: {centralEmp.hireDate.split("-").reverse().join("/")}
                </div>
              </div>
              <button
                onClick={() => setCentralEmpId(null)}
                style={{ ...ui.btnSmall, fontWeight: 800 }}
              >
                ✕ Fechar
              </button>
            </div>

            {/* Abas internas da Central do Colaborador */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid #cbd5e1", paddingBottom: 8, flexWrap: "wrap" }}>
              {[
                ["profile", "1. Dados Cadastrais & Ciclo"],
                ["movement", "2. Promoção / Mudança de Cargo, Horário ou Regra"],
                ["rateio", "3. Rateio Multiunidade (Lojas)"],
                ["history", "4. Linha do Tempo Histórica"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCentralTab(id)}
                  style={centralTab === id ? ui.subTabActive : ui.subTab}
                >
                  {label}
                </button>
              ))}
            </div>

            {centralTab === "profile" && (
              <form
                onSubmit={handleSaveEmployeeProfileAndRateio}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
              >
                <div>
                  <label style={ui.label}>Nome Completo *</label>
                  <input
                    value={editEmpForm.fullName}
                    onChange={(e) => setEditEmpForm({ ...editEmpForm, fullName: e.target.value })}
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={ui.label}>Matrícula</label>
                  <input
                    value={editEmpForm.registrationCode}
                    onChange={(e) =>
                      setEditEmpForm({ ...editEmpForm, registrationCode: e.target.value })
                    }
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={ui.label}>Data de Admissão</label>
                  <input
                    type="date"
                    value={editEmpForm.hireDate}
                    onChange={(e) => setEditEmpForm({ ...editEmpForm, hireDate: e.target.value })}
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={ui.label}>Data-Âncora da Última Folga (Continuidade 5x1)</label>
                  <input
                    type="date"
                    value={editEmpForm.anchorLastRestDate}
                    onChange={(e) =>
                      setEditEmpForm({ ...editEmpForm, anchorLastRestDate: e.target.value })
                    }
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={ui.label}>Data Final de Aviso Prévio (Opcional)</label>
                  <input
                    type="date"
                    value={editEmpForm.noticePeriodEndDate}
                    onChange={(e) =>
                      setEditEmpForm({ ...editEmpForm, noticePeriodEndDate: e.target.value })
                    }
                    style={ui.input}
                  />
                </div>
                <div>
                  <label style={ui.label}>Data de Desligamento (Opcional)</label>
                  <input
                    type="date"
                    value={editEmpForm.terminationDate}
                    onChange={(e) =>
                      setEditEmpForm({ ...editEmpForm, terminationDate: e.target.value })
                    }
                    style={ui.input}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={ui.label}>Observações Administrativas</label>
                  <textarea
                    rows={2}
                    value={editEmpForm.notes}
                    onChange={(e) => setEditEmpForm({ ...editEmpForm, notes: e.target.value })}
                    style={ui.input}
                  />
                </div>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleDeleteEmployee(centralEmp)}
                    style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                  >
                    🗑️ Excluir Colaborador
                  </button>
                  <button type="submit" style={ui.btnPrimary}>
                    💾 Salvar Dados Cadastrais
                  </button>
                </div>
              </form>
            )}

            {centralTab === "movement" && (
              <form
                onSubmit={handleExecuteGuidedMovement}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* Comparativo Situação Atual vs Proposta */}
                {(() => {
                  const curAlloc = db.allocations
                    .filter((a) => a.employeeId === centralEmp.id)
                    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
                  const curPos = curAlloc ? positionsById[curAlloc.workPositionId] : null;
                  const curShift = curAlloc ? shiftsById[curAlloc.workShiftId] : null;
                  const curRule = curAlloc ? rulesById[curAlloc.scheduleRuleId] : null;

                  return (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                        📌 Alocação Vigente Atual:
                      </div>
                      <div>
                        Posto: <strong>{curPos ? `[${curPos.code}] ${curPos.title}` : "Sem posto"}</strong> ·
                        Unidade: <strong>{curAlloc?.unitId || "—"}</strong> ·
                        Jornada: <strong>{curShift?.name || "—"}</strong> ·
                        Regra: <strong>{curRule?.code || "—"}</strong>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label style={ui.label}>Passo 1: Modalidade da Movimentação</label>
                  <select
                    value={movType}
                    onChange={(e) => setMovType(e.target.value)}
                    style={ui.select}
                  >
                    <option value="PROMOTION_TRANSFER">
                      Promover ou Transferir para uma Vaga / Posto Disponível
                    </option>
                    <option value="SAME_POS_SHIFT_RULE">
                      Manter no Mesmo Posto e Alterar Horário (Jornada) ou Regra de Escala
                    </option>
                    <option value="CREATE_NEW_POS">
                      Promover / Transferir Criando um Novo Posto Automaticamente Agora
                    </option>
                  </select>
                </div>

                {movType === "PROMOTION_TRANSFER" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                    <div>
                      <label style={ui.label}>Unidade de Destino</label>
                      <select
                        value={movTargetUnitId}
                        onChange={(e) => setMovTargetUnitId(e.target.value)}
                        style={ui.select}
                      >
                        {db.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={ui.label}>
                        Posto Vago de Destino ({vacantPositionsInTargetUnit.length} disponíveis)
                      </label>
                      <select
                        value={movPositionId}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setMovPositionId(pId);
                          const p = positionsById[pId];
                          if (p?.defaultShiftId) setMovShiftId(p.defaultShiftId);
                          if (p?.defaultRuleId) setMovRuleId(p.defaultRuleId);
                        }}
                        style={ui.select}
                      >
                        <option value="">Selecione o posto...</option>
                        {vacantPositionsInTargetUnit.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.title} ({sectorsById[p.sectorId]?.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {movType === "CREATE_NEW_POS" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={ui.label}>Unidade do Novo Posto</label>
                      <select
                        value={movTargetUnitId}
                        onChange={(e) => setMovTargetUnitId(e.target.value)}
                        style={ui.select}
                      >
                        {db.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={ui.label}>Setor de Destino</label>
                      <select
                        value={movNewSectorId}
                        onChange={(e) => setMovNewSectorId(e.target.value)}
                        style={ui.select}
                      >
                        {db.sectors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={ui.label}>Nova Função / Cargo</label>
                      <select
                        value={movNewRoleId}
                        onChange={(e) => setMovNewRoleId(e.target.value)}
                        style={ui.select}
                      >
                        {db.roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={ui.label}>Passo 2: Nova Jornada Contratual (Horário)</label>
                    <select
                      value={movShiftId}
                      onChange={(e) => setMovShiftId(e.target.value)}
                      style={ui.select}
                    >
                      {db.workShifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          [{sh.shiftPeriod}] {sh.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={ui.label}>Passo 3: Nova Regra de Escala</label>
                    <select
                      value={movRuleId}
                      onChange={(e) => setMovRuleId(e.target.value)}
                      style={ui.select}
                    >
                      {db.scheduleRules.map((rl) => (
                        <option key={rl.id} value={rl.id}>
                          {rl.code} — {rl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                  <div>
                    <label style={ui.label}>Passo 4: Data de Início da Vigência *</label>
                    <input
                      type="date"
                      required
                      value={movStartDate}
                      onChange={(e) => setMovStartDate(e.target.value)}
                      style={ui.input}
                    />
                  </div>
                  <div>
                    <label style={ui.label}>Motivo / Justificativa para Auditoria *</label>
                    <input
                      type="text"
                      required
                      value={movReason}
                      onChange={(e) => setMovReason(e.target.value)}
                      style={ui.input}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button type="submit" style={ui.btnPrimary}>
                    ✅ Confirmar Movimentação com Preservação Histórica
                  </button>
                </div>
              </form>
            )}

            {centralTab === "rateio" && (
              <form
                onSubmit={handleSaveEmployeeProfileAndRateio}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{
                    background: "#faf5ff",
                    border: "1px solid #d8b4fe",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 11.5,
                    color: "#581c87",
                  }}
                >
                  🔗 <strong>Gestão de Colaboradores Compartilhados (RATEIO Multiunidade):</strong>{" "}
                  O rateio serve exclusivamente para que o colaborador conste nas lojas em que é rateado. A agenda de rateio abaixo é apenas informativa e não bloqueia nem gera impedimentos na escala mensal.
                </div>

                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editEmpForm.isSharedRateio)}
                      onChange={(e) =>
                        setEditEmpForm({ ...editEmpForm, isSharedRateio: e.target.checked })
                      }
                    />
                    Ativar Regime RATEIO (Compartilhado entre Lojas)
                  </label>

                  <div>
                    <label style={ui.label}>Unidade Principal Administrativa</label>
                    <select
                      value={editEmpForm.homeUnitId}
                      onChange={(e) =>
                        setEditEmpForm({ ...editEmpForm, homeUnitId: e.target.value })
                      }
                      style={{ ...ui.select, width: 170 }}
                    >
                      {db.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {editEmpForm.isSharedRateio && (
                  <>
                    <div>
                      <label style={ui.label}>Lojas Autorizadas para Atuação em Rateio</label>
                      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        {db.units.map((u) => (
                          <label key={u.id} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                            <input
                              type="checkbox"
                              checked={(editEmpForm.authorizedUnitIds || []).includes(u.id)}
                              onChange={() => {
                                const cur = editEmpForm.authorizedUnitIds || [];
                                const next = cur.includes(u.id)
                                  ? cur.filter((x) => x !== u.id)
                                  : [...cur, u.id];
                                setEditEmpForm({ ...editEmpForm, authorizedUnitIds: next });
                              }}
                            />
                            {u.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={ui.label}>Distribuição Semanal de Atuação por Loja e Período</label>
                      <table style={ui.table}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ ...ui.th, textAlign: "left" }}>Dia da Semana</th>
                            <th style={ui.th}>Unidade (Loja) de Atuação</th>
                            <th style={ui.th}>Período</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DOW_LABELS.map(([dowKey, dowName]) => {
                            const cfg = editEmpForm.rateioScheduleByDow?.[dowKey] || {
                              unitId: "LOJA_03",
                              period: "INTEGRAL",
                            };
                            return (
                              <tr key={dowKey}>
                                <td style={{ ...ui.td, fontWeight: 700 }}>{dowName}</td>
                                <td style={ui.td}>
                                  <select
                                    value={cfg.unitId}
                                    onChange={(e) =>
                                      setEditEmpForm({
                                        ...editEmpForm,
                                        rateioScheduleByDow: {
                                          ...editEmpForm.rateioScheduleByDow,
                                          [dowKey]: { ...cfg, unitId: e.target.value },
                                        },
                                      })
                                    }
                                    style={ui.select}
                                  >
                                    {db.units.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}
                                      </option>
                                    ))}
                                    <option value="FOLGA">Descanso Semanal (Folga)</option>
                                  </select>
                                </td>
                                <td style={ui.td}>
                                  <select
                                    value={cfg.period}
                                    onChange={(e) =>
                                      setEditEmpForm({
                                        ...editEmpForm,
                                        rateioScheduleByDow: {
                                          ...editEmpForm.rateioScheduleByDow,
                                          [dowKey]: { ...cfg, period: e.target.value },
                                        },
                                      })
                                    }
                                    style={ui.select}
                                  >
                                    <option value="INTEGRAL">Dia Integral</option>
                                    <option value="MANHÃ">Turno Manhã</option>
                                    <option value="TARDE">Turno Tarde</option>
                                    <option value="FOLGA">Folga</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" style={ui.btnPrimary}>
                    💾 Salvar Configuração de Rateio Multiunidade
                  </button>
                </div>
              </form>
            )}

            {centralTab === "history" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 350, overflowY: "auto" }}>
                {db.allocations
                  .filter((a) => a.employeeId === centralEmp.id)
                  .sort((a, b) => b.startDate.localeCompare(a.startDate))
                  .map((a) => {
                    const pos = positionsById[a.workPositionId];
                    const sec = sectorsById[a.sectorId];
                    const role = rolesById[a.roleId];
                    const sh = shiftsById[a.workShiftId];
                    const rl = rulesById[a.scheduleRuleId];
                    return (
                      <div
                        key={a.id}
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          padding: "10px 12px",
                          background: a.endDate ? "#f8fafc" : "#f0fdf4",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a" }}>
                            [{pos?.code || "—"}] {pos?.title || a.workPositionId} — {sec?.name} ({role?.name}) ·{" "}
                            <span style={{ color: "#0284c7" }}>{a.unitId}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAllocation(a)}
                            style={{ ...ui.btnSmall, color: "#991b1b", borderColor: "#fca5a5" }}
                          >
                            🗑️ Excluir Alocação
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: "#334155", marginTop: 3 }}>
                          Jornada: <strong>{sh?.name || "—"}</strong> · Regra:{" "}
                          <strong>{rl?.code || "—"}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                          Vigência: <strong>{a.startDate.split("-").reverse().join("/")}</strong> até{" "}
                          <strong>
                            {a.endDate ? a.endDate.split("-").reverse().join("/") : "Vigente (Atual)"}
                          </strong>
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          Motivo: {a.transferReason || "Alocação regular"}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: { label: "Ativo", bg: "#dcfce7", color: "#166534" },
    ON_VACATION: { label: "Em Férias", bg: "#e0f2fe", color: "#0369a1" },
    MATERNITY_LEAVE: { label: "Lic. Maternidade", bg: "#fae8ff", color: "#86198f" },
    MEDICAL_LEAVE: { label: "Afastado INSS", bg: "#fef3c7", color: "#b45309" },
    NOTICE_PERIOD: { label: "Aviso Prévio", bg: "#fee2e2", color: "#991b1b" },
    TERMINATED: { label: "Desligado", bg: "#f1f5f9", color: "#475569" },
  };
  const m = map[status] || map.ACTIVE;
  return (
    <span
      style={{
        background: m.bg,
        color: m.color,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
      }}
    >
      {m.label}
    </span>
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
