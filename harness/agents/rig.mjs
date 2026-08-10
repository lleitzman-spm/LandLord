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
// CAPABILITY BY CONSTRUCTION, AND EXACTLY WHAT IT COVERS. `deploy()` never
// hands ANY agent `approveStep` or `overrideStep` — those names are simply
// absent from the vocabulary this file knows, on every tag, so no belt can
// spell the ratchet into existence. That is the same defence the money door
// already stands on (`roster.mjs`), now applied to ratification too.
//
// WHAT THE BELT DOES NOT COVER, stated here because an unstated boundary is
// how a gate becomes decoration (`docs/WRIT-THE-GATE.md`, finding 2 — "a gate
// that is read reads as protection"). Two limits, both measured, neither
// glossed:
//
//   1. THE BELT SCOPES THE DOMAIN CORE ONLY. `harness/clerks.mjs:21-23`
//      reaches `vendors.mjs`, `leasing.mjs` and `safe-evidence.mjs` by STATIC
//      IMPORT, entirely around `ctx.core`. Verified 2026-08-07 that all three
//      are pure reference/compute — no file write, no event, no network, no
//      money function — so the bypass widens what an agent may READ, never
//      what it may DO. Every writer and every money reading lives in the
//      domain core and IS scoped. A capability added to those modules later
//      would be ungoverned by construction; that is the standing hazard.
//
//   2. AN AGENT CAN STILL ADVANCE A CASCADE. `open:cascade` grants
//      `completeStep`, and it must — Mace legitimately completes `report` and
//      `identify`, and the audited auto-sweep completes the steps the book
//      declares need no person. `completeStep` bounds-checks and nothing else
//      (`src/domain/flows.ts:961`), so a granted agent CAN walk a case past a
//      commitment step. It cannot RATIFY one (no `approved`/`overridden`
//      exists to emit), which is the guarantee that actually holds — but "it
//      cannot cross" was claimed here in an earlier draft of this file and was
//      FALSE, proved by driving Mace's own scoped core past `assign-vendor`.
//
//      What this rig does about it: every `done` an agent writes through its
//      granted `completeStep` is STAMPED `actor: 'agent:<seat>'` (see
//      `scopedCore`). That is the standing HIGH finding #2 in
//      `docs/HANDOFF.md` — "an agent-completed step is indistinguishable from
//      a human's" — closed for rig-deployed agents. It does not stop the
//      advance; it makes the advance legible, which is WRIT-THE-GATE's
//      property 2 (a different record) rather than its property 1 (a refusal
//      at the writer). The refusal at the writer belongs in `flows.ts` and is
//      not this file's to invent.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeIntakeClerk, makeVendorClerk, makePriceClerk, makeLeasingClerk } from '../clerks.mjs';
import { makeResidentClerk } from '../res-desk.mjs';
import { makeTurnoverClerk } from '../turn-desk.mjs';
import { makeBdrClerk } from '../bd-desk.mjs';
import { makeAccountingClerk } from '../acct-desk.mjs';
import { guardComplete, isIdentityGuarded } from '../../src/domain/contextGuard.mjs';

// ── A refusal is a distinct thing from a bug ────────────────────────────────
export class BackingRefusal extends Error {}

/** A belt that cannot carry the judgment it was asked to hold. Named rather
 *  than left as the `TypeError: core.<something> is not a function` the first
 *  version produced: that failed CLOSED (nothing was appended, verified) but
 *  said nothing about capability, so the reader had to work backwards from a
 *  domain function to the missing tag. `docs/WRIT-THE-GATE.md` property 2 —
 *  a refusal leaves a different record — applied to the belt. */
export class BeltRefusal extends Error {}

/** A judgment this repository cannot honestly exercise, because the flow book
 *  it grips is not one this repo ships. Distinct from "not wired yet": there
 *  is nothing to wire until a book carrying that grammar is loaded. */
export class NoSuchGrammar extends Error {}

// ── fileBacking — the live simulator ────────────────────────────────────────

/** fileBacking — data/chronicle.json on disk, the same file the vite plugin
 *  serves to the running app (operator-tools.mjs's own shape). Refuses to
 *  read without a standing War Game: the fleet's whole safety posture rests
 *  on this one check, so it belongs on the ONE backing that can reach real
 *  disk state, not scattered through every caller that used to guard it
 *  itself. */
export function fileBacking(path = resolve(process.cwd(), 'data/chronicle.json')) {
  const REFUSAL =
    'No standing War Game. Deploy one first (the footer "Deploy the grand muster" / ' +
    '"Deploy a game") — the file backing works only on simulated wg/<seed> data ' +
    '(docs/WRIT-THE-GATE.md: no real data reaches the fleet until a runtime refusal exists).';
  /** Read the document and refuse it if no game stands. BOTH doors go through
   *  here — an earlier draft guarded only `readLog`, which left
   *  `appendEvents` able to write to a seedless chronicle on real disk if it
   *  were ever called on its own. The write is the door that matters more. */
  const readGuarded = () => {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    doc.events ??= [];
    if (!doc.wargame?.seed) throw new BackingRefusal(REFUSAL);
    return doc;
  };
  return {
    kind: 'file',
    describe: () => `disk chronicle (${path})`,
    readLog: readGuarded,
    appendEvents(events) {
      if (!Array.isArray(events) || !events.length) return null;
      const doc = readGuarded();
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
    /** Cloned on the way OUT as well as in. The constructor already cloned the
     *  seed doc, but handing back the internal object left isolation one-way:
     *  a clerk that mutated a returned event mutated the backing. */
    readLog() {
      return structuredClone(doc);
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

// DEEP-frozen, not shallow. `Object.freeze` on the table alone leaves every
// array inside it mutable, and this table IS the enforcement — so a shallow
// freeze means any module importing this file could `.push('approveStep')`
// onto a tag and widen every belt in the process. Measured on the first
// draft of this file, which froze the object and not its arrays.
for (const names of Object.values(CAPABILITY_CORE_FNS)) Object.freeze(names);

/** Belt tags that are DECLARATIVE — they describe what an agent reads, and
 *  grant no core function, because the thing they name is reached by static
 *  import in `harness/clerks.mjs` rather than through `ctx.core`.
 *
 *  `read:trade-roster` is the only one. It is kept on Milo's and Tess's
 *  manifests because it is TRUE (they do read the trade roster) and listed
 *  here because it is NOT ENFORCED — an earlier draft of this file bound
 *  vendor functions onto the scoped core for it, and nothing ever read them:
 *  `clerks.mjs:21` imports `rosterFor`/`rosterTrade`/`invoiceFor` directly
 *  and calls them at `:463`, `:466`, `:674`. Stripping the tag from a belt
 *  was measured to change nothing about what the agent could reach. That
 *  grant is deleted rather than left looking like protection; the tag stays,
 *  declared honestly as description. A test pins this both ways. */
export const DECLARATIVE_TAGS = Object.freeze(['read:trade-roster']);

/** Every tag any belt may carry — enforced tags plus declared-inert ones. A
 *  tag outside this set is a typo, and `deploy` refuses it rather than
 *  silently granting nothing and surfacing later as a TypeError deep in a
 *  clerk's run. */
export const KNOWN_TAGS = Object.freeze([...Object.keys(CAPABILITY_CORE_FNS), ...DECLARATIVE_TAGS]);

/** Stamp an agent's own answer with its seat, so an agent-written `done` is
 *  never mistaken for the operator's. `completeStep` returns `[done, next
 *  hand]`; only the `done` is an ACT by anyone — the hand is the cascade
 *  moving — so only the `done` is stamped. `answerStep` sets no actor and its
 *  opts carry no field for one (`src/domain/flows.ts:961`), which is why this
 *  is done here on the way out rather than passed in. */
function stampActor(events, seat) {
  for (const e of events) if (e.kind === 'done' && e.actor == null) e.actor = `agent:${seat}`;
  return events;
}

function scopedCore(core, belt, seat) {
  const granted = new Set(belt);
  const out = {};
  for (const [tag, names] of Object.entries(CAPABILITY_CORE_FNS)) {
    if (!granted.has(tag)) continue;
    for (const name of names) {
      if (!(name in core)) continue;
      out[name] =
        name === 'completeStep'
          ? (...args) => stampActor(core.completeStep(...args), seat)
          : core[name];
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
export function deploy(agent, backing, { core, complete, brainFor, onBlocked } = {}) {
  if (!backing || typeof backing.readLog !== 'function' || typeof backing.appendEvents !== 'function') {
    throw new Error(`deploy(${agent.name}): backing must implement readLog()/appendEvents()`);
  }
  if (!core) throw new Error(`deploy(${agent.name}): no core engine supplied`);
  // A tag nothing knows is a typo, and a typo that silently grants nothing
  // reappears as `undefined is not a function` halfway through a run. Refuse
  // it here, where the name is still in front of the reader.
  for (const tag of agent.belt) {
    if (!KNOWN_TAGS.includes(tag)) {
      throw new Error(`deploy(${agent.name}): unknown belt tag "${tag}" — known tags: ${KNOWN_TAGS.join(', ')}`);
    }
  }
  const bound = scopedCore(core, agent.belt, agent.seat);
  // EVERY agent's manifest refuses `reach-identity`, and that was a declaration
  // nothing enforced for a direct caller: the viewer and `fleet.mjs` each wrap
  // their own transport, but `deploy` took whatever it was handed. It belongs
  // here, beside the belt — both answer "what may this agent touch".
  //
  // Wrapping ONLY what is unguarded is deliberate, not an optimisation. An
  // unconditional wrap would catch the first leak in the OUTER guard and throw
  // before the inner one ran, so a caller's `onBlocked` — the poison flag that
  // makes `runGuardedModelWork` discard an entire run rather than keep its
  // plausible fallback events — would never fire. Defence added carelessly
  // would have removed a defence.
  const guardedComplete =
    complete && !isIdentityGuarded(complete) ? guardComplete(complete, { onBlocked }) : complete;
  return {
    agent,
    backing,
    ctx: {
      core: Object.freeze(bound),
      complete: guardedComplete,
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
// Each entry declares the tags its clerk actually needs, so a belt too narrow
// to hold the judgment is refused BEFORE the run rather than discovered as a
// TypeError partway through it. The declaration is not taken on trust:
// `test/rig.test.ts` scans each clerk module's real `core.<fn>` references and
// fails if `requires` drifts from the bytes.
const JUDGMENT_FACTORIES = {
  'mabel/identify': { make: makeIntakeClerk, requires: ['read:work', 'read:catalog', 'open:cascade', 'read:economy', 'propose'] },
  'va-desk/assign-vendor': { make: makeVendorClerk, requires: ['read:work', 'read:economy', 'propose'] },
  'lp-queue/approve-pay': { make: makePriceClerk, requires: ['read:work', 'read:economy', 'propose'] },
  'osric/price-lease': { make: makeLeasingClerk, requires: ['read:work', 'read:economy', 'propose'] },
  'res-desk/triage': { make: makeResidentClerk, requires: ['read:work', 'read:economy', 'propose'] },
  'turn-desk/scope': { make: makeTurnoverClerk, requires: ['read:work', 'read:economy', 'propose'] },
  'bd-desk/qualify': { make: makeBdrClerk, requires: ['read:economy', 'propose'] },
  'acct-desk/reconcile': { make: makeAccountingClerk, requires: ['read:economy', 'propose'] },
};

/** The judgments that exist as clerks but grip a grammar this repository does
 *  not ship. Verified against `agents/fixtures/founding-book.json` — every
 *  commitment these two declare lives in the ~160-step grand-muster library,
 *  which is loaded at deploy time and is not in this tree. They are listed
 *  rather than omitted so the refusal can say WHY, and so nobody reads their
 *  absence from the registry above as an oversight. */
export const NEEDS_LOADED_BOOK = Object.freeze({
  'viol-desk/classify': 'lease-violation/verify',
  'col-desk/assess': 'collections-ladder/assess-late',
});

/** judgmentKnown — whether the rig can run this agent's judgment today (so a
 *  caller can ask before it asks, rather than catching the throw). */
export function judgmentKnown(agent) {
  return `${agent.seat}/${agent.task}` in JUDGMENT_FACTORIES;
}

/** The tags an agent's belt is missing for its own judgment, or `[]`. Exposed
 *  so a caller (the viewer, a test, a future fleet) can ask without running. */
export function beltShortfall(agent) {
  const entry = JUDGMENT_FACTORIES[`${agent.seat}/${agent.task}`];
  if (!entry) return [];
  return entry.requires.filter((tag) => !agent.belt.includes(tag));
}

/** run — deploy an agent against a backing and let it do its one bounded
 *  pass: read the log, reason (or fall back), and STOP at a judgment. No
 *  agent this rig can construct is ever handed a way to cross that stop —
 *  see `CAPABILITY_CORE_FNS` above. Returns the clerk's own `{ events,
 *  records }`; any produced events are appended through the backing (so a
 *  memory-backed run never touches disk, and a file-backed one behaves
 *  exactly as `fleet.mjs` already does for this one seat). */
export async function run(agent, backing, { core, complete, brainFor, now, cap, taken, onBlocked } = {}) {
  const key = `${agent.seat}/${agent.task}`;
  const entry = JUDGMENT_FACTORIES[key];
  if (!entry) {
    const grammar = NEEDS_LOADED_BOOK[key];
    if (grammar) {
      throw new NoSuchGrammar(
        `run(${agent.name}): ${key} grips ${grammar}, which is not in the founding book this repo ships. ` +
          'It needs a loaded grand-muster library to have anything to work on — this is not a missing wire.',
      );
    }
    throw new Error(`run(${agent.name}): no judgment wired for ${key} yet — see JUDGMENT_FACTORIES`);
  }
  const missing = beltShortfall(agent);
  if (missing.length) {
    throw new BeltRefusal(
      `run(${agent.name}): belt cannot hold ${key} — missing [${missing.join(', ')}]. ` +
        `Declared belt: [${agent.belt.join(', ')}].`,
    );
  }
  const { ctx } = deploy(agent, backing, { core, complete, brainFor, onBlocked });
  const doc = backing.readLog();
  // The clock is never invented. A memory backing carries no `wargame`, so an
  // earlier draft's `?? new Date(0)` fallback silently ran every such agent at
  // 1970 — which reads as an aging of twenty thousand days, not as an error.
  const at = now ?? doc.wargame?.now;
  if (!at) {
    throw new Error(
      `run(${agent.name}): no clock — pass \`now\`, or use a backing whose document carries \`wargame.now\`. ` +
        'Aging is measured against this instant; defaulting it would silently date every reading.',
    );
  }
  const clerk = entry.make(ctx);
  const out = await clerk.run({
    doc,
    now: at,
    taken: taken ?? new Set(),
    ...(cap != null ? { cap } : {}),
  });
  if (out.events.length) backing.appendEvents(out.events);
  return out;
}
