// deck.gl point-cloud example (demo site) — PointCloudLayer in an OrbitView, binary attributes.
import { Deck, OrbitView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PointCloudLayer } from '@deck.gl/layers';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './pc-load.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let deck = null, canvas = null;
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
  try {
    if (deck) { try { deck.finalize(); } catch (e) {} deck = null; }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }
    stage('loading manifest…');
    const t0 = performance.now();
    const man = await loadManifest();
    let { n, positions, colors, center, radius, name } = await loadCloud(pickCloud(man, base));
    const tFetch = performance.now() - t0;
    const budget = +(new URLSearchParams(location.search).get('budget') || 0);
    if (budget && budget < n) { positions = positions.subarray(0, budget * 3); colors = colors.subarray(0, budget * 3); name += ` ·LOD ${(budget / 1e6)}M`; n = budget; }

    stage('building layer…');
    const t1 = performance.now();
    const layer = new PointCloudLayer({
      id: 'pc', coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      data: { length: n, attributes: { getPosition: { value: positions, size: 3 }, getColor: { value: colors, size: 3 } } },
      getNormal: [0, 0, 1], pointSize: 1.5,
    });
    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const zoom = Math.log2(Math.min(W, H) / (radius * 2.2));
    const ivs = () => ({ target: center, rotationX: 22, rotationOrbit: 30, zoom, minZoom: zoom - 6, maxZoom: zoom + 12 });
    deck = new Deck({ canvas, views: new OrbitView({ orbitAxis: 'Y', fovy: 50 }), controller: true, initialViewState: ivs(), layers: [layer] });
    const tInit = performance.now() - t1;
    report(name, n, tFetch, tInit);
    startFPS();
  } catch (e) { stage('failed'); $('m-err').textContent = '⚠ ' + (e?.message || e); }
}
run(cloudParam() || 'graph_combined_umap3');
