// deck.gl 3D RENDERING capability example (NATIVE) — OrbitView + PointCloudLayer: deck's
// native 3D camera over binary typed-array attributes (same pattern as the 3D benchmark
// page, here on the shared synthetic clusters). The bench-core contract drives the orbit.
import { Deck, OrbitView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';
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

let camState = 'overview';
installAdapter({ tool: 'deck', feature: '3d', cloud: `synthetic_points_${N}`, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
try {
  const view = $('view');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  view.appendChild(canvas);

  const t0 = performance.now();
  const { n, positions, colors, center, radius } = makePoints({ n: N, seed: 11 });
  const layer = new PointCloudLayer({
    id: 'pc3d',
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    data: { length: n, attributes: { getPosition: { value: positions, size: 3 }, getColor: { value: colors, size: 3 } } },
    getNormal: [0, 0, 1],
    sizeUnits: 'meters', pointSize: radius * 0.028, // world-unit size → perspective attenuation (the depth cue)
  });
  const W = view.clientWidth || 1440, H = view.clientHeight || 900;
  const zoom = Math.log2(Math.min(W, H) / (radius * 2.6));
  const ivs = () => ({ target: center, rotationX: 24, rotationOrbit: 30, zoom, minZoom: zoom - 6, maxZoom: zoom + 12 });
  const deck = new Deck({ canvas, views: new OrbitView({ orbitAxis: 'Y', fovy: 50 }), controller: true, initialViewState: ivs(), layers: [layer] });
  const tInit = performance.now() - t0;

  if ($('m-points')) $('m-points').textContent = n.toLocaleString();
  if ($('m-load')) $('m-load').textContent = `${tInit.toFixed(0)} ms`;
  if ($('m-stage')) $('m-stage').textContent = 'rendered';
  startFPS();

  Object.assign(window.__bench, {
    ready: true,
    timings: { points: n, tInit },
    settled: true, tSettle: 0,
    pauseLayout: () => { window.__bench.paused = true; },
    fitView: () => { try { deck.setProps({ initialViewState: ivs() }); } catch (e) {} },
    counts: () => ({ points: n }),
    cameraState: () => camState,
    setCamera: (s) => {
      try {
        const z = s === 'deep' ? zoom + 3 : s === 'mid' ? zoom + 1.5 : zoom;
        deck.setProps({ initialViewState: { ...ivs(), zoom: z, transitionDuration: 300 } });
        camState = s;
      } catch (e) {}
    },
    orbit: (ms) => {
      const t = performance.now();
      let rot = 30;
      const step = () => {
        rot += 1.2;
        try { deck.setProps({ initialViewState: { ...ivs(), rotationOrbit: rot } }); } catch (e) {}
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
