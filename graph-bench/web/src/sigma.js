import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import { Metrics } from './metrics.js';

const metrics = new Metrics();
const container = document.getElementById('graph');
const selector = document.getElementById('dataset');
let renderer = null;
let fa2 = null;

function clear() {
  if (fa2) { try { fa2.kill(); } catch (e) {} fa2 = null; }
  if (renderer) { try { renderer.kill(); } catch (e) {} renderer = null; }
  container.innerHTML = '';
}

async function run(graph) {
  window.__bench = { tool: 'sigma', dataset: graph, ready: false, settled: false, timings: null };
  try {
    clear();
    metrics.stage(`fetching ${graph}.json …`);
    const t0 = performance.now();
    const res = await fetch(`data/${graph}.json`);
    if (!res.ok) throw new Error(`fetch ${graph}.json → ${res.status}`);
    const json = await res.json();
    const tFetch = performance.now() - t0;

    metrics.stage('building graphology graph …');
    const t1 = performance.now();
    const g = new Graph({ type: 'directed' });
    for (const p of json.points) {
      g.addNode(p.id, { x: Math.random(), y: Math.random(), size: Math.max(1, p.size / 3), color: p.color, label: p.label });
    }
    for (const l of json.links) {
      if (g.hasNode(l.source) && g.hasNode(l.target)) g.mergeEdge(l.source, l.target);
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

    // spread nodes with ForceAtlas2 in a worker (off the main thread)
    const settings = forceAtlas2.inferSettings(g);
    fa2 = new FA2Layout(g, { settings });
    fa2.start();

    const timings = { nodes: json.meta.nodes, edges: json.meta.edges, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true,
      timings,
      pauseLayout: () => { try { fa2 && fa2.stop(); window.__bench.paused = true; } catch (e) {} },
      fitView: () => { try { renderer.getCamera().animatedReset({ duration: 0 }); } catch (e) {} },
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
