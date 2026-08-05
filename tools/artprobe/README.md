# The art probe — two pipelines, one holding

> **The 3D asset kit is not vendored here.** This probe originally ran against
> the free Kenney and KayKit medieval kits, which were not carried into the
> public repository because no licence file accompanied the binaries in the
> tree. Download the kits yourself into `tools/artprobe/kit/` (models as
> `*.glb`, textures under `kit/Textures/`) and keep their licence files beside
> them. Until you do, the `?mode=3d` and `?mode=sprite` frames render nothing.
> The finding this probe produced is written up below and stands without it.

Edwin, 2026-07-29: the board *"looks very crappily handdrawn vs a kind of 2d
render like in a game"*, and *"we're clearly abysmal at it — we want to just use
the art assets that are out there."* He asked to decide from frames, not from
anyone's description of them.

So this renders the SAME holding two ways and screenshots both:

```
npx vite tools/artprobe --port 5300
node tools/artprobe/shoot.mjs          # writes art-3d.png and art-sprite.png
```

* `?mode=3d` — a live three.js scene.
* `?mode=sprite` — every model baked ONCE through that same renderer to a PNG,
  then composited flat, which is the shape of the pipeline the board uses today.

The camera, the light rig and the layout are shared and live in `holding.js`, so
any difference between the two frames is the PIPELINE and not the scene. A
comparison whose two sides deal different houses proves nothing.

## What the frames showed

They are nearly identical. That is the finding: because the sprites are baked by
the same renderer, the flat pipeline inherits the real contact shadows, the real
anti-aliasing and the real lighting. **The choice is therefore not about looks.**

The one visible difference is the keep — properly stacked base/mid/roof in the
live scene, a plain box in sprites — and it points at the real trade: a composed
object is free in a live scene and must be pre-composed for sprites.

## Two bugs this probe cost, both worth remembering

* **The first sprite frame came out blank.** `project()` reads the shared
  camera, but the baked pipeline never RENDERS with that camera, so its
  `matrixWorldInverse` stayed at the identity and every point folded onto one
  spot. The live pipeline gets those matrices free from the renderer. Call
  `updateProjectionMatrix()` and `updateMatrixWorld(true)` by hand.
* **Models arrived untextured.** Kenney's kits reference a shared
  `Textures/colormap.png` beside the models; copying only the `.glb` files gets
  you geometry in flat white. Copy the atlases too.

## The assets

Kenney (kenney.nl), **CC0** — public domain, no attribution required, commercial
use fine. That matters for a real product: no licence to track, nothing to
attribute in a UI that has no room for it.

`kit/` holds a staged subset: 21 complete suburban buildings, castle tower
pieces and banners, trees, and the shared texture atlases the models reference.

Kits pulled: `city-kit-suburban`, `castle-kit`, `nature-kit`. The
`fantasy-town-kit` was fetched and REJECTED for this pass — it is 63 wall pieces
and 26 roofs, a modular construction kit rather than whole houses, so it needs
assembly before it can put a single door on a board. Worth revisiting only if we
decide the medieval geometry matters more than the delivery speed.
