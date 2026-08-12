// Seeded synthetic graph generator for the capability EXAMPLES — public-safe (no real data).
// Sized for LEGIBILITY + FRAME-FILL, not scale: a handful of clusters spread across the
// coordinate frame so Sigma's fit-to-view spreads nodes across the whole viewport (the
// presentation gate needs the render to actually fill the frame to move >2% of pixels on a
// zoom). Deterministic (seeded) so screenshots + coverage counts are reproducible. Both the
// example page and the harness call makeGraph() → identical {nodes, edges}.
import Graph from 'graphology';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2'];

// N nodes in K clusters across the frame; M UNIQUE edges (Set-deduped → g.size === M exactly,
// so coverage can be an exact check, not a bypass). Mostly intra-cluster + a few bridges.
export function makeGraph({ n = 54, clusters = 6, seed = 7, avgDeg = 3.2 } = {}) {
  const rand = mulberry32(seed);
  const g = new Graph({ type: 'undirected' });

  const centers = [];
  for (let c = 0; c < clusters; c++) {
    const a = (c / clusters) * Math.PI * 2;
    centers.push({ x: Math.cos(a) * 0.74, y: Math.sin(a) * 0.74, color: PALETTE[c % PALETTE.length] });
  }
  const clusterOf = [];
  for (let i = 0; i < n; i++) {
    const c = i % clusters;
    const ctr = centers[c];
    g.addNode(`n${i}`, {
      x: ctr.x + (rand() - 0.5) * 0.5,
      y: ctr.y + (rand() - 0.5) * 0.5,
      size: 8 + rand() * 8,
      color: ctr.color,
      label: `n${i}`,
    });
    clusterOf.push(c);
  }

  const seen = new Set();
  const target = Math.round((n * avgDeg) / 2);
  let guard = 0;
  while (g.size < target && guard < target * 60) {
    guard++;
    const a = Math.floor(rand() * n);
    let b;
    if (rand() < 0.8) {
      const same = [];
      for (let j = 0; j < n; j++) if (clusterOf[j] === clusterOf[a] && j !== a) same.push(j);
      b = same.length ? same[Math.floor(rand() * same.length)] : Math.floor(rand() * n);
    } else {
      b = Math.floor(rand() * n);
    }
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.mergeEdge(`n${a}`, `n${b}`);
  }

  return { graph: g, nodes: g.order, edges: g.size };
}
