// cosmos.gl LAYOUT capability example (NATIVE) — cosmos runs the force simulation on the GPU
// (enableSimulation). The scaffold starts from a seeded-random scatter, lets the GPU sim organise the
// shared synthetic graph, then freezes + re-fits so the screenshot shows the computed layout.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountCosmos({ feature: 'layout', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], layout: true });
