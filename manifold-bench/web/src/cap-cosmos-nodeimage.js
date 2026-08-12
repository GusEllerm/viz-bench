// cosmos.gl NODE-IMAGES capability example (NATIVE) — the audit (re-survey) found the bare engine
// DOES render per-node images: setImageData(ImageData[]) + setPointImageIndices() (index per point
// into the image array) + setPointImageSizes(); images draw above the point shapes. Icons are
// PROCEDURALLY GENERATED ImageData (coloured disc + glyph), never real avatars. Base shapes set to
// None so only the images show. Synthetic seeded graph; gate-verified via cap-cosmos-common.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const COLORS = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2'];
const GLYPHS = ['◆', '●', '▲', '★', '■', '✚'];
function iconImageData(bg, glyph) {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, s / 2, s / 2 + 2);
  return ctx.getImageData(0, 0, s, s);
}

mountCosmos({
  feature: 'node-images', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 6,
  config: { linkDefaultColor: '#3a4658', linkDefaultWidth: 1, linkDefaultArrows: false, linkOpacity: 0.5 },
  onGraph(graph, { N }) {
    const ICONS = COLORS.map((col, i) => iconImageData(col, GLYPHS[i]));
    graph.setImageData(ICONS);
    const idx = new Float32Array(N), sizes = new Float32Array(N), shapes = new Float32Array(N);
    for (let i = 0; i < N; i++) { idx[i] = i % ICONS.length; sizes[i] = 26; shapes[i] = 8; } // 8 = PointShape.None
    graph.setPointShapes(shapes);
    graph.setPointImageIndices(idx);
    graph.setPointImageSizes(sizes);
    graph.render();
  },
});
