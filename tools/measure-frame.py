"""
Measure a render instead of admiring it.

    python3 tools/measure-frame.py <frame.png> [control.png]

Claude graded the last war-table render generously TWICE and was corrected by
measurement both times — first calling it "a photographed object", then
claiming a cast shadow that was not in the image at all. So the claims a
render makes are now checked with numbers, and the numbers are printed whether
they flatter the frame or not.

The checks are the blind critic's own five faults, restated as measurements:

  CONTACT     ground touching a piece must be DARKER than open ground. The
              old frame had this exactly inverted — brightest where the board
              met the desk.
  AA          a high-contrast silhouette must show intermediate pixels. The
              old frame stepped 118→21 in one pixel.
  FIREFLIES   isolated pixels far brighter than their surroundings. The old
              frame beaded 95 of them along the board edge.
  DOF         local sharpness must vary with DISTANCE from the focal plane.
              The old frame measured σ=0.0 across the whole height — a
              screen-space band, not a lens.
  PALETTE     how many hues actually do work, and whether the distress hue is
              rare enough that a red spot can only mean trouble.

Exit code is 0 always: this reports, it does not gate. Read the numbers.
"""

import sys
import numpy as np
from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert('RGB')
a = np.asarray(img).astype(np.float64)
H, W, _ = a.shape
# Rec. 709 luma, the same weighting the critic used
luma = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

print('FRAME %s  %d×%d' % (path, W, H))
print('  luma  min=%.1f  max=%.1f  mean=%.1f  p1=%.1f  p99=%.1f'
      % (luma.min(), luma.max(), luma.mean(), np.percentile(luma, 1), np.percentile(luma, 99)))
clip_lo = float((luma <= 1.0).mean() * 100)
clip_hi = float((luma >= 254.0).mean() * 100)
print('  clipping  black=%.3f%%  white=%.3f%%   (the critic PRAISED headroom; keep both near zero)'
      % (clip_lo, clip_hi))

# ── ANTI-ALIASING ─────────────────────────────────────────────────────────
# Along every row, find steps of >60 luma and ask whether the transition took
# more than one pixel. A hard-edged renderer answers "no" everywhere.
d = np.abs(np.diff(luma, axis=1))
ys, xs = np.nonzero(d > 60)
keep = (xs >= 2) & (xs < W - 4)
ys, xs = ys[keep], xs[keep]
if len(ys):
    # Take the PLATEAUS either side of the step (2px clear of it), then count
    # how many pixels in the crossing sit strictly between them. A hard edge
    # jumps plateau-to-plateau with nothing in between; an anti-aliased one
    # spends one or more pixels in the middle.
    #
    # The first version of this check looked only at the step pair's outer
    # neighbours, so it scored a perfectly good 3-pixel ramp as "hard". Rule:
    # a metric that can fail the thing it is measuring is worse than no metric.
    left = luma[ys, xs - 2]
    right = luma[ys, xs + 3]
    lo = np.minimum(left, right)
    hi = np.maximum(left, right)
    rng = hi - lo
    ok = rng > 40
    ys, xs, lo, hi, rng = ys[ok], xs[ok], lo[ok], hi[ok], rng[ok]
    inner = np.zeros(len(ys))
    for off in (-1, 0, 1, 2):
        v = luma[ys, xs + off]
        inner += ((v > lo + 0.15 * rng) & (v < hi - 0.15 * rng)).astype(float)
    print('  AA  %d edges; %.1f%% have ≥1 intermediate pixel, mean width %.2f px'
          % (len(ys), 100.0 * float((inner >= 1).mean()), float(inner.mean())))
else:
    print('  AA  no high-contrast edges found')

# ── FIREFLIES ─────────────────────────────────────────────────────────────
# A firefly is a pixel far brighter than the median of the ring around it.
k = 3
pad = np.pad(luma, k, mode='edge')
neigh = np.stack([pad[i:i + H, j:j + W]
                  for i in range(2 * k + 1) for j in range(2 * k + 1)
                  if not (i == k and j == k)], axis=0)
med = np.median(neigh, axis=0)
fire = (luma > med + 55) & (luma > 170)
# A raw count cannot tell a rendering artefact from a highlight that belongs.
# A firefly is a LONE hot pixel; a specular glint on a roof ridge or a brass
# tooth is a hot pixel with hot neighbours. Split them, or the check indicts
# the lighting for doing its job.
fpad = np.pad(fire.astype(np.int32), 1, mode='constant')
fneigh = sum(fpad[i:i + H, j:j + W] for i in range(3) for j in range(3)) - fire.astype(np.int32)
isolated = int((fire & (fneigh == 0)).sum())
print('  FIREFLIES  %d hot px: %d isolated (true fireflies), %d in clusters '
      '(specular highlights)' % (int(fire.sum()), isolated, int(fire.sum()) - isolated))

# ── DEPTH OF FIELD ────────────────────────────────────────────────────────
# Sharpness = mean |Laplacian| in a band. A real lens focused mid-board makes
# this rise toward the focal plane and fall at both the near and far edge; a
# screen-space band makes it constant, which is what σ=0.0 meant.
lap = (np.abs(4 * luma[1:-1, 1:-1] - luma[:-2, 1:-1] - luma[2:, 1:-1]
              - luma[1:-1, :-2] - luma[1:-1, 2:]))
BANDS = 10
bh = lap.shape[0] // BANDS
sharp = []
for i in range(BANDS):
    band = lap[i * bh:(i + 1) * bh]
    sharp.append(float(band.mean()))
print('  DOF  band sharpness top→bottom: ' + ' '.join('%.2f' % s for s in sharp))
print('       σ=%.3f  range=%.2f  (σ=0.0 was the screen-space band)'
      % (float(np.std(sharp)), max(sharp) - min(sharp)))

# ── PALETTE ───────────────────────────────────────────────────────────────
mx = a.max(axis=2)
mn = a.min(axis=2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
hsv = np.asarray(Image.open(path).convert('HSV')).astype(np.float64)
hue = hsv[:, :, 0] * (360.0 / 255.0)
lit = (luma > 18) & (sat > 0.18)          # ignore the dark room and greys
hist, _ = np.histogram(hue[lit], bins=36, range=(0, 360))
tot = max(1, hist.sum())
share = 100.0 * hist / tot
busy = [(i * 10, share[i]) for i in range(36) if share[i] >= 4.0]
print('  PALETTE  %.1f%% of frame is coloured; hue bins ≥4%%: %s'
      % (100.0 * lit.mean(), ', '.join('%d°:%.0f%%' % b for b in busy)))
print('           distinct working hues = %d  (1 = the monochrome fault)' % len(busy))

# The distress hue must be RARE — red may only ever mean trouble.
#
# The floor matters more than the hue. A first version took any hue<18 above
# luma 18 and reported 3.2% of the frame as distress; the pixels were #180c0c
# and #240c0c — the SHADOWED WALNUT TABLE, which sits at hue 0 once it is dark
# enough. Oxblood #7a2e22 has luma 61, so anything under ~45 is wood in shadow,
# not a pennant. Third metric in this file to have flattered or maligned a frame
# before it was checked against the actual pixels it flagged.
red = lit & ((hue < 18) | (hue > 345)) & (sat > 0.35) & (luma > 45)
print('  DISTRESS  oxblood-ish pixels = %.3f%% of frame (rare on purpose)'
      % (100.0 * red.mean()))

# ── SUBJECT / FRAME RATIO ─────────────────────────────────────────────────
# The background is whatever colour the frame's extreme corners are — sampled,
# not assumed. A hardcoded "luma < 22" missed this room's navy entirely and
# reported the subject filling 99.5% of the frame, which was simply false.
corners = np.concatenate([a[0:6, 0:6].reshape(-1, 3), a[0:6, -6:].reshape(-1, 3)])
bgcol = np.median(corners, axis=0)
dist = np.sqrt(((a - bgcol) ** 2).sum(axis=2))
bg = dist < 14
print('  RATIO  background rgb=(%.0f,%.0f,%.0f); subject fills %.1f%% of frame'
      % (bgcol[0], bgcol[1], bgcol[2], 100.0 * (1.0 - bg.mean())))

# ── CONTACT SHADOW ────────────────────────────────────────────────────────
# Compare ground luma just inside the board's dark features against the open
# field. Rather than guess where pieces are, use the darkest decile of the
# board region and check it is meaningfully below the median — a scene with no
# occlusion at all has a compressed low tail.
cx0, cx1 = int(W * 0.12), int(W * 0.80)
cy0, cy1 = int(H * 0.10), int(H * 0.72)
board = luma[cy0:cy1, cx0:cx1]
p10, p50 = np.percentile(board, 10), np.percentile(board, 50)
print('  CONTACT  board p10=%.1f  p50=%.1f  drop=%.1f  (occlusion needs a real low tail)'
      % (p10, p50, p50 - p10))

if len(sys.argv) > 2:
    b = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(np.float64)
    bl = 0.2126 * b[:, :, 0] + 0.7152 * b[:, :, 1] + 0.0722 * b[:, :, 2]
    print('  CONTROL  Δmean=%.2f' % (luma.mean() - bl.mean()))
