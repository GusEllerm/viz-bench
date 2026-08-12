// Provenance attached to every result so a number is traceable to a run: timestamp,
// git commit, machine/OS/node, and the harness version. node-only.
import { execSync } from 'node:child_process';
import os from 'node:os';

export const HARNESS_VERSION = '@viz-bench/bench-core/1';

export function provenance({ harness = HARNESS_VERSION } = {}) {
  let gitCommit = null;
  try { gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  // Machine is recorded GENERICIZED (family, not exact model): this repo is public and
  // results/*.json are committed, so provenance must be publishable as-is. The report's
  // leak test still backstops docs/ output.
  let machine = process.arch;
  try { machine = /apple/i.test(os.cpus()?.[0]?.model || '') ? 'Apple-Silicon (Metal)' : process.arch; } catch {}
  return {
    timestamp: new Date().toISOString(),
    gitCommit,
    machine,
    os: process.platform,
    node: process.version.split('.')[0],
    harness,
  };
}
