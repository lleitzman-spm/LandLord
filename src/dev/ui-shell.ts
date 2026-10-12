/**
 * Dev page for the frame of the interface (ui-shell). Not shipped.
 *
 *   node tools/shot.mjs src/dev/ui-shell.ts .tmp/ui-shell-desk.png --w 1280 --h 800 --wait 2600
 *   node tools/shot.mjs src/dev/ui-shell.ts .tmp/ui-shell-phone.png --w 400 --h 800 --wait 2600
 *   ... --eval "(async()=>{__dev.scene('matter');await __dev.settle()})()"
 *       scenes: matter | roll | crown | night | fold | ledger | pick | toast
 *   ... --eval "__dev.selftest()"          presses the keys, picks, pins and strips and reports what failed
 *
 * The real createUI over a flat stand-in table: a fake Renderer whose anchors
 * come from a simple oblique projection of the fixture's tiles, a fake sim, a
 * word layer that hears nothing and the placeholder audio.
 */
import { SECONDS_PER_DAY, type GameState, type SimEvent, type Herald, type HeraldKind, type Id, type Building } from '../sim/types';
import type { Renderer, RendererEvents, AnchorRef, Anchor, Tool } from '../render/api';
import type { WordAPI } from '../word/api';
import type { AppAPI, Settings } from '../ui/api';
import { createUI } from '../ui';
import { createAudio } from '../audio';
import { makeFixtureState, fakeSim } from './fixture';

const app = document.getElementById('app') as HTMLElement;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const state: GameState = makeFixtureState('knight');
const sim = fakeSim(state);
console.log = () => { /* the fake sim narrates every action; not here */ };

// ───────── make the fixture a little busier where the shell needs it ─────────
const byName = (name: string): Building => Object.values(state.buildings).find(b => b.name === name)!;
const longRow = byName('The Long Row');
{ // a vacancy with someone waiting to be shown it
  const gone = longRow.units[1]!;
  if (gone.tenantId) delete state.tenants[gone.tenantId];
  gone.tenantId = null; gone.vacantSince = state.day - 6; gone.listed = true; gone.purse = 0;
  state.actors.apx = { id: 'apx', kind: 'applicant', refId: 'px', x: longRow.x + longRow.w + 0.6, y: longRow.y + 1.2, path: [], speed: 5, state: 'waiting', jobId: null, homeX: 0, homeY: 0, facing: 0 };
  state.applicants.px = {
    id: 'px', buildingId: longRow.id, unit: 1, arrivedDay: state.day - 2, leavesDay: state.day + 6, maxRent: 16, shown: false, screened: false, actorId: 'apx',
    household: { id: 'tx', name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 4242, household: 3, traits: ['handy'], revealed: [], tags: ['newlyweds'], pets: [], income: 44, reliability: 0.8 },
  };
  // a mason at work on the mill
  const mill = byName('Ploughwright Mill');
  state.jobs.jx = { id: 'jx', kind: 'repair', role: 'mason', state: 'working', assignee: null, buildingId: mill.id, unit: null, tenantId: null, applicantId: null, incidentId: null, outcomeId: null, x: mill.x, y: mill.y, workDays: 2, progress: 0.35, cost: 9, priority: 1, createdDay: state.day - 1, byRuler: true };
  state.ledger.months[0]!.index = 0;
}

// ───────── a flat table to stand on ─────────
const unit = (): number => (innerWidth < 700 ? 27 : 40);
const centre = (): [number, number] => (innerWidth < 700 ? [13.6, 11.2] : [14.6, 11.4]);
function proj(tx: number, ty: number): [number, number] {
  const u = unit(), [cx, cy] = centre();
  return [innerWidth / 2 + (tx - cx) * u - (ty - cy) * u * 0.16, innerHeight * 0.53 + (ty - cy) * u * 0.6];
}
function paint(): void {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const u = unit();
  const room = g.createRadialGradient(innerWidth / 2, innerHeight * 0.5, 60, innerWidth / 2, innerHeight * 0.5, Math.max(innerWidth, innerHeight) * 0.75);
  room.addColorStop(0, '#4a3220'); room.addColorStop(0.6, '#2a1b12'); room.addColorStop(1, '#0e0a08');
  g.fillStyle = room; g.fillRect(0, 0, innerWidth, innerHeight);
  const quad = (x0: number, y0: number, x1: number, y1: number, fill: string): void => {
    const a = proj(x0, y0), b = proj(x1, y0), c = proj(x1, y1), d = proj(x0, y1);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fillStyle = fill; g.fill();
  };
  quad(-0.6, -0.6, 32.6, 24.6, '#3a2616');
  quad(0, 0, 32, 24, '#55683a');
  for (const p of state.map.parcels) if (!p.owned) quad(p.x, p.y, p.x + 8, p.y + 8, 'rgba(20,16,12,.38)');
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    const t = state.map.tiles[y * 32 + x]!.t;
    if (t === 'road' || t === 'bridge') quad(x, y, x + 1, y + 1, '#8a7350');
    else if (t === 'water') quad(x, y, x + 1, y + 1, '#3f6f8f');
    else if (t === 'forest') quad(x + 0.2, y + 0.2, x + 0.8, y + 0.8, '#33502d');
    else if (t === 'field') quad(x, y, x + 1, y + 1, '#8f8a45');
  }
  const order = Object.values(state.buildings).sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const b of order) {
    const [x0, y0] = proj(b.x + 0.15, b.y + b.h - 0.1), [x1] = proj(b.x + b.w - 0.15, b.y + b.h - 0.1);
    const tall = (b.units.length || b.type === 'seat' ? 0.95 : 0.5) * u * (b.state === 'building' ? 0.45 : 1);
    g.fillStyle = b.state === 'building' ? '#9a8565' : '#e6d9bb'; g.fillRect(x0, y0 - tall, x1 - x0, tall);
    if (b.state !== 'building') {
      g.beginPath(); g.moveTo(x0 - 4, y0 - tall); g.lineTo((x0 + x1) / 2, y0 - tall - u * 0.55); g.lineTo(x1 + 4, y0 - tall); g.closePath();
      g.fillStyle = b.type === 'seat' ? '#8f3028' : b.units.length ? '#b08a45' : '#7f8a96'; g.fill();
    }
  }
}
addEventListener('resize', paint);
paint();

// ───────── the stand-in renderer ─────────
const heard: { [K in keyof RendererEvents]?: RendererEvents[K][] } = {};
let tool: Tool = { kind: 'select' };
function anchor(ref: AnchorRef): Anchor {
  const u = unit();
  let p: [number, number] | null = null;
  if ('buildingId' in ref) {
    const b = state.buildings[ref.buildingId];
    if (b) {
      if (ref.at === 'door') p = proj(b.x + b.w / 2 + (ref.unit ? 0.9 : 0) - (b.units.length > 1 ? 0.45 : 0), b.y + b.h + 0.25);
      else { p = proj(b.x + b.w / 2, b.y + b.h - 0.1); p[1] -= u * (b.state === 'building' ? 0.6 : 1.55); }
    }
  } else if ('actorId' in ref) {
    const a = state.actors[ref.actorId];
    if (a) { p = proj(a.x, a.y); p[1] -= u * 0.5; }
  } else if ('tenantId' in ref) {
    const t = state.tenants[ref.tenantId], b = t?.buildingId ? state.buildings[t.buildingId] : undefined;
    if (t && b) { p = proj(b.x + b.w / 2 + ((t.portraitSeed % 7) - 3) * 0.3, b.y + b.h + 0.9 + (t.portraitSeed % 3) * 0.25); p[1] -= u * 0.5; }
  } else if ('tile' in ref) p = proj(ref.tile[0] + 0.5, ref.tile[1] + 0.5);
  else p = [innerWidth - 120, innerHeight - 120];
  if (!p) return { x: 0, y: 0, visible: false, scale: 1 };
  return { x: p[0], y: p[1], visible: p[0] > -20 && p[0] < innerWidth + 20 && p[1] > 0 && p[1] < innerHeight + 20, scale: u / 40 };
}
const setSel: unknown[] = [];      // what the frame asked to be selected and brought into view (read by the self-test)
const focused: unknown[] = [];
const renderer: Renderer = {
  reset() {}, sync() {}, handleEvents() {}, frame() {}, resize() {}, setMode() {}, setHighlight() {}, setQuality() {},
  focus(target) { focused.push(target); },
  setSelection(sel) { setSel.push(sel); },
  setTool(t) { tool = t; },
  anchor,
  on(type, cb) { (heard[type] ??= [] as never[]).push(cb as never); },
  stats: () => ({ fps: 60, calls: 0, tris: 0 }),
  dispose() {},
};
canvas.addEventListener('click', e => {      // the nearest building within reach is "picked"
  let best: Id | null = null, bd = 34;
  for (const b of Object.values(state.buildings)) {
    const a = anchor({ buildingId: b.id, at: 'top' });
    const d = Math.hypot(a.x - e.clientX, a.y + unit() * 0.8 - e.clientY);
    if (d < bd) { bd = d; best = b.id; }
  }
  for (const cb of heard.pick ?? []) cb(best ? { kind: 'building', buildingId: best } : { kind: 'none' }, { button: 0, shift: e.shiftKey });
});

// ───────── everything else the UI is handed ─────────
const word: WordAPI = {
  transport: () => 'none',
  ready: Promise.resolve(),
  speak: async (text, target) => ({
    id: 'x' + Math.random(), day: state.day, text, target, reply: 'Aye. It shall be looked at.', status: 'done', applied: [], pending: [], orders: [], oaths: [], via: 'offline',
    speaker: { kind: 'herald', name: 'The Clerk', first: 'Clerk', species: 'human', portraitSeed: 9, mood: 'neutral' }, confirm() {}, cancel() {},
  }),
  openAudience: () => null,
  mic: { supported: false, listening: false, start(hd) { hd.onError?.('unsupported'); }, stop() {} },
  log: () => [],
  onChange: () => () => {},
  needsCourtKey: () => false,
  setWit() {},
  engine: () => null,
};
let settings: Settings = { quality: 'medium', master: 0.8, music: 0.5, sfx: 0.8, voice: 0.7, wit: 'quick', courtKey: '', hints: true };
const appApi: AppAPI = {
  newGame() {}, hasSave: () => false, saveInfo: () => null, continueGame: () => false, saveNow() {}, toTitle() {}, dynasty: () => [],
  settings: () => settings, setSettings(p) { settings = { ...settings, ...p }; }, inGame: () => true,
};
const ui = createUI({ root: app, sim, renderer, word, audio: createAudio(), app: appApi });

// while the tool parts are still placeholders, mark where they will stand
for (const [name, w, hgt, label] of [['left', 62, 520, 'tool rail'], ['word', 560, 84, 'the word bar']] as const) {
  const part = app.querySelector<HTMLElement>(`.ll-slot-${name}`)?.firstElementChild as HTMLElement | null | undefined;
  if (part && !part.childElementCount) {
    part.style.cssText = `width:${w}px;max-width:100%;height:${hgt}px;max-height:100%;border:1px dashed rgba(239,227,196,.35);border-radius:3px;color:rgba(239,227,196,.5);font:13px Georgia,serif;display:grid;place-items:center;text-align:center`;
    part.textContent = label;
  }
}

// ───────── a script of small events ─────────
let pending: SimEvent[] = [];
let hid = 0;
function herald(kind: HeraldKind, text: string, refs: Partial<Herald> = {}): void {
  const hd: Herald = { id: 'dev' + (hid++), day: state.day, kind, text, ...refs };
  state.heralds.push(hd);
  pending.push({ type: 'herald', herald: hd });
}
const griffin = Object.values(state.incidents).find(i => i.defId === 'unauthorized_griffin')!;
const leak = Object.values(state.incidents).find(i => i.defId === 'sys_repair_leak')!;
const tenantOf = (b: Building): Id => b.units[0]!.tenantId!;
const script: [number, () => void][] = [
  [200, () => herald('info', 'Wat Mudge has been seen measuring the well. Nobody asked him to.')],
  [450, () => herald('good', 'Pim Underbough paid in full, and left a seed cake on the sill.', { tenantId: tenantOf(byName('Underbough')) })],
  [700, () => herald('rival', 'Baron Aldous Vane has been seen measuring your tenants for his own cottages.')],
  [950, () => herald('bad', 'The roof of The Leaning Hovel is leaking. It has chosen a spot directly over the bed.', { buildingId: leak.buildingId!, incidentId: leak.id })],
  [1200, () => herald('urgent', 'There is a griffin on the roof of Mudlark Hovel. Wat Mudge says it is “more of a large cat”. It has eaten a weathervane.', { buildingId: griffin.buildingId!, incidentId: griffin.id })],
  [1300, () => pending.push({ type: 'say', text: 'He is house-trained. He simply prefers the roof.', actorId: griffin.actorId! })],
  [1400, () => pending.push({ type: 'say', text: 'Fourteen to a hovel. For efficiency.', buildingId: byName('Damp End').id })],
  [1500, () => pending.push({ type: 'say', text: 'It will hold until it rains.', staffId: Object.values(state.staff).find(m => m.role === 'mason')!.id })],
];
const t0 = performance.now();
let step = 0;

let last = performance.now();
function tick(): void {
  const now = performance.now();
  if (now - last < 4) return;                  // the frame and the timer landed together
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  while (step < script.length && now - t0 >= script[step]![0]) script[step++]![1]();
  if (!state.ended) state.day += (dt * state.speed) / SECONDS_PER_DAY;
  if (pending.length) { const batch = pending; pending = []; ui.handleEvents(batch, state); }
  ui.update(state, dt);
}
// Headless Chromium on a busy machine hands out very few animation frames (three in
// three seconds has been seen), so a timer keeps the page moving between them.
const frame = (): void => { tick(); requestAnimationFrame(frame); };
requestAnimationFrame(frame);
setInterval(tick, 33);

// ───────── scenes for screenshots ─────────
const q = <T extends HTMLElement>(sel: string): T | null => app.querySelector<T>(sel);
const hover = (sel: string): void => { q(sel)?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); };
const scenes: Record<string, () => void> = {
  /** the dispatch parchment on the leak, a tooltip on the coffers */
  matter() {
    app.querySelectorAll<HTMLElement>('.ll-pin--incident').forEach(p => { if (p.getAttribute('data-tip-h') === 'A Leak in the Roof') p.click(); });
    hover('.ll-plaque .ll-fig-coin');
  },
  /** the herald's roll open */
  roll() { q<HTMLElement>('.ll-her-more')?.click(); },
  /** the charter met, in debt, crawling */
  crown() {
    state.charter.ready = true; state.charter.goals.forEach(g => { g.done = true; g.value = g.target; });
    state.gold = -64; state.loans = [{ principal: 150, ratePctMonth: 6, takenDay: 20 }];
    herald('crown', 'The Crown’s herald is at the gate with a scroll and a look of mild surprise.');
    // typing to the court is what makes the world crawl
    const box = q<HTMLInputElement | HTMLTextAreaElement>('.ll-slot-word textarea, .ll-slot-word input');
    if (box) { box.focus(); box.value = 'Hob, mend the miller’s roof before the rains.'; box.dispatchEvent(new Event('input', { bubbles: true })); }
    hover('.ll-plaque .ll-hud-charter');
  },
  /** a winter night at the end of the month */
  night() { state.day = 328.2; state.weather = 'snow'; },
  /** phones: unfold the plaque */
  fold() { q<HTMLElement>('.ll-hud-bar')?.click(); },
  ledger() { ui.open('ledger'); },
  /** something selected, a tool armed */
  pick() { for (const cb of heard.pick ?? []) cb({ kind: 'building', buildingId: byName('Mudlark Hovel').id }, { button: 0, shift: false }); },
  toast() { sim.dispatch = () => ({ ok: false, code: 'no_gold', reason: 'The coffers hold but 12 crowns, my lord. A cottage wants 90.' }); for (const cb of heard.place ?? []) cb('cottage', 4, 4, 0); },
};
/** wait for a few painted frames (a starved headless browser paints only when asked) */
function settle(frames = 4): Promise<void> {
  return new Promise(done => {
    const stop = setTimeout(done, 6000);
    const next = (n: number): void => { if (n <= 0) { clearTimeout(stop); done(); } else requestAnimationFrame(() => setTimeout(() => next(n - 1), 60)); };
    next(frames);
  });
}

// ───────── a self-test of the frame's wiring (run from --eval; returns what failed) ─────────
async function selftest(): Promise<{ passed: number; failed: string[] }> {
  const failed: string[] = [];
  let passed = 0;
  const ok = (name: string, cond: boolean): void => { if (cond) passed++; else failed.push(name); };
  const key = (k: string, code = ''): void => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k, code, bubbles: true })); };
  const root = q<HTMLElement>('#ui')!;
  const veiled = (): boolean => root.classList.contains('is-veiled');
  const shown = (): number => Array.from(q<HTMLElement>('.ll-screens')!.children).findIndex(c => !(c as HTMLElement).hidden && getComputedStyle(c).display !== 'none');
  const frameHidden = (): boolean => getComputedStyle(q<HTMLElement>('.ll-frame')!).visibility === 'hidden' && getComputedStyle(q<HTMLElement>('.ll-world')!).visibility === 'hidden';
  const step = (): void => ui.update(state, 0.016);
  const last = (): { type: string } | undefined => sim.log[sim.log.length - 1];
  (document.activeElement as HTMLElement | null)?.blur?.();
  sim.setSpeed(1); step();

  // speeds and pause
  key('2'); ok('2 sets double time', state.speed === 2);
  key('3'); ok('3 sets fourfold time', state.speed === 4);
  key(' ', 'Space'); ok('Space stops the clock', state.speed === 0);
  key(' ', 'Space'); ok('Space starts it again at the same speed', state.speed === 4);
  key('1'); ok('1 sets ordinary time', state.speed === 1);

  // screens: open, veil, pause, toggle, Esc
  key('l'); ok('L opens a screen', veiled() && shown() === 2); ok('the ledger stops the clock', state.speed === 0);
  await settle(3); await new Promise(r => setTimeout(r, 350)); await settle(2);
  ok('the frame hides behind a screen', frameHidden());
  key('2'); ok('speed keys are ignored behind a screen', state.speed === 0);
  key('Escape'); ok('Esc closes the ledger', !veiled()); ok('the clock resumes at the old speed', state.speed === 1);
  key('c'); ok('C opens the council', veiled() && shown() === 3); key('c'); ok('C closes it again', !veiled());
  key('h'); ok('H opens help', veiled() && shown() === 7); key('Escape'); ok('Esc closes help', !veiled() && state.speed === 1);

  // B and T summon the build book and the Word box; text fields keep their keys
  let answered = 0;
  const onSummon = (e: Event): void => { if (e.defaultPrevented) answered++; };
  root.addEventListener('ll:summon', onSummon);
  key('b'); ok('B is answered by the build menu', answered === 1); key('Escape');
  key('t'); const box = document.activeElement as HTMLInputElement | null;
  ok('T focuses the Word box', !!box && !!box.closest('.ll-slot-word') && (box.tagName === 'INPUT' || box.tagName === 'TEXTAREA'));
  key('l'); ok('L typed into the Word box opens nothing', !veiled());
  key(' ', 'Space'); ok('Space typed into the Word box does not stop the clock', state.speed !== 0);
  key('Escape'); ok('Esc leaves the Word box', document.activeElement !== box);
  key('Enter'); ok('Enter focuses the Word box', !!document.activeElement?.closest('.ll-slot-word')); (document.activeElement as HTMLElement | null)?.blur?.();
  root.removeEventListener('ll:summon', onSummon);

  // the table: picks and props
  const mud = byName('Mudlark Hovel');
  for (const cb of heard.pick ?? []) cb({ kind: 'building', buildingId: mud.id }, { button: 0, shift: false });
  step();
  ok('a picked building is selected on the table', JSON.stringify(setSel[setSel.length - 1]) === JSON.stringify({ buildingId: mud.id }));
  ok('the inspector shows it', (q<HTMLElement>('.ll-slot-inspector')?.textContent ?? '').includes('Mudlark Hovel'));
  key('Escape'); step();
  ok('Esc clears the selection', setSel[setSel.length - 1] === null);
  const prop = (p: 'ledger' | 'coffer' | 'charter' | 'bell'): void => { for (const cb of heard.pick ?? []) cb({ kind: 'prop', prop: p }, { button: 0, shift: false }); };
  prop('ledger'); ok('the ledger on the table opens the ledger', shown() === 2); key('Escape');
  prop('coffer'); ok('the coffer opens the ledger', shown() === 2); key('Escape');
  prop('charter'); ok('the charter scroll opens the charter', shown() === 4); key('Escape');
  prop('bell'); ok('the bell stops the clock', state.speed === 0); prop('bell'); ok('and starts it', state.speed === 1);

  // tools become actions
  for (const cb of heard.place ?? []) cb('cottage', 4, 5, 1); ok('place', last()?.type === 'place_building');
  for (const cb of heard.paint ?? []) cb('road', [[1, 1], [2, 1]]); ok('paint road', last()?.type === 'place_road');
  for (const cb of heard.paint ?? []) cb('unroad', [[1, 1]]); ok('unpaint road', last()?.type === 'remove_road');
  for (const cb of heard.clear ?? []) cb(3, 3); ok('clear', last()?.type === 'clear_tile');
  for (const cb of heard.demolish ?? []) cb(mud.id); ok('demolish', last()?.type === 'demolish');

  // pins
  step();
  const pinOf = (cls: string, head?: string): HTMLElement | undefined => Array.from(app.querySelectorAll<HTMLElement>('.ll-pin--' + cls)).find(p => !p.classList.contains('is-pending') && !p.classList.contains('has-more') && (!head || p.getAttribute('data-tip-h') === head));
  const purse = pinOf('purse');
  ok('there is a purse pin', !!purse); purse?.click(); ok('a purse pin sends for the purse', last()?.type === 'collect_purse');
  const ap = pinOf('applicant');
  ok('there is an applicant pin', !!ap); ap?.click(); ok('an applicant pin orders the showing', last()?.type === 'order_job');
  const leakPin = pinOf('incident', 'A Leak in the Roof');
  ok('there is a pin on the leak', !!leakPin); leakPin?.click();
  const opt = q<HTMLElement>('.ll-pop .ll-pop-opt');
  ok('the leak opens a parchment of outcomes', !!opt); opt?.click();
  ok('choosing one resolves the incident', last()?.type === 'resolve_incident' && !q('.ll-pop'));
  const speech = pinOf('speech');
  ok('the waiting petitioner has a speech pin', !!speech); speech?.click();
  ok('it opens the audience', veiled() && shown() === 1); ui.close(); ok('ui.close shuts it', !veiled());

  // heralds lead somewhere
  herald('bad', 'A test of the strips.', { buildingId: mud.id });
  { const batch = pending; pending = []; ui.handleEvents(batch, state); }
  const strip = q<HTMLElement>('button.ll-her-strip');
  ok('a herald with a building is a button', !!strip && (strip.textContent ?? '').includes('A test of the strips.'));
  const before = focused.length; strip?.click();
  ok('clicking it brings the building into view', focused.length === before + 1 && JSON.stringify(setSel[setSel.length - 1]) === JSON.stringify({ buildingId: mud.id }));
  key('Escape'); step();

  // a refusal is said aloud
  const dispatch = sim.dispatch;
  sim.dispatch = () => ({ ok: false, code: 'no_gold', reason: 'The coffers are not equal to it.' });
  for (const cb of heard.place ?? []) cb('cottage', 4, 4, 0);
  ok('a refusal becomes a toast', (q('.ll-toasts')?.textContent ?? '').includes('The coffers are not equal to it.'));
  sim.dispatch = dispatch;

  // a new sim: everything forgets, the plaque re-reads
  const other = makeFixtureState('reeve');
  ui.rebind(fakeSim(other)); ui.update(other, 0.016); ui.update(other, 0.3);
  ok('rebind: the plaque shows the new ruler', (q('.ll-hud-ruler')?.textContent ?? '').startsWith('Reeve '));
  ok('rebind: the old strips are gone', !q('.ll-her-strip'));
  ui.rebind(sim); step(); ui.update(state, 0.3);
  ok('rebind back: the plaque shows the knight', (q('.ll-hud-ruler')?.textContent ?? '').startsWith('Sir '));
  sim.setSpeed(1);
  return { passed, failed };
}

(window as unknown as { __dev: unknown }).__dev = {
  selftest,
  ui, sim, state, renderer, herald, scenes, tool: () => tool,
  emit(ev: SimEvent) { pending.push(ev); },
  scene(name: string) { scenes[name]?.(); return name in scenes; },
  settle,
};
