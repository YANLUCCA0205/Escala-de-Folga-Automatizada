// =============================================================================
// DIRETOR DE DESTAQUES VISUAIS, CURSOR VIRTUAL E LEGENDAS EM TELA (PRIORIDADE 3.6)
// Injeta no DOM um overlay não-intrusivo (pointer-events: none) em 1920x1080
// com moldura de destaque pulsante, callout explicativo, cursor virtual animado
// e barra de legendas sincronizadas.
// =============================================================================

export async function injectVisualDirectorOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById("autotour-director-root")) return;

    const root = document.createElement("div");
    root.id = "autotour-director-root";
    root.style.cssText = `
      position: fixed;
      inset: 0;
      width: 1920px;
      height: 1080px;
      pointer-events: none;
      z-index: 999999;
      font-family: Inter, system-ui, -apple-system, sans-serif;
    `;

    // 1. Moldura de Destaque (Spotlight Box)
    const highlightBox = document.createElement("div");
    highlightBox.id = "autotour-highlight-box";
    highlightBox.style.cssText = `
      position: fixed;
      top: -200px;
      left: -200px;
      width: 0px;
      height: 0px;
      border: 3.5px solid #2563eb;
      border-radius: 10px;
      box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.28), 0 12px 28px rgba(15, 23, 42, 0.25);
      transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      opacity: 0;
      pointer-events: none;
    `;

    // 2. Callout Badge acima da moldura
    const calloutBadge = document.createElement("div");
    calloutBadge.id = "autotour-callout-badge";
    calloutBadge.style.cssText = `
      position: fixed;
      top: -200px;
      left: -200px;
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(30, 58, 138, 0.45);
      white-space: nowrap;
      transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      opacity: 0;
      pointer-events: none;
    `;

    // 3. Cursor Virtual SVG
    const cursorEl = document.createElement("div");
    cursorEl.id = "autotour-virtual-cursor";
    cursorEl.style.cssText = `
      position: fixed;
      top: 540px;
      left: 960px;
      width: 28px;
      height: 28px;
      transition: top 0.32s cubic-bezier(0.22, 1, 0.36, 1), left 0.32s cubic-bezier(0.22, 1, 0.36, 1), transform 0.15s ease;
      pointer-events: none;
      z-index: 1000001;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.45));
    `;
    cursorEl.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 3L13.5 24L16.8 15.8L25 12.5L4 3Z" fill="#2563EB" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>
    `;

    // 4. Barra Superior Direita de Cena (HUD de Contexto)
    const sceneHud = document.createElement("div");
    sceneHud.id = "autotour-scene-hud";
    sceneHud.style.cssText = `
      position: fixed;
      top: 14px;
      right: 24px;
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      border: 1px solid rgba(59, 130, 246, 0.5);
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.35);
      pointer-events: none;
    `;
    sceneHud.textContent = "AutoTour AI · Ambiente Demo Isolado";

    // 5. Barra Inferior de Legendas Sincronizadas (1920x1080)
    const subtitleBar = document.createElement("div");
    subtitleBar.id = "autotour-subtitle-bar";
    subtitleBar.style.cssText = `
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 1480px;
      width: auto;
      background: rgba(15, 23, 42, 0.90);
      color: #ffffff;
      border: 1.5px solid rgba(96, 165, 250, 0.55);
      border-radius: 12px;
      padding: 12px 26px;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.4;
      text-align: center;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      pointer-events: none;
    `;

    root.appendChild(highlightBox);
    root.appendChild(calloutBadge);
    root.appendChild(cursorEl);
    root.appendChild(sceneHud);
    root.appendChild(subtitleBar);
    document.body.appendChild(root);
  });
}

export async function updateSceneBannerAndSubtitle(page, { sceneTitle, subtitleText }) {
  await injectVisualDirectorOverlay(page);
  await page.evaluate(
    ({ title, sub }) => {
      const hud = document.getElementById("autotour-scene-hud");
      const bar = document.getElementById("autotour-subtitle-bar");
      if (hud) hud.textContent = `🎬 VID-02 · ${title}`;
      if (bar) bar.textContent = sub || "";
    },
    { title: sceneTitle, sub: subtitleText }
  );
}

export async function highlightLocatorOnPage(page, locator, calloutText = "") {
  await injectVisualDirectorOverlay(page);
  try {
    const count = await locator.count();
    if (count === 0) return false;
    const target = locator.first();
    await target.scrollIntoViewIfNeeded().catch(() => {});
    const box = await target.boundingBox();
    if (!box) return false;

    await page.evaluate(
      ({ rect, label }) => {
        const hl = document.getElementById("autotour-highlight-box");
        const badge = document.getElementById("autotour-callout-badge");
        const cursor = document.getElementById("autotour-virtual-cursor");
        const pad = 6;

        if (hl) {
          hl.style.top = `${Math.max(4, rect.y - pad)}px`;
          hl.style.left = `${Math.max(4, rect.x - pad)}px`;
          hl.style.width = `${rect.width + pad * 2}px`;
          hl.style.height = `${rect.height + pad * 2}px`;
          hl.style.opacity = "1";
        }
        if (badge) {
          if (label) {
            badge.textContent = `✨ ${label}`;
            badge.style.top = `${Math.max(8, rect.y - 38)}px`;
            badge.style.left = `${Math.max(8, rect.x)}px`;
            badge.style.opacity = "1";
          } else {
            badge.style.opacity = "0";
          }
        }
        if (cursor) {
          cursor.style.top = `${rect.y + Math.min(rect.height / 2, 24)}px`;
          cursor.style.left = `${rect.x + Math.min(rect.width / 2, 48)}px`;
        }
      },
      { rect: box, label: calloutText }
    );
    return true;
  } catch {
    return false;
  }
}
