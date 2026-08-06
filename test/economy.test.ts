import { describe, it, expect } from 'vitest';
import { postingsFor, booksBalance, readSolvency, bridgeCheck, estimateSpendCents, spendGate } from '../src/domain/economy';
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

describe('the spend gate never invents an estimate', () => {
  // WHY. An unclassified work order — one naming no urgency band — used to be
  // given `$350`, a figure chosen to sit exactly AT the demo cap so it would
  // trip the gate. "When in doubt, ask." It worked, and it worked by
  // coincidence: the sentinel and the cap were tuned to the same number, so
  // raising the cap made the same unclassified work order read
  // `within-authority` and proceed — on an estimate nobody made, for a job
  // nobody classified. Worse, the settlement path posted that fabricated figure
  // to the ledger as a real vendor payment.
  //
  // A sentinel wearing a dollar sign is worse than an absence, because every
  // reading downstream treats it as money.
  const eco = (capCents: number) => ({ ...FOUNDING_ECONOMY, spendApprovalCents: capCents });

  it('a work order with no urgency band has NO estimate', () => {
    expect(estimateSpendCents(undefined)).toBeUndefined();
    expect(estimateSpendCents('')).toBeUndefined();
  });

  it('an urgency band this table does not know has no estimate either', () => {
    // Previously this fell through to the same $350 sentinel, so a typo in a
    // band name was indistinguishable from a deliberate classification.
    expect(estimateSpendCents('whenever-someone-gets-to-it')).toBeUndefined();
  });

  it('a known band still returns its figure', () => {
    expect(estimateSpendCents('routine')).toBe(17500);
    expect(estimateSpendCents('emergency')).toBe(140000);
  });

  it('an unclassified estimate stops, and says WHY it stopped', () => {
    const g = spendGate(eco(35000), estimateSpendCents(undefined));
    expect(g.disposition).toBe('unclassified');
    expect(g.needsApproval).toBe(true);
    expect(g.estimateCents).toBeUndefined();
    // Not "over the cap" — that would be a claim about a number that does not exist.
    expect(g.note).toMatch(/unclassified/i);
  });

  it('and it stops REGARDLESS of the cap — the old default did not', () => {
    // This is the regression. Under the sentinel, cap $350 gated and cap $500
    // silently let it through.
    for (const cap of [1, 35000, 50000, 10_000_00]) {
      const g = spendGate(eco(cap), estimateSpendCents(undefined));
      expect(g.disposition, `cap ${cap} should not change an unclassified reading`).toBe('unclassified');
      expect(g.needsApproval).toBe(true);
    }
  });

  it('a classified estimate is still weighed against the cap, both ways', () => {
    expect(spendGate(eco(35000), estimateSpendCents('routine')).disposition).toBe('within-authority');
    expect(spendGate(eco(35000), estimateSpendCents('emergency')).disposition).toBe('needs-owner-approval');
  });
});
