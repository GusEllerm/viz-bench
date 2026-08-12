// Rendering primitives a visualization draws. This is the PERFORMANCE axis of the
// project: every FPS finding is explained by primitive × pixel-coverage (lines with
// alpha blending are overdraw-bound at a zoomed-out overview; points are fill-bound
// zoomed out, bandwidth-bound zoomed in). Declared per page and carried in the result
// schema, so a primitive×scale cost model is later a pure query across graph + manifold.
//
// Browser-safe — zero node imports (this file is bundled by Vite into the pages).
export const PRIMITIVE = {
  POINTS: 'points',
  LINES: 'lines',
  SURFACE: 'surface',
  DENSITY: 'density',
  VOLUME: 'volume',
};
