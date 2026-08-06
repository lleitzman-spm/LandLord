// The event log — the living instrument's spine (see docs/KINGDOM.md, "The
// living instrument"). Ratified 2026-07-19: **events-only**. This append-only
// log is the SOLE record of the real work; a work item, a queue, who holds the
// ball, aging, a KPI are all *readings folded from it*, never stored state —
// the kingdom's oldest law (records in, readings out) reaching the operating
// model.
//
// A factory component: general and catalog-agnostic. LandLord provides the
// mechanism — an event references a catalog row by key, a case by id, a holder
// by id — and a factory setting loads the specific catalog, cases, and
// people. Nothing here names any real firm; that is the leash.

/** The kinds an event can carry: the core operational arc, plus the human-in-
 *  the-loop arc the clerk layer writes (proposed → awaiting → approved /
 *  overridden). Left open on purpose — a factory setting may name more, and the
 *  readings tolerate a kind they do not know rather than reject the record. */
export type EventKind =
  | 'opened' // a case begins
  | 'handed' // the ball moves to a holder
  | 'noted' // progress recorded, the ball unchanged
  | 'done' // the case is complete
  | 'proposed' // an agent proposes an act and waits on a human
  | 'awaiting' // parked on a human's judgment
  | 'approved' // a human ratified the proposal
  | 'overridden' // a human overrode the proposal
  // THE STEP DID NOT SUCCEED. Every kind above this line is a way forward: the
  // whole arc a case could record was one of success, so a step that could not
  // be completed had no word for itself and simply stopped — which reads, on
  // every board and every count, exactly like a step nobody has got to yet.
  // That is the silent-loss shape, and it is why this kind exists.
  //
  // WHAT IT IS NOT. It is not a taxonomy. There are no tiers here, no kinds of
  // wrongness, no severity — those wait until something real has been counted,
  // because a classification invented before the evidence is a guess wearing a
  // schema. `failed` says one thing: this step did not go through.
  //
  // WHERE THE CASE GOES NEXT is NOT recorded on the event. It is declared on
  // the step, as `onFail` (src/domain/flows.ts) — a route is a property of the
  // design, not of the incident, or every failure invents its own remedy at the
  // moment it is least able to think clearly.
  | 'failed';

export interface KingdomEvent {
  id: string;
  /** ISO timestamp — when it happened. The temporal truth; captured live,
   *  because history is perishable (a snapshot flattens cadence forever). */
  at: string;
  /** The case (work item) this event belongs to. Folding a case's events is
   *  the only way its state exists — there is no stored work item. */
  caseId: string;
  kind: EventKind;
  /** The catalog row this task is an instance of — the shared ontology, loaded
   *  per factory setting. Absent when no task-type applies. */
  catalogRow?: string;
  /** Who holds the ball as of this event (a person or a queue id). A later
   *  event moves it; the reading takes the latest that named one. */
  holder?: string;
  /** Who acted — a person or an agent id. */
  actor?: string;
  /** The human-legible line. */
  note?: string;
  /** A flow instance's letters — the `{token}` values a parameterized cascade
   *  renders from (`{ trade: 'HVAC', urgency: 'emergency' }`). Recorded on the
   *  `opened` event so ADVANCING the cascade (completeStep/approveStep/…) can
   *  recover them and render every later step's note, not just the first
   *  (WRIT-TASK-LANGUAGE, the carried-forward params-advance seam). Absent on
   *  ordinary events. */
  params?: Record<string, string>;
  /** The real property this case concerns — the stable estate slug from the
   *  chronicle's `estates` book (docs on `estate.ts`). Recorded on the `opened`
   *  event; the reading folds it forward like `holder`/`catalogRow`. Absent ⇒
   *  no per-estate cap/fee applies, so the spend gate reads the house cap
   *  exactly as before (byte-identical). Real slugs load attended, never here. */
  estateId?: string;
}

export type EventLog = KingdomEvent[];

export const EMPTY_LOG: EventLog = [];

// ── Readings ────────────────────────────────────────────────────────────────
// Everything below is folded fresh from the log on every call. Nothing is
// stored; if real volume ever makes the fold slow, the answer is a cache of
// these readings — never a second source of truth (KINGDOM.md, "Events-only").

export type CaseStatus = 'open' | 'awaiting' | 'done';

export interface CaseReading {
  caseId: string;
  status: CaseStatus;
  holder: string | null; // who has the ball now
  catalogRow: string | null; // the task-type, latest that named one
  estateId: string | null; // the real property this case concerns (slug), or null
  openedAt: string | null;
  lastAt: string | null; // last activity — the clock aging measures from
  events: KingdomEvent[]; // the fold, in time order: the drill-down itself
}

const byTime = (a: KingdomEvent, b: KingdomEvent): number =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : 0;

/** The latest value a field was given across a case's events, or null. */
function latest<K extends 'holder' | 'catalogRow' | 'estateId'>(
  events: KingdomEvent[],
  field: K,
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const v = events[i][field];
    if (v !== undefined) return v;
  }
  return null;
}

/** Status is what the last status-bearing event says: done wins, then the
 *  human-in-the-loop wait, else the case is open and moving. */
function statusOf(events: KingdomEvent[]): CaseStatus {
  const last = events[events.length - 1];
  if (!last) return 'open';
  if (last.kind === 'done') return 'done';
  if (last.kind === 'proposed' || last.kind === 'awaiting') return 'awaiting';
  return 'open';
}

/** Fold one case's events into its current reading. */
export function readCase(log: EventLog, caseId: string): CaseReading {
  const events = log.filter((e) => e.caseId === caseId).sort(byTime);
  const opened = events.find((e) => e.kind === 'opened');
  return {
    caseId,
    status: statusOf(events),
    holder: latest(events, 'holder'),
    catalogRow: latest(events, 'catalogRow'),
    estateId: latest(events, 'estateId'),
    openedAt: opened?.at ?? (events[0]?.at ?? null),
    lastAt: events.length ? events[events.length - 1].at : null,
    events,
  };
}

/** Every case in the log, folded, most-recently-active first. */
export function readCases(log: EventLog): CaseReading[] {
  const ids = [...new Set(log.map((e) => e.caseId))];
  return ids
    .map((id) => readCase(log, id))
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
}

export const UNHELD = '(unassigned)';

export interface Queue {
  holder: string;
  cases: CaseReading[];
}

/** Open cases grouped by who holds the ball — the queues. This is the Regent's
 *  desk generalized: the fullest queues, and the oldest cases within them, are
 *  the delegation debt of the real work. */
export function queues(log: EventLog): Queue[] {
  const byHolder = new Map<string, CaseReading[]>();
  for (const c of readCases(log)) {
    if (c.status === 'done') continue;
    const h = c.holder ?? UNHELD;
    const arr = byHolder.get(h);
    if (arr) arr.push(c);
    else byHolder.set(h, [c]);
  }
  return [...byHolder.entries()]
    .map(([holder, cases]) => ({ holder, cases }))
    .sort((a, b) => b.cases.length - a.cases.length);
}

/** Days a case has sat since its last activity — the aging reading. `now` is
 *  passed in, never read from the clock here, so readings stay pure. */
export function ageInDays(c: CaseReading, now: string): number | null {
  if (!c.lastAt) return null;
  const ms = Date.parse(now) - Date.parse(c.lastAt);
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

/** Cases parked on a human's judgment — where a clerk stops for the click.
 *  The surface the coming agent layer writes to and reads from. */
export function awaitingHuman(log: EventLog): CaseReading[] {
  return readCases(log).filter((c) => c.status === 'awaiting');
}

export interface CatalogBucket {
  catalogRow: string | null; // the task-type key, or null for untyped work
  cases: CaseReading[];
}

/** Open cases grouped by the task-type they are instances of — the "by task-
 *  type" reading. Catalog-agnostic on purpose: it groups by the raw key and
 *  leaves resolving key → title to whoever loaded the catalog (the leash). */
export function casesByCatalogRow(log: EventLog): CatalogBucket[] {
  const byRow = new Map<string | null, CaseReading[]>();
  for (const c of readCases(log)) {
    if (c.status === 'done') continue;
    const k = c.catalogRow ?? null;
    const arr = byRow.get(k);
    if (arr) arr.push(c);
    else byRow.set(k, [c]);
  }
  return [...byRow.entries()]
    .map(([catalogRow, cases]) => ({ catalogRow, cases }))
    .sort((a, b) => b.cases.length - a.cases.length);
}

export interface Outcomes {
  open: number; // cases not yet done
  awaiting: number; // parked on a human
  stuck: number; // open and idle at least `agedDays`
  doneRecently: number; // completed within `recentDays`
  oldestDays: number | null; // the most-aged open case
}

/** The outcomes on top of the drill-path — the state of the work at a glance,
 *  folded whole from the log. Setting-specific KPIs (occupancy, delinquency %,
 *  cycle time) plug in here once a factory setting and its data are loaded;
 *  these are the general ones any operating instrument can read. */
export function outcomes(
  log: EventLog,
  now: string,
  agedDays = 7,
  recentDays = 7,
): Outcomes {
  const cs = readCases(log);
  const open = cs.filter((c) => c.status !== 'done');
  const ages = open.map((c) => ageInDays(c, now) ?? 0);
  return {
    open: open.length,
    awaiting: cs.filter((c) => c.status === 'awaiting').length,
    stuck: ages.filter((d) => d >= agedDays).length,
    doneRecently: cs.filter(
      (c) => c.status === 'done' && c.lastAt != null && (ageInDays(c, now) ?? Infinity) <= recentDays,
    ).length,
    oldestDays: ages.length ? Math.max(...ages) : null,
  };
}

// ── The clerks' proposals — what the fleet parked for the Regent ──────────
//
// The reasoning clerks never act; they PROPOSE and stop (`proposed`, actor
// `agent:<seat>`), leaving the case awaiting a human. Those proposals used to
// be indistinguishable from every other awaiting case on the Ledger — a
// thousand rows deep, with no way to find what the fleet had just parked
// ("it's not clear where the actual proposals are" — Edwin, 2026-07-27). This
// is the reading that finds them. A reading like any other: nothing stored.

export interface ClerkProposal {
  caseId: string;
  /** The desk that proposed — the `<seat>` of `agent:<seat>`. */
  seat: string;
  /** What it proposes, in its own words. */
  note: string;
  at: string;
  catalogRow: string | null;
  /** True while the case still waits on a human — a ratified proposal is
   *  history, not a thing to answer. */
  awaiting: boolean;
}

/** Every proposal a clerk has parked, newest first. One per case: a case is
 *  answered once, so its LATEST clerk proposal is the one standing. */
export function clerkProposals(log: EventLog): ClerkProposal[] {
  const cases = new Map(readCases(log).map((c) => [c.caseId, c]));
  const latest = new Map<string, ClerkProposal>();
  for (const e of log) {
    if (e.kind !== 'proposed') continue;
    const actor = e.actor ?? '';
    if (!actor.startsWith('agent:')) continue;
    const prev = latest.get(e.caseId);
    if (prev && prev.at >= e.at) continue;
    const c = cases.get(e.caseId);
    latest.set(e.caseId, {
      caseId: e.caseId,
      seat: actor.slice('agent:'.length),
      note: e.note ?? '',
      at: e.at,
      catalogRow: e.catalogRow ?? c?.catalogRow ?? null,
      awaiting: c?.status === 'awaiting',
    });
  }
  return [...latest.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
}
