// =============================================================================
// ADMINISTRAÇÃO — TRILHA DE AUDITORIA IMUTÁVEL
// Consulta direta a `public.erp_audit_logs` com filtros combinados e inspeção
// detalhada de estados anterior/posterior em painel lateral.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { ErpRepository } from "../../services/erpRepository.js";
import {
  PageHeader,
  FilterBar,
  Button,
  Field,
  TextInput,
  Select,
  Badge,
  Alert,
  SidePanel,
  EmptyState,
} from "../../ui/index.jsx";

const VERIFICATION_META = {
  VERIFIED_MFA: { label: "Autenticado com MFA (aal2)", tone: "brand" },
  VERIFIED_SESSION: { label: "Sessão autenticada (Servidor)", tone: "success" },
  SERVICE_ROLE: { label: "Procedimento administrativo", tone: "info" },
  SYSTEM_SEED: { label: "Inicialização / Migração", tone: "neutral" },
  UNVERIFIED_LEGACY: { label: "Autoria não verificada (Legado)", tone: "warning" },
};

const RESULT_META = {
  SUCCESS: { label: "Sucesso", tone: "success" },
  DENIED: { label: "Negado", tone: "danger" },
  FAILED: { label: "Falha", tone: "warning" },
};

export default function AuditTrailModule({ units = [], supabaseClient }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  // Filtros exigidos: período, usuário, unidade, módulo, operação, resultado, origem
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [unitId, setUnitId] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [authVerification, setAuthVerification] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const rows = await ErpRepository.queryAuditLogs(supabaseClient, {
        dateFrom,
        dateTo,
        actorQuery,
        unitId,
        module: moduleFilter,
        actionQuery,
        result: resultFilter,
        authVerification,
        limit: 300,
      });
      setLogs(rows);
    } catch (err) {
      setErrorMsg(err?.message || "Falha ao consultar a trilha de auditoria.");
    } finally {
      setLoading(false);
    }
  }, [
    supabaseClient,
    dateFrom,
    dateTo,
    actorQuery,
    unitId,
    moduleFilter,
    actionQuery,
    resultFilter,
    authVerification,
  ]);

  useEffect(() => {
    let active = true;
    ErpRepository.queryAuditLogs(supabaseClient, {
      dateFrom,
      dateTo,
      actorQuery,
      unitId,
      module: moduleFilter,
      actionQuery,
      result: resultFilter,
      authVerification,
      limit: 300,
    })
      .then((rows) => {
        if (active) {
          setLogs(rows);
          setErrorMsg("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(err?.message || "Falha ao consultar a trilha de auditoria.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [
    supabaseClient,
    dateFrom,
    dateTo,
    actorQuery,
    unitId,
    moduleFilter,
    actionQuery,
    resultFilter,
    authVerification,
  ]);

  const activeFilterCount = [
    dateFrom,
    dateTo,
    unitId,
    moduleFilter,
    actionQuery,
    resultFilter,
    authVerification,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setActorQuery("");
    setUnitId("");
    setModuleFilter("");
    setActionQuery("");
    setResultFilter("");
    setAuthVerification("");
  };

  return (
    <div>
      <PageHeader
        title="Auditoria"
        subtitle="Trilha append-only protegida contra alteração ou exclusão. Sessões históricas anteriores à autenticação de servidor são sinalizadas como não verificadas."
        meta={<Badge tone="neutral">{logs.length} eventos carregados</Badge>}
        actions={
          <Button variant="secondary" icon="refresh" onClick={fetchLogs} loading={loading}>
            Atualizar registros
          </Button>
        }
      />

      {errorMsg && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone="danger">{errorMsg}</Alert>
        </div>
      )}

      <FilterBar
        primaryFilters={
          <>
            <Field label="Operador (e-mail)">
              {(id) => (
                <TextInput
                  id={id}
                  value={actorQuery}
                  onChange={(e) => setActorQuery(e.target.value)}
                  placeholder="Ex.: nome@uniao..."
                  style={{ width: 210 }}
                />
              )}
            </Field>
            <Field label="Módulo">
              {(id) => (
                <Select
                  id={id}
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                >
                  <option value="">Todos os módulos</option>
                  <option value="ESCALA_MENSAL">Escalas mensais</option>
                  <option value="COLABORADORES">Colaboradores</option>
                  <option value="DISPONIBILIDADE_FERIAS">Férias e afastamentos</option>
                  <option value="QUADRO_DE_VAGAS">Postos e vagas</option>
                  <option value="ESTRUTURA_ORGANIZACIONAL">Estrutura organizacional</option>
                  <option value="MOTOR_DE_REGRAS">Jornadas e regras</option>
                  <option value="CALENDARIO_MERCADO">Calendário operacional</option>
                  <option value="ADMIN_RBAC">Usuários e acessos</option>
                  <option value="BACKUP">Backup e recuperação</option>
                  <option value="AUTENTICACAO">Autenticação</option>
                  <option value="SEGURANCA">Segurança / Bloqueios</option>
                </Select>
              )}
            </Field>
            <Field label="Unidade">
              {(id) => (
                <Select id={id} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
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
        advancedFilters={
          <>
            <Field label="Data inicial">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              )}
            </Field>
            <Field label="Data final">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              )}
            </Field>
            <Field label="Operação">
              {(id) => (
                <TextInput
                  id={id}
                  value={actionQuery}
                  onChange={(e) => setActionQuery(e.target.value)}
                  placeholder="Ex.: PUBLICAR, CRIAR..."
                />
              )}
            </Field>
            <Field label="Resultado">
              {(id) => (
                <Select
                  id={id}
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="SUCCESS">Sucesso</option>
                  <option value="DENIED">Negado</option>
                  <option value="FAILED">Falha</option>
                </Select>
              )}
            </Field>
            <Field label="Origem de autenticação">
              {(id) => (
                <Select
                  id={id}
                  value={authVerification}
                  onChange={(e) => setAuthVerification(e.target.value)}
                >
                  <option value="">Todas as origens</option>
                  <option value="VERIFIED_MFA">Autenticado com MFA</option>
                  <option value="VERIFIED_SESSION">Sessão autenticada</option>
                  <option value="SERVICE_ROLE">Procedimento administrativo</option>
                  <option value="SYSTEM_SEED">Migração / Seed</option>
                  <option value="UNVERIFIED_LEGACY">Legado não verificado</option>
                </Select>
              )}
            </Field>
          </>
        }
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <div className="erp-table-wrap">
        {logs.length === 0 && !loading ? (
          <EmptyState
            icon="history"
            title="Nenhum registro de auditoria para os filtros atuais"
            description="Altere os parâmetros de período, módulo ou operador para ampliar a busca."
          />
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Responsável</th>
                <th>Origem de autenticação</th>
                <th>Unidade</th>
                <th>Módulo e operação</th>
                <th>Resultado</th>
                <th>Descrição</th>
                <th style={{ textAlign: "right" }}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const verif =
                  VERIFICATION_META[log.auth_verification] || VERIFICATION_META.UNVERIFIED_LEGACY;
                const resMeta = RESULT_META[log.result] || RESULT_META.SUCCESS;
                return (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {log.actor_name || log.actor_email || "Sistema"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>
                        {log.actor_email || "—"} {log.actor_role ? `· ${log.actor_role}` : ""}
                      </div>
                    </td>
                    <td>
                      <Badge tone={verif.tone}>{verif.label}</Badge>
                    </td>
                    <td>{log.unit_id || "Global"}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{log.module}</div>
                      <div style={{ fontSize: 12, color: "var(--erp-brand-blue)" }}>
                        {log.action}
                      </div>
                    </td>
                    <td>
                      <Badge tone={resMeta.tone}>{resMeta.label}</Badge>
                    </td>
                    <td style={{ maxWidth: 360 }}>{log.summary}</td>
                    <td style={{ textAlign: "right" }}>
                      <Button variant="tertiary" size="sm" onClick={() => setSelectedLog(log)}>
                        Inspecionar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Painel Lateral de Inspeção Forense do Evento */}
      <SidePanel
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Detalhes do registro de auditoria"
        subtitle={selectedLog ? `${selectedLog.module} · ${selectedLog.action}` : ""}
        width={560}
      >
        {selectedLog && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                padding: 12,
                background: "var(--erp-surface-subtle)",
                border: "1px solid var(--erp-border)",
                borderRadius: 6,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>Identificador</div>
                <code style={{ fontSize: 11 }}>{selectedLog.id}</code>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>Carimbo de tempo</div>
                <strong>{new Date(selectedLog.created_at).toLocaleString("pt-BR")}</strong>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>Operador</div>
                <strong>{selectedLog.actor_email || "Procedimento interno"}</strong>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>Verificação</div>
                <strong>
                  {VERIFICATION_META[selectedLog.auth_verification]?.label ||
                    selectedLog.auth_verification}
                </strong>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Resumo</div>
              <div style={{ color: "var(--erp-ink-secondary)" }}>{selectedLog.summary}</div>
            </div>

            {selectedLog.before_state && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Estado anterior</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    background: "var(--erp-surface-subtle)",
                    border: "1px solid var(--erp-border)",
                    borderRadius: 6,
                    fontSize: 12,
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(selectedLog.before_state, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.after_state && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Estado posterior</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    background: "var(--erp-surface-subtle)",
                    border: "1px solid var(--erp-border)",
                    borderRadius: 6,
                    fontSize: 12,
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(selectedLog.after_state, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
