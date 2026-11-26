// =============================================================================
// VISUALIZAÇÃO PRÉVIA FIEL E IMPRESSÃO / PDF DA ESCALA MENSAL (A4 PAISAGEM)
//
// Combina a estrutura documental corporativa do ERP com a leitura imediata da
// escala tradicional do União Supermercados:
//   • Células de trabalho normais: brancas e limpas (sem letra "T")
//   • Células de folga: preenchimento integral preto (#000000) com SVG vetorial
//     embutido para garantir impressão física mesmo sem "gráficos de plano de fundo"
//   • Domingos/feriados trabalhados c/ intervalo: somente o número ("1" a "4")
//   • Férias e afastamentos consecutivos: faixa horizontal unificada (colSpan)
//   • Classificação das datas concentrada nos cabeçalhos das colunas
// =============================================================================

import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import UniaoLogo from "../../components/UniaoLogo.jsx";
import { Button, Badge, Icon } from "../../ui/index.jsx";
import {
  buildSchedulePrintDocument,
  listPrintableUnitSectors,
} from "../../domain/schedulePrintDocument.js";
import { downloadSchedulePdf } from "../../domain/schedulePdfExporter.js";
import "./schedulePrint.css";

export function SchedulePrintSheet({ doc, page, idPrefix = "preview" }) {
  const g = doc.geometry;
  const totalCols = 1 + (doc.includeJourneyDetails ? 1 : 0) + doc.days.length;
  const intervalsSummary = (doc.configuredLunchIntervals || [])
    .map((it) => `${it.slot}: ${it.horario}`)
    .join(" · ");

  return (
    <section
      className="erp-print-sheet"
      aria-label={`Página ${page.pageNumber} de ${page.totalPages}`}
      data-page-number={page.pageNumber}
    >
      <div className="erp-print-sheet-top">
        {/* CABEÇALHO DOCUMENTAL INSTITUCIONAL REPETIDO EM CADA PÁGINA */}
        <header className="erp-print-doc-header">
          <div className="erp-print-doc-brand">
            <UniaoLogo
              variant="original"
              size="sm"
              idSuffix={`${idPrefix}_p${page.pageNumber}`}
            />
            <span className="erp-print-doc-brand-divider" aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "8.8pt",
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "0.01em",
                  lineHeight: 1.15,
                }}
              >
                ESCALA MENSAL DE TRABALHO E FOLGAS
              </div>
              <div
                style={{
                  fontSize: "6.8pt",
                  fontWeight: 700,
                  color: "#1E3A8A",
                  marginTop: "0.5mm",
                }}
              >
                {doc.unitFiscalLabel || doc.companyLegalName} · Unidade: {doc.unitName}
                {doc.unitCity ? ` (${doc.unitCity}${doc.unitState ? `/${doc.unitState}` : ""})` : ""}
              </div>
              <div
                style={{
                  fontSize: "6.1pt",
                  color: "#334155",
                  marginTop: "0.4mm",
                }}
              >
                {doc.scopeDescription} · {doc.totalEmployees} colaborador(es) ativos no quadro
              </div>
            </div>
          </div>

          <div className="erp-print-doc-meta-box">
            <div style={{ fontWeight: 800, color: "#0F172A", fontSize: "6.6pt" }}>
              COMPETÊNCIA: {doc.competenceLabel.toUpperCase()} ({doc.yearMonth})
            </div>
            <div>
              Situação: <strong>{doc.scheduleStatusLabel}</strong> · Versão #
              {doc.versionNumber}
            </div>
            <div style={{ fontWeight: 700, color: "#2B5690" }}>
              Dias do mês: 01 a {String(doc.days.length).padStart(2, "0")} · Página{" "}
              {page.pageNumber} de {page.totalPages}
            </div>
          </div>
        </header>

        {/* TABELA HORIZONTAL FIXA — TODOS OS DIAS DO MÊS EM 1 PÁGINA */}
        <table className="erp-print-table">
          <colgroup>
            <col style={{ width: `${g.collabColWidthMm}mm` }} />
            {doc.includeJourneyDetails && (
              <col style={{ width: `${g.journeyColWidthMm}mm` }} />
            )}
            {doc.days.map((d) => (
              <col key={d.isoDate} style={{ width: `${g.dayColWidthMm}mm` }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <th
                style={{
                  background: "#E2E8F0",
                  color: "#0F172A",
                  textAlign: "left",
                  paddingLeft: "1.8mm",
                  fontSize: "6.5pt",
                  fontWeight: 800,
                }}
              >
                COLABORADOR / FUNÇÃO
              </th>
              {doc.includeJourneyDetails && (
                <th
                  style={{
                    background: "#E2E8F0",
                    color: "#0F172A",
                    textAlign: "center",
                    fontSize: "6.0pt",
                    fontWeight: 800,
                  }}
                >
                  JORNADA · REGRA
                </th>
              )}
              {doc.days.map((day) => (
                <th
                  key={day.isoDate}
                  title={day.tooltip}
                  data-header-tone={day.headerTone}
                  style={{
                    background: day.headerBgHex,
                    color: day.headerTextHex,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "4.7pt", fontWeight: 700, lineHeight: 1.05 }}>
                    {day.dowLabel}
                  </div>
                  <div style={{ fontSize: "6.6pt", fontWeight: 800, lineHeight: 1.1 }}>
                    {day.dayNumber}
                  </div>
                  {day.headerSubTag && (
                    <div style={{ fontSize: "4.1pt", fontWeight: 800, lineHeight: 1.0 }}>
                      {day.headerSubTag}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {page.blocks.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  style={{
                    height: "18mm",
                    textAlign: "center",
                    fontSize: "7.8pt",
                    color: "#334155",
                  }}
                >
                  Nenhum posto preenchido encontrado para os setores selecionados nesta competência.
                </td>
              </tr>
            ) : (
              page.blocks.map((block) => (
                <Fragment key={`${block.sectorId}_${block.isContinuation ? "cont" : "start"}`}>
                  <tr className="erp-print-sector-row">
                    <td colSpan={totalCols}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "6.8pt",
                            fontWeight: 800,
                            color: "#0F172A",
                            letterSpacing: "0.02em",
                          }}
                        >
                          SETOR: {block.displayTitle.toUpperCase()}
                        </strong>
                        <span
                          style={{
                            fontSize: "5.7pt",
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          {block.rows.length} nesta página · {block.totalEmployeesInSector} no setor
                        </span>
                      </div>
                    </td>
                  </tr>

                  {block.rows.map((row) => {
                    const spansToRender =
                      row.cellSpans ||
                      row.cells.map((c, idx) => ({
                        ...c,
                        isSpan: false,
                        spanLength: 1,
                        startDayIndex: idx,
                      }));

                    return (
                      <tr key={row.rowId} style={{ height: `${row.rowHeightMm}mm` }}>
                        <td className="erp-print-collab-cell">
                          <div className="erp-print-collab-name">{row.fullName}</div>
                          <div className="erp-print-collab-role">
                            {row.positionCode} · {row.positionTitle}
                          </div>
                        </td>

                        {doc.includeJourneyDetails && (
                          <td className="erp-print-journey-cell">
                            <div
                              style={{
                                fontSize: "5.7pt",
                                fontWeight: 700,
                                color: "#0F172A",
                                lineHeight: 1.15,
                              }}
                            >
                              {row.shiftLabel}
                            </div>
                            <div
                              style={{
                                fontSize: "5.0pt",
                                fontWeight: 700,
                                color: "#1E3A8A",
                                lineHeight: 1.15,
                              }}
                            >
                              {row.ruleLabel}
                              {row.workloadLabel
                                ? ` · ${row.workloadLabel.split("·")[0].trim()}`
                                : ""}
                            </div>
                          </td>
                        )}

                        {spansToRender.map((span) => {
                          if (span.isBlackRest) {
                            return (
                              <td
                                key={span.isoDate}
                                className="erp-print-day-cell erp-print-day-cell--rest-black"
                                data-cell-variant="REST_BLACK"
                                aria-label="Dia de folga"
                              >
                                {/* Retângulo SVG vetorial garante impressão preta sólida em 100% dos navegadores */}
                                <svg
                                  viewBox="0 0 10 10"
                                  preserveAspectRatio="none"
                                  aria-hidden="true"
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    display: "block",
                                  }}
                                >
                                  <rect width="10" height="10" fill="#000000" />
                                </svg>
                              </td>
                            );
                          }

                          if (span.isGroupableAbsence) {
                            const fontPt =
                              span.spanLength >= 4
                                ? "6.0pt"
                                : span.spanLength >= 2
                                  ? "5.4pt"
                                  : "5.1pt";
                            return (
                              <td
                                key={span.startIsoDate || span.isoDate}
                                colSpan={span.spanLength}
                                className="erp-print-absence-span-cell"
                                data-cell-variant="SPECIAL_ABSENCE"
                                style={{
                                  background: span.bgHex,
                                  color: span.textHex,
                                  borderColor: span.borderHex || "#475569",
                                  fontSize: fontPt,
                                }}
                              >
                                {span.displayText}
                              </td>
                            );
                          }

                          const isSingleDigit = /^[1-9]$/.test(span.displayText || "");
                          return (
                            <td
                              key={span.isoDate}
                              className="erp-print-day-cell"
                              data-cell-variant={span.variant}
                              style={{
                                background: span.bgHex || "#FFFFFF",
                                color: span.textHex || "#000000",
                              }}
                            >
                              {span.displayText ? (
                                span.subText ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      lineHeight: 1.0,
                                    }}
                                  >
                                    <span style={{ fontSize: "7.2pt", fontWeight: 800 }}>
                                      {span.displayText}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "4.4pt",
                                        fontWeight: 800,
                                        color: "#78350F",
                                      }}
                                    >
                                      {span.subText}
                                    </span>
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: isSingleDigit ? "8.0pt" : "5.5pt",
                                      fontWeight: 800,
                                      lineHeight: 1,
                                    }}
                                  >
                                    {span.displayText}
                                  </span>
                                )
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* RODAPÉ FIXO COM LEGENDA GRÁFICA REAL (Seção 1.7) E NUMERAÇÃO DE PÁGINAS */}
      <footer className="erp-print-doc-footer">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7mm" }}>
          <div className="erp-print-legend-row">
            <strong style={{ color: "#0F172A" }}>LEGENDA:</strong>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#FFFFFF", border: "0.35mm solid #334155" }}
              />
              <strong>Dia de trabalho</strong>
            </span>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#000000", border: "0.35mm solid #000000" }}
              />
              <strong>Dia de folga</strong>
            </span>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{
                  width: "4.6mm",
                  background: "#FFFFFF",
                  border: "0.35mm solid #334155",
                  fontSize: "4.9pt",
                  fontWeight: 800,
                  color: "#000000",
                }}
              >
                1..4
              </span>
              <span>
                <strong>Intervalo Dom/Feriado</strong> ({intervalsSummary})
              </span>
            </span>
          </div>

          <div className="erp-print-legend-row">
            <strong style={{ color: "#0F172A" }}>CABEÇALHOS:</strong>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#CBD5E1", border: "0.3mm solid #475569" }}
              />
              <span>Domingo</span>
            </span>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#2B5690", border: "0.3mm solid #1E3A8A" }}
              />
              <span>Feriado</span>
            </span>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#E9403C", border: "0.3mm solid #991B1B" }}
              />
              <span>Data Especial / Maior Movimento</span>
            </span>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#FDE68A", border: "0.3mm solid #B45309" }}
              />
              <span>Meio Expediente (1/2)</span>
            </span>
            <span className="erp-print-legend-item">
              <span
                className="erp-print-swatch"
                style={{ background: "#FEF3C7", border: "0.3mm solid #B45309" }}
              />
              <span
                className="erp-print-swatch"
                style={{ background: "#EDE9FE", border: "0.3mm solid #5B21B6" }}
              />
              <span>Faixas horizontais: Férias / Licenças / Afastamento INSS</span>
            </span>
          </div>
        </div>

        <div style={{ fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
          Emitido em {doc.emittedAtFormatted} · Página {page.pageNumber} de {page.totalPages}
        </div>
      </footer>
    </section>
  );
}

export default function SchedulePrintPreviewModal({
  open,
  onClose,
  db,
  unitId,
  yearMonth,
  initialFilterSectorId = "",
}) {
  const availableSectors = useMemo(
    () => (open ? listPrintableUnitSectors({ db, unitId, yearMonth }) : []),
    [open, db, unitId, yearMonth]
  );

  const [sectorScope, setSectorScope] = useState(() =>
    initialFilterSectorId ? "SELECTED" : "ALL"
  );
  const [selectedSectorIds, setSelectedSectorIds] = useState(() =>
    initialFilterSectorId ? [initialFilterSectorId] : availableSectors.map((s) => s.id)
  );
  const [includeJourneyDetails, setIncludeJourneyDetails] = useState(false);
  const [previewZoom, setPreviewZoom] = useState("0.88");
  const [pdfFeedback, setPdfFeedback] = useState("");

  useEffect(() => {
    if (!open) return;
    document.body.dataset.erpPrintingSchedule = "true";
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      delete document.body.dataset.erpPrintingSchedule;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const docModel = useMemo(() => {
    if (!open) return null;
    return buildSchedulePrintDocument({
      db,
      unitId,
      yearMonth,
      sectorScope,
      selectedSectorIds,
      includeJourneyDetails,
    });
  }, [open, db, unitId, yearMonth, sectorScope, selectedSectorIds, includeJourneyDetails]);

  if (!open || !docModel) return null;

  const toggleSectorId = (secId) => {
    setSelectedSectorIds((prev) =>
      prev.includes(secId) ? prev.filter((id) => id !== secId) : [...prev, secId]
    );
  };

  const handlePrintPhysical = () => {
    const prevTitle = document.title;
    document.title = docModel.fileName.replace(/\.pdf$/i, "");
    try {
      window.print();
    } finally {
      setTimeout(() => {
        document.title = prevTitle;
      }, 600);
    }
  };

  const handleExportPdf = () => {
    const out = downloadSchedulePdf(docModel);
    setPdfFeedback(`PDF salvo: ${out.fileName}`);
    setTimeout(() => setPdfFeedback(""), 4500);
  };

  const zoomNum = Number(previewZoom) || 0.88;

  return (
    <>
      <div
        className="erp-print-preview-backdrop no-print"
        role="dialog"
        aria-modal="true"
        aria-label="Visualização prévia de impressão e exportação em PDF da escala mensal"
      >
        {/* BARRA DE AÇÕES PRINCIPAIS */}
        <div className="erp-print-preview-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Icon name="printer" size={18} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Visualização prévia · {docModel.unitName} · {docModel.competenceLabel}
              </div>
              <div style={{ fontSize: 11.5, color: "#94A3B8" }}>
                Formato A4 Paisagem · {docModel.totalPages} página(s) · {docModel.totalSectors}{" "}
                setor(es) · {docModel.totalEmployees} colaborador(es) · Todos os{" "}
                {docModel.days.length} dias em página única
              </div>
            </div>
            {pdfFeedback && <Badge tone="success">{pdfFeedback}</Badge>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              size="sm"
              icon="download"
              disabled={docModel.totalEmployees === 0}
              onClick={handleExportPdf}
              title={`Baixar ${docModel.fileName} (texto selecionável e pesquisável)`}
            >
              Salvar em PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="printer"
              disabled={docModel.totalEmployees === 0}
              onClick={handlePrintPhysical}
            >
              Imprimir escala
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              icon="x"
              onClick={onClose}
              style={{ color: "#E2E8F0" }}
            >
              Fechar
            </Button>
          </div>
        </div>

        {/* BARRA DE OPÇÕES OBJETIVAS DE IMPRESSÃO (Seção 1.7) */}
        <div className="erp-print-preview-options-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 700, color: "#334155" }}>Escopo:</span>
              <button
                type="button"
                className={`erp-btn erp-btn--sm ${
                  sectorScope === "ALL" ? "erp-btn--primary" : "erp-btn--secondary"
                }`}
                onClick={() => setSectorScope("ALL")}
              >
                Escala completa ({availableSectors.length} setores)
              </button>
              <button
                type="button"
                className={`erp-btn erp-btn--sm ${
                  sectorScope === "SELECTED" ? "erp-btn--primary" : "erp-btn--secondary"
                }`}
                onClick={() => {
                  setSectorScope("SELECTED");
                  if (selectedSectorIds.length === 0) {
                    setSelectedSectorIds(availableSectors.map((s) => s.id));
                  }
                }}
              >
                Selecionar setores
              </button>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={includeJourneyDetails}
                onChange={(e) => setIncludeJourneyDetails(e.target.checked)}
              />
              Incluir jornada e regra de escala
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#64748B", fontSize: 11.5 }}>
              Arquivo: <strong style={{ color: "#0F172A" }}>{docModel.fileName}</strong>
            </span>
            <select
              aria-label="Zoom da visualização prévia"
              value={previewZoom}
              onChange={(e) => setPreviewZoom(e.target.value)}
              className="erp-select erp-select--sm"
              style={{ width: 118 }}
            >
              <option value="0.75">Zoom 75%</option>
              <option value="0.88">Ajustar (88%)</option>
              <option value="1">Tamanho real (100%)</option>
              <option value="1.12">Ampliar (112%)</option>
            </select>
          </div>
        </div>

        {sectorScope === "SELECTED" && (
          <div className="erp-print-sector-drawer">
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#334155", marginRight: 4 }}>
              Setores incluídos:
            </span>
            {availableSectors.map((sec) => {
              const isSelected = selectedSectorIds.includes(sec.id);
              return (
                <button
                  key={sec.id}
                  type="button"
                  className="erp-print-sector-chip"
                  data-selected={isSelected ? "true" : "false"}
                  onClick={() => toggleSectorId(sec.id)}
                >
                  <Icon name={isSelected ? "check" : "plus"} size={12} />
                  <span>
                    {sec.name} ({sec.filledCount})
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="erp-btn erp-btn--tertiary erp-btn--sm"
              onClick={() => setSelectedSectorIds(availableSectors.map((s) => s.id))}
            >
              Marcar todos
            </button>
            <button
              type="button"
              className="erp-btn erp-btn--tertiary erp-btn--sm"
              onClick={() => setSelectedSectorIds([])}
            >
              Limpar seleção
            </button>
          </div>
        )}

        {/* PALCO DE FOLHAS A4 PAISAGEM FIEIS AO RESULTADO IMPRESSO / PDF */}
        <div className="erp-print-preview-stage">
          {docModel.pages.map((page) => (
            <div
              key={page.pageNumber}
              style={{
                transform: `scale(${zoomNum})`,
                transformOrigin: "top center",
                marginBottom: zoomNum < 1 ? `${(zoomNum - 1) * 210}mm` : 0,
              }}
            >
              <SchedulePrintSheet
                doc={docModel}
                page={page}
                idPrefix="preview_sheet"
              />
            </div>
          ))}
        </div>
      </div>

      {/* PORTAL DEDICADO DE IMPRESSÃO FÍSICA (ISOLADO DE QUALQUER SCROLL/CHROME DO ERP) */}
      {typeof document !== "undefined" &&
        createPortal(
          <div id="erp-print-portal-root" className="erp-print-portal-only">
            {docModel.pages.map((page) => (
              <SchedulePrintSheet
                key={page.pageNumber}
                doc={docModel}
                page={page}
                idPrefix="print_sheet"
              />
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Portal silencioso ativo enquanto o módulo de escalas está aberto (quando o modal
 * de pré-visualização está fechado), garantindo que até um `Ctrl+P` direto imprima
 * o documento A4 Paisagem paginado e sem postos vagos.
 */
export function ScheduleDefaultPrintPortal({ db, unitId, yearMonth, disabled = false }) {
  useEffect(() => {
    if (disabled || typeof document === "undefined") return;
    document.body.dataset.erpPrintingSchedule = "true";
    return () => {
      delete document.body.dataset.erpPrintingSchedule;
    };
  }, [disabled]);

  const docModel = useMemo(() => {
    if (disabled) return null;
    return buildSchedulePrintDocument({
      db,
      unitId,
      yearMonth,
      sectorScope: "ALL",
      includeJourneyDetails: false,
    });
  }, [disabled, db, unitId, yearMonth]);

  if (disabled || !docModel || typeof document === "undefined") return null;

  return createPortal(
    <div id="erp-print-portal-root" className="erp-print-portal-only">
      {docModel.pages.map((page) => (
        <SchedulePrintSheet
          key={page.pageNumber}
          doc={docModel}
          page={page}
          idPrefix="ctrlp_sheet"
        />
      ))}
    </div>,
    document.body
  );
}
