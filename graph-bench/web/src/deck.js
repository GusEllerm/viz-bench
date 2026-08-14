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
import { loadGraphTier } from './loadgraph.js';

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

    metrics.stage(`fetching ${graph} …`);
    const d = await loadGraphTier(graph);
    const tFetch = d.tFetch;

    metrics.stage('building binary attributes …');
    const t1 = performance.now();
    const edges = d.edges; // flat int index pairs [s0,t0,s1,t1,…]
    const N = d.n, E = edges.length / 2;
    const pos = d.pos;
    const col = d.colRGB;
    const rad = new Float32Array(N);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      const x = pos[2 * i], y = pos[2 * i + 1];
      rad[i] = Math.max(1.5, Math.sqrt(d.deg[i] || 1));
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
      // Context MSAA OFF — parity: Sigma hardcodes antialias:false and cannot enable it; the A/B
      // showed multisample resolve dominates the continuous metric (26→120 fps at 615K edges).
      deviceProps: { webgl: { antialias: false } },
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
const initial = params.get('g') || 'arxiv_2015';
selector.value = initial;
selector.addEventListener('change', (e) => {
  const g = e.target.value;
  history.replaceState(null, '', `?g=${g}`);
  run(g);
});
run(initial);
