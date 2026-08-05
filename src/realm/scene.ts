// The Realm Map — the data contract, and the canned realms the standalone view
// is built against (docs/WRIT-THE-REALM-MAP.md, "The firewall").
//
// `RealmScene` is the WHOLE of what the view needs. The view is a pure function
// of it: it computes no kingdom state, reaches for nothing outside `src/realm`,
// and stores nothing. The real scene is folded by `readRealmScene()` in
// `src/domain/realmScene.ts` — these types are its twin, declared here so the
// view never imports the domain.
//
// **Do not reshape these types.** The reading is written against exactly this;
// a field renamed here is a field the map silently stops showing.
//
// Positions are deliberately ABSENT. The view derives every position from the
// stable ids (see `deriveLayout.ts`) — the same realm always draws the same,
// and no coordinate is ever written down.
//
// Every name below is INVENTED. The fixtures carry working-fluid doors in the
// muster's own style; never a real address, tenant, or figure (the data gate).

// ── The contract ───────────────────────────────────────────────────────────

/** A fief's condition — the banner's color and the town's whole bearing. */
export type FiefHealth = 'thriving' | 'strained' | 'failing';

/** What a door is drawn as. The manor is the knight's keep, one to a town. */
export type BuildingKind = 'manor' | 'cottage' | 'chapel' | 'market' | 'well';

/** A door's state, legible at a glance: alive / shuttered / smoking. */
export type BuildingState = 'held' | 'vacant' | 'crisis';

export interface SceneBuilding {
  /** STABLE door slug — drives the house's position within the town. */
  id: string;
  kind: BuildingKind;
  state: BuildingState;
  /** The door's address — the hover tooltip, in plain words. */
  label: string;
  /** The open matter resting on this door, when one does — the map's one road
   *  to the WORK rather than to the neighbourhood around it. Absent means
   *  nothing is open on it, and the map must then offer no act that would land
   *  nowhere. */
  openCase?: string;
}

export interface SceneFief {
  /** STABLE — drives the fief's position on the continent. */
  id: string;
  /** The knight's name, hand-lettered on the map. */
  name: string;
  seatLabel?: string;
  health: FiefHealth;
  /** 0..100 — the finer prosperity tint beneath the three bands. */
  faith: number;
  doorsHeld: number;
  /** The town's built-out potential. */
  capacity: number;
  buildings: SceneBuilding[];
}

export interface SceneGuild {
  id: string;
  name: string;
  manned: boolean;
  /** Undefined ⇒ a vacant advisor seat. */
  masterName?: string;
}

export interface RealmScene {
  /** The hand-lettered map title. */
  realmName: string;
  /** The Capital's banner. */
  kingName: string;
  regentName: string;
  /** False ⇒ fog of war, bare parchment: no muster stands. */
  revealed: boolean;
  fiefs: SceneFief[];
  guilds: SceneGuild[];
  /** The discreet corner cartouche ONLY — never a scoreboard. */
  coffers: { trend: number; fallen: boolean; dry: boolean };
  /** What the map CANNOT draw: doors whose owner rests in no knight's care
   *  have no town to stand in. The map must say so rather than look complete
   *  while showing a third of the operation. */
  unheld: { doors: number; owners: number };
}

/** The stubbed callbacks the view calls and the app wires. The view never
 *  reaches into the store or the domain itself.
 *
 *  `onOpenPanel` and its `RealmPanel` union are GONE with the command bar that
 *  called them (Edwin, 2026-07-29 — the bar's four buttons duplicated doors the
 *  app already had on screen). Kept in the record because the bug they carried
 *  is worth not repeating: the bar passed keys and the board compared them
 *  against the bar's human LABELS, so every button was silently dead, since
 *  `string` matches `string`. A named union caught it. */
export interface RealmHandlers {
  onSelectFief(id: string): void;
  /** A single door. The map hands back BOTH the fief and the door — dropping
   *  the door here is how clicking one smoking house opened a whole
   *  neighbourhood and named nothing. */
  onSelectBuilding(fiefId: string, doorId: string): void;
  onSelectGuild(id: string): void;
  /** The Capital — the seat of the realm. */
  onSelectCapital(): void;
  /** The doors standing in no knight's care — the road to placing them. A
   *  count with no road is the fault the A/E/P check names first. */
  onSelectUnheld(): void;
  onDeployMuster(): void;
}

// ── The canned realms ──────────────────────────────────────────────────────

const STREETS = [
  'Cobblegate Lane',
  'Millbrook Way',
  'Foxglove Close',
  'Harrow Row',
  'Willow Row',
  'Millstone Close',
  'Tanner’s Walk',
  'Saltmarsh Lane',
];

/** A door's address, in the muster's own working-fluid style. */
function address(n: number): string {
  return `${101 + n} ${STREETS[n % STREETS.length]}, unit ${String.fromCharCode(65 + (n % 4))}`;
}

/** An address made a stable slug — the twin of the reading's `doorSlug`. */
export function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The kinds a town's houses take beyond its manor — a fixed spread, so a town
 *  reads as a real place and never as fifty identical copies. */
const KINDS: BuildingKind[] = [
  'cottage', 'cottage', 'chapel', 'cottage', 'cottage', 'market',
  'cottage', 'cottage', 'well', 'cottage', 'cottage', 'cottage',
];

/** Build a town's doors: the first is the knight's manor, the rest spread over
 *  the kinds, wearing the states given in order (cycled). Deterministic — the
 *  fixture is a fixed picture, never a roll. */
function doorsOf(from: number, count: number, states: BuildingState[]): SceneBuilding[] {
  const out: SceneBuilding[] = [];
  for (let i = 0; i < count; i++) {
    const label = address(from + i);
    const state = states[i % states.length];
    out.push({
      id: slugOf(label),
      kind: i === 0 ? 'manor' : KINDS[(from + i) % KINDS.length],
      state,
      label,
      // A door in trouble always has a matter behind the trouble — that is
      // what put it in crisis — and a quiet door usually has none. The fixture
      // draws both, because the map offers a different act for each.
      ...(state === 'crisis' ? { openCase: `wg/fixture · repair · ${label}` } : {}),
    });
  }
  return out;
}

const held = (b: SceneBuilding[]) => b.filter((x) => x.state !== 'vacant').length;

/** The three CROWN OFFICES (docs/WRIT-THE-BROKERAGE.md) — the household's own
 *  crafts, each headed by a Chancellor. The seven departments this fixture used
 *  to carry were the stale design the writ retired; property management divides
 *  three ways and these are they. One stands open, because an advisor rail must
 *  show a vacant seat as well as a filled one. */
const GUILDS: SceneGuild[] = [
  { id: 'works', name: 'The Office of Works', manned: true, masterName: 'Mabel' },
  { id: 'tenancy', name: 'The Office of Tenancy', manned: true, masterName: 'Osric' },
  { id: 'chancery', name: 'The Chancery', manned: false },
];

const hollowbrook = doorsOf(0, 14, ['held', 'held', 'held', 'crisis', 'held', 'vacant']);
const calderMews = doorsOf(20, 9, ['held', 'held', 'held', 'held', 'vacant']);
const lanternRow = doorsOf(40, 11, ['held', 'crisis', 'vacant', 'crisis', 'held']);
const ashcombe = doorsOf(60, 5, ['held', 'held', 'held', 'vacant']);

/** The standing realm: four towns across all three healths, every door state
 *  drawn, a manned advisor seat and a vacant one, the coffers running thin. */
export const SAMPLE_REALM: RealmScene = {
  realmName: 'LandLord',
  kingName: 'Harold',
  regentName: 'Edwin',
  revealed: true,
  fiefs: [
    {
      id: 'alys',
      name: 'Alys',
      seatLabel: 'the manager’s desk',
      health: 'thriving',
      faith: 96,
      doorsHeld: held(calderMews),
      capacity: 500,
      buildings: calderMews,
    },
    {
      id: 'osric',
      name: 'Osric',
      health: 'strained',
      faith: 72,
      doorsHeld: held(hollowbrook),
      capacity: 500,
      buildings: hollowbrook,
    },
    {
      id: 'mabel',
      name: 'Mabel',
      health: 'failing',
      faith: 34,
      doorsHeld: held(lanternRow),
      capacity: 500,
      buildings: lanternRow,
    },
    {
      id: 'marlowe',
      name: 'Marlowe',
      health: 'thriving',
      faith: 100,
      doorsHeld: held(ashcombe),
      capacity: 500,
      buildings: ashcombe,
    },
  ],
  guilds: GUILDS,
  coffers: { trend: 1_450, fallen: false, dry: false },
  unheld: { doors: 11, owners: 3 },
};

/** The same realm, unrevealed — no muster stands. Bare parchment, the ink
 *  compass, the hand-lettered title, and the one invitation. */
export const SAMPLE_REALM_UNREVEALED: RealmScene = {
  ...SAMPLE_REALM,
  revealed: false,
  fiefs: [],
  coffers: { trend: 0, fallen: false, dry: false },
  unheld: { doors: 0, owners: 0 },
};

/** A FULL muster — ten towns, ~200 doors — the scene the 60fps target is
 *  measured against. Deterministic: the spread is a fixed pattern, not a roll. */
export function fullMuster(): RealmScene {
  const knights = [
    'Alys', 'Osric', 'Mabel', 'Marlowe', 'Maren',
    'Alder', 'Rowan', 'Bly', 'Cade', 'Wren',
  ];
  const bands: BuildingState[][] = [
    ['held', 'held', 'held', 'held', 'vacant'],
    ['held', 'held', 'crisis', 'held', 'held', 'vacant'],
    ['held', 'crisis', 'crisis', 'held', 'vacant'],
  ];
  const healths: FiefHealth[] = ['thriving', 'strained', 'failing'];
  let next = 0;
  const fiefs: SceneFief[] = knights.map((name, i) => {
    const count = 14 + ((i * 5) % 9); // 14–22 doors a town, ~200 in all
    const buildings = doorsOf(next, count, bands[i % bands.length]);
    next += count;
    return {
      id: name.toLowerCase(),
      name,
      health: healths[i % healths.length],
      faith: 100 - (i % 3) * 30 - (i % 5) * 4,
      doorsHeld: held(buildings),
      capacity: 500,
      buildings,
    };
  });
  return { ...SAMPLE_REALM, fiefs };
}
