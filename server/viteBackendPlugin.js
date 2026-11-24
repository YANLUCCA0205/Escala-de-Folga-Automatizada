// =============================================================================
// PLUGIN VITE DO BACKEND POSTGRESQL LOCAL — WORKFORCE ERP v9.0
// Monta `/api/v9/*` diretamente no `vite` (`npm run dev`) e `vite preview`,
// inicializando o banco PostgreSQL real (`.data/pgdata`) sob demanda.
// Se `VITE_SUPABASE_URL` estiver configurada no ambiente, o frontend utilizará
// o Supabase Cloud externo normalmente.
// =============================================================================

import { createErpBackend } from "./erpBackend.mjs";

export function erpLocalBackendPlugin() {
  let backendPromise = null;

  const getBackend = () => {
    if (!backendPromise) {
      backendPromise = createErpBackend().then((instance) => {
        console.log("\n  [Workforce ERP] Backend PostgreSQL + RLS ativo em /api/v9");
        return instance;
      });
    }
    return backendPromise;
  };

  const attachMiddleware = (middlewares) => {
    middlewares.use(async (req, res, next) => {
      if (!req.url || !req.url.startsWith("/api/v9/")) {
        return next();
      }
      try {
        const backend = await getBackend();
        await backend.handleApiRequest(req, res);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            ok: false,
            error: "BACKEND_INIT_FAILED",
            message: String(err?.message || err),
          })
        );
      }
    });
  };

  const closeBackend = async () => {
    if (!backendPromise) return;
    const p = backendPromise;
    backendPromise = null;
    try {
      const instance = await p;
      await instance.close();
    } catch {
      // ignora erro de fechamento
    }
  };

  return {
    name: "uniao-erp-local-postgres-backend",
    configureServer(server) {
      // Só pré-inicializa `.data/pgdata` quando há servidor HTTP real (`npm run dev`),
      // evitando abrir handles durante testes SSR em `middlewareMode: true`.
      if (!server.config?.server?.middlewareMode) {
        getBackend().catch((err) => {
          console.error("[Workforce ERP] Erro ao inicializar PostgreSQL local:", err);
        });
      }
      server.httpServer?.on("close", () => {
        closeBackend();
      });
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      getBackend().catch(() => {});
      server.httpServer?.on("close", () => {
        closeBackend();
      });
      attachMiddleware(server.middlewares);
    },
    async closeBundle() {
      await closeBackend();
    },
  };
}
