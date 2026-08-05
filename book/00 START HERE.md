# Start here — the Great Book

*This is the ONLY hand-written page in the Book. The compiler wrote it once and will never
touch it again. Everything else under `book/` is generated and will be overwritten on the
next run — a correction made to a generated page is gone at the next compile, and gone
silently, having looked right for however long.*

**Find the source, fix the source, re-compile.** The footer of every page names its source.

## The four verbs

| verb | command | what it does |
|---|---|---|
| **compile** | `npm run book` | sources → pages. Deletes and rewrites its own shelves. |
| **query** | `npm run book:trace "<subject>"` | one subject across every layer at once — law, writ, module, test, fact. |
| **lint** | `npm run book:lint` | dangling links, orphans, undeclared paths, missing quotes, standing drift, literals in guards. |
| **read** | `npm run book:html` | the whole Book as one self-contained page. |
| **fix** | *— edit a source, then compile* | there is no fix-in-place. |

## Where to change a thing

| To change… | Edit |
|---|---|
| a design law, a territory, the census | `docs/KINGDOM.md` — the constitution |
| what a surface is *meant* to do | that surface's `docs/WRIT-*.md` |
| a governing number (a cap, a rate, a split) | `knowledge/facts.json` — **never a literal in the code** |
| a ratified decision | `knowledge/decisions.json` |
| what the code actually does | the code; then re-compile and the page follows |
| the standing of anything | the manifest, `knowledge/artifacts.json` |

## Read the standing before you believe the page

Every page renders its standing on its face. `canon` is ratified and wins until amended.
`built` is in the tree and checkable. **`proposed` is a design and may NEVER be cited as
evidence that something works.** `contested` means two sources disagree and nobody has ruled.
`retired` is history. `settled` was decided by Edwin and is not open.

→ [[Map of the Great Book]]

*This page is yours. A durable hand-written note goes here, or it goes in a source.*
