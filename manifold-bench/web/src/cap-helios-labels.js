// Helios-Web LABELS capability example (NATIVE) — Helios's built-in label tracker. trackAttribute
// runs a GPU tracking pass that selects which nodes to label and computes each one's on-screen
// centroid (client pixels); the onTrack callback is Helios's intended extension point where you
// place the label DOM. So the label SELECTION + POSITIONING is native Helios; we only append the
// spans. Synthetic seeded graph; the labels re-place on zoom (presentation gate). Via cap-helios-common.
import { mountHelios } from './cap-helios-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const $ = (id) => document.getElementById(id);

mountHelios({
  feature: 'labels', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 7,
  onReady(helios) {
    const view = $('view');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    view.appendChild(overlay);
    const spans = new Map();
    const H = () => view.clientHeight || 900;
    // Helios native label tracking (tracking buffer is on by default). maxLabels:-1 → all nodes;
    // calculateCentroid → each entry is [index, proportion, x, y] with x,y in client pixels.
    helios.trackAttribute('labels', 'index', {
      maxLabels: -1, calculateCentroid: true,
      onTrack: (tracked) => {
        // Hide every span first, then re-show only the currently-tracked nodes. Without this, a
        // node that appears in an early frame at a transitional centroid and then drops out of
        // the tracked set leaves a stale label stranded in empty space.
        for (const s of spans.values()) s.style.display = 'none';
        const maxProp = tracked.reduce((mx, e) => Math.max(mx, e[1] || 0), 0);
        for (const entry of tracked) {
          const id = entry[0], x = entry[2], y = entry[3];
          if (x == null || y == null) continue;
          if ((entry[1] || 0) < maxProp * 0.1) continue; // skip barely-tracked (unstable centroid)
          let span = spans.get(id);
          if (!span) {
            span = document.createElement('span');
            span.textContent = 'n' + id;
            span.style.cssText = 'position:absolute;transform:translate(-50%,-165%);color:#e6edf6;font:12px -apple-system,system-ui,sans-serif;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap';
            overlay.appendChild(span); spans.set(id, span);
          }
          // Helios framebuffer rows run bottom-up → flip Y to top-left screen origin.
          span.style.left = x + 'px'; span.style.top = (H() - y) + 'px'; span.style.display = 'block';
        }
      },
    });
  },
});
