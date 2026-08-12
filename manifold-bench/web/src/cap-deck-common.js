// Shared deck.gl scaffold for the capability examples — a Deck instance in an OrthographicView
// over the SYNTHETIC data (makeGraph for graph features, makePoints for the scatter), plus the
// full bench-core contract (counts / setCamera / orbit / fitView). Each example supplies
// makeLayers({ nodes, edges, L, radius }) returning the deck layers for its feature. `L` is the
// deck layer namespace (Scatterplot/Line/Text/Icon/Arc/Path). Mounts into #view; no real data.
import { Deck, OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer, LineLayer, TextLayer, IconLayer, ArcLayer, PathLayer } from '@deck.gl/layers';
import { makeGraph } from './randomgraph.js';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';

const $ = (id) => document.getElementById(id);
const L = { ScatterplotLayer, LineLayer, TextLayer, IconLayer, ArcLayer, PathLayer };
const hexRGB = (h) => { const s = String(h).replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; };

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

// kind 'graph' → makeGraph nodes+edges (coverage nodes/edges); 'points' → makePoints scatter
// (coverage points). Returns { nodes:[{id,position,color,size,label}], edges:[{source,target}], counts }.
function buildData(kind, n) {
  if (kind === 'points') {
    const { n: N, positions, colors } = makePoints({ n, seed: 8 });
    const nodes = [];
    for (let i = 0; i < N; i++) nodes.push({ id: `p${i}`, position: [positions[i * 3], positions[i * 3 + 2]], color: [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]] });
    return { nodes, edges: [], counts: () => ({ points: N }) };
  }
  const { graph: g } = makeGraph();
  const idx = {}; const nodes = []; let i = 0;
  g.forEachNode((nd, a) => { idx[nd] = i++; nodes.push({ id: nd, position: [a.x, a.y], color: hexRGB(a.color), size: a.size, label: nd }); });
  const edges = [];
  g.forEachEdge((e, ea, s, t) => { edges.push({ source: nodes[idx[s]].position, target: nodes[idx[t]].position }); });
  return { nodes, edges, counts: () => ({ nodes: g.order, edges: g.size }) };
}

export function mountDeck({ feature, primitives, kind = 'graph', n = 54, makeLayers }) {
  let camState = 'overview';
  const cloud = kind === 'points' ? `synthetic_points_${n}` : `synthetic_graph_${n}`;
  installAdapter({ tool: 'deck', feature, cloud, primitives, supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const view = $('view');
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas);

    const t0 = performance.now();
    const { nodes, edges, counts } = buildData(kind, n);
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const nd of nodes) { const [x, y] = nd.position; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
    const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    const radius = Math.max(mxx - mnx, mxy - mny) / 2 || 1;
    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const zoom = Math.log2(Math.min(W, H) / (radius * 2.4));

    let deck = null;
    const setView = (z, td = 0) => deck.setProps({ initialViewState: { target: [cx, cy, 0], zoom: z, transitionDuration: td } });
    deck = new Deck({
      canvas, views: new OrthographicView(), controller: true,
      initialViewState: { target: [cx, cy, 0], zoom },
      layers: makeLayers({ nodes, edges, L, radius }),
    });
    const tInit = performance.now() - t0;

    const c = counts();
    if ($('m-nodes') && c.nodes != null) $('m-nodes').textContent = c.nodes;
    if ($('m-edges') && c.edges != null) $('m-edges').textContent = c.edges;
    if ($('m-points') && c.points != null) $('m-points').textContent = c.points;
    if ($('m-load')) $('m-load').textContent = `${tInit.toFixed(0)} ms`;
    if ($('m-stage')) $('m-stage').textContent = `rendered — ${tInit.toFixed(0)} ms`;
    startFPS();

    Object.assign(window.__bench, {
      ready: true,
      timings: { ...c, tInit },
      settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { setView(zoom); } catch (e) {} },
      counts,
      cameraState: () => camState,
      setCamera: (s) => { try { setView(s === 'deep' ? zoom + 2.6 : s === 'mid' ? zoom + 1.4 : zoom, 300); camState = s; } catch (e) {} },
      orbit: (ms) => { const t = performance.now(); const step = () => { const dt = performance.now() - t; try { setView(zoom + 0.8 * Math.sin(dt / 380)); } catch (e) {} if (dt < ms) requestAnimationFrame(step); }; requestAnimationFrame(step); },
      deck, nodes, edges,
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed';
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

// procedural icon (coloured disc + white ring + glyph) → PNG data-URI. Synthetic, never a real
// avatar. Shared by the deck node-image example.
export function makeIcons() {
  const COLORS = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2'];
  const GLYPHS = ['◆', '●', '▲', '★', '■', '✚'];
  return COLORS.map((bg, i) => {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(GLYPHS[i], s / 2, s / 2 + 2);
    return cv.toDataURL('image/png');
  });
}
