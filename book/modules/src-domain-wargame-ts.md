---
type: "module"
id: "module:src/domain/wargame.ts"
title: "src/domain/wargame.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/wargame.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/wargame.ts"
---

# src/domain/wargame.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

1049 lines · 12 exported symbols.

## What the file says of itself

> The War Game generator — the proving ground (docs/WAR-GAMES.md,
> docs/WRIT-WAR-GAME.md). From a seed and a clock this pours a synthetic
> ~200-door operation through the operator, entirely as EVENTS: doors,
> medieval-named tenants, and a stream of work boxes — move-out relays
> triggered on doors (dealt at varied stages of progress), work orders,
> delinquencies, renewals, rent postings — spread across the real seats and
> timestamped across recent simulated days, so the queues and aging read
> true the moment the game loads.
> 
> Events-only: a War Game is just a big generated log the operator already
> knows 

## Shape

- **Lines:** 1049
- **Exported symbols (12):** `DealtGame`, `Dice`, `WAR_MARK`, `WarDoor`, `WarGame`, `WarState`, `dealtGame`, `dice`, `generateGrandMuster`, `generateWarGame`, `makeDoors`, `tenantName`

## Modules

- [[src/domain/catalog.ts]] — *imported by this file*
- [[src/domain/economy.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/flows.ts]] — *imported by this file*
- [[src/domain/pods.ts]] — *imported by this file*
- [[src/domain/treasury.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[The Kingdom — Canon]] — *this writ names the exported symbol `generateGrandMuster`; this writ names the exported symbol `generateWarGame`*
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `dealtGame`*
- [[Writ — the Muster Library and the Intro Campaign]] — *this writ names the exported symbol `generateGrandMuster`*
- [[Writ — the task-language, the consequences, and the Regent's seat]] — *this writ names the exported symbol `dealtGame`*

### Entities

- [[War Game]] — *declared in `knowledge/entities.json`*

### Modules

- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/domain/tenureMuster.ts]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/wargame-core.ts]] — *imported by this file*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a bare census is never dry — there is nothing to be broke with]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a base-blind merge is unchanged — it still takes the writing session]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a book cut over the muster places EVERY door — the join is sound]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a cash-complete sample month is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a Chancellor granted ONE fief holds one fief — an office is not land]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a clean founding brings NOTHING — the household is fully staffed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a craft standing headless holds it at a march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a crisis on a leased door OUTRANKS its lease — the map shows trouble]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door in no knight’s care is a real state, and reads as debt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door the book does not hold reads UNPLACED, and is named]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door the book holds places cleanly — realm, shire, fee and knight]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door’s shire and its fee stand in the SAME realm as the door]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee scattered across two shires reads fine, and rolls up as ONE fee]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee with doors scattered across three metros reads fine]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee’s patron at odds with the muster’s owner is a finding, not a refusal]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fief with no grant draws NO lord — the Regent is not its lord]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a full mtm month (split, funded) is sound end-to-end and the bridge ties after the fee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a full TRUST account never saves the Crown — that coin is not its own]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a GL-rename + fee-rate + mtm-split patch stays sound over a dealt month]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a headless craft holds back EVERY metro, not one — the household is shared]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless office reads as headless — never as somebody else’s]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a house mtm rule with no splitBps falls back to the named constant]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a march PROMOTES when the records change, with no field written]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a muster deployed on the remote side is adopted, not clobbered by a stale local]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a name the book does not hold reads as NOTHING rather than throwing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a neglected operation loses doors until tribute drops below upkeep — RED, fallen]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a null/absent patch is a no-op — returns base unchanged (same reference)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a one-off company expense does NOT become the standing monthly upkeep]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a placed door in no knight’s care is NOT unplaced — it is the debt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a PRE-FUNDED owner settles with NO topup and stays sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a present economySetting (even a no-op patch) means the chronicle is no longer "at founding"]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a present economySetting rides the raw record untouched; economyOf folds it in]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a present-but-empty catalog shelf stays empty (truth as struck, not re-seeded)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a real grand muster is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a real grand muster is sound — no false positives on realistic data]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a realm’s edicts read soonest-due first]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a regency draws its keeper, not a lord]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a revoked grant struck on the remote side stays struck]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a row naming a place the book does not hold reads unplaced, and says WHICH]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a shire DEMOTES again when the records go the other way]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a solvent operation clears its upkeep — black, not fallen]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a stale vault reads every craft headless — honestly, and fillable]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a standing muster reveals a realm of towns, every door a building]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a struck money event stays struck through the merge]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a supplied bank statement that disagrees produces the exact lapse]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a tenure realm is a PLACE — a name and a sovereign, and no score on it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a tightened-cap patch stays sound over a dealt month (spend caps do not touch the postings)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a war door and an estate roster both go straight in]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a war door carries NO tenure of its own — only an address and an owner]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a well-ordered owner month is sound (income before fees, temporal-clean)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a zero/invalid bill posts nothing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[accepts a well-formed patch and round-trips through applyEconomySetting]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[accepts null on a rate field (clear) but still rejects other non-numbers]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[all three failing at once names all three]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an absent catalog shelf adopts the founding rows]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an absent economySetting normalizes through untouched, and economyOf is a true no-op]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an ANSWERED edict is never late, however long the day is gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an artisan naming no trade is shown, not swallowed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an empty muster reads empty, not broken]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty object is the valid no-op patch]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an empty object normalizes to founding state]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with a higher cap (harrow-c) clears a spend the house cap would gate]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with no override still reads the house cap]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with no override still reads the house cap (invariant)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate's own NTE governs the settlement ceiling where it has one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an id-keyed array merges by id, not by index]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an owed edict PRESSES as its day nears]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an UNFUNDED owner settles soundly via the shortfall topup]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[balances within both books (the bridge)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[both books balance over the whole dealt money log]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[but two fiefs under one lord IS a plurality]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches a deposit refunded from the wrong tenant (per-tenant subledger)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches a mid-history breach that the end state hides (temporal replay)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches a money event with an unknown kind (silent-drop guard)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches an over-sweep (bridge driven negative) the aggregate checker misses]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches an owner overdrawn (commingling guard)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[commission_sweep lands the markup in By-Pass, never operating, and stays sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[counts each kind of override, and the house cap as one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[doors the hierarchy cannot place count toward NO metro’s standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[draws the Crown at the head, with its wards beneath it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every door names a realm, a shire and a fee the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every edict names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[EVERY enrolled subject is drawn somewhere — the totality guarantee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every fee names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every founding door bears all four keys]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every id in the book is unique within its kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every metro of the joined book reads its standing, marches first]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every MoneyKind balances within each book (double-entry)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every MoneyKind produces postings — none falls through to default:]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every realm names a sovereign — a realm with no law is not a realm]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every shire names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every town has exactly ONE manor, and every building a stable slug id]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[falls back to the house cap for an unknown estate]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[falls back to the house cap when no estateId is given]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[firm keeps the WHOLE late fee (splitBps 10000) still nets the owner zero soundly]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[folds the outside trades from their hands’ own notes]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[gathers several hands of one trade under that one guild]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[hangs knights under their fief’s lord, and squires under their knight]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ignores a GL patch naming a role the chart does not have (leash: never invents an account)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[IRS backup withholding stays sound and rides the solvency identity]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is a real posting (R1: never the empty default)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is idempotent when local and remote are identical (no duplication)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is null for an absent patch (founding, no setting)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[KEEPS a setting the other session loaded, when the base carried none]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[lateness is READ from the day against the clock, never stored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[mtm %→flat : a flat-basis override splits 50/50 on the entered premium]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[mtm_fee balances across both books (the bridge)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[mtm_premium balances within the trust book (owner income collected)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[names NO keep when the office it declares is not in the census]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[names no trade where the note names none]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[needsOwnerApproval agrees with spendGate for the estate override]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[never mutates the base economy]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no fief stands at the founding — an empty land, read honestly]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no founding fee bears any word that describes a place]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no knight seated there holds it at a march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no mtm rule at all still resolves via the fallback constant (never throws)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no muster stands ⇒ the land lies UNREVEALED, and no town is drawn]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no record anywhere in the book stores a standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[normalizeChronicle is idempotent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[null CLEARS a field — flips the founding flat renewal into a % of new rent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ONE door short holds it at a march, and says which clause failed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides a budget line by accountRole (and can add a new one)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides a fee rate by kind, leaving other rules untouched]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides an existing per-estate cap and upserts a brand-new one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides the house-wide spend cap]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides the mtm split ratio]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ownerCents + firmCents always ties the fee (rounding lands on the owner)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ownerCents + firmCents always ties the premium (rounding lands on the owner)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[re-settling the same WO is caught by the store guard (kind + sourceId)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[readBankRecs folds every physical bank on a real grand muster; none overdrawn]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads a master once the office is founded and granted — the act STICKS]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads BOTH corporate banks, not just the operating one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads the demo 35% firm / 65% owner split]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads the demo 60/40 split (owner takes the remainder)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads the trade out of a sentence]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads undefined when the economy sets no house cap and the estate has no override]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reconcileById: a strike on one side is not resurrected by the other]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[rejects malformed rows and bad number shapes]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[rejects non-JSON, a non-object, and an unknown top-level field]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[renames a GL account code and name by role]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[renewal flat→% : a new_rent-basis override yields a percentage of new rent via feeAmount]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[returns the seeded harrow-c estate's own cap]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[scalars overwrite; an unknown top-level field on the patch is ignored]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[seats all three Crown offices with their Chancellors]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[settling a real WO onto a live grand muster keeps the whole chronicle sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still lets THIS session’s own load win over a stale remote]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still names the declared office where it DOES stand]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still weighs a hand-recorded cost when no upkeep book stands]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[sweeping commission through operating (fee_sweep) raises a By-Pass segregation lapse]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[takes at most two words before "guild" — never a whole clause]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[tenant billed the WHOLE fee, owner keeps its share, firm earns its cut — sound with NO funding]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the book reaches ONE door in two hundred — the finding, said as a number]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[THE BUG, pinned: a dealt grand muster runs red but is NOT broke]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the coffers ARE dry when the Crown’s own banks run out]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the control reads a SHIRE — all three clauses hold]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the doors read held / vacant / crisis — all three states are drawn]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the fallback (no base) CANNOT honor a strike — it resurrects (documents the limit)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the fee bridge ties]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the Fee shape itself holds only id, realm, name and patron]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the FOUNDING book already scatters a fee across two metros]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding book reads one shire and one march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding chronicle is fiduciarily sound (aggregate + temporal)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle reads as founding]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding realm carries an edict of every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the household’s craft reading satisfies what the standing asks of it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the id hash is stable and well spread — the view places from it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the key forgives case, spacing and a tenant suffix — and nothing else]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the muster’s doors decide the standing, not the founding book’s]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading and the VIEW’s contract are the same shape — the firewall holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the reading counts the metro’s own doors, knights and fees]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scene is PURE — the same records fold the same map, twice]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the shapes stay what they say they are]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the three-arg call (no estate) reads the house cap exactly as before]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the trust solvency identity holds (variance ≡ AP − AR)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the two readings are genuinely independent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the two-arg needsOwnerApproval call behaves exactly as before]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the two-arg spendGate call (the harness shape) behaves exactly as before]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the UPKEEP BOOK is the monthly rate — the money log is only the fallback]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the whole founding book, mustered, rolls up to the counts the shelf reads]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the writing session keeps its own board change when it is the one that moved it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[tribute per door comes from the economy management fee rule (not a hardcode)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two rows for one door are SAID, not chosen in silence]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing on merge (base-blind fallback)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing WITH a base (3-way)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[undefined LEAVES a field; null on a brand-new rule just means absent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[unionById keeps both sides, remote first, dedupes by id]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[unions money and record books by id too (no owner/grant append lost)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[with no game standing, upkeep falls back to the treasury rolls]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Writ — the first War Game (the proving ground)]]
- [[Writ — the task-language, the consequences, and the Regent's seat]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/wargame.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
