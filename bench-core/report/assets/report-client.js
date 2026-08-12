/* Generic Chart.js factory for the generated benchmark site. Reads the inlined chart specs
   (#bench-charts) — the build resolves data → specs server-side; the client only instantiates.
   Bars are coloured by fps band (green ≥60 / amber 30–59 / red <30); a dashed 60-fps reference
   line marks "smooth"; tooltips surface fps · p95 · gate-pass (the rigor, on hover); each chart
   animates when it scrolls into view. Clicking a legend item toggles that series (Chart.js). */
(function () {
  if (typeof Chart === 'undefined') return;
  const specs = JSON.parse(document.querySelector('#bench-charts')?.textContent || '[]');
  const cs = getComputedStyle(document.documentElement);
  const tok = (n, f) => cs.getPropertyValue(n).trim() || f;
  const COL = { mut: tok('--mut', '#57606a'), line: tok('--line', '#d0d7de') };
  // categorical palette — colour identifies the LIBRARY/series (and matches the legend).
  // fps is encoded by bar height + the dashed 60-fps line + the band-coloured table, NOT
  // by bar colour (deliberately not the green/amber/red fps bands).
  const CAT_COLORS = ['#0969da', '#8250df', '#bf3989', '#0e8a6e', '#656d76'];
  const LOG_TICKS = [1e5, 1e6, 1e7, 2e7, 5e7];
  const LOG_LABEL = { 100000: '100K', 1000000: '1M', 10000000: '10M', 20000000: '20M', 50000000: '50M' };

  Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = COL.mut;
  Chart.defaults.animation = { duration: 900, easing: 'easeOutQuart' };

  // dashed reference line (Chart.js core has no annotation plugin); reads chart.options._refLine
  Chart.register({
    id: 'refline',
    afterDatasetsDraw(chart) {
      const v = chart.options._refLine;
      if (v == null || !chart.scales.y) return;
      const y = chart.scales.y.getPixelForValue(v), { left, right } = chart.chartArea, ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = COL.mut; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = COL.mut; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(v + ' fps', right - 4, y - 4);
      ctx.restore();
    },
  });

  const metaLabel = (label, val, m, unit = 'fps') => {
    const bits = [`${val} ${unit}`];
    if (m && m.p95 != null) bits.push(`p95 ${m.p95} ms`);
    if (m && m.gates) bits.push('gates ' + (m.gates === 'pass' ? '✓' : m.gates));
    if (val >= 115) bits.push('vsync-capped');
    return `${label}: ${bits.join(' · ')}`;
  };

  function buildBars(spec, canvas) {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: spec.categories,
        datasets: spec.series.map((s, i) => ({
          label: s.label,
          data: s.values,
          backgroundColor: s.color || CAT_COLORS[i % CAT_COLORS.length],
          borderRadius: 3,
          maxBarThickness: 48,
          _meta: s.meta,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, _refLine: spec.refLine,
        scales: {
          y: { beginAtZero: true, max: spec.yMax || 130, title: { display: !!spec.yLabel, text: spec.yLabel }, grid: { color: COL.line } },
          x: { grid: { display: false } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => metaLabel(c.dataset.label, c.parsed.y, c.dataset._meta && c.dataset._meta[c.dataIndex], spec.unit) } },
        },
      },
    });
  }

  function buildLogline(spec, canvas) {
    return new Chart(canvas, {
      type: 'line',
      data: {
        datasets: spec.series.map((s, i) => ({
          label: s.label,
          data: s.points.map((p) => ({ x: p.x, y: p.y })),
          borderColor: s.color || CAT_COLORS[i % CAT_COLORS.length],
          backgroundColor: s.color || CAT_COLORS[i % CAT_COLORS.length],
          tension: 0.2, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
          _meta: s.points,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false, _refLine: spec.refLine,
        scales: {
          x: {
            type: 'logarithmic', min: 80000, max: 6e7,
            title: { display: !!spec.xLabel, text: spec.xLabel }, grid: { color: COL.line },
            afterBuildTicks: (a) => { a.ticks = LOG_TICKS.map((value) => ({ value })); },
            ticks: { callback: (v) => LOG_LABEL[v] || '' },
          },
          y: { beginAtZero: true, max: spec.yMax || 130, title: { display: !!spec.yLabel, text: spec.yLabel }, grid: { color: COL.line } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => metaLabel(c.dataset.label, c.parsed.y, c.dataset._meta && c.dataset._meta[c.dataIndex]) } },
        },
      },
    });
  }

  const build = { bars: buildBars, logline: buildLogline };
  const made = new WeakSet();
  const render = (fig) => {
    if (made.has(fig)) return;
    made.add(fig);
    const spec = specs.find((s) => s.id === fig.dataset.chart);
    const canvas = fig.querySelector('canvas');
    if (spec && canvas && build[spec.kind]) build[spec.kind](spec, canvas);
  };

  const figs = document.querySelectorAll('figure[data-chart]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { render(e.target); io.unobserve(e.target); }
    }, { threshold: 0.2 });
    figs.forEach((f) => io.observe(f));
  } else {
    figs.forEach(render);
  }
})();
