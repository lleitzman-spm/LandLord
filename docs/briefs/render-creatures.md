# Brief: render-creatures (incident visuals)

**Your files:** everything under `src/render/visuals/`, `src/dev/gallery-visuals.ts`.
**Read:** `src/render/api.ts` (VisualHost, VisualHandle, BuildingVisual anchors, Env, RenderCtx), `palette.ts`, `src/data/ids.ts` (VISUALS: all 36), `src/data/incidents/system.ts` and `examples.ts` (to see how visuals are used).

`createVisual(id, host, ctx)` returns the thing the player sees on or around a building while an incident lasts. These are the game's punchlines made visible. Use `host.visual.anchors` (roof perch, door, chimney, windows, top) and the footprint (`host.look.w`, `host.look.h`) to place things; your group is added in the building's local space. Each handle has a cheap `update(env)` and a `leave(done)` exit (fly off, scurry away, pop, fade).

Hero pieces, done with love:
- `griffin_roof`: Gerald. A low-poly griffin (eagle head, lion body, wings) perched on the roof: preens, looks around, flexes his wings, occasionally nibbles a bent weathervane. Leaves by flying off.
- `goblins_windows`: goblin heads popping up at windows, the door and over the roof ridge, ducking back; a line of someone else's laundry as curtains; a tiny flag.
- `small_dragon`: a cat-sized dragon curled on the chimney, puffing smoke rings, tail twitching.
- `ghost`: a pale sheet-like figure drifting through a wall and back, faintly glowing.
- `fire`: flickering flames from roof and windows, embers, a warm pulsing glow.
- `tax_cart`: the Crown's cart by the door with a chest and a bored mule.

And the rest, each recognisable at a glance: `purple_paint` (dripping paint pots and purple motes), `rats` (several, scurrying a loop), `flood` (a lapping water sheet with a floating barrel), `black_smoke`, `leak` (drips and a bucket), `hole_roof` (a tarpaulin flapping), `vines`, `sparkles`, `bees` (a swarm cloud and a hive), `chickens` (pecking about the yard), `cracked_wall` (a jagged crack and a timber prop), `snowed_in` (a drift over the door), `frozen` (icicles, a blue sheen), `party` (bunting, lanterns, bobbing notes), `bats`, `mushrooms`, `boarded` (planks over door and windows), `quarantine` (a yellow flag and a chalk mark), `sheep` (three, grazing where they should not), `mud`, `curse_cloud` (a small private storm cloud with tiny lightning), `crown_banner`, `stork_nest`, `laundry`, `gargoyle`, `toadstool_ring`, `cauldron` (bubbling, green glow), `scarecrow`, `graffiti` (a rude chalk drawing of a landlord on the wall), `bunting`.

Keep them light (shared geometry, `palette.mat`, emissive for glow; no real lights). Animate with `env.time` and `env.wind`; respect `env.night` (glows read at night).

**Dev gallery.** `src/dev/gallery-visuals.ts`: your own lit scene (no dependency on render/index) with a grid of simple stand-in houses built from the placeholder `createBuildingVisual` in `src/render/buildings/index.ts` (or your own box house with honest anchors), one visual each. Screenshot with `--shots` for motion; look; iterate until Gerald is someone you would refuse to evict.
