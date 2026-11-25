// =============================================================================
// MOTOR DOCUMENTAL DE IMPRESSÃO E PAGINAÇÃO A4 PAISAGEM — WORKFORCE ERP UNIÃO
//
// Responsável por construir um modelo documental puro, determinístico e imutável
// da Escala Mensal, compartilhado integralmente entre:
//   1. Visualização prévia em tela (SchedulePrintPreviewModal);
//   2. Impressão física nativa (@media print A4 landscape via portal dedicado);
//   3. Exportação direta em PDF vetorial pesquisável (schedulePdfExporter).
//
// Garantias arquiteturais:
//   • Ocultação estrita de postos vagos, congelados sem colaborador, desativados
//     e linhas vazias (preservando colaboradores em férias ou afastamento).
//   • 100% dos dias da competência (28, 29, 30 ou 31) distribuídos horizontalmente
//     em uma única página A4 paisagem com largura uniforme nas colunas de dias.
//   • Paginação exclusivamente vertical (por colaboradores): zero linhas partidas,
//     zero títulos de setor órfãos no fim da página e repetição automática de
//     cabeçalho institucional, dias do mês e "(continuação)" do setor.
// =============================================================================

import {
  listDatesInYearMonth,
  getDayOfWeekISO,
  calculateEmployeeMonthlyWorkload,
} from "./scheduleEngine.js";

export const PRINT_GEOMETRY_MM = {
  pageWidthMm: 297.0,
  pageHeightMm: 210.0,
  marginXmm: 8.0,
  marginYmm: 7.0,
  usableWidthMm: 281.0,
  usableHeightMm: 196.0,
  docHeaderHeightMm: 15.2,
  docHeaderGapMm: 1.8,
  tableHeaderHeightMm: 8.2,
  footerGapMm: 1.6,
  footerHeightMm: 7.4,
  // Área vertical máxima segura para linhas de setores + colaboradores (com folga anti-corte)
  bodyMaxHeightMm: 157.5,
  sectorHeaderHeightMm: 5.8,
};

const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DOW_CURTO_DOC = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/**
 * Células documentais de baixo consumo de tinta (fundo predominantemente branco)
 * e alto contraste tipográfico para impressoras coloridas ou laser monocromáticas.
 */
export const PRINT_CELL_STYLES = {
  T: {
    code: "T",
    bgHex: "#FFFFFF",
    bgSundayHex: "#F8FAFC",
    textHex: "#1E293B",
    textSundayHex: "#0F172A",
    slotBgHex: "#DCFCE7",
    slotTextHex: "#14532D",
  },
  F: {
    code: "F",
    bgHex: "#E8EFF8",
    bgSundayHex: "#DCE7F5",
    textHex: "#1E3A8A",
    textSundayHex: "#1E3A8A",
    slotBgHex: "#DBEAFE",
    slotTextHex: "#1E3A8A",
  },
  A: {
    code: "A",
    bgHex: "#F3E8FF",
    bgSundayHex: "#F3E8FF",
    textHex: "#5B21B6",
    textSundayHex: "#5B21B6",
    slotBgHex: "#EDE9FE",
    slotTextHex: "#5B21B6",
  },
  MEIO_EXP: {
    code: "1/2",
    bgHex: "#FEF3C7",
    bgSundayHex: "#FEF3C7",
    textHex: "#92400E",
    textSundayHex: "#92400E",
    slotBgHex: "#FDE68A",
    slotTextHex: "#78350F",
  },
  FECHADO: {
    code: "FECH",
    bgHex: "#FEE2E2",
    bgSundayHex: "#FEE2E2",
    textHex: "#991B1B",
    textSundayHex: "#991B1B",
    slotBgHex: "#FECACA",
    slotTextHex: "#991B1B",
  },
  V: {
    code: "FÉR",
    bgHex: "#FFE4E6",
    bgSundayHex: "#FFE4E6",
    textHex: "#9F1239",
    textSundayHex: "#9F1239",
    slotBgHex: "#FECDD3",
    slotTextHex: "#9F1239",
  },
  LM: {
    code: "LM",
    bgHex: "#FCE7F3",
    bgSundayHex: "#FCE7F3",
    textHex: "#9D174D",
    textSundayHex: "#9D174D",
    slotBgHex: "#FBCFE8",
    slotTextHex: "#9D174D",
  },
  INSS: {
    code: "INSS",
    bgHex: "#EDE9FE",
    bgSundayHex: "#EDE9FE",
    textHex: "#4C1D95",
    textSundayHex: "#4C1D95",
    slotBgHex: "#DDD6FE",
    slotTextHex: "#4C1D95",
  },
  ADM: {
    code: "ADM",
    bgHex: "#F1F5F9",
    bgSundayHex: "#F1F5F9",
    textHex: "#475569",
    textSundayHex: "#475569",
    slotBgHex: "#E2E8F0",
    slotTextHex: "#475569",
  },
  DEM: {
    code: "DEM",
    bgHex: "#F1F5F9",
    bgSundayHex: "#F1F5F9",
    textHex: "#64748B",
    textSundayHex: "#64748B",
    slotBgHex: "#E2E8F0",
    slotTextHex: "#64748B",
  },
  EMPTY: {
    code: "—",
    bgHex: "#FFFFFF",
    bgSundayHex: "#F8FAFC",
    textHex: "#94A3B8",
    textSundayHex: "#94A3B8",
    slotBgHex: "#F1F5F9",
    slotTextHex: "#64748B",
  },
};

export function formatCompetenceLabel(yearMonth) {
  const [y, m] = String(yearMonth || "").split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return String(yearMonth || "");
  return `${MESES_PT[m - 1]} / ${y}`;
}

export function formatScheduleStatusLabel(status) {
  const map = {
    PUBLISHED: "Publicada Oficial",
    VALIDATED: "Validada",
    IMPACTED_BY_PAST_CHANGE: "Rascunho (Recálculo Pendente)",
    DRAFT: "Em Rascunho",
  };
  return map[status] || "Em Rascunho";
}

/**
 * Quebra texto completo em linhas legíveis sem truncar nomes com reticências.
 */
export function wrapTextLines(rawText, maxCharsPerLine = 30, maxLines = 4) {
  const clean = String(rawText || "").trim().replace(/\s+/g, " ");
  if (!clean) return [""];
  if (clean.length <= maxCharsPerLine) return [clean];

  const words = clean.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      if (word.length <= maxCharsPerLine) {
        current = word;
      } else {
        let rest = word;
        while (rest.length > maxCharsPerLine) {
          lines.push(rest.slice(0, maxCharsPerLine));
          rest = rest.slice(maxCharsPerLine);
        }
        current = rest;
      }
      continue;
    }

    if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      if (word.length <= maxCharsPerLine) {
        current = word;
      } else {
        let rest = word;
        while (rest.length > maxCharsPerLine) {
          lines.push(rest.slice(0, maxCharsPerLine));
          rest = rest.slice(maxCharsPerLine);
        }
        current = rest;
      }
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const head = lines.slice(0, maxLines - 1);
  head.push(lines.slice(maxLines - 1).join(" "));
  return head;
}

/**
 * Gera o nome padronizado do PDF exportado (ex: `Escala_Mensal_Loja_02_2026-11.pdf`).
 */
export function buildSchedulePdfFilename({
  unit,
  unitId,
  yearMonth,
  sectorScope = "ALL",
  selectedSectorCount = 0,
  totalSectorCount = 0,
}) {
  const sourceLabel = String(unit?.name || unitId || "Unidade").trim();
  const lojaMatch =
    sourceLabel.match(/\bloja[\s_-]*0*(\d+)\b/i) ||
    String(unitId || "").match(/\bloja[\s_-]*0*(\d+)\b/i);

  let unitSlug;
  if (lojaMatch) {
    unitSlug = `Loja_${String(Number(lojaMatch[1])).padStart(2, "0")}`;
  } else {
    const ascii = sourceLabel
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim();
    unitSlug = ascii
      ? ascii
          .split(/\s+/)
          .slice(0, 3)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join("_")
      : "Unidade";
  }

  const isPartialSectors =
    sectorScope === "SELECTED" &&
    selectedSectorCount > 0 &&
    totalSectorCount > 0 &&
    selectedSectorCount < totalSectorCount;

  const suffix = isPartialSectors ? "_Setores_Selecionados" : "";
  return `Escala_Mensal_${unitSlug}_${yearMonth}${suffix}.pdf`;
}

/**
 * Lista setores da unidade que possuem ao menos um posto efetivamente preenchido na competência.
 */
export function listPrintableUnitSectors({ db, unitId, yearMonth }) {
  if (!db || !unitId || !yearMonth) return [];
  const monthDates = listDatesInYearMonth(yearMonth);
  const firstDay = monthDates[0];
  const lastDay = monthDates[monthDates.length - 1];
  const employeesById = Object.fromEntries((db.employees || []).map((e) => [e.id, e]));

  return (db.sectors || [])
    .map((sec) => {
      const filledPositions = (db.workPositions || []).filter((pos) => {
        if (pos.unitId !== unitId || pos.sectorId !== sec.id || pos.status === "DEACTIVATED") {
          return false;
        }
        const alloc = (db.allocations || []).find(
          (a) =>
            a.workPositionId === pos.id &&
            a.startDate <= lastDay &&
            (!a.endDate || a.endDate >= firstDay)
        );
        if (!alloc) return false;
        const emp = employeesById[alloc.employeeId];
        return Boolean(emp && String(emp.fullName || "").trim());
      });

      return {
        id: sec.id,
        name: sec.name,
        filledCount: filledPositions.length,
      };
    })
    .filter((s) => s.filledCount > 0);
}

function resolveFallbackDayStatus({ emp, isoDate, marketDay, unavailabilityEvents }) {
  if (emp.hireDate && isoDate < emp.hireDate) return "ADM";
  if (emp.terminationDate && isoDate > emp.terminationDate) return "DEM";

  const unavail = (unavailabilityEvents || []).find(
    (ev) => ev.employeeId === emp.id && ev.startDate <= isoDate && ev.endDate >= isoDate
  );
  if (unavail) {
    const t = String(unavail.type || unavail.reasonType || "").toUpperCase();
    if (t.includes("VACATION") || t.includes("FERIAS") || t === "V") return "V";
    if (t.includes("MATERN") || t === "LM") return "LM";
    return "INSS";
  }

  if (marketDay?.openingMode === "CLOSED") return "FECHADO";
  if (marketDay?.openingMode === "HALF_DAY") return "MEIO_EXP";
  return "T";
}

/**
 * Constrói o documento A4 Paisagem paginado da Escala Mensal.
 */
export function buildSchedulePrintDocument({
  db,
  unitId,
  yearMonth,
  sectorScope = "ALL",
  selectedSectorIds = [],
  includeJourneyDetails = false,
  emittedAtISO = null,
}) {
  const monthDates = listDatesInYearMonth(yearMonth);
  const firstDay = monthDates[0];
  const lastDay = monthDates[monthDates.length - 1];

  const company = (db?.companies || [])[0] || {
    legalName: "União Supermercados",
    tradeName: "União Supermercados",
  };
  const unit = (db?.units || []).find((u) => u.id === unitId) || {
    id: unitId,
    code: unitId,
    name: unitId,
    city: "",
  };

  const monthlySchedule = (db?.monthlySchedules || []).find(
    (ms) => ms.unitId === unitId && ms.yearMonth === yearMonth
  ) || {
    unitId,
    yearMonth,
    status: "DRAFT",
    versionNumber: 1,
  };

  const shiftsById = Object.fromEntries((db?.workShifts || []).map((s) => [s.id, s]));
  const rulesById = Object.fromEntries((db?.scheduleRules || []).map((r) => [r.id, r]));
  const employeesById = Object.fromEntries((db?.employees || []).map((e) => [e.id, e]));
  const marketCalendarByDate = Object.fromEntries(
    (db?.marketCalendarDays || [])
      .filter((c) => c.unitId === unitId)
      .map((c) => [c.calendarDate, c])
  );

  const rawMonthEntries = (db?.dailyEntriesByMonth?.[yearMonth] || []).filter(
    (e) => !e.unitId || e.unitId === unitId
  );
  const entriesByEmpDate = {};
  for (const entry of rawMonthEntries) {
    if (!entriesByEmpDate[entry.employeeId]) {
      entriesByEmpDate[entry.employeeId] = {};
    }
    entriesByEmpDate[entry.employeeId][entry.workDate] = entry;
  }

  // Geometria horizontal exata (soma rigorosamente igual a 281.0mm em 28, 29, 30 ou 31 dias)
  const collabColWidthMm = includeJourneyDetails ? 50.0 : 58.0;
  const journeyColWidthMm = includeJourneyDetails ? 29.0 : 0.0;
  const daysAreaWidthMm =
    PRINT_GEOMETRY_MM.usableWidthMm - collabColWidthMm - journeyColWidthMm;
  const dayColWidthMm = daysAreaWidthMm / monthDates.length;
  const maxNameCharsPerLine = includeJourneyDetails ? 27 : 32;

  const days = monthDates.map((isoDate) => {
    const dow = getDayOfWeekISO(isoDate);
    const mDay = marketCalendarByDate[isoDate] || null;
    const isSunday = dow === 0;
    const isSaturday = dow === 6;
    let headerTone = "weekday";
    if (mDay?.openingMode === "CLOSED") headerTone = "closed";
    else if (mDay?.openingMode === "HALF_DAY") headerTone = "half";
    else if (mDay || isSunday) headerTone = "sunday_holiday";
    else if (isSaturday) headerTone = "saturday";

    return {
      isoDate,
      dayNumber: isoDate.slice(8, 10),
      dow,
      dowLabel: DOW_CURTO_DOC[dow],
      isSunday,
      isSaturday,
      isSunOrHoliday: isSunday || Boolean(mDay),
      marketDay: mDay,
      headerTone,
    };
  });

  const allAvailableUnitSectors = listPrintableUnitSectors({ db, unitId, yearMonth });
  const selectedSet =
    sectorScope === "SELECTED" ? new Set(selectedSectorIds || []) : null;

  // Coleta APENAS postos efetivamente ocupados por colaboradores reais (Seção 1.3)
  const populatedSectors = [];
  for (const sec of db?.sectors || []) {
    if (selectedSet && !selectedSet.has(sec.id)) continue;

    const sectorRows = [];
    const positionsInSector = (db?.workPositions || []).filter(
      (p) => p.unitId === unitId && p.sectorId === sec.id && p.status !== "DEACTIVATED"
    );

    for (const pos of positionsInSector) {
      const alloc = (db?.allocations || []).find(
        (a) =>
          a.workPositionId === pos.id &&
          a.startDate <= lastDay &&
          (!a.endDate || a.endDate >= firstDay)
      );
      if (!alloc) continue;

      const emp = employeesById[alloc.employeeId];
      if (!emp || !String(emp.fullName || "").trim()) continue;

      const shift = shiftsById[alloc.workShiftId || pos.defaultShiftId] || null;
      const rule = rulesById[alloc.scheduleRuleId || pos.defaultRuleId] || null;
      const empEntries = rawMonthEntries.filter((e) => e.employeeId === emp.id);
      const workload = calculateEmployeeMonthlyWorkload({
        employeeEntries: empEntries,
        allocations: db?.allocations || [],
        shiftsById,
        marketCalendarByDate,
      });

      const fullName = String(emp.fullName).trim();
      const nameLines = wrapTextLines(fullName, maxNameCharsPerLine, 4);
      const lineCount = nameLines.length;
      const rowHeightMm =
        lineCount <= 1 ? 6.6 : lineCount === 2 ? 8.8 : lineCount === 3 ? 11.0 : 13.2;

      const cells = days.map((day) => {
        const entry = entriesByEmpDate[emp.id]?.[day.isoDate] || null;
        const resolvedStatus = entry?.status
          ? entry.status
          : resolveFallbackDayStatus({
              emp,
              isoDate: day.isoDate,
              marketDay: day.marketDay,
              unavailabilityEvents: db?.unavailabilityEvents,
            });
        const styleMeta = PRINT_CELL_STYLES[resolvedStatus] || PRINT_CELL_STYLES.T;
        const lunchSlot =
          (resolvedStatus === "T" || resolvedStatus === "MEIO_EXP") &&
          day.isSunOrHoliday &&
          entry?.lunchSlot
            ? String(entry.lunchSlot)
            : null;

        return {
          isoDate: day.isoDate,
          status: resolvedStatus,
          code: styleMeta.code,
          lunchSlot,
          isSunOrHoliday: day.isSunOrHoliday,
          bgHex: day.isSunOrHoliday ? styleMeta.bgSundayHex : styleMeta.bgHex,
          textHex: day.isSunOrHoliday ? styleMeta.textSundayHex : styleMeta.textHex,
          slotBgHex: styleMeta.slotBgHex,
          slotTextHex: styleMeta.slotTextHex,
        };
      });

      const shiftLabel = shift ? `${shift.entryTime}–${shift.effectiveExitTime}` : "—";
      const ruleLabel = rule?.code || "—";
      const workloadLabel = workload
        ? `${workload.workedDaysCount}d · ${workload.totalEffectiveFormatted}h`
        : "";

      sectorRows.push({
        rowId: `${pos.id}_${emp.id}`,
        positionId: pos.id,
        positionCode: pos.isSharedRateio ? "RAT" : pos.code,
        positionTitle: pos.title || "",
        isSharedRateio: Boolean(pos.isSharedRateio),
        employeeId: emp.id,
        fullName,
        nameLines,
        rowHeightMm,
        shiftLabel,
        ruleLabel,
        workloadLabel,
        cells,
      });
    }

    if (sectorRows.length > 0) {
      populatedSectors.push({
        sectorId: sec.id,
        sectorName: sec.name,
        totalEmployeesInSector: sectorRows.length,
        rows: sectorRows,
      });
    }
  }

  // Paginação vertical determinística:
  //   - Nunca deixa cabeçalho de setor isolado no fim da página
  //   - Nunca divide linha de colaborador entre duas páginas
  //   - Identifica "(continuação)" quando o setor prossegue na página seguinte
  const rawPages = [];
  let currentPage = { blocks: [], usedHeightMm: 0 };

  const pushCurrentPageAndReset = () => {
    if (currentPage.blocks.length > 0) {
      rawPages.push(currentPage);
      currentPage = { blocks: [], usedHeightMm: 0 };
    }
  };

  const maxBodyMm = PRINT_GEOMETRY_MM.bodyMaxHeightMm;
  const secHdrMm = PRINT_GEOMETRY_MM.sectorHeaderHeightMm;

  for (const sectorGroup of populatedSectors) {
    const minInitialRows = sectorGroup.rows.slice(
      0,
      Math.min(2, sectorGroup.rows.length)
    );
    const minInitialRowsMm =
      minInitialRows.reduce((acc, r) => acc + r.rowHeightMm, 0) || 6.6;

    // Evita cabeçalho de setor órfão (ou com apenas 1 linha isolada no rodapé quando o setor possui 2+ colaboradores)
    if (
      currentPage.blocks.length > 0 &&
      currentPage.usedHeightMm + secHdrMm + minInitialRowsMm > maxBodyMm
    ) {
      pushCurrentPageAndReset();
    }

    let activeBlock = {
      sectorId: sectorGroup.sectorId,
      sectorName: sectorGroup.sectorName,
      displayTitle: sectorGroup.sectorName,
      isContinuation: false,
      totalEmployeesInSector: sectorGroup.totalEmployeesInSector,
      rows: [],
    };
    currentPage.blocks.push(activeBlock);
    currentPage.usedHeightMm += secHdrMm;

    for (const row of sectorGroup.rows) {
      if (
        activeBlock.rows.length > 0 &&
        currentPage.usedHeightMm + row.rowHeightMm > maxBodyMm
      ) {
        pushCurrentPageAndReset();
        activeBlock = {
          sectorId: sectorGroup.sectorId,
          sectorName: sectorGroup.sectorName,
          displayTitle: `${sectorGroup.sectorName} (continuação)`,
          isContinuation: true,
          totalEmployeesInSector: sectorGroup.totalEmployeesInSector,
          rows: [],
        };
        currentPage.blocks.push(activeBlock);
        currentPage.usedHeightMm += secHdrMm;
      }

      activeBlock.rows.push(row);
      currentPage.usedHeightMm += row.rowHeightMm;
    }
  }

  pushCurrentPageAndReset();

  if (rawPages.length === 0) {
    rawPages.push({ blocks: [], usedHeightMm: 0 });
  }

  const totalPages = rawPages.length;
  const totalEmployees = populatedSectors.reduce(
    (acc, s) => acc + s.totalEmployeesInSector,
    0
  );
  const totalSectors = populatedSectors.length;

  const pages = rawPages.map((p, idx) => ({
    pageNumber: idx + 1,
    totalPages,
    blocks: p.blocks,
    usedHeightMm: Number(p.usedHeightMm.toFixed(2)),
    pageEmployeeCount: p.blocks.reduce((acc, b) => acc + b.rows.length, 0),
  }));

  const emittedDate = emittedAtISO ? new Date(emittedAtISO) : new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const emittedAtFormatted = `${pad2(emittedDate.getDate())}/${pad2(
    emittedDate.getMonth() + 1
  )}/${emittedDate.getFullYear()} ${pad2(emittedDate.getHours())}:${pad2(
    emittedDate.getMinutes()
  )}`;

  const fileName = buildSchedulePdfFilename({
    unit,
    unitId,
    yearMonth,
    sectorScope,
    selectedSectorCount: totalSectors,
    totalSectorCount: allAvailableUnitSectors.length,
  });

  const scopeDescription =
    sectorScope === "SELECTED" && totalSectors < allAvailableUnitSectors.length
      ? `Setores selecionados (${totalSectors} de ${allAvailableUnitSectors.length})`
      : `Escala completa (${totalSectors} setor${totalSectors === 1 ? "" : "es"})`;

  return {
    geometry: {
      ...PRINT_GEOMETRY_MM,
      collabColWidthMm,
      journeyColWidthMm,
      dayColWidthMm: Number(dayColWidthMm.toFixed(4)),
    },
    companyName: company.tradeName || company.legalName || "União Supermercados",
    companyLegalName: company.legalName || "Grupo União Supermercados",
    unitId,
    unitCode: unit.code || unitId,
    unitName: unit.name || unitId,
    unitCity: unit.city || "",
    yearMonth,
    competenceLabel: formatCompetenceLabel(yearMonth),
    scheduleStatus: monthlySchedule.status || "DRAFT",
    scheduleStatusLabel: formatScheduleStatusLabel(monthlySchedule.status),
    versionNumber: monthlySchedule.versionNumber || 1,
    includeJourneyDetails: Boolean(includeJourneyDetails),
    sectorScope,
    scopeDescription,
    emittedAtFormatted,
    fileName,
    days,
    totalSectors,
    totalEmployees,
    totalPages,
    availableUnitSectors: allAvailableUnitSectors,
    pages,
  };
}
