#!/usr/bin/env node
// =============================================================================
// PROVISIONAMENTO SEGURO DA PRIMEIRA CONTA MASTER E RECUPERAÇÃO BREAK-GLASS
// Suporta automaticamente:
//   1. Backend PostgreSQL Local (`npm run dev` / `.data/pgdata`) — quando
//      `SUPABASE_URL` não está definida no ambiente.
//   2. Supabase Cloud — quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
//      estão definidas nas variáveis de ambiente.
//
// Nenhuma credencial, senha padrão ou conta genérica é fixada em código.
//
// Exemplos:
//   npm run provision:master -- --email seu.nome@uniaosupermercados.com.br --name "Seu Nome"
//   npm run provision:master -- --recover --i-understand-break-glass --email seu.nome@uniaosupermercados.com.br --name "Seu Nome"
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createErpBackend } from "../server/erpBackend.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");

function parseArgs(argv) {
  const out = {
    mode: "link",
    recover: false,
    breakGlassAck: false,
    origin: "http://localhost:5173",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--mode") out.mode = argv[++i]; // 'invite' | 'link'
    else if (a === "--redirect-to" || a === "--origin") out.origin = argv[++i];
    else if (a === "--recover") out.recover = true;
    else if (a === "--i-understand-break-glass") out.breakGlassAck = true;
  }
  return out;
}

async function provisionAgainstLocalBackend({ email, fullName, recover, origin }) {
  const secretFile = path.join(PROJECT_ROOT, ".data/admin.secret");

  // 1. Se o servidor `npm run dev` já estiver em execução na porta local, utiliza o canal loopback autenticado
  if (fs.existsSync(secretFile)) {
    const secret = fs.readFileSync(secretFile, "utf8").trim();
    const base = String(origin || "http://localhost:5173").replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/api/v9/internal/bootstrap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Bootstrap-Secret": secret,
        },
        body: JSON.stringify({ email, fullName, recover, origin: base }),
      });
      if (res.headers.get("content-type")?.includes("application/json")) {
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || json?.error || "Operação recusada pelo servidor local.");
        }
        return { profile: json.profile, actionLink: json.actionLink, targetLabel: "PostgreSQL Local (via servidor ativo)" };
      }
    } catch (err) {
      const msg = String(err?.message || err);
      if (
        !msg.toLowerCase().includes("fetch failed") &&
        !msg.toLowerCase().includes("econnrefused")
      ) {
        throw err;
      }
    }
  }

  // 2. Caso o servidor não esteja rodando no momento, abre `.data/pgdata` diretamente e fecha em seguida
  const backend = await createErpBackend();
  try {
    const out = await backend.bootstrapFirstMaster({
      email,
      fullName,
      recover,
      origin,
    });
    return { ...out, targetLabel: "PostgreSQL Local (.data/pgdata)" };
  } finally {
    await backend.close();
  }
}

async function provisionAgainstSupabaseCloud({
  supabaseUrl,
  serviceKey,
  email,
  fullName,
  mode,
  recover,
  origin,
}) {
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!recover) {
    const { data: existingMasters, error: checkErr } = await sb
      .from("erp_profiles")
      .select("id, email, status")
      .eq("role", "MASTER")
      .in("status", ["PENDING", "ACTIVE"]);

    if (checkErr) {
      throw new Error(`Erro ao consultar erp_profiles: ${checkErr.message}`);
    }
    if (existingMasters && existingMasters.length > 0) {
      throw new Error(
        "BLOQUEADO: Já existe conta MASTER provisionada. Utilize o módulo 'Usuários e acessos' com um MASTER ativo."
      );
    }
  }

  let userId;
  let actionLink = null;

  const { data: existingProfile } = await sb
    .from("erp_profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.id) {
    userId = existingProfile.id;
    if (recover) {
      const { data: factors } = await sb.auth.admin.mfa.listFactors({ userId });
      for (const f of factors?.factors || []) {
        await sb.auth.admin.mfa.deleteFactor({ id: f.id, userId });
      }
    }
    const { data: linkRes, error: linkErr } = await sb.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: origin || undefined },
    });
    if (linkErr) throw new Error(linkErr.message);
    actionLink = linkRes?.properties?.action_link || null;
  } else if (mode === "link") {
    const { data: linkRes, error: linkErr } = await sb.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: fullName }, redirectTo: origin || undefined },
    });
    if (linkErr || !linkRes?.user?.id) throw new Error(linkErr?.message || "Falha ao gerar link.");
    userId = linkRes.user.id;
    actionLink = linkRes.properties?.action_link || null;
  } else {
    const { data: invRes, error: invErr } = await sb.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: origin || undefined,
    });
    if (invErr || !invRes?.user?.id) throw new Error(invErr?.message || "Falha ao enviar convite.");
    userId = invRes.user.id;
  }

  const rpcName = recover ? "admin_recover_master" : "admin_bootstrap_first_master";
  const { data: profile, error: rpcErr } = await sb.rpc(rpcName, {
    p_user_id: userId,
    p_email: email,
    p_full_name: fullName,
  });
  if (rpcErr) throw new Error(rpcErr.message);

  return { profile, actionLink, targetLabel: "Supabase Cloud" };
}

async function main() {
  const args = parseArgs(process.argv);
  const email = String(args.email || "").trim().toLowerCase();
  const fullName = String(args.name || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error(
      'Uso: npm run provision:master -- --email seu.email@uniaosupermercados.com.br --name "Nome Completo"'
    );
    process.exit(1);
  }
  if (fullName.length < 3) {
    console.error("ERRO: Informe o nome completo do responsável com --name.");
    process.exit(1);
  }
  if (args.recover && !args.breakGlassAck) {
    console.error(
      "ERRO: O modo --recover exige confirmação explícita com --i-understand-break-glass."
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result =
    supabaseUrl && serviceKey
      ? await provisionAgainstSupabaseCloud({
          supabaseUrl,
          serviceKey,
          email,
          fullName,
          mode: args.mode,
          recover: args.recover,
          origin: args.origin,
        })
      : await provisionAgainstLocalBackend({
          email,
          fullName,
          recover: args.recover,
          origin: args.origin,
        });

  console.log("=================================================================");
  console.log(args.recover ? "RECUPERAÇÃO MASTER CONCLUÍDA" : "PRIMEIRO MASTER PROVISIONADO");
  console.log("=================================================================");
  console.log(`Ambiente : ${result.targetLabel}`);
  console.log(`ID Auth  : ${result.profile.id}`);
  console.log(`E-mail   : ${result.profile.email}`);
  console.log(`Status   : ${result.profile.status}`);
  if (result.actionLink) {
    console.log("\nLINK DE ATIVAÇÃO DE USO ÚNICO (abra no navegador com `npm run dev` rodando):");
    console.log(result.actionLink);
  } else {
    console.log("\nConvite enviado para o e-mail corporativo informado.");
  }
  console.log("\nAo abrir o link:");
  console.log("  1. Defina sua senha definitiva (>= 12 caracteres, maiúscula, minúscula, número e símbolo).");
  console.log("  2. Cadastre a chave TOTP no seu aplicativo autenticador (Google/Microsoft Authenticator ou 1Password).");
}

main().catch((err) => {
  console.error("ERRO:", err?.message || err);
  process.exit(1);
});
