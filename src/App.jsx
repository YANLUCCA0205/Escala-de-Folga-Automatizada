// ═══════════════════════════════════════════════════════════════════
//  ESCALA DE FOLGAS — v4.0
//  npm install xlsx
// ═══════════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

// ───────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ───────────────────────────────────────────────────────────────────
const parseDias = (str = "") =>
  String(str).split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n >= 1 && n <= 31);

const cfgVazia = () => ({
  diasCriticos: [], diasPagamento: [], feriados: [], minimosPorSetor: {},
});

const garantirCfg = (cfgUnidades, unidades) => {
  const novo = { ...cfgUnidades };
  unidades.forEach((u) => { if (!novo[u]) novo[u] = cfgVazia(); });
  return novo;
};

// Parseia a coluna FOLGAS do CSV
// Retorna { tipo: "6x1_dom" | "5x1" | "6x1_flex", diasFlex: ["SAB","DOM","SEG",...] }
const parseRegimeFolga = (str = "") => {
  const s = str.toUpperCase().trim();
  if (!s) return { tipo: "6x1_dom", diasFlex: ["DOM"] };

  // Extrai dias entre parênteses, ex: "(SAB/DOM/SEG)" → ["SAB","DOM","SEG"]
  const match = s.match(/\(([^)]+)\)/);
  const diasRaw = match ? match[1].split("/").map((d) => d.trim()).filter(Boolean) : [];

  if (s.startsWith("5X1")) return { tipo: "5x1", diasFlex: [] };

  // 6X1 com apenas DOM → sempre domingo
  if (diasRaw.length === 1 && diasRaw[0] === "DOM") return { tipo: "6x1_dom", diasFlex: ["DOM"] };

  // 6X1 com múltiplos dias (SAB/DOM, DOM/SEG, SAB/DOM/SEG etc.) → flex
  if (diasRaw.length >= 2) return { tipo: "6x1_flex", diasFlex: diasRaw };

  // fallback
  return { tipo: "6x1_dom", diasFlex: ["DOM"] };
};

// Converte nome do dia para número getDay() 0=Dom, 1=Seg ... 6=Sab
const DIAS_DOW = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 };
const DIAS7    = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const SETORES_ORDEM = [
  "CAIXA","CAIXA/PACOTE","CAIXA/LANCHONETE","REPOSIÇÃO","AÇOUGUE","PADARIA",
  "HORTIFRUTI","LIMPEZA","DEPÓSITO","FRIOS","ESTOQUE","ENTREGA",
  "ADMINISTRATIVO OPERACIONAL","ADMINISTRATIVO","ADM","COMERCIAL","MARKETING",
  "FINANCEIRO","RH/ DP","RH / DP","ADMINISTRATIVO ","CONTÁBIL FISCAL",
  "TI","PREVENÇÃO DE PERDAS","PREVENÇÃO P.",
];

// ───────────────────────────────────────────────────────────────────
// MODELS
// ───────────────────────────────────────────────────────────────────
class ConfiguracaoMes {
  constructor({ dataInicio, dias, unidades }) {
    this.dataInicio = dataInicio;
    this.dias       = dias;
    this.unidades   = unidades || {};
  }
  _u(u)                        { return this.unidades[u] || cfgVazia(); }
  getDiasCriticos(u)           { return this._u(u).diasCriticos  || []; }
  getDiasPagamento(u)          { return this._u(u).diasPagamento || []; }
  getFeriados(u)               { return this._u(u).feriados      || []; }
  getMinimoPorSetor(u, setor)  { return this._u(u).minimosPorSetor?.[setor] ?? 1; }
  isDiaCritico(u, d) {
    return [...this.getDiasCriticos(u), ...this.getDiasPagamento(u), ...this.getFeriados(u)].includes(d);
  }
  getPesoDia(u, d) {
    if (this.getFeriados(u).includes(d))      return 2.5;
    if (this.getDiasPagamento(u).includes(d)) return 2.0;
    if (this.getDiasCriticos(u).includes(d))  return 1.8;
    const dow = this.getDow(d);
    return (dow === 0 || dow === 6) ? 1.4 : 1.0;
  }
  getDow(d) {
    const dt = new Date(this.dataInicio + "T12:00:00");
    dt.setDate(dt.getDate() + d - 1);
    return dt.getDay();
  }
  getDataDia(d) {
    const dt = new Date(this.dataInicio + "T12:00:00");
    dt.setDate(dt.getDate() + d - 1);
    return dt;
  }
}

class FuncionarioModel {
  constructor({ id, nome, setor, funcao, turno, unidade, regimeFolga }) {
    this.id          = String(id);
    this.nome        = nome.trim();
    this.setor       = setor.trim();
    this.funcao      = (funcao || "").trim();
    this.turno       = (turno  || "").trim();
    this.unidade     = unidade.trim();
    this.regimeFolga = regimeFolga; // { tipo, diasFlex }
    this.ferias      = null;
    this.cargoVago   = false;
    this._escProvisoria = {};
  }
}

// ───────────────────────────────────────────────────────────────────
// GERADORES DE ESCALA POR REGIME
// ───────────────────────────────────────────────────────────────────

/**
 * 6X1 (DOM) — Folga sempre no domingo
 */
function gerarEscala6x1Dom(func, cfg) {
  const e = {};
  for (let d = 1; d <= cfg.dias; d++) {
    e[d] = cfg.getDow(d) === 0 ? "F" : "T";
  }
  return e;
}

/**
 * 5X1 — Trabalha 5, folga 1, regressivo.
 * O offset é baseado no índice do funcionário dentro do grupo para distribuir as folgas.
 */
function gerarEscala5x1(func, idx, cfg) {
  const e = {};
  // offset escalonado: cada funcionário começa em um ponto diferente do ciclo
  const offset = (idx * 1) % 6; // ciclo de 6 (5 trabalhando + 1 folga)
  for (let d = 1; d <= cfg.dias; d++) {
    const pos = (d - 1 + offset) % 6;
    e[d] = pos === 5 ? "F" : "T"; // o 6º dia do ciclo é folga
  }
  return e;
}

/**
 * 6X1 flex — Folga 1 dia por semana, escolhido entre os diasFlex permitidos.
 * Distribui entre os colegas do mesmo grupo para garantir cobertura mínima.
 * Lógica: cada semana, escolhe o dia flex que tem MAIS colegas trabalhando
 * (priorizando cobertura), com rotação baseada no índice do funcionário.
 */
function gerarEscala6x1Flex(func, idx, grupo, cfg) {
  const e = {};
  const dowsPermitidos = func.regimeFolga.diasFlex
    .map((d) => DIAS_DOW[d])
    .filter((n) => n !== undefined);

  if (dowsPermitidos.length === 0) {
    // fallback para domingo
    return gerarEscala6x1Dom(func, cfg);
  }

  // Para cada semana, decide qual dia de folga usar
  // Rotaciona pelo índice para distribuir entre colegas
  let semana = 0;
  for (let d = 1; d <= cfg.dias; d++) {
    const dow = cfg.getDow(d);
    if (dowsPermitidos.includes(dow)) {
      // É um candidato a folga nesta semana
      // Qual semana estamos? (conta quantas vezes passamos por um DOM)
      const dowEscolhido = dowsPermitidos[(semana + idx) % dowsPermitidos.length];
      e[d] = dow === dowEscolhido ? "F" : "T";
      if (dow === dowsPermitidos[dowsPermitidos.length - 1]) semana++;
    } else {
      e[d] = "T";
    }
  }

  // Garante que o funcionário tenha exatamente ~4 folgas num mês de 31 dias (1/7)
  return e;
}

// Dispatcher principal
function gerarEscalaFuncionario(func, idx, grupo, cfg) {
  const { tipo } = func.regimeFolga;
  if (tipo === "6x1_dom")  return gerarEscala6x1Dom(func, cfg);
  if (tipo === "5x1")      return gerarEscala5x1(func, idx, cfg);
  if (tipo === "6x1_flex") return gerarEscala6x1Flex(func, idx, grupo, cfg);
  return gerarEscala6x1Dom(func, cfg); // fallback
}

// ───────────────────────────────────────────────────────────────────
// ALERTA ENGINE
// ───────────────────────────────────────────────────────────────────
class AlertaEngine {
  static verificar(funcionarios, escala, config) {
    const alertas = [], grupos = {};
    funcionarios.forEach((f) => {
      const k = `${f.unidade}||${f.setor}`;
      (grupos[k] = grupos[k] || []).push(f);
    });
    Object.entries(grupos).forEach(([k, lista]) => {
      const [unidade, setor] = k.split("||");
      const minimo = config.getMinimoPorSetor(unidade, setor);
      for (let d = 1; d <= config.dias; d++) {
        const dow = config.getDow(d);
        const trabalhando = lista.filter(
          (f) => !f.ferias && !f.cargoVago && (escala[f.id]?.[d] || "T") === "T"
        ).length;
        if (trabalhando < minimo && !(dow === 0 && minimo <= 0)) {
          alertas.push({
            tipo: "cobertura", nivel: "erro", dia: d, unidade, setor,
            msg: `${setor} / ${unidade}: ${trabalhando} de ${minimo} no dia ${d} (${DIAS7[dow]})`,
          });
        }
        if (config.isDiaCritico(unidade, d)) {
          const folgando = lista.filter((f) => (escala[f.id]?.[d] || "T") === "F").length;
          if (folgando > 0 && trabalhando <= minimo) {
            alertas.push({
              tipo: "critico", nivel: "aviso", dia: d, unidade, setor,
              msg: `Dia crítico ${d}: ${folgando} de folga em ${setor}/${unidade} com cobertura no limite`,
              funcIds: lista.filter((f) => escala[f.id]?.[d] === "F").map((f) => f.id),
            });
          }
        }
      }
    });
    return alertas;
  }
}

// ───────────────────────────────────────────────────────────────────
// TROCA ENGINE
// ───────────────────────────────────────────────────────────────────
class TrocaEngine {
  static sugerir({ funcAlvo, diaAlvo, funcionarios, escala, config }) {
    return funcionarios
      .filter((f) =>
        f.id !== funcAlvo.id &&
        f.setor === funcAlvo.setor &&
        f.unidade === funcAlvo.unidade &&
        !f.ferias && !f.cargoVago &&
        (escala[f.id]?.[diaAlvo] || "T") === "T"
      )
      .map((c) => {
        const par = Object.entries(escala[c.id] || {}).find(([d, v]) => v === "F" && Number(d) !== diaAlvo);
        return {
          funcionario: c,
          diaFolgaAtual: par ? Number(par[0]) : null,
          impacto: config.isDiaCritico(funcAlvo.unidade, diaAlvo) ? "alto" : "baixo",
        };
      });
  }
  static executar({ funcAlvo, diaAlvo, funcCandidato, escalaAtual }) {
    return {
      ...escalaAtual,
      [funcAlvo.id]:      { ...escalaAtual[funcAlvo.id],      [diaAlvo]: "T" },
      [funcCandidato.id]: { ...escalaAtual[funcCandidato.id], [diaAlvo]: "F" },
    };
  }
}

// ───────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ───────────────────────────────────────────────────────────────────
export default function EscalaFolga() {
  const [funcionarios,   setFuncionarios]   = useState([]);
  const [escala,         setEscala]         = useState({});
  const [intervalos,     setIntervalos]     = useState({});
  const [diasNum,        setDiasNum]        = useState(31);
  const [dataInicio,     setDataInicio]     = useState("2026-05-01");
  const [aba,            setAba]            = useState("escala");
  const [trocaAlvo,      setTrocaAlvo]      = useState(null);
  const [trocaSugestoes, setTrocaSugestoes] = useState([]);
  const [filtroLoja,     setFiltroLoja]     = useState("");
  const [filtroSetor,    setFiltroSetor]    = useState("");
  const [filtroTurno,    setFiltroTurno]    = useState("");
  const [feriasModal,    setFeriasModal]    = useState(null);
  const [cfgUnidades,    setCfgUnidades]    = useState({});

  const config = useMemo(() => {
    const unidades = garantirCfg(cfgUnidades, funcionarios.map((f) => f.unidade));
    return new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades });
  }, [dataInicio, diasNum, cfgUnidades, funcionarios]);

  // ── importar CSV ────────────────────────────────────────────────
  // Colunas: Nº, LOJA, SETOR, FUNÇÃO, TURNO, NOME, FOLGAS
  const importarCSV = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (ev) => {
      const buffer = ev.target.result;
      let texto;
      try {
        const dec = new TextDecoder("utf-8", { fatal: true });
        texto = dec.decode(buffer);
        if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
      } catch {
        texto = new TextDecoder("windows-1252").decode(buffer);
      }
      const sep    = texto.includes(";") ? ";" : ",";
      const linhas = texto.split("\n").filter((l) => l.trim());
      const dados  = linhas.slice(1).map((linha) => {
        const c = linha.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
        // c[0]=Nº  c[1]=LOJA  c[2]=SETOR  c[3]=FUNÇÃO  c[4]=TURNO  c[5]=NOME  c[6]=FOLGAS
        const num    = c[0] || "";
        const loja   = c[1] ? `LOJA ${c[1].trim()}` : "LOJA 1";
        const setor  = (c[2] || "GERAL").trim().toUpperCase();
        const funcao = (c[3] || "").trim();
        const turno  = (c[4] || "").trim().toUpperCase();
        const nome   = (c[5] || "").trim();
        const folgas = (c[6] || "").trim();

        if (!nome) return null;

        const regime = parseRegimeFolga(folgas);
        const f = new FuncionarioModel({
          id: num || String(Math.random()),
          nome, setor, funcao, turno,
          unidade: loja,
          regimeFolga: regime,
        });
        f.cargoVago = nome.toUpperCase().includes("CARGO VAGO");
        return f;
      }).filter(Boolean);

      const novasCfgs = garantirCfg(cfgUnidades, dados.map((f) => f.unidade));
      setCfgUnidades(novasCfgs);
      setFuncionarios(dados);
      gerarEscala(dados, new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades: novasCfgs }));
    };
    leitor.readAsArrayBuffer(arquivo);
  };

  // ── gerar escala ────────────────────────────────────────────────
  const gerarEscala = useCallback((lista, cfg) => {
    const nova = {};
    const grupos = {};
    lista.forEach((f) => {
      const k = `${f.unidade}||${f.setor}`;
      (grupos[k] = grupos[k] || []).push(f);
    });

    Object.values(grupos).forEach((grupo) => {
      grupo.forEach((func, idx) => {
        if (func.cargoVago) { nova[func.id] = {}; return; }

        // Férias
        if (func.ferias) {
          nova[func.id] = {};
          for (let d = 1; d <= cfg.dias; d++) {
            const dt  = cfg.getDataDia(d);
            const iso = dt.toISOString().slice(0, 10);
            nova[func.id][d] = (iso >= func.ferias.inicio && iso <= func.ferias.fim) ? "V" : "T";
          }
          return;
        }

        nova[func.id] = gerarEscalaFuncionario(func, idx, grupo, cfg);
      });
    });
    setEscala(nova);
  }, []);

  // ── alternar célula ─────────────────────────────────────────────
  const alternar = (id, dia) => {
    const seq = { T: "F", F: "T", V: "V" };
    setEscala((prev) => ({ ...prev, [id]: { ...prev[id], [dia]: seq[prev[id]?.[dia] || "T"] } }));
  };

  // ── intervalo domingo ───────────────────────────────────────────
  const alternarIntervalo = (id, dia) => {
    const key = `${id}_${dia}`;
    setIntervalos((prev) => {
      const cur = prev[key];
      if (!cur) return { ...prev, [key]: "1" };
      if (cur === "4") { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: String(Number(cur) + 1) };
    });
  };

  // ── férias ──────────────────────────────────────────────────────
  const salvarFerias = (funcId, inicio, fim) => {
    setFuncionarios((prev) => {
      const nova = prev.map((f) => {
        if (f.id !== funcId) return f;
        const upd = Object.assign(Object.create(Object.getPrototypeOf(f)), f);
        upd.ferias = inicio && fim ? { inicio, fim } : null;
        return upd;
      });
      gerarEscala(nova, config);
      return nova;
    });
    setFeriasModal(null);
  };

  // ── alertas ─────────────────────────────────────────────────────
  const alertas = useMemo(() => {
    if (!funcionarios.length) return [];
    return AlertaEngine.verificar(funcionarios.filter((f) => !f.ferias && !f.cargoVago), escala, config);
  }, [funcionarios, escala, config]);

  // ── troca ───────────────────────────────────────────────────────
  const abrirTroca = (func, dia) => {
    setTrocaSugestoes(TrocaEngine.sugerir({ funcAlvo: func, diaAlvo: dia, funcionarios, escala, config }));
    setTrocaAlvo({ func, dia });
    setAba("troca");
  };
  const executarTroca = (candidato) => {
    setEscala(TrocaEngine.executar({ funcAlvo: trocaAlvo.func, diaAlvo: trocaAlvo.dia, funcCandidato: candidato.funcionario, escalaAtual: escala }));
    setAba("escala"); setTrocaAlvo(null);
  };

  // ── helpers layout ──────────────────────────────────────────────
  const lojas     = useMemo(() => [...new Set(funcionarios.map((f) => f.unidade))].sort(), [funcionarios]);
  const diasLista = useMemo(() => Array.from({ length: diasNum }, (_, i) => i + 1), [diasNum]);

  const setoresDaLoja = (loja) => {
    const p = [...new Set(funcionarios.filter((f) => f.unidade === loja).map((f) => f.setor))];
    return p.sort((a, b) => {
      const ia = SETORES_ORDEM.indexOf(a), ib = SETORES_ORDEM.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  };

  const funcsDaLoja = (loja, setor, turno) =>
    funcionarios
      .filter((f) => f.unidade === loja && f.setor === setor && (!turno || f.turno === turno))
      .sort((a, b) => {
        if (a.cargoVago && !b.cargoVago) return 1;
        if (!a.cargoVago && b.cargoVago) return -1;
        return a.nome.localeCompare(b.nome, "pt");
      });

  const lojasFiltradas = filtroLoja ? lojas.filter((l) => l === filtroLoja) : lojas;

  const setCfgCampo = (unidade, campo, valor) => {
    setCfgUnidades((prev) => ({
      ...prev,
      [unidade]: { ...(prev[unidade] || cfgVazia()), [campo]: valor },
    }));
  };

  const tituloMes = useMemo(() => {
    const dt = new Date(dataInicio + "T12:00:00");
    return `${MESES_PT[dt.getMonth()].toUpperCase()} DE ${dt.getFullYear()}`;
  }, [dataInicio]);

  const getFeriasLabel = (func) => {
    if (!func.ferias) return null;
    const fmtBR = (iso) => iso.split("-").reverse().join("/");
    return `FÉRIAS EM ${fmtBR(func.ferias.inicio)} ATÉ ${fmtBR(func.ferias.fim)}`;
  };

  const getFeriasSpan = (func) => {
    if (!func.ferias) return null;
    let inicio = null, fim = null;
    for (let d = 1; d <= diasNum; d++) {
      if ((escala[func.id]?.[d] || "T") === "V") {
        if (inicio === null) inicio = d;
        fim = d;
      }
    }
    return inicio !== null ? { inicio, fim, span: fim - inicio + 1 } : null;
  };

  // ── badge de regime ─────────────────────────────────────────────
  const badgeRegime = (func) => {
    if (!func.regimeFolga) return null;
    const { tipo, diasFlex } = func.regimeFolga;
    const txt =
      tipo === "5x1"      ? "5×1" :
      tipo === "6x1_dom"  ? "6×1 Dom" :
      `6×1 (${diasFlex.join("/")})`;
    const bg =
      tipo === "5x1"      ? "#1d4ed8" :
      tipo === "6x1_dom"  ? "#166534" :
      "#7c3aed";
    return (
      <span style={{ fontSize: 8, fontWeight: 700, color: "#fff", background: bg, borderRadius: 3, padding: "1px 4px", marginLeft: 4, verticalAlign: "middle", whiteSpace: "nowrap" }}>
        {txt}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // EXPORTAR XLSX
  // ═══════════════════════════════════════════════════════════════
  const exportarXLSX = () => {
    if (!funcionarios.length) return;
    const wb  = XLSX.utils.book_new();
    const borda = (cor = "AAAAAA") => ({
      top: { style: "thin", color: { rgb: cor } }, bottom: { style: "thin", color: { rgb: cor } },
      left: { style: "thin", color: { rgb: cor } }, right: { style: "thin", color: { rgb: cor } },
    });
    const cell = (v, s) => ({ v, t: "s", s });
    const estilo = {
      titulo:  { font: { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
      setorH:  { font: { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
      diaH:    { font: { name: "Arial", sz: 8, bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "CCCCCC" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
      diaHFim: { font: { name: "Arial", sz: 8, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "888888" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
      diaHCrit:{ font: { name: "Arial", sz: 8, bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
      nome:    { font: { name: "Arial", sz: 8 }, fill: { patternType: "none" }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
      funcao:  { font: { name: "Arial", sz: 7, color: { rgb: "666666" } }, fill: { patternType: "none" }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
      vago:    { font: { name: "Arial", sz: 8, color: { rgb: "888888" } }, fill: { patternType: "solid", fgColor: { rgb: "DDDDDD" } }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
      folga:   { fill: { patternType: "solid", fgColor: { rgb: "000000" } }, border: borda("000000") },
      trab:    { fill: { patternType: "none" }, border: borda() },
      ferias:  { font: { name: "Arial", sz: 7, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "166534" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
      intNum:  { font: { name: "Arial", sz: 8, bold: true }, fill: { patternType: "none" }, alignment: { horizontal: "center", vertical: "center" }, border: borda() },
      turnoM:  { font: { name: "Arial", sz: 7, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1e40af" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda() },
      turnoT:  { font: { name: "Arial", sz: 7, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "92400e" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda() },
    };

    lojas.forEach((loja) => {
      const ws = {}, merges = [];
      let row = 0;
      const totalCols = 2 + diasNum; // col0=nome, col1=turno, col2..=dias
      const set = (r, c, v) => { ws[XLSX.utils.encode_cell({ r, c })] = v; };
      const criticos = [...config.getDiasCriticos(loja), ...config.getDiasPagamento(loja), ...config.getFeriados(loja)];

      set(row, 0, cell(`${tituloMes} - ${loja}`, estilo.titulo));
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: totalCols } });
      row++;

      setoresDaLoja(loja).forEach((setor) => {
        // Cabeçalho setor
        set(row, 0, cell(setor, estilo.setorH));
        set(row, 1, cell("", estilo.setorH));
        for (let d = 1; d <= diasNum; d++) {
          const dow  = config.getDow(d);
          const fim  = dow === 0 || dow === 6;
          const crit = criticos.includes(d);
          set(row, d + 1, cell(`${DIAS7[dow]}\n${d}`, crit ? estilo.diaHCrit : fim ? estilo.diaHFim : estilo.diaH));
        }
        row++;

        funcsDaLoja(loja, setor, "").forEach((func) => {
          const estiloNome = func.cargoVago ? estilo.vago : estilo.nome;
          const turnoLabel = func.turno === "MANHÃ" ? "M" : func.turno === "TARDE" ? "T" : func.turno.charAt(0);
          const estiloTurno = func.turno === "MANHÃ" ? estilo.turnoM : estilo.turnoT;
          set(row, 0, cell(func.cargoVago ? "CARGO VAGO" : `${func.nome}`, estiloNome));
          set(row, 1, cell(turnoLabel, estiloTurno));

          const fspan = getFeriasSpan(func);
          if (fspan && func.ferias) {
            for (let d = 1; d < fspan.inicio; d++) {
              const v = escala[func.id]?.[d] || "T";
              set(row, d + 1, cell("", v === "F" ? estilo.folga : estilo.trab));
            }
            set(row, fspan.inicio + 1, cell(getFeriasLabel(func), estilo.ferias));
            if (fspan.span > 1)
              merges.push({ s: { r: row, c: fspan.inicio + 1 }, e: { r: row, c: fspan.fim + 1 } });
            for (let d = fspan.fim + 1; d <= diasNum; d++) {
              const v = escala[func.id]?.[d] || "T";
              set(row, d + 1, cell("", v === "F" ? estilo.folga : estilo.trab));
            }
          } else {
            for (let d = 1; d <= diasNum; d++) {
              const v   = escala[func.id]?.[d] || "T";
              const dow = config.getDow(d);
              const key = `${func.id}_${d}`;
              const intv = intervalos[key];
              if (v === "F") {
                set(row, d + 1, cell("", estilo.folga));
              } else if (dow === 0 && intv) {
                set(row, d + 1, cell(intv, estilo.intNum));
              } else {
                set(row, d + 1, cell("", estilo.trab));
              }
            }
          }
          row++;
        });
      });

      ws["!cols"]   = [{ wch: 22 }, { wch: 3 }, ...Array(diasNum).fill({ wch: 3.5 })];
      ws["!merges"] = merges;
      ws["!ref"]    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: totalCols } });
      XLSX.utils.book_append_sheet(wb, ws, loja.replace(/[:\\\/\?\*\[\]]/g, "").substring(0, 31));
    });

    XLSX.writeFile(wb, `escala_${tituloMes.toLowerCase().replace(/ /g, "_")}.xlsx`);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.page}>
      {feriasModal && (
        <FeriasModal func={feriasModal} onSalvar={salvarFerias} onFechar={() => setFeriasModal(null)} />
      )}

      <div style={S.wrap}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.hTitle}>⬛ Escala de Folgas</div>
            <div style={S.hSub}>Sistema inteligente · {tituloMes}</div>
          </div>
          <div style={S.hControls}>
            <label style={S.lbl}>CSV:</label>
            <input type="file" accept=".csv" onChange={importarCSV} style={S.fileIn} />
            <label style={S.lbl}>Início:</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={S.inp} />
            <label style={S.lbl}>Dias:</label>
            <input type="number" min={1} max={31} value={diasNum}
              onChange={(e) => {
                const v = +e.target.value; setDiasNum(v);
                if (funcionarios.length) gerarEscala(funcionarios, new ConfiguracaoMes({ dataInicio, dias: v, unidades: garantirCfg(cfgUnidades, funcionarios.map((f) => f.unidade)) }));
              }} style={{ ...S.inp, width: 58 }} />
            <button onClick={() => gerarEscala(funcionarios, config)} style={S.btn}>🔄 Regerar</button>
            <button onClick={exportarXLSX} style={{ ...S.btn, ...S.btnR }}>📥 Exportar XLSX</button>
          </div>
        </div>

        {/* Abas */}
        <div style={S.tabs}>
          {[
            { id: "escala",  label: "📅 Escala" },
            { id: "config",  label: "⚙️ Configuração" },
            { id: "alertas", label: `🔔 Alertas${alertas.length ? ` (${alertas.length})` : ""}` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setAba(id)} style={{ ...S.tab, ...(aba === id ? S.tabOn : {}) }}>{label}</button>
          ))}
        </div>

        {/* ════ ABA CONFIG ════ */}
        {aba === "config" && (
          <div style={{ paddingTop: 12 }}>
            <p style={S.hint}>Configure antes de gerar. Dias separados por vírgula (ex: 5, 20).</p>
            {(funcionarios.length ? lojas : ["LOJA 1","LOJA 2","LOJA 3"]).map((unidade) => {
              const cfg = cfgUnidades[unidade] || cfgVazia();
              return (
                <div key={unidade} style={S.card}>
                  <div style={S.cardTit}>{unidade}</div>
                  <div style={S.grid3}>
                    {[
                      ["🔴 Oferta / Promoção", "diasCriticos"],
                      ["💰 Pagamento Salarial", "diasPagamento"],
                      ["🗓 Feriados",           "feriados"],
                    ].map(([label, campo]) => (
                      <div key={campo}>
                        <label style={S.lbl}>{label}</label>
                        <input style={S.inpFull} placeholder="ex: 5, 20"
                          defaultValue={(cfg[campo] || []).join(", ")}
                          onBlur={(e) => setCfgCampo(unidade, campo, parseDias(e.target.value))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={S.lbl}>👥 Mínimo por setor/dia (0 = sem restrição)</label>
                    <div style={{ ...S.grid3, marginTop: 6 }}>
                      {SETORES_ORDEM.slice(0, 16).map((setor) => (
                        <div key={setor} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#444", minWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{setor}</span>
                          <input type="number" min={0} max={20} style={{ ...S.inp, width: 52 }}
                            defaultValue={cfg.minimosPorSetor?.[setor] ?? 1}
                            onBlur={(e) => setCfgCampo(unidade, "minimosPorSetor", { ...(cfgUnidades[unidade]?.minimosPorSetor || {}), [setor]: parseInt(e.target.value) || 0 })} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {funcionarios.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTit}>🌴 Férias por Funcionário</div>
                <p style={S.hint}>Defina o período exato de férias. Pode ser parcial ou iniciar no mês anterior.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {funcionarios.filter((f) => !f.cargoVago).map((f) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: f.ferias ? "#f0fdf4" : "#fafafa", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 12, flex: 1 }}>
                        {f.nome}
                        <span style={{ color: "#888", fontSize: 11 }}> ({f.funcao || f.setor} · {f.unidade})</span>
                      </span>
                      {f.ferias && (
                        <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>
                          🌴 {f.ferias.inicio.split("-").reverse().join("/")} → {f.ferias.fim.split("-").reverse().join("/")}
                        </span>
                      )}
                      <button onClick={() => setFeriasModal(f)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>
                        {f.ferias ? "✏️ Editar" : "+ Férias"}
                      </button>
                      {f.ferias && (
                        <button onClick={() => salvarFerias(f.id, null, null)} style={{ ...S.btn, fontSize: 11, color: "#CC0000", padding: "4px 8px" }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ ABA ALERTAS ════ */}
        {aba === "alertas" && (
          <div style={{ paddingTop: 12 }}>
            {alertas.length === 0
              ? <div style={S.empty}>✅ Nenhum alerta. Escala dentro dos parâmetros.</div>
              : alertas.map((a, i) => (
                <div key={i} style={{ ...S.alertCard, borderLeftColor: a.nivel === "erro" ? "#CC0000" : "#b45309" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: a.nivel === "erro" ? "#CC0000" : "#b45309", fontSize: 12 }}>
                      {a.nivel === "erro" ? "❌ ERRO" : "⚠️ AVISO"}
                    </span>
                    <span style={{ fontSize: 11, color: "#888" }}>Dia {a.dia}</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{a.msg}</div>
                  {a.tipo === "critico" && a.funcIds?.length > 0 && (
                    <button style={{ ...S.btn, marginTop: 8, fontSize: 11 }}
                      onClick={() => {
                        const func = funcionarios.find((f) => a.funcIds.includes(f.id));
                        if (func) abrirTroca(func, a.dia);
                      }}>🔄 Sugerir troca</button>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* ════ ABA TROCA ════ */}
        {aba === "troca" && trocaAlvo && (
          <div style={{ paddingTop: 12 }}>
            <div style={S.card}>
              <div style={S.cardTit}>🔄 Troca de Folga</div>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                <strong>{trocaAlvo.func.nome}</strong>{" "}
                <span style={{ color: "#888" }}>({trocaAlvo.func.setor} · {trocaAlvo.func.unidade})</span>{" "}
                — Dia <strong>{trocaAlvo.dia}</strong>
              </p>
              {trocaSugestoes.length === 0
                ? <div style={S.empty}>Nenhum colega disponível para troca neste dia.</div>
                : trocaSugestoes.map((s, i) => (
                  <div key={i} style={{ ...S.alertCard, borderLeftColor: s.impacto === "alto" ? "#CC0000" : "#15803d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.funcionario.nome}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        Folga atual: Dia {s.diaFolgaAtual ?? "–"} ·{" "}
                        <span style={{ color: s.impacto === "alto" ? "#CC0000" : "#15803d", fontWeight: 600 }}>Impacto {s.impacto}</span>
                      </div>
                    </div>
                    <button onClick={() => executarTroca(s)} style={{ ...S.btn, ...S.btnR, fontSize: 11 }}>✅ Confirmar</button>
                  </div>
                ))
              }
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => { setAba("escala"); setTrocaAlvo(null); }} style={{ ...S.btn, color: "#CC0000", borderColor: "#CC0000", fontWeight: 600 }}>
                  ⚠️ Manter sem trocas (assumir risco)
                </button>
                <button onClick={() => { setAba("escala"); setTrocaAlvo(null); }} style={S.btn}>← Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* ════ ABA ESCALA ════ */}
        {aba === "escala" && (
          <>
            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <select style={S.inp} value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
                <option value="">Todas as lojas</option>
                {lojas.map((l) => <option key={l}>{l}</option>)}
              </select>
              <select style={S.inp} value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
                <option value="">Todos os setores</option>
                {SETORES_ORDEM.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select style={S.inp} value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value)}>
                <option value="">Todos os turnos</option>
                <option value="MANHÃ">Manhã</option>
                <option value="TARDE">Tarde</option>
              </select>
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {[["#000","Folga"],["#fff","Trabalho"],["#166534","Férias"]].map(([bg, lb]) => (
                  <div key={lb} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: "1px solid #aaa" }} />{lb}
                  </div>
                ))}
                <span style={{ fontSize: 10, color: "#aaa" }}>Clique: alterna · Clique dir. em folga: trocar</span>
              </div>
            </div>

            {/* Banner de erros */}
            {alertas.filter((a) => a.nivel === "erro").length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 12, display: "flex", alignItems: "center", gap: 10 }}>
                ❌ <strong>{alertas.filter((a) => a.nivel === "erro").length}</strong> erro(s) de cobertura.
                <button onClick={() => setAba("alertas")} style={{ ...S.btn, fontSize: 11, padding: "2px 10px" }}>Ver alertas</button>
              </div>
            )}

            {!funcionarios.length ? (
              <div style={S.empty}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                Importe um CSV para visualizar a escala
                <div style={{ fontSize: 11, marginTop: 6, color: "#bbb" }}>Formato: Nº, LOJA, SETOR, FUNÇÃO, TURNO, NOME, FOLGAS</div>
              </div>
            ) : (
              lojasFiltradas.map((loja) => {
                const setores = setoresDaLoja(loja).filter((s) => !filtroSetor || s === filtroSetor);
                if (!setores.length) return null;
                return (
                  <div key={loja} style={{ marginBottom: 28 }}>
                    <div style={S.lojaH}>{tituloMes} — {loja}</div>
                    {setores.map((setor) => {
                      const lista = funcsDaLoja(loja, setor, filtroTurno);
                      if (!lista.length) return null;

                      // Sub-cabeçalho de turno se não há filtro
                      const turnos = [...new Set(lista.map((f) => f.turno))].sort();

                      return (
                        <div key={setor}>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ borderCollapse: "collapse", fontSize: 10.5, tableLayout: "fixed", minWidth: "100%" }}>
                              <thead>
                                <tr>
                                  <th style={{ ...S.thSetor, width: 160 }}>{setor}</th>
                                  {/* coluna turno */}
                                  <th style={{ ...S.thSetor, width: 22, fontSize: 8 }}>T</th>
                                  {diasLista.map((d) => {
                                    const dow  = config.getDow(d);
                                    const fim  = dow === 0 || dow === 6;
                                    const crit = config.isDiaCritico(loja, d);
                                    return (
                                      <th key={d} style={{ ...S.thDia, background: crit ? "#FEF3C7" : fim ? "#888" : "#ccc", color: fim && !crit ? "#fff" : "#000", width: 24 }}>
                                        <div style={{ fontSize: 8 }}>{DIAS7[dow]}</div>
                                        <div style={{ fontSize: 9, fontWeight: 700 }}>{d}</div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {lista.map((func) => {
                                  if (func.cargoVago) {
                                    return (
                                      <tr key={func.id} style={{ background: "#ddd" }}>
                                        <td style={{ ...S.tdNome, color: "#888", fontSize: 10 }}>CARGO VAGO</td>
                                        <td style={{ ...S.tdDia, background: "#ddd", fontSize: 8, textAlign: "center", color: "#aaa" }}>–</td>
                                        {diasLista.map((d) => <td key={d} style={{ ...S.tdDia, background: "#ddd" }} />)}
                                      </tr>
                                    );
                                  }

                                  const fspan  = getFeriasSpan(func);
                                  const fLabel = getFeriasLabel(func);
                                  const turnoColor = func.turno === "MANHÃ" ? "#1e40af" : "#92400e";

                                  return (
                                    <tr key={func.id}>
                                      <td style={S.tdNome}>
                                        {func.nome}
                                        {badgeRegime(func)}
                                        {func.ferias && (
                                          <span onClick={() => setFeriasModal(func)} title="Editar férias"
                                            style={{ cursor: "pointer", marginLeft: 4, fontSize: 9, color: "#166534" }}>🌴</span>
                                        )}
                                      </td>
                                      {/* Coluna turno */}
                                      <td style={{ ...S.tdDia, background: turnoColor, color: "#fff", fontSize: 8, fontWeight: 700, textAlign: "center" }}>
                                        {func.turno === "MANHÃ" ? "M" : func.turno === "TARDE" ? "T" : func.turno.charAt(0)}
                                      </td>

                                      {fspan && fLabel
                                        ? diasLista.map((d) => {
                                          if (d === fspan.inicio) {
                                            return (
                                              <td key={d} colSpan={fspan.span}
                                                style={{ ...S.tdDia, background: "#166534", color: "#fff", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}
                                                title={fLabel}>{fLabel}</td>
                                            );
                                          }
                                          if (d > fspan.inicio && d <= fspan.fim) return null;
                                          const v   = escala[func.id]?.[d] || "T";
                                          const dow = config.getDow(d);
                                          const intv = intervalos[`${func.id}_${d}`];
                                          return (
                                            <td key={d}
                                              style={{ ...S.tdDia, background: v === "F" ? "#000" : "#fff", cursor: "pointer" }}
                                              onClick={() => v !== "V" && alternar(func.id, d)}
                                              onContextMenu={(e) => { e.preventDefault(); if (v === "F") abrirTroca(func, d); }}>
                                              {dow === 0 && v === "T" && (
                                                <span onClick={(ev) => { ev.stopPropagation(); alternarIntervalo(func.id, d); }}
                                                  style={{ fontSize: 9, fontWeight: 700, color: "#000", cursor: "pointer", display: "block", textAlign: "center" }}>
                                                  {intv || ""}
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })
                                        : diasLista.map((d) => {
                                          const v    = escala[func.id]?.[d] || "T";
                                          const dow  = config.getDow(d);
                                          const intv = intervalos[`${func.id}_${d}`];
                                          return (
                                            <td key={d}
                                              style={{ ...S.tdDia, background: v === "F" ? "#000" : "#fff", cursor: "pointer"}}
                                              onClick={() => alternar(func.id, d)}
                                              onContextMenu={(e) => { e.preventDefault(); if (v === "F") abrirTroca(func, d); }}
                                              title={v === "F" ? "Folga" : dow === 0 ? "Clique para intervalo" : "Trabalho"}>
                                              {dow === 0 && v === "T" && (
                                                <span onClick={(ev) => { ev.stopPropagation(); alternarIntervalo(func.id, d); }}
                                                  style={{ fontSize: 9, fontWeight: 700, color: "#000", cursor: "pointer", display: "block", textAlign: "center" }}>
                                                  {intv || ""}
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })
                                      }
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// MODAL FÉRIAS
// ───────────────────────────────────────────────────────────────────
function FeriasModal({ func, onSalvar, onFechar }) {
  const [inicio, setInicio] = useState(func.ferias?.inicio || "");
  const [fim,    setFim]    = useState(func.ferias?.fim    || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: "1.5rem", width: 360, boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🌴 Férias — {func.nome}</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>Período completo (pode incluir dias fora do mês atual).</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[["Início", inicio, setInicio], ["Término", fim, setFim]].map(([label, val, set]) => (
            <div key={label}>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Data de {label}</label>
              <input type="date" value={val} onChange={(e) => set(e.target.value)}
                style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onFechar} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}>Cancelar</button>
          <button disabled={!inicio || !fim || inicio > fim}
            onClick={() => onSalvar(func.id, inicio, fim)}
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", background: "#166534", color: "#fff", cursor: "pointer", opacity: (!inicio || !fim || inicio > fim) ? 0.5 : 1 }}>
            💾 Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// ESTILOS
// ───────────────────────────────────────────────────────────────────
const S = {
  page:      { minHeight: "100vh", background: "#f0f0f0", padding: "1rem", fontFamily: "Arial, sans-serif" },
  wrap:      { maxWidth: 1600, margin: "0 auto", background: "#fff", borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,.1)", padding: "1rem" },
  header:    { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #e5e7eb" },
  hTitle:    { fontSize: 17, fontWeight: 700, color: "#111" },
  hSub:      { fontSize: 11, color: "#888", marginTop: 2 },
  hControls: { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" },
  lbl:       { fontSize: 11, color: "#555" },
  fileIn:    { fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, padding: "4px 7px", background: "#f9fafb", cursor: "pointer" },
  inp:       { fontSize: 11, padding: "4px 7px", borderRadius: 5, border: "1px solid #d1d5db", background: "#f9fafb", color: "#111" },
  inpFull:   { fontSize: 11, padding: "4px 7px", borderRadius: 5, border: "1px solid #d1d5db", background: "#f9fafb", color: "#111", width: "100%", marginTop: 3 },
  btn:       { fontSize: 11, padding: "5px 11px", borderRadius: 5, border: "1px solid #d1d5db", background: "#f9fafb", color: "#111", cursor: "pointer" },
  btnR:      { background: "#CC0000", color: "#fff", borderColor: "#CC0000" },
  tabs:      { display: "flex", gap: 2, borderBottom: "2px solid #e5e7eb", marginBottom: "1rem" },
  tab:       { fontSize: 12, padding: "7px 14px", border: "none", borderBottom: "2px solid transparent", background: "transparent", color: "#666", cursor: "pointer", marginBottom: -2 },
  tabOn:     { color: "#111", borderBottomColor: "#111", fontWeight: 700 },
  hint:      { fontSize: 11, color: "#888", marginBottom: 8, lineHeight: 1.5 },
  empty:     { textAlign: "center", padding: "2.5rem 1rem", color: "#aaa", border: "2px dashed #e5e7eb", borderRadius: 8 },
  card:      { border: "1px solid #e5e7eb", borderRadius: 7, padding: ".9rem", marginBottom: "1rem" },
  cardTit:   { fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 10 },
  grid3:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 },
  alertCard: { borderLeft: "4px solid #CC0000", background: "#fafafa", borderRadius: 5, padding: "9px 12px", marginBottom: 7 },
  lojaH:     { background: "#000", color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 12px", textAlign: "center", letterSpacing: ".06em" },
  thSetor:   { background: "#000", color: "#fff", fontWeight: 700, fontSize: 10, padding: "5px 6px", textAlign: "center", border: "1px solid #555", position: "sticky", left: 0, zIndex: 1 },
  thDia:     { padding: "2px 1px", border: "1px solid #aaa", textAlign: "center", fontWeight: 600 },
  tdNome:    { padding: "2px 6px", border: "1px solid #ddd", fontWeight: 400, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160, background: "#fff", position: "sticky", left: 0, zIndex: 0 },
  tdDia:     { padding: 0, border: "1px solid #ddd", height: 20, textAlign: "center" },
};