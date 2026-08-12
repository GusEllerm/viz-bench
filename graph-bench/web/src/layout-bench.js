// LAYOUT-COMPUTE benchmark (Cosmograph-dev ask): the render benchmark uses PRECOMPUTED positions
// to isolate rendering — which hides cosmos.gl's headline strength, GPU force layout. This page
// measures LAYOUT throughput (iterations/sec) on a SYNTHETIC graph (public-safe, fully synthetic).
//   ?engine=cosmos|helios|fa2   ?n=100000
// cosmos: GPU force sim (enableSimulation) — iters/sec = sim frames/sec.
// helios: native force layout (autoStartLayout) — iters/sec = layout frames/sec.
// fa2:    graphology-layout-forceatlas2 (CPU) — iters/(wall-clock), time-budgeted.
// window.__bench.{ready, engine, n, edges, measure()} — the node harness triggers measure().
import { Graph as CosmosGraph } from '@cosmos.gl/graph';
import { Helios } from 'helios-web';
import Graphology from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

const $ = (id) => document.getElementById(id);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// synthetic graph: N nodes at RANDOM positions (so the layout has work to do) + M ~= n*avgDeg/2
// random edges. O(n+M) — builds fast even at 1M. Public-safe (no real-graph structure).
function synth(n, avgDeg = 4) {
  const rand = mulberry32(7);
  const positions = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { positions[i * 2] = rand() * 2 - 1; positions[i * 2 + 1] = rand() * 2 - 1; }
  const M = Math.round(n * avgDeg / 2);
  const links = new Float32Array(M * 2);
  const edges = new Array(M);
  for (let e = 0; e < M; e++) { const a = (rand() * n) | 0; let b = (rand() * n) | 0; if (b === a) b = (b + 1) % n; links[e * 2] = a; links[e * 2 + 1] = b; edges[e] = [a, b]; }
  return { n, positions, links, edges, M };
}

// count animation frames over `ms` (each frame = one layout iteration for the continuous engines)
const frameRate = (ms) => new Promise((res) => {
  let f = 0; const t0 = performance.now();
  const step = () => { f++; const dt = performance.now() - t0; if (dt < ms) requestAnimationFrame(step); else res({ itersPerSec: +(f / (dt / 1000)).toFixed(1), iters: f, seconds: +(dt / 1000).toFixed(2) }); };
  requestAnimationFrame(step);
});

const q = new URLSearchParams(location.search);
const engine = q.get('engine') || 'cosmos';
const n = parseInt(q.get('n') || '100000', 10);

function report(d) { if ($('m-engine')) $('m-engine').textContent = engine; if ($('m-nodes')) $('m-nodes').textContent = d.n.toLocaleString(); if ($('m-edges')) $('m-edges').textContent = d.M.toLocaleString(); if ($('m-stage')) $('m-stage').textContent = 'ready'; }

async function run() {
  window.__bench = { ready: false, engine, n, error: null };
  try {
    const d = synth(n);
    window.__bench.n = d.n; window.__bench.edges = d.M;
    report(d);

    if (engine === 'fa2') {
      const g = new Graphology({ type: 'undirected' });
      for (let i = 0; i < d.n; i++) g.addNode(String(i), { x: d.positions[i * 2], y: d.positions[i * 2 + 1] });
      for (const [a, b] of d.edges) { if (a !== b) g.mergeEdge(String(a), String(b)); }
      const settings = forceAtlas2.inferSettings(g);
      window.__bench.measure = () => {
        const t0 = performance.now(); let iters = 0;
        while (performance.now() - t0 < 6000 && iters < 300) { forceAtlas2.assign(g, { iterations: 1, settings }); iters++; }
        const s = (performance.now() - t0) / 1000;
        return { itersPerSec: +(iters / s).toFixed(2), iters, seconds: +s.toFixed(2) };
      };
      window.__bench.ready = true;
    } else if (engine === 'cosmos') {
      // renderLinks:false so the measured frame rate reflects the GPU SIM step, not link overdraw
      // (the sim still uses the links for attraction — they're just not drawn). ?links=1 to draw them.
      const graph = new CosmosGraph($('graph'), {
        backgroundColor: '#0e1116', enableSimulation: true, spaceSize: 8192, fitViewOnInit: false, pixelRatio: 1,
        simulationFriction: 0.85, simulationRepulsion: 0.4, simulationLinkSpring: 0.5, renderLinks: q.get('links') === '1',
      });
      graph.setPointPositions(d.positions); graph.setLinks(d.links); graph.render(); graph.start();
      window.__bench.graph = graph;
      window.__bench.measure = async () => { await frameRate(1500); return frameRate(3000); }; // warm then measure
      window.__bench.ready = true;
    } else if (engine === 'helios') {
      const nodeDict = {}; for (let i = 0; i < d.n; i++) nodeDict[String(i)] = { Position: [d.positions[i * 2] * 300, d.positions[i * 2 + 1] * 300, 0] };
      const edges = d.edges.map(([a, b]) => ({ source: String(a), target: String(b) }));
      const helios = new Helios({ elementID: 'graph', nodes: nodeDict, edges, use2D: true, autoStartLayout: true });
      try { helios.backgroundColor([0.055, 0.066, 0.086, 1.0]); } catch (e) {}
      window.__bench.helios = helios;
      window.__bench.measure = async () => { await frameRate(1500); return frameRate(3000); };
      let announced = false; const rdy = () => { if (!announced) { announced = true; window.__bench.ready = true; } };
      try { helios.onReady(rdy); } catch (e) {}
      setTimeout(rdy, 10000);
    }
    if ($('m-stage')) $('m-stage').textContent = 'laying out — call measure()';
  } catch (e) {
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    window.__bench.error = String(e?.message || e);
  }
}
run();
