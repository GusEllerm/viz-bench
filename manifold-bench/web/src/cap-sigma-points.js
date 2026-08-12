// Sigma.js POINTS / SCATTER capability example (NATIVE) — nodes are Sigma's base primitive.
// Edges hidden so the render reads as a pure point scatter; still a real graph underneath, so
// coverage is an exact node/edge check. Synthetic seeded graph. Gate-verified via cap-sigma-common.
import { mountSigma } from './cap-sigma-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountSigma({
  feature: 'points', primitives: [PRIMITIVE.POINTS],
  settings: { labelRenderedSizeThreshold: 999 }, // no labels — pure points
  decorate(g) {
    g.forEachNode((nd) => g.setNodeAttribute(nd, 'size', 11));
    g.forEachEdge((e) => g.setEdgeAttribute(e, 'hidden', true)); // scatter only
  },
});
