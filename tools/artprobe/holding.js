/* THE SAME HOLDING, DRAWN TWO WAYS.
 *
 * Edwin, 2026-07-29: the board "looks very crappily handdrawn vs a kind of 2d
 * render like in a game", and "we're clearly abysmal at it — just use the art
 * assets that are out there". This probe answers the question he actually
 * asked: it renders ONE holding through two pipelines and screenshots both, so
 * the choice is made from frames rather than from anyone's description.
 *
 * Both pipelines read this file. If the layouts ever diverge the comparison is
 * worthless, so the layout lives here exactly once.
 *
 * The holding mirrors the intro campaign the app actually deals: a capital and
 * sixteen doors across two fiefs, one of them in crisis.
 */

/** Kenney's kits are authored around a 1-unit tile. One fief tile = 4 units. */
export const TILE = 4;

export const HOLDING = {
  realmName: 'Harold',
  capital: { x: 0, z: -7 },
  fiefs: [
    {
      name: 'Millbrook',
      x: -8,
      z: 4,
      cols: 4,
      rows: 2,
      // Which of this fief's doors are in trouble — the map's one red.
      crisis: [2],
    },
    {
      name: 'Larkspur',
      x: 8,
      z: 2,
      cols: 4,
      rows: 2,
      crisis: [],
    },
  ],
};

/** The 21 suburban buildings, cycled so a fief reads as varied but stable. */
const TYPES = 'abcdefghijklmnopqrstu'.split('');

/**
 * Fold the holding into a flat list of placements. Deterministic on purpose —
 * a comparison in which the two frames deal different houses proves nothing,
 * so there is no randomness here, only the index.
 */
export function placements() {
  const out = [];
  HOLDING.fiefs.forEach((fief, f) => {
    let n = 0;
    for (let r = 0; r < fief.rows; r++) {
      for (let c = 0; c < fief.cols; c++) {
        const i = f * 8 + n;
        out.push({
          kind: 'door',
          id: `${fief.name}-${n}`,
          model: `building-type-${TYPES[i % TYPES.length]}`,
          x: fief.x + (c - (fief.cols - 1) / 2) * 2.6,
          z: fief.z + (r - (fief.rows - 1) / 2) * 2.8,
          // A quarter turn per door, so a row is not a rank of clones.
          rot: ((i * 90) % 360) * (Math.PI / 180),
          crisis: fief.crisis.includes(n),
          fief: fief.name,
        });
        n++;
      }
    }
  });
  return out;
}

/** Where the trees stand — enough to make ground read as land, not as felt. */
export function scenery() {
  const trees = [];
  const ring = [
    [-11, -2], [-10, 6], [-6, 8], [1, 9], [8, 9], [12, 6], [13, 0],
    [10, -5], [4, -10], [-4, -9], [-9, -6], [-12, 3],
  ];
  ring.forEach(([x, z], i) => {
    trees.push({ x, z, model: i % 3 === 0 ? 'nat-tree_tall' : 'nat-tree_default', s: 0.9 + (i % 4) * 0.12 });
  });
  return trees;
}
