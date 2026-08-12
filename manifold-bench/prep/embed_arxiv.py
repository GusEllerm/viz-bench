#!/usr/bin/env python3
"""Build the real-data 3D manifold cloud for the benchmark: UMAP of ogbn-arxiv's 128-d
paper features → 169,343 points in 3D, coloured by arXiv subject area (40 CS categories).
This is the public stand-in for an embedded knowledge graph: a real, structured manifold
(subject-area clusters) rather than a synthetic surface.

Reads the archive fetched by graph-bench/prep/fetch_arxiv.sh; writes the same binary
format as the synthetic clouds (<base>.pos.f32 xyz float32 + <base>.col.u8 rgb uint8)
plus a merged manifest.json entry.

  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python embed_arxiv.py            # ~5–15 min (UMAP on 169K × 128)
"""
import gzip, json, os, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ARXIV = os.path.join(HERE, "..", "..", "graph-bench", "prep", "raw", "arxiv")
OUT = os.path.join(HERE, "..", "data")
BASE = "arxiv_umap3"

# categorical palette (12 hues, cycled over the 40 subject areas)
PALETTE = [(76, 120, 168), (245, 133, 24), (84, 162, 75), (228, 87, 86), (114, 183, 178),
           (238, 202, 59), (178, 121, 162), (255, 157, 166), (156, 117, 95), (186, 176, 172),
           (89, 161, 79), (237, 201, 72)]

def load_feats():
    p = os.path.join(ARXIV, "raw", "node-feat.csv.gz")
    if not os.path.exists(p):
        # node-feat is large and not extracted by default — pull it from the fetched zip
        import zipfile
        z = zipfile.ZipFile(os.path.join(ARXIV, "..", "arxiv.zip"))
        z.extract("arxiv/raw/node-feat.csv.gz", os.path.join(ARXIV, ".."))
    print("loading 128-d features…", flush=True)
    return np.loadtxt(p, delimiter=",", dtype=np.float32)

def main():
    t0 = time.time()
    feats = load_feats()
    with gzip.open(os.path.join(ARXIV, "raw", "node-label.csv.gz"), "rt") as f:
        labels = np.array([int(l) for l in f.read().split()], dtype=np.int32)
    n = feats.shape[0]
    print(f"  {n:,} × {feats.shape[1]} features ({time.time()-t0:.0f}s)", flush=True)

    import umap
    print("UMAP → 3D (cosine metric)…", flush=True)
    xyz = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, metric="cosine",
                    random_state=42, verbose=True).fit_transform(feats).astype(np.float32)

    col = np.zeros((n, 3), dtype=np.uint8)
    for i, lab in enumerate(labels):
        col[i] = PALETTE[lab % len(PALETTE)]

    os.makedirs(OUT, exist_ok=True)
    xyz.tofile(os.path.join(OUT, f"{BASE}.pos.f32"))
    col.tofile(os.path.join(OUT, f"{BASE}.col.u8"))

    mpath = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {"clouds": []}
    manifest["clouds"] = [c for c in manifest["clouds"] if c.get("base") != BASE]
    # ROBUST bbox (0.5–99.5 percentile): UMAP leaves a few disconnected-vertex outliers far from
    # the cloud; the bench pages frame the camera from this bbox, so a raw min/max would waste
    # most of the viewport. Outlier points still load (coverage counts all), just off-frame.
    bbox = [np.percentile(xyz, 0.5, axis=0).tolist(), np.percentile(xyz, 99.5, axis=0).tolist()]
    manifest["clouds"].append({"name": "arxiv", "n": int(n), "base": BASE,
                               "pos": f"{BASE}.pos.f32", "col": f"{BASE}.col.u8", "bbox": bbox})
    json.dump(manifest, open(mpath, "w"), indent=1)
    print(f"wrote {BASE} ({n:,} points) + manifest — {time.time()-t0:.0f}s total", flush=True)

if __name__ == "__main__":
    main()
