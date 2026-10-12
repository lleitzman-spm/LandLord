/**
 * Dev page for the three tool parts (build book, inspector, Word bar).
 * NOT shipped. Mounts them in a mock frame over a dark table with a fake
 * renderer, the fixture sim and a fake word layer that answers with canned
 * exchanges (done, needs_confirm, refused; "mumble" is unclear).
 *
 *   node tools/shot.mjs src/dev/ui-tools.ts .tmp/ui-tools-x.png --eval "__dev.scene('frame-book')"
 *
 * Scenes: frame-idle, frame-book, frame-book-open, frame-inspect, frame-tenant,
 * frame-land, frame-road, phone-inspect, phone-tenant, inspectors-a, inspectors-b,
 * books, words, pics, and phones / phones-b (four 400 x 800 frames side by side;
 * shoot those at --w 1648 --h 816). Each returns a promise that settles when the
 * pose is ready.
 */
import { BASE_CSS } from '../ui/css/base';
import { SHELL_CSS } from '../ui/css/shell';
import { addStyle, h, clear } from '../ui/kit';
import type { UICtx, AppAPI, SimLike } from '../ui/api';
import type { Part } from '../ui/parts/part';
import type { Renderer, Tool } from '../render/api';
import type { WordAPI, Exchange, SpeakTarget, Speaker, MicAPI } from '../word/api';
import type { AudioAPI } from '../audio/api';
import type { Action, ActionResult, GameState, Id, StandingOrder, Oath } from '../sim/types';
import { makeFixtureState, fakeSim } from './fixture';
import { mount as mountBuild, pictogram, type BuildMenuPart } from '../ui/parts/buildmenu';
import { mount as mountInspector, type InspectorPart } from '../ui/parts/inspector';
import { mount as mountWord, type WordBarPart } from '../ui/parts/wordbar';
import { BUILDING_TYPES } from '../data/ids';
import { BUILDINGS, TRAIT_DEFS, TAG_DEFS, TEMPERAMENT_DEFS } from '../data';

type Sel = { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id } | null;
type Canned = 'cycle' | 'done' | 'rich' | 'needs_confirm' | 'refused' | 'unclear' | 'never';

// the game's fonts, from a local cache when the shot harness has one (dev only)
const FONT_CSS = [['IM Fell English', 'normal', 'fell'], ['IM Fell English', 'italic', 'fell-i'], ['IM Fell English SC', 'normal', 'fellsc'], ['UnifrakturMaguntia', 'normal', 'frak']]
  .map(([fam, style, file]) => `@font-face{font-family:'${fam}';font-style:${style};font-weight:400;src:url(../ui-tools-fonts/${file}.woff2) format('woff2')}`).join('');

const DEV_CSS = `
#ui.dev-frame{background:
  radial-gradient(46% 40% at 52% 46%,rgba(120,150,84,.55),rgba(74,104,60,.5) 60%,transparent 62%),
  radial-gradient(90% 80% at 50% 45%,#6a4526 0%,#3a2414 55%,#0e0a08 100%)}
.dev-hud{width:330px;height:204px;border:1px dashed rgba(239,227,196,.35);border-radius:3px;color:rgba(239,227,196,.45);display:grid;place-items:center;font-family:var(--f-head);letter-spacing:.1em;pointer-events:none}
.dev-heralds{width:100%;height:150px;border:1px dashed rgba(239,227,196,.25);border-radius:3px;pointer-events:none}
.dev-readout{position:absolute;right:20px;top:176px;max-width:300px;text-align:right;font:11px/1.4 ui-monospace,monospace;color:rgba(239,227,196,.6);pointer-events:none;white-space:pre-line;z-index:9}
.dev-toast{position:absolute;right:20px;bottom:20px;max-width:300px;padding:6px 10px;background:var(--parch);color:var(--ink);border:1px solid var(--parch-edge);border-radius:3px;font-size:14px;pointer-events:none;z-index:9}
@media (max-width:699px){
  .dev-hud{width:100%;height:44px}
  .dev-heralds,.dev-readout{display:none}
}
#ui.dev-gallery{overflow:auto;background:radial-gradient(90% 80% at 50% 30%,#5a3b22,#2a1a10 60%,#0e0a08);padding:18px;display:flex;flex-wrap:wrap;gap:18px;align-content:flex-start;align-items:flex-start}
.dev-cell{position:relative;display:flex;flex-direction:column;gap:6px}
.dev-cap{font:12px/1.2 ui-monospace,monospace;color:rgba(239,227,196,.75)}
.dev-inspcell{width:336px}
.dev-wordcell{width:540px;height:300px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 10px 6px}
.dev-wordcell .dev-cap{align-self:flex-start;margin-bottom:auto}
.dev-pics{display:grid;grid-template-columns:repeat(9,1fr);gap:10px 8px;padding:14px;width:1220px}
.dev-pic{display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--f-head);font-size:12px;color:var(--ink-2);text-align:center}
.dev-pic .big{width:96px;height:96px}
.dev-pic .small{width:40px;height:40px}
`;

// ───────────────────────── fakes ─────────────────────────

function fakeRenderer(say: (line: string) => void): Renderer & { fire(type: string, ...args: unknown[]): void } {
  const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
  const r = {
    reset() {}, sync() {}, handleEvents() {}, frame() {}, resize() {}, setMode() {}, setSelection() {}, setQuality() {}, dispose() {},
    setTool(tool: Tool) { say('tool: ' + JSON.stringify(tool)); },
    focus(target: unknown) { say('focus: ' + JSON.stringify(target)); },
    anchor() { return { x: 0, y: 0, visible: false, scale: 1 }; },
    setHighlight(tiles: [number, number][] | null, color?: number) { say(tiles ? `highlight: ${tiles.length} tiles #${(color ?? 0).toString(16)}` : 'highlight: none'); },
    on(type: string, cb: (...a: unknown[]) => void) { (listeners[type] ??= []).push(cb); },
    stats() { return { fps: 60, calls: 0, tris: 0 }; },
    fire(type: string, ...args: unknown[]) { for (const cb of listeners[type] ?? []) cb(...args); },
  };
  return r as unknown as Renderer & { fire(type: string, ...args: unknown[]): void };
}

const fakeAudio: AudioAPI = {
  unlock() {}, sfx() {}, handleEvents() {}, update() {}, setMood() {}, voice() { return { stop() {} }; },
  setVolumes() {}, volumes() { return { master: 1, music: 1, sfx: 1, voice: 1 }; }, dispose() {},
};
/** the dev court: any key that is not empty is the right one */
let devCourtKey = '';
const devKeyListeners = new Set<() => void>();
const fakeApp: AppAPI = {
  newGame() {}, hasSave: () => false, saveInfo: () => null, continueGame: () => false, saveNow() {}, toTitle() {}, dynasty: () => [],
  settings: () => ({ quality: 'medium', master: 1, music: 1, sfx: 1, voice: 1, wit: 'quick', courtKey: devCourtKey, hints: true }),
  setSettings(patch) { if (typeof patch.courtKey === 'string') { devCourtKey = patch.courtKey; devKeyListeners.forEach(f => f()); } }, inGame: () => true,
};

function fakeMic(supported: boolean): MicAPI {
  let timers: number[] = [];
  let final: ((t: string) => void) | null = null;
  const full = 'Hob, mend the roof at the Leaning Hovel before the rains';
  const m: MicAPI = {
    supported, listening: false,
    start(hd) {
      if (!supported) { hd.onError?.('unsupported'); return; }
      m.listening = true; final = hd.onFinal;
      const words = full.split(' ');
      words.forEach((_, i) => timers.push(window.setTimeout(() => hd.onPartial?.(words.slice(0, i + 1).join(' ')), 120 + i * 140)));
    },
    stop() { timers.forEach(t => window.clearTimeout(t)); timers = []; m.listening = false; const f = final; final = null; window.setTimeout(() => f?.(full + '.'), 80); },
  };
  return m;
}

function fakeWord(st: () => GameState, opts: { canned?: Canned; online?: boolean; mic?: boolean; wantsKey?: boolean } = {}): WordAPI {
  const log: Exchange[] = [];
  const subs = new Set<() => void>();
  const notify = (): void => subs.forEach(f => f());
  let n = 0;
  const staff = (role: 'mason' | 'bailiff' | 'crier' | 'steward'): Speaker => {
    const m = Object.values(st().staff).find(x => x.role === role);
    return m ? { kind: 'staff', name: m.name, first: m.first, species: m.species, portraitSeed: m.portraitSeed, role, staffId: m.id, mood: 'neutral' }
      : { kind: 'herald', name: 'The herald', first: 'Herald', species: 'human', portraitSeed: 99, mood: 'neutral' };
  };
  const order: StandingOrder = { id: 'o9', to: 'bailiff', text: 'Never evict a widow in winter.', gist: 'No widows out in winter.', decision: 'eviction_ready', incidentDef: null, when: [], rule: 'never', option: 'evict', outcomeId: null, createdDay: 34, uses: 0 };
  const oath: Oath = { id: 'w9', kind: 'repair', text: 'That roof will be mended before the first frost.', toTenantId: null, toName: 'Wat Mudge', buildingId: null, buildingType: null, amount: null, madeDay: 34, dueDay: 270, state: 'open', settledDay: null };
  function make(text: string, target: SpeakTarget, kind: Canned): Exchange {
    const base = { id: 'x' + (++n), day: st().day, text, target, applied: [], pending: [], orders: [], oaths: [], via: (opts.online === false ? 'offline' : 'model') as 'model' | 'offline' };
    const ex: Exchange = kind === 'needs_confirm'
      ? { ...base, speaker: { ...staff('bailiff'), mood: 'smug' }, status: 'needs_confirm', pending: [{ type: 'add_order', order }],
        reply: 'So. No widow goes out in winter, whatever she owes. I shall write it on the post and resent it quietly. Is that your word, my lord?', confirm() {}, cancel() {} }
      : kind === 'refused'
        ? { ...base, speaker: { ...staff('steward'), mood: 'worried' }, status: 'refused',
          reply: 'A feast, my lord. I have counted the coffers twice. They hold what they held the first time, and it is not a feast.', confirm() {}, cancel() {} }
        : kind === 'unclear'
          ? { ...base, speaker: { kind: 'herald', name: 'The herald', first: 'Herald', species: 'human', portraitSeed: 31, mood: 'neutral' }, status: 'unclear',
            reply: 'The court has conferred, my lord, and none of us is certain what was asked.', confirm() {}, cancel() {} }
          : kind === 'rich'
            ? { ...base, speaker: { ...staff('mason'), mood: 'pleased' }, status: 'done', applied: [{ action: { type: 'collect_all' }, result: { ok: true } }], orders: [order], oaths: [oath],
              reply: 'Mended before the frost, and properly. I will tell Wat you said so, so that you have to mean it.', confirm() {}, cancel() {} }
            : { ...base, speaker: { ...staff('mason'), mood: 'pleased' }, status: 'done', applied: [{ action: { type: 'collect_all' }, result: { ok: true } }],
              reply: 'Proper mending at the Leaning Hovel. Thatch, not straw and prayers. Two days, nine crowns. The last mason used porridge.', confirm() {}, cancel() {} };
    ex.confirm = () => { ex.status = 'done'; ex.orders = [order]; ex.pending = []; notify(); };
    ex.cancel = () => { ex.pending = []; notify(); };
    return ex;
  }
  return {
    transport: () => (opts.online === false ? 'none' : 'server'),
    ready: Promise.resolve(),
    speak(text, target) {
      const kind: Canned = /mumble|\?$/.test(text) ? 'unclear' : opts.canned === 'cycle' || !opts.canned ? (['done', 'needs_confirm', 'refused'] as const)[log.length % 3]! : opts.canned;
      if (kind === 'never') return new Promise<Exchange>(() => {});
      return new Promise(res => window.setTimeout(() => { const ex = make(text, target, kind); log.push(ex); notify(); res(ex); }, 260));
    },
    openAudience: () => null,
    mic: fakeMic(opts.mic ?? true),
    log: () => log,
    needsCourtKey: () => !!opts.wantsKey && (!devCourtKey || devCourtKey === 'wrong'),
    setWit() {},
    engine: () => (opts.online === false ? null : 'claude'),
    onChange(cb) { subs.add(cb); devKeyListeners.add(cb); return () => { subs.delete(cb); devKeyListeners.delete(cb); }; },
  };
}

/** fakeSim accepts everything; here a few actions also leave a mark, so the parts can be seen reacting. */
function applyLocally(st: GameState, a: Action): void {
  if (a.type === 'set_rent') { const b = st.buildings[a.buildingId]; if (b) b.rent = a.rent; }
  else if (a.type === 'rename_building') { const b = st.buildings[a.buildingId]; if (b) b.name = a.name; }
  else if (a.type === 'set_listed') { const b = st.buildings[a.buildingId]; if (b) for (const u of b.units) if (!u.tenantId) u.listed = a.listed; }
  else if (a.type === 'set_wage') { const m = st.staff[a.staffId]; if (m) m.wage = a.wage; }
  else if (a.type === 'buy_parcel') { const p = st.map.parcels.find(q => q.id === a.parcelId); if (p) { p.owned = true; st.gold -= p.price; } }
  else if (a.type === 'gift') st.gold -= a.amount;
  else if (a.type === 'collect_purse') { const u = st.buildings[a.buildingId]?.units[a.unit ?? 0]; if (u) { st.gold += u.purse; u.purse = 0; } }
}

interface Rig { ctx: UICtx; parts: Part[]; sim: SimLike & { log: Action[] }; select(sel: Sel): void; word: WordAPI; renderer: ReturnType<typeof fakeRenderer>; lines: string[]; /** every line ever said, uncapped (the self-test reads it) */ all: string[] }
function makeRig(root: HTMLElement, rank: 'reeve' | 'knight' | 'baron', wordOpts: Parameters<typeof fakeWord>[1] = {}, onSay?: (lines: string[]) => void, onToast?: (t: string) => void): Rig {
  const st = makeFixtureState(rank);
  const sim = fakeSim(st);
  const lines: string[] = [], all: string[] = [];
  const say = (l: string): void => { all.push(l); lines.push(l); if (lines.length > 7) lines.shift(); onSay?.(lines); };
  const renderer = fakeRenderer(say);
  const word = fakeWord(() => sim.state, wordOpts);
  const parts: Part[] = [];
  let crawl = 0;
  const rig: Rig = {
    parts, sim, word, renderer, lines, all,
    select(sel) { renderer.setSelection(sel ? { buildingId: sel.buildingId } : null); for (const p of parts) p.onSelect?.(sel); },
    ctx: {
      root, sim, state: () => sim.state, renderer, word, audio: fakeAudio, app: fakeApp,
      act(a: Action): ActionResult { const r = sim.dispatch(a); applyLocally(sim.state, a); say('act: ' + a.type); return r; },
      open(screen, arg) { say(`open: ${screen}${arg !== undefined ? ' ' + String(arg) : ''}`); onToast?.(`(would open the ${screen})`); },
      close() {}, isOpen: () => false,
      toast(text) { say('toast: ' + text); onToast?.(text); },
      select(sel) { rig.select(sel); },
      holdCrawl() { crawl++; say('crawl: ' + crawl); return () => { crawl--; say('crawl: ' + crawl); }; },
    },
  };
  return rig;
}

// ───────────────────────── the page ─────────────────────────

addStyle('base', BASE_CSS);
addStyle('shell', SHELL_CSS);
addStyle('dev-fonts', FONT_CSS);
addStyle('dev', DEV_CSS);
const app = document.getElementById('app')!;
const ui = h('div', { id: 'ui' });
app.appendChild(ui);

let rigs: Rig[] = [];
function loop(): void {
  let last = performance.now();
  const step = (): void => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const r of rigs) for (const p of r.parts) p.update?.(r.sim.state, dt);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
loop();

const wait = (ms: number): Promise<void> => new Promise(res => window.setTimeout(res, ms));
const frames = (n = 2): Promise<void> => new Promise(res => { const f = (): void => { if (--n <= 0) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
function reset(cls: string): void {
  // parts listen on the window: put the old ones away properly, or they answer keys from beyond the grave
  for (const r of rigs) for (const p of r.parts) (p as Part & { dispose?: () => void }).dispose?.();
  rigs = []; frameNow = null; clear(ui); ui.className = cls; ui.removeAttribute('style');
}

interface Frame { rig: Rig; build: BuildMenuPart; insp: InspectorPart; wordbar: WordBarPart }
/** The mock frame: the real frame's slot classes and CSS (css/shell.ts), placeholders where its own parts would be. */
function frame(rank: 'reeve' | 'knight' | 'baron' = 'baron', wordOpts: Parameters<typeof fakeWord>[1] = {}): Frame {
  reset('dev-frame');
  const readout = h('div', { class: 'dev-readout' });
  const toast = h('div', { class: 'dev-toast', hidden: true });
  let toastT = 0;
  const rig = makeRig(ui, rank, wordOpts, l => { readout.textContent = l.join('\n'); },
    t => { toast.textContent = t; toast.hidden = false; window.clearTimeout(toastT); toastT = window.setTimeout(() => { toast.hidden = true; }, 2600); });
  const build = mountBuild(rig.ctx), insp = mountInspector(rig.ctx), wordbar = mountWord(rig.ctx);
  rig.parts.push(build, insp, wordbar);
  const slot = (name: string, ...kids: Node[]): HTMLElement => h('div', { class: `ll-slot ll-slot-${name}` }, kids);
  const hud = slot('hud', h('div', { class: 'dev-hud' }, 'the plaque'));
  const word = slot('word', wordbar.el);
  ui.append(h('div', { class: 'll-frame ll-pass' }, hud, slot('left', build.el), slot('inspector', insp.el), slot('heralds', h('div', { class: 'dev-heralds' })), word), readout, toast);
  slotRo?.disconnect();
  slotRo = new ResizeObserver(() => {
    ui.style.setProperty('--ll-top-h', hud.offsetHeight + 'px');
    ui.style.setProperty('--ll-word-h', word.offsetHeight + 'px');
  });
  slotRo.observe(hud); slotRo.observe(word);
  rigs = [rig];
  frameNow = { rig, build, insp, wordbar };
  return frameNow;
}
let slotRo: ResizeObserver | null = null;
let frameNow: Frame | null = null;
// the frame's keys, near enough: B and T / Enter summon, Esc puts things away
window.addEventListener('keydown', e => {
  const f = frameNow, a = document.activeElement as HTMLElement | null;
  if (!f || e.defaultPrevented || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'))) return;
  const k = e.key.toLowerCase();
  if (k === 'b' || k === 't' || k === 'enter') { ui.dispatchEvent(new CustomEvent('ll:summon', { detail: k === 'b' ? 'build' : 'word', cancelable: true })); e.preventDefault(); }
  else if (k === 'escape') { f.rig.renderer.fire('cancel'); if (!f.build.escape() && !f.insp.escape() && !f.wordbar.escape()) f.rig.select(null); }
});

const byName = (st: GameState, name: string): Id => Object.values(st.buildings).find(b => b.name === name)!.id;
const tenantAt = (st: GameState, name: string, unit = 0): Id => st.buildings[byName(st, name)]!.units[unit]!.tenantId!;

async function sayIn(wordbarEl: HTMLElement, text: string, settle = true): Promise<void> {
  const input = wordbarEl.querySelector<HTMLInputElement>('.ll-wb-input')!;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  if (!settle) { await frames(3); return; }
  await wait(420);
  (wordbarEl.querySelector('.ll-wb-text') as HTMLElement | null)?.click();
  // rest the pointer on the answer, so it does not put itself away before the picture is taken
  wordbarEl.querySelector('.ll-wb-ex')?.dispatchEvent(new PointerEvent('pointerenter'));
  await frames(4);
}

/**
 * Dev only: where the content files are still blank placeholders, lend a few sample lines so the
 * sheets can be judged with words in them. Real content, once written, is left alone.
 */
function sampleContent(): void {
  const lend = <T extends { blurb: string }>(d: T | undefined, more: Partial<T>): void => { if (d && !d.blurb) Object.assign(d, more); };
  lend(TRAIT_DEFS.punctual, { blurb: 'Pays on the morning of the 1st, and waits to be thanked.', good: true });
  lend(TRAIT_DEFS.forgetful, { blurb: 'Means to pay. Means it every month.' });
  lend(TRAIT_DEFS.handy, { blurb: 'Mends small things unasked, and mentions it.', good: true });
  lend(TRAIT_DEFS.haggler, { blurb: 'Regards the posted rent as an opening remark.' });
  lend(TAG_DEFS.widow, { blurb: 'Lost a spouse. The street watches how you treat her.' });
  lend(TAG_DEFS.newlyweds, { blurb: 'Married this year. Still pleased about it.' });
  lend(TEMPERAMENT_DEFS.bodger, { epithet: 'the Quick', blurb: 'Fast and cheap. "It will hold" is a promise, of a kind.' });
  lend(TEMPERAMENT_DEFS.pennypincher, { epithet: 'the Careful', blurb: 'Begrudges every nail, and counts the ones you already own.' });
}

/** make the fixture a little richer so every corner of a sheet has something in it */
function enrich(st: GameState): void {
  sampleContent();
  // the fixture has no vacancy without squatters, so no applicants: empty one unit and send two
  const row = st.buildings[byName(st, 'The Long Row')];
  if (row && !Object.keys(st.applicants).length) {
    const u = row.units[1]!;
    if (u.tenantId) delete st.tenants[u.tenantId];
    u.tenantId = null; u.vacantSince = st.day - 12; u.listed = true; u.purse = 0;
    st.applicants.p1 = {
      id: 'p1', buildingId: row.id, unit: 1, arrivedDay: st.day - 1, leavesDay: st.day + 7, maxRent: row.rent + 3, shown: false, screened: false, actorId: null,
      household: { id: 'tp1', name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 4242, household: 3, traits: ['handy', 'haggler'], revealed: [], tags: ['newlyweds'], pets: [], income: 44, reliability: 0.8 },
    };
    st.applicants.p2 = {
      id: 'p2', buildingId: row.id, unit: 1, arrivedDay: st.day - 3, leavesDay: st.day + 4.2, maxRent: row.rent - 2, shown: true, screened: true, actorId: null,
      household: { id: 'tp2', name: 'Marigold Pennywhistle', first: 'Marigold', species: 'halfling', trade: 'beekeeper', character: null, portraitSeed: 777, household: 5, traits: ['haggler', 'handy'], revealed: ['haggler'], tags: [], pets: ['goat'], income: 39, reliability: 0.9 },
    };
    st.incidents.ia1 = { id: 'ia1', defId: 'sys_applicant', state: 'open', buildingId: row.id, unit: 1, tenantId: null, applicantId: 'p2', startedDay: st.day - 1, expiresDay: st.day + 4.2, vars: { tenant: 'Marigold Pennywhistle', building: row.name }, outcomeId: null, resolvedBy: null, jobId: null, actorId: null, reported: false };
  }
  const marta = st.tenants[tenantAt(st, 'The Leaning Hovel')]!;
  marta.revealed = ['punctual']; marta.traits = ['punctual', 'gossip', 'pet_lover'];
  marta.memory = [
    { day: 3, text: 'You mended the roof the same day they asked.', valence: 1 },
    { day: 18, text: 'You raised the rent in the week of the funeral.', valence: -2 },
    { day: 29, text: 'You forgave a month of rent when they could not pay.', valence: 2 },
  ];
  marta.pets = ['cat'];
  const wat = st.tenants[tenantAt(st, 'Mudlark Hovel')]!;
  wat.memory = [{ day: 21, text: 'You pretended not to see Gerald the griffin.', valence: 2 }, { day: 30, text: 'You nailed a Notice to Quit to their door.', valence: -2 }];
  wat.lateStage = 'noticed'; wat.courtDay = st.day + 31; wat.arrears = 16; wat.daysLate = 14; wat.revealed = ['forgetful'];
  // a job in hand on the leak, so "in progress" shows somewhere
  const hob = Object.values(st.staff).find(m => m.role === 'mason');
  const cottage = Object.values(st.buildings).find(b => b.state === 'building');
  if (hob?.actorId && cottage) {
    st.jobs.j1 = { id: 'j1', kind: 'build', role: 'mason', state: 'working', assignee: hob.actorId, buildingId: cottage.id, unit: null, tenantId: null, applicantId: null, incidentId: null, outcomeId: null, x: 0, y: 0, workDays: 7, progress: 0.45, cost: 0, priority: 1, createdDay: 30, byRuler: true };
    st.actors[hob.actorId]!.jobId = 'j1';
  }
}

const scenes: Record<string, () => Promise<void>> = {
  async 'frame-idle'() { frame('baron'); await frames(3); },
  async 'frame-book'() {
    const f = frame('baron');
    f.build.openBook('housing');
    await frames(2);
    (f.build.el.querySelector('[data-plan="cottage"]') as HTMLElement).click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    (f.build.el.querySelector('[data-plan="townhouse"]') as HTMLElement).dispatchEvent(new PointerEvent('pointerenter'));
    await sayIn(f.wordbar.el, 'Hob, mend the roof at the Leaning Hovel.');
    await sayIn(f.wordbar.el, 'Agnes, never evict a widow in winter.');
  },
  async 'frame-inspect'() {
    const f = frame('baron');
    enrich(f.rig.sim.state);
    f.rig.select({ buildingId: byName(f.rig.sim.state, 'The Leaning Hovel') });
    await sayIn(f.wordbar.el, 'Hob, mend the roof at the Leaning Hovel.');
  },
  async 'frame-tenant'() {
    const f = frame('baron');
    enrich(f.rig.sim.state);
    f.rig.select({ tenantId: tenantAt(f.rig.sim.state, 'The Leaning Hovel') });
    (f.insp.el.querySelector('.ll-in-foot .ll-btn-primary') as HTMLElement | null)?.click();
    await sayIn(f.wordbar.el, 'Your roof will be mended before the frost. mumble');
  },
  async 'frame-book-open'() {
    const f = frame('baron');
    f.build.openBook('housing');
    await frames(2);
    (f.build.el.querySelector('[data-plan="burrow"]') as HTMLElement).dispatchEvent(new PointerEvent('pointerenter'));
    await frames(3);
  },
  async 'phone-inspect'() {
    const f = frame('baron');
    enrich(f.rig.sim.state);
    f.rig.select({ buildingId: byName(f.rig.sim.state, 'The Leaning Hovel') });
    await frames(3);
  },
  async 'phone-tenant'() {
    const f = frame('baron');
    enrich(f.rig.sim.state);
    f.rig.select({ tenantId: tenantAt(f.rig.sim.state, 'The Leaning Hovel') });
    (f.insp.el.querySelector('.ll-in-foot .ll-btn-primary') as HTMLElement | null)?.click();
    await frames(3);
  },
  // four phones side by side, each a real 400 x 800 viewport (an iframe of this same page)
  async phones() { await phones(['frame-book-open', 'frame-book', 'phone-inspect', 'phone-tenant']); },
  async 'phones-b'() { await phones(['frame-land', 'frame-road', 'frame-inspect', 'frame-tenant']); },
  // two laptops side by side (shoot at --w 2584 --h 816)
  async desks() { await phones(['frame-book', 'frame-tenant'], 1280, 800); },
  async 'frame-land'() {
    const f = frame('knight');
    f.build.openBook('land');
    await frames(3);
  },
  async 'frame-key'() {
    devCourtKey = '';
    const f = frame('baron', { online: false, wantsKey: true });
    await frames(4);
    void f;
  },
  async 'frame-road'() {
    const f = frame('knight', { online: false, mic: false });
    (f.build.el.querySelector('[data-tool="road"]') as HTMLElement).click();
    f.wordbar.el.querySelector<HTMLInputElement>('.ll-wb-input')!.focus();
    await frames(3);
  },

  async 'inspectors-a'() { await inspectors(0); },
  async 'inspectors-b'() { await inspectors(1); },

  async books() {
    reset('dev-gallery');
    const cell = (cap: string, rank: 'reeve' | 'knight' | 'baron', pose: (b: BuildMenuPart, rig: Rig) => void): void => {
      const box = h('div', { class: 'dev-cell' }, h('div', { class: 'dev-cap' }, cap));
      const rig = makeRig(box, rank);
      const b = mountBuild(rig.ctx);
      rig.parts.push(b); rigs.push(rig);
      box.appendChild(b.el); ui.appendChild(box);
      pose(b, rig);
    };
    cell('homes, reeve (locked ones greyed)', 'reeve', b => { b.openBook('housing'); (b.el.querySelector('[data-plan="hovel"]') as HTMLElement).dispatchEvent(new PointerEvent('pointerenter')); });
    cell('trades, knight, bakery in hand', 'knight', b => { b.openBook('commercial'); (b.el.querySelector('[data-plan="bakery"]') as HTMLElement).click(); });
    cell('amenities, baron', 'baron', b => { b.openBook('amenity'); (b.el.querySelector('[data-plan="statue"]') as HTMLElement).dispatchEvent(new PointerEvent('pointerenter')); });
    cell('household, knight', 'knight', b => { b.openBook('staff'); (b.el.querySelector('[data-plan="counting_house"]') as HTMLElement).click(); });
    cell('land, knight', 'knight', b => b.openBook('land'));
    cell('road in hand', 'knight', b => (b.el.querySelector('[data-tool="road"]') as HTMLElement).click());
    cell('razing', 'knight', b => (b.el.querySelector('[data-tool="demolish"]') as HTMLElement).click());
    await frames(4);
  },

  async words() {
    reset('dev-gallery');
    const cell = async (cap: string, opts: Parameters<typeof fakeWord>[1], pose: (w: WordBarPart, rig: Rig) => Promise<void> | void): Promise<void> => {
      const box = h('div', { class: 'dev-cell dev-wordcell' }, h('div', { class: 'dev-cap' }, cap));
      const rig = makeRig(box, 'baron', opts);
      const w = mountWord(rig.ctx);
      rig.parts.push(w); rigs.push(rig);
      box.appendChild(w.el); ui.appendChild(box);
      await pose(w, rig);
    };
    await cell('a saying sent from the help screen (ll:speak)', {}, async w => { window.dispatchEvent(new CustomEvent('ll:speak', { detail: { text: 'Raise the rent at the Leaning Hovel by two crowns.' } })); await frames(2); w.el.querySelector<HTMLInputElement>('.ll-wb-input')!.blur(); });
    await cell('idle, a household selected', {}, (w, rig) => { rig.select({ tenantId: tenantAt(rig.sim.state, 'The Leaning Hovel') }); });
    await cell('offline: dim candle, its note, no mic', { online: false, mic: false }, async w => { await frames(3); (w.el.querySelector('.ll-wb-candle') as HTMLElement).click(); });
    await cell('listening (hold to talk)', {}, async w => { (w.el.querySelector('.ll-wb-mic') as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await wait(900); });
    await cell('waiting on the reply', { canned: 'never' }, async (w, rig) => { w.speakTo({ to: 'mason' }); await sayIn(w.el, 'Hob, mend the roof at the Leaning Hovel.', false); void rig; });
    await cell('done', { canned: 'done' }, async w => { w.speakTo({ to: 'mason' }); await sayIn(w.el, 'Hob, mend the roof at the Leaning Hovel.'); });
    await cell('needs your aye', { canned: 'needs_confirm' }, async w => { w.speakTo({ to: 'bailiff' }); await sayIn(w.el, 'Agnes, never evict a widow in winter.'); });
    await cell('after the aye, with an oath entered', { canned: 'rich' }, async w => { await sayIn(w.el, 'Tell Wat his roof will be mended before the first frost.'); });
    await cell('refused', { canned: 'refused' }, async w => { await sayIn(w.el, 'Hold a feast for the whole town.'); });
    await cell('unclear', { canned: 'unclear' }, async w => { await sayIn(w.el, 'Do the thing with the whatsit, mumble'); });
    await cell('the court wants its key', { online: false, wantsKey: true }, async w => { await frames(3); void w; });
    await cell('the log', { canned: 'cycle' }, async w => {
      await sayIn(w.el, 'Hob, mend the roof at the Leaning Hovel.');
      await sayIn(w.el, 'Agnes, never evict a widow in winter.');
      await sayIn(w.el, 'Hold a feast for the whole town.');
      (w.el.querySelector('.ll-wb-x') as HTMLElement | null)?.click();
      (w.el.querySelector('.ll-wb-logbtn') as HTMLElement).click();
    });
    await frames(6);
  },

  async pics() {
    reset('dev-gallery');
    const sheet = h('div', { class: 'll-parch dev-pics' });
    const add = (label: string, svg: string): void => { sheet.appendChild(h('div', { class: 'dev-pic' }, h('div', { class: 'big', html: svg }), h('div', { class: 'small', html: svg }), label)); };
    for (const bt of BUILDING_TYPES) if (bt !== 'seat') add(BUILDINGS[bt].name, pictogram(bt));
    for (let l = 1; l <= 3; l++) add(BUILDINGS.seat.levelNames![l - 1]!, pictogram('seat', l));
    ui.appendChild(sheet);
    await frames(2);
  },
};

async function phones(names: string[], w = 400, hh = 800): Promise<void> {
  reset('dev-gallery');
  ui.style.gap = '8px'; ui.style.padding = '8px';
  let left = names.length;
  await new Promise<void>(res => {
    const onMsg = (e: MessageEvent): void => {
      if ((e.data as { llDev?: string } | null)?.llDev !== 'done' || --left > 0) return;
      window.removeEventListener('message', onMsg); res();
    };
    window.addEventListener('message', onMsg);
    for (const n of names) ui.appendChild(h('iframe', { src: location.href.split('#')[0] + '#' + n, title: n, style: `width:${w}px;height:${hh}px;border:0;flex:none;background:#0e0a08` }));
    window.setTimeout(res, 25000);
  });
  await wait(400);
}

async function inspectors(page: number): Promise<void> {
  reset('dev-gallery');
  const cell = (cap: string, pick: (st: GameState) => Sel, after?: (el: HTMLElement) => void): void => {
    const box = h('div', { class: 'dev-cell dev-inspcell' }, h('div', { class: 'dev-cap' }, cap));
    const rig = makeRig(box, 'baron');
    enrich(rig.sim.state);
    const p = mountInspector(rig.ctx);
    rig.parts.push(p); rigs.push(rig);
    box.appendChild(p.el); ui.appendChild(box);
    rig.select(pick(rig.sim.state));
    after?.(p.el);
  };
  if (page === 0) {
    cell('a hovel with a leak (pin incident)', st => ({ buildingId: byName(st, 'The Leaning Hovel') }));
    cell('a hovel with a griffin (audience), notice served', st => ({ buildingId: byName(st, 'Mudlark Hovel') }));
    cell('a household', st => ({ tenantId: tenantAt(st, 'The Leaning Hovel') }));
    cell('a household in trouble, gift open', st => ({ tenantId: tenantAt(st, 'Mudlark Hovel') }), el => {
      (Array.from(el.querySelectorAll('.ll-in-act')).find(b => b.textContent?.includes('Gift')) as HTMLElement | undefined)?.click();
      const body = el.querySelector('.ll-in-body') as HTMLElement; body.scrollTop = body.scrollHeight;
    });
    cell('three households, one sheet', st => ({ buildingId: byName(st, 'Three-Stack') }));
    cell('squatters in a vacancy', st => ({ buildingId: byName(st, 'Damp End') }));
    cell('a delegate', st => ({ staffId: Object.values(st.staff).find(m => m.role === 'mason')!.id }));
    cell('an applicant, not yet shown round', () => ({ applicantId: 'p1' }));
  } else {
    cell('a vacancy with two applicants', st => ({ buildingId: byName(st, 'The Long Row') }));
    cell('an applicant who has seen it', () => ({ applicantId: 'p2' }));
    cell('under construction', st => ({ buildingId: byName(st, 'New Cottage') }));
    cell('a ruin', st => ({ buildingId: byName(st, 'The Ruin') }));
    cell('an amenity', st => ({ buildingId: Object.values(st.buildings).find(b => b.type === 'well')!.id }));
    cell('a staff building', st => ({ buildingId: Object.values(st.buildings).find(b => b.type === 'masons_yard')!.id }));
    cell('the seat', st => ({ buildingId: Object.values(st.buildings).find(b => b.type === 'seat')!.id }));
    cell('a tavern (trade)', st => ({ buildingId: byName(st, 'The Late Payment') }));
  }
  await frames(8);
}

/**
 * Drive the three parts the way a player would and report what happened. Returns one line per check,
 * "ok ..." or "FAIL ...". Run with: --eval "__dev.selftest()".
 */
async function selftest(): Promise<string[]> {
  const out: string[] = [];
  const check = (name: string, ok: unknown, detail = ''): void => { out.push((ok ? 'ok   ' : 'FAIL ') + name + (ok || !detail ? '' : ' :: ' + detail)); };
  const f = frame('baron', { canned: 'cycle' });
  const { rig, build, insp, wordbar } = f;
  const st = rig.sim.state;
  enrich(st);
  const q = <T extends HTMLElement = HTMLElement>(root: HTMLElement, sel: string): T | null => root.querySelector<T>(sel);
  const btn = (root: HTMLElement, text: string): HTMLElement | undefined => Array.from(root.querySelectorAll<HTMLElement>('button')).find(b => (b.textContent ?? '').trim().startsWith(text));
  const last = (prefix: string): string => [...rig.all].reverse().find(l => l.startsWith(prefix)) ?? '';
  const acted = (type: Action['type']): Action | undefined => [...rig.sim.log].reverse().find(a => a.type === type);
  const key = (k: string, code = '', target: EventTarget = window, type = 'keydown'): void => { target.dispatchEvent(new KeyboardEvent(type, { key: k, code, bubbles: true, cancelable: true })); };
  await frames(2);

  // ── the build book
  q(build.el, '[data-tool="build"]')!.click();
  check('Build opens the pattern book', !q(build.el, '.ll-bm-book')!.hidden);
  check('four chapters of plans', build.el.querySelectorAll('.ll-bm-tab').length === 4);
  q(build.el, '[data-plan="hovel"]')!.click();
  check('choosing a plan arms the place tool', last('tool:').includes('"kind":"place","btype":"hovel","rot":0'), last('tool:'));
  check('the hint strip shows', !q(build.el, '.ll-bm-strip')!.hidden && /R to turn/.test(q(build.el, '.ll-bm-shint')!.textContent ?? ''), q(build.el, '.ll-bm-shint')?.textContent ?? '');
  key('r');
  check('R turns it', last('tool:').includes('"rot":1'), last('tool:'));
  key('r'); key('r'); key('r');
  check('four turns come back round', last('tool:').includes('"rot":0'), last('tool:'));
  rig.renderer.fire('place', 'hovel', 10, 10, 0);
  check('it stays in hand after placing', q(build.el, '[data-plan="hovel"]')!.classList.contains('is-armed') && !q(build.el, '.ll-bm-strip')!.hidden);
  rig.renderer.fire('cancel');
  check('right-click (cancel) puts it down', last('tool:').includes('"kind":"select"') && q(build.el, '.ll-bm-strip')!.hidden, last('tool:'));
  build.closeBook();
  const reeve = makeRig(h('div'), 'reeve');
  const rb = mountBuild(reeve.ctx); document.body.appendChild(rb.el);
  rb.openBook('housing');
  const lockedCard = q(rb.el, '[data-plan="longhouse"]')!;
  lockedCard.click();
  check('a locked plan is greyed, says when, and does not arm', lockedCard.classList.contains('is-locked') && /At Knight/.test(lockedCard.textContent ?? '') && !reeve.all.some(l => l.includes('longhouse')), lockedCard.textContent ?? '');
  check('a plan the coffers cannot reach shows its cost in red', !!q(rb.el, '[data-plan="cottage"] .ll-bm-cost.is-short'));
  rb.dispose(); rb.el.remove();
  q(build.el, '[data-tool="road"]')!.click();
  check('Road arms the road tool and shuts the book', last('tool:').includes('"kind":"road"') && q(build.el, '.ll-bm-book')!.hidden, last('tool:'));
  q(build.el, '[data-tool="road"]')!.click();
  check('Road again puts it down', last('tool:').includes('"kind":"select"'));
  q(build.el, '[data-tool="demolish"]')!.click();
  check('Demolish arms the demolish tool', last('tool:').includes('"kind":"demolish"'));
  rig.renderer.fire('cancel');
  q(build.el, '[data-tool="ledger"]')!.click();
  check('Ledger seal opens the ledger', last('open:') === 'open: ledger', last('open:'));
  q(build.el, '[data-tool="help"]')!.click();
  check('Help seal opens help', last('open:') === 'open: help', last('open:'));
  const kn = makeRig(h('div'), 'knight');
  const kb = mountBuild(kn.ctx); document.body.appendChild(kb.el);
  kb.openBook();
  q(kb.el, '.ll-bm-landbtn')!.click();
  check('Buy land lights the parcels for sale', /highlight: \d+ tiles/.test([...kn.all].reverse().find(l => l.startsWith('highlight:')) ?? ''), kn.all.join(' | '));
  const parcels = kb.el.querySelectorAll('.ll-bm-parcel');
  check('parcels listed with names and prices', parcels.length >= 3 && /Crow Acre/.test(parcels[0]?.textContent ?? '') && /60/.test(parcels[0]?.textContent ?? ''), parcels[0]?.textContent ?? '');
  q(kb.el, '.ll-bm-buy')!.click();
  check('Buy dispatches buy_parcel', (kn.sim.log.find(a => a.type === 'buy_parcel') as { parcelId?: number } | undefined)?.parcelId === 0);
  kb.closeBook();
  check('closing the book clears the highlight', ([...kn.all].reverse().find(l => l.startsWith('highlight:')) ?? '') === 'highlight: none');
  kb.dispose(); kb.el.remove();
  // with no pointer to hover (a phone), the first tap reads a plan out and the second takes it up
  const realMM = window.matchMedia.bind(window);
  window.matchMedia = ((query: string) => (query.includes('pointer: coarse') ? ({ matches: true, media: query } as MediaQueryList) : realMM(query))) as typeof window.matchMedia;
  build.openBook('housing');
  const toolsBefore = rig.all.filter(l => l.startsWith('tool:')).length;
  q(build.el, '[data-plan="cottage"]')!.click();
  check('touch: the first tap only reads the plan out', rig.all.filter(l => l.startsWith('tool:')).length === toolsBefore && !!btn(build.el, 'Take it in hand') && q(build.el, '[data-plan="cottage"]')!.classList.contains('is-looked') && /Cottage/.test(q(build.el, '.ll-bm-foot')!.textContent ?? ''));
  q(build.el, '[data-plan="cottage"]')!.click();
  check('touch: the second tap takes it in hand, and the hint does not mention a right-click', last('tool:').includes('"btype":"cottage"') && /Tap your land/.test(q(build.el, '.ll-bm-shint')!.textContent ?? ''), q(build.el, '.ll-bm-shint')?.textContent ?? '');
  window.matchMedia = realMM as typeof window.matchMedia;
  build.disarm(); build.closeBook();
  const ev = new CustomEvent('ll:summon', { detail: 'build', cancelable: true });
  ui.dispatchEvent(ev);
  check('the frame\'s B summons the book', ev.defaultPrevented && !q(build.el, '.ll-bm-book')!.hidden);

  // ── the inspector
  const hovel = byName(st, 'The Leaning Hovel');
  rig.select({ buildingId: hovel });
  await frames(2);
  check('selecting a building opens its sheet and shuts the book', !insp.el.hidden && q(build.el, '.ll-bm-book')!.hidden && /Leaning Hovel/.test(q(insp.el, '.ll-in-name')!.textContent ?? ''));
  check('condition has a word', /Sagging|Shabby|Weathered|Sound|Handsome|Held up by habit/.test(q(insp.el, '.ll-in-word')!.textContent ?? ''), q(insp.el, '.ll-in-word')?.textContent ?? '');
  q(insp.el, '.ll-in-name')!.click();
  const nameBox = q<HTMLInputElement>(insp.el, '.ll-in-rename');
  check('clicking the name offers a box', !!nameBox);
  if (nameBox) { nameBox.value = 'The Upright Hovel'; key('Enter', 'Enter', nameBox); }
  await frames(2);
  check('Enter renames it', (acted('rename_building') as { name?: string } | undefined)?.name === 'The Upright Hovel' && /Upright/.test(q(insp.el, '.ll-in-name')!.textContent ?? ''));
  const range = q<HTMLInputElement>(insp.el, '.ll-in-range')!;
  range.value = String(Number(range.max)); range.dispatchEvent(new Event('input', { bubbles: true }));
  const readHigh = q(insp.el, '.ll-in-read')!.textContent ?? '';
  range.value = String(Number(range.min)); range.dispatchEvent(new Event('input', { bubbles: true }));
  const readLow = q(insp.el, '.ll-in-read')!.textContent ?? '';
  range.dispatchEvent(new Event('change', { bubbles: true }));
  check('the rent slider reads in plain words', /bargain/i.test(readLow) && /Steep|Fanciful|Dear/.test(readHigh), readLow + ' / ' + readHigh);
  check('letting go of the slider sets the rent', (acted('set_rent') as { rent?: number } | undefined)?.rent === Number(range.min));
  check('the market tick is there', /market \d+/.test(q(insp.el, '.ll-in-tick')!.textContent ?? ''));
  const mend = btn(insp.el, 'Mend it properly');
  mend?.click();
  check('an incident outcome resolves it', (acted('resolve_incident') as { outcomeId?: string } | undefined)?.outcomeId !== undefined, String(!!mend));
  btn(q(insp.el, '.ll-in-foot')!, 'Repair')?.click();
  check('Repair orders a repair, priced', (acted('order_job') as { kind?: string } | undefined)?.kind === 'repair' && /Repair \(\d+\)/.test(btn(q(insp.el, '.ll-in-foot')!, 'Repair')?.textContent ?? ''), btn(q(insp.el, '.ll-in-foot')!, 'Repair')?.textContent ?? '');
  const dem = btn(q(insp.el, '.ll-in-foot')!, 'Demolish') as HTMLButtonElement | undefined;
  check('Demolish is barred while someone lives there', !!dem?.disabled);
  q(insp.el, '.ll-in-purse')?.click();
  check('the purse chip sends for the purse', acted('collect_purse') !== undefined);
  q(insp.el, '.ll-in-row.is-link')!.click();
  await frames(2);
  const marta = tenantAt(st, 'The Upright Hovel');
  check('a tenant row opens the household', /Marta/.test(q(insp.el, '.ll-in-name')!.textContent ?? '') && last('focus:') !== undefined);
  check('hidden ways are seals, known ones are named', insp.el.querySelectorAll('.ll-in-qseal').length === 2 && /Punctual/.test(q(insp.el, '.ll-in-trait')!.textContent ?? ''));
  const mems = Array.from(insp.el.querySelectorAll('.ll-in-mem')).map(m => m.textContent ?? '');
  check('memories newest first, with hearts and thorns', /forgave/.test(mems[0] ?? '') && insp.el.querySelectorAll('.ll-in-mem .is-heart').length === 3 && insp.el.querySelectorAll('.ll-in-mem .is-thorn').length === 2, mems.join(' | '));
  btn(insp.el, 'Gift')?.click();
  await frames(1);
  const purse = q(insp.el, '.ll-in-gift .ll-in-act');
  purse?.click();
  check('a gift is given', (acted('gift') as { tenantId?: Id; amount?: number } | undefined)?.tenantId === marta && ((acted('gift') as { amount?: number }).amount ?? 0) > 0);
  const notice = btn(insp.el, 'Serve notice') as HTMLButtonElement | undefined;
  check('no notice for a household that owes nothing', !!notice?.disabled);
  btn(insp.el, 'Speak to them')?.click();
  const box = q<HTMLInputElement>(wordbar.el, '.ll-wb-input')!;
  check('Speak to them addresses and focuses the Word bar', document.activeElement === box && /Marta/.test(box.placeholder) && /Marta/.test(q(wordbar.el, '.ll-wb-chip.is-on')!.textContent ?? ''), box.placeholder);
  box.blur();
  const wat = tenantAt(st, 'Mudlark Hovel');
  rig.select({ tenantId: wat });
  await frames(2);
  check('late stage in plain words', /Notice to Quit is on the door/.test(insp.el.textContent ?? '') && /Reeve's Court sits in/.test(insp.el.textContent ?? ''));
  check('oaths sworn to them are listed', /Your rent will not move this year/.test(insp.el.textContent ?? ''));
  const hob = Object.values(st.staff).find(m => m.role === 'mason')!;
  rig.select({ staffId: hob.id });
  await frames(2);
  check('a delegate sheet: role, pips, orders', /Your Mason/.test(insp.el.textContent ?? '') && insp.el.querySelectorAll('.ll-in-pips i.is-on').length === hob.skill && /no patch jobs/.test(insp.el.textContent ?? ''));
  const wage0 = hob.wage;
  q(insp.el, '.ll-in-step[aria-label="Raise the wage"]')!.click();
  check('the wage can be raised', (acted('set_wage') as { wage?: number } | undefined)?.wage === wage0 + 1);
  const dismiss = btn(insp.el, 'Dismiss')!;
  dismiss.click();
  check('Dismiss asks first', acted('dismiss_staff') === undefined && /Truly dismiss Hob/.test(dismiss.textContent ?? ''), dismiss.textContent ?? '');
  dismiss.click();
  check('and then does it', acted('dismiss_staff') !== undefined);
  rig.select({ applicantId: 'p1' });
  await frames(2);
  btn(insp.el, 'Show the place')?.click();
  check('an applicant can be shown the place', (acted('order_job') as { kind?: string; applicantId?: Id } | undefined)?.kind === 'show');
  rig.select({ applicantId: 'p2' });
  await frames(2);
  btn(insp.el, 'Hear them')?.click();
  check('an applicant who has seen it can be heard', last('open:') === 'open: audience ia1', last('open:'));
  rig.select(null);
  await frames(1);
  check('nothing selected, no sheet', insp.el.hidden);

  // ── the Word bar
  const crawlsBefore = rig.all.filter(l => l.startsWith('crawl:')).length;
  box.focus();
  box.value = 'Hob, mend the roof.'; box.dispatchEvent(new Event('input', { bubbles: true }));
  await frames(2);
  check('typing holds the crawl', last('crawl:') === 'crawl: 1' && rig.all.filter(l => l.startsWith('crawl:')).length > crawlsBefore, last('crawl:'));
  key('Enter', 'Enter', box);
  check('Enter shows who is thinking', q(wordbar.el, '.ll-wb-ex')!.dataset.status === 'waiting' && !q(wordbar.el, '.ll-wb-ex')!.hidden && box.value === '', q(wordbar.el, '.ll-wb-ex')?.dataset.status ?? '');
  await wait(420);
  check('the read-back types out', (q(wordbar.el, '.ll-wb-text')?.textContent ?? '').length > 0 && q(wordbar.el, '.ll-wb-ex')!.dataset.status === 'done', q(wordbar.el, '.ll-wb-ex')?.dataset.status ?? '');
  q(wordbar.el, '.ll-wb-text')!.click(); await frames(3);
  check('done says so', /So ordered/.test(q(wordbar.el, '.ll-wb-acts')!.textContent ?? ''), q(wordbar.el, '.ll-wb-acts')?.textContent ?? '');
  box.blur(); await frames(2);
  check('the crawl is let go', last('crawl:') === 'crawl: 0', last('crawl:'));
  box.focus(); box.value = 'Agnes, never evict a widow in winter.'; key('Enter', 'Enter', box);
  await wait(420); q(wordbar.el, '.ll-wb-text')!.click(); await frames(3);
  check('a weighty word waits: Aye and Nay', !!btn(wordbar.el, 'Aye') && !!btn(wordbar.el, 'Nay, I meant'));
  btn(wordbar.el, 'Nay, I meant')!.click();
  check('Nay restores the words and the focus', box.value === 'Agnes, never evict a widow in winter.' && document.activeElement === box && q(wordbar.el, '.ll-wb-ex')!.hidden, box.value);
  box.value = ''; box.value = 'Hold a feast for the whole town.'; key('Enter', 'Enter', box);
  await wait(420); q(wordbar.el, '.ll-wb-text')!.click(); await frames(3);
  check('a refusal is in the speaker\'s voice', q(wordbar.el, '.ll-wb-ex')!.dataset.status === 'refused' && /counted the coffers/.test(q(wordbar.el, '.ll-wb-text')!.textContent ?? ''));
  box.value = 'mumble mumble'; key('Enter', 'Enter', box);
  await wait(420); q(wordbar.el, '.ll-wb-text')!.click(); await frames(3);
  check('unclear invites a rephrase and gives the words back', /Not understood/.test(q(wordbar.el, '.ll-wb-acts')!.textContent ?? '') && box.value === 'mumble mumble', box.value);
  box.value = '';
  key('ArrowUp', 'ArrowUp', box);
  const up1 = box.value;
  key('ArrowUp', 'ArrowUp', box);
  check('Up-arrow recalls earlier sayings', up1 === 'mumble mumble' && box.value === 'Hold a feast for the whole town.', up1 + ' / ' + box.value);
  key('ArrowDown', 'ArrowDown', box); key('ArrowDown', 'ArrowDown', box);
  check('Down-arrow returns to the draft', box.value === '');
  q(wordbar.el, '.ll-wb-logbtn')!.click();
  check('the scroll opens the log', !q(wordbar.el, '.ll-wb-log')!.hidden && wordbar.el.querySelectorAll('.ll-wb-logrow').length === 4, String(wordbar.el.querySelectorAll('.ll-wb-logrow').length));
  check('Esc puts the log away', wordbar.escape() && q(wordbar.el, '.ll-wb-log')!.hidden);
  q(wordbar.el, '.ll-wb-chip:nth-child(2)')!.click();
  check('a delegate chip addresses them', /Speak to Hob/.test(box.placeholder), box.placeholder);
  box.value = 'Mend the well.'; key('Enter', 'Enter', box);
  await wait(420);
  check('speak() gets the addressee', JSON.stringify(rig.word.log().slice(-1)[0]?.target) === '{"to":"mason"}', JSON.stringify(rig.word.log().slice(-1)[0]?.target));
  check('a lit candle while a court can hear', q(wordbar.el, '.ll-wb-candle')!.classList.contains('is-lit'));
  // hold-to-talk on the backquote key, with nothing focused
  box.blur(); wordbar.escape(); await wait(450); q(wordbar.el, '.ll-wb-text')?.click(); await frames(3); wordbar.escape();
  key('`', 'Backquote');
  await wait(700);
  const partial = box.value;
  check('holding ` listens, and partial words appear in the box', q(wordbar.el, '.ll-wb-bar')!.classList.contains('is-listening') && /^Hob, mend/.test(partial), partial);
  key('`', 'Backquote', window, 'keyup');
  await wait(300);
  check('letting go settles the words', /before the rains\.$/.test(box.value), box.value);
  const sentBefore = rig.word.log().length;
  await wait(1800);
  check('and they are sent after a beat', rig.word.log().length === sentBefore + 1 && box.value === '', String(rig.word.log().length - sentBefore));
  // Space, held, with nothing focused and the box empty, is the talk key too
  await wait(500); q(wordbar.el, '.ll-wb-text')?.click(); await frames(3); wordbar.escape(); await frames(2);
  (document.activeElement as HTMLElement | null)?.blur();
  key(' ', 'Space');
  const early = q(wordbar.el, '.ll-wb-bar')!.classList.contains('is-listening');
  await wait(650);
  check('holding Space listens (a tap does not)', !early && q(wordbar.el, '.ll-wb-bar')!.classList.contains('is-listening') && /^Hob/.test(box.value), box.value);
  key(' ', 'Space', window, 'keyup');
  await wait(300);
  check('letting Space go settles the words', !q(wordbar.el, '.ll-wb-bar')!.classList.contains('is-listening') && /rains\.$/.test(box.value), box.value);
  box.dispatchEvent(new Event('pointerdown')); box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true }));
  // offline, no microphone
  const off = makeRig(h('div'), 'knight', { online: false, mic: false });
  const ow = mountWord(off.ctx); document.body.appendChild(ow.el); off.parts.push(ow); rigs.push(off);
  await wait(700);
  const oc = q(ow.el, '.ll-wb-candle')!;
  check('offline: a dim candle with the tip', !oc.classList.contains('is-lit') && /No one at court can hear free speech\. Plain commands and whispers still work\./.test(oc.getAttribute('data-tip') ?? ''), oc.getAttribute('data-tip') ?? '');
  check('no microphone: the seal is hidden', q(ow.el, '.ll-wb-mic')!.hidden);
  q<HTMLInputElement>(ow.el, '.ll-wb-input')!.focus();
  check('and the dictation key is mentioned, once', /dictation key/.test(q(ow.el, '.ll-wb-note')!.textContent ?? '') && !q(ow.el, '.ll-wb-note')!.hidden, q(ow.el, '.ll-wb-note')?.textContent ?? '');
  q<HTMLInputElement>(ow.el, '.ll-wb-input')!.blur();
  rigs = rigs.filter(r => r !== off); ow.dispose(); ow.el.remove();
  // the help screen's saying, sent over the window bus
  window.dispatchEvent(new CustomEvent('ll:speak', { detail: { text: 'Collect the rents.' } }));
  check('ll:speak puts a saying in the box', box.value === 'Collect the rents.' && document.activeElement === box, box.value);
  box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true })); box.blur();
  check('no key prompt while the court asks for none', q(wordbar.el, '.ll-wb-key')!.hidden);
  // a court that wants its key
  devCourtKey = '';
  const kr = makeRig(h('div'), 'knight', { online: false, wantsKey: true });
  const kw = mountWord(kr.ctx); document.body.appendChild(kw.el); kr.parts.push(kw); rigs.push(kr);
  await wait(700);
  const kEl = q(kw.el, '.ll-wb-key')!, kIn = q<HTMLInputElement>(kw.el, '.ll-wb-keyinput')!;
  check('the court key prompt shows when a key is wanted', !kEl.hidden && /wants the key/.test(kEl.textContent ?? ''), kEl.textContent ?? '');
  btn(kEl, 'Later')!.click();
  check('Later puts the prompt away', kEl.hidden);
  q(kw.el, '.ll-wb-candle')!.click();
  check('the candle brings it back', !kEl.hidden && document.activeElement === kIn);
  kIn.value = 'wrong';
  btn(kEl, 'Offer it')!.click();
  check('an offered key is tried', devCourtKey === 'wrong' && /Trying it/.test(kEl.textContent ?? ''), kEl.textContent ?? '');
  await wait(3400);
  check('a key the court refuses is said to be wrong', !kEl.hidden && kEl.classList.contains('is-bad') && /does not turn/.test(kEl.textContent ?? ''), kEl.textContent ?? '');
  kIn.value = 'open-sesame';
  btn(kEl, 'Offer it')!.click();
  await wait(700);
  check('offering a good key saves it and the prompt goes', devCourtKey === 'open-sesame' && kEl.hidden && /has your key/.test(q(kw.el, '.ll-wb-note')!.textContent ?? ''), devCourtKey + ' / ' + (q(kw.el, '.ll-wb-note')?.textContent ?? ''));
  rigs = rigs.filter(r => r !== kr); kw.dispose(); kw.el.remove(); devCourtKey = '';
  const fails = out.filter(l => l.startsWith('FAIL')).length;
  out.push(`${out.length - fails} passed, ${fails} failed`);
  return out;
}

const dev = {
  selftest,
  /** any scenes side by side, each in its own viewport: __dev.grid(['frame-land', 'frame-road'], 400, 800) */
  async grid(names: string[], w = 400, hh = 800): Promise<string> { await document.fonts?.ready; await phones(names, w, hh); return 'ok grid'; },
  rigs: () => rigs,
  scenes: Object.keys(scenes),
  async scene(name: string): Promise<string> {
    const fn = scenes[name];
    if (!fn) return 'no such scene: ' + name;
    await document.fonts?.ready;
    await fn();
    await document.fonts?.ready;
    await frames(3);
    return 'ok ' + name;
  },
};
(window as unknown as { __dev: typeof dev }).__dev = dev;
// a scene named in the hash is posed at once (the phones scene loads this page into iframes that way)
const boot = decodeURIComponent(location.hash.slice(1));
void dev.scene(scenes[boot] ? boot : 'frame-idle').then(() => {
  if (window.parent !== window) window.parent.postMessage({ llDev: 'done', name: boot }, '*');
});
