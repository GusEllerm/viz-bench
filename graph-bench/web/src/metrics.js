// Tiny metrics HUD: load-stage timings + a rolling FPS meter.
const fmt = (ms) => (ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`);
const num = (n) => n.toLocaleString();

export class Metrics {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this._fpsRunning = false;
  }
  stage(text) { this.$('m-stage').textContent = text; }
  error(e) {
    console.error(e);
    this.$('m-err').textContent = `⚠ ${e?.message || e}`;
    this.$('m-stage').textContent = 'failed';
  }
  report({ nodes, edges, tFetch, tPrep, tInit }) {
    this.$('m-nodes').textContent = num(nodes);
    this.$('m-edges').textContent = num(edges);
    this.$('m-fetch').textContent = fmt(tFetch);
    this.$('m-prep').textContent = fmt(tPrep);
    this.$('m-init').textContent = fmt(tInit);
    this.stage(`loaded — total ${fmt(tFetch + tPrep + tInit)}`);
  }
  startFPS() {
    if (this._fpsRunning) return;
    this._fpsRunning = true;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    let min = Infinity;
    const tick = (t) => {
      frames++;
      acc += t - last;
      last = t;
      if (acc >= 500) {
        const fps = (frames * 1000) / acc;
        if (fps < min) min = fps;
        this.$('m-fps').textContent = `${fps.toFixed(0)} / ${min === Infinity ? '—' : min.toFixed(0)}`;
        frames = 0;
        acc = 0;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
