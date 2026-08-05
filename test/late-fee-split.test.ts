// The late-fee firm-share split — CORRECTED after the adversarial review that
// caught the first attempt. The tenant is billed the WHOLE late fee (`late_fee`,
// on AR, owner income accrues); the firm takes its share ONLY when that fee is
// COLLECTED (cash in trust), on the bridge exactly like the mgmt fee on collected
// rent — so the firm's accrual is cash-backed, never drawn from another owner's
// pooled cash. The tell that it is right: the sound cycle needs NO artificial
// owner funding (the broken charge-time version did, to mask an overdrawn owner).
import { describe, it, expect } from 'vitest';
import {
  lateFeeSplit,
  postingsFor,
  booksBalance,
  bridgeCheck,
  balanceOf,
  readPostings,
  FOUNDING_ECONOMY,
} from '../src/domain/economy';
import { chronicleSoundnessViolations, fiduciaryViolations } from './invariants';
import { foundingDoc, moneyEvent } from './fixtures';
import type { MoneyEvent } from '../src/domain/economy';

let seq = 0;
function ev(kind: MoneyEvent['kind'], amountCents: number, dims: Partial<MoneyEvent> = {}): MoneyEvent {
  seq += 1;
  return { id: `late-${seq}`, at: `2026-07-${String((seq % 27) + 1).padStart(2, '0')}T00:00:00.000Z`, kind, amountCents, ...dims };
}

describe('lateFeeSplit — the pure owner/firm split of a collected late fee', () => {
  it('ownerCents + firmCents always ties the fee (rounding lands on the owner)', () => {
    for (const fee of [0, 1, 3, 100, 9_999, 250_000]) {
      const { ownerCents, firmCents } = lateFeeSplit(FOUNDING_ECONOMY, fee);
      expect(ownerCents + firmCents).toBe(fee);
      expect(ownerCents).toBeGreaterThanOrEqual(0);
      expect(firmCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('reads the demo 60/40 split (owner takes the remainder)', () => {
    expect(lateFeeSplit(FOUNDING_ECONOMY, 10_000)).toEqual({ ownerCents: 4_000, firmCents: 6_000 });
    const odd = lateFeeSplit(FOUNDING_ECONOMY, 10_001);
    expect(odd).toEqual({ ownerCents: 4_000, firmCents: 6_001 });
  });
});

describe('late_fee_share posting — balanced across the bridge, R1-clean', () => {
  it('balances within both books (the bridge)', () => {
    const bb = booksBalance(postingsFor(moneyEvent('late_fee_share', 5_000)));
    expect(bb.balanced).toBe(true);
    expect(bb.trust).toBe(0);
    expect(bb.corporate).toBe(0);
  });
  it('is a real posting (R1: never the empty default)', () => {
    expect(postingsFor(moneyEvent('late_fee_share', 5_000)).length).toBeGreaterThan(0);
  });
});

describe('the CORRECTED cycle: charge the whole fee → collect → firm share, cash-backed', () => {
  it('tenant billed the WHOLE fee, owner keeps its share, firm earns its cut — sound with NO funding', () => {
    const O = { ownerId: 'O1', estateId: 'E1' };
    const fee = 12_000;
    const { ownerCents, firmCents } = lateFeeSplit(FOUNDING_ECONOMY, fee);
    const money = [
      ev('late_fee', fee, O), // CHARGE the whole fee — AR up full, owner income full
      ev('rent_received', fee, O), // COLLECT it — cash into trust, AR settled
      ev('late_fee_share', firmCents, O), // firm's cut, backed by the cash just collected
    ];
    const doc = foundingDoc();
    doc.money = money;

    // No owner_contribution needed — the collection funds the firm's cut. (The
    // broken charge-time version needed funding to stay non-negative; this doesn't.)
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
    expect(bridgeCheck(FOUNDING_ECONOMY, money).tied).toBe(true);

    // The defect is fixed, provably: the tenant was billed the FULL fee (AR nets
    // to zero after collection — charged full, collected full, not under-billed),
    // the owner keeps its share, and the firm earns exactly firmCents.
    const p = readPostings(money);
    expect(balanceOf(FOUNDING_ECONOMY, p, 'ar_tenants')).toBe(0);
    expect(balanceOf(FOUNDING_ECONOMY, p, 'late_fee_income')).toBe(fee); // owner billed the whole fee
    expect(balanceOf(FOUNDING_ECONOMY, p, 'late_fee_share_expense')).toBe(firmCents); // owner's net take is fee − firmCents
    expect(balanceOf(FOUNDING_ECONOMY, p, 'late_fee_share_income')).toBe(firmCents); // firm earns its cut
  });

  it('firm keeps the WHOLE late fee (splitBps 10000) still nets the owner zero soundly', () => {
    const econ = { ...FOUNDING_ECONOMY, feeRules: FOUNDING_ECONOMY.feeRules.map((r) => (r.kind === 'late_split' ? { ...r, splitBps: 10_000 } : r)) };
    const O = { ownerId: 'O2', estateId: 'E2' };
    const fee = 8_000;
    const { ownerCents, firmCents } = lateFeeSplit(econ, fee);
    expect(ownerCents).toBe(0);
    expect(firmCents).toBe(fee);
    const money = [ev('late_fee', fee, O), ev('rent_received', fee, O), ev('late_fee_share', firmCents, O)];
    const doc = foundingDoc();
    doc.economy = econ;
    doc.money = money;
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
  });
});
