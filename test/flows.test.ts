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
