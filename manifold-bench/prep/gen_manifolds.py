#!/usr/bin/env python3
"""Generate canonical synthetic manifolds as point clouds for the 3D renderer benchmark.

Each cloud is written as two flat binary files (fast to load as typed arrays in the browser):
  <name>_<N>.pos.f32   — N*3 little-endian float32  (x,y,z interleaved)
  <name>_<N>.col.u8    — N*3 uint8                  (r,g,b, coloured by the manifold's
                                                      intrinsic parameter so structure is visible)
plus a manifest.json describing every cloud (n, bbox, files).

Manifolds (the classic manifold-learning shapes + a couple of surfaces):
  swiss_roll, s_curve, sphere, torus  — colour encodes the intrinsic coordinate, so you can
  see at a glance whether a renderer (or a downstream UMAP/t-SNE) preserves the manifold.

Usage:  python3 prep/gen_manifolds.py            # default set (incl. a 1M & 10M scale ladder)
        python3 prep/gen_manifolds.py swiss_roll 5000000
"""
import numpy as np, sys, json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "data")
rng = np.random.default_rng(42)

def swiss_roll(n):
    t = 1.5 * np.pi * (1 + 2 * rng.random(n))      # roll angle (the "unrolled" coordinate)
    h = 21.0 * rng.random(n)
    P = np.stack([t * np.cos(t), h, t * np.sin(t)], 1)
    return P, t

def s_curve(n):
    t = 3 * np.pi * (rng.random(n) - 0.5)
    h = 2.0 * rng.random(n)
    P = np.stack([np.sin(t), h, np.sign(t) * (np.cos(t) - 1)], 1)
    return P, t

def sphere(n):
    v = rng.normal(size=(n, 3))
    v /= np.linalg.norm(v, axis=1, keepdims=True) + 1e-12
    return v * 10.0, np.arctan2(v[:, 1], v[:, 0])   # colour by longitude

def torus(n):
    R, r = 6.0, 2.0
    u = 2 * np.pi * rng.random(n)
    w = 2 * np.pi * rng.random(n)
    P = np.stack([(R + r * np.cos(w)) * np.cos(u),
                  (R + r * np.cos(w)) * np.sin(u),
                  r * np.sin(w)], 1)
    return P, u

MANIFOLDS = {"swiss_roll": swiss_roll, "s_curve": s_curve, "sphere": sphere, "torus": torus}

# compact "turbo"-ish colormap (no matplotlib dependency)
_STOPS = np.array([0.0, 0.13, 0.25, 0.38, 0.5, 0.63, 0.75, 0.88, 1.0])
_R = np.array([48, 33, 24, 60, 120, 200, 248, 235, 165]) / 255
_G = np.array([18, 120, 195, 230, 245, 220, 160, 70, 18]) / 255
_B = np.array([59, 190, 215, 160, 95, 50, 38, 35, 24]) / 255

def colorize(s):
    s = s.astype(np.float64)
    lo, hi = s.min(), s.max()
    t = (s - lo) / (hi - lo + 1e-12)
    rgb = np.stack([np.interp(t, _STOPS, _R), np.interp(t, _STOPS, _G), np.interp(t, _STOPS, _B)], 1)
    return (rgb * 255 + 0.5).astype(np.uint8)

def write_cloud(name, n):
    P, s = MANIFOLDS[name](int(n))
    P = P.astype(np.float32)
    col = colorize(s)
    os.makedirs(OUT, exist_ok=True)
    base = f"{name}_{int(n)}"
    P.tofile(os.path.join(OUT, base + ".pos.f32"))
    col.tofile(os.path.join(OUT, base + ".col.u8"))
    mb = (P.nbytes + col.nbytes) / 1e6
    print(f"  {base:24s} {int(n):>11,d} pts  {mb:6.1f} MB")
    return {"name": name, "n": int(n), "base": base,
            "pos": base + ".pos.f32", "col": base + ".col.u8",
            "bbox": [P.min(0).tolist(), P.max(0).tolist()]}

DEFAULT = [("swiss_roll", 100_000), ("swiss_roll", 1_000_000), ("swiss_roll", 10_000_000),
           ("s_curve", 1_000_000), ("sphere", 1_000_000), ("torus", 1_000_000)]

if __name__ == "__main__":
    if len(sys.argv) == 3:
        jobs = [(sys.argv[1], int(sys.argv[2]))]
    else:
        jobs = DEFAULT
    print(f"generating {len(jobs)} point cloud(s) → {os.path.normpath(OUT)}")
    manifest = [write_cloud(name, n) for name, n in jobs]
    # merge into manifest.json (keep any prior entries not regenerated)
    path = os.path.join(OUT, "manifest.json")
    prior = {}
    if os.path.exists(path):
        for e in json.load(open(path)).get("clouds", []):
            prior[e["base"]] = e
    for e in manifest:
        prior[e["base"]] = e
    json.dump({"clouds": list(prior.values())}, open(path, "w"), indent=2)
    print(f"wrote manifest.json ({len(prior)} clouds)")
