// Headless driver for the cosmos GPU layout of a binary graph tier: opens layout-export.html,
// waits for the sim to run its iterations, pulls the settled positions in base64 chunks, and
// writes <tier>.pos.f32. NOT a benchmark — window/screen state cannot corrupt the result
// (occlusion only slows the sim), and it runs headless anyway.
//   node layout_citpatents.mjs [tier] [iters]      (default cit_patents 600)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB = join(HERE, '../web');
const tier = process.argv[2] || 'cit_patents';
const iters = parseInt(process.argv[3] || '600', 10);
const BASE = 'http://localhost:5188';

// dev server (serves public/data without a build)
let server = null;
try { if ((await fetch(BASE)).ok) console.log('(reusing server)'); } catch {
  server = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '5188', '--strictPort'], { cwd: WEB, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await sleep(500); }
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--js-flags=--max-old-space-size=8192'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
try {
  console.log(`loading ${tier} (${iters} iters)…`);
  const extra = process.argv[4] || ''; // e.g. 'gravity=0.5&repulsion=0.15&spring=1'
  await page.goto(`${BASE}/layout-export.html?g=${tier}&iters=${iters}${extra ? '&' + extra : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__layout && (window.__layout.ready || window.__layout.error), null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__layout.error);
  if (err) throw new Error(err);

  const t0 = Date.now();
  let last = 0;
  while (true) {
    await sleep(5000);
    const st = await page.evaluate(() => ({ f: window.__layout.frames, done: window.__layout.done, err: window.__layout.error }));
    if (st.err) throw new Error(st.err);
    if (st.done) break;
    const rate = ((st.f - last) / 5).toFixed(1);
    last = st.f;
    process.stdout.write(`\r  ${st.f}/${iters} iters — ${rate} it/s — ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
    writeFileSync(join(HERE, 'raw/layout-status.txt'), `${tier} ${st.f}/${iters} iters, ${rate} it/s, ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed\n`); // readable mid-run
  }
  console.log('\nreading back…');
  const total = await page.evaluate(() => window.__layout.result.length);
  const CHUNK = 2_000_000; // floats per pull
  const buf = Buffer.alloc(total * 4);
  for (let i = 0; i < total; i += CHUNK) {
    const b64 = await page.evaluate(([o, l]) => window.__layout.chunk(o, l), [i, Math.min(CHUNK, total - i)]);
    Buffer.from(b64, 'base64').copy(buf, i * 4);
    process.stdout.write(`\r  ${Math.min(i + CHUNK, total).toLocaleString()}/${total.toLocaleString()} floats   `);
  }
  const out = join(WEB, `public/data/${tier}.pos.f32`);
  writeFileSync(out, buf);
  console.log(`\nwrote ${out} (${(buf.length / 1e6).toFixed(0)} MB)`);
} finally {
  await browser.close();
  if (server) server.kill();
}
