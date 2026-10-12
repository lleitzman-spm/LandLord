/**
 * The prompt for ruling by word: fixed instructions (system) plus, per
 * utterance, the digest, the listener's character sheet and the ruler's words.
 *
 * The model answers in strict JSON. It interprets and voices; it never decides
 * what is allowed. interpret.ts validates every move it proposes.
 */
import type { GameState, StaffRole, StaffMember, Tenant, JobKind, ActionType, DecisionType } from '../sim/types';
import { DECISION_OPTIONS, STAFF_ROLES } from '../sim/types';
import {
  TEMPERAMENT_DEFS, CHARACTERS, RANKS, BUILDINGS, MONTH_NAMES, TENANT_TAGS, SPECIES, ROLE_TITLES,
} from '../data';
import type { Species, TemperamentId } from '../data/ids';
import type { Exchange, ModelRequest, SpeakTarget } from './api';
import { buildDigest, happinessBand, monthsHoused, ref, DIGEST_CAP, DIGEST_CAP_LEAN } from './digest';
import { staffByRole, leaning, DECISION_ROLE, clip, mid } from './offline';

/** The only Action kinds a spoken order can mean. Buildings are placed by hand. */
export const SPOKEN_ACTIONS: ActionType[] = [
  'order_job', 'resolve_incident', 'set_rent', 'set_listed', 'collect_all', 'collect_purse', 'add_order', 'revoke_order',
  'set_policy', 'swear_oath', 'gift', 'hold_feast', 'hire', 'dismiss_staff', 'set_wage', 'rename_building',
];
/** The job kinds a spoken order can queue. */
export const SPOKEN_JOBS: JobKind[] = ['repair', 'renovate', 'show', 'screen', 'serve_notice', 'evict', 'inspect', 'visit'];

const DECISION_NOTE: Record<Exclude<DecisionType, 'custom'>, string> = {
  late_rent: 'rent unpaid after the grace days',
  eviction_ready: "the Reeve's Court has ruled against a household",
  repair: 'something broke',
  applicant: 'a household wants a vacancy',
  move_out_deposit: 'settling the surety when a household leaves',
  squatters: 'someone living in a vacancy unasked',
  pet: 'an undeclared animal',
  rent_renewal: 'a lease is ending',
};
const DECISIONS = Object.keys(DECISION_NOTE) as Exclude<DecisionType, 'custom'>[];

const EX_PLAIN = `The ruler, to the room: "Collect the rents and put Thistle Cottage up to 18."
{"speaker":"bailiff","reply":"Every purse, Sir. And Thistle Cottage goes to 18 crowns, which they will discuss at the well.","mood":"neutral","understood":true,"actions":[{"type":"collect_all"},{"type":"set_rent","buildingId":"#b4","rent":18}],"confirm":false}`;
const EX_LATITUDE = `The ruler, to a Bodger mason, with a leak open at the mill as matter #i9: "Hob, sort out the miller's roof before the rains."
{"speaker":"mason","reply":"The mill roof. A bit of thatch and a prayer, three crowns, and it will hold till the rains. Most likely, Sir.","mood":"neutral","understood":true,"actions":[{"type":"resolve_incident","incidentId":"#i9","outcomeId":"patch"}],"confirm":false}`;
const EX_ORDER = `The ruler, to an Iron bailiff: "Agnes, never evict a widow in winter."
{"speaker":"bailiff","reply":"No widows put out in winter. Spring is another matter. Is that your word, Sir?","mood":"annoyed","understood":true,"actions":[{"type":"add_order","order":{"to":"bailiff","text":"never evict a widow in winter","gist":"No widows out in winter. Spring is another matter.","decision":"eviction_ready","when":[{"field":"tenant.tags","op":"includes","value":"widow"},{"field":"season","op":"==","value":"winter"}],"rule":"never","option":"evict"}}],"confirm":true}`;
const EX_OATH = `The ruler, face to face with Marta Thistlewick (#t12) of the Leaning Hovel (#b7), on day 34 with winter beginning day 270: "You have my word, that roof will be mended before winter."
{"speaker":"tenant","reply":"Before winter. I shall tell the roof. It has heard promises before, Reeve, though never from you.","mood":"pleased","understood":true,"actions":[{"type":"swear_oath","oath":{"kind":"repair","text":"That roof will be mended before winter.","toTenantId":"#t12","toName":"Marta Thistlewick","buildingId":"#b7","dueDay":270}}],"confirm":false}`;
const EX_BY_HAND = `The ruler, to the room, with no one hired: "Build me a tavern by the well."
{"speaker":"herald","reply":"Buildings are placed by hand, Reeve. The court can only watch and, later, complain about the noise.","mood":"neutral","understood":true,"actions":[],"confirm":false}`;

const OUT_SHAPE = '{"speaker":"mason"|"bailiff"|"crier"|"steward"|"herald"|"tenant","reply":"...","mood":"neutral"|"pleased"|"delighted"|"worried"|"annoyed"|"angry"|"smug"|"sad"|"afraid","understood":true|false,"actions":[...],"confirm":true|false}';
const ORDER_SHAPE = '{"to":"mason"|"bailiff"|"crier"|"steward","text":the ruler\'s exact words for the rule,"gist":the listener\'s short read-back of it,"decision":D,"when":[Condition,...],"rule":"choose"|"never","option":O}';
const OATH_SHAPE = '{"kind":K,"text":the promise in the ruler\'s own words,"toTenantId":id or null,"toName":who it was sworn to,"buildingId":id or null,"buildingType":type or null,"amount":number or null,"dueDay":day number}';
const COND_SHAPE = '{"field":F,"op":"=="|"!="|"<"|"<="|">"|">="|"includes"|"excludes","value":V}';
const decisionTable = (notes: boolean): string => DECISIONS
  .map(d => ` ${d} (${notes ? DECISION_NOTE[d] + '; ' : ''}${DECISION_ROLE[d]}): ${DECISION_OPTIONS[d].join(' | ')}`).join('\n');

/** Fixed instructions. Static, so a server may cache it. */
export const ORDER_SYSTEM = `You are the hearing of a medieval court in LandLord, a dry comedy about rent in a world that also has griffins. The ruler rules by word: they speak, someone at court reads back what they understood, and then it is done.

Each turn gives you THE REALM (the world as it stands), THE LISTENER (who was spoken to and how they talk) and THE RULER'S WORDS. Do two things:
1. Work out which MOVES, from the fixed list below, the words amount to.
2. Write the listener's read-back: one short line, in character, saying what they understood and will do.
A rules engine checks every move and applies it or refuses it. Use only ids printed in THE REALM: they begin with #, copy them exactly. Never invent a number the ruler did not say (figures printed in THE REALM may be quoted). Never promise what the moves do not do.

OUTPUT
Reply with one JSON object and nothing else. No words before or after it. No code fence.
${OUT_SHAPE}
"speaker" is who answers: THE LISTENER says who may. "mood" is theirs.

MOVES (the only shapes allowed in "actions")
{"type":"order_job","kind":"repair"|"renovate"|"inspect","buildingId":id}  mend it | restore a ruin completely | look it over
{"type":"order_job","kind":"serve_notice"|"evict"|"visit"|"screen","tenantId":id}  nail a Notice to Quit | put them out | the ruler calls in person | ask their last landlord
{"type":"order_job","kind":"show"|"screen","applicantId":id}  show a waiting applicant round | ask their last landlord
{"type":"resolve_incident","incidentId":id,"outcomeId":"..."}  settle a matter listed under MATTERS with one of ITS OWN outcomes
{"type":"set_rent","buildingId":id,"rent":number}  asking rent per month
{"type":"set_listed","buildingId":id,"listed":true|false}  cry a vacancy as to let, or stop
{"type":"collect_all"}  send round for every purse waiting at a door
{"type":"collect_purse","buildingId":id}  one door only
{"type":"set_policy","policy":{...}}  any of "graceDays" 0-30, "lateFeePct" 0-100, "depositMonths" 0-6, "askPct" 50-200, "renewalCapPct" 0-100, "pets" "allow"|"pet_rent"|"ban", "screening" "never"|"always"
{"type":"add_order","order":{...}}  see STANDING ORDERS
{"type":"revoke_order","orderId":id}
{"type":"swear_oath","oath":{...}}  see OATHS
{"type":"gift","tenantId":id,"amount":number}  crowns from the coffers to a household
{"type":"hold_feast"}
{"type":"hire","candidateId":id}
{"type":"dismiss_staff","staffId":id}
{"type":"set_wage","staffId":id,"wage":number}
{"type":"rename_building","buildingId":id,"name":"..."}
Nothing else exists. You cannot build, place or pull down anything, lay roads or buy land: buildings are placed by hand. The listener says so, with "actions":[].
Several orders in one breath are several moves, in order. Where a matter is open at the place or household the ruler means, settle it with resolve_incident and the fitting outcome, not a bare order_job.

STANDING ORDERS
"Always", "never", "from now on", "whenever": a rule said once, which holds until revoked.
"order":${ORDER_SHAPE}
"choose": whenever D comes up and every condition holds, take O. "never": O is forbidden then. "to" is whose trade D is. "gist" stays under 80 characters.
D (what it is; whose trade): the options O
${decisionTable(true)}
Condition: ${COND_SHAPE}. All must hold. [] means always.
 "season": spring | summer | autumn | winter. "month": 0-11, 0 being ${MONTH_NAMES[0]}
 "tenant.species": ${SPECIES.join(' | ')}
 "tenant.tags" (op "includes" or "excludes"): ${TENANT_TAGS.join(' | ')}
 "tenant.traits" (op "includes" or "excludes"), "tenant.trade", "tenant.name", "building.type", "building.id": as THE REALM writes them
 "tenant.arrears", "tenant.daysLate", "tenant.monthsHoused", "tenant.happiness" (0-100), "tenant.household" (heads under the roof), "building.condition" (0-100), "building.rent", "gold", "renown", "cost" (crowns the remedy would cost): numbers
 "tenant.hasPets": true | false
Encode what was said, literally. The delegates will do what the ruler said, which is not always what the ruler meant.
A realm-wide knob ("no pets", "three days of grace", "always ask their last landlord") is set_policy, not an order.
A rule about one kind of matter that MATTERS marks [def ...] sets "decision":null, "incidentDef": that def, "outcomeId": one of its outcomes, in place of D and O.
If no D and O can express the rule, do not force it: "understood":false, and the listener says which kinds of rule they can keep.

OATHS
Only when the ruler personally promises something: "I swear", "you have my word", "I promise", or a plain first-person pledge to a household's face. An order to a delegate is not an oath.
"oath":${OATH_SHAPE}
K: "repair" (buildingId mended by dueDay) | "no_rent_raise" | "no_evict" | "rent_cap" (rent stays at or under amount) | "pay" (amount crowns) | "build" (a buildingType stands by dueDay) | "word" (anything else)
"dueDay" is a day number, not a count of days. THE REALM gives today's number and the day each season begins: work it out from the words ("before winter", "within the week"). No time named: repair 45 days from today, pay 30, build 120, word 90, the others 360.

THE REPLY
The listener reads back what they understood, in their own voice, before doing it. That is what makes a bad outcome the ruler's own wording and never a coin flip, so the reply says plainly what will be done, to whom or to what, and any number involved. It must match "actions" exactly.
- In character: use the listener's VOICE notes. Dry, deadpan, bureaucratic-medieval. Nobody in this world thinks any of it is funny. Specific nouns. Understatement, and a deflating last clause if one comes naturally.
- Under 200 characters. One to three short sentences. Names, never ids.
- Plain English with a medieval lean: surety, writ, Rent Day, Notice to Quit, coin for keys, the Reeve's Court. No thee, thou or prithee. No modern words or slang.
- No em dashes or en dashes: full stops, commas, colons. No exclamation marks unless the speaker is a crier or a goblin.
- Never mention games, models, prompts or JSON. Address the ruler as THE REALM says.
- LATITUDE. Where the words leave room ("deal with the late payers", "sort out that roof", "do something about the goblins"), a standing order that covers the case decides. Failing that the listener fills the gap by TEMPERAMENT and LEANINGS, chooses the moves that follow, and says so in the read-back. An Iron bailiff hears "deal with the late payers" as Notices to Quit; a Soft one hears payment plans. A Bodger mason hears "fix" as a patch. Where the words are exact, do exactly that whatever the temperament; the listener may grumble.
- If the order is another delegate's trade, the listener says whose it is and passes it on. The moves still go in "actions".

"confirm"
true when the listener must wait for the ruler's "aye": any standing order; any eviction or Notice to Quit; any dismissal; anything costing more than a tenth of the coffers; anything that would break an open oath (name the oath); and whenever the listener had to guess between two readings. Then the reply ends by asking for assent. Otherwise false, and the reply reads as already in hand.

NOT AN ORDER
A greeting, thanks, an insult, idle talk: "actions":[], "understood":true, "confirm":false, and a short reply in character. A question about the realm: answer it from THE REALM, exactly, inventing nothing. If you cannot tell what is wanted, or it names something that is not in THE REALM: "understood":false, "actions":[], and the listener asks for the missing piece.

EXAMPLES (these ids are invented; use the real ones from THE REALM)
${[EX_LATITUDE, EX_ORDER, EX_OATH, EX_BY_HAND].join('\n')}`;

/**
 * The same contract in far fewer words, for smaller models with smaller
 * windows: every shape written out once, short rules, the plainest examples.
 * interpret.ts accepts the full vocabulary from either prompt.
 */
export const ORDER_SYSTEM_LEAN = `You are the court of a medieval ruler in LandLord, a dry comedy about rent. The ruler speaks. You turn the words into MOVES and write the listener's short read-back, in character.
Use only ids printed in THE REALM: they begin with #, copy them exactly. Never invent a number.

Reply with ONE JSON object and nothing else:
${OUT_SHAPE}

MOVES (the only things "actions" may hold)
{"type":"order_job","kind":"repair"|"renovate"|"inspect","buildingId":id}
{"type":"order_job","kind":"serve_notice"|"evict"|"visit"|"screen","tenantId":id}
{"type":"order_job","kind":"show"|"screen","applicantId":id}
{"type":"resolve_incident","incidentId":id,"outcomeId":"..."}  settle a MATTER with one of its own outcomes
{"type":"set_rent","buildingId":id,"rent":number}
{"type":"set_listed","buildingId":id,"listed":true|false}  cry a vacancy as to let, or stop
{"type":"collect_all"}  every purse waiting at a door
{"type":"set_policy","policy":{...}}  only the keys that change: "graceDays", "lateFeePct", "depositMonths", "pets" "allow"|"pet_rent"|"ban", "screening" "never"|"always"
{"type":"add_order","order":${ORDER_SHAPE}}
{"type":"revoke_order","orderId":id}
{"type":"swear_oath","oath":${OATH_SHAPE}}
{"type":"gift","tenantId":id,"amount":number}
{"type":"hold_feast"}
{"type":"hire","candidateId":id}
{"type":"dismiss_staff","staffId":id}
{"type":"set_wage","staffId":id,"wage":number}
You cannot build, pull down, lay roads or buy land: buildings are placed by hand. Say so, with "actions":[].
If a MATTER is open at the place or household meant, settle it with resolve_incident.

STANDING ORDER ("always", "never", "from now on"): add_order. "choose": always take option O when decision D comes up. "never": O is forbidden.
D (whose trade): O
${decisionTable(false)}
Condition: ${COND_SHAPE}. No conditions: [].
F: "season" (spring|summer|autumn|winter), "tenant.species" (${SPECIES.join('|')}), "tenant.tags" (op "includes": ${TENANT_TAGS.join('|')}), "tenant.arrears", "tenant.daysLate", "tenant.monthsHoused", "tenant.hasPets", "building.type", "cost".
A realm-wide knob ("no pets", "three days of grace") is set_policy, not an order.

OATH: swear_oath, only when the ruler personally promises ("I swear", "you have my word", "I promise"). K: repair | no_rent_raise | no_evict | rent_cap | pay | build | word. "dueDay" is a day number worked out from TODAY in THE REALM ("before winter" is the day winter begins). No time named: today plus 45 for a repair, plus 30 for pay, plus 360 otherwise.

THE REPLY: the listener reads back what they understood and will do, in their own VOICE. Dry, deadpan, medieval. Under 200 characters. Names, never ids. No em dashes, no exclamation marks, no modern words. Address the ruler as THE REALM says.
Where the words leave room ("deal with the late payers"), a standing order decides. Failing that the listener follows their TEMPERAMENT and LEANINGS and says so: an Iron bailiff serves notices, a Soft one offers payment plans.
"confirm": true for a standing order, an eviction or Notice to Quit, a dismissal, spending over a tenth of the coffers, or anything against an open oath. The reply then ends by asking. Otherwise false.
Not an order (a greeting, a question, an insult): "actions":[] and a short reply in character. Answer questions from THE REALM. If you cannot tell what is wanted: "understood":false, "actions":[], and ask.

EXAMPLES (invented ids)
${[EX_PLAIN, EX_ORDER, EX_OATH].join('\n')}`;

// ───────────────────────── the listener's character sheet ─────────────────────────

const ROLE_DUTY: Record<StaffRole, string> = {
  mason: 'repairs and building work',
  bailiff: 'collections, notices, evictions, squatters',
  crier: 'filling vacancies: crying them as to let, showing applicants round',
  steward: 'the books: rents, policies, screening, sureties, wages, gifts and feasts',
};
const ROLE_VOICE: Record<StaffRole, string> = {
  mason: 'Sucks teeth, names a price, blames the previous mason.',
  bailiff: 'Speaks of doors, knocks, writs and what is owed. Counts days aloud.',
  crier: 'Announces rather than says. Every vacancy is an opportunity.',
  steward: 'Speaks in sums, entries and forms. Knows what everything costs.',
};
/** From docs/STYLE.md, for when a temperament's own sheet is thin. */
const TEMPER_NOTE: Record<TemperamentId, string> = {
  perfectionist: 'slow and proud; will not be hurried', bodger: 'fast; "it will hold"', dreamer: 'adds gargoyles nobody asked for', steady: 'says little, shows up',
  iron: 'court-first; relishes the knock', soft: 'asks about their mother; forgives', grasping: 'fees, and some stick to the fingers', lawful: 'the letter of the charter, to the day',
  honeytongue: 'oversells: "river views" of a ditch', honest: '"it leaks, but only when it rains"', snob: 'only "persons of quality"', bellower: 'LOUD; the neighbours complain',
  pennypincher: 'begrudges every nail', openhanded: 'generous with your money', bythebook: 'forms, in order', schemer: 'clever; loyal mostly to the plan',
};
const HERALD_SHEET = 'herald: the court clerk who keeps the roll. Tired, exact, perfectly composed. Reports a goblin committee the way a clerk reports a late filing.';
const SPECIES_NOTE: Record<Species, string> = {
  human: 'Humans as tenants: the baseline mess. Excuses, feuds over fences, chickens.',
  halfling: 'Halflings as tenants: model tenants obsessed with food and comfort. Pay in full with a seed cake. Sublet the pantry.',
  dwarf: 'Dwarves as tenants: contract literalists and compulsive renovators. Pay to the minute. Anything built after their grandfather is "new build, shoddy".',
  goblin: 'Goblins as tenants: officious lovers of bureaucracy. Forms, stamps, committees, receipts in triplicate. Scrupulous about rules they made up. They may use exclamation marks.',
  elf: 'Elves as tenants: insufferably long-term. Want 400-year leases. Polite in a way that feels like being marked down.',
  ogre: 'Ogres as tenants: enormous, gentle, mortified by the damage they cause. Apologise to doorframes.',
};

function leanings(s: GameState, role: StaffRole): string {
  const out: string[] = [];
  for (const d of Object.keys(DECISION_ROLE) as DecisionType[]) {
    if (d === 'custom') continue;
    const l = leaning(s, role, d);
    if (l.length && (DECISION_ROLE[d] === role || (role === 'steward' && d === 'late_rent'))) out.push(`${d}: ${l.join(' > ')}`);
  }
  return out.join('; ');
}

function staffSheet(s: GameState, m: StaffMember, full: boolean): string {
  const t = TEMPERAMENT_DEFS[m.temperament];
  const name = t?.name || m.temperament;
  const head = `${m.role}: ${m.name} ("${m.first}"), ${m.species}. Trade: ${ROLE_DUTY[m.role]}.`;
  const note = TEMPER_NOTE[m.temperament] ?? '';
  const temper = t?.blurb ? `Temperament: ${name}${t.epithet ? ', ' + t.epithet : ''}. ${t.blurb}` : `Temperament: ${name}${t?.epithet ? ', ' + t.epithet : ''} (${note}).`;
  const voice = `Voice: ${t?.voice || ROLE_VOICE[m.role]}`;
  const lean = leanings(s, m.role);
  if (!full) return ` ${head} ${temper} ${clip(voice, 260)}${lean ? ` Leanings: ${lean}.` : ''}`;
  return [
    ` ${head}`, ` ${temper}`, ` ${voice}`,
    t?.quirk ? ` Left to their own judgment: ${t.quirk}` : '',
    lean ? ` Leanings where an order leaves room: ${lean}.` : '',
    m.species === 'goblin' ? ' Being a goblin, they may use exclamation marks.' : '',
  ].filter(Boolean).join('\n');
}

function tenantSheet(s: GameState, t: Tenant): string {
  const ch = t.character ? CHARACTERS.find(c => c.id === t.character) : undefined;
  const home = t.buildingId ? s.buildings[t.buildingId] : null;
  const lines = [
    ` ${t.name} (${ref(t.id)}), ${t.species} ${t.trade.replace(/_/g, ' ')}, household of ${t.household}${t.tags.length ? ', ' + t.tags.map(x => x.replace(/_/g, ' ')).join(', ') : ''}. ${happinessBand(t.happiness).replace(/^./, ch => ch.toUpperCase())} just now.`,
    home ? ` Lives in ${mid(home.name)} (${ref(home.id)}), ${monthsHoused(t, s.day) === 1 ? '1 month' : monthsHoused(t, s.day) + ' months'}, rent ${t.lease?.rent ?? 0}${t.arrears > 0 ? `, owes ${t.arrears}` : ''}.` : '',
    ` ${SPECIES_NOTE[t.species]}`,
    ch ? ` Who they are: ${ch.bio}` : '',
    ch ? ` Voice: ${ch.voice}` : '',
    t.memory.length ? ` What they remember of the ruler: ${t.memory.slice(-4).map(m => `"${clip(m.text, 90)}"`).join(' ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function courtSheet(s: GameState, lean: boolean): string {
  const hired = STAFF_ROLES.map(r => staffByRole(s, r)).filter((m): m is StaffMember => !!m);
  return [...hired.map(m => staffSheet(s, m, !lean && hired.length <= 2)), ` ${HERALD_SHEET}`].join('\n');
}

/** Who was spoken to, how they talk, and who may answer. */
export function listenerBlock(s: GameState, target: SpeakTarget, lean = false): string {
  const rank = RANKS[s.realm.rank];
  if ('tenantId' in target) {
    const t = s.tenants[target.tenantId];
    if (t) {
      return [
        'THE LISTENER',
        'The ruler is speaking to a household, face to face. "You" and "your" mean them. For a promise, a gift, a warning or plain talk, set "speaker": "tenant" and answer as the head of that household would, remembering what they remember.',
        tenantSheet(s, t),
        'If instead the words are an order for a delegate, said in front of the tenant, that delegate (or the herald) reads it back:',
        courtSheet(s, lean),
      ].join('\n');
    }
  }
  if ('buildingId' in target) {
    const b = s.buildings[target.buildingId];
    if (b) {
      return [
        'THE LISTENER',
        `The ruler pointed at ${ref(b.id)} ${b.name} (${BUILDINGS[b.type].name.toLowerCase()}) and spoke. "This", "here", "it" and "that" mean that building. Whoever's trade the order is answers: set "speaker" to their role. If it is nobody's trade, or the post is empty, the herald answers and the ruler will do the work in person.`,
        courtSheet(s, lean),
      ].join('\n');
    }
  }
  if ('to' in target && target.to !== 'court') {
    const m = staffByRole(s, target.to);
    if (m) {
      const others = STAFF_ROLES.filter(r => r !== m.role).map(r => staffByRole(s, r)).filter((x): x is StaffMember => !!x);
      return [
        'THE LISTENER',
        `The ruler spoke to ${m.first}, the ${ROLE_TITLES[m.role]}. Set "speaker": "${m.role}".`,
        staffSheet(s, m, true),
        others.length ? ` Also at court (the listener hands an order on to them when it is their trade, and says so): ${others.map(o => `${o.first} the ${ROLE_TITLES[o.role]} (${TEMPERAMENT_DEFS[o.temperament]?.name || o.temperament})`).join(', ')}.` : ' No one else is hired.',
      ].join('\n');
    }
    return [
      'THE LISTENER',
      `The ruler called for the ${ROLE_TITLES[target.to]}, but that post is empty${rank.staff.includes(target.to) || s.realm.rank !== 'reeve' ? '' : ' at this rank'}. The herald answers, says so drily, and the order still stands if it can be done: the ruler will do the work in person. Set "speaker": "herald".`,
      ` ${HERALD_SHEET}`,
    ].join('\n');
  }
  return [
    'THE LISTENER',
    'The ruler spoke to the room. Whoever\'s trade the order is answers: set "speaker" to their role. If it is nobody\'s trade, or that post is empty, the herald answers and the ruler will do the work in person.',
    courtSheet(s, lean),
  ].join('\n');
}

function addressee(s: GameState, target: SpeakTarget): string {
  if ('tenantId' in target) return `to ${s.tenants[target.tenantId]?.name ?? 'a household'}`;
  if ('buildingId' in target) return `about ${mid(s.buildings[target.buildingId]?.name ?? 'a building')}`;
  if (target.to === 'court') return 'to the room';
  const m = staffByRole(s, target.to);
  return m ? `to ${m.first}, the ${ROLE_TITLES[m.role]}` : `calling for the ${ROLE_TITLES[target.to]}`;
}

const STATUS_NOTE: Record<Exchange['status'], string> = {
  done: 'done', needs_confirm: 'awaiting the ruler\'s aye', refused: 'refused by the rules', unclear: 'not understood, or the ruler said nay', error: 'not heard',
};

/** The ruler's words, made safe to quote: one line, bounded. */
export function cleanUtterance(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500);
}

export interface OrderPromptOpts {
  /** recent exchanges, newest last: gives "it", "them" and "nay, I meant" something to point at */
  recent?: Exchange[];
  tier?: 'quick' | 'default';
  /** a smaller model answers: the short instructions, a tighter digest */
  lean?: boolean;
}

/** The exact request for one utterance: fixed system text, and one user turn carrying the realm, the listener and the words. */
export function buildOrderPrompt(s: GameState, text: string, target: SpeakTarget, opts: OrderPromptOpts = {}): ModelRequest {
  const said = cleanUtterance(text), lean = opts.lean === true;
  const parts = ['THE REALM', buildDigest(s, target, said, lean ? DIGEST_CAP_LEAN : DIGEST_CAP), '', listenerBlock(s, target, lean)];
  const recent = (opts.recent ?? []).filter(e => s.day - e.day < 6).slice(lean ? -1 : -2);
  if (recent.length) {
    parts.push('', 'JUST BEFORE THIS (so that "it", "them" and "nay, I meant" have something to point at)');
    for (const e of recent) parts.push(` The ruler: "${clip(cleanUtterance(e.text), 140)}" ${e.speaker.name}: "${clip(e.reply, 160)}" (${STATUS_NOTE[e.status]})`);
  }
  // the last thing a model reads is the thing it does: the words, then the shape of the answer
  parts.push('', `THE RULER'S WORDS (${addressee(s, target)})`, `"${said}"`, '', 'Answer with the one JSON object: {"speaker","reply","mood","understood","actions","confirm"}. Nothing else.');
  return { system: lean ? ORDER_SYSTEM_LEAN : ORDER_SYSTEM, messages: [{ role: 'user', content: parts.join('\n') }], maxTokens: 600, tier: opts.tier ?? 'quick' };
}
