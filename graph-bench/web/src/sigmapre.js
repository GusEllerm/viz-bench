// Sigma.js on the PRECOMPUTED FA2 layout (no live worker) — a render-only control so
// Sigma and deck.gl are measured on the SAME node positions. Isolates the layout-state
// confound: the default `sigma.js` bench renders a live 8s FA2 (less converged, more
// spread); this renders the converged layout deck.gl uses, for an airtight head-to-head.
import Graph from 'graphology';
import Sigma from 'sigma';
import { Metrics } from './metrics.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

import { loadGraphTier, hexOfRGB } from './loadgraph.js';
const metrics = new Metrics();
const container = document.getElementById('graph');
const selector = document.getElementById('dataset');
let renderer = null;

async function run(graph) {
  let camState = 'overview';
  installAdapter({ tool: 'sigmapre', dataset: graph, primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (renderer) { try { renderer.kill(); } catch (e) {} renderer = null; }
    container.innerHTML = '';

    metrics.stage(`fetching ${graph} …`);
    const d = await loadGraphTier(graph);
    const tFetch = d.tFetch;

    metrics.stage('building graphology graph (precomputed layout) …');
    const t1 = performance.now();
    const g = new Graph({ type: 'directed' });
    for (let i = 0; i < d.n; i++) {
      g.addNode(d.idOf(i), { x: d.pos[2 * i], y: d.pos[2 * i + 1], size: Math.max(1.5, Math.sqrt(d.deg[i] || 1)), color: hexOfRGB(d.colRGB, i) });
    }
    for (let e = 0; e < d.edges.length / 2; e++) {
      g.mergeEdge(d.idOf(d.edges[2 * e]), d.idOf(d.edges[2 * e + 1]));
    }
    const tPrep = performance.now() - t1;

    metrics.stage('rendering …');
    const t2 = performance.now();
    renderer = new Sigma(g, container, {
      defaultEdgeColor: 'rgba(120,140,170,0.10)',
      enableEdgeEvents: false,
      labelRenderedSizeThreshold: 14,
    });
    const tInit = performance.now() - t2;

    const timings = { nodes: g.order, edges: g.size, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true, timings,
      settled: true, tSettle: 0, // precomputed layout — no live sim
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { renderer.getCamera().animatedReset({ duration: 0 }); } catch (e) {} },
      // API-driven camera motion (protocol-sensitivity check vs CDP input events)
      cosmosZoom: (z, ms) => { try { renderer.getCamera().animate({ ratio: z }, { duration: ms }); } catch (e) {} },
      // force a re-DRAW of the current view — for the continuous-render measurement, which forces
      // on-demand renderers (Sigma repaints only on change) to render every frame like the continuous
      // engines, so raw render throughput is apples-to-apples. NB: refresh() would RE-INDEX the whole
      // graph each frame (a data cost, not a render cost); instead nudge the camera by an imperceptible
      // amount so only the GPU draw re-runs (all edges stay on screen).
      redraw: () => { try { const c = renderer.getCamera(); const s = c.getState(); c.setState({ ...s, angle: (s.angle || 0) + (performance.now() % 1000) * 1e-9 }); } catch (e) {} },
      counts: () => ({ nodes: g.order, edges: g.size }),
      cameraState: () => camState,
      // sigma camera ratio is inverted: smaller ratio = zoomed IN. overview = reset.
      setCamera: (s) => {
        try {
          const cam = renderer.getCamera();
          if (s === 'overview') cam.animatedReset({ duration: 300 });
          else cam.animate({ ratio: s === 'deep' ? 0.15 : 0.4 }, { duration: 300 });
          camState = s;
        } catch (e) {}
      },
    });
  } catch (e) {
    metrics.error(e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

const params = new URLSearchParams(location.search);
const initial = params.get('g') || 'arxiv_2015';
selector.value = initial;
selector.addEventListener('change', (e) => {
  const g = e.target.value;
  history.replaceState(null, '', `?g=${g}`);
  run(g);
});
run(initial);
