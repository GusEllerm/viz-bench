// deck.gl PICK / HOVER-TOOLTIP capability example (NATIVE) — ScatterplotLayer with pickable:true
// + onHover → sets window.__bench.lastPick and shows a #tooltip. Synthetic points. The harness
// dispatches a synthetic hover at hoverTarget() and asserts the pick fired (the interaction gate).
import { Deck, OrthographicView } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const N = 24;
const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let deck = null, canvas = null, DATA = [];

function startFPS() {
  let last = performance.now(), frames = 0, acc = 0, min = Infinity;
  const tick = (t) => {
    frames++; acc += t - last; last = t;
    if (acc >= 500) { const f = (frames * 1000) / acc; if (f < min) min = f;
      if ($('m-fps')) $('m-fps').textContent = `${f.toFixed(0)} / ${min === Infinity ? '—' : min.toFixed(0)}`; frames = 0; acc = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function showTip(obj, x, y) {
  const t = $('tooltip'); if (!t) return;
  t.innerHTML = `<b>${obj.id}</b> · value ${obj.value}`;
  t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px'; t.style.display = 'block';
}
function hideTip() { const t = $('tooltip'); if (t) t.style.display = 'none'; }

function run() {
  let camState = 'overview';
  installAdapter({ tool: 'deck', feature: 'pick-tooltip', cloud: `synthetic_points_${N}`, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (deck) { try { deck.finalize(); } catch (e) {} deck = null; }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }

    const { positions, colors, center, radius } = makePoints({ n: N, seed: 4 });
    DATA = [];
    for (let i = 0; i < N; i++) DATA.push({ id: `n${i}`, position: [positions[i * 3], positions[i * 3 + 2]], value: Math.round(positions[i * 3 + 1] * 100) / 100, color: [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]] });
    const cx = center[0], cz = center[2];

    const layer = new ScatterplotLayer({
      id: 'pts', data: DATA, pickable: true,
      getPosition: (d) => d.position, radiusUnits: 'pixels', getRadius: 18,
      getFillColor: (d) => d.color, stroked: true, getLineColor: [230, 237, 246], lineWidthUnits: 'pixels', getLineWidth: 2,
    });
    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const zoom = Math.log2(Math.min(W, H) / (radius * 2.6));
    const setView = (z, td = 0) => deck.setProps({ initialViewState: { target: [cx, cz, 0], zoom: z, transitionDuration: td } });

    deck = new Deck({
      canvas, views: new OrthographicView(), controller: true,
      initialViewState: { target: [cx, cz, 0], zoom },
      layers: [layer],
      onHover: ({ object, x, y }) => { if (object) { window.__bench.lastPick = object.id; showTip(object, x, y); } else hideTip(); },
    });

    if ($('m-points')) $('m-points').textContent = N; if ($('m-stage')) $('m-stage').textContent = 'rendered';
    startFPS();
    Object.assign(window.__bench, {
      ready: true, timings: { points: N }, settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { setView(zoom); } catch (e) {} },
      counts: () => ({ points: N }),
      cameraState: () => camState,
      setCamera: (s) => { try { setView(s === 'deep' ? zoom + 2.5 : s === 'mid' ? zoom + 1.3 : zoom, 300); camState = s; } catch (e) {} },
      orbit: (ms) => { const t = performance.now(); const step = () => { const dt = performance.now() - t; try { setView(zoom + 0.8 * Math.sin(dt / 380)); } catch (e) {} if (dt < ms) requestAnimationFrame(step); }; requestAnimationFrame(step); },
      // interaction contract: the pick callback sets lastPick; hoverTarget is a pickable point's
      // screen position (via the deck viewport), so the harness can hover it deterministically.
      lastPick: null,
      hoverTarget: () => { const vp = deck.getViewports()[0]; const p = DATA[Math.floor(N / 2)]; const [sx, sy] = vp.project(p.position); return { x: sx, y: sy }; },
      clearPick: () => { window.__bench.lastPick = null; hideTip(); },
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed'; if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

run();
