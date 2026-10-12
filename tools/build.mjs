#!/usr/bin/env node
// Bundle the game: src/main.ts -> dist/game.js (+ external sourcemap), index.html -> dist/.
//   node tools/build.mjs          minified production build
//   node tools/build.mjs --dev    unminified, same outputs
// Exits non-zero on any error.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dev = process.argv.includes('--dev');
const dist = path.join(root, 'dist');
const kb = n => (n / 1024).toFixed(1).padStart(8) + ' kB';

try {
  mkdirSync(dist, { recursive: true });
  const t0 = Date.now();
  await build({
    entryPoints: [path.join(root, 'src/main.ts')],
    outfile: path.join(dist, 'game.js'),
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: !dev,
    sourcemap: 'external',
    legalComments: 'none',
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
  });
  copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
  const js = path.join(dist, 'game.js');
  console.log(`LandLord built in ${Date.now() - t0} ms${dev ? ' (dev, unminified)' : ''}`);
  console.log(`  dist/game.js     ${kb(statSync(js).size)}  (${kb(gzipSync(readFileSync(js)).length).trim()} gzipped)`);
  console.log(`  dist/game.js.map ${kb(statSync(js + '.map').size)}`);
  console.log(`  dist/index.html  ${kb(statSync(path.join(dist, 'index.html')).size)}`);
} catch (err) {
  console.error('[build] failed:', err && err.message ? err.message : err);
  process.exit(1);
}
