// =============================================================================
// ADMINISTRAÇÃO — USUÁRIOS E ACESSOS (Provisionamento MASTER e Governança)
// Tabela organizada + Painel Lateral (SidePanel) + Credenciais de Uso Único
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ROLE_HIERARCHY,
  ROLE_METADATA,
  PERMISSIONS_CATALOG,
  PERMISSIONS_BY_ROLE,
} from "../../services/erpRepository.js";
import {
  listManagedUsers,
  invokeAdminUsers,
} from "../../services/authService.js";
import {
  PageHeader,
  FilterBar,
  Button,
  Field,
  TextInput,
  Select,
  SearchInput,
  Badge,
  Alert,
  SidePanel,
  Dialog,
  ConfirmDialog,
  PopoverMenu,
  EmptyState,
} from "../../ui/index.jsx";

const STATUS_META = {
  ACTIVE: { label: "Ativa", tone: "success" },
  PENDING: { label: "Pendente de ativação", tone: "warning" },
  SUSPENDED: { label: "Suspensa", tone: "warning" },
  DEACTIVATED: { label: "Desativada", tone: "danger" },
};

export default function UsersAccessModule({
  units = [],
  currentUser,
  supabaseClient,
  onNotify,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  // Painel Lateral de Criação / Edição
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [extraPerms, setExtraPerms] = useState([]);
  const [deniedPerms, setDeniedPerms] = useState([]);
  const [deliveryMode, setDeliveryMode] = useState("temp_password");
  const [customPassword, setCustomPassword] = useState("");
  const [forceChangeOnFirstLogin, setForceChangeOnFirstLogin] = useState(false);
  const [showAdvancedPerms, setShowAdvancedPerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Exibição única de convite / senha temporária CSPRNG
  const [oneTimeSecretModal, setOneTimeSecretModal] = useState(null);

  // Confirmação de mudança de status / revogação / redefinição
  const [confirmState, setConfirmState] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await listManagedUsers(supabaseClient);
      setUsers(data);
    } catch (err) {
      setLoadError(err?.message || "Não foi possível carregar os operadores.");
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    let active = true;
    listManagedUsers(supabaseClient)
      .then((data) => {
        if (active) {
          setUsers(data);
          setLoadError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(err?.message || "Não foi possível carregar os operadores.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [supabaseClient]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (unitFilter && u.role !== "MASTER" && !(u.authorized_units || []).includes(unitFilter)) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = String(u.full_name || "").toLowerCase().includes(q);
        const matchEmail = String(u.email || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, unitFilter, search]);

  const activeFilterCount = [roleFilter, statusFilter, unitFilter].filter(Boolean).length;

  const openCreateDrawer = () => {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setRole("OPERATOR");
    setSelectedUnits(units[0] ? [units[0].id] : []);
    setExtraPerms([]);
    setDeniedPerms([]);
    setDeliveryMode("temp_password");
    setCustomPassword("");
    setForceChangeOnFirstLogin(false);
    setShowAdvancedPerms(false);
    setFormError("");
    setDrawerOpen(true);
  };

  const openEditDrawer = (u) => {
    setEditingUser(u);
    setFullName(u.full_name || "");
    setEmail(u.email || "");
    setRole(u.role || "OPERATOR");
    setSelectedUnits(u.authorized_units || []);
    setExtraPerms(u.extra_permissions || []);
    setDeniedPerms(u.denied_permissions || []);
    setShowAdvancedPerms(
      Boolean((u.extra_permissions || []).length || (u.denied_permissions || []).length)
    );
    setFormError("");
    setDrawerOpen(true);
  };

  const toggleUnit = (unitId) => {
    setSelectedUnits((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const togglePermOverride = (code, targetListSetter, oppositeSetter) => {
    oppositeSetter((prev) => prev.filter((c) => c !== code));
    targetListSetter((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setFormError("");
    if (fullName.trim().length < 3) {
      setFormError("Informe o nome completo do operador.");
      return;
    }
    if (role !== "MASTER" && selectedUnits.length === 0) {
      setFormError("Selecione pelo menos uma unidade operacional autorizada.");
      return;
    }
    if (!editingUser && deliveryMode === "custom_password" && customPassword.trim().length < 12) {
      setFormError("A senha definida manualmente deve possuir pelo menos 12 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        await invokeAdminUsers(
          {
            action: "update_profile",
            userId: editingUser.id,
            fullName: fullName.trim(),
            role,
            authorizedUnits: role === "MASTER" ? [] : selectedUnits,
            extraPermissions: extraPerms,
            deniedPermissions: deniedPerms,
          },
          supabaseClient
        );
        onNotify?.(`Permissões e escopo de ${fullName.trim()} atualizados.`, "ok");
      } else {
        const res = await invokeAdminUsers(
          {
            action: "invite",
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            role,
            authorizedUnits: role === "MASTER" ? [] : selectedUnits,
            extraPermissions: extraPerms,
            deniedPermissions: deniedPerms,
            deliveryMode,
            customPassword: deliveryMode === "custom_password" ? customPassword.trim() : undefined,
            mustChangePassword:
              deliveryMode === "custom_password" ? forceChangeOnFirstLogin : true,
          },
          supabaseClient
        );
        onNotify?.(`Conta pendente criada para ${fullName.trim()}.`, "ok");
        if (res.oneTimeInviteLink || res.oneTimeTempPassword) {
          setOneTimeSecretModal({
            title: "Credencial inicial de uso único",
            email: email.trim().toLowerCase(),
            link: res.oneTimeInviteLink,
            tempPassword: res.oneTimeTempPassword,
          });
        }
      }
      setDrawerOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err?.message || "Falha ao salvar operador.");
    } finally {
      setSubmitting(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmState) return;
    setActionBusy(true);
    try {
      if (confirmState.type === "status") {
        await invokeAdminUsers(
          {
            action: "set_status",
            userId: confirmState.user.id,
            status: confirmState.nextStatus,
            reason: confirmState.reason || "Alteração administrativa MASTER",
          },
          supabaseClient
        );
        onNotify?.(`Situação de ${confirmState.user.email} alterada para ${confirmState.nextStatus}.`, "ok");
      } else if (confirmState.type === "revoke") {
        const res = await invokeAdminUsers(
          { action: "revoke_sessions", userId: confirmState.user.id },
          supabaseClient
        );
        onNotify?.(
          `Sessões ativas encerradas (${res.revokedSessions || 0}) para ${confirmState.user.email}.`,
          "ok"
        );
      } else if (confirmState.type === "reset") {
        const res = await invokeAdminUsers(
          {
            action: "reset_credentials",
            userId: confirmState.user.id,
            deliveryMode: confirmState.deliveryMode || "recovery_link",
          },
          supabaseClient
        );
        onNotify?.(`Credenciais invalidadas para ${confirmState.user.email}.`, "ok");
        if (res.oneTimeRecoveryLink || res.oneTimeTempPassword) {
          setOneTimeSecretModal({
            title: "Redefinição administrativa de uso único",
            email: confirmState.user.email,
            link: res.oneTimeRecoveryLink,
            tempPassword: res.oneTimeTempPassword,
          });
        }
      }
      setConfirmState(null);
      await loadUsers();
    } catch (err) {
      onNotify?.(err?.message || "Não foi possível concluir a ação administrativa.", "err");
    } finally {
      setActionBusy(false);
    }
  };

  const operationalPerms = PERMISSIONS_CATALOG.filter((p) => !p.isGovernance);
  const roleDefaultPerms = new Set(PERMISSIONS_BY_ROLE[role] || []);

  return (
    <div>
      <PageHeader
        title="Usuários e acessos"
        subtitle="Provisionamento controlado de contas, definição de unidades autorizadas, revogação de sessões e ciclo de vida de operadores."
        meta={<Badge tone="brand">{users.length} contas registradas</Badge>}
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={loadUsers} disabled={loading}>
              Atualizar
            </Button>
            <Button variant="primary" icon="plus" onClick={openCreateDrawer}>
              Provisionar operador
            </Button>
          </>
        }
      />

      {loadError && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone="danger">{loadError}</Alert>
        </div>
      )}

      <FilterBar
        primaryFilters={
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Buscar por nome ou e-mail..."
            style={{ width: 280 }}
          />
        }
        advancedFilters={
          <>
            <Field label="Perfil">
              {(id) => (
                <Select id={id} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="">Todos os perfis</option>
                  {ROLE_HIERARCHY.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_METADATA[r].label} ({r})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Situação">
              {(id) => (
                <Select id={id} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Todas as situações</option>
                  <option value="ACTIVE">Ativa</option>
                  <option value="PENDING">Pendente de ativação</option>
                  <option value="SUSPENDED">Suspensa</option>
                  <option value="DEACTIVATED">Desativada</option>
                </Select>
              )}
            </Field>
            <Field label="Unidade autorizada">
              {(id) => (
                <Select id={id} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                  <option value="">Todas as unidades</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        }
        activeFilterCount={activeFilterCount}
        onClearFilters={() => {
          setRoleFilter("");
          setStatusFilter("");
          setUnitFilter("");
        }}
      />

      <div className="erp-table-wrap">
        {filteredUsers.length === 0 && !loading ? (
          <EmptyState
            icon="people"
            title="Nenhum operador encontrado"
            description="Ajuste os filtros aplicados ou provisione um novo operador autorizado."
          />
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil de acesso</th>
                <th>Unidades autorizadas</th>
                <th>Situação da conta</th>
                <th>Último acesso</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const roleMeta = ROLE_METADATA[u.role] || ROLE_METADATA.VIEWER;
                const statusMeta = STATUS_META[u.status] || { label: u.status, tone: "neutral" };
                const isSelf = currentUser?.id === u.id;

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                      {isSelf && (
                        <span style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>
                          Sua conta atual
                        </span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <Badge tone={u.role === "MASTER" ? "brand" : "neutral"}>
                        {roleMeta.label}
                      </Badge>
                    </td>
                    <td>
                      {u.role === "MASTER" ? (
                        <span style={{ fontSize: 12, color: "var(--erp-ink-secondary)" }}>
                          Todas as unidades (Governança)
                        </span>
                      ) : (u.authorized_units || []).length > 0 ? (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {u.authorized_units.map((uid) => (
                            <Badge key={uid} tone="neutral">
                              {units.find((x) => x.id === uid)?.name || uid}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge tone="danger">Sem unidades</Badge>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge tone={statusMeta.tone} dot>
                          {statusMeta.label}
                        </Badge>
                        {u.must_change_password && (
                          <Badge tone="warning">Troca de senha pendente</Badge>
                        )}
                        {u.mfa_enrolled && <Badge tone="info">MFA ativo</Badge>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--erp-ink-secondary)" }}>
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                        : "Nunca acessou"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <PopoverMenu
                        trigger={({ toggle }) => (
                          <Button variant="secondary" size="sm" icon="more" onClick={toggle}>
                            Gerenciar
                          </Button>
                        )}
                        items={[
                          {
                            id: "edit",
                            icon: "edit",
                            label: "Editar perfil e unidades",
                            disabled: isSelf,
                            onClick: () => openEditDrawer(u),
                          },
                          {
                            id: "reset_link",
                            icon: "key",
                            label:
                              u.status === "PENDING"
                                ? "Gerar novo link de convite"
                                : "Gerar link único de redefinição",
                            onClick: () =>
                              setConfirmState({
                                type: "reset",
                                deliveryMode: "recovery_link",
                                user: u,
                                title: "Emitir link de uso único",
                                description: `As sessões atuais de ${u.email} serão encerradas e a conta exigirá definição de nova senha.`,
                              }),
                          },
                          {
                            id: "reset_temp",
                            icon: "lock",
                            label: "Gerar senha temporária (uso único)",
                            onClick: () =>
                              setConfirmState({
                                type: "reset",
                                deliveryMode: "temp_password",
                                user: u,
                                title: "Emitir senha temporária criptográfica",
                                description: `Será gerada uma senha temporária de 20 caracteres com troca obrigatória no primeiro acesso de ${u.email}.`,
                              }),
                          },
                          {
                            id: "revoke",
                            icon: "logout",
                            label: "Encerrar sessões ativas",
                            onClick: () =>
                              setConfirmState({
                                type: "revoke",
                                user: u,
                                title: "Encerrar sessões do operador",
                                description: `Todas as sessões abertas de ${u.email} serão revogadas imediatamente.`,
                              }),
                          },
                          { separator: true },
                          ...(u.status === "ACTIVE"
                            ? [
                                {
                                  id: "suspend",
                                  icon: "lock",
                                  label: "Suspender acesso",
                                  disabled: isSelf,
                                  onClick: () =>
                                    setConfirmState({
                                      type: "status",
                                      nextStatus: "SUSPENDED",
                                      user: u,
                                      danger: true,
                                      title: "Suspender conta de operador",
                                      description: `O operador ${u.email} perderá imediatamente o acesso operacional até ser reativado.`,
                                    }),
                                },
                                {
                                  id: "deactivate",
                                  icon: "x",
                                  label: "Desativar conta",
                                  danger: true,
                                  disabled: isSelf,
                                  onClick: () =>
                                    setConfirmState({
                                      type: "status",
                                      nextStatus: "DEACTIVATED",
                                      user: u,
                                      danger: true,
                                      title: "Desativar conta permanentemente",
                                      description: `As sessões de ${u.email} serão revogadas e o login bloqueado. O histórico de auditoria é preservado.`,
                                    }),
                                },
                              ]
                            : u.status === "SUSPENDED" || u.status === "DEACTIVATED"
                              ? [
                                  {
                                    id: "reactivate",
                                    icon: "unlock",
                                    label: "Reativar conta",
                                    onClick: () =>
                                      setConfirmState({
                                        type: "status",
                                        nextStatus: "ACTIVE",
                                        user: u,
                                        title: "Reativar conta de operador",
                                        description: `Restaurar o acesso operacional de ${u.email} às unidades autorizadas?`,
                                      }),
                                  },
                                ]
                              : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PAINEL LATERAL DE PROVISIONAMENTO / EDIÇÃO */}
      <SidePanel
        open={drawerOpen}
        onClose={() => !submitting && setDrawerOpen(false)}
        title={editingUser ? "Editar acesso do operador" : "Provisionar novo operador"}
        subtitle={
          editingUser
            ? editingUser.email
            : "A conta nasce pendente de ativação até que o operador defina sua senha definitiva."
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDrawerOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveUser} loading={submitting}>
              {editingUser ? "Salvar alterações" : "Criar conta e emitir acesso"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {formError && <Alert tone="danger">{formError}</Alert>}

          <Field label="Nome completo" required>
            {(id) => (
              <TextInput
                id={id}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex.: Fernanda Costa"
                required
              />
            )}
          </Field>

          {!editingUser && (
            <Field label="E-mail corporativo nominal" required>
              {(id) => (
                <TextInput
                  id={id}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="fernanda.costa@uniaosupermercados.com.br"
                  required
                />
              )}
            </Field>
          )}

          <Field
            label="Perfil de acesso"
            required
            hint={ROLE_METADATA[role]?.description}
          >
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_HIERARCHY.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_METADATA[r].label} ({r})
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {role !== "MASTER" && (
            <Field
              label="Unidades operacionais autorizadas"
              required
              hint="O operador somente visualizará e editará registros das filiais marcadas."
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "10px 12px",
                  border: "1px solid var(--erp-border)",
                  borderRadius: 6,
                  background: "var(--erp-surface-subtle)",
                }}
              >
                {units.map((u) => (
                  <label
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "var(--erp-text-sm)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUnits.includes(u.id)}
                      onChange={() => toggleUnit(u.id)}
                    />
                    <strong>{u.name}</strong>
                    <span style={{ color: "var(--erp-ink-muted)", fontSize: 12 }}>
                      ({u.code}{u.city ? ` · ${u.city}` : ""})
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {!editingUser && (
            <>
              <Field
                label="Método seguro de entrega inicial"
                hint="Você pode gerar uma senha temporária automática ou definir diretamente a senha inicial do operador."
              >
                {(id) => (
                  <Select
                    id={id}
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value)}
                  >
                    <option value="temp_password">
                      Gerar senha temporária criptográfica (troca obrigatória no 1º acesso)
                    </option>
                    <option value="custom_password">
                      Definir senha inicial manualmente (conta já ativa para login)
                    </option>
                    <option value="invite_email">
                      Enviar convite oficial por e-mail (Supabase Auth)
                    </option>
                    <option value="invite_link">
                      Gerar link único de ativação (entrega manual sem SMTP)
                    </option>
                  </Select>
                )}
              </Field>

              {deliveryMode === "custom_password" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--erp-border)",
                    borderRadius: 6,
                    background: "var(--erp-surface-subtle)",
                  }}
                >
                  <Field
                    label="Senha inicial do operador"
                    required
                    hint="Mínimo de 12 caracteres (maiúsculas, minúsculas, números e símbolos)."
                  >
                    {(id) => (
                      <TextInput
                        id={id}
                        type="text"
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        placeholder="Ex.: Operador@Uniao2026!"
                        required
                      />
                    )}
                  </Field>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "var(--erp-text-xs)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={forceChangeOnFirstLogin}
                      onChange={(e) => setForceChangeOnFirstLogin(e.target.checked)}
                    />
                    <span>Exigir que o operador altere esta senha no primeiro acesso</span>
                  </label>
                </div>
              )}
            </>
          )}

          {role !== "MASTER" && (
            <div>
              <Button
                variant="tertiary"
                size="sm"
                icon={showAdvancedPerms ? "chevronDown" : "chevronRight"}
                onClick={() => setShowAdvancedPerms((v) => !v)}
              >
                Ajustes individuais de permissão (opcional)
              </Button>
              {showAdvancedPerms && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    border: "1px solid var(--erp-border)",
                    borderRadius: 6,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {operationalPerms.map((p) => {
                    const isDefault = roleDefaultPerms.has(p.code);
                    const isExtra = extraPerms.includes(p.code);
                    const isDenied = deniedPerms.includes(p.code);
                    return (
                      <div
                        key={p.code}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                        }}
                      >
                        <span>{p.label}</span>
                        {isDefault ? (
                          <button
                            type="button"
                            onClick={() =>
                              togglePermOverride(p.code, setDeniedPerms, setExtraPerms)
                            }
                            className={`erp-btn erp-btn--sm ${
                              isDenied ? "erp-btn--danger-outline" : "erp-btn--secondary"
                            }`}
                          >
                            {isDenied ? "Restringido" : "Padrão do perfil"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              togglePermOverride(p.code, setExtraPerms, setDeniedPerms)
                            }
                            className={`erp-btn erp-btn--sm ${
                              isExtra ? "erp-btn--primary" : "erp-btn--secondary"
                            }`}
                          >
                            {isExtra ? "Concedido" : "Não incluído"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </form>
      </SidePanel>

      {/* MODAL DE CREDENCIAL DE USO ÚNICO (EXIBIDA UMA ÚNICA VEZ) */}
      <Dialog
        open={Boolean(oneTimeSecretModal)}
        onClose={() => setOneTimeSecretModal(null)}
        title={oneTimeSecretModal?.title || "Credencial de uso único"}
        size="md"
        footer={
          <Button variant="primary" onClick={() => setOneTimeSecretModal(null)}>
            Já copiei e entreguei ao operador
          </Button>
        }
      >
        {oneTimeSecretModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Alert tone="warning" title="Exibição única">
              Por segurança, esta credencial não é armazenada em texto puro e não poderá ser
              recuperada após fechar esta janela. Entregue diretamente a{" "}
              <strong>{oneTimeSecretModal.email}</strong>.
            </Alert>

            {oneTimeSecretModal.link && (
              <Field label="Link seguro de ativação / redefinição">
                <div style={{ display: "flex", gap: 8 }}>
                  <TextInput readOnly value={oneTimeSecretModal.link} />
                  <Button
                    variant="secondary"
                    icon="copy"
                    onClick={() => navigator.clipboard?.writeText(oneTimeSecretModal.link)}
                  >
                    Copiar
                  </Button>
                </div>
              </Field>
            )}

            {oneTimeSecretModal.tempPassword && (
              <Field label="Senha temporária (troca obrigatória no primeiro acesso)">
                <div style={{ display: "flex", gap: 8 }}>
                  <TextInput
                    readOnly
                    value={oneTimeSecretModal.tempPassword}
                    style={{ fontFamily: "var(--erp-font-mono)", fontWeight: 700 }}
                  />
                  <Button
                    variant="secondary"
                    icon="copy"
                    onClick={() =>
                      navigator.clipboard?.writeText(oneTimeSecretModal.tempPassword)
                    }
                  >
                    Copiar
                  </Button>
                </div>
              </Field>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={executeConfirmedAction}
        title={confirmState?.title || "Confirmar operação"}
        description={confirmState?.description}
        danger={Boolean(confirmState?.danger)}
        confirmLabel="Confirmar"
        busy={actionBusy}
      />
    </div>
  );
}
