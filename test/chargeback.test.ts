// A tenant chargeback is money owed the OWNER, and no owner reading folded it.
// Found by an adversarial audit (2026-07-27) and verified numerically here.
//
// `postingsFor('tenant_chargeback')` emits DR ar_tenants / CR chargeback_income.
// `chargeback_income` is a trust income account, but it was the lone trust
// income/expense role missing from the lists that make up an owner's net claim
// — so recording one moved the tenant's receivable and nothing else. Three
// things went wrong at once, and the third is the worst.
import { describe, it, expect } from 'vitest';
import {
  FOUNDING_ECONOMY,
  readSolvency,
  readCompliance,
  readOwnerStatement,
  type MoneyEvent,
} from '../src/domain/economy';

const AT = '2026-07-15T00:00:00.000Z';
let n = 0;
const ev = (kind: MoneyEvent['kind'], amountCents: number): MoneyEvent =>
  ({ id: `m${n++}`, at: AT, kind, amountCents, caseId: 'c1', ownerId: 'ilse' }) as MoneyEvent;

const base = (): MoneyEvent[] => [ev('owner_contribution', 100_000), ev('rent_received', 150_000)];

describe('a tenant chargeback reaches the owner', () => {
  it('MOVES the owner’s statement — it is their money', () => {
    const before = readOwnerStatement(FOUNDING_ECONOMY, base(), 'ilse');
    const after = readOwnerStatement(
      FOUNDING_ECONOMY,
      [...base(), ev('tenant_chargeback', 25_000)],
      'ilse',
    );
    // The statement was byte-identical before this fix: the chargeback was
    // recorded, reported as recorded, and invisible to the person owed it.
    expect(after.endingCents - before.endingCents).toBe(25_000);
    expect(after.incomeCents - before.incomeCents).toBe(25_000);
  });

  it('does NOT break the trust reconciliation', () => {
    const s = readSolvency(FOUNDING_ECONOMY, [...base(), ev('tenant_chargeback', 25_000)]);
    expect(s.reconciles).toBe(true);
  });

  it('does not raise a FALSE compliance flag', () => {
    const c = readCompliance(FOUNDING_ECONOMY, [...base(), ev('tenant_chargeback', 25_000)]);
    expect(c.checks.find((x) => x.key === 'reconciliation')!.ok).toBe(true);
  });
});

describe('a failing check never prints a reassuring line', () => {
  it('the reconciliation’s detail follows its own verdict', () => {
    // The detail was chosen off `clean` while the pass/fail was chosen off
    // `reconciles`, so a broken identity could print "bank equals the client
    // trial balance" beside its own ⚠ — and a reader takes the sentence, not
    // the glyph. The invariant, whatever the numbers: a failing check must
    // never read as fine.
    for (const money of [
      [],
      base(),
      [...base(), ev('tenant_chargeback', 25_000)],
      [...base(), ev('vendor_bill', 40_000)],
      [...base(), ev('late_fee', 7_500), ev('deposit_received', 90_000)],
    ]) {
      const recon = readCompliance(FOUNDING_ECONOMY, money).checks.find(
        (x) => x.key === 'reconciliation',
      )!;
      if (!recon.ok) expect(recon.detail).not.toMatch(/equals the client trial balance/);
    }
  });
});
