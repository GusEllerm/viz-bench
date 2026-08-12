// The single rAF FPS probe — previously inlined byte-for-byte in 5 bench scripts
// (run.mjs, corrected-cosmograph.mjs, overview-matrix.mjs, helios-bench.mjs,
// manifold-bench/web/bench/run.mjs). FPS = count of rAF callbacks over the window;
// it is render throughput/headroom (uncapped headless rAF), NOT a presented-frame
// rate — see the Presentation gate, which is what proves frames actually present.
//
// Usage: await startProbe(page, ms); <drive the camera>; const r = await readProbe(page);

export const startProbe = (page, durationMs) =>
  page.evaluate((dur) => {
    const p = { frames: [], running: true, t0: performance.now() };
    window.__probe = p;
    const tick = (t) => {
      if (!p.running) return;
      p.frames.push(t);
      if (t - p.t0 < dur) requestAnimationFrame(tick);
      else p.running = false;
    };
    requestAnimationFrame(tick);
  }, durationMs);

// Returns the full superset {fps, frames, p50ms, p95ms, maxms}. Callers that
// historically reported a subset (e.g. the manifold runner omits p50ms) shape the
// object themselves to preserve their existing record layout.
export const readProbe = (page) =>
  page.evaluate(() => {
    const p = window.__probe;
    p.running = false;
    const f = p.frames, iv = [];
    for (let i = 1; i < f.length; i++) iv.push(f[i] - f[i - 1]);
    iv.sort((a, b) => a - b);
    const span = f.length > 1 ? f[f.length - 1] - f[0] : 0;
    const fps = f.length > 1 ? (f.length - 1) / (span / 1000) : 0;
    const q = (x) => (iv.length ? iv[Math.min(iv.length - 1, Math.floor(x * iv.length))] : 0);
    return {
      fps: +fps.toFixed(1),
      frames: f.length,
      p50ms: +q(0.5).toFixed(1),
      p95ms: +q(0.95).toFixed(1),
      maxms: +(iv[iv.length - 1] || 0).toFixed(1),
    };
  });
