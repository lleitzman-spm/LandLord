# Brief: render-buildings (housing, the seat, and the wrapper every building passes through)

**Your files:** `src/render/buildings/index.ts`, `parts.ts`, `housing.ts`, `seat.ts`, `wear.ts` (and any others you add under `src/render/buildings/` EXCEPT `civic.ts`, `civic-*.ts` and `types.ts`), `src/dev/gallery-buildings.ts`.
**Read:** `src/render/api.ts` (BuildingLook, BuildingVisual, Env, RenderCtx), `src/render/buildings/types.ts` (BuiltBody, BodyBuilder), `palette.ts`, `src/data/buildings.ts` (footprints are frozen), `ids.ts`.

`createBuildingVisual(look, ctx)` is the one door every building comes through. It picks a **body** and wraps it in the shared systems.

**Bodies you build** (each a `BodyBuilder`, authored in local space, fitting the footprint with about 0.15 margin; `look.variant` drives colour, door, props, mirroring and a little crookedness so no two look stamped):
- `hovel` (2×2): small, crooked wattle and daub, shaggy thatch, one tiny window, a smoke hole, a mud patch and a bucket.
- `cottage` (2×2): timber frame and cream plaster, thatch with a dormer, stone chimney, flower box, a scrap of fence.
- `burrow` (2×2): a grassy mound with a round door, round windows, a stovepipe, stepping stones.
- `longhouse` (3×2): long low thatch, two doors, a shared wall you can see.
- `stonehall` (3×2): dwarven: squat fitted stone, slate roof, iron-banded doors (two), a carved lintel.
- `townhouse` (2×3): three jettied storeys of timber frame leaning over the street, tile roof, a window per floor (one per unit).
- `treehouse` (2×2): a great oak with a house in its fork, rope ladder, lanterns; the canopy follows the season.
- `wizard_tower` (2×2): tall, slightly bent stone tower, conical slate roof, a lit window near the top, something orbiting it.
- `seat` (3×3) by `look.level`: 1 the Reeve's hut (a larger cottage with a banner pole and a bench), 2 a manor (two wings, tile roof, a yard), 3 a keep (stone, crenellations, a corner turret, banners, a gate).
For any other type use `CIVIC_BUILDERS[type]` from `./civic` (another agent is writing it); if a builder is missing fall back to a plain but decent generic body.

**The wrapper** (works on any body through its `walls`, `roofs`, `windows`, `anchors`):
1. **Construction** (`state: 'building'`): foundation stakes and string first, then scaffold poles and the body rising with `progress` (clip or scale it up from the ground), a sawhorse and timber pile. Finished: remove the scaffold with a little bounce.
2. **Wear** by `condition`: under 75 patchy thatch and moss; under 50 a visible lean, a boarded window, grimy walls; under 25 holes in the roof, a prop holding a wall, weeds; `ruined`: roof fallen in, rubble, crows.
3. **Life**: for occupied units, windows glow warm as `env.night` rises (flicker slightly) and the chimney is a smoke anchor; empty units stay dark.
4. **TO LET** shingle on a post by the door when `look.toLet`, swinging in `env.wind`.
5. **Snow** from `env.snow`: caps on roofs, drifts at the walls.
6. **Flags**: `purple` (walls and roof go a loud purple), `hearth_right` (a small goblin banner), `gargoyles`, `haunted` (a cold tint).
7. `set(look)` rebuilds only what changed; `update(env)` is cheap (no allocation).
Share geometries and use `palette.mat` so the scene batches well: a town of 60 buildings must stay light.

**Dev gallery.** `src/dev/gallery-buildings.ts`: a lit turntable scene (no dependency on render/index) laying out every housing type and seat level in rows: pristine, worn, wrecked, under construction, at night, in snow. Screenshot, look, and iterate until each building has character and reads clearly at game distance (the camera usually sees a building at about 80 to 160 pixels wide) as well as close up.
