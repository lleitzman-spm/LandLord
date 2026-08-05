# The Kingdom — Canon

*Ratified 2026-07-17. This document is the constitution of LandLord. The app implements this
model; when the app and this document disagree, this document wins until amended.*

*The product is **LandLord** — the
kingdom, under the trade name that says what the kingdom does: the lord of the land. The
kingdom's own vocabulary (the court, the Crown, the Marches) is untouched.*

*The name is spelled **LandLord** — one word, two capitals (the lord *of the land*); never
"Landlord" or "Land Lord". The inner capital is load-bearing and stands everywhere the name
is written (ratified 2026-07-20).*

LandLord is an instrument panel disguised as an org chart. It models the company as a
medieval kingdom not for flavor, but because feudal vocabulary carries exactly the distinctions a
small company needs and modern org-chart vocabulary hides: who *holds* a domain versus who merely
*works* it, what was *deliberately granted* versus what *silently accumulated*, and who belongs to
the royal line of management versus the local line of trade.

## Design laws

1. **Plain English medieval terms.** Every title must be a word a person recognizes without a
   glossary (*mayor*, not *reeve*; *keeper*, not *castellan* — ruled 2026-07-17). Flavor never
   beats clarity.
2. **Raw data in, structure out.** Edwin drops unstructured facts; the system structures them. A
   contradiction is a missing fact to be hunted, never a rule violation to be scolded.
3. **Lordlessness is a reading on the gauge, not an error.** The fief exists whether or not it has
   a lord. An empty seat is data.
4. **Deliberate acts, recorded.** Authority exists only through recorded acts — grants and
   appointments. The difference between a lord who *rules* several fiefs and a regent *buried*
   under them is whether the holding was ever chosen on paper.
5. **The system hunts delegation debt.** Any time someone is doing a job they should be
   delegating, the board says so. This is the instrument the whole panel exists to serve.
6. **Actions stand beside their information.** *(Ratified 2026-07-17.)* Anything on screen
   that names a thing is a road to that thing — a person's name opens their page, a territory's
   name opens its page — and undoing or continuing a recorded act is offered right where the
   record is shown.

## The two lines

- **The line of rule** — the management chain. Delegation authority flows through it: King →
  Regent → fief lords → their vassals. Holding a *fief* places you on this line.
- **The line of trade** — local mastery. A *mayor* runs a hamlet because they are trusted and
  expert there, not because they outrank anyone. Holding a hamlet does **not** place you on the
  management ladder.

One person can sit on both lines at once (Mabel: vassal under Alys in Property Management
*and* mayor of Maintenance). Two hats, no org-chart lie.

## Pledges (the kinds of people)

| Pledge | Meaning |
|---|---|
| **King** | The sovereign. The kingdom is his. |
| **Regent** | Administers the kingdom for the King. Also the catch-basin: every undelegated fief lands on the Regent's desk (see *In stewardship*). |
| **Vassal** | An internal subject. Eligible to hold fiefs and hamlets by grant. |
| **Squire** | Pledged to a *person*, not a fief. Pre-hire; in training; travels with their knight. |
| **Artisan** | External — contractor, vendor, outside counsel, of an outside GUILD. Works the land, can even run it (keeper), but can never *hold* it, and may never head a Crown office. Fiefs are for subjects. *(Stored as `pledge: 'sellsword'` — the value stays put, because renaming a stored value is a vault migration on every document. The word a human reads is ARTISAN.)* |

## Territories

*Amended 2026-07-27 by the REFOUNDING (`docs/WRIT-THE-BROKERAGE.md`), which this section had
not caught up with until 2026-07-29. A fief is no longer a department.*

- **Fief** — a group's **BOOK OF DOORS**: the portfolio a lord leads, knights pledge to, and
  squires are seated in. Fiefs exist independent of who holds them (law 3). At the founding
  **no fief stands** — the land is dealt by a muster.
- **Office** (a **CROWN OFFICE**) — the household's own craft, seated in the palace and headed
  by a **CHANCELLOR**. There are three: the **Office of Works**, the **Office of Tenancy**, and
  the **Chancery**. **An office is never land.** It has no geometry, it never appears on the
  map, it cannot be folded into a fief or raised to one, and an outside artisan may never keep
  it. A Chancellor's seat is a lord-role grant *on an office* — the third sense of that stored
  role, and the one that has caused two shipped bugs by being read as land.
- **Hamlet** — a sub-territory inside a fief with local leadership: a **mayor** (line of trade).
  The mayor answers to the fief's lord. A mayor is never a Chancellor.
- **Guild** — an OUTSIDE trade (roofers, lenders, counsel). The Crown does not staff a guild and
  cannot "man" one; its hands are **artisans**.
- **Garrison** — artisans stationed in a territory. Not a territory type so much as a
  condition: worked land without local leadership.

**Graduation path:** a garrison becomes a hamlet when it gets a mayor; a hamlet becomes a fief
when the kingdom grows enough to need it sovereign. **A Crown office walks neither way.**

**The board is drawn FLAT — 2D illustration, definitively (ratified — Edwin, 2026-07-28).** *"Yes we
are definitively choosing 2D."* The realm map is authored art composited in the browser. It is not a
live 3D scene, and it is not a photographic render of a modelled table either — that second one was
tried this session and lost a head-to-head.

Why it won, on the evidence rather than on taste. Two blind critics were shown each frame with no
brief and no idea which was preferred:

- **On reading the data, flat won outright.** Told nothing, the critic sorted the doors into three
  correct classes — *occupied, vacant/derelict, boarded up* — got the boarded count exactly right
  (11 of 11) and the bare count within a few, and said in terms: "the variation is not decorative."
  Given the rendered frame, the same test failed — bare and vacant did not register as classes at
  all, and the variation was dismissed as decorative.
- **On craft, flat did NOT win — it was called "procedurally assembled".** That verdict stands as
  the work list, not as a reason to reconsider: every fault it named is AUTHORED, and an authored
  fault is edited and re-checked in seconds. The same faults inside a renderer cost ninety seconds a
  try and were never converging.

The standing consequence: **the map's craft is a design problem, not a rendering problem.** Reach for
light, scale and hierarchy as decisions to be drawn, never as things to be simulated harder.

**The land itself is INVENTED (ratified — Edwin, 2026-07-28).** The realm the war table draws is a
fantasy realm, not a real county. It was briefly real ground — a baked survey of real ground —
and that is retired: *"let's get rid of it needing to be literal the realm's seat and just replace with
fantasy realm, maybe we make it a real world map later."*

The law that follows from it, because this is the one thing invented ground can break:
**generated land may never be presented as a finding.** The doors carry the data; the ground is
scenery. A gap, a cluster or a coverage wash drawn on invented terrain says nothing true about
drive time, vendor radius or concentration risk, and no surface may imply otherwise. When a real
map returns, it returns behind the same `Relief` interface the invented realm satisfies — the
swap is a source, not a rewrite.

## The four states of a fief

A fief is always in exactly one of four states, **computed from the records, never stored**:

1. 🟢 **Lorded** — an internal vassal holds it by explicit grant. Healthy.
2. 🟢 **Held in plurality** — one vassal holds several fiefs, each by explicit grant. Legitimate
   and historically normal. Watched, not flagged.
3. 🟡 **In regency** — no vassal lord; a recorded **keeper** (an artisan formally appointed to
   keep the castle for its absent lord) runs it day-to-day. The kingdom's work gets done, but
   by foreign hands. Amber.
4. 🔴 **In stewardship** — no grant, no appointment, nothing recorded. **By ruling of
   2026-07-17: everything undelegated under the Crown falls to the Regent — not as a holding,
   but as a thing that needs delegating.** The Regent manages what he does not hold, and
   stewardship is by definition temporary. Red. This is the state the system hunts.

The mechanism separating state 2 from state 4 is a deliberate act, recorded (law 4). A grant on
the books is plurality — a choice the system respects. The absence of one is stewardship — a
debt the board displays. Delegation debt is visible as the absence of paperwork.

### The Regent's desk

Every fief in stewardship appears on the Regent's desk as an open item of delegation debt.
Regencies appear beneath them as watch items (a keeper keeps the seat warm, but the seat is
still empty). The desk is the red-flag instrument: its ideal length is zero.

## The records (the deliberate acts)

- **Grant** — places an internal vassal in charge of a territory. Role *lord* for a fief (line
  of rule), *mayor* for a hamlet (line of trade). Dated.
- **Keeper appointment** — formally names an artisan as day-to-day keeper of a territory that
  has no lord. Dated. This is what distinguishes *regency* (amber) from *stewardship* (red):
  Marlowe is appointed keeper of Legal; nobody is appointed over Technology.
- **Garrison posting** — stations an artisan in a territory as workforce. Not authority.
- **Fealty** — records a vassal serving inside a fief under its lord.

### The census comes alive

*Ratified 2026-07-17, same session.* The whole census is now living data. People are
**enrolled** and territories **founded** from the Census page; garrison postings are
**stationed** and fealty **sworn** on the territory pages where they serve; every record
carries its revocation beside it, and a person or territory can be **struck** from the books.
The founding census in code is exactly that — the founding — adopted into the chronicle once,
shelf by shelf as each feature arrived. Striking a person leaves the records that name them in
their books: the readings tolerate the gap, because presence in the book is the only truth and
a dangling record is a fact about the past, not an error in the present. A newly founded fief
opens in stewardship — on the Regent's desk from its first breath, which is the gauge working.

### Life-cycle acts

*Ratified 2026-07-17, same session.* The kingdom's things change kind, in-app:

- **Re-pledge** — a pledge can change: a squire is knighted a vassal, an artisan is hired
  inside the walls (the mission's own arc: foreign hands becoming subjects), a squire's
  knight can change. Records survive the change; the readings recompute around it.
- **Graduation** — the canon's path made real: a hamlet is **promoted** to a sovereign fief
  (it opens in whatever state its records say — usually stewardship, straight onto the desk,
  which is the gauge working), and a fief can be **folded** back inside another as a hamlet.
  Records survive the move. A grant whose role no longer fits the land's kind — a mayor's
  grant on a fief, a lord's grant on a hamlet — is a **stray record**: shown where it lies,
  revocable there, never silently deleted. Fold a fief back and its old mayor's grant makes
  its mayor again; the books remembered.

### The court opens

*Ratified 2026-07-17.* Grants and keeper appointments are made and struck **in the app**,
where the record is shown (law 6): a fief's page offers the grant, the appointment, and the
revocation beside the seat they concern; a person's page offers revocation beside each
holding. The living book of acts resides in the chronicle; the census below is the founding
document, adopted into the chronicle once and never consulted again for the present. Revoking
any act — a founding one included — strikes it from the book, and whatever state that leaves
the fief in is a reading, not an error: revoke a lord's grant and the fief falls honestly back
to regency (if a keeper is on the books) or to the Regent's desk. Grants offer vassals — and
the Regent, though the ruling shows that door deliberately left unwalked. Keeper appointments
offer artisans only: keeping is work, not holding, and fiefs are for subjects. Garrison
postings and fealty stay in the founding census for now.

## The census (as ratified)

*Refounded 2026-07-27 (`docs/WRIT-THE-BROKERAGE.md`). The six-department table this section used
to carry — Property Management with Maintenance beneath it, Leasing, Legal, Technology,
Marketing, each a fief or hamlet — is DISSOLVED. It is kept nowhere but the history below,
because it described a shape the code no longer holds.*

**The Crown** — King: **Harold**. Regent: **Edwin**. Retinue: **Piers** (squire, pledged to Edwin
personally, pre-hire, no fief).

| Crown office | Headed by | State |
|---|---|---|
| **The Office of Works** | Chancellor **Mabel** (lord-role grant on the office) | 🟢 Headed |
| **The Office of Tenancy** | Chancellor **Osric** | 🟢 Headed |
| **The Chancery** | Chancellor **Alys** (law folds in here) | 🟢 Headed |

**No fief stands at the founding.** Land arrives with a muster: a fief is a book of doors, and
until doors are dealt there are none to book. An owner in no knight's care is *delegation debt*,
shown as such and never quietly hidden — the same honest-gauge principle the old Technology row
carried under the 2026-07-17 ruling.

*The live vault may still hold the old six-department shape; that is a MIGRATION question, not a
rename, and it is Edwin's call (see `docs/HANDOFF.md`). The code reads such a vault honestly —
it shows the old realm rather than breaking.*

## Beyond the borders

- **Conquest campaigns** — acquisitions, PMC M&A, lending, investor packets. Run from the
  throne. (Future module.)
- **Foreign kingdoms** — the nine CRM pipelines, each with envoys. Every foreign kingdom has a
  regent under some title; ours is Edwin. (Future module.)
*(A note from the founding, kept because the shape still holds: the modules beyond the
borders are separate silos with separate rules, and reconciling them is a long game. Nothing
about a silo has to be undone later.)*

## The Marches

*Ratified name for the inbox.* The Marches are the border lands: work that has arrived in the
kingdom but has not yet been assigned to any fief. Everything enters through the Marches and
must be ridden out to a territory — or found to be no business of the kingdom's and turned away
at the border.

The Marches follow the same constitutional pattern as fiefs — an arrival's state is computed
from disposition records, never stored:

- **Arrival** — something new logged at the border. Dated.
- **Dispatch** — the deliberate act of riding an arrival out to a territory (fief or hamlet).
  Dated. Dispatched work appears on the receiving territory's page.
- **Turnaway** — the deliberate act of refusing an arrival as no business of the kingdom's.
  Dated. Kept in the record book; the border remembers what it refused.

An arrival with no disposition record is **at the border** — the queue. Its ideal length, like
the Regent's desk, is zero.

A disposition can be **recalled**: the act is struck from the record and the arrival stands at
the border again, ready to be ridden out anew or turned away for good.

### The border scribe

*Ratified 2026-07-17, from use: "Bram and Osgood" / "Two of Sterling's guys".* When something is
logged at the border, the scribe reads the raw text against the census — law 2 made mechanism.
It recognizes census names in the text and says where each serves; it flags name-shaped lists
in the title that the census does not know, and offers to enroll them (artisans by default,
noted as contacts of whoever it recognized); and when the recognized people all point at one
territory, it pre-fills the destination. The scribe only suggests: every reading is computed
fresh from the records, nothing it says is stored, and the Regent edits or confirms at the
border. It is deliberately conservative — a sentence never reads as names; better silent than
wrong.

## The walls

*Ratified 2026-07-17.* LandLord holds a firm's operating records, and increasingly touches real
client context. The standing posture follows from that and not from secrecy for its own sake:

- **A deployment is not reachable until an identity wall stands in front of it.** Wall first,
  route second, deploy third, verify fourth — and the verification is from a *logged-out*
  browser, confirming the wall answers rather than the app. A deploy nobody has seen refuse
  them is a deploy nobody has tested.
- **The Worker verifies the wall's assertions; it never trusts a header.** A proxy header is
  an assertion by whoever last touched the request. With no wall configured the Worker refuses
  its private APIs outright, which is the safe default: no wall means no private API served.
- **The wall is the outer bailey, never the only defence.** Every backend that touches real
  client systems gets its own locked door besides it.
- **Public-facing surfaces are separate silos with separate rules.** Being public is *their*
  specific function; it is never a property something acquires by accident.
- **No credential is ever version-controlled.** Keys reach a deployment through its secret
  store and reach a machine through a gitignored `.env`. The two identifiers that ARE
  version-controlled — the wall's team domain and audience tag — are deliberate: neither mints
  anything, and a verifier silently pointed at the wrong audience is exactly the failure that
  would let another application's tokens through. That must be visible in a diff.

**This repository ships none of it armed.** `wrangler.jsonc` is a disarmed template with no
route and no identifiers, and the application runs fully with no wall, no vault and no key.

## The Treasury

*First minted 2026-07-17.* The kingdom's coin, kept the constitutional way: records in,
readings out. Version one keeps **upkeep** — the recurring monthly cost of the kingdom's
structure: retainers, salaries, subscriptions, dues. Each line names what the coin is for, and
may name the territory that bears it (otherwise it weighs on the Crown) and the person who
receives it.

The reading that matters to the mission: **how much coin flows to artisans.** Foreign hands
are not only a delegation debt — they are a priced one. A fief in regency whose upkeep flows
outward shows, in dollars per month, the cost of its empty seat.

A line can be **struck** from the rolls; as with every record, presence in the book is the only
truth. **Tribute (income) deliberately waits:** revenue lives near client systems (AppFolio),
and the walls ruling requires those gates be opened on purpose, with their own locks.

### The economy — the two treasuries

*Ratified 2026-07-20 (Edwin). A pillar, not a detour: the operating model already moves money at
every step — a work order carries an estimate, an invoice, a payment; a lease carries rent; a
renewal an increase; a seat a salary — so the money is the same records-in-readings-out law
applied to coin. The goal is to **name everything in the ecosystem that costs or produces
income** and let the ledgers fold from the events, exactly as the work does.*

The kingdom keeps its books in **two treasuries**, because a property manager does — and they
must never be confused:

- **The estates in trust (the AppFolio dimension).** The rents, deposits, work-order costs, and
  owner draws of the **Patrons' estates** are the Patrons' coin, not the Crown's — the Crown
  merely holds and moves it, in trust, per estate and per door. This is fiduciary money: a
  new book of **estate ledgers**, the operating/property accounting the Accounting PM lives in.
- **The Crown's own coin (the QuickBooks dimension).** The company's *own* money — the fees it
  **earns** for keeping the estates (tribute), against its **upkeep** (salaries, retainers,
  subscriptions). This is the **Treasury** already minted here, and it is the money that decides
  whether **the kingdom falls** (the consequence engine's coffers). The CPA's books.
- **The bridge is tribute.** Management fees, markups, and leasing fees flow *out of* the estates'
  coin and *into* the Crown's Treasury — the one place the two dimensions meet. Model the bridge
  explicitly; it is where the operating world becomes the company's revenue.

The discipline stays the factory's: **LandLord builds the general economy component** — a chart
of what-costs-and-what-earns, the money dimension on events, the two ledgers and their bridge,
the readings (coffers, P&L, an owner statement, a budget-vs-actual) — and a **factory setting
loads the real figures** (a firm's rents, WO estimates, invoices, salaries) at the data gate.
Real financial data is gated per the walls ruling; the *model* is built and researched now, the
*numbers* wait. **The two reporting dimensions — AppFolio's trust/property accounting and the
CPA's QuickBooks corporate books — are a deliberate research objective** (how each models the
money, and how a PM firm bridges them), so the component fits both without hardwiring either.

*Immediate consequence:* the coffers have **no teeth** until the Crown's upkeep is loaded (today
it is $0, so tribute never runs red). Loading real upkeep (or a working-fluid stand-in) is the
first small step of this pillar and makes the consequence engine's fail state reachable.

**The economy, built — swing one, the domain core (2026-07-20).** The research's §6 data model
(written for a relational `ops` schema) is **re-expressed in the kingdom's idiom** —
records-in, readings-out, events-only — per `docs/WRIT-ECONOMY.md`. The one translation: §6 stores a
double-entry *postings* table; the kingdom stores only the money **event** (`chronicle.money`, an
append-only stream) and the static **chart** (`chronicle.economy`, a loadable book like the catalog),
and **folds** the balanced postings from a pure catalog (`postingsFor`) on every read. So the ledger can
never drift from the events, and a correction is a reversing event, never an edit. `src/domain/economy.ts`
holds the two-book chart (trust + corporate, working-fluid founding), the fee helper, the posting
catalog, and the four readings — **solvency** (the three-way trust reconciliation, live), the corporate
**P&L**, the **owner statement**, and the **bridge** self-check (Due-to-Mgmt ≡ Due-from-Trust). Proven
at the reading level against the invariants (every book balances; the bridge ties; the trust identity
`variance ≡ AP − AR` holds, and is 0 for a cash-complete book; deposits stay a liability; no commingling
by construction). Additive — the existing `Treasury`/`readCoffers` (the War Game's simplified
tribute-vs-upkeep fail state) is untouched and still live; the two reconcile in a later swing. The chart,
fee rules, and figures are demo data; a deployment's own load through the tenant setting.

**The Counting-house — swing two, the surface (2026-07-21).** The money-dimension made visible and
writable. Store act `economy.record(event)` appends a money event (append-only; a correction is a
reversing event, a mis-record is struck) — `wg`-marked while a game stands (money has no `caseId`, so a
`wg` field carries the mark), so **Reset strikes exactly the game's money** and hand-recorded money
stands. A new War Table panel — the **🏦 Counting-house** — renders the four readings live: the trust
**solvency** (reconciled/variance), the corporate **runway** and **P&L**, an **owner statement**, and
the **bridge** self-check, plus the two books' trial balance side by side. A "deal a sample month"
act (working-fluid, `wg`-marked) fills the readings for the demo. Browser-verified: sample dealt →
solvency reads balanced, bridge ties, P&L and owner statement render; record + strike work; Reset
strikes the sample; 0px overflow at 390px, 0 console errors. Additive — only the economy surface + store
act; the operating spine (rent on leases, bills on work orders, the fee bridge dealt by the generator)
and folding the old upkeep into the corporate book are swing three.

**The operating spine — swing three, coin dealt from the sim (2026-07-21).** The coffers now move as the
operation runs, not only by a hand-dealt sample. `wargame.ts` `dealMoney` deals a month of coin from the
SAME occupied doors the work is dealt from — the deposit held, the month's rent charged and received,
the management fee earned on it, and on a share of doors a vendor bill + pay + the firm's coordination
markup; then the earned fees are mostly swept to the company bank, the owners drawn most of their net,
and the **Crown's household upkeep folded into the corporate book as expense** — so the Counting-house's
corporate runway reads **fees against upkeep**, the real fail state, on the deployed operation. Every
money event `wg`-marked (a redeploy of a seed that already dealt its money keeps the first deal; Reset
strikes it). Both `generateWarGame` and `generateGrandMuster` deal it; the store appends `game.money` on
deploy. Browser-verified on a ~190-door deploy: 954 money events, both books balance, the bridge ties,
solvency reconciles clean, and the corporate P&L reads **~$24.7k fees − $18.2k upkeep = +$6.5k/mo** (the
fail state reachable); Reset strikes every dealt event. The old `Treasury`/`readCoffers` (the ribbon's
tribute-vs-upkeep teeth) still stands beside it, now showing the same picture; retiring it so the
corporate coffers is the ONE reading is a clean follow-on (the consequence engine's fail state reads it
today, so it was left untouched this swing).

**Compliance as invariants — swing four (2026-07-21).** Trust accounting's guardrails are checked live
from the postings, not noticed once a month (§6.7): `readCompliance(economy, money, now)` folds five
checks — the **aggregate-liability identity** (the bank reconciles), **no trust bank overdrawn**, **no
owner overdrawn** (spending more on a door than its owner holds in trust is using another owner's money —
the commingling failure in its commonest form), **deposits held whole** (a liability never swept), and
**earned fees swept in time** (flagged past the state's `EARNED_FEE_LIMIT_DAYS`, 25). The Counting-house
renders them as a live compliance card (✓ / ⚠) with a flag count in the stats. Browser-verified: a
deployed operation reads all-clear; forcing an owner-draw beyond an owner's net raises the owner-overdraw
AND trust-overdraw flags at once; striking it clears them. Most checks hold by construction (the posting
catalog cannot commingle), so the reading's value is catching what enters at the *data* level — a bad
hand-recorded event, or fees aging as the clock advances.

**The coffers unified — swing five (2026-07-21).** There is now ONE coffers reading. `readCoffers` no
longer carries a hardcoded tribute rate and a separate upkeep book: its **tribute per retained door**
is the management fee from the economy's own fee rule (a setting tunes it), and its **upkeep** is the
corporate book's monthly expense (the household folded in on deploy) — the SAME numbers the
Counting-house shows. The **retained-door dynamic is preserved** (tribute still falls as Patrons
withdraw), so the consequence engine's fail state is untouched in behavior: browser-verified that a
neglected operation still **drowns** (nine weeks of neglect ran +$5,560 → −$320, `fallen`), and the
Counting-house coffers now reads the exact same trend as the ribbon gauge, the Throne, and the old Coin
panel. `readRealm` gained `economy`/`money` params to feed it; the numbers are unchanged at the founding
(TRIBUTE_PER_DOOR was already 8% × RENT_PER_DOOR), only the source is now the model. *(A bug caught in
review: the Counting-house first formatted the dollar-valued coffers with the cents formatter — fixed to
`coin()` before ship.)*

**Budget vs actual — the economy tail (2026-07-21).** The last of the four §6.5 readings.
`readBudgetVsActual(economy, money)` measures each budgeted account's planned monthly amount against
the actual folded from the money log, returning the signed variance; `EconomyBook` gained an optional
`budget: BudgetLine[]` (a working-fluid founding plan for the Crown's book — fees, markup, payroll,
software, overhead), normalized tolerantly for chronicles predating it. The Counting-house renders a
**Budget vs actual** card, each line colored by the reading that matters (income above plan good,
expense below plan good). Browser-verified on a deploy: fees +$80 of plan, payroll −$400 (under),
overhead +$200 (over) — all five lines correct. With this the economy pillar's general model is
**complete**: two books, the fee bridge, the four readings (solvency, P&L, owner statement,
budget-vs-actual), live compliance, and one unified coffers — all events-only, working fluid. Only the
**real-figure backfill** (real figures at the gate) remains, and it is the Regent's deliberate call.

**Field synthesis — the model checked against live trust accounting (2026-07-21).** A reconciliation against a working trust-accounting system
(`/workspace/operating-model-project`, read-only) **validated** the two-book/fee-bridge/deposit-as-liability/
per-property-fee structure, and the model absorbed its leash-safe kinds (general/working-fluid — a firm's
real *figures* still load at the gate): owner-side `pet_rent` + `utility_reimbursement`, the move-out
reserve (`moveout_reserve_withheld` → `moveout_reserve_held`), the firm-retained ancillary revenues
(`nsf_fee`/`admin_fee`/`reletting_fee`/`ancillary_fee`), and the **owner-approval spend gate**
(`spendApprovalCents` + `needsOwnerApproval` — the "$400 cap" / the grammars' "NTE {amount}": a repair
at/above it needs owner approval before the vendor proceeds; the vendor-dispatch flow reads it). Done as
**Lane A** of a two-session split (`docs/PARALLEL-SESSIONS.md`); Lane B maps the WO taxonomy + the five
workflows onto the catalog/flows.

**The spend gate wired into the flow (2026-07-21).** The gate stopped being merely visible and became a
reading the clerks take AT the vendor-dispatch commitment step. `spendGate(economy, estimateCents)` is
the legible decision over `needsOwnerApproval` — cap, estimate, disposition
(`within-authority` | `needs-owner-approval` | `ungated`), and a plain NTE-voice note;
`estimateSpendCents(urgency)` is a working-fluid repair estimate by band (routine $250 · urgent $600 ·
emergency $1,500 · unclassified defaults to the cap), a sibling of `sampleLedger` — a setting loads real
per-trade estimates at the gate. Both fleet clerks now read it where a vendor and owner money are
committed (`assign-vendor`/`approve-spend`, the step canon already names): the intake clerk (Mabel) and
the general advance clerk each fold the WO's `{urgency}` → estimate → gate into their `proposed` note, so
the Ledger shows "$X estimate over/under the $400 NTE cap — the owner's approval is required / within the
clerk's authority." The founding flow's **step order is untouched** (the swing-4 operator stops at index
2); the gate is a *reading on the proposal*, not a reordering. The human's Approve/Override ratchet is
unchanged — the gate makes plain, at the decision point, which proposals the Regent cannot rubber-stamp.

### The chronicle

The kingdom's mutable record books — the Marches ledger and the Treasury rolls — bind into one
volume, the **chronicle**, stored as `data/chronicle.json` in the private repo. Git is the
courier between machines; no public surface exists. A private, authed backend may one day
replace the courier — the domain will not notice.

### The vault

*Dug 2026-07-17.* That day came. The chronicle's master copy now rests in a **Supabase
Postgres** (us-east-2,
paid plan since 2026-07-22) behind its own locked door, per the
walls ruling: row security is enabled with **no policies**, so the public keys open nothing —
only the secret key passes, and it lives in `.env` on kingdom machines, never in git and never
in the browser. The dev server is the sole keyholder; the app still speaks only to
`/api/chronicle`, and the domain did not notice.

The vault keeps two books: the current document (`chronicle`) and an append-only history
(`chronicle_history`) that records every write, as git history once did. The repo file remains
the backup ledger and the courier of last resort — with no key present, everything works
exactly as before the vault was dug. Setup per machine: copy `.env.example` to `.env`, paste
the secret key from the Supabase dashboard (Project Settings → API Keys → secret).

### The border book

*Bound 2026-07-18.* The vault keeps a third book: `border_arrivals`, the **only door an
outside producer will ever write through**. The chronicle doc is a whole-document write, last
writer wins — a foreign hand writing it directly would clobber the record, so none may. A
producer drops arrival rows at the border instead. The keyholder alone reconciles them: on
every read it folds unabsorbed rows into the doc's arrivals — so they stand at the border like
any other arrival, and the border scribe reads them against the census — and the moment a
written doc carries a row, that row is marked absorbed and retires from the fold. Everything
is keyed by id, so the fold is idempotent and a failed absorb is only a free retry. The book
stands behind the same lock as the rest of the vault (row security, no policies) and stands
empty: **no producer is appointed yet** — that choice is the Regent's, made deliberately,
behind its own locked door per the walls ruling.

## The living instrument — the operating model, the factory, and the event log

*Ratified 2026-07-19.* LandLord began as an instrument panel over the **org** — who holds
what, where the delegation debt sits. The next magnitude turns it into a living instrument over
the **real work**: the task substrate goes subterranean (people and agents do the tasks), an
**event log** records what was done and when, and the throne room sits on top — outcomes and
state, one drill-click down to the stuck task beneath. Instrumenting the real work is not a
detour from LandLord; it is its foundation.

### The factory and the setting

LandLord is the **factory** — the general components and functions of an operating instrument
for property management. A specific firm's operating model is a **factory setting**: its chart
of accounts, its fee terms, its catalog of task types, its flow templates, its seats. The two
are deliberately separate, and the separation is the product.

The discipline this imposes — **build general components; keep every firm-specific thing as a
shape that LOADS IN, never as code that hardwires it.** The test of a component is blunt: *can
a firm's concrete shape be assembled from it without cutting new code?* If not, the part
is under-powered. If it carries knobs no firm ever turns, it is over-built.

The demo tenant this repository ships is one such setting, and a fictional one. It exists so a
fresh clone has something to operate; it is not a template of how a firm should be organised,
and none of its figures are anybody's terms.

### Events-only (the record, extended)

*Ratified 2026-07-19.* The law that **state is computed from records, never stored** now
reaches the operating model: the sole record is an **append-only event log**. A work item, a
queue, who-holds-the-ball, aging, a KPI — all are **readings folded from the events**, never
stored state. History is perishable (a snapshot loses cadence and cycle-time forever), so the
log captures **live from day one, even thin**. Should real volume ever make folding slow, the
answer is a **materialized reading-snapshot** — a cache of readings, never a second source of
truth.

### What the operating model demands of the design

Four consequences fall out of modelling real property-management work, and each one shaped a
part of the instrument:

- **The catalog is the event taxonomy.** A firm's task catalog is a ready-made tag set; the
  event schema is designed so every event references a catalog row. Inherit the ontology rather
  than inventing a parallel one. LandLord provides the loadable **catalog** mechanism; a
  setting's rows are one instance.
- **Queues and ageing are first-class.** Work is routed by *who has the ball* and lives in
  **stocks** — backlogs, delinquency buckets, pipelines. This is the **Regent's desk
  generalised**: from "territories with no lord" to "what is ageing on whose desk". The
  delegation-debt engine, pointed at real work.
- **The drill-path is the product.** Outcomes and KPIs on top → one click to the queue → one
  click to the stuck task. Build the readings for that traversal.
- **Build to receive a firm's own rhythms.** Renewal cadences that begin months out, a money
  circuit with statement days, distribution days, release days and a freeze window. Model to
  consume these; a setting names the actual days.

### The clerk — an agent for every seat

*Ratified 2026-07-19.* Every archetype gets an **agent** that works its incoming queue as far
as it can and stops at the judgment moments for a human click — augment each human, never
eliminate (the human-in-the-loop pattern). This is a factory **component** — the
per-seat clerk — of which the K3 builder (`harness/`, `AGENTS.md`) is the first sibling: same
machinery, a loop, tools, a brain, a leash. a setting's shape says which seats get a clerk and what
each does. The event log carries the human-in-the-loop states as first-class event kinds —
**proposed → awaiting → approved / overridden** — so the clerk's work and the human's
ratification are just more readings folded from the log. The clerk layer stands on the
event-log / queue / catalog substrate; it is built once that floor exists, not before.

### The throne — the King's seat (the game's top-down view)

*Ratified 2026-07-19 (the War Game becomes a real game), first room built 2026-07-20.* The
War Game is not a data sampler but a **game with an objective**, and the objective is the
kingdom's founding one made whole: **clear the delegation debt on a live, flowing operation.**
The **King's seat (the Throne)** is where that game is seen from the top — the sovereign's
single screen over the whole realm, fusing the two halves of the instrument that were built
apart:

- the **org's** delegation debt (laws 4–5): a fief with no lord, the Regent's-desk reading;
  and
- the **work's** delegation debt (the operator): an open box on no real seat — an unowned
  queue (`pm-desk`) or unassigned work — folded from the event log.

They are one debt at two altitudes: a seat with no holder, and a box with no seat. The Throne
sums them into a single number the King drives to zero, reads it against the effective clock
(game time under a War Game), and — law 6 — makes every reading a road to the act: a fief opens
its page to be lorded, a queue opens the Ledger to be handed on. This is the top of the
ratified sequence; the seats are then made real one at a time (the King's first), agents stand
in for the seats not yet driven by hand, and only once a seat has been sat by a human do agents
return beneath it as the automation layer.

### The task-language — the catalog grows a tree

*Ratified 2026-07-20 (Edwin). Staged for a K3 build: `docs/WRIT-TASK-LANGUAGE.md`.* A task is not
an atomic "complete" click; it is a **word in a bounded, compositional language, and each word
carries the flow that actually completes it.** A work order is *report → identify → assign vendor
→ dispatch → invoice → confirm → pay → post to accounting* — a flow (`flows.ts`), not a checkbox.
Identification is a path down a small tree: ~**8 domains** of PM → a domain's ~**6 systems**
(Maintenance → HVAC, Plumbing, …) → a system's ~**5 leaves** (HVAC → no-cooling, no-heating, …).
`maintenance / hvac / no-cooling` is one word. The alphabet at each level is tiny; the words are
many but bounded — and **the compression is that a few dozen flow *shapes*, parameterized by the
leaf (which trade, what urgency, whose desk), render all the words.** So many letters, a couple
dozen grammars.

This is the catalog's next magnitude, and it holds the leash: the catalog grows **facets**
(domain/system) and a **flow-binding** (a leaf names the flow that completes it), but LandLord
still ships only the **mechanism** and a small **working-fluid** alphabet — **a deployment's own domains, systems, leaves and flow shapes load through its setting.** Two rulings ride with it:
(1) the **lease clutter is the target, not the wallpaper** — a lease in good standing is a
**state, not open work**; it becomes work only when it *emits* a typed task (renewal / delinquency
/ move-out), and modeling it correctly is the disease we exist to cure; (2) the **Regent's seat
is the first seat made real** — the catch-basin becomes an allocation-and-delegation console where
identifying a task down the tree *is* triggering its completion flow onto the right seat, and the
delegation debt is worked to zero by hand.

**Consequences, not a count (ratified 2026-07-20).** The gauge is not "how many undelegated
boxes" but a **living consequence simulation**: an unattended task **festers → escalates into a
crisis → the door's Patron loses faith → the Patron withdraws their doors and their tribute → the
coffers bleed until upkeep drowns them → the kingdom falls.** The Treasury is the health bar
(upkeep on one pan, tribute on the other); the fail state is a reading — the coffers going red —
not an invented number. **Patrons** are the owners themed: those who have entrusted their estates
(their doors) to the Crown's keeping and pay tribute for it; lose a Patron's faith and they recall
their estate. Consequences stay reading-first (severity, faith, withdrawal, the coffers — all
folded from age and inaction against the clock, never stored); the one place the clock *writes* is
a bounded escalation that spawns fresh work as neglect compounds — the rising tide.

**The library is the agents' instruction set (ratified 2026-07-20).** The task-language exists so
that the Regent, buried past what one person can clear (by design — the seat must feel impossible
solo, which is *why* one delegates), can hand work to **agents that actually do the task** — not
seats that fake "done," but clerks (the harness machinery: a loop, a tool-belt, a brain, a leash)
that execute a task-type's real completion flow and stop at the judgment moment for a human's
ratification (`proposed → approved / overridden`). Even in the War Game the *labor* is real though
the *world* is simulated — so an agent may do simulated tasks now, no data gate needed; real data
stays gated. This keeps the ratified sequence: sit the seat by hand first, then prove ONE real
agent doing ONE task-type, then grow the fleet.

### The Regent's seat — the first per-seat console (built 2026-07-20)

*Swing three of the task-language writ, built 2026-07-20.* The Regent's seat is the first seat
made real: the catch-basin (`src/StewardView.tsx`, absorbing the old read-only Regent's Desk)
turned into an operating console that reads the whole tide against the effective clock —
undelegated boxes, untriaged intake, the empty fiefs, the festering work, the Patrons' faith, the
coffers — reusing `readThrone` and the consequence readings, never re-deriving. Two acts are the
escape, and they are the shape every future seat inherits:

- **Identify → put in motion.** Raw intake ("a thing happened at a door," a `work-order` case with
  no leaf) is walked **down the tree** (domain → system → leaf) in the seat; choosing the leaf
  **triggers that leaf's `completes` flow** onto the right seat with the leaf's params — the ticket
  becomes a real cascade, not a tick. The store primitive is `triggerTyped(catalogKey, subject,
  {owner, resolves})`: bound → the cascade (every `{token}` filled so no literal leaks, however
  rich the loaded grammar), unbound → a single typed `opened`; `resolves` retires the raw ticket
  with a `done`. It is **the same primitive an operator agent will call in swing four** — the seat
  and the clerk share one hand.
- **Delegate to escape.** An unowned queue (`pm-desk` …), or a single case, is handed to a real
  seat in one act — `handQueue(fromHolder, toHolder)` / `handCase(caseId, toHolder)`, one `handed`
  event apiece. This is the "clear the ball off my desk" move; in swing four the receiving seat can
  be an agent that actually does the work.

The **carried-forward params-advance seam is closed**: the leaf's letters are recorded on the flow
instance's `opened` event, so advancing a cascade (`completeStep`/`approveStep`/`overrideStep`)
recovers them and renders every later step's trade and urgency — no more literal `{trade}` on step
two. The seat is verified end to end in a real browser (identify an HVAC intake → a live
vendor-dispatch cascade that renders "a HVAC call, emergency priority"; hand `pm-desk` to Mabel →
the undelegated count falls; advance the clock → the tide rises on what was left undelegated). *This
was a Claude build, not a K3 one — design/UI/orchestration on the swing-1/2 substrate, the lane the
profile keeps for Claude (as the King's seat was).*

### The clerk executes — one operator agent, proven (built 2026-07-20)

*Swing four of the task-language writ, built 2026-07-20.* The thesis of the clerk layer — that a
delegation target **does the work rather than fakes it** — is now proven by ONE real operator
agent. It is Mabel's clerk (she holds `identify` in the vendor-dispatch flow), and it runs on the
same `harness/` as the K3 builder, but wearing an **operator's two-tool belt** — read the chronicle,
append events — not the builder's file/shell belt. Its arc, for one aging raw-intake maintenance
ticket on the War Game's **simulated** data:

- **It reads its work off the log** — the most-aged untriaged intake ticket on `pm-desk`.
- **A cheap brain identifies it down the tree** — the complaint → a maintenance leaf whose
  `completes === 'vendor-dispatch'`. This is the task-language *used by a machine* (not K3, not
  Fable: a cheap Kimi, `kimi-k2.7-code-highspeed`, the doctrine's bounded-procedural lane). A
  keyword heuristic stands behind the brain so one stubborn reply never stalls the seat.
- **It advances the REAL flow engine, never a reimplementation.** The crux decision: the agent calls
  the same `instantiateFlow` / `completeStep` / `proposeStep` the app uses (bundled for the harness
  as `src/operator-core.ts` → `dist-operator/operator-core.mjs` by `npm run build:operator`), so the
  app's `readFlows` renders the agent's cascade **identically** to a human's — one source, no drift.
  It triggers the leaf's vendor-dispatch cascade, retires the raw intake (the `resolves` arc), and
  advances the deterministic clerk lane (the report logged, the leaf identified).
- **It STOPS at the first commitment — the judgment — and never crosses it.** At the step where a
  vendor, and owner money, is committed (`assign-vendor` in the founding flow, `approve-spend` in the
  muster's — step 3 in both), it emits **`proposed`** with actor **`agent:mabel`** and parks the
  case **`awaiting`**. The Ledger renders it as "Mabel's clerk" and offers **Approve / Override** on
  the step in hand. **The agent never emits `approved`/`overridden`** — that ratchet is the human's
  alone (the clerk augments, never replaces). The Regent approves and the cascade moves on, or
  overrides (the divergence recorded) and it moves on his terms; both advances are the *human's* act,
  which is the whole point.

Gate-safe (only `wg/<seed>`-marked simulated data; Reset strikes it — no data gate needed) and
events-only (the cascade IS its events; nothing stored). Verified end to end in a real browser:
deploy the grand muster → run `./harness/run.sh operate.mjs` → the WO reads identified and advanced,
a proposal by "Mabel's clerk" sits awaiting; the Regent's **Approve** advances it (an `approved`
event, the cascade moving, persisted live) and **Override** records his divergence and advances it.
*A Claude build (Opus drove/built/reviewed): wiring plus one small brain call — Opus's lane, not a
Fable aesthetic swing, not K3.* The **full clerk fleet** (an agent on every seat) and **autonomous
agents on real data** (behind the deliberate data gate) still follow; this proved the one.

*(A finding that corrects the writ's guess: the temperature-must-be-1 quirk is not k3's alone — the
cheaper kimi reasoners pin it too. So `harness/moonshot.mjs` now omits temperature unless a caller
sets one, and retries pinned to 1 if the model refuses — no caller need know which models are
strict.)*

**Which brain powers which clerk is its own doctrine — `docs/CLERK-BRAIN-DOCTRINE.md`** (the runtime
sibling of the build doctrine, ratified in direction 2026-07-20). A clerk is three separable choices —
where it RUNS, what it THINKS with, and the TOOLS beneath it — and the rule is the cheapest engine that
clears the bar, a fallback for every clerk, and **the data gate deciding where the brain may live**
(hosted is fine on simulated data; real client PII will force local/gated engines). The brain is now a
**named policy** (`harness/brain-doctrine.mjs` `brainFor(seat, taskType)` → `{tier, model, fallback}`),
not a hardcoded string, so the fleet extends one registry line per seat. Mabel's identify clerk is
Tier 1 (cheap Kimi) with a Tier-0 deterministic fallback.

**The clerk fleet — an agent on every seat (built 2026-07-21).** Swing four proved ONE clerk; the fleet
generalizes it. Every clerk is one shape — a seat, a task-type, a brain policy, and a `run` that does
its bounded work through the REAL flow engine and STOPS at a judgment (`proposed` by `agent:<seat>`,
`awaiting` the Regent; no clerk self-approves). Two kinds ship: **the intake clerk** (Mabel's, Tier 1 —
a cheap brain identifies a raw complaint and originates + advances a vendor-dispatch cascade to its first
commitment; swing four, now a roster member), and **the general advance clerk** (Tier 0, a *tool*, no
brain — for ANY seat: it finds live cascades whose step-in-hand sits on its seat and proposes that step,
flow-agnostic across every loaded grammar). `harness/fleet.mjs` runs the roster (intake + an advance
clerk for va-desk, lp-queue, osric, pm-desk) over the sim; `harness/clerks.mjs` holds the clerk
definitions (shared with `operate.mjs`, so swing four and the fleet never drift). Verified on the grand
muster: **24 proposals parked across 5 seats** (mabel/va-desk/lp-queue/osric/pm-desk), spanning
preventive-maintenance, capital-project-bidding, deposit-reconciliation, rent-cycle, owner-close,
vacancy-marketing, screening, inspection, non-renewal, and more — every case `awaiting`, zero `{token}`
leaks, zero self-ratification. The tier split proves the doctrine: the identify judgment takes a brain
(Tier 1), advancing a templated step takes none (Tier 0) — the cheapest engine that clears each seat's
bar. Still ahead: **autonomous clerks on REAL data** (behind the data gate).

**The reasoning vendor clerk — the fleet's first clerk that REASONS at a commitment (built 2026-07-21).**
The advance clerk proposes the *templated* step; the vendor clerk (va-desk, Tier 1) instead picks an
actual artisan from the trade's roster and forms a **price**, then reads the **spend gate against that
reasoned quote** — so the gate bites on a real number, not just the urgency band. Under the NTE cap it
recommends the Regent proceed; over it, it flags that the owner's word is needed. It STILL only proposes
— the human's Approve/Override ratchet is untouched (no clerk self-approves). Tier 1 (a cheap brain,
`va-desk/assign-vendor` in the registry) with a Tier-0 fallback (first-of-roster + the urgency band) so
the seat never stalls; the artisan roster (`harness/vendors.mjs`) is working-fluid — the firm's real
vendor list + rates load there when the data gate opens. In the fleet the vendor clerk runs BEFORE
the va-desk advance clerk (shared `taken` set) so it owns the vendor-dispatch commitments and the advance
clerk only sweeps the deterministic steps. Verified through the real generator + the real engine + a
**live brain** (kimi): a routine furnace service reasoned to $180 (within authority), an emergency burst
pipe to $1,500 by the Pipewright (needs the owner) — the gate agreeing with each reasoned quote; the
Tier-0 fallback covers the seat when the brain is unreachable; no case double-proposed across the roster,
zero `{token}` leaks.

**The price-approval clerk — the settlement side of the loop (built 2026-07-21).** The mirror of the
vendor clerk: where the vendor clerk QUOTES at dispatch, the lp-queue price clerk (Tier 1) CHECKS the
invoice at settlement (`pay-vendor`/`pay` — "Approve against NTE and pay"). It recovers what the vendor
was authorized to bill (the vendor clerk's quote, read back from the case's record), reads the invoice the
world submitted, and **reconciles** them (`reconcileSpend` in `economy.ts`, the settlement sibling of
`spendGate`): the authorized CEILING is the greater of the owner-approved quote and the NTE cap — an
invoice within it is **clear to pay**, one that overruns it is **held for the owner**. The ceiling is a
HARD rail (an over-ceiling invoice is always held, whatever the brain recommends); the brain refines the
within-ceiling judgment. Now the vendor-dispatch loop runs end to end: quote in → (Regent approves) →
invoice checked → pay or hold. Verified through the whole loop on the real engine + a live brain: a burst-
pipe invoice of $2,248 over its $1,500 ceiling was held; a $258 furnace tune-up under its $400 ceiling was
cleared to pay.

**A fold bug found and fixed while closing the loop (2026-07-21).** `readFlow` folded a cascade's progress
by matching each event to a step by holder + in-order position, which **collapsed consecutive same-holder
steps** (va-desk's assign-vendor → dispatch, lp-queue's invoice → pay → post) onto the first of them — so
a vendor-dispatch case worked past dispatch stranded at "next: dispatch" and never folded to its
settlement, making the whole settlement half of the loop unreachable through the reading. The fix: every
flow step event is already stamped `Step n/N` by `handStep`/`answerStep`, and that marker is the
authoritative index (all a case's step events belong to its one template) — so the fold now places each
event by its marker, disambiguating same-holder steps cleanly (a markerless legacy/off-catalog event still
falls back to holder match). A fully-worked cascade still folds to `done`; the fleet still parks its
proposals. Still ahead: promote a seat to Tier 2 only where it visibly needs it; more reasoning seats (a
leasing clerk at `osric`).

### The realm remodeled — pods, knights, guilds, and the land (ratified 2026-07-20)

*Edwin caught the irony: "LandLord" had no **land** in it. The tool modeled the company's
**departments** as the top-level fiefs and the real properties and owners appeared nowhere. Grounded
in the Master Plan (Drive; the decentralized partner model — "equity partners each managing ~500
units with central services"), the metaphor inverts, and all of it is **ratified canon**:*

- **The fief becomes the POD** — the top-level holding. A **knight** (a recruited agent /
  equity-partner) holds a **book of owners (the Patrons) and their doors (the LAND)**. The realm
  **grows by recruiting knights** to hold new pods (~500 doors each, working fluid). This is the land
  the name always promised.
- **The department becomes a GUILD** — a cross-cutting **function** that serves every pod (Property
  Management, Leasing, Maintenance, Accounting, Investor Relations, Legal, Technology). A guild's
  **master** is read from the census's own grants; an **unmanned guild is delegation debt**, exactly
  as an unlorded fief was. The department-fiefs keep their records — a guild is the same truth read
  as a function.
- **Owners (Patrons)** live **inside a pod** — the investor-clients a knight keeps faithful, folded
  from the log as before; an owner in **no** knight's care is the Regent's new **allocation debt**.
  **Doors** are the **land** those owners hold.
- **King = Harold** (the founder), **Regent = Edwin** (the GM, who **places owners into pods, mans the
  guilds, and recruits knights**). The Regent's objective, redefined: **every owner in a knight's
  care, every guild manned, every box of work on a real desk** — drive that debt to zero, and grow.

**Built 2026-07-20 (the domain layer):** `src/domain/guilds.ts` (`readGuilds` — functions with their
masters, unmanned = debt), `pods.ts` (`readPods` / `unplacedOwners` — knights' books of owners + land
+ the **rent** they collect on it, folded from **placement** and **commission** events that are settled like leases and
`wg/<seed>`-marked so Reset strikes them), `realm.ts` (`readRealm` — the redefined debt: unplaced
owners + unmanned guilds + unseated work), store acts `commissionKnight` / `placeOwner`, and the
War Game generator seeding a starting allocation (a couple of knights, a share of owners placed, the
rest unplaced). Reading-first and events-only throughout (the law K3's off-model pass broke and this
build keeps); additive — the old readings and views stand untouched. *This was a **Claude** build:
K3's first pass invented a fictional world (made-up guilds and knights, hard-coded land, stored
consequences) that contradicted the ratified model and the events-only law, so it was discarded — the
model rewards fidelity over invention.*

**The War Table HUD — BUILT (2026-07-20).** The ratified game-HUD reframe, rendered real:
`src/WarTableView.tsx` — a lit parchment realm-board in a dark iron frame (ribbon · command rail ·
board · overlay panels · time control · council feed), the app's **landing view**. Every gauge folds
from `readRealm`; every tile is a pod (a knight's book of owners + land + rent), a guild (a function
with its master, unmanned = debt), or the Regent's catch-basin; every click is a real store act —
place an owner (`placeOwner`), dub a knight (`commissionKnight`), seat a guild-master (`court.grant`),
identify intake (`triggerTyped`), delegate a queue (`handQueue`/`handCase`), drive the clock
(`wargame.*`). Overlay panels enter a pod/guild/seat over the board — no reloads. Additive: the old
views stay reachable via the rail (a "🗺 The War Table" road leads back). *Built by **Claude Fable 5**
(the strongest agentic-coding model — the best-of-both for a task that is aesthetics AND perfect
wiring), orchestrated and reviewed by **Claude Opus**: the spec (mockup + reading API + constitution),
then review of the diff for fidelity + house-fit, then browser verification — deploy the grand muster
→ the board fills with real pods/guilds/owners/land; placing an owner drops the debt, commissioning
raises a pod, advancing raises the tide; desktop + mobile clean, zero console errors.* The three-tier
pattern, with Fable as builder in place of K3 (whose greenfield-aesthetic strength was not the need —
the wiring was).

## Build order

1. ✅ Canon (this document)
2. ✅ Pledge types and the people tree
3. ✅ Territories with the four states
4. ✅ Grant / appointment records
5. ✅ The fief switcher with debt flags (the Regent's desk)
6. ✅ The Marches
7. ✅ The Treasury (upkeep v1, chronicle persistence)
8. ✅ The vault — a live private backend for the chronicle (Supabase, behind its own lock)
9. ✅ The court opens — grants and appointments made and revoked in-app, recorded in the
   chronicle's book of acts
10. ✅ The census comes alive — postings and fealty made in-app; people enrolled, territories
    founded, both strikable; the founding census fully adopted into the chronicle
11. ✅ Life-cycle acts — re-pledging (squires knighted, artisans hired in) and the
    graduation path (hamlet ⇄ fief), with stray records shown and revocable where they lie
12. ✅ The deployed keyholder — the worker serves /api/chronicle against the vault (key via
    `wrangler secret put`) — and the court fitted to a phone
13. ✅ The border scribe — arrivals read against the census: known names placed, new names
    offered for enrollment, destination suggested; the Regent confirms
14. ✅ The border book — the vault's intake table for outside producers, folded into the
    arrivals by the keyholders on read, absorbed once a written doc carries the row; no
    producer touches the chronicle doc, ever
15. ✅ Deploy day — the wall raised over `landlord.example.com`, the route armed, the
    worker deployed and serving the vault behind Cloudflare Access; verified logged-out (the
    wall answers) and logged-in (an arrival typed on the web reached the vault)
16. **The living instrument** (the 2026-07-19 roadmap), in order — each a factory component,
    events-only, exercised on working-fluid data and built to receive a firm's shape through its setting:
    a. The **event-log spine** — an append-only event log (general event, catalog-reference)
       with readings folded from it. The floor everything else stands on.
    b. **Queues & aging** — the Regent's desk generalized to who-has-the-ball and what's
       aging, folded from events.
    c. **The drill-path** — outcomes/KPIs → queue → task traversal, the throne-room surface.
    d. **The catalog** — the task-type taxonomy as a loadable ontology (`src/domain/catalog.ts`):
       a `CatalogRow` carries key · title · class (RUN/ACQ/FIRM) · mode (⚙ auto / ◆ human) · note,
       an event references a row by key, and the tag resolves key → title. A chronicle shelf that
       adopts a small working-fluid founding catalog when missing (the census-migration pattern);
       a factory setting pours in its own rows. LandLord holds the mechanism,
       the setting loads the rows.
    e. **The operator** — the clerk layer and the flow/cascade engine, seen as one machine
       (the Regent's insight, 2026-07-19: a flow is a cascade of steps across seats; a clerk works
       one seat's slice of those flows). Built in swings:
       - *Swing one — the spine (✅ shipped 2026-07-19, K3-built):* the **flow engine**
         (`src/domain/flows.ts`). A flow template is loaded config — a trigger and steps, each
         naming a catalog row, a holder, a timing edge (relative or a calendar window), and a
         board. Triggering opens a case and hands the first step into the event log; the cascade
         folds back from the log (events-only). a 13-step move-out → re-list relay is expressed
         from config alone — no code knows the word "move-out". A `flows` chronicle shelf adopts
         the founding relay the census way.
       - *Swing two — the hands:* the human-in-the-loop arc on the engine (advance a step, propose →
         approve / override, the cascade moves), then the **per-seat clerk agents** — same
         machinery as the K3 builder (a loop, tools, a brain, a leash) working a seat's queue.
17. Still-standing candidates by earlier ruling: tribute (behind deliberate gates), the Marches
    fed from outside (the border book stands; the producer is the Regent's choice, email →
    arrivals the floated candidate).
