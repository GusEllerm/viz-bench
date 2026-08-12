// deck.gl DENSITY MAP capability example — @deck.gl/aggregation-layers HeatmapLayer over a
// SYNTHETIC swiss-roll cloud projected to 2D (x, z), in an OrthographicView. Public-safe:
// synthetic data only, never the real-graph embedding. Implements the bench-core contract so the
// capability harness can gate-verify it actually renders + presents (density is GPU
// screen-space aggregation, so zooming re-aggregates → a visible change the presentation
// gate can confirm).
import { Deck, OrthographicView } from '@deck.gl/core';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './loadcloud.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let deck = null, canvas = null;
const fmt = (ms) => (ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`);
const stage = (t) => { $('m-stage').textContent = t; };

async function run(base) {
  let camState = 'overview';
  installAdapter({ tool: 'deck', feature: 'density-map', cloud: base, primitives: [PRIMITIVE.DENSITY], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (deck) { try { deck.finalize(); } catch (e) {} deck = null; }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }

    stage('loading manifest…');
    const t0 = performance.now();
    const man = await loadManifest();
    const entry = pickCloud(man, base);
    const { n, positions, center, radius, name } = await loadCloud(entry);
    const tFetch = performance.now() - t0;

    // project the 3D cloud to 2D (x, z) — the swiss roll's spiral lives in that plane, so a
    // screen-space heatmap over it reads as the density of the manifold.
    stage('building heatmap…');
    const t1 = performance.now();
    const pos2d = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { pos2d[i * 2] = positions[i * 3]; pos2d[i * 2 + 1] = positions[i * 3 + 2]; }
    const cx = center[0], cy = center[2];

    const makeLayer = () => new HeatmapLayer({
      id: 'density',
      data: { length: n, attributes: { getPosition: { value: pos2d, size: 2 } } },
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.03,
      aggregation: 'SUM',
    });
    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const zoom = Math.log2(Math.min(W, H) / (radius * 2.4));
    const setView = (z, transitionDuration = 0) => deck.setProps({ initialViewState: { target: [cx, cy, 0], zoom: z, transitionDuration } });

    deck = new Deck({
      canvas,
      views: new OrthographicView(),
      controller: true,
      initialViewState: { target: [cx, cy, 0], zoom },
      layers: [makeLayer()],
    });
    const tInit = performance.now() - t1;

    $('m-cloud').textContent = name; $('m-points').textContent = n.toLocaleString();
    $('m-load').textContent = fmt(tFetch + tInit); stage(`loaded — ${fmt(tFetch + tInit)}`);
    Object.assign(window.__bench, {
      ready: true,
      timings: { n, points: n, tFetch, tPrep: 0, tInit },
      settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { setView(zoom); } catch (e) {} },
      counts: () => ({ points: n }),
      cameraState: () => camState,
      // overview = fit; mid/deep zoom in — the heatmap re-aggregates in screen space, so the
      // pixels change (what the presentation gate checks).
      setCamera: (s) => {
        try { setView(s === 'deep' ? zoom + 3 : s === 'mid' ? zoom + 1.5 : zoom, 300); camState = s; } catch (e) {}
      },
      // continuous zoom oscillation → screen-space re-aggregation every frame (redraw) for the probe
      orbit: (ms) => {
        const t = performance.now();
        const step = () => {
          const dt = performance.now() - t;
          try { setView(zoom + 1.0 * Math.sin(dt / 380)); } catch (e) {}
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

run(cloudParam() || 'swiss_roll_100000');
