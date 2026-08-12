"""Shared loader for the binary point clouds, for the Python-native renderer benches."""
import numpy as np, json, os

DATA = os.path.join(os.path.dirname(__file__), "..", "data")

def manifest():
    return json.load(open(os.path.join(DATA, "manifest.json")))

def load(base):
    """Return (positions Nx3 float32, colors Nx3 uint8) for a cloud base name."""
    pos = np.fromfile(os.path.join(DATA, base + ".pos.f32"), dtype=np.float32).reshape(-1, 3)
    col = np.fromfile(os.path.join(DATA, base + ".col.u8"), dtype=np.uint8).reshape(-1, 3)
    return pos, col

def center_radius(pos):
    lo = pos.min(0); hi = pos.max(0)
    return (lo + hi) / 2.0, float(np.max(hi - lo) / 2.0 or 1.0)
