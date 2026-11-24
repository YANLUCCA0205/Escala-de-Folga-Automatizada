// =============================================================================
// ADMINISTRAÇÃO — PERFIS E MATRIZ DE PERMISSÕES (RBAC)
// Exibe descrições compreensíveis como padrão, ocultando códigos técnicos até
// ativação explícita da visualização avançada.
// A pré-visualização de perfil (restrita a MASTER) é estritamente visual.
// =============================================================================

import { useState, useMemo } from "react";
import {
  ROLE_HIERARCHY,
  ROLE_METADATA,
  PERMISSIONS_CATALOG,
  PERMISSIONS_BY_ROLE,
  canSimulateRbacRole,
} from "../../services/erpRepository.js";
import {
  PageHeader,
  Button,
  Badge,
  Alert,
  Select,
  Icon,
} from "../../ui/index.jsx";

export default function RolesPermissionsModule({
  currentUser,
  previewRole,
  onChangePreviewRole,
}) {
  const [showTechnicalCodes, setShowTechnicalCodes] = useState(false);
  const canPreview = canSimulateRbacRole(currentUser);

  const groupedCatalog = useMemo(() => {
    const groups = new Map();
    for (const perm of PERMISSIONS_CATALOG) {
      if (!groups.has(perm.category)) groups.set(perm.category, []);
      groups.get(perm.category).push(perm);
    }
    return Array.from(groups.entries());
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Perfis e permissões"
        subtitle="Matriz corporativa de controle de acesso baseado em papéis (RBAC) segundo o princípio do menor privilégio."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="sliders"
            onClick={() => setShowTechnicalCodes((v) => !v)}
          >
            {showTechnicalCodes ? "Ocultar códigos técnicos" : "Exibir códigos técnicos"}
          </Button>
        }
      />

      {/* Resumo dos 5 perfis hierárquicos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        {ROLE_HIERARCHY.map((r) => {
          const meta = ROLE_METADATA[r];
          const count = (PERMISSIONS_BY_ROLE[r] || []).length;
          return (
            <div key={r} className="erp-surface erp-surface-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <strong style={{ fontSize: "var(--erp-text-md)" }}>{meta.label}</strong>
                <Badge tone={r === "MASTER" ? "brand" : "neutral"}>{r}</Badge>
              </div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "var(--erp-text-xs)",
                  color: "var(--erp-ink-secondary)",
                  lineHeight: 1.45,
                }}
              >
                {meta.description}
              </p>
              <div style={{ fontSize: "var(--erp-text-xs)", color: "var(--erp-ink-muted)" }}>
                {count} permissões padrão ·{" "}
                {r === "MASTER" ? "Escopo global + MFA obrigatório" : "Restrito às lojas autorizadas"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pré-visualização estritamente visual (exclusiva para MASTER) */}
      {canPreview && (
        <div className="erp-surface erp-surface-body">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "var(--erp-text-md)" }}>
                Pré-visualização visual de interface por perfil
              </div>
              <div style={{ fontSize: "var(--erp-text-xs)", color: "var(--erp-ink-muted)" }}>
                Permite inspecionar como os menus e barras de ferramentas aparecem para cada papel,
                sem alterar tokens, privilégios reais ou políticas de banco de dados.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Select
                aria-label="Selecionar perfil para pré-visualização visual"
                value={previewRole || ""}
                onChange={(e) => onChangePreviewRole(e.target.value || null)}
                style={{ width: 260 }}
              >
                <option value="">Sem pré-visualização (Operação normal MASTER)</option>
                {ROLE_HIERARCHY.filter((r) => r !== "MASTER").map((r) => (
                  <option key={r} value={r}>
                    Pré-visualizar como: {ROLE_METADATA[r].label} ({r})
                  </option>
                ))}
              </Select>
              {previewRole && (
                <Button variant="secondary" onClick={() => onChangePreviewRole(null)}>
                  Restaurar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Matriz completa agrupada por área funcional */}
      <div className="erp-table-wrap">
        <table className="erp-table">
          <thead>
            <tr>
              <th style={{ minWidth: 300 }}>Capacidade operacional / administrativa</th>
              {ROLE_HIERARCHY.map((r) => (
                <th key={r} style={{ textAlign: "center", width: 130 }}>
                  <div>{ROLE_METADATA[r].shortLabel}</div>
                  {showTechnicalCodes && (
                    <div style={{ fontWeight: 500, color: "var(--erp-ink-muted)", fontSize: 11 }}>
                      {r}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedCatalog.map(([category, perms]) => (
              <FragmentCategoryRows
                key={category}
                category={category}
                perms={perms}
                showTechnicalCodes={showTechnicalCodes}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Alert tone="info" title="Isolamento por unidade e menor privilégio">
        A concessão de um perfil operacional (Administração Operacional, Gestão, Operação ou
        Consulta) aplica-se exclusivamente às unidades vinculadas ao cadastro do operador no banco
        de dados via Row Level Security (RLS). Nenhum usuário pode elevar o próprio perfil ou
        autorizar unidades adicionais para si mesmo.
      </Alert>
    </div>
  );
}

function FragmentCategoryRows({ category, perms, showTechnicalCodes }) {
  return (
    <>
      <tr>
        <td
          colSpan={ROLE_HIERARCHY.length + 1}
          style={{
            background: "var(--erp-surface-subtle)",
            fontWeight: 700,
            fontSize: "var(--erp-text-xs)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--erp-ink-secondary)",
          }}
        >
          {category}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p.code}>
          <td>
            <div style={{ fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontSize: 12, color: "var(--erp-ink-muted)" }}>{p.description}</div>
            {showTechnicalCodes && (
              <code
                style={{
                  display: "inline-block",
                  marginTop: 3,
                  fontSize: 11,
                  fontFamily: "var(--erp-font-mono)",
                  color: "var(--erp-brand-blue)",
                }}
              >
                {p.code}
              </code>
            )}
          </td>
          {ROLE_HIERARCHY.map((r) => {
            const allowed = (PERMISSIONS_BY_ROLE[r] || []).includes(p.code);
            return (
              <td key={r} style={{ textAlign: "center" }}>
                {allowed ? (
                  <Badge tone={p.isGovernance ? "brand" : "success"}>
                    <Icon name="check" size={12} /> Autorizado
                  </Badge>
                ) : (
                  <span style={{ color: "var(--erp-ink-muted)", fontSize: 12 }}>—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
