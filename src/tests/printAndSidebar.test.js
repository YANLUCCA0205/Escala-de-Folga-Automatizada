// =============================================================================
// TESTES AUTOMATIZADOS PÓS-HOMOLOGAÇÃO — REPRESENTAÇÃO VISUAL DA ESCALA IMPRESSA
// (PADRÃO OPERACIONAL UNIÃO) E CONTROLE ÚNICO DA BARRA LATERAL
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  PRINT_GEOMETRY_MM,
  buildSchedulePrintDocument,
  buildSchedulePdfFilename,
  listPrintableUnitSectors,
  wrapTextLines,
} from "../domain/schedulePrintDocument.js";
import { generateSchedulePdfBytes } from "../domain/schedulePdfExporter.js";
import { NAV_GROUPS, filterNavGroupsByPermissions } from "../layout/navigation.js";

export function createFictitiousScheduleTestDb({
  unitId = "LOJA_02",
  yearMonth = "2026-11",
  scheduleStatus = "PUBLISHED",
  versionNumber = 2,
  employeesPerSector = [14, 18, 12, 10],
  vacantPerSector = 3,
} = {}) {
  const companies = [
    {
      id: "COMP_UNIAO",
      legalName: "Grupo União Supermercados Ltda.",
      tradeName: "União Supermercados",
      cnpj: "00.000.000/0001-00",
    },
  ];
  const units = [
    { id: "LOJA_01", code: "LJ01", name: "LOJA 01 - CENTRO", city: "Fortaleza/CE" },
    { id: "LOJA_02", code: "LJ02", name: "LOJA 02 - ALDEOTA", city: "Fortaleza/CE" },
    { id: "LOJA_03", code: "LJ03", name: "LOJA 03 - JOAQUIM TÁVORA", city: "Fortaleza/CE" },
  ];
  const sectors = [
    { id: "SEC_CAIXA", name: "Frente de Loja / Caixas", minDailyCoverage: 4 },
    { id: "SEC_MERCEARIA", name: "Mercearia e Reposição", minDailyCoverage: 4 },
    { id: "SEC_ACOUGUE", name: "Açougue e Frios", minDailyCoverage: 3 },
    { id: "SEC_PADARIA", name: "Padaria e Confeitaria", minDailyCoverage: 2 },
  ];
  const workShifts = [
    {
      id: "SH_MANHA",
      name: "Manhã Comercial",
      shiftPeriod: "MANHÃ",
      entryTime: "07:00",
      effectiveExitTime: "15:20",
      breakStartTime: "11:00",
      breakEndTime: "12:00",
    },
    {
      id: "SH_TARDE",
      name: "Fechamento Loja",
      shiftPeriod: "TARDE",
      entryTime: "13:40",
      effectiveExitTime: "22:00",
      breakStartTime: "17:00",
      breakEndTime: "18:00",
    },
  ];
  const scheduleRules = [
    { id: "RL_6X1_FLEX", code: "6X1_FLEX", name: "Escala 6x1 Flexível" },
    { id: "RL_5X2", code: "5X2", name: "Escala 5x2" },
  ];

  const workPositions = [];
  const employees = [];
  const allocations = [];
  const unavailabilityEvents = [];
  const dailyEntries = [];

  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  let globalEmpCounter = 1;

  sectors.forEach((sec, sIdx) => {
    const filledCount = employeesPerSector[sIdx] ?? 0;

    for (let i = 1; i <= filledCount; i++) {
      const empId = `EMP_${unitId}_${sIdx + 1}_${i}`;
      const posId = `POS_${unitId}_${sIdx + 1}_${i}`;
      const isLongName = i === 1 || i === 7;
      const isOnVacation = i === 2;
      const isOnInss = i === 3;
      const isOnMaternity = i === 4 && sIdx === 0;

      const fullName = isLongName
        ? `FRANCISCO WELLINGTON NASCIMENTO DE ALBUQUERQUE E OLIVEIRA FILHO ${globalEmpCounter}`
        : `COLABORADOR FICTÍCIO OPERACIONAL ${String(globalEmpCounter).padStart(2, "0")} SILVA`;

      globalEmpCounter += 1;

      workPositions.push({
        id: posId,
        unitId,
        sectorId: sec.id,
        code: `P${String(sIdx + 1)}${String(i).padStart(2, "0")}`,
        title: sIdx === 0 ? "Operador(a) de Caixa" : sIdx === 1 ? "Repositor(a)" : "Atendente",
        status: "FILLED",
        defaultShiftId: i % 2 === 0 ? "SH_TARDE" : "SH_MANHA",
        defaultRuleId: i % 5 === 0 ? "RL_5X2" : "RL_6X1_FLEX",
      });

      employees.push({
        id: empId,
        fullName,
        homeUnitId: unitId,
        hireDate: "2024-01-10",
      });

      allocations.push({
        id: `ALLOC_${posId}`,
        employeeId: empId,
        workPositionId: posId,
        unitId,
        sectorId: sec.id,
        workShiftId: i % 2 === 0 ? "SH_TARDE" : "SH_MANHA",
        scheduleRuleId: i % 5 === 0 ? "RL_5X2" : "RL_6X1_FLEX",
        startDate: "2024-01-10",
        endDate: null,
      });

      for (let d = 1; d <= daysInMonth; d++) {
        const isoDate = `${yearMonth}-${String(d).padStart(2, "0")}`;
        const dow = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
        let status = "T";
        let lunchSlot = null;

        if (isOnInss) {
          status = "INSS";
        } else if (isOnMaternity) {
          status = "LM";
        } else if (isOnVacation && d >= 5 && d <= 24) {
          status = "V";
        } else if ((d + i) % 7 === 0) {
          status = i % 3 === 0 ? "A" : "F";
        } else if (dow === 0 || d === 2 || d === 15) {
          status = "T";
          lunchSlot = String(((i - 1) % 4) + 1);
        }

        dailyEntries.push({
          id: `EN_${empId}_${isoDate}`,
          employeeId: empId,
          unitId,
          workDate: isoDate,
          status,
          lunchSlot,
          origin: "AUTO_GENERATED",
        });
      }
    }

    const vacantStatuses = ["OPEN_AUTHORIZED", "OPEN_UNPLANNED", "FROZEN", "DEACTIVATED"];
    for (let v = 1; v <= vacantPerSector; v++) {
      const st = vacantStatuses[(v - 1) % vacantStatuses.length];
      workPositions.push({
        id: `POS_VAC_${unitId}_${sIdx + 1}_${v}`,
        unitId,
        sectorId: sec.id,
        code: `V${sIdx + 1}${v}`,
        title: `VAGA ${st} SETOR ${sIdx + 1}`,
        status: st,
        defaultShiftId: "SH_MANHA",
        defaultRuleId: "RL_6X1_FLEX",
      });
    }
  });

  return {
    companies,
    units,
    sectors,
    workShifts,
    scheduleRules,
    workPositions,
    employees,
    allocations,
    unavailabilityEvents,
    marketCalendarDays: [
      {
        id: `CAL_${unitId}_02`,
        unitId,
        calendarDate: `${yearMonth}-02`,
        dayType: "HOLIDAY",
        description: "Finados",
        openingMode: "FULL_DAY",
      },
      {
        id: `CAL_${unitId}_07`,
        unitId,
        calendarDate: `${yearMonth}-07`,
        dayType: "PAYDAY",
        description: "Dia de Pagamento Salarial / Maior Movimento",
        openingMode: "FULL_DAY",
      },
      {
        id: `CAL_${unitId}_15`,
        unitId,
        calendarDate: `${yearMonth}-15`,
        dayType: "HOLIDAY",
        description: "Proclamação da República",
        openingMode: "HALF_DAY",
      },
    ],
    monthlySchedules: [
      {
        id: `MS_${unitId}_${yearMonth}`,
        unitId,
        yearMonth,
        status: scheduleStatus,
        versionNumber,
        versionHistory: [],
      },
    ],
    dailyEntriesByMonth: {
      [yearMonth]: dailyEntries,
    },
  };
}

test("PRT-01: Meses com 28, 29, 30 e 31 dias cabem 100% em 281mm horizontais com largura uniforme de dias", () => {
  const testMonths = [
    { ym: "2026-02", expectedDays: 28 },
    { ym: "2028-02", expectedDays: 29 },
    { ym: "2026-11", expectedDays: 30 },
    { ym: "2026-12", expectedDays: 31 },
  ];

  for (const { ym, expectedDays } of testMonths) {
    for (const includeJourneyDetails of [false, true]) {
      const db = createFictitiousScheduleTestDb({
        unitId: "LOJA_02",
        yearMonth: ym,
        employeesPerSector: [3, 2, 0, 0],
      });
      const doc = buildSchedulePrintDocument({
        db,
        unitId: "LOJA_02",
        yearMonth: ym,
        includeJourneyDetails,
      });

      assert.equal(doc.days.length, expectedDays);
      const totalCalculatedWidth =
        doc.geometry.collabColWidthMm +
        doc.geometry.journeyColWidthMm +
        doc.days.length * doc.geometry.dayColWidthMm;

      assert.ok(
        Math.abs(totalCalculatedWidth - PRINT_GEOMETRY_MM.usableWidthMm) < 0.05
      );
      assert.ok(doc.geometry.dayColWidthMm >= 6.4);
    }
  }
});

test("PRT-02: Nova representação visual das células (Trabalho branco sem T, Folga 100% preta sem F/A, Domingo/Feriado apenas número 1..4 sem I-, Férias/Afastamentos agrupados em faixa horizontal e zero postos vagos)", () => {
  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    employeesPerSector: [5, 4, 0, 0],
    vacantPerSector: 4,
  });

  const doc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_02",
    yearMonth: "2026-11",
  });

  assert.equal(doc.totalEmployees, 9);
  const allRows = doc.pages.flatMap((p) => p.blocks.flatMap((b) => b.rows));

  let checkedNormalWorkWhite = false;
  let checkedRestBlack = false;
  let checkedSimpleIntervalNumber = false;
  let checkedVacationSpan = false;
  let checkedInssSpan = false;

  for (const row of allRows) {
    assert.equal(row.fullName.includes("VAGA"), false);

    for (const cell of row.cells) {
      // Nenhuma célula jamais exibe prefixo "I-" ou letras "T" / "F" / "A"
      assert.equal(cell.displayText.startsWith("I-"), false, "Proibido prefixo I- nos intervalos");
      assert.notEqual(cell.displayText, "T", "Dia de trabalho nunca exibe letra T");
      assert.notEqual(cell.displayText, "F", "Dia de folga nunca exibe letra F");
      assert.notEqual(cell.displayText, "A", "Folga adicional nunca exibe letra A");

      if (cell.status === "T" && !cell.lunchSlot) {
        assert.equal(cell.bgHex, "#FFFFFF");
        assert.equal(cell.displayText, "");
        checkedNormalWorkWhite = true;
      }
      if (cell.status === "F" || cell.status === "A") {
        assert.equal(cell.isBlackRest, true);
        assert.equal(cell.bgHex, "#000000", "Folga é representada por célula 100% preta");
        assert.equal(cell.displayText, "");
        checkedRestBlack = true;
      }
      if (cell.status === "T" && cell.lunchSlot) {
        assert.equal(cell.bgHex, "#FFFFFF", "Domingo/feriado trabalhado mantém célula branca");
        assert.match(cell.displayText, /^[1-4]$/, "Exibe somente o número simples do intervalo (1 a 4)");
        checkedSimpleIntervalNumber = true;
      }
    }

    for (const seg of row.cellSpans) {
      if (seg.isSpan && seg.status === "V") {
        assert.equal(seg.spanLength, 20);
        assert.equal(seg.displayText, "FÉRIAS — 05/11 A 24/11");
        checkedVacationSpan = true;
      }
      if (seg.isSpan && seg.status === "INSS") {
        assert.equal(seg.spanLength, 30);
        assert.equal(seg.displayText, "AFASTAMENTO INSS — 01/11 A 30/11");
        checkedInssSpan = true;
      }
    }
  }

  assert.equal(checkedNormalWorkWhite, true);
  assert.equal(checkedRestBlack, true);
  assert.equal(checkedSimpleIntervalNumber, true);
  assert.equal(checkedVacationSpan, true);
  assert.equal(checkedInssSpan, true);

  // Classificação das datas concentrada nos cabeçalhos (Seção 1.3)
  const day01Sun = doc.days.find((d) => d.dayNumber === "01");
  const day02Hol = doc.days.find((d) => d.dayNumber === "02");
  const day03Wk = doc.days.find((d) => d.dayNumber === "03");
  const day07Peak = doc.days.find((d) => d.dayNumber === "07");
  const day15Half = doc.days.find((d) => d.dayNumber === "15");

  assert.equal(day01Sun.headerTone, "sunday");
  assert.equal(day02Hol.headerTone, "holiday");
  assert.equal(day03Wk.headerTone, "normal");
  assert.equal(day07Peak.headerTone, "special_peak");
  assert.equal(day15Half.headerTone, "holiday");
  assert.equal(day15Half.headerSubTag, "1/2");
});

test("PRT-03: Paginação vertical com 54 colaboradores distribui em múltiplas páginas, repete cabeçalhos, marca '(continuação)' e nunca divide linhas ou deixa setor órfão", () => {
  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    employeesPerSector: [14, 22, 10, 8],
  });

  const doc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_02",
    yearMonth: "2026-11",
  });

  assert.equal(doc.totalEmployees, 54);
  assert.ok(doc.totalPages >= 3);
  assert.equal(
    doc.pages.reduce((acc, p) => acc + p.pageEmployeeCount, 0),
    54
  );

  let foundContinuationBlock = false;
  doc.pages.forEach((page, idx) => {
    assert.equal(page.pageNumber, idx + 1);
    assert.ok(page.usedHeightMm <= PRINT_GEOMETRY_MM.bodyMaxHeightMm + 0.01);
    for (const block of page.blocks) {
      assert.ok(block.rows.length >= 1);
      if (block.isContinuation) {
        foundContinuationBlock = true;
        assert.ok(block.displayTitle.includes("(continuação)"));
      }
    }
  });
  assert.equal(foundContinuationBlock, true);
});

test("PRT-04: Nomes extensos quebram em múltiplas linhas sem truncamento e opções de setores específicos / unidades / rascunho funcionam", () => {
  const longName =
    "FRANCISCO WELLINGTON NASCIMENTO DE ALBUQUERQUE E OLIVEIRA FILHO";
  const wrapped = wrapTextLines(longName, 30, 4);
  assert.ok(wrapped.length >= 2);
  assert.equal(wrapped.join(" "), longName);

  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_01",
    yearMonth: "2026-10",
    scheduleStatus: "DRAFT",
    versionNumber: 1,
    employeesPerSector: [4, 5, 3, 2],
  });

  const unitSectors = listPrintableUnitSectors({ db, unitId: "LOJA_01", yearMonth: "2026-10" });
  assert.equal(unitSectors.length, 4);

  const partialDoc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_01",
    yearMonth: "2026-10",
    sectorScope: "SELECTED",
    selectedSectorIds: ["SEC_CAIXA", "SEC_ACOUGUE"],
    includeJourneyDetails: true,
  });

  assert.equal(partialDoc.totalSectors, 2);
  assert.equal(partialDoc.totalEmployees, 7);
  assert.equal(partialDoc.fileName, "Escala_Mensal_Loja_01_2026-10_Setores_Selecionados.pdf");

  const stdName = buildSchedulePdfFilename({
    unit: { name: "LOJA 02 - ALDEOTA" },
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    sectorScope: "ALL",
  });
  assert.equal(stdName, "Escala_Mensal_Loja_02_2026-11.pdf");
});

test("PRT-05: Exportador PDF gera documento PDF-1.4 A4 Paisagem válido com células pretas de folga, faixas de férias e sem prefixos I-", () => {
  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    employeesPerSector: [14, 18, 12, 10],
  });

  const doc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_02",
    yearMonth: "2026-11",
  });

  const pdfBytes = generateSchedulePdfBytes(doc);
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 15000);

  const pdfLatin1 = Buffer.from(pdfBytes).toString("latin1");
  assert.ok(pdfLatin1.startsWith("%PDF-1.4\n"));
  assert.ok(pdfLatin1.trimEnd().endsWith("%%EOF"));
  assert.ok(pdfLatin1.includes("/MediaBox [0 0 841.89 595.276]"));
  assert.ok(pdfLatin1.includes(`/Count ${doc.totalPages}`));
  assert.ok(pdfLatin1.includes("0.000 0.000 0.000 rg"), "PDF desenha retângulos pretos sólidos nas folgas");
  assert.ok(pdfLatin1.includes("05/11 A 24/11"), "PDF renderiza faixa horizontal agrupada de férias");
  assert.equal(pdfLatin1.includes("(I-1)"), false, "PDF não utiliza prefixos I-1..I-4");
});

test("SDB-01: Existe EXCLUSIVAMENTE UM controle de alternância da barra lateral (#erp-sidebar-toggle-btn) no layout global", async () => {
  const vite = await createServer({
    cacheDir: path.join(os.tmpdir(), "uniao-erp-vite-print-sidebar-test"),
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const { default: AppShell } = await vite.ssrLoadModule("/src/layout/AppShell.jsx");
    const { SchedulePrintSheet } = await vite.ssrLoadModule(
      "/src/modules/schedule/SchedulePrintPreviewModal.jsx"
    );

    const navGroups = filterNavGroupsByPermissions(NAV_GROUPS, "MANAGER");

    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          navGroups,
          activeItemId: "schedules",
          onNavigate: () => {},
          units: [{ id: "LOJA_03", code: "LJ03", name: "LOJA 03", city: "Fortaleza" }],
          selectedUnitId: "LOJA_03",
          onSelectUnit: () => {},
          selectedYearMonth: "2026-11",
          user: { fullName: "Gestor Fictício", email: "gestor@exemplo.invalid", role: "MANAGER" },
          themeId: "uniao_institucional",
          onSignOut: () => {},
        },
        createElement("div", null, "Grade de Escalas")
      )
    );

    // Conta todos os botões que controlam aria-controls="erp-primary-sidebar"
    const toggleMatches = html.match(/aria-controls="erp-primary-sidebar"/g) || [];
    assert.equal(
      toggleMatches.length,
      1,
      "Deve existir EXCLUSIVAMENTE UM controle funcional para expandir/recolher a barra lateral em todo o layout"
    );
    assert.ok(html.includes('id="erp-sidebar-toggle-btn"'));
    assert.equal(html.includes("erp-sidebar-collapse-inline-btn"), false);
    assert.equal(html.includes("erp-sidebar-toggle-mobile"), false);

    // Verifica que a folha documental HTML usa células pretas de folga, faixas colSpan de férias e legenda gráfica
    const db = createFictitiousScheduleTestDb({
      unitId: "LOJA_02",
      yearMonth: "2026-11",
      employeesPerSector: [4, 0, 0, 0],
    });
    const doc = buildSchedulePrintDocument({ db, unitId: "LOJA_02", yearMonth: "2026-11" });
    const sheetHtml = renderToStaticMarkup(
      createElement(SchedulePrintSheet, { doc, page: doc.pages[0] })
    );

    assert.ok(sheetHtml.includes("erp-print-day-cell--rest-black"), "Células de folga usam classe preta sólida");
    assert.ok(/colspan="20"/i.test(sheetHtml), "Período de férias consecutivo usa colSpan horizontal");
    assert.ok(sheetHtml.includes("FÉRIAS — 05/11 A 24/11"));
    assert.ok(sheetHtml.includes("AFASTAMENTO INSS — 01/11 A 30/11"));
    assert.equal(sheetHtml.includes("I-1"), false);
  } finally {
    await vite.close();
  }
});
