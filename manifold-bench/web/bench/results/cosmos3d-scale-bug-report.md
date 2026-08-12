# `getPointPositions` / `fitView` fail above ~44.7M points in 3D (RangeError: Invalid array length), leaving the camera mis-framed and the scene depth-clipped

One-line summary: `getPointPositions` builds its result as a plain JS array; once `pointsNumber × dimensions` exceeds 2^27 (134,217,728) elements V8 throws `RangeError: Invalid array length` mid-fill, which also breaks `fitView` (it reads positions through the same call), and the resulting camera state makes the scene render black or as thin clipped slivers. First failing counts: **44,739,243 points in 3D**, **67,108,865 points in 2D**.

## Setup

- `@cosmograph/cosmos` **3.4.1**, the shipped `dist/index.min.js` (UMD) loaded via `<script>`; nothing patched.
- Headless Chromium **148.0.7778.96** (Playwright), launched with `--use-angle=metal`, on macOS arm64 (Apple Silicon). WebGL2 over ANGLE Metal. `--js-flags=--max-old-space-size=8192` so large-N runs don't hit the default heap cap.
- Graph config:

```js
const graph = new Cosmos.Graph(div, {
  spaceDimensions: 3,          // 2 for the 2D runs
  enableSimulation: false,
  rescalePositions: true,      // false only in the workaround run
  fitViewOnInit: false,
  backgroundColor: '#000000',
});
graph.setPointPositions(positions, { dimensions: 3 });
graph.setPointColors(rgba);    // per-point RGBA Float32Array
graph.render();
```

- Points: synthetic "swiss roll" generated in-page with a seeded mulberry32 PRNG (seed 42), so every N is deterministic and the correct render is visually obvious (a rolled ribbon). Real-world-scale coordinates: x ∈ [-7.58, 10.08], y ∈ [0, 21], z ∈ [-8.83, 11.31] (extent ≈ 20 units), i.e. nothing near the engine's `[0, spaceSize=4096]` space.

```js
const t = 1.5 * Math.PI * (1 + 2 * rand());
const x = t * Math.cos(t) * 0.8, z = t * Math.sin(t) * 0.8, y = 21 * rand();
```

- Each N ran in a fresh browser instance. All numbers below are copied from the probe output verbatim.

## Steps & observations

1. **I did:** loaded N = 1,000,000 (3D, `rescalePositions: true`) and read `getCameraState()` before calling anything else.
   **I saw:** `target ≈ [1.251, 10.500, 1.239], distance ≈ 55.60, azimuth 0, polar π/2` — exactly a fit of the **raw input** bounding box (its center is [1.25, 10.5, 1.24]). So the initial camera (seeded at `setPointPositions` time) frames the raw coordinates, and a later `fitView` is what re-frames to the engine's rescaled space. This initial state is identical at every N tested.

2. **I did:** called `graph.fitView(0)` at N = 1,000,000, then `getCameraState()` and `getPointPositions({ dimensions: 3 })`.
   **I saw:** camera moved to `target = [2048, 2048, 2048], distance ≈ 8675.20`; the screenshot shows the full swiss roll, correctly framed (`shots/3d_rs_1000000_fit.png`). `getPointPositions` returned length 3,000,000; first point `[1102.22, 1878.56, 798.83]` — rescaled coordinates as expected. Clean baseline.

3. **I did:** repeated step 2 at N = 16,777,216 (4096²), 20,000,000, 25,000,000, 33,554,432 (2^25), 40,000,000, and 44,739,242.
   **I saw:** all identical to the baseline: `fitView` lands on `[2048, 2048, 2048]` at distance ≈ 8675.19, `getPointPositions` returns exactly `N × 3` values, and the first point reads back `[1102.22, 1878.56, 798.83]` every time. No power-of-two texture boundary is involved: 4096², 2^25, and everything between pass.

4. **I did:** the same at N = 44,739,243 — one point more than step 3's last value.
   **I saw:** `graph.fitView(0)` **threw**:

   ```
   RangeError: Invalid array length
       at ST.getPointPositions (cosmos.min.js:4270:105053)
       at ST.getFitViewPositions3D (cosmos.min.js:4270:116950)
       at ST.fitView (cosmos.min.js:4270:105494)
   ```

   `getCameraState()` afterwards was unchanged from step 1 (`target [1.251, 10.500, 1.239], distance 55.60`) — the camera never moved, so it still frames the raw input bounds. A direct `getPointPositions({ dimensions: 3 })` threw the identical `RangeError` at the same site. Note the GPU texture size is **6689 × 6689 at both 44,739,242 and 44,739,243** — the flip happens with no change in texture dimensions. What changes is the output array length crossing 2^27: 44,739,242 × 3 = 134,217,726 (OK), 44,739,243 × 3 = 134,217,729 (throws).

5. **I did:** N = 50,000,000 (the originally reported size), same page.
   **I saw:** same two `RangeError`s verbatim, camera left at `target [1.251, 10.500, 1.239], distance 55.60`, and the screenshot after the failed `fitView` is **fully black** (`shots/3d_rs_50000000_fit.png`). That is consistent with the camera still framing the ~20-unit raw box while the points on the GPU sit in the rescaled [0, 4096] cube, far beyond the automatically derived far plane. No WebGL/GL errors and no crash — the only console output is an unrelated `cosmos.gl: 'setZoomLevel' is not supported in 3D mode` warning that appears on every 3D load.

6. **I did:** at N = 50,000,000, pointed the camera into the rescaled space manually: `setCameraState({ target: [2048, 2048, 2048], distance: 8400, azimuth: 0.6, polar: 1.2 })`.
   **I saw:** only thin curved slivers of the roll — three narrow ribbon arcs on black (`shots/3d_rs_50000000_manualcam.png`). Most of the cloud is clipped away.

7. **I did:** kept that exact camera and only widened the clip planes: `setConfigPartial({ cameraNear: 1, cameraFar: 50000 })`.
   **I saw:** the **complete, correct** swiss roll at 50M points (`shots/3d_rs_50000000_manualcam_wideclip.png`). So the positions on the GPU are correctly rescaled even at 50M; the slivers in step 6 are purely near/far clipping. The auto-derived planes are `distance ∓ 2 × sceneRadius`, and `sceneRadius` was last set by the step-1 init fit over the raw input (≈ 17), because the `fitView` that would have updated it threw and `setCameraState` does not touch it — giving a visible depth shell only ~68 units deep at distance 8400 in a ~3300-unit cloud.

8. **I did:** the same sweep in **2D** (`spaceDimensions: 2`, 2-component positions): N = 50,000,000, 67,108,863, 67,108,864, 67,108,865.
   **I saw:** 50M in 2D is fine (`fitView` OK, zoom level 1 → 0.0905, readback returns 100,000,000 values, screenshot shows the full spiral — `shots/2d_rs_50000000_fit.png`). 67,108,863 and 67,108,864 (× 2 = exactly 2^27) are fine. **67,108,865** (× 2 = 134,217,730) throws the same `RangeError` from `getPointPositions` via `getFitViewPositions` via `fitView`, and the view stays unfitted (zoom level remains 1). So the failure is not 3D-specific — it is the same limit reached at N × dimensions, which 3D hits ~1.5× sooner.

9. **I did:** reproduced the array behavior in isolation (no cosmos, no GPU) in Node 22:

   ```js
   const n = []; n.length = 150000000;
   for (let i = 0; i < 150000000; i++) n[i] = 1.5;   // throws
   // RangeError: Invalid array length
   ```

   **I saw:** dense index-assignment into a plain array whose `length` was preset past ~2^27 throws partway through the fill. Boundary measured in Chromium 148: preset length 134,217,728 (2^27) still fills, 134,217,729+ throws; Node 22's V8 flips one element earlier (134,217,727 OK, 134,217,728 throws). The engine's thresholds match the Chromium boundary exactly: fails when `N × dims > 2^27`.

10. **I did:** located the throw site in the shipped bundle. The minified stack column (4270:105053 in 3D, 4270:105023 in 2D) is the element store inside `getPointPositions`' fill loop (`n[s*i+2]=r[s*4+3]??0` and `n[s*i]=o` respectively) — the first store whose backing-array growth crosses the V8 limit.

## Threshold table

| N | dims | N × dims | texture side | `fitView` | render after `fitView` | `getPointPositions` |
|---|---|---|---|---|---|---|
| 1,000,000 | 3 | 3,000,000 | 1000 | ok → [2048,2048,2048] d≈8675 | correct | ok (3,000,000) |
| 16,777,216 (4096²) | 3 | 50,331,648 | 4096 | ok | correct | ok |
| 20,000,000 | 3 | 60,000,000 | 4473 | ok | correct | ok |
| 25,000,000 | 3 | 75,000,000 | 5000 | ok | correct | ok |
| 33,554,432 (2^25) | 3 | 100,663,296 | 5793 | ok | correct | ok |
| 40,000,000 | 3 | 120,000,000 | 6325 | ok | correct | ok |
| 44,739,242 | 3 | 134,217,726 | 6689 | ok | correct | ok |
| **44,739,243** | 3 | 134,217,729 | 6689 | **RangeError** | **black** (camera on raw bounds) | **RangeError** |
| 50,000,000 | 3 | 150,000,000 | 7072 | **RangeError** | **black**; manual camera → slivers | **RangeError** |
| 50,000,000 | 2 | 100,000,000 | 7072 | ok | correct | ok (100,000,000) |
| 67,108,864 (2^26) | 2 | 134,217,728 | 8192 | ok | correct | ok |
| **67,108,865** | 2 | 134,217,730 | 8193 | **RangeError** | unfitted (zoom stays 1) | **RangeError** |

Rule observed: everything fails together exactly when `N × dimensions > 134,217,728 (2^27)`; texture dimensions are not a factor (6689² on both sides of the 3D flip).

## Workaround we're using

At 50M in 3D, this renders the full cloud correctly (verified in this repro, `shots/3d_noRs_50000000_workaround.png`):

- `rescalePositions: false` (positions stay in known real-world coordinates),
- explicit `cameraNear` / `cameraFar` in the config (e.g. `0.1` / `1000` for a ~20-unit cloud), bypassing the `sceneRadius`-derived planes,
- camera placed manually from our own bounding box via `setCameraState` (never calling `fitView` / `getPointPositions` above the threshold).

Step 7 shows `rescalePositions: true` also works if one avoids `fitView` and supplies wide explicit `cameraNear`/`cameraFar` — the rescale itself is sound at 50M.

## Proposed diagnosis (hypothesis)

`getPointPositions` (dist/index.js, lines 10181–10195 of the 3.4.1 ESM build) assembles the result in a **plain JS array** sized `pointsNumber * dimensions`:

```js
getPointPositions(e) {
    if (this._isDestroyed || !this.device || !this.points) return [];
    if (this.graph.pointsNumber === void 0) return [];
    const t = (e == null ? void 0 : e.dimensions) ?? 2, i = [], n = M(this.device, this.points.currentPositionFbo);
    i.length = this.graph.pointsNumber * t;
    for (let o = 0; o < this.graph.pointsNumber; o += 1) {
      ...
      const s = n[o * 4 + 0], r = n[o * 4 + 1];
      s !== void 0 && r !== void 0 && (i[o * t] = s, i[o * t + 1] = r, t === 3 && (i[o * t + 2] = n[o * 4 + 3] ?? 0));
    }
    return i;
}
```

V8 cannot densely fill a plain array past 2^27 elements: once `i.length` is preset above that, the element store that grows the backing past the limit throws `RangeError: Invalid array length` (step 9 reproduces this in three lines). The GPU readback itself (`M` → `readPixelsToArrayWebGL`, an 800 MB Float32Array at 7072²) succeeds — only the plain-array copy fails. Switching `i` to a preallocated `Float32Array(this.graph.pointsNumber * t)` would remove the limit (typed arrays of 150M elements are fine, as the readback array itself demonstrates).

The two rendering symptoms are downstream of that throw plus two camera details:

- `fitView` in 3D calls `getFitViewPositions3D()` → `getPointPositions({ dimensions: 3 })` (dist lines 10212–10219, 10563–10565), so it dies mid-call and never moves the camera. The camera is then still in the state seeded by `maybeInitializeCamera` (dist 10650–10658), which runs at `setPointPositions` time and fits the **raw** `inputPointPositions` — rescaling only happens later, during the first render. Hence "fitView left the camera at the raw input bounds" and the black screen.
- The projection's clip planes are auto-derived as `near = distance − 2·sceneRadius`, `far = distance + 2·sceneRadius` (dist 9631: `const o = t ?? Math.max(this.distance - this.sceneRadius * 2, this.sceneRadius * 0.01), s = Math.max(i ?? this.distance + this.sceneRadius * 2, o * 1.01)`). `sceneRadius` is only updated by `fitToPositions` / `setEyePosition` / `setSceneRadius` — `setCameraState` leaves it untouched. After the failed `fitView` it is still ≈ 17 (from the raw-bounds init fit), so a manual camera at distance 8400 gets a ~68-unit-deep visible shell — the thin curved slivers of step 6. Refreshing `sceneRadius` in `setCameraState` (or clamping the auto planes less aggressively) would make manual camera placement robust independently of the array fix.

Repro files (single static page + driver) are available: `repro.html?n=<N>&dim=<2|3>&rescale=<0|1>[&near=&far=]` against the stock `dist/index.min.js`.
