# The harness — the agent's body

The body from `AGENTS.md`: the loop that wraps a brain (Kimi K3 by default) in a
tool-belt and turns "a task" into committed work on a branch, ready for Claude's
review. Brain-agnostic and dependency-free (plain `fetch`); the brain is chosen
by environment (`MOONSHOT_MODEL`), the key never touches git.

The **same body serves two roles**: the **builder** (the K3 file/shell belt —
`tools.mjs` + `loop.mjs` + `run.mjs`) and the **operator** (swing four — a small
domain belt, `operator-tools.mjs` + `operate.mjs`). The operator is not the
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
- `operator-tools.mjs` — the two-tool belt: `readLog()` / `appendEvents(events)`,
  operating directly on `data/chronicle.json` (the file the vite plugin serves).
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

## Built so far

- `config.mjs` — brain + endpoint from env (key never in git).
- `moonshot.mjs` — one chat call, quirks handled (temperature retry, high effort).
- `selftest.mjs` — proves the brain answers (`./harness/run.sh selftest.mjs`).
- **Builder:** `tools.mjs` (file/shell belt) + `loop.mjs` (agent loop, trims
  stale reads) + `run.mjs` (CLI: `./harness/run.sh run.mjs "a task" [--budget N]`).
- **Operator:** `operator-tools.mjs` (readLog/appendEvents) + `operate.mjs`
  (Mabel's clerk), on the bundled `dist-operator/operator-core.mjs`.
