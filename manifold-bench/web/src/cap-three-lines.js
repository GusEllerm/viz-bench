// three.js LINES capability example (WORKAROUND) — edges via THREE.LineSegments (1px, no width;
// Line2 is the add-on for thick lines). Synthetic graph; gate-verified via cap-three-common.
import { mountThree, THREE, roundDisc } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountThree({
  feature: 'lines', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], points: 50, edges: 74, seed: 5,
  build(scene, THREE, { positions, colors, edges }) {
    const lp = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], k) => {
      lp[k * 6] = positions[a * 3]; lp[k * 6 + 1] = positions[a * 3 + 1]; lp[k * 6 + 2] = positions[a * 3 + 2];
      lp[k * 6 + 3] = positions[b * 3]; lp[k * 6 + 4] = positions[b * 3 + 1]; lp[k * 6 + 5] = positions[b * 3 + 2];
    });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8aa4cc, transparent: true, opacity: 0.6 })));

    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pg.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: roundDisc(), size: 0.1, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false })));
  },
});
