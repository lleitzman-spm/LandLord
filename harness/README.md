# The harness — the agent's body

The body from `AGENTS.md`: the loop that wraps a brain (Kimi K3 by default) in a
tool-belt and turns "a task" into committed work on a branch, ready for Claude's
review. Brain-agnostic and dependency-free (plain `fetch`); the brain is chosen
by environment (`MOONSHOT_MODEL`), the key never touches git.

The **same body serves two roles**: the **builder** (the K3 file/shell belt —
`tools.mjs` + `loop.mjs` + `run.mjs`) and the **operator** (swing four — a small
domain belt via the rig's backings + `operate.mjs`). The operator is not the
builder: it reads the event log and appends events, nothing more.

## Running it

**Normal environment** (Edwin's machine, a plain VM) — direct, no proxy:

```
export MOONSHOT_API_KEY=...        # from platform.moonshot.ai; never commit it
node harness/selftest.mjs
```

**Inside a Claude Code container** — outbound HTTPS goes through the agent proxy,
and Node's `fetch` must be told to use it. The launcher sets the two switches:

```
./harness/run.sh selftest.mjs
```

(Why: `/root/.ccr/README.md` — `NODE_USE_ENV_PROXY=1` makes fetch use the proxy,
`NODE_EXTRA_CA_CERTS` trusts its re-terminated TLS. The proxy already allows
`api.moonshot.ai`; the egress firewall on the direct path does not, which is why
the switches matter.)

## The operator agent (swing four — prove ONE clerk)

Mabel's clerk: identifies an aging raw-intake maintenance WO on the War Game's
**simulated** data down the catalog tree to a leaf, triggers + advances its
vendor-dispatch cascade through the **real** flow engine, and STOPS at the
judgment step — a `proposed` by `agent:mabel`, the case `awaiting` for the
Steward. Human-in-the-loop always; it never self-approves.

```
npm run build:operator                 # bundle the pure engine → dist-operator/
# deploy a War Game / grand muster in the app first (it loads catalog+flows+wg work)
./harness/run.sh operate.mjs [count]    # count defaults to 1
git checkout -- data/chronicle.json     # working fluid — restore after a test
```

- `operator-core.ts` (in `src/`) re-exports the pure domain engine; `build:operator`
  bundles it so the raw-Node harness can `import` it (no tsx; the domain's
  extensionless imports won't strip-type). The agent grips EXACTLY the app's
  primitives, so `readFlows` renders its work identically to a human's.
- the two-tool belt — `readLog()` / `appendEvents(events)` on
  `data/chronicle.json` (the file the vite plugin serves), now supplied by
  `agents/rig.mjs`'s `fileBacking()`. The standalone `operator-tools.mjs` that
  used to hold it was retired once `fleet.mjs` and `operate.mjs` both moved to
  the backing: they had carried two hand-copies of the same "is a game
  standing" guard, which is two chances to drift.
- `operate.mjs` — the loop. Brain: a cheap Kimi (`kimi-k2.7-code-highspeed` by
  default; a non-k3 `MOONSHOT_MODEL` overrides). Not k3, not Fable — the
  bounded-procedural lane.

## What K3 taught us (baked into `moonshot.mjs`)

- `temperature` must be exactly **1** for the kimi reasoners — not just `kimi-k3`
  but the cheaper `kimi-k2.*` code models too (verified 2026-07-20). `complete`
  now omits temperature unless a caller sets one, and retries pinned to 1 if the
  model refuses — no caller need know which models are strict.
- `kimi-k3` is a **heavy reasoner**: it spends most of its token budget *thinking*
  (`usage.completion_tokens_details.reasoning_tokens`) before it emits a word. Too
  small a `max_tokens` returns empty content — the reasoning ate it. Budgets must
  be generous.
- `reasoning_effort: 'high'` is set (CLAUDE.md, "The megamind") — **never** the default
  `max`, which wanders and burns the whole budget. At `high`, "pong" reasons ~20 tokens;
  at the default it ran to ~390. The single biggest cost lever.
- Models the key can see: `kimi-k3` (flagship reasoner), `kimi-k2.6`,
  `kimi-k2.7-code`, `kimi-k2.7-code-highspeed` (code-tuned — likely the cheaper
  right brain for a *builder*; try once the loop works).

## The agent rig — construction separate from deployment

`harness/agents/rig.mjs` is the seam WRIT-THE-KNIGHTHOOD's "agents are built
like game assets" cashes out to: `buildAgent(spec)` turns a `roster.mjs`
entry into a plain, frozen descriptor that touches no file, no shell, no
war-game seed — only `deploy(agent, backing, {...})` binds a **backing** and
hands the agent a **belt** scoped to exactly the capability tags its manifest
declares (`CAPABILITY_CORE_FNS`). No belt, on any tag, ever grants
`approveStep`/`overrideStep`/a money door — those names are simply absent
from the vocabulary, the same defence the money door already stood on.

Two backings satisfy the one interface (`readLog()` / `appendEvents(events)`,
the shape `operator-tools.mjs` settled on before it was retired into it):

- `fileBacking()` — `data/chronicle.json` on disk, the live simulator.
  Refuses to open a document with no standing War Game (the check
  `fleet.mjs` used to `process.exit(1)` on now belongs to the one backing
  that can reach real disk state).
- `memoryBacking(doc)` — an in-process document. No disk, no war-game
  requirement — for fixtures, the viewer, and tests. A live-graph backing
  ("the operating records ... live elsewhere") is future, behind the data
  gate (`docs/WRIT-THE-GATE.md`); this is the seam it would implement.

`run(agent, backing, {...})` deploys and lets the agent do its one bounded
pass through the SAME judgment code the fleet already runs
(`harness/clerks.mjs` and the desk modules) — the rig changes how an agent is
built and where it reads/writes, not what it decides.

**Three refusals, each naming its own cause.** `BackingRefusal` (no standing
War Game on the file backing), `BeltRefusal` (the belt is too narrow for the
judgment — named before the run, rather than surfacing as a `TypeError` on
some domain function partway through), and `NoSuchGrammar` (the judgment grips
a flow book this repo does not ship). Each judgment declares the tags it
`requires`, and `test/rig.test.ts` scans the clerk modules to fail if that
declaration ever drifts from what the code actually reads.

**Eight of the ten named agents are wired and driven.** Ross and Dara are not:
their only commitments live in the grand-muster library loaded at deploy time,
not in the founding book, so there is nothing here for them to work on. They
refuse with the reason rather than appearing merely unimplemented.

## The viewer — one work order in, watch it reason

```
./harness/run.sh viewer.mjs [Mace|Milo|Mira|Lena|Rhys|Tess|Nell|Bea|all]
```

A standalone runner: no React, no board. It deploys a named agent against a
`memoryBacking()` seeded from a fixture (`harness/agents/fixtures.mjs`),
prints the agent's manifest card, its reasoning trace, and exactly where it
stops — the last event it wrote, and why no further event can follow it
without a human. Nothing it does touches `data/chronicle.json`. Works with
`MOONSHOT_API_KEY` unset (every named agent falls back to its deterministic
Tier-0 path) or set (real brain calls, same as the fleet).

## Fixtures — realistically-shaped work orders

`harness/agents/fixtures.mjs` builds three stages of ONE work order's life —
`rawIntakeFixture()` (before Mace), `vendorCommitmentFixture()` (before
Milo), `settlementFixture()` (before Mira) — plus **`atStepFixture()`**, the
general form that parks a case at any named step of any founding flow, which
is how every agent past the M family gets a fixture without a bespoke builder.
It **refuses** a flow or step the book does not have, because a fixture that
quietly lands on the wrong step tests the wrong judgment and still goes green.

All of it runs through the REAL flow engine
(`instantiateFlow`/`completeStep`), never a hand-typed event array, off a
frozen snapshot of the founding catalog + flow book
(`fixtures/founding-book.json`) rather than the live, mutable
`data/chronicle.json`.

One thing worth knowing when adding a fixture: the desk clerks gate on
`step.holder === commit.holder`, so a fixture must match the **holder** the
founding book seats that step with, not merely the step key. A step-key-only
match looks reachable and then finds no work.

## Built so far

- `config.mjs` — brain + endpoint from env (key never in git).
- `moonshot.mjs` — one chat call, quirks handled (temperature retry, high effort).
- `selftest.mjs` — proves the brain answers (`./harness/run.sh selftest.mjs`).
- **Builder:** `tools.mjs` (file/shell belt) + `loop.mjs` (agent loop, trims
  stale reads) + `run.mjs` (CLI: `./harness/run.sh run.mjs "a task" [--budget N]`).
- **Operator:** `operate.mjs` (Mabel's clerk) on the bundled
  `dist-operator/operator-core.mjs`, reading and writing through the rig's
  `fileBacking()`.
- **The fleet:** `agents/roster.mjs` (ten named agents, four axes) +
  `brain-doctrine.mjs` (which brain per seat) + `clerks.mjs`/`run-fleet.mjs`
  (the judgments) + `fleet.mjs` (the live runner, `data/chronicle.json`).
- **The rig:** `agents/rig.mjs` (construction/deployment, capability-scoped
  belts, two backings) + `agents/fixtures.mjs` (realistic work orders) +
  `viewer.mjs` (a standalone runner — see above).
