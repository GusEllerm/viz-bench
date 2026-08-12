// deck.gl CURVED-EDGES capability example (NATIVE) — PathLayer fed quadratic-bezier paths (each
// edge bowed by a perpendicular midpoint offset), deck's native way to draw curved 2D links.
// (ArcLayer is the 3D-arc alternative, but its bow is in z — invisible top-down in this
// OrthographicView.) Synthetic seeded graph; gate-verified via cap-deck-common.
import { mountDeck } from './cap-deck-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

// quadratic bezier from s→t with the control point offset perpendicular to the chord
function curve(s, t, k = 0.2, seg = 16) {
  const mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2;
  const dx = t[0] - s[0], dy = t[1] - s[1];
  const cx = mx - dy * k, cy = my + dx * k;
  const pts = [];
  for (let i = 0; i <= seg; i++) { const u = i / seg, v = 1 - u; pts.push([v * v * s[0] + 2 * v * u * cx + u * u * t[0], v * v * s[1] + 2 * v * u * cy + u * u * t[1]]); }
  return pts;
}

mountDeck({
  feature: 'curved-edges', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph',
  makeLayers({ nodes, edges, L }) {
    const paths = edges.map((e) => ({ path: curve(e.source, e.target) }));
    return [
      new L.PathLayer({ id: 'curves', data: paths, getPath: (d) => d.path, getColor: [150, 172, 205, 205], getWidth: 1.6, widthUnits: 'pixels', capRounded: true, jointRounded: true }),
      new L.ScatterplotLayer({ id: 'nodes', data: nodes, getPosition: (d) => d.position, getFillColor: (d) => d.color, radiusUnits: 'pixels', getRadius: 5 }),
    ];
  },
});
