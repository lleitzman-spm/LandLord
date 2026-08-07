---
type: "module"
id: "module:src/domain/events.ts"
title: "src/domain/events.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/events.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/events.ts"
---

# src/domain/events.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

285 lines · 19 exported symbols.

## What the file says of itself

> The event log — the living instrument's spine (see docs/KINGDOM.md, "The
> living instrument"). Ratified 2026-07-19: **events-only**. This append-only
> log is the SOLE record of the real work; a work item, a queue, who holds the
> ball, aging, a KPI are all *readings folded from it*, never stored state —
> the kingdom's oldest law (records in, readings out) reaching the operating
> model.
> 
> A factory component: general and catalog-agnostic. LandLord provides the
> mechanism — an event references a catalog row by key, a case by id, a holder
> by id — and a factory setting loads the specific catalog, cases, a

## Shape

- **Lines:** 285
- **Exported symbols (19):** `CaseReading`, `CaseStatus`, `CatalogBucket`, `ClerkProposal`, `EMPTY_LOG`, `EventKind`, `EventLog`, `KingdomEvent`, `Outcomes`, `Queue`, `UNHELD`, `ageInDays`, `awaitingHuman`, `casesByCatalogRow`, `clerkProposals`, `outcomes`, `queues`, `readCase`, `readCases`

## Entities

- [[The event log]] — *the same file `src/domain/events.ts`, seen as a entity rather than a module*
- [[The human-in-the-loop event arc]] — *the same file `src/domain/events.ts`, seen as a entity rather than a module*

## Backlinks

### Entities

- [[The clerk fleet]] — *declared in `knowledge/entities.json`*
- [[The event log]] — *the same file `src/domain/events.ts`, seen as a module rather than a entity*
- [[The human-in-the-loop event arc]] — *the same file `src/domain/events.ts`, seen as a module rather than a entity*

### Modules

- [[src/domain/agentIntake.ts]] — *imported by this file*
- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/domain/consequences.ts]] — *imported by this file*
- [[src/domain/docket.ts]] — *imported by this file*
- [[src/domain/escape.ts]] — *imported by this file*
- [[src/domain/flows.ts]] — *imported by this file*
- [[src/domain/guilds.ts]] — *imported by this file*
- [[src/domain/pods.ts]] — *imported by this file*
- [[src/domain/realm.ts]] — *imported by this file*
- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/domain/throne.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*
- [[src/LedgerView.tsx]] — *imported by this file*
- [[src/operator-core.ts]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[LedgerView]] — *imported by this view*
- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[`awaiting` is NOT an escape — it means parked on a clock, not on a person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[${name} works a real ${flowKey}/${stepKey} case and stops at a proposal]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a `done` written through a granted completeStep is stamped with the seat]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a base-blind merge is unchanged — it still takes the writing session]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a batch that repeats an id inside itself opens one case, not two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a belt tag that grants nothing is DECLARED as such, never left looking like a grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a case with no estateId folds to null (byte-identical to before)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a chase LOOP never runs unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a chronicle predating the estates shelf migrates to the empty founding book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clean founding brings NOTHING — the household is fully staffed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a DEADLINE is not a dependency — an SLA step still runs unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a deployed agent's core carries only functions its belt tags grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a double completion cannot advance the cascade twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a failure sent back to the party who erred is NOT an escape]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a failure that is redone still leaves a mark — the count, not the latest kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fully-worked vendor-dispatch folds to done and reaches settlement]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a hand-worked case does not count against a muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a held invoice and a cleared one are distinguishable by a READING, not by prose]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a HUMAN step never runs unattended, however simple it looks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a human touching an AUTO step is an unplanned escape — the machine failed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a judgment failure repaired on an `auto` row is a fault — the two claims cannot both hold]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a loaded estate roster flips isFoundingChronicle to non-founding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a MIDDLE step hands on and closes NOTHING]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a muster deployed on the remote side is adopted, not clobbered by a stale local]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a re-observed condition with a NEW id does not open a second case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[A RELAY CASE IS MATCHED — the mark is INFIXED, not a prefix]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a revoked grant struck on the remote side stays struck]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a route naming a step the flow does not have writes nothing either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a self-routed step comes back to the same desk, and the cascade does not walk past it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a spend on the higher-cap estate CLEARS; the same spend on an unlisted estate GATES]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step may carry its OWN verdict, overriding the row it shares]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step never reached cannot escape — an idle system is not an automated one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step routed upstream sends the case back to where the bad input entered]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step the catalog marks human is a DESIGNED escape, not a failure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step waiting on an OUTSIDE answer never runs unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with no declared mode is NOT MEASURED and never joins a total]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with NO route cannot fail — nothing is written at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with no verdict of its own still inherits the row — every existing book is unchanged]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a struck money event stays struck through the merge]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a target-anchored step with NO target date is unknown, never overdue]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ALLOWS the step that genuinely waits — the guard is not a wall]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ADVANCING batch refuses to replay on conflict — it does not re-append blindly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent CAN still advance a cascade — the belt makes it legible, not impossible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent with no wired judgment refuses to run rather than pretend to]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an auto step nobody touched is not an escape at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty array is valid — the revert-to-founding shape]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an OBSERVING batch still replays, so a minute of reasoning is not thrown away]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an out-of-range index is no act at all, like every other writer]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an unknown belt tag is refused at deploy, not silently ignored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and CLEARS an invoice that stays inside it — both verdicts are reachable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and it says how few independent judgments that rests on]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and the gate opens for a real, useful number of steps]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and the grammars they need really are absent from the founding book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a memory backing never touches disk]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a seedless chronicle refuses, not just readLog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[approving the final step records that the case is DONE]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[atStepFixture refuses to park on a step the book does not have]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[buildAgent touches no I/O and needs no backing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[carries the originating event id onto the opening record]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[classifies observing batches as replayable and advancing ones as not]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[counts each escalation, not each step — this is where rework becomes visible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deploy refuses a backing that does not implement the interface]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[distinct signals on the same subject open distinct cases]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does NOT re-wrap an already-guarded transport — that would swallow the caller's poison flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[drops non-string params, which is how a nested record would arrive]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[each judgment's declared `requires` matches what its clerk module actually reads]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[emits ONLY an opening and the hand to step one — never an approval or a completion]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[estateLabel resolves a slug to its label, falling back to the raw slug]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every agreed signal names a flow and a reason — no silent entries]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named agent carries a belt SUFFICIENT for the clerk that runs it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every other step still counts from the open date, unchanged]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster agent deploys to a core with no ratify/pay tool present]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster agent with a wired judgment has a sufficient belt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster entry constructs cleanly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[fileBacking refuses a doc with no standing War Game]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[founding is empty and reads as founding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[instantiateFlow stamps estateId on the opened event; readCase folds it forward]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is idempotent when local and remote are identical (no duplication)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[KEEPS a setting the other session loaded, when the base carried none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[lists every named agent whose commitment the book says needs no person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mace: a raw complaint in, an identified cascade proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[memoryBacking never requires a war-game seed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Milo: a vendor-commitment case in, a reasoned quote proposed, and he stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira HOLDS an invoice that overruns its authorized ceiling]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira: a settlement case in, a pay/hold recommendation proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names routed, unrouted and broken apart]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names WHICH step leaks, not just that one does]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[NO belt, on any agent, ever grants approveStep or overrideStep]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no seed is the reading it always was — byte for byte]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no step in the whole book that waits on the outside may run unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no step note leaks a literal {token} when rendered with full params]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[once every step is done, the condition may open a fresh case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[one muster does not count another muster’s work]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[one step worked over many events counts once, not once per event]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[opens a case on the flow the signal names]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overruling the final step closes it too]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads a well-formed roster, trimming and keeping order]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads taken ids straight out of the log, so no side index can drift]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reconcileById: a strike on one side is not resurrected by the other]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES a case it cannot see at all — it fails CLOSED]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a missing/empty id or label, and a duplicate id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a row whose string params carry an identifier]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a row whose SUBJECT carries an identifier]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES a step nobody has reached]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES an out-of-range step]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses non-JSON, a non-array, a rowless shape, and unknown fields]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses to complete a step the log already records as done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses to construct an agent that does not refuse to ratify]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES to ratify the same step twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[routes the good rows in a batch and skips only the bad]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[routes the over-limit spend signal a firm asked for]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[routing the same batch twice opens nothing the second time]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses rather than inventing a clock when the backing carries none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses with a BeltRefusal naming the missing tag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[skips a known signal whose flow this chronicle does not carry]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[skips a malformed row rather than opening a case with a hole in it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[skips a signal it has never agreed on, and says so]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still allows a legitimate completion of the step in hand]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still lets THIS session’s own load win over a stale remote]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still routes ordinary rows — the scan must not fire on real work]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the capability table is DEEP frozen — its arrays cannot be widened]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the case READS as done once the last step is ratified]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the case spine feeds the gate end-to-end: readCase(estateId) → spendGate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the escape count is not folded into the rate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the fallback (no base) CANNOT honor a strike — it resurrects (documents the limit)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the fleet path stamps a swept `done`, not only the rig path]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding book declares no failure routes, and says so rather than defaulting]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding flow book budgets most of its steps to a person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the M family judgments are all known to this rig]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the move-out relay also folds clean to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the owner's window is BOTH human and outside-waiting — belt and braces]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the record and the judgment name the SAME invoice figure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the seen-map key survives — the separator is a NUL byte, not a space]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the step IS anchored to the target date, not left to default]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two that cannot be driven refuse with the REASON, not a missing wire]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the wrap it installs really does block a leaking payload]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the writing session keeps its own board change when it is the one that moved it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[threads the estate through so the spend gate reads a per-estate cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two fresh ids for the same condition in ONE batch open exactly one case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing on merge (base-blind fallback)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing WITH a base (3-way)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[unionById keeps both sides, remote first, dedupes by id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[unions money and record books by id too (no owner/grant append lost)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with a target date ahead, it is due relative to THAT date]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with no routes declared the count is zero and the rate is unchanged]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with the target date past, it breaches like any other step]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[wraps an UNGUARDED transport, so a direct caller of deploy/run still gets the boundary]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Writ — the first War Game (the proving ground)]]
- [[Writ — the flow engine (the operator's spine)]]
- [[Writ — the operator's hands (swing two, part one)]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/events.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
