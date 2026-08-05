/**
 * The flat map's GEOMETRY — the illustrated realm, computed in the app.
 *
 * This is the port of `tools/bake-flat-map.py`. That baker read a JSON scene
 * and wrote one static HTML file: a handsome picture whose buttons were
 * demonstrations, because nothing in it could ever know what the chronicle
 * held. The alternative considered and refused was giving the static page an
 * API path — which puts a vault credential in a public artifact, the exact
 * thing `npm run guard:vault` exists to prevent. So the drawing moves into the
 * app instead, where the records already are.
 *
 * Everything here is PURE and deterministic: the same realm draws the same map
 * on every load, in every browser, forever. Nothing is random at runtime — the
 * copse scatter runs off a hashed stream, the same one the rest of the realm
 * lays out with.
 *
 * The division of labour matters for cost. `terrainOf` depends on the RELIEF
 * alone, so it is computed once per realm seed and memoised; the pieces, the
 * surveyed parcels and the frame's fit depend on the chronicle and are cheap.
 * A door leased in the Ledger must not re-run marching squares.
 */

/** The map's internal coordinate space — the board is MAP × MAP units. */
export const MAP = 1000;

/** The relief the map draws. `src/table/fantasyRelief.ts` satisfies it, and so
 *  does the retired real-ground bake — the map never learns which land it is on. */
export interface MapRelief {
  /** Row-major elevations, row 0 = north edge, `side` to a side. */
  grid: number[];
  side: number;
  /** Below this is water; null on land-only relief (the retired real ground). */
  seaLevel: number | null;
  /** River courses in uv (0..1 across the frame), source → mouth. */
  rivers: { u: number; v: number }[][];
}

export interface TerrainGeometry {
  /** The water (or the lowest land) the bands are laid on. */
  baseFill: string;
  /** One filled path per elevation band, low to high. */
  bands: { d: string; fill: string }[];
  /** The same outlines, drawn as contour lines. */
  contours: string;
  /** Hillside hachures — one path of short downhill strokes. */
  hachures: string;
  rivers: { body: string; core: string }[];
  /** Candidate copse positions, in map units, already thinned and ordered.
   *  The draw keeps the ones that fall on no surveyed parcel. */
  copseSites: { x: number; y: number; seed: number }[];
}

// ── Deterministic streams (FNV-1a, as the whole realm lays out) ────────────

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function stream(seed: string): () => number {
  let s = hashStr(seed);
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

// ── The field: the relief, downsampled and smoothed ────────────────────────

/** The working grid's side. The relief is far finer than the drawing needs;
 *  contours off the raw grid are noise, not landform. */
const N = 75;
/** Map units per working cell. */
const CELL = MAP / N;

/** Area-average the relief down to N × N, whatever side it came in at, then
 *  smooth twice. Any side is accepted — a bucket is the fraction of the source
 *  it covers, so a relief that does not divide by N loses nothing at an edge. */
function fieldOf(relief: MapRelief): number[][] {
  const { grid, side } = relief;
  const f: number[][] = [];
  for (let r = 0; r < N; r++) {
    const row: number[] = [];
    const y0 = Math.floor((r * side) / N);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * side) / N));
    for (let c = 0; c < N; c++) {
      const x0 = Math.floor((c * side) / N);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * side) / N));
      let s = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          s += grid[y * side + x];
          n++;
        }
      }
      row.push(s / n);
    }
    f.push(row);
  }
  for (let pass = 0; pass < 2; pass++) {
    const g: number[][] = [];
    for (let r = 0; r < N; r++) {
      const row: number[] = [];
      for (let c = 0; c < N; c++) {
        let s = 0;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && rr < N && cc >= 0 && cc < N) {
              s += f[rr][cc];
              n++;
            }
          }
        }
        row.push(s / n);
      }
      g.push(row);
    }
    for (let r = 0; r < N; r++) f[r] = g[r];
  }
  return f;
}

// ── Marching squares ───────────────────────────────────────────────────────
//
// The field is padded with a low border so every iso-region CLOSES: an open
// contour cannot be filled, and a band that cannot be filled is a hole in the
// land where the map should be showing ground.

type Pt = [number, number];

const CASES: Record<number, [string, string][]> = {
  1: [['left', 'bottom']],
  2: [['bottom', 'right']],
  3: [['left', 'right']],
  4: [['top', 'right']],
  5: [['left', 'top'], ['bottom', 'right']],
  6: [['top', 'bottom']],
  7: [['left', 'top']],
  8: [['top', 'left']],
  9: [['top', 'bottom']],
  10: [['top', 'right'], ['bottom', 'left']],
  11: [['top', 'right']],
  12: [['right', 'left']],
  13: [['right', 'bottom']],
  14: [['bottom', 'left']],
};

const pkey = (p: Pt) => `${Math.round(p[0] * 1e4)}:${Math.round(p[1] * 1e4)}`;

/** Padded-grid index → map coordinate (the pad ring sits one cell outside). */
const gx = (c: number) => (c - 1) * CELL + CELL / 2;

function marching(pf: number[][], P: number, t: number): Pt[][] {
  const segs: [Pt, Pt][] = [];
  for (let r = 0; r < P - 1; r++) {
    for (let c = 0; c < P - 1; c++) {
      const tl = pf[r][c];
      const tr = pf[r][c + 1];
      const br = pf[r + 1][c + 1];
      const bl = pf[r + 1][c];
      const idx = (tl >= t ? 8 : 0) | (tr >= t ? 4 : 0) | (br >= t ? 2 : 0) | (bl >= t ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const ip = (a: number, b: number, pa: Pt, pb: Pt): Pt => {
        const d = (t - a) / (b - a);
        return [pa[0] + (pb[0] - pa[0]) * d, pa[1] + (pb[1] - pa[1]) * d];
      };
      const ctl: Pt = [gx(c), gx(r)];
      const ctr: Pt = [gx(c + 1), gx(r)];
      const cbr: Pt = [gx(c + 1), gx(r + 1)];
      const cbl: Pt = [gx(c), gx(r + 1)];
      const pts: Record<string, Pt> = {};
      if (tl >= t !== tr >= t) pts.top = ip(tl, tr, ctl, ctr);
      if (tr >= t !== br >= t) pts.right = ip(tr, br, ctr, cbr);
      if (bl >= t !== br >= t) pts.bottom = ip(bl, br, cbl, cbr);
      if (tl >= t !== bl >= t) pts.left = ip(tl, bl, ctl, cbl);
      for (const [a, b] of CASES[idx]) {
        if (pts[a] && pts[b]) segs.push([pts[a], pts[b]]);
      }
    }
  }

  // Chain the loose segments into loops.
  const adj = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (const k of [pkey(a), pkey(b)]) {
      const list = adj.get(k);
      if (list) list.push(i);
      else adj.set(k, [i]);
    }
  });
  const used = new Array<boolean>(segs.length).fill(false);
  const loops: Pt[][] = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const [a, b] = segs[i];
    used[i] = true;
    const loop: Pt[] = [a, b];
    let cur = b;
    while (pkey(cur) !== pkey(a)) {
      let next: Pt | null = null;
      for (const j of adj.get(pkey(cur)) ?? []) {
        if (used[j]) continue;
        const [p, q] = segs[j];
        if (pkey(p) === pkey(cur)) next = q;
        else if (pkey(q) === pkey(cur)) next = p;
        else continue;
        used[j] = true;
        break;
      }
      if (!next) break;
      loop.push(next);
      cur = next;
    }
    loops.push(loop);
  }
  return loops;
}

/** Ramer–Douglas–Peucker: drop the points that say nothing. */
function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const d2seg = (p: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return (p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2;
  };
  const keep = new Set<number>([0, pts.length - 1]);
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    if (hi <= lo + 1) continue;
    let worst = -1;
    let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = d2seg(pts[i], pts[lo], pts[hi]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > eps * eps) {
      keep.add(at);
      stack.push([lo, at], [at, hi]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((i) => pts[i]);
}

function perimeter(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
}

/** Catmull-Rom through the points, emitted as cubics — the surveyor's hand. */
function catmull(pts: Pt[], closed = true): string {
  const n = pts.length;
  if (n < 3) return '';
  const P = (i: number) => pts[((i % n) + n) % n];
  const out = [`M${P(0)[0].toFixed(1)} ${P(0)[1].toFixed(1)}`];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    out.push(
      `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`,
    );
  }
  if (closed) out.push('Z');
  return out.join('');
}

// ── The palette of the ground ──────────────────────────────────────────────
//
// Green does the land, blue-slate the water, and RED IS RESERVED — the hue law
// (src/table/palette.ts): red means distress and nothing else, so no band, no
// river and no copse may reach for it.

const WATER_FILL = '#1B2536';
const LAND_FILL = '#2D4634';
const BAND_COLORS = ['#2D4634', '#2F4A2E', '#3C5433', '#4C5F3A', '#5F6B41', '#7C7C4C', '#968D5E'];

/** The elevation levels the bands are cut at. Six hardcoded metre values were
 *  tried first and were meaningless on invented land — most sat above the
 *  realm's highest ground and drew nothing at all. So the levels come from the
 *  DATA: where there is a sea, the first level IS sea level, so the lowest
 *  band's outline is literally the coastline; the rest are quantiles of the
 *  LAND only, which keeps every band carrying roughly equal area whatever
 *  shape the realm turns out to be. */
function levelsOf(f: number[][], sea: number | null): number[] {
  const flat: number[] = [];
  for (const row of f) for (const v of row) if (sea === null || v > sea) flat.push(v);
  flat.sort((a, b) => a - b);
  const q = (t: number) => (flat.length ? flat[Math.min(flat.length - 1, Math.max(0, Math.floor(t * flat.length)))] : 0);
  const levels =
    sea === null
      ? [0.1, 0.32, 0.52, 0.7, 0.85, 0.95].map(q)
      : [sea, ...[0.22, 0.44, 0.64, 0.81, 0.93].map(q)];
  // Strictly increasing, or marching squares draws the same ring twice.
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] <= levels[i - 1]) levels[i] = levels[i - 1] + 1e-3;
  }
  return levels;
}

// ── Rivers ─────────────────────────────────────────────────────────────────

function resample(pts: Pt[], n: number): Pt[] {
  const dists = [0];
  for (let i = 1; i < pts.length; i++) {
    dists.push(dists[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = dists[dists.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (j < dists.length - 2 && dists[j + 1] < target) j++;
    const seg = dists[j + 1] - dists[j];
    const t = seg === 0 ? 0 : (target - dists[j]) / seg;
    out.push([
      pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t,
      pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t,
    ]);
  }
  return out;
}

function smoothPts(pts: Pt[], passes: number): Pt[] {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const out: Pt[] = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      out.push([
        (cur[i - 1][0] + 2 * cur[i][0] + cur[i + 1][0]) / 4,
        (cur[i - 1][1] + 2 * cur[i][1] + cur[i + 1][1]) / 4,
      ]);
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

/** A river as a tapering ribbon: a filled body that widens downstream, and a
 *  lighter core stroke offset a hair up-left, which is what makes water read as
 *  water rather than as a blue line. */
function riverOf(course: { u: number; v: number }[]): { body: string; core: string } {
  const pts = smoothPts(resample(course.map((p) => [p.u * MAP, p.v * MAP] as Pt), 160), 3);
  const n = pts.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = (2.2 + 10.4 * t ** 1.3) / 2;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const wob = Math.sin(t * 40 + pts[i][0] * 0.01) * 0.35;
    left.push([pts[i][0] + nx * (w + wob), pts[i][1] + ny * (w + wob)]);
    right.push([pts[i][0] - nx * (w - wob), pts[i][1] - ny * (w - wob)]);
  }
  const xy = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  const body = `M${left.map(xy).join('L')}L${[...right].reverse().map(xy).join('L')}Z`;
  const core = `M${pts.slice(Math.floor(n * 0.12)).map(xy).join('L')}`;
  return { body, core };
}

// ── The whole terrain ──────────────────────────────────────────────────────

/** Everything the ground is made of, from the relief alone. Depends on nothing
 *  the chronicle holds, so one realm computes this once. */
export function terrainOf(relief: MapRelief): TerrainGeometry {
  const f = fieldOf(relief);
  const sea = relief.seaLevel;
  const levels = levelsOf(f, sea);

  // Pad with a low border so all iso-regions close.
  let lowest = Infinity;
  for (const row of f) for (const v of row) if (v < lowest) lowest = v;
  const P = N + 2;
  const pf: number[][] = Array.from({ length: P }, () => new Array<number>(P).fill(lowest - 100));
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) pf[r + 1][c + 1] = f[r][c];

  const bandPaths = levels.map((t) => {
    const parts: string[] = [];
    for (const raw of marching(pf, P, t)) {
      let lp = raw;
      if (lp.length >= 4 && pkey(lp[0]) === pkey(lp[lp.length - 1])) lp = lp.slice(0, -1);
      if (lp.length < 4) continue;
      if (perimeter(lp) < 45) continue; // a speck is noise, not an island
      const sp = rdp(lp, 2.2);
      if (sp.length < 3) continue;
      parts.push(catmull(sp));
    }
    return parts.join('');
  });

  // ── Hachures: short downhill strokes on the steep ground ────────────────
  const r = stream('hachure');
  const hach: string[] = [];
  for (let row = 2; row < N - 2; row += 2) {
    for (let col = 2; col < N - 2; col += 2) {
      const dzdx = (f[row][col + 1] - f[row][col - 1]) / (2 * CELL);
      const dzdy = (f[row + 1][col] - f[row - 1][col]) / (2 * CELL);
      const slope = Math.hypot(dzdx, dzdy);
      if (slope < 0.26) continue;
      if (sea !== null && f[row][col] <= sea) continue; // no hillside shading at sea
      if (r() < 0.25) continue;
      const L = Math.hypot(-dzdx, -dzdy) || 1;
      const dx = -dzdx / L;
      const dy = -dzdy / L;
      const x = gx(col + 1) + (r() - 0.5) * 10;
      const y = gx(row + 1) + (r() - 0.5) * 10;
      const len = Math.min(16, 6 + slope * 22) * (0.8 + r() * 0.35);
      const a = Math.atan2(dy, dx) + (r() - 0.5) * 0.36;
      hach.push(`M${x.toFixed(0)} ${y.toFixed(0)}L${(x + Math.cos(a) * len).toFixed(0)} ${(y + Math.sin(a) * len).toFixed(0)}`);
    }
  }

  // ── Copse candidates ────────────────────────────────────────────────────
  // Woods stand on the middling ground: never on the bare tops, never in the
  // water, never on top of each other. Which of these survive is decided at
  // draw time, when the surveyed parcels are known — a wood does not grow
  // through a holding.
  const elevAt = (x: number, y: number) =>
    f[Math.max(0, Math.min(N - 1, Math.floor(y / CELL)))][Math.max(0, Math.min(N - 1, Math.floor(x / CELL)))];
  const riverPts: Pt[] = [];
  for (const rv of relief.rivers) {
    if (rv.length < 2) continue;
    riverPts.push(...resample(rv.map((p) => [p.u * MAP, p.v * MAP] as Pt), 80));
  }
  const cr = stream('copse');
  const sites: { x: number; y: number; seed: number }[] = [];
  const near = (pts: { x: number; y: number }[] | Pt[], x: number, y: number, rad: number) => {
    const rr = rad * rad;
    for (const p of pts as Pt[]) {
      const px = Array.isArray(p) ? p[0] : (p as { x: number }).x;
      const py = Array.isArray(p) ? p[1] : (p as { y: number }).y;
      if ((px - x) ** 2 + (py - y) ** 2 < rr) return true;
    }
    return false;
  };
  for (let tries = 0; tries < 9000 && sites.length < 120; tries++) {
    const x = 30 + cr() * 940;
    const y = 30 + cr() * 940;
    if (elevAt(x, y) > levels[levels.length - 2]) continue;
    if (sea !== null && elevAt(x, y) <= sea) continue;
    if (near(riverPts, x, y, 24)) continue;
    if (near(sites, x, y, 52)) continue;
    sites.push({ x, y, seed: hashStr(`copse:${sites.length}:${x.toFixed(0)}:${y.toFixed(0)}`) });
  }

  return {
    baseFill: sea === null ? LAND_FILL : WATER_FILL,
    bands: bandPaths.map((d, i) => ({ d, fill: BAND_COLORS[i + 1] })),
    contours: bandPaths.join(''),
    hachures: hach.join(''),
    rivers: relief.rivers.filter((rv) => rv.length >= 2).map(riverOf),
    copseSites: sites,
  };
}

// ── A copse, drawn ─────────────────────────────────────────────────────────

export interface CopseBlob {
  x: number;
  y: number;
  r: number;
}

/** The blobs of one copse, and the ground-shadow it throws. One sun, upper
 *  left, and a shadow NO LONGER THAN THE THING CASTING IT — a copse is low, so
 *  it throws a short one. It used to throw a longer shadow than a three-storey
 *  house, which is what made every piece on the board read weightless. */
export function copseOf(seed: number): { blobs: CopseBlob[]; spread: number } {
  const r = stream(`blob:${seed}`);
  const n = 3 + Math.floor(r() * 4);
  const blobs: CopseBlob[] = [];
  for (let i = 0; i < n; i++) {
    blobs.push({ x: (r() - 0.5) * 18, y: (r() - 0.5) * 8, r: 3.8 + r() * 2.6 });
  }
  blobs.sort((a, b) => a.y - b.y);
  const spread = Math.max(...blobs.map((b) => Math.abs(b.x))) + 6;
  return { blobs, spread };
}

// ── The frame's fit ────────────────────────────────────────────────────────

/** Fit the pieces into the frame: a slight rotation off square (a board set
 *  down by a hand, not a screenshot of a grid), scaled so every piece is in
 *  view with a margin of open ground around them. Returns an SVG transform. */
export function fitTransform(
  pts: { x: number; y: number }[],
  frame: { w: number; h: number; rotate?: number; margin?: number },
): { transform: string; scale: number } {
  const rot = frame.rotate ?? -8.5;
  const m = frame.margin ?? 30;
  const th = (rot * Math.PI) / 180;
  const xs = pts.length ? pts.map((p) => p.x) : [0, MAP];
  const ys = pts.length ? pts.map((p) => p.y) : [0, MAP];
  const bx0 = Math.min(...xs) - m;
  const bx1 = Math.max(...xs) + m;
  const by0 = Math.min(...ys) - m;
  const by1 = Math.max(...ys) + m;
  const corners: Pt[] = [
    [bx0, by0],
    [bx1, by0],
    [bx1, by1],
    [bx0, by1],
  ];
  const rotated = corners.map(([x, y]): Pt => [
    x * Math.cos(th) - y * Math.sin(th),
    x * Math.sin(th) + y * Math.cos(th),
  ]);
  const rw = Math.max(...rotated.map((p) => p[0])) - Math.min(...rotated.map((p) => p[0]));
  const rh = Math.max(...rotated.map((p) => p[1])) - Math.min(...rotated.map((p) => p[1]));
  const scale = Math.min((frame.w - 70) / rw, (frame.h - 30) / rh);
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  const tx = frame.w / 2 + 30;
  const ty = frame.h / 2 - 8;
  return {
    transform: `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${rot}) scale(${scale.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`,
    scale,
  };
}
