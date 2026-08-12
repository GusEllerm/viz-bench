// Helios-Web DENSITY MAP capability example (NATIVE) — Helios's built-in density plot. The
// constructor option `density:true` spins up a DensityGL kernel-density-estimation pass (GPU
// screen-space aggregation of the points into a smooth field — the "where is it dense" view,
// the same class of thing as deck.gl's HeatmapLayer). Synthetic point cloud; the field
// re-aggregates on zoom (presentation gate). Via cap-helios-common.
import { mountHelios } from './cap-helios-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountHelios({
  feature: 'density-map', primitives: [PRIMITIVE.DENSITY], kind: 'points', n: 4000, nodeSize: 1,
  pointsChain: true,            // give nodes a degree so the density plot has weight (see cap-helios-common)
  heliosOpts: { density: true },
  configure(helios) {
    try { helios.edgesGlobalOpacityScale(0); } catch (e) {} // hide the chain edges → clean density field
    try { helios.nodesGlobalSizeScale(0.18); } catch (e) {} // faint reference points; the density field is the star
  },
  onReady(helios) {
    // feed the DensityGL map the point positions + weights, then draw it (density:true alone
    // creates the map but does not populate/redraw it). Brighten + widen the kernel so the field reads.
    try {
      helios.densityMap?.setKernelWeightScale(0.05);
      helios.densityMap?.setBandwidth(16);
      helios.updateDensityMap();
      helios.render();
    } catch (e) {}
  },
});
