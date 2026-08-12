// three.js LABELS capability example (WORKAROUND) — text via THREE.Sprite (CanvasTexture); three
// has no built-in labels (CSS2DRenderer is the other add-on). Synthetic points; cap-three-common.
import { mountThree, THREE, roundDisc } from './cap-three-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

function textSprite(txt) {
  const pad = 8, fs = 38;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `bold ${fs}px -apple-system, system-ui, sans-serif`;
  const w = Math.ceil(m.measureText(txt).width) + pad * 2, h = fs + pad * 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(14,17,22,0.74)'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,140,170,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.font = `bold ${fs}px -apple-system, system-ui, sans-serif`; ctx.fillStyle = '#e6edf6'; ctx.textBaseline = 'middle'; ctx.fillText(txt, pad, h / 2);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  const scale = 0.1; spr.scale.set((w / h) * scale, scale, 1);
  return spr;
}

mountThree({
  feature: 'labels', primitives: [PRIMITIVE.POINTS], points: 20, seed: 9,
  build(scene, THREE, { n, positions, colors }) {
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pg.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: roundDisc(), size: 0.13, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false })));
    for (let i = 0; i < n; i++) {
      const s = textSprite(`n${i}`);
      s.position.set(positions[i * 3], positions[i * 3 + 1] + 0.1, positions[i * 3 + 2]);
      scene.add(s);
    }
  },
});
