/**
 * OWNER: ui-shell agent. The frame of the interface.
 *
 * createUI builds `#ui`, mounts every part into its slot, runs the screens
 * (one at a time) and owns what belongs to no single part: the selection, the
 * speed of the clock, hotkeys, toasts and tooltips.
 *
 * Courtesies other UI modules may rely on (none is required of them):
 *  - Any element with `data-tip="…"` gets a parchment tooltip; `data-tip-h` adds a heading to it.
 *  - A part or screen that handles a key itself calls `preventDefault()`; the frame then leaves that key alone.
 *  - B and Enter / T raise a cancelable `ll:summon` event on `ctx.root` with `detail` 'build' or 'word'.
 *    A part that answers calls `preventDefault()`. Unanswered, the frame clicks the Build control in the
 *    `left` slot, or focuses the first text field in the `word` slot.
 *  - `ctx.renderer.on(…)` may be called by any number of parts: the frame fans the renderer's events out.
 *    When the frame itself puts a tool down (Esc, a screen opening) those listeners hear a 'cancel' too.
 *  - Buttons anywhere in `#ui` click through `audio.sfx('click')` once; a part that plays its own is not doubled.
 */
import type { GameState, SimEvent, Action, ActionResult, Id, Speed } from '../sim/types';
import type { Renderer, RendererEvents, Tool, PickResult, TableProp } from '../render/api';
import type { AudioAPI } from '../audio/api';
import type { UI, UIDeps, UICtx, Screen, ScreenName, SimLike } from './api';
import type { Part } from './parts/part';
import { BASE_CSS } from './css/base';
import { SHELL_CSS } from './css/shell';
import { MARGINALIA_CSS } from './marginalia';
import { iconSvg } from './icons';
import { addStyle, h, clear, setClass, fromHTML, crowns } from './kit';
import { BUILDINGS, ROLE_TITLES, RANK_TITLES } from '../data';
import { mount as mountHud } from './parts/hud';
import { mount as mountHeralds } from './parts/heralds';
import { mount as mountPins } from './parts/pins';
import { mount as mountBubbles } from './parts/bubbles';
import { mount as mountBuildmenu } from './parts/buildmenu';
import { mount as mountInspector } from './parts/inspector';
import { mount as mountWordbar } from './parts/wordbar';
import { mount as mountHints } from './parts/hints';
import { create as createTitle } from './screens/title';
import { create as createAudience } from './screens/audience';
import { create as createLedger } from './screens/ledger';
import { create as createCouncil } from './screens/council';
import { create as createCharter } from './screens/charter';
import { create as createGameover } from './screens/gameover';
import { create as createSettings } from './screens/settings';
import { create as createHelp } from './screens/help';

export type * from './api';

/** What can be selected on the table (wider than UICtx.select: parts hear all four). */
export type Sel = { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id };

/** Extras the frame offers its own parts (hud, heralds, pins, bubbles). Not part of the UI contract. */
export interface ShellAPI {
  /** the speed the player asked for: what the world returns to after a crawl or a pausing screen */
  userSpeed(): Speed;
  setSpeed(speed: Speed): void;
  togglePause(): void;
  /** true under 700px wide */
  narrow(): boolean;
  selection(): Sel | null;
  /** the tool armed on the table right now */
  tool(): Tool;
  /** bring something into view and select it */
  reveal(sel: Sel): void;
}
export type ShellCtx = UICtx & { shell: ShellAPI };
/** Optional extras the shell's own parts may offer back. */
export interface ShellPart extends Part {
  /** Esc was pressed: close a popover or sheet if one is open, and say so */
  escape?(): boolean;
  /** the sim was replaced: forget everything */
  reset?(): void;
}

interface Mounted { name: string; part: ShellPart; strikes: Record<string, number>; rest: Record<string, number> }
type Listeners = { [K in keyof RendererEvents]: RendererEvents[K][] };

const NARROW = '(max-width: 699px)';
const SCREEN_KEYS: Record<string, ScreenName> = { l: 'ledger', c: 'council', h: 'help', '?': 'help' };
const PROP_NAMES: Record<TableProp, [string, string]> = {
  coffer: ['The coffer', 'What you have. Open the ledger to see where it went.'],
  ledger: ['The ledger', 'Accounts, households, orders and oaths.'],
  charter: ['The charter', 'What the Crown expects of you next.'],
  candle: ['A candle', 'It burns down through the month and is fresh on Rent Day.'],
  seal: ['The household seal', 'Your delegates, and those who would like to be.'],
  map_scroll: ['The map', 'The whole realm at a glance.'],
  bell: ['The bell', 'Strike it to stop the clock. Strike it again to start it.'],
};

/** Wrap an object so a few members can be replaced without touching the original. */
function tap<T extends object>(target: T, over: Partial<T>): T {
  const bound = new Map<PropertyKey, unknown>();
  return new Proxy(target, {
    get(t, k) {
      if (k in over) return (over as Record<PropertyKey, unknown>)[k];
      const hit = bound.get(k);
      if (hit !== undefined) return hit;
      const raw = Reflect.get(t, k, t) as unknown;
      if (typeof raw !== 'function') return raw;
      const fn = (raw as (...a: unknown[]) => unknown).bind(t);
      bound.set(k, fn);
      return fn;
    },
  });
}

function isTextField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file', 'image'].includes((el as HTMLInputElement).type);
}
function isPressable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SUMMARY' || el.tagName === 'INPUT' || el.getAttribute('role') === 'button';
}

export function createUI(deps: UIDeps): UI {
  addStyle('base', BASE_CSS);
  if (MARGINALIA_CSS) addStyle('marginalia', MARGINALIA_CSS);
  addStyle('shell', SHELL_CSS);

  // ───────── the frame ─────────
  const host = deps.root;
  const found = host.id === 'ui' ? host : host.querySelector<HTMLElement>('#ui');
  const root = found ?? host.appendChild(h('div', { id: 'ui' }));
  const worldLayer = h('div', { class: 'll-world ll-pass' });
  const slot = (name: string): HTMLDivElement => h('div', { class: `ll-slot ll-slot-${name}`, dataset: { slot: name } });
  const slots = { hud: slot('hud'), left: slot('left'), inspector: slot('inspector'), heralds: slot('heralds'), word: slot('word') };
  const frameLayer = h('div', { class: 'll-frame ll-pass' }, slots.hud, slots.left, slots.inspector, slots.heralds, slots.word);
  const screenLayer = h('div', { class: 'll-screens ll-pass' });
  const toastBox = h('div', { class: 'll-toasts ll-pass', role: 'status', 'aria-live': 'polite' });
  const mkTip = (cls: string): HTMLDivElement => h('div', { class: `ll-tooltip ll-tip ll-pass ${cls}`, role: 'tooltip' }, h('span', { class: 'll-tip-h' }), h('span', { class: 'll-tip-b' }));
  const tipEl = mkTip('ll-tip-el');
  const hoverEl = mkTip('ll-tip-hover');
  root.append(worldLayer, frameLayer, screenLayer, toastBox, hoverEl, tipEl);

  let disposed = false;
  let generation = 0;
  const mq = window.matchMedia(NARROW);

  // slot heights other slots sit beside
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    for (const en of entries) {
      const px = Math.round(en.borderBoxSize?.[0]?.blockSize ?? en.contentRect.height) + 'px';
      root.style.setProperty(en.target === slots.hud ? '--ll-top-h' : '--ll-word-h', px);
    }
  }) : null;
  ro?.observe(slots.hud); ro?.observe(slots.word);

  // ───────── sound ─────────
  let lastClickSfx = -1e9;
  const audio: AudioAPI = tap(deps.audio, {
    sfx(id, opts) { lastClickSfx = performance.now(); deps.audio.sfx(id, opts); },   // whatever a part plays for its own button stands in for the frame's click
  });

  // ───────── the renderer, with the tool remembered and events fanned out ─────────
  let tool: Tool = { kind: 'select' };
  let lastCancelAt = -1e9, lastToolDownAt = -1e9;
  const heard: Listeners = { pick: [], hover: [], place: [], paint: [], clear: [], demolish: [], cancel: [] };
  function fan<K extends keyof RendererEvents>(type: K, ...args: Parameters<RendererEvents[K]>): void {
    for (const cb of heard[type].slice()) {
      try { (cb as (...a: Parameters<RendererEvents[K]>) => void)(...args); } catch (e) { console.error(`[ui] a "${type}" listener threw`, e); }
    }
  }
  function toolChanged(): void { setClass(root, 'is-tooling', tool.kind !== 'select'); if (tool.kind !== 'select') hideHover(); }
  const renderer: Renderer = tap(deps.renderer, {
    setTool(t: Tool) {
      if (tool.kind !== 'select' && t.kind === 'select') lastToolDownAt = performance.now();
      tool = t; toolChanged(); deps.renderer.setTool(t);
    },
    on<K extends keyof RendererEvents>(type: K, cb: RendererEvents[K]) { heard[type].push(cb); },
  });
  /** put the tool down; `tell` lets parts that armed it hear a 'cancel' */
  function cancelTool(tell: boolean): void {
    if (tool.kind === 'select') return;
    renderer.setTool({ kind: 'select' });
    if (tell) fan('cancel');
  }

  // ───────── the clock ─────────
  let userSpeed: Speed = 1;
  let lastRun: Speed = 1;
  let pauseHolds = 0, crawlHolds = 0;
  let applied: Speed | null = null;
  function wantSpeed(): Speed { return pauseHolds > 0 || userSpeed === 0 ? 0 : crawlHolds > 0 ? 0.1 : userSpeed; }
  /** the first touch of a sim: start from the speed it already runs at (a loaded save may be stopped, or at fourfold time) */
  function meet(): void {
    if (applied !== null || !deps.app.inGame()) return;
    const sp = ctx.sim.state.speed;
    userSpeed = sp === 0.1 ? lastRun : sp; if (userSpeed) lastRun = userSpeed;
    applied = sp;
  }
  function applySpeed(): void {
    if (!deps.app.inGame()) return;
    meet();
    const want = wantSpeed();
    if (ctx.sim.state.speed !== want) ctx.sim.setSpeed(want);
    applied = want;
  }
  function adopt(sp: Speed): void { userSpeed = sp === 0.1 ? (userSpeed || lastRun) : sp; if (userSpeed) lastRun = userSpeed; }
  function tickClock(): void {
    if (!deps.app.inGame()) { applied = null; return; }
    const sp = ctx.sim.state.speed;
    if (applied === null) applySpeed();
    else if (sp !== applied) { adopt(sp); applySpeed(); }   // someone else moved the clock: the Word, a loaded save, the app
  }
  function holdCrawl(): () => void {
    const gen = generation;
    let done = false;
    crawlHolds++; applySpeed();
    return () => {
      if (done) return; done = true;
      if (gen !== generation) return;
      crawlHolds = Math.max(0, crawlHolds - 1); applySpeed();
    };
  }

  // ───────── toasts ─────────
  interface Toast { el: HTMLElement; text: string; timer: number; out: boolean }
  let toasts: Toast[] = [];
  function dropToast(t: Toast): void {
    if (t.out) return; t.out = true;
    window.clearTimeout(t.timer);
    t.el.classList.add('is-out');
    window.setTimeout(() => { t.el.remove(); toasts = toasts.filter(x => x !== t); }, 320);
  }
  function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    if (disposed || !text) return;
    const ttl = Math.min(7000, 2600 + text.length * 45);
    const same = toasts.find(t => t.text === text && !t.out);
    if (same) {
      window.clearTimeout(same.timer); same.timer = window.setTimeout(() => dropToast(same), ttl);
      same.el.classList.remove('is-again'); void same.el.offsetWidth; same.el.classList.add('is-again');
      return;
    }
    const el = h('div', { class: `ll-toast is-${kind}` }, fromHTML(iconSvg(kind === 'bad' ? 'warning' : kind === 'good' ? 'check' : 'quill')), h('span', null, text));
    const t: Toast = { el, text, timer: 0, out: false };
    t.timer = window.setTimeout(() => dropToast(t), ttl);
    toasts.push(t); toastBox.appendChild(el);
    const live = toasts.filter(x => !x.out);
    if (live.length > 3) dropToast(live[0]!);
    if (kind === 'bad') audio.sfx('error', { volume: 0.6 });
  }

  // ───────── tooltips ─────────
  let tipFor: Element | null = null, tipShown = false, tipTimer = 0, tipText = '';
  let hoverKey = '', hoverTimer = 0, hoverAt: [number, number] | null = null;
  let px = 0, py = 0, pointerKind = 'mouse';
  function placeTip(el: HTMLElement, x: number, y: number, above: number | null): void {
    const W = root.clientWidth, H = root.clientHeight, w = el.offsetWidth, ht = el.offsetHeight;
    let ty = y;
    if (y + ht > H - 8 && above !== null) ty = above - ht;
    ty = Math.max(8, Math.min(H - ht - 8, ty));
    const tx = Math.max(8, Math.min(W - w - 8, x - w / 2));
    el.style.transform = `translate3d(${Math.round(tx)}px,${Math.round(ty)}px,0)`;
  }
  function fillTip(el: HTMLElement, head: string, body: string): void {
    (el.firstChild as HTMLElement).textContent = head;
    (el.firstChild as HTMLElement).hidden = !head;
    (el.lastChild as HTMLElement).textContent = body;
  }
  function showTip(el: Element): void {
    if (!el.isConnected || disposed) return;
    const body = el.getAttribute('data-tip') ?? '';
    const head = el.getAttribute('data-tip-h') ?? '';
    if (!body && !head) return;
    tipText = body;
    fillTip(tipEl, head, body);
    const r = el.getBoundingClientRect(), o = root.getBoundingClientRect();
    if (!r.width && !r.height) return;                 // not on show (a folded panel): nothing to point at
    placeTip(tipEl, r.left - o.left + r.width / 2, r.bottom - o.top + 8, r.top - o.top - 8);
    tipEl.classList.add('is-on'); tipShown = true;
  }
  function hideTip(): void {
    window.clearTimeout(tipTimer); tipFor = null;
    if (tipShown) { tipEl.classList.remove('is-on'); tipShown = false; }
  }
  const tipTarget = (e: Event): Element | null => (e.target instanceof Element ? e.target.closest('[data-tip],[data-tip-h]') : null);
  function onOver(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    const el = tipTarget(e);
    if (el === tipFor) return;
    hideTip();
    if (!el) return;
    tipFor = el; tipTimer = window.setTimeout(() => showTip(el), 340);
  }
  function onOut(e: PointerEvent): void {
    if (tipFor && !(e.relatedTarget instanceof Node && tipFor.contains(e.relatedTarget))) hideTip();
  }
  function onDown(e: PointerEvent): void {
    hideTip(); hideHover();
    if (e.pointerType !== 'touch') return;
    const el = tipTarget(e);           // press and hold shows the tip on touch
    if (el) { tipFor = el; tipTimer = window.setTimeout(() => showTip(el), 480); }
  }
  function onUp(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;
    window.clearTimeout(tipTimer);
    if (tipShown) tipTimer = window.setTimeout(hideTip, 1700); else tipFor = null;
  }
  function onFocusIn(e: FocusEvent): void {
    const el = tipTarget(e);
    if (!el || !(e.target instanceof Element) || !e.target.matches(':focus-visible') || isTextField(e.target)) return;
    hideTip(); tipFor = el; showTip(el);
  }
  function onMove(e: PointerEvent): void {
    px = e.clientX; py = e.clientY; pointerKind = e.pointerType;
    if (hoverAt && Math.hypot(px - hoverAt[0], py - hoverAt[1]) > 46) { hideHover(); hoverKey = ''; }
  }
  function hideHover(): void { window.clearTimeout(hoverTimer); if (hoverAt) { hoverEl.classList.remove('is-on'); hoverAt = null; } }

  /** a line or two about whatever the pointer rests on, on the table */
  function describe(hit: PickResult): [string, string] | null {
    const st = ctx.state();
    if (hit.kind === 'prop') {
      const p = PROP_NAMES[hit.prop];
      return hit.prop === 'coffer' ? [p[0], `${crowns(st.gold)}. ${p[1]}`] : p;
    }
    if (hit.kind === 'building') {
      const b = st.buildings[hit.buildingId]; if (!b) return null;
      const def = BUILDINGS[b.type];
      const kind = b.name === def.name ? '' : def.name + '. ';
      if (b.state === 'building') return [b.name, `${kind}Going up. ${Math.round(b.progress * 100)} parts in the hundred done.`];
      if (b.state === 'ruined') return [b.name, `${kind}A ruin.`];
      if (b.squatters) return [b.name, `${kind}Occupied, though not by anyone you chose.`];
      if (!b.units.length) return [b.name, kind.trim()];
      const housed = b.units.filter(u => u.tenantId && st.tenants[u.tenantId]);
      if (b.units.length === 1) {
        const t = housed[0] && st.tenants[housed[0].tenantId!];
        return [b.name, t ? `${kind}${t.name}, ${crowns(t.lease?.rent ?? b.rent)} a month.` : `${kind}Empty${b.units[0]!.listed ? `, to let at ${crowns(b.rent)}` : ''}.`];
      }
      return [b.name, `${kind}${housed.length} of ${b.units.length} let.`];
    }
    if (hit.kind === 'townsperson') {
      const t = st.tenants[hit.tenantId]; if (!t) return null;
      const home = t.buildingId ? st.buildings[t.buildingId] : undefined;
      return [t.name, home ? `Of ${home.name}.` : ''];
    }
    if (hit.kind === 'actor') {
      const a = st.actors[hit.actorId]; if (!a) return null;
      if (a.kind === 'ruler') return [`${st.realm.rank === 'knight' ? 'Sir' : RANK_TITLES[st.realm.rank]} ${st.realm.ruler}`, 'That is you.'];
      if (a.kind === 'staff') { const sm = a.refId ? st.staff[a.refId] : undefined; return sm ? [sm.name, `Your ${ROLE_TITLES[sm.role]}.`] : null; }
      if (a.kind === 'applicant') {
        const ap = a.refId ? st.applicants[a.refId] : undefined; if (!ap) return null;
        const b = st.buildings[ap.buildingId];
        return [ap.household.name, b ? `Hoping for ${b.name}.` : 'Looking for a roof.'];
      }
      if (a.kind === 'petitioner') {
        const t = a.refId ? st.tenants[a.refId] : undefined;
        return [t ? t.name : 'A petitioner', a.state === 'waiting' ? 'Waiting to be heard.' : 'On the way to your door.'];
      }
    }
    return null;
  }
  function onHover(hit: PickResult): void {
    const key = hit.kind + ':' + ('buildingId' in hit ? hit.buildingId : 'actorId' in hit ? hit.actorId : 'tenantId' in hit ? hit.tenantId : 'prop' in hit ? hit.prop : '');
    if (key === hoverKey) return;
    hoverKey = key; hideHover();
    if (veiled || tool.kind !== 'select' || pointerKind !== 'mouse' || hit.kind === 'none' || hit.kind === 'tile') return;
    hoverTimer = window.setTimeout(() => {
      const d = describe(hit); if (!d || veiled) return;
      fillTip(hoverEl, d[0], d[1]);
      const o = root.getBoundingClientRect();
      placeTip(hoverEl, px - o.left, py - o.top + 22, py - o.top - 14);
      hoverEl.classList.add('is-on'); hoverAt = [px, py];
    }, 420);
  }

  // ───────── selection ─────────
  let selection: Sel | null = null;
  function alive(sel: Sel, st: GameState): boolean {
    if (sel.buildingId) return !!st.buildings[sel.buildingId];
    if (sel.tenantId) return !!st.tenants[sel.tenantId];
    if (sel.staffId) return !!st.staff[sel.staffId];
    if (sel.applicantId) return !!st.applicants[sel.applicantId];
    return false;
  }
  function onTable(sel: Sel, st: GameState): { buildingId?: Id; actorId?: Id } | null {
    if (sel.buildingId) return { buildingId: sel.buildingId };
    if (sel.tenantId) { const b = st.tenants[sel.tenantId]?.buildingId; return b ? { buildingId: b } : null; }
    if (sel.staffId) { const a = st.staff[sel.staffId]?.actorId; return a ? { actorId: a } : null; }
    if (sel.applicantId) { const ap = st.applicants[sel.applicantId]; return ap ? (ap.actorId ? { actorId: ap.actorId } : { buildingId: ap.buildingId }) : null; }
    return null;
  }
  function select(sel: Sel | null): void {
    const st = ctx.state();
    const next = sel && alive(sel, st) ? { ...sel } : null;
    selection = next;
    try { renderer.setSelection(next ? onTable(next, st) : null); } catch (e) { console.error('[ui] renderer.setSelection threw', e); }
    for (const m of mounted) guard(m, 'onSelect', () => m.part.onSelect?.(next));
  }
  function reveal(sel: Sel): void {
    const at = onTable(sel, ctx.state());
    if (at) { try { renderer.focus(at, { ms: 650 }); } catch (e) { console.error('[ui] renderer.focus threw', e); } }
    select(sel);
  }

  // ───────── actions ─────────
  function act(action: Action): ActionResult {
    let res: ActionResult;
    try { res = ctx.sim.dispatch(action); }
    catch (e) { console.error('[ui] dispatch threw', action, e); res = { ok: false, code: 'invalid', reason: 'Something went awry in the doing of it.' }; }
    if (!res.ok) toast(res.reason || 'That cannot be done.', 'bad');
    return res;
  }

  // ───────── screens ─────────
  const screens = new Map<ScreenName, Screen>();
  let openName: ScreenName | null = null;
  let pausedBy: ScreenName | null = null;
  let veiled: boolean | null = null;
  const shellApi: ShellAPI = {
    userSpeed: () => userSpeed,
    setSpeed(sp) { if (sp === 0.1) return; meet(); userSpeed = sp; if (sp) lastRun = sp; applySpeed(); },
    togglePause() { meet(); userSpeed = userSpeed === 0 ? lastRun : 0; applySpeed(); },
    narrow: () => mq.matches,
    selection: () => selection,
    tool: () => tool,
    reveal,
  };
  const ctx: ShellCtx = {
    root, sim: deps.sim, state: () => ctx.sim.state, renderer, word: deps.word, audio, app: deps.app,
    act, toast, select, holdCrawl,
    open, close, isOpen: name => openName === name,
    shell: shellApi,
  };

  function syncVeil(): void {
    const v = openName !== null || !deps.app.inGame();
    if (v === veiled) return;
    veiled = v;
    setClass(root, 'is-veiled', v);
    for (const m of mounted) guard(m, 'setVisible', () => m.part.setVisible?.(!v));
    if (v) { hideTip(); hideHover(); hoverKey = ''; }
  }
  function shut(name: ScreenName): void {
    const s = screens.get(name);
    openName = null;
    if (pausedBy === name) { pausedBy = null; pauseHolds = Math.max(0, pauseHolds - 1); }
    if (s) { try { s.close(); } catch (e) { console.error(`[ui] screen "${name}" threw in close`, e); } }
  }
  function open(name: ScreenName, arg?: unknown): void {
    if (disposed) return;
    const s = screens.get(name);
    if (!s) { toast('That page is missing from the book.', 'bad'); return; }
    const fresh = openName !== name;
    if (fresh) {
      if (openName) shut(openName);
      cancelTool(true);
      for (const m of mounted) guard(m, 'escape', () => { for (let i = 0; i < 4 && m.part.escape?.(); i++) { /* close every popover */ } });
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && (frameLayer.contains(focused) || worldLayer.contains(focused))) focused.blur();
      openName = name;
      if (s.pauses) { pausedBy = name; pauseHolds++; }
    }
    try { s.open(arg); }
    catch (e) {
      console.error(`[ui] screen "${name}" threw in open`, e);
      if (openName === name) shut(name);
      toast('The page would not open. The clerk has been told.', 'bad');
    }
    applySpeed(); syncVeil();
    if (fresh && openName === name && name !== 'title' && name !== 'audience') audio.sfx('page', { volume: 0.7 });
  }
  function close(name?: ScreenName): void {
    if (!openName || (name && name !== openName)) return;
    const was = openName;
    shut(was);
    applySpeed(); syncVeil();
    if (was !== 'title' && was !== 'audience') audio.sfx('page', { volume: 0.5, rate: 0.9 });
  }
  const canEscape = (name: ScreenName): boolean => name !== 'title' && !(name === 'gameover' && ctx.state().ended);

  // ───────── parts ─────────
  const mounted: Mounted[] = [];
  /** One part failing must not take the frame with it. Three failures running and the part is rested for two seconds, then tried again. */
  function guard(m: Mounted, what: string, fn: () => void): void {
    const n = m.strikes[what] ?? 0;
    if (n >= 3) {
      if (performance.now() < (m.rest[what] ?? 0)) return;
      m.strikes[what] = 2;                                        // one more try; a failure rests it again
    }
    try { fn(); if (n) m.strikes[what] = 0; }
    catch (e) {
      const now = (m.strikes[what] ?? 0) + 1;
      m.strikes[what] = now;
      if (now >= 3) m.rest[what] = performance.now() + 2000;
      if (n < 3) console.error(`[ui] part "${m.name}" threw in ${what}${now >= 3 ? ' three times running; it is being rested and retried every two seconds' : ''}`, e);
    }
  }
  function mountPart(name: string, mount: (c: UICtx) => Part, into: HTMLElement): void {
    try { const part = mount(ctx) as ShellPart; into.appendChild(part.el); mounted.push({ name, part, strikes: {}, rest: {} }); }
    catch (e) { console.error(`[ui] part "${name}" failed to mount`, e); }
  }
  mountPart('pins', mountPins, worldLayer);
  mountPart('bubbles', mountBubbles, worldLayer);
  mountPart('hud', mountHud, slots.hud);
  mountPart('buildmenu', mountBuildmenu, slots.left);
  mountPart('inspector', mountInspector, slots.inspector);
  mountPart('heralds', mountHeralds, slots.heralds);
  mountPart('wordbar', mountWordbar, slots.word);
  mountPart('hints', mountHints, frameLayer);

  const makers: [ScreenName, (c: UICtx) => Screen][] = [
    ['title', createTitle], ['audience', createAudience], ['ledger', createLedger], ['council', createCouncil],
    ['charter', createCharter], ['gameover', createGameover], ['settings', createSettings], ['help', createHelp],
  ];
  for (const [name, make] of makers) {
    try { const s = make(ctx); screens.set(name, s); screenLayer.appendChild(s.el); }
    catch (e) { console.error(`[ui] screen "${name}" failed to build`, e); }
  }

  // ───────── the table: picks, tools ─────────
  function pickActor(actorId: Id): void {
    const st = ctx.state();
    const a = st.actors[actorId];
    if (!a) { select(null); return; }
    if (a.kind === 'staff' && a.refId) { select({ staffId: a.refId }); return; }
    if (a.kind === 'applicant' && a.refId) { select({ applicantId: a.refId }); return; }
    if (a.kind === 'petitioner') {
      for (const id in st.incidents) {
        const inc = st.incidents[id]!;
        if (inc.actorId === actorId && inc.state === 'open') { open('audience', inc.id); return; }
      }
      if (a.refId && st.tenants[a.refId]) { select({ tenantId: a.refId }); return; }
    }
    select(null);
  }
  function pickProp(prop: TableProp): void {
    if (prop === 'ledger' || prop === 'coffer') open('ledger');
    else if (prop === 'charter') open('charter');
    else if (prop === 'seal') open('council');
    else if (prop === 'bell') { shellApi.togglePause(); audio.sfx('bell', { volume: 0.7 }); }
    else if (prop === 'map_scroll') renderer.focus({ overview: true }, { ms: 800 });
  }
  const real = deps.renderer;
  real.on('pick', (hit, ev) => {
    if (disposed) return;
    fan('pick', hit, ev);
    if (ev.button !== 0 || veiled) return;
    hideHover();
    if (hit.kind === 'building') select({ buildingId: hit.buildingId });
    else if (hit.kind === 'townsperson') select({ tenantId: hit.tenantId });
    else if (hit.kind === 'actor') pickActor(hit.actorId);
    else if (hit.kind === 'prop') pickProp(hit.prop);
    else select(null);
  });
  real.on('hover', hit => { if (disposed) return; onHover(hit); fan('hover', hit); });
  real.on('place', (btype, x, y, rot) => { if (disposed) return; act({ type: 'place_building', btype, x, y, rot }); fan('place', btype, x, y, rot); });
  real.on('paint', (kind, tiles) => { if (disposed) return; if (tiles.length) act({ type: kind === 'road' ? 'place_road' : 'remove_road', tiles }); fan('paint', kind, tiles); });
  real.on('clear', (x, y) => { if (disposed) return; act({ type: 'clear_tile', x, y }); fan('clear', x, y); });
  real.on('demolish', buildingId => { if (disposed) return; act({ type: 'demolish', buildingId }); fan('demolish', buildingId); });
  real.on('cancel', () => {
    if (disposed) return;
    lastCancelAt = performance.now();
    if (tool.kind !== 'select') renderer.setTool({ kind: 'select' });
    fan('cancel');
  });

  // ───────── keys ─────────
  function summon(what: 'build' | 'word'): void {
    if (!root.dispatchEvent(new CustomEvent('ll:summon', { detail: what, cancelable: true }))) return;
    if (what === 'word') {
      slots.word.querySelector<HTMLElement>('textarea, input:not([type]), input[type="text"], input[type="search"], [contenteditable="true"]')?.focus();
      return;
    }
    const b = slots.left.querySelector<HTMLElement>('[data-hotkey="b" i], [data-key="b" i], [data-tool="build"], [data-act="build"], [aria-label^="Build" i], [title^="Build" i], [data-tip-h^="Build" i]')
      ?? slots.left.querySelector<HTMLElement>('button');
    b?.click();
  }
  function onEscape(): boolean {
    const now = performance.now();
    if (now - lastCancelAt < 150 || now - lastToolDownAt < 150) return true;   // this press already put a tool down (the renderer, or the part that armed it)
    const active = document.activeElement;
    if (isTextField(active) && root.contains(active)) {
      const typed = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.value : (active.textContent ?? '');
      active.blur();
      if (typed.trim()) return true;                              // a second press closes what is behind the words
    }
    if (openName) { if (canEscape(openName)) close(openName); return true; }
    if (tool.kind !== 'select') { cancelTool(true); return true; }
    for (const m of mounted) {
      let closed = false;
      guard(m, 'escape', () => { closed = !!m.part.escape?.(); });
      if (closed) return true;
    }
    if (selection) { select(null); return true; }
    return false;
  }
  function onKey(e: KeyboardEvent): void {
    if (disposed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key === 'Escape') { if (onEscape()) e.preventDefault(); return; }
    const active = document.activeElement;
    if (e.repeat || isTextField(active) || !deps.app.inGame()) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (openName) {
      if (SCREEN_KEYS[k] === openName) { close(openName); e.preventDefault(); }
      return;
    }
    const onButton = isPressable(active) && root.contains(active);
    if (k === ' ') { if (onButton) return; shellApi.togglePause(); audio.sfx('click', { volume: 0.5 }); }
    else if (k === '1') shellApi.setSpeed(1);
    else if (k === '2') shellApi.setSpeed(2);
    else if (k === '3') shellApi.setSpeed(4);
    else if (k === 'b') summon('build');
    else if (k === 't') summon('word');
    else if (k === 'Enter') { if (onButton) return; summon('word'); }
    else if (SCREEN_KEYS[k]) open(SCREEN_KEYS[k]);
    else return;
    e.preventDefault();
  }
  function onClick(e: MouseEvent): void {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('button, a, summary, [role="button"], input[type="checkbox"], input[type="radio"], .ll-btn, .ll-seal') : null;
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (performance.now() - lastClickSfx > 60) deps.audio.sfx('click', { volume: 0.45 });
    // a mouse click must not leave Space and Enter stuck on the button it pressed
    if (e.detail > 0 && document.activeElement === el && (frameLayer.contains(el) || worldLayer.contains(el))) el.blur();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('click', onClick);
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerout', onOut);
  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointercancel', onUp, true);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', hideTip);

  // ───────── the loop ─────────
  let slow = 0;
  function update(state: GameState, dt: number): void {
    if (disposed) return;
    const inGame = deps.app.inGame();
    if (!openName && !inGame) open('title');
    else if (openName === 'title' && inGame) close('title');
    tickClock();
    syncVeil();
    if (!veiled) for (const m of mounted) guard(m, 'update', () => m.part.update?.(state, dt));
    if (openName) {
      const name = openName, s = screens.get(name);
      if (s?.update) { try { s.update(state, dt); } catch (e) { console.error(`[ui] screen "${name}" threw in update`, e); } }
    }
    slow += dt;
    if (slow >= 0.3) {
      slow = 0;
      if (selection && !alive(selection, state)) select(null);
      if (tipFor && tipShown) {
        if (!tipFor.isConnected) hideTip();
        else { const now = tipFor.getAttribute('data-tip') ?? ''; if (now !== tipText) { tipText = now; (tipEl.lastChild as HTMLElement).textContent = now; } }
      }
    }
  }
  function handleEvents(events: SimEvent[], state: GameState): void {
    if (disposed || !events.length || !deps.app.inGame()) return;
    for (const ev of events) {
      if (ev.type === 'building_removed' && selection?.buildingId === ev.buildingId) select(null);
    }
    for (const m of mounted) guard(m, 'handleEvents', () => m.part.handleEvents?.(events, state));
    if (openName) {
      const name = openName, s = screens.get(name);
      if (s?.handleEvents) { try { s.handleEvents(events, state); } catch (e) { console.error(`[ui] screen "${name}" threw in handleEvents`, e); } }
    }
  }
  function rebind(sim: SimLike): void {
    if (disposed) return;
    generation++;
    if (openName) shut(openName);
    pauseHolds = 0; crawlHolds = 0; pausedBy = null; applied = null;
    cancelTool(true);
    ctx.sim = sim;
    selection = null;
    try { renderer.setSelection(null); } catch (e) { console.error('[ui] renderer.setSelection threw', e); }
    for (const m of mounted) { guard(m, 'reset', () => m.part.reset?.()); guard(m, 'onSelect', () => m.part.onSelect?.(null)); }
    hideTip(); hideHover(); hoverKey = '';
    for (const t of toasts.slice()) dropToast(t);
    tickClock(); syncVeil();
  }
  function dispose(): void {
    if (disposed) return;
    if (openName) shut(openName);
    disposed = true;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    root.removeEventListener('click', onClick);
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerout', onOut);
    root.removeEventListener('pointerdown', onDown, true);
    root.removeEventListener('pointerup', onUp, true);
    root.removeEventListener('pointercancel', onUp, true);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', hideTip);
    ro?.disconnect();
    window.clearTimeout(tipTimer); window.clearTimeout(hoverTimer);
    for (const t of toasts) window.clearTimeout(t.timer);
    toasts = [];
    for (const m of mounted) { const end = (m.part as { dispose?: () => void }).dispose; if (end) guard(m, 'dispose', () => end.call(m.part)); }
    for (const el of [worldLayer, frameLayer, screenLayer, toastBox, hoverEl, tipEl]) el.remove();
    if (!found) root.remove(); else { root.classList.remove('is-veiled', 'is-tooling'); clear(toastBox); }
  }

  syncVeil();
  return { update, handleEvents, open, close, rebind, dispose };
}
