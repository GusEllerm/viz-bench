// One-off experiment (Cosmograph-dev critique): is the headline fps apples-to-apples between
// ON-DEMAND renderers (Sigma repaints only on change) and CONTINUOUS ones (cosmos redraws every
// frame)? The rAF probe counts display frames, so the gentle 30 ev/s pan lets on-demand renderers
// idle at vsync. Here we ALSO drive a continuous per-frame view animation via each engine's own
// API (window.__bench.cosmosZoom, no synthetic input) — forcing every renderer to render every
// frame — and compare. Headed, Retina dpr 2, preview server. Prints pan vs continuous fps.
import { launchBrowser, startServer } from '../../../bench-core/node/harness.mjs';
import { startProbe, readProbe } from '../../../bench-core/node/probe.mjs';
import { coalescedPan } from '../../../bench-core/node/drivers.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.SITE || 'http://localhost:5180';
const TOOLS = [
  { key: 'sigmapre', page: 'sigmapre.html', q: '' },
  { key: 'helios', page: 'helios.html', q: '' },
  { key: 'deck', page: 'deck.html', q: '' },
  { key: 'cosmographpre', page: 'cosmograph.html', q: '&pre=1', wrapper: true },
  { key: 'cosmographnoblend', page: 'cosmograph.html', q: '&pre=1&noblend=1', wrapper: true },
];
const DATASETS = ['arxiv_2018', 'arxiv_full'];
const MS = 4000;

async function panFPS(page, ms) {
  await startProbe(page, ms);
  await coalescedPan(page, { durationMs: ms, selector: '#graph' });
  return readProbe(page);
}
// continuous render: force-repaint the FIXED overview every frame via each engine's own render
// call (window.__bench.redraw) — no zoom change (visible-edge count is constant), no synthetic
// pointer events (no pick/hover overhead). Pure overview render throughput, apples-to-apples.
async function continuousFPS(page, ms) {
  await startProbe(page, ms);
  await page.evaluate((dur) => {
    const t0 = performance.now();
    const step = () => {
      try { window.__bench.redraw(); } catch (e) {}
      if (performance.now() - t0 < dur) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, ms);
  await sleep(ms + 250);
  return readProbe(page);
}

const server = await startServer({ base: BASE, args: ['preview'] });
const browser = await launchBrowser({ headless: false });
process.stdout.write('warming up display … ');
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    await p.goto(`${BASE}/deck.html?g=arxiv_2015`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 60000 }).catch(() => {});
    await coalescedPan(p, { durationMs: 6000, selector: '#graph' });
  } catch {} finally { await p.close().catch(() => {}); }
}
console.log('done\n');
console.log('  tool                dataset        PAN (current)      CONTINUOUS (fair)');
console.log('  ' + '-'.repeat(72));
try {
  for (const ds of DATASETS) {
    for (const tool of TOOLS) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      page.setDefaultTimeout(120000);
      try {
        await page.goto(`${BASE}/${tool.page}?g=${ds}${tool.q}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 120000 });
        if (tool.wrapper) await page.waitForFunction(() => { const cg = window.__bench.cg; return !!(cg && (typeof cg.getZoomLevel === 'function' || cg._cosmos)); }, null, { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => window.__bench.setCamera('overview'));
        await sleep(2500);
        await coalescedPan(page, { durationMs: 1500, selector: '#graph' }); // warm adaptive refresh
        await page.evaluate(() => window.__bench.setCamera('overview'));
        await sleep(500);
        const pan = await panFPS(page, MS);
        await page.evaluate(() => window.__bench.setCamera('overview'));
        await sleep(800);
        const cont = await continuousFPS(page, MS);
        console.log(`  ${tool.key.padEnd(18)} ${ds.padEnd(14)} ${String(pan.fps).padStart(6)} fps (p95 ${String(pan.p95ms).padStart(5)}ms)   ${String(cont.fps).padStart(6)} fps (p95 ${String(cont.p95ms).padStart(5)}ms)`);
      } catch (e) {
        console.log(`  ${tool.key.padEnd(18)} ${ds.padEnd(14)} ERROR: ${e.message.slice(0, 60)}`);
      } finally { await page.close().catch(() => {}); }
    }
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
