// three.js 3D RENDERING capability example (NATIVE) — three is a 3D engine outright:
// perspective camera, orbit controls, depth-sorted scene. Size-attenuated point sprites
// (nearer = larger) over the shared synthetic 3D clusters, plus a ground grid for depth
// reference; the harness orbit shows real parallax.
import { mountThree, THREE, roundDisc } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const N = 3000;

mountThree({
  feature: '3d', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], points: N,
  build(scene, THREE, { positions, colors, radius, center }) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    const mat = new THREE.PointsMaterial({ map: roundDisc(), size: radius * 0.06, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));
    // ground grid under the cloud — a depth cue that makes the 3D space legible in a still shot
    const grid = new THREE.GridHelper(radius * 3.2, 16, 0x2a3546, 0x1d2634);
    grid.position.set(center[0], center[1] - radius * 1.15, center[2]);
    scene.add(grid);
  },
});
