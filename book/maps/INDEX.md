---
type: "map"
id: "map:index"
title: "Map of the Great Book"
standing: "built"
standing_source: "derived"
source_path: "tools/vault/emit.mjs"
generated: "2026-08-07T05:23:03.540Z"
generator: "tools/vault/emit.mjs"
aliases:
  - "map:index"
---

# Map of the Great Book

*Every page below is GENERATED. Never edit one — find the source named in its footer, fix that, and re-compile. The only hand-written page in the Book is `00 START HERE.md`.*

## The count

| kind | pages |
|---|---:|
| invariant | 497 |
| fact | 163 |
| module | 83 |
| entity | 67 |
| decision | 62 |
| artifact | 58 |
| law | 53 |
| task | 52 |
| place | 46 |
| guard | 41 |
| transition | 41 |
| writ | 25 |
| surface | 10 |
| hand | 6 |
| flow | 5 |
| **all** | **1209** |

| standing | pages |
|---|---:|
| built | 1048 |
| settled | 78 |
| canon | 69 |
| contested | 9 |
| retired | 4 |
| proposed | 1 |

## PROPOSED — not built, and never evidence that anything works ⚠

*A proposed claim rendered beside a built one, both in plain prose, is exactly how three closed blockers sat open in `HANDOFF.md` for five sessions. These are designs. None of them is a build.*

- [[Edict (crown edicts, tenure hierarchy)]] — `docs/WRIT-THE-WAR-TABLE.md`

## CONTESTED — two sources disagree, nobody has ruled

- [[docs/OPEN-QUESTIONS.md]] — `docs/OPEN-QUESTIONS.md`
- [[Fee terms are currently one shape and probably need to be many]] — `docs/OPEN-QUESTIONS.md`
- [[FOUNDING_GUILDS still names Crown offices, not outside trades]] — `src/domain/guilds.ts`
- [[Open questions]] — `docs/OPEN-QUESTIONS.md`
- [[Whether a deployment ever spans two trust-accounting jurisdictions is open]] — `docs/OPEN-QUESTIONS.md`
- [[Whether an unclassified spend estimate should default at the cap is open]] — `docs/OPEN-QUESTIONS.md`
- [[Whether artisan should be a pledge or a relationship is open]] — `docs/OPEN-QUESTIONS.md`
- [[Whether LandLord is single-tenant or multi-tenant is genuinely open]] — `docs/OPEN-QUESTIONS.md`
- [[Whether the department-territories are struck or migrated is undecided]] — `docs/WRIT-THE-BROKERAGE.md`

## RETIRED — kept for history, never cited as current

- [[Default estimate for an unclassified repair — RETIRED, there is no default]]
- [[docs/WRIT-THE-LAND.md]]
- [[The departments-as-guilds land model is superseded]]
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]

## Load-bearing — what the rest of the kingdom leans on

*Ranked by roads in plus roads out. A high count means many things would move if this one did.*

| page | kind | standing | roads |
|---|---|---|---:|
| [[src/domain/flows.ts]] | module | built | 660 |
| [[src/domain/catalog.ts]] | module | built | 398 |
| [[src/domain/economy.ts]] | module | built | 366 |
| [[src/domain/chronicle.ts]] | module | built | 270 |
| [[src/domain/wargame.ts]] | module | built | 247 |
| [[src/domain/events.ts]] | module | built | 191 |
| [[src/domain/court.ts]] | module | built | 135 |
| [[The Kingdom — Canon]] | writ | canon | 120 |
| [[src/domain/guilds.ts]] | module | built | 116 |
| [[src/operator-core.ts]] | module | built | 87 |
| [[src/domain/treasury.ts]] | module | built | 82 |
| [[src/domain/economySetting.ts]] | module | built | 69 |
| [[Handoff — where things stand]] | writ | settled | 66 |
| [[Writ — the task-language, the consequences, and the Regent's seat]] | writ | built | 66 |
| [[src/domain/types.ts]] | module | built | 64 |
| [[src/domain/consequences.ts]] | module | built | 53 |
| [[src/domain/tenureMuster.ts]] | module | built | 53 |
| [[Move-out → re-list relay]] | flow | built | 51 |
| [[src/domain/campaign.ts]] | module | built | 49 |
| [[src/domain/pods.ts]] | module | built | 48 |
| [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] | writ | retired | 48 |
| [[src/domain/states.ts]] | module | built | 46 |
| [[src/realm/scene.ts]] | module | built | 44 |
| [[src/WarTableView.tsx]] | module | built | 44 |
| [[src/domain/realm.ts]] | module | built | 42 |
| [[src/domain/escape.ts]] | module | built | 41 |
| [[WarTableView]] | surface | built | 40 |
| [[Writ — the economy pillar, re-expressed as chronicle readings]] | writ | built | 40 |
| [[Lease renewal]] | flow | built | 35 |
| [[Owner onboarding]] | flow | built | 35 |

## Ways in

- [[The Kingdom — Canon]] — *the constitution — it wins until amended*
- [[Handoff — where things stand]] — *where things stand and what is pending*
- [[Writ of the Great Book — the living wiki, and the law that keeps it honest]] — *the law that keeps this Book honest*
- [[App]] — *a place a person actually stands*
- [[CensusView]] — *a place a person actually stands*
- [[CommandPalette]] — *a place a person actually stands*
- [[CrownView]] — *a place a person actually stands*
- [[FiefView]] — *a place a person actually stands*
- [[FlatMapView]] — *a place a person actually stands*
- [[LedgerView]] — *a place a person actually stands*
- [[Onboarding]] — *a place a person actually stands*
- [[PersonView]] — *a place a person actually stands*
- [[WarTableView]] — *a place a person actually stands*

## Every shelf

- `book/laws/` — 53 law pages
- `book/modules/` — 83 module pages
- `book/invariants/` — 497 invariant pages
- `book/writs/` — 25 writ pages
- `book/facts/` — 163 fact pages
- `book/decisions/` — 62 decision pages
- `book/surfaces/` — 10 surface pages
- `book/entities/` — 67 entity pages
- `book/tasks/` — 52 task pages
- `book/hands/` — 6 hand pages
- `book/flows/` — 5 flow pages
- `book/places/` — 46 place pages
- `book/transitions/` — 41 transition pages
- `book/guards/` — 41 guard pages
- `book/artifacts/` — 58 artifact pages
- `book/maps/` — 0 map pages

---

*Generated by `tools/vault/emit.mjs` at 2026-08-07T05:23:03.540Z. This is the ONLY page carrying a build time — the rest hold no clock, so `git diff book/` shows what actually changed. Re-compile with `npm run book`; check it with `npm run book:lint`; ask it a question with `npm run book:trace -- "<subject>"` — the `--` is npm's, not ours, and without it npm swallows the subject.*
