/**
 * Dev page for the audience and the charter (ui-screens-b). Not shipped.
 *
 *   node tools/shot.mjs src/dev/ui-screens-b.ts .tmp/ui-screens-b.png
 *       one live frame filling the window: the griffin audience with a scripted
 *       petitioner (two canned turns, then a ruling with an oath). The small
 *       switcher bottom-left opens the other states.
 *   ... --w 2560 --h 1600 --eval "window.__dev.sheet(1280,800,2,['open','mid','sealed','plain'])"
 *   ... --w 3840 --h 800  --eval "window.__dev.sheet(1280,800,3,['charter','ceremony','risen'])"
 *   ... --w 3200 --h 800  --eval "window.__dev.sheet(400,800,8,['open','facts','mid','sealed','plain','charter','ceremony','risen'])"
 *       a contact sheet: frames of that size, each driven to one state
 *       (audience at open, mid-conversation, sealed, plain choices; charter in
 *       progress, ceremony, risen). One browser run shows several states.
 *       Keep a sheet to four desktop frames: software rendering is slow.
 *   ... --w 2880 --h 800  --eval "window.__dev.sheet(1280,800,3,['charter','risen@400','open@400','mid@800x400'])"
 *       a name may carry its own size (width, or width x height), to mix desk and phone frames in one row.
 *   ... --eval "window.__dev.exercise()"
 *       clicks through both screens by their real controls, prints what happened
 *       (dispatches, renderer modes, the crawl), then leaves a live sealed audience.
 */
import { BASE_CSS } from '../ui/css/base';
import { addStyle, h } from '../ui/kit';
import { MARGINALIA_CSS } from '../ui/marginalia';
import { create as createAudience, TYPING } from '../ui/screens/audience';
import { create as createCharter } from '../ui/screens/charter';
import type { Screen, ScreenName, UICtx, AppAPI } from '../ui/api';
import type { Renderer } from '../render/api';
import type { AudienceSession, AudienceTurn, MicAPI, WordAPI } from '../word/api';
import type { Action, GameState, Incident, Oath } from '../sim/types';
import { createAudio } from '../audio';
import { INCIDENT_BY_ID } from '../data';
import { baseVars, fill } from '../sim/core';
import { makeFixtureState, fakeSim } from './fixture';

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
async function until(fn: () => unknown, timeout = 5000): Promise<void> {
  const t0 = performance.now();
  while (!fn() && performance.now() - t0 < timeout) await wait(30);
}

// ───────────── a stand-in for the table behind the screens ─────────────
function paintTable(w: number, h0: number, soft = false): string {
  const c = document.createElement('canvas'); c.width = w; c.height = h0;
  const g = c.getContext('2d')!;
  if (soft) g.filter = 'blur(2.5px) saturate(.82)';   // the sheet bakes the softening in; live blur is too slow for a big headless page
  g.fillStyle = '#1a110b'; g.fillRect(0, 0, w, h0);
  // oak table
  const wood = g.createLinearGradient(0, h0 * 0.2, 0, h0);
  wood.addColorStop(0, '#3a2414'); wood.addColorStop(1, '#5c3a1f');
  g.fillStyle = wood; g.fillRect(0, h0 * 0.18, w, h0);
  g.strokeStyle = 'rgba(20,10,5,.35)'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, h0 * 0.2 + i * h0 * 0.1); g.lineTo(w, h0 * 0.22 + i * h0 * 0.1); g.stroke(); }
  // the board
  g.fillStyle = '#5d7440';
  g.beginPath(); g.moveTo(w * 0.16, h0 * 0.3); g.lineTo(w * 0.84, h0 * 0.3); g.lineTo(w * 0.97, h0 * 0.86); g.lineTo(w * 0.03, h0 * 0.86); g.closePath(); g.fill();
  g.fillStyle = '#b9a06a';
  g.beginPath(); g.moveTo(w * 0.12, h0 * 0.56); g.lineTo(w * 0.88, h0 * 0.56); g.lineTo(w * 0.9, h0 * 0.6); g.lineTo(w * 0.1, h0 * 0.6); g.closePath(); g.fill();
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26; i++) {
    const x = w * (0.2 + rnd() * 0.6), y = h0 * (0.36 + rnd() * 0.42), s = h0 * (0.035 + (y / h0) * 0.05);
    if (Math.abs(y - h0 * 0.58) < s) continue;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.2, s * 1.1, s * 0.3, 0, 0, 7); g.fill();
    g.fillStyle = '#e6d9ba'; g.fillRect(x - s * 0.7, y - s * 0.8, s * 1.4, s);
    g.fillStyle = i % 3 ? '#a6763c' : '#8a4a36';
    g.beginPath(); g.moveTo(x - s * 0.9, y - s * 0.8); g.lineTo(x, y - s * 1.7); g.lineTo(x + s * 0.9, y - s * 0.8); g.closePath(); g.fill();
    g.fillStyle = '#ffcf7a'; g.fillRect(x - s * 0.15, y - s * 0.5, s * 0.3, s * 0.35);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#3f5a2c' : '#4c6a34'; const x = w * (0.1 + rnd() * 0.8), y = h0 * (0.32 + rnd() * 0.5); g.beginPath(); g.arc(x, y, h0 * 0.014, 0, 7); g.fill(); }
  // candle light and the dark of the room
  const glow = g.createRadialGradient(w * 0.2, h0 * 0.3, 10, w * 0.2, h0 * 0.3, w * 0.7);
  glow.addColorStop(0, 'rgba(255,170,80,.42)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h0);
  const vig = g.createRadialGradient(w / 2, h0 * 0.55, h0 * 0.3, w / 2, h0 * 0.55, w * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = vig; g.fillRect(0, 0, w, h0);
  return c.toDataURL('image/jpeg', 0.8);
}

// ───────────── fakes ─────────────
function fakeRenderer(modes: string[]): Renderer {
  const anchor = { x: 0, y: 0, visible: false, scale: 1 };
  return new Proxy({}, {
    get: (_t, k) => k === 'anchor' ? () => anchor : k === 'stats' ? () => ({ fps: 60, calls: 0, tris: 0 })
      : (...a: unknown[]) => { if (k === 'setMode') modes.push(String(a[0])); },
  }) as unknown as Renderer;
}

function fakeMic(): MicAPI {
  const said = 'He may stay, but he pays pet rent';
  let timer = 0, n = 0, fin: ((t: string) => void) | null = null;
  const mic: MicAPI = {
    supported: true, listening: false,
    start(hd) {
      if (mic.listening) return;
      mic.listening = true; n = 0; fin = hd.onFinal;
      const words = said.split(' ');
      timer = window.setInterval(() => { n = Math.min(words.length, n + 1); hd.onPartial?.(words.slice(0, n).join(' ')); }, 220);
    },
    stop() {
      if (!mic.listening) return;
      mic.listening = false; clearInterval(timer);
      fin?.(said.split(' ').slice(0, Math.max(1, n)).join(' ')); fin = null;
    },
  };
  return mic;
}

interface DevOpts { transport: 'server' | 'none'; delay: number; hangAt?: number; left?: string[] }

/** The scripted griffin: an opening, two canned turns, then a ruling with an oath. */
function griffinSession(state: GameState, inc: Incident, dispatch: (a: Action) => unknown, opts: DevOpts): AudienceSession {
  const def = INCIDENT_BY_ID[inc.defId]!;
  const t = state.tenants[inc.tenantId!]!, b = state.buildings[inc.buildingId!]!;
  const vars = { ...baseVars(state, b, t), ...inc.vars };
  const petRent = def.outcomes[0]!;
  const oath: Oath = { id: 'w9', kind: 'repair', text: `I will have the roof of ${b.name} braced before the first snow.`, toTenantId: t.id, toName: t.name, buildingId: b.id, buildingType: null, amount: null, madeDay: state.day, dueDay: 270, state: 'open', settledDay: null };
  const blank = { outcomeId: null, done: false, resultText: null, oaths: [], revealed: [], via: 'model' as const };
  const canned: AudienceTurn[] = [
    { ...blank, reply: 'One weathervane. And it was a poor likeness of a cockerel. Gerald has, if anything, improved the skyline.', mood: 'worried' },
    { ...blank, reply: 'A surety against the thatch. That I can do. He is very light on his feet, for a creature the size of a hay cart.', mood: 'pleased', aside: 'He will pay. Name the sum and have done.' },
    { reply: fill(petRent.reply, vars), mood: 'delighted', outcomeId: petRent.id, done: true, resultText: fill(petRent.result, vars), oaths: [oath], revealed: ['pet_lover'], via: 'model' },
  ];
  let n = 0;
  const s: AudienceSession = {
    incidentId: inc.id, title: def.title,
    speaker: { kind: 'tenant', name: t.name, first: t.first, species: t.species, portraitSeed: t.portraitSeed, tenantId: t.id, mood: 'worried' },
    lines: [{ who: 'petitioner', text: fill(def.opening![0]!, vars) }],
    whispers: def.outcomes.map(o => ({ outcomeId: o.id, label: fill(o.label, vars), say: fill(o.say, vars) })),
    busy: false, done: false, outcomeId: null,
    say(text) {
      s.lines.push({ who: 'ruler', text });
      const k = n++;
      if (opts.hangAt === k) return new Promise<AudienceTurn>(() => { /* the petitioner thinks, for the screenshot */ });
      const turn = canned[Math.min(k, canned.length - 1)]!;
      s.busy = true;
      return new Promise(resolve => setTimeout(() => {
        s.busy = false; s.lines.push({ who: 'petitioner', text: turn.reply }); if (turn.aside) s.lines.push({ who: 'steward', text: turn.aside });
        if (turn.done) { s.done = true; s.outcomeId = turn.outcomeId; dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: turn.outcomeId! }); dispatch({ type: 'swear_oath', oath }); }
        resolve(turn);
      }, opts.delay));
    },
    choose(outcomeId) {
      const o = def.outcomes.find(x => x.id === outcomeId) ?? petRent;
      dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o.id });
      s.done = true; s.outcomeId = o.id;
      return { reply: fill(o.reply, vars), mood: o.id === 'ban' ? 'sad' : 'delighted', outcomeId: o.id, done: true, resultText: fill(o.result, vars), oaths: [], revealed: [], via: 'offline' };
    },
    leave() { opts.left?.push(inc.id); },
  };
  return s;
}

interface Frame { root: HTMLElement; ctx: UICtx; state: GameState; screens: Record<'audience' | 'charter', Screen>; griffinId: string; chiefId: string; modes: string[]; log: Action[]; toasts: string[] }

function makeFrame(host: HTMLElement, opts: DevOpts, tweak?: (s: GameState) => void): Frame {
  const state = makeFixtureState('knight');
  const sim = fakeSim(state);
  const incs = Object.values(state.incidents);
  const griffin = incs.find(i => i.defId === 'unauthorized_griffin')!;
  const chief = incs.find(i => i.defId === 'sys_squatters_goblins')!;
  // what Wat remembers of his landlord, so the conversation has a past
  state.tenants[griffin.tenantId!]!.memory.push(
    { day: 3, text: 'You mended the roof the same day they asked.', valence: 1 },
    { day: 12, text: 'You charged a late fee in the week of the flood.', valence: -1 },
    { day: 20, text: 'You swore the rent would not move this year.', valence: 2 });
  // a third petitioner: someone behind on the rent
  const late = Object.values(state.tenants).find(t => t.arrears > 0 && t.id !== griffin.tenantId);
  if (late && INCIDENT_BY_ID.sys_late_rent) {
    const b = state.buildings[late.buildingId!]!;
    state.incidents.dev_late = { id: 'dev_late', defId: 'sys_late_rent', state: 'open', buildingId: b.id, unit: late.unit, tenantId: late.id, applicantId: null, startedDay: state.day - 1, expiresDay: state.day + 2.5, vars: { tenant: late.name, first: late.first, building: b.name }, outcomeId: null, resolvedBy: null, jobId: null, actorId: null, reported: false };
  }
  tweak?.(state);

  const root = h('div', { class: 'dev-ui' });
  host.appendChild(root);
  const modes: string[] = [], toasts: string[] = [];
  const screens = {} as Record<'audience' | 'charter', Screen>;
  const open = new Set<string>();
  const toastEl = h('div', { class: 'dev-toast' });
  root.appendChild(toastEl);
  const word: WordAPI = {
    transport: () => opts.transport,
    ready: Promise.resolve(),
    speak: () => Promise.reject(new Error('the dev page has no court')),
    openAudience(id) {
      const inc = state.incidents[id];
      if (!inc || inc.state !== 'open' || inc.defId !== 'unauthorized_griffin') return null;   // others fall back to the local session
      return griffinSession(state, inc, a => sim.dispatch(a), opts);
    },
    mic: fakeMic(),
    log: () => [],
    needsCourtKey: () => false,
    setWit() { /* dev */ },
    engine: () => (opts.transport === 'none' ? null : 'claude'),
    onChange: () => () => { /* nothing changes here */ },
  };
  const app: AppAPI = {
    newGame() { /* dev */ }, hasSave: () => false, continueGame: () => false, saveNow() { /* dev */ }, toTitle() { /* dev */ }, dynasty: () => [], saveInfo: () => null,
    settings: () => ({ quality: 'medium', master: 0.8, music: 0.5, sfx: 0.8, voice: 0.7, wit: 'quick', courtKey: '', hints: true }), setSettings() { /* dev */ }, inGame: () => true,
  };
  const ctx: UICtx = {
    root, sim, state: () => state, renderer: fakeRenderer(modes), word, audio: createAudio(), app,
    act: a => { const r = sim.dispatch(a); if (!r.ok) ctx.toast(r.reason, 'bad'); return r; },
    open(name: ScreenName, arg?: unknown) { const s = screens[name as 'audience' | 'charter']; if (!s) return; open.add(name); s.open(arg); },
    close(name?: ScreenName) { for (const n of name ? [name] : Array.from(open) as ScreenName[]) { screens[n as 'audience' | 'charter']?.close(); open.delete(n); } },
    isOpen: name => open.has(name),
    toast(text) { toasts.push(text); toastEl.textContent = text; toastEl.classList.add('is-on'); setTimeout(() => toastEl.classList.remove('is-on'), 2600); },
    select() { /* dev */ },
    holdCrawl() { const was = state.speed; state.speed = 0.1; return () => { state.speed = was; }; },
  };
  screens.audience = createAudience(ctx);
  screens.charter = createCharter(ctx);
  root.append(screens.audience.el, screens.charter.el);
  setInterval(() => { for (const n of open) screens[n as 'audience' | 'charter'].update?.(state, 0.1); }, 100);
  return { root, ctx, state, screens, griffinId: griffin.id, chiefId: chief.id, modes, log: sim.log, toasts };
}

async function sayIn(f: Frame, text: string, expectReply = true): Promise<void> {
  const box = f.root.querySelector<HTMLTextAreaElement>('.ll-aud-box')!;
  const send = f.root.querySelector<HTMLButtonElement>('.ll-aud-send')!;
  box.value = text;
  send.click();
  if (expectReply) await until(() => !send.disabled || !f.root.querySelector('.ll-aud-ruling')!.hasAttribute('hidden'), 9000);
  await wait(40);
}

const SAY = [
  'How many weathervanes has he eaten, exactly?',
  'He may stay, if you post a surety against the thatch.',
  'Then it is settled. Gerald pays pet rent, you post the surety, and I will have that roof braced before the first snow.',
];

type StateName = 'open' | 'facts' | 'mid' | 'sealed' | 'plain' | 'charter' | 'ceremony' | 'risen';
const ready = (s: GameState) => { s.charter.ready = true; for (const g of s.charter.goals) { g.value = Math.max(g.value, g.target); g.done = true; } s.renown = 66; };

async function drive(host: HTMLElement, name: StateName, delay: number): Promise<Frame> {
  switch (name) {
    case 'open': { const f = makeFrame(host, { transport: 'server', delay }); f.ctx.open('audience', f.griffinId); return f; }
    case 'facts': {     // narrow layouts fold "what you know" behind a toggle; this opens it
      const f = makeFrame(host, { transport: 'server', delay });
      f.ctx.open('audience', f.griffinId); await wait(60);
      f.root.querySelector<HTMLButtonElement>('.ll-aud-facts-toggle')!.click();
      return f;
    }
    case 'mid': {
      const f = makeFrame(host, { transport: 'server', delay, hangAt: 1 });
      f.ctx.open('audience', f.griffinId); await wait(60);
      await sayIn(f, SAY[0]!); await sayIn(f, SAY[1]!, false);
      return f;
    }
    case 'sealed': {
      const f = makeFrame(host, { transport: 'server', delay });
      f.ctx.open('audience', f.griffinId); await wait(60);
      for (const line of SAY) await sayIn(f, line);
      return f;
    }
    case 'plain': { const f = makeFrame(host, { transport: 'none', delay }); f.ctx.open('audience', f.chiefId); return f; }
    case 'charter': { const f = makeFrame(host, { transport: 'server', delay }); f.ctx.open('charter'); return f; }
    case 'ceremony': { const f = makeFrame(host, { transport: 'server', delay }, ready); f.ctx.open('charter'); return f; }
    case 'risen': {
      const f = makeFrame(host, { transport: 'server', delay }, ready);
      f.ctx.open('charter'); await until(() => !f.root.querySelector('.ll-chr-cer-actions')?.classList.contains('is-wait'));
      f.root.querySelector<HTMLButtonElement>('.ll-chr-kneel')!.click();
      return f;
    }
  }
}

// ───────────── page ─────────────
const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=UnifrakturMaguntia&display=swap';
document.head.appendChild(fonts);
addStyle('base', BASE_CSS);
addStyle('marginalia', MARGINALIA_CSS);
addStyle('dev-screens-b', `
#app{display:grid;gap:0;align-content:start;justify-content:start;overflow:auto}
canvas#c{display:none!important}
.dev-frame{position:relative;overflow:hidden;background-size:cover;background-position:center;outline:1px solid #000}
.dev-ui{position:absolute;inset:0}
.dev-sheet .ll-aud,.dev-sheet .ll-chr{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.dev-sheet *,.dev-sheet *::before,.dev-sheet *::after{animation:none!important;transition:none!important}
.dev-toast{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);z-index:50;padding:6px 14px;background:var(--parch);color:var(--ink);border:1px solid var(--parch-edge);border-radius:3px;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none}
.dev-toast.is-on{opacity:1}
.dev-switch{position:fixed;left:6px;bottom:6px;z-index:99;display:flex;gap:4px;opacity:.5}
.dev-switch:hover{opacity:1}
.dev-switch button{font:12px sans-serif;padding:2px 6px}
`);

const app = document.getElementById('app')!;
const ALL: StateName[] = ['open', 'mid', 'sealed', 'plain', 'charter', 'ceremony', 'risen'];

async function single(name: StateName): Promise<void> {
  TYPING.instant = false;
  app.replaceChildren();
  app.classList.remove('dev-sheet');
  app.style.gridTemplateColumns = '1fr'; app.style.gridTemplateRows = '1fr';
  const host = h('div', { class: 'dev-frame', style: { width: '100%', height: '100%', backgroundImage: `url(${paintTable(1280, 800)})` } });
  app.appendChild(host);
  await drive(host, name, 900);
  const sw = h('div', { class: 'dev-switch' }, ALL.map(n => h('button', { onclick: () => { void single(n); } }, n)));
  host.appendChild(sw);
}

/**
 * A contact sheet: every state at w×h, `cols` across. Resolves once they have settled.
 * A name may carry its own width ('risen@400'), so one sheet can mix desk and phone frames.
 */
async function sheet(w = 1280, h0 = 800, cols = 4, only?: string[]): Promise<string> {
  TYPING.instant = true;
  app.replaceChildren();
  app.classList.add('dev-sheet');
  const frames = (only ?? ALL).map(n => {
    const [name, size] = n.split('@'); const [fw, fh] = (size ?? '').split('x');
    return { name: name as StateName, w: fw ? +fw : w, h: fh ? +fh : h0 };
  });
  const mixed = frames.some(f => f.w !== w || f.h !== h0);
  app.style.gridTemplateColumns = mixed ? frames.map(f => f.w + 'px').join(' ') : `repeat(${cols}, ${w}px)`; app.style.gridTemplateRows = '';
  const bgs = new Map<string, string>();
  await Promise.all(frames.map(f => {
    const key = f.w + 'x' + f.h;
    if (!bgs.has(key)) bgs.set(key, paintTable(f.w, f.h, true));
    const host = h('div', { class: 'dev-frame', style: { width: f.w + 'px', height: f.h + 'px', backgroundImage: `url(${bgs.get(key)!})` }, dataset: { state: f.name } });
    app.appendChild(host);
    return drive(host, f.name, 20);
  }));
  await wait(600);
  // a line per frame, so a run reports what is on the page as well as showing it
  const report = Array.from(app.querySelectorAll<HTMLElement>('.dev-frame')).map(f => {
    const q = (sel: string) => f.querySelector<HTMLElement>(sel);
    const shown = (sel: string) => { const e = q(sel); return !!e && !e.hidden && e.getClientRects().length > 0; };
    return `${f.dataset.state}: lines=${f.querySelectorAll('.ll-aud-line').length} listening=${!!q('.ll-aud-dots')} whispers=${shown('.ll-aud-whispers') ? f.querySelectorAll('.ll-aud-whisper').length : 0}` +
      ` ruling=${shown('.ll-aud-ruling') ? JSON.stringify(q('.ll-aud-ruling')!.textContent) : '-'} goals=${f.querySelectorAll('.ll-chr-goal').length} ceremony=${shown('.ll-chr-cer-stage')} risen=${shown('.ll-chr-reveal') ? q('.ll-chr-newtitle')?.textContent : '-'}`;
  });
  return `sheet ${w}x${h0}\n` + report.join('\n');
}

/**
 * Walk both screens through their flows by clicking the real controls, and
 * report what happened (dispatches, renderer modes, the crawl, the session).
 */
async function exercise(): Promise<string> {
  TYPING.instant = true;
  app.replaceChildren();
  app.classList.add('dev-sheet');
  app.style.gridTemplateColumns = '1fr'; app.style.gridTemplateRows = '1fr';
  const host = h('div', { class: 'dev-frame', style: { width: '100%', height: '100%' } });
  app.appendChild(host);
  const left: string[] = [];
  const f = makeFrame(host, { transport: 'server', delay: 20, left });
  const q = <T extends HTMLElement>(sel: string) => f.root.querySelector<T>(sel);
  const all = <T extends HTMLElement>(sel: string) => Array.from(f.root.querySelectorAll<T>(sel));
  const out: Record<string, unknown> = {};
  const aud = f.screens.audience.el;

  f.ctx.open('audience', f.griffinId); await wait(80);
  out.open = { shown: !aud.hidden, mode: f.modes.at(-1), crawl: f.state.speed, lines: all('.ll-aud-line').length, name: q('.ll-aud-name')?.textContent, queue: all('.ll-aud-qbtn').length };
  all<HTMLButtonElement>('.ll-aud-whisper')[1]!.click(); await wait(40);
  out.whisperFills = { box: q<HTMLTextAreaElement>('.ll-aud-box')!.value, lines: all('.ll-aud-line').length };
  q<HTMLTextAreaElement>('.ll-aud-box')!.value = '';
  const mic = q<HTMLButtonElement>('.ll-aud-mic')!;
  mic.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); await wait(700);
  const heardLive = q<HTMLTextAreaElement>('.ll-aud-box')!.value;
  mic.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); await wait(40);
  out.mic = { live: heardLive, final: q<HTMLTextAreaElement>('.ll-aud-box')!.value, note: q('.ll-aud-word-note')?.textContent };
  q<HTMLTextAreaElement>('.ll-aud-box')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await wait(200);
  out.enterSpeaks = { lines: all('.ll-aud-line').map(l => l.className.replace('ll-aud-line ', '')) };

  all<HTMLButtonElement>('.ll-aud-qbtn').find(b => !b.disabled && !b.classList.contains('is-urgent'))!.click(); await wait(80);
  out.hop = { left: left.slice(), name: q('.ll-aud-name')?.textContent, plain: q('.ll-aud-whispers')?.classList.contains('is-plain'), whispers: all('.ll-aud-whisper').length, note: q('.ll-aud-word-note')?.textContent };
  all<HTMLButtonElement>('.ll-aud-whisper')[2]!.click();
  await until(() => !q('.ll-aud-ruling')!.hasAttribute('hidden')); await wait(40);
  out.plainRuling = { text: q('.ll-aud-result')?.textContent, dispatched: f.log.filter(a => a.type === 'resolve_incident'), leaveShown: !q('.ll-lbx.is-bottom .ll-lbx-btn')!.hidden };
  all<HTMLButtonElement>('.ll-aud-ruling-actions .ll-btn-primary')[0]!.click(); await wait(40);
  out.soRuled = { hidden: aud.hidden, mode: f.modes.at(-1), speed: f.state.speed, toasts: f.toasts.slice() };

  f.ctx.open('audience', f.griffinId); await wait(80);
  aud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(40);
  out.escape = { hidden: aud.hidden, left: left.slice(), toast: f.toasts.at(-1), speed: f.state.speed };

  const chr = f.screens.charter.el;
  f.ctx.open('charter'); await wait(60);
  out.charter = { shown: !chr.hidden, goals: all('.ll-chr-goal').length, sealed: all('.ll-chr-goal .ll-wax').length, banner: !q('.ll-chr-ready')!.hidden, tally: q('.ll-chr-tally')?.textContent };
  ready(f.state); f.screens.charter.handleEvents?.([{ type: 'charter_ready' }], f.state); f.screens.charter.update?.(f.state, 1); await wait(40);
  out.becomesReady = { banner: !q('.ll-chr-ready')!.hidden, sealed: all('.ll-chr-goal .ll-wax').length };
  q<HTMLButtonElement>('.ll-chr-ready .ll-btn-primary')!.click();
  await until(() => !!q('.ll-chr-cer-actions') && !q('.ll-chr-cer-actions')!.classList.contains('is-wait')); await wait(40);
  out.ceremony = { mode: f.modes.at(-1), proclamation: q('.ll-chr-procl')?.textContent };
  q<HTMLButtonElement>('.ll-chr-kneel')!.click(); await wait(60);
  out.kneel = { dispatched: f.log.filter(a => a.type === 'accept_promotion').length, title: q('.ll-chr-newtitle')?.textContent, sub: q('.ll-chr-newsub')?.textContent, unlocks: all('.ll-chr-unlocks li').length };
  q<HTMLButtonElement>('.ll-chr-reveal .ll-btn-primary')!.click(); await wait(40);
  out.rise = { hidden: chr.hidden, mode: f.modes.at(-1), modes: f.modes.join('>') };

  const report = JSON.stringify(out, null, 1);
  await single('sealed');  // then a live conversation, typed and sealed at its own pace, for the screenshot that follows
  await wait(2400);        // the seal lands, the entries are written in
  return report;
}

(window as unknown as { __dev: unknown }).__dev = { sheet, single, exercise };
void single('open');
