/**
 * OWNER: sim-decide agent. The household of delegates: candidates, hiring,
 * wages, loyalty, authority, and the small habits that colour their reports.
 *
 *  - Candidates: three per role the ruler may hire now, and three more for the
 *    roles the next rank brings (they wait at the gate and will not serve yet).
 *  - Loyalty (0..100) moves a quarter of the way each month toward a target set
 *    by wage against skill; it drops at once when their work is countermanded,
 *    when the ruler breaks an oath, or when the wage is cut. Very low: they quit.
 *  - Authority: 0 until the ruler is a Baron, then 1; 2 after a year of service
 *    at loyalty 70 or better.
 *  - Skill grows slowly with experience: a little for each month in the post, and for each job by the
 *    labour in it (a purse fetched teaches less than a roof mended). A better hand expects a better wage.
 *
 * This module owns no free-form state of its own, so its few counters live in `s.incidentLog` (which
 * sim-decide owns) under keys that start with '~staff.': never an incident id.
 */
import {
  DAYS_PER_YEAR, RANK_ORDER, STAFF_ROLES,
  type GameState, type SimModule, type StaffMember, type StaffRole, type Candidate, type ActionResult,
  type RefusalCode, type Job, type RankId, type Id, type ActionOf,
} from './types';
import type { TemperamentDef } from '../data/schema';
import type { BuildingType, Species, TemperamentId } from '../data/ids';
import { ROLE_TITLES } from '../data/ids';
import { TEMPERAMENT_DEFS, TEMPERAMENTS_BY_ROLE } from '../data/temperaments';
import { STAFF_NAMES } from '../data/characters';
import { SPECIES_DEFS } from '../data/species';
import { BUILDINGS } from '../data/buildings';
import { RANKS } from '../data/ranks';
import { BAL } from '../data/balance';
import {
  clamp, clamp100, emit, herald, newId, rand, randInt, pick, weighted, chance, rankIndex, rankAtLeast,
  rulerTitle, fill, hash01, monthIndexOf,
} from './core';
import { rolesUnlocked, speciesUnlocked } from './rank';
import { spawnActor, removeActor } from './actors';
import { buildingsOf } from './buildings';
import { entranceOf } from './world';
import { spend, canAfford } from './economy';
import { resettleOpen } from './orders';

export const TUNE = {
  candidatesPerRole: 3,
  /** crowns to call for new candidates after the month's free call, by rank */
  refreshFee: { reeve: 4, knight: 8, baron: 15, duke: 30, king: 60 } as Record<RankId, number>,
  startLoyalty: 60,
  /** share of the gap to the loyalty target closed each month */
  loyaltyPull: 0.25,
  /** loyalty lost per crown of wage cut, and gained per crown of raise, as a share of the fair wage */
  cutSting: 60, raiseCheer: 30,
  countermand: 4,
  oathBroken: 3, oathKept: 1,
  /** loyalty target = 55 + overpaid x (wage/fair - 1) above a fair wage, underpaid x (wage/fair - 1) below it */
  overpaid: 45, underpaid: 90,
  warnBelow: 25, quitBelow: 15, quitChancePerDay: 0.2,
  /** experience needed for the next point of skill (index = current skill) */
  skillAt: [0, 15, 40, 80, 140],
  /** experience from a month in the post, and the least and most a single job can teach (it teaches its days of labour) */
  xpPerMonth: 1, xpPerJob: [0.2, 1] as [number, number],
  fullJudgmentLoyalty: 70, fullJudgmentKeep: 50,
  maxWage: 300,
};

/** How each temperament sits in a post, apart from the wage. */
const CONTENT: Partial<Record<TemperamentId, number>> = {
  steady: 6, soft: 3, honest: 3, bythebook: 2, perfectionist: 0, lawful: 2,
  grasping: -6, schemer: -5, snob: -3, pennypincher: -1, dreamer: 1, bellower: 1, openhanded: 2,
};

const TOOL: Record<StaffRole, string> = { mason: 'trowel', bailiff: 'ring of keys', crier: 'bell', steward: 'quill' };

const FALLBACK_PITCH: Record<StaffRole, string[]> = {
  mason: [
    'It will stand. I make no promises about straight.',
    'My last wall is still up. So is the cow that leaned on it.',
    'I own my own trowel. Most of it.',
    'I have never had a roof come down on a tenant who had paid.',
  ],
  bailiff: [
    'I knock once. People find that is enough.',
    'I have never lost a purse. One or two have lost me.',
    'I can read a writ, and I can read a face.',
    'They always say next week. I always say which day.',
  ],
  crier: [
    'I have a voice that carries and a bell that carries further.',
    'I once filled a barn. It was a barn. People live in it now.',
    'Every vacancy is a home that has not been shouted about enough.',
    'I describe a place as it could be, on a good day, from a distance.',
  ],
  steward: [
    'I keep two sets of books. One is for practice.',
    'Numbers do as they are told when I hold the quill.',
    'I once balanced a ledger during a siege. The siege lost.',
    'I have found money in places money did not know it was.',
  ],
};

const PARTING: Record<StaffRole, string[]> = {
  mason: [
    'Mend it yourself. The ladder is where I left it, which is not where you think.',
    'I have had an offer from a pig farmer. The pigs listen.',
    'Every wall I built for you is still standing. Remember that when they stop.',
  ],
  bailiff: [
    'I have knocked on my last door for you. This one I am closing.',
    'Consider this my Notice to Quit. I have nailed it to your door.',
    'You may collect your own rents. Mind the dog at the third house.',
  ],
  crier: [
    'OYEZ. I resign. That is the whole announcement.',
    'I can no longer describe this place with a straight face.',
    'I am taking the bell. The box you may keep.',
  ],
  steward: [
    'The books are balanced, and so am I. Good day.',
    'I leave you the ledger. The red parts are yours.',
    'I have counted what you pay me one last time. It did not take long.',
  ],
};

/**
 * Short clauses that end a delegate's report, by temperament. They follow a
 * plain statement of what was done ("Agnes served notice on Wat Mudge") and
 * carry the full stop. None uses a pronoun: the roll does not record one.
 */
const TAILS: Record<TemperamentId, string[]> = {
  perfectionist: [', and measured twice.', '. It will be done right or not at all.', ', slowly and with pride.', ', and would like it known that the last mason did not.'],
  bodger: ['. It will hold.', ', near enough.', ' in under an hour, which is the worrying part.', '. A second look was not thought necessary.'],
  dreamer: [', and has ideas about a turret.', '. There was talk of gargoyles.', ', humming.', ', and sketched something on the wall afterwards.'],
  steady: ['.', ', without comment.', ', and went back to work.', ', and said nothing more about it.'],
  iron: [', as is the habit.', ', and enjoyed the knock.', ', before breakfast.', '. No tears were accepted.'],
  soft: [', after asking about the family.', ', gently.', ', and stayed for soup.', ', and came away with a jar of plums.'],
  grasping: [', for a consideration.', ', and counted it twice.', '. A receipt was not offered.', ', with one hand out.'],
  lawful: [', by the letter of the charter.', ', to the day.', ', citing the clause.', ', and read the whole of it aloud.'],
  honeytongue: [', with a great many adjectives.', ', and called the ditch a water feature.', ', warmly.', ', and described the damp as "atmosphere".'],
  honest: [', and mentioned the damp.', ', plainly.', ', warts first.', ', and pointed out the crack unprompted.'],
  snob: [', after a look at the shoes.', ', with a small sigh.', ', as a favour to the street.', ', and wiped the door handle afterwards.'],
  bellower: [', AT VOLUME.', '. The whole street knows.', ', audibly from the mill.', '. Three dogs joined in.'],
  pennypincher: [', and begrudged the ink.', ', after checking the sums three times.', '. Not a farthing was wasted.', ', and reused the parchment.'],
  openhanded: [', with your compliments.', ', generously, with your money.', ', and threw in a kind word.', ', and a little something for the children.'],
  bythebook: [', in triplicate.', ', per the form.', ', and filed it.', ', once the proper box had been ticked.'],
  schemer: [', for reasons that will become clear.', '. It is all part of the plan.', ', smiling slightly.', ', and made a note in the other ledger.'],
};

// ───────────── lookups ─────────────

export function staffOf(s: GameState, role: StaffRole): StaffMember | null {
  for (const m of Object.values(s.staff)) if (m.role === role) return m;
  return null;
}
export function temperamentOf(s: GameState, role: StaffRole): TemperamentDef | null {
  const m = staffOf(s, role);
  return m ? (TEMPERAMENT_DEFS[m.temperament] ?? null) : null;
}
/** The delegate this actor embodies, if it is one. */
export function staffByActor(s: GameState, actorId: Id | null | undefined): StaffMember | null {
  if (!actorId) return null;
  for (const m of Object.values(s.staff)) if (m.actorId === actorId) return m;
  return null;
}
/** The staff building a role works from. */
export function staffBuildingFor(role: StaffRole): BuildingType {
  for (const def of Object.values(BUILDINGS)) if (def.staffRole === role) return def.id;
  return 'seat';
}
/** A stable, pronoun-free clause to close a report of this delegate's work. `seed` picks the variant. */
export function reportTail(m: StaffMember, seed: number): string {
  const tails = TAILS[m.temperament];
  if (!tails || !tails.length) return '.';
  const r = hash01(seed * 31 + m.portraitSeed);
  if (r < 0.3) return '.';                       // sometimes the clerk just reports it
  return tails[Math.floor(hash01(seed * 17 + m.portraitSeed + 7) * tails.length)] ?? '.';
}
/** What a fair employer pays a hand of this skill. */
export function fairWage(skill: number): number {
  return BAL.wageBySkill[clamp(Math.round(skill), 1, BAL.wageBySkill.length - 1)] ?? 12;
}

// ───────────── loyalty ─────────────

function nudge(s: GameState, m: StaffMember, amount: number): void {
  if (!amount) return;
  const before = m.loyalty;
  m.loyalty = Math.round(clamp100(m.loyalty + amount));
  if (m.actorId && Math.abs(m.loyalty - before) >= 4) emit(s, { type: 'emote', emote: amount < 0 ? 'angry' : 'happy', actorId: m.actorId });
}
export function changeLoyalty(s: GameState, role: StaffRole, amount: number): void {
  const m = staffOf(s, role);
  if (m) nudge(s, m, amount);
}
/** The ruler undid something this delegate was doing or had been told to do. They notice. */
export function countermand(s: GameState, role: StaffRole, weight = 1): void {
  const m = staffOf(s, role); if (!m) return;
  nudge(s, m, -TUNE.countermand * weight);
  const def = TEMPERAMENT_DEFS[m.temperament];
  const line = def?.grumbles?.length ? def.grumbles[Math.floor(rand(s) * def.grumbles.length)]! : '';
  if (line) emit(s, { type: 'say', text: fill(line, { title: rulerTitle(s), ruler: s.realm.ruler }), staffId: m.id, ...(m.actorId ? { actorId: m.actorId } : {}) });
}

function loyaltyTarget(s: GameState, m: StaffMember): number {
  const ratio = m.wage / Math.max(1, fairWage(m.skill));
  // being underpaid is felt twice as keenly as being overpaid is enjoyed
  const wage = ratio >= 1 ? TUNE.overpaid * (ratio - 1) : TUNE.underpaid * (ratio - 1);
  return clamp(55 + wage + (s.renown - 50) * 0.15 + (CONTENT[m.temperament] ?? 0), 2, 95);
}

function quit(s: GameState, m: StaffMember): void {
  const line = pick(s, PARTING[m.role]);
  herald(s, 'staff', `${m.name} has quit as your ${ROLE_TITLES[m.role]}. "${line}"`, { staffId: m.id });
  emit(s, { type: 'say', text: line, staffId: m.id, ...(m.actorId ? { actorId: m.actorId } : {}) });
  remove(s, m);
  for (const o of Object.values(s.staff)) nudge(s, o, -2);
}

function remove(s: GameState, m: StaffMember): void {
  if (m.actorId) removeActor(s, m.actorId);
  delete s.staff[m.id];
  delete s.incidentLog[xpKey(m.id)];
  emit(s, { type: 'staff_left', staffId: m.id, name: m.name, role: m.role });
}

// ───────────── candidates ─────────────

function previewRoles(s: GameState): StaffRole[] {
  const now = rolesUnlocked(s);
  const next = RANK_ORDER[rankIndex(s.realm.rank) + 1];
  const soon = next ? RANKS[next].staff : [];
  return STAFF_ROLES.filter(r => now.includes(r) || soon.includes(r));
}

function rollSkill(s: GameState): number {
  // the better your name, the better the hands that answer the call
  const mu = 1.4 + (clamp100(s.renown) / 100) * 1.8;
  return weighted(s, [1, 2, 3, 4], k => Math.exp(-((k - mu) ** 2) / 1.6)) ?? 2;
}

function rollOne(s: GameState, role: StaffRole, usedNames: Set<string>, usedTemps: Set<TemperamentId>): Candidate {
  const pool = (STAFF_NAMES.find(d => d.role === role)?.names ?? []).filter(n => !usedNames.has(n.name));
  let name: string, first: string, species: Species, pitch: string;
  if (pool.length) {
    const n = pick(s, pool);
    name = n.name; first = n.first; species = n.species; pitch = n.pitch;
  } else {
    // the roll of names has run dry: someone nobody has heard of
    const kinds = speciesUnlocked(s);
    species = kinds.length ? pick(s, kinds) : 'human';
    const sd = SPECIES_DEFS[species];
    let tries = 0;
    do {
      first = sd?.firstNames?.length ? pick(s, sd.firstNames) : 'Wat';
      const sur = sd?.surnames?.length ? pick(s, sd.surnames) : '';
      name = sur ? `${first} ${sur}` : first;
    } while (usedNames.has(name) && ++tries < 12);
    pitch = pick(s, FALLBACK_PITCH[role]);
  }
  usedNames.add(name);
  const temps = TEMPERAMENTS_BY_ROLE[role] ?? [];
  const fresh = temps.filter(t => !usedTemps.has(t));
  const temperament = pick(s, fresh.length ? fresh : temps);
  usedTemps.add(temperament);
  const skill = rollSkill(s);
  const wage = Math.max(1, Math.round(fairWage(skill) * (0.9 + rand(s) * 0.25)));
  return {
    id: newId(s, 'c'), role, name, first, species, portraitSeed: randInt(s, 1, 0x7fffffff),
    temperament, skill, wage, temperamentKnown: chance(s, 0.5), pitch,
  };
}

/** Replace the candidates for these roles (default: every role on offer at this rank). */
export function rollCandidates(s: GameState, roles?: StaffRole[]): void {
  const wanted = roles ?? previewRoles(s);
  const keep = s.candidates.filter(c => !wanted.includes(c.role));
  const usedNames = new Set<string>([...keep.map(c => c.name), ...Object.values(s.staff).map(m => m.name)]);
  const out = keep.slice();
  for (const role of wanted) {
    const usedTemps = new Set<TemperamentId>();
    for (let i = 0; i < TUNE.candidatesPerRole; i++) out.push(rollOne(s, role, usedNames, usedTemps));
  }
  s.candidates = out;
}

/** Roles newly on offer (a promotion, an old save) get their three; roles no longer on offer lose theirs. */
function ensureCandidates(s: GameState): void {
  const wanted = previewRoles(s);
  const missing = wanted.filter(r => !s.candidates.some(c => c.role === r));
  if (missing.length) rollCandidates(s, missing);
  if (s.candidates.some(c => !wanted.includes(c.role))) s.candidates = s.candidates.filter(c => wanted.includes(c.role));
}

// ───────────── authority, skill ─────────────

const xpKey = (id: Id): string => '~staff.xp.' + id;

/** What this delegate has learned so far, on the scale of TUNE.skillAt. */
export function experienceOf(s: GameState, m: StaffMember): number {
  return s.incidentLog[xpKey(m.id)] ?? (TUNE.skillAt[clamp(Math.round(m.skill), 1, 5) - 1] ?? 0);
}

function learn(s: GameState, m: StaffMember, amount: number): void {
  if (!(amount > 0)) return;
  const xp = experienceOf(s, m) + amount;
  s.incidentLog[xpKey(m.id)] = xp;
  const need = TUNE.skillAt[m.skill];
  if (m.skill >= 5 || need === undefined || xp < need) return;
  m.skill++;
  const fair = fairWage(m.skill);
  herald(s, 'staff', m.wage >= fair
    ? `${m.first} has got better at the work, and knows it. At ${m.wage} crowns a month there is, for once, no hint about the wage.`
    : `${m.first} has got better at the work, and knows it. A ${ROLE_TITLES[m.role]} of that skill is usually paid ${fair} crowns.`, { staffId: m.id });
  if (m.actorId) emit(s, { type: 'emote', emote: 'idea', actorId: m.actorId });
}

function updateAuthority(s: GameState, announce: boolean): void {
  const baron = rankAtLeast(s, 'baron');
  let raisedToOne = 0, changed = false;
  for (const m of Object.values(s.staff)) {
    let want: 0 | 1 | 2 = 0;
    if (baron) {
      const served = s.day - m.hiredDay >= DAYS_PER_YEAR;
      if (m.authority === 2) want = m.loyalty >= TUNE.fullJudgmentKeep ? 2 : 1;
      else want = served && m.loyalty >= TUNE.fullJudgmentLoyalty ? 2 : 1;
    }
    if (want === m.authority) continue;
    const was = m.authority;
    m.authority = want;
    changed = true;
    if (!announce) continue;
    if (want === 2) herald(s, 'staff', `${m.first} has served a year and a day as ${ROLE_TITLES[m.role]} and now uses full judgment. You will hear what was decided afterwards.`, { staffId: m.id });
    else if (want === 1 && was === 0) raisedToOne++;
    else if (want === 1 && was === 2) herald(s, 'staff', `${m.first} no longer feels moved to use much judgment on your behalf, and will stick to the ${TOOL[m.role]}.`, { staffId: m.id });
  }
  if (raisedToOne > 0) herald(s, 'staff', 'Your delegates may now rule on matters in their own domains. Each has been waiting to, in a different way.');
  if (changed) resettleOpen(s);        // more authority: more of what is open is theirs to settle
}

// ───────────── actions ─────────────

function refuse(code: RefusalCode, reason: string): ActionResult { return { ok: false, code, reason }; }

function unlockRank(role: StaffRole): RankId | null {
  for (const r of RANK_ORDER) if (RANKS[r].staff.includes(role)) return r;
  return null;
}

function hire(s: GameState, a: ActionOf<'hire'>): ActionResult {
  const c = s.candidates.find(x => x.id === a.candidateId);
  if (!c) return refuse('not_found', 'That candidate has taken the road. Call for new ones.');
  const title = ROLE_TITLES[c.role];
  if (!rolesUnlocked(s).includes(c.role)) {
    const r = unlockRank(c.role);
    return refuse('locked', r ? `A ${title} serves no one below a ${RANKS[r].title}, ${rulerTitle(s)}.` : `No ${title} will serve here yet.`);
  }
  const holder = staffOf(s, c.role);
  if (holder) return refuse('occupied', `${holder.first} already holds the post of ${title}. There is one ${TOOL[c.role]} and it is taken.`);
  const btype = staffBuildingFor(c.role);
  const yards = buildingsOf(s, btype);
  const yard = yards.find(b => b.state === 'ready');
  if (!yard) {
    const place = BUILDINGS[btype].name;
    return yards.some(b => b.state === 'building')
      ? refuse('not_ready', `The ${place} is not finished. ${c.first} will not work out of a hole in the ground.`)
      : refuse('not_ready', `${c.first} will need a ${place} to work from. Build one first.`);
  }
  const id = newId(s, 's');
  let at: [number, number] = [yard.x + yard.w / 2, yard.y + yard.h / 2];
  try { at = entranceOf(s, yard); } catch { /* the yard has no door yet; stand in it */ }
  const actor = spawnActor(s, { kind: 'staff', refId: id, x: at[0], y: at[1], speed: BAL.walkSpeed.staff });
  const m: StaffMember = {
    id, role: c.role, name: c.name, first: c.first, species: c.species, portraitSeed: c.portraitSeed,
    temperament: c.temperament, skill: c.skill, wage: c.wage, loyalty: TUNE.startLoyalty, hiredDay: s.day,
    actorId: actor?.id ?? null, authority: rankAtLeast(s, 'baron') ? 1 : 0, jobsDone: 0,
  };
  s.staff[id] = m;
  s.candidates = s.candidates.filter(x => x.id !== c.id);
  emit(s, { type: 'staff_hired', staffId: id });
  // the herald has 150 characters: the news first, then the nickname and the pitch if there is room for them
  const epithet = TEMPERAMENT_DEFS[c.temperament]?.epithet;
  const news = `${c.name} is now your ${title}, at ${c.wage} crowns a month.`;
  const known = epithet ? ` They call ${c.first} ${epithet}.` : '';
  const pitch = c.pitch ? ` "${c.pitch}"` : '';
  const line = [news + known + pitch, news + pitch, news + known, news].find(x => x.length <= 150) ?? news;
  herald(s, 'staff', line, { staffId: id });
  if (c.pitch) emit(s, { type: 'say', text: c.pitch, staffId: id, ...(actor ? { actorId: actor.id } : {}) });
  resettleOpen(s);   // a new hand takes up whatever routine work is lying about
  return { ok: true, id };
}

function dismissStaff(s: GameState, a: ActionOf<'dismiss_staff'>): ActionResult {
  const m = s.staff[a.staffId];
  if (!m) return refuse('not_found', 'No one of that name is in your service.');
  herald(s, 'staff', `${m.name} is no longer your ${ROLE_TITLES[m.role]}. The good ${TOOL[m.role]} appears to have left as well.`, { staffId: m.id });
  remove(s, m);
  // the rest of the household draws its own conclusions
  for (const o of Object.values(s.staff)) nudge(s, o, m.loyalty >= 50 ? -3 : -1);
  return { ok: true };
}

function setWage(s: GameState, a: ActionOf<'set_wage'>): ActionResult {
  const m = s.staff[a.staffId];
  if (!m) return refuse('not_found', 'No one of that name is in your service.');
  const wage = Math.round(Number(a.wage));
  if (!Number.isFinite(wage)) return refuse('invalid', 'That is not a wage. That is a noise.');
  if (wage < 1) return refuse('invalid', `No one works for nothing, ${rulerTitle(s)}. Not twice.`);
  const w = Math.min(wage, TUNE.maxWage);
  if (w === m.wage) return { ok: true, id: m.id };
  const fair = Math.max(1, fairWage(m.skill));
  const old = m.wage;
  m.wage = w;
  if (w > old) {
    nudge(s, m, Math.floor((TUNE.raiseCheer * (w - old)) / fair));
    herald(s, 'staff', `${m.first} now draws ${w} crowns a month, up from ${old}, and was seen to whistle.`, { staffId: m.id });
  } else {
    nudge(s, m, -Math.ceil((TUNE.cutSting * (old - w)) / fair));
    herald(s, 'staff', `${m.first} now draws ${w} crowns a month, down from ${old}, and was seen to count it twice.`, { staffId: m.id });
  }
  return { ok: true, id: m.id };
}

const REFRESH_KEY = '~staff.freeCall';

function refreshCandidates(s: GameState, _a: ActionOf<'refresh_candidates'>): ActionResult {
  if (!previewRoles(s).length) return refuse('locked', 'There is no one to call for. Nobody of that kind serves a ruler of your standing.');
  const month = monthIndexOf(s.day);
  const free = s.incidentLog[REFRESH_KEY] !== month;
  if (free) s.incidentLog[REFRESH_KEY] = month;
  else {
    const fee = TUNE.refreshFee[s.realm.rank] ?? 10;
    if (!canAfford(s, fee)) return refuse('no_gold', `Crying the posts again costs ${fee} crowns, ${rulerTitle(s)}, and the coffers hold ${Math.max(0, Math.floor(s.gold))}.`);
    spend(s, fee, 'other', 'Crying the vacant posts');
  }
  rollCandidates(s);
  herald(s, 'info', free
    ? `Word went out that ${s.realm.name || 'the realm'} is hiring. New faces wait at the gate, hats in hand.`
    : `The posts were cried again, for a fee. A fresh row of hopefuls has formed at the gate.`);
  return { ok: true };
}

// ───────────── the module ─────────────

const OATHS_KEY = '~staff.oathsBroken';
const KEPT_KEY = '~staff.oathsKept';

export const staffModule: SimModule = {
  name: 'staff',

  init(s) {
    rollCandidates(s);
    s.incidentLog[OATHS_KEY] = s.stats.oathsBroken;
    s.incidentLog[KEPT_KEY] = s.stats.oathsKept;
  },

  onDay(s) {
    ensureCandidates(s);
    updateAuthority(s, true);

    // a broken oath is heard in the servants' hall the same day
    const broken = s.stats.oathsBroken - (s.incidentLog[OATHS_KEY] ?? s.stats.oathsBroken);
    const kept = s.stats.oathsKept - (s.incidentLog[KEPT_KEY] ?? s.stats.oathsKept);
    s.incidentLog[OATHS_KEY] = s.stats.oathsBroken;
    s.incidentLog[KEPT_KEY] = s.stats.oathsKept;
    if (broken > 0 || kept > 0) {
      for (const m of Object.values(s.staff)) nudge(s, m, kept * TUNE.oathKept - broken * TUNE.oathBroken);
    }

    for (const m of Object.values(s.staff)) {
      if (m.loyalty < TUNE.quitBelow && chance(s, TUNE.quitChancePerDay)) quit(s, m);
    }
  },

  onMonth(s) {
    for (const m of Object.values(s.staff)) {
      const before = m.loyalty;
      const target = loyaltyTarget(s, m);
      m.loyalty = Math.round(clamp100(m.loyalty + (target - m.loyalty) * TUNE.loyaltyPull));
      if (m.loyalty < TUNE.warnBelow && m.loyalty <= before) {
        herald(s, 'staff', m.wage < fairWage(m.skill)
          ? `${m.first} has been heard pricing carts, and mentioning what a ${ROLE_TITLES[m.role]} of that skill is paid elsewhere.`
          : `${m.first} has been heard pricing carts. It is not the wage. It may be you.`, { staffId: m.id });
      }
      learn(s, m, TUNE.xpPerMonth);
    }
  },

  onJobDone(s, job: Job) {
    const m = staffByActor(s, job.assignee);
    if (!m) return;
    m.jobsDone++;
    const days = Number.isFinite(job.workDays) ? job.workDays : 0.5;
    learn(s, m, clamp(days, TUNE.xpPerJob[0], TUNE.xpPerJob[1]));
  },

  handlers: {
    hire, dismiss_staff: dismissStaff, set_wage: setWage, refresh_candidates: refreshCandidates,
  },
};
