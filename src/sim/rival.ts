/**
 * OWNER: sim-crown agent.
 * The lord next door, who wants your tenants.
 *
 * One rival is rolled per reign from RIVAL_NAMES. His renown drifts on its own.
 * Every month or two he makes one move, coloured by his temperament:
 *
 *   grasping   undercuts your rents; goes after whoever you charge the most
 *   charming   throws feasts; will take a happy household as readily as a sour one
 *   ruthless   spreads rumours (your renown -1); goes after the unhappiest
 *
 * While his renown is above yours the move is an attempt to poach one household.
 * A recent feast of your own, a contented household, or a record of kept oaths
 * blunt it. He never takes more than one household a month and never leaves you
 * with fewer than two. When your renown beats his by 15, one of his households
 * turns up at your gate as a fresh applicant.
 */
import { DAYS_PER_MONTH, type GameState, type SimModule, type Tenant, type Building, type RivalState } from './types';
import { rand, randInt, pick, chance, clamp, hash01, rankIndex } from './core';
import { housed, householdCount, moveOut, changeHappiness, spawnApplicant } from './tenants';
import { marketRent, lastFeastDay } from './economy';
import { changeRenown } from './renown';
import { vacancies } from './buildings';
import { proclaim, pronounsFor } from './modes';
import { RIVAL_NAMES } from '../data/characters';
import { BUILDINGS } from '../data/buildings';

export const TUNE = {
  /** days between his moves: at least `moveGapMin`, at most `moveGapMin + moveGapSpread` */
  moveGapMin: DAYS_PER_MONTH,
  moveGapSpread: DAYS_PER_MONTH,
  /** a new reign is left alone this long */
  firstMoveMin: 45,
  /** he will not poach if it would leave fewer than this many households */
  minHouseholdsLeft: 2,
  /** households that moved in more recently than this are not worth his trouble yet */
  settledDays: 45,
  /** base chance that an approach works, before the household's own view of things */
  poachBase: 0.75,
  /** at or above this happiness a household sends his man away (charming rivals need the higher bar) */
  contentHappiness: 70,
  contentHappinessCharmed: 88,
  /** a feast of yours within this many days makes his offers look thin */
  feastDays: 60,
  feastBlunt: 0.4,
  keptOathBlunt: 0.3,
  /** each oath kept in the last year takes this much off his chances, to a floor of half */
  keptOathEach: 0.06,
  /** your renown ahead of his by this much: one of his households comes to you */
  defectLead: 15,
  defectGapDays: 60,
  /** happiness lost by households paying over market when a grasping rival posts his rents */
  undercutHappiness: -3,
  undercutMax: 6,
  feastRenown: 3,
  rumourRenown: -0.5,
  /** a move that changes nothing is only worth a line if he has not been heard from in this long */
  idleQuietDays: 100,
  introDay: 4,
} as const;

/** Keys this module keeps in `state.flags`. */
export const FLAGS = {
  met: 'rival.met',
  defectDay: 'rival.defectDay',
  noRoomDay: 'rival.noRoomDay',
} as const;

const numFlag = (s: GameState, key: string): number | null => {
  const v = s.flags[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

function vars(s: GameState, t?: Tenant | null, b?: Building | null): Record<string, string | number> {
  const v: Record<string, string | number> = { rival: s.rival.name, seat: s.rival.seat, realm: s.realm.name, ...pronounsFor(s.rival.name) };
  // "Baron Aldous Vane" is "Baron Vane" when a line runs long
  const words = s.rival.name.trim().split(/\s+/);
  if (words.length > 2) v.rival_short = `${words[0]} ${words[words.length - 1]}`;
  if (t) { v.name = t.name; v.first = t.first; v.name_short = t.first; }
  if (b) v.building = b.name;
  return v;
}

function setRenown(r: RivalState, value: number): void { r.renown = clamp(value, 5, 95); }

/** The whole day on which he next acts. */
export function nextMoveDay(s: GameState): number {
  const last = Math.floor(s.rival.lastMoveDay);
  const roll = hash01((s.seed | 0) * 31 + last * 7 + 3);
  if (last <= 0) return TUNE.firstMoveMin + Math.floor(roll * TUNE.moveGapSpread);
  return last + TUNE.moveGapMin + Math.floor(roll * (TUNE.moveGapSpread + 1));
}

/** Has the ruler feasted the realm lately? */
function feastedLately(s: GameState): boolean {
  const last = lastFeastDay(s);
  return last !== null && last <= s.day && s.day - last <= TUNE.feastDays;
}

/** Has the feed carried anything about him in the last `days` days? */
function heardLately(s: GameState, days: number): boolean {
  for (let i = s.heralds.length - 1; i >= 0; i--) {
    const h = s.heralds[i]!;
    if (h.day < s.day - days) return false;
    if (h.kind === 'rival') return true;
  }
  return false;
}

/** Households he could plausibly approach: settled in, and not already in trouble over the rent. */
function prospects(s: GameState): Tenant[] {
  return housed(s).filter(t =>
    !!t.buildingId && !!s.buildings[t.buildingId]
    && (t.lateStage === 'none' || t.lateStage === 'grace')
    && s.day - t.movedInDay >= TUNE.settledDays);
}

const overcharge = (s: GameState, t: Tenant): number => {
  const b = t.buildingId ? s.buildings[t.buildingId] : null;
  if (!b || !t.lease) return 0;
  const market = Math.max(1, marketRent(s, b));
  return t.lease.rent / market;
};

function chooseTarget(s: GameState, list: Tenant[]): Tenant {
  const byMood = [...list].sort((a, b) => a.happiness - b.happiness || (a.id < b.id ? -1 : 1));
  switch (s.rival.temperament) {
    case 'grasping': {
      const byRent = [...list].sort((a, b) => overcharge(s, b) - overcharge(s, a) || a.happiness - b.happiness || (a.id < b.id ? -1 : 1));
      return overcharge(s, byRent[0]!) > 1.02 ? byRent[0]! : byMood[0]!;
    }
    case 'charming':
      return pick(s, list);
    default:
      return byMood[0]!;
  }
}

/** The chance his approach to this household works. 0 means they will not hear of it. */
export function poachChance(s: GameState, t: Tenant): number {
  const charming = s.rival.temperament === 'charming';
  if (t.happiness >= (charming ? TUNE.contentHappinessCharmed : TUNE.contentHappiness)) return 0;
  let p: number = TUNE.poachBase;
  // the unhappier, the readier to go; a charmer cares less about that
  const mood = clamp(1 - (t.happiness - 30) / 80, 0.3, 1);
  p *= charming ? 0.55 + mood * 0.3 : mood;
  if (feastedLately(s)) p *= TUNE.feastBlunt;
  const yearAgo = s.day - 360;
  let keptLately = 0; let keptToThem = false; let openToThem = false;
  for (const o of s.oaths) {
    if (o.state === 'kept' && (o.settledDay ?? 0) >= yearAgo) keptLately++;
    if (o.toTenantId === t.id) { if (o.state === 'kept') keptToThem = true; if (o.state === 'open') openToThem = true; }
  }
  if (keptToThem) p *= TUNE.keptOathBlunt;
  if (openToThem) p *= 0.7;
  p *= Math.max(0.5, 1 - TUNE.keptOathEach * keptLately);
  p *= clamp(0.6 + (s.rival.renown - s.renown) / 25, 0.6, 1.3);
  return clamp(p, 0, 0.95);
}

const POACHED: Record<RivalState['temperament'], string[]> = {
  grasping: [
    '{rival} offered {name} the same roof for two crowns less. {first} has gone to {seat}. The sums were not complicated.',
    '{name} has left for {seat}, where {rival} undercut you by a crown and a half and threw in a bucket.',
    '{rival} showed {name} a lease in {seat} at a crown less. {first} signed it on the back of {his} man. The cart came at noon.',
    '{name} has gone to {seat}. {rival} beat your rent by a crown and paid for the cart. {first} kept the receipt.',
  ],
  charming: [
    '{rival} sent {name} a hamper and a kind word. {first} now lives in {seat}, and speaks of {him} warmly and of you politely.',
    '{name} went to the feast at {seat} and did not come back. {rival} has that effect. A cart came for the furniture.',
    '{rival} called on {name} in person and admired the curtains. {first} has moved to {seat}, and taken the curtains.',
    '{rival} remembered the birthday of {name}. You did not. {first} now lives in {seat}.',
  ],
  ruthless: [
    '{name} has left for {seat}. A man of {rival}\'s explained some things about you at the well, slowly, twice.',
    '{rival} let it be known that you were selling up. {name} believed it and has moved to {seat}. You are not selling up.',
    'After a quiet word from a man of {rival}\'s, {name} has gone to {seat}. Nobody will say what the word was.',
    '{name} has moved to {seat}. A man of {rival}\'s said your well was going bad. He said it standing by the well.',
  ],
};

const REBUFFED: Record<RivalState['temperament'], string[]> = {
  grasping: [
    '{rival} offered {name} a cheaper roof in {seat}. {first} asked whether it leaks. {His} man changed the subject and left.',
    'A man from {seat} read {name} a list of lower rents. {first} heard him out, then finished the soup.',
    '{rival} offered {name} a crown off the rent to move to {seat}. {first} said that a crown does not carry a bed.',
    '{rival} sent {name} {his} list of rents. {first} sent it back with the sums corrected.',
  ],
  charming: [
    '{rival} sent {name} a hamper. {first} kept the hamper and stayed put, which is the best outcome for a hamper.',
    '{name} was invited to dine at {seat}, went, ate well, and came home. {rival} is said to be hurt.',
    '{rival} came by to admire the curtains of {name}. {first} thanked {him}, and drew them.',
    '{rival} sent flowers to {name}. {first} has planted them. Here.',
  ],
  ruthless: [
    'A man of {rival}\'s told {name} some things about you. {first} told him some things about {rival}. He has not been back.',
    '{rival} put it about that you were selling up. {name} came to ask, got a straight answer, and stayed.',
    'A man of {rival}\'s hinted to {name} that your roofs were coming down. {first} looked up, saw a roof, and shut the door.',
    'A man of {rival}\'s told {name} your roofs were unsound. {first} invited him up to test one. He declined.',
  ],
};

function tryPoach(s: GameState, list: Tenant[]): void {
  const r = s.rival;
  const t = chooseTarget(s, list);
  const b = t.buildingId ? s.buildings[t.buildingId] ?? null : null;
  const v = vars(s, t, b);
  const refs = { tenantId: t.id, ...(b ? { buildingId: b.id } : {}) };
  const p = poachChance(s, t);
  if (p > 0 && chance(s, p)) {
    proclaim(s, 'rival', POACHED[r.temperament], v, refs);
    moveOut(s, t.id, 'poached');
    r.poached += 1;
    setRenown(r, r.renown + 1.5);
    if (r.temperament === 'ruthless') changeRenown(s, TUNE.rumourRenown, 'rumour');
    return;
  }
  proclaim(s, 'rival', REBUFFED[r.temperament], v, refs);
  changeHappiness(s, t.id, 2, 'turned the rival down');
  setRenown(r, r.renown - 0.5);
}

/** His move in a month when he cannot poach: the thing his temperament does anyway. */
function flavourMove(s: GameState): void {
  const r = s.rival;
  const v = vars(s);
  if (r.temperament === 'grasping') {
    const dear = housed(s).filter(t => overcharge(s, t) > 1.05)
      .sort((a, b) => overcharge(s, b) - overcharge(s, a) || (a.id < b.id ? -1 : 1)).slice(0, TUNE.undercutMax);
    if (dear.length) {
      for (const t of dear) changeHappiness(s, t.id, TUNE.undercutHappiness, 'the rival is cheaper');
      proclaim(s, 'rival', [
        '{rival} has posted {his} rents at the crossroads. They are lower than some of yours, in larger letters. It has been noticed.',
        '{rival} is letting cottages in {seat} for less than you charge. Those of your tenants who pay the most have done the sum.',
        'A crier from {seat} has been reading out the rents of {rival} in your lanes. He reads the low ones twice.',
        '{rival} has had handbills nailed up: "Why pay more?" Your dearest tenants have each taken one home, to consider.',
        'Word from {seat}: {rival} has knocked a crown off every rent {he} has. Your better-paying tenants knew by noon.',
        '{rival} has had {his} rents painted on a cart and the cart driven past your gate, slowly, at the hour people fetch water.',
        'A boy from {seat} is handing out the rents of {rival} on slips of paper. Your dearest tenants use theirs as bookmarks.',
        '{rival} has cut {his} rents again. Nobody knows how {he} lives. Your better-paying tenants have begun to ask how they do.',
      ], v);
    } else if (!heardLately(s, TUNE.idleQuietDays)) {
      // nobody of yours pays over the odds, so his prices bite on nothing: worth a line now and then, no more
      proclaim(s, 'rival', [
        '{rival} posted {his} rents at the crossroads to shame you. They turned out to be higher than yours. The board is gone.',
        '{rival} sent a man to price your cottages. He left looking thoughtful. Nothing in {seat} is that cheap.',
        'A crier from {seat} came to read out the rents of {rival}. Your tenants heard him out and asked him to repeat the joke.',
        '{rival} has been asking what you charge. {He} was told. {He} has gone quiet, which for {him} is an expense.',
        '{rival} cut {his} rents to undersell you and found that {he} had not. {He} is going through your prices with a candle.',
      ], v);
    }
  } else if (r.temperament === 'charming') {
    setRenown(r, r.renown + TUNE.feastRenown);
    proclaim(s, 'rival', [
      '{rival} has thrown a feast at {seat}. The smell reached your tenants, who mention it, lightly, often.',
      'There was dancing at {seat} last night at the expense of {rival}. Your tenants were not invited and know the menu by heart.',
      '{rival} has given every household in {seat} a goose. Your tenants have counted the geese they were not given.',
      'A fiddler hired by {rival} played at the boundary stone all evening, facing your side. People stood and listened.',
      '{rival} toured {his} cottages and admired every baby. Word has reached your lanes, along with the names of the babies.',
      '{rival} has sent every child in {seat} a wooden horse. The children of {seat} have told your tenants\' children, at length.',
      '{rival} danced with a widow of ninety at the {seat} fair, and let her lead. Your lanes talk of little else.',
      'A pie has come from {rival} for "the hard-working tenants of {realm}". It is a very good pie. That is the trouble.',
    ], v);
  } else {
    changeRenown(s, TUNE.rumourRenown, 'rumour');
    proclaim(s, 'rival', [
      'A rumour is going round that you count your tenants\' candles. {rival} was seen starting it, carefully.',
      'Somebody has been saying your wells are haunted. The somebody wears the livery of {rival}.',
      'It is being said in the lanes that you raise the rent on anyone who smiles. {rival} sends {his} sympathy.',
      'A notice has appeared claiming you keep a second set of ledgers. The handwriting belongs to a clerk from {seat}.',
      'The story at the tavern is that you sold a roof with a family under it. {rival} bought the first round, then told it.',
      'Somebody has chalked a rat on three of your doors. There are no rats. There is a man from {seat} with chalk on his cuff.',
      'It is being whispered that the Crown means to take {realm} back. {rival} whispered it first, and loudest.',
      'A ballad about your roofs is going round the tavern. It has nine verses. {rival} paid for all nine.',
    ], v);
  }
}

function makeMove(s: GameState): void {
  const r = s.rival;
  r.lastMoveDay = Math.floor(s.day);
  const list = prospects(s);
  const canPoach = r.renown > s.renown && list.length > 0 && householdCount(s) - 1 >= TUNE.minHouseholdsLeft;
  if (canPoach) tryPoach(s, list);
  else flavourMove(s);
}

const DEFECTED: Record<RivalState['temperament'], string[]> = {
  grasping: [
    'A household from {seat} is at the gate asking after {building}. They say {rival} charges for the well, by the bucket.',
    'A family has walked over from {seat} to ask about {building}. {rival} put up their rent for owning a second chair.',
    'A household from {seat} wants {building}. They say {rival} has begun charging rent on the garden path, by the yard.',
    'A household from {seat} is asking after {building}. {rival} now charges them for the use of their own stairs.',
  ],
  charming: [
    'A household from {seat} asks after {building}. They say {rival} is charming, and that so are the holes in {his} roofs.',
    'A family from {seat} is at the gate about {building}. {rival} sends lovely hampers, they say, and no thatchers.',
    'A household has come from {seat} for {building}. They say {rival} kissed the baby and raised the rent in one visit.',
    'A family from {seat} wants {building}. They say {rival} knows all their names and none of their complaints.',
  ],
  ruthless: [
    'A household from {seat} is at the gate asking after {building}. They say {rival} keeps a list. They will not say of what.',
    'A family from {seat} has come about {building}. They left by night, and ask that {rival} not be told which gate.',
    'A household from {seat} is asking about {building}, quietly. They say {rival} discourages questions, and counts them.',
    'A household from {seat} has come about {building}. They ask what your rules are, and whether they are written down.',
  ],
};

/** Your name stands well above his: one of his households comes to ask about a vacancy. */
function maybeDefect(s: GameState): void {
  const r = s.rival;
  if (s.renown < r.renown + TUNE.defectLead) return;
  const last = numFlag(s, FLAGS.defectDay);
  if (last !== null && s.day - last < TUNE.defectGapDays) return;
  const waiting = new Set(Object.values(s.applicants).map(a => `${a.buildingId}:${a.unit}`));
  const open = vacancies(s).filter(v =>
    v.building.state === 'ready' && !v.building.squatters && v.building.units[v.unit]?.listed === true
    && !waiting.has(`${v.building.id}:${v.unit}`));
  // a home before a shop, then the oldest vacancy
  open.sort((a, b) =>
    Number(BUILDINGS[a.building.type].category !== 'housing') - Number(BUILDINGS[b.building.type].category !== 'housing')
    || (a.building.units[a.unit]!.vacantSince ?? 0) - (b.building.units[b.unit]!.vacantSince ?? 0)
    || (a.building.id < b.building.id ? -1 : a.building.id > b.building.id ? 1 : a.unit - b.unit));
  for (const spot of open) {
    const applicant = spawnApplicant(s, spot.building.id, spot.unit);
    if (!applicant) continue;
    s.flags[FLAGS.defectDay] = Math.floor(s.day);
    setRenown(r, r.renown - 2);
    proclaim(s, 'rival', DEFECTED[r.temperament], vars(s, null, spot.building), { buildingId: spot.building.id });
    return;
  }
  // nowhere to put them: say so now and then, so the ruler knows what a vacancy would have been worth
  const told = numFlag(s, FLAGS.noRoomDay);
  if (open.length === 0 && (told === null || s.day - told >= TUNE.defectGapDays * 2)) {
    s.flags[FLAGS.noRoomDay] = Math.floor(s.day);
    proclaim(s, 'rival', [
      'A household from {seat} asked whether you had anything to let. You had not. They have gone back to {rival}, slowly.',
      'A family from {seat} came looking for a roof of yours. Every one is taken. {rival} will be glad to hear it, for once.',
    ], vars(s));
  }
}

function drift(s: GameState): void {
  const r = s.rival;
  // where his name settles: a little stronger as the stakes rise, with a lean of his own
  const lean = Math.floor(hash01((s.seed | 0) ^ 0x7a31) * 11) - 4;
  const rest = 47 + rankIndex(s.realm.rank) * 4 + lean;
  setRenown(r, r.renown + (rest - r.renown) * 0.02 + (rand(s) - 0.5) * 0.8);
}

const INTRO: Record<RivalState['temperament'], string[]> = {
  grasping: ['{rival} of {seat} sends {his} welcome to the district, and a bill for the messenger.'],
  charming: ['{rival} of {seat} sends a welcome, a ham, and {his} warm regards to your tenants, each of them by name.'],
  ruthless: ['{rival} of {seat} sends no welcome. One of {his} men has been seen on the hill, counting your chimneys.'],
};

export const rivalModule: SimModule = {
  name: 'rival',

  init(s) {
    const roll = RIVAL_NAMES.length
      ? pick(s, RIVAL_NAMES)
      : { name: 'Baron Aldous Vane', seat: 'Greywater', temperament: 'grasping' as const };
    s.rival = {
      name: roll.name, seat: roll.seat, temperament: roll.temperament,
      renown: 46 + randInt(s, 0, 10),
      portraitSeed: randInt(s, 1, 0x3fffffff),
      poached: 0, lastMoveDay: 0,
    };
  },

  onDay(s, day) {
    if (s.ended || !s.rival.name) return;
    if (day >= TUNE.introDay && s.flags[FLAGS.met] !== true) {
      s.flags[FLAGS.met] = true;
      if (day <= TUNE.introDay + 30) proclaim(s, 'rival', INTRO[s.rival.temperament], vars(s));
    }
    drift(s);
    if (day >= nextMoveDay(s)) makeMove(s);
    maybeDefect(s);
  },
};
