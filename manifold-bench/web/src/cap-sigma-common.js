// Shared Sigma.js scaffold for the capability examples — a Sigma instance over the SYNTHETIC
// seeded graph (randomgraph.js) plus the full bench-core contract (counts / setCamera / orbit /
// fitView). Each example supplies `decorate(graph, {nodes, edges})` to style the graph for its
// feature (mute edges for points, thicken edges for lines, show labels for labels …) and any
// Sigma `settings`. Mounts into #view. Public-safe: synthetic data only.
import Sigma from 'sigma';
import Graph from 'graphology';
import { makeGraph } from './randomgraph.js';
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

// cloud:true → a dense NODE cloud (from makePoints, no edges) instead of the 54-node graph, for
// the point-scatter features (e.g. the density workaround). Coverage then counts points, not edges.
export function mountSigma({ feature, primitives, settings = {}, decorate, cloud = false, n = 2000 }) {
  let camState = 'overview';
  installAdapter({ tool: 'sigma', feature, primitives, supportsCamera: ['overview', 'mid', 'deep'] });
  try {
    const view = $('view');
    const t0 = performance.now();
    let g, nodes, edges, pts = null, countsFn;
    if (cloud) {
      g = new Graph();
      pts = makePoints({ n, seed: 8 });
      for (let i = 0; i < pts.n; i++) g.addNode(String(i), { x: pts.positions[i * 3], y: pts.positions[i * 3 + 2], size: 3, color: '#8899aa' });
      nodes = pts.n; edges = 0;
      countsFn = () => ({ points: g.order });
    } else {
      const mg = makeGraph(); g = mg.graph; nodes = mg.nodes; edges = mg.edges;
      countsFn = () => ({ nodes: g.order, edges: g.size });
    }
    if (decorate) decorate(g, { nodes, edges, pts });
    const renderer = new Sigma(g, view, { minCameraRatio: 0.05, maxCameraRatio: 2, ...settings });
    const tInit = performance.now() - t0;

    if ($('m-points')) $('m-points').textContent = nodes;
    if ($('m-nodes')) $('m-nodes').textContent = nodes;
    if ($('m-edges')) $('m-edges').textContent = edges;
    if ($('m-load')) $('m-load').textContent = `${tInit.toFixed(0)} ms`;
    if ($('m-stage')) $('m-stage').textContent = `rendered — ${tInit.toFixed(0)} ms`;
    startFPS();

    Object.assign(window.__bench, {
      ready: true,
      timings: { nodes, edges, points: nodes, tInit },
      settled: true, tSettle: 0,
      pauseLayout: () => { window.__bench.paused = true; },
      fitView: () => { try { renderer.getCamera().animatedReset({ duration: 0 }); } catch (e) {} },
      counts: countsFn,
      cameraState: () => camState,
      setCamera: (s) => {
        try {
          const cam = renderer.getCamera();
          if (s === 'overview') cam.animatedReset({ duration: 300 });
          else cam.animate({ ratio: s === 'deep' ? 0.2 : 0.45 }, { duration: 300 });
          camState = s;
        } catch (e) {}
      },
      orbit: (ms) => {
        const cam = renderer.getCamera();
        const base = cam.getState();
        const t = performance.now();
        const step = () => {
          const dt = performance.now() - t;
          try { cam.setState({ ...base, ratio: 0.85 + 0.12 * Math.sin(dt / 380), angle: (base.angle || 0) + dt / 4000 }); } catch (e) {}
          if (dt < ms) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      renderer,
    });
  } catch (e) {
    if ($('m-stage')) $('m-stage').textContent = 'failed';
    if ($('m-err')) $('m-err').textContent = '⚠ ' + (e?.message || e);
    if (window.__bench) window.__bench.error = String(e?.message || e);
  }
}
