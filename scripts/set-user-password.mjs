#!/usr/bin/env node
// =============================================================================
// DEFINIÇÃO DIRETA DE SENHA DE DESENVOLVIMENTO LOCAL — WORKFORCE ERP v9.0
// Uso: node scripts/set-user-password.mjs --email seu@email.com --password "SuaSenha#123"
// =============================================================================

import process from "node:process";
import { createErpBackend } from "../server/erpBackend.mjs";
import { hashPasswordScrypt } from "../server/totp.mjs";
import { evaluatePassword } from "../src/domain/passwordPolicy.js";

function parseArgs(argv) {
  const out = {
    email: "ygoncalvesmota@gmail.com",
    password: "UniaoSuper#2026",
    name: "Yan Lucca Gonçalves Mota",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--password") out.password = argv[++i];
    else if (a === "--name") out.name = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const cleanEmail = String(args.email).trim().toLowerCase();
  const password = String(args.password);

  const evalResult = evaluatePassword(password, { email: cleanEmail, fullName: args.name });
  if (!evalResult.valid) {
    console.error("ERRO: A senha não atende aos requisitos de segurança:");
    for (const r of evalResult.rules) {
      if (!r.ok) console.error(`  - ${r.label}`);
    }
    process.exit(1);
  }

  const backend = await createErpBackend();
  try {
    const hash = hashPasswordScrypt(password);

    // 1. Busca ou cria usuário no schema auth
    let uRes = await backend.db.query("select id from auth.users where lower(email) = $1", [cleanEmail]);
    let userId;
    if (uRes.rows.length === 0) {
      const insUser = await backend.db.query(
        "insert into auth.users (email, encrypted_password, full_name) values ($1, $2, $3) returning id",
        [cleanEmail, hash, args.name]
      );
      userId = insUser.rows[0].id;
    } else {
      userId = uRes.rows[0].id;
      await backend.db.query(
        "update auth.users set encrypted_password = $1, full_name = $2 where id = $3",
        [hash, args.name, userId]
      );
    }

    // 2. Limpa fatores MFA antigos para permitir novo cadastramento limpo na tela
    await backend.db.query("delete from auth.mfa_factors where user_id = $1", [userId]);

    // 3. Atualiza perfil em public.erp_profiles mantendo status ACTIVE e limpando must_change_password
    const targetUnits = ["LOJA_01", "LOJA_02", "LOJA_03"];
    await backend.db.query(
      `update public.erp_profiles
          set status = 'ACTIVE',
              authorized_units = $2,
              must_change_password = false,
              full_name = $3
        where id = $1`,
      [userId, targetUnits, args.name]
    );

    // 4. Limpa sessões antigas
    await backend.db.query("delete from auth.sessions where user_id = $1", [userId]);

    console.log("=================================================================");
    console.log("CONTA E SENHA CONFIGURADAS COM SUCESSO");
    console.log("=================================================================");
    console.log("E-mail   :", cleanEmail);
    console.log("Senha    :", password);
    console.log("Perfil   : MASTER");
    console.log("Lojas    :", targetUnits.join(", "));
    console.log("=================================================================");
  } finally {
    await backend.close();
  }
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
