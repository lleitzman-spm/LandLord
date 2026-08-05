import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The war-game dealer's build — a lib bundle of the generator so the terminal
// can deal a world without driving the browser footer. Deliberately SEPARATE
// from `vite.operator.config.ts`: that bundle is imported by the deployed
// keyholder, and the dealer is a build-time tool that has no business growing
// the runtime's surface. Its own outDir too, because the operator build empties
// its directory and would otherwise sweep this away.
export default defineConfig({
  build: {
    outDir: 'dist-wargame',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/wargame-core.ts'),
      formats: ['es'],
      fileName: () => 'wargame-core.mjs',
    },
    rollupOptions: {
      // Bundle everything — the tools run without the app's deps.
      external: [],
    },
    minify: false,
    target: 'node18',
  },
});
