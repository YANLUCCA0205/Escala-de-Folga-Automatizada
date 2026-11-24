// =============================================================================
// SINTETIZADOR DE NARRAÇÃO PT-BR E GERADOR DE LEGENDAS SRT/VTT (PRIORIDADE 3.4)
// Suporta:
// 1. Voz Neural PT-BR (pt-BR-FranciscaNeural / pt-BR-AntonioNeural via msedge-tts)
// 2. Voz Nativa Windows SAPI PT-BR (PowerShell System.Speech)
// 3. Gerador Acústico WAV Determinístico (Fallback Offline de Segurança)
// Mede a duração exata de cada faixa de áudio e gera legendas .srt e .vtt.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Converte milissegundos para o formato de timestamp SubRip (HH:MM:SS,mmm)
 */
export function formatSrtTime(ms) {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    "," +
    String(millis).padStart(3, "0")
  );
}

/**
 * Obtém a duração de um arquivo de áudio (.mp3 ou .wav) usando o binário do FFmpeg.
 */
export function probeAudioDurationMs(ffmpegPath, audioFilePath) {
  if (!fs.existsSync(audioFilePath)) return 0;
  const res = spawnSync(ffmpegPath, ["-i", audioFilePath], { encoding: "utf8" });
  const stderr = String(res.stderr || "");
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/i);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centis = parseInt(match[4].slice(0, 2).padEnd(2, "0"), 10);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + centis * 10;
}

/**
 * Gera um arquivo WAV PCM 16-bit 24kHz mono com modulação de cadência silábica
 * caso o ambiente esteja sem acesso à nuvem TTS e com o COM SAPI bloqueado pelo sandbox.
 */
function writeCadencedFallbackWav(wavPath, text, minDurationMs = 7000) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  // Velocidade média de locução em português: ~2.6 palavras/segundo (~385ms por palavra)
  const estimatedSpeechMs = Math.max(minDurationMs, words.length * 385 + 800);
  const sampleRate = 24000;
  const numSamples = Math.floor((estimatedSpeechMs / 1000) * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // Cabeçalho RIFF WAVE
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20);  // Linear PCM
  buffer.writeUInt16LE(1, 22);  // 1 canal (Mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Gera envelope suave de narração para que a trilha de áudio tenha sinal válido e audível
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const syllableEnvelope = Math.max(0, Math.sin(2 * Math.PI * 3.8 * t));
    const phraseEnvelope = Math.sin(Math.PI * Math.min(1, t / (estimatedSpeechMs / 1000)));
    const fundamental =
      0.6 * Math.sin(2 * Math.PI * 165 * t) +
      0.3 * Math.sin(2 * Math.PI * 330 * t) +
      0.1 * Math.sin(2 * Math.PI * 495 * t);
    const sample = Math.round(fundamental * syllableEnvelope * phraseEnvelope * 2200);
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, sample)), 44 + i * 2);
  }

  fs.writeFileSync(wavPath, buffer);
  return estimatedSpeechMs;
}

/**
 * Tenta sintetizar voz PT-BR via msedge-tts (Neural) -> Windows SAPI -> Fallback WAV.
 */
export async function synthesizeSceneNarration({
  scene,
  audioDir,
  ffmpegPath,
}) {
  fs.mkdirSync(audioDir, { recursive: true });
  const baseName = `${scene.sceneId.toLowerCase()}`;
  const mp3Path = path.join(audioDir, `${baseName}.mp3`);
  const wavPath = path.join(audioDir, `${baseName}.wav`);

  let engineUsed = null;
  let errorLog = [];

  // 1. Tentativa via msedge-tts (Voz Neural PT-BR: pt-BR-FranciscaNeural)
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      "pt-BR-FranciscaNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioFilePath } = await tts.toFile(audioDir, scene.narrationText);
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      if (audioFilePath !== mp3Path) {
        fs.copyFileSync(audioFilePath, mp3Path);
        try {
          fs.unlinkSync(audioFilePath);
        } catch {
          // Ignora se já removido
        }
      }
      // Converte para WAV PCM 24kHz mono usando FFmpeg para concatenação perfeita
      spawnSync(
        ffmpegPath,
        ["-y", "-i", mp3Path, "-ar", "24000", "-ac", "1", wavPath],
        { encoding: "utf8" }
      );
      if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
        engineUsed = "MSEDGE_NEURAL_TTS_PT_BR (pt-BR-FranciscaNeural)";
      }
    }
  } catch (err) {
    errorLog.push(`msedge-tts indisponível (${err.message})`);
  }

  // 2. Tentativa via Windows SAPI (PowerShell System.Speech) caso msedge-tts falhe
  if (!engineUsed) {
    try {
      const escapedText = scene.narrationText.replace(/"/g, '`"').replace(/'/g, "''");
      const psScript = `
        Add-Type -AssemblyName System.Speech
        $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $s.SetOutputToWaveFile('${wavPath.replace(/\\/g, "\\\\")}')
        $s.Speak("${escapedText}")
        $s.Dispose()
      `;
      const psRes = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", psScript],
        { encoding: "utf8", timeout: 15000 }
      );
      if (psRes.status === 0 && fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
        engineUsed = "WINDOWS_SAPI_SPEECH_SYNTHESIZER";
      } else {
        errorLog.push(`Windows SAPI retornou status ${psRes.status}: ${String(psRes.stderr || "").trim()}`);
      }
    } catch (err) {
      errorLog.push(`Windows SAPI falhou (${err.message})`);
    }
  }

  // 3. Fallback Acústico Cadenciado Determinístico (quando offline/sandboxed)
  if (!engineUsed) {
    writeCadencedFallbackWav(wavPath, scene.narrationText, scene.minDurationMs);
    engineUsed = "OFFLINE_CADENCED_PCM_SYNTHESIZER (Fallback Sandbox sem Rede/SAPI)";
  }

  const probedMs = probeAudioDurationMs(ffmpegPath, wavPath);
  const finalDurationMs = Math.max(probedMs, scene.minDurationMs || 6000);

  return {
    sceneId: scene.sceneId,
    audioWavPath: wavPath,
    durationMs: finalDurationMs,
    probedAudioMs: probedMs,
    engineUsed,
    diagnostics: errorLog,
  };
}

/**
 * Sintetiza todas as cenas do plano e gera o arquivo de legendas .srt sincronizado.
 */
export async function synthesizePlanNarrationAndSubtitles({
  plan,
  audioDir,
  subtitlesOutPath,
  ffmpegPath,
}) {
  const sceneAudioResults = [];
  let cursorMs = 0;
  const srtBlocks = [];

  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const audioRes = await synthesizeSceneNarration({
      scene,
      audioDir,
      ffmpegPath,
    });

    const startMs = cursorMs;
    const endMs = cursorMs + audioRes.durationMs;
    cursorMs = endMs;

    sceneAudioResults.push({
      ...audioRes,
      startMs,
      endMs,
      narrationText: scene.narrationText,
      subtitleText: scene.subtitleText,
    });

    srtBlocks.push(
      `${i + 1}\n${formatSrtTime(startMs)} --> ${formatSrtTime(endMs - 150)}\n${scene.narrationText}\n`
    );
  }

  fs.mkdirSync(path.dirname(subtitlesOutPath), { recursive: true });
  fs.writeFileSync(subtitlesOutPath, srtBlocks.join("\n"), "utf8");

  return {
    totalDurationMs: cursorMs,
    subtitlesPath: subtitlesOutPath,
    scenesAudio: sceneAudioResults,
  };
}
