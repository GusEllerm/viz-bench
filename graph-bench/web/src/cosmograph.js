import { Cosmograph, prepareCosmographData } from '@cosmograph/cosmograph';

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
let cosmograph = null;

import { loadGraphTier, hexOfRGB } from './loadgraph.js';

async function run(graph) {
  // ?pre=1 → Cosmograph's embeddings mode: feed the PRECOMPUTED FA2 layout via
  // pointXBy/pointYBy with the simulation disabled. Render-only, apples-to-apples
  // with sigmapre/deck (same positions). Default mode: live GPU sim as before.
  const PRE = new URLSearchParams(location.search).get('pre') === '1';
  let camState = 'overview';
  installAdapter({ tool: PRE ? 'cosmographpre' : 'cosmograph', dataset: graph, settled: PRE, primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    let pts, lks, meta, tFetch;
    if (PRE) {
      metrics.stage(`fetching ${graph} …`);
      const d = await loadGraphTier(graph);
      tFetch = d.tFetch;
      pts = new Array(d.n);
      for (let i = 0; i < d.n; i++) {
        pts[i] = { id: d.idOf(i), label: d.labelOf(i), color: hexOfRGB(d.colRGB, i), size: Math.max(1.5, Math.sqrt(d.deg[i] || 1)), x: d.pos[2 * i], y: d.pos[2 * i + 1] };
      }
      lks = new Array(d.edges.length / 2);
      for (let k = 0; k < lks.length; k++) lks[k] = { source: d.idOf(d.edges[2 * k]), target: d.idOf(d.edges[2 * k + 1]) };
      meta = { nodes: d.n, edges: lks.length };
    } else {
      const file = `${graph}.json`;
      metrics.stage(`fetching ${file} …`);
      const t0 = performance.now();
      const res = await fetch(`data/${file}`);
      if (!res.ok) throw new Error(`fetch ${file} → ${res.status}`);
      const json = await res.json();
      pts = json.points; lks = json.links;
      meta = json.meta ? { nodes: json.meta.nodes, edges: json.meta.edges } : null;
      tFetch = performance.now() - t0;
    }

    metrics.stage('preparing data (duckdb-wasm) …');
    const t1 = performance.now();
    const dataConfig = {
      points: { pointIdBy: 'id', pointColorBy: 'color', pointSizeBy: 'size', pointLabelBy: 'label', ...(PRE ? { pointXBy: 'x', pointYBy: 'y' } : {}) },
      links: { linkSourceBy: 'source', linkTargetsBy: ['target'] },
    };
    const prepared = await prepareCosmographData(dataConfig, pts, lks);
    if (!prepared) throw new Error('prepareCosmographData returned null');
    const tPrep = performance.now() - t1;
    const { points, links, cosmographConfig } = prepared;

    metrics.stage('rendering …');
    const t2 = performance.now();
    const simStart = performance.now();
    const config = {
      points, links, ...cosmographConfig,
      backgroundColor: '#0e1116',
      fitViewOnInit: true,
      showFPSMonitor: false,
      ...(PRE ? { enableSimulation: false } : {
        simulationFriction: 0.85,
        simulationLinkSpring: 0.5,
        simulationRepulsion: 0.4,
      }),
      onSimulationEnd: () => {
        if (window.__bench && !window.__bench.settled) {
          window.__bench.settled = true;
          window.__bench.tSettle = performance.now() - simStart;
          metrics.stage(`layout settled (${(window.__bench.tSettle / 1000).toFixed(1)} s)`);
        }
      },
    };
    // optional render tuning via URL params (used by the benchmark sweep)
    const q = new URLSearchParams(location.search);
    const tuning = {};
    if (q.get('links') === '0') tuning.renderLinks = false;
    if (q.has('dpr')) tuning.pixelRatio = parseFloat(q.get('dpr'));
    if (q.has('psize')) tuning.pointSizeScale = parseFloat(q.get('psize'));
    if (q.get('curved') === '0') tuning.curvedLinks = false;
    if (q.has('lwidth')) tuning.linkWidthScale = parseFloat(q.get('lwidth'));
    if (q.get('labels') === '0') {
      Object.assign(tuning, {
        showDynamicLabels: false, showTopLabels: false, showLabels: false,
        showHoveredPointLabel: false, showFocusedPointLabel: false,
      });
    }
    Object.assign(config, tuning);
    window.__bench.tuning = tuning;

    if (cosmograph) cosmograph.setConfig(config);
    else cosmograph = new Cosmograph(container, config);
    const tInit = performance.now() - t2;

    const timings = { nodes: meta.nodes, edges: meta.edges, tFetch, tPrep, tInit };
    metrics.report(timings);
    metrics.startFPS();
    Object.assign(window.__bench, {
      ready: true,
      timings,
      pauseLayout: () => { try { cosmograph.pause(); window.__bench.paused = true; } catch (e) {} },
      fitView: () => { try { cosmograph.fitView(0); } catch (e) {} },
      // diagnostic hooks (Nikita follow-up): poke the underlying cosmos.gl engine.
      // NOTE: the engine lives at `_cosmos` (no public getter) and is assigned
      // asynchronously AFTER ready — callers must tolerate a null until then.
      cg: cosmograph,
      cosmosZoom: (z, ms) => { try { cosmograph._cosmos.setZoomLevel(z, ms); } catch (e) {} },
      // Continuous-render hook = an imperceptible zoom nudge (same mechanism as Sigma — parity):
      // _cosmos.render() is the data-ingest path (full update per call), not a repaint.
      redraw: (() => { let n = 0, base = null; return () => { try { if (base == null) base = cosmograph.getZoomLevel(); cosmograph.setZoomLevel(base * (1 + 1e-6 * (++n % 2 ? 1 : -1)), 0); } catch (e) {} }; })(),
      linkHoverEnabled: () => { try { return !!cosmograph._cosmos.store.isLinkHoveringEnabled; } catch (e) { return String(e); } },
      // the wrapper hardwires onLink* callbacks into cosmos, which force-enables
      // link-hover picking (a second full link draw + readPixels per hover check);
      // there is no config flag, so flip the store directly
      disableLinkHover: () => { try { cosmograph._cosmos.store.updateLinkHoveringEnabled({}); return !cosmograph._cosmos.store.isLinkHoveringEnabled; } catch (e) { return String(e); } },
      // kill ALL hover detection (point picking incl. its readPixels) for A/B isolation
      disablePicking: () => { try { cosmograph._cosmos.findHoveredItem = () => {}; return true; } catch (e) { return String(e); } },
      counts: () => ({ nodes: meta.nodes, edges: meta.edges }),
      cameraState: () => camState,
      // overview = fitView; mid/deep zoom in off the captured fit zoom via the engine.
      setCamera: (s) => {
        try {
          if (s === 'overview') { cosmograph.fitView(300); }
          else {
            // 2.5+ exposes zoom on the wrapper; 2.3 kept it on the internal _cosmos engine
            const getZoom = () => (typeof cosmograph.getZoomLevel === 'function' ? cosmograph.getZoomLevel() : cosmograph._cosmos.getZoomLevel());
            const setZoom = (z, ms) => (typeof cosmograph.setZoomLevel === 'function' ? cosmograph.setZoomLevel(z, ms) : cosmograph._cosmos.setZoomLevel(z, ms));
            if (window.__bench._fitZoom == null) window.__bench._fitZoom = getZoom();
            setZoom(window.__bench._fitZoom * (s === 'deep' ? 8 : 3), 300);
          }
          camState = s;
        } catch (e) {}
      },
    });

    // ?lod=1 → zoom-dependent link visibility (the recommended pattern for dense
    // overviews): the zoomed-out fit-all state is link-overdraw-bound (~6 fps at
    // 1.1M edges, any pixel ratio), so hide links there and reveal them once the
    // user zooms past ~2x the fit zoom. cosmos reads config.renderLinks live each
    // frame, so the flip costs nothing.
    // ?noblend=1 → opaque links (no alpha blending): not exposed by cosmos config;
    // ~5x at dense overviews (41 vs 7.6 fps headed @1.1M), loses density shading
    if (new URLSearchParams(location.search).get('noblend') === '1') {
      const applyNoBlend = setInterval(() => {
        try {
          const cosmos = cosmograph._cosmos;
          if (cosmos && cosmos.lines && cosmos.lines.drawCurveCommand) {
            cosmos.lines.drawCurveCommand.setParameters({ blend: false });
            clearInterval(applyNoBlend);
            metrics.stage('link blending disabled (opaque links)');
          }
        } catch (e) {}
      }, 300);
    }

    if (new URLSearchParams(location.search).get('lod') === '1') {
      const applyLod = () => {
        const cosmos = cosmograph._cosmos;
        if (!cosmos) return; // engine attaches async; keep polling
        if (window.__bench.lodFitZoom === undefined) {
          window.__bench.lodFitZoom = cosmos.getZoomLevel(); // captured post-fitViewOnInit
        }
        const show = cosmos.getZoomLevel() >= window.__bench.lodFitZoom * 2;
        if (cosmos.config.renderLinks !== show) {
          cosmos.config.renderLinks = show;
          metrics.stage(show ? 'links visible (zoomed in)' : 'links hidden at overview — zoom in to reveal');
        }
      };
      setTimeout(() => { applyLod(); setInterval(applyLod, 250); }, 1500);
    }
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
  q.set('g', g); // keep mode params (pre, labels, …) across dataset switches
  history.replaceState(null, '', `?${q}`);
  run(g);
});
run(initial);
