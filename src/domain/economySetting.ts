// The tenant setting: the mechanism by which a deployment overrides the seed
// tenant's DEMO figures with its own, without any real figure ever living in
// this repository
// (docs/WRIT-ECONOMY.md, the many "loads at the gate as a setting" comments in
// `economy.ts`). LandLord holds the machine; a human's attended switch loads
// a firm's real chart through it. This file is the leash: every value below is a
// SYNTHESIZED, obviously-fake working-fluid example — never any real firm's real
// figures. The real numbers load attended, never in this file.
//
// The patch only reaches the fields `economy.ts` itself marks gate-able: fee
// rates/bases (and the mtm split), spend caps (house and per-estate), and the
// GL chart's codes/names. Everything structural to the posting engine — a
// role, a book, an account's type/normal side, `isTrustCash`/`isBridge` — is
// NOT patchable here; renumbering or retitling never breaks the catalog the
// engine binds to (`role` stays the stable key, exactly as `economy.ts`
// documents for `LedgerAccount`).

import type { EconomyBook, FeeKind, FeeRule, LedgerAccount, BudgetLine } from './economy';

// ── The patch shape — one row per gate-able seam, id-keyed for merge ────────

/** Renames an existing GL account's code and/or display name, by its stable
 *  `role` (never invents a new account — the chart's shape stays the
 *  engine's, only its numbering/labels move at the gate). */
export interface AccountPatch {
  role: string;
  code?: string;
  name?: string;
}

/** Overrides (or adds) one fee rule, keyed by `kind` + `estateId` exactly as
 *  `feeRuleFor` reads it (no `estateId` = the house default rule). Only the
 *  rate-shaped fields gate; `kind`/`estateId` are the key, not patchable
 *  fields of themselves.
 *
 *  Each rate field is tri-state: **absent/undefined** leaves the base value,
 *  a **number** sets it, and **`null` CLEARS it** (removes it from the rule).
 *  Clearing is what lets a real load flip a rule's shape — e.g. turn the
 *  founding flat `renewal` ($300 `flatCents`) into a percentage by setting
 *  `basis:'new_rent'` + `rateBps` AND `flatCents: null`, so `feeAmount` (which
 *  prefers `flatCents`) reads the rate rather than the stale flat amount. */
export interface FeeRulePatch {
  kind: FeeKind;
  estateId?: string;
  basis?: FeeRule['basis'];
  rateBps?: number | null;
  flatCents?: number | null;
  /** The mtm split's firm-cut bps (`FeeRule.splitBps`) — only meaningful on
   *  the `mtm` kind, but left general since `postingsFor`/`mtmSplit` treat it
   *  the same way for any split-shaped kind the future adds. */
  splitBps?: number | null;
}

/** Overrides (or adds) one estate's spend-approval cap, by `estateId`. */
export interface EstateSpendCapPatch {
  estateId: string;
  capCents: number;
}

/** Overrides (or adds) one budget line, keyed by `accountRole` + `estateId`. */
export interface BudgetLinePatch {
  accountRole: string;
  estateId?: string;
  monthlyCents: number;
}

/** A DEEP-PARTIAL of the economy's gate-able fields — every row optional, every
 *  array upserts by its natural key rather than replacing wholesale. `null` or
 *  absent is the default: nothing changes. This is a RECORD (carried on the
 *  chronicle as `economySetting`), never a place real figures live — see the
 *  file header. */
export interface EconomySettingPatch {
  accounts?: AccountPatch[];
  feeRules?: FeeRulePatch[];
  budget?: BudgetLinePatch[];
  /** The house-wide owner-approval spend gate ("the $400 cap"), overridden
   *  wholesale — it is a single scalar, not a row. */
  spendApprovalCents?: number;
  estateSpendCaps?: EstateSpendCapPatch[];
}

// ── The merge — pure, id-keyed, base untouched ──────────────────────────────

function feeRuleKey(kind: FeeKind, estateId?: string): string {
  return `${kind}::${estateId ?? ''}`;
}

/** Apply a tri-state rate field to a rule: `undefined` leaves it, `null` clears
 *  it (removes the key so `feeAmount` no longer reads it), a number sets it. */
function applyRateField(rule: FeeRule, key: 'rateBps' | 'flatCents' | 'splitBps', value: number | null | undefined): void {
  if (value === undefined) return; // leave the base value as-is
  if (value === null) {
    delete rule[key]; // clear — the flip that turns a flat rule into a rate one, and back
    return;
  }
  rule[key] = value;
}

function mergeFeeRules(base: FeeRule[], patches: FeeRulePatch[]): FeeRule[] {
  const merged = base.map((r) => ({ ...r }));
  for (const patch of patches) {
    const key = feeRuleKey(patch.kind, patch.estateId);
    const idx = merged.findIndex((r) => feeRuleKey(r.kind, r.estateId) === key);
    if (idx >= 0) {
      const next: FeeRule = { ...merged[idx] };
      if (patch.basis != null) next.basis = patch.basis;
      applyRateField(next, 'rateBps', patch.rateBps);
      applyRateField(next, 'flatCents', patch.flatCents);
      applyRateField(next, 'splitBps', patch.splitBps);
      merged[idx] = next;
    } else {
      // A wholly new rule (say, an estate-specific rate the setting adds).
      // `basis` is display-only today (nothing in the engine reads it —
      // `feeAmount` only ever needs `rateBps`/`flatCents`), so a patch that
      // names none defaults to 'flat' rather than leaving the row half-typed.
      // A null on a fresh rule means "no such field" (same as absent).
      const fresh: FeeRule = { kind: patch.kind, basis: patch.basis ?? 'flat' };
      if (patch.estateId != null) fresh.estateId = patch.estateId;
      applyRateField(fresh, 'rateBps', patch.rateBps);
      applyRateField(fresh, 'flatCents', patch.flatCents);
      applyRateField(fresh, 'splitBps', patch.splitBps);
      merged.push(fresh);
    }
  }
  return merged;
}

function mergeAccounts(base: LedgerAccount[], patches: AccountPatch[]): LedgerAccount[] {
  const byRole = new Map(base.map((a) => [a.role, a]));
  for (const patch of patches) {
    const existing = byRole.get(patch.role);
    // An unknown role is ignored (leash-safe: the mechanism only renumbers/
    // relabels an account the engine already knows, never invents one).
    if (!existing) continue;
    byRole.set(patch.role, {
      ...existing,
      ...(patch.code != null ? { code: patch.code } : {}),
      ...(patch.name != null ? { name: patch.name } : {}),
    });
  }
  return base.map((a) => byRole.get(a.role) ?? a);
}

function mergeEstateCaps(
  base: { estateId: string; capCents: number }[],
  patches: EstateSpendCapPatch[],
): { estateId: string; capCents: number }[] {
  const merged = base.map((c) => ({ ...c }));
  for (const patch of patches) {
    const idx = merged.findIndex((c) => c.estateId === patch.estateId);
    if (idx >= 0) merged[idx] = { ...merged[idx], capCents: patch.capCents };
    else merged.push({ estateId: patch.estateId, capCents: patch.capCents });
  }
  return merged;
}

function budgetKey(l: { accountRole: string; estateId?: string }): string {
  return `${l.accountRole}::${l.estateId ?? ''}`;
}

function mergeBudget(base: BudgetLine[], patches: BudgetLinePatch[]): BudgetLine[] {
  const merged = base.map((l) => ({ ...l }));
  for (const patch of patches) {
    const key = budgetKey(patch);
    const idx = merged.findIndex((l) => budgetKey(l) === key);
    if (idx >= 0) merged[idx] = { ...merged[idx], monthlyCents: patch.monthlyCents };
    else merged.push({ accountRole: patch.accountRole, estateId: patch.estateId, monthlyCents: patch.monthlyCents });
  }
  return merged;
}

/** Deep-merges a gate-able patch over a base economy, returning a NEW book —
 *  the base is never mutated, and a null/absent patch returns the base
 *  UNCHANGED (the default: nothing changes unless a setting is deliberately
 *  provided). Scalars overwrite; the id-keyed arrays (fee rules by
 *  kind+estateId, estate caps by estateId, budget by accountRole+estateId,
 *  accounts by role) upsert by that id rather than by array index, so a
 *  reordered or partial patch never clobbers an unrelated row. */
export function applyEconomySetting(
  base: EconomyBook,
  patch: EconomySettingPatch | null | undefined,
): EconomyBook {
  if (!patch) return base;
  const next: EconomyBook = { ...base };
  if (patch.accounts?.length) next.accounts = mergeAccounts(base.accounts, patch.accounts);
  if (patch.feeRules?.length) next.feeRules = mergeFeeRules(base.feeRules, patch.feeRules);
  if (patch.budget?.length) next.budget = mergeBudget(base.budget ?? [], patch.budget);
  if (patch.spendApprovalCents != null) next.spendApprovalCents = patch.spendApprovalCents;
  if (patch.estateSpendCaps?.length) next.estateSpendCaps = mergeEstateCaps(base.estateSpendCaps ?? [], patch.estateSpendCaps);
  return next;
}

// ── Synthesized examples — NOT any firm's real figures ───────────────────────────
// These exist purely to exercise and document the mechanism. Every number is
// an obviously-fake, round placeholder; the real numbers load attended, never
// in this file (see the header).

/** A tightened house NTE plus one tightened per-estate override — exercises
 *  the scalar spend-cap gate and the estate-caps upsert. */
export const EXAMPLE_TIGHTER_CAPS: EconomySettingPatch = {
  spendApprovalCents: 100000, // $1,000 — synthetic, round; not a real NTE
  estateSpendCaps: [
    { estateId: 'harrow-c', capCents: 200000 }, // $2,000 — synthetic per-estate override
  ],
};

/** A relabeled GL code plus overridden fee/split rates — exercises the
 *  accounts-by-role merge, a fee-rate override, and the mtm split ratio. */
export const EXAMPLE_RENAMED_CHART: EconomySettingPatch = {
  accounts: [{ role: 'mgmt_fee_income', code: '9999', name: 'Example Renamed Management Income' }],
  feeRules: [
    { kind: 'management', rateBps: 500 }, // 5% — a synthetic override of the demo rate
    { kind: 'mtm', splitBps: 5000 }, // 50/50 — a synthetic override of the demo split
  ],
};

// ── The gate's door: validate an operator-pasted patch ──────────────────────
// The attended load takes JSON the operator pastes in. `applyEconomySetting`
// already ignores an unknown account role safely, but a whole-patch parse wants
// to REJECT malformed input up front and tell the operator why, rather than
// silently drop a mistyped field. This is a structural check (shapes and number
// types), NOT a judgement of the figures themselves — the numbers are the
// operator's to enter; the leash is that they enter them attended, never in code.

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A non-negative integer count of cents/bps — the shape every money/rate field
 *  on the patch takes. Rejects negatives, fractions, NaN, Infinity, and strings
 *  (a pasted `"500"` is a mistake worth naming, not a silent coercion). */
function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0;
}

/** The gate-able fee bases `FeeRule.basis` accepts — mirrored here so a patch
 *  naming a bogus basis is rejected at the door rather than folded in. */
const FEE_BASES: FeeRule['basis'][] = [
  'collected_income',
  'gross_rent',
  'new_rent',
  'per_unit',
  'per_adult',
  'flat',
];

/** Parses and structurally validates an operator-pasted `EconomySettingPatch`.
 *  Returns the typed patch on success, or a plain-English reason on failure.
 *  Every field is optional (an empty object is the valid no-op), but any field
 *  that IS present must be well-shaped: arrays carry their key fields, and every
 *  cents/bps value is a non-negative integer. Unknown top-level keys are
 *  rejected (a typo like `feeRule` for `feeRules` would otherwise vanish). */
export function parseEconomySetting(
  json: string,
): { ok: true; patch: EconomySettingPatch } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Not valid JSON — check for a stray comma or quote.' };
  }
  if (!isPlainObject(raw)) return { ok: false, error: 'The setting must be a JSON object, e.g. { "feeRules": [ … ] }.' };

  const allowed = new Set(['accounts', 'feeRules', 'budget', 'spendApprovalCents', 'estateSpendCaps']);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) return { ok: false, error: `Unknown field "${key}". Allowed: ${[...allowed].join(', ')}.` };
  }

  if (raw.accounts !== undefined) {
    if (!Array.isArray(raw.accounts)) return { ok: false, error: '"accounts" must be a list.' };
    for (const a of raw.accounts) {
      if (!isPlainObject(a) || typeof a.role !== 'string' || !a.role) return { ok: false, error: 'Each account needs a "role" (the stable key).' };
      if (a.code !== undefined && typeof a.code !== 'string') return { ok: false, error: `Account "${a.role}": "code" must be text.` };
      if (a.name !== undefined && typeof a.name !== 'string') return { ok: false, error: `Account "${a.role}": "name" must be text.` };
    }
  }

  if (raw.feeRules !== undefined) {
    if (!Array.isArray(raw.feeRules)) return { ok: false, error: '"feeRules" must be a list.' };
    for (const r of raw.feeRules) {
      if (!isPlainObject(r) || typeof r.kind !== 'string' || !r.kind) return { ok: false, error: 'Each fee rule needs a "kind".' };
      if (r.estateId !== undefined && typeof r.estateId !== 'string') return { ok: false, error: `Fee rule "${r.kind}": "estateId" must be text.` };
      if (r.basis !== undefined && !FEE_BASES.includes(r.basis as FeeRule['basis'])) return { ok: false, error: `Fee rule "${r.kind}": "basis" must be one of ${FEE_BASES.join(', ')}.` };
      for (const f of ['rateBps', 'flatCents', 'splitBps'] as const) {
        // null is allowed — it CLEARS the field (turns a flat rule into a rate
        // one, and back). undefined leaves it; a bad type is rejected.
        if (r[f] !== undefined && r[f] !== null && !isCount(r[f])) return { ok: false, error: `Fee rule "${r.kind}": "${f}" must be a whole non-negative number, or null to clear it.` };
      }
    }
  }

  if (raw.budget !== undefined) {
    if (!Array.isArray(raw.budget)) return { ok: false, error: '"budget" must be a list.' };
    for (const l of raw.budget) {
      if (!isPlainObject(l) || typeof l.accountRole !== 'string' || !l.accountRole) return { ok: false, error: 'Each budget line needs an "accountRole".' };
      if (l.estateId !== undefined && typeof l.estateId !== 'string') return { ok: false, error: `Budget line "${l.accountRole}": "estateId" must be text.` };
      if (!isCount(l.monthlyCents)) return { ok: false, error: `Budget line "${l.accountRole}": "monthlyCents" must be a whole non-negative number.` };
    }
  }

  if (raw.spendApprovalCents !== undefined && !isCount(raw.spendApprovalCents)) {
    return { ok: false, error: '"spendApprovalCents" must be a whole non-negative number.' };
  }

  if (raw.estateSpendCaps !== undefined) {
    if (!Array.isArray(raw.estateSpendCaps)) return { ok: false, error: '"estateSpendCaps" must be a list.' };
    for (const c of raw.estateSpendCaps) {
      if (!isPlainObject(c) || typeof c.estateId !== 'string' || !c.estateId) return { ok: false, error: 'Each estate cap needs an "estateId".' };
      if (!isCount(c.capCents)) return { ok: false, error: `Estate cap "${c.estateId}": "capCents" must be a whole non-negative number.` };
    }
  }

  return { ok: true, patch: raw as EconomySettingPatch };
}

/** A one-line tally of what a patch overrides, for the loader's header ("A
 *  setting stands — 3 fee rules · 2 caps · 5 GL codes"). Counts only; never
 *  prints a figure. Returns null for an empty/absent patch (the founding, no
 *  setting loaded). */
export function summarizeSetting(patch: EconomySettingPatch | null | undefined): string | null {
  if (!patch) return null;
  const parts: string[] = [];
  if (patch.accounts?.length) parts.push(`${patch.accounts.length} GL code${patch.accounts.length === 1 ? '' : 's'}`);
  if (patch.feeRules?.length) parts.push(`${patch.feeRules.length} fee rule${patch.feeRules.length === 1 ? '' : 's'}`);
  const capCount = (patch.estateSpendCaps?.length ?? 0) + (patch.spendApprovalCents != null ? 1 : 0);
  if (capCount) parts.push(`${capCount} spend cap${capCount === 1 ? '' : 's'}`);
  if (patch.budget?.length) parts.push(`${patch.budget.length} budget line${patch.budget.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'no overrides';
}
