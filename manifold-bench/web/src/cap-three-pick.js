// three.js PICK / HOVER-TOOLTIP capability example (WORKAROUND) — three has no built-in picking,
// so a THREE.Raycaster on mousemove intersects the points → window.__bench.lastPick + a #tooltip.
// Synthetic points. The harness hovers hoverTarget() and asserts the pick fired (interaction gate).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const N = 30;
const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let renderer = null, scene = null, camera = null, controls = null, raf = 0, canvas = null, points = null, positions = null;

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
function showTip(html, x, y) { const t = $('tooltip'); if (!t) return; t.innerHTML = html; t.style.left = (x + 14) + 'px'; t.style.top = (y + 14) + 'px'; t.style.display = 'block'; }
function hideTip() { const t = $('tooltip'); if (t) t.style.display = 'none'; }
function projectIndex(i) {
  const v = new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).project(camera);
  const r = canvas.getBoundingClientRect();
  return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height];
}

function run() {
  let camState = 'overview';
  installAdapter({ tool: 'three', feature: 'pick-tooltip', cloud: `synthetic_points_${N}`, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (raf) cancelAnimationFrame(raf);
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }

    const pts = makePoints({ n: N, seed: 6 });
    positions = pts.positions;
    const { colors, center, radius } = pts;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e1116);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    points = new THREE.Points(geo, new THREE.PointsMaterial({ size: radius * 0.12, sizeAttenuation: true, vertexColors: true }));
    scene.add(points);

    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const c = new THREE.Vector3(center[0], center[1], center[2]);
    camera = new THREE.PerspectiveCamera(50, W / H, Math.max(0.01, radius / 100), radius * 100);
    const place = () => { camera.position.set(center[0] + radius * 1.9, center[1] + radius * 1.1, center[2] + radius * 1.9); camera.lookAt(c); };
    place();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(W, H, false);
    controls = new OrbitControls(camera, canvas); controls.target.copy(c); controls.update();

    const ray = new THREE.Raycaster(); ray.params.Points.threshold = radius * 0.1;
    const doPick = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      const mx = ((clientX - r.left) / r.width) * 2 - 1, my = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera({ x: mx, y: my }, camera);
      const hits = ray.intersectObject(points);
      if (hits.length) { const i = hits[0].index; window.__bench.lastPick = `n${i}`; showTip(`<b>n${i}</b>`, clientX - r.left, clientY - r.top); return true; }
      hideTip(); return false;
    };
    canvas.addEventListener('mousemove', (e) => doPick(e.clientX, e.clientY));

    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();

    if ($('m-points')) $('m-points').textContent = N; if ($('m-stage')) $('m-stage').textContent = 'rendered';
    startFPS();
    Object.assign(window.__bench, {
      ready: true, timings: { points: N }, settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { place(); controls.target.copy(c); controls.update(); },
      counts: () => ({ points: N }),
      cameraState: () => camState,
      setCamera: (s) => {
        try { const d = s === 'deep' ? radius * 0.5 : s === 'mid' ? radius * 1.0 : radius * 1.9; camera.position.set(center[0] + d, center[1] + d * 0.58, center[2] + d); camera.lookAt(c); controls.target.copy(c); controls.update(); camState = s; } catch (e) {}
      },
      orbit: (ms) => { controls.autoRotate = true; controls.autoRotateSpeed = 2.2; setTimeout(() => { controls.autoRotate = false; }, ms); },
      lastPick: null,
      hoverTarget: () => { const [x, y] = projectIndex(Math.floor(N / 2)); return { x, y }; },
      clearPick: () => { window.__bench.lastPick = null; hideTip(); },
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed'; if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

run();
