# Brief: ui-screens-c (the ledger and the council)

**Your files:** `src/ui/screens/ledger.ts`, `council.ts`, `src/ui/css/screens-c.ts`, `src/dev/ui-screens-c.ts`.
**Read:** `src/ui/api.ts` (Screen, UICtx), `kit.ts`, `css/base.ts` (tokens and classes: use them), `icons.ts`, `marginalia.ts`, `portraits.ts` (art agents are filling these), `src/sim/types.ts` (Ledger, MonthBook, StandingOrder, Policies, Oath, StaffMember, Candidate), `core.ts` (`fmtDate`), `src/data/schema.ts`, `src/data/index.ts` (BUILDINGS, RANKS, TEMPERAMENT_DEFS, TRAIT_DEFS, BAL), `src/dev/fixture.ts`. Each file exports `create(ctx): Screen` with `pauses: true`; call `addStyle` inside `create`.

**The ledger** (`ledger.ts`): an open book on the table: two facing parchment pages, ribbon tabs down the side. It is the one place for numbers, so it must be genuinely useful and quick to read. Tabs:
1. **Accounts**: this month so far and the last twelve: income and expense by category in a clean two-column account, the net, a small ink bar chart of monthly net and of rent due against collected (draw it yourself in SVG, to scale, labelled), the coffers, debts to the moneylender with interest, the next tribute and when, projected month-end ("At this rate you end the month 34 crowns up.").
2. **Households**: every household as a sortable table (name with small portrait, home, rent, market rent, happiness, months housed, arrears and stage, lease end), totals, vacancy list with days empty. Click a row: close the ledger and select them.
3. **Standing orders**: each order as a ruled entry: who it binds, the ruler's exact words in quotes, the delegate's gist, what it governs in plain words ("When rent is late, and the household is a widow, and it is winter: never serve notice"), times used, and "Revoke". An empty page explains how orders are made (by speaking) with three example sayings.
4. **Oaths**: open oaths with who, what, and days left (urgent ones in rubric), then kept and broken ones as a record, with the running tally.
5. **Policies**: the realm's knobs as plain controls with consequences in words: grace days, late fee, surety, asking rent against market, renewal cap, pets, screening. Changes dispatch `set_policy`.
6. **The realm**: a census: buildings by type and condition, households by people (species), average happiness, renown and favour with what has moved them lately (from recent heralds), lifetime tallies from `stats`.

**The council** (`council.ts`): your household of delegates around a table. A seat for each role: filled seats show a large portrait, name, role, temperament with epithet and blurb (or "Temperament: not yet known"), skill pips, wage with a small adjuster, loyalty meter, authority in plain words ("Handles the routine. Asks you about the rest."), jobs done, what they are doing now, and Speak / Dismiss. Empty seats show why (locked until Knight; "Build a Mason's Yard first") or the **candidates**: three cards each with portrait, name, their pitch line in quotes, skill, wage, temperament if known, and "Hire". "Seek new candidates" refreshes. Dismissal asks once, in the game's voice.

Both handsome at 1280×800, usable at 400×800 (single page, tabs become a scrolling row).

**Dev entry.** `src/dev/ui-screens-c.ts`: `fakeSim(makeFixtureState('baron'))` with a few more fake months in the ledger, a fake `UICtx`. Screenshot every tab and the council at both sizes; look; iterate.
