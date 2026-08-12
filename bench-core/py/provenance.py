"""Provenance for native (Python) bench records — mirrors bench-core/node/provenance.mjs."""
import subprocess, platform, sys, datetime

HARNESS_VERSION = "@viz-bench/bench-core/1-py"


def _machine():
    try:
        s = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True)
        return s.stdout.strip() or platform.machine()
    except Exception:
        return platform.machine()


def provenance(harness=HARNESS_VERSION):
    try:
        git = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip() or None
    except Exception:
        git = None
    return {
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "gitCommit": git,
        "machine": _machine(),
        "os": f"{sys.platform} {platform.release()}",
        "python": sys.version.split()[0],
        "harness": harness,
    }
