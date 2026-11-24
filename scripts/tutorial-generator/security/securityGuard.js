// =============================================================================
// GUARDIÃO DE SEGURANÇA, ALLOWLIST DE REDE E ISOLAMENTO DE AMBIENTE (PRIORIDADE 1)
// Verifica o código-fonte, bloqueia tráfego externo por allowlist, injeta base
// 100% fictícia, impede ações destrutivas e aborta caso o isolamento falhe.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import {
  buildFictitiousErpDatabase,
  DEMO_OPERATOR_SESSION,
  FORBIDDEN_PRODUCTION_TOKENS,
} from "./fictitiousSeed.js";

export class SecurityIsolationAbortError extends Error {
  constructor(message, details = {}) {
    super(`[ABORTADO POR SEGURANÇA] ${message}`);
    this.name = "SecurityIsolationAbortError";
    this.details = details;
  }
}

/**
 * 1. Verifica estaticamente a persistência atual do ERP e confirma se existem
 * credenciais ou endpoints de produção no código (mascarando segredos nos logs).
 */
export function auditErpPersistenceAndSecrets(workspaceRoot) {
  const repoPath = path.join(workspaceRoot, "src", "services", "erpRepository.js");
  const seedPath = path.join(workspaceRoot, "src", "domain", "seedLoja03.js");

  const repoContent = fs.existsSync(repoPath) ? fs.readFileSync(repoPath, "utf8") : "";
  const seedContent = fs.existsSync(seedPath) ? fs.readFileSync(seedPath, "utf8") : "";

  const urlMatch = repoContent.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  const jwtMatch = repoContent.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  const hasRealCompanyInSeed = seedContent.includes("YUARA PRESTADORA");

  return {
    checkedAt: new Date().toISOString(),
    repositoryFile: "src/services/erpRepository.js",
    seedFile: "src/domain/seedLoja03.js",
    productionEndpointDetected: Boolean(urlMatch),
    maskedEndpoint: urlMatch
      ? `https://${urlMatch[1].slice(0, 4)}***[REDACTED]***.supabase.co`
      : null,
    hardcodedAnonJwtDetected: Boolean(jwtMatch),
    maskedJwtPreview: jwtMatch ? `${jwtMatch[0].slice(0, 10)}...[REDACTED_JWT]` : null,
    realPiiInDefaultSeedDetected: hasRealCompanyInSeed,
    persistenceMechanism: {
      remoteTable: "configuracoes (JSONB particionado __ERP_PARTITIONED_CORE_V8__ e __ERP_SCHED_V8__*)",
      localStorageCacheKey: "erp_relational_db_v8_cache",
      sessionStorageKey: "erp_v8_verified_operator_session",
    },
    vulnerabilitiesRegisteredForIndependentFix: [
      {
        id: "VULN-01",
        severity: "HIGH",
        title: "Endpoint e Chave Anon do Supabase de Produção Hardcoded como Fallback",
        location: "src/services/erpRepository.js:10-13",
        mitigationInAutoTour: "Bloqueio estrito por Allowlist de Rede (apenas localhost/127.0.0.1 permitido).",
      },
      {
        id: "VULN-02",
        severity: "HIGH",
        title: "Dados Reais de Colaboradores e CNPJ no Seed Padrão (seedLoja03.js)",
        location: "src/domain/seedLoja03.js:16-655",
        mitigationInAutoTour: "Substituição pré-boot no localStorage por base 100% fictícia (fictitiousSeed.js) + varredura anti-vazamento no DOM.",
      },
      {
        id: "VULN-03",
        severity: "MEDIUM",
        title: "Validação RBAC e Autenticação Nominal Executadas Exclusivamente em Cliente",
        location: "src/App.jsx:503-511 e src/modules/AdminAndAuditModule.jsx:169-175",
        mitigationInAutoTour: "Registrado para correção futura via RLS no Supabase; preservado intacto conforme restrição da Etapa 2.",
      },
    ],
  };
}

/**
 * 2, 3, 4 e 5. Configura no BrowserContext do Playwright:
 * - Lista estrita de destinos permitidos (Allowlist: apenas localhost / 127.0.0.1).
 * - Injeção pré-boot da base 100% fictícia em localStorage e sessionStorage.
 * - Bloqueio de ações destrutivas (Restaurar Seed Real, Limpar Mês, Exclusões).
 */
export async function setupIsolatedDemoContext(context, options = {}) {
  const allowedHosts = new Set(["localhost", "127.0.0.1"]);
  const fictitiousDb = options.fictitiousDb || buildFictitiousErpDatabase();
  const operatorSession = options.operatorSession || DEMO_OPERATOR_SESSION;
  const preventDestructiveActions = options.preventDestructiveActions !== false;

  const networkAudit = {
    allowlistHosts: Array.from(allowedHosts),
    allowedRequestsCount: 0,
    blockedExternalRequests: [],
    leakedExternalRequests: [],
    preventedDestructiveActions: [],
  };

  // 4. Bloqueio de rede por lista de destinos permitidos (Allowlist)
  await context.route("**/*", async (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();

    if (reqUrl.startsWith("data:") || reqUrl.startsWith("blob:") || reqUrl.startsWith("about:")) {
      networkAudit.allowedRequestsCount += 1;
      return route.continue();
    }

    let parsed;
    try {
      parsed = new URL(reqUrl);
    } catch {
      networkAudit.blockedExternalRequests.push({
        timestamp: new Date().toISOString(),
        method,
        url: "[INVALID_URL]",
        reason: "URL_PARSE_ERROR",
      });
      return route.abort("blockedbyclient");
    }

    if (!allowedHosts.has(parsed.hostname)) {
      // Mascara o subdomínio de produção nos logs para não expor credenciais/endpoints
      const maskedUrl = `${parsed.protocol}//${parsed.hostname.replace(/^([a-z0-9]{4})[a-z0-9]+/i, "$1***")}${parsed.pathname}`;
      networkAudit.blockedExternalRequests.push({
        timestamp: new Date().toISOString(),
        method,
        maskedUrl,
        reason: "HOST_NOT_IN_ALLOWLIST",
      });

      // Para chamadas REST do cliente Supabase, retorna erro controlado offline
      // garantindo que loadDatabase() caia imediatamente para o localStorage fictício
      // e que nenhuma escrita jamais saia da máquina local.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: null,
          error: {
            message: "BLOCKED_BY_AUTOTOUR_ALLOWLIST_SANDBOX",
            code: "SANDBOX_ISOLATED",
          },
        }),
      });
    }

    networkAudit.allowedRequestsCount += 1;
    return route.continue();
  });

  // 2, 3 e 5. Injeção determinística da base 100% fictícia e trava contra ações destrutivas
  await context.addInitScript(
    ({ dbJson, sessionJson, blockDestructive }) => {
      window.__AUTOTOUR_SANDBOX_ACTIVE__ = true;
      window.__AUTOTOUR_PREVENTED_DESTRUCTIVE__ = [];

      // Garante que o cache v7 legado nunca seja usado e que o cache v8 tenha apenas dados fictícios
      try {
        window.localStorage.removeItem("erp_relational_db_v7_cache");
        const existing = window.localStorage.getItem("erp_relational_db_v8_cache");
        if (!existing || existing.includes("YUARA") || existing.includes("comp_yuara_03")) {
          window.localStorage.setItem("erp_relational_db_v8_cache", dbJson);
        }
        window.sessionStorage.setItem("erp_v8_verified_operator_session", sessionJson);
      } catch (e) {
        console.error("Erro ao inicializar storage isolado:", e);
      }

      // Protege localStorage.setItem contra tentativa acidental de gravar o seed real
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          key === "erp_relational_db_v8_cache" &&
          typeof value === "string" &&
          (value.includes("YUARA PRESTADORA") || value.includes("40.633.037/0001-71"))
        ) {
          window.__AUTOTOUR_PREVENTED_DESTRUCTIVE__.push({
            timestamp: new Date().toISOString(),
            type: "BLOCKED_REAL_SEED_WRITE_TO_STORAGE",
          });
          return;
        }
        return origSetItem.call(this, key, value);
      };

      // 5. Impede diálogos destrutivos (Restaurar Seed, Exclusão, Impressão bloqueante)
      window.confirm = function (msg) {
        if (blockDestructive) {
          window.__AUTOTOUR_PREVENTED_DESTRUCTIVE__.push({
            timestamp: new Date().toISOString(),
            type: "BLOCKED_WINDOW_CONFIRM_DESTRUCTIVE",
            message: String(msg),
          });
          return false;
        }
        return true;
      };

      window.print = function () {
        window.__AUTOTOUR_PRINT_INTERCEPTED__ = true;
      };
    },
    {
      dbJson: JSON.stringify(fictitiousDb),
      sessionJson: JSON.stringify(operatorSession),
      blockDestructive: preventDestructiveActions,
    }
  );

  return {
    fictitiousDb,
    operatorSession,
    networkAudit,
  };
}

/**
 * 6. Comprova o isolamento em tempo de execução ou interrompe imediatamente a automação.
 */
export async function verifyIsolationOrAbort(page, networkAudit) {
  const domAndStorageCheck = await page.evaluate((forbiddenTokens) => {
    const bodyText = document.body ? document.body.innerText : "";
    const rawStorage = window.localStorage.getItem("erp_relational_db_v8_cache") || "";
    const sandboxFlag = Boolean(window.__AUTOTOUR_SANDBOX_ACTIVE__);

    const leakedInDom = forbiddenTokens.filter((token) =>
      bodyText.toUpperCase().includes(token.toUpperCase())
    );
    const leakedInStorage = forbiddenTokens.filter((token) =>
      rawStorage.toUpperCase().includes(token.toUpperCase())
    );

    let parsedCompany = null;
    try {
      const parsed = JSON.parse(rawStorage);
      parsedCompany = parsed?.companies?.[0]?.legalName || null;
    } catch {
      parsedCompany = null;
    }

    return {
      sandboxFlag,
      parsedCompany,
      leakedInDom,
      leakedInStorage,
      preventedDestructive: window.__AUTOTOUR_PREVENTED_DESTRUCTIVE__ || [],
    };
  }, FORBIDDEN_PRODUCTION_TOKENS);

  if (domAndStorageCheck.preventedDestructive?.length) {
    networkAudit.preventedDestructiveActions.push(...domAndStorageCheck.preventedDestructive);
  }

  if (!domAndStorageCheck.sandboxFlag) {
    throw new SecurityIsolationAbortError(
      "Flag de sandbox (__AUTOTOUR_SANDBOX_ACTIVE__) não encontrada na página.",
      domAndStorageCheck
    );
  }

  if (
    domAndStorageCheck.leakedInDom.length > 0 ||
    domAndStorageCheck.leakedInStorage.length > 0
  ) {
    throw new SecurityIsolationAbortError(
      "Dados reais do seed de produção foram detectados no DOM ou no Storage! Execução abortada.",
      {
        leakedInDom: domAndStorageCheck.leakedInDom,
        leakedInStorage: domAndStorageCheck.leakedInStorage,
      }
    );
  }

  if (networkAudit.leakedExternalRequests.length > 0) {
    throw new SecurityIsolationAbortError(
      "Conexão externa fora da allowlist detectada! Execução abortada.",
      { leakedExternalRequests: networkAudit.leakedExternalRequests }
    );
  }

  return {
    isolated: true,
    verifiedAt: new Date().toISOString(),
    activeDemoCompany: domAndStorageCheck.parsedCompany,
    leakedInDomCount: 0,
    leakedInStorageCount: 0,
    blockedExternalRequestsCount: networkAudit.blockedExternalRequests.length,
  };
}
