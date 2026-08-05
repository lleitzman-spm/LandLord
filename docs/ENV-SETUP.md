# The environment's setup — what must be installed before a session can work

The remote container is **ephemeral**: it is cloned fresh at session start and reclaimed when
the session ends. Anything installed by hand dies with it. That is what this file is for — the
things a session needs that are not in `package.json`, written down so the next session does not
have to rediscover them, and so they can be pasted into the environment's setup script on
claude.ai (Claude Code on the web → the environment → setup script).

## Blender (the 2.5D art pipeline)

Paste into the environment setup script:

```sh
apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends blender
```

`apt-get update` is **not optional**. Without it the install fails on stale package URLs — eight
dependencies 404 (libva2, libcaca0, libgphoto2, libmysqlclient21, libraw23t64 and friends) and
apt exits 100 having installed nothing. Verified the hard way, 2026-07-28.

**The setup script does NOT yet carry this** — checked 2026-07-28 (later session): a fresh container
came up with no `blender` on `PATH` and no `bpy` module, so the paste above has not been applied to
the environment on claude.ai. **Until Edwin pastes it, every session must run that line by hand
before planning any render work.** It takes about two minutes and pulls ~230 packages; it works —
run and verified this session.

Verify with `blender --version` (expect 4.0.2 on Ubuntu noble), and prove it actually renders
before trusting it — a version string is not a working renderer:

```sh
blender --background --python tools/bl-smoke.py     # writes $BL_SMOKE_OUT, else $TMPDIR/bl-smoke.png
```

Look at the image, do not just read the exit code: the smoke scene is a cube on a plane under one
sun, and what proves the renderer is the **cast shadow** falling on the plane. 24 samples, CPU,
about 2.5 seconds.

### The distro build has NO OpenImageDenoiser

Ubuntu's `blender` package is built without OIDN. Any script that leaves Cycles' denoiser on
dies with `RuntimeError: Error: Build without OpenImageDenoiser` and writes no image. Every
render script must therefore set:

```python
scene.cycles.use_denoising = False
```

and pay for clean output in samples instead. If denoising turns out to be worth having, the
alternative is the official wheel — `pip install bpy` (5.0.1 and the whole 4.2/4.5 line are on
PyPI, and this container's Python is 3.11.15, which those wheels want). The wheel ships the
full official build, OIDN included, and needs no apt at all. It is the better answer if the
apt build's omissions start to bite; it is only heavier to download.

### What it is for

Not for shipping 3D. The realm map is **illustrated 2.5D** (Edwin, 2026-07-28) — the browser
composites flat images, it does not run a 3D scene. Blender is the OVEN, not the plate: model a
piece once, render it from fixed angles under real ray-traced light, and ship the resulting PNGs.
Shadows, anti-aliasing, depth of field and occlusion are then baked into the picture and cost the
browser nothing, instead of being reimplemented by hand in a shader. See the 2026-07-28 entry in
HANDOFF for why we stopped hand-rolling the renderer.

## Chromium (already present, do not install)

`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` with the chromium already at
`/opt/pw-browsers/chromium`. Never run `playwright install`.

**There is no GPU.** WebGL falls back to SwiftShader, so any frame-rate number measured in this
container is the software rasterizer, not the scene. Performance cannot be certified here — say
so rather than reporting a figure that looks like a measurement.
