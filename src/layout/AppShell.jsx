// =============================================================================
// SHELL GLOBAL DO ERP — BARRA LATERAL SANFONADA + CABEÇALHO COMPACTO (v9.0)
//
// Decisões de UX/UI corporativa:
//   - A unidade operacional ativa vive em UM ÚNICO seletor global no cabeçalho.
//   - Seletores de tema e densidade ficam centralizados em "Preferências do usuário".
//   - Barra lateral organizada por áreas funcionais sanfonadas e recolhível a 60px
//     para maximizar a largura útil da grade de escalas mensais.
// =============================================================================

import { useState } from "react";
import UniaoLogo, { UniaoBrandManualModal } from "../components/UniaoLogo.jsx";
import { UNIAO_THEMES } from "../theme/uniaoTheme.js";
import { ROLE_METADATA } from "../services/erpRepository.js";
import {
  Icon,
  Button,
  IconButton,
  Badge,
  Dialog,
  Field,
  Select,
  PopoverMenu,
} from "../ui/index.jsx";
import { getBreadcrumb, findNavItem } from "./navigation.js";

const SIDEBAR_COLLAPSED_KEY = "uniao_erp_sidebar_collapsed_v9";

export default function AppShell({
  navGroups = [],
  activeItemId,
  onNavigate,
  units = [],
  selectedUnitId,
  onSelectUnit,
  selectedYearMonth,
  user, // { fullName, email, role }
  previewRole = null, // estritamente visual (exclusivo MASTER)
  onClearPreviewRole,
  syncStatus = "idle",
  notifications = [],
  themeId,
  onChangeTheme,
  density = "comfortable",
  onChangeDensity,
  maintenanceBanner = null,
  onSignOut,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [brandManualOpen, setBrandManualOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const activeFound = findNavItem(activeItemId, navGroups);
  const activeGroupId = activeFound?.group?.id || navGroups[0]?.id || "overview";

  const [openGroupIds, setOpenGroupIds] = useState(
    () => new Set([activeGroupId, "overview", "planning", "people", "organization", "administration"])
  );

  const toggleSidebarCollapsed = () => {
    // Em telas móveis (<= 920px), o único controle alterna o drawer lateral;
    // em desktop (> 920px), alterna entre barra expandida e recolhida (60px).
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 920px)").matches
    ) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Ignora
      }
      return next;
    });
  };

  const toggleGroup = (groupId) => {
    setOpenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const activeTheme = UNIAO_THEMES[themeId] || UNIAO_THEMES.uniao_institucional;
  const breadcrumb = getBreadcrumb(activeItemId, navGroups);
  const realRoleMeta = ROLE_METADATA[user?.role] || ROLE_METADATA.VIEWER;
  const activeUnit = units.find((u) => u.id === selectedUnitId) || units[0] || null;

  return (
    <>
      <a href="#erp-main-content" className="erp-skip-link">
        Pular para o conteúdo principal
      </a>

      <div className="erp-shell">
        {/* BARRA LATERAL SANFONADA E RECOLHÍVEL */}
        {mobileOpen && (
          <div
            className="erp-sidebar-backdrop no-print"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          id="erp-primary-sidebar"
          className="erp-sidebar no-print"
          data-collapsed={collapsed ? "true" : "false"}
          data-mobile-closed={mobileOpen ? "false" : "true"}
          aria-label="Navegação principal do sistema"
        >
          <div className="erp-sidebar-brand">
            {collapsed ? (
              <UniaoLogo
                variant={activeTheme.logoVariantSidebar || "positivo_azul"}
                layout="symbol"
                size="sm"
                idSuffix="sb_sym"
              />
            ) : (
              <UniaoLogo
                variant={activeTheme.logoVariantSidebar || "positivo_azul"}
                size="sm"
                idSuffix="sb_full"
              />
            )}
          </div>

          <nav className="erp-sidebar-nav">
            {navGroups.map((group) => {
              const isGroupOpen = openGroupIds.has(group.id);
              return (
                <div key={group.id} className="erp-nav-group">
                  {!collapsed && (
                    <button
                      type="button"
                      className="erp-nav-group-btn"
                      aria-expanded={isGroupOpen}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <span>{group.label}</span>
                      <Icon name={isGroupOpen ? "chevronDown" : "chevronRight"} size={13} />
                    </button>
                  )}
                  {(collapsed || isGroupOpen) &&
                    group.items.map((item) => {
                      const isActive =
                        activeItemId === item.id || activeFound?.item?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="erp-nav-item"
                          aria-current={isActive ? "page" : undefined}
                          title={collapsed ? `${group.label} — ${item.label}` : undefined}
                          onClick={() => {
                            onNavigate(item.id);
                            setMobileOpen(false);
                          }}
                        >
                          <Icon name={item.icon} size={17} />
                          {!collapsed && (
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                              {item.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              );
            })}
          </nav>

          <div className="erp-sidebar-footer">
            {!collapsed ? (
              <>
                <span>Workforce ERP</span>
                <span style={{ fontFamily: "var(--erp-font-mono)" }}>v9.0</span>
              </>
            ) : (
              <span style={{ margin: "0 auto", fontFamily: "var(--erp-font-mono)" }}>v9</span>
            )}
          </div>
        </aside>

        {/* ÁREA OPERACIONAL + CABEÇALHO COMPACTO */}
        <div className="erp-workspace">
          <header className="erp-header no-print">
            <div className="erp-header-left">
              <IconButton
                id="erp-sidebar-toggle-btn"
                icon={collapsed ? "panelLeftOpen" : "panelLeftClose"}
                label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
                size="sm"
                onClick={toggleSidebarCollapsed}
                aria-expanded={!collapsed}
                aria-controls="erp-primary-sidebar"
                className="erp-sidebar-toggle-btn"
              />
              <span className="erp-header-divider" aria-hidden="true" />
              <nav aria-label="Localização atual" className="erp-breadcrumb">
                <span>{breadcrumb.groupLabel}</span>
                <Icon name="chevronRight" size={13} />
                <strong>{breadcrumb.itemLabel}</strong>
              </nav>
            </div>

            <div className="erp-header-right">
              {/* Indicador discreto de sincronização com o banco */}
              {syncStatus === "saving" && <Badge tone="warning">Sincronizando...</Badge>}
              {syncStatus === "saved" && <Badge tone="success">Sincronizado</Badge>}
              {syncStatus === "error" && <Badge tone="danger">Falha de sincronização</Badge>}

              {/* SELETOR GLOBAL ÚNICO DE UNIDADE OPERACIONAL ATIVA */}
              {units.length > 0 && (
                <div className="erp-unit-switcher" title="Unidade operacional ativa">
                  <Icon name="store" size={14} style={{ color: "var(--erp-brand-blue)" }} />
                  {units.length === 1 ? (
                    <span>
                      {activeUnit?.name}
                      {activeUnit?.city ? ` · ${activeUnit.city}` : ""}
                    </span>
                  ) : (
                    <select
                      aria-label="Unidade operacional ativa"
                      value={selectedUnitId}
                      onChange={(e) => onSelectUnit(e.target.value)}
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.code}){u.city ? ` — ${u.city}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedYearMonth && (
                <Badge tone="neutral" style={{ height: "var(--erp-control-sm)" }}>
                  <Icon name="calendar" size={13} />
                  <span>{selectedYearMonth}</span>
                </Badge>
              )}

              {/* Central de Notificações Operacionais */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label={`Notificações (${notifications.length})`}
                  title="Notificações operacionais"
                  className="erp-icon-btn erp-icon-btn--sm"
                  style={{ position: "relative" }}
                >
                  <Icon name="bell" size={16} />
                  {notifications.length > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        right: 3,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "var(--erp-brand-red)",
                      }}
                    />
                  )}
                </button>
                {notifOpen && (
                  <div
                    className="erp-popover"
                    style={{ width: 320, padding: 10 }}
                    role="region"
                    aria-label="Notificações"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingBottom: 8,
                        borderBottom: "1px solid var(--erp-border)",
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: "var(--erp-text-xs)" }}>
                        Alertas operacionais ({notifications.length})
                      </strong>
                      <IconButton
                        icon="x"
                        label="Fechar alertas"
                        size="sm"
                        onClick={() => setNotifOpen(false)}
                      />
                    </div>
                    {notifications.length === 0 ? (
                      <div
                        style={{
                          padding: "14px 6px",
                          fontSize: "var(--erp-text-xs)",
                          color: "var(--erp-ink-muted)",
                          textAlign: "center",
                        }}
                      >
                        Nenhuma pendência crítica para a unidade selecionada.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              if (n.targetItemId) onNavigate(n.targetItemId);
                            }}
                            className="erp-menu-item"
                            style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}
                          >
                            <span style={{ fontWeight: 600, fontSize: "var(--erp-text-xs)" }}>
                              {n.title}
                            </span>
                            {n.description && (
                              <span
                                style={{
                                  fontSize: "var(--erp-text-xs)",
                                  color: "var(--erp-ink-muted)",
                                }}
                              >
                                {n.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Menu do Operador Autenticado */}
              <PopoverMenu
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="erp-btn erp-btn--secondary erp-btn--sm"
                    style={{ gap: 8 }}
                  >
                    <Icon name="user" size={14} />
                    <span
                      style={{
                        maxWidth: 150,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user?.fullName || user?.email}
                    </span>
                    <Badge tone={user?.role === "MASTER" ? "brand" : "neutral"}>
                      {realRoleMeta.shortLabel}
                    </Badge>
                    <Icon name="chevronDown" size={13} />
                  </button>
                )}
                items={[
                  {
                    id: "info",
                    label: `${user?.email} (${realRoleMeta.label})`,
                    disabled: true,
                  },
                  { separator: true },
                  {
                    id: "prefs",
                    icon: "settings",
                    label: "Preferências de exibição",
                    onClick: () => setPreferencesOpen(true),
                  },
                  {
                    id: "brand",
                    icon: "layers",
                    label: "Manual da marca União",
                    onClick: () => setBrandManualOpen(true),
                  },
                  { separator: true },
                  {
                    id: "logout",
                    icon: "logout",
                    label: "Encerrar sessão",
                    danger: true,
                    onClick: onSignOut,
                  },
                ]}
              />
            </div>
          </header>

          {/* Aviso de Modo de Pré-Visualização Estritamente Visual (somente MASTER) */}
          {previewRole && (
            <div
              className="no-print"
              style={{
                background: "var(--erp-warning-soft)",
                borderBottom: "1px solid var(--erp-warning-border)",
                padding: "7px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                fontSize: "var(--erp-text-xs)",
              }}
            >
              <span>
                <strong>Pré-visualização visual ativa:</strong> exibindo a interface como{" "}
                <strong>{ROLE_METADATA[previewRole]?.label || previewRole}</strong>. As permissões
                reais de servidor da sua sessão MASTER permanecem inalteradas e auditadas.
              </span>
              {onClearPreviewRole && (
                <Button variant="secondary" size="sm" onClick={onClearPreviewRole}>
                  Encerrar pré-visualização
                </Button>
              )}
            </div>
          )}

          {/* Aviso de Modo de Manutenção */}
          {maintenanceBanner?.enabled && (
            <div
              className="no-print"
              style={{
                background: "var(--erp-danger-soft)",
                borderBottom: "1px solid var(--erp-danger-border)",
                color: "var(--erp-danger)",
                padding: "7px 20px",
                fontSize: "var(--erp-text-xs)",
                fontWeight: 600,
              }}
            >
              Modo de manutenção ativo:{" "}
              {maintenanceBanner.message ||
                "Alterações operacionais estão temporariamente bloqueadas para operadores."}
            </div>
          )}

          <main id="erp-main-content" className="erp-main">
            {children}
          </main>
        </div>
      </div>

      {/* DIÁLOGO CENTRALIZADO DE PREFERÊNCIAS DO USUÁRIO (Tema e Densidade) */}
      <Dialog
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        title="Preferências de exibição"
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setPreferencesOpen(false)}>
            Concluir
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field
            label="Tema institucional"
            hint="Todos os temas preservam a mesma estrutura funcional e o Manual da Marca União."
          >
            {(id) => (
              <Select
                id={id}
                value={themeId}
                onChange={(e) => onChangeTheme && onChangeTheme(e.target.value)}
              >
                {Object.values(UNIAO_THEMES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Densidade operacional de controles"
            hint="O modo compacto reduz a altura de campos e barras para telas menores."
          >
            {(id) => (
              <Select
                id={id}
                value={density}
                onChange={(e) => onChangeDensity && onChangeDensity(e.target.value)}
              >
                <option value="comfortable">Padrão corporativo (34px)</option>
                <option value="compact">Alta densidade / Compacto (30px)</option>
              </Select>
            )}
          </Field>
        </div>
      </Dialog>

      <UniaoBrandManualModal
        open={brandManualOpen}
        onClose={() => setBrandManualOpen(false)}
        activeThemeId={themeId}
        onSelectTheme={onChangeTheme}
      />
    </>
  );
}
