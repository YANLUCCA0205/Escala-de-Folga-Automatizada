// =============================================================================
// ADMINISTRAÇÃO — BACKUP E RECUPERAÇÃO (Exclusivo MASTER + MFA Recente)
// Snapshots verificados no servidor, download protegido por reautenticação TOTP
// e restauração com frase de confirmação e ponto de retorno automático (PRE_RESTORE).
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  listServerBackups,
  createServerBackup,
  downloadServerBackup,
  restoreServerBackup,
  verifyTotpFactor,
} from "../../services/authService.js";
import {
  PageHeader,
  Button,
  Field,
  TextInput,
  Badge,
  Alert,
  Dialog,
  ConfirmDialog,
  EmptyState,
} from "../../ui/index.jsx";

const KIND_LABELS = {
  MANUAL: { label: "Manual", tone: "brand" },
  PRE_RESTORE: { label: "Ponto pré-restauração", tone: "info" },
  PRE_MIGRATION: { label: "Pré-migração", tone: "neutral" },
};

export default function BackupRecoveryModule({
  supabaseClient,
  onReloadDatabase,
  onNotify,
}) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [createLabel, setCreateLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Restauração protegida
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Reautenticação MFA step-up quando o token TOTP tiver mais de 10 minutos
  const [reauthPendingAction, setReauthPendingAction] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState("");

  const loadBackups = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const list = await listServerBackups(supabaseClient);
      setBackups(list);
    } catch (err) {
      setErrorMsg(err?.message || "Não foi possível consultar os backups.");
    } finally {
      setLoading(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    let active = true;
    listServerBackups(supabaseClient)
      .then((list) => {
        if (active) {
          setBackups(list);
          setErrorMsg("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(err?.message || "Não foi possível consultar os backups.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [supabaseClient]);

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createServerBackup(
        createLabel.trim() || `Snapshot administrativo ${new Date().toLocaleDateString("pt-BR")}`,
        supabaseClient
      );
      setCreateLabel("");
      onNotify?.("Snapshot criado e verificado com sucesso no servidor.", "ok");
      await loadBackups();
    } catch (err) {
      onNotify?.(err?.message || "Falha ao criar snapshot.", "err");
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup) => {
    try {
      const res = await downloadServerBackup(backup.id, supabaseClient);
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uniao-erp-backup-${String(backup.id).slice(0, 8)}-${new Date(
        backup.created_at
      )
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotify?.("Arquivo de backup exportado e registrado na auditoria.", "ok");
    } catch (err) {
      if (err?.code === "REAUTH_REQUIRED") {
        setTotpCode("");
        setReauthError("");
        setReauthPendingAction({ type: "download", backup });
      } else {
        onNotify?.(err?.message || "Falha ao exportar backup.", "err");
      }
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    const phrase = `RESTAURAR ${String(restoreTarget.id).slice(0, 8)}`;
    setRestoring(true);
    try {
      await restoreServerBackup(restoreTarget.id, phrase, supabaseClient);
      setRestoreTarget(null);
      onNotify?.(
        "Base restaurada com sucesso! Um ponto automático PRÉ-RESTAURAÇÃO foi preservado.",
        "ok"
      );
      await loadBackups();
      await onReloadDatabase?.();
    } catch (err) {
      if (err?.code === "REAUTH_REQUIRED") {
        const target = restoreTarget;
        setRestoreTarget(null);
        setTotpCode("");
        setReauthError("");
        setReauthPendingAction({ type: "restore", backup: target });
      } else {
        onNotify?.(err?.message || "Falha na restauração.", "err");
      }
    } finally {
      setRestoring(false);
    }
  };

  const handleStepUpVerify = async (e) => {
    e.preventDefault();
    setReauthError("");
    setReauthBusy(true);
    try {
      const ver = await verifyTotpFactor({ code: totpCode }, supabaseClient);
      if (!ver.ok) {
        setReauthError(ver.message || "Código inválido.");
        setReauthBusy(false);
        return;
      }
      const pending = reauthPendingAction;
      setReauthPendingAction(null);
      if (pending?.type === "download") {
        await handleDownload(pending.backup);
      } else if (pending?.type === "restore") {
        setRestoreTarget(pending.backup);
      }
    } catch (err) {
      setReauthError(err?.message || "Não foi possível revalidar o MFA.");
    } finally {
      setReauthBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Backup e recuperação"
        subtitle="Operações críticas isoladas, protegidas por MFA recente, confirmação formal e geração automática de ponto de retorno antes de qualquer restauração."
        actions={
          <Button variant="secondary" icon="refresh" onClick={loadBackups} loading={loading}>
            Atualizar lista
          </Button>
        }
      />

      {errorMsg && <Alert tone="danger">{errorMsg}</Alert>}

      {/* Criação de novo snapshot no servidor */}
      <form
        onSubmit={handleCreateSnapshot}
        className="erp-surface erp-surface-body"
        style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}
      >
        <Field
          label="Identificação do novo ponto de backup"
          style={{ flex: 1, minWidth: 260 }}
        >
          {(id) => (
            <TextInput
              id={id}
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
              placeholder="Ex.: Fechamento da competência Novembro/2026"
            />
          )}
        </Field>
        <Button type="submit" variant="primary" icon="database" loading={creating}>
          Criar snapshot agora
        </Button>
      </form>

      {/* Tabela de snapshots armazenados */}
      <div className="erp-table-wrap">
        {backups.length === 0 && !loading ? (
          <EmptyState
            icon="database"
            title="Nenhum snapshot registrado"
            description="Gere um ponto de backup manual acima para habilitar exportações e pontos de restauração."
          />
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Identificação</th>
                <th>Tipo</th>
                <th>Autor</th>
                <th>Partições</th>
                <th>Tamanho</th>
                <th>Checksum (MD5)</th>
                <th style={{ textAlign: "right" }}>Operações</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => {
                const kindMeta = KIND_LABELS[b.kind] || { label: b.kind, tone: "neutral" };
                return (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(b.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ fontWeight: 600 }}>{b.label}</td>
                    <td>
                      <Badge tone={kindMeta.tone}>{kindMeta.label}</Badge>
                    </td>
                    <td style={{ fontSize: 12 }}>{b.created_by_email || "Sistema"}</td>
                    <td>{b.partition_count}</td>
                    <td style={{ fontSize: 12 }}>
                      {(Number(b.size_bytes || 0) / 1024).toFixed(1)} KB
                    </td>
                    <td>
                      <code style={{ fontSize: 11, fontFamily: "var(--erp-font-mono)" }}>
                        {String(b.checksum || "").slice(0, 12)}
                      </code>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="download"
                          onClick={() => handleDownload(b)}
                        >
                          Exportar
                        </Button>
                        <Button
                          variant="danger-outline"
                          size="sm"
                          icon="history"
                          onClick={() => setRestoreTarget(b)}
                        >
                          Restaurar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmação digitada para restauração destrutiva */}
      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleConfirmRestore}
        title="Restaurar base operacional a partir de snapshot"
        description={
          restoreTarget
            ? `Esta ação substituirá as partições atuais pelo snapshot "${restoreTarget.label}". O servidor gravará automaticamente um backup PRÉ-RESTAURAÇÃO antes de aplicar.`
            : ""
        }
        danger
        confirmLabel="Executar restauração"
        requirePhrase={
          restoreTarget ? `RESTAURAR ${String(restoreTarget.id).slice(0, 8)}` : ""
        }
        busy={restoring}
      />

      {/* Reautenticação MFA Step-Up */}
      <Dialog
        open={Boolean(reauthPendingAction)}
        onClose={() => setReauthPendingAction(null)}
        title="Confirmação MFA obrigatória"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReauthPendingAction(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleStepUpVerify}
              loading={reauthBusy}
              disabled={totpCode.length !== 6}
            >
              Validar código
            </Button>
          </>
        }
      >
        <form onSubmit={handleStepUpVerify} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: "var(--erp-text-sm)", color: "var(--erp-ink-secondary)" }}>
            Exportações completas e restaurações exigem validação TOTP realizada nos últimos 10
            minutos. Informe o código atual de 6 dígitos do autenticador:
          </p>
          {reauthError && <Alert tone="danger">{reauthError}</Alert>}
          <Field label="Código TOTP (6 dígitos)" required>
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
              />
            )}
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
