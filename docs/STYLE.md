# LandLord — style guide (words and looks)

Everything a player reads or sees should feel like it came from one hand.

## The voice

**Dry, deadpan, bureaucratic-medieval.** The comedy engine: *a real property-management situation, played perfectly straight, in a world where the tenant keeps a griffin.* Nobody in the world thinks any of it is funny. The herald reports a goblin committee the way a clerk reports a late filing.

What makes a line land:
- **Specific nouns.** "It has eaten a weathervane." Not "it caused damage."
- **The petitioner has a point.** Tenants are people with reasonable grievances and bad timing, never villains. No jokes at the expense of being poor.
- **The landlord is the butt as often as anyone.** The statue of yourself, the pigeons' opinions.
- **Understatement and the deflating last clause.** "They hung curtains. The curtains are someone else's laundry."
- **Legalism.** People argue the wording. "The lease says no livestock. A griffin eats livestock."
- **Every option is defensible.** No outcome is "the evil one". Trade-offs, not morality tests.

Rules:
- **No em dashes or en dashes in any player-facing text.** Use full stops, commas, colons.
- No modern slang, brands, real people, pop-culture nods, or winks at the player. No "lol random". No exclamation marks except from goblins, criers and heralds reading proclamations.
- Plain English with a medieval lean: "surety", "writ", "Rent Day", "my lord". No thee/thou/prithee/forsooth. Short sentences.
- Mild peril only. No gore, nothing sexual, no real-world politics or religion (the in-world church is gentle parish comedy).
- Fantasy species must not map onto real-world peoples. Their humour comes from how they behave *as tenants* (below).
- Length caps: herald lines 150 characters; audience openings 240; replies 200; outcome labels 32; results 170.
- Address the ruler by rank where it helps: "Reeve", "Sir", "my lord" (use `{title}`).
- Never mention models, AI, prompts, or the game being a game.

### The costume for real property management

| Real thing | In LandLord |
|---|---|
| Security deposit | the surety |
| Lease | the lease (a scroll, sealed) |
| Normal wear and tear | honest wear |
| Late fee, grace period | late fee, grace days |
| Notice to vacate | Notice to Quit, nailed to the door |
| Eviction court (slow) | the Reeve's Court |
| Cash for keys | coin for keys |
| Squatter's rights | hearth-right, after a year and a day |
| Fair housing law | the Fair Hearth Edict |
| Housing inspector | the Crown's Assessor of Dwellings |
| HOA president | the Warden of the Commons |
| Property tax | the Crown's tribute |
| Tenant screening / references | asking their last landlord |
| Pet rent, pet deposit | pet rent, a surety against the thatch |
| Unauthorized occupant, subletting | a cousin who is "visiting", letting the pantry |
| Renters' insurance, the adjuster | dragon cover, the dragon adjuster |
| Work order, vendor no-show | sending the Mason, the Mason is "waiting on a part" |
| Rent control | the Crown's cap on rises |

### Species as tenants

- **Humans**: the baseline mess. Excuses, feuds over fences, chickens.
- **Halflings**: model tenants obsessed with food and comfort. Pay in full with a seed cake. Sublet the pantry. Second breakfast noise complaints. Round doors.
- **Dwarves**: contract literalists and compulsive renovators. Pay to the minute. Dig unauthorized cellars. Consider anything built after their grandfather "new build, shoddy".
- **Goblins**: chaotic lovers of bureaucracy. Adore forms, stamps, committees, receipts, triplicate. Fourteen to a hovel "for efficiency". Scrupulous about rules they made up. They are funny because they are officious, never because they are stupid or dirty.
- **Elves**: insufferably long-term. Want 400-year leases. Complain the oak was pruned in the wrong century. Polite in a way that feels like being marked down.
- **Ogres**: enormous, gentle, mortified by the damage they cause. Apologise to doorframes. Excellent with children and bad with stairs.

### Delegate voices

- **Mason**: sucks teeth, names a price, blames the previous mason. Perfectionist (slow, proud), Bodger (fast, "it'll hold"), Dreamer (adds gargoyles nobody asked for), Steady (says little, shows up).
- **Bailiff**: Iron (court-first, relishes the knock), Soft (asks about their mother, forgives), Grasping (fees, and some stick to the fingers), Lawful (the letter of the charter, to the day).
- **Crier**: Honeytongue (oversells: "river views" of a ditch), Honest ("it leaks, but only when it rains"), Snob (only "persons of quality"), Bellower (LOUD; the neighbours complain).
- **Steward**: Pennypincher (begrudges every nail), Openhanded (generous with your money), By-the-book (forms, in order), Schemer (clever, loyal mostly to the plan).

The herald (the notification feed) is one voice throughout: a tired court clerk with perfect composure.

## The look

**A painted miniature town on a candle-lit oak war table in a dark room.** Low-poly, flat-shaded, matte: carved wood and plaster, hand-painted with a slightly limited palette. Charm from light, motion and detail, never from polygon count. Target: a lovingly made tabletop diorama you want to lean into.

- **Palette**: `src/render/palette.ts` is the law. Warm candle key light against cool blue fill. Saturation stays modest; gold and rubric red are accents.
- **Scale**: 1 tile = 1 unit. A hovel is about 1.5 wide and 1.3 tall. **Figures are chunky and oversized (about 0.42 tall)** like board-game pieces, so they read at a distance.
- **Buildings**: timber frame, cream plaster, thatch or tile or slate. Slightly crooked. Each has a door, windows that glow at night, a chimney that smokes when someone lives there, and small yard clutter. Condition shows: missing thatch, a lean, boarded windows, moss. A swinging "TO LET" shingle when vacant.
- **Figures ("living figurines")**: turned-wood peg bodies, a round head with a painted face (eyes that blink, brows that move), a hat or tool for their trade, **two floating mitten hands** and no arms or legs. They waddle (rock side to side), hop, look at things, wave, shake a fist, carry sacks, nod off at night. Life comes from behaviour.
- **The table**: the realm is a raised board on the table. Around it sit real objects that mean things: the coffer whose coin pile grows with your gold, the ledger, the charter scroll, candles that burn down through the month.
- **Light**: candles are the light. Dawn on Rent Day, long gold afternoon, blue dusk, short night with glowing windows. Soft shadows. A tilt-shift blur at the top and bottom of the view makes it read as miniature. Gentle vignette, a little bloom on flames and lit windows.
- **Motion**: buildings pop in with a bounce and a puff of dust; coins arc to the coffer on Rent Day; chimneys smoke; trees sway; the griffin shifts on its roof; goblins peek from windows and duck.
- **Seasons**: spring blossom, deep summer green, autumn orange with falling leaves, winter snow on roofs and ground.

### The interface: an illuminated manuscript

Panels are **parchment** lying on the table: cream vellum, ink text, **rubric red** headings (authentic rubrication), **gold leaf** and **lapis blue** for illumination, blackletter only for the logo, drop caps and rank titles. Margin doodles in the medieval manner (snail knights, jousting rabbits, a goose in a bishop's hat). Controls are wax seals and inked labels. Tokens and base classes: `src/ui/css/base.ts`. Fonts: UnifrakturMaguntia (blackletter), IM Fell English SC (headings), IM Fell English (body).

It must stay *usable*: clear hierarchy, readable sizes (never below 12px), obvious clickables, no ornament that fights the content. The table is the star; panels are compact and get out of the way. Works with mouse and touch, at laptop size and at phone width.

Portraits are **code-drawn ink-and-wash faces** in a roundel, assembled from parts so there are unlimited characters in one style, and they move: blink, talk, and change expression.
