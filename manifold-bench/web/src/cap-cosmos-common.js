// Shared cosmos.gl scaffold for the capability examples — a bare @cosmos.gl/graph engine
// (simulation OFF, precomputed synthetic positions) plus the full bench-core contract
// (counts / setCamera / orbit / fitView). Each example passes extra `config` (curvedLinks,
// hover callbacks …) and an `onGraph(graph, ctx)` hook for feature-specific wiring
// (pick tracking, label overlay). kind 'graph' → makeGraph (coverage nodes/edges); 'points'
// → makePoints scatter (coverage points). Mounts into #view. Public-safe: synthetic data only.
import { Graph } from '@cosmos.gl/graph';
import { makeGraph } from './randomgraph.js';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';

const $ = (id) => document.getElementById(id);
const hexRGBA = (h) => { const s = String(h).replace('#', ''); return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255, 1]; };

function startFPS() {
  let last = performance.now(), frames = 0, acc = 0, min = Infinity;
  const tick = (t) => {
    frames++; acc += t - last; last = t;
    if (acc >= 500) { const f = (frames * 1000) / acc; if (f < min) min = f;
      if ($('m-fps')) $('m-fps').textContent = `${f.toFixed(0)} / ${min === Infinity ? '—' : min.toFixed(0)}`; frames = 0; acc = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// build typed arrays for cosmos: positions [x,y,…], colors [r,g,b,a,…] (0–1), sizes; plus the
// node list + edge list (index pairs) for overlays / picking. Returns { counts, ... }.
function buildData(kind, n, nodeSize) {
  if (kind === 'points') {
    const { n: N, positions, colors } = makePoints({ n, seed: 8 });
    const pos = new Float32Array(N * 2), col = new Float32Array(N * 4), size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 2] = positions[i * 3]; pos[i * 2 + 1] = positions[i * 3 + 2];
      col[i * 4] = colors[i * 3] / 255; col[i * 4 + 1] = colors[i * 3 + 1] / 255; col[i * 4 + 2] = colors[i * 3 + 2] / 255; col[i * 4 + 3] = 1;
      size[i] = nodeSize;
    }
    return { pos, col, size, links: null, nodeList: null, N, counts: () => ({ points: N }) };
  }
  const { graph: g } = makeGraph();
  const idx = {}; const nodeList = []; let i = 0;
  g.forEachNode((nd, a) => { idx[nd] = i++; nodeList.push({ id: nd, label: a.label || nd, color: a.color }); });
  const N = nodeList.length;
  const pos = new Float32Array(N * 2), col = new Float32Array(N * 4), size = new Float32Array(N);
  i = 0;
  g.forEachNode((nd, a) => { pos[i * 2] = a.x; pos[i * 2 + 1] = a.y; const c = hexRGBA(a.color); col.set(c, i * 4); size[i] = nodeSize; i++; });
  const edgePairs = [];
  g.forEachEdge((e, ea, s, t) => { edgePairs.push(idx[s], idx[t]); });
  const links = Float32Array.from(edgePairs);
  const M = links.length / 2;
  return { pos, col, size, links, nodeList, N, M, counts: () => ({ nodes: N, edges: M }) };
}

export function mountCosmos({ feature, primitives, kind = 'graph', n = 54, nodeSize = 4, config = {}, onGraph, layout = false, settleMs = 2600 }) {
  let camState = 'overview';
  const cloud = kind === 'points' ? `synthetic_points_${n}` : `synthetic_graph_${n}`;
  installAdapter({ tool: 'cosmos', feature, cloud, primitives, supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const view = $('view');
    const t0 = performance.now();
    const d = buildData(kind, n, nodeSize);

    const graph = new Graph(view, {
      backgroundColor: '#0e1116',
      enableSimulation: layout, // sim ON only for the layout example (it computes the positions live)
      rescalePositions: true,
      fitViewOnInit: true,
      // Per-kind fit: the sparse graph examples get a tight fit (fill the 1440×900 frame); the
      // dense points scatter gets looser padding so the presentation-gate zoom registers a
      // >2% pixel change (a frame-filling uniform scatter looks self-similar under zoom).
      fitViewPadding: kind === 'points' ? 0.12 : 0.02,
      pixelRatio: window.devicePixelRatio || 1,
      renderLinks: !!d.links,
      ...(layout ? { simulationGravity: 0.9, simulationRepulsion: 0.35, simulationLinkSpring: 1.5, simulationFriction: 0.88, simulationDecay: 3000 } : {}),
      ...config,
    });
    // layout example: start from a seeded-random scatter so the GPU force sim visibly organises it
    // (makeGraph ships an already-clustered layout, which the sim would barely move).
    if (layout) {
      let s = 9; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      const rp = new Float32Array(d.N * 2);
      for (let i = 0; i < d.N; i++) { rp[i * 2] = rnd() * 400; rp[i * 2 + 1] = rnd() * 400; }
      graph.setPointPositions(rp);
    } else {
      graph.setPointPositions(d.pos);
    }
    graph.setPointColors(d.col);
    graph.setPointSizes(d.size);
    if (d.links) graph.setLinks(d.links);
    graph.render();
    const tInit = performance.now() - t0;

    const c = d.counts();
    if ($('m-nodes') && c.nodes != null) $('m-nodes').textContent = c.nodes;
    if ($('m-edges') && c.edges != null) $('m-edges').textContent = c.edges;
    if ($('m-points') && c.points != null) $('m-points').textContent = c.points;
    if ($('m-load')) $('m-load').textContent = `${tInit.toFixed(0)} ms`;
    if ($('m-stage')) $('m-stage').textContent = `rendered — ${tInit.toFixed(0)} ms`;
    startFPS();

    Object.assign(window.__bench, {
      ready: !layout, // layout: stay not-ready until the sim has settled (below)
      timings: { ...c, tInit },
      settled: true, tSettle: 0,
      graph,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { graph.setZoomLevel(window.__bench._fitZoom ?? 1, 0); } catch (e) {} },
      counts: d.counts,
      cameraState: () => camState,
      // IMMEDIATE zoom (duration 0) via setZoomLevel: with the simulation off cosmos runs no
      // render loop to advance a timed animation, so setZoomLevel(z, 300) / fitView(300) never
      // apply (the zoom stayed put → the presentation gate saw 0% change). Zoom 1 == the initial
      // fit, so setZoomLevel(fitZoom,0) is a reliable "overview" reset (fitView(0) does not reset
      // here). _fitZoom is captured on the first call (the harness's setCamera('overview')).
      setCamera: (s) => {
        try {
          if (window.__bench._fitZoom == null) window.__bench._fitZoom = graph.getZoomLevel();
          const f = window.__bench._fitZoom;
          graph.setZoomLevel(s === 'deep' ? f * 6 : s === 'mid' ? f * 2.6 : f, 0);
          camState = s;
        } catch (e) {}
      },
      orbit: (ms) => {
        const base = graph.getZoomLevel(); const t = performance.now();
        const step = () => { const dt = performance.now() - t; try { graph.setZoomLevel(base * (1 + 0.1 * Math.sin(dt / 380)), 0); } catch (e) {} if (dt < ms) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      },
    });

    if (onGraph) onGraph(graph, { ...d, view });

    // layout example: run the GPU sim, then freeze + re-fit + go ready so the harness gates and the
    // screenshot land on the settled layout (the sim's computed positions). The harness itself waits
    // ~4.5s more before shooting, so the freeze is comfortably settled.
    if (layout) {
      graph.start();
      setTimeout(() => {
        try { graph.pause(); if (typeof graph.fitView === 'function') graph.fitView(0); } catch (e) {}
        // keep-alive: with the sim paused cosmos stops its render loop, so the harness's programmatic
        // zoom (orbit) would never repaint → the presentation gate would see 0% change. Force a redraw.
        const keepAlive = () => { try { graph.render(); } catch (e) {} requestAnimationFrame(keepAlive); };
        requestAnimationFrame(keepAlive);
        if ($('m-stage')) $('m-stage').textContent = 'laid out (GPU sim)';
        window.__bench.settled = true;
        window.__bench.ready = true;
      }, settleMs);
    }
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed';
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}
