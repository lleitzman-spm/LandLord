/**
 * Which seats can find work — swept across seeds, with no brain and no cost.
 *
 *   npm run build:wargame && npm run build:operator
 *   node tools/fleet-coverage.mjs [seeds...]        (default: 12 seeds)
 *
 * A fleet run against the live brain proves the clerks REASON. It does not
 * prove the fleet is exercised: a seat with nothing sitting at its commitment
 * step is silent, and a silent seat is indistinguishable from a broken one.
 * The first grand-muster run had 10 of 14 seats produce work, and reading that
 * as "10 work, 4 are broken" would have been wrong on both halves.
 *
 * So this counts, per seed, how many cases actually SIT at each clerk's
 * commitment step — the same predicate the clerks filter on (flow key + next
 * step key + holder), read through the real engine. No API calls, so a wide
 * sweep is free and deterministic.
 *
 * The commitment tables are IMPORTED from the clerk modules, never restated
 * here. A copy would drift the moment a seat is retuned, and then this tool
 * would confidently measure a fleet that no longer exists.
 */

import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMITMENTS as ACCT } from '../harness/acct-desk.mjs';
import { COMMITMENTS as BD } from '../harness/bd-desk.mjs';
import { COMMITMENTS as COL } from '../harness/col-desk.mjs';
import { COMMITMENTS as RES } from '../harness/res-desk.mjs';
import { COMMITMENTS as TURN } from '../harness/turn-desk.mjs';
import { COMMITMENTS as VIOL } from '../harness/viol-desk.mjs';
import { FLOW_KEY, COMMIT_STEP_KEYS, SETTLE_STEP_KEYS, LEASE_COMMITMENTS } from '../harness/clerks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wg = await import(pathToFileURL(resolve(root, 'dist-wargame/wargame-core.mjs')).href);
const core = await import(pathToFileURL(resolve(root, 'dist-operator/operator-core.mjs')).href);

/** seat → [{ flow, step }] — every reasoning clerk's grip, from the clerks. */
const SEATS = {
  'va-desk (vendor)': [...COMMIT_STEP_KEYS].map((step) => ({ flow: FLOW_KEY, step })),
  'lp-queue (price)': [...SETTLE_STEP_KEYS].map((step) => ({ flow: FLOW_KEY, step })),
  'osric (leasing)': Object.entries(LEASE_COMMITMENTS).flatMap(([flow, c]) =>
    c.stepKeys.map((step) => ({ flow, step })),
  ),
  'turn-desk': Object.entries(TURN).map(([flow, c]) => ({ flow, step: c.stepKey })),
  'bd-desk': Object.entries(BD).map(([flow, c]) => ({ flow, step: c.stepKey })),
  'res-desk': Object.entries(RES).map(([flow, c]) => ({ flow, step: c.stepKey })),
  'acct-desk': Object.entries(ACCT).map(([flow, c]) => ({ flow, step: c.stepKey })),
  'col-desk': Object.entries(COL).map(([flow, c]) => ({ flow, step: c.stepKey })),
  'viol-desk': Object.entries(VIOL).map(([flow, c]) => ({ flow, step: c.stepKey })),
};

const setting = JSON.parse(readFileSync(resolve(root, 'data/library/pm-setting.json'), 'utf8'));
const base = wg.normalizeChronicle(JSON.parse(readFileSync(resolve(root, 'data/chronicle.json'), 'utf8')));

const seeds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Array.from({ length: 12 }, (_, i) => `sweep-${i + 1}`);

const found = Object.fromEntries(Object.keys(SEATS).map((s) => [s, []]));

for (const seed of seeds) {
  // Deal in memory. Nothing is written; data/chronicle.json is never touched.
  const game = wg.generateGrandMuster({
    seed,
    end: new Date().toISOString(),
    flows: setting.flows,
    catalog: setting.catalog,
    plan: setting.plan,
    economy: wg.economyOf(base),
  });
  const doc = { ...base, catalog: setting.catalog, flows: setting.flows, events: game.events };
  const readings = core.readFlows(doc.flows, doc.events, game.now);

  for (const [seat, grips] of Object.entries(SEATS)) {
    let n = 0;
    for (const { flow, step } of grips) {
      n += readings.filter(
        (r) => r.template.key === flow && r.status !== 'done' && r.next && r.next.step.key === step,
      ).length;
    }
    found[seat].push(n);
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nseat coverage across ${seeds.length} grand-muster seeds`);
console.log(`(cases sitting at the seat's commitment step — no brain, no writes)\n`);
console.log(`${pad('seat', 20)} ${pad('seeds with work', 16)} ${pad('min', 5)} ${pad('max', 5)} per-seed`);
let dead = 0;
for (const [seat, counts] of Object.entries(found)) {
  const withWork = counts.filter((n) => n > 0).length;
  const flag = withWork === 0 ? '  ← NEVER finds work' : withWork < seeds.length / 2 ? '  ← fragile' : '';
  if (withWork === 0) dead++;
  console.log(
    `${pad(seat, 20)} ${pad(`${withWork}/${seeds.length}`, 16)} ${pad(Math.min(...counts), 5)} ` +
      `${pad(Math.max(...counts), 5)} ${counts.join(' ')}${flag}`,
  );
}

// The seed that exercises the most seats — what a smoke test should use.
const best = seeds
  .map((seed, i) => ({ seed, seats: Object.values(found).filter((c) => c[i] > 0).length }))
  .sort((a, b) => b.seats - a.seats)[0];
console.log(`\nbest seed: "${best.seed}" exercises ${best.seats}/${Object.keys(SEATS).length} reasoning seats`);
if (dead) console.log(`${dead} seat(s) find work on NO seed — a grip no dealt world ever presents.`);
