// The one versioned result record (result/1), used by JS and (mirrored) by Python. Promotes
// run.mjs's rich record, adds provenance + camera state + gate verdicts, and unifies the
// three legacy shapes. makeRecord assembles from the parts the runner collected and derives
// ok + gateFailures from the gate results; validate() rejects a record missing a gate
// verdict or camera state. A failing gate quarantines (ok:false) — it does NOT drop the row.
export const RESULT_SCHEMA_VERSION = 'result/1';
export const REQUIRED_GATES = ['gpu', 'coverage', 'presentation', 'cameraState', 'inputHonesty'];

const passed = (gr) => !!gr && (gr.pass || gr.verdict === 'n/a');
const verdictStr = (gr) => {
  if (!gr) return 'missing';
  if (gr.verdict === 'n/a') return 'n/a' + (gr.detail ? ': ' + gr.detail : '');
  return (gr.pass ? 'pass' : 'fail') + (gr.detail ? ': ' + gr.detail : '');
};

// parts: { domain, tool, engine, dataset, primitives, scale, coverage, protocol, metrics,
//          presentation, gpu, timings, gateResults: {gpu,coverage,presentation,cameraState,
//          inputHonesty}, provenance, error }
export function makeRecord(parts) {
  const { gateResults = {}, error } = parts;
  const gates = {};
  for (const k of Object.keys(gateResults)) gates[k] = verdictStr(gateResults[k]);
  const ok = !error && Object.values(gateResults).every(passed);
  const gateFailures = Object.entries(gateResults)
    .filter(([, gr]) => !passed(gr))
    .map(([k, gr]) => `${k}: ${gr?.detail || gr?.verdict || 'fail'}`);
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    domain: parts.domain,
    tool: parts.tool,
    engine: parts.engine,
    dataset: parts.dataset,
    primitives: parts.primitives,
    scale: parts.scale,
    coverage: parts.coverage,
    protocol: parts.protocol,
    metrics: parts.metrics,
    presentation: parts.presentation,
    gpu: parts.gpu,
    gates,
    ok,
    gateFailures,
    ...(error ? { error: String(error) } : {}),
    provenance: parts.provenance,
    ...(parts.timings ? { timings: parts.timings } : {}),
  };
}

export function validate(rec) {
  const problems = [];
  if (rec.schemaVersion !== RESULT_SCHEMA_VERSION) problems.push(`schemaVersion=${rec.schemaVersion}`);
  if (!rec.protocol?.cameraState) problems.push('protocol.cameraState missing');
  if (!rec.gates) problems.push('gates missing');
  else for (const g of REQUIRED_GATES) if (rec.gates[g] == null) problems.push(`gates.${g} missing`);
  return { valid: problems.length === 0, problems };
}
