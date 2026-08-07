// The operator agent — swing four, "prove ONE agent" (WRIT-TASK-LANGUAGE).
//
// Mabel's intake clerk, run alone: it reads the log, finds the most-aged
// untriaged raw-intake maintenance ticket, identifies the complaint down the
// catalog tree to a leaf (a cheap Kimi, Tier 1; a heuristic fallback, Tier 0),
// triggers the vendor-dispatch cascade through the REAL flow engine, advances
// the report + identify steps, and STOPS at the first commitment — a `proposed`
// by `agent:mabel`, `awaiting` the Regent. Human-in-the-loop always.
//
// The clerk itself now lives in `clerks.mjs` (shared with the fleet — see
// `fleet.mjs`); this entry just runs that one clerk, so swing four and the fleet
// can never drift. Gate-safe (wg/<seed> data only) and events-only.
//
//   usage: ./harness/run.sh operate.mjs [count]     (count defaults to 1)

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fileBacking, BackingRefusal } from './agents/rig.mjs';
import { makeComplete } from './moonshot.mjs';
import { brainFor } from './brain-doctrine.mjs';
import { makeIntakeClerk } from './clerks.mjs';
import { runGuardedModelWork } from './run-guard.mjs';

const CORE = resolve(process.cwd(), 'dist-operator/operator-core.mjs');
const core = await import(pathToFileURL(CORE).href).catch((err) => {
  console.error('Could not import the operator core. Build it first:\n  npm run build:operator\n', err.message);
  process.exit(1);
});

async function main() {
  const count = Math.max(1, Number(process.argv[2]) || 1);
  // Through the rig's file backing — one guard, one message, one place.
  const backing = fileBacking();
  let doc;
  try {
    doc = backing.readLog();
  } catch (err) {
    if (err instanceof BackingRefusal) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  const now = doc.wargame.now;
  let clerk;
  const guardedRun = await runGuardedModelWork(makeComplete, async (complete) => {
    clerk = makeIntakeClerk({ core, complete, brainFor });
    return clerk.run({ doc, now, taken: new Set(), cap: count });
  });
  if (guardedRun.status === 'blocked') {
    console.error('Model context refused; the operator run was discarded and no event was appended.');
    return;
  }
  const tier = clerk.policy.tier === 0 ? 'Tier 0 · tool' : `Tier ${clerk.policy.tier} · ${clerk.policy.model}`;
  console.log(`Operator: ${clerk.label} (${tier}, fallback ${clerk.policy.fallback}) · game ${doc.wargame.seed} @ ${now}\n`);

  const { events, records } = guardedRun.result;
  if (!records.length) {
    console.log('No aging raw-intake tickets to work. Nothing to do.');
    return;
  }
  for (const r of records) console.log(`  ✓ ${r}`);
  const total = backing.appendEvents(events);
  console.log(`\nAppended ${events.length} event(s); the log now holds ${total}.`);
  console.log('Open the Ledger/Seat: the WO reads identified and advanced, a proposal by "Mabel\'s clerk"');
  console.log("sits awaiting — the Regent approves and the cascade moves, or overrides and it holds.");
}

await main();
