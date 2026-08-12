// Sigma.js LAYOUT capability example (WORKAROUND) — Sigma renders but has no layout of its own;
// positions come from the graphology-layout-forceatlas2 CPU companion. Scatters the shared synthetic
// graph to a seeded-random start, computes a fresh force-atlas layout, then Sigma renders it.
import { mountSigma } from './cap-sigma-common.js';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountSigma({
  feature: 'layout', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES],
  decorate(g) {
    // seeded-random scatter (makeGraph ships an already-clustered layout — start from scratch so the
    // force-atlas pass does the real work), then graphology-layout-forceatlas2 (CPU) computes positions.
    let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    g.forEachNode((n) => g.mergeNodeAttributes(n, { x: rnd(), y: rnd() }));
    forceAtlas2.assign(g, { iterations: 400, settings: forceAtlas2.inferSettings(g) });
  },
});
