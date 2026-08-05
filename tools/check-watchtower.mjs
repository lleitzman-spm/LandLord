/**
 * Is the watchtower MANNED in the build we are about to ship? — a guard.
 *
 *   node tools/check-watchtower.mjs [--require]
 *
 * The watchtower (src/watch.ts) reports failed vault writes to Sentry, and its
 * DSN arrives through `import.meta.env.VITE_SENTRY_DSN`. Vite INLINES that at
 * BUILD time. So a build run without the variable produces a bundle in which
 * `Sentry.init` is never reached — the tower stands, unmanned, and every lost
 * write it exists to report goes nowhere. Nothing about the running app looks
 * wrong. No error appears. It is silent in exactly the way the watchtower was
 * built to stop things being silent.
 *
 * That is not hypothetical. The herald's deploy step ran a bare `npm run
 * build` from 2026-07-28 (when the watchtower was raised) until 2026-07-29, so
 * every production bundle in that window shipped dark — while the handoff
 * carried "confirm Sentry delivers from your browser" as an item owed from
 * Edwin, as though the answer depended on his browser. It never could have
 * arrived from any browser. Found by reading the LIVE bundle and finding no
 * DSN in it at all.
 *
 * So: the deploy asserts it now, on the artifact itself rather than on the
 * intent. Two things must be true of the bundle —
 *   1. the Sentry SDK is actually in it (not tree-shaken away), and
 *   2. an ingest DSN string is in it, and it is the one we meant.
 *
 * Exit 0 = manned (or skipped), 1 = the tower would ship dark.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'dist', 'assets');
const require_ = process.argv.includes('--require');
const want = (process.env.VITE_SENTRY_DSN || '').trim();

/** A Sentry DSN, as it appears once Vite has inlined it into the bundle. */
const DSN_SHAPE = /https:\/\/[a-f0-9]+@[a-z0-9.-]*ingest[a-z0-9.-]*sentry\.io\/[0-9]+/g;
/** Proof the SDK itself survived the build — an internal marker, not our code. */
const SDK_MARKERS = ['_sentrySpan', 'sentry-trace', 'captureException'];

let files;
try {
  files = readdirSync(assets).filter((f) => f.startsWith('index-') && f.endsWith('.js'));
} catch {
  console.error('FAIL  watchtower: no dist/assets — run `npm run build` first.');
  process.exit(1);
}
if (files.length === 0) {
  console.error('FAIL  watchtower: dist/assets holds no index-*.js bundle.');
  process.exit(1);
}

const bundle = files.map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');
const found = [...new Set(bundle.match(DSN_SHAPE) ?? [])];
const sdk = SDK_MARKERS.filter((m) => bundle.includes(m));

if (!want) {
  if (require_) {
    console.error('FAIL  watchtower: VITE_SENTRY_DSN is not set in this build environment.');
    console.error('      A production build without it ships a DARK watchtower: every lost');
    console.error('      write goes unreported and nothing anywhere says so. Set it in the');
    console.error('      deploy; the DSN is NOT a secret');
    console.error('      and the committed one lives in .env.example.');
    process.exit(1);
  }
  console.log('SKIP  watchtower: VITE_SENTRY_DSN unset — nothing to assert.');
  console.log(`      (the built bundle carries ${found.length} DSN string(s).)`);
  console.log('      Deploys run this with --require, which makes the unset case a FAILURE.');
  process.exit(0);
}

let bad = 0;

if (sdk.length === 0) {
  console.error('  FAIL  the Sentry SDK is not in the bundle at all — it was tree-shaken');
  console.error('        away, so no event could be sent even with a DSN present.');
  bad++;
} else {
  console.log(`  ok    the SDK is in the bundle (${sdk.join(', ')})`);
}

if (found.length === 0) {
  console.error('  FAIL  no ingest DSN in the bundle. `Sentry.init` is never reached, so');
  console.error('        the watchtower is UNMANNED in this build.');
  bad++;
} else if (!found.includes(want)) {
  console.error(`  FAIL  the bundle carries a DSN that is not the one this build was given.`);
  console.error(`        wanted ...${want.slice(-24)}`);
  console.error(`        found  ${found.map((d) => `...${d.slice(-24)}`).join(', ')}`);
  bad++;
} else {
  console.log(`  ok    the DSN we were given is inlined (...${want.slice(-24)})`);
}

if (bad) {
  console.error('');
  console.error('WATCHTOWER DARK — this build would report nothing, from any browser,');
  console.error('and would look exactly like a build that reports everything.');
  process.exit(1);
}

console.log('\nMANNED — the watchtower will report from this build.');
