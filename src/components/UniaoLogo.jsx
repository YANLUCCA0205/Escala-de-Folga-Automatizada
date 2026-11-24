// =============================================================================
// COMPONENTE VETORIAL DO LOGOTIPO OFICIAL — UNIÃO SUPERMERCADOS
// Fiel às Páginas 03, 08, 09, 10, 11 e 12 a 20 do Manual de Identidade Visual:
//   • Símbolo Coração com Onda (Vermelho #E9403C + Azul #2B5690)
//   • Escrita "união" (estilizada c/ til exclusivo) + "supermercados" (Montserrat Bold)
//   • Modos de aplicação do Manual:
//     - 'original'          (Pág. 03 / 08 — Fundo Branco/Claro)
//     - 'box_branco'        (Pág. 20 — Box Branco de Proteção p/ Fundos Instáveis/Escuros)
//     - 'positivo_azul'     (Pág. 17 — Positivo Fundo Azul c/ contorno branco)
//     - 'negativo_azul'     (Pág. 13 — Negativo Fundo Azul monocromático branco)
//     - 'positivo_vermelho' (Pág. 16 — Positivo Fundo Vermelho)
//     - 'negativo_vermelho' (Pág. 14 — Negativo Fundo Vermelho monocromático branco)
//     - 'positivo_preto'    (Pág. 15 — Positivo Fundo Preto c/ contorno branco)
//     - 'negativo_preto'    (Pág. 12 — Negativo Fundo Preto monocromático branco)
// =============================================================================

import { UNIAO_BRAND_MANUAL, UNIAO_THEMES } from "../theme/uniaoTheme.js";

export function UniaoHeartSymbol({
  size = 42,
  variant = "original",
  idSuffix = "default",
}) {
  const clipId = `uniaoHeartClip_${idSuffix}`;
  const isNegative =
    variant === "negativo_azul" ||
    variant === "negativo_vermelho" ||
    variant === "negativo_preto";
  const hasWhiteStroke =
    variant === "positivo_azul" ||
    variant === "positivo_vermelho" ||
    variant === "positivo_preto";

  const heartPath =
    "M60 98C57.5 98 10 68.5 10 35.5C10 17.5 24.5 5 41.5 5C50.8 5 56.8 9.8 60 15.2C63.2 9.8 69.2 5 78.5 5C95.5 5 110 17.5 110 35.5C110 68.5 62.5 98 60 98Z";
  const lowerWavePath =
    "M4 47C16 33 38 42 58 58C77 73 98 73 116 52L120 106L0 106Z";

  return (
    <svg
      width={size}
      height={Math.round(size * 0.88)}
      viewBox="0 0 120 106"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "block" }}
      aria-label="Símbolo Coração União Supermercados"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={heartPath} />
        </clipPath>
      </defs>

      {isNegative ? (
        <>
          <path
            d={heartPath}
            stroke="#FFFFFF"
            strokeWidth="3.5"
            fill="none"
          />
          <g clipPath={`url(#${clipId})`}>
            {/* No modo Negativo (Págs. 12, 13, 14), a parte superior da onda é preenchida em branco */}
            <path
              d="M0 0H120V52C98 73 77 73 58 58C38 42 16 33 4 47L0 47V0Z"
              fill="#FFFFFF"
            />
          </g>
        </>
      ) : (
        <>
          <g clipPath={`url(#${clipId})`}>
            {/* Parte superior da onda: Vermelho União #E9403C */}
            <rect x="0" y="0" width="120" height="106" fill="#E9403C" />
            {/* Parte inferior da onda: Azul União #2B5690 */}
            <path d={lowerWavePath} fill="#2B5690" />
          </g>
          {hasWhiteStroke && (
            <path
              d={heartPath}
              stroke="#FFFFFF"
              strokeWidth="3.8"
              fill="none"
            />
          )}
        </>
      )}
    </svg>
  );
}

export default function UniaoLogo({
  variant = "original",
  layout = "horizontal", // 'horizontal' | 'vertical' | 'symbol'
  size = "md", // 'sm' | 'md' | 'lg'
  idSuffix = "logo",
  style = {},
}) {
  const scaleMap = {
    sm: { heart: 34, uniaoFont: 25, subFont: 8.5, pad: "6px 10px", gap: 8 },
    md: { heart: 44, uniaoFont: 32, subFont: 10.5, pad: "8px 12px", gap: 10 },
    lg: { heart: 58, uniaoFont: 42, subFont: 13.5, pad: "10px 16px", gap: 12 },
  };
  const cfg = scaleMap[size] || scaleMap.md;

  if (layout === "symbol") {
    return <UniaoHeartSymbol size={cfg.heart} variant={variant} idSuffix={idSuffix} />;
  }

  const isBoxBranco = variant === "box_branco";
  const effectiveVariant = isBoxBranco ? "original" : variant;

  const isNegative =
    effectiveVariant === "negativo_azul" ||
    effectiveVariant === "negativo_vermelho" ||
    effectiveVariant === "negativo_preto";

  const hasWhiteOutline =
    effectiveVariant === "positivo_azul" ||
    effectiveVariant === "positivo_preto";

  const isPositivoVermelho = effectiveVariant === "positivo_vermelho";

  // Cor da palavra "união" conforme páginas 03, 12-17 do Manual
  const uniaoColor = isNegative
    ? "#FFFFFF"
    : isPositivoVermelho
      ? "transparent"
      : "#E9403C";

  const uniaoTextStroke = isPositivoVermelho
    ? "1.6px #FFFFFF"
    : hasWhiteOutline
      ? "1.2px #FFFFFF"
      : "none";

  // Cor da palavra "supermercados" (Montserrat Bold) conforme páginas 03, 12-17 do Manual
  const subColor = isNegative ? "#FFFFFF" : "#2B5690";
  const subTextShadow =
    hasWhiteOutline || isPositivoVermelho
      ? "-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF"
      : "none";

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: layout === "vertical" ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: cfg.gap,
        background: isBoxBranco ? "#FFFFFF" : "transparent",
        padding: isBoxBranco ? cfg.pad : 0,
        borderRadius: isBoxBranco ? 10 : 0,
        boxShadow: isBoxBranco ? "0 4px 14px rgba(0, 0, 0, 0.14)" : "none",
        userSelect: "none",
        ...style,
      }}
    >
      <UniaoHeartSymbol
        size={cfg.heart}
        variant={effectiveVariant}
        idSuffix={idSuffix}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: layout === "vertical" ? "center" : "flex-start",
          lineHeight: 1,
        }}
      >
        <div
          style={{
            fontFamily: "'Montserrat', 'Arial Rounded MT Bold', sans-serif",
            fontWeight: 900,
            fontSize: cfg.uniaoFont,
            letterSpacing: "-0.045em",
            color: uniaoColor,
            WebkitTextStroke: uniaoTextStroke,
            paintOrder: "stroke fill",
            lineHeight: 0.92,
            textTransform: "lowercase",
          }}
        >
          união
        </div>
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: cfg.subFont,
            letterSpacing: "0.02em",
            color: subColor,
            textShadow: subTextShadow,
            marginTop: 2,
            textTransform: "lowercase",
          }}
        >
          supermercados
        </div>
      </div>
    </div>
  );
}

// Modal de Referência Rápida do Manual de Identidade Visual & Seletor de Temas
export function UniaoBrandManualModal({
  open,
  onClose,
  activeThemeId,
  onSelectTheme,
}) {
  if (!open) return null;

  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 43, 77, 0.65)",
        zIndex: 3500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--uniao-card-bg, #FFFFFF)",
          color: "var(--uniao-text-primary, #142B4D)",
          borderRadius: 14,
          width: 780,
          maxWidth: "96%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
          borderTop: "5px solid #E9403C",
          fontFamily: "'Montserrat', sans-serif",
          padding: "22px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--uniao-border, #D5E0EE)",
            paddingBottom: 14,
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <UniaoLogo variant="box_branco" size="sm" idSuffix="modal_hdr" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Manual de Identidade Visual — União Supermercados
              </div>
              <div style={{ fontSize: 11.5, color: "var(--uniao-text-muted, #5E7494)" }}>
                Código Oficial de Cores (RGB / CMYK / Pantone), Tipografia Montserrat e Temas de Aplicação
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "#E9403C",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Fechar
          </button>
        </div>

        {/* 1. Seletor de Temas Oficiais em Execução */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            🎨 1. Escolha o Tema de Aplicação da Marca no Sistema
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {Object.values(UNIAO_THEMES).map((t) => {
              const isSelected = activeThemeId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTheme(t.id)}
                  style={{
                    border: isSelected
                      ? "2px solid #E9403C"
                      : "1px solid var(--uniao-border-strong, #B6C8E0)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    cursor: "pointer",
                    background: isSelected
                      ? "var(--uniao-surface-subtle, #F6F9FC)"
                      : "var(--uniao-card-bg, #FFFFFF)",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t.name}</span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: isSelected ? "#E9403C" : "#2B5690",
                        color: "#FFFFFF",
                      }}
                    >
                      {isSelected ? "✓ ATIVO" : t.badge}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--uniao-text-muted, #5E7494)",
                      marginBottom: 6,
                    }}
                  >
                    <strong>Ref. Manual:</strong> {t.manualRef}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.35 }}>{t.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Paleta de Cores Oficial (Página 18) */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            🎯 2. Paleta de Cores Oficial (Página 18 do Manual)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div
              style={{
                background: "#E9403C",
                color: "#FFFFFF",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                VERMELHO UNIÃO ({UNIAO_BRAND_MANUAL.colors.red.hex})
              </div>
              <div style={{ fontSize: 11, opacity: 0.92, marginTop: 2 }}>
                Conceito (Pág. 01): <strong>{UNIAO_BRAND_MANUAL.colors.red.meaning}</strong>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  fontWeight: 700,
                }}
              >
                <span>RGB: 233-64-60</span>
                <span>CMYK: 2-95-94-0</span>
                <span>Pantone: 485 C</span>
              </div>
            </div>

            <div
              style={{
                background: "#2B5690",
                color: "#FFFFFF",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                AZUL UNIÃO ({UNIAO_BRAND_MANUAL.colors.blue.hex})
              </div>
              <div style={{ fontSize: 11, opacity: 0.92, marginTop: 2 }}>
                Conceito (Pág. 01): <strong>{UNIAO_BRAND_MANUAL.colors.blue.meaning}</strong>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  fontWeight: 700,
                }}
              >
                <span>RGB: 43-86-144</span>
                <span>CMYK: 100-79-16-3</span>
                <span>Pantone: 293 C</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Demonstração de Fundos de Aplicação (Páginas 12 a 17) */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            🖼️ 3. Versões Oficiais de Fundo do Logotipo (Páginas 12 a 17)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
              gap: 10,
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: 8,
                padding: 12,
                textAlign: "center",
              }}
            >
              <UniaoLogo variant="original" size="sm" idSuffix="p03" />
              <div style={{ fontSize: 10, color: "#475569", marginTop: 6, fontWeight: 700 }}>
                Original (Pág. 03/08)
              </div>
            </div>

            <div
              style={{
                background: "#2B5690",
                borderRadius: 8,
                padding: 12,
                textAlign: "center",
              }}
            >
              <UniaoLogo variant="positivo_azul" size="sm" idSuffix="p17" />
              <div style={{ fontSize: 10, color: "#E2E8F0", marginTop: 6, fontWeight: 700 }}>
                Positivo Fundo Azul (Pág. 17)
              </div>
            </div>

            <div
              style={{
                background: "#2B5690",
                borderRadius: 8,
                padding: 12,
                textAlign: "center",
              }}
            >
              <UniaoLogo variant="negativo_azul" size="sm" idSuffix="p13" />
              <div style={{ fontSize: 10, color: "#E2E8F0", marginTop: 6, fontWeight: 700 }}>
                Negativo Fundo Azul (Pág. 13)
              </div>
            </div>

            <div
              style={{
                background: "#E9403C",
                borderRadius: 8,
                padding: 12,
                textAlign: "center",
              }}
            >
              <UniaoLogo variant="negativo_vermelho" size="sm" idSuffix="p14" />
              <div style={{ fontSize: 10, color: "#FFFFFF", marginTop: 6, fontWeight: 700 }}>
                Negativo Vermelho (Pág. 14)
              </div>
            </div>
          </div>
        </div>

        {/* 4. Endereços Oficiais das Lojas (Página 24 — Frota) */}
        <div
          style={{
            background: "var(--uniao-surface-subtle, #F6F9FC)",
            border: "1px solid var(--uniao-border, #D5E0EE)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 11,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            🏬 Unidades União Supermercados (Página 24 — Sinalização de Frota):
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {Object.values(UNIAO_BRAND_MANUAL.stores).map((st) => (
              <div key={st.code}>
                <strong>{st.name}:</strong> {st.address} — {st.city}/{st.state} · {st.phone}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
