import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The operator's build — a tiny lib bundle of the pure domain engine so the raw-
// Node harness can import it (swing four, WRIT-TASK-LANGUAGE). It is SEPARATE
// from `npm run build` (the app): this one entry, `src/operator-core.ts`, out to
// `dist-operator/operator-core.mjs` as an ES module with everything inlined
// (rollup externalizes nothing — the harness has no node_modules for the
// domain). No React, no DOM, no worker — just the readings and the hands.
export default defineConfig({
  build: {
    outDir: 'dist-operator',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/operator-core.ts'),
      formats: ['es'],
      fileName: () => 'operator-core.mjs',
    },
    rollupOptions: {
      // Bundle everything — the harness runs without the app's deps.
      external: [],
    },
    // The engine is pure; no minify so a reviewer can read the bundle.
    minify: false,
    target: 'node18',
  },
});
