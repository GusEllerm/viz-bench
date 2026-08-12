// Build the public graph-benchmark tiers from ogbn-arxiv (run fetch_arxiv.sh first).
// Year-sliced snapshots of one dataset give a natural 4-tier scale ladder:
//   arxiv_2015  ~53K nodes /  ~152K edges     arxiv_2018  ~121K nodes / ~622K edges
//   arxiv_2017  ~91K nodes /  ~375K edges     arxiv_full  169,343 nodes / ~1.17M edges
// Output per tier: ../web/public/data/<tier>.layout.json in the shape the bench pages consume
//   { meta: {dataset, nodes, edges}, nodes: [{id, l, t, d, x, y}], edges: [i0,j0, i1,j1, …] }
// (edges are node-ARRAY-INDEX pairs, flat). Positions are a precomputed ForceAtlas2 layout
// (graphology-layout-forceatlas2, Barnes-Hut, seeded initial placement → deterministic given
// the iteration count). Also refreshes ../data/summary.json (the harness's raw-count record).
//   node build_arxiv.mjs all|arxiv_2015|arxiv_2017|arxiv_2018|arxiv_full [--iters 600]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RAW = join(HERE, 'raw/arxiv');
const OUT = join(HERE, '../web/public/data');
const DATA = join(HERE, '../data');

const TIERS = { arxiv_2015: 2015, arxiv_2017: 2017, arxiv_2018: 2018, arxiv_full: 9999 };
const arg = process.argv[2] || 'all';
const iters = parseInt((process.argv.find((a) => a.startsWith('--iters')) || '').split('=')[1] || process.argv[process.argv.indexOf('--iters') + 1] || '600', 10);
const tiers = arg === 'all' ? Object.keys(TIERS) : [arg];
if (!tiers.every((t) => TIERS[t])) { console.error(`unknown tier ${arg}`); process.exit(1); }

const lines = (f) => gunzipSync(readFileSync(join(RAW, f))).toString().trim().split('\n');
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

console.log('loading raw ogbn-arxiv…');
const years = lines('raw/node_year.csv.gz').map(Number);
const labels = lines('raw/node-label.csv.gz').map(Number);
const paperIds = lines('mapping/nodeidx2paperid.csv.gz').slice(1).map((l) => l.split(',')[1]);
// "arxiv cs ai" → "cs.AI"
const catNames = lines('mapping/labelidx2arxivcategeory.csv.gz').slice(1).map((l) => {
  const parts = l.split(',')[1].trim().split(' ');
  return `${parts[1]}.${parts[2].toUpperCase()}`;
});
const rawEdges = lines('raw/edge.csv.gz').map((l) => { const i = l.indexOf(','); return [+l.slice(0, i), +l.slice(i + 1)]; });
console.log(`  ${years.length.toLocaleString()} nodes, ${rawEdges.length.toLocaleString()} raw directed edges`);

for (const tier of tiers) {
  const cutoff = TIERS[tier];
  console.log(`\n=== ${tier} (year ≤ ${cutoff}) ===`);
  const keep = years.map((y) => y <= cutoff);
  const newIdx = new Int32Array(years.length).fill(-1);
  let n = 0;
  for (let i = 0; i < years.length; i++) if (keep[i]) newIdx[i] = n++;

  // dedupe undirected pairs (citations are one-way, so this mostly drops exact duplicates)
  const seen = new Set();
  const pairs = [];
  for (const [a, b] of rawEdges) {
    if (!keep[a] || !keep[b] || a === b) continue;
    const lo = Math.min(newIdx[a], newIdx[b]), hi = Math.max(newIdx[a], newIdx[b]);
    const key = lo * 262144 + hi; // n < 2^18 → collision-free packing
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(lo, hi);
  }
  const m = pairs.length / 2;
  const degree = new Int32Array(n);
  for (let e = 0; e < m; e++) { degree[pairs[2 * e]]++; degree[pairs[2 * e + 1]]++; }
  console.log(`  ${n.toLocaleString()} nodes, ${m.toLocaleString()} distinct edges — building graph…`);

  // seeded initial placement (disc, radius ~ sqrt(n)) → FA2 result is deterministic
  const rand = mulberry32(1234);
  const g = new Graph({ type: 'undirected', allowSelfLoops: false });
  const R = Math.sqrt(n) * 10;
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * R;
    g.addNode(i, { x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  for (let e = 0; e < m; e++) g.mergeEdge(pairs[2 * e], pairs[2 * e + 1]);

  const settings = forceAtlas2.inferSettings(g);
  console.log(`  FA2 ×${iters} iterations (barnesHut=${settings.barnesHutOptimize})…`);
  const t0 = Date.now();
  const CHUNK = 20;
  for (let done = 0; done < iters; done += CHUNK) {
    forceAtlas2.assign(g, { iterations: Math.min(CHUNK, iters - done), settings });
    const dt = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  ${Math.min(done + CHUNK, iters)}/${iters} iters — ${dt.toFixed(0)}s elapsed   `);
  }
  console.log('');

  const invIdx = new Int32Array(n);
  for (let i = 0; i < years.length; i++) if (newIdx[i] >= 0) invIdx[newIdx[i]] = i;
  const nodes = new Array(n);
  for (let i = 0; i < n; i++) {
    const orig = invIdx[i];
    const attrs = g.getNodeAttributes(i);
    nodes[i] = {
      id: `mag:${paperIds[orig]}`,
      l: `MAG ${paperIds[orig]} · ${catNames[labels[orig]]} · ${years[orig]}`,
      t: catNames[labels[orig]],
      d: degree[i],
      x: +attrs.x.toFixed(2),
      y: +attrs.y.toFixed(2),
    };
  }

  mkdirSync(OUT, { recursive: true });
  const out = join(OUT, `${tier}.layout.json`);
  writeFileSync(out, JSON.stringify({ meta: { dataset: tier, nodes: n, edges: m }, nodes, edges: pairs }));
  console.log(`  wrote ${out}`);

  // refresh summary.json (raw-count record used by the harness's provenance side)
  mkdirSync(DATA, { recursive: true });
  const sumPath = join(DATA, 'summary.json');
  const summary = existsSync(sumPath) ? JSON.parse(readFileSync(sumPath, 'utf8')) : {};
  summary[tier] = { nodes: n, edges: m, source: 'ogbn-arxiv (ODC-BY)', cutoffYear: cutoff === 9999 ? null : cutoff };
  writeFileSync(sumPath, JSON.stringify(summary, null, 2));
}
console.log('\nall tiers done');
