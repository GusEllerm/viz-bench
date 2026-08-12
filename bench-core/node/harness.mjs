// Shared harness primitives — previously copy-pasted across every bench script.
// node-only (Playwright + child_process). NEVER import this from a Vite/browser page.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

// Read the live WebGL2 renderer string (passed to page.evaluate). Used by the GPU
// gate to prove we ran on the real Metal GPU and not a software fallback.
export function readGL() {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'no-webgl2';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

// Guards against a tool that wedges the main thread (page.evaluate has no built-in timeout).
export const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + label)), ms))]);

// Launch headless (or headed) Chromium on the REAL Metal GPU via ANGLE.
export function launchBrowser({ headless = true, extraArgs = [] } = {}) {
  return chromium.launch({ headless, args: ['--ignore-gpu-blocklist', '--use-angle=metal', ...extraArgs] });
}

// Start (or reuse) the app's Vite server. `args` is the vite CLI argv:
//   ['preview']  → production build, prod-like, no dep-optimizer raciness (graph-bench)
//   []           → dev server (manifold-bench serves symlinked public/data this way)
// Spawned with the current process cwd, so `node_modules/vite/bin/vite.js` resolves to
// the app's own Vite — run bench scripts from the app dir, as before.
export async function startServer({ base, args = ['preview'], tries = 80, intervalMs = 500 } = {}) {
  try {
    if ((await fetch(base)).ok) { console.log(`(using existing server on ${base})`); return null; }
  } catch {}
  const proc = spawn('node', ['node_modules/vite/bin/vite.js', ...args], { stdio: 'ignore' });
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(base); if (r.ok) return proc; } catch {}
    await sleep(intervalMs);
  }
  proc.kill();
  throw new Error('vite did not start on ' + base);
}
