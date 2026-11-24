// =============================================================================
// TESTES DA ARQUITETURA DE NAVEGAÇÃO LATERAL E PERMISSÕES VISUAIS (Seção 8)
// =============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import {
  NAV_GROUPS,
  filterNavGroupsByPermissions,
  findNavItem,
  getBreadcrumb,
} from "../layout/navigation.js";

test("NAV-01: Estrutura lateral organiza exatamente as 5 áreas funcionais corporativas", () => {
  assert.deepEqual(
    NAV_GROUPS.map((g) => g.label),
    [
      "Visão geral",
      "Gestão de pessoas",
      "Planejamento operacional",
      "Estrutura organizacional",
      "Administração",
    ]
  );
});

test("NAV-02: Filtragem por permissão oculta grupo Administração para OPERATOR/VIEWER e exibe integralmente para MASTER", () => {
  const viewerGroups = filterNavGroupsByPermissions(NAV_GROUPS, "VIEWER");
  assert.equal(
    viewerGroups.some((g) => g.id === "administration"),
    false,
    "VIEWER não deve enxergar o grupo Administração"
  );

  const adminGroups = filterNavGroupsByPermissions(NAV_GROUPS, "ADMIN");
  const adminSec = adminGroups.find((g) => g.id === "administration");
  assert.ok(adminSec, "ADMIN enxerga Administração restrita a Auditoria e Matriz de Perfis");
  assert.deepEqual(
    adminSec.items.map((i) => i.id),
    ["admin_roles", "admin_audit"]
  );

  const masterGroups = filterNavGroupsByPermissions(NAV_GROUPS, "MASTER");
  const masterAdminSec = masterGroups.find((g) => g.id === "administration");
  assert.deepEqual(
    masterAdminSec.items.map((i) => i.id),
    ["admin_users", "admin_roles", "admin_audit", "admin_backup", "admin_settings"]
  );
});

test("NAV-03: Breadcrumb e resolução de itens funcionam para todos os itens e chaves compatíveis", () => {
  assert.deepEqual(getBreadcrumb("schedules"), {
    groupLabel: "Planejamento operacional",
    itemLabel: "Escalas mensais",
  });
  assert.deepEqual(getBreadcrumb("org_units"), {
    groupLabel: "Estrutura organizacional",
    itemLabel: "Unidades",
  });
  assert.equal(findNavItem("organization").item.id, "org_companies");
  assert.equal(findNavItem("admin").item.id, "admin_audit");
});
