---
type: "memory"
title: "The antechamber"
standing: "note"
origin: "hand-written"
aliases:
  - "00 MEMORY"
---

# The antechamber — memory the compiler does not own

*Everything else under `book/` is generated. This shelf is not. The compiler sweeps only the
shelves it built — each one carries a `.generated-by-emit` marker — and it is written to
`never sweep a shelf this compiler did not build`. There is no marker here, and `memory` is not
one of its sixteen shelf names, so **what you write here survives `npm run book`.***

## What belongs here

The **antechamber**: what is known but not yet ratified.

A thing that is settled belongs in a source — `knowledge/decisions.json`, `knowledge/facts.json`,
`docs/KINGDOM.md` — where it compiles into the Book with a standing on its face. A thing that is
merely *observed* has nowhere to live, and until this shelf existed it died with the session that
noticed it.

| | lives in | overwritten? |
|---|---|---|
| where we stand right now | `docs/HANDOFF.md` | yes — refreshed every session |
| what is ratified | `knowledge/*.json` → compiled shelves | yes — recompiled from source |
| **what we noticed but have not ruled on** | **here** | **no — append, and prune by hand** |

When a note here becomes law, move it to its source, recompile, and **delete the note.** A fact in
two places is a fact that will disagree with itself.

## The pages

- [[open-questions]] — decisions waiting on Edwin, and known gaps nobody has ruled on
- [[learned]] — things that cost us something to find out, kept so they cost us once

## Linking into the Book

Link to any page by its title — [[Map of the Great Book]], say. Every generated page is a live
target, and Obsidian resolves and back-links them for you. One asymmetry to know: the compiled pages' own **Backlinks** sections are
built from `knowledge/*.json`, so a link *from* this shelf shows in Obsidian's backlink pane but
will not appear in the generated page's footer. Obsidian sees it; the compiler does not.

## The one hard rule

**This repository is public.** No client names, no vendors, no figures, no addresses, no seat map —
the same bar as everywhere else in this tree, and `ALLOWLIST.md` governs it. `tools/leakcheck.mjs`
scans every tracked file, so it scans this shelf too, but a net is not a proof. If a note needs a
real name to be worth writing, it does not belong in this repository at all.
