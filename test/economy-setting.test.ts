// The gate mechanism's own safety net: the merge is correct and id-keyed, the
// base economy is never mutated, an absent patch is truly a no-op, and a
// patched economy still passes the whole-kingdom soundness + fiduciary
// checks. Every figure here is the same synthesized working-fluid the
// mechanism itself declares (see `economySetting.ts`'s header) — nothing
// real.
import { describe, it, expect } from 'vitest';
import { FOUNDING_ECONOMY, feeRuleFor, feeAmount, spendCapFor, mtmSplit, sampleLedger } from '../src/domain/economy';
import {
  applyEconomySetting,
  parseEconomySetting,
  summarizeSetting,
  EXAMPLE_TIGHTER_CAPS,
  EXAMPLE_RENAMED_CHART,
  type EconomySettingPatch,
} from '../src/domain/economySetting';
import { FOUNDING_CHRONICLE, normalizeChronicle, economyOf, isFoundingChronicle } from '../src/domain/chronicle';
import { chronicleSoundnessViolations, assertChronicleSound, fiduciaryViolations } from './invariants';
import { foundingDoc } from './fixtures';
// The seed tenant's demo chart, read as the un-patched base.
const DEMO_ECONOMY_BASE = FOUNDING_ECONOMY;

describe('applyEconomySetting — the merge', () => {
  it('a null/absent patch is a no-op — returns base unchanged (same reference)', () => {
    expect(applyEconomySetting(FOUNDING_ECONOMY, null)).toBe(FOUNDING_ECONOMY);
    expect(applyEconomySetting(FOUNDING_ECONOMY, undefined)).toBe(FOUNDING_ECONOMY);
  });

  it('never mutates the base economy', () => {
    const before = JSON.stringify(FOUNDING_ECONOMY);
    applyEconomySetting(FOUNDING_ECONOMY, EXAMPLE_TIGHTER_CAPS);
    applyEconomySetting(FOUNDING_ECONOMY, EXAMPLE_RENAMED_CHART);
    applyEconomySetting(FOUNDING_ECONOMY, {
      feeRules: [{ kind: 'management', rateBps: 1 }],
      accounts: [{ role: 'mgmt_fee_income', code: '0' }],
      estateSpendCaps: [{ estateId: 'harrow-c', capCents: 1 }],
      spendApprovalCents: 1,
    });
    expect(JSON.stringify(FOUNDING_ECONOMY)).toBe(before);
  });

  it('overrides a fee rate by kind, leaving other rules untouched', () => {
    const patch: EconomySettingPatch = { feeRules: [{ kind: 'management', rateBps: 500 }] };
    const patched = applyEconomySetting(FOUNDING_ECONOMY, patch);
    expect(feeRuleFor(patched, 'management')?.rateBps).toBe(500);
    expect(feeRuleFor(patched, 'leasing')?.rateBps).toBe(feeRuleFor(FOUNDING_ECONOMY, 'leasing')?.rateBps);
    expect(feeRuleFor(DEMO_ECONOMY_BASE, 'management')?.rateBps).toBe(750); // base untouched
  });

  it('overrides the house-wide spend cap', () => {
    const patched = applyEconomySetting(FOUNDING_ECONOMY, { spendApprovalCents: 100000 });
    expect(spendCapFor(patched)).toBe(100000);
    expect(spendCapFor(FOUNDING_ECONOMY)).toBe(FOUNDING_ECONOMY.spendApprovalCents); // base untouched
  });

  it('overrides an existing per-estate cap and upserts a brand-new one', () => {
    const patched = applyEconomySetting(FOUNDING_ECONOMY, {
      estateSpendCaps: [
        { estateId: 'harrow-c', capCents: 200000 }, // overrides the founding row
        { estateId: 'willow-4', capCents: 300000 }, // a new row the founding chart has none of
      ],
    });
    expect(spendCapFor(patched, 'harrow-c')).toBe(200000);
    expect(spendCapFor(patched, 'willow-4')).toBe(300000);
    expect(spendCapFor(patched, 'nowhere-estate')).toBe(patched.spendApprovalCents); // unnamed estate still reads the house cap
    expect(spendCapFor(DEMO_ECONOMY_BASE, 'harrow-c')).toBe(90000); // base untouched
  });

  it('renames a GL account code and name by role', () => {
    const patched = applyEconomySetting(FOUNDING_ECONOMY, EXAMPLE_RENAMED_CHART);
    const acct = patched.accounts.find((a) => a.role === 'mgmt_fee_income');
    expect(acct?.code).toBe('9999');
    expect(acct?.name).toBe('Example Renamed Management Income');
    const baseAcct = FOUNDING_ECONOMY.accounts.find((a) => a.role === 'mgmt_fee_income');
    expect(baseAcct?.code).toBe('4200'); // base untouched
    expect(patched.accounts.length).toBe(FOUNDING_ECONOMY.accounts.length); // no account invented
  });

  it('ignores a GL patch naming a role the chart does not have (leash: never invents an account)', () => {
    const patched = applyEconomySetting(FOUNDING_ECONOMY, {
      accounts: [{ role: 'not_a_real_role', code: '0000' }],
    });
    expect(patched.accounts.length).toBe(FOUNDING_ECONOMY.accounts.length);
    expect(patched.accounts.find((a) => a.role === 'not_a_real_role')).toBeUndefined();
  });

  it('overrides the mtm split ratio', () => {
    const patched = applyEconomySetting(FOUNDING_ECONOMY, { feeRules: [{ kind: 'mtm', splitBps: 5000 }] });
    const split = mtmSplit(patched, 100000);
    expect(split.firmCents).toBe(50000);
    expect(split.ownerCents).toBe(50000);
    const baseSplit = mtmSplit(FOUNDING_ECONOMY, 100000); // base untouched
    expect(baseSplit.firmCents).toBe(35000);
    expect(baseSplit.ownerCents).toBe(65000);
  });

  it('overrides a budget line by accountRole (and can add a new one)', () => {
    const patched = applyEconomySetting(FOUNDING_ECONOMY, {
      budget: [
        { accountRole: 'mgmt_fee_income', monthlyCents: 999900 },
        { accountRole: 'overhead_expense', estateId: 'harrow-c', monthlyCents: 12300 },
      ],
    });
    expect(patched.budget?.find((b) => b.accountRole === 'mgmt_fee_income' && b.estateId == null)?.monthlyCents).toBe(999900);
    expect(patched.budget?.find((b) => b.accountRole === 'overhead_expense' && b.estateId === 'harrow-c')?.monthlyCents).toBe(12300);
    // the house-wide overhead_expense line (no estateId) is a DIFFERENT key — untouched
    expect(patched.budget?.find((b) => b.accountRole === 'overhead_expense' && b.estateId == null)?.monthlyCents).toBe(200000);
  });

  it('an id-keyed array merges by id, not by index', () => {
    // Estate caps: a new id listed BEFORE the override must not shift which
    // row the override lands on — it still matches by estateId.
    const patched = applyEconomySetting(FOUNDING_ECONOMY, {
      estateSpendCaps: [
        { estateId: 'zzz-new', capCents: 111100 },
        { estateId: 'harrow-c', capCents: 222200 },
      ],
    });
    expect(patched.estateSpendCaps).toHaveLength(2);
    expect(patched.estateSpendCaps?.find((c) => c.estateId === 'harrow-c')?.capCents).toBe(222200);
    expect(patched.estateSpendCaps?.find((c) => c.estateId === 'zzz-new')?.capCents).toBe(111100);

    // Fee rules: kind+estateId is the key — an estate-specific override for
    // `management` must not disturb the house-default `management` row (same
    // kind, different id).
    const patched2 = applyEconomySetting(FOUNDING_ECONOMY, {
      feeRules: [{ kind: 'management', estateId: 'harrow-c', rateBps: 900 }],
    });
    expect(feeRuleFor(patched2, 'management', 'harrow-c')?.rateBps).toBe(900);
    expect(feeRuleFor(patched2, 'management')?.rateBps).toBe(750);
    expect(patched2.feeRules.length).toBe(FOUNDING_ECONOMY.feeRules.length + 1); // upserted, not overwritten
  });

  it('null CLEARS a field — flips the founding flat renewal into a % of new rent', () => {
    // feeAmount prefers flatCents, so to make renewal a %-of-new-rent HOUSE rule
    // the patch must clear the demo flat amount, not just set rateBps.
    const patched = applyEconomySetting(FOUNDING_ECONOMY, {
      feeRules: [{ kind: 'renewal', basis: 'new_rent', rateBps: 750, flatCents: null }],
    });
    const rule = feeRuleFor(patched, 'renewal')!;
    expect(rule.basis).toBe('new_rent');
    expect(rule.flatCents).toBeUndefined(); // cleared
    expect(rule.rateBps).toBe(750);
    expect(feeAmount(rule, 200000)).toBe(15000); // 7.5% of $2,000 — not the old flat amount
    expect(feeRuleFor(DEMO_ECONOMY_BASE, 'renewal')?.flatCents).toBe(27500); // base untouched
  });

  it('undefined LEAVES a field; null on a brand-new rule just means absent', () => {
    // undefined leaves the founding flatCents in place (still a flat rule)
    const p1 = applyEconomySetting(FOUNDING_ECONOMY, { feeRules: [{ kind: 'renewal', rateBps: 750 }] });
    expect(feeRuleFor(p1, 'renewal')?.flatCents).toBe(27500);
    // a fresh estate rule with flatCents: null is simply a rate rule (no flat)
    const p2 = applyEconomySetting(FOUNDING_ECONOMY, {
      feeRules: [{ kind: 'management', estateId: 'e1', rateBps: 750, flatCents: null }],
    });
    const r = feeRuleFor(p2, 'management', 'e1')!;
    expect(r.rateBps).toBe(750);
    expect(r.flatCents).toBeUndefined();
  });

  it('scalars overwrite; an unknown top-level field on the patch is ignored', () => {
    const junkPatch = { spendApprovalCents: 77700, notARealField: 'nope' } as unknown as EconomySettingPatch;
    const patched = applyEconomySetting(FOUNDING_ECONOMY, junkPatch);
    expect(spendCapFor(patched)).toBe(77700);
    expect((patched as Record<string, unknown>).notARealField).toBeUndefined();
  });
});

describe('the gate hook — economySetting on the chronicle, economyOf as the reading', () => {
  it('an absent economySetting normalizes through untouched, and economyOf is a true no-op', () => {
    const doc = foundingDoc();
    expect(doc.economySetting).toBeUndefined();
    expect(economyOf(doc)).toBe(doc.economy); // same reference — the gate did nothing
    expect(economyOf(doc)).toEqual(FOUNDING_ECONOMY);
  });

  it('a present economySetting rides the raw record untouched; economyOf folds it in', () => {
    const raw = { ...structuredClone(FOUNDING_CHRONICLE), economySetting: EXAMPLE_TIGHTER_CAPS };
    const doc = normalizeChronicle(raw);
    expect(doc.economySetting).toEqual(EXAMPLE_TIGHTER_CAPS);
    expect(doc.economy).toEqual(FOUNDING_ECONOMY); // the RECORD stays the founding chart
    expect(economyOf(doc).spendApprovalCents).toBe(100000); // the READING folds the setting in
    expect(economyOf(doc).estateSpendCaps?.find((c) => c.estateId === 'harrow-c')?.capCents).toBe(200000);
  });

  it('a present economySetting (even a no-op patch) means the chronicle is no longer "at founding"', () => {
    const doc = foundingDoc();
    doc.economySetting = {};
    expect(isFoundingChronicle(doc)).toBe(false);
  });
});

describe('parseEconomySetting — the loader’s door (validate operator-pasted JSON)', () => {
  it('accepts a well-formed patch and round-trips through applyEconomySetting', () => {
    const json = JSON.stringify({
      feeRules: [{ kind: 'management', rateBps: 750 }],
      spendApprovalCents: 33300,
      estateSpendCaps: [{ estateId: 'willow-4', capCents: 44400 }],
    });
    const res = parseEconomySetting(json);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const patched = applyEconomySetting(FOUNDING_ECONOMY, res.patch);
      expect(feeRuleFor(patched, 'management')?.rateBps).toBe(750);
      expect(spendCapFor(patched)).toBe(33300);
      expect(spendCapFor(patched, 'willow-4')).toBe(44400);
    }
  });

  it('an empty object is the valid no-op patch', () => {
    const res = parseEconomySetting('{}');
    expect(res.ok).toBe(true);
  });

  it('rejects non-JSON, a non-object, and an unknown top-level field', () => {
    expect(parseEconomySetting('{ not json').ok).toBe(false);
    expect(parseEconomySetting('[]').ok).toBe(false);
    expect(parseEconomySetting('42').ok).toBe(false);
    const typo = parseEconomySetting('{ "feeRule": [] }'); // singular — a typo that must not vanish silently
    expect(typo.ok).toBe(false);
    if (!typo.ok) expect(typo.error).toContain('feeRule');
  });

  it('accepts null on a rate field (clear) but still rejects other non-numbers', () => {
    expect(parseEconomySetting('{ "feeRules": [{ "kind": "renewal", "basis": "new_rent", "rateBps": 750, "flatCents": null }] }').ok).toBe(true);
    expect(parseEconomySetting('{ "feeRules": [{ "kind": "renewal", "flatCents": "nope" }] }').ok).toBe(false);
  });

  it('rejects malformed rows and bad number shapes', () => {
    expect(parseEconomySetting('{ "accounts": [{ "code": "9500" }] }').ok).toBe(false); // no role
    expect(parseEconomySetting('{ "feeRules": [{ "rateBps": 750 }] }').ok).toBe(false); // no kind
    expect(parseEconomySetting('{ "feeRules": [{ "kind": "management", "basis": "made_up" }] }').ok).toBe(false);
    expect(parseEconomySetting('{ "feeRules": [{ "kind": "management", "rateBps": -5 }] }').ok).toBe(false);
    expect(parseEconomySetting('{ "feeRules": [{ "kind": "management", "rateBps": 8.5 }] }').ok).toBe(false);
    expect(parseEconomySetting('{ "spendApprovalCents": "400" }').ok).toBe(false); // a string, not a number
    expect(parseEconomySetting('{ "estateSpendCaps": [{ "capCents": 44400 }] }').ok).toBe(false); // no estateId
  });
});

describe('summarizeSetting — the loader’s header tally', () => {
  it('is null for an absent patch (founding, no setting)', () => {
    expect(summarizeSetting(undefined)).toBeNull();
    expect(summarizeSetting(null)).toBeNull();
  });

  it('counts each kind of override, and the house cap as one', () => {
    const s = summarizeSetting({
      accounts: [{ role: 'mgmt_fee_income', code: '9500' }],
      feeRules: [{ kind: 'management', rateBps: 750 }, { kind: 'renewal', basis: 'new_rent', rateBps: 750 }],
      spendApprovalCents: 33300,
      estateSpendCaps: [{ estateId: 'a', capCents: 1 }, { estateId: 'b', capCents: 2 }],
    });
    expect(s).toContain('1 GL code');
    expect(s).toContain('2 fee rules');
    expect(s).toContain('3 spend caps'); // 2 estate caps + the house cap
  });
});

describe('a real-shaped fee basis flip works end-to-end (leash-safe synthetic figures)', () => {
  it('renewal flat→% : a new_rent-basis override yields a percentage of new rent via feeAmount', () => {
    // The founding renewal rule is a flat amount; the reverse shape (a % of new
    // rent) is what a real load would flip it to — value-only, no schema change.
    // A fresh estate rule sets rateBps and omits flatCents (feeAmount prefers
    // flatCents when present, so a %-basis rule must not carry one).
    const fresh = applyEconomySetting(FOUNDING_ECONOMY, {
      feeRules: [{ kind: 'renewal', estateId: 'willow-4', basis: 'new_rent', rateBps: 750 }],
    });
    const rule = feeRuleFor(fresh, 'renewal', 'willow-4')!;
    expect(rule.basis).toBe('new_rent');
    // 7.5% of a synthetic $2,000 new rent = $150.
    expect(feeAmount(rule, 200000)).toBe(15000);
  });

  it('mtm %→flat : a flat-basis override splits 50/50 on the entered premium', () => {
    // The reverse flip: a flat premium rule (rather than the founding %-of-rent).
    // feeAmount honors flatCents; the caller (hand-entry today) passes that
    // premium to mtmSplit, which splits it by splitBps. Synthetic figures.
    const patched = applyEconomySetting(FOUNDING_ECONOMY, {
      feeRules: [{ kind: 'mtm', estateId: 'willow-4', basis: 'flat', flatCents: 22200, splitBps: 5000 }],
    });
    const rule = feeRuleFor(patched, 'mtm', 'willow-4')!;
    const premium = feeAmount(rule, 999999); // flat: basisCents is ignored, always $222
    expect(premium).toBe(22200);
    const split = mtmSplit(applyEconomySetting(FOUNDING_ECONOMY, { feeRules: [{ kind: 'mtm', splitBps: 5000 }] }), premium);
    expect(split.firmCents).toBe(11100);
    expect(split.ownerCents).toBe(11100);
  });
});

describe('money invariants still hold after a patch', () => {
  it('a GL-rename + fee-rate + mtm-split patch stays sound over a dealt month', () => {
    const patchedEconomy = applyEconomySetting(FOUNDING_ECONOMY, EXAMPLE_RENAMED_CHART);
    const doc = foundingDoc();
    doc.economy = patchedEconomy;
    doc.money = sampleLedger(patchedEconomy, '2026-07-01T00:00:00.000Z');
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc)).toEqual([]);
    expect(() => assertChronicleSound(doc)).not.toThrow();
  });

  it('a tightened-cap patch stays sound over a dealt month (spend caps do not touch the postings)', () => {
    const patchedEconomy = applyEconomySetting(FOUNDING_ECONOMY, EXAMPLE_TIGHTER_CAPS);
    const doc = foundingDoc();
    doc.economy = patchedEconomy;
    doc.money = sampleLedger(patchedEconomy, '2026-07-01T00:00:00.000Z');
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
    expect(fiduciaryViolations(doc)).toEqual([]);
  });
});
