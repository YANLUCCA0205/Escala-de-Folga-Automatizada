// =============================================================================
// ADMINISTRAÇÃO — CONFIGURAÇÕES CRÍTICAS DE GOVERNANÇA (Exclusivo MASTER)
// Controle do Modo de Manutenção e verificação da postura de segurança ativa.
// =============================================================================

import { useState } from "react";
import { updateSystemSetting } from "../../services/authService.js";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Badge,
  Alert,
} from "../../ui/index.jsx";

export default function SystemSettingsModule({
  settings = {},
  supabaseClient,
  onSettingsUpdated,
  onNotify,
}) {
  const currentMaint = settings.maintenance_mode || { enabled: false, message: "" };
  const [enabled, setEnabled] = useState(Boolean(currentMaint.enabled));
  const [message, setMessage] = useState(currentMaint.message || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { enabled, message: message.trim() };
      await updateSystemSetting("maintenance_mode", payload, supabaseClient);
      onSettingsUpdated?.({ ...settings, maintenance_mode: payload });
      onNotify?.(
        enabled
          ? "Modo de manutenção ativado. Gravações de operadores foram bloqueadas."
          : "Modo de manutenção encerrado. Operação normal restabelecida.",
        "ok"
      );
    } catch (err) {
      onNotify?.(err?.message || "Falha ao atualizar configuração.", "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Configurações do sistema"
        subtitle="Parâmetros globais de governança e postura de segurança corporativa."
      />

      <form
        onSubmit={handleSave}
        className="erp-surface erp-surface-body"
        style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 680 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--erp-text-md)" }}>
              Modo de manutenção operacional
            </div>
            <div style={{ fontSize: "var(--erp-text-xs)", color: "var(--erp-ink-muted)" }}>
              Quando ativo, bloqueia gravações no banco para todos os perfis exceto MASTER.
            </div>
          </div>
          <Badge tone={enabled ? "danger" : "success"}>{enabled ? "Ativo" : "Operação normal"}</Badge>
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--erp-text-sm)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Bloquear temporariamente alterações de operadores (janela de manutenção)
        </label>

        <Field label="Mensagem exibida no cabeçalho global durante a manutenção">
          {(id) => (
            <TextInput
              id={id}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex.: Fechamento mensal de folha em andamento até 18h30."
            />
          )}
        </Field>

        <div>
          <Button type="submit" variant="primary" loading={saving}>
            Salvar parâmetros
          </Button>
        </div>
      </form>

      <div className="erp-surface erp-surface-body" style={{ maxWidth: 680 }}>
        <div style={{ fontWeight: 700, fontSize: "var(--erp-text-md)", marginBottom: 10 }}>
          Controles de segurança ativos nesta instalação
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <SecurityRow label="Cadastro público de contas" status="Desabilitado (GoTrue + RLS)" />
          <SecurityRow label="Autenticação multifator (TOTP) para MASTER" status="Obrigatória (aal2)" />
          <SecurityRow label="Isolamento de dados entre unidades" status="Partições por filial + RLS" />
          <SecurityRow label="Cache operacional e senhas em localStorage" status="Eliminados e expurgados" />
          <SecurityRow label="Trilha de auditoria" status="Imutável (append-only no PostgreSQL)" />
        </div>
      </div>

      <Alert tone="info" title="Proteção contra senhas vazadas (HaveIBeenPwned)">
        Certifique-se de manter a opção &quot;Prevent use of leaked passwords&quot; habilitada em{" "}
        <strong>Authentication → Providers → Email / Security</strong> no painel do Supabase em
        produção.
      </Alert>
    </div>
  );
}

function SecurityRow({ label, status }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        paddingBottom: 6,
        borderBottom: "1px solid var(--erp-border-subtle)",
      }}
    >
      <span style={{ color: "var(--erp-ink-secondary)" }}>{label}</span>
      <Badge tone="success">{status}</Badge>
    </div>
  );
}
