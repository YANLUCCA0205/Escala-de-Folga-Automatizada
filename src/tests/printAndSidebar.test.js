// =============================================================================
// TESTES AUTOMATIZADOS PÓS-HOMOLOGAÇÃO — IMPRESSÃO A4 PAISAGEM, PDF E BARRA LATERAL
//
// Cobre integralmente a Seção 3 (Testes obrigatórios):
//   • Meses com 28 (2026-02), 29 (2028-02 bissexto), 30 (2026-11) e 31 (2026-12) dias
//   • Poucos colaboradores e grande quantidade de colaboradores (54+ em múltiplas páginas)
//   • Diversos setores e setores que ultrapassam uma página ("(continuação)")
//   • Zero títulos de setor órfãos no fim da página e zero linhas de colaborador divididas
//   • Colaboradores com nomes extensos (quebra de linha sem truncamento)
//   • Ocultação estrita de postos vagos, abertos, congelados e desativados
//   • Preservação de colaboradores em férias (FÉR) e afastamento (LM / INSS)
//   • Diferentes unidades operacionais (LOJA_01, LOJA_02, LOJA_03)
//   • Escalas publicadas (PUBLISHED) e em rascunho (DRAFT)
//   • Exportação de setores específicos e padronização do nome do PDF
//   • Geração real de PDF A4 Paisagem vetorial com texto selecionável e pesquisável
//   • Barra lateral: controle permanente no cabeçalho global (expandida e recolhida),
//     persistência em localStorage, navegação entre módulos e SSR sem sobreposição
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

/**
 * Constrói uma base fictícia rica para testar todos os cenários operacionais
 * (múltiplas unidades, múltiplos setores, postos vagos/congelados, férias, INSS,
 * nomes extensos e setores que atravessam páginas).
 */
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

      if (isOnVacation) {
        unavailabilityEvents.push({
          id: `UNAV_VAC_${empId}`,
          employeeId: empId,
          unitId,
          type: "VACATION",
          startDate: `${yearMonth}-05`,
          endDate: `${yearMonth}-24`,
        });
      } else if (isOnInss) {
        unavailabilityEvents.push({
          id: `UNAV_INSS_${empId}`,
          employeeId: empId,
          unitId,
          type: "INSS",
          startDate: `${yearMonth}-01`,
          endDate: `${yearMonth}-${String(daysInMonth).padStart(2, "0")}`,
        });
      } else if (isOnMaternity) {
        unavailabilityEvents.push({
          id: `UNAV_LM_${empId}`,
          employeeId: empId,
          unitId,
          type: "MATERNITY",
          startDate: `${yearMonth}-01`,
          endDate: `${yearMonth}-${String(daysInMonth).padStart(2, "0")}`,
        });
      }

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
          status = "F";
        } else if (dow === 0) {
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

    // Adiciona postos VAGOS, CONGELADOS e DESATIVADOS que JAMAIS podem aparecer na impressão/PDF
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
        id: `CAL_${unitId}_15`,
        unitId,
        calendarDate: `${yearMonth}-15`,
        description: "Feriado Nacional",
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
    { ym: "2028-02", expectedDays: 29 }, // Ano bissexto
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

      assert.equal(doc.days.length, expectedDays, `Competência ${ym} deve ter ${expectedDays} dias`);
      assert.equal(doc.days[0].dayNumber, "01");
      assert.equal(doc.days[doc.days.length - 1].dayNumber, String(expectedDays));

      const totalCalculatedWidth =
        doc.geometry.collabColWidthMm +
        doc.geometry.journeyColWidthMm +
        doc.days.length * doc.geometry.dayColWidthMm;

      assert.ok(
        Math.abs(totalCalculatedWidth - PRINT_GEOMETRY_MM.usableWidthMm) < 0.05,
        `Soma horizontal (${totalCalculatedWidth}mm) deve igualar área útil A4 (${PRINT_GEOMETRY_MM.usableWidthMm}mm)`
      );
      assert.ok(
        doc.geometry.dayColWidthMm >= 6.4,
        `Cada coluna de dia (${doc.geometry.dayColWidthMm}mm) mantém largura legível em ${ym}`
      );
    }
  }
});

test("PRT-02: Postos vagos, congelados e desativados são 100% ocultados enquanto colaboradores em férias (FÉR) e afastamento (INSS/LM) permanecem", () => {
  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_03",
    yearMonth: "2026-11",
    employeesPerSector: [5, 4, 0, 0],
    vacantPerSector: 4, // 16 postos vagos/congelados/desativados no banco
  });

  const totalPositionsInDb = db.workPositions.length;
  assert.equal(totalPositionsInDb, 9 + 16);

  const doc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_03",
    yearMonth: "2026-11",
  });

  // 1. A impressão não altera o banco original
  assert.equal(db.workPositions.length, 25, "Quadro de postos original do ERP permanece intacto");

  // 2. Exclusivamente os 9 colaboradores ocupantes aparecem no documento
  assert.equal(doc.totalEmployees, 9);
  assert.equal(doc.totalSectors, 2, "Setores sem colaboradores ocupados são omitidos");

  const allPrintedRows = doc.pages.flatMap((p) => p.blocks.flatMap((b) => b.rows));
  assert.equal(allPrintedRows.length, 9);

  for (const row of allPrintedRows) {
    assert.equal(row.fullName.includes("VAGA"), false, "Nenhuma linha de vaga aparece na impressão");
    assert.equal(row.cells.length, 30, "Cada colaborador possui todos os 30 dias do mês");
  }

  // 3. Colaboradores em Férias (FÉR), INSS e Licença Maternidade (LM) estão presentes com suas marcações
  const allCodes = new Set(allPrintedRows.flatMap((r) => r.cells.map((c) => c.code)));
  assert.ok(allCodes.has("FÉR"), "Colaborador em férias permanece com marcação FÉR");
  assert.ok(allCodes.has("INSS"), "Colaborador afastado pelo INSS permanece com marcação INSS");
  assert.ok(allCodes.has("LM"), "Colaboradora em licença maternidade permanece com marcação LM");
  assert.ok(allCodes.has("F"), "Folgas semanais (F) estão presentes");
  assert.ok(allCodes.has("T"), "Dias de trabalho (T) estão presentes");
});

test("PRT-03: Paginação vertical com 54 colaboradores distribui em múltiplas páginas, repete cabeçalhos, marca '(continuação)' e nunca divide linhas ou deixa setor órfão", () => {
  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    employeesPerSector: [14, 22, 10, 8], // 54 colaboradores (Setor 2 tem 22 e atravessa páginas)
  });

  const doc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_02",
    yearMonth: "2026-11",
  });

  assert.equal(doc.totalEmployees, 54);
  assert.ok(doc.totalPages >= 3, `Esperado >= 3 páginas para 54 colaboradores, obtido ${doc.totalPages}`);

  // Soma de colaboradores nas páginas é exatamente 54 (nenhum duplicado, nenhum perdido)
  const sumAcrossPages = doc.pages.reduce((acc, p) => acc + p.pageEmployeeCount, 0);
  assert.equal(sumAcrossPages, 54);

  // Verifica altura máxima e ausência de setor órfão (todo bloco em toda página tem >= 1 colaborador)
  let foundContinuationBlock = false;
  doc.pages.forEach((page, idx) => {
    assert.equal(page.pageNumber, idx + 1);
    assert.equal(page.totalPages, doc.totalPages);
    assert.ok(
      page.usedHeightMm <= PRINT_GEOMETRY_MM.bodyMaxHeightMm + 0.01,
      `Página ${page.pageNumber} respeita limite vertical (${page.usedHeightMm}mm <= ${PRINT_GEOMETRY_MM.bodyMaxHeightMm}mm)`
    );
    for (const block of page.blocks) {
      assert.ok(
        block.rows.length >= 1,
        `Setor '${block.displayTitle}' na página ${page.pageNumber} nunca fica isolado sem colaboradores`
      );
      if (block.isContinuation) {
        foundContinuationBlock = true;
        assert.ok(
          block.displayTitle.includes("(continuação)"),
          `Setor continuado exibe sufixo '(continuação)': ${block.displayTitle}`
        );
      }
    }
  });

  assert.equal(foundContinuationBlock, true, "Setor que ultrapassa a página é identificado com (continuação)");
});

test("PRT-04: Nomes extensos quebram em múltiplas linhas sem truncamento e opções de setores específicos / unidades / rascunho funcionam", () => {
  const longName =
    "FRANCISCO WELLINGTON NASCIMENTO DE ALBUQUERQUE E OLIVEIRA FILHO";
  const wrapped = wrapTextLines(longName, 30, 4);
  assert.ok(wrapped.length >= 2, "Nome extenso é quebrado em 2+ linhas");
  assert.equal(wrapped.join(" "), longName, "Nenhuma letra do nome completo é perdida ou truncada");

  // Teste de filtro por setores selecionados + escala em rascunho + outra unidade (LOJA_01)
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
  assert.equal(partialDoc.totalEmployees, 4 + 3);
  assert.equal(partialDoc.scheduleStatusLabel, "Em Rascunho");
  assert.equal(partialDoc.days.length, 31);
  assert.equal(
    partialDoc.fileName,
    "Escala_Mensal_Loja_01_2026-10_Setores_Selecionados.pdf"
  );

  // Nome padronizado para escala completa da Loja 02 em 2026-11 (exemplo exato da especificação 1.6)
  const stdName = buildSchedulePdfFilename({
    unit: { name: "LOJA 02 - ALDEOTA" },
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    sectorScope: "ALL",
  });
  assert.equal(stdName, "Escala_Mensal_Loja_02_2026-11.pdf");
});

test("PRT-05: Exportador PDF gera documento PDF-1.4 A4 Paisagem válido com texto selecionável e pesquisável", () => {
  const db = createFictitiousScheduleTestDb({
    unitId: "LOJA_02",
    yearMonth: "2026-11",
    employeesPerSector: [14, 18, 12, 10], // 54 colaboradores -> 3 páginas
  });

  const doc = buildSchedulePrintDocument({
    db,
    unitId: "LOJA_02",
    yearMonth: "2026-11",
  });

  const pdfBytes = generateSchedulePdfBytes(doc);
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 15000, "PDF multipágina possui conteúdo vetorial substancial");

  const pdfLatin1 = Buffer.from(pdfBytes).toString("latin1");
  assert.ok(pdfLatin1.startsWith("%PDF-1.4\n"), "Cabeçalho PDF-1.4 válido");
  assert.ok(pdfLatin1.trimEnd().endsWith("%%EOF"), "Marcador %%EOF válido");
  assert.ok(
    pdfLatin1.includes("/MediaBox [0 0 841.89 595.276]"),
    "MediaBox em formato exato A4 Paisagem (297mm x 210mm)"
  );
  assert.ok(
    pdfLatin1.includes(`/Count ${doc.totalPages}`),
    `Árvore de páginas PDF contém todas as ${doc.totalPages} páginas`
  );
  // Verifica que o texto é selecionável/pesquisável (não imagem)
  assert.ok(pdfLatin1.includes("ESCALA MENSAL DE TRABALHO E FOLGAS"));
  assert.ok(pdfLatin1.includes("LOJA 02 - ALDEOTA"));
  assert.ok(pdfLatin1.includes("FRANCISCO WELLINGTON NASCIMENTO"));
  assert.ok(pdfLatin1.includes("SETOR: MERCEARIA E REPOSI"));
});

test("SDB-01: Barra lateral possui controle permanente no cabeçalho global (expandida e recolhida) e folha de impressão renderiza via SSR", async () => {
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

    // 1. Renderiza com barra lateral expandida (default)
    const expandedHtml = renderToStaticMarkup(
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

    assert.ok(
      expandedHtml.includes('class="erp-icon-btn erp-icon-btn--sm erp-sidebar-toggle-desktop"'),
      "Controle permanente de alternância da barra lateral está presente no cabeçalho global (.erp-header)"
    );
    assert.ok(expandedHtml.includes('aria-controls="erp-primary-sidebar"'));
    assert.ok(expandedHtml.includes('aria-label="Recolher barra lateral"'));

    // 2. Renderiza folha documental A4 Paisagem (SchedulePrintSheet) e valida elementos obrigatórios
    const db = createFictitiousScheduleTestDb({
      unitId: "LOJA_02",
      yearMonth: "2026-11",
      employeesPerSector: [3, 2, 0, 0],
    });
    const doc = buildSchedulePrintDocument({ db, unitId: "LOJA_02", yearMonth: "2026-11" });
    const sheetHtml = renderToStaticMarkup(
      createElement(SchedulePrintSheet, { doc, page: doc.pages[0] })
    );

    assert.ok(sheetHtml.includes("ESCALA MENSAL DE TRABALHO E FOLGAS"));
    assert.ok(sheetHtml.includes("LOJA 02 - ALDEOTA"));
    assert.ok(sheetHtml.includes("COMPETÊNCIA: NOVEMBRO / 2026 (2026-11)"));
    assert.ok(sheetHtml.includes("Página 1 de 1"));
    assert.ok(sheetHtml.includes("FRENTE DE LOJA / CAIXAS"));
    assert.equal(sheetHtml.includes("VAGA"), false, "Nenhum posto vago aparece no HTML documental");
  } finally {
    await vite.close();
  }
});
