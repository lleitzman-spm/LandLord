// The economy — the two treasuries, kept the constitutional way: records in,
// readings out. A residential property manager is a fiduciary running two money
// worlds at once (docs/RESEARCH-ECONOMY.md, docs/KINGDOM.md "The economy"):
//
//   • the ESTATES in trust (the AppFolio dimension) — the Patrons' rents,
//     deposits, reserves, and the vendor costs of their doors; the Crown only
//     holds and moves this, per estate and per owner. Fiduciary money.
//   • the CROWN's own coin (the QuickBooks dimension) — the FEES it earns for
//     keeping the estates (tribute), against its upkeep. The company's money.
//
// The two worlds meet at exactly one hinge — the fee bridge: a management/leasing/
// markup fee is simultaneously an EXPENSE to an owner in trust and REVENUE to the
// company, carried across by the mirrored Due-to-Mgmt / Due-from-Trust pair.
//
// THE RE-EXPRESSION (docs/WRIT-ECONOMY.md): the research's §6 stores a Postgres
// double-entry POSTINGS table; the kingdom stores only the money EVENT and FOLDS
// the postings from a pure catalog on every read. So the ledger can never drift
// from the events, and a correction is a reversing event, never an edit. This is
// the general economy COMPONENT — a working-fluid founding chart exercises it;
// a firm's real accounts, fee rules, and figures load at the data gate.

// ── The two books ───────────────────────────────────────────────────────────

export type Book = 'trust' | 'corporate';
export type AcctType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type Side = 'debit' | 'credit';

/** The physical bank account a cash/clearing account sits in — the segregation
 *  the Book enum deliberately does NOT carry (a firm runs several banks within
 *  one book: an operating checking AND a By-Pass account for commissions, both
 *  corporate). A plain string-union so a setting can widen it at the gate; every
 *  reading treats an unknown value tolerantly (group-by, never exhaustive). */
export type BankId = 'operating' | 'by-pass' | 'trust-rent' | 'trust-deposit' | 'trust-reserve';

/** A line in the chart of accounts. `role` is the stable key the posting catalog
 *  references (code is display/convention), so the catalog is legible and a
 *  setting may renumber codes without breaking the engine. */
export interface LedgerAccount {
  role: string;
  code: string;
  name: string;
  book: Book;
  type: AcctType;
  /** The side a positive balance sits on — debit for assets/expenses, credit for
   *  liabilities/equity/income. Folded from `type` at founding, kept explicit. */
  normal: Side;
  /** A trust bank the solvency reading counts as cash held in trust. */
  isTrustCash?: boolean;
  /** One of the two clearing accounts of the fee bridge. */
  isBridge?: boolean;
  /** The physical bank account this cash/clearing account sits in — for the
   *  per-account bank reconciliation. Absent on non-cash accounts (AR/AP, the
   *  bridge clearing, income/expense, the IRS payable — none is a bank). */
  bank?: BankId;
}

export type FeeKind =
  | 'management'
  | 'leasing'
  | 'renewal'
  | 'markup'
  | 'late_split'
  | 'nsf'
  | 'admin'
  | 'reletting'
  | 'ancillary'
  // ── The named fee streams a field reconciliation against a live trust-accounting system surfaced (leash-safe
  //    STRUCTURE — the real rates load at the gate as a setting) ──
  | 'mtm' // month-to-month premium (owner/firm split — the split ratio gates)
  | 'application' // application fee, per adult
  | 'rbp' // resident-benefit package (split out of the ancillary catch-all)
  | 'pet_damage' // pet-damage guarantee
  | 'risk_enforcement' // risk / lease-enforcement
  | 'project_coordination' // project / make-ready coordination
  | 'annual_admin' // annual administrative fee
  | 'referral' // referral fee the firm earns
  | 'warranty' // home-warranty coordination
  | 'ac_seasonal' // portable-AC seasonal rental
  | 'vendor_discount'; // discounts the firm keeps on vendor work

/** How a fee is computed — a % in basis points (800 = 8%) of a basis amount, or
 *  a flat cents. `estateId` absent = the house default rule for that kind. The
 *  `new_rent` / `per_adult` bases are the AppFolio recon's (renewal = % of the
 *  NEW rent; application = a flat per adult). */
export interface FeeRule {
  kind: FeeKind;
  basis: 'collected_income' | 'gross_rent' | 'new_rent' | 'per_unit' | 'per_adult' | 'flat';
  rateBps?: number;
  flatCents?: number;
  estateId?: string;
  /** For a SPLIT kind (today only `mtm`): the firm's cut of the fee, in bps of
   *  the whole (10000 = the firm keeps it all). Absent → `mtmSplit` falls back
   *  to `MTM_FIRM_SPLIT_BPS`. Working-fluid; the REAL split ratio loads at the
   *  data gate as a setting, per-owner-agreement if a firm's ever varies. */
  splitBps?: number;
}

/** A planned monthly amount for an account — the budget line the actual postings
 *  are measured against (§6.5 #4). `estateId` absent = the whole operation. */
export interface BudgetLine {
  accountRole: string;
  monthlyCents: number;
  estateId?: string;
}

export interface EconomyBook {
  accounts: LedgerAccount[];
  feeRules: FeeRule[];
  /** The plan the actuals are read against (budget-vs-actual). Optional so a
   *  chronicle predating it normalizes without one. */
  budget?: BudgetLine[];
  /** The owner-approval spend gate (a firm's recon's "$400 cap"): a repair whose
   *  cost is AT OR ABOVE this needs owner approval before the vendor proceeds;
   *  below it, the clerk/vendor may complete on-site. General/working-fluid — a
   *  setting loads the firm's real cap. Optional; absent = no gate. The
   *  vendor-dispatch flow's approval step reads it (docs/WRIT-ECONOMY.md). */
  spendApprovalCents?: number;
  /** Per-estate overrides of the house spend cap (slice 2) — a door with its own
   *  owner-agreed NTE. Records, not a map (the records-in doctrine): each row
   *  names the estate and its cap; an estate with no row here just reads the
   *  house cap. `spendCapFor` folds this; optional/additive so a chronicle
   *  predating it (or any estate not listed) normalizes to the house-wide gate
   *  unchanged. */
  estateSpendCaps?: { estateId: string; capCents: number }[];
}

// ── The money-dimension — an append-only event stream ───────────────────────
// What happened and to whom; the balanced postings are folded, never stored.

export type MoneyKind =
  | 'rent_charged'
  | 'rent_received'
  | 'deposit_received'
  | 'deposit_refunded'
  | 'vendor_bill'
  | 'vendor_paid'
  | 'owner_contribution'
  | 'owner_draw'
  | 'reserve_funded'
  | 'management_fee'
  | 'leasing_fee'
  | 'renewal_fee'
  | 'markup'
  | 'late_fee'
  // ── Ancillary streams a firm's recon surfaced (leash-safe structure; general
  //    PM kinds, working-fluid — a setting loads the real rates at the gate) ──
  | 'nsf_fee' // a returned-payment fee the firm keeps (company income)
  | 'admin_fee' // an administrative fee the firm keeps
  | 'reletting_fee' // early-termination reletting fee (≈ one month's rent), the firm's
  | 'ancillary_fee' // resident-benefit-package / ancillary programs, the firm's share
  | 'pet_rent' // pet rent — the owner's income, collected in trust
  | 'utility_reimbursement' // RUBS / tenant utility reimbursement — the owner's, in trust
  | 'moveout_reserve_withheld' // reserve held back from final rent for vacancy costs
  // ── The named streams a field reconciliation against a live trust-accounting system surfaced (leash-safe STRUCTURE;
  //    the firm's own income unless noted — real rates load at the gate) ──
  | 'rbp_fee' // resident-benefit package — the firm's (split out of ancillary)
  | 'pet_damage_fee' // pet-damage guarantee — the firm's
  | 'risk_enforcement_fee' // risk / lease-enforcement — the firm's
  | 'project_coordination_fee' // project / make-ready coordination — the firm's
  | 'annual_admin_fee' // annual administrative fee — the firm's
  | 'referral_fee' // referral the firm earns
  | 'warranty_fee' // home-warranty coordination — the firm's
  | 'application_fee' // application fee (per adult) — the firm's
  | 'ac_seasonal_fee' // portable-AC seasonal rental — the firm's
  | 'vendor_discount' // a vendor discount the firm keeps — the firm's
  | 'owner_concession' // a rent credit the owner grants the tenant (contra income, in trust)
  | 'tenant_chargeback' // a move-out penalty charged the tenant, owed the owner (in trust)
  // ── The month-to-month premium split (slice 2) — the WHOLE premium is owner
  //    income in trust (mirrors pet_rent); the firm's cut then rides the fee
  //    bridge same as management_fee, a fee ON that income, not a separate
  //    tenant charge. `mtmSplit` (pure, economy-driven) computes both cents
  //    amounts; the caller records ONE `mtm_premium` for the owner's share and,
  //    if the split names a firm cut, ONE `mtm_fee` for the firm's ──
  | 'mtm_premium' // month-to-month premium — the owner's share, collected in trust
  | 'mtm_fee' // month-to-month premium — the firm's share, ridden across the bridge
  // The firm's share of a late fee — a fee on the COLLECTED late fee, taken like
  // `management_fee` is on collected rent (the bridge). Recognized on COLLECTION,
  // never on the charge: the tenant is billed the whole late fee (`late_fee`, AR),
  // the owner's income accrues, and only once that fee is PAID (cash in trust)
  // does the firm take its cut — so its accrual is cash-backed, never funded from
  // another owner's pooled cash. (The naive charge-time split was unsound — it
  // under-billed the tenant and drew the firm's cut from a receivable; reverted,
  // then rebuilt this way.)
  | 'late_fee_share' // late fee — the firm's share of the COLLECTED fee, on the bridge
  | 'fee_sweep'
  // ── Bank segregation (slice-2b) ──
  | 'commission_sweep' // commission (markup) swept to the By-Pass bank, never operating
  | 'irs_withholding' // 1099 backup withholding held for the IRS out of a vendor payment
  | 'corp_expense'
  | 'corp_income_other';

export interface MoneyEvent {
  id: string;
  /** When it occurred (the charge/assessment date). */
  at: string;
  /** When cash settled, when different — the three-dates problem (§3.4). */
  settledOn?: string;
  kind: MoneyKind;
  amountCents: number;
  estateId?: string;
  ownerId?: string;
  tenantId?: string;
  vendorId?: string;
  /** For `corp_expense` / `corp_income_other`: the account role that moves (which
   *  overhead line, which ancillary income). Ignored by the fixed-shape kinds. */
  accountRole?: string;
  memo?: string;
  /** Link back to the operational spine — a work `caseId`, a lease, a WO. */
  sourceId?: string;
  /** The War Game that dealt it, when one did (`<seed>`) — money has no `caseId`
   *  to bear the `wg/` mark, so this field carries it: Reset strikes exactly the
   *  events its game stamped, leaving any hand-recorded money standing. */
  wg?: string;
}

export type MoneyLog = MoneyEvent[];

// ── The founding chart — working fluid, both books (from §5) ─────────────────
// Not a firm's real chart (that loads at the gate) — enough of both worlds to
// exercise the engine, the bridge, and the four readings. Codes follow the
// common 1000-block convention (asset 1xxx, liability 2xxx, equity 3xxx, income
// 4xxx, expense 5xxx); the `role` is what the catalog binds to.

function acctRow(
  role: string,
  code: string,
  name: string,
  book: Book,
  type: AcctType,
  extra: Partial<LedgerAccount> = {},
): LedgerAccount {
  const normal: Side = type === 'asset' || type === 'expense' ? 'debit' : 'credit';
  return { role, code, name, book, type, normal, ...extra };
}

export const FOUNDING_ECONOMY: EconomyBook = {
  accounts: [
    // ── Trust book (the estates in trust) ──
    acctRow('trust_cash_rent', '1010', 'Trust Checking — Rent Collections', 'trust', 'asset', { isTrustCash: true, bank: 'trust-rent' }),
    acctRow('trust_cash_deposits', '1020', 'Trust Checking — Security Deposits', 'trust', 'asset', { isTrustCash: true, bank: 'trust-deposit' }),
    acctRow('owner_reserve_cash', '1030', 'Owner Reserve Checking', 'trust', 'asset', { isTrustCash: true, bank: 'trust-reserve' }),
    acctRow('ar_tenants', '1200', 'Accounts Receivable — Tenants', 'trust', 'asset'),
    acctRow('security_deposits_held', '2010', 'Security Deposits Held', 'trust', 'liability'),
    acctRow('owner_reserves_held', '2020', 'Owner Reserves Held', 'trust', 'liability'),
    acctRow('ap_vendors', '2100', 'Accounts Payable — Vendors', 'trust', 'liability'),
    acctRow('irs_withholding_payable', '2110', 'IRS Backup Withholding Payable', 'trust', 'liability'),
    acctRow('due_to_mgmt', '2400', 'Due to Management Company', 'trust', 'liability', { isBridge: true }),
    acctRow('owner_equity', '3000', "Owner's Equity / Net Held", 'trust', 'equity'),
    acctRow('rent_income', '4000', 'Rent Income', 'trust', 'income'),
    acctRow('late_fee_income', '4100', 'Late Fee Income', 'trust', 'income'),
    acctRow('pet_rent_income', '4110', 'Pet Rent', 'trust', 'income'),
    acctRow('utility_reimb_income', '4120', 'Utility Reimbursement (RUBS)', 'trust', 'income'),
    acctRow('chargeback_income', '4130', 'Tenant Chargeback (owner)', 'trust', 'income'),
    acctRow('mtm_premium_income', '4140', 'Month-to-Month Premium (owner)', 'trust', 'income'),
    acctRow('moveout_reserve_held', '2030', 'Move-Out Reserve Held', 'trust', 'liability'),
    acctRow('repairs_expense', '5000', 'Repairs & Maintenance', 'trust', 'expense'),
    acctRow('mgmt_fee_expense', '5300', 'Management Fee (owner expense)', 'trust', 'expense'),
    acctRow('leasing_fee_expense', '5310', 'Leasing / Placement Fee (owner expense)', 'trust', 'expense'),
    acctRow('markup_expense', '5320', 'Maintenance Markup (owner expense)', 'trust', 'expense'),
    acctRow('mtm_fee_expense', '5330', 'Month-to-Month Premium Fee (owner expense)', 'trust', 'expense'),
    acctRow('late_fee_share_expense', '5340', 'Late Fee Share (owner expense)', 'trust', 'expense'),
    // ── Corporate book (the Crown's own coin) ──
    acctRow('op_cash', '1000', 'Operating Checking', 'corporate', 'asset', { bank: 'operating' }),
    acctRow('bypass_cash', '1005', 'By-Pass Checking — Commissions', 'corporate', 'asset', { bank: 'by-pass' }),
    acctRow('due_from_trust', '1200c', 'Due from Trust', 'corporate', 'asset', { isBridge: true }),
    acctRow('ap_corp', '2000c', 'Accounts Payable — Company', 'corporate', 'liability'),
    acctRow('mgmt_fee_income', '4200', 'Management Fee Income', 'corporate', 'income'),
    acctRow('leasing_income', '4210', 'Leasing / Placement Income', 'corporate', 'income'),
    acctRow('markup_income', '4220', 'Maintenance Markup Income', 'corporate', 'income'),
    acctRow('late_fee_share_income', '4230', 'Late Fee Share', 'corporate', 'income'),
    acctRow('renewal_income', '4215', 'Renewal Fee Income', 'corporate', 'income'),
    acctRow('mtm_income', '4216', 'Month-to-Month Premium Fee Income', 'corporate', 'income'),
    acctRow('nsf_income', '4240', 'NSF Fee Income', 'corporate', 'income'),
    acctRow('admin_income', '4250', 'Administrative Fee Income', 'corporate', 'income'),
    acctRow('reletting_income', '4260', 'Reletting Fee Income', 'corporate', 'income'),
    acctRow('ancillary_income', '4270', 'Ancillary Income', 'corporate', 'income'),
    // ── The named firm-income streams a firm's recon split out of ancillary ──
    acctRow('rbp_income', '4271', 'Resident Benefit (RBP) Income', 'corporate', 'income'),
    acctRow('pet_damage_income', '4272', 'Pet Damage Guarantee Income', 'corporate', 'income'),
    acctRow('risk_enforcement_income', '4273', 'Risk / Enforcement Income', 'corporate', 'income'),
    acctRow('project_coord_income', '4274', 'Project Coordination Income', 'corporate', 'income'),
    acctRow('annual_admin_income', '4275', 'Annual Admin Income', 'corporate', 'income'),
    acctRow('referral_income', '4276', 'Referral Income', 'corporate', 'income'),
    acctRow('warranty_income', '4277', 'Warranty Coordination Income', 'corporate', 'income'),
    acctRow('application_income', '4278', 'Application Fee Income', 'corporate', 'income'),
    acctRow('ac_seasonal_income', '4279', 'Seasonal AC Rental Income', 'corporate', 'income'),
    acctRow('vendor_discount_income', '4280', 'Vendor Discount Income', 'corporate', 'income'),
    acctRow('other_income', '4300', 'Other / Ancillary Income', 'corporate', 'income'),
    acctRow('payroll_expense', '5100c', 'Payroll & Contractor Labor', 'corporate', 'expense'),
    acctRow('software_expense', '5200c', 'Software & Platforms', 'corporate', 'expense'),
    acctRow('overhead_expense', '5400c', 'Office, Insurance & Overhead', 'corporate', 'expense'),
  ],
  feeRules: [
    // ── DEMO TENANT FEE SCHEDULE ────────────────────────────────────────────
    // Every figure below is ILLUSTRATIVE DEMO DATA for the fictional seed
    // tenant, chosen to exercise the engine and read plainly on screen. They
    // are NOT anyone's terms and no deployment should ship them: a real tenant
    // configures its own through the gate (`applyEconomySetting`,
    // `src/domain/economySetting.ts`), which is the supported path and the only
    // one. Rates are basis points (750 = 7.5%); money is integer cents.
    { kind: 'management', basis: 'collected_income', rateBps: 750 }, // demo: 7.5% of collected
    { kind: 'leasing', basis: 'gross_rent', rateBps: 7500 }, // demo: three-quarters of a month
    { kind: 'markup', basis: 'flat', rateBps: 1250 }, // demo: 12.5% of a vendor bill
    { kind: 'renewal', basis: 'flat', flatCents: 27500 }, // demo: $275 flat
    { kind: 'reletting', basis: 'gross_rent', rateBps: 7500 }, // demo: three-quarters of a month
    { kind: 'nsf', basis: 'flat', flatCents: 5500 }, // demo: $55 flat
    { kind: 'admin', basis: 'flat', flatCents: 4500 }, // demo: $45 flat
    { kind: 'ancillary', basis: 'flat', flatCents: 5500 }, // demo: $55/mo resident benefit
    // ── The wider fee vocabulary the model carries ──────────────────────────
    // The KINDS here are the product: a PM firm's income really does arrive in
    // these named streams, and the engine has to post each one correctly. The
    // RATES are demo data like everything else above.
    { kind: 'application', basis: 'per_adult', flatCents: 4000 }, // demo: $40 per adult
    { kind: 'rbp', basis: 'flat', flatCents: 3500 }, // demo: $35/mo resident benefit
    { kind: 'pet_damage', basis: 'flat', flatCents: 2000 }, // demo: $20/mo
    { kind: 'risk_enforcement', basis: 'flat', flatCents: 1250 }, // demo: $12.50/mo
    { kind: 'project_coordination', basis: 'flat', flatCents: 17500 }, // demo: $175
    { kind: 'annual_admin', basis: 'flat', flatCents: 15000 }, // demo: $150/yr
    { kind: 'referral', basis: 'flat', flatCents: 35000 }, // demo: $350
    { kind: 'warranty', basis: 'flat', flatCents: 6500 }, // demo: $65
    { kind: 'ac_seasonal', basis: 'flat', flatCents: 12500 }, // demo: $125/season
    // The whole month-to-month premium (owner income in trust); the firm's cut
    // of it rides the bridge as its own fee (`mtm_fee`, sized by `splitBps`
    // below) — NOT a separate tenant charge. Demo premium rate and demo split.
    { kind: 'mtm', basis: 'new_rent', rateBps: 750, splitBps: 3500 }, // demo: 7.5% of new rent; firm keeps 35% of it
    // The firm's share of a COLLECTED late fee — only `splitBps` is read (by
    // `lateFeeSplit`), taken on collection like the mgmt fee on collected rent.
    // Demo split; whether a firm keeps all, some or none of a late fee is a
    // per-tenant term and belongs in that tenant's setting.
    { kind: 'late_split', basis: 'flat', splitBps: 6000 }, // demo: firm keeps 60%
  ],
  // The owner-approval spend gate — the recon's "$400 cap" as a general,
  // working-fluid threshold (a setting loads the real one). A repair at or above
  // this needs owner approval before the vendor proceeds.
  spendApprovalCents: 35000, // demo: $350
  // Per-estate override (slice 2) — one named working-fluid example so the
  // `spendCapFor` reading is exercised: harrow-c runs a looser NTE than the
  // house default (an owner who's agreed to a higher trust threshold). NOT a
  // a firm's figure — a setting loads the real per-door caps at the gate.
  estateSpendCaps: [{ estateId: 'harrow-c', capCents: 90000 }], // demo: a $900 NTE for one estate
  // A working-fluid monthly plan for the Crown's own book — what the company
  // means to earn and spend. The operation's actuals (folded from the money log)
  // are read against it; a setting loads its real budget at the gate.
  budget: [
    { accountRole: 'mgmt_fee_income', monthlyCents: 2200000 }, // $22,000 fees
    { accountRole: 'markup_income', monthlyCents: 200000 }, // $2,000 markup
    { accountRole: 'payroll_expense', monthlyCents: 1500000 }, // $15,000 payroll
    { accountRole: 'software_expense', monthlyCents: 150000 }, // $1,500 software
    { accountRole: 'overhead_expense', monthlyCents: 200000 }, // $2,000 overhead
  ],
};

/** True while the economy book still reads exactly as founded — the census-
 *  migration test for the new shelf (matches catalogAtFounding / flowsAtFounding). */
export function economyAtFounding(economy: EconomyBook): boolean {
  return JSON.stringify(economy) === JSON.stringify(FOUNDING_ECONOMY);
}

// ── Fees ────────────────────────────────────────────────────────────────────

/** The fee a rule computes against a basis amount (in cents). A rate in basis
 *  points applies to the basis; a flat rule ignores it. General; a setting's
 *  real agreements load their own rules. */
export function feeAmount(rule: FeeRule, basisCents: number): number {
  if (rule.flatCents != null) return rule.flatCents;
  if (rule.rateBps != null) return Math.round((basisCents * rule.rateBps) / 10000);
  return 0;
}

/** The spend cap in force for an estate (slice 2): the estate's own override
 *  from `estateSpendCaps` when one is named, else the house-wide
 *  `spendApprovalCents`. No `estateId` (or an estate with no override) just
 *  reads the house cap — today's behavior, unchanged. */
export function spendCapFor(economy: EconomyBook, estateId?: string): number | undefined {
  if (estateId) {
    const own = economy.estateSpendCaps?.find((c) => c.estateId === estateId);
    if (own) return own.capCents;
  }
  return economy.spendApprovalCents;
}

/** The owner-approval spend gate (the recon's "$400 cap" / the grammars' "NTE
 *  {amount}"): true when a repair cost is at or above the economy's threshold
 *  and so needs owner approval before the vendor proceeds. No threshold set →
 *  nothing is gated. `estateId` is optional (slice 2) — when named, the
 *  estate's own cap governs if it has one; omitted, the house cap governs
 *  exactly as before. The vendor-dispatch flow's commitment step reads this. */
export function needsOwnerApproval(economy: EconomyBook, amountCents: number, estateId?: string): boolean {
  const cap = spendCapFor(economy, estateId);
  return cap != null && amountCents >= cap;
}

/** A working-fluid repair estimate by urgency band — enough to exercise the
 *  spend gate BOTH ways in the demo (a routine call clears the cap; an urgent or
 *  emergency one does not). NOT any firm's real figures: a setting loads real
 *  per-trade estimates at the data gate. Sibling of `sampleLedger` — the
 *  machine's working fluid, keyed off the `{urgency}` the WO already carries. */
const ESTIMATE_BY_URGENCY: Record<string, number> = {
  routine: 17500, // demo: $175 — a small fix, under the demo cap
  normal: 17500,
  urgent: 55000, // demo: $550 — over the cap, the owner's word is needed
  emergency: 140000, // demo: $1,400 — well over the cap
};

/** A working-fluid estimated repair cost for a work order, from its `{urgency}`
 *  band — or UNDEFINED when the work order names no band this table knows.
 *
 *  THERE USED TO BE A DEFAULT HERE, and removing it is the point. An
 *  unclassified work order returned `$350`, chosen to sit exactly AT the demo
 *  cap so that it would trip the gate — "when in doubt, ask". It worked, and it
 *  worked by coincidence: raise the cap to $500 and the same unclassified work
 *  order silently reads `within-authority` and proceeds, on an estimate nobody
 *  made, for a job nobody classified.
 *
 *  A sentinel wearing a dollar sign is worse than an absence, because every
 *  reading downstream treats it as money. The gate cannot weigh what has not
 *  been classified, and saying so is the honest answer — the same rule the
 *  timing edges follow, where a step whose anchor date is unknown gets no due
 *  date rather than a made-up one. Unknown is not overdue; unclassified is not
 *  cheap. */
export function estimateSpendCents(urgency?: string): number | undefined {
  if (!urgency) return undefined;
  return ESTIMATE_BY_URGENCY[urgency.toLowerCase()];
}

export type SpendDisposition =
  | 'ungated'
  | 'within-authority'
  | 'needs-owner-approval'
  /** The work order names no urgency this table knows, so there is no estimate
   *  to weigh against the cap. It does not proceed — not because it is
   *  expensive, but because nobody has said what it is. */
  | 'unclassified';

export interface SpendGate {
  /** The cap (NTE) in force in cents, or undefined when the economy sets none. */
  capCents?: number;
  /** The repair's estimated cost the decision was read against — ABSENT when the
   *  work order was never classified, and absent is not zero. */
  estimateCents?: number;
  /** True when the estimate is at or above the cap — the owner must approve
   *  before the vendor proceeds. */
  needsApproval: boolean;
  disposition: SpendDisposition;
  /** A plain-English line for the clerk's proposal note / the Ledger card. */
  note: string;
}

/** The spend-gate decision for an estimated repair cost — the legible reading a
 *  clerk records at the vendor-dispatch commitment step (`assign-vendor` /
 *  `approve-spend`) and a surface renders. `needsOwnerApproval` is the raw
 *  predicate; this wraps it into the cap, the estimate, the disposition, and a
 *  plain note. Below the cap the clerk may commit on the Regent's word; at or
 *  above it, the owner's approval is required first; no cap set → ungated.
 *  `estateId` is optional (slice 2, backward-compatible): named, it reads that
 *  estate's own cap when it has an override; omitted, the two-arg call behaves
 *  exactly as it always has, reading the house-wide cap. */
export function spendGate(
  economy: EconomyBook,
  estimateCents: number | undefined,
  estateId?: string,
): SpendGate {
  const capCents = spendCapFor(economy, estateId);
  // No estimate means the work order was never classified. It stops here, and
  // the reason it stops is legible: not "over the cap" — which would be a claim
  // about a number that does not exist — but "nobody has said what this is".
  if (estimateCents == null) {
    return {
      ...(capCents == null ? {} : { capCents }),
      needsApproval: true,
      disposition: 'unclassified',
      note: 'Unclassified work order — no urgency band, so no estimate. It cannot be weighed against the cap and does not proceed until somebody classifies it.',
    };
  }
  if (capCents == null) {
    return {
      estimateCents,
      needsApproval: false,
      disposition: 'ungated',
      note: `${coinCents(estimateCents)} estimate — no NTE cap set; the clerk may commit.`,
    };
  }
  const needsApproval = needsOwnerApproval(economy, estimateCents, estateId);
  return {
    capCents,
    estimateCents,
    needsApproval,
    disposition: needsApproval ? 'needs-owner-approval' : 'within-authority',
    note: needsApproval
      ? `${coinCents(estimateCents)} estimate over the ${coinCents(capCents)} NTE cap — the owner's approval is required before the vendor proceeds.`
      : `${coinCents(estimateCents)} estimate under the ${coinCents(capCents)} NTE cap — within the clerk's authority once the Regent approves.`,
  };
}

export interface SpendReconciliation {
  /** What the vendor was authorized to bill against — the ceiling the invoice is
   *  reconciled to. */
  authorizedCeilingCents: number;
  /** The invoice actually received. */
  invoiceCents: number;
  /** invoice − ceiling; positive is an overrun beyond what was authorized. */
  overrunCents: number;
  /** The invoice does not exceed the authorized ceiling. */
  withinAuthorization: boolean;
  /** The owner's word is needed to settle — the invoice overran its authority. */
  needsApproval: boolean;
  disposition: 'clear-to-pay' | 'needs-owner-approval';
  note: string;
}

/** The settlement side of the spend gate (§6.7, "Approve against NTE"): reconcile
 *  a vendor's invoice against what was authorized before paying. The authorized
 *  CEILING is the greater of the approved quote and the NTE cap — a job the owner
 *  approved at dispatch may bill up to its quote; a clerk-authorized job may bill
 *  up to the cap. An invoice within the ceiling is clear to pay; one that overruns
 *  it needs the owner's word. The dispatch-side sibling of `spendGate`. `estateId`
 *  is optional and backward-compatible exactly as on `spendGate`: named, the
 *  estate's own NTE governs the ceiling when it has an override; omitted, the
 *  house cap governs exactly as before. */
export function reconcileSpend(
  economy: EconomyBook,
  authorizedQuoteCents: number,
  invoiceCents: number,
  estateId?: string,
): SpendReconciliation {
  const cap = spendCapFor(economy, estateId);
  const authorizedCeilingCents = cap == null ? authorizedQuoteCents : Math.max(authorizedQuoteCents, cap);
  const overrunCents = invoiceCents - authorizedCeilingCents;
  const withinAuthorization = invoiceCents <= authorizedCeilingCents;
  return {
    authorizedCeilingCents,
    invoiceCents,
    overrunCents,
    withinAuthorization,
    needsApproval: !withinAuthorization,
    disposition: withinAuthorization ? 'clear-to-pay' : 'needs-owner-approval',
    note: withinAuthorization
      ? `${coinCents(invoiceCents)} invoice reconciles within the ${coinCents(authorizedCeilingCents)} authorized ceiling — clear to pay.`
      : `${coinCents(invoiceCents)} invoice overruns the ${coinCents(authorizedCeilingCents)} authorized ceiling by ${coinCents(overrunCents)} — the owner's word is needed before it settles.`,
  };
}

/** The fallback firm cut of the mtm premium (bps of the whole) when neither the
 *  estate's nor the house `mtm` rule names a `splitBps` — working-fluid; the
 *  REAL split ratio loads at the data gate. */
const MTM_FIRM_SPLIT_BPS = 3500; // demo default: 35% to the firm, 65% stays the owner's

/** The fallback firm cut of a COLLECTED late fee (bps of the whole) when neither
 *  the estate's nor the house `late_split` rule names a `splitBps` — working-
 *  fluid; the REAL share loads at the data gate. */
const LATE_FIRM_SPLIT_BPS = 6000; // demo default: 60% to the firm, 40% stays the owner's

/** The month-to-month premium split (slice 2, WRIT-ECONOMY): `postingsFor` is
 *  pure and takes no economy, so the ratio can't be read inside it — this pure
 *  helper reads the economy's split (the `mtm` fee rule's `splitBps`, else the
 *  house fallback) and hands the CALLER two tied cents amounts to record as
 *  `mtm_premium` (owner) and `mtm_fee` (firm). ownerCents + firmCents ===
 *  premiumCents always (firm's share rounds; owner takes the remainder, so
 *  nothing is lost to rounding).
 *
 *  NOTE (the flat-premium gate): this splits a premium it is GIVEN — it does not
 *  derive the premium amount. Today the only caller is attended hand-entry (the
 *  operator types the premium), so a setting that makes `mtm` a FLAT rule
 *  (`basis:'flat'`, `flatCents`) — as a firm's real $200 month-to-month is — works
 *  by loading only `splitBps` here. If a future auto-poster ever COMPUTES the
 *  premium, it MUST run the `mtm` rule through `feeAmount` (which honors
 *  `flatCents` over `rateBps`), never assume a `new_rent` percentage — else a
 *  flat-basis setting would be silently ignored. */
export function mtmSplit(
  economy: EconomyBook,
  premiumCents: number,
): { ownerCents: number; firmCents: number } {
  const rule = feeRuleFor(economy, 'mtm');
  const splitBps = rule?.splitBps ?? MTM_FIRM_SPLIT_BPS;
  const firmCents = Math.round((premiumCents * splitBps) / 10000);
  const ownerCents = premiumCents - firmCents;
  return { ownerCents, firmCents };
}

/** The late-fee owner/firm split — the firm's cut of a COLLECTED late fee, the
 *  twin of `mtmSplit`. Reads the economy's `late_split` rule's `splitBps` (else
 *  the house fallback) and hands the CALLER two tied cents amounts. The CONTRACT
 *  (see the `late_fee_share` MoneyKind): the tenant is billed the whole late fee
 *  via `late_fee` (owner income accrues on AR); this split is applied ONLY when
 *  that fee is COLLECTED — record `late_fee_share` for `firmCents` against the
 *  collected cash, exactly as the mgmt fee is taken on collected rent. Never
 *  split the charge itself (that under-bills the tenant and leaves the firm's
 *  accrual cash-unbacked). ownerCents + firmCents === lateFeeCents always. */
export function lateFeeSplit(
  economy: EconomyBook,
  lateFeeCents: number,
): { ownerCents: number; firmCents: number } {
  const rule = feeRuleFor(economy, 'late_split');
  const splitBps = rule?.splitBps ?? LATE_FIRM_SPLIT_BPS;
  const firmCents = Math.round((lateFeeCents * splitBps) / 10000);
  const ownerCents = lateFeeCents - firmCents;
  return { ownerCents, firmCents };
}

/** The fee rule for a kind on an estate — the estate's own, else the house
 *  default (no `estateId`). */
export function feeRuleFor(
  economy: EconomyBook,
  kind: FeeKind,
  estateId?: string,
): FeeRule | undefined {
  return (
    economy.feeRules.find((r) => r.kind === kind && r.estateId === estateId) ??
    economy.feeRules.find((r) => r.kind === kind && r.estateId == null)
  );
}

// ── The posting catalog — event → balanced postings (FOLDED, not stored) ─────
// Each MoneyKind expands deterministically into double-entry lines that sum to
// zero WITHIN EACH BOOK (§6.3). Bridge kinds emit lines in both books; every
// other kind stays in one. The subledger dimensions (estate/owner/tenant/vendor)
// ride each line, so owner statements and trial balances are just filtered sums.

export interface Posting {
  book: Book;
  role: string;
  debitCents: number;
  creditCents: number;
  estateId?: string;
  ownerId?: string;
  tenantId?: string;
  vendorId?: string;
}

function dims(e: MoneyEvent): Pick<Posting, 'estateId' | 'ownerId' | 'tenantId' | 'vendorId'> {
  return { estateId: e.estateId, ownerId: e.ownerId, tenantId: e.tenantId, vendorId: e.vendorId };
}

/** DR one role, CR another, for `amt` — a balanced pair carrying the event's
 *  dimensions. `book` defaults to trust; bridge kinds pass corporate explicitly. */
function pair(e: MoneyEvent, book: Book, drRole: string, crRole: string, amt: number): Posting[] {
  return [
    { book, role: drRole, debitCents: amt, creditCents: 0, ...dims(e) },
    { book, role: crRole, debitCents: 0, creditCents: amt, ...dims(e) },
  ];
}

/** Expand one money event into its balanced postings — the fold at the heart of
 *  the re-expression (nothing here is stored; every read recomputes it). */
export function postingsFor(e: MoneyEvent): Posting[] {
  const a = e.amountCents;
  switch (e.kind) {
    case 'rent_charged':
      return pair(e, 'trust', 'ar_tenants', 'rent_income', a);
    case 'rent_received':
      return pair(e, 'trust', 'trust_cash_rent', 'ar_tenants', a);
    case 'deposit_received':
      return pair(e, 'trust', 'trust_cash_deposits', 'security_deposits_held', a);
    case 'deposit_refunded':
      return pair(e, 'trust', 'security_deposits_held', 'trust_cash_deposits', a);
    case 'vendor_bill':
      return pair(e, 'trust', 'repairs_expense', 'ap_vendors', a);
    case 'vendor_paid':
      return pair(e, 'trust', 'ap_vendors', 'trust_cash_rent', a);
    case 'owner_contribution':
      return pair(e, 'trust', 'trust_cash_rent', 'owner_equity', a);
    case 'owner_draw':
      return pair(e, 'trust', 'owner_equity', 'trust_cash_rent', a);
    case 'reserve_funded':
      return pair(e, 'trust', 'owner_reserve_cash', 'owner_reserves_held', a);
    case 'late_fee':
      return pair(e, 'trust', 'ar_tenants', 'late_fee_income', a);
    // ── Ancillary streams (recon-sourced) ──
    // Owner-side income, collected in trust — pet rent and utility reimbursement.
    case 'pet_rent':
      return pair(e, 'trust', 'trust_cash_rent', 'pet_rent_income', a);
    case 'utility_reimbursement':
      return pair(e, 'trust', 'trust_cash_rent', 'utility_reimb_income', a);
    // The move-out reserve: held back from the owner's disbursable net into a
    // reserve liability (trust cash unchanged; the owner's claim drops).
    case 'moveout_reserve_withheld':
      return pair(e, 'trust', 'owner_equity', 'moveout_reserve_held', a);
    // Firm-retained ancillary fees — the company's own revenue, collected direct.
    case 'nsf_fee':
      return pair(e, 'corporate', 'op_cash', 'nsf_income', a);
    case 'admin_fee':
      return pair(e, 'corporate', 'op_cash', 'admin_income', a);
    case 'reletting_fee':
      return pair(e, 'corporate', 'op_cash', 'reletting_income', a);
    case 'ancillary_fee':
      return pair(e, 'corporate', 'op_cash', 'ancillary_income', a);
    // The named firm-income streams the recon split out of the ancillary bucket —
    // each the company's own revenue, collected direct into the operating book.
    case 'rbp_fee':
      return pair(e, 'corporate', 'op_cash', 'rbp_income', a);
    case 'pet_damage_fee':
      return pair(e, 'corporate', 'op_cash', 'pet_damage_income', a);
    case 'risk_enforcement_fee':
      return pair(e, 'corporate', 'op_cash', 'risk_enforcement_income', a);
    case 'project_coordination_fee':
      return pair(e, 'corporate', 'op_cash', 'project_coord_income', a);
    case 'annual_admin_fee':
      return pair(e, 'corporate', 'op_cash', 'annual_admin_income', a);
    case 'referral_fee':
      return pair(e, 'corporate', 'op_cash', 'referral_income', a);
    case 'warranty_fee':
      return pair(e, 'corporate', 'op_cash', 'warranty_income', a);
    case 'application_fee':
      return pair(e, 'corporate', 'op_cash', 'application_income', a);
    case 'ac_seasonal_fee':
      return pair(e, 'corporate', 'op_cash', 'ac_seasonal_income', a);
    case 'vendor_discount':
      return pair(e, 'corporate', 'op_cash', 'vendor_discount_income', a);
    // Owner-side, in trust: a concession is a rent credit the owner grants (income
    // and the tenant's receivable both fall); a chargeback is a move-out penalty
    // charged the tenant and owed the owner (their receivable and income both rise).
    case 'owner_concession':
      return pair(e, 'trust', 'rent_income', 'ar_tenants', a);
    case 'tenant_chargeback':
      return pair(e, 'trust', 'ar_tenants', 'chargeback_income', a);
    // The month-to-month premium split (slice 2): the WHOLE premium lands as
    // owner income in trust (mirrors pet_rent) — one `mtm_premium` event per
    // the caller's `mtmSplit().ownerCents`.
    case 'mtm_premium':
      return pair(e, 'trust', 'trust_cash_rent', 'mtm_premium_income', a);
    // The firm's cut then rides the SAME bridge shape as `management_fee` — a
    // fee ON the premium already sitting in trust, not a separate tenant
    // charge — one `mtm_fee` event per the caller's `mtmSplit().firmCents`.
    case 'mtm_fee':
      return [...pair(e, 'trust', 'mtm_fee_expense', 'due_to_mgmt', a), ...pair(e, 'corporate', 'due_from_trust', 'mtm_income', a)];
    // The firm's share of a COLLECTED late fee — the SAME bridge shape as
    // `management_fee`, a fee on the late-fee income the owner has already
    // COLLECTED (cash in trust), feeding corporate `late_fee_share_income` (4230).
    // Recorded per the caller's `lateFeeSplit().firmCents`, only on collection.
    case 'late_fee_share':
      return [...pair(e, 'trust', 'late_fee_share_expense', 'due_to_mgmt', a), ...pair(e, 'corporate', 'due_from_trust', 'late_fee_share_income', a)];
    // ── The bridge: the owner is charged in trust, the company earns in corporate ──
    case 'management_fee':
      return [...pair(e, 'trust', 'mgmt_fee_expense', 'due_to_mgmt', a), ...pair(e, 'corporate', 'due_from_trust', 'mgmt_fee_income', a)];
    case 'leasing_fee':
      return [...pair(e, 'trust', 'leasing_fee_expense', 'due_to_mgmt', a), ...pair(e, 'corporate', 'due_from_trust', 'leasing_income', a)];
    case 'renewal_fee':
      return [...pair(e, 'trust', 'leasing_fee_expense', 'due_to_mgmt', a), ...pair(e, 'corporate', 'due_from_trust', 'renewal_income', a)];
    case 'markup':
      return [...pair(e, 'trust', 'markup_expense', 'due_to_mgmt', a), ...pair(e, 'corporate', 'due_from_trust', 'markup_income', a)];
    // ── The sweep: earned fees legally leave trust for the company bank ──
    case 'fee_sweep':
      return [...pair(e, 'trust', 'due_to_mgmt', 'trust_cash_rent', a), ...pair(e, 'corporate', 'op_cash', 'due_from_trust', a)];
    // Commission (markup) sweeps to the SEGREGATED By-Pass bank, never operating
    // (the "commissions never post through operating" rule). Same shape as
    // fee_sweep; only the corporate cash leg lands in bypass_cash.
    case 'commission_sweep':
      return [...pair(e, 'trust', 'due_to_mgmt', 'trust_cash_rent', a), ...pair(e, 'corporate', 'bypass_cash', 'due_from_trust', a)];
    // IRS 1099 backup withholding: part of a vendor's AP is satisfied not by cash
    // to the vendor but by cash earmarked for the IRS. Sequenced by the caller as
    // vendor_bill (full) → irs_withholding (w) → vendor_paid (bill − w).
    case 'irs_withholding':
      return pair(e, 'trust', 'ap_vendors', 'irs_withholding_payable', a);
    // ── Corporate-only ──
    case 'corp_expense':
      return pair(e, 'corporate', e.accountRole ?? 'overhead_expense', 'op_cash', a);
    case 'corp_income_other':
      return pair(e, 'corporate', 'op_cash', e.accountRole ?? 'other_income', a);
    default:
      return [];
  }
}

/** Every posting the whole money log folds to — the derived `ledger_postings`. */
export function readPostings(money: MoneyLog): Posting[] {
  return money.flatMap(postingsFor);
}

// ── Readings — all folded from the postings ─────────────────────────────────

/** The net balance of one account role, in cents, on its NORMAL side (a positive
 *  asset/expense means debits exceed credits; a positive liability/equity/income
 *  means credits exceed debits). `filter` narrows to a subledger (an owner). */
export function balanceOf(
  economy: EconomyBook,
  postings: Posting[],
  role: string,
  filter?: (p: Posting) => boolean,
): number {
  const acct = economy.accounts.find((x) => x.role === role);
  const sign = acct?.normal === 'credit' ? -1 : 1;
  let net = 0;
  for (const p of postings) {
    if (p.role !== role) continue;
    if (filter && !filter(p)) continue;
    net += p.debitCents - p.creditCents;
  }
  return net * sign;
}

/** The trust accounts that make up an owner's net claim — one place, so the
 *  solvency reconciliation and the owner statement never drift as kinds grow. */
const OWNER_INCOME_ROLES = [
  'rent_income',
  'late_fee_income',
  'pet_rent_income',
  'utility_reimb_income',
  'mtm_premium_income',
  // A move-out chargeback is charged to the tenant and owed to the OWNER — it
  // was the one trust income account missing from this list, so recording one
  // raised the tenant's receivable and nothing else. Three consequences, and
  // the last is the dangerous one: the owner's statement did not move (their
  // own money, invisible to them); the aggregate-liability identity broke,
  // because `ar_tenants` had moved and the owner's claim had not; and the
  // Trust-compliance card therefore raised a reconciliation flag that was
  // entirely an artefact of this omission. A watchdog that barks at nothing
  // gets ignored when it barks at something. (Audit, 2026-07-27.)
  'chargeback_income',
];
const OWNER_EXPENSE_ROLES = [
  'repairs_expense',
  'mgmt_fee_expense',
  'leasing_fee_expense',
  'markup_expense',
  'mtm_fee_expense',
  'late_fee_share_expense',
];

/** An owner's net position held in trust: their equity plus income minus the
 *  costs and fees charged to their doors. `filter` narrows to one owner. */
function ownerNetOf(economy: EconomyBook, postings: Posting[], filter?: (p: Posting) => boolean): number {
  let net = balanceOf(economy, postings, 'owner_equity', filter);
  for (const r of OWNER_INCOME_ROLES) net += balanceOf(economy, postings, r, filter);
  for (const r of OWNER_EXPENSE_ROLES) net -= balanceOf(economy, postings, r, filter);
  return net;
}

/** True when every book's postings balance (Σdebits = Σcredits) — the double-
 *  entry invariant, per book. */
export function booksBalance(postings: Posting[]): { trust: number; corporate: number; balanced: boolean } {
  const diff = (book: Book) =>
    postings.filter((p) => p.book === book).reduce((n, p) => n + p.debitCents - p.creditCents, 0);
  const trust = diff('trust');
  const corporate = diff('corporate');
  return { trust, corporate, balanced: trust === 0 && corporate === 0 };
}

export interface Solvency {
  /** Cash actually held in the trust banks. */
  trustCash: number;
  /** The owners' net position held in trust (equity + their net income). */
  ownerNet: number;
  depositsHeld: number;
  reservesHeld: number;
  dueToMgmt: number;
  /** IRS backup withholding held in trust, owed to the IRS (a trust liability, so
   *  it belongs in the variance identity beside the others). */
  irsWithholding: number;
  /** In-transit reconciling items. */
  arTenants: number;
  apVendors: number;
  /** trustCash − (ownerNet + depositsHeld + reservesHeld + dueToMgmt). By double-
   *  entry this ALWAYS equals apVendors − arTenants; with a cash-complete book
   *  (AR = AP = 0) it is 0 — the healthy coffers reading. */
  variance: number;
  /** No unexplained shortage/overage: the identity holds (the posting engine is
   *  internally consistent). */
  reconciles: boolean;
  /** Nothing in transit — bank equals client trial balance exactly. */
  clean: boolean;
}

/** The three-way trust reconciliation (§1.6, §6.5 #1), recomputed live: the
 *  trust bank must hold exactly what is owed to owners, tenants, and the company. */
export function readSolvency(economy: EconomyBook, money: MoneyLog): Solvency {
  const p = readPostings(money);
  const trustCash = economy.accounts
    .filter((x) => x.isTrustCash)
    .reduce((n, x) => n + balanceOf(economy, p, x.role), 0);
  const ownerNet = ownerNetOf(economy, p);
  const depositsHeld = balanceOf(economy, p, 'security_deposits_held');
  const reservesHeld =
    balanceOf(economy, p, 'owner_reserves_held') + balanceOf(economy, p, 'moveout_reserve_held');
  const dueToMgmt = balanceOf(economy, p, 'due_to_mgmt');
  const irsWithholding = balanceOf(economy, p, 'irs_withholding_payable');
  const arTenants = balanceOf(economy, p, 'ar_tenants');
  const apVendors = balanceOf(economy, p, 'ap_vendors');
  const variance = trustCash - (ownerNet + depositsHeld + reservesHeld + dueToMgmt + irsWithholding);
  return {
    trustCash,
    ownerNet,
    depositsHeld,
    reservesHeld,
    dueToMgmt,
    irsWithholding,
    arTenants,
    apVendors,
    variance,
    reconciles: variance === apVendors - arTenants,
    clean: variance === 0,
  };
}

export interface BridgeCheck {
  dueToMgmt: number;
  dueFromTrust: number;
  tied: boolean;
}

/** The bridge self-check (§6.4): the fees earned and still in trust must equal
 *  the receivable on the company's books, until swept. */
export function bridgeCheck(economy: EconomyBook, money: MoneyLog): BridgeCheck {
  const p = readPostings(money);
  const dueToMgmt = balanceOf(economy, p, 'due_to_mgmt');
  const dueFromTrust = balanceOf(economy, p, 'due_from_trust');
  return { dueToMgmt, dueFromTrust, tied: dueToMgmt === dueFromTrust };
}

export interface PnLLine {
  role: string;
  name: string;
  type: 'income' | 'expense';
  amountCents: number;
}
export interface PnL {
  lines: PnLLine[];
  income: number;
  expense: number;
  net: number;
}

function within(at: string, from?: string, to?: string): boolean {
  if (from && at < from) return false;
  if (to && at > to) return false;
  return true;
}

/** The corporate P&L (§6.5 #2): the company's own income minus expense over a
 *  period, by account. The QuickBooks dimension. */
export function readPnL(economy: EconomyBook, money: MoneyLog, from?: string, to?: string): PnL {
  const p = money.filter((e) => within(e.at, from, to)).flatMap(postingsFor);
  const lines: PnLLine[] = [];
  let income = 0;
  let expense = 0;
  for (const acct of economy.accounts) {
    if (acct.book !== 'corporate') continue;
    if (acct.type !== 'income' && acct.type !== 'expense') continue;
    const amt = balanceOf(economy, p, acct.role);
    if (amt === 0) continue;
    lines.push({ role: acct.role, name: acct.name, type: acct.type, amountCents: amt });
    if (acct.type === 'income') income += amt;
    else expense += amt;
  }
  return { lines, income, expense, net: income - expense };
}

export interface BudgetVsActualLine {
  accountRole: string;
  name: string;
  type: AcctType;
  plannedCents: number;
  actualCents: number;
  /** actual − planned. For income, positive is ahead of plan; for expense,
   *  positive is an overspend. The reading reports the signed number; the
   *  surface colors it by type. */
  varianceCents: number;
}
export interface BudgetVsActual {
  lines: BudgetVsActualLine[];
  plannedExpense: number;
  actualExpense: number;
  plannedIncome: number;
  actualIncome: number;
}

/** Budget vs actual (§6.5 #4): each budgeted account's planned monthly amount
 *  against the actual folded from the money log over the period. A budget line
 *  with no matching posting still shows (actual 0); an actual with no budget
 *  line is not invented here (the plan is the plan). */
export function readBudgetVsActual(
  economy: EconomyBook,
  money: MoneyLog,
  from?: string,
  to?: string,
): BudgetVsActual {
  const budget = economy.budget ?? [];
  const p = money.filter((e) => within(e.at, from, to)).flatMap(postingsFor);
  const lines: BudgetVsActualLine[] = [];
  let plannedExpense = 0;
  let actualExpense = 0;
  let plannedIncome = 0;
  let actualIncome = 0;
  for (const b of budget) {
    const acct = economy.accounts.find((a) => a.role === b.accountRole);
    if (!acct) continue;
    const filter = b.estateId ? (pp: Posting) => pp.estateId === b.estateId : undefined;
    const actual = balanceOf(economy, p, b.accountRole, filter);
    lines.push({
      accountRole: b.accountRole,
      name: acct.name,
      type: acct.type,
      plannedCents: b.monthlyCents,
      actualCents: actual,
      varianceCents: actual - b.monthlyCents,
    });
    if (acct.type === 'expense') {
      plannedExpense += b.monthlyCents;
      actualExpense += actual;
    } else if (acct.type === 'income') {
      plannedIncome += b.monthlyCents;
      actualIncome += actual;
    }
  }
  return { lines, plannedExpense, actualExpense, plannedIncome, actualIncome };
}

export interface OwnerStatement {
  ownerId: string;
  beginningCents: number;
  incomeCents: number;
  expenseCents: number;
  drawCents: number;
  endingCents: number;
  /** The management fee shown as its own line, as an owner statement does. */
  mgmtFeeCents: number;
  /** Held back from the owner's net into the move-out reserve, this period. */
  reserveWithheldCents: number;
}

/** The owner's net position folded from the trust postings tagged to them — the
 *  owner's claim on trust: rent + late fees − repairs − fees − draws +
 *  contributions. `beginning` is the net before `from`; `ending` through `to`. */
function ownerNetThrough(economy: EconomyBook, money: MoneyLog, ownerId: string, to?: string): number {
  const p = money.filter((e) => e.ownerId === ownerId && within(e.at, undefined, to)).flatMap(postingsFor);
  return ownerNetOf(economy, p, (pp) => pp.ownerId === ownerId);
}

/** The owner statement (§6.5 #3): the AppFolio/owner dimension, from the same
 *  postings the corporate P&L reads — filtered by owner and period. */
export function readOwnerStatement(
  economy: EconomyBook,
  money: MoneyLog,
  ownerId: string,
  from?: string,
  to?: string,
): OwnerStatement {
  const beginningCents = from ? ownerNetThrough(economy, money, ownerId, priorTo(from)) : 0;
  const period = money.filter((e) => e.ownerId === ownerId && within(e.at, from, to));
  const p = period.flatMap(postingsFor);
  const f = (pp: Posting) => pp.ownerId === ownerId;
  const incomeCents = OWNER_INCOME_ROLES.reduce((n, r) => n + balanceOf(economy, p, r, f), 0);
  const mgmtFeeCents = balanceOf(economy, p, 'mgmt_fee_expense', f);
  const expenseCents = OWNER_EXPENSE_ROLES.reduce((n, r) => n + balanceOf(economy, p, r, f), 0);
  // A draw reduces owner_equity (DR owner_equity) — count the draw magnitude.
  const drawCents = period
    .filter((e) => e.kind === 'owner_draw')
    .reduce((n, e) => n + e.amountCents, 0);
  const contribCents = period
    .filter((e) => e.kind === 'owner_contribution')
    .reduce((n, e) => n + e.amountCents, 0);
  // The move-out reserve held back from the owner's disbursable net.
  const reserveWithheldCents = period
    .filter((e) => e.kind === 'moveout_reserve_withheld')
    .reduce((n, e) => n + e.amountCents, 0);
  const endingCents = beginningCents + incomeCents - expenseCents - drawCents + contribCents - reserveWithheldCents;
  return { ownerId, beginningCents, incomeCents, expenseCents, drawCents, endingCents, mgmtFeeCents, reserveWithheldCents };
}

/** One millisecond before an ISO instant — so "beginning" is strictly prior. */
function priorTo(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t - 1).toISOString() : iso;
}

export interface CorporateCoffers {
  opCash: number;
  /** Commission cash held in the segregated By-Pass bank (slice-2b). */
  bypassCash: number;
  dueFromTrust: number;
  payables: number;
  /** Operating + By-Pass cash + earned-not-swept − payables: the company's runway. */
  runway: number;
}

/** The Crown's coffers (§6.5 #1, corporate): the company's own solvency — the
 *  money that decides whether the kingdom falls. */
export function readCorporateCoffers(economy: EconomyBook, money: MoneyLog): CorporateCoffers {
  const p = readPostings(money);
  const opCash = balanceOf(economy, p, 'op_cash');
  const bypassCash = balanceOf(economy, p, 'bypass_cash');
  const dueFromTrust = balanceOf(economy, p, 'due_from_trust');
  const payables = balanceOf(economy, p, 'ap_corp');
  return { opCash, bypassCash, dueFromTrust, payables, runway: opCash + bypassCash + dueFromTrust - payables };
}

// ── Per-account bank reconciliation (slice-2b) ──────────────────────────────
// Each physical bank account reconciled on its own: its folded book balance
// against the external statement (which loads as a setting at the gate), plus
// two lapses that hold with no statement at all — a bank overdrawn, and
// commission cash that leaked into operating instead of the By-Pass account.

export interface BankRec {
  bank: BankId;
  /** The account roles folded into this physical bank. */
  accounts: string[];
  /** The balance folded from the postings (the book's view of the bank). */
  bookBalanceCents: number;
  /** The external bank statement, when supplied (gated — loads at the gate). */
  statementCents?: number;
  /** |book − statement| when a statement is supplied; 0 when unreconciled. */
  lapseCents: number;
  /** The book balance is negative — always a lapse, statement or not. */
  overdrawn: boolean;
  /** Commission cash reached this bank that should have been segregated (the
   *  "commissions never post through operating" rule). Flagged on By-Pass. */
  segregationLapse: boolean;
  ok: boolean;
}

export interface BankRecs {
  recs: BankRec[];
  /** How many banks failed to reconcile (overdrawn, statement mismatch, or leak). */
  lapses: number;
  ok: boolean;
}

/** Reconcile every physical bank account on its own (§6.5 #1, per account). The
 *  segregation guard: commission (markup) reaches the company only through a
 *  sweep; swept correctly it lands in By-Pass via `commission_sweep`, so if more
 *  was swept to operating via `fee_sweep` than the non-commission fees earned
 *  justify, commission leaked into operating — a lapse on the By-Pass bank.
 *  `statements` is the external feed, optional and tolerant (gated). */
export function readBankRecs(
  economy: EconomyBook,
  money: MoneyLog,
  statements?: Partial<Record<BankId, number>>,
): BankRecs {
  const p = readPostings(money);
  // Group every bank-tagged account by its physical bank (unknown tags tolerated).
  const banks = new Map<BankId, string[]>();
  for (const a of economy.accounts) {
    if (!a.bank) continue;
    banks.set(a.bank, [...(banks.get(a.bank) ?? []), a.role]);
  }
  // Commission leaked to operating: swept-to-operating beyond the non-commission
  // fees that legitimately belong there (management + leasing + renewal).
  const feeSweptToOperating = money
    .filter((e) => e.kind === 'fee_sweep')
    .reduce((n, e) => n + e.amountCents, 0);
  const nonCommissionEarned =
    balanceOf(economy, p, 'mgmt_fee_income') +
    balanceOf(economy, p, 'leasing_income') +
    balanceOf(economy, p, 'renewal_income');
  const commissionLeak = Math.max(0, feeSweptToOperating - nonCommissionEarned);

  const bookOf = (role: string): Book | undefined => economy.accounts.find((x) => x.role === role)?.book;
  const recs: BankRec[] = [...banks.entries()]
    .map(([bank, accounts]) => {
      const bookBalanceCents = accounts.reduce((n, r) => n + balanceOf(economy, p, r), 0);
      const statementCents = statements?.[bank];
      const lapseCents = statementCents == null ? 0 : Math.abs(bookBalanceCents - statementCents);
      const overdrawn = bookBalanceCents < 0;
      const segregationLapse = bank === 'by-pass' && commissionLeak > 0;
      // A TRUST bank overdrawn is a fiduciary red line (spending one party's money
      // on another). A corporate bank running thin is the coffers/fail-state
      // reading's business — reported here, but not a reconciliation lapse.
      const isTrust = accounts.some((r) => bookOf(r) === 'trust');
      const ok = lapseCents === 0 && !(overdrawn && isTrust) && !segregationLapse;
      return { bank, accounts, bookBalanceCents, statementCents, lapseCents, overdrawn, segregationLapse, ok };
    })
    .sort((a, b) => a.bank.localeCompare(b.bank));

  const lapses = recs.filter((r) => !r.ok).length;
  return { recs, lapses, ok: lapses === 0 };
}

// ── Compliance as invariants, not reports (§6.7) ────────────────────────────
// Trust accounting's guardrails are checked continuously in the data layer, not
// noticed once a month. Each is a reading folded from the postings: the
// aggregate-liability identity, no overdrawn trust bank, no owner's money spent
// on another's door (the commingling failure in its commonest form), deposits
// held whole, and earned fees swept before the state's clock runs out.

export interface ComplianceCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}
export interface Compliance {
  checks: ComplianceCheck[];
  flags: number;
  ok: boolean;
}

/** The state limit (days) an earned fee may sit in trust before it must be
 *  swept — California's 25 (§4). Working fluid; a setting tunes it. */
export const EARNED_FEE_LIMIT_DAYS = 25;

/** The compliance guardrails, folded live (§6.7). `now` enables the earned-fee
 *  aging check (absent → aging is not evaluated). */
export function readCompliance(economy: EconomyBook, money: MoneyLog, now?: string): Compliance {
  const p = readPostings(money);
  const checks: ComplianceCheck[] = [];

  // 1. The aggregate-liability identity — the mathematical heart of trust
  //    accounting (§4). It holds by double-entry; a break means the postings
  //    are internally inconsistent (a real shortage/overage would surface here).
  const s = readSolvency(economy, money);
  checks.push({
    key: 'reconciliation',
    label: 'Trust bank reconciles',
    ok: s.reconciles,
    // The verdict and the sentence beside it must come from the SAME fact. This
    // chose `ok` off `reconciles` and the words off `clean`, so a broken
    // identity could print "bank equals the client trial balance" next to its
    // own ⚠ — and a reader takes the sentence, not the glyph. A failing check
    // that reads as fine is worse than no check. (Audit, 2026-07-27.)
    detail: !s.reconciles
      ? `the identity is BROKEN by ${coinCents(Math.abs(s.variance - (s.apVendors - s.arTenants)))} — the postings do not agree`
      : s.clean
        ? 'bank equals the client trial balance'
        : `${coinCents(Math.abs(s.variance))} in transit (receivables/payables); identity holds`,
  });

  // 2. No trust bank overdrawn — a negative trust-cash balance is spending money
  //    that is not there.
  const overdrawn = economy.accounts
    .filter((a) => a.isTrustCash)
    .map((a) => ({ a, bal: balanceOf(economy, p, a.role) }))
    .filter((x) => x.bal < 0);
  checks.push({
    key: 'trust_cash',
    label: 'No trust bank overdrawn',
    ok: overdrawn.length === 0,
    detail: overdrawn.length
      ? overdrawn.map((x) => `${x.a.name} ${coinCents(x.bal)}`).join('; ')
      : 'every trust bank ≥ 0',
  });

  // 3. No owner overdrawn — spending more on a door than its owner holds in
  //    trust is, by definition, using another owner's money (the commingling
  //    failure in its commonest form).
  const owners = ownersInLog(money);
  const negative = owners
    .map((o) => ({ o, net: readOwnerStatement(economy, money, o).endingCents }))
    .filter((x) => x.net < 0);
  checks.push({
    key: 'owner_solvency',
    label: 'No owner overdrawn (no cross-subsidy)',
    ok: negative.length === 0,
    detail: negative.length
      ? `${negative.length} owner(s): ${negative.slice(0, 3).map((x) => `${x.o} ${coinCents(x.net)}`).join(', ')}`
      : `${owners.length} owners, all held ≥ 0`,
  });

  // 4. Deposits held whole — a liability relieved only by refund or application,
  //    never swept to the company.
  const deposits = balanceOf(economy, p, 'security_deposits_held');
  checks.push({
    key: 'deposits',
    label: 'Security deposits intact (never swept)',
    ok: deposits >= 0,
    detail: `${coinCents(deposits)} held for tenants`,
  });

  // 5. Earned fees swept in time — fees still in trust past the state limit are
  //    a violation waiting to happen (§4). Needs the clock.
  const dueToMgmt = balanceOf(economy, p, 'due_to_mgmt');
  let feeOk = true;
  let feeDetail = 'no earned fees waiting in trust';
  if (dueToMgmt > 0) {
    const feeKinds: MoneyKind[] = ['management_fee', 'leasing_fee', 'renewal_fee', 'markup', 'mtm_fee', 'late_fee_share'];
    const ages = now
      ? money.filter((m) => feeKinds.includes(m.kind)).map((m) => daysBetween(m.at, now) ?? 0)
      : [];
    const oldest = ages.length ? Math.max(...ages) : 0;
    feeOk = !now || oldest <= EARNED_FEE_LIMIT_DAYS;
    feeDetail = `${coinCents(dueToMgmt)} earned, awaiting sweep${now ? ` · oldest ${oldest}d (limit ${EARNED_FEE_LIMIT_DAYS}d)` : ''}`;
  }
  checks.push({ key: 'fee_aging', label: 'Earned fees swept in time', ok: feeOk, detail: feeDetail });

  const flags = checks.filter((c) => !c.ok).length;
  return { checks, flags, ok: flags === 0 };
}

const DAY_MS = 86_400_000;
function daysBetween(fromIso: string, toIso: string): number | null {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : null;
}

// ── A working-fluid sample month — to exercise the surface ──────────────────
// Not the War Game's real deal (swing three wires money onto the operating
// spine) — a small, self-consistent month across two estates so the Counting-
// house panel shows the readings moving: rents charged and collected, a vendor
// bill paid with a coordination markup, deposits and a reserve held, the
// management fees earned and swept, the owners drawn, and the company's payroll.
// Cash-complete, so the trust bank reconciles clean. Pure: fees fold from the
// loaded rules, ids are placeholders the caller re-stamps.

/** The distinct owners a money log names — for the owner-statement picker. */
export function ownersInLog(money: MoneyLog): string[] {
  return [...new Set(money.map((e) => e.ownerId).filter((o): o is string => !!o))];
}

export function sampleLedger(economy: EconomyBook, at: string): MoneyEvent[] {
  let n = 0;
  const events: MoneyEvent[] = [];
  const push = (kind: MoneyKind, amountCents: number, extra: Partial<MoneyEvent> = {}) => {
    events.push({ id: `sample-${++n}`, at, kind, amountCents, ...extra });
  };
  const estates = [
    { estateId: 'willow-4', ownerId: 'Owen Ashford', tenantId: 'Bob the Tanner', rent: 180000 },
    { estateId: 'harrow-c', ownerId: 'Orin Vale', tenantId: 'Rue the Weaver', rent: 220000 },
  ];
  const mgmt = feeRuleFor(economy, 'management');
  const markup = feeRuleFor(economy, 'markup');
  for (const e of estates) {
    const p = { estateId: e.estateId, ownerId: e.ownerId, tenantId: e.tenantId };
    push('deposit_received', e.rent, p);
    push('rent_charged', e.rent, p);
    push('rent_received', e.rent, p);
    push('reserve_funded', 45000, p);
    const bill = 35000;
    push('vendor_bill', bill, { ...p, vendorId: 'Ser Fix the Artisan' });
    push('vendor_paid', bill, { ...p, vendorId: 'Ser Fix the Artisan' });
    if (markup) push('markup', feeAmount(markup, bill), p);
    if (mgmt) push('management_fee', feeAmount(mgmt, e.rent), p);
  }
  // Sweep the fees earned this month — commission (markup) to the segregated
  // By-Pass bank, the rest to operating — then pay the owners their remaining net.
  const swept = readPostings(events);
  const earned = balanceOf(economy, swept, 'due_to_mgmt');
  const commission = balanceOf(economy, swept, 'markup_income');
  const nonCommission = earned - commission;
  if (nonCommission > 0) push('fee_sweep', nonCommission);
  if (commission > 0) push('commission_sweep', commission);
  for (const e of estates) {
    const net = readOwnerStatement(economy, events, e.ownerId).endingCents;
    if (net > 0) push('owner_draw', net, { estateId: e.estateId, ownerId: e.ownerId });
  }
  // The company's own month — payroll and software against the fees earned.
  push('corp_expense', 1200000, { accountRole: 'payroll_expense', memo: 'Payroll & contractors' });
  push('corp_expense', 90000, { accountRole: 'software_expense', memo: 'AppFolio & tools' });
  return events;
}

/** The money one settled vendor-dispatch work order posts — the vertical slice
 *  (WRIT-B). When the Regent settles a real WO (works its `pay-vendor` step),
 *  the firm's coordination cut and the vendor payment become real events so the
 *  🏦 Counting-house reflects that settled work, not just the bulk deal.
 *
 *  Correctness-first: a lone WO has no rent/deposit dealt beside it, so paying a
 *  vendor out of trust would overdraw the trust bank (and the repair expense
 *  would overdraw the owner) — both invariants the CI gate enforces. So the door
 *  is funded to its shortfall first (`owner_contribution`, modelling the owner's
 *  escrow), using whatever trust net the owner already holds. Ordered so every
 *  prefix stays non-negative (passes the temporal fiduciary replay):
 *    1. owner_contribution (topup)  2. vendor_bill  3. vendor_paid  4. markup
 *  Every kind already has a balanced posting in `postingsFor` — R1 holds, no new
 *  kind. Pure: ids/wg are the caller's to stamp (like `sampleLedger`). `money`
 *  is the log SO FAR (before this batch) — the owner's held net is folded from it.
 *
 *  NOT any firm's real invoices — the working-fluid/hand-entered bill; the real
 *  invoice roll loads at the data gate. */
export function vendorSettlementMoney(
  economy: EconomyBook,
  money: MoneyLog,
  args: { caseId: string; billCents: number; at: string; ownerId?: string; estateId?: string; vendorId?: string },
): MoneyEvent[] {
  const bill = Math.round(args.billCents);
  if (!Number.isFinite(bill) || bill <= 0) return [];
  const { caseId, at, ownerId, estateId, vendorId } = args;

  const markupRule = feeRuleFor(economy, 'markup');
  const mk = markupRule ? feeAmount(markupRule, bill) : 0;

  // What this owner already holds in trust (0 for a hand-worked, unfunded door).
  const have = ownerId ? Math.max(0, readOwnerStatement(economy, money, ownerId).endingCents) : 0;
  const topup = Math.max(0, bill + mk - have);

  const p: Partial<MoneyEvent> = { estateId, ownerId, sourceId: caseId };
  let n = 0;
  const out: MoneyEvent[] = [];
  const push = (kind: MoneyKind, amountCents: number, extra: Partial<MoneyEvent> = {}) => {
    out.push({ id: `settle-${caseId}-${++n}`, at, kind, amountCents, ...p, ...extra });
  };

  if (topup > 0) push('owner_contribution', topup, { memo: 'Owner escrow to fund the repair' });
  push('vendor_bill', bill, { vendorId, memo: 'Vendor repair, billed to the estate' });
  push('vendor_paid', bill, { vendorId, memo: 'Vendor paid from trust' });
  if (mk > 0) push('markup', mk, { memo: 'Coordination markup earned' });
  return out;
}

// ── Coin formatting (cents in, dollars out) ─────────────────────────────────

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** A cents amount as plain dollars — the house-style label. */
export function coinCents(cents: number): string {
  return usd.format(Math.round(cents / 100));
}
