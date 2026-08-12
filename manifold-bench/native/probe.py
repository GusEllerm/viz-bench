"""Feasibility probe: can each Python renderer render a point cloud OFFSCREEN on this
Mac (no display), and does it hit the real GPU? Uses a tiny synthetic cloud. Run after install."""
import numpy as np, time

N = 100_000
rng = np.random.default_rng(0)
pos = ((rng.random((N, 3)) - 0.5) * 10).astype(np.float32)
col = (rng.random((N, 3)) * 255).astype(np.uint8)

def gl_line(caps):
    for ln in str(caps).splitlines():
        if "renderer" in ln.lower():
            return ln.strip()
    return None

def probe_pyvista():
    import pyvista as pv
    pv.OFF_SCREEN = True
    pl = pv.Plotter(off_screen=True, window_size=(800, 600))
    pl.add_points(pos, scalars=col, rgb=True, point_size=2)
    img = pl.screenshot(return_img=True)
    rw = getattr(pl, "render_window", None) or getattr(pl, "ren_win", None)
    gl = gl_line(rw.ReportCapabilities()) if rw is not None else None
    pl.close()
    return {"shape": None if img is None else img.shape, "gpu": gl}

def probe_open3d():
    import open3d as o3d
    pc = o3d.geometry.PointCloud()
    pc.points = o3d.utility.Vector3dVector(pos.astype(np.float64))
    pc.colors = o3d.utility.Vector3dVector(col.astype(np.float64) / 255)
    r = o3d.visualization.rendering.OffscreenRenderer(800, 600)
    mat = o3d.visualization.rendering.MaterialRecord(); mat.shader = "defaultUnlit"; mat.point_size = 2.0
    r.scene.add_geometry("pc", pc, mat)
    r.setup_camera(60.0, pc.get_center(), pc.get_center() + [0, 0, 30], [0, 1, 0])
    img = r.render_to_image()
    return {"shape": np.asarray(img).shape}

def probe_vispy():
    import vispy
    from vispy import scene, app
    c = scene.SceneCanvas(keys=None, size=(800, 600), show=False)
    view = c.central_widget.add_view(); view.camera = "turntable"
    scene.visuals.Markers(parent=view.scene).set_data(pos, face_color=col / 255.0, size=2)
    img = c.render()
    return {"shape": None if img is None else img.shape, "backend": app.use_app().backend_name}

def probe_datoviz():
    import datoviz as dvz
    return {"version": getattr(dvz, "__version__", "?"), "note": "API checked separately"}

for name, fn in [("pyvista", probe_pyvista), ("open3d", probe_open3d), ("vispy", probe_vispy), ("datoviz", probe_datoviz)]:
    try:
        t = time.time(); r = fn()
        print(f"{name:9s} OK   {r}   ({time.time()-t:.1f}s)")
    except Exception as e:
        print(f"{name:9s} FAIL {type(e).__name__}: {str(e)[:160]}")
