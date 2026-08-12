// cosmos.gl DENSITY MAP capability example (WORKAROUND) — cosmos has no native density primitive,
// so this computes each point's LOCAL density (neighbours within a radius) and colour-encodes it on
// a blue→red ramp via setPointColors — the same per-point density approximation the three.js
// example uses. Synthetic seeded cloud; gate-verified via cap-cosmos-common.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

// sparse → dense ramp (blue → cyan → green → yellow → red), RGBA 0–1 for cosmos
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const s = [[40, 70, 180], [30, 170, 175], [95, 200, 90], [240, 220, 50], [230, 55, 40]];
  const x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i, a = s[i], b = s[i + 1];
  return [(a[0] + (b[0] - a[0]) * f) / 255, (a[1] + (b[1] - a[1]) * f) / 255, (a[2] + (b[2] - a[2]) * f) / 255, 1];
}

mountCosmos({
  feature: 'density-map', primitives: [PRIMITIVE.DENSITY], kind: 'points', n: 2500, nodeSize: 4,
  onGraph(graph, { pos, N }) {
    // extent → a density kernel radius
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (let i = 0; i < N; i++) { const x = pos[i * 2], y = pos[i * 2 + 1]; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
    const r = Math.max(mxx - mnx, mxy - mny) * 0.06, r2 = r * r;
    // local density = neighbours within r (O(n^2), runs once)
    const dens = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const xi = pos[i * 2], yi = pos[i * 2 + 1]; let cnt = 0;
      for (let j = 0; j < N; j++) { const dx = pos[j * 2] - xi, dy = pos[j * 2 + 1] - yi; if (dx * dx + dy * dy < r2) cnt++; }
      dens[i] = cnt;
    }
    let dmin = Infinity, dmax = -Infinity; for (const d of dens) { if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
    const col = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { const c = ramp((dens[i] - dmin) / (dmax - dmin || 1)); col.set(c, i * 4); }
    graph.setPointColors(col);
    graph.render();
  },
});
