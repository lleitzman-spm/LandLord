import { defineConfig } from 'vitest/config';

// The safety net (Shot 0). The pure domain is React- and I/O-free, so tests
// import `src/domain/*` directly — a real runner resolves the extensionless
// TS imports that forced the operator-core bundle for raw Node. Node env; no
// DOM needed for the fold functions where correctness lives.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
