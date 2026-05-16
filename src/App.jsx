// ═══════════════════════════════════════════════════════════════════
//  ESCALA DE FOLGAS — v3.0
//  npm install xlsx
// ═══════════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ───────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ───────────────────────────────────────────────────────────────────
const parseDias = (str = "") =>
  String(str).split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n >= 1 && n <= 31);

const cfgVazia = () => ({
  diasCriticos: [], diasPagamento: [], feriados: [], minimosPorSetor: {},
});

// Garante que toda unidade tenha config válida — resolve o bug do .join
const garantirCfg = (cfgUnidades, unidades) => {
  const novo = { ...cfgUnidades };
  unidades.forEach((u) => { if (!novo[u]) novo[u] = cfgVazia(); });
  return novo;
};

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
  constructor({ id, nome, setor, carga, unidade }) {
    this.id      = String(id);
    this.nome    = nome.trim();
    this.setor   = setor.trim();
    this.carga   = carga.trim();
    this.unidade = unidade.trim();
    this.ferias  = null; // { inicio: "2026-05-04", fim: "2026-06-02" } | null
    this.cargoVago = false;
    this._escProvisoria = {};
  }
}

// ───────────────────────────────────────────────────────────────────
// CLASSES DE CARGO
// ───────────────────────────────────────────────────────────────────
class CargoBase {
  static PADROES = [
    [1,1,1,1,1,0,0],[0,1,1,1,1,1,0],[0,0,1,1,1,1,1],[1,0,0,1,1,1,1],
    [1,1,0,0,1,1,1],[1,1,1,0,0,1,1],[1,1,1,1,0,0,1],[1,0,1,1,1,0,1],
    [1,1,0,1,1,0,1],[1,0,1,0,1,1,1],[0,1,0,1,1,1,1],[1,1,1,0,1,0,1],
    [0,1,1,0,1,1,1],[1,0,1,1,0,1,1],[0,1,1,1,0,1,1],[1,1,0,1,0,1,1],
  ];
  gerarEscala(_f, _i, _c, _cfg) { throw new Error("não implementado"); }
  _base(idx, dias) {
    const pad = CargoBase.PADROES[idx % CargoBase.PADROES.length];
    const e = {};
    for (let d = 1; d <= dias; d++) e[d] = pad[(d - 1) % 7] ? "T" : "F";
    return e;
  }
}

class CargoAdministrativo extends CargoBase {
  gerarEscala(_f, _i, _c, cfg) {
    const e = {};
    for (let d = 1; d <= cfg.dias; d++) {
      const dow = cfg.getDow(d);
      e[d] = (dow === 0 || dow === 6) ? "F" : "T";
    }
    return e;
  }
}

class CargoCaixa extends CargoBase {
  gerarEscala(func, idx, colegas, cfg) {
    const criticos = [...cfg.getDiasCriticos(func.unidade), ...cfg.getDiasPagamento(func.unidade), ...cfg.getFeriados(func.unidade)];
    let melhor = this._base(idx, cfg.dias);
    let peso   = this._peso(melhor, criticos, cfg, func.unidade);
    for (let r = 0; r < CargoBase.PADROES.length; r++) {
      const c = this._base(r, cfg.dias);
      const p = this._peso(c, criticos, cfg, func.unidade);
      if (p < peso) { peso = p; melhor = c; }
    }
    criticos.forEach((dc) => {
      if (melhor[dc] !== "F") return;
      const folgando = colegas.filter((c) => c.id !== func.id && c._escProvisoria?.[dc] === "F").length;
      const minimo   = cfg.getMinimoPorSetor(func.unidade, func.setor);
      if (colegas.length - folgando > minimo) {
        const alt = [dc - 1, dc + 1, dc + 2, dc - 2].find(
          (x) => x >= 1 && x <= cfg.dias && !criticos.includes(x) && melhor[x] === "T"
        );
        if (alt) { melhor[alt] = "F"; melhor[dc] = "T"; }
      }
    });
    return melhor;
  }
  _peso(e, criticos, cfg, u) {
    return criticos.reduce((a, d) => a + (e[d] === "F" ? cfg.getPesoDia(u, d) : 0), 0);
  }
}

class CargoReposicao  extends CargoCaixa   {}
class CargoLimpeza    extends CargoBase     { gerarEscala(_f, i, _c, cfg) { return this._base(i, cfg.dias); } }
class CargoGenerico   extends CargoBase     { gerarEscala(_f, i, _c, cfg) { return this._base(i, cfg.dias); } }

class CargoFactory {
  static criar(setor) {
    switch (setor) {
      case "Administração":
      case "ADM":
      case "Financeiro":
      case "RH / DP":
      case "Comercial":
      case "Marketing":
      case "TI":
      case "Cont. Fiscal":
      case "Assistente ADM":
        return new CargoAdministrativo();
      case "Caixa":
      case "Caixa/Pacote":
      case "Caixa/Lanchonete":
        return new CargoCaixa();
      case "Reposição": return new CargoReposicao();
      case "Limpeza":   return new CargoLimpeza();
      default:          return new CargoGenerico();
    }
  }
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
        const domingo = dow === 0;
        const trabalhando = lista.filter(
          (f) => !f.ferias && !f.cargoVago && (escala[f.id]?.[d] || "T") === "T"
        ).length;
        if (trabalhando < minimo && !(domingo && minimo <= 0)) {
          alertas.push({
            tipo: "cobertura", nivel: "erro", dia: d, unidade, setor,
            msg: `${setor} / ${unidade}: ${trabalhando} de ${minimo} no dia ${d} (${["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dow]})`,
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
// CONSTANTES
// ───────────────────────────────────────────────────────────────────
const DIAS7 = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const SETORES_ORDEM = [
  "Caixa","Caixa/Pacote","Caixa/Lanchonete","Reposição","Açougue","Padaria",
  "Hortifruti","Financeiro","Limpeza","Depósito","Frios","Estoque","Entrega",
  "Administração","ADM","Comercial","Marketing","Financeiro","RH / DP",
  "Assistente ADM","TI","Cont. Fiscal","Prevenção P.",
];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ───────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ───────────────────────────────────────────────────────────────────
export default function EscalaFolga() {
  const [funcionarios,   setFuncionarios]   = useState([]);
  const [escala,         setEscala]         = useState({});
  const [intervalos,     setIntervalos]     = useState({}); // { funcId_dia: "1"|"2"|"3"|"4" }
  const [diasNum,        setDiasNum]        = useState(31);
  const [dataInicio,     setDataInicio]     = useState("2026-05-01");
  const [aba,            setAba]            = useState("escala");
  const [trocaAlvo,      setTrocaAlvo]      = useState(null);
  const [trocaSugestoes, setTrocaSugestoes] = useState([]);
  const [filtroLoja,     setFiltroLoja]     = useState("");
  const [filtroSetor,    setFiltroSetor]    = useState("");
  const [feriasModal,    setFeriasModal]    = useState(null); // func
  const [cfgUnidades,    setCfgUnidades]    = useState({});

  // ── config segura (nunca undefined) ────────────────────────────
  const config = useMemo(() => {
    const unidades = garantirCfg(cfgUnidades, funcionarios.map((f) => f.unidade));
    return new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades });
  }, [dataInicio, diasNum, cfgUnidades, funcionarios]);

  // ── importar CSV ────────────────────────────────────────────────
  const importarCSV = (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (ev) => {
      const buffer = ev.target.result;
      const bytes  = new Uint8Array(buffer);
      let texto;
      try {
        const dec = new TextDecoder("utf-8", { fatal: true });
        texto = dec.decode(buffer);
        if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
      } catch {
        texto = new TextDecoder("windows-1252").decode(buffer);
      }
      const sep   = texto.includes(";") ? ";" : ",";
      const linhas = texto.split("\n").filter((l) => l.trim());
      const dados  = linhas.slice(1).map((linha, i) => {
        const c = linha.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
        if (!c[1]) return null;
        const f = new FuncionarioModel({
          id: c[0] || String(i + 1), nome: c[1] || "Sem nome",
          setor: c[2] || "Geral", carga: c[3] || "44h", unidade: c[4] || "Sem Unidade",
        });
        f.cargoVago = c[1]?.toLowerCase().includes("cargo vago");
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
        if (func.ferias) {
          nova[func.id] = {};
          for (let d = 1; d <= cfg.dias; d++) {
            const dt  = cfg.getDataDia(d);
            const iso = dt.toISOString().slice(0, 10);
            nova[func.id][d] = (iso >= func.ferias.inicio && iso <= func.ferias.fim) ? "V" : "T";
          }
          return;
        }
        grupo.forEach((c) => { c._escProvisoria = nova[c.id] || {}; });
        nova[func.id] = CargoFactory.criar(func.setor).gerarEscala(func, idx, grupo, cfg);
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

  const funcsDaLoja = (loja, setor) =>
    funcionarios
      .filter((f) => f.unidade === loja && f.setor === setor)
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

  // ── título do mês ───────────────────────────────────────────────
  const tituloMes = useMemo(() => {
    const dt = new Date(dataInicio + "T12:00:00");
    return `${MESES_PT[dt.getMonth()].toUpperCase()} DE ${dt.getFullYear()}`;
  }, [dataInicio]);

  // ── label férias de um func num dia ────────────────────────────
  const getFeriasLabel = (func) => {
    if (!func.ferias) return null;
    const fmtBR = (iso) => iso.split("-").reverse().join("/");
    return `FÉRIAS EM ${fmtBR(func.ferias.inicio)} ATÉ ${fmtBR(func.ferias.fim)}`;
  };

  // ── span de dias ocupados pelas férias no mês ──────────────────
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

  // ═══════════════════════════════════════════════════════════════
  // EXPORTAR XLSX — fiel à tabela real
  // ═══════════════════════════════════════════════════════════════
  const exportarXLSX = () => {
    if (!funcionarios.length) return;
    const wb  = XLSX.utils.book_new();
    const dtI = new Date(dataInicio + "T12:00:00");

    const borda = (cor = "AAAAAA") => ({
      top: { style: "thin", color: { rgb: cor } }, bottom: { style: "thin", color: { rgb: cor } },
      left: { style: "thin", color: { rgb: cor } }, right: { style: "thin", color: { rgb: cor } },
    });

    const cell = (v, s) => ({ v, t: "s", s });

    const estilo = {
      titulo: { font: { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
      setorH: { font: { name: "Arial", sz: 9, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
      diaH:   { font: { name: "Arial", sz: 8, bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "CCCCCC" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
      diaHFim:{ font: { name: "Arial", sz: 8, bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "888888" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
      diaHCrit:{ font: { name: "Arial", sz: 8, bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
      nome:   { font: { name: "Arial", sz: 8, bold: false }, fill: { patternType: "none" }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
      vago:   { font: { name: "Arial", sz: 8, bold: false, color: { rgb: "888888" } }, fill: { patternType: "solid", fgColor: { rgb: "DDDDDD" } }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
      folga:  { fill: { patternType: "solid", fgColor: { rgb: "000000" } }, border: borda("000000") },
      trab:   { fill: { patternType: "none" }, border: borda() },
      ferias: { font: { name: "Arial", sz: 7, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "166534" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
      intNum: { font: { name: "Arial", sz: 8, bold: true, color: { rgb: "000000" } }, fill: { patternType: "none" }, alignment: { horizontal: "center", vertical: "center" }, border: borda() },
    };

    lojas.forEach((loja) => {
      const ws = {}, merges = [];
      let row = 0;
      const totalCols = 1 + diasNum;
      const set = (r, c, v) => { ws[XLSX.utils.encode_cell({ r, c })] = v; };
      const criticos = [...config.getDiasCriticos(loja), ...config.getDiasPagamento(loja), ...config.getFeriados(loja)];

      // ── Título loja ──
      set(row, 0, cell(`${tituloMes} - ${loja}`, estilo.titulo));
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: totalCols } });
      row++;

      setoresDaLoja(loja).forEach((setor) => {
        // ── Cabeçalho setor ──
        set(row, 0, cell(setor, estilo.setorH));
        for (let d = 1; d <= diasNum; d++) {
          const dow  = config.getDow(d);
          const fim  = dow === 0 || dow === 6;
          const crit = criticos.includes(d);
          set(row, d, cell(`${DIAS7[dow]}\n${d}`, crit ? estilo.diaHCrit : fim ? estilo.diaHFim : estilo.diaH));
        }
        row++;

        funcsDaLoja(loja, setor).forEach((func) => {
          const estiloNome = func.cargoVago ? estilo.vago : estilo.nome;
          set(row, 0, cell(func.nome, estiloNome));

          // Verifica se tem férias e calcula span
          const fspan = getFeriasSpan(func);

          if (fspan && func.ferias) {
            // Dias antes das férias
            for (let d = 1; d < fspan.inicio; d++) {
              const v = escala[func.id]?.[d] || "T";
              set(row, d, cell("", v === "F" ? estilo.folga : estilo.trab));
            }
            // Célula de férias mesclada
            const fLabel = getFeriasLabel(func);
            set(row, fspan.inicio, cell(fLabel, estilo.ferias));
            if (fspan.span > 1)
              merges.push({ s: { r: row, c: fspan.inicio }, e: { r: row, c: fspan.fim } });
            // Dias após as férias
            for (let d = fspan.fim + 1; d <= diasNum; d++) {
              const v = escala[func.id]?.[d] || "T";
              set(row, d, cell("", v === "F" ? estilo.folga : estilo.trab));
            }
          } else {
            for (let d = 1; d <= diasNum; d++) {
              const v   = escala[func.id]?.[d] || "T";
              const dow = config.getDow(d);
              const key = `${func.id}_${d}`;
              const intv = intervalos[key];
              if (v === "F") {
                set(row, d, cell("", estilo.folga));
              } else if (dow === 0 && intv) {
                // Domingo trabalhando com número de intervalo
                set(row, d, cell(intv, estilo.intNum));
              } else {
                set(row, d, cell("", estilo.trab));
              }
            }
          }
          row++;
        });
      });

      ws["!cols"]  = [{ wch: 22 }, ...Array(diasNum).fill({ wch: 3.5 })];
      ws["!merges"]= merges;
      ws["!ref"]   = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: totalCols } });
      XLSX.utils.book_append_sheet(wb, ws, loja.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, ""));
    });

    XLSX.writeFile(wb, `escala_${tituloMes.toLowerCase().replace(/ /g, "_")}.xlsx`);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.page}>
      {/* ── Modal Férias ── */}
      {feriasModal && (
        <FeriasModal
          func={feriasModal}
          onSalvar={salvarFerias}
          onFechar={() => setFeriasModal(null)}
        />
      )}

      <div style={S.wrap}>
        {/* ── Header ── */}
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

        {/* ── Abas ── */}
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
            {(funcionarios.length ? lojas : ["União Centro","União Jardim","União Alvorada"]).map((unidade) => {
              const cfg = cfgUnidades[unidade] || cfgVazia();
              return (
                <div key={unidade} style={S.card}>
                  <div style={S.cardTit}>{unidade}</div>
                  <div style={S.grid3}>
                    <div>
                      <label style={S.lbl}>🔴 Oferta / Promoção</label>
                      <input style={S.inpFull} placeholder="ex: 25, 26, 27" defaultValue={cfg.diasCriticos.join(", ")}
                        onBlur={(e) => setCfgCampo(unidade, "diasCriticos", parseDias(e.target.value))} />
                    </div>
                    <div>
                      <label style={S.lbl}>💰 Pagamento Salarial</label>
                      <input style={S.inpFull} placeholder="ex: 5, 20" defaultValue={cfg.diasPagamento.join(", ")}
                        onBlur={(e) => setCfgCampo(unidade, "diasPagamento", parseDias(e.target.value))} />
                    </div>
                    <div>
                      <label style={S.lbl}>🗓 Feriados</label>
                      <input style={S.inpFull} placeholder="ex: 1, 15" defaultValue={cfg.feriados.join(", ")}
                        onBlur={(e) => setCfgCampo(unidade, "feriados", parseDias(e.target.value))} />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={S.lbl}>👥 Mínimo por setor/dia (0 = sem restrição)</label>
                    <div style={{ ...S.grid3, marginTop: 6 }}>
                      {SETORES_ORDEM.slice(0, 16).map((setor) => (
                        <div key={setor} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#444", minWidth: 110, whiteSpace: "nowrap" }}>{setor}</span>
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

            {/* Férias por funcionário */}
            {funcionarios.length > 0 && (
              <div style={S.card}>
                <div style={S.cardTit}>🌴 Férias por Funcionário</div>
                <p style={S.hint}>Defina o período exato de férias. Pode ser parcial ou iniciar no mês anterior.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {funcionarios.filter((f) => !f.cargoVago).map((f) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: f.ferias ? "#f0fdf4" : "#fafafa", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 12, flex: 1 }}>{f.nome} <span style={{ color: "#888", fontSize: 11 }}>({f.setor} · {f.unidade})</span></span>
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
                      }}>
                      🔄 Sugerir troca
                    </button>
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
                <strong>{trocaAlvo.func.nome}</strong> <span style={{ color: "#888" }}>({trocaAlvo.func.setor} · {trocaAlvo.func.unidade})</span> — Dia <strong>{trocaAlvo.dia}</strong>
              </p>
              {trocaSugestoes.length === 0
                ? <div style={S.empty}>Nenhum colega disponível para troca neste dia no mesmo setor e unidade.</div>
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
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {[["#000","Folga"],["#fff","Trabalho"],["#166534","Férias"]].map(([bg, lb]) => (
                  <div key={lb} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: "1px solid #aaa" }} />{lb}
                  </div>
                ))}
                <span style={{ fontSize: 10, color: "#aaa" }}>Clique: alterna · Clique dir. em folga: trocar · Dom trabalhando: clique para intervalo</span>
              </div>
            </div>

            {/* Banner erros */}
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
                <div style={{ fontSize: 11, marginTop: 6, color: "#bbb" }}>Formato: id, nome, setor, carga_horaria, unidade</div>
              </div>
            ) : (
              lojasFiltradas.map((loja) => {
                const setores = setoresDaLoja(loja).filter((s) => !filtroSetor || s === filtroSetor);
                if (!setores.length) return null;
                return (
                  <div key={loja} style={{ marginBottom: 28 }}>
                    {/* Título loja — estilo real: preto total */}
                    <div style={S.lojaH}>{tituloMes} — {loja}</div>

                    {setores.map((setor) => {
                      const lista = funcsDaLoja(loja, setor);
                      return (
                        <div key={setor}>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ borderCollapse: "collapse", fontSize: 10.5, tableLayout: "fixed", minWidth: "100%" }}>
                              <thead>
                                <tr>
                                  {/* Setor header */}
                                  <th style={{ ...S.thSetor, width: 150 }}>{setor}</th>
                                  {diasLista.map((d) => {
                                    const dow  = config.getDow(d);
                                    const fim  = dow === 0 || dow === 6;
                                    const crit = config.isDiaCritico(loja, d);
                                    return (
                                      <th key={d} style={{ ...S.thDia, background: crit ? "#FEF3C7" : fim ? "#888" : "#ccc", color: fim ? "#fff" : "#000", width: 24 }}>
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
                                        {diasLista.map((d) => <td key={d} style={{ ...S.tdDia, background: "#ddd" }} />)}
                                      </tr>
                                    );
                                  }

                                  const fspan = getFeriasSpan(func);
                                  const fLabel = getFeriasLabel(func);

                                  return (
                                    <tr key={func.id}>
                                      <td style={S.tdNome}>
                                        {func.nome}
                                        {func.ferias && (
                                          <span
                                            onClick={() => setFeriasModal(func)}
                                            title="Editar férias"
                                            style={{ cursor: "pointer", marginLeft: 4, fontSize: 9, color: "#166534" }}>🌴</span>
                                        )}
                                      </td>
                                      {fspan && fLabel
                                        ? diasLista.map((d) => {
                                          if (d === fspan.inicio) {
                                            return (
                                              <td key={d}
                                                colSpan={fspan.span}
                                                style={{ ...S.tdDia, background: "#166534", color: "#fff", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}
                                                title={fLabel}>
                                                {fLabel}
                                              </td>
                                            );
                                          }
                                          if (d > fspan.inicio && d <= fspan.fim) return null;
                                          const v   = escala[func.id]?.[d] || "T";
                                          const dow = config.getDow(d);
                                          const key = `${func.id}_${d}`;
                                          const intv = intervalos[key];
                                          return (
                                            <td key={d}
                                              style={{ ...S.tdDia, background: v === "F" ? "#000" : "#fff", cursor: "pointer" }}
                                              onClick={() => v !== "V" && alternar(func.id, d)}
                                              onContextMenu={(e) => { e.preventDefault(); if (v === "F") abrirTroca(func, d); }}>
                                              {dow === 0 && v === "T" && (
                                                <span onClick={(e) => { e.stopPropagation(); alternarIntervalo(func.id, d); }}
                                                  style={{ fontSize: 9, fontWeight: 700, color: "#000", cursor: "pointer", display: "block", textAlign: "center" }}>
                                                  {intv || ""}
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })
                                        : diasLista.map((d) => {
                                          const v   = escala[func.id]?.[d] || "T";
                                          const dow = config.getDow(d);
                                          const key = `${func.id}_${d}`;
                                          const intv = intervalos[key];
                                          return (
                                            <td key={d}
                                              style={{ ...S.tdDia, background: v === "F" ? "#000" : "#fff", cursor: "pointer" }}
                                              onClick={() => alternar(func.id, d)}
                                              onContextMenu={(e) => { e.preventDefault(); if (v === "F") abrirTroca(func, d); }}
                                              title={v === "F" ? "Folga — clique direito p/ trocar" : dow === 0 ? "Clique para definir intervalo" : "Trabalho"}>
                                              {dow === 0 && v === "T" && (
                                                <span onClick={(e) => { e.stopPropagation(); alternarIntervalo(func.id, d); }}
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
        <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>Defina o período completo (pode incluir dias fora do mês atual).</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Data de início</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
              style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Data de término</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
              style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onFechar} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer" }}>Cancelar</button>
          <button
            disabled={!inicio || !fim || inicio > fim}
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
  wrap:      { maxWidth: 1500, margin: "0 auto", background: "#fff", borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,.1)", padding: "1rem" },
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
  // Tabela real
  lojaH:     { background: "#000", color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 12px", textAlign: "center", letterSpacing: ".06em" },
  thSetor:   { background: "#000", color: "#fff", fontWeight: 700, fontSize: 10, padding: "5px 6px", textAlign: "center", border: "1px solid #555", position: "sticky", left: 0, zIndex: 1 },
  thDia:     { padding: "2px 1px", border: "1px solid #aaa", textAlign: "center", fontWeight: 600 },
  tdNome:    { padding: "2px 6px", border: "1px solid #ddd", fontWeight: 400, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150, background: "#fff", position: "sticky", left: 0, zIndex: 0 },
  tdDia:     { padding: 0, border: "1px solid #ddd", height: 20, textAlign: "center" },
};