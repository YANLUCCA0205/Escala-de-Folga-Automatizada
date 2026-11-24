// =============================================================================
// SISTEMA DE IDENTIDADE VISUAL E TEMAS — UNIÃO SUPERMERCADOS
// Baseado integralmente no Manual de Identidade Visual da Marca (Páginas 01 a 25)
// Cores Oficiais (Pág. 18):
//   • VERMELHO UNIÃO: RGB(233, 64, 60) | HEX #E9403C | CMYK 2-95-94-0  | Pantone 485 C
//     Conceito (Pág. 01): "Energia, Força, Expressão"
//   • AZUL UNIÃO:     RGB(43, 86, 144) | HEX #2B5690 | CMYK 100-79-16-3 | Pantone 293 C
//     Conceito (Pág. 01): "Estabilidade, Solidez, Seriedade"
//   • SÍMBOLO CORAÇÃO EM ONDA (Pág. 01 e 11):
//     Conceito: "Modernidade, Novo Ciclo, Nova Era, Avanço"
// Tipografia Oficial (Págs. 04 a 07 e 11):
//   • Montserrat (Regular, SemiBold, Bold) para peças institucionais e "supermercados"
//   • Harabara Mais Demo (com acento estilizado exclusivo) para o logotipo "união"
// =============================================================================

export const UNIAO_THEME_STORAGE_KEY = "uniao_erp_active_theme_v8";

export const UNIAO_BRAND_MANUAL = {
  brandName: "União Supermercados",
  legalReference: "MERCEARIA IRMÃOS MOTA - EPP / YUARA PRESTADORA SERVIÇOS LTDA",
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
      hexSoft: "#EBF2FA",
      hexBorder: "#BDD1EB",
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
    fontFamily: "'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    primaryFontName: "Montserrat (Regular 400, SemiBold 600, Bold 700, ExtraBold 800)",
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
    name: "Institucional Azul & Vermelho",
    badge: "Padrão Oficial",
    manualRef: "Págs. 17, 18 e 22 — Positivo Fundo Azul & Paleta RGB",
    description:
      "Sidebar em Azul União (#2B5690), ações e destaques em Vermelho União (#E9403C) e área operacional clara de alto contraste.",
    logoVariantSidebar: "positivo_azul",
    logoVariantLogin: "original",
    tokens: {
      "--uniao-font": "'Montserrat', system-ui, -apple-system, sans-serif",
      "--uniao-red": "#E9403C",
      "--uniao-red-hover": "#D12F2B",
      "--uniao-red-soft": "#FEF2F2",
      "--uniao-blue": "#2B5690",
      "--uniao-blue-hover": "#224678",
      "--uniao-blue-deep": "#1B3963",
      "--uniao-blue-soft": "#EBF2FA",
      "--uniao-app-bg": "#F0F4F9",
      "--uniao-card-bg": "#FFFFFF",
      "--uniao-surface-subtle": "#F6F9FC",
      "--uniao-border": "#D5E0EE",
      "--uniao-border-strong": "#B6C8E0",
      "--uniao-text-primary": "#142B4D",
      "--uniao-text-secondary": "#3B5273",
      "--uniao-text-muted": "#5E7494",
      "--uniao-sidebar-bg": "linear-gradient(180deg, #2B5690 0%, #1B3963 100%)",
      "--uniao-sidebar-solid": "#2B5690",
      "--uniao-sidebar-border": "#3A69A8",
      "--uniao-sidebar-text": "#F8FAFC",
      "--uniao-sidebar-muted": "#C5D8F0",
      "--uniao-sidebar-item-active-bg": "rgba(255, 255, 255, 0.14)",
      "--uniao-sidebar-item-active-text": "#FFFFFF",
      "--uniao-sidebar-item-active-border": "#E9403C",
      "--uniao-sidebar-box-bg": "rgba(20, 43, 77, 0.45)",
      "--uniao-btn-primary-bg": "#E9403C",
      "--uniao-btn-primary-text": "#FFFFFF",
      "--uniao-btn-secondary-bg": "#F6F9FC",
      "--uniao-btn-secondary-text": "#1B3963",
      "--uniao-btn-secondary-border": "#B6C8E0",
      "--uniao-tab-active-bg": "#2B5690",
      "--uniao-tab-active-text": "#FFFFFF",
      "--uniao-tab-active-border": "#2B5690",
      "--uniao-table-header-bg": "#2B5690",
      "--uniao-table-header-sub": "#1E3F6E",
      "--uniao-table-header-text": "#FFFFFF",
      "--uniao-sticky-accent": "#E9403C",
      "--uniao-login-bg": "linear-gradient(135deg, #1B3963 0%, #2B5690 55%, #E9403C 100%)",
      "--uniao-top-strip": "linear-gradient(90deg, #2B5690 0%, #2B5690 65%, #E9403C 100%)",
    },
  },

  uniao_alvorada: {
    id: "uniao_alvorada",
    name: "Alvorada Fundo Branco",
    badge: "Manual Pág. 03 / 08",
    manualRef: "Págs. 03, 08, 09 e 20 — Aplicação Primária em Fundo Branco",
    description:
      "Sidebar em fundo branco puro com o Logotipo Original sem contorno, realces em Azul União (#2B5690) e Vermelho União (#E9403C).",
    logoVariantSidebar: "original",
    logoVariantLogin: "original",
    tokens: {
      "--uniao-font": "'Montserrat', system-ui, -apple-system, sans-serif",
      "--uniao-red": "#E9403C",
      "--uniao-red-hover": "#D12F2B",
      "--uniao-red-soft": "#FEF2F2",
      "--uniao-blue": "#2B5690",
      "--uniao-blue-hover": "#224678",
      "--uniao-blue-deep": "#1B3963",
      "--uniao-blue-soft": "#EBF2FA",
      "--uniao-app-bg": "#F4F7FB",
      "--uniao-card-bg": "#FFFFFF",
      "--uniao-surface-subtle": "#F8FAFC",
      "--uniao-border": "#DCE5F2",
      "--uniao-border-strong": "#BCCCE3",
      "--uniao-text-primary": "#162D4C",
      "--uniao-text-secondary": "#3D5575",
      "--uniao-text-muted": "#64748B",
      "--uniao-sidebar-bg": "#FFFFFF",
      "--uniao-sidebar-solid": "#FFFFFF",
      "--uniao-sidebar-border": "#DCE5F2",
      "--uniao-sidebar-text": "#162D4C",
      "--uniao-sidebar-muted": "#5E7494",
      "--uniao-sidebar-item-active-bg": "#EBF2FA",
      "--uniao-sidebar-item-active-text": "#2B5690",
      "--uniao-sidebar-item-active-border": "#E9403C",
      "--uniao-sidebar-box-bg": "#F4F7FB",
      "--uniao-btn-primary-bg": "#2B5690",
      "--uniao-btn-primary-text": "#FFFFFF",
      "--uniao-btn-secondary-bg": "#FFFFFF",
      "--uniao-btn-secondary-text": "#2B5690",
      "--uniao-btn-secondary-border": "#B6C8E0",
      "--uniao-tab-active-bg": "#E9403C",
      "--uniao-tab-active-text": "#FFFFFF",
      "--uniao-tab-active-border": "#E9403C",
      "--uniao-table-header-bg": "#2B5690",
      "--uniao-table-header-sub": "#224678",
      "--uniao-table-header-text": "#FFFFFF",
      "--uniao-sticky-accent": "#E9403C",
      "--uniao-login-bg": "linear-gradient(135deg, #F0F4F9 0%, #DCE8F7 50%, #FDE8E8 100%)",
      "--uniao-top-strip": "linear-gradient(90deg, #E9403C 0%, #2B5690 100%)",
    },
  },

  uniao_energia: {
    id: "uniao_energia",
    name: "Energia Vermelho União",
    badge: "Manual Pág. 14 / 16",
    manualRef: "Págs. 14, 16 e 22 — Fundo Vermelho União & Site/App",
    description:
      "Protagonismo para o Vermelho União (#E9403C — Energia, Força e Expressão) combinado ao Azul União (#2B5690) nas grades.",
    logoVariantSidebar: "positivo_vermelho",
    logoVariantLogin: "original",
    tokens: {
      "--uniao-font": "'Montserrat', system-ui, -apple-system, sans-serif",
      "--uniao-red": "#E9403C",
      "--uniao-red-hover": "#C92E2A",
      "--uniao-red-soft": "#FEF2F2",
      "--uniao-blue": "#2B5690",
      "--uniao-blue-hover": "#224678",
      "--uniao-blue-deep": "#1B3963",
      "--uniao-blue-soft": "#EBF2FA",
      "--uniao-app-bg": "#F7F5F6",
      "--uniao-card-bg": "#FFFFFF",
      "--uniao-surface-subtle": "#FBF8F8",
      "--uniao-border": "#E8D8D8",
      "--uniao-border-strong": "#D9BDBD",
      "--uniao-text-primary": "#1E293B",
      "--uniao-text-secondary": "#475569",
      "--uniao-text-muted": "#64748B",
      "--uniao-sidebar-bg": "linear-gradient(180deg, #E9403C 0%, #B82320 55%, #1B3963 100%)",
      "--uniao-sidebar-solid": "#C92E2A",
      "--uniao-sidebar-border": "#F06562",
      "--uniao-sidebar-text": "#FFFFFF",
      "--uniao-sidebar-muted": "#FFE4E4",
      "--uniao-sidebar-item-active-bg": "rgba(255, 255, 255, 0.2)",
      "--uniao-sidebar-item-active-text": "#FFFFFF",
      "--uniao-sidebar-item-active-border": "#FFFFFF",
      "--uniao-sidebar-box-bg": "rgba(27, 57, 99, 0.55)",
      "--uniao-btn-primary-bg": "#E9403C",
      "--uniao-btn-primary-text": "#FFFFFF",
      "--uniao-btn-secondary-bg": "#FFF8F8",
      "--uniao-btn-secondary-text": "#2B5690",
      "--uniao-btn-secondary-border": "#D9BDBD",
      "--uniao-tab-active-bg": "#E9403C",
      "--uniao-tab-active-text": "#FFFFFF",
      "--uniao-tab-active-border": "#E9403C",
      "--uniao-table-header-bg": "#2B5690",
      "--uniao-table-header-sub": "#E9403C",
      "--uniao-table-header-text": "#FFFFFF",
      "--uniao-sticky-accent": "#E9403C",
      "--uniao-login-bg": "linear-gradient(135deg, #E9403C 0%, #B82320 50%, #2B5690 100%)",
      "--uniao-top-strip": "linear-gradient(90deg, #E9403C 0%, #E9403C 60%, #2B5690 100%)",
    },
  },

  uniao_noturno: {
    id: "uniao_noturno",
    name: "Noturno Fundo Preto",
    badge: "Manual Pág. 12 / 15",
    manualRef: "Págs. 12 e 15 — Positivo e Negativo Fundo Preto",
    description:
      "Aplicação oficial sobre Fundo Preto (#18181B) com logotipo Positivo Contornado em Branco e acentos em Vermelho e Azul União.",
    logoVariantSidebar: "positivo_preto",
    logoVariantLogin: "positivo_preto",
    tokens: {
      "--uniao-font": "'Montserrat', system-ui, -apple-system, sans-serif",
      "--uniao-red": "#E9403C",
      "--uniao-red-hover": "#F25753",
      "--uniao-red-soft": "#2D1A1E",
      "--uniao-blue": "#2B5690",
      "--uniao-blue-hover": "#3A6DB3",
      "--uniao-blue-deep": "#142B4D",
      "--uniao-blue-soft": "#1B293D",
      "--uniao-app-bg": "#12151C",
      "--uniao-card-bg": "#1B202B",
      "--uniao-surface-subtle": "#222836",
      "--uniao-border": "#2E374A",
      "--uniao-border-strong": "#3E4A63",
      "--uniao-text-primary": "#F1F5F9",
      "--uniao-text-secondary": "#CBD5E1",
      "--uniao-text-muted": "#94A3B8",
      "--uniao-sidebar-bg": "linear-gradient(180deg, #16181D 0%, #0F1115 100%)",
      "--uniao-sidebar-solid": "#16181D",
      "--uniao-sidebar-border": "#2A303C",
      "--uniao-sidebar-text": "#F8FAFC",
      "--uniao-sidebar-muted": "#94A3B8",
      "--uniao-sidebar-item-active-bg": "#232A38",
      "--uniao-sidebar-item-active-text": "#FFFFFF",
      "--uniao-sidebar-item-active-border": "#E9403C",
      "--uniao-sidebar-box-bg": "#1E2430",
      "--uniao-btn-primary-bg": "#E9403C",
      "--uniao-btn-primary-text": "#FFFFFF",
      "--uniao-btn-secondary-bg": "#232A38",
      "--uniao-btn-secondary-text": "#F1F5F9",
      "--uniao-btn-secondary-border": "#3E4A63",
      "--uniao-tab-active-bg": "#E9403C",
      "--uniao-tab-active-text": "#FFFFFF",
      "--uniao-tab-active-border": "#E9403C",
      "--uniao-table-header-bg": "#1E3A66",
      "--uniao-table-header-sub": "#15294A",
      "--uniao-table-header-text": "#FFFFFF",
      "--uniao-sticky-accent": "#E9403C",
      "--uniao-login-bg": "linear-gradient(135deg, #0F1115 0%, #1B2436 60%, #2B5690 100%)",
      "--uniao-top-strip": "linear-gradient(90deg, #E9403C 0%, #2B5690 100%)",
    },
  },
};

export function getStoredUniaoThemeId() {
  if (typeof window === "undefined") return "uniao_institucional";
  try {
    const saved = window.localStorage.getItem(UNIAO_THEME_STORAGE_KEY);
    if (saved && UNIAO_THEMES[saved]) return saved;
  } catch {
    // Fallback em ambiente restrito
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
      // Ignora erro de escrita local
    }
  }
  return theme;
}

// Dicionário de estilos padronizado dos módulos (CSS Custom Properties da Marca União)
export function createUniaoModuleUi(overrides = {}) {
  const base = {
    card: {
      background: "var(--uniao-card-bg, #ffffff)",
      border: "1px solid var(--uniao-border, #d5e0ee)",
      borderRadius: 10,
      padding: "16px 18px",
      color: "var(--uniao-text-primary, #142B4D)",
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--uniao-text-primary, #142B4D)",
      marginBottom: 6,
      letterSpacing: "-0.01em",
    },
    label: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--uniao-text-secondary, #3B5273)",
      display: "block",
      marginBottom: 4,
    },
    select: {
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 6,
      border: "1px solid var(--uniao-border-strong, #b6c8e0)",
      background: "var(--uniao-card-bg, #ffffff)",
      color: "var(--uniao-text-primary, #142B4D)",
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      boxSizing: "border-box",
    },
    input: {
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 6,
      border: "1px solid var(--uniao-border-strong, #b6c8e0)",
      background: "var(--uniao-card-bg, #ffffff)",
      color: "var(--uniao-text-primary, #142B4D)",
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      boxSizing: "border-box",
    },
    btnPrimary: {
      fontSize: 12,
      padding: "7px 14px",
      borderRadius: 6,
      border: "none",
      background: "var(--uniao-btn-primary-bg, #E9403C)",
      color: "var(--uniao-btn-primary-text, #ffffff)",
      fontWeight: 700,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnBlue: {
      fontSize: 12,
      padding: "7px 14px",
      borderRadius: 6,
      border: "none",
      background: "var(--uniao-blue, #2B5690)",
      color: "#ffffff",
      fontWeight: 700,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnSecondary: {
      fontSize: 12,
      padding: "6px 12px",
      borderRadius: 6,
      border: "1px solid var(--uniao-btn-secondary-border, #b6c8e0)",
      background: "var(--uniao-btn-secondary-bg, #f6f9fc)",
      color: "var(--uniao-btn-secondary-text, #1B3963)",
      fontWeight: 700,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    btnSmall: {
      fontSize: 11,
      padding: "4px 9px",
      borderRadius: 6,
      border: "1px solid var(--uniao-btn-secondary-border, #b6c8e0)",
      background: "var(--uniao-btn-secondary-bg, #f6f9fc)",
      color: "var(--uniao-btn-secondary-text, #1B3963)",
      fontWeight: 600,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    subTab: {
      fontSize: 12,
      padding: "8px 14px",
      borderRadius: 8,
      border: "1px solid var(--uniao-border-strong, #b6c8e0)",
      background: "var(--uniao-card-bg, #ffffff)",
      color: "var(--uniao-text-secondary, #3B5273)",
      fontWeight: 600,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    subTabActive: {
      fontSize: 12,
      padding: "8px 14px",
      borderRadius: 8,
      border: "1px solid var(--uniao-tab-active-border, #2B5690)",
      background: "var(--uniao-tab-active-bg, #2B5690)",
      color: "var(--uniao-tab-active-text, #ffffff)",
      fontWeight: 700,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    pill: {
      fontSize: 11,
      padding: "5px 11px",
      borderRadius: 999,
      border: "1px solid var(--uniao-border-strong, #b6c8e0)",
      background: "var(--uniao-surface-subtle, #f6f9fc)",
      color: "var(--uniao-text-secondary, #3B5273)",
      fontWeight: 600,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    pillActive: {
      fontSize: 11,
      padding: "5px 11px",
      borderRadius: 999,
      border: "1px solid var(--uniao-red, #E9403C)",
      background: "var(--uniao-red, #E9403C)",
      color: "#ffffff",
      fontWeight: 700,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
      cursor: "pointer",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 12,
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
    },
    th: {
      padding: "8px 10px",
      fontSize: 11,
      fontWeight: 700,
      textAlign: "center",
      border: "1px solid var(--uniao-border-strong, #b6c8e0)",
    },
    td: {
      padding: "7px 10px",
      border: "1px solid var(--uniao-border, #d5e0ee)",
    },
    qaBox: {
      background: "var(--uniao-surface-subtle, #f6f9fc)",
      border: "1px solid var(--uniao-border, #d5e0ee)",
      borderRadius: 8,
      padding: "12px 14px",
    },
    optionBox: {
      border: "1px solid var(--uniao-border-strong, #b6c8e0)",
      borderRadius: 8,
      padding: "10px 12px",
      background: "var(--uniao-surface-subtle, #f6f9fc)",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(20, 43, 77, 0.62)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    modalBackdropTransparent: {
      position: "fixed",
      inset: 0,
      background: "transparent",
      zIndex: 2400,
    },
    modalCard: {
      background: "var(--uniao-card-bg, #ffffff)",
      color: "var(--uniao-text-primary, #142B4D)",
      borderRadius: 12,
      padding: "20px 22px",
      width: 560,
      maxWidth: "94%",
      boxShadow: "0 16px 40px rgba(20, 43, 77, 0.28)",
      borderTop: "4px solid var(--uniao-red, #E9403C)",
      fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
    },
  };

  const merged = { ...base };
  Object.keys(overrides).forEach((k) => {
    merged[k] = { ...(base[k] || {}), ...overrides[k] };
  });
  return merged;
}
