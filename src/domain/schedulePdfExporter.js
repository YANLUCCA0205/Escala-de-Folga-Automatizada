// =============================================================================
// EXPORTADOR DE PDF VETORIAL PESQUISÁVEL (A4 PAISAGEM) — WORKFORCE ERP UNIÃO
//
// Gera diretamente no navegador ou no Node.js um arquivo PDF-1.4 real:
//   • Formato exato ISO 216 A4 Paisagem (297mm × 210mm = 841.89pt × 595.28pt)
//   • 100% vetorial e com texto selecionável e pesquisável (WinAnsi / CP1252)
//   • Símbolo oficial Coração + Onda do União Supermercados em curvas de Bézier
//   • Representação operacional União:
//       - Trabalho normal: célula branca vazia (sem letra T)
//       - Folga (F/A): célula 100% preta (#000000), sem texto
//       - Domingo/Feriado trabalhado c/ intervalo: somente o número (1..4) em negrito
//       - Férias e afastamentos consecutivos: faixa horizontal unificada
//       - Legenda gráfica real com amostras visuais e horários configurados
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

function encodePdfLiteral(str) {
  const text = String(str ?? "");
  let out = "(";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let byte = 0x3f;
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

function drawRect(cmds, pageH, xMm, yTopMm, wMm, hMm, { fillHex, strokeHex, lineWidthPt = 0.45 }) {
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

function drawLine(cmds, pageH, x1Mm, y1TopMm, x2Mm, y2TopMm, strokeHex, lineWidthPt = 0.45) {
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
  cmds.push(`${px(60)} ${py(98)} m`);
  cmds.push(`${px(57.5)} ${py(98)} ${px(10)} ${py(68.5)} ${px(10)} ${py(35.5)} c`);
  cmds.push(`${px(10)} ${py(17.5)} ${px(24.5)} ${py(5)} ${px(41.5)} ${py(5)} c`);
  cmds.push(`${px(50.8)} ${py(5)} ${px(56.8)} ${py(9.8)} ${px(60)} ${py(15.2)} c`);
  cmds.push(`${px(63.2)} ${py(9.8)} ${px(69.2)} ${py(5)} ${px(78.5)} ${py(5)} c`);
  cmds.push(`${px(95.5)} ${py(5)} ${px(110)} ${py(17.5)} ${px(110)} ${py(35.5)} c`);
  cmds.push(`${px(110)} ${py(68.5)} ${px(62.5)} ${py(98)} ${px(60)} ${py(98)} c`);
  cmds.push("h W n");

  cmds.push(`${hexToRgbPdf("#E9403C")} rg`);
  cmds.push(`${px(0)} ${py(106)} ${(120 * sx).toFixed(2)} ${(106 * sy).toFixed(2)} re f`);

  cmds.push(`${hexToRgbPdf("#2B5690")} rg`);
  cmds.push(`${px(4)} ${py(47)} m`);
  cmds.push(`${px(16)} ${py(33)} ${px(38)} ${py(42)} ${px(58)} ${py(58)} c`);
  cmds.push(`${px(77)} ${py(73)} ${px(98)} ${py(73)} ${px(116)} ${py(52)} c`);
  cmds.push(`${px(120)} ${py(106)} l`);
  cmds.push(`${px(0)} ${py(106)} l`);
  cmds.push("h f");
  cmds.push("Q");

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
    strokeHex: "#64748B",
    lineWidthPt: 0.55,
  });
  drawRect(cmds, pageH, left, top, g.usableWidthMm, 0.9, {
    fillHex: "#2B5690",
  });

  drawUniaoLogoLockup(cmds, pageH, left + 2.5, top + 2.6);
  drawLine(
    cmds,
    pageH,
    left + 43.5,
    top + 2.4,
    left + 43.5,
    top + g.docHeaderHeightMm - 1.8,
    "#CBD5E1",
    0.45
  );

  drawText(cmds, pageH, "ESCALA MENSAL DE TRABALHO E FOLGAS", left + 46.5, top + 5.3, {
    font: "F2",
    sizePt: 9.2,
    colorHex: "#0F172A",
  });
  const unitLine = `${doc.unitFiscalLabel || doc.companyLegalName}  ·  Unidade: ${doc.unitName}${
    doc.unitCity ? ` (${doc.unitCity}${doc.unitState ? `/${doc.unitState}` : ""})` : ""
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
      colorHex: "#334155",
    }
  );

  const metaBoxW = 86.0;
  const metaBoxX = right - metaBoxW - 2.2;
  drawRect(cmds, pageH, metaBoxX, top + 2.1, metaBoxW, g.docHeaderHeightMm - 3.6, {
    fillHex: "#F8FAFC",
    strokeHex: "#94A3B8",
    lineWidthPt: 0.4,
  });

  drawText(
    cmds,
    pageH,
    `COMPETÊNCIA: ${doc.competenceLabel.toUpperCase()} (${doc.yearMonth})`,
    metaBoxX + 2.4,
    top + 5.6,
    {
      font: "F2",
      sizePt: 6.8,
      colorHex: "#0F172A",
    }
  );
  drawText(
    cmds,
    pageH,
    `Situação: ${doc.scheduleStatusLabel}  ·  Versão #${doc.versionNumber}`,
    metaBoxX + 2.4,
    top + 9.1,
    {
      font: "F1",
      sizePt: 6.3,
      colorHex: "#1E293B",
    }
  );
  drawText(
    cmds,
    pageH,
    `Dias do mês: 01 a ${String(doc.days.length).padStart(2, "0")}  ·  Página ${
      page.pageNumber
    } de ${page.totalPages}`,
    metaBoxX + 2.4,
    top + 12.4,
    {
      font: "F2",
      sizePt: 6.3,
      colorHex: "#2B5690",
    }
  );

  // 2. CABEÇALHO DA TABELA DE DIAS (CLASSIFICAÇÃO DAS DATAS CONCENTRADA NO CABEÇALHO)
  const tableTop = top + g.docHeaderHeightMm + g.docHeaderGapMm;
  const thH = g.tableHeaderHeightMm;

  drawRect(cmds, pageH, left, tableTop, g.collabColWidthMm, thH, {
    fillHex: "#E2E8F0",
    strokeHex: "#475569",
    lineWidthPt: 0.55,
  });
  drawText(cmds, pageH, "COLABORADOR / FUNÇÃO", left + 2.0, tableTop + 5.2, {
    font: "F2",
    sizePt: 6.7,
    colorHex: "#0F172A",
  });

  let dayStartX = left + g.collabColWidthMm;
  if (doc.includeJourneyDetails) {
    drawRect(cmds, pageH, dayStartX, tableTop, g.journeyColWidthMm, thH, {
      fillHex: "#E2E8F0",
      strokeHex: "#475569",
      lineWidthPt: 0.55,
    });
    drawText(cmds, pageH, "JORNADA · REGRA", dayStartX, tableTop + 5.2, {
      font: "F2",
      sizePt: 6.2,
      colorHex: "#0F172A",
      align: "center",
      boxWidthMm: g.journeyColWidthMm,
    });
    dayStartX += g.journeyColWidthMm;
  }

  doc.days.forEach((day, idx) => {
    const dx = dayStartX + idx * g.dayColWidthMm;
    drawRect(cmds, pageH, dx, tableTop, g.dayColWidthMm, thH, {
      fillHex: day.headerBgHex,
      strokeHex: "#475569",
      lineWidthPt: 0.45,
    });

    if (day.headerSubTag) {
      drawText(cmds, pageH, day.dowLabel, dx, tableTop + 2.6, {
        font: "F2",
        sizePt: 4.5,
        colorHex: day.headerTextHex,
        align: "center",
        boxWidthMm: g.dayColWidthMm,
      });
      drawText(cmds, pageH, day.dayNumber, dx, tableTop + 5.5, {
        font: "F2",
        sizePt: 6.3,
        colorHex: day.headerTextHex,
        align: "center",
        boxWidthMm: g.dayColWidthMm,
      });
      drawText(cmds, pageH, day.headerSubTag, dx, tableTop + 7.7, {
        font: "F2",
        sizePt: 4.1,
        colorHex: day.headerTextHex,
        align: "center",
        boxWidthMm: g.dayColWidthMm,
      });
    } else {
      drawText(cmds, pageH, day.dowLabel, dx, tableTop + 3.2, {
        font: "F2",
        sizePt: 4.9,
        colorHex: day.headerTextHex,
        align: "center",
        boxWidthMm: g.dayColWidthMm,
      });
      drawText(cmds, pageH, day.dayNumber, dx, tableTop + 6.9, {
        font: "F2",
        sizePt: 6.8,
        colorHex: day.headerTextHex,
        align: "center",
        boxWidthMm: g.dayColWidthMm,
      });
    }
  });

  // 3. BLOCOS DE SETORES E COLABORADORES DA PÁGINA
  let cursorY = tableTop + thH;

  if (page.blocks.length === 0) {
    drawRect(cmds, pageH, left, cursorY, g.usableWidthMm, 18.0, {
      fillHex: "#FFFFFF",
      strokeHex: "#64748B",
      lineWidthPt: 0.45,
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
        colorHex: "#334155",
        align: "center",
        boxWidthMm: g.usableWidthMm,
      }
    );
  }

  for (const block of page.blocks) {
    const shH = g.sectorHeaderHeightMm;
    drawRect(cmds, pageH, left, cursorY, g.usableWidthMm, shH, {
      fillHex: "#DCE4EF",
      strokeHex: "#475569",
      lineWidthPt: 0.5,
    });
    drawRect(cmds, pageH, left, cursorY, 1.6, shH, {
      fillHex: "#2B5690",
    });

    drawText(
      cmds,
      pageH,
      `SETOR: ${block.displayTitle.toUpperCase()}`,
      left + 3.2,
      cursorY + 4.0,
      {
        font: "F2",
        sizePt: 6.9,
        colorHex: "#0F172A",
      }
    );

    const countInfo = `${block.rows.length} nesta página · ${block.totalEmployeesInSector} no setor`;
    drawText(cmds, pageH, countInfo, right - 58.0, cursorY + 3.9, {
      font: "F2",
      sizePt: 5.8,
      colorHex: "#334155",
      align: "right",
      boxWidthMm: 56.0,
    });

    cursorY += shH;

    for (const row of block.rows) {
      const rH = row.rowHeightMm;
      // Célula do Colaborador + Função (alto contraste tipográfico)
      drawRect(cmds, pageH, left, cursorY, g.collabColWidthMm, rH, {
        fillHex: "#FFFFFF",
        strokeHex: "#64748B",
        lineWidthPt: 0.42,
      });

      const lineStepMm = 2.45;
      const firstLineBaseline = cursorY + 2.75;
      row.nameLines.forEach((lineText, lIdx) => {
        drawText(
          cmds,
          pageH,
          lineText,
          left + 1.6,
          firstLineBaseline + lIdx * lineStepMm,
          {
            font: "F2",
            sizePt: 6.45,
            colorHex: "#000000",
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
          sizePt: 5.2,
          colorHex: "#334155",
        }
      );

      // Coluna complementar opcional de Jornada · Regra
      if (doc.includeJourneyDetails) {
        const jx = left + g.collabColWidthMm;
        drawRect(cmds, pageH, jx, cursorY, g.journeyColWidthMm, rH, {
          fillHex: "#F8FAFC",
          strokeHex: "#64748B",
          lineWidthPt: 0.42,
        });
        drawText(cmds, pageH, row.shiftLabel, jx, cursorY + 2.9, {
          font: "F2",
          sizePt: 5.8,
          colorHex: "#0F172A",
          align: "center",
          boxWidthMm: g.journeyColWidthMm,
        });
        const subRule = row.workloadLabel
          ? `${row.ruleLabel} · ${row.workloadLabel.split("·")[0].trim()}`
          : row.ruleLabel;
        drawText(cmds, pageH, subRule, jx, cursorY + 5.3, {
          font: "F2",
          sizePt: 5.0,
          colorHex: "#1E3A8A",
          align: "center",
          boxWidthMm: g.journeyColWidthMm,
        });
      }

      // Renderiza spans horizontais (células individuais de trabalho/folga ou faixas agrupadas de férias/afastamento)
      const spansToRender = row.cellSpans || row.cells.map((c, idx) => ({
        ...c,
        isSpan: false,
        spanLength: 1,
        startDayIndex: idx,
      }));

      for (const span of spansToRender) {
        const cx = dayStartX + span.startDayIndex * g.dayColWidthMm;
        const cw = span.spanLength * g.dayColWidthMm;

        if (span.isBlackRest) {
          // Folga: preenchimento integral preto sólido, sem texto
          drawRect(cmds, pageH, cx, cursorY, cw, rH, {
            fillHex: "#000000",
            strokeHex: "#000000",
            lineWidthPt: 0.45,
          });
          continue;
        }

        if (span.isGroupableAbsence) {
          // Faixa horizontal de Férias, INSS, Licença-Maternidade, Admissão ou Desligamento
          drawRect(cmds, pageH, cx, cursorY, cw, rH, {
            fillHex: span.bgHex,
            strokeHex: span.borderHex || "#475569",
            lineWidthPt: 0.5,
          });
          const labelPt = span.spanLength >= 4 ? 6.1 : span.spanLength >= 2 ? 5.5 : 5.2;
          drawText(cmds, pageH, span.displayText, cx, cursorY + rH / 2 + 0.85, {
            font: "F2",
            sizePt: labelPt,
            colorHex: span.textHex,
            align: "center",
            boxWidthMm: cw,
          });
          continue;
        }

        // Célula de trabalho (branca vazia ou com número de intervalo 1..4 em negrito)
        drawRect(cmds, pageH, cx, cursorY, cw, rH, {
          fillHex: span.bgHex || "#FFFFFF",
          strokeHex: "#64748B",
          lineWidthPt: 0.42,
        });

        if (span.displayText) {
          if (span.subText) {
            drawText(cmds, pageH, span.displayText, cx, cursorY + rH / 2 - 0.1, {
              font: "F2",
              sizePt: 7.4,
              colorHex: span.textHex || "#000000",
              align: "center",
              boxWidthMm: cw,
            });
            drawText(cmds, pageH, span.subText, cx, cursorY + rH / 2 + 2.1, {
              font: "F2",
              sizePt: 4.5,
              colorHex: "#78350F",
              align: "center",
              boxWidthMm: cw,
            });
          } else {
            const isSingleDigitInterval = /^[1-9]$/.test(span.displayText);
            drawText(cmds, pageH, span.displayText, cx, cursorY + rH / 2 + 1.05, {
              font: "F2",
              sizePt: isSingleDigitInterval ? 8.1 : 5.6,
              colorHex: span.textHex || "#000000",
              align: "center",
              boxWidthMm: cw,
            });
          }
        }
      }

      cursorY += rH;
    }
  }

  // 4. RODAPÉ COM LEGENDA GRÁFICA REAL (Seção 1.7) + NUMERAÇÃO DE PÁGINAS
  const footerTop = g.marginYmm + g.usableHeightMm - g.footerHeightMm;
  drawRect(cmds, pageH, left, footerTop, g.usableWidthMm, g.footerHeightMm, {
    fillHex: "#F8FAFC",
    strokeHex: "#64748B",
    lineWidthPt: 0.45,
  });

  // Linha 1 da Legenda: Amostras gráficas reais (Quadrado branco, Quadrado preto, Número 1..4 e Cores de cabeçalho)
  const row1Y = footerTop + 1.15;
  drawText(cmds, pageH, "LEGENDA:", left + 2.0, row1Y + 2.1, {
    font: "F2",
    sizePt: 5.6,
    colorHex: "#0F172A",
  });

  // Amostra 1: Quadrado branco = Dia de trabalho
  drawRect(cmds, pageH, left + 15.5, row1Y, 3.0, 2.5, {
    fillHex: "#FFFFFF",
    strokeHex: "#334155",
    lineWidthPt: 0.45,
  });
  drawText(cmds, pageH, "Dia de trabalho", left + 19.3, row1Y + 2.0, {
    font: "F2",
    sizePt: 5.4,
    colorHex: "#0F172A",
  });

  // Amostra 2: Quadrado preto = Dia de folga
  drawRect(cmds, pageH, left + 38.5, row1Y, 3.0, 2.5, {
    fillHex: "#000000",
    strokeHex: "#000000",
    lineWidthPt: 0.45,
  });
  drawText(cmds, pageH, "Dia de folga", left + 42.3, row1Y + 2.0, {
    font: "F2",
    sizePt: 5.4,
    colorHex: "#0F172A",
  });

  // Amostra 3: Número 1 a 4 = Intervalo
  drawRect(cmds, pageH, left + 59.0, row1Y, 4.4, 2.5, {
    fillHex: "#FFFFFF",
    strokeHex: "#334155",
    lineWidthPt: 0.45,
  });
  drawText(cmds, pageH, "1..4", left + 59.0, row1Y + 2.0, {
    font: "F2",
    sizePt: 5.1,
    colorHex: "#000000",
    align: "center",
    boxWidthMm: 4.4,
  });
  const intervalsText = (doc.configuredLunchIntervals || [])
    .map((it) => `${it.slot}: ${it.horario}`)
    .join("  ·  ");
  drawText(cmds, pageH, `Intervalos (${intervalsText})`, left + 64.2, row1Y + 2.0, {
    font: "F1",
    sizePt: 5.2,
    colorHex: "#1E293B",
  });

  // Linha 2 da Legenda: Cores dos cabeçalhos de data + Faixas de férias/afastamento
  const row2Y = footerTop + 4.45;
  drawText(cmds, pageH, "CABEÇALHOS:", left + 2.0, row2Y + 2.0, {
    font: "F2",
    sizePt: 5.3,
    colorHex: "#0F172A",
  });

  // Domingo (Cinza)
  drawRect(cmds, pageH, left + 19.5, row2Y, 2.8, 2.3, {
    fillHex: "#CBD5E1",
    strokeHex: "#475569",
    lineWidthPt: 0.35,
  });
  drawText(cmds, pageH, "Domingo", left + 23.0, row2Y + 1.9, {
    font: "F1",
    sizePt: 5.2,
    colorHex: "#1E293B",
  });

  // Feriado (Azul)
  drawRect(cmds, pageH, left + 35.0, row2Y, 2.8, 2.3, {
    fillHex: "#2B5690",
    strokeHex: "#1E3A8A",
    lineWidthPt: 0.35,
  });
  drawText(cmds, pageH, "Feriado", left + 38.5, row2Y + 1.9, {
    font: "F1",
    sizePt: 5.2,
    colorHex: "#1E293B",
  });

  // Data Especial / Maior Movimento (Vermelho)
  drawRect(cmds, pageH, left + 49.0, row2Y, 2.8, 2.3, {
    fillHex: "#E9403C",
    strokeHex: "#991B1B",
    lineWidthPt: 0.35,
  });
  drawText(cmds, pageH, "Data Especial / Pico", left + 52.5, row2Y + 1.9, {
    font: "F1",
    sizePt: 5.2,
    colorHex: "#1E293B",
  });

  // Meio Expediente (Âmbar)
  drawRect(cmds, pageH, left + 74.5, row2Y, 2.8, 2.3, {
    fillHex: "#FDE68A",
    strokeHex: "#B45309",
    lineWidthPt: 0.35,
  });
  drawText(cmds, pageH, "Meio Expediente (1/2)", left + 78.0, row2Y + 1.9, {
    font: "F1",
    sizePt: 5.2,
    colorHex: "#1E293B",
  });

  // Faixas de Férias e Afastamentos
  drawRect(cmds, pageH, left + 103.5, row2Y, 4.2, 2.3, {
    fillHex: "#FEF3C7",
    strokeHex: "#B45309",
    lineWidthPt: 0.4,
  });
  drawRect(cmds, pageH, left + 108.3, row2Y, 4.2, 2.3, {
    fillHex: "#EDE9FE",
    strokeHex: "#5B21B6",
    lineWidthPt: 0.4,
  });
  drawText(
    cmds,
    pageH,
    "Faixas horizontais: Férias / Licença-Maternidade / Afastamento INSS / Vigência Contratual",
    left + 113.3,
    row2Y + 1.9,
    {
      font: "F1",
      sizePt: 5.2,
      colorHex: "#1E293B",
    }
  );

  drawText(
    cmds,
    pageH,
    `Emitido em ${doc.emittedAtFormatted}  ·  Página ${page.pageNumber} de ${page.totalPages}`,
    right - 68.0,
    footerTop + 4.9,
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

  const objects = [];
  const addObject = (bodyStr) => {
    const id = objects.length + 1;
    objects.push({ id, bodyStr });
    return id;
  };

  addObject(""); // 1: Catalog
  addObject(""); // 2: Pages
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
