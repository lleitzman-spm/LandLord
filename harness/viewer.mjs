// THE VIEWER — a standalone runner. One work order in, watch the agent
// reason, see exactly where it stops. No React, no board: this is the rig
// (`harness/agents/rig.mjs`) driven from the terminal against a fixture
// (`harness/agents/fixtures.mjs`), so a single named agent can be judged on
// real-shaped work without a live War Game, a browser, or a chronicle on
// disk — the whole point of separating construction from deployment.
//
//   usage: ./harness/run.sh viewer.mjs [Mace|Milo|Mira|all]
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
import { buildAgent, memoryBacking, run, judgmentKnown } from './agents/rig.mjs';
import { FIXTURES } from './agents/fixtures.mjs';
import { brainFor } from './brain-doctrine.mjs';
import { makeComplete } from './moonshot.mjs';
import { runGuardedModelWork } from './run-guard.mjs';
import * as vendors from './vendors.mjs';

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
const DEMO_FIXTURE = { Mace: 'mace/raw-intake', Milo: 'milo/vendor-commitment', Mira: 'mira/settlement' };

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
    console.log(`\n  (this rig has no judgment wired for ${agent.seat}/${agent.task} yet — see rig.mjs)`);
    return;
  }

  const fixtureKey = DEMO_FIXTURE[agent.name];
  const doc = FIXTURES[fixtureKey](core, { now: NOW });
  const backing = memoryBacking(doc);
  rule(`${agent.name} — deployed against ${backing.describe()}`);
  const caseId = doc.caseId ?? doc.events[0]?.caseId;
  console.log(`  work order: ${caseId}`);

  const guarded = await runGuardedModelWork(makeComplete, (complete) =>
    run(agent, backing, { core, complete, brainFor, vendors, now: NOW }),
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
    console.log(
      `  ${agent.name}'s belt has no tool that could cross this (refuses: [${agent.refuses.join(', ')}]) —`,
    );
    console.log('  the next event on this case can only be a HUMAN\'s approved/overridden.');
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
