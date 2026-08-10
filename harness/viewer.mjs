// THE VIEWER — a standalone runner. One work order in, watch the agent
// reason, see exactly where it stops. No React, no board: this is the rig
// (`harness/agents/rig.mjs`) driven from the terminal against a fixture
// (`harness/agents/fixtures.mjs`), so a single named agent can be judged on
// real-shaped work without a live War Game, a browser, or a chronicle on
// disk — the whole point of separating construction from deployment.
//
//   usage: ./harness/run.sh viewer.mjs [Mace|Milo|Mira|Lena|Rhys|Tess|Nell|Bea|all]
//
// Every run uses `memoryBacking()` — nothing here ever touches
// data/chronicle.json, so nothing here ever needs `git checkout --` after.
// With MOONSHOT_API_KEY set it drives the agent's real brain (Tier 1, per
// brain-doctrine.mjs); without one it still runs — every named agent falls
// back to a deterministic Tier-0 path (its manifest's own guarantee: "a
// fallback for every clerk", the doctrine's own rule) — and the trace says
// which happened.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ROSTER, agentNamed } from './agents/roster.mjs';
import { buildAgent, memoryBacking, run, judgmentKnown, beltShortfall, NEEDS_LOADED_BOOK } from './agents/rig.mjs';
import { rawIntakeFixture, vendorCommitmentFixture, settlementFixture, atStepFixture } from './agents/fixtures.mjs';
import { brainFor } from './brain-doctrine.mjs';
import { makeComplete } from './moonshot.mjs';
import { runGuardedModelWork } from './run-guard.mjs';

const CORE = resolve(process.cwd(), 'dist-operator/operator-core.mjs');
const core = await import(pathToFileURL(CORE).href).catch((err) => {
  console.error('Could not import the operator core. Build it first:\n  npm run build:operator\n', err.message);
  process.exit(1);
});

const NOW = '2026-08-07T09:00:00.000Z';

/** The demo's own fixture key for each named agent — the M family, the one
 *  clerk chain the task in front of this session named. Growing the viewer to
 *  another named agent means adding a line here plus a builder in
 *  fixtures.mjs — the same one-line-per-seat shape brain-doctrine.mjs and
 *  rig.mjs's JUDGMENT_FACTORIES already use. */
const DEMO_FIXTURE = {
  Mace: () => rawIntakeFixture({ now: NOW }),
  Milo: (c) => vendorCommitmentFixture(c, { now: NOW }),
  Mira: (c) => settlementFixture(c, { now: NOW }),
  // The five reachable past the M family. Each parks a case at the exact step
  // its clerk's own COMMITMENTS map names, walked there through the real
  // engine — see `atStepFixture`. The flow/step pairs were verified against
  // `fixtures/founding-book.json` (holder included, not just the step key).
  Lena: (c) => atStepFixture(c, { flowKey: 'lease-renewal', stepKey: 'price', subject: '14 Cobble Row — lease expires in 90 days', now: NOW }),
  Rhys: (c) => atStepFixture(c, { flowKey: 'violation-notice', stepKey: 'classify', subject: '9 Mill Lane — noise complaint from the neighbour', now: NOW }),
  Tess: (c) => atStepFixture(c, { flowKey: 'move-out-relay', stepKey: 'turn-scope', subject: '2 Anvil Court — tenant surrendered the keys', now: NOW }),
  Nell: (c) => atStepFixture(c, { flowKey: 'owner-onboarding', stepKey: 'intake', subject: 'a four-door book offered to the Crown', now: NOW }),
  Bea: (c) => atStepFixture(c, { flowKey: 'move-out-relay', stepKey: 'deposit-accounting', subject: '7 Tanner Way — deposit to reconcile', now: NOW }),
};

function rule(label) {
  console.log(`\n${'─'.repeat(78)}\n${label}\n${'─'.repeat(78)}`);
}

/** Print the agent's manifest card — the four axes, exactly as roster.mjs
 *  declares them, so what the viewer runs is legibly the same thing the
 *  roster names. */
function printCard(agent) {
  console.log(`${agent.name} — ${agent.seat}/${agent.task}`);
  console.log(`  judgment  ${agent.judgment}`);
  console.log(`  belt      [${agent.belt.join(', ')}]`);
  console.log(`  refuses   [${agent.refuses.join(', ')}]`);
  const policy = brainFor(agent.seat, agent.task);
  console.log(`  brain     tier ${policy.tier}${policy.model ? ` · ${policy.model}` : ' · (tool, no model)'}`);
}

async function runOne(name) {
  const spec = agentNamed(name);
  if (!spec) {
    console.error(`No such agent: "${name}". The roster is: ${ROSTER.map((a) => a.name).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const agent = buildAgent(spec); // construction — no backing, no I/O yet
  rule(`${agent.name} — constructed, no backing attached`);
  printCard(agent);

  if (!judgmentKnown(agent)) {
    const grammar = NEEDS_LOADED_BOOK[`${agent.seat}/${agent.task}`];
    if (grammar) {
      console.log(`\n  CANNOT BE DRIVEN HERE — ${agent.name} grips ${grammar}, which is not in the`);
      console.log('  founding book this repo ships. It needs a loaded grand-muster library to have');
      console.log('  anything to work on. That is an absent BOOK, not a missing wire.');
    } else {
      console.log(`\n  (this rig has no judgment wired for ${agent.seat}/${agent.task} yet — see rig.mjs)`);
    }
    return;
  }
  const short = beltShortfall(agent);
  if (short.length) {
    console.log(`\n  BELT REFUSAL — ${agent.name}'s belt is missing [${short.join(', ')}] for this judgment.`);
    return;
  }

  const build = DEMO_FIXTURE[agent.name];
  if (!build) {
    console.log(`\n  (no fixture wired for ${agent.name} in this viewer)`);
    return;
  }
  const doc = build(core);
  const backing = memoryBacking(doc);
  rule(`${agent.name} — deployed against ${backing.describe()}`);
  const caseId = doc.caseId ?? doc.events[0]?.caseId;
  console.log(`  work order: ${caseId}`);

  const guarded = await runGuardedModelWork(makeComplete, (complete) =>
    run(agent, backing, { core, complete, brainFor, now: NOW }),
  );

  if (guarded.status === 'blocked') {
    console.log('\n  BLOCKED — the model context refused (an identity-shaped token reached the brain);');
    console.log('  the whole run was discarded and nothing was appended. This is the run-guard,');
    console.log('  not the agent — see run-guard.mjs / contextGuard.ts.');
    return;
  }

  const { events, records } = guarded.result;
  rule(`${agent.name} — reasoning trace`);
  if (records.length) records.forEach((r) => console.log(`  ${r}`));
  else console.log('  (no work found on this fixture)');

  rule(`${agent.name} — where it stops`);
  if (!events.length) {
    console.log('  Nothing was appended.');
    return;
  }
  const last = events[events.length - 1];
  console.log(`  wrote ${events.length} event(s); the last:`);
  console.log(`    kind:  ${last.kind}`);
  console.log(`    actor: ${last.actor ?? '(none)'}`);
  console.log(`    note:  ${last.note ?? '(none)'}`);
  if (last.kind === 'proposed') {
    console.log(`\n  ${agent.name} STOPS HERE — parked "awaiting" the King's word.`);
    // Precisely what holds, and precisely what does not. An earlier draft said
    // "her belt has no tool that could cross this", offering the `refuses`
    // list as the reason. That was FALSE twice over: `refuses` is a
    // declaration nothing reads at runtime, and `open:cascade` grants
    // `completeStep`, which was proved to walk a case straight past this
    // commitment. Saying so here rather than in a comment nobody runs.
    console.log('  What holds: no agent can RATIFY. `approveStep`/`overrideStep` are absent from');
    console.log('  every belt by construction, so the approved/overridden mark is the King\'s alone.');
    console.log('  What does NOT hold: an agent granted `open:cascade` can still ADVANCE a cascade');
    console.log('  (`completeStep` bounds-checks only). Every `done` it writes is stamped');
    console.log(`  actor: agent:${agent.seat}, so its advances are legible — not prevented.`);
  } else {
    console.log(`\n  ${agent.name} did not stop at a judgment on this fixture — see the trace above.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const names = !args.length || args[0] === 'all' ? Object.keys(DEMO_FIXTURE) : args;
  for (const name of names) await runOne(name);
  rule('done');
  console.log('Nothing here touched data/chronicle.json — memoryBacking() never does.');
}

await main();
