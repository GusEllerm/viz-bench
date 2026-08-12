// Helios-Web as a pure 3D POINT renderer — no edges — on the same binary clouds
// the deck.gl/three.js point-cloud pages use, so its numbers slot into the 3D /
// point-cloud table on the same workload. Positions normalised to ±250 (its
// native scale); colors from the cloud's u8 RGB.
import { Helios } from 'helios-web';
import { Metrics } from './metrics.js';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './pc-load.js';

const metrics = new Metrics();
const selector = document.getElementById('dataset');

let helios = null;

async function run(base) {
  window.__bench = { tool: 'heliospc', dataset: base, ready: false, settled: true, timings: null };
  try {
    metrics.stage(`fetching ${base} …`);
    const t0 = performance.now();
    const manifest = await loadManifest();
    const entry = pickCloud(manifest, base);
    const cloud = await loadCloud(entry);
    const tFetch = performance.now() - t0;

    metrics.stage(`building ${cloud.n.toLocaleString()} helios nodes …`);
    const t1 = performance.now();
    const { positions, colors, center, radius, n } = cloud;
    const k = 250 / radius;
    const nodeDict = {};
    for (let i = 0; i < n; i++) {
      nodeDict[i] = {
        Position: [(positions[3 * i] - center[0]) * k, (positions[3 * i + 1] - center[1]) * k, (positions[3 * i + 2] - center[2]) * k],
        Color: [colors[3 * i] / 255, colors[3 * i + 1] / 255, colors[3 * i + 2] / 255],
        Size: 1,
      };
    }
    const tPrep = performance.now() - t1;

    metrics.stage('rendering …');
    const t2 = performance.now();
    if (helios) { try { helios.cleanup?.(); } catch (err) {} document.getElementById('graph').innerHTML = ''; }
    helios = new Helios({
      elementID: 'graph',
      nodes: nodeDict,
      edges: [], // points only — the 3D-table workload
      use2D: false,
      autoStartLayout: false,
    });
    window.__bench.helios = helios;
    try { helios.backgroundColor([0.055, 0.066, 0.086, 1.0]); } catch (err) {}

    let announced = false;
    const announce = () => {
      if (announced) return;
      announced = true;
      const tInit = performance.now() - t2;
      try { helios.pauseLayout(); } catch (err) {}
      const timings = { nodes: n, edges: 0, tFetch, tPrep, tInit };
      metrics.report(timings);
      metrics.startFPS();
      const baseZoom = (() => { try { const z = helios.zoomFactor(); return typeof z === 'number' && isFinite(z) && z > 0 ? z : 1; } catch (err) { return 1; } })();
      Object.assign(window.__bench, {
        ready: true,
        timings,
        baseZoom,
        paused: true,
        pauseLayout: () => { window.__bench.paused = true; },
        fitView: () => { try { helios.zoomFactor(baseZoom, 0); } catch (err) {} },
        cosmosZoom: (z, ms) => { try { helios.zoomFactor(baseZoom * z, ms); } catch (err) {} },
      });
    };
    helios.onReady(announce);
    const poll = setInterval(() => {
      if (announced) { clearInterval(poll); return; }
      try { if (helios._isReady) announce(); } catch (err) {}
    }, 250);
    setTimeout(() => { if (!announced) announce(); }, 20000);
  } catch (err) {
    metrics.error(err);
    if (window.__bench) window.__bench.error = String(err?.message || err);
  }
}

const params = new URLSearchParams(location.search);
const initial = cloudParam() || 'graph_combined_umap3';
if (selector) {
  selector.value = initial;
  selector.addEventListener('change', (ev) => {
    const c = ev.target.value;
    const q = new URLSearchParams(location.search);
    q.set('c', c);
    history.replaceState(null, '', `?${q}`);
    run(c);
  });
}
run(initial);
