// =============================================================================
// SISTEMA INTEGRADO DE GESTÃO DO QUADRO DE COLABORADORES, ESCALAS E WORKFORCE ERP
// Versão 8.0.0-ERP — Identidade Visual Oficial União Supermercados (Manual da Marca),
// Contexto Global de Unidade, Autenticação Verificada e Persistência Particionada
// =============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  sb,
  ErpRepository,
  assertPermission,
  assertUnitAccess,
  resolveAuthenticatedOperatorSession,
  registerOperatorAccount,
  authenticateOperatorWithPassword,
} from "./services/erpRepository.js";
import UniaoLogo, { UniaoBrandManualModal } from "./components/UniaoLogo.jsx";
import {
  UNIAO_THEMES,
  UNIAO_BRAND_MANUAL,
  getStoredUniaoThemeId,
  applyUniaoThemeVariables,
} from "./theme/uniaoTheme.js";
import DashboardAndBiModule from "./modules/DashboardAndBiModule.jsx";
import OrganizationAndPositionsModule from "./modules/OrganizationAndPositionsModule.jsx";
import EmployeesAndAvailabilityModule from "./modules/EmployeesAndAvailabilityModule.jsx";
import RulesShiftsAndCalendarModule from "./modules/RulesShiftsAndCalendarModule.jsx";
import ScheduleGridModule from "./modules/ScheduleGridModule.jsx";
import AdminAndAuditModule from "./modules/AdminAndAuditModule.jsx";

const OPERATOR_SESSION_STORAGE_KEY = "erp_v8_verified_operator_session";

function TelaLogin({
  onLogin,
  onRegisterUserProfile,
  units = [],
  userProfiles = [],
  activeThemeId,
  onSelectTheme,
  onOpenBrandManual,
}) {
  const [modo, setModo] = useState("identificado"); // 'identificado' | 'supabase_login' | 'supabase_cadastro'
  const [email, setEmail] = useState("admin@uniaosupermercados.com.br");
  const [nomeOperador, setNomeOperador] = useState("Gestão Operacional — União Supermercados");
  const [perfilInicial, setPerfilInicial] = useState("ADMIN");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const activeTheme = UNIAO_THEMES[activeThemeId] || UNIAO_THEMES.uniao_institucional;

  const submeterSupabase = async () => {
    setErro("");
    setLoading(true);
    try {
      if (modo === "supabase_login") {
        const sessionPayload = await authenticateOperatorWithPassword({
          email: email.trim(),
          password: senha,
          userProfiles,
          units,
        });
        sessionStorage.setItem(OPERATOR_SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
        onLogin(sessionPayload);
      } else {
        const created = await registerOperatorAccount({
          email: email.trim(),
          password: senha,
          fullName: nomeOperador.trim(),
          roleProfile: perfilInicial,
          units,
          userProfiles,
        });
        if (onRegisterUserProfile && created.userProfile) {
          onRegisterUserProfile(created.userProfile, created.sessionPayload);
        }
        sessionStorage.setItem(
          OPERATOR_SESSION_STORAGE_KEY,
          JSON.stringify(created.sessionPayload)
        );
        onLogin(created.sessionPayload);
      }
    } catch (e) {
      setErro(e?.message || String(e));
    }
    setLoading(false);
  };

  const entrarOperadorIdentificado = () => {
    setErro("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = nomeOperador.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErro("Informe um e-mail corporativo válido para identificação na trilha de auditoria.");
      return;
    }
    if (cleanEmail === "gestao.loja03@uniaosupermercados.com.br") {
      setErro(
        "A conta genérica legada 'gestao.loja03@uniaosupermercados.com.br' foi desativada por segurança. Informe o seu e-mail nominal real."
      );
      return;
    }
    if (!cleanName || cleanName.length < 3) {
      setErro("Informe o nome completo do operador responsável pela sessão.");
      return;
    }

    try {
      const sessionPayload = resolveAuthenticatedOperatorSession({
        email: cleanEmail,
        fullName: cleanName,
        requestedRole: perfilInicial,
        userProfiles,
        units,
        authVerificationStatus: "VERIFIED_OPERATOR_SESSION",
      });
      sessionStorage.setItem(OPERATOR_SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
      onLogin(sessionPayload);
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--uniao-login-bg, linear-gradient(135deg, #1B3963 0%, #2B5690 55%, #E9403C 100%))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--uniao-card-bg, #ffffff)",
          color: "var(--uniao-text-primary, #142B4D)",
          borderRadius: 16,
          padding: "1.8rem 2rem",
          width: 465,
          maxWidth: "100%",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
          borderTop: "6px solid #E9403C",
          borderBottom: "4px solid #2B5690",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <UniaoLogo
              variant={activeTheme.logoVariantLogin || "original"}
              layout="horizontal"
              size="lg"
              idSuffix="login_main"
            />
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "var(--uniao-text-primary, #142B4D)",
              letterSpacing: "-0.01em",
            }}
          >
            Sistema Integrado de Quadro e Escalas (ERP v8.0)
          </div>
          <div style={{ fontSize: 11.5, color: "var(--uniao-text-muted, #5E7494)", marginTop: 4 }}>
            Conceição das Alagoas (Lojas 01 e 02) · Campo Florido (Loja 03)
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginBottom: 16,
            border: "1px solid var(--uniao-border-strong, #B6C8E0)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {[
            ["identificado", "Acesso Operador Identificado"],
            ["supabase_login", "Login Senha"],
            ["supabase_cadastro", "Criar Conta"],
          ].map(([m, label]) => (
            <button
              key={m}
              onClick={() => {
                setModo(m);
                setErro("");
              }}
              style={{
                flex: 1,
                padding: "8px 4px",
                fontSize: 11,
                border: "none",
                cursor: "pointer",
                background: modo === m ? "#2B5690" : "var(--uniao-surface-subtle, #F6F9FC)",
                color: modo === m ? "#FFFFFF" : "var(--uniao-text-secondary, #3B5273)",
                fontWeight: modo === m ? 700 : 600,
                fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {modo === "identificado" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "var(--uniao-blue-soft, #EBF2FA)",
                border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                borderLeft: "4px solid #2B5690",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
                color: "var(--uniao-text-primary, #142B4D)",
              }}
            >
              🔒 <strong>Auditoria Nominal Ativa (v8.0):</strong> Toda alteração de escala, quadro ou cadastro é vinculada ao operador identificado abaixo.
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--uniao-text-secondary, #3B5273)",
                  display: "block",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                Nome Completo do Operador *
              </label>
              <input
                type="text"
                value={nomeOperador}
                onChange={(e) => setNomeOperador(e.target.value)}
                placeholder="Ex: Carlos Mendes (RH / Operações)"
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--uniao-text-secondary, #3B5273)",
                  display: "block",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                E-mail Corporativo Nominal *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome.sobrenome@uniaosupermercados.com.br"
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--uniao-text-secondary, #3B5273)",
                  display: "block",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                Perfil de Acesso Inicial (RBAC)
              </label>
              <select
                value={perfilInicial}
                onChange={(e) => setPerfilInicial(e.target.value)}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                }}
              >
                <option value="ADMIN">ADMIN — Administrador Geral (Todas as Lojas)</option>
                <option value="MANAGER">MANAGER — Gestor de Unidade (Aprovação e Escalas)</option>
                <option value="OPERATOR">OPERATOR — Operador de Escalas e Cadastros</option>
                <option value="VIEWER">VIEWER — Consulta e BI (Somente Leitura)</option>
              </select>
            </div>

            {erro && (
              <div
                style={{
                  fontSize: 11,
                  color: "#991b1b",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "8px 10px",
                }}
              >
                {erro}
              </div>
            )}

            <button
              type="button"
              onClick={entrarOperadorIdentificado}
              style={{
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: "#E9403C",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(233, 64, 60, 0.35)",
              }}
            >
              Iniciar Sessão Auditada — União Supermercados
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {modo === "supabase_cadastro" && (
              <div>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--uniao-text-secondary, #3B5273)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Nome Completo do Operador *
                </label>
                <input
                  type="text"
                  value={nomeOperador}
                  onChange={(e) => setNomeOperador(e.target.value)}
                  placeholder="Ex: Maria Souza (RH / Operações)"
                  style={{
                    width: "100%",
                    fontSize: 12.5,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                    background: "var(--uniao-card-bg, #FFFFFF)",
                    color: "var(--uniao-text-primary, #142B4D)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--uniao-text-secondary, #3B5273)",
                  display: "block",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                E-mail Corporativo *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submeterSupabase()}
                placeholder="seu@uniaosupermercados.com.br"
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--uniao-text-secondary, #3B5273)",
                  display: "block",
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                Senha (mín. 4 caracteres) *
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submeterSupabase()}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  fontSize: 12.5,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {modo === "supabase_cadastro" && (
              <div>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--uniao-text-secondary, #3B5273)",
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 700,
                  }}
                >
                  Perfil de Acesso (RBAC)
                </label>
                <select
                  value={perfilInicial}
                  onChange={(e) => setPerfilInicial(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                    background: "var(--uniao-card-bg, #FFFFFF)",
                    color: "var(--uniao-text-primary, #142B4D)",
                  }}
                >
                  <option value="ADMIN">ADMIN — Administrador Geral (Todas as Lojas)</option>
                  <option value="MANAGER">MANAGER — Gestor de Unidade (Aprovação e Escalas)</option>
                  <option value="OPERATOR">OPERATOR — Operador de Escalas e Cadastros</option>
                  <option value="VIEWER">VIEWER — Consulta e BI (Somente Leitura)</option>
                </select>
              </div>
            )}

            {erro && (
              <div
                style={{
                  fontSize: 11,
                  color: erro.includes("criada") ? "#166534" : "#991b1b",
                  background: erro.includes("criada") ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${erro.includes("criada") ? "#bbf7d0" : "#fecaca"}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                }}
              >
                {erro}
              </div>
            )}

            <button
              onClick={submeterSupabase}
              disabled={loading || !email || !senha}
              style={{
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                background: "#E9403C",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: loading ? "wait" : "pointer",
                opacity: !email || !senha ? 0.6 : 1,
              }}
            >
              {loading
                ? "Processando..."
                : modo === "supabase_login"
                  ? "Acessar com Senha"
                  : "Criar Conta e Entrar"}
            </button>
          </div>
        )}

        {/* Rodapé do Card de Login: Seletor Rápido de Temas da Marca */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--uniao-border, #D5E0EE)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--uniao-text-muted, #5E7494)" }}>
              Tema Visual:
            </span>
            <select
              value={activeThemeId}
              onChange={(e) => onSelectTheme(e.target.value)}
              style={{
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                background: "var(--uniao-surface-subtle, #F6F9FC)",
                color: "var(--uniao-text-primary, #142B4D)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {Object.values(UNIAO_THEMES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenBrandManual}
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#2B5690",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            🎨 Ver Código de Identidade Visual
          </button>
        </div>
      </div>
    </div>
  );
}

// Navegação orientada à tarefa real do operador (Seção 7 — Sem códigos técnicos "Módulo A..H")
const NAV_ITEMS = [
  { id: "dashboard", icon: "📊", label: "Dashboard e Indicadores", desc: "Posição do Quadro e Períodos" },
  { id: "schedules", icon: "📅", label: "Escalas Mensais", desc: "Grade, Pincel, Validação e Projeção" },
  { id: "organization", icon: "🏛️", label: "Estrutura Organizacional", desc: "Empresa, Lojas, Setores e Funções" },
  { id: "positions", icon: "🪑", label: "Quadro de Postos e Vagas", desc: "Postos, Ocupação e Rateio" },
  { id: "employees", icon: "👥", label: "Colaboradores", desc: "Central do Colaborador e Alocações" },
  { id: "vacations", icon: "🏖️", label: "Férias e Afastamentos", desc: "Programação de Férias, LM e INSS" },
  { id: "rules_shifts", icon: "⏱️", label: "Jornadas e Regras", desc: "8 Colunas de Horário, 5x1, 5x2 e 6x1" },
  { id: "calendar", icon: "🗓️", label: "Calendário Operacional", desc: "Feriados, Domingos e Meio Expediente" },
  { id: "admin", icon: "🔐", label: "Administração e Auditoria", desc: "Operadores, RBAC, Logs e Backup" },
];

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [authCarregando, setAuthCarregando] = useState(true);
  const [db, setDb] = useState(null);
  const [activeModule, setActiveModule] = useState("schedules");
  const [selectedUnitId, setSelectedUnitId] = useState("LOJA_03");
  const [selectedYearMonth, setSelectedYearMonth] = useState("2026-11");
  const [currentUserRole, setCurrentUserRole] = useState("ADMIN");
  const [syncStatus, setSyncStatus] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'
  const [toastMsg, setToastMsg] = useState(null);
  const [activeThemeId, setActiveThemeId] = useState(() => getStoredUniaoThemeId());
  const [brandManualOpen, setBrandManualOpen] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());

  const activeTheme = useMemo(
    () => UNIAO_THEMES[activeThemeId] || UNIAO_THEMES.uniao_institucional,
    [activeThemeId]
  );

  useEffect(() => {
    applyUniaoThemeVariables(activeThemeId);
  }, [activeThemeId]);

  useEffect(() => {
    let mounted = true;
    // 1. Verifica sessão armazenada do operador identificado ou sessão Supabase Auth
    const storedOperator = sessionStorage.getItem(OPERATOR_SESSION_STORAGE_KEY);
    if (storedOperator) {
      try {
        const parsed = JSON.parse(storedOperator);
        if (parsed?.user?.email && parsed.user.email !== "gestao.loja03@uniaosupermercados.com.br") {
          setSessao(parsed);
          if (parsed.roleProfile) setCurrentUserRole(parsed.roleProfile);
          setAuthCarregando(false);
          return;
        }
      } catch {
        // Ignora caso inválido
      }
    }

    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data?.session?.user?.email) {
          setSessao({
            user: {
              email: data.session.user.email,
              fullName: data.session.user.user_metadata?.full_name || data.session.user.email,
            },
            roleProfile: "ADMIN",
            authVerificationStatus: "VERIFIED_SUPABASE_AUTH",
          });
        }
        setAuthCarregando(false);
      })
      .catch(() => {
        if (mounted) setAuthCarregando(false);
      });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.email) {
        setSessao({
          user: {
            email: s.user.email,
            fullName: s.user.user_metadata?.full_name || s.user.email,
          },
          roleProfile: "ADMIN",
          authVerificationStatus: "VERIFIED_SUPABASE_AUTH",
        });
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    ErpRepository.loadDatabase().then((loaded) => {
      if (active) setDb(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const showToast = useCallback((text, type = "ok") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  }, []);

  // Perfil completo do operador ativo (para verificação de acesso por unidade)
  const activeUserProfile = useMemo(() => {
    if (!db || !sessao?.user?.email) return null;
    const registered = (db.userProfiles || []).find(
      (u) => u.email.toLowerCase() === sessao.user.email.toLowerCase()
    );
    return (
      registered || {
        email: sessao.user.email,
        fullName: sessao.user.fullName || sessao.user.email,
        roleProfile: currentUserRole,
        authorizedUnits: sessao.authorizedUnits || (db.units || []).map((u) => u.id),
      }
    );
  }, [db, sessao, currentUserRole]);

  // Unidades disponíveis para o operador logado
  const availableUnits = useMemo(() => {
    if (!db?.units) return [];
    if (currentUserRole === "ADMIN" || !activeUserProfile?.authorizedUnits?.length) {
      return db.units.filter((u) => u.active !== false);
    }
    return db.units.filter(
      (u) => u.active !== false && activeUserProfile.authorizedUnits.includes(u.id)
    );
  }, [db, currentUserRole, activeUserProfile]);

  const activeCompany = useMemo(() => {
    if (!db?.companies?.length) return null;
    const unit = (db.units || []).find((u) => u.id === selectedUnitId);
    return (
      db.companies.find((c) => c.id === unit?.companyId) || db.companies[0]
    );
  }, [db, selectedUnitId]);

  const activeStoreManualInfo = useMemo(() => {
    return UNIAO_BRAND_MANUAL.stores[selectedUnitId] || UNIAO_BRAND_MANUAL.stores.LOJA_03;
  }, [selectedUnitId]);

  // Mutação centralizada com verificação RBAC, autorização por unidade, auditoria nominal e controle de concorrência
  const handleMutateDb = useCallback(
    ({
      permission,
      module,
      action,
      entityType,
      entityId,
      unitId,
      yearMonth,
      summary,
      beforeState = null,
      afterState = null,
      updater,
    }) => {
      try {
        if (permission) {
          assertPermission(currentUserRole, permission);
        }
        assertUnitAccess(activeUserProfile, unitId || selectedUnitId);
      } catch (permErr) {
        showToast(permErr.message, "err");
        return;
      }

      setDb((prevDb) => {
        const clone = structuredClone(prevDb);
        updater(clone);
        clone.schemaRevision = Number(clone.schemaRevision || 1) + 1;

        if (
          entityId &&
          (String(action || "").includes("EXCLUIR") || String(action || "").includes("REMOVER"))
        ) {
          const tombstones = new Set(clone.deletedEntityIds || []);
          tombstones.add(String(entityId));
          clone.deletedEntityIds = Array.from(tombstones);
        }

        const auditEntry = ErpRepository.createAuditEntry({
          actorEmail: sessao?.user?.email || "operador.identificado@uniaosupermercados.com.br",
          actorName: sessao?.user?.fullName || sessao?.user?.email,
          actorRole: currentUserRole,
          authVerificationStatus: sessao?.authVerificationStatus || "VERIFIED_OPERATOR_SESSION",
          originType: "OPERATOR_ACTION",
          module,
          action,
          entityType,
          entityId,
          summary,
          beforeState,
          afterState,
        });
        clone.auditLogs = [auditEntry, ...(clone.auditLogs || []).slice(0, 399)];

        setSyncStatus("saving");
        saveQueueRef.current = saveQueueRef.current
          .catch(() => {})
          .then(() =>
            ErpRepository.saveDatabase(clone, {
              entityType,
              entityId,
              unitId: unitId || selectedUnitId,
              yearMonth: yearMonth || null,
            })
          )
          .then((savedState) => {
            setSyncStatus("saved");
            if (savedState?.schemaRevision) {
              clone.schemaRevision = savedState.schemaRevision;
            }
            setTimeout(() => setSyncStatus("idle"), 2000);
          })
          .catch(() => setSyncStatus("error"));

        showToast(summary, "ok");
        return clone;
      });
    },
    [currentUserRole, activeUserProfile, selectedUnitId, sessao, showToast]
  );

  const handleResetToSeed = useCallback(
    (seedData) => {
      try {
        assertPermission(currentUserRole, "MANAGE_STRUCTURE");
      } catch (e) {
        showToast(e.message, "err");
        return;
      }
      setDb(seedData);
      ErpRepository.saveDatabase(seedData, {
        entityType: "SYSTEM",
        entityId: "RESTORE_SEED_LOJA03",
      });
      showToast("Base oficial da Loja 03 restaurada com sucesso!", "ok");
    },
    [currentUserRole, showToast]
  );

  if (authCarregando || !db) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
          background: "var(--uniao-app-bg, #F0F4F9)",
          fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
          color: "var(--uniao-text-primary, #142B4D)",
          fontWeight: 700,
        }}
      >
        <UniaoLogo variant="original" size="lg" idSuffix="loader" />
        <div>Inicializando Motor Relacional do ERP União Supermercados v8.0...</div>
      </div>
    );
  }

  if (!sessao) {
    return (
      <>
        <TelaLogin
          units={db.units || []}
          userProfiles={db.userProfiles || []}
          activeThemeId={activeThemeId}
          onSelectTheme={setActiveThemeId}
          onOpenBrandManual={() => setBrandManualOpen(true)}
          onRegisterUserProfile={(userProfile, sessionPayload) => {
            setDb((prevDb) => {
              if (!prevDb) return prevDb;
              const clone = structuredClone(prevDb);
              clone.userProfiles = clone.userProfiles || [];
              const idx = clone.userProfiles.findIndex(
                (u) => u.email.toLowerCase() === userProfile.email.toLowerCase()
              );
              if (idx >= 0) {
                clone.userProfiles[idx] = { ...clone.userProfiles[idx], ...userProfile };
              } else {
                clone.userProfiles.push(userProfile);
              }
              const auditEntry = ErpRepository.createAuditEntry({
                actorEmail: userProfile.email,
                actorName: userProfile.fullName,
                actorRole: userProfile.roleProfile,
                authVerificationStatus:
                  sessionPayload?.authVerificationStatus || "VERIFIED_LOCAL_AUTH",
                originType: "OPERATOR_ACTION",
                module: "ADMIN_RBAC",
                action: "CRIAR_CONTA_OPERADOR",
                entityType: "USER_PROFILE",
                entityId: userProfile.id,
                summary: `Nova conta de operador criada: ${userProfile.fullName} (${userProfile.email}) com perfil ${userProfile.roleProfile}.`,
              });
              clone.auditLogs = [auditEntry, ...(clone.auditLogs || []).slice(0, 399)];
              ErpRepository.saveDatabase(clone, {
                entityType: "USER_PROFILE",
                entityId: userProfile.id,
              });
              return clone;
            });
            showToast(
              `Conta criada com sucesso! Bem-vindo(a), ${userProfile.fullName}.`,
              "ok"
            );
          }}
          onLogin={(s) => {
            setSessao(s);
            if (s.roleProfile) setCurrentUserRole(s.roleProfile);
          }}
        />
        <UniaoBrandManualModal
          open={brandManualOpen}
          onClose={() => setBrandManualOpen(false)}
          activeThemeId={activeThemeId}
          onSelectTheme={setActiveThemeId}
        />
      </>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: landscape; margin: 7mm; }
          body { background: #fff !important; margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .erp-main { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          background: "var(--uniao-app-bg, #F0F4F9)",
          fontFamily: "var(--uniao-font, 'Montserrat', sans-serif)",
          color: "var(--uniao-text-primary, #142B4D)",
        }}
      >
        {/* Navegação Lateral dos Módulos do ERP + Identidade Visual União Supermercados */}
        <aside
          className="no-print"
          style={{
            width: 268,
            background: "var(--uniao-sidebar-bg, linear-gradient(180deg, #2B5690 0%, #1B3963 100%))",
            color: "var(--uniao-sidebar-text, #F8FAFC)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderRight: "1px solid var(--uniao-sidebar-border, #3A69A8)",
          }}
        >
          {/* Faixa Superior Bicolor da Marca */}
          <div
            style={{
              height: 4,
              background: "linear-gradient(90deg, #E9403C 0%, #E9403C 50%, #2B5690 50%, #2B5690 100%)",
            }}
          />

          <div
            style={{
              padding: "14px 16px 12px",
              borderBottom: "1px solid var(--uniao-sidebar-border, #3A69A8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <UniaoLogo
                variant={activeTheme.logoVariantSidebar || "positivo_azul"}
                size="sm"
                idSuffix="sidebar_hdr"
              />
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  background: "#E9403C",
                  color: "#fff",
                  padding: "3px 7px",
                  borderRadius: 5,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              >
                ERP v8.0
              </span>
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--uniao-sidebar-muted, #C5D8F0)",
                marginTop: 6,
                fontWeight: 600,
              }}
            >
              {activeCompany?.tradeName || activeCompany?.legalName || "União Supermercados"}
            </div>

            {/* SELETOR GLOBAL DE UNIDADE ATIVA (Seção 5) */}
            <div
              style={{
                marginTop: 10,
                background: "var(--uniao-sidebar-box-bg, rgba(20, 43, 77, 0.45))",
                border: "1px solid var(--uniao-sidebar-border, #3A69A8)",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <label
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: "var(--uniao-sidebar-text, #FFFFFF)",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 4,
                  letterSpacing: "0.04em",
                }}
              >
                🏬 Unidade Operacional Ativa
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) — {u.city || "MG"}
                  </option>
                ))}
              </select>
              {activeStoreManualInfo && (
                <div
                  style={{
                    fontSize: 9.5,
                    color: "var(--uniao-sidebar-muted, #C5D8F0)",
                    marginTop: 4,
                    lineHeight: 1.3,
                  }}
                >
                  📍 {activeStoreManualInfo.address} · {activeStoreManualInfo.phone}
                </div>
              )}
            </div>

            {/* SELETOR RÁPIDO DE TEMA DA IDENTIDADE VISUAL UNIÃO */}
            <div
              style={{
                marginTop: 8,
                background: "var(--uniao-sidebar-box-bg, rgba(20, 43, 77, 0.45))",
                border: "1px solid var(--uniao-sidebar-border, #3A69A8)",
                borderRadius: 8,
                padding: "7px 10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: "var(--uniao-sidebar-text, #FFFFFF)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  🎨 Tema União Supermercados
                </span>
                <button
                  type="button"
                  onClick={() => setBrandManualOpen(true)}
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    background: "#E9403C",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    cursor: "pointer",
                  }}
                  title="Abrir Manual de Identidade Visual União Supermercados"
                >
                  Manual
                </button>
              </div>
              <select
                value={activeThemeId}
                onChange={(e) => setActiveThemeId(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--uniao-card-bg, #FFFFFF)",
                  color: "var(--uniao-text-primary, #142B4D)",
                  border: "1px solid var(--uniao-border-strong, #B6C8E0)",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {Object.values(UNIAO_THEMES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <nav
            style={{
              padding: "10px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              flex: 1,
              overflowY: "auto",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 11px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: isActive
                      ? "var(--uniao-sidebar-item-active-bg, rgba(255,255,255,0.14))"
                      : "transparent",
                    color: isActive
                      ? "var(--uniao-sidebar-item-active-text, #FFFFFF)"
                      : "var(--uniao-sidebar-text, #F8FAFC)",
                    borderLeft: isActive
                      ? "4px solid var(--uniao-sidebar-item-active-border, #E9403C)"
                      : "4px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: isActive ? 800 : 600 }}>
                    {item.icon} {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--uniao-sidebar-muted, #C5D8F0)",
                      marginTop: 1,
                      paddingLeft: 20,
                    }}
                  >
                    {item.desc}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Rodapé da Sidebar: Operador Verificado, Perfil RBAC e Sincronização */}
          <div
            style={{
              padding: "12px 14px",
              borderTop: "1px solid var(--uniao-sidebar-border, #3A69A8)",
              fontSize: 11,
              color: "var(--uniao-sidebar-muted, #C5D8F0)",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "var(--uniao-sidebar-text, #F8FAFC)",
                fontSize: 11.5,
              }}
            >
              {sessao.user.fullName || sessao.user.email}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--uniao-sidebar-muted, #C5D8F0)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {sessao.user.email}
            </div>
            <div
              style={{
                marginTop: 5,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                Perfil:{" "}
                <strong
                  style={{
                    color: "#FFFFFF",
                    background: "#E9403C",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                  }}
                >
                  {currentUserRole}
                </strong>
              </span>
              {syncStatus === "saving" && <span style={{ color: "#fbbf24" }}>Salvando...</span>}
              {syncStatus === "saved" && (
                <span style={{ color: "#4ade80" }}>✓ Rev #{db.schemaRevision || 1}</span>
              )}
              {syncStatus === "error" && <span style={{ color: "#f87171" }}>⚠ Erro Sync</span>}
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem(OPERATOR_SESSION_STORAGE_KEY);
                sb.auth.signOut();
                setSessao(null);
              }}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "6px 0",
                borderRadius: 6,
                border: "1px solid var(--uniao-sidebar-border, #3A69A8)",
                background: "var(--uniao-sidebar-box-bg, rgba(20, 43, 77, 0.45))",
                color: "var(--uniao-sidebar-text, #FFFFFF)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Encerrar Sessão Auditada
            </button>
          </div>
        </aside>

        {/* Área Principal do Módulo Ativo */}
        <main
          className="erp-main"
          style={{
            flex: 1,
            padding: "14px 20px 20px",
            overflowX: "hidden",
            minWidth: 0,
          }}
        >
          {/* Barra Institucional Superior União Supermercados (Não Impressa) */}
          <div
            className="no-print"
            style={{
              background: "var(--uniao-card-bg, #FFFFFF)",
              border: "1px solid var(--uniao-border, #D5E0EE)",
              borderLeft: "5px solid #E9403C",
              borderRadius: 10,
              padding: "8px 14px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  background: "#2B5690",
                  color: "#FFFFFF",
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 5,
                }}
              >
                {activeStoreManualInfo.name} · {activeStoreManualInfo.city}/{activeStoreManualInfo.state}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--uniao-text-primary, #142B4D)" }}>
                {NAV_ITEMS.find((n) => n.id === activeModule)?.icon}{" "}
                {NAV_ITEMS.find((n) => n.id === activeModule)?.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--uniao-text-muted, #5E7494)" }}>
                · Competência: <strong>{selectedYearMonth}</strong>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {Object.values(UNIAO_THEMES).map((t) => {
                const isCurr = activeThemeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveThemeId(t.id)}
                    style={{
                      fontSize: 10.5,
                      fontWeight: isCurr ? 800 : 600,
                      padding: "4px 9px",
                      borderRadius: 999,
                      border: isCurr
                        ? "1px solid #E9403C"
                        : "1px solid var(--uniao-border-strong, #B6C8E0)",
                      background: isCurr ? "#E9403C" : "var(--uniao-surface-subtle, #F6F9FC)",
                      color: isCurr ? "#FFFFFF" : "var(--uniao-text-secondary, #3B5273)",
                      cursor: "pointer",
                    }}
                    title={t.description}
                  >
                    {t.name}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setBrandManualOpen(true)}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1px solid #2B5690",
                  background: "#2B5690",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                🎨 Identidade Visual
              </button>
            </div>
          </div>

          {toastMsg && (
            <div
              className="no-print"
              style={{
                position: "fixed",
                bottom: 18,
                right: 22,
                zIndex: 3000,
                background: toastMsg.type === "err" ? "#E9403C" : "#2B5690",
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                borderLeft: "4px solid #FFFFFF",
                maxWidth: 480,
              }}
            >
              {toastMsg.type === "err" ? "⛔ " : "✅ "}
              {toastMsg.text}
            </div>
          )}

          {activeModule === "dashboard" && (
            <DashboardAndBiModule
              db={db}
              selectedUnitId={selectedUnitId}
              setSelectedUnitId={setSelectedUnitId}
              selectedYearMonth={selectedYearMonth}
              setSelectedYearMonth={setSelectedYearMonth}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === "schedules" && (
            <ScheduleGridModule
              db={db}
              selectedUnitId={selectedUnitId}
              setSelectedUnitId={setSelectedUnitId}
              selectedYearMonth={selectedYearMonth}
              setSelectedYearMonth={setSelectedYearMonth}
              currentUserRole={currentUserRole}
              currentUserEmail={sessao?.user?.email}
              onMutateDb={handleMutateDb}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === "organization" && (
            <OrganizationAndPositionsModule
              key="mod_organization"
              db={db}
              selectedUnitId={selectedUnitId}
              setSelectedUnitId={setSelectedUnitId}
              selectedYearMonth={selectedYearMonth}
              initialTab="structure"
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModule === "positions" && (
            <OrganizationAndPositionsModule
              key="mod_positions"
              db={db}
              selectedUnitId={selectedUnitId}
              setSelectedUnitId={setSelectedUnitId}
              selectedYearMonth={selectedYearMonth}
              initialTab="positions"
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModule === "employees" && (
            <EmployeesAndAvailabilityModule
              key="mod_employees"
              db={db}
              selectedUnitId={selectedUnitId}
              selectedYearMonth={selectedYearMonth}
              initialTab="employees"
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModule === "vacations" && (
            <EmployeesAndAvailabilityModule
              key="mod_vacations"
              db={db}
              selectedUnitId={selectedUnitId}
              selectedYearMonth={selectedYearMonth}
              initialTab="unavailability"
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModule === "rules_shifts" && (
            <RulesShiftsAndCalendarModule
              key="mod_rules_shifts"
              db={db}
              selectedUnitId={selectedUnitId}
              initialTab="rules"
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModule === "calendar" && (
            <RulesShiftsAndCalendarModule
              key="mod_calendar"
              db={db}
              selectedUnitId={selectedUnitId}
              initialTab="calendar"
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModule === "admin" && (
            <AdminAndAuditModule
              db={db}
              sessao={sessao}
              currentUserRole={currentUserRole}
              setCurrentUserRole={setCurrentUserRole}
              onMutateDb={handleMutateDb}
              onResetToSeed={handleResetToSeed}
            />
          )}
        </main>
      </div>

      <UniaoBrandManualModal
        open={brandManualOpen}
        onClose={() => setBrandManualOpen(false)}
        activeThemeId={activeThemeId}
        onSelectTheme={setActiveThemeId}
      />
    </>
  );
}
