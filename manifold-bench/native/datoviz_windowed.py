"""Gated WINDOWED Datoviz point-cloud bench — the INTERACTIVE number (real swapchain present).
Mirrors the web pc-matrix protocol: continuous arcball orbit, present-cadence FPS, a result/1
record with the 5 gates. REQUIRES A REAL GUI SESSION (windowed) — it cannot run headless/CI;
that is precisely why the old view.py numbers were eyeballed. app.run(frame_count=N) presents N
frames to the window then returns (bounded — no infinite block).

    REFRESH_HZ=120 python datoviz_windowed.py [base] [psize] [frames]

REFRESH_HZ env = the operator's display refresh (for the vsync-bound presentation gate; default 120).
Writes manifold-bench/native/results.windowed.json (one record per cloud base, upserted).
"""
import sys, os, json
import numpy as np

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "..", "bench-core", "py"))
from cloud import load, manifest                                    # noqa: E402
from schema import make_record, validate                           # noqa: E402
from provenance import provenance                                  # noqa: E402
from gates import (gpu_gate, coverage_gate, presentation_gate_native,  # noqa: E402
                   input_honesty_gate, camera_state_gate)

base = sys.argv[1] if len(sys.argv) > 1 else "swiss_roll_1000000"
psize = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
FRAMES = int(sys.argv[3]) if len(sys.argv) > 3 else 300
REFRESH_HZ = float(os.environ.get("REFRESH_HZ", "120"))
RENDERER = "Datoviz/Vulkan via MoltenVK on Metal"

pos, col = load(base)
N = len(pos)
c = pos.mean(0)
position = np.ascontiguousarray((pos - c) / (np.abs(pos - c).max() + 1e-9), np.float32)
color = np.empty((N, 4), np.uint8); color[:, :3] = col; color[:, 3] = 255
size = np.full(N, psize, np.float32)

prov = provenance()
err = None
m = {"fps": 0.0, "frames": 0, "p50ms": 0.0, "p95ms": 0.0}
try:
    import datoviz as dvz
    from probe import FrameTimer
    app = dvz.App(background="black")        # WINDOWED — real OS window + swapchain present
    fig = app.figure(1440, 900)
    panel = fig.panel()
    arcball = panel.arcball(initial=(0.6, 0.6, 0.0))
    visual = app.point(position=position, color=color, size=size)
    panel.add(visual)
    ft = FrameTimer()
    ang = [0.0]

    @app.on_frame(fig)
    def _on_frame(ev):
        ang[0] += 0.02                       # continuous orbit → genuine redraw every frame
        arcball.set((0.5, ang[0], 0.0))
        ft.tick()

    app.run(frame_count=FRAMES)              # present FRAMES frames, then return (bounded)
    app.destroy()
    m = ft.result()
except Exception as e:
    err = e

expected = next((x["n"] for x in manifest()["clouds"] if x["base"] == base), N)
gate_results = {
    "gpu": gpu_gate(RENDERER, software=False),
    "coverage": coverage_gate(N, expected),
    "presentation": presentation_gate_native(offscreen=False, fps=m["fps"], refresh_hz=REFRESH_HZ, mode="interactive"),
    "cameraState": camera_state_gate("overview", ["overview"]),
    "inputHonesty": input_honesty_gate("arcball"),
}
rec = make_record(
    domain="manifold", tool="datoviz",
    engine={"library": "datoviz", "version": __import__("datoviz").__version__ if err is None else "?"},
    dataset={"name": base, "descriptor": "manifold-bench/data/manifest.json", "expectedLoaded": {"points": expected}},
    primitives=["points"], scale={"points": N},
    coverage={"engine": {"points": N}, "edgePolicy": "points", "ok": gate_results["coverage"]["pass"]},
    protocol={"driver": "arcball", "cameraState": "overview", "motion": "continuous-orbit",
              "frames": FRAMES, "windowed": True, "headed": True, "refreshHz": REFRESH_HZ},
    metrics={"fps": m["fps"], "frames": m["frames"], "p50ms": m["p50ms"], "p95ms": m["p95ms"]},
    presentation={"surface": "onscreen", "method": "windowed-vsync", "presented": gate_results["presentation"]["pass"]},
    gpu={"renderer": RENDERER, "software": False},
    gate_results=gate_results, provenance=prov, error=err,
)

out = os.path.join(HERE, "results.windowed.json")
existing = []
if os.path.exists(out):
    try:
        existing = json.load(open(out))
    except Exception:
        existing = []
existing = [r for r in existing if not (r.get("tool") == "datoviz" and r.get("dataset", {}).get("name") == base)]
existing.append(rec)
json.dump(existing, open(out, "w"), indent=2)

v = validate(rec)
present = "✓" if gate_results["presentation"]["pass"] else ("n/a" if gate_results["presentation"]["verdict"] == "n/a" else "✗")
print(f"datoviz windowed  {base}: {N:,} pts  fps={m['fps']}  present={present}  ok={rec['ok']}  valid={v['valid']}")
if err:
    print("  RUN FAILED (likely no display / GUI session):", str(err)[:200])
print("  wrote", out)
