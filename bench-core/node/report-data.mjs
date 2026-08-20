// Data layer for the procedurally-generated report site. Turns the gated result/1 JSONs
// into a SANITIZED, public-safe dataset and provides the build-time leak test that enforces
// the deploy contract (docs/ is public; only aggregate FPS numbers may ship — never
// provenance, the full renderer string, paths, hashes, or the exact machine model).
//
// The sanitizer is a strict ALLOW-LIST (builds a new object from known-safe keys — never
// spread-and-delete). The leak test's denylist is HARVESTED from the raw inputs themselves
// (every renderer/provenance/hash literal present in the data), so it cannot drift: whatever
// secret is in the input is asserted absent from the output.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validate } from './schema.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // bench-core/node/
const SRC = {
  graphOverview: '../../graph-bench/web/bench/results/overview-matrix.json',
  manifoldPc: '../../manifold-bench/web/bench/results/pc-matrix.json',
  datovizWindowed: '../../manifold-bench/native/results.windowed.json',
  datovizThroughput: '../../manifold-bench/native/results.throughput.json', // loaded ONLY to harvest secrets + assert excluded
  layoutBench: '../../graph-bench/web/bench/results/layout-matrix.json',     // layout-compute throughput (synthetic; no provenance)
};
const CAP_SRC = {
  verified: '../../manifold-bench/web/bench/results/capability-matrix.json', // gated examples (carry secrets)
  surveyed: '../report/capability-survey.json',                             // authored doc-claims (public)
};
const readJson = (rel) => { try { return JSON.parse(readFileSync(join(HERE, rel), 'utf8')); } catch { return []; } };

export function collectRaw() {
  return {
    interactive: [...readJson(SRC.graphOverview), ...readJson(SRC.manifoldPc), ...readJson(SRC.datovizWindowed)],
    throughput: readJson(SRC.datovizThroughput),
  };
}

// ---- sanitize (strict allow-list) ----
export const PUBLIC_KEYS = [
  'domain', 'tool', 'library', 'version', 'dataset', 'scale', 'primitives',
  'fps', 'p50', 'p95', 'fpsCont', 'p95Cont', 'memMB', 'cameraState', 'driver', 'motion', 'surface', 'gatesPass', 'gateSummary',
];
const verdictWord = (v) => (v == null ? null : String(v).split(':')[0].trim()); // "pass: ANGLE…" → "pass"

function sanitizeOne(r) {
  const rec = {
    domain: r.domain,
    tool: r.tool,
    library: r.engine?.library ?? null,
    dataset: r.dataset?.name ?? null,        // NAME only — never .hash/.descriptor/.expected*
    scale: r.scale ?? null,                  // benign element counts
    primitives: r.primitives ?? [],
    fps: r.metrics?.fps ?? null,
    p50: r.metrics?.p50ms ?? null,
    p95: r.metrics?.p95ms ?? null,
    fpsCont: r.metrics?.fpsCont ?? null,   // continuous render-throughput (force-repaint every frame)
    p95Cont: r.metrics?.p95Cont ?? null,
    cameraState: r.protocol?.cameraState ?? null,
    driver: r.protocol?.driver ?? null,
    motion: r.protocol?.motion ?? null,
    surface: r.presentation?.surface ?? null,
    gatesPass: !!r.ok,
    // verdict WORD per gate only — strips gates.*.detail (where the renderer string + raw counts hide)
    gateSummary: r.gates ? Object.fromEntries(Object.entries(r.gates).map(([k, v]) => [k, verdictWord(v)])) : null,
  };
  if (r.engine?.version != null) rec.version = r.engine.version;
  if (r.metrics?.memMB != null) rec.memMB = r.metrics.memMB;
  return rec;
}

export function assertPublic(rec) {
  const extra = Object.keys(rec).filter((k) => !PUBLIC_KEYS.includes(k));
  if (extra.length) throw new Error(`sanitize produced non-public keys: ${extra.join(', ')}`);
  return rec;
}

// Publishable = ok, real swapchain present (not the offscreen/throughput datoviz record), and
// the presentation gate passed. Offscreen is caught three ways (tool, surface, gate verdict).
const isPublishable = (r) =>
  r.ok &&
  r.tool !== 'datoviz-offscreen' &&
  r.presentation?.surface !== 'offscreen' &&
  /^pass/.test(r.gates?.presentation || '');

export function sanitize(rawInteractive) {
  return rawInteractive.filter(isPublishable).map(sanitizeOne).map(assertPublic);
}

// ---- layout-compute benchmark (synthetic graphs; iterations/sec) ----
export const LAYOUT_PUBLIC_KEYS = ['engine', 'label', 'nodes', 'edges', 'itersPerSec'];
// A layout run is valid only if throughput does NOT rise with scale — a bigger graph can't lay out
// FASTER, so a larger scale pinned back at the display cap means the engine stopped laying out and
// is just idling at vsync (Helios does this past ~100K). Drop those; keep the honest monotone tail.
export function collectLayout() {
  const raw = readJson(SRC.layoutBench).filter((r) => !r.error && typeof r.itersPerSec === 'number');
  const byEngine = new Map();
  for (const r of raw) { if (!byEngine.has(r.engine)) byEngine.set(r.engine, []); byEngine.get(r.engine).push(r); }
  const out = [];
  for (const recs of byEngine.values()) {
    recs.sort((a, b) => a.nodes - b.nodes);
    let floor = Infinity;
    for (const r of recs) {
      if (r.itersPerSec > floor * 1.2) continue; // rose vs a smaller scale → idling artifact, invalid
      floor = Math.min(floor, r.itersPerSec);
      const rec = {}; for (const k of LAYOUT_PUBLIC_KEYS) rec[k] = r[k]; // allow-list (records carry no provenance)
      out.push(rec);
    }
  }
  return out;
}

// ---- failures (quarantined cells) ----
// A quarantined cell is itself a result: "this engine could not open this dataset" is the
// finding at the top tiers. Only a CONTROLLED WORD is published — never the error text, which
// can carry paths/renderer strings (the leak test would reject it, and rightly).
export const FAILURE_KEYS = ['domain', 'tool', 'dataset', 'reason'];
export function collectFailures(rawInteractive) {
  const out = [];
  for (const r of rawInteractive) {
    if (r.ok) continue;
    const err = String(r.error || '');
    const gates = (r.gateFailures || []).join(' ');
    let reason = null;
    if (/crash|out of memory|oom/i.test(err)) reason = 'crashed';
    else if (/timeout|exceeded/i.test(err)) reason = 'timeout';
    else if (err || gates) reason = 'quarantined';
    if (!reason) continue;
    out.push({ domain: r.domain, tool: r.tool, dataset: r.dataset?.name ?? null, reason });
  }
  return out;
}

// ---- capabilities (feature registry) ----
export const CAP_PUBLIC_KEYS = [
  'schemaVersion', 'feature', 'featureLabel', 'category', 'library', 'support', 'evidence',
  'example', 'verified', 'scale', 'screenshot', 'dataset', 'notes', 'docs',
];
const SYNTHETIC_CLOUDS = /^(swiss_roll|sphere|torus|s_curve|synthetic_graph|synthetic_points)_/; // public-safe; a verified example must never screenshot a real-data cloud

function sanitizeCapability(r) {
  const rec = {};
  for (const k of CAP_PUBLIC_KEYS) if (r[k] !== undefined) rec[k] = r[k]; // allow-list: never gpu/provenance/gateFailures
  const extra = Object.keys(rec).filter((k) => !CAP_PUBLIC_KEYS.includes(k));
  if (extra.length) throw new Error(`capability sanitize produced non-public keys: ${extra.join(', ')}`);
  if (rec.dataset && !SYNTHETIC_CLOUDS.test(rec.dataset)) {
    throw new Error(`capability example uses non-synthetic dataset "${rec.dataset}" — refusing to publish`);
  }
  return rec;
}

export function collectCapabilitiesRaw() {
  return { verified: readJson(CAP_SRC.verified), surveyed: readJson(CAP_SRC.surveyed) };
}

// merge by (feature, library) with VERIFIED precedence (a gate-checked record supersedes a survey)
export function collectCapabilities() {
  const { verified, surveyed } = collectCapabilitiesRaw();
  const byKey = new Map();
  const key = (r) => `${r.feature}::${r.library}`;
  for (const r of surveyed) byKey.set(key(r), r);
  for (const r of verified) byKey.set(key(r), r);
  return [...byKey.values()].map(sanitizeCapability);
}

// ---- leak test (harvested denylist + static patterns) ----
export function harvestSecrets(rawRecords) {
  const s = new Set();
  const add = (v) => { if (v != null && String(v).length >= 4) s.add(String(v)); };
  for (const r of rawRecords) {
    add(r.gpu?.renderer);
    add(r.dataset?.hash);
    add(r.dataset?.descriptor);
    const p = r.provenance || {};
    for (const k of ['machine', 'os', 'gitCommit', 'timestamp', 'node', 'python', 'harness']) add(p[k]);
  }
  return s;
}

export const FORBIDDEN_PATTERNS = [
  /\/Users\//,
  /sha256:/i,
  /\bANGLE\b/,
  /MoltenVK/i,
  /Apple\s+M[0-9]\s*Pro/i,            // the exact machine (genericized to "Apple-Silicon, Metal GPU")
  /\bM[0-9]\s+Pro\b/,
  /darwin\s+\d/i,
  /datoviz-offscreen/,
  /Unspecified Version/,
  /@viz-bench\/bench-core\/\d/,
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,    // ISO timestamps
  /(graph-bench|manifold-bench)\/(data|native|web\/public)/,
];

export function leakTest(html, secrets) {
  const hits = [];
  for (const re of FORBIDDEN_PATTERNS) { const m = html.match(re); if (m) hits.push(`pattern ${re} → "${m[0]}"`); }
  for (const sec of secrets) { if (html.includes(sec)) hits.push(`harvested secret "${String(sec).slice(0, 48)}…"`); }
  if (hits.length) throw new Error('LEAK TEST FAILED — forbidden tokens in output:\n  ' + hits.join('\n  '));
  return true;
}

// ---- convenience: the sanitized dataset + the harvested denylist ----
export function collect() {
  const { interactive, throughput } = collectRaw();
  for (const r of interactive) {
    const v = validate(r);
    if (!v.valid) console.warn(`  ⚠ invalid record ${r.tool}/${r.dataset?.name}: ${v.problems.join(', ')}`);
  }
  const capRaw = collectCapabilitiesRaw();
  // the VERIFIED capability records carry gpu.renderer/provenance — harvest those too
  const secrets = harvestSecrets([...interactive, ...throughput, ...capRaw.verified]);
  const pub = sanitize(interactive);
  if (pub.some((r) => r.surface === 'offscreen' || r.tool === 'datoviz-offscreen')) {
    throw new Error('offscreen/throughput record leaked into the public dataset');
  }
  const capabilities = collectCapabilities();
  const layout = collectLayout();
  const failures = collectFailures(interactive);
  return { public: pub, capabilities, layout, failures, secrets };
}
