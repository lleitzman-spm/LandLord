# The Economy: How Residential PM Firms Run Two Ledgers (AppFolio Trust + QuickBooks Corporate) and the Fee Bridge Between Them

> Research brief grounding the loadable **economy** component of the operating instrument (LandLord).
> Scope: general, model-focused, and vendor-accurate. No private figures from any firm.
> Every load-bearing claim below is cited to a live source fetched from the open web (see Sources).
> Compiled 2026-07-20. House style: plain English labels, normal dates, no em dashes.

---

**How this was researched.** The findings below were assembled by fanning out across multiple independent search angles, fetching primary and practitioner sources directly (AppFolio's own trust-accounting material, Intuit's official QuickBooks guidance, two state real-estate-commission rule sets, and property-accounting practitioners), and cross-checking every load-bearing claim against more than one source before stating it. Where sources agree the claim is stated plainly; where practice varies (fee percentages, state-specific thresholds) the range or the governing rule is given. Citations point to the exact pages used, all fetched live on 2026-07-20.

---

## 0. The one idea to hold onto

A third-party residential property manager is a **fiduciary running two separate money worlds at once**, and almost every accounting decision follows from keeping them apart:

1. **The estates' money (the trust world).** Rent, deposits, and reserves belong to the property owners and the tenants. The firm only *holds and moves* this money on their behalf. It is recorded in a **property-management / trust accounting system** (here, AppFolio), owner by owner and tenant by tenant.
2. **The company's own coin (the corporate world).** The fees the firm earns for doing the work (management fees, leasing fees, markups, and so on) plus what it spends to run itself (payroll, software, rent) are the firm's *own* business. They are recorded in the firm's **corporate books** (here, QuickBooks).

The two worlds are joined at exactly one hinge: **the management fee (and its sibling fees) is simultaneously an expense to an owner in the trust world and revenue to the company in the corporate world.** That single hinge is "the bridge." Get the bridge right and the books reconcile; get it wrong and the classic failure appears (owners' money masquerading as company profit). Intuit's own property-management guidance is built on this two-world split: it tells firms to keep **two separate company files**, one for the managed properties and one for the management company, "so you can keep the companies' transactions separate from each other." [Intuit]

Everything that follows is the detailed anatomy of these two worlds and the bridge between them, ending in a concrete data model for the economy component.

---

## 1. AppFolio's model: trust / property accounting

### 1.1 The trust-accounting foundation

AppFolio defines the base case plainly: "A trust account is typically established by a property manager or real estate broker to hold and manage funds that are the property of their client (the property owner)." [AppFolio eBook] Because the money is not the firm's, the platform is built around a small number of non-negotiable rules that AppFolio spells out as things a manager must **never** do: "commingle funds between clients" and "use trust funds to pay business or brokerage bills." [AppFolio eBook]

Two structural consequences fall out of that:

- **Separate trust bank accounts.** AppFolio recommends firms "establish two separate accounts, with security deposit transactions handled from one account, and rents collected and bills paid handled from the other," and keep tenant security deposits in a separate account. [AppFolio eBook] A concrete chart of accounts in the wild mirrors this with three trust checking accounts: rent collections, security deposits, and an owner reserve account. [Steph's Books]
- **The operating account is a different account entirely.** The money the firm earns is swept out of trust into the firm's own operating bank account, which never mixes with client funds.

### 1.2 The ledgers: owner, tenant, and property

AppFolio is fundamentally a **subledger system layered on a general ledger.** Every dollar is tagged to a party and a place:

- **Per-tenant ledger.** Rent is recorded "through online portals, lockboxes, and manual entries. Each payment is tied to a tenant, unit, and property, which keeps income categorized correctly," and the same structure carries late fees and pet rent. [WPM Accounting] The tenant ledger is the running record of what a resident has been charged and has paid (the receivable side).
- **Per-owner ledger.** Money collected on behalf of an owner, net of what is spent on their property and the fees they owe, accrues to the owner's ledger balance. AppFolio "separates operating accounts from trust accounts to ensure that money collected on behalf of owners is tracked correctly," and "owner draws, management fees, and reimbursements are calculated from this foundation." [WPM Accounting]
- **Per-property general ledger.** Each property carries its own GL so income and expense post "directly to the correct property and account." [WPM Accounting] The General Ledger report is the audit spine: it can be filtered by property, GL account, and date, and is used to hunt down "prior month items that have been reversed or edited" after a reconciliation. [APM Help]

### 1.3 The property chart of accounts

At the property/owner level the chart of accounts uses the standard five buckets (assets, liabilities, equity, income, expenses), but the **liability and equity sections are where trust accounting lives**: tenant security deposits are carried as a **liability** (money held that must be returned), and the owner's stake shows up as **owner equity / distributions**. [Buildium COA] A representative trust-aware chart of accounts looks like this (numbers illustrative, from a published template):

| Area | Example accounts | Type |
|---|---|---|
| Trust cash | Trust Checking – Rent Collections; Trust Checking – Security Deposits; Owner Reserve Checking | Asset |
| Receivables | Accounts Receivable – Tenants; Accounts Receivable – Owners | Asset |
| Trust liabilities | Security Deposits Held; Tenant Prepaid Rent; Owner Reserves Held; Owner Distributions Payable | Liability |
| Owner equity | Owner's Equity (contributions); Retained Earnings | Equity |
| Property income | Rent; late fees; other tenant charges | Income |
| Property expense | Repairs and maintenance; utilities; management fee; leasing fee | Expense |

Source: [Steph's Books], [Buildium COA]. A common convention numbers assets 1000-1999, liabilities 2000-2999, equity 3000-3999, revenue 4000-4999, expenses 5000-5999, with a property code in the trailing digits. [Buildium COA]

### 1.4 The money-dimension: how each event is recorded

This is the catalog the economy component needs most: every operational event that touches money and exactly which ledgers move. In trust/property accounting each event is a set of double-entry postings scoped to a property (and often an owner or tenant).

| Event | Trust-world effect (plain English) |
|---|---|
| **Rent charged** | Tenant ledger: charge posted (tenant now owes). Increases tenant receivable and property income (accrual) or is simply a scheduled charge (cash). |
| **Rent received** | Trust rent-collection cash goes up; tenant receivable goes down; the money now sits in trust owed to that owner. |
| **Security deposit received** | Trust deposit cash goes up; a **Security Deposits Held liability** goes up by the same amount. It is never income. [Buildium COA], [kmk] |
| **Security deposit refunded / applied** | Deposit liability goes down; trust deposit cash goes down (refund) or the amount is applied to charges owed. |
| **Work order / vendor bill** | A property expense is recorded and a payable to the vendor is created; when paid, trust cash goes down and the owner's ledger absorbs the cost. Vendor bills "post directly to the correct property and account." [WPM Accounting] |
| **Owner contribution** | Owner deposits money into the property (e.g., to cover a shortfall or a big repair): trust cash up, owner equity/contribution up. |
| **Owner draw / distribution** | The periodic payout of the owner's net proceeds: trust cash down, owner ledger balance down. AppFolio calculates the draw from the trust foundation. [WPM Accounting] |
| **Management fee** | The fee AppFolio "calculates automatically" as a property expense to the owner, typically a percentage of collected income. The Property Performance report verifies it by multiplying "the sum of the GL accounts subject to management fees times the percentage." [WPM Accounting], [APM Help] This is the **near end of the bridge** (section 3). |
| **Late fee** | Charged on the tenant ledger as property income; may be split with the owner per the management agreement (the firm's share becomes company revenue via the bridge). [Buildium income] |
| **Application / leasing fee** | Application/screening fees and leasing/placement fees are charged; leasing and placement fees are typically the firm's revenue, application fees may pass through or be retained per agreement. [Buildium income] |
| **Reserves** | An owner **minimum balance / reserve** is held back in trust so the property can pay its own bills; reserve contributions increase an Owner Reserves Held liability and the reserve cash. Firms commonly hold a maintenance reserve (a rule of thumb is 3 to 6 months of operating expenses). [Steph's Books], [kmk] |

The single most important invariant across all of these: **security deposits and owner funds are liabilities and owner equity, never company income.** [Summit Ledger], [kmk]

### 1.5 Owner statements

The owner statement is the periodic report AppFolio produces per property/owner. It "summarizes income, expenses, and distributions" for the period. [WPM Accounting] In practice it reads like a small cash-flow statement for the property: a beginning owner balance, the income collected, the expenses paid (including the management fee as a line), the owner draw, and an ending balance (often with the reserve shown). Because it is generated straight from the per-property GL and owner ledger, it is the owner-facing face of the trust world and one of the four "key readings" the economy component must be able to produce (section 6).

### 1.6 Three-way trust reconciliation

The compliance keystone. Monthly, the trust bank must be proven to hold exactly what the firm owes. AppFolio's own guidance: "bank accounts should balance to GL account activity" and "keep all accounts reconciled on a monthly basis." [AppFolio eBook] The formal version regulators require is a **three-way reconciliation**, matching three numbers that must all agree:

1. **Bank statement balance** (adjusted): ending bank balance plus deposits in transit minus outstanding checks. [NCREC]
2. **Book / checkbook balance**: the firm's own cash record for the trust account. [NCREC]
3. **Trial balance of all client ledgers**: the sum of every owner and tenant balance, i.e. "every dollar in the Trust Account by the tenant or client." [NCREC]

If the three do not tie out, money is either missing (a shortage) or unexplained (an overage), and both are violations (section 4). This reconciliation is the health check the economy component's "coffers/solvency" reading is built to reproduce continuously rather than once a month.

---

## 2. QuickBooks for the company's own books

### 2.1 The architecture: the management company is its own business

The corporate world is small and ordinary by comparison: it is just a services business. Intuit's official property-management guidance recommends keeping **two separate company files** and is explicit about the split of responsibilities: a **rental property file** that tracks the managed properties (rent income, owner payments through an "owner payment" account, expenses categorized per property with Customer:Job, and security deposits as a liability), and a **property management company file** where "management fees appear as income" booked to a "Property management income" account. [Intuit]

In a firm that runs AppFolio, AppFolio *is* the "rental property file" (it does the trust world far better than QuickBooks can), and QuickBooks holds **only** the second file: the management company's own P&L and balance sheet. That division is the whole reason the bridge exists (section 3).

### 2.2 Corporate revenue (what the firm earns)

Every one of these is the firm's own income and belongs in QuickBooks, not on an owner statement. Typical residential streams and their common shapes:

| Revenue stream | Typical shape |
|---|---|
| **Management fee** | A percentage of collected rent (commonly around 8-12%), or a flat fee per unit; sometimes a flat fee for associations. [Buildium income], [Balanced Assets] |
| **Leasing / tenant placement fee** | Often the first month's rent, or a percentage, charged when a new tenant is placed. [Buildium income], [Balanced Assets] |
| **Lease renewal fee** | A fixed flat fee or a small percentage at renewal. [Buildium income], [Balanced Assets] |
| **Maintenance / repair markup** | A surcharge for coordinating repairs (acting as general contractor), commonly 10-20% or more of the maintenance bill. [Buildium income], [Balanced Assets] |
| **Late fee split / other tenant fees** | The firm's contractually agreed share of late/NSF fees, plus lockout/re-key, pet, parking, and online-payment convenience fees where the firm retains them. [Buildium income] |
| **Onboarding / setup fee** | A one-time fee to bring a new owner or property under management. [Buildium income] |
| **Eviction, inspection, vacancy, bill-pay, and ancillary fees** | Dedicated per-event or per-service fees; plus resident-benefit-package (RBP) and other ancillary programs. [Balanced Assets] |

### 2.3 Corporate expenses (what the firm spends on itself)

Ordinary operating costs of a services business, none of which ever touch trust money: [Buildium income], [Buildium COA]

- **Payroll and contractors** (the largest line; fully loaded employee cost is often 1.25 to 1.4 times salary once benefits and overhead are included).
- **Software and platforms** (AppFolio itself, screening, accounting, project tools).
- **Office rent and utilities, supplies, vehicles** (overhead).
- **Insurance and licensing** (general liability, errors-and-omissions, professional licensing, association dues).
- **Professional services** (legal for lease drafting and evictions, accounting/CPA, marketing).

### 2.4 How the corporate P&L and balance sheet are built

The corporate **profit and loss** is simply corporate revenue (2.2) minus corporate expenses (2.3) over a period. The corporate **balance sheet** carries the firm's operating cash, its receivables (fees earned but not yet swept out of trust: see the "due from trust" bridge account in section 3), fixed assets, any debt, and owner's equity in the firm. Two design notes that matter for the data model:

- Firms commonly track revenue **by source and by portfolio/department** (class or location tracking in QuickBooks, or the two-file split Intuit describes) so the P&L can answer "how much did management fees earn vs leasing." [Intuit]
- Growing firms are advised to run the corporate books on an **accrual** basis for a truer picture, even though the trust world is often reported on a cash basis to owners; the economy component therefore needs to be able to speak both bases. [kmk]

---

## 3. The bridge: how AppFolio fees become QuickBooks revenue

This is the crux of the whole design, and the place firms most often go wrong.

### 3.1 The transfer point is the fee

In the trust world, a management fee (or leasing fee, or markup) is an **expense charged to an owner** and deducted from that owner's proceeds inside AppFolio. In the corporate world, that exact same fee is **revenue to the company**. The dollar does not change; its *ownership* does. The moment the fee is assessed, the money that was "owner's money held in trust" becomes "company's money that happens to still be sitting in the trust bank until it is swept out." The bridge is the accounting that carries the fee across that line and nothing else.

### 3.2 How firms actually move the data

There is **no live, native, two-way sync** between AppFolio and QuickBooks. Multiple independent practitioners describe the same reality: AppFolio is "a standalone accounting system with its own general ledger," and "data moves from AppFolio to QuickBooks through an export-import workflow, not a live sync." [Summit Ledger], [REA] The methods firms use, from crudest to cleanest:

1. **Manual re-entry / CSV or IIF export-import.** Export the general ledger (typically CSV or IIF), map AppFolio account names to QuickBooks accounts by hand, import, then reconcile both systems to the same bank statement. [REA]
2. **Summary journal entries.** Rather than importing every property transaction, post periodic **summary journal entries** into QuickBooks that capture only what belongs there: management fee income, other company fee income, and the corresponding cash/receivable. This is the method most aligned with the two-world split, because it deliberately leaves owner funds and deposits in AppFolio. [Summit Ledger]
3. **Third-party / middleware sync tools.** Various connectors exist to script the export-map-import loop, but they are still fundamentally moving a subset of data one way, and they inherit the mapping problem below. [REA]

The dominant professional recommendation is to **treat AppFolio as the system of record for property/trust accounting and keep QuickBooks scoped to the company's own books**, rather than mirroring every property transaction into QuickBooks. [REA], [Summit Ledger]

### 3.3 The cardinal error, and the fix

The single most common and most dangerous mistake: **booking owner funds or security deposits as company income.** As one practitioner puts it, if the export "dumps those into income accounts in QuickBooks Online, your profit is overstated and your liability accounts are fiction." [Summit Ledger] The fix is a mapping discipline: **map deposits and owner funds to liability accounts, then verify by reconciling the liability balance against the actual trust/deposit bank account.** [Summit Ledger] Only genuinely earned fees cross into income.

### 3.4 Timing: three dates for one payment

Even with correct mapping, the two systems drift because a single payment carries **three different dates**: property software records it when the charge is applied, the bank records it when it clears, and QuickBooks records it when the entry is made. [Summit Ledger] Reconciliation therefore requires a documented, consistently applied convention for which date governs. This is why the economy component models an event's *occurrence* date separately from its *cash-settlement* date.

### 3.5 Where the two dimensions diverge, and where they must reconcile

- **They diverge (by design):** the trust dimension reports per-property and per-owner cash flow to owners (usually cash basis); the corporate dimension reports the firm's own profitability (often accrual). Owner-money movements (rent in, vendor out, owner draw) appear in full in the trust world and **not at all** in the corporate P&L.
- **They must reconcile (at the hinge):** the total of fees the firm charged owners inside AppFolio for a period must equal the fee revenue recognized in QuickBooks for that period; and the "money owed to the company still sitting in trust" (a trust-side payable) must equal the "due from trust" receivable on the corporate balance sheet until it is swept. If those two identities hold, the bridge is sound.

---

## 4. Trust-accounting compliance (general / best-practice)

The rules below are drawn from real estate regulators and are broadly representative; specifics vary by state, and AppFolio itself advises confirming with "the Department of Real Estate for your state." [AppFolio eBook] The economy component should encode these as guardrails, not just report on them.

- **Trust funds defined.** Money "received by a broker or salesperson on behalf of a principal or any other person, and which are held for the benefit of others." [CA DRE] It must be deposited promptly (California: into a trust account, neutral escrow, or the owner's hands within three business days). [CA DRE]
- **Commingling is prohibited.** "Funds belonging to a licensee may not be commingled with trust funds. Commingling is strictly prohibited." [CA DRE] AppFolio states the same operational rule: never mix client funds or use trust funds for business bills. [AppFolio eBook]
- **Narrow exceptions for the broker's own money.** California allows only two: up to **$200** of broker funds to cover bank service charges, and earned commissions/fees may remain in the trust account no more than **25 days** before being withdrawn. [CA DRE] These define exactly how the "earned but not yet swept" fee may sit in trust.
- **Per-beneficiary segregation.** A "separate record for each beneficiary or transaction" showing deposits, disbursements, and a running balance. [CA DRE]
- **The aggregate-liability identity.** "Funds on deposit in the trust account must always equal the broker's aggregate trust fund liability," and "the balance on the bank account record should equal the total of all beneficiary record balances." [CA DRE] A shortage or an unexplained overage are both violations. This is the mathematical heart of the "coffers" reading.
- **Monthly three-way reconciliation.** Required monthly (except months with no activity), matching bank, book, and client-ledger trial balances (section 1.6). [CA DRE], [NCREC] Best practice is within 48 hours of the bank statement. [NCREC]
- **Record retention.** Trust records, canceled checks, and related documents retained for a period set by state rule (California: three years). [CA DRE]

---

## 5. The taxonomy: a general chart of accounts at both levels

Everything that costs or earns, organized by the two worlds. This is the vocabulary the economy component's account table is seeded from. Account numbers are illustrative and follow the common 1000-block convention. [Buildium COA], [Steph's Books]

### 5.1 Property / trust level (the estates' money)

| Type | Account (plain label) | Notes |
|---|---|---|
| Asset | Trust Checking - Rent Collections | Owner operating cash held in trust |
| Asset | Trust Checking - Security Deposits | Segregated deposit cash [AppFolio eBook] |
| Asset | Owner Reserve Checking | Reserve cash held back per property |
| Asset | Accounts Receivable - Tenants | Rent and charges billed, unpaid |
| Asset | Accounts Receivable - Owners | Costs owed by an owner (e.g., negative balance) |
| Liability | Security Deposits Held | Owed back to tenants; never income [Buildium COA] |
| Liability | Tenant Prepaid Rent | Rent received for future periods |
| Liability | Owner Reserves Held | Reserve floor held per property |
| Liability | Owner Distributions Payable | Draws calculated, not yet paid |
| Liability | **Due to Management Company** | Fees earned, still in trust, awaiting sweep (the trust side of the bridge) |
| Equity | Owner's Equity / Contributions | Owner capital put into the property |
| Equity | Owner Retained Earnings | Accumulated net for the property |
| Income | Rent Income | Per property/unit |
| Income | Late Fee Income, Pet Rent, Other Tenant Charges | Per management agreement, some shared |
| Income | Application Fee, RUBS / Utility Reimbursement | Pass-through or retained per agreement |
| Expense | Repairs and Maintenance, Turnover | Vendor work orders |
| Expense | Utilities, Landscaping, Insurance (property) | Property operating costs |
| Expense | **Management Fee** | Owner expense; company revenue via the bridge |
| Expense | **Leasing / Placement Fee, Renewal Fee, Maintenance Markup** | Same dual nature as the management fee |

### 5.2 Corporate level (the company's own coin)

| Type | Account (plain label) | Notes |
|---|---|---|
| Asset | Operating Checking | The firm's own bank, never trust money |
| Asset | **Due from Trust** | Earned fees not yet swept (corporate side of the bridge) |
| Asset | Fixed Assets, Prepaid Expenses | Ordinary business assets |
| Liability | Accounts Payable, Payroll Liabilities, Credit Cards | Ordinary business payables |
| Equity | Owner's Equity in the Firm, Retained Earnings | The firm's own equity |
| Revenue | Management Fee Income | Primary line [Intuit] |
| Revenue | Leasing / Placement Income, Renewal Income | |
| Revenue | Maintenance Markup Income | |
| Revenue | Late Fee Share, Ancillary / RBP Income | The firm's retained share |
| Revenue | Onboarding / Setup, Eviction, Inspection, Other Fees | |
| Expense | Payroll and Contractor Labor | Largest line [Buildium income] |
| Expense | Software and Platforms (incl. AppFolio) | |
| Expense | Office Rent, Utilities, Supplies, Vehicles | Overhead |
| Expense | Insurance and Licensing (GL, E&O, dues) | |
| Expense | Legal, Accounting, Marketing | Professional services |

The two **bridge accounts** ("Due to Management Company" in trust, "Due from Trust" in corporate) are the only accounts that must always mirror each other. They are the data-level embodiment of the hinge.

---

## 6. Recommended data model for the economy component

Model-focused and ready to load onto the existing LandLord stack (Supabase Postgres, `ops` schema, RLS, single-file app). Labels stay plain English per the house design law; the medieval theme is a UI skin only. The mapping of the user's vocabulary to the model: **estates = properties**, **the estates' money = the trust book**, **the company's own coin = the corporate book**, **coffers = cash balances/solvency readings**, **the bridge = the fee posting plus the two Due-to/Due-from accounts.**

### 6.1 Design principles

1. **Two books, one engine.** A single double-entry ledger with a `book` dimension (`trust` | `corporate`). Not two databases: one posting engine that tags every line with which world it belongs to. This is what lets one system serve **both** the AppFolio (property/owner) and the QuickBooks (CPA/corporate) reporting dimensions without hardwiring either firm's data.
2. **Double-entry, always balanced within a book.** Every event's postings sum to zero per book. The bridge balances via the Due-to/Due-from clearing pair, so each book stands on its own yet the hinge is explicit.
3. **Subledger dimensions on every line.** Each posting carries optional `property_id`, `owner_id`, `tenant_id`, `vendor_id`. Owner statements, tenant ledgers, and the client trial balance are all just filtered sums, not separate stores.
4. **The money-dimension rides on operational events.** Operational objects already in LandLord (campaigns, initiatives, tasks, work orders, feed items, and future AppFolio-sourced events) can *carry* money by attaching a `ledger_event`. Money is an optional facet of an event, not a separate universe.
5. **Append-only, like `ops.memory_entries`.** Postings are never edited or deleted; corrections are reversing entries. This mirrors the project's existing iron rule and gives a defensible audit trail for trust compliance.
6. **Compliance is invariants, not reports.** The aggregate-liability identity and the commingling prohibition are enforced/checked in the data layer (section 6.7), not left to a human to notice.

### 6.2 Core entities (in the `ops` schema, following existing conventions)

Conventions matched to the repo: `uuid primary key default gen_random_uuid()`, `text not null default ''`, `timestamptz not null default now()`, enums cast explicitly, RLS via `ops.is_leadership()`, `notify pgrst` after DDL, no writes to `public`.

```
ops.estates            -- properties under management (id, slug, name, owner_id, address, status, unit_count, mgmt_agreement_id)
ops.units              -- units within an estate (id, estate_id, label, beds, market_rent)
ops.owners             -- principals / landlords (id, name, contact, reserve_floor_cents, statement_pref)
ops.leases             -- (id, unit_id, tenant_id, start, end, rent_cents, deposit_cents, status)
ops.tenants            -- residents (id, name, contact)
ops.vendors            -- (id, name, w9_on_file, insurance_expires)

ops.gl_accounts        -- chart of accounts, BOTH books
  (id, book ops.ledger_book, code text, name text,
   type ops.acct_type,           -- asset|liability|equity|income|expense
   normal_side ops.dr_cr,        -- debit|credit
   is_trust_cash bool, is_bridge bool, active bool)

ops.fee_rules          -- how fees are computed (id, estate_id, kind, basis, rate_bps, flat_cents, split_owner_bps)
                       --   kind: management|leasing|renewal|markup|late_split ; basis: collected_income|gross_rent|per_unit|flat

ops.ledger_events      -- the money-dimension on operational events
  (id, kind ops.event_kind, occurred_on date, settled_on date null,
   book_scope ops.ledger_book,      -- trust | corporate | bridge (spans both)
   estate_id null, owner_id null, tenant_id null, vendor_id null,
   amount_cents bigint, memo text,
   source_kind text, source_id uuid,  -- link back to a campaign/task/work-order/feed item
   created_by uuid references ops.profiles(id), created_at timestamptz)

ops.ledger_postings    -- double-entry lines, APPEND-ONLY (trigger-enforced)
  (id, event_id references ops.ledger_events(id),
   book ops.ledger_book, account_id references ops.gl_accounts(id),
   estate_id null, owner_id null, tenant_id null, vendor_id null,
   debit_cents bigint default 0, credit_cents bigint default 0,
   posted_at timestamptz, reverses_posting_id uuid null)

ops.reconciliations    -- monthly three-way snapshots
  (id, book, bank_account_id, as_of date,
   bank_adjusted_cents, book_balance_cents, client_trial_cents, variance_cents, status)
```

Enums to add: `ops.ledger_book (trust|corporate)`, `ops.acct_type`, `ops.dr_cr`, `ops.event_kind`, matching the pattern already used for `ops.actor_type`.

### 6.3 The money-dimension: event to postings

Each `event_kind` expands deterministically into balanced postings. The catalog (cents omitted; DR/CR shown):

| event_kind | Book | Postings (DR / CR) |
|---|---|---|
| `rent_charged` | trust | DR AR-Tenants / CR Rent Income (accrual) |
| `rent_received` | trust | DR Trust Checking-Rent / CR AR-Tenants |
| `deposit_received` | trust | DR Trust Checking-Deposits / CR Security Deposits Held |
| `deposit_refunded` | trust | DR Security Deposits Held / CR Trust Checking-Deposits |
| `vendor_bill` | trust | DR Repairs/Maintenance (estate) / CR Accounts Payable (vendor) |
| `vendor_paid` | trust | DR Accounts Payable / CR Trust Checking-Rent |
| `owner_contribution` | trust | DR Trust Checking-Rent / CR Owner's Equity |
| `owner_draw` | trust | DR Owner Distributions Payable / CR Trust Checking-Rent |
| `reserve_funded` | trust | DR Owner Reserve Checking / CR Owner Reserves Held |
| `management_fee` | **bridge** | trust: DR Management Fee (estate) / CR Due to Mgmt Co · corporate: DR Due from Trust / CR Management Fee Income |
| `leasing_fee` / `renewal_fee` / `markup` | **bridge** | same shape as management_fee, different accounts |
| `late_fee` | trust + bridge | trust: DR AR-Tenants / CR Late Fee Income; then the firm's split flows over the bridge like a fee |
| `fee_sweep` | **bridge** | trust: DR Due to Mgmt Co / CR Trust Checking-Rent · corporate: DR Operating Checking / CR Due from Trust |
| `corp_expense` | corporate | DR (payroll/software/rent/etc.) / CR Operating Checking or AP |
| `corp_income_other` | corporate | DR Operating Checking / CR (onboarding/eviction/etc.) |

Two guarantees this table gives the component: every operational event has a **single, testable** money expansion, and the only `event_kind`s that ever move a dollar from the estates' world into the company's world are the explicit **bridge** kinds.

### 6.4 The fee bridge, worked

A $150 management fee on estate P, owner O, then swept:

```
management_fee (bridge)
  trust     DR 5300 Management Fee [P,O]     150
  trust     CR 2400 Due to Management Company 150     -> owner O's net drops 150; cash still in trust
  corporate DR 1200 Due from Trust            150
  corporate CR 4200 Management Fee Income      150     -> company recognizes revenue

fee_sweep (bridge)      (may batch many fees)
  trust     DR 2400 Due to Management Company 150
  trust     CR 1010 Trust Checking-Rent       150     -> money leaves trust, legally (earned)
  corporate DR 1000 Operating Checking        150
  corporate CR 1200 Due from Trust            150     -> money lands in company bank
```

At all times `Due to Management Company` (trust) equals `Due from Trust` (corporate). That equality is the bridge's self-check.

### 6.5 The four key readings

1. **Coffers / solvency (the three-way, continuous).** For each trust bank: `bank_balance` vs `Σ owner ledger balances + Σ Security Deposits Held + Σ Owner Reserves Held + Due to Mgmt Co`. Variance must be zero; a nonzero variance is the alarm the monthly reconciliation would eventually catch, surfaced live. Corporate coffers = Operating Checking + Due from Trust - AP - payroll liabilities = runway. [CA DRE], [NCREC]
2. **Corporate P&L.** Sum corporate income minus corporate expense over a period, groupable by revenue source and by portfolio. This is the CPA/QuickBooks dimension. [Intuit]
3. **Owner statement.** Per estate/owner over a period: beginning owner balance, income postings, expense postings (management fee shown as a line), owner draw, ending balance and reserve. This is the AppFolio/owner dimension, produced from the same postings. [WPM Accounting]
4. **Budget vs actual.** Per estate, planned amounts per account vs actual posting sums for the period. (Add `ops.budget_lines (estate_id, account_id, period, amount_cents)`.)

Because 2 and 3 read the **same** posting store filtered by `book` and by subledger dimension, the component serves both reporting dimensions without a second set of books, and the bridge accounts are exactly where they are forced to agree (section 3.5).

### 6.6 Fit with LandLord

- **`ops` schema only, `public` untouched.** All tables land in `ops`, respecting the shared-project guardrail.
- **RLS + leadership scoping** via the existing `ops.is_leadership()` pattern; money is leadership-visible first, with room for owner-scoped read later.
- **Append-only postings** reuse the append-only trigger discipline already proven on `ops.memory_entries`; corrections are reversing events (`reverses_posting_id`).
- **Dual-write rule** still applies to any `app/index.html` surface that renders coffers or statements (sync to `ops.app_assets`).
- **Operational spine already exists.** `ledger_events.source_kind/source_id` link money to the campaigns, initiatives, tasks, and feed already in the app, and to AppFolio-sourced events once the read API (PLAN.md item E1) lands. The economy component is the money-dimension bolted onto that spine, not a parallel app.
- **Seed path:** `gl_accounts` seeds directly from the section 5 taxonomy; `fee_rules` seed from each management agreement; historical AppFolio data can backfill `ledger_events` via export (the same export used for the QuickBooks bridge, section 3.2).

### 6.7 Compliance encoded as invariants

- **Aggregate-liability check:** a scheduled function recomputes the section 6.5 reading per trust bank and writes an `ops.reconciliations` row; any nonzero variance raises an insight (reusing the existing `ops.run_insight_pass` / Counsel approval machinery).
- **Per-owner solvency (no cross-subsidy):** no posting may drive an owner's trust ledger below zero (or below their reserve floor). Spending more on a property than its owner holds in trust is, by definition, using another owner's money, which is the commingling failure in its most common real-world form. The engine rejects owner-draw and vendor-payment events that would overdraw the owner.
- **Commingling guard:** a posting-time rule rejects any event that debits a corporate expense against a trust-cash account, or that moves trust cash to the company by any path other than a `fee_sweep` of already-earned `Due to Management Company`. This is the data-layer form of "never use trust funds to pay business bills." [AppFolio eBook], [CA DRE]
- **Earned-fee aging:** flag `Due to Management Company` balances older than the state limit (California: 25 days) so earned fees are swept in time. [CA DRE]
- **Deposit integrity:** `Security Deposits Held` can only be relieved by a refund or an application to that tenant's charges, never swept to the company. [Summit Ledger]

### 6.8 What to load first (phasing)

1. **Accounts + books + fee rules** (static taxonomy; no live money yet).
2. **The posting engine + event catalog** (section 6.3) with the append-only and balance triggers.
3. **The four readings** (6.5), starting with coffers/solvency and the owner statement.
4. **The bridge** (management fee + sweep) and the corporate P&L.
5. **Compliance invariants** (6.7) wired into the insight pass.
6. **AppFolio backfill** once the read API is available, so the ledger reflects the real ~200-unit portfolio rather than seed data.

This keeps the component general and loadable: it models the two-ledger economy of any third-party residential PM firm, serves both the property/owner and corporate/CPA dimensions from one posting store, and reconciles them at the single fee-bridge hinge, all without hardwiring any specific firm's private figures.

---

## Sources

All fetched live on 2026-07-20 from the open web.

1. AppFolio, *Trust Accounting for Property Managers* (eBook, PDF): [info.appfolio.com/rs/appFolio/images/AppFolio_eBook_TrustAccounting.pdf](http://info.appfolio.com/rs/appFolio/images/AppFolio_eBook_TrustAccounting.pdf)
2. WPM Accounting, *How AppFolio Handles Property Management Accounting From Rent to Reporting*: [wpmaccounting.com](https://www.wpmaccounting.com/post/how-appfolio-handles-property-management-accounting-from-rent-to-reporting)
3. APM Help, *General Ledger and Property Performance Reports in AppFolio*: [apmhelp.com](https://www.apmhelp.com/blog/appfolio-general-ledger-property-performance)
4. Intuit QuickBooks, *Record transactions for a property management company* (official help): [quickbooks.intuit.com](https://quickbooks.intuit.com/learn-support/en-us/help-article/service-items/record-transactions-property-management-company/L3ibLu83B_US_en_US)
5. California Department of Real Estate, *Trust Funds* (RE 13, official regulator PDF): [dre.ca.gov/files/pdf/re13.pdf](https://dre.ca.gov/files/pdf/re13.pdf)
6. North Carolina Real Estate Commission, *Reconcile Trust Accounts Monthly* (Bulletins): [bulletins.ncrec.gov](https://bulletins.ncrec.gov/rec%C2%B7on%C2%B7cile-to-make-peace-adjust-reconcile-trust-accounts-monthly/)
7. REA, *AppFolio Accounting Integration: Complete Setup & Optimization Guide*: [rea.co](https://rea.co/appfolio-accounting-integration-complete-setup-optimization-guide/)
8. Summit Ledger Books, *AppFolio and QuickBooks Don't Match: Why It Happens and How to Fix It*: [summitledgerbooks.com](https://summitledgerbooks.com/blog/appfolio-quickbooks-integration/)
9. Buildium, *Property Management Chart of Accounts: Guide & Template*: [buildium.com](https://www.buildium.com/blog/chart-of-accounts-property-management/)
10. Buildium, *Property Management Income and Expenses*: [buildium.com](https://www.buildium.com/blog/property-management-income-and-expenses/)
11. Balanced Asset Solutions, *Top Property Management Revenue Streams*: [balancedassetsolutions.com](https://www.balancedassetsolutions.com/property-management-revenue-streams/)
12. Steph's Books, *Property Management Chart of Accounts: Template and Setup Guide*: [stephsbooks.com](https://stephsbooks.com/blog/property-management-chart-of-accounts)
13. KMK Ventures, *Property Management Accounting: The Complete Guide (2026)*: [kmkventures.com](https://kmkventures.com/property-management-accounting/)


