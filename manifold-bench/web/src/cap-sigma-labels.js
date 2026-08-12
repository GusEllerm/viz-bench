// Sigma.js LABELS capability example (NATIVE) — Sigma's built-in node labels with the LOD
// threshold lowered so every node labels (labelRenderedSizeThreshold:0) and a light label colour
// for the dark theme (the default label colour is black → invisible here). Synthetic seeded
// graph; the labels re-layout on zoom, a spatial change the presentation gate confirms.
import { mountSigma } from './cap-sigma-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountSigma({
  feature: 'labels', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES],
  settings: {
    renderLabels: true,
    labelRenderedSizeThreshold: 0, // no size-based hiding (forceLabel bypasses it anyway)
    labelDensity: 6, // generous per-cell budget so the grid doesn't cull labels
    labelColor: { color: '#e6edf6' }, // light — default is black, invisible on #0e1116
    labelFont: '-apple-system, system-ui, sans-serif', labelSize: 13,
  },
  decorate(g) {
    // forceLabel:true → sigma always renders this node's label (past both the grid + the size
    // threshold), so every node labels. Label text itself comes from makeGraph.
    g.forEachNode((nd) => { g.setNodeAttribute(nd, 'size', 9); g.setNodeAttribute(nd, 'forceLabel', true); });
    g.forEachEdge((e) => g.setEdgeAttribute(e, 'color', 'rgba(120,140,170,0.28)'));
  },
});
