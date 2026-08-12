// deck.gl LABELS capability example (NATIVE) — TextLayer renders per-node text (SDF font atlas)
// above each node, with a ScatterplotLayer beneath. Synthetic seeded graph; the labels re-place
// on zoom, a spatial change the presentation gate confirms. Gate-verified via cap-deck-common.
import { mountDeck } from './cap-deck-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountDeck({
  feature: 'labels', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph',
  makeLayers({ nodes, edges, L }) {
    return [
      new L.LineLayer({ id: 'edges', data: edges, getSourcePosition: (d) => d.source, getTargetPosition: (d) => d.target, getColor: [90, 106, 130, 120], getWidth: 1, widthUnits: 'pixels' }),
      new L.ScatterplotLayer({ id: 'nodes', data: nodes, getPosition: (d) => d.position, getFillColor: (d) => d.color, radiusUnits: 'pixels', getRadius: 6 }),
      new L.TextLayer({
        id: 'labels', data: nodes, getPosition: (d) => d.position, getText: (d) => d.label,
        getSize: 13, getColor: [230, 237, 246], getPixelOffset: [0, -13],
        fontFamily: '-apple-system, system-ui, sans-serif', getTextAnchor: 'middle', getAlignmentBaseline: 'center',
      }),
    ];
  },
});
