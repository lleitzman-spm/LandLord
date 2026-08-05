# Writ — the War Table (the front-end direction)

*Edwin's direction brief, brought into the repo verbatim 2026-07-28 so the build has
one durable spec rather than a chat attachment. Sections 2-7 are SETTLED — do not
relitigate. Section 10 is the failure-mode list; read it twice. Claude's answers to
the open items in section 12 are appended at the foot under `ANSWERED`.*

---

# LandLord Front End: Direction Brief

**Status:** decisions made, ready to build
**Date:** 2026-07-28
**Audience:** the Claude Code session doing the build

## How to use this document

Sections 2 through 7 are settled decisions. Do not relitigate them; alternatives were considered and rejected for stated reasons. Section 8 is technique. Section 10 is a list of specific failure modes that this project is prone to, and is the most important section to read twice. Section 12 lists what is still open.

---

## 1. Current state

LandLord is a working browser app at `landlord.example.com` that renders a real single-family rental portfolio (roughly 203 doors, the realm's seat and Universal City metro) as a medieval-realm strategy sim. Subtitle in the header reads "The Realm · The King's War-Table."

What exists today:

- Left vertical rail, nine icon buttons: TABLE, THRONE, SEAT, COURT, LEDGER, WAR, CENSUS, BOOKS, MARCH
- Header metrics: The Coffers, Delegation Debt, Patrons. Buttons for CLEAN and COUNCIL
- Center: low-poly green island, three small clusters, hand-drawn circles, thin connector lines
- Right panel: "The Council · heralds of the realm" with notification cards ("21 owners in no knight's care", "3 guilds stand unmanned", "The war horn sounded")
- Bottom tabs: The Muster, The Chronicle, The Coffers, The Council, The cards
- Bottom bar: Year 1 Wk 1, game clock running against a real date, Advance a day, Advance a week, Let the clerks work, Reset

Honest assessment of what is wrong with it:

1. **Ratio inversion.** Reference sim games (Civ V, AoE2 DE) spend roughly 90 percent of frame pixels on rendered world and 10 percent on UI chrome. LandLord inverts this: two large text panels flank a nearly empty map.
2. **The map is illustration, not interface.** Property data lives as text in the right panel. The island is decoration. In Civ, the city nameplate reading 18/55 *is* the data readout.
3. **Content density.** The world contains roughly ten objects. It should contain roughly two hundred.
4. **Monochrome.** One hue at one saturation does every job. The copy says "46 in crisis" and nothing on screen is alarmed.
5. **Typography is the strongest existing asset.** Serif, small caps, letterspaced labels. Keep this. Do not sand it off.

---

## 2. Direction: diegetic war table

**Decided.** The interface is a physical war table viewed from a fixed high angle, lit by one warm key light in an otherwise dark room. Panels become objects on the table. The map is the primary interface, not a decorative element.

Alternative considered and rejected: keep the current dashboard architecture and invest only in making the map beautiful. Rejected because it has a hard ceiling. A prettier map still flanked by panels does not solve the information architecture problem.

Second alternative considered and rejected: stylized outdoor low-poly landscape in the manner of Dorfromantik, Islanders, Townscaper. Genuinely viable and proven in Three.js, but rejected in favor of the table for two reasons.

**The table is the cheaper build, which is counterintuitive and worth internalizing:**

- **Shadow is free content.** Half the frame can be darkness. Falloff toward the table edge hides everything not built. An outdoor daylight scene makes every pixel visible, so every pixel must be authored.
- **Contrast comes from the light rather than from asset quality.** One warm key plus cool ambient fill produces form, depth, and hue separation with no detailed assets.
- **Four easy materials:** wood, felt, brass, paper, painted lead. All simple. Outdoor scenes owe terrain blending, grass, foliage translucency, and water, all hard.
- **Low-poly reads as correct on a table.** A faceted painted lump on a war table is a lead figurine, which is what miniatures look like. The same lump on an outdoor landscape reads as a budget compromise. The frame launders the constraint into intent.
- **Fixed camera eliminates a whole class of work:** no free-flying camera, no LOD system, no popping, no authoring for angles the player never sees.

---

## 3. The bar: charming, not AAA

**AAA is explicitly not the target.** Indie ceiling is acceptable and intended.

**Do not use as references:** Bannerlord (real-time 3D PBR engine, unreachable in browser, every comparison loses for reasons with no fix). Civ V and AoE2 DE for the *frame* (outdoor maps, wrong register now). Photoreal Admiralty plot rooms and sand tables (pushes fidelity requirement and cost back up).

**Reference class:** photographs of tabletop wargaming terrain boards and model railway dioramas. Hobbyist-scale painted models shot under warm light. These are physically real, so they are honest A/B references. They are plentiful. They look excellent. And they are made by one person on a kitchen table, which is the correct ambition level.

Secondary reference for typography and chancery register: Crusader Kings III.

**Charm operationalized**, so a reviewer can actually grade it:

1. **Shallow depth of field / tilt-shift.** Highest-leverage single effect available. Blur at near and far edges is what makes the brain read "small real object photographed close." One post-processing pass buys more charm than any amount of geometry. Build this early, not last.
2. **Handmade irregularity.** Slight imperfection in placement, rotation, and paint tone. Perfect grids read as CAD, not craft.
3. **Legible silhouette over detail.** If it reads at a glance, detail is optional.
4. **Warm key, cool shadow.** Non-negotiable, it is where the production value comes from.
5. **One or two moments of surprise.** A cat on a roof. A tiny hand-lettered sign. Cheap, disproportionate payoff.

---

## 4. Visual tokens

Derive a compact token system before writing render code, and state it explicitly so it can be reviewed:

- **Palette: 4 to 6 named hex values.** The existing sage/olive is a reasonable starting point for felt and terrain, but the palette must gain a warm key and at least two status hues that are not green.
- **Type: three roles.** Display (the existing serif small-caps direction, used with restraint), body, and a utility face for data and captions. The current typography is the best thing in the app; extend it rather than replacing it.
- **Signature element.** One memorable thing. Strongest candidate: the clock. See section 8.
- **Status hues must be hue-separated, not value-separated.** Crisis must be a different color, not darker green.

**Palette warning.** The default AI answer for anything medieval is warm cream (near `#F4F1EA`), high-contrast serif, terracotta accent (near `#D97757`). That combination is a recognizable tell and it is where this project will drift if left alone. Parchment is the lazy answer here. The war table is wood, felt, brass, lead, and candlelight, which is a darker and warmer palette with more saturation range than parchment. Go there instead.

---

## 5. Domain model and naming

Build the full hierarchy in the data model now. It is cheap today and expensive to retrofit. Every door row carries realm, shire-or-march, fee, and knight from the first migration.

| Layer | Game term | Real meaning |
|---|---|---|
| Sovereign polity | **Realm** | US state. Sovereign is the state real estate regulatory body (the Estates Commission in Aldermarch) |
| Administrative geography | **Shire** (settled) / **March** (frontier) | Metro area |
| Tenure unit | **Fee** | Owner group. Non-contiguous by nature |
| Vassal | **Knight** | Agent or property manager. Holds of a broker |
| Asset | **Door** | Individual property |

**Why the state-as-realm mapping is sound, not just flavor:** the state grants the right to practice, which is a crown granting a patent. An agent cannot hold that right freestanding and must hang their license with a sponsoring broker, who answers to the commission. That is vassalage in the strict sense, three tiers deep. Interstate reciprocity agreements are treaties.

**Fees are not geographic and the visuals must not assume they are.** Owner groups are scattered across a metro and only incidentally clustered. This is historically correct: medieval manors held by one lord were routinely non-contiguous and interleaved with other lords' holdings in the same village. Contiguous territory with hard borders is a modern nation-state model, not a feudal one. Do not draw fief borders. See section 8 for the influence-wash solution.

**Shire versus march is a status with a promotion, not decoration.** A newly entered metro arrives as a march: frontier, thin holdings, no seated officers, higher risk. It promotes to shire on clearing thresholds (door count, a seated knight, staffed offices). Northreach is a shire. A new metro at twelve doors is a march. This encodes real operational maturity for the price of one status field, and gives the realm chart a visible progression later.

**Crown edicts.** Because the realm's sovereign is the regulatory body, realm-level law is a real mechanic and not yet built: license status, CE hours, disclosure obligations, trust account rules, filing deadlines. This is a compliance calendar in costume, and it is functional rather than ornamental. Each additional realm brings different edicts, which is what makes multi-state expansion operationally meaningful rather than just more map. Model the data now, build the UI later.

---

## 6. Navigation consolidation

Nine rail items is more than a table edge can hold, and three of them are opaque even to the author, which is the argument for collapsing them.

**Renames and merges:**

- `MARCH` (rail item) becomes **ERRANDS**. This screen is intake: new items arrive and are triaged and sorted. "March" is needed for the geographic unit, and ERRANDS avoids a second collision: triage is technically the work of *petitions*, and petitions are heard at *court*, which already exists in the rail. ERRANDS names the output (things leave as tasks knights ride out on) instead of the input.
- `TABLE` is the map view. Keep.
- `SEAT`, `COURT`, `THRONE`, and the Council surfaces overlap heavily. The center panel is titled THE COUNCIL and lists vacant offices (Office of Works, Office of Tenancy, Chancery); the right panel is also titled The Council; SEAT appears to be about seating those same offices; THRONE appears to be the Regent, who absorbs unseated work. That is four surfaces for one job.

**Target: collapse to roughly five rail items.** Two of them:

- **The offices.** Who holds what. Seat an officer or leave the work pooling on the Regent. Council becomes a *state* of this screen, not a separate destination.
- **The people.** Owners, patrons, knights.

Throne becomes a role occupied rather than a place visited.

Confirm actual current behavior against the repo before merging. The inferences above come from a photograph of the running app.

**Copy discipline** (applies to all of the above): each element does exactly one job. A label labels. Actions keep the same name through the whole flow. Errors say what happened and how to fix it, in the interface's voice. The fantasy register is not a license for vagueness.

---

## 7. Scope for this phase

**Build one camera level only: the shire relief.**

Explicitly out of scope for now:

- Realm view (the Aldermarch chart). Build it when a second shire or march exists. A realm chart with one populated metro looks emptier and more unfinished than no realm chart at all.
- Realm selection across multiple states. Build it when a second state exists, which may be years out.
- Crown edict UI. Data model only.

The hierarchy earns its keep as a data model long before it earns its keep as three screens.

**Planned physical transition, for later.** A large chart of the realm laid flat on the table, shires and marches marked. Selecting one causes the relief model to rise out of or be set into the chart. Zoom becomes a physical act. Going back up is lifting the model off. Note it now so the camera code does not foreclose it.

---

## 8. Technique

> **AMENDED — Edwin, 2026-07-28.** *"Rendering Northreach county sounds intensive and I don't care, so
> let's get rid of it needing to be literal the realm's seat and just replace with fantasy realm, maybe we
> make it a real world map later."* The land is now an INVENTED realm. The paragraph below is kept as
> the record of what was traded away, not as instruction — it is superseded, as is §10.2.
>
> **What the trade costs, stated plainly so it is a choice and not a drift:** the argument below is
> the one real argument for true ground, and it was right — an invented shape cannot tell you
> anything you did not already know. A generated realm can never report a true drive time, a true
> vendor radius, or a true concentration risk, because there is no territory under it. The map
> becomes a beautiful board and stops being an instrument. That is acceptable *because the app does
> not read the terrain for any of those things today* — the doors carry the data and the ground is
> scenery — but the day anything wants a geographic answer, the ground has to become real again.
>
> **What was built to keep that door open:** the realm is generated behind the same `Relief`
> interface the baked the generator grid satisfies, so "maybe we make it a real world map later" is a swap of
> one source for another, not a rewrite. The Northreach bake (`public/fantasy-relief.bin`,
> `tools/bake-fantasy-relief.mjs`) is KEPT for that day. Note for the record that the real relief was
> never the expensive part — it is a 180 KB file, baked once, costing nothing at render time; the
> reason to drop it is that the kingdom should not be literally the realm's seat, which stands on its own.

**Terrain data.** Real elevation, not procedural. the generator DEM or Mapbox terrain-RGB for the shire of Northreach, draped with real parcel positions. Procedural generation is the wrong tool here even though it is what most Three.js terrain references are selling; the geography has to be true because that is what makes the map load-bearing (drive time, vendor radius, coverage gaps, concentration risk). An invented shape can only tell you what you already know.

**Vertical exaggeration: 2x to 5x.** the realm's seat is flat outside the Balcones Escarpment in the north. Real relief models and sand tables routinely exaggerate the z-axis, so this is authentic to the object being simulated rather than a cheat. Make the escarpment and the river corridors the hero landform features of the Northreach shire. Accept that visual interest comes from the built environment, the pieces, and the light, not from terrain drama.

**Pieces, not panels, carry the data.** Every door is a piece on the relief. A knight with a banner covers a territory. An unattended door has no banner near it. You do not need a card that says "21 owners in no knight's care" if twenty-one houses visibly stand bare. Crisis is a piece knocked over or flying a black pennant.

**Sprite billboards over meshes.** Fixed camera elevation means painted tokens can be png sprites rather than geometry. This is how you get two hundred distinguishable doors without a modeling pipeline, and it is dramatically cheaper. Author each property type as an image.

**Soft influence wash, not hard borders.** Because fees and coverage are non-contiguous, do not attempt boundaries. Render a soft radiance around each piece a knight covers and let overlapping knights produce overlapping washes. This reads as spheres of influence, holds up at density, and is semantically accurate to how coverage actually works (a set of stops, not a territory). Where two owner groups interleave heavily the washes tangle visibly, which is a real finding about shared drive time and vendor overlap rather than noise.

**Baked lighting.** One warm key, cool ambient fill. No dynamic lighting requirements.

**Fixed camera.** One or two positions. Do not build a free-fly camera.

---

## 9. Map modes

One unchanging surface, a small set of layers over it, in the manner of Civ's lenses or CK3's map modes.

- **Condition.** Default. What is bare, what is on fire. Two or three colors.
- **Care.** Which knight covers what. Influence wash.
- **Tenure.** Owner identity. On demand only.
- **Yield.** Rent performance heat.
- **Vacancy.**

**Do not default to tenure.** Twenty-one owners means twenty-one hues, which is unreadable at any density. Condition is the resting state because it answers the question the app is actually opened to ask.

---

## 10. Failure modes specific to this project

Read this section twice.

1. **The ornament trap.** Given a vague instruction to look more like a game, the default move is to add ornament: gold filigree, parchment texture, bevels, drop shadows, a wax seal. Each addition wins slightly on apparent richness while the underlying structure stays wrong. Ornate chrome around an empty world reads as costume and looks *cheaper* than the current clean version. Add density and hierarchy, not decoration.
2. ~~**Procedural terrain.** Tempting, well-documented, and wrong. See section 8.~~ **SUPERSEDED
   (Edwin, 2026-07-28)** — the realm is invented now; see the amendment at the head of §8. The
   failure this named is still live in one narrower form: generated ground must not be dressed up
   as a finding. A wash, a cluster or a gap on invented land says nothing true about the business,
   and no surface may imply that it does.
3. **Parchment palette drift.** See section 4.
4. **Rendering dense data diegetically.** Do not try to make wooden pieces do spreadsheet work. There must be an explicit escape hatch: lift the ledger and drop into clean, dense, boring tabular UI with real sortable rows. Every good diegetic game has this seam. The failure is a rent roll rendered as parchment.
5. **Text on wood grain.** Where fantasy UIs die. Copy sits on clean fields even inside the fiction: paper on the table, not ink on the table.
6. **Building the scaling architecture before the content.** See section 7.
7. **Assuming geographic separation between fees.** See section 5.
8. **Chasing AAA.** The bar is charming. Chasing AAA produces something that fails at both.

---

## 11. Phase 1 acceptance: the proving frame

One screenshot decides whether this direction works:

> The table. One warm key light. The Northreach relief with vertical exaggeration. Roughly two hundred pieces placed at real parcel positions. The clock. Tilt-shift depth of field.

> **AMENDED — Edwin, 2026-07-28:** *"We can also move away from the strict requirement to render 200
> houses."* The COUNT is no longer binding. What it was protecting still is, and it is §8's rule, not
> a number: **pieces, not panels, carry the data** — you should not need a card saying "21 doors stand
> in no knight's care" when twenty-one doors visibly stand bare. Any scheme that drops the one-piece-
> per-door mapping must still let the eye find that condition on the map itself. An aggregate that
> hides its states behind a total has failed the writ even while satisfying it.
>
> This freedom is best spent on the fault the blind critics actually named — **no hierarchy**. Every
> building was the same gable box at the same size, so the settlements read as confetti: no landmark
> to land on, no way to rank one cluster against another. Landmark pieces (a hall where a knight
> sits), a real size range, and simplification of pieces that carry nothing are all now permitted.
> Aggregation into settlement glyphs is the escape hatch for scale — it is not needed at 203 and will
> be needed well before thousands.

No panels. No cards. No chrome. No rail.

If that frame reads right, everything else is downstream detail. If it does not, no amount of card design rescues it. Build to that frame first and evaluate before adding any UI.

**Signature element candidate:** the clock. "Advance a week" should be a brass dial or hourglass set into the table rim, not a button labeled "Advance a week." It is the most-used interaction in the app and the best opportunity for one memorable physical moment. Spend the boldness here and keep everything around it quiet.

---

## 12. Open items

1. **Actual behavior of THRONE, SEAT, and COURT.** Confirm against the repo before executing the section 6 merge. Current mapping is inferred from a photograph.
2. **Shire promotion thresholds.** Door count, seated knight, staffed offices: pick numbers.
3. **Which of the nine rail items survive** beyond the two named in section 6.
4. **Whether to run an adversarial review loop** on the render. See appendix.

---

## Appendix: adversarial review setup

If a critic loop is used on the render, three things determine whether it works.

**Decompose the bar.** "Does this look like a good game" is not gradeable and a critic will lose every round with unactionable global feedback. Grade one element at a time against one reference element: this table surface against that table surface, this water against that water, this tree against that tree, this nameplate against that nameplate. Element list: table material, felt, relief terrain material, water, tree instancing, structure sprites, banner and pennant legibility, influence wash, clock, notification card, type on paper.

**Withhold the builder's reasoning.** The reviewer gets a clean context and the two images, nothing else. Blind A/B where possible.

**Inspect real pixels.** Headless captures via Playwright or equivalent. A critic grading a photograph of a monitor is grading the photograph.

**Where a loop will and will not help.** It is strong on the render, where the bar is visual and inspectable. It is actively risky on layout and information architecture, where a critic can only see the surface and will therefore polish presentation while the structure stays wrong. Do not point a loop at the question of whether the war table frame is correct; that decision is already made and a critic cannot evaluate it.

---

# ANSWERED — Claude, 2026-07-28

## §12.1 — what THRONE, SEAT and COURT actually do

Read from the repo, not inferred. The brief's instinct (four surfaces for one job)
is right about the overlap and slightly wrong about the shape:

- **THRONE** (`readThrone` → `ThronePanel`) is a **pure reading, with no acts of its
  own.** It folds delegation debt: fiefs lorded / in regency / unlorded, every seat
  under load with its oldest case, the Regent's own load called out separately, and
  work resting on no real desk — plus the stakes (coffers, patrons, wavering,
  withdrawn, crises). Its single act is a road to SEAT.
- **SEAT** (`SeatPanel` → `RegentActions`) is **where the acts live.** Two cards:
  *Identify → put in motion* (raw untriaged intake walked down the catalog tree —
  the ONLY place raw intake is typed) and *Delegate to escape* (each queue with
  "Hand all N to …"). This is the catch-basin console.
- **COURT** (`readCourt` → the docket, plus the shared `court_roll`) is **not the
  Regent's desk at all.** It is a cross-cutting priority queue: every matter in the
  realm that cannot move without the Crown's word, ranked by what it costs to leave
  (crisis > held coin > stopped cascade > standing debt), capped at 60 a sitting.

**So the merge is: THRONE + SEAT are one surface** — a state and the acts upon it,
which is precisely design law 6 and the A/E/P check. Splitting them was the bug.
**COURT should survive on its own**; it answers a different question (what is
heaviest across the whole realm) and folds from a different reading.

**And §6's two target screens already substantially exist.** The Census was rebuilt
on 2026-07-27 as a court hierarchy in four sections — Ⅰ the Crown, Ⅱ the Crown
offices with their Chancellors and hands, Ⅲ the land (lords → knights → squires),
Ⅳ the guilds and their artisans — with every subject managed where they stand. That
is "the offices" and "the people" in one surface, built. The rail collapse is
therefore smaller than the brief assumes: THRONE folds into SEAT, the Council aside
becomes a state rather than a destination, and CENSUS is already the pair.

## §12.2 — the data dependency, which the brief does not name

**The app holds no real parcels.** Every door the muster deals is working fluid —
invented streets (Cobblegate Lane, Millbrook Way) on invented owners. a firm's real
roster is A2, behind the deliberate data gate, attended, and has never been loaded.
So "roughly 200 pieces at real parcel positions" cannot be built today.

It splits cleanly, and only one half is gated:

- **Terrain: available now.** the generator DEM for Northreach is public data, no PII, no gate. It
  gets baked to a heightmap asset in the repo. The brief's argument for real
  geography holds in full.
- **Parcel positions: gated.** For the proving frame they are working fluid,
  scattered plausibly across the real relief. **This does not weaken the frame** —
  the frame is testing whether the TABLE reads as a photographed object, and a piece
  at an invented address is the same lump of painted lead as a piece at a real one.
  When the gate opens, positions swap in behind the same interface.

Stated so it is a decision on the record rather than a silent substitution.

## §1 — two details now stale

From the 2026-07-27 session, so the brief and the app agree: the rail's first item
is **MAP** (the living realm), and the card board it swaps to is **The Table**. The
bottom strip's "The cards" is gone.

## §5 + §12.2 — the naming reconciliation, and the hierarchy's shape

**I proposed renaming `readRealm` and `marches.ts` to clear the collisions. The
code says not to, and that is the better answer.** Recorded because the reasoning
matters more than the conclusion:

- **`Realm` as a bare type name is FREE.** `src/domain/realm.ts` exports
  `RealmReading` — the kingdom-wide fusion score (pods + crafts + unseated work +
  coffers; the number the Regent drives to zero). It is not a place and never was.
  The brief's `Realm` is a *polity*. Two different words already; nothing to rename.
- **`marches` must NOT be renamed.** It is a PERSISTED key on the Chronicle
  (`chronicle.marches`), so renaming it is a vault migration on every stored
  document — and "a stored value disagreeing with a constant after a rename" is the
  precise fault this codebase has shipped nine times. The user-facing collision is
  already solved (the surface is ERRANDS, §6). The frontier status below is the
  *value* `'march'` on a shire, not a module — no ambiguity at the type level.

So: **no renames, no migration, no churn.** The collision is a reader's problem, not
the compiler's, and it is answered by naming the new layer unambiguously and saying
in both files which "realm" is which.

### The two axes are orthogonal, which is why they compose cleanly

The existing model answers **who holds what work** — offices, fiefs, knights, pods,
patrons. The brief's hierarchy answers **where a door sits and under whose law**.
They meet at exactly two points, and at both they already agree: the brief's
**Knight** is the code's knight (a person, with a `pod` as their book of business),
and the brief's **Door** is the code's door. Everything else is new.

### The shape

A new `src/domain/tenure.ts` — records only, no UI (§7):

- **`Realm`** — a sovereign polity. `{ id, name, sovereign }` (Aldermarch / the Estates Commission). Its
  doc comment names `RealmReading` explicitly so the two senses never blur.
- **`Shire`** — a metro. Its `shire | march` standing is a **READING, not a stored
  field**, computed from the doors and the census, per the constitution. The brief
  called it "one status field"; a computed one is cheaper and cannot go stale.
- **`Fee`** — an owner group. **Explicitly non-geographic** (§5, §10.7): the type
  carries no bounds, no centroid, no polygon, so a future renderer cannot casually
  assume contiguity.
- Every door carries `realmId`, `shireId`, `feeId`, `knightId` from the first
  migration, as instructed.

### §12.2 — the promotion thresholds, picked

A march promotes to a shire when **all three** hold:

1. **≥ 25 doors.** Below that a metro is a toehold: vendor radius and drive time do
   not amortise, and one bad door is a fifth of the book.
2. **≥ 1 knight seated there** — someone actually covers it, not a pin on a map.
3. **No craft standing headless** — the household can serve it at all.

Numbers are working fluid and belong in a setting at the gate, like every other
rate. They are picked so the reading is exercisable now, not because 25 is sacred.

### Crown edicts — data only (§5)

`Edict { id, realmId, kind, dueOn, standing }` over the real obligations: licence
status, CE hours, disclosure, trust-account rules, filing deadlines. A compliance
calendar in costume, and functional rather than ornamental. **No UI this phase.**

Everything above is covered by the library resolution test's discipline: a rename
that orphans a name fails the build rather than rotting quietly.
