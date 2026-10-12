/**
 * OWNER: word-audience agent.
 *
 * The petitioner's prompt: everything the model needs to play one person in
 * one audience, and the tolerant reader for what it sends back.
 *
 * The model gives a petitioner a voice and decides when the ruler's words
 * amount to one of the listed rulings. It never changes the world: audience.ts
 * validates every field of the answer and the sim has the last word.
 *
 * The court may be answered by a small model. So the prompt is short, numbered
 * and explicit, the answer shape is spelled out twice, and the reader forgives
 * almost anything: chatter around the JSON, code fences, single quotes, bare
 * keys, stray commas, quotes inside the reply, an answer cut off half way,
 * "Reply: ..." lines, or no JSON at all.
 *
 *   buildAudiencePrompt(input) -> ModelRequest   (system + one user turn)
 *   parseAudienceReply(raw)    -> RawAudienceReply | null
 *   readMood(raw)              -> Mood | null
 *   cleanSpoken(text, opts)    -> a line fit to show a player ('' if it is not)
 */
import type { ModelRequest, AudienceLine, Mood, Speaker } from './api';
import type { GameState, Incident, Tenant, Applicant, Building, OathKind } from '../sim/types';
import type { IncidentDef, OutcomeDef } from '../data/schema';
import type { Species, TraitId } from '../data/ids';
import { TRAIT_DEFS, TAG_DEFS, TRADE_DEFS, SPECIES_DEFS, CHARACTERS, TEMPERAMENT_DEFS, RANKS, BAL } from '../data';
import { fill, fmtDate, dateOf } from '../sim/core';
import type { AudienceCast } from './audience';

export const AUDIENCE_MOODS: Mood[] = ['neutral', 'pleased', 'delighted', 'worried', 'annoyed', 'angry', 'smug', 'sad', 'afraid'];
export const OATH_KINDS: OathKind[] = ['repair', 'no_rent_raise', 'no_evict', 'build', 'pay', 'rent_cap', 'word'];
/** STYLE.md: replies stay under 200 characters. */
export const REPLY_CAP = 200;

/** How each people behaves as tenants (docs/STYLE.md, "Species as tenants"). */
export const SPECIES_NOTES: Record<Species, string> = {
  human: 'Humans are the baseline mess: excuses, feuds over fences, chickens.',
  halfling: 'Halflings are model tenants obsessed with food and comfort. They pay in full with a seed cake, sublet the pantry, and draw noise complaints at second breakfast. Round doors.',
  dwarf: 'Dwarves are contract literalists and compulsive renovators. They pay to the minute, dig unauthorized cellars, and call anything built after their grandfather "new build, shoddy".',
  goblin: 'Goblins are chaotic lovers of bureaucracy: forms, stamps, committees, receipts, triplicate. Fourteen to a hovel "for efficiency". Scrupulous about rules they made up. Officious, never stupid and never dirty.',
  elf: 'Elves are insufferably long-term. They want 400-year leases and complain the oak was pruned in the wrong century. Polite in a way that feels like being marked down.',
  ogre: 'Ogres are enormous, gentle, and mortified by the damage they cause. They apologise to doorframes. Excellent with children and bad with stairs.',
};

/** STYLE.md: no exclamation marks, except from goblins, criers and heralds reading proclamations. */
export function mayShout(sp: Pick<Speaker, 'species' | 'role' | 'npc'>): boolean {
  return sp.species === 'goblin' || sp.npc === 'goblin_chief' || sp.role === 'crier' || sp.npc === 'crown_herald';
}

export interface AudiencePromptInput {
  state: GameState;
  incident: Incident;
  def: IncidentDef;
  cast: AudienceCast;
  /** placeholders for this incident (audience.ts `audienceVars`) */
  vars: Record<string, string | number>;
  /** the transcript before the ruler's newest words */
  lines: AudienceLine[];
  /** what the ruler has just said */
  rulerText: string;
  /** 1 for the ruler's first turn */
  turn: number;
  maxTurns: number;
  /**
   * Set when the ruler's words are one of the Steward's whispers as written:
   * the ruling is already known, and the model is only asked for the parting word.
   */
  ruling?: string | null;
  tier?: 'quick' | 'default';
}

// ───────────────────────────── small helpers ─────────────────────────────

const words = (id: string): string => id.replace(/_/g, ' ');
const plural = (n: number, one: string, many = one + 's'): string => `${n} ${n === 1 ? one : many}`;

function monthsHoused(s: GameState, t: Tenant): number {
  return Math.max(0, Math.floor((s.day - t.movedInDay) / 30));
}
function ago(s: GameState, day: number): string {
  const d = Math.max(0, s.day - day);
  if (d < 2) return 'just now';
  if (d < 30) return `${Math.round(d)} days ago`;
  const m = Math.round(d / 30);
  return m < 12 ? `${plural(m, 'month')} ago` : `${plural(Math.round(m / 12), 'year')} ago`;
}
function happinessWord(h: number): string {
  return h >= 80 ? 'very content' : h >= 60 ? 'content enough' : h >= 40 ? 'uneasy' : h >= 20 ? 'unhappy' : 'bitter';
}
function conditionWord(c: number): string {
  return c >= 80 ? 'in good repair' : c >= 55 ? 'sound enough' : c >= 30 ? 'shabby' : 'in a bad way';
}
function renownWord(r: number): string {
  return r >= 75 ? 'well loved by the tenantry' : r >= 55 ? 'fairly well spoken of' : r >= 35 ? 'spoken of with a shrug' : 'ill spoken of at the well';
}
function traitLine(id: TraitId): string {
  const d = TRAIT_DEFS[id];
  const name = d?.name ?? words(id);
  return d?.blurb ? `${id} (${name}: ${d.blurb})` : name.toLowerCase() === words(id) ? id : `${id} (${name})`;
}
const q = (text: string): string => JSON.stringify(text);
/** A sum the engine will work out for itself: exact when it comes out whole, "about" when it must be rounded. */
const crownsOf = (raw: number): string => (Number.isInteger(raw) ? plural(raw, 'crown') : `about ${plural(Math.max(1, Math.round(raw)), 'crown')}`);

// ───────────────────────────── what each ruling really does ─────────────────────────────

/**
 * The plain terms of an outcome, with the engine's true figures, so the
 * petitioner can talk about them without making numbers up. Hidden
 * consequences (happiness, renown, follow-on incidents) are left out.
 */
export function termsOf(o: OutcomeDef, s: GameState, cast: AudienceCast): string {
  const out: string[] = [];
  const who = cast.tenant ?? cast.subject;
  const rent = who?.lease?.rent ?? null;
  const deposit = who?.lease?.deposit ?? null;
  const ask = cast.building?.rent ?? null;
  for (const e of o.effects) {
    switch (e.t) {
      case 'gold':
        if (e.amount > 0) out.push(`the ruler is paid ${plural(e.amount, 'crown')}${e.memo ? ` (${e.memo.toLowerCase()})` : ''}`);
        else if (e.amount < 0) out.push(`it costs the ruler ${plural(-e.amount, 'crown')}${e.memo ? ` (${e.memo.toLowerCase()})` : ''}`);
        break;
      case 'rent':
        if (e.pct === 0) out.push(rent !== null ? `the rent stays at ${plural(rent, 'crown')} a month` : 'the rent stays as it is');
        else {
          const dir = e.pct > 0 ? 'rises' : 'falls';
          out.push(rent !== null ? `the rent ${dir} from ${rent} to ${crownsOf(rent * (1 + e.pct / 100))} a month` : `the rent ${dir} by ${Math.abs(e.pct)} in the hundred`);
        }
        break;
      case 'arrears':
        if (e.amount === 'forgive') out.push(who && who.arrears > 0 ? `the ${plural(who.arrears, 'crown')} owed are forgiven` : 'what is owed is forgiven');
        else if (e.amount > 0) out.push(`${plural(e.amount, 'crown')} are added to what the household owes`);
        else if (e.amount < 0) out.push(`${plural(-e.amount, 'crown')} are struck from what the household owes`);
        break;
      case 'late':
        switch (e.option) {
          case 'wait': out.push('more time to pay, and no fee'); break;
          case 'late_fee': {
            out.push(rent !== null
              ? `a late fee of ${s.policies.lateFeePct} in the hundred (${crownsOf(rent * s.policies.lateFeePct / 100)}) on top of the rent owed`
              : `a late fee of ${s.policies.lateFeePct} in the hundred on top of the rent owed`);
            break;
          }
          case 'payment_plan': out.push('the arrears are paid off in instalments alongside the rent'); break;
          case 'forgive': out.push(who && who.arrears > 0 ? `the ${plural(who.arrears, 'crown')} owed are forgiven` : 'the debt is forgiven'); break;
          case 'notice': out.push(`a Notice to Quit is nailed to the door and the Reeve's Court hears it in about ${BAL.courtDays} days`); break;
          case 'mercy': out.push('the writ is torn up and the household stays'); break;
          case 'evict': out.push('the household is put out'); break;
          case 'cash_for_keys': out.push('the household is paid to leave quietly'); break;
          default: break;
        }
        break;
      case 'evict': out.push('the Bailiff puts the household out'); break;
      case 'leave': out.push('the household packs up and leaves'); break;
      case 'deposit':
        if (e.keepPct === 0) out.push(deposit ? `the whole surety of ${plural(deposit, 'crown')} is returned` : 'the whole surety is returned');
        else if (e.keepPct < 0) out.push('the ruler keeps only what the real damage costs and returns the rest of the surety');
        else if (e.keepPct >= 100) out.push(deposit ? `the ruler keeps the whole surety of ${plural(deposit, 'crown')}` : 'the ruler keeps the whole surety');
        else out.push(deposit ? `the ruler keeps ${crownsOf(deposit * e.keepPct / 100)} of the ${deposit} crown surety` : `the ruler keeps ${e.keepPct} in the hundred of the surety`);
        break;
      case 'lease':
        if (!e.accept) out.push('the household is turned away');
        else if (ask !== null) out.push(`the household signs at ${crownsOf(ask * (e.rentPct ?? 100) / 100)} a month${e.rentPct && e.rentPct !== 100 ? ` (the board said ${ask})` : ''}`);
        else out.push('the household signs the lease');
        break;
      case 'screen': out.push('their last landlord is asked about them before anything is decided'); break;
      case 'pet':
        if (e.remove) out.push('the animal must go');
        else if (e.add) out.push(`the ${words(e.add)} is allowed to stay`);
        break;
      case 'squatters':
        if (e.set === null) out.push('the squatters leave the house');
        break;
      case 'squatters_sign_lease': out.push('the squatters sign a lease and pay rent like anyone else'); break;
      case 'condition':
        if (e.amount >= 8) out.push('the place is put right');
        break;
      case 'oath': out.push(`the ruler is bound by oath for ${plural(e.months, 'month')}: ${q(e.text)}`); break;
      default: break;
    }
  }
  if (o.job && o.job.cost > 0) out.push(`the work costs the ruler ${plural(o.job.cost, 'crown')}`);
  return out.length ? out.join('; ') : 'nothing changes hands';
}

// ───────────────────────────── the sheet: who is speaking ─────────────────────────────

function householdSheet(s: GameState, h: Tenant | Applicant['household'], housedAs: Tenant | null, lastHome: Building | null = null): string[] {
  const L: string[] = [];
  const trade = TRADE_DEFS[h.trade]?.name ?? words(h.trade);
  const sp = SPECIES_DEFS[h.species];
  L.push(`- You are ${h.name} ("${h.first}"), ${h.species === 'elf' || h.species === 'ogre' ? 'an' : 'a'} ${h.species} ${trade.toLowerCase()}, speaking for a household of ${h.household}.`);
  L.push(`- Your people as tenants: ${SPECIES_NOTES[h.species]}${sp?.cares ? ` What you notice about a home: ${sp.cares}` : ''}`);
  if (h.tags.length) L.push(`- Known to all: ${h.tags.map(t => { const d = TAG_DEFS[t]; return d?.blurb ? `${d.name.toLowerCase()} (${d.blurb})` : words(t); }).join(', ')}.`);
  if (h.pets.length) L.push(`- Animals under your roof: ${h.pets.map(words).join(', ')}.`);
  const known = h.traits.filter(t => h.revealed.includes(t));
  const hidden = h.traits.filter(t => !h.revealed.includes(t));
  if (known.length) L.push(`- Sides of you the ruler already knows: ${known.map(traitLine).join('; ')}.`);
  if (hidden.length) L.push(`- Sides of you the ruler has NOT yet learned: ${hidden.map(traitLine).join('; ')}. Let them colour your manner. Do not announce them.`);
  const ch = h.character ? CHARACTERS.find(c => c.id === h.character) : undefined;
  if (ch) {
    if (ch.bio) L.push(`- Your story: ${ch.bio}`);
    if (ch.voice) L.push(`- Your voice: ${ch.voice}`);
    const samples = [ch.lines?.greet, ch.lines?.complain].filter(Boolean);
    if (samples.length) L.push(`- You have been heard to say: ${samples.map(x => q(x!)).join(' ')}`);
  }
  if (housedAs) {
    const t = housedAs;
    const b = t.buildingId ? s.buildings[t.buildingId] : null;
    const m = monthsHoused(s, t);
    const lived = m < 1 ? 'less than a month' : plural(m, 'month');
    if (b) L.push(`- Home: ${b.name} (a ${words(b.type)}, ${conditionWord(b.condition)}). You have lived under this ruler for ${lived}.`);
    else if (lastHome) L.push(`- You have lately moved out of ${lastHome.name} (a ${words(lastHome.type)}, now ${conditionWord(lastHome.condition)}), after ${lived} under this ruler.`);
    else L.push(`- You have lately left this ruler's roof, after ${lived} under it.`);
    if (t.lease) L.push(`- Your lease: ${plural(t.lease.rent, 'crown')} a month${t.lease.deposit ? `, with a surety of ${plural(t.lease.deposit, 'crown')} held by the ruler` : ''}.`);
    L.push(t.arrears > 0
      ? `- You owe ${plural(t.arrears, 'crown')} in arrears${t.daysLate > 0 ? `, ${plural(Math.round(t.daysLate), 'day')} late` : ''}${t.plan ? ` (a payment plan is running: ${plural(t.plan.left, 'instalment')} of ${t.plan.each} left)` : ''}${t.lateStage === 'noticed' || t.lateStage === 'court' ? '. A Notice to Quit is already on your door' : ''}${t.lateStage === 'writ' ? '. The court has ruled against you' : ''}.`
      : '- You owe nothing in arrears.');
    L.push(b ? `- How you feel about living here: ${happinessWord(t.happiness)}.` : `- How you felt about your time under this roof: ${happinessWord(t.happiness)}.`);
    const mem = t.memory.slice(-5);
    if (mem.length) {
      L.push('- What you remember of this ruler, oldest first. Use it: gratitude softens you, a grudge sharpens you, and you may bring either up:');
      for (const e of mem) L.push(`    ${e.valence > 0 ? (e.valence > 1 ? 'fondly' : 'kindly') : (e.valence < -1 ? 'bitterly' : 'sourly')}, ${ago(s, e.day)}: ${e.text}`);
    } else {
      L.push('- You have no particular memories of this ruler yet, good or bad.');
    }
    const oaths = s.oaths.filter(o => o.toTenantId === t.id).slice(-3);
    if (oaths.length) {
      L.push('- Promises this ruler has made you:');
      for (const o of oaths) L.push(`    ${q(o.text)} (${o.state === 'open' ? 'still running' : o.state === 'kept' ? 'kept' : o.state === 'broken' ? 'BROKEN, and you have not forgotten' : 'you let them off it'})`);
    }
  }
  return L;
}

function castSheet(input: AudiencePromptInput): string[] {
  const { state: s, cast } = input;
  const L: string[] = [];
  const sp = cast.speaker;
  if (cast.applicant) {
    const a = cast.applicant;
    L.push(...householdSheet(s, a.household, null));
    const b = s.buildings[a.buildingId];
    if (b) L.push(`- You have been shown ${b.name} (a ${words(b.type)}, ${conditionWord(b.condition)}). The board says ${plural(b.rent, 'crown')} a month${s.policies.depositMonths > 0 ? `, with a surety of ${plural(Math.round(b.rent * s.policies.depositMonths), 'crown')}` : ''}.`);
    L.push(`- Privately: the most your household could truly pay is ${plural(a.maxRent, 'crown')} a month. You do not volunteer that figure.`);
    L.push(`- You have never rented from this ruler. You know them by reputation only: ${renownWord(s.renown)}.`);
    if (a.screened) L.push('- Your last landlord has already been asked about you.');
  } else if (cast.tenant) {
    L.push(...householdSheet(s, cast.tenant, cast.tenant, cast.building));
    if (cast.subject && cast.subject.id !== cast.tenant.id) {
      const sb = cast.subject.buildingId ? s.buildings[cast.subject.buildingId] : null;
      L.push(`- You come as a neighbour. The matter concerns ${cast.subject.name}${sb ? ` at ${sb.name}` : ''}, not your own lease.`);
    }
  } else if (cast.staff) {
    const m = cast.staff;
    const td = TEMPERAMENT_DEFS[m.temperament];
    const served = Math.max(0, Math.floor((s.day - m.hiredDay) / 30));
    L.push(`- You are ${m.name} ("${m.first}"), ${m.species === 'elf' || m.species === 'ogre' ? 'an' : 'a'} ${m.species}, the ruler's ${m.role}. You have served ${served < 1 ? 'less than a month' : plural(served, 'month')} at ${plural(m.wage, 'crown')} a month.`);
    L.push(`- Your people: ${SPECIES_NOTES[m.species]}`);
    if (td) L.push(`- Your temperament: ${td.name}${td.epithet ? ` ${td.epithet}` : ''}.${td.blurb ? ` ${td.blurb}` : ''}${td.voice ? ` Your voice: ${td.voice}` : ''}${td.quirk ? ` Your habit: ${td.quirk}` : ''}`);
    L.push(`- Your loyalty to this ruler: ${m.loyalty >= 70 ? 'firm' : m.loyalty >= 40 ? 'middling' : 'wearing thin'}.`);
    if (cast.subject) L.push(`- The matter touches the household of ${cast.subject.name}.`);
  } else if (cast.npc) {
    const n = cast.npc;
    L.push(`- You are ${sp.name}${n.title && n.title !== sp.name ? `, ${n.title}` : ''}, ${sp.species === 'elf' || sp.species === 'ogre' ? 'an' : 'a'} ${sp.species}. You are not one of the ruler's tenants.`);
    L.push(`- Your people: ${SPECIES_NOTES[sp.species]}`);
    if (n.bio) L.push(`- Your story: ${n.bio}`);
    if (n.voice) L.push(`- Your voice: ${n.voice}`);
    const samples = [n.lines?.greet, n.lines?.pleased, n.lines?.displeased].filter(x => x && x.length > 12);
    if (samples.length) L.push(`- You have been heard to say: ${samples.map(x => q(x!)).join(' ')}`);
    if (cast.subject) L.push(`- The matter touches the household of ${cast.subject.name}${cast.building ? ` at ${cast.building.name}` : ''}.`);
    else if (cast.building) L.push(`- The matter concerns ${cast.building.name} (a ${words(cast.building.type)}, ${conditionWord(cast.building.condition)}).`);
  } else {
    L.push(`- You are ${sp.name}, the court's tired clerk, laying a matter before the ruler with perfect composure. You have no stake in it beyond wanting it off your desk.`);
    if (cast.building) L.push(`- The matter concerns ${cast.building.name} (a ${words(cast.building.type)}, ${conditionWord(cast.building.condition)}).`);
  }
  return L;
}

/** Policies a petitioner in this kind of matter would know and argue from. */
function policyLine(def: IncidentDef, s: GameState): string {
  const p = s.policies;
  const grace = `${plural(p.graceDays, 'grace day')} after Rent Day`;
  const fee = `a late fee of ${p.lateFeePct} in the hundred`;
  const surety = p.depositMonths > 0 ? `a surety of ${p.depositMonths === 1 ? 'one month\'s rent' : `${p.depositMonths} months' rent`} at signing` : 'no surety asked at signing';
  const pets = p.pets === 'allow' ? 'animals are allowed' : p.pets === 'ban' ? 'animals are forbidden' : 'animals are allowed for pet rent';
  const cap = `rents may rise no more than ${p.renewalCapPct} in the hundred at renewal`;
  const screen = p.screening === 'always' ? 'every applicant\'s last landlord is asked about them' : 'applicants are taken at their word';
  let pick: string[];
  switch (def.decision) {
    case 'late_rent': case 'eviction_ready': pick = [grace, fee]; break;
    case 'applicant': pick = [surety, screen, pets]; break;
    case 'move_out_deposit': pick = [surety]; break;
    case 'pet': pick = [pets, surety]; break;
    case 'rent_renewal': pick = [cap]; break;
    case 'squatters': pick = [surety, pets]; break;
    default:
      pick = def.category === 'payment' || def.category === 'legal' ? [grace, fee, cap]
        : def.category === 'pet' || def.category === 'pest' ? [pets]
        : def.category === 'lease' ? [surety, cap, pets]
        : [grace, fee, pets];
  }
  return pick.join('; ');
}

// ───────────────────────────── the prompt ─────────────────────────────

export function buildAudiencePrompt(input: AudiencePromptInput): ModelRequest {
  const { state: s, def, cast, vars, lines, rulerText, turn, maxTurns } = input;
  const sp = cast.speaker;
  const rank = RANKS[s.realm.rank];
  const address = rank?.address ?? 'my lord';
  const date = dateOf(s.day);
  const loud = mayShout(sp);
  const F = (t: string) => fill(t, vars);
  // how far off the year's end and each coming season are, so "this year" and "before the frost" can be counted
  const off = (startMonth: number) => ((startMonth - date.month + 12) % 12) || 12;
  const seasonsOff = ([['spring', 0], ['summer', 3], ['autumn', 6], ['winter (the frost)', 9]] as [string, number][])
    .map(([n, m]) => [n, off(m)] as [string, number]).sort((a, b) => a[1] - b[1]);
  const monthsLine = `- Months from today, for a promise: this year ends in ${Math.max(1, 12 - date.month)}; ${seasonsOff.map(([n, m]) => `${n} begins in ${m}`).join(', ')}. None named: 3 for a repair, building or payment, else 12.`;

  const rulings = def.outcomes.map(o =>
    `- ${q(o.id)}: ${F(o.intent)} Terms: ${termsOf(o, s, cast)}. You would say something like: ${q(F(o.reply))}`);
  const ids = def.outcomes.map(o => q(o.id));
  const idList = ids.length > 1 ? `${ids.slice(0, -1).join(', ')} or ${ids[ids.length - 1]}` : ids[0] ?? 'null';
  const own = cast.applicant?.household ?? cast.tenant;
  const hidden = own ? own.traits.filter(t => !own.revealed.includes(t)) : [];
  const mayLeave = !!(cast.tenant || cast.applicant) && !!s.rival?.name;

  const system = [
    'You play one character in LandLord, a dry, deadpan comedy about rent in a small medieval realm where tenants keep griffins. Every scene is real landlord-and-tenant business in costume, played perfectly straight. Nobody in it thinks any of it is funny.',
    `You are ${sp.name}. You have walked to the ruler's seat to be heard, and the ruler is speaking with you.`,
    '',
    '== WHO YOU ARE ==',
    ...castSheet(input),
    '',
    '== THE MATTER ==',
    `- ${F(def.title)}. The court clerk announced it so: ${F(def.herald)}`,
    def.stance ? `- Where you stand (the clerk's note on you): ${F(def.stance)}` : '- Where you stand: you want it settled fairly and soon.',
    '',
    '== THE RULER AND THE REALM ==',
    `- The ruler is ${s.realm.ruler}, ${rank?.title ?? 'Reeve'} of ${s.realm.name}, ${renownWord(s.renown)}. Address them as "${address}".`,
    `- Today is the ${fmtDate(s.day)}. It is ${date.season}${s.weather !== 'clear' ? `, and there is ${s.weather}` : ''}. Rent Day is the 1st of every month.`,
    `- The custom of this realm: ${policyLine(def, s)}. A ruling's own figure overrides it.`,
    monthsLine,
    mayLeave ? `- The lord next door, ${s.rival.name} of ${s.rival.seat}, would be glad of this ruler's tenants.` : '',
    '',
    '== THE ONLY RULINGS ==',
    'The matter can end in one of these and in nothing else:',
    ...rulings,
    '',
    '== HOW YOU SPEAK ==',
    `1. Only ${sp.first}'s own spoken words. No narration, no stage directions, never the ruler's lines.`,
    '2. Dry, deadpan, specific. Name the actual thing ("It has eaten a weathervane", never "it caused damage"). Understate.',
    `3. Short: one to three sentences, never more than ${REPLY_CAP - 20} characters.`,
    `4. Plain English with a medieval lean: the surety (never "deposit"), Rent Day, crowns, a Notice to Quit, the Reeve's Court. No thee or thou, no modern words, no dashes of any kind. ${loud ? 'You may shout now and then.' : 'No exclamation marks.'}`,
    '5. Argue your corner like a person: quibble over the wording, bring up what you remember of this ruler, hold out for what you want. Concede when you are treated fairly. Bristle when threatened.',
    '6. Never invent numbers, sums, dates or bargains: the only figures you may speak are written above. Only the rulings above can happen. If the ruler proposes anything else, say custom will not have it and steer back. Asked a fact you cannot know (a lease clause), answer in character from what is written above, inventing no clause or number.',
    `7. You have never heard of games, players, models or prompts. Talk of them only baffles ${sp.first}, who returns to the matter.`,
    '',
    '== YOUR ANSWER ==',
    'One JSON object and nothing else. No code fence, no words before or after it:',
    '{"reply": "...", "mood": "...", "outcome": null, "oaths": [], "revealed": []}',
    `- "reply": what ${sp.first} says next.`,
    `- "mood": how ${sp.first} now feels. One of: ${AUDIENCE_MOODS.join(', ')}.`,
    `- "outcome": ${idList}, but ONLY when the ruler's latest words clearly decide the matter that way. Your reply is then your parting word on it, with no new terms. "outcome" is null while the ruler is asking questions, haggling, thinking aloud, scolding or making small talk: answer them and keep the matter moving. If their words could mean two rulings, or are a half-measure that matches none of them, null, and ask which it is to be.`,
    `- "oaths": usually []. Only what the ruler's latest words plainly PROMISE you for the days to come, beyond the ruling itself. Each one: {"kind": ${OATH_KINDS.map(k => q(k)).join(' | ')}, "text": the promise in the ruler's own words, "months": how long it runs or how soon it is due, "amount": the crowns they named, for "pay" and "rent_cap" only}. Use "word" for any pledge the other kinds do not fit. Threats, maybes and your own offers are not promises. A promise hung on a bargain ("pay half now and I will not raise your rent") becomes an oath only in the turn its ruling is made.`,
    hidden.length
      ? `- "revealed": usually []. Name a hidden side of yours (${hidden.join(', ')}) only when this very reply brings it plainly into the open.`
      : '- "revealed": always [].',
    '',
    '== EXAMPLES ==',
    'From another matter (a leaning chimney, with rulings "mend" and "leave", and winter 3 months off):',
    'The ruler says: "How long has it leaned?"',
    `{"reply": "Since the spring storms, ${address}. It used to lean left. I preferred that.", "mood": "worried", "outcome": null, "oaths": [], "revealed": []}`,
    'The ruler says: "Very well. I will send the mason, and you have my word it is straight before the frost."',
    '{"reply": "Before the frost. I shall tell the chimney. It will be as surprised as I am.", "mood": "pleased", "outcome": "mend", "oaths": [{"kind": "repair", "text": "The chimney will be straight before the frost.", "months": 3}], "revealed": []}',
  ].filter(x => x !== '').join('\n').replace(/\n== /g, '\n\n== ');

  const aside = Object.values(s.staff).some(m => m.role === 'steward') ? 'Steward' : 'clerk';
  const transcript = lines.map(l => {
    const who = l.who === 'ruler' ? 'The ruler' : l.who === 'steward' ? `The ruler's ${aside} (aside)` : sp.first;
    return `${who}: ${q(l.text)}`;
  });

  const ruled = input.ruling && def.outcomes.some(o => o.id === input.ruling) ? input.ruling : null;
  let nudge = '';
  if (ruled) nudge = `These words are the ruling ${q(ruled)}. Set "outcome" to ${q(ruled)} and give your parting word on it.`;
  else if (turn >= maxTurns - 2) nudge = `The court is growing restless. Unless these words are a ruling, answer in a few words and press for one: "So what is it to be, ${address}?"`;
  else if (turn >= 4) nudge = `The talk has gone on a while. If these words are still not a ruling, you may end by asking what it is to be: "So what is it to be, ${address}?"`;

  const user = [
    'THE AUDIENCE SO FAR',
    ...(transcript.length ? transcript : ['(nothing has been said yet)']),
    '',
    `THE RULER NOW SAYS (their turn ${turn} of at most ${maxTurns})`,
    q(rulerText),
    '',
    nudge,
    ruled ? `Answer as ${sp.first} with the JSON object only.` : `Answer as ${sp.first} with the JSON object only. "outcome" is ${idList}, or null if this is not yet a ruling.`,
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');

  return {
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens: 400,
    tier: input.tier ?? 'quick',
  };
}

// ───────────────────────────── reading the answer ─────────────────────────────

export interface RawAudienceReply {
  reply: string;
  mood: string | null;
  outcome: string | null;
  oaths: unknown[];
  revealed: string[];
  /** the reply itself was cut short: keep only its finished sentences, and never rule on it */
  salvaged: boolean;
  /** the answer said nothing either way about a ruling (plain prose, or no "outcome" at all) */
  loose: boolean;
}

const REPLY_KEYS = ['reply', 'response', 'answer', 'line', 'speech', 'message', 'say', 'says', 'spoken'];
const MOOD_KEYS = ['mood', 'emotion', 'feeling'];
const OUTCOME_KEYS = ['outcome', 'outcomeid', 'outcome_id', 'ruling', 'decision', 'choice'];
const OATH_KEYS = ['oaths', 'oath', 'promises', 'promise'];
const REVEAL_KEYS = ['revealed', 'reveal', 'reveals', 'revealed_traits'];
const KEY_ALT = [...REPLY_KEYS, ...MOOD_KEYS, ...OUTCOME_KEYS, ...OATH_KEYS, ...REVEAL_KEYS].join('|');
/** Ways a model says "no ruling" without writing null. */
const NO_RULING = /^(?:null|none|nil|nothing|undefined|n\/?a|no|false|undecided|unknown|pending|not yet|no ruling|no outcome|no decision|tbd|-+)?$/i;

/** Every top-level {...} in the text, in order, honouring strings. An unclosed one is left out. */
function topObjects(text: string): string[] {
  const out: string[] = [];
  let i = text.indexOf('{');
  while (i >= 0 && out.length < 6) {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j]!;
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) break;
    out.push(text.slice(i, end + 1));
    i = text.indexOf('{', end + 1);
  }
  return out;
}

/** Apply `fn` to the parts of `text` that lie outside double-quoted strings. */
function outsideStrings(text: string, fn: (part: string) => string): string {
  let out = '', last = 0;
  for (const m of text.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
    out += fn(text.slice(last, m.index)) + m[0];
    last = m.index! + m[0].length;
  }
  return out + fn(text.slice(last));
}

/** JSON.parse, then again after mending the usual damage. `undefined` if it will not parse. */
function tryJson(text: string): unknown {
  try { return JSON.parse(text); } catch { /* mend and try again */ }
  // a line break typed inside a string
  let t = text.replace(/"(?:[^"\\]|\\.)*"/g, m => (m.length < 600 ? m.replace(/\r?\n/g, ' ').replace(/\t/g, ' ') : m));
  try { return JSON.parse(t); } catch { /* next */ }
  t = outsideStrings(t, part => part
    .replace(/\/\/[^\n]*/g, '')                                                 // a // comment
    .replace(/([{,]\s*)([A-Za-z_]\w*)(\s*:)/g, '$1"$2"$3')                       // bare keys
    .replace(/\b(?:None|NULL|Null|nil|undefined)\b/g, 'null')                    // other tongues' null
    .replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false')
    .replace(/,(\s*[}\]])/g, '$1'));                                             // trailing commas
  try { return JSON.parse(t); } catch { /* next */ }
  // curly quotes used as JSON quotes; single-quoted keys and values
  const u = t.replace(/[\u201c\u201d]/g, '"')
    .replace(/([{,[]\s*)'((?:[^'\\]|\\.)*)'(?=\s*[:,}\]])/g, (_m, a: string, b: string) => `${a}"${b.replace(/\\'/g, '\'').replace(/"/g, '\\"')}"`)
    .replace(/(:\s*)'((?:[^'\\]|\\.)*)'(?=\s*[,}\]])/g, (_m, a: string, b: string) => `${a}"${b.replace(/\\'/g, '\'').replace(/"/g, '\\"')}"`)
    .replace(/,(\s*[}\]])/g, '$1');
  try { return JSON.parse(u); } catch { return undefined; }
}

function lowerKeys(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k.trim().toLowerCase().replace(/[\s-]+/g, '_')] = v;
  return out;
}
const firstOf = (o: Record<string, unknown>, keys: string[]): unknown => { for (const k of keys) if (o[k] !== undefined) return o[k]; return undefined; };

/** Read the five fields out of a parsed object. Null when it holds no reply. */
function fromObject(value: unknown, depth = 0): RawAudienceReply | null {
  if (Array.isArray(value)) {
    for (const v of value) { const r = fromObject(v, depth + 1); if (r) return r; }
    return null;
  }
  if (!value || typeof value !== 'object' || depth > 2) return null;
  const o = lowerKeys(value as Record<string, unknown>);
  let reply = firstOf(o, REPLY_KEYS);
  if (typeof reply !== 'string' && typeof o.text === 'string' && o.kind === undefined) reply = o.text;   // not an oath's "text"
  if (typeof reply !== 'string') {
    // {"response": {...}} and the like: one layer of wrapping
    for (const v of Object.values(o)) { if (v && typeof v === 'object') { const r = fromObject(v, depth + 1); if (r) return r; } }
    return null;
  }
  let out = firstOf(o, OUTCOME_KEYS);
  const said = out !== undefined;
  if (out && typeof out === 'object' && !Array.isArray(out)) out = (out as Record<string, unknown>).id ?? (out as Record<string, unknown>).outcome ?? null;
  const outcome = typeof out === 'string' && !NO_RULING.test(out.trim()) ? out.trim() : null;
  const mood = firstOf(o, MOOD_KEYS);
  const oaths = firstOf(o, OATH_KEYS);
  const revealed = firstOf(o, REVEAL_KEYS);
  return {
    reply,
    mood: typeof mood === 'string' ? mood : null,
    outcome,
    oaths: Array.isArray(oaths) ? oaths : oaths && typeof oaths === 'object' ? [oaths] : [],
    revealed: Array.isArray(revealed) ? revealed.filter((x): x is string => typeof x === 'string') : typeof revealed === 'string' && revealed.trim() ? [revealed] : [],
    salvaged: false,
    loose: !said || (out !== null && typeof out !== 'string' && typeof out !== 'boolean'),
  };
}

function unescape(v: string): string {
  return v.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[nrt]/g, ' ').replace(/\\(.)/g, '$1');
}

const keyAt = (names: string[]): RegExp => new RegExp(`(?:^|[{,\\n])\\s*["'\u201c\u2018*]*(?:${names.join('|')})["'\u201d\u2019*]*\\s*[:=]\\s*\\**\\s*`, 'i');
/** What may follow the end of a value: the next field, the end of the object, or the end of everything. */
const AFTER_VALUE = new RegExp(`^\\s*(?:,\\s*)?(?:["'\u201c\u2018*]*(?:${KEY_ALT})["'\u201d\u2019*]*\\s*[:=]|[}\\]]\\s*(?:[,}\\]]|$)|$)`, 'i');

/**
 * Field by field, for an answer no parser will take: quotes inside the reply,
 * a cut-off object, or "Reply: ... / Outcome: ..." lines with no braces at all.
 */
function fromFields(text: string): RawAudienceReply | null {
  const rk = keyAt(REPLY_KEYS).exec(text);
  if (!rk) return null;
  const from = rk.index + rk[0].length;
  const open = text[from] ?? '';
  const closers = open === '"' ? '"' : open === '\'' ? '\'' : open === '\u201c' ? '\u201d"' : open === '\u2018' ? '\u2019\'' : '';
  let reply = '', after = text.length, complete = false;
  if (closers) {
    for (let i = from + 1; i < text.length; i++) {
      const c = text[i]!;
      if (c === '\\') { i++; continue; }
      if (closers.includes(c) && AFTER_VALUE.test(text.slice(i + 1, i + 80))) { reply = text.slice(from + 1, i); after = i + 1; complete = true; break; }
    }
    if (!complete) reply = text.slice(from + 1);
  } else {
    // a bare value: it runs to the end of its line
    const nl = text.indexOf('\n', from);
    after = nl < 0 ? text.length : nl;
    reply = text.slice(from, after).replace(/[,\s]+$/, '');
    complete = true;
  }
  reply = unescape(reply).trim();
  if (!reply) return null;
  if (!complete) return { reply, mood: null, outcome: null, oaths: [], revealed: [], salvaged: true, loose: true };

  const rest = text.slice(after);
  const value = (names: string[]): string | undefined => {
    const k = keyAt(names).exec(rest);
    if (!k) return undefined;
    const m = /^(?:"([^"\n]*)"|'([^'\n]*)'|\u201c([^\u201d\n]*)\u201d|([^,}\]\n]*))\s*(?=[,}\]\n]|$)/.exec(rest.slice(k.index + k[0].length));
    if (!m || /^["'\u201c]/.test(m[4] ?? '')) return undefined;         // the value itself was cut off
    return (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
  };
  const out = value(OUTCOME_KEYS);
  const mood = value(MOOD_KEYS);
  let oaths: unknown[] = [];
  const ok = keyAt(OATH_KEYS).exec(rest);
  if (ok) for (const piece of topObjects(rest.slice(ok.index + ok[0].length))) { const v = tryJson(piece); if (v && typeof v === 'object') oaths.push(v); }
  if (oaths.length > 4) oaths = oaths.slice(0, 4);
  const rv = keyAt(REVEAL_KEYS).exec(rest);
  const rvList = rv ? /^\[([^\]]*)\]/.exec(rest.slice(rv.index + rv[0].length)) : null;
  return {
    reply,
    mood: mood ? mood : null,
    outcome: out !== undefined && !NO_RULING.test(out) ? out : null,
    oaths,
    revealed: rvList ? rvList[1]!.split(',').map(x => x.replace(/["'\s]/g, '')).filter(Boolean) : [],
    salvaged: false,
    loose: out === undefined,
  };
}

/** A model declining, or talking about the task instead of doing it. Never shown. */
const NOT_A_LINE = /\b(?:i(?:'m| am) sorry,? but i (?:can|am|will|won)|i apologi[sz]e,? but|(?:can(?:no|')?t|unable to|won'?t|will not|not able to) (?:(?:help|assist)(?: you)? with|comply|fulfil+|(?:continue|engage) (?:with|in)|(?:provide|generate|produce|write) (?:that|this|an?|the))|as an? (?:ai|assistant|language model)|here(?:'s| is) (?:the|my|your|an?) (?:json|response|answer|reply|output|result)|json|outcome|the user|(?:this|that|your) request)\b/i;

/**
 * Tolerant reader. In order: any whole JSON object in the text (chatter and
 * code fences around it are ignored, the usual damage is mended); then the
 * fields picked out one by one; then, if the model simply spoke, its words as
 * a reply that rules nothing. Null when nothing usable came back.
 */
export function parseAudienceReply(raw: unknown, depth = 0): RawAudienceReply | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[\u200b-\u200f\ufeff]/g, '').replace(/```[a-zA-Z]*[ \t]*/g, '').replace(/<\/?(?:json|answer|output|response)>/gi, '').trim();
  if (!text) return null;
  if (depth === 0 && /^"[\s\S]*\{[\s\S]*"$/.test(text)) {
    // the whole object sent as one JSON string
    try { const inner: unknown = JSON.parse(text); if (typeof inner === 'string') return parseAudienceReply(inner, 1); } catch { /* not that */ }
  }
  for (const piece of topObjects(text)) {
    const got = fromObject(tryJson(piece));
    if (got) return got;
  }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { const got = fromObject(tryJson(text.slice(a, b + 1))); if (got) return got; }
  const fields = fromFields(text);
  if (fields) return fields;
  // No JSON and no fields. If the model simply answered in character, keep the words.
  if (/[{}[\]]/.test(text) || text.length > 600 || NOT_A_LINE.test(text) || new RegExp(`(?:^|\\n)\\s*["']?(?:${KEY_ALT})["']?\\s*[:=]`, 'i').test(text)) return null;
  const spoken = text.split(/\n+/).map(x => x.trim()).filter(Boolean).join(' ');
  if (!/[a-z]{2}/i.test(spoken)) return null;
  return { reply: spoken, mood: null, outcome: null, oaths: [], revealed: [], salvaged: false, loose: true };
}

const MOOD_WORDS: Record<Mood, string> = {
  neutral: 'neutral calm composed flat polite thoughtful curious indifferent stoic deadpan patient matter_of_fact',
  pleased: 'pleased happy glad content relieved grateful hopeful satisfied thankful cheerful',
  delighted: 'delighted thrilled overjoyed elated joyful ecstatic jubilant',
  worried: 'worried anxious nervous concerned uneasy embarrassed sheepish apologetic hesitant uncertain confused baffled puzzled wary cautious',
  annoyed: 'annoyed irritated frustrated indignant defensive grudging resentful sour stubborn defiant offended exasperated impatient bitter',
  angry: 'angry furious outraged enraged livid irate',
  smug: 'smug proud sly confident amused triumphant haughty',
  sad: 'sad unhappy dejected disappointed crestfallen hurt wounded resigned mournful downcast melancholy',
  afraid: 'afraid scared frightened terrified fearful alarmed panicked',
};
const MOOD_OF: Record<string, Mood> = (() => {
  const out: Record<string, Mood> = {};
  for (const m of AUDIENCE_MOODS) for (const w of MOOD_WORDS[m].split(' ')) out[w] = m;
  return out;
})();

/** One of the nine moods from whatever the model wrote ("Relieved", "a little worried"), or null. */
export function readMood(raw: unknown): Mood | null {
  if (typeof raw !== 'string') return null;
  const ws = raw.toLowerCase().replace(/[^a-z\s_-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  for (let i = ws.length - 1; i >= 0; i--) { const m = MOOD_OF[ws[i]!]; if (m) return m; }
  return null;
}

/** Things no one in the realm would say. A reply containing any of them is discarded. */
const OUT_OF_WORLD = /\b(an? ai\b|ai (assistant|model|language)|language model|artificial intelligence|chat ?bot|large language|system prompt|json\b|video ?game|role-?play|out of character|in character|openai|anthropic|chatgpt|as an assistant|i cannot comply|i can(?:no|')t assist)\b/i;

export interface CleanOpts {
  max?: number;
  /** goblins, criers and heralds may keep their exclamation marks */
  loud?: boolean;
  /** a name the model may have prefixed its line with ("Marta: ...") */
  speakerFirst?: string;
}

/**
 * Make a model's line fit to show: one line, no dashes, no stage directions,
 * no shouting unless allowed, cut cleanly at a sentence under the cap.
 * Returns '' when the line breaks the fiction or nothing is left.
 */
export function cleanSpoken(text: unknown, opts: CleanOpts = {}): string {
  if (typeof text !== 'string') return '';
  const max = opts.max ?? REPLY_CAP;
  let t = text.slice(0, 4000);
  t = t.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]+/g, ' ');
  t = t.replace(/\*[^*]{0,80}\*/g, ' ').replace(/[*_`#]+/g, '');           // *sighs*, markdown
  t = t.replace(/\([^)]{0,60}\)/g, m => (/^\((?:sighs?|pause|laughs?|nods?|bows?|shrugs?|whispers?|aside|beat|smiles?|frowns?)\b/i.test(m) ? ' ' : m));
  t = t.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, '\'').replace(/\u2026/g, '...');
  t = t.replace(/\s*[\u2012\u2013\u2014\u2015]\s*/g, ', ').replace(/\s+--+\s+/g, ', ').replace(/\s+-\s+/g, ', ');
  t = t.replace(/\s+/g, ' ').trim();
  if (opts.speakerFirst) {
    const pre = new RegExp('^' + opts.speakerFirst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i');
    t = t.replace(pre, '');
  }
  t = t.replace(/^(petitioner|reply|answer)\s*:\s*/i, '');
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"') && t.indexOf('"', 1) === t.length - 1) t = t.slice(1, -1).trim();
  if (!opts.loud) t = t.replace(/\?!+/g, '?').replace(/!+\?/g, '?').replace(/!+/g, '.');
  else t = t.replace(/!{2,}/g, '!');
  t = t.replace(/,\s*([,.;:!?])/g, '$1').replace(/([.;:])\s*,/g, '$1').replace(/\.{4,}/g, '...').replace(/\s+([,.;:!?])/g, '$1').replace(/^[,;:.\s]+/, '').trim();
  if (!t || OUT_OF_WORLD.test(t)) return '';
  if (/^[{[]/.test(t) || /"?\b(?:reply|mood|outcome|oaths|revealed)"?\s*:/i.test(t)) return '';   // the answer's own scaffolding, spoken aloud
  if (t.length > max) {
    const head = t.slice(0, max);
    let cut = -1;
    for (const m of head.matchAll(/[.!?](?=\s|$)/g)) cut = m.index! + 1;
    if (cut >= Math.min(40, max * 0.3)) t = head.slice(0, cut);
    else {
      const sp = head.lastIndexOf(' ', max - 2);
      t = (sp > 20 ? head.slice(0, sp) : head.slice(0, max - 1)).replace(/[,;:\s]+$/, '') + '.';
    }
  }
  if (!/[a-z0-9]/i.test(t)) return '';
  t = t.trim();
  if (/[a-z0-9]$/i.test(t) && t.length < max) t += '.';
  return t;
}

/** A reply that was cut off mid-flow: keep only its finished sentences ('' if it has none). */
export function finishedSentences(text: string): string {
  let cut = -1;
  for (const m of text.matchAll(/[.!?]["']?(?=\s|$)/g)) cut = m.index! + m[0].length;
  return cut > 0 ? text.slice(0, cut).trim() : '';
}
