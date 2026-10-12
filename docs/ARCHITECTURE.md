# LandLord — architecture and working rules

TypeScript, no framework. `three` for the table. Bundled by esbuild into one `dist/game.js` served as static files by a small Cloudflare Worker that also proxies the model call (`/api/word`). The sim is pure and runs in node.

```
src/
  sim/      pure rules engine. No DOM, no three. Deterministic from the seed.
    types.ts   THE CONTRACT: GameState, Action, SimEvent, SimModule ...   (integrator)
    core.ts    rng, ids, calendar, heralds, text fill, map helpers         (integrator)
    index.ts   Sim class: module order, stepping, action dispatch          (integrator)
    world.ts path.ts buildings.ts actors.ts jobs.ts        → sim-world agent
    economy.ts tenants.ts rent.ts renown.ts                → sim-people agent
    staff.ts incidents.ts effects.ts orders.ts oaths.ts rank.ts rival.ts modes.ts save.ts → sim-rule agent
  data/     typed content, no logic. ids.ts is FROZEN. schema.ts is the content contract.
  render/   three.js diorama. api.ts is the contract; palette.ts is the look.
  ui/       DOM manuscript interface. api.ts, kit.ts, css/base.ts are the contract.
  word/     speech → model → Actions. api.ts is the contract.
  audio/    WebAudio synthesis. api.ts is the contract.
  server/   Cloudflare Worker (static assets + /api/word).
  dev/      fixtures and gallery pages for development. Not shipped.
  main.ts   wires everything; the frame loop; saves.
tools/      check.mjs (typecheck), shot.mjs (headless screenshot), build.mjs, bots/
test/       node tests for the sim (run with: npx tsx test/<file>.ts)
```

## Rules for every agent (read twice)

1. **Stay in your files.** You own the files named in your brief. Do not edit anyone else's file, the contract files (`sim/types.ts`, `sim/core.ts`, `sim/index.ts`, `data/ids.ts`, `data/schema.ts`, `render/api.ts`, `render/palette.ts`, `ui/api.ts`, `ui/kit.ts`, `ui/css/base.ts`, `word/api.ts`, `audio/api.ts`), or `package.json`. Many agents are working in this tree at the same moment. If a contract is wrong or missing something you truly need, do not change it: work around it locally and say so clearly in your final report under "CONTRACT REQUESTS".
2. **Keep every exported signature that already exists in your files** (other modules import them). You may add exports.
3. **Other modules may still be stubs that throw.** Never "fix" them. For tests, build what you need from `src/dev/fixture.ts` or your own small mocks.
4. **Typecheck only your paths:** `node tools/check.mjs src/your/path`. It prints only your errors. Zero errors in your paths before you finish. Errors elsewhere are not yours.
5. **The machine has 2 cores and is shared.** Do not run `npm install`, dev servers, watchers, or anything long-lived. Do not run more than one heavy command at a time. Screenshots and typechecks queue behind a lock; be patient, and do not take more than about 15 screenshots in total.
6. **No new dependencies.** Only `three` (0.170) at runtime. No fonts or assets fetched at runtime except Google Fonts in index.html. No image, audio or model files: everything is drawn or synthesised in code.
7. **Player-facing text follows docs/STYLE.md.** No em dashes. The name is `LandLord`.
8. **No real personal data, no credentials, no hostnames or project identifiers in the repository.** This is a public repo.
9. **Finish.** No TODOs, no "left as an exercise". If you cannot finish something, cut it cleanly and say so in the report.
10. **Final report** (your last message, plain text, under 300 words): what you built, what you verified and how (what you actually observed), known gaps, and CONTRACT REQUESTS if any. Do not paste code.

## Tools

- `node tools/check.mjs <paths...>` typecheck, filtered to your paths.
- `node tools/shot.mjs <entry.ts> <out.png> [--w 1280 --h 800 --wait 1500 --eval "js" --shots N --every ms]` bundles an entry into a blank page (`<div id="app"><canvas id="c">`) and screenshots it in headless Chromium with software WebGL (slow: expect 15 to 30 fps and a few seconds per shot). Put dev entries in `src/dev/` with a name unique to you. Write images to `.tmp/<your-name>-*.png`, then **look at them with the Read tool** and fix what you see. A screenshot you did not look at proves nothing.
- `npx tsx <file.ts>` runs TypeScript in node (sim tests, generators, bots).
- `src/dev/fixture.ts`: `makeFixtureState('reeve' | 'knight' | 'baron')` returns a busy hand-built GameState; `fakeSim(state)` is a SimLike that accepts every action.

## Sim: how the pieces interlock

`Sim.step(realSeconds)` advances `state.day` in ticks of at most 0.25 day and calls, for each module in order `world, buildings, actors, jobs, economy, tenants, rent, renown, staff, incidents, orders, oaths, rank, rival, modes`: `step(s, dtDays)`, then on each whole day `onDay(s, day)`, and on the 1st of a month `onMonth(s, monthIndex)` (after that day's `onDay`). `init(s)` runs once per new game in the same order. Modules export one `SimModule` object (already declared in each file) and put action handlers in its `handlers`. Each `Action` type has exactly one handler; ownership below.

**State ownership** (only the owner writes; everyone reads):

| Owner | Fields | Actions handled |
|---|---|---|
| world/buildings (sim-world) | `map`, `buildings` (all fields incl. `units[].listed/purse` creation, `condition`, `visuals`, `squatters`, `flags`) | place_building, demolish, upgrade_building, rename_building, place_road, remove_road, clear_tile, buy_parcel, set_listed |
| actors/jobs (sim-world) | `actors`, `jobs` | order_job, cancel_job, go_to, collect_purse, collect_all |
| economy (sim-people) | `gold`, `ledger`, `stats.rentCollected/peakRentRoll` | set_rent, gift, hold_feast |
| tenants/rent (sim-people) | `tenants`, `applicants`, `units[].tenantId/vacantSince/purse/purseDay` | reveal_trait, remember |
| renown (sim-people) | `renown`, `favor` | |
| staff (sim-rule) | `staff`, `candidates` | hire, dismiss_staff, set_wage, refresh_candidates |
| incidents/effects (sim-rule) | `incidents`, `incidentLog`, `pending`, `weather` | resolve_incident, dismiss_incident |
| orders (sim-rule) | `orders`, `policies` | add_order, revoke_order, set_policy |
| oaths (sim-rule) | `oaths`, `stats.oaths*` | swear_oath, release_oath |
| rank (sim-rule) | `realm.rank`, `charter` | accept_promotion |
| rival (sim-rule) | `rival` | |
| modes (sim-rule) | `loans`, `ended`, `stats.daysInDebt` | take_loan, repay_loan, abdicate, set_speed, mark_seen, set_flag |

When you need to change something you do not own, call the owner's exported function (signatures are already in the stub files with doc comments). When you need a new cross-module function, add it to *your* file and report it.

**New game (`init`, in module order).** world: `createMap` (seeded terrain; parcels; parcel 5 owned; a gate where the road enters). buildings: place the seat (level 1) and **three hovels** in parcel 5, one of them shabby (condition about 35) and vacant. actors: the ruler's figure at the seat door. economy: `gold = BAL.startGold`, open the first month book. tenants: two starting households in two of the hovels, with leases. staff: roll candidates (none hireable until Knight). incidents: schedule the first scripted beats (below). rank: charter goals for Reeve. rival: roll the rival. realm name from `REALM_NAMES` if blank. Finish with a Crown herald line using `RANKS.reeve.proclamation`.

**Jobs and actors (sim-world).** `enqueueJob` queues work at a location. Each tick the job system assigns queued jobs to a free actor who may take them: `role` is a StaffRole (that delegate), `'ruler'` (the ruler's figure), or `'any'` (the matching delegate if one exists and is free, else the ruler). At Reeve rank there are no delegates, so **the ruler does every job**; jobs with a staff role and no such delegate fall to the ruler automatically (at Reeve, a 'mason' job is the Reeve with a hammer). The actor walks (A* over the grid, faster on roads), then works for `workDays` divided by skill and temperament speed; `cost` is charged through `economy.spend` when work starts (if unaffordable in Iron Crown it still proceeds; debt is modes' business). On completion: `state = 'done'`, emit `{type:'job', phase:'done'}`, call `core.notifyJobDone(s, job)` exactly once; each module's `onJobDone` reacts to the kinds it cares about:
- `build`, `repair`, `renovate`, `demolish`, `clear_land` → buildings.
- `collect` → rent (purse into coffers). `show`, `screen`, `serve_notice`, `evict`, `inspect` → rent/tenants.
- `incident` → incidents (apply the chosen outcome's effects).
- `visit` → tenants (a personal call from the ruler: small happiness lift, may reveal a trait).
Higher `priority` first, then oldest. `byRuler` jobs are never auto-cancelled. Walking adds `wear` to tiles (cosmetic desire paths).

**Rent Day (sim-people).** On the 1st each housed household decides to pay (reliability, happiness, traits, rent against income, any `stocks` nearby). Payers are spread over days 1 to 3.
- No Steward with a ready Counting House: the rent becomes a **purse** on the unit (`unit.purse`, event `purse`). Someone must collect it (`collect_purse` / `collect_all` queue `collect` jobs: role 'bailiff', which falls to the ruler when there is no Bailiff). With a Bailiff, collect jobs are queued automatically. A purse older than `BAL.purseDays` is spent by the household: it becomes arrears and they are *not* at fault (no fee may be charged without a happiness hit).
- Steward + Counting House: rent goes straight to the coffers (`rent_paid`), no purse.
- Non-payers: after `policies.graceDays` the household is `late` and rent.ts calls `incidents.spawnDecision(s, 'late_rent', { tenantId })`. The chosen outcome's effects come back through `rent.applyLateOption`. `notice` starts the court clock (`BAL.courtDays`); when it runs out rent.ts spawns `eviction_ready`. `evict` enqueues the Bailiff's eviction job, then `rent.evict` on completion.
- Leases end after `termMonths`: spawn `rent_renewal`. Unhappy or overcharged households give notice and leave instead. On any departure with a deposit held: an `inspect` job, then `spawnDecision(s, 'move_out_deposit', ...)`; the outcome returns through `rent.applyDeposit` (keepPct -1 means keep exactly the damage cost).
- Vacancies: listed units attract applicants at a rate driven by renown, desirability against asking rent, a Crier, a notice board. `tenants.spawnApplicant` puts their actor at the gate walking to the door. Someone must `show` the unit (role 'crier', falls to the ruler). Then `spawnDecision(s, 'applicant', { applicantId, buildingId, unit })`; the outcome returns through `rent.applyLease` / `rent.screen`.
- Empty more than 40 days and not listed-and-shown recently: chance of `spawnDecision(s, 'squatters', { buildingId, unit })`.

**Incidents (sim-rule).** `spawnIncident` creates the instance, fills `vars` from `core.baseVars` plus the def's needs, sets `expiresDay`, adds the def's `visual` to the building, sends the herald line, and for `audience: true` spawns a petitioner actor who walks to the seat door and waits (state 'waiting'). Then it asks `orders.decide(s, inc)`: if an order or a delegate with authority settles it, resolve at once and herald what they did (`reported`). Otherwise it waits for the ruler (`resolve_incident`). `resolveIncident` either applies the outcome's effects now, or, when the outcome has a `job`, enqueues an `incident` job and applies them in `onJobDone`. Effects are applied by `effects.applyEffects`, which calls the owners (`economy.earn/spend`, `tenants.changeHappiness`, `rent.applyLateOption`, `buildings.damageBuilding`...). On resolve/expire: remove the visual unless the effects say otherwise, despawn the petitioner (walks back home), herald the `result` / `expireText`, emit events, bump stats.
The random scheduler (monthly budget from `BAL.incidentRate`, spread across the month) picks defs that are not `system`, fit the rank and season, are off cooldown, and whose `requires` fit some target; weight by `weight`. Never more than about 6 open at once at Baron (3 at Reeve).
Scripted first beats for a new reign: day 2 a leak at an occupied hovel (teaches repair); around day 12 an applicant for the vacant hovel if it is listed; month 2 the first audience.

**Deciding without the ruler (sim-rule, `orders.decide`).** Gather standing orders matching the incident (`decision` type and/or `incidentDef`, all `when` conditions true for the context). `never` rules strike options. A `choose` rule picks its option/outcome (most specific first, then newest). If none chooses: is there a delegate whose domain this is (repair → mason; late_rent, eviction_ready, squatters → bailiff; applicant → crier; move_out_deposit, rent_renewal, pet → steward) with enough `authority`? Authority 0 handles only *routine dispatch* (non-audience incidents: their default outcome, or temperament `bias`); authority 1+ also settles audience incidents by temperament bias. Otherwise return null: it waits for the ruler. Staff gain authority 1 when the ruler becomes Baron.

**Rank (sim-rule).** Recompute charter goals daily. When all are met: `charter.ready`, herald, event `charter_ready`; `accept_promotion` raises the rank, upgrades the seat, unlocks, re-rolls candidates, sets new goals, emits `promotion`. 

**Modes (sim-rule).** Tribute due on the 1st of months 0, 3, 6, 9 (`RANKS[rank].tribute`), paid automatically if affordable, else favor falls. Negative gold converts to a loan from the moneylender (up to the rank's cap) with a herald; interest monthly. Peace: debt past the cap for three months → demotion (never below Reeve) with debts cleared. Iron: debt past `cap * BAL.bankruptcyMult`, or favor at 0, ends the reign (`ended`, event `game_over`).

## Events

The sim announces what happened through `core.emit` (`SimEvent`). Render, UI and audio react to events and otherwise read state. **Emit generously**: every visible change should have an event (see the union in `sim/types.ts`). Use `core.herald(s, kind, text, refs)` for the feed.

## The word layer

`word/` builds a compact digest of the state, the action vocabulary, the listener's temperament and voice, and the ruler's words; asks the model for strict JSON; validates every proposed Action against the sim (`dispatch` returns refusals with an in-world reason); and returns an `Exchange` with the delegate's read-back. Transport order: `POST /api/word` (deployed Worker), `window.claude.use('sample')` (inside a Claude artifact viewer), offline parser. The game must be fully playable offline.

## Deployment shape

`npm run build` → `dist/index.html`, `dist/game.js`. `src/server/worker.ts` serves `dist` as static assets and implements `GET /api/court` (capabilities) and `POST /api/word` (model proxy; key in a Worker secret, never in the repo; rate-limited; origin-checked). `wrangler.jsonc` ships disarmed: no route, no account values.
