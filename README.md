# viz-bench — large-data visualisation benchmark

A gate-verified benchmark for interactive rendering of large graphs and 3D point clouds across WebGL/WebGPU libraries — Sigma.js, deck.gl, three.js, Cosmograph/cosmos.gl, Helios-Web — plus native Datoviz (Vulkan) for comparison. Graphs span 148K–16.5M edges; point clouds 100K–50M points.

**Report site (generated from the gated results): <https://gusellerm.github.io/viz-bench/>**

Every published number must pass five fail-loud gates before it counts: real GPU (never a software rasteriser), full data coverage (the engine actually loaded everything), true on-screen presentation (pixel-diff under a camera move — not an offscreen loop or a frozen frame), recorded camera state, and input honesty (motion driven through the engine's own API or coalesced human-rate events — synthetic uncoalesced event streams are quarantined). A failed gate quarantines the cell; it is never silently published. The harness also fails loudly on known measurement artifacts (e.g. macOS's 30 Hz occluded-window throttle).

Everything here is reproducible end-to-end from public data. Nothing is committed — the prep scripts download and rebuild every dataset:

| Track | Dataset | Scale | Source |
|---|---|---|---|
| Graph | ogbn-arxiv, year-sliced into four tiers | 53K–169K nodes / 148K–1.16M edges | [OGB](https://ogb.stanford.edu/docs/nodeprop/#ogbn-arxiv) — ODC-BY; please cite OGB and MAG |
| Graph | cit-Patents (US patent citations) | 3.77M nodes / 16.5M edges | [SNAP](https://snap.stanford.edu/data/cit-Patents.html) — please cite Leskovec, Kleinberg & Faloutsos (2005) |
| 3D | swiss-roll / sphere / torus / s-curve manifolds | 100K–50M points | generated (`gen_manifolds.py`) |
| 3D | arXiv paper embedding | 169K points | UMAP of the ogbn-arxiv node features |

Graph layouts are precomputed: ForceAtlas2 (graphology) for the arXiv tiers, and a GPU force simulation seeded by a spectral embedding for cit-Patents, where CPU force-atlas would take days at 3.77M nodes.

## Layout

- `bench-core/` — the contract-enforcing harness: gates, result schema, provenance, drivers, report builder (Node), plus in-page contract primitives (`page/`) and a Python mirror for the native track (`py/`).
- `graph-bench/web/` — graph-rendering bench pages (one HTML entry per library) and Playwright harnesses under `bench/*.mjs`.
- `graph-bench/prep/` — public graph datasets: `fetch_arxiv.sh` + `build_arxiv.mjs` build the four ogbn-arxiv tiers with deterministic ForceAtlas2 layouts; `build_citpatents.mjs` + `spectral_init.py` + `layout_citpatents.mjs` build the 16.5M-edge cit-Patents tier (binary buffers + GPU layout).
- `manifold-bench/web/` — 3D point-cloud bench pages, per-library capability examples (`cap-*.html`), and harnesses under `bench/*.mjs`.
- `manifold-bench/native/` — native Datoviz (Vulkan) benchmark scripts.
- `manifold-bench/prep/` — dataset generators: synthetic manifolds (`gen_manifolds.py`) and the arXiv 3D embedding (`embed_arxiv.py`).

## Running locally

```sh
npm install                      # repo root (Playwright for the harnesses)
(cd graph-bench/web && npm install)
(cd manifold-bench/web && npm install)
```

Build the datasets (none are committed — they download/generate from source):

```sh
# python env (used by the 3D prep and the cit-Patents spectral seed)
(cd manifold-bench/prep && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)

# graph tiers — arXiv (minutes) …
(cd graph-bench/prep && npm install && bash fetch_arxiv.sh && node build_arxiv.mjs all)

# … and cit-Patents, the 16.5M-edge tier (the layout step is ~15 min on a GPU)
(cd graph-bench/prep \
  && mkdir -p raw \
  && curl -L -o raw/cit-Patents.txt.gz https://snap.stanford.edu/data/cit-Patents.txt.gz \
  && node --max-old-space-size=8192 build_citpatents.mjs \
  && ../../manifold-bench/prep/.venv/bin/python spectral_init.py cit_patents \
  && node layout_citpatents.mjs cit_patents 800 'init=1&gravity=0.25&repulsion=0.15&spring=1')

# 3D clouds (the 20M/50M swiss rolls are ~1.2 GB in total)
(cd manifold-bench/prep && .venv/bin/python gen_manifolds.py && .venv/bin/python embed_arxiv.py)
(cd manifold-bench/prep && .venv/bin/python gen_manifolds.py swiss_roll 20000000)
(cd manifold-bench/prep && .venv/bin/python gen_manifolds.py swiss_roll 50000000)
```

Serve the apps and explore the pages interactively:

```sh
(cd graph-bench/web && npx vite)     # port 5180
(cd manifold-bench/web && npx vite)  # port 5200
```

Bench harnesses live under each app's `bench/` directory and run with `node bench/<name>.mjs` while the matching app is available (the graph harness serves a production build — run `npx vite build` in `graph-bench/web` first). Headed runs measure real display presentation: keep the benchmark window unoccluded, or the throttle guard will quarantine affected cells. Regenerate the report site from the gated results with `node bench-core/node/report-build.mjs`.

## Note on gates

The GPU gate currently asserts an Apple-Silicon Metal renderer (the reference machine). On other hardware, adjust `gpuGate` in `bench-core/node/gates.mjs` to match your GPU until per-platform support lands — the point of the gate is to fail loudly when a run silently falls back to software rendering.
