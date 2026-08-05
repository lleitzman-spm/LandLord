# Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)

> ## ⚠ SUPERSEDED IN PART — 2026-07-27
>
> **The DEPARTMENTS-AS-GUILDS model this writ describes is retired.** It is kept as the record of
> how the realm was thought about before the refounding, and the org chart in §"the shape" names
> territories the census no longer holds. What now stands, and what to read instead:
>
> - **`docs/WRIT-THE-BROKERAGE.md`** — the ratified model: three CROWN OFFICES in the palace (the
>   Office of Works, the Office of Tenancy, the Chancery), each headed by a CHANCELLOR.
> - A **FIEF** is a group's BOOK OF DOORS, not a department. A **GUILD** is an OUTSIDE trade, and
>   its hands are **ARTISANS**. The Steward is the **REGENT** everywhere a human reads.
> - `docs/KINGDOM.md` → "Territories" and "The census (as ratified)" carry the amended law.
>
> Everything below this line is history. Do not build from it.

*Staged for a K3 summoning (2026-07-20, after Edwin ratified the metaphor reconciliation). This writ
is the **domain-model half** of the "War Table" swing: the knotty structural rebuild that turns the
kingdom's org model right-side up. **K3 builds this half on a branch; Claude (Opus) reviews, finishes
the last mile, and verifies.** The **War Table HUD is a separate Claude effort** and is OUT OF SCOPE
here (see "Out of scope") — this writ produces the MODEL and the READINGS the HUD will render.*

*Read first — the constitution wins: `docs/KINGDOM.md` (esp. "The living instrument", "The
task-language", "The throne — the King's seat"), then `CLAUDE.md`, `AGENTS.md`, `docs/K3-PROFILE.md`
(you). Then the code you remodel: `src/domain/types.ts`, `census.ts`, `court.ts`, `states.ts`,
`throne.ts`, `consequences.ts`, `wargame.ts`, `treasury.ts`, `events.ts`, `catalog.ts`, `flows.ts`,
and the store `src/store/chronicleStore.ts`. Do NOT rebuild the surfaces (`App.tsx`, `ThroneView`,
`StewardView`, `WarGamesView`, `LedgerView`) — keep them COMPILING against the old readings; Claude's
HUD swing retires them.*

---

## The whole idea (why we remodel)

The tool models the company's **departments** (Property Management, Leasing, Legal, Technology,
Marketing) as the top-level unit — the "fiefs" — and the actual **properties and owners appear
nowhere**. That is exactly backwards, and the name gives it away: *"LandLord" has no land in it.*

Edwin's Master Plan (Drive: *a firm Master Plan – Thatch CTO*; *a firm:
Relaunch*; the memory export) says the real top-level unit is **the client-facing agent who holds a
book of business** — *"a decentralized partner-based firm model (5 equity partners each managing ~500
units with central services),"* each agent being one owner's *"representative… for your entire
lifecycle."* The departments are **functions** — the deck literally says *"intelligence layer across
all functions"* and *"central services."* So the metaphor inverts:

- **The fief becomes the POD** — a **knight**'s (an agent's) book: a set of **owners (Patrons)** and
  their **doors (the LAND)**. The realm grows by **recruiting knights** to hold new pods.
- **The department becomes a GUILD** — a cross-cutting function (leasing, maintenance, accounting,
  investor relations, legal, technology) that serves every pod, run by a **master**.
- **Owners (Patrons)** — already folded from the War Game log — move *inside* a pod, as the
  investor-clients a knight keeps faithful. **Doors** become the **land** those owners hold.
- **King = Harold** (the founder, Harold Sepulveda; the realm is his). **Regent = Edwin** (the GM, who
  allocates owners into pods, mans the guilds, and recruits knights).

The correct nesting, ratified:

```
♛  Harold, the King  ·  📜 Edwin, the Regent (allocates & recruits)

THE PODS  (the fiefs — the top-level holding, the realm grows these)
   a Knight's pod  =  a book of business
      ├─ Owners (the PATRONS)     — the investor-clients; faith is theirs
      │     └─ Doors (the LAND)    — the ~500-door book; work & crises live here
      └─ health = faith held + doors worked + headroom to its ~500 cap

THE GUILDS  (the functions — demoted departments; serve every pod)
   Property Mgmt (Alys) · Leasing (Osric) · Maintenance (Mabel)
   Accounting · Investor Relations · Legal · Technology (Thatch, CTO)
```

The Regent's game becomes truer: **every owner in a knight's care, every guild manned, every box of
work on a real desk — and grow by recruiting knights.** Neglect still compounds (owners lose faith,
withdraw, the coffers drown); that engine stays, only re-homed under pods.

**Honest grounding caveats (do not build law past the source):** *"pod"* and *"BDR"* are Edwin's
words — the docs say *"equity partners"* / *"representatives"*, and they count the load in **doors
(~500/agent), not owners.** No per-door/per-pod fee economics are stated — leave those as open
working-fluid knobs. Do **not** promote the internal joke-titles ("Capo", "underboss") into the
metaphor.

---

## The leash (unchanged, and it matters more here)

- **The constitution wins.** Any conflict with `docs/KINGDOM.md` — stop and flag, don't build around.
- **Events-only / reading-first.** Owners, doors, pods' faith, a knight's health, a guild's load, the
  redefined debt — all **readings folded from the log + the census/acts records**, never stored state.
  The only writes are appended events and the deliberate acts (a commission, a placement).
- **The factory/setting leash.** Ship the **mechanism** and a **small working-fluid** alphabet — never
  a firm's real owners, door counts, fee figures, or agent roster. a firm's real book loads at the AppFolio
  gate. Name nothing firm-specific in code (Harold/Edwin/Piers/Alys/Mabel/Osric are the *founding
  census* already in the tree — keep them; add no new real names).
- **No chronicle break.** New fields optional; new shelves adopt their founding state via the
  census-migration pattern (`normalizeChronicle` + an `…AtFounding` JSON compare — mirror
  `catalogAtFounding`/`flowsAtFounding`). Old chronicles must normalize unchanged.
- **ADDITIVE, do not rip out.** Keep `readKingdom`/`states`/`regentsDesk`/`readThrone`/`readPatrons`
  and every existing view COMPILING and green. Add the new ontology and readings *beside* the old
  ones. Claude's HUD swing retires the old shell — not you.
- **Landmines (correctness):** do NOT rename existing catalog keys or flow-step holders (`readFlow`
  matches by `catalogRow`+`holder`; the War Game and the move-out relay break silently). Keep the
  `wg/<seed> · …` mark discipline so **Reset still strikes exactly a game's events** — any new
  war-scoped event (a placement, a commission dealt by the generator) must bear the mark.
- **Working fluid.** Never curate data toward reality; restore `data/chronicle.json`
  (`git checkout -- data/chronicle.json`) after any test — before every commit.
- **Verify green.** `npm run build` stays green at every commit. Because the HUD is not built yet,
  verify the **readings** directly (a small node/tsx harness folding a dealt game is fine) plus a
  browser regression that the existing views still render against the old readings.

---

## Phase 1 — Guilds: the departments become functions

**Goal:** the existing department-fiefs read as **guilds** (functions served across pods), with a
master and a cross-pod work-load — *without* changing the underlying territory/act records (so the old
`readKingdom` still works for the old views).

- **`src/domain/guilds.ts` (new):** `readGuilds(kingdom, log, now)` → one `GuildReading` per function:
  `{ guild, master, manned, cases, oldestDays, stuck }`. A guild's **master** is the person holding
  that territory (reuse the existing grant/appointment machinery — a guild manned = today's
  lorded/regency; **unmanned** = today's stewardship = delegation debt). Its **work-load** is the open
  cases whose holder belongs to the guild.
- **The seat→guild map (working fluid).** Flow-step holders (`pm-desk`, `mabel`, `osric`, `va-desk`,
  `lp-queue`, `alys`, and the grand-muster setting's role-seats) map to guilds. Ship a small
  `FOUNDING_GUILDS` alphabet + a `seatGuild(holder)` reading (general roles → guilds), mirroring the
  role→seat map already in `data/library/pm-setting.json`. Working-fluid: **Property Management,
  Leasing, Maintenance, Accounting, Investor Relations, Legal, Technology** — a firm's real function set
  loads at the gate.
- **Reading, not record:** guilds are the existing territories *re-read as functions*; add no new
  territory records. `guildsAtFounding` is not needed (no new shelf) — this phase is pure readings.

**Verify:** `readGuilds` on the founding census names the functions with their masters; deploy a game
and each guild carries the right cross-pod work-load; the old Regent's-Desk / Throne views still
render.

---

## Phase 2 — Pods, knights, owners, and the land

**Goal:** the new top-level holding. Owners (already folded from the log) become placeable into a
**knight's pod**; the unplaced owners are the Regent's new allocation debt; the land (doors) nests
under owners under pods.

- **The knight (a commission).** A person may be **commissioned** to hold a pod (an agent/equity-
  partner). Model it as a deliberate act (reuse the grant machinery with a new `role: 'knight'`, or a
  small new `commissions` book — your call, keep it census-migration-safe). The founding census has
  **no knights yet** (a firm is *recruiting* them) — Piers is the natural first candidate (Master Plan:
  *"sales role → licensed agent → operations"*). Recruiting a knight = enrolling/commissioning one.
- **The owner (Patron), now placeable.** Keep `readPatrons` (owners folded from war-case notes). ADD
  **placement**: `placeOwner(ownerName, knightId)` appends a placement event (war-scoped: bear the
  `wg/<seed>` mark so Reset strikes it) recording which knight serves an owner. An owner in no pod is
  **unplaced** — allocation debt.
- **The land (doors).** Doors are already folded from case ids (`doorOf`). Group them: **door → owner →
  pod**. A pod's doors = the doors of its placed owners; its size counts toward the **~500-door
  capacity** (working-fluid `POD_CAPACITY`).
- **`src/domain/pods.ts` (new):** `readPods(kingdom, log, now, seed)` → per knight: `{ knight, owners,
  doors, faith, capacity, filled, health }` (faith = aggregate of the pod's owners' faith; health =
  faith held + doors worked + headroom). Plus `unplacedOwners(...)` (owners folded but in no pod).
- **Store acts (`chronicleStore.ts`):** `commissionKnight(personId)` and `placeOwner(ownerName,
  knightId)` — events-only, same id/clock discipline as `flows.trigger` / `regent.handQueue`; the
  placement is the pod-world sibling of `handQueue`.

**Verify:** deploy a game → owners fold with their doors; place an owner into a knight's pod → the pod
gains their doors and their faith, the unplaced count falls; Reset strikes the placements.

---

## Phase 3 — The debt redefined, the generator, and consequences re-homed

**Goal:** the Regent's objective and the War Game speak the new ontology; the consequence engine and
the coffers read per pod.

- **The Throne / debt, redefined.** Extend (do not replace) `readThrone` — or add `readRealm(...)` —
  so the single number the Regent drives to zero is **unplaced owners + unmanned guilds + unseated
  work** (the operator's unseated-work half already exists). Objective line: *"every owner in a
  knight's care, every guild manned, every box on a real desk — recruit knights to grow."* Keep the
  old `debt` reading for the old view.
- **The generator (`wargame.ts`).** Deal owners as **first-class**: group the synthetic doors under
  **owners** (the owner names already ride the cases), deal a **roster of owners** each holding 1–a-few
  doors; **pre-place a share** into a couple of founding knights' pods and leave **many unplaced** (the
  allocation game); deal **a knight or two** (commissioned) with headroom, and **empty pods to recruit
  into**. Keep the work stream (cases handled by guilds) and the raw-intake stream. Same seed → same
  world; every new record `wg/<seed>`-marked; `dealtGame`/Reset intact.
- **Consequences re-homed (`consequences.ts`).** Patron faith already folds per owner. ADD: a pod's
  faith (aggregate) and a knight's health; a **withdrawn owner leaves their knight's pod** and cuts
  tribute. Keep severity/faith/withdrawal/the escalation tide exactly as tuned.
- **Coffers per pod (`treasury.ts`).** Tribute per **retained door** already exists; make it
  **attributable per pod/knight** (a reading — `coffersByPod` or a `pod.tribute` field) so the HUD can
  show a knight's book earning. The fail state (coffers red) is unchanged.

**Verify:** deploy a game → the redefined debt reads (unplaced owners + unmanned guilds + unseated
work); advance the clock → an owner's faith falls, a pod's faith dips, a withdrawal empties part of a
pod and cuts its tribute; the coffers still run red under sustained neglect; Reset restores founding.

---

## The reading API the HUD will consume (build these shapes)

Claude's War Table renders these — get the shapes right and clean:

- `readPods(...)` → `[{ knight, owners: PatronReading[], doors: string[], faith, capacity, filled, tribute, health }]`
- `unplacedOwners(...)` → `PatronReading[]` (owners in no pod — the allocation debt)
- `readGuilds(...)` → `[{ guild, master, manned, cases, oldestDays, stuck }]`
- `readRealm(...)` (or extended `readThrone`) → `{ debt, unplacedOwners, unmannedGuilds, unseatedWork, pods, guilds, coffers }`
- Recruiting affordance: a way for the HUD to know **how many pods stand empty / awaiting a knight**,
  and who is **commissionable**.
- Everything `now`-injected (folds against game time), pure, events-only.

---

## Deliverables (K3's half)
1. `guilds.ts` (readGuilds, the seat→guild map, `FOUNDING_GUILDS`).
2. `pods.ts` (readPods, unplacedOwners, pod faith/health/tribute) + the commission/placement records.
3. `wargame.ts` (owners first-class; pods pre-placed + unplaced; knights + empty pods) · `consequences.ts`
   (pods' faith, owner-withdrawal leaves a pod) · `treasury.ts` (tribute per pod) · `throne.ts`/`readRealm`
   (the redefined debt) · store acts `commissionKnight` / `placeOwner`.
4. `docs/KINGDOM.md` canon updated ("The realm remodeled — pods, knights, guilds, land"); `HANDOFF.md`
   refreshed. Keep every existing view compiling; do not build the HUD.

## Out of scope (name, don't build)
- **The War Table HUD / any React surface** — Claude's follow-on swing, on the settled model + the
  reading API above. The mockup is published (the "War Table" artifact) as the visual target.
- **a firm's real owners / door counts / fee economics** — load at the data gate.
- **The clerk/agent fleet standing in for a knight** — that is swing four (the operator agent); this
  writ only makes the *seat* it will fill.

## Charter (three-tier)
`k3/` branch, a commit per phase, open a PR — **do not merge**. Claude reviews, finishes the last mile,
verifies the readings + a browser regression, squashes crediting both, and (standing policy, Edwin
2026-07-20) fast-forwards `main` so the herald deploys. Restore `data/chronicle.json` before every
commit. K3 quirks: temperature 1, `reasoning_effort: high`, budget generously; trim old tool results
from `harness/loop.mjs` history so big reads don't burn the budget mid-build.
