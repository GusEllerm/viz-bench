// The benchmark adapter contract. Every page exposes its capabilities through a single
// window.__bench object built by installAdapter(); the node harness drives ONLY through
// these fields, so adding a library means implementing this small surface — and the gates
// can assume it. Browser-safe: zero node imports (bundled by Vite into each page).
//
// Backward-compatible SUPERSET of the original informal contract. Preserved (existing
// bench scripts read these): ready, error, timings, settled, tSettle, pauseLayout,
// fitView, paused. New (required by the gates + the apiCamera driver):
//   counts()        → engine-ACTUAL element counts {nodes,edges} | {points}  (coverage gate)
//   setCamera(state)→ 'overview' (=fitView, universal) | 'mid' | 'deep'      (apiCamera, presentation gate)
//   cameraState()   → the current named state                                 (camera-state gate)
//   supportsCamera  → which states this page can drive (overview is universal)
//   primitives      → PRIMITIVE.* this page draws                             (primitive axis)
//   surface         → 'onscreen' | 'offscreen'                                (presentation gate)
//
// expected{} counts are NOT a page field — the node harness loads them from the dataset
// descriptor (summary.json / manifest.json) and compares against counts().
export const ADAPTER_VERSION = 1;

export function installAdapter(impl = {}) {
  const bench = {
    adapter: ADAPTER_VERSION,
    tool: null,
    dataset: null,
    ready: false,
    error: null,
    settled: false,
    tSettle: null,
    paused: false,
    surface: 'onscreen', // web pages always present to the compositor; native overrides
    timings: null,
    primitives: [],
    supportsCamera: ['overview'], // overview (=fitView) universal; mid/deep are opt-in
    // contract methods — pages override post-render; safe no-op defaults until then
    counts: () => null, // engine-ACTUAL counts; null = "not yet wired" (coverage gate fails loud)
    fitView: () => {},
    setCamera: () => {}, // 'overview' | 'mid' | 'deep'
    cameraState: () => 'overview',
    pauseLayout: () => {},
    ...impl,
  };
  window.__bench = bench;
  return bench;
}
