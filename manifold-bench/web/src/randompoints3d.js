// Seeded synthetic 3D points for the three.js capability examples — public-safe (synthetic only).
// Framework-free (returns typed arrays). Frame-filling clustered placement; parametrized n
// (density uses a dense n, lines/labels/node-images a small legible n + a few unique edges).
// Deterministic (seeded) → reproducible screenshots + exact coverage.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [[76, 120, 168], [245, 133, 24], [84, 162, 75], [228, 87, 86], [114, 183, 178], [178, 121, 162]];

export function makePoints({ n = 2000, clusters = 6, seed = 11, edges = 0 } = {}) {
  const rand = mulberry32(seed);
  const positions = new Float32Array(n * 3);
  const colors = new Uint8Array(n * 3);

  const centers = [];
  for (let c = 0; c < clusters; c++) {
    const a = (c / clusters) * Math.PI * 2;
    centers.push([Math.cos(a) * 0.72, (rand() - 0.5) * 0.9, Math.sin(a) * 0.72]);
  }
  const clusterOf = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = i % clusters, ctr = centers[c], col = PALETTE[c % PALETTE.length];
    positions[i * 3] = ctr[0] + (rand() - 0.5) * 0.5;
    positions[i * 3 + 1] = ctr[1] + (rand() - 0.5) * 0.5;
    positions[i * 3 + 2] = ctr[2] + (rand() - 0.5) * 0.5;
    colors[i * 3] = col[0]; colors[i * 3 + 1] = col[1]; colors[i * 3 + 2] = col[2];
    clusterOf[i] = c;
  }

  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = positions[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 || 1;

  const edgeList = [];
  if (edges > 0) {
    const seen = new Set();
    let guard = 0;
    while (edgeList.length < edges && guard < edges * 60) {
      guard++;
      const a = Math.floor(rand() * n);
      let b;
      if (rand() < 0.8) {
        const same = [];
        for (let j = 0; j < n; j++) if (clusterOf[j] === clusterOf[a] && j !== a) same.push(j);
        b = same.length ? same[Math.floor(rand() * same.length)] : Math.floor(rand() * n);
      } else b = Math.floor(rand() * n);
      if (a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key); edgeList.push([a, b]);
    }
  }

  return { n, positions, colors, center, radius, clusterOf, edges: edgeList };
}
