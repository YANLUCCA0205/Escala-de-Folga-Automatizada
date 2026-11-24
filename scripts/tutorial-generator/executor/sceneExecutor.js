// =============================================================================
// EXECUTOR DE CENAS E GRAVADOR DE QUADROS 1920x1080 (PRIORIDADE 3.2, 3.3, 3.5)
// Executa as cenas estruturadas do VID-02 sincronizadas com a duração exata da
// narração PT-BR, aplica destaques visuais e legendas, valida asserções
// observáveis e captura sequência contínua de quadros 1920x1080 para o FFmpeg.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import {
  setupIsolatedDemoContext,
  verifyIsolationOrAbort,
} from "../security/securityGuard.js";
import {
  injectVisualDirectorOverlay,
  updateSceneBannerAndSubtitle,
  highlightLocatorOnPage,
} from "./visualOverlay.js";

/**
 * Executa um passo individual de interação visual dentro de uma cena.
 */
async function executeSceneStep(page, step) {
  if (step.type === "CLICK_ROLE") {
    const loc = page.getByRole(step.role || "button", {
      name: new RegExp(step.namePattern, "i"),
    });
    await highlightLocatorOnPage(page, loc, step.callout || step.namePattern);
    await loc.first().click();
    return { executed: true, stepType: step.type, target: step.namePattern };
  }

  if (step.type === "HIGHLIGHT_TEXT") {
    const loc = page.getByText(new RegExp(step.textPattern, "i"));
    const ok = await highlightLocatorOnPage(page, loc, step.callout || step.textPattern);
    return { executed: ok, stepType: step.type, target: step.textPattern };
  }

  if (step.type === "HIGHLIGHT_SELECTOR") {
    const loc = page.locator(step.selector);
    const ok = await highlightLocatorOnPage(page, loc, step.callout || step.selector);
    return { executed: ok, stepType: step.type, target: step.selector };
  }

  if (step.type === "SET_DATE_INPUT") {
    const loc = page.locator(step.selector).first();
    await highlightLocatorOnPage(page, loc, step.callout || step.value);
    await loc.fill(step.value);
    await loc.dispatchEvent("change");
    return { executed: true, stepType: step.type, target: `${step.selector}=${step.value}` };
  }

  if (step.type === "SCROLL_TO_TEXT") {
    const loc = page.getByText(new RegExp(step.textPattern, "i")).first();
    if ((await loc.count()) > 0) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
    }
    return { executed: true, stepType: step.type, target: step.textPattern };
  }

  return { executed: false, stepType: step.type };
}

/**
 * Executa o cenário piloto completo (VID-02) gravando quadros em 1920x1080
 * perfeitamente sincronizados com o tempo de cada faixa de áudio.
 */
export async function executePilotScenarioVid02({
  browser,
  baseUrl,
  plan,
  narrationData,
  framesDir,
  evidenceDir,
}) {
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  // Limpa quadros anteriores para garantir reprodutibilidade
  for (const f of fs.readdirSync(framesDir)) {
    if (f.endsWith(".jpg") || f.endsWith(".png")) {
      fs.unlinkSync(path.join(framesDir, f));
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const { networkAudit } = await setupIsolatedDemoContext(context);
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await injectVisualDirectorOverlay(page);

  // Verifica isolamento antes de iniciar a gravação
  const initialIsolation = await verifyIsolationOrAbort(page, networkAudit);

  const fps = plan.fps || 15;
  const frameIntervalMs = Math.round(1000 / fps);
  let globalFrameIndex = 0;

  const captureFramesForDuration = async (durationMs) => {
    const framesToCapture = Math.max(1, Math.round(durationMs / frameIntervalMs));
    for (let i = 0; i < framesToCapture; i++) {
      globalFrameIndex += 1;
      const frameName = `frame_${String(globalFrameIndex).padStart(5, "0")}.jpg`;
      const framePath = path.join(framesDir, frameName);
      await page.screenshot({
        path: framePath,
        type: "jpeg",
        quality: 88,
        fullPage: false,
      });
    }
  };

  const sceneExecutionReports = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const audioInfo = narrationData.scenesAudio[i];
    const targetSceneDurationMs = audioInfo.durationMs;

    await updateSceneBannerAndSubtitle(page, {
      sceneTitle: `${scene.order}. ${scene.title}`,
      subtitleText: scene.narrationText,
    });

    const stepReports = [];
    const stepsCount = scene.steps.length || 1;
    const perStepBudgetMs = Math.floor(targetSceneDurationMs / stepsCount);

    for (const step of scene.steps) {
      const stepRes = await executeSceneStep(page, step);
      stepReports.push(stepRes);
      await captureFramesForDuration(perStepBudgetMs);
    }

    // Verifica asserção observável da cena
    let assertionPassed = true;
    if (scene.observableAssertion?.checkText) {
      assertionPassed = await page
        .getByText(new RegExp(scene.observableAssertion.checkText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
        .first()
        .isVisible()
        .catch(() => false);
    }

    // Verifica novamente o isolamento após as ações da cena
    const sceneIsolation = await verifyIsolationOrAbort(page, networkAudit);

    // Salva screenshot de evidência da cena
    const sceneShotName = `${scene.sceneId.toLowerCase()}.png`;
    const sceneShotPath = path.join(evidenceDir, sceneShotName);
    await page.screenshot({ path: sceneShotPath, fullPage: false });

    sceneExecutionReports.push({
      sceneId: scene.sceneId,
      title: scene.title,
      durationMs: targetSceneDurationMs,
      audioEngine: audioInfo.engineUsed,
      stepsExecuted: stepReports,
      observableAssertion: {
        ...scene.observableAssertion,
        passed: assertionPassed,
      },
      isolationVerified: sceneIsolation.isolated,
      evidenceScreenshot: `docs/ai-tutorials/evidence/vid02/${sceneShotName}`,
    });
  }

  await context.close();

  return {
    videoId: plan.videoId,
    resolution: plan.resolution,
    fps,
    totalFramesCaptured: globalFrameIndex,
    estimatedVisualDurationMs: Math.round((globalFrameIndex / fps) * 1000),
    initialIsolation,
    networkAudit,
    scenes: sceneExecutionReports,
  };
}
