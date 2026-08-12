// three.js NODE-IMAGES capability example (WORKAROUND) — per-node icons via THREE.Sprite with
// PROCEDURALLY-generated CanvasTexture icons (never real avatars). Synthetic graph; cap-three-common.
import { mountThree, THREE } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

function icon(bg, glyph) {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, s / 2, s / 2 + 2);
  return new THREE.CanvasTexture(c);
}
const COLORS = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2'];
const GLYPHS = ['◆', '●', '▲', '★', '■', '✚'];
const MATERIALS = COLORS.map((col, i) => new THREE.SpriteMaterial({ map: icon(col, GLYPHS[i]), transparent: true, depthWrite: false }));

mountThree({
  feature: 'node-images', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], points: 40, edges: 46, seed: 3,
  build(scene, THREE, { n, positions, edges, clusterOf }) {
    const lp = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], k) => {
      lp[k * 6] = positions[a * 3]; lp[k * 6 + 1] = positions[a * 3 + 1]; lp[k * 6 + 2] = positions[a * 3 + 2];
      lp[k * 6 + 3] = positions[b * 3]; lp[k * 6 + 4] = positions[b * 3 + 1]; lp[k * 6 + 5] = positions[b * 3 + 2];
    });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5a6a86, transparent: true, opacity: 0.35 })));

    for (let i = 0; i < n; i++) {
      const spr = new THREE.Sprite(MATERIALS[clusterOf[i] % MATERIALS.length]);
      spr.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      spr.scale.set(0.16, 0.16, 1);
      scene.add(spr);
    }
  },
});
