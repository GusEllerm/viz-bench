// THE use-case-anchored headline matrix, now on bench-core with fail-loud gates.
// Protocol: full graph on screen (fit view = the default/overview state), default product
// config, gentle COALESCED pointer pan (~30 events/s — what a human hand delivers; forces
// on-demand renderers like Sigma to redraw). Headed Chrome, Retina dpr 2. Every cell emits
// a validated result/1 record; a cell that fails any gate is QUARANTINED (ok:false), not
// dropped — so the corrupt rows the old hand-recorded matrix produced can no longer reach
// a published table.
//
//   node bench/overview-matrix.mjs                 # full 4×4 matrix
//   node bench/overview-matrix.mjs arxiv_full      # one dataset, all tools
//   node bench/overview-matrix.mjs arxiv_2015 deck   # one cell (smoke)
import { launchBrowser, startServer, readGL } from '../../../bench-core/node/harness.mjs';
import { startProbe, readProbe } from '../../../bench-core/node/probe.mjs';
import { coalescedPan } from '../../../bench-core/node/drivers.mjs';
import { gpuGate, coverageGate, cameraStateGate, inputHonestyGate } from '../../../bench-core/node/gates.mjs';
import { presentationWeb } from '../../../bench-core/node/presentation.mjs';
import { makeRecord, validate } from '../../../bench-core/node/schema.mjs';
import { graphExpected, layoutExpected, hashFile } from '../../../bench-core/node/descriptors.mjs';
import { provenance } from '../../../bench-core/node/provenance.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.SITE || 'http://localhost:5180';
const HERE = fileURLToPath(new URL('.', import.meta.url));            // graph-bench/web/bench/
const SUMMARY = join(HERE, '../../data/summary.json');                // graph-bench/data/summary.json
const layoutPath = (ds) => join(HERE, `../public/data/${ds}.layout.json`);
const OUT = join(HERE, 'results/overview-matrix.json');

// Coverage oracle = the count in the loaded layout.json (cached per dataset), NOT
// summary.json's raw counts (which predate the layout export's edge dedup).
const _loadedCache = new Map();
const loadedExpected = (ds) => {
  if (!_loadedCache.has(ds)) _loadedCache.set(ds, layoutExpected(layoutPath(ds)));
  return _loadedCache.get(ds);
};

const TOOLS = [
  { key: 'sigmapre', page: 'sigmapre.html', q: '', engine: 'sigma', edgePolicy: 'graphology' },
  { key: 'cosmographpre', page: 'cosmograph.html', q: '&pre=1', engine: 'cosmograph', wrapper: true, edgePolicy: 'exact' },
  { key: 'cosmographnoblend', page: 'cosmograph.html', q: '&pre=1&noblend=1', engine: 'cosmograph', wrapper: true, edgePolicy: 'exact' },
  { key: 'cosmosbare', page: 'cosmos.html', q: '', engine: 'cosmos.gl', edgePolicy: 'exact' },
  { key: 'cosmosnoblend', page: 'cosmos.html', q: '&noblend=1', engine: 'cosmos.gl', edgePolicy: 'exact' },
  { key: 'deck', page: 'deck.html', q: '', engine: 'deck.gl', edgePolicy: 'exact' },
  { key: 'helios', page: 'helios.html', q: '', engine: 'helios-web', edgePolicy: 'exact' },
];
const DATASETS = ['arxiv_2015', 'arxiv_2017', 'arxiv_2018', 'arxiv_full'];

const onlyDs = process.argv[2];
const onlyTool = process.argv[3];
const datasets = onlyDs ? [onlyDs] : DATASETS;
const tools = onlyTool ? TOOLS.filter((t) => t.key === onlyTool) : TOOLS;

async function runCell(browser, ds, tool, prov) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(120000);
  try {
    await page.goto(`${BASE}/${tool.page}?g=${ds}${tool.q}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 120000 });
    const appErr = await page.evaluate(() => window.__bench.error || null);
    if (appErr) throw new Error('app: ' + appErr);
    // wrapper engine ready: 2.5+ exposes zoom on the wrapper; 2.3 attached the engine at _cosmos async
    if (tool.wrapper) await page.waitForFunction(() => { const cg = window.__bench.cg; return !!(cg && (typeof cg.getZoomLevel === 'function' || cg._cosmos)); }, null, { timeout: 30000 });

    // GPU gate
    const renderer = await page.evaluate(readGL);
    const software = /swiftshader|llvmpipe|software/i.test(renderer);
    const gpu = gpuGate({ renderer, software });

    // establish the overview state (fitViewOnInit) and let it settle
    await page.evaluate(() => window.__bench.setCamera('overview'));
    await sleep(2500);

    // Coverage gate — engine-actual counts vs the LOADED-FILE expectation (the oracle).
    // summary.json's raw counts are recorded separately as provenance (the dedup delta).
    const engineCounts = await page.evaluate(() => window.__bench.counts());
    const expected = loadedExpected(ds);
    const expectedRaw = graphExpected(SUMMARY, ds);
    const coverage = coverageGate({ engine: engineCounts, expected, edgePolicy: tool.edgePolicy });

    // Camera-state gate
    const camState = await page.evaluate(() => window.__bench.cameraState());
    const supportsCamera = await page.evaluate(() => window.__bench.supportsCamera);
    const cameraState = cameraStateGate({ state: camState, supportsCamera });

    // Warm up adaptive refresh (ProMotion ramps 60→120 under sustained motion; a cold
    // measure catches it mid-ramp), then re-establish overview and measure.
    await coalescedPan(page, { durationMs: 2000, selector: '#graph' });
    await page.evaluate(() => window.__bench.setCamera('overview'));
    await sleep(500);
    // Measure: gentle coalesced pan at overview (the headline protocol)
    await startProbe(page, 5000);
    await coalescedPan(page, { durationMs: 5000, selector: '#graph' });
    const m = await readProbe(page);
    const memMB = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));

    // Presentation gate (after measuring; drives setCamera('mid') then restores overview)
    const presentation = await presentationWeb(page, { selector: '#graph' });

    // CONTINUOUS-RENDER measurement (Cosmograph-dev critique): the pan above lets ON-DEMAND
    // renderers (Sigma repaints only on change) idle at the display refresh between the 30 ev/s
    // pan events, so their fps is interactive smoothness, not render throughput. Here force a
    // repaint of the FIXED overview EVERY frame (window.__bench.redraw) so every engine renders
    // every frame — raw render throughput, apples-to-apples with the always-rendering engines.
    // Median of 3 (the metric has ~15% run-to-run variance).
    await page.evaluate(() => window.__bench.setCamera('overview'));
    await sleep(600);
    const contRuns = [];
    for (let r = 0; r < 3; r++) {
      await startProbe(page, 3000);
      await page.evaluate((dur) => {
        const t0 = performance.now();
        const step = () => { try { window.__bench.redraw(); } catch (e) {} if (performance.now() - t0 < dur) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }, 3000);
      await sleep(3200);
      contRuns.push(await readProbe(page));
    }
    contRuns.sort((a, b) => a.fps - b.fps);
    const mCont = contRuns[1]; // median

    // Input-honesty gate
    const inputHonesty = inputHonestyGate({ driver: 'pan' });

    const primitives = await page.evaluate(() => window.__bench.primitives);
    const hash = await hashFile(layoutPath(ds));

    return makeRecord({
      domain: 'graph',
      tool: tool.key,
      engine: { library: tool.engine },
      dataset: { name: ds, descriptor: 'graph-bench/data/summary.json', hash, expectedRaw, expectedLoaded: expected },
      primitives,
      scale: engineCounts,
      coverage: { engine: engineCounts, edgePolicy: tool.edgePolicy, ok: coverage.pass },
      protocol: { driver: 'pan', cameraState: camState, motion: 'coalesced-pan', durationMs: 5000, pixelRatio: 2, headed: true },
      metrics: { fps: m.fps, frames: m.frames, p50ms: m.p50ms, p95ms: m.p95ms, memMB, fpsCont: mCont.fps, p95Cont: mCont.p95ms },
      presentation: { surface: 'onscreen', method: presentation.method, presented: presentation.pass, detail: presentation.detail },
      gpu: { renderer, software },
      gateResults: { gpu, coverage, presentation, cameraState, inputHonesty },
      provenance: prov,
    });
  } catch (e) {
    // quarantined record: failed before/while gating — ok:false, carries the error
    return makeRecord({
      domain: 'graph', tool: tool.key, engine: { library: tool.engine }, dataset: { name: ds },
      protocol: { driver: 'pan', cameraState: 'overview' }, gateResults: {}, provenance: prov, error: e.message,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

// Pre-run warmup: ramp the display's adaptive refresh (ProMotion 60→120) BEFORE the first
// measured cell. Without it the display starts each run cold at 60 Hz and the first cells
// read 60 for vsync-capped-fast renderers — noise that flaps by cell order, not real perf.
async function warmupDisplay(browser) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    await p.goto(`${BASE}/deck.html?g=arxiv_2015`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 60000 }).catch(() => {});
    await coalescedPan(p, { durationMs: 8000, selector: '#graph' });
  } catch {} finally {
    await p.close().catch(() => {});
  }
}

const prov = provenance();
const server = await startServer({ base: BASE, args: ['preview'] });
const browser = await launchBrowser({ headless: false });
process.stdout.write('warming up display refresh … ');
await warmupDisplay(browser);
console.log('done\n');
const results = [];
try {
  for (const ds of datasets) {
    for (const tool of tools) {
      process.stdout.write(`▶ ${tool.key.padEnd(14)} ${ds.padEnd(15)} … `);
      const rec = await runCell(browser, ds, tool, prov);
      results.push(rec);
      const v = validate(rec);
      if (rec.ok) {
        console.log(`fps=${String(rec.metrics.fps).padStart(6)}  p95=${rec.metrics.p95ms}ms  cov=${rec.coverage.ok ? '✓' : '✗'}  present=${rec.presentation.presented ? '✓' : '✗'}  gates=ALL PASS${v.valid ? '' : '  [INVALID:' + v.problems.join(',') + ']'}`);
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
// everything else is kept — so a partial re-run (one tool/dataset) updates in place.
let merged = results;
try {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));
  const key = (r) => `${r.tool}::${r.dataset?.name}`;
  const fresh = new Set(results.map(key));
  merged = [...prev.filter((r) => !fresh.has(key(r))), ...results];
} catch {}
writeFileSync(OUT, JSON.stringify(merged, null, 2));
const pub = results.filter((r) => r.ok).length;
console.log(`\nwrote ${OUT}\n${pub}/${results.length} cells published (ok && all gates pass); ${results.length - pub} quarantined`);
