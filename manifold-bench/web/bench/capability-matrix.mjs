// Capability harness — loads each feature EXAMPLE, runs the same gates as the benchmarks
// (gpu + coverage + presentation), captures a #view screenshot (synthetic clouds ONLY), and
// emits a capability/1 record. A passing example earns evidence:'verified'; the authored
// survey (capability-survey.json) supplies the surveyed breadth. Clone of pc-matrix.mjs.
//
//   node bench/capability-matrix.mjs
import { launchBrowser, startServer, readGL } from '../../../bench-core/node/harness.mjs';
import { startProbe, readProbe } from '../../../bench-core/node/probe.mjs';
import { gpuGate, coverageGate, interactionGate } from '../../../bench-core/node/gates.mjs';
import { presentationWeb } from '../../../bench-core/node/presentation.mjs';
import { makeCapability } from '../../../bench-core/node/capability-schema.mjs';
import { cloudExpected } from '../../../bench-core/node/descriptors.mjs';
import { provenance } from '../../../bench-core/node/provenance.mjs';
import { CAP_LIB_SLUG } from '../../../bench-core/node/report-spec.mjs';
import { makeGraph } from '../src/randomgraph.js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.SITE || 'http://localhost:5200';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const MANIFEST = join(HERE, '../../data/manifest.json');
const OUT = join(HERE, 'results/capability-matrix.json');
const SHOTS = join(HERE, 'results/shots');
const SYNTHETIC = /^(swiss_roll|sphere|torus|s_curve|synthetic_graph|synthetic_points)_/; // public-safe only — never a real-data cloud
const GRAPH = makeGraph(); // deterministic synthetic graph shared by the sigma examples (coverage oracle)

// Verified flagships: feature example pages implementing the bench-core contract. kind 'cloud'
// = a synthetic point cloud (deck); kind 'graph' = a synthetic in-page graph (sigma plugins).
const EXAMPLES = [
  {
    feature: 'density-map', featureLabel: 'Density map / heatmap', category: 'aggregate',
    library: 'deck.gl', support: 'native', kind: 'cloud',
    page: 'density-deck.html', cloud: 'swiss_roll_100000',
    notes: 'GPU screen-space aggregation (HeatmapLayer, @deck.gl/aggregation-layers).',
    docs: 'https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer',
  },
  {
    feature: 'curved-edges', featureLabel: 'Curved edges', category: 'structure',
    library: 'sigma.js', support: 'plugin', kind: 'graph',
    page: 'cap-sigma-curvededges.html',
    notes: 'Curved edge rendering via @sigma/edge-curve (EdgeCurveProgram).',
    docs: 'https://github.com/jacomyal/sigma.js/tree/main/packages/edge-curve',
  },
  {
    feature: 'node-images', featureLabel: 'Node images / borders', category: 'annotate',
    library: 'sigma.js', support: 'plugin', kind: 'graph',
    page: 'cap-sigma-nodeimage.html',
    notes: 'Per-node images via @sigma/node-image (NodeImageProgram); procedural icons.',
    docs: 'https://github.com/jacomyal/sigma.js/tree/main/packages/node-image',
  },
  {
    feature: 'density-map', featureLabel: 'Density map / heatmap', category: 'aggregate',
    library: 'three.js', support: 'workaround', kind: 'points', n: 4000,
    page: 'cap-three-density.html',
    notes: 'No built-in aggregation — computes local point density (neighbours in radius) and colour-encodes it (blue→red).',
    docs: 'https://threejs.org/docs/#api/en/objects/Points',
  },
  {
    feature: 'lines', featureLabel: 'Lines / edges', category: 'encode',
    library: 'three.js', support: 'workaround', kind: 'points', n: 50,
    page: 'cap-three-lines.html',
    notes: 'THREE.LineSegments (1px hairlines); Line2 is the add-on for width.',
    docs: 'https://threejs.org/docs/#api/en/objects/LineSegments',
  },
  {
    feature: 'labels', featureLabel: 'Labels', category: 'annotate',
    library: 'three.js', support: 'workaround', kind: 'points', n: 20,
    page: 'cap-three-labels.html',
    notes: 'Text via THREE.Sprite (CanvasTexture); CSS2DRenderer is the other add-on.',
    docs: 'https://threejs.org/docs/#api/en/objects/Sprite',
  },
  {
    feature: 'node-images', featureLabel: 'Node images / borders', category: 'annotate',
    library: 'three.js', support: 'workaround', kind: 'points', n: 40,
    page: 'cap-three-nodeimage.html',
    notes: 'THREE.Sprite with procedurally-generated CanvasTexture icons.',
    docs: 'https://threejs.org/docs/#api/en/objects/Sprite',
  },
  {
    feature: 'pick-tooltip', featureLabel: 'Pick / hover tooltip', category: 'interact',
    library: 'deck.gl', support: 'native', kind: 'points', n: 24, interaction: true,
    page: 'cap-deck-pick.html',
    notes: 'Native picking — pickable:true + onHover / getTooltip.',
    docs: 'https://deck.gl/docs/developer-guide/interactivity',
  },
  {
    feature: 'pick-tooltip', featureLabel: 'Pick / hover tooltip', category: 'interact',
    library: 'sigma.js', support: 'native', kind: 'graph', interaction: true,
    page: 'cap-sigma-pick.html',
    notes: 'Native enterNode / leaveNode / clickNode events.',
    docs: 'https://www.sigmajs.org/docs/',
  },
  {
    feature: 'pick-tooltip', featureLabel: 'Pick / hover tooltip', category: 'interact',
    library: 'three.js', support: 'workaround', kind: 'points', n: 30, interaction: true,
    page: 'cap-three-pick.html',
    notes: 'No built-in picking — a THREE.Raycaster on mousemove intersects the points.',
    docs: 'https://threejs.org/docs/#api/en/core/Raycaster',
  },

  // ---- Batch A: points / lines / labels / node-images / curved-edges (existing deps) ----
  {
    feature: 'points', featureLabel: 'Points / scatter', category: 'encode',
    library: 'three.js', support: 'native', kind: 'points', n: 3000,
    page: 'cap-three-points.html',
    notes: 'THREE.Points over a BufferGeometry — GPU point sprites.',
    docs: 'https://threejs.org/docs/#api/en/objects/Points',
  },
  {
    feature: 'points', featureLabel: 'Points / scatter', category: 'encode',
    library: 'sigma.js', support: 'native', kind: 'graph',
    page: 'cap-sigma-points.html',
    notes: 'Nodes are the base primitive; edges hidden here for a pure scatter.',
    docs: 'https://www.sigmajs.org/docs/',
  },
  {
    feature: 'points', featureLabel: 'Points / scatter', category: 'encode',
    library: 'deck.gl', support: 'native', kind: 'points', n: 2000,
    page: 'cap-deck-points.html',
    notes: 'ScatterplotLayer — the base GPU point primitive.',
    docs: 'https://deck.gl/docs/api-reference/layers/scatterplot-layer',
  },
  {
    feature: 'lines', featureLabel: 'Lines / edges', category: 'encode',
    library: 'sigma.js', support: 'native', kind: 'graph',
    page: 'cap-sigma-lines.html',
    notes: 'Default edge program draws links with per-edge width and colour.',
    docs: 'https://www.sigmajs.org/docs/',
  },
  {
    feature: 'lines', featureLabel: 'Lines / edges', category: 'encode',
    library: 'deck.gl', support: 'native', kind: 'graph',
    page: 'cap-deck-lines.html',
    notes: 'LineLayer — straight GPU segments between node positions.',
    docs: 'https://deck.gl/docs/api-reference/layers/line-layer',
  },
  {
    feature: 'labels', featureLabel: 'Labels', category: 'annotate',
    library: 'sigma.js', support: 'native', kind: 'graph',
    page: 'cap-sigma-labels.html',
    notes: 'Built-in node labels; the LOD threshold is lowered so every node labels.',
    docs: 'https://www.sigmajs.org/docs/',
  },
  {
    feature: 'labels', featureLabel: 'Labels', category: 'annotate',
    library: 'deck.gl', support: 'native', kind: 'graph',
    page: 'cap-deck-labels.html',
    notes: 'TextLayer — per-node SDF text above each node.',
    docs: 'https://deck.gl/docs/api-reference/layers/text-layer',
  },
  {
    feature: 'node-images', featureLabel: 'Node images / borders', category: 'annotate',
    library: 'deck.gl', support: 'native', kind: 'graph',
    page: 'cap-deck-nodeimage.html',
    notes: 'IconLayer — per-node procedural icon (synthetic canvas data-URIs, never real avatars).',
    docs: 'https://deck.gl/docs/api-reference/layers/icon-layer',
  },
  {
    feature: 'curved-edges', featureLabel: 'Curved edges', category: 'structure',
    library: 'deck.gl', support: 'native', kind: 'graph',
    page: 'cap-deck-curvededges.html',
    notes: 'PathLayer fed quadratic-bezier paths — native 2D curved links (ArcLayer is the 3D-arc alternative).',
    docs: 'https://deck.gl/docs/api-reference/layers/path-layer',
  },

  // ---- Batch B: cosmos.gl (bare @cosmos.gl/graph engine, simulation off) ----
  {
    feature: 'points', featureLabel: 'Points / scatter', category: 'encode',
    library: 'cosmos.gl', support: 'native', kind: 'points', n: 2000,
    page: 'cap-cosmos-points.html',
    notes: 'GPU point rendering — setPointPositions / setPointColors / setPointSizes.',
    docs: 'https://github.com/cosmosgl/graph',
  },
  {
    feature: 'lines', featureLabel: 'Lines / edges', category: 'encode',
    library: 'cosmos.gl', support: 'native', kind: 'graph',
    page: 'cap-cosmos-lines.html',
    notes: 'GPU link rendering — setLinks (index pairs).',
    docs: 'https://github.com/cosmosgl/graph',
  },
  {
    feature: 'curved-edges', featureLabel: 'Curved edges', category: 'structure',
    library: 'cosmos.gl', support: 'native', kind: 'graph',
    page: 'cap-cosmos-curvededges.html',
    notes: 'Curved links via the curvedLinks config (GPU-tessellated).',
    docs: 'https://github.com/cosmosgl/graph',
  },
  {
    feature: 'pick-tooltip', featureLabel: 'Pick / hover tooltip', category: 'interact',
    library: 'cosmos.gl', support: 'native', kind: 'graph', interaction: true,
    page: 'cap-cosmos-pick.html',
    notes: 'Native onPointMouseOver / onPointMouseOut hover callbacks.',
    docs: 'https://github.com/cosmosgl/graph',
  },
  {
    feature: 'labels', featureLabel: 'Labels', category: 'annotate',
    library: 'cosmos.gl', support: 'workaround', kind: 'graph',
    page: 'cap-cosmos-labels.html',
    notes: 'No native text — labels are an HTML overlay via trackPointPositionsByIndices + spaceToScreenPosition (the pattern the Cosmograph wrapper packages as its labels feature).',
    docs: 'https://github.com/cosmosgl/graph',
  },

  // ---- Batch C: Helios-Web (helios-web 0.9.8-beta) ----
  {
    feature: 'points', featureLabel: 'Points / scatter', category: 'encode',
    library: 'helios-web', support: 'native', kind: 'points', n: 2000,
    page: 'cap-helios-points.html',
    notes: 'Typed-array WebGL node rendering.',
    docs: 'https://filipinascimento.github.io/helios-web/',
  },
  {
    feature: 'lines', featureLabel: 'Lines / edges', category: 'encode',
    library: 'helios-web', support: 'native', kind: 'graph',
    page: 'cap-helios-lines.html',
    notes: 'WebGL edge rendering.',
    docs: 'https://filipinascimento.github.io/helios-web/',
  },
  {
    feature: 'pick-tooltip', featureLabel: 'Pick / hover tooltip', category: 'interact',
    library: 'helios-web', support: 'native', kind: 'graph', interaction: true,
    page: 'cap-helios-pick.html',
    notes: 'Native onNodeHoverStart / onNodeHoverEnd callbacks; hover target located via Helios pickPoint.',
    docs: 'https://filipinascimento.github.io/helios-web/',
  },
  {
    feature: 'labels', featureLabel: 'Labels', category: 'annotate',
    library: 'helios-web', support: 'native', kind: 'graph',
    page: 'cap-helios-labels.html',
    notes: 'Native label tracking — trackAttribute runs a GPU pass that selects nodes to label and returns each one’s on-screen centroid; the onTrack callback places the label DOM.',
    docs: 'https://filipinascimento.github.io/helios-web/',
  },
  {
    feature: 'density-map', featureLabel: 'Density map / heatmap', category: 'aggregate',
    library: 'helios-web', support: 'native', kind: 'points', n: 4000,
    page: 'cap-helios-density.html',
    notes: 'Native density plot — the config.density option runs a DensityGL kernel-density-estimation pass (GPU screen-space aggregation into a smooth field). Corrects the earlier survey that wrongly recorded this as unsupported.',
    docs: 'https://filipinascimento.github.io/helios-web/',
  },

  // ---- re-survey corrections (audit of the 'none' cells) ----
  {
    feature: 'node-images', featureLabel: 'Node images / borders', category: 'annotate',
    library: 'cosmos.gl', support: 'native', kind: 'graph',
    page: 'cap-cosmos-nodeimage.html',
    notes: 'Native per-node images — setImageData(ImageData[]) + setPointImageIndices() + setPointImageSizes() (images render above point shapes). Corrects the earlier survey that wrongly recorded this as unsupported. Icons are procedural, never real avatars.',
    docs: 'https://github.com/cosmosgl/graph',
  },
  {
    feature: 'curved-edges', featureLabel: 'Curved edges', category: 'structure',
    library: 'three.js', support: 'workaround', kind: 'points', n: 60,
    page: 'cap-three-curvededges.html',
    notes: 'No graph model, but three draws curves — a THREE.QuadraticBezierCurve3 per edge sampled to a Line (TubeGeometry for width). Corrects the earlier survey that wrongly recorded this as not applicable.',
    docs: 'https://threejs.org/docs/#api/en/extras/curves/QuadraticBezierCurve3',
  },
  {
    feature: 'density-map', featureLabel: 'Density map / heatmap', category: 'aggregate',
    library: 'cosmos.gl', support: 'workaround', kind: 'points', n: 2500,
    page: 'cap-cosmos-density.html',
    notes: 'No native density primitive — computes each point’s local density (neighbours in a radius) and colour-encodes it via setPointColors (blue→red), the same approximation three.js uses.',
    docs: 'https://github.com/cosmosgl/graph',
  },
  {
    feature: 'density-map', featureLabel: 'Density map / heatmap', category: 'aggregate',
    library: 'sigma.js', support: 'workaround', kind: 'points', n: 2000,
    page: 'cap-sigma-density.html',
    notes: 'No native density primitive — renders a dense node cloud and colour-encodes each node’s local density (neighbours in a radius) on a blue→red ramp, the same approximation three.js uses.',
    docs: 'https://www.sigmajs.org/docs/',
  },

  // ---- layout / force simulation (compute) ----
  {
    feature: 'layout', featureLabel: 'Layout / force simulation', category: 'compute',
    library: 'cosmos.gl', support: 'native', kind: 'graph',
    page: 'cap-cosmos-layout.html',
    notes: 'GPU force simulation (enableSimulation) — scatters the graph to a random start, lets the GPU sim organise it, then freezes the computed layout. Throughput is in the Layout-compute benchmark on the Graph page.',
    docs: 'https://github.com/cosmosgl/graph',
  },
  // Helios-Web layout stays SURVEYED (capability-survey.json): its native force layout is real
  // (proven in the Layout-compute benchmark) but over-contracts a 54-node demo graph into an
  // illegible clump, so a clean gate-verifiable capability screenshot isn't obtainable here.
  {
    feature: 'layout', featureLabel: 'Layout / force simulation', category: 'compute',
    library: 'sigma.js', support: 'workaround', kind: 'graph',
    page: 'cap-sigma-layout.html',
    notes: 'Sigma renders but has no layout of its own — positions come from the graphology-layout-forceatlas2 CPU companion (a fresh force-atlas layout computed from a random start).',
    docs: 'https://graphology.github.io/standard-library/layout-forceatlas2.html',
  },
  // ---- 3D rendering (encode) ----
  {
    feature: '3d', featureLabel: '3D rendering', category: 'encode',
    library: 'three.js', support: 'native', kind: 'points', n: 3000,
    page: 'cap-three-3d.html',
    notes: 'A 3D engine outright — perspective camera, OrbitControls, depth-sorted scene; size-attenuated point sprites.',
    docs: 'https://threejs.org/docs/#api/en/cameras/PerspectiveCamera',
  },
  {
    feature: '3d', featureLabel: '3D rendering', category: 'encode',
    library: 'deck.gl', support: 'native', kind: 'points', n: 3000,
    page: 'cap-deck-3d.html',
    notes: "OrbitView + PointCloudLayer — deck's native 3D camera over binary typed-array attributes (the same pattern as the 3D benchmark).",
    docs: 'https://deck.gl/docs/api-reference/core/orbit-view',
  },
  {
    feature: '3d', featureLabel: '3D rendering', category: 'encode',
    library: 'cosmos.gl', support: 'plugin', kind: 'points', n: 3000,
    page: 'cap-cosmos-3d.html',
    notes: "Via the author's experimental 3D fork @cosmograph/cosmos (spaceDimensions: 3 — perspective orbit camera, sphere-shaded points), not in mainline @cosmos.gl/graph. Benchmarked on the 3D / manifold page.",
    docs: 'https://www.npmjs.com/package/@cosmograph/cosmos',
  },
];

async function runOne(browser, ex, prov) {
  const libSlug = CAP_LIB_SLUG[ex.library] || ex.library;
  const dataset = ex.kind === 'graph' ? `synthetic_graph_${GRAPH.nodes}`
    : ex.kind === 'points' ? `synthetic_points_${ex.n}`
    : ex.cloud;
  if (!SYNTHETIC.test(dataset)) throw new Error(`non-synthetic dataset "${dataset}" — refusing to screenshot`);
  const url = ex.kind === 'cloud' ? `${BASE}/${ex.page}?c=${ex.cloud}` : `${BASE}/${ex.page}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120000);
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__bench && (window.__bench.ready || window.__bench.error), null, { timeout: 120000 });
    const appErr = await page.evaluate(() => window.__bench.error || null);
    if (appErr) throw new Error('app: ' + appErr);

    const renderer = await page.evaluate(readGL);
    const software = /swiftshader|llvmpipe|software/i.test(renderer);
    const gpu = gpuGate({ renderer, software });
    await page.evaluate(() => window.__bench.setCamera('overview'));
    await sleep(1500);
    const engine = await page.evaluate(() => window.__bench.counts());
    // graph coverage is a REAL check (not n/a) — the deterministic generator gives exact N/M
    const expected = ex.kind === 'graph' ? { nodes: GRAPH.nodes, edges: GRAPH.edges }
      : ex.kind === 'points' ? { points: ex.n }
      : cloudExpected(MANIFEST, ex.cloud);
    const coverage = coverageGate({ engine, expected });

    // interaction gate (pick/hover examples): a synthetic hover at hoverTarget → assert pick fired
    let interaction;
    if (ex.interaction) {
      const box = await page.locator('#view').boundingBox();
      const tgt = await page.evaluate(() => window.__bench.hoverTarget());
      await page.evaluate(() => window.__bench.clearPick && window.__bench.clearPick());
      await page.mouse.move(box.x + tgt.x, box.y + tgt.y, { steps: 4 });
      await sleep(500);
      const picked = await page.evaluate(() => window.__bench.lastPick);
      const tooltip = await page.evaluate(() => { const t = document.getElementById('tooltip'); return !!t && t.style.display === 'block'; });
      interaction = interactionGate({ picked, tooltip });
      await page.mouse.move(box.x + 6, box.y + 6); // off the node → clean screenshot
      await page.evaluate(() => window.__bench.clearPick && window.__bench.clearPick());
      await sleep(150);
    }

    await startProbe(page, 3000);
    await page.evaluate((ms) => window.__bench.orbit(ms), 3000);
    await sleep(3000);
    const m = await readProbe(page);

    const presentation = await presentationWeb(page, { selector: '#view' });
    mkdirSync(SHOTS, { recursive: true });
    const shotFile = `${ex.feature}-${libSlug}.png`;
    await page.evaluate(() => { const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden'; }); // surface-only: drop the HUD
    if (ex.interaction) { // re-hover so the tooltip shows in the screenshot (conveys the pick)
      const box = await page.locator('#view').boundingBox();
      const tgt = await page.evaluate(() => window.__bench.hoverTarget());
      await page.mouse.move(box.x + tgt.x, box.y + tgt.y, { steps: 2 });
      await sleep(350);
    }
    await sleep(150);
    await page.locator('#view').screenshot({ path: join(SHOTS, shotFile) });

    const scale = ex.kind === 'graph'
      ? { nodes: engine.nodes, edges: engine.edges, fps: m.fps }
      : { atPoints: engine.points ?? null, fps: m.fps };
    return makeCapability({
      feature: ex.feature, featureLabel: ex.featureLabel, category: ex.category, library: ex.library,
      support: ex.support, example: ex.page, dataset, notes: ex.notes, docs: ex.docs,
      scale,
      screenshot: `features/assets/${shotFile}`,
      gpu: { renderer, software },
      gateResults: { gpu, coverage, presentation, ...(interaction ? { interaction } : {}) },
      provenance: prov,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

const prov = provenance();
const server = await startServer({ base: BASE, args: [] });
const browser = await launchBrowser({ headless: true });
const only = process.argv[2]; // optional: run a subset (match page/feature/library substring)
const toRun = EXAMPLES.filter((ex) => !only || ex.page.includes(only) || ex.feature.includes(only) || ex.library.includes(only));
const records = [];
try {
  for (const ex of toRun) {
    process.stdout.write(`▶ ${ex.feature.padEnd(14)} ${ex.library.padEnd(9)} … `);
    const rec = await runOne(browser, ex, prov);
    records.push(rec);
    console.log(`${rec.evidence.toUpperCase()}  fps=${rec.scale?.fps}  present=${rec.verified?.presentation ? '✓' : '✗'}  → ${rec.screenshot}`);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}

mkdirSync(join(HERE, 'results'), { recursive: true });
// A full run (no filter) is authoritative → overwrite. A FILTERED run merges into the existing set,
// replacing only the (feature,library) cells it re-ran (so iterating on one example keeps the rest).
let out = records;
if (only) {
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8'));
    const key = (r) => `${r.feature}::${r.library}`;
    const fresh = new Set(records.map(key));
    out = [...prev.filter((r) => !fresh.has(key(r))), ...records];
  } catch {}
}
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\nwrote ${OUT} — ${records.filter((r) => r.evidence === 'verified').length}/${records.length} re-run verified`);
