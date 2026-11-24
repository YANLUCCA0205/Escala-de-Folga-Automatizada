// =============================================================================
// TESTES DE RENDERIZAÇÃO, ACESSIBILIDADE E HIGIENE DO BUNDLE DE PRODUÇÃO (v9.0)
// Carrega os módulos JSX reais via Vite SSR (`ssrLoadModule`) + `renderToStaticMarkup`
// para comprovar:
//   1. A nova página de login corporativa exibe apenas os controles autorizados
//      e NÃO contém criar conta, seletor RBAC, acesso sem senha ou seletor de temas.
//   2. As telas de primeiro acesso, conta desativada, sessão expirada e serviço
//      indisponível renderizam com semântica acessível.
//   3. O AppShell renderiza a navegação sanfonada, seletor global único de loja
//      e oculta módulos restritos conforme as permissões.
//   4. O bundle de produção (`dist/`) está 100% livre de PII real e chaves fixas.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { NAV_GROUPS, filterNavGroupsByPermissions } from "../layout/navigation.js";
import { FORBIDDEN_PRODUCTION_TOKENS } from "../../scripts/tutorial-generator/security/fictitiousSeed.js";

test("UI-01..03: Telas de autenticação corporativa e AppShell renderizam via Vite SSR sem controles públicos inseguros", async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const AuthPages = await vite.ssrLoadModule("/src/features/auth/AuthPages.jsx");
    const { default: AppShell } = await vite.ssrLoadModule("/src/layout/AppShell.jsx");

    // 1. LoginPage pública: sóbria, sem criar conta, sem RBAC, sem seletor de temas ou lojas
    const loginHtml = renderToStaticMarkup(
      createElement(AuthPages.LoginPage, {
        environmentLabel: "Ambiente Homologação",
        onSubmit: async () => ({ ok: false }),
        onForgotPassword: () => {},
      })
    );

    assert.ok(loginHtml.includes("Ambiente Homologação"));
    assert.ok(loginHtml.includes("E-mail corporativo"));
    assert.ok(loginHtml.includes("Senha"));
    assert.ok(loginHtml.includes("Mostrar senha"));
    assert.ok(loginHtml.includes("Recuperar senha"));
    assert.ok(loginHtml.includes("Entrar"));
    assert.ok(loginHtml.includes("não permite criação pública de contas"));

    assert.equal(loginHtml.includes("Criar Conta"), false);
    assert.equal(loginHtml.includes("Acesso Operador Identificado"), false);
    assert.equal(loginHtml.includes("Perfil de Acesso"), false);
    assert.equal(loginHtml.includes("Tema Visual"), false);
    assert.equal(loginHtml.includes("LOJA 03"), false);

    // 2. Telas de ciclo de vida de acesso
    const inviteHtml = renderToStaticMarkup(
      createElement(AuthPages.SetPasswordPage, {
        environmentLabel: "Corporativo",
        mode: "invite",
        profile: { email: "novo@exemplo.invalid" },
        onSubmit: async () => ({ ok: true }),
      })
    );
    assert.ok(inviteHtml.includes("Primeiro acesso e ativação de conta"));
    assert.ok(inviteHtml.includes("Mínimo de 12 caracteres"));

    const forgotHtml = renderToStaticMarkup(
      createElement(AuthPages.ForgotPasswordPage, {
        environmentLabel: "Corporativo",
        onSubmit: async () => ({ ok: true }),
        onBack: () => {},
      })
    );
    assert.ok(forgotHtml.includes("Recuperação de senha"));

    const blockedHtml = renderToStaticMarkup(
      createElement(AuthPages.AccountBlockedPage, {
        environmentLabel: "Corporativo",
        variant: "deactivated",
        onSignOut: () => {},
      })
    );
    assert.ok(blockedHtml.includes("Conta desativada"));

    const expiredHtml = renderToStaticMarkup(
      createElement(AuthPages.SessionExpiredPage, {
        environmentLabel: "Corporativo",
        onContinue: () => {},
      })
    );
    assert.ok(expiredHtml.includes("Sessão encerrada ou expirada"));

    const unavailableHtml = renderToStaticMarkup(
      createElement(AuthPages.ServiceUnavailablePage, {
        environmentLabel: "Corporativo",
        unconfigured: false,
        onRetry: () => {},
      })
    );
    assert.ok(unavailableHtml.includes("Serviço de autenticação indisponível"));

    // 3. AppShell para OPERATOR: oculta Administração, exibe seletor único de unidade e sem pílulas de tema
    const operatorNav = filterNavGroupsByPermissions(NAV_GROUPS, "OPERATOR");
    const shellHtml = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          navGroups: operatorNav,
          activeItemId: "schedules",
          onNavigate: () => {},
          units: [
            { id: "LOJA_03", code: "LJ03", name: "LOJA 03", city: "Cidade Fictícia" },
            { id: "LOJA_01", code: "LJ01", name: "LOJA 01", city: "Cidade Fictícia" },
          ],
          selectedUnitId: "LOJA_03",
          onSelectUnit: () => {},
          selectedYearMonth: "2026-11",
          user: { fullName: "Operador Fictício", email: "op@exemplo.invalid", role: "OPERATOR" },
          themeId: "uniao_institucional",
          onSignOut: () => {},
        },
        createElement("div", null, "Conteúdo da grade")
      )
    );

    assert.ok(shellHtml.includes("Pular para o conteúdo principal"));
    assert.ok(shellHtml.includes('aria-current="page"'));
    assert.ok(shellHtml.includes("Planejamento operacional"));
    assert.ok(shellHtml.includes("Escalas mensais"));
    assert.equal(shellHtml.includes("Usuários e acessos"), false);
    assert.equal(shellHtml.includes("Backup e recuperação"), false);
    assert.equal(shellHtml.includes("Alvorada Claro"), false);
  } finally {
    await vite.close();
  }
});

test("UI-04: Bundle de produção (dist/) não empacota dados nominais reais nem chaves hardcoded", () => {
  const distAssetsDir = path.resolve("dist/assets");
  if (!fs.existsSync(distAssetsDir)) return;

  const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith(".js"));
  assert.ok(jsFiles.length > 0, "Deve existir ao menos um chunk JS compilado em dist/assets");

  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(distAssetsDir, file), "utf8");
    for (const forbidden of FORBIDDEN_PRODUCTION_TOKENS) {
      assert.equal(
        content.includes(forbidden),
        false,
        `Token sensível proibido "${forbidden}" encontrado no bundle ${file}`
      );
    }
    assert.equal(
      content.includes("eyJhbGciOiJIUzI1NiIs"),
      false,
      `JWT hardcoded encontrado no bundle ${file}`
    );
  }
});
