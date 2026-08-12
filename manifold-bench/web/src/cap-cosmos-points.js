// cosmos.gl POINTS / SCATTER capability example (NATIVE) — the bare @cosmos.gl/graph engine
// rendering a synthetic point scatter (setPointPositions/Colors/Sizes, no links). Gate-verified
// via cap-cosmos-common.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountCosmos({ feature: 'points', primitives: [PRIMITIVE.POINTS], kind: 'points', n: 2000, nodeSize: 3 });
