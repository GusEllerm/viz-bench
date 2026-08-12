// cosmos.gl CURVED-EDGES capability example (NATIVE) — the curvedLinks config bows each link
// (GPU-tessellated bezier). Synthetic seeded graph; gate-verified via cap-cosmos-common.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountCosmos({
  feature: 'curved-edges', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 5,
  config: {
    curvedLinks: true, curvedLinkSegments: 24, curvedLinkControlPointDistance: 0.5, curvedLinkWeight: 0.6,
    linkDefaultColor: '#8aa6cd', linkDefaultWidth: 1.4, linkDefaultArrows: false, linkOpacity: 0.85,
  },
});
