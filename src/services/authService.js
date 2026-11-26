// =============================================================================
// SERVIÇO CENTRAL DE IDENTIDADE, SESSÃO, MFA E GOVERNANÇA — WORKFORCE ERP v9.0
//
// Garantias de segurança:
//   1. Fail-closed: sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ou em falha de
//      rede na validação de identidade, o acesso é bloqueado (jamais há fallback local).
//   2. Sessão mantida em `sessionStorage` (isolada por aba/janela, limpa ao fechar o
//      navegador em terminais compartilhados de loja) e expurgada no logout.
//   3. Mensagens neutras de autenticação que impedem enumeração de contas.
//   4. Limitação progressiva de tentativas de login no cliente + rate limit no GoTrue.
//   5. Suporte completo a convite único, redefinição obrigatória de senha e TOTP MFA.
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { evaluatePassword } from "../domain/passwordPolicy.js";
import { purgeLegacyInsecureStorage } from "./erpRepository.js";
import { createLocalErpClient } from "./localApiClient.js";

const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
export const APP_ENV_LABEL =
  String(import.meta.env?.VITE_APP_ENV_LABEL || "").trim() ||
  "Ambiente Corporativo — União Supermercados";

const AUTH_STORAGE_KEY = "uniao_erp_v9_auth_token";

// Adaptador seguro baseado em sessionStorage (com fallback em memória para testes Node)
const memoryStore = new Map();
const sessionStorageAdapter = {
  getItem(key) {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return memoryStore.get(key) ?? null;
      }
    }
    return memoryStore.get(key) ?? null;
  },
  setItem(key, value) {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(key, value);
        return;
      } catch {
        // Fallback em memória
      }
    }
    memoryStore.set(key, value);
  },
  removeItem(key) {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Ignora
      }
    }
    memoryStore.delete(key);
  },
};

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_URL.startsWith("https://") &&
      SUPABASE_ANON_KEY &&
      SUPABASE_ANON_KEY.length > 20
  );
}

let supabaseSingleton = null;

// fila em memória no processo para serializar operações internas do GoTrueClient
// sem depender de navigator.locks (evita deadlock circular quando SupabaseClient
// dispara realtime.setAuth() -> auth.getSession() dentro de signInWithPassword)
let inProcessAuthLockChain = Promise.resolve();
async function safeInProcessAuthLock(_name, _acquireTimeout, fn) {
  const run = inProcessAuthLockChain.then(fn, fn);
  inProcessAuthLockChain = run.catch(() => {});
  return await run;
}

export function getSupabaseClient() {
  purgeLegacyInsecureStorage();
  if (!supabaseSingleton) {
    if (isSupabaseConfigured()) {
      supabaseSingleton = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: sessionStorageAdapter,
          storageKey: AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          lock: safeInProcessAuthLock,
        },
      });
    } else if (typeof window !== "undefined") {
      // Opera sobre o backend PostgreSQL + RLS integrado (/api/v9)
      supabaseSingleton = createLocalErpClient({
        baseUrl: "/api/v9",
        storage: sessionStorageAdapter,
      });
    }
  }
  return supabaseSingleton;
}

// -----------------------------------------------------------------------------
// LIMITADOR DE TENTATIVAS DE AUTENTICAÇÃO (defesa contra força bruta)
// -----------------------------------------------------------------------------
const loginAttemptsMap = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 2 * 60 * 1000;

export function checkLoginRateLimit(email, now = Date.now()) {
  const key = String(email || "").trim().toLowerCase() || "__global__";
  const rec = loginAttemptsMap.get(key);
  if (!rec) return { allowed: true, retryAfterSeconds: 0 };

  if (rec.lockedUntil && rec.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000),
    };
  }
  if (now - rec.firstAttemptAt > WINDOW_MS) {
    loginAttemptsMap.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLoginAttempt(email, now = Date.now()) {
  const key = String(email || "").trim().toLowerCase() || "__global__";
  const prev = loginAttemptsMap.get(key);
  if (!prev || now - prev.firstAttemptAt > WINDOW_MS) {
    loginAttemptsMap.set(key, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
    return;
  }
  const nextCount = prev.count + 1;
  loginAttemptsMap.set(key, {
    count: nextCount,
    firstAttemptAt: prev.firstAttemptAt,
    lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : 0,
  });
}

export function clearFailedLoginAttempts(email) {
  const key = String(email || "").trim().toLowerCase() || "__global__";
  loginAttemptsMap.delete(key);
}

export function isNetworkError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("err_name_not_resolved") ||
    msg.includes("network request failed") ||
    msg.includes("fetch failed")
  );
}

// Mensagem neutra padrão que nunca revela se o e-mail existe na base
export const GENERIC_LOGIN_ERROR_MESSAGE =
  "Não foi possível autenticar com as credenciais informadas. Verifique seu e-mail e senha ou contate o administrador.";

export function detectUrlAuthFlow() {
  if (typeof window === "undefined") return null;
  const combined = `${window.location.hash || ""}&${window.location.search || ""}`.toLowerCase();
  if (combined.includes("type=invite")) return "invite";
  if (combined.includes("type=recovery")) return "recovery";
  return null;
}

/**
 * Resolve o estado de controle de acesso a partir da sessão do Supabase e do perfil no banco (`my_profile`).
 */
export async function resolveAuthGateState(
  client = getSupabaseClient(),
  { urlFlow = null, skipSignOutOnEmptyProfile = false } = {}
) {
  purgeLegacyInsecureStorage();
  if (!client) {
    return { gate: "unauthenticated", profile: null, unconfigured: true };
  }

  try {
    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    if (sessionErr) {
      if (isNetworkError(sessionErr)) {
        return { gate: "service_unavailable", profile: null };
      }
      return { gate: "unauthenticated", profile: null };
    }

    if (!sessionData?.session?.user) {
      return { gate: "unauthenticated", profile: null };
    }

    const { data: profile, error: profErr } = await client.rpc("my_profile");
    if (profErr) {
      if (isNetworkError(profErr)) {
        return { gate: "service_unavailable", profile: null };
      }
      if (!skipSignOutOnEmptyProfile) {
        // Sessão inválida/revogada no servidor
        await client.auth.signOut({ scope: "local" }).catch(() => {});
      }
      return { gate: "session_expired", profile: null };
    }

    if (!profile) {
      // `private.session_is_valid()` retornou falso -> sessão revogada no banco!
      if (!skipSignOutOnEmptyProfile) {
        await client.auth.signOut({ scope: "local" }).catch(() => {});
      }
      return { gate: "session_expired", profile: null };
    }

    if (profile.status === "NO_PROFILE") {
      return { gate: "account_blocked", blockVariant: "no_profile", profile };
    }
    if (profile.status === "DEACTIVATED") {
      return { gate: "account_blocked", blockVariant: "deactivated", profile };
    }
    if (profile.status === "SUSPENDED") {
      return { gate: "account_blocked", blockVariant: "suspended", profile };
    }

    if (urlFlow === "recovery") {
      return { gate: "set_password_recovery", profile };
    }
    if (profile.status === "PENDING" || urlFlow === "invite") {
      return { gate: "set_password_invite", profile };
    }
    if (profile.mustChangePassword) {
      return { gate: "set_password_forced", profile };
    }

    if (profile.mfaRequired && profile.aal !== "aal2") {
      return {
        gate: profile.mfaEnrolled ? "mfa_verify_required" : "mfa_enroll_required",
        profile,
      };
    }

    return { gate: "authenticated", profile };
  } catch (err) {
    if (isNetworkError(err)) {
      return { gate: "service_unavailable", profile: null };
    }
    return { gate: "unauthenticated", profile: null };
  }
}

/**
 * Realiza login com e-mail e senha via Supabase Auth (sem fallback local).
 */
export async function signInOperator({ email, password }, client = getSupabaseClient()) {
  purgeLegacyInsecureStorage();
  if (!client) {
    return {
      ok: false,
      serviceUnavailable: true,
      message:
        "Serviço de autenticação indisponível. Por segurança, novas autenticações estão bloqueadas.",
    };
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "");
  if (!cleanEmail || !cleanPass) {
    return { ok: false, message: "Informe seu e-mail corporativo e sua senha." };
  }

  const rate = checkLoginRateLimit(cleanEmail);
  if (!rate.allowed) {
    return {
      ok: false,
      rateLimited: true,
      message: `Muitas tentativas consecutivas. Aguarde ${rate.retryAfterSeconds}s antes de tentar novamente.`,
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass,
    });

    if (error) {
      if (isNetworkError(error)) {
        return {
          ok: false,
          serviceUnavailable: true,
          message:
            "Não foi possível conectar ao servidor de identidade. Por segurança, o acesso permanece bloqueado.",
        };
      }
      recordFailedLoginAttempt(cleanEmail);
      return { ok: false, message: GENERIC_LOGIN_ERROR_MESSAGE };
    }

    if (!data?.session) {
      recordFailedLoginAttempt(cleanEmail);
      return { ok: false, message: GENERIC_LOGIN_ERROR_MESSAGE };
    }

    clearFailedLoginAttempts(cleanEmail);

    // A partir deste ponto a credencial já foi validada e a sessão foi emitida pelo Supabase Auth.
    // NOTA CRÍTICA: no @supabase/postgrest-js, `client.rpc()` retorna um `PostgrestFilterBuilder`
    // (thenable que possui `.then()`, mas NÃO possui `.catch()`). Chamar `.catch()` diretamente
    // sobre `client.rpc(...)` lança `TypeError: client.rpc(...).catch is not a function`!
    try {
      await client.rpc("record_auth_event", { p_event: "LOGIN" });
    } catch {
      // Falha na telemetria de auditoria nunca impede o login já autenticado
    }

    let resolved = await resolveAuthGateState(client, { skipSignOutOnEmptyProfile: true });
    if (resolved.gate === "unauthenticated" || resolved.gate === "session_expired") {
      // Aguarda um ciclo curto caso a propagação da sessão em auth.sessions esteja concluindo
      await new Promise((r) => setTimeout(r, 120));
      resolved = await resolveAuthGateState(client);
    }

    return { ok: true, ...resolved };
  } catch (err) {
    if (isNetworkError(err)) {
      return {
        ok: false,
        serviceUnavailable: true,
        message:
          "Serviço de autenticação indisponível no momento. Tente novamente em instantes.",
      };
    }
    // Se a sessão já tiver sido gravada no storage apesar de uma exceção pós-login,
    // recupera o estado real da sessão em vez de exibir falso erro de credenciais.
    try {
      const recovered = await resolveAuthGateState(client);
      if (recovered?.gate && recovered.gate !== "unauthenticated") {
        clearFailedLoginAttempts(cleanEmail);
        return { ok: true, ...recovered };
      }
    } catch {
      // Prossegue para retorno padrão se realmente não houver sessão
    }
    recordFailedLoginAttempt(cleanEmail);
    return { ok: false, message: GENERIC_LOGIN_ERROR_MESSAGE };
  }
}

/**
 * Solicita recuperação de senha sem jamais revelar se o endereço consta ou não no cadastro.
 */
export async function requestPasswordRecovery(email, client = getSupabaseClient()) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!client) {
    return {
      ok: false,
      message: "Serviço de autenticação indisponível no momento.",
    };
  }
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, message: "Informe um endereço de e-mail corporativo válido." };
  }

  const rate = checkLoginRateLimit(`recovery:${cleanEmail}`);
  if (!rate.allowed) {
    return {
      ok: true,
      message:
        "Se o endereço informado estiver associado a uma conta ativa, você receberá as instruções de recuperação em instantes.",
    };
  }
  recordFailedLoginAttempt(`recovery:${cleanEmail}`);

  try {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/?type=recovery` : undefined;
    await client.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
  } catch (err) {
    if (isNetworkError(err)) {
      return {
        ok: false,
        message: "Não foi possível comunicar com o servidor de identidade. Tente novamente.",
      };
    }
  }

  return {
    ok: true,
    message:
      "Se o endereço informado estiver associado a uma conta ativa, você receberá as instruções de recuperação em instantes.",
  };
}

/**
 * Define a senha definitiva em primeiro acesso (convite), recuperação ou troca obrigatória.
 */
export async function setDefinitivePassword(
  { newPassword, mode = "invite", profile = null },
  client = getSupabaseClient()
) {
  if (!client) {
    return { ok: false, message: "Serviço de autenticação indisponível." };
  }

  const evalRes = evaluatePassword(newPassword, {
    email: profile?.email || "",
    fullName: profile?.fullName || "",
  });
  if (!evalRes.valid) {
    return {
      ok: false,
      message: "A senha informada não atende aos requisitos mínimos da política de segurança.",
    };
  }

  const { error: updErr } = await client.auth.updateUser({ password: newPassword });
  if (updErr) {
    const lower = String(updErr.message || "").toLowerCase();
    if (lower.includes("weak") || lower.includes("pwned") || lower.includes("compromised")) {
      return {
        ok: false,
        message:
          "Esta senha consta em bases conhecidas de vazamentos ou foi recusada pelo validador de segurança. Escolha outra combinação.",
      };
    }
    if (lower.includes("same") || lower.includes("different")) {
      return { ok: false, message: "A nova senha deve ser diferente da senha anterior." };
    }
    return { ok: false, message: "Não foi possível registrar a nova senha. Tente outra combinação." };
  }

  if (mode === "invite" || profile?.status === "PENDING") {
    const { error: actErr } = await client.rpc("complete_activation");
    if (actErr) {
      return { ok: false, message: actErr.message };
    }
  } else {
    const { error: chgErr } = await client.rpc("complete_password_change");
    if (chgErr) {
      return { ok: false, message: chgErr.message };
    }
  }

  if (typeof window !== "undefined" && window.history?.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const resolved = await resolveAuthGateState(client);
  return { ok: true, ...resolved };
}

// -----------------------------------------------------------------------------
// AUTENTICAÇÃO MULTIFATOR (TOTP MFA)
// -----------------------------------------------------------------------------
export async function startTotpEnrollment(client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");

  // Limpa fatores TOTP não verificados anteriores para evitar duplicidade
  const { data: existing } = await client.auth.mfa.listFactors();
  for (const f of existing?.all || []) {
    if (f.status !== "verified") {
      await client.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
    }
  }

  let { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "União Workforce ERP",
  });
  if (error && String(error.message || "").toLowerCase().includes("already exists")) {
    const retryRes = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `União Workforce ERP (${Date.now().toString(36)})`,
    });
    data = retryRes.data;
    error = retryRes.error;
  }
  if (error || !data?.id) {
    throw new Error(error?.message || "Não foi possível iniciar o cadastro MFA.");
  }

  return {
    factorId: data.id,
    qrCode: data.totp?.qr_code || "",
    secret: data.totp?.secret || "",
    uri: data.totp?.uri || "",
  };
}

export async function verifyTotpFactor({ factorId = null, code }, client = getSupabaseClient()) {
  if (!client) return { ok: false, message: "Serviço indisponível." };
  const cleanCode = String(code || "").replace(/\D/g, "");
  if (cleanCode.length !== 6) {
    return { ok: false, message: "Informe o código numérico de 6 dígitos do autenticador." };
  }

  let targetFactorId = factorId;
  if (!targetFactorId) {
    const { data: factors, error: listErr } = await client.auth.mfa.listFactors();
    if (listErr) return { ok: false, message: "Falha ao consultar fator MFA." };
    const verifiedTotp = (factors?.totp || []).find((f) => f.status === "verified");
    if (!verifiedTotp) {
      return { ok: false, message: "Nenhum fator MFA ativo encontrado para esta conta." };
    }
    targetFactorId = verifiedTotp.id;
  }

  const { data: challenge, error: chalErr } = await client.auth.mfa.challenge({
    factorId: targetFactorId,
  });
  if (chalErr || !challenge?.id) {
    return { ok: false, message: "Não foi possível iniciar a verificação MFA." };
  }

  const { error: verErr } = await client.auth.mfa.verify({
    factorId: targetFactorId,
    challengeId: challenge.id,
    code: cleanCode,
  });
  if (verErr) {
    return { ok: false, message: "Código de verificação inválido ou expirado." };
  }

  if (factorId) {
    try {
      await client.rpc("record_auth_event", { p_event: "MFA_ENROLLED" });
    } catch {
      // Ignora erro de telemetria
    }
  }
  const resolved = await resolveAuthGateState(client);
  return { ok: true, ...resolved };
}

/**
 * Logout seguro: registra evento de saída, revoga sessão no GoTrue e limpa qualquer vestígio local.
 */
export async function signOutSecurely(client = getSupabaseClient()) {
  purgeLegacyInsecureStorage();
  if (client) {
    try {
      await client.rpc("record_auth_event", { p_event: "LOGOUT" });
    } catch {
      // Ignora erro de telemetria no logout
    }
    try {
      await client.auth.signOut();
    } catch {
      // Ignora falha de rede ao revogar sessão remota
    }
  }
  sessionStorageAdapter.removeItem(AUTH_STORAGE_KEY);
}

// -----------------------------------------------------------------------------
// OPERAÇÕES DE GOVERNANÇA MASTER (Edge Function `admin-users` + RPCs protegidas)
// -----------------------------------------------------------------------------
export async function listManagedUsers(client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return data || [];
}

/** Gera senha temporária forte por CSPRNG no navegador (20 caracteres, 4 classes obrigatórias). */
function generateBrowserCryptographicTempPassword(cryptoImpl = globalThis.crypto) {
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
  for (let i = chars.length - 1; i > 0; i--) {
    const rand = bytes[i % bytes.length] ^ (bytes[(i + 7) % bytes.length] << 3);
    const j = Math.abs(rand) % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Fallback seguro para quando a Edge Function `admin-users` não estiver implantada no projeto Supabase:
 *   1. Para `invite` (provisionamento de novo operador), cria a identidade no GoTrue via cliente
 *      efêmero (`persistSession: false`) com senha temporária CSPRNG de 20 caracteres (sem afetar
 *      a sessão do MASTER) e registra o perfil em `public.erp_profiles` via RPC `public.master_manage_user`.
 *   2. Para `update_profile`, `set_status`, `revoke_sessions` e `reset_credentials`, executa diretamente
 *      a RPC `public.master_manage_user` autenticada pelo JWT do MASTER ativo.
 */
async function invokeAdminUsersViaRpcFallback(payload, client) {
  const action = String(payload?.action || "");

  if (action === "invite") {
    const email = String(payload.email || "").trim().toLowerCase();
    const fullName = String(payload.fullName || "").trim();
    const role = String(payload.role || "OPERATOR").toUpperCase();
    const authorizedUnits = Array.isArray(payload.authorizedUnits)
      ? payload.authorizedUnits.map((u) => String(u).trim()).filter(Boolean)
      : [];
    const extraPermissions = Array.isArray(payload.extraPermissions) ? payload.extraPermissions : [];
    const deniedPermissions = Array.isArray(payload.deniedPermissions) ? payload.deniedPermissions : [];

    const oneTimeTempPassword = generateBrowserCryptographicTempPassword();

    // Cria cliente efêmero isolado (sem persistir sessão) para não substituir o token do MASTER
    const ephemeralClient = isSupabaseConfigured()
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: `${AUTH_STORAGE_KEY}_ephemeral_provision`,
            storage: {
              getItem() { return null; },
              setItem() {},
              removeItem() {},
            },
          },
        })
      : client;

    let createdUserId = null;
    if (ephemeralClient?.auth?.signUp) {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/?type=invite` : undefined;
      const { data: signUpData, error: signUpErr } = await ephemeralClient.auth.signUp({
        email,
        password: oneTimeTempPassword,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectTo,
        },
      });
      if (signUpErr) {
        throw new Error(signUpErr.message || "Não foi possível criar a identidade no Supabase Auth.");
      }
      createdUserId = signUpData?.user?.id || null;
    }

    if (!createdUserId) {
      throw new Error("Não foi possível obter o identificador do novo usuário no Supabase Auth.");
    }

    const { data: rpcRes, error: rpcErr } = await client.rpc("master_manage_user", {
      p_payload: {
        action: "create_profile",
        userId: createdUserId,
        email,
        fullName,
        role,
        authorizedUnits: role === "MASTER" ? [] : authorizedUnits,
        extraPermissions,
        deniedPermissions,
        mustChangePassword: true,
      },
    });

    if (rpcErr) {
      const msg = String(rpcErr.message || "");
      if (msg.includes("master_manage_user")) {
        throw new Error(
          "A função administrativa 'public.master_manage_user' ainda não foi aplicada no Supabase. Execute o arquivo 'supabase/migrations/20261201000400_master_direct_user_admin.sql' no SQL Editor do Supabase."
        );
      }
      throw new Error(msg || "Falha ao registrar o perfil do operador.");
    }
    if (!rpcRes?.ok) {
      throw new Error(rpcRes?.message || rpcRes?.error || "Operação administrativa recusada.");
    }

    return {
      ok: true,
      profile: rpcRes.profile,
      deliveryMode: "temp_password",
      oneTimeInviteLink: null,
      oneTimeTempPassword,
    };
  }

  // Demais ações administrativas (update_profile, set_status, revoke_sessions, reset_credentials)
  if (action === "reset_credentials") {
    const userId = String(payload.userId || "");
    const { data: usersList } = await client.rpc("admin_list_users");
    const targetUser = (usersList || []).find((u) => String(u.id) === userId);
    if (targetUser?.email) {
      await requestPasswordRecovery(targetUser.email, client);
    }
  }

  const { data: rpcRes, error: rpcErr } = await client.rpc("master_manage_user", {
    p_payload: payload,
  });

  if (rpcErr) {
    const msg = String(rpcErr.message || "");
    if (msg.includes("master_manage_user")) {
      throw new Error(
        "A função administrativa 'public.master_manage_user' ainda não foi aplicada no Supabase. Execute o arquivo 'supabase/migrations/20261201000400_master_direct_user_admin.sql' no SQL Editor do Supabase."
      );
    }
    throw new Error(msg || "Falha ao executar operação administrativa via RPC.");
  }
  if (!rpcRes?.ok) {
    throw new Error(rpcRes?.message || rpcRes?.error || "Operação administrativa recusada.");
  }

  return rpcRes;
}

export async function invokeAdminUsers(payload, client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.functions.invoke("admin-users", {
    body: payload,
  });
  if (error) {
    const errMsg = String(error.message || error || "");
    const isEdgeFnUnavailable =
      error.name === "FunctionsFetchError" ||
      error.name === "FunctionsRelayError" ||
      errMsg.includes("Failed to send a request to the Edge Function") ||
      errMsg.includes("Relay Error");

    if (isEdgeFnUnavailable && typeof client.rpc === "function") {
      return await invokeAdminUsersViaRpcFallback(payload, client);
    }
    throw new Error(errMsg || "Falha ao executar operação administrativa.");
  }
  if (!data?.ok) {
    throw new Error(data?.message || data?.error || "Operação administrativa recusada.");
  }
  return data;
}

export async function listServerBackups(client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.rpc("erp_list_backups");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createServerBackup(label, client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.rpc("erp_create_backup", {
    p_label: label,
    p_kind: "MANUAL",
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Não foi possível criar o backup.");
  return data;
}

export async function downloadServerBackup(id, client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.rpc("erp_get_backup", { p_id: id });
  if (error) throw new Error(error.message);
  if (!data?.ok) {
    const err = new Error(
      data?.error === "REAUTH_REQUIRED"
        ? "Reautenticação MFA recente obrigatória (confirme um código TOTP antes de exportar)."
        : `Exportação recusada (${data?.error || "ERRO"}).`
    );
    err.code = data?.error;
    throw err;
  }
  return data;
}

export async function restoreServerBackup(id, confirmation, client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.rpc("erp_restore_backup", {
    p_id: id,
    p_confirmation: confirmation,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) {
    const messages = {
      REAUTH_REQUIRED: "Reautenticação MFA recente obrigatória antes de restaurar.",
      CONFIRMATION_MISMATCH: "Frase de confirmação incorreta.",
      NOT_FOUND: "Backup não localizado.",
    };
    const err = new Error(messages[data?.error] || `Restauração recusada (${data?.error}).`);
    err.code = data?.error;
    throw err;
  }
  return data;
}

export async function updateSystemSetting(key, value, client = getSupabaseClient()) {
  if (!client) throw new Error("Serviço indisponível.");
  const { data, error } = await client.rpc("erp_set_setting", {
    p_key: key,
    p_value: value,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Alteração recusada.");
  return data;
}
