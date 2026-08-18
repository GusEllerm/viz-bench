#!/usr/bin/env python3
"""Spectral INITIAL positions for a binary graph tier — the seed for the GPU force refine.

A pure force layout from a random scatter contracts a 16.5M-edge graph into a uniform disc
(gravity wins before repulsion can separate communities). A spectral embedding gives the
global structure instantly — communities land in distinct regions — and the GPU sim then only
has to polish locally (a few hundred iterations instead of thousands).

Pipeline (CPU, sparse, memory-safe: ~1-2 GB at 3.77M nodes):
  edges.u32 → symmetric normalised adjacency  Â = D^-1/2 A D^-1/2  (largest component only
  for the eigen-solve; isolated/small components are placed on a ring outside)
  → top-k eigenvectors (LOBPCG on the sparse matrix, k=8)
  → 2D = eigenvectors 2–3 (the first is the trivial constant), scaled to the sim space
Writes <tier>.init.f32 (n×2). Then: node layout_citpatents.mjs <tier> 800 'init=1&...'

  .venv/bin/python spectral_init.py cit_patents      (uses manifold-bench/prep/.venv)
"""
import os, sys, time, json
import numpy as np
import scipy.sparse as sp
from scipy.sparse.csgraph import connected_components
from scipy.sparse.linalg import lobpcg

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "web", "public", "data")
tier = sys.argv[1] if len(sys.argv) > 1 else "cit_patents"
SPACE = 4096.0  # cosmos default spaceSize the export page starts from

t0 = time.time()
meta = json.load(open(os.path.join(DATA, f"{tier}.meta.json")))
n = meta["nodes"]
edges = np.fromfile(os.path.join(DATA, meta["files"]["edges"]), dtype=np.uint32).reshape(-1, 2)
print(f"{n:,} nodes / {len(edges):,} edges loaded ({time.time()-t0:.0f}s)", flush=True)

rows = np.concatenate([edges[:, 0], edges[:, 1]])
cols = np.concatenate([edges[:, 1], edges[:, 0]])
A = sp.csr_matrix((np.ones(len(rows), dtype=np.float32), (rows, cols)), shape=(n, n))
del rows, cols
ncomp, labels = connected_components(A, directed=False)
sizes = np.bincount(labels)
giant = np.argmax(sizes)
mask = labels == giant
gn = int(mask.sum())
print(f"{ncomp:,} components; giant = {gn:,} nodes ({100*gn/n:.1f}%) ({time.time()-t0:.0f}s)", flush=True)

# normalised adjacency of the giant component
idx = np.flatnonzero(mask)
Ag = A[idx][:, idx].tocsr()
deg = np.asarray(Ag.sum(axis=1)).ravel().astype(np.float64)
dinv = 1.0 / np.sqrt(np.maximum(deg, 1.0))
An = sp.diags(dinv) @ Ag @ sp.diags(dinv)
del A, Ag

print("eigen-solve (LOBPCG, k=8)…", flush=True)
rng = np.random.default_rng(1234)
X0 = rng.standard_normal((gn, 8)).astype(np.float64)
X0[:, 0] = dinv  # the trivial eigenvector — seed it so the solver separates it cleanly
vals, vecs = lobpcg(An, X0, largest=True, maxiter=200, tol=1e-4)
order = np.argsort(-vals)
vecs = vecs[:, order]
print(f"  eigenvalues: {np.round(vals[order][:5], 4)} ({time.time()-t0:.0f}s)", flush=True)

# 2D from eigenvectors 2–3 (skip the constant). Raw Laplacian coordinates on a huge sparse
# graph are near-degenerate and localised — 99% of nodes pile into one thin streak — so:
#  (a) rotate the pair to its principal axes (decorrelate), then
#  (b) RANK-transform each axis: a monotone bijection that keeps every node's neighbourhood
#      ordering but spreads density uniformly. The GPU refine restores local geometry.
xy = vecs[:, 1:3]
xy = xy - xy.mean(axis=0)
_, _, vt = np.linalg.svd(xy, full_matrices=False)
xy = xy @ vt.T
rank = np.empty_like(xy)
for k in range(2):
    order = np.argsort(xy[:, k], kind="stable")
    rank[order, k] = np.arange(len(order), dtype=np.float64) / max(len(order) - 1, 1)
xy = rank * (SPACE * 0.8) + SPACE * 0.1

pos = np.zeros((n, 2), dtype=np.float32)
pos[idx] = xy.astype(np.float32)
# non-giant components: ring outside the giant, angle by component id (deterministic)
rest = np.flatnonzero(~mask)
if len(rest):
    ang = (labels[rest] * 2.399963) % (2 * np.pi)  # golden-angle spread
    r = SPACE * 0.55
    pos[rest, 0] = SPACE / 2 + np.cos(ang) * r
    pos[rest, 1] = SPACE / 2 + np.sin(ang) * r
    print(f"  {len(rest):,} nodes in {ncomp-1:,} small components placed on the outer ring", flush=True)

out = os.path.join(DATA, f"{tier}.init.f32")
pos.tofile(out)
print(f"wrote {out} ({time.time()-t0:.0f}s total)", flush=True)
