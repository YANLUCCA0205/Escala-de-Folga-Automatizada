// =============================================================================
// VISUALIZAÇÃO PRÉVIA FIEL E IMPRESSÃO / PDF DA ESCALA MENSAL (A4 PAISAGEM)
//
// Renderiza as páginas paginadas exatamente no formato A4 Paisagem (297×210mm):
//   • Na janela de pré-visualização interativa (com opções de setores, jornada e zoom)
//   • Em um portal dedicado (`#erp-print-portal-root`) em `document.body` para
//     impressão física sem qualquer interferência de containers ou barras do ERP
//   • Integrado ao exportador `downloadSchedulePdf` para salvar PDF pesquisável
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
                {doc.companyLegalName} · Unidade: {doc.unitName}
                {doc.unitCity ? ` (${doc.unitCity})` : ""}
              </div>
              <div
                style={{
                  fontSize: "6.1pt",
                  color: "#475569",
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
                  background: "#EEF2F7",
                  color: "#0F172A",
                  textAlign: "left",
                  paddingLeft: "1.8mm",
                  fontSize: "6.4pt",
                  fontWeight: 800,
                }}
              >
                COLABORADOR / FUNÇÃO
              </th>
              {doc.includeJourneyDetails && (
                <th
                  style={{
                    background: "#EEF2F7",
                    color: "#0F172A",
                    textAlign: "center",
                    fontSize: "5.9pt",
                    fontWeight: 800,
                  }}
                >
                  JORNADA · REGRA
                </th>
              )}
              {doc.days.map((day) => {
                let hdrBg = "#F8FAFC";
                let hdrFg = "#1E293B";
                if (day.headerTone === "closed") {
                  hdrBg = "#FEE2E2";
                  hdrFg = "#991B1B";
                } else if (day.headerTone === "half") {
                  hdrBg = "#FEF3C7";
                  hdrFg = "#92400E";
                } else if (day.headerTone === "sunday_holiday") {
                  hdrBg = "#E8EFF8";
                  hdrFg = "#1E3A8A";
                } else if (day.headerTone === "saturday") {
                  hdrBg = "#F1F5F9";
                  hdrFg = "#334155";
                }
                return (
                  <th
                    key={day.isoDate}
                    style={{
                      background: hdrBg,
                      color: hdrFg,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "4.7pt", fontWeight: 700, lineHeight: 1.05 }}>
                      {day.dowLabel}
                    </div>
                    <div style={{ fontSize: "6.5pt", fontWeight: 800, lineHeight: 1.15 }}>
                      {day.dayNumber}
                    </div>
                  </th>
                );
              })}
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
                    color: "#475569",
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
                            fontSize: "6.6pt",
                            fontWeight: 800,
                            color: "#0F1E36",
                            letterSpacing: "0.02em",
                          }}
                        >
                          SETOR: {block.displayTitle.toUpperCase()}
                        </strong>
                        <span
                          style={{
                            fontSize: "5.7pt",
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          {block.rows.length} nesta página · {block.totalEmployeesInSector} no setor
                        </span>
                      </div>
                    </td>
                  </tr>

                  {block.rows.map((row) => (
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
                              fontSize: "5.6pt",
                              fontWeight: 700,
                              color: "#0F172A",
                              lineHeight: 1.15,
                            }}
                          >
                            {row.shiftLabel}
                          </div>
                          <div
                            style={{
                              fontSize: "4.9pt",
                              fontWeight: 600,
                              color: "#2B5690",
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

                      {row.cells.map((cell) => {
                        const codePt =
                          cell.code.length >= 4
                            ? "4.9pt"
                            : cell.code.length === 3
                              ? "5.4pt"
                              : "6.3pt";
                        return (
                          <td
                            key={cell.isoDate}
                            className="erp-print-day-cell"
                            style={{
                              background: cell.bgHex,
                              color: cell.textHex,
                            }}
                          >
                            {cell.lunchSlot ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  lineHeight: 1.0,
                                }}
                              >
                                <span style={{ fontSize: "5.6pt", fontWeight: 800 }}>
                                  {cell.code}
                                </span>
                                <span
                                  style={{
                                    fontSize: "4.6pt",
                                    fontWeight: 800,
                                    color: cell.slotTextHex,
                                    marginTop: "0.25mm",
                                  }}
                                >
                                  I-{cell.lunchSlot}
                                </span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize: codePt,
                                  fontWeight:
                                    cell.status === "T" && !cell.isSunOrHoliday ? 600 : 800,
                                }}
                              >
                                {cell.code}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* RODAPÉ FIXO COM LEGENDA COMPACTA E NUMERAÇÃO DE PÁGINAS */}
      <footer className="erp-print-doc-footer">
        <div>
          <div style={{ fontWeight: 700, color: "#1E293B" }}>
            LEGENDA: <strong>T</strong> Trabalho &nbsp;|&nbsp; <strong>F</strong> Folga Semanal
            &nbsp;|&nbsp; <strong>A</strong> Folga Adicional &nbsp;|&nbsp; <strong>1/2</strong>{" "}
            Meio Expediente &nbsp;|&nbsp; <strong>FECH</strong> Loja Fechada &nbsp;|&nbsp;{" "}
            <strong>FÉR</strong> Férias &nbsp;|&nbsp; <strong>LM / INSS</strong> Afastamento
            &nbsp;|&nbsp; <strong>ADM / DEM</strong> Admissão/Deslig.
          </div>
          <div style={{ color: "#475569" }}>
            INTERVALOS DOMINGO / FERIADO: <strong>I-1</strong> (09:00 às 10:00) ·{" "}
            <strong>I-2</strong> (10:00 às 11:00) · <strong>I-3</strong> (11:00 às 12:00) ·{" "}
            <strong>I-4</strong> (12:00 às 13:00) &nbsp;·&nbsp; Postos vagos e congelados ocultados
            automaticamente.
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
