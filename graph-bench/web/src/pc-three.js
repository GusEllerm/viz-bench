// three.js point-cloud example (demo site) — THREE.Points with OrbitControls.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadManifest, pickCloud, loadCloud, cloudParam } from './pc-load.js';

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
  try {
    if (raf) cancelAnimationFrame(raf);
    if (renderer) renderer.dispose();
    if (!canvas) { canvas = document.createElement('canvas'); canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; view.appendChild(canvas); }
    stage('loading manifest…');
    const t0 = performance.now();
    const man = await loadManifest();
    const { n, positions, colors, center, radius, name } = await loadCloud(pickCloud(man, base));
    const tFetch = performance.now() - t0;

    stage('building scene…');
    const t1 = performance.now();
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e1116);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true })));
    const W = view.clientWidth || 1440, H = view.clientHeight || 900;
    const c = new THREE.Vector3(center[0], center[1], center[2]);
    camera = new THREE.PerspectiveCamera(50, W / H, Math.max(0.01, radius / 100), radius * 100);
    const place = () => { camera.position.set(center[0] + radius * 2.2, center[1] + radius * 1.3, center[2] + radius * 2.2); camera.lookAt(c); };
    place();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(W, H, false);
    controls = new OrbitControls(camera, canvas); controls.target.copy(c); controls.update();
    const tInit = performance.now() - t1;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    loop();
    report(name, n, tFetch, tInit);
    startFPS();
  } catch (e) { stage('failed'); $('m-err').textContent = '⚠ ' + (e?.message || e); }
}
run(cloudParam() || 'graph_combined_umap3');
