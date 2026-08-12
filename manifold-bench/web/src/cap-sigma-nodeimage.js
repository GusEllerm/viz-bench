// Sigma.js NODE-IMAGES capability example — @sigma/node-image (NodeImageProgram) over a
// SYNTHETIC seeded graph. Node icons are PROCEDURALLY GENERATED canvas data-URIs (coloured
// discs + a glyph) — never real avatars (copyright + provenance). Mounts into #view; implements
// the bench-core contract. The rendered icons are a spatial change the presentation gate verifies.
import Sigma from 'sigma';
import { NodeImageProgram } from '@sigma/node-image';
import { makeGraph } from './randomgraph.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let renderer = null;

// a procedural icon: coloured disc + white ring + a glyph. Returns a PNG data-URI.
function icon(bg, glyph) {
  const s = 64;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, s / 2, s / 2 + 2);
  return c.toDataURL('image/png');
}
const COLORS = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2'];
const GLYPHS = ['◆', '●', '▲', '★', '■', '✚'];
const ICONS = COLORS.map((col, i) => icon(col, GLYPHS[i]));

function startFPS() {
  let last = performance.now(), frames = 0, acc = 0, min = Infinity;
  const tick = (t) => {
    frames++; acc += t - last; last = t;
    if (acc >= 500) { const f = (frames * 1000) / acc; if (f < min) min = f;
      $('m-fps').textContent = `${f.toFixed(0)} / ${min === Infinity ? '—' : min.toFixed(0)}`; frames = 0; acc = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function run() {
  let camState = 'overview';
  installAdapter({ tool: 'sigma', feature: 'node-images', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const t0 = performance.now();
    const { graph: g, nodes, edges } = makeGraph();
    // every node → an image; edges muted so the icons read
    g.forEachNode((node) => {
      const i = +node.slice(1);
      g.setNodeAttribute(node, 'type', 'image');
      g.setNodeAttribute(node, 'image', ICONS[i % ICONS.length]);
      g.setNodeAttribute(node, 'size', 15);
    });
    g.forEachEdge((e) => { g.setEdgeAttribute(e, 'color', 'rgba(120,140,170,0.28)'); });

    renderer = new Sigma(g, view, {
      nodeProgramClasses: { image: NodeImageProgram },
      defaultNodeType: 'image',
      labelRenderedSizeThreshold: 999,
      minCameraRatio: 0.05,
      maxCameraRatio: 2,
    });
    const tInit = performance.now() - t0;

    $('m-nodes').textContent = nodes; $('m-edges').textContent = edges;
    $('m-load').textContent = `${tInit.toFixed(0)} ms`; $('m-stage').textContent = `rendered — ${tInit.toFixed(0)} ms`;
    startFPS();

    Object.assign(window.__bench, {
      ready: true,
      timings: { nodes, edges, points: nodes, tInit },
      settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { renderer.getCamera().animatedReset({ duration: 0 }); } catch (e) {} },
      counts: () => ({ nodes: g.order, edges: g.size }),
      cameraState: () => camState,
      setCamera: (s) => {
        try {
          const cam = renderer.getCamera();
          if (s === 'overview') cam.animatedReset({ duration: 300 });
          else cam.animate({ ratio: s === 'deep' ? 0.2 : 0.45 }, { duration: 300 });
          camState = s;
        } catch (e) {}
      },
      orbit: (ms) => {
        const cam = renderer.getCamera();
        const base = cam.getState();
        const t = performance.now();
        const step = () => {
          const dt = performance.now() - t;
          try { cam.setState({ ...base, ratio: 0.85 + 0.12 * Math.sin(dt / 380), angle: (base.angle || 0) + dt / 4000 }); } catch (e) {}
          if (dt < ms) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
    });
  } catch (e) {
    $('m-stage').textContent = 'failed'; $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

run();
