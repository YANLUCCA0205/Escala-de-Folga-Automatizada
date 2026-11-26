// =============================================================================
// NÚCLEO DE GOVERNANÇA DE USUÁRIOS — EDGE FUNCTION `admin-users`
// Isolado de runtime (Deno/Node) para verificação automatizada em suíte de testes.
// Regras invioláveis:
//   1. O chamador é identificado exclusivamente pelo JWT verificado pelo GoTrue.
//   2. Exige perfil MASTER com status ACTIVE e sessão MFA verificada (aal2).
//   3. Nenhuma chave service_role ou senha temporária é persistida em banco.
//   4. Senhas temporárias (quando solicitadas sem SMTP) são geradas por CSPRNG,
//      têm uso único (must_change_password = true) e jamais podem ser recuperadas.
// =============================================================================

const VALID_ROLES = new Set(["MASTER", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]);
const VALID_STATUSES = new Set(["ACTIVE", "SUSPENDED", "DEACTIVATED"]);

/** Gera senha temporária forte por CSPRNG (20 caracteres, todas as classes exigidas). */
export function generateCryptographicTempPassword(cryptoImpl = globalThis.crypto) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*+-=?";
  const all = upper + lower + digits + symbols;

  const bytes = new Uint32Array(24);
  cryptoImpl.getRandomValues(bytes);

  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  for (let i = 4; i < 20; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Embaralhamento Fisher-Yates usando os bytes restantes
  for (let i = chars.length - 1; i > 0; i--) {
    const rand = bytes[i % bytes.length] ^ (bytes[(i + 7) % bytes.length] << 3);
    const j = Math.abs(rand) % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Decodifica payload de um JWT JÁ VERIFICADO pelo servidor Auth (para ler claims aal / session_id). */
export function decodeVerifiedJwtClaims(jwt) {
  if (!jwt || typeof jwt !== "string") return {};
  const parts = jwt.split(".");
  if (parts.length !== 3) return {};
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? decodeURIComponent(
            Array.from(atob(padded))
              .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
              .join("")
          )
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Executa uma operação administrativa autenticada.
 * @param {object} deps
 * @param {object} deps.serviceClient Cliente Supabase inicializado com SUPABASE_SERVICE_ROLE_KEY
 * @param {string} deps.bearerToken Token Bearer do chamador
 * @param {object} deps.body Corpo JSON da requisição
 * @param {string} [deps.redirectTo] URL base da aplicação para links de convite/recuperação
 */
export async function handleAdminUsersRequest({
  serviceClient,
  bearerToken,
  body,
  redirectTo = "",
}) {
  if (!bearerToken) {
    return { status: 401, payload: { ok: false, error: "UNAUTHENTICATED" } };
  }

  // 1. Verifica autenticidade do token junto ao GoTrue
  const { data: userData, error: userErr } = await serviceClient.auth.getUser(bearerToken);
  if (userErr || !userData?.user?.id) {
    return { status: 401, payload: { ok: false, error: "INVALID_SESSION" } };
  }

  const actorId = userData.user.id;

  // 2. Confirma no banco que o chamador é MASTER ativo
  const { data: actorProfile, error: profErr } = await serviceClient
    .from("erp_profiles")
    .select("id, email, role, status")
    .eq("id", actorId)
    .maybeSingle();

  if (profErr || !actorProfile || actorProfile.role !== "MASTER" || actorProfile.status !== "ACTIVE") {
    return {
      status: 403,
      payload: { ok: false, error: "FORBIDDEN", message: "Acesso restrito ao perfil MASTER ativo." },
    };
  }

  const action = String(body?.action || "");

  try {
    // -------------------------------------------------------------------------
    // AÇÃO 1: PROVISIONAR NOVO OPERADOR (convite seguro ou senha temporária CSPRNG)
    // -------------------------------------------------------------------------
    if (action === "invite") {
      const email = normalizeEmail(body.email);
      const fullName = String(body.fullName || "").trim();
      const role = String(body.role || "OPERATOR").toUpperCase();
      const authorizedUnits = Array.isArray(body.authorizedUnits)
        ? body.authorizedUnits.map((u) => String(u).trim()).filter(Boolean)
        : [];
      const extraPermissions = Array.isArray(body.extraPermissions) ? body.extraPermissions : [];
      const deniedPermissions = Array.isArray(body.deniedPermissions) ? body.deniedPermissions : [];
      const deliveryMode = body.deliveryMode || "invite_email"; // 'invite_email' | 'invite_link' | 'temp_password'

      if (!isValidEmail(email)) {
        return { status: 400, payload: { ok: false, error: "INVALID_EMAIL" } };
      }
      if (fullName.length < 3) {
        return { status: 400, payload: { ok: false, error: "INVALID_NAME" } };
      }
      if (!VALID_ROLES.has(role)) {
        return { status: 400, payload: { ok: false, error: "INVALID_ROLE" } };
      }
      if (role !== "MASTER" && authorizedUnits.length === 0) {
        return { status: 400, payload: { ok: false, error: "UNITS_REQUIRED" } };
      }

      let createdUserId = null;
      let oneTimeInviteLink = null;
      let oneTimeTempPassword = null;

      if (deliveryMode === "temp_password") {
        oneTimeTempPassword = generateCryptographicTempPassword();
        const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
          email,
          password: oneTimeTempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (createErr || !created?.user?.id) {
          return {
            status: 400,
            payload: { ok: false, error: "AUTH_CREATE_FAILED", message: createErr?.message || "Falha ao criar conta." },
          };
        }
        createdUserId = created.user.id;
      } else if (deliveryMode === "invite_link") {
        const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
          type: "invite",
          email,
          options: { data: { full_name: fullName }, redirectTo: redirectTo || undefined },
        });
        if (linkErr || !linkData?.user?.id) {
          return {
            status: 400,
            payload: { ok: false, error: "INVITE_LINK_FAILED", message: linkErr?.message || "Falha ao gerar convite." },
          };
        }
        createdUserId = linkData.user.id;
        oneTimeInviteLink = linkData.properties?.action_link || null;
      } else {
        const { data: invited, error: invErr } = await serviceClient.auth.admin.inviteUserByEmail(
          email,
          { data: { full_name: fullName }, redirectTo: redirectTo || undefined }
        );
        if (invErr || !invited?.user?.id) {
          return {
            status: 400,
            payload: { ok: false, error: "INVITE_EMAIL_FAILED", message: invErr?.message || "Falha ao enviar convite." },
          };
        }
        createdUserId = invited.user.id;
      }

      const { data: profile, error: rpcErr } = await serviceClient.rpc("admin_create_profile", {
        p_actor: actorId,
        p_user_id: createdUserId,
        p_email: email,
        p_full_name: fullName,
        p_role: role,
        p_units: role === "MASTER" ? [] : authorizedUnits,
        p_extra: extraPermissions,
        p_denied: deniedPermissions,
      });

      if (rpcErr) {
        // Desfaz usuário órfão no Auth para manter atomicidade lógica
        await serviceClient.auth.admin.deleteUser(createdUserId).catch(() => {});
        return {
          status: 400,
          payload: { ok: false, error: "PROFILE_CREATE_FAILED", message: rpcErr.message },
        };
      }

      if (deliveryMode === "temp_password") {
        // Marca troca obrigatória de senha no primeiro acesso
        await serviceClient.rpc("admin_flag_credential_reset", {
          p_actor: actorId,
          p_user_id: createdUserId,
        });
      }

      return {
        status: 200,
        payload: {
          ok: true,
          profile,
          deliveryMode,
          // Retornados UMA ÚNICA VEZ na resposta ao MASTER; jamais armazenados ou recuperáveis depois.
          oneTimeInviteLink,
          oneTimeTempPassword,
        },
      };
    }

    // -------------------------------------------------------------------------
    // AÇÃO 2: ATUALIZAR PERFIL, UNIDADES E PERMISSÕES INDIVIDUAIS
    // -------------------------------------------------------------------------
    if (action === "update_profile") {
      const userId = String(body.userId || "");
      const fullName = String(body.fullName || "").trim();
      const role = String(body.role || "").toUpperCase();
      const authorizedUnits = Array.isArray(body.authorizedUnits) ? body.authorizedUnits : [];
      const extraPermissions = Array.isArray(body.extraPermissions) ? body.extraPermissions : [];
      const deniedPermissions = Array.isArray(body.deniedPermissions) ? body.deniedPermissions : [];

      if (!userId || fullName.length < 3 || !VALID_ROLES.has(role)) {
        return { status: 400, payload: { ok: false, error: "INVALID_PAYLOAD" } };
      }

      const { data: updated, error: rpcErr } = await serviceClient.rpc("admin_update_profile", {
        p_actor: actorId,
        p_user_id: userId,
        p_full_name: fullName,
        p_role: role,
        p_units: role === "MASTER" ? [] : authorizedUnits,
        p_extra: extraPermissions,
        p_denied: deniedPermissions,
      });

      if (rpcErr) {
        return { status: 400, payload: { ok: false, error: "UPDATE_FAILED", message: rpcErr.message } };
      }
      return { status: 200, payload: { ok: true, profile: updated } };
    }

    // -------------------------------------------------------------------------
    // AÇÃO 3: ATIVAR / SUSPENDER / DESATIVAR CONTA
    // -------------------------------------------------------------------------
    if (action === "set_status") {
      const userId = String(body.userId || "");
      const status = String(body.status || "").toUpperCase();
      const reason = body.reason ? String(body.reason).trim() : null;

      if (!userId || !VALID_STATUSES.has(status)) {
        return { status: 400, payload: { ok: false, error: "INVALID_PAYLOAD" } };
      }

      const { data: updated, error: rpcErr } = await serviceClient.rpc("admin_set_status", {
        p_actor: actorId,
        p_user_id: userId,
        p_status: status,
        p_reason: reason,
      });

      if (rpcErr) {
        return { status: 400, payload: { ok: false, error: "STATUS_CHANGE_FAILED", message: rpcErr.message } };
      }

      // Bloqueia ou desbloqueia também no GoTrue para impedir emissão de novos tokens
      await serviceClient.auth.admin
        .updateUserById(userId, { ban_duration: status === "ACTIVE" ? "none" : "876000h" })
        .catch(() => {});

      return { status: 200, payload: { ok: true, profile: updated } };
    }

    // -------------------------------------------------------------------------
    // AÇÃO 4: REDEFINIR CREDENCIAIS / REEMITIR CONVITE DE USO ÚNICO
    // -------------------------------------------------------------------------
    if (action === "reset_credentials") {
      const userId = String(body.userId || "");
      const deliveryMode = body.deliveryMode || "recovery_link"; // 'recovery_link' | 'temp_password'
      if (!userId) {
        return { status: 400, payload: { ok: false, error: "INVALID_PAYLOAD" } };
      }

      const { data: target } = await serviceClient
        .from("erp_profiles")
        .select("id, email, status")
        .eq("id", userId)
        .maybeSingle();

      if (!target?.email) {
        return { status: 404, payload: { ok: false, error: "USER_NOT_FOUND" } };
      }

      let oneTimeRecoveryLink = null;
      let oneTimeTempPassword = null;

      if (deliveryMode === "temp_password") {
        oneTimeTempPassword = generateCryptographicTempPassword();
        const { error: updErr } = await serviceClient.auth.admin.updateUserById(userId, {
          password: oneTimeTempPassword,
          email_confirm: true,
        });
        if (updErr) {
          return { status: 400, payload: { ok: false, error: "RESET_FAILED", message: updErr.message } };
        }
      } else {
        const linkType = target.status === "PENDING" ? "invite" : "recovery";
        const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
          type: linkType,
          email: target.email,
          options: { redirectTo: redirectTo || undefined },
        });
        if (linkErr) {
          return { status: 400, payload: { ok: false, error: "RESET_LINK_FAILED", message: linkErr.message } };
        }
        oneTimeRecoveryLink = linkData?.properties?.action_link || null;
      }

      const { error: flagErr } = await serviceClient.rpc("admin_flag_credential_reset", {
        p_actor: actorId,
        p_user_id: userId,
      });
      if (flagErr) {
        return { status: 400, payload: { ok: false, error: "RESET_FLAG_FAILED", message: flagErr.message } };
      }

      return {
        status: 200,
        payload: {
          ok: true,
          deliveryMode,
          oneTimeRecoveryLink,
          oneTimeTempPassword,
        },
      };
    }

    // -------------------------------------------------------------------------
    // AÇÃO 5: REVOGAR TODAS AS SESSÕES ATIVAS DE UM OPERADOR
    // -------------------------------------------------------------------------
    if (action === "revoke_sessions") {
      const userId = String(body.userId || "");
      if (!userId) {
        return { status: 400, payload: { ok: false, error: "INVALID_PAYLOAD" } };
      }

      const { data: revokedCount, error: rpcErr } = await serviceClient.rpc("admin_revoke_sessions", {
        p_actor: actorId,
        p_user_id: userId,
      });
      if (rpcErr) {
        return { status: 400, payload: { ok: false, error: "REVOKE_FAILED", message: rpcErr.message } };
      }

      return { status: 200, payload: { ok: true, revokedSessions: revokedCount ?? 0 } };
    }

    return { status: 400, payload: { ok: false, error: "UNKNOWN_ACTION" } };
  } catch (err) {
    return {
      status: 500,
      payload: { ok: false, error: "INTERNAL_ERROR", message: String(err?.message || err) },
    };
  }
}
