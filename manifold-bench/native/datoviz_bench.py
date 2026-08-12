"""Datoviz OFFSCREEN throughput bench. Emits a result/1 record EXPLICITLY labeled
throughput-only (surface:offscreen, protocol.mode:throughput). Offscreen has NO swapchain
present, so FPS = frame_count/wall is batch/server-side THROUGHPUT — not interactive. The
native presentation gate marks it n/a-throughput, so report-gen EXCLUDES it from interactive
tables. For the interactive number use datoviz_windowed.py. (This is the path that once
produced the bogus "~200 fps @50M interactive" claim — now it can only emit throughput.)

    python datoviz_bench.py [base] [frames]
"""
import sys, os, time, json
import numpy as np

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "..", "bench-core", "py"))
from cloud import load, manifest                                   # noqa: E402
from schema import make_record                                     # noqa: E402
from provenance import provenance                                  # noqa: E402
from gates import (gpu_gate, coverage_gate, presentation_gate_native,  # noqa: E402
                   input_honesty_gate, camera_state_gate)
import datoviz as dvz                                              # noqa: E402

base = sys.argv[1] if len(sys.argv) > 1 else "swiss_roll_1000000"
FRAMES = int(sys.argv[2]) if len(sys.argv) > 2 else 300
RENDERER = "Datoviz/Vulkan via MoltenVK on Metal"

pos, col = load(base); N = len(pos)
c = pos.mean(0)
position = np.ascontiguousarray((pos - c) / (np.abs(pos - c).max() + 1e-9), np.float32)
color = np.empty((N, 4), np.uint8); color[:, :3] = col; color[:, 3] = 255
size = np.full(N, 3.0, np.float32)

app = dvz.App(offscreen=True, background="black")     # OFFSCREEN — no swapchain present
fig = app.figure(1440, 900); panel = fig.panel()
arcball = panel.arcball(initial=(0.6, 0.6, 0.0))
visual = app.point(position=position, color=color, size=size); panel.add(visual)
ang = [0.0]


@app.on_frame(fig)
def _on_frame(ev):
    ang[0] += 0.03
    arcball.set((0.5, ang[0], 0.0))


t0 = time.perf_counter()
app.run(frame_count=FRAMES)
dt = time.perf_counter() - t0
app.destroy()
fps = round(FRAMES / dt, 1)

prov = provenance()
expected = next((x["n"] for x in manifest()["clouds"] if x["base"] == base), N)
gate_results = {
    "gpu": gpu_gate(RENDERER, software=False),
    "coverage": coverage_gate(N, expected),
    "presentation": presentation_gate_native(offscreen=True, fps=fps, refresh_hz=120, mode="throughput"),
    "cameraState": camera_state_gate("overview", ["overview"]),
    "inputHonesty": input_honesty_gate("arcball"),
}
rec = make_record(
    domain="manifold", tool="datoviz-offscreen",
    engine={"library": "datoviz", "version": getattr(dvz, "__version__", "?")},
    dataset={"name": base, "expectedLoaded": {"points": expected}},
    primitives=["points"], scale={"points": N},
    coverage={"engine": {"points": N}, "edgePolicy": "points", "ok": gate_results["coverage"]["pass"]},
    protocol={"driver": "arcball", "cameraState": "overview", "motion": "continuous-orbit",
              "frames": FRAMES, "mode": "throughput", "windowed": False, "headed": False},
    metrics={"fps": fps, "frames": FRAMES, "wallSec": round(dt, 2)},
    presentation={"surface": "offscreen", "method": "none", "presented": False,
                  "note": "no swapchain present — batch throughput, NOT interactive"},
    gpu={"renderer": RENDERER, "software": False},
    gate_results=gate_results, provenance=prov,
)

out = os.path.join(HERE, "results.throughput.json")
existing = []
if os.path.exists(out):
    try:
        existing = json.load(open(out))
    except Exception:
        existing = []
existing = [r for r in existing if not (r.get("tool") == "datoviz-offscreen" and r.get("dataset", {}).get("name") == base)]
existing.append(rec)
json.dump(existing, open(out, "w"), indent=2)
print(f"datoviz OFFSCREEN {base}: {N:,} pts  throughput={fps} fps (NO present)  "
      f"presentation={gate_results['presentation']['verdict']}  ok={rec['ok']}")
print("  wrote", out, "— throughput-only; EXCLUDED from interactive tables by the presentation gate")
