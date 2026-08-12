// deck.gl bench page — instanced WebGL rendering of the benchmark graph.
// Renders the PRECOMPUTED FA2 layout (deck.gl has no layout engine), so this is a
// pure render-throughput test (the same axis where Cosmos's link renderer fell over).
// Nodes → ScatterplotLayer, edges → LineLayer, both fed via binary attributes
// (Float32Array positions / Uint8Array colours) — deck.gl's high-performance path.
import { Deck, OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, LineLayer } from '@deck.gl/layers';
import { Metrics } from './metrics.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

// node type → RGB (shared legend across the bench pages)
const COLORS = { paper: [76, 120, 168], patent: [245, 133, 24], product: [84, 162, 75], trial: [228, 87, 86] };
const FALLBACK = [150, 150, 150];

const metrics = new Metrics();
const container = document.getElementById('graph');
const selector = document.getElementById('dataset');
let deck = null;
let canvas = null;

async function run(graph) {
  let camState = 'overview';
  installAdapter({ tool: 'deck', dataset: graph, primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (deck) { try { deck.finalize(); } catch (e) {} deck = null; }
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      container.appendChild(canvas);
    }

    metrics.stage(`fetching ${graph}.layout.json …`);
    const t0 = performance.now();
    const res = await fetch(`data/${graph}.layout.json`);
    if (!res.ok) throw new Error(`fetch ${graph}.layout.json → ${res.status}`);
    const json = await res.json();
    const tFetch = performance.now() - t0;

    metrics.stage('building binary attributes …');
    const t1 = performance.now();
    const nodes = json.nodes;
    const edges = json.edges; // flat int index pairs [s0,t0,s1,t1,…]
    const N = nodes.length, E = edges.length / 2;
    const pos = new Float32Array(N * 2);
    const col = new Uint8Array(N * 3);
    const rad = new Float32Array(N);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      const x = n.x, y = n.y;
      pos[2 * i] = x; pos[2 * i + 1] = y;
      const c = COLORS[n.t] || FALLBACK;
      col[3 * i] = c[0]; col[3 * i + 1] = c[1]; col[3 * i + 2] = c[2];
      rad[i] = Math.max(1.5, Math.sqrt(n.d || 1));
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    // edge endpoint positions resolved from node coords (binary → no per-edge accessor calls)
    const srcPos = new Float32Array(E * 2), tgtPos = new Float32Array(E * 2);
    for (let e = 0; e < E; e++) {
      const s = edges[2 * e], t = edges[2 * e + 1];
      srcPos[2 * e] = pos[2 * s]; srcPos[2 * e + 1] = pos[2 * s + 1];
      tgtPos[2 * e] = pos[2 * t]; tgtPos[2 * e + 1] = pos[2 * t + 1];
    }
    const tPrep = performance.now() - t1;

    metrics.stage('rendering …');
    const t2 = performance.now();
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const extent = Math.max(maxX - minX, maxY - minY) || 1;
    const W = container.clientWidth || 1440, H = container.clientHeight || 900;
    const fit = Math.log2(Math.min(W, H) / extent);
    const viewState = () => ({ target: [cx, cy, 0], zoom: fit });

    deck = new Deck({
      canvas,
      views: new OrthographicView(),
      controller: true,
      initialViewState: viewState(),
      layers: [
        new LineLayer({
          id: 'edges',
          data: { length: E, attributes: {
            getSourcePosition: { value: srcPos, size: 2 },
            getTargetPosition: { value: tgtPos, size: 2 },
          } },
          getColor: [120, 140, 170, 38], // faint, ~Sigma's 0.10–0.15 edge alpha
          getWidth: 1, widthUnits: 'pixels', widthMinPixels: 1,
        }),
        new ScatterplotLayer({
          id: 'nodes',
          data: { length: N, attributes: {
            getPosition: { value: pos, size: 2 },
            getFillColor: { value: col, size: 3 },
            getRadius: { value: rad, size: 1 },
          } },
          radiusUnits: 'pixels', radiusMinPixels: 1, radiusMaxPixels: 18,
        }),
      ],
    });
    const tInit = performance.now() - t2;

    const timings = { nodes: N, edges: E, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true, timings,
      settled: true, tSettle: 0, // layout precomputed offline (FA2) — render-only test
      pauseLayout: () => { window.__bench.paused = true; }, // no live sim to pause
      fitView: () => { try { deck.setProps({ initialViewState: viewState() }); } catch (e) {} },
      // API-driven camera motion (protocol-sensitivity check vs CDP input events);
      // z matches the cosmos protocol (0.5 = out, 1.6 = in) → zoom offset log2(z)
      cosmosZoom: (z, ms) => {
        try { deck.setProps({ initialViewState: { target: [cx, cy, 0], zoom: fit + Math.log2(z), transitionDuration: ms } }); } catch (e) {}
      },
      redraw: () => { try { deck.redraw('bench'); } catch (e) {} }, // force-repaint (continuous-render measurement)
      counts: () => ({ nodes: N, edges: E }),
      cameraState: () => camState,
      // overview = fit; mid/deep zoom in by fixed factors so the apiCamera driver and
      // the presentation gate produce visibly-different, deterministic camera states.
      setCamera: (s) => {
        try {
          const zoom = s === 'deep' ? fit + Math.log2(8) : s === 'mid' ? fit + Math.log2(3) : fit;
          deck.setProps({ initialViewState: { target: [cx, cy, 0], zoom, transitionDuration: 300 } });
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
const initial = params.get('g') || 'medical_device';
selector.value = initial;
selector.addEventListener('change', (e) => {
  const g = e.target.value;
  history.replaceState(null, '', `?g=${g}`);
  run(g);
});
run(initial);
