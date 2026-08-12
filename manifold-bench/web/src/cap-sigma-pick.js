// Sigma.js PICK / HOVER-TOOLTIP capability example (NATIVE) — sigma enterNode/leaveNode events
// → window.__bench.lastPick + a #tooltip. Synthetic graph. The harness hovers hoverTarget()
// (a node's viewport position) and asserts the pick fired (interaction gate).
import Sigma from 'sigma';
import { makeGraph } from './randomgraph.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let renderer = null;

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
function showTip(html, x, y) { const t = $('tooltip'); if (!t) return; t.innerHTML = html; t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px'; t.style.display = 'block'; }
function hideTip() { const t = $('tooltip'); if (t) t.style.display = 'none'; }
const vp = (g, node) => renderer.graphToViewport({ x: g.getNodeAttribute(node, 'x'), y: g.getNodeAttribute(node, 'y') });

function run() {
  let camState = 'overview';
  installAdapter({ tool: 'sigma', feature: 'pick-tooltip', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const { graph: g, nodes, edges } = makeGraph();
    g.forEachEdge((e) => { g.setEdgeAttribute(e, 'color', 'rgba(120,140,170,0.32)'); });
    renderer = new Sigma(g, view, { labelRenderedSizeThreshold: 999, minCameraRatio: 0.05, maxCameraRatio: 2 });
    renderer.on('enterNode', ({ node }) => { window.__bench.lastPick = node; const p = vp(g, node); showTip(`<b>${node}</b> · deg ${g.degree(node)}`, p.x, p.y); });
    renderer.on('leaveNode', () => hideTip());

    if ($('m-nodes')) $('m-nodes').textContent = nodes; if ($('m-edges')) $('m-edges').textContent = edges;
    if ($('m-stage')) $('m-stage').textContent = 'rendered';
    startFPS();
    Object.assign(window.__bench, {
      ready: true, timings: { nodes, edges, points: nodes }, settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { renderer.getCamera().animatedReset({ duration: 0 }); } catch (e) {} },
      counts: () => ({ nodes: g.order, edges: g.size }),
      cameraState: () => camState,
      setCamera: (s) => {
        try { const cam = renderer.getCamera(); if (s === 'overview') cam.animatedReset({ duration: 300 }); else cam.animate({ ratio: s === 'deep' ? 0.2 : 0.45 }, { duration: 300 }); camState = s; } catch (e) {}
      },
      orbit: (ms) => {
        const cam = renderer.getCamera(); const base = cam.getState(); const t = performance.now();
        const step = () => { const dt = performance.now() - t; try { cam.setState({ ...base, ratio: 0.85 + 0.12 * Math.sin(dt / 380) }); } catch (e) {} if (dt < ms) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      },
      lastPick: null,
      // hover the largest node (biggest hit area → most reliable synthetic hover)
      hoverTarget: () => { let best = 'n0', bs = -1; g.forEachNode((nd, a) => { if (a.size > bs) { bs = a.size; best = nd; } }); const p = vp(g, best); return { x: p.x, y: p.y }; },
      clearPick: () => { window.__bench.lastPick = null; hideTip(); },
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed'; if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

run();
