// The clerk fleet — an agent on every seat (WRIT-TASK-LANGUAGE, "the full clerk
// fleet"; swing four proved ONE). The fleet is a ROSTER of clerks, each defined
// by a seat + task-type + a brain policy (from the clerk-brain doctrine), run in
// turn over the same simulated War Game. Every clerk does its bounded work
// through the REAL flow engine and STOPS at a judgment — a `proposed` by
// `agent:<seat>`, `awaiting` the Regent. Human-in-the-loop always; no clerk
// self-approves.
//
// It reuses swing four's machinery unchanged: the operator core (the bundled
// engine), the two-tool belt (read the log / append events), and the
// brain-doctrine seam. Mabel's intake clerk is a Tier-1 (cheap brain) member;
// the per-seat advance clerks are Tier-0 (a tool, no brain) — the doctrine made
// real, the cheapest engine that clears each seat's bar.
//
//   usage: ./harness/run.sh fleet.mjs        (deploy a War Game / grand muster first)

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fileBacking, BackingRefusal } from './agents/rig.mjs';
import { makeComplete } from './moonshot.mjs';
import { brainFor } from './brain-doctrine.mjs';
import { runFleet } from './run-fleet.mjs';
import { makeMeter } from './meter.mjs';
import { runGuardedModelWork } from './run-guard.mjs';

const CORE = resolve(process.cwd(), 'dist-operator/operator-core.mjs');
const core = await import(pathToFileURL(CORE).href).catch((err) => {
  console.error('Could not import the operator core. Build it first:\n  npm run build:operator\n', err.message);
  process.exit(1);
});

async function main() {
  // The chronicle now arrives through the RIG's file backing rather than a
  // direct read, so the "is a game standing" refusal lives in ONE place
  // (`fileBacking`) instead of being restated by every caller — this file and
  // `operate.mjs` carried two copies of the same guard, which is two chances
  // for them to drift apart. Behaviour at this door is unchanged: the same
  // message, the same non-zero exit.
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

  // The roster + the loop now live in run-fleet.mjs (shared with the Worker's
  // POST /api/fleet route). Here we do the harness's own I/O around it: read the
  // log, run the fleet, append the batch.
  // A clerk may catch IdentityLeakError and use its deterministic fallback.
  // Keep the refusal as run-local poison so those plausible fallback events
  // can never be appended.
  let meter;
  const guardedRun = await runGuardedModelWork(makeComplete, async (complete) => {
    meter = makeMeter(complete);
    return runFleet({
      doc, now, core, complete: meter.complete, brainFor, meter,
    });
  });
  if (guardedRun.status === 'blocked') {
    console.error('Model context refused; the entire fleet run was discarded and no event was appended.');
    return;
  }
  const { events, perClerk, proposals } = guardedRun.result;

  console.log(`The clerk fleet · game ${doc.wargame.seed} @ ${now} · ${perClerk.length} clerks\n`);
  for (const c of perClerk) {
    const tier = c.tier === 0 ? 'Tier 0 · tool' : `Tier ${c.tier} · ${c.model}`;
    console.log(`${c.label} (${tier})`);
    if (c.records.length) for (const r of c.records) console.log(`  ✓ ${r}`);
    else console.log('  · no work on this seat right now.');
    console.log('');
  }

  if (!events.length) {
    console.log('The fleet found nothing to do. (Deploy a fresh muster, or the work is already proposed.)');
    return;
  }
  const total = backing.appendEvents(events);
  console.log(`Appended ${events.length} event(s) — ${proposals} proposal(s) parked; the log now holds ${total}.`);
  console.log('Open the Ledger/Seat: each proposal reads by its clerk, awaiting the Regent\'s Approve/Override.');
  meter.report(proposals);
}

await main();
