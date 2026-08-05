# ALLOWLIST — the migration ledger

*How this public repository was assembled: **allowlist, not scrub.** Nothing was copied
until it had been read and cleared. Every file in the source tree gets a row.*

**Source inventory pinned at commit `ddda41b`: 1,109 tracked files, 0 untracked.**
The source tree was live during this pass (another agent was working in it); this ledger
describes that snapshot. the private source repository was never modified.

## Counts — and they must match

| | Files |
|---|---|
| Source files (pinned inventory) | **1,109** |
| Rows in this ledger | **1,109** ✅ |
| — `CROSSED` (byte-for-byte) | 96 |
| — `CROSSED-MODIFIED` | 136 |
| — `BURN` | 877 |
| Files written fresh for this repo | 9 |
| **Files in the destination** | **241** = 232 crossed + 9 written fresh |

Two verdicts only. `CROSSED` (with or without modification) or `BURN`. Company-specific
material is already preserved in the company's own private repository, so nothing burned here
needed relocating and no burn row carries a justification paragraph.

## What "CROSSED-MODIFIED" means, by category

No real value appears anywhere in this ledger — categories only, never values.

| Category | What changed |
|---|---|
| **The cast** | The founding census named real staff. Eleven people replaced by a fictional cast — Harold, Edwin, Mabel, Osric, Alys, Piers, Marlowe, Thatch, Mason, Carver, Sterling — with every `id` kept a lowercase slug and every role, note and relationship structurally identical. Applied everywhere including tests and their expectations. Two further named humans in a comment example were replaced with invented ones (Bram, Osgood). |
| **E-mail addresses** | Every real address, including three personal consumer accounts belonging to third parties, removed. Replaced with addresses at reserved documentation domains (`example.com` / `.org` / `.net` / `.test`). The allowlist *concept* crosses; nobody's address does. |
| **Telephone numbers** | Replaced with numbers in the fiction-reserved `555-01xx` range, keeping digit length so the identity-guard tests still exercise the detector. |
| **Error-reporting ingest key** | Removed from the environment template; the workflow that hardcoded it twice more does not cross at all. |
| **Database project identifier** | Removed from the environment template, the deployment config, and the seal-check script — which hardcoded it as a constant *and* was wired to an npm script. The script's mechanism crosses; it now takes its target from the environment and refuses to run without one. The npm script was removed: a public repo must not ship a working "reach the private database" command. |
| **Identity-wall identifiers** | Team domain and audience tag removed from the deployment config; only placeholder text remains. |
| **Live hostname** | The deployment's hostname removed from config and tooling; the route is commented out entirely. |
| **The company** | Its name, trade name, locality, county, door counts, portfolio volumes, client, owner and vendor references removed. Where a comment justified a decision by pointing at that company's practice, the decision was rewritten to stand on its own merits, or moved to `docs/OPEN-QUESTIONS.md`. |
| **Sibling private projects** | Five named private repositories removed from docs, comments and doctrine files. |
| **Real geography** | The demo licensing jurisdiction (a real state, its real commission, and two real counties) replaced with an invented realm and shires. The board's coordinate frame — which was real longitude and latitude — was affinely remapped onto a unit box, preserving every layout exactly while removing every real coordinate; the `lon`/`lat` fields were renamed `x`/`y` so nothing implies otherwise. Five real watercourses renamed and re-plotted. |
| **Commercial terms** | The management fee rate and its legacy tiers, the renewal rate, the leasing fee, the late-fee split, the grace period, the house spend cap and four per-property cap values, and one operational volume figure. **These were not merely swapped for other constants — they were treated as tenant configuration**, which the codebase already had a mechanism for (`src/domain/economySetting.ts`, `applyEconomySetting`). The seed values are now clearly-labelled demo defaults with a comment at the definition site saying so and pointing at the override path; structure and units are unchanged; the suite is green against the new values. |
| **Demo-tenant labelling** | The census, catalog and flow templates now carry an explicit header saying they are seed data for a fictional demo tenant, not anybody's org chart. |
| **Session/operational state** | Session-state references, live worker versions, and dangling links to burned documents cleaned up. |

## Terrain

`public/<county>-relief.bin` was real elevation data for a named county and **its own header carried
the coordinates**, so removing the filename would not have been enough. It is burned.

Its replacement, `public/fantasy-relief.bin`, is generated by `tools/bake-fantasy-relief.mjs` —
committed, dependency-free, seeded, deterministic (verified: two runs, identical MD5). Same byte
format, same 300 × 300 grid, same 180,024-byte length, so it is a drop-in for the loader. Its
header frames a unit box, not a place. The live 2D board never used the baked file at all — it
uses `src/table/fantasyRelief.ts`, which already satisfied the identical `Relief` interface
procedurally. Tests pass; the map renders.

## Deployment and CI

- `.github/workflows/deploy.yml` — **burned.** Replaced by `.github/workflows/ci.yml`: install,
  type-check, test, build — plus `leakcheck` as a **separate job that runs first with no
  dependencies installed**, on `push` *and* `pull_request`, so it still answers when the tree
  does not build and cannot be defeated by a dependency.
- `wrangler.jsonc` — crosses as a **disarmed template**: no route, `workers_dev: false`, no
  project ref, no wall identifiers, and a header explaining what a self-hoster fills in.
- `.env.example` — crosses as a **template**, every value a placeholder with a comment.

## The leak scanner

`tools/leakcheck.mjs` crosses unmodified, is wired into `package.json` as `npm run leakcheck`,
runs as the first CI job, and is documented in `CONTRIBUTING.md` and `SECURITY.md` — including
the rule that a secret which was ever committed must be **rotated**, because removing it from
the working tree does not remove it from a public history.

---

# VERIFICATION

## 1. `npm install`

```
$ npm install
added 246 packages
```
✅ Succeeds.

## 2. `npm run build`

```
$ npx tsc && npm run build
✓ 417 modules transformed.
✓ built in 288ms
```
✅ Green. Type-check clean.

## 3. `npm test`

```
$ npm test
 Test Files  34 passed (34)
      Tests  408 passed (408)
```
✅ Green — **408 tests**, the same count as the source tree. No test was deleted or skipped;
where a de-identification changed a value, the expectation was updated alongside it (including
three regenerated golden fingerprints of the money stream, which necessarily changed when the
demo fee schedule did).

## 4. The identifier grep — command and output

Three passes: tracked text, tracked binaries byte-level, and every tracked file binary-safe.

> [!important] The pattern this ran against is deliberately NOT reproduced here.
> An earlier draft of this section pasted the search expression verbatim. That meant this
> file — the one certifying that no identifier reaches the public repo — itself carried a
> complete, searchable list of every identifier being hidden: personal e-mail addresses,
> the database project reference, the identity-wall domain, and eleven real first names.
>
> A denylist committed to a public repository is not a record of a leak prevented. It
> **is** the leak, in its most convenient possible form, and every fork keeps a copy.
>
> So the expression lives outside this repository. What it covers, by category: the
> company's names and trading names, its city and county, its sibling private projects,
> the eleven real people in the founding data, personal and work e-mail addresses, the
> database project reference, the error-reporting ingest key and organisation id, the
> identity-wall team domain and audience tag, the deployment hostname, and telephone
> numbers outside the range reserved for fiction.
>
> To re-run it privately: write those categories out as regex alternates in a file you
> never commit, then run the three passes below unchanged. The check that DOES ship —
> `npm run leakcheck` — matches shapes rather than values, for exactly this reason, and is
> the continuous guard on every pull request.

```
$ cat verify.sh          # kept OUTSIDE the repository, never committed
set -u
cd /home/user/ll-public
PAT='<the categories above, written out as regex alternates>'
echo "### PASS 1 — tracked TEXT files"
git ls-files -z | xargs -0 grep -InE "$PAT" -- 2>/dev/null
echo "### PASS 2 — tracked BINARY files (grep -a, byte-level)"
git ls-files -z | xargs -0 file --mime -- 2>/dev/null | grep -v 'charset=us-ascii\|charset=utf-8' | cut -d: -f1 | while IFS= read -r f; do grep -aoE "$PAT" "$f" 2>/dev/null | sed "s|^|$f: |"; done
echo "### PASS 3 — every tracked file, binary-safe (grep -a, no -I)"
git ls-files -z | xargs -0 grep -anE "$PAT" -- 2>/dev/null
echo "### END — any output above this line is a finding"

$ bash verify.sh
### PASS 1 — tracked TEXT files
.env.example:43:TEAM_DOMAIN=https://<your-team>.cloudflareaccess.com
LICENSE:3:Copyright (c) 2026 <the owner's GitHub handle>
src/server/access.ts:10:  /** Full Access team origin, e.g. https://<your-team>.cloudflareaccess.com. */
### PASS 2 — tracked BINARY files (grep -a, byte-level)
### PASS 3 — every tracked file, binary-safe (grep -a, no -I)
.env.example:43:TEAM_DOMAIN=https://<your-team>.cloudflareaccess.com
LICENSE:3:Copyright (c) 2026 <the owner's GitHub handle>
src/server/access.ts:10:  /** Full Access team origin, e.g. https://<your-team>.cloudflareaccess.com. */
### END — any output above this line is a finding
```

**Three hits, none a leak, all disclosed rather than filtered out of the pattern:**

1. **Two hits on the identity vendor's own public domain**, with `<your-team>` where a team name
   would go. The pattern matches `cloudflareaccess.com` generically. No organisation is named.
2. **`LICENSE:3` is the owner's own copyright line**, naming the owner's GitHub handle. That
   handle contains the company's initials and is already in the repository's public URL. I did
   not alter it — silently editing a copyright holder's attribution is not mine to do.
   **This is the one thing on this page that needs the owner's eye:** keep it, or change the
   attribution before pushing.

One further finding was **fixed rather than explained**: a comment in `harness/moonshot.mjs`
listed five raw latency samples whose digits coincidentally reproduced a telephone-number
sequence (the arithmetic checks out — it is a genuine measurement). It now states the same
measurement as summary statistics, with a note saying why.

## 5. `npm run leakcheck`

```
$ node tools/leakcheck.mjs

  leakcheck — 237 text file(s) scanned, 0 finding(s)

  BINARY REVIEW — not scanned, and NOT cleared by this tool
  A picture can carry a place name in its pixels and an elevation file can
  carry coordinates in its header. Both pass every text scan. Someone has to
  have opened these and looked:
    · public/fantasy-relief.bin  (176 KB)
  PASSED — no credential or personal-data shape found in tracked text.
  This is a net, not a proof. A reviewer still reads the diff.
```
✅ Zero findings.

## 6. BINARY REVIEW — what I opened and what I saw

The scanner refuses to clear these. I opened every one.

| File | Verdict | What I saw |
|---|---|---|
| `public/fantasy-relief.bin` | **CROSSED** | Header dumped: frame `0,0 → 1,1` — a unit box, no longitude, no latitude, no place. Rendered the 300 × 300 grid to greyscale and **looked at it**: soft procedural noise, a bright highland in the north-east, a dark sea eating the south-west corner. No coastline, river or landform resembling anywhere real. Regenerated twice — identical MD5. |
| `docs/frames/wartable-2026-07-28.png` | **BURN** | **Opened and viewed.** A 1600 × 1000 render of the war table. **No text anywhere in the image**, so every text-based scan passes it clean — and the terrain it renders is the real county's actual elevation model. This is the one that nearly leaked a county map. |
| `tools/artprobe/kit/Textures/*.png` (7) | **BURN** | Opened `colormap.png` and `variation-a.png` and viewed both: 512 × 512 flat colour-swatch atlases, no text, no identity. Burned for licence reasons only (below), not for content. |
| `tools/artprobe/kit/*.glb` (77) | **BURN** | Not viewable as images; scanned every one for embedded strings (`copyright`, `author`, `licen`, URLs, addresses). Only glTF metadata — `"generator":"UnityGLTF"` — and mesh data. No identity. Burned for licence reasons only. |
| `public/favicon.svg`, `public/icons.svg`, `src/assets/vite.svg` | **CROSSED** | SVG is text; read in full. Vector paths and filter definitions, no embedded raster, no metadata, no identity. |

## 7. `git log` — no inherited history

```
$ git log --format='%H %s'
f6f7d349f387a30c97bf2a851fa1977e2bb43ce4 Initial commit

$ git rev-list --max-parents=0 HEAD
f6f7d349f387a30c97bf2a851fa1977e2bb43ce4

$ git rev-list --count HEAD
1
```
✅ Exactly one root commit — the owner's own initial commit. **No history from the private
repository, and none can be inherited: no remote of it was ever added and nothing was fetched
from it.** Files were read and written, never merged.

## Status

**Staged, not committed, not pushed.** 240 paths staged against the owner's initial commit.

---

# Things the owner should look at

1. **`LICENSE` line 3** — the copyright attribution contains the owner's GitHub handle, which
   embeds the company's initials. Already public in the repository URL. Keep or change; not mine
   to edit.
2. **`tools/artprobe/kit/**` (84 files) — burned, and I think this one should probably cross.**
   The kit is Kenney and KayKit assets which I am told are CC0, and CC0 needs no attribution to
   redistribute. But **no licence file exists anywhere in those directories**, so there is
   nothing in the tree to evidence the terms, and I was told to block any asset lacking one. I
   burned the binaries and crossed the probe's scripts, with a note in
   `tools/artprobe/README.md` saying where to fetch the kit. Nothing original is lost — they are
   upstream downloads. **Add the upstream licence files and they cross.**
3. **`knowledge/*.json` (5 files) and `book/**` (780 files) — burned, and this is the one real
   capability gap.** The Great Book compiler crosses (`tools/vault/*`, `npm run book`,
   `book:lint`, `book:trace`, `book:html`) and so does its design writ, but its hand-mined
   sources quoted the private tree verbatim, so they could not. `npm run book` therefore has
   nothing to compile until the sources are re-mined from the now-clean files. Recorded as the
   third item in `docs/HANDOFF.md` § *Next candidates*.
4. **`docs/ENV-SETUP.md` crossed** after de-identification. It documents installing Blender for
   the art pipeline, which is genuinely useful, but it was written about one specific hosted
   development environment. Worth a read to decide whether it earns its place.

---

# The ledger — every file in the source tree

| Path | Verdict | Reason |
|---|---|---|
| `.claude/launch.json` | BURN | Machine-local editor launch config. Trivially recreatable. |
| `.claude/settings.json` | BURN | Machine-local agent harness permissions. Recreated in seconds; nobody will miss it. |
| `.env.example` | CROSSED-MODIFIED | Rewritten as a template. Every real value replaced by a placeholder, each with a comment saying what it is for. The committed error-reporting ingest key is gone. |
| `.github/workflows/deploy.yml` | BURN | Deploys to private infrastructure and hardcodes an error-reporting ingest key twice. Replaced by `.github/workflows/ci.yml`. |
| `.gitignore` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `AGENTS.md` | CROSSED | No company identity present; crosses byte-for-byte. |
| `CLAUDE.md` | CROSSED-MODIFIED | Rewritten for a public repo: keeps the transferable craft (records in / readings out, data is working fluid, verify end to end, the A/E/P check) and drops every standing order about the company, its deployment, its wall, its people and its private siblings. |
| `README.md` | CROSSED-MODIFIED | Rewritten from scratch: what LandLord is for, how to run it, the layout, an explicit "the data is a fictional demo tenant" section, and an honest maturity section. No company reference. |
| `book/00 START HERE.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/agents-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/book.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/claude-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/claude.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/data.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-clerk-brain-doctrine-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-env-setup-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-flipper-reconciliation-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-frames.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-handoff-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-k3-profile-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-kingdom-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-library-pm-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-model-doctrine-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-parallel-sessions-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-research-economy-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-<redacted>-reconciliation-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-war-games-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-economy-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-flow-engine-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-operator-hands-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-task-language-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-the-brokerage-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-the-campaign-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-the-great-book-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-the-land-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-the-realm-map-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-the-war-table-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs-writ-war-game-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/docs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/env-example.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/github.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/gitignore.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/harness.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/index-html.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/knowledge.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/package-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/package-lock-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/public.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/readme-md.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/realm-preview-html.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/realm-preview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/src.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/supabase.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/table-preview-html.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/table-preview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/test.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/tools.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/tsconfig-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/vite-config-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/vite-operator-config-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/vite-wargame-config-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/vitest-config-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/artifacts/wrangler-jsonc.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/a-legibility-pass-is-queued-not-yet-done.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/an-alpha-before-the-beta-<name>-plays-first.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/auto-deploy-to-main-on-clear.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/batch-do-not-fragment.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/commit-on-clear-no-gates.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/cost-posture-don-t-burn-hot-by-default-but-take-the-real-swing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/fable-5-added-to-the-model-roster.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/k3-by-hand-temperature-1-reasoning-effort-high-never-max.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/kimi-for-blocked-hands.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/king-s-court-renamed-to-landlord.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/never-trust-a-builder-s-word-the-review-gate-never-lifts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/one-builder-per-task.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/opus-drives-the-right-hand-builds-opus-reviews-and-verifies.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/run-the-a-e-p-check-on-every-surface-touched.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/runtime-clerk-brains-are-a-separate-doctrine-from-build-time-hands.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/solo-kingdom-no-ceremony.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/split-and-delegate-by-default.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/territories-refounded-by-the-brokerage-writ.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-agents-charter-agents-md-is-a-draft-awaiting-ratification.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-great-book-the-writ-of-the-great-book-is-ratified.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-greenfield-brownfield-binary-is-retired.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-harness-branch-rule-yields-to-commit-on-clear.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-name-is-landlord-one-word-two-capitals.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-objective-is-the-closed-beta.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-operator-credential-reaches-beyond-the-wall.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-realm-map-s-art-direction-is-open.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-realm-remodeled-fief-becomes-pod-department-becomes-guild.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-stakes-rule-not-a-kimi-exclusion.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-three-beta-blockers-are-closed-the-doc-was-wrong.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-wall-is-an-operable-surface-not-human-gated.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/the-war-table-hud-built-by-fable-reviewed-by-opus.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/decisions/worktree-agents-base-on-origin-main-not-the-branch-tip.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/catalogrow-a-task-type-in-the-loadable-ontology.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/economybook-the-two-book-chart.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/feerule-how-a-fee-is-computed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/flowtemplate-a-loaded-flow-config.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/ledgeraccount-a-chart-of-accounts-line.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/maychangestanding-the-office-is-never-land-guard.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/readcoffers-the-unified-coffers-reading.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/regentsdesk-the-regent-s-desk-reading.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/severityof-a-case-s-severity-band.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/shirestanding-shire-vs-march.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/slaband-the-target-response-class.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/spendgate-the-owner-approval-spend-gate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-border-book-border-arrivals.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-census-the-founding-record.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-chancery.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-consequence-engine.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-court-tree-readcourttree.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-economy-setting-gate-economysettingpatch.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-event-log-the-sole-record-of-the-operating-model.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-founding-guild-set-the-three-crown-offices-re-read.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-founding-move-out-relay-flow.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-general-advance-clerk.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-grand-muster-deploy-the-muster.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-great-book-the-generated-knowledge-wiki.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-intake-clerk-<name>-s-clerk.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-intro-campaign-the-muster-library.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-leasing-clerk-<name>.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-matter-holding-court-docket.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-office-of-tenancy.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-office-of-works.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-patron-reading.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-pod-reading.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-price-approval-clerk-lp-queue.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-reasoning-vendor-clerk-va-desk.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-reference-pm-setting-data-library-pm-setting-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-seat-to-guild-map-seat-guild.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-vault-the-supabase-backend.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/the-war-game-muster.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/wartableview-the-app-s-landing-view.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/wopriority-the-work-order-priority-facet.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/wostatus-the-work-order-status-facet.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/entities/wotype-the-work-order-type-facet.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/admin-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/ancillary-resident-benefit-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/annual-administrative-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/application-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/crisis-threshold.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/crisis-worsening-rate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/default-repair-estimate-when-urgency-is-unclassified.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/docket-weighing-age-dampening-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/docket-weighing-base-weight-by-matter-kind.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/docket-weighing-crisis-bonus.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/docket-weighing-money-held-bonus.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/earned-fee-sweep-limit.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/escalation-delay-past-crisis.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/escalation-spawn-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/fester-threshold.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/founding-monthly-budget-management-fee-income.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/founding-monthly-budget-markup-income.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/founding-monthly-budget-overhead-expense.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/founding-monthly-budget-payroll-expense.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/founding-monthly-budget-software-expense.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/grand-muster-reference-setting-domain-count.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/grand-muster-reference-setting-grammar-count.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/grand-muster-reference-setting-leaf-count.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/harm-ceiling-per-case.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/home-warranty-coordination-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/intro-campaign-act-four-threshold.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/intro-campaign-case-age-ceiling-at-deploy.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/intro-campaign-raw-intake-count.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/intro-campaign-reckoning-window.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/late-fee-split-the-real-ratified-value.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/late-fee-split-working-fluid-code-default.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/leasing-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/management-fee-rate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/month-to-month-premium-firm-s-cut.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/month-to-month-premium-rate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/nsf-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/owner-approval-spend-gate-nte-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/patron-withdrawal-floor.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/per-estate-spend-cap-override-example-harrow-c.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/pet-damage-guarantee-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/pod-capacity-doors-per-knight.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/portable-ac-seasonal-rental-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/project-make-ready-coordination-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/referral-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/reletting-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/renewal-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/rent-per-door.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/resident-benefit-package-rbp-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/risk-lease-enforcement-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/shire-promotion-threshold-headless-crafts-allowed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/shire-promotion-threshold-minimum-doors.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/shire-promotion-threshold-minimum-knights.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/<redacted>-operating-scale.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/<redacted>-catalog-size-as-claimed-in-code-comment.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/task-language-tree-domain-count.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/task-language-tree-leaves-per-system.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/task-language-tree-systems-per-domain.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/tribute-management-fee-per-retained-door.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/vendor-bill-markup-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/war-game-household-upkeep-total.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/working-fluid-repair-estimate-emergency.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/working-fluid-repair-estimate-routine.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/facts/working-fluid-repair-estimate-urgent.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-bare-census-is-never-dry-there-is-nothing-to-be-broke-with.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-base-blind-merge-is-unchanged-it-still-takes-the-writing-session.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-batch-that-repeats-an-id-inside-itself-opens-one-case-not-two.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-blocked-fleet-prompt-never-calls-the-provider-and-never-persists-a-proposal.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-book-cut-over-the-muster-places-every-door-the-join-is-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-case-with-no-estateid-folds-to-null-byte-identical-to-before.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-cash-complete-sample-month-is-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-chancellor-granted-one-fief-holds-one-fief-an-office-is-not-land.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-chronicle-predating-the-estates-shelf-migrates-to-the-empty-founding-book.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-clean-founding-brings-nothing-the-household-is-fully-staffed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-clerk-s-proposal-is-heard-once-never-also-as-a-bare-waiting-case.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-craft-left-headless-is-brought-before-the-court.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-craft-standing-headless-holds-it-at-a-march.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-crisis-on-a-leased-door-outranks-its-lease-the-map-shows-trouble.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-crisis-outranks-a-fresh-matter-and-held-coin-outranks-a-bare-wait.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-door-in-no-knight-s-care-is-a-real-state-and-reads-as-debt.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-door-s-shire-and-its-fee-stand-in-the-same-realm-as-the-door.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-door-the-book-does-not-hold-reads-unplaced-and-is-named.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-door-the-book-holds-places-cleanly-realm-shire-fee-and-knight.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fee-s-patron-at-odds-with-the-muster-s-owner-is-a-finding-not-a-refusal.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fee-scattered-across-two-shires-reads-fine-and-rolls-up-as-one-fee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fee-with-doors-scattered-across-three-metros-reads-fine.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fellowship-s-block-holds-its-own-doors-and-no-one-else-s.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fief-with-no-doors-is-not-given-a-block-of-empty-ground.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fief-with-no-grant-draws-no-lord-the-regent-is-not-its-lord.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fold-into-itself-or-into-nothing-changes-no-record.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-full-mtm-month-split-funded-is-sound-end-to-end-and-the-bridge-ties-after-the.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-full-trust-account-never-saves-the-crown-that-coin-is-not-its-own.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-fully-worked-vendor-dispatch-folds-to-done-and-reaches-settlement.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-gl-rename-fee-rate-mtm-split-patch-stays-sound-over-a-dealt-month.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-guarded-brain-never-receives-a-leaking-call.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-guarded-brain-passes-clean-calls-straight-through.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-headless-craft-holds-back-every-metro-not-one-the-household-is-shared.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-headless-office-reads-as-headless-never-as-somebody-else-s.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-house-mtm-rule-with-no-splitbps-falls-back-to-the-named-constant.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-loaded-estate-roster-flips-isfoundingchronicle-to-non-founding.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-lost-create-race-yields-conflict-post-409-then-patch-matches-0-rows.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-march-promotes-when-the-records-change-with-no-field-written.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-mayor-grant-does-not-seat-a-chancellor-mayor-is-the-line-of-trade.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-meaningful-fraction-of-the-sw-quadrant-is-below-sea-level.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-meaningful-fraction-of-the-whole-map-is-above-sea-level.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-middle-step-hands-on-and-closes-nothing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-muster-deployed-on-the-remote-side-is-adopted-not-clobbered-by-a-stale-local.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-name-the-book-does-not-hold-reads-as-nothing-rather-than-throwing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-neglected-operation-loses-doors-until-tribute-drops-below-upkeep-red-fallen.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-null-absent-patch-is-a-no-op-returns-base-unchanged-same-reference.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-one-off-company-expense-does-not-become-the-standing-monthly-upkeep.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-petition-is-validated-at-the-door-nothing-half-accepted-nothing-unbounded.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-placed-door-in-no-knight-s-care-is-not-unplaced-it-is-the-debt.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-pre-funded-owner-settles-with-no-topup-and-stays-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-present-but-empty-catalog-shelf-stays-empty-truth-as-struck-not-re-seeded.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-present-economysetting-even-a-no-op-patch-means-the-chronicle-is-no-longer-at.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-present-economysetting-rides-the-raw-record-untouched-economyof-folds-it-in.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-re-observed-condition-with-a-new-id-does-not-open-a-second-case.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-real-grand-muster-is-sound-no-false-positives-on-realistic-data.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-real-grand-muster-is-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-real-insert-failure-not-a-duplicate-is-an-error-not-a-conflict.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-realm-s-edicts-read-soonest-due-first.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-regency-draws-its-keeper-not-a-lord.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-revoked-grant-struck-on-the-remote-side-stays-struck.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-row-naming-a-place-the-book-does-not-hold-reads-unplaced-and-says-which.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-shire-demotes-again-when-the-records-go-the-other-way.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-shire-that-grows-draws-a-denser-town-never-one-off-the-table.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-solvent-operation-clears-its-upkeep-black-not-fallen.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-spend-on-the-higher-cap-estate-clears-the-same-spend-on-an-unlisted-estate-gat.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-stale-vault-reads-every-craft-headless-honestly-and-fillable.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-standing-muster-reveals-a-realm-of-towns-every-door-a-building.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-struck-money-event-stays-struck-through-the-merge.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-subject-cannot-see-the-crown-s-own-matters-either-the-roll-is-one-sided.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-subject-sees-only-their-own-never-another-subject-s-matter.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-supplied-bank-statement-that-disagrees-produces-the-exact-lapse.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-tenure-realm-is-a-place-a-name-and-a-sovereign-and-no-score-on-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-tightened-cap-patch-stays-sound-over-a-dealt-month-spend-caps-do-not-touch-the.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-war-door-and-an-estate-roster-both-go-straight-in.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-war-door-carries-no-tenure-of-its-own-only-an-address-and-an-owner.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-well-ordered-owner-month-is-sound-income-before-fees-temporal-clean.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/a-zero-invalid-bill-posts-nothing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/accepts-a-relief-of-any-side-the-drawing-is-not-tied-to-one-bake.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/accepts-a-well-formed-patch-and-round-trips-through-applyeconomysetting.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/accepts-null-on-a-rate-field-clear-but-still-rejects-other-non-numbers.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/act-five-is-met-by-holding-the-watch-with-no-door-in-crisis.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/act-four-is-met-by-answering-three-of-the-clerks-proposals.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/act-one-is-met-by-seating-the-empty-craft-a-record-not-a-flag.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/act-six-is-met-by-ending-a-month-in-the-black.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/act-three-is-met-by-getting-the-boxes-onto-real-desks.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/act-two-is-met-by-walking-a-cascade-to-done.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/all-three-failing-at-once-names-all-three.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-absent-catalog-shelf-adopts-the-founding-rows.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-absent-economysetting-normalizes-through-untouched-and-economyof-is-a-true-no.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-ancient-trifle-never-outranks-today-s-crisis-age-does-not-compound-forever.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-answered-edict-is-never-late-however-long-the-day-is-gone.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-artisan-naming-no-trade-is-shown-not-swallowed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-empty-array-is-valid-the-revert-to-founding-shape.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-empty-muster-reads-empty-not-broken.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-empty-object-is-the-valid-no-op-patch.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-empty-object-normalizes-to-founding-state.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-estate-s-own-nte-governs-the-settlement-ceiling-where-it-has-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-estate-with-a-higher-cap-harrow-c-clears-a-spend-the-house-cap-would-gate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-estate-with-no-override-still-reads-the-house-cap-invariant.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-estate-with-no-override-still-reads-the-house-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-id-keyed-array-merges-by-id-not-by-index.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-office-cannot-be-folded-into-a-fief-the-destructive-path-shut.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-office-cannot-be-raised-to-a-fief-either.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-owed-edict-presses-as-its-day-nears.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-unfunded-owner-settles-soundly-via-the-shortfall-topup.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-unnamed-request-the-service-token-sees-nothing-at-all.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-unreadable-vault-is-an-error-not-a-silent-loss.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/an-unrevealed-realm-draws-no-pieces-at-all-the-land-lies-bare.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/any-named-identity-may-petition-only-the-crown-may-answer-or-hold-court.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/approving-the-final-step-records-that-the-case-is-done.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/authenticates-before-reporting-missing-vault-configuration.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/balances-within-both-books-the-bridge.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/bilinear-sample-agrees-with-cell-at-exact-grid-coordinates.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/blocks-label-before-the-provider-call.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/bootstraps-a-document-that-has-no-events-book-yet.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/both-books-balance-over-the-whole-dealt-money-log.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/but-land-still-moves-both-ways-the-guard-is-not-a-wall-around-everything.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/but-two-fiefs-under-one-lord-is-a-plurality.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/caps-what-one-court-hears-keeping-the-heaviest-and-still-every-kind.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/carries-each-door-s-open-matter-through-to-the-piece-the-road-to-the-work.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/carries-the-originating-event-id-onto-the-opening-record.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-bank-routing-number-by-its-checksum.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-deposit-refunded-from-the-wrong-tenant-per-tenant-subledger.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-government-id.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-mid-history-breach-that-the-end-state-hides-temporal-replay.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-money-event-with-an-unknown-kind-silent-drop-guard.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-payment-card-and-only-a-luhn-valid-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-a-role-labeled-name-in-ordinary-prose.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-an-over-sweep-bridge-driven-negative-the-aggregate-checker-misses.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-an-owner-overdrawn-commingling-guard.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-contact-details.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/catches-direct-doors-unit-identifiers-and-person-names.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/commission-sweep-lands-the-markup-in-by-pass-never-operating-and-stays-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/commits-straight-through-when-nothing-moved.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/commits-when-the-row-matches-non-empty-representation.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/counts-each-kind-of-override-and-the-house-cap-as-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/creates-a-new-identity-row-via-post-insert.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/deals-six-cascades-four-boxes-on-the-regent-and-two-raw-tickets.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/deals-the-scenario-s-doors-and-knights.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/derives-the-sandbox-only-from-a-valid-signed-assertion.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/different-seeds-produce-different-grids.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/distinct-signals-on-the-same-subject-open-distinct-cases.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/does-not-break-the-trust-reconciliation.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/does-not-mistake-compact-work-order-and-invoice-numbers-for-phones.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/does-not-mistake-openai-tool-schema-names-for-personal-identity.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/does-not-raise-a-false-compliance-flag.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/does-not-treat-a-raw-access-email-header-as-identity-or-canonical-authority.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/doors-the-hierarchy-cannot-place-count-toward-no-metro-s-standing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/draws-a-band-for-every-level-and-every-band-is-a-closed-figure.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/draws-the-crown-at-the-head-with-its-wards-beneath-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/drops-non-string-params-which-is-how-a-nested-record-would-arrive.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/drops-what-cannot-match-at-all.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/each-river-descends-monotonically-from-source-to-mouth-tiny-tolerance-for-smooth.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/each-river-has-90-points-all-within-0-1-uv.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/elevation-stays-within-a-plausible-range-roughly-0-600-floor-may-dip-slightly-ne.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/emits-only-an-opening-and-the-hand-to-step-one-never-an-approval-or-a-completion.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/encodes-the-id-email-sandbox-into-the-filter.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/estatelabel-resolves-a-slug-to-its-label-falling-back-to-the-raw-slug.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-agreed-signal-names-a-flow-and-a-reason-no-silent-entries.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-catalog-row-an-act-names-stands-in-the-catalog.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-door-names-a-realm-a-shire-and-a-fee-the-book-holds.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-edict-names-a-realm-the-book-holds.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-enrolled-subject-is-drawn-somewhere-the-totality-guarantee.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-fee-names-a-realm-the-book-holds.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-flow-key-an-act-names-stands-in-the-flow-book.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-founding-door-bears-all-four-keys.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-goal-reads-unmet-on-a-fresh-deploy.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-goal-reads-unmet-when-no-holding-is-dealt-at-all.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-id-in-the-book-is-unique-within-its-kind.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-keepdry-point-sits-at-least-12m-above-sea-level.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-knight-s-banner-stands-over-their-own-fellowship.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-metro-of-the-joined-book-reads-its-standing-marches-first.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-moneykind-balances-within-each-book-double-entry.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-moneykind-produces-postings-none-falls-through-to-default.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-named-box-and-cascade-actually-lands-on-the-board.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-office-an-act-leaves-headless-stands-in-the-census.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-office-is-seated-by-a-lord-role-grant-and-reads-as-headed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-realm-names-a-sovereign-a-realm-with-no-law-is-not-a-realm.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-seat-an-act-names-resolves.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-shire-names-a-realm-the-book-holds.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-sla-band-carries-a-plain-label-in-tightest-first-order.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-status-carries-a-plain-label-and-a-mark-in-lifecycle-order.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-step-of-every-named-flow-resolves-row-holder-and-key.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/every-town-has-exactly-one-manor-and-every-building-a-stable-slug-id.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/fails-closed-with-no-sovereign-configured-no-one-is-crowned.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/falls-back-to-the-house-cap-for-an-unknown-estate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/falls-back-to-the-house-cap-when-no-estateid-is-given.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/falls-to-the-bootstrap-patch-when-the-row-already-exists-post-409.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/finds-by-group-as-well-as-by-name-so-clock-reaches-the-clock-acts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/firm-keeps-the-whole-late-fee-splitbps-10000-still-nets-the-owner-zero-soundly.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/folds-the-outside-trades-from-their-hands-own-notes.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/founding-is-empty-and-reads-as-founding.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gathers-matters-from-every-department-not-one-kind-of-thing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gathers-several-hands-of-one-trade-under-that-one-guild.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gives-every-go-key-a-distinct-surface.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gives-resident-triage-a-structured-request-category-without-its-subject.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gives-turnover-scoping-distinct-controlled-condition-evidence-without-either-sub.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gives-up-honestly-if-the-vault-never-stops-moving.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gives-vendor-reasoning-a-controlled-symptom-trade-and-urgency-only.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/gives-violation-grading-its-controlled-violation-type-without-its-subject.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/hangs-knights-under-their-fief-s-lord-and-squires-under-their-knight.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/has-no-nan-or-infinity-anywhere-in-the-grid.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/holds-for-many-other-seeds-too-not-just-this-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/ignores-a-gl-patch-naming-a-role-the-chart-does-not-have-leash-never-invents-an.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/instantiateflow-stamps-estateid-on-the-opened-event-readcase-folds-it-forward.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/irs-backup-withholding-stays-sound-and-rides-the-solvency-identity.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-a-reading-answering-elsewhere-simply-stops-it-being-brought.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-a-real-posting-r1-never-the-empty-default.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-deterministic-the-same-shire-draws-the-same-town-twice.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-idempotent-when-local-and-remote-are-identical-no-duplication.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-meaningfully-smaller-than-the-grand-muster.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-null-for-an-absent-patch-founding-no-setting.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-ordered-heaviest-first-the-docket-never-rises.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-pure-the-same-land-draws-the-same-map-twice.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/is-solvent-at-rest-with-a-margin-and-the-crown-s-own-coin-is-not-gone.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/keeps-a-real-read-failure-distinct-from-an-identity-failure.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/keeps-a-setting-the-other-session-loaded-when-the-base-carried-none.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/keeps-canonical-access-on-a-separate-machine-capability.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/keeps-its-hands-off-a-field-the-player-is-typing-in.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/keeps-replaying-while-the-vault-keeps-moving-and-never-re-reasons.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/lateness-is-read-from-the-day-against-the-clock-never-stored.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/lets-an-ordinary-payload-through.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/lets-non-api-paths-fall-through-to-the-castle-assets.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/matches-a-subsequence-not-just-a-substring.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/materializes-once-so-a-stateful-tojson-cannot-change-after-the-scan.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/minelev-maxelev-match-the-true-grid-extremes.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/moves-the-owner-s-statement-it-is-their-money.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/mtm-fee-balances-across-both-books-the-bridge.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/mtm-flat-a-flat-basis-override-splits-50-50-on-the-entered-premium.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/mtm-premium-balances-within-the-trust-book-owner-income-collected.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/names-no-keep-when-the-office-it-declares-is-not-in-the-census.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/names-no-trade-where-the-note-names-none.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/needsownerapproval-agrees-with-spendgate-for-the-estate-override.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/never-invents-or-loses-commands.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/never-mutates-the-base-economy.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/never-repeats-the-value-it-found.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-fief-stands-at-the-founding-an-empty-land-read-honestly.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-founding-fee-bears-any-word-that-describes-a-place.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-knight-seated-there-holds-it-at-a-march.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-mtm-rule-at-all-still-resolves-via-the-fallback-constant-never-throws.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-muster-stands-the-land-lies-unrevealed-and-no-town-is-drawn.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-one-kind-starves-the-rest-the-standing-debts-are-always-heard.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-record-anywhere-in-the-book-stores-a-standing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-river-course-passes-through-a-keepdry-point.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-step-note-leaks-a-literal-token-when-rendered-with-full-params.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/no-two-pieces-stand-on-one-parcel.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/normalizechronicle-is-idempotent.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/nothing-dealt-is-stale-the-clock-starts-clean.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/null-clears-a-field-flips-the-founding-flat-renewal-into-a-of-new-rent.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/ok-returns-the-doc-absent-on-zero-rows-error-on-refusal.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/once-every-step-is-done-the-condition-may-open-a-fresh-case.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/one-door-short-holds-it-at-a-march-and-says-which-clause-failed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/opens-a-case-on-the-flow-the-signal-names.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/overrides-a-budget-line-by-accountrole-and-can-add-a-new-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/overrides-a-fee-rate-by-kind-leaving-other-rules-untouched.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/overrides-an-existing-per-estate-cap-and-upserts-a-brand-new-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/overrides-the-house-wide-spend-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/overrides-the-mtm-split-ratio.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/overruling-the-final-step-closes-it-too.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/ownercents-firmcents-always-ties-the-fee-rounding-lands-on-the-owner.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/ownercents-firmcents-always-ties-the-premium-rounding-lands-on-the-owner.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/preserves-abortsignal-outside-the-materialized-model-body.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/produces-4-to-6-rivers.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/puts-the-obvious-answer-first.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/re-settling-the-same-wo-is-caught-by-the-store-guard-kind-sourceid.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/readbankrecs-folds-every-physical-bank-on-a-real-grand-muster-none-overdrawn.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-a-master-once-the-office-is-founded-and-granted-the-act-sticks.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-a-sea-when-there-is-one-and-dry-land-when-there-is-not.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-a-well-formed-roster-trimming-and-keeping-order.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-both-corporate-banks-not-just-the-operating-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-taken-ids-straight-out-of-the-log-so-no-side-index-can-drift.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-the-founding-40-firm-60-owner-working-fluid-split.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-the-founding-50-50-working-fluid-split-owner-takes-the-remainder.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-the-trade-out-of-a-sentence.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reads-undefined-when-the-economy-sets-no-house-cap-and-the-estate-has-no-overrid.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reconcilebyid-a-strike-on-one-side-is-not-resurrected-by-the-other.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/refuses-a-missing-empty-id-or-label-and-a-duplicate-id.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/refuses-a-row-whose-string-params-carry-an-identifier.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/refuses-a-row-whose-subject-carries-an-identifier.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/refuses-non-json-a-non-array-a-rowless-shape-and-unknown-fields.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rejects-a-generic-bare-name-when-it-arrives-in-an-identity-shaped-field.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rejects-a-missing-assertion-on-s-before-touching-the-vault.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rejects-a-signed-assertion-with-no-usable-identity-claim.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rejects-malformed-rows-and-bad-number-shapes.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rejects-non-json-a-non-object-and-an-unknown-top-level-field.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rejects-the-wrong-audience-and-a-forged-signature.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/renames-a-gl-account-code-and-name-by-role.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/renewal-flat-a-new-rent-basis-override-yields-a-percentage-of-new-rent-via-feeam.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/replays-onto-the-fresh-doc-when-the-board-wrote-mid-run-losing-neither.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reports-conflict-when-the-row-moved-empty-representation.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reports-error-on-a-refused-write.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/reports-every-finding-not-just-the-first-so-one-fix-does-not-reveal-another.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/requires-verifier-configuration-rather-than-failing-open.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/returns-everything-in-order-when-nothing-is-typed.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/returns-the-seeded-harrow-c-estate-s-own-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/revfilter-matches-null-or-0-at-base-0-bootstrap-exact-past-that.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/revof-reads-a-numeric-rev-else-0.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/routes-the-good-rows-in-a-batch-and-skips-only-the-bad.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/routes-the-over-limit-spend-signal-asked-for.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/routing-the-same-batch-twice-opens-nothing-the-second-time.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/rowsbystatus-groups-the-loaded-rows-by-status-in-status-order-dropping-empty-gro.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/same-seed-twice-produces-an-identical-grid-and-identical-rivers.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/scalars-overwrite-an-unknown-top-level-field-on-the-patch-is-ignored.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/scans-structured-content-too-not-just-strings.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/scans-the-tojson-value-the-provider-would-serialize.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/scores-an-exact-prefix-above-a-scattered-match.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/seats-all-three-crown-offices-with-their-chancellors.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/serves-a-new-verified-identity-founding-rather-than-the-canonical-chronicle.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/settling-a-real-wo-onto-a-live-grand-muster-keeps-the-whole-chronicle-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/skips-a-known-signal-whose-flow-this-chronicle-does-not-carry.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/skips-a-malformed-row-rather-than-opening-a-case-with-a-hole-in-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/skips-a-signal-it-has-never-agreed-on-and-says-so.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/stands-the-woods-apart-on-the-board-and-off-the-bare-tops.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/starts-the-next-invocation-clean-instead-of-carrying-permanent-poison.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/statusof-slaof-resolve-a-known-key-tolerate-an-unknown-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/stays-quiet-on-s-slice-0-46.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/still-lets-this-session-s-own-load-win-over-a-stale-remote.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/still-names-the-declared-office-where-it-does-stand.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/still-routes-ordinary-rows-the-scan-must-not-fire-on-real-work.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/still-weighs-a-hand-recorded-cost-when-no-upkeep-book-stands.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/sweeping-commission-through-operating-fee-sweep-raises-a-by-pass-segregation-lap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/takes-at-most-two-words-before-guild-never-a-whole-clause.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/tenant-billed-the-whole-fee-owner-keeps-its-share-firm-earns-its-cut-sound-with.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-blocks-never-overlap-a-road-runs-between-every-two.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-book-reaches-one-door-in-two-hundred-the-finding-said-as-a-number.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-bug-pinned-a-dealt-grand-muster-runs-red-but-is-not-broke.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-case-reads-as-done-once-the-last-step-is-ratified.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-case-spine-feeds-the-gate-end-to-end-readcase-estateid-spendgate.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-coastline-is-irregular-not-a-straight-line-or-a-circle.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-coffers-are-dry-when-the-crown-s-own-banks-run-out.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-control-reads-a-shire-all-three-clauses-hold.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-crown-is-recognised-however-the-wall-cased-the-email.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-crown-sees-every-matter-from-every-petitioner-answered-or-standing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-docket-hears-those-standing-in-the-hall-first-then-the-longest-wait.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-doors-read-held-vacant-crisis-all-three-states-are-drawn.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-facets-are-additive-every-existing-founding-catalog-key-is-still-present-unr.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-fallback-no-base-cannot-honor-a-strike-it-resurrects-documents-the-limit.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-fee-bridge-ties.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-fee-shape-itself-holds-only-id-realm-name-and-patron.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-book-already-scatters-a-fee-across-two-metros.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-book-reads-one-shire-and-one-march.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-catalog-exercises-every-status-and-every-sla-band-at-least-once.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-census-holds-three-offices-and-no-fief.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-chronicle-is-fiduciarily-sound-aggregate-temporal.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-chronicle-is-sound.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-chronicle-reads-as-founding.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-founding-realm-carries-an-edict-of-every-kind.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-frame-fits-every-piece-it-is-given.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-grand-muster-is-unchanged-by-the-campaign-s-knobs-a-golden-fingerprint.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-household-s-craft-reading-satisfies-what-the-standing-asks-of-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-hud-carries-only-the-coffers-trend-the-red-month-and-the-fall-no-scoreboard.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-id-hash-is-stable-and-well-spread-the-view-places-from-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-key-forgives-case-spacing-and-a-tenant-suffix-and-nothing-else.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-law-is-total-every-petitioner-is-either-the-crown-or-sees-only-their-own.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-law-names-which-territories-may-change-standing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-mountain-range-sits-along-the-north-north-east-not-scattered-isolated-bumps.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-move-out-relay-also-folds-clean-to-done.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-muster-s-doors-decide-the-standing-not-the-founding-book-s.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-reading-and-the-view-s-contract-are-the-same-shape-the-firewall-holds.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-reading-counts-the-metro-s-own-doors-knights-and-fees.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-reconciliation-s-detail-follows-its-own-verdict.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-scene-is-pure-the-same-records-fold-the-same-map-twice.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-scribe-names-an-office-holder-a-chancellor-not-a-lord.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-shapes-stay-what-they-say-they-are.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-source-sits-meaningfully-higher-than-the-mouth.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-the-regent-role-resolves-against-the-census-it-is-dealt-into.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-three-arg-call-no-estate-reads-the-house-cap-exactly-as-before.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-trust-solvency-identity-holds-variance-ap-ar.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-two-arg-needsownerapproval-call-behaves-exactly-as-before.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-two-arg-spendgate-call-the-harness-shape-behaves-exactly-as-before.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-two-readings-agree-about-who-heads-an-office.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-two-readings-are-genuinely-independent.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-upkeep-book-is-the-monthly-rate-the-money-log-is-only-the-fallback.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-whole-founding-book-mustered-rolls-up-to-the-counts-the-shelf-reads.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-whole-realm-reading-carries-no-office-among-its-fiefs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-woods-do-not-grow-through-a-holding.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/the-writing-session-keeps-its-own-board-change-when-it-is-the-one-that-moved-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/threads-the-estate-through-so-the-spend-gate-reads-a-per-estate-cap.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/throws-a-shadow-no-longer-than-the-thing-casting-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/throws-rather-than-redacting-so-no-clerk-reasons-on-altered-evidence.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/totality-every-door-the-realm-holds-stands-somewhere-on-the-board.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/treats-an-empty-query-as-no-opinion.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/tribute-per-door-comes-from-the-economy-management-fee-rule-not-a-hardcode.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/two-fresh-ids-for-the-same-condition-in-one-batch-open-exactly-one-case.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/two-proposals-answered-on-one-case-count-as-two.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/two-rows-for-one-door-are-said-not-chosen-in-silence.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/two-writers-appending-disjoint-events-lose-nothing-on-merge-base-blind-fallback.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/two-writers-appending-disjoint-events-lose-nothing-with-a-base-3-way.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/undefined-leaves-a-field-null-on-a-brand-new-rule-just-means-absent.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/unionbyid-keeps-both-sides-remote-first-dedupes-by-id.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/unions-money-and-record-books-by-id-too-no-owner-grant-append-lost.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/with-no-game-standing-upkeep-falls-back-to-the-treasury-rolls.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/withholds-fallback-events-after-a-clerk-swallows-a-context-refusal.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/invariants/writes-only-to-the-verified-identity-sandbox.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/a-clerk-stops-at-the-first-commitment-and-never-crosses-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/actions-stand-beside-their-information.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/data-is-working-fluid.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/deliberate-acts-recorded.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/events-only-the-record-extended.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/generated-land-may-never-be-presented-as-a-finding.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/landlord-is-internal-facing.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/lordlessness-is-a-reading-not-an-error.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/plain-english-medieval-terms.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/raw-data-in-structure-out.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/records-in-readings-out.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-board-is-drawn-flat-definitively.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-border-queue-s-ideal-length-is-zero.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-border-scribe-is-deliberately-conservative.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-bridge-is-tribute.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-census-comes-alive.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-court-opens.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-factory-setting-leash.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-graduation-path.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-herald-continuous-deploy.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-land-itself-is-invented.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-marches-follow-the-fief-pattern.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-regent-s-desk.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-system-hunts-delegation-debt.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/laws/the-two-treasuries-must-never-be-confused.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/maps/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/maps/INDEX.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/data-chronicle-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/data-library-pm-setting-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/docs-handoff-md-module.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/docs-kingdom-md-module.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/github-workflows-deploy-yml.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/harness-clerks-mjs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/harness-fleet-mjs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/harness-leasing-mjs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/harness-operate-mjs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/harness-vendors-mjs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/knowledge-artifacts-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/knowledge-decisions-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/knowledge-entities-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/knowledge-facts-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/knowledge-laws-json.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-app-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-censusview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-commandpalette-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-components-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-court-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-crownview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-detail-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-agentintake-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-campaign-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-caselabel-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-catalog-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-census-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-chronicle-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-consequences-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-contextguard-d-mts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-contextguard-mjs.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-contextguard-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-court-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-courttree-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-docket-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-economy-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-economysetting-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-estate-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-events-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-flows-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-guilds-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-marches-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-pods-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-realm-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-realmscene-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-scribe-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-states-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-tenure-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-tenuremuster-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-throne-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-treasury-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-types-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-domain-wargame-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-fiefview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-keys-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-ledgerview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-main-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-nav-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-onboarding-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-operator-core-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-personview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-building-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-capital-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-chrome-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-continent-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-derivelayout-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-effects-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-guildhalls-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-instancing-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-palette-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-reveal-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-roads-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-scene-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-realm-town-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-server-access-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-server-border-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-server-brain-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-server-courtroll-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-server-vault-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-store-chroniclemerge-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-store-chroniclestore-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-fantasyrelief-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-flatmap-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-flatmapview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-palette-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-parcels-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-relief-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-sprites-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-tablescene-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-terrainpaint-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-textures-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-tiltshift-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-table-wartableframe-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-wargame-core-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-wartableview-tsx.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-watch-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/src-worker-ts.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/modules/vite-config-ts-module.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/app.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/censusview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/commandpalette.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/crownview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/fiefview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/flatmapview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/ledgerview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/onboarding.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/personview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/surfaces/wartableview.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/fief-state-held-in-plurality.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/fief-state-in-regency.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/fief-state-in-stewardship.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/fief-state-lorded.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/life-cycle-act-graduation.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/life-cycle-act-re-pledge.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/marches-record-arrival.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/marches-record-dispatch.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/marches-record-turnaway.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/pledge-artisan.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/pledge-king.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/pledge-regent.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/pledge-squire.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/pledge-vassal.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/record-fealty.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/record-garrison-posting.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/record-grant.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/record-keeper-appointment.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/territory-fief.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/territory-garrison.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/territory-guild-outside-trade.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/territory-hamlet.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/territory-office-crown-office.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/the-line-of-rule.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/the-line-of-trade.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/treasury-the-crown-s-own-coin.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/terms/treasury-the-estates-in-trust.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/.generated-by-emit` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/handoff-state-of-the-kingdom.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/kimi-k3-capability-profile-how-to-wield-it.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/landlord-flipper-the-reconciliation-the-capital-seam.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/landlord-<redacted>-the-reconciliation-one-architecture-two-repos.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/the-clerk-brain-doctrine-what-intelligence-powers-which-clerk.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/the-economy-how-residential-pm-firms-run-two-ledgers-appfolio-trust-quickbooks-c.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/the-environment-s-setup-what-must-be-installed-before-a-session-can-work.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/the-kingdom-canon.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/the-pm-task-and-process-library-reference.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/war-games-the-master-plan.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/wielding-the-models-the-doctrine.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/working-in-parallel-the-multi-session-doctrine.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-of-the-great-book-the-living-wiki-and-the-law-that-keeps-it-honest.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-brokerage-offices-guilds-fiefs-and-the-line-of-answer.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-economy-pillar-re-expressed-as-chronicle-readings.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-first-war-game-the-proving-ground.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-flow-engine-the-operator-s-spine.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-land-pods-knights-owners-and-guilds-the-realm-remodeled.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-muster-library-and-the-intro-campaign.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-operator-s-hands-swing-two-part-one.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-realm-map-the-illuminated-map-come-alive.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-task-language-the-consequences-and-the-regent-s-seat.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `book/writs/writ-the-war-table-the-front-end-direction.md` | BURN | Generated page. Compiled from `knowledge/*.json`, which do not cross; a generated view of contaminated sources is contaminated. The compiler crosses. |
| `data/chronicle.json` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `data/library/grammars.json` | CROSSED | No company identity present; crosses byte-for-byte. |
| `data/library/leaf-index.json` | CROSSED | No company identity present; crosses byte-for-byte. |
| `data/library/pm-reference.json` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `data/library/pm-setting.json` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/CLERK-BRAIN-DOCTRINE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/ENV-SETUP.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/FLIPPER-RECONCILIATION.md` | BURN | Bridge document to a private sibling repository. Company material. |
| `docs/HANDOFF.md` | BURN | ~3,000 lines of session state: real staff, invitee addresses, live worker versions, credential discussion, and the real fee schedule inside a passage claiming it was uncommitted. Replaced by a fresh empty template. |
| `docs/K3-PROFILE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/KINGDOM.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/LIBRARY-PM.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/MODEL-DOCTRINE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/PARALLEL-SESSIONS.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/RESEARCH-ECONOMY.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/<REDACTED>-RECONCILIATION.md` | BURN | Bridge document to a private sibling repository. Company material. |
| `docs/WAR-GAMES.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-ECONOMY.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-FLOW-ENGINE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-OPERATOR-HANDS.md` | CROSSED | No company identity present; crosses byte-for-byte. |
| `docs/WRIT-TASK-LANGUAGE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-THE-BROKERAGE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-THE-CAMPAIGN.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-THE-GREAT-BOOK.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-THE-LAND.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-THE-REALM-MAP.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-THE-WAR-TABLE.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/WRIT-WAR-GAME.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `docs/frames/flat-proving-frame.html` | CROSSED | No company identity present; crosses byte-for-byte. |
| `docs/frames/wartable-2026-07-28.png` | BURN | A render of the real county's elevation model. **Opened and viewed** — no text in the image, so every text scan passes it; the terrain itself is the fingerprint. |
| `harness/README.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/acct-desk.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/bd-desk.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/brain-doctrine.d.mts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/brain-doctrine.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/clerks.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/col-desk.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/config.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/fleet.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/leasing.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/loop.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/meter.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/moonshot.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/operate.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/operator-tools.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/res-desk.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/run-fleet.d.mts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/run-fleet.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/run-guard.d.mts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/run-guard.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/run.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/run.sh` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/safe-evidence.d.mts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/safe-evidence.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/selftest.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/tools.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `harness/turn-desk.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/vendors.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `harness/viol-desk.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `index.html` | CROSSED | No company identity present; crosses byte-for-byte. |
| `knowledge/artifacts.json` | BURN | Hand-mined index quoting the private tree verbatim — real names, live infrastructure, operational state — in structured, searchable form. Re-mine in the public repo. |
| `knowledge/decisions.json` | BURN | Hand-mined index quoting the private tree verbatim — real names, live infrastructure, operational state — in structured, searchable form. Re-mine in the public repo. |
| `knowledge/entities.json` | BURN | Hand-mined index quoting the private tree verbatim — real names, live infrastructure, operational state — in structured, searchable form. Re-mine in the public repo. |
| `knowledge/facts.json` | BURN | Hand-mined index quoting the private tree verbatim — real names, live infrastructure, operational state — in structured, searchable form. Re-mine in the public repo. |
| `knowledge/laws.json` | BURN | Hand-mined index quoting the private tree verbatim — real names, live infrastructure, operational state — in structured, searchable form. Re-mine in the public repo. |
| `package-lock.json` | CROSSED | No company identity present; crosses byte-for-byte. |
| `package.json` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `public/<county>-relief.bin` | BURN | Real elevation data for a named county; its own header carries the coordinates. Replaced by a generated equivalent + its generator. |
| `public/favicon.svg` | CROSSED | No company identity present; crosses byte-for-byte. |
| `public/icons.svg` | CROSSED | No company identity present; crosses byte-for-byte. |
| `realm-preview.html` | CROSSED | No company identity present; crosses byte-for-byte. |
| `realm-preview.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/App.css` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/App.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/CensusView.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/CommandPalette.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/CrownView.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/FiefView.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/LedgerView.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/Onboarding.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/PersonView.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/WarTableView.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/assets/vite.svg` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/components.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/court.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/detail.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/agentIntake.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/campaign.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/caselabel.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/catalog.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/census.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/chronicle.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/consequences.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/contextGuard.d.mts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/contextGuard.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/contextGuard.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/court.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/courtTree.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/docket.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/economy.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/economySetting.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/estate.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/events.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/flows.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/guilds.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/marches.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/pods.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/realm.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/realmScene.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/scribe.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/states.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/tenure.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/tenureMuster.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/throne.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/treasury.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/domain/types.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/domain/wargame.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/index.css` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/keys.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/main.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/nav.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/operator-core.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/Building.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/realm/Capital.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/Chrome.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/Continent.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/Effects.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/realm/GuildHalls.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/realm/Reveal.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/Roads.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/realm/Town.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/deriveLayout.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/instancing.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/realm/palette.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/realm/realm.css` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/realm/scene.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/server/access.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/server/border.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/server/brain.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/server/courtroll.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/server/vault.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/store/chronicleMerge.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/store/chronicleStore.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/FlatMapView.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/TiltShift.tsx` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/table/WarTableFrame.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/fantasyRelief.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/flatMap.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/flatmap.css` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/table/palette.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/table/parcels.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/relief.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/sprites.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/table/tableScene.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/terrainPaint.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/table/textures.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/wargame-core.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `src/watch.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `src/worker.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `supabase/migrations/20260722_chronicle_history_identity.sql` | CROSSED | No company identity present; crosses byte-for-byte. |
| `supabase/migrations/20260722_per_identity_chronicle.sql` | CROSSED | No company identity present; crosses byte-for-byte. |
| `supabase/migrations/20260727_court_roll.sql` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `table-preview.html` | CROSSED | No company identity present; crosses byte-for-byte. |
| `table-preview.tsx` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/agent-intake.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/bank-segregation.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/campaign.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/chargeback.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/chronicle.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/coffers-dry.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/coffers.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/commit-append.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/context-guard.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/court-tree.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/courtroll.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/crown-offices.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/docket.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/economy-setting.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/economy.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/estate-identity.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/fantasy-relief.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/fiduciary.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/fixtures.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/flat-map.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/flows.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/guild-seat.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/invariants.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/keys.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/late-fee-split.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/merge.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/mtm-caps.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/prompt-safety.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/realm-scene.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/run-guard.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/settlement.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/sound.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/tenure.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/vault.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `test/wo-status.test.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `test/worker.test.ts` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/agent-intake.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/artprobe/.gitignore` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/artprobe/README.md` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/artprobe/holding.js` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/artprobe/index.html` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/artprobe/kaykit.js` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/artprobe/kit/Textures/colormap.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-a.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-b.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-c.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-d.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-e.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-f.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/Textures/variation-g.png` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-a.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-b.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-c.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-d.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-e.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-f.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-g.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-h.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-i.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-j.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-k.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-l.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-m.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-n.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-o.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-p.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-q.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-r.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-s.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-t.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/building-type-u.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-flag-banner-long.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-flag.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-gate.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-tower-square-base.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-tower-square-mid.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-tower-square-roof.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-wall-corner.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/castle-wall.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-banner-green.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-banner-red.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-chimney.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-fence.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-roof-corner.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-roof-flat.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-roof-gable-end.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-roof-gable.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-roof.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-wall-corner.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-wall-half.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-wall-window-round.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/ft-wall.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-barracks.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-castle.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-detail_rocks.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-detail_treeA.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-detail_treeB.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-farm_plot.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-house.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-market.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-mill.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-square_forest.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-square_forest_detail.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-square_forest_roadA.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-square_forest_roadB.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-square_forest_roadC.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-square_forest_roadE.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-wall_straight.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-watchtower.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/kk-well.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-ground_grass.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-ground_pathBend.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-ground_pathStraight.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-stone_smallA.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-tree_blocks.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-tree_default.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/kit/nat-tree_tall.glb` | BURN | Third-party 3D asset with no licence file anywhere in the tree to evidence its terms. Re-downloadable from the upstream kit; nothing original is lost. See note below. |
| `tools/artprobe/medieval.js` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/artprobe/parts.js` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/artprobe/probe.js` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/artprobe/shoot.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/bake-<county>-relief.mjs` | BURN | Fetches and bakes real elevation tiles for a named county. Replaced by `tools/bake-fantasy-relief.mjs`. |
| `tools/bake-flat-map.py` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/bake-table-scene.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/bl-smoke.py` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/bl-wartable.py` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/check-vault-seal.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/check-watchtower.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/deploy-wargame.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/flat-map-template.html` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/fleet-coverage.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/hittest.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/measure-frame.py` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/measure-layout.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/mock-vault.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/prove-watchtower.mjs` | BURN | Live probe against the private deployment, by hostname. A public repo must not ship a working command that reaches private infrastructure. |
| `tools/<redacted>-brain-mcp/README.md` | BURN | MCP server over the company's private knowledge corpus. Company material end to end. |
| `tools/<redacted>-brain-mcp/corpus.mjs` | BURN | MCP server over the company's private knowledge corpus. Company material end to end. |
| `tools/<redacted>-brain-mcp/index.mjs` | BURN | MCP server over the company's private knowledge corpus. Company material end to end. |
| `tools/<redacted>-brain-mcp/package-lock.json` | BURN | MCP server over the company's private knowledge corpus. Company material end to end. |
| `tools/<redacted>-brain-mcp/package.json` | BURN | MCP server over the company's private knowledge corpus. Company material end to end. |
| `tools/<redacted>-brain-mcp/selftest.mjs` | BURN | MCP server over the company's private knowledge corpus. Company material end to end. |
| `tools/vault/emit.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/vault/html-check.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/vault/html.client.js` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/vault/html.css` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tools/vault/html.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/vault/lib.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/vault/lint.mjs` | CROSSED-MODIFIED | De-identified: replacement cast applied to ids/names, company/geography/infrastructure references generalised. |
| `tools/vault/trace.mjs` | CROSSED | No company identity present; crosses byte-for-byte. |
| `tsconfig.json` | CROSSED | No company identity present; crosses byte-for-byte. |
| `vite.config.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `vite.operator.config.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `vite.wargame.config.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `vitest.config.ts` | CROSSED | No company identity present; crosses byte-for-byte. |
| `wrangler.jsonc` | CROSSED-MODIFIED | Rewritten as a disarmed template: no route, `workers_dev: false`, no project ref, no identity-wall identifiers, and a header explaining what a self-hoster fills in and in what order. |

---

*Written by the migration pass. Every row above was classified from the source snapshot at
`ddda41b`. Nine files were written fresh for this repository and are not in the table because
they have no source counterpart: `README.md`, `CLAUDE.md`, `.env.example`, `wrangler.jsonc` and
`docs/HANDOFF.md` replace burned or rewritten predecessors at the same paths, and
`CONTRIBUTING.md`, `SECURITY.md`, `docs/OPEN-QUESTIONS.md` and `.github/workflows/ci.yml` are new.
`LICENSE`, `tools/leakcheck.mjs`, `public/fantasy-relief.bin` and `tools/bake-fantasy-relief.mjs`
likewise have no source counterpart.*
