// Gated point-cloud matrix (manifold) on bench-core. Headless, uncapped rAF (FPS = render
// throughput), apiCamera zoom oscillation (the in-motion orbit/zoom analog). Each cell emits
// a validated result/1 record with the 5 gates; coverage uses the cloud's manifest point
// count (99% floor); presentation pixel-diffs the #view canvas.
//
//   node bench/pc-matrix.mjs                       # full set
//   node bench/pc-matrix.mjs swiss_roll_1000000    # one cloud, both renderers
//   node bench/pc-matrix.mjs swiss_roll_100000 deck   # one cell (smoke)
import { launchBrowser, startServer, readGL } from '../../../bench-core/node/harness.mjs';
import { startProbe, readProbe } from '../../../bench-core/node/probe.mjs';
import { apiCamera } from '../../../bench-core/node/drivers.mjs';
import { gpuGate, coverageGate, cameraStateGate, inputHonestyGate } from '../../../bench-core/node/gates.mjs';
import { presentationWeb } from '../../../bench-core/node/presentation.mjs';
import { makeRecord, validate } from '../../../bench-core/node/schema.mjs';
import { cloudExpected, hashFile } from '../../../bench-core/node/descriptors.mjs';
import { provenance } from '../../../bench-core/node/provenance.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.SITE || 'http://localhost:5200';
const HERE = fileURLToPath(new URL('.', import.meta.url)); // manifold-bench/web/bench/
const MANIFEST = join(HERE, '../../data/manifest.json');
const cloudPosPath = (base) => join(HERE, `../public/data/${base}.pos.f32`);
const OUT = join(HERE, 'results/pc-matrix.json');

const TOOLS = [
  { key: 'deck', page: 'deck.html', engine: 'deck.gl' },
  { key: 'three', page: 'three.html', engine: 'three.js' },
  { key: 'cosmos3d', page: 'cosmos.html', engine: '@cosmograph/cosmos' }, // the experimental 3D fork of cosmos.gl
];
// the report's columns; 20M/50M are heavy (229/572 MB) — run them explicitly if desired
const CLOUDS = ['swiss_roll_100000', 'swiss_roll_1000000', 'graph_combined_umap3', 'swiss_roll_10000000', 'swiss_roll_20000000', 'swiss_roll_50000000'];

const onlyCloud = process.argv[2];
const onlyTool = process.argv[3];
const clouds = onlyCloud ? [onlyCloud] : CLOUDS;
const tools = onlyTool ? TOOLS.filter((t) => t.key === onlyTool) : TOOLS;

const _hash = new Map();
const cloudHash = (base) => { if (!_hash.has(base)) _hash.set(base, hashFile(cloudPosPath(base))); return _hash.get(base); };

async function runCell(browser, cloud, tool, prov) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(180000);
  try {
    await page.goto(`${BASE}/${tool.page}?c=${cloud}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 180000 });
    const appErr = await page.evaluate(() => window.__bench.error || null);
    if (appErr) throw new Error('app: ' + appErr);

    const renderer = await page.evaluate(readGL);
    const software = /swiftshader|llvmpipe|software/i.test(renderer);
    const gpu = gpuGate({ renderer, software });

    await page.evaluate(() => window.__bench.setCamera('overview'));
    await sleep(1500);

    const engineCounts = await page.evaluate(() => window.__bench.counts());
    const expected = cloudExpected(MANIFEST, cloud);
    const coverage = coverageGate({ engine: engineCounts, expected }); // points 99% floor

    await startProbe(page, 5000);
    await page.evaluate((ms) => window.__bench.orbit(ms), 5000); // continuous orbit (engine-API, zero input)
    await sleep(5000);
    const m = await readProbe(page);
    const memMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));

    const camState = await page.evaluate(() => window.__bench.cameraState());
    const supportsCamera = await page.evaluate(() => window.__bench.supportsCamera);
    const cameraState = cameraStateGate({ state: camState, supportsCamera });
    const presentation = await presentationWeb(page, { selector: '#view' });
    const inputHonesty = inputHonestyGate({ driver: 'orbit' });
    const primitives = await page.evaluate(() => window.__bench.primitives);
    const hash = await cloudHash(cloud);

    return makeRecord({
      domain: 'manifold',
      tool: tool.key,
      engine: { library: tool.engine },
      dataset: { name: cloud, descriptor: 'manifold-bench/data/manifest.json', hash, expectedLoaded: expected },
      primitives,
      scale: engineCounts,
      coverage: { engine: engineCounts, edgePolicy: 'points', ok: coverage.pass },
      protocol: { driver: 'orbit', cameraState: camState, motion: 'continuous-orbit', durationMs: 5000, pixelRatio: 1, headed: false },
      metrics: { fps: m.fps, frames: m.frames, p50ms: m.p50ms, p95ms: m.p95ms, memMB },
      presentation: { surface: 'onscreen', method: presentation.method, presented: presentation.pass, detail: presentation.detail },
      gpu: { renderer, software },
      gateResults: { gpu, coverage, presentation, cameraState, inputHonesty },
      provenance: prov,
    });
  } catch (e) {
    return makeRecord({
      domain: 'manifold', tool: tool.key, engine: { library: tool.engine }, dataset: { name: cloud },
      protocol: { driver: 'apiCamera', cameraState: 'overview' }, gateResults: {}, provenance: prov, error: e.message,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

const prov = provenance();
const server = await startServer({ base: BASE, args: [] }); // dev server (serves symlinked public/data)
const browser = await launchBrowser({ headless: true });
const results = [];
try {
  for (const cloud of clouds) {
    for (const tool of tools) {
      process.stdout.write(`▶ ${tool.key.padEnd(6)} ${cloud.padEnd(22)} … `);
      const rec = await runCell(browser, cloud, tool, prov);
      results.push(rec);
      const v = validate(rec);
      if (rec.ok) {
        console.log(`fps=${String(rec.metrics.fps).padStart(7)}  pts=${(rec.scale?.points ?? 0).toLocaleString()}  cov=${rec.coverage.ok ? '✓' : '✗'}  present=${rec.presentation.presented ? '✓' : '✗'}  mem=${rec.metrics.memMB}MB${v.valid ? '' : '  [INVALID]'}`);
      } else {
        console.log(`QUARANTINED  ${rec.error ? 'err=' + rec.error : 'gates: ' + rec.gateFailures.join(' | ')}`);
      }
    }
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

mkdirSync(join(HERE, 'results'), { recursive: true });
// merge into any existing results: re-run (tool,dataset) cells replace their old records,
// everything else is kept — so a partial re-run (one tool/cloud) updates in place.
let merged = results;
try {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));
  const key = (r) => `${r.tool}::${r.dataset?.name}`;
  const fresh = new Set(results.map(key));
  merged = [...prev.filter((r) => !fresh.has(key(r))), ...results];
} catch {}
writeFileSync(OUT, JSON.stringify(merged, null, 2));
const pub = results.filter((r) => r.ok).length;
console.log(`\nwrote ${OUT}\n${pub}/${results.length} cells published; ${results.length - pub} quarantined`);
