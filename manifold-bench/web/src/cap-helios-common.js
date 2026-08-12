// Shared Helios-Web scaffold for the capability examples — a Helios instance (use2D, layout off,
// precomputed synthetic positions) plus the bench-core contract (counts / setCamera / orbit /
// fitView). Each example passes `configure(helios)` (enable labels, set hover callbacks) and an
// `onReady(helios, ctx)` hook. kind 'graph' → makeGraph (coverage nodes/edges); 'points' →
// makePoints scatter (coverage points). Mounts into #view. Reference: graph-bench/web/src/helios.js.
import { Helios } from 'helios-web';
import { makeGraph } from './randomgraph.js';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';

const $ = (id) => document.getElementById(id);
const hexRGB = (h) => { const s = String(h).replace('#', ''); return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255]; };

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

// nodeDict { id: { label, Position:[x,y,0], Color:[r,g,b], Size } } + edges [{source,target}],
// positions scaled to ~±300 (Helios's native coordinate scale). Returns { counts, N, ... }.
function buildData(kind, n, nodeSize, pointsChain) {
  const scaleTo = 300;
  if (kind === 'points') {
    const { n: N, positions, colors } = makePoints({ n, seed: 8 });
    // use (x, z) plane; find extent to normalise
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < N; i++) { for (const v of [positions[i * 3], positions[i * 3 + 2]]) { if (v < mn) mn = v; if (v > mx) mx = v; } }
    const k = (2 * scaleTo) / ((mx - mn) || 1);
    // NUMERIC-STRING node IDs ("0".."N-1"): Helios's density pass indexes its node DICT
    // numerically (network.nodes[i]), so IDs must coerce from the numeric index — a "p3" key
    // would make network.nodes[3] undefined and crash _setupDensity. Numeric IDs resolve.
    const nodeDict = {};
    for (let i = 0; i < N; i++) nodeDict[String(i)] = { Position: [positions[i * 3] * k, positions[i * 3 + 2] * k, 0], Color: [colors[i * 3] / 255, colors[i * 3 + 1] / 255, colors[i * 3 + 2] / 255], Size: nodeSize };
    // pointsChain: a light i→i+1 edge chain so every node has a non-empty `.edges` — required by
    // Helios's density plot (_setupDensity weights by node degree, reading node.edges.length, which
    // throws / blanks for an edgeless cloud). Coverage still counts points, not edges.
    const edges = [];
    if (pointsChain) for (let i = 0; i < N - 1; i++) edges.push({ source: String(i), target: String(i + 1) });
    return { nodeDict, edges, N, counts: () => ({ points: N }) };
  }
  const { graph: g } = makeGraph();
  let mn = Infinity, mx = -Infinity;
  g.forEachNode((nd, a) => { for (const v of [a.x, a.y]) { if (v < mn) mn = v; if (v > mx) mx = v; } });
  const k = (2 * scaleTo) / ((mx - mn) || 1);
  const nodeDict = {};
  g.forEachNode((nd, a) => { nodeDict[nd] = { label: a.label || nd, Position: [a.x * k, a.y * k, 0], Color: hexRGB(a.color), Size: nodeSize }; });
  const edges = [];
  g.forEachEdge((e, ea, s, t) => { edges.push({ source: s, target: t }); });
  return { nodeDict, edges, N: g.order, M: g.size, counts: () => ({ nodes: g.order, edges: g.size }) };
}

export function mountHelios({ feature, primitives, kind = 'graph', n = 54, nodeSize = 4, pointsChain = false, heliosOpts = {}, configure, onReady, layout = false, settleMs = 3000, scatterStart = true }) {
  let camState = 'overview';
  installAdapter({ tool: 'helios', feature, primitives, supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const d = buildData(kind, n, nodeSize, pointsChain);
    // layout example: optionally scatter to a seeded-random start so autoStartLayout visibly organises
    // it (makeGraph ships an already-clustered layout). Helios contracts hard from a wide scatter, so
    // its example keeps the clustered start and lets the force pass refine it (scatterStart:false).
    if (layout && kind === 'graph' && scatterStart) {
      let s = 5; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      for (const id in d.nodeDict) d.nodeDict[id].Position = [(rnd() - 0.5) * 520, (rnd() - 0.5) * 520, 0];
    }
    const helios = new Helios({ elementID: 'view', nodes: d.nodeDict, edges: d.edges, use2D: true, autoStartLayout: layout, ...heliosOpts });
    try { helios.backgroundColor([0.055, 0.066, 0.086, 1.0]); } catch (e) {}
    if (configure) configure(helios, d);

    let announced = false;
    const announce = () => {
      if (announced) return; announced = true;
      try { helios.pauseLayout(); } catch (e) {}
      const baseZoom = (() => { try { const z = helios.zoomFactor(); return typeof z === 'number' && isFinite(z) && z > 0 ? z : 1; } catch (e) { return 1; } })();
      const c = d.counts();
      if ($('m-nodes') && c.nodes != null) $('m-nodes').textContent = c.nodes;
      if ($('m-edges') && c.edges != null) $('m-edges').textContent = c.edges;
      if ($('m-points') && c.points != null) $('m-points').textContent = c.points;
      if ($('m-stage')) $('m-stage').textContent = 'rendered';
      startFPS();
      Object.assign(window.__bench, {
        ready: true, timings: { ...c }, settled: true, tSettle: 0, helios, baseZoom,
        pauseLayout: () => { try { helios.pauseLayout(); } catch (e) {} window.__bench.paused = true; },
        fitView: () => { try { helios.zoomFactor(baseZoom, 0); } catch (e) {} },
        counts: d.counts,
        cameraState: () => camState,
        setCamera: (s) => { try { helios.zoomFactor(baseZoom * (s === 'deep' ? 4 : s === 'mid' ? 2 : 1), 300); camState = s; } catch (e) {} },
        orbit: (ms) => { const t = performance.now(); const step = () => { const dt = performance.now() - t; try { helios.zoomFactor(baseZoom * (1 + 0.12 * Math.sin(dt / 380)), 0); } catch (e) {} if (dt < ms) requestAnimationFrame(step); }; requestAnimationFrame(step); },
      });
      // Keep-alive render loop: helios draws on interaction and goes static once settled (its
      // internal loop stops after pauseLayout). The capability harness drives the camera
      // PROGRAMMATICALLY (setCamera/orbit, no pointer events), so without a forced per-frame
      // redraw the zoom never repaints and the presentation gate sees 0% change. (In the graph
      // bench, coalescedPan's real pointer motion kept it live — here nothing does.)
      const keepAlive = () => { try { helios.render ? helios.render() : helios.update && helios.update(); } catch (e) {} requestAnimationFrame(keepAlive); };
      requestAnimationFrame(keepAlive);

      if (onReady) onReady(helios, { ...d, baseZoom });
    };
    // layout: let autoStartLayout run for settleMs before announce() freezes it + goes ready, so the
    // gates + screenshot land on the settled layout. Static examples announce as soon as helios is ready.
    helios.onReady(() => { if (layout) setTimeout(announce, settleMs); else announce(); });
    setTimeout(() => { if (!announced) announce(); }, 12000); // safety net
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed';
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}
