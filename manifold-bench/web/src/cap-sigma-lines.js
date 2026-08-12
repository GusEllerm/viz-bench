// Sigma.js LINES / EDGES capability example (NATIVE) — Sigma's default edge program draws the
// graph's links with per-edge width + colour. Edges are foregrounded, nodes muted, so the render
// reads as "edges". Synthetic seeded graph; gate-verified via cap-sigma-common.
import { mountSigma } from './cap-sigma-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountSigma({
  feature: 'lines', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES],
  settings: { labelRenderedSizeThreshold: 999 },
  decorate(g) {
    g.forEachNode((nd) => g.setNodeAttribute(nd, 'size', 6));
    g.forEachEdge((e) => { g.setEdgeAttribute(e, 'color', 'rgba(150,172,205,0.8)'); g.setEdgeAttribute(e, 'size', 2.2); });
  },
});
