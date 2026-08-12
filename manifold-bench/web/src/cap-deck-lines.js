// deck.gl LINES / EDGES capability example (NATIVE) — LineLayer draws the graph's links as
// straight GPU segments; a ScatterplotLayer marks the nodes. Synthetic seeded graph;
// gate-verified via cap-deck-common.
import { mountDeck } from './cap-deck-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountDeck({
  feature: 'lines', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph',
  makeLayers({ nodes, edges, L }) {
    return [
      new L.LineLayer({ id: 'edges', data: edges, getSourcePosition: (d) => d.source, getTargetPosition: (d) => d.target, getColor: [150, 172, 205, 205], getWidth: 1.5, widthUnits: 'pixels' }),
      new L.ScatterplotLayer({ id: 'nodes', data: nodes, getPosition: (d) => d.position, getFillColor: (d) => d.color, radiusUnits: 'pixels', getRadius: 5 }),
    ];
  },
});
