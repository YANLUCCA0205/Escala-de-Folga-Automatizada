// =============================================================================
// DESPACHANTE DE GOVERNANÇA ADMINISTRATIVA — WORKFORCE ERP v9.0
// Separa responsabilidades administrativas em 5 módulos independentes:
//   - admin_users    : Usuários e acessos
//   - admin_roles    : Perfis e permissões
//   - admin_audit    : Auditoria
//   - admin_backup   : Backup e recuperação
//   - admin_settings : Configurações do sistema
// =============================================================================

import UsersAccessModule from "./admin/UsersAccessModule.jsx";
import RolesPermissionsModule from "./admin/RolesPermissionsModule.jsx";
import AuditTrailModule from "./admin/AuditTrailModule.jsx";
import BackupRecoveryModule from "./admin/BackupRecoveryModule.jsx";
import SystemSettingsModule from "./admin/SystemSettingsModule.jsx";
import { hasPermission } from "../services/erpRepository.js";
import { Alert } from "../ui/index.jsx";

export default function AdminAndAuditModule({
  section = "admin_audit",
  units = [],
  currentUser,
  permissions = [],
  previewRole = null,
  onChangePreviewRole,
  settings = {},
  onSettingsUpdated,
  supabaseClient,
  onReloadDatabase,
  onNotify,
}) {
  if (section === "admin_users") {
    if (!hasPermission(permissions, "MANAGE_USERS")) {
      return (
        <Alert tone="danger" title="Acesso restrito">
          O gerenciamento de contas e operadores é exclusivo do perfil MASTER.
        </Alert>
      );
    }
    return (
      <UsersAccessModule
        units={units}
        currentUser={currentUser}
        supabaseClient={supabaseClient}
        onNotify={onNotify}
      />
    );
  }

  if (section === "admin_roles") {
    if (!hasPermission(permissions, "MANAGE_ACCESS") && !hasPermission(permissions, "VIEW_AUDIT")) {
      return (
        <Alert tone="danger" title="Acesso restrito">
          Seu perfil não possui autorização para consultar a matriz administrativa.
        </Alert>
      );
    }
    return (
      <RolesPermissionsModule
        currentUser={currentUser}
        previewRole={previewRole}
        onChangePreviewRole={onChangePreviewRole}
      />
    );
  }

  if (section === "admin_backup") {
    if (!hasPermission(permissions, "MANAGE_BACKUP")) {
      return (
        <Alert tone="danger" title="Acesso restrito">
          As operações de backup e restauração são exclusivas do perfil MASTER autenticado com MFA.
        </Alert>
      );
    }
    return (
      <BackupRecoveryModule
        supabaseClient={supabaseClient}
        onReloadDatabase={onReloadDatabase}
        onNotify={onNotify}
      />
    );
  }

  if (section === "admin_settings") {
    if (!hasPermission(permissions, "MANAGE_SYSTEM_SETTINGS")) {
      return (
        <Alert tone="danger" title="Acesso restrito">
          As configurações críticas do sistema são exclusivas do perfil MASTER.
        </Alert>
      );
    }
    return (
      <SystemSettingsModule
        settings={settings}
        supabaseClient={supabaseClient}
        onSettingsUpdated={onSettingsUpdated}
        onNotify={onNotify}
      />
    );
  }

  if (!hasPermission(permissions, "VIEW_AUDIT")) {
    return (
      <Alert tone="danger" title="Acesso restrito">
        Seu perfil não possui permissão para consultar a trilha de auditoria.
      </Alert>
    );
  }

  return <AuditTrailModule units={units} supabaseClient={supabaseClient} />;
}
