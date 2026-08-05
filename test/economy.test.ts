import { describe, it, expect } from 'vitest';
import { postingsFor, booksBalance, readSolvency, bridgeCheck } from '../src/domain/economy';
import { ALL_MONEY_KINDS, moneyEvent, grandMusterDoc, FOUNDING_ECONOMY } from './fixtures';

describe('economy — the money fold (R1: no silent drops)', () => {
  it('every MoneyKind produces postings — none falls through to default:[]', () => {
    for (const kind of ALL_MONEY_KINDS) {
      const postings = postingsFor(moneyEvent(kind));
      expect(postings.length, `kind "${kind}" produced no postings`).toBeGreaterThan(0);
    }
  });

  it('every MoneyKind balances within each book (double-entry)', () => {
    for (const kind of ALL_MONEY_KINDS) {
      const bb = booksBalance(postingsFor(moneyEvent(kind)));
      expect(bb.balanced, `kind "${kind}" unbalanced — trust ${bb.trust}, corp ${bb.corporate}`).toBe(true);
    }
  });
});

describe('economy — identities over a real grand muster', () => {
  const { doc } = grandMusterDoc();

  it('both books balance over the whole dealt money log', () => {
    // The founding grand muster deals no money today (money=[]) — the identity
    // must still hold (trivially and non-trivially). Guard both.
    const bb = booksBalance(doc.money.flatMap(postingsFor));
    expect(bb.balanced).toBe(true);
  });

  it('the trust solvency identity holds (variance ≡ AP − AR)', () => {
    const s = readSolvency(FOUNDING_ECONOMY, doc.money);
    expect(s.reconciles).toBe(true);
  });

  it('the fee bridge ties', () => {
    expect(bridgeCheck(FOUNDING_ECONOMY, doc.money).tied).toBe(true);
  });
});
