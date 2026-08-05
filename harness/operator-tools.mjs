// The operator's two-tool belt (swing four, WRIT-TASK-LANGUAGE "prove one
// agent"). Deliberately NOT the K3 builder's file/shell belt (tools.mjs): an
// operator agent reads the event log and appends events, nothing more. In dev
// it operates directly on `data/chronicle.json` — the same file the vite plugin
// serves to the app, so the agent's work shows live (read whole doc → append
// events → write whole doc; whole-document last-writer-wins, so run it while no
// app tab is actively writing). Every appended event is `wg/<seed>`-marked (its
// caseId carries the war-mark), so Reset strikes it — the agent touches only the
// simulated world, no data gate needed.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHRONICLE = resolve(process.cwd(), 'data/chronicle.json');

/** readLog — the whole chronicle document, parsed. The agent reads its work off
 *  `doc.events` (the log), against `doc.catalog` / `doc.flows` (the loaded
 *  task-language and grammars) and `doc.wargame` (the simulated clock). */
export function readLog() {
  const doc = JSON.parse(readFileSync(CHRONICLE, 'utf8'));
  doc.events ??= [];
  return doc;
}

/** appendEvents — append the agent's batch to the log and write the whole doc
 *  back. Append-only: nothing else in the document is touched, so the app's
 *  other books (marches, treasury, census…) ride through untouched. Returns the
 *  new event count. */
export function appendEvents(events) {
  if (!Array.isArray(events) || !events.length) return null;
  const doc = readLog();
  doc.events = [...doc.events, ...events];
  writeFileSync(CHRONICLE, JSON.stringify(doc, null, 2) + '\n');
  return doc.events.length;
}
