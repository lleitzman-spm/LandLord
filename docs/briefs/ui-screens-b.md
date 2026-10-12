# Brief: ui-screens-b (the audience and the charter)

**Your files:** `src/ui/screens/audience.ts`, `charter.ts`, `src/ui/css/screens-b.ts`, `src/dev/ui-screens-b.ts`.
**Read:** `src/ui/api.ts` (Screen, UICtx), `kit.ts`, `css/base.ts` (tokens and classes: use them), `icons.ts`, `marginalia.ts`, `portraits.ts` (`createPortrait`: art agents are filling these), `src/word/api.ts` (AudienceSession, AudienceTurn, Speaker, Mood, MicAPI), `src/audio/api.ts` (`voice`), `src/sim/types.ts`, `src/data/schema.ts` (IncidentDef, RankDef), `src/data/index.ts` (INCIDENT_BY_ID, RANKS, NPC_DEFS), `src/dev/fixture.ts`. Each file exports `create(ctx): Screen`; call `addStyle` inside `create`.

**The audience** (`audience.ts`, opened with an incident id) is the heart of "ruling by word". A petitioner stands before you and you talk it out.
- On open: `ctx.word.openAudience(id)`, `ctx.renderer.setMode('audience')`, `ctx.holdCrawl()` (release on close). Letterbox the view: the table stays visible, softened, behind.
- The **petitioner**: a large animated portrait (about 300px; `setMood` from each turn, `setTalking` while their line types out, eyes following the pointer), their name and a one-line descriptor (species, trade, how long they have lived there, tags), and small facts the ruler would know: rent, arrears, happiness as a face, revealed traits, and **what they remember** of you (two or three memory lines), since those are what make the conversation personal.
- The **matter**: the incident title in rubric with a drop cap, the herald line, and the timer.
- The **transcript**: a scroll of speech. Their lines type out with `ctx.audio.voice(seed, text)` blips; yours appear plain in a different hand. Keep the last few exchanges visible.
- **Your word**: a large text box with a microphone seal (hold to talk; partial transcript shows live), Enter to speak. While waiting for the reply, show the petitioner listening (a small "…" in their own style), never a spinner.
- **The Steward's whispers**: two to four small notes in the margin ("You might say: …") from `session.whispers`. Clicking one fills your box (it does not submit). If the transport is offline (`ctx.word.transport() === 'none'`), clicking a whisper rules directly via `session.choose`, and the box explains that plain choices are all the court can hear just now.
- When a turn comes back `done`: their final line, then a wax seal thumps down with the result text (`resultText`), any oath sworn is shown being entered in the ledger ("Entered among your oaths: …"), any trait revealed is noted, and a "So ruled" button closes. Closing restores `setMode('play')`.
- Leaving without ruling is allowed ("Bid them wait") and says what that means.
- Several petitioners may be waiting: show a small queue of their portraits to hop between.

**The charter** (`charter.ts`): the Crown's charter for the current rank as an illuminated document: the rank title in blackletter with an initial, the duty line (`RANKS[rank].duty`), each goal with a progress bar and its numbers, done ones sealed; what the next rank will bring (buildings, peoples, delegates, land, the tribute); the rival's name and standing against yours as a small tug-of-war. When `charter.ready`: a **ceremony**: `renderer.setMode('ceremony')`, the Crown's herald (portrait `npc: 'crown_herald'`) reads the next rank's `proclamation` (typed, with voice blips), a fanfare (`audio.sfx('fanfare')`), "Kneel" → `ctx.act({ type: 'accept_promotion' })`, then a flourish revealing the new title and what is unlocked.

Both must be handsome at 1280×800 and usable at 400×800 (portrait above, transcript below, the box pinned to the bottom).

**Dev entry.** `src/dev/ui-screens-b.ts`: a fake `UICtx` with a fake `WordAPI` whose `openAudience` returns a scripted session for the fixture's griffin incident (opening line, two canned turns, then a ruling with an oath), and `fakeSim(makeFixtureState('knight'))`. Screenshot the audience at open, mid-conversation, and sealed; the charter in progress and in ceremony; both sizes. Look; iterate until the audience feels like an occasion.
