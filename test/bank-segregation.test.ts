import { describe, it, expect } from 'vitest';
import { foundingDoc, grandMusterDoc } from './fixtures';
import { chronicleSoundnessViolations, fiduciaryViolations } from './invariants';
import {
  FOUNDING_ECONOMY,
  vendorSettlementMoney,
  readBankRecs,
  readSolvency,
  readCorporateCoffers,
  readOwnerStatement,
  balanceOf,
  readPostings,
  feeRuleFor,
  feeAmount,
  type MoneyEvent,
} from '../src/domain/economy';

const MARKUP = feeRuleFor(FOUNDING_ECONOMY, 'markup')!;
// A settled WO (sound, self-funded) whose markup we can then sweep.
function settledWithMarkup(caseId: string, billCents: number): { money: MoneyEvent[]; markup: number } {
  const money = vendorSettlementMoney(FOUNDING_ECONOMY, [], {
    caseId, billCents, at: '2026-07-10T00:00:00.000Z', ownerId: 'Owen Ashford',
  });
  return { money, markup: feeAmount(MARKUP, billCents) };
}

describe('WRIT-A slice-2b — bank segregation', () => {
  it('commission_sweep lands the markup in By-Pass, never operating, and stays sound', () => {
    const doc = foundingDoc();
    const { money, markup } = settledWithMarkup('wo-1', 60_000);
    money.push({ id: 'cs-1', at: '2026-07-11T00:00:00.000Z', kind: 'commission_sweep', amountCents: markup, ownerId: 'Owen Ashford' });
    doc.money = money;

    const p = readPostings(doc.money);
    expect(balanceOf(FOUNDING_ECONOMY, p, 'bypass_cash')).toBe(markup); // commission segregated
    expect(balanceOf(FOUNDING_ECONOMY, p, 'op_cash')).toBe(0); // never through operating
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
    // The By-Pass bank reads clean (no lapse) when commission is swept correctly.
    const recs = readBankRecs(FOUNDING_ECONOMY, doc.money);
    const byPass = recs.recs.find((r) => r.bank === 'by-pass')!;
    expect(byPass.bookBalanceCents).toBe(markup);
    expect(byPass.segregationLapse).toBe(false);
    expect(recs.ok).toBe(true);
  });

  it('sweeping commission through operating (fee_sweep) raises a By-Pass segregation lapse', () => {
    const doc = foundingDoc();
    const { money, markup } = settledWithMarkup('wo-2', 60_000);
    // The WRONG bank: fee_sweep sends the commission to operating.
    money.push({ id: 'fs-1', at: '2026-07-11T00:00:00.000Z', kind: 'fee_sweep', amountCents: markup, ownerId: 'Owen Ashford' });
    doc.money = money;

    const recs = readBankRecs(FOUNDING_ECONOMY, doc.money);
    const byPass = recs.recs.find((r) => r.bank === 'by-pass')!;
    expect(byPass.segregationLapse).toBe(true); // commission leaked into operating
    expect(recs.ok).toBe(false);
    // The books still balance (it is a segregation lapse, not an imbalance).
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
  });

  it('IRS backup withholding stays sound and rides the solvency identity', () => {
    const doc = foundingDoc();
    const bill = 100_000;
    const w = 24_000; // 24% federal backup withholding, caller-supplied (gated rate)
    doc.money = [
      { id: 'oc', at: '2026-07-10T00:00:00.000Z', kind: 'owner_contribution', amountCents: bill, ownerId: 'Owen Ashford' },
      { id: 'vb', at: '2026-07-10T00:00:01.000Z', kind: 'vendor_bill', amountCents: bill, ownerId: 'Owen Ashford', vendorId: 'Ser Fix' },
      { id: 'iw', at: '2026-07-10T00:00:02.000Z', kind: 'irs_withholding', amountCents: w, ownerId: 'Owen Ashford', vendorId: 'Ser Fix' },
      { id: 'vp', at: '2026-07-10T00:00:03.000Z', kind: 'vendor_paid', amountCents: bill - w, ownerId: 'Owen Ashford', vendorId: 'Ser Fix' },
    ];

    const p = readPostings(doc.money);
    expect(balanceOf(FOUNDING_ECONOMY, p, 'ap_vendors') || 0).toBe(0); // AP fully cleared (normalize -0)
    expect(balanceOf(FOUNDING_ECONOMY, p, 'irs_withholding_payable')).toBe(w); // held for the IRS
    // The owner statement is untouched by withholding (it never touches equity).
    expect(readOwnerStatement(FOUNDING_ECONOMY, doc.money, 'Owen Ashford').endingCents).toBe(0);
    const s = readSolvency(FOUNDING_ECONOMY, doc.money);
    expect(s.irsWithholding).toBe(w); // the new liability is folded in
    expect(s.reconciles).toBe(true); // variance ≡ AP − AR still holds WITH the term
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
  });

  it('readBankRecs folds every physical bank on a real grand muster; none overdrawn', () => {
    const { doc } = grandMusterDoc();
    const recs = readBankRecs(FOUNDING_ECONOMY, doc.money);
    const banks = recs.recs.map((r) => r.bank).sort();
    expect(banks).toEqual(['by-pass', 'operating', 'trust-deposit', 'trust-rent', 'trust-reserve']);
    // No TRUST bank overdrawn (a fiduciary red line); the muster segregates
    // commission, so no By-Pass leak, and reconciliation reads clean.
    const trust = recs.recs.filter((r) => r.bank.startsWith('trust-'));
    expect(trust.every((r) => !r.overdrawn)).toBe(true);
    expect(recs.recs.every((r) => !r.segregationLapse)).toBe(true);
    expect(recs.ok).toBe(true);
    // The muster deals commission into By-Pass, so the corporate runway counts it.
    const cof = readCorporateCoffers(FOUNDING_ECONOMY, doc.money);
    expect(cof.bypassCash).toBeGreaterThan(0);
  });

  it('a supplied bank statement that disagrees produces the exact lapse', () => {
    const { doc } = grandMusterDoc();
    const p = readPostings(doc.money);
    const opBook = balanceOf(FOUNDING_ECONOMY, p, 'op_cash');
    const recs = readBankRecs(FOUNDING_ECONOMY, doc.money, { operating: opBook - 100_00 });
    const op = recs.recs.find((r) => r.bank === 'operating')!;
    expect(op.lapseCents).toBe(100_00);
    expect(op.ok).toBe(false);
    expect(recs.ok).toBe(false);
  });
});
