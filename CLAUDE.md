# Working in LandLord

Guidance for an AI agent working in this repository. It is a public,
open-source codebase; everything here is craft, not house politics.

**Read `docs/KINGDOM.md` first** — it is the constitution. The code implements
it, and it wins until amended. Per-surface design documents are `docs/WRIT-*.md`.
`CONTRIBUTING.md` holds the human-facing version of most of this.

**Then read `book/memory/`** — three short hand-written notes, and the only place
a human leaves word for you between sessions. `open-questions` is what is waiting
on a ruling; `learned` is what already cost somebody something to find out. It
takes a minute and it is the difference between picking up and starting over.
Everything else under `book/` is compiled and will be overwritten; that shelf is
not, so **never edit a generated page** — find its source, fix that, recompile.

## The rule that overrides everything

**No real personal data and no credential may ever enter this repository.** Not
in code, not in a fixture, not in a comment, not in a commit message. If a task
would put a real name, address, e-mail, telephone number, API key, database URL,
project identifier or one company's real commercial terms into the tree —
**stop and say so** rather than finding a way. Use the demo cast, `example.com`
addresses and `555-01xx` telephone numbers.

`npm run leakcheck` scans for the shapes of these things and runs first in CI.
Run it before you call anything done. If it flags you, fix the file, never the
scanner.

**Verify claims against the bytes.** A comment saying a value is a placeholder,
a doc saying a file is gitignored, a header saying something was redacted, a
constant named `EXAMPLE_` — none of these are evidence. This codebase's ancestor
asserted its own hygiene incorrectly more than once. When a file makes a claim
about its own contents, check it.

## The conventions

- **The name is `LandLord`** — one word, two capitals. Never "Landlord",
  "landlord" or "Land Lord". The inner capital is load-bearing and holds
  everywhere: code, comments, commits, docs, UI copy, prose.
- **The voice.** Comments, commit messages and docs use plain-English medieval
  register — recognisable words, never glossary flavour (*mayor*, not *reeve*).
  Clarity beats flavour. Comments explain **why**; the code says what.
- **Records in, readings out.** State is computed from records, never stored.
  Reach for a status field and stop — the status is a reading, and storing it
  creates a second source of truth that will drift. Removal of a record **is**
  revocation. The event log is append-only; a correction is a reversing event,
  never an edit. Missing books in a chronicle adopt their founding state from
  `src/domain/census.ts` (see `normalizeChronicle`).
- **Data is working fluid.** `data/chronicle.json` exists to exercise the
  machine, not to mirror anything real. Never "fix" it toward reality; never
  treat a red flag in it as a to-do. Tests may mutate freely — restore with
  `git checkout -- data/chronicle.json`.
- **Configuration, not constants.** This is software for property-management
  companies generally. No single firm's fee rates, caps, thresholds or org chart
  may be compiled in. Anything a deployment would set differently goes through
  the tenant setting (`src/domain/economySetting.ts`) with a clearly-labelled
  demo default. If a behaviour can only be justified by pointing at one
  company's practice, it is probably wrong for a product — write it up in
  `docs/OPEN-QUESTIONS.md` instead of shipping it quietly.

## Verify function end to end

`npm run build` must stay green and `npm test` must stay green — both, before
anything is called done.

A feature that touches a surface gets **driven in a real browser**, not merely
unit-tested. A passing test is not a working button. `playwright-core` is a dev
dependency; run the app with `npm run dev` and drive it. Kill dev servers with a
self-safe pattern (`pkill -f '[v]ite --port 5199'`, note the bracket).

Report what you actually observed, not what should have happened. "Placed an
owner and the debt count dropped from 7 to 6" is worth more than "verified".

## The A/E/P check — run it on every surface you touch

Named because these three kept recurring. Walk the surface and answer all three;
say in the commit that you did.

- **A — Accessibility.** Can it be reached and operated at all? Is every row
  that *names* a thing a door to that thing? Anything clickable-looking that
  isn't, or clickable that leads nowhere? Keyboard-reachable, labelled, and no
  control whose only feedback is invisible — a `scrollIntoView` onto something
  already on screen is a dead button.
- **E — Efficiency.** How many clicks from seeing the thing to doing the thing?
  A surface that reports a state and makes you navigate elsewhere to change it
  has failed.
- **P — Proximity of information to action.** The act stands beside the record
  it changes (design law 6). A count with no road, a proposal you can read but
  not ratify, a vacancy with no seat form on the same line — all the same fault.

Every one of these has shipped at least once.

## Working with other agents

If you delegate part of a build, **the review gate never lifts**: a builder's
output is counsel, not command. Read the whole diff and drive it yourself before
it is law. Never blind-copy a generated file over the current tree — take the
diff, three-way merge it (`git apply -3`), resolve, then re-run the full suite.

An agent given access to any live surface must be told that read-only means
**GET only**. That is not paranoia: an audit agent once fired a live `DELETE` at
an API as a probe.

Pick the model for the task rather than by habit, and say in one line why when
it is not obvious.

## Layout

| Path | What lives there |
|---|---|
| `src/domain/` | The model — pure functions over records. No React, no I/O. |
| `src/` | React surfaces; `WarTableView.tsx` is the landing board. |
| `src/table/`, `src/realm/` | Board rendering: the flat 2D map, and a retired 3D scene behind the same `Relief` interface. |
| `src/store/` | The chronicle store — reads, acts, merge. |
| `src/server/`, `src/worker.ts` | Vault seam, identity verification, the deployed Worker. |
| `harness/` | The clerk fleet: one module per seat, the brain policy, the deterministic fallbacks. |
| `data/` | Demo-tenant seed data and the general PM reference library. |
| `docs/` | The constitution and the per-surface writs. |
| `tools/` | Standalone scripts: terrain baker, Book compiler, leak scanner. |
| `test/` | Vitest. |

## Things that will bite you

- **Writes are whole-document upserts — last writer wins.** Concurrent editors
  lose each other's work. Read `src/store/chronicleMerge.ts` before adding any
  outside writer.
- **There is no multi-tenancy.** Per-identity vault rows are a sandbox, not
  tenant isolation. Do not describe them as isolation.
- **`Relief` (`src/table/relief.ts`) and `RealmReading` (`src/domain/realm.ts`)
  are different things** that share five letters. One is a place, one is a
  score. Neither was renamed, deliberately — a rename is a migration on every
  stored document.
- **A flow's step events are placed by their `Step n/N` marker**, not by holder
  order. Matching by holder collapses consecutive same-holder steps, which once
  made an entire half of the vendor-dispatch loop unreachable.
- **The land is generated, and generated land may never be presented as a
  finding.** A gap, cluster or coverage wash drawn on invented terrain says
  nothing true about drive time or concentration risk. The doors carry the data;
  the ground is scenery.
