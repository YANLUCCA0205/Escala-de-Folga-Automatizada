// =============================================================================
// MOTOR DOCUMENTAL DE IMPRESSÃO E PAGINAÇÃO A4 PAISAGEM — WORKFORCE ERP UNIÃO
//
// Responsável por construir um modelo documental puro, determinístico e imutável
// da Escala Mensal, compartilhado integralmente entre:
//   1. Visualização prévia em tela (SchedulePrintPreviewModal);
//   2. Impressão física nativa (@media print A4 landscape via portal dedicado);
//   3. Exportação direta em PDF vetorial pesquisável (schedulePdfExporter).
//
// Padrão visual operacional União Supermercados (Pós-Homologação):
//   • Dia normal de trabalho: célula branca vazia (sem letra "T").
//   • Dia de folga (normal ou adicional, inclusive em domingos/feriados):
//     célula completamente preenchida em preto (#000000), sem letras.
//   • Domingo, feriado ou meio expediente trabalhado com intervalo:
//     célula branca exibindo somente o número do intervalo ("1" a "4") em negrito.
//   • Classificação das datas concentrada nos cabeçalhos das colunas (Dias normais:
//     neutro; Domingos: cinza; Feriados: azul; Datas especiais/pico: vermelho;
//     Meio expediente: âmbar).
//   • Férias, licenças e afastamentos consecutivos agrupados visualmente em faixas
//     horizontais ("FÉRIAS — 05/11 A 24/11"), sem expor diagnósticos sensíveis.
// =============================================================================

import {
  listDatesInYearMonth,
  getDayOfWeekISO,
  calculateEmployeeMonthlyWorkload,
  FAIXAS_ALMOCO_DOMINGO,
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
  tableHeaderHeightMm: 8.4,
  footerGapMm: 1.6,
  footerHeightMm: 8.0,
  // Área vertical máxima segura para linhas de setores + colaboradores (com folga anti-corte)
  bodyMaxHeightMm: 156.8,
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
 * Estilos visuais para situações especiais e afastamentos (distintos do branco de
 * trabalho e do preto sólido de folga, inclusive em impressão P&B).
 */
export const SPECIAL_STATUS_STYLES = {
  V: {
    shortCode: "FÉR",
    longTitle: "FÉRIAS",
    bgHex: "#FEF3C7",
    textHex: "#78350F",
    borderHex: "#B45309",
  },
  INSS: {
    shortCode: "INSS",
    longTitle: "AFASTAMENTO INSS",
    bgHex: "#EDE9FE",
    textHex: "#3B0764",
    borderHex: "#5B21B6",
  },
  LM: {
    shortCode: "LM",
    longTitle: "LICENÇA-MATERNIDADE",
    bgHex: "#FCE7F3",
    textHex: "#831843",
    borderHex: "#9D174D",
  },
  ADM: {
    shortCode: "ADM",
    longTitle: "PRÉ-ADMISSÃO",
    bgHex: "#F1F5F9",
    textHex: "#334155",
    borderHex: "#64748B",
  },
  DEM: {
    shortCode: "DEM",
    longTitle: "DESLIGAMENTO",
    bgHex: "#F1F5F9",
    textHex: "#475569",
    borderHex: "#64748B",
  },
  FECHADO: {
    shortCode: "FECH",
    longTitle: "LOJA FECHADA",
    bgHex: "#FEE2E2",
    textHex: "#991B1B",
    borderHex: "#B91C1B",
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
 * Extrai dinamicamente do sistema os horários de intervalo configurados (1..4).
 */
export function resolveConfiguredLunchIntervals(db) {
  const source =
    db?.lunchIntervals && typeof db.lunchIntervals === "object"
      ? db.lunchIntervals
      : FAIXAS_ALMOCO_DOMINGO || {};

  return Object.entries(source).map(([slotKey, meta]) => {
    const cleanNum = String(slotKey).replace(/^I-?/i, "").trim();
    const rawHorario = String(meta?.horario || "")
      .replace(/\s+às\s+/i, " às ")
      .trim();
    return {
      slot: cleanNum,
      code: meta?.codigo || `N 0${cleanNum}`,
      horario: rawHorario || `${cleanNum}º horário`,
      label: `${cleanNum} — ${rawHorario || `${cleanNum}º horário`}`,
    };
  });
}

/**
 * Classifica a natureza da data exclusivamente para o cabeçalho da coluna (Seção 1.3),
 * estabelecendo regra de prioridade visual consistente quando houver múltiplas condições.
 */
export function resolveDayHeaderClassification({ isoDate, dow, marketDay }) {
  const isSunday = dow === 0;
  const isSaturday = dow === 6;
  const dayType = String(marketDay?.dayType || "").toUpperCase();
  const openingMode = String(marketDay?.openingMode || "").toUpperCase();
  const isHalfDayMarket = openingMode === "HALF_DAY";
  const isClosedMarket = openingMode === "CLOSED";
  const isPeakOrSpecial =
    dayType === "CRITICAL_OFFER" ||
    dayType === "PAYDAY" ||
    dayType === "SPECIAL" ||
    dayType === "HIGH_TRAFFIC";
  const isHoliday =
    dayType === "HOLIDAY" ||
    dayType === "OPTIONAL_HOLIDAY" ||
    (Boolean(marketDay) && !isPeakOrSpecial && dayType !== "SUNDAY");

  // Prioridade visual consistente:
  // 1. Unidade Fechada -> Vinho escuro (#7F1D1D)
  // 2. Data Especial / Maior Movimento -> Vermelho União (#E9403C)
  // 3. Feriado -> Azul União (#2B5690)
  // 4. Meio Expediente Geral -> Âmbar (#FDE68A)
  // 5. Domingo -> Cinza (#CBD5E1)
  // 6. Dia Normal -> Neutro (#F8FAFC)
  if (isClosedMarket) {
    return {
      headerTone: "closed",
      headerBgHex: "#7F1D1D",
      headerTextHex: "#FFFFFF",
      headerSubTag: "FECH",
      isSunOrHoliday: true,
      isHalfDayMarket: false,
      isClosedMarket: true,
      tooltip: marketDay?.description
        ? `${marketDay.description} (Unidade Fechada)`
        : `Unidade Fechada (${isoDate})`,
    };
  }

  if (isPeakOrSpecial) {
    return {
      headerTone: "special_peak",
      headerBgHex: "#E9403C",
      headerTextHex: "#FFFFFF",
      headerSubTag: isHalfDayMarket ? "1/2" : "",
      isSunOrHoliday: isSunday || Boolean(marketDay),
      isHalfDayMarket,
      isClosedMarket: false,
      tooltip: marketDay?.description
        ? `${marketDay.description}${isHalfDayMarket ? " · Meio Expediente" : ""}`
        : `Data Especial / Maior Movimento (${isoDate})`,
    };
  }

  if (isHoliday) {
    return {
      headerTone: "holiday",
      headerBgHex: "#2B5690",
      headerTextHex: "#FFFFFF",
      headerSubTag: isHalfDayMarket ? "1/2" : "",
      isSunOrHoliday: true,
      isHalfDayMarket,
      isClosedMarket: false,
      tooltip: marketDay?.description
        ? `${marketDay.description}${isHalfDayMarket ? " · Meio Expediente" : ""}`
        : `Feriado (${isoDate})`,
    };
  }

  if (isHalfDayMarket) {
    return {
      headerTone: "half_day",
      headerBgHex: "#FDE68A",
      headerTextHex: "#78350F",
      headerSubTag: "1/2",
      isSunOrHoliday: isSunday || Boolean(marketDay),
      isHalfDayMarket: true,
      isClosedMarket: false,
      tooltip: marketDay?.description
        ? `${marketDay.description} (Meio Expediente)`
        : `Meio Expediente (${isoDate})`,
    };
  }

  if (isSunday || dayType === "SUNDAY") {
    return {
      headerTone: "sunday",
      headerBgHex: "#CBD5E1",
      headerTextHex: "#0F172A",
      headerSubTag: "",
      isSunOrHoliday: true,
      isHalfDayMarket: false,
      isClosedMarket: false,
      tooltip: marketDay?.description || `Domingo (${isoDate})`,
    };
  }

  return {
    headerTone: "normal",
    headerBgHex: "#F8FAFC",
    headerTextHex: "#0F172A",
    headerSubTag: "",
    isSunOrHoliday: false,
    isSaturday,
    isHalfDayMarket: false,
    isClosedMarket: false,
    tooltip: `${DOW_CURTO_DOC[dow]} (${isoDate})`,
  };
}

/**
 * Determina a representação gráfica individual da célula na impressão/PDF (Seção 1.2).
 */
export function resolvePrintCellPresentation({ status, rawLunchSlot, day }) {
  const cleanSlot =
    rawLunchSlot !== null && rawLunchSlot !== undefined && String(rawLunchSlot).trim() !== ""
      ? String(rawLunchSlot).replace(/^I-?/i, "").trim()
      : null;

  // 1. Folga normal (F) ou adicional (A) — prevalece em qualquer dia (inclusive domingos e feriados):
  //    célula 100% preta, sem letras e sem números de intervalo.
  if (status === "F" || status === "A") {
    return {
      isoDate: day.isoDate,
      status,
      variant: "REST_BLACK",
      isBlackRest: true,
      isGroupableAbsence: false,
      lunchSlot: null,
      displayText: "",
      subText: "",
      bgHex: "#000000",
      textHex: "#FFFFFF",
      borderHex: "#000000",
    };
  }

  // 2. Férias, Licenças, Afastamentos, Pré-Admissão e Desligamento (agrupáveis em faixa horizontal)
  if (["V", "INSS", "LM", "ADM", "DEM"].includes(status)) {
    const meta = SPECIAL_STATUS_STYLES[status];
    return {
      isoDate: day.isoDate,
      status,
      variant: "SPECIAL_ABSENCE",
      isBlackRest: false,
      isGroupableAbsence: true,
      lunchSlot: null,
      displayText: meta.shortCode,
      subText: "",
      bgHex: meta.bgHex,
      textHex: meta.textHex,
      borderHex: meta.borderHex,
    };
  }

  // 3. Unidade fechada (quando o colaborador não está de folga/férias/afastamento)
  if (status === "FECHADO") {
    const meta = SPECIAL_STATUS_STYLES.FECHADO;
    return {
      isoDate: day.isoDate,
      status,
      variant: "CLOSED_MARKET",
      isBlackRest: false,
      isGroupableAbsence: false,
      lunchSlot: null,
      displayText: "",
      subText: "",
      bgHex: meta.bgHex,
      textHex: meta.textHex,
      borderHex: "#CBD5E1",
    };
  }

  // 4. Meio expediente trabajhado (MEIO_EXP)
  if (status === "MEIO_EXP") {
    const isIndividualHalfDay = !day.isHalfDayMarket;
    const hasInterval = Boolean(cleanSlot);
    return {
      isoDate: day.isoDate,
      status,
      variant: hasInterval ? "WORK_INTERVAL" : "WORK_HALF_DAY",
      isBlackRest: false,
      isGroupableAbsence: false,
      lunchSlot: cleanSlot,
      // Se há intervalo atribuído, exibe somente o número; se for meio expediente individual sem intervalo, exibe "1/2" discreto
      displayText: hasInterval ? cleanSlot : isIndividualHalfDay ? "1/2" : "",
      subText: hasInterval && isIndividualHalfDay ? "1/2" : "",
      bgHex: "#FFFFFF",
      textHex: hasInterval ? "#000000" : "#78350F",
      borderHex: "#64748B",
    };
  }

  // 5. Célula vazia explícita (quando em construção manual)
  if (status === "EMPTY") {
    return {
      isoDate: day.isoDate,
      status,
      variant: "WORK_EMPTY",
      isBlackRest: false,
      isGroupableAbsence: false,
      lunchSlot: null,
      displayText: "",
      subText: "",
      bgHex: "#FFFFFF",
      textHex: "#94A3B8",
      borderHex: "#64748B",
    };
  }

  // 6. Dia trabalhado (T):
  //    - Em domingo, feriado ou dia especial com intervalo atribuído -> célula branca exibindo SOMENTE o número (1..4) em negrito
  //    - Em dia normal de trabalho (ou domingo sem intervalo) -> célula branca completamente limpa (sem letra "T")
  const showIntervalNumber = Boolean(cleanSlot) && (day.isSunOrHoliday || day.isHalfDayMarket);
  return {
    isoDate: day.isoDate,
    status: "T",
    variant: showIntervalNumber ? "WORK_INTERVAL" : "WORK_WHITE",
    isBlackRest: false,
    isGroupableAbsence: false,
    lunchSlot: showIntervalNumber ? cleanSlot : null,
    displayText: showIntervalNumber ? cleanSlot : "",
    subText: "",
    bgHex: "#FFFFFF",
    textHex: "#000000",
    borderHex: "#64748B",
  };
}

/**
 * Agrupa visualmente células consecutivas de férias, afastamentos, licenças ou
 * pré-admissão/desligamento em uma faixa horizontal clara (Seção 1.4), sem alterar
 * `row.cells` nem os registros individuais de cada data.
 */
export function buildRowCellSpans(cells) {
  const spans = [];
  let i = 0;

  while (i < cells.length) {
    const first = cells[i];
    if (!first.isGroupableAbsence) {
      spans.push({
        ...first,
        isSpan: false,
        spanLength: 1,
        startDayIndex: i,
        endDayIndex: i,
        startIsoDate: first.isoDate,
        endIsoDate: first.isoDate,
      });
      i += 1;
      continue;
    }

    let j = i + 1;
    while (
      j < cells.length &&
      cells[j].isGroupableAbsence &&
      cells[j].status === first.status
    ) {
      j += 1;
    }

    const spanLength = j - i;
    const last = cells[j - 1];
    const startDD = first.isoDate.slice(8, 10);
    const startMM = first.isoDate.slice(5, 7);
    const endDD = last.isoDate.slice(8, 10);
    const endMM = last.isoDate.slice(5, 7);
    const meta = SPECIAL_STATUS_STYLES[first.status] || SPECIAL_STATUS_STYLES.V;

    let bannerText = meta.shortCode;
    if (spanLength >= 6) {
      bannerText = `${meta.longTitle} — ${startDD}/${startMM} A ${endDD}/${endMM}`;
    } else if (spanLength >= 3) {
      bannerText = `${meta.longTitle} (${startDD} A ${endDD}/${endMM})`;
    } else if (spanLength === 2) {
      bannerText = `${meta.shortCode} ${startDD}–${endDD}`;
    }

    spans.push({
      ...first,
      isSpan: spanLength > 1,
      spanLength,
      startDayIndex: i,
      endDayIndex: j - 1,
      startIsoDate: first.isoDate,
      endIsoDate: last.isoDate,
      displayText: bannerText,
    });

    i = j;
  }

  return spans;
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
        if (pos.sectorId !== sec.id || pos.status === "DEACTIVATED") {
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
        if (!emp || !String(emp.fullName || "").trim()) return false;
        if (pos.unitId === unitId) return true;
        if (pos.isSharedRateio) {
          if (Array.isArray(pos.authorizedUnitIds) && pos.authorizedUnitIds.length > 0) {
            return pos.authorizedUnitIds.includes(unitId);
          }
          return true;
        }
        return Boolean(emp.isSharedRateio && (emp.authorizedUnitIds || []).includes(unitId));
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

  const configuredLunchIntervals = resolveConfiguredLunchIntervals(db);

  const shiftsById = Object.fromEntries((db?.workShifts || []).map((s) => [s.id, s]));
  const rulesById = Object.fromEntries((db?.scheduleRules || []).map((r) => [r.id, r]));
  const employeesById = Object.fromEntries((db?.employees || []).map((e) => [e.id, e]));
  const marketCalendarByDate = Object.fromEntries(
    (db?.marketCalendarDays || [])
      .filter((c) => c.unitId === unitId)
      .map((c) => [c.calendarDate, c])
  );

  const sharedRateioEmpIds = new Set();
  for (const pos of db?.workPositions || []) {
    if (!pos?.isSharedRateio || pos.status === "DEACTIVATED") continue;
    const visibleInUnit =
      !Array.isArray(pos.authorizedUnitIds) ||
      pos.authorizedUnitIds.length === 0 ||
      pos.authorizedUnitIds.includes(unitId);
    if (!visibleInUnit) continue;
    for (const a of db?.allocations || []) {
      if (
        a.workPositionId === pos.id &&
        a.startDate <= lastDay &&
        (!a.endDate || a.endDate >= firstDay)
      ) {
        sharedRateioEmpIds.add(a.employeeId);
      }
    }
  }

  const rawMonthEntries = (db?.dailyEntriesByMonth?.[yearMonth] || []).filter((e) => {
    if (!e.unitId || e.unitId === unitId) return true;
    if (sharedRateioEmpIds.has(e.employeeId)) return true;
    const emp = employeesById[e.employeeId];
    return Boolean(emp?.isSharedRateio && (emp.authorizedUnitIds || []).includes(unitId));
  });
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
    const cls = resolveDayHeaderClassification({ isoDate, dow, marketDay: mDay });

    return {
      isoDate,
      dayNumber: isoDate.slice(8, 10),
      dow,
      dowLabel: DOW_CURTO_DOC[dow],
      isSunday: dow === 0,
      isSaturday: dow === 6,
      marketDay: mDay,
      ...cls,
    };
  });

  const allAvailableUnitSectors = listPrintableUnitSectors({ db, unitId, yearMonth });
  const selectedSet =
    sectorScope === "SELECTED" ? new Set(selectedSectorIds || []) : null;

  // Coleta APENAS postos efetivamente ocupados por colaboradores reais (Seção 1.3),
  // incluindo colaboradores em RATEIO autorizados para a loja selecionada.
  const populatedSectors = [];
  for (const sec of db?.sectors || []) {
    if (selectedSet && !selectedSet.has(sec.id)) continue;

    const sectorRows = [];
    const seenEmpIdsInSector = new Set();
    const directPositions = (db?.workPositions || []).filter(
      (p) => p.unitId === unitId && p.sectorId === sec.id && p.status !== "DEACTIVATED"
    );
    const sharedRateioPositions = (db?.workPositions || []).filter(
      (p) => p.unitId !== unitId && p.sectorId === sec.id && p.status !== "DEACTIVATED"
    );
    const positionsInSector = [...directPositions, ...sharedRateioPositions];

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
      const isRateioPosVisible =
        Boolean(pos.isSharedRateio) &&
        (!Array.isArray(pos.authorizedUnitIds) ||
          pos.authorizedUnitIds.length === 0 ||
          pos.authorizedUnitIds.includes(unitId));
      if (
        pos.unitId !== unitId &&
        !isRateioPosVisible &&
        !(emp.isSharedRateio && (emp.authorizedUnitIds || []).includes(unitId))
      ) {
        continue;
      }
      if (seenEmpIdsInSector.has(emp.id)) continue;
      seenEmpIdsInSector.add(emp.id);

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

        return resolvePrintCellPresentation({
          status: resolvedStatus,
          rawLunchSlot: entry?.lunchSlot,
          day,
        });
      });

      const cellSpans = buildRowCellSpans(cells);

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
        cellSpans,
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

  const unitAddressParts = [
    unit.street ? [unit.street, unit.number].filter(Boolean).join(", ") : "",
    unit.complement || "",
    unit.neighborhood || "",
    [unit.city, unit.state].filter(Boolean).join("/"),
    unit.zipCode ? `CEP ${unit.zipCode}` : "",
  ].filter(Boolean);
  const unitAddressLine = unitAddressParts.join(" · ");
  const unitFiscalBase = unit.legalName || company.tradeName || unit.name || unitId;
  const unitFiscalLabel = unit.cnpj
    ? `${unitFiscalBase} · CNPJ ${unit.cnpj}`
    : `${unitFiscalBase} · CNPJ não informado (completar cadastro)`;

  return {
    geometry: {
      ...PRINT_GEOMETRY_MM,
      collabColWidthMm,
      journeyColWidthMm,
      dayColWidthMm: Number(dayColWidthMm.toFixed(4)),
    },
    companyName: company.tradeName || company.legalName || "União Supermercados",
    companyLegalName: unit.legalName || company.legalName || "Grupo União Supermercados",
    unitId,
    unitCode: unit.code || unitId,
    unitName: unit.name || unitId,
    unitLegalName: unit.legalName || "",
    unitCnpj: unit.cnpj || "",
    unitEstablishmentType: unit.establishmentType || "",
    unitCity: unit.city || "",
    unitState: unit.state || "",
    unitAddressLine,
    unitFiscalLabel,
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
    configuredLunchIntervals,
    days,
    totalSectors,
    totalEmployees,
    totalPages,
    availableUnitSectors: allAvailableUnitSectors,
    pages,
  };
}
