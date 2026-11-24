#!/usr/bin/env node
// =============================================================================
// MIGRAÇÃO CONTROLADA DO DOCUMENTO LEGADO (v7/v8) PARA PARTIÇÕES ISOLADAS (v9)
//
// Características de segurança:
//   - Modo padrão `--dry-run`: simula a divisão em partições, executa a prova
//     matemática de ida-e-volta (`verifyPartitionRoundtrip`) e exibe contagens
//     SEM gravar nada no banco.
//   - Com `--apply`: exige `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, cria um
//     ponto de restauração (`PRE_MIGRATION`) em `public.erp_backups`, grava as
//     partições em `public.erp_partitions` e importa logs históricos marcando
//     sessões sem autenticação verificada como `UNVERIFIED_LEGACY`.
//   - NÃO altera nem apaga a tabela legada `configuracoes`.
//
// Uso:
//   node scripts/migrate-legacy-to-partitions.mjs --file backups/backup_pre_v8_20261028.json
//   node scripts/migrate-legacy-to-partitions.mjs --source supabase --apply
// =============================================================================

import fs from "node:fs";
import crypto from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { upgradeDatabaseToV8 } from "../src/services/erpRepository.js";
import {
  splitDatabaseIntoPartitions,
  verifyPartitionRoundtrip,
} from "../src/services/partitionCodec.js";

function parseArgs(argv) {
  const out = { apply: false, source: "file", file: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--dry-run") out.apply = false;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--file") out.file = argv[++i];
  }
  return out;
}

function mapLegacyAuditVerification(log) {
  const v = String(log?.authVerificationStatus || "");
  if (v === "SYSTEM_SEED") return { origin: "SYSTEM_MIGRATION", verif: "SYSTEM_SEED" };
  if (
    v === "AUTORIA_NAO_VERIFICADA_LEGADO" ||
    v === "VERIFIED_OPERATOR_SESSION" ||
    v === "VERIFIED_LOCAL_AUTH" ||
    log?.actorEmail === "gestao.loja03@uniaosupermercados.com.br"
  ) {
    // Sessões antigas sem criptografia/servidor confiável JAMAIS recebem autoria verificada!
    return { origin: "LEGACY_IMPORT", verif: "UNVERIFIED_LEGACY" };
  }
  if (v === "VERIFIED_SUPABASE_AUTH") {
    return { origin: "LEGACY_IMPORT", verif: "VERIFIED_SESSION" };
  }
  return { origin: "LEGACY_IMPORT", verif: "UNVERIFIED_LEGACY" };
}

async function main() {
  const args = parseArgs(process.argv);
  let sb = null;

  if (args.apply || args.source === "supabase") {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error(
        "ERRO: Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para ler ou gravar no Supabase."
      );
      process.exit(1);
    }
    sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  let rawDb;
  if (args.source === "supabase") {
    const { data: v8 } = await sb
      .from("configuracoes")
      .select("dados")
      .eq("unidade", "__ERP_PARTITIONED_CORE_V8__")
      .eq("mes", "2026-ERP")
      .maybeSingle();
    if (v8?.dados) {
      rawDb = v8.dados;
    } else {
      const { data: v7 } = await sb
        .from("configuracoes")
        .select("dados")
        .eq("unidade", "__ERP_RELATIONAL_CORE_V7__")
        .eq("mes", "2026-ERP")
        .maybeSingle();
      rawDb = v7?.dados || null;
    }
    if (!rawDb) {
      console.error("ERRO: Nenhum documento legado v7/v8 encontrado na tabela `configuracoes`.");
      process.exit(1);
    }
  } else {
    if (!args.file || !fs.existsSync(args.file)) {
      console.error("ERRO: Informe um arquivo JSON válido com --file <caminho>.");
      process.exit(1);
    }
    rawDb = JSON.parse(fs.readFileSync(args.file, "utf8"));
  }

  const normalized = upgradeDatabaseToV8(rawDb);
  const partitions = splitDatabaseIntoPartitions(normalized);
  const report = verifyPartitionRoundtrip(normalized, partitions);

  console.log("=================================================================");
  console.log(`PLANO DE MIGRAÇÃO (${args.apply ? "EXECUÇÃO REAL --apply" : "SIMULAÇÃO --dry-run"})`);
  console.log("=================================================================");
  console.log(`Total de partições geradas : ${report.partitionCount}`);
  console.log(`Integridade ida-e-volta    : ${report.ok ? "APROVADA (0 divergências)" : "FALHOU"}`);
  console.table(report.checks);

  if (!report.ok) {
    console.error("ABORTADO: Divergências detectadas na validação de partições:", report.mismatches);
    process.exit(2);
  }

  if (!args.apply) {
    console.log("\nSimulação concluída com sucesso. Nenhuma alteração foi feita no banco.");
    console.log("Para aplicar no Supabase, execute novamente adicionando --apply.");
    return;
  }

  // 1. Backup pré-migração das partições atuais (se existirem)
  const { data: existingRows, error: exErr } = await sb.from("erp_partitions").select("*");
  if (exErr) {
    console.error("ERRO ao ler erp_partitions:", exErr.message);
    process.exit(1);
  }
  const snapshotPayload = existingRows || [];
  const payloadStr = JSON.stringify(snapshotPayload);
  const checksum = crypto.createHash("md5").update(payloadStr).digest("hex");

  const { error: bkpErr } = await sb.from("erp_backups").insert({
    created_by: null,
    kind: "PRE_MIGRATION",
    label: `Snapshot automático pré-migração (${new Date().toISOString()})`,
    partition_count: snapshotPayload.length,
    size_bytes: Buffer.byteLength(payloadStr, "utf8"),
    checksum,
    payload: snapshotPayload,
  });
  if (bkpErr) {
    console.error("ABORTADO: Não foi possível gravar backup pré-migração:", bkpErr.message);
    process.exit(1);
  }

  // 2. Grava todas as partições
  const upsertRows = Array.from(partitions.values()).map((p) => ({
    scope: p.scope,
    kind: p.kind,
    period: p.period,
    data: p.data,
    revision: 1,
    updated_at: new Date().toISOString(),
  }));

  const { error: upErr } = await sb
    .from("erp_partitions")
    .upsert(upsertRows, { onConflict: "scope,kind,period" });

  if (upErr) {
    console.error("ERRO ao gravar erp_partitions:", upErr.message);
    process.exit(1);
  }

  // 3. Importa logs históricos classificando explicitamente autoria não verificada
  const legacyLogs = Array.isArray(normalized.auditLogs) ? normalized.auditLogs : [];
  if (legacyLogs.length > 0) {
    const auditRows = legacyLogs.map((l) => {
      const mapped = mapLegacyAuditVerification(l);
      return {
        created_at: l.createdAt || new Date().toISOString(),
        actor_id: null,
        actor_email: l.actorEmail || "desconhecido@legado",
        actor_name: l.actorName || l.actorEmail || "Sessão Legada",
        actor_role: l.actorRole || "LEGACY",
        origin_type: mapped.origin,
        auth_verification: mapped.verif,
        unit_id: l.unitId || (l.entityType === "UNIT" ? l.entityId : null),
        module: String(l.module || "LEGADO").slice(0, 60),
        action: String(l.action || l.actionType || "REGISTRO_LEGADO").slice(0, 80),
        entity_type: l.entityType ? String(l.entityType).slice(0, 60) : null,
        entity_id: l.entityId ? String(l.entityId).slice(0, 120) : null,
        result: "SUCCESS",
        summary: String(l.summary || l.description || "Registro importado da base anterior.").slice(0, 1000),
      };
    });
    const { error: audErr } = await sb.from("erp_audit_logs").insert(auditRows);
    if (audErr) {
      console.warn("Aviso ao importar logs legados:", audErr.message);
    }
  }

  await sb.rpc("admin_write_audit", {
    p_actor: null,
    p_origin: "SYSTEM_MIGRATION",
    p_module: "MIGRACAO",
    p_action: "MIGRAR_DOCUMENTO_PARA_PARTICOES",
    p_entity_type: "ERP_PARTITION",
    p_entity_id: "V8_TO_V9",
    p_unit: null,
    p_summary: `Migração concluída com ${upsertRows.length} partições verificadas e backup PRE_MIGRATION salvo.`,
    p_result: "SUCCESS",
    p_before: null,
    p_after: { partitions: upsertRows.length, checksum },
  });

  console.log(`\nMigração aplicada com sucesso: ${upsertRows.length} partições gravadas.`);
}

main().catch((err) => {
  console.error("Erro fatal na migração:", err);
  process.exit(1);
});
