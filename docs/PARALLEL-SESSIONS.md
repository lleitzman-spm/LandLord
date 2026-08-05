# Working in parallel — the multi-session doctrine

*How to run several Claude sessions at once — within a project and across all of them — and accomplish
more without stepping on your own work. **Portable:** this doc is written to drop into any repo's `docs/`
with a one-line pointer in its `CLAUDE.md` (the way `K3-PROFILE.md` was meant to propagate). Drafted
2026-07-21 (Edwin's ratified choice: a full coordination doctrine + a control tower).*

## The one idea

**Run many sessions; coordinate through the repo's own docs, never through memory.** A session is a
worker; the repo is the shared desk. The reason parallel sessions are *safe* is the same reason a
distributed team is: the coordinating state lives in files everyone reads and writes on a discipline —
not in any one worker's head. LandLord already proved this: `HANDOFF.md` + `KINGDOM.md` are a durable,
async, shared-state substrate. Every session ends by refreshing HANDOFF; every session starts by trusting
it. That habit *is* the concurrency primitive.

## Two modes, very different cost

1. **Cross-project — free, do it today.** Different repos are independent by construction: zero
   coordination, zero collision. Run sessions on unrelated repositories simultaneously. They touch only at deliberate handoff points (a recon scrape, a shared setting). The only
   discipline: **each project's HANDOFF is its own single source of truth.** This is the immediate win —
   take it before any of the machinery below.

2. **Same-project — needs light coordination via LANES.** Two sessions on one repo. The only real risk is
   two lanes editing the same file, or both touching a shared fragile core (the consequence engine / the
   fail state — swing 5 taught how one seam ripples). Solve it with lanes.

## Lanes — the same-project unit

**A lane = a branch + an owned surface + a HANDOFF section.**

- **Branch.** Each session works on its own branch (the harness assigns one per session). Never two
  sessions on one branch.
- **Owned surface.** A lane declares the files / pillars it owns, in HANDOFF. **A lane edits only its own
  surface.** Boundaries follow the pillar seams — in LandLord: *economy* (`src/domain/economy.ts`,
  `treasury.ts` coffers), *clerk-fleet* (`harness/`), *task-language* (`catalog.ts`, `flows.ts`,
  `data/library/`), *HUD* (`WarTableView.tsx` + `App.css`), *domain-core* (the readings). These barely
  overlap.
- **HANDOFF section.** Each active lane keeps its own START-HERE / status block, so a lane's state is
  legible to the others and to its own next session.
- **Worktrees for isolation.** `git worktree` (or the Agent tool's `isolation: "worktree"`) gives each
  session a separate working directory on the same repo — no file stomping even mid-edit.

**Shared hotspots.** Some files resist clean ownership — a big view file (`WarTableView.tsx`), a shared
type, the store. Name them explicitly in the lanes table and **serialize** edits to them (one lane at a
time) or split them by clearly-scoped regions. When in doubt, keep a lane's work in *domain* files (data
+ readings) where ownership is clean, and touch the shared view last.

## Merge discipline

- **Rebase on main before you merge; fast-forward main on clear** (the existing auto-deploy rule). Small,
  frequent, clearly-messaged commits (already the house rule) keep the conflict surface tiny.
- If two lanes did touch the same file, the **second to merge rebases and resolves** — cheap when commits
  are small and surfaces were declared.
- A lane never force-pushes another lane's branch.

## What parallelizes WELL vs BADLY

| Parallelizes WELL | Parallelizes BADLY (serialize instead) |
|---|---|
| Independent pillars (economy vs fleet) | Two lanes on the same file / same refactor |
| Independent repos (cross-project) | Two lanes on the shared fail-state / fragile core |
| Additive domain layers, new readings | Lane A's output is lane B's input (a dependency) |
| Docs, greenfield artifacts, harness work | A rename that ripples across everyone's surface |

## The session ritual (every parallel session)

1. **Start:** read HANDOFF; find or claim your lane; note its owned surface; confirm your branch.
2. **Work:** stay inside your surface; small commits; verify; fast-forward main on clear.
3. **End:** refresh your lane's HANDOFF section (state, what's next, any handoff to another lane). If you
   produced something another lane needs, say so explicitly in *their* section too.

## The control tower — GitHub-native (a lane *is* a branch)

Don't stand up a separate board (Trello, etc.) to mirror the work — a second system goes stale the moment
someone skips the update, and a stale tower is worse than none. The coordination lives **where the work
lives: GitHub.** A lane is literally a branch, so the tower is already half-built.

- **Per-project view (the primary):** the **HANDOFF LANES table** — versioned, in-repo, read by every
  session at start. This is where a session claims a lane and sees what's live in *this* project. It is
  the source of truth.
- **Cross-project view:** **open PRs (or active branches) across your repos + each repo's HANDOFF table.**
  To see everything running everywhere, list open PRs and non-`main` branches across repos — each active
  lane has one — then open the matching repo's HANDOFF for the detail. No artifact to maintain; the
  branches/PRs *are* the state. *(Repos that use PRs signal a lane with an open/draft PR; repos that push
  straight to `main` — like LandLord, whose law forbids PRs — signal a lane with its live working branch.
  Either way the branch is the tell.)*
- **Optional visual pane (only if you actually want a dashboard):** a **GitHub Projects** board at the org
  level — it natively spans repos and its cards *are* the PRs/issues, so status stays in sync
  automatically. Stand this up only when open-PRs-plus-HANDOFF stops being enough; don't pre-build it.

Ratified (Edwin, 2026-07-21): **use open-PRs-(or-branches)-plus-HANDOFF; no Trello, no board to babysit.**
Keep a lane's working branch (and a draft PR where the repo uses PRs) alive while it's active so it shows
in the cross-project view; the HANDOFF LANES row carries the detail.

## Cross-project, at scale

- Drop this doc in every repo's `docs/`; add one line in each `CLAUDE.md`: *"Running more than one session?
  See `docs/PARALLEL-SESSIONS.md`."*
- Each project declares its own lanes + ownership map (its **HANDOFF LANES table**).
- The cross-project tower is not a separate artifact — it is the **union of open PRs + the per-repo HANDOFF
  tables**, queried when you need the whole-portfolio picture.

## Merge triggers — when two repos should become one

Two repos = two parallel lanes = more throughput; **that advantage is worth keeping** until the
coordination cost of split repos exceeds it. So make merging a *decision*, not a drift: write the concrete
trigger. Keep unrelated repositories separate until there is a concrete reason to merge them,
and write the reason down when there is.
## Anti-patterns (the ways this breaks)

- **Skipping the HANDOFF refresh** — the substrate goes stale and the next session flies blind. This is
  the cardinal sin; it breaks the whole model.
- **Two lanes silently editing one file** — declare surfaces, or serialize.
- **A lane depending on another lane's in-flight output** — serialize those; parallel only the independent.
- **No control tower** — you lose track of what's live and double-book a surface.
