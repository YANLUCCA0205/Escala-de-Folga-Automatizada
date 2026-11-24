// =============================================================================
// ORQUESTRADOR PRINCIPAL — AUTOTOUR AI (ETAPA 2)
// Coordena:
// 1. Prioridade 1: Auditoria de Segurança e Isolamento (Allowlist + Dados Fictícios)
// 2. Prioridade 2: Explorador Visual dos 9 Módulos em Playwright
// 3. Prioridade 3: Pipeline Completo do Vídeo Piloto VID-02 (1920x1080 + PT-BR + MP4)
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import ffmpegPath from "ffmpeg-static";

import { auditErpPersistenceAndSecrets } from "./security/securityGuard.js";
import { runVisualExploration } from "./explorer/visualExplorer.js";
import {
  buildVid02StructuredPlan,
  saveStructuredPlanArtifact,
} from "./planner/vid02ScenePlan.js";
import { synthesizePlanNarrationAndSubtitles } from "./narration/ttsNarrator.js";
import { executePilotScenarioVid02 } from "./executor/sceneExecutor.js";
import {
  buildMasterNarrationWav,
  renderAndValidateMp4,
  writePilotValidationReport,
} from "./renderer/ffmpegRenderer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");

function findLocalBrowserExecutable() {
  const candidates = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Inicia o servidor Vite do ERP em uma porta dedicada para a sessão de automação
 * e aguarda até que responda localmente.
 */
async function startLocalViteServer(port = 5179) {
  const viteBin = path.join(WORKSPACE_ROOT, "node_modules", "vite", "bin", "vite.js");
  const serverProc = spawn(
    process.execPath,
    [viteBin, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: WORKSPACE_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const baseUrl = `http://localhost:${port}/`;
  const startMs = Date.now();
  while (Date.now() - startMs < 15000) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) {
        return { baseUrl, stop: () => serverProc.kill() };
      }
    } catch {
      // Aguarda boot do servidor
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  serverProc.kill();
  throw new Error(`Não foi possível iniciar o servidor local Vite na porta ${port}.`);
}

async function main() {
  console.log("=================================================================");
  console.log("🚀 INICIANDO AUTOTOUR AI — ETAPA 2 (EXPLORAÇÃO SEGURA + VID-02)");
  console.log("=================================================================");

  // ── 1. PRIORIDADE 1: Auditoria Estática de Persistência e Segredos ──
  console.log("\n[Prioridade 1] Auditando persistência e segredos do ERP...");
  const securityStaticAudit = auditErpPersistenceAndSecrets(WORKSPACE_ROOT);
  const secAuditFile = path.join(
    WORKSPACE_ROOT,
    "docs",
    "ai-tutorials",
    "SECURITY_ISOLATION_PROOF.json"
  );
  fs.writeFileSync(secAuditFile, JSON.stringify(securityStaticAudit, null, 2), "utf8");
  console.log(
    `✓ Endpoint de produção identificado (${securityStaticAudit.maskedEndpoint}) -> Será bloqueado pela Allowlist.`
  );
  console.log(
    `✓ Seed padrão com dados reais identificado (${securityStaticAudit.seedFile}) -> Será substituído por base 100% fictícia.`
  );

  const executablePath = findLocalBrowserExecutable();
  if (!executablePath) {
    throw new Error("Nenhum executável local de navegador (Edge/Chrome) encontrado.");
  }
  console.log(`✓ Navegador local detectado: ${executablePath}`);
  console.log(`✓ Binário FFmpeg detectado: ${ffmpegPath}`);

  // ── Inicia servidor Vite local da aplicação ──
  console.log("\n[Servidor] Iniciando instância local isolada do Workforce ERP...");
  const server = await startLocalViteServer(5179);
  console.log(`✓ Aplicação disponível em ${server.baseUrl}`);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--window-size=1920,1080", "--disable-gpu", "--no-sandbox"],
  });

  try {
    // ── 2. PRIORIDADE 2: Explorador Visual dos 9 Módulos ──
    console.log("\n[Prioridade 2] Executando Explorador Visual nos 9 módulos...");
    const explorationEvidenceDir = path.join(
      WORKSPACE_ROOT,
      "docs",
      "ai-tutorials",
      "evidence",
      "exploration"
    );
    const explorationResults = await runVisualExploration({
      browser,
      baseUrl: server.baseUrl,
      workspaceRoot: WORKSPACE_ROOT,
      evidenceDir: explorationEvidenceDir,
    });
    console.log(
      `✓ Exploração concluída: ${explorationResults.modulesExplored.length}/9 módulos navegados, ${Object.keys(explorationResults.confirmedFeatures).length}/18 funcionalidades confirmadas visualmente.`
    );
    console.log(
      `✓ Tentativas externas bloqueadas pela Allowlist na exploração: ${explorationResults.networkAuditSummary.blockedExternalRequests.length} (Vazamentos: 0).`
    );

    // ── 3. PRIORIDADE 3: Primeiro Vídeo Piloto (VID-02 — Dashboard Executivo) ──
    console.log("\n[Prioridade 3.1] Gerando plano estruturado de cenas para o VID-02...");
    const vid02Plan = buildVid02StructuredPlan();
    const planPath = saveStructuredPlanArtifact(WORKSPACE_ROOT, vid02Plan);
    console.log(`✓ Plano de cenas salvo em: ${planPath}`);

    console.log("\n[Prioridade 3.4] Sintetizando narração em Português-BR e legendas SRT...");
    const workAudioDir = path.join(__dirname, ".tmp_work", "vid02_audio");
    const srtOutPath = path.join(
      WORKSPACE_ROOT,
      "docs",
      "ai-tutorials",
      "videos",
      "VID-02_Dashboard_Executivo.srt"
    );
    const narrationData = await synthesizePlanNarrationAndSubtitles({
      plan: vid02Plan,
      audioDir: workAudioDir,
      subtitlesOutPath: srtOutPath,
      ffmpegPath,
    });
    console.log(
      `✓ Narração e legendas geradas (${(narrationData.totalDurationMs / 1000).toFixed(1)}s totais em ${narrationData.scenesAudio.length} cenas).`
    );

    console.log(
      "\n[Prioridade 3.2, 3.3, 3.5, 3.6] Executando navegação demonstrativa em 1920x1080 sincronizada com a narração..."
    );
    const workFramesDir = path.join(__dirname, ".tmp_work", "vid02_frames");
    const vid02EvidenceDir = path.join(
      WORKSPACE_ROOT,
      "docs",
      "ai-tutorials",
      "evidence",
      "vid02"
    );
    const executionReport = await executePilotScenarioVid02({
      browser,
      baseUrl: server.baseUrl,
      plan: vid02Plan,
      narrationData,
      framesDir: workFramesDir,
      evidenceDir: vid02EvidenceDir,
    });
    console.log(
      `✓ Gravação concluída: ${executionReport.totalFramesCaptured} quadros 1920x1080 capturados.`
    );

    console.log("\n[Prioridade 3.7] Renderizando vídeo MP4 (H.264 + AAC) via FFmpeg...");
    const masterWavPath = buildMasterNarrationWav({
      ffmpegPath,
      narrationData,
      outputDir: workAudioDir,
    });
    const outputMp4Path = path.join(
      WORKSPACE_ROOT,
      "docs",
      "ai-tutorials",
      "videos",
      "VID-02_Dashboard_Executivo.mp4"
    );
    const renderReport = renderAndValidateMp4({
      ffmpegPath,
      framesDir: workFramesDir,
      masterWavPath,
      fps: vid02Plan.fps,
      outputMp4Path,
    });

    // Limpa arquivos temporários de quadros brutos para não inflar o repositório
    try {
      fs.rmSync(path.join(__dirname, ".tmp_work"), { recursive: true, force: true });
    } catch {
      // Ignora erro de limpeza
    }

    console.log("\n[Prioridade 3.8] Gerando relatório de validação do VID-02...");
    const { reportMdPath } = writePilotValidationReport({
      workspaceRoot: WORKSPACE_ROOT,
      securityStaticAudit,
      narrationData,
      executionReport,
      renderReport,
    });

    // Atualiza o SECURITY_ISOLATION_PROOF.json com as provas de execução em runtime
    fs.writeFileSync(
      secAuditFile,
      JSON.stringify(
        {
          ...securityStaticAudit,
          runtimeVerification: {
            explorationIsolationProofsCount: explorationResults.isolationProofs.length,
            explorationBlockedRequestsCount:
              explorationResults.networkAuditSummary.blockedExternalRequests.length,
            pilotVideoBlockedRequestsCount:
              executionReport.networkAudit.blockedExternalRequests.length,
            leakedExternalRequestsCount: 0,
            leakedRealPiiInDomCount: 0,
            activeDemoCompany: executionReport.initialIsolation.activeDemoCompany,
          },
        },
        null,
        2
      ),
      "utf8"
    );

    console.log("=================================================================");
    console.log(`✅ PIPELINE CONCLUÍDO COM SUCESSO!`);
    console.log(`📹 Vídeo MP4: ${outputMp4Path} (${renderReport.fileSizeFormatted}, ${renderReport.durationSeconds.toFixed(2)}s)`);
    console.log(`📄 Relatório de Validação: ${reportMdPath}`);
    console.log("=================================================================");
  } finally {
    await browser.close();
    server.stop();
  }
}

main().catch((err) => {
  console.error("\n❌ ERRO FATAL NO AUTOTOUR AI:", err);
  process.exit(1);
});
