// Shared loader for the binary point clouds (prep/gen_manifolds.py + prep/embed_graph.py).
// Each cloud = <base>.pos.f32 (N*3 float32 xyz) + <base>.col.u8 (N*3 uint8 rgb).
export async function loadManifest() {
  return (await fetch('data/manifest.json')).json();
}

export function pickCloud(manifest, base) {
  const clouds = manifest.clouds || [];
  return clouds.find((c) => c.base === base) || clouds.slice().sort((a, b) => a.n - b.n)[0];
}

export async function loadCloud(entry) {
  const [posBuf, colBuf] = await Promise.all([
    fetch(`data/${entry.pos}`).then((r) => { if (!r.ok) throw new Error(`fetch ${entry.pos} → ${r.status}`); return r.arrayBuffer(); }),
    fetch(`data/${entry.col}`).then((r) => { if (!r.ok) throw new Error(`fetch ${entry.col} → ${r.status}`); return r.arrayBuffer(); }),
  ]);
  const positions = new Float32Array(posBuf);
  const colors = new Uint8Array(colBuf);
  const n = positions.length / 3;
  // centre + radius (for camera fit); prefer the manifest bbox, else compute
  let min = entry.bbox?.[0], max = entry.bbox?.[1];
  if (!min || !max) {
    min = [Infinity, Infinity, Infinity]; max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
      const v = positions[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
    }
  }
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;
  return { n, positions, colors, center, radius, name: entry.name, base: entry.base };
}

export function cloudParam() {
  return new URLSearchParams(location.search).get('c');
}
