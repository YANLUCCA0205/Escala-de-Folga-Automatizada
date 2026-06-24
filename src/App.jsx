
// ═══════════════════════════════════════════════════════════════════
//  ESCALA DE FOLGAS — v6.0
//  npm install xlsx @supabase/supabase-js
// ═══════════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ───────────────────────────────────────────────────────────────────
// SUPABASE
// ───────────────────────────────────────────────────────────────────
const SUPA_URL = "https://jvvjhcfqvitnxdutfije.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dmpoY2Zxdml0bnhkdXRmaWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4Mjk5ODksImV4cCI6MjA5NTQwNTk4OX0.aJJX3kP1jgVaK1mtiwZ5bZzNxSSxtm4cDb1ducx3Jvk";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ───────────────────────────────────────────────────────────────────
// HIERARQUIA DE CARGOS (do mais alto para o mais baixo)
// Usado para ordenar funcionários dentro de cada setor
// ───────────────────────────────────────────────────────────────────
const HIERARQUIA_CARGOS = [
  "GERENTE", "GERENTE DE PERECÍVEIS", "GERENTE DE MARKETING", "GERENTE DE TI",
  "SUB GERENTE",
  "SUPERVISOR OPERACIONAL", "SUPERVISOR ADM",
  "ENCAR. DE FRENTE CAIXA", "ENCAR. AÇOUGUE", "ENCAR. DE PADARIA", "ENCAR. PADARIA",
  "ENCAR. FLV", "ENCAR. REPOSIÇÃO", "ENCAR. DE ESTOQUE", "ENCAR. DE TRANSPORTES",
  "ENCARREGADO PREV. PERDAS",
  "SUB ENCAR. REPOSIÇÃO", "SUB ENCAR. ESTOQUE", "SUB ENCAR PADARIA", "SUB. ENCAR. PADARIA",
  "FISCAL DE CAIXA", "FISCAL DE PREVENÇÃO PERDAS",
  "ANALISTA DE RH", "COMPRADOR",
  "ASSISTENTE ADMINISTRATIVO", "ASSISTENTE FINANCEIRO", "ASSISTENTE TESOURARIA",
  "ASSISTENTE COMERCIAL", "ASSISTENTE DE MARKETING", "ASSISTENTE DE RH",
  "AUXILIAR CONTÁBIL", "AUXILIAR TESOURARIA", "LANÇADOR DE NOTA",
  "OPERADOR DE CAIXA", "OPERADOR DE CAIXA/ RECEPÇÃO", "OPERADOR DE CAIXA/ DELIVERY",
  "ATENDENTE DE LANCHONETE", "OPERADOR DE LOJA",
  "AÇOUGUEIRO", "BALCONISTA", "CONFEITEIRA",
  "REPOSITOR", "REPOSITOR ASSITENTE",
  "AUXILIAR DE AÇOUGUE", "AUXILIAR DE PADARIA", "AUXILIAR DE ESTOQUE",
  "AUXILIAR DE ESTOQUE FLV", "AUXILIAR DE PREV DE PERDAS",
  "AUXILIAR DE PREV. DE PERDAS", "AUXILIAR DE PREVENÇÃO DE PERDAS",
  "AUXILIAR DE RH", "AUXILIAR DE DP", "AUXILIAR DE TI",
  "CONFERENTE", "MOTORISTA", "MOTORISTA ESTOQUISTA",
  "AJUDANTE DE MOTORISTA", "AUXILIAR LIMPEZA",
];

// Retorna a posição hierárquica de um cargo (menor = mais alto)
const hierarquiaPos = (funcao = "") => {
  const base = funcao.trim().toUpperCase().replace(/\s+\d+$/, "").replace(/\s*\([^)]*\)$/, "").trim();
  const idx = HIERARQUIA_CARGOS.findIndex((h) => base.startsWith(h) || h.startsWith(base));
  return idx === -1 ? 999 : idx;
};

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

// Todos os setores reais do CSV
const SETORES_ORDEM = [
  "CAIXA","CAIXA/PACOTE","CAIXA/LANCHONETE",
  "REPOSIÇÃO","AÇOUGUE","PADARIA","HORTIFRUTI",
  "LIMPEZA","ESTOQUE","ENTREGA",
  "PREVENÇÃO DE PERDAS",
  "ADMINISTRATIVO OPERACIONAL","ADMINISTRATIVO",
  "FINANCEIRO","RH/ DP","CONTÁBIL FISCAL",
  "COMERCIAL","MARKETING","TI",
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
  constructor({ id, nome, setor, funcao, turno, unidade, regimeFolga, ordem }) {
    this.id          = String(id);
    this.nome        = nome.trim();
    this.setor       = setor.trim();
    this.funcao      = (funcao || "").trim();
    this.turno       = (turno  || "").trim();
    this.unidade     = unidade.trim();
    this.regimeFolga = regimeFolga;
    this.ordem       = ordem;
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
// ALERTA ENGINE — cobertura mínima + sobrecarga
// ───────────────────────────────────────────────────────────────────
const MAX_DIAS_SEGUIDOS = 7; // mais que isso = sobrecarga

class AlertaEngine {
  static verificar(funcionarios, escala, config) {
    const alertas = [], grupos = {};
    funcionarios.forEach((f) => {
      const k = `${f.unidade}||${f.setor}`;
      (grupos[k] = grupos[k] || []).push(f);
    });

    // ── Cobertura mínima + dias críticos ──
    Object.entries(grupos).forEach(([k, lista]) => {
      const [unidade, setor] = k.split("||");
      const minimo = config.getMinimoPorSetor(unidade, setor);
      for (let d = 1; d <= config.dias; d++) {
        const dow = config.getDow(d);
        const trabalhando = lista.filter(
          (f) => !f.ferias && !f.cargoVago && !"FAV".includes(escala[f.id]?.[d] || "T")
        ).length;
        if (trabalhando < minimo && !(dow === 0 && minimo <= 0)) {
          alertas.push({
            tipo: "cobertura", nivel: "erro", dia: d, unidade, setor,
            msg: `${setor} / ${unidade}: ${trabalhando} de ${minimo} no dia ${d} (${DIAS7[dow]})`,
          });
        }
        if (config.isDiaCritico(unidade, d)) {
          const folgando = lista.filter((f) => "FA".includes(escala[f.id]?.[d] || "T")).length;
          if (folgando > 0 && trabalhando <= minimo) {
            alertas.push({
              tipo: "critico", nivel: "aviso", dia: d, unidade, setor,
              msg: `Dia crítico ${d}: ${folgando} de folga em ${setor}/${unidade} com cobertura no limite`,
              funcIds: lista.filter((f) => "FA".includes(escala[f.id]?.[d])).map((f) => f.id),
            });
          }
        }
      }
    });

    // ── Sobrecarga: mais de MAX_DIAS_SEGUIDOS dias seguidos sem folga ──
    funcionarios.forEach((func) => {
      if (func.cargoVago || func.ferias) return;
      const esc = escala[func.id] || {};
      let seguidos = 0;
      let inicioBloco = 1;
      for (let d = 1; d <= config.dias + 1; d++) {
        const status = d <= config.dias ? (esc[d] || "T") : "F";
        if (status === "T") {
          if (seguidos === 0) inicioBloco = d;
          seguidos++;
        } else {
          if (seguidos > MAX_DIAS_SEGUIDOS) {
            alertas.push({
              tipo: "sobrecarga", nivel: "aviso",
              dia: inicioBloco, unidade: func.unidade, setor: func.setor,
              msg: `Sobrecarga: ${func.nome} trabalha ${seguidos} dias seguidos (dia ${inicioBloco} ao ${d - 1}) em ${func.setor}/${func.unidade}`,
              funcIds: [func.id],
            });
          }
          seguidos = 0;
        }
      }
    });

    return alertas;
  }
}

// ───────────────────────────────────────────────────────────────────
// TROCA ENGINE — FIX: troca a folga do alvo COM a folga do candidato
// ───────────────────────────────────────────────────────────────────
class TrocaEngine {
  static sugerir({ funcAlvo, diaAlvo, funcionarios, escala, config }) {
    return funcionarios
      .filter((f) =>
        f.id !== funcAlvo.id && f.setor === funcAlvo.setor && f.unidade === funcAlvo.unidade &&
        !f.ferias && !f.cargoVago && (escala[f.id]?.[diaAlvo] || "T") === "T"
      )
      .map((c) => {
        // Encontra um dia de folga do candidato para trocar
        const par = Object.entries(escala[c.id] || {}).find(
          ([d, v]) => v === "F" && Number(d) !== diaAlvo
        );
        return {
          funcionario: c,
          diaFolgaAtual: par ? Number(par[0]) : null,
          impacto: config.isDiaCritico(funcAlvo.unidade, diaAlvo) ? "alto" : "baixo",
        };
      })
      .filter((s) => s.diaFolgaAtual !== null); // só sugere se tiver folga para trocar
  }

  // FIX: troca REAL — alvo perde a folga no diaAlvo, candidato ganha a folga no diaAlvo
  // e alvo ganha a folga que o candidato tinha antes
  static executar({ funcAlvo, diaAlvo, funcCandidato, diaFolgaCandidato, escalaAtual }) {
    const nova = { ...escalaAtual };

    // Copia escala do alvo e do candidato
    nova[funcAlvo.id]      = { ...escalaAtual[funcAlvo.id] };
    nova[funcCandidato.id] = { ...escalaAtual[funcCandidato.id] };

    // Alvo: perde a folga no diaAlvo, ganha a folga do candidato
    nova[funcAlvo.id][diaAlvo] = "T";
    if (diaFolgaCandidato) nova[funcAlvo.id][diaFolgaCandidato] = "F";

    // Candidato: ganha a folga no diaAlvo, perde a sua folga antiga
    nova[funcCandidato.id][diaAlvo] = "F";
    if (diaFolgaCandidato) nova[funcCandidato.id][diaFolgaCandidato] = "T";

    return nova;
  }
}

// ───────────────────────────────────────────────────────────────────
// TELA DE LOGIN
// ───────────────────────────────────────────────────────────────────
function TelaLogin({ onLogin }) {
  const [email,   setEmail]   = useState("");
  const [senha,   setSenha]   = useState("");
  const [erro,    setErro]    = useState("");
  const [loading, setLoading] = useState(false);
  const [modo,    setModo]    = useState("login");

  const submeter = async () => {
    setErro(""); setLoading(true);
    try {
      let res;
      if (modo === "login") {
        res = await sb.auth.signInWithPassword({ email, password: senha });
      } else {
        res = await sb.auth.signUp({ email, password: senha });
        if (!res.error) {
          setErro("Conta criada! Verifique seu e-mail e depois faça login.");
          setModo("login"); setLoading(false); return;
        }
      }
      if (res.error) setErro(res.error.message);
      else onLogin(res.data.session);
    } catch (e) { setErro(String(e)); }
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
        <div style={{ display: "flex", gap: 0, marginBottom: 20, border: "1px solid #ccc", borderRadius: 7, overflow: "hidden" }}>
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
              onKeyDown={(e) => e.key === "Enter" && submeter()} placeholder="seu@email.com"
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #999", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submeter()} placeholder="••••••••"
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #999", boxSizing: "border-box" }} />
          </div>
          {erro && (
            <div style={{ fontSize: 11, color: erro.includes("criada") ? "#166534" : "#CC0000",
              background: erro.includes("criada") ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${erro.includes("criada") ? "#bbf7d0" : "#fecaca"}`,
              borderRadius: 5, padding: "8px 10px" }}>{erro}</div>
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
  const [diasNum,        setDiasNum]        = useState(() => {
    const dt = new Date("2026-05-01T12:00:00");
    return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  });
  const [dataInicio,     setDataInicio]     = useState("2026-05-01");
  const [aba,            setAba]            = useState("escala");
  const [trocaAlvo,      setTrocaAlvo]      = useState(null);
  const [trocaHierarquiaAlvo, setTrocaHierarquiaAlvo] = useState(null);
  const [trocaSugestoes, setTrocaSugestoes] = useState([]);
  const [filtroLoja,     setFiltroLoja]     = useState("");
  const [filtroSetor,    setFiltroSetor]    = useState("");
  const [filtroTurno,    setFiltroTurno]    = useState("");
  const [feriasModal,    setFeriasModal]    = useState(null);
  const [cfgUnidades,    setCfgUnidades]    = useState({});
  const [salvando,       setSalvando]       = useState(false);
  const [salvouOk,       setSalvouOk]       = useState(false);
  const [carregandoDB,   setCarregandoDB]   = useState(false);
  const [modoLimpeza,    setModoLimpeza]    = useState(false);
  const [selecsLimpeza,  setSelecsLimpeza]  = useState(new Set());
  const salvarTimer = useRef(null);
  const funcsRef    = useRef([]);
  const escalaRef   = useRef({});
  const intervRef   = useRef({});
  const cfgRef      = useRef({});
  const feriasRef   = useRef({});

  // mantém refs sincronizados para uso no debounce
  useEffect(() => { funcsRef.current  = funcionarios; }, [funcionarios]);
  useEffect(() => { escalaRef.current = escala;       }, [escala]);
  useEffect(() => { intervRef.current = intervalos;   }, [intervalos]);
  useEffect(() => { cfgRef.current    = cfgUnidades;  }, [cfgUnidades]);

  const mesKey = useMemo(() => dataInicio.slice(0, 7), [dataInicio]);

  // ── auth ──────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setAuthCarregando(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSessao(s));
    
    // Tenta reidratar os funcionários salvos no localStorage
    try {
      const salvos = localStorage.getItem("funcionarios_salvos");
      if (salvos) {
        const parsed = JSON.parse(salvos);
        const refaturados = parsed.map(f => Object.assign(Object.create(FuncionarioModel.prototype), f));
        setFuncionarios(refaturados);
      }
    } catch(e) { console.error("Erro ao ler funcionarios salvos", e); }

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessao) return;
    carregarDados();
  }, [sessao, mesKey]);

  // ── carregar do Supabase ──────────────────────────────────────
  const carregarDados = async () => {
    setCarregandoDB(true);
    try {
      const { data: cfgRows } = await sb.from("configuracoes").select("unidade, dados").eq("mes", mesKey);
      if (cfgRows?.length) {
        const novas = {};
        cfgRows.forEach((r) => { novas[r.unidade] = r.dados; });
        setCfgUnidades(novas);
        cfgRef.current = novas;
      }
      const { data: escRows } = await sb.from("escalas").select("unidade, escala, intervalos, ferias").eq("mes", mesKey);
      if (escRows?.length) {
        let escMerge = {}, intMerge = {}, feriasPorFunc = {};
        escRows.forEach((r) => {
          Object.assign(escMerge, r.escala || {});
          Object.assign(intMerge, r.intervalos || {});
          Object.assign(feriasPorFunc, r.ferias || {});
        });
        setEscala(escMerge);
        escalaRef.current = escMerge;
        setIntervalos(intMerge);
        intervRef.current = intMerge;
        // Sempre persiste férias no ref para uso ao reimportar CSV
        if (Object.keys(feriasPorFunc).length) {
          feriasRef.current = { ...feriasRef.current, ...feriasPorFunc };
          setFuncionarios((prev) => {
            if (!prev.length) return prev;
            return prev.map((f) => {
              const ferias = feriasPorFunc[f.id] ?? f.ferias;
              const upd = Object.assign(Object.create(Object.getPrototypeOf(f)), f);
              upd.ferias = ferias || null;
              return upd;
            });
          });
        }
      }
    } catch (e) { console.error("Erro ao carregar:", e); }
    setCarregandoDB(false);
  };

  // ── salvar no Supabase (debounced) ───────────────────────────
  const salvarSupabase = useCallback((novaEscala, novosIntervalos, novasCfgs, novosFuncs) => {
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(async () => {
      setSalvando(true);
      const funcs  = novosFuncs      || funcsRef.current;
      const esc    = novaEscala      || escalaRef.current;
      const intv   = novosIntervalos || intervRef.current;
      const cfgs   = novasCfgs       || cfgRef.current;
      const lojas  = [...new Set(funcs.map((f) => f.unidade))];
      try {
        for (const loja of lojas) {
          if (cfgs[loja]) {
            await sb.from("configuracoes").upsert(
              { unidade: loja, mes: mesKey, dados: cfgs[loja], updated_at: new Date().toISOString() },
              { onConflict: "unidade,mes" }
            );
          }
          const funcsLoja = funcs.filter((f) => f.unidade === loja);
          const escLoja = {}, ferLoja = {};
          funcsLoja.forEach((f) => {
            escLoja[f.id] = esc[f.id] || {};
            if (f.ferias) ferLoja[f.id] = f.ferias;
          });
          await sb.from("escalas").upsert(
            { unidade: loja, mes: mesKey, escala: escLoja, intervalos: intv, ferias: ferLoja, updated_at: new Date().toISOString() },
            { onConflict: "unidade,mes" }
          );
        }
        setSalvouOk(true);
        setTimeout(() => setSalvouOk(false), 2500);
      } catch (e) { console.error("Erro ao salvar:", e); }
      setSalvando(false);
    }, 1500);
  }, [mesKey]);

  // ── config ────────────────────────────────────────────────────
  const config = useMemo(() => {
    const unidades = garantirCfg(cfgUnidades, funcionarios.map((f) => f.unidade));
    return new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades });
  }, [dataInicio, diasNum, cfgUnidades, funcionarios]);

  // ── importar CSV ──────────────────────────────────────────────
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
        const num = c[0] || "", loja = c[1] ? `LOJA ${c[1].trim()}` : "LOJA 1";
        const setor = (c[2] || "GERAL").trim().toUpperCase();
        const funcao = (c[3] || "").trim(), turno = (c[4] || "").trim().toUpperCase();
        const nome = (c[5] || "").trim(), folgas = (c[6] || "").trim();
        if (!nome) return null;
        const f = new FuncionarioModel({
          id: num || String(Math.random()), nome, setor, funcao, turno,
          unidade: loja, regimeFolga: parseRegimeFolga(folgas),
          ordem: parseInt(num) || 9999,
        });
        f.cargoVago = nome.toUpperCase().includes("CARGO VAGO");
        return f;
      }).filter(Boolean);

      const novasCfgs = garantirCfg(cfgUnidades, dados.map((f) => f.unidade));
      setCfgUnidades(novasCfgs);
      cfgRef.current = novasCfgs;

      // Restaura férias salvas no banco para os funcionários reimportados
      const feriasSalvas = feriasRef.current;
      if (Object.keys(feriasSalvas).length) {
        dados.forEach((f) => {
          if (feriasSalvas[f.id]) f.ferias = feriasSalvas[f.id];
        });
      }

      setFuncionarios(dados);
      funcsRef.current = dados;
      
      const configObj = new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades: novasCfgs });
      const escalaCalculada = calcularEscala(dados, configObj);
      
      // Se já existe uma escala carregada do banco, preserva os dados manuais
      // e só calcula para funcionários novos que não estavam na escala
      const escalaExistente = escalaRef.current;
      let novaEscala = {};
      if (Object.keys(escalaExistente).length > 0) {
        novaEscala = { ...escalaExistente };
        dados.forEach((f) => {
          if (!novaEscala[f.id]) novaEscala[f.id] = escalaCalculada[f.id];
        });
      } else {
        novaEscala = escalaCalculada;
      }

      setEscala(novaEscala);
      escalaRef.current = novaEscala;
      salvarSupabase(novaEscala, intervalos, novasCfgs, dados);

      try { localStorage.setItem("funcionarios_salvos", JSON.stringify(dados)); } catch (e) { console.error(e); }
    };
    leitor.readAsArrayBuffer(arquivo);
  };

  // ── calcular escala (puro) ────────────────────────────────────
  const calcularEscala = (lista, cfg) => {
    const nova = {};
    const grupos = {};
    lista.forEach((f) => { const k = `${f.unidade}||${f.setor}`; (grupos[k] = grupos[k] || []).push(f); });
    Object.values(grupos).forEach((grupo) => {
      grupo.forEach((func, idx) => {
        if (func.cargoVago) { nova[func.id] = {}; return; }
        if (func.ferias) {
          const af = func.ferias;
          if (af.tipo === "ADM") {
            const esc = gerarEscalaFuncionario(func, idx, grupo, cfg);
            for (let d = 1; d <= cfg.dias; d++) {
              if (cfg.getDataDia(d).toISOString().slice(0, 10) < af.inicio) {
                esc[d] = "ADM";
              }
            }
            nova[func.id] = esc;
          } else {
            nova[func.id] = {};
            for (let d = 1; d <= cfg.dias; d++) {
              const iso = cfg.getDataDia(d).toISOString().slice(0, 10);
              nova[func.id][d] = (iso >= af.inicio && iso <= af.fim) ? (af.tipo === "LM" ? "LM" : "V") : "T";
            }
          }
        } else {
          nova[func.id] = gerarEscalaFuncionario(func, idx, grupo, cfg);
        }
      });
    });
    return nova;
  };

  const gerarEscala = useCallback((lista, cfg) => {
    const nova = calcularEscala(lista, cfg);
    setEscala(nova);
    escalaRef.current = nova;
    salvarSupabase(nova, intervRef.current, cfgRef.current, lista);
  }, [salvarSupabase]);

  // ── alternar célula ───────────────────────────────────────────
  const alternar = (id, dia) => {
    const seq = { T: "F", F: "A", A: "T", V: "V" };
    setEscala((prev) => {
      const nova = { ...prev, [id]: { ...prev[id], [dia]: seq[prev[id]?.[dia] || "T"] } };
      escalaRef.current = nova;
      salvarSupabase(nova, intervRef.current, cfgRef.current, funcsRef.current);
      return nova;
    });
  };

  // ── intervalo domingo ─────────────────────────────────────────
  // ── intervalo domingo ─────────────────────────────────────────
  const alternarIntervalo = (id, dia) => {
    const key = `${id}_${dia}`;
    setIntervalos((prev) => {
      let novo;
      const cur = prev[key];
      if (!cur) novo = { ...prev, [key]: "1" };
      else if (cur === "4") { novo = { ...prev }; delete novo[key]; }
      else novo = { ...prev, [key]: String(Number(cur) + 1) };
      intervRef.current = novo;
      salvarSupabase(escalaRef.current, novo, cfgRef.current, funcsRef.current);
      return novo;
    });
  };

  // ── férias ────────────────────────────────────────────────────
  // ── afastamentos (Férias, LM, ADM) ────────────────────────────
  const salvarAfastamento = (funcId, tipo, inicio, fim) => {
    if (inicio) {
      feriasRef.current = { ...feriasRef.current, [funcId]: { tipo, inicio, fim } };
    } else {
      const { [funcId]: _, ...rest } = feriasRef.current;
      feriasRef.current = rest;
    }
    setFuncionarios((prev) => {
      const nova = prev.map((f) => {
        if (f.id !== funcId) return f;
        const upd = Object.assign(Object.create(Object.getPrototypeOf(f)), f);
        upd.ferias = inicio ? { tipo, inicio, fim } : null;
        return upd;
      });
      funcsRef.current = nova;
      const novaEscala = calcularEscala(nova, config);
      setEscala(novaEscala);
      escalaRef.current = novaEscala;
      salvarSupabase(novaEscala, intervRef.current, cfgRef.current, nova);
      return nova;
    });
    setFeriasModal(null);
  };
  // ── salvar estado das folgas ─────────────────────────────────
  const salvarEstadoFolgas = async () => {
    const estado = {
      mes: mesKey,
      dataInicio,
      dias: diasNum,
      dataSalvo: new Date().toISOString(),
      funcionarios: []
    };

    const grupos = {};
    funcionarios.forEach((f) => {
      const k = `${f.unidade}||${f.setor}`;
      (grupos[k] = grupos[k] || []).push(f);
    });

    funcionarios.forEach((func) => {
      if (func.cargoVago) return;

      const k = `${func.unidade}||${func.setor}`;
      const grupo = grupos[k] || [];
      const idx = grupo.indexOf(func);

      const fEscala = escala[func.id] || {};
      const folgas = [];
      const datasFolga = [];

      for (let d = 1; d <= diasNum; d++) {
        const status = fEscala[d];
        if (status === "F" || status === "A") {
          folgas.push(d);
          const dtStr = config.getDataDia(d).toISOString().slice(0, 10);
          datasFolga.push(dtStr);
        }
      }

      // Calcular dias trabalhados após a última folga no mês
      let diasTrabalhadosAposUltimaFolga = 0;
      if (folgas.length > 0) {
        const ultimaFolga = folgas[folgas.length - 1];
        diasTrabalhadosAposUltimaFolga = diasNum - ultimaFolga;
      } else {
        diasTrabalhadosAposUltimaFolga = diasNum;
      }

      // Posição atual do ciclo e última semana
      let posicaoCiclo = 0;
      let ultimaSemanaUtilizada = 0;

      if (func.regimeFolga.tipo === "5x1") {
        const offset = (idx * 1) % 6;
        posicaoCiclo = (diasNum - 1 + offset) % 6;
      } else if (func.regimeFolga.tipo === "6x1_flex") {
        const dowsPermitidos = func.regimeFolga.diasFlex
          .map((d) => DIAS_DOW[d])
          .filter((n) => n !== undefined);
        
        if (dowsPermitidos.length > 0) {
          let semana = 0;
          for (let d = 1; d <= diasNum; d++) {
            const dow = config.getDow(d);
            if (dowsPermitidos.includes(dow)) {
              if (dow === dowsPermitidos[dowsPermitidos.length - 1]) {
                semana++;
              }
            }
          }
          posicaoCiclo = (semana + idx) % dowsPermitidos.length;
          ultimaSemanaUtilizada = semana;
        }
      }

      estado.funcionarios.push({
        id: func.id,
        nome: func.nome,
        unidade: func.unidade,
        setor: func.setor,
        funcao: func.funcao,
        regime: func.regimeFolga.tipo,
        folgas,
        datasFolga,
        ultimoDiaFolga: folgas.length > 0 ? folgas[folgas.length - 1] : null,
        diasTrabalhadosAposUltimaFolga,
        posicaoCiclo,
        ultimaSemanaUtilizada
      });
    });

    // 1. Atualizar no estado local das configurações por unidade para persistir no Supabase
    const novasCfgs = { ...cfgUnidades };
    const porUnidade = {};
    estado.funcionarios.forEach((func) => {
      if (!porUnidade[func.unidade]) porUnidade[func.unidade] = [];
      porUnidade[func.unidade].push(func);
    });

    Object.keys(porUnidade).forEach((unidade) => {
      novasCfgs[unidade] = {
        ...novasCfgs[unidade],
        estadoFolgas: {
          mes: estado.mes,
          dataInicio: estado.dataInicio,
          dias: estado.dias,
          dataSalvo: estado.dataSalvo,
          funcionarios: porUnidade[unidade]
        }
      };
    });

    setCfgUnidades(novasCfgs);
    cfgRef.current = novasCfgs;

    // Dispara a persistência imediata no Supabase
    await salvarSupabase(escala, intervalos, novasCfgs, funcionarios);

    // 2. Disponibiliza para download como JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(estado, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `estado-folgas-${estado.mes}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    alert("Estado atual das folgas salvo e baixado com sucesso!");
  };

  // ── salvar config ─────────────────────────────────────────────
  const setCfgCampo = (unidade, campo, valor) => {
    setCfgUnidades((prev) => {
      const novas = { ...prev, [unidade]: { ...(prev[unidade] || cfgVazia()), [campo]: valor } };
      cfgRef.current = novas;
      salvarSupabase(escalaRef.current, intervRef.current, novas, funcsRef.current);
      return novas;
    });
  };

  // ── revisão ───────────────────────────────────────────────────
  const toggleRevisar = (funcId) => {
    setEscala((prev) => {
      const funcEscala = { ...prev[funcId] };
      funcEscala.R = !funcEscala.R;
      const nova = { ...prev, [funcId]: funcEscala };
      escalaRef.current = nova;
      salvarSupabase(nova, intervRef.current, cfgRef.current, funcsRef.current);
      return nova;
    });
  };

  // ── modo limpeza em lote ──────────────────────────────────────
  const confirmarLimpeza = () => {
    if (selecsLimpeza.size === 0) return;
    setEscala((prev) => {
      const nova = { ...prev };
      selecsLimpeza.forEach((id) => {
        const funcEscala = { ...nova[id] };
        for (let d = 1; d <= diasNum; d++) {
          if (funcEscala[d] === "F" || funcEscala[d] === "A") {
            funcEscala[d] = "T";
          }
        }
        nova[id] = funcEscala;
      });
      escalaRef.current = nova;
      salvarSupabase(nova, intervRef.current, cfgRef.current, funcsRef.current);
      return nova;
    });
    setSelecsLimpeza(new Set());
    setModoLimpeza(false);
  };

  const toggleLimpezaSetor = (setorLista) => {
    setSelecsLimpeza((prev) => {
      const novo = new Set(prev);
      const allSelected = setorLista.every((f) => novo.has(f.id));
      if (allSelected) {
        setorLista.forEach((f) => novo.delete(f.id));
      } else {
        setorLista.forEach((f) => novo.add(f.id));
      }
      return novo;
    });
  };

  // ── alertas ───────────────────────────────────────────────────
  const alertas = useMemo(() => {
    if (!funcionarios.length) return [];
    return AlertaEngine.verificar(funcionarios.filter((f) => !f.cargoVago), escala, config);
  }, [funcionarios, escala, config]);

  // ── troca ─────────────────────────────────────────────────────
  const abrirTroca = (func, dia) => {
    setTrocaSugestoes(TrocaEngine.sugerir({ funcAlvo: func, diaAlvo: dia, funcionarios, escala, config }));
    setTrocaAlvo({ func, dia });
    setAba("troca");
  };
  const executarTroca = (candidato) => {
    const novaEscala = TrocaEngine.executar({
      funcAlvo: trocaAlvo.func,
      diaAlvo: trocaAlvo.dia,
      funcCandidato: candidato.funcionario,
      diaFolgaCandidato: candidato.diaFolgaAtual,
      escalaAtual: escala,
    });
    setEscala(novaEscala);
    escalaRef.current = novaEscala;
    salvarSupabase(novaEscala, intervRef.current, cfgRef.current, funcsRef.current);
    setAba("escala"); setTrocaAlvo(null);
  };

  // ── troca de hierarquia ───────────────────────────────────────
  const abrirTrocaHierarquia = (func) => {
    setTrocaHierarquiaAlvo(func);
    setAba("trocaHierarquia");
  };

  const executarTrocaHierarquia = (candidato) => {
    const alvo = trocaHierarquiaAlvo;
    
    const pA = { setor: alvo.setor, funcao: alvo.funcao, turno: alvo.turno, regimeFolga: alvo.regimeFolga, ordem: alvo.ordem };
    const pB = { setor: candidato.setor, funcao: candidato.funcao, turno: candidato.turno, regimeFolga: candidato.regimeFolga, ordem: candidato.ordem };
    
    const novaLista = funcionarios.map(f => {
      if (f.id === alvo.id) {
        return Object.assign(Object.create(FuncionarioModel.prototype), { ...f, ...pB });
      }
      if (f.id === candidato.id) {
        return Object.assign(Object.create(FuncionarioModel.prototype), { ...f, ...pA });
      }
      return f;
    });

    setFuncionarios(novaLista);
    funcsRef.current = novaLista;
    try { localStorage.setItem("funcionarios_salvos", JSON.stringify(novaLista)); } catch (e) { console.error(e); }
    
    const cfg = new ConfiguracaoMes({ dataInicio, dias: diasNum, unidades: garantirCfg(cfgRef.current, novaLista.map((f) => f.unidade)) });
    const novaEscala = calcularEscala(novaLista, cfg);
    setEscala(novaEscala);
    escalaRef.current = novaEscala;
    salvarSupabase(novaEscala, intervRef.current, cfgRef.current, novaLista);
    
    setAba("escala");
    setTrocaHierarquiaAlvo(null);
  };

  // ── helpers ───────────────────────────────────────────────────
  const lojas     = useMemo(() => [...new Set(funcionarios.map((f) => f.unidade))].sort(), [funcionarios]);
  const diasLista = useMemo(() => Array.from({ length: diasNum }, (_, i) => i + 1), [diasNum]);
  const tituloMes = useMemo(() => {
    const dt = new Date(dataInicio + "T12:00:00");
    if (isNaN(dt.getTime())) return "—";
    return `${MESES_PT[dt.getMonth()].toUpperCase()} DE ${dt.getFullYear()}`;
  }, [dataInicio]);

  const setoresDaLoja = (loja) => {
    const funcsLoja = funcionarios.filter((f) => f.unidade === loja);
    const p = [...new Set(funcsLoja.map((f) => f.setor))];
    return p.sort((a, b) => {
      const minA = Math.min(...funcsLoja.filter((f) => f.setor === a).map((f) => f.ordem));
      const minB = Math.min(...funcsLoja.filter((f) => f.setor === b).map((f) => f.ordem));
      return minA - minB;
    });
  };

  // Ordenação por hierarquia de cargo, depois por nome
  const funcsDaLoja = (loja, setor, turno) =>
    funcionarios
      .filter((f) => f.unidade === loja && f.setor === setor && (!turno || f.turno === turno))
      .sort((a, b) => {
        if (a.cargoVago && !b.cargoVago) return 1;
        if (!a.cargoVago && b.cargoVago) return -1;
        return a.ordem - b.ordem;
      });

  const lojasFiltradas = filtroLoja ? lojas.filter((l) => l === filtroLoja) : lojas;

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
  // GUARDS
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
    <>
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: #fff !important; margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .print-hide { display: none !important; }
          .print-container { padding: 0 !important; margin: 0 !important; max-width: none !important; box-shadow: none !important; border: none !important; }
          table { width: 100% !important; page-break-inside: avoid; border-collapse: collapse; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>
      <div style={S.page} className="print-container">
        {/* ── MODAIS ── */}
        {feriasModal && <AfastamentoModal func={feriasModal} onSalvar={salvarAfastamento} onFechar={() => setFeriasModal(null)} />}

        <div style={S.wrap} className="print-container">
        {/* Header */}
        <div style={S.header} className="no-print">
          <div>
            <div style={S.hTitle}>⬛ Escala de Folgas</div>
            <div style={S.hSub}>
              {tituloMes} · <span style={{ color: "#888" }}>{sessao.user.email}</span>
              {salvando     && <span style={{ color: "#b45309",  marginLeft: 10 }}>💾 Salvando...</span>}
              {salvouOk     && <span style={{ color: "#166534",  marginLeft: 10 }}>✅ Salvo</span>}
              {carregandoDB && <span style={{ color: "#1d4ed8",  marginLeft: 10 }}>⏳ Carregando...</span>}
            </div>
          </div>
          <div style={S.hControls}>
            <label style={S.lbl}>CSV:</label>
            {funcionarios.length === 0 ? (
              <input type="file" accept=".csv" onChange={importarCSV} style={S.fileIn} />
            ) : (
              <button onClick={() => {
                if (window.confirm("Isso removerá a tabela atual da tela para você importar um novo CSV. Continuar?")) {
                  setFuncionarios([]);
                  funcsRef.current = [];
                  localStorage.removeItem("funcionarios_salvos");
                }
              }} style={{ ...S.btn, color: "#CC0000", borderColor: "#CC0000" }}>🗑️ Trocar Tabela</button>
            )}
            <label style={S.lbl}>Início:</label>
            <input type="date" value={dataInicio} onChange={(e) => {
              const novaData = e.target.value;
              if (!novaData) return;
              const dt = new Date(novaData + "T12:00:00");
              if (isNaN(dt.getTime())) return;
              const novoDias = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
              setDataInicio(novaData);
              setDiasNum(novoDias);
              if (funcsRef.current.length) {
                const cfg = new ConfiguracaoMes({
                  dataInicio: novaData,
                  dias: novoDias,
                  unidades: garantirCfg(cfgRef.current, funcsRef.current.map((f) => f.unidade))
                });
                const nova = calcularEscala(funcsRef.current, cfg);
                setEscala(nova);
                escalaRef.current = nova;
                salvarSupabase(nova, intervRef.current, cfgRef.current, funcsRef.current);
              }
            }} style={S.inp} />
            <label style={S.lbl}>Dias:</label>
            <input type="number" min={1} max={31} value={diasNum}
              onChange={(e) => {
                const v = +e.target.value; setDiasNum(v);
                if (funcsRef.current.length) {
                  const cfg = new ConfiguracaoMes({ dataInicio, dias: v, unidades: garantirCfg(cfgRef.current, funcsRef.current.map((f) => f.unidade)) });
                  const nova = calcularEscala(funcsRef.current, cfg);
                  setEscala(nova); escalaRef.current = nova;
                  salvarSupabase(nova, intervRef.current, cfgRef.current, funcsRef.current);
                }
              }} style={{ ...S.inp, width: 58 }} />
            <button onClick={() => setModoLimpeza(!modoLimpeza)} style={{ ...S.btn, backgroundColor: modoLimpeza ? "#fee2e2" : "transparent" }}>🧹 Limpeza em Lote</button>
            <button onClick={() => gerarEscala(funcsRef.current, config)} style={S.btn}>🔄 Regerar</button>
            <button onClick={salvarEstadoFolgas} style={{ ...S.btn, backgroundColor: "#28a745", color: "#fff", borderColor: "#28a745" }}>💾 Salvar estado atual das folgas</button>
            <button onClick={() => window.print()} style={{ ...S.btn, ...S.btnR, background: "#111", color: "#fff", borderColor: "#111" }}>🖨️ Imprimir / Salvar PDF</button>
            <button onClick={() => sb.auth.signOut()} style={{ ...S.btn, color: "#CC0000", borderColor: "#CC0000" }}>Sair</button>
          </div>
        </div>

        {/* Abas */}
        <div style={S.tabs} className="no-print">
          {[
            { id: "escala",  label: "📅 Escala" },
            { id: "config",  label: "⚙️ Configuração" },
            { id: "alertas", label: `🔔 Alertas${alertas.length ? ` (${alertas.length})` : ""}` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setAba(id)}
              style={{ ...S.tab, ...(aba === id ? S.tabOn : {}) }}>{label}</button>
          ))}
        </div>

        {/* ════ CONFIG ════ */}
        {aba === "config" && (
          <div className="no-print" style={{ paddingTop: 12 }}>
            <p style={S.hint}>Configurações salvas automaticamente. Dias separados por vírgula (ex: 5, 20).</p>
            {(funcionarios.length ? lojas : ["LOJA 1","LOJA 2","LOJA 3"]).map((unidade) => {
              const cfg = cfgUnidades[unidade] || cfgVazia();
              return (
                <div key={unidade} style={S.card}>
                  <div style={S.cardTit}>{unidade}</div>
                  <div style={S.grid3}>
                    {[["🔴 Oferta / Promoção","diasCriticos"],["💰 Pagamento Salarial","diasPagamento"],["🗓 Feriados","feriados"]].map(([label, campo]) => (
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
                      {SETORES_ORDEM.map((setor) => (
                        <div key={setor} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#444", minWidth: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{setor}</span>
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
                <div style={S.cardTit}>🌴 Afastamentos (Férias, LM, Admissão)</div>
                <p style={S.hint}>Afastamentos salvos automaticamente.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {funcionarios.filter((f) => !f.cargoVago).map((f) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: f.ferias ? "#f0fdf4" : "#fafafa", borderRadius: 6, border: "1px solid #ccc" }}>
                      <span style={{ fontSize: 12, flex: 1 }}>
                        {f.nome} <span style={{ color: "#888", fontSize: 11 }}>({f.funcao || f.setor} · {f.unidade})</span>
                      </span>
                      {f.ferias && (
                        <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>
                          {f.ferias.tipo === "ADM" 
                            ? `🏢 Admissão: ${f.ferias.inicio.split("-").reverse().join("/")}` 
                            : f.ferias.tipo === "LM" 
                              ? `👶 LM: ${f.ferias.inicio.split("-").reverse().join("/")} → ${f.ferias.fim.split("-").reverse().join("/")}`
                              : `🌴 Férias: ${f.ferias.inicio.split("-").reverse().join("/")} → ${f.ferias.fim.split("-").reverse().join("/")}`}
                        </span>
                      )}
                      <button onClick={() => setFeriasModal(f)} style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }}>
                        {f.ferias ? "✏️ Editar" : "+ Afastamento"}
                      </button>
                      {f.ferias && (
                        <button onClick={() => salvarAfastamento(f.id, null, null, null)} style={{ ...S.btn, fontSize: 11, color: "#CC0000", padding: "4px 8px" }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ ALERTAS ════ */}
        {aba === "alertas" && (
          <div style={{ paddingTop: 12 }} className="no-print">
            {/* Legenda de tipos */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              {[["❌ ERRO","cobertura mínima não atingida","#CC0000"],["⚠️ AVISO","dia crítico com cobertura no limite","#b45309"],["⏱ SOBRECARGA","funcionário com mais de 7 dias seguidos","#7c3aed"]].map(([icon, desc, cor]) => (
                <div key={icon} style={{ fontSize: 11, color: cor, display: "flex", alignItems: "center", gap: 5 }}>
                  <strong>{icon}</strong> — {desc}
                </div>
              ))}
            </div>
            {alertas.length === 0
              ? <div style={S.empty}>✅ Nenhum alerta. Escala dentro dos parâmetros.</div>
              : alertas.map((a, i) => {
                const corMap = { erro: "#CC0000", aviso: "#b45309", sobrecarga: "#7c3aed" };
                const cor = a.tipo === "sobrecarga" ? "#7c3aed" : corMap[a.nivel] || "#CC0000";
                const icon = a.tipo === "sobrecarga" ? "⏱" : a.nivel === "erro" ? "❌" : "⚠️";
                const label = a.tipo === "sobrecarga" ? "SOBRECARGA" : a.nivel === "erro" ? "ERRO" : "AVISO";
                return (
                  <div key={i} style={{ ...S.alertCard, borderLeftColor: cor }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, color: cor, fontSize: 12 }}>{icon} {label}</span>
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
                );
              })
            }
          </div>
        )}

        {/* ════ TROCA ════ */}
        {aba === "troca" && trocaAlvo && (
          <div style={{ paddingTop: 12 }}>
            <div style={S.card}>
              <div style={S.cardTit}>🔄 Troca de Folga</div>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                <strong>{trocaAlvo.func.nome}</strong>{" "}
                <span style={{ color: "#888" }}>({trocaAlvo.func.setor} · {trocaAlvo.func.unidade})</span>{" "}
                — folga no dia <strong>{trocaAlvo.dia}</strong> será transferida para o colega selecionado, que cede a sua.
              </p>
              {trocaSugestoes.length === 0
                ? <div style={S.empty}>Nenhum colega com folga disponível para troca.</div>
                : trocaSugestoes.map((s, i) => (
                  <div key={i} style={{ ...S.alertCard, borderLeftColor: s.impacto === "alto" ? "#CC0000" : "#15803d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.funcionario.nome}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        Cede a folga do dia <strong>{s.diaFolgaAtual}</strong> ·{" "}
                        <span style={{ color: s.impacto === "alto" ? "#CC0000" : "#15803d", fontWeight: 600 }}>Impacto {s.impacto}</span>
                      </div>
                    </div>
                    <button onClick={() => executarTroca(s)} style={{ ...S.btn, ...S.btnR, fontSize: 11 }}>✅ Confirmar troca</button>
                  </div>
                ))
              }
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => { setAba("escala"); setTrocaAlvo(null); }}
                  style={{ ...S.btn, color: "#CC0000", borderColor: "#CC0000", fontWeight: 600 }}>
                  ⚠️ Manter sem trocas (assumir risco)
                </button>
                <button onClick={() => { setAba("escala"); setTrocaAlvo(null); }} style={S.btn}>← Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* ════ TROCA DE HIERARQUIA ════ */}
        {aba === "trocaHierarquia" && trocaHierarquiaAlvo && (
          <div className="no-print">
            <button onClick={() => { setAba("escala"); setTrocaHierarquiaAlvo(null); }} style={{ ...S.btn, marginBottom: 16 }}>← Voltar para a Escala</button>
            <div style={S.card}>
              <div style={S.cardTit}>🔄 Troca de Hierarquia</div>
              <p style={{ fontSize: 13, marginBottom: 16, color: "#444", lineHeight: 1.5 }}>
                Com quem <strong>{trocaHierarquiaAlvo.nome}</strong> ({trocaHierarquiaAlvo.funcao} - {trocaHierarquiaAlvo.setor}) irá trocar de posição?<br/>
                <span style={{ fontSize: 11, color: "#888" }}>O nome e as férias se mantêm com cada pessoa, apenas o cargo, setor, e a ordem da escala base são invertidos.</span>
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {funcionarios
                  .filter((f) => f.id !== trocaHierarquiaAlvo.id && f.unidade === trocaHierarquiaAlvo.unidade)
                  .map((cand) => (
                    <div key={cand.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "10px 12px", background: "#fff", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: "bold", fontSize: 12, color: "#111" }}>{cand.nome}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {cand.funcao} ({cand.setor})<br/>
                        Turno: {cand.turno}
                      </div>
                      <button onClick={() => executarTrocaHierarquia(cand)} style={{ ...S.btn, background: "#111", color: "#fff", border: "none", marginTop: 4 }}>
                        Trocar com {cand.nome.split(" ")[0]}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ ESCALA ════ */}
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
                {[["#000","Folga"],["#888","Folga Adicional"],["#fff","Trabalho"],["#166534","Férias"]].map(([bg, lb]) => (
                  <div key={lb} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: bg, border: "1px solid #999" }} />{lb}
                  </div>
                ))}
                <span style={{ fontSize: 10, color: "#aaa" }}>Clique: alterna · Clique dir. em folga: trocar</span>
              </div>
            </div>

            {modoLimpeza && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>🧹 Modo de Limpeza:</span>
                <span style={{ fontSize: 12, color: "#7f1d1d" }}>Selecione os funcionários (ou clique no setor) para remover todas as folgas ("F" e "A").</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={confirmarLimpeza} style={{ ...S.btn, backgroundColor: "#dc2626", color: "#fff", borderColor: "#dc2626" }}>Confirmar ({selecsLimpeza.size})</button>
                  <button onClick={() => { setSelecsLimpeza(new Set()); setModoLimpeza(false); }} style={{ ...S.btn, color: "#555" }}>Cancelar</button>
                </div>
              </div>
            )}

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
                                  <th style={{ ...S.thSetor, width: 180, cursor: modoLimpeza ? "pointer" : "default" }}
                                      onClick={() => modoLimpeza && toggleLimpezaSetor(lista)}
                                      title={modoLimpeza ? "Clique para selecionar todo o setor" : ""}>
                                    {setor} {modoLimpeza && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: "normal" }}><br/>[Selecionar Todos]</span>}
                                  </th>
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
                                        <td style={{ ...S.tdNome, color: "#888", fontSize: 10, fontStyle: "italic" }}>
                                          CARGO VAGO — {func.funcao}
                                        </td>
                                        {diasLista.map((d) => <td key={d} style={{ ...S.tdDia, background: "#ddd" }} />)}
                                      </tr>
                                    );
                                  }

                                  const fspan  = getFeriasSpan(func);
                                  const fLabel = getFeriasLabel(func);
                                  const turnoColor = func.turno === "MANHÃ" ? "#1e40af" : "#92400e";
                                  const emRevisao = escala[func.id]?.R;
                                  const emLimpeza = selecsLimpeza.has(func.id);
                                  
                                  const trBg = emLimpeza ? "#fee2e2" : emRevisao ? "#fef08a" : "transparent";

                                  return (
                                    <tr key={func.id} style={{ background: trBg, transition: "background 0.2s" }}>
                                      <td style={{ ...S.tdNome, cursor: "pointer" }} 
                                          onClick={() => {
                                            if (modoLimpeza) {
                                              setSelecsLimpeza((prev) => { const n = new Set(prev); n.has(func.id) ? n.delete(func.id) : n.add(func.id); return n; });
                                            } else {
                                              toggleRevisar(func.id);
                                            }
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            if (!modoLimpeza) abrirTrocaHierarquia(func);
                                          }}
                                          title={modoLimpeza ? "Selecionar para limpeza" : "Clique esquerdo: marcar para revisão. Clique direito: trocar hierarquia"}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                          {modoLimpeza && (
                                            <input type="checkbox" checked={emLimpeza} readOnly style={{ margin: 0, cursor: "pointer" }} />
                                          )}
                                          {!modoLimpeza && emRevisao && <span className="no-print" style={{ fontSize: 10 }} title="Marcado para revisão">⚠️</span>}
                                          <span className="print-hide" style={{ display: "inline-block", background: turnoColor, color: "#fff", fontSize: 7, fontWeight: 700, borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>
                                            {func.turno === "MANHÃ" ? "M" : func.turno === "TARDE" ? "T" : (func.turno || "").charAt(0)}
                                          </span>
                                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{func.nome}</span>
                                          <span className="print-hide">{badgeRegime(func)}</span>
                                          {func.ferias && (
                                            <span className="no-print" onClick={() => setFeriasModal(func)} title="Editar férias"
                                              style={{ cursor: "pointer", fontSize: 9, color: "#166534", flexShrink: 0 }}>🌴</span>
                                          )}
                                        </div>
                                        <div className="print-hide" style={{ fontSize: 8, color: "#888", marginTop: 1, paddingLeft: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {func.funcao}
                                        </div>
                                      </td>

                                      {diasLista.map((d) => {
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
                                        
                                        const getCellBg = () => {
                                          if (emLimpeza) return "transparent";
                                          if (v === "ADM" || v === "LM") return "#000";
                                          if (emRevisao) {
                                            if (v === "F") return "#4a4a10";
                                            if (v === "A") return "#a3a360";
                                            return "transparent";
                                          }
                                          return v === "F" ? "#000" : v === "A" ? "#888" : "#fff";
                                        };

                                        return (
                                          <td key={d}
                                            style={{ ...S.tdDia, background: getCellBg(), color: (v === "ADM" || v === "LM") ? "#fff" : "inherit", fontSize: (v === "ADM" || v === "LM") ? 8 : "inherit", fontWeight: (v === "ADM" || v === "LM") ? "bold" : "normal", cursor: modoLimpeza ? "default" : "pointer" }}
                                            onClick={() => !modoLimpeza && v !== "V" && v !== "ADM" && v !== "LM" && alternar(func.id, d)}
                                            onContextMenu={(e) => { e.preventDefault(); if (!modoLimpeza && (v === "F" || v === "A")) abrirTroca(func, d); }}
                                            title={v === "ADM" ? "Bloqueado antes da Admissão" : v === "LM" ? "Licença Maternidade" : v === "F" ? "Folga — clique dir. p/ trocar" : v === "A" ? "Folga Adicional — clique dir. p/ trocar" : dow === 0 ? "Dom — clique p/ intervalo" : "Trabalho"}>
                                            {v === "ADM" && "ADM"}
                                            {v === "LM" && "LM"}
                                            {dow === 0 && v === "T" && (
                                              <span onClick={(ev) => { ev.stopPropagation(); !modoLimpeza && alternarIntervalo(func.id, d); }}
                                                title="Clique para alternar o intervalo de domingo"
                                                style={{ fontSize: 9, fontWeight: 700, color: intv ? "#15803d" : "#ccc", cursor: modoLimpeza ? "default" : "pointer", display: "inline-block", textAlign: "center", minWidth: 16, minHeight: 14, lineHeight: "14px", background: intv ? "#dcfce7" : "transparent", borderRadius: 3, marginTop: 2 }}>
                                                {intv || "·"}
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
    </>
  );
}

// ───────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────
// MODAL AFASTAMENTOS (Férias, LM, ADM)
// ───────────────────────────────────────────────────────────────────
function AfastamentoModal({ func, onSalvar, onFechar }) {
  const [tipo, setTipo]     = useState(func.ferias?.tipo || "F");
  const [inicio, setInicio] = useState(func.ferias?.inicio || "");
  const [fim, setFim]       = useState(func.ferias?.fim || "");

  const titulo = tipo === "F" ? "🌴 Férias" : tipo === "LM" ? "👶 Licença Maternidade" : "🏢 Admissão";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: "1.5rem", width: 360, boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{titulo} — {func.nome}</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>
          {tipo === "ADM" ? "Defina a data de admissão. Dias anteriores serão bloqueados." : "Período completo (pode incluir dias fora do mês atual)."}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #999" }}>
              <option value="F">Férias</option>
              <option value="LM">Licença Maternidade</option>
              <option value="ADM">Admissão (Meio do Mês)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>{tipo === "ADM" ? "Data de Admissão" : "Data de Início"}</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
              style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #999", boxSizing: "border-box" }} />
          </div>
          {tipo !== "ADM" && (
            <div>
              <label style={{ fontSize: 12, color: "#555", display: "block", marginBottom: 4 }}>Data de Término</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
                style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #999", boxSizing: "border-box" }} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onFechar} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid #999", background: "#f9fafb", cursor: "pointer" }}>Cancelar</button>
          <button disabled={!inicio || (tipo !== "ADM" && (!fim || inicio > fim))}
            onClick={() => onSalvar(func.id, tipo, inicio, fim)}
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", background: "#166534", color: "#fff", cursor: "pointer", opacity: (!inicio || (tipo !== "ADM" && (!fim || inicio > fim))) ? 0.5 : 1 }}>
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
  grid3:     { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 },
  alertCard: { borderLeft: "4px solid #CC0000", background: "#fafafa", borderRadius: 5, padding: "9px 12px", marginBottom: 7 },
  lojaH:     { background: "#000", color: "#fff", fontWeight: 700, fontSize: 13, padding: "7px 12px", textAlign: "center", letterSpacing: ".06em" },
  thSetor:   { background: "#000", color: "#fff", fontWeight: 700, fontSize: 10, padding: "5px 6px", textAlign: "center", border: "1px solid #333", position: "sticky", left: 0, zIndex: 1 },
  thDia:     { padding: "2px 1px", border: "1px solid #999", textAlign: "center", fontWeight: 600 },
  tdNome:    { padding: "3px 6px", border: "1px solid #999", fontWeight: 400, fontSize: 10.5, maxWidth: 180, background: "#fff", position: "sticky", left: 0, zIndex: 0 },
  tdDia:     { padding: 0, border: "1px solid #999", height: 22, textAlign: "center" },
};
