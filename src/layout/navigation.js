// =============================================================================
// ARQUITETURA DE INFORMAÇÃO E NAVEGAÇÃO GLOBAL — WORKFORCE ERP v9.0
// Organizada pelas 5 grandes áreas funcionais definidas para operação empresarial.
// A visibilidade na barra lateral respeita as permissões efetivas do operador
// (complementando a autorização obrigatória no banco de dados via RLS/RPC).
// =============================================================================

import { hasPermission } from "../services/erpRepository.js";

export const NAV_GROUPS = [
  {
    id: "overview",
    label: "Visão geral",
    items: [
      {
        id: "dashboard",
        label: "Dashboard e indicadores",
        icon: "dashboard",
        moduleKey: "dashboard",
        requiredAny: ["VIEW_BI"],
      },
    ],
  },
  {
    id: "people",
    label: "Gestão de pessoas",
    items: [
      {
        id: "employees",
        label: "Colaboradores",
        icon: "people",
        moduleKey: "employees",
        params: { initialTab: "employees" },
        requiredAny: ["VIEW_BI"],
      },
      {
        id: "vacations",
        label: "Férias e afastamentos",
        icon: "calendarClock",
        moduleKey: "vacations",
        params: { initialTab: "unavailability" },
        requiredAny: ["VIEW_BI"],
      },
      {
        id: "positions",
        label: "Quadro de postos e vagas",
        icon: "briefcase",
        moduleKey: "positions",
        params: { initialTab: "positions", section: "positions" },
        requiredAny: ["VIEW_BI"],
      },
    ],
  },
  {
    id: "planning",
    label: "Planejamento operacional",
    items: [
      {
        id: "schedules",
        label: "Escalas mensais",
        icon: "calendar",
        moduleKey: "schedules",
        requiredAny: ["VIEW_BI"],
      },
      {
        id: "rules_shifts",
        label: "Jornadas e regras",
        icon: "clock",
        moduleKey: "rules_shifts",
        params: { initialTab: "rules" },
        requiredAny: ["VIEW_BI"],
      },
      {
        id: "calendar",
        label: "Calendário operacional",
        icon: "sliders",
        moduleKey: "calendar",
        params: { initialTab: "calendar" },
        requiredAny: ["VIEW_BI"],
      },
    ],
  },
  {
    id: "organization",
    label: "Estrutura organizacional",
    items: [
      {
        id: "org_companies",
        label: "Empresas",
        icon: "building",
        moduleKey: "organization",
        params: { initialTab: "structure", section: "companies" },
        requiredAny: ["VIEW_BI", "MANAGE_STRUCTURE"],
      },
      {
        id: "org_units",
        label: "Unidades",
        icon: "store",
        moduleKey: "organization",
        params: { initialTab: "structure", section: "units" },
        requiredAny: ["VIEW_BI", "MANAGE_STRUCTURE"],
      },
      {
        id: "org_sectors",
        label: "Setores",
        icon: "layers",
        moduleKey: "organization",
        params: { initialTab: "structure", section: "sectors" },
        requiredAny: ["VIEW_BI", "MANAGE_STRUCTURE"],
      },
      {
        id: "org_roles",
        label: "Funções e cargos",
        icon: "briefcase",
        moduleKey: "organization",
        params: { initialTab: "structure", section: "roles" },
        requiredAny: ["VIEW_BI", "MANAGE_STRUCTURE"],
      },
    ],
  },
  {
    id: "administration",
    label: "Administração",
    items: [
      {
        id: "admin_users",
        label: "Usuários e acessos",
        icon: "people",
        moduleKey: "admin_users",
        requiredAny: ["MANAGE_USERS"],
      },
      {
        id: "admin_roles",
        label: "Perfis e permissões",
        icon: "shield",
        moduleKey: "admin_roles",
        requiredAny: ["MANAGE_ACCESS", "VIEW_AUDIT"],
      },
      {
        id: "admin_audit",
        label: "Auditoria",
        icon: "history",
        moduleKey: "admin_audit",
        requiredAny: ["VIEW_AUDIT"],
      },
      {
        id: "admin_backup",
        label: "Backup e recuperação",
        icon: "database",
        moduleKey: "admin_backup",
        requiredAny: ["MANAGE_BACKUP"],
      },
      {
        id: "admin_settings",
        label: "Configurações",
        icon: "settings",
        moduleKey: "admin_settings",
        requiredAny: ["MANAGE_SYSTEM_SETTINGS"],
      },
    ],
  },
];

export function filterNavGroupsByPermissions(groups = NAV_GROUPS, roleOrPermissions = []) {
  return groups
    .map((group) => {
      const allowedItems = (group.items || []).filter((item) => {
        if (!item.requiredAny || item.requiredAny.length === 0) return true;
        return item.requiredAny.some((perm) => hasPermission(roleOrPermissions, perm));
      });
      return { ...group, items: allowedItems };
    })
    .filter((group) => group.items.length > 0);
}

export function findNavItem(itemId, groups = NAV_GROUPS) {
  for (const group of groups) {
    for (const item of group.items || []) {
      if (item.id === itemId) return { group, item };
    }
  }
  // Compatibilidade com chaves diretas de módulos (ex.: onNavigate("organization") ou onNavigate("admin"))
  if (itemId === "organization") return findNavItem("org_companies", groups);
  if (itemId === "admin") return findNavItem("admin_audit", groups);
  return null;
}

export function getBreadcrumb(itemId, groups = NAV_GROUPS) {
  const found = findNavItem(itemId, groups);
  if (!found) return { groupLabel: "Operação", itemLabel: "Painel" };
  return {
    groupLabel: found.group.label,
    itemLabel: found.item.label,
  };
}
