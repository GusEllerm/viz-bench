// three.js POINTS / SCATTER capability example (NATIVE) — the base primitive: a GPU point
// sprite cloud (THREE.Points over a BufferGeometry). Synthetic seeded points, per-cluster
// colour. Gate-verified via cap-three-common (orbit moves the pixels → presentation gate).
import { mountThree, THREE, roundDisc } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const N = 3000;

mountThree({
  feature: 'points', primitives: [PRIMITIVE.POINTS], points: N,
  build(scene, THREE, { positions, colors, radius }) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    const mat = new THREE.PointsMaterial({ map: roundDisc(), size: radius * 0.05, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
  },
});
