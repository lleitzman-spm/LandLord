# Contributing to LandLord

Thanks for looking. This is a small, opinionated codebase with a written
constitution; the fastest way to make a change that lands is to read the
constitution first.

## Before anything else — the rule that is not negotiable

**No real personal data and no credential may ever enter this repository.**

Not in code, not in a test fixture, not in a comment, not in a commit message,
not in an issue, not in a screenshot. That includes:

- real names, e-mail addresses, telephone numbers and postal addresses
- API keys, database URLs and project identifiers, ingest keys, tokens, JWTs,
  private keys, session cookies
- one company's real fee schedule, thresholds, portfolio volumes or client list

Use the fiction that is already here. People come from the demo census. E-mail
addresses use `example.com` (the reserved documentation domain). Telephone
numbers use the fiction-reserved `555-01xx` range — `(555) 555-0134`.

### The check

`tools/leakcheck.mjs` scans every tracked text file for the *shapes* of these
things. It runs as the **first CI job on every push and every pull request**,
before dependencies are installed, so it still answers when the tree does not
build and cannot be defeated by a dependency.

```sh
npm run leakcheck
```

Run it before you open a pull request. If it flags you, fix the file — never the
scanner. It deliberately holds no list of real values, because a file
enumerating the strings you are hiding is itself the leak, committed and
searchable, and every fork keeps a copy.

The scanner also prints a **BINARY REVIEW** section listing every image and
binary, and it explicitly refuses to clear them. It cannot. A picture can carry
a place name in its pixels and an elevation file can carry coordinates in its
header — both pass every text scan ever written. If your change adds or touches
a binary, **open it, look at it, and say in your pull request what you saw.**

### If a secret was ever committed, rotate it

Deleting a secret from the working tree does not remove it from a public
history, and it does not remove it from the clones, forks, caches and mirrors
that already have it. **Treat any credential that has ever been pushed as
compromised and rotate it at the source.** Then remove it from the tree. In that
order.

## Setting up

Node 22 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # tsc + vite build
```

No keys, no database, no account. With no vault configured the chronicle lives
in `data/chronicle.json` and every feature works. `.env` is optional and
gitignored; see `.env.example`.

## The house conventions

**Read `docs/KINGDOM.md`.** It is the constitution — the model the code
implements. When the code and that document disagree, the document wins until
somebody amends it. Per-surface design documents are `docs/WRIT-*.md`.

**The name is `LandLord` — one word, two capitals.** Never "Landlord", never
"landlord", never "Land Lord". The inner capital is load-bearing, and it holds
everywhere: code, comments, commits, docs, UI copy and prose.

**Write in the kingdom's plain-English medieval voice.** Comments, commit
messages and documentation share a register: recognisable English words, never
glossary flavour. *Mayor*, not *reeve*. *Keeper*, not *castellan*. Clarity beats
flavour every time. Explain **why**, not what — the code already says what.

**Records in, readings out.** This is the law the whole model rests on. State is
*computed from records, never stored*. If you are about to add a status field,
stop: the status is a reading, and storing it creates a second source of truth
that will drift. Removal of a record **is** revocation. The event log is
append-only; a correction is a reversing event, never an edit.

**Data is working fluid.** The contents of `data/chronicle.json` exist to
exercise the machine. They are not a model of anything real and not a to-do
list — never "fix" the demo data toward some reality, and never treat a red flag
in it as a bug. Tests may mutate it freely; restore with
`git checkout -- data/chronicle.json`.

**Configuration, not constants.** LandLord is software for property-management
companies generally. No single firm's fee rates, caps, thresholds or org chart
may be compiled in. Anything a deployment would set differently belongs in the
tenant setting (`src/domain/economySetting.ts`) with a clearly-labelled demo
default. If you find yourself justifying a behaviour by what one company does,
the behaviour is probably wrong for a product — raise it in
`docs/OPEN-QUESTIONS.md` rather than shipping it quietly.

**Verify function end to end.** `npm run build` stays green and `npm test`
stays green. A feature that touches a surface gets driven in a real browser
before it is called done — a passing unit test is not a working button.

## The A/E/P check — run it on every surface you touch

Named because these three kept recurring: dead lists, buttons that no-op, and
information three scrolls away from the act on it. Walk the surface and answer
all three.

- **A — Accessibility.** Can it be reached and operated at all? Is every row
  that *names* a thing a door to that thing? Is anything clickable-looking that
  isn't, or clickable that leads nowhere? Keyboard-reachable, labelled, and no
  control whose only feedback is invisible — a `scrollIntoView` onto something
  already on screen is a dead button.
- **E — Efficiency.** How many clicks from *seeing* the thing to *doing* the
  thing? A surface that reports a state and makes you navigate elsewhere to
  change it has failed.
- **P — Proximity of information to action.** The act stands beside the record
  it changes (design law 6). A count with no road, a proposal you can read but
  not ratify, a vacancy with no seat form on the same line — all three are the
  same fault.

Every one of these has shipped at least once. Say in the pull request that you
ran it.

## What a good change looks like

- **One thing.** A focused diff with a clear reason beats a large one with
  several.
- **A reason in the commit message.** Plain English, present tense, saying why.
- **Tests where behaviour changed.** The domain layer is pure functions over
  records and is cheap to test — there is little excuse not to.
- **The constitution updated if the model changed.** If your change alters what
  the model *is* rather than how it is implemented, amend `docs/KINGDOM.md` in
  the same pull request. Code that quietly contradicts the constitution is a bug
  in one of them, and the document wins by default.
- **A note on what you verified.** "Drove it in Chrome; placed an owner and the
  debt count dropped" is worth more than a green tick.

## Reporting a security issue

Please **do not open a public issue** for a vulnerability, and do not include a
live credential in a report. See `SECURITY.md` if present, otherwise use GitHub's
private vulnerability reporting on this repository.
