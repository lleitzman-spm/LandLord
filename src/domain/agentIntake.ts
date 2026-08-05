/**
 * The agent-event intake — the door a firm's sensors knock on.
 *
 * The cooperation pact (a producer's own
 * LANDLORD-COOPERATION.md) settles the division: **one orchestrator, and it is
 * LandLord's fleet loop.** a producer builds a deterministic poll-and-diff sensor over
 * AppFolio with read-only credentials and writes what it saw to an `agent_event`
 * table; it explicitly "owes an event schema, not a runtime". This module is
 * the other half of that seam — the translation from *a thing happened out
 * there* into *a case standing on a seat in here*, which the clerk fleet then
 * works exactly as it works a simulated one.
 *
 * It is PURE: events in, events out, no I/O. The caller owns reading the table
 * and appending the result (CAS on the Worker, appendEvents in the harness), so
 * the same routing runs in a test, in the harness, and behind the wall.
 *
 * FOUR RULES, and they are the reason this is a module and not three lines at
 * a call site:
 *
 *  1 · NOTHING IS INVENTED. An unrecognised `kind`, a flow the chronicle does
 *      not carry, a missing subject — each is SKIPPED with a stated reason and
 *      reported back. A sensor that starts emitting a signal we have never
 *      agreed on must not silently open cases of a guessed shape.
 *  2 · IDEMPOTENT BY CONSTRUCTION. AppFolio is poll-only, so the sensor
 *      re-reads the same rows forever and WILL re-deliver. Every case carries
 *      the originating event id, and an id already in the log is skipped. Two
 *      passes over the same batch produce the same chronicle.
 *  3 · IT OPENS WORK; IT NEVER FINISHES IT. The only events emitted are
 *      `opened` and the hand to step one. No approval, no completion, no money
 *      — an outside signal cannot reach through this door and move a dollar.
 *      The clerk still proposes and a human still approves.
 *  4 · IT CARRIES REFERENCES, NOT PEOPLE. The subject is a reference the sensor
 *      already holds (a door id, a case number). This module never accepts a
 *      free-text blob of tenant detail into the chronicle, because the
 *      chronicle is a product other people run and the repo split is what
 *      enforces the data gate. Anything richer belongs behind a firm's boundary.
 */

import type { KingdomEvent } from './events';
import type { FlowBook, FlowParams } from './flows';
import { instantiateFlow } from './flows';
import { findPersistentIdentity } from './contextGuard';

/** The row shape LandLord requires of a firm's `agent_event` table. Anything more
 *  the sensor wants to record is its business; these are the fields the intake
 *  cannot route without. */
export interface AgentEvent {
  /** Stable, unique, and STABLE ACROSS REDELIVERY — this is the idempotency
   *  key. A sensor that mints a fresh id for a re-observed fact defeats rule 2
   *  and will open duplicate cases. */
  id: string;
  /** ISO timestamp — when the sensor OBSERVED it. */
  at: string;
  /** The signal, in the agreed vocabulary (see SIGNALS). */
  kind: string;
  /** What it concerns, as a reference the sensor already holds — a door id, a
   *  unit label, a work-order number. Not a person, not a narrative. */
  subject: string;
  /** The source system, for the record. */
  source?: string;
  /** Signal-specific letters, rendered into the flow's own words. Strings only:
   *  the chronicle's params are `Record<string, string>` and a nested blob is
   *  how PII arrives by accident. */
  params?: FlowParams;
  /** The property this concerns, if the sensor knows it — lets the spend gate
   *  read a per-estate cap rather than falling back to the house cap. */
  estateId?: string;
}

/** The agreed vocabulary: signal → the flow it opens. Adding a line here is the
 *  ONLY way a new signal becomes routable, which is rule 1 made structural.
 *  Keys are LandLord flow keys and must exist in the chronicle's flow book;
 *  where a flow is missing the signal is skipped rather than guessed at. */
export const SIGNALS: Record<string, { flow: string; why: string }> = {
  'rent.delinquent': { flow: 'collections-ladder', why: 'rent unpaid past the grace period' },
  'workorder.created': { flow: 'vendor-dispatch', why: 'a work order was raised' },
  'workorder.emergency': { flow: 'emergency-response', why: 'an after-hours emergency was raised' },
  'lease.expiring': { flow: 'lease-renewal', why: 'a lease is inside its renewal window' },
  'lease.violation': { flow: 'lease-violation', why: 'a lease breach was reported' },
  'notice.to-vacate': { flow: 'move-out-relay', why: 'a resident gave notice' },
  'unit.vacant': { flow: 'make-ready-turn', why: 'a unit came empty and needs turning' },
  'owner.inquiry': { flow: 'owner-acquisition', why: 'a prospective owner made contact' },
  'application.received': { flow: 'application-screening', why: 'a rental application arrived' },
  // Over-limit spend is the commonest reason a work order stalls waiting on a
  // human, so the sensor gets its own signal rather than being folded into the
  // generic work-order kind. The flow already existed, so this is one line
  // rather than a build.
  'spend.over-limit': { flow: 'owner-approval-for-spend', why: 'a spend exceeds the owner\'s standing limit' },
};

/** Why a row did not become a case. Reported, never swallowed. */
export interface SkippedEvent {
  id: string;
  kind: string;
  reason:
    | 'unknown-signal'
    | 'no-such-flow'
    | 'already-taken'
    | 'already-open'
    | 'malformed'
    | 'identity-in-payload';
  detail: string;
}

export interface IntakeResult {
  /** Chronicle events to append — `opened` + the hand to step one, nothing more. */
  events: KingdomEvent[];
  /** caseId per routed agent-event id, so the caller can report what it opened. */
  opened: { agentEventId: string; caseId: string; flow: string }[];
  skipped: SkippedEvent[];
}

/** The param key carrying the originating agent-event id. It rides on the
 *  `opened` event, which makes the log itself the dedupe index — no side table
 *  to keep in step, and a restored-from-backup chronicle stays idempotent. */
export const AGENT_EVENT_PARAM = 'agentEventId';

/** Every agent-event id the chronicle has already taken. */
export function takenAgentEventIds(log: KingdomEvent[]): Set<string> {
  const seen = new Set<string>();
  for (const e of log) {
    if (e.kind !== 'opened') continue;
    const id = e.params?.[AGENT_EVENT_PARAM];
    if (id) seen.add(id);
  }
  return seen;
}

/**
 * Route a batch of sensor events into chronicle events.
 *
 * `id` is injected so callers stay deterministic in tests and unique in
 * production — the same seam `instantiateFlow` already uses.
 */
export function routeAgentEvents(
  batch: AgentEvent[],
  ctx: { flows: FlowBook; log: KingdomEvent[]; id: () => string },
): IntakeResult {
  const events: KingdomEvent[] = [];
  const opened: IntakeResult['opened'] = [];
  const skipped: SkippedEvent[] = [];

  const taken = takenAgentEventIds(ctx.log);
  const byKey = new Map(ctx.flows.map((f) => [f.key, f]));

  // Cases already standing. Dedupe by event id is NOT enough: a poll-and-diff
  // sensor re-observes the same condition every cycle and mints a NEW id each
  // time, so "rent is late on d-14" arrives forever with ids that have never
  // been seen. Without this, one late tenant grows an unbounded pile of
  // openings on a single caseId and the fold reads nonsense. Found by running
  // a batch, not by reasoning about one.
  // There is no `closed` event kind — a case is finished when every step of its
  // template has been done. So count the dones and compare against the flow's
  // length; a case still short of its last step is standing.
  const openedAt = new Set<string>();
  const doneCount = new Map<string, number>();
  for (const e of ctx.log) {
    if (e.kind === 'opened') openedAt.add(e.caseId);
    else if (e.kind === 'done') doneCount.set(e.caseId, (doneCount.get(e.caseId) ?? 0) + 1);
  }
  const stepsOf = (caseId: string) => {
    const key = caseId.slice(0, caseId.indexOf(':'));
    return ctx.flows.find((f) => f.key === key)?.steps.length ?? Infinity;
  };
  const openCases = new Set<string>(
    [...openedAt].filter((c) => (doneCount.get(c) ?? 0) < stepsOf(c)),
  );

  for (const ev of batch) {
    if (!ev?.id || !ev.kind || !ev.subject || !ev.at) {
      skipped.push({
        id: ev?.id ?? '(no id)',
        kind: ev?.kind ?? '(none)',
        reason: 'malformed',
        detail: 'an agent event needs id, at, kind and subject',
      });
      continue;
    }
    if (taken.has(ev.id)) {
      skipped.push({ id: ev.id, kind: ev.kind, reason: 'already-taken', detail: 'already opened a case' });
      continue;
    }
    const signal = SIGNALS[ev.kind];
    if (!signal) {
      skipped.push({
        id: ev.id,
        kind: ev.kind,
        reason: 'unknown-signal',
        detail: `no agreed routing for "${ev.kind}" — add it to SIGNALS deliberately`,
      });
      continue;
    }
    const tpl = byKey.get(signal.flow);
    if (!tpl) {
      skipped.push({
        id: ev.id,
        kind: ev.kind,
        reason: 'no-such-flow',
        detail: `this chronicle carries no "${signal.flow}" flow`,
      });
      continue;
    }

    // The case this signal would open. If one is already standing, the signal
    // is a re-observation of a condition we are already working, not new work.
    const caseId = `${tpl.key}: ${ev.subject.trim()}`;
    if (openCases.has(caseId)) {
      skipped.push({
        id: ev.id,
        kind: ev.kind,
        reason: 'already-open',
        detail: `"${caseId}" is already standing — re-observed, not new work`,
      });
      // Still mark the event consumed, so it is not reconsidered every poll.
      taken.add(ev.id);
      continue;
    }

    // Strings only — a nested object is how a tenant record arrives by mistake.
    const clean: FlowParams = {};
    for (const [k, v] of Object.entries(ev.params ?? {})) {
      if (typeof v === 'string') clean[k] = v;
    }

    // ...but a STRING can carry an identifier just as easily, and that was the
    // real hole: dropping non-strings let `note: "resident ssn 123-45-6789"`
    // walk into the chronicle, which is a permanent record that syncs to the
    // vault and ships in a product other people run. PII in the log is worse
    // than PII in a prompt — a prompt is forgotten, a record is not.
    //
    // Fails CLOSED, and skips the whole row rather than scrubbing it: a scrubbed
    // case is one whose evidence we silently altered, and the emitter needs to
    // learn it is emitting this. The finding masks the value so the skip report
    // itself does not leak it.
    const leaks = Object.entries(clean).flatMap(([k, v]) =>
      findPersistentIdentity(v, `params.${k}`),
    );
    const subjectLeaks = findPersistentIdentity(ev.subject, 'subject');
    if (leaks.length || subjectLeaks.length) {
      const all = [...subjectLeaks, ...leaks];
      skipped.push({
        id: ev.id,
        kind: ev.kind,
        reason: 'identity-in-payload',
        detail: `carries ${all.map((f) => `${f.kind} in ${f.where} (${f.masked})`).join('; ')} — references only`,
      });
      taken.add(ev.id);
      continue;
    }
    clean[AGENT_EVENT_PARAM] = ev.id;
    if (ev.source) clean.agentSource = ev.source;

    const inst = instantiateFlow(
      tpl,
      ev.subject,
      { at: ev.at, id: ctx.id, ...(ev.estateId ? { estateId: ev.estateId } : {}) },
      clean,
    );
    events.push(...inst.events);
    opened.push({ agentEventId: ev.id, caseId: inst.caseId, flow: signal.flow });
    // Guard within the batch too: a repeated id, and a second signal that would
    // land on the case this one just opened.
    taken.add(ev.id);
    openCases.add(inst.caseId);
  }

  return { events, opened, skipped };
}
