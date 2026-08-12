// Self-driving benchmark harness.
// Spawns the Vite dev server, drives headless Chromium on the REAL GPU (Metal via
// ANGLE), and for each (tool, dataset) records: load timings, whether layout
// settled, post-layout interaction FPS (scripted zoom + pan), frame p95, JS heap,
// and the WebGL renderer string (so each row is self-documenting as GPU vs software).
//
// Shared primitives (readGL, startServer, withTimeout, the rAF probe, the synthetic
// drag driver) now live in bench-core/node — this script composes them.
//
// Usage:
//   node bench/run.mjs                      # full matrix
//   node bench/run.mjs cosmograph            # one tool, all datasets
//   node bench/run.mjs sigma drug            # one tool + one dataset (smoke test)
import { readGL, withTimeout, launchBrowser, startServer } from '../../../bench-core/node/harness.mjs';
import { startProbe, readProbe } from '../../../bench-core/node/probe.mjs';
import { syntheticInput } from '../../../bench-core/node/drivers.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:5180';
// sigma+cosmograph render a live FA2/GPU layout (8s budget, then paused); deck+forcegraph
// render the PRECOMPUTED FA2 layout (no live sim) — same graphs, comparable element counts,
// so the FPS numbers compare RENDER throughput. g6 disqualified (scene-graph can't build
// 156K+ edges). Test any tool ad-hoc: node bench/run.mjs <tool> <ds>
const TOOLS = ['sigma', 'cosmograph', 'deck', 'forcegraph'];
const DATASETS = ['medical_device', 'drug', 'semiconductor', 'combined'];
const LAYOUT_BUDGET_MS = 8000;   // let each tool lay out before we measure interaction
const INTERACT_MS = 5000;        // scripted zoom/pan window
const READY_TIMEOUT_MS = 90000;  // max wait for data load + first render (fail fast if wedged)

const onlyTool = process.argv[2];
const onlyDs = process.argv[3];
const tools = onlyTool ? [onlyTool] : TOOLS;
const datasets = onlyDs ? [onlyDs] : DATASETS;

// Sustained CONTINUOUS motion so both continuous-render (Cosmograph) and
// on-demand-render (Sigma, repaints only on camera change) tools must redraw every
// frame → an apples-to-apples "FPS while actively interacting" number. (This is the
// legacy synthetic-input protocol; bench-core's apiCamera is the artifact-free default.)
async function measureInteraction(page, durationMs) {
  await startProbe(page, durationMs);
  await syntheticInput(page, { durationMs, selector: '#graph', panAmpX: 150, panAmpY: 150, freqDiv: 5, wheelMag: 130 });
  return readProbe(page);
}

async function runOne(browser, tool, ds) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(READY_TIMEOUT_MS);
  const rec = { tool, dataset: ds };
  try {
    await page.goto(`${BASE}/${tool}.html?g=${ds}`, { waitUntil: 'load' });
    rec.renderer = await withTimeout(page.evaluate(readGL), 25000, 'main thread wedged before render');
    rec.crossOriginIsolated = await withTimeout(page.evaluate(() => globalThis.crossOriginIsolated), 10000, 'coi');
    rec.software = /swiftshader|llvmpipe|software/i.test(rec.renderer);

    await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: READY_TIMEOUT_MS });
    const b = await page.evaluate(() => ({ ready: window.__bench.ready, error: window.__bench.error, timings: window.__bench.timings }));
    if (b.error) throw new Error('app: ' + b.error);
    rec.timings = b.timings;

    await sleep(LAYOUT_BUDGET_MS);
    rec.settled = await page.evaluate(() => !!window.__bench.settled);
    rec.tSettleMs = await page.evaluate(() => window.__bench.tSettle || null);
    await page.evaluate(() => { window.__bench.pauseLayout && window.__bench.pauseLayout(); window.__bench.fitView && window.__bench.fitView(); });
    await sleep(400);
    rec.paused = await page.evaluate(() => !!window.__bench.paused);

    rec.interaction = await measureInteraction(page, INTERACT_MS);
    rec.memMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));
    rec.ok = true;
  } catch (e) {
    rec.ok = false; rec.error = e.message;
  } finally {
    await withTimeout(page.close(), 8000, 'close').catch(() => {});
  }
  return rec;
}

const server = await startServer({ base: BASE, args: ['preview'] });
const browser = await launchBrowser();
const results = [];
try {
  for (const tool of tools) {
    for (const ds of datasets) {
      process.stdout.write(`\n▶ ${tool.padEnd(11)} ${ds.padEnd(15)} … `);
      const r = await runOne(browser, tool, ds);
      results.push(r);
      if (r.ok) {
        const load = Math.round(r.timings.tFetch + r.timings.tPrep + r.timings.tInit);
        process.stdout.write(`fps=${String(r.interaction.fps).padStart(5)}  p95=${r.interaction.p95ms}ms  load=${load}ms  mem=${r.memMB}MB  sim=${r.paused ? 'paused' : 'RUNNING!'}${r.software ? '  [SOFTWARE!]' : ''}`);
      } else process.stdout.write(`FAILED: ${r.error}`);
    }
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

mkdirSync('bench/results', { recursive: true });
writeFileSync('bench/results/results.json', JSON.stringify(results, null, 2));

const cell = (v) => (v == null ? '—' : v);
let md = `# Benchmark results\n\nReal-GPU (Metal/ANGLE) via headless Chromium — renderer verified per run. Interaction = **sustained continuous** pan+zoom over ${INTERACT_MS / 1000}s after a ${LAYOUT_BUDGET_MS / 1000}s layout budget, with each tool's layout simulation **paused**. Headless rAF is uncapped, so FPS = render throughput/headroom (>60 = comfortably smooth), not a vsync-capped display rate.\n\n`;
md += `| tool | dataset | nodes | edges | load ms | settled | **FPS** | p95 ms | mem MB | GPU |\n|---|---|--:|--:|--:|:-:|--:|--:|--:|---|\n`;
for (const r of results) {
  if (!r.ok) { md += `| ${r.tool} | ${r.dataset} | | | | | **FAIL** | | | ${r.error} |\n`; continue; }
  const load = Math.round(r.timings.tFetch + r.timings.tPrep + r.timings.tInit);
  md += `| ${r.tool} | ${r.dataset} | ${r.timings.nodes.toLocaleString()} | ${r.timings.edges.toLocaleString()} | ${load} | ${r.settled ? '✓' : '·'} | **${r.interaction.fps}** | ${r.interaction.p95ms} | ${cell(r.memMB)} | ${r.software ? '⚠SW' : 'Metal'} |\n`;
}
writeFileSync('bench/results/results.md', md);
console.log('\n\n' + md);
