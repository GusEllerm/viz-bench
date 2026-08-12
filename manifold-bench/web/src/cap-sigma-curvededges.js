// Sigma.js CURVED-EDGES capability example — @sigma/edge-curve (EdgeCurveProgram) over a
// SYNTHETIC seeded graph (never real data). Mounts into #view (so the harness's #view screenshot +
// presentation gate work unchanged). Implements the bench-core contract; the plugin renders
// arced edges, a spatial change the presentation gate can verify.
import Sigma from 'sigma';
import EdgeCurveProgram from '@sigma/edge-curve';
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
      $('m-fps').textContent = `${f.toFixed(0)} / ${min === Infinity ? '—' : min.toFixed(0)}`; frames = 0; acc = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function run() {
  let camState = 'overview';
  installAdapter({ tool: 'sigma', feature: 'curved-edges', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const t0 = performance.now();
    const { graph: g, nodes, edges } = makeGraph();
    // curve every edge + give it ink so the curvature reads clearly in the screenshot
    g.forEachEdge((e) => { g.setEdgeAttribute(e, 'type', 'curved'); g.setEdgeAttribute(e, 'size', 2.2); g.setEdgeAttribute(e, 'color', 'rgba(150,170,210,0.6)'); });

    renderer = new Sigma(g, view, {
      defaultEdgeType: 'curved',
      edgeProgramClasses: { curved: EdgeCurveProgram },
      labelRenderedSizeThreshold: 999, // suppress labels — keep the curves legible
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
      // sigma camera ratio is inverted: smaller ratio = zoomed IN. overview = fit/reset.
      setCamera: (s) => {
        try {
          const cam = renderer.getCamera();
          if (s === 'overview') cam.animatedReset({ duration: 300 });
          else cam.animate({ ratio: s === 'deep' ? 0.2 : 0.45 }, { duration: 300 });
          camState = s;
        } catch (e) {}
      },
      // continuous camera oscillation (per-rAF setState, NOT camera.animate which stacks tweens)
      // → sigma redraws each frame so the fps probe measures render throughput under motion.
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
