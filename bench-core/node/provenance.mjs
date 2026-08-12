// Provenance attached to every result so a number is traceable to a run: timestamp,
// git commit, machine/OS/node, and the harness version. node-only.
import { execSync } from 'node:child_process';
import os from 'node:os';

export const HARNESS_VERSION = '@viz-bench/bench-core/1';

export function provenance({ harness = HARNESS_VERSION } = {}) {
  let gitCommit = null;
  try { gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  let machine = process.arch;
  try { machine = os.cpus()?.[0]?.model || process.arch; } catch {}
  return {
    timestamp: new Date().toISOString(),
    gitCommit,
    machine,
    os: `${process.platform} ${os.release()}`,
    node: process.version,
    harness,
  };
}
