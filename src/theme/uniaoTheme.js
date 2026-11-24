// =============================================================================
// DESIGN SYSTEM E IDENTIDADE VISUAL — UNIÃO SUPERMERCADOS (WORKFORCE ERP v9.0)
// Baseado integralmente no Manual Oficial da Marca:
//   • AZUL UNIÃO     : #2B5690 | RGB(43, 86, 144)  | CMYK 100-79-16-3 | Pantone 293 C
//   • VERMELHO UNIÃO : #E9403C | RGB(233, 64, 60)  | CMYK 2-95-94-0   | Pantone 485 C
//   • TIPOGRAFIA     : Montserrat (400, 500, 600, 700)
//
// Os temas preservam exatamente a mesma arquitetura estrutural (sem gradientes
// decorativos ou variações de layout), alterando exclusivamente superfícies e acentos.
// =============================================================================

export const UNIAO_THEME_STORAGE_KEY = "uniao_erp_active_theme_v9";
export const UNIAO_DENSITY_STORAGE_KEY = "uniao_erp_density_v9";

export const UNIAO_BRAND_MANUAL = {
  brandName: "União Supermercados",
  legalReference: "Grupo União Supermercados",
  website: "uniao.online.com.br",
  colors: {
    red: {
      name: "Vermelho União",
      hex: "#E9403C",
      hexHover: "#D12F2B",
      hexDark: "#B82320",
      hexSoft: "#FEF2F2",
      hexBorder: "#FECACA",
      rgb: "233, 64, 60",
      cmyk: "2-95-94-0",
      pantone: "485 C",
      meaning: "Energia, Força, Expressão",
    },
    blue: {
      name: "Azul União",
      hex: "#2B5690",
      hexHover: "#224678",
      hexDark: "#1B3963",
      hexDeep: "#142B4D",
      hexSoft: "#EDF3FA",
      hexBorder: "#C4D6EC",
      rgb: "43, 86, 144",
      cmyk: "100-79-16-3",
      pantone: "293 C",
      meaning: "Estabilidade, Solidez, Seriedade",
    },
    waveSymbol: {
      name: "Coração Onda União",
      meaning: "Modernidade, Novo Ciclo, Nova Era, Avanço",
    },
  },
  typography: {
    fontFamily:
      "'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    primaryFontName: "Montserrat (Regular 400, Medium 500, SemiBold 600, Bold 700)",
    logoFontName: "Harabara Mais Demo (união) + Montserrat Bold (supermercados)",
  },
  stores: {
    LOJA_01: {
      code: "LJ01",
      name: "LOJA 01",
      address: "Av. Brasil, 740",
      city: "Conceição das Alagoas",
      state: "MG",
      phone: "(34) 3321-3147",
    },
    LOJA_02: {
      code: "LJ02",
      name: "LOJA 02",
      address: "R. Presidente Vargas, 451",
      city: "Conceição das Alagoas",
      state: "MG",
      phone: "(34) 3321-3809",
    },
    LOJA_03: {
      code: "LJ03",
      name: "LOJA 03",
      address: "Rod. BR 262 KM 876 N. 345",
      city: "Campo Florido",
      state: "MG",
      phone: "(34) 3322-1010",
    },
  },
};

export const UNIAO_THEMES = {
  uniao_institucional: {
    id: "uniao_institucional",
    name: "Institucional (Padrão)",
    badge: "Padrão Corporativo",
    manualRef: "Manual Págs. 17–18 — Azul União profundo na navegação e superfícies neutras",
    description:
      "Navegação lateral em Azul União profundo (#142B4D), ações primárias em Azul União (#2B5690) e área operacional neutra de alto contraste.",
    logoVariantSidebar: "positivo_azul",
    logoVariantLogin: "positivo_azul",
    tokens: {
      "--erp-bg-canvas": "#F3F5F8",
      "--erp-surface": "#FFFFFF",
      "--erp-surface-subtle": "#F8FAFC",
      "--erp-surface-muted": "#EEF2F6",
      "--erp-surface-hover": "#F1F5F9",
      "--erp-border": "#DDE3EC",
      "--erp-border-strong": "#C2CDD9",
      "--erp-border-subtle": "#EAEFF5",
      "--erp-ink": "#0F1E36",
      "--erp-ink-secondary": "#3B4E68",
      "--erp-ink-muted": "#64748B",
      "--erp-primary": "#2B5690",
      "--erp-primary-hover": "#224678",
      "--erp-sidebar-bg": "#142B4D",
      "--erp-sidebar-surface": "#1B3963",
      "--erp-sidebar-border": "#254778",
      "--erp-sidebar-text": "#E2E8F0",
      "--erp-sidebar-muted": "#94A8C4",
      "--erp-sidebar-hover": "rgba(255, 255, 255, 0.06)",
      "--erp-sidebar-active-bg": "rgba(255, 255, 255, 0.11)",
      "--erp-sidebar-active-text": "#FFFFFF",
      "--erp-sidebar-accent": "#E9403C",
      "--erp-header-bg": "#FFFFFF",
      "--erp-header-border": "#DDE3EC",
      "--erp-table-header-bg": "#F1F5F9",
      "--erp-table-header-sub": "#E8EEF5",
      "--erp-table-header-text": "#1E293B",
      "--erp-table-row-hover": "#F8FAFC",
    },
  },

  uniao_alvorada: {
    id: "uniao_alvorada",
    name: "Alvorada Claro",
    badge: "Manual Pág. 08",
    manualRef: "Manual Págs. 03 e 08 — Aplicação primária sobre superfície clara",
    description:
      "Navegação lateral clara com logotipo original sobre fundo neutro e realces institucionais discretos.",
    logoVariantSidebar: "original",
    logoVariantLogin: "positivo_azul",
    tokens: {
      "--erp-bg-canvas": "#F4F6F9",
      "--erp-surface": "#FFFFFF",
      "--erp-surface-subtle": "#F8FAFC",
      "--erp-surface-muted": "#EEF2F7",
      "--erp-surface-hover": "#F1F5F9",
      "--erp-border": "#DCE4EE",
      "--erp-border-strong": "#C0CCDC",
      "--erp-border-subtle": "#ECF0F6",
      "--erp-ink": "#12243D",
      "--erp-ink-secondary": "#3D516E",
      "--erp-ink-muted": "#64748B",
      "--erp-primary": "#2B5690",
      "--erp-primary-hover": "#224678",
      "--erp-sidebar-bg": "#FFFFFF",
      "--erp-sidebar-surface": "#F4F6F9",
      "--erp-sidebar-border": "#DCE4EE",
      "--erp-sidebar-text": "#1E293B",
      "--erp-sidebar-muted": "#64748B",
      "--erp-sidebar-hover": "#F1F5F9",
      "--erp-sidebar-active-bg": "#EDF3FA",
      "--erp-sidebar-active-text": "#2B5690",
      "--erp-sidebar-accent": "#E9403C",
      "--erp-header-bg": "#FFFFFF",
      "--erp-header-border": "#DCE4EE",
      "--erp-table-header-bg": "#F1F5F9",
      "--erp-table-header-sub": "#E8EEF5",
      "--erp-table-header-text": "#1E293B",
      "--erp-table-row-hover": "#F8FAFC",
    },
  },

  uniao_energia: {
    id: "uniao_energia",
    name: "Institucional Acento Vermelho",
    badge: "Manual Pág. 14",
    manualRef: "Manual Págs. 14 e 18 — Acento primário em Vermelho União (#E9403C)",
    description:
      "Preserva superfícies neutras corporativas utilizando o Vermelho União (#E9403C) nas ações primárias.",
    logoVariantSidebar: "positivo_azul",
    logoVariantLogin: "positivo_azul",
    tokens: {
      "--erp-bg-canvas": "#F4F5F7",
      "--erp-surface": "#FFFFFF",
      "--erp-surface-subtle": "#F9FAFB",
      "--erp-surface-muted": "#EEF0F4",
      "--erp-surface-hover": "#F3F4F6",
      "--erp-border": "#E0E4EB",
      "--erp-border-strong": "#C6CDD8",
      "--erp-border-subtle": "#ECEFF4",
      "--erp-ink": "#111827",
      "--erp-ink-secondary": "#374151",
      "--erp-ink-muted": "#6B7280",
      "--erp-primary": "#D93834",
      "--erp-primary-hover": "#B82925",
      "--erp-sidebar-bg": "#142B4D",
      "--erp-sidebar-surface": "#1B3963",
      "--erp-sidebar-border": "#254778",
      "--erp-sidebar-text": "#E2E8F0",
      "--erp-sidebar-muted": "#94A8C4",
      "--erp-sidebar-hover": "rgba(255, 255, 255, 0.06)",
      "--erp-sidebar-active-bg": "rgba(255, 255, 255, 0.12)",
      "--erp-sidebar-active-text": "#FFFFFF",
      "--erp-sidebar-accent": "#E9403C",
      "--erp-header-bg": "#FFFFFF",
      "--erp-header-border": "#E0E4EB",
      "--erp-table-header-bg": "#F3F4F6",
      "--erp-table-header-sub": "#E5E7EB",
      "--erp-table-header-text": "#111827",
      "--erp-table-row-hover": "#F9FAFB",
    },
  },

  uniao_noturno: {
    id: "uniao_noturno",
    name: "Noturno Corporativo",
    badge: "Manual Pág. 12",
    manualRef: "Manual Págs. 12 e 15 — Aplicação oficial sobre superfície escura",
    description:
      "Modo escuro de baixa fadiga visual para jornadas prolongadas, preservando contraste WCAG AA.",
    logoVariantSidebar: "positivo_preto",
    logoVariantLogin: "positivo_azul",
    tokens: {
      "--erp-bg-canvas": "#0F141C",
      "--erp-surface": "#171E29",
      "--erp-surface-subtle": "#1D2634",
      "--erp-surface-muted": "#242F40",
      "--erp-surface-hover": "#222C3C",
      "--erp-border": "#2A3649",
      "--erp-border-strong": "#3A4A63",
      "--erp-border-subtle": "#202A3A",
      "--erp-ink": "#F1F5F9",
      "--erp-ink-secondary": "#CBD5E1",
      "--erp-ink-muted": "#94A3B8",
      "--erp-primary": "#3B71B8",
      "--erp-primary-hover": "#4B82CA",
      "--erp-sidebar-bg": "#11161F",
      "--erp-sidebar-surface": "#18202C",
      "--erp-sidebar-border": "#263142",
      "--erp-sidebar-text": "#E2E8F0",
      "--erp-sidebar-muted": "#94A3B8",
      "--erp-sidebar-hover": "rgba(255, 255, 255, 0.06)",
      "--erp-sidebar-active-bg": "rgba(59, 113, 184, 0.22)",
      "--erp-sidebar-active-text": "#FFFFFF",
      "--erp-sidebar-accent": "#E9403C",
      "--erp-header-bg": "#171E29",
      "--erp-header-border": "#2A3649",
      "--erp-table-header-bg": "#1E2736",
      "--erp-table-header-sub": "#18202C",
      "--erp-table-header-text": "#E2E8F0",
      "--erp-table-row-hover": "#1D2634",
    },
  },
};

export function getStoredUniaoThemeId() {
  if (typeof window === "undefined") return "uniao_institucional";
  try {
    const saved = window.localStorage.getItem(UNIAO_THEME_STORAGE_KEY);
    if (saved && UNIAO_THEMES[saved]) return saved;
  } catch {
    // Ignora bloqueio de storage
  }
  return "uniao_institucional";
}

export function applyUniaoThemeVariables(themeId) {
  const theme = UNIAO_THEMES[themeId] || UNIAO_THEMES.uniao_institucional;
  if (typeof document !== "undefined" && document.documentElement) {
    const root = document.documentElement;
    Object.entries(theme.tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute("data-uniao-theme", theme.id);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(UNIAO_THEME_STORAGE_KEY, theme.id);
    } catch {
      // Ignora
    }
  }
  return theme;
}

export function getStoredErpDensity() {
  if (typeof window === "undefined") return "comfortable";
  try {
    const saved = window.localStorage.getItem(UNIAO_DENSITY_STORAGE_KEY);
    return saved === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function applyErpDensity(density = "comfortable") {
  const clean = density === "compact" ? "compact" : "comfortable";
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("data-erp-density", clean);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(UNIAO_DENSITY_STORAGE_KEY, clean);
    } catch {
      // Ignora
    }
  }
  return clean;
}

/**
 * Dicionário padronizado de estilos dos módulos — alinhado aos tokens `--erp-*`.
 * Mantém a mesma assinatura e chaves para evolução limpa e consistente de todos os módulos.
 */
export function createUniaoModuleUi(overrides = {}) {
  const base = {
    card: {
      background: "var(--erp-surface, #FFFFFF)",
      border: "1px solid var(--erp-border, #DDE3EC)",
      borderRadius: 8,
      padding: "16px 18px",
      color: "var(--erp-ink, #0F1E36)",
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: 700,
      color: "var(--erp-ink, #0F1E36)",
      marginBottom: 6,
      letterSpacing: "-0.01em",
    },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: "var(--erp-ink-secondary, #3B4E68)",
      display: "block",
      marginBottom: 4,
    },
    select: {
      fontSize: 13,
      height: 34,
      padding: "0 10px",
      borderRadius: 6,
      border: "1px solid var(--erp-border-strong, #C2CDD9)",
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-ink, #0F1E36)",
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      boxSizing: "border-box",
    },
    input: {
      fontSize: 13,
      height: 34,
      padding: "0 10px",
      borderRadius: 6,
      border: "1px solid var(--erp-border-strong, #C2CDD9)",
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-ink, #0F1E36)",
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      boxSizing: "border-box",
    },
    btnPrimary: {
      fontSize: 13,
      height: 34,
      padding: "0 14px",
      borderRadius: 6,
      border: "1px solid transparent",
      background: "var(--erp-primary, #2B5690)",
      color: "var(--erp-primary-text, #FFFFFF)",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnBlue: {
      fontSize: 13,
      height: 34,
      padding: "0 14px",
      borderRadius: 6,
      border: "1px solid transparent",
      background: "var(--erp-brand-blue, #2B5690)",
      color: "#FFFFFF",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnSecondary: {
      fontSize: 13,
      height: 34,
      padding: "0 12px",
      borderRadius: 6,
      border: "1px solid var(--erp-border-strong, #C2CDD9)",
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-ink, #0F1E36)",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnSmall: {
      fontSize: 12,
      height: 28,
      padding: "0 10px",
      borderRadius: 6,
      border: "1px solid var(--erp-border-strong, #C2CDD9)",
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-ink-secondary, #3B4E68)",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnDanger: {
      fontSize: 13,
      height: 34,
      padding: "0 12px",
      borderRadius: 6,
      border: "1px solid var(--erp-danger-border, #FECACA)",
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-danger, #C81E1E)",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    subTab: {
      fontSize: 13,
      padding: "8px 14px",
      borderRadius: 6,
      border: "1px solid var(--erp-border, #DDE3EC)",
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-ink-secondary, #3B4E68)",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    subTabActive: {
      fontSize: 13,
      padding: "8px 14px",
      borderRadius: 6,
      border: "1px solid var(--erp-primary, #2B5690)",
      background: "var(--erp-primary, #2B5690)",
      color: "#FFFFFF",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    pill: {
      fontSize: 12,
      padding: "5px 11px",
      borderRadius: 6,
      border: "1px solid var(--erp-border-strong, #C2CDD9)",
      background: "var(--erp-surface-subtle, #F8FAFC)",
      color: "var(--erp-ink-secondary, #3B4E68)",
      fontWeight: 600,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    pillActive: {
      fontSize: 12,
      padding: "5px 11px",
      borderRadius: 6,
      border: "1px solid var(--erp-primary, #2B5690)",
      background: "var(--erp-brand-blue-soft, #EDF3FA)",
      color: "var(--erp-primary, #2B5690)",
      fontWeight: 700,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 13,
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
      fontVariantNumeric: "tabular-nums",
    },
    th: {
      padding: "9px 12px",
      fontSize: 12,
      fontWeight: 700,
      textAlign: "left",
      background: "var(--erp-table-header-bg, #F1F5F9)",
      color: "var(--erp-table-header-text, #1E293B)",
      borderBottom: "1px solid var(--erp-border, #DDE3EC)",
    },
    td: {
      padding: "8px 12px",
      borderBottom: "1px solid var(--erp-border-subtle, #EAEFF5)",
    },
    qaBox: {
      background: "var(--erp-surface-subtle, #F8FAFC)",
      border: "1px solid var(--erp-border, #DDE3EC)",
      borderRadius: 6,
      padding: "12px 14px",
    },
    optionBox: {
      border: "1px solid var(--erp-border, #DDE3EC)",
      borderRadius: 6,
      padding: "10px 12px",
      background: "var(--erp-surface-subtle, #F8FAFC)",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15, 30, 54, 0.52)",
      zIndex: 2200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    modalBackdropTransparent: {
      position: "fixed",
      inset: 0,
      background: "transparent",
      zIndex: 2400,
    },
    modalCard: {
      background: "var(--erp-surface, #FFFFFF)",
      color: "var(--erp-ink, #0F1E36)",
      borderRadius: 8,
      padding: "20px 22px",
      width: 560,
      maxWidth: "95%",
      border: "1px solid var(--erp-border, #DDE3EC)",
      boxShadow: "var(--erp-shadow-dialog, 0 18px 42px rgba(15, 30, 54, 0.22))",
      fontFamily: "var(--erp-font-sans, 'Montserrat', sans-serif)",
    },
  };

  const merged = { ...base };
  Object.keys(overrides).forEach((k) => {
    merged[k] = { ...(base[k] || {}), ...overrides[k] };
  });
  return merged;
}
