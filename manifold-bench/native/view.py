"""Interactive Datoviz (Vulkan/Metal) point-cloud viewer, windowed.
Note: interactive (windowed) Datoviz is WebGL-class at 10M+ points — its famous
throughput numbers are offscreen-only (see the 3D report correction, 2026-06-11). Opens a real window with built-in arcball interaction: drag to rotate,
scroll/pinch to zoom, right-drag to pan. Close the window to exit.

    python view.py                              # embedded graph manifold (UMAP 3D, 139K pts)
    python view.py swiss_roll_50000000          # 50M points — expect ~5 fps interactive (the wall is universal)
    python view.py graph_combined_spec3 5        # second arg = point size (px, default 3)

Clouds = any <base> with <base>.pos.f32 + <base>.col.u8 in manifold-bench/data
(regenerate via prep/gen_manifolds.py + prep/embed_graph.py if missing).
"""
import sys, os
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from cloud import load
import datoviz as dvz

base = sys.argv[1] if len(sys.argv) > 1 else "graph_combined_umap3"
psize = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0

pos, col = load(base)
N = len(pos)
c = pos.mean(0)  # datoviz doesn't auto-fit data coords -> normalize to ~[-1,1]
position = np.ascontiguousarray((pos - c) / (np.abs(pos - c).max() + 1e-9), np.float32)
color = np.empty((N, 4), np.uint8)
color[:, :3] = col
color[:, 3] = 255
size = np.full(N, psize, np.float32)

print(f"datoviz interactive viewer — {base}: {N:,} points (size {psize:g}px)")
print("drag = rotate · scroll = zoom · close the window to exit")

app = dvz.App(background="black")  # windowed (no offscreen) -> OS window + input
fig = app.figure(1440, 900)
panel = fig.panel()
panel.arcball(initial=(0.6, 0.6, 0.0))
visual = app.point(position=position, color=color, size=size)
panel.add(visual)
app.run()  # blocks until the window is closed
app.destroy()
