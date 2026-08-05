/**
 * Take a firm's sensor events and open the cases they describe.
 *
 *   npm run build:wargame
 *   node tools/agent-intake.mjs <batch.json>
 *
 * The batch is an array of AgentEvent rows — the shape a firm's `agent_event`
 * table owes us (src/domain/agentIntake.ts). When that table exists this same
 * routing runs against it; the file is the seam that lets the contract be
 * exercised before either side has deployed anything.
 *
 * Routing is pure and idempotent: run it twice and the second pass opens
 * nothing. Mutates data/chronicle.json — working fluid; restore with
 * `git checkout -- data/chronicle.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { routeAgentEvents } = await import(
  pathToFileURL(resolve(root, 'dist-wargame/wargame-core.mjs')).href
);

const batchPath = process.argv[2];
if (!batchPath) {
  console.error('usage: node tools/agent-intake.mjs <batch.json>');
  process.exit(1);
}
const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
const path = resolve(root, 'data/chronicle.json');
const doc = JSON.parse(readFileSync(path, 'utf8'));

const r = routeAgentEvents(batch, { flows: doc.flows, log: doc.events, id: () => randomUUID() });

for (const o of r.opened) console.log(`  opened  ${o.flow.padEnd(22)} ${o.caseId}`);
for (const s of r.skipped) console.log(`  skip    ${s.reason.padEnd(22)} ${s.id} — ${s.detail}`);

if (r.events.length) {
  doc.events = [...doc.events, ...r.events];
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}
console.log(`\n${r.opened.length} case(s) opened, ${r.skipped.length} skipped; ${r.events.length} event(s) appended.`);
