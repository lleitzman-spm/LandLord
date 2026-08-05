# Writ — The Realm Map (the illuminated map, come alive)

*Staged for a **K3** build, orchestrated + reviewed + wired by **Opus**. Ratified in direction by
Edwin (2026-07-24): LandLord should feel like the one screen you live on — a Civ/Tropico map — not a
fancy spreadsheet. Now that a fief is a real property holding and a task carries a door, there is a
reason to **see** where the work, the problems, and the events are. This writ is the art bible + the
data contract + the leash. Read `docs/K3-PROFILE.md` and `docs/KINGDOM.md` before building.*

---

## The mission, in one line

Turn the War Table from a grid of parchment cards into **a stylized 3D realm you fly around** — the
illuminated medieval map on the table, *stood up and brought to life* — where every menu (the
Counting-house, the Ledger, a fief's detail) rises **over** the living land and dismisses back to it.
The map is the home; everything else is an overlay.

This is a **desktop** experience. Mobile is out of scope — do not spend a line on it.

## The failure this writ exists to prevent

A weird 3D render of an awkward cluster of grey boxes on an irregular plane. That is what a vague
spec gets. The lever between "cry from joy" and "programmer-art" is **specificity of art
direction**, not effort. Every section below is here to make the awkward-boxes outcome impossible.

---

## The art bible — the look, precisely

### The through-line (what makes it *ours*, not a Civ clone)

The realm is **an illuminated medieval map come to life.** The War Table's own palette — aged
parchment, gold leaf, ink — is the world's palette. Fief borders are drawn as **ink lines**, as on a
hand-drawn map. Place names are hand-lettered. The feeling to chase: *the map on the table rose up.*
Continuity with the existing War Table identity is non-negotiable — this is the same kingdom, seen
from above.

### Stylization: painterly (the Civ VI direction)

**Painterly stylized, not photoreal.** Flat/gradient and lightly toon-shaded materials, warm and
saturated but tasteful, soft ambient occlusion, gentle rim light — the clean painterly look of
**Civilization VI**. Low-poly forms with painted-looking surfaces. No PBR photorealism, no imported
photoscanned assets. All geometry is **procedural** (built in code) — which keeps it self-contained
*and* keeps it stylized.

### The land

A **shaped realm** — a small continent resting on a **parchment sea** whose edges dissolve into
un-inked vellum (that dissolve is our fog of war). Not a flat square: shaped coastline, gentle hills,
a river. The **Capital** sits at the center — the Crown's walled city and castle. Around it the
**fiefs**, each with its own terrain character (a river valley, a hill town, a coastal holding) so
each reads as a *place*, not a tile. **Roads of ink** link the fiefs to the Capital.

### The settlements (a fief = one agent's pod)

Each fief is a **town clustered around the knight's manor-keep**, ringed by a low wall or hedge,
flying a **banner in the fief's health color**:

- 🟢 `thriving` → green banner, tidy prosperous town
- 🟡 `strained` → amber banner, a town under strain
- 🔴 `failing` → red banner, a town in trouble

Town size grows with **doors held**. Prosperity (finer than the three bands) tints with **faith**
(0–100): a high-faith town is lush and warm-lit; a low-faith one is drab, weeds in the square.

### The buildings (a building = one door)

The doors are the land. Render them as stylized **timber-frame cottages**, and make their **state
legible at a glance** — this is the whole point, "see where the problems are":

- `held` → **alive**: warm-lit windows, a wisp of chimney smoke.
- `vacant` → **shuttered**: dark windows, grey, boarded.
- `crisis` → **in trouble**: scaffolding, or a visible plume of smoke / small fire — an unmistakable
  "something is wrong here."

**Variety so it is a real town, not fifty identical copies.** The data names a building's `kind`
(`manor`, `cottage`, `chapel`, `market`, `well`) — the *manor* is the knight's keep, the visual
anchor of the town; the rest give the town life. Beyond the named buildings you are free to add
**purely decorative** richness — trees, fences, carts, market stalls, wells, hedgerows, the banners,
the roads, the river, birds — as much as taste and framerate allow. **The data drives meaning; you
own the beauty.**

### Atmosphere & camera

- **Golden-hour light**, long soft shadows, warm sky. Slow-drifting clouds throwing soft shadow
  across the land. A gentle idle camera drift so the world breathes even when untouched.
- **Free camera**: orbit, pan, and zoom to fly the realm (map-style controls). Clicking a fief
  **swoops the camera down** to it as its panel rises.
- Banners and treetops flutter; chimney smoke rises. Small, tasteful motion — never busy.

### The reveal (this is the emotional hook — build it)

Before a muster stands, the realm is **unrevealed**: bare parchment, the ink compass, the
hand-lettered title, and a single invitation — *"The land lies unrevealed. Sound the war horn."* No
grid of identical empty cards (the thing we are killing).

When a muster deploys (`revealed` flips true), **the map inks itself in**: coastlines draw, the fog
peels back from the Capital outward, towns rise, banners unfurl. One cinematic moment. This single
transition is what replaces the old dozen-identical-vacant-cards empty state.

### Guilds & the frame

The living map is home. Around it, as **HTML chrome over the canvas** (not 3D objects in v1):

- A **guild advisor rail** down one side — the Civ advisors: each guild always present, its master's
  face or a vacant seat, click to open the guild. Styled to the world.
- A slim **command bar** to launch the Counting-house / Ledger / Census / Throne as overlays.
- A **discreet HUD** for the coffers and the Crown — a corner cartouche, **never a big
  "DELEGATION DEBT: 3" scoreboard.** Neglect is shown by the *state of the land*, not a score. The
  only real consequence is real: run out of coin → the Crown is overthrown. No invented doom clock.

---

## Scope fence — v1 (this writ) vs. v2 (a later, ratified swing)

**v1 — build this now.** The gorgeous 3D realm, folded entirely from readings that **already exist**
(pods, doors, faith, crises). Pods as towns, doors as buildings-with-state, crises visible, the
Capital, the fog-of-war reveal, the guild advisor rail + command bar + HUD chrome, the camera. The
render can look **fully fleshed out** (a rich, varied town) while the model underneath stays exactly
today's. **Art richness ≠ new model.**

**v2 — NOT in this writ (needs a KINGDOM.md ruling first).** Edwin's growing-city guild economy:
guild **headquarters in the Capital** + **outposts in the fiefs tied to assigned budgets**, building
types per guild, development levels that grow like Civ cities. This is a genuinely new model
(new records, new readings, ratified canon) and will be its own swing. Do **not** invent it here.

---

## The firewall — the data contract (render this; compute no domain state)

**This is the most important rule for a K3 build.** K3 once invented a fictional world and stored
consequences, breaking the events-only law, and was discarded. To make that impossible: the view is
handed a **fully-resolved `RealmScene`** and **renders it**. It computes **no** kingdom state — no
faith math, no crisis detection, no "who holds what." Opus builds the pure reading
`readRealmScene(...)` that produces this; the view is a pure function of it.

```ts
// The SOLE input to the 3D realm. A pure reading, folded from the records by
// readRealmScene() (Opus builds this). Positions are deliberately ABSENT: the
// view DERIVES every position deterministically from the stable ids below (a
// hash → a point), so the same realm always draws the same and nothing is ever
// stored. Never Math.random() for layout — only for idle motion, if at all.
interface RealmScene {
  realmName: string;              // "LandLord" — the hand-lettered map title
  kingName: string;               // the Capital's banner
  regentName: string;
  revealed: boolean;              // false ⇒ fog of war, bare parchment (no muster stands)
  fiefs: SceneFief[];
  guilds: SceneGuild[];           // for the advisor rail (not placed in v1)
  coffers: { trend: number; fallen: boolean };  // the discreet HUD only
}

interface SceneFief {
  id: string;                     // STABLE — drives the fief's position on the continent
  name: string;                   // the knight's name (hand-lettered on the map)
  seatLabel?: string;
  health: 'thriving' | 'strained' | 'failing';  // banner color + town condition
  faith: number;                  // 0..100 — finer prosperity tint
  doorsHeld: number;
  capacity: number;               // town's built-out potential
  buildings: SceneBuilding[];
}

interface SceneBuilding {
  id: string;                     // STABLE door slug — drives position within the town
  kind: 'manor' | 'cottage' | 'chapel' | 'market' | 'well';  // manor = the keep
  state: 'held' | 'vacant' | 'crisis';          // alive / shuttered / smoking
  label: string;                  // the door's address — the hover tooltip, plain voice
}

interface SceneGuild {
  id: string;
  name: string;                   // e.g. "Property Management", "Leasing"
  manned: boolean;
  masterName?: string;            // undefined ⇒ a vacant advisor seat
}
```

**Interaction is via stubbed callbacks** the view calls and Opus wires:
`onSelectFief(id)`, `onSelectBuilding(fiefId, doorId)`, `onSelectGuild(id)`, `onOpenPanel(name)`,
`onDeployMuster()`. The view never reaches into the store or the domain itself.

---

## The leash — rules that do not bend

1. **Render-only / reading-first.** The view computes no domain state; it is a pure function of
   `RealmScene`. Positions are a **deterministic function of the stable ids** (hash → point) —
   stable across reloads and state changes, never stored, never random.
2. **Self-contained.** Everything bundles. **No CDN, no external asset fetch at runtime** — no
   remote model files, textures, or fonts. Geometry is procedural; any texture is procedural or a
   tiny inline data-URI. (The app runs behind a wall; the network is not there for it.)
3. **Painterly, not photoreal.** Per the art bible. Low-poly + painted materials + soft light.
4. **The palette is the app's.** Use the `--wt-*` tokens: vellum `#e8dcbb`, gold `#c7a44e`, ink
   `#ece3cf`/`#a89d83`, green `#5aa168`, amber `#d19a33`, red `#c0492f`. The world is continuous with
   the War Table, not a different art game.
5. **The voice is the kingdom's.** Plain-English medieval (KINGDOM.md law 1). Labels, tooltips,
   the empty-state copy — recognizable words, never glossary flavor.
6. **Synthetic data only.** The scene only ever carries working-fluid door slugs. No real address,
   no real figure, ever — the data gate is closed (KINGDOM.md, the walls).
7. **Desktop, and performance.** Target a steady **60 fps** on a normal desktop GPU with a **full
   muster (~a couple hundred doors)**. Use **instanced meshes** for repeated buildings/props, frustum
   culling, capped pixel ratio. A beautiful realm that stutters is a failed realm.

---

## The stack (pinned)

- **React + `@react-three/fiber` + `@react-three/drei` + `three`** — the declarative, React-native
  way; keeps the scene reviewable (a tree of components), not a 2000-line imperative WebGL blob.
- Bundled by the app's existing Vite build. Add the deps; do **not** load three from a CDN.

---

## Deliverables (what K3 hands back)

A **standalone, self-contained artifact** that renders against a **canned `RealmScene` fixture** with
**stubbed callbacks** (so it runs and looks finished before it is wired):

1. `src/realm/RealmView.tsx` — the top component: the `<Canvas>`, camera + controls, lighting,
   sky/sea, the fog-of-war reveal, and the HTML chrome (advisor rail, command bar, HUD) over it.
2. Its subcomponents (your structure) — e.g. `Continent`, `Fief`/`Town`, `Building`, `Capital`,
   `Clouds`, `AdvisorRail`, `CommandBar`, `Hud`.
3. `src/realm/scene.ts` — the `RealmScene` types **exactly as above** + a rich **canned fixture**
   (`SAMPLE_REALM`) exercising every state: several fiefs across all three healths, a mix of
   held/vacant/crisis buildings, a manned and an unmanned guild, and a `revealed:false` variant for
   the empty state.
4. `src/realm/deriveLayout.ts` — the deterministic id→position helpers (hash-based), documented.
5. A short `src/realm/README.md` — how to view it standalone, and the design choices.

**Do not wire it to the store, invert the app shell, or touch the domain.** That is Opus's half
(below). Build the beautiful, self-contained piece; leave the seams clean.

---

## The division of labor

- **K3 builds** the standalone art-directed artifact above, against the canned fixture. Its #1 lane
  (the build arenas rank it first at exactly this). Reviewed hard for art + house-fit.
- **Opus (this session) then**: writes the real `readRealmScene()` pure reading (the firewall);
  wires K3's callbacks to the real panels and store; inverts the shell so the realm is the home view
  and the existing overlays rise over it; keeps the **old card War Table reachable behind a toggle**
  through the transition (a safety net — removed once the realm is solid); browser-verifies on
  desktop; ships on clear.
- **v2** (guild HQ/outpost/budget growing-city economy) is a separate ratified swing — likely an
  independent Kimi-vs-Opus design panel per the hard-design rule.

---

## Acceptance & verification (Opus, before ship)

- `npm run build` green; app boots; **0 console errors**.
- The standalone artifact renders `SAMPLE_REALM`: the realm draws, the camera flies/orbits/zooms,
  towns and buildings read their state at a glance (held/vacant/crisis all visibly distinct), a fief
  click swoops + fires `onSelectFief`, a building hover shows its plain-voice label, the guild rail
  renders manned + vacant seats.
- The **empty state** (`revealed:false`) is the bare-parchment invitation — no grid of cards — and
  flipping `revealed` runs the **ink-in reveal**.
- **~60 fps on desktop** with the full-muster fixture; no jank; instancing in place.
- **Painterly and continuous with the War Table palette** — not programmer-art, not a different art
  game. Opus screenshots desktop and reviews the whole diff for fidelity + house-fit before ship.

## Anti-patterns (do not)

- Grey untextured boxes on a flat plane. Uniform copies. A cold/technical or neon look.
- Reaching into the store/domain; computing faith/crisis/holdings; storing positions or scene state.
- CDN/asset fetches. Photorealism. Mobile layout work. Inventing the v2 guild economy.
- A big numeric "delegation debt" scoreboard. A doom clock. Anything that fights real function.
