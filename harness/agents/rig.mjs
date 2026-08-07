// THE RIG — one tool interface, two backings, and CONSTRUCTION kept separate
// from DEPLOYMENT (WRIT-THE-KNIGHTHOOD's own image: agents are built like game
// assets). `buildAgent()` turns a roster entry into a plain descriptor and
// touches nothing — no file, no shell, no war-game seed. Only `deploy()` binds
// a BACKING and hands the agent a BELT scoped to exactly the capability tags
// its manifest declares, never the whole engine.
//
// THE WELD THIS CUTS. Before this file, an agent could not exist without a
// live `data/chronicle.json` on disk carrying a standing War Game — construct
// and run were one act (`harness/fleet.mjs` read the file directly and
// `process.exit(1)`'d with no `doc.wargame.seed`). That made it impossible to
// hand an agent a single work order in isolation — for a fixture, a test, or
// the viewer — without first standing up the whole simulator. The fix is not
// to remove the safety check (WRIT-THE-GATE's standing rule — "no real data
// reaches the fleet until a runtime refusal exists" — still governs the LIVE
// simulator, and still must). It is to make it a property of the backing that
// touches real disk state, not a precondition of an agent existing at all.
//
// TWO BACKINGS SHIP HERE, both satisfying the same tiny interface
// (`readLog()` / `appendEvents(events)` — the shape `operator-tools.mjs`
// already settled on):
//
//   · fileBacking()   — data/chronicle.json on disk, the live simulator.
//                        Refuses to open a document with no War Game seed —
//                        the same guard `fleet.mjs` used to hard-exit on,
//                        now owned by the one backing that can reach it.
//   · memoryBacking() — an in-process document. No disk, ever; no war-game
//                        requirement, because it never risks the live
//                        simulator. For fixtures, the viewer, and tests.
//
// A third backing — a live graph ("the operating records ... live
// elsewhere", KINGDOM.md) — is future and stays behind the data gate
// (`docs/WRIT-THE-GATE.md`). This module is the seam such a backing would
// implement; it is not itself that backing, and nothing here pretends
// otherwise.
//
// CAPABILITY BY CONSTRUCTION. `deploy()` never hands ANY agent `approveStep`
// or `overrideStep` — those names are simply absent from the vocabulary this
// file knows, on every tag, so no belt can ever spell the ratchet into
// existence. That is the same defence the money door already stands on
// (`roster.mjs`: "the operator's belt has no money door, so no clerk can
// reach one"), now applied to ratification too.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeIntakeClerk, makeVendorClerk, makePriceClerk } from '../clerks.mjs';

// ── A backing's refusal is a distinct thing from a bug ──────────────────────
export class BackingRefusal extends Error {}

// ── fileBacking — the live simulator ────────────────────────────────────────

/** fileBacking — data/chronicle.json on disk, the same file the vite plugin
 *  serves to the running app (operator-tools.mjs's own shape). Refuses to
 *  read without a standing War Game: the fleet's whole safety posture rests
 *  on this one check, so it belongs on the ONE backing that can reach real
 *  disk state, not scattered through every caller that used to guard it
 *  itself. */
export function fileBacking(path = resolve(process.cwd(), 'data/chronicle.json')) {
  return {
    kind: 'file',
    describe: () => `disk chronicle (${path})`,
    readLog() {
      const doc = JSON.parse(readFileSync(path, 'utf8'));
      doc.events ??= [];
      if (!doc.wargame?.seed) {
        throw new BackingRefusal(
          'No standing War Game. Deploy one first (the footer "Deploy the grand muster" / ' +
            '"Deploy a game") — the file backing works only on simulated wg/<seed> data ' +
            '(docs/WRIT-THE-GATE.md: no real data reaches the fleet until a runtime refusal exists).',
        );
      }
      return doc;
    },
    appendEvents(events) {
      if (!Array.isArray(events) || !events.length) return null;
      const doc = JSON.parse(readFileSync(path, 'utf8'));
      doc.events ??= [];
      doc.events = [...doc.events, ...events];
      writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
      return doc.events.length;
    },
  };
}

// ── memoryBacking — fixtures, the viewer, tests ─────────────────────────────

/** memoryBacking — an in-process document. Nothing here ever touches disk, so
 *  nothing here ever needs `git checkout -- data/chronicle.json` afterward,
 *  and nothing here needs a War Game seed: it cannot reach the live
 *  simulator, so the gate protecting the live simulator has nothing to guard
 *  against. `seedDoc` is a plain `{ catalog, flows, events }` shape (a
 *  fixture, typically — see `fixtures.mjs`). */
export function memoryBacking(seedDoc) {
  let doc = { events: [], catalog: [], flows: [], ...structuredClone(seedDoc ?? {}) };
  return {
    kind: 'memory',
    describe: () => `in-memory fixture (${doc.events.length} event(s))`,
    readLog() {
      return doc;
    },
    appendEvents(events) {
      if (!Array.isArray(events) || !events.length) return null;
      doc = { ...doc, events: [...doc.events, ...events] };
      return doc.events.length;
    },
  };
}

// ── Construction: a plain descriptor, no I/O ────────────────────────────────

const REQUIRED_FIELDS = ['name', 'seat', 'task', 'judgment', 'belt', 'refuses'];

/** buildAgent — a roster entry (`harness/agents/roster.mjs`) becomes a frozen
 *  agent descriptor. Deliberately does nothing else: no file read, no network
 *  call, no backing bound. An agent built here could sit in a catalog forever
 *  and touch nothing — construction and deployment are separate acts. */
export function buildAgent(spec) {
  for (const f of REQUIRED_FIELDS) {
    if (spec?.[f] == null) throw new Error(`buildAgent: missing "${f}" on ${spec?.name ?? '(unnamed)'}`);
  }
  if (!spec.refuses.includes('ratify')) {
    throw new Error(`buildAgent(${spec.name}): every agent must refuse to ratify`);
  }
  return Object.freeze({
    ...spec,
    belt: Object.freeze([...spec.belt]),
    refuses: Object.freeze([...spec.refuses]),
  });
}

// ── The belt: capability tag → the core functions it grants ────────────────
//
// This table is the whole enforcement. It never lists `approveStep`,
// `overrideStep`, `settlementMoney`, or `vendorSettlementMoney` — on ANY tag —
// so no combination of belt tags can ever assemble a way to ratify or move
// coin. A missing entry here is not a checked-and-denied permission; it is a
// tool that was never built.
export const CAPABILITY_CORE_FNS = Object.freeze({
  'read:work': [
    'readCases', 'readCase', 'readFlows', 'readFlow', 'ageInDays', 'queues',
    'awaitingHuman', 'paramsOf', 'fullParams',
  ],
  'read:catalog': [
    'findRow', 'rowsByDomain', 'titleOf', 'flowKeyFor', 'domainsOf', 'systemsOf', 'catalogAtFounding',
  ],
  // Opens and advances a cascade. Deliberately NOT `propose` — the two read
  // as the same verb ("move the case forward") but are different acts: this
  // is the book asserting a step is done (a human's or, past the mode
  // guard, an unattended `auto` step's), never a judgment parked for one.
  'open:cascade': ['instantiateFlow', 'completeStep', 'mayRunUnattended', 'awaitsOutside', 'flowsAtFounding'],
  'read:economy': [
    'applyEconomySetting', 'FOUNDING_ECONOMY', 'spendGate', 'spendCapFor', 'estimateSpendCents',
    'reconcileSpend', 'feeAmount', 'feeRuleFor', 'coinCents', 'needsOwnerApproval',
  ],
  // The ONLY way any event reaches the log with a judgment still open. Every
  // named agent's belt either has this or has `open:cascade`'s unattended
  // sweep — never a third road to writing a `done`/`approved` in its own name.
  propose: ['proposeStep'],
});

/** The harness-side (not core-engine) capability: the vendor roster reference
 *  data (`vendors.mjs`). Not part of the pure domain, so it is granted
 *  separately from the table above rather than folded into it. */
const TRADE_ROSTER_FNS = ['rosterFor', 'rosterTrade', 'clampFeeCents', 'invoiceFor'];

function scopedCore(core, belt) {
  const granted = new Set(belt);
  const out = {};
  for (const [tag, names] of Object.entries(CAPABILITY_CORE_FNS)) {
    if (!granted.has(tag)) continue;
    for (const name of names) {
      if (name in core) out[name] = core[name];
    }
  }
  return out;
}

/** deploy — bind an agent to a backing. Only here does a chronicle, a shell,
 *  or a war-game seed enter the picture. Returns `{ agent, backing, ctx }`
 *  where `ctx` is shaped exactly like the clerk factories already expect
 *  (`{ core, complete, brainFor }` — `harness/clerks.mjs`), so a deployed
 *  agent runs the SAME judgment code the fleet already proved. The rig
 *  changes how an agent is BUILT and WHERE it reads/writes; it does not
 *  reinvent what it decides. */
export function deploy(agent, backing, { core, complete, brainFor, vendors } = {}) {
  if (!backing || typeof backing.readLog !== 'function' || typeof backing.appendEvents !== 'function') {
    throw new Error(`deploy(${agent.name}): backing must implement readLog()/appendEvents()`);
  }
  if (!core) throw new Error(`deploy(${agent.name}): no core engine supplied`);
  const bound = scopedCore(core, agent.belt);
  if (agent.belt.includes('read:trade-roster') && vendors) {
    for (const name of TRADE_ROSTER_FNS) if (vendors[name]) bound[name] = vendors[name];
  }
  return {
    agent,
    backing,
    ctx: {
      core: Object.freeze(bound),
      complete,
      brainFor: brainFor ?? (() => ({ tier: 0, model: null, fallback: 'tool' })),
    },
  };
}

// ── The judgments this rig can actually run ─────────────────────────────────
// One factory per named agent's (seat, task) — reused unchanged from
// `harness/clerks.mjs`, the same code `fleet.mjs` drives. Growing the roster
// with a new judgment means adding a line here, exactly as `brain-doctrine.mjs`
// grows one registry line per seat (`docs/agents/roster.mjs`'s own rule:
// "you do not name a new agent, you name a new judgment").
const JUDGMENT_FACTORIES = {
  'mabel/identify': makeIntakeClerk,
  'va-desk/assign-vendor': makeVendorClerk,
  'lp-queue/approve-pay': makePriceClerk,
};

/** judgmentKnown — whether the rig can run this agent's judgment today (so a
 *  caller can ask before it asks, rather than catching the throw). */
export function judgmentKnown(agent) {
  return `${agent.seat}/${agent.task}` in JUDGMENT_FACTORIES;
}

/** run — deploy an agent against a backing and let it do its one bounded
 *  pass: read the log, reason (or fall back), and STOP at a judgment. No
 *  agent this rig can construct is ever handed a way to cross that stop —
 *  see `CAPABILITY_CORE_FNS` above. Returns the clerk's own `{ events,
 *  records }`; any produced events are appended through the backing (so a
 *  memory-backed run never touches disk, and a file-backed one behaves
 *  exactly as `fleet.mjs` already does for this one seat). */
export async function run(agent, backing, { core, complete, brainFor, vendors, now, cap, taken } = {}) {
  const key = `${agent.seat}/${agent.task}`;
  const factory = JUDGMENT_FACTORIES[key];
  if (!factory) throw new Error(`run(${agent.name}): no judgment wired for ${key} yet — see JUDGMENT_FACTORIES`);
  const { ctx } = deploy(agent, backing, { core, complete, brainFor, vendors });
  const doc = backing.readLog();
  const clerk = factory(ctx);
  const out = await clerk.run({
    doc,
    now: now ?? doc.wargame?.now ?? new Date(0).toISOString(),
    taken: taken ?? new Set(),
    ...(cap != null ? { cap } : {}),
  });
  if (out.events.length) backing.appendEvents(out.events);
  return out;
}
