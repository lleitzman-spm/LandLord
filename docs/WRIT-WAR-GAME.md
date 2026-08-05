# Writ — the first War Game (the proving ground)

*Staged for a K3 summoning. Builds the master plan's first War Game (`docs/WAR-GAMES.md`): a
synthetic operation at a firm's scale poured through the operator, with a clock you can advance to
watch the work move. Working fluid and gate-safe: real seats, invented doors and tenants; no real
client record ever crosses the walls.*

*Read `docs/WAR-GAMES.md` (the plan), `docs/KINGDOM.md` (constitution — it wins), `CLAUDE.md`,
`AGENTS.md`, and the operator you feed — `docs/WRIT-FLOW-ENGINE.md` + `docs/WRIT-OPERATOR-HANDS.md`
and the code in `src/domain/flows.ts`, `src/domain/events.ts`, `src/domain/catalog.ts`. Your
profile: `docs/K3-PROFILE.md`.*

## What you are building

A generated synthetic operation and a simulated clock, so the Regent can pour a realistic load
through the operator (catalog → flow engine → the hands) and watch it move.

1. **The generator** (`src/domain/wargame.ts`). From a seed and a clock, produce a synthetic
   operation at ~200-door scale, entirely as **events** — a War Game is just a big generated log
   the operator already knows how to read (events-only):
   - **Doors** — ~200 synthetic properties (plausible addresses/units), used as the *subject* of
     work (the flow engine keys work by a subject string already).
   - **Tenants** — medieval-flavored names, for fun and on-theme: "Bob the Tanner", "Agnes the
     Alewife", "the Widow of Willow Row". A small name-maker (given name + trade/epithet), varied
     and plentiful.
   - **The seats** — the real census (Alys, Mabel, Osric) and the flow holders (pm-desk,
     va-desk, lp-queue) already in play; work routes to them.
   - **The boxes** — a realistic stream of work across the catalog: move-out relays (trigger the
     flow engine on a door, at varied stages of progress), work orders, delinquencies, renewals,
     rent postings — spread across doors and seats and **timestamped across recent simulated days**
     so queues and aging read realistically the moment the game loads.
2. **The clock** (a simulated `now`). The readings already take `now` as a parameter (pure, clock
   injected). Thread a store-level **sim-now** through the app so, once a game is deployed, the
   operator reads relative to game time, not the wall clock — and a control **advances** it (a day,
   a week); the readings re-fold, aging climbs, breaches surface, what's due changes. Fall back to
   the real clock when no game is deployed.
3. **The surface** — a new view, **War Games** (the Regent named it; medieval flavor welcome), in
   the nav under "The work". It offers **Deploy** a game (generate + load the world), **Advance**
   the clock, and **Reset** (clear the game). It shows the operation under load — the operator's
   outcomes and queues folded from the generated events — so you can watch it move.

## The leash and the gates

- **Events-only.** A War Game is a generated event log (plus flow instances). Store no new state;
  the operator's existing readings fold it.
- **Working fluid, gate-safe.** All synthetic — no real tenant, owner, or door; real seats only.
  The data gate stays shut.
- **Do not clobber real records.** Deploying loads synthetic events; Reset clears them. Make it
  recoverable — the Regent can wipe a game and get the founding chronicle back. Keep the game's
  events distinguishable (a subject/case-id convention) so Reset removes exactly them and nothing
  else.
- **Factory-clean, verify in a browser, `k3/` branch + PR, do not merge** — as the charter sets
  out. Restore `data/chronicle.json` after tests (`git checkout -- data/chronicle.json`).

## Deliverables

- `src/domain/wargame.ts` — the generator (doors, medieval tenants, the box stream) and the
  name-maker; pure, seeded, clock-injected, returning the events / flow instances to load.
- The store — `wargame.deploy / advance / reset`, and a simulated `now` the app threads into the
  readings (real clock when no game is loaded).
- A **War Games** view — Deploy / Advance / Reset, and the operator's readings under load; wired
  into the nav (`App.tsx`).
- `npm run build` green; driven in a browser: deploy a game, watch queues/outcomes fill, advance
  the clock, watch aging move.
- Commit in the kingdom's plain-English medieval voice on a `k3/` branch; open a PR; **do not
  merge** — Claude reviews, the Regent judges.

## Why this matters

This is the proving ground — the first time the operator meets realistic load, and how we learn
whether the work moves through correctly. It is also the seed of the product: the melee a property
manager will one day train in.
