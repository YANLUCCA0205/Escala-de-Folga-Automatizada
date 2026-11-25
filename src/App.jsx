// =============================================================================
// WORKFORCE ERP UNIÃO SUPERMERCADOS — APLICAÇÃO PRINCIPAL (v9.0)
// Arquitetura desacoplada:
//   • Identidade, MFA e ciclo de acesso : src/services/authService.js + AuthPages.jsx
//   • Persistência particionada + RLS   : src/services/erpRepository.js + partitionCodec.js
//   • Layout global e Design System     : src/layout/AppShell.jsx + src/ui/*
// =============================================================================

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import UniaoLogo from "./components/UniaoLogo.jsx";
import {
  getStoredUniaoThemeId,
  applyUniaoThemeVariables,
  getStoredErpDensity,
  applyErpDensity,
} from "./theme/uniaoTheme.js";
import {
  ErpRepository,
  PERMISSIONS_BY_ROLE,
  assertPermission,
  assertUnitAccess,
  canSimulateRbacRole,
} from "./services/erpRepository.js";
import {
  APP_ENV_LABEL,
  getSupabaseClient,
  detectUrlAuthFlow,
  resolveAuthGateState,
  signInOperator,
  requestPasswordRecovery,
  setDefinitivePassword,
  startTotpEnrollment,
  verifyTotpFactor,
  signOutSecurely,
} from "./services/authService.js";
import {
  LoginPage,
  ForgotPasswordPage,
  SetPasswordPage,
  MfaEnrollPage,
  MfaVerifyPage,
  AccountBlockedPage,
  SessionExpiredPage,
  ServiceUnavailablePage,
} from "./features/auth/AuthPages.jsx";
import AppShell from "./layout/AppShell.jsx";
import {
  NAV_GROUPS,
  filterNavGroupsByPermissions,
  findNavItem,
} from "./layout/navigation.js";
const DashboardAndBiModule = lazy(() => import("./modules/DashboardAndBiModule.jsx"));
const ScheduleGridModule = lazy(() => import("./modules/ScheduleGridModule.jsx"));
const OrganizationAndPositionsModule = lazy(() =>
  import("./modules/OrganizationAndPositionsModule.jsx")
);
const EmployeesAndAvailabilityModule = lazy(() =>
  import("./modules/EmployeesAndAvailabilityModule.jsx")
);
const RulesShiftsAndCalendarModule = lazy(() =>
  import("./modules/RulesShiftsAndCalendarModule.jsx")
);
const AdminAndAuditModule = lazy(() => import("./modules/AdminAndAuditModule.jsx"));
import { Spinner, Alert } from "./ui/index.jsx";

export default function App() {
  const supabaseClient = useMemo(() => getSupabaseClient(), []);

  // Estado do portão de autenticação (fail-closed por padrão)
  const [authState, setAuthState] = useState({
    gate: "loading",
    profile: null,
    blockVariant: null,
  });
  const [authViewMode, setAuthViewMode] = useState("login"); // 'login' | 'forgot'
  const [authBusy, setAuthBusy] = useState(false);
  const [loginNotice, setLoginNotice] = useState(null);

  // Preferências visuais do operador (centralizadas nas configurações do usuário)
  const [themeId, setThemeId] = useState(() => getStoredUniaoThemeId());
  const [density, setDensity] = useState(() => getStoredErpDensity());

  // Estado operacional autorizado (carregado apenas após autenticação completa)
  const [db, setDb] = useState(null);
  const [settings, setSettings] = useState({});
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState("");
  const partitionsRef = useRef(new Map());
  const revisionsRef = useRef(new Map());
  const saveQueueRef = useRef(Promise.resolve());

  // Navegação e contexto global único de unidade
  const [activeNavId, setActiveNavId] = useState("schedules");
  const [selectedUnitId, setSelectedUnitId] = useState("LOJA_03");
  const [selectedYearMonth, setSelectedYearMonth] = useState("2026-11");
  const [previewRole, setPreviewRole] = useState(null); // estritamente visual (exclusivo MASTER)
  const [syncStatus, setSyncStatus] = useState("idle");
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    applyUniaoThemeVariables(themeId);
  }, [themeId]);

  useEffect(() => {
    applyErpDensity(density);
  }, [density]);

  const showToast = useCallback((text, type = "ok") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  }, []);

  const refreshAuthGate = useCallback(
    async (explicitFlow = null) => {
      const flow = explicitFlow || detectUrlAuthFlow();
      const next = await resolveAuthGateState(supabaseClient, { urlFlow: flow });
      setAuthState(next);
      return next;
    },
    [supabaseClient]
  );

  // Inicialização e assinatura de eventos de autenticação do Supabase
  useEffect(() => {
    let mounted = true;
    const initialFlow = detectUrlAuthFlow();

    resolveAuthGateState(supabaseClient, { urlFlow: initialFlow }).then((resolved) => {
      if (mounted) setAuthState(resolved);
    });

    if (!supabaseClient) return () => { mounted = false; };

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        resolveAuthGateState(supabaseClient, { urlFlow: "recovery" }).then((r) => {
          if (mounted) setAuthState(r);
        });
      } else if (event === "SIGNED_OUT") {
        setDb(null);
        partitionsRef.current = new Map();
        revisionsRef.current = new Map();
        setPreviewRole(null);
        setAuthState({ gate: "unauthenticated", profile: null, blockVariant: null });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabaseClient]);

  // Carrega partições autorizadas quando o portão liberar `authenticated`
  const reloadAuthorizedDatabase = useCallback(async () => {
    if (!supabaseClient) return;
    setDbLoading(true);
    setDbError("");
    try {
      const loaded = await ErpRepository.loadAuthorizedDatabase(supabaseClient);
      partitionsRef.current = loaded.partitionsMap;
      revisionsRef.current = loaded.revisionsByKey;
      setSettings(loaded.settings || {});
      setDb(loaded.db);
    } catch (err) {
      setDbError(err?.message || "Não foi possível carregar os dados autorizados.");
    } finally {
      setDbLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    if (authState.gate !== "authenticated") return;
    let active = true;
    ErpRepository.loadAuthorizedDatabase(supabaseClient)
      .then((loaded) => {
        if (!active) return;
        partitionsRef.current = loaded.partitionsMap;
        revisionsRef.current = loaded.revisionsByKey;
        setSettings(loaded.settings || {});
        setDb(loaded.db);
        setDbError("");
      })
      .catch((err) => {
        if (active) setDbError(err?.message || "Falha ao carregar partições.");
      });
    return () => {
      active = false;
    };
  }, [authState.gate, supabaseClient]);

  const activeProfile = authState.profile;

  // Unidades estritamente permitidas ao operador autenticado (vazio = nenhuma loja!)
  const availableUnits = useMemo(() => {
    if (!db?.units || !activeProfile) return [];
    const activeList = db.units.filter((u) => u.active !== false);
    if (activeProfile.role === "MASTER") return activeList;
    const allowedIds = Array.isArray(activeProfile.authorizedUnits)
      ? activeProfile.authorizedUnits
      : [];
    return activeList.filter((u) => allowedIds.includes(u.id));
  }, [db, activeProfile]);

  const effectiveUnitId = useMemo(() => {
    if (availableUnits.length === 0) return "";
    if (availableUnits.some((u) => u.id === selectedUnitId)) return selectedUnitId;
    return availableUnits[0].id;
  }, [availableUnits, selectedUnitId]);

  // Permissões visuais da navegação (respeitam previewRole apenas na UI para MASTER)
  const visualPermissions = useMemo(() => {
    if (!activeProfile) return [];
    if (previewRole && canSimulateRbacRole(activeProfile)) {
      return PERMISSIONS_BY_ROLE[previewRole] || [];
    }
    return activeProfile.permissions || [];
  }, [activeProfile, previewRole]);

  const authorizedNavGroups = useMemo(
    () => filterNavGroupsByPermissions(NAV_GROUPS, visualPermissions),
    [visualPermissions]
  );

  // Garante que o módulo ativo seja permitido pelas permissões visuais atuais
  const effectiveNavItem = useMemo(() => {
    const found = findNavItem(activeNavId, authorizedNavGroups);
    if (found) return found.item;
    return authorizedNavGroups[0]?.items?.[0] || null;
  }, [activeNavId, authorizedNavGroups]);

  // Notificações operacionais relevantes da unidade selecionada
  const notifications = useMemo(() => {
    if (!db || !effectiveUnitId) return [];
    const list = [];
    for (const ms of db.monthlySchedules || []) {
      if (ms.unitId === effectiveUnitId && ms.status === "IMPACTED_BY_PAST_CHANGE") {
        list.push({
          id: `imp_${ms.yearMonth}`,
          title: `Projeção impactada em ${ms.yearMonth}`,
          description: ms.impactWarning || "Edições em competência anterior exigem revisão.",
          targetItemId: "schedules",
        });
      }
    }
    const vacantUrgent = (db.workPositions || []).filter(
      (p) => p.unitId === effectiveUnitId && p.status === "OPEN_AUTHORIZED"
    ).length;
    if (vacantUrgent > 0) {
      list.push({
        id: "open_pos",
        title: `${vacantUrgent} posto(s) autorizado(s) em aberto`,
        description: "Consulte o quadro de postos e vagas da unidade ativa.",
        targetItemId: "positions",
      });
    }
    return list;
  }, [db, effectiveUnitId]);

  // Mutação centralizada: valida no cliente (defesa em profundidade) e grava via RPC `erp_save_batch`
  const handleMutateDb = useCallback(
    ({
      permission,
      module,
      action,
      entityType,
      entityId,
      unitId,
      summary,
      beforeState = null,
      afterState = null,
      updater,
    }) => {
      if (!activeProfile) return;
      const targetUnit = unitId || effectiveUnitId;

      try {
        if (permission) {
          assertPermission(activeProfile, permission);
        }
        if (targetUnit && module !== "ESTRUTURA_ORGANIZACIONAL" && module !== "MOTOR_DE_REGRAS") {
          assertUnitAccess(activeProfile, targetUnit);
        }
      } catch (permErr) {
        showToast(permErr.message, "err");
        return;
      }

      setDb((prevDb) => {
        if (!prevDb) return prevDb;
        const nextDb = structuredClone(prevDb);
        updater(nextDb);
        nextDb.schemaRevision = Number(nextDb.schemaRevision || 1) + 1;

        if (
          entityId &&
          (String(action || "").includes("EXCLUIR") || String(action || "").includes("REMOVER"))
        ) {
          const tombstones = new Set(nextDb.deletedEntityIds || []);
          tombstones.add(String(entityId));
          nextDb.deletedEntityIds = Array.from(tombstones);
        }

        setSyncStatus("saving");
        saveQueueRef.current = saveQueueRef.current
          .catch(() => {})
          .then(() =>
            ErpRepository.saveMutation({
              client: supabaseClient,
              prevPartitionsMap: partitionsRef.current,
              nextDb,
              revisionsByKey: revisionsRef.current,
              auditPayload: {
                module,
                action,
                entityType,
                entityId,
                unitId: targetUnit || null,
                summary,
                beforeState,
                afterState,
              },
            })
          )
          .then((saved) => {
            partitionsRef.current = saved.partitionsMap;
            revisionsRef.current = saved.revisionsByKey;
            setSyncStatus("saved");
            setTimeout(() => setSyncStatus("idle"), 2000);
          })
          .catch((saveErr) => {
            setSyncStatus("error");
            showToast(saveErr?.message || "Falha ao sincronizar com o servidor.", "err");
            if (saveErr?.code === "UNAUTHENTICATED") {
              setAuthState({ gate: "session_expired", profile: null, blockVariant: null });
            } else if (
              saveErr?.code === "REVISION_CONFLICT" ||
              saveErr?.code === "SCHEDULE_LOCKED" ||
              saveErr?.code === "FORBIDDEN" ||
              saveErr?.code === "FORBIDDEN_UNIT"
            ) {
              reloadAuthorizedDatabase();
            }
          });

        if (summary) showToast(summary, "ok");
        return nextDb;
      });
    },
    [activeProfile, effectiveUnitId, supabaseClient, showToast, reloadAuthorizedDatabase]
  );

  // Handlers de autenticação
  const handleSignIn = async (credentials) => {
    setAuthBusy(true);
    setLoginNotice(null);
    try {
      const res = await signInOperator(credentials, supabaseClient);
      if (res.serviceUnavailable && supabaseClient) {
        setAuthState({ gate: "service_unavailable", profile: null, blockVariant: null });
        return res;
      }
      if (res.ok && res.gate) {
        setAuthState({
          gate: res.gate,
          profile: res.profile || null,
          blockVariant: res.blockVariant || null,
        });
      }
      return res;
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async (email) => {
    setAuthBusy(true);
    try {
      return await requestPasswordRecovery(email, supabaseClient);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSetPassword = async (newPassword, mode) => {
    setAuthBusy(true);
    try {
      const res = await setDefinitivePassword(
        { newPassword, mode, profile: activeProfile },
        supabaseClient
      );
      if (res.ok && res.gate) {
        setAuthState({
          gate: res.gate,
          profile: res.profile || null,
          blockVariant: res.blockVariant || null,
        });
      }
      return res;
    } finally {
      setAuthBusy(false);
    }
  };

  const handleMfaVerify = async ({ factorId = null, code }) => {
    setAuthBusy(true);
    try {
      const res = await verifyTotpFactor({ factorId, code }, supabaseClient);
      if (res.ok && res.gate) {
        setAuthState({
          gate: res.gate,
          profile: res.profile || null,
          blockVariant: res.blockVariant || null,
        });
      }
      return res;
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutSecurely(supabaseClient);
    setDb(null);
    setPreviewRole(null);
    setAuthViewMode("login");
    setAuthState({ gate: "unauthenticated", profile: null, blockVariant: null });
  };

  // ---------------------------------------------------------------------------
  // RENDERIZAÇÃO DO PORTÃO DE IDENTIDADE E ACESSO
  // ---------------------------------------------------------------------------
  if (authState.gate === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "var(--erp-bg-canvas)",
          color: "var(--erp-ink)",
        }}
      >
        <UniaoLogo variant="original" size="md" idSuffix="boot" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
          <Spinner size={16} />
          <span>Verificando credenciais e sessão corporativa...</span>
        </div>
      </div>
    );
  }

  if (authState.gate === "service_unavailable") {
    return (
      <ServiceUnavailablePage
        environmentLabel={APP_ENV_LABEL}
        busy={authBusy}
        onRetry={async () => {
          setAuthBusy(true);
          await refreshAuthGate();
          setAuthBusy(false);
        }}
      />
    );
  }

  if (authState.gate === "session_expired") {
    return (
      <SessionExpiredPage
        environmentLabel={APP_ENV_LABEL}
        onContinue={() => {
          setLoginNotice("Sua sessão anterior expirou. Autentique-se novamente.");
          setAuthState({ gate: "unauthenticated", profile: null, blockVariant: null });
        }}
      />
    );
  }

  if (authState.gate === "account_blocked") {
    return (
      <AccountBlockedPage
        environmentLabel={APP_ENV_LABEL}
        variant={authState.blockVariant || "deactivated"}
        onSignOut={handleSignOut}
      />
    );
  }

  if (
    authState.gate === "set_password_invite" ||
    authState.gate === "set_password_recovery" ||
    authState.gate === "set_password_forced"
  ) {
    const modeMap = {
      set_password_invite: "invite",
      set_password_recovery: "recovery",
      set_password_forced: "forced",
    };
    const mode = modeMap[authState.gate];
    return (
      <SetPasswordPage
        environmentLabel={APP_ENV_LABEL}
        mode={mode}
        profile={activeProfile}
        busy={authBusy}
        onSubmit={(pwd) => handleSetPassword(pwd, mode)}
        onCancel={handleSignOut}
      />
    );
  }

  if (authState.gate === "mfa_enroll_required") {
    return (
      <MfaEnrollPage
        environmentLabel={APP_ENV_LABEL}
        onStart={() => startTotpEnrollment(supabaseClient)}
        onVerify={handleMfaVerify}
        onSignOut={handleSignOut}
        busy={authBusy}
      />
    );
  }

  if (authState.gate === "mfa_verify_required") {
    return (
      <MfaVerifyPage
        environmentLabel={APP_ENV_LABEL}
        onSubmit={handleMfaVerify}
        onSignOut={handleSignOut}
        busy={authBusy}
      />
    );
  }

  if (authState.gate !== "authenticated") {
    if (authViewMode === "forgot") {
      return (
        <ForgotPasswordPage
          environmentLabel={APP_ENV_LABEL}
          onSubmit={handleForgotPassword}
          onBack={() => setAuthViewMode("login")}
          busy={authBusy}
        />
      );
    }
    return (
      <LoginPage
        environmentLabel={APP_ENV_LABEL}
        onSubmit={handleSignIn}
        onForgotPassword={() => setAuthViewMode("forgot")}
        busy={authBusy}
        notice={loginNotice}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // AMBIENTE AUTENTICADO E AUTORIZADO
  // ---------------------------------------------------------------------------
  const activeModuleKey = effectiveNavItem?.moduleKey || "schedules";
  const activeParams = effectiveNavItem?.params || {};

  return (
    <AppShell
      navGroups={authorizedNavGroups}
      activeItemId={effectiveNavItem?.id || activeNavId}
      onNavigate={setActiveNavId}
      units={availableUnits}
      selectedUnitId={effectiveUnitId}
      onSelectUnit={setSelectedUnitId}
      selectedYearMonth={selectedYearMonth}
      user={activeProfile}
      previewRole={previewRole}
      onClearPreviewRole={() => setPreviewRole(null)}
      syncStatus={syncStatus}
      notifications={notifications}
      themeId={themeId}
      onChangeTheme={setThemeId}
      density={density}
      onChangeDensity={setDensity}
      maintenanceBanner={settings?.maintenance_mode}
      onSignOut={handleSignOut}
    >
      {toastMsg && (
        <div
          className="no-print"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 62,
            right: 22,
            zIndex: 3000,
            background: toastMsg.type === "err" ? "var(--erp-danger)" : "#0F1E36",
            color: "#FFFFFF",
            borderLeft: `4px solid ${toastMsg.type === "err" ? "#FCA5A5" : "#22C55E"}`,
            padding: "11px 16px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            lineHeight: 1.4,
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.28)",
            maxWidth: 480,
          }}
        >
          {toastMsg.text}
        </div>
      )}

      {dbError ? (
        <Alert tone="danger" title="Erro ao carregar dados operacionais">
          {dbError}
        </Alert>
      ) : !db || dbLoading ? (
        <div
          style={{
            padding: "48px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontSize: 13,
            color: "var(--erp-ink-muted)",
          }}
        >
          <Spinner size={16} />
          <span>Carregando partições autorizadas...</span>
        </div>
      ) : availableUnits.length === 0 && !activeModuleKey.startsWith("admin_") ? (
        <Alert tone="warning" title="Nenhuma unidade operacional vinculada">
          Sua conta não possui filiais autorizadas para consulta operacional. Solicite a atribuição
          de unidades ao administrador MASTER.
        </Alert>
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                padding: "36px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--erp-ink-muted)",
              }}
            >
              <Spinner size={16} />
              <span>Carregando módulo operacional...</span>
            </div>
          }
        >
          {activeModuleKey === "dashboard" && (
            <DashboardAndBiModule
              db={db}
              selectedUnitId={effectiveUnitId}
              selectedYearMonth={selectedYearMonth}
              setSelectedYearMonth={setSelectedYearMonth}
              onNavigate={setActiveNavId}
            />
          )}

          {activeModuleKey === "schedules" && (
            <ScheduleGridModule
              db={db}
              selectedUnitId={effectiveUnitId}
              selectedYearMonth={selectedYearMonth}
              setSelectedYearMonth={setSelectedYearMonth}
              currentUserRole={previewRole || activeProfile.role}
              currentUserEmail={activeProfile.email}
              syncStatus={syncStatus}
              onMutateDb={handleMutateDb}
              onNavigate={setActiveNavId}
            />
          )}

          {(activeModuleKey === "organization" || activeModuleKey === "positions") && (
            <OrganizationAndPositionsModule
              key={`org_${effectiveNavItem?.id || activeModuleKey}`}
              db={db}
              selectedUnitId={effectiveUnitId}
              setSelectedUnitId={setSelectedUnitId}
              selectedYearMonth={selectedYearMonth}
              initialTab={activeParams.initialTab || "positions"}
              initialSection={activeParams.section || null}
              onMutateDb={handleMutateDb}
            />
          )}

          {(activeModuleKey === "employees" || activeModuleKey === "vacations") && (
            <EmployeesAndAvailabilityModule
              key={`emp_${effectiveNavItem?.id || activeModuleKey}`}
              db={db}
              selectedUnitId={effectiveUnitId}
              selectedYearMonth={selectedYearMonth}
              initialTab={activeParams.initialTab || "employees"}
              onMutateDb={handleMutateDb}
            />
          )}

          {(activeModuleKey === "rules_shifts" || activeModuleKey === "calendar") && (
            <RulesShiftsAndCalendarModule
              key={`rul_${effectiveNavItem?.id || activeModuleKey}`}
              db={db}
              selectedUnitId={effectiveUnitId}
              initialTab={activeParams.initialTab || "rules"}
              onMutateDb={handleMutateDb}
            />
          )}

          {activeModuleKey.startsWith("admin_") && (
            <AdminAndAuditModule
              section={activeModuleKey}
              units={db.units || []}
              currentUser={activeProfile}
              permissions={activeProfile.permissions || []}
              previewRole={previewRole}
              onChangePreviewRole={setPreviewRole}
              settings={settings}
              onSettingsUpdated={setSettings}
              supabaseClient={supabaseClient}
              onReloadDatabase={reloadAuthorizedDatabase}
              onNotify={showToast}
            />
          )}
        </Suspense>
      )}
    </AppShell>
  );
}
