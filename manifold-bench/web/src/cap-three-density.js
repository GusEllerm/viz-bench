// three.js DENSITY capability example (WORKAROUND) — three has no built-in aggregation, so this
// COMPUTES local point density (neighbours within a radius) and colour-encodes it on a blue→red
// ramp (density-heatmap-on-a-scatter). Synthetic points; gate-verified via cap-three-common.
import { mountThree, THREE, roundDisc } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const N = 4000;
// sparse → dense colour ramp (blue → cyan → green → yellow → red)
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const s = [[40, 70, 180], [30, 170, 175], [95, 200, 90], [240, 220, 50], [230, 55, 40]];
  const x = t * (s.length - 1), i = Math.min(s.length - 2, Math.floor(x)), f = x - i, a = s[i], b = s[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

mountThree({
  feature: 'density-map', primitives: [PRIMITIVE.DENSITY], points: N,
  build(scene, THREE, { n, positions, radius }) {
    // local density = neighbours within a radius (O(n^2), runs once) → normalise → colour ramp
    const r2 = (radius * 0.13) ** 2;
    const dens = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const xi = positions[i * 3], yi = positions[i * 3 + 1], zi = positions[i * 3 + 2]; let cnt = 0;
      for (let j = 0; j < n; j++) { const dx = positions[j * 3] - xi, dy = positions[j * 3 + 1] - yi, dz = positions[j * 3 + 2] - zi; if (dx * dx + dy * dy + dz * dz < r2) cnt++; }
      dens[i] = cnt;
    }
    let dmin = Infinity, dmax = -Infinity; for (const d of dens) { if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
    const colors = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) { const cc = ramp((dens[i] - dmin) / (dmax - dmin || 1)); colors[i * 3] = cc[0]; colors[i * 3 + 1] = cc[1]; colors[i * 3 + 2] = cc[2]; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    const mat = new THREE.PointsMaterial({ map: roundDisc(), size: radius * 0.085, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
  },
});
