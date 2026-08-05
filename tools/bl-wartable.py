"""
The proving frame — WRIT-THE-WAR-TABLE §11, baked in the oven rather than
hand-rolled in a shader.

    blender --background --python tools/bl-wartable.py

Reads the scene baked by `tools/bake-table-scene.mjs` — the invented realm
(KINGDOM.md, ratified 2026-07-28) or, with `--baked`, the retired real ground —
and the real 203 doors from src/table/parcels.ts. Writes one PNG.

Env knobs, so a composition check does not cost a final render:
    BL_SCENE    path to the baked json      (default public/table-scene.json)
    BL_OUT      output png                  (default $TMPDIR/wartable.png)
    BL_RES      long edge in px             (default 1600)
    BL_SAMPLES  cycles samples              (default 128)
    BL_PROBE    print where things land in frame, render nothing
    BL_KEY_AZ / BL_KEY_EL / BL_FSTOP / BL_DIST / BL_ELEV / BL_AZ / BL_TGT_*

WHAT THIS IS ANSWERING. Blind critics measured the frames and named the faults;
some a real renderer fixes for free (anti-aliasing, lens bokeh, no post-chain
fireflies) and the rest are decisions made here, marked FAULT n in the code:

  1 DENSITY — 203 pieces read as ~8 clusters. Pieces are sized to nearly
    touch at the layout's MIN_SEP so a lane reads as a row of roofs — and
    never to EXCEED it, or they interpenetrate.
  2 MONOCHROME — one olive hue did every job. Terrain ramps with elevation,
    walls carry state in VALUE not just hue, and the distress hue is spent
    nowhere else so a red spot can only mean trouble (palette law).
  3 RATIO — the model held about half the frame. The board is framed to fill
    it, aimed at where the shire is rather than the middle of the block.
  4 THE BAND — the tilt-shift was a screen-space band, not a lens. This is a
    real aperture, and it took two goes: f/0.35 measured as NO depth of field
    at all because the whole board sat inside it.
  5 THE KEY RAKES ACROSS THE VIEW. The sun once sat nearly opposite the
    camera, so every shadow fell behind the object casting it and two blind
    critics measured the frame as having no shadows whatever. Correct light,
    useless light. Keep the key well off the camera's azimuth.
  6 BOUNCE. Unlit faces measured near-black on a cream material — every dark
    facet read as a hole punched through the model rather than a shaded face.

The distro Blender ships WITHOUT OpenImageDenoiser, so denoising stays OFF
and clean output is paid for in samples (docs/ENV-SETUP.md).
"""

import bpy, bmesh, json, math, os, random, tempfile
from mathutils import Vector

# ── The six named hexes (src/table/palette.ts — stated, not invented here) ──

def srgb(hexstr, alpha=1.0):
    """Hex → linear RGB. Blender's colours are linear; the palette is sRGB,
    and skipping this conversion is why hand-picked colours come out pale."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], alpha)

WALNUT   = '#4a2e1c'   # the table
FELT     = '#2f4a2e'   # the cloth under the relief
BRASS    = '#c9973b'   # the clock and the trim
OXBLOOD  = '#7a2e22'   # DISTRESS ONLY — no routine roof may spend it
LIMEWASH = '#d8cdb4'   # painted house walls only, never a background
NIGHT    = '#26344c'   # the cool half of the light

def as_rgb(c):
    """Accept either a palette hex or an already-linear colour, so mixes chain."""
    return srgb(c) if isinstance(c, str) else c

def mix(a, b, t):
    ca, cb = as_rgb(a), as_rgb(b)
    return tuple(ca[i] * (1 - t) + cb[i] * t for i in range(3)) + (1.0,)

# ── Board metrics ──────────────────────────────────────────────────────────

BOARD_X, BOARD_Y = 40.0, 43.5      # the relief block, world units
LAT_MID = 29.5
KM_PER_UNIT = (0.63 * 111.32 * math.cos(math.radians(LAT_MID))) / BOARD_X
EXAG = 5.0                          # §8 sanctions 2–5×; the escarpment is the hero

SCENE_PATH = os.environ.get('BL_SCENE') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'table-scene.json')
OUT = os.environ.get('BL_OUT') or os.path.join(tempfile.gettempdir(), 'wartable.png')
RES = int(os.environ.get('BL_RES', '1600'))
SAMPLES = int(os.environ.get('BL_SAMPLES', '128'))

with open(SCENE_PATH) as fh:
    S = json.load(fh)

R = S['relief']
SIDE = R['side']
MIN_E, MAX_E = R['minElev'], R['maxElev']
SEA = S.get('seaLevel')          # None on the retired real ground; a height on the realm

# The DEM carries metre-scale noise that, exaggerated 5×, buries the landform
# under fine crumple — the first preview read as gravel, not as a county. Two
# box-blur passes let the escarpment and the river valleys be the shape you
# see, which is the whole reason §8 insists on real ground.
def blurred(grid, side, passes=1, r=2):
    g = list(grid)
    for _ in range(passes):
        h = [0.0] * (side * side)
        for iy in range(side):
            y0, y1 = max(0, iy - r), min(side - 1, iy + r)
            for ix in range(side):
                x0, x1 = max(0, ix - r), min(side - 1, ix + r)
                tot = 0.0
                n = 0
                for jy in range(y0, y1 + 1):
                    base = jy * side
                    for jx in range(x0, x1 + 1):
                        tot += g[base + jx]
                        n += 1
                h[iy * side + ix] = tot / n
        g = h
    # Keep a real share of the true detail. Two passes at 12% flattened the
    # county into a painted sheet — the escarpment stopped being a landform
    # and became a smudge, which is the opposite of why §8 demands real ground.
    return [g[i] * 0.62 + grid[i] * 0.38 for i in range(side * side)]

GRID = blurred(R['grid'], SIDE)

def elev_to_z(e):
    """Metres of real elevation → world units, exaggerated. Honest geography,
    openly stretched: relief models and sand tables do exactly this (§8)."""
    return (e / 1000.0) / KM_PER_UNIT * EXAG

def uv_to_xy(u, v):
    return ((u - 0.5) * BOARD_X, (0.5 - v) * BOARD_Y)

Z0 = elev_to_z(MIN_E)   # the felt sits at the shire's lowest ground

# ── Clear the default scene ────────────────────────────────────────────────

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for item in list(coll):
        coll.remove(item)

def new_mat(name, base, rough=0.7, metal=0.0, use_attr=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if use_attr:
        attr = m.node_tree.nodes.new('ShaderNodeAttribute')
        attr.attribute_name = 'tone'
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = base
    return m

def mesh_from(name, verts, faces, colors=None, mat=None):
    """Build a mesh and, if given, a per-vertex 'tone' colour attribute."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if colors is not None:
        layer = me.color_attributes.new(name='tone', type='FLOAT_COLOR', domain='POINT')
        for i, c in enumerate(colors):
            layer.data[i].color = c
    ob = bpy.data.objects.new(name, me)
    if mat:
        ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob

def box(cx, cy, cz, sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [(cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
         (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
         (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz),
         (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz)]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return v, f

# ── The relief, from real ground ───────────────────────────────────────────
#
# FAULT 2 (monochrome): the terrain is not one olive. It ramps with true
# elevation — lowland felt-green through a dry tan on the escarpment — and
# the river courses are cut in cool NIGHT slate. The hue does real work.

# Rasterise the courses as SEGMENTS, by distance to the line, not as a chain of
# stamped discs. Stamping discs at points spaced wider than their own radius is
# what produced a staircase of beads that read as a jagged crack in the ground
# rather than a river.
RIVER_MASK = [0.0] * (SIDE * SIDE)
RAD = 3.2
for riv in S['rivers']:
    pts = [(p['u'] * (SIDE - 1), p['v'] * (SIDE - 1)) for p in riv['pts']]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        vx, vy = bx - ax, by - ay
        seg2 = vx * vx + vy * vy
        x0 = max(0, int(min(ax, bx) - RAD - 1))
        x1 = min(SIDE - 1, int(max(ax, bx) + RAD + 1))
        y0 = max(0, int(min(ay, by) - RAD - 1))
        y1 = min(SIDE - 1, int(max(ay, by) + RAD + 1))
        for iy in range(y0, y1 + 1):
            for ix in range(x0, x1 + 1):
                t = 0.0 if seg2 <= 1e-9 else max(0.0, min(1.0, ((ix - ax) * vx + (iy - ay) * vy) / seg2))
                d = math.hypot(ix - (ax + vx * t), iy - (ay + vy * t))
                if d < RAD:
                    w = 1.0 - (d / RAD)
                    w = w * w * (3 - 2 * w)          # smoothstep, so banks are soft
                    k = iy * SIDE + ix
                    if w > RIVER_MASK[k]:
                        RIVER_MASK[k] = w

tverts, tcolors = [], []
for iy in range(SIDE):
    for ix in range(SIDE):
        e = GRID[iy * SIDE + ix]
        u = ix / (SIDE - 1)
        v = iy / (SIDE - 1)
        x, y = uv_to_xy(u, v)
        z = elev_to_z(e) - Z0
        t = (e - MIN_E) / max(1e-6, MAX_E - MIN_E)
        # Lowland deep felt → dry upland tan, on a curve that keeps the CITY
        # green and spends the tan only on the escarpment. The first pass ran
        # this ramp straight and turned the whole county one bright olive —
        # the monochrome fault, reintroduced by the fix for it.
        tt = min(1.0, max(0.0, (t - 0.12) / 0.88)) ** 1.7
        col = mix(mix(FELT, '#000000', 0.22), '#7e7845', tt)
        if SEA is not None and e < SEA + 14:
            # the shore: sand and salt-bleached grass before the water starts
            shore = min(1.0, max(0.0, (SEA + 14 - e) / 26.0))
            col = mix(col, '#9a8f6a', shore * 0.8)
        # organic mottle, two non-harmonic frequencies so it cannot band
        m = math.sin(x * 0.31 + y * 0.17) * math.sin(x * 0.11 - y * 0.23)
        col = mix(col, mix(col, '#000000', 0.55), 0.18 * (0.5 + 0.5 * m))
        rm = RIVER_MASK[iy * SIDE + ix]
        if rm > 0:
            # Measured at 2–4% luminance against the grass, the old rivers were
            # chalk scratches: signalled by a faint blue tint, with no value
            # contrast and no channel cut into the ground. Water is DARK, and
            # it runs in a bed with a bank.
            # Dark. The first fix overshot into near-black ravines, the second
            # into pale ribbons that read as ROADS. Water is darker than the
            # grass it runs through, and only faintly blue.
            water = mix(NIGHT, '#000000', 0.30)
            bank = mix(col, '#5f5a3f', 0.35)
            col = tuple(col[i] * (1 - rm) + bank[i] * rm for i in range(3)) + (1.0,)
            if rm > 0.40:
                w = (rm - 0.40) / 0.60
                col = tuple(col[i] * (1 - w) + water[i] * w for i in range(3)) + (1.0,)
            z -= 0.16 * rm             # a shallow channel — a river, not a ravine
        tverts.append((x, y, z))
        tcolors.append(col)

tfaces = []
for iy in range(SIDE - 1):
    for ix in range(SIDE - 1):
        a = iy * SIDE + ix
        tfaces.append((a, a + 1, a + SIDE + 1, a + SIDE))

terrain_mat = new_mat('terrain', None, rough=0.92, use_attr=True)
terrain = mesh_from('relief', tverts, tfaces, tcolors, terrain_mat)
terrain.data.shade_smooth()

# A skirt so the relief reads as a solid casting on the felt, not a sheet.
sk_v, sk_f = [], []
edge = []
for ix in range(SIDE):
    edge.append((0, ix))
for iy in range(1, SIDE):
    edge.append((iy, SIDE - 1))
for ix in range(SIDE - 2, -1, -1):
    edge.append((SIDE - 1, ix))
for iy in range(SIDE - 2, 0, -1):
    edge.append((iy, 0))
for (iy, ix) in edge:
    top = tverts[iy * SIDE + ix]
    sk_v.append(top)
    sk_v.append((top[0], top[1], -0.55))
for i in range(len(edge)):
    j = (i + 1) % len(edge)
    sk_f.append((2 * i, 2 * i + 1, 2 * j + 1, 2 * j))
skirt_mat = new_mat('relief_edge', mix(WALNUT, FELT, 0.35), rough=0.85)
mesh_from('relief_skirt', sk_v, sk_f, None, skirt_mat)

# ── The sea ────────────────────────────────────────────────────────────────
# A flat plane at sea level, cutting the coast wherever the ground falls below
# it. Glossy and dark: the cool NIGHT half of the light lives here, and the one
# genuinely reflective surface on the table gives the warm key something to
# glint off — which is what stops a relief model reading as a painted sheet.
if SEA is not None:
    sea_mat = bpy.data.materials.new('sea')
    sea_mat.use_nodes = True
    _b = sea_mat.node_tree.nodes['Principled BSDF']
    _b.inputs['Base Color'].default_value = mix(NIGHT, '#000000', 0.45)
    _b.inputs['Roughness'].default_value = 0.11
    _b.inputs['Metallic'].default_value = 0.0
    _b.inputs['IOR'].default_value = 1.333
    sea_z = elev_to_z(SEA) - Z0
    v, f = box(0, 0, sea_z - 0.4, BOARD_X, BOARD_Y, 0.8)
    mesh_from('sea', v, f, None, sea_mat)

# ── The table: walnut field and a raised rim ───────────────────────────────


walnut_mat = new_mat('walnut', srgb(WALNUT), rough=0.42)
felt_mat = new_mat('felt', mix(FELT, '#000000', 0.30), rough=0.98)

# A narrower margin than the first pass, which spent a third of the frame on
# empty walnut border. The table is the frame of the shot, not the subject.
MARGIN = 4.6
# The apron runs wide enough for the clock to sit ENTIRELY on it. The first
# version had the dial's lower lobe projecting past the table's corner into
# empty background — unsupported and unshadowed, which read as a modelling
# error rather than a design gesture. The crop hides the extra width.
v, f = box(0, 0, -1.4, BOARD_X + MARGIN * 2 + 13, BOARD_Y + MARGIN * 2 + 13, 1.7)
mesh_from('table', v, f, None, walnut_mat)
v, f = box(0, 0, -0.56, BOARD_X + 2.4, BOARD_Y + 2.4, 0.12)
mesh_from('felt', v, f, None, felt_mat)

# rim rails, walnut, catching the key light along the near edge
RIM_X = BOARD_X + MARGIN * 2
RIM_Y = BOARD_Y + MARGIN * 2
for (cx, cy, sx, sy) in [(0, -RIM_Y / 2, RIM_X + 2.2, 2.2),
                         (0, RIM_Y / 2, RIM_X + 2.2, 2.2),
                         (-RIM_X / 2, 0, 2.2, RIM_Y),
                         (RIM_X / 2, 0, 2.2, RIM_Y)]:
    v, f = box(cx, cy, -0.34, sx, sy, 0.85)
    mesh_from('rim', v, f, None, walnut_mat)

# ── The pieces ─────────────────────────────────────────────────────────────
#
# FAULT 1 (density): the layout guarantees MIN_SEP = 0.62 world units between
# any two doors. Pieces are sized just under that, so a lane reads as a row of
# distinct roofs rather than a blob — and they are ~2× the old scale, which is
# what the critic measured as under-scaled against the ground.

# Height reads harder than footprint from a high angle, so the pieces grew
# mostly upward: the footprint stays under the layout's MIN_SEP (0.62) and
# cannot swallow a neighbour, while the roofline gained about half again.
# Footprints must stay under the layout's MIN_SEP (0.62) or pieces bodily
# interpenetrate — a critic found roofs passing through neighbouring roofs in
# the dense clusters, which is the one fault that most directly falsifies the
# "physical model" conceit. `wide` was 0.76 and was the worst offender.
MIN_SEP = 0.62
KIND = {              # footprint w, depth d, wall h, roof rise
    'cottage': (0.46, 0.40, 0.40, 0.30),
    'house':   (0.50, 0.44, 0.56, 0.34),
    'wide':    (0.58, 0.42, 0.46, 0.32),
}
assert all(w <= MIN_SEP for (w, _d, _h, _r) in KIND.values()), 'a piece would swallow its neighbour'

# FAULT 2 (monochrome): state is carried in VALUE first, hue second, so the
# bare doors are findable in a black-and-white print of the frame.
WALL = {
    'held':   LIMEWASH,                       # painted, bright
    'bare':   None,                           # weathered wood — set below
    'vacant': None,                           # shuttered, cool and pale
    'crisis': LIMEWASH,
    'fallen': LIMEWASH,
}
ROOFS = ['#5a4632', '#4a3a2b', '#6b5540', '#3f4a4e', '#544a3a']

def terrain_z(u, v):
    fx = min(max(u, 0.0), 1.0) * (SIDE - 1)
    fy = min(max(v, 0.0), 1.0) * (SIDE - 1)
    x0, y0 = int(fx), int(fy)
    x1, y1 = min(x0 + 1, SIDE - 1), min(y0 + 1, SIDE - 1)
    tx, ty = fx - x0, fy - y0
    def g(ix, iy):
        return elev_to_z(GRID[iy * SIDE + ix]) - Z0
    a = g(x0, y0) * (1 - tx) + g(x1, y0) * tx
    b = g(x0, y1) * (1 - tx) + g(x1, y1) * tx
    return a * (1 - ty) + b * ty

pv, pf, pc = [], [], []

def emit(local, faces, ox, oy, oz, yaw, lean, wallc, roofc, split):
    """Place one piece. `split` is the vertex index where the roof begins."""
    base = len(pv)
    cy_, sy_ = math.cos(yaw), math.sin(yaw)
    cl, sl = math.cos(lean), math.sin(lean)
    for i, (x, y, z) in enumerate(local):
        # lean about the x axis, then yaw about z — a piece set down by hand
        y2, z2 = y * cl - z * sl, y * sl + z * cl
        x3, y3 = x * cy_ - y2 * sy_, x * sy_ + y2 * cy_
        pv.append((ox + x3, oy + y3, oz + z2))
        pc.append(wallc if i < split else roofc)
    for fc in faces:
        pf.append(tuple(base + k for k in fc))

def house_geo(w, d, h, rh):
    hw, hd = w / 2, d / 2
    v = [(-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0),
         (-hw, -hd, h), (hw, -hd, h), (hw, hd, h), (-hw, hd, h)]
    f = [(0, 1, 2, 3), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    split = len(v)
    # gable roof: two eaves overhanging slightly, one ridge
    ov = 0.045
    v += [(-hw - ov, -hd - ov, h), (hw + ov, -hd - ov, h),
          (hw + ov, hd + ov, h), (-hw - ov, hd + ov, h),
          (0, -hd - ov, h + rh), (0, hd + ov, h + rh)]
    b = split
    f += [(b, b + 1, b + 5, b + 4), (b + 2, b + 3, b + 4, b + 5),
          (b, b + 4, b + 3), (b + 1, b + 2, b + 5),
          (b, b + 1, b + 2, b + 3)]
    return v, f, split

fallen_at = None
crisis_at = []
for d in S['doors']:
    x, y = uv_to_xy(d['u'], d['v'])
    z = terrain_z(d['u'], d['v'])
    rnd = random.Random(d['id'])
    w, dp, h, rh = KIND[d['kind']]
    s = d['size']
    w, dp, h, rh = w * s, dp * s, h * s, rh * s
    tone = d['tone']
    st = d['state']

    if st == 'bare':
        # unpainted, weathered — reads DARK against the limewash held doors
        wall = mix(mix(WALNUT, '#6b6257', 0.55), '#000000', 0.10 + 0.10 * tone)
        roof = mix('#3a3129', '#2c2621', tone)
    elif st == 'vacant':
        # shuttered: pale but cold, so it separates from both held and bare
        wall = mix(mix(LIMEWASH, NIGHT, 0.34), '#ffffff', 0.10 * tone)
        roof = mix('#3f4a4e', '#333b3f', tone)
    else:
        wall = mix(LIMEWASH, '#b9ad90', 0.15 + 0.5 * tone)
        roof = srgb(ROOFS[int(tone * len(ROOFS)) % len(ROOFS)])

    local, faces, split = house_geo(w, dp, h, rh)
    yaw = rnd.uniform(-math.pi, math.pi)

    if st == 'fallen':
        # knocked clean over: on its side, and the ONE piece wearing distress
        wall = srgb(OXBLOOD)
        roof = mix(OXBLOOD, '#000000', 0.35)
        emit(local, faces, x, y, z + h * 0.42, yaw, math.pi / 2 * 0.94, wall, roof, split)
        fallen_at = (x, y, z)
    else:
        emit(local, faces, x, y, z, yaw, d['lean'], wall, roof, split)
        if st == 'crisis':
            crisis_at.append((x, y, z + h + rh))

house_mat = new_mat('houses', None, rough=0.66, use_attr=True)
mesh_from('doors', pv, pf, pc, house_mat)

# ── Banners: the knights' colours, and the black pennants of crisis ────────
#
# FAULT 2 again: the critic could not FIND the fallen piece or the pennants.
# A pennant is now a tall pole with a stiff flag well clear of the roofline,
# and crisis flies OXBLOOD — the one hue spent nowhere else on the table.

bv, bf, bc = [], [], []

def banner(x, y, z, height, flagcol, polecol, flag_w=0.62, flag_h=0.34):
    base = len(bv)
    t = 0.028
    bv.extend([(x - t, y - t, z), (x + t, y - t, z), (x + t, y + t, z), (x - t, y + t, z),
               (x - t, y - t, z + height), (x + t, y - t, z + height),
               (x + t, y + t, z + height), (x - t, y + t, z + height)])
    bc.extend([polecol] * 8)
    bf.extend([(base + 0, base + 4, base + 5, base + 1), (base + 1, base + 5, base + 6, base + 2),
               (base + 2, base + 6, base + 7, base + 3), (base + 3, base + 7, base + 4, base + 0)])
    b2 = len(bv)
    top = z + height
    # a stiff flag with a slight wave, so it catches the key on one face
    for i in range(4):
        fx = x + (i / 3.0) * flag_w
        wob = math.sin(i * 1.5) * 0.045
        bv.append((fx, y + wob, top))
        bv.append((fx, y + wob, top - flag_h))
    bc.extend([flagcol] * 8)
    for i in range(3):
        a = b2 + i * 2
        bf.append((a, a + 2, a + 3, a + 1))

for k in S['knights']:
    x, y = uv_to_xy(k['u'], k['v'])
    z = terrain_z(k['u'], k['v'])
    banner(x, y, z, 1.55, srgb(BRASS), mix(WALNUT, '#000000', 0.3), flag_w=0.78, flag_h=0.42)

for (x, y, z) in crisis_at:
    banner(x, y, z, 0.95, srgb(OXBLOOD), mix(WALNUT, '#000000', 0.4))

banner_mat = new_mat('banners', None, rough=0.55, use_attr=True)
mesh_from('banners', bv, bf, bc, banner_mat)

# ── The clock: a brass week-dial set into the near rim, deliberately cropped ─
# §11's signature element. The composition instinct the critic praised
# unprompted was the CROP, so it sits half out of frame.

def disc(cx, cy, cz, r, thick, seg=64):
    v, f = [], []
    for i in range(seg):
        a = (i / seg) * math.tau
        v.append((cx + math.cos(a) * r, cy + math.sin(a) * r, cz))
    for i in range(seg):
        a = (i / seg) * math.tau
        v.append((cx + math.cos(a) * r, cy + math.sin(a) * r, cz + thick))
    for i in range(seg):
        j = (i + 1) % seg
        f.append((i, j, seg + j, seg + i))
    f.append(tuple(range(seg, 2 * seg)))
    return v, f

# Polished metal in a dark room is a black mirror — the first pass rendered the
# signature element as a featureless disc. Rough, part-metallic brass catches
# the key as a broad sheen instead of reflecting a room that isn't there.
brass_mat = new_mat('brass', mix(BRASS, WALNUT, 0.18), rough=0.36, metal=0.85)
brass_dark = new_mat('brass_face', mix(BRASS, '#000000', 0.52), rough=0.58, metal=0.8)
# SET INTO the rim, which means ON it: the first pass put the dial's whole
# thickness below the rail's top face and the rail simply swallowed it.
RIM_TOP = -0.34 + 0.85 / 2
DIAL_X, DIAL_Y, DIAL_R = float(os.environ.get('BL_DIAL_X', '25.2')), \
                         float(os.environ.get('BL_DIAL_Y', '-4.0')), 5.0
# a shadowed recess so the dial is SET INTO the rim, not a coin left on it
recess_mat = new_mat('recess', mix(WALNUT, '#000000', 0.62), rough=0.9)
rv, rf = disc(DIAL_X, DIAL_Y, RIM_TOP - 0.16, DIAL_R + 0.42, 0.16)
mesh_from('dial_recess', rv, rf, None, recess_mat)
dv, df = disc(DIAL_X, DIAL_Y, RIM_TOP - 0.06, DIAL_R, 0.30)
mesh_from('dial', dv, df, None, brass_mat)
# a sunk face, so the dial has a rim and a bed rather than being one flat plate
fv, ff = disc(DIAL_X, DIAL_Y, RIM_TOP + 0.18, DIAL_R - 0.85, 0.05)
mesh_from('dial_face', fv, ff, None, brass_dark)
# the dial's teeth — a week per notch, catching the key as glints
for i in range(12):
    a = (i / 12.0) * math.tau
    tx = DIAL_X + math.cos(a) * (DIAL_R - 0.45)
    ty = DIAL_Y + math.sin(a) * (DIAL_R - 0.45)
    v, f = box(tx, ty, RIM_TOP + 0.28, 0.34, 0.34, 0.20)
    mesh_from('tooth%d' % i, v, f, None, brass_mat)
v, f = box(DIAL_X, DIAL_Y, RIM_TOP + 0.30, 0.18, DIAL_R * 1.35, 0.16)
mesh_from('dial_hand', v, f, None, brass_mat)

# ── Light: ONE warm key, cool ambient fill ─────────────────────────────────
# The critic's fireflies came from a post chain we no longer run; the clamp
# below is belt and braces. A sun with a real angular size gives the contact
# shadow the old frame did not have at all.

# The room. A flat world colour measured identical in all four corners to
# within 0.07% — the model read as a cutout on coloured paper. This is a
# gradient instead: darker below, a little light above, so the object sits in
# somewhere rather than on nothing.
world = bpy.data.worlds.new('world')
bpy.context.scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes['Background']
bg.inputs['Strength'].default_value = 0.5
_tex = wnt.nodes.new('ShaderNodeTexGradient')
_tex.gradient_type = 'LINEAR'
_map = wnt.nodes.new('ShaderNodeMapping')
_coord = wnt.nodes.new('ShaderNodeTexCoord')
_map.inputs['Rotation'].default_value = (0, math.radians(-90), 0)
_ramp = wnt.nodes.new('ShaderNodeValToRGB')
_ramp.color_ramp.elements[0].position = 0.28
_ramp.color_ramp.elements[0].color = mix(NIGHT, '#000000', 0.86)
_ramp.color_ramp.elements[1].position = 0.95
_ramp.color_ramp.elements[1].color = mix(NIGHT, '#000000', 0.30)
wnt.links.new(_coord.outputs['Generated'], _map.inputs['Vector'])
wnt.links.new(_map.outputs['Vector'], _tex.inputs['Vector'])
wnt.links.new(_tex.outputs['Color'], _ramp.inputs['Fac'])
wnt.links.new(_ramp.outputs['Color'], bg.inputs['Color'])

# THE KEY IS AIMED RELATIVE TO THE CAMERA, and that is the whole lesson here.
# The first version put the sun at azimuth 38° while the camera looked from
# -52° — very nearly opposite. Every shadow therefore fell directly BEHIND the
# object that cast it, hidden by that object, and two independent blind critics
# measured the frame as having no shadows at all. They were right: the lighting
# was correct and useless. A key must RAKE ACROSS the view, not sit behind it.
KEY_AZ = float(os.environ.get('BL_KEY_AZ', '10'))    # ~60° off the camera's azimuth
KEY_EL = float(os.environ.get('BL_KEY_EL', '36'))    # low enough to throw a readable shadow
key = bpy.data.lights.new('key', type='SUN')
key.energy = 5.2
key.angle = math.radians(2.4)          # soft-edged shadows, not a razor
key.color = srgb('#ffd9a8')[:3]
key_ob = bpy.data.objects.new('key', key)
_kd = Vector((math.cos(math.radians(KEY_EL)) * math.cos(math.radians(KEY_AZ)),
              math.cos(math.radians(KEY_EL)) * math.sin(math.radians(KEY_AZ)),
              math.sin(math.radians(KEY_EL))))
key_ob.rotation_euler = (-_kd).to_track_quat('-Z', 'Y').to_euler()
bpy.context.collection.objects.link(key_ob)

# Bounce. Unlit faces were measuring near-black (5,8,5) on a cream material —
# about 50:1 within one object — so every dark facet read as a hole punched
# through the model rather than a shaded surface. This is the light that a real
# room's floor and walls would give back.
fill = bpy.data.lights.new('fill', type='AREA')
fill.energy = 2100
fill.size = 46
fill.color = srgb('#93b2d6')[:3]
fill_ob = bpy.data.objects.new('fill', fill)
fill_ob.location = (-40, -34, 22)
fill_ob.rotation_euler = Vector((28.0, 24.0, -14.0)).to_track_quat('-Z', 'Y').to_euler()
bpy.context.collection.objects.link(fill_ob)

bounce = bpy.data.lights.new('bounce', type='AREA')
bounce.energy = 750
bounce.size = 40
bounce.color = srgb('#b39a7c')[:3]
bounce_ob = bpy.data.objects.new('bounce', bounce)
bounce_ob.location = (34, 26, 14)
bounce_ob.rotation_euler = Vector((-30.0, -22.0, -6.0)).to_track_quat('-Z', 'Y').to_euler()
bpy.context.collection.objects.link(bounce_ob)

# ── Camera ─────────────────────────────────────────────────────────────────
#
# FAULT 3 (ratio): the board fills the frame. Fixed high angle, one position.
# FAULT 4 (the band): a real aperture. Focus rides the board's centre and the
# f-stop is opened only enough to soften the near rim and the far edge — the
# pieces themselves stay legible, which is what §8 requires of them.

# The first preview framed so tight that the table, the rim and the clock all
# fell outside — §11 asks for the table AND the clock, so overcorrecting the
# ratio fault simply broke a different requirement. Pulled back to hold the
# whole object with the near rim cropped.
#
# The f-stop is absurd for a real lens and exactly right here: at this
# distance anything above about f/1 is sharp to infinity, so the miniature
# read has to come from a genuinely wide aperture. It is still a LENS — the
# fall-off follows distance from the focal plane — not a screen-space band.
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 50
cam_data.dof.use_dof = True
# f/0.35 was NOT enough. Measured, the whole board sat inside the depth of
# field: hyperfocal ≈223m against a 74m subject puts everything from 56m to
# 111m sharp, and the board spans 55–103. Silhouette transitions came out
# 1–2px at every depth — no lens at all. This is the value that actually
# brackets the board rather than swallowing it.
cam_data.dof.aperture_fstop = float(os.environ.get('BL_FSTOP', '0.16'))
cam_data.dof.aperture_blades = 7
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.collection.objects.link(cam)

# Stated as distance / elevation / azimuth about an aim point, because that is
# how the framing was actually searched — by probing where the corners and the
# dial land, not by nudging xyz and re-rendering.
DIST = float(os.environ.get('BL_DIST', '74'))
ELEV = float(os.environ.get('BL_ELEV', '35'))
AZ = float(os.environ.get('BL_AZ', '-52'))
# Aim at where the SHIRE actually is, not at the middle of the block. The
# holdings pool north and east, so a block-centred frame spends its lower-left
# quarter on empty felt. The emptiness is real and stays visible — it is a true
# finding about where nothing is held — it just no longer owns the composition.
_cx = sum(uv_to_xy(d['u'], d['v'])[0] for d in S['doors']) / len(S['doors'])
_cy = sum(uv_to_xy(d['u'], d['v'])[1] for d in S['doors']) / len(S['doors'])
target = Vector((float(os.environ.get('BL_TGT_X', str(_cx * 0.72 + 3.0))),
                 float(os.environ.get('BL_TGT_Y', str(_cy * 0.72 - 4.0))), 0.5))
ce, se = math.cos(math.radians(ELEV)), math.sin(math.radians(ELEV))
ca, sa = math.cos(math.radians(AZ)), math.sin(math.radians(AZ))
cam.location = target + Vector((ce * ca, ce * sa, se)) * DIST

d = target - Vector(cam.location)
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
cam_data.dof.focus_distance = d.length

sc = bpy.context.scene
sc.camera = cam
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = False        # the distro build has no OIDN
sc.cycles.sample_clamp_indirect = 6.0  # no fireflies, ever again
sc.cycles.max_bounces = 6
sc.render.resolution_x = RES
sc.render.resolution_y = int(RES * 0.625)
sc.render.resolution_percentage = 100
sc.cycles.filter_width = 1.5           # real anti-aliasing, free
sc.render.film_transparent = False
sc.view_settings.view_transform = 'Filmic'
sc.view_settings.look = 'Medium High Contrast'
sc.view_settings.exposure = 0.30       # Filmic holds a lot of headroom back
sc.render.filepath = OUT

# Where things actually land in frame, measured rather than eyeballed. Placing
# the dial by intuition put it off the bottom edge twice; the projection knows.
# Normalised: x/y in 0..1 are inside the frame, z is distance along the lens.
from bpy_extras.object_utils import world_to_camera_view

bpy.context.view_layer.update()

def probe(name, co):
    c = world_to_camera_view(sc, cam, Vector(co))
    inside = '   ' if (0 <= c.x <= 1 and 0 <= c.y <= 1) else 'OUT'
    print('PROBE %-14s x=%6.3f y=%6.3f d=%6.2f %s' % (name, c.x, c.y, c.z, inside))

probe('dial', (DIAL_X, DIAL_Y, RIM_TOP))
for nm, cx, cy in (('board NE', BOARD_X / 2, BOARD_Y / 2), ('board NW', -BOARD_X / 2, BOARD_Y / 2),
                   ('board SE', BOARD_X / 2, -BOARD_Y / 2), ('board SW', -BOARD_X / 2, -BOARD_Y / 2)):
    probe(nm, (cx, cy, 0.0))
probe('board mid', (0, 0, 0.5))

if os.environ.get('BL_PROBE'):
    print('PROBE ONLY — no render')
    raise SystemExit(0)

print('WARTABLE doors=%d knights=%d crisis=%d fallen=%s' % (
    len(S['doors']), len(S['knights']), len(crisis_at), fallen_at is not None))
print('WARTABLE relief %dx%d  %.0f-%.0fm  exag=%.1f  board=%.0fx%.0f' % (
    SIDE, SIDE, MIN_E, MAX_E, EXAG, BOARD_X, BOARD_Y))
bpy.ops.render.render(write_still=True)
print('RENDER_OK', OUT, os.path.getsize(OUT), 'bytes')
