# Brief: render-civic (bodies for trade, amenity and staff buildings)

**Your files:** `src/render/buildings/civic.ts` and any `src/render/buildings/civic-*.ts` you add, `src/dev/gallery-civic.ts`.
**Read:** `src/render/buildings/types.ts` (BuiltBody, BodyBuilder: this is what you return), `src/render/api.ts` (BuildingLook, Env, RenderCtx, the local-space convention), `palette.ts`, `src/data/buildings.ts` (footprints are frozen; read each blurb for character), `ids.ts`.

Another agent owns the wrapper that adds construction, wear, snow, night windows and the TO LET sign to whatever body you return. You return the **pristine body only**, with honest `walls`, `roofs`, `windows`, `anchors` (door, roof perch, chimney, top, window points) and an `animate(env)` for motion that belongs to the model. Fit the footprint with about 0.15 margin. Use `look.variant` for colour, props and mirroring.

Fill `CIVIC_BUILDERS` for all eighteen:
- `market_stall` (2×1): plank counter, striped awning, crates of produce or cheese or fish, a hanging scale.
- `bakery` (2×2): plastered shop with a big domed oven chimney, a pretzel sign, loaves on a sill.
- `smithy` (2×2): open-sided forge with a glowing hearth (emissive, pulsing), anvil, quench trough, tools on a rail.
- `mill` (3×3): a windmill; the sails turn with `env.wind`; sacks and a cart.
- `apothecary` (2×2): crooked shop, bottle-green windows, hanging herbs, a mortar sign, coloured smoke from a thin chimney.
- `tavern` (3×3): big two-storey inn, tile roof, a swinging sign, barrels, benches, warm windows.
- `well` (1×1): stone ring, little roof, bucket on a rope that sways.
- `garden` (2×2): cabbage rows, marigolds, a wattle fence, a scarecrow or beehive by variant.
- `notice_board` (1×1): a post-and-plank board with fluttering parchments.
- `shrine` (1×1): a small gabled niche with a saint and a candle.
- `stocks` (1×1): wooden stocks on a little platform, a rotten cabbage nearby.
- `statue` (1×1): a plinth with a heroic, slightly smug figure in a cloak, a pigeon on its head.
- `watchtower` (1×1): a timber tower with a roofed platform, ladder, a small banner.
- `chapel` (2×3): stone nave, steep slate roof, a bell-cote with a bell, a round window, a lych gate.
- `masons_yard` (2×2): an open shed, stacked stone and timber, a half-carved block, a hoist.
- `bailiffs_post` (2×2): a stout stone-and-timber lockup, barred window, a board of keys, a notice post.
- `criers_stand` (1×1): a painted box to stand on, a bell on a post, a small canopy.
- `counting_house` (2×2): a neat brick-and-timber office, shuttered window with a counter, a strongbox, scales on the sign.

**Dev gallery.** `src/dev/gallery-civic.ts`: your own small lit scene (ground, one warm key light with soft shadows, hemisphere fill, ACES; no dependency on render/index) with all eighteen laid out on a grid with footprint outlines. Screenshot from two angles and close on a few; look; iterate until each is recognisable at a glance at game distance (about 80 to 160 pixels wide) and charming up close. Keep meshes light: share geometry, use `palette.mat`, no textures except small canvas-drawn signs.
