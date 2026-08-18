// LAYOUT EXPORT page (prep tooling, not a benchmark): runs the cosmos.gl GPU force simulation
// over a binary graph tier and exposes the settled positions for the headless driver
// (prep/layout_citpatents.mjs) to save as <tier>.pos.f32. CPU force-atlas is infeasible at
// this scale (~0.2 iters/s at 500K nodes ⇒ days for 3.77M) — the GPU sim is the benchmark's
// own measured layout winner, which makes it the honest fixture generator.
//   ?g=cit_patents   ?iters=600
import { Graph } from '@cosmos.gl/graph';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const tier = q.get('g') || 'cit_patents';
const targetIters = parseInt(q.get('iters') || '600', 10);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

async function run() {
  window.__layout = { ready: false, error: null, frames: 0, done: false };
  try {
    $('m-stage').textContent = 'fetching binary tier…';
    const meta = await (await fetch(`data/${tier}.meta.json`)).json();
    const edgesBuf = await (await fetch(`data/${meta.files.edges}`)).arrayBuffer();
    const edgesU32 = new Uint32Array(edgesBuf);
    const n = meta.nodes;
    $('m-nodes').textContent = n.toLocaleString();
    $('m-edges').textContent = meta.edges.toLocaleString();

    const links = new Float32Array(edgesU32); // node indices < 2^22 — exact in f32
    // ?init=1 → start from the spectral embedding (<tier>.init.f32, prep/spectral_init.py) so the
    // sim only has to refine locally; otherwise a seeded random scatter.
    let pos;
    if (q.get('init') === '1') {
      const ib = await (await fetch(`data/${tier}.init.f32`)).arrayBuffer();
      pos = new Float32Array(ib);
      if (pos.length !== n * 2) throw new Error(`init.f32 length ${pos.length} ≠ n*2 ${n * 2}`);
      $('m-stage').textContent = 'spectral init loaded';
    } else {
      const rand = mulberry32(1234);
      pos = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { pos[i * 2] = rand() * 4096; pos[i * 2 + 1] = rand() * 4096; }
    }

    $('m-stage').textContent = 'starting GPU sim…';
    const graph = new Graph($('graph'), {
      backgroundColor: '#0e1116', enableSimulation: true, spaceSize: 8192, fitViewOnInit: false, pixelRatio: 1,
      renderLinks: false, // sim uses links for attraction; not drawing them keeps iterations fast
      // URL-tunable physics: at 3.77M nodes the first attempt (repulsion .4 / gravity .15)
      // squeezed everything against the spaceSize walls with no visible structure — dense
      // graphs need gentler repulsion and a stronger centre pull + springs to contract.
      simulationFriction: 0.85,
      simulationRepulsion: parseFloat(q.get('repulsion') || '0.15'),
      simulationLinkSpring: parseFloat(q.get('spring') || '1'),
      simulationGravity: parseFloat(q.get('gravity') || '0.5'),
      simulationDecay: 10000000, // effectively no auto-cooldown — the driver decides when to stop
    });
    graph.setPointPositions(pos);
    graph.setLinks(links);
    graph.render();
    graph.start();

    const tick = () => { window.__layout.frames++; $('m-iters').textContent = `${window.__layout.frames}/${targetIters}`; if (window.__layout.frames < targetIters) requestAnimationFrame(tick); else finish(); };
    const finish = () => {
      graph.pause();
      $('m-stage').textContent = 'settled — reading back…';
      const out = graph.getPointPositions(); // n×2, plain array (n*2 = 7.5M ≪ the 2^27 limit)
      window.__layout.result = Float32Array.from(out);
      window.__layout.done = true;
      $('m-stage').textContent = 'done';
    };
    requestAnimationFrame(tick);
    window.__layout.ready = true;
    window.__layout.graph = graph;
    // driver pulls the buffer in base64 chunks (a single 40MB string round-trip is fragile)
    window.__layout.chunk = (i, len) => {
      const sub = window.__layout.result.subarray(i, i + len);
      let bin = '';
      const bytes = new Uint8Array(sub.buffer, sub.byteOffset, sub.byteLength);
      for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
      return btoa(bin);
    };
  } catch (e) {
    $('m-stage').textContent = 'failed';
    $('m-err').textContent = '⚠ ' + (e?.message || e);
    window.__layout.error = String(e?.message || e);
  }
}
run();
