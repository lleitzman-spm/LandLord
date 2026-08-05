# Writ of the Great Book — the living wiki, and the law that keeps it honest

*Ratified 2026-08-05. Binds this repository and its sibling game project alike.*

## Why this exists

Every session in this kingdom has paid the same tax: it greps. It greps because the knowledge is
real but scattered — the canon in `KINGDOM.md`, the state of play in a 3,000-line `HANDOFF.md`,
the truth in the TypeScript, the invariants only in the tests. Grep finds a string. It does not
tell you that the thing you are about to write already has a law governing it, a writ specifying
it, a module implementing it, and a test forbidding the change you were about to make.

And the tax compounds into real defects. Three "beta blockers" sat in `HANDOFF.md` marked open
for **five sessions after they were closed, built and deployed** — a line copied forward that
nobody re-checked, because checking meant reading the code and the live systems and comparing them
to the prose by eye. The leasing clerk was **built twice** by two hands who could not see each
other's work. Neither was carelessness. Both were link discovery failing.

The Great Book is the fix: one generated, backlinked, searchable projection of everything the repo
knows, with every claim carrying the source it came from and the standing it holds.

## The one rule that matters

**Never edit a page in the Great Book. Every page is generated and will be overwritten.**

The pages look like a wiki and are not one. Andrej Karpathy's LLM-maintained-wiki pattern has an
agent that *curates* articles — reads raw material, writes a page, later edits that page. That
pattern assumes the page is the artifact.

Here the page is a **view**. The artifacts are `KINGDOM.md`, the writs, the domain code, the tests
and the knowledge files. The emitter deletes and rewrites its own directories on every run. A
correction made to a page is gone at the next build — and gone *silently*, having looked right for
however long.

So: **find the source, fix the source, re-emit.** The footer of every page names its source.

| To change… | Edit |
|---|---|
| a design law, a territory, a state, the census | `docs/KINGDOM.md` — the constitution |
| what a surface is *meant* to do | that surface's `docs/WRIT-*.md` |
| a governing number (a cap, a rate, a split) | `knowledge/facts.json` — **never a literal in the code** |
| a ratified decision | `knowledge/decisions.json` |
| what the code actually does | the code; then re-emit and the page follows |
| the standing of anything | the manifest, `knowledge/artifacts.json` |

Exactly one file inside the Book is hand-written and safe to edit: **`00 START HERE.md`**. The
emitter writes it once and never touches it again. A durable hand-written note goes there, or it
goes in a source.

## The two axes — every artifact is declared

`knowledge/artifacts.json` declares **every** path at the repo root on two axes. A path on disk
that is not declared fails the lint, and so does a declaration pointing at nothing.

**KIND — what the thing is.**

| kind | meaning |
|---|---|
| `raw` | Captured material we did not author. Never edited by us; a correction goes in a knowledge object that cites it. Editing raw material destroys the ability to say what was actually written. |
| `knowledge` | Entities and what is true about them. Facts, laws, definitions, registries. Queried; carries no state. |
| `operational` | Places, transitions, guards, tokens, queues. Carries state; a case moves through it. Executes. |
| `view` | Derived from another artifact, never edited in place. Every view names what writes it. |
| `tool` | The code that compiles, queries, lints and checks. The four verbs. |
| `governance` | Standing rules, project structure, session state, the audit trail. |
| `archive` | Retired. Kept, never deleted, never cited as current. |

The knowledge/operational split is the load-bearing one: **the operational graph is a program and
the knowledge graph is its data and its type system.** Flows do not *contain* knowledge, they
*consume* it.

**STANDING — how much weight the thing carries.** This axis is LandLord's, and it exists because
of the five-session blocker lie.

| standing | meaning |
|---|---|
| `canon` | Ratified in `KINGDOM.md`. Wins until amended. Changing it is an amendment, not an edit. |
| `built` | Implemented in code and verified. The claim is checkable against the tree. |
| `proposed` | A writ, a plan, a design not yet built. **May never be cited as evidence that something works.** |
| `contested` | Two sources disagree and no decision has been made. |
| `retired` | Superseded. Kept for history, never cited as current. Names its successor. |
| `settled` | **Decided by the maintainer.** Not open, not contested, not a finding. A session may NOT raise a settled item as a question, a contradiction, or a recommendation. Treat it exactly like a closed question. |

A `proposed` claim rendered next to a `built` one, both in plain prose, is exactly how the
HANDOFF lie survived. The Book renders standing on the face of every page.

## No literal in a guard

Every governing number — a cap, a rate, a fee split, a threshold, a tier boundary — is a
first-class object in `knowledge/facts.json`, not characters inside an expression:

```json
{
  "id": "fact:late-fee-split",
  "label": "Split of collected late fees between crown and steward",
  "kind": "basis-points",
  "value": null,
  "unit": "bps",
  "scope": "per management agreement",
  "standing": "contested",
  "sources": [{ "doc": "docs/WRIT-ECONOMY.md", "quote": "the split is set per agreement; splitBps is the only unknown" }]
}
```

A bare number in code has nowhere to put "varies by contract", so whoever writes each site picks a
value and moves on — and the drift is invisible. An object carries scope, a band, a default, a
source and a standing. `lint` fails the build on a numeric guard with no `fact:` reference.

## No quote, no object

Every extracted claim carries `source_path`, a line reference, and a **verbatim quote**. `lint`
re-reads each cited file off disk and requires the quote to appear in it, whitespace-normalised. A
quote that does not appear is not a weak object — it is a hallucination with a schema, and it is
dropped.

This is the one check that makes a fan-out of many builders trustworthy without reading many
reports: builders return counts, and the evidence is re-derived against the source of truth.

## Links are found, never invented

Edges come from literal identifiers — ids, file paths, exported symbols, writ names, fact ids.
**Where a source states a relationship only in prose, there is no edge.** A graph that suggests a
false relationship is worse than a sparse one. Every wikilink is validated against the union of
(pages on disk) and (pages about to be written) before anything is written; what does not resolve
is downgraded to plain text and **reported**, never left dangling.

## Every table is resolved — no page needs a plugin

The Book is a folder of ordinary markdown with YAML frontmatter and `[[wikilinks]]`. Point
Obsidian at `book/` and it works immediately — backlinks, graph, search — with no build
step and no install. That is the point of emitting notes at all rather than only a single
generated page.

**But that is only true while the pages carry ANSWERS.** The tempting alternative is to
write a Dataview query and let the reader's plugin run it. The generator has already
evaluated the same thing in order to build the index, so a query is strictly less work
and strictly worse:

- It renders as a grey code block for anyone without the plugin, so a vault is **blank
  until you install something** — and a vault that greets you with nothing is a vault
  people abandon.
- It breaks the one-source rule. The HTML view and the folder view would compute their
  tables in two different places, at two different times, and could disagree.

So: **if the generator can answer it, the generator writes the answer.** `lint` fails on
any fenced `dataview`, `dataviewjs`, `query`, `tasks`, `chart` or `dbfolder` block found
in the Book. This was true by habit before it was a rule, and habit is not a guarantee.

The same holds for the Codex in Vassal Vessels. A game manual that requires a plugin to
show its unit tables is not a manual.

## The four verbs

| verb | command | what it does |
|---|---|---|
| **compile** | `npm run book` | sources → pages. Deletes and rewrites its own directories. |
| **query** | `npm run book:trace "<subject>"` | one subject across every layer at once — law, writ, module, test, fact, page. |
| **lint** | `npm run book:lint` | dangling links, **orphans**, undeclared paths, missing quotes, standing drift, literals in guards. |
| **read** | `npm run book:html` | the whole Book as one self-contained HTML file. No server, no plugin, no install. |
| **fix** | *— edit a source, then compile* | there is no fix-in-place. |

**Orphans are checked here and nowhere else.** A page nothing links to is worse than a missing
page: it exists, it is correct, and it is unreachable, so a reader concludes the subject is not
covered. Dangling links get caught because they look broken. Orphans never look like anything.

## Where the Book lives

| repo | the Book is called | pages | one-file read |
|---|---|---|---|
| this repository (LandLord) | **the Great Book** | `book/` | `renders/BOOK.html` |
| the sibling game project | **the Codex** | `codex/` | `renders/CODEX.html` |

Same tooling, different sources. The Codex is the manual that came in the case: a smart
twelve-year-old should be able to read it cover to cover and understand the whole game before ever
playing it. That is the bar, and it is not a metaphor — it is the acceptance test.

## Naming, so nothing collides

Three things in this kingdom were already called things this pattern wants to call them. They are
not the same and must never be conflated:

- **the vault** is Supabase — where the chronicle is stored. Not this.
- **the chronicle** is the event log — the records from which every reading is computed. Not this.
- **the library** (`docs/LIBRARY-PM.md`) is the property-management reference. Not this.

The generated wiki is **the Great Book** in LandLord and **the Codex** in Vassal Vessels.

## Scale

Karpathy's pattern is described as holding up to roughly 500 articles before it needs
restructuring. That limit does not transfer here, for the same reason the `fix` verb does not:
nothing is hand-curated, so the failure mode that arrives at scale — an agent losing track of what
it already wrote — cannot occur. What *can* rot is the sources disagreeing with each other, and
that is what `lint` is for.
