// deck.gl NODE-IMAGES capability example (NATIVE) — IconLayer draws a per-node image. Icons are
// PROCEDURALLY GENERATED canvas data-URIs (coloured discs + a glyph), never real avatars
// (copyright + provenance). Synthetic seeded graph; gate-verified via cap-deck-common.
import { mountDeck, makeIcons } from './cap-deck-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const ICONS = makeIcons();
const pick = (id) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return ICONS[Math.abs(h) % ICONS.length]; };

mountDeck({
  feature: 'node-images', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph',
  makeLayers({ nodes, edges, L }) {
    return [
      new L.LineLayer({ id: 'edges', data: edges, getSourcePosition: (d) => d.source, getTargetPosition: (d) => d.target, getColor: [120, 140, 170, 72], getWidth: 1, widthUnits: 'pixels' }),
      new L.IconLayer({
        id: 'icons', data: nodes,
        getIcon: (d) => ({ url: pick(d.id), width: 64, height: 64, anchorY: 32 }),
        getPosition: (d) => d.position, getSize: 36, sizeUnits: 'pixels',
      }),
    ];
  },
});
