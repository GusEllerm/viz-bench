"""Native gates — mirror bench-core/node/gates.mjs, with the NATIVE presentation gate.
The web presentation gate is pixel-diff (uncapped headless rAF); the native one is
offscreen==False + a vsync bound: a windowed swapchain is vsync-locked, so an offscreen
loop running at thousands of fps (the Datoviz ~200 fps @50M artifact) is rejected from the
interactive path. Offscreen runs may only emit throughput-mode records, excluded from
interactive tables."""
import re

SANCTIONED_DRIVERS = {"arcball", "orbit", "apiCamera"}


def gpu_gate(renderer, software, expected_re=r"Apple M\d|Metal|MoltenVK|Vulkan"):
    if software:
        return {"pass": False, "verdict": "fail", "detail": "software fallback: " + str(renderer)}
    if expected_re and not re.search(expected_re, str(renderer or ""), re.I):
        return {"pass": False, "verdict": "fail", "detail": "unexpected renderer: " + str(renderer)}
    return {"pass": True, "verdict": "pass", "detail": str(renderer)}


def coverage_gate(engine_points, expected_points):
    ok = engine_points >= expected_points * 0.99
    return {"pass": ok, "verdict": "pass" if ok else "fail", "detail": f"points {engine_points}/{expected_points}"}


def presentation_gate_native(*, offscreen, fps, refresh_hz, mode="interactive"):
    if mode == "throughput" or offscreen:
        # throughput-only — no swapchain present; legitimate but NEVER interactive
        return {"pass": True, "verdict": "n/a", "detail": f"offscreen/throughput (~{fps:.0f} fps, no present)"}
    ceil = refresh_hz * 1.5
    ok = 0 < fps <= ceil
    return {
        "pass": ok, "verdict": "pass" if ok else "fail",
        "detail": f"windowed {fps:.1f} fps {'≤' if fps <= ceil else '>'} {ceil:.0f} (refresh {refresh_hz}×1.5)",
    }


def input_honesty_gate(driver):
    ok = driver in SANCTIONED_DRIVERS
    return {"pass": ok, "verdict": "pass" if ok else "fail", "detail": f"driver={driver}"}


def camera_state_gate(state, supports):
    ok = bool(state) and state in (supports or [])
    return {"pass": ok, "verdict": "pass" if ok else "fail", "detail": f"state={state} supports={'|'.join(supports or [])}"}
