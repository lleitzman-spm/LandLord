import { describe, it, expect } from 'vitest';
import type { MoneyEvent, MoneyKind } from '../src/domain/economy';
import { fiduciaryViolations } from './invariants';
import { chronicleSoundnessViolations } from './invariants';
import { foundingDoc, grandMusterDoc } from './fixtures';

let seq = 0;
function ev(kind: MoneyKind, amountCents: number, dims: Partial<MoneyEvent> = {}): MoneyEvent {
  seq += 1;
  return { id: `f-${seq}`, at: `2026-07-${String((seq % 27) + 1).padStart(2, '0')}T00:00:00.000Z`, kind, amountCents, ...dims };
}
function docWithMoney(money: MoneyEvent[]) {
  const doc = foundingDoc();
  doc.money = money;
  return doc;
}

describe('assertFiduciarySound — the per-party / temporal layer', () => {
  it('the founding chronicle is fiduciarily sound (aggregate + temporal)', () => {
    expect(fiduciaryViolations(foundingDoc(), { temporal: true })).toEqual([]);
  });

  it('a real grand muster is sound — no false positives on realistic data', () => {
    const { doc } = grandMusterDoc();
    expect(fiduciaryViolations(doc)).toEqual([]);
  });

  it('a well-ordered owner month is sound (income before fees, temporal-clean)', () => {
    const O = { ownerId: 'O1', estateId: 'E1' };
    const money = [
      ev('rent_charged', 150_000, { ...O, tenantId: 'T1' }),
      ev('rent_received', 150_000, { ...O, tenantId: 'T1' }),
      ev('management_fee', 12_000, O),
      ev('fee_sweep', 12_000, O),
    ];
    expect(fiduciaryViolations(docWithMoney(money), { temporal: true })).toEqual([]);
  });

  // CATCH #1 — over-sweep: a fee_sweep with no fees earned drives the bridge
  // equally negative. Books still balance, bridge still "ties" — the old
  // checker is silent; this one is not.
  it('catches an over-sweep (bridge driven negative) the aggregate checker misses', () => {
    // Fund the trust bank first, earn a small fee, then sweep far more than
    // earned: the trust bank stays positive and the owner stays whole, so the
    // ONLY breach is due_to_mgmt going negative — invisible to self-consistency.
    const O = { ownerId: 'O1', estateId: 'E1' };
    const doc = docWithMoney([
      ev('rent_charged', 200_000, { ...O, tenantId: 'T1' }),
      ev('rent_received', 200_000, { ...O, tenantId: 'T1' }),
      ev('management_fee', 12_000, O),
      ev('fee_sweep', 80_000, O),
    ]);
    expect(chronicleSoundnessViolations(doc)).toEqual([]); // self-consistency: clean
    expect(fiduciaryViolations(doc).join(' ')).toMatch(/over-swept/);
  });

  // CATCH #2 — cross-tenant deposit misallocation: refund T2 out of the pool
  // T1 funded. Aggregate deposits stay whole; T2's subledger goes negative.
  it('catches a deposit refunded from the wrong tenant (per-tenant subledger)', () => {
    const money = [
      ev('deposit_received', 100_000, { tenantId: 'T1', estateId: 'E1' }),
      ev('deposit_refunded', 100_000, { tenantId: 'T2', estateId: 'E1' }),
    ];
    const doc = docWithMoney(money);
    // The old aggregate checker misses it (total deposits = 0, "intact").
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    // The fiduciary layer catches T2's negative subledger.
    expect(fiduciaryViolations(doc).join(' ')).toMatch(/tenant T2 deposit overdrawn/);
  });

  // CATCH #3 — the temporal-only class: an owner overdrawn MID-history, cured by
  // month-end. The end-state fold sees nothing; prefix replay sees the breach.
  it('catches a mid-history breach that the end state hides (temporal replay)', () => {
    const money = [
      ev('owner_draw', 50_000, { ownerId: 'O1' }), // draw before any funding
      ev('owner_contribution', 50_000, { ownerId: 'O1' }), // cured by end
    ];
    const doc = docWithMoney(money);
    expect(fiduciaryViolations(doc)).toEqual([]); // aggregate end-state: clean
    expect(fiduciaryViolations(doc, { temporal: true }).length).toBeGreaterThan(0); // replay: caught
  });
});
