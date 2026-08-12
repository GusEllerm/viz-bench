# viz-bench — large-data visualisation benchmark

A gate-verified benchmark for interactive rendering of large graphs and 3D point clouds (1M–100M primitives) across WebGL/WebGPU libraries — Sigma.js, deck.gl, three.js, Cosmograph/cosmos.gl, Helios-Web — plus native Datoviz for comparison. Every published number must pass five fail-loud gates before it counts: real GPU (no software rasteriser), pixel coverage, actual presentation to screen, camera-state verification, and input honesty (real synthesized input events, not programmatic camera moves).

> **Migration in progress.** This repository is the public, fully-reproducible home of the benchmark. Datasets are being switched to public sources — ogbn-arxiv (ODC-BY) for the graph track and synthetic manifolds for the 3D track — so the whole pipeline (data prep → bench runs → report site) is reproducible end-to-end. Numbers and the generated report site will land here after the re-runs on public data.

## Layout

- `bench-core/` — the contract-enforcing harness: gates, result schema, provenance, drivers, report builder (Node), plus in-page contract primitives (`page/`) and a Python mirror for the native track (`py/`).
- `graph-bench/web/` — graph-rendering bench pages (one HTML entry per library) and Playwright harnesses under `bench/*.mjs`.
- `manifold-bench/web/` — 3D point-cloud bench pages, per-library capability examples (`cap-*.html`), and harnesses under `bench/*.mjs`.
- `manifold-bench/native/` — native Datoviz (Vulkan) benchmark scripts.
- `manifold-bench/prep/` — dataset generators: synthetic manifolds and a graph→3D spectral/UMAP embedding.

## Running locally

```sh
npm install                      # repo root (Playwright for the harnesses)
(cd graph-bench/web && npm install)
(cd manifold-bench/web && npm install)
```

Generate datasets with the prep scripts (see `manifold-bench/prep/`; the public graph prep is landing with the migration), then serve each web app:

```sh
(cd graph-bench/web && npx vite)     # port 5180
(cd manifold-bench/web && npx vite)  # port 5200
```

Bench harnesses live under each app's `bench/` directory and are run with `node bench/<name>.mjs` while the corresponding vite server is up.

## Note on gates

The GPU gate currently asserts an Apple-Silicon Metal renderer (the reference machine). On other hardware, adjust `gpuGate` in `bench-core/node/gates.mjs` to match your GPU until per-platform support lands — the point of the gate is to fail loudly when a run silently falls back to software rendering.
