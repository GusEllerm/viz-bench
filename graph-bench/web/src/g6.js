import { Graph } from '@antv/g6';
import { Renderer as WebGLRenderer } from '@antv/g-webgl';
import { Metrics } from './metrics.js';

const metrics = new Metrics();
const container = document.getElementById('graph');
const selector = document.getElementById('dataset');
let graph = null;

function clear() {
  if (graph) { try { graph.destroy(); } catch (e) {} graph = null; }
  container.innerHTML = '';
}

async function run(dataset) {
  window.__bench = { tool: 'g6', dataset, ready: false, settled: false, timings: null };
  try {
    clear();
    metrics.stage(`fetching ${dataset}.json …`);
    const t0 = performance.now();
    const res = await fetch(`data/${dataset}.json`);
    if (!res.ok) throw new Error(`fetch ${dataset}.json → ${res.status}`);
    const json = await res.json();
    const tFetch = performance.now() - t0;

    // Preset random positions (no layout) — keeps init bounded; the discriminating
    // axis here is WebGL render throughput at scale, same as the other tools.
    metrics.stage('building G6 data …');
    const t1 = performance.now();
    const span = Math.max(1500, Math.sqrt(json.points.length) * 14);
    const nodes = json.points.map((p) => ({
      id: p.id,
      size: Math.max(2, p.size / 2),
      style: { x: Math.random() * span, y: Math.random() * span, fill: p.color, lineWidth: 0 },
    }));
    const edges = json.links.map((l, i) => ({ id: 'e' + i, source: l.source, target: l.target }));
    const tPrep = performance.now() - t1;

    metrics.stage('rendering (WebGL) …');
    const t2 = performance.now();
    graph = new Graph({
      container,
      renderer: () => new WebGLRenderer(),
      data: { nodes, edges },
      node: { style: { size: (d) => d.size ?? 4 } },
      edge: { style: { stroke: 'rgba(120,140,170,0.10)', lineWidth: 1, endArrow: false } },
      behaviors: ['zoom-canvas', 'drag-canvas'],
    });
    await graph.render();
    const tInit = performance.now() - t2;

    const timings = { nodes: json.meta.nodes, edges: json.meta.edges, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true,
      timings,
      pauseLayout: () => { try { graph.stopLayout(); } catch (e) {} window.__bench.paused = true; },
      fitView: () => { try { graph.fitView(); } catch (e) {} },
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
