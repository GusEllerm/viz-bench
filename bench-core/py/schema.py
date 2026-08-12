"""result/1 record — Python mirror of bench-core/node/schema.mjs. Same shape so report-gen
consumes JS and native records identically. A failing gate quarantines (ok:false), not drops."""
RESULT_SCHEMA_VERSION = "result/1"
REQUIRED_GATES = ["gpu", "coverage", "presentation", "cameraState", "inputHonesty"]


def _passed(gr):
    return bool(gr) and (gr.get("pass") or gr.get("verdict") == "n/a")


def _verdict_str(gr):
    if not gr:
        return "missing"
    if gr.get("verdict") == "n/a":
        return "n/a" + (": " + gr["detail"] if gr.get("detail") else "")
    return ("pass" if gr.get("pass") else "fail") + (": " + gr["detail"] if gr.get("detail") else "")


def make_record(*, domain, tool, engine, dataset, primitives, scale, coverage, protocol,
                metrics, presentation, gpu, gate_results=None, provenance=None, error=None, timings=None):
    gate_results = gate_results or {}
    gates = {k: _verdict_str(v) for k, v in gate_results.items()}
    ok = (error is None) and all(_passed(v) for v in gate_results.values())
    gate_failures = [
        f"{k}: {(v or {}).get('detail') or (v or {}).get('verdict') or 'fail'}"
        for k, v in gate_results.items() if not _passed(v)
    ]
    rec = {
        "schemaVersion": RESULT_SCHEMA_VERSION, "domain": domain, "tool": tool, "engine": engine,
        "dataset": dataset, "primitives": primitives, "scale": scale, "coverage": coverage,
        "protocol": protocol, "metrics": metrics, "presentation": presentation, "gpu": gpu,
        "gates": gates, "ok": ok, "gateFailures": gate_failures, "provenance": provenance,
    }
    if error is not None:
        rec["error"] = str(error)
    if timings is not None:
        rec["timings"] = timings
    return rec


def validate(rec):
    p = []
    if rec.get("schemaVersion") != RESULT_SCHEMA_VERSION:
        p.append(f"schemaVersion={rec.get('schemaVersion')}")
    if not (rec.get("protocol") or {}).get("cameraState"):
        p.append("protocol.cameraState")
    g = rec.get("gates") or {}
    for k in REQUIRED_GATES:
        if g.get(k) is None:
            p.append(f"gates.{k}")
    return {"valid": len(p) == 0, "problems": p}
