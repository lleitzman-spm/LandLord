# The PM Task-and-Process Library (reference)

*Generated 2026-07-20 by a LandLord "ultracode" Opus workflow — one agent per PM domain designed
its systems -> leaves -> grammar bindings, a skeptical second pass adversarially hardened each, and
a synthesis pass produced this document. **10 domains, 24 flow grammars,
297 leaves.** The structured data lives in `data/library/pm-reference.json`.*

*This is a **general, reference** library — a factory asset (docs/KINGDOM.md, "The task-language").
It is **not loaded by default** and is **not firm-specific**: a firm's real catalog still loads at the
data gate. The working-fluid founding alphabet in `src/domain/catalog.ts` stays small; this is
the deep reference a setting can draw from. Grammars name general **roles** (property-manager,
maintenance-coordinator, accounting, vendor, owner, tenant…) a setting maps to its real seats
before loading them as flow templates. The medieval "kingdom" skin is applied by the app, not baked
in here.*

---

# LIBRARY-PM — The General Property-Management Task & Process Library

*A factory asset. This library is the reusable, company-agnostic instruction set for
third-party US residential property management (scattered-site single-family and small
multifamily). It is not any one firm's catalog; a specific firm's real catalog loads later,
at a gated merge, over the top of this shape. See `docs/KINGDOM.md` — "The task-language" and
"The synergy brief" — for where this library sits in the larger instrument.*

> **The medieval skin is not in here.** LandLord dresses the operating model as a kingdom —
> seats become fiefs, owners become Patrons, vendors become sellswords — but that theming is
> applied by the *app*, at read time, over the general rows below. This library speaks plain,
> professional property-management English: a work order is a work order, a tenant is a tenant,
> an owner is an owner. Nothing here should ever have to be de-themed to be reused by a firm
> that has never heard the word "fief."

---

## 1. The spine: a task-type is a word

A **task-type** is a word in a bounded, compositional language. Each word is a path down a
small three-level tree:

```
DOMAIN            →   SYSTEM              →   LEAF
maintenance       →   hvac                →   no-cooling
```

The dotted key `maintenance.hvac.no-cooling` **is** the word. It is the stable identifier an
event references (`CatalogRow.key`), and it resolves to a human title ("No cooling") for
display. The three levels are three facets on a catalog row:

| Level | Field on `CatalogRow` | What it is | Example |
|---|---|---|---|
| Domain | `domain` | The top facet — a division of PM work | `maintenance` |
| System | `system` | A grouping within a domain | `hvac` |
| Leaf | `key` (dotted) + `title` | The task-type itself | `maintenance.hvac.no-cooling` / "No cooling" |

**The alphabet at each level is deliberately tiny; the words are many but bounded.** Ten
domains, sixty-two systems, and (in this reference build) 297 leaves. The tree readings
(`rowsByDomain`, `domainsOf`, `systemsOf` in `src/domain/catalog.ts`) fold this structure
fresh from the loaded rows — a row with no facets simply does not appear in the tree, so old
flat keys and swapped-in setting rows coexist without breaking it.

### Bounding the alphabet (the 80–95% rule)

For each system we capture only the **high-frequency, real** task-types — the ~80–95% of
volume that actually occurs on a scattered-site residential book — **ordered by prevalence**,
not an exhaustive long tail. A system's first leaf is its most common call; its last is the
edge of what earns a named word. Anything rarer is handled as a `general` / catch-all leaf or
routed by triage, never given its own word. This is what keeps the library learnable and the
event taxonomy legible: a dispatcher, an agent, or a report can reason over ~300 words, not
thousands.

Every leaf carries, beyond its facets:

- `class` — `run` / `acq` / `firm` (recurring operations / growth / fiduciary-and-legal).
- `mode` — `human` (◆, a judgment seat must act) or `auto` (⚙, the machine may run it).
- `completes` — the flow grammar that actually finishes the task (see §2). **Absent → the
  task is atomic:** a single `done` closes it (most one-touch communications and postings).
- `params` — the letters that fill the grammar's blanks (`{ trade, urgency, … }`).
- `note` — plain-English operating context.

---

## 2. The compression: few grammars, many words

If every one of 297 leaves carried its own hand-written procedure, the library would be
unmaintainable and no agent could execute it. The compression that makes it buildable:

> **A couple dozen reusable FLOW GRAMMARS (procedure shapes) cover almost everything. A leaf
> BINDS a grammar and PARAMETERIZES it.** Many words, few grammars.

A grammar is a `FlowTemplate` (`src/domain/flows.ts`): a trigger plus an ordered list of steps,
each step naming the catalog row it is an instance of, the **role** that holds it, the board it
renders on, a timing edge (relative days or a calendar window), and an optional SLA. The
grammar is pure config — no branch of code knows the word "work order" or "move-out"; the
template says it all.

### How a leaf binds and fills a grammar

```
Leaf:  maintenance.hvac.no-cooling
       completes: "vendor-dispatch"
       params:    { trade: "HVAC", urgency: "emergency" }

Grammar: vendor-dispatch
       report → identify → assign-vendor → dispatch → invoice → confirm → pay → post-to-accounting
       step note: "A sellsword of the {trade} trade chosen for a {urgency} call."
```

At trigger time, `instantiateFlow(template, subject, opts, params)` opens one case and hands
the first step; `{token}`s in each step's **note, condition, and board** are substituted from
the leaf's `params` (`{trade}` → "HVAC"). So one grammar renders as many distinct words:
`no-cooling` walks as an **emergency HVAC** dispatch, `routine-service` as the *same grammar*
at a routine pace, `plumbing.leak` as an **emergency plumbing** dispatch.

**The load-bearing rule (a correctness landmine):** `{token}` substitution touches text only —
**never the `holder`.** Holders stay real identifiers: a role/queue (`pm-desk`, `va-desk`,
`lp-queue`) or a mapped person id. A leaf's *trade* is flavor in the note, not a fake seat.
This keeps the step-state fold (`readFlow`, which matches by `catalogRow` + `holder`) intact
across every parameterization.

### Grammars chain (the relay pattern)

A grammar's terminal step may trigger another grammar, forming a relay: a move-out
reconciliation hands off to a make-ready turn, which hands off to vacancy marketing, which
hands off to application screening and lease execution. This is the deepest compression lever —
the full tenant lifecycle is a *chain of a few grammars*, not one mega-procedure. (See the
consolidation notes for making chaining and insertable sub-flows first-class.)

---

## 3. Roles, not people

Grammar steps are held by general **roles**, never by named individuals. A role is a seat's
job, not a person:

`property-manager` · `maintenance-coordinator` · `leasing-agent` · `accounting` · `vendor`
· `owner` · `tenant` · `broker`

In the shipped mechanism these surface as queue holders until a setting maps them — e.g.
`pm-desk` (property-manager), `va-desk` (maintenance-coordinator), `lp-queue` (accounting /
ledger-posting). A **vendor** is always external labor (in the kingdom skin, a *sellsword*):
a vendor holder is a queue or an external id, never a fake internal seat. Tenants and owners
appear as roles on steps where the procedure genuinely waits on *them* (owner approval, tenant
scheduling), which keeps the human-in-the-loop stops honest.

---

## 4. How a factory setting loads the library

A **factory setting** is one firm's concrete operating model laid over this general shape. Two
seams connect them, both already present in the mechanism:

### 4a. Mapping roles → real seats

The setting supplies a mapping from the eight general roles to its actual seats (people,
queues, or agents). `property-manager` → a named PM or a `pm-desk` queue; `accounting` → a
bookkeeper or the `lp-queue`; `vendor` → the firm's approved-vendor roster. Because grammar
steps name only roles, the same grammar library runs for a two-person shop and a fifty-door
regional book without editing a single template — only the map changes.

### 4b. Loading the rows: `catalog.load` / `flows.load`

The catalog and the flow book are **loadable chronicle shelves** (`Chronicle.catalog`,
`Chronicle.flows` in `src/domain/chronicle.ts`). A chronicle with no such shelf adopts the
founding rows (the census-migration pattern in `normalizeChronicle`); a shelf that is present
— even empty — is the truth as loaded. A factory setting **pours its real rows in through
`catalog.load` / `flows.load`** at the AppFolio-gated merge (the convention referenced in
`docs/KINGDOM.md`, "The task-language"). Until that gate opens, a small working-fluid alphabet
exercises the machine; nothing firm-specific is hardwired in code.

This is the leash (`docs/KINGDOM.md`, the factory/setting seam): **LandLord ships the mechanism
and this general library; a setting loads its own domains, systems, leaves, params, vendor
roster, and any bespoke grammars.** The test of the mechanism is blunt — a firm's concrete
catalog must assemble from these parts with no new code. This general library is the reference
instance that proves the parts are powerful enough.

### 4c. Events reference the loaded rows

Once loaded, every event in the log references a catalog row by key; the tag resolves key →
title for display, `flowKeyFor` tells a seat or an agent whether triggering a leaf opens a
cascade or a single typed task, and the whole operating instrument (queues, aging, the
Regent's desk, the Throne) folds from those events. The library is therefore not decoration —
it is the **executable instruction set the per-seat agents run** (`docs/KINGDOM.md`, "The
library is the agents' instruction set").

---

## 5. Table of contents — domains → systems

Ten domains, ordered along the property/tenant lifecycle. Leaf counts in brackets; systems are
listed in rough prevalence order.

| # | Domain (key) | Systems `[leaves]` | Σ leaves |
|---|---|---|---|
| 1 | **maintenance** | triage `[5]` · plumbing `[8]` · hvac `[7]` · electrical `[6]` · appliance `[6]` · general `[6]` · exterior `[8]` · preventive `[8]` | 54 |
| 2 | **leasing** | pricing `[3]` · listing `[5]` · showings `[4]` · applications `[4]` · lease-execution `[4]` · move-in `[4]` | 24 |
| 3 | **tenancy** | billing `[7]` · collections `[5]` · violations `[6]` · eviction `[5]` · communications `[7]` | 30 |
| 4 | **renewals** | market-analysis `[3]` · renewal-offers `[4]` · negotiation `[2]` · non-renewal `[3]` · month-to-month `[2]` · execution `[3]` | 17 |
| 5 | **move-in** | scheduling `[7]` · funds `[5]` · inspection `[4]` · utilities `[3]` · access `[3]` · compliance `[4]` | 26 |
| 6 | **turns** | notice `[5]` · inspection `[2]` · deposit `[2]` · make-ready `[9]` · charges `[3]` · handoff `[3]` | 24 |
| 7 | **accounting** | trust `[5]` · bill-pay `[5]` · draws `[6]` · approvals `[4]` · reserves `[4]` · owner-lifecycle `[5]` | 29 |
| 8 | **compliance** | notices `[6]` · eviction `[5]` · fair-housing `[5]` · habitability `[6]` · registration `[6]` · trust-accounting `[6]` · licensing `[5]` | 39 |
| 9 | **inspections** | interior `[5]` · exterior `[5]` · annual `[4]` · lender-insurance `[4]` · regulatory `[5]` · seasonal `[2]` · follow-up `[3]` | 28 |
| 10 | **onboarding** | agreement `[4]` · owner-setup `[5]` · property-setup `[7]` · tenancy-assumption `[5]` · offboarding `[5]` | 26 |
| | **Total** | **62 systems** | **297** |

---

## 6. The grammar library (24 grammars)

Each grammar is a procedure shape; the "binds" column shows the systems whose leaves
parameterize it. A leaf with no grammar is atomic (a single `done`).

| Grammar key | Title | Shape (abbreviated) | Primarily bound by |
|---|---|---|---|
| `vendor-dispatch` | Vendor Dispatch (Work Order) | report → identify → assign-vendor → dispatch → invoice → confirm → pay → post | maintenance.{plumbing,hvac,electrical,appliance,general,exterior} |
| `emergency-response` | Emergency Response | stabilize → dispatch (after-hours) → confirm-safe → follow-up WO | maintenance.triage, compliance.habitability |
| `preventive-maintenance` | Preventive / Recurring Service | schedule → dispatch → verify → log-next | maintenance.preventive, inspections.seasonal |
| `service-request-triage` | Service-Request Triage | receive → classify (system/urgency) → route to a grammar | maintenance.triage (the router) |
| `owner-approval-for-spend` | Owner Approval for Spend | quote → request approval → await → approved/declined | accounting.approvals; inserted into spend grammars |
| `capital-project-bidding` | Capital Project Bidding | scope → solicit bids → owner selects → contract → manage → close | maintenance.exterior (large), turns.make-ready (large) |
| `rent-billing-cycle` | Monthly Rent Cycle | post charges → notify → receive → apply → late-fee | tenancy.billing |
| `collections-ladder` | Collections Ladder | reminder → late notice → pay-or-quit → escalate | tenancy.collections |
| `lease-violation` | Lease Violation / Notice to Comply | document → notice → cure window → verify/escalate | tenancy.violations, compliance.notices |
| `eviction-legal` | Eviction (Unlawful Detainer) | notice → file → hearing → judgment → writ/lockout | tenancy.eviction, compliance.eviction |
| `lease-renewal` | Lease Renewal | market → offer → negotiate → execute | renewals.{renewal-offers,negotiation,execution} |
| `non-renewal-notice` | Non-Renewal / Notice to Vacate | decide → serve notice → confirm → hand to turn | renewals.non-renewal, turns.notice |
| `vacancy-marketing` | Vacancy Marketing | price → list → syndicate → show → weekly price-drop | leasing.{pricing,listing,showings} |
| `application-screening` | Application Screening | receive → screen → decide → (approve / adverse-action) | leasing.applications |
| `lease-execution` | Lease Execution | prepare → sign → countersign → distribute | leasing.lease-execution, renewals.execution |
| `move-in` | Move-In | schedule → collect funds → inspect → keys/access → activate | move-in.* , leasing.move-in |
| `make-ready-turn` | Make-Ready Turn | scope → bid → schedule trades → QC → rent-ready | turns.make-ready, turns.charges |
| `move-out-reconcile` | Move-Out Deposit Reconciliation | inspect → itemize → statutory statement → refund/charge | turns.{inspection,deposit,charges} |
| `routine-inspection` | Routine Inspection | schedule → conduct → report → file → follow-up | inspections.{interior,exterior,annual}, move-in.inspection, turns.inspection |
| `insurance-claim` | Insurance Claim | document loss → file → adjuster → repair → settle | inspections.lender-insurance, maintenance (loss events) |
| `utility-transfer` | Utility Transfer | request → confirm → activate/deactivate (direction param) | move-in.utilities |
| `owner-onboarding` | Owner & Property Onboarding | agreement → owner setup → property setup → assume tenancies | onboarding.{agreement,owner-setup,property-setup,tenancy-assumption} |
| `monthly-owner-close` | Monthly Owner Close | reconcile → statement → distribute → reserve | accounting.{draws,reserves,owner-lifecycle} |
| `owner-offboarding` | Owner Offboarding | notice → final statement → funds/deposits transfer → records handoff | onboarding.offboarding, accounting.owner-lifecycle |

---

## 7. Conventions summary

- **Key format.** Dotted, `domain.system.leaf`, lowercase-kebab. Keys are stable and **never
  renamed** once events reference them (a rename silently breaks the step-state fold and any
  relay). Add new leaves; never rebase old keys.
- **Facets are additive.** `domain` / `system` are optional; an un-faceted row still resolves
  by key and simply does not appear in the tree. This is how a setting can load rows before it
  has faceted them.
- **Atomic vs flowed.** A leaf with `completes` opens a cascade; a leaf without it is a single
  typed `done`. Most `communications` and `bill-pay` posting leaves are atomic by design.
- **Every reading folds from records.** Domains, systems, the tree, the title of a key, the
  grammar a leaf binds — all computed fresh from the loaded rows, never stored.
- **This is a factory asset.** Treat the contents as working fluid: a general, realistic
  reference alphabet, not any firm's curated truth. A firm's real rows arrive at the gate.


---

## Coherence review (cross-domain notes from the synthesis pass)

- move-in exists at two levels at once: leasing.move-in[4] (a system) AND move-in as a top-level domain[26]. This is the sharpest structural collision in the library. A dotted key like leasing.move-in.* competes with move-in.inspection.* for the same concept, and a reader/agent cannot tell which owns move-in funds, inspection, or access. Resolve by making leasing.move-in a pointer/relay into the move-in domain, or by demoting the move-in domain into leasing/turns; do not keep both.
- eviction is duplicated across tenancy.eviction[5] and compliance.eviction[5], with identical leaf counts. Eviction is simultaneously an operational process (tenancy) and a legal/regulatory one (compliance), but two parallel five-leaf systems will produce two competing sets of keys for the same real events. Pick one home (tenancy for the operational case, driven by the eviction-legal grammar) and let compliance reference it, or make compliance.eviction a thin overlay of statutory-deadline leaves only.
- trust accounting is split-brained: accounting.trust[5] (operational trust ledger) vs compliance.trust-accounting[6] (regulatory trust compliance). The boundary is real (bookkeeping vs audit/reg) but undocumented, so leaves will drift and duplicate (three-day reconciliation, commingling checks, escheatment could land in either). Define the seam explicitly: accounting.trust = money movement/reconciliation; compliance.trust-accounting = audit, reporting, and statutory-rule adherence only.
- Notices/violations overlap across three domains: tenancy.violations[6], tenancy.communications[7], and compliance.notices[6]. A notice-to-comply is a violation act, a legal notice, and a tenant communication at once. Decide whether compliance.notices owns the legal-form catalog (templates, service, deadlines) while tenancy.violations owns the operational trigger — otherwise the same cure-notice gets three keys.
- Non-renewal is triple-covered: renewals.non-renewal[3], turns.notice[5], and (as a served legal notice) compliance.notices[6]. The lifecycle is real (decide, serve, move-out) but ownership of the notice-to-vacate event is ambiguous. Model it as one non-renewal-notice grammar that begins in renewals and relays into turns, rather than three systems each holding a slice.
- Compliance behaves less like a peer domain and more like a regulatory OVERLAY of five operational domains: its eviction shadows tenancy.eviction, trust-accounting shadows accounting.trust, notices shadows tenancy.violations, habitability shadows maintenance emergencies, and registration shadows onboarding.property-setup. Consider whether compliance should be a cross-cutting facet/flag on operational leaves (a 'statutory' dimension) rather than a parallel tree that re-lists the same work. As-is it is the largest domain (39 leaves) and mostly duplicative.
- compliance.habitability[6] names the regulatory frame, but the actual work (no heat, no water, no cooling, mold, pest) is maintenance and often the emergency-response grammar. The compliance system risks becoming an orphan taxonomy with no execution path unless its leaves relay into maintenance/emergency grammars. Bind compliance.habitability leaves to the same grammars as the corresponding maintenance emergencies.
- Property registration is claimed by both compliance.registration[6] and onboarding.property-setup[7]. Registering a rental (city rental registration, lead certs, smoke/CO) is part of onboarding a property but also an ongoing compliance renewal. Split by cadence: onboarding.property-setup does the first-time registration; compliance.registration owns the recurring renewals — and say so.
- The inspections domain[28] competes with inspection systems embedded elsewhere: move-in.inspection[4], turns.inspection[2], and preventive/seasonal. There are effectively two homes for 'inspect a unit.' The routine-inspection grammar can unify execution, but the taxonomy should state that lifecycle-embedded inspections (move-in, move-out) live with their lifecycle and only regulatory/annual/interior/exterior stand alone in the inspections domain.
- Naming collision on 'exterior' and 'interior': maintenance.exterior[8] means exterior REPAIR while inspections.exterior[5] means exterior INSPECTION; inspections.interior[5] has no maintenance.interior counterpart. The same system word carries opposite verbs across domains. Disambiguate (e.g. inspections.exterior-inspection) or rely strictly on the domain prefix and document that the verb comes from the domain, not the system.
- Grammatical form of domain names is inconsistent: plurals (renewals, turns, inspections), mass nouns (maintenance, leasing, tenancy, accounting, compliance), a gerund (onboarding), and a hyphenated lifecycle stage (move-in). Cosmetic but it affects legibility of dotted keys and any generated UI. Pick one convention (recommend singular/mass nouns) and normalize.
- renewals.execution vs leasing.lease-execution name the same concept (execute a lease) with different words at the system level, while both bind the lease-execution grammar. Align the naming (both 'lease-execution') so the shared grammar's provenance is obvious.
- Several systems are anemically thin and may not earn systemhood: renewals.negotiation[2], renewals.month-to-month[2], turns.inspection[2], turns.deposit[2], inspections.seasonal[2]. Two-leaf systems fragment the tree. Consider folding negotiation into renewal-offers, month-to-month into non-renewal (both renewal outcomes), turns.inspection/turns.deposit into a single move-out-reconcile system, and seasonal into preventive.
- maintenance.triage and maintenance.general are not equipment systems like plumbing/hvac; triage is the cross-cutting ROUTER (the service-request-triage grammar) that selects which other grammar runs, and general is the catch-all overflow. Listing them as siblings of plumbing/hvac is a category error — flag that triage is the domain's front door and general its residual bucket, distinct in kind from the trade systems.
- Utilities appears only as move-in.utilities[3], but a vacant unit during a turn must put utilities back into the OWNER's name, and onboarding a property also transfers utilities. The utility-transfer grammar is bidirectional yet the taxonomy gives it just one home. Gap: turns has no utilities system though vacancy utility transfer is a routine, real task.
- GAP - no vendor management/onboarding anywhere. Vendors are consumed by vendor-dispatch and capital-project-bidding but never onboarded (W-9, certificate of insurance/COI tracking, approved-vendor list, year-end 1099). For third-party PM this is a real recurring function with legal exposure (uninsured vendor liability). It has no domain, system, or grammar.
- GAP - application denial/adverse action. leasing.applications[4] and compliance.fair-housing[5] both touch screening, but the FCRA adverse-action notice sequence on a denial has strict requirements and no clear home. Either application-screening must own the deny branch explicitly or fair-housing must, and the taxonomy should say which.
- GAP - insurance is under-modeled. inspections.lender-insurance[4] and the insurance-claim grammar exist, but there is no home for tracking the owner's policy, master/renters-insurance requirements, or lapse/renewal monitoring - routine compliance work in scattered-site SFR. Consider a compliance.insurance system or an accounting/owner-lifecycle leaf.
- Owner lifecycle is spread across accounting.owner-lifecycle[5], onboarding.owner-setup[5], and onboarding.offboarding[5], bound by three different grammars (owner-onboarding, monthly-owner-close, owner-offboarding). The split is defensible but the boundary between accounting.owner-lifecycle and onboarding.owner-setup/offboarding is unstated and will collect duplicate leaves (banking setup, final statement). Document which system owns the owner ENTITY record vs the owner MONEY flow.
- The deposit lifecycle has no single owner by design and it shows: collected in move-in.funds[5], held in accounting.trust[5], returned/reconciled in turns.deposit[2], with statutory rules in compliance.trust-accounting[6]. This is inherent (different moments in time) but the four homes use four vocabularies (funds/trust/deposit/trust-accounting). Note the deposit as a cross-domain thread and align its leaf vocabulary so it is traceable end to end.
- Tenant vs owner communications are asymmetric: tenancy.communications[7] covers tenant-facing messaging, but owner-facing communications (updates, approval requests, incident notifications) have no communications system and are scattered into accounting.approvals and owner-lifecycle. Either add an owner communications home or state that owner comms ride inside their money/approval grammars.

## Grammar consolidations (recommended)

- MAKE owner-approval-for-spend an INSERTABLE sub-flow, not only a standalone grammar. Owner spend approval is the single most reused fragment: it belongs inside vendor-dispatch (over-threshold WOs), make-ready-turn (turn budgets), capital-project-bidding, and insurance-claim (owner deductible). Rather than duplicating the approval steps in each, formalize it as a composable sub-flow gated by an amount/threshold param, and insert it conditionally. This is the highest-leverage reuse change in the library.
- FORMALIZE grammar chaining (the relay pattern) as first-class so the tenant lifecycle is a CHAIN of small grammars, not one monolith. non-renewal-notice → move-out-reconcile → make-ready-turn → vacancy-marketing → application-screening → lease-execution → move-in should be a relay of terminal-step triggers (as the working-fluid move-out-relay hints at monolithically). This lets each grammar stay small and independently reusable while the whole re-tenanting arc composes from them.
- MERGE emergency-response into vendor-dispatch as a parameterization, or make it explicitly derive from it. Emergency-response shares nearly all of vendor-dispatch's tail (assign → dispatch → invoice → pay → post); the real differences are an urgency=emergency param, an after-hours/stabilize pre-step, and SKIPPING the owner-approval gate. Model those as a param + a conditional pre-step + suppressing the inserted approval sub-flow, rather than a separate hand-maintained shape that will drift.
- RECLASSIFY service-request-triage as a ROUTER meta-grammar, not a completion grammar. Its output is not a done task but a selection of which grammar completes the request (emergency-response vs vendor-dispatch vs preventive-maintenance). Document it as the dispatcher that binds a leaf's grammar at runtime; conceptually every maintenance.triage leaf's real completion is the grammar triage chooses.
- SPLIT a regulatory-inspection (or compliance-inspection) grammar out of routine-inspection. City/Section-8/HQS inspections carry a pass/fail outcome, a cure-and-reinspect loop, and hard legal deadlines that routine interior/exterior inspections do not. routine-inspection stays schedule→conduct→report→file→follow-up; the regulatory variant adds the fail→cure→reinspect cycle and binds inspections.regulatory and compliance.registration renewals.
- SPLIT owner-onboarding into owner-onboarding (entity, agreement, banking, tax setup — once per owner) and property-onboarding (property setup, registration, initial inspection, tenancy assumption or listing — once per DOOR, repeated). One PM agreement onboards an owner who brings many properties; conflating them forces the whole heavy flow to re-run per door. onboarding.property-setup[7] is large enough to warrant its own grammar.
- ADD a vendor-onboarding / vendor-compliance grammar (currently missing entirely). Onboard a vendor: W-9 → COI/insurance verification → approved-list add → periodic COI-expiry re-check → year-end 1099. vendor-dispatch and capital-project-bidding assume an approved insured vendor exists but nothing creates or maintains one. This is a real recurring liability-bearing gap.
- ADD (or fold into application-screening) an adverse-action grammar. On a screening denial, the FCRA adverse-action sequence (notice → disclosure of reporting agency → dispute window) is legally mandatory and has a distinct shape from approval. Make application-screening branch approve→lease-execution vs deny→adverse-action, either as an internal branch or a small dedicated grammar.
- CLARIFY capital-project-bidding vs owner-approval-for-spend as a superset relationship. capital-project-bidding = the multi-bid RFQ front (scope → solicit ≥3 bids → owner selects) followed by the same approval + managed-work + close tail. Rather than two unrelated grammars, define capital-project-bidding as bidding-front + owner-approval sub-flow + a managed vendor-dispatch tail, so the shared spend/approval machinery is not re-implemented.
- PARAMETERIZE utility-transfer by direction rather than authoring separate move-in vs move-out variants. One grammar with direction ∈ {to-tenant, to-owner, to-new-owner} covers move-in activation, vacancy transfer during a turn, and onboarding/offboarding transfers. This also fixes the coherence gap that turns has no utilities home — the same grammar binds there.
- MERGE the two lease-execution surfaces onto one shared grammar and reuse it from both new-lease and renewal paths. lease-execution and renewals.execution both prepare→sign→countersign→distribute a lease; there should be exactly one grammar, invoked as the terminal step of both vacancy-marketing→application-screening (new) and lease-renewal (renewal). Avoid a renewal-specific copy.
- CONSIDER unifying the renewal decision front: lease-renewal and non-renewal-notice share an identical opening (market-analysis → decision) and only diverge at the outcome (renew→execute vs non-renew→turn). Model a shared renewal-decision front that branches into the two tails, so the market-analysis/offer machinery is authored once. renewals.negotiation and renewals.month-to-month collapse into this as branch parameters rather than separate grammars.
- CONFIRM the atomic (grammar-less) set explicitly rather than by omission. tenancy.communications[7] and much of accounting.bill-pay and rent posting are single-touch and correctly carry NO completes. State this in the library so a loader does not invent grammars for one-touch leaves — 'no grammar' is a deliberate design choice (atomic done), and roughly a third of leaves should be atomic to keep the grammar count near two dozen.
- FACTOR a shared owner statement + disbursement money-tail sub-flow. The trust/distribution/statement machinery recurs in monthly-owner-close, owner-offboarding (final statement), and the money steps inside move-out-reconcile (deposit disbursement). Extract those statement+disbursement steps into one sub-flow bound to the money-circuit calendar window (as the working-fluid relay already time-boxes owner-reserve and pay-vendor), and reuse it across all three.
