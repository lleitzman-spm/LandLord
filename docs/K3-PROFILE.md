# Kimi K3 — capability profile & how to wield it

*Written to be portable — it drops into any repository unchanged.
Written plain on purpose so it drops into any repo. Snapshot **2026-07-19**, pulled from
OpenRouter (Artificial Analysis indices + Design Arena). Models move — re-pull to refresh.*

> **This is the K3-specific deep-dive.** The whole-roster allocation doctrine — Opus · Fable ·
> K3 · Sonnet · Haiku, and which hand for which task — lives in `docs/MODEL-DOCTRINE.md`; read that
> first. Short version for K3: it is the **#1 greenfield artifact builder** but a foreign brain that
> **wanders on brownfield fidelity** (it invented an off-model world on the LandLord domain rebuild,
> 2026-07-20, and was discarded). Use it for isolated, throwaway/greenfield artifacts you will
> review hard — not for wiring into a constitution'd system (that is **Fable 5's** lane now).

## What K3 is

Moonshot AI's **Kimi K3**, released **2026-07-15**: a 2.8T-parameter open-weight multimodal
reasoning model, 1M-token context, strong at coding, knowledge work, and long-horizon agentic
tasks.

**Access it directly through Moonshot/Kimi** — model `kimi-k3`. Do **not** route the real work
through OpenRouter; OpenRouter is only for *looking up* model data like this card. Parameters for
real work: **`temperature: 1`**, **`reasoning_effort: "high"`** — *not* `max`, which wanders the
endless corridor and may not return. It is a heavy reasoner: budget output tokens generously
(even a trivial reply spends ~60 tokens of thinking).

## The numbers (vs the Claude models we run)

Artificial Analysis indices (higher = better):

| Model | Intelligence | Coding | Agentic | Out $/M |
|---|---|---|---|---|
| **Kimi K3** | 57.1 | 76.2 | 50.1 | **$15** |
| Claude Opus 4.8 | 55.7 | 74.3 | 47.2 | $25 |
| Claude Fable 5 | 59.9 | 76.5 | 52.8 | $50 |

Design Arena — head-to-head "build an artifact" tasks (models arena):

| Category | Kimi K3 | Opus 4.8 | Fable 5 |
|---|---|---|---|
| website | **#1** | #26 | #3 |
| dataviz | **#1** | #22 | #3 |
| 3d | **#1** | #25 | #2 |

## The seam — how to wield it

- **K3 blows out Opus at building/design artifacts** (frontend, dataviz, UI): top-ranked in the
  build arena while Opus sits in the low 20s — and ~40% cheaper per output token.
- On **raw reasoning** it is a **near-peer** to Opus (edges it slightly); a touch behind Fable 5.
- **Claude/Opus leads on agentic orchestration** — multi-step tool use, planning, driving a
  workflow. K3 isn't even benchmarked in the agents arena.

⟹ **Use K3 as the builder; use Claude (Opus) as the orchestrator and reviewer.** Not because K3
is weaker — because that is where each is strongest. K3 generates the artifact; Claude drives,
reviews the diff, and guards fit. This is the division the review flow already assumes.

**The caveat that the leaderboard cannot see:** those scores are *greenfield* ("build X from
scratch"). Real work in these repos is *brownfield* — extend an existing codebase under a written
constitution and voice. That is a different test. So **review K3's output for architecture and
house-fit, not merely "does it run."** One in-repo run showed K3 picking up the house voice
unprompted — encouraging, but a single data point.

## The megamind law (don't fritter it)

K3 is the building brain and the hardest-question brain. **Hoard the heavy, tangled work into one
well-staged writ and loose it once** — a great batch, or one knotted problem — never many little
errands. Its word is counsel, not command: weigh every finding before it becomes law.

## Cost quick-reference

K3: **$3/M** in · **$15/M** out · $0.30/M cache-read. Cheaper than Opus ($5 / $25) and well under
Fable 5 ($10 / $50). It is both the better-fitting *and* the cheaper choice for build work.

## To adopt this in another project

Drop this file into the repo's `docs/` and add one pointer line to that repo's `CLAUDE.md` or
`AGENTS.md` so a fresh session reads it:

> **The building brain.** How to wield Kimi K3 — capability profile, access, and the build-vs-
> orchestrate seam — lives in `docs/K3-PROFILE.md`. Read it before summoning K3.
