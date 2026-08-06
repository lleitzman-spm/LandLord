import { describe, it, expect } from 'vitest';
import { readEscape, readDesignedCeiling } from '../src/domain/escape';
import { FOUNDING_FLOWS } from '../src/domain/flows';
import { FOUNDING_CATALOG } from '../src/domain/catalog';
import type { KingdomEvent } from '../src/domain/events';

const CAT = [
  { key: 'auto-row', title: 'An automated task', mode: 'auto' as const },
  { key: 'human-row', title: 'A human judgment', mode: 'human' as const },
  { key: 'unset-row', title: 'A task nobody classified' },
];
const FLOWS = [
  {
    key: 'f', title: 'F', trigger: 't',
    steps: [
      { key: 'a', catalogRow: 'auto-row', holder: 'desk', board: 'B', edge: {} },
      { key: 'h', catalogRow: 'human-row', holder: 'alys', board: 'B', edge: {} },
      { key: 'u', catalogRow: 'unset-row', holder: 'desk', board: 'B', edge: {} },
    ],
  },
];
const ev = (kind: string, row: string, holder = 'desk'): KingdomEvent =>
  ({ id: `${kind}-${row}`, at: '2026-08-06T00:00:00.000Z', caseId: 'C1', kind, catalogRow: row, holder }) as KingdomEvent;

describe('escape rate — what fraction of work reaches a human', () => {
  it('a step never reached cannot escape — an idle system is not an automated one', () => {
    const r = readEscape(FLOWS, CAT, []);
    expect(r.stepsReached).toBe(0);
    // Null, not zero. A rate over no work is not a good rate, and rendering it as
    // 0% would read as perfect automation on a system that has done nothing.
    expect(r.rate).toBeNull();
  });

  it('a step the catalog marks human is a DESIGNED escape, not a failure', () => {
    const r = readEscape(FLOWS, CAT, [ev('handed', 'human-row', 'alys')]);
    expect(r.designed).toBe(1);
    expect(r.unplanned).toBe(0);
  });

  it('a human touching an AUTO step is an unplanned escape — the machine failed', () => {
    const r = readEscape(FLOWS, CAT, [ev('handed', 'auto-row'), ev('overridden', 'auto-row')]);
    expect(r.unplanned).toBe(1);
    expect(r.designed).toBe(0);
  });

  it('an auto step nobody touched is not an escape at all', () => {
    const r = readEscape(FLOWS, CAT, [ev('handed', 'auto-row'), ev('done', 'auto-row')]);
    expect(r.escaped).toBe(0);
    expect(r.rate).toBe(0);
  });

  it('`awaiting` is NOT an escape — it means parked on a clock, not on a person', () => {
    // The engine raises `awaiting` for anything with an SLA, a calendar window, a
    // loop or a condition — nearly every step. Counting it would inflate every
    // reading here into meaninglessness.
    const r = readEscape(FLOWS, CAT, [ev('handed', 'auto-row'), ev('awaiting', 'auto-row')]);
    expect(r.unplanned).toBe(0);
  });

  it('a step with no declared mode is NOT MEASURED and never joins a total', () => {
    const r = readEscape(FLOWS, CAT, [ev('handed', 'unset-row'), ev('overridden', 'unset-row')]);
    expect(r.unmeasured).toBe(1);
    expect(r.stepsReached).toBe(0);
    // The denominator is not quietly padded with an unknown — that is how a rate
    // flatters itself.
    expect(r.rate).toBeNull();
  });

  it('one step worked over many events counts once, not once per event', () => {
    const many = ['handed', 'noted', 'noted', 'proposed', 'approved'].map((k) => ev(k, 'auto-row'));
    const r = readEscape(FLOWS, CAT, many);
    expect(r.stepsReached).toBe(1);
    expect(r.unplanned).toBe(1);
  });

  it('names WHICH step leaks, not just that one does', () => {
    const r = readEscape(FLOWS, CAT, [ev('handed', 'auto-row'), ev('approved', 'auto-row')]);
    expect(r.byStep[0].key).toBe('auto-row');
    expect(r.byStep[0].unplanned).toBe(1);
  });
});

describe("escape rate — the design's own ceiling, and its evidence", () => {
  it('the founding flow book budgets most of its steps to a person', () => {
    const c = readDesignedCeiling(FOUNDING_FLOWS, FOUNDING_CATALOG);
    expect(c.stepsReached).toBe(46);
    expect(c.designed).toBe(33);
    expect(c.unmeasured).toBe(0);
  });

  it('and it says how few independent judgments that rests on', () => {
    // `mode` lives on the catalog ROW, not the step. All eight vendor-dispatch
    // steps point at one row, so their mode is one decision inherited eight times.
    // A reading that quoted 46 without saying this would overstate its evidence.
    const c = readDesignedCeiling(FOUNDING_FLOWS, FOUNDING_CATALOG);
    expect(c.judgments).toBe(39);
    expect(c.inheritedSteps).toBe(7);
    expect(c.judgments).toBeLessThan(c.stepsReached);
  });
});
