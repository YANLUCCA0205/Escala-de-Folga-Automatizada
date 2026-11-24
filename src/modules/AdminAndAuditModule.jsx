// =============================================================================
// ADMINISTRAÇÃO, OPERADORES AUTORIZADOS, PERMISSÕES RBAC E AUDITORIA VERIFICADA
// Versão 8.0 — Distingue sessões nominais reais, seeds de migração e logs legados
// =============================================================================

import { useState } from "react";
import {
  PERMISSIONS_BY_ROLE,
  canSimulateRbacRole,
  registerOperatorAccount,
  removeLocalAuthAccount,
} from "../services/erpRepository.js";
import { buildInitialErpDatabase } from "../domain/seedLoja03.js";
import { createUniaoModuleUi } from "../theme/uniaoTheme.js";

const VERIFICATION_BADGES = {
  VERIFIED_SUPABASE_AUTH: {
    label: "✓ Autenticado (Supabase Auth)",
    bg: "#dcfce7",
    color: "#166534",
  },
  VERIFIED_LOCAL_AUTH: {
    label: "✓ Conta Autenticada (Senha)",
    bg: "#dcfce7",
    color: "#166534",
  },
  VERIFIED_OPERATOR_SESSION: {
    label: "✓ Operador Nominal Identificado",
    bg: "#dbeafe",
    color: "#1e40af",
  },
  VERIFIED_SESSION: {
    label: "✓ Sessão Verificada",
    bg: "#dcfce7",
    color: "#166534",
  },
  SYSTEM_SEED: {
    label: "⚙ Migração / Seed Oficial",
    bg: "#f1f5f9",
    color: "#475569",
  },
  AUTORIA_NAO_VERIFICADA_LEGADO: {
    label: "⚠ AUTORIA NÃO VERIFICADA (LEGADO v7)",
    bg: "#fef3c7",
    color: "#92400e",
  },
};

export default function AdminAndAuditModule({
  db,
  sessao,
  currentUserRole,
  setCurrentUserRole,
  onMutateDb,
  onResetToSeed,
}) {
  const [filterModule, setFilterModule] = useState("");
  const [filterVerification, setFilterVerification] = useState("ALL");
  const isOriginalAdmin = canSimulateRbacRole(sessao);

  // Formulário de cadastro/edição de Operadores Autorizados (userProfiles)
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [opEmail, setOpEmail] = useState("");
  const [opName, setOpName] = useState("");
  const [opPassword, setOpPassword] = useState("");
  const [opRole, setOpRole] = useState("MANAGER");
  const [opUnits, setOpUnits] = useState(["LOJA_03"]);

  const filteredLogs = (db.auditLogs || []).filter((l) => {
    if (filterModule && l.module !== filterModule) return false;
    if (filterVerification !== "ALL" && l.authVerificationStatus !== filterVerification) {
      return false;
    }
    return true;
  });

  const handleExportFullBackup = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute(
      "download",
      `backup-erp-v8-quadro-escalas-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSaveOperatorProfile = async () => {
    if (!opEmail.trim() || !opName.trim()) return;
    const cleanEmail = opEmail.trim().toLowerCase();

    if (opPassword.trim().length >= 4) {
      try {
        await registerOperatorAccount({
          email: cleanEmail,
          password: opPassword.trim(),
          fullName: opName.trim(),
          roleProfile: opRole,
          units: opUnits.map((id) => ({ id })),
          userProfiles: db.userProfiles || [],
        });
      } catch {
        // Segue com a gravação no banco
      }
    }

    onMutateDb({
      permission: "MANAGE_USERS",
      module: "ADMIN_RBAC",
      action: editingProfileId ? "ATUALIZAR_PERFIL_OPERADOR" : "CRIAR_PERFIL_OPERADOR",
      entityType: "USER_PROFILE",
      entityId: editingProfileId || cleanEmail,
      summary: `${editingProfileId ? "Atualizado" : "Cadastrado"} operador ${opName.trim()} (${cleanEmail}) com perfil ${opRole} e unidades [${opUnits.join(", ")}].`,
      updater: (draft) => {
        if (!draft.userProfiles) draft.userProfiles = [];
        if (editingProfileId) {
          const idx = draft.userProfiles.findIndex((u) => u.id === editingProfileId);
          if (idx >= 0) {
            draft.userProfiles[idx] = {
              ...draft.userProfiles[idx],
              email: cleanEmail,
              fullName: opName.trim(),
              roleProfile: opRole,
              authorizedUnits: opUnits,
            };
          }
        } else {
          draft.userProfiles.push({
            id: `USR_${Date.now()}`,
            email: cleanEmail,
            fullName: opName.trim(),
            roleProfile: opRole,
            authorizedUnits: opUnits,
            active: true,
          });
        }
      },
    });
    setEditingProfileId(null);
    setOpEmail("");
    setOpName("");
    setOpPassword("");
    setOpRole("MANAGER");
    setOpUnits(["LOJA_03"]);
  };

  const handleDeleteOperatorProfile = (up) => {
    if (!up) return;
    removeLocalAuthAccount(up.email);
    onMutateDb({
      permission: "MANAGE_USERS",
      module: "ADMIN_RBAC",
      action: "EXCLUIR_PERFIL_OPERADOR",
      entityType: "USER_PROFILE",
      entityId: up.id,
      summary: `Excluído operador ${up.fullName} (${up.email}) do cadastro de acesso.`,
      updater: (draft) => {
        draft.userProfiles = (draft.userProfiles || []).filter((u) => u.id !== up.id);
      },
    });
    if (editingProfileId === up.id) {
      setEditingProfileId(null);
      setOpEmail("");
      setOpName("");
      setOpPassword("");
    }
  };

  const toggleUnitInForm = (unitId) => {
    setOpUnits((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Controle de Perfil RBAC, Simulação Controlada e Backup */}
      <div style={ui.card}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={ui.cardTitle}>
              🔐 Controle de Acesso, Simulação de Perfil (RBAC) e Backup
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Operador autenticado: <strong>{sessao?.user?.fullName || sessao?.user?.email}</strong> ({sessao?.user?.email}) · Revisão de Banco: <strong>#{db.schemaRevision || 1}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {isOriginalAdmin ? (
              <select
                value={currentUserRole}
                onChange={(e) => setCurrentUserRole(e.target.value)}
                style={ui.select}
                title="Simulação de Perfil RBAC (Exclusivo para Sessão Original ADMIN)"
              >
                <option value="ADMIN">Simular Perfil: ADMIN (Acesso Total)</option>
                <option value="MANAGER">Simular Perfil: MANAGER (Gestor de Unidade)</option>
                <option value="OPERATOR">Simular Perfil: OPERATOR (Operação de Escalas)</option>
                <option value="VIEWER">Simular Perfil: VIEWER (Somente Leitura / BI)</option>
              </select>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>
                  Perfil Ativo: {currentUserRole} (Simulador restrito a ADMIN)
                </span>
              </div>
            )}

            <button onClick={handleExportFullBackup} style={ui.btnSecondary}>
              💾 Exportar Backup Completo (JSON)
            </button>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Restaurar a base padrão da Loja 03 (Outubro e Novembro/2026) a partir da planilha de referência?"
                  )
                ) {
                  onResetToSeed(buildInitialErpDatabase());
                }
              }}
              style={{ ...ui.btnSecondary, color: "#991b1b", borderColor: "#fca5a5" }}
            >
              🔄 Restaurar Base Oficial Loja 03
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(PERMISSIONS_BY_ROLE[currentUserRole] || []).map((perm) => (
            <span
              key={perm}
              style={{
                background: "#dcfce7",
                color: "#166534",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              ✓ {perm}
            </span>
          ))}
        </div>
      </div>

      {/* Gestão de Operadores e Unidades Autorizadas */}
      <div style={ui.card}>
        <div style={ui.cardTitle}>
          👥 Cadastro de Operadores e Autorização por Unidade (Lojas)
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
          Defina quais operadores têm acesso a quais unidades (`LOJA 03`, `LOJA 01`, `LOJA 02`) e seus respectivos perfis.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1.1fr 0.9fr 0.8fr 1.4fr auto",
            gap: 10,
            alignItems: "end",
            background: "#f8fafc",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            marginBottom: 14,
          }}
        >
          <div>
            <label style={ui.label}>Nome do Operador</label>
            <input
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              placeholder="Ex: Maria Silva (Gerente Loja 03)"
              style={ui.input}
            />
          </div>
          <div>
            <label style={ui.label}>E-mail Corporativo</label>
            <input
              value={opEmail}
              onChange={(e) => setOpEmail(e.target.value)}
              placeholder="maria.silva@uniaosupermercados.com.br"
              style={ui.input}
            />
          </div>
          <div>
            <label style={ui.label}>Senha (Opcional)</label>
            <input
              type="password"
              value={opPassword}
              onChange={(e) => setOpPassword(e.target.value)}
              placeholder="Definir senha..."
              style={ui.input}
            />
          </div>
          <div>
            <label style={ui.label}>Perfil RBAC</label>
            <select
              value={opRole}
              onChange={(e) => setOpRole(e.target.value)}
              style={{ ...ui.select, width: "100%" }}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="OPERATOR">OPERATOR</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>
          <div>
            <label style={ui.label}>Unidades Autorizadas</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
              {(db.units || []).map((u) => (
                <label
                  key={u.id}
                  style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={opUnits.includes(u.id)}
                    onChange={() => toggleUnitInForm(u.id)}
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleSaveOperatorProfile} style={ui.btnPrimary}>
              {editingProfileId ? "Salvar Edição" : "+ Cadastrar Operador"}
            </button>
            {editingProfileId && (
              <button
                onClick={() => {
                  setEditingProfileId(null);
                  setOpEmail("");
                  setOpName("");
                }}
                style={ui.btnSecondary}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>

        <table style={ui.table}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={ui.th}>Nome</th>
              <th style={ui.th}>E-mail</th>
              <th style={ui.th}>Perfil</th>
              <th style={ui.th}>Unidades Autorizadas</th>
              <th style={ui.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(db.userProfiles || []).map((up) => (
              <tr key={up.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...ui.td, fontWeight: 700 }}>{up.fullName}</td>
                <td style={ui.td}>{up.email}</td>
                <td style={{ ...ui.td, textAlign: "center", fontWeight: 700, color: "#0284c7" }}>
                  {up.roleProfile}
                </td>
                <td style={{ ...ui.td, textAlign: "center" }}>
                  {(up.authorizedUnits || []).join(", ")}
                </td>
                <td style={{ ...ui.td, textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                    <button
                      onClick={() => {
                        setEditingProfileId(up.id);
                        setOpName(up.fullName);
                        setOpEmail(up.email);
                        setOpPassword("");
                        setOpRole(up.roleProfile);
                        setOpUnits(up.authorizedUnits || ["LOJA_03"]);
                      }}
                      style={{ ...ui.btnSecondary, padding: "3px 8px", fontSize: 11 }}
                    >
                      ✏ Editar
                    </button>
                    <button
                      onClick={() => handleDeleteOperatorProfile(up)}
                      style={{
                        ...ui.btnSecondary,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: "#991b1b",
                        borderColor: "#fca5a5",
                      }}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trilha de Auditoria Imutável com Classificação de Verificação */}
      <div style={ui.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={ui.cardTitle}>
              📜 Trilha de Auditoria e Autenticidade ({filteredLogs.length} registros)
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>
              Registros gerados pelo antigo auto-login automático da v7 são sinalizados explicitamente como{" "}
              <strong>AUTORIA NÃO VERIFICADA (LEGADO v7)</strong>.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value)}
              style={ui.select}
            >
              <option value="ALL">Todas as Origens de Autenticação</option>
              <option value="VERIFIED_OPERATOR_SESSION">Operadores Nominais Identificados</option>
              <option value="VERIFIED_SUPABASE_AUTH">Supabase Auth Verificado</option>
              <option value="SYSTEM_SEED">Migração / Seed Inicial</option>
              <option value="AUTORIA_NAO_VERIFICADA_LEGADO">Legado Não Verificado (v7)</option>
            </select>

            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              style={ui.select}
            >
              <option value="">Todos os Módulos</option>
              <option value="ESCALA_MENSAL">ESCALA_MENSAL</option>
              <option value="ESTRUTURA_ORGANIZACIONAL">ESTRUTURA_ORGANIZACIONAL</option>
              <option value="QUADRO_DE_VAGAS">QUADRO_DE_VAGAS</option>
              <option value="COLABORADORES">COLABORADORES</option>
              <option value="DISPONIBILIDADE_FERIAS">DISPONIBILIDADE_FERIAS</option>
              <option value="CALENDARIO_MERCADO">CALENDARIO_MERCADO</option>
              <option value="MOTOR_DE_REGRAS">MOTOR_DE_REGRAS</option>
              <option value="ADMIN_RBAC">ADMIN_RBAC</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
          <table style={ui.table}>
            <thead>
              <tr style={{ background: "var(--uniao-table-header-bg, #2B5690)", color: "#fff" }}>
                <th style={ui.th}>Data / Hora</th>
                <th style={ui.th}>Operador / E-mail</th>
                <th style={ui.th}>Status de Verificação</th>
                <th style={ui.th}>Módulo / Operação</th>
                <th style={{ ...ui.th, textAlign: "left" }}>Descrição Auditada</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const badge =
                  VERIFICATION_BADGES[log.authVerificationStatus] ||
                  (log.actorEmail === "gestao.loja03@uniaosupermercados.com.br"
                    ? VERIFICATION_BADGES.AUTORIA_NAO_VERIFICADA_LEGADO
                    : VERIFICATION_BADGES.VERIFIED_SESSION);

                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11, whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>
                      <strong>{log.actorName || log.actorRole}</strong> ({log.actorRole})
                      <div style={{ color: "#64748b", fontSize: 10 }}>{log.actorEmail}</div>
                    </td>
                    <td style={{ ...ui.td, textAlign: "center" }}>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: "3px 7px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          display: "inline-block",
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...ui.td, textAlign: "center", fontSize: 11 }}>
                      <div style={{ fontWeight: 700 }}>{log.module}</div>
                      <div style={{ color: "#1d4ed8", fontSize: 10 }}>{log.action}</div>
                    </td>
                    <td style={{ ...ui.td, fontSize: 11.5 }}>{log.summary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const ui = createUniaoModuleUi({
  input: {
    width: "100%",
  },
});
