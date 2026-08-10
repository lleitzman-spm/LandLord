// THE ROSTER — the named agents, and the four things that differ between them.
//
// WHY NAMES. A desk is not a department; it is a cluster of jobs, and the only
// honest label for a cluster of jobs done by one worker is a name. "The va-desk
// clerk" is a key. "Milo" is a hire you did not make. The market this ships into
// already learned that lesson — the leasing tools name their agents and their
// buyers remember them — and the naming is not decoration: it is what makes a
// cluster legible in four seconds to somebody who does not read our source.
//
// THE RULE: BRAINS GET THE NAMES. A name marks a JUDGMENT, never a task, a step
// or a tool. Your left hand and your right hand are not different people. The
// test is mechanical and already exists in this tree: `brain-doctrine.mjs` gives
// a seat either a model or `model: null`. A seat with a model is a brain and
// gets a name. A seat with none is a HAND — the advance clerks sweep steps the
// book already declared need no thinking, and they are limbs of whoever's desk
// they sweep. They are deliberately absent from this file.
//
// So this roster is not a second list to maintain: it is derivable from the
// brain registry, and `test/roster.test.ts` fails if the two ever disagree —
// in either direction. A name with no brain behind it is a persona over a
// lookup table, which is the failure mode of this entire product category.
//
// GROWTH RULE: you do not name a new agent, you name a new JUDGMENT. If a
// capability lands and adds no brain, it adds no name — it is a hand on an
// agent that already exists. This is what stops the roster drifting back into
// an org chart, which is the shape this project spent a long time escaping.
//
// SQUIRES SHARE THEIR KNIGHT'S LETTER. `docs/KINGDOM.md` has said since the
// founding that a squire is "pledged to a person, not a fief" and "travels with
// their knight". Sharing the initial is that relationship made visible in the
// name: see `Moss` in a log line and you know whose it is without a lookup.
// Mace, Milo and Mira are one family because they are one cluster of work —
// three distinct judgments inside the single loop from a reported fault to a
// paid invoice.
//
// THE FOUR AXES. Agents differ in more than instructions:
//   · SKILL      — the judgment, and WHERE its definition lives (see below)
//   · BELT       — what it may touch. A capability, not a checklist.
//   · ENVELOPE   — model tier, effort, and the resources a run may consume.
//   · VALIDATED  — which rig it was proven against, and therefore may run on.
//
// ON THE BELT. Permissions are the tools you are HANDED, never a list you are
// checked against. The precedent is in this tree and it is currently the only
// thing guarding the money: the operator's belt has no money door, so no clerk
// can reach one. Capability-by-construction beats a flag, because a flag can be
// read and ignored — the exact fault found in three separate places on
// 2026-08-07 (`docs/WRIT-THE-GATE.md`).
//
// ON THE ENVELOPE. It must REFUSE at its ceiling, not warn. A budget that only
// reports is finding 2 of the gate writ wearing a dollar sign: a gate that is
// read and never branches. Nothing enforces these numbers yet — they are
// declared here first, deliberately, so the enforcement has something to bind
// to rather than being invented alongside it. See `envelope.enforced`.
//
// ON `skill`. The judgment's DEFINITION is not authored here. The sibling
// project owns the normative standard — its base unit is "one bounded job with
// typed inputs, outputs, authority, verification, and correction", which is this
// manifest field for field — and this repository owns the runtime that executes
// it. So `skill` is a REFERENCE, never a restatement: the moment instructions
// are copied here, the two forks drift and neither is authoritative. Null means
// not yet bound, which is the honest current state for all ten.
//
// ON `validated`. An agent records the rig it was proven against and refuses an
// unfamiliar one. This is not caution for its own sake: on 2026-08-07 the auto
// sweep was armed against a loaded book nobody had audited and was measured
// completing a statutory deposit disposition, a late-fee assessment and a
// showing — unattended. Nothing structural distinguished those steps from the
// eight that had been read. Provenance was the only available guard.

/** Every named agent is one brain holding one judgment. Ten names, ten brains. */
export const ROSTER = [
  // ── The M family — a reported fault, from the complaint to the paid invoice ──
  {
    name: 'Mace',
    family: 'M',
    seat: 'mabel',
    task: 'identify',
    judgment: 'Read a raw complaint and walk it down the tree to the leaf that names it.',
    // TWO tags widened past the original manifest, both found by DRIVING her
    // (harness/viewer.mjs), not by reading her judgment's one-line summary:
    //   · `propose` — her run (clerks.mjs `makeIntakeClerk`) does not stop at
    //     "identified". It opens the cascade, advances report + identify, and
    //     STOPS at the first commitment with a proposal (KINGDOM.md, swing
    //     four: "It STOPS at the first commitment... emits proposed with
    //     actor agent:mabel"). `open:cascade` alone could open and advance a
    //     cascade but had no tool to leave it parked for the King.
    //   · `read:economy` — that same proposal reads the spend gate first
    //     (`spendGateFor` in clerks.mjs, so her note says "over/under the NTE
    //     cap" rather than nothing). Omitting the tag did not just make the
    //     note plainer; it threw (`core.applyEconomySetting is not a
    //     function`) the first time she was actually run through a
    //     capability-scoped belt instead of the fleet's unscoped `core`.
    belt: ['read:work', 'read:catalog', 'open:cascade', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Milo',
    family: 'M',
    seat: 'va-desk',
    task: 'assign-vendor',
    judgment: 'Choose an artisan for the trade and form a price, read against the spend cap.',
    belt: ['read:work', 'read:trade-roster', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Mira',
    family: 'M',
    seat: 'lp-queue',
    task: 'approve-pay',
    judgment: 'Reconcile the invoice against what the vendor was actually authorized to bill.',
    belt: ['read:work', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },

  // ── The R family — residents, and the breaches that concern them ────────────
  {
    name: 'Rhys',
    family: 'R',
    seat: 'res-desk',
    task: 'triage',
    judgment: 'Triage what a resident reports — what it is, how urgent, whose desk.',
    // `read:economy` is not decoration: res-desk.mjs:154 / viol-desk.mjs:157
    // read `core.coinCents` on the first line of their run. Without the tag a
    // belt-scoped deploy throws mid-run. Found by a static sufficiency scan
    // (test/rig.test.ts), not by running them — they are not yet wired.
    belt: ['read:work', 'read:catalog', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity', 'speak-outward'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Ross',
    family: 'R',
    seat: 'viol-desk',
    task: 'classify',
    judgment: 'Classify a breach and grade it against the standard that governs it.',
    // `read:economy` is not decoration: res-desk.mjs:154 / viol-desk.mjs:157
    // read `core.coinCents` on the first line of their run. Without the tag a
    // belt-scoped deploy throws mid-run. Found by a static sufficiency scan
    // (test/rig.test.ts), not by running them — they are not yet wired.
    belt: ['read:work', 'read:catalog', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity', 'speak-outward'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },

  // ── The single-judgment desks ───────────────────────────────────────────────
  {
    name: 'Tess',
    family: 'T',
    seat: 'turn-desk',
    task: 'scope',
    judgment: 'Scope a turn — what the door needs before it can be let again.',
    // `read:economy` — turn-desk.mjs:165 reads `core.coinCents`. See Rhys.
    belt: ['read:work', 'read:trade-roster', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Lena',
    family: 'L',
    seat: 'osric',
    task: 'price-lease',
    judgment: 'The rent call — hold, raise or concede on a renewal; the ask on a vacant door.',
    belt: ['read:work', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Dara',
    family: 'D',
    seat: 'col-desk',
    task: 'assess',
    judgment: 'Where a delinquency stands on the ladder, and what the next rung is.',
    belt: ['read:work', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity', 'speak-outward'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Bea',
    family: 'B',
    seat: 'acct-desk',
    task: 'reconcile',
    judgment: 'A deposit disposition, and whether the trust books reconcile behind it.',
    belt: ['read:work', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity', 'speak-outward'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
  {
    name: 'Nell',
    family: 'N',
    seat: 'bd-desk',
    task: 'qualify',
    judgment: 'Qualify an incoming owner — is this a book the Crown should keep.',
    // `read:economy` — bd-desk.mjs:142 reads `core.coinCents`. See Rhys.
    belt: ['read:work', 'read:economy', 'propose'],
    refuses: ['ratify', 'move-coin', 'reach-identity'],
    envelope: { enforced: false, realtime: false },
    skill: null,
    validated: null,
  },
];

/** The seats that are HANDS — no brain, and therefore no name. Kept here so the
 *  guard test can assert the negative: naming one of these would be a persona
 *  over a lookup table, and the roster must not grow one. */
export const HANDS = ['va-desk', 'lp-queue', 'osric', 'pm-desk'];

/** The registry key a named agent's brain policy lives under. */
export const policyKeyOf = (a) => `${a.seat}/${a.task}`;

/** An agent by name, or undefined. */
export const agentNamed = (name) => ROSTER.find((a) => a.name === name);

/** The family an agent belongs to — its knight and every squire riding with it. */
export const familyOf = (letter) => ROSTER.filter((a) => a.family === letter);
