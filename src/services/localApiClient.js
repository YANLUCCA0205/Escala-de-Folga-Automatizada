// =============================================================================
// CLIENTE HTTP DO BACKEND POSTGRESQL LOCAL (`/api/v9`) — WORKFORCE ERP v9.0
// Implementa a mesma interface de `auth`, `from`, `rpc` e `functions` do cliente
// Supabase, conversando exclusivamente com o servidor Node.js + PostgreSQL PGlite
// sob Row Level Security real. Nunca armazena senhas ou dados operacionais localmente.
// =============================================================================

const LOCAL_SESSION_KEY = "uniao_erp_v9_local_session";

function readStoredSession(storage) {
  try {
    const raw = storage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(storage, session) {
  try {
    if (!session) storage.removeItem(LOCAL_SESSION_KEY);
    else storage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignora bloqueio
  }
}

export function createLocalErpClient({
  baseUrl = "/api/v9",
  storage = typeof window !== "undefined" && window.sessionStorage
    ? window.sessionStorage
    : {
        _m: new Map(),
        getItem(k) { return this._m.get(k) ?? null; },
        setItem(k, v) { this._m.set(k, v); },
        removeItem(k) { this._m.delete(k); },
      },
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const listeners = new Set();
  const emit = (event, session) => {
    for (const cb of listeners) {
      try {
        cb(event, session);
      } catch {
        // Ignora erro de listener
      }
    }
  };

  async function apiFetch(subpath, { method = "GET", body, token } = {}) {
    if (!fetchImpl) {
      throw new Error("Failed to fetch: ambiente sem suporte HTTP.");
    }
    const headers = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const activeToken = token ?? readStoredSession(storage)?.access_token;
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`;
    }

    const res = await fetchImpl(`${baseUrl}${subpath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Failed to fetch: servidor de identidade indisponível.");
    }
    const json = await res.json();
    return { status: res.status, json };
  }

  // Consome automaticamente `?token=...` de convite ou recuperação de uso único na URL
  let pendingTokenPromise = null;
  async function consumeUrlOneTimeTokenIfPresent() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search || "");
    const rawToken = params.get("token");
    if (!rawToken) return null;

    if (!pendingTokenPromise) {
      pendingTokenPromise = (async () => {
        try {
          const { status, json } = await apiFetch("/auth/consume-token", {
            method: "POST",
            body: { token: rawToken },
            token: "",
          });
          // Remove imediatamente o token da barra de endereço (mantendo ?type=... para o fluxo de senha)
          params.delete("token");
          const cleanQuery = params.toString();
          const nextUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`;
          window.history?.replaceState?.({}, document.title, nextUrl);

          if (status === 200 && json?.ok && json.session) {
            writeStoredSession(storage, json.session);
            emit(
              json.tokenType === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN",
              json.session
            );
            return { session: json.session, tokenError: null };
          }
          return {
            session: null,
            tokenError: json?.message || "Link de uso único inválido ou expirado.",
          };
        } finally {
          pendingTokenPromise = null;
        }
      })();
    }
    return pendingTokenPromise;
  }

  return {
    isLocalBackendClient: true,

    auth: {
      onAuthStateChange(callback) {
        listeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                listeners.delete(callback);
              },
            },
          },
        };
      },

      async getSession() {
        const consumed = await consumeUrlOneTimeTokenIfPresent();
        if (consumed?.session) {
          return { data: { session: consumed.session }, error: null };
        }
        if (consumed?.tokenError) {
          return { data: { session: null }, error: new Error(consumed.tokenError) };
        }

        const stored = readStoredSession(storage);
        if (!stored?.access_token) {
          // Confirma disponibilidade do servidor local
          await apiFetch("/health", { method: "GET", token: "" });
          return { data: { session: null }, error: null };
        }

        const { status, json } = await apiFetch("/auth/session", {
          method: "GET",
          token: stored.access_token,
        });
        if (status !== 200 || !json?.ok) {
          writeStoredSession(storage, null);
          return { data: { session: null }, error: null };
        }
        const activeSession = { ...stored, user: json.user };
        writeStoredSession(storage, activeSession);
        return { data: { session: activeSession }, error: null };
      },

      async signInWithPassword({ email, password }) {
        const { status, json } = await apiFetch("/auth/login", {
          method: "POST",
          body: { email, password },
          token: "",
        });
        if (status !== 200 || !json?.ok || !json.session) {
          return {
            data: { session: null, user: null },
            error: new Error(json?.message || "Invalid login credentials"),
          };
        }
        writeStoredSession(storage, json.session);
        emit("SIGNED_IN", json.session);
        return {
          data: { session: json.session, user: json.session.user },
          error: null,
        };
      },

      async signOut() {
        const stored = readStoredSession(storage);
        writeStoredSession(storage, null);
        if (stored?.access_token) {
          await apiFetch("/auth/logout", {
            method: "POST",
            token: stored.access_token,
          }).catch(() => {});
        }
        emit("SIGNED_OUT", null);
        return { error: null };
      },

      async updateUser({ password }) {
        const { status, json } = await apiFetch("/auth/update-user", {
          method: "POST",
          body: { password },
        });
        if (status !== 200 || !json?.ok) {
          return { data: null, error: new Error(json?.message || "Falha ao atualizar senha.") };
        }
        return { data: { user: json.user }, error: null };
      },

      async resetPasswordForEmail(email) {
        await apiFetch("/auth/recover", {
          method: "POST",
          body: { email },
          token: "",
        });
        return { data: {}, error: null };
      },

      mfa: {
        async listFactors() {
          const { status, json } = await apiFetch("/auth/mfa/factors", { method: "GET" });
          if (status !== 200 || !json?.ok) {
            return { data: null, error: new Error("Falha ao listar fatores MFA.") };
          }
          return { data: { all: json.all || [], totp: json.totp || [] }, error: null };
        },

        async enroll({ factorType = "totp", friendlyName }) {
          const { status, json } = await apiFetch("/auth/mfa/enroll", {
            method: "POST",
            body: { factorType, friendlyName },
          });
          if (status !== 200 || !json?.ok) {
            return { data: null, error: new Error(json?.message || "Falha ao iniciar MFA.") };
          }
          return { data: { id: json.id, type: json.type, totp: json.totp }, error: null };
        },

        async unenroll({ factorId }) {
          await apiFetch("/auth/mfa/unenroll", {
            method: "POST",
            body: { factorId },
          });
          return { data: {}, error: null };
        },

        async challenge({ factorId }) {
          return { data: { id: `chal_${factorId}` }, error: null };
        },

        async verify({ factorId, code }) {
          const { status, json } = await apiFetch("/auth/mfa/verify", {
            method: "POST",
            body: { factorId, code },
          });
          if (status !== 200 || !json?.ok || !json.session) {
            return { data: null, error: new Error(json?.message || "Código inválido.") };
          }
          writeStoredSession(storage, json.session);
          emit("MFA_CHALLENGE_VERIFIED", json.session);
          return { data: json.session, error: null };
        },
      },
    },

    from(table) {
      const state = {
        table,
        filters: [],
        order: null,
        limit: null,
      };
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          state.filters.push({ op: "eq", column, value });
          return builder;
        },
        ilike(column, value) {
          state.filters.push({ op: "ilike", column, value });
          return builder;
        },
        gte(column, value) {
          state.filters.push({ op: "gte", column, value });
          return builder;
        },
        lte(column, value) {
          state.filters.push({ op: "lte", column, value });
          return builder;
        },
        order(column, opts = {}) {
          state.order = { column, ascending: Boolean(opts.ascending) };
          return builder;
        },
        limit(n) {
          state.limit = n;
          return builder;
        },
        then(onFulfilled, onRejected) {
          return apiFetch("/data/select", {
            method: "POST",
            body: state,
          })
            .then(({ status, json }) => {
              if (status !== 200 || !json?.ok) {
                return { data: null, error: new Error(json?.message || "Erro na consulta.") };
              }
              return { data: json.data || [], error: null };
            })
            .then(onFulfilled, onRejected);
        },
      };
      return builder;
    },

    async rpc(fnName, args = {}) {
      const { status, json } = await apiFetch(`/rpc/${fnName}`, {
        method: "POST",
        body: args,
      });
      if (status !== 200 || !json?.ok) {
        return { data: null, error: new Error(json?.message || json?.error || "Erro na RPC.") };
      }
      return { data: json.data, error: null };
    },

    functions: {
      async invoke(fnName, { body } = {}) {
        const { status, json } = await apiFetch(`/functions/${fnName}`, {
          method: "POST",
          body: body || {},
        });
        if (status >= 400 || !json?.ok) {
          return {
            data: json || null,
            error: new Error(json?.message || json?.error || "Operação administrativa recusada."),
          };
        }
        return { data: json, error: null };
      },
    },
  };
}
