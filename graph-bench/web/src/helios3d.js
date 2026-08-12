// Helios-Web in its native 3D mode: the combined knowledge graph (139,442 nodes /
// 1.1M edges) rendered AT its Phase-4 manifold-embedding coordinates (UMAP or
// spectral, ?c=umap3|spec3) — the only page in the suite that draws the graph's
// EDGES in 3D. Node order in the cloud binaries is verified identical to
// combined.layout.json (type-color check, 0/139,442 mismatches), so positions,
// colors and edges line up by index.
//   ?fast=1 → helios fastEdges (1-px edges) · ?live=1 → ignore the embedding and
//   run Helios's own 3D force layout instead.
import { Helios } from 'helios-web';
import { Metrics } from './metrics.js';

const metrics = new Metrics();
const selector = document.getElementById('dataset');

const TYPE_COLORS = {
  paper: [0.298, 0.471, 0.659],
  patent: [0.961, 0.522, 0.094],
  product: [0.329, 0.635, 0.294],
  trial: [0.894, 0.341, 0.337],
};
const FALLBACK = [0.7, 0.7, 0.7];
const SCALE = 30; // embeddings are normalised to ±10; helios's native range is ~±200–300

let helios = null;

async function run(cloud) {
  const q = new URLSearchParams(location.search);
  const live = q.get('live') === '1';
  window.__bench = { tool: 'helios3d', dataset: `combined·${live ? 'live3d' : cloud}`, ready: false, settled: !live, timings: null };
  try {
    metrics.stage(`fetching graph + ${cloud} embedding …`);
    const t0 = performance.now();
    const [graphRes, posRes] = await Promise.all([
      fetch('data/combined.layout.json'),
      live ? Promise.resolve(null) : fetch(`data/clouds/graph_combined_${cloud}.pos.f32`),
    ]);
    if (!graphRes.ok) throw new Error(`fetch combined.layout.json → ${graphRes.status}`);
    if (posRes && !posRes.ok) throw new Error(`fetch graph_combined_${cloud}.pos.f32 → ${posRes.status}`);
    const json = await graphRes.json();
    const pos = posRes ? new Float32Array(await posRes.arrayBuffer()) : null;
    const tFetch = performance.now() - t0;

    metrics.stage('building helios 3D network …');
    const t1 = performance.now();
    const nodes = json.nodes;
    const n = nodes.length;
    if (pos && pos.length !== n * 3) throw new Error(`embedding/graph size mismatch: ${pos.length / 3} vs ${n}`);
    const nodeDict = {};
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      const entry = {
        label: nd.l || nd.id,
        Color: TYPE_COLORS[nd.t] || FALLBACK,
        Size: Math.max(0.5, Math.sqrt(nd.d || 1) * 0.25),
      };
      if (pos) entry.Position = [pos[3 * i] * SCALE, pos[3 * i + 1] * SCALE, pos[3 * i + 2] * SCALE];
      nodeDict[nd.id] = entry;
    }
    const e = json.edges;
    const edges = new Array(e.length / 2);
    for (let i = 0; i < edges.length; i++) {
      edges[i] = { source: nodes[e[2 * i]].id, target: nodes[e[2 * i + 1]].id };
    }
    const tPrep = performance.now() - t1;

    metrics.stage('rendering …');
    const t2 = performance.now();
    if (helios) { try { helios.cleanup?.(); } catch (err) {} document.getElementById('graph').innerHTML = ''; }
    helios = new Helios({
      elementID: 'graph',
      nodes: nodeDict,
      edges,
      use2D: false, // native 3D
      autoStartLayout: live,
      fastEdges: q.get('fast') === '1',
    });
    window.__bench.helios = helios;
    try { helios.backgroundColor([0.055, 0.066, 0.086, 1.0]); } catch (err) {}

    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      const tInit = performance.now() - t2;
      if (!live) { try { helios.pauseLayout(); } catch (err) {} }
      const timings = { nodes: n, edges: edges.length, tFetch, tPrep, tInit };
      metrics.report(timings);
      metrics.startFPS();
      const baseZoom = (() => { try { const z = helios.zoomFactor(); return typeof z === 'number' && isFinite(z) && z > 0 ? z : 1; } catch (err) { return 1; } })();
      Object.assign(window.__bench, {
        ready: true,
        timings,
        baseZoom,
        paused: !live,
        pauseLayout: () => { try { helios.pauseLayout(); } catch (err) {} window.__bench.paused = true; },
        fitView: () => { try { helios.zoomFactor(baseZoom, 0); } catch (err) {} },
        cosmosZoom: (z, ms) => { try { helios.zoomFactor(baseZoom * z, ms); } catch (err) {} },
      });
    };
    helios.onReady(announce);
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
const initial = ['umap3', 'spec3'].includes(params.get('c')) ? params.get('c') : 'umap3';
selector.value = initial;
selector.addEventListener('change', (ev) => {
  const c = ev.target.value;
  const q = new URLSearchParams(location.search);
  q.set('c', c); // keep mode params (fast, live) across embedding switches
  history.replaceState(null, '', `?${q}`);
  run(c);
});
run(initial);
