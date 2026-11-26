// =============================================================================
// TESTES ISOLADOS — ESTRUTURA ORGANIZACIONAL, CATEGORIAS E GERADOR DE POSTOS
// Valida em ambiente isolado (sem dados de demonstração):
//   1. Renderização da aba Categorias Funcionais entre Setores e Funções e Cargos.
//   2. Exibição do nome amigável da unidade (LOJA 03) em vez do ID técnico.
//   3. Campo UF no cadastro de unidades.
//   4. Detecção de função com categoria inválida/pendente para regularização.
//   5. Criação e persistência particionada de categorias, funções e postos com IDs
//      diferentes dos dados de demonstração.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import {
  createSequentialPositions,
  computeWorkforceAnalytics,
} from "../domain/scheduleEngine.js";
import { buildSchedulePrintDocument } from "../domain/schedulePrintDocument.js";
import { generateSchedulePdfBytes } from "../domain/schedulePdfExporter.js";
import {
  splitDatabaseIntoPartitions,
  assembleDatabaseFromPartitions,
} from "../services/partitionCodec.js";

function buildIsolatedDb() {
  return {
    schemaRevision: 1,
    companies: [{ id: "comp_prod_1", legalName: "Empresa Teste Ltda", tradeName: "Loja Teste", cnpj: "", active: true }],
    units: [
      {
        id: "UNIT_FILIAL_II_400",
        companyId: "comp_prod_1",
        code: "LJ03",
        name: "LOJA 03",
        city: "Belo Horizonte",
        state: "MG",
        active: true,
      },
    ],
    sectors: [
      { id: "SEC_PROD_PAD", code: "PAD", name: "PADARIA", displayOrder: 1, minDailyCoverage: 2, active: true },
    ],
    unitSectors: [],
    functionalCategories: [],
    roles: [
      {
        id: "ROLE_PROD_PAD",
        categoryId: "CAT_PERECIVEIS", // referência inválida de produção/legado para testar detecção
        defaultSectorId: "SEC_PROD_PAD",
        code: "PADEIRO",
        name: "PADEIRO",
        hierarchyRank: 20,
        projectedMonthlyCost: null,
        active: true,
      },
    ],
    workShifts: [
      {
        id: "SH_PROD_M1",
        code: "M1",
        name: "06:00 às 14:20",
        shiftPeriod: "MANHÃ",
        entryTime: "06:00",
        effectiveExitTime: "14:20",
        active: true,
      },
    ],
    scheduleRules: [
      { id: "RULE_PROD_5X1", code: "5X1", name: "Escala 5x1", active: true },
    ],
    ruleAssignments: [],
    workPositions: [],
    employees: [],
    allocations: [],
    unavailabilityEvents: [],
    marketCalendarDays: [],
    monthlySchedules: [],
    cycleStates: [],
    dailyEntriesByMonth: {},
    deletedEntityIds: [],
    auditLogs: [],
  };
}

test("ORG-01: Renderiza aba Categorias funcionais, nome amigável da unidade, campo UF e alerta de função pendente", async () => {
  const vite = await createServer({
    cacheDir: path.join(os.tmpdir(), "uniao-erp-vite-ssr-org-test"),
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const { default: OrganizationAndPositionsModule } = await vite.ssrLoadModule(
      "/src/modules/OrganizationAndPositionsModule.jsx"
    );
    const db = buildIsolatedDb();

    const positionsHtml = renderToStaticMarkup(
      createElement(OrganizationAndPositionsModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        setSelectedUnitId: () => {},
        selectedYearMonth: "2026-11",
        initialTab: "positions",
        initialSection: "positions",
        onMutateDb: () => {},
      })
    );

    // Ordem das abas: Setores -> Categorias funcionais -> Funções e cargos
    const idxSectors = positionsHtml.indexOf("Setores");
    const idxCategories = positionsHtml.indexOf("Categorias funcionais");
    const idxRoles = positionsHtml.indexOf("Funções e cargos");
    assert.ok(idxSectors >= 0 && idxCategories > idxSectors && idxRoles > idxCategories);

    // Nome amigável da unidade nos títulos em vez de UNIT_FILIAL_II_400
    assert.ok(positionsHtml.includes("LOJA 03"));
    assert.equal(positionsHtml.includes("UNIT_FILIAL_II_400"), false);

    // Aba Unidades exibe campo UF
    const unitsHtml = renderToStaticMarkup(
      createElement(OrganizationAndPositionsModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        setSelectedUnitId: () => {},
        selectedYearMonth: "2026-11",
        initialTab: "structure",
        initialSection: "units",
        onMutateDb: () => {},
      })
    );
    assert.ok(unitsHtml.includes(">UF<"));
    assert.ok(unitsHtml.includes("Belo Horizonte · MG"));

    // Aba Funções e cargos detecta referência inválida sem atribuir categoria arbitrária
    const rolesHtml = renderToStaticMarkup(
      createElement(OrganizationAndPositionsModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        setSelectedUnitId: () => {},
        selectedYearMonth: "2026-11",
        initialTab: "structure",
        initialSection: "roles",
        onMutateDb: () => {},
      })
    );
    assert.ok(rolesHtml.includes("pendente de regularização"));
    assert.ok(rolesHtml.includes("Pendente / inválida"));
  } finally {
    await vite.close();
  }
});

test("ORG-02: Criação e persistência particionada de categorias, funções e postos sem IDs de demonstração", () => {
  const db = buildIsolatedDb();

  // 1. Cadastra categoria manual com ID próprio
  const customCategory = {
    id: "CAT_PROD_OPERACAO",
    code: "OPERACAO",
    name: "Operação de Loja",
    hierarchyLevel: 1,
    active: true,
  };
  db.functionalCategories.push(customCategory);

  // 2. Regulariza a função existente para a categoria válida
  db.roles[0].categoryId = customCategory.id;

  // 3. Gera postos sequenciais usando IDs reais de produção (não demo)
  const newPositions = createSequentialPositions({
    unitId: "UNIT_FILIAL_II_400",
    sectorId: "SEC_PROD_PAD",
    role: db.roles[0],
    quantity: 2,
    startNumber: 1,
    defaultShiftId: "SH_PROD_M1",
    defaultRuleId: "RULE_PROD_5X1",
    isSharedRateio: false,
    initialStatus: "OPEN_AUTHORIZED",
    estimatedMonthlyCost: null,
  });

  assert.equal(newPositions.length, 2);
  assert.equal(newPositions[0].unitId, "UNIT_FILIAL_II_400");
  assert.equal(newPositions[0].sectorId, "SEC_PROD_PAD");
  assert.equal(newPositions[0].roleId, "ROLE_PROD_PAD");
  assert.equal(newPositions[0].defaultShiftId, "SH_PROD_M1");
  assert.equal(newPositions[0].defaultRuleId, "RULE_PROD_5X1");
  assert.equal(newPositions[0].title, "PADEIRO 01");
  assert.equal(newPositions[1].title, "PADEIRO 02");

  db.workPositions.push(...newPositions);

  // 4. Valida round-trip de particionamento (GLOBAL/structure + UNIT_FILIAL_II_400/positions)
  const partitions = splitDatabaseIntoPartitions(db);
  const { db: reassembled } = assembleDatabaseFromPartitions(Array.from(partitions.values()));

  assert.equal(reassembled.functionalCategories.length, 1);
  assert.equal(reassembled.functionalCategories[0].id, "CAT_PROD_OPERACAO");
  assert.equal(reassembled.roles[0].categoryId, "CAT_PROD_OPERACAO");
  assert.equal(reassembled.workPositions.length, 2);
  assert.equal(reassembled.workPositions[0].unitId, "UNIT_FILIAL_II_400");
});

test("ORG-03: Filtragem de funções por setor, cadastro fiscal por unidade e ausência de IDs técnicos na interface", async () => {
  const vite = await createServer({
    cacheDir: path.join(os.tmpdir(), "uniao-erp-vite-ssr-org03-test"),
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const { default: OrganizationAndPositionsModule } = await vite.ssrLoadModule(
      "/src/modules/OrganizationAndPositionsModule.jsx"
    );
    const { default: DashboardAndBiModule } = await vite.ssrLoadModule(
      "/src/modules/DashboardAndBiModule.jsx"
    );
    const { default: EmployeesAndAvailabilityModule } = await vite.ssrLoadModule(
      "/src/modules/EmployeesAndAvailabilityModule.jsx"
    );
    const { default: RulesShiftsAndCalendarModule } = await vite.ssrLoadModule(
      "/src/modules/RulesShiftsAndCalendarModule.jsx"
    );
    const { default: ScheduleGridModule } = await vite.ssrLoadModule(
      "/src/modules/ScheduleGridModule.jsx"
    );

    const db = buildIsolatedDb();
    db.companies[0].cnpj = "11.111.111/0001-11";
    db.units[0].cnpj = "33.333.333/0003-33";
    db.units[0].legalName = "UNIAO SUPERMERCADOS FILIAL 03 LTDA";
    db.units[0].establishmentType = "FILIAL";
    db.sectors.push({
      id: "SEC_PROD_ACOUGUE",
      code: "ACO",
      name: "ACOUGUE",
      displayOrder: 2,
      minDailyCoverage: 2,
      active: true,
    });
    db.roles.push({
      id: "ROLE_PROD_ACO",
      categoryId: "CAT_PROD_OPERACAO",
      defaultSectorId: "SEC_PROD_ACOUGUE",
      code: "ACOUGUEIRO",
      name: "ACOUGUEIRO",
      hierarchyRank: 20,
      projectedMonthlyCost: null,
      active: true,
    });

    // 1. No formulário de criação de postos (setor inicial PADARIA), apenas PADEIRO deve aparecer no seletor de função
    const posHtml = renderToStaticMarkup(
      createElement(OrganizationAndPositionsModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        setSelectedUnitId: () => {},
        selectedYearMonth: "2026-11",
        initialTab: "positions",
        initialSection: "positions",
        onMutateDb: () => {},
      })
    );
    const roleSelectMatch = posHtml.match(/<label[^>]*>Função<\/label><select[^>]*>([\s\S]*?)<\/select>/);
    assert.ok(roleSelectMatch, "Seletor de função deve existir");
    assert.ok(roleSelectMatch[1].includes("PADEIRO"));
    assert.equal(roleSelectMatch[1].includes("ACOUGUEIRO"), false);
    assert.equal(posHtml.includes("UNIT_FILIAL_II_400"), false);

    // 2. Setor sem funções vinculadas exibe mensagem clara
    const dbEmptySec = buildIsolatedDb();
    dbEmptySec.roles = [];
    const emptyRoleHtml = renderToStaticMarkup(
      createElement(OrganizationAndPositionsModule, {
        db: dbEmptySec,
        selectedUnitId: "UNIT_FILIAL_II_400",
        setSelectedUnitId: () => {},
        selectedYearMonth: "2026-11",
        initialTab: "positions",
        initialSection: "positions",
        onMutateDb: () => {},
      })
    );
    assert.ok(emptyRoleHtml.includes("Sem funções disponíveis para este setor"));

    // 3. Aba Unidades exibe campos fiscais e de endereço individuais
    const unitsHtml = renderToStaticMarkup(
      createElement(OrganizationAndPositionsModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        setSelectedUnitId: () => {},
        selectedYearMonth: "2026-11",
        initialTab: "structure",
        initialSection: "units",
        onMutateDb: () => {},
      })
    );
    assert.ok(unitsHtml.includes("33.333.333/0003-33"));
    assert.ok(unitsHtml.includes("UNIAO SUPERMERCADOS FILIAL 03 LTDA"));
    assert.ok(unitsHtml.includes("CEP"));
    assert.ok(unitsHtml.includes("Logradouro"));

    // 4. Outros módulos não expõem UNIT_FILIAL_II_400 e ScheduleGrid exibe CNPJ próprio da unidade
    const dashHtml = renderToStaticMarkup(
      createElement(DashboardAndBiModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        selectedYearMonth: "2026-11",
        setSelectedYearMonth: () => {},
        onNavigate: () => {},
      })
    );
    assert.equal(dashHtml.includes("UNIT_FILIAL_II_400"), false);
    assert.ok(dashHtml.includes("TOTAL CONSOLIDADO — LOJA 03"));

    const empHtml = renderToStaticMarkup(
      createElement(EmployeesAndAvailabilityModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        selectedYearMonth: "2026-11",
        onMutateDb: () => {},
      })
    );
    assert.equal(empHtml.includes("UNIT_FILIAL_II_400"), false);

    const calHtml = renderToStaticMarkup(
      createElement(RulesShiftsAndCalendarModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        initialTab: "calendar",
        onMutateDb: () => {},
      })
    );
    assert.equal(calHtml.includes("UNIT_FILIAL_II_400"), false);

    const gridHtml = renderToStaticMarkup(
      createElement(ScheduleGridModule, {
        db,
        selectedUnitId: "UNIT_FILIAL_II_400",
        selectedYearMonth: "2026-11",
        setSelectedYearMonth: () => {},
        onMutateDb: () => {},
        onOpenPrintPreview: () => {},
      })
    );
    assert.equal(gridHtml.includes("UNIT_FILIAL_II_400"), false);
    assert.ok(gridHtml.includes("33.333.333/0003-33"));
    assert.equal(gridHtml.includes("11.111.111/0001-11"), false);
  } finally {
    await vite.close();
  }
});

test("ORG-04: Posto RATEIO único é compartilhado entre 3 unidades sem duplicação, isola postos próprios e usa CNPJ por unidade nos documentos", async () => {
  const db = buildIsolatedDb();
  db.companies[0].cnpj = "11.111.111/0001-11";
  db.units = [
    {
      id: "UNIT_LJ01",
      companyId: "comp_prod_1",
      code: "LJ01",
      name: "LOJA 01",
      legalName: "EMPRESA MATRIZ LTDA",
      cnpj: "11.111.111/0001-11",
      establishmentType: "MATRIZ",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
    {
      id: "UNIT_LJ02",
      companyId: "comp_prod_1",
      code: "LJ02",
      name: "LOJA 02",
      legalName: "EMPRESA FILIAL 02 LTDA",
      cnpj: "22.222.222/0002-22",
      establishmentType: "FILIAL",
      city: "Campinas",
      state: "SP",
      active: true,
    },
    {
      id: "UNIT_LJ03",
      companyId: "comp_prod_1",
      code: "LJ03",
      name: "LOJA 03",
      legalName: "",
      cnpj: "",
      establishmentType: "FILIAL",
      city: "Sorocaba",
      state: "SP",
      active: true,
    },
  ];
  db.sectors.push({
    id: "SEC_SUP",
    code: "SUP",
    name: "SUPERVISAO",
    displayOrder: 2,
    minDailyCoverage: 1,
    active: true,
  });
  db.roles.push({
    id: "ROLE_SUP",
    categoryId: "CAT_ADM",
    defaultSectorId: "SEC_SUP",
    code: "SUPERVISOR",
    name: "SUPERVISOR OPERACIONAL",
    hierarchyRank: 5,
    projectedMonthlyCost: 5000,
    active: true,
  });

  // 1 posto próprio na Loja 01 + 1 posto RATEIO na Loja 01 (sem authorizedUnitIds explícito, compatível com produção)
  db.workPositions = [
    {
      id: "POS_OWN_LJ01",
      unitId: "UNIT_LJ01",
      sectorId: "SEC_PROD_PAD",
      roleId: "ROLE_PROD_PAD",
      defaultShiftId: "SH_PROD_M1",
      defaultRuleId: "RULE_PROD_5X1",
      code: "01",
      title: "PADEIRO 01",
      isSharedRateio: false,
      status: "OPEN_AUTHORIZED",
      estimatedMonthlyCost: 2500,
    },
    {
      id: "POS_RATEIO_SUP",
      unitId: "UNIT_LJ01",
      sectorId: "SEC_SUP",
      roleId: "ROLE_SUP",
      defaultShiftId: "SH_PROD_M1",
      defaultRuleId: "RULE_PROD_5X1",
      code: "RATEIO",
      title: "SUPERVISOR OPERACIONAL",
      isSharedRateio: true,
      status: "FILLED",
      estimatedMonthlyCost: 5000,
    },
  ];
  db.employees = [
    {
      id: "EMP_SUP_01",
      registrationCode: "9001",
      fullName: "CARLOS SUPERVISOR",
      homeUnitId: "UNIT_LJ01",
      isSharedRateio: true,
      authorizedUnitIds: ["UNIT_LJ01", "UNIT_LJ02", "UNIT_LJ03"],
      hireDate: "2025-01-10",
      employmentStatus: "ACTIVE",
    },
  ];
  db.allocations = [
    {
      id: "ALLOC_SUP_01",
      employeeId: "EMP_SUP_01",
      workPositionId: "POS_RATEIO_SUP",
      unitId: "UNIT_LJ01",
      sectorId: "SEC_SUP",
      roleId: "ROLE_SUP",
      workShiftId: "SH_PROD_M1",
      scheduleRuleId: "RULE_PROD_5X1",
      startDate: "2025-01-10",
      endDate: null,
    },
  ];

  // 1. Round-trip de partições mantém apenas 1 registro lógico e entrega o RATEIO às 3 lojas
  const partitions = splitDatabaseIntoPartitions(db);
  for (const uid of ["UNIT_LJ01", "UNIT_LJ02", "UNIT_LJ03"]) {
    const posPart = partitions.get(`${uid}|positions|`);
    assert.ok(posPart, `Partição de postos deve existir para ${uid}`);
    assert.ok(
      posPart.data.workPositions.some((p) => p.id === "POS_RATEIO_SUP"),
      `Posto RATEIO deve constar na partição de ${uid}`
    );
    if (uid !== "UNIT_LJ01") {
      assert.equal(
        posPart.data.workPositions.some((p) => p.id === "POS_OWN_LJ01"),
        false,
        `Posto próprio da LJ01 não deve vazar para ${uid}`
      );
    }
  }
  const { db: reassembled } = assembleDatabaseFromPartitions(Array.from(partitions.values()));
  assert.equal(reassembled.workPositions.length, 2, "Sem duplicação lógica após roundtrip");

  // 2. Indicadores por loja e consolidado
  const sectorsById = Object.fromEntries(db.sectors.map((s) => [s.id, s]));
  const rolesById = Object.fromEntries(db.roles.map((r) => [r.id, r]));

  const biLj02 = computeWorkforceAnalytics({
    unitId: "UNIT_LJ02",
    referenceDate: "2026-11-10",
    yearMonth: "2026-11",
    workPositions: reassembled.workPositions,
    employees: reassembled.employees,
    allocations: reassembled.allocations,
    sectorsById,
    rolesById,
  });
  assert.equal(biLj02.totals.plannedOwnPositions, 0);
  assert.equal(biLj02.totals.plannedRateioPositions, 1);
  assert.equal(biLj02.totals.filledRateioPositions, 1);

  const biAll = computeWorkforceAnalytics({
    unitId: null,
    referenceDate: "2026-11-10",
    yearMonth: "2026-11",
    workPositions: reassembled.workPositions,
    employees: reassembled.employees,
    allocations: reassembled.allocations,
    sectorsById,
    rolesById,
  });
  assert.equal(biAll.totals.plannedOwnPositions, 1);
  assert.equal(biAll.totals.plannedRateioPositions, 1, "Consolidado não duplica RATEIO");
  assert.equal(biAll.totals.estimatedFullCost, 7500, "Consolidado soma 2500 + 5000 uma única vez");

  // 3. Documento de impressão/PDF exibe RATEIO nas 3 unidades e CNPJ específico de cada loja
  const docLj02 = buildSchedulePrintDocument({
    db: reassembled,
    unitId: "UNIT_LJ02",
    yearMonth: "2026-11",
  });
  assert.equal(docLj02.totalEmployees, 1);
  assert.equal(docLj02.unitCnpj, "22.222.222/0002-22");
  assert.ok(docLj02.unitFiscalLabel.includes("22.222.222/0002-22"));
  const pdfBytesLj02 = generateSchedulePdfBytes(docLj02);
  const pdfTextLj02 = Buffer.from(pdfBytesLj02).toString("latin1");
  assert.ok(pdfTextLj02.includes("22.222.222/0002-22"));
  assert.equal(pdfTextLj02.includes("11.111.111/0001-11"), false);

  // Loja 03 sem CNPJ não herda o CNPJ da matriz
  const docLj03 = buildSchedulePrintDocument({
    db: reassembled,
    unitId: "UNIT_LJ03",
    yearMonth: "2026-11",
  });
  assert.equal(docLj03.unitCnpj, "");
  assert.ok(docLj03.unitFiscalLabel.includes("CNPJ não informado"));
  assert.equal(docLj03.unitFiscalLabel.includes("11.111.111/0001-11"), false);
});
