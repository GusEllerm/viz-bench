// Helios-Web (filipinascimento/helios-web, 0.9.8-beta) on the PRECOMPUTED FA2
// layout: positions fed via the node `Position` attribute, force layout disabled
// (autoStartLayout:false) — render-only, same protocol surface as the other
// precomputed pages. `?fast=1` flips its `fastEdges` mode (1-px edges, the
// sigma-style hairline lever); default config is benched as-is.
import { Helios } from 'helios-web';
import { Metrics } from './metrics.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const metrics = new Metrics();
const selector = document.getElementById('dataset');

// same palette as the rest of the suite (helios takes rgb floats 0–1)
import { loadGraphTier } from './loadgraph.js';

let helios = null;

async function run(ds) {
  let camState = 'overview';
  installAdapter({ tool: 'helios', dataset: ds, settled: true, primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    metrics.stage(`fetching ${ds} …`);
    const d = await loadGraphTier(ds);
    const tFetch = d.tFetch;

    metrics.stage('building helios network …');
    const t1 = performance.now();
    const n = d.n;
    // normalise the layout coords to ±300 (helios's native scale is ~±200)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = d.pos[2 * i], y = d.pos[2 * i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const k = 600 / (Math.max(maxX - minX, maxY - minY) || 1);

    const nodeDict = {};
    for (let i = 0; i < n; i++) {
      nodeDict[d.idOf(i)] = {
        label: d.labelOf(i),
        Position: [(d.pos[2 * i] - cx) * k, (d.pos[2 * i + 1] - cy) * k, 0],
        Color: [d.colRGB[3 * i] / 255, d.colRGB[3 * i + 1] / 255, d.colRGB[3 * i + 2] / 255],
        Size: Math.max(0.5, Math.sqrt(d.deg[i] || 1) * 0.25),
      };
    }
    const edges = new Array(d.edges.length / 2);
    for (let i = 0; i < edges.length; i++) {
      edges[i] = { source: d.idOf(d.edges[2 * i]), target: d.idOf(d.edges[2 * i + 1]) };
    }
    const tPrep = performance.now() - t1;

    metrics.stage('rendering …');
    const t2 = performance.now();
    const q = new URLSearchParams(location.search);
    if (helios) { try { helios.cleanup?.(); } catch (err) {} document.getElementById('graph').innerHTML = ''; }
    helios = new Helios({
      elementID: 'graph',
      nodes: nodeDict,
      edges,
      use2D: true,
      autoStartLayout: false, // positions are precomputed — render-only
      fastEdges: q.get('fast') === '1',
      // Context MSAA OFF — parity: Sigma hardcodes antialias:false and cannot enable it; the A/B
      // showed multisample resolve dominates the continuous metric (36→120 fps at 615K edges).
      webglOptions: { antialias: false },
    });
    window.__bench.helios = helios;
    try { helios.backgroundColor([0.055, 0.066, 0.086, 1.0]); } catch (err) {} // #0e1116, house theme

    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      const tInit = performance.now() - t2;
      try { helios.pauseLayout(); } catch (err) {}
      const timings = { nodes: n, edges: edges.length, tFetch, tPrep, tInit };
      metrics.report(timings);
      metrics.startFPS();
      const baseZoom = (() => { try { const z = helios.zoomFactor(); return typeof z === 'number' && isFinite(z) && z > 0 ? z : 1; } catch (err) { return 1; } })();
      Object.assign(window.__bench, {
        ready: true,
        timings,
        baseZoom,
        paused: true,
        pauseLayout: () => { try { helios.pauseLayout(); } catch (err) {} window.__bench.paused = true; },
        fitView: () => { try { helios.zoomFactor(baseZoom, 0); } catch (err) {} },
        cosmosZoom: (z, ms) => { try { helios.zoomFactor(baseZoom * z, ms); } catch (err) {} },
        redraw: () => { try { helios.render(); } catch (err) {} }, // force-repaint (continuous-render measurement)
        counts: () => ({ nodes: n, edges: edges.length }),
        cameraState: () => camState,
        setCamera: (s) => {
          try {
            if (s === 'overview') helios.zoomFactor(baseZoom, 300);
            else helios.zoomFactor(baseZoom * (s === 'deep' ? 5 : 2), 300);
            camState = s;
          } catch (err) {}
        },
      });
    };
    helios.onReady(announce);
    // safety net: onReady is the documented path, but don't wedge if it never fires
    const poll = setInterval(() => {
      if (announced) { clearInterval(poll); return; }
      try { if (helios._isReady) announce(); } catch (err) {}
    }, 250);
    setTimeout(() => { if (!announced) announce(); }, 15000);
  } catch (err) {
    metrics.error(err);
    if (window.__bench) window.__bench.error = String(err?.message || err);
  }
}

const params = new URLSearchParams(location.search);
const initial = params.get('g') || 'arxiv_2015';
selector.value = initial;
selector.addEventListener('change', (ev) => {
  const g = ev.target.value;
  const q = new URLSearchParams(location.search);
  q.set('g', g); // keep mode params (fast, …) across dataset switches
  history.replaceState(null, '', `?${q}`);
  run(g);
});
run(initial);
