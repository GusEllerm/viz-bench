// Helios-Web PICK / HOVER-TOOLTIP capability example (NATIVE) — Helios's native onNodeHoverStart
// / onNodeHoverEnd callbacks set window.__bench.lastPick + a #tooltip. Synthetic seeded graph.
// hoverTarget() locates a node's on-screen position via Helios's own picking (pickPoint), scanned
// outward from centre, so the harness can hover a real node deterministically (interaction gate).
import { mountHelios } from './cap-helios-common.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const $ = (id) => document.getElementById(id);
function showTip(html, x, y) { const t = $('tooltip'); if (!t) return; t.innerHTML = html; t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px'; t.style.display = 'block'; }
function hideTip() { const t = $('tooltip'); if (t) t.style.display = 'none'; }
// the hover callback may hand back a node object or a raw index; normalise to a display id.
// makeGraph node keys are already "n0".."n53", so don't double-prefix those.
const nodeLabel = (n) => {
  if (n == null) return 'node';
  const v = typeof n === 'number' ? n : (n.ID ?? n.id ?? n.index ?? n.name ?? n);
  return typeof v === 'string' && v.startsWith('n') ? v : 'n' + v;
};
const isHit = (h) => h != null && h !== false && !(typeof h === 'number' && h < 0);

mountHelios({
  feature: 'pick-tooltip', primitives: [PRIMITIVE.POINTS, PRIMITIVE.LINES], kind: 'graph', nodeSize: 7,
  configure(helios) {
    helios.onNodeHoverStart((node) => { const id = nodeLabel(node); window.__bench.lastPick = id; showTip(`<b>${id}</b>`, window.__bench._hx || 20, window.__bench._hy || 20); });
    helios.onNodeHoverEnd(() => hideTip());
  },
  onReady(helios) {
    Object.assign(window.__bench, {
      lastPick: null,
      // Helios exposes no clean world→screen projection, so use its own picking: spiral out from
      // the view centre until pickPoint reports a node, and return that screen pixel.
      hoverTarget: () => {
        const el = $('view'); const W = el.clientWidth || 1440, H = el.clientHeight || 900;
        for (let i = 0; i < 80; i++) {
          const a = i * 2.3999, rad = (i / 80) * Math.min(W, H) * 0.44;
          const x = Math.round(W / 2 + Math.cos(a) * rad), y = Math.round(H / 2 + Math.sin(a) * rad);
          let hit = null; try { hit = helios.pickPoint(x, y); } catch (e) {}
          if (isHit(hit)) { window.__bench._hx = x; window.__bench._hy = y; return { x, y }; }
        }
        return { x: Math.round(W / 2), y: Math.round(H / 2) };
      },
      clearPick: () => { window.__bench.lastPick = null; hideTip(); },
    });
  },
});
