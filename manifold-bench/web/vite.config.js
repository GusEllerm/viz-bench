import { defineConfig } from 'vite'

// Point-cloud / manifold renderer bench. Plain WebGL/WebGPU — no cross-origin-isolation
// needed (unlike the graph bench's Cosmograph/duckdb page).
export default defineConfig({
  server: { port: 5200, strictPort: true },
  preview: { port: 5200, strictPort: true },
  // Pre-bundle the render deps so the capability harness (which runs the DEV server) doesn't
  // hit a mid-run dep-optimizer reload racing waitForFunction.
  optimizeDeps: { include: ['sigma', 'graphology', '@sigma/edge-curve', '@sigma/node-image', 'three', '@deck.gl/core', '@deck.gl/layers', '@cosmos.gl/graph', '@cosmograph/cosmos', 'helios-web'] },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        deck: 'deck.html',
        three: 'three.html',
        cosmos: 'cosmos.html',
        capthree3d: 'cap-three-3d.html',
        capdeck3d: 'cap-deck-3d.html',
        capcosmos3d: 'cap-cosmos-3d.html',
        pointprobe: 'point-probe.html',
        densitydeck: 'density-deck.html',
        capcurved: 'cap-sigma-curvededges.html',
        capnodeimg: 'cap-sigma-nodeimage.html',
        capthreedensity: 'cap-three-density.html',
        capthreelines: 'cap-three-lines.html',
        capthreelabels: 'cap-three-labels.html',
        capthreenodeimg: 'cap-three-nodeimage.html',
        capdeckpick: 'cap-deck-pick.html',
        capsigmapick: 'cap-sigma-pick.html',
        capthreepick: 'cap-three-pick.html',
        // capability registry — Batch A (points / lines / labels / node-images / curved-edges)
        capthreepoints: 'cap-three-points.html',
        capsigmapoints: 'cap-sigma-points.html',
        capsigmalines: 'cap-sigma-lines.html',
        capsigmalabels: 'cap-sigma-labels.html',
        capdeckpoints: 'cap-deck-points.html',
        capdecklines: 'cap-deck-lines.html',
        capdecklabels: 'cap-deck-labels.html',
        capdecknodeimg: 'cap-deck-nodeimage.html',
        capdeckcurved: 'cap-deck-curvededges.html',
        // capability registry — Batch B (cosmos.gl)
        capcosmospoints: 'cap-cosmos-points.html',
        capcosmoslines: 'cap-cosmos-lines.html',
        capcosmoscurved: 'cap-cosmos-curvededges.html',
        capcosmospick: 'cap-cosmos-pick.html',
        capcosmoslabels: 'cap-cosmos-labels.html',
        capcosmosnodeimg: 'cap-cosmos-nodeimage.html',   // re-survey: cosmos.gl native node images
        capthreecurved: 'cap-three-curvededges.html',    // re-survey: three.js curved-edges workaround
        capcosmosdensity: 'cap-cosmos-density.html',     // density workaround (per-point density colour)
        capsigmadensity: 'cap-sigma-density.html',
        // capability registry — Batch C (helios-web)
        capheliospoints: 'cap-helios-points.html',
        caphelioslines: 'cap-helios-lines.html',
        capheliospick: 'cap-helios-pick.html',
        caphelioslabels: 'cap-helios-labels.html',
        capheliosdensity: 'cap-helios-density.html',
        // capability registry — layout / force simulation
        capsigmalayout: 'cap-sigma-layout.html',
        capcosmoslayout: 'cap-cosmos-layout.html',
        caphelioslayout: 'cap-helios-layout.html',
      },
    },
  },
})
