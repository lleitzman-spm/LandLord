// A red month is not a fallen kingdom. Found by PLAYING the game (2026-07-27):
// a freshly-dealt grand muster declared "the coffers are dry — the kingdom
// falls" in week five of every run, while the company still held its cash — and
// then nothing happened, which is the worst thing the loudest signal on a board
// can do.
//
// The tell was dead code: the map's cartouche carried a "the month runs to the
// bad" wording that could never be reached, because `fallen` was `trend < 0`
// and so was the condition that would have shown it. One boolean was carrying
// two different facts.
import { describe, it, expect } from 'vitest';
import { readCoffers } from '../src/domain/treasury';
import { FOUNDING_ECONOMY, balanceOf, readPostings, type MoneyEvent } from '../src/domain/economy';
import { grandMusterDoc } from './fixtures';

const AT = '2026-07-27T00:00:00.000Z';
let n = 0;
const ev = (kind: MoneyEvent['kind'], amountCents: number): MoneyEvent =>
  ({ id: `m${n++}`, at: AT, kind, amountCents, caseId: 'c1' }) as MoneyEvent;

describe('the coffers — a red month vs an empty till', () => {
  it('THE BUG, pinned: a dealt grand muster runs red but is NOT broke', () => {
    // This is the exact state Edwin played into. Tribute does not cover upkeep,
    // so the month is red — and the Crown is holding coin the whole time.
    const { doc } = grandMusterDoc();
    const c = readCoffers(114, FOUNDING_ECONOMY, doc.money ?? []);
    expect(c.trend).toBeLessThan(0);
    expect(c.fallen).toBe(true); // the month IS red — that reading is unchanged
    expect(c.dry).toBe(false); // the kingdom has NOT fallen
  });

  it('reads BOTH corporate banks, not just the operating one', () => {
    // The muster holds a negative operating balance and a positive By-Pass
    // balance. Reading `op_cash` alone would call a solvent Crown broke — the
    // same lie in a new costume, which is why this test exists.
    const { doc } = grandMusterDoc();
    const posts = readPostings(doc.money ?? []);
    const op = balanceOf(FOUNDING_ECONOMY, posts, 'op_cash');
    const bypass = balanceOf(FOUNDING_ECONOMY, posts, 'bypass_cash');
    expect(op).toBeLessThan(0);
    expect(bypass).toBeGreaterThan(0);
    expect(op + bypass).toBeGreaterThan(0);
  });

  it('a bare census is never dry — there is nothing to be broke with', () => {
    expect(readCoffers(0, FOUNDING_ECONOMY, []).dry).toBe(false);
  });

  it('the coffers ARE dry when the Crown’s own banks run out', () => {
    const c = readCoffers(1, FOUNDING_ECONOMY, [ev('corp_expense', 1_820_000)]);
    expect(c.dry).toBe(true);
  });

  it('a full TRUST account never saves the Crown — that coin is not its own', () => {
    // Rent collected into trust is the owners' money; the Crown may not spend
    // it. A reading that counted it would say all is well while the Crown
    // cannot make payroll.
    const c = readCoffers(1, FOUNDING_ECONOMY, [
      ev('rent_received', 50_000_000),
      ev('corp_expense', 1_820_000),
    ]);
    expect(c.dry).toBe(true);
  });

  it('the two readings are genuinely independent', () => {
    // A good month with an empty till is possible — the fees are earned and not
    // yet swept — and it must read as exactly that, not as "all is well".
    const c = readCoffers(1000, FOUNDING_ECONOMY, [ev('corp_expense', 100)]);
    expect(c.trend).toBeGreaterThan(0);
    expect(c.fallen).toBe(false);
    expect(c.dry).toBe(true);
  });
});
