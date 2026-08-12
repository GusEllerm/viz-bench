// Sigma.js DENSITY MAP capability example (WORKAROUND) — Sigma has no native density primitive,
// so this renders a dense NODE cloud (no edges) and colour-encodes each node's LOCAL density
// (neighbours within a radius) on a blue→red ramp — the same per-point density approximation the
// three.js example uses. Synthetic seeded cloud; gate-verified via cap-sigma-common (cloud mode).
import { mountSigma } from './cap-sigma-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

// sparse → dense ramp (blue → cyan → green → yellow → red) as a CSS rgb() string
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const s = [[40, 70, 180], [30, 170, 175], [95, 200, 90], [240, 220, 50], [230, 55, 40]];
  const x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i, a = s[i], b = s[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

mountSigma({
  feature: 'density-map', primitives: [PRIMITIVE.DENSITY], cloud: true, n: 2000,
  settings: { labelRenderedSizeThreshold: 999 },
  decorate(g) {
    const nodes = g.nodes(), N = nodes.length;
    const xs = new Float32Array(N), ys = new Float32Array(N);
    nodes.forEach((nd, i) => { xs[i] = g.getNodeAttribute(nd, 'x'); ys[i] = g.getNodeAttribute(nd, 'y'); });
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (let i = 0; i < N; i++) { if (xs[i] < mnx) mnx = xs[i]; if (xs[i] > mxx) mxx = xs[i]; if (ys[i] < mny) mny = ys[i]; if (ys[i] > mxy) mxy = ys[i]; }
    const r = Math.max(mxx - mnx, mxy - mny) * 0.06, r2 = r * r;
    const dens = new Float32Array(N);
    for (let i = 0; i < N; i++) { let cnt = 0; for (let j = 0; j < N; j++) { const dx = xs[j] - xs[i], dy = ys[j] - ys[i]; if (dx * dx + dy * dy < r2) cnt++; } dens[i] = cnt; }
    let dmin = Infinity, dmax = -Infinity; for (const d of dens) { if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
    nodes.forEach((nd, i) => { g.setNodeAttribute(nd, 'color', ramp((dens[i] - dmin) / (dmax - dmin || 1))); g.setNodeAttribute(nd, 'size', 3.5); });
  },
});
