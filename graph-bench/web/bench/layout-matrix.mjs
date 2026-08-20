// Layout-compute benchmark harness (Cosmograph-dev ask). Loads layout-bench.html for each
// (engine, scale), triggers window.__bench.measure(), records LAYOUT throughput (iterations/sec).
// Headed + real GPU (cosmos/helios run WebGL; headless would hit software SwiftShader). FA2 is CPU.
// Synthetic graphs only. Throughput, NOT quality-normalised (a GPU sim step ≠ a CPU FA2 step) —
// the point is how fast each engine advances the layout at scale.
//   node bench/layout-matrix.mjs
import { launchBrowser, startServer, readGL } from '../../../bench-core/node/harness.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.SITE || 'http://localhost:5180';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, 'results/layout-matrix.json');

// FA2 (CPU) is impractical past ~500K (minutes/iteration); cosmos/helios (GPU/native) go to 1M.
const RUNS = [
  { engine: 'fa2', label: 'graphology FA2 (CPU)', scales: [10000, 100000, 500000] },
  { engine: 'helios', label: 'Helios-Web (native)', scales: [10000, 100000, 500000, 1000000] },
  { engine: 'cosmos', label: 'cosmos.gl (GPU)', scales: [10000, 100000, 500000, 1000000, 4000000] }, // 4M ≈ the cit_patents tier's node count
];

const onlyEngine = process.argv[2]; // optional: re-run a single engine
const server = await startServer({ base: BASE, args: ['preview'] });
const browser = await launchBrowser({ headless: false });
const results = [];
try {
  for (const { engine, label, scales } of RUNS.filter((r) => !onlyEngine || r.engine === onlyEngine)) {
    for (const n of scales) {
      process.stdout.write(`▶ ${label.padEnd(22)} ${String(n).padStart(8)} nodes … `);
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
      page.setDefaultTimeout(180000);
      try {
        await page.goto(`${BASE}/layout-bench.html?engine=${engine}&n=${n}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 180000 });
        const err = await page.evaluate(() => window.__bench.error || null);
        if (err) throw new Error(err);
        const renderer = engine === 'fa2' ? 'cpu' : await page.evaluate(readGL);
        const software = /swiftshader|llvmpipe|software/i.test(renderer);
        if (software && engine !== 'fa2') throw new Error('software GPU (' + renderer + ') — invalid');
        const edges = await page.evaluate(() => window.__bench.edges);
        const m = await page.evaluate(async () => await window.__bench.measure());
        results.push({ engine, label, nodes: n, edges, itersPerSec: m.itersPerSec, iters: m.iters, seconds: m.seconds, software });
        console.log(`${String(m.itersPerSec).padStart(7)} iters/s  (${m.iters} in ${m.seconds}s)`);
      } catch (e) {
        results.push({ engine, label, nodes: n, error: e.message });
        console.log(`ERROR: ${e.message.slice(0, 60)}`);
      } finally { await page.close().catch(() => {}); }
      await sleep(300);
    }
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
mkdirSync(join(HERE, 'results'), { recursive: true });
// merge: re-run (engine,nodes) cells replace their old records; everything else is kept.
let merged = results;
try {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));
  const key = (r) => `${r.engine}::${r.nodes}`;
  const fresh = new Set(results.map(key));
  merged = [...prev.filter((r) => !fresh.has(key(r))), ...results];
} catch {}
writeFileSync(OUT, JSON.stringify(merged, null, 2));
console.log(`\nwrote ${OUT}`);
