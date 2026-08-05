// THE MAP — the illustrated table, as geometry.
//
// The drawing used to be baked by a Python script into a static HTML file, so
// nothing about it could be tested and nothing about it could read the
// chronicle. It is app code now, which means the two things that must never be
// wrong about a map are assertable: that every door the realm holds is DRAWN
// somewhere (a door the map cannot place is a door nobody can find), and that
// the same realm always draws the same map.

import { describe, expect, it } from 'vitest';
import { copseOf, fitTransform, terrainOf, MAP } from '../src/table/flatMap';
import { layoutTable, onOpenGround } from '../src/table/tableScene';
import { SAMPLE_REALM, SAMPLE_REALM_UNREVEALED, fullMuster, slugOf } from '../src/realm/scene';
import type { BuildingState, RealmScene, SceneBuilding, SceneFief } from '../src/realm/scene';

// ── A little relief to draw on ─────────────────────────────────────────────
// A dome with a moat: high in the middle, low at the rim, so every band closes
// and the level quantiles have something to cut.

function dome(side = 60, sea: number | null = null) {
  const grid: number[] = [];
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const u = x / (side - 1) - 0.5;
      const v = y / (side - 1) - 0.5;
      grid.push(220 * Math.exp(-(u * u + v * v) * 7) - 20);
    }
  }
  return {
    grid,
    side,
    seaLevel: sea,
    rivers: [
      Array.from({ length: 12 }, (_, i) => ({ u: 0.2 + i * 0.05, v: 0.15 + i * 0.06 })),
    ],
  };
}

describe('THE MAP — the ground', () => {
  it('draws a band for every level, and every band is a closed figure', () => {
    const t = terrainOf(dome());
    expect(t.bands.length).toBe(6);
    for (const b of t.bands) {
      expect(b.d.startsWith('M')).toBe(true);
      // Closed, or it cannot be filled — and a band that cannot be filled is a
      // hole in the land exactly where the map should be showing ground.
      expect(b.d.endsWith('Z')).toBe(true);
    }
    expect(t.contours.length).toBeGreaterThan(0);
    expect(t.hachures.startsWith('M')).toBe(true);
    expect(t.rivers).toHaveLength(1);
  });

  it('is PURE — the same land draws the same map, twice', () => {
    expect(terrainOf(dome())).toEqual(terrainOf(dome()));
  });

  it('reads a sea when there is one, and dry land when there is not', () => {
    expect(terrainOf(dome(60, null)).baseFill).toBe('#2D4634');
    const wet = terrainOf(dome(60, 40));
    expect(wet.baseFill).toBe('#1B2536');
    // No hillside shading is drawn under water.
    expect(wet.hachures.length).toBeLessThan(terrainOf(dome(60, null)).hachures.length);
  });

  it('accepts a relief of any side — the drawing is not tied to one bake', () => {
    for (const side of [37, 60, 75, 150]) {
      expect(terrainOf(dome(side)).bands.length).toBe(6);
    }
  });

  it('stands the woods apart, on the board, and off the bare tops', () => {
    const t = terrainOf(dome());
    expect(t.copseSites.length).toBeGreaterThan(10);
    for (const s of t.copseSites) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(MAP);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(MAP);
    }
    for (let i = 0; i < t.copseSites.length; i++) {
      for (let j = i + 1; j < t.copseSites.length; j++) {
        const a = t.copseSites[i];
        const b = t.copseSites[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(52);
      }
    }
  });

  it('throws a shadow no longer than the thing casting it', () => {
    // The fault that made every piece on the board read weightless: a low copse
    // throwing a shadow longer than a three-storey house.
    for (const seed of [1, 77, 4096]) {
      const { blobs, spread } = copseOf(seed);
      expect(blobs.length).toBeGreaterThanOrEqual(3);
      expect(spread).toBeGreaterThan(0);
      const tallest = Math.max(...blobs.map((b) => b.r));
      expect((spread + 1) * 0.34).toBeLessThan(tallest * 2);
    }
  });
});

// ── The shire on the lattice ───────────────────────────────────────────────

/** A realm of `fiefs` towns of `each` doors — for the growth cases the four
 *  fixture towns cannot reach. */
function realmOf(fiefs: number, each: number): RealmScene {
  const states: BuildingState[] = ['held', 'held', 'crisis', 'vacant'];
  return {
    ...SAMPLE_REALM,
    fiefs: Array.from({ length: fiefs }, (_, f): SceneFief => {
      const buildings: SceneBuilding[] = Array.from({ length: each }, (_, i) => {
        const label = `${100 + i} Fief ${f} Row`;
        return { id: slugOf(label), kind: 'cottage', state: states[i % states.length], label };
      });
      return {
        id: `fief-${f}`,
        name: `Knight ${f}`,
        health: 'thriving',
        faith: 80,
        doorsHeld: buildings.length,
        capacity: 500,
        buildings,
      };
    }),
  };
}

describe('THE MAP — the pieces on the parcels', () => {
  it('TOTALITY: every door the realm holds stands somewhere on the board', () => {
    // The guarantee the Census earned the hard way, owed here for the same
    // reason: a subject the drawing cannot place is a subject nobody can manage.
    const scene = fullMuster();
    const doors = scene.fiefs.flatMap((f) => f.buildings.map((b) => b.id));
    const drawn = layoutTable(scene).pieces.map((p) => p.doorId);
    expect(drawn.length).toBe(doors.length);
    expect(new Set(drawn)).toEqual(new Set(doors));
  });

  it('no two pieces stand on one parcel', () => {
    const layout = layoutTable(fullMuster());
    const spots = layout.pieces.map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it('a fellowship’s block holds its own doors and no one else’s', () => {
    const layout = layoutTable(fullMuster());
    for (const p of layout.pieces) {
      const block = layout.blocks[p.block];
      expect(block.fiefId).toBe(p.fiefId);
      expect(p.x).toBeGreaterThanOrEqual(block.x);
      expect(p.x).toBeLessThanOrEqual(block.x + block.w);
      expect(p.y).toBeGreaterThanOrEqual(block.y);
      expect(p.y).toBeLessThanOrEqual(block.y + block.h);
    }
  });

  it('the blocks never overlap — a road runs between every two', () => {
    const layout = layoutTable(fullMuster());
    for (let i = 0; i < layout.blocks.length; i++) {
      for (let j = i + 1; j < layout.blocks.length; j++) {
        const a = layout.blocks[i];
        const b = layout.blocks[j];
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('is DETERMINISTIC — the same shire draws the same town, twice', () => {
    expect(layoutTable(fullMuster())).toEqual(layoutTable(fullMuster()));
  });

  it('a shire that grows draws a DENSER town, never one off the table', () => {
    // The founding pitch carries a full muster and a good deal past it (600
    // doors still draw at full size). A shire that outgrows even that gets a
    // TIGHTER lattice — never a map running off its own board.
    const small = layoutTable(realmOf(4, 12));
    expect(layoutTable(realmOf(30, 20)).blocks[0].pitchX).toBe(small.blocks[0].pitchX);

    const huge = layoutTable(realmOf(60, 25));
    expect(huge.pieces.length).toBe(1500);
    expect(huge.blocks[0].pitchX).toBeLessThan(small.blocks[0].pitchX);
    for (const p of huge.pieces) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(MAP);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(MAP);
    }
  });

  it('carries each door’s open matter through to the piece — the road to the work', () => {
    const layout = layoutTable(SAMPLE_REALM);
    const crisis = layout.pieces.filter((p) => p.state === 'crisis');
    expect(crisis.length).toBeGreaterThan(0);
    for (const p of crisis) expect(p.openCase).toBeTruthy();
    // And a quiet door offers no road, because there is nowhere for it to go.
    expect(layout.pieces.some((p) => p.state === 'held' && !p.openCase)).toBe(true);
  });

  it('an unrevealed realm draws no pieces at all — the land lies bare', () => {
    const layout = layoutTable(SAMPLE_REALM_UNREVEALED);
    expect(layout.pieces).toHaveLength(0);
    expect(layout.blocks).toHaveLength(0);
    expect(layout.banners).toHaveLength(0);
  });

  it('a fief with no doors is not given a block of empty ground', () => {
    const scene: RealmScene = {
      ...SAMPLE_REALM,
      fiefs: [...SAMPLE_REALM.fiefs, { ...SAMPLE_REALM.fiefs[0], id: 'empty', buildings: [] }],
    };
    expect(layoutTable(scene).blocks.some((b) => b.fiefId === 'empty')).toBe(false);
  });

  it('every knight’s banner stands over their own fellowship', () => {
    const layout = layoutTable(fullMuster());
    expect(layout.banners.length).toBe(layout.blocks.length);
    for (const banner of layout.banners) {
      expect(layout.blocks.some((b) => b.fiefId === banner.fiefId)).toBe(true);
    }
  });

  it('the woods do not grow through a holding', () => {
    const layout = layoutTable(fullMuster());
    for (const b of layout.blocks) {
      const middle = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      expect(onOpenGround(middle, layout.blocks, layout.capital)).toBe(false);
    }
    expect(onOpenGround({ x: 5, y: 995 }, layout.blocks, layout.capital)).toBe(true);
  });

  it('the frame fits every piece it is given', () => {
    const layout = layoutTable(fullMuster());
    const pts = [...layout.pieces, layout.capital, ...layout.banners];
    const { transform, scale } = fitTransform(pts, { w: 1600, h: 1000 });
    expect(scale).toBeGreaterThan(0);
    expect(transform).toMatch(/^translate\(.+\) rotate\(.+\) scale\(.+\) translate\(.+\)$/);
    // A one-piece realm must not divide by a zero-width bounding box.
    expect(fitTransform([{ x: 500, y: 500 }], { w: 1600, h: 1000 }).scale).toBeGreaterThan(0);
  });
});
