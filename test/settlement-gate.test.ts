// THE SETTLEMENT GATE — the money law's first runtime refusal.
//
// Until 2026-08-07 every statement this kingdom made about money was a statement
// and not a constraint (docs/WRIT-THE-GATE.md): the fiduciary invariant was
// reachable only from a test, `spendGate` returned a struct that could not fail,
// and the writer that actually posts coin — `settlementMoney` — consulted no
// ceiling at all. These tests exist so that cannot quietly become true again.

import { describe, it, expect } from 'vitest';
import { FOUNDING_ECONOMY, settlementGate, spendCapFor } from '../src/domain/economy';

const CAP = spendCapFor(FOUNDING_ECONOMY)!;

describe('the settlement gate refuses', () => {
  it('a bill above the cap that NOBODY ratified', () => {
    // The whole point. A case walked to settlement entirely by machine carries
    // no ratification, because no clerk may emit one — so this is precisely the
    // "an agent spent an owner's money unattended" case.
    const g = settlementGate(FOUNDING_ECONOMY, CAP + 100_00, false);
    expect(g.refused).toBe(true);
    expect(g.reason).toMatch(/NOBODY RATIFIED/);
  });

  it('a bill nobody priced', () => {
    // No coin moves on a number nobody produced — and zero is not a licence.
    expect(settlementGate(FOUNDING_ECONOMY, 0, true).refused).toBe(true);
    expect(settlementGate(FOUNDING_ECONOMY, -1, true).refused).toBe(true);
    expect(settlementGate(FOUNDING_ECONOMY, Number.NaN, true).refused).toBe(true);
  });
});

describe('the settlement gate allows', () => {
  it('a bill within the cap, ratified or not — that is what a cap IS', () => {
    // A guard that refuses everything passes every refusal test and ships a
    // system that can never pay a plumber.
    expect(settlementGate(FOUNDING_ECONOMY, CAP - 1, false).refused).toBe(false);
    expect(settlementGate(FOUNDING_ECONOMY, CAP, false).refused).toBe(false);
  });

  it('a bill above the cap that a HUMAN ratified', () => {
    const g = settlementGate(FOUNDING_ECONOMY, CAP + 100_00, true);
    expect(g.refused).toBe(false);
    expect(g.reason).toMatch(/a human ratified/i);
  });

  it('any bill where the deployment set no cap — ungated, and it says so', () => {
    // Absent a threshold nothing is gated. Inventing one here would be the
    // sentinel-wearing-a-dollar-sign this project has already ruled against.
    const noCap = { ...FOUNDING_ECONOMY, spendApprovalCents: undefined };
    const g = settlementGate(noCap, 10_000_00, false);
    expect(g.refused).toBe(false);
    expect(g.reason).toMatch(/ungated/);
  });
});

describe('the gate reads the estate that bears the cost', () => {
  it("an estate's own cap governs over the house cap", () => {
    const tight = {
      ...FOUNDING_ECONOMY,
      estateSpendCaps: [{ estateId: 'a-door', capCents: 100 }],
    };
    // Under the house cap, but over this estate's own — and unratified.
    expect(settlementGate(tight, 200, false, 'a-door').refused).toBe(true);
    expect(settlementGate(tight, 200, false, 'another-door').refused).toBe(false);
  });
});

describe('the boundary is exact', () => {
  it('at the cap settles; one cent over does not', () => {
    // Off-by-one here is somebody's money, so it is pinned rather than assumed.
    expect(settlementGate(FOUNDING_ECONOMY, CAP, false).refused).toBe(false);
    expect(settlementGate(FOUNDING_ECONOMY, CAP + 1, false).refused).toBe(true);
  });
});
