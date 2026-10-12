/** OWNER: sim-world agent. Construction, decay, repair, upgrades, demolition, visuals, squatters, names.
 *
 *  Condition runs 0..100 and is shown in four bands (75 / 50 / 25). Decay is a monthly rate
 *  (`def.decay` times modifiers) applied a thirtieth each day, so buildings age smoothly and
 *  do not all change band on Rent Day. At 0 a building is `ruined`: its households leave and
 *  only a `renovate` job brings it back.
 */
import type { GameState, SimModule, Building, Id, Job, Unit, ActionResult, ActionOf, JobRole } from './types';
import type { BuildingType, VisualId, SquatterKind } from '../data/ids';
import { BUILDINGS } from '../data/buildings';
import { RANKS } from '../data/ranks';
import { BAL } from '../data/balance';
import { TRAIT_DEFS } from '../data/traits';
import { TEMPERAMENT_DEFS } from '../data/temperaments';
import { INCIDENT_BY_ID } from '../data/incidents/index';
import { clamp, clamp100, emit, herald, rand, randInt, seasonOf, tileAt, monthIndexOf, newId, frontDir } from './core';
import { canPlace, footprint, invalidateDesirability, finishClear, mapPlan } from './world';
import { enqueueJob, cancelJob } from './jobs';
import { spend, earn, marketRent } from './economy';
import { moveOut, changeHappiness } from './tenants';
import { spawnDecision } from './incidents';

export const TUNE = {
  /** multipliers on a building's monthly decay */
  decay: { vacant: 1.5, winter: 1.2, squatters: 2 },
  /** a repair restores up to `max` points; cost and days scale with how much is missing */
  repair: { max: 35, costShare: 0.8, minCost: 3, baseDays: 0.5, daysShare: 0.3 },
  /** a renovation restores everything for a share of the build cost */
  renovate: { costShare: 0.4, daysShare: 0.5, minDays: 1 },
  demolish: { costShare: 0.1, minCost: 2, baseDays: 0.5, daysShare: 0.08, refundShare: 0.5 },
  /** monthly chance of a maintenance incident by condition: 4% at 100, 30% at 30, capped */
  incident: { at100: 0.04, at30: 0.30, max: 0.42, unleased: 0.5 },
  /** what the seat is worth per level, for pricing its repairs (it has no build cost) */
  seatValue: 150,
  nameMax: 32,
} as const;

// ───────────────────────────── queries ─────────────────────────────

export function buildingsOf(s: GameState, btype: BuildingType): Building[] { return Object.values(s.buildings).filter(b => b.type === btype); }
/** Ready (built) buildings of that type. */
export function countBuildings(s: GameState, btype: BuildingType): number { return buildingsOf(s, btype).filter(b => b.state === 'ready').length; }
/** Ready housing + commercial buildings. */
export function leasable(s: GameState): Building[] { return Object.values(s.buildings).filter(b => b.state === 'ready' && b.units.length > 0); }
/** Every empty unit in a ready leasable building. */
export function vacancies(s: GameState): { building: Building; unit: number }[] {
  const out: { building: Building; unit: number }[] = [];
  for (const b of leasable(s)) b.units.forEach((u, i) => { if (!u.tenantId) out.push({ building: b, unit: i }); });
  return out;
}
/** The ruler's seat (always exists after init). */
export function seatOf(s: GameState): Building { return buildingsOf(s, 'seat')[0]!; }

/** 3 sound (75+), 2 worn (50+), 1 shabby (25+), 0 failing. */
export function conditionBand(condition: number): 0 | 1 | 2 | 3 { return condition >= 75 ? 3 : condition >= 50 ? 2 : condition >= 25 ? 1 : 0; }

function address(s: GameState): string { return RANKS[s.realm.rank]?.address ?? 'Reeve'; }
function hasActiveJob(s: GameState, buildingId: Id, kinds: readonly Job['kind'][]): boolean {
  for (const id in s.jobs) {
    const j = s.jobs[id]!;
    if (j.buildingId === buildingId && kinds.includes(j.kind) && (j.state === 'queued' || j.state === 'traveling' || j.state === 'working')) return true;
  }
  return false;
}
function occupants(s: GameState, b: Building): Id[] {
  const out: Id[] = [];
  for (const u of b.units) if (u.tenantId && s.tenants[u.tenantId]) out.push(u.tenantId);
  return out;
}
/** what the fabric is worth, for pricing work on it */
function worthOf(b: Building): number {
  const def = BUILDINGS[b.type];
  return def.cost > 0 ? def.cost : TUNE.seatValue * Math.max(1, b.level);
}
function daysOf(b: Building): number {
  const def = BUILDINGS[b.type];
  return def.buildDays > 0 ? def.buildDays : 6 * Math.max(1, b.level);
}
const leased = (b: Building): boolean => { const c = BUILDINGS[b.type].category; return c === 'housing' || c === 'commercial'; };

// ───────────────────────────── the herald's lines ─────────────────────────────

const pickLine = (s: GameState, pool: readonly string[]): string => pool[Math.floor(rand(s) * pool.length)] ?? pool[0]!;
const say = (line: string, b: Building, extra: Record<string, string> = {}): string => {
  let out = line.replace(/\{building\}/g, b.name);
  for (const k in extra) out = out.split(`{${k}}`).join(extra[k]!);
  return out;
};

const DONE_LINES: Record<'housing' | 'commercial' | 'amenity' | 'staff' | 'seat', readonly string[]> = {
  housing: [
    '{building} is finished. The paint is wet and so, already, is one wall.',
    '{building} stands complete. It leans a little, which the builder calls character.',
    '{building} is built. Nothing has fallen off it yet.',
    'The last nail is in at {building}. Several of the earlier ones have come out.',
    '{building} is ready for a household. The door shuts if you lift it slightly.',
    '{building} is done. The roof has been tested with a bucket and mostly passed.',
  ],
  commercial: [
    '{building} is ready for a trade. It smells of sawdust and expectation.',
    '{building} is built and wants a tenant with a trade and a till.',
    '{building} is finished. All it lacks is someone to shout from it.',
  ],
  amenity: [
    '{building} is finished. The neighbours have already formed opinions.',
    '{building} is done. Somebody has already leaned on it.',
    '{building} stands complete, and the street is very slightly improved.',
  ],
  staff: [
    '{building} stands ready. All it wants now is somebody to put in it.',
    '{building} is built. A sign has gone up and nobody has answered it yet.',
  ],
  seat: ['{building} is finished. It is yours, and so are its draughts.'],
};
const DONE_BY_TYPE: Partial<Record<BuildingType, readonly string[]>> = {
  well: ['{building} is dug. The water is cold and the gossip has already started.'],
  statue: ['{building} is unveiled. The likeness is flattering. The pigeons are on their way.'],
  stocks: ['{building} is ready. Nobody has volunteered to test it.'],
  notice_board: ['{building} is up. Someone has already pinned a notice about a lost cat.'],
  chapel: ['{building} is consecrated. The first sermon concerned landlords.'],
  tavern: ['{building} is open. Your tenants now have somewhere to spend the rent.'],
  garden: ['{building} is planted. The cabbages look hopeful. The goat looks more hopeful.'],
  shrine: ['{building} is raised. The saint looks out at the road and has not been late once.'],
  watchtower: ['{building} is up. It can see every door in the realm, and every door knows it.'],
  bakery: ['{building} is built. The street will smell of bread as soon as somebody bakes some.'],
  smithy: ['{building} is built. Enjoy the quiet. It is the last there will be.'],
  mill: ['{building} is finished. The sails have turned once, to see what it was like.'],
  wizard_tower: ['{building} is finished. It hums slightly. The builders say it did that on its own.'],
  burrow: ['{building} is dug and turfed. The door is round. Everyone else will hit their head.'],
};
const WORN_LINES: readonly string[] = [
  '{building} has developed a lean. Those inside now sleep on the uphill side.',
  '{building} is letting in weather. The weather has not been asked for rent.',
  'The roof of {building} has gone thin. Birds have been seen leaving with it.',
  '{building} has started to sag in the middle, like a tired horse.',
];
const WORN_LINES_PLAIN: readonly string[] = [
  '{building} has developed a lean. People have begun walking round it.',
  '{building} is looking its age, and several other ages besides.',
];
const FAILING_LINES: readonly string[] = [
  '{building} is now held up chiefly by habit.',
  '{building} creaks when looked at. People have stopped looking at it.',
  'A beam at {building} has been propped with a broom. The broom is not happy.',
  '{building} has shed part of itself into the lane. Nobody has claimed it.',
];
const RUIN_LINES: readonly string[] = [
  '{building} has fallen in. It is now, legally, a pile.',
  '{building} has collapsed. The door is still standing and remains locked.',
  '{building} gave up overnight. The chimney held out longest.',
  '{building} is a ruin. Only a full rebuilding will make a roof of it again.',
];
const RAZED_LINES: readonly string[] = [
  '{building} has been pulled down. The mice were given no notice at all.',
  '{building} is gone. The ground looks relieved.',
  '{building} has been taken apart and stacked. It makes a tidier heap than it did a house.',
];
const REPAIRED_LINES: readonly string[] = [
  '{building} has been patched and propped. It will stand a while longer.',
  '{building} has been put right, or near enough to right for the price.',
  'The work at {building} is done. The bucket has been stood down.',
];
const RENOVATED_LINES: readonly string[] = [
  '{building} has been made good from sill to ridge. It looks surprised.',
  '{building} is as new. Newer, in places, than it ever was.',
];
const SQUATTER_WORDS: Record<SquatterKind, string> = {
  goblins: 'goblins', bandits: 'bandits', cultists: 'cultists', raccoons: 'raccoons', bard_troupe: 'bards', ghost: 'ghost',
};

// ───────────────────────────── condition ─────────────────────────────

function ruin(s: GameState, b: Building): void {
  b.condition = 0;
  b.state = 'ruined';
  for (const id in s.jobs) {
    const j = s.jobs[id]!;
    if (j.buildingId === b.id && j.kind === 'repair' && j.state !== 'done' && j.state !== 'cancelled') cancelJob(s, j.id);
  }
  for (const tid of occupants(s, b)) moveOut(s, tid, 'ruin');
  for (const u of b.units) { u.listed = false; u.purse = 0; if (u.vacantSince === null && !u.tenantId) u.vacantSince = s.day; }
  invalidateDesirability(s);
  emit(s, { type: 'building_changed', buildingId: b.id });
  emit(s, { type: 'sfx', id: 'crumble', buildingId: b.id });
  herald(s, 'urgent', say(pickLine(s, RUIN_LINES), b), { buildingId: b.id });
}

/** Set a ready building's condition, announcing band changes and ruin. */
function setCondition(s: GameState, b: Building, next: number, quiet = false): void {
  const before = conditionBand(b.condition);
  b.condition = clamp100(Number.isFinite(next) ? next : b.condition);
  invalidateDesirability(s);
  if (b.condition <= 0) { ruin(s, b); return; }
  const after = conditionBand(b.condition);
  if (after === before) return;
  emit(s, { type: 'building_changed', buildingId: b.id });
  if (quiet || after > before) return;
  if (after === 1) herald(s, 'info', say(pickLine(s, leased(b) ? WORN_LINES : WORN_LINES_PLAIN), b), { buildingId: b.id });
  else if (after === 0) herald(s, 'bad', say(pickLine(s, FAILING_LINES), b), { buildingId: b.id });
}

/** Lower condition (clamped); emits building_changed when the visible band changes; 0 → 'ruined'. */
export function damageBuilding(s: GameState, buildingId: Id, amount: number, _cause?: string): void {
  const b = s.buildings[buildingId];
  if (!b || b.state !== 'ready' || !(amount > 0)) return;
  setCondition(s, b, b.condition - amount);
}
/** Raise condition (clamped to 100). A ruin is past patching: only a renovation restores it. */
export function repairBuilding(s: GameState, buildingId: Id, amount: number): void {
  const b = s.buildings[buildingId];
  if (!b || b.state !== 'ready' || !(amount > 0)) return;
  setCondition(s, b, b.condition + amount);
}
export function addVisual(s: GameState, buildingId: Id, v: VisualId): void {
  const b = s.buildings[buildingId];
  if (!b || b.visuals.includes(v)) return;
  b.visuals.push(v);
  invalidateDesirability(s);
  emit(s, { type: 'building_changed', buildingId });
}
export function removeVisual(s: GameState, buildingId: Id, v: VisualId): void {
  const b = s.buildings[buildingId];
  if (!b || !b.visuals.includes(v)) return;
  b.visuals = b.visuals.filter(x => x !== v);
  invalidateDesirability(s);
  emit(s, { type: 'building_changed', buildingId });
}
export function setSquatters(s: GameState, buildingId: Id, kind: SquatterKind | null): void {
  const b = s.buildings[buildingId];
  if (!b) return;
  if ((b.squatters?.kind ?? null) === kind) return;
  b.squatters = kind ? { kind, sinceDay: s.day } : null;
  invalidateDesirability(s);
  emit(s, { type: 'building_changed', buildingId });
}

// ───────────────────────────── names ─────────────────────────────

const ADJECTIVES = ['Leaning', 'Damp', 'Crooked', 'Draughty', 'Sagging', 'Mossy', 'Wobbly', 'Bent', 'Smoky', 'Dripping', 'Lopsided',
  'Humble', 'Patched', 'Windy', 'Tilted', 'Reluctant', 'Weary', 'Squat', 'Creaking', 'Thin', 'Low', 'Second-Best', 'Unfinished',
  'Apologetic', 'Sinking', 'Hopeful', 'Singed', 'Nettled', 'Modest', 'Stubborn', 'Sturdy', 'Honest', 'Narrow', 'Upright', 'Quiet',
  'Other', 'Lesser', 'Middling', 'Sideways', 'Late', 'Brave', 'Uneven', 'Earnest', 'Mended', 'Provisional'] as const;
const PLACES = ['Mudlark', 'Thistle', 'Nettle', 'Puddle', 'Bramble', 'Turnip', 'Gander', 'Crow', 'Dockleaf', 'Midden', 'Sorrel',
  'Fennel', 'Cabbage', 'Marrow', 'Goose', 'Tansy', 'Pigwhistle', 'Rushlight', 'Candlewick', 'Cowslip', 'Barleymow', 'Hazel', 'Rook',
  'Wren', 'Sparrow', 'Bindweed', 'Hogweed', 'Clover', 'Parsnip', 'Teasel', 'Mallow', 'Comfrey', 'Woodlouse', 'Earwig', 'Snail', 'Toad',
  'Hedgepig', 'Oatcake', 'Dumpling', 'Suet', 'Goosegrass', 'Quince', 'Medlar', 'Pennywhistle', 'Buttercross', 'Starling', 'Magpie',
  'Burdock', 'Henbit', 'Shallot', 'Mangel', 'Pease', 'Wattle', 'Daub', 'Cobnut', 'Sloe', 'Gorse', 'Marsh', 'Ditch', 'Stile'] as const;
const ENDS = ['End', 'Corner', 'Bottom', 'Nook', 'Rest', 'Stoop', 'View', 'Gap', 'Side', 'Row', 'Close', 'Yard', 'Reach', 'Rise'] as const;
const SURNAMES = ['Mudge', 'Fenn', 'Harrow', 'Thistlewick', 'Tapper', 'Reedy', 'Wort', 'Gadfly', 'Pottle', 'Scrimshank', 'Larkin', 'Bodkin',
  'Crumb', 'Dobbin', 'Fettle', 'Gorm', 'Huckle', 'Inkpen', 'Jessop', 'Knapp', 'Lumley', 'Mimms', 'Nobbs', 'Ottery', 'Pargeter', 'Quill',
  'Rudge', 'Sawter', 'Tibbet', 'Uffing', 'Varley', 'Wimple', 'Yarrow'] as const;
const FOLLIES = ['Folly', 'Mistake', 'Bargain', 'Pride', 'Regret', 'Rest', 'Venture', 'Luck', 'Hope', 'Doing', 'Reward', 'Corner'] as const;
const SAINTS = ['Ostwin', 'Mildreth', 'Wulfa', 'Eadbold', 'Tibb', 'Gundred', 'Pell', 'Averil', 'Cuthwin', 'Hob', 'Osyth', 'Wenna', 'Dunstable', 'Ethelfrid'] as const;
const SAINT_EPITHETS = ['the Solvent', 'the Punctual', 'the Patient', 'the Overdue', 'of the Leaking Roof', 'the Thrifty',
  'of Perpetual Arrears', 'the Reasonably Merciful', 'the Unpaid', 'of the Late Fee', 'the Dry', 'of the Open Purse',
  'the Forgiving (Up to a Point)', 'of the Second Notice', 'the Lenient', 'of the Held Surety'] as const;

interface NameSet { gems: readonly string[]; nouns: readonly string[]; style: 'home' | 'place' | 'saint' | 'plain' }
/** `{ruler}` is the ruler's name; `{saint}` and `{epithet}` are rolled. */
const NAMES: Record<BuildingType, NameSet> = {
  hovel: { style: 'home', nouns: ['Hovel', 'Hut', 'Cot', 'Shed', 'Hovel'], gems: [
    'The Leaning Hovel', 'Damp End', 'Mudlark Hovel', "Wit's End", 'The Thin End', 'Mildew Corner', 'The Bitter End', "Rope's End",
    'The Wrong End', 'Drip Hall', 'The Old Mistake', 'Hard Cheese', 'The Lesser Shed', 'Small Mercy', 'Scant Hall', 'The Afterthought',
    'Mousehold', 'Mean Acre', 'The Lean-To', 'Sooty Nook', 'Bucket Hall', 'Four Walls', 'Three Walls', 'Most of a Roof', 'The Draught',
    'Nether Hovel', 'Dripstone', 'Puddle View', 'Midden View', 'No Elbow Room', 'The Low Door', 'Stoop and Enter', 'Thatch Pending',
    'The Makeshift', 'Chink Cottage', 'Ditchside', 'The Hutch', 'Smoke Hole', 'Half a Hearth', 'The Squeeze'] },
  cottage: { style: 'home', nouns: ['Cottage', 'Cot', 'Croft', 'Cottage'], gems: [
    'Mudlark Cottage', 'Thistle Cottage', 'Rose Cottage (No Roses)', 'Honeysuckle Cottage', 'Bindweed Cottage', 'The Proper Chimney',
    'Door-That-Shuts', 'Hollyhock Cot', 'Gable End', 'Snug Corner', 'Kettle Cottage', 'Quince Cottage', 'Dovecote Cottage',
    'Lilac Cottage', 'Wisteria (Pending)', 'Pennywhistle Cottage', 'Marigold Cottage', 'Mossy Stoop', 'Cuckoo Cottage', 'The Tidy Step',
    'Hearthside', 'Applecheek Cottage', 'Latch Cottage', 'Two Windows', 'The Whitewash', 'Lavender Edge', 'Glazed Cottage',
    'Sweetbriar', 'Hen and Doorstep', 'Chimney Proud', 'Lintel Cottage', 'The Respectable', 'Fairweather Cottage'] },
  burrow: { style: 'home', nouns: ['Burrow', 'Hollow', 'Hole', 'Bank'], gems: [
    'Snug Bottom', 'The Round Door', 'Butterhole', 'Seedcake Hollow', 'Pantry Deep', 'Mind-Your-Head', 'Low Lintel', 'The Larder',
    'Crumb Hollow', 'Warm Hole', 'Teapot Hill', 'Dumpling Down', 'Pickle Bank', 'Underloaf', 'The Cosy', 'Second Helping',
    'Hillock House', "Mole's Envy", 'Suet Bank', 'Biscuit Barrow', 'Turf Top', 'Nether Pantry', 'Jam Hollow', 'The Snuggery',
    'Honeycake Hole', 'Mushroom Bank', 'Underbough', 'Larder-under-Hill', 'Six Pantries', 'The Buttered Side'] },
  longhouse: { style: 'home', nouns: ['Longhouse', 'Row', 'Hall'], gems: [
    'The Long Row', 'Thinwall', 'Two Hearths', 'The Overhear', 'Party Wall', 'Elbow Row', 'Both Ends', 'The Double', 'Sharehearth',
    'The Partition', 'Halfway Hall', 'Knock-Twice', 'The Eavesdrop', 'Twin Smokes', 'The Long Suffering', 'Paired Doors',
    'Back-to-Back', 'Shared Rafters', 'Commonwall', 'One Wall Between', 'The Long and Short'] },
  stonehall: { style: 'home', nouns: ['Hall', 'House', 'Hold'], gems: [
    'Caskhammer Hall', 'Grudge Hall', 'The Bedrock', 'Granite Rest', 'Old Solid', 'The Lasting', 'Deepfoot Hall', 'Cellar-Below',
    'Stoutwall', 'Ironlintel', 'The Unburnable', 'Hall of Second Thoughts', 'Graniteface', 'The Ancestral (New)', 'Slab House',
    'Flintheart Hall', 'Keystone Hall', 'Ashlar House', 'The Immovable', 'Cornerstone', 'Outlast Hall', 'The Plumb Line'] },
  townhouse: { style: 'home', nouns: ['House', 'Stack', 'Rise'], gems: [
    'Three-Stack', 'The Narrows', 'Stairwell House', 'The Upper Complaint', 'Tall Order', 'Pilework', 'Three Floors Up', 'The Heap',
    'Shoulder Row', 'The Stack', 'High Step House', 'Garret Rise', 'Jetty House', 'Overhang', 'The Tall Thin One', 'Landing House',
    'Stair and Stair Again', 'The Vertical', 'Gutter View', 'Firewood House', 'The Top Floor Pays Less'] },
  treehouse: { style: 'home', nouns: ['Bough', 'Oak', 'House'], gems: [
    'Alderlight', 'The High Bough', 'Leafmere', 'Oakhold', "Last Century's Oak", 'Rustic (Their Word)', 'Canopy House', 'Windfall',
    'The Long Lease', 'Acorn Rest', 'Mossbranch', 'Silverbark', 'Evenleaf', 'The Unpruned', 'Starwatch Bough', 'Greenlintel',
    'Heartwood', 'Birdsong House', "Sapling's Regret", 'Four Centuries', 'The Oak Was Not Consulted'] },
  wizard_tower: { style: 'home', nouns: ['Tower', 'Spire'], gems: [
    'The Unwise Spire', 'Tower of Mild Peril', 'Singe Point', 'The Experiment', 'Tall Draught', 'Purple Was Here', 'Smoulder Spire',
    'The Thinking Chimney', 'Tower of Regrettable Light', 'Cinder Spire', 'The Large Surety', "Stargazer's Fault", 'Hazard Tower',
    'Alembic Spire', 'The Loud Study', 'Owlpost Tower', 'Spire of Small Bangs', 'The Zoned Tower', 'Tower of Seven Draughts'] },
  smithy: { style: 'place', nouns: ['Forge', 'Smithy', 'Anvil'], gems: [
    'The Bent Nail', 'Hammer and Complaint', 'First Light Forge', 'The Loud Corner', 'Anvil Row', 'Clinker House', 'The Horseshoe',
    'Sparkfall', 'Tongs and Temper', 'The Early Clang', 'Quench House', 'Bellows End', 'The Hot Corner', 'Dross Corner'] },
  mill: { style: 'place', nouns: ['Mill', 'Windmill'], gems: [
    'Ploughwright Mill', 'The Grinding Halt', 'Chaffwind Mill', 'Four Sails', 'Slow Sails', 'The Daily Grind', 'Weevil Rise',
    'Groaning Mill', 'Bran Hill Mill', 'Meal Tor', 'Sackcloth Mill', 'Turnabout Mill', 'The Skyline'] },
  bakery: { style: 'place', nouns: ['Bakery', 'Ovens', 'Bakehouse'], gems: [
    'The Risen Crust', 'Crumb Corner', 'Dawn Ovens', 'The Heel of the Loaf', 'Second Rising', 'Burnt Bottom', "The Baker's Dozen Less One",
    'The Warm Corner', 'Bun Row', 'Farthing Loaf', 'Oven Door', 'The Honest Loaf', 'Crust and Crumb'] },
  tavern: { style: 'plain', nouns: ['Tavern', 'Arms', 'Inn'], gems: [
    'The Late Payment', 'The Spent Purse', "The Landlord's Arms", "The Reeve's Regret", "The Griffin's Rest", 'The Empty Coffer',
    'The Goose and Writ', "The Bailiff's Knock", 'The Leaky Tankard', 'The Notice to Quit', 'The Grace Days', 'The Quarter Day',
    'The Honest Surety', 'The Tipsy Assessor', 'The Rent Arrears', 'The Last Farthing', 'The Drowned Sorrow', 'The Dog and Ledger',
    'The Three Excuses', 'The Purse and Doorstep', 'The Seed Cake', 'The Goblin and Stamp', 'The Honest Wear'] },
  market_stall: { style: 'place', nouns: ['Stall', 'Plank', 'Table', 'Barrow'], gems: [
    'The Cheese Plank', 'Plank and Awning', 'The Shouting Post', 'Farthing Table', 'Any Old Turnips', 'The Trestle', 'Bargain Board',
    'Honest Weights', 'Thumb on the Scale', 'The Barrow', 'Odds and Ends', 'Pennyworth', 'The Short Measure', 'Eel Corner', 'Onion Row'] },
  apothecary: { style: 'place', nouns: ['Apothecary', 'Physic', 'Remedies'], gems: [
    'Wort and Remedy', 'The Leech and Lancet', 'The Pestle', 'Tincture Corner', 'Cures and Causes', 'The Green Bottle', 'Salve Row',
    'The Bitter Draught', 'Poultice House', 'The Second Opinion', 'Nostrum Corner', 'Three Drops Daily', 'The Careful Dose'] },
  well: { style: 'place', nouns: ['Well', 'Pump', 'Spring'], gems: [
    'Gossip Well', 'The Deep Regret', 'Whisper Well', 'Bucket and Rumour', 'The Long Drop', 'Hearsay Well', 'Coldwater',
    'The Standing About', 'Echo Well', 'Frogsong Well', 'Tattle Well', 'Penny Well', 'Wishing (Unanswered)', 'Sweetwater', 'The Old Wet'] },
  chapel: { style: 'saint', nouns: ['Chapel'], gems: [
    'St {saint} {epithet}', 'St {saint} {epithet}', 'St {saint} {epithet}', 'Chapel of St {saint}', 'St {saint}-by-the-Midden',
    'St {saint} Without the Roof Fund', 'The Camel and Needle'] },
  garden: { style: 'place', nouns: ['Garden', 'Patch', 'Plot', 'Bed'], gems: [
    'Cabbage Row', 'Marigold Patch', "The Goat's Larder", 'Turnip Plot', 'Bean Rows', 'Dock and Nettle', 'The Physic Bed', 'Leek Corner',
    'Onion Bed', "Snail's Feast", 'Marrow Patch', 'The Kale Yard', 'Parsley Bed', "Slug's Delight", 'The Pleasance', 'Radish Rows'] },
  statue: { style: 'plain', nouns: ['Statue'], gems: [
    '{ruler} Triumphant', '{ruler}, Larger Than Life', '{ruler} Regarding the Rent', '{ruler} in Thought', '{ruler} Pointing at Something',
    '{ruler} Forgiving a Debt (Allegorical)', '{ruler} with Ledger', 'The Likeness', '{ruler} Looking Taller', '{ruler} the Fair (Self-Described)',
    '{ruler} Astride Nothing in Particular', '{ruler}, Before the Pigeons'] },
  notice_board: { style: 'plain', nouns: ['Board'], gems: [
    'The Board', 'The Lost Cat Board', 'Oyez Post', 'Pin and Decree', 'The Public Nail', 'Notices Various', 'The Read-It-Yourself',
    'Decree Corner', 'The Parish Nail', 'Hear Ye Board', 'The Tack Board', 'Nine Years Lost'] },
  stocks: { style: 'plain', nouns: ['Stocks'], gems: [
    'The Reckoning', "Late Payer's Rest", 'The Example', 'Turnip Target', 'The Reminder', 'Arrears Corner', 'The Stern Seat',
    'Pillory Green', 'The Deterrent', 'Sit and Think', 'The Public Opinion'] },
  watchtower: { style: 'place', nouns: ['Tower', 'Lookout', 'Watch'], gems: [
    'Nosy Tower', 'The Long Squint', 'Lookout Tor', 'The Eyeful', "Squatter's Bane", "Crow's Perch", 'The Tall Suspicion',
    'Watch-and-Ward', 'Spyglass Rise', 'The Vigil', 'Beacon Stump'] },
  shrine: { style: 'saint', nouns: ['Shrine'], gems: [
    'Shrine of St {saint}', "St {saint}'s Niche", 'Wayside {saint}', 'The Small Saint', 'The Never-Late', 'Candle Niche',
    'The Roadside Blessing', 'Little Mercy', 'St {saint} {epithet}'] },
  masons_yard: { style: 'plain', nouns: ['Yard'], gems: [
    'Plumb Yard', 'Mortar Yard', 'The Sucked Teeth', 'Trowel Yard', 'Waiting-on-a-Part', 'Chisel Yard', 'The Stoneheap', "The Mason's Yard"] },
  bailiffs_post: { style: 'plain', nouns: ['Post'], gems: [
    'The Firm Knock', 'Key and Ledger', 'Writ Corner', 'The Knocker', 'Arrears House', 'The Summons', "The Bailiff's Post"] },
  criers_stand: { style: 'plain', nouns: ['Stand'], gems: [
    'Oyez Corner', 'Bell and Box', 'The Loud Spot', 'Hear-Ye Stand', 'The Bellow', 'Shouting Stone', "The Crier's Box"] },
  counting_house: { style: 'plain', nouns: ['House'], gems: [
    'The Counting House', 'The Abacus', 'Twice-Counted', 'The Tally', 'Farthing Hall', 'The Strongroom', 'The Long Sigh', 'Ledger House'] },
  seat: { style: 'plain', nouns: ['Seat'], gems: ["Reeve's Hut"] },
};
/** names fit for a place that has seen better days */
const SHABBY_NAMES: readonly string[] = ['Damp End', 'The Leaning Hovel', "Wit's End", 'The Bitter End', 'Mildew Corner', 'Most of a Roof',
  'The Old Mistake', 'Three Walls', 'Drip Hall', 'Bucket Hall', 'Thatch Pending', 'Half a Hearth'];
const ORDINALS = ['Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'] as const;

function fillName(s: GameState, template: string): string {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand(s) * arr.length)]!;
  const ruler = s.realm.ruler && s.realm.ruler !== 'You' ? s.realm.ruler : `The ${RANKS[s.realm.rank]?.title ?? 'Reeve'}`;
  return template
    .replace('{ruler}', ruler)
    .replace('{saint}', pick(SAINTS))
    .replace('{epithet}', pick(SAINT_EPITHETS));
}

function rollName(s: GameState, btype: BuildingType, taken: Set<string>): string {
  const set = NAMES[btype] ?? NAMES.hovel;
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand(s) * arr.length)]!;
  const freeGems = set.gems.filter(g => g.includes('{') || !taken.has(g.toLowerCase()));
  // hand-written names first, most of the time; the patterns keep it from ever running dry
  if (freeGems.length && (set.style === 'plain' || set.style === 'saint' || rand(s) < 0.62)) return fillName(s, pick(freeGems));
  const noun = pick(set.nouns);
  if (set.style === 'home') {
    switch (randInt(s, 0, 4)) {
      case 0: return `The ${pick(ADJECTIVES)} ${noun}`;
      case 1: return `${pick(PLACES)} ${noun}`;
      case 2: return `${pick(PLACES)} ${pick(ENDS)}`;
      case 3: return `${pick(SURNAMES)}'s ${pick(FOLLIES)}`;
      default: return `${pick(PLACES)} ${noun}`;
    }
  }
  if (set.style === 'saint') return `St ${pick(SAINTS)} ${pick(SAINT_EPITHETS)}`;
  return rand(s) < 0.5 ? `${pick(PLACES)} ${noun}` : `The ${pick(ADJECTIVES)} ${noun}`;
}

function uniqueName(s: GameState, btype: BuildingType, pool?: readonly string[]): string {
  const taken = new Set<string>();
  for (const id in s.buildings) taken.add(s.buildings[id]!.name.toLowerCase());
  if (pool) {
    const free = pool.filter(n => !taken.has(n.toLowerCase()));
    if (free.length) return free[Math.floor(rand(s) * free.length)]!;
  }
  for (let i = 0; i < 24; i++) {
    const n = rollName(s, btype, taken);
    if (!taken.has(n.toLowerCase())) return n;
  }
  const base = BUILDINGS[btype]?.name ?? 'Building';
  for (const ord of ORDINALS) { const n = `${base} the ${ord}`; if (!taken.has(n.toLowerCase())) return n; }
  return `${base} ${Object.keys(s.buildings).length + 1}`;
}

/** A fresh comic name for a new building: "Mudlark Cottage", "The Leaning Hovel". Never repeats within a realm. */
export function makeBuildingName(s: GameState, btype: BuildingType): string {
  if (btype === 'seat') {
    const seat = buildingsOf(s, 'seat')[0];
    const names = BUILDINGS.seat.levelNames ?? [BUILDINGS.seat.name];
    return names[clamp((seat?.level ?? 1) - 1, 0, names.length - 1)] ?? BUILDINGS.seat.name;
  }
  return uniqueName(s, btype);
}

// ───────────────────────────── making and unmaking ─────────────────────────────

function newUnit(s: GameState): Unit { return { tenantId: null, vacantSince: s.day, listed: true, purse: 0, purseDay: 0 }; }

/** Put a building on the map (no checks, no charge). */
function raise(
  s: GameState, btype: BuildingType, x: number, y: number, rot: 0 | 1 | 2 | 3,
  opts: { ready: boolean; name?: string; condition?: number; builtDay?: number; listed?: boolean; rent?: number },
): Building {
  const def = BUILDINGS[btype];
  const f = footprint(btype, rot);
  const id = newId(s, 'b');
  const b: Building = {
    id, type: btype, x, y, w: f.w, h: f.h, rot, variant: randInt(s, 0, 999),
    name: opts.name ?? makeBuildingName(s, btype), level: 1,
    state: opts.ready ? 'ready' : 'building', progress: opts.ready ? 1 : 0,
    condition: opts.ready ? clamp100(opts.condition ?? 100) : 100,
    units: [], rent: opts.rent ?? def.baseRent, builtDay: opts.builtDay ?? s.day,
    visuals: [], squatters: null, flags: {},
  };
  if (opts.ready) for (let u = 0; u < def.units; u++) { const unit = newUnit(s); unit.listed = opts.listed ?? true; b.units.push(unit); }
  const changed: [number, number][] = [];
  for (let yy = y; yy < y + f.h; yy++) for (let xx = x; xx < x + f.w; xx++) {
    const t = tileAt(s, xx, yy);
    if (!t) continue;
    t.b = id;
    if (t.t !== 'grass') { t.t = 'grass'; changed.push([xx, yy]); }     // a road (or furrow) under a building is gone
  }
  s.buildings[id] = b;
  invalidateDesirability(s);
  if (changed.length) emit(s, { type: 'tiles_changed', tiles: changed });
  return b;
}

/** Take a building off the map entirely. */
function raze(s: GameState, b: Building): void {
  for (const tid of occupants(s, b)) moveOut(s, tid, 'event');
  for (const id in s.jobs) {
    const j = s.jobs[id]!;
    if (j.buildingId === b.id && j.state !== 'done' && j.state !== 'cancelled') cancelJob(s, j.id);
  }
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
    const t = tileAt(s, xx, yy);
    if (t && t.b === b.id) { t.b = null; t.wear = Math.max(t.wear, 0.7); }   // bare earth where it stood
  }
  delete s.buildings[b.id];
  invalidateDesirability(s);
  emit(s, { type: 'building_removed', buildingId: b.id, btype: b.type, x: b.x, y: b.y, w: b.w, h: b.h });
  emit(s, { type: 'sfx', id: 'crumble' });
}

function finishBuilding(s: GameState, b: Building): void {
  if (b.state !== 'building') return;
  const def = BUILDINGS[b.type];
  b.state = 'ready';
  b.progress = 1;
  b.condition = 100;
  b.builtDay = s.day;
  b.units = [];
  for (let u = 0; u < def.units; u++) b.units.push(newUnit(s));
  invalidateDesirability(s);
  if (def.units > 0) {
    // ask what the place will fetch where it stands; the ruler may change it
    let ask = def.baseRent;
    try { const m = marketRent(s, b); if (Number.isFinite(m) && m > 0) ask = Math.round(m); } catch { /* the Steward is indisposed: keep the pattern-book rent */ }
    b.rent = Math.max(1, ask);
  }
  emit(s, { type: 'building_done', buildingId: b.id });
  emit(s, { type: 'sfx', id: 'build_done', buildingId: b.id });
  const pool = DONE_BY_TYPE[b.type] && rand(s) < 0.7 ? DONE_BY_TYPE[b.type]! : DONE_LINES[def.category];
  herald(s, 'good', say(pickLine(s, pool), b), { buildingId: b.id });
}

// ───────────────────────────── work on buildings ─────────────────────────────

export interface WorkQuote { cost: number; days: number; restores: number }

/** What a repair of this building would cost, take, and restore right now. */
export function repairQuote(_s: GameState, b: Building): WorkQuote {
  const restores = Math.min(TUNE.repair.max, Math.max(0, 100 - b.condition));
  const share = restores / 100;
  return {
    restores: Math.round(restores),
    cost: Math.max(TUNE.repair.minCost, Math.round(worthOf(b) * share * TUNE.repair.costShare)),
    days: Math.round((TUNE.repair.baseDays + daysOf(b) * TUNE.repair.daysShare * (restores / TUNE.repair.max)) * 100) / 100,
  };
}
/** What a full renovation would cost and take. */
export function renovateQuote(_s: GameState, b: Building): WorkQuote {
  return {
    restores: Math.round(100 - b.condition),
    cost: Math.max(TUNE.repair.minCost, Math.round(worthOf(b) * TUNE.renovate.costShare)),
    days: Math.max(TUNE.renovate.minDays, Math.round(daysOf(b) * TUNE.renovate.daysShare * 100) / 100),
  };
}
export function demolishQuote(_s: GameState, b: Building): WorkQuote {
  return {
    restores: 0,
    cost: Math.max(TUNE.demolish.minCost, Math.round(worthOf(b) * TUNE.demolish.costShare)),
    days: Math.round((TUNE.demolish.baseDays + daysOf(b) * TUNE.demolish.daysShare) * 100) / 100,
  };
}

const NOT_FOUND: ActionResult = { ok: false, code: 'not_found', reason: 'No such building stands in the realm.' };

/** Queue a repair (up to +35). Shared by `order_job` and anything else that wants a roof mended. */
export function orderRepair(s: GameState, buildingId: Id, byRuler: boolean, role: JobRole = 'mason'): ActionResult {
  const b = s.buildings[buildingId];
  if (!b) return NOT_FOUND;
  if (b.state === 'building') return { ok: false, code: 'not_ready', reason: `${b.name} is not finished yet. There is nothing to mend but the plan.` };
  if (b.state === 'ruined') return { ok: false, code: 'blocked', reason: `${b.name} is past patching. It wants rebuilding from the sill up.` };
  if (b.condition >= 99.5) return { ok: false, code: 'invalid', reason: `${b.name} wants for nothing. Even the door shuts.` };
  if (hasActiveJob(s, b.id, ['repair', 'renovate'])) return { ok: false, code: 'busy', reason: `${b.name} is already being seen to.` };
  if (hasActiveJob(s, b.id, ['demolish'])) return { ok: false, code: 'busy', reason: `${b.name} is coming down. Mending it would be optimism.` };
  const q = repairQuote(s, b);
  const job = enqueueJob(s, { kind: 'repair', role, buildingId: b.id, workDays: q.days, cost: q.cost, byRuler });
  return { ok: true, id: job.id };
}

/** Queue a renovation (to 100; the only cure for a ruin). */
export function orderRenovate(s: GameState, buildingId: Id, byRuler: boolean, role: JobRole = 'mason'): ActionResult {
  const b = s.buildings[buildingId];
  if (!b) return NOT_FOUND;
  if (b.state === 'building') return { ok: false, code: 'not_ready', reason: `${b.name} is not finished yet. It cannot be made new before it has been made.` };
  if (b.state === 'ready' && b.condition >= 99.5) return { ok: false, code: 'invalid', reason: `${b.name} is as good as it will ever be.` };
  if (hasActiveJob(s, b.id, ['renovate'])) return { ok: false, code: 'busy', reason: `${b.name} is already being made good.` };
  if (hasActiveJob(s, b.id, ['demolish'])) return { ok: false, code: 'busy', reason: `${b.name} is coming down. Mending it would be optimism.` };
  const q = renovateQuote(s, b);
  const job = enqueueJob(s, { kind: 'renovate', role, buildingId: b.id, workDays: q.days, cost: q.cost, byRuler });
  // a renovation supersedes a mere patching
  for (const id in s.jobs) {
    const j = s.jobs[id]!;
    if (j.buildingId === b.id && j.kind === 'repair' && j.state === 'queued') cancelJob(s, j.id);
  }
  return { ok: true, id: job.id };
}

/** Queue a demolition (or, for a building still going up, abandon it now and sell back the timber). */
export function orderDemolish(s: GameState, buildingId: Id, byRuler: boolean, role: JobRole = 'mason'): ActionResult {
  const b = s.buildings[buildingId];
  if (!b) return NOT_FOUND;
  if (b.type === 'seat') return { ok: false, code: 'locked', reason: `That is your own seat, ${address(s)}. Where would they come to complain?` };
  if (occupants(s, b).length) return { ok: false, code: 'occupied', reason: `${b.name} still has a household in it. They would notice.` };
  if (b.state === 'building') {
    const refund = Math.round(BUILDINGS[b.type].cost * TUNE.demolish.refundShare);
    const name = b.name;
    raze(s, b);
    earn(s, refund, 'windfall', `Timber sold back, ${name}`);
    herald(s, 'info', `Work on ${name} has been abandoned. The timber was sold back at the usual loss.`);
    return { ok: true };
  }
  if (hasActiveJob(s, b.id, ['demolish'])) return { ok: false, code: 'busy', reason: `${b.name} is already marked to come down.` };
  b.flags[WAS_LISTED] = b.units.map(u => (u.listed ? '1' : '0')).join('');
  for (const u of b.units) u.listed = false;
  const q = demolishQuote(s, b);
  const job = enqueueJob(s, { kind: 'demolish', role, buildingId: b.id, workDays: q.days, cost: q.cost, byRuler });
  emit(s, { type: 'building_changed', buildingId: b.id });
  return { ok: true, id: job.id };
}

/** which units were to let before a demolition was ordered ("101"), so the shingle can go back up if it is called off */
const WAS_LISTED = '_toLetBeforeRazing';

/** A demolition was called off (cancelled, or a household moved in first): what was to let is to let again. Called by jobs.ts. */
export function demolitionCalledOff(s: GameState, buildingId: Id): void {
  const b = s.buildings[buildingId];
  if (!b) return;
  const was = b.flags[WAS_LISTED];
  delete b.flags[WAS_LISTED];
  if (b.state !== 'ready' || typeof was !== 'string') return;
  let changed = false;
  b.units.forEach((u, i) => { if (!u.tenantId && !u.listed && was[i] === '1') { u.listed = true; changed = true; } });
  if (changed) emit(s, { type: 'building_changed', buildingId: b.id });
}

/** Raise the seat to this level (called by rank.ts on promotion). */
export function upgradeSeat(s: GameState, level: number): void {
  const b = seatOf(s);
  if (!b) return;
  const def = BUILDINGS.seat;
  const names = def.levelNames ?? [def.name];
  const next = clamp(Math.round(Number.isFinite(level) ? level : b.level), 1, def.maxLevel);
  const wasDefault = names.includes(b.name);
  if (next === b.level && b.state === 'ready') return;
  b.level = next;
  if (b.state !== 'ready') { b.state = 'ready'; b.progress = 1; }
  b.condition = 100;                                             // the Crown's masons leave it sound
  if (wasDefault) b.name = names[clamp(next - 1, 0, names.length - 1)] ?? b.name;
  invalidateDesirability(s);
  emit(s, { type: 'building_changed', buildingId: b.id });
  emit(s, { type: 'sfx', id: 'build_done', buildingId: b.id });
}

// ───────────────────────────── actions ─────────────────────────────

function placeBuilding(s: GameState, a: ActionOf<'place_building'>): ActionResult {
  const x = Math.floor(Number(a.x)), y = Math.floor(Number(a.y));
  const rot = ((((Math.floor(Number(a.rot)) || 0) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  const ok = canPlace(s, a.btype, x, y, rot);
  if (!ok.ok) return ok;
  const def = BUILDINGS[a.btype];
  const b = raise(s, a.btype, x, y, rot, { ready: false });
  spend(s, def.cost, 'construction', `Building ${b.name}`, { buildingId: b.id });
  emit(s, { type: 'building_placed', buildingId: b.id });
  emit(s, { type: 'sfx', id: 'place', buildingId: b.id });
  if (def.buildDays <= 0) finishBuilding(s, b);
  else enqueueJob(s, { kind: 'build', role: 'mason', buildingId: b.id, workDays: def.buildDays, cost: 0 });
  return { ok: true, id: b.id };
}

function renameBuilding(s: GameState, a: ActionOf<'rename_building'>): ActionResult {
  const b = s.buildings[a.buildingId];
  if (!b) return NOT_FOUND;
  // eslint-disable-next-line no-control-regex
  const name = String(a.name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().slice(0, TUNE.nameMax).trim();
  if (!name) return { ok: false, code: 'invalid', reason: 'A building must be called something, if only by its neighbours.' };
  if (name === b.name) return { ok: true };
  b.name = name;
  emit(s, { type: 'building_changed', buildingId: b.id });
  return { ok: true };
}

function setListed(s: GameState, a: ActionOf<'set_listed'>): ActionResult {
  const b = s.buildings[a.buildingId];
  if (!b) return NOT_FOUND;
  if (!BUILDINGS[b.type].units) return { ok: false, code: 'invalid', reason: `Nobody can live in ${b.name}, though some have tried.` };
  if (b.state === 'building') return { ok: false, code: 'not_ready', reason: `${b.name} has no roof yet. Let it out when it has one.` };
  if (b.state === 'ruined') return { ok: false, code: 'not_ready', reason: `${b.name} is a ruin. Nobody will take it but the crows.` };
  const want = !!a.listed;
  let changed = false, vacant = 0;
  for (const u of b.units) {
    if (u.tenantId) continue;
    vacant++;
    if (u.listed !== want) { u.listed = want; changed = true; }
  }
  if (want && !vacant) return { ok: false, code: 'occupied', reason: `Every hearth in ${b.name} is taken.` };
  if (changed) emit(s, { type: 'building_changed', buildingId: b.id });
  return { ok: true };
}

function upgradeBuilding(s: GameState, a: ActionOf<'upgrade_building'>): ActionResult {
  const b = s.buildings[a.buildingId];
  if (!b) return NOT_FOUND;
  if (b.type === 'seat') return { ok: false, code: 'locked', reason: `The Crown decides when your seat grows, ${address(s)}. Earn the next charter.` };
  return { ok: false, code: 'locked', reason: `${b.name} is as grand as it is going to get.` };
}

// ───────────────────────────── module ─────────────────────────────

/** this building's decay in condition points per month, all modifiers in */
export function decayPerMonth(s: GameState, b: Building): number {
  const def = BUILDINGS[b.type];
  let rate = def.decay;
  const ids = occupants(s, b);
  if (def.units > 0 && ids.length === 0) rate *= TUNE.decay.vacant;
  if (seasonOf(s.day) === 'winter') rate *= TUNE.decay.winter;
  if (b.squatters) rate *= TUNE.decay.squatters;
  if (ids.length) {
    let sum = 0;
    for (const tid of ids) {
      let m = 1;
      for (const tr of s.tenants[tid]!.traits) m *= TRAIT_DEFS[tr]?.wear ?? 1;
      sum += clamp(m, 0.4, 2.5);
    }
    rate *= sum / ids.length;
  }
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** chance per month that something breaks at this condition */
export function incidentChancePerMonth(condition: number): number {
  const I = TUNE.incident;
  const slope = (I.at30 - I.at100) / 70;
  return clamp(I.at100 + (100 - condition) * slope, 0, I.max);
}

function hasOpenRepairIncident(s: GameState, buildingId: Id): boolean {
  for (const id in s.incidents) {
    const inc = s.incidents[id]!;
    if (inc.buildingId !== buildingId || (inc.state !== 'open' && inc.state !== 'in_progress')) continue;
    const def = INCIDENT_BY_ID[inc.defId];
    if (!def || def.decision === 'repair' || def.category === 'maintenance') return true;
  }
  return false;
}

function dailyUpkeep(s: GameState): void {
  const quiet = monthIndexOf(s.day) < BAL.quietMonths;
  for (const id of Object.keys(s.buildings)) {
    const b = s.buildings[id];
    if (!b) continue;
    if (b.state === 'building') {
      // a site with nobody assigned (a lost job, an old save): put it back on the list
      if (!hasActiveJob(s, b.id, ['build'])) {
        const job = enqueueJob(s, { kind: 'build', role: 'mason', buildingId: b.id, workDays: Math.max(0.1, BUILDINGS[b.type].buildDays), cost: 0 });
        job.progress = clamp(b.progress, 0, 0.99);
      }
      continue;
    }
    if (b.state !== 'ready') continue;
    setCondition(s, b, b.condition - decayPerMonth(s, b) / 30);
    if (b.state !== 'ready' || quiet) continue;
    // the worse the repair, the likelier something gives: 4% a month when sound, 30% at 30
    let pMonth = incidentChancePerMonth(b.condition);
    if (!leased(b)) pMonth *= TUNE.incident.unleased;
    const pDay = 1 - Math.pow(1 - pMonth, 1 / 30);
    if (rand(s) < pDay && !hasOpenRepairIncident(s, b.id)) {
      try { spawnDecision(s, 'repair', { buildingId: b.id }); } catch (e) { console.error('[buildings] maintenance incident failed to spawn', e); }
    }
  }
}

function workerQuality(s: GameState, job: Job): number {
  const actor = job.assignee ? s.actors[job.assignee] : null;
  if (!actor || actor.kind !== 'staff' || !actor.refId) return 1;
  const m = s.staff[actor.refId];
  const q = m ? TEMPERAMENT_DEFS[m.temperament]?.quality : 1;
  return clamp(Number.isFinite(q) ? (q as number) : 1, 0.5, 1.6);
}

function onJobDone(s: GameState, job: Job): void {
  if (job.kind === 'clear_land') { finishClear(s, job.x, job.y); return; }
  if (job.kind !== 'build' && job.kind !== 'repair' && job.kind !== 'renovate' && job.kind !== 'demolish') return;
  const b = job.buildingId ? s.buildings[job.buildingId] : null;
  if (!b) return;
  switch (job.kind) {
    case 'build':
      finishBuilding(s, b);
      break;
    case 'repair': {
      if (b.state !== 'ready') break;
      const restores = Math.min(100 - b.condition, TUNE.repair.max * workerQuality(s, job));
      setCondition(s, b, b.condition + restores, true);
      emit(s, { type: 'building_changed', buildingId: b.id });
      emit(s, { type: 'sfx', id: 'success', buildingId: b.id });
      for (const tid of occupants(s, b)) changeHappiness(s, tid, 5, 'repair');
      herald(s, 'good', say(pickLine(s, REPAIRED_LINES), b), { buildingId: b.id });
      break;
    }
    case 'renovate': {
      const wasRuin = b.state === 'ruined';
      if (b.state === 'building') break;
      b.state = 'ready';
      b.progress = 1;
      b.condition = 100;
      if (wasRuin) for (const u of b.units) { if (!u.tenantId) { u.listed = true; u.vacantSince = s.day; } }
      invalidateDesirability(s);
      emit(s, { type: 'building_changed', buildingId: b.id });
      emit(s, { type: 'sfx', id: 'build_done', buildingId: b.id });
      for (const tid of occupants(s, b)) changeHappiness(s, tid, 8, 'renovation');
      herald(s, 'good', say(pickLine(s, RENOVATED_LINES), b), { buildingId: b.id });
      break;
    }
    case 'demolish': {
      const squat = b.squatters ? SQUATTER_WORDS[b.squatters.kind] ?? 'squatters' : null;
      const line = squat
        ? (squat === 'ghost' ? '{building} came down. The ghost has been seen looking for the stairs.' : '{building} came down. The {squatters} filed out first, carrying the door.')
        : pickLine(s, RAZED_LINES);
      const text = say(line, b, { squatters: squat ?? '' });
      raze(s, b);
      herald(s, 'info', text);
      break;
    }
  }
}

function init(s: GameState): void {
  if (Object.keys(s.buildings).length) return;
  const plan = mapPlan(s.seed);
  const r = plan.roadRow;
  // the hamlet: the hut north of the lane facing it, one good hovel beside it, one across the lane,
  // and the shabby one set back in the far corner where nobody has to look at it
  const seatX = 8 + randInt(s, 0, 2);
  const spots: { type: BuildingType; x: number; y: number; rot: 0 | 1 | 2 | 3; shabby?: boolean }[] = [
    { type: 'seat', x: seatX, y: r - 3, rot: 0 },
    { type: 'hovel', x: randInt(s, seatX + 4, 14), y: r - 2, rot: 0 },
    { type: 'hovel', x: 8 + randInt(s, 0, 2), y: r + 1, rot: 2 },
    { type: 'hovel', x: 13 + randInt(s, 0, 1), y: r === 11 ? 13 + randInt(s, 0, 1) : 14, rot: rand(s) < 0.5 ? 1 : 2, shabby: true },
  ];
  for (const sp of spots) {
    const f = footprint(sp.type, sp.rot);
    let x = sp.x, rot = sp.rot;
    if (plan.mirror) { x = 24 - sp.x - f.w; rot = (rot === 1 ? 3 : rot === 3 ? 1 : rot) as 0 | 1 | 2 | 3; }
    const b = raise(s, sp.type, x, sp.y, rot, sp.type === 'seat'
      ? { ready: true, name: BUILDINGS.seat.levelNames?.[0] ?? BUILDINGS.seat.name, condition: 88, builtDay: -randInt(s, 300, 900), listed: false }
      : sp.shabby
        ? { ready: true, name: uniqueName(s, 'hovel', SHABBY_NAMES), condition: 33 + randInt(s, 0, 5), builtDay: -randInt(s, 900, 1600), listed: true, rent: Math.max(1, BUILDINGS.hovel.baseRent - 2) }
        : { ready: true, condition: 80 + randInt(s, 0, 12), builtDay: -randInt(s, 200, 800), listed: true });
    // make sure there is somewhere to stand at the door (a two-tile front has its door on the line between two tiles)
    const [dx, dy] = frontDir(b.rot);
    const px = b.x + b.w / 2 + dx * (b.w / 2 + 0.5), py = b.y + b.h / 2 + dy * (b.h / 2 + 0.5);
    for (const [ex, ey] of [[Math.floor(px), Math.floor(py)], [Math.floor(px - (dx === 0 ? 0.5 : 0)), Math.floor(py - (dx === 0 ? 0 : 0.5))]] as const) {
      const t = tileAt(s, ex, ey);
      if (t && !t.b && (t.t === 'forest' || t.t === 'rock')) t.t = 'grass';
    }
  }
}

export const buildingsModule: SimModule = {
  name: 'buildings',
  init,
  onDay(s) { dailyUpkeep(s); },
  onJobDone,
  handlers: {
    place_building: placeBuilding,
    demolish: (s, a) => orderDemolish(s, a.buildingId, false),
    upgrade_building: upgradeBuilding,
    rename_building: renameBuilding,
    set_listed: setListed,
  },
};
