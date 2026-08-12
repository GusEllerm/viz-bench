// POINT-PARITY PROBE (methodology tool, not a benchmark page): renders a sparse 5×5 grid of
// white points with EXACTLY the settings + camera each point-cloud bench page uses
// (three-pc.js / deck-pc.js / cosmos-pc.js), so a driver can screenshot and count lit pixels
// per point. Answers "are the engines doing comparable per-point raster work at the bench's
// nominal 1.5px?" — raised by the Cosmograph dev (three's points looked smaller).
//   ?engine=three|deck|cosmos   ?size=1.5 (override to test alternatives)
import { installAdapter } from '../../../bench-core/page/contract.js';
import { PRIMITIVE } from '../../../bench-core/page/primitives.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const engine = q.get('engine') || 'three';
const SIZE = parseFloat(q.get('size') || '1.5');

// 25 points on a grid spanning a swiss-roll-like extent (center ~[1.5,10.5,1.5], radius ~10.5),
// laid out in the x/y plane at center z so all sit at near-identical depth from the bench cameras.
const N = 5;
const center = [1.5, 10.5, 1.5], radius = 10.5;
const positions = new Float32Array(N * N * 3);
let k = 0;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    positions[k * 3] = center[0] + ((i / (N - 1)) - 0.5) * radius * 1.2;
    positions[k * 3 + 1] = center[1] + ((j / (N - 1)) - 0.5) * radius * 1.2;
    positions[k * 3 + 2] = center[2];
    k++;
  }
}
const count = N * N;

function done(extra = {}) {
  $('m-stage').textContent = `rendered — ${engine} @ size ${SIZE}`;
  Object.assign(window.__bench, { ready: true, counts: () => ({ points: count }), ...extra });
}

async function run() {
  installAdapter({ tool: engine, feature: 'point-probe', cloud: `synthetic_points_${count}`, primitives: [PRIMITIVE.POINTS], supportsCamera: ['overview'] });
  const view = $('view');
  try {
    if (engine === 'three') {
      const THREE = await import('three');
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      view.appendChild(canvas);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0e1116);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const colors = new Uint8Array(count * 3).fill(255);
      geo.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
      const mat = new THREE.PointsMaterial({ size: SIZE, sizeAttenuation: false, vertexColors: true }); // == three-pc.js
      scene.add(new THREE.Points(geo, mat));
      const W = view.clientWidth || 1440, H = view.clientHeight || 900;
      const c = new THREE.Vector3(...center);
      const camera = new THREE.PerspectiveCamera(50, W / H, Math.max(0.01, radius / 100), radius * 100);
      camera.position.set(center[0] + radius * 2.2, center[1] + radius * 1.3, center[2] + radius * 2.2); // == three-pc place()
      camera.lookAt(c);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); // == three-pc
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H, false);
      const loop = () => { requestAnimationFrame(loop); renderer.render(scene, camera); };
      loop();
      done();
    } else if (engine === 'deck') {
      const [{ Deck, OrbitView, COORDINATE_SYSTEM }, { PointCloudLayer }] = await Promise.all([import('@deck.gl/core'), import('@deck.gl/layers')]);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      view.appendChild(canvas);
      const colors = new Uint8Array(count * 3).fill(255);
      const layer = new PointCloudLayer({
        id: 'probe',
        coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
        data: { length: count, attributes: { getPosition: { value: positions, size: 3 }, getColor: { value: colors, size: 3 } } },
        getNormal: [0, 0, 1],
        pointSize: SIZE, // == deck-pc.js (sizeUnits default 'pixels')
      });
      const W = view.clientWidth || 1440, H = view.clientHeight || 900;
      const zoom = Math.log2(Math.min(W, H) / (radius * 2.2)); // == deck-pc.js
      new Deck({
        canvas, views: new OrbitView({ orbitAxis: 'Y', fovy: 50 }), controller: false,
        initialViewState: { target: center, rotationX: 22, rotationOrbit: 30, zoom },
        layers: [layer],
      });
      done();
    } else if (engine === 'cosmos') {
      const { Graph } = await import('@cosmograph/cosmos');
      const graph = new Graph(view, {
        backgroundColor: '#0e1116',
        spaceDimensions: 3,
        enableSimulation: false,
        rescalePositions: false,
        fitViewOnInit: false,
        pointDefaultSize: SIZE, // == cosmos-pc.js
        cameraNear: Math.max(0.01, radius / 100),
        cameraFar: radius * 100,
      });
      graph.setPointPositions(positions, { dimensions: 3 });
      const rgba = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) rgba.set([1, 1, 1, 1], i * 4);
      graph.setPointColors(rgba);
      graph.render();
      await graph.ready;
      graph.setCameraState({ target: center, distance: radius * 3.4, azimuth: 0.6, polar: 1.15 }, 0); // == cosmos-pc.js overview
      done({ graph });
    }
  } catch (e) {
    $('m-stage').textContent = 'failed';
    $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}
run();
