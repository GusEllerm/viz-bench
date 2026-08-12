// Content spec — the report AS DATA. Per page, an ordered list of sections; data-driven
// sections carry a query resolved against the sanitized dataset at build time, authored
// content is terse and genericized (NO machine/renderer/commit — the leak test enforces it).
// Gated-only: only the graph-overview + manifold point-cloud data exist, so that is all the
// site shows. Headline metrics in verdict cards are data-bound (query+field), never typed.

export const ROW_LABELS = {
  graph: { sigmapre: 'Sigma.js', helios: 'Helios-Web', deck: 'deck.gl', cosmographpre: 'Cosmograph', cosmographnoblend: 'Cosmograph · opaque' },
  manifold: { datoviz: 'Datoviz · windowed', deck: 'deck.gl', three: 'three.js', cosmos3d: 'cosmos.gl · 3D fork' },
};
export const COL_LABELS = {
  graph: { medical_device: '156K e', drug: '363K e', semiconductor: '604K e', combined: '1.1M e' },
  manifold: { swiss_roll_100000: '100K', swiss_roll_1000000: '1M', graph_combined_umap3: 'graph 139K', swiss_roll_10000000: '10M', swiss_roll_20000000: '20M', swiss_roll_50000000: '50M' },
};
const GRAPH_TOOLS = ['sigmapre', 'helios', 'deck', 'cosmographpre', 'cosmographnoblend']; // Cosmograph shown default + opaque (bare cosmos.gl engine rows collapsed away)
const GRAPH_MATRIX_TOOLS = GRAPH_TOOLS;
const GRAPH_DATASETS = ['medical_device', 'drug', 'semiconductor', 'combined'];
const M_RENDERERS = ['datoviz', 'deck', 'three', 'cosmos3d'];
const M_CLOUDS = ['swiss_roll_100000', 'swiss_roll_1000000', 'graph_combined_umap3', 'swiss_roll_10000000', 'swiss_roll_20000000', 'swiss_roll_50000000'];
const M_WALL = ['swiss_roll_100000', 'swiss_roll_1000000', 'swiss_roll_10000000', 'swiss_roll_20000000', 'swiss_roll_50000000']; // swiss_roll only on the line

const METHODOLOGY = {
  type: 'methodology',
  summary: 'How it was measured — the five gates',
  bullets: [
    'Real GPU, verified: every run checks it ran on Apple-Silicon hardware (Metal GPU), never a software fallback.',
    'Coverage: the engine must actually load the whole dataset (engine-reported counts vs the loaded file).',
    'Presentation: the surface must actually present — a pixel-diff under a camera delta (web) or a windowed swapchain, not an offscreen loop (native). This is what corrected the "200 fps @50M" Datoviz figure to its real windowed 5 fps.',
    'Camera-state: every number records the camera state it was measured in (here: the full-graph overview / orbit).',
    'Input-honesty: motion is engine-API driven, not a synthetic uncoalesced event stream (the artifact that once mis-scored Cosmograph at 5 fps).',
    'A cell is published only if all five gates pass; a failure quarantines the number, it is never silently shown.',
  ],
};

// ---- feature / capability registry ----
export const CAP_LIBRARIES = ['deck.gl', 'sigma.js', 'cosmos.gl', 'three.js', 'helios-web'];
export const CAP_LIB_LABELS = { 'deck.gl': 'deck.gl', 'sigma.js': 'Sigma.js', 'cosmos.gl': 'cosmos.gl', 'three.js': 'three.js', 'helios-web': 'Helios-Web' };
// Single source of truth for the URL-safe library slug — used by the harness (screenshot
// filename), the matrix cell anchor href, and the subpage <figure id>. Never hand-type it.
export const CAP_LIB_SLUG = { 'deck.gl': 'deck', 'sigma.js': 'sigma', 'cosmos.gl': 'cosmos', 'three.js': 'three', 'helios-web': 'helios' };
export const CATEGORY_LABELS = { encode: 'Encode', aggregate: 'Aggregate / derive', interact: 'Interact', annotate: 'Annotate', structure: 'Structure', compute: 'Compute / layout', navigate: 'Navigate', integrate: 'Integrate' };
// Authored per-feature prose + ordering. Support/evidence live in the data (capability-survey.json
// + the harness); this drives the matrix rows and the per-feature subpages.
export const FEATURES = [
  { id: 'density-map', label: 'Density map / heatmap', category: 'aggregate',
    docs: 'https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer',
    blurb: 'Screen-space aggregation of many points into a smooth density field — the “where is it dense” view. GPU-aggregated in deck.gl (HeatmapLayer); other renderers need a custom shader or don’t offer it.' },
  { id: 'points', label: 'Points / scatter', category: 'encode', docs: '',
    blurb: 'The base primitive — every benchmarked renderer draws points / nodes on the GPU. This is the row the whole speed benchmark stands on.' },
  { id: 'lines', label: 'Lines / edges', category: 'encode', docs: '',
    blurb: 'Edges / links. Cheap as hairlines; the expensive primitive when alpha-blended and dense (the graph-overview wall is edge overdraw).' },
  { id: '3d', label: '3D rendering', category: 'encode', docs: '',
    blurb: 'A true 3D scene — perspective camera, orbit interaction, depth. Native in three.js and deck.gl (OrbitView) and in Helios (2D is its default mode); Sigma is 2D by design. The cosmos.gl engine gains 3D in the author’s experimental @cosmograph/cosmos fork, measured on the 3D / manifold page.' },
  { id: 'pick-tooltip', label: 'Pick / hover tooltip', category: 'interact', docs: '',
    blurb: 'Identify the element under the cursor and show its detail. Built in for the graph libraries and deck.gl (pickable + getTooltip); three.js needs a raycaster.' },
  { id: 'labels', label: 'Labels', category: 'annotate', docs: '',
    blurb: 'Text on nodes / points, usually with a level-of-detail threshold so labels don’t overwhelm the overview.' },
  { id: 'node-images', label: 'Node images / borders', category: 'annotate', docs: '',
    blurb: 'Per-node icons / avatars or ringed borders. Native in deck.gl (IconLayer), a Sigma plugin; the uniform-GPU-point renderers don’t offer per-node images.' },
  { id: 'curved-edges', label: 'Curved edges', category: 'structure', docs: '',
    blurb: 'Arced edges to separate parallel or bidirectional links. A Sigma plugin (@sigma/edge-curve); native in cosmos.gl and deck.gl (ArcLayer).' },
  { id: 'layout', label: 'Layout / force simulation', category: 'compute', docs: 'https://cosmograph.app/',
    blurb: 'Compute node positions from graph structure (force-directed simulation) — the step before anything can be rendered. cosmos.gl runs the simulation on the GPU; Helios has a native force layout; Sigma uses the graphology-layout CPU companion; deck.gl and three.js expect positions you bring. Throughput is measured in the Layout-compute benchmark on the Graph page (GPU simulation vs CPU force-atlas).' },
];

export const PAGES = [
  {
    id: 'index', file: 'index.html', current: 'Overview',
    title: 'Large-Data Visualisation — Benchmark',
    subtitle: 'Interactive rendering limits for <b>large graphs</b> and <b>3D point clouds</b>, on real <b>Apple-Silicon hardware (Metal GPU)</b> — every figure gate-verified, not a vendor claim.',
    sections: [
      {
        type: 'hero',
        lead: 'Choosing a library to render a lot of data interactively? It comes down to your data&rsquo;s shape. These are the two problems this benchmark covers — the fastest library measured for each, and the wall it eventually hits:',
        cards: [
          { tag: 'Large graphs & networks', title: 'Sigma.js',
            metric: { domain: 'graph', tool: 'sigmapre', dataset: 'combined', field: 'fpsCont', fmt: 'fps' }, suffix: ' rendering the 1.1M overview every frame',
            body: 'Nodes joined by edges — the costly primitive — so the whole-graph overview is the stress test. Sigma leads: buttery under light interaction, and still fastest when forced to render every frame (~53 fps at 1.1M, hairline edges). The field tightens under that continuous test — Cosmograph&rsquo;s opaque-link mode is 2nd (~33), then deck.gl (~17) and Helios (~15). (Two metrics because on-demand renderers idle between frames — see Graph.)' },
          { tag: 'Large 3D point clouds', title: 'deck.gl ≈ three.js',
            prefix: '~', metric: { domain: 'manifold', tool: 'deck', dataset: 'swiss_roll_1000000', field: 'fps', fmt: 'fps' }, suffix: ' to 1M points',
            body: 'Points in 3D space — embeddings, manifolds, 3D scans. Cheap to draw: deck.gl and three.js run neck-and-neck and buttery to ~1M points. The catch is the scale wall past ~10M — no renderer, web or native, stays smooth there (even windowed native Datoviz is ~5 fps at 50M). Beyond it, the only lever is level-of-detail or tiling.' },
        ],
        trust: '<span class="badge">every cell verified</span> <span>Every number here cleared <b>five fail-loud gates</b> — real GPU · full data coverage · true on-screen presentation · recorded camera state · honest input — or it was quarantined, never shown. The five gates are detailed at the foot of this page.</span>',
      },
      { type: 'chart', id: 'idx-graph', chart: 'bars',
        title: 'Graph overview — continuous render fps (the full graph, rendering every frame)',
        rows: GRAPH_TOOLS, cols: GRAPH_DATASETS, domain: 'graph', field: 'fpsCont',
        caption: 'Render-every-frame fps — the apples-to-apples number (the Graph page also shows a gentle-pan number, where renderers that repaint only on change idle higher). Sigma leads; Cosmograph·opaque is 2nd once every engine renders every frame; turning link alpha-blending off lifts it ~3–5× (see Graph).' },
      { type: 'chart', id: 'idx-wall', chart: 'logline', tall: true,
        title: 'The 3D wall — interactive fps vs point count (log scale)',
        series: M_RENDERERS, clouds: M_WALL, domain: 'manifold',
        caption: 'Swiss-roll point clouds; the real-graph 139K manifold tracks the 1M column (~120 fps). Past 10M no renderer — web or native — clears 60 fps.' },
      { type: 'navcards', items: [
        { href: 'graph.html', title: 'Graph deep-dive →', body: 'Sigma · Helios · deck.gl · Cosmograph across four real knowledge graphs (156K–1.1M edges).' },
        { href: 'manifold.html', title: '3D / manifold deep-dive →', body: 'deck · three · windowed Datoviz · the cosmos.gl 3D fork across 100K–50M points.' },
      ] },
      METHODOLOGY,
    ],
  },
  {
    id: 'graph', file: 'graph.html', current: 'Graph',
    title: 'Graph / network visualisation',
    subtitle: 'An interactive, embeddable view of the benchmark knowledge graph — up to <b>139,442 nodes / 1.1M edges</b>. Edges are the expensive primitive, so this is the harder rendering problem.',
    sections: [
      { type: 'note', html: 'Headline = the <b>overview</b>: the full graph on screen at the fit view (a renderer can look fast zoomed-in when most edges are off-screen). We report <b>two</b> fps numbers for it — both render the same <b>precomputed</b> graph, but under different demand: a gentle pan (which leaves idle frames between movements) versus a repaint forced <i>every</i> frame. The note under the tables explains why they diverge.' },
      { type: 'matrix', id: 'graph-matrix', domain: 'graph', rows: GRAPH_MATRIX_TOOLS, cols: GRAPH_DATASETS, field: 'fps',
        title: 'Gentle pan · fps', caption: 'fps under a gentle human-rate pan — how smooth light exploration feels. Green ≥60, amber 30–59, red <30; per-column best in bold. A pan leaves idle frames between movements; renderers that repaint only on change skip them and sit at the display refresh (why several stay at ~120).' },
      { type: 'matrix', id: 'graph-matrix-cont', domain: 'graph', rows: GRAPH_MATRIX_TOOLS, cols: GRAPH_DATASETS, field: 'fpsCont',
        title: 'Continuous render · fps', caption: 'fps when every frame is repainted, no idle frames — raw render throughput, and what you get during an animation or a continuous drag. Median of 3; same colour bands.' },
      { type: 'note', html: '<b>Two numbers, because a gentle pan leaves idle frames and a continuous render doesn&rsquo;t.</b> Both tables render the same fixed graph and both are interactive — the difference is cadence. Renderers that repaint <i>only when the view changes</i> — Sigma, Helios, deck.gl — skip the idle frames a gentle pan leaves, so they sit at the display refresh: that number is smoothness plus a free idle (a real advantage for a mostly-static graph), not render throughput. Forced to repaint every frame, <b>Sigma drops 120→53</b> and <b>Helios 94→15</b> at 1.1M, while <b>Cosmograph barely moves</b> (13→12 — it already repaints every frame, so it never got the idle discount). The continuous table reorders the field: <b>Cosmograph · opaque rises to 2nd</b> (33 fps at 1.1M, past deck.gl and Helios), and Sigma&rsquo;s lead narrows from ~2.4× to ~1.6×.' },
      { type: 'note', html: '<b>The linkBlending finding holds under both:</b> turning link alpha-blending off (<b>Cosmograph · opaque</b>) lifts the dense overview ~3–5× — gentle-pan <b>18→82 fps at 604K</b> and <b>13→50 at 1.1M</b>; continuous <b>19→58</b> and <b>12→33</b> — clearing the overdraw wall this report first flagged (<code>linkBlending:false</code>, a cosmos.gl 3.1 engine setting). The trade-off: overlapping links no longer darken (no density shading).' },
      { type: 'chart', id: 'graph-bars', chart: 'bars', rows: GRAPH_TOOLS, cols: GRAPH_DATASETS, domain: 'graph', field: 'fpsCont',
        title: 'Continuous render throughput, charted (the fair, render-every-frame fps)', caption: 'Hover any bar for fps · p95 · gate-pass.' },
      { type: 'note', html: 'A separate axis from rendering. Everything above uses <b>precomputed</b> node positions, to isolate <i>rendering</i> — but computing that force-directed layout is itself a cost, and where it runs (GPU or CPU) determines how it scales. The render benchmark sets this aside, so it is measured here. Below: force-layout throughput on synthetic graphs — the GPU force simulations (cosmos.gl, Helios) against the CPU force-atlas (graphology FA2) that produces the &ldquo;precomputed&rdquo; positions in the first place.' },
      { type: 'layout-chart', id: 'layout-bars', title: 'Layout compute — force-layout throughput (iterations/sec)', yMax: 45,
        engines: [
          { engine: 'cosmos', label: 'cosmos.gl · GPU', color: '#0e8a6e' },
          { engine: 'helios', label: 'Helios-Web · native', color: '#8250df' },
          { engine: 'fa2', label: 'graphology FA2 · CPU', color: '#656d76' },
        ],
        scales: [{ n: 100000, label: '100K nodes' }, { n: 500000, label: '500K' }, { n: 1000000, label: '1M' }],
        caption: 'Force-layout iterations/sec (synthetic graphs, ~4 edges/node); higher = faster. At 10K nodes all three are pegged at the display refresh (~120), so the chart starts at 100K. A missing bar = not measured (CPU force-atlas past 500K is minutes per iteration) or did not sustain live layout (Helios past 100K). cosmos figures draw points but not links, so the rate reflects the GPU sim step rather than link overdraw.' },
      { type: 'note', html: 'Running the force simulation on the GPU computes the layout roughly <b>30–40× faster</b> than the CPU force-atlas at these scales — 39 vs 1.3 iters/sec at 100K nodes, 10 vs 0.24 at 500K — and continues to 1M, where the CPU approach is impractical (minutes per iteration, blocking the main thread). It is also incremental: the GPU sim renders each step, so the graph settles on screen, where the CPU force-atlas blocks until it finishes. For a graph whose positions are already computed, the render figures above apply instead — a different question with a different answer.' },
      { type: 'takeaways', items: [
        { bind: { domain: 'graph', tool: 'sigmapre', dataset: 'combined', field: 'fpsCont', fmt: 'fps' },
          text: 'Sigma leads both metrics, but its edge is a real rendering one, not just an idle one: forced to render the 1.1M-edge overview every frame it still holds {} (hairline edges), where deck.gl and Cosmograph·opaque land in the 20s–30s and Helios in the teens.' },
        { bind: { domain: 'graph', tool: 'deck', dataset: 'combined', field: 'memMB', fmt: 'mb' },
          text: 'Resource cost still splits the field: deck.gl is featherweight ({} at 1.1M — binary typed-array buffers) while Sigma trades ~586 MB for its speed.' },
      ] },
      { type: 'methodology', summary: 'How each library is configured (and how it repaints)', bullets: [
        '<b>Sigma.js</b> — 1px hairline edges, <b>repaint-on-demand</b> (idle frames cost nothing), precomputed FA2 layout.',
        '<b>Helios-Web</b> — WebGL 1px fast-edge mode, <b>repaint-on-demand</b>, precomputed layout.',
        '<b>deck.gl</b> — LineLayer over binary typed-array buffers, <b>repaint-on-demand</b>, precomputed layout.',
        '<b>Cosmograph</b> — the product (duckdb-wasm data prep, labels, hover / link-picking) on the cosmos.gl engine, GPU simulation disabled (precomputed layout); <b>redraws every frame</b> (continuous), default alpha-blended links.',
        '<b>Cosmograph · opaque</b> — the same, with link alpha-blending turned off (<code>linkBlending:false</code>, a cosmos.gl 3.1 engine setting) — the 3–5× dense-overview lift; the cost is losing the density shading of overlapping links.',
        'The two fps columns: <b>gentle pan</b> = a ~30 events/s pan (renderers that repaint only on change idle at the display refresh between events); <b>continuous</b> = force-repaint the fixed overview every frame via each engine&rsquo;s own render call (median of 3), so every engine renders every frame.',
      ] },
      METHODOLOGY,
    ],
  },
  {
    id: 'manifold', file: 'manifold.html', current: '3D / manifold',
    title: '3D / manifold (point-cloud) visualisation',
    subtitle: 'Point clouds — the benchmark graph projected into 3D (139K points) plus synthetic manifolds scaled to <b>50M points</b>. Far cheaper to render than edge-dense graphs, until the scale wall.',
    sections: [
      { type: 'note', html: 'The interaction is sustained <b>orbit</b>, measured in a real window (swapchain present) — Datoviz&rsquo;s famous offscreen/batch throughput is a different, non-interactive number and is excluded. Point clouds are cheap to render to ~1M points; the whole story is the wall past 10M.' },
      { type: 'matrix', id: 'man-matrix', domain: 'manifold', rows: M_RENDERERS, cols: M_CLOUDS,
        title: 'Interactive fps', caption: 'fps; green ≥60 smooth, amber 30–59, red <30. Per-column best in bold. Swiss-roll clouds + the real-graph 139K manifold.' },
      { type: 'note', html: '<b>cosmos.gl · 3D fork</b> is <code>@cosmograph/cosmos</code>, an experimental 3D mode for the cosmos.gl engine. It is measured like the other web rows — precomputed positions, GPU simulation off, points only — and lands in the WebGL band throughout: level with deck.gl and three.js to 1M, between them at 10–20M, and past the wall at 50M like everything else. Its automatic camera-fit path fails once points &times; dimensions exceeds 2&#178;&#8311; coordinates (~44.7M points in 3D — a JS array limit in the position readback, reported upstream), so the harness frames the camera from the dataset&rsquo;s own bounds (details in the configuration drawer).' },
      { type: 'chart', id: 'man-wall', chart: 'logline', tall: true, series: M_RENDERERS, clouds: M_WALL, domain: 'manifold',
        title: 'The same data on a log scale — the wall past 10M', caption: 'Swiss-roll clouds (the real-graph 139K manifold tracks the 1M column at ~120 fps). Dashed line = 60 fps; past 10M no renderer, web or native, clears it.' },
      { type: 'takeaways', items: [
        { bind: { domain: 'manifold', tool: 'deck', dataset: 'swiss_roll_1000000', field: 'fps', fmt: 'fps' },
          text: 'To ~1M points everything is GPU-headroom-bound (~{}); deck.gl and three.js are tied and the real-graph manifold is trivially interactive.' },
        { bind: { domain: 'manifold', tool: 'datoviz', dataset: 'swiss_roll_50000000', field: 'fps', fmt: 'fps' },
          text: 'No interactive escape past ~10M: windowed Datoviz reads {} at 50M — the same band as the WebGL renderers. Its famous ~200 fps @50M was offscreen-only (no swapchain present). The only lever past 10M is LOD / tiling.' },
      ] },
      { type: 'methodology', summary: 'How each library is configured', bullets: [
        '<b>deck.gl</b> — PointCloudLayer (1.5 px points) over binary typed-array attributes, OrbitView, repaint-on-demand driven every frame by the sustained orbit.',
        '<b>three.js</b> — THREE.Points (1.5 px, no size attenuation), OrbitControls auto-rotate, continuous render loop.',
        '<b>Datoviz · windowed</b> — native Vulkan in a real window (swapchain present), sustained orbit; its offscreen/batch mode is excluded.',
        '<b>Point-size parity (measured):</b> every web row asks its engine for the same nominal 1.5 px point. Because engines rasterise differently (opaque squares vs antialiased discs), the measured footprint at that setting is cosmos 1.8 · three.js 2.7 · deck.gl 7.1 px²/point (probe: 25 isolated points, lit-pixel count). A sensitivity run with sizes tuned to <i>equal</i> ~2.7 px² footprints (three 1.5 / deck 0.9 / cosmos 2.0) moved 10M-point fps by under 10% per engine and did not change the ordering — point size does not explain the ranking, so the published rows keep the equal-nominal-size configuration.',
        '<b>cosmos.gl · 3D fork</b> — <code>@cosmograph/cosmos</code> with <code>spaceDimensions: 3</code> (perspective orbit camera), GPU simulation off, 1.5 px points, otherwise the fork&rsquo;s shipped 3D defaults (depth-fade on). The camera is framed from the dataset&rsquo;s bounding box with explicit near/far planes: the engine&rsquo;s automatic fit/bounds path breaks once points &times; dimensions exceeds 2&#178;&#8311; (~44.7M points in 3D, ~67.1M in 2D — mis-framed camera, scene depth-clipped to slivers) — reported upstream with a minimal repro. The orbit advances the engine&rsquo;s own camera state once per frame, so every measured frame is a real redraw.',
      ] },
      METHODOLOGY,
    ],
  },
  {
    id: 'features', file: 'features.html', current: 'Features',
    title: 'Feature / capability registry',
    subtitle: 'Beyond raw speed — <b>which libraries do what</b>. A <b>green cell</b> is a gate-verified example (it renders and passes the gates); everything else is <b>surveyed</b> from the library&rsquo;s docs. The glyph shows support level.',
    sections: [
      { type: 'note', html: 'The benchmark answers “how fast”; this answers “can it do X at all”. Two axes: <b>support</b> is what the library offers (shown by the glyph — ✓ native · ◑ plugin / workaround · — none); <b>evidence</b> is our confidence (shown by the cell — a <b>green cell</b> has a working, gate-checked example that renders on the real GPU and changes when the camera moves; a plain cell is <b>surveyed</b> from the library’s docs/API, not yet verified). Click a feature — or a green cell — for its example + per-library detail.' },
      { type: 'capmatrix', caption: 'Rows = features, columns = libraries. Density is one row because “only deck.gl aggregates on the GPU” is itself the honest answer.' },
      { type: 'methodology', summary: 'How “verified” is earned', bullets: [
        'A verified cell has a real example page that implements the same contract as the benchmarks and passes the GPU gate (ran on the real Metal GPU) plus the presentation gate (a camera move visibly changes the pixels — proof it actually rendered, not a frozen frame).',
        'Verified examples use synthetic data only (the density map is a synthetic swiss-roll) — the proprietary dataset is never rendered into a public screenshot.',
        'Surveyed rows are the library’s documented capability, read from its API — useful breadth, but explicitly not gate-verified. As we build more examples, surveyed cells turn green (verified).',
      ] },
    ],
  },
];
