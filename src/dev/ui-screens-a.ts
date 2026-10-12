/**
 * Dev page for ui-screens-a: mounts the title (menu, charter, hall), the end
 * of a reign, settings and the primer over a blurred stand-in for the table,
 * with a fake UICtx and AppAPI (two fake dynasty entries, a fake save).
 *
 *   ?view=title | title-nosave | new | dynasty | dynasty-empty | end | demote | settings | help | help-word
 *   ?grid=title,new,dynasty&gw=400&gh=800   several views side by side in iframes (for narrow screenshots)
 *   window.__dev.show(view)
 */
import type { UICtx, AppAPI, Screen, ScreenName, DynastyEntry, Settings } from '../ui/api';
import type { Renderer } from '../render/api';
import type { WordAPI } from '../word/api';
import type { AudioAPI } from '../audio/api';
import { BASE_CSS } from '../ui/css/base';
import { MARGINALIA_CSS } from '../ui/marginalia';
import { addStyle, h } from '../ui/kit';
import { makeFixtureState, fakeSim } from './fixture';
import * as title from '../ui/screens/title';
import * as gameover from '../ui/screens/gameover';
import * as settings from '../ui/screens/settings';
import * as help from '../ui/screens/help';

const q = new URLSearchParams(location.search);
const app0 = document.getElementById('app')!;

// fonts: the real page loads them in index.html; here we ask Google too (a local copy may already be injected)
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=UnifrakturMaguntia&display=swap';
document.head.appendChild(link);

if (q.get('grid')) grid(); else if (q.get('shell')) withShell(); else main();

/** Mount the real shell (createUI) with fake deps, to check the screens behave inside it. window.__dev.log collects app calls. */
function withShell(): void {
  paintGround();
  const log: string[] = [];
  const state = makeFixtureState('knight', 34.4);
  const sim = fakeSim(state);
  let inGame = false;
  let cfg: Settings = { quality: 'medium', master: .8, music: .5, sfx: .8, voice: .7, wit: 'quick', courtKey: '', hints: true };
  const noop = () => undefined;
  const renderer = new Proxy({}, { get: (_t, k) => k === 'anchor' ? () => ({ x: 0, y: 0, visible: false, scale: 1 }) : k === 'stats' ? () => ({ fps: 60, calls: 0, tris: 0 }) : noop }) as unknown as Renderer;
  const word = { transport: () => 'none', ready: Promise.resolve(), speak: () => Promise.reject(new Error('dev')), openAudience: () => null, mic: { supported: false, listening: false, start: noop, stop: noop }, log: () => [], onChange: () => noop } as unknown as WordAPI;
  const vols = { master: .8, music: .5, sfx: .8, voice: .7 };
  const audio: AudioAPI = { unlock: noop, sfx: noop, handleEvents: noop, update: noop, setMood: noop, voice: () => ({ stop: noop }), setVolumes: (v) => Object.assign(vols, v), volumes: () => ({ ...vols }), dispose: noop };
  const app: AppAPI = {
    newGame(o) { log.push('newGame ' + JSON.stringify(o)); inGame = true; },
    hasSave: () => true,
    continueGame() { log.push('continue'); inGame = true; return true; },
    saveNow() { log.push('saveNow'); },
    toTitle() { log.push('toTitle'); inGame = false; },
    dynasty: () => [],
    settings: () => ({ ...cfg }),
    setSettings(p) { cfg = { ...cfg, ...p }; log.push('set ' + JSON.stringify(p)); },
    inGame: () => inGame,
  };
  void import('../ui/index').then(({ createUI }) => {
    const ui = createUI({ root: app0, sim, renderer, word, audio, app });
    let last = performance.now();
    const loop = (t: number) => { const dt = Math.min(.1, (t - last) / 1000); last = t; try { ui.update(sim.state, dt); } catch (e) { log.push('update threw ' + String(e)); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    (window as unknown as { __dev: unknown }).__dev = { ui, app, log, sim };
  }).catch(e => log.push('createUI failed ' + String(e)));
}

/** A contact sheet: each view in its own iframe of gw x gh, `cols` to a row, no gaps (so the sheet can be cut apart). */
function grid(): void {
  const views = q.get('grid')!.split(',');
  const gw = +(q.get('gw') ?? 400), gh = +(q.get('gh') ?? 800), cols = +(q.get('cols') ?? views.length);
  document.body.style.cssText = 'margin:0;background:#050403';
  app0.style.cssText = `position:fixed;left:0;top:0;display:grid;grid-template-columns:repeat(${cols},${gw}px);grid-auto-rows:${gh}px;background:#050403`;
  app0.innerHTML = '';
  const base = location.href.split('?')[0];
  for (const v of views) {
    const f = document.createElement('iframe');
    f.src = `${base}?view=${encodeURIComponent(v)}`;
    f.style.cssText = `width:${gw}px;height:${gh}px;border:0;display:block;background:#0e0a08`;
    app0.appendChild(f);
  }
}

function main(): void {
  addStyle('base', BASE_CSS);
  if (MARGINALIA_CSS) addStyle('marginalia', MARGINALIA_CSS);
  paintGround();

  const ui = h('div', { id: 'ui' });
  app0.appendChild(ui);

  const view = q.get('view') ?? 'title';
  const state = makeFixtureState('knight', 34.4);
  if (view === 'end') {
    state.mode = 'iron';
    state.day = 2 * 360 + 4 * 30 + 11;
    state.ended = { reason: 'bankrupt', day: state.day, epitaph: 'Collected every rent but his own.' };
    Object.assign(state.stats, { rentCollected: 4815, evictions: 3, oathsKept: 7, oathsBroken: 2, tenantsHoused: 31, peakRentRoll: 296 });
  }
  if (view === 'demote') {
    state.realm.rank = 'reeve';
    Object.assign(state.stats, { rentCollected: 1240, evictions: 1, oathsKept: 3, oathsBroken: 0, tenantsHoused: 11, peakRentRoll: 118 });
  }
  const sim = fakeSim(state);

  const dynasty: DynastyEntry[] = view === 'dynasty-empty' ? [] : [
    { ruler: 'Edwy', realm: 'Lesser Dripping', rank: 'reeve', mode: 'peace', years: 1.6, households: 9, peakRentRoll: 84, epitaph: 'Mended every roof but the one over his own head.', endedAt: '2026-09-28T19:12:00.000Z', heirloom: null },
    { ruler: 'Aldreda', realm: 'Crookbarrow', rank: 'knight', mode: 'iron', years: 3.5, households: 27, peakRentRoll: 341, epitaph: 'Kept every oath, and most of the surety.', endedAt: '2026-10-09T21:40:00.000Z', heirloom: 'a ring of forty keys' },
  ];
  if (view === 'end') dynasty.push({ ruler: state.realm.ruler, realm: state.realm.name, rank: state.realm.rank, mode: 'iron', years: 2.4, households: 31, peakRentRoll: 296, epitaph: 'Collected every rent but his own.', endedAt: new Date().toISOString(), heirloom: 'a ledger with only a little red in it' });

  let cfg: Settings = { quality: 'medium', master: .8, music: .5, sfx: .8, voice: .7, wit: 'quick', courtKey: '', hints: true };
  let inGame = view === 'end' || view === 'demote' || view === 'help-word';
  const app: AppAPI & { saveInfo(): { realm: string; ruler: string; rank: string; mode: 'peace' | 'iron' } | null } = {
    newGame(o) { console.log('[app] newGame', JSON.stringify(o)); inGame = true; },
    hasSave: () => view !== 'title-nosave',
    continueGame() { console.log('[app] continue'); inGame = true; return true; },
    saveNow() { console.log('[app] saveNow'); },
    toTitle() { console.log('[app] toTitle'); inGame = false; ctx.open('title'); },
    dynasty: () => dynasty.slice(),
    settings: () => ({ ...cfg }),
    setSettings(p) { cfg = { ...cfg, ...p }; console.log('[app] setSettings', JSON.stringify(p)); },
    inGame: () => inGame,
    saveInfo: () => view === 'title-nosave' ? null : { realm: 'Mudlark Hollow', ruler: 'Luke', rank: 'knight', mode: 'peace' },
  };

  const noop = () => undefined;
  const renderer = new Proxy({}, { get: (_t, k) => k === 'anchor' ? () => ({ x: 0, y: 0, visible: false, scale: 1 }) : k === 'stats' ? () => ({ fps: 60, calls: 0, tris: 0 }) : noop }) as unknown as Renderer;
  const word = { transport: () => 'none', ready: Promise.resolve(), speak: () => Promise.reject(new Error('dev')), openAudience: () => null, mic: { supported: false, listening: false, start: noop, stop: noop }, log: () => [], onChange: () => noop } as unknown as WordAPI;
  const vols = { master: .8, music: .5, sfx: .8, voice: .7 };
  const audio: AudioAPI = { unlock: noop, sfx: (id) => console.log('[sfx]', id), handleEvents: noop, update: noop, setMood: noop, voice: () => ({ stop: noop }), setVolumes: (v) => Object.assign(vols, v), volumes: () => ({ ...vols }), dispose: noop };

  // a tiny stand-in for the shell's screen manager: one screen at a time, Esc closes
  const screens = new Map<ScreenName, Screen>();
  let current: ScreenName | null = null;
  const toastBox = h('div', { style: 'position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:95;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none' });
  const ctx: UICtx = {
    root: ui, sim, state: () => sim.state, renderer, word, audio, app,
    act: (a) => sim.dispatch(a),
    open(name, arg) {
      if (current && current !== name) { const c = current; current = null; screens.get(c)?.close(); }
      const s = screens.get(name); if (!s) { console.log('[shell] no screen', name); return; }
      current = name; s.open(arg);
    },
    close(name) { if (!current || (name && name !== current)) return; const c = current; current = null; screens.get(c)?.close(); },
    isOpen: (name) => current === name,
    toast(text, kind = 'info') {
      const t = h('div', { class: 'll-parch', style: `padding:8px 14px;font-size:15px;border-left:3px solid ${kind === 'bad' ? 'var(--bad)' : kind === 'good' ? 'var(--good)' : 'var(--gold)'}` }, text);
      toastBox.appendChild(t); setTimeout(() => t.remove(), 2600);
    },
    select: noop,
    holdCrawl: () => noop,
  };
  screens.set('title', title.create(ctx));
  screens.set('gameover', gameover.create(ctx));
  screens.set('settings', settings.create(ctx));
  screens.set('help', help.create(ctx));
  for (const s of screens.values()) ui.appendChild(s.el);
  ui.appendChild(toastBox);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && current) { console.log('[shell] esc closes', current); ctx.close(); } });
  // a pretend Word bar so the primer's sayings have somewhere to go (hidden under screens, as the shell does)
  const bar = view === 'help-word' ? h('input', { type: 'text', placeholder: 'Speak, Sir…', class: 'll-input', style: 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(520px,90%)' }) : null;
  if (bar) {
    ui.insertBefore(bar, ui.firstChild);
    // answer the Word bar's bus the way the real one does
    window.addEventListener('ll:speak', e => { const t = (e as CustomEvent<{ text?: string }>).detail?.text; if (typeof t === 'string') { bar.value = t; bar.focus(); } });
  }
  let last = performance.now();
  const loop = (t: number) => {
    const dt = Math.min(.1, (t - last) / 1000); last = t;
    if (current) screens.get(current)?.update?.(sim.state, dt);
    if (bar) bar.style.display = current ? 'none' : '';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const show = (v: string) => {
    switch (v) {
      case 'new': ctx.open('title', 'new'); break;
      case 'dynasty': case 'dynasty-empty': ctx.open('title', 'dynasty'); break;
      case 'end': ctx.open('gameover', state.ended); break;
      case 'demote': ctx.open('gameover', { type: 'demotion', rank: 'reeve' }); break;
      case 'settings': ctx.open('settings'); break;
      case 'help': case 'help-word': ctx.open('help');
        if (v === 'help-word') setTimeout(() => (document.querySelector('.lla-toc button:nth-child(5)') as HTMLElement | null)?.click(), 300);
        break;
      default: ctx.open('title');
    }
  };
  (window as unknown as { __dev: unknown }).__dev = { show, ctx, app, sim };
  show(view);
}

/** A soft, blurred stand-in for the candle-lit table: room, oak, board, a few houses, candles. */
function paintGround(): void {
  const c = document.getElementById('c') as HTMLCanvasElement | null;
  if (!c) return;
  const W = innerWidth, H = innerHeight;
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0e0a08'; g.fillRect(0, 0, W, H);
  g.filter = 'blur(3px)';
  const cx = W * .58, cy = H * .56;
  // the table
  let gr = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * .6);
  gr.addColorStop(0, '#6b4524'); gr.addColorStop(.55, '#3a2412'); gr.addColorStop(1, '#0e0a08');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, W * .62, H * .5, 0, 0, Math.PI * 2); g.fill();
  // the board (a trapezoid in perspective)
  const bw = Math.min(W * .62, 820), bh = bw * .46;
  g.fillStyle = '#4e6b33';
  g.beginPath(); g.moveTo(cx - bw * .42, cy - bh * .45); g.lineTo(cx + bw * .42, cy - bh * .45); g.lineTo(cx + bw * .52, cy + bh * .45); g.lineTo(cx - bw * .52, cy + bh * .45); g.closePath(); g.fill();
  g.fillStyle = '#5d4229'; g.fillRect(cx - bw * .52, cy + bh * .45, bw * 1.04, 12);
  // a road
  g.strokeStyle = '#a08560'; g.lineWidth = 10; g.beginPath(); g.moveTo(cx - bw * .5, cy + 10); g.lineTo(cx + bw * .5, cy - 4); g.stroke();
  // houses
  const rnd = (n: number) => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i < 16; i++) {
    const x = cx - bw * .4 + rnd(i) * bw * .8, y = cy - bh * .35 + rnd(i + 40) * bh * .7, s = 18 + rnd(i + 9) * 14;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 4, y + s * .6, s * 1.3, s * .3);
    g.fillStyle = '#e8dcc0'; g.fillRect(x, y, s * 1.2, s * .8);
    g.fillStyle = i % 3 ? '#9a6a35' : '#6d5a4a'; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + s * .6, y - s * .6); g.lineTo(x + s * 1.2 + 3, y); g.fill();
    g.fillStyle = '#ffcf6a'; g.fillRect(x + s * .25, y + s * .3, 4, 5);
  }
  // trees
  for (let i = 0; i < 22; i++) {
    const x = cx - bw * .45 + rnd(i + 70) * bw * .9, y = cy - bh * .42 + rnd(i + 110) * bh * .84;
    g.fillStyle = '#2f4a22'; g.beginPath(); g.arc(x, y, 7 + rnd(i) * 6, 0, Math.PI * 2); g.fill();
  }
  // candles
  for (const [x, y] of [[cx - bw * .62, cy - bh * .1], [cx + bw * .6, cy - bh * .3], [cx + bw * .1, cy + bh * .75]] as [number, number][]) {
    gr = g.createRadialGradient(x, y, 2, x, y, 140); gr.addColorStop(0, 'rgba(255,200,110,.55)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = gr; g.fillRect(x - 140, y - 140, 280, 280);
    g.fillStyle = '#efe3c4'; g.fillRect(x - 5, y, 10, 34); g.fillStyle = '#ffd27a'; g.beginPath(); g.ellipse(x, y - 6, 3, 7, 0, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'none';
  // tilt-shift-ish darkening top and bottom
  gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(14,10,8,.7)'); gr.addColorStop(.3, 'rgba(14,10,8,0)'); gr.addColorStop(.75, 'rgba(14,10,8,0)'); gr.addColorStop(1, 'rgba(14,10,8,.75)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
