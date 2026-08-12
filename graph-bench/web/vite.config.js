import { defineConfig } from 'vite'

// Cosmograph's data prep uses duckdb-wasm, which wants cross-origin isolation
// (SharedArrayBuffer). These headers enable it for dev + preview.
const coiHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  server: { port: 5180, strictPort: true, headers: coiHeaders },
  preview: { port: 5180, strictPort: true, headers: coiHeaders },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        cosmograph: 'cosmograph.html',
        cosmos: 'cosmos.html',
        helios: 'helios.html',
        helios3d: 'helios3d.html',
        heliospc: 'heliospc.html',
        sigma: 'sigma.html',
        g6: 'g6.html',
        deck: 'deck.html',
        forcegraph: 'forcegraph.html',
        sigmapre: 'sigmapre.html',
        pointclouddeck: 'pointcloud-deck.html',
        pointcloudthree: 'pointcloud-three.html',
        layoutbench: 'layout-bench.html',
        cosmos3d: 'cosmos3d.html',
      },
    },
  },
})
