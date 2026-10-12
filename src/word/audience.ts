/**
 * OWNER: word-audience agent.
 *
 * Audience sessions: talking a petitioner through to a ruling.
 *
 * A session is one conversation about one open incident. The ruler speaks
 * (`say`), the petitioner answers in character, and when the ruler's words
 * amount to one of the incident's outcomes the session dispatches
 * `resolve_incident` and closes. Nothing here changes the world except
 * through `deps.dispatch`, and the sim may refuse anything.
 *
 * With a model: the model voices the petitioner and names the outcome (or
 * null). Every field of its answer is validated; an answer that cannot be
 * trusted is thrown away and the turn is answered offline instead.
 * Without a model (or when a call fails): the ruler's words are matched
 * against each outcome's label, `say` line and intent; a clear match rules,
 * anything else earns a gentle nudge toward the Steward's whispers.
 *
 * A ruling cannot be taken back, and the model at court may be a small one.
 * So three things hold whatever it answers:
 *  - one of the Steward's whispers, said as written, IS that ruling;
 *  - a ruling the model hears in a question, a maybe, or words that say the
 *    opposite is not applied: the petitioner asks "Is that your ruling?" and
 *    an "aye" (or the same words again) settles it;
 *  - promises and traits it reports are checked against what the ruler
 *    actually said and what the household actually is.
 *
 * Oaths. A promise is entered in the ledger in the turn it is made
 * (`turn.oaths`), ruling or no ruling. The final turn (`done: true`) lists
 * every oath sworn in the audience, so the seal can show them together.
 * Promises to an applicant wait until they have signed.
 */
import type { AudienceSession, AudienceTurn, AudienceLine, Speaker, Mood, WordDeps, ModelClient, ModelRequest } from './api';
import type {
  Id, GameState, Incident, Tenant, Applicant, StaffMember, Building, Oath, OathKind, DecisionOption,
} from '../sim/types';
import type { IncidentDef, OutcomeDef, NpcDef } from '../data/schema';
import type { NpcId, TraitId, BuildingType, Species } from '../data/ids';
import { INCIDENT_BY_ID, NPC_DEFS, RANKS, BUILDINGS } from '../data';
import { fill, baseVars, dateOf } from '../sim/core';
import {
  buildAudiencePrompt, parseAudienceReply, cleanSpoken, finishedSentences, mayShout, readMood, OATH_KINDS, REPLY_CAP,
} from './audience-prompt';

/** After this many ruler turns the Steward insists on a ruling and the model is no longer asked. */
export const MAX_RULER_TURNS = 10;
/** A model call slower than this is abandoned and the turn is answered offline. */
export const MODEL_TIMEOUT_MS = 25000;
const MAX_OATHS_PER_TURN = 2;
const MAX_OATHS_PER_SESSION = 4;
const DAYS_PER_MONTH = 30;

type Vars = Record<string, string | number>;

// ───────────────────────────── who is speaking ─────────────────────────────

/** Everyone an audience involves, resolved from the incident. */
export interface AudienceCast {
  speaker: Speaker;
  /** the speaker's own household record, when they are a tenant or a neighbour */
  tenant: Tenant | null;
  /** the speaker, when they are an applicant */
  applicant: Applicant | null;
  /** the speaker, when they are one of the ruler's delegates */
  staff: StaffMember | null;
  /** the speaker, when they are a court character */
  npc: NpcDef | null;
  /** the household the matter concerns (may be the speaker) */
  subject: Tenant | null;
  building: Building | null;
}

function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function moodFromHappiness(h: number): Mood {
  return h >= 80 ? 'pleased' : h >= 55 ? 'neutral' : h >= 38 ? 'worried' : h >= 20 ? 'annoyed' : 'angry';
}

const NPC_MOODS: Partial<Record<NpcId, Mood>> = {
  goblin_chief: 'pleased', moneylender: 'smug', rival_lord: 'smug', your_mother: 'worried',
  dragon_adjuster: 'sad', royal_assessor: 'annoyed', commons_warden: 'annoyed', mysterious_stranger: 'smug',
};

const HONORIFICS = new Set(['sir', 'lord', 'lady', 'chief', 'bishop', 'father', 'mother', 'brother', 'sister', 'master', 'mistress',
  'magister', 'judge', 'baron', 'baroness', 'old', 'dame', 'captain', 'warden', 'the', 'justice', 'squire', 'goodman', 'goody',
  'widow', 'young', 'big', 'little', 'soft', 'mad', 'honest', 'assessor', 'collector', 'adjuster', 'inspector', 'duke', 'king']);
function firstOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const pick = parts.find(p => !HONORIFICS.has(p.toLowerCase().replace(/[^a-z]/g, '')));
  return pick ?? parts[0] ?? name;
}

function tenantSpeaker(t: Tenant, def: IncidentDef, asNeighbour: boolean): Speaker {
  let mood = moodFromHappiness(t.happiness);
  if (asNeighbour) mood = mood === 'angry' ? 'angry' : 'annoyed';
  else if ((def.category === 'payment' || def.category === 'legal') && (mood === 'pleased' || mood === 'neutral')) mood = 'worried';
  else if ((def.category === 'windfall' || def.category === 'festival') && (mood === 'neutral' || mood === 'worried')) mood = 'pleased';
  return { kind: 'tenant', name: t.name, first: t.first, species: t.species, portraitSeed: t.portraitSeed, tenantId: t.id, mood };
}

function nearestNeighbour(s: GameState, building: Building | null, notId: Id | null, salt: string): Tenant | null {
  const housed = Object.values(s.tenants).filter(t => t.status === 'housed' && t.id !== notId && t.buildingId);
  if (!housed.length) return null;
  if (!building) return housed[hashStr(salt) % housed.length]!;
  const cx = building.x + building.w / 2, cy = building.y + building.h / 2;
  let best: Tenant | null = null, bestD = Infinity;
  for (const t of housed) {
    const b = s.buildings[t.buildingId!];
    if (!b || b.id === building.id) continue;
    const d = Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    if (d < bestD - 1e-6 || (Math.abs(d - bestD) <= 1e-6 && best && t.id < best.id)) { best = t; bestD = d; }
  }
  return best ?? housed[hashStr(salt) % housed.length]!;
}

/** Work out who is standing at the seat for this incident. Never throws; falls back to the court clerk. */
export function resolveCast(s: GameState, inc: Incident, def: IncidentDef): AudienceCast {
  const building = inc.buildingId ? s.buildings[inc.buildingId] ?? null : null;
  const subject = inc.tenantId ? s.tenants[inc.tenantId] ?? null : null;
  const ref = inc.actorId ? s.actors[inc.actorId]?.refId ?? null : null;
  const blank = { tenant: null, applicant: null, staff: null, npc: null, subject, building };
  const spec = def.petitioner ?? (inc.applicantId ? 'applicant' : subject ? 'tenant' : null);

  if (spec === 'applicant') {
    const a = (inc.applicantId ? s.applicants[inc.applicantId] : null) ?? (ref ? s.applicants[ref] : null)
      ?? Object.values(s.applicants).find(x => x.buildingId === inc.buildingId && (inc.unit === null || x.unit === inc.unit)) ?? null;
    if (a) {
      const h = a.household;
      const speaker: Speaker = { kind: 'applicant', name: h.name, first: h.first, species: h.species, portraitSeed: h.portraitSeed, applicantId: a.id, mood: 'pleased' };
      return { ...blank, speaker, applicant: a, building: building ?? s.buildings[a.buildingId] ?? null };
    }
  }
  if (spec === 'neighbor') {
    const fromActor = ref && ref !== inc.tenantId ? s.tenants[ref] ?? null : null;
    const n = fromActor ?? nearestNeighbour(s, building ?? (subject?.buildingId ? s.buildings[subject.buildingId] ?? null : null), inc.tenantId, inc.id);
    if (n) return { ...blank, speaker: tenantSpeaker(n, def, true), tenant: n };
  }
  if (spec === 'staff') {
    const all = Object.values(s.staff);
    const named = typeof inc.vars.staff === 'string' ? all.find(m => m.name === inc.vars.staff || m.first === inc.vars.staff) : undefined;
    const role = def.requires?.hasStaff?.[0];
    const m = (ref ? s.staff[ref] : undefined) ?? named ?? (role ? all.find(x => x.role === role) : undefined) ?? all[0];
    if (m) {
      const mood: Mood = m.loyalty >= 60 ? 'neutral' : m.loyalty >= 35 ? 'worried' : 'annoyed';
      const speaker: Speaker = { kind: 'staff', name: m.name, first: m.first, species: m.species, portraitSeed: m.portraitSeed, role: m.role, staffId: m.id, mood };
      return { ...blank, speaker, staff: m };
    }
  }
  if (spec && typeof spec === 'object') {
    const n = NPC_DEFS[spec.npc];
    if (n) {
      const isRival = spec.npc === 'rival_lord' && !!s.rival?.name;
      const name = isRival ? s.rival.name : n.name;
      // a court character known only by an office ("The Dragon Adjuster") keeps the whole of it
      const first = !isRival && n.name === n.title ? name : firstOf(name);
      const speaker: Speaker = {
        kind: 'npc', name, first, species: n.species,
        portraitSeed: isRival ? s.rival.portraitSeed : hashStr('npc:' + spec.npc) % 100000,
        npc: spec.npc, mood: NPC_MOODS[spec.npc] ?? 'neutral',
      };
      return { ...blank, speaker, npc: n };
    }
  }
  // 'tenant', or anything above that could not be found
  const t = subject ?? (ref ? s.tenants[ref] ?? null : null);
  if (t) return { ...blank, speaker: tenantSpeaker(t, def, false), tenant: t, subject: t };
  const speaker: Speaker = { kind: 'herald', name: 'The Court Clerk', first: 'Clerk', species: 'human', portraitSeed: hashStr('court-clerk') % 100000, mood: 'neutral' };
  return { ...blank, speaker };
}

/** Placeholders for this incident: the sim's own `vars` on top of the standard set. */
export function audienceVars(s: GameState, inc: Incident, cast: AudienceCast): Vars {
  const v: Vars = { ...baseVars(s, cast.building, cast.subject ?? cast.tenant) };
  if (cast.applicant) {
    const h = cast.applicant.household;
    v.tenant = h.name; v.first = h.first; v.trade = h.trade.replace(/_/g, ' '); v.species = h.species;
    if (h.pets.length) v.pet = h.pets[0]!.replace(/_/g, ' ');
  }
  if (cast.staff && v.staff === undefined) v.staff = cast.staff.name;
  return { ...v, ...inc.vars };
}

/** Fill a line someone SAYS to the ruler: `{title}` becomes the form of address ("Sir", "my lord"). */
export function fillSpoken(template: string, vars: Vars, address: string): string {
  const cap = address.charAt(0).toUpperCase() + address.slice(1);
  const t = template.replace(/(^|[.!?]\s+)\{title\}/g, (_m, pre: string) => pre + cap);
  return fill(t, { ...vars, title: address });
}

// ───────────────────────────── how an outcome lands ─────────────────────────────

/** Roughly how the petitioner feels about an outcome, from its effects. Positive is good for them. */
export function outcomeFeeling(o: OutcomeDef): number {
  let n = 0;
  let paid = 0, goes = false;
  for (const e of o.effects) {
    switch (e.t) {
      case 'happiness': if (!e.scope || e.scope === 'tenant' || e.scope === 'building') n += e.amount; break;
      case 'memory': n += e.valence * 4; break;
      case 'evict': n -= 22; break;
      case 'leave': n -= 8; goes = true; break;
      case 'arrears': n += e.amount === 'forgive' ? 8 : -Math.max(-8, Math.min(8, e.amount / 2)); break;
      case 'rent': n -= e.pct / 4; break;
      case 'lease': n += e.accept ? ((e.rentPct ?? 100) > 100 ? 3 : 9) : -9; break;
      case 'deposit': n += e.keepPct === 0 ? 9 : e.keepPct < 0 ? -2 : -e.keepPct / 8; break;
      case 'pet': n += e.remove ? -10 : 4; break;
      case 'squatters': if (e.set === null) { n -= 6; goes = true; } break;
      case 'squatters_sign_lease': n += 16; break;
      case 'screen': n -= 2; break;
      case 'gold': if (e.amount < 0) paid += -e.amount; break;
      case 'late': n += ({ wait: 3, late_fee: -3, payment_plan: 4, forgive: 8, notice: -8, mercy: 10, evict: -15 } as Partial<Record<DecisionOption, number>>)[e.option] ?? 0; break;
      default: break;
    }
  }
  if (goes && paid > 0) n += 8;      // paid to go: coin for keys, a goblin relocation
  return n;
}

function moodForOutcome(o: OutcomeDef): Mood {
  const n = outcomeFeeling(o);
  const loss = o.effects.some(e => e.t === 'evict' || e.t === 'leave' || (e.t === 'pet' && e.remove));
  if (n >= 14) return 'delighted';
  if (n >= 4) return 'pleased';
  if (n > -4) return 'neutral';
  if (n > -14) return loss ? 'sad' : 'annoyed';
  return 'angry';
}

const MOOD_WEIGHT: Record<Mood, number> = { delighted: 8, pleased: 4, smug: 2, neutral: 0, worried: -2, sad: -5, annoyed: -5, afraid: -6, angry: -9 };
const MOOD_TAIL: Record<Mood, string> = {
  delighted: 'They left delighted.', pleased: 'They left content.', smug: 'They left looking pleased with themselves.',
  neutral: 'They left without complaint.', worried: 'They left uneasy.', sad: 'They left downcast.',
  annoyed: 'They left sour.', afraid: 'They left shaken.', angry: 'They left furious.',
};

function memoryOf(def: IncidentDef, o: OutcomeDef, vars: Vars, turns: number, byWhisper: boolean, mood: Mood): { text: string; valence: -2 | -1 | 1 | 2 } {
  const n = outcomeFeeling(o) + MOOD_WEIGHT[mood];
  const valence: -2 | -1 | 1 | 2 = n >= 12 ? 2 : n >= 0 ? 1 : n > -12 ? -1 : -2;
  const title = fill(def.title, vars);
  const lead = byWhisper || turns <= 1 ? `You ruled on "${title}" without much talk.`
    : turns <= 4 ? `You heard them out over "${title}".`
    : `You argued "${title}" with them at length.`;
  const label = fill(o.label, vars).replace(/[.!?]+$/, '');
  return { text: `${lead} Your ruling: ${label}. ${MOOD_TAIL[mood]}`.slice(0, 180), valence };
}

// ───────────────────────────── offline: matching words to a ruling ─────────────────────────────

const STOP = new Set(('the a an and or of to in on at for with by from as is are was were be been being am it its this that these those ' +
  'i me my mine we our ours us you your yours he him his she her hers they them their theirs will shall would should can could may might must ' +
  'do does did have has had so then than there here if into about just very well now please ruler reeve sir lord lady lordship ' +
  'what which who whom when why how also too only one say says said tell told get gets got getting take takes took taken taking ' +
  'want wants wanted going am im ill ive id youre thats its hes shes theyre once fine').split(' '));
const NEGATORS = new Set(['no', 'not', 'never', 'dont', 'doesnt', 'didnt', 'wont', 'cannot', 'cant', 'without', 'neither', 'nor', 'wouldnt', 'shant', 'isnt', 'arent', 'nobody', 'none']);
const CLAUSE_BREAK = new Set(['but', 'instead', 'however', 'though', 'although', 'yet', 'rather']);

/** word -> the idea it stands for, so that "waive" finds "forgive". Deliberately small and unambiguous. */
const CONCEPTS: Record<string, string> = (() => {
  const groups: Record<string, string> = {
    fee: 'fee fees penalty penalties surcharge',
    forgive: 'forgive forgiven forgave forgiving waive waived pardon pardoned absolve forget forgotten',
    wait: 'wait waiting later extension patience delay',
    plan: 'plan instalment instalments installment installments pieces piecemeal gradually',
    evict: 'evict evicted evicting eviction expel expelled oust ousted banish',
    mend: 'mend mended mending fix fixed fixing repair repaired repairs repairing restore restored',
    allow: 'allow allowed allowing permit permitted let',
    ban: 'ban banned forbid forbidden prohibit prohibited',
    return: 'return returned returning refund refunded',
    raise: 'raise raised raising increase increased rise rises risen hike',
    lower: 'lower lowered lowering reduce reduced cut decrease decreased discount',
    accept: 'accept accepted welcome approve approved',
    reject: 'reject rejected refuse refused decline declined deny denied',
    pay: 'pay pays paid paying payment',
    go: 'go goes gone going went',
    stay: 'stay stays stayed staying remain remains',
    keep: 'keep keeps kept keeping',
    leave: 'leave leaves leaving',
    reference: 'reference references enquire enquiries enquiry inquire inquiries screen vet',
    surety: 'surety deposit bond',
    animal: 'animal animals beast beasts creature creatures',
    pet: 'pet pets',
    coin: 'coin coins crown crowns gold money silver',
    all: 'all whole entire everything lot full',
    sign: 'sign signed signing signature',
    week: 'week weeks sennight',
    month: 'month months',
    charge: 'charge charged charging bill billed',
    give: 'give given gave giving grant granted',
    remove: 'remove removed removing rid',
    cheap: 'cheap cheaply cheaper',
    proper: 'proper properly',
    more: 'more higher extra above',
    less: 'less fewer',
    same: 'same unchanged',
    notice: 'notice notices',
    tear: 'tear torn tore',
    mercy: 'mercy merciful spare spared',
  };
  const out: Record<string, string> = {};
  for (const [k, list] of Object.entries(groups)) for (const w of list.split(' ')) out[w] = k;
  return out;
})();

/** How a ruler tends to phrase each standard option. Added to every outcome carrying that option tag. */
const OPTION_WORDS: Record<DecisionOption, string> = {
  wait: 'wait, more time, another week, later, extension, no fee, no penalty',
  late_fee: 'late fee, penalty, charge',
  payment_plan: 'payment plan, instalments, pieces, over months, spread',
  forgive: 'forgive, waive, pardon, debt, owe nothing, wipe clean',
  notice: 'notice, quit, court, eviction, proceedings',
  cash_for_keys: 'coin for keys, pay them to leave, buy out',
  evict: 'evict, out, bailiff, writ, enforce',
  mercy: 'mercy, spare, tear up, writ, stay, second chance',
  fix: 'mend, properly, proper, thorough',
  patch: 'patch, cheap, quick, straw',
  defer: 'wait, later, leave, defer, put off',
  bill_tenant: 'bill, charge, tenant, account',
  accept: 'welcome, accept, sign, approve',
  reject: 'reject, decline, turn away, not available',
  screen: 'references, check, screen, enquire, last landlord',
  counter: 'more, higher, rent, tenth',
  return_all: 'return, all, whole, give back, refund',
  fair: 'fair, damage, cost, part, deduct',
  keep_all: 'keep, all, lot, everything, forfeit',
  oust: 'out, remove, oust, evict, bailiff, throw, force',
  bribe: 'pay them to leave, bribe, coin, elsewhere',
  lease: 'lease, sign, tenants, legitimate, paying',
  ignore: 'ignore, leave be, nothing, alone',
  allow: 'allow, stay, permitted, no charge, no fee',
  pet_rent: 'pet rent, fee, surety, pays, charge',
  ban: 'ban, goes, gone, remove, no animals, no pets, forbid, away',
  hold: 'same, hold, unchanged, no change, another year, renew',
  raise: 'raise, increase, more, higher, goes up, put up',
  lower: 'lower, reduce, cut, less, discount, tenth off, bring down',
};

function stem(w: string): string {
  const c = CONCEPTS[w];
  if (c) return c;
  let x = w;
  if (x.length > 4 && x.endsWith('ies')) x = x.slice(0, -3) + 'y';
  else if (x.length > 5 && x.endsWith('ing')) x = x.slice(0, -3);
  else if (x.length > 4 && x.endsWith('ed')) x = x.slice(0, -2);
  else if (x.length > 4 && /(s|x|ch|sh)es$/.test(x)) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith('s') && !x.endsWith('ss')) x = x.slice(0, -1);
  return CONCEPTS[x] ?? x;
}

function normText(text: string): string {
  return text.toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Content tokens with a leading "!" when they sit under a negation ("no fee" -> "!fee"). */
function tokens(text: string): string[] {
  const out: string[] = [];
  const clauses = text.toLowerCase().replace(/[\u2018\u2019']/g, '').split(/[.,;:!?()"]+/);
  for (const clause of clauses) {
    let neg = 0;
    for (const w of clause.split(/[^a-z0-9]+/)) {
      if (!w) continue;
      if (CLAUSE_BREAK.has(w)) { neg = 0; continue; }
      if (NEGATORS.has(w)) { neg = 3; continue; }
      if (STOP.has(w) || /^\d+$/.test(w)) continue;
      const k = stem(w);
      if (STOP.has(k)) continue;
      out.push(neg > 0 ? '!' + k : k);
      if (neg > 0) neg--;
    }
  }
  return out;
}

const flip = (k: string): string => (k.startsWith('!') ? k.slice(1) : '!' + k);

/** Words that are themselves the act of ruling. One of these can carry a whole sentence; a noun ("the fee", "the pet") cannot. */
const DECISIVE = new Set(['forgive', 'wait', 'evict', 'mend', 'allow', 'ban', 'return', 'raise', 'lower', 'accept', 'reject', 'patch', 'ignore', 'sign', 'remove', 'defer', 'oust', 'bribe', 'stay']);

const HEDGE = /\b(maybe|perhaps|what if|suppose|supposing|i wonder|not sure|unsure|let me think|thinking (about|of|on)|think (about|on) it|considering|(i|we) (might|could|may)|possibly|tempted|whether|undecided|(cannot|can not|cant|have not|havent|not) decided?|torn between|in two minds)\b/;

/** One sentence shaped like a question, with or without its question mark (speech arrives unpunctuated). */
function asksOutright(sentence: string): boolean {
  const w = sentence.replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
  const SUBJ = /^(you|he|she|it|they|we|i|the|that|this|there|your|a|an)$/;
  if (/^(what|why|how|when|who|where|which|whose)$/.test(w[0] ?? '')) return true;
  return /^(would|could|should|can|will|is|are|do|does|did|has|have|might|may|shall)$/.test(w[0] ?? '') && SUBJ.test(w[1] ?? '');
}

/** Is this the ruler asking or wondering, rather than ruling? */
function soundsUnsettled(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\?\s*$/.test(t)) return true;
  if (HEDGE.test(t)) return true;
  if (/\b(already|yesterday|last (time|month|year|week|winter|summer|spring|autumn)|used to|once before)\b/.test(t)) return true;   // talk of the past, not a ruling
  if (/^(tell me|tell us|explain|describe|show me|go on|say more|speak up|carry on|continue|remind me|about|regarding|concerning|as for|as to|on the matter of|so this is about|now about)\b/.test(t)) return true;
  const sentences = t.split(/[.!?]+/).map(x => x.trim()).filter(Boolean);
  return sentences.length === 1 && asksOutright(t);
}

/**
 * Words a model may take for a ruling that the ruler did not mean as one: the
 * last thing said is a question or a maybe. Narrower than `soundsUnsettled`,
 * because here a model has already heard a ruling and we are only second-guessing it.
 */
export function doubtful(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const sentences = (t.match(/[^.!?]+[.!?]*/g) ?? [t]).map(x => x.trim()).filter(Boolean);
  const last = sentences[sentences.length - 1] ?? t;
  return /\?\s*$/.test(last) || HEDGE.test(last) || asksOutright(last);
}

/** "Aye." and its cousins: a plain yes to "Is that your ruling?". */
export function saysAye(text: string): boolean {
  const t = normText(text);
  const w = t.split(' ').filter(Boolean);
  if (!w.length || w.length > 8 || w.some(x => NEGATORS.has(x))) return false;
  return /^(aye|ay|yes|yea|yep|yeah|it is|that is (so|right|correct|it|my ruling|the ruling)|thats (so|right|correct|it|my ruling|the ruling)|so be it|indeed|correct|just so|quite so|exactly|certainly|agreed|i do|it stands|so ruled|so ordered|my ruling|a ruling|enter it|write it down|do it|make it so|let it be so)\b/.test(t);
}

export interface OfflineMatch {
  /** the ruling these words clearly amount to, or null */
  outcomeId: string | null;
  /** exact: a whisper or label, word for word ; clear: the words fit one ruling and no other ; none */
  how: 'exact' | 'clear' | 'none';
  /** when the words sit between two rulings, the two (best first) so the petitioner can ask which */
  between: [string, string] | null;
  scores: Record<string, number>;
}

/**
 * The offline ear. Matches the ruler's words against each outcome's label,
 * `say` line and intent. Built for precision: a wrong ruling cannot be taken
 * back, while a miss only costs a nudge toward the whispers.
 * `exact: false` skips the word-for-word stage (used to audit the fuzzy matcher).
 */
export function matchOutcomeOffline(def: IncidentDef, text: string, vars: Vars = {}, opts: { exact?: boolean } = {}): OfflineMatch {
  const scores: Record<string, number> = {};
  for (const o of def.outcomes) scores[o.id] = 0;
  const none: OfflineMatch = { outcomeId: null, how: 'none', between: null, scores };
  const T = normText(text);
  if (!T) return none;

  // 1. word for word: the whisper or the label on its own; the whisper inside a longer speech;
  //    the label inside a sentence that is not a question, a doubt or a denial
  if (opts.exact !== false) {
    const exact = (id: string): OfflineMatch => { scores[id] = 99; return { outcomeId: id, how: 'exact', between: null, scores }; };
    const keys = def.outcomes.map(o => ({ id: o.id, say: normText(fill(o.say, vars)), label: normText(fill(o.label, vars)) }));
    // the whole of what was said is one whisper (or one label): nothing else need be weighed
    const whole = keys.filter(k => (k.say && T === k.say) || (k.label && T === k.label));
    if (whole.length === 1) return exact(whole[0]!.id);
    const padded = ' ' + T + ' ';
    const settled = !soundsUnsettled(text);
    const within = (key: string): boolean => {
      if (key.split(' ').length < 3) return false;
      const at = padded.indexOf(' ' + key + ' ');
      if (at < 0) return false;
      return !padded.slice(0, at).trim().split(' ').slice(-2).some(w => NEGATORS.has(w));
    };
    // found inside a longer speech. Where one whisper contains another ("Mend it properly." inside
    // "Mend it properly and bill them."), the longer is the one that was said.
    const hits: { id: string; key: string }[] = [];
    for (const k of keys) {
      const found = [k.say && within(k.say) ? k.say : '', k.label && settled && within(k.label) ? k.label : ''].sort((a, b) => b.length - a.length)[0]!;
      if (found) hits.push({ id: k.id, key: found });
    }
    hits.sort((a, b) => b.key.length - a.key.length);
    const top = hits[0];
    if (top && hits.slice(1).every(h => h.key.length < top.key.length && (' ' + top.key + ' ').includes(' ' + h.key + ' '))) return exact(top.id);
  }

  // 2. by the weight of the words
  if (soundsUnsettled(text)) return none;
  const query = [...new Set(tokens(text))];
  if (!query.length) return none;

  // `w`: every word that points at this ruling. `key`: the words that NAME it (label, the usual
  // phrasings of its option, the intent), as opposed to the colour in its whisper.
  const docs = def.outcomes.map(o => {
    const w = new Map<string, number>(), key = new Map<string, number>();
    const usual = new Set(o.option && OPTION_WORDS[o.option] ? tokens(OPTION_WORDS[o.option]) : []);
    const add = (src: string, weight: number, naming: boolean) => {
      for (const k of tokens(src)) {
        if ((w.get(k) ?? 0) < weight) w.set(k, weight);
        if (naming && (key.get(k) ?? 0) < weight) key.set(k, weight);
      }
    };
    add(fill(o.label, vars), 1.3, true);
    add(fill(o.say, vars), 1.0, false);
    if (o.option && OPTION_WORDS[o.option]) add(OPTION_WORDS[o.option], 1.0, true);
    add(fill(o.intent, vars), 0.6, true);
    return { o, w, key, usual };
  });
  const N = docs.length;
  const df = new Map<string, number>();
  for (const d of docs) for (const k of d.w.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  // a word only one ruling uses counts in full; a word they all use counts for almost nothing
  const rarity = (k: string): number => { const n = df.get(k) ?? 0; return n <= 1 ? 1 : n >= N ? 0.12 : 1 - 0.75 * (n - 1) / (N - 1); };

  const ranked = docs.map(d => {
    let score = 0, matched = 0, named = 0, decisive = false, strong = false;
    for (const k of query) {
      const own = d.w.get(k);
      if (own !== undefined) {
        score += own * rarity(k); matched++;
        const naming = (d.key.get(k) ?? 0) * rarity(k);
        // `strong`: the word comes from the label itself and belongs to this ruling alone (or nearly)
        //           ("A week."), or is a plain refusal in the usual words ("No pets.")
        if (naming >= 0.5) {
          named++;
          if (naming >= 1.05 || (naming >= 1 && k.startsWith('!'))) strong = true;
          if (d.usual.has(k) && DECISIVE.has(k)) decisive = true;
        }
        continue;
      }
      // "no fee" counts against the ruling that is about a fee (but a whisper's own "not" proves nothing)
      const against = k.startsWith('!') ? d.w.get(flip(k)) : undefined;
      if (against !== undefined) score -= 0.9 * against * rarity(flip(k));
    }
    scores[d.o.id] = Math.round(score * 100) / 100;
    return { id: d.o.id, score, matched, named, decisive, strong, cover: matched / query.length };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0]!, next = ranked[1];
  const lead = top.score - (next ? Math.max(0, next.score) : 0);
  // The words must name the ruling, not merely echo the colour of its whisper ("It is honest wear."
  // rules nothing). A single naming word is a ruling only when nearly everything said points the
  // same way, and it either comes with more of the whisper ("I am keeping every crown."), is said
  // shortly ("Evict them.", "A week."), or is itself the act ("I will waive it this once.").
  // "So this is about the pet." and "You always pay late." rule nothing.
  const brief = T.split(' ').length <= 4 && top.strong;
  const enough = top.named >= 2 ? top.cover >= 0.5
    : top.named === 1 && top.cover >= 0.75 && (top.matched >= 2 || brief || top.decisive);
  if (top.score >= 1 && enough && lead >= Math.max(0.5, 0.35 * top.score)) {
    return { outcomeId: top.id, how: 'clear', between: null, scores };
  }
  if (next && top.named >= 1 && top.score >= 0.8 && next.score >= 0.6 * top.score && next.cover >= top.cover - 0.01) {
    return { outcomeId: null, how: 'none', between: [top.id, next.id], scores };
  }
  return none;
}

/**
 * One of the Steward's whispers (or its label) said as written, alone or inside
 * a longer speech that is not a question or a doubt. Such words ARE that
 * ruling, whatever a model makes of them: the whispers are the one road that
 * must always arrive.
 */
export function whisperSpoken(def: IncidentDef, text: string, vars: Vars = {}): string | null {
  const m = matchOutcomeOffline(def, text, vars);
  const o = m.how === 'exact' ? def.outcomes.find(x => x.id === m.outcomeId) : undefined;
  if (!o) return null;
  const T = normText(text);
  const whole = T === normText(fill(o.say, vars)) || T === normText(fill(o.label, vars));
  return whole || !soundsUnsettled(text) ? o.id : null;
}

// ───────────────────────────── numbers and promises in plain speech ─────────────────────────────

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, dozen: 12, score: 20,
};

/** Every number the speaker actually said, as digits or words ("twenty five", "two hundred"). */
export function numbersIn(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(/\d[\d,]*/g)) { const n = Number(m[0].replace(/,/g, '')); if (Number.isFinite(n)) out.add(n); }
  const ws = text.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  let cur = 0, open = false;
  const close = () => { if (open) out.add(cur); cur = 0; open = false; };
  for (const w of ws) {
    const n = NUM_WORDS[w];
    if (n !== undefined) {
      if (open && cur % 10 === 0 && cur >= 20 && cur < 100 && n < 10) cur += n;
      else if (open && cur >= 100 && n < 100) cur += n;
      else { close(); cur = n; }
      open = true;
    } else if (w === 'hundred') { cur = (open && cur > 0 ? cur : 1) * 100; open = true; }
    else if (w === 'thousand') { cur = (open && cur > 0 ? cur : 1) * 1000; open = true; }
    else if (w === 'and' && open && cur >= 100) { /* "two hundred and five" */ }
    else close();
  }
  close();
  return [...out];
}

const SEASON_START: Record<string, number> = { spring: 0, summer: 3, autumn: 6, harvest: 6, winter: 9, frost: 9, snow: 9, snows: 9 };

/** How long a spoken promise runs, in months, if the words say. */
export function monthsIn(text: string, day: number): number | null {
  const t = text.toLowerCase();
  const num = (w: string): number | null => (/^\d+$/.test(w) ? Number(w) : w === 'a' || w === 'an' ? 1 : NUM_WORDS[w] ?? null);
  let m = /\b(\d+|[a-z]+)\s+(?:whole\s+|full\s+)?years?\b/.exec(t);
  if (m) { const n = num(m[1]!); if (n) return n * 12; if (/\b(this|the|next|coming)$/.test(m[1]!)) return 12; }
  if (/\b(twelvemonth|this year|all year)\b/.test(t)) return 12;
  m = /\b(\d+|[a-z]+)\s+(?:whole\s+|full\s+)?(?:months?|moons?)\b/.exec(t);
  if (m) { const n = num(m[1]!); if (n) return n; if (/\b(this|the|next|coming)$/.test(m[1]!)) return 1; }
  m = /\b(?:by|before|until|till|through|come)\s+(?:the\s+)?(?:first\s+|next\s+)?(spring|summer|autumn|harvest|winter|frost|snows?)\b/.exec(t);
  if (m) {
    const now = dateOf(day).month;
    const gap = (SEASON_START[m[1]!]! - now + 12) % 12;
    return gap === 0 ? 12 : gap;
  }
  if (/\b(weeks?|fortnight|sennight|tomorrow|sundown|rent day|days?)\b/.test(t)) return 1;
  return null;
}

interface OathDraft { kind: OathKind; text: string; months: number; amount: number | null }

/** Near misses a model may write for an oath kind. Anything else that is not a real kind is dropped. */
const OATH_ALIASES: Record<string, OathKind> = {
  repairs: 'repair', fix: 'repair', mend: 'repair', no_rent_increase: 'no_rent_raise', no_rent_rise: 'no_rent_raise', no_raise: 'no_rent_raise',
  rent_freeze: 'no_rent_raise', no_eviction: 'no_evict', no_evicts: 'no_evict', payment: 'pay', building: 'build', rent_ceiling: 'rent_cap',
  promise: 'word', pledge: 'word', other: 'word', general: 'word',
};
const DEFAULT_MONTHS: Record<OathKind, number> = { repair: 3, build: 3, pay: 3, no_rent_raise: 12, no_evict: 12, rent_cap: 12, word: 12 };
const PLEDGE = /\b(i (?:do )?(?:promise|swear|vow|pledge)|you have my (?:word|oath)|i give (?:you )?my (?:word|oath)|on my (?:word|oath|honou?r)|my word (?:on it|upon it)|upon my (?:word|oath|honou?r))\b/i;

/** Offline: a promise only counts when the ruler says outright that it is one. */
export function oathsInSpeech(text: string, day: number): OathDraft[] {
  if (!PLEDGE.test(text)) return [];
  const sentences = text.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  const out: OathDraft[] = [];
  for (let i = 0; i < sentences.length && out.length < MAX_OATHS_PER_TURN; i++) {
    const sen = sentences[i]!;
    if (!PLEDGE.test(sen)) continue;
    // "You have my word." on its own points at the sentence before it (or after)
    const bare = sen.replace(PLEDGE, '').replace(/[^a-z]+/gi, ' ').trim().split(/\s+/).filter(w => w && !STOP.has(w.toLowerCase())).length < 2;
    const body = bare ? (sentences[i - 1] ?? sentences[i + 1] ?? sen) : sen;
    const b = body.toLowerCase();
    let kind: OathKind = 'word';
    let amount: number | null = null;
    if (/\b(mend|fix|repair|rethatch|thatch|patch)\w*\b/.test(b) || /\b(roof|chimney|wall|door|well|leak)\b.*\b(put right|seen to|sound|straight|whole|dry)\b/.test(b)) kind = 'repair';
    else if (/\b(evict|put (?:you |them )?out|turn (?:you |them )?out|notice to quit|serve notice|keep your (?:home|roof|house))\w*\b/.test(b) && /\b(no|not|never|wont|won't|keep)\b/.test(b)) kind = 'no_evict';
    else if (/\brent\b/.test(b) && /\b(not|never|no|wont|won't|stays?|holds?|same|fixed|frozen)\b/.test(b) && !/\b(pay|paid)\b/.test(b)) {
      const cap = /\b(above|over|more than|past|beyond|under|at most|exceed)\b/.test(b) ? numbersIn(body).find(n => n > 0) : undefined;
      if (cap) { kind = 'rent_cap'; amount = cap; } else kind = 'no_rent_raise';
    } else if (/\bbuild\b/.test(b) && buildingTypeIn(b)) kind = 'build';
    else if (/\b(pay|give|send|owe)\b/.test(b) && /\b(crowns?|coins?)\b/.test(b)) {
      const n = /(\d[\d,]*|[a-z]+(?:[\s-][a-z]+)?)\s+(?:crowns?|coins?)\b/.exec(b);
      const val = n ? numbersIn(n[1]!)[0] : undefined;
      if (val && val > 0) { kind = 'pay'; amount = val; }
    }
    const clean = cleanSpoken(body, { max: 140, loud: true });
    if (!clean) continue;
    out.push({ kind, text: clean, months: monthsIn(body, day) ?? DEFAULT_MONTHS[kind], amount });
  }
  return out;
}

/** A building type named in a promise ("I will build you a well"). Longest name wins. */
function buildingTypeIn(text: string): BuildingType | null {
  const t = ' ' + normText(text) + ' ';
  let best: BuildingType | null = null, bestLen = 0;
  for (const def of Object.values(BUILDINGS)) {
    for (const name of [def.name, def.plural, def.id.replace(/_/g, ' ')]) {
      const k = normText(name);
      if (k && k.length > bestLen && t.includes(' ' + k + ' ')) { best = def.id; bestLen = k.length; }
    }
  }
  return best;
}

// ───────────────────────────── lines for when no model is listening ─────────────────────────────

/**
 * `{whisperer}` is whoever keeps the notes in the ruler's margin: "your Steward" once one is
 * hired, "your clerk" before that (`{Whisperer}` at the head of a sentence).
 */
const NUDGES: Record<Species | 'npc' | 'staff', string[]> = {
  human: [
    'I did not follow that, {title}. {Whisperer} is mouthing something at you. Perhaps try it that way.',
    'That went past me, {title}. Say it plain. {Whisperer} has a few plain things written down.',
    'I am sure that was wise, {title}. I only need to know which thing happens to me. {Whisperer} seems to.',
  ],
  halfling: [
    'I could not make a meal of that, {title}. {Whisperer} has it written smaller and plainer, I think.',
    'Begging your pardon, {title}, that was a great many words and no gravy. {Whisperer} has a short version.',
  ],
  dwarf: [
    'That is not a term I can hold you to, {title}. State it as {whisperer} has it written, and I will.',
    'Vague, {title}. My grandfather would not have signed it. {Whisperer} has the wording.',
  ],
  goblin: [
    'That wording is not on any form! {Whisperer} has the approved phrases. Please use an approved phrase!',
    'We cannot minute that, {title}! {Whisperer} is holding the correct wordings. There are several!',
  ],
  elf: [
    'I have waited ninety years for clearer answers than that, {title}. {Whisperer} appears to have one ready.',
    'How interesting, {title}. And which of the things {whisperer} has written did that mean?',
  ],
  ogre: [
    'Sorry, {title}. I did not catch that, and I did not like to lean closer, on account of the ceiling. Has {whisperer} written it down?',
    'Sorry. Sorry, {title}. Could you say it the way your small friend with the quill has it?',
  ],
  npc: [
    'I shall need that put plainly, {title}. {Whisperer} seems to have the wording to hand.',
    'Noted, {title}, in the sense that I heard a noise. {Whisperer} has the usual phrases, if you would.',
  ],
  staff: [
    'I would rather not guess at that, {title}. The note in the margin there has it plainer.',
    'Could be taken three ways, that, {title}. Best say it the way the margin has it.',
  ],
};
const ASKED_OFFLINE = [
  'A fair question, {title}, and I have said my piece. What I need now is your ruling. {Whisperer} has some wordings ready.',
  'You have heard all I know, {title}. It only wants deciding. {Whisperer} is pointing at something.',
];
/** A model was listening but this one answer was lost: ask for it again before pointing at the whispers. */
const SAY_AGAIN = [
  'Forgive me, {title}. A cart went by and I lost the end of that. Once more?',
  'My ears are not what they were, {title}. Say it again, or say it the way {whisperer} has it written.',
];
/** A ruling was heard but not surely meant: ask before it is entered. `{ruling}` is the Steward's label for it. */
const IS_THAT_YOUR_RULING = 'Is that your ruling, {title}? The clerk would enter it as "{ruling}". Say aye and it is done.';
const IS_THAT_YOUR_RULING_GOBLIN = 'Is that a RULING, {title}? The form would say "{ruling}". Say aye and we stamp it!';
/** Words a ruler binds themselves with. A promise a model reports must rest on at least one of them. */
const COMMITS = /\b(will|shall|wont|ill|promise[ds]?|swear|sworn|vow|pledge|word|oath|honou?r|never|always|guarantee[ds]?|going to|stays?|remains?|fixed|frozen|holds?|count on|depend on|rely on|consider it|until|from now|no more|not rise|not raise|not go up|not move)\b/;
const CAP_LINE = 'The court has sat long enough on this, {title}. Give your ruling now. Any of the notes in the margin will do.';
const CAP_AGAIN = 'A ruling, {title}. One of the notes in the margin, as written, if you please.';
const PAST_CAP_REPLY = 'I have said all I have to say, {title}. I will take your ruling now, whatever it is.';
const SETTLED_ELSEWHERE = 'It seems the matter has been settled without us, {title}. I will see myself out.';
const NOT_A_RULING = 'That is not a thing that can be done here, {title}. {Whisperer} has the list of what can.';

// ───────────────────────────── the session ─────────────────────────────

/**
 * The exact request a session sends for the ruler's next words: `lines` is
 * the transcript before them, `turn` counts the ruler's turns from 1.
 * Shared by the session and by tools/audience-harness.ts. Null if the
 * incident or its definition is missing.
 */
export function audienceRequest(s: GameState, incidentId: Id, lines: AudienceLine[], rulerText: string, turn: number): ModelRequest | null {
  const inc = s.incidents[incidentId];
  const def = inc ? INCIDENT_BY_ID[inc.defId] : undefined;
  if (!inc || !def) return null;
  const cast = resolveCast(s, inc, def);
  const address = RANKS[s.realm.rank]?.address ?? 'my lord';
  const vars = audienceVars(s, inc, cast);
  return buildAudiencePrompt({
    state: s, incident: inc, def, cast, vars: { ...vars, title: address },
    lines, rulerText, turn, maxTurns: MAX_RULER_TURNS, ruling: whisperSpoken(def, rulerText, vars),
  });
}

/** The outcome a model named, however it spelled it: the id, the option tag, the label, the whisper, or the id inside a few stray words. */
function matchOutcomeId(def: IncidentDef, raw: string | null, vars: Vars = {}): OutcomeDef | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '');
  if (!k) return null;
  const byId = def.outcomes.find(o => o.id.toLowerCase() === k);
  if (byId) return byId;
  const one = (list: OutcomeDef[]): OutcomeDef | null => (list.length === 1 ? list[0]! : null);
  const key = (t: string): string => normText(t).replace(/ /g, '_');
  const named = one(def.outcomes.filter(o => o.option === k))
    ?? one(def.outcomes.filter(o => key(fill(o.label, vars)) === k))
    ?? one(def.outcomes.filter(o => key(fill(o.say, vars)) === k));
  if (named) return named;
  // "id_pet_rent", "ruling_pet_rent": the id sits whole inside what was written. The longest such id wins.
  const inside = def.outcomes.filter(o => `_${k}_`.includes(`_${o.id.toLowerCase()}_`)).sort((a, b) => b.id.length - a.id.length);
  const best = inside[0];
  // two different rulings named at once ("pet_rent_or_ban") is no ruling; "keep" inside "keep_all" is only an echo
  if (!best || inside.slice(1).some(o => !`_${best.id.toLowerCase()}_`.includes(`_${o.id.toLowerCase()}_`))) return null;
  // "do_not_allow" is not "allow"
  const around = `_${k}_`.replace(`_${best.id.toLowerCase()}_`, '_');
  return /_(no|not|dont|never|non|without|cannot|cant|wont|refuse|deny|against|instead)_/.test(around) ? null : best;
}

function tidyRuler(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
}

export function openAudienceSession(incidentId: Id, deps: WordDeps, model: () => ModelClient, onChange: () => void): AudienceSession | null {
  const s0 = deps.getState();
  const inc0 = s0.incidents[incidentId];
  if (!inc0 || inc0.state !== 'open') return null;
  const def = INCIDENT_BY_ID[inc0.defId];
  if (!def || !def.outcomes.length) return null;

  const cast0 = resolveCast(s0, inc0, def);
  const vars = audienceVars(s0, inc0, cast0);
  const address = RANKS[s0.realm.rank]?.address ?? String(vars.title ?? 'my lord');
  /** who keeps the notes in the margin: the Steward once there is one, a clerk until then */
  const whisperer = (): string => (Object.values(deps.getState().staff).some(m => m.role === 'steward') ? 'your Steward' : 'your clerk');
  const spoken = (template: string): string => {
    const w = whisperer();
    return fillSpoken(template, { ...vars, whisperer: w, Whisperer: w.charAt(0).toUpperCase() + w.slice(1) }, address);
  };
  const plain = (template: string): string => fill(template, vars);
  const speaker = cast0.speaker;
  const loud = mayShout(speaker);
  /** the household whose traits and memories are in play: the speaker's own */
  const householdId: Id | null = cast0.applicant?.household.id ?? cast0.tenant?.id ?? null;

  const openings = def.opening?.length ? def.opening : [def.herald];
  const opening = spoken(openings[hashStr(inc0.id) % openings.length]!);

  let rulerTurns = 0;
  let waiting = 0;                              // say() calls not yet answered
  let lostAnswers = 0;                          // model answers lost in a row
  let nudges = 0;
  let generation = 0;
  let closed = false;
  let abort: AbortController | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let lastResult: string | null = null;
  /** "Is that your ruling?" hangs in the air: the outcome asked about, and the parting word a model already gave for it */
  let hanging: { id: string; reply: string; mood: Mood | null; via: 'model' | 'offline' } | null = null;
  const sworn: Oath[] = [];
  const swornKeys = new Set<string>();
  const waitingOaths: OathDraft[] = [];        // promised to an applicant who has not signed yet
  const revealedHere = new Set<TraitId>();
  const waitingReveals: TraitId[] = [];

  const notify = (): void => { try { onChange(); } catch (e) { console.error('[word] audience listener failed', e); } };

  const session: AudienceSession = {
    incidentId,
    title: plain(def.title),
    speaker,
    lines: [{ who: 'petitioner', text: opening }],
    whispers: def.outcomes.map(o => ({ outcomeId: o.id, label: plain(o.label), say: plain(o.say) })),
    busy: false,
    done: false,
    outcomeId: null,
    say, choose, leave,
  };

  const push = (who: AudienceLine['who'], text: string): void => { session.lines.push({ who, text }); };
  const turnOf = (p: Partial<AudienceTurn> & { reply: string }): AudienceTurn => ({
    mood: speaker.mood, outcomeId: null, done: false, resultText: null, oaths: [], revealed: [], via: 'offline', ...p,
  });
  const quiet = (): AudienceTurn => turnOf({ reply: '', outcomeId: session.outcomeId, done: session.done, resultText: lastResult });

  /** The household's live record, if they are (now) one of the ruler's tenants. */
  const housedSpeaker = (s: GameState): Tenant | null => {
    const t = householdId ? s.tenants[householdId] : undefined;
    return t && t.status === 'housed' ? t : null;
  };

  // ── the incident may be settled behind our backs (its timer, a standing order, a delegate)
  function settledElsewhere(): AudienceTurn | null {
    const inc = deps.getState().incidents[incidentId];
    if (inc && inc.state === 'open') return null;
    const o = inc?.outcomeId ? def.outcomes.find(x => x.id === inc.outcomeId) : undefined;
    lastResult = o ? plain(o.result) : inc?.state === 'expired' && def.expireText ? plain(def.expireText) : null;
    session.done = true;
    session.outcomeId = o?.id ?? null;
    const reply = spoken(SETTLED_ELSEWHERE);
    push('petitioner', reply);
    return turnOf({ reply, outcomeId: session.outcomeId, done: true, resultText: lastResult, oaths: sworn.slice() });
  }

  // ── oaths
  /**
   * Promises as a model reported them. Kept only when the kind is real, the ruler's own words
   * carry a commitment, and the promise shares its matter with what the ruler said: a model
   * may not put an oath in the ruler's mouth.
   */
  function readOaths(raw: unknown[], rulerText: string): OathDraft[] {
    if (!raw.length || !COMMITS.test(normText(rulerText))) return [];
    const said = numbersIn(rulerText);
    const bare = (k: string): string => (k.startsWith('!') ? k.slice(1) : k);
    const spokenOf = new Set(tokens(rulerText).map(bare));
    const out: OathDraft[] = [];
    for (const item of raw) {
      if (out.length >= MAX_OATHS_PER_TURN) break;
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const named = typeof r.kind === 'string' ? r.kind.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
      const kind = (OATH_ALIASES[named] ?? named) as OathKind;
      if (!OATH_KINDS.includes(kind)) continue;                                // an invented kind is no oath at all
      const text = cleanSpoken(r.text ?? r.promise, { max: 140, loud: true });
      if (!text) continue;
      const matter = [...new Set(tokens(text).map(bare))];
      const shared = matter.filter(k => spokenOf.has(k)).length;
      if (matter.length && (shared === 0 || shared * 3 < matter.length)) continue;   // not something the ruler said
      const m = typeof r.months === 'number' ? r.months : typeof r.months === 'string' ? Number(r.months) : NaN;
      const months = Number.isFinite(m) && m > 0 ? Math.min(120, Math.max(1, Math.round(m))) : DEFAULT_MONTHS[kind];
      const a = typeof r.amount === 'number' ? r.amount : typeof r.amount === 'string' ? Number(r.amount) : NaN;
      // a figure counts only if the ruler actually spoke it
      const amount = Number.isFinite(a) && a > 0 && said.includes(Math.round(a)) ? Math.round(a) : null;
      out.push({ kind, text, months, amount });
    }
    return out;
  }

  /** Bind a promise to whoever it was made to and enter it in the ledger. Null if it cannot stand. */
  function swear(d: OathDraft): Oath | null {
    if (sworn.length >= MAX_OATHS_PER_SESSION) return null;
    const s = deps.getState();
    const inc = s.incidents[incidentId];
    const own = housedSpeaker(s);
    const subject = inc?.tenantId ? s.tenants[inc.tenantId] : undefined;
    const to = own ?? (speaker.kind === 'tenant' || speaker.kind === 'applicant' ? null : subject && subject.status === 'housed' ? subject : null);
    let kind = d.kind;
    let amount = d.amount;
    let buildingId: Id | null = null;
    let buildingType: BuildingType | null = null;
    if (kind === 'rent_cap' && amount === null) kind = 'no_rent_raise';
    if (kind === 'pay' && amount === null) kind = 'word';
    if ((kind === 'no_rent_raise' || kind === 'no_evict' || kind === 'rent_cap' || kind === 'pay') && !to) kind = 'word';
    if (kind === 'repair') {
      buildingId = to?.buildingId ?? inc?.buildingId ?? null;
      if (!buildingId || !s.buildings[buildingId]) { buildingId = null; kind = 'word'; }
    }
    if (kind === 'build') {
      buildingType = buildingTypeIn(d.text);
      if (!buildingType) kind = 'word';
    }
    if (kind !== 'pay' && kind !== 'rent_cap') amount = null;
    const key = `${kind}|${to?.id ?? ''}|${buildingId ?? ''}|${buildingType ?? ''}|${kind === 'word' ? normText(d.text) : ''}`;
    if (swornKeys.has(key)) return null;
    const spec: Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'> = {
      kind, text: d.text, toTenantId: to?.id ?? null, toName: to?.name ?? speaker.name,
      buildingId, buildingType, amount, dueDay: s.day + d.months * DAYS_PER_MONTH,
    };
    const res = deps.dispatch({ type: 'swear_oath', oath: spec });
    if (!res.ok) return null;
    swornKeys.add(key);
    const after = deps.getState();
    const made = (res.id ? after.oaths.find(o => o.id === res.id) : undefined)
      ?? [...after.oaths].reverse().find(o => o.kind === spec.kind && o.text === spec.text && o.state === 'open')
      ?? { ...spec, id: res.id ?? `oath-${incidentId}-${sworn.length + 1}`, madeDay: after.day, state: 'open' as const, settledDay: null };
    sworn.push(made);
    return made;
  }

  function swearAll(drafts: OathDraft[]): Oath[] {
    const out: Oath[] = [];
    const s = deps.getState();
    for (const d of drafts) {
      // an applicant is nobody's tenant until they sign: hold the promise until then
      if (speaker.kind === 'applicant' && !housedSpeaker(s)) { if (waitingOaths.length < MAX_OATHS_PER_SESSION) waitingOaths.push(d); continue; }
      const o = swear(d);
      if (o) out.push(o);
    }
    return out;
  }

  // ── traits drawn out in conversation
  function reveal(ids: string[]): TraitId[] {
    if (!householdId || !ids.length) return [];
    const s = deps.getState();
    const h = cast0.applicant ? (s.applicants[cast0.applicant.id]?.household ?? s.tenants[householdId] ?? cast0.applicant.household) : s.tenants[householdId];
    if (!h) return [];
    const out: TraitId[] = [];
    for (const raw of ids) {
      if (out.length >= 1) break;                          // one thing comes out at a time; a model that lists them all is not believed
      const id = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_') as TraitId;
      if (!h.traits.includes(id) || h.revealed.includes(id) || revealedHere.has(id)) continue;   // only what is truly hidden
      revealedHere.add(id);
      out.push(id);
      const res = deps.dispatch({ type: 'reveal_trait', tenantId: householdId, trait: id });
      if (!res.ok && speaker.kind === 'applicant') waitingReveals.push(id);
    }
    return out;
  }

  // ── a ruling
  function rule(o: OutcomeDef, p: { via: 'model' | 'offline'; reply: string; mood: Mood | null; drafts: OathDraft[]; revealed: TraitId[]; byWhisper: boolean }): AudienceTurn {
    const res = deps.dispatch({ type: 'resolve_incident', incidentId, outcomeId: o.id });
    if (!res.ok) {
      // the sim will not have it: say so, stay open
      const reason = cleanSpoken(res.reason, { max: 110, loud: true }) || 'It cannot be done.';
      let reply = spoken(`That cannot be done, {title}. I am told: "${reason}" What is it to be instead?`);
      if (reply.length > REPLY_CAP) reply = spoken(`That cannot be done, {title}. "${reason}"`).slice(0, REPLY_CAP);
      speaker.mood = 'worried';
      push('petitioner', reply);
      return turnOf({ reply, mood: 'worried', oaths: swearAll(p.drafts), revealed: p.revealed, via: p.via });
    }
    session.done = true;
    session.outcomeId = o.id;
    const mood = p.mood ?? moodForOutcome(o);
    speaker.mood = mood;
    const reply = p.reply || spoken(o.reply);
    push('petitioner', reply);
    lastResult = plain(o.result);

    const after = deps.getState();
    const nowHoused = housedSpeaker(after);
    if (speaker.kind === 'applicant') {
      if (nowHoused) { for (const d of waitingOaths.splice(0)) swear(d); }
      else waitingOaths.length = 0;                      // they did not sign: nothing is owed
      if (nowHoused) for (const id of waitingReveals.splice(0)) deps.dispatch({ type: 'reveal_trait', tenantId: nowHoused.id, trait: id });
    }
    for (const d of p.drafts) {
      if (speaker.kind === 'applicant' && !nowHoused) continue;
      swear(d);
    }
    const rememberer = nowHoused ?? (householdId && after.tenants[householdId] ? after.tenants[householdId]! : null);
    if (rememberer) {
      const mem = memoryOf(def, o, vars, rulerTurns, p.byWhisper, mood);
      deps.dispatch({ type: 'remember', tenantId: rememberer.id, text: mem.text, valence: mem.valence });
    }
    return turnOf({ reply, mood, outcomeId: o.id, done: true, resultText: lastResult, oaths: sworn.slice(), revealed: p.revealed, via: p.via });
  }

  // ── "Is that your ruling?"
  /**
   * A ruling was heard, but not surely meant. Nothing is applied: the petitioner asks, and an
   * "aye" (or the same ruling said again) on the next turn settles it. `reply` and `mood` keep
   * the parting word a model already gave, for when the aye comes.
   */
  function askRuling(o: OutcomeDef, p: { reply: string; mood: Mood | null; via: 'model' | 'offline'; drafts: OathDraft[] }): AudienceTurn {
    hanging = { id: o.id, reply: p.reply, mood: p.mood, via: p.via };
    const label = plain(o.label).replace(/[.!?]+$/, '');
    const goblin = speaker.species === 'goblin' || speaker.npc === 'goblin_chief';
    const reply = fillSpoken(goblin ? IS_THAT_YOUR_RULING_GOBLIN : IS_THAT_YOUR_RULING, { ...vars, ruling: label }, address);
    const oaths = swearAll(p.drafts);
    push('petitioner', reply);
    if (rulerTurns === MAX_RULER_TURNS) push('steward', spoken(CAP_LINE));
    return turnOf({ reply, oaths });                      // the question is the court's own line, whoever heard the ruling
  }

  // ── answering without a model
  /**
   * `lostAnswer`: a model is at court but this one answer was lost or could not be trusted. The ruler
   * is then talking freely, so only a whisper said as written rules outright. Words that merely sound
   * like a ruling are asked about ("Is that your ruling?"); anything else is asked for again.
   */
  function offlineTurn(text: string, lostAnswer: boolean, m: OfflineMatch): AudienceTurn {
    const drafts = oathsInSpeech(text, deps.getState().day);
    const o = m.outcomeId ? def.outcomes.find(x => x.id === m.outcomeId) : undefined;
    if (o && (!lostAnswer || whisperSpoken(def, text, vars) === o.id)) return rule(o, { via: 'offline', reply: '', mood: null, drafts, revealed: [], byWhisper: false });
    if (o && rulerTurns <= MAX_RULER_TURNS) return askRuling(o, { reply: '', mood: null, via: 'offline', drafts });

    const oaths = swearAll(drafts);
    let reply: string;
    if (rulerTurns > MAX_RULER_TURNS) {
      reply = spoken(PAST_CAP_REPLY);
      push('petitioner', reply);
      push('steward', spoken(CAP_AGAIN));
      return turnOf({ reply, oaths });
    }
    if (lostAnswer && lostAnswers <= SAY_AGAIN.length) {
      reply = spoken(SAY_AGAIN[(Math.max(1, lostAnswers) - 1) % SAY_AGAIN.length]!);
    } else if (m.between && !lostAnswer) {
      const [a, b] = m.between.map(id => plain(def.outcomes.find(x => x.id === id)!.label)) as [string, string];
      reply = spoken(`Do you mean "${a}" or "${b}", {title}? I would sooner know which before I walk home.`);
      if (reply.length > REPLY_CAP) reply = spoken(`"${a}" or "${b}", {title}? I would sooner know which.`);
    } else if (soundsUnsettled(text)) {
      reply = spoken(ASKED_OFFLINE[nudges % ASKED_OFFLINE.length]!);
    } else {
      const set = speaker.species === 'goblin' || speaker.npc === 'goblin_chief' ? NUDGES.goblin
        : speaker.kind === 'staff' ? NUDGES.staff
        : speaker.kind === 'npc' || speaker.kind === 'herald' ? NUDGES.npc
        : NUDGES[speaker.species] ?? NUDGES.human;
      reply = spoken(set[nudges % set.length]!);
    }
    nudges++;
    push('petitioner', reply);
    if (rulerTurns === MAX_RULER_TURNS) push('steward', spoken(CAP_LINE));
    return turnOf({ reply, oaths });
  }

  // ── answering with one
  async function ask(c: ModelClient, text: string): Promise<string> {
    const req = audienceRequest(deps.getState(), incidentId, session.lines.slice(0, -1), text, rulerTurns);
    if (!req) throw new Error('audience: the incident is gone');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abort = ctl;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        c.complete(req, ctl?.signal),
        new Promise<string>((_, reject) => { timer = setTimeout(() => { ctl?.abort(); reject(new Error('audience: the model took too long')); }, MODEL_TIMEOUT_MS); }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (abort === ctl) abort = null;
    }
  }

  function client(): ModelClient | null {
    try { const c = model(); return c && c.kind !== 'none' ? c : null; } catch { return null; }
  }
  const hasModel = (): boolean => client() !== null;

  /**
   * Null means: nothing trustworthy came back, answer this turn offline.
   * `ear` is what the offline matcher makes of the same words; `whisper` is set when they are
   * one of the Steward's whispers as written, which rules whatever the model says.
   */
  async function modelTurn(text: string, gen: number, ear: OfflineMatch, whisper: OutcomeDef | null): Promise<AudienceTurn | null> {
    const c = client();
    if (!c) return null;
    let raw: string;
    try { raw = await ask(c, text); } catch { return null; }               // transport trouble: never a dead end
    if (gen !== generation) return null;
    const parsed = parseAudienceReply(raw);
    if (!parsed) return null;
    const gone = settledElsewhere();
    if (gone) return gone;

    const named = parsed.salvaged ? null : matchOutcomeId(def, parsed.outcome, vars);
    const invented = !parsed.salvaged && !!parsed.outcome && !named;
    // an answer cut off mid-sentence keeps only what was finished
    const reply = cleanSpoken(parsed.salvaged ? finishedSentences(parsed.reply) : parsed.reply, { max: REPLY_CAP, loud, speakerFirst: speaker.first });
    const mood = readMood(parsed.mood);

    if (whisper) {
      // the model is only asked for the parting word; it is used when it answers to the same ruling
      const agrees = named?.id === whisper.id && !!reply;
      return rule(whisper, agrees
        ? { via: 'model', reply, mood, drafts: readOaths(parsed.oaths, text), revealed: reveal(parsed.revealed), byWhisper: false }
        : { via: 'offline', reply: '', mood: null, drafts: oathsInSpeech(text, deps.getState().day), revealed: [], byWhisper: false });
    }
    if (invented) return null;                                                // an invented ruling taints the whole answer
    if (!reply && !named) return null;

    if (named) {
      // Heard in a question, a maybe, words that say the opposite, words the plain ear takes for a
      // different ruling, or a word or two that name no ruling at all ("Agreed.", "Hm."): ask
      // before it is entered.
      const weight = ear.scores[named.id] ?? 0;
      const disputed = weight < 0 || (ear.outcomeId !== null && ear.outcomeId !== named.id);
      const thin = weight <= 0 && normText(text).split(' ').length <= 3;
      if (doubtful(text) || disputed || thin) {
        const drafts = oathsInSpeech(text, deps.getState().day);
        // the words deny the model's ruling and plainly name another: that is the one to ask about
        const other = weight < 0 && ear.outcomeId !== named.id ? def.outcomes.find(x => x.id === ear.outcomeId) : undefined;
        return other ? askRuling(other, { reply: '', mood: null, via: 'offline', drafts }) : askRuling(named, { reply, mood, via: 'model', drafts });
      }
      return rule(named, { via: 'model', reply, mood, drafts: readOaths(parsed.oaths, text), revealed: reveal(parsed.revealed), byWhisper: false });
    }

    // The answer did not say whether this was a ruling (it was cut short, or was not JSON at all),
    // and the words sound like one: better to ask than to let a parting word hang over an open matter.
    const heard = (parsed.salvaged || parsed.loose) && ear.outcomeId ? def.outcomes.find(x => x.id === ear.outcomeId) : undefined;
    if (heard) return askRuling(heard, { reply: '', mood: null, via: 'offline', drafts: oathsInSpeech(text, deps.getState().day) });

    const trusted = !parsed.salvaged && !parsed.loose;
    const oaths = swearAll(trusted ? readOaths(parsed.oaths, text) : []);
    const revealed = trusted ? reveal(parsed.revealed) : [];
    if (mood) speaker.mood = mood;
    push('petitioner', reply);
    if (rulerTurns === MAX_RULER_TURNS) push('steward', spoken(CAP_LINE));
    return turnOf({ reply, oaths, revealed, via: 'model' });
  }

  async function sayNow(rawText: string): Promise<AudienceTurn> {
    if (closed || session.done) return quiet();
    const text = tidyRuler(rawText);
    if (!text) {
      const reply = spoken('{title}?');
      if (session.lines[session.lines.length - 1]?.text !== reply) push('petitioner', reply);
      return turnOf({ reply });
    }
    const gone = settledElsewhere();
    if (gone) return gone;

    rulerTurns++;
    push('ruler', text);
    const gen = ++generation;
    notify();
    const ear = matchOutcomeOffline(def, text, vars);
    const asked = hanging;
    hanging = null;
    let turn: AudienceTurn | null = null;
    let called = false;
    try {
      // an answer to "Is that your ruling?": an aye, or the same ruling said again
      if (asked && (saysAye(text) || ear.outcomeId === asked.id)) {
        const o = def.outcomes.find(x => x.id === asked.id);
        if (o) return rule(o, { via: asked.reply ? asked.via : 'offline', reply: asked.reply, mood: asked.mood, drafts: oathsInSpeech(text, deps.getState().day), revealed: [], byWhisper: false });
      }
      const whisperId = whisperSpoken(def, text, vars);
      const whisper = whisperId ? def.outcomes.find(x => x.id === whisperId) ?? null : null;
      if (rulerTurns <= MAX_RULER_TURNS && hasModel()) { called = true; turn = await modelTurn(text, gen, ear, whisper); }
      if (gen !== generation) return quiet();              // a whisper was chosen, or the ruler left, while we waited
      if (turn) { lostAnswers = 0; return turn; }
      if (called) lostAnswers++;
      return offlineTurn(text, called, ear);
    } catch (e) {
      console.error('[word] audience turn failed', e);
      if (gen !== generation) return quiet();
      try { return offlineTurn(text, true, ear); } catch { const reply = spoken(NUDGES.npc[0]!); push('petitioner', reply); return turnOf({ reply }); }
    }
  }

  /** Turns are answered one at a time, in the order they were spoken. `busy` is true from the call until the answer. */
  function say(text: string): Promise<AudienceTurn> {
    if (closed || session.done) return Promise.resolve(quiet());
    waiting++;
    session.busy = true;
    const run = queue.then(() => sayNow(text)).finally(() => {
      waiting = Math.max(0, waiting - 1);
      if (waiting === 0) session.busy = false;
      notify();
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  function choose(outcomeId: string): AudienceTurn {
    if (closed || session.done) return quiet();
    const o = def.outcomes.find(x => x.id === outcomeId);
    if (!o) {
      const reply = spoken(NOT_A_RULING);
      push('petitioner', reply);
      notify();
      return turnOf({ reply });
    }
    generation++;                                           // whatever the petitioner was about to say is moot
    abort?.abort();
    session.busy = false;
    hanging = null;
    const gone = settledElsewhere();
    if (gone) { notify(); return gone; }
    push('ruler', plain(o.say));
    const turn = rule(o, { via: 'offline', reply: '', mood: null, drafts: [], revealed: [], byWhisper: true });
    notify();
    return turn;
  }

  function leave(): void {
    if (closed) return;
    closed = true;
    generation++;
    abort?.abort();
    session.busy = false;
    notify();
  }

  return session;
}
