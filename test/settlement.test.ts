import { describe, it, expect } from 'vitest';
import { foundingDoc, grandMusterDoc } from './fixtures';
import {
  chronicleSoundnessViolations,
  fiduciaryViolations,
} from './invariants';
import {
  FOUNDING_ECONOMY,
  vendorSettlementMoney,
  feeRuleFor,
  feeAmount,
  balanceOf,
  readPostings,
  readOwnerStatement,
  type MoneyEvent,
} from '../src/domain/economy';

const MARKUP = feeRuleFor(FOUNDING_ECONOMY, 'markup')!;
const markupOf = (bill: number) => feeAmount(MARKUP, bill);
const kindOf = (b: MoneyEvent[], k: string) => b.find((m) => m.kind === k);

describe('WRIT-B — a settled vendor-dispatch WO posts sound money', () => {
  it('an UNFUNDED owner settles soundly via the shortfall topup', () => {
    const doc = foundingDoc();
    const bill = 120_000;
    const mk = markupOf(bill);
    const batch = vendorSettlementMoney(FOUNDING_ECONOMY, [], {
      caseId: 'wo-1',
      billCents: bill,
      at: '2026-07-10T00:00:00.000Z',
      ownerId: 'Owen Ashford',
    });

    // The four postings, in the order the temporal replay needs.
    expect(batch.map((m) => m.kind)).toEqual([
      'owner_contribution', 'vendor_bill', 'vendor_paid', 'markup',
    ]);
    expect(kindOf(batch, 'vendor_bill')!.amountCents).toBe(bill);
    expect(kindOf(batch, 'vendor_paid')!.amountCents).toBe(bill);
    expect(kindOf(batch, 'markup')!.amountCents).toBe(mk);
    // Unfunded → the door is funded to the whole need (bill + markup).
    expect(kindOf(batch, 'owner_contribution')!.amountCents).toBe(bill + mk);
    // Every event links back to the WO (idempotency key + Counting-house backlink).
    expect(batch.every((m) => m.sourceId === 'wo-1')).toBe(true);

    doc.money = batch;
    // The CI-gate invariants — including the temporal replay that catches a
    // breach cured by the end-state fold — see nothing wrong.
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
    // The firm earned its coordination markup in the corporate book.
    expect(balanceOf(FOUNDING_ECONOMY, readPostings(doc.money), 'markup_income')).toBe(mk);
  });

  it('a PRE-FUNDED owner settles with NO topup and stays sound', () => {
    const doc = foundingDoc();
    const owner = 'Orin Vale';
    const bill = 50_000;
    // A prior owner escrow well above the need — so the settlement draws on it.
    const seed: MoneyEvent[] = [
      { id: 'pre-1', at: '2026-07-01T00:00:00.000Z', kind: 'owner_contribution', amountCents: 300_000, ownerId: owner },
    ];
    const batch = vendorSettlementMoney(FOUNDING_ECONOMY, seed, {
      caseId: 'wo-2',
      billCents: bill,
      at: '2026-07-10T00:00:00.000Z',
      ownerId: owner,
    });
    // Funded → no fresh contribution; just bill, pay, markup.
    expect(kindOf(batch, 'owner_contribution')).toBeUndefined();
    expect(batch.map((m) => m.kind)).toEqual(['vendor_bill', 'vendor_paid', 'markup']);

    doc.money = [...seed, ...batch];
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
  });

  it('settling a real WO onto a live grand muster keeps the whole chronicle sound', () => {
    const { doc } = grandMusterDoc();
    const owner = doc.money.find((m) => m.ownerId)?.ownerId as string;
    const have = readOwnerStatement(FOUNDING_ECONOMY, doc.money, owner).endingCents;
    const bill = 40_000;
    const batch = vendorSettlementMoney(FOUNDING_ECONOMY, doc.money, {
      caseId: 'wo-live',
      billCents: bill,
      at: '2026-07-21T12:00:00.000Z',
      ownerId: owner,
    }).map((m, i) => ({ ...m, id: `live-${i}`, wg: doc.wargame!.seed }));

    doc.money = [...doc.money, ...batch];
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
    // The topup is only the shortfall — never more than the need.
    const topup = kindOf(batch, 'owner_contribution')?.amountCents ?? 0;
    expect(topup).toBeLessThanOrEqual(bill + markupOf(bill));
    if (have >= bill + markupOf(bill)) expect(topup).toBe(0);
  });

  it('re-settling the same WO is caught by the store guard (kind + sourceId)', () => {
    // The store skips when money already holds a vendor_paid for this caseId —
    // so a second advance of pay-vendor posts nothing (no double-charge).
    const batch = vendorSettlementMoney(FOUNDING_ECONOMY, [], {
      caseId: 'wo-3', billCents: 30_000, at: '2026-07-10T00:00:00.000Z',
    });
    const alreadySettled = batch.some((m) => m.sourceId === 'wo-3' && m.kind === 'vendor_paid');
    expect(alreadySettled).toBe(true);
  });

  it('a zero/invalid bill posts nothing', () => {
    expect(vendorSettlementMoney(FOUNDING_ECONOMY, [], { caseId: 'x', billCents: 0, at: '2026-07-10T00:00:00.000Z' })).toEqual([]);
    expect(vendorSettlementMoney(FOUNDING_ECONOMY, [], { caseId: 'x', billCents: -5, at: '2026-07-10T00:00:00.000Z' })).toEqual([]);
  });
});
