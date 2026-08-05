# LandLord

**Operations software for property-management companies, modelled as a kingdom —
so that the work nobody has picked up is impossible to miss.**

A property-management company's real problem is rarely that the work is unknown.
It is that the work has no owner, and the org chart is the last place that shows
up. Somebody is covering three portfolios because nobody ever decided they
shouldn't. A queue is ageing on a desk that was never assigned. LandLord's whole
premise is that **this debt is measurable, and the measure is the absence of a
record**: authority exists only through acts that were deliberately written
down, so a job with no act behind it reads, automatically and loudly, as
delegation debt.

The feudal vocabulary is not decoration. It carries distinctions modern
org-chart language hides: who **holds** a portfolio versus who merely **works**
it, what was **deliberately granted** versus what **silently accumulated**, and
who belongs to the line of management versus the line of trade. A *fief* is a
book of doors. A *knight* holds one. A *Patron* is an owner who has entrusted
their estate to the firm. An *artisan* is an outside vendor — they can run a
territory, they can never hold one. Every one of those is a real distinction a
property manager already makes and has no word for.

> **The data in this repository is a fictional demo tenant.**
> Harold, Edwin, Mabel, Osric, Alys, Piers and the rest are invented. So are the
> estates, the streets, the owners, the vendors, the fee schedule and the land
> itself. Nothing here describes any real company, and no figure here is
> anybody's actual terms. See [The demo tenant](#the-demo-tenant) below.

---

## What it does

**The Regent's desk — delegation debt, computed.** Every territory is in
exactly one of four states, and the state is *never stored*; it is folded from
the records every time it is read:

| | State | Meaning |
|---|---|---|
| 🟢 | **Lorded** | held by an internal vassal, by explicit grant |
| 🟢 | **Held in plurality** | one vassal holds several — legitimate, watched, not flagged |
| 🟡 | **In regency** | no lord; an outside artisan is formally keeping it |
| 🔴 | **In stewardship** | no grant, no appointment, nothing recorded — it has fallen to the Regent |

The mechanism separating "held in plurality" from "in stewardship" is *a
deliberate act, recorded*. A grant on the books is a choice the system respects.
The absence of one is a debt the board displays. Its ideal length is zero.

**The operating spine.** Work orders, leases, renewals, turnovers, delinquency,
screening, move-outs and inspections run through a **flow engine**: a flow is a
cascade of steps across seats, loaded as configuration rather than coded. A
work order is not a checkbox — it is *report → identify → assign vendor →
dispatch → invoice → confirm → pay → post to accounting*, and no code knows the
word "move-out". Everything is an append-only **event log**; every queue, age,
KPI and breach is a reading folded from it.

**The task language.** A task is a word in a bounded, compositional language:
`maintenance / hvac / no-cooling` is one word, reached by walking a small tree of
domains → systems → leaves. A few dozen flow *shapes*, parameterised by the leaf,
render all the words. Identifying a task down the tree *is* triggering the flow
that completes it.

**Two ledgers and the bridge between them.** A property manager is a fiduciary
running two money worlds at once, and almost every accounting decision follows
from keeping them apart: the **estates in trust** (rents, deposits and reserves
that belong to owners and tenants) and the **company's own coin** (the fees it
earns against what it costs to run). They meet at exactly one hinge — the
management fee, simultaneously an owner's expense and the firm's revenue. Get
the bridge right and the books reconcile; get it wrong and owners' money
masquerades as profit. LandLord folds balanced postings from the money events on
every read, so the ledger cannot drift, and a correction is a reversing event
rather than an edit. Trust guardrails (no commingling, no owner overdrawn,
deposits held whole, earned fees swept in time) are checked live from the
postings, not noticed once a month.

**The clerk fleet.** Each seat can have an agent that works its queue as far as
it can and **stops at the judgment**. A clerk emits `proposed` and parks the
case `awaiting`; it never emits `approved` or `overridden` — that ratchet is the
human's alone. Augment every seat, replace none.

**The war table and the war game.** The whole realm on one board, with an
advanceable clock and a live consequence simulation: an unattended task festers,
escalates, a Patron loses faith, withdraws their doors and their tribute, and the
coffers bleed until upkeep drowns them. The fail state is a reading, not an
invented number.

## Running it

Node 22 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
```

That is the whole setup. **No API keys, no database, no account.** With no vault
configured the chronicle lives in `data/chronicle.json` on disk and every feature
works. Copy `.env.example` to `.env` only when you want to wire something up.

```sh
npm test           # 408 tests
npm run build      # type-check + production build
npm run leakcheck  # credential / personal-data scan (also runs in CI)
```

## How it is laid out

| Path | What lives there |
|---|---|
| `src/domain/` | The model. Pure functions over records — no React, no I/O. Start at `census.ts`, `states.ts`, `flows.ts`, `economy.ts`. |
| `src/` (views) | React surfaces. `WarTableView.tsx` is the landing board. |
| `src/table/`, `src/realm/` | The board's rendering — the flat 2D map, and a retired 3D scene kept behind the same interface. |
| `src/store/` | The chronicle store: reads, acts, merge. |
| `src/server/`, `src/worker.ts` | The vault seam, identity verification, the deployed Worker. |
| `harness/` | The clerk fleet — one module per seat, plus the brain policy and its fallbacks. |
| `data/` | Seed data for the demo tenant, and the general PM reference library. |
| `docs/` | `KINGDOM.md` is the constitution; the `WRIT-*.md` files are per-surface design documents. |
| `tools/` | Standalone scripts: the terrain baker, the Great Book compiler, the leak scanner. |
| `test/` | Vitest. |

**Read `docs/KINGDOM.md` first.** It is the constitution — the model the code
implements, and it wins over the code until amended.

## The demo tenant

Everything the app ships with is **seed data for one fictional tenant**, there so
a fresh clone has something to operate. It is not a template of how a firm should
be organised and it is not anybody's real book:

- **The census** (`src/domain/census.ts`, `data/chronicle.json`) — invented
  people in invented seats, a worked example of the pledge model.
- **The fee schedule** (`src/domain/economy.ts`) — illustrative percentages and
  caps, chosen to exercise the engine and read plainly on screen. **A real
  deployment configures its own** through the tenant setting
  (`src/domain/economySetting.ts`), which is the supported path and the only one.
  No firm's terms are compiled into this software.
- **The catalog and flows** — a small working-fluid alphabet. The mechanism is
  the product; the specific leaves are demo content. `data/library/` holds a
  much larger *general* PM reference library (10 domains, 24 flow grammars, 297
  leaves) that a deployment can draw from.
- **The land** — procedurally generated. `public/fantasy-relief.bin` is baked by
  `tools/bake-fantasy-relief.mjs` from seeded noise; same seed, same bytes.
  There is a law that rides with that: **generated land may never be presented as
  a finding.** The doors carry the data; the ground is scenery.

## Maturity — honestly

This is **pre-1.0 and it has never had an outside user.** It is a working
application, not a product you should run a business on yet.

What is solid: the domain layer and its tests, the events-only discipline, the
flow engine, the economy's postings and readings, the reading-level invariants.

What is not: there is **no multi-tenancy** — one deployment serves one book, and
the per-identity vault rows are a sandbox, not tenant isolation. Writes are
whole-document upserts, so **last writer wins**, and concurrent editors will lose
each other's work. There is no migration story for stored documents beyond
tolerant normalisation. The clerk fleet is proven on simulated data only. Error
surfacing on a failed write is thin. Accessibility has been walked but not
audited.

None of that is hidden in the code, and issues on any of it are welcome.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The one rule that is not negotiable:
**no real personal data and no credential may ever enter this repository.**
`npm run leakcheck` runs on every pull request.

## Licence

MIT — see [`LICENSE`](LICENSE).
