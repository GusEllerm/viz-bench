// Camera drivers. Two families, deliberately separated:
//
//  apiCamera (DEFAULT)  — drives the engine's own camera via the page contract
//    (window.__bench.setCamera). Zero synthetic input events → immune to the
//    d3-zoom/CDP-stall artifact that collapsed cosmos-pipeline tools ~12x and
//    produced the bogus "Cosmograph 5 fps". This is the only driver allowed for
//    headline numbers (enforced by the Input-honesty gate).
//
//  syntheticInput (QUARANTINED) — the legacy continuous mouse drag+wheel. Kept
//    only for explicit "protocol-delta" comparisons; never a headline. Parametrized
//    so the graph (#graph) and manifold (#view) runners reproduce their exact prior
//    motion constants.
import { setTimeout as sleep } from 'node:timers/promises';

// Oscillate the page's named camera states for `durationMs` (every frame redraws).
// The page must implement window.__bench.setCamera(state); states default to a
// zoom oscillation away from the overview fit.
export async function apiCamera(page, { durationMs, states = ['mid', 'deep'], dwellMs = 900 } = {}) {
  await page.evaluate(({ dur, sts, dwell }) => {
    let i = 0;
    const step = () => { try { window.__bench.setCamera(sts[i++ % sts.length]); } catch (e) {} };
    step();
    const timer = setInterval(step, dwell);
    setTimeout(() => clearInterval(timer), dur);
  }, { dur: durationMs, sts: states, dwell: dwellMs });
  await sleep(durationMs);
}

// Gentle COALESCED pan at the current (overview) zoom — the sanctioned headline driver.
// ~30 events/s (intervalMs 33) is what a coalescing browser delivers from a human hand;
// it forces on-demand renderers (Sigma) to redraw without the uncoalesced-stream artifact.
// Stays at the current zoom (no wheel), so the camera state is unchanged ('overview').
export async function coalescedPan(page, { durationMs, selector = '#graph', amp = 120, freqDiv = 4, intervalMs = 33 } = {}) {
  const box = await page.locator(selector).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let i = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < durationMs) {
    i++;
    await page.mouse.move(cx + Math.cos(i / freqDiv) * amp, cy + Math.sin(i / freqDiv) * amp);
    await sleep(intervalMs);
  }
  await page.mouse.up();
}

// Legacy synthetic motion: continuous circular drag (70% of the window) then wheel
// zoom pulses (30%). Defaults reproduce the graph runner; pass manifold constants
// (selector:'#view', panAmpX:180, panAmpY:120, freqDiv:6, wheelMag:140) for parity.
export async function syntheticInput(
  page,
  { durationMs, selector = '#graph', panAmpX = 150, panAmpY = 150, freqDiv = 5, wheelMag = 130 } = {}
) {
  const box = await page.locator(selector).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let i = 0;
  const tPan = Date.now();
  while (Date.now() - tPan < durationMs * 0.7) {
    i++;
    await page.mouse.move(cx + Math.cos(i / freqDiv) * panAmpX, cy + Math.sin(i / freqDiv) * panAmpY);
    await sleep(6);
  }
  await page.mouse.up();
  const tZoom = Date.now();
  while (Date.now() - tZoom < durationMs * 0.3) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, (Math.floor((Date.now() - tZoom) / 220) % 2) ? wheelMag : -wheelMag);
    await sleep(6);
  }
}
