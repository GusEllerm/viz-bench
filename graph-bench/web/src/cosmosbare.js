// Bare @cosmos.gl/graph (no Cosmograph wrapper): renders the PRECOMPUTED FA2
// layout with the simulation disabled and NO event callbacks — so link-hover
// picking, labels, and duckdb are all out of the picture. This is the cleanest
// "what can the cosmos engine itself render" datapoint, directly comparable to
// sigmapre/deck (same precomputed layout, render throughput only).
import { Graph } from '@cosmos.gl/graph';

// MSAA context shim (parity): the cosmos engine exposes no antialias config and
// hardcodes its context request, so pre-force antialias:false at getContext level (the first
// attribute set wins for a canvas). Same page-level-poke precedent as the noblend blend toggle.
{ // always on — parity with Sigma/deck/Helios, which all bench antialias-off
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (String(type).startsWith('webgl')) attrs = { ...(attrs || {}), antialias: false };
    return origGetContext.call(this, type, attrs);
  };
}
import { Metrics } from './metrics.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const metrics = new Metrics();
const container = document.getElementById('graph');
const selector = document.getElementById('dataset');

import { rgba01Of } from './typecolors.js';

let graph = null;

async function run(ds) {
  let camState = 'overview';
  installAdapter({ tool: 'cosmosbare', dataset: ds, settled: true, primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    metrics.stage(`fetching ${ds}.layout.json …`);
    const t0 = performance.now();
    const res = await fetch(`data/${ds}.layout.json`);
    if (!res.ok) throw new Error(`fetch ${ds}.layout.json → ${res.status}`);
    const json = await res.json();
    const tFetch = performance.now() - t0;

    metrics.stage('building typed arrays …');
    const t1 = performance.now();
    const nodes = json.nodes;
    const n = nodes.length;
    const pos = new Float32Array(n * 2);
    const col = new Float32Array(n * 4);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      pos[i * 2] = nd.x;
      pos[i * 2 + 1] = nd.y;
      col.set(rgba01Of(nd.t), i * 4);
      size[i] = Math.max(2, Math.sqrt(nd.d || 1) * 1.2);
    }
    const links = Float32Array.from(json.edges);
    const tPrep = performance.now() - t1;

    metrics.stage('rendering …');
    const t2 = performance.now();
    const q = new URLSearchParams(location.search);
    // ?sim=1 → ignore the precomputed layout: random init + live GPU sim, exactly
    // like the wrapper page's situation (tests the "unconverged hairball" theory)
    const live = q.get('sim') === '1';
    if (live) {
      for (let i = 0; i < n * 2; i++) pos[i] = Math.random() * 4096;
    }
    if (!graph) {
      graph = new Graph(container, {
        backgroundColor: '#0e1116',
        enableSimulation: live,
        rescalePositions: true,
        fitViewOnInit: true,
        pixelRatio: q.has('dpr') ? parseFloat(q.get('dpr')) : (window.devicePixelRatio || 1),
        renderLinks: q.get('links') !== '0',
        // cosmos.gl 3.x exposes linkBlending as a first-class config (default true). ?noblend=1
        // → opaque links (no alpha blending): drops the dense-overview overdraw serialisation
        // at the cost of density shading. (2.x hardcoded blend on; this used to be an internal poke.)
        linkBlending: q.get('noblend') !== '1',
        // wrapper-parity sim params (only matter when ?sim=1)
        simulationFriction: 0.85, simulationLinkSpring: 0.5, simulationRepulsion: 0.4,
        // no event callbacks on purpose: with none set, cosmos disables link hovering
      });
    }
    graph.setPointPositions(pos);
    graph.setPointColors(col);
    graph.setPointSizes(size);
    graph.setLinks(links);
    graph.render();
    if (live) graph.start();
    const tInit = performance.now() - t2;

    const timings = { nodes: n, edges: links.length / 2, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true,
      timings,
      graph,
      paused: !live,
      pauseLayout: () => { try { if (live) { graph.pause(); window.__bench.paused = true; } } catch (e) {} },
      fitView: () => { try { graph.fitView(0); } catch (e) {} },
      cosmosZoom: (z, ms) => { try { graph.setZoomLevel(z, ms); } catch (e) {} },
      // Continuous-render hook = an imperceptible zoom nudge, the SAME mechanism Sigma uses
      // (parity): graph.render() is cosmos's data-ingest path (full update + transition +
      // scheduler work per call), not a repaint — it dominated the continuous metric. A camera
      // delta triggers a plain re-draw of the fixed scene, which is what the metric measures.
      redraw: (() => { let n = 0, base = null; return () => { try { if (base == null) base = graph.getZoomLevel(); graph.setZoomLevel(base * (1 + 1e-6 * (++n % 2 ? 1 : -1)), 0); } catch (e) {} }; })(),
      counts: () => ({ nodes: n, edges: links.length / 2 }),
      cameraState: () => camState,
      // overview = fitView; mid/deep zoom in by fixed factors off the captured fit zoom.
      setCamera: (s) => {
        try {
          if (s === 'overview') { graph.fitView(300); }
          else {
            if (window.__bench._fitZoom == null) window.__bench._fitZoom = graph.getZoomLevel();
            graph.setZoomLevel(window.__bench._fitZoom * (s === 'deep' ? 8 : 3), 300);
          }
          camState = s;
        } catch (e) {}
      },
      linkHoverEnabled: () => { try { return !!graph.store.isLinkHoveringEnabled; } catch (e) { return String(e); } },
      disablePicking: () => { try { graph.findHoveredItem = () => {}; return true; } catch (e) { return String(e); } },
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
  const q = new URLSearchParams(location.search);
  q.set('g', g); // keep mode params (sim, dpr, links) across dataset switches
  history.replaceState(null, '', `?${q}`);
  run(g);
});
run(initial);
