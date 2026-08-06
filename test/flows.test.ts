import { describe, it, expect } from 'vitest';
import {
  FOUNDING_FLOWS,
  instantiateFlow,
  completeStep,
  approveStep,
  overrideStep,
  readFlow,
  fullParams,
} from '../src/domain/flows';
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
  const opts = (n: number) => ({ at: '2026-07-27T00:00:00.000Z', id: () => `e${n}` });

  it('approving the final step records that the case is DONE', () => {
    const last = tpl.steps.length - 1;
    const evs = approveStep(tpl, 'c1', last, opts(1));
    expect(evs.map((e) => e.kind)).toEqual(['approved', 'done']);
  });

  it('overruling the final step closes it too', () => {
    const last = tpl.steps.length - 1;
    const evs = overrideStep(tpl, 'c1', last, opts(2));
    expect(evs.map((e) => e.kind)).toEqual(['overridden', 'done']);
  });

  it('a MIDDLE step hands on and closes NOTHING', () => {
    const evs = approveStep(tpl, 'c1', 0, opts(3));
    expect(evs[0].kind).toBe('approved');
    expect(evs).toHaveLength(2); // the next step is handed (or set awaiting)
    expect(evs.some((e) => e.kind === 'done')).toBe(false);
  });

  it('the case READS as done once the last step is ratified', () => {
    // The whole point: the reading has to change, or the Ledger still shows an
    // open case with no act on it.
    const last = tpl.steps.length - 1;
    let i = 0;
    const inst = instantiateFlow(tpl, 'c1', {
      at: '2026-07-27T00:00:00.000Z',
      id: () => `s${i++}`,
    });
    const log = [
      ...inst.events,
      ...approveStep(tpl, inst.caseId, last, {
        at: '2026-07-27T01:00:00.000Z',
        id: () => `a${i++}`,
      }),
    ];
    expect(readCase(log, inst.caseId).status).toBe('done');
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
