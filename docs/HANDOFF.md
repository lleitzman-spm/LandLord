# Handoff — where things stand

*The working-state document. `KINGDOM.md` is the constitution (what the kingdom
**is**); this is the state of play (what is **done**, what is **next**, what is
**stuck**). Much of the codebase points here, because a session that starts by
trusting a stale note is worse off than one that starts with nothing.*

**This file starts empty in the public repository, on purpose.** Its private
predecessor grew to three thousand lines of session state naming real people and
live infrastructure, and none of that crosses. What crosses is the *habit*, which
is genuinely load-bearing: coordination lives in files everybody reads and
writes, never in one worker's head.

---

## The discipline

- **Every session ends by refreshing this file.** Not "when there is something
  worth saying" — every time.
- **Trust this file over memory**, and check it against the tree. A note here is
  a claim, not evidence. Three "blockers" once sat marked open for five sessions
  after they were closed, because nobody re-read them against the code.
- **A claim about state carries its check.** "Done" means a named command was
  run and a named thing observed, not that a diff was written.
- **Delete freely.** A stale line here costs more than a missing one.

## LANES — who is working on what

When more than one session or contributor is working at once, claim a lane:
a **branch**, an **owned surface**, and a **section in this file**. A lane edits
only its own surface. Before starting and before shipping, `git fetch` and check
this table — if another hand already landed the work, adopt theirs and drop
yours rather than forcing your copy over live work.

| Lane | Branch | Owned surface | Status |
|---|---|---|---|
| _(none claimed)_ | | | |

## State of play

Nothing in flight. See `README.md` § *Maturity* for the standing known-weak
list, and `docs/OPEN-QUESTIONS.md` for decisions that are genuinely open.

## Next candidates

Unclaimed and roughly ordered by how much they unblock:

1. **Write-loss surfacing.** Writes are whole-document upserts and last writer
   wins. A losing write should say so in the interface; today it can be silent.
2. **Multi-tenancy.** One deployment serves one book. Per-identity vault rows
   are a sandbox, not tenant isolation, and nothing should describe them as
   such until they are.
3. **The Great Book's sources.** The compiler (`tools/vault/*`, `npm run book`)
   crosses; its mined sources (`knowledge/*.json`) do not, and must be re-mined
   in this repository from these now-clean files. Until they exist, `npm run
   book` has nothing to compile.
4. **Clerk fleet on non-simulated data.** Proven on the war game only.
