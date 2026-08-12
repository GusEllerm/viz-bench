// Shared three.js scaffold for the capability examples — Scene / PerspectiveCamera /
// WebGLRenderer / OrbitControls / continuous loop + the full bench-core contract, ported from
// three-pc.js. Each example supplies a `build(scene, THREE, data)` that adds its feature-specific
// objects over the shared synthetic 3D point set (randompoints3d.js). Mounts into #view.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makePoints } from './randompoints3d.js';
import { installAdapter } from '../../../bench-core/page/contract.js';

const $ = (id) => document.getElementById(id);

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

export { THREE };

// a soft round sprite texture (white; tint per-point via vertex colours)
export function roundDisc() {
  const s = 48, c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.65, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
  return new THREE.CanvasTexture(c);
}

export function mountThree({ feature, primitives, points = 4000, edges = 0, seed = 11, build }) {
  let camState = 'overview';
  const cloud = `synthetic_points_${points}`;
  installAdapter({ tool: 'three', feature, cloud, primitives, supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const view = $('view');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    view.appendChild(canvas);

    const t0 = performance.now();
    const data = makePoints({ n: points, edges, seed });
    const { n, center, radius } = data;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e1116);
    build(scene, THREE, data);

    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const c = new THREE.Vector3(center[0], center[1], center[2]);
    const camera = new THREE.PerspectiveCamera(50, W / H, Math.max(0.01, radius / 100), radius * 100);
    const place = () => { camera.position.set(center[0] + radius * 1.9, center[1] + radius * 1.1, center[2] + radius * 1.9); camera.lookAt(c); };
    place();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(W, H, false);
    const controls = new OrbitControls(camera, canvas); controls.target.copy(c); controls.update();
    const tInit = performance.now() - t0;

    const loop = () => { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();

    if ($('m-points')) $('m-points').textContent = n.toLocaleString();
    if ($('m-load')) $('m-load').textContent = `${tInit.toFixed(0)} ms`;
    if ($('m-stage')) $('m-stage').textContent = `rendered — ${tInit.toFixed(0)} ms`;
    startFPS();

    Object.assign(window.__bench, {
      ready: true, timings: { points: n, tInit }, settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { place(); controls.target.copy(c); controls.update(); },
      counts: () => ({ points: n }),
      cameraState: () => camState,
      setCamera: (s) => {
        try {
          const d = s === 'deep' ? radius * 0.5 : s === 'mid' ? radius * 1.0 : radius * 1.9;
          camera.position.set(center[0] + d, center[1] + d * 0.58, center[2] + d);
          camera.lookAt(c); controls.target.copy(c); controls.update();
          camState = s;
        } catch (e) {}
      },
      orbit: (ms) => { controls.autoRotate = true; controls.autoRotateSpeed = 2.2; setTimeout(() => { controls.autoRotate = false; }, ms); },
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed';
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}
