// ⚠ THE FLOW TEMPLATES BELOW ARE DEMO DATA for the seed tenant. The ENGINE is
// the product — a flow is loaded configuration, and no code here knows the
// word "move-out". The specific steps, holders and timings encode one
// worked way of working; a deployment loads its own.
// The flow engine — the operator's spine (docs/WRIT-FLOW-ENGINE.md, swing one).
// A flow template is *config*: a trigger and a set of steps, each step naming a
// catalog row (task-type), a holder, a timing edge, and the board it belongs
// to. Instantiating a flow on a subject opens one **case** and emits every
// step as an **event** in the log we already keep — events-only, so the flow
// instance *is* the case and its state folds from the events; nothing about a
// flow's progress is stored.
//
// A factory component: the engine below knows no factory setting by name. The
// working-fluid FOUNDING_FLOWS below holds one relay — a move-out → re-list
// cascade — purely as config, as proof of the line: no branch of code knows
// the word "move-out"; the template says it all. a firm's real relay loads through
// the same `flows.load` gate as the catalog's rows when the data gate opens.
//
// The seam for swing two (the clerks) is deliberately left open: step *state*
// folds from the human-in-the-loop event kinds already in the log (`noted`,
// `proposed`, `awaiting`, `approved`, `overridden`, `done`), so a clerk can
// grip these steps next without the engine changing shape.

import type { EventKind, KingdomEvent } from './events';
import { readCase } from './events';

// ── The template — loaded config ────────────────────────────────────────────

/** A timing edge, expressed from config. `after` / `before` are offsets in
 *  days from the trigger: 0 is the day itself, -7 is T-7d, +30 a month out.
 *  `onOrAfterDayOfMonth` / `beforeDayOfMonth` bound a step to a calendar
 *  window ("after the 15th / before the 10th") — a money step that may only
 *  move inside the circuit's open days. */
export interface TimingEdge {
  after?: number;
  before?: number;
  onOrAfterDayOfMonth?: number;
  beforeDayOfMonth?: number;
  /** WHICH DATE the day offsets count from. This field was missing, and its
   *  absence was not a documentation gap — it was a live defect.
   *
   *  `readFlow` measured every offset forward from the day the case OPENED,
   *  because that is the only date a case carries. But `pre-inspection` on the
   *  move-out relay is written `{ after: -14, before: -7 }`, meaning "between
   *  fourteen and seven days before the tenant LEAVES" — a different date
   *  entirely. Read against the case's open date, `after: -14` says the step was
   *  due a fortnight before the case existed, so `daysSinceOpen > after + wait`
   *  is true the instant the step is handed. Every move-out case in the system
   *  showed that step permanently BREACHED, from day zero, forever.
   *
   *  A red flag nobody can clear is worse than no flag: it trains its reader to
   *  ignore the column, and the column is how a breach gets noticed at all.
   *
   *  `opened` (the default) keeps every existing step behaving exactly as before.
   *  `target` means the offsets count from the case's own target date — the
   *  move-out date, the lease expiry — supplied by the caller. A case that does
   *  not know its target date yields **no due date and no breach**, which is the
   *  honest answer: unknown is not overdue. */
  anchor?: 'opened' | 'target';
}

/** Who gets the ball on a step: a census person id, or a queue name (a role
 *  nobody holds yet — the queue reads as the holder until a setting maps it). */
export type HolderRef = string;

/** HOW A FAILURE IS CAUGHT — and therefore whether a machine could ever raise it.
 *
 *  This is the axis that decides what can be automated, so it must not be a
 *  free-text note. A book that cannot say which of its failures a machine can
 *  detect cannot say what it would cost to run.
 *
 *    validation — malformed input. A blank field, an amount out of range, a date
 *                 before the one it must follow. A machine can see it.
 *    absence    — a step never happened, visible by its missing output. A
 *                 machine can see it, because what is missing is a record.
 *    judgment   — well-formed input, wrong call. The estimate is a real number
 *                 and it is the wrong number. NO machine can see it, ever.
 *
 *  The distinction earns its keep at the third value. `judgment` is the floor
 *  under the escape rate: work no automation can take, however good it gets. A
 *  book that blurs judgment into validation reports a ceiling it cannot reach,
 *  and the blur always runs the same direction — toward the flattering number. */
export type FailureDetects = 'validation' | 'absence' | 'judgment';

/** WHERE A FAILED CASE COMES TO REST — and only one of the two is an escape.
 *
 *    origin   — back to the party who erred: the tenant, the owner, the artisan.
 *               Costs the operator nothing but the chase.
 *    operator — up to the one human running the system. This is an ESCAPE, and
 *               the escape count is the number this whole product is measured
 *               against (src/domain/escape.ts: one operator, 10,000 doors).
 *
 *  A model that cannot tell a bounce-back from an escalation counts every
 *  remedy as coverage and reports the flattering half. That is the entire
 *  reason this field exists rather than a boolean `remediated`. */
export type FailureEnds = 'origin' | 'operator';

/** A step's failure exit — where the case goes, how the failure was caught, and
 *  where it comes to rest.
 *
 *  WHY THIS IS THREE FIELDS AND NOT A STRING. The first cut of this was
 *  `onFail: string` — a step key and nothing else. It was enough to move a case
 *  and useless for anything else: a route that only says *where next* cannot be
 *  counted against the bar the product is judged by, because the two questions
 *  that matter about a failure are whether a machine could have caught it and
 *  whether it cost the one operator a slice of their day. Neither is derivable
 *  from a step key.
 *
 *  The three axes are not ours. The sibling project drew the same layer from its
 *  own evidence and landed on `detects` and `terminates_at` with the same values
 *  and the same rule about judgment; adopting them costs nothing and means the
 *  two projects' escape numbers are the same number rather than two numbers
 *  wearing one word. Only the shape crossed — no instance, no evidence, no
 *  figure. Our field names are ours; the VALUES match on purpose, because that
 *  is what makes the counts comparable. */
export interface FailureRoute {
  /** The step a failed case is handed — a key in THIS SAME flow. Naming this
   *  step's own key is the remediation loop: put it in again, correctly. Naming
   *  an earlier step sends the case back to where the bad input entered. Naming
   *  a later one is a route around. */
  to: string;
  detects: FailureDetects;
  endsAt: FailureEnds;
}

export interface FlowStep {
  key: string;
  /** The catalog row this step is an instance of — every step references the
   *  loaded ontology by key (docs/KINGDOM.md, "the catalog is the event
   *  taxonomy"). */
  catalogRow: string;
  holder: HolderRef;
  /** The board this step renders on — a phase of the cascade ("Move-Out",
   *  "Leasing"). Boards are config, not code. */
  board: string;
  edge: TimingEdge;
  /** Days the step may sit past its edge before the reading calls it
   *  breached — the wait / SLA. */
  slaDays?: number;
  /** The loop marker: when set, the step repeats on its edge until the
   *  condition no longer holds (the weekly price-drop until leased). */
  repeatEveryDays?: number;
  /** A free-text condition, human-read ("until leased") — swing one records
   *  it; the clerks will act on it. */
  condition?: string;
  /** WHERE A CASE GOES WHEN THIS STEP FAILS, HOW THE FAILURE IS CAUGHT, AND
   *  WHERE IT COMES TO REST — see `FailureRoute`.
   *
   *  THERE IS NO DEFAULT, AND THAT IS THE DESIGN. A step that declares no
   *  `onFail` CANNOT FAIL: `failStep` refuses to write a `failed` event for it,
   *  so the engine can never park a case somewhere it has no way out of. Every
   *  other shape was worse. Defaulting to "retry this step" invents a remedy
   *  nobody chose and loops forever on an input that will never be right.
   *  Defaulting to "the case dies here" is silent write loss with a schema.
   *
   *  So the absence is a reading, not a hole — `readFailureRoutes` counts the
   *  steps with no exit and names them. Routing all of them by guesswork now
   *  would be inventing dozens of remedies in an afternoon, which is the thing
   *  this codebase already refuses to do with a threshold and should refuse to
   *  do with a remedy. The mechanism is built; which steps may fail, and where
   *  each goes, is a design decision, and the count keeps it visible until it
   *  is made. */
  onFail?: FailureRoute;
  note?: string;
}

export interface FlowTemplate {
  key: string;
  title: string;
  /** The human trigger line ("a tenant gives notice"). Swing one triggers by
   *  a hand on the Ledger; the trigger is config so the clerks can fire it. */
  trigger: string;
  steps: FlowStep[];
}

export type FlowBook = FlowTemplate[];

// The founding book — working fluid ───────────────────────────────────────
// The FIVE event-driven workflows, all config — the whole automation surface a
// property firm runs on, each a trigger and a cascade that stops at the human
// judgments it must never cross (TARGET-MODEL, "five event-driven workflows",
// confirmed 1:1 against a firm's own process maps):
//   1. Notice to vacate  → move-out-relay   (thirteen steps, five hands, three
//      boards, a timing-boxed money step and a weekly loop).
//   2. WO submitted      → vendor-dispatch  (the work-order word: report →
//      identify → assign → dispatch → invoice → confirm → pay → post).
//   3. HOA/owner/vendor notice → violation-notice (classify → decide → serve →
//      follow to cure → close; the violation call kept human).
//   4. Lease expiration (T-90) → lease-renewal (offer → owner window → chase →
//      countersign → fee → record; the rent call and the signature human).
//   5. Property won      → owner-onboarding (intake → agreement → setup →
//      walkthrough → insurance → make-ready → lockbox → report → go-live).
// All held entirely in config, as proof of the line: no branch of code knows
// the word "move-out" or "renewal"; the template says it all. These are the
// leash-safe SHAPES — general and working-fluid, no factory's figures; a firm's
// real steps, holders, thresholds, and GL codes load through the same
// `flows.load` gate as the catalog's rows when the data gate opens.
//
// vendor-dispatch carries `{trade}` / `{urgency}` tokens in its notes — the
// leaves of the Maintenance tree (FOUNDING_CATALOG) bind it with per-leaf
// params, so one grammar renders many words ("no cooling" walks as an
// emergency HVAC dispatch; "routine service" the same grammar at a routine
// pace). Holders stay real ids (seats and queues; the vendor is a artisan's
// queue) — the trade is flavor in the note, never a fake seat.


// ── Where the timing numbers live ───────────────────────────────────────────
//
// NOT HERE. Every day offset, SLA, calendar edge and repeat interval in this
// book — 116 of them — is declared in `knowledge/facts.json` and read back at
// load. The templates below carry the SHAPE of the work (who holds it, which
// board, which catalog row) and none of its quantities.
//
// WHY, in one sentence: a bare integer has nowhere to put "varies by contract",
// so whoever writes each site picks a value and moves on, and the drift is
// invisible. The sibling firm's corpus had the owner-approval cap in seven
// places carrying two different values, five of them inside conditions that
// executed. Nobody was careless; the data shape made it unavoidable and then
// made it silent.
//
// A fact can carry what an integer cannot: what KIND of quantity it is, what
// date it is measured from (`anchor` — the field whose absence made one step
// read as permanently breached), its scope, and its provenance. Change a
// deadline in `facts.json` and the flow changes; there is no second copy to
// forget.
//
// A step whose facts are missing gets an EMPTY edge, not a default. An invented
// deadline is worse than an absent one: absent reads as "no due date", invented
// reads as authoritative and is wrong.

import factsDoc from '../../knowledge/facts.json' with { type: 'json' };

type TimingFact = { id: string; kind?: string; value?: unknown; anchorRef?: string };

const TIMING: Map<string, number> = new Map();
const ANCHORS: Map<string, 'opened' | 'target'> = new Map();
for (const f of (factsDoc as { facts: TimingFact[] }).facts) {
  if (!f.id.startsWith('fact:flow-') || typeof f.value !== 'number') continue;
  TIMING.set(f.id, f.value);
  if (f.anchorRef === 'target' || f.anchorRef === 'opened') {
    ANCHORS.set(f.id.replace(/-(after|before)$/, ''), f.anchorRef);
  }
}

const num = (flowKey: string, stepKey: string, field: string): number | undefined =>
  TIMING.get(`fact:flow-${flowKey}-${stepKey}-${field}`);

/** A step as authored: the shape of the work, with no quantities in it. */
type UntimedStep = Omit<FlowStep, 'edge' | 'slaDays' | 'repeatEveryDays'>;
type UntimedTemplate = Omit<FlowTemplate, 'steps'> & { steps: UntimedStep[] };

/** Join the authored shapes to their declared numbers. This is the only place
 *  the two halves meet, so there is exactly one thing to read to know how a
 *  timing is resolved. */
function withTiming(book: UntimedTemplate[]): FlowBook {
  return book.map((t) => ({
    ...t,
    steps: t.steps.map((s) => {
      const edge: TimingEdge = {};
      const after = num(t.key, s.key, 'after');
      const before = num(t.key, s.key, 'before');
      const onAfter = num(t.key, s.key, 'onOrAfterDayOfMonth');
      const beforeDom = num(t.key, s.key, 'beforeDayOfMonth');
      if (after !== undefined) edge.after = after;
      if (before !== undefined) edge.before = before;
      if (onAfter !== undefined) edge.onOrAfterDayOfMonth = onAfter;
      if (beforeDom !== undefined) edge.beforeDayOfMonth = beforeDom;
      const anchor = ANCHORS.get(`fact:flow-${t.key}-${s.key}`);
      if (anchor) edge.anchor = anchor;
      const sla = num(t.key, s.key, 'slaDays');
      const repeat = num(t.key, s.key, 'repeatEveryDays');
      const step: FlowStep = { ...s, edge };
      if (sla !== undefined) step.slaDays = sla;
      if (repeat !== undefined) step.repeatEveryDays = repeat;
      return step;
    }),
  }));
}

export const FOUNDING_FLOWS: FlowBook = withTiming(([
  {
    key: 'move-out-relay',
    title: 'Move-out → re-list relay',
    trigger: 'A tenant gives notice',
    steps: [
      {
        key: 'log-notice',
        catalogRow: 'notice-received',
        holder: 'pm-desk',
        board: 'Move-Out',
        note: 'Notice logged and acknowledged; the clock starts.',
      },
      {
        key: 'confirm-date',
        catalogRow: 'confirm-vacate-date',
        holder: 'pm-desk',
        board: 'Move-Out',
        note: 'Vacate date confirmed in writing with the tenant.',
      },
      {
        key: 'pre-inspection',
        catalogRow: 'schedule-pre-inspection',
        holder: 'alys',
        board: 'Move-Out',
        // Counted from the tenant's LAST DAY, not from the day notice landed —
        // the only step in the book on a different clock, and the reason
        // `anchor` exists. See TimingEdge.
        note: 'Walk the unit before the tenant leaves; scope the turn.',
      },
      {
        key: 'move-out-inspection',
        catalogRow: 'move-out-inspection',
        holder: 'alys',
        board: 'Move-Out',
        note: 'Document condition against the deposit.',
      },
      {
        key: 'turn-scope',
        catalogRow: 'scope-the-turn',
        holder: 'va-desk',
        board: 'Move-Out',
        note: 'Bids gathered, the turn scoped and priced.',
      },
      {
        key: 'owner-reserve',
        catalogRow: 'owner-reserve',
        holder: 'lp-queue',
        board: 'Deposit Transfer',
        note: 'A ~$750 owner reserve, requested only inside the open window.',
      },
      {
        key: 'turn-work',
        catalogRow: 'work-the-turn',
        holder: 'va-desk',
        board: 'Move-Out',
        note: 'The turn itself: vendors dispatched, unit made ready.',
      },
      {
        key: 'deposit-accounting',
        catalogRow: 'deposit-accounting',
        holder: 'alys',
        board: 'Deposit Transfer',
        note: 'Deductions itemized and sent inside the statutory window.',
      },
      {
        key: 'deposit-transfer',
        catalogRow: 'transfer-the-deposit',
        holder: 'lp-queue',
        board: 'Deposit Transfer',
        note: 'What is owed moves: refund out, damages to the owner.',
      },
      {
        key: 'final-walk',
        catalogRow: 'final-walk',
        holder: 'osric',
        board: 'Leasing',
        note: 'Rent-ready verified before the listing goes live.',
      },
      {
        key: 'list-unit',
        catalogRow: 'list-unit',
        holder: 'osric',
        board: 'Leasing',
        note: 'Photos, price, syndication — the unit is on the market.',
      },
      {
        key: 'show-and-screen',
        catalogRow: 'show-and-screen',
        holder: 'osric',
        board: 'Leasing',
        note: 'Showings worked, applicants screened.',
      },
      {
        key: 'weekly-price-drop',
        catalogRow: 'vacancy-price-drop',
        holder: 'osric',
        board: 'Leasing',
        condition: 'until leased',
        note: 'The vacancy loop: $25 off the ask each week it sits.',
      },
    ],
  },
  {
    key: 'vendor-dispatch',
    title: 'Vendor dispatch',
    trigger: 'A work order is reported',
    steps: [
      {
        key: 'report',
        catalogRow: 'work-order',
        holder: 'pm-desk',
        board: 'Intake',
        note: 'The report logged — what broke, which door, how it reached us.',
      },
      {
        key: 'identify',
        catalogRow: 'work-order',
        holder: 'mabel',
        board: 'Intake',
        note: 'Walked down the tree to a leaf — a {trade} call, {urgency} priority.',
      },
      {
        key: 'assign-vendor',
        catalogRow: 'work-order',
        holder: 'va-desk',
        board: 'Dispatch',
        note: 'A artisan of the {trade} trade chosen for a {urgency} call.',
      },
      {
        key: 'dispatch',
        catalogRow: 'work-order',
        holder: 'va-desk',
        board: 'Dispatch',
        note: 'The {trade} artisan dispatched — {urgency} window, tenant notified.',
      },
      {
        key: 'invoice-in',
        catalogRow: 'work-order',
        holder: 'lp-queue',
        board: 'Settlement',
        note: "The {trade} artisan's invoice received and matched to the work.",
      },
      {
        key: 'confirm-work',
        catalogRow: 'work-order',
        holder: 'mabel',
        board: 'Dispatch',
        note: 'The fix confirmed with the tenant — the {trade} work holds.',
      },
      {
        key: 'pay-vendor',
        catalogRow: 'work-order',
        holder: 'lp-queue',
        board: 'Settlement',
        note: 'The artisan paid — only inside the open window of the circuit.',
      },
      {
        key: 'post-to-accounting',
        catalogRow: 'work-order',
        holder: 'lp-queue',
        board: 'Settlement',
        note: 'The cost posted to the door and its owner — the ledger balanced.',
      },
    ],
  },
  // ── Workflow three: HOA / owner / vendor notice → violation-notice ─────────
  // Classify → the violation DECISION (human) → draft → serve (the legal gate
  // kept) → follow the cure window until cured → close. Every step shares the
  // `violation-notice` trigger row, told apart by holder + order — the
  // vendor-dispatch pattern. {violation} / {days} render from TOKEN_DEFAULTS.
  {
    key: 'violation-notice',
    title: 'Violation / notice',
    trigger: 'A violation or notice arrives',
    steps: [
      {
        key: 'receive',
        catalogRow: 'violation-notice',
        holder: 'pm-desk',
        board: 'Intake',
        note: 'The notice logged — HOA, owner, or vendor; what, which door, from whom.',
      },
      {
        key: 'classify',
        catalogRow: 'violation.classify',
        holder: 'va-desk',
        board: 'Intake',
        note: 'Classified by kind and severity — the {violation} named.',
      },
      {
        key: 'decide',
        catalogRow: 'violation.decide',
        holder: 'mabel',
        board: 'Judgment',
        note: 'The call a human makes: cure, waive, or send the {violation} up the ladder.',
      },
      {
        key: 'draft-notice',
        catalogRow: 'violation.draft',
        holder: 'va-desk',
        board: 'Notice',
        note: 'The cure notice drafted from the template — the {days}-day window stated.',
      },
      {
        key: 'serve',
        catalogRow: 'violation.serve',
        holder: 'pm-desk',
        board: 'Notice',
        note: 'Served and recorded — the legal gate kept, the clock on record.',
      },
      {
        key: 'cure-window',
        catalogRow: 'violation.cure',
        holder: 'mabel',
        board: 'Follow-up',
        condition: 'until cured',
        note: 'The cure period worked — reminded each week it stands open.',
      },
      {
        key: 'close',
        catalogRow: 'violation.close',
        holder: 'pm-desk',
        board: 'Close',
        note: 'The outcome recorded and the case closed — cured, or handed up the ladder.',
      },
    ],
  },
  // ── Workflow four: lease expiration (T-90) → lease-renewal ─────────────────
  // The T-90 window opens → the rent DECISION (human) → draft & send the offer
  // → the owner's silence-is-authorization window → chase the tenant until
  // signed → the broker's countersignature (human) → post the fee in the money
  // window → record; unsigned rolls to month-to-month with the premium.
  {
    key: 'lease-renewal',
    title: 'Lease renewal',
    trigger: 'A lease nears its term (T-90)',
    steps: [
      {
        key: 'open-window',
        catalogRow: 'renewal',
        holder: 'lp-queue',
        board: 'Renewal',
        note: 'The T-90 window opens — the term in sight, the file pulled.',
      },
      {
        key: 'price',
        catalogRow: 'renewal.price',
        holder: 'osric',
        board: 'Pricing',
        note: 'The rent call a human makes — hold, raise by {increase}, or let the door go.',
      },
      {
        key: 'draft-offer',
        catalogRow: 'renewal.draft-offer',
        holder: 'lp-queue',
        board: 'Offer',
        note: 'The renewal offer drafted at the set {rent} — the packet staged.',
      },
      {
        key: 'send-offer',
        catalogRow: 'renewal.send-offer',
        holder: 'lp-queue',
        board: 'Offer',
        note: 'The offer sent to the tenant — the term and the {rent} on the table.',
      },
      {
        key: 'owner-window',
        catalogRow: 'renewal.owner-window',
        holder: 'lp-queue',
        board: 'Owner',
        // STRUCK 2026-08-07: this read `condition: 'silence is authorization'`
        // and the note said silence past the window "stands as consent"
        // (docs/WRIT-THE-GATE.md). Two reasons it had to go, and the second is
        // the one that made it urgent.
        //
        // First, `condition` is FREE TEXT and is never evaluated anywhere — so a
        // condition declaring a dangerous default is pure hazard: it teaches
        // every reader and every clerk the wrong rule, with no mechanism that
        // could ever make it true or catch it being wrong.
        //
        // Second, this step's catalog row was `mode: 'auto'`. The obvious next
        // improvement — let the clerks complete the steps the book says need no
        // person — would therefore have AUTHORIZED SPENDING AN OWNER'S MONEY ON
        // THEIR SILENCE, on a clock, with no human in it. The row is now
        // `human`: an owner's window that closes unanswered is an absence, and
        // an absence is a judgment, not a yes.
        condition: 'until the owner answers',
        note: "The owner's window — an unanswered window is an absence, never a consent.",
      },
      {
        key: 'tenant-response',
        catalogRow: 'renewal.tenant-response',
        holder: 'lp-queue',
        board: 'Offer',
        condition: 'until signed',
        note: 'The tenant chased each week — signed, or the term runs month-to-month.',
      },
      {
        key: 'countersign',
        catalogRow: 'renewal.countersign',
        holder: 'osric',
        board: 'Execution',
        note: "The broker's signature — the one hand the machine never holds.",
      },
      {
        key: 'post-fee',
        catalogRow: 'renewal.fee',
        holder: 'lp-queue',
        board: 'Settlement',
        note: 'The renewal fee posted — only inside the open window of the circuit.',
      },
      {
        key: 'record',
        catalogRow: 'renewal.record',
        holder: 'lp-queue',
        board: 'Close',
        note: 'Filed and notified — unsigned rolls to month-to-month with the premium.',
      },
    ],
  },
  // ── Workflow five: property won → owner-onboarding ────────────────────────
  // Intake → the management AGREEMENT (human signature) → set up records → the
  // property WALKTHROUGH (human, onsite) → verify insurance → make-ready (only
  // where a door comes vacant) → hang the lockbox (the physical leg) → the
  // first owner report → go live (list & syndicate a vacant door).
  {
    key: 'owner-onboarding',
    title: 'Owner onboarding',
    trigger: "A new owner's property is won",
    steps: [
      {
        key: 'intake',
        catalogRow: 'owner-onboarding',
        holder: 'pm-desk',
        board: 'Intake',
        note: 'The owner intake logged — the property, the doors, the terms sought.',
      },
      {
        key: 'agreement',
        catalogRow: 'onboarding.agreement',
        holder: 'osric',
        board: 'Agreement',
        note: "The management agreement — a signature and a judgment, kept human.",
      },
      {
        key: 'set-up-records',
        catalogRow: 'onboarding.setup',
        holder: 'va-desk',
        board: 'Setup',
        note: 'Records opened and defaults set in the system of record.',
      },
      {
        key: 'walkthrough',
        catalogRow: 'onboarding.walkthrough',
        holder: 'alys',
        board: 'Onsite',
        note: "The property walked — the onsite judgment the machine can't make.",
      },
      {
        key: 'verify-insurance',
        catalogRow: 'onboarding.insurance',
        holder: 'va-desk',
        board: 'Compliance',
        note: 'Owner insurance verified and on file — the coverage gate.',
      },
      {
        key: 'make-ready',
        catalogRow: 'onboarding.make-ready',
        holder: 'va-desk',
        board: 'Make-Ready',
        condition: 'if the door stands vacant',
        note: 'The make-ready batched — only where a door comes empty.',
      },
      {
        key: 'lockbox',
        catalogRow: 'onboarding.lockbox',
        holder: 'alys',
        board: 'Onsite',
        note: 'Keys logged and the lockbox hung — the physical leg.',
      },
      {
        key: 'first-report',
        catalogRow: 'onboarding.report',
        holder: 'pm-desk',
        board: 'Report',
        note: 'The first owner report sent — the relationship opened on the books.',
      },
      {
        key: 'go-live',
        catalogRow: 'onboarding.go-live',
        holder: 'osric',
        board: 'Leasing',
        condition: 'if the door stands vacant',
        note: 'Built and syndicated — the vacant door goes to market.',
      },
    ],
  },
] as UntimedTemplate[]));

// ── The engine: instantiate a flow as events ────────────────────────────────
// Triggering a flow opens a case and hands its FIRST step — the log records what
// has happened, never a plan (events-only). The template holds the whole
// cascade; the log carries only its front, so the ball sits with the step
// actually in hand, and the cascade advances a step at a time as each is worked
// (the clerks, swing two). The first step enters `awaiting` when it waits on a
// judgment (a wait, a money window, a condition), else `handed` to its holder.

/** Steps whose edge or nature parks them on a judgment rather than in a hand:
 *  anything with a wait (slaDays), a calendar window, a loop, or a condition. */
function stepWaits(s: FlowStep): boolean {
  return (
    s.slaDays != null ||
    s.edge.onOrAfterDayOfMonth != null ||
    s.edge.beforeDayOfMonth != null ||
    s.repeatEveryDays != null ||
    s.condition != null
  );
}

/** A step whose progress depends on something OUTSIDE the machine's sight — an
 *  answer from someone who does not work here, a condition on the world, or a
 *  chase that repeats until somebody acts. **No clerk may complete one of these
 *  unattended, whatever its mode says**, because the clerk cannot observe the
 *  thing it would be asserting to be true.
 *
 *  DELIBERATELY NOT `stepWaits`, and the difference is the whole point.
 *  `stepWaits` asks *does this step park?* and answers yes for an `slaDays` — but
 *  **an SLA is a DEADLINE, not a dependency.** A step due in two days is exactly
 *  a step a machine should do NOW. Reusing `stepWaits` as this guard was tried
 *  and measured: it left **1 of 13** `auto` steps runnable instead of 8, so the
 *  guard would have silently cancelled the feature it was meant to protect.
 *
 *  The calendar window is in this list for a DIFFERENT and TEMPORARY reason:
 *  `onOrAfterDayOfMonth`/`beforeDayOfMonth` are never compared to a date
 *  anywhere (`docs/WRIT-THE-GATE.md`, finding 4), so the month-start freeze they
 *  express is not enforced by anything. Until it bites, a clerk must not run
 *  through one — it would be honouring a window nothing checks. Revisit here
 *  when that finding is fixed. */
export function awaitsOutside(s: FlowStep): boolean {
  return (
    s.condition != null ||
    s.repeatEveryDays != null ||
    s.edge.onOrAfterDayOfMonth != null ||
    s.edge.beforeDayOfMonth != null
  );
}

/** May a clerk complete this step on its own, with no human in the loop?
 *
 *  Two conditions, both required: the book must SAY so (`mode: 'auto'` on the
 *  step's catalog row — the machine's own claim that no person is needed), and
 *  the step must not depend on anything the machine cannot see (`awaitsOutside`).
 *
 *  Mode lives on the catalog ROW rather than the step, so steps sharing a row
 *  share one judgment — all eight vendor-dispatch steps are one row. That is a
 *  real limit on how fine this can be, and `escape.ts` reports the same limit on
 *  its own reading. The mode lookup is passed in as a map rather than imported,
 *  because this module deliberately does not depend on the catalog;
 *  `readFailureRoutes` already takes it the same way. */
export function mayRunUnattended(
  s: FlowStep,
  modeOf: Map<string, 'auto' | 'human' | undefined>,
): boolean {
  return modeOf.get(s.catalogRow) === 'auto' && !awaitsOutside(s);
}

/** Human-legible timing for the emitted note, folded from the edge. */
export function edgeLine(edge: TimingEdge): string {
  const parts: string[] = [];
  const rel = (n: number) =>
    n === 0 ? 'on notice day' : n < 0 ? `T${n}d` : `T+${n}d`;
  if (edge.after != null && edge.before != null)
    parts.push(`${rel(edge.after)} → ${rel(edge.before)}`);
  else if (edge.after != null) parts.push(rel(edge.after));
  else if (edge.before != null) parts.push(`by ${rel(edge.before)}`);
  if (edge.onOrAfterDayOfMonth != null || edge.beforeDayOfMonth != null)
    parts.push(
      `in the window: on/after the ${edge.onOrAfterDayOfMonth ?? '?'}th, before the ${edge.beforeDayOfMonth ?? '?'}th`,
    );
  return parts.join(' · ');
}

export interface FlowInstance {
  caseId: string;
  events: KingdomEvent[];
}

/** A leaf's letters — the `{token}`s of a flow shape render from this map
 *  ("{trade}" → "HVAC"). One grammar, many words. */
export type FlowParams = Record<string, string>;

/** Substitute `{token}`s in a bit of template text from a params map. Unknown
 *  tokens are left verbatim ("{trade}" with no trade stays "{trade}"), so a
 *  shape rendered without its letters still reads as a shape. */
function substitute(text: string, params?: FlowParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
}

/** The note a step's event carries — its place, its timing, its loop, its
 *  letters rendered (`{trade}` → the leaf's trade). */
function stepNote(s: FlowStep, index: number, total: number, params?: FlowParams): string {
  const bits = [substitute(s.note ?? '', params), edgeLine(s.edge)];
  if (s.repeatEveryDays != null)
    bits.push(
      `repeats every ${s.repeatEveryDays}d ${substitute(s.condition ?? '', params)}`.trim(),
    );
  else if (s.condition) bits.push(`when ${substitute(s.condition, params)}`);
  return `Step ${index + 1}/${total} · ${bits.filter(Boolean).join(' — ')}`;
}

/** The event that hands one step to its holder — `awaiting` when it waits on a
 *  judgment, else `handed`. Exported so the clerks (swing two) advance a flow
 *  by handing the next step the same way the engine hands the first. `params`
 *  renders `{token}`s in the note and condition text — NEVER in the holder:
 *  holders stay real ids (a census person or a queue); the leaf's trade is
 *  flavor in the text, not a fake seat. */
export function handStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; id: () => string },
  params?: FlowParams,
): KingdomEvent {
  const s = tpl.steps[index];
  return {
    id: opts.id(),
    at: opts.at,
    caseId,
    kind: stepWaits(s) ? 'awaiting' : 'handed',
    catalogRow: s.catalogRow,
    holder: s.holder,
    note: stepNote(s, index, tpl.steps.length, params),
  };
}

/** Instantiate a flow on a subject ("Willow Creek unit 4"): open the case and
 *  hand its first step. Pure — ids and the timestamp come from the caller, so
 *  the store and the tests steer the clock. Nothing is written here; the caller
 *  appends the returned events to the log. The rest of the cascade lives in the
 *  template until it is reached — the log carries only what has happened.
 *  `params` is the leaf's letters: the store passes a triggered task-type's
 *  `params` in and one shape renders as that word. */
export function instantiateFlow(
  tpl: FlowTemplate,
  subject: string,
  opts: { at: string; id: () => string; estateId?: string },
  params?: FlowParams,
): FlowInstance {
  const caseId = `${tpl.key}: ${subject.trim()}`;
  const events: KingdomEvent[] = [
    {
      id: opts.id(),
      at: opts.at,
      caseId,
      kind: 'opened',
      note: `${substitute(tpl.trigger, params)} — the ${tpl.title} begins: ${tpl.steps.length} steps.`,
      // Carry the leaf's letters on the opening record, so ADVANCING the
      // cascade can recover them and render every later step (the seam).
      ...(params && Object.keys(params).length ? { params } : {}),
      // The real property this case concerns — folded forward by `readCase` so
      // the spend gate can read its per-estate cap. Absent ⇒ house cap, as before.
      ...(opts.estateId ? { estateId: opts.estateId } : {}),
    },
  ];
  if (tpl.steps.length) events.push(handStep(tpl, caseId, 0, opts, params));
  return { caseId, events };
}

/** The letters a flow instance renders from — the `params` recorded on its
 *  `opened` event (instantiateFlow), or undefined for an unparameterized
 *  cascade. The store reads this back to thread the same letters through the
 *  cascade's advancement, closing the params-advance seam. */
export function paramsOf(log: KingdomEvent[], caseId: string): FlowParams | undefined {
  const opened = log.find((e) => e.caseId === caseId && e.kind === 'opened');
  return opened?.params;
}

/** Readable defaults for the common flow tokens — so a cascade triggered from
 *  a catalog leaf renders every step even when the leaf's own params don't name
 *  every `{token}` a richer grammar uses (a library flow may speak of `{days}`,
 *  `{amount}`, a `{violation}` the leaf never carried). General, working-fluid;
 *  a setting tunes them when its real figures load. */
const TOKEN_DEFAULTS: FlowParams = {
  trade: 'the trade',
  urgency: 'routine',
  days: '30',
  amount: 'the sum',
  violation: 'the violation',
  rent: 'the rent',
  balance: 'the balance',
  fee: 'the fee',
  date: 'the date',
  unit: 'the unit',
  name: 'the tenant',
  increase: 'the increase',
  notice: 'the notice',
  term: 'the term',
  deposit: 'the deposit',
  reason: 'the reason',
  count: 'the count',
};

/** The full letters to render a template with: the leaf's own params first,
 *  then a readable default for every other `{token}` the steps or the trigger
 *  reference — so triggering a leaf's completion flow never leaks a literal
 *  `{token}`, however rich the loaded grammar. (The war-game generator fills
 *  tokens the same way; this is the store's equivalent for a hand-triggered
 *  cascade.) */
export function fullParams(tpl: FlowTemplate, leaf?: FlowParams): FlowParams {
  const p: FlowParams = { ...(leaf ?? {}) };
  const sources = [tpl.trigger, ...tpl.steps.flatMap((s) => [s.note, s.condition])];
  for (const src of sources) {
    if (!src) continue;
    for (const m of src.matchAll(/\{(\w+)\}/g)) {
      if (!(m[1] in p)) p[m[1]] = TOKEN_DEFAULTS[m[1]] ?? m[1];
    }
  }
  return p;
}

// ── The operator's hands (swing two, part one — docs/WRIT-OPERATOR-HANDS.md) ─
// The human-in-the-loop arc that walks a cascade forward. Every helper is pure
// and returns the events to APPEND — nothing is written here, and nothing about
// a flow's progress is ever stored (events-only). A *human* act carries no
// actor: the clerk's seam stays clean — when the agents arrive they emit
// `proposed` with an `agent:<seat>` actor, and the human's `approved` /
// `overridden` below is the answer to it. The template is the plan and the log
// is the truth: advancing hands the next TEMPLATE step, never a pre-emitted
// future one.
//
// AMENDED 2026-08-07. "A human act carries no actor" was a sound convention
// while `done` could only BE a human act — absence of an actor meant the
// operator, because nothing else could reach the writer. The sweep ended that:
// an advance clerk now completes a step the book declared `auto`, through this
// same `completeStep`, and an unstamped `done` made the machine's work
// indistinguishable from the operator's own hand.
//
// That is not a cosmetic gap. The escape rate is the governing number of this
// product, and it is READ off the log; a fold that cannot tell a swept step from
// a worked one cannot measure the thing the kingdom exists to drive down, and
// would have flattered it in exactly the direction nobody would question. It
// also breaks the audit ledger's plainest promise — that you can ask who did a
// thing and get an answer.
//
// So `actor` is now stampable on any answering act, and absence keeps its
// meaning: no actor is the operator. The clerks stamp `agent:<seat>`, the same
// grammar `proposeStep` has always used, so one reading recognises both.

/** One appended event answering the step in hand — the shared spine of the
 *  helpers below. Carries the step's catalog row and holder so the fold reads
 *  it as progress on that step, and the `Step n/N` note so order survives. */
function answerStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  kind: EventKind,
  opts: { at: string; id: () => string; note?: string; actor?: string },
): KingdomEvent {
  const s = tpl.steps[index];
  const line = opts.note?.trim() ? ` — ${opts.note.trim()}` : '';
  const ev: KingdomEvent = {
    id: opts.id(),
    at: opts.at,
    caseId,
    kind,
    catalogRow: s.catalogRow,
    holder: s.holder,
    note: `Step ${index + 1}/${tpl.steps.length} · ${kind}${line}`,
  };
  // Set only when named. An absent `actor` still means the operator's own hand,
  // so every event written before this existed keeps the meaning it was written
  // with — and a stamped empty string would be a third state nobody reads.
  if (opts.actor) ev.actor = opts.actor;
  return ev;
}

/** An operator agent's proposal on the step in hand (swing four): the clerk did
 *  the work up to a judgment and STOPS for a human — `proposed → awaiting`, the
 *  human-in-the-loop stop. Unlike the human hands above, it carries an `actor`
 *  (`agent:<seat>`), which the Ledger renders as "<seat>'s clerk"; and it emits
 *  ONLY the `proposed` event, handing NOTHING onward — the cascade waits on the
 *  human's approve/override. The agent never emits `approved`/`overridden`: that
 *  ratchet is the human's alone (KINGDOM.md, the clerk augments, never replaces).
 *  Shares `answerStep`, so it folds through `readFlow` exactly as a human act. */
export function proposeStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  actor: string,
  opts: { at: string; id: () => string; note?: string },
): KingdomEvent | null {
  if (index < 0 || index >= tpl.steps.length) return null;
  const ev = answerStep(tpl, caseId, index, 'proposed', opts);
  ev.actor = actor;
  return ev;
}

/** Mark the step in hand done and hand the next template step — the advance.
 *  Returns both events to append, in order (`done` first, then the next hand).
 *  With no next step the cascade is finished: only the `done` returns, which
 *  folds the case closed. Callers pass the index of the step in hand
 *  (`reading.next`); an out-of-range index is no act at all. */
export function completeStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; id: () => string; note?: string; actor?: string },
  params?: FlowParams,
): KingdomEvent[] {
  if (index < 0 || index >= tpl.steps.length) return [];
  const events = [answerStep(tpl, caseId, index, 'done', opts)];
  if (index + 1 < tpl.steps.length)
    events.push(handStep(tpl, caseId, index + 1, opts, params));
  return events;
}

/** Ratify the step that waits: the human approves, and the cascade moves on —
 *  `approved`, then the next template step handed. (An approved step has
 *  proceeded; the flow does not sit twice on one step.) Ratifying the LAST step
 *  also CLOSES the case — see `closeIfLast`. */
/** THE RATIFICATION GUARD — the kingdom's first RUNTIME refusal.
 *
 *  Until 2026-08-07 the only thing standing between a script and a ratification
 *  was `LedgerView.tsx`'s `canRatify` — **a JSX render condition**
 *  (`docs/WRIT-THE-GATE.md`, finding 5). It hides a button. `approveStep` itself
 *  validated array bounds and agreed to anything else it was asked: a replay, a
 *  second click, an agent, or any future route reached the writer directly and
 *  the writer said yes. A guard in a view is not a guard; it is a guard's
 *  costume.
 *
 *  This refuses where the event is MINTED, so a button and a script are governed
 *  by one rule, and it FAILS CLOSED — an unreadable case, an out-of-range step,
 *  or a step in any state but "waiting for a human's word" yields no events at
 *  all. The posture is inherited deliberately from `contextGuard.ts`, which
 *  throws rather than redacting on the reasoning that a clerk reasoning on
 *  silently-altered evidence is worse than a clerk that stops.
 *
 *  It reuses `readFlow` rather than re-deriving which event belongs to which
 *  step. That placement rule (`Step n/N`, with the legacy holder fallback) has
 *  already been got wrong once, and a second copy of it is a second chance to
 *  get it wrong differently.
 *
 *  Returning `[]` is the refusal, and every caller already handles it: the
 *  store's `handFlow` returns early on an empty batch, so nothing is appended
 *  and nothing is written. */
function refusesRatification(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; log: KingdomEvent[] },
): boolean {
  if (index < 0 || index >= tpl.steps.length) return true;
  // `now` only governs breach and age here, never `kind` — the ratification
  // instant is the honest clock to fold against.
  const kind = readFlow(tpl, opts.log, caseId, opts.at)?.steps[index]?.kind;
  return !(kind === 'awaiting' || kind === 'proposed');
}

export function approveStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; id: () => string; note?: string; log: KingdomEvent[] },
  params?: FlowParams,
): KingdomEvent[] {
  if (refusesRatification(tpl, caseId, index, opts)) return [];
  const events = [answerStep(tpl, caseId, index, 'approved', opts)];
  if (index + 1 < tpl.steps.length) events.push(handStep(tpl, caseId, index + 1, opts, params));
  else events.push(...closeIfLast(tpl, caseId, index, opts));
  return events;
}

/** The final ratification also has to SAY the case is finished.
 *
 *  These two functions long claimed in their own comments that a last-step
 *  approval or override "closes the case" — and nothing implemented it.
 *  `statusOf` closes a case on a `done` event and on nothing else, so a cascade
 *  ratified to its end stayed `open` forever; `readFlow` then reported no next
 *  step, and the Ledger draws its act row only for the step in hand. The result
 *  was a cascade showing every step and offering ZERO buttons: work that could
 *  be walked to completion and never finished, still counted as open, still
 *  carrying a door that opened onto nothing. There was no way to close it from
 *  anywhere in the app. (Driven to 8/8 in a browser by an audit, 2026-07-27.)
 *
 *  Records in, readings out: `statusOf` reads one case's events and cannot know
 *  which step was the last, so the closing must be RECORDED here, where the
 *  template is in hand — not inferred downstream. */
function closeIfLast(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; id: () => string; note?: string },
): KingdomEvent[] {
  if (index + 1 < tpl.steps.length) return [];
  return [answerStep(tpl, caseId, index, 'done', { ...opts, note: 'the cascade is run out' })];
}

/** Overrule the step that waits: the human chose otherwise — `overridden`
 *  records the divergence and the cascade moves on, the next template step
 *  handed. Like `approved`, it is a terminal ratification of the wait (canon:
 *  proposed → approved / overridden); the note carries the choice. Overruling
 *  the LAST step also closes the case — see `closeIfLast`. */
export function overrideStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; id: () => string; note?: string; log: KingdomEvent[] },
  params?: FlowParams,
): KingdomEvent[] {
  // The same runtime refusal as `approveStep`. An override is the human
  // DIVERGING from the proposal, which is still a ratification and still the one
  // act no agent may take — so it cannot be the loose door beside the locked one.
  if (refusesRatification(tpl, caseId, index, opts)) return [];
  const events = [answerStep(tpl, caseId, index, 'overridden', opts)];
  if (index + 1 < tpl.steps.length) events.push(handStep(tpl, caseId, index + 1, opts, params));
  else events.push(...closeIfLast(tpl, caseId, index, opts));
  return events;
}

// ── The failure path ────────────────────────────────────────────────────────
//
// Until now every writer above was a way FORWARD. A step could be handed,
// noted, proposed, approved, overridden or done, and the whole vocabulary of
// the engine was success — so a step that could not be completed had no way to
// say so. It simply stopped, which on every board and in every count looks
// exactly like a step nobody has reached yet.
//
// That gap matters most where the work is human. Luke, 2026-08-06: *"the human
// steps especially can't just be rejected — there needs to be remediation to
// either get them to put in the right input or to correct their input."* A
// rejection with no road back is not a guard; it is a case dropped quietly.
//
// THE WHOLE SHAPE IS TWO PIECES. A step declares `onFail` — a `FailureRoute`
// naming where the case goes, how the failure is caught, and where it comes to
// rest. `failStep` writes the `failed` event and hands the remedy step. There
// is still no third piece: no severity, no retry budget, no taxonomy of
// wrongness. Those wait for evidence.
//
// THE ROUTE GREW TWO AXES, AND THEY WERE NOT INVENTED HERE. The first cut was a
// bare step key. It could move a case and could not answer either question that
// makes a failure worth recording — could a machine have caught this, and did it
// cost the one operator a piece of their day. The sibling project reached the
// same layer from the opposite direction, drawing it out of real procedure
// rather than out of an engine, and arrived at the same two axes with the same
// values. Taking them is not borrowing an answer; it is declining to invent a
// second vocabulary for a distinction two independent passes already agreed on.
// The shape crossed and nothing else did — no instance, no evidence, no figure.
//
// IT COST NOTHING BECAUSE NOTHING WAS ROUTED YET. Every step in the book still
// declares no exit, so widening `onFail` from a string to a record migrated
// exactly zero declarations. The refusal to route the book by guesswork — which
// looked like leaving work undone — is what made the correction free. A book
// with forty-six guessed routes would have had forty-six of them to revisit.

/** Fail the step in hand and hand the step its `onFail` names — the remedy.
 *
 *  Returns BOTH events, like `completeStep`: the `failed` record and the hand
 *  onto the remedy step. When `onFail` names this step's own key the case comes
 *  straight back to the same desk, which is the ordinary shape for bad input:
 *  put it in again, correctly.
 *
 *  A STEP THAT DECLARES NO `onFail` CANNOT FAIL — this returns `[]` and writes
 *  nothing. It is the one gate that makes the mechanism safe to ship with no
 *  routes declared: a `failed` event can never exist without somewhere for the
 *  case to go, so the engine has no way to strand one. Refusing the write is
 *  also the honest answer, because the alternative is choosing a remedy on the
 *  case's behalf at the moment nobody has decided what the remedy is. */
export function failStep(
  tpl: FlowTemplate,
  caseId: string,
  index: number,
  opts: { at: string; id: () => string; note?: string },
  params?: FlowParams,
): KingdomEvent[] {
  if (index < 0 || index >= tpl.steps.length) return [];
  const route = tpl.steps[index].onFail;
  if (!route) return [];
  const at = tpl.steps.findIndex((s) => s.key === route.to);
  // An `onFail` naming a step this flow does not have is a broken route, and a
  // broken route is worse than none: it would write the `failed` event and then
  // have nowhere to hand. The lint catches this in the book (checkFailureRoutes,
  // fatal) — this refuses it at the writer too, because a check that only runs
  // in a tool is not a guarantee about what the engine does at runtime.
  if (at === -1) return [];
  return [answerStep(tpl, caseId, index, 'failed', opts), handStep(tpl, caseId, at, opts, params)];
}

/** How much of a flow book can fail at all — the closure reading over routes.
 *
 *  An absence is a reading (the same rule the escape rate runs on): a book where
 *  no step declares a failure exit is not a book that cannot fail, it is a book
 *  whose failures have nowhere to go, and the two must not look alike. This
 *  gives that absence a size. */
export interface FailureRoutes {
  /** Steps declaring an `onFail` that names a real step in the same flow. */
  routed: {
    flow: string;
    step: string;
    to: string;
    self: boolean;
    detects: FailureDetects;
    endsAt: FailureEnds;
  }[];
  /** Steps declaring no `onFail` at all. These cannot fail — `failStep` refuses
   *  them — so they are not broken; they are undecided, and counted so. */
  unrouted: { flow: string; step: string }[];
  /** `onFail` naming a step the flow does not have. Always a fault: the lint is
   *  fatal on these and `failStep` refuses to write for them. */
  broken: { flow: string; step: string; to: string }[];
  /** THE ONE CROSS-CHECK BETWEEN THE TWO AXES, AND IT IS FATAL.
   *
   *  A route that claims `detects: 'judgment'` while its remedy step sits on a
   *  catalog row marked `auto` is asserting two things that cannot both be
   *  true: that no machine can catch this failure, and that a machine performs
   *  the repair. One of them is wrong and the book does not say which.
   *
   *  It matters because of which way the error runs. `judgment` is the floor
   *  under the escape rate — work no automation will ever take — so a book that
   *  mislabels an automatable failure as judgment reports a floor that is too
   *  high, and one that hangs a judgment call on an `auto` row has quietly
   *  promised a machine will exercise judgment. The second is how an automation
   *  layer gets credited with catching what no automation can catch. */
  judgmentOnAuto: { flow: string; step: string; to: string }[];
  /** Routed steps whose failure comes to rest on the one operator — the escape
   *  count, in the flow book's own declaration, before any case is worked. */
  escalating: number;
}

/** @param modeOf a catalog row key → its `mode`, for the judgment cross-check.
 *  Optional: without it the reading still reports routes, and reports zero
 *  `judgmentOnAuto` rather than pretending it checked. */
export function readFailureRoutes(flows: FlowBook, modeOf?: Map<string, string | undefined>): FailureRoutes {
  const out: FailureRoutes = { routed: [], unrouted: [], broken: [], judgmentOnAuto: [], escalating: 0 };
  for (const t of flows) {
    const byKey = new Map(t.steps.map((s) => [s.key, s]));
    for (const s of t.steps) {
      const route = s.onFail;
      if (!route) {
        out.unrouted.push({ flow: t.key, step: s.key });
        continue;
      }
      const remedy = byKey.get(route.to);
      if (!remedy) {
        out.broken.push({ flow: t.key, step: s.key, to: route.to });
        continue;
      }
      out.routed.push({
        flow: t.key,
        step: s.key,
        to: route.to,
        self: route.to === s.key,
        detects: route.detects,
        endsAt: route.endsAt,
      });
      if (route.endsAt === 'operator') out.escalating += 1;
      if (route.detects === 'judgment' && modeOf?.get(remedy.catalogRow) === 'auto') {
        out.judgmentOnAuto.push({ flow: t.key, step: s.key, to: route.to });
      }
    }
  }
  return out;
}

// ── Readings — the cascade folded back from the log ─────────────────────────
// General: no setting's names below, only template + events. Where the
// cascade sits, what is next, which timing edges are breached — all folded.

/** Where one step of one live flow stands, folded from the case's events. */
export interface StepReading {
  step: FlowStep;
  index: number; // 1-based, for the "step n of N" line
  kind: EventKind | null; // the latest event kind the log holds for it
  /** The latest event's note for this step — the clerk's words on a proposal
   *  (the spend-gate / reconciliation line), or the human's on an answer. */
  note?: string;
  /** Who last acted on this step — a person or an `agent:<seat>` clerk. Lets the
   *  Ledger render "<seat>'s clerk" beside the step in hand. */
  actor?: string;
  /** Days from the trigger until this step's edge opens (its `after`). */
  dueInDays: number | null;
  /** True once now is past the edge plus its wait — the breached reading. */
  breached: boolean;
  /** HOW MANY TIMES THIS STEP HAS FAILED on this case. Counted from the log
   *  rather than read off `kind`, and that is the whole reason it exists: the
   *  commonest remedy is `onFail` naming the step's own key — put it in again —
   *  and that writes `failed` then immediately `handed`, so latest-kind is
   *  `handed` and a step failed six times reads identically to one nobody has
   *  touched. A rework loop that leaves no trace is how a step that always
   *  needs a person looks automatic.
   *
   *  It is also the evidence a remedy taxonomy would need. There is no taxonomy
   *  here on purpose; this is what would earn one. */
  failures: number;
}

export interface FlowReading {
  caseId: string;
  template: FlowTemplate;
  subject: string;
  openedAt: string | null;
  status: 'open' | 'awaiting' | 'done';
  steps: StepReading[];
  /** The next step not yet acted on — the head of the cascade. */
  next: StepReading | null;
  breached: StepReading[];
  /** Boards in first-appearance order, with their steps — the 3-board view. */
  boards: { board: string; steps: StepReading[] }[];
  /** How far the cascade has run: steps with any event past the opening. */
  advanced: number;
  /** Steps this case has had to redo, worst first — the rework the cascade has
   *  cost. Empty on a case that ran clean, which is not the same as a case
   *  nobody has worked; `advanced` says which. */
  rework: StepReading[];
  /** Every time this case failed a step, counted. The number a remedy design
   *  would be built on, and the reason `failed` is one kind and not five. */
  failures: number;
}

const dayMs = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number | null {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Number.isFinite(ms) ? Math.floor(ms / dayMs) : null;
}

/** Match a case's step events to their template step: the events were emitted
 *  in template order (after the `opened`), so the nth step event is the nth
 *  step. Extra events a clerk or a hand adds later (a `done`, a `noted`) read
 *  as progress on the step whose holder and catalog row they carry — or, when
 *  they carry neither, on the last step touched. */
export function readFlow(
  tpl: FlowTemplate,
  log: KingdomEvent[],
  caseId: string,
  now: string,
  /** The case's own target date — the tenant's last day, the lease expiry —
   *  for steps whose edge declares `anchor: 'target'`. Omitted or unknown, those
   *  steps read as having no due date rather than as overdue. */
  targetAt0?: string,
): FlowReading | null {
  const c = readCase(log, caseId);
  if (!c.events.length) return null;
  const openedAt = c.openedAt;
  const targetAt = targetAt0 ?? null;
  const stepEvents = c.events.filter((e) => e.kind !== 'opened');
  // The latest kind recorded against each template step. Seed from the
  // emitted step events in order; then let any later event carrying a
  // catalog row + holder advance the step it matches.
  const kindByStep = new Map<string, EventKind>();
  const noteByStep = new Map<string, string | undefined>();
  const actorByStep = new Map<string, string | undefined>();
  const failsByStep = new Map<string, number>();
  for (const e of stepEvents) {
    // Every flow step event — hand (awaiting/handed) or answer (done/approved/
    // overridden/proposed) — is stamped `Step n/N` by `handStep`/`answerStep`,
    // and that marker is the AUTHORITATIVE step index (all these events belong to
    // this one case's one template). Place by it directly. The old holder+order
    // match collapsed consecutive same-holder steps (va-desk's assign-vendor →
    // dispatch, lp-queue's invoice → pay → post) onto the first of them, stranding
    // a cascade short of its settlement; the marker disambiguates them cleanly.
    // A markerless event (legacy / off-catalog) still falls back to holder match.
    const n = Number(e.note?.match(/^Step (\d+)\//)?.[1]);
    const step =
      Number.isFinite(n) && n >= 1 && n <= tpl.steps.length
        ? tpl.steps[n - 1]
        : tpl.steps.find((s) => s.catalogRow === e.catalogRow && s.holder === e.holder);
    if (!step) continue;
    // The latest kind recorded against the step wins (a step is handed, then
    // answered; iterating in log order leaves the answer as its state).
    kindByStep.set(step.key, e.kind);
    noteByStep.set(step.key, e.note);
    actorByStep.set(step.key, e.actor);
    // FAILURES ACCUMULATE — they do not get overwritten by what came after.
    // Latest-kind is the wrong instrument for a failure precisely because the
    // engine always hands somewhere immediately afterwards, so the `failed`
    // record is never the latest thing said about the step. Counting is the
    // only way a rework loop leaves a mark.
    if (e.kind === 'failed') failsByStep.set(step.key, (failsByStep.get(step.key) ?? 0) + 1);
  }

  const daysSinceOpen = openedAt ? daysBetween(openedAt, now) : null;
  const daysSinceTarget = targetAt ? daysBetween(targetAt, now) : null;
  const steps: StepReading[] = tpl.steps.map((step, i) => {
    const after = step.edge.after ?? null;
    // EVERY OFFSET IS COUNTED FROM THE DATE ITS EDGE NAMES, not from the only
    // date the case happens to carry. Before `anchor` existed this read
    // `daysSinceOpen` for every step, which made the one step written against
    // the tenant's last day (`pre-inspection`, at T-14) permanently breached
    // from the moment it was handed. A step whose anchor date is unknown gets
    // NO due date and NO breach — unknown is not overdue, and a red flag
    // nobody can clear teaches its reader to stop looking at the column.
    const elapsed = (step.edge.anchor ?? 'opened') === 'target' ? daysSinceTarget : daysSinceOpen;
    const dueInDays = after == null || elapsed == null ? null : after - elapsed;
    const wait = step.slaDays ?? 0;
    // Only a step the cascade has actually reached can breach — a future step
    // not yet handed is not overdue, however far its calendar edge has slipped.
    const reached = kindByStep.has(step.key);
    const breached =
      reached &&
      elapsed != null &&
      after != null &&
      elapsed > after + wait &&
      kindByStep.get(step.key) !== 'done';
    return {
      step,
      index: i + 1,
      kind: kindByStep.get(step.key) ?? null,
      note: noteByStep.get(step.key),
      actor: actorByStep.get(step.key),
      dueInDays,
      breached,
      failures: failsByStep.get(step.key) ?? 0,
    };
  });

  // `failed` is deliberately NOT in this set. A failed step has not been
  // completed, so the cascade's head stays on it (or on whatever its `onFail`
  // handed) rather than walking past — treating a failure as progress is the
  // whole fault this path exists to close.
  const acted = new Set<EventKind>(['done', 'approved', 'overridden']);
  const next = steps.find((s) => s.kind == null || !acted.has(s.kind)) ?? null;
  const boards: { board: string; steps: StepReading[] }[] = [];
  for (const s of steps) {
    const b = boards.find((x) => x.board === s.step.board);
    if (b) b.steps.push(s);
    else boards.push({ board: s.step.board, steps: [s] });
  }

  return {
    caseId,
    template: tpl,
    subject: caseId.startsWith(`${tpl.key}: `) ? caseId.slice(tpl.key.length + 2) : caseId,
    openedAt,
    status: c.status,
    steps,
    next,
    breached: steps.filter((s) => s.breached),
    boards,
    advanced: steps.filter((s) => s.kind != null && acted.has(s.kind)).length,
    rework: steps.filter((s) => s.failures > 0).sort((a, b) => b.failures - a.failures),
    failures: steps.reduce((n, s) => n + s.failures, 0),
  };
}

/** Every live flow instance in the log: cases whose id opens with a known
 *  template key, folded against that template. */
export function readFlows(flows: FlowBook, log: KingdomEvent[], now: string): FlowReading[] {
  const caseIds = [...new Set(log.map((e) => e.caseId))];
  const readings: FlowReading[] = [];
  for (const caseId of caseIds) {
    const tpl = flows.find((f) => caseId.startsWith(`${f.key}: `));
    if (!tpl) continue;
    const r = readFlow(tpl, log, caseId, now);
    if (r) readings.push(r);
  }
  return readings.sort((a, b) => (b.openedAt ?? '').localeCompare(a.openedAt ?? ''));
}

/** True while the flows book still reads exactly as founded — the
 *  census-migration test for the new shelf (matches catalogAtFounding). */
export function flowsAtFounding(flows: FlowBook): boolean {
  return JSON.stringify(flows) === JSON.stringify(FOUNDING_FLOWS);
}
