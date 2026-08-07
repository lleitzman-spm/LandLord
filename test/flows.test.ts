import { describe, it, expect } from 'vitest';
import {
  FOUNDING_FLOWS,
  instantiateFlow,
  completeStep,
  approveStep,
  overrideStep,
  proposeStep,
  awaitsOutside,
  mayRunUnattended,
  readFlow,
  fullParams,
} from '../src/domain/flows';
import { FOUNDING_CATALOG } from '../src/domain/catalog';
import type { KingdomEvent } from '../src/domain/events';
import { readCase } from '../src/domain/events';

/** Drive a template's cascade to completion: open it, then close every step in
 *  order (completeStep forces `done`, bypassing the awaiting waits). Returns the
 *  full event log. */
function workToDone(tplKey: string) {
  const tpl = FOUNDING_FLOWS.find((f) => f.key === tplKey);
  if (!tpl) throw new Error(`no flow template ${tplKey}`);
  const params = fullParams(tpl, { trade: 'HVAC', urgency: 'emergency' });
  let n = 0;
  const id = () => `t-${++n}`;
  const at = '2026-07-01T00:00:00.000Z';
  const inst = instantiateFlow(tpl, 'Unit 4B — burst pipe', { at, id }, params);
  const log: KingdomEvent[] = [...inst.events];
  for (let i = 0; i < tpl.steps.length; i++) {
    log.push(...completeStep(tpl, inst.caseId, i, { at, id }, params));
  }
  return { tpl, log, caseId: inst.caseId };
}

describe('flows — readFlow marker-fold (R3: no stranded cascade)', () => {
  it('a fully-worked vendor-dispatch folds to done and reaches settlement', () => {
    const { tpl, log, caseId } = workToDone('vendor-dispatch');
    const r = readFlow(tpl, log, caseId, '2026-07-30T00:00:00.000Z');
    expect(r, 'readFlow returned null').not.toBeNull();
    expect(r!.status).toBe('done');
    expect(r!.next).toBeNull();
    // The whole cascade advanced — not collapsed onto an early same-holder step
    // (the fold bug that stranded settlement). Every step reads a terminal kind.
    expect(r!.advanced).toBe(tpl.steps.length);
    const last = r!.steps[r!.steps.length - 1];
    expect(last.kind).toBe('done');
  });

  it('no step note leaks a literal {token} when rendered with full params', () => {
    const { tpl, log, caseId } = workToDone('vendor-dispatch');
    const r = readFlow(tpl, log, caseId, '2026-07-30T00:00:00.000Z')!;
    for (const s of r.steps) {
      if (s.note) expect(s.note, `note leaked a token: ${s.note}`).not.toMatch(/\{\w+\}/);
    }
  });

  it('the move-out relay also folds clean to done', () => {
    const { tpl, log, caseId } = workToDone('move-out-relay');
    const r = readFlow(tpl, log, caseId, '2026-09-01T00:00:00.000Z')!;
    expect(r.status).toBe('done');
    expect(r.advanced).toBe(tpl.steps.length);
  });
});

// ── Ratifying the LAST step must CLOSE the case ─────────────────────────────
// These two functions claimed in their own comments that a final approval or
// override "closes the case", and nothing implemented it: `statusOf` closes on
// a `done` event and nothing else, so a cascade walked to its end stayed OPEN
// forever, reported no next step, and therefore offered no act anywhere in the
// app. Work that could be finished and never completed. (Driven to 8/8 in a
// browser by an audit, 2026-07-27.)
describe('the end of a cascade', () => {
  const tpl = FOUNDING_FLOWS[0];
  const AT = '2026-07-27T00:00:00.000Z';

  /** A case standing with `index` PROPOSED and so awaiting the human's word —
   *  the realistic shape, since a clerk parks a proposal and a person ratifies
   *  it. These tests used to approve against an EMPTY log, which the
   *  ratification guard now refuses outright (and rightly: a step nobody has
   *  reached is not a step anybody may ratify). */
  const parked = (caseId: string, index: number) => {
    let i = 0;
    const inst = instantiateFlow(tpl, caseId, { at: AT, id: () => `s${caseId}${i++}` });
    const proposal = proposeStep(tpl, inst.caseId, index, 'agent:test', {
      at: AT,
      id: () => `p${caseId}${i++}`,
    });
    return { caseId: inst.caseId, log: [...inst.events, ...(proposal ? [proposal] : [])] };
  };
  const opts = (n: number, log: KingdomEvent[]) => ({
    at: '2026-07-27T01:00:00.000Z',
    id: () => `e${n}`,
    log,
  });

  it('approving the final step records that the case is DONE', () => {
    const last = tpl.steps.length - 1;
    const c = parked('c1', last);
    const evs = approveStep(tpl, c.caseId, last, opts(1, c.log));
    expect(evs.map((e) => e.kind)).toEqual(['approved', 'done']);
  });

  it('overruling the final step closes it too', () => {
    const last = tpl.steps.length - 1;
    const c = parked('c2', last);
    const evs = overrideStep(tpl, c.caseId, last, opts(2, c.log));
    expect(evs.map((e) => e.kind)).toEqual(['overridden', 'done']);
  });

  it('a MIDDLE step hands on and closes NOTHING', () => {
    const c = parked('c3', 0);
    const evs = approveStep(tpl, c.caseId, 0, opts(3, c.log));
    expect(evs[0].kind).toBe('approved');
    expect(evs).toHaveLength(2); // the next step is handed (or set awaiting)
    expect(evs.some((e) => e.kind === 'done')).toBe(false);
  });

  it('the case READS as done once the last step is ratified', () => {
    // The whole point: the reading has to change, or the Ledger still shows an
    // open case with no act on it.
    const last = tpl.steps.length - 1;
    const c = parked('c4', last);
    const log = [...c.log, ...approveStep(tpl, c.caseId, last, opts(4, c.log))];
    expect(readCase(log, c.caseId).status).toBe('done');
  });
});

// ── THE RATIFICATION GUARD — the first runtime refusal ──────────────────────
// Until 2026-08-07 the only thing between a script and a ratification was a JSX
// render condition in the Ledger (docs/WRIT-THE-GATE.md, finding 5): it hid a
// button, and `approveStep` agreed to anything else it was asked. These tests
// exist so the guard cannot quietly become a costume again.
describe('a ratification is refused unless the step actually awaits one', () => {
  const tpl = FOUNDING_FLOWS[0];
  const AT = '2026-07-27T01:00:00.000Z';
  const opts = (log: KingdomEvent[]) => ({ at: AT, id: () => 'x', log });

  const opened = (caseId: string) => {
    let i = 0;
    return instantiateFlow(tpl, caseId, { at: '2026-07-27T00:00:00.000Z', id: () => `o${i++}` });
  };

  it('REFUSES a step nobody has reached', () => {
    // The case is open, but the last step has never been handed to anyone.
    const inst = opened('g1');
    const last = tpl.steps.length - 1;
    expect(approveStep(tpl, inst.caseId, last, opts(inst.events))).toEqual([]);
    expect(overrideStep(tpl, inst.caseId, last, opts(inst.events))).toEqual([]);
  });

  it('REFUSES a case it cannot see at all — it fails CLOSED', () => {
    // An empty log is not permission; it is an absence of evidence.
    expect(approveStep(tpl, 'no-such-case', 0, opts([]))).toEqual([]);
    expect(overrideStep(tpl, 'no-such-case', 0, opts([]))).toEqual([]);
  });

  it('REFUSES to ratify the same step twice', () => {
    // The double-click / replay case. The second act must leave no record —
    // this is the one an air gap would never have caught, because both calls
    // come from a legitimate hand.
    const inst = opened('g2');
    const proposal = proposeStep(tpl, inst.caseId, 0, 'agent:test', { at: AT, id: () => 'p' });
    const log = [...inst.events, ...(proposal ? [proposal] : [])];
    const first = approveStep(tpl, inst.caseId, 0, opts(log));
    expect(first.length).toBeGreaterThan(0);
    expect(approveStep(tpl, inst.caseId, 0, opts([...log, ...first]))).toEqual([]);
  });

  it('REFUSES an out-of-range step', () => {
    const inst = opened('g3');
    expect(approveStep(tpl, inst.caseId, -1, opts(inst.events))).toEqual([]);
    expect(approveStep(tpl, inst.caseId, 999, opts(inst.events))).toEqual([]);
  });

  it('ALLOWS the step that genuinely waits — the guard is not a wall', () => {
    // A guard that refuses everything passes every refusal test and ships a
    // dead app. This is the other half of the claim.
    const inst = opened('g4');
    const proposal = proposeStep(tpl, inst.caseId, 0, 'agent:test', { at: AT, id: () => 'p' });
    const log = [...inst.events, ...(proposal ? [proposal] : [])];
    expect(approveStep(tpl, inst.caseId, 0, opts(log))[0].kind).toBe('approved');
    expect(overrideStep(tpl, inst.caseId, 0, opts(log))[0].kind).toBe('overridden');
  });
});

describe('flows — a timing edge is counted from the date it names (the anchor)', () => {
  // WHY THIS SUITE EXISTS. `readFlow` measured every day-offset forward from the
  // day the case OPENED, because that is the only date a case carries. But
  // `pre-inspection` on the move-out relay is written `{ after: -14, before: -7 }`
  // — "between fourteen and seven days before the tenant LEAVES". Read against the
  // open date, `after: -14` claims the step was due a fortnight before the case
  // existed, so `elapsed > after + wait` was true the moment it was handed. Every
  // move-out case in the system carried a step marked BREACHED from day zero,
  // permanently, with nothing anyone could do to clear it.
  //
  // A red flag that cannot be cleared is worse than no flag: it teaches its reader
  // to ignore the column, and that column is how a real breach gets noticed.
  const tpl = FOUNDING_FLOWS.find((f) => f.key === 'move-out-relay')!;
  const OPEN = '2026-08-06T09:00:00.000Z';

  /** Open a case and hand the first few steps, so the cascade has REACHED the
   *  step under test — an unreached step can never breach, which would make this
   *  suite pass for the wrong reason. */
  function opened(n = 4) {
    const log: KingdomEvent[] = [{ id: 'e0', at: OPEN, caseId: 'C1', kind: 'opened' }];
    tpl.steps.slice(0, n).forEach((s, i) =>
      log.push({
        id: `e${i + 1}`,
        at: OPEN,
        caseId: 'C1',
        kind: 'handed',
        catalogRow: s.catalogRow,
        holder: s.holder,
      }),
    );
    return log;
  }
  const preInspection = (r: ReturnType<typeof readFlow>) =>
    r!.steps.find((s) => s.step.key === 'pre-inspection')!;

  it('the step IS anchored to the target date, not left to default', () => {
    // Guards the data, not the engine: drop the anchor from the step and the
    // engine silently goes back to measuring it from the open date.
    expect(tpl.steps.find((s) => s.key === 'pre-inspection')!.edge.anchor).toBe('target');
  });

  it('a target-anchored step with NO target date is unknown, never overdue', () => {
    const s = preInspection(readFlow(tpl, opened(), 'C1', OPEN));
    expect(s.dueInDays, 'no anchor date can yield no due date').toBeNull();
    expect(s.breached, 'unknown is not overdue — this is the regression').toBe(false);
  });

  it('with a target date ahead, it is due relative to THAT date', () => {
    // Tenant leaves in 30 days; the step is due at T-14, so 16 days out.
    const r = readFlow(tpl, opened(), 'C1', OPEN, '2026-09-05T09:00:00.000Z');
    const s = preInspection(r);
    expect(s.dueInDays).toBe(16);
    expect(s.breached).toBe(false);
  });

  it('with the target date past, it breaches like any other step', () => {
    // The fix must not make the step unbreachable — that would trade a false
    // red for a false green, which is the worse of the two.
    const r = readFlow(tpl, opened(), 'C1', OPEN, '2026-07-17T09:00:00.000Z');
    expect(preInspection(r).breached).toBe(true);
  });

  it('every other step still counts from the open date, unchanged', () => {
    const r = readFlow(tpl, opened(), 'C1', OPEN);
    const confirm = r!.steps.find((s) => s.step.key === 'confirm-date')!;
    expect(confirm.dueInDays).toBe(1);
    expect(confirm.breached).toBe(false);
  });
});

// ── THE AUTOMATION GATE — may a clerk run this step with no human in it? ────
// Two conditions, and the second one is the one that had to be discovered:
// the book must SAY the step needs no person (`mode: 'auto'`), AND the step must
// not depend on anything the machine cannot see. Before 2026-08-07 the fleet
// proposed every `auto` step to a human anyway, booking an unplanned escape
// against the one number the product is judged by (docs/WRIT-THE-GATE.md).
describe('the automation gate', () => {
  const modeOf = new Map(FOUNDING_CATALOG.map((r) => [r.key, r.mode]));
  const step = (flow: string, key: string) =>
    FOUNDING_FLOWS.find((f) => f.key === flow)!.steps.find((s) => s.key === key)!;

  it('a DEADLINE is not a dependency — an SLA step still runs unattended', () => {
    // THE finding. `stepWaits` answers "does this step park?" and says yes for an
    // slaDays — but a step due in two days is exactly a step a machine should do
    // NOW. Reusing that predicate as the guard was measured at 1 of 13 auto steps
    // runnable instead of 8: the guard would have cancelled the feature it was
    // protecting, and every test of the guard alone would still have passed.
    const s = step('lease-renewal', 'draft-offer');
    expect(s.slaDays ?? s.edge.after).not.toBeUndefined();
    expect(awaitsOutside(s)).toBe(false);
    expect(mayRunUnattended(s, modeOf)).toBe(true);
  });

  it('a step waiting on an OUTSIDE answer never runs unattended', () => {
    // A free-text condition is something the machine cannot observe. It may not
    // assert it, whatever the catalog says about the row.
    const s = step('lease-renewal', 'tenant-response');
    expect(s.condition).toBeDefined();
    expect(awaitsOutside(s)).toBe(true);
    expect(mayRunUnattended(s, modeOf)).toBe(false);
  });

  it('a chase LOOP never runs unattended', () => {
    const s = step('move-out-relay', 'weekly-price-drop');
    expect(s.repeatEveryDays).toBeDefined();
    expect(mayRunUnattended(s, modeOf)).toBe(false);
  });

  it('a HUMAN step never runs unattended, however simple it looks', () => {
    const s = step('lease-renewal', 'countersign');
    expect(modeOf.get(s.catalogRow)).toBe('human');
    expect(mayRunUnattended(s, modeOf)).toBe(false);
  });

  it("the owner's window is BOTH human and outside-waiting — belt and braces", () => {
    // The step that would have auto-approved spending an owner's money on their
    // silence. It is now barred twice over, on purpose: flip either guard back
    // by accident and the other still holds.
    const s = step('lease-renewal', 'owner-window');
    expect(s.condition).not.toMatch(/silence/i);
    expect(modeOf.get(s.catalogRow)).toBe('human');
    expect(awaitsOutside(s)).toBe(true);
    expect(mayRunUnattended(s, modeOf)).toBe(false);
  });

  it('no step in the whole book that waits on the outside may run unattended', () => {
    // The property, stated over the entire book rather than by example.
    for (const f of FOUNDING_FLOWS)
      for (const s of f.steps)
        if (awaitsOutside(s)) expect(mayRunUnattended(s, modeOf)).toBe(false);
  });

  it('and the gate opens for a real, useful number of steps', () => {
    // A guard that refuses everything passes every test above and ships nothing.
    const open = FOUNDING_FLOWS.flatMap((f) => f.steps).filter((s) => mayRunUnattended(s, modeOf));
    // 13 since the operator's ruling of 2026-08-07: five vendor-dispatch steps
    // gained their own `mode` and were ruled the machine's. It was 8 while all
    // eight of that flow's steps inherited one row's single `human` verdict.
    expect(open.length).toBe(13);
  });

  it('a step may carry its OWN verdict, overriding the row it shares', () => {
    // The mechanism the re-cut needed. `mode` on the catalog ROW is right for a
    // task TYPE and wrong for a step: eight vendor-dispatch steps are all
    // legitimately `work-order` tasks, so one row governed logging a complaint
    // AND committing an owner's money with a single verdict. The book could not
    // say they differ. Now it can.
    const rows = new Map([['work-order', 'human' as const]]);
    const base = { catalogRow: 'work-order', edge: {} };
    expect(mayRunUnattended({ ...base, key: 'a', holder: 'x', board: 'b' } as never, rows)).toBe(false);
    expect(mayRunUnattended({ ...base, key: 'b', holder: 'x', board: 'b', mode: 'auto' } as never, rows)).toBe(true);
    // ...and the override does not defeat `awaitsOutside`: a step waiting on
    // something the machine cannot see stays parked whatever its mode claims.
    expect(
      mayRunUnattended({ ...base, key: 'c', holder: 'x', board: 'b', mode: 'auto', condition: 'until leased' } as never, rows),
    ).toBe(false);
  });

  it('a step with no verdict of its own still inherits the row — every existing book is unchanged', () => {
    const rows = new Map([['work-order', 'auto' as const]]);
    const s = { key: 'a', catalogRow: 'work-order', holder: 'x', board: 'b', edge: {} };
    expect(mayRunUnattended(s as never, rows)).toBe(true);
  });
});
