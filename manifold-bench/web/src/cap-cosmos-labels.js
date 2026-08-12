// cosmos.gl LABELS capability example (WORKAROUND) — the bare engine has no text primitive, so
// labels are an HTML overlay: track every node's position (trackPointPositionsByIndices), project
// to screen each frame (spaceToScreenPosition), and place a <span> per node. This is exactly the
// pattern the Cosmograph wrapper packages as its "labels" feature. The overlay re-places on zoom,
// a spatial change the presentation gate confirms. Synthetic seeded graph; via cap-cosmos-common.
import { mountCosmos } from './cap-cosmos-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

mountCosmos({
  feature: 'labels', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 5,
  config: { linkDefaultColor: '#3a4658', linkDefaultWidth: 1, linkDefaultArrows: false, linkOpacity: 0.7 },
  onGraph: (graph, { N, nodeList, view }) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    view.appendChild(overlay);
    const spans = [];
    for (let i = 0; i < N; i++) {
      const s = document.createElement('span');
      s.textContent = nodeList[i].label;
      s.style.cssText = 'position:absolute;transform:translate(-50%,-165%);color:#e6edf6;font:12px -apple-system,system-ui,sans-serif;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap;display:none';
      overlay.appendChild(s); spans.push(s);
    }
    const idxs = []; for (let i = 0; i < N; i++) idxs.push(i);
    graph.trackPointPositionsByIndices(idxs);
    graph.render();
    const loop = () => {
      try {
        const m = graph.getTrackedPointPositionsMap();
        for (let i = 0; i < N; i++) {
          const sp = m.get(i);
          if (sp) { const [x, y] = graph.spaceToScreenPosition([sp[0], sp[1]]); spans[i].style.left = x + 'px'; spans[i].style.top = y + 'px'; spans[i].style.display = 'block'; }
        }
      } catch (e) {}
      requestAnimationFrame(loop);
    };
    loop();
  },
});
