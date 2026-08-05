import { describe, it, expect } from 'vitest';
import {
  routeAgentEvents,
  takenAgentEventIds,
  SIGNALS,
  AGENT_EVENT_PARAM,
  type AgentEvent,
} from '../src/domain/agentIntake';
import { FOUNDING_FLOWS } from '../src/domain/flows';
import type { FlowBook } from '../src/domain/flows';
import type { KingdomEvent } from '../src/domain/events';

/** A deterministic id source, so a routed batch is comparable run to run. */
function ids() {
  let n = 0;
  return () => `t-${++n}`;
}

/** The founding book carries move-out-relay and vendor-dispatch; the library
 *  carries the rest. Tests that need a library flow declare a stub rather than
 *  loading the 300-row setting. */
const flows: FlowBook = [
  ...FOUNDING_FLOWS,
  {
    key: 'collections-ladder',
    title: 'Collections Ladder',
    trigger: 'Rent is unpaid past the grace period.',
    steps: [
      // A real FlowStep carries catalogRow/board/edge; a stub without them
      // crashes the reading, so the fixture matches the type rather than the
      // module bending to accept a half-built template.
      {
        key: 'assess-late',
        label: 'Confirm the balance and apply the late fee.',
        holder: 'lp-queue',
        catalogRow: 'work-order',
        board: 'Collections',
        edge: {},
      },
      {
        key: 'first-notice',
        label: 'Send a reminder.',
        holder: 'pm-desk',
        catalogRow: 'work-order',
        board: 'Collections',
        edge: {},
      },
    ],
  } as unknown as FlowBook[number],
];

const ev = (over: Partial<AgentEvent> = {}): AgentEvent => ({
  id: 'ae-1',
  at: '2026-07-28T10:00:00.000Z',
  kind: 'rent.delinquent',
  subject: 'd-14 · unit B',
  source: 'appfolio',
  ...over,
});

describe('agent intake — routing', () => {
  it('opens a case on the flow the signal names', () => {
    const r = routeAgentEvents([ev()], { flows, log: [], id: ids() });
    expect(r.skipped).toEqual([]);
    expect(r.opened).toHaveLength(1);
    expect(r.opened[0].flow).toBe('collections-ladder');
    expect(r.opened[0].caseId).toBe('collections-ladder: d-14 · unit B');
  });

  it('emits ONLY an opening and the hand to step one — never an approval or a completion', () => {
    const r = routeAgentEvents([ev()], { flows, log: [], id: ids() });
    const kinds = r.events.map((e) => e.kind);
    expect(kinds).toEqual(['opened', 'handed']);
    // rule 3: an outside signal cannot reach through and finish work or move money
    for (const forbidden of ['approved', 'done', 'overridden', 'proposed', 'paid']) {
      expect(kinds).not.toContain(forbidden);
    }
  });

  it('carries the originating event id onto the opening record', () => {
    const r = routeAgentEvents([ev({ id: 'ae-xyz' })], { flows, log: [], id: ids() });
    const opened = r.events.find((e) => e.kind === 'opened') as KingdomEvent;
    expect(opened.params?.[AGENT_EVENT_PARAM]).toBe('ae-xyz');
    expect(opened.params?.agentSource).toBe('appfolio');
  });

  it('threads the estate through so the spend gate reads a per-estate cap', () => {
    const r = routeAgentEvents([ev({ estateId: 'est-7' })], { flows, log: [], id: ids() });
    const opened = r.events.find((e) => e.kind === 'opened') as KingdomEvent;
    expect(opened.estateId).toBe('est-7');
  });
});

describe('agent intake — idempotency (the sensor polls, so it WILL redeliver)', () => {
  it('routing the same batch twice opens nothing the second time', () => {
    const first = routeAgentEvents([ev()], { flows, log: [], id: ids() });
    const second = routeAgentEvents([ev()], { flows, log: first.events, id: ids() });
    expect(second.events).toEqual([]);
    expect(second.opened).toEqual([]);
    expect(second.skipped[0].reason).toBe('already-taken');
  });

  it('a batch that repeats an id inside itself opens one case, not two', () => {
    const r = routeAgentEvents([ev(), ev()], { flows, log: [], id: ids() });
    expect(r.opened).toHaveLength(1);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe('already-taken');
  });

  it('reads taken ids straight out of the log, so no side index can drift', () => {
    const r = routeAgentEvents([ev({ id: 'ae-9' })], { flows, log: [], id: ids() });
    expect(takenAgentEventIds(r.events).has('ae-9')).toBe(true);
  });

  it('distinct signals on the same subject open distinct cases', () => {
    const r = routeAgentEvents([ev({ id: 'a' }), ev({ id: 'b', kind: 'workorder.created' })], {
      flows,
      log: [],
      id: ids(),
    });
    expect(r.opened).toHaveLength(2);
  });

  // The defect a live batch found: dedupe by event id alone is NOT enough. A
  // poll-and-diff sensor re-observes the same condition every cycle with a
  // FRESH id, so these arrive forever and would each open the same caseId.
  it('a re-observed condition with a NEW id does not open a second case', () => {
    const first = routeAgentEvents([ev({ id: 'poll-1' })], { flows, log: [], id: ids() });
    const second = routeAgentEvents([ev({ id: 'poll-2' })], { flows, log: first.events, id: ids() });
    expect(second.events).toEqual([]);
    expect(second.skipped[0].reason).toBe('already-open');
  });

  it('two fresh ids for the same condition in ONE batch open exactly one case', () => {
    const r = routeAgentEvents([ev({ id: 'p1' }), ev({ id: 'p2' })], { flows, log: [], id: ids() });
    expect(r.opened).toHaveLength(1);
    expect(r.skipped.map((s) => s.reason)).toEqual(['already-open']);
    expect(r.events.filter((e) => e.kind === 'opened')).toHaveLength(1);
  });

  // There is no `closed` event kind — a case is finished when every step of its
  // template is done. The stub collections flow has two steps.
  it('once every step is done, the condition may open a fresh case', () => {
    const first = routeAgentEvents([ev({ id: 'p1' })], { flows, log: [], id: ids() });
    const caseId = first.opened[0].caseId;
    const done = (n: number): KingdomEvent => ({
      id: `d-${n}`,
      at: '2026-07-28T12:00:00.000Z',
      caseId,
      kind: 'done',
    });
    const halfway = [...first.events, done(1)];
    expect(routeAgentEvents([ev({ id: 'p2' })], { flows, log: halfway, id: ids() }).opened).toHaveLength(0);

    const finished = [...halfway, done(2)];
    expect(routeAgentEvents([ev({ id: 'p3' })], { flows, log: finished, id: ids() }).opened).toHaveLength(1);
  });
});

describe('agent intake — nothing is invented', () => {
  it('skips a signal it has never agreed on, and says so', () => {
    const r = routeAgentEvents([ev({ kind: 'tenant.mood.declining' })], { flows, log: [], id: ids() });
    expect(r.events).toEqual([]);
    expect(r.skipped[0].reason).toBe('unknown-signal');
    expect(r.skipped[0].detail).toContain('tenant.mood.declining');
  });

  it('skips a known signal whose flow this chronicle does not carry', () => {
    const bare: FlowBook = FOUNDING_FLOWS.filter((f) => f.key !== 'vendor-dispatch');
    const r = routeAgentEvents([ev({ kind: 'workorder.created' })], { flows: bare, log: [], id: ids() });
    expect(r.events).toEqual([]);
    expect(r.skipped[0].reason).toBe('no-such-flow');
  });

  it('skips a malformed row rather than opening a case with a hole in it', () => {
    const r = routeAgentEvents(
      [{ id: 'x', at: '', kind: 'rent.delinquent', subject: '' } as AgentEvent],
      { flows, log: [], id: ids() },
    );
    expect(r.skipped[0].reason).toBe('malformed');
  });

  it('routes the good rows in a batch and skips only the bad', () => {
    const r = routeAgentEvents(
      [ev({ id: 'ok' }), ev({ id: 'bad', kind: 'nope.nope' }), ev({ id: 'ok2', kind: 'workorder.created' })],
      { flows, log: [], id: ids() },
    );
    expect(r.opened.map((o) => o.agentEventId)).toEqual(['ok', 'ok2']);
    expect(r.skipped.map((s) => s.id)).toEqual(['bad']);
  });
});

describe('agent intake — the data gate', () => {
  it('drops non-string params, which is how a nested record would arrive', () => {
    const r = routeAgentEvents(
      [ev({ params: { trade: 'plumbing', tenant: { ssn: '000-00-0000' } } as never })],
      { flows, log: [], id: ids() },
    );
    const opened = r.events.find((e) => e.kind === 'opened') as KingdomEvent;
    expect(opened.params?.trade).toBe('plumbing');
    expect(opened.params?.tenant).toBeUndefined();
    expect(JSON.stringify(opened)).not.toContain('000-00-0000');
  });

  // The hole a live run found: dropping non-strings is not enough, because a
  // STRING carries an identifier just as easily — and the chronicle is a
  // permanent record that syncs to the vault, so PII there is worse than PII
  // in a prompt.
  it('refuses a row whose string params carry an identifier', () => {
    const r = routeAgentEvents(
      [ev({ params: { note: 'resident ssn 123-45-6789 called about a plan' } })],
      { flows, log: [], id: ids() },
    );
    expect(r.opened).toEqual([]);
    expect(r.skipped[0].reason).toBe('identity-in-payload');
    expect(JSON.stringify(r)).not.toContain('123-45-6789');
  });

  it('refuses a row whose SUBJECT carries an identifier', () => {
    const r = routeAgentEvents([ev({ subject: 'bob@example.com' })], { flows, log: [], id: ids() });
    expect(r.opened).toEqual([]);
    expect(r.skipped[0].reason).toBe('identity-in-payload');
  });

  it('still routes ordinary rows — the scan must not fire on real work', () => {
    const r = routeAgentEvents(
      [ev({ params: { monthsBehind: '3', trade: 'plumbing' } })],
      { flows, log: [], id: ids() },
    );
    expect(r.opened).toHaveLength(1);
  });

  it('routes the over-limit spend signal a firm asked for', () => {
    const withApproval: FlowBook = [
      ...flows,
      { key: 'owner-approval-for-spend', title: 'Owner Approval for Spend', trigger: 'A spend needs the owner.',
        steps: [{ key: 'prepare-request', label: 'Prepare the ask.', holder: 'mabel',
                  catalogRow: 'work-order', board: 'Owner', edge: {} }] } as unknown as FlowBook[number],
    ];
    const r = routeAgentEvents(
      [ev({ kind: 'spend.over-limit', subject: 'd-8 · WO-2211', params: { amount: '1450' } })],
      { flows: withApproval, log: [], id: ids() },
    );
    expect(r.opened[0].flow).toBe('owner-approval-for-spend');
  });

  it('every agreed signal names a flow and a reason — no silent entries', () => {
    for (const [kind, sig] of Object.entries(SIGNALS)) {
      expect(sig.flow, kind).toBeTruthy();
      expect(sig.why, kind).toBeTruthy();
    }
  });
});
