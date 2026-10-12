/**
 * Dev page for the ledger and the council (ui-screens-c). Not shipped.
 *   node tools/shot.mjs src/dev/ui-screens-c.ts .tmp/ui-screens-c.png --eval "__dev.show('ledger:households')"
 *   __dev.show('ledger:accounts' | 'ledger:households' | 'ledger:orders' | 'ledger:oaths' | 'ledger:policies' | 'ledger:realm' | 'council')
 *   __dev.scenario('baron' | 'knight' | 'reeve')   (knight: empty seats with candidates; reeve: empty orders and oaths)
 *   __dev.cycle(['ledger:accounts', 'council'], 900)   step through views on a timer (for --shots)
 */
import { makeFixtureState, fakeSim } from './fixture';
import { BASE_CSS } from '../ui/css/base';
import { addStyle } from '../ui/kit';
import { create as createLedger } from '../ui/screens/ledger';
import { create as createCouncil } from '../ui/screens/council';
import type { UICtx, Screen, ScreenName, SimLike, AppAPI } from '../ui/api';
import type { Renderer } from '../render/api';
import type { AudioAPI } from '../audio/api';
import type { WordAPI, Exchange } from '../word/api';
import type { GameState, Action, ActionResult, MonthBook, StaffMember, Tenant, Herald } from '../sim/types';
import { TEMPERAMENT_DEFS } from '../data';
import type { TemperamentId } from '../data/ids';

// Until the content agent's temperaments land, give the dev page some to show (so cards are measured at full length).
const DEV_TEMPERS: Partial<Record<TemperamentId, [string, string]>> = {
  bodger: ['the Quick', 'Patches everything. It will hold, mostly, until it does not.'],
  perfectionist: ['the Exacting', 'Slow, proud, and right. Blames the previous mason, at length.'],
  iron: ['the Unyielding', 'Court first. Relishes the knock. Hears "deal with it" as eviction.'],
  soft: ['the Kindly', 'Asks after their mother. Forgives more than you would.'],
  lawful: ['the Punctual', 'The letter of the charter, to the day and the hour.'],
  bellower: ['the Audible', 'LOUD. The vacancy is known across two parishes, and so is the bellowing.'],
  snob: ['the Discerning', 'Shows homes only to persons of quality. The Fair Hearth Edict has views.'],
  pennypincher: ['the Careful', 'Begrudges every nail. The books balance and nobody is happy.'],
};
for (const [id, [ep, bl]] of Object.entries(DEV_TEMPERS) as [TemperamentId, [string, string]][]) {
  const d = TEMPERAMENT_DEFS[id];
  if (d && !d.blurb) { d.epithet = ep; d.blurb = bl; }
}

// fonts for a faithful look (dev only; the game loads them in index.html)
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&family=UnifrakturMaguntia&display=block';
document.head.appendChild(link);
addStyle('base', BASE_CSS);
addStyle('dev-c', `
#app{background:
  radial-gradient(40% 30% at 30% 40%,rgba(255,180,90,.28),transparent 70%),
  radial-gradient(30% 25% at 72% 60%,rgba(255,170,80,.18),transparent 70%),
  repeating-linear-gradient(90deg,rgba(255,220,160,.03) 0 3px,transparent 3px 11px),
  linear-gradient(180deg,#3b2414,#24150b 60%,#140c06)}
#app::before{content:"";position:absolute;left:18%;top:22%;width:64%;height:56%;border-radius:12px;background:linear-gradient(160deg,#5e7a3e,#3f5a2b);filter:blur(10px);opacity:.7}
#ui{position:absolute;inset:0}
.dev-toast{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);padding:8px 14px;background:#efe3c4;color:#2a1d14;border-radius:3px;font-family:Georgia,serif;font-size:14px;z-index:99;box-shadow:0 6px 18px rgba(0,0,0,.5)}
`);

// ───────────── a busier baron: a year of books, more orders, oaths, debts ─────────────

const DAY = 13 * 30 + 4.4; // 5th of Seedtide, Year 2
function book(index: number, rent: number, due: number, extra: Partial<MonthBook['expense']>, inc: Partial<MonthBook['income']> = {}): MonthBook {
  return {
    index,
    income: { rent, fees: 0, deposits_kept: 0, windfall: 0, loan: 0, ...inc },
    expense: { construction: 0, repairs: 0, wages: 0, upkeep: 0, tribute: 0, interest: 0, deposits_returned: 0, bribes: 0, gifts: 0, court: 0, land: 0, loan_repaid: 0, other: 0, ...extra },
    closing: 0, rentDue: due, rentCollected: rent,
  };
}
function decorate(s: GameState): void {
  const housed = Object.values(s.tenants).filter(t => t.status === 'housed');
  const roll = housed.reduce((a, t) => a + (t.lease?.rent ?? 0), 0);
  const curIdx = Math.floor(s.day / 30);
  const months: MonthBook[] = [];
  let gold = 120;
  for (let i = 0; i <= curIdx; i++) {
    const f = Math.min(1, 0.18 + i / curIdx * 0.85);
    const due = Math.round(roll * f), cur = i === curIdx;
    const got = cur ? Math.round(due * 0.62) : Math.round(due * (0.8 + ((i * 37) % 17) / 100));
    const wages = i >= 3 ? 14 * Math.min(4, 1 + Math.floor(i / 3)) : 0;
    const extra = {
      wages, upkeep: Math.round(6 + i * 2.2), repairs: 8 + ((i * 13) % 23), construction: [140, 90, 0, 260, 150, 0, 320, 0, 220, 400, 0, 0, 160, 0][i] ?? 0,
      tribute: i % 3 === 0 ? [15, 15, 60, 60, 180][Math.floor(i / 3)] ?? 180 : 0, interest: i >= 10 ? 14 : 0, gifts: i === 7 ? 12 : 0, court: i === 9 ? 5 : 0, land: i === 4 ? 135 : 0,
    };
    const inc = { fees: (i * 7) % 5, windfall: i === 6 ? 40 : 0, deposits_kept: i === 8 ? 16 : 0, loan: i === 10 ? 240 : 0 };
    const b = book(i, got, due, extra, inc);
    gold += Object.values(b.income).reduce((a, v) => a + v, 0) - Object.values(b.expense).reduce((a, v) => a + v, 0);
    b.closing = gold; months.push(b);
  }
  s.ledger.months = months.slice(-14);
  s.ledger.txns = [
    { day: s.day - 4.3, amount: -180, cat: 'tribute', memo: 'Tribute to the Crown, Seedtide' },
    { day: s.day - 4.2, amount: -56, cat: 'wages', memo: 'Wages: Hob, Agnes, Pip, Ansel' },
    { day: s.day - 4.2, amount: -38, cat: 'upkeep', memo: 'Upkeep of buildings' },
    { day: s.day - 3.6, amount: 16, cat: 'rent', memo: 'Rent, Thistle Cottage' },
    { day: s.day - 3.1, amount: 26, cat: 'rent', memo: 'Rent, Caskhammer Hall' },
    { day: s.day - 2.4, amount: -14, cat: 'interest', memo: 'Interest to the moneylender' },
    { day: s.day - 1.2, amount: 2, cat: 'fees', memo: 'Late fee, Wat Mudge' },
    { day: s.day - 0.4, amount: -9, cat: 'repairs', memo: 'Thatch, The Leaning Hovel' },
  ];
  s.loans = [{ principal: 240, ratePctMonth: 6, takenDay: 10 * 30 + 3 }];
  s.gold = months[months.length - 1]!.closing;

  // households: dates relative to the new day, a court case, a plan, a departure
  for (const t of housed) {
    t.movedInDay = Math.max(0, s.day - 30 - ((t.portraitSeed * 7) % 330));
    if (t.lease) { t.lease.startDay = t.movedInDay; if ((t.portraitSeed % 5) === 0) t.lease.startDay = s.day - 340; }
  }
  const tl = housed;
  if (tl[3]) { tl[3].lateStage = 'court'; tl[3].arrears = 32; tl[3].courtDay = s.day + 19; }
  if (tl[7]) { tl[7].lateStage = 'plan'; tl[7].arrears = 18; tl[7].plan = { left: 2, each: 9 }; }
  if (tl[9]) { tl[9].lateStage = 'grace'; }
  const gone: Tenant = { ...structuredClone(tl[0]!), id: 'gone1', name: 'Gerald Pottle', first: 'Gerald', status: 'evicted', buildingId: null, leftDay: s.day - 12, arrears: 24 };
  s.tenants[gone.id] = gone;
  const gone2: Tenant = { ...structuredClone(tl[1]!), id: 'gone2', name: 'Mother Agathe Stoop', first: 'Agathe', status: 'left', buildingId: null, leftDay: s.day - 31, arrears: 0 };
  s.tenants[gone2.id] = gone2;

  // orders and oaths of every kind
  s.orders.push(
    { id: 'o3', to: 'steward', text: 'Charge the goblins pet rent for the griffin, but let the old folk keep their cats.', gist: 'Pet rent on griffins. Cats for elders, free. Noted, in triplicate.', decision: null, incidentDef: 'unauthorized_griffin', when: [{ field: 'tenant.tags', op: 'excludes', value: 'elder' }], rule: 'choose', option: null, outcomeId: 'pet_rent', createdDay: 200, uses: 1 },
    { id: 'o4', to: 'crier', text: 'Ask after anyone who wants the tower. Wizards especially.', gist: 'References for the tower, LOUDLY. Aye.', decision: 'applicant', incidentDef: null, when: [{ field: 'building.type', op: '==', value: 'wizard_tower' }], rule: 'choose', option: 'screen', outcomeId: null, createdDay: 300, uses: 0 },
    { id: 'o5', to: 'bailiff', text: 'If they owe more than thirty crowns and have been here under a year, no more waiting.', gist: 'Thirty owed, under a year: no more patience. Gladly.', decision: 'late_rent', incidentDef: null, when: [{ field: 'tenant.arrears', op: '>', value: 30 }, { field: 'tenant.monthsHoused', op: '<', value: 12 }], rule: 'never', option: 'wait', outcomeId: null, createdDay: 350, uses: 2 },
  );
  s.orders[0]!.decision = 'late_rent'; s.orders[0]!.option = 'notice';
  const tw = (i: number) => tl[i] ?? tl[0]!;
  s.oaths.push(
    { id: 'w3', kind: 'pay', text: 'I will see you right for the ruined loaves. Ten crowns, by the end of the month.', toTenantId: tw(4).id, toName: tw(4).name, buildingId: null, buildingType: null, amount: 10, madeDay: s.day - 20, dueDay: s.day + 6, state: 'open', settledDay: null },
    { id: 'w4', kind: 'build', text: 'There will be a well on this side of the stream by midsummer.', toTenantId: null, toName: 'the households of Millside', buildingId: null, buildingType: 'well', amount: null, madeDay: s.day - 60, dueDay: s.day + 80, state: 'open', settledDay: null },
    { id: 'w5', kind: 'repair', text: 'Your chimney will draw by Candlenight.', toTenantId: tw(5).id, toName: tw(5).name, buildingId: null, buildingType: null, amount: null, madeDay: 200, dueDay: 330, state: 'kept', settledDay: 290 },
    { id: 'w6', kind: 'no_evict', text: 'Nobody will put you out this winter.', toTenantId: tw(6).id, toName: tw(6).name, buildingId: null, buildingType: null, amount: null, madeDay: 270, dueDay: 360, state: 'broken', settledDay: 341 },
    { id: 'w7', kind: 'word', text: 'You may keep the goat in the yard, but not in the kitchen.', toTenantId: tw(2).id, toName: tw(2).name, buildingId: null, buildingType: null, amount: null, madeDay: 90, dueDay: 180, state: 'kept', settledDay: 180 },
  );
  s.stats = { ...s.stats, rentCollected: 4280, oathsKept: 6, oathsBroken: 1, evictions: 1, tenantsHoused: 27, incidentsResolved: 61, incidentsIgnored: 7, wordsSpoken: 88, peakRentRoll: roll, daysInDebt: 41 };
  const hz: Herald[] = [
    { id: 'hx1', day: s.day - 9, kind: 'oath', text: 'You promised Bettony Wort a chimney that draws. It draws. She has told the whole lane.' },
    { id: 'hx2', day: s.day - 6, kind: 'crown', text: 'The tribute was paid in full and on the day. The Crown’s clerk was visibly disappointed.' },
    { id: 'hx3', day: s.day - 5, kind: 'bad', text: 'Gerald Pottle was put out of Damp End. The street watched, and then went home and talked.' },
    { id: 'hx4', day: s.day - 2, kind: 'good', text: 'The feast was judged a success. Two marriages and one lawsuit are expected to follow.' },
  ];
  s.heralds.push(...hz);
  s.heralds.sort((a, b) => a.day - b.day);
}

function scenarioState(name: string): GameState {
  if (name === 'knight') {
    const s = makeFixtureState('knight', 3 * 30 + 12.5);
    // the bailiff has left, the crier never had a stand: candidates fill the gaps
    const bailiff = Object.values(s.staff).find(m => m.role === 'bailiff');
    const crier = Object.values(s.staff).find(m => m.role === 'crier');
    if (bailiff) delete s.staff[bailiff.id];
    if (crier) delete s.staff[crier.id];
    for (const b of Object.values(s.buildings)) if (b.type === 'criers_stand') delete s.buildings[b.id];
    const mason = Object.values(s.staff).find(m => m.role === 'mason') as StaffMember;
    mason.hiredDay = 40; mason.loyalty = 48; mason.wage = 11;
    const job = { id: 'j1', kind: 'repair' as const, role: 'mason' as const, state: 'working' as const, assignee: mason.actorId, buildingId: Object.values(s.buildings).find(b => b.type === 'hovel')!.id, unit: 0, tenantId: null, applicantId: null, incidentId: null, outcomeId: null, x: 0, y: 0, workDays: 2, progress: 0.4, cost: 6, priority: 1, createdDay: s.day - 1, byRuler: false };
    s.jobs[job.id] = job;
    s.candidates = [
      { id: 'cb1', role: 'bailiff', name: 'Soft Tom Lamb', first: 'Tom', species: 'human', portraitSeed: 72, temperament: 'soft', skill: 2, wage: 12, temperamentKnown: true, pitch: 'I find most people pay if you ask about their mother first.' },
      { id: 'cb2', role: 'bailiff', name: 'Brunhild Doorhammer', first: 'Brunhild', species: 'dwarf', portraitSeed: 81, temperament: 'iron', skill: 4, wage: 23, temperamentKnown: false, pitch: 'I have never knocked on a door twice.' },
      { id: 'cb3', role: 'bailiff', name: 'Snell of the Lesser Ledger', first: 'Snell', species: 'goblin', portraitSeed: 93, temperament: 'lawful', skill: 3, wage: 17, temperamentKnown: true, pitch: 'Every notice served in triplicate, and a fourth copy for my own collection.' },
      { id: 'cc1', role: 'crier', name: 'Lady Pru Farthingale', first: 'Pru', species: 'halfling', portraitSeed: 73, temperament: 'snob', skill: 4, wage: 23, temperamentKnown: false, pitch: 'I announce only vacancies of quality. To persons of quality.' },
      { id: 'cc2', role: 'crier', name: 'Big Wenna Brass', first: 'Wenna', species: 'human', portraitSeed: 74, temperament: 'bellower', skill: 2, wage: 12, temperamentKnown: true, pitch: 'They will hear me in the next parish. They have asked me to stop.' },
      { id: 'cs1', role: 'steward', name: 'Ansel Quillfeather', first: 'Ansel', species: 'human', portraitSeed: 75, temperament: 'pennypincher', skill: 3, wage: 17, temperamentKnown: false, pitch: 'I have saved three lords from ruin and one from a very good dinner.' },
      { id: 'cs2', role: 'steward', name: 'Mirelda Tallyhand', first: 'Mirelda', species: 'halfling', portraitSeed: 76, temperament: 'bythebook', skill: 2, wage: 12, temperamentKnown: true, pitch: 'Forms in order. Then the order of the forms.' },
    ];
    s.orders = s.orders.slice(1);
    return s;
  }
  if (name === 'reeve') {
    const s = makeFixtureState('reeve', 12.5);
    s.orders = []; s.oaths = []; s.stats.oathsKept = 0; s.stats.oathsBroken = 0;
    return s;
  }
  const s = makeFixtureState('baron', DAY);
  decorate(s);
  return s;
}

// ───────────── fakes ─────────────

function devSim(state: GameState): SimLike {
  const base = fakeSim(state);
  return {
    get state() { return base.state; },
    setSpeed: base.setSpeed,
    dispatch(a: Action): ActionResult {
      const s = base.state;
      switch (a.type) {
        case 'set_policy': Object.assign(s.policies, a.policy); break;
        case 'revoke_order': s.orders = s.orders.filter(o => o.id !== a.orderId); break;
        case 'set_wage': { const m = s.staff[a.staffId]; if (m) { m.loyalty = Math.max(0, Math.min(100, m.loyalty + (a.wage > m.wage ? 3 : -4))); m.wage = a.wage; } break; }
        case 'dismiss_staff': delete s.staff[a.staffId]; break;
        case 'release_oath': { const o = s.oaths.find(x => x.id === a.oathId); if (o) { o.state = 'released'; o.settledDay = s.day; } break; }
        case 'repay_loan': { let left = a.amount; s.gold -= a.amount; for (const l of s.loans) { const p = Math.min(l.principal, left); l.principal -= p; left -= p; } s.loans = s.loans.filter(l => l.principal > 0); break; }
        case 'hire': {
          const c = s.candidates.find(x => x.id === a.candidateId); if (!c) return { ok: false, code: 'not_found', reason: 'They have gone home, my lord.' };
          s.staff['s' + c.id] = { id: 's' + c.id, role: c.role, name: c.name, first: c.first, species: c.species, portraitSeed: c.portraitSeed, temperament: c.temperament, skill: c.skill, wage: c.wage, loyalty: 60, hiredDay: s.day, actorId: null, authority: 0, jobsDone: 0 };
          s.candidates = s.candidates.filter(x => x.role !== c.role); break;
        }
      }
      return base.dispatch(a);
    },
  };
}
const noop = () => {};
const fakeRenderer = new Proxy({}, { get: (_t, k) => k === 'anchor' ? () => ({ x: 0, y: 0, visible: false, scale: 1 }) : k === 'stats' ? () => ({ fps: 0, calls: 0, tris: 0 }) : noop }) as unknown as Renderer;
const fakeAudio: AudioAPI = { unlock: noop, sfx: noop, handleEvents: noop, update: noop, setMood: noop, voice: () => ({ stop: noop }), setVolumes: noop, volumes: () => ({ master: 1, music: 1, sfx: 1, voice: 1 }), dispose: noop };
const fakeApp: AppAPI = { newGame: noop, hasSave: () => false, continueGame: () => false, saveNow: noop, toTitle: noop, dynasty: () => [], settings: () => ({ quality: 'medium', master: 1, music: 1, sfx: 1, voice: 1, wit: 'quick', courtKey: '', hints: true }), setSettings: noop, inGame: () => true, saveInfo: () => null };

let sim: SimLike = devSim(scenarioState('baron'));
const fakeWord: WordAPI = {
  transport: () => 'none', ready: Promise.resolve(),
  speak: (text, target) => new Promise<Exchange>(res => setTimeout(() => {
    const role = 'to' in target && target.to !== 'court' ? target.to : 'bailiff';
    const m = Object.values(sim.state.staff).find(x => x.role === role);
    res({
      id: 'x' + Date.now(), day: sim.state.day, text, target,
      speaker: { kind: 'staff', name: m?.name ?? 'Nobody', first: m?.first ?? 'Nobody', species: m?.species ?? 'human', portraitSeed: m?.portraitSeed ?? 1, role, staffId: m?.id, mood: 'smug' },
      reply: 'No widows out in winter. I will write it on the door of the post, my lord. Shall it stand?', status: 'needs_confirm',
      applied: [], pending: [], orders: [], oaths: [], via: 'offline', confirm: noop, cancel: noop,
    });
  }, 500)),
  openAudience: () => null,
  mic: { supported: true, listening: false, start: noop, stop: noop },
  log: () => [], onChange: () => noop,
  needsCourtKey: () => false, setWit: noop, engine: () => null,
};

const app = document.getElementById('app')!;
const ui = document.createElement('div'); ui.id = 'ui'; app.appendChild(ui);
const screens = new Map<ScreenName, Screen>();
let current: ScreenName | null = null;
const ctx: UICtx = {
  root: app, get sim() { return sim; }, state: () => sim.state, renderer: fakeRenderer, word: fakeWord, audio: fakeAudio, app: fakeApp,
  act(a) { const r = sim.dispatch(a); if (!r.ok) ctx.toast(r.reason, 'bad'); return r; },
  open(name, arg) { if (current && current !== name) ctx.close(current); const sc = screens.get(name); if (!sc) { console.log('[dev] open', name, arg); return; } current = name; sc.open(arg); },
  close(name) { const n = name ?? current; if (!n) return; screens.get(n)?.close(); if (current === n) current = null; },
  isOpen: n => current === n,
  toast(text) { const t = document.createElement('div'); t.className = 'dev-toast'; t.textContent = text; app.appendChild(t); setTimeout(() => t.remove(), 2400); },
  select(sel) { console.log('[dev] select', JSON.stringify(sel)); },
  holdCrawl: () => noop,
};
screens.set('ledger', createLedger(ctx));
screens.set('council', createCouncil(ctx));
for (const sc of screens.values()) ui.appendChild(sc.el);
addEventListener('keydown', e => { if (e.key === 'Escape') ctx.close(); });
let last = performance.now();
const frame = (t: number) => { const dt = (t - last) / 1000; last = t; if (current) screens.get(current)?.update?.(sim.state, dt); requestAnimationFrame(frame); };
requestAnimationFrame(frame);

/**
 * 'ledger:orders' opens a tab; a trailing '!speak=bailiff' clicks Speak on that seat and says
 * something; '!dismiss=mason' asks to dismiss; '!revoke' asks to revoke the first order.
 */
function show(view: string): void {
  const [main, ...cmds] = view.split('!');
  const [name, arg] = main!.split(':') as [ScreenName, string | undefined];
  ctx.open(name, arg);
  for (const c of cmds) {
    const [verb, who] = c.split('=');
    const seatOf = () => who ? document.querySelector(`.cnc-seat[data-role="${who}"]`) : null;
    const seat = seatOf();
    if (verb === 'speak' && seat) {
      (seat.querySelector('.cnc-acts .ll-btn-primary') as HTMLButtonElement | null)?.click();
      const input = seatOf()?.querySelector('.cnc-speak input') as HTMLInputElement | null;   // the seat was redrawn
      if (input && who !== 'mason') { input.value = 'Never put a widow out in winter.'; (input.form as HTMLFormElement).requestSubmit(); }
    }
    if (verb === 'dismiss' && seat) (seat.querySelector('.cnc-acts .ll-btn-danger') as HTMLButtonElement | null)?.click();
    if (verb === 'revoke') (document.querySelector('.ldg-order .foot .ll-btn') as HTMLButtonElement | null)?.click();
    if (verb === 'scroll') setTimeout(() => { for (const sel of ['.ldg-spread', '.cnc-veil']) { const el = document.querySelector(sel) as HTMLElement | null; if (el && el.offsetParent !== null) el.scrollTop = Number(who) || 9999; } }, 300);
  }
}
function scenario(name: string): void { const was = current; if (was) ctx.close(was); sim = devSim(scenarioState(name)); }
let cycleT: ReturnType<typeof setInterval> | null = null;
function cycle(views: string[], every: number): void {
  let i = 0; if (cycleT) clearInterval(cycleT);
  const step = () => { const v = views[i++]; if (!v) { if (cycleT) clearInterval(cycleT); return; } if (v.startsWith('scenario=')) { scenario(v.slice(9)); step(); return; } show(v); };
  step(); cycleT = setInterval(step, every);
}
/**
 * A contact sheet: one iframe per view, stacked, each a real viewport of the page's width.
 * Resolves once every frame has rendered (await it from --eval, then crop the shot).
 *   __dev.sheet(['ledger:accounts', 'knight/council'])   ("scenario/view")
 */
function sheet(views: string[], cols = 1): Promise<number> {
  const rows = Math.ceil(views.length / cols);
  const frameH = Math.floor(innerHeight / rows), frameW = Math.floor(innerWidth / cols);
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;inset:0;z-index:1000;background:#000;display:grid;grid-template-columns:repeat(${cols},${frameW}px);grid-auto-rows:${frameH}px`;
  document.body.appendChild(holder);
  const base = location.href.split('#')[0];
  let pending = views.length;
  return new Promise(res => {
    addEventListener('message', e => {
      if (e.data?.devError) console.warn('[frame error] ' + e.data.devError);
      if (e.data?.devReady) { console.warn('[frame ready] ' + e.data.devReady); if (--pending === 0) setTimeout(() => res(frameH), 700); }
    });
    for (const v of views) {
      const f = document.createElement('iframe');
      f.style.cssText = `width:${frameW}px;height:${frameH}px;border:0;display:block`;
      f.src = `${base}#view=${encodeURIComponent(v)}`;
      holder.appendChild(f);
    }
    setTimeout(() => res(frameH), 45000);
  });
}
(window as unknown as { __dev: unknown }).__dev = { show, scenario, cycle, sheet, ctx, get state() { return sim.state; } };

const hashView = decodeURIComponent((location.hash.match(/view=([^&]+)/) ?? [])[1] ?? '');
if (hashView) {
  addEventListener('error', e => parent.postMessage({ devError: String(e.message) + ' ' + (e.error?.stack ?? '') }, '*'));
  // a contact-sheet frame: hold still for the camera
  addStyle('dev-c-still', '*,*::before,*::after{animation:none!important;transition:none!important}');
  const [sc, view] = hashView.includes('/') ? hashView.split('/') as [string, string] : ['baron', hashView];
  scenario(sc);
  const ready = () => parent.postMessage({ devReady: view }, '*');
  setTimeout(() => {
    show(view);
    if (document.fonts) document.fonts.ready.then(() => setTimeout(() => { if (current) screens.get(current)?.update?.(sim.state, 0); ready(); }, view.includes('!') ? 2600 : 1100));
    else setTimeout(ready, 1400);
  }, 200);
} else {
  document.fonts?.ready.then(() => { if (!current) show('ledger:accounts'); });
  setTimeout(() => { if (!current) show('ledger:accounts'); }, 400);
}
