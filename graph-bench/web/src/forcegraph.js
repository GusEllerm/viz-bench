// 3d-force-graph bench page — Three.js / WebGL renderer (the force-graph family).
// Renders the PRECOMPUTED FA2 layout with node positions FIXED (fx/fy/fz) and the
// simulation OFF (cooldownTicks 0) → pure render, comparable to the "sim paused"
// numbers for the other tools. Note its rendering model: links are a single merged
// LineSegments (cheap) but each node is its own sphere Mesh (one draw call/node) →
// the bottleneck here is NODE count, the mirror image of Cosmos.
import ForceGraph3D from '3d-force-graph';
import { Metrics } from './metrics.js';

const HEX = { paper: '#4C78A8', patent: '#F58518', product: '#54A24B', trial: '#E45756' };
const metrics = new Metrics();
const container = document.getElementById('graph');
const selector = document.getElementById('dataset');
let Graph = null;

async function run(graph) {
  window.__bench = { tool: 'forcegraph', dataset: graph, ready: false, settled: false, timings: null };
  try {
    if (Graph) { try { Graph._destructor(); } catch (e) {} container.innerHTML = ''; Graph = null; }

    metrics.stage(`fetching ${graph}.layout.json …`);
    const t0 = performance.now();
    const res = await fetch(`data/${graph}.layout.json`);
    if (!res.ok) throw new Error(`fetch ${graph}.layout.json → ${res.status}`);
    const json = await res.json();
    const tFetch = performance.now() - t0;

    metrics.stage('building graph objects …');
    const t1 = performance.now();
    const src = json.nodes;
    const N = src.length, E = json.edges.length / 2;
    const nodes = new Array(N);
    for (let i = 0; i < N; i++) {
      const n = src[i];
      // x/y/z set AND fx/fy/fz pinned → no drift even if a tick sneaks in
      nodes[i] = { id: n.id, x: n.x, y: n.y, z: 0, fx: n.x, fy: n.y, fz: 0, color: HEX[n.t] || '#9aa0aa' };
    }
    const links = new Array(E);
    for (let e = 0; e < E; e++) {
      links[e] = { source: src[json.edges[2 * e]].id, target: src[json.edges[2 * e + 1]].id };
    }
    const tPrep = performance.now() - t1;

    metrics.stage('rendering (Three.js scene-graph) …');
    const t2 = performance.now();
    Graph = new ForceGraph3D(container, { controlType: 'orbit' })
      .backgroundColor('#0e1116')
      .warmupTicks(0)
      .cooldownTicks(0)            // positions fixed → no live layout
      .enableNodeDrag(false)
      .nodeRelSize(2)
      .nodeResolution(5)
      .nodeColor('color')
      .linkColor(() => 'rgba(150,165,190,0.18)')
      .linkWidth(0)               // 0 → merged GL_LINES (one draw call) rather than per-link cylinders
      .linkDirectionalParticles(0)
      .graphData({ nodes, links });
    const tInit = performance.now() - t2;

    const timings = { nodes: N, edges: E, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true, timings,
      settled: true, tSettle: 0,
      // sim is already off (cooldownTicks 0); do NOT pauseAnimation() — that would stop
      // the render loop and make the FPS probe read idle frames.
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { Graph.zoomToFit(0); } catch (e) {} },
    });
  } catch (e) {
    metrics.error(e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

const params = new URLSearchParams(location.search);
const initial = params.get('g') || 'medical_device';
selector.value = initial;
selector.addEventListener('change', (e) => {
  const g = e.target.value;
  history.replaceState(null, '', `?g=${g}`);
  run(g);
});
run(initial);
