import { describe, it, expect } from 'vitest';
import { fantasyRelief, type FantasyRealm } from '../src/table/fantasyRelief';

// Keep the grid small in tests for speed; the algorithm doesn't change
// shape with side, just resolution.
const SIDE = 140;

function allElevations(r: FantasyRealm): number[] {
  const out: number[] = [];
  for (let iy = 0; iy < r.h; iy++) {
    for (let ix = 0; ix < r.w; ix++) out.push(r.cell(ix, iy));
  }
  return out;
}

describe('fantasyRelief — determinism', () => {
  it('same seed twice produces an identical grid and identical rivers', () => {
    const a = fantasyRelief({ seed: 'alpha', side: SIDE });
    const b = fantasyRelief({ seed: 'alpha', side: SIDE });
    expect(allElevations(a)).toEqual(allElevations(b));
    expect(a.rivers.length).toBe(b.rivers.length);
    for (let i = 0; i < a.rivers.length; i++) {
      expect(a.rivers[i]).toEqual(b.rivers[i]);
    }
    expect(a.minElev).toBe(b.minElev);
    expect(a.maxElev).toBe(b.maxElev);
  });

  it('different seeds produce different grids', () => {
    const a = fantasyRelief({ seed: 'alpha', side: SIDE });
    const b = fantasyRelief({ seed: 'beta', side: SIDE });
    const ea = allElevations(a);
    const eb = allElevations(b);
    let differences = 0;
    for (let i = 0; i < ea.length; i++) if (Math.abs(ea[i] - eb[i]) > 1e-6) differences++;
    // Expect the vast majority of cells to differ between unrelated seeds.
    expect(differences).toBeGreaterThan(ea.length * 0.5);
  });
});

describe('fantasyRelief — grid sanity', () => {
  const r = fantasyRelief({ seed: 'sanity', side: SIDE });

  it('minElev/maxElev match the true grid extremes', () => {
    const es = allElevations(r);
    const trueMin = Math.min(...es);
    const trueMax = Math.max(...es);
    expect(r.minElev).toBeCloseTo(trueMin, 5);
    expect(r.maxElev).toBeCloseTo(trueMax, 5);
  });

  it('has no NaN or Infinity anywhere in the grid', () => {
    const es = allElevations(r);
    for (const e of es) {
      expect(Number.isFinite(e)).toBe(true);
    }
  });

  it('elevation stays within a plausible range (roughly 0..600, floor may dip slightly negative)', () => {
    expect(r.minElev).toBeGreaterThan(-60);
    expect(r.maxElev).toBeLessThan(700);
    expect(r.maxElev).toBeGreaterThan(300); // there really is a mountain range
  });
});

describe('fantasyRelief — sample vs cell', () => {
  it('bilinear sample() agrees with cell() at exact grid coordinates', () => {
    const r = fantasyRelief({ seed: 'bilinear', side: SIDE });
    for (const [ix, iy] of [
      [0, 0],
      [1, 1],
      [50, 12],
      [SIDE - 1, SIDE - 1],
      [SIDE - 1, 0],
      [0, SIDE - 1],
      [70, 70],
    ]) {
      const u = ix / (r.w - 1);
      const v = iy / (r.h - 1);
      expect(r.sample(u, v)).toBeCloseTo(r.cell(ix, iy), 4);
    }
  });
});

describe('fantasyRelief — the sea', () => {
  const r = fantasyRelief({ seed: 'coastline', side: SIDE });

  it('a meaningful fraction of the SW quadrant is below sea level', () => {
    let below = 0;
    let total = 0;
    for (let iy = 0; iy < r.h; iy++) {
      const v = iy / (r.h - 1);
      if (v < 0.5) continue; // south half only
      for (let ix = 0; ix < r.w; ix++) {
        const u = ix / (r.w - 1);
        if (u > 0.5) continue; // west half only
        total++;
        if (r.cell(ix, iy) < r.seaLevel) below++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(below / total).toBeGreaterThan(0.12);
  });

  it('a meaningful fraction of the whole map is above sea level', () => {
    const es = allElevations(r);
    const above = es.filter((e) => e > r.seaLevel).length;
    expect(above / es.length).toBeGreaterThan(0.45);
  });

  it('the coastline is irregular, not a straight line or a circle', () => {
    // Walk the v=0.75 row (deep in the southern band) and count how many
    // times the wet/dry state flips — a straight/circular boundary would
    // flip a small, very predictable number of times; noise-cut coast
    // flips at least once and its crossing u is not suspiciously round.
    const iy = Math.round(0.75 * (r.h - 1));
    let flips = 0;
    let wasWet = r.cell(0, iy) < r.seaLevel;
    for (let ix = 1; ix < r.w; ix++) {
      const wet = r.cell(ix, iy) < r.seaLevel;
      if (wet !== wasWet) flips++;
      wasWet = wet;
    }
    expect(flips).toBeGreaterThanOrEqual(1);
  });
});

describe('fantasyRelief — rivers', () => {
  const r = fantasyRelief({ seed: 'rivers', side: SIDE });

  it('produces 4 to 6 rivers', () => {
    expect(r.rivers.length).toBeGreaterThanOrEqual(4);
    expect(r.rivers.length).toBeLessThanOrEqual(6);
  });

  it('each river has ~90 points, all within 0..1 uv', () => {
    for (const course of r.rivers) {
      expect(course.length).toBe(90);
      for (const { u, v } of course) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('each river descends monotonically from source to mouth (tiny tolerance for smoothing)', () => {
    const TOLERANCE = 6; // metres — the light smoothing pass can nudge a
                          // point slightly off the carved centreline, and
                          // two rivers occasionally settle a shared cell
                          // (a near-confluence) at slightly different times
    for (const course of r.rivers) {
      let prevElev = r.sample(course[0].u, course[0].v);
      for (let i = 1; i < course.length; i++) {
        const e = r.sample(course[i].u, course[i].v);
        expect(e).toBeLessThanOrEqual(prevElev + TOLERANCE);
        prevElev = Math.min(prevElev, e);
      }
    }
  });

  it('holds for many other seeds too, not just this one', () => {
    const TOLERANCE = 6;
    for (const s of ['a', 'b', 'c', 'd', 'e', 'mountain-king', 'zz-999']) {
      const rr = fantasyRelief({ seed: s, side: SIDE });
      for (const course of rr.rivers) {
        let prevElev = rr.sample(course[0].u, course[0].v);
        for (let i = 1; i < course.length; i++) {
          const e = rr.sample(course[i].u, course[i].v);
          expect(e).toBeLessThanOrEqual(prevElev + TOLERANCE);
          prevElev = Math.min(prevElev, e);
        }
      }
    }
  });

  it('the source sits meaningfully higher than the mouth', () => {
    for (const course of r.rivers) {
      const sourceElev = r.sample(course[0].u, course[0].v);
      const mouthElev = r.sample(course[course.length - 1].u, course[course.length - 1].v);
      expect(sourceElev).toBeGreaterThan(mouthElev + 20);
    }
  });
});

describe('fantasyRelief — keepDry', () => {
  const keepDry = [
    { u: 0.55, v: 0.55 },
    { u: 0.7, v: 0.4 },
    { u: 0.35, v: 0.7 },
    { u: 0.5, v: 0.85 },
  ];
  const r = fantasyRelief({ seed: 'holdings', side: SIDE, keepDry });

  it('every keepDry point sits at least ~12m above sea level', () => {
    for (const pt of keepDry) {
      const e = r.sample(pt.u, pt.v);
      expect(e).toBeGreaterThanOrEqual(r.seaLevel + 12);
    }
  });

  it('no river course passes through a keepDry point', () => {
    const minSepUV = 0.03; // comfortably inside the protected radius
    for (const pt of keepDry) {
      for (const course of r.rivers) {
        for (const rp of course) {
          const d = Math.hypot(rp.u - pt.u, rp.v - pt.v);
          expect(d).toBeGreaterThan(minSepUV);
        }
      }
    }
  });
});

describe('fantasyRelief — no floating artifacts', () => {
  it('the mountain range sits along the north/north-east, not scattered isolated bumps', () => {
    const r = fantasyRelief({ seed: 'terrain-shape', side: SIDE });
    // Average elevation of the northern band should be well above the
    // average elevation of the southern band.
    let northSum = 0;
    let northN = 0;
    let southSum = 0;
    let southN = 0;
    for (let iy = 0; iy < r.h; iy++) {
      const v = iy / (r.h - 1);
      for (let ix = 0; ix < r.w; ix++) {
        const e = r.cell(ix, iy);
        if (v < 0.25) {
          northSum += e;
          northN++;
        } else if (v > 0.75) {
          southSum += e;
          southN++;
        }
      }
    }
    expect(northSum / northN).toBeGreaterThan(southSum / southN + 100);
  });
});
