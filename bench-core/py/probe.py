"""Windowed frame-timing probe for native renderers — FPS = present cadence over a fixed
frame budget (the analog of the web rAF probe). Timestamp each presented frame, then derive
fps + percentiles. Wall-clock perf_counter in the per-frame callback measures the windowed
present rate (vsync-bound when windowed)."""
import time


class FrameTimer:
    def __init__(self):
        self.t = []

    def tick(self):
        self.t.append(time.perf_counter())

    def result(self):
        t = self.t
        if len(t) < 2:
            return {"fps": 0.0, "frames": len(t), "p50ms": 0.0, "p95ms": 0.0, "maxms": 0.0}
        iv = sorted(t[i] - t[i - 1] for i in range(1, len(t)))
        span = t[-1] - t[0]
        q = lambda x: iv[min(len(iv) - 1, int(x * len(iv)))] * 1000
        return {
            "fps": round((len(t) - 1) / span, 1) if span > 0 else 0.0,
            "frames": len(t),
            "p50ms": round(q(0.5), 1),
            "p95ms": round(q(0.95), 1),
            "maxms": round(iv[-1] * 1000, 1),
        }
