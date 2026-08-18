// Unified graph-tier loader — JSON tiers (arxiv_*) and BINARY tiers (graph-binary/1, e.g.
// cit_patents at 16.5M edges, where JSON would be ~450 MB). Both paths return ONE typed shape
// and each page applies its own engine mapping on top (sizes stay per-engine — disclosed):
//   { meta:{dataset,nodes,edges}, n, m, pos:F32(n*2 xy), colRGB:U8(n*3), deg:U32(n),
//     edges:U32(m*2 flat index pairs), idOf(i), labelOf(i), tFetch }
// Colors: JSON tiers = subject-area palette (same values pages computed before); binary tiers =
// the shipped col.u8 (log-degree ramp — that source has no categories).
import { rgb255Of } from './typecolors.js';

export async function loadGraphTier(name) {
  const t0 = performance.now();
  // binary tier? (guarded parse: a dev-server SPA fallback can 200 on missing files)
  try {
    const metaRes = await fetch(`data/${name}.meta.json`);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      if (meta && meta.format === 'graph-binary/1') return await loadBinary(meta, t0);
    }
  } catch (e) { /* fall through to the JSON tier */ }

  showLegend('cat');
  const res = await fetch(`data/${name}.layout.json`);
  if (!res.ok) throw new Error(`fetch ${name}.layout.json → ${res.status}`);
  const json = await res.json();
  const nodes = json.nodes, n = nodes.length;
  const pos = new Float32Array(n * 2), colRGB = new Uint8Array(n * 3), deg = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    pos[2 * i] = nd.x; pos[2 * i + 1] = nd.y;
    const c = rgb255Of(nd.t);
    colRGB[3 * i] = c[0]; colRGB[3 * i + 1] = c[1]; colRGB[3 * i + 2] = c[2];
    deg[i] = nd.d || 1;
  }
  return {
    meta: json.meta, n, m: json.meta.edges, pos, colRGB, deg,
    edges: Uint32Array.from(json.edges),
    idOf: (i) => nodes[i].id, labelOf: (i) => nodes[i].l || nodes[i].id,
    tFetch: performance.now() - t0,
  };
}

function showLegend(kind) {
  const cat = document.getElementById('legend-cat'), deg = document.getElementById('legend-deg');
  if (cat) cat.style.display = kind === 'deg' ? 'none' : '';
  if (deg) deg.style.display = kind === 'deg' ? '' : 'none';
}

async function loadBinary(meta, t0) {
  showLegend('deg');
  const get = (f, what) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(`fetch ${f} → ${r.status}${what ? ` (${what})` : ''}`); return r.arrayBuffer(); });
  const [eb, cb, pb] = await Promise.all([
    get(meta.files.edges), get(meta.files.col),
    get(meta.files.pos, 'positions missing — run graph-bench/prep/layout_citpatents.mjs'),
  ]);
  const edges = new Uint32Array(eb);
  const n = meta.nodes;
  const deg = new Uint32Array(n);
  for (let i = 0; i < edges.length; i++) deg[edges[i]]++;
  return {
    meta: { dataset: meta.dataset, nodes: n, edges: meta.edges }, n, m: meta.edges,
    pos: new Float32Array(pb), colRGB: new Uint8Array(cb), deg, edges,
    idOf: (i) => String(i), labelOf: (i) => `patent #${i}`,
    tFetch: performance.now() - t0,
  };
}

export const hexOfRGB = (colRGB, i) =>
  '#' + [colRGB[3 * i], colRGB[3 * i + 1], colRGB[3 * i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
