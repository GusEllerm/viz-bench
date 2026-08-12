// cosmos.gl 3D RENDERING capability example — via the author's experimental 3D fork
// @cosmograph/cosmos (mainline @cosmos.gl/graph is a 2D engine). spaceDimensions: 3 gives a
// perspective orbit camera; sphere-shaded, depth-faded points show the 3D mode. Simulation
// off, the shared synthetic clusters ingested as xyz. Camera is page-owned (bbox-framed),
// matching the 3D benchmark page. Public-safe: synthetic data only.
import { Graph } from '@cosmograph/cosmos';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const $ = (id) => document.getElementById(id);
const N = 3000;

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

async function run() {
  let camState = 'overview';
  installAdapter({ tool: 'cosmos', feature: '3d', cloud: `synthetic_points_${N}`, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const t0 = performance.now();
    const { n, positions, colors, center, radius } = makePoints({ n: N, seed: 11 });
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = colors[i * 3] / 255; rgba[i * 4 + 1] = colors[i * 3 + 1] / 255;
      rgba[i * 4 + 2] = colors[i * 3 + 2] / 255; rgba[i * 4 + 3] = 1;
    }

    const graph = new Graph($('view'), {
      backgroundColor: '#0e1116',
      spaceDimensions: 3,          // the fork's 3D mode: perspective orbit camera + 3D sim space
      enableSimulation: false,     // static positions — this example shows 3D rendering, not layout
      rescalePositions: false,     // raw xyz; camera framed from the known bbox below
      fitViewOnInit: false,
      pointDefaultSize: 9,
      pointSphereShading: true,    // the fork's lit-sphere 3D shading (off by default — shown here)
    });
    graph.setPointPositions(positions, { dimensions: 3 });
    graph.setPointColors(rgba);
    graph.render();
    await graph.ready;
    const tInit = performance.now() - t0;

    if ($('m-points')) $('m-points').textContent = n.toLocaleString();
    if ($('m-load')) $('m-load').textContent = `${tInit.toFixed(0)} ms`;
    if ($('m-stage')) $('m-stage').textContent = 'rendered (3D orbit camera)';
    startFPS();

    const cam = { target: [center[0], center[1], center[2]], distance: radius * 3.2, azimuth: 0.6, polar: 1.15 };
    const apply = () => graph.setCameraState({ ...cam }, 0);
    apply();
    Object.assign(window.__bench, {
      ready: true,
      timings: { points: n, tInit },
      settled: true, tSettle: 0,
      graph,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { cam.distance = radius * 3.2; apply(); },
      counts: () => ({ points: n }),
      cameraState: () => camState,
      setCamera: (s) => {
        try {
          const k = s === 'deep' ? 0.23 : s === 'mid' ? 0.5 : 1;
          cam.distance = radius * 3.2 * k;
          apply();
          camState = s;
        } catch (e) {}
      },
      // on-demand renderer with the sim off: each setCameraState drives a redraw, so the
      // orbit repaints every frame for ms.
      orbit: (ms) => {
        const t = performance.now();
        const step = () => {
          try { cam.azimuth += 0.02; apply(); } catch (e) {}
          if (performance.now() - t < ms) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed';
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}
run();
