// cosmos.gl PICK / HOVER-TOOLTIP capability example (NATIVE) — the engine's onPointMouseOver /
// onPointMouseOut hover callbacks set window.__bench.lastPick + a #tooltip. Synthetic seeded
// graph. hoverTarget() reports a node's screen position via trackPointPositionsByIndices +
// spaceToScreenPosition, so the harness can hover it deterministically (interaction gate).
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const $ = (id) => document.getElementById(id);
function showTip(html, x, y) { const t = $('tooltip'); if (!t) return; t.innerHTML = html; t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px'; t.style.display = 'block'; }
function hideTip() { const t = $('tooltip'); if (t) t.style.display = 'none'; }

// index → {x,y} screen pixels (via the engine's tracked space position + projection)
function screenOf(index) {
  try {
    const g = window.__bench.graph;
    const sp = g.getTrackedPointPositionsMap().get(index);
    if (!sp) return null;
    const [x, y] = g.spaceToScreenPosition([sp[0], sp[1]]);
    return { x, y };
  } catch (e) { return null; }
}

let TARGET = 0;

mountCosmos({
  feature: 'pick-tooltip', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 7,
  config: {
    linkDefaultColor: '#44526a', linkDefaultWidth: 1, linkDefaultArrows: false,
    onPointMouseOver: (index) => { window.__bench.lastPick = 'n' + index; const p = screenOf(index); showTip(`<b>n${index}</b>`, p ? p.x : 20, p ? p.y : 20); },
    onPointMouseOut: () => hideTip(),
  },
  onGraph: (graph, { N }) => {
    TARGET = Math.floor(N / 2);
    const idxs = []; for (let i = 0; i < N; i++) idxs.push(i);
    graph.trackPointPositionsByIndices(idxs); // all nodes → any hovered index has a position
    graph.render();
    Object.assign(window.__bench, {
      lastPick: null,
      hoverTarget: () => screenOf(TARGET) || { x: 20, y: 20 },
      clearPick: () => { window.__bench.lastPick = null; hideTip(); },
    });
  },
});
