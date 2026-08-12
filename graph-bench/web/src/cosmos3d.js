// @cosmograph/cosmos 3D example (the Cosmograph dev's experimental 3D fork of cosmos.gl).
// A SYNTHETIC clustered graph (public-safe, fully synthetic) scattered into a 3D cube; the GPU force
// simulation organises it live in 3D (spaceDimensions:3 — the sim and its spatial structures run
// in the same dimensionality), under the fork's perspective orbit camera. Buttons switch 2D/3D at
// runtime via setConfigPartial (no re-ingest) and pause/resume the sim.
//   ?n=5000   node count   ·   ?dim=2|3   starting mode
import { Graph } from '@cosmograph/cosmos';

const $ = (id) => document.getElementById(id);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Categorical palette (rgba 0–1) — one colour per cluster.
const PALETTE = [
  [0.298, 0.471, 0.659, 1], [0.961, 0.522, 0.094, 1], [0.329, 0.635, 0.294, 1],
  [0.894, 0.341, 0.337, 1], [0.585, 0.404, 0.741, 1], [0.337, 0.706, 0.699, 1],
  [0.804, 0.582, 0.169, 1], [0.769, 0.431, 0.663, 1],
];

// Synthetic clustered graph: k clusters, mostly intra-cluster edges + sparse bridges, so the 3D
// layout settles into visibly separate blobs. Start positions = random 3D scatter (the sim's input).
function synth(n, k = 8, avgDeg = 4) {
  const rand = mulberry32(11);
  const cluster = new Uint8Array(n);
  for (let i = 0; i < n; i++) cluster[i] = (rand() * k) | 0;
  const byCluster = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) byCluster[cluster[i]].push(i);

  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { positions[i * 3] = rand() * 2 - 1; positions[i * 3 + 1] = rand() * 2 - 1; positions[i * 3 + 2] = rand() * 2 - 1; }

  const M = Math.round((n * avgDeg) / 2);
  const links = new Float32Array(M * 2);
  for (let e = 0; e < M; e++) {
    let a, b;
    if (rand() < 0.85) { // intra-cluster
      const members = byCluster[(rand() * k) | 0];
      a = members[(rand() * members.length) | 0]; b = members[(rand() * members.length) | 0];
    } else { a = (rand() * n) | 0; b = (rand() * n) | 0; } // bridge
    if (a === b || a == null || b == null) { a = (rand() * n) | 0; b = (a + 1) % n; }
    links[e * 2] = a; links[e * 2 + 1] = b;
  }

  const colors = new Float32Array(n * 4);
  const sizes = new Float32Array(n);
  for (let i = 0; i < n; i++) { colors.set(PALETTE[cluster[i] % PALETTE.length], i * 4); sizes[i] = 2.5 + rand() * 2.5; }
  return { n, M, positions, links, colors, sizes };
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

const q = new URLSearchParams(location.search);
const n = parseInt(q.get('n') || '5000', 10);
let dim = q.get('dim') === '2' ? 2 : 3;

async function run() {
  window.__bench = { ready: false, error: null };
  try {
    const d = synth(n);
    $('m-nodes').textContent = d.n.toLocaleString();
    $('m-edges').textContent = d.M.toLocaleString();
    $('m-stage').textContent = 'initialising…';

    const graph = new Graph($('graph'), {
      backgroundColor: '#0e1116',
      spaceDimensions: dim,
      enableSimulation: true,
      fitViewOnInit: true,
      // Simulation params are left at the library DEFAULTS (friction .85 · repulsion 1 · linkSpring 1 ·
      // gravity .25) — this example shows the fork as shipped, not a tuned config.
      // Below: cosmetic-only styling + the fork's own 3D features (off by default, on here to show them).
      pointSphereShading: true, // lit-sphere impostors — overlapping points read as volumes in 3D
      linkWidthScale: 0.8, linkOpacity: 0.3, // legibility at 10K links; rendering unchanged
      linkColorInterpolateFromEndpoints: true, // links fade between their endpoint cluster colours
    });
    graph.setPointPositions(d.positions, { dimensions: 3 });
    graph.setPointColors(d.colors);
    graph.setPointSizes(d.sizes);
    graph.setLinks(d.links);
    graph.render();
    graph.start();
    await graph.ready;
    // Explicit instant fit: the auto-orbit below calls setCameraState every frame, which cancels
    // any in-progress fit tween (they share a transition slot) — including fitViewOnInit's. So fit
    // instantly first, and refit while the sim expands the scatter into its settled layout.
    graph.fitView(0);
    const refits = [1500, 3000, 5000, 8000].map((ms) => setTimeout(() => graph.fitView(0), ms));

    let simRunning = true;
    const setMode = (m) => {
      dim = m;
      graph.setConfigPartial({ spaceDimensions: m }); // runtime switch, no re-ingest
      $('m-mode').textContent = m === 3 ? '3D · orbit' : '2D · pan/zoom';
      $('b-3d').classList.toggle('active', m === 3);
      $('b-2d').classList.toggle('active', m === 2);
      if (simRunning) $('m-stage').textContent = `simulating (GPU, ${m === 3 ? '3D' : '2D'})`;
    };
    $('m-mode').textContent = dim === 3 ? '3D · orbit' : '2D · pan/zoom';
    $('b-3d').onclick = () => setMode(3);
    $('b-2d').onclick = () => setMode(2);
    $('b-sim').onclick = () => {
      simRunning = !simRunning;
      if (simRunning) graph.unpause(); else graph.pause();
      $('b-sim').textContent = simRunning ? 'pause sim' : 'resume sim';
    };
    $('b-fit').onclick = () => { auto = false; graph.fitView(400); }; // stop the spin — it would cancel the fit tween

    // Gentle idle auto-orbit so the page reads as 3D at a glance; first pointer touch hands the
    // camera to the user (the fork's built-in orbit gestures) and cancels the pending auto-refits.
    let auto = dim === 3;
    $('graph').addEventListener('pointerdown', () => { auto = false; refits.forEach(clearTimeout); }, { once: true });
    const spin = () => {
      if (auto && dim === 3) {
        const s = graph.getCameraState();
        if (s) graph.setCameraState({ azimuth: s.azimuth + 0.0035 }, 0);
      }
      requestAnimationFrame(spin);
    };
    requestAnimationFrame(spin);

    startFPS();
    $('m-stage').textContent = 'simulating (GPU, ' + (dim === 3 ? '3D' : '2D') + ')';
    window.__bench.ready = true;
    window.__bench.graph = graph;
  } catch (e) {
    $('m-stage').textContent = 'failed';
    $('m-err').textContent = '⚠ ' + (e?.message || e);
    window.__bench.error = String(e?.message || e);
  }
}
run();
