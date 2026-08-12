// Presentation gate (web half). Proves the surface actually presents AND that driving the
// camera produces a MEANINGFUL change — closing the offscreen/frozen/blank failure class
// (the Datoviz-offscreen and "238 fps rAF-free-ran-on-a-static-canvas" artifacts).
//
// Uses Playwright's compositor screenshot, NOT gl.readPixels/canvas.toDataURL — those read
// BLANK on cleared WebGL buffers (preserveDrawingBuffer:false) and would false-fail. The two
// screenshots are decoded + diffed IN THE PAGE (the browser decodes PNG natively, so no node
// decoder is needed) to a true changed-fraction.
//
// Why a fraction and not byte-equality: continuous-render engines (cosmos.gl) emit sub-pixel
// jitter every frame, so consecutive PNGs are never byte-identical even when the view did not
// meaningfully change. A fraction threshold distinguishes a real camera response (a zoom
// changes most of the frame) from jitter or a frozen/blank surface (≈0% change).
//
// NOTE: web headless rAF is UNCAPPED by design, so a vsync-bound FPS check is invalid here —
// pixel-diff is the only valid web presentation check. (The native half uses offscreen==false
// + a vsync bound; see py/gates.py.)
import { setTimeout as sleep } from 'node:timers/promises';

export async function presentationWeb(page, { selector = '#graph', settleMs = 450, threshold = 0.02, tol = 8 } = {}) {
  const loc = page.locator(selector);
  let a64, b64;
  try {
    a64 = (await loc.screenshot()).toString('base64');
    await page.evaluate(() => window.__bench.setCamera('mid'));
    await sleep(settleMs);
    b64 = (await loc.screenshot()).toString('base64');
    await page.evaluate(() => window.__bench.setCamera('overview'));
    await sleep(settleMs);
  } catch (e) {
    return { pass: false, verdict: 'fail', detail: 'screenshot/setCamera failed: ' + e.message, method: 'pixelDiff', surface: 'onscreen' };
  }

  let changedFraction;
  try {
    changedFraction = await page.evaluate(
      async ({ a, b, tol }) => {
        const decode = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
        const [ia, ib] = await Promise.all([decode(a), decode(b)]);
        const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
        const cv = new OffscreenCanvas(w, h), ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(ia, 0, 0);
        const da = ctx.getImageData(0, 0, w, h).data;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(ib, 0, 0);
        const db = ctx.getImageData(0, 0, w, h).data;
        let changed = 0; const n = w * h;
        for (let i = 0; i < n; i++) {
          const o = i * 4;
          if (Math.abs(da[o] - db[o]) > tol || Math.abs(da[o + 1] - db[o + 1]) > tol || Math.abs(da[o + 2] - db[o + 2]) > tol) changed++;
        }
        return n ? changed / n : 0;
      },
      { a: a64, b: b64, tol }
    );
  } catch (e) {
    return { pass: false, verdict: 'fail', detail: 'pixel-diff failed: ' + e.message, method: 'pixelDiff', surface: 'onscreen' };
  }

  const pass = changedFraction > threshold;
  return {
    pass,
    verdict: pass ? 'pass' : 'fail',
    detail: `${pass ? 'presented' : 'frozen/no-change'} changedFraction=${changedFraction.toFixed(4)} (>${threshold})`,
    method: 'pixelDiff',
    surface: 'onscreen',
    changedFraction: +changedFraction.toFixed(4),
  };
}
