// three.js point-cloud bench — THREE.Points (one BufferGeometry, binary position +
// normalized Uint8 colour attributes) with OrbitControls. Continuous render loop, so the
// harness's orbit/zoom measures full-scene render throughput. Same __bench contract as deck.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './loadcloud.js';
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const view = document.getElementById('view');
const $ = (id) => document.getElementById(id);
let renderer = null, scene = null, camera = null, controls = null, raf = 0, canvas = null;

const fmt = (ms) => (ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`);
const stage = (t) => { $('m-stage').textContent = t; };
function report(name, n, tFetch, tInit) {
  $('m-cloud').textContent = name; $('m-points').textContent = n.toLocaleString();
  $('m-load').textContent = fmt(tFetch + tInit); stage(`loaded — ${fmt(tFetch + tInit)}`);
}
function startFPS() {
  let last = performance.now(), frames = 0, acc = 0, min = Infinity;
  const tick = (t) => {
    frames++; acc += t - last; last = t;
    if (acc >= 500) { const f = (frames * 1000) / acc; if (f < min) min = f;
      $('m-fps').textContent = `${f.toFixed(0)} / ${min === Infinity ? '—' : min.toFixed(0)}`; frames = 0; acc = 0; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function run(base) {
  let camState = 'overview';
  installAdapter({ tool: 'three', cloud: base, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    if (raf) cancelAnimationFrame(raf);
    if (renderer) { renderer.dispose(); }
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }

    stage('loading manifest…');
    const t0 = performance.now();
    const man = await loadManifest();
    const entry = pickCloud(man, base);
    const { n, positions, colors, center, radius, name } = await loadCloud(entry);
    const tFetch = performance.now() - t0;

    stage('building scene…');
    const t1 = performance.now();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1116);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true)); // normalized → 0..1
    const probeSize = parseFloat(new URLSearchParams(location.search).get('size') || '1.5'); // parity-probe override; bench default 1.5
    const mat = new THREE.PointsMaterial({ size: probeSize, sizeAttenuation: false, vertexColors: true });
    scene.add(new THREE.Points(geo, mat));

    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const c = new THREE.Vector3(center[0], center[1], center[2]);
    camera = new THREE.PerspectiveCamera(50, W / H, Math.max(0.01, radius / 100), radius * 100);
    const place = () => { camera.position.set(center[0] + radius * 2.2, center[1] + radius * 1.3, center[2] + radius * 2.2); camera.lookAt(c); };
    place();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    controls = new OrbitControls(camera, canvas);
    controls.target.copy(c); controls.update();
    const tInit = performance.now() - t1;

    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();

    report(name, n, tFetch, tInit);
    startFPS();
    Object.assign(window.__bench, {
      ready: true,
      timings: { n, points: n, tFetch, tPrep: 0, tInit },
      settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },   // continuous render loop stays on
      fitView: () => { place(); controls.target.copy(c); controls.update(); },
      counts: () => ({ points: n }),
      cameraState: () => camState,
      // overview = place() distance; mid/deep dolly the camera closer to the cloud centre.
      setCamera: (s) => {
        try {
          const d = s === 'deep' ? radius * 0.5 : s === 'mid' ? radius * 1.1 : radius * 2.2;
          camera.position.set(center[0] + d, center[1] + d * 0.6, center[2] + d);
          camera.lookAt(c); controls.target.copy(c); controls.update();
          camState = s;
        } catch (e) {}
      },
      // continuous orbit via OrbitControls.autoRotate; the render loop's controls.update()
      // advances it each frame → FPS measures continuous render throughput under motion.
      orbit: (ms) => {
        controls.autoRotate = true; controls.autoRotateSpeed = 2.2;
        setTimeout(() => { controls.autoRotate = false; }, ms);
      },
    });
  } catch (e) {
    stage('failed'); $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}

run(cloudParam() || 'swiss_roll_1000000');
