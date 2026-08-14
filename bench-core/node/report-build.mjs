// Page builder — resolves report-spec.mjs against the sanitized dataset, SERVER-RENDERS
// tables/verdicts/takeaways to static HTML (numbers visible with JS off + scannable by the
// leak test), emits chart specs the client instantiates, runs the leak test on every page,
// and writes docs/{index,graph,manifold}.html + assets/ + .nojekyll. Replaces report-gen.mjs.
//
//   node bench-core/node/report-build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { collect, leakTest } from './report-data.mjs';
import { PAGES, ROW_LABELS, COL_LABELS, FEATURES, CAP_LIBRARIES, CAP_LIB_LABELS, CAP_LIB_SLUG, CATEGORY_LABELS } from './report-spec.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ASSETS = join(HERE, '../report/assets');
const DOCS = join(HERE, '../../docs');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const find = (pub, q) => pub.find((r) => r.domain === q.domain && r.tool === q.tool && r.dataset === q.dataset);
const round1 = (v) => (v == null ? null : v >= 100 ? Math.round(v) : v < 10 ? +(+v).toFixed(1) : Math.round(v));
const fmtVal = (v, f) => {
  if (v == null) return '—';
  if (f === 'mb') return Math.round(v) + ' MB';
  return String(round1(v)); // fps
};
const band = (fps) => (fps == null ? '' : fps >= 60 ? 'g' : fps >= 30 ? 'a' : 'r');

// Per-series chart colour overrides, keyed by tool. Only set where we need to break the
// default index-palette: the two Cosmograph rows (default + opaque) are ONE tool, so give them
// the same hue in different shades. Unmapped tools fall back to the client's categorical palette.
const SERIES_COLORS = {
  cosmographpre: '#0e8a6e',      // Cosmograph — dark teal-green (its established colour)
  cosmographnoblend: '#5cc4a6',  // Cosmograph · opaque — light teal-green (same hue, lighter)
  cosmos3d: '#0e8a6e',           // cosmos.gl · 3D fork — the cosmos-family teal (manifold charts)
  helios: '#8250df',             // Helios-Web — purple (same hue family as its fast row)
  heliosfast: '#b6a3e8',         // Helios-Web · fast — light purple (same tool, lighter mode)
  sigmapre: '#0969da',           // Sigma.js — blue (pinned; palette fallback shifts with row count)
  deck: '#bf3989',               // deck.gl — magenta (pinned; the index fallback collided with Cosmograph's teal)
  three: '#bc4c00',              // three.js — burnt orange (pinned; deck's magenta pin displaced its old fallback)
  datoviz: '#0969da',            // Datoviz — blue (pinned for stability as rows change)
};

// ---- section renderers ----
function renderHero(sec, pub) {
  const cards = sec.cards.map((c) => {
    let metricHtml = '';
    if (c.metric) {
      const r = find(pub, c.metric);
      metricHtml = `<div class="m">${c.prefix || ''}${fmtVal(r ? r[c.metric.field] : null, c.metric.fmt)} fps${c.suffix || ''}</div>`;
      if (c.metric.fmt === 'mb') metricHtml = `<div class="m">${fmtVal(r ? r[c.metric.field] : null, 'mb')}${c.suffix || ''}</div>`;
    } else if (c.badge) {
      metricHtml = `<div class="m"><span class="badge">${esc(c.badge)}</span></div>`;
    }
    return `<div class="card${c.win ? ' win' : ''}"><div class="tag">${esc(c.tag)}</div><h4>${esc(c.title)}</h4>${metricHtml}<p>${c.body}</p></div>`;
  }).join('');
  const trust = sec.trust ? `\n<div class="trust-ribbon">${sec.trust}</div>` : '';
  return `<p class="lead">${sec.lead}</p>\n<div class="verdict">${cards}</div>${trust}`;
}

function renderMatrix(sec, pub) {
  const rl = ROW_LABELS[sec.domain], cl = COL_LABELS[sec.domain];
  const F = sec.field || 'fps'; // 'fps' = interactive (pan) | 'fpsCont' = continuous render
  const colMax = {};
  for (const c of sec.cols) colMax[c] = Math.max(...sec.rows.map((t) => find(pub, { domain: sec.domain, tool: t, dataset: c })?.[F] ?? -1));
  const head = `<th>${esc(sec.title || '')}</th>` + sec.cols.map((c) => `<th>${esc(cl[c] || c)}</th>`).join('');
  const body = sec.rows.map((t) => {
    const cells = sec.cols.map((c) => {
      const r = find(pub, { domain: sec.domain, tool: t, dataset: c });
      if (!r || r[F] == null) return '<td>—</td>';
      const win = r[F] === colMax[c] ? ' win' : '';
      return `<td class="${band(r[F])}${win}">${fmtVal(r[F], 'fps')}</td>`;
    }).join('');
    return `<tr data-librow="${esc(t)}"><td>${esc(rl[t] || t)}</td>${cells}</tr>`;
  }).join('\n    ');
  return `<table><thead><tr>${head}</tr></thead><tbody>\n    ${body}\n  </tbody>${sec.caption ? `<caption>${sec.caption}</caption>` : ''}</table>`;
}

function renderChart(sec, pub, chartSpecs) {
  const rl = ROW_LABELS[sec.domain];
  let spec;
  if (sec.chart === 'bars') {
    const cl = COL_LABELS[sec.domain];
    const F = sec.field || 'fps', P = F === 'fpsCont' ? 'p95Cont' : 'p95';
    spec = {
      id: sec.id, kind: 'bars', yMax: 130, refLine: 60, yLabel: 'fps',
      categories: sec.cols.map((c) => cl[c] || c),
      series: sec.rows.map((t) => ({
        label: rl[t] || t,
        color: SERIES_COLORS[t],
        values: sec.cols.map((c) => round1(find(pub, { domain: sec.domain, tool: t, dataset: c })?.[F])),
        meta: sec.cols.map((c) => { const r = find(pub, { domain: sec.domain, tool: t, dataset: c }); return r ? { p95: r[P], gates: r.gatesPass ? 'pass' : 'fail' } : null; }),
      })),
    };
  } else {
    spec = {
      id: sec.id, kind: 'logline', refLine: 60, xLabel: 'points (log)', yLabel: 'fps', // no yMax: the client scales to the data (Datoviz's uncapped present reads ~150-180)
      series: sec.series.map((t) => ({
        label: rl[t] || t,
        color: SERIES_COLORS[t],
        points: sec.clouds.map((c) => { const r = find(pub, { domain: sec.domain, tool: t, dataset: c }); return r ? { x: r.scale?.points, y: round1(r.fps), p95: r.p95, gates: r.gatesPass ? 'pass' : 'fail' } : null; }).filter(Boolean),
      })),
    };
  }
  chartSpecs.push(spec);
  return `<figure class="chart${sec.tall ? ' tall' : ''}" data-chart="${esc(sec.id)}">${sec.title ? `<figcaption>${esc(sec.title)}</figcaption>` : ''}<div class="canvas-wrap"><canvas></canvas></div>${sec.caption ? `<p class="fine">${sec.caption}</p>` : ''}<noscript><span class="nojs">Interactive chart needs JavaScript.</span></noscript></figure>`;
}

function renderTakeaways(sec, pub) {
  const lis = sec.items.map((it) => {
    const r = find(pub, it.bind);
    return `<li>${it.text.replace('{}', `<b>${fmtVal(r ? r[it.bind.field] : null, it.bind.fmt)}${it.bind.fmt === 'fps' ? ' fps' : ''}</b>`)}</li>`;
  }).join('\n    ');
  return `<h3>Key findings</h3>\n<ul>\n    ${lis}\n  </ul>`;
}

const renderNavCards = (sec) =>
  `<div class="verdict">${sec.items.map((it) => `<a class="card" href="${esc(it.href)}" style="color:inherit"><h4>${esc(it.title)}</h4><p>${it.body}</p></a>`).join('')}</div>`;
const renderNote = (sec) => `<div class="note">${sec.html}</div>`;
const renderMethodology = (sec) =>
  `<details class="method"><summary>${esc(sec.summary)}</summary><ul>${sec.bullets.map((b) => `<li>${b}</li>`).join('')}</ul></details>`;

// Orthogonal encoding: GLYPH = support (native ✓ · plugin/workaround ◑ · none —);
// BACKGROUND CLASS = evidence (verified → cap-verified green + a non-colour cue; else surveyed).
function capGlyph(c) {
  const s = c?.support;
  const supported = s && s !== 'none';
  const verified = supported && c?.evidence === 'verified';
  const sym = !supported ? '—' : (s === 'plugin' || s === 'workaround') ? '◑' : '✓';
  const cls = verified ? 'cap-verified' : supported ? 'cap-surveyed' : 'cap-none';
  const title = supported ? `${s}${verified ? ' · verified' : ' · surveyed'}` : 'not supported';
  return { sym, cls, verified, title };
}

// kind-aware fps caption (fixes the graph "at 0 points" bug — clouds report points, graphs nodes/edges).
function capScaleNote(scale) {
  if (!scale || scale.fps == null) return '';
  const held = ` Held <b>${round1(scale.fps)} fps</b>`;
  if (scale.nodes != null) return `${held} at ${scale.nodes.toLocaleString()} nodes / ${(scale.edges ?? 0).toLocaleString()} edges.`;
  if (scale.atPoints != null) return `${held} at ${scale.atPoints.toLocaleString()} points.`;
  return `${held}.`;
}

// capability matrix — features (rows) × libraries (cols). Only on features.html (base ''), so
// feature links point down into features/<id>.html.
function renderCapMatrix(sec, caps) {
  const capOf = (feat, lib) => caps.find((c) => c.feature === feat && c.library === lib);
  const head = '<th>Feature</th>' + CAP_LIBRARIES.map((l) => `<th>${esc(CAP_LIB_LABELS[l] || l)}</th>`).join('');
  const body = FEATURES.map((f) => {
    const cells = CAP_LIBRARIES.map((l) => {
      const c = capOf(f.id, l);
      const g = capGlyph(c);
      // a cell with a screenshot has a real example → link it to that library's gallery card
      const inner = c?.screenshot
        ? `<a href="features/${esc(f.id)}.html#${esc(CAP_LIB_SLUG[l] || l)}" title="${esc(g.title)} — view example">${g.sym}</a>`
        : g.sym;
      return `<td class="${g.cls}" title="${esc(g.title)}">${inner}</td>`;
    }).join('');
    return `<tr><td><a href="features/${esc(f.id)}.html">${esc(f.label)}</a><span class="cat">${esc(CATEGORY_LABELS[f.category] || f.category)}</span></td>${cells}</tr>`;
  }).join('\n    ');
  const legend = '<div class="cap-legend"><b class="cap-legend-v">green cell</b> = gate-verified example · glyph = support: <b>✓</b> native · <b>◑</b> plugin / workaround · <b>—</b> none</div>';
  return `<table class="cap"><thead><tr>${head}</tr></thead><tbody>\n    ${body}\n  </tbody>${sec.caption ? `<caption>${sec.caption}</caption>` : ''}</table>\n${legend}`;
}

// per-feature subpage body (rendered one level down, base '../'). The screenshot PNG lives in
// this dir's own assets/, so strip the docs-root "features/" prefix from the stored path.
function renderFeatureDetail(feature, caps, base) {
  const rows = caps.filter((c) => c.feature === feature.id);
  // gallery cards ordered by the matrix column order (deck, sigma, cosmos, three, helios)
  const shots = rows.filter((c) => c.screenshot).sort((a, b) => CAP_LIBRARIES.indexOf(a.library) - CAP_LIBRARIES.indexOf(b.library));
  let example;
  if (shots.length) {
    // gallery: one card per library that has a verified example, anchored by library slug
    example = shots.map((v) => {
      const src = v.screenshot.replace(/^features\//, '');
      const via = v.support && v.support !== 'native' ? ` · ${esc(v.support)}` : '';
      return `<figure class="chart" id="${esc(CAP_LIB_SLUG[v.library] || v.library)}"><figcaption>Verified example — ${esc(CAP_LIB_LABELS[v.library] || v.library)}${via} · synthetic data</figcaption><img class="cap-shot" src="${esc(src)}" alt="${esc(feature.label)} — ${esc(v.library)}" loading="lazy"><p class="fine">Rendered on the real GPU and gate-verified — it draws, and the pixels change when the camera moves (not a frozen frame).${capScaleNote(v.scale)}</p></figure>`;
    }).join('\n');
  } else {
    example = '<div class="note">No verified example yet — the support below is <b>surveyed</b> (documentation claims), not gate-verified.</div>';
  }
  const trs = CAP_LIBRARIES.map((l) => {
    const c = rows.find((r) => r.library === l);
    const g = capGlyph(c);
    const support = `${g.sym} ${esc(c?.support || 'none')}${c?.evidence === 'verified' ? ' · verified' : ''}`;
    return `<tr><td>${esc(CAP_LIB_LABELS[l] || l)}</td><td class="${g.cls}">${support}</td><td class="cap-word">${esc(c?.notes || '')}</td></tr>`;
  }).join('\n    ');
  const table = `<h3>Support by library</h3>\n<table class="capdetail"><thead><tr><th>Library</th><th>Support</th><th>Notes</th></tr></thead><tbody>\n    ${trs}\n  </tbody></table>`;
  const docs = feature.docs ? `<p class="fine">Reference: <a href="${esc(feature.docs)}" rel="noopener">${esc(feature.docs)}</a></p>` : '';
  return `<p class="lead">${feature.blurb}</p>\n${example}\n${table}\n${docs}`;
}

// Layout-compute benchmark as a grouped bar chart (same treatment as the render-throughput chart).
// Engines = series, node-scales = categories; a missing cell (didn't sustain / not measured) is a
// null bar. Linear y (Chart.js bars don't render correctly on a log axis).
function renderLayoutChart(sec, layout, chartSpecs) {
  const at = (eng, n) => layout.find((r) => r.engine === eng && r.nodes === n);
  const spec = {
    id: sec.id, kind: 'bars', yMax: sec.yMax || 130, unit: 'iters/s', yLabel: 'iterations / sec',
    categories: sec.scales.map((s) => s.label),
    series: sec.engines.map((e) => ({
      label: e.label,
      color: e.color,
      values: sec.scales.map((s) => { const r = at(e.engine, s.n); return r ? round1(r.itersPerSec) : null; }),
    })),
  };
  chartSpecs.push(spec);
  return `<figure class="chart" data-chart="${esc(sec.id)}">${sec.title ? `<figcaption>${esc(sec.title)}</figcaption>` : ''}<div class="canvas-wrap"><canvas></canvas></div>${sec.caption ? `<p class="fine">${sec.caption}</p>` : ''}<noscript><span class="nojs">Interactive chart needs JavaScript.</span></noscript></figure>`;
}

function renderSection(sec, ctx, chartSpecs, base) {
  switch (sec.type) {
    case 'hero': return renderHero(sec, ctx.pub);
    case 'matrix': return renderMatrix(sec, ctx.pub);
    case 'chart': return renderChart(sec, ctx.pub, chartSpecs);
    case 'takeaways': return renderTakeaways(sec, ctx.pub);
    case 'navcards': return renderNavCards(sec);
    case 'note': return renderNote(sec);
    case 'methodology': return renderMethodology(sec);
    case 'capmatrix': return renderCapMatrix(sec, ctx.capabilities);
    case 'feature-detail': return renderFeatureDetail(ctx.feature, ctx.capabilities, base);
    case 'layout-chart': return renderLayoutChart(sec, ctx.layout, chartSpecs);
    default: return '';
  }
}

const NAV = [{ href: 'index.html', label: 'Overview' }, { href: 'graph.html', label: 'Graph' }, { href: 'manifold.html', label: '3D / manifold' }, { href: 'features.html', label: 'Features' }];
const renderNav = (current, base = '') => `<nav class="nav">${NAV.map((n) => `<a href="${base}${n.href}"${n.label === current ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}</nav>`;

function assemblePage(page, ctx, base = '') {
  const chartSpecs = [];
  const body = page.sections.map((s) => renderSection(s, ctx, chartSpecs, base)).join('\n\n');
  const chartsJson = JSON.stringify(chartSpecs).replace(/</g, '\\u003c'); // can't break out of </script>
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(page.title)}</title>
<link rel="stylesheet" href="${base}assets/report.css">
</head>
<body>
<div class="wrap">
<header>
  <h1>${esc(page.title)}</h1>
  <div class="sub">${page.subtitle}</div>
  ${renderNav(page.current, base)}
</header>

${body}

<footer>Procedurally generated from gate-verified benchmark data — rebuild with the bench-core report build. Aggregate figures only; raw data and provenance are never published.</footer>
</div>
<script type="application/json" id="bench-charts">${chartsJson}</script>
<script src="${base}assets/chart.umd.js"></script>
<script src="${base}assets/report-client.js" defer></script>
</body>
</html>
`;
}

// ---- build ----
const { public: pub, capabilities, layout, secrets } = collect();
console.log(`report-build: ${pub.length} gated records · ${capabilities.length} capabilities · ${layout.length} layout runs · ${secrets.size} secrets on the denylist`);

const ctx = { pub, capabilities, layout };
const pages = PAGES.map((page) => {
  const html = assemblePage(page, ctx, '');
  leakTest(html, secrets); // throws → build aborts, nothing written
  return { file: page.file, html };
});
// per-feature subpages (one level down → base '../')
for (const feature of FEATURES) {
  const page = {
    title: feature.label,
    subtitle: `${CATEGORY_LABELS[feature.category] || feature.category} · part of the <a href="../features.html">feature / capability registry</a>.`,
    current: 'Features',
    sections: [{ type: 'feature-detail' }],
  };
  const html = assemblePage(page, { ...ctx, feature }, '../');
  leakTest(html, secrets);
  pages.push({ file: join('features', `${feature.id}.html`), html });
}

mkdirSync(join(DOCS, 'assets'), { recursive: true });
mkdirSync(join(DOCS, 'features', 'assets'), { recursive: true });
for (const f of ['report.css', 'report-client.js']) copyFileSync(join(ASSETS, f), join(DOCS, 'assets', f));
copyFileSync(join(ASSETS, 'vendor', 'chart.umd.js'), join(DOCS, 'assets', 'chart.umd.js'));
writeFileSync(join(DOCS, '.nojekyll'), '');
// copy the verified-example screenshots into docs/features/assets/ (synthetic data only)
const SHOTS_SRC = join(HERE, '../../manifold-bench/web/bench/results/shots');
for (const c of capabilities) {
  if (!c.screenshot) continue;
  const src = join(SHOTS_SRC, basename(c.screenshot));
  if (existsSync(src)) copyFileSync(src, join(DOCS, c.screenshot));
  else console.warn(`  ⚠ missing screenshot ${src}`);
}
for (const { file, html } of pages) {
  writeFileSync(join(DOCS, file), html);
  console.log(`  ✓ docs/${file} (${(html.length / 1024).toFixed(1)} KB) — leak-test PASS`);
}
console.log('  ✓ docs/assets + docs/features/assets + .nojekyll');
