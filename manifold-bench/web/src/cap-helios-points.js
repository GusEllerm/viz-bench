// Helios-Web POINTS / SCATTER capability example (NATIVE) — typed-array node rendering over a
// synthetic scatter (no edges). Gate-verified via cap-helios-common.
import { mountHelios } from './cap-helios-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountHelios({ feature: 'points', primitives: [PRIMITIVE.POINTS], kind: 'points', n: 2000, nodeSize: 3 });
