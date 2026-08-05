// Founding-doc factory + in-memory chronicle fixtures for the safety net.
// Reuses the real domain founding constants and generators — nothing here is a
// second source of truth; the fixtures are the same records the app folds.
import {
  FOUNDING_CHRONICLE,
  normalizeChronicle,
  type Chronicle,
} from '../src/domain/chronicle';
import { FOUNDING_CATALOG } from '../src/domain/catalog';
import { FOUNDING_FLOWS } from '../src/domain/flows';
import { FOUNDING_ECONOMY, type MoneyEvent, type MoneyKind } from '../src/domain/economy';
import { generateGrandMuster } from '../src/domain/wargame';

/** A fresh clean founding chronicle (deep-cloned so a test can mutate freely). */
export function foundingDoc(): Chronicle {
  return normalizeChronicle(structuredClone(FOUNDING_CHRONICLE));
}

/** A fully-dealt grand muster on the founding setting — a realistic ~200-door
 *  operation as events + money, exactly what a deploy appends. Deterministic
 *  by seed. Returns the doc plus the raw game for finer assertions. */
export function grandMusterDoc(seed = 'safety-net-muster', end = '2026-07-21T00:00:00.000Z') {
  const game = generateGrandMuster({
    seed,
    end,
    flows: FOUNDING_FLOWS,
    catalog: FOUNDING_CATALOG,
    economy: FOUNDING_ECONOMY,
  });
  const doc = foundingDoc();
  doc.events = game.events;
  doc.money = game.money;
  doc.wargame = { seed, now: game.now, doors: game.doors, tally: game.tally } as Chronicle['wargame'];
  return { doc, game };
}

/** Every MoneyKind in the union — the R1 guard iterates this so a new kind that
 *  forgets its posting case is caught (postingsFor would silently return []). */
export const ALL_MONEY_KINDS: MoneyKind[] = [
  'rent_charged', 'rent_received', 'deposit_received', 'deposit_refunded',
  'vendor_bill', 'vendor_paid', 'owner_contribution', 'owner_draw',
  'reserve_funded', 'management_fee', 'leasing_fee', 'renewal_fee', 'markup',
  'late_fee', 'nsf_fee', 'admin_fee', 'reletting_fee', 'ancillary_fee',
  'pet_rent', 'utility_reimbursement', 'moveout_reserve_withheld', 'fee_sweep',
  'corp_expense', 'corp_income_other',
  // The AppFolio-recon streams added at the gate (slice 1) — R1 enforces each balances.
  'rbp_fee', 'pet_damage_fee', 'risk_enforcement_fee', 'project_coordination_fee',
  'annual_admin_fee', 'referral_fee', 'warranty_fee', 'application_fee',
  'ac_seasonal_fee', 'vendor_discount', 'owner_concession', 'tenant_chargeback',
  // Bank segregation (slice-2b).
  'commission_sweep', 'irs_withholding',
  // The month-to-month premium split (slice-2c) — R1 enforces each balances.
  'mtm_premium', 'mtm_fee',
  // The late-fee firm share (a fee on the collected late fee, on the bridge).
  'late_fee_share',
];

let seq = 0;
/** A minimal well-formed money event of a given kind, carrying the dimensions
 *  the postings need. `accountRole` is set for the corporate-only kinds. */
export function moneyEvent(kind: MoneyKind, amountCents = 10_000): MoneyEvent {
  seq += 1;
  const e: MoneyEvent = {
    id: `fix-${kind}-${seq}`,
    at: '2026-07-01T00:00:00.000Z',
    kind,
    amountCents,
    estateId: 'estate-1',
    ownerId: 'owner-1',
    tenantId: 'tenant-1',
    vendorId: 'vendor-1',
  };
  if (kind === 'corp_expense') e.accountRole = 'overhead_expense';
  if (kind === 'corp_income_other') e.accountRole = 'other_income';
  return e;
}

export { FOUNDING_ECONOMY };
