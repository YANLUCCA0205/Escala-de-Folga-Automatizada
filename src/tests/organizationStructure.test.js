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
import { createSequentialPositions } from "../domain/scheduleEngine.js";
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
