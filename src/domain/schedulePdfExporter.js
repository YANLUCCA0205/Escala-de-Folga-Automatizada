// =============================================================================
// EXPORTADOR DE PDF VETORIAL PESQUISÁVEL (A4 PAISAGEM) — WORKFORCE ERP UNIÃO
//
// Gera diretamente no navegador ou no Node.js um arquivo PDF-1.4 real:
//   • Formato exato ISO 216 A4 Paisagem (297mm × 210mm = 841.89pt × 595.28pt)
//   • 100% vetorial e com texto selecionável e pesquisável (WinAnsi / CP1252)
//   • Símbolo oficial Coração + Onda do União Supermercados em curvas de Bézier
//   • Mesma paginação, colunas, setores "(continuação)" e legenda da pré-visualização
//   • Zero dependências externas e zero chamadas de rede
// =============================================================================

const PT_PER_MM = 72 / 25.4;

// Mapa Unicode -> byte CP1252 (WinAnsiEncoding nativo do PDF 1.4)
const UNICODE_TO_WINANSI = new Map([
  [0x20ac, 0x80], // €
  [0x201a, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201e, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02c6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8a], // Š
  [0x2039, 0x8b], // ‹
  [0x0152, 0x8c], // Œ
  [0x017d, 0x8e], // Ž
  [0x2018, 0x91], // ‘
  [0x2019, 0x92], // ’
  [0x201c, 0x93], // “
  [0x201d, 0x94], // ”
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02dc, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9a], // š
  [0x203a, 0x9b], // ›
  [0x0153, 0x9c], // œ
  [0x017e, 0x9e], // ž
  [0x0178, 0x9f], // Ÿ
]);

function mm(val) {
  return Number((val * PT_PER_MM).toFixed(3));
}

function yTop(pageHeightMm, yFromTopMm) {
  return Number(((pageHeightMm - yFromTopMm) * PT_PER_MM).toFixed(3));
}

function hexToRgbPdf(hex) {
  const clean = String(hex || "#000000").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

/**
 * Codifica uma string JS para literal de string PDF `(...)` em WinAnsiEncoding.
 */
function encodePdfLiteral(str) {
  const text = String(str ?? "");
  let out = "(";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let byte = 0x3f; // '?'
    if (code >= 0x20 && code <= 0x7e) {
      byte = code;
    } else if (code >= 0xa0 && code <= 0xff) {
      byte = code;
    } else if (UNICODE_TO_WINANSI.has(code)) {
      byte = UNICODE_TO_WINANSI.get(code);
    }

    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
      out += "\\" + String.fromCharCode(byte);
    } else if (byte < 0x20 || byte > 0x7e) {
      out += "\\" + byte.toString(8).padStart(3, "0");
    } else {
      out += String.fromCharCode(byte);
    }
  }
  out += ")";
  return out;
}

/**
 * Estimativa precisa de largura de texto Helvetica (proporção em relação a fontSizePt).
 */
function estimateHelveticaWidthPt(str, fontSizePt, isBold = false) {
  const s = String(str ?? "");
  let units = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ("ijlI1.,:;!|' ".includes(ch)) units += 0.28;
    else if ("ftrt()-/".includes(ch)) units += 0.35;
    else if ("MW@#%&".includes(ch)) units += 0.86;
    else if (ch >= "A" && ch <= "Z") units += 0.67;
    else if (ch >= "0" && ch <= "9") units += 0.56;
    else if (ch.charCodeAt(0) > 127) units += 0.6;
    else units += 0.53;
  }
  return units * fontSizePt * (isBold ? 1.04 : 1.0);
}

function drawRect(cmds, pageH, xMm, yTopMm, wMm, hMm, { fillHex, strokeHex, lineWidthPt = 0.35 }) {
  const x = mm(xMm);
  const y = yTop(pageH, yTopMm + hMm);
  const w = mm(wMm);
  const h = mm(hMm);

  if (fillHex && strokeHex) {
    cmds.push(`${lineWidthPt.toFixed(2)} w`);
    cmds.push(`${hexToRgbPdf(fillHex)} rg`);
    cmds.push(`${hexToRgbPdf(strokeHex)} RG`);
    cmds.push(`${x} ${y} ${w} ${h} re B`);
  } else if (fillHex) {
    cmds.push(`${hexToRgbPdf(fillHex)} rg`);
    cmds.push(`${x} ${y} ${w} ${h} re f`);
  } else if (strokeHex) {
    cmds.push(`${lineWidthPt.toFixed(2)} w`);
    cmds.push(`${hexToRgbPdf(strokeHex)} RG`);
    cmds.push(`${x} ${y} ${w} ${h} re S`);
  }
}

function drawLine(cmds, pageH, x1Mm, y1TopMm, x2Mm, y2TopMm, strokeHex, lineWidthPt = 0.4) {
  cmds.push(`${lineWidthPt.toFixed(2)} w`);
  cmds.push(`${hexToRgbPdf(strokeHex)} RG`);
  cmds.push(
    `${mm(x1Mm)} ${yTop(pageH, y1TopMm)} m ${mm(x2Mm)} ${yTop(pageH, y2TopMm)} l S`
  );
}

function drawText(
  cmds,
  pageH,
  text,
  xMm,
  yBaselineTopMm,
  { font = "F1", sizePt = 7, colorHex = "#0F172A", align = "left", boxWidthMm = 0 } = {}
) {
  const str = String(text ?? "");
  if (!str) return;
  const isBold = font === "F2";
  let xPt = mm(xMm);
  if (boxWidthMm > 0 && align !== "left") {
    const textW = estimateHelveticaWidthPt(str, sizePt, isBold);
    const boxW = mm(boxWidthMm);
    if (align === "center") {
      xPt = mm(xMm) + Math.max(0, (boxW - textW) / 2);
    } else if (align === "right") {
      xPt = mm(xMm) + Math.max(0, boxW - textW);
    }
  }
  const yPt = yTop(pageH, yBaselineTopMm);
  cmds.push("BT");
  cmds.push(`/${font} ${sizePt.toFixed(2)} Tf`);
  cmds.push(`${hexToRgbPdf(colorHex)} rg`);
  cmds.push(`1 0 0 1 ${xPt.toFixed(2)} ${yPt.toFixed(2)} Tm`);
  cmds.push(`${encodePdfLiteral(str)} Tj`);
  cmds.push("ET");
}

/**
 * Desenha o símbolo oficial Coração + Onda do União Supermercados em curvas de Bézier
 * (viewBox original 120×106 fiel ao Manual da Marca: Vermelho #E9403C + Azul #2B5690).
 */
function drawUniaoLogoLockup(cmds, pageH, xMm, yTopMm) {
  const symbolWmm = 9.4;
  const symbolHmm = 8.3;
  const sx = (symbolWmm * PT_PER_MM) / 120;
  const sy = (symbolHmm * PT_PER_MM) / 106;
  const ox = mm(xMm);
  const oyTop = pageH * PT_PER_MM - mm(yTopMm);

  const px = (vx) => (ox + vx * sx).toFixed(2);
  const py = (vy) => (oyTop - vy * sy).toFixed(2);

  cmds.push("q");
  // Contorno do Coração como caminho de recorte (clip path)
  cmds.push(`${px(60)} ${py(98)} m`);
  cmds.push(`${px(57.5)} ${py(98)} ${px(10)} ${py(68.5)} ${px(10)} ${py(35.5)} c`);
  cmds.push(`${px(10)} ${py(17.5)} ${px(24.5)} ${py(5)} ${px(41.5)} ${py(5)} c`);
  cmds.push(`${px(50.8)} ${py(5)} ${px(56.8)} ${py(9.8)} ${px(60)} ${py(15.2)} c`);
  cmds.push(`${px(63.2)} ${py(9.8)} ${px(69.2)} ${py(5)} ${px(78.5)} ${py(5)} c`);
  cmds.push(`${px(95.5)} ${py(5)} ${px(110)} ${py(17.5)} ${px(110)} ${py(35.5)} c`);
  cmds.push(`${px(110)} ${py(68.5)} ${px(62.5)} ${py(98)} ${px(60)} ${py(98)} c`);
  cmds.push("h W n");

  // Parte superior: Vermelho União (#E9403C)
  cmds.push(`${hexToRgbPdf("#E9403C")} rg`);
  cmds.push(`${px(0)} ${py(106)} ${(120 * sx).toFixed(2)} ${(106 * sy).toFixed(2)} re f`);

  // Parte inferior da onda: Azul União (#2B5690)
  cmds.push(`${hexToRgbPdf("#2B5690")} rg`);
  cmds.push(`${px(4)} ${py(47)} m`);
  cmds.push(`${px(16)} ${py(33)} ${px(38)} ${py(42)} ${px(58)} ${py(58)} c`);
  cmds.push(`${px(77)} ${py(73)} ${px(98)} ${py(73)} ${px(116)} ${py(52)} c`);
  cmds.push(`${px(120)} ${py(106)} l`);
  cmds.push(`${px(0)} ${py(106)} l`);
  cmds.push("h f");
  cmds.push("Q");

  // Wordmark institucional ao lado do símbolo
  drawText(cmds, pageH, "união", xMm + 11.0, yTopMm + 4.8, {
    font: "F2",
    sizePt: 13.0,
    colorHex: "#2B5690",
  });
  drawText(cmds, pageH, "SUPERMERCADOS", xMm + 11.2, yTopMm + 7.7, {
    font: "F2",
    sizePt: 5.5,
    colorHex: "#E9403C",
  });
}

function renderSchedulePageContentStream(doc, page) {
  const g = doc.geometry;
  const pageH = g.pageHeightMm;
  const left = g.marginXmm;
  const right = g.marginXmm + g.usableWidthMm;
  const top = g.marginYmm;
  const cmds = [];

  // 1. CABEÇALHO INSTITUCIONAL REPETIDO EM TODAS AS PÁGINAS
  drawRect(cmds, pageH, left, top, g.usableWidthMm, g.docHeaderHeightMm, {
    fillHex: "#FFFFFF",
    strokeHex: "#CBD5E1",
    lineWidthPt: 0.45,
  });
  // Faixa superior fina institucional Azul União
  drawRect(cmds, pageH, left, top, g.usableWidthMm, 0.9, {
    fillHex: "#2B5690",
  });

  drawUniaoLogoLockup(cmds, pageH, left + 2.5, top + 2.6);

  // Divisória vertical após logotipo
  drawLine(cmds, pageH, left + 43.5, top + 2.4, left + 43.5, top + g.docHeaderHeightMm - 1.8, "#E2E8F0", 0.4);

  // Título documental + Empresa + Unidade
  drawText(cmds, pageH, "ESCALA MENSAL DE TRABALHO E FOLGAS", left + 46.5, top + 5.3, {
    font: "F2",
    sizePt: 9.2,
    colorHex: "#0F172A",
  });
  const unitLine = `${doc.companyLegalName}  ·  Unidade: ${doc.unitName}${
    doc.unitCity ? ` (${doc.unitCity})` : ""
  }`;
  drawText(cmds, pageH, unitLine, left + 46.5, top + 9.2, {
    font: "F2",
    sizePt: 7.0,
    colorHex: "#1E3A8A",
  });
  drawText(
    cmds,
    pageH,
    `${doc.scopeDescription}  ·  ${doc.totalEmployees} colaborador(es) ativos no quadro`,
    left + 46.5,
    top + 12.8,
    {
      font: "F1",
      sizePt: 6.4,
      colorHex: "#475569",
    }
  );

  // Quadro de metadados à direita (Competência, Versão/Situação e Página)
  const metaBoxW = 86.0;
  const metaBoxX = right - metaBoxW - 2.2;
  drawRect(cmds, pageH, metaBoxX, top + 2.1, metaBoxW, g.docHeaderHeightMm - 3.6, {
    fillHex: "#F8FAFC",
    strokeHex: "#CBD5E1",
    lineWidthPt: 0.35,
  });

  drawText(cmds, pageH, `COMPETÊNCIA: ${doc.competenceLabel.toUpperCase()} (${doc.yearMonth})`, metaBoxX + 2.4, top + 5.6, {
    font: "F2",
    sizePt: 6.8,
    colorHex: "#0F172A",
  });
  drawText(
    cmds,
    pageH,
    `Situação: ${doc.scheduleStatusLabel}  ·  Versão #${doc.versionNumber}`,
    metaBoxX + 2.4,
    top + 9.1,
    {
      font: "F1",
      sizePt: 6.3,
      colorHex: "#334155",
    }
  );
  drawText(
    cmds,
    pageH,
    `Dias do mês: 01 a ${String(doc.days.length).padStart(2, "0")}  ·  Página ${page.pageNumber} de ${page.totalPages}`,
    metaBoxX + 2.4,
    top + 12.4,
    {
      font: "F2",
      sizePt: 6.3,
      colorHex: "#2B5690",
    }
  );

  // 2. CABEÇALHO DA TABELA DE DIAS (REPETIDO EM TODAS AS PÁGINAS)
  const tableTop = top + g.docHeaderHeightMm + g.docHeaderGapMm;
  const thH = g.tableHeaderHeightMm;

  drawRect(cmds, pageH, left, tableTop, g.collabColWidthMm, thH, {
    fillHex: "#EEF2F7",
    strokeHex: "#94A3B8",
    lineWidthPt: 0.45,
  });
  drawText(cmds, pageH, "COLABORADOR / FUNÇÃO", left + 2.0, tableTop + 5.1, {
    font: "F2",
    sizePt: 6.6,
    colorHex: "#0F172A",
  });

  let dayStartX = left + g.collabColWidthMm;
  if (doc.includeJourneyDetails) {
    drawRect(cmds, pageH, dayStartX, tableTop, g.journeyColWidthMm, thH, {
      fillHex: "#EEF2F7",
      strokeHex: "#94A3B8",
      lineWidthPt: 0.45,
    });
    drawText(cmds, pageH, "JORNADA · REGRA", dayStartX, tableTop + 5.1, {
      font: "F2",
      sizePt: 6.1,
      colorHex: "#0F172A",
      align: "center",
      boxWidthMm: g.journeyColWidthMm,
    });
    dayStartX += g.journeyColWidthMm;
  }

  doc.days.forEach((day, idx) => {
    const dx = dayStartX + idx * g.dayColWidthMm;
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

    drawRect(cmds, pageH, dx, tableTop, g.dayColWidthMm, thH, {
      fillHex: hdrBg,
      strokeHex: "#94A3B8",
      lineWidthPt: 0.35,
    });
    drawText(cmds, pageH, day.dowLabel, dx, tableTop + 3.2, {
      font: "F2",
      sizePt: 4.8,
      colorHex: hdrFg,
      align: "center",
      boxWidthMm: g.dayColWidthMm,
    });
    drawText(cmds, pageH, day.dayNumber, dx, tableTop + 6.7, {
      font: "F2",
      sizePt: 6.6,
      colorHex: hdrFg,
      align: "center",
      boxWidthMm: g.dayColWidthMm,
    });
  });

  // 3. BLOCOS DE SETORES E COLABORADORES DA PÁGINA
  let cursorY = tableTop + thH;

  if (page.blocks.length === 0) {
    drawRect(cmds, pageH, left, cursorY, g.usableWidthMm, 18.0, {
      fillHex: "#FFFFFF",
      strokeHex: "#CBD5E1",
      lineWidthPt: 0.4,
    });
    drawText(
      cmds,
      pageH,
      "Nenhum posto preenchido encontrado para os critérios selecionados nesta competência.",
      left,
      cursorY + 10.2,
      {
        font: "F1",
        sizePt: 8.0,
        colorHex: "#475569",
        align: "center",
        boxWidthMm: g.usableWidthMm,
      }
    );
  }

  for (const block of page.blocks) {
    const shH = g.sectorHeaderHeightMm;
    drawRect(cmds, pageH, left, cursorY, g.usableWidthMm, shH, {
      fillHex: "#EEF2F7",
      strokeHex: "#94A3B8",
      lineWidthPt: 0.4,
    });
    // Barra lateral de destaque do setor em Azul União
    drawRect(cmds, pageH, left, cursorY, 1.4, shH, {
      fillHex: "#2B5690",
    });

    drawText(cmds, pageH, `SETOR: ${block.displayTitle.toUpperCase()}`, left + 3.0, cursorY + 3.9, {
      font: "F2",
      sizePt: 6.7,
      colorHex: "#0F1E36",
    });

    const countInfo = `${block.rows.length} nesta página · ${block.totalEmployeesInSector} no setor`;
    drawText(cmds, pageH, countInfo, right - 58.0, cursorY + 3.9, {
      font: "F1",
      sizePt: 5.8,
      colorHex: "#475569",
      align: "right",
      boxWidthMm: 56.0,
    });

    cursorY += shH;

    for (const row of block.rows) {
      const rH = row.rowHeightMm;
      // Célula do Colaborador + Função
      drawRect(cmds, pageH, left, cursorY, g.collabColWidthMm, rH, {
        fillHex: "#FFFFFF",
        strokeHex: "#CBD5E1",
        lineWidthPt: 0.32,
      });

      const lineStepMm = 2.45;
      const firstLineBaseline = cursorY + 2.7;
      row.nameLines.forEach((lineText, lIdx) => {
        drawText(
          cmds,
          pageH,
          lineText,
          left + 1.6,
          firstLineBaseline + lIdx * lineStepMm,
          {
            font: "F2",
            sizePt: 6.3,
            colorHex: "#0F172A",
          }
        );
      });

      const roleLine = `${row.positionCode} · ${row.positionTitle}`.slice(
        0,
        doc.includeJourneyDetails ? 32 : 39
      );
      drawText(
        cmds,
        pageH,
        roleLine,
        left + 1.6,
        firstLineBaseline + row.nameLines.length * lineStepMm - 0.15,
        {
          font: "F1",
          sizePt: 5.1,
          colorHex: "#475569",
        }
      );

      // Coluna complementar opcional de Jornada · Regra · Carga
      if (doc.includeJourneyDetails) {
        const jx = left + g.collabColWidthMm;
        drawRect(cmds, pageH, jx, cursorY, g.journeyColWidthMm, rH, {
          fillHex: "#FAFAFA",
          strokeHex: "#CBD5E1",
          lineWidthPt: 0.32,
        });
        drawText(cmds, pageH, row.shiftLabel, jx, cursorY + 2.9, {
          font: "F2",
          sizePt: 5.7,
          colorHex: "#0F172A",
          align: "center",
          boxWidthMm: g.journeyColWidthMm,
        });
        const subRule = row.workloadLabel
          ? `${row.ruleLabel} · ${row.workloadLabel.split("·")[0].trim()}`
          : row.ruleLabel;
        drawText(cmds, pageH, subRule, jx, cursorY + 5.3, {
          font: "F1",
          sizePt: 5.0,
          colorHex: "#2B5690",
          align: "center",
          boxWidthMm: g.journeyColWidthMm,
        });
      }

      // Células uniformes de todos os dias do mês (28, 29, 30 ou 31)
      row.cells.forEach((cell, cIdx) => {
        const cx = dayStartX + cIdx * g.dayColWidthMm;
        drawRect(cmds, pageH, cx, cursorY, g.dayColWidthMm, rH, {
          fillHex: cell.bgHex,
          strokeHex: "#CBD5E1",
          lineWidthPt: 0.3,
        });

        const codeSizePt =
          cell.code.length >= 4 ? 5.0 : cell.code.length === 3 ? 5.5 : 6.4;

        if (cell.lunchSlot) {
          // Trabalho em Dom/Feriado com faixa de intervalo (1..4) empilhada com clareza
          drawText(cmds, pageH, cell.code, cx, cursorY + rH / 2 - 0.35, {
            font: "F2",
            sizePt: 5.8,
            colorHex: cell.textHex,
            align: "center",
            boxWidthMm: g.dayColWidthMm,
          });
          drawText(cmds, pageH, `I-${cell.lunchSlot}`, cx, cursorY + rH / 2 + 2.05, {
            font: "F2",
            sizePt: 4.7,
            colorHex: cell.slotTextHex,
            align: "center",
            boxWidthMm: g.dayColWidthMm,
          });
        } else {
          drawText(cmds, pageH, cell.code, cx, cursorY + rH / 2 + 0.85, {
            font: cell.status === "T" && !cell.isSunOrHoliday ? "F1" : "F2",
            sizePt: codeSizePt,
            colorHex: cell.textHex,
            align: "center",
            boxWidthMm: g.dayColWidthMm,
          });
        }
      });

      cursorY += rH;
    }
  }

  // 4. RODAPÉ COMPACTO FIXO EM TODAS AS PÁGINAS (LEGENDA + NUMERAÇÃO)
  const footerTop = g.marginYmm + g.usableHeightMm - g.footerHeightMm;
  drawRect(cmds, pageH, left, footerTop, g.usableWidthMm, g.footerHeightMm, {
    fillHex: "#F8FAFC",
    strokeHex: "#CBD5E1",
    lineWidthPt: 0.35,
  });

  drawText(
    cmds,
    pageH,
    "LEGENDA:  T Trabalho   |   F Folga Semanal   |   A Folga Adicional   |   1/2 Meio Expediente   |   FECH Loja Fechada   |   FÉR Férias   |   LM / INSS Afastamento   |   ADM / DEM Admissão/Deslig.",
    left + 2.0,
    footerTop + 3.1,
    {
      font: "F2",
      sizePt: 5.4,
      colorHex: "#1E293B",
    }
  );
  drawText(
    cmds,
    pageH,
    "INTERVALOS DOMINGO / FERIADO:  I-1 (09:00 às 10:00)  ·  I-2 (10:00 às 11:00)  ·  I-3 (11:00 às 12:00)  ·  I-4 (12:00 às 13:00)     ·     Postos vagos e congelados ocultados automaticamente.",
    left + 2.0,
    footerTop + 5.9,
    {
      font: "F1",
      sizePt: 5.2,
      colorHex: "#475569",
    }
  );

  drawText(
    cmds,
    pageH,
    `Emitido em ${doc.emittedAtFormatted}  ·  Página ${page.pageNumber} de ${page.totalPages}`,
    right - 68.0,
    footerTop + 4.6,
    {
      font: "F2",
      sizePt: 5.8,
      colorHex: "#0F172A",
      align: "right",
      boxWidthMm: 66.0,
    }
  );

  return cmds.join("\n");
}

function asciiToBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concatUint8Arrays(chunks) {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Gera os bytes binários (`Uint8Array`) do documento PDF-1.4 A4 Paisagem.
 */
export function generateSchedulePdfBytes(docModel) {
  const pageWidthPt = mm(docModel.geometry.pageWidthMm);
  const pageHeightPt = mm(docModel.geometry.pageHeightMm);

  // Objetos fixos:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica WinAnsi)
  // 4: Font F2 (Helvetica-Bold WinAnsi)
  // 5: Font F3 (Helvetica-Oblique WinAnsi)
  // 6..N: Pares (Page, Contents) para cada página
  const objects = [];
  const addObject = (bodyStr) => {
    const id = objects.length + 1;
    objects.push({ id, bodyStr });
    return id;
  };

  addObject(""); // placeholder 1: Catalog
  addObject(""); // placeholder 2: Pages
  const f1Id = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  const f2Id = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );
  const f3Id = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"
  );

  const pageIds = [];
  for (const page of docModel.pages) {
    const streamContent = renderSchedulePageContentStream(docModel, page);
    const streamBytesLen = streamContent.length;
    const contentObjId = addObject(
      `<< /Length ${streamBytesLen} >>\nstream\n${streamContent}\nendstream`
    );
    const pageObjId = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /Font << /F1 ${f1Id} 0 R /F2 ${f2Id} 0 R /F3 ${f3Id} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    pageIds.push(pageObjId);
  }

  objects[0].bodyStr = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1].bodyStr = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;

  const infoTitle = encodePdfLiteral(
    `Escala Mensal - ${docModel.unitName} - ${docModel.yearMonth}`
  );
  const infoId = addObject(
    `<< /Title ${infoTitle} /Creator (Workforce ERP Uniao Supermercados v9.0) /Producer (Uniao ERP Vector PDF Engine) >>`
  );

  const chunks = [];
  let byteCursor = 0;
  const pushStr = (s) => {
    const b = asciiToBytes(s);
    chunks.push(b);
    byteCursor += b.length;
  };

  // Cabeçalho PDF-1.4 com marcador binário padrão
  pushStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const offsets = [0];
  for (const obj of objects) {
    offsets.push(byteCursor);
    pushStr(`${obj.id} 0 obj\n${obj.bodyStr}\nendobj\n`);
  }

  const xrefOffset = byteCursor;
  const totalObjCount = objects.length + 1;
  let xref = `xref\n0 ${totalObjCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pushStr(xref);
  pushStr(
    `trailer\n<< /Size ${totalObjCount} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return concatUint8Arrays(chunks);
}

/**
 * Aciona o download direto do arquivo PDF padronizado no navegador.
 */
export function downloadSchedulePdf(docModel) {
  const pdfBytes = generateSchedulePdfBytes(docModel);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = docModel.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { fileName: docModel.fileName, byteLength: pdfBytes.byteLength };
}
