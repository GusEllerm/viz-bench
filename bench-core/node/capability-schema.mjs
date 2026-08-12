// capability/1 — the record for the feature/capability registry. Two orthogonal axes:
//   support  : native | plugin | workaround | none   (a claim about the library)
//   evidence : verified | surveyed                    (a claim about OUR confidence)
// The matrix glyph is a function of both. `verified` is EARNED, not asserted: the capability
// harness loads a feature example, runs the same gates as the benchmarks (gpu + coverage +
// presentation), and only a passing example yields evidence:'verified'. Authored survey rows
// are evidence:'surveyed' — a documentation claim, flagged as such.
export const CAPABILITY_SCHEMA_VERSION = 'capability/1';
export const SUPPORT = ['native', 'plugin', 'workaround', 'none'];
export const EVIDENCE = ['verified', 'surveyed'];

const passed = (gr) => !!gr && (gr.pass || gr.verdict === 'n/a');

// From harness parts (gate results) → a raw verified record. Carries gpu + provenance so the
// leak test's harvestSecrets can catch them; report-data's sanitizeCapability strips them.
export function makeCapability(p) {
  const g = p.gateResults || {};
  // interaction is optional (pick/hover examples) — treated as n/a-pass when absent
  const renders = passed(g.gpu) && passed(g.presentation) && passed(g.coverage) && passed(g.interaction ?? { verdict: 'n/a' });
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    feature: p.feature,
    featureLabel: p.featureLabel,
    category: p.category,
    library: p.library,
    support: p.support,
    evidence: renders ? 'verified' : 'surveyed',
    ...(p.example ? { example: p.example } : {}),
    ...(renders ? { verified: { renders: true, gpu: passed(g.gpu), presentation: passed(g.presentation), ...(g.interaction ? { interaction: passed(g.interaction) } : {}) } } : {}),
    ...(p.scale ? { scale: p.scale } : {}),
    ...(p.screenshot ? { screenshot: p.screenshot } : {}),
    dataset: p.dataset, // synthetic cloud name (benign; asserted ∈ SYNTHETIC_CLOUDS downstream)
    notes: p.notes,
    docs: p.docs,
    gpu: p.gpu, // raw — harvested + stripped by sanitizeCapability
    provenance: p.provenance, // raw — harvested + stripped
    ok: renders,
    gateFailures: renders ? [] : Object.entries(g).filter(([, gr]) => !passed(gr)).map(([k]) => k),
  };
}

export function validateCapability(rec) {
  const problems = [];
  if (rec.schemaVersion !== CAPABILITY_SCHEMA_VERSION) problems.push(`schemaVersion=${rec.schemaVersion}`);
  for (const k of ['feature', 'featureLabel', 'category', 'library', 'support', 'evidence']) if (rec[k] == null) problems.push(k);
  if (rec.support && !SUPPORT.includes(rec.support)) problems.push(`support=${rec.support}`);
  if (rec.evidence && !EVIDENCE.includes(rec.evidence)) problems.push(`evidence=${rec.evidence}`);
  if (rec.evidence === 'verified' && !rec.verified?.renders) problems.push('verified w/o verified.renders');
  return { valid: problems.length === 0, problems };
}
