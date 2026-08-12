// Dataset descriptors → expected counts + content hash, for the Coverage gate and
// provenance. node-only (fs/crypto). The descriptor is the source of expected counts;
// the COVERAGE ORACLE is the count in the loaded artifact (see gates.coverageGate),
// not these raw numbers — summary.json's raw edge count differs from what a deduping
// engine (graphology) loads.
import { readFileSync, createReadStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// graph-bench/data/summary.json : { [dataset]: { nodes, edges, nodes_by_type, edges_by_type } }
export function graphExpected(summaryPath, dataset) {
  const s = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const d = s[dataset];
  if (!d) throw new Error(`dataset '${dataset}' not found in ${summaryPath}`);
  return { nodes: d.nodes, edges: d.edges };
}

// manifold-bench/data/manifest.json : { clouds: [{ name, n, base, pos, col, bbox }] }
export function cloudExpected(manifestPath, base) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const c = (m.clouds || []).find((x) => x.base === base);
  if (!c) throw new Error(`cloud '${base}' not found in ${manifestPath}`);
  return { points: c.n };
}

// The coverage ORACLE: counts in the loaded artifact (the layout.json the page fetched) —
// what the engine should report. NOT summary.json's raw counts, which predate the layout
// export's edge dedup (drug raw 362,820 vs loaded 354,708; combined 1,115,636 vs 1,107,529).
export function layoutExpected(layoutPath) {
  const j = JSON.parse(readFileSync(layoutPath, 'utf8'));
  return { nodes: j.nodes.length, edges: Math.floor((j.edges?.length || 0) / 2) };
}

// Streaming sha256 of the loaded data file (any size). Best-effort: descriptors carry no
// hash, so we compute one at run time as provenance. Returns null if the file is absent.
export function hashFile(filePath) {
  return new Promise((resolve) => {
    if (!filePath || !existsSync(filePath)) return resolve(null);
    const h = createHash('sha256');
    const s = createReadStream(filePath);
    s.on('data', (d) => h.update(d));
    s.on('end', () => resolve('sha256:' + h.digest('hex').slice(0, 16)));
    s.on('error', () => resolve(null));
  });
}
