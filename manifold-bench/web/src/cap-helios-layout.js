// Helios-Web LAYOUT capability example (NATIVE) — Helios's built-in force-directed layout
// (autoStartLayout). The scaffold scatters to a seeded-random start, lets the layout settle, then
// freezes + goes ready so the screenshot shows the computed layout.
import { mountHelios } from './cap-helios-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

// Helios's default d3-force over-contracts a 54-node graph (nodes pile into a clump). It exposes the
// underlying d3 forces, so boost node-node repulsion and relax the centre pull so the layout spreads
// legibly; scatterStart:false starts from the clustered positions and lets the force pass refine them.
mountHelios({
  feature: 'layout', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], layout: true, scatterStart: false, settleMs: 2600,
  configure(helios) {
    try {
      if (helios.repulsiveforce?.strength) helios.repulsiveforce.strength(-2400);
      if (helios.gravityForce?.strength) helios.gravityForce.strength(0.006);
      helios.simulation?.alpha?.(1)?.restart?.();
    } catch (e) {}
  },
});
