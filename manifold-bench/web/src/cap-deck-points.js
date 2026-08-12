// deck.gl POINTS / SCATTER capability example (NATIVE) — ScatterplotLayer, the base GPU point
// primitive, over a synthetic seeded scatter. Gate-verified via cap-deck-common.
import { mountDeck } from './cap-deck-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountDeck({
  feature: 'points', primitives: [PRIMITIVE.POINTS], kind: 'points', n: 2000,
  makeLayers({ nodes, L }) {
    return [new L.ScatterplotLayer({
      id: 'pts', data: nodes, getPosition: (d) => d.position, getFillColor: (d) => d.color,
      radiusUnits: 'pixels', getRadius: 3, radiusMinPixels: 1.5,
    })];
  },
});
