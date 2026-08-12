// Self-driving point-cloud benchmark — headless Chromium on the REAL Metal GPU (ANGLE),
// driving a sustained orbit + zoom over each (renderer, cloud) and recording FPS / p95 /
// heap / load time + the WebGL renderer string. Mirrors graph-bench/web/bench/run.mjs but
// for 3D OrbitView interaction. Shared primitives now come from bench-core/node.
//
//   node bench/run.mjs                 # full matrix (all renderers × all clouds)
//   node bench/run.mjs deck            # one renderer, all clouds
//   node bench/run.mjs deck swiss_roll_1000000
import { readGL, withTimeout, launchBrowser, startServer } from '../../../bench-core/node/harness.mjs';
import { startProbe, readProbe } from '../../../bench-core/node/probe.mjs';
import { syntheticInput } from '../../../bench-core/node/drivers.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:5200';
const TOOLS = ['deck', 'three'];
const READY_TIMEOUT_MS = 90000;
const INTERACT_MS = 5000;

const manifest = JSON.parse(readFileSync(new URL('../../data/manifest.json', import.meta.url)));
const ALL_CLOUDS = manifest.clouds.map((c) => c.base);

const onlyTool = process.argv[2];
const onlyCloud = process.argv[3];
const budget = process.argv[4];                 // optional LOD cap: node bench/run.mjs deck swiss_roll_50000000 2000000
const tools = onlyTool ? [onlyTool] : TOOLS;
const clouds = onlyCloud ? [onlyCloud] : ALL_CLOUDS;

// continuous orbit (drag) then zoom pulses — forces a redraw every frame (legacy
// synthetic-input protocol). The manifold record omits p50ms, as before.
async function measureInteraction(page, durationMs) {
  await startProbe(page, durationMs);
  await syntheticInput(page, { durationMs, selector: '#view', panAmpX: 180, panAmpY: 120, freqDiv: 6, wheelMag: 140 });
  const r = await readProbe(page);
  return { fps: r.fps, frames: r.frames, p95ms: r.p95ms, maxms: r.maxms };
}

async function runOne(browser, tool, cloud) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(READY_TIMEOUT_MS);
  const rec = { tool, cloud };
  try {
    await page.goto(`${BASE}/${tool}.html?c=${cloud}${budget ? `&budget=${budget}` : ''}`, { waitUntil: 'load' });
    rec.renderer = await withTimeout(page.evaluate(readGL), 25000, 'main thread wedged before render');
    rec.software = /swiftshader|llvmpipe|software/i.test(rec.renderer);
    await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: READY_TIMEOUT_MS });
    const b = await page.evaluate(() => ({ ready: window.__bench.ready, error: window.__bench.error, timings: window.__bench.timings }));
    if (b.error) throw new Error('app: ' + b.error);
    rec.timings = b.timings;
    await sleep(800);
    await page.evaluate(() => { window.__bench.fitView && window.__bench.fitView(); window.__bench.pauseLayout && window.__bench.pauseLayout(); });
    await sleep(300);
    rec.interaction = await measureInteraction(page, INTERACT_MS);
    rec.memMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));
    rec.ok = true;
  } catch (e) { rec.ok = false; rec.error = e.message; }
  finally { await withTimeout(page.close(), 8000, 'close').catch(() => {}); }
  return rec;
}

const server = await startServer({ base: BASE, args: [] });
const browser = await launchBrowser();
const results = [];
try {
  for (const tool of tools) for (const cloud of clouds) {
    process.stdout.write(`\n▶ ${tool.padEnd(6)} ${cloud.padEnd(22)} … `);
    const r = await runOne(browser, tool, cloud);
    results.push(r);
    if (r.ok) {
      const load = Math.round(r.timings.tFetch + r.timings.tInit);
      process.stdout.write(`fps=${String(r.interaction.fps).padStart(5)}  p95=${r.interaction.p95ms}ms  load=${load}ms  mem=${r.memMB}MB${r.software ? '  [SOFTWARE!]' : ''}`);
    } else process.stdout.write(`FAILED: ${r.error}`);
  }
} finally { await browser.close(); if (server) server.kill(); }

mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
writeFileSync(new URL('./results/results.json', import.meta.url), JSON.stringify(results, null, 2));
let md = `# Point-cloud benchmark results\n\nReal-GPU (Metal/ANGLE) via headless Chromium. Interaction = sustained orbit+zoom over ${INTERACT_MS / 1000}s; FPS = render throughput (uncapped rAF).\n\n| renderer | cloud | points | load ms | **FPS** | p95 ms | mem MB | GPU |\n|---|---|--:|--:|--:|--:|--:|---|\n`;
for (const r of results) {
  if (!r.ok) { md += `| ${r.tool} | ${r.cloud} | | | **FAIL** | | | ${r.error} |\n`; continue; }
  const load = Math.round(r.timings.tFetch + r.timings.tInit);
  md += `| ${r.tool} | ${r.cloud} | ${r.timings.points.toLocaleString()} | ${load} | **${r.interaction.fps}** | ${r.interaction.p95ms} | ${r.memMB ?? '—'} | ${r.software ? '⚠SW' : 'Metal'} |\n`;
}
writeFileSync(new URL('./results/results.md', import.meta.url), md);
console.log('\n\n' + md);
