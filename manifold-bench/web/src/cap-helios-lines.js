// Helios-Web LINES / EDGES capability example (NATIVE) — WebGL edge rendering over the synthetic
// seeded graph (edges passed to the Helios constructor). Gate-verified via cap-helios-common.
import { mountHelios } from './cap-helios-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountHelios({ feature: 'lines', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 4 });
