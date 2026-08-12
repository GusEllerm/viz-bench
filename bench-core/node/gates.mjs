// The fail-loud gates. Each returns { pass, verdict, detail }. A result is only published
// if every gate passes (n/a counts as pass); a failing gate quarantines the record
// (ok:false + gateFailures) but does NOT delete it — a failure is evidence. The async
// Presentation gate lives in presentation.mjs (it needs the Playwright page).
//
// These encode the three meta-lessons learned the hard way:
//   #1 never bench with synthetic uncoalesced input  → inputHonestyGate
//   #2 always record the camera state                → cameraStateGate
//   #3 never quote offscreen as interactive          → presentation.mjs (web) + native gate

// GPU: ran on the real GPU, not a software fallback. Was recorded-not-asserted; now fails.
export function gpuGate({ renderer, software, expectedRe = /Apple M[0-9]/ }) {
  if (software) return { pass: false, verdict: 'fail', detail: 'software fallback: ' + renderer };
  if (expectedRe && !expectedRe.test(renderer || '')) return { pass: false, verdict: 'fail', detail: 'unexpected renderer: ' + renderer };
  return { pass: true, verdict: 'pass', detail: renderer };
}

// Coverage: the engine actually loaded the full dataset. Compares engine-ACTUAL counts()
// against the loaded-artifact count. Engine-specific edge policy:
//   'exact'      typed-array engines (cosmos/deck/helios/three) fed 1:1 → must match
//   'graphology' sigma/sigmapre dedup parallel edges via mergeEdge (~2%) → ≥95% floor
// nodes are exact for everyone (nothing dedups nodes). points clouds use a 99% floor.
export function coverageGate({ engine, expected, edgePolicy = 'exact', floor = 0.95 }) {
  if (!engine) return { pass: false, verdict: 'fail', detail: 'counts() returned null (adapter not wired)' };
  if (expected.points != null) {
    const ok = engine.points >= expected.points * 0.99;
    return { pass: ok, verdict: ok ? 'pass' : 'fail', detail: `points ${engine.points}/${expected.points}` };
  }
  const nodesOk = engine.nodes === expected.nodes;
  let edgesOk, edgeDetail;
  if (edgePolicy === 'graphology') {
    const min = Math.floor(expected.edges * floor);
    edgesOk = engine.edges >= min;
    edgeDetail = `edges ${engine.edges} ≥ ${min} (${Math.round(floor * 100)}% of ${expected.edges})`;
  } else {
    edgesOk = engine.edges === expected.edges;
    edgeDetail = `edges ${engine.edges}/${expected.edges}`;
  }
  const ok = nodesOk && edgesOk;
  return { pass: ok, verdict: ok ? 'pass' : 'fail', detail: `nodes ${engine.nodes}/${expected.nodes}, ${edgeDetail}` };
}

// Camera-state: the result carries a named state the page actually supports. The harness
// stamps the state it drove; overview is universal, mid/deep are declared capabilities.
export function cameraStateGate({ state, supportsCamera }) {
  const ok = !!state && Array.isArray(supportsCamera) && supportsCamera.includes(state);
  return { pass: ok, verdict: ok ? 'pass' : 'fail', detail: `state=${state} supports=${(supportsCamera || []).join('|')}` };
}

// Input-honesty: meta-lesson #1. The continuous high-frequency CDP stream is the artifact
// that collapsed cosmos-pipeline tools ~12x; it must never back a headline. Sanctioned
// headline drivers: apiCamera (engine-driven, zero input) and a gentle coalesced 'pan'
// (~30 events/s, what a human hand delivers). Uncoalesced synthetic input fails unless
// explicitly flagged as a protocol-delta experiment.
const SANCTIONED_HEADLINE_DRIVERS = new Set(['apiCamera', 'pan', 'orbit']);
export function inputHonestyGate({ driver, allowSynthetic = false }) {
  if (allowSynthetic) return { pass: true, verdict: 'pass', detail: `driver=${driver} (flagged experiment)` };
  const ok = SANCTIONED_HEADLINE_DRIVERS.has(driver);
  return { pass: ok, verdict: ok ? 'pass' : 'fail', detail: `driver=${driver}${ok ? '' : ' (uncoalesced/unsanctioned — quarantined from headline)'}` };
}

// Interaction: a synthetic hover fired a pick / showed a tooltip. The one NON-SPATIAL gate — the
// presentation pixel-diff can't prove an interaction works. This is a boolean CAPABILITY check
// (not a headline fps), so it lives OUTSIDE the perf / input-honesty path (no sanctioned driver).
export function interactionGate({ picked, tooltip }) {
  const ok = (picked != null && picked !== false) || tooltip === true;
  return { pass: ok, verdict: ok ? 'pass' : 'fail', detail: ok ? `pick fired (picked=${picked}, tooltip=${tooltip})` : 'no pick / tooltip on synthetic hover' };
}
