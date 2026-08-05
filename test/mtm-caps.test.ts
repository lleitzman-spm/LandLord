// The last two A slice-2 economy gaps (docs/HANDOFF.md, Frontier A) — the
// month-to-month premium split and per-estate spend caps — proven together.
import { describe, it, expect } from 'vitest';
import {
  mtmSplit,
  postingsFor,
  booksBalance,
  bridgeCheck,
  spendCapFor,
  spendGate,
  needsOwnerApproval,
  reconcileSpend,
  FOUNDING_ECONOMY,
} from '../src/domain/economy';
import { chronicleSoundnessViolations, fiduciaryViolations } from './invariants';
import { foundingDoc, moneyEvent } from './fixtures';
import type { MoneyEvent } from '../src/domain/economy';

let seq = 0;
function ev(kind: MoneyEvent['kind'], amountCents: number, dims: Partial<MoneyEvent> = {}): MoneyEvent {
  seq += 1;
  return {
    id: `mtm-${seq}`,
    at: `2026-07-${String((seq % 27) + 1).padStart(2, '0')}T00:00:00.000Z`,
    kind,
    amountCents,
    ...dims,
  };
}

describe('mtmSplit — the pure owner/firm split reading', () => {
  it('ownerCents + firmCents always ties the premium (rounding lands on the owner)', () => {
    for (const premium of [0, 1, 3, 100, 12_345, 1_000_000]) {
      const { ownerCents, firmCents } = mtmSplit(FOUNDING_ECONOMY, premium);
      expect(ownerCents + firmCents).toBe(premium);
      expect(ownerCents).toBeGreaterThanOrEqual(0);
      expect(firmCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('reads the demo 35% firm / 65% owner split', () => {
    const { ownerCents, firmCents } = mtmSplit(FOUNDING_ECONOMY, 100_000);
    expect(firmCents).toBe(35_000);
    expect(ownerCents).toBe(65_000);
  });

  it('a house mtm rule with no splitBps falls back to the named constant', () => {
    const economy = structuredClone(FOUNDING_ECONOMY);
    economy.feeRules = economy.feeRules.filter((r) => r.kind !== 'mtm');
    economy.feeRules.push({ kind: 'mtm', basis: 'new_rent', rateBps: 750 }); // no splitBps
    const { ownerCents, firmCents } = mtmSplit(economy, 100_000);
    expect(firmCents).toBe(35_000); // MTM_FIRM_SPLIT_BPS fallback
    expect(ownerCents).toBe(65_000);
  });

  it('no mtm rule at all still resolves via the fallback constant (never throws)', () => {
    const economy = structuredClone(FOUNDING_ECONOMY);
    economy.feeRules = economy.feeRules.filter((r) => r.kind !== 'mtm');
    const { ownerCents, firmCents } = mtmSplit(economy, 100_000);
    expect(firmCents).toBe(35_000);
    expect(ownerCents).toBe(65_000);
  });
});

describe('mtm_premium / mtm_fee postings — balanced, R1-clean, bridge-tied', () => {
  it('mtm_premium balances within the trust book (owner income collected)', () => {
    const bb = booksBalance(postingsFor(moneyEvent('mtm_premium', 60_000)));
    expect(bb.balanced).toBe(true);
    expect(bb.trust).toBe(0);
  });

  it('mtm_fee balances across both books (the bridge)', () => {
    const bb = booksBalance(postingsFor(moneyEvent('mtm_fee', 40_000)));
    expect(bb.balanced).toBe(true);
    expect(bb.trust).toBe(0);
    expect(bb.corporate).toBe(0);
  });

  it('a full mtm month (split, funded) is sound end-to-end and the bridge ties after the fee', () => {
    const O = { ownerId: 'O1', estateId: 'E1' };
    const premium = 100_000;
    const { ownerCents, firmCents } = mtmSplit(FOUNDING_ECONOMY, premium);
    // Fund the door first (owner_contribution) so the owner's subledger never
    // dips negative before the premium lands — the same unfunded-owner problem
    // the fiduciary temporal replay would otherwise catch.
    const money = [
      ev('owner_contribution', 10_000, O),
      ev('mtm_premium', ownerCents, O),
      ev('mtm_fee', firmCents, O),
    ];
    const doc = foundingDoc();
    doc.money = money;
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc, { temporal: true })).toEqual([]);
    expect(bridgeCheck(FOUNDING_ECONOMY, money).tied).toBe(true);
  });
});

describe('spendCapFor — per-estate override, house fallback', () => {
  it("returns the seeded harrow-c estate's own cap", () => {
    expect(spendCapFor(FOUNDING_ECONOMY, 'harrow-c')).toBe(90_000);
  });

  it('falls back to the house cap for an unknown estate', () => {
    expect(spendCapFor(FOUNDING_ECONOMY, 'no-such-estate')).toBe(FOUNDING_ECONOMY.spendApprovalCents);
  });

  it('falls back to the house cap when no estateId is given', () => {
    expect(spendCapFor(FOUNDING_ECONOMY)).toBe(FOUNDING_ECONOMY.spendApprovalCents);
  });

  it('reads undefined when the economy sets no house cap and the estate has no override', () => {
    const economy = { ...FOUNDING_ECONOMY, spendApprovalCents: undefined, estateSpendCaps: undefined };
    expect(spendCapFor(economy, 'harrow-c')).toBeUndefined();
  });
});

describe('spendGate / needsOwnerApproval — backward-compatible, estate-aware', () => {
  it('the two-arg spendGate call (the harness shape) behaves exactly as before', () => {
    const under = spendGate(FOUNDING_ECONOMY, 25_000);
    expect(under.disposition).toBe('within-authority');
    expect(under.needsApproval).toBe(false);
    const over = spendGate(FOUNDING_ECONOMY, 60_000);
    expect(over.disposition).toBe('needs-owner-approval');
    expect(over.needsApproval).toBe(true);
  });

  it('the two-arg needsOwnerApproval call behaves exactly as before', () => {
    expect(needsOwnerApproval(FOUNDING_ECONOMY, 25_000)).toBe(false);
    expect(needsOwnerApproval(FOUNDING_ECONOMY, 60_000)).toBe(true);
  });

  it("an estate with a higher cap (harrow-c) clears a spend the house cap would gate", () => {
    // $600 — over the demo house cap, under the demo per-estate override.
    const houseGated = spendGate(FOUNDING_ECONOMY, 60_000);
    expect(houseGated.needsApproval).toBe(true);
    const estateCleared = spendGate(FOUNDING_ECONOMY, 60_000, 'harrow-c');
    expect(estateCleared.needsApproval).toBe(false);
    expect(estateCleared.capCents).toBe(90_000);
  });

  it('an estate with no override still reads the house cap', () => {
    const g = spendGate(FOUNDING_ECONOMY, 60_000, 'willow-4');
    expect(g.needsApproval).toBe(true);
    expect(g.capCents).toBe(FOUNDING_ECONOMY.spendApprovalCents);
  });

  it('needsOwnerApproval agrees with spendGate for the estate override', () => {
    expect(needsOwnerApproval(FOUNDING_ECONOMY, 60_000, 'harrow-c')).toBe(false);
    expect(needsOwnerApproval(FOUNDING_ECONOMY, 60_000)).toBe(true);
  });
});

describe('reconcileSpend — estate-aware ceiling, backward-compatible', () => {
  it('the three-arg call (no estate) reads the house cap exactly as before', () => {
    // quote $300, house cap $400 → ceiling $400; a $350 invoice clears.
    const r = reconcileSpend(FOUNDING_ECONOMY, 30_000, 35_000);
    expect(r.authorizedCeilingCents).toBe(35_000);
    expect(r.withinAuthorization).toBe(true);
  });

  it("an estate's own NTE governs the settlement ceiling where it has one", () => {
    // quote $600, harrow-c cap $1,000 → ceiling $1,000; a $900 invoice clears
    // on harrow-c but overruns the $600 house-capped ceiling.
    const est = reconcileSpend(FOUNDING_ECONOMY, 60_000, 90_000, 'harrow-c');
    expect(est.authorizedCeilingCents).toBe(90_000);
    expect(est.withinAuthorization).toBe(true);
    const house = reconcileSpend(FOUNDING_ECONOMY, 60_000, 90_000);
    expect(house.authorizedCeilingCents).toBe(60_000);
    expect(house.needsApproval).toBe(true);
  });

  it('an estate with no override still reads the house cap', () => {
    const r = reconcileSpend(FOUNDING_ECONOMY, 30_000, 90_000, 'willow-4');
    expect(r.authorizedCeilingCents).toBe(35_000);
    expect(r.needsApproval).toBe(true);
  });
});
