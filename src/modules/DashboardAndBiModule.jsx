// =============================================================================
// DASHBOARD EXECUTIVO, POSIÇÃO DO QUADRO NA DATA E INTELIGÊNCIA ANALÍTICA POR
// PERÍODOS FLEXÍVEIS (DIA, SEMANA 1..5, QUINZENA, MÊS E INTERVALO LIVRE — v8.0)
// =============================================================================

import { useState, useMemo } from "react";
import {
  computeWorkforceAnalytics,
  computeFlexiblePeriodAnalytics,
  listDatesInYearMonth,
  getDayOfWeekISO,
  DIAS_SEMANA_CURTO,
  FAIXAS_ALMOCO_DOMINGO,
} from "../domain/scheduleEngine.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";

export default function DashboardAndBiModule({
  db,
  selectedUnitId,
  selectedYearMonth,
  setSelectedYearMonth,
  onNavigate,
}) {
  // Data para "Posição do Quadro na Data" (Fotografia exata — Seção 22)
  const [referenceDate, setReferenceDate] = useState(() => `${selectedYearMonth}-10`);

  // Modo de Período Flexível da Inteligência Analítica (Seções 23 e 24)
  const [periodMode, setPeriodMode] = useState("WEEK"); // 'DAY' | 'WEEK' | 'FORTNIGHT' | 'MONTH' | 'CUSTOM'
  const [selectedDayDate, setSelectedDayDate] = useState(() => `${selectedYearMonth}-10`);
  const [queryWeekNum, setQueryWeekNum] = useState(2); // 1..5 (inclui dias 29..31!)
  const [queryFortnight, setQueryFortnight] = useState(1); // 1 (01-15) | 2 (16-fim)
  const [customStartDate, setCustomStartDate] = useState("2026-10-25");
  const [customEndDate, setCustomEndDate] = useState("2026-11-05");

  // Filtros dimensionais da Inteligência Analítica
  const [querySectorId, setQuerySectorId] = useState("ALL");
  const [queryRoleId, setQueryRoleId] = useState("ALL");
  const [queryShiftPeriod, setQueryShiftPeriod] = useState("ALL");
  const [showDrilldownRecords, setShowDrilldownRecords] = useState(false);

  const activeRefDate = useMemo(() => {
    if (referenceDate.startsWith(selectedYearMonth)) return referenceDate;
    return `${selectedYearMonth}-10`;
  }, [referenceDate, selectedYearMonth]);

  const sectorsById = useMemo(
    () => Object.fromEntries(db.sectors.map((s) => [s.id, s])),
    [db.sectors]
  );
  const rolesById = useMemo(
    () => Object.fromEntries(db.roles.map((r) => [r.id, r])),
    [db.roles]
  );
  const shiftsById = useMemo(
    () => Object.fromEntries(db.workShifts.map((s) => [s.id, s])),
    [db.workShifts]
  );
  const selectedUnitLabel = useMemo(() => {
    const u = (db.units || []).find((item) => item.id === selectedUnitId);
    return u?.name || u?.code || selectedUnitId || "Unidade";
  }, [db.units, selectedUnitId]);

  const monthEntries = useMemo(
    () => db.dailyEntriesByMonth[selectedYearMonth] || [],
    [db.dailyEntriesByMonth, selectedYearMonth]
  );

  // 1. Cálculo de Posição do Quadro na Data vs Fluxo do Mês
  const bi = useMemo(
    () =>
      computeWorkforceAnalytics({
        unitId: selectedUnitId,
        referenceDate: activeRefDate,
        yearMonth: selectedYearMonth,
        workPositions: db.workPositions,
        employees: db.employees,
        allocations: db.allocations,
        unavailabilityEvents: db.unavailabilityEvents,
        monthEntries,
        sectorsById,
        rolesById,
      }),
    [
      selectedUnitId,
      activeRefDate,
      selectedYearMonth,
      db.workPositions,
      db.employees,
      db.allocations,
      db.unavailabilityEvents,
      monthEntries,
      sectorsById,
      rolesById,
    ]
  );

  // 2. Resolução do Intervalo [startDate, endDate] conforme o Modo de Período escolhido
  const resolvedPeriodRange = useMemo(() => {
    const datesInMonth = listDatesInYearMonth(selectedYearMonth);
    const lastDayStr = datesInMonth[datesInMonth.length - 1];

    if (periodMode === "DAY") {
      const d = selectedDayDate.startsWith(selectedYearMonth)
        ? selectedDayDate
        : activeRefDate;
      return { startDate: d, endDate: d, label: `Dia Específico (${d.split("-").reverse().join("/")})` };
    }
    if (periodMode === "WEEK") {
      if (queryWeekNum === 1) {
        return { startDate: `${selectedYearMonth}-01`, endDate: `${selectedYearMonth}-07`, label: `1ª Semana (01 a 07/${selectedYearMonth.slice(5, 7)})` };
      }
      if (queryWeekNum === 2) {
        return { startDate: `${selectedYearMonth}-08`, endDate: `${selectedYearMonth}-14`, label: `2ª Semana (08 a 14/${selectedYearMonth.slice(5, 7)})` };
      }
      if (queryWeekNum === 3) {
        return { startDate: `${selectedYearMonth}-15`, endDate: `${selectedYearMonth}-21`, label: `3ª Semana (15 a 21/${selectedYearMonth.slice(5, 7)})` };
      }
      if (queryWeekNum === 4) {
        return { startDate: `${selectedYearMonth}-22`, endDate: `${selectedYearMonth}-28`, label: `4ª Semana (22 a 28/${selectedYearMonth.slice(5, 7)})` };
      }
      const start29 = datesInMonth.find((d) => d.endsWith("-29")) || lastDayStr;
      return {
        startDate: start29,
        endDate: lastDayStr,
        label: `5ª Semana / Fim do Mês (${start29.slice(8, 10)} a ${lastDayStr.slice(8, 10)}/${selectedYearMonth.slice(5, 7)})`,
      };
    }
    if (periodMode === "FORTNIGHT") {
      if (queryFortnight === 1) {
        return {
          startDate: `${selectedYearMonth}-01`,
          endDate: `${selectedYearMonth}-15`,
          label: `1ª Quinzena (01 a 15/${selectedYearMonth.slice(5, 7)})`,
        };
      }
      return {
        startDate: `${selectedYearMonth}-16`,
        endDate: lastDayStr,
        label: `2ª Quinzena (16 a ${lastDayStr.slice(8, 10)}/${selectedYearMonth.slice(5, 7)})`,
      };
    }
    if (periodMode === "MONTH") {
      return {
        startDate: `${selectedYearMonth}-01`,
        endDate: lastDayStr,
        label: `Mês Completo (${selectedYearMonth})`,
      };
    }
    // CUSTOM
    const s = customStartDate <= customEndDate ? customStartDate : customEndDate;
    const e = customEndDate >= customStartDate ? customEndDate : customStartDate;
    return {
      startDate: s,
      endDate: e,
      label: `Intervalo Personalizado (${s.split("-").reverse().join("/")} até ${e.split("-").reverse().join("/")})`,
    };
  }, [
    periodMode,
    selectedYearMonth,
    selectedDayDate,
    activeRefDate,
    queryWeekNum,
    queryFortnight,
    customStartDate,
    customEndDate,
  ]);

  // 3. Motor Analítico de Período Flexível
  const flexAnalytics = useMemo(
    () =>
      computeFlexiblePeriodAnalytics({
        unitId: selectedUnitId,
        startDate: resolvedPeriodRange.startDate,
        endDate: resolvedPeriodRange.endDate,
        sectorFilter: querySectorId,
        roleFilter: queryRoleId,
        shiftPeriodFilter: queryShiftPeriod,
        dailyEntriesByMonth: db.dailyEntriesByMonth,
        employees: db.employees,
        allocations: db.allocations,
        workPositions: db.workPositions,
        sectorsById,
        unitSectors: db.unitSectors,
        rolesById,
        shiftsById,
        marketCalendarDays: db.marketCalendarDays,
      }),
    [
      selectedUnitId,
      resolvedPeriodRange,
      querySectorId,
      queryRoleId,
      queryShiftPeriod,
      db.dailyEntriesByMonth,
      db.employees,
      db.allocations,
      db.workPositions,
      sectorsById,
      db.unitSectors,
      rolesById,
      shiftsById,
      db.marketCalendarDays,
    ]
  );

  // Distribuição de almoço de domingo na data de referência ou próximo domingo
  const sundayLunchStats = useMemo(() => {
    const dates = listDatesInYearMonth(selectedYearMonth);
    const sundaysInMonth = dates.filter((d) => getDayOfWeekISO(d) === 0);
    const targetSunday =
      sundaysInMonth.find((d) => d >= activeRefDate) || sundaysInMonth[0] || activeRefDate;
    const sundayEntries = monthEntries.filter(
      (e) =>
        (!selectedUnitId || e.unitId === selectedUnitId) &&
        e.workDate === targetSunday &&
        (e.status === "T" || e.status === "MEIO_EXP")
    );
    const lunchDistribution = { "1": 0, "2": 0, "3": 0, "4": 0 };
    sundayEntries.forEach((e) => {
      if (e.lunchSlot && lunchDistribution[e.lunchSlot] !== undefined) {
        lunchDistribution[e.lunchSlot] += 1;
      }
    });
    return {
      targetSunday,
      sundayWorkingTotal: sundayEntries.length,
      lunchDistribution,
    };
  }, [selectedYearMonth, activeRefDate, monthEntries, selectedUnitId]);

  const { totals } = bi;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Cabeçalho: Posição do Quadro na Data (Fotografia) vs Competência */}
      <div style={ui.card}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--uniao-text-primary, #142B4D)" }}>
              Painel Executivo de Quadro de Pessoal, Escalas e Inteligência Analítica
            </div>
            <div style={{ fontSize: 12, color: "var(--uniao-text-secondary, #475569)", marginTop: 3 }}>
              📸 <strong>Posição do Quadro na Data ({activeRefDate.split("-").reverse().join("/")}):</strong>{" "}
              Fotografia exata de vagas preenchidas, colaboradores disponíveis, em férias e trabalhando nesse dia específico, combinada ao fluxo da competência <strong>{selectedYearMonth}</strong>.
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <div>
              <label style={ui.label}>Competência Base</label>
              <input
                type="month"
                value={selectedYearMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedYearMonth(e.target.value);
                    setReferenceDate(`${e.target.value}-10`);
                    setSelectedDayDate(`${e.target.value}-10`);
                  }
                }}
                style={ui.input}
              />
            </div>

            <div>
              <label style={ui.label} title="Fotografia do quadro de colaboradores nesta data">
                📸 Posição do Quadro na Data
              </label>
              <input
                type="date"
                value={activeRefDate}
                min={`${selectedYearMonth}-01`}
                max={`${selectedYearMonth}-${listDatesInYearMonth(selectedYearMonth).length}`}
                onChange={(e) => e.target.value && setReferenceDate(e.target.value)}
                style={ui.input}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Executivos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          title="Postos Planejados (Quadro Próprio)"
          value={totals.plannedOwnPositions}
          subtitle={`+ ${totals.plannedRateioPositions} postos de Rateio (${totals.filledRateioPositions} preenchidos)`}
          color="#2B5690"
          bg="var(--uniao-surface-subtle, #f8fafc)"
        />
        <KpiCard
          title="Postos Preenchidos"
          value={totals.filledOwnPositions}
          subtitle={`Taxa de Ocupação: ${totals.occupancyRate}% (inclui titulares em férias)`}
          color="#166534"
          bg="#f0fdf4"
        />
        <KpiCard
          title="Postos Vagos (Sem Ocupante)"
          value={totals.vacantPositions}
          subtitle={`${totals.openAuthorizedPositions} autorizadas · ${totals.frozenPositions} congeladas · ${totals.openUnplannedPositions} não autorizadas`}
          color="#b45309"
          bg="#fffbeb"
        />
        <KpiCard
          title={`Disponíveis em ${activeRefDate.slice(8, 10)}/${activeRefDate.slice(5, 7)}`}
          value={totals.availableOnRefDate}
          subtitle={`${totals.onVacationOnRefDate} em férias na data · ${totals.onLeaveOnRefDate} afastado(s) INSS/LM`}
          color="#2B5690"
          bg="#EBF2FA"
        />
        <KpiCard
          title={`Escalados Trabalhando (${activeRefDate.slice(8, 10)}/${activeRefDate.slice(5, 7)})`}
          value={totals.scheduledWorkingOnRefDate}
          subtitle={`De ${totals.availableOnRefDate} disponíveis na operação`}
          color="#047857"
          bg="#ecfdf5"
        />
        <KpiCard
          title="Contratações Autorizadas"
          value={totals.openAuthorizedPositions}
          subtitle={
            totals.hasCostData
              ? `Custo Quadro Preenchido: R$ ${totals.estimatedFilledCost.toLocaleString("pt-BR")}`
              : "Orçamento salarial: não apurado (sem dados fictícios)"
          }
          color="#E9403C"
          bg="#FEF2F2"
        />
      </div>

      {/* CENTRAL DE INTELIGÊNCIA ANALÍTICA POR PERÍODOS FLEXÍVEIS (Seções 23 e 24) */}
      <div style={ui.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={ui.cardTitle}>
              🔎 Inteligência Analítica Operacional por Período Flexível
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>
              Consulte indicadores por <strong>Dia</strong>, <strong>Semana (1ª a 5ª)</strong>,{" "}
              <strong>Quinzena</strong>, <strong>Mês Completo</strong> ou{" "}
              <strong>Intervalo Personalizado (`De` → `Até`)</strong>, diferenciando Pessoas Únicas de Pessoas-Dia.
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              ["DAY", "Dia Específico"],
              ["WEEK", "Semana (1ª a 5ª)"],
              ["FORTNIGHT", "Quinzena (1ª / 2ª)"],
              ["MONTH", "Mês Inteiro"],
              ["CUSTOM", "Intervalo Personalizado"],
            ].map(([m, lbl]) => (
              <button
                key={m}
                onClick={() => setPeriodMode(m)}
                style={periodMode === m ? ui.pillActive : ui.pill}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de Parâmetros do Período + Filtros de Setor, Função e Turno */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "end",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 14,
          }}
        >
          {periodMode === "DAY" && (
            <div>
              <label style={ui.label}>Dia da Consulta</label>
              <input
                type="date"
                value={selectedDayDate}
                onChange={(e) => e.target.value && setSelectedDayDate(e.target.value)}
                style={ui.input}
              />
            </div>
          )}

          {periodMode === "WEEK" && (
            <div>
              <label style={ui.label}>Semana de {selectedYearMonth}</label>
              <select
                value={queryWeekNum}
                onChange={(e) => setQueryWeekNum(Number(e.target.value))}
                style={ui.select}
              >
                <option value={1}>1ª Semana (Dias 01 a 07)</option>
                <option value={2}>2ª Semana (Dias 08 a 14)</option>
                <option value={3}>3ª Semana (Dias 15 a 21)</option>
                <option value={4}>4ª Semana (Dias 22 a 28)</option>
                <option value={5}>5ª Semana / Final do Mês (Dias 29 a 30/31)</option>
              </select>
            </div>
          )}

          {periodMode === "FORTNIGHT" && (
            <div>
              <label style={ui.label}>Quinzena de {selectedYearMonth}</label>
              <select
                value={queryFortnight}
                onChange={(e) => setQueryFortnight(Number(e.target.value))}
                style={ui.select}
              >
                <option value={1}>1ª Quinzena (Dias 01 a 15)</option>
                <option value={2}>2ª Quinzena (Dias 16 ao fim do mês)</option>
              </select>
            </div>
          )}

          {periodMode === "CUSTOM" && (
            <>
              <div>
                <label style={ui.label}>Data Inicial (De)</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => e.target.value && setCustomStartDate(e.target.value)}
                  style={ui.input}
                />
              </div>
              <div>
                <label style={ui.label}>Data Final (Até)</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => e.target.value && setCustomEndDate(e.target.value)}
                  style={ui.input}
                />
              </div>
            </>
          )}

          <div>
            <label style={ui.label}>Filtrar Setor</label>
            <select
              value={querySectorId}
              onChange={(e) => setQuerySectorId(e.target.value)}
              style={ui.select}
            >
              <option value="ALL">Todos os Setores</option>
              {db.sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={ui.label}>Filtrar Função</label>
            <select
              value={queryRoleId}
              onChange={(e) => setQueryRoleId(e.target.value)}
              style={ui.select}
            >
              <option value="ALL">Todas as Funções</option>
              {db.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={ui.label}>Filtrar Turno</label>
            <select
              value={queryShiftPeriod}
              onChange={(e) => setQueryShiftPeriod(e.target.value)}
              style={ui.select}
            >
              <option value="ALL">Todos os Turnos</option>
              <option value="MANHÃ">MANHÃ</option>
              <option value="TARDE">TARDE</option>
            </select>
          </div>
        </div>

        {/* Resumo Quantitativo do Período: Pessoas Únicas vs Pessoas-Dia */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div style={ui.qaBox}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534" }}>
              🟢 TRABALHANDO NO PERÍODO ({flexAnalytics.totalDaysInPeriod} dia(s))
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d", marginTop: 3 }}>
              {flexAnalytics.uniqueEmployees.working} pessoa(s) única(s)
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Total de <strong>{flexAnalytics.personDays.working}</strong> diárias trabalhadas (
              {flexAnalytics.personDays.halfDay} em meio expediente)
            </div>
          </div>

          <div style={ui.qaBox}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af" }}>
              🔵 EM FOLGA NO PERÍODO
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8", marginTop: 3 }}>
              {flexAnalytics.uniqueEmployees.resting} pessoa(s) única(s)
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Total de <strong>{flexAnalytics.personDays.resting}</strong> folgas concedidas no intervalo
            </div>
          </div>

          <div style={ui.qaBox}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#c2410c" }}>
              🏖️ EM FÉRIAS / AFASTAMENTO NO PERÍODO
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#c2410c", marginTop: 3 }}>
              {flexAnalytics.uniqueEmployees.onVacation + flexAnalytics.uniqueEmployees.onLeave} pessoa(s)
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              {flexAnalytics.personDays.onVacation} dias de férias · {flexAnalytics.personDays.onLeave} dias INSS/LM
            </div>
          </div>

          <div style={ui.qaBox}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b" }}>
              ⚠️ DIAS COM COBERTURA ABAIXO DO MÍNIMO
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#991b1b", marginTop: 3 }}>
              {flexAnalytics.insufficientCoverageDays.length} ocorrência(s)
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              Período: <strong>{resolvedPeriodRange.label}</strong>
            </div>
          </div>
        </div>

        {/* Linha do Tempo Diária dentro do Período Selecionado */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            📅 Curva Diária de Disponibilidade e Folgas — {resolvedPeriodRange.label}:
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {flexAnalytics.dailyTimeline.map((d) => {
              const hasDeficit = d.deficits.length > 0;
              return (
                <div
                  key={d.workDate}
                  style={{
                    background: hasDeficit ? "#fff1f2" : "#ffffff",
                    border: `1px solid ${hasDeficit ? "#fda4af" : "#cbd5e1"}`,
                    borderRadius: 6,
                    padding: "6px 9px",
                    fontSize: 11,
                    minWidth: 105,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    {d.workDate.slice(8, 10)}/{d.workDate.slice(5, 7)} ({DIAS_SEMANA_CURTO[d.dow]})
                  </div>
                  <div style={{ color: "#15803d", fontWeight: 700, marginTop: 2 }}>
                    🟢 {d.workingCount} trab.
                  </div>
                  <div style={{ color: "#1d4ed8", fontSize: 10.5 }}>
                    🔵 {d.restCount} folga · 🏖️ {d.vacationCount} fér.
                  </div>
                  {hasDeficit && (
                    <div style={{ color: "#be123c", fontSize: 10, fontWeight: 700, marginTop: 2 }}>
                      ⚠ {d.deficits.length} setor(es) c/ déficit
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribuição da Escala de Almoço no Domingo + Botão Drill-Down */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            paddingTop: 10,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 11.5, color: "#334155" }}>
            🍽️ <strong>Escala de Almoço Domingo ({sundayLunchStats.targetSunday.split("-").reverse().join("/")}):</strong>{" "}
            Total trabalhando = <strong>{sundayLunchStats.sundayWorkingTotal}</strong> (
            {Object.entries(FAIXAS_ALMOCO_DOMINGO)
              .map(([k, info]) => `${info.codigo}: ${sundayLunchStats.lunchDistribution[k] || 0}`)
              .join(" · ")}
            )
          </div>

          <button
            onClick={() => setShowDrilldownRecords((p) => !p)}
            style={ui.btnSecondary}
          >
            {showDrilldownRecords
              ? "▲ Ocultar Registros Nominais do Período"
              : `▼ Inspecionar Registros Nominais do Período (${flexAnalytics.records.length} lançamentos)`}
          </button>
        </div>

        {showDrilldownRecords && (
          <div style={{ marginTop: 12, maxHeight: 300, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={ui.table}>
              <thead>
                <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                  <th style={ui.th}>Data</th>
                  <th style={{ ...ui.th, textAlign: "left" }}>Colaborador</th>
                  <th style={{ ...ui.th, textAlign: "left" }}>Setor / Função</th>
                  <th style={ui.th}>Turno</th>
                  <th style={ui.th}>Status</th>
                  <th style={ui.th}>Almoço Dom/Fer</th>
                </tr>
              </thead>
              <tbody>
                {flexAnalytics.records.slice(0, 250).map((r, idx) => (
                  <tr key={`${r.employeeId}_${r.workDate}_${idx}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 700 }}>
                      {r.workDate.split("-").reverse().join("/")}
                    </td>
                    <td style={{ ...ui.td, fontWeight: 700 }}>{r.employeeName}</td>
                    <td style={{ ...ui.td, fontSize: 11 }}>
                      {r.sectorName} · <span style={{ color: "#64748b" }}>{r.roleName}</span>
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>{r.shiftPeriod}</td>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 800 }}>{r.status}</td>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>
                      {r.lunchSlot ? FAIXAS_ALMOCO_DOMINGO[r.lunchSlot]?.curto : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabela Quantitativa por Setor: Posição na Data vs Fluxo Mensal */}
      <div style={ui.card}>
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
          <div>
            <div style={ui.cardTitle}>
              Quadro Quantitativo por Setor — Posição do Quadro em {activeRefDate.split("-").reverse().join("/")} vs. Fluxo em {selectedYearMonth}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Nota metodológica: Colaboradores em férias mantêm sua vaga como{" "}
              <strong>Preenchida</strong>, reduzindo apenas a{" "}
              <strong>Disponibilidade Operacional</strong> no período de gozo.
            </div>
          </div>
          <button
            onClick={() => onNavigate("positions")}
            style={{ ...ui.btnSecondary, fontSize: 11 }}
          >
            Gerenciar Postos e Vagas →
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={ui.table}>
            <thead>
              <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                <th style={{ ...ui.th, textAlign: "left" }}>Setor</th>
                <th style={ui.th}>Postos Planejados</th>
                <th style={ui.th}>Postos Rateio</th>
                <th style={ui.th}>Preenchidos</th>
                <th style={ui.th}>Postos Vagos</th>
                <th style={ui.th}>Vagas Autorizadas</th>
                <th style={ui.th}>Vagas Congeladas</th>
                <th style={ui.th}>Férias na Data</th>
                <th style={ui.th}>Férias no Mês (Fluxo)</th>
                <th style={ui.th}>Disponíveis na Data</th>
                <th style={ui.th}>Escalados na Data</th>
                <th style={ui.th}>Taxa Ocupação</th>
              </tr>
            </thead>
            <tbody>
              {bi.sectorBreakdown.map((s) => {
                const occ =
                  s.plannedOwnPositions > 0
                    ? Math.round((s.filledOwnPositions / s.plannedOwnPositions) * 100)
                    : 100;
                return (
                  <tr key={s.sectorId} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...ui.td, fontWeight: 700, color: "#0f172a" }}>{s.sectorName}</td>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 600 }}>
                      {s.plannedOwnPositions}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", color: "#64748b" }}>
                      {s.plannedRateioPositions > 0
                        ? `${s.filledRateioPositions}/${s.plannedRateioPositions}`
                        : "—"}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", color: "#166534", fontWeight: 700 }}>
                      {s.filledOwnPositions}
                    </td>
                    <td
                      style={{
                        ...ui.td,
                        textAlign: "center",
                        color: s.vacantPositions > 0 ? "#b45309" : "#64748b",
                        fontWeight: s.vacantPositions > 0 ? 700 : 400,
                      }}
                    >
                      {s.vacantPositions}
                    </td>
                    <td
                      style={{
                        ...ui.td,
                        textAlign: "center",
                        color: s.openAuthorizedPositions > 0 ? "#1d4ed8" : "#94a3b8",
                        fontWeight: s.openAuthorizedPositions > 0 ? 700 : 400,
                      }}
                    >
                      {s.openAuthorizedPositions}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", color: "#64748b" }}>
                      {s.frozenPositions}
                    </td>
                    <td
                      style={{
                        ...ui.td,
                        textAlign: "center",
                        color: s.onVacationOnRefDate > 0 ? "#0369a1" : "#94a3b8",
                        fontWeight: s.onVacationOnRefDate > 0 ? 700 : 400,
                      }}
                    >
                      {s.onVacationOnRefDate}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", color: "#475569" }}>
                      {s.onVacationInMonthFlow}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#0f172a" }}>
                      {s.availableOnRefDate}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#047857" }}>
                      {s.scheduledWorkingOnRefDate}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: occ >= 85 ? "#dcfce7" : occ >= 60 ? "#fef3c7" : "#fee2e2",
                          color: occ >= 85 ? "#166534" : occ >= 60 ? "#b45309" : "#991b1b",
                        }}
                      >
                        {occ}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f1f5f9", fontWeight: 800, color: "#0f172a" }}>
                <td style={ui.td}>TOTAL CONSOLIDADO — {selectedUnitLabel}</td>
                <td style={{ ...ui.td, textAlign: "center" }}>{totals.plannedOwnPositions}</td>
                <td style={{ ...ui.td, textAlign: "center" }}>
                  {totals.filledRateioPositions}/{totals.plannedRateioPositions}
                </td>
                <td style={{ ...ui.td, textAlign: "center", color: "#166534" }}>
                  {totals.filledOwnPositions}
                </td>
                <td style={{ ...ui.td, textAlign: "center", color: "#b45309" }}>
                  {totals.vacantPositions}
                </td>
                <td style={{ ...ui.td, textAlign: "center", color: "#1d4ed8" }}>
                  {totals.openAuthorizedPositions}
                </td>
                <td style={{ ...ui.td, textAlign: "center" }}>{totals.frozenPositions}</td>
                <td style={{ ...ui.td, textAlign: "center" }}>{totals.onVacationOnRefDate}</td>
                <td style={{ ...ui.td, textAlign: "center" }}>{totals.onVacationInMonthFlow}</td>
                <td style={{ ...ui.td, textAlign: "center" }}>{totals.availableOnRefDate}</td>
                <td style={{ ...ui.td, textAlign: "center", color: "#047857" }}>
                  {totals.scheduledWorkingOnRefDate}
                </td>
                <td style={{ ...ui.td, textAlign: "center" }}>{totals.occupancyRate}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, color, bg }) {
  return (
    <div
      style={{
        background: bg,
        border: "1px solid #e2e8f0",
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.35 }}>
        {subtitle}
      </div>
    </div>
  );
}

const ui = createUniaoModuleUi({
  label: {
    fontSize: 10.5,
    marginBottom: 3,
  },
  input: {
    padding: "5px 10px",
  },
  th: {
    border: "1px solid #3A69A8",
  },
});
