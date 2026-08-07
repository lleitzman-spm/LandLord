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
    // 34, not 33, since 2026-08-07: `renewal.owner-window` moved from `auto` to
    // `human` (docs/WRIT-THE-GATE.md). The ceiling RISING is the honest reading
    // of that change — closing an owner's authorization window when the owner
    // did not answer is a judgment, and the book previously claimed a machine
    // could do it. A budget that got cheaper by mislabelling a judgment was not
    // a better budget.
    // 29 since the operator's ruling of 2026-08-07 on `vendor-dispatch`. It was
    // 34, and every one of the five that moved was a step whose verdict the book
    // could not previously express: all eight vendor-dispatch steps shared one
    // catalog row, so logging a complaint, committing an owner's money and
    // posting a ledger entry carried a single `human`. `FlowStep.mode` now lets
    // a step carry its own, and the King ruled each: report / identify /
    // invoice-in / confirm-work / post-to-accounting are the machine's;
    // assign-vendor / dispatch / pay-vendor stay his until an agent earns them.
    //
    // The ceiling FALLING is the honest reading here, exactly as it RISING was
    // when owner-window moved the other way. Neither number is a target.
    expect(c.designed).toBe(29);
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

// ── SCOPING TO THE STANDING MUSTER ──────────────────────────────────────────
// Unscoped, this reading mixed a war game's cases with every pre-muster and
// hand-worked case in the chronicle, and called the average an operation's
// escape rate. Two populations, one number.
describe('the escape rate is scoped to the muster it is about', () => {
  const at = '2026-08-07T00:00:00.000Z';
  const cased = (caseId: string, kind: string, row: string, holder = 'desk'): KingdomEvent =>
    ({ id: `${caseId}-${kind}-${row}`, at, caseId, kind, catalogRow: row, holder }) as KingdomEvent;

  it('a hand-worked case does not count against a muster', () => {
    const log = [
      // Pre-muster: a person touched an `auto` step — an unplanned escape.
      cased('C1', 'handed', 'auto-row'),
      cased('C1', 'approved', 'auto-row'),
      // The muster's own case: reached, untouched by a human.
      cased('wg/s1 · turn · 12 Elm Row, unit 2', 'handed', 'auto-row'),
    ];
    const whole = readEscape(FLOWS, CAT, log);
    expect(whole.stepsReached).toBe(2);
    expect(whole.unplanned).toBe(1);

    const muster = readEscape(FLOWS, CAT, log, 's1');
    expect(muster.stepsReached).toBe(1);
    expect(muster.unplanned).toBe(0);
  });

  it('one muster does not count another muster’s work', () => {
    const log = [
      cased('wg/s1 · turn · 1 A St, unit 1', 'handed', 'auto-row'),
      cased('wg/s2 · turn · 2 B St, unit 2', 'handed', 'auto-row'),
      cased('wg/s2 · turn · 3 C St, unit 3', 'handed', 'auto-row'),
    ];
    expect(readEscape(FLOWS, CAT, log, 's1').stepsReached).toBe(1);
    expect(readEscape(FLOWS, CAT, log, 's2').stepsReached).toBe(2);
  });

  it('A RELAY CASE IS MATCHED — the mark is INFIXED, not a prefix', () => {
    // THE test. `instantiateFlow` names a flow case `<template>: <subject>`, so a
    // war relay reads `move-out-relay: wg/s1 · …` and the mark sits in the
    // MIDDLE. A `startsWith` implementation scores ZERO flow cases — exactly the
    // ones this reading measures — and fails silently, because a rate of null
    // reads as "nothing has happened yet" rather than as a bug.
    const log = [
      cased('move-out-relay: wg/s1 · relay · 12 Elm Row, unit 2 — Alys', 'handed', 'auto-row'),
      cased('move-out-relay: wg/s1 · relay · 12 Elm Row, unit 2 — Alys', 'approved', 'auto-row'),
    ];
    const r = readEscape(FLOWS, CAT, log, 's1');
    expect(r.stepsReached).toBe(1);
    expect(r.unplanned).toBe(1);
  });

  it('no seed is the reading it always was — byte for byte', () => {
    const log = [cased('C1', 'handed', 'auto-row'), cased('wg/s1 · x · 1 A St, unit 1', 'approved', 'human-row', 'alys')];
    expect(readEscape(FLOWS, CAT, log, null)).toEqual(readEscape(FLOWS, CAT, log));
    expect(readEscape(FLOWS, CAT, log, undefined)).toEqual(readEscape(FLOWS, CAT, log));
  });

  it('the seen-map key survives — the separator is a NUL byte, not a space', () => {
    // `escape.ts` keys its dedup map on `caseId + \x00 + catalogRow`. A space
    // there would collide `"a b" + "c"` with `"a" + "b c"`. Two cases whose
    // concatenations would merge under a space must still count as two.
    const log = [
      cased('wg/s1 · a b', 'handed', 'auto-row'),
      cased('wg/s1 · a', 'handed', 'auto-row'),
    ];
    expect(readEscape(FLOWS, CAT, log, 's1').stepsReached).toBe(2);
  });
});
