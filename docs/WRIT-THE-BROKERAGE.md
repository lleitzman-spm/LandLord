# Writ — The Brokerage: offices, guilds, fiefs, and the line of answer

*Ratified in conversation by Edwin, 2026-07-27, after the census surfaced a design
collision. This writ records the model; the code implements it and KINGDOM.md is
amended to match. Nothing here is built yet — it is written down first, because
the last time a stale structure met a new one it was discovered by a user
clicking a dead button.*

---

## The collision this writ resolves

The kingdom pivoted to make **fiefs literal** — a fief is real property, land you
can stand on. But the founding census also seated the *departments* (Property
Management, Leasing, Maintenance, Legal, Technology) in **territories**, because
at the founding a guild had to be seated somewhere and a territory was the only
seat there was.

So Alys, Mabel and Osric read as "vassals of a fief" — vassals of a department
that is not land at all. Edwin: *"that's basically just stale design that collided
with our pivot to make the fiefs literal."*

Two things were tangled and are now separated: **the crafts the household
performs** (which are not land) and **the land itself** (which is).

## What the company actually is

**A brokerage.** Edwin: *"there will be team/pod leads, that function like groups
in a brokerage (and now that I think about it, we are a brokerage, that's exactly
what I'm talking about)."* The model below is the brokerage's own shape, told in
the kingdom's words.

---

## The three CROWN OFFICES — the household's own crafts

The internal staff, seated **in the palace itself**, not on any land. Property
management divides MECE into three, and these are they:

| Office | The craft | Head |
|---|---|---|
| **The Office of Works** | Maintenance — keeping the buildings sound | the **Chancellor of Works** |
| **The Office of Tenancy** | Leasing — filling doors and keeping tenants | the **Chancellor of Tenancy** |
| **The Chancery** | The administrative layer: the books, records, payments, and law | the **Chancellor of the Chancery** |

*On the names.* "Office of Works" is the genuine historical term for a crown's
building-maintenance arm. The **Chancery** is historically exactly the third
office — a crown's writing office, holding records, law, payments and
administration under one roof — which is also why its head is a Chancellor.
Edwin's own framing: *"the backoffice accounting, record keeping, payments making,
but also LEGAL, so it's more general purpose administrative layer."*

**Property Management as a guild is dissolved** — it does not sit beside the
three, it *is* the three. Legal and Technology and Investor Relations are no
longer guilds either: legal folds into the Chancery, and the rest are the
Crown's own concerns rather than crafts of property management.

An office is a **first-class record**, seated in the palace. It is never a
territory, and a Chancellor's authority comes from appointment to the office —
not from holding land.

## The GUILDS — the outside trades

Edwin: *"Guilds are external vendors, so we have the roofing guild, foundation
guild, lenders guild, etc."*

A guild is a **trade outside the household**: the roofing guild, the foundation
guild, the lenders' guild, the plumbers' guild. The Crown does not staff them and
does not hold them. **Artisans** are the hands that come from them — external,
they work the land, they can even keep it, they can never hold it.

This is what a guild always meant in the world outside a court, and it is what
the word should have meant here from the start.

## The LAND and the line of answer

**A fief is a group's BOOK OF DOORS** — Edwin's ruling. It is both a place on the
map (the doors its knights hold) and an org unit (its lord and its knights). One
record does both jobs, and the map draws a fief as the cluster of doors beneath
it.

**Only real estate agents may rise through the land.** Edwin: *"Only real estate
agents can be knights/fieflords/kings."* The line:

```
            The Crown  (King · the Regent in his name)
                 │
            the Lords  — a fief's lord: the team lead, an agent
                 │
          the Knights  — agents, pledged to a fief
                 │
          the Squires  — agents in training, pledged to a KNIGHT personally,
                         and seated in that knight's fief
```

**Knights answer to their liege lord, who answers to the King.** The three
offices *serve* the land; they do not command it. A Chancellor is not a knight's
superior.

> **This is not a downline.** Edwin, explicitly: *"The economics of this are NOT
> 'downlines' and other MLM bullshit, but there are layers of organization
> here."* The layers are org structure — a brokerage's groups and their leads —
> and nothing in the economy is to be built as an override, an override chain, or
> a recruitment incentive. Whoever writes the money must not reach for this
> ladder.

## The CENSUS, rebuilt

Edwin: *"move away from it feeling just like a website scrolling list"*, with
*"clear sections for the different types of subjects, that also allows for
subject management."*

**Shape: a court hierarchy — who answers to whom.** Not a roster to read
top-to-bottom; the realm's actual shape, drawn.

**Its sections:**
1. **The Crown offices** — the three, their Chancellors, and their hands.
2. **Knights and lords** — the agents: each fief, its lord, its knights, and
   each knight's squires beneath them.
3. **The guilds** — the outside trades.
4. **The artisans** — the guilds' hands, working inside the realm.

Every subject is manageable from where they stand: enrolled, pledged, promoted,
seated, struck — the acts on the record, at the record.

## Still open

- The Squires' rabbit hole Edwin flagged and deliberately deferred: *"agents in
  training are squires, there's a whole rabbit hole here worth pursuing but I
  won't now."*
- What a guild's own record carries (a trade? a roster of artisans? rates?) —
  guilds are named here but not yet modelled.
- Whether the existing five department-territories are struck from the census or
  migrated, and what becomes of records pointing at them. **They are live data in
  Edwin's own vault**, so this is a migration question, not a rename.
