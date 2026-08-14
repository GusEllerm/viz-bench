// Build the cit_patents tier (SNAP cit-Patents: US patent citation graph, ~3.77M nodes /
// ~16.5M edges) — the ladder rung above arxiv_full. At this scale JSON is not viable
// (~450 MB), so the tier ships in the BINARY format the point clouds already use:
//   cit_patents.meta.json   { dataset, nodes, edges, format: 'graph-binary/1', source }
//   cit_patents.edges.u32   m×2 uint32 node-index pairs (undirected, deduped)
//   cit_patents.pos.f32     n×2 xy — written by layout_citpatents.mjs (cosmos GPU sim)
//   cit_patents.col.u8      n×3 rgb — log-degree ramp
//   cit_patents.size.f32    n — max(1.5, √degree) capped at 18 (same mapping as the JSON tiers)
// Run fetch first: curl -sL -o raw/cit-Patents.txt.gz https://snap.stanford.edu/data/cit-Patents.txt.gz
import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RAW = join(HERE, 'raw/cit-Patents.txt.gz');
const OUT = join(HERE, '../web/public/data');
const DATA = join(HERE, '../data');

console.log('pass 1: stream-parse + renumber…');
const idOf = new Map();
let n = 0;
let keysRaw = new Float64Array(20_000_000); // preallocated: ~16.5M raw edges expected
let nk = 0;
const rl = createInterface({ input: createReadStream(RAW).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  if (line[0] === '#' || !line) continue;
  const tab = line.indexOf('\t');
  const a = +line.slice(0, tab), b = +line.slice(tab + 1);
  let ia = idOf.get(a); if (ia === undefined) { ia = n++; idOf.set(a, ia); }
  let ib = idOf.get(b); if (ib === undefined) { ib = n++; idOf.set(b, ib); }
  if (ia === ib) continue;
  // pack lo/hi into one f64-exact integer (n < 2^22 → key < 2^44)
  if (nk === keysRaw.length) { const g = new Float64Array(keysRaw.length * 1.5); g.set(keysRaw); keysRaw = g; }
  keysRaw[nk++] = ia < ib ? ia * 4194304 + ib : ib * 4194304 + ia;
}
console.log(`  ${n.toLocaleString()} nodes, ${nk.toLocaleString()} raw directed edges`);
if (n >= 4194304) throw new Error('node count exceeds the 2^22 packing bound');

console.log('pass 2: sort + dedupe…');
const keys = keysRaw.subarray(0, nk);
keys.sort();
let m = 0;
for (let i = 0; i < keys.length; i++) if (i === 0 || keys[i] !== keys[i - 1]) keys[m++] = keys[i];
console.log(`  ${m.toLocaleString()} distinct undirected edges`);

const edges = new Uint32Array(m * 2);
const degree = new Uint32Array(n);
for (let i = 0; i < m; i++) {
  const k = keys[i];
  const lo = Math.floor(k / 4194304), hi = k % 4194304;
  edges[i * 2] = lo; edges[i * 2 + 1] = hi;
  degree[lo]++; degree[hi]++;
}

console.log('pass 3: colors + sizes…');
// log-degree ramp over 6 stops (dark blue → amber): visually informative, deterministic
const STOPS = [[54, 92, 141], [8, 104, 172], [67, 162, 202], [123, 204, 196], [223, 194, 125], [230, 152, 56]];
const col = new Uint8Array(n * 3);
const size = new Float32Array(n);
let maxLd = 0;
const ld = new Float32Array(n);
for (let i = 0; i < n; i++) { ld[i] = Math.log2(1 + degree[i]); if (ld[i] > maxLd) maxLd = ld[i]; }
for (let i = 0; i < n; i++) {
  const t = Math.min(0.999, ld[i] / maxLd) * (STOPS.length - 1);
  const s0 = STOPS[Math.floor(t)], s1 = STOPS[Math.ceil(t)], f = t - Math.floor(t);
  col[i * 3] = s0[0] + (s1[0] - s0[0]) * f;
  col[i * 3 + 1] = s0[1] + (s1[1] - s0[1]) * f;
  col[i * 3 + 2] = s0[2] + (s1[2] - s0[2]) * f;
  size[i] = Math.min(18, Math.max(1.5, Math.sqrt(degree[i])));
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'cit_patents.edges.u32'), Buffer.from(edges.buffer));
writeFileSync(join(OUT, 'cit_patents.col.u8'), Buffer.from(col.buffer));
writeFileSync(join(OUT, 'cit_patents.size.f32'), Buffer.from(size.buffer));
writeFileSync(join(OUT, 'cit_patents.meta.json'), JSON.stringify({
  dataset: 'cit_patents', format: 'graph-binary/1', nodes: n, edges: m,
  files: { edges: 'cit_patents.edges.u32', pos: 'cit_patents.pos.f32', col: 'cit_patents.col.u8', size: 'cit_patents.size.f32' },
  source: 'SNAP cit-Patents (US patent citation graph); layout: cosmos.gl GPU force simulation (see layout_citpatents.mjs)',
}, null, 2));

// summary.json entry (the harness's raw-count record)
const sumPath = join(DATA, 'summary.json');
const summary = JSON.parse((await import('node:fs')).readFileSync(sumPath, 'utf8'));
summary.cit_patents = { nodes: n, edges: m, source: 'SNAP cit-Patents' };
writeFileSync(sumPath, JSON.stringify(summary, null, 2));
console.log(`wrote binary tier (${n.toLocaleString()} n / ${m.toLocaleString()} e) — now run layout_citpatents.mjs for pos.f32`);
