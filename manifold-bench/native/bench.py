"""Native point-cloud render-throughput bench (pyvista/VTK + vispy), offscreen on the GPU.
FPS = frames/sec rendering the full cloud while the camera orbits (the native analog of the
web harness's sustained-interaction FPS). Run: python3 native/bench.py [cloud ...]"""
import sys, os, time, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from cloud import load

FRAMES = 90
SIZE = (1440, 900)
clouds = sys.argv[1:] or ["swiss_roll_1000000", "swiss_roll_10000000"]

def bench_pyvista(pos, col):
    import pyvista as pv
    pv.OFF_SCREEN = True
    pl = pv.Plotter(off_screen=True, window_size=SIZE)
    pl.add_points(pos, scalars=col, rgb=True, point_size=2.0, render_points_as_spheres=False)
    pl.camera_position = "iso"
    cam = pl.renderer.GetActiveCamera()   # underlying vtkCamera (Azimuth() actually rotates + marks modified)
    pl.screenshot(return_img=True)  # warm-up / build
    t0 = time.perf_counter()
    for _ in range(FRAMES):
        cam.Azimuth(2.0); pl.screenshot(return_img=True)  # readback forces a real GPU draw (matches vispy render())
    fps = FRAMES / (time.perf_counter() - t0)
    pl.close()
    return fps

def bench_vispy(pos, col):
    from vispy import scene
    c = scene.SceneCanvas(keys=None, size=SIZE, show=False)
    v = c.central_widget.add_view()
    v.camera = scene.cameras.TurntableCamera(fov=45)
    m = scene.visuals.Markers(parent=v.scene)
    m.set_data(pos, face_color=(col.astype(np.float32) / 255.0), size=2, edge_width=0)
    m.antialias = 0
    v.camera.set_range()
    c.render()  # warm-up
    t0 = time.perf_counter()
    for _ in range(FRAMES):
        v.camera.azimuth = v.camera.azimuth + 2.0
        c.render()
    fps = FRAMES / (time.perf_counter() - t0)
    c.close()
    return fps

rows = []
for base in clouds:
    pos, col = load(base); n = len(pos)
    for name, fn in [("pyvista", bench_pyvista), ("vispy", bench_vispy)]:
        try:
            t0 = time.perf_counter(); fps = fn(pos, col); wall = time.perf_counter() - t0
            print(f"{name:8s} {base:22s} {n:>11,d} pts  fps={fps:6.1f}  ({wall:.1f}s incl build)")
            rows.append({"tool": name, "cloud": base, "points": n, "fps": round(fps, 1)})
        except Exception as e:
            print(f"{name:8s} {base:22s} FAIL {type(e).__name__}: {str(e)[:140]}")
            rows.append({"tool": name, "cloud": base, "error": f"{type(e).__name__}: {str(e)[:140]}"})
json.dump(rows, open(os.path.join(os.path.dirname(__file__), "results.json"), "w"), indent=2)
