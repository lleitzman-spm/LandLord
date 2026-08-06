# The sibling boundary — who owns the process model

*LandLord has a sibling project in a private repository. This note records the boundary between
them, because on 2026-08-06 both built the same layer thirty-five minutes apart and neither knew.*

**This file is deliberately name-free.** No people, no companies, no vendors, no figures, no seat
map. The fuller bridge document is company material and does not belong in a public repository —
`ALLOWLIST.md` ratified that, and this note does not reverse it. What is here is architecture: the
part a session working in *this* repo needs in order not to build something twice.

---

## Why this note exists

The two projects agreed a boundary on 2026-07-22. At that moment **neither of them had a process
model**, so the boundary table had no row for one. Both built one anyway:

| | this repo | the sibling |
|---|---|---|
| the model | `src/domain/flows.ts` — 5 flows · 46 places · 41 transitions | 9 nets · 192 places · 200 transitions |
| where it comes from | hand-authored working fluid | mined from real procedure, every element carrying the file, line and sentence it came from |
| what it does | **executes** — a case moves through it | **evidences** — it does not run |

Four of this repo's five flows have a same-domain counterpart over there. One (`lease-renewal`)
uses the identical key. The shapes are the same shape: places, transitions, guards, a token that is
a case.

A boundary table with a hole in it is what a double-build looks like before it happens.

## The split

- **This repo owns the ENGINE and the RUNTIME model** — the flow book a case actually moves
  through, the events, the readings, the failure path.
- **The sibling owns the EVIDENCED SHAPE** — what a real firm actually does, and the gap between
  that and what a target design would do.
- **Shapes cross; instances and numbers do not.** A structure may inform a flow here. Its evidence,
  quotes, thresholds, deadlines, caps and actor names are real client data and stay where they are.

## "Escape" means two things — ours is the rate

Both projects measure against the same bar: one operator, ten thousand doors. They count
differently, and for a while used one word for both.

- **Here**, an escape is a step *reached* whose catalog row is `human` (designed) or `auto` and
  touched by a person anyway (unplanned). It is reported as a **rate over steps**
  (`src/domain/escape.ts`).
- **There**, an escape is a repair that comes to rest on the operator. It is a **count**.

Neither is wrong and they are not the same number. As of 2026-08-06 the two are reconciled at the
point that matters: a failure route here declares `endsAt: 'origin' | 'operator'`, using the same
values as the sibling's equivalent, so *"a failure that cost the one operator a slice of their day"*
is one number across both projects. `EscapeReading.escalated` is that count; the rate is left alone.

## The standing rule

**Before starting anything structural, read the sibling's recent commits.** One command in a
read-only clone answers it. The two repos move fast enough that a week-old memory of what each owns
is already wrong — which is exactly how the failure layer got built twice, by two sessions on the
same morning, neither of them careless.

## What is deliberately not here

The seat map, the real rails each seat calls, the phasing, the data gate's mechanics, and every
figure. Those live in the sibling's copy of the bridge document. If you are working on something
that needs them, you need that repository, not this note.
