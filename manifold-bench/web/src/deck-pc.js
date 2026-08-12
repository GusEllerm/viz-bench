// deck.gl point-cloud bench — PointCloudLayer in an OrbitView, fed binary attributes
// (Float32Array positions / Uint8Array colours straight from the .bin files; no per-point
// accessors). Mirrors the graph bench's __bench contract so the same Playwright harness drives it.
import { Deck, OrbitView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './loadcloud.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let deck = null, canvas = null;

const fmt = (ms) => (ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`);
function stage(t) { $('m-stage').textContent = t; }
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
  installAdapter({ tool: 'deck', cloud: base, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (deck) { try { deck.finalize(); } catch (e) {} deck = null; }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }

    stage('loading manifest…');
    const t0 = performance.now();
    const man = await loadManifest();
    const entry = pickCloud(man, base);
    let { n, positions, colors, center, radius, name } = await loadCloud(entry);
    const tFetch = performance.now() - t0;

    // LOD budget: render only the first N points. Because the clouds are stored in random
    // order, a prefix is a uniform random subsample — a poor-man's level-of-detail. Shows the
    // render-side lever for the >10M wall (Potree productizes this with octrees + streaming).
    const budget = +(new URLSearchParams(location.search).get('budget') || 0);
    if (budget && budget < n) { positions = positions.subarray(0, budget * 3); colors = colors.subarray(0, budget * 3); name += ` ·LOD ${(budget / 1e6)}M`; n = budget; }

    stage('building layer…');
    const t1 = performance.now();
    const layer = new PointCloudLayer({
      id: 'pc',
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: { length: n, attributes: {
        getPosition: { value: positions, size: 3 },
        getColor: { value: colors, size: 3 },
      } },
      getNormal: [0, 0, 1],
      pointSize: parseFloat(new URLSearchParams(location.search).get('size') || '1.5'), // parity-probe override; bench default 1.5
    });
    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const zoom = Math.log2(Math.min(W, H) / (radius * 2.2));
    const ivs = () => ({ target: center, rotationX: 22, rotationOrbit: 30, zoom, minZoom: zoom - 6, maxZoom: zoom + 12 });
    deck = new Deck({
      canvas,
      views: new OrbitView({ orbitAxis: 'Y', fovy: 50 }),
      controller: true,
      initialViewState: ivs(),
      layers: [layer],
    });
    const tInit = performance.now() - t1;

    report(name, n, tFetch, tInit);
    startFPS();
    Object.assign(window.__bench, {
      ready: true,
      timings: { n, points: n, tFetch, tPrep: 0, tInit },
      settled: true, tSettle: 0,            // static cloud — nothing to settle
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { deck.setProps({ initialViewState: ivs() }); } catch (e) {} },
      counts: () => ({ points: n }),
      cameraState: () => camState,
      // overview = fit; mid/deep dolly in (zoom +1.5/+3 octaves) for the apiCamera driver
      // and the presentation gate.
      setCamera: (s) => {
        try {
          const z = s === 'deep' ? zoom + 3 : s === 'mid' ? zoom + 1.5 : zoom;
          deck.setProps({ initialViewState: { ...ivs(), zoom: z, transitionDuration: 300 } });
          camState = s;
        } catch (e) {}
      },
      // continuous orbit (every frame) — forces the on-demand renderer to redraw each frame,
      // so FPS measures render throughput under motion (not the idle rAF cap during dwells).
      orbit: (ms) => {
        const t0 = performance.now();
        let rot = 30;
        const step = () => {
          rot += 1.2;
          try { deck.setProps({ initialViewState: { ...ivs(), rotationOrbit: rot } }); } catch (e) {}
          if (performance.now() - t0 < ms) requestAnimationFrame(step);
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
