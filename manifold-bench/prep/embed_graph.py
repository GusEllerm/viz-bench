#!/usr/bin/env python3
"""Embed a knowledge graph into 3D — turn the graph into a *manifold* point cloud.

Pipeline (CPU, no CUDA):
  edges → symmetric normalised adjacency  Â = D^-1/2 A D^-1/2
        → 16-D spectral embedding (TruncatedSVD — robust & fast on sparse)
        → 3D two ways:
            <domain>_spec3  : spectral dims 2–4 directly (Laplacian-eigenmap style; instant)
            <domain>_umap3  : UMAP of the 16-D spectral coords (nicer separation; ~minutes)
  Points coloured by node type (paper / patent / product / trial). Output matches the
  synthetic clouds: <base>.pos.f32 + <base>.col.u8 + a merged manifest.json entry.

Usage:  python3 prep/embed_graph.py [domain]      # domain ∈ drug|medical_device|semiconductor|combined (default)
"""
import numpy as np, pandas as pd, json, os, sys, time
import scipy.sparse as sp
from sklearn.decomposition import TruncatedSVD

HERE = os.path.dirname(__file__)
GRAPH = os.path.join(HERE, "..", "..", "graph-bench", "data")
OUT = os.path.join(HERE, "..", "data")
TYPE_COLOR = {"paper": (76, 120, 168), "patent": (245, 133, 24), "product": (84, 162, 75), "trial": (228, 87, 86)}
FALLBACK = (150, 150, 150)

def load_graph(domain):
    nodes = pd.read_parquet(f"{GRAPH}/{domain}/nodes.parquet", columns=["id", "type"])
    edges = pd.read_parquet(f"{GRAPH}/{domain}/edges.parquet", columns=["source", "target"])
    idx = {v: i for i, v in enumerate(nodes["id"].to_numpy())}
    n = len(nodes)
    s = edges["source"].map(idx).to_numpy(); t = edges["target"].map(idx).to_numpy()
    keep = ~(pd.isna(s) | pd.isna(t)); s = s[keep].astype(np.int64); t = t[keep].astype(np.int64)
    rows = np.concatenate([s, t]); cols = np.concatenate([t, s])
    A = sp.coo_matrix((np.ones(len(rows), np.float32), (rows, cols)), shape=(n, n)).tocsr()
    A.data[:] = 1.0  # binarise (collapse multi-edges)
    return nodes, A

def normalised_adjacency(A):
    deg = np.asarray(A.sum(1)).ravel()
    dinv = np.zeros_like(deg); nz = deg > 0; dinv[nz] = 1.0 / np.sqrt(deg[nz])
    D = sp.diags(dinv)
    return D @ A @ D

def scale_to(P, span=10.0):
    P = np.ascontiguousarray(P, dtype=np.float64)
    P = P - P.mean(0)
    P = P / (np.abs(P).max() + 1e-12) * span
    return P.astype(np.float32)

def colors_for(nodes):
    return np.array([TYPE_COLOR.get(t, FALLBACK) for t in nodes["type"].to_numpy()], dtype=np.uint8)

def write_cloud(base, name, P, col):
    P = scale_to(P[:, :3])
    os.makedirs(OUT, exist_ok=True)
    P.tofile(f"{OUT}/{base}.pos.f32"); col.tofile(f"{OUT}/{base}.col.u8")
    print(f"  wrote {base:26s} {len(P):>10,d} pts  {(P.nbytes + col.nbytes)/1e6:6.1f} MB")
    return {"name": name, "n": int(len(P)), "base": base,
            "pos": base + ".pos.f32", "col": base + ".col.u8",
            "bbox": [P.min(0).tolist(), P.max(0).tolist()]}

def merge_manifest(entries):
    path = os.path.join(OUT, "manifest.json")
    prior = {}
    if os.path.exists(path):
        for e in json.load(open(path)).get("clouds", []):
            prior[e["base"]] = e
    for e in entries:
        prior[e["base"]] = e
    json.dump({"clouds": list(prior.values())}, open(path, "w"), indent=2)
    print(f"manifest.json now has {len(prior)} clouds")

if __name__ == "__main__":
    domain = sys.argv[1] if len(sys.argv) > 1 else "combined"
    t0 = time.time()
    print(f"embedding '{domain}' graph → 3D")
    nodes, A = load_graph(domain)
    col = colors_for(nodes)
    print(f"  {A.shape[0]:,} nodes · {A.nnz//2:,} undirected edges  ({time.time()-t0:.1f}s)")

    An = normalised_adjacency(A)
    svd = TruncatedSVD(n_components=16, algorithm="randomized", random_state=42)
    spec = svd.fit_transform(An)                      # n × 16 spectral embedding
    print(f"  spectral (TruncatedSVD 16) done ({time.time()-t0:.1f}s)")

    entries = []
    entries.append(write_cloud(f"graph_{domain}_spec3", f"graph-spec:{domain}", spec[:, 1:4], col))
    merge_manifest(entries)                            # publish the fast one immediately

    print("  running UMAP (16→3) …")
    import umap
    emb = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=42).fit_transform(spec)
    print(f"  UMAP done ({time.time()-t0:.1f}s)")
    entries.append(write_cloud(f"graph_{domain}_umap3", f"graph-umap:{domain}", emb, col))
    merge_manifest(entries)
    print(f"done in {time.time()-t0:.1f}s")
