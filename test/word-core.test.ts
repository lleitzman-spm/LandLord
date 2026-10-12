/**
 * Tests for the Word (speech → orders):  npx tsx test/word-core.test.ts
 *
 *  - the validator against hand-written model replies: good, malformed, hostile
 *  - the offline parser across fifty-odd phrasings
 *  - the confirm flow, refusals, transport failures, the log
 *  - the digest, the prompt, and transport detection
 *
 * Uses a scripted ModelClient and the development fixture's fakeSim. No network.
 */
import assert from 'node:assert/strict';
import { makeFixtureState, fakeSim } from '../src/dev/fixture';
import type { Action, ActionResult, GameState, StandingOrder, Oath, Applicant, Incident } from '../src/sim/types';
import type { Exchange, ModelClient, ModelRequest, SpeakTarget, WordDeps } from '../src/word/api';
import { createWord } from '../src/word/index';
import { parseReply, validateActions, loosen, proseLine, scrubIds } from '../src/word/interpret';
import { parseOffline, numberize, prep, parseDue, weigh, describeAction, fillAck, clip } from '../src/word/offline';
import { buildDigest, DIGEST_CAP, DIGEST_CAP_LEAN } from '../src/word/digest';
import { buildOrderPrompt, ORDER_SYSTEM, ORDER_SYSTEM_LEAN, SPOKEN_ACTIONS } from '../src/word/prompts';
import { detectModel, ModelError } from '../src/word/model';

// ───────────────────────── harness ─────────────────────────

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; } catch (e) { failures.push(`${name}\n    ${(e as Error).message.split('\n').join('\n    ')}`); }
}
const quiet = <T>(f: () => T): T => { const log = console.log; console.log = () => {}; try { return f(); } finally { console.log = log; } };

type Rank = 'reeve' | 'knight' | 'baron';
interface Court { state: GameState; deps: WordDeps; log: Action[]; refuse: Map<string, string> }

/** fakeSim, plus a real order book and oath ledger (so created orders and oaths can be found), plus refusals on demand. */
function court(rank: Rank = 'knight'): Court {
  const state = makeFixtureState(rank);
  const sim = fakeSim(state);
  const refuse = new Map<string, string>();
  let n = 0;
  const deps: WordDeps = {
    getState: () => state,
    dispatch(a: Action): ActionResult {
      const no = refuse.get(a.type);
      if (no) return { ok: false, code: 'no_gold', reason: no };
      const r = quiet(() => sim.dispatch(a));
      if (a.type === 'add_order') { const o: StandingOrder = { ...a.order, id: `on${++n}`, createdDay: state.day, uses: 0 }; state.orders.push(o); return { ok: true, id: o.id }; }
      if (a.type === 'swear_oath') { const o: Oath = { ...a.oath, id: `wn${++n}`, madeDay: state.day, state: 'open', settledDay: null }; state.oaths.push(o); return { ok: true, id: o.id }; }
      if (a.type === 'revoke_order') state.orders = state.orders.filter(o => o.id !== a.orderId);
      return r;
    },
  };
  return { state, deps, log: sim.log, refuse };
}
function scripted(replies: (string | Error)[], engine?: 'claude' | 'workers-ai'): ModelClient & { calls: ModelRequest[]; engine?: 'claude' | 'workers-ai' } {
  const calls: ModelRequest[] = [];
  let i = 0;
  return {
    kind: 'server', calls, ...(engine ? { engine } : {}),
    async complete(req: ModelRequest): Promise<string> {
      calls.push(req);
      const r = replies[Math.min(i++, replies.length - 1)]!;
      if (r instanceof Error) throw r;
      return r;
    },
  };
}
const NONE: ModelClient = { kind: 'none', complete: () => Promise.reject(new Error('none')) };
const COURT: SpeakTarget = { to: 'court' };

const bId = (s: GameState, name: string) => { const b = Object.values(s.buildings).find(x => x.name === name); assert.ok(b, `fixture has no building "${name}"`); return b.id; };
const tId = (s: GameState, name: string) => { const t = Object.values(s.tenants).find(x => x.name === name); assert.ok(t, `fixture has no household "${name}"`); return t.id; };
const incId = (s: GameState, defId: string) => { const i = Object.values(s.incidents).find(x => x.defId === defId); assert.ok(i, `fixture has no incident "${defId}"`); return i.id; };
const sId = (s: GameState, role: string) => { const m = Object.values(s.staff).find(x => x.role === role); assert.ok(m, `fixture has no ${role}`); return m.id; };
const reply = (o: Record<string, unknown>) => JSON.stringify({ speaker: 'herald', reply: 'So noted.', mood: 'neutral', understood: true, actions: [], confirm: false, ...o });
const noDash = (t: string) => assert.ok(!/[—–]/.test(t), `has a dash: ${t}`);

/** Adds what the fixture lacks: an applicant waiting on Damp End, and a late-rent matter for Wat Mudge. */
function withApplicantAndLateRent(c: Court): { applicant: Applicant; late: Incident; appInc: Incident } {
  const s = c.state;
  const applicant: Applicant = {
    id: 'pz1', buildingId: bId(s, 'Damp End'), unit: 0, arrivedDay: s.day - 1, leavesDay: s.day + 6, maxRent: 11, shown: false, screened: false, actorId: null,
    household: { id: 'tz1', name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 9, household: 3, traits: ['handy'], revealed: [], tags: ['newlyweds'], pets: [], income: 44, reliability: 0.8 },
  };
  s.applicants[applicant.id] = applicant;
  const wat = tId(s, 'Wat Mudge');
  const mk = (id: string, defId: string, extra: Partial<Incident>): Incident => {
    const inc: Incident = { id, defId, state: 'open', buildingId: null, unit: 0, tenantId: null, applicantId: null, startedDay: s.day - 1, expiresDay: s.day + 9, vars: {}, outcomeId: null, resolvedBy: null, jobId: null, actorId: null, reported: false, ...extra };
    s.incidents[id] = inc; return inc;
  };
  const late = mk('iz1', 'sys_late_rent', { tenantId: wat, buildingId: s.tenants[wat]!.buildingId, vars: { tenant: 'Wat Mudge', first: 'Wat' } });
  const appInc = mk('iz2', 'sys_applicant', { applicantId: applicant.id, buildingId: applicant.buildingId, vars: { tenant: 'Jory Applewhite' } });
  return { applicant, late, appInc };
}

// ───────────────────────── tests ─────────────────────────

async function main(): Promise<void> {

  // ── reading replies ──────────────────────────────────────────────────────
  await test('parseReply: plain JSON', () => {
    const r = parseReply(reply({ speaker: 'Mason', reply: 'Aye.' }));
    assert.ok(r); assert.equal(r.speaker, 'mason'); assert.equal(r.reply, 'Aye.'); assert.equal(r.understood, true);
  });
  await test('parseReply: code fence, prose around it, trailing commas, curly quotes', () => {
    const r = parseReply('Certainly. Here is the answer:\n```json\n{"speaker":"bailiff","reply":“Done.”,"understood":true,"actions":[{"type":"collect_all"},],"confirm":false,}\n```\nI hope that helps.');
    assert.ok(r, 'should parse'); assert.equal(r.actions.length, 1); assert.equal(r.speaker, 'bailiff');
  });
  await test('parseReply: a reply cut off mid-action still yields the complete part', () => {
    const r = parseReply('{"speaker":"mason","reply":"The roof. Aye.","mood":"neutral","understood":true,"actions":[{"type":"collect_all"},{"type":"order_job","kind":"rep');
    assert.ok(r, 'should parse'); assert.equal(r.reply, 'The roof. Aye.'); assert.ok(r.actions.length >= 1);
  });
  await test('parseReply: prose, empty and nonsense are not replies', () => {
    assert.equal(parseReply('I am sorry, I cannot help with that.'), null);
    assert.equal(parseReply(''), null);
    assert.equal(parseReply('{{{{'), null);
    assert.equal(parseReply('{"weather":"fine"}'), null);
  });

  // ── the validator: good replies ──────────────────────────────────────────
  await test('validate: resolve_incident with a real outcome', () => {
    const { state } = court();
    const v = validateActions([{ type: 'resolve_incident', incidentId: incId(state, 'sys_repair_leak'), outcomeId: 'patch' }], state, 'patch it');
    assert.deepEqual(v.actions, [{ type: 'resolve_incident', incidentId: incId(state, 'sys_repair_leak'), outcomeId: 'patch' }]); assert.equal(v.dropped.length, 0);
  });
  await test('validate: standing order keeps the ruler\'s verbatim words whatever the model wrote', () => {
    const { state } = court();
    const said = 'Agnes, never evict a widow in winter.';
    const v = validateActions([{ type: 'add_order', order: { to: 'bailiff', text: 'Under no circumstances shall widows be removed (paraphrased)', gist: 'No widows out in winter.', decision: 'eviction_ready', incidentDef: null, when: [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'season', op: '==', value: 'winter' }], rule: 'never', option: 'evict', outcomeId: null } }], state, said);
    assert.equal(v.actions.length, 1);
    const a = v.actions[0]!; assert.equal(a.type, 'add_order');
    if (a.type !== 'add_order') return;
    assert.equal(a.order.text, said); assert.equal(a.order.gist, 'No widows out in winter.');
    assert.equal(a.order.rule, 'never'); assert.equal(a.order.option, 'evict'); assert.equal(a.order.when.length, 2); assert.equal(a.order.outcomeId, null);
  });
  await test('validate: an excerpt the ruler really said is kept as the order text', () => {
    const { state } = court();
    const v = validateActions([{ type: 'add_order', order: { to: 'mason', text: 'always mend properly', gist: 'Proper work.', decision: 'repair', when: [], rule: 'choose', option: 'fix' } }], state, 'Collect the rents, and Hob, always mend properly.');
    const a = v.actions[0]!; assert.ok(a && a.type === 'add_order' && a.order.text === 'always mend properly');
  });
  await test('validate: several moves, numbers given as strings, ranges clamped', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'collect_all' },
      { type: 'order_job', kind: 'repair', buildingId: bId(state, 'Ploughwright Mill') },
      { type: 'set_policy', policy: { graceDays: '3', lateFeePct: 250, pets: 'BAN', nonsense: 9 } },
      { type: 'set_rent', buildingId: bId(state, 'Thistle Cottage'), rent: '18 crowns' },
      { type: 'set_wage', staffId: 'mason', wage: '20' },
    ], state, 'x');
    assert.equal(v.dropped.length, 0, JSON.stringify(v.dropped));
    assert.deepEqual(v.actions[2], { type: 'set_policy', policy: { graceDays: 3, lateFeePct: 100, pets: 'ban' } });
    assert.deepEqual(v.actions[3], { type: 'set_rent', buildingId: bId(state, 'Thistle Cottage'), rent: 18 });
    assert.deepEqual(v.actions[4], { type: 'set_wage', staffId: sId(state, 'mason'), wage: 20 });
  });
  await test('validate: a name given where an id belongs is resolved when it can mean only one thing', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'order_job', kind: 'repair', buildingId: 'The Leaning Hovel' },
      { type: 'gift', tenantId: 'Old Marta Thistlewick', amount: 5 },
      { type: 'order_job', kind: 'serve_notice', tenantId: 'Wat' },
    ], state, 'x');
    assert.equal(v.dropped.length, 0, JSON.stringify(v.dropped));
    assert.deepEqual(v.actions[0], { type: 'order_job', kind: 'repair', buildingId: bId(state, 'The Leaning Hovel') });
    assert.deepEqual(v.actions[1], { type: 'gift', tenantId: tId(state, 'Old Marta Thistlewick'), amount: 5 });
    assert.deepEqual(v.actions[2], { type: 'order_job', kind: 'serve_notice', tenantId: tId(state, 'Wat Mudge'), buildingId: bId(state, 'Mudlark Hovel') });
  });
  await test('validate: oath gets its due day, its name, and falls back to plain word when it lacks what its kind needs', () => {
    const { state } = court();
    const marta = tId(state, 'Old Marta Thistlewick');
    const v = validateActions([
      { type: 'swear_oath', oath: { kind: 'repair', text: 'That roof will be mended before winter.', toTenantId: marta, toName: 'someone else entirely', buildingId: null, dueDay: 270 } },
      { type: 'swear_oath', oath: { kind: 'no_evict', text: 'You will not be put out.', toTenantId: marta, days: 60 } },
      { type: 'swear_oath', oath: { kind: 'pay', text: 'I will pay somebody something.', toTenantId: null, amount: null } },
      { type: 'swear_oath', oath: { kind: 'build', text: 'There will be a well.', buildingType: 'well', dueDay: 5 } },
    ], state, 'x');
    assert.equal(v.actions.length, 4, JSON.stringify(v.dropped));
    const o = v.actions.map(a => (a.type === 'swear_oath' ? a.oath : null)!);
    assert.equal(o[0]!.kind, 'repair'); assert.equal(o[0]!.buildingId, bId(state, 'The Leaning Hovel')); assert.equal(o[0]!.toName, 'Old Marta Thistlewick'); assert.equal(o[0]!.dueDay, 270);
    assert.equal(o[1]!.kind, 'no_evict'); assert.equal(o[1]!.dueDay, Math.floor(state.day) + 60);
    assert.equal(o[2]!.kind, 'word'); assert.equal(o[2]!.toName, 'the realm'); assert.equal(o[2]!.amount, null);
    assert.equal(o[3]!.kind, 'build'); assert.equal(o[3]!.buildingType, 'well'); assert.ok(o[3]!.dueDay > state.day, 'a due day in the past is replaced');
  });

  // ── the validator: hostile and broken replies ───────────────────────────
  await test('validate: unknown ids are dropped', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'order_job', kind: 'repair', buildingId: 'b999' }, { type: 'gift', tenantId: 't999', amount: 3 },
      { type: 'resolve_incident', incidentId: 'i999', outcomeId: 'fix' }, { type: 'revoke_order', orderId: 'o999' },
      { type: 'hire', candidateId: 'c999' }, { type: 'dismiss_staff', staffId: 's999' }, { type: 'set_rent', buildingId: bId(state, 'Well'), rent: 5 },
    ], state, 'x');
    assert.equal(v.actions.length, 0); assert.equal(v.dropped.length, 7); assert.ok(v.dropped.every(d => d.why === 'unknown_id'));
  });
  await test('validate: an outcome that belongs to a different matter is dropped', () => {
    const { state } = court();
    const v = validateActions([{ type: 'resolve_incident', incidentId: incId(state, 'sys_repair_leak'), outcomeId: 'ban' }], state, 'x');
    assert.equal(v.actions.length, 0); assert.equal(v.dropped[0]!.why, 'unknown_id');
  });
  await test('validate: place_building, roads, demolition and land are never done by word', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'place_building', btype: 'tavern', x: 3, y: 3, rot: 0 }, { type: 'place_road', tiles: [[1, 1]] }, { type: 'demolish', buildingId: bId(state, 'Damp End') },
      { type: 'buy_parcel', parcelId: 2 }, { type: 'order_job', kind: 'demolish', buildingId: bId(state, 'Damp End') }, { type: 'order_job', kind: 'build', buildingId: bId(state, 'Damp End') },
    ], state, 'x');
    assert.equal(v.actions.length, 0); assert.ok(v.dropped.every(d => d.why === 'by_hand'), JSON.stringify(v.dropped));
    assert.match(v.dropped[0]!.note, /placed by hand/);
  });
  await test('validate: actions that exist but are not for speech, and inventions, are dropped', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'abdicate' }, { type: 'set_flag', key: 'gold', value: 99999 }, { type: 'take_loan', amount: 5000 }, { type: 'set_speed', speed: 4 },
      { type: 'accept_promotion' }, { type: 'grant_gold', amount: 1e6 }, { type: 'order_job', kind: 'incident', buildingId: bId(state, 'Damp End') }, 'evict everyone', null, 42,
    ], state, 'x');
    assert.equal(v.actions.length, 0); assert.equal(v.dropped.length, 9, 'a null is nothing at all; the rest are struck');
  });
  await test('validate: words that are also keys of every object are only words', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'order_job', kind: 'constructor', tenantId: '__proto__' }, { type: 'constructor' }, { type: 'gift', tenantId: 'constructor', amount: 1 },
      { type: 'resolve_incident', incidentId: '__proto__', outcomeId: 'toString' }, { type: 'add_order', order: { decision: null, incidentDef: '__proto__', outcomeId: 'x', rule: 'choose', when: [] } },
      { type: 'add_order', order: { decision: 'repair', rule: 'choose', option: 'fix', when: [{ field: 'constructor', op: 'valueOf', value: 'hasOwnProperty' }] } },
      JSON.parse('{"__proto__": {"type": "collect_all"}, "type": "hasOwnProperty"}'),
    ], state, 'x');
    assert.equal(v.actions.length, 0, JSON.stringify(v.actions)); assert.equal(v.dropped.length, 7);
    assert.equal(parseReply('{"speaker": toString, "reply": constructor, "actions": [__proto__]}')?.reply, 'constructor');
    assert.equal(numberize(prep('pay the constructor twenty crowns').toks), 'pay the constructor 20 crowns');
  });
  await test('validate: "no move" said the long way round is no move, not a mistake', () => {
    const { state } = court();
    const v = validateActions([{ type: 'none' }, {}, null, { type: 'no_action' }, '', { action: 'reply' }], state, 'x');
    assert.equal(v.actions.length, 0); assert.equal(v.dropped.length, 0, JSON.stringify(v.dropped));
  });
  await test('validate: a 10,000 crown gift is more than the coffers hold', () => {
    const { state } = court();
    const v = validateActions([{ type: 'gift', tenantId: tId(state, 'Wat Mudge'), amount: 10000 }], state, 'x');
    assert.equal(v.actions.length, 0); assert.equal(v.dropped[0]!.why, 'too_much'); assert.match(v.dropped[0]!.note, /coffers hold but 412 crowns/);
  });
  await test('validate: an option that does not belong to its decision is not an order', () => {
    const { state } = court();
    const v = validateActions([
      { type: 'add_order', order: { to: 'bailiff', text: 'x', gist: 'x', decision: 'late_rent', when: [], rule: 'choose', option: 'evict' } },
      { type: 'add_order', order: { to: 'bailiff', text: 'x', gist: 'x', decision: 'custom', when: [], rule: 'choose', option: null } },
      { type: 'add_order', order: { to: 'bailiff', text: 'x', gist: 'x', decision: 'eviction_ready', when: [], rule: 'sometimes', option: 'evict' } },
      { type: 'add_order', order: { to: 'bailiff', text: 'x', gist: 'x', decision: null, incidentDef: 'no_such_def', outcomeId: 'x', when: [], rule: 'choose' } },
    ], state, 'x');
    assert.equal(v.actions.length, 0); assert.equal(v.dropped.length, 4);
  });
  await test('validate: a rule with a condition that makes no sense is refused whole, never broadened', () => {
    const { state } = court();
    const base = { to: 'bailiff', text: 'x', gist: 'x', decision: 'eviction_ready', rule: 'never', option: 'evict' };
    const bad = [
      [{ field: 'tenant.shoeSize', op: '>', value: 9 }], [{ field: 'season', op: '==', value: 'monsoon' }], [{ field: 'tenant.tags', op: 'includes', value: 'wizardly' }],
      [{ field: 'gold', op: 'includes', value: 5 }], [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'month', op: '==', value: 14 }], [{ field: 'building.id', op: '==', value: 'b999' }],
    ];
    for (const when of bad) {
      const v = validateActions([{ type: 'add_order', order: { ...base, when } }], state, 'x');
      assert.equal(v.actions.length, 0, JSON.stringify(when));
    }
    const ok = validateActions([{ type: 'add_order', order: { ...base, when: [{ field: 'tenant.tags', op: '==', value: 'Widow' }, { field: 'month', op: '==', value: 'Deepwinter' }, { field: 'tenant.arrears', op: '<', value: '20' }] } }], state, 'x');
    const a = ok.actions[0]!; assert.ok(a && a.type === 'add_order');
    if (a.type === 'add_order') assert.deepEqual(a.order.when, [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'month', op: '==', value: 10 }, { field: 'tenant.arrears', op: '<', value: 20 }]);
  });

  // ── what smaller models actually write ───────────────────────────────────
  const FULL = '{"speaker":"bailiff","reply":"Every purse, Sir.","mood":"neutral","understood":true,"actions":[{"type":"collect_all"}],"confirm":false}';
  await test('parseReply: prose, thinking and template tokens around the JSON', () => {
    const cases = [
      `<think>The ruler wants the rents. I should use {collect_all}. Let me write it.</think>\n${FULL}`,
      `Sure! I will answer in the format {speaker, reply, actions}. Here it is:\n\n${FULL}\n\nNote: I chose {"type":"collect_all"} because the ruler said "rents".`,
      `Here is the JSON object:\n\`\`\`\n${FULL}\n\`\`\`\nLet me know if you need anything else {really}.`,
      `${FULL}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
      `Answer: ${FULL} }`,
      `{"type":"collect_all"}\n\n${FULL}`,
      `${FULL}\n${FULL.replace('Every purse, Sir.', 'A second thought.')}`,
    ];
    for (const c of cases) {
      const r = parseReply(c);
      assert.ok(r, `should parse: ${c.slice(0, 60)}`);
      assert.equal(r.speaker, 'bailiff', c.slice(0, 60)); assert.equal(r.reply, 'Every purse, Sir.', c.slice(0, 60));
      assert.deepEqual(r.actions, [{ type: 'collect_all' }], c.slice(0, 60)); assert.equal(r.understood, true);
    }
  });
  await test('parseReply: almost-JSON (single quotes, bare keys, Python literals, comments, stray quotes, line breaks)', () => {
    const py = parseReply("{'speaker': 'bailiff', 'reply': 'Aye, Sir. It's done by dusk.', 'understood': True, 'actions': [{'type': 'collect_all'}], 'confirm': False, 'mood': None}");
    assert.ok(py); assert.equal(py.reply, "Aye, Sir. It's done by dusk."); assert.equal(py.understood, true); assert.equal(py.confirm, false); assert.equal(py.actions.length, 1);
    const bare = parseReply('{speaker: "mason", reply: "The roof, Sir.", understood: true, actions: [{type: order_job, kind: repair, buildingId: "#b2"},], confirm: false}');
    assert.ok(bare); assert.equal(bare.speaker, 'mason'); assert.deepEqual(bare.actions, [{ type: 'order_job', kind: 'repair', buildingId: '#b2' }]);
    const quotes = parseReply('{"speaker":"bailiff","reply":"He said "aye" and left.","actions":[], "understood": true}');
    assert.ok(quotes); assert.equal(quotes.reply, 'He said "aye" and left.');
    const lines = parseReply('{\n  "speaker": "herald",   // the clerk\n  "reply": "So noted.\nIt is entered.",\n  /* nothing to do */\n  "actions": []\n}');
    assert.ok(lines); assert.equal(lines.reply, 'So noted. It is entered.'); assert.equal(lines.speaker, 'herald');
    assert.equal(loosen("{'a': 1, b: [True, None,], }"), '{"a": 1, "b": [true, null] }');
    assert.equal(loosen('{"n": -3.5e2, "s": "x"}'), '{"n": -3.5e2, "s": "x"}');
  });
  await test('parseReply: wrappers, other key names, only moves, and a reply cut off anywhere', () => {
    const wrapped = parseReply(`{"response": ${FULL}}`);
    assert.ok(wrapped); assert.equal(wrapped.reply, 'Every purse, Sir.');
    const stringly = parseReply(JSON.stringify({ result: FULL }));
    assert.ok(stringly); assert.equal(stringly.actions.length, 1);
    const named = parseReply('{"Speaker":"Agnes","read_back":"Every purse.","moves":[{"action":"collect_all"}],"needs_confirm":"yes"}');
    assert.ok(named); assert.equal(named.speaker, 'agnes'); assert.equal(named.reply, 'Every purse.'); assert.equal(named.actions.length, 1); assert.equal(named.confirm, true);
    const moves = parseReply('[{"type":"collect_all"},{"type":"hold_feast"}]');
    assert.ok(moves); assert.equal(moves.actions.length, 2); assert.equal(moves.reply, '');
    for (let cut = 30; cut < FULL.length; cut += 7) {
      const r = parseReply(FULL.slice(0, cut));
      if (cut > 50) { assert.ok(r, `cut at ${cut}: ${FULL.slice(0, cut)}`); assert.equal(r.speaker, 'bailiff'); }
    }
    assert.equal(parseReply('The format is {"speaker": one of the roles} and so on.'), null);
  });
  await test('validate: ids as a model writes them', () => {
    const { state } = court();
    const hovel = bId(state, 'The Leaning Hovel'), marta = tId(state, 'Old Marta Thistlewick'), leak = incId(state, 'sys_repair_leak');
    const v = validateActions([
      { type: 'order_job', kind: 'repair', buildingId: `#${hovel}` },
      { type: 'order_job', kind: 'inspect', buildingId: `${hovel} (The Leaning Hovel)` },
      { type: 'order_job', kind: 'renovate', buildingId: hovel.toUpperCase() },
      { type: 'gift', tenantId: `[#${marta}]`, amount: 3 },
      { type: 'resolve_incident', incidentId: `#${leak}`, outcomeId: 'patch' },
      { type: 'resolve_incident', incidentId: `${leak}: A Leak in the Roof`, outcomeId: 'Patch it cheap' },
      { type: 'revoke_order', orderId: '#o1' },
    ], state, 'x');
    assert.equal(v.dropped.length, 0, JSON.stringify(v.dropped));
    assert.deepEqual(v.actions.map(a => ('buildingId' in a ? a.buildingId : 'tenantId' in a ? a.tenantId : 'incidentId' in a ? a.incidentId : 'orderId' in a ? a.orderId : '')), [hovel, hovel, hovel, marta, leak, leak, 'o1']);
    assert.deepEqual(v.actions[5], { type: 'resolve_incident', incidentId: leak, outcomeId: 'patch' });
  });
  await test('validate: shapes as a model writes them (bare names, function calls, nested and snake_case arguments, other verbs)', () => {
    const { state } = court();
    const hovel = bId(state, 'The Leaning Hovel'), marta = tId(state, 'Old Marta Thistlewick'), wat = tId(state, 'Wat Mudge'), row = bId(state, 'The Long Row');
    const v = validateActions([
      'collect_all',
      { hold_feast: {} },
      { name: 'gift', arguments: { tenant: 'Marta', crowns: '5' } },
      { function: { name: 'set_rent', arguments: '{"building_id": "#' + hovel + '", "rent": 9}' } },
      { action: 'evict', tenant_id: wat },
      { type: 'unlist', building: 'The Long Row' },
      { type: 'collect', building_id: hovel },
      { type: 'Set Policy', policy: { grace_days: 5, late_fee: '15%', pets: 'banned' } },
      { type: 'order', kind: 'mend', building: 'the mill' },
      { type: 'hire', role: 'mason' },
      { type: 'resolve_incident', building_id: hovel, outcome: 'patch' },
      '{"type":"order_job","kind":"visit","tenantId":"' + marta + '"}',
    ], state, 'x');
    assert.equal(v.dropped.length, 0, JSON.stringify(v.dropped));
    assert.deepEqual(v.actions, [
      { type: 'collect_all' }, { type: 'hold_feast' }, { type: 'gift', tenantId: marta, amount: 5 }, { type: 'set_rent', buildingId: hovel, rent: 9 },
      { type: 'order_job', kind: 'evict', tenantId: wat, buildingId: bId(state, 'Mudlark Hovel') }, { type: 'set_listed', buildingId: row, listed: false },
      { type: 'collect_purse', buildingId: hovel }, { type: 'set_policy', policy: { graceDays: 5, lateFeePct: 15, pets: 'ban' } },
      { type: 'order_job', kind: 'repair', buildingId: bId(state, 'Ploughwright Mill') }, { type: 'hire', candidateId: 'c1' },
      { type: 'resolve_incident', incidentId: incId(state, 'sys_repair_leak'), outcomeId: 'patch' }, { type: 'order_job', kind: 'visit', tenantId: marta, buildingId: hovel, role: 'ruler' },
    ]);
  });
  await test('validate: a standing order in a looser shape still means exactly what was said, or is refused', () => {
    const { state } = court();
    const order = (o: Record<string, unknown>) => { const v = validateActions([{ type: 'add_order', order: { text: 'x', gist: 'x', ...o } }], state, 'x'); const a = v.actions[0]; return a && a.type === 'add_order' ? a.order : null; };
    const a = order({ decision: 'eviction_ready', rule: 'never', option: 'evict', when: { season: 'Winter', 'tenant.tags': 'widows' } });
    assert.ok(a); assert.deepEqual(a.when, [{ field: 'season', op: '==', value: 'winter' }, { field: 'tenant.tags', op: 'includes', value: 'widow' }]); assert.equal(a.to, 'bailiff');
    const b = order({ rule: 'always', option: 'return_all', conditions: [] });
    assert.ok(b); assert.equal(b.decision, 'move_out_deposit'); assert.equal(b.rule, 'choose'); assert.equal(b.to, 'steward');
    const c = order({ decision: 'late_rent', rule: 'choose', option: 'payment_plan', when: [{ field: 'species', operator: 'is', value: 'Goblins' }, { field: 'tenant_arrears', op: 'less_than', value: '20 crowns' }, { field: 'building.type', op: '=', value: 'Stone Hall' }] });
    assert.ok(c); assert.deepEqual(c.when, [{ field: 'tenant.species', op: '==', value: 'goblin' }, { field: 'tenant.arrears', op: '<', value: 20 }, { field: 'building.type', op: '==', value: 'stonehall' }]);
    const d = order({ decision: 'applicant', rule: 'forbid', option: 'accept', when: { field: 'tags', operator: 'contains', value: 'strangers' } });
    assert.ok(d); assert.equal(d.rule, 'never'); assert.deepEqual(d.when, [{ field: 'tenant.tags', op: 'includes', value: 'stranger' }]);
    // never broadened, never guessed
    assert.equal(order({ decision: 'eviction_ready', rule: 'never', option: 'evict', when: 'in winter, for widows' }), null);
    assert.equal(order({ decision: 'eviction_ready', rule: 'never', option: 'evict', when: { season: 'winter', mood: 'gloomy' } }), null);
    assert.equal(order({ decision: 'eviction_ready', rule: 'never', option: 'evict', when: [{ field: 'tenant.tags', op: 'includes', value: ['widow', 'elder'] }] }), null);
    assert.equal(order({ rule: 'never', option: 'cash_for_keys', when: [] }), null, 'an option two decisions share does not name a decision');
    assert.equal(order({ decision: 'late_rent', rule: 'choose', option: 'evict', when: [] }), null);
    const hand = validateActions([{ type: 'construct', building: 'tavern' }, { action: 'build_road' }], state, 'x');
    assert.equal(hand.actions.length, 0); assert.ok(hand.dropped.every(x => x.why === 'by_hand'));
  });
  await test('validate: an oath in a looser shape', () => {
    const { state } = court();
    const v = validateActions([{ type: 'promise', kind: 'no_eviction', text: 'You will not be put out.', to: 'Pim Underbough', due_day: 360 }, { type: 'swear_oath', oath: { kind: 'build', text: 'A stone hall, by year end.', building_type: 'Stone Hall', dueDay: '360' } }], state, 'x');
    assert.equal(v.dropped.length, 0, JSON.stringify(v.dropped));
    const [a, b] = v.actions.map(x => (x.type === 'swear_oath' ? x.oath : null));
    assert.ok(a && b); assert.equal(a.kind, 'no_evict'); assert.equal(a.toTenantId, tId(state, 'Pim Underbough')); assert.equal(a.dueDay, 360);
    assert.equal(b.kind, 'build'); assert.equal(b.buildingType, 'stonehall');
  });
  await test('scrubIds and proseLine', () => {
    const { state } = court();
    const hovel = bId(state, 'The Leaning Hovel'), marta = tId(state, 'Old Marta Thistlewick');
    assert.equal(scrubIds(`Mending #${hovel} now. Marta (#${marta}) will be pleased, as will #${marta}.`, state), 'Mending the Leaning Hovel now. Marta will be pleased, as will Old Marta Thistlewick.');
    assert.equal(scrubIds('Number #zz9 is unknown to me.', state), 'Number that is unknown to me.');
    assert.equal(proseLine('Agnes: "They have formed a committee, Sir. It meets on the stairs."'), 'They have formed a committee, Sir. It meets on the stairs.');
    assert.equal(proseLine('*sucks teeth* It will hold, Sir.'), 'It will hold, Sir.');
    for (const bad of ["I'm sorry, but I can't help with that request.", 'As an AI language model I cannot roleplay.', 'Here is the JSON you asked for:', 'The bailiff nods and says she will see to it.', 'x'.repeat(600), '{"oops"']) assert.equal(proseLine(bad), null, bad);
  });

  // ── speaking with a model ────────────────────────────────────────────────
  await test('speak: a good reply is dispatched and read back by the delegate', async () => {
    const c = court();
    const model = scripted([reply({ speaker: 'mason', reply: 'The Leaning Hovel. A bit of thatch, three crowns. It will hold, Sir.', actions: [{ type: 'resolve_incident', incidentId: incId(c.state, 'sys_repair_leak'), outcomeId: 'patch' }] })]);
    const word = createWord(c.deps, { model });
    const ex = await word.speak('Hob, sort out the leaning hovel', { to: 'mason' });
    assert.equal(ex.status, 'done'); assert.equal(ex.via, 'model'); assert.equal(ex.speaker.kind, 'staff'); assert.equal(ex.speaker.role, 'mason'); assert.equal(ex.speaker.first, 'Hob');
    assert.deepEqual(c.log, [{ type: 'resolve_incident', incidentId: incId(c.state, 'sys_repair_leak'), outcomeId: 'patch' }]);
    assert.equal(ex.applied.length, 1); assert.equal(ex.applied[0]!.result.ok, true); assert.equal(ex.pending.length, 0);
    assert.equal(model.calls.length, 1); assert.equal(model.calls[0]!.system, ORDER_SYSTEM); assert.match(model.calls[0]!.messages[0]!.content, /sort out the leaning hovel/);
  });
  await test('speak: unreadable reply falls back to the offline parser, once, with no retry', async () => {
    const c = court();
    const model = scripted(['The mason nods thoughtfully and says he will get to it.']);
    const word = createWord(c.deps, { model });
    const ex = await word.speak('mend the Leaning Hovel', COURT);
    assert.equal(model.calls.length, 1); assert.equal(ex.via, 'offline'); assert.equal(ex.status, 'done');
    assert.equal(c.log.length, 1); assert.equal(c.log[0]!.type, 'resolve_incident');
  });
  await test('speak: unknown ids from the model do nothing and ask again', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'mason', reply: 'Mending the Crooked Barn now, Sir.', actions: [{ type: 'order_job', kind: 'repair', buildingId: 'b999' }] })]) });
    const ex = await word.speak('mend the crooked barn', COURT);
    assert.equal(ex.status, 'unclear'); assert.equal(c.log.length, 0); assert.doesNotMatch(ex.reply, /Mending the Crooked Barn/); assert.match(ex.reply, /no such house/);
  });
  await test('speak: place_building from the model is refused in the game\'s own words', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'mason', reply: 'One tavern, coming up!', actions: [{ type: 'place_building', btype: 'tavern', x: 4, y: 4, rot: 0 }] })]) });
    const ex = await word.speak('build me a tavern', COURT);
    assert.equal(ex.status, 'refused'); assert.equal(c.log.length, 0); assert.match(ex.reply, /Buildings are placed by hand, Sir\./);
  });
  await test('speak: the 10,000 crown gift is refused and nothing is dispatched', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'herald', reply: 'Ten thousand crowns to Wat Mudge. Done.', actions: [{ type: 'gift', tenantId: tId(c.state, 'Wat Mudge'), amount: 10000 }] })]) });
    const ex = await word.speak('give Wat ten thousand crowns', COURT);
    assert.equal(ex.status, 'refused'); assert.equal(c.log.length, 0); assert.match(ex.reply, /coffers hold but 412 crowns/);
  });
  await test('speak: the model cannot waive the ruler\'s "aye" on an eviction', async () => {
    const c = court();
    const wat = tId(c.state, 'Wat Mudge');
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'bailiff', reply: 'Wat Mudge is out by sundown.', confirm: false, actions: [{ type: 'order_job', kind: 'evict', tenantId: wat }] })]) });
    const ex = await word.speak('evict Wat', { to: 'bailiff' });
    assert.equal(ex.status, 'needs_confirm'); assert.equal(c.log.length, 0); assert.equal(ex.pending.length, 1); assert.match(ex.reply, /\?$/);
  });
  await test('speak: spending over a tenth of the coffers waits for the aye; under it does not', async () => {
    const c = court();
    const marta = tId(c.state, 'Old Marta Thistlewick');
    const word = createWord(c.deps, { model: scripted([
      reply({ reply: 'Sixty crowns to Marta.', actions: [{ type: 'gift', tenantId: marta, amount: 60 }] }),
      reply({ reply: 'Five crowns to Marta.', actions: [{ type: 'gift', tenantId: marta, amount: 5 }] }),
    ]) });
    assert.equal((await word.speak('give Marta 60 crowns', COURT)).status, 'needs_confirm');
    assert.equal((await word.speak('give Marta 5 crowns', COURT)).status, 'done');
    assert.deepEqual(c.log, [{ type: 'gift', tenantId: marta, amount: 5 }]);
  });
  await test('speak: an order against the ruler\'s own oath is held, and the oath is named', async () => {
    const c = court();
    const wat = tId(c.state, 'Wat Mudge');
    c.state.oaths.push({ id: 'wz', kind: 'no_evict', text: 'You will not be put out this year.', toTenantId: wat, toName: 'Wat Mudge', buildingId: null, buildingType: null, amount: null, madeDay: 1, dueDay: 360, state: 'open', settledDay: null });
    const word = createWord(c.deps, { model: scripted([
      reply({ speaker: 'bailiff', reply: 'A notice for Wat Mudge.', actions: [{ type: 'order_job', kind: 'serve_notice', tenantId: wat }] }),
      reply({ speaker: 'herald', reply: 'Mudlark Hovel to ten crowns.', actions: [{ type: 'set_rent', buildingId: bId(c.state, 'Mudlark Hovel'), rent: 10 }] }),
    ]) });
    const ex = await word.speak('serve notice on Wat', COURT);
    assert.equal(ex.status, 'needs_confirm'); assert.match(ex.reply, /You swore otherwise to Wat Mudge/);
    const ex2 = await word.speak('raise the rent at Mudlark Hovel to 10', COURT);   // the fixture holds a no_rent_raise oath to Wat
    assert.equal(ex2.status, 'needs_confirm'); assert.match(ex2.reply, /swore otherwise/);
  });
  await test('speak: the reply is cleaned (no dashes, no stray exclamations, 200 characters)', async () => {
    const c = court();
    const long = 'Right you are — the rents! All of them – every last purse! ' + 'And then some more words about the matter at hand, at length. '.repeat(8);
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'bailiff', reply: long, actions: [{ type: 'collect_all' }] }), reply({ speaker: 'crier', reply: 'OYEZ! Damp End is to let!', actions: [] })]) });
    const ex = await word.speak('collect the rents', COURT);
    noDash(ex.reply); assert.ok(ex.reply.length <= 200, `length ${ex.reply.length}`); assert.ok(!ex.reply.includes('!'));
    const ex2 = await word.speak('announce it', { to: 'crier' });
    assert.ok(ex2.reply.includes('!'), 'a crier may exclaim');
  });
  await test('speak: a delegate the realm has not hired cannot answer; the herald does', async () => {
    const c = court('knight');
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'steward', reply: 'Three days of grace, entered.', actions: [{ type: 'set_policy', policy: { graceDays: 3 } }] })]) });
    const ex = await word.speak('three days of grace', COURT);
    assert.equal(ex.speaker.kind, 'herald'); assert.equal(ex.status, 'done');
  });
  await test('speak: talk that is not an order is done with nothing applied; "understood": false is unclear', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([
      reply({ speaker: 'bailiff', reply: 'Good morrow, Sir. Two doors owe. I have counted.', actions: [] }),
      reply({ speaker: 'bailiff', reply: 'Which Hobson, Sir? I know of none.', understood: false, actions: [{ type: 'collect_all' }] }),
    ]) });
    const a = await word.speak('good morrow Agnes', { to: 'bailiff' });
    assert.equal(a.status, 'done'); assert.equal(a.applied.length, 0);
    const b = await word.speak('evict Hobson', { to: 'bailiff' });
    assert.equal(b.status, 'unclear'); assert.equal(c.log.length, 0);
  });
  await test('speak: a tenant answers when spoken to, and the oath lands in the ledger', async () => {
    const c = court();
    const marta = tId(c.state, 'Old Marta Thistlewick');
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'tenant', mood: 'pleased', reply: 'Before winter. I shall tell the roof.', actions: [{ type: 'swear_oath', oath: { kind: 'repair', text: 'That roof will be mended before winter.', toTenantId: marta, dueDay: 270 } }] })]) });
    const ex = await word.speak('You have my word, that roof will be mended before winter.', { tenantId: marta });
    assert.equal(ex.status, 'done'); assert.equal(ex.speaker.kind, 'tenant'); assert.equal(ex.speaker.tenantId, marta); assert.equal(ex.speaker.mood, 'pleased');
    assert.equal(ex.oaths.length, 1); assert.equal(ex.oaths[0]!.kind, 'repair'); assert.equal(ex.oaths[0]!.toName, 'Old Marta Thistlewick');
  });

  await test('speak: a smaller engine gets the short instructions and a tighter digest', async () => {
    const c = court('baron');
    const small = scripted([reply({ speaker: 'bailiff', reply: 'Every purse, my lord.', actions: [{ type: 'collect_all' }] })], 'workers-ai');
    const word = createWord(c.deps, { model: small });
    await word.ready;
    assert.equal(word.engine(), 'workers-ai');
    assert.equal((await word.speak('collect the rents', COURT)).status, 'done');
    const req = small.calls[0]!;
    assert.equal(req.system, ORDER_SYSTEM_LEAN);
    assert.ok(req.messages[0]!.content.length < 6200, `lean user turn is ${req.messages[0]!.content.length} characters`);
    assert.match(req.messages[0]!.content, /Answer with the one JSON object/);
    const big = scripted([reply({})], 'claude'); const w2 = createWord(court('baron').deps, { model: big });
    await w2.speak('collect the rents', COURT);
    assert.equal(big.calls[0]!.system, ORDER_SYSTEM); assert.equal(w2.engine(), 'claude');
    assert.equal(createWord(c.deps, { model: NONE }).engine(), null);
  });
  await test('speak: a sloppy but well-meant reply still does exactly what was asked', async () => {
    const c = court();
    const hovel = bId(c.state, 'The Leaning Hovel'), marta = tId(c.state, 'Old Marta Thistlewick');
    const sloppy = `<think>Repair. The id is #${hovel}.</think>\nSure, here you go:\n{'speaker': 'Hob', 'read_back': 'Agreed! Mending #${hovel} for #${marta} — nine crowns.', 'mood': 'grumpy', 'understood': 'yes',\n 'moves': [{'action': 'repair', 'params': {'building_id': '#${hovel} (The Leaning Hovel)'}}], 'confirm': False}\nHope that helps!`;
    const word = createWord(c.deps, { model: scripted([sloppy], 'workers-ai') });
    const ex = await word.speak('Hob, mend the leaning hovel', COURT);
    assert.equal(ex.status, 'done'); assert.equal(ex.via, 'model'); assert.equal(ex.speaker.role, 'mason'); assert.equal(ex.speaker.mood, 'annoyed');
    assert.deepEqual(c.log, [{ type: 'order_job', kind: 'repair', buildingId: hovel }]);
    assert.equal(ex.reply, 'Agreed. Mending the Leaning Hovel for Old Marta Thistlewick, nine crowns.');
  });
  await test('speak: a garbled move falls back on the plain reading of a plain order', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'bailiff', reply: 'Gathering the coin.', actions: [{ type: 'gather_coin', from: 'everyone' }] })], 'workers-ai') });
    const ex = await word.speak('collect the rents', COURT);
    assert.equal(ex.status, 'done'); assert.equal(ex.via, 'offline'); assert.deepEqual(c.log, [{ type: 'collect_all' }]);
  });
  await test('speak: plain words with no JSON are an answer to talk, never a deed', async () => {
    const c = court();
    const warn = console.warn; console.warn = () => {};
    try {
      const word = createWord(c.deps, { model: scripted([
        'Agnes: "It is weather, Sir. It will be on the roofs by morning, and then it is Hob\'s."',
        "I'm sorry, but as an AI I can't continue this roleplay.",
        'Consider it done, Sir. The purses are as good as counted.',
      ], 'workers-ai') });
      const a = await word.speak('Agnes, what do you make of this weather', { to: 'bailiff' });
      assert.equal(a.status, 'done'); assert.equal(a.via, 'model'); assert.equal(a.applied.length, 0); assert.equal(a.speaker.role, 'bailiff');
      assert.equal(a.reply, "It is weather, Sir. It will be on the roofs by morning, and then it is Hob's.");
      const b = await word.speak('ponder the griffin question with me', COURT);
      assert.equal(b.status, 'error'); assert.match(b.reply, /between the door and the table/); assert.doesNotMatch(b.reply, /AI|sorry/);
      const d = await word.speak('collect the rents', COURT);
      assert.equal(d.status, 'done'); assert.equal(d.via, 'offline'); assert.deepEqual(c.log, [{ type: 'collect_all' }]);
    } finally { console.warn = warn; }
  });

  // ── the confirm flow ─────────────────────────────────────────────────────
  const widowOrder = (c: Court) => reply({ speaker: 'bailiff', mood: 'annoyed', confirm: true, reply: 'No widows put out in winter. Spring is another matter. Is that your word, Sir?',
    actions: [{ type: 'add_order', order: { to: 'bailiff', text: 'never evict a widow in winter', gist: 'No widows out in winter. Spring is another matter.', decision: 'eviction_ready', incidentDef: null, when: [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'season', op: '==', value: 'winter' }], rule: 'never', option: 'evict', outcomeId: null } }] });
  await test('confirm: a standing order waits, then lands on "aye"', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([widowOrder(c)]) });
    let changes = 0; word.onChange(() => { changes++; });
    const before = c.state.orders.length;
    const ex = await word.speak('Agnes, never evict a widow in winter.', COURT);
    assert.equal(ex.status, 'needs_confirm'); assert.equal(ex.pending.length, 1); assert.equal(ex.applied.length, 0); assert.equal(c.log.length, 0); assert.equal(c.state.orders.length, before);
    const seen = changes;
    ex.confirm();
    assert.equal(ex.status, 'done'); assert.equal(ex.pending.length, 0); assert.equal(ex.applied.length, 1); assert.equal(c.state.orders.length, before + 1);
    assert.equal(ex.orders.length, 1); assert.equal(ex.orders[0]!.text, 'never evict a widow in winter'); assert.equal(ex.orders[0]!.rule, 'never');
    assert.equal(ex.reply, 'No widows put out in winter. Spring is another matter.', 'once answered, the question is gone from the read-back');
    assert.ok(changes > seen, 'listeners hear the confirmation');
    ex.confirm(); ex.cancel();
    assert.equal(c.log.length, 1, 'a second aye does nothing'); assert.equal(ex.status, 'done');
  });
  await test('confirm: "nay" drops the pending moves', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([widowOrder(c)]) });
    const ex = await word.speak('Agnes, never evict a widow in winter.', COURT);
    let changes = 0; word.onChange(() => { changes++; });
    ex.cancel();
    assert.equal(ex.status, 'unclear'); assert.equal(ex.pending.length, 0); assert.equal(c.log.length, 0); assert.equal(changes, 1);
    assert.equal(ex.reply, 'As you were, Sir. Nothing is done.');
    ex.confirm();
    assert.equal(c.log.length, 0, 'an aye after a nay does nothing');
  });
  await test('confirm: a refusal by the sim is voiced with its reason', async () => {
    const c = court();
    c.refuse.set('hold_feast', 'The coffers hold but 12 crowns, my lord.');
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'herald', reply: 'A feast for the whole village, ninety crowns. Your aye, Sir?', confirm: true, actions: [{ type: 'hold_feast' }] })]) });
    const ex = await word.speak('hold a feast', COURT);
    assert.equal(ex.status, 'needs_confirm');
    ex.confirm();
    assert.equal(ex.status, 'refused'); assert.match(ex.reply, /^A feast for the whole village, ninety crowns\. .*The coffers hold but 12 crowns, my lord\.$/); assert.equal(ex.applied[0]!.result.ok, false);
    const lone = createWord(c.deps, { model: scripted([reply({ speaker: 'bailiff', reply: 'Shall I put Wat Mudge out, Sir?', confirm: true, actions: [{ type: 'order_job', kind: 'evict', tenantId: tId(c.state, 'Wat Mudge') }] })]) });
    const ex2 = await lone.speak('evict Wat', COURT);
    ex2.confirm();
    assert.equal(ex2.status, 'done'); assert.equal(ex2.reply, 'Put Wat Mudge out of Mudlark Hovel.', 'a read-back that was only a question becomes the order restated');
  });
  await test('refusal: without confirm, the reason is appended to the read-back; what could be done is done', async () => {
    const c = court();
    c.refuse.set('order_job', 'Hob is waiting on a part, Sir.');
    const word = createWord(c.deps, { model: scripted([reply({ speaker: 'mason', reply: 'The mill, then the rents. Aye.', actions: [{ type: 'order_job', kind: 'repair', buildingId: bId(c.state, 'Ploughwright Mill') }, { type: 'collect_all' }] })]) });
    const ex = await word.speak('mend the mill and collect the rents', COURT);
    assert.equal(ex.status, 'refused'); assert.match(ex.reply, /^The mill, then the rents\. Aye\./); assert.match(ex.reply, /Hob is waiting on a part, Sir\.$/);
    assert.deepEqual(ex.applied.map(a => a.result.ok), [false, true]); assert.deepEqual(c.log, [{ type: 'collect_all' }]);
  });

  // ── transports failing ──────────────────────────────────────────────────
  await test('transport failure: a plain order still goes through offline; free speech gets a graceful line; never a retry', async () => {
    const c = court();
    const model = scripted([new ModelError('court_key'), new ModelError('rate_limited'), new Error('socket hang up')]);
    const warn = console.warn; console.warn = () => {};
    try {
      const word = createWord(c.deps, { model });
      const a = await word.speak('collect the rents', COURT);
      assert.equal(a.status, 'done'); assert.equal(a.via, 'offline'); assert.deepEqual(c.log, [{ type: 'collect_all' }]);
      const b = await word.speak('I have been thinking about the nature of tenancy', COURT);
      assert.equal(b.status, 'error'); assert.match(b.reply, /clerk's hand has cramped/); noDash(b.reply);
      const d = await word.speak('ponder the griffin question with me', COURT);
      assert.equal(d.status, 'error'); assert.match(d.reply, /between the door and the table/);
      assert.equal(model.calls.length, 3, 'one call per utterance');
    } finally { console.warn = warn; }
  });
  await test('transport failure: a wrong court key is said plainly', async () => {
    const c = court();
    const word = createWord(c.deps, { model: scripted([new ModelError('court_key')]) });
    const ex = await word.speak('what do you make of the weather, Agnes', COURT);
    assert.equal(ex.status, 'error'); assert.match(ex.reply, /court key is wanting or wrong/);
  });
  await test('no model: transport is none, speech is parsed offline, and the log keeps the last 30, newest last', async () => {
    const c = court();
    const word = createWord(c.deps, { model: NONE });
    await word.ready;
    assert.equal(word.transport(), 'none');
    for (let i = 0; i < 34; i++) await word.speak(i % 2 ? 'collect the rents' : `give Marta ${i + 1} crowns`, COURT);
    const log = word.log();
    assert.equal(log.length, 30); assert.equal(log[29]!.text, 'collect the rents'); assert.equal(log[0]!.text, 'give Marta 5 crowns');
    assert.ok(log.every(e => e.via === 'offline'));
    assert.equal(new Set(log.map(e => e.id)).size, 30, 'ids are unique');
    const empty = await word.speak('   ', COURT);
    assert.equal(empty.status, 'unclear');
  });
  await test('createWord: openAudience and mic are wired; onChange unsubscribes', async () => {
    const c = court();
    const word = createWord(c.deps, { model: NONE });
    assert.equal(typeof word.mic.start, 'function'); assert.equal(typeof word.mic.supported, 'boolean');
    assert.equal(word.openAudience('no-such-incident'), null);
    let n = 0; const off = word.onChange(() => { n++; });
    await word.speak('collect the rents', COURT); const seen = n; off();
    await word.speak('collect the rents', COURT);
    assert.ok(seen >= 1); assert.equal(n, seen);
  });

  // ── the offline parser ───────────────────────────────────────────────────
  type Expect = (r: ReturnType<typeof parseOffline>, s: GameState) => void;
  const one = (type: Action['type'], check?: (a: never, s: GameState) => void): Expect => (r, s) => {
    assert.equal(r.understood, true, `not understood: ${r.reply}`);
    assert.equal(r.moves.length, 1, `moves: ${JSON.stringify(r.moves.map(m => m.action))}`);
    assert.equal(r.moves[0]!.action.type, type);
    check?.(r.moves[0]!.action as never, s);
  };
  const job = (kind: string, where: (s: GameState) => Partial<Record<'buildingId' | 'tenantId' | 'applicantId', string>>): Expect =>
    one('order_job', (a: Extract<Action, { type: 'order_job' }>, s) => { assert.equal(a.kind, kind); for (const [k, v] of Object.entries(where(s))) assert.equal((a as Record<string, unknown>)[k], v, k); });
  const settle = (defId: string, outcomeId: string): Expect => one('resolve_incident', (a: Extract<Action, { type: 'resolve_incident' }>, s) => { assert.equal(s.incidents[a.incidentId]!.defId, defId); assert.equal(a.outcomeId, outcomeId); });
  const policy = (p: Record<string, unknown>): Expect => one('set_policy', (a: Extract<Action, { type: 'set_policy' }>) => assert.deepEqual(a.policy, p));
  const rent = (name: string, n: number): Expect => one('set_rent', (a: Extract<Action, { type: 'set_rent' }>, s) => { assert.equal(a.buildingId, bId(s, name)); assert.equal(a.rent, n); });
  const order = (decision: string, rule: string, option: string, when: unknown[], to?: string): Expect => one('add_order', (a: Extract<Action, { type: 'add_order' }>) => {
    assert.equal(a.order.decision, decision); assert.equal(a.order.rule, rule); assert.equal(a.order.option, option); assert.deepEqual(a.order.when, when); if (to) assert.equal(a.order.to, to);
  });
  const confirms: Expect = r => assert.equal(r.confirm, true, 'should wait for the aye');
  const direct: Expect = r => assert.equal(r.confirm, false, 'should not need an aye');
  const all = (...xs: Expect[]): Expect => (r, s) => { for (const x of xs) x(r, s); };
  const unclear: Expect = r => { assert.equal(r.understood, false, `understood: ${JSON.stringify(r.moves.map(m => m.action))}`); assert.equal(r.moves.length, 0); };
  const talk = (re: RegExp): Expect => r => { assert.equal(r.understood, true); assert.equal(r.moves.length, 0); assert.match(r.reply, re); };

  const PHRASES: [string, Expect, SpeakTarget?][] = [
    // repairs
    ['fix the Leaning Hovel', settle('sys_repair_leak', 'fix')],
    ['Hob, mend the roof at the leaning hovel properly.', settle('sys_repair_leak', 'fix')],
    ['patch the leaning hovel, cheap', settle('sys_repair_leak', 'patch')],
    ["repair Marta's roof and bill the tenant", settle('sys_repair_leak', 'bill_tenant')],
    ["Hob, mend the miller's roof before the rains", job('repair', s => ({ buildingId: bId(s, 'Ploughwright Mill') }))],
    ['mend the Long Row', job('repair', s => ({ buildingId: bId(s, 'The Long Row') }))],
    ['fix this', job('repair', s => ({ buildingId: bId(s, 'Thistle Cottage') })), { buildingId: '@Thistle Cottage' }],
    ['restore Damp End', job('renovate', s => ({ buildingId: bId(s, 'Damp End') }))],
    ['mend the Leening Hovvel', settle('sys_repair_leak', 'fix')],
    // collections
    ['collect the rents', all(one('collect_all'), direct)],
    ['Agnes, gather the purses', one('collect_all')],
    ['collect the rent at the tavern', one('collect_purse', (a: Extract<Action, { type: 'collect_purse' }>, s) => assert.equal(a.buildingId, bId(s, 'The Late Payment')))],
    // eviction and notice
    ['evict Wat', all(job('evict', s => ({ tenantId: tId(s, 'Wat Mudge') })), confirms)],
    ['throw Wat Mudge out', all(job('evict', s => ({ tenantId: tId(s, 'Wat Mudge') })), confirms)],
    ['serve notice on Wat Mudge', all(job('serve_notice', s => ({ tenantId: tId(s, 'Wat Mudge') })), confirms)],
    ['nail a notice to quit on Lobelia\'s door', all(job('serve_notice', s => ({ tenantId: tId(s, 'Lobelia Greenhill') })), confirms)],
    // rents
    ['raise the rent at Thistle Cottage to 18', all(rent('Thistle Cottage', 18), direct)],
    ['lower the rent at the Long Row by two', rent('The Long Row', 11)],
    ['set the rent at Underbough to twenty five crowns', rent('Underbough', 25)],
    ['put up the rent at Caskhammer Hall by ten percent', rent('Caskhammer Hall', 29)],
    ['raise the rent here by 3', rent('Thistle Cottage', 19), { buildingId: '@Thistle Cottage' }],
    ['double the rent at the tavern', rent('The Late Payment', 92)],
    // letting
    ['list Damp End', one('set_listed', (a: Extract<Action, { type: 'set_listed' }>, s) => { assert.equal(a.buildingId, bId(s, 'Damp End')); assert.equal(a.listed, true); })],
    ['unlist the Long Row', one('set_listed', (a: Extract<Action, { type: 'set_listed' }>) => assert.equal(a.listed, false))],
    // staff
    ['hire the mason', one('hire', (a: Extract<Action, { type: 'hire' }>) => assert.equal(a.candidateId, 'c1'))],
    ['send for Soft Tom Lamb', one('hire', (a: Extract<Action, { type: 'hire' }>) => assert.equal(a.candidateId, 'c2'))],
    ['sack Hob', all(one('dismiss_staff', (a: Extract<Action, { type: 'dismiss_staff' }>, s) => assert.equal(a.staffId, sId(s, 'mason'))), confirms)],
    ['pay Hob 20 crowns a month', one('set_wage', (a: Extract<Action, { type: 'set_wage' }>, s) => { assert.equal(a.staffId, sId(s, 'mason')); assert.equal(a.wage, 20); })],
    // money
    ['hold a feast', all(one('hold_feast'), confirms)],
    ['give Marta 10 crowns', all(one('gift', (a: Extract<Action, { type: 'gift' }>, s) => { assert.equal(a.tenantId, tId(s, 'Old Marta Thistlewick')); assert.equal(a.amount, 10); }), direct)],
    ['give Old Marta Thistlewick a hundred crowns', all(one('gift', (a: Extract<Action, { type: 'gift' }>) => assert.equal(a.amount, 100)), confirms)],
    // policies
    ["three days' grace", policy({ graceDays: 3 })],
    ["Three days' grace, then the fee.", policy({ graceDays: 3 })],
    ['late fee 10 percent', policy({ lateFeePct: 10 })],
    ['a late fee of a tenth', policy({ lateFeePct: 10 })],
    ['no pets', policy({ pets: 'ban' })],
    ['pets allowed', policy({ pets: 'allow' })],
    ['pet rent', policy({ pets: 'pet_rent' })],
    ["two months' rent as surety", policy({ depositMonths: 2 })],
    ['always check references', policy({ screening: 'always' })],
    ['five days grace and a late fee of 15 percent', policy({ graceDays: 5, lateFeePct: 15 })],
    // standing orders
    ['Agnes, never evict a widow in winter.', all(order('eviction_ready', 'never', 'evict', [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'season', op: '==', value: 'winter' }], 'bailiff'), confirms)],
    ['always mend leaks properly, no patch jobs', order('repair', 'choose', 'fix', [], 'mason')],
    ['never patch a roof', order('repair', 'never', 'patch', [])],
    ['from now on always offer goblins a payment plan', order('late_rent', 'choose', 'payment_plan', [{ field: 'tenant.species', op: '==', value: 'goblin' }])],
    ['always charge the late fee unless they are a veteran', order('late_rent', 'choose', 'late_fee', [{ field: 'tenant.tags', op: 'excludes', value: 'veteran' }])],
    ['never serve notice on anyone who owes less than 20 crowns', order('late_rent', 'never', 'notice', [{ field: 'tenant.arrears', op: '<', value: 20 }])],
    ['never rent to goblins', order('applicant', 'choose', 'reject', [{ field: 'tenant.species', op: '==', value: 'goblin' }], 'crier')],
    ['always return the surety in full', order('move_out_deposit', 'choose', 'return_all', [], 'steward')],
    ['never raise the rent on an elder', order('rent_renewal', 'never', 'raise', [{ field: 'tenant.tags', op: 'includes', value: 'elder' }])],
    ['always throw squatters out', order('squatters', 'choose', 'oust', [])],
    ['revoke the order about widows', one('revoke_order', (a: Extract<Action, { type: 'revoke_order' }>) => assert.equal(a.orderId, 'o1'))],
    // matters open at court
    ['throw the goblins out of Damp End', settle('sys_squatters_goblins', 'oust')],
    ['the griffin goes', settle('unauthorized_griffin', 'ban')],
    ['He stays. He pays pet rent, and you post a surety against the thatch.', settle('unauthorized_griffin', 'pet_rent')],
    ['I did not see a griffin', settle('unauthorized_griffin', 'allow')],
    // visits and the rest
    ['visit Old Marta', job('visit', s => ({ tenantId: tId(s, 'Old Marta Thistlewick') }))],
    ['inspect the mill', job('inspect', s => ({ buildingId: bId(s, 'Ploughwright Mill') }))],
    ['rename Damp End to Goblin Court', one('rename_building', (a: Extract<Action, { type: 'rename_building' }>, s) => { assert.equal(a.buildingId, bId(s, 'Damp End')); assert.equal(a.name, 'Goblin Court'); })],
    ['I swear to mend the Leaning Hovel before winter', one('swear_oath', (a: Extract<Action, { type: 'swear_oath' }>, s) => { assert.equal(a.oath.kind, 'repair'); assert.equal(a.oath.buildingId, bId(s, 'The Leaning Hovel')); assert.equal(a.oath.dueDay, 270); assert.equal(a.oath.toName, 'Old Marta Thistlewick'); })],
    ['You have my word, your rent will not rise this year.', one('swear_oath', (a: Extract<Action, { type: 'swear_oath' }>, s) => { assert.equal(a.oath.kind, 'no_rent_raise'); assert.equal(a.oath.toTenantId, tId(s, 'Pim Underbough')); assert.equal(a.oath.dueDay, 360); }), { tenantId: '@Pim Underbough' }],
    ['I promise you will not be evicted this winter', one('swear_oath', (a: Extract<Action, { type: 'swear_oath' }>) => { assert.equal(a.oath.kind, 'no_evict'); assert.equal(a.oath.dueDay, 360); }), { tenantId: '@Pim Underbough' }],
    // talk, questions, and what cannot be done by word
    ['how much gold do we have?', talk(/coffers hold 412 crowns/)],
    ['who is late', talk(/Lobelia Greenhill owes 26/)],
    ['what needs mending', talk(/Damp End stands at 24/)],
    ['hello Hob', talk(/Sir/)],
    ['build me a tavern by the well', talk(/placed by hand/)],
    ['lay a road to the mill', talk(/by hand/)],
    // not understood
    ['mend the crooked barn', (r) => { unclear(r, undefined as never); assert.match(r.reply, /I know of no crooked barn/); }],
    ['collect the rent at the crooked barn', unclear],
    ['collect from every door', one('collect_all')],
    ['dance a jig', unclear],
    ['the weather has been remarkable', unclear],
    ['fix the hovel on the hill of beans', (r) => { assert.ok(r.moves.length <= 1); }],
    ['raise the rent', unclear],
    ['evict', unclear],
  ];
  const at = (s: GameState, t?: SpeakTarget): SpeakTarget => {
    if (!t) return COURT;
    if ('buildingId' in t && t.buildingId.startsWith('@')) return { buildingId: bId(s, t.buildingId.slice(1)) };
    if ('tenantId' in t && t.tenantId.startsWith('@')) return { tenantId: tId(s, t.tenantId.slice(1)) };
    return t;
  };
  for (const [said, expect, target] of PHRASES) {
    await test(`offline: "${said}"`, () => {
      const { state } = court('knight');
      const r = parseOffline(said, at(state, target), state);
      expect(r, state);
      assert.ok(r.reply.length > 0 && r.reply.length <= 200, `reply length ${r.reply.length}: ${r.reply}`);
      noDash(r.reply);
      assert.ok(!/\{\w+\}/.test(r.reply), `unfilled placeholder: ${r.reply}`);
    });
  }
  await test('offline: the forty and more phrasings are all there', () => assert.ok(PHRASES.length >= 40, String(PHRASES.length)));

  await test('offline: matters that the fixture lacks (late rent, an applicant)', () => {
    const c = court(); const { applicant } = withApplicantAndLateRent(c); const s = c.state;
    const check = (said: string, expect: Expect, t: SpeakTarget = COURT) => { try { expect(parseOffline(said, t, s), s); } catch (e) { throw new Error(`"${said}": ${(e as Error).message}`); } };
    check('give Wat a week', settle('sys_late_rent', 'wait'));
    check('charge Wat the late fee', settle('sys_late_rent', 'late_fee'));
    check('put Wat on a payment plan', settle('sys_late_rent', 'payment_plan'));
    check("forgive Wat's rent", settle('sys_late_rent', 'forgive'));
    check('serve notice on Wat', all(settle('sys_late_rent', 'notice'), confirms));
    check('Agnes, deal with the late payers', all((r, st) => { assert.ok(r.moves.some(m => m.action.type === 'resolve_incident' && m.action.outcomeId === 'notice' && st.incidents[m.action.incidentId]!.defId === 'sys_late_rent'), JSON.stringify(r.moves.map(m => m.action))); }, confirms));
    check('show the applicant the hovel', job('show', () => ({ applicantId: applicant.id })));
    check('show Jory Applewhite round Damp End', job('show', () => ({ applicantId: applicant.id })));
    check('check their references', settle('sys_applicant', 'screen'));
    check('welcome Jory', settle('sys_applicant', 'accept'));
    check('turn them away', settle('sys_applicant', 'reject'));
  });
  await test('offline: temperament fills what the words leave open, and a standing order outranks temperament', () => {
    const c = court(); withApplicantAndLateRent(c); const s = c.state;
    const bailiff = Object.values(s.staff).find(m => m.role === 'bailiff')!;
    const outcome = () => { const r = parseOffline('deal with the late payers', { to: 'bailiff' }, s); const m = r.moves.find(x => x.action.type === 'resolve_incident'); return m && m.action.type === 'resolve_incident' ? m.action.outcomeId : null; };
    bailiff.temperament = 'iron'; assert.equal(outcome(), 'notice');
    bailiff.temperament = 'soft'; assert.equal(outcome(), 'payment_plan');
    s.orders.push({ id: 'oz', to: 'bailiff', text: 'always forgive Wat', gist: 'Forgive Wat.', decision: 'late_rent', incidentDef: null, when: [{ field: 'tenant.name', op: '==', value: 'Wat Mudge' }], rule: 'choose', option: 'forgive', outcomeId: null, createdDay: 1, uses: 0 });
    assert.equal(outcome(), 'forgive');
    // the mason: the fixture's standing order says "always mend properly", so even a Bodger mends properly
    const mason = Object.values(s.staff).find(m => m.role === 'mason')!;
    mason.temperament = 'bodger';
    const fix = () => { const r = parseOffline('see to the roof at the leaning hovel', { to: 'mason' }, s); const a = r.moves[0]?.action; return a?.type === 'resolve_incident' ? a.outcomeId : null; };
    assert.equal(fix(), 'fix');
    s.orders = s.orders.filter(o => o.id !== 'o2');
    assert.equal(fix(), 'patch');
    mason.temperament = 'perfectionist'; assert.equal(fix(), 'fix');
  });
  await test('offline: at Reeve rank there is no one to lean, so the herald asks', () => {
    const c = court('reeve'); const s = c.state;
    const r = parseOffline('deal with the late payers', COURT, s);
    assert.equal(r.understood, false); assert.equal(r.speaker, 'herald'); assert.match(r.reply, /Reeve/);
    const r2 = parseOffline('mend the leaning hovel', COURT, s);
    assert.equal(r2.speaker, 'herald'); assert.equal(r2.moves.length, 1);
  });
  await test('offline: an ambiguous name is asked about, not guessed', () => {
    const { state } = court();
    const r = parseOffline('raise the rent at the hovel to 9', COURT, state);
    assert.equal(r.understood, false); assert.match(r.reply, /Which house, Sir: /); assert.match(r.reply, /Leaning Hovel/); assert.match(r.reply, /Damp End/);
    const every = parseOffline('raise the rent at every hovel to 9', COURT, state);
    assert.equal(every.moves.length, 3);
    assert.equal(every.confirm, true, 'one of the three is Wat\'s, whose rent the ruler swore not to raise'); assert.match(every.reply, /Mind your oath to Wat Mudge/);
    state.oaths = [];
    assert.equal(parseOffline('raise the rent at every hovel to 9', COURT, state).confirm, false);
  });
  await test('offline: several orders in one breath', () => {
    const { state } = court();
    const r = parseOffline('Collect the rents and mend the mill, then hold a feast.', COURT, state);
    assert.deepEqual(r.moves.map(m => m.action.type), ['collect_all', 'order_job', 'hold_feast']); assert.equal(r.confirm, true);
  });
  await test('offline: the read-back uses the temperament\'s own acks and restates the order', () => {
    const { state } = court();
    const r = parseOffline('Agnes, collect the rents', COURT, state);
    assert.equal(r.speaker, 'bailiff'); assert.match(r.reply, /[Cc]ollect every purse/);
    assert.equal(fillAck('{order}. It will hold. Probably.', 'Mend the Leaning Hovel', 'Sir'), 'Mend the Leaning Hovel. It will hold. Probably.');
    assert.equal(fillAck('Aye, {title}: {order}, and not a nail more.', 'Mend the Leaning Hovel', 'Sir'), 'Aye, Sir: mend the Leaning Hovel, and not a nail more.');
    assert.equal(fillAck('The clerk has it: {order}.', 'Notice to Quit on the door of Wat Mudge', 'Sir'), 'The clerk has it: Notice to Quit on the door of Wat Mudge.');
    assert.equal(fillAck('I shall {order}, then.', 'Mend the Leaning Hovel.', 'Sir'), 'I shall mend the Leaning Hovel, then.');
    assert.equal(fillAck('As you say.', 'Collect every purse', 'Sir'), 'As you say. Collect every purse.');
  });
  await test('offline: spoken to the wrong delegate, they pass it on', () => {
    const { state } = court();
    const r = parseOffline('evict Wat', { to: 'mason' }, state);
    assert.equal(r.speaker, 'mason'); assert.match(r.reply, /Not my trade\. I will tell Agnes\./); assert.equal(r.confirm, true);
  });
  await test('offline: a household answers a promise or a gift made to its face', () => {
    const { state } = court(); const marta = tId(state, 'Old Marta Thistlewick');
    const oath = parseOffline('I will mend your roof before winter', { tenantId: marta }, state);
    assert.equal(oath.speaker, 'tenant'); assert.equal(oath.tenantId, marta); assert.equal(oath.moves[0]!.action.type, 'swear_oath');
    const gift = parseOffline('here, take 5 crowns', { tenantId: marta }, state);
    assert.equal(gift.speaker, 'tenant'); assert.deepEqual(gift.moves[0]!.action, { type: 'gift', tenantId: marta, amount: 5 });
    const hello = parseOffline('good morrow', { tenantId: marta }, state);
    assert.equal(hello.speaker, 'tenant'); assert.equal(hello.moves.length, 0);
  });
  await test('offline: numbers in words, and times in words', () => {
    const n = (t: string) => numberize(prep(t).toks);
    assert.equal(n('twenty five crowns'), '25 crowns'); assert.equal(n('a hundred and fifty'), '150'); assert.equal(n('two hundred'), '200');
    assert.equal(n('by a tenth'), 'by 10 percent'); assert.equal(n('half a month'), '0.5 month'); assert.equal(n('the leaning one'), 'the leaning one'); assert.equal(n('one crown'), '1 crown');
    assert.equal(n('a dozen crowns'), '12 crowns'); assert.equal(n('three days grace'), '3 days grace');
    assert.equal(parseDue('before winter', 34), 270); assert.equal(parseDue('before winter', 300), 630); assert.equal(parseDue('this winter', 34), 360); assert.equal(parseDue('this winter', 280), 360);
    assert.equal(parseDue('within 2 weeks', 34), 48); assert.equal(parseDue('by rent day', 34), 60); assert.equal(parseDue('this year', 34), 360); assert.equal(parseDue('for a year', 34), 394);
    assert.equal(parseDue('before the first frost', 34), 270); assert.equal(parseDue('by deepwinter', 34), 300); assert.equal(parseDue('mend it', 34), null);
  });
  await test('weigh: what waits for the aye', () => {
    const { state } = court();
    const wat = tId(state, 'Wat Mudge');
    assert.equal(weigh([{ type: 'collect_all' }], state).confirm, false);
    assert.equal(weigh([{ type: 'order_job', kind: 'repair', buildingId: bId(state, 'Damp End') }], state).confirm, false);
    assert.equal(weigh([{ type: 'order_job', kind: 'evict', tenantId: wat }], state).confirm, true);
    assert.equal(weigh([{ type: 'dismiss_staff', staffId: sId(state, 'mason') }], state).confirm, true);
    assert.equal(weigh([{ type: 'hold_feast' }], state).confirm, true, 'a feast is 90 of 412 crowns');
    assert.equal(weigh([{ type: 'gift', tenantId: wat, amount: 41 }], state).confirm, false);
    assert.equal(weigh([{ type: 'gift', tenantId: wat, amount: 42 }], state).confirm, true);
    assert.equal(weigh([{ type: 'resolve_incident', incidentId: incId(state, 'sys_repair_leak'), outcomeId: 'fix' }], state).confirm, false);
    const w = weigh([{ type: 'resolve_incident', incidentId: incId(state, 'unauthorized_griffin'), outcomeId: 'pet_rent' }], state);
    assert.equal(w.confirm, true, 'pet rent raises a rent the ruler swore not to raise'); assert.equal(w.oaths.length, 1);
    assert.match(describeAction({ type: 'set_rent', buildingId: bId(state, 'Thistle Cottage'), rent: 18 }, state), /^Asking rent at Thistle Cottage: 18 crowns, up from 16$/);
  });

  // ── the digest and the prompt ────────────────────────────────────────────
  await test('digest: every building and household is named with its id, at every rank, within the cap', () => {
    for (const rank of ['reeve', 'knight', 'baron'] as Rank[]) {
      const { state } = court(rank);
      const d = buildDigest(state, COURT, 'raise the rent at Thistle Cottage');
      assert.ok(d.length <= DIGEST_CAP + 600, `${rank}: ${d.length} characters`);
      for (const b of Object.values(state.buildings)) assert.ok(d.includes(`#${b.id} ${b.name}`), `${rank}: missing building ${b.id} ${b.name}`);
      for (const t of Object.values(state.tenants)) assert.ok(d.includes(`#${t.id} ${t.name}`), `${rank}: missing household ${t.id} ${t.name}`);
      for (const i of Object.values(state.incidents)) assert.ok(d.includes(`#${i.id} "`), `${rank}: missing matter ${i.id}`);
      for (const o of state.orders) assert.ok(d.includes(` #${o.id} to ${o.to}`), `${rank}: missing order ${o.id}`);
      for (const o of state.oaths) assert.ok(d.includes(` #${o.id} ${o.kind} to #${o.toTenantId}`), `${rank}: missing oath ${o.id}`);
      for (const c of state.candidates) assert.ok(d.includes(`#${c.id} ${c.name}`), `${rank}: missing candidate ${c.id}`);
      noDash(d);
    }
  });
  await test('digest: scoped by what was said and who was addressed; hidden traits stay hidden', () => {
    const { state } = court('baron');
    // crowd the realm so that not everything fits in full
    for (let i = 0; i < 40; i++) { const src = Object.values(state.tenants)[i % 10]!; const id = `tx${i}`; state.tenants[id] = { ...src, id, name: `Extra Tenant ${i}`, first: `Extra${i}`, buildingId: src.buildingId }; }
    const tower = bId(state, 'Vantablack Tower');
    const d = buildDigest(state, COURT, 'what of Vantablack Tower');
    assert.ok(d.length <= DIGEST_CAP + 600, `length ${d.length}`);
    assert.match(d, new RegExp(` #${tower} Vantablack Tower[^\\n]*condition`)); assert.match(d, /OTHER HOUSEHOLDS/);
    const nib = state.tenants[state.buildings[tower]!.units[0]!.tenantId!]!;
    assert.match(d, new RegExp(` #${nib.id} ${nib.name}: `), 'whoever lives in the house that was named is written out too');
    for (const t of Object.values(state.tenants)) assert.ok(d.includes(`#${t.id} ${t.name}`), `missing ${t.id}`);
    const marta = tId(state, 'Old Marta Thistlewick');
    const deep = buildDigest(state, { tenantId: marta }, '');
    assert.match(deep, /remembers "You mended the roof the same day they asked\."/);
    const wat = state.tenants[tId(state, 'Wat Mudge')]!;
    const hidden = wat.traits.filter(x => !wat.revealed.includes(x));
    assert.ok(hidden.length > 0);
    const line = buildDigest(state, { tenantId: wat.id }, '').split('\n').find(l => l.includes(`#${wat.id} Wat Mudge:`))!;
    for (const h of hidden) assert.ok(!line.includes(h.replace(/_/g, ' ')), `hidden trait ${h} leaked`);
  });
  await test('prompt: strict JSON, the whole spoken vocabulary, and nothing built by word', () => {
    for (const a of SPOKEN_ACTIONS) assert.ok(ORDER_SYSTEM.includes(`"type":"${a}"`), `system prompt lacks ${a}`);
    assert.ok(!ORDER_SYSTEM.includes('"type":"place_building"') && !ORDER_SYSTEM.includes('"type":"place_road"'));
    assert.match(ORDER_SYSTEM, /buildings are placed by hand/); assert.match(ORDER_SYSTEM, /one JSON object and nothing else/);
    noDash(ORDER_SYSTEM);
    const { state } = court('baron');
    const req = buildOrderPrompt(state, 'Agnes,\n deal   with the late payers', { to: 'bailiff' }, { tier: 'default' });
    assert.equal(req.tier, 'default'); assert.equal(req.messages.length, 1); assert.equal(req.messages[0]!.role, 'user');
    const u = req.messages[0]!.content;
    assert.match(u, /THE REALM\n/); assert.match(u, /THE LISTENER\n/); assert.match(u, /"Agnes, deal with the late payers"\n\nAnswer with the one JSON object: [^\n]+$/);
    assert.match(u, /Set "speaker": "bailiff"/); assert.match(u, /Iron/); assert.match(u, /late_rent: /);
    assert.ok(u.length < 9500, `user turn is ${u.length} characters`);
    const reeve = buildOrderPrompt(court('reeve').state, 'fix the roof', COURT).messages[0]!.content;
    assert.match(reeve, /herald: the court clerk/); assert.match(reeve, /No one is hired/);
  });
  await test('prompt: the short instructions say the same contract in half the words', () => {
    for (const a of ['order_job', 'resolve_incident', 'set_rent', 'set_listed', 'collect_all', 'add_order', 'revoke_order', 'set_policy', 'swear_oath', 'gift', 'hold_feast', 'hire', 'dismiss_staff', 'set_wage'])
      assert.ok(ORDER_SYSTEM_LEAN.includes(`"type":"${a}"`), `short prompt lacks ${a}`);
    assert.ok(!ORDER_SYSTEM_LEAN.includes('place_building')); assert.match(ORDER_SYSTEM_LEAN, /buildings are placed by hand/); assert.match(ORDER_SYSTEM_LEAN, /ONE JSON object and nothing else/);
    for (const d of ['late_rent', 'eviction_ready', 'repair', 'applicant', 'move_out_deposit', 'squatters', 'pet', 'rent_renewal']) { assert.ok(ORDER_SYSTEM_LEAN.includes(` ${d} (`), d); assert.ok(ORDER_SYSTEM.includes(` ${d} (`), d); }
    noDash(ORDER_SYSTEM_LEAN);
    assert.ok(ORDER_SYSTEM_LEAN.length < 6400, `short prompt is ${ORDER_SYSTEM_LEAN.length} characters`);
    assert.ok(ORDER_SYSTEM.length < 11500, `full prompt is ${ORDER_SYSTEM.length} characters`);
    assert.ok(ORDER_SYSTEM_LEAN.length < ORDER_SYSTEM.length * 0.6);
    // every example in both prompts is itself a reply the validator would accept the shape of
    for (const sys of [ORDER_SYSTEM, ORDER_SYSTEM_LEAN]) {
      const examples = sys.split('\n').filter(l => l.startsWith('{"speaker":"') && l.includes('"reply":"') && !l.includes('"|"'));
      assert.ok(examples.length >= 3, `examples: ${examples.length}`);
      for (const e of examples) { const r = parseReply(e); assert.ok(r, e); assert.ok(r.reply.length <= 200 && !/[—–]/.test(r.reply), r.reply); JSON.parse(e); }
    }
    const { state } = court('baron');
    const lean = buildOrderPrompt(state, 'Agnes, deal with the late payers', { to: 'bailiff' }, { lean: true });
    assert.equal(lean.system, ORDER_SYSTEM_LEAN);
    const full = buildOrderPrompt(state, 'Agnes, deal with the late payers', { to: 'bailiff' });
    assert.ok(lean.messages[0]!.content.length < full.messages[0]!.content.length * 0.8, `${lean.messages[0]!.content.length} against ${full.messages[0]!.content.length}`);
    const d = buildDigest(state, { to: 'bailiff' }, 'deal with the late payers', DIGEST_CAP_LEAN);
    for (const t of Object.values(state.tenants)) assert.ok(d.includes(`#${t.id} ${t.name}`), `short digest lost household ${t.id}`);
    for (const b of Object.values(state.buildings)) if (b.units.length) assert.ok(d.includes(`#${b.id} ${b.name}`), `short digest lost ${b.name}`);
    assert.doesNotMatch(d, /Wayside Shrine/);
    assert.match(buildDigest(state, COURT, 'mend the shrine', DIGEST_CAP_LEAN), /Wayside Shrine: condition/);
  });
  await test('prompt: recent exchanges give "it" something to point at', async () => {
    const c = court();
    const model = scripted([reply({ speaker: 'mason', reply: 'The Leaning Hovel, patched. Three crowns.', actions: [] }), reply({ speaker: 'mason', reply: 'Aye.' })]);
    const word = createWord(c.deps, { model });
    await word.speak('patch the leaning hovel', COURT);
    await word.speak('no, do it properly', COURT);
    assert.match(model.calls[1]!.messages[0]!.content, /JUST BEFORE THIS[\s\S]*patch the leaning hovel[\s\S]*The Leaning Hovel, patched/);
    assert.doesNotMatch(model.calls[0]!.messages[0]!.content, /JUST BEFORE THIS/);
  });

  // ── transport detection ──────────────────────────────────────────────────
  await test('detectModel: nothing available is "none", and nothing throws', async () => {
    const m = await detectModel({ fetch: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch, protocol: 'https:', claude: null });
    assert.equal(m.kind, 'none'); assert.equal(m.usable(), false);
    await assert.rejects(() => m.complete({ system: 's', messages: [] }), (e: unknown) => e instanceof ModelError && e.code === 'unavailable');
    assert.equal((await detectModel({ protocol: 'file:', claude: null })).kind, 'none');
    assert.equal((await detectModel({ fetch: (() => { throw new Error('boom'); }) as unknown as typeof fetch, protocol: 'https:', claude: { use: () => { throw new Error('boom'); } } })).kind, 'none');
  });
  await test('detectModel: the game\'s own server, the court key, and a 401', async () => {
    const seen: { url: string; body?: Record<string, unknown> }[] = [];
    let key = '';
    let status = 200;
    const f = (async (url: string, init?: { method?: string; body?: string }) => {
      seen.push({ url, body: init?.body ? JSON.parse(init.body) as Record<string, unknown> : undefined });
      if (url === '/api/court') return new Response(JSON.stringify({ ok: true, model: true, gated: true }), { status: 200 });
      if (status !== 200) return new Response(JSON.stringify({ error: 'no', code: 'bad_key' }), { status });
      return new Response(JSON.stringify({ text: '{"reply":"Aye."}' }), { status: 200 });
    }) as unknown as typeof fetch;
    const m = await detectModel({ fetch: f, protocol: 'https:', claude: null, readKey: () => key });
    assert.equal(m.kind, 'server');
    assert.equal(m.usable(), false, 'gated and no key'); assert.equal(m.needsKey(), true);
    await assert.rejects(() => m.complete({ system: 's', messages: [{ role: 'user', content: 'u' }] }), (e: unknown) => e instanceof ModelError && e.code === 'court_key');
    assert.equal(seen.length, 1, 'no call is made without a key');
    key = 'sesame';
    const text = await m.complete({ system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 300, tier: 'default' });
    assert.equal(text, '{"reply":"Aye."}');
    assert.deepEqual(seen[1], { url: '/api/word', body: { system: 's', messages: [{ role: 'user', content: 'u' }], maxTokens: 300, tier: 'default', key: 'sesame' } });
    status = 401;
    await assert.rejects(() => m.complete({ system: 's', messages: [{ role: 'user', content: 'u' }] }), (e: unknown) => e instanceof ModelError && e.code === 'court_key');
    await assert.rejects(() => m.complete({ system: 's', messages: [{ role: 'user', content: 'u' }] }), (e: unknown) => e instanceof ModelError && e.code === 'court_key');
    assert.equal(seen.length, 3, 'a refused key is not sent again');
    status = 200; key = 'open sesame';
    assert.equal(await m.complete({ system: 's', messages: [{ role: 'user', content: 'u' }] }), '{"reply":"Aye."}');
    status = 500;
    await assert.rejects(() => m.complete({ system: 's', messages: [{ role: 'user', content: 'u' }] }), (e: unknown) => e instanceof ModelError && e.code === 'server');
  });
  await test('detectModel: inside a Claude viewer, the system text leads as a user turn, and a denial is final', async () => {
    const calls: { input: unknown; options: Record<string, unknown> }[] = [];
    let fail: { code: string } | null = null;
    const sample = async (input: unknown, options: Record<string, unknown>) => { calls.push({ input, options }); if (fail) throw fail; return { text: '{"reply":"Aye."}', truncated: false }; };
    const m = await detectModel({ protocol: 'about:', claude: { use: async (name: string) => (name === 'sample' ? sample : null) } });
    assert.equal(m.kind, 'claude'); assert.equal(m.usable(), true);
    const text = await m.complete({ system: 'RULES', messages: [{ role: 'user', content: 'words' }], tier: 'default' });
    assert.equal(text, '{"reply":"Aye."}');
    assert.deepEqual(calls[0]!.input, [{ role: 'user', content: 'RULES' }, { role: 'user', content: 'words' }]);
    assert.equal(calls[0]!.options.modelTier, 'default'); assert.equal(calls[0]!.options.cache, false);
    await m.complete({ system: 'RULES', messages: [{ role: 'user', content: 'words' }] });
    assert.equal(calls[1]!.options.modelTier, 'quick');
    fail = { code: 'not_granted' };
    await assert.rejects(() => m.complete({ system: 'RULES', messages: [{ role: 'user', content: 'w' }] }), (e: unknown) => e instanceof ModelError && e.code === 'denied' && e.permanent);
    assert.equal(m.usable(), false);
    fail = null;
    await assert.rejects(() => m.complete({ system: 'RULES', messages: [{ role: 'user', content: 'w' }] }), (e: unknown) => e instanceof ModelError && e.code === 'denied');
    assert.equal(calls.length, 3, 'after a denial the viewer is not asked again');
    assert.equal((await detectModel({ protocol: 'about:', claude: { use: async () => null } })).kind, 'none');
  });
  await test('detectModel: the server says which engine answers, and may hand back text or an object', async () => {
    const mk = (court: Record<string, unknown>, text: unknown) => (async (url: string) => new Response(JSON.stringify(url === '/api/court' ? court : { text }), { status: 200 })) as unknown as typeof fetch;
    const small = await detectModel({ fetch: mk({ ok: true, model: true, gated: false, engine: 'workers-ai' }, { speaker: 'herald', reply: 'So noted.', actions: [] }), protocol: 'https:', claude: null, readKey: () => '' });
    assert.equal(small.kind, 'server'); assert.equal(small.engine, 'workers-ai'); assert.equal(small.usable(), true);
    assert.deepEqual(JSON.parse(await small.complete({ system: 's', messages: [{ role: 'user', content: 'u' }] })), { speaker: 'herald', reply: 'So noted.', actions: [] });
    const big = await detectModel({ fetch: mk({ ok: true, model: true, gated: false, engine: 'claude' }, 'x'), protocol: 'https:', claude: null, readKey: () => '' });
    assert.equal(big.engine, 'claude');
    const old = await detectModel({ fetch: mk({ ok: true, model: true, gated: false }, 'x'), protocol: 'https:', claude: null, readKey: () => '' });
    assert.equal(old.engine, 'claude');
    const none = await detectModel({ fetch: mk({ ok: true, model: false, gated: false, engine: 'workers-ai' }, 'x'), protocol: 'https:', claude: null, readKey: () => '' });
    assert.equal(none.kind, 'none');
  });
  await test('createWord: a transport that cannot answer shows as "none" and is not asked', async () => {
    const c = court();
    let key = '';
    const f = (async (url: string) => (url === '/api/court'
      ? new Response(JSON.stringify({ ok: true, model: true, gated: true }), { status: 200 })
      : new Response(JSON.stringify({ text: reply({ speaker: 'bailiff', reply: 'The purses, Sir. All of them.', actions: [{ type: 'collect_all' }] }) }), { status: 200 }))) as unknown as typeof fetch;
    const word = createWord(c.deps, { model: detectModel({ fetch: f, protocol: 'https:', claude: null, readKey: () => key }) });
    await word.ready;
    assert.equal(word.transport(), 'none'); assert.equal(word.needsCourtKey(), true);
    assert.equal((await word.speak('collect the rents', COURT)).via, 'offline');
    key = 'sesame';
    await new Promise(res => setTimeout(res, 1100));   // the stored key is re-read at most once a second
    assert.equal(word.transport(), 'server'); assert.equal(word.needsCourtKey(), false);
    const ex = await word.speak('collect the rents', COURT);
    assert.equal(ex.via, 'model'); assert.equal(ex.reply, 'The purses, Sir. All of them.');
  });

  await test('clip: cuts at a sentence when it can', () => {
    assert.equal(clip('One. Two. Three is a much longer sentence than the others.', 12), 'One. Two.');
    assert.ok(clip('word '.repeat(80), 200).length <= 200);
  });
}

main().then(() => {
  if (failures.length) {
    console.log(`\n${failures.length} FAILED, ${passed} passed\n`);
    for (const f of failures) console.log(' x ' + f + '\n');
    process.exit(1);
  }
  console.log(`word-core: all ${passed} tests passed`);
}, e => { console.error(e); process.exit(1); });
