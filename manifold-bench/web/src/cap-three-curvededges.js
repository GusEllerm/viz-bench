// three.js CURVED-EDGES capability example (WORKAROUND) — the audit (re-survey) corrected the old
// "not applicable / no graph model" verdict: three has no graph abstraction, but it draws curves
// fine. Each edge is a THREE.QuadraticBezierCurve3 with a perpendicular-offset control point,
// sampled to a THREE.Line (TubeGeometry is the thick-line variant). Synthetic seeded points +
// edges; gate-verified via cap-three-common.
import { mountThree, THREE, roundDisc } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountThree({
  feature: 'curved-edges', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], points: 60, edges: 90,
  build(scene, THREE, { positions, colors, edges, radius }) {
    // nodes
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ map: roundDisc(), size: radius * 0.07, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false })));

    // curved edges — a quadratic-bezier per edge, control point offset perpendicular to the chord
    const up = new THREE.Vector3(0, 1, 0);
    const mat = new THREE.LineBasicMaterial({ color: 0x8aa6cd, transparent: true, opacity: 0.7 });
    for (const [a, b] of edges) {
      const pa = new THREE.Vector3(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
      const pb = new THREE.Vector3(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
      const dir = pb.clone().sub(pa);
      let perp = dir.clone().cross(up);
      if (perp.lengthSq() < 1e-6) perp = dir.clone().cross(new THREE.Vector3(1, 0, 0));
      perp.normalize().multiplyScalar(dir.length() * 0.35);
      const ctrl = pa.clone().add(pb).multiplyScalar(0.5).add(perp);
      const curve = new THREE.QuadraticBezierCurve3(pa, ctrl, pb);
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)), mat));
    }
  },
});
