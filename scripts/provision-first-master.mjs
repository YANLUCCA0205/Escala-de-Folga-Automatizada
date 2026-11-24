#!/usr/bin/env node
// =============================================================================
// PROVISIONAMENTO SEGURO DA PRIMEIRA CONTA MASTER E RECUPERAÇÃO BREAK-GLASS
// Execução exclusiva em ambiente administrativo controlado (CLI / servidor).
//
// Variáveis de ambiente obrigatórias (NUNCA fixadas em código):
//   SUPABASE_URL              — URL do projeto Supabase
//   SUPABASE_SERVICE_ROLE_KEY — Chave administrativa secreta (service_role)
//
// Exemplos de uso:
//   # 1. Provisionar o primeiro MASTER via convite oficial por e-mail:
//   node scripts/provision-first-master.mjs --email diretoria@uniaosupermercados.com.br --name "Diretoria Governança"
//
//   # 2. Provisionar o primeiro MASTER gerando link único (quando SMTP ainda não está ativo):
//   node scripts/provision-first-master.mjs --email diretoria@uniaosupermercados.com.br --name "Diretoria Governança" --mode link
//
//   # 3. Recuperação administrativa (Break-Glass) somente quando não há MASTER ativo:
//   node scripts/provision-first-master.mjs --recover --i-understand-break-glass --email diretoria@uniaosupermercados.com.br --name "Diretoria Governança" --mode link
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import process from "node:process";

function parseArgs(argv) {
  const out = { mode: "invite", recover: false, breakGlassAck: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--mode") out.mode = argv[++i]; // 'invite' | 'link'
    else if (a === "--redirect-to") out.redirectTo = argv[++i];
    else if (a === "--recover") out.recover = true;
    else if (a === "--i-understand-break-glass") out.breakGlassAck = true;
  }
  return out;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "ERRO: Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente antes de executar este procedimento."
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const email = String(args.email || "").trim().toLowerCase();
  const fullName = String(args.name || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error("ERRO: Informe um e-mail corporativo nominal válido com --email.");
    process.exit(1);
  }
  if (fullName.length < 3) {
    console.error("ERRO: Informe o nome completo do responsável com --name.");
    process.exit(1);
  }
  if (args.recover && !args.breakGlassAck) {
    console.error(
      "ERRO: O modo --recover exige confirmação explícita com --i-understand-break-glass (toda operação é gravada em auditoria BREAK_GLASS)."
    );
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verifica existência prévia antes de criar usuário no Auth
  if (!args.recover) {
    const { data: existingMasters, error: checkErr } = await sb
      .from("erp_profiles")
      .select("id, email, status")
      .eq("role", "MASTER")
      .in("status", ["PENDING", "ACTIVE"]);

    if (checkErr) {
      console.error("ERRO ao consultar erp_profiles (verifique se as migrations foram aplicadas):", checkErr.message);
      process.exit(1);
    }
    if (existingMasters && existingMasters.length > 0) {
      console.error(
        "BLOQUEADO: Já existe conta MASTER provisionada. Utilize o módulo 'Usuários e acessos' com um MASTER ativo."
      );
      process.exit(1);
    }
  }

  let userId;
  let actionLink = null;

  // Verifica se o e-mail já existe em auth.users (ex.: recuperação de conta existente)
  const { data: existingProfile } = await sb
    .from("erp_profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.id) {
    userId = existingProfile.id;
    // Em recuperação, remove fatores MFA antigos caso perdidos e gera link de redefinição
    if (args.recover) {
      const { data: factors } = await sb.auth.admin.mfa.listFactors({ userId });
      for (const f of factors?.factors || []) {
        await sb.auth.admin.mfa.deleteFactor({ id: f.id, userId });
      }
    }
    const { data: linkRes, error: linkErr } = await sb.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: args.redirectTo || undefined },
    });
    if (linkErr) {
      console.error("ERRO ao gerar link de recuperação no Supabase Auth:", linkErr.message);
      process.exit(1);
    }
    actionLink = linkRes?.properties?.action_link || null;
  } else if (args.mode === "link") {
    const { data: linkRes, error: linkErr } = await sb.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: fullName }, redirectTo: args.redirectTo || undefined },
    });
    if (linkErr || !linkRes?.user?.id) {
      console.error("ERRO ao gerar convite único no Supabase Auth:", linkErr?.message);
      process.exit(1);
    }
    userId = linkRes.user.id;
    actionLink = linkRes.properties?.action_link || null;
  } else {
    const { data: invRes, error: invErr } = await sb.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: args.redirectTo || undefined,
    });
    if (invErr || !invRes?.user?.id) {
      console.error("ERRO ao enviar convite por e-mail no Supabase Auth:", invErr?.message);
      process.exit(1);
    }
    userId = invRes.user.id;
  }

  const rpcName = args.recover ? "admin_recover_master" : "admin_bootstrap_first_master";
  const { data: profile, error: rpcErr } = await sb.rpc(rpcName, {
    p_user_id: userId,
    p_email: email,
    p_full_name: fullName,
  });

  if (rpcErr) {
    console.error(`ERRO na função ${rpcName}:`, rpcErr.message);
    process.exit(1);
  }

  console.log("=================================================================");
  console.log(args.recover ? "RECUPERAÇÃO MASTER CONCLUÍDA" : "PRIMEIRO MASTER PROVISIONADO");
  console.log("=================================================================");
  console.log(`ID Auth : ${profile.id}`);
  console.log(`E-mail  : ${profile.email}`);
  console.log(`Status  : ${profile.status}`);
  console.log("Próximos passos obrigatórios:");
  console.log("  1. Acesse o link de uso único e defina uma senha forte (>= 12 caracteres).");
  console.log("  2. No primeiro acesso, cadastre obrigatoriamente o autenticador MFA (TOTP).");
  if (actionLink) {
    console.log("\nLINK DE USO ÚNICO (entregue em canal seguro; expira automaticamente):");
    console.log(actionLink);
  } else {
    console.log("\nConvite enviado para a caixa de entrada corporativa informada.");
  }
}

main().catch((err) => {
  console.error("Falha inesperada:", err);
  process.exit(1);
});
