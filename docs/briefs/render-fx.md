# Brief: render-fx (particles, weather, atmosphere)

**Your files:** `src/render/fx.ts` and anything under `src/render/fx/`, `src/dev/gallery-fx.ts`.
**Read:** `src/render/api.ts` (Fx, Env, RenderCtx), `palette.ts`, `src/sim/types.ts` (WeatherKind, MAP_W, MAP_H).

`createFx(ctx)` owns every particle on the table. Pooled, allocation-free in the frame loop, a handful of draw calls in total (InstancedMesh or Points with small canvas-drawn sprites).

- `coins(from, to, n)`: gold discs arc from a roof to the coffer, spinning, staggered, each landing with a glint. The Rent Day money shot: twenty households paying at once must look glorious and stay cheap.
- `puff` (dust poof for construction and landings), `sparkle` (magic, success), `hearts`, `confetti`.
- `smoke(at, opts)`: soft blobs rising from chimneys, leaning with `env.wind`, thinning as they climb; a dark variant. Dozens of emitters at once.
- **Weather** over the board only (`setWeather`): `rain` (streaks, small splashes), `storm` (heavier, with lightning: a brief cold flash you expose as a readable value `flash` 0..1 on the returned object as well as showing it), `snow` (slow drifting flakes), `hail`, `fog` (low drifting sheets), `heat` (a pale shimmer of rising motes), `clear`. Cross-fade between kinds.
- **Atmosphere, always on**: dust motes drifting in the candlelight above the table; falling leaves in autumn; blossom petals in spring; fireflies on summer nights (`env.night`); a few birds crossing by day.
Everything respects `env.speed` loosely (paused: weather hangs almost still, motes keep drifting).

**Dev gallery.** `src/dev/gallery-fx.ts`: your own lit scene (a ground slab, a few boxes for roofs, a box for the coffer; no dependency on render/index) with `window.__dev` hooks to fire each effect and switch weather. Screenshot with `--shots`; look; iterate. Report the draw-call count.
