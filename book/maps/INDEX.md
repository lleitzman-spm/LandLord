---
type: "map"
id: "map:index"
title: "Map of the Great Book"
standing: "built"
standing_source: "derived"
source_path: "tools/vault/emit.mjs"
generated: "2026-08-05T06:15:20.010Z"
generator: "tools/vault/emit.mjs"
aliases:
  - "map:index"
---

# Map of the Great Book

*Every page below is GENERATED. Never edit one — find the source named in its footer, fix that, and re-compile. The only hand-written page in the Book is `00 START HERE.md`.*

## The count

| kind | pages |
|---|---:|
| invariant | 394 |
| module | 82 |
| entity | 67 |
| decision | 62 |
| artifact | 56 |
| law | 53 |
| fact | 47 |
| writ | 22 |
| surface | 10 |
| **all** | **793** |

| standing | pages |
|---|---:|
| built | 633 |
| settled | 78 |
| canon | 69 |
| contested | 9 |
| retired | 3 |
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

- [[docs/WRIT-THE-LAND.md]]
- [[The departments-as-guilds land model is superseded]]
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]

## Load-bearing — what the rest of the kingdom leans on

*Ranked by roads in plus roads out. A high count means many things would move if this one did.*

| page | kind | standing | roads |
|---|---|---|---:|
| [[src/domain/economy.ts]] | module | built | 311 |
| [[src/domain/flows.ts]] | module | built | 307 |
| [[src/domain/catalog.ts]] | module | built | 268 |
| [[src/domain/chronicle.ts]] | module | built | 264 |
| [[src/domain/wargame.ts]] | module | built | 241 |
| [[src/domain/court.ts]] | module | built | 135 |
| [[The Kingdom — Canon]] | writ | canon | 116 |
| [[src/domain/events.ts]] | module | built | 112 |
| [[src/domain/guilds.ts]] | module | built | 111 |
| [[src/domain/treasury.ts]] | module | built | 82 |
| [[src/domain/types.ts]] | module | built | 64 |
| [[Writ — the task-language, the consequences, and the Regent's seat]] | writ | built | 64 |
| [[src/operator-core.ts]] | module | built | 62 |
| [[src/domain/consequences.ts]] | module | built | 53 |
| [[src/domain/tenureMuster.ts]] | module | built | 53 |
| [[src/domain/campaign.ts]] | module | built | 49 |
| [[src/domain/states.ts]] | module | built | 46 |
| [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] | writ | retired | 46 |
| [[src/realm/scene.ts]] | module | built | 44 |
| [[src/WarTableView.tsx]] | module | built | 43 |
| [[src/domain/pods.ts]] | module | built | 42 |
| [[src/domain/realm.ts]] | module | built | 40 |
| [[Writ — the economy pillar, re-expressed as chronicle readings]] | writ | built | 40 |
| [[WarTableView]] | surface | built | 39 |
| [[src/domain/economySetting.ts]] | module | built | 35 |
| [[src/domain/throne.ts]] | module | built | 34 |
| [[Writ — The Realm Map (the illuminated map, come alive)]] | writ | built | 34 |
| [[src/store/chronicleStore.ts]] | module | built | 33 |
| [[src/domain/contextGuard.ts]] | module | built | 31 |
| [[src/domain/courtTree.ts]] | module | built | 31 |

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
- `book/modules/` — 82 module pages
- `book/invariants/` — 394 invariant pages
- `book/writs/` — 22 writ pages
- `book/facts/` — 47 fact pages
- `book/decisions/` — 62 decision pages
- `book/surfaces/` — 10 surface pages
- `book/entities/` — 67 entity pages
- `book/artifacts/` — 56 artifact pages
- `book/maps/` — 0 map pages

---

*Generated by `tools/vault/emit.mjs` at 2026-08-05T06:15:20.010Z. This is the ONLY page carrying a build time — the rest hold no clock, so `git diff book/` shows what actually changed. Re-compile with `npm run book`; check it with `npm run book:lint`; ask it a question with `npm run book:trace -- "<subject>"` — the `--` is npm's, not ours, and without it npm swallows the subject.*
