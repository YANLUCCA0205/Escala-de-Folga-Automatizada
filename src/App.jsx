// ═══════════════════════════════════════════════════════════════════
//  ESCALA DE FOLGAS — v5.0
//  npm install xlsx @supabase/supabase-js
// ═══════════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// ───────────────────────────────────────────────────────────────────
// SUPABASE
// ───────────────────────────────────────────────────────────────────
const SUPA_URL = "https://jvvjhcfqvitnxdutfije.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dmpoY2Zxdml0bnhkdXRmaWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mjk5ODksImV4cCI6MjA5NTQwNTk4OX0.aJJX3kP1jgVaK1mtiwZ5bZzNxSSxtm4cDb1ducx3Jvk";
const sb = createClient(SUPA_URL, SUPA_KEY);

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

const parseRegimeFolga = (str = "") => {
  const s = str.toUpperCase().trim();
  if (!s) return { tipo: "6x1_dom", diasFlex: ["DOM"] };
  const match = s.match(/\(([^)]+)\)/);
  const diasRaw = match ? match[1].split("/").map((d) => d.trim()).filter(Boolean) : [];
  if (s.startsWith("5X1")) return { tipo: "5x1", diasFlex: [] };
  if (diasRaw.length === 1 && diasRaw[0] === "DOM") return { tipo: "6x1_dom", diasFlex: ["DOM"] };
  if (diasRaw.length >= 2) return { tipo: "6x1_flex", diasFlex: diasRaw };
  return { tipo: "6x1_dom", diasFlex: ["DOM"] };
};

const DIAS_DOW = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 };
const DIAS7    = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SETORES_ORDEM = [
  "CAIXA","CAIXA/PACOTE","CAIXA/LANCHONETE","REPOSIÇÃO","AÇOUGUE","PADARIA",
  "HORTIFRUTI","LIMPEZA","DEPÓSITO","FRIOS","ESTOQUE","ENTREGA",
  "ADMINISTRATIVO OPERACIONAL","ADMINISTRATIVO","ADM","COMERCIAL","MARKETING",
  "FINANCEIRO","RH/ DP","RH / DP","CONTÁBIL FISCAL","TI","PREVENÇÃO DE PERDAS","PREVENÇÃO P.",
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
    this.regimeFolga = regimeFolga;
    this.ferias      = null;
    this.cargoVago   = false;
    this._escProvisoria = {};
  }
}

// ───────────────────────────────────────────────────────────────────
// GERADORES DE ESCALA
// ───────────────────────────────────────────────────────────────────
function gerarEscala6x1Dom(func, cfg) {
  const e = {};
  for (let d = 1; d <= cfg.dias; d++) e[d] = cfg.getDow(d) === 0 ? "F" : "T";
  return e;
}

function gerarEscala5x1(func, idx, cfg) {
  const e = {};
  const offset = (idx * 1) % 6;
  for (let d = 1; d <= cfg.dias; d++) {
    const pos = (d - 1 + offset) % 6;
    e[d] = pos === 5 ? "F" : "T";
  }
  return e;
}

function gerarEscala6x1Flex(func, idx, grupo, cfg) {
  const e = {};
  const dowsPermitidos = func.regimeFolga.diasFlex
    .map((d) => DIAS_DOW[d])
    .filter((n) => n !== undefined);
  if (dowsPermitidos.length === 0) return gerarEscala6x1Dom(func, cfg);
  let semana = 0;
  for (let d = 1; d <= cfg.dias; d++) {
    const dow = cfg.getDow(d);
    if (dowsPermitidos.includes(dow)) {
      const dowEscolhido = dowsPermitidos[(semana + idx) % dowsPermitidos.length];
      e[d] = dow === dowEscolhido ? "F" : "T";
      if (dow === dowsPermitidos[dowsPermitidos.length - 1]) semana++;
    } else {
      e[d] = "T";
    }
  }
  return e;
}

function gerarEscalaFuncionario(func, idx, grupo, cfg) {
  const { tipo } = func.regimeFolga;
  if (tipo === "6x1_dom")  return gerarEscala6x1Dom(func, cfg);
  if (tipo === "5x1")      return gerarEscala5x1(func, idx, cfg);
  if (tipo === "6x1_flex") return gerarEscala6x1Flex(func, idx, grupo, cfg);
  return gerarEscala6x1Dom(func, cfg);
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
        f.id !== funcAlvo.id && f.setor === funcAlvo.setor && f.unidade === funcAlvo.unidade &&
        !f.ferias && !f.cargoVago && (escala[f.id]?.[diaAlvo] || "T") === "T"
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
// TELA DE LOGIN
// ───────────────────────────────────────────────────────────────────
function TelaLogin({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [senha,    setSenha]    = useState("");
  const [erro,     setErro]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [modo,     setModo]     = useState("login"); // "login" | "cadastro"

  const submeter = async () => {
    setErro(""); setLoading(true);
    try {
      let res;
      if (modo === "login") {
        res = await sb.auth.signInWithPassword({ email, password: senha });
      } else {
        res = await sb.auth.signUp({ email, password: senha });
        if (!res.error) {
          setErro("Conta criada! Verifique seu e-mail para confirmar e depois faça login.");
          setModo("login"); setLoading(false); return;
        }
      }
      if (res.error) { setErro(res.error.message); }
      else { onLogin(res.data.session); }
    } catch (e) {
      setErro(String(e));
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "2.5rem 2rem", width: 360, boxShadow: "0 4px 24px rgba(0,0,0,.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⬛</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>Escala de Folgas</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Sistema de Gestão · União Supermercados</div>
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 7, overflow: "hidden" }}>
          {[["login","Entrar"],["cadastro","Criar conta"]].map(([m, label]) => (
            <button key={m} onClick={() => { setModo(m); setErro(""); }}
              style={{ flex: 1, padding: "8px 0", fontSize: 12, border: "none", cursor: "pointer",
                background: modo === m ? "#111" : "#f9fafb", color: modo === m ? "#fff" : "#555", fontWeight: modo === m ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submeter()}
              placeholder="seu@email.com"
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submeter()}
              placeholder="••••••••"
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", boxSizing: "border-box" }} />
          </div>
          {erro && (
            <div style={{ fontSize: 11, color: erro.includes("criada") ? "#166534" : "#CC0000",
              background: erro.includes("criada") ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${erro.includes("criada") ? "#bbf7d0" : "#fecaca"}`,
              borderRadius: 5, padding: "8px 10px" }}>
              {erro}
            </div>
          )}
          <button onClick={submeter} disabled={loading || !email || !senha}
            style={{ padding: "10px 0", borderRadius: 6, border: "none", background: "#111", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: (!email || !senha) ? 0.5 : 1, marginTop: 4 }}>
            {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ───────────────────────────────────────────────────────────────────
export default function EscalaFolga() {
  const [sessao,         setSessao]         = useState(null);
  const [authCarregando, setAuthCarregando] = useState(true);

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
  const [salvando,       setSalvando]       = useState(false);
  const [salvouOk,       setSalvouOk]       = useState(false);
  const [carregandoDB,   setCarregandoDB]   = useState(false);
  const salvarTimer = useRef(null);

  // ── chave do mês ────────────────────────────────────────────────
  const mesKey = useMemo(() => dataInicio.slice(0, 7), [dataInicio]); // "2026-05"

  // ── auth ────────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setAuthCarregando(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── carregar dados ao logar ou mudar mês ──────────────────────
  useEffect(() => {
    if (!sessao) return;
    carregarDados();
  }, [sessao, mesKey]);

  const carregarDados = async () => {
    setCarregandoDB(true);
    try {
      // Configs
      const { data: cfgRows } = await sb
        .from("configuracoes")
        .select("unidade, dados")
        .eq("mes", mesKey);

      if (cfgRows?.length) {
        const novas = {};
        cfgRows.forEach((r) => { novas[r.unidade] = r.dados; });
        setCfgUnidades(novas);
      }

      // Escala salva (folgas manuais + férias)
      const { data: escRows } = await sb
        .from("escalas")
        .select("unidade, escala, intervalos, ferias")
        .eq("mes", mesKey);

      if (escRows?.length) {
        // Mescla escalas de todas as unidades
        let escMerge = {}, intMerge = {};
        const feriasPorFunc = {};
        escRows.forEach((r) => {
          Object.assign(escMerge, r.escala || {});
          Object.assign(intMerge, r.intervalos || {});
          Object.assign(feriasPorFunc, r.ferias || {});
        });
        setEscala(escMerge);
        setIntervalos(intMerge);
        // Aplica férias nos funcionários se já carregados
        if (Object.keys(feriasPorFunc).length) {
          setFuncionarios((prev) => prev.map((f) => ({
            ...f,
            ferias: feriasPorFunc[f.id] || f.ferias,
          })));
        }
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
    setCarregandoDB(false);
  };

  // ── salvar no Supabase (debounced 1.5s) ─────────────────────────
  const salvarSupabase = useCallback((novaEscala, novosIntervalos, novasCfgs, novosFuncs) => {
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(async () => {
      setSalvando(true);
      try {
        const lojas = [...new Set((novosFuncs || funcionarios).map((f) => f.unidade))];

        // Salvar configs por loja
        for (const loja of lojas) {
          if (!(novasCfgs || cfgUnidades)[loja]) continue;
          await sb.from("configuracoes").upsert({
            unidade: loja, mes: mesKey,
            dados: (novasCfgs || cfgUnidades)[loja],
            updated_at: new Date().toISOString(),
          }, { onConflict: "unidade,mes" });
        }

        // Salvar escala por loja
        for (const loja of lojas) {
          const funcsLoja = (novosFuncs || funcionarios).filter((f) => f.unidade === loja);
          const escLoja   = {};
          const ferLoja   = {};
          funcsLoja.forEach((f) => {
            escLoja[f.id] = (novaEscala || escala)[f.id] || {};
            if (f.ferias) ferLoja[f.id] = f.ferias;
          });
          await sb.from("escalas").upsert({
            unidade: loja, mes: mesKey,
            escala: escLoja,
            intervalos: novosIntervalos || intervalos,
            ferias: ferLoja,
            updated_at: new Date().toISOString(),
          }, { onConflict: "unidade,mes" });
        }

        setSalvouOk(true);
        setTimeout(() => setSalvouOk(false), 2500);
      } catch (e) {
        console.error("Erro ao salvar:", e);
      }
      setSalvando(false);
    }, 1500);
  }, [funcionarios, escala, intervalos, cfgUnidades, mesKey]);

  // ── config ───────────────────────────────────────────────────────
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
      let texto;
      try {
        const dec = new TextDecoder("utf-8", { fatal: true });
        texto = dec.decode(buffer);
        if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
      } catch { texto = new TextDecoder("windows-1252").decode(buffer); }

      const sep    = texto.includes(";") ? ";" : ",";
      const linhas = texto.split("\n").filter((l) => l.trim());
      const dados  = linhas.slice(1).map((linha) => {
        const c = linha.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
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
          id: num || String(Math.random()), nome, setor, funcao, turno,
          unidade: loja, regimeFolga: regime,
        });
        f.cargoVago = nome.toUpperCase().includes("CARGO VAGO");
        return f;
      }).filter(Boolean);

      const novasCfgs = garantirCfg(cfgUnidades, dados.map((f) => f.unidade));
      setCfgUnidades(novasCfgs);
      setFuncionarios(dados);
      const novaEscala = calcularEscala(dados, new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades: novasCfgs }));
      setEscala(novaEscala);
      salvarSupabase(novaEscala, intervalos, novasCfgs, dados);
    };
    leitor.readAsArrayBuffer(arquivo);
  };

  // ── calcular escala (puro, retorna objeto) ────────────────────
  const calcularEscala = (lista, cfg) => {
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
        nova[func.id] = gerarEscalaFuncionario(func, idx, grupo, cfg);
      });
    });
    return nova;
  };

  // ── gerar escala (setState) ──────────────────────────────────────
  const gerarEscala = useCallback((lista, cfg) => {
    const nova = calcularEscala(lista, cfg);
    setEscala(nova);
    salvarSupabase(nova, intervalos, cfgUnidades, lista);
  }, [intervalos, cfgUnidades, salvarSupabase]);

  // ── alternar célula ─────────────────────────────────────────────
  const alternar = (id, dia) => {
    const seq = { T: "F", F: "T", V: "V" };
    setEscala((prev) => {
      const nova = { ...prev, [id]: { ...prev[id], [dia]: seq[prev[id]?.[dia] || "T"] } };
      salvarSupabase(nova, intervalos, cfgUnidades, funcionarios);
      return nova;
    });
  };

  // ── intervalo domingo ────────────────────────────────────────────
  const alternarIntervalo = (id, dia) => {
    const key = `${id}_${dia}`;
    setIntervalos((prev) => {
      let novo;
      const cur = prev[key];
      if (!cur) novo = { ...prev, [key]: "1" };
      else if (cur === "4") { novo = { ...prev }; delete novo[key]; }
      else novo = { ...prev, [key]: String(Number(cur) + 1) };
      salvarSupabase(escala, novo, cfgUnidades, funcionarios);
      return novo;
    });
  };

  // ── férias ───────────────────────────────────────────────────────
  const salvarFerias = (funcId, inicio, fim) => {
    setFuncionarios((prev) => {
      const nova = prev.map((f) => {
        if (f.id !== funcId) return f;
        const upd = Object.assign(Object.create(Object.getPrototypeOf(f)), f);
        upd.ferias = inicio && fim ? { inicio, fim } : null;
        return upd;
      });
      const novaEscala = calcularEscala(nova, config);
      setEscala(novaEscala);
      salvarSupabase(novaEscala, intervalos, cfgUnidades, nova);
      return nova;
    });
    setFeriasModal(null);
  };

  // ── salvar configs ───────────────────────────────────────────────
  const setCfgCampo = (unidade, campo, valor) => {
    setCfgUnidades((prev) => {
      const novas = { ...prev, [unidade]: { ...(prev[unidade] || cfgVazia()), [campo]: valor } };
      salvarSupabase(escala, intervalos, novas, funcionarios);
      return novas;
    });
  };

  // ── alertas ──────────────────────────────────────────────────────
  const alertas = useMemo(() => {
    if (!funcionarios.length) return [];
    return AlertaEngine.verificar(funcionarios.filter((f) => !f.ferias && !f.cargoVago), escala, config);
  }, [funcionarios, escala, config]);

  // ── troca ────────────────────────────────────────────────────────
  const abrirTroca = (func, dia) => {
    setTrocaSugestoes(TrocaEngine.sugerir({ funcAlvo: func, diaAlvo: dia, funcionarios, escala, config }));
    setTrocaAlvo({ func, dia });
    setAba("troca");
  };
  const executarTroca = (candidato) => {
    const novaEscala = TrocaEngine.executar({ funcAlvo: trocaAlvo.func, diaAlvo: trocaAlvo.dia, funcCandidato: candidato.funcionario, escalaAtual: escala });
    setEscala(novaEscala);
    salvarSupabase(novaEscala, intervalos, cfgUnidades, funcionarios);
    setAba("escala"); setTrocaAlvo(null);
  };

  // ── helpers ──────────────────────────────────────────────────────
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

  const badgeRegime = (func) => {
    if (!func.regimeFolga) return null;
    const { tipo, diasFlex } = func.regimeFolga;
    const txt = tipo === "5x1" ? "5×1" : tipo === "6x1_dom" ? "6×1 Dom" : `6×1 (${diasFlex.join("/")})`;
    const bg  = tipo === "5x1" ? "#1d4ed8" : tipo === "6x1_dom" ? "#166534" : "#7c3aed";
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
    try {
      const wb = XLSX.utils.book_new();

      const borda = (cor = "999999") => ({
        top:    { style: "thin", color: { rgb: cor } },
        bottom: { style: "thin", color: { rgb: cor } },
        left:   { style: "thin", color: { rgb: cor } },
        right:  { style: "thin", color: { rgb: cor } },
      });

      const C = (v, s) => ({ v: v ?? "", t: "s", s });

      const EST = {
        titulo:   { font: { name: "Arial", sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
        setorH:   { font: { name: "Arial", sz: 9,  bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "111111" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("000000") },
        diaH:     { font: { name: "Arial", sz: 8,  bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "CCCCCC" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
        diaHFim:  { font: { name: "Arial", sz: 8,  bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "666666" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda("666666") },
        diaHCrit: { font: { name: "Arial", sz: 8,  bold: true, color: { rgb: "000000" } }, fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borda() },
        nome:     { font: { name: "Arial", sz: 8  }, fill: { patternType: "none" }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
        vago:     { font: { name: "Arial", sz: 8, color: { rgb: "888888" } }, fill: { patternType: "solid", fgColor: { rgb: "DDDDDD" } }, alignment: { horizontal: "left", vertical: "center" }, border: borda() },
        turnoM:   { font: { name: "Arial", sz: 7,  bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "1e40af" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("1e40af") },
        turnoT:   { font: { name: "Arial", sz: 7,  bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "92400e" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("92400e") },
        folga:    { fill: { patternType: "solid", fgColor: { rgb: "000000" } }, border: borda("000000") },
        trab:     { fill: { patternType: "none" }, border: borda() },
        ferias:   { font: { name: "Arial", sz: 7,  bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "166534" } }, alignment: { horizontal: "center", vertical: "center" }, border: borda("166534") },
        intNum:   { font: { name: "Arial", sz: 8,  bold: true, color: { rgb: "000000" } }, fill: { patternType: "none" }, alignment: { horizontal: "center", vertical: "center" }, border: borda() },
      };

      lojas.forEach((loja) => {
        const ws = {}, merges = [];
        let row = 0;
        const totalCols = 2 + diasNum;
        const set = (r, c, v) => { ws[XLSX.utils.encode_cell({ r, c })] = v; };
        const criticos = [
          ...config.getDiasCriticos(loja),
          ...config.getDiasPagamento(loja),
          ...config.getFeriados(loja),
        ];

        // Título
        set(row, 0, C(`${tituloMes} - ${loja}`, EST.titulo));
        merges.push({ s: { r: row, c: 0 }, e: { r: row, c: totalCols } });
        row++;

        setoresDaLoja(loja).forEach((setor) => {
          // Cabeçalho setor
          set(row, 0, C(setor, EST.setorH));
          set(row, 1, C("T", EST.setorH));
          for (let d = 1; d <= diasNum; d++) {
            const dow  = config.getDow(d);
            const fim  = dow === 0 || dow === 6;
            const crit = criticos.includes(d);
            set(row, d + 1, C(`${DIAS7[dow]}\n${d}`, crit ? EST.diaHCrit : fim ? EST.diaHFim : EST.diaH));
          }
          row++;

          funcsDaLoja(loja, setor, "").forEach((func) => {
            const eTurnoM = func.turno === "MANHÃ";
            set(row, 0, C(func.cargoVago ? "CARGO VAGO" : func.nome, func.cargoVago ? EST.vago : EST.nome));
            set(row, 1, C(eTurnoM ? "M" : func.turno === "TARDE" ? "T" : (func.turno || "").charAt(0), eTurnoM ? EST.turnoM : EST.turnoT));

            const fspan = getFeriasSpan(func);
            if (fspan && func.ferias) {
              for (let d = 1; d < fspan.inicio; d++) {
                const v = escala[func.id]?.[d] || "T";
                set(row, d + 1, C("", v === "F" ? EST.folga : EST.trab));
              }
              set(row, fspan.inicio + 1, C(getFeriasLabel(func), EST.ferias));
              if (fspan.span > 1)
                merges.push({ s: { r: row, c: fspan.inicio + 1 }, e: { r: row, c: fspan.fim + 1 } });
              for (let d = fspan.fim + 1; d <= diasNum; d++) {
                const v = escala[func.id]?.[d] || "T";
                set(row, d + 1, C("", v === "F" ? EST.folga : EST.trab));
              }
            } else {
              for (let d = 1; d <= diasNum; d++) {
                const v    = escala[func.id]?.[d] || "T";
                const dow  = config.getDow(d);
                const intv = intervalos[`${func.id}_${d}`];
                if (v === "F") {
                  set(row, d + 1, C("", EST.folga));
                } else if (dow === 0 && intv) {
                  set(row, d + 1, C(intv, EST.intNum));
                } else {
                  set(row, d + 1, C("", EST.trab));
                }
              }
            }
            row++;
          });
        });

        ws["!cols"]   = [{ wch: 24 }, { wch: 3 }, ...Array(diasNum).fill({ wch: 3.5 })];
        ws["!merges"] = merges;
        ws["!ref"]    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: totalCols } });
        const nomePlanilha = loja.replace(/[:\\\/\?\*\[\]]/g, "").substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, nomePlanilha);
      });

      XLSX.writeFile(wb, `escala_${tituloMes.toLowerCase().replace(/ /g, "_")}.xlsx`);
    } catch (err) {
      alert("Erro ao exportar: " + err.message);
      console.error(err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER — GUARDS
  // ═══════════════════════════════════════════════════════════════
  if (authCarregando) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", color: "#888" }}>
        Carregando...
      </div>
    );
  }

  if (!sessao) return <TelaLogin onLogin={setSessao} />;

  // ═══════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
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
            <div style={S.hSub}>
              {tituloMes} ·{" "}
              <span style={{ color: "#888" }}>{sessao.user.email}</span>
              {salvando  && <span style={{ color: "#b45309", marginLeft: 8 }}>💾 Salvando...</span>}
              {salvouOk  && <span style={{ color: "#166534", marginLeft: 8 }}>✅ Salvo</span>}
              {carregandoDB && <span style={{ color: "#1d4ed8", marginLeft: 8 }}>⏳ Carregando dados...</span>}
            </div>
          </div>
          <div style={S.hControls}>
            <label style={S.lbl}>CSV:</label>
            <input type="file" accept=".csv" onChange={importarCSV} style={S.fileIn} />
            <label style={S.lbl}>Início:</label>
            <input type="date" value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={S.inp} />
            <label style={S.lbl}>Dias:</label>
            <input type="number" min={1} max={31} value={diasNum}
              onChange={(e) => {
                const v = +e.target.value; setDiasNum(v);
                if (funcionarios.length) {
                  const nova = calcularEscala(funcionarios, new ConfiguracaoMes({ dataInicio, dias: v, unidades: garantirCfg(cfgUnidades, funcionarios.map((f) => f.unidade)) }));
                  setEscala(nova);
                  salvarSupabase(nova, intervalos, cfgUnidades, funcionarios);
                }
              }} style={{ ...S.inp, width: 58 }} />
            <button onClick={() => gerarEscala(funcionarios, config)} style={S.btn}>🔄 Regerar</button>
            <button onClick={exportarXLSX} style={{ ...S.btn, ...S.btnR }}>📥 Exportar XLSX</button>
            <button onClick={() => sb.auth.signOut()} style={{ ...S.btn, color: "#CC0000", borderColor: "#CC0000" }}>Sair</button>
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
            <p style={S.hint}>
              Configurações são salvas automaticamente. Dias separados por vírgula (ex: 5, 20).
            </p>
            {(funcionarios.length ? lojas : ["LOJA 1","LOJA 2","LOJA 3"]).map((unidade) => {
              const cfg = cfgUnidades[unidade] || cfgVazia();
              return (
                <div key={unidade} style={S.card}>
                  <div style={S.cardTit}>{unidade}</div>
                  <div style={S.grid3}>
                    {[
                      ["🔴 Oferta / Promoção",  "diasCriticos"],
                      ["💰 Pagamento Salarial",  "diasPagamento"],
                      ["🗓 Feriados",            "feriados"],
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
                            onBlur={(e) => setCfgCampo(unidade, "minimosPorSetor", {
                              ...(cfgUnidades[unidade]?.minimosPorSetor || {}),
                              [setor]: parseInt(e.target.value) || 0,
                            })} />
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
                <p style={S.hint}>Férias são salvas automaticamente.</p>
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
                ? <div style={S.empty}>Nenhum colega disponível para troca.</div>
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
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: "1px solid #999" }} />{lb}
                  </div>
                ))}
                <span style={{ fontSize: 10, color: "#aaa" }}>Clique: alterna · Clique dir. em folga: trocar</span>
              </div>
            </div>

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
                <div style={{ fontSize: 11, marginTop: 6, color: "#bbb" }}>Colunas: Nº, LOJA, SETOR, FUNÇÃO, TURNO, NOME, FOLGAS</div>
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
                      return (
                        <div key={setor}>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ borderCollapse: "collapse", fontSize: 10.5, tableLayout: "fixed", minWidth: "100%" }}>
                              <thead>
                                <tr>
                                  <th style={{ ...S.thSetor, width: 160 }}>{setor}</th>
                                  <th style={{ ...S.thSetor, width: 22, fontSize: 8 }}>T</th>
                                  {diasLista.map((d) => {
                                    const dow  = config.getDow(d);
                                    const fim  = dow === 0 || dow === 6;
                                    const crit = config.isDiaCritico(loja, d);
                                    return (
                                      <th key={d} style={{ ...S.thDia, background: crit ? "#FEF3C7" : fim ? "#666" : "#bbb", color: fim && !crit ? "#fff" : "#000", width: 24 }}>
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
                                        <td style={{ ...S.tdDia, background: "#ddd" }} />
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
                                      <td style={{ ...S.tdDia, background: turnoColor, color: "#fff", fontSize: 8, fontWeight: 700, textAlign: "center" }}>
                                        {func.turno === "MANHÃ" ? "M" : func.turno === "TARDE" ? "T" : (func.turno || "").charAt(0)}
                                      </td>

                                      {(fspan && fLabel ? diasLista : diasLista).map((d) => {
                                        if (fspan && fLabel) {
                                          if (d === fspan.inicio) {
                                            return (
                                              <td key={d} colSpan={fspan.span}
                                                style={{ ...S.tdDia, background: "#166534", color: "#fff", fontSize: 8, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}
                                                title={fLabel}>{fLabel}</td>
                                            );
                                          }
                                          if (d > fspan.inicio && d <= fspan.fim) return null;
                                        }
                                        const v    = escala[func.id]?.[d] || "T";
                                        const dow  = config.getDow(d);
                                        const intv = intervalos[`${func.id}_${d}`];
                                        return (
                                          <td key={d}
                                            style={{ ...S.tdDia, background: v === "F" ? "#000" : "#fff", cursor: "pointer" }}
                                            onClick={() => v !== "V" && alternar(func.id, d)}
                                            onContextMenu={(e) => { e.preventDefault(); if (v === "F") abrirTroca(func, d); }}
                                            title={v === "F" ? "Folga — clique dir. p/ trocar" : dow === 0 ? "Dom — clique p/ intervalo" : "Trabalho"}>
                                            {dow === 0 && v === "T" && (
                                              <span onClick={(ev) => { ev.stopPropagation(); alternarIntervalo(func.id, d); }}
                                                style={{ fontSize: 9, fontWeight: 700, color: "#555", cursor: "pointer", display: "block", textAlign: "center" }}>
                                                {intv || ""}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })}
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
  header:    { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "2px solid #111" },
  hTitle:    { fontSize: 17, fontWeight: 700, color: "#111" },
  hSub:      { fontSize: 11, color: "#888", marginTop: 2 },
  hControls: { display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" },
  lbl:       { fontSize: 11, color: "#555" },
  fileIn:    { fontSize: 11, border: "1px solid #999", borderRadius: 5, padding: "4px 7px", background: "#f9fafb", cursor: "pointer" },
  inp:       { fontSize: 11, padding: "4px 7px", borderRadius: 5, border: "1px solid #999", background: "#f9fafb", color: "#111" },
  inpFull:   { fontSize: 11, padding: "4px 7px", borderRadius: 5, border: "1px solid #999", background: "#f9fafb", color: "#111", width: "100%", marginTop: 3 },
  btn:       { fontSize: 11, padding: "5px 11px", borderRadius: 5, border: "1px solid #999", background: "#f9fafb", color: "#111", cursor: "pointer" },
  btnR:      { background: "#CC0000", color: "#fff", borderColor: "#CC0000" },
  tabs:      { display: "flex", gap: 2, borderBottom: "2px solid #333", marginBottom: "1rem" },
  tab:       { fontSize: 12, padding: "7px 14px", border: "none", borderBottom: "2px solid transparent", background: "transparent", color: "#666", cursor: "pointer", marginBottom: -2 },
  tabOn:     { color: "#111", borderBottomColor: "#111", fontWeight: 700 },
  hint:      { fontSize: 11, color: "#888", marginBottom: 8, lineHeight: 1.5 },
  empty:     { textAlign: "center", padding: "2.5rem 1rem", color: "#aaa", border: "2px dashed #ccc", borderRadius: 8 },
  card:      { border: "1px solid #ccc", borderRadius: 7, padding: ".9rem", marginBottom: "1rem" },
  cardTit:   { fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 10 },
  grid3:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 },
  alertCard: { borderLeft: "4px solid #CC0000", background: "#fafafa", borderRadius: 5, padding: "9px 12px", marginBottom: 7 },
  lojaH:     { background: "#000", color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 12px", textAlign: "center", letterSpacing: ".06em" },
  thSetor:   { background: "#000", color: "#fff", fontWeight: 700, fontSize: 10, padding: "5px 6px", textAlign: "center", border: "1px solid #333", position: "sticky", left: 0, zIndex: 1 },
  thDia:     { padding: "2px 1px", border: "1px solid #999", textAlign: "center", fontWeight: 600 },
  tdNome:    { padding: "2px 6px", border: "1px solid #999", fontWeight: 400, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160, background: "#fff", position: "sticky", left: 0, zIndex: 0 },
  tdDia:     { padding: 0, border: "1px solid #999", height: 20, textAlign: "center" },
};