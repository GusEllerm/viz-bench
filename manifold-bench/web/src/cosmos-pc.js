// @cosmograph/cosmos (the experimental 3D fork of cosmos.gl) point-cloud bench — the same
// binary clouds and __bench contract as deck/three. Simulation OFF (precomputed positions:
// render throughput only, apples-to-apples with the other rows); spaceDimensions:3 puts the
// engine's perspective orbit camera in charge. Rendering is the fork's shipped 3D defaults
// (depth fade on, sphere shading off); pointDefaultSize lowered to match the ~1.5px points
// of the deck/three rows. cosmos is an on-demand renderer with the sim off, so orbit()
// drives one setCameraState per rAF — every probed frame is a real redraw under motion.
import { Graph } from '@cosmograph/cosmos';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './loadcloud.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);

const fmt = (ms) => (ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`);
const stage = (t) => { $('m-stage').textContent = t; };
function report(name, n, tFetch, tInit) {
  $('m-cloud').textContent = name; $('m-points').textContent = n.toLocaleString();
  $('m-load').textContent = fmt(tFetch + tInit); stage(`loaded — ${fmt(tFetch + tInit)}`);
}
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

async function run(base) {
  let camState = 'overview';
  installAdapter({ tool: 'cosmos3d', cloud: base, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    stage('loading manifest…');
    const t0 = performance.now();
    const man = await loadManifest();
    const entry = pickCloud(man, base);
    const { n, positions, colors, center, radius, name } = await loadCloud(entry);
    const tFetch = performance.now() - t0;

    stage('building buffers…');
    const t1 = performance.now();
    // cosmos wants Float32 RGBA 0–1; the clouds ship Uint8 RGB
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      rgba[i * 4] = colors[i * 3] / 255; rgba[i * 4 + 1] = colors[i * 3 + 1] / 255;
      rgba[i * 4 + 2] = colors[i * 3 + 2] / 255; rgba[i * 4 + 3] = 1;
    }

    // Camera framing is derived from the manifest bbox (center/radius), NOT from the engine:
    // the fork's position readback fills a plain JS array, which V8 caps at 2^27 elements —
    // above ~44.7M points in 3D getPointPositions throws "Invalid array length", fitView dies
    // through it (camera left framing the raw input bounds), and the stale sceneRadius makes
    // the auto near/far planes depth-clip the scene to slivers (full analysis in
    // bench/results/cosmos3d-scale-bug-report.md). Raw coords render fine with the sim off —
    // rescalePositions is a simulation-space concern — so feed raw xyz and place the camera
    // like the three.js row.
    const graph = new Graph(view, {
      backgroundColor: '#0e1116',
      spaceDimensions: 3,
      enableSimulation: false,   // precomputed positions — render-only, like the deck/three rows
      rescalePositions: false,   // raw cloud coords; camera placed explicitly from the bbox
      fitViewOnInit: false,      // the contract's setCamera('overview') does the explicit fit
      pointDefaultSize: parseFloat(new URLSearchParams(location.search).get('size') || '1.5'), // bench default 1.5 (~matches the other rows); parity-probe override
      cameraNear: Math.max(0.01, radius / 100), // explicit planes — the auto derivation shares
      cameraFar: radius * 100,                  // the broken bounds path at 50M
    });
    graph.setPointPositions(positions, { dimensions: 3 });
    graph.setPointColors(rgba);
    graph.render();
    await graph.ready;
    const tInit = performance.now() - t1;

    report(name, n, tFetch, tInit);
    startFPS();

    // overview/mid/deep dolly the orbit camera toward the bbox centre by the same ratios as the
    // three.js page (1 / 0.5 / 0.23 of the overview distance). All camera state is page-owned —
    // no engine readback in the loop, so every scale gets identical deterministic framing.
    const cam = { target: [center[0], center[1], center[2]], distance: radius * 3.4, azimuth: 0.6, polar: 1.15 };
    const apply = () => graph.setCameraState({ ...cam }, 0);
    Object.assign(window.__bench, {
      ready: true,
      timings: { n, points: n, tFetch, tPrep: 0, tInit },
      settled: true, tSettle: 0,
      graph,
      pauseLayout: () => { window.__bench.paused = true; }, // sim is already off
      fitView: () => { cam.distance = radius * 3.4; apply(); },
      counts: () => ({ points: n }),
      cameraState: () => camState,
      setCamera: (s) => {
        try {
          const k = s === 'deep' ? 0.23 : s === 'mid' ? 0.5 : 1;
          cam.distance = radius * 3.4 * k;
          apply();
          camState = s;
        } catch (e) {}
      },
      // continuous orbit: advance azimuth every rAF via setCameraState — with the sim off cosmos
      // renders on demand, so this drives exactly one redraw per displayed frame for ms.
      orbit: (ms) => {
        const t = performance.now();
        const step = () => {
          const dt = performance.now() - t;
          try { cam.azimuth += 0.02; apply(); } catch (e) {}
          if (dt < ms) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
    });
  } catch (e) {
    stage('failed'); $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

run(cloudParam() || 'swiss_roll_1000000');
