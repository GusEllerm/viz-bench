// cosmos.gl LINES / EDGES capability example (NATIVE) — GPU link rendering (setLinks) over the
// synthetic seeded graph. Straight links, arrows off. Gate-verified via cap-cosmos-common.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountCosmos({
  feature: 'lines', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 5,
  config: { linkDefaultColor: '#8aa6cd', linkDefaultWidth: 1.4, linkDefaultArrows: false, linkOpacity: 0.8 },
});
