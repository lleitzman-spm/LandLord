/**
 * word-audience tests: audience sessions, the petitioner's prompt, the
 * offline ear, and the microphone.
 *
 *   npx tsx test/word-audience.test.ts
 *
 * Sessions are driven by a scripted ModelClient against a small stand-in
 * court (real incident validation, a real ledger of oaths) built on the dev
 * fixture, so nothing here depends on the sim modules other agents own.
 *
 * The scripted model plays three parts: a good one (clean JSON), a hostile
 * one (invented rulings, invented oaths, 5,000 characters), and a small one
 * (chatter around the JSON, single quotes, half an object, plain speech,
 * rulings heard where none was given).
 */
import assert from 'node:assert/strict';
import { makeFixtureState } from '../src/dev/fixture';
import { INCIDENTS, INCIDENT_BY_ID, RANKS } from '../src/data';
import type { IncidentDef } from '../src/data/schema';
import type { Action, ActionResult, GameState, Incident, Oath, Tenant } from '../src/sim/types';
import type { AudienceSession, ModelClient, ModelRequest, WordDeps } from '../src/word/api';
import {
  openAudienceSession, matchOutcomeOffline, resolveCast, audienceVars, fillSpoken, numbersIn, monthsIn,
  oathsInSpeech, outcomeFeeling, MAX_RULER_TURNS,
} from '../src/word/audience';
import { buildAudiencePrompt, parseAudienceReply, readMood, cleanSpoken, SPECIES_NOTES, REPLY_CAP } from '../src/word/audience-prompt';
import { createMic, type MicScope, type RecCtor } from '../src/word/mic';
import { stageIncident, rankFor, auditOfflineEar } from '../tools/audience-harness';

const EM = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
const DASH = new RegExp('[' + EM + EN + ']');

// ───────────────────────────── a stand-in court ─────────────────────────────

interface Court { state: GameState; deps: WordDeps; log: Action[]; of(type: Action['type']): Action[] }

function court(state: GameState, refuse?: (a: Action) => string | null): Court {
  const log: Action[] = [];
  let n = 1;
  const no = (reason: string): ActionResult => ({ ok: false, code: 'invalid', reason });
  const deps: WordDeps = {
    getState: () => state,
    dispatch(a: Action): ActionResult {
      log.push(a);
      const why = refuse?.(a);
      if (why) return { ok: false, code: 'blocked', reason: why };
      switch (a.type) {
        case 'resolve_incident': {
          const inc = state.incidents[a.incidentId];
          const def = inc ? INCIDENT_BY_ID[inc.defId] : undefined;
          const o = def?.outcomes.find(x => x.id === a.outcomeId);
          if (!inc || inc.state !== 'open') return no('That matter is closed.');
          if (!o) return no('No such ruling exists.');
          inc.state = o.job ? 'in_progress' : 'resolved'; inc.outcomeId = o.id; inc.resolvedBy = 'ruler';
          for (const e of o.effects) {
            if (e.t === 'lease' && inc.applicantId && state.applicants[inc.applicantId]) {
              const ap = state.applicants[inc.applicantId]!;
              if (e.accept) {
                const b = state.buildings[ap.buildingId]!;
                const t: Tenant = {
                  ...ap.household, status: 'housed', buildingId: b.id, unit: ap.unit, happiness: 60,
                  lease: { rent: Math.round(b.rent * (e.rentPct ?? 100) / 100), startDay: state.day, termMonths: 12, deposit: b.rent },
                  movedInDay: state.day, arrears: 0, daysLate: 0, lateStage: 'none', plan: null, courtDay: null, memory: [], wear: 0, leftDay: null,
                };
                state.tenants[t.id] = t;
                b.units[ap.unit]!.tenantId = t.id;
              }
              delete state.applicants[ap.id];
            }
          }
          return { ok: true };
        }
        case 'swear_oath': {
          const o: Oath = { ...a.oath, id: 'wt' + n++, madeDay: state.day, state: 'open', settledDay: null };
          state.oaths.push(o);
          return { ok: true, id: o.id };
        }
        case 'reveal_trait': {
          const t = state.tenants[a.tenantId];
          if (!t) return { ok: false, code: 'not_found', reason: 'No such household.' };
          if (t.traits.includes(a.trait) && !t.revealed.includes(a.trait)) t.revealed.push(a.trait);
          return { ok: true };
        }
        case 'remember': {
          const t = state.tenants[a.tenantId];
          if (!t) return { ok: false, code: 'not_found', reason: 'No such household.' };
          t.memory.push({ day: state.day, text: a.text, valence: a.valence });
          return { ok: true };
        }
        default: return { ok: true };
      }
    },
  };
  return { state, deps, log, of: type => log.filter(a => a.type === type) };
}

type Script = string | Error | ((req: ModelRequest) => string | Promise<string>);
interface Scripted extends ModelClient { requests: ModelRequest[]; left(): number }

function scripted(replies: Script[], kind: 'server' | 'claude' = 'server'): Scripted {
  const requests: ModelRequest[] = [];
  const queue = replies.slice();
  return {
    kind, requests, left: () => queue.length,
    async complete(req) {
      requests.push(req);
      const next = queue.shift();
      if (next === undefined) throw new Error('the scripted model has nothing more to say');
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next(req) : next;
    },
  };
}
const OFFLINE: ModelClient = { kind: 'none', async complete() { throw new Error('offline'); } };
const answer = (o: { reply: string; mood?: string; outcome?: string | null; oaths?: unknown[]; revealed?: string[] }): string =>
  JSON.stringify({ reply: o.reply, mood: o.mood ?? 'neutral', outcome: o.outcome ?? null, oaths: o.oaths ?? [], revealed: o.revealed ?? [] });

interface Scene { c: Court; inc: Incident; def: IncidentDef; session: AudienceSession; changes: { n: number } }
function scene(defId: string, model: ModelClient, opts: { rank?: 'reeve' | 'knight' | 'baron'; refuse?: (a: Action) => string | null } = {}): Scene {
  const def = INCIDENT_BY_ID[defId];
  assert.ok(def, `incident ${defId} exists`);
  const state = makeFixtureState(opts.rank ?? rankFor(def));
  const inc = stageIncident(state, defId);
  assert.ok(inc, `could stage ${defId}`);
  const c = court(state, opts.refuse);
  const changes = { n: 0 };
  const session = openAudienceSession(inc.id, c.deps, () => model, () => { changes.n++; });
  assert.ok(session, `session opened for ${defId}`);
  return { c, inc, def, session, changes };
}
const types = (c: Court): string[] => c.log.map(a => a.type);

// ───────────────────────────── a tiny runner ─────────────────────────────

const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>): void => { tests.push([name, fn]); };
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// ───────────────────────────── opening a session ─────────────────────────────

test('opens only on an open incident, with speaker, opening and whispers', () => {
  const state = makeFixtureState('knight');
  const c = court(state);
  assert.equal(openAudienceSession('nope', c.deps, () => OFFLINE, () => undefined), null);
  const griffin = Object.values(state.incidents).find(i => i.defId === 'unauthorized_griffin')!;
  const def = INCIDENT_BY_ID.unauthorized_griffin!;
  const s1 = openAudienceSession(griffin.id, c.deps, () => OFFLINE, () => undefined)!;
  const s2 = openAudienceSession(griffin.id, c.deps, () => OFFLINE, () => undefined)!;
  assert.ok(s1 && s2);
  const tenant = state.tenants[griffin.tenantId!]!;
  assert.equal(s1.title, 'The Unauthorized Griffin');
  assert.equal(s1.speaker.kind, 'tenant');
  assert.equal(s1.speaker.name, tenant.name);
  assert.equal(s1.speaker.tenantId, tenant.id);
  assert.equal(s1.speaker.portraitSeed, tenant.portraitSeed);
  assert.equal(s1.lines.length, 1);
  assert.equal(s1.lines[0]!.who, 'petitioner');
  assert.ok(def.opening!.includes(s1.lines[0]!.text), 'the first line is one of the written openings');
  assert.equal(s1.lines[0]!.text, s2.lines[0]!.text, 'the opening is chosen stably by incident id');
  assert.deepEqual(s1.whispers.map(w => w.outcomeId), def.outcomes.map(o => o.id));
  assert.equal(s1.whispers[0]!.label, 'Charge pet rent and a surety');
  assert.ok(!s1.busy && !s1.done && s1.outcomeId === null);
  griffin.state = 'resolved';
  assert.equal(openAudienceSession(griffin.id, c.deps, () => OFFLINE, () => undefined), null, 'a settled incident opens no audience');
});

test('placeholders are filled, and {title} becomes the form of address', () => {
  const { session, c } = scene('sys_late_rent', OFFLINE, { rank: 'baron' });
  for (const l of session.lines) assert.ok(!/[{}]/.test(l.text), l.text);
  for (const w of session.whispers) assert.ok(!/[{}]/.test(w.label + w.say), w.say);
  assert.equal(RANKS[c.state.realm.rank].address, 'my lord');
  assert.equal(fillSpoken('{title}, about the rent. Bless you, {title}.', { title: 'Baron' }, 'my lord'), 'My lord, about the rent. Bless you, my lord.');
  assert.equal(fillSpoken('About the rent, {title}.', {}, 'Sir'), 'About the rent, Sir.');
  const t = session.choose('payment_plan');
  assert.equal(t.reply, 'In pieces. Yes. I can do pieces. Bless you, my lord.');
});

test('who comes to the seat: tenant, applicant, court character, neighbour, delegate, clerk', () => {
  const state = makeFixtureState('knight');
  const goblins = Object.values(state.incidents).find(i => i.defId === 'sys_squatters_goblins')!;
  const chief = resolveCast(state, goblins, INCIDENT_BY_ID.sys_squatters_goblins!);
  assert.equal(chief.speaker.kind, 'npc');
  assert.equal(chief.speaker.npc, 'goblin_chief');
  assert.equal(chief.speaker.species, chief.npc!.species);
  assert.equal(chief.tenant, null);

  const app = stageIncident(state, 'sys_applicant')!;
  const jory = resolveCast(state, app, INCIDENT_BY_ID.sys_applicant!);
  assert.equal(jory.speaker.kind, 'applicant');
  assert.equal(jory.speaker.name, 'Jory Applewhite');
  assert.equal(jory.speaker.applicantId, app.applicantId);
  assert.equal(audienceVars(state, app, jory).tenant, 'Jory Applewhite');

  const griffin = Object.values(state.incidents).find(i => i.defId === 'unauthorized_griffin')!;
  const base = INCIDENT_BY_ID.unauthorized_griffin!;
  const nb = resolveCast(state, griffin, { ...base, petitioner: 'neighbor' });
  assert.equal(nb.speaker.kind, 'tenant');
  assert.notEqual(nb.speaker.tenantId, griffin.tenantId, 'a neighbour is somebody else');
  assert.equal(nb.subject!.id, griffin.tenantId);
  assert.ok(nb.speaker.mood === 'annoyed' || nb.speaker.mood === 'angry');
  assert.equal(resolveCast(state, griffin, { ...base, petitioner: 'neighbor' }).speaker.tenantId, nb.speaker.tenantId, 'and always the same somebody');

  const st = resolveCast(state, { ...griffin, vars: { ...griffin.vars, staff: 'Agnes Ironknock' } }, { ...base, petitioner: 'staff' });
  assert.equal(st.speaker.kind, 'staff');
  assert.equal(st.speaker.role, 'bailiff');
  assert.equal(st.speaker.name, 'Agnes Ironknock');

  const rival = resolveCast(state, goblins, { ...INCIDENT_BY_ID.sys_squatters_goblins!, petitioner: { npc: 'rival_lord' } });
  assert.equal(rival.speaker.name, state.rival.name, 'the rival lord carries the name the sim rolled');
  assert.equal(rival.speaker.portraitSeed, state.rival.portraitSeed);

  const clerk = resolveCast(state, { ...goblins, tenantId: null }, { ...INCIDENT_BY_ID.sys_repair_leak!, petitioner: undefined });
  assert.equal(clerk.speaker.kind, 'herald');
});

// ───────────────────────────── with a model ─────────────────────────────

test('griffin: a ruling on the first turn resolves, remembers and closes', async () => {
  const model = scripted([answer({ reply: 'Pet rent for Gerald. Done. He will be so proud.', mood: 'delighted', outcome: 'pet_rent' })]);
  const { session, c, inc, changes } = scene('unauthorized_griffin', model);
  const p = session.say('He stays. But he pays pet rent, and you post a surety.');
  assert.equal(session.busy, true, 'busy while the petitioner thinks');
  const turn = await p;
  assert.equal(turn.via, 'model');
  assert.equal(turn.done, true);
  assert.equal(turn.outcomeId, 'pet_rent');
  assert.equal(turn.reply, 'Pet rent for Gerald. Done. He will be so proud.');
  assert.equal(turn.mood, 'delighted');
  assert.equal(turn.resultText, 'Gerald the griffin now pays pet rent at Mudlark Hovel. The roof has been reinforced, by Gerald, by sitting on it.');
  assert.deepEqual(types(c), ['resolve_incident', 'remember']);
  assert.deepEqual(c.log[0], { type: 'resolve_incident', incidentId: inc.id, outcomeId: 'pet_rent' });
  const mem = c.log[1] as Extract<Action, { type: 'remember' }>;
  assert.equal(mem.tenantId, inc.tenantId);
  assert.ok(mem.valence > 0, 'a ruling they wanted is remembered kindly');
  assert.match(mem.text, /The Unauthorized Griffin/);
  assert.match(mem.text, /Charge pet rent and a surety/);
  assert.ok(!DASH.test(mem.text));
  assert.ok(session.done && !session.busy && session.outcomeId === 'pet_rent');
  assert.equal(session.speaker.mood, 'delighted');
  assert.deepEqual(session.lines.map(l => l.who), ['petitioner', 'ruler', 'petitioner']);
  assert.ok(changes.n >= 2, 'listeners hear about it');
  const again = await session.say('And another thing.');
  assert.equal(again.reply, '');
  assert.equal(again.done, true);
  assert.equal(model.requests.length, 1, 'a closed audience asks the model nothing');
});

test('the prompt carries the person, the matter, the realm, the rules and the talk so far', async () => {
  const model = scripted([answer({ reply: 'He is more of a large cat, Sir.' })]);
  const { session, c, inc, def } = scene('unauthorized_griffin', model);
  const tenant = c.state.tenants[inc.tenantId!]!;
  tenant.memory.push({ day: 3, text: 'You mended the roof the same day they asked.', valence: 1 }, { day: 20, text: 'You kept them waiting a month over the well.', valence: -2 });
  await session.say('What does the beast eat?');
  const req = model.requests[0]!;
  assert.equal(req.messages.length, 1);
  assert.equal(req.messages[0]!.role, 'user');
  assert.equal(req.tier, 'quick');
  const sys = req.system, user = req.messages[0]!.content;
  assert.ok(sys.includes(tenant.name) && sys.includes(`"${tenant.first}"`));
  assert.ok(sys.includes(SPECIES_NOTES[tenant.species]), 'the species note from the style guide');
  assert.ok(sys.includes('household of ' + tenant.household));
  const hidden = tenant.traits.filter(t => !tenant.revealed.includes(t));
  assert.ok(hidden.length > 0);
  for (const h of hidden) assert.ok(sys.includes(h), `hidden trait ${h} is given to the model`);
  assert.match(sys, /NOT yet learned/);
  assert.ok(sys.includes('You mended the roof the same day they asked.') && sys.includes('You kept them waiting a month over the well.'), 'their memories of the ruler');
  assert.match(sys, /bitterly/);
  assert.ok(sys.includes(`${tenant.lease!.rent} crowns a month`));
  assert.ok(sys.includes(`You owe ${tenant.arrears} crowns in arrears`));
  assert.ok(sys.includes('Your rent will not move this year.'), 'an oath already sworn to them');
  assert.ok(sys.includes('The Unauthorized Griffin') && sys.includes('It has eaten a weathervane.'));
  assert.ok(sys.includes('argues like a lawyer about the wording of the lease'), 'the stance');
  for (const o of def.outcomes) assert.ok(sys.includes(`- "${o.id}": ${o.intent}`), `ruling ${o.id} with its intent`);
  assert.ok(sys.includes('the rent rises from 8 to 10 crowns a month'), 'the true figures, so none are invented');
  assert.ok(sys.includes(`${c.state.realm.ruler}, Knight of ${c.state.realm.name}`) && sys.includes('Address them as "Sir"'));
  assert.match(sys, /It is spring/);
  assert.ok(sys.includes('animals are allowed for pet rent'), 'the policy that bears on it');
  assert.match(sys, /Never invent numbers/);
  assert.match(sys, /never more than 180 characters/);
  assert.match(sys, /no dashes of any kind/);
  assert.match(sys, /No exclamation marks/);
  assert.match(sys, /"outcome" is null while the ruler is asking questions/);
  assert.match(sys, /One JSON object and nothing else/);
  assert.ok(!DASH.test(sys) && !DASH.test(user), 'no em or en dashes anywhere in the prompt');
  assert.ok(user.includes(session.lines[0]!.text), 'the opening line is in the transcript');
  assert.ok(user.includes('"What does the beast eat?"'));
  assert.match(user, /their turn 1 of at most 10/);
  assert.match(user, /"outcome" is "pet_rent", "allow" or "ban", or null if this is not yet a ruling\.$/, 'the last thing the model reads is the shape of the answer');
  assert.ok(sys.indexOf('== YOUR ANSWER ==') > sys.indexOf('== THE ONLY RULINGS =='), 'the answer format comes last, after everything it refers to');
  assert.ok(sys.length < 7000, `system prompt stays compact (${sys.length} chars)`);
});

test('late rent: two turns of haggling, then a ruling', async () => {
  const model = scripted([
    answer({ reply: 'A cow, Sir. She sat on the purse. I would not lie about a cow.', mood: 'worried' }),
    answer({ reply: 'A fee on top. For a cow\'s mistake. I had hoped for better.', mood: 'annoyed' }),
    answer({ reply: 'In pieces. Yes. I can do pieces.', mood: 'pleased', outcome: 'payment_plan' }),
  ]);
  const { session, c, inc } = scene('sys_late_rent', model);
  const t1 = await session.say('Explain the cow.');
  assert.ok(!t1.done && t1.outcomeId === null && t1.via === 'model');
  assert.equal(session.speaker.mood, 'worried');
  const t2 = await session.say('I ought to charge you a fee for this, you know.');
  assert.ok(!t2.done && t2.outcomeId === null);
  assert.equal(c.log.length, 0, 'haggling changes nothing in the world');
  assert.ok(!session.done);
  const t3 = await session.say('Very well. Pay it off over three months, a little with each rent.');
  assert.ok(t3.done);
  assert.equal(t3.outcomeId, 'payment_plan');
  assert.match(t3.resultText!, /will pay the arrears in three instalments/);
  assert.deepEqual(types(c), ['resolve_incident', 'remember']);
  assert.match((c.log[1] as Extract<Action, { type: 'remember' }>).text, /^You heard them out over "Rent Unpaid"\./);
  const third = model.requests[2]!.messages[0]!.content;
  assert.ok(third.includes('Explain the cow.') && third.includes('She sat on the purse') && third.includes('I ought to charge you a fee'), 'each call carries the whole conversation');
  assert.match(third, /their turn 3 of at most 10/);
  assert.deepEqual(session.lines.map(l => l.who), ['petitioner', 'ruler', 'petitioner', 'ruler', 'petitioner', 'ruler', 'petitioner']);
  assert.equal(c.state.incidents[inc.id]!.outcomeId, 'payment_plan');
});

test('an oath spoken with the ruling is sworn after it, bound to the household', async () => {
  const model = scripted([answer({
    reply: 'A week, and a year of the same rent. I shall hold you to both.', mood: 'pleased', outcome: 'wait',
    oaths: [{ kind: 'no_rent_raise', text: 'Your rent will not rise this year.', months: 12 }],
  })]);
  const { session, c, inc } = scene('sys_late_rent', model);
  const tenant = c.state.tenants[inc.tenantId!]!;
  const before = c.state.oaths.length;
  const turn = await session.say('You have a week. And you have my word: your rent will not rise this year.');
  assert.ok(turn.done);
  assert.deepEqual(types(c), ['resolve_incident', 'swear_oath', 'remember']);
  const sw = c.log[1] as Extract<Action, { type: 'swear_oath' }>;
  assert.deepEqual(sw.oath, {
    kind: 'no_rent_raise', text: 'Your rent will not rise this year.', toTenantId: tenant.id, toName: tenant.name,
    buildingId: null, buildingType: null, amount: null, dueDay: c.state.day + 360,
  });
  assert.equal(turn.oaths.length, 1);
  assert.equal(turn.oaths[0]!.state, 'open');
  assert.equal(c.state.oaths.length, before + 1);
  assert.equal(turn.oaths[0], c.state.oaths[c.state.oaths.length - 1], 'the turn hands back the ledger\'s own entry');
});

test('a promise made mid-talk is entered at once; the last turn lists every oath of the audience', async () => {
  const model = scripted([
    answer({ reply: 'Before the frost. I shall tell the roof.', mood: 'pleased', oaths: [{ kind: 'repair', text: 'I will have your roof mended before the frost.', months: 8 }] }),
    answer({ reply: 'You said that already, Sir, and I believed you the first time.', oaths: [{ kind: 'repair', text: 'I will mend the roof.', months: 3 }] }),
    answer({ reply: 'Then we both go. Come, Gerald.', mood: 'angry', outcome: 'ban', oaths: [{ kind: 'pay', text: 'I will pay you ten crowns for the move.', months: 1, amount: 10 }] }),
  ]);
  const { session, c, inc } = scene('unauthorized_griffin', model);
  const tenant = c.state.tenants[inc.tenantId!]!;
  const t1 = await session.say('I promise I will have your roof mended before the frost.');
  assert.ok(!t1.done);
  assert.equal(t1.oaths.length, 1);
  assert.deepEqual(types(c), ['swear_oath']);
  const sw = c.log[0] as Extract<Action, { type: 'swear_oath' }>;
  assert.equal(sw.oath.kind, 'repair');
  assert.equal(sw.oath.buildingId, tenant.buildingId, 'a repair oath names the building');
  assert.equal(sw.oath.toTenantId, tenant.id);
  assert.equal(sw.oath.dueDay, c.state.day + 240);
  const t2 = await session.say('As I say, the roof will be mended.');
  assert.equal(t2.oaths.length, 0, 'the same promise is not sworn twice');
  const t3 = await session.say('The griffin goes. I will pay you ten crowns for the move.');
  assert.ok(t3.done);
  assert.deepEqual(types(c), ['swear_oath', 'resolve_incident', 'swear_oath', 'remember']);
  const pay = c.log[2] as Extract<Action, { type: 'swear_oath' }>;
  assert.equal(pay.oath.kind, 'pay');
  assert.equal(pay.oath.amount, 10);
  assert.deepEqual(t3.oaths.map(o => o.kind), ['repair', 'pay'], 'the final turn lists them all');
  assert.ok((c.log[3] as Extract<Action, { type: 'remember' }>).valence < 0);
});

test('goblins: an oath to someone who is no tenant is kept honest', async () => {
  const model = scripted([answer({
    reply: 'A LEASE? With a SEAL? And a ROOF? Grobnik, fetch all the pens!', mood: 'delighted', outcome: 'lease',
    oaths: [
      { kind: 'repair', text: 'I will mend that roof within the month.', months: 1 },
      { kind: 'no_evict', text: 'I will not turn you out this year.', months: 12 },
    ],
  })]);
  const { session, c, inc } = scene('sys_squatters_goblins', model);
  assert.equal(session.speaker.kind, 'npc');
  const turn = await session.say('Sign a lease and pay rent like anyone else. I will mend that roof within the month, and I will not turn you out this year.');
  assert.ok(turn.done);
  assert.equal(turn.outcomeId, 'lease');
  assert.equal(turn.reply, 'A LEASE? With a SEAL? And a ROOF? Grobnik, fetch all the pens!', 'goblins keep their exclamation marks');
  assert.deepEqual(types(c), ['resolve_incident', 'swear_oath', 'swear_oath'], 'no household, so nothing to remember');
  const [a, b] = c.of('swear_oath') as Extract<Action, { type: 'swear_oath' }>[];
  assert.equal(a!.oath.kind, 'repair');
  assert.equal(a!.oath.buildingId, inc.buildingId);
  assert.equal(a!.oath.toTenantId, null);
  assert.equal(a!.oath.toName, session.speaker.name);
  assert.equal(a!.oath.dueDay, c.state.day + 30);
  assert.equal(b!.oath.kind, 'word', 'no household to protect from eviction: it stands as a plain word');
  assert.equal(b!.oath.toTenantId, null);
});

test('figures in oaths must have been spoken by the ruler', async () => {
  const model = scripted([answer({
    reply: 'Fifty. I heard fifty. I am fairly sure I heard fifty.',
    oaths: [{ kind: 'pay', text: 'I will pay you fifty crowns.', months: 1, amount: 50 }, { kind: 'rent_cap', text: 'Your rent stays under twelve crowns.', months: 12, amount: 12 }],
  })]);
  const { session, c } = scene('unauthorized_griffin', model);
  const turn = await session.say('I will see you right for the weathervane, and your rent stays under twelve crowns.');
  const sworn = (c.of('swear_oath') as Extract<Action, { type: 'swear_oath' }>[]).map(a => a.oath);
  assert.equal(sworn.length, 2);
  assert.equal(sworn[0]!.kind, 'word', 'fifty was never said: no sum is recorded');
  assert.equal(sworn[0]!.amount, null);
  assert.equal(sworn[1]!.kind, 'rent_cap');
  assert.equal(sworn[1]!.amount, 12);
  assert.equal(turn.oaths.length, 2);
});

test('the applicant: a trait drawn out, a promise held until they sign', async () => {
  const model = scripted([
    answer({ reply: 'I may have mentioned to the last man that his price was a starting point.', mood: 'worried', revealed: ['haggler', 'pyromaniac'],
      oaths: [{ kind: 'no_rent_raise', text: 'If you sign, the rent will not move for two years.', months: 24 }] }),
    answer({ reply: 'Then it is ours. On the first, you said. I shall write it on something.', mood: 'delighted', outcome: 'accept' }),
  ]);
  const { session, c, inc } = scene('sys_applicant', model);
  const ap = c.state.applicants[inc.applicantId!]!;
  const hid = ap.household.id;
  assert.equal(session.speaker.kind, 'applicant');
  assert.ok(model.requests.length === 0);
  const t1 = await session.say('Did you haggle with your last landlord? If you sign, the rent will not move for two years.');
  assert.deepEqual(t1.revealed, ['haggler'], 'only traits the household truly has, and has hidden');
  assert.equal(t1.oaths.length, 0, 'nobody to swear to yet');
  assert.equal(c.of('swear_oath').length, 0);
  assert.ok(model.requests[0]!.system.includes('the most your household could truly pay is ' + ap.maxRent + ' crowns'));
  assert.ok(model.requests[0]!.system.includes('haggler'));
  const t2 = await session.say('Welcome. The rent is due on the first.');
  assert.ok(t2.done);
  assert.equal(t2.outcomeId, 'accept');
  assert.ok(c.state.tenants[hid], 'the stand-in court signed them in');
  const sw = c.of('swear_oath') as Extract<Action, { type: 'swear_oath' }>[];
  assert.equal(sw.length, 1);
  assert.equal(sw[0]!.oath.toTenantId, hid);
  assert.equal(sw[0]!.oath.kind, 'no_rent_raise');
  assert.equal(sw[0]!.oath.dueDay, c.state.day + 720);
  assert.equal(t2.oaths.length, 1);
  assert.ok(c.state.tenants[hid]!.revealed.includes('haggler'), 'the trait is revealed on the new tenant');
  assert.equal(c.of('remember').length, 1);
  const order = types(c);
  assert.ok(order.indexOf('resolve_incident') < order.indexOf('swear_oath'), 'ruling first, then the oath');
});

test('the applicant turned away is owed nothing', async () => {
  const model = scripted([
    answer({ reply: 'Two years. That is handsome.', oaths: [{ kind: 'no_rent_raise', text: 'The rent will not move for two years.', months: 24 }] }),
    answer({ reply: 'Not for us. I see.', mood: 'sad', outcome: 'reject' }),
  ]);
  const { session, c } = scene('sys_applicant', model);
  await session.say('The rent will not move for two years, I promise.');
  const t = await session.say('On reflection, no. It is not available to you.');
  assert.ok(t.done);
  assert.equal(c.of('swear_oath').length, 0);
  assert.equal(t.oaths.length, 0);
});

// ───────────────────────────── hostile and broken answers ─────────────────────────────

test('hostile: an invented ruling taints the whole answer and the turn is answered offline', async () => {
  const model = scripted([JSON.stringify({
    reply: 'The griffin is hereby knighted. '.repeat(160), mood: 'ecstatic', outcome: 'knight_the_griffin',
    oaths: [{ kind: 'free_rent_forever', text: 'No rent, ever.', months: 9999 }], revealed: ['pyromaniac'],
  })]);
  const { session, c } = scene('unauthorized_griffin', model);
  const turn = await session.say('Hmm. What a morning.');
  assert.equal(turn.via, 'offline');
  assert.ok(!turn.done && turn.outcomeId === null);
  assert.equal(c.log.length, 0, 'nothing was dispatched');
  assert.ok(turn.reply.length > 0 && turn.reply.length <= REPLY_CAP);
  assert.ok(!/knighted/.test(turn.reply));
  assert.deepEqual(turn.oaths, []);
  assert.deepEqual(turn.revealed, []);
  assert.ok(!session.done && !session.busy);
});

test('hostile: 5,000 characters, an invented oath kind, a made-up mood and trait', async () => {
  const long = ('He is house-trained' + EM + 'mostly!!! ' + 'He only eats what is slow. ').repeat(120);
  assert.ok(long.length > 5000);
  const model = scripted([JSON.stringify({
    reply: long, mood: 'apoplectic', outcome: null,
    oaths: [{ kind: 'free_rent_forever', text: 'No rent, ever.', months: 9999 }, 'nonsense', null, { kind: 'word' }],
    revealed: ['pyromaniac', 'not_a_trait', 42],
  })]);
  const { session, c } = scene('unauthorized_griffin', model);
  const before = session.speaker.mood;
  const turn = await session.say('Is he house-trained?');
  assert.equal(turn.via, 'model');
  assert.ok(turn.reply.length <= REPLY_CAP, `reply cut to ${turn.reply.length}`);
  assert.ok(turn.reply.length > 40);
  assert.match(turn.reply, /[.?]$/, 'cut at the end of a sentence');
  assert.ok(!DASH.test(turn.reply) && !turn.reply.includes('!'), 'no dashes, and humans do not shout');
  assert.equal(turn.mood, before, 'an unknown mood changes nothing');
  assert.deepEqual(turn.oaths, []);
  assert.deepEqual(turn.revealed, []);
  assert.equal(c.log.length, 0);
  assert.equal(session.lines[session.lines.length - 1]!.text, turn.reply);
});

test('broken answers: prose, fiction-breaking lines, truncated JSON, code fences', async () => {
  const model = scripted([
    'I am sorry, but I cannot help with that request.',
    answer({ reply: 'As an AI language model I do not have a griffin.' }),
    '{"reply": "He prefers the roof, Sir. The door and he have never agreed',
    '```json\n' + answer({ reply: 'Only the one weathervane. So far.', mood: 'smug' }) + '\n```\nHope that helps!',
    answer({ reply: 'Pet rent. Done.', mood: 'pleased', outcome: ' Pet Rent ' }),
  ]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t1 = await session.say('Tell me about the animal.');
  assert.equal(t1.via, 'offline', 'no JSON: answered offline');
  const t2 = await session.say('Go on.');
  assert.equal(t2.via, 'offline', 'a line from outside the world is never shown');
  assert.ok(!/AI|language model/.test(t2.reply));
  const t3 = await session.say('Why the roof?');
  assert.equal(t3.via, 'model');
  assert.equal(t3.reply, 'He prefers the roof, Sir.', 'a cut-off answer keeps its finished sentences, and never rules');
  assert.equal(t3.outcomeId, null);
  const t4 = await session.say('How much has he eaten?');
  assert.equal(t4.reply, 'Only the one weathervane. So far.');
  assert.equal(t4.mood, 'smug');
  assert.equal(c.log.length, 0);
  const t5 = await session.say('He stays and he pays.');
  assert.equal(t5.outcomeId, 'pet_rent', 'an id with stray case and spaces is still that id');
  assert.ok(t5.done);
});

test('a transport error mid-session falls back offline for that turn only', async () => {
  const model = scripted([
    new Error('502 from the court'),
    answer({ reply: 'What griffin? Exactly.', mood: 'smug', outcome: 'allow' }),
  ]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t1 = await session.say('Well now. Let us talk about Gerald.');
  assert.equal(t1.via, 'offline');
  assert.ok(t1.reply.length > 0 && !t1.done);
  assert.match(t1.reply, /Once more\?/, 'the petitioner asks to hear it again');
  assert.ok(!session.busy);
  const t2 = await session.say('I did not see a griffin.');
  assert.equal(t2.via, 'model', 'the next turn tries the model again');
  assert.ok(t2.done);
  assert.equal(c.of('resolve_incident').length, 1);
});

test('a lost answer never guesses at a ruling: it asks, and an aye or the same words again settle it', async () => {
  const text = 'He can stay if he pays rent.';
  assert.equal(matchOutcomeOffline(INCIDENT_BY_ID.unauthorized_griffin!, text).how, 'clear', 'with no model at court these words would rule');
  const model = scripted([new Error('503'), new Error('503')]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t1 = await session.say(text);
  assert.ok(!t1.done, 'a model was listening and its answer was lost: nothing is ruled on loose words');
  assert.equal(t1.via, 'offline');
  assert.equal(t1.reply, 'Is that your ruling, Sir? The clerk would enter it as "Charge pet rent and a surety". Say aye and it is done.');
  assert.equal(c.log.length, 0);
  const t2 = await session.say(text);
  assert.ok(t2.done && t2.outcomeId === 'pet_rent', 'said again after being asked, it is a ruling');
  assert.equal(c.of('resolve_incident').length, 1);
  assert.equal(model.requests.length, 1, 'the answer to "is that your ruling" needs no model');

  const b = scene('unauthorized_griffin', scripted([new Error('503')]));
  await b.session.say(text);
  const aye = await b.session.say('Aye.');
  assert.ok(aye.done && aye.outcomeId === 'pet_rent');
  assert.equal(aye.reply, 'Pet rent for Gerald. Done. He will be so proud. He will not understand, but he will be proud.');

  const d = scene('unauthorized_griffin', scripted([new Error('503'), answer({ reply: 'Sheep, Sir. Other people\'s.' })]));
  await d.session.say(text);
  const no = await d.session.say('No. I only asked what he eats.');
  assert.ok(!no.done && no.via === 'model', 'anything but an aye drops the question and the talk goes on');
  const late = await d.session.say('Aye.');
  assert.ok(!late.done, 'an aye to nothing rules nothing');

  const e = scene('unauthorized_griffin', scripted([new Error('503'), new Error('503'), new Error('503')]));
  const vague = 'Well now. Let us talk about Gerald.';
  const v1 = await e.session.say(vague), v2 = await e.session.say(vague), v3 = await e.session.say(vague);
  assert.match(v1.reply, /Once more\?/);
  assert.notEqual(v2.reply, v1.reply);
  assert.match(v2.reply, /your clerk has it written/);
  assert.match(v3.reply, /Your clerk/, 'after repeated trouble the petitioner points at the whispers');
  assert.equal(e.c.log.length, 0);

  const off = scene('unauthorized_griffin', OFFLINE);
  const t = await off.session.say(text);
  assert.ok(t.done && t.outcomeId === 'pet_rent', 'truly offline, plain words are all there is, so they rule');
});

test('a failed call still rules when the words are plainly a whisper', async () => {
  const model = scripted([new Error('timeout')]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t = await session.say('It goes. This week. I do not care where.');
  assert.equal(t.via, 'offline');
  assert.ok(t.done);
  assert.equal(t.outcomeId, 'ban');
  assert.equal(t.reply, 'Then we both go. Come, Gerald. We know when a parish has no vision.');
  assert.equal(c.of('resolve_incident').length, 1);
});

// ───────────────────────────── a small model at court ─────────────────────────────

test('small model: a whisper said as written is that ruling, whatever comes back', async () => {
  const whisper = 'I did not see a griffin. Keep it that way.';
  // it keeps arguing and names no ruling
  const a = scene('unauthorized_griffin', scripted([answer({ reply: 'But he is house-trained, Sir. Mostly.', mood: 'worried', outcome: null })]));
  const t1 = await a.session.say(whisper);
  assert.ok(t1.done && t1.outcomeId === 'allow');
  assert.equal(t1.reply, 'What griffin? Exactly. You are a wise and observant ruler who observes nothing.', 'the written parting word stands in');
  assert.equal(t1.via, 'offline');
  assert.match((a.session as unknown as { lines: { text: string }[] }).lines[2]!.text, /What griffin/);
  // it names a different ruling
  const b = scene('unauthorized_griffin', scripted([answer({ reply: 'Then we both go.', mood: 'angry', outcome: 'ban' })]));
  const t2 = await b.session.say(whisper);
  assert.equal(t2.outcomeId, 'allow');
  assert.deepEqual(b.c.of('resolve_incident'), [{ type: 'resolve_incident', incidentId: b.inc.id, outcomeId: 'allow' }]);
  // it answers nonsense
  const n = scene('unauthorized_griffin', scripted(['<<<>>>']));
  assert.equal((await n.session.say(whisper)).outcomeId, 'allow');
  // it agrees: its own parting word is used, and it was told what the ruling is
  const model = scripted([answer({ reply: 'I see no griffin either, Sir. Nor does Gerald.', mood: 'smug', outcome: 'allow' })]);
  const d = scene('unauthorized_griffin', model);
  const t4 = await d.session.say(whisper + ' And I promise I will mend your roof before winter.');
  assert.ok(t4.done && t4.via === 'model');
  assert.equal(t4.reply, 'I see no griffin either, Sir. Nor does Gerald.');
  assert.match(model.requests[0]!.messages[0]!.content, /These words are the ruling "allow"\. Set "outcome" to "allow" and give your parting word on it\./);
  assert.ok(!/or null if this is not yet a ruling/.test(model.requests[0]!.messages[0]!.content));
  // the label alone is enough
  const l = scene('sys_late_rent', scripted([answer({ reply: 'Hm.' })]));
  assert.equal((await l.session.say('Offer a payment plan')).outcomeId, 'payment_plan');
  // but a whisper inside a question is still a question
  const q = scene('unauthorized_griffin', scripted([answer({ reply: 'I could not say, Sir.' })]));
  const t6 = await q.session.say('What if I said: it goes. This week. I do not care where?');
  assert.ok(!t6.done);
  assert.equal(q.c.log.length, 0);
});

test('small model: a ruling heard in a question or a maybe is asked about first', async () => {
  const model = scripted([
    answer({ reply: 'What griffin? Exactly.', mood: 'delighted', outcome: 'allow', revealed: ['pet_lover'], oaths: [{ kind: 'word', text: 'The beast may eat what it likes.', months: 12 }] }),
    answer({ reply: 'Sheep, Sir. Other people\'s, for preference.', mood: 'worried' }),
    answer({ reply: 'Pet rent for Gerald. He will be so proud.', mood: 'delighted', outcome: 'pet_rent' }),
  ]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t1 = await session.say('What does the beast eat?');
  assert.ok(!t1.done && t1.outcomeId === null, 'a question is never a ruling, whatever the model heard');
  assert.equal(t1.reply, 'Is that your ruling, Sir? The clerk would enter it as "Look the other way". Say aye and it is done.');
  assert.deepEqual(t1.oaths, []);
  assert.deepEqual(t1.revealed, []);
  assert.equal(c.log.length, 0);
  const t2 = await session.say('No. I asked what it eats.');
  assert.ok(!t2.done);
  assert.equal(t2.reply, 'Sheep, Sir. Other people\'s, for preference.');
  const t3 = await session.say('Shall we say pet rent, then?');
  assert.ok(!t3.done);
  assert.match(t3.reply, /enter it as "Charge pet rent and a surety"/);
  const t4 = await session.say('Aye, that is my ruling.');
  assert.ok(t4.done && t4.outcomeId === 'pet_rent');
  assert.equal(t4.reply, 'Pet rent for Gerald. He will be so proud.', 'the parting word the model already gave is kept for the aye');
  assert.equal(t4.via, 'model');
  assert.equal(t4.mood, 'delighted');
  assert.equal(model.requests.length, 3, 'the aye itself asks the model nothing');
  assert.deepEqual(types(c), ['resolve_incident', 'remember']);

  const m = scene('sys_late_rent', scripted([answer({ reply: 'In pieces. Yes.', outcome: 'payment_plan' })]));
  const maybe = await m.session.say('Maybe a payment plan.');
  assert.ok(!maybe.done);
  assert.match(maybe.reply, /enter it as "Offer a payment plan"/);

  const g = scene('sys_squatters_goblins', scripted([answer({ reply: 'A LEASE? With a SEAL?', outcome: 'lease' })]));
  const gq = await g.session.say('Would you sign a lease?');
  assert.equal(gq.reply, 'Is that a RULING, Sir? The form would say "Offer them a lease". Say aye and we stamp it!');

  // a word or two that names no ruling: the model may well be right, but it is asked about
  const h = scene('sys_rent_renewal', scripted([answer({ reply: 'The same. Good.', mood: 'pleased', outcome: 'hold' }), answer({ reply: 'The same. Good.', mood: 'pleased', outcome: 'hold' })]));
  const thin = await h.session.say('Agreed.');
  assert.ok(!thin.done);
  assert.match(thin.reply, /enter it as "Same rent, another year"/);
  assert.ok((await h.session.say('Aye.')).done);
  const short = scene('sys_rent_renewal', scripted([answer({ reply: 'The same. Good.', mood: 'pleased', outcome: 'hold' })]));
  assert.ok((await short.session.say('Same rent.')).done, 'two words that do name the ruling are a ruling');

  // a firm ruling after a question is simply a ruling
  const f = scene('unauthorized_griffin', scripted([answer({ reply: 'Pet rent. Done.', outcome: 'pet_rent' })]));
  const firm = await f.session.say('You want to keep him? Fine. He stays, and he pays pet rent.');
  assert.ok(firm.done && firm.outcomeId === 'pet_rent');
});

test('small model: a ruling that the words themselves deny, or dispute, is asked about first', async () => {
  const a = scene('sys_eviction_ready', scripted([answer({ reply: 'Then I will go.', mood: 'sad', outcome: 'evict' })]));
  const t1 = await a.session.say('I will not evict you.');
  assert.ok(!t1.done, 'the model heard "evict" in "I will not evict you"');
  assert.match(t1.reply, /Is that your ruling, .*"Send the Bailiff"/);
  assert.equal(a.c.log.length, 0);

  const w = scene('sys_late_rent', scripted([answer({ reply: 'A fee. For not having money.', mood: 'annoyed', outcome: 'late_fee' })]));
  const t0 = await w.session.say('I will not charge you a fee this time. But pay it off in pieces.');
  assert.ok(!t0.done);
  assert.match(t0.reply, /enter it as "Offer a payment plan"/, 'the words deny the model\'s ruling and name another: that one is asked about');
  const t00 = await w.session.say('Aye.');
  assert.ok(t00.done && t00.outcomeId === 'payment_plan');
  assert.equal(t00.reply, 'In pieces. Yes. I can do pieces. Bless you, Sir.', 'and the parting word for the wrong ruling is not used');

  const b = scene('sys_eviction_ready', scripted([
    answer({ reply: 'Torn up? Then I never saw it.', mood: 'delighted', outcome: 'mercy' }),
    answer({ reply: 'Then I will go. But I am taking the door knocker.', mood: 'sad', outcome: 'evict' }),
  ]));
  const t2 = await b.session.say('Evict them.');
  assert.ok(!t2.done, 'the plain ear hears another ruling in these words than the model did');
  assert.match(t2.reply, /"Tear up the writ"/);
  assert.equal(t2.via, 'offline', 'the question is the court\'s own line');
  assert.equal(b.c.log.length, 0);
  const t3 = await b.session.say('No. Evict them.');
  assert.ok(t3.done && t3.outcomeId === 'evict', 'said again, and this time both ears agree');
  assert.equal(t3.reply, 'Then I will go. But I am taking the door knocker.');
  assert.equal(b.c.of('resolve_incident').length, 1);
});

test('small model: the outcome is found however it is spelled, and an invented one is still refused', async () => {
  for (const spelled of ['pet_rent', 'Pet Rent', '"pet_rent".', 'PET-RENT', 'id pet_rent', 'Charge pet rent and a surety', 'the pet_rent ruling']) {
    const { session } = scene('unauthorized_griffin', scripted([JSON.stringify({ reply: 'Pet rent. Done.', mood: 'pleased', outcome: spelled })]));
    const t = await session.say('He stays and he pays.');
    assert.equal(t.outcomeId, 'pet_rent', `outcome written as ${spelled}`);
  }
  for (const spelled of ['do_not_allow', 'pet_rent_or_ban', 'compromise']) {
    const { session, c } = scene('unauthorized_griffin', scripted([JSON.stringify({ reply: 'Done.', outcome: spelled })]));
    const t = await session.say('Hm. Gerald, is it.');
    assert.ok(!t.done && t.via === 'offline', `outcome written as ${spelled}`);
    assert.equal(c.log.length, 0);
  }
  for (const none of ['none', 'None', 'N/A', 'no ruling', 'undecided', 'null', '']) {
    const { session } = scene('unauthorized_griffin', scripted([JSON.stringify({ reply: 'Sheep, Sir.', outcome: none })]));
    const t = await session.say('Hm. Gerald, is it.');
    assert.ok(!t.done && t.via === 'model' && t.reply === 'Sheep, Sir.', `no ruling written as "${none}"`);
  }
});

test('small model: it speaks instead of writing JSON, or wraps the JSON in chatter', async () => {
  const model = scripted([
    'Sheep, Sir. Other people\'s, for preference.',
    'Wat: "He has never once eaten a tenant, Sir."',
    'Sure! Here is the response in the requested format:\n\n```json\n{\n  "reply": "Only the one weathervane. So far.",\n  "mood": "Smug",\n  "outcome": null,\n  "oaths": [],\n  "revealed": [],\n}\n```\n\nLet me know if you would like {anything} changed!',
    '{\'reply\': \'It is the lease\'s fault, Sir.\', \'mood\': \'annoyed\', \'outcome\': None, \'oaths\': [], \'revealed\': []}',
    'Reply: Pet rent for Gerald. Done.\nMood: delighted\nOutcome: pet_rent',
  ]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t1 = await session.say('And what does he eat, this Gerald.');
  assert.equal(t1.via, 'model');
  assert.equal(t1.reply, 'Sheep, Sir. Other people\'s, for preference.');
  assert.ok(!t1.done);
  const t2 = await session.say('Has he hurt anyone.');
  assert.equal(t2.reply, 'He has never once eaten a tenant, Sir.', 'a name and quotes around the line are taken off');
  const t3 = await session.say('The weathervane, though.');
  assert.equal(t3.reply, 'Only the one weathervane. So far.');
  assert.equal(t3.mood, 'smug');
  const t4 = await session.say('The lease says no livestock.');
  assert.equal(t4.reply, 'It is the lease\'s fault, Sir.');
  assert.equal(t4.mood, 'annoyed');
  assert.equal(c.log.length, 0);
  const t5 = await session.say('Enough. He stays and he pays.');
  assert.ok(t5.done && t5.outcomeId === 'pet_rent', 'labelled lines are read like JSON');
  assert.equal(t5.reply, 'Pet rent for Gerald. Done.');

  // spoken words cannot rule; if the ruler's words sound like a ruling, the petitioner asks
  const p = scene('unauthorized_griffin', scripted(['Pet rent for Gerald. Done. He will be so proud.']));
  const t6 = await p.session.say('He can stay if he pays rent.');
  assert.ok(!t6.done);
  assert.match(t6.reply, /Is that your ruling, Sir\? The clerk would enter it as "Charge pet rent and a surety"/);
  assert.ok((await p.session.say('It is.')).done);

  // a refusal is never shown as the petitioner's line
  const r = scene('unauthorized_griffin', scripted(['I\'m sorry, but I can\'t continue with this roleplay.']));
  const t7 = await r.session.say('Hm. Gerald, is it.');
  assert.equal(t7.via, 'offline');
  assert.ok(!/roleplay|sorry, but/i.test(t7.reply));
});

test('small model: it may not put promises in the ruler\'s mouth, nor spill every secret at once', async () => {
  const model = scripted([
    answer({ reply: 'It does, Sir. Over the bed.', oaths: [{ kind: 'repair', text: 'I will mend the roof within the month.', months: 1 }], revealed: ['pet_lover', 'forgetful'] }),
    answer({ reply: 'Kind of you, Sir.', oaths: [{ kind: 'pay', text: 'I will pay for the two sheep.', months: 3, amount: 20 }] }),
    answer({ reply: 'Within the month. I shall tell the bucket.', oaths: [{ kind: 'repair', text: 'I will mend the roof within the month.', months: 1 }, { kind: 'word', text: 'The ruler will knight the griffin.', months: 12 }] }),
  ]);
  const { session, c } = scene('unauthorized_griffin', model);
  const t1 = await session.say('The roof leaks, I hear.');
  assert.deepEqual(t1.oaths, [], 'the ruler promised nothing');
  assert.deepEqual(t1.revealed, ['pet_lover'], 'one hidden trait at most, and only one that was hidden');
  const t2 = await session.say('I will think about the roof.');
  assert.deepEqual(t2.oaths, [], 'a promise about something the ruler never mentioned');
  const t3 = await session.say('I will mend the roof within the month.');
  assert.equal(t3.oaths.length, 1);
  assert.equal(t3.oaths[0]!.kind, 'repair');
  assert.equal(c.of('swear_oath').length, 1);
});

test('when the sim refuses, the petitioner says so and the audience stays open', async () => {
  let refuseOnce = true;
  const model = scripted([
    answer({ reply: 'Ten crowns AND a suggestion. Very generous.', mood: 'pleased', outcome: 'bribe' }),
    answer({ reply: 'We go! Under protest! The protest is in writing!', mood: 'annoyed', outcome: 'oust' }),
  ]);
  const { session, c } = scene('sys_squatters_goblins', model, {
    refuse: a => (a.type === 'resolve_incident' && refuseOnce ? (refuseOnce = false, 'The coffers hold but 3 crowns, Sir.') : null),
  });
  const t1 = await session.say('Here are ten crowns. Find another lord.');
  assert.ok(!t1.done && t1.outcomeId === null);
  assert.ok(t1.reply.includes('The coffers hold but 3 crowns, Sir.'), t1.reply);
  assert.match(t1.reply, /cannot be done/);
  assert.ok(t1.reply.length <= REPLY_CAP);
  assert.ok(!session.done && session.outcomeId === null);
  assert.equal(c.of('remember').length, 0);
  const t2 = await session.say('Then out you go.');
  assert.ok(t2.done);
  assert.equal(t2.outcomeId, 'oust');
});

test('ten ruler turns, then the Steward insists and the model is asked no more', async () => {
  const model = scripted(Array.from({ length: 12 }, (_, i) => answer({ reply: `That is point ${i + 1}, Sir, and I have more.` })));
  const { session, c } = scene('unauthorized_griffin', model);
  for (let i = 1; i <= MAX_RULER_TURNS; i++) {
    const t = await session.say(`And what of matter number ${i}?`);
    assert.ok(!t.done);
    if (i < MAX_RULER_TURNS) assert.ok(!session.lines.some(l => l.who === 'steward'), `no Steward yet at turn ${i}`);
  }
  assert.equal(model.requests.length, MAX_RULER_TURNS);
  assert.match(model.requests[3]!.messages[0]!.content, /So what is it to be, Sir\?/, 'from the fourth turn the petitioner may ask for a ruling');
  assert.match(model.requests[9]!.messages[0]!.content, /court is growing restless/);
  const steward = session.lines.filter(l => l.who === 'steward');
  assert.equal(steward.length, 1);
  assert.match(steward[0]!.text, /Give your ruling now/);
  const t11 = await session.say('One more question, though.');
  assert.equal(model.requests.length, MAX_RULER_TURNS, 'the eleventh turn does not reach the model');
  assert.equal(t11.via, 'offline');
  assert.ok(!t11.done);
  assert.equal(session.lines.filter(l => l.who === 'steward').length, 2);
  const t12 = await session.say('He stays. He pays pet rent, and you post a surety against the thatch.');
  assert.ok(t12.done, 'a plain whisper still rules after the cap');
  assert.equal(c.of('resolve_incident').length, 1);
});

test('choosing a whisper while the petitioner is still answering; leaving mid-answer', async () => {
  let release: (v: string) => void = () => undefined;
  const slow = scripted([() => new Promise<string>(r => { release = r; })]);
  const a = scene('unauthorized_griffin', slow);
  const pending = a.session.say('Let me think about Gerald.');
  await sleep(5);
  assert.ok(a.session.busy);
  const ruled = a.session.choose('allow');
  assert.ok(ruled.done && !a.session.busy);
  release(answer({ reply: 'Then we both go.', outcome: 'ban' }));
  const late = await pending;
  assert.equal(late.reply, '', 'the overtaken answer is dropped');
  assert.equal(a.session.outcomeId, 'allow');
  assert.equal(a.c.of('resolve_incident').length, 1, 'only the chosen ruling was dispatched');

  let release2: (v: string) => void = () => undefined;
  const slow2 = scripted([() => new Promise<string>(r => { release2 = r; })]);
  const b = scene('unauthorized_griffin', slow2);
  const p2 = b.session.say('He stays, he pays.');
  await sleep(5);
  b.session.leave();
  assert.ok(!b.session.busy);
  release2(answer({ reply: 'Done.', outcome: 'pet_rent' }));
  const gone = await p2;
  assert.ok(!gone.done && gone.reply === '');
  assert.equal(b.c.log.length, 0, 'walking away rules nothing');
  assert.ok(!b.session.done);
  const after = await b.session.say('Hello?');
  assert.equal(after.reply, '');
  assert.equal(b.session.choose('ban').done, false);
});

test('a matter settled elsewhere closes the audience gracefully', async () => {
  const model = scripted([]);
  const { session, c, inc } = scene('unauthorized_griffin', model);
  inc.state = 'resolved'; inc.outcomeId = 'allow'; inc.resolvedBy = 'steward';
  const t = await session.say('Now then.');
  assert.ok(t.done);
  assert.equal(t.outcomeId, 'allow');
  assert.match(t.resultText!, /You did not see a griffin/);
  assert.match(t.reply, /settled without us/);
  assert.equal(c.log.length, 0);
  assert.equal(model.requests.length, 0);

  const b = scene('unauthorized_griffin', OFFLINE);
  b.inc.state = 'expired';
  const t2 = b.session.choose('ban');
  assert.ok(t2.done && t2.outcomeId === null);
  assert.match(t2.resultText!, /Its name is Gerald/);
  assert.equal(b.c.log.length, 0);
});

test('turns asked in a hurry are answered in order', async () => {
  const model = scripted([answer({ reply: 'First.' }), answer({ reply: 'Second.' })]);
  const { session } = scene('unauthorized_griffin', model);
  const [a, b] = await Promise.all([session.say('One?'), session.say('Two?')]);
  assert.equal(a.reply, 'First.');
  assert.equal(b.reply, 'Second.');
  assert.ok(model.requests[1]!.messages[0]!.content.includes('First.'), 'the second call saw the first answer');
  assert.deepEqual(session.lines.map(l => l.text).slice(1), ['One?', 'First.', 'Two?', 'Second.']);
});

// ───────────────────────────── with no model at all ─────────────────────────────

test('offline: a whisper rules, a question is nudged, choose gives the written reply', async () => {
  const { session, c } = scene('unauthorized_griffin', OFFLINE);
  const q = await session.say('What does he eat?');
  assert.equal(q.via, 'offline');
  assert.ok(!q.done);
  assert.equal(q.reply, 'A fair question, Sir, and I have said my piece. What I need now is your ruling. Your clerk has some wordings ready.', 'a Knight has no Steward yet: the notes are a clerk\'s');
  assert.ok(q.reply.length <= REPLY_CAP && !DASH.test(q.reply));
  const baron = scene('sys_late_rent', OFFLINE, { rank: 'baron' });
  assert.match((await baron.session.say('What happened this time?')).reply, /Your Steward has some wordings ready\./, 'a Baron has one');
  const vague = await session.say('Griffins, eh.');
  assert.ok(!vague.done);
  assert.notEqual(vague.reply, q.reply, 'the nudges vary');
  assert.equal(c.log.length, 0);
  const empty = await session.say('   ');
  assert.ok(!empty.done);
  assert.equal(empty.reply, 'Sir?');
  const bad = session.choose('knight_the_griffin');
  assert.ok(!bad.done);
  assert.equal(c.log.length, 0);
  const t = session.choose('allow');
  assert.ok(t.done);
  assert.equal(t.via, 'offline');
  assert.equal(t.reply, 'What griffin? Exactly. You are a wise and observant ruler who observes nothing.');
  assert.equal(t.resultText, 'You did not see a griffin at Mudlark Hovel. The neighbours\' sheep continue to see it.');
  assert.equal(t.mood, 'delighted');
  assert.deepEqual(types(c), ['resolve_incident', 'remember']);
  assert.match((c.log[1] as Extract<Action, { type: 'remember' }>).text, /^You ruled on "The Unauthorized Griffin" without much talk\./);
  assert.equal(session.lines[session.lines.length - 2]!.text, 'I did not see a griffin. Keep it that way.', 'the whisper is shown as the ruler\'s words');
});

test('offline: goblins shout their nudges, an ogre apologises, two near rulings are asked about', async () => {
  const g = scene('sys_squatters_goblins', OFFLINE);
  const t = await g.session.say('This is my house.');
  assert.match(t.reply, /!/);
  const p = scene('sys_pet_found', OFFLINE);
  const tenant = p.c.state.tenants[p.inc.tenantId!]!;
  assert.ok(tenant);
  const between = await p.session.say('It can stay.');
  assert.ok(!between.done);
  assert.match(between.reply, /Do you mean "Let it stay" or "Charge pet rent"/);
});

test('offline: a promise in plain words is sworn with the ruling', async () => {
  const { session, c, inc } = scene('unauthorized_griffin', OFFLINE);
  const tenant = c.state.tenants[inc.tenantId!]!;
  const t = await session.say('He stays. He pays pet rent, and you post a surety against the thatch. I promise I will mend your roof before winter.');
  assert.ok(t.done);
  assert.equal(t.outcomeId, 'pet_rent');
  assert.deepEqual(types(c), ['resolve_incident', 'swear_oath', 'remember']);
  const sw = c.log[1] as Extract<Action, { type: 'swear_oath' }>;
  assert.equal(sw.oath.kind, 'repair');
  assert.equal(sw.oath.buildingId, tenant.buildingId);
  assert.equal(sw.oath.text, 'I promise I will mend your roof before winter.');
  // day 34 is in Seedtide (month 1); winter opens with Firstfrost (month 9)
  assert.equal(sw.oath.dueDay, c.state.day + 8 * 30);
  assert.equal(t.oaths.length, 1);
});

test('offline ear: paraphrases rule, questions and idle talk never do', () => {
  const cases: [string, string, string | null][] = [
    ['sys_late_rent', 'You have a week.', 'wait'],
    ['sys_late_rent', 'Take another week, no fee.', 'wait'],
    ['sys_late_rent', 'I will give you more time', 'wait'],
    ['sys_late_rent', 'Pay the fee', 'late_fee'],
    ['sys_late_rent', 'There will be a penalty for this.', null],
    ['sys_late_rent', 'You pay a penalty.', 'late_fee'],
    ['sys_late_rent', 'No fee this time, but pay in instalments', 'payment_plan'],
    ['sys_late_rent', 'We can do a payment plan', 'payment_plan'],
    ['sys_late_rent', 'I will waive it this once', 'forgive'],
    ['sys_late_rent', 'Forget it', 'forgive'],
    ['sys_late_rent', 'I am taking you to court', null],
    ['sys_late_rent', 'Take them to court. Serve the notice.', 'notice'],
    ['sys_late_rent', 'So this is about the fee', null],
    ['sys_late_rent', 'About the fee.', null],
    ['sys_late_rent', 'Out. Notice to quit.', 'notice'],
    ['sys_late_rent', 'I will not evict you', null],
    ['sys_late_rent', 'I do not want to charge you a fee', null],
    ['sys_late_rent', 'What happened to the cow?', null],
    ['sys_late_rent', 'How much do you have', null],
    ['sys_late_rent', 'Maybe a payment plan', null],
    ['sys_late_rent', 'Would a payment plan suit you', null],
    ['sys_late_rent', 'I could forgive it', null],
    ['sys_late_rent', 'The court is slow', null],
    ['sys_late_rent', 'You always pay late', null],
    ['sys_late_rent', 'You owe me rent', null],
    ['sys_late_rent', 'Fine. Hm.', null],
    ['sys_late_rent', 'I waited a week already', null],
    ['sys_late_rent', 'I have already forgiven you once', null],
    ['sys_late_rent', 'A week is too long', null],
    ['sys_late_rent', 'Next time there will be a fee', null],
    ['sys_late_rent', 'Pay what you owe', null],
    ['sys_move_out_deposit', 'Fair.', null],
    ['sys_move_out_deposit', 'You left it in a fair state', null],
    ['sys_move_out_deposit', 'Look at the state of that hearth', null],
    ['sys_applicant', 'Welcome to Mudlark Hollow', null],
    ['sys_applicant', 'The last tenant left it in a state', null],
    ['unauthorized_griffin', 'Your surety would not cover the thatch', null],
    ['unauthorized_griffin', 'The griffin stays on the roof all day', null],
    ['unauthorized_griffin', 'You should have asked before keeping a pet', null],
    ['sys_eviction_ready', 'You will get no mercy from me', null],
    ['sys_eviction_ready', 'The court has spoken', null],
    ['unauthorized_griffin', 'The griffin goes.', 'ban'],
    ['unauthorized_griffin', 'Pet rent.', 'pet_rent'],
    ['unauthorized_griffin', 'He can stay if he pays rent', 'pet_rent'],
    ['unauthorized_griffin', 'Look, I have heard enough about this animal and the thatch and the sheep; it stays, and it pays pet rent.', 'pet_rent'],
    ['unauthorized_griffin', 'It goes hunting at dusk', null],
    ['unauthorized_griffin', 'He is on the roof all week', null],
    ['unauthorized_griffin', 'Tell me about Gerald', null],
    ['unauthorized_griffin', 'Tell me about the animal.', null],
    ['unauthorized_griffin', 'So this is about the pet', null],
    ['unauthorized_griffin', 'The surety is the thing', null],
    ['sys_pet_found', 'Tell me about the animal.', null],
    ['sys_pet_found', 'I have seen the animal myself', null],
    ['sys_pet_found', 'The animal goes', 'ban'],
    ['sys_late_rent', 'Explain the fee to me', null],
    ['sys_late_rent', 'The grace days are spent and so is my patience', null],
    ['unauthorized_griffin', 'I will not say the griffin goes', null],
    ['sys_move_out_deposit', 'I cannot decide whether to keep the lot', null],
    ['sys_move_out_deposit', 'Should I keep the lot?', null],
    ['sys_move_out_deposit', 'Very well, I shall keep the lot and be done.', 'keep_all'],
    ['purple_tower', 'It is a magnificent purple. Would you turn it back, as a courtesy? Then the surety is yours. There.', 'return_all'],
    ['sys_applicant', 'Welcome', 'accept'],
    ['sys_applicant', 'I want references first', 'screen'],
    ['sys_applicant', 'No. Not available.', 'reject'],
    ['sys_applicant', 'The rent is a tenth more', 'counter'],
    ['sys_applicant', 'Who was your last landlord?', null],
    ['sys_applicant', 'The rent is due on the first', null],
    ['sys_applicant', 'I am sorry', null],
    ['sys_squatters_goblins', 'Sign a lease and pay rent', 'lease'],
    ['sys_squatters_goblins', 'I will pay you to leave', 'bribe'],
    ['sys_squatters_goblins', 'Send the bailiff', 'oust'],
    ['sys_squatters_goblins', 'Leave them be', 'ignore'],
    ['sys_squatters_goblins', 'That is my house', null],
    ['sys_squatters_goblins', 'Show me the form', null],
    ['sys_move_out_deposit', 'You get it all back', 'return_all'],
    ['sys_move_out_deposit', 'I keep the lot', 'keep_all'],
    ['sys_move_out_deposit', 'I will not keep any of it', null],
    ['sys_move_out_deposit', 'It is honest wear', null],
    ['sys_rent_renewal', 'Same rent', 'hold'],
    ['sys_rent_renewal', 'The rent goes up', 'raise'],
    ['sys_rent_renewal', 'I am lowering your rent', 'lower'],
    ['sys_rent_renewal', 'I will not raise the rent', null],
    ['sys_rent_renewal', 'You have been good tenants', null],
    ['sys_eviction_ready', 'Evict them', 'evict'],
    ['sys_eviction_ready', 'I show mercy', 'mercy'],
    ['sys_eviction_ready', 'Coin for keys', 'cash_for_keys'],
    ['sys_pet_found', 'No pets', 'ban'],
    ['sys_pet_found', 'It stays but you pay pet rent', 'pet_rent'],
    ['sys_pet_found', 'What is its name', null],
    ['sys_repair_leak', 'Fix it properly', 'fix'],
    ['sys_repair_leak', 'Patch it', 'patch'],
    ['sys_repair_leak', 'Bill the tenant', 'bill_tenant'],
    ['purple_tower', 'I am keeping every crown', 'keep_all'],
    ['purple_tower', 'It is very purple', null],
  ];
  const wrong: string[] = [];
  for (const [defId, text, want] of cases) {
    const got = matchOutcomeOffline(INCIDENT_BY_ID[defId]!, text, { pet: 'cat', title: 'Reeve' }).outcomeId;
    if (got !== want) wrong.push(`${defId}: "${text}" heard ${got}, wanted ${want}`);
  }
  assert.deepEqual(wrong, []);
});

test('offline ear: one whisper inside another is told apart; twins are reported, not guessed', () => {
  const base = INCIDENT_BY_ID.sys_repair_leak!;
  const def: IncidentDef = {
    ...base, id: 'zz_nested', outcomes: [
      { ...base.outcomes[0]!, id: 'a', option: undefined, label: 'Mend it', say: 'Mend it properly.' },
      { ...base.outcomes[1]!, id: 'b', option: undefined, label: 'Mend it and bill them', say: 'Mend it properly and put it on their account.' },
      { ...base.outcomes[2]!, id: 'c', option: undefined, label: 'Leave it', say: 'It can wait.' },
    ],
  };
  const hear = (t: string): string | null => matchOutcomeOffline(def, t).outcomeId;
  assert.equal(hear('Mend it properly.'), 'a');
  assert.equal(hear('Mend it properly and put it on their account.'), 'b');
  assert.equal(hear('Very well. Mend it properly and put it on their account. Today.'), 'b', 'the longer whisper is the one that was said');
  assert.equal(hear('Mend it'), 'a');
  assert.equal(hear('Mend it and bill them'), 'b');
  assert.equal(hear('It can wait.'), 'c');
  const twins: IncidentDef = { ...def, outcomes: [def.outcomes[0]!, { ...def.outcomes[1]!, label: 'Mend it', say: 'Mend it properly.' }] };
  assert.equal(matchOutcomeOffline(twins, 'Mend it properly.').how !== 'exact', true, 'two outcomes with the same whisper cannot be told apart word for word');
});

test(`offline ear: every outcome's own whisper selects it, across all ${INCIDENTS.length} incidents`, () => {
  const audit = auditOfflineEar();
  const n = INCIDENTS.reduce((a, d) => a + d.outcomes.length, 0);
  assert.equal(audit.outcomes, n);
  const labels: string[] = [];
  for (const def of INCIDENTS) {
    const s = makeFixtureState(rankFor(def));
    const inc = stageIncident(s, def.id);
    const vars = inc ? audienceVars(s, inc, resolveCast(s, inc, def)) : {};
    for (const o of def.outcomes) {
      const twins = def.outcomes.filter(x => x.label === o.label).length > 1;
      if (!twins && matchOutcomeOffline(def, o.label, vars).outcomeId !== o.id) labels.push(`${def.id}.${o.id} (label "${o.label}")`);
    }
  }
  console.log(`       ${n} outcomes in ${INCIDENTS.length} incidents: ${n - audit.exactMisses.length} whispers select their own outcome word for word; ` +
    `${n - audit.fuzzyMisses.length} would also be heard by weight of words alone.`);
  for (const m of audit.fuzzyMisses) console.log(`       (weak by words alone: ${m.defId}.${m.outcomeId} heard ${m.heard ?? 'nothing'})`);
  assert.deepEqual(audit.exactMisses.map(m => `${m.defId}.${m.outcomeId} heard ${m.heard}: "${m.say}"${m.twin ? ` (same words as "${m.twin}")` : ''}`), [], 'whispers that do not select their own outcome');
  assert.deepEqual(labels, [], 'labels that do not select their own outcome');
});

test('offline sessions: every incident opens, and every whisper spoken aloud rules as written', async () => {
  let sessions = 0;
  const failed: string[] = [];
  for (const def of INCIDENTS) {
    for (const o of def.outcomes) {
      const state = makeFixtureState(rankFor(def));
      const inc = stageIncident(state, def.id);
      if (!inc) { failed.push(`${def.id}: could not be staged`); break; }
      const c = court(state);
      const session = openAudienceSession(inc.id, c.deps, () => OFFLINE, () => undefined);
      if (!session) { failed.push(`${def.id}: no session`); break; }
      sessions++;
      const w = session.whispers.find(x => x.outcomeId === o.id)!;
      for (const text of [session.lines[0]!.text, w.label, w.say, session.title]) {
        if (/[{}]/.test(text)) failed.push(`${def.id}.${o.id}: unfilled text "${text}"`);
      }
      const turn = await session.say(w.say);
      if (!turn.done || turn.outcomeId !== o.id) { failed.push(`${def.id}.${o.id}: said "${w.say}", heard ${turn.outcomeId}`); continue; }
      if (!turn.reply || /[{}]/.test(turn.reply) || !turn.resultText || /[{}]/.test(turn.resultText)) failed.push(`${def.id}.${o.id}: reply or result not filled`);
      const res = c.of('resolve_incident');
      if (res.length !== 1) failed.push(`${def.id}.${o.id}: ${res.length} rulings dispatched`);
    }
  }
  console.log(`       ${sessions} offline audiences held.`);
  assert.deepEqual(failed, []);
});

// ───────────────────────────── the small parts ─────────────────────────────

test('reading the model: parseAudienceReply', () => {
  const P = parseAudienceReply;
  assert.equal(P(''), null);
  assert.equal(P(undefined), null);
  assert.equal(P('[1, 2]'), null);
  assert.equal(P('{"mood": "angry"}'), null, 'no reply, no answer');
  const ok = P('Sure! {"reply": "A week. {braces} inside.", "mood": "pleased", "outcome": "wait", "oaths": [], "revealed": ["proud"],} trailing');
  assert.ok(ok && !ok.salvaged && !ok.loose);
  assert.equal(ok.reply, 'A week. {braces} inside.');
  assert.equal(ok.outcome, 'wait');
  assert.deepEqual(ok.revealed, ['proud']);
  assert.equal(P('{"reply": "x", "outcome": "null"}')!.outcome, null);
  assert.equal(P('{"reply": "x", "outcome": ""}')!.outcome, null);
  assert.equal(P('{"reply": "x", "outcome": 7, "oaths": "none", "revealed": "all"}')!.outcome, null);
  assert.equal(P('{"reply": "x", "outcome": 7}')!.loose, true, 'a number is no answer either way');
  assert.equal(P('{"reply": "x"}')!.loose, true, 'no outcome field: the answer says nothing either way');
  assert.equal(P('{"reply": "x", "outcome": null}')!.loose, false);

  // stray prose and braces around the object, more than one object
  const chat = P('Here is {my answer}:\n{"reply": "A week.", "mood": "pleased", "outcome": "wait", "oaths": [], "revealed": []}\nLet me know {if} that works. {"reply": "second", "outcome": "notice"}');
  assert.equal(chat!.reply, 'A week.');
  assert.equal(chat!.outcome, 'wait');
  // the usual damage
  assert.equal(P("{'reply': 'A week.', 'mood': 'pleased', 'outcome': 'wait'}")!.outcome, 'wait', 'single quotes');
  assert.equal(P('{reply: "A week.", mood: "pleased", outcome: "wait",}')!.outcome, 'wait', 'bare keys and a trailing comma');
  assert.equal(P('{"reply": "A week.\nNo more.", "outcome": None, "oaths": [], }')!.reply, 'A week. No more.', 'a raw line break, None');
  assert.equal(P('{"reply": "A week.", "outcome": "wait"} // the ruler gave more time')!.outcome, 'wait');
  assert.equal(P('{\u201creply\u201d: \u201cA week.\u201d, \u201coutcome\u201d: \u201cwait\u201d}')!.outcome, 'wait', 'curly quotes');
  const apos = P("{'reply': 'It is the cow's fault, Sir.', 'mood': 'worried', 'outcome': None, 'oaths': [], 'revealed': []}");
  assert.equal(apos!.reply, "It is the cow's fault, Sir.");
  assert.equal(apos!.mood, 'worried');
  assert.ok(apos!.outcome === null && !apos!.loose && !apos!.salvaged);
  const inner = P('{"reply": "He is "more of a large cat", Sir.", "mood": "smug", "outcome": "allow", "oaths": [{"kind": "word", "text": "x", "months": 2}], "revealed": ["proud"]}');
  assert.equal(inner!.reply, 'He is "more of a large cat", Sir.', 'quotes inside the reply');
  assert.equal(inner!.outcome, 'allow');
  assert.deepEqual(inner!.oaths, [{ kind: 'word', text: 'x', months: 2 }]);
  assert.deepEqual(inner!.revealed, ['proud']);
  // other shapes
  assert.equal(P('{"response": {"reply": "A week.", "outcome": "wait"}}')!.outcome, 'wait', 'one layer of wrapping');
  assert.equal(P('[{"reply": "A week.", "outcome": null}]')!.reply, 'A week.');
  assert.equal(P(JSON.stringify(JSON.stringify({ reply: 'A week.', outcome: 'wait' })))!.outcome, 'wait', 'the object sent as a JSON string');
  assert.equal(P('{"reply": "A week.", "outcome": wait}')!.outcome, 'wait', 'a bare value');
  const keys = P('{"Reply": "A week.", "Mood": "Pleased", "Ruling": "WAIT", "promises": {"kind": "word", "text": "y"}}');
  assert.equal(keys!.outcome, 'WAIT');
  assert.equal(keys!.oaths.length, 1);
  assert.equal(P('{"reply": "x", "outcome": {"id": "wait"}}')!.outcome, 'wait');
  assert.equal(P('{"text": "A week.", "outcome": null}')!.reply, 'A week.');
  assert.equal(P('{"kind": "word", "text": "not a reply"}'), null, 'an oath on its own is not an answer');
  for (const none of ['none', 'None', 'N/A', 'no ruling', 'undecided', 'not yet', '-']) {
    const r = P(JSON.stringify({ reply: 'x', outcome: none }))!;
    assert.ok(r.outcome === null && !r.loose, `"${none}" means no ruling`);
  }
  const lines = P('Reply: Since the spring storms, Sir.\nMood: Worried\nOutcome: null');
  assert.equal(lines!.reply, 'Since the spring storms, Sir.');
  assert.equal(lines!.mood, 'Worried');
  assert.ok(lines!.outcome === null && !lines!.loose);
  assert.equal(P('**Reply:** "A week."\n**Outcome:** wait')!.outcome, 'wait');

  // cut short
  const cut = P('{"reply": "It was the cow, Sir. She \\"sat\\" on it", "mood": "wor');
  assert.ok(cut && !cut.salvaged && cut.loose, 'the reply was finished; nothing after it can be trusted');
  assert.equal(cut.reply, 'It was the cow, Sir. She "sat" on it');
  assert.equal(cut.outcome, null);
  assert.equal(cut.mood, null);
  const mid = P('{"reply": "He prefers the roof, Sir. The door and he have never agre');
  assert.ok(mid && mid.salvaged);
  assert.equal(mid.outcome, null);
  const after = P('{"reply": "Pet rent. Done.", "mood": "pleased", "outcome": "pet_rent", "oaths": [{"kind": "rep');
  assert.ok(after && !after.salvaged && !after.loose, 'cut off after the ruling was named');
  assert.equal(after.outcome, 'pet_rent');
  assert.deepEqual(after.oaths, []);
  const within = P('{"reply": "Pet rent. Done.", "mood": "pleased", "outcome": "pet_re');
  assert.ok(within && within.outcome === null && within.loose, 'cut off inside the ruling: no ruling');

  // no JSON at all
  const prose = P('Since the spring storms, Sir.\nIt used to lean left.');
  assert.ok(prose && prose.loose && !prose.salvaged);
  assert.equal(prose.reply, 'Since the spring storms, Sir. It used to lean left.');
  assert.equal(prose.outcome, null);
  for (const no of [
    'I am sorry, but I cannot help with that request.', 'I\'m sorry, but I can\'t continue with this roleplay.', 'As an AI, I do not own a griffin.',
    'Here is the JSON you asked for:', 'The outcome is pet_rent.', 'x'.repeat(700), '!!!', 'I cannot comply with this request.',
  ]) assert.equal(P(no), null, no.slice(0, 40));
  assert.ok(P('I cannot help it, Sir. He followed me home.'), 'an in-world "cannot help" is still a line');
});

test('reading the model: moods by any name', () => {
  assert.equal(readMood('pleased'), 'pleased');
  assert.equal(readMood(' Worried. '), 'worried');
  assert.equal(readMood('a little relieved'), 'pleased');
  assert.equal(readMood('FURIOUS'), 'angry');
  assert.equal(readMood('sheepish'), 'worried');
  assert.equal(readMood('apoplectic'), null);
  assert.equal(readMood(''), null);
  assert.equal(readMood(7), null);
});

test('making a line fit to show: cleanSpoken', () => {
  assert.equal(cleanSpoken('  "He is  more of a\nlarge cat."  '), 'He is more of a large cat.');
  assert.equal(cleanSpoken('*sighs* A fee' + EM + 'for a cow.'), 'A fee, for a cow.');
  assert.equal(cleanSpoken('Wait ' + EN + ' what? No!'), 'Wait, what? No.');
  assert.equal(cleanSpoken('We go! Under protest!!', { loud: true }), 'We go! Under protest!');
  assert.equal(cleanSpoken('Marta: It leaks.', { speakerFirst: 'Marta' }), 'It leaks.');
  assert.equal(cleanSpoken('As an AI, I cannot own a griffin.'), '');
  assert.equal(cleanSpoken('This is a video game about rent.'), '');
  assert.equal(cleanSpoken(42), '');
  assert.equal(cleanSpoken('...'), '');
  const long = cleanSpoken('One sentence here. '.repeat(40));
  assert.ok(long.length <= REPLY_CAP && long.endsWith('here.'));
  const unbroken = cleanSpoken('word '.repeat(100));
  assert.ok(unbroken.length <= REPLY_CAP && unbroken.endsWith('.'));
  assert.equal(cleanSpoken('He is house-trained, mostly.'), 'He is house-trained, mostly.', 'hyphens inside words survive');
});

test('numbers, spans of time and plain promises', () => {
  assert.deepEqual(numbersIn('Ten crowns now and twenty five later, or 40.').sort((a, b) => a - b), [10, 25, 40]);
  assert.deepEqual(numbersIn('two hundred and five crowns'), [205]);
  assert.deepEqual(numbersIn('nothing to count here'), []);
  assert.equal(monthsIn('for two years', 0), 24);
  assert.equal(monthsIn('not this year', 0), 12);
  assert.equal(monthsIn('within three months', 0), 3);
  assert.equal(monthsIn('before the first frost', 34), 8);
  assert.equal(monthsIn('by winter', 9 * 30 + 2), 12, 'said in winter, it means next winter');
  assert.equal(monthsIn('by Rent Day', 0), 1);
  assert.equal(monthsIn('soon', 0), null);
  assert.deepEqual(oathsInSpeech('I will mend the roof. He stays.', 0), [], 'no pledge word, no oath');
  const a = oathsInSpeech('Your rent will not rise for two years. You have my word.', 0);
  assert.equal(a.length, 1);
  assert.equal(a[0]!.kind, 'no_rent_raise');
  assert.equal(a[0]!.months, 24);
  assert.equal(a[0]!.text, 'Your rent will not rise for two years.');
  const b = oathsInSpeech('I swear I will never evict you while the snow lies.', 0);
  assert.equal(b[0]!.kind, 'no_evict');
  const c = oathsInSpeech('I promise to pay you ten crowns by Rent Day.', 0);
  assert.equal(c[0]!.kind, 'pay');
  assert.equal(c[0]!.amount, 10);
  assert.equal(c[0]!.months, 1);
  const d = oathsInSpeech('I vow to build a well by summer.', 0);
  assert.equal(d[0]!.kind, 'build');
  const e = oathsInSpeech('I promise you a place at the harvest feast.', 0);
  assert.equal(e[0]!.kind, 'word');
});

test('how an outcome lands with the petitioner', () => {
  const late = INCIDENT_BY_ID.sys_late_rent!;
  const f = (id: string): number => outcomeFeeling(late.outcomes.find(o => o.id === id)!);
  assert.ok(f('forgive') > f('payment_plan') && f('payment_plan') > f('wait') && f('wait') > f('late_fee') && f('late_fee') > f('notice'));
});

test('the prompt for other petitioners: goblin chief, applicant, departed tenant, late turns', () => {
  const state = makeFixtureState('knight');
  const goblins = Object.values(state.incidents).find(i => i.defId === 'sys_squatters_goblins')!;
  const gdef = INCIDENT_BY_ID.sys_squatters_goblins!;
  const gcast = resolveCast(state, goblins, gdef);
  const g = buildAudiencePrompt({ state, incident: goblins, def: gdef, cast: gcast, vars: audienceVars(state, goblins, gcast), lines: [], rulerText: 'Out.', turn: 9, maxTurns: 10 });
  assert.ok(g.system.includes(SPECIES_NOTES[gcast.speaker.species]));
  assert.match(g.system, /You are not one of the ruler's tenants/);
  assert.match(g.system, /"revealed": always \[\]/);
  assert.match(g.system, /You may shout now and then/);
  assert.match(g.system, /it costs the ruler 10 crowns/);
  assert.match(g.messages[0]!.content, /court is growing restless/);
  assert.match(g.messages[0]!.content, /nothing has been said yet/);
  assert.ok(!/[{}]/.test(g.system.replace(/\{"reply"[^\n]*/g, '').replace(/\{"kind"[^}\n]*\}/g, '')), 'no unfilled placeholders outside the JSON shape lines');

  const dep = stageIncident(state, 'sys_move_out_deposit')!;
  const ddef = INCIDENT_BY_ID.sys_move_out_deposit!;
  const dcast = resolveCast(state, dep, ddef);
  const d = buildAudiencePrompt({ state, incident: dep, def: ddef, cast: dcast, vars: audienceVars(state, dep, dcast), lines: [], rulerText: 'Well?', turn: 1, maxTurns: 10 });
  assert.match(d.system, /You have lately moved out of/);
  assert.match(d.system, /the whole surety of \d+ crowns is returned/);
  assert.ok(!DASH.test(d.system));
});

// ───────────────────────────── the microphone ─────────────────────────────

class FakeRec {
  static made: FakeRec[] = [];
  static neverEnds = false;
  static refuseLang: string | null = null;
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 0;
  onstart: ((e: unknown) => void) | null = null;
  onresult: ((e: { results: unknown }) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: ((e: unknown) => void) | null = null;
  started = 0; stops = 0; aborts = 0;
  constructor() { FakeRec.made.push(this); }
  start(): void {
    if (this.started) throw new Error('InvalidStateError');
    this.started++;
    if (FakeRec.refuseLang && this.lang === FakeRec.refuseLang) { queueMicrotask(() => { this.onerror?.({ error: 'language-not-supported' }); this.onend?.({}); }); return; }
    this.onstart?.({});
  }
  stop(): void { this.stops++; if (!FakeRec.neverEnds) queueMicrotask(() => this.onend?.({})); }
  abort(): void { this.aborts++; queueMicrotask(() => { this.onerror?.({ error: 'aborted' }); this.onend?.({}); }); }
  hear(...pieces: [string, boolean][]): void {
    const results = pieces.map(([transcript, isFinal]) => ({ 0: { transcript }, length: 1, isFinal }));
    this.onresult?.({ results: Object.assign(results, { length: results.length }) });
  }
  fail(code: string): void { this.onerror?.({ error: code }); this.onend?.({}); }
}
function micScope(language?: string, webkit = false): MicScope {
  FakeRec.made = []; FakeRec.neverEnds = false; FakeRec.refuseLang = null;
  const ctor = FakeRec as unknown as RecCtor;
  return { ...(webkit ? { webkitSpeechRecognition: ctor } : { SpeechRecognition: ctor }), navigator: { language } };
}
interface Heard { partial: string[]; final: string[]; errors: string[] }
function ears(): Heard & { handlers: Parameters<ReturnType<typeof createMic>['start']>[0] } {
  const h: Heard = { partial: [], final: [], errors: [] };
  return { ...h, handlers: { onPartial: t => h.partial.push(t), onFinal: t => h.final.push(t), onError: c => h.errors.push(c) } };
}

test('mic: unsupported where there is no recogniser (as in node)', () => {
  const real = createMic();
  assert.equal(real.supported, false);
  const e = ears();
  real.start(e.handlers);
  assert.deepEqual(e.errors, ['unsupported']);
  assert.equal(real.listening, false);
  real.stop();
  const bare = createMic({});
  assert.equal(bare.supported, false);
});

test('mic: partial transcripts stream, stop finalises once, listening stays honest', async () => {
  const mic = createMic(micScope('en-GB'));
  assert.equal(mic.supported, true);
  assert.equal(mic.listening, false);
  const e = ears();
  mic.start(e.handlers);
  assert.equal(mic.listening, true);
  const rec = FakeRec.made[0]!;
  assert.equal(rec.lang, 'en-GB');
  assert.ok(rec.continuous && rec.interimResults);
  rec.hear(['never evict', false]);
  rec.hear(['never evict a widow', false]);
  rec.hear(['Never evict a widow', true], [' in winter', false]);
  assert.deepEqual(e.partial, ['never evict', 'never evict a widow', 'Never evict a widow in winter']);
  mic.start(e.handlers);
  assert.equal(FakeRec.made.length, 1, 'a double start begins nothing new');
  mic.stop();
  assert.equal(mic.listening, false, 'not listening the moment the seal is released');
  mic.stop();
  assert.equal(rec.stops, 1);
  rec.hear(['Never evict a widow', true], [' in winter.', true]);
  await sleep(1);
  assert.deepEqual(e.final, ['Never evict a widow in winter.']);
  assert.deepEqual(e.errors, []);
  rec.onend?.({});
  assert.equal(e.final.length, 1, 'onFinal fires once');
});

test('mic: language falls back to en-US; webkit prefix is found; refused language is retried', async () => {
  const mic = createMic(micScope(undefined, true));
  assert.equal(mic.supported, true);
  const e = ears();
  mic.start(e.handlers);
  assert.equal(FakeRec.made[0]!.lang, 'en-US');
  mic.stop();
  await sleep(1);
  assert.deepEqual(e.errors, ['no_speech'], 'a run that hears nothing says so');

  for (const [raw, want] of [['en-US@posix', 'en-US'], ['de_DE.UTF-8', 'de-DE'], ['C', 'en-US'], ['', 'en-US'], ['pt-BR', 'pt-BR']] as const) {
    const m = createMic(micScope(raw));
    m.start(ears().handlers);
    assert.equal(FakeRec.made[0]!.lang, want, `navigator.language "${raw}"`);
    m.stop();
  }
  await sleep(1);

  const scope = micScope('xx-XX');
  FakeRec.refuseLang = 'xx-XX';
  const mic2 = createMic(scope);
  const e2 = ears();
  mic2.start(e2.handlers);
  await sleep(1);
  assert.equal(FakeRec.made.length, 2, 'a second recogniser was started');
  assert.equal(FakeRec.made[1]!.lang, 'en-US');
  assert.equal(mic2.listening, true);
  FakeRec.made[1]!.hear(['hold a feast', true]);
  mic2.stop();
  await sleep(1);
  assert.deepEqual(e2.final, ['hold a feast']);
  assert.deepEqual(e2.errors, []);
});

test('mic: errors are mapped; a denial ends the run at once', async () => {
  const cases: [string, string][] = [['not-allowed', 'denied'], ['service-not-allowed', 'denied'], ['no-speech', 'no_speech'], ['audio-capture', 'error'], ['network', 'error']];
  for (const [code, want] of cases) {
    const mic = createMic(micScope('en-US'));
    const e = ears();
    mic.start(e.handlers);
    FakeRec.made[0]!.fail(code);
    assert.deepEqual(e.errors, [want], code);
    assert.deepEqual(e.final, []);
    assert.equal(mic.listening, false, code);
    mic.start(e.handlers);
    assert.equal(FakeRec.made.length, 2, 'and the mic can be started again');
    assert.equal(mic.listening, true);
  }
  const mic = createMic(micScope('en-US'));
  const e = ears();
  mic.start(e.handlers);
  FakeRec.made[0]!.hear(['collect the rents', true]);
  FakeRec.made[0]!.fail('no-speech');
  assert.deepEqual(e.final, ['collect the rents'], 'words already heard are not thrown away by a late silence');
  assert.deepEqual(e.errors, []);
});

test('mic: repeated pieces are joined once; a recogniser that never ends is wrapped up', async () => {
  const mic = createMic(micScope('en-US'));
  const e = ears();
  mic.start(e.handlers);
  const rec = FakeRec.made[0]!;
  rec.hear(['fix', true], ['fix the', true], ['fix the roof', true]);
  assert.equal(e.partial[e.partial.length - 1], 'fix the roof');
  FakeRec.neverEnds = true;
  mic.stop();
  mic.start(e.handlers);
  assert.deepEqual(e.final, ['fix the roof'], 'starting again takes what the last run had');
  assert.equal(FakeRec.made.length, 2);
  assert.equal(mic.listening, true);
  FakeRec.made[1]!.hear(['and the chimney', false]);
  mic.stop();
  assert.equal(e.final.length, 1);
  await sleep(1700);
  assert.deepEqual(e.final, ['fix the roof', 'and the chimney'], 'after a short wait the mic takes what it has');
  assert.ok(FakeRec.made[1]!.aborts >= 1);
  assert.equal(mic.listening, false);
});

// ───────────────────────────── run ─────────────────────────────

(async () => {
  let failed = 0;
  const realLog = console.error;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log('  ok   ' + name);
    } catch (e) {
      failed++;
      console.log('  FAIL ' + name);
      console.log(String((e as Error)?.stack ?? e).split('\n').map(l => '       ' + l).join('\n'));
    }
  }
  console.error = realLog;
  console.log(`\n${tests.length - failed} of ${tests.length} passed.`);
  process.exit(failed ? 1 : 0);
})();
