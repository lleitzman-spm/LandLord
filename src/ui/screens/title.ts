/**
 * OWNER: ui-screens-a. The title screen, shown over the living table.
 *
 * Three views share this one Screen:
 *   'menu'     the logo leaf and its column of manuscript buttons
 *   'new'      the charter for a new reign (name, realm, mode, seal)
 *   'dynasty'  the Dynasty Hall: a wall of memorial plaques
 * `open(arg)` accepts one of those names; with no name it shows the menu, or
 * the view asked for with `requestTitleView` in the last few seconds (the end
 * of reign screen uses this to land on the charter or the hall).
 *
 * Also exports the small helpers the other screens of this set share.
 */
import type { Screen, UICtx, AppAPI, DynastyEntry, ScreenName } from '../api';
import type { Mode, RankId } from '../../sim/types';
import { RANK_ORDER } from '../../sim/types';
import { h, addStyle, clear, append } from '../kit';
import { SCREENS_A_CSS, ensureDefs, penInitial, penTail, waxSeal, dieSvg, MANICULE, EMBLEM_PEACE, EMBLEM_IRON, HOOK_SVG, hashStr } from '../css/screens-a';
import { doodle, flourish, crest } from '../marginalia';
import { REALM_NAMES, RANKS } from '../../data';

// ═════════════════════════ shared helpers (used by gameover, settings, help) ═════════════════════════

export const ALL_SCREENS: ScreenName[] = ['title', 'audience', 'ledger', 'council', 'charter', 'gameover', 'settings', 'help'];

export function anyScreenOpen(ctx: UICtx): boolean {
  return ALL_SCREENS.some(n => { try { return ctx.isOpen(n); } catch { return false; } });
}

/** A screen opened from the title has closed: bring the title back if nothing else took its place. */
export function backToTitleIfIdle(ctx: UICtx): void {
  setTimeout(() => { try { if (!ctx.app.inGame() && !anyScreenOpen(ctx)) ctx.open('title'); } catch { /* the shell is between states */ } }, 0);
}

/** Listen to keys on the window in the capture phase while a screen is open. Returns the remover. */
export function captureKeys(handler: (e: KeyboardEvent) => void): () => void {
  const fn = (e: KeyboardEvent) => handler(e);
  window.addEventListener('keydown', fn, true);
  return () => window.removeEventListener('keydown', fn, true);
}

/** Swallow a key so the shell's own handlers never see it. */
export function swallow(e: Event): void { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
}
/** Keep Tab inside the open screen. */
export function trapTab(e: KeyboardEvent, root: HTMLElement): void {
  if (e.key !== 'Tab') return;
  const list = focusables(root); if (!list.length) return;
  const first = list[0]!, last = list[list.length - 1]!, active = document.activeElement as HTMLElement | null;
  const inside = !!active && root.contains(active);
  if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
}
export function typingIn(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function rankId(r: string | null | undefined): RankId | null {
  if (!r) return null;
  const k = r.trim().toLowerCase();
  if ((RANK_ORDER as string[]).includes(k)) return k as RankId;
  for (const id of RANK_ORDER) if (RANKS[id].title.toLowerCase() === k) return id;
  return null;
}
export function rankTitle(r: string | null | undefined): string {
  const id = rankId(r); if (id) return RANKS[id].title;
  return r ? r[0]!.toUpperCase() + r.slice(1) : 'Reeve';
}
/** "Sir Luke", "Reeve Luke", "Baron Luke" */
export function styledRuler(rank: string | null | undefined, ruler: string): string {
  const id = rankId(rank);
  const name = ruler.trim() || 'the Nameless';
  if (id === 'knight') return 'Sir ' + name;
  return rankTitle(rank) + ' ' + name;
}
export function roman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '', v = Math.max(1, Math.floor(n));
  for (const [k, s] of map) while (v >= k) { out += s; v -= k; }
  return out;
}
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export function countWord(n: number): string { return n >= 0 && n < WORDS.length ? WORDS[n]! : String(n); }
/** "2 years, 4 months" from game days (360 a year). */
export function reignLength(days: number): string {
  const d = Math.max(0, Math.floor(days));
  const y = Math.floor(d / 360), m = Math.floor((d % 360) / 30);
  if (y === 0 && m === 0) return d === 1 ? 'a single day' : `${d} days`;
  const ys = y ? (y === 1 ? '1 year' : `${y} years`) : '';
  const ms = m ? (m === 1 ? '1 month' : `${m} months`) : '';
  return [ys, ms].filter(Boolean).join(', ');
}
/** Dynasty entries, newest first. Real dates sort exactly; otherwise the stored order is taken as oldest first. */
export function sortedDynasty(list: DynastyEntry[]): DynastyEntry[] {
  const withT = list.map((e, i) => ({ e, i, t: Date.parse(e.endedAt) }));
  if (withT.length && withT.every(x => !Number.isNaN(x.t))) return withT.sort((a, b) => b.t - a.t || b.i - a.i).map(x => x.e);
  return [...list].reverse();
}
/** Markup from an art function, or nothing when it returns nothing. */
export function art(html: string, cls: string, extra: Record<string, unknown> = {}): HTMLElement | null {
  return html && html.trim() ? h('span', { class: cls, html, ...extra }) : null;
}

// ═════════════════════════ save details for "Continue" ═════════════════════════

interface SaveInfo { realm: string; ruler: string; rank: string; mode: Mode | null }

/** Ask the app (if it offers `saveInfo`), else read the realm out of a stored save without loading it. */
function saveInfo(app: AppAPI): SaveInfo | null {
  const ext = app as AppAPI & { saveInfo?: () => SaveInfo | null };
  if (typeof ext.saveInfo === 'function') { try { const s = ext.saveInfo(); if (s) return s; } catch { /* fall back */ } }
  const found: SaveInfo[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k) continue;
      const v = localStorage.getItem(k);
      if (!v || v.length < 200 || v.charCodeAt(0) !== 123) continue;
      const m = /"realm"\s*:\s*\{([^{}]*)\}/.exec(v); if (!m) continue;
      const body = m[1]!;
      const name = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body)?.[1];
      const rank = /"rank"\s*:\s*"(\w+)"/.exec(body)?.[1];
      const ruler = /"ruler"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body)?.[1] ?? '';
      if (!name || !rank || /"ended"\s*:\s*\{/.test(v)) continue;
      const mode = /"mode"\s*:\s*"(peace|iron)"/.exec(v)?.[1] as Mode | undefined;
      const un = (s: string) => { try { return JSON.parse('"' + s + '"') as string; } catch { return s; } };
      found.push({ realm: un(name), ruler: un(ruler), rank, mode: mode ?? null });
    }
  } catch { /* storage unavailable */ }
  return found[0] ?? null;
}

// ═════════════════════════ the screen ═════════════════════════

export type TitleView = 'menu' | 'new' | 'dynasty';
let pendingView: { view: TitleView; until: number; mode: Mode | null } | null = null;
/** Ask the title to open on a given view the next time it opens (within a few seconds); `mode` preselects the charter's terms. */
export function requestTitleView(view: TitleView, mode?: Mode): void { pendingView = { view, until: Date.now() + 5000, mode: mode ?? null }; }
const isView = (v: unknown): v is TitleView => v === 'menu' || v === 'new' || v === 'dynasty';

const NAME_MAX = 24, REALM_MAX = 30;
const LAST_RULER_KEY = 'll.ui.lastRuler';
function cleanName(s: string, max: number): string {
  return s.replace(/[\u0000-\u001f\u007f<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function readLastRuler(): string { try { return localStorage.getItem(LAST_RULER_KEY) ?? ''; } catch { return ''; } }
function writeLastRuler(s: string): void { try { localStorage.setItem(LAST_RULER_KEY, s); } catch { /* fine */ } }

export function create(ctx: UICtx): Screen {
  addStyle('screens-a', SCREENS_A_CSS);
  ensureDefs();

  const el = h('div', { class: 'lla-root lla-title', hidden: true });
  const shade = h('div', { class: 'lla-shade', 'aria-hidden': 'true' });
  const leaf = h('div', { class: 'lla-leaf lla-sheet', role: 'navigation', 'aria-label': 'Title' });
  const pane = h('div', { class: 'lla-pane', hidden: true });
  el.append(shade, leaf, pane);

  let view: TitleView = 'menu';
  let presetMode: Mode | null = null;
  let releaseKeys: (() => void) | null = null;
  let sealing = false;

  const sfx = (id: Parameters<UICtx['audio']['sfx']>[0], v = .7) => { try { ctx.audio.sfx(id, { volume: v }); } catch { /* silent */ } };

  // ───────── the leaf: logo, tagline, menu, footer ─────────
  function buildLeaf(): void {
    clear(leaf);
    const info = ctx.app.hasSave() ? saveInfo(ctx.app) : null;
    const head = h('div', { class: 'lla-head' },
      h('div', { class: 'lla-logo' },
        h('span', { html: penInitial('L', 7), style: 'display:contents' }),
        h('h1', { class: 'lla-word lla-gold', 'aria-label': 'LandLord' }, 'andLord'),
        h('p', { class: 'lla-tagline' }, 'A kingdom is a great many rents.')),
      h('span', { html: penTail(3, 150), style: 'display:contents' }));
    const orn = art(flourish(300, 2), 'lla-orn', { 'aria-hidden': 'true' });

    const items: HTMLButtonElement[] = [];
    const item = (label: string, onClick: () => void, opts: { sub?: (Node | string)[]; primary?: boolean; hint?: string } = {}) => {
      const b = h('button', { type: 'button', class: 'lla-mi' + (opts.primary ? ' is-primary' : ''), title: opts.hint, onclick: () => onClick() },
        h('span', { class: 'lla-mi-mark', 'aria-hidden': 'true' }, h('span', { class: 'lla-pil' }, '¶'), h('span', { html: MANICULE, style: 'display:contents' })),
        h('span', { class: 'lla-mi-text' }, h('span', { class: 'lla-mi-label' }, label), opts.sub ? h('span', { class: 'lla-mi-sub' }, opts.sub) : null));
      items.push(b); return b;
    };
    if (ctx.app.hasSave()) {
      const sub: (Node | string)[] = info ? [`${info.realm}, ${rankTitle(info.rank)}`] : ['Your reign in progress'];
      if (info?.mode === 'iron') sub.push(h('span', { class: 'll-tag ll-tag-plain' }, 'Iron Crown'));
      item('Continue', doContinue, { sub, primary: true });
    }
    item('Begin a reign', () => show('new'), { primary: !ctx.app.hasSave() });
    item('Dynasty hall', () => show('dynasty'));
    item('Settings', () => ctx.open('settings'));
    item('How to rule', () => ctx.open('help'));

    const list = h('div', { class: 'lla-items', role: 'menu' }, items);
    for (const b of items) b.setAttribute('role', 'menuitem');
    list.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const n = items.length, next = e.key === 'ArrowDown' ? (i + 1 + n) % n : (i - 1 + n) % n;
      items[i < 0 ? 0 : next]!.focus(); e.preventDefault();
    });

    const d1 = art(doodle('snail_knight', 3, 64), 'lla-doodle');
    const d2 = art(doodle('goose_bishop', 5, 64), 'lla-doodle flip');
    const footText = h('p', null, 'Saved in this browser only. The Crown keeps no copies.');
    const foot = h('div', { class: 'lla-foot' + (d1 || d2 ? '' : ' lla-foot-solo') }, d1 ? d1 : (d2 ? h('span') : null), footText, d2 ?? (d1 ? h('span') : null));
    const menu = h('div', { class: 'lla-menu' }, list, foot);
    append(leaf, [h('div', { class: 'lla-rules', 'aria-hidden': 'true' }), head, orn, menu]);
  }

  function doContinue(): void {
    let ok = false;
    try { ok = ctx.app.continueGame(); } catch { ok = false; }
    if (!ok) { ctx.toast('The saved reign could not be read. The clerk is very sorry.', 'bad'); buildLeaf(); focusFirst(); return; }
    if (ctx.isOpen('title')) ctx.close('title');
  }

  // ───────── the charter: begin a reign ─────────
  function buildCharter(): void {
    clear(pane);
    const dyn = sortedDynasty(safeDynasty());
    const info = ctx.app.hasSave() ? saveInfo(ctx.app) : null;
    let mode: Mode = 'peace';
    let face = 5;

    const name = h('input', { class: 'lla-blank', type: 'text', maxLength: NAME_MAX, placeholder: 'your name', autocomplete: 'off', spellcheck: false, 'aria-label': 'Your name' });
    name.value = readLastRuler() || (dyn[0]?.ruler ?? '');
    const realm = h('input', { class: 'lla-blank lla-wide', type: 'text', maxLength: REALM_MAX, placeholder: 'a realm', autocomplete: 'off', spellcheck: false, 'aria-label': 'The realm’s name' });
    realm.value = pickRealm('');
    const die = h('button', { type: 'button', class: 'lla-die', title: 'Roll another name', 'aria-label': 'Roll another name for the realm', html: dieSvg(face) });
    die.addEventListener('click', () => {
      realm.value = pickRealm(realm.value);
      face = 1 + ((face + 1 + Math.floor(Math.random() * 4)) % 6);
      die.innerHTML = dieSvg(face);
      die.classList.remove('is-rolling'); void die.offsetWidth; die.classList.add('is-rolling');
      sfx('pluck', .5);
    });
    const want = h('p', { class: 'lla-want', 'aria-live': 'polite' });
    name.addEventListener('input', () => { if (name.value.trim()) { name.classList.remove('is-wanting'); want.textContent = ''; } });

    const grant = h('p', { class: 'lla-grant' },
      h('span', { html: penInitial('B', 19, { sprays: false }), style: 'display:contents' }),
      h('span', { class: 'lla-lead' }, 'e it known to all'), ' that the Crown grants unto ', name, ' the hamlet of ', h('span', { class: 'lla-realmfield' }, realm, die),
      ', with three hovels, some mud, and the right to collect what rent can be got, upon the terms here chosen.');

    // the two facing cards
    const ironHeir = dyn.find(e => e.mode === 'iron' && e.heirloom)?.heirloom ?? null;
    const card = (m: Mode) => {
      const iron = m === 'iron';
      const b = h('button', { type: 'button', class: 'lla-term' + (iron ? ' is-iron' : ''), role: 'radio', 'aria-checked': String(mode === m), tabindex: mode === m ? 0 : -1 },
        h('span', { class: 'lla-chosen', html: waxSeal({ seed: iron ? 31 : 17, emblem: 'check' }) }),
        h('span', { class: 'lla-term-head' }, h('span', { html: iron ? EMBLEM_IRON : EMBLEM_PEACE, style: 'display:contents' }), h('span', { class: 'lla-term-name' }, iron ? 'Iron Crown' : 'Steward’s Peace')),
        h('p', { class: 'lla-term-line' }, iron ? 'One reign. One save. When the coffers fail, so do you. Your heir inherits one heirloom.' : 'The moneylender is patient. A bad year is a setback.'),
        h('ul', null, iron
          ? [h('li', null, 'Ruin or a revoked charter ends the reign.'), h('li', null, 'Each reign is carved in the Dynasty Hall.')]
          : [h('li', null, 'Empty coffers borrow, at interest.'), h('li', null, 'At worst the Crown takes back a rank.')]),
        iron && ironHeir ? h('p', { class: 'lla-term-heir' }, 'Waiting for your heir: ' + ironHeir + '.') : null);
      b.addEventListener('click', () => choose(m));
      return b;
    };
    const cards = { peace: card('peace'), iron: card('iron') };
    const terms = h('div', { class: 'lla-terms', role: 'radiogroup', 'aria-label': 'The terms of the reign' }, cards.peace, cards.iron);
    terms.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); choose(mode === 'peace' ? 'iron' : 'peace'); cards[mode].focus();
    });
    const replace = h('span', { class: 'lla-replace' });
    function choose(m: Mode): void {
      if (m !== mode) sfx('stamp', .35);
      mode = m;
      for (const k of ['peace', 'iron'] as Mode[]) { cards[k].setAttribute('aria-checked', String(k === m)); cards[k].tabIndex = k === m ? 0 : -1; }
      replace.textContent = info && info.mode === m ? `Sealing this replaces your reign in ${info.realm}.`
        : ctx.app.hasSave() && (!info || !info.mode) ? 'If a reign of this kind is in progress, this charter replaces it.' : '';
    }
    choose(presetMode ?? 'peace');
    presetMode = null;

    const seal = h('button', { type: 'button', class: 'lla-sealbtn', 'aria-label': 'Seal the charter and begin', html: waxSeal({ seed: 9, emblem: 'crown' }) }, 'Seal it');
    seal.addEventListener('click', () => doSeal());
    const witness = h('p', { class: 'lla-witness' }, 'Given under the Great Seal on the 1st of Thawmonth, Year 1.', replace);
    const doc = h('form', { class: 'lla-charter lla-sheet', 'aria-label': 'A charter for a new reign', onsubmit: (e: Event) => { e.preventDefault(); doSeal(); } },
      h('div', { class: 'lla-rules', 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'll-seal lla-close', title: 'Back', 'aria-label': 'Back to the title', onclick: () => show('menu') }, '✕'),
      h('p', { class: 'lla-kicker' }, 'A charter of the Crown'),
      grant, want,
      h('p', { class: 'lla-terms-h' }, 'The terms'),
      terms,
      h('div', { class: 'lla-charter-foot' }, witness, seal),
      h('div', { class: 'lla-back' }, h('button', { type: 'button', class: 'll-btn ll-btn-quiet', onclick: () => show('menu') }, 'Back to the title')));
    for (const inp of [name, realm]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSeal(); } });
    pane.append(doc);

    function doSeal(): void {
      if (sealing) return;
      const ruler = cleanName(name.value, NAME_MAX);
      if (!ruler) {
        name.classList.add('is-wanting'); want.textContent = 'The Crown requires a name. Any name will do.';
        doc.classList.remove('is-shake'); void doc.offsetWidth; doc.classList.add('is-shake');
        sfx('error', .4); name.focus(); return;
      }
      const realmName = cleanName(realm.value, REALM_MAX) || pickRealm('');
      name.value = ruler; realm.value = realmName;
      sealing = true; seal.disabled = true; name.disabled = true; realm.disabled = true;
      seal.classList.add('is-sealing'); sfx('stamp', .9);
      writeLastRuler(ruler);
      setTimeout(() => {
        sealing = false;
        try { ctx.app.newGame({ ruler, realm: realmName, mode }); }
        catch { ctx.toast('The charter would not take. Try sealing it again.', 'bad'); seal.disabled = false; name.disabled = false; realm.disabled = false; seal.classList.remove('is-sealing'); return; }
        if (ctx.isOpen('title')) ctx.close('title');
      }, 640);
    }
  }

  // ───────── the Dynasty Hall ─────────
  function buildHall(): void {
    clear(pane);
    const list = sortedDynasty(safeDynasty());
    const total = list.length;
    const wall = total
      ? h('div', { class: 'lla-wall', role: 'list' }, list.map((e, i) => plaque(e, total - i)))
      : h('div', { class: 'lla-empty' }, h('span', { html: HOOK_SVG, style: 'display:contents' }), h('p', null, 'The hall is bare. The mason has put up a hook, in hope.'));
    const hall = h('section', { class: 'lla-hall', 'aria-label': 'The Dynasty Hall' },
      h('button', { type: 'button', class: 'll-seal lla-close', title: 'Back', 'aria-label': 'Back to the title', onclick: () => show('menu') }, '✕'),
      h('div', { class: 'lla-hall-head' },
        h('h2', { class: 'lla-hall-title lla-gold' }, 'The Dynasty Hall'),
        h('p', { class: 'lla-hall-sub' }, 'Every reign that ended, and how it ended.')),
      wall,
      h('div', { class: 'lla-hall-foot' },
        h('span', { class: 'lla-hall-count' }, total ? `${cap1(countWord(total))} ${total === 1 ? 'reign' : 'reigns'} remembered` : ''),
        h('button', { type: 'button', class: 'll-btn ll-btn-quiet', onclick: () => show('menu') }, 'Back to the title')));
    pane.append(hall);
  }

  function plaque(e: DynastyEntry, n: number): HTMLElement {
    const iron = e.mode === 'iron';
    const crestHtml = crest(hashStr(e.ruler + '|' + e.realm), 40);
    const yrs = e.years;
    const yearsV = yrs < .5 ? String(Math.max(1, Math.round(yrs * 12))) : Math.floor(yrs) + (yrs % 1 >= .5 ? '½' : '');
    const yearsK = yrs < .5 ? (Math.round(yrs * 12) <= 1 ? 'month' : 'months') : (yrs < 1.5 && yrs % 1 < .5 ? 'year' : 'years');
    const ended = Number.isNaN(Date.parse(e.endedAt)) ? e.endedAt : '';
    const title = Number.isNaN(Date.parse(e.endedAt)) ? undefined : 'Recorded ' + new Date(e.endedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return h('article', { class: 'lla-plaque' + (iron ? ' is-iron' : ''), role: 'listitem', tabindex: 0, title },
      h('i', { class: 'lla-screw lla-screw-l', 'aria-hidden': 'true' }), h('i', { class: 'lla-screw lla-screw-r', 'aria-hidden': 'true' }),
      h('div', { class: 'lla-plaque-top' }, h('span', null, 'Reign ' + roman(n)), h('span', null, iron ? 'Iron Crown' : 'Steward’s Peace')),
      art(crestHtml, 'lla-plaque-crest', { 'aria-hidden': 'true' }),
      h('h3', { class: 'lla-plaque-name' }, styledRuler(e.rank, e.ruler)),
      h('div', { class: 'lla-plaque-realm' }, `${rankTitle(e.rank)} of ${e.realm}`),
      h('div', { class: 'lla-plaque-stats' },
        h('div', null, h('b', null, yearsV), h('span', null, yearsK)),
        h('div', null, h('b', null, String(e.households)), h('span', null, e.households === 1 ? 'household' : 'households')),
        h('div', null, h('b', null, e.peakRentRoll.toLocaleString('en-US')), h('span', null, 'best rent roll'))),
      e.epitaph ? h('p', { class: 'lla-plaque-epitaph' }, '“' + e.epitaph + '”') : null,
      e.heirloom ? h('p', { class: 'lla-plaque-heir' }, h('b', null, 'To the heir'), e.heirloom) : null,
      ended ? h('p', { class: 'lla-plaque-end' }, ended) : null);
  }

  // ───────── views ─────────
  function show(v: TitleView, quiet = false): void {
    const was = view; view = v;
    if (v === 'menu') { pane.hidden = true; clear(pane); buildLeaf(); leaf.hidden = false; shade.hidden = false; }
    else { leaf.hidden = true; shade.hidden = true; if (v === 'new') buildCharter(); else buildHall(); pane.hidden = false; pane.scrollTop = 0; }
    if (was !== v && !quiet) sfx('page', .45);
    focusFirst();
  }
  function focusFirst(): void {
    requestAnimationFrame(() => {
      if (el.hidden) return;
      // on touch screens, do not summon the keyboard just by opening the charter
      const touch = matchMedia('(pointer: coarse)').matches;
      const target = view === 'menu' ? leaf.querySelector<HTMLElement>('.lla-mi')
        : view === 'new' ? (touch ? null : pane.querySelector<HTMLInputElement>('.lla-blank')) : pane.querySelector<HTMLElement>('.lla-plaque, .lla-hall-foot .ll-btn');
      target?.focus({ preventScroll: view !== 'menu' });
    });
  }

  function onKey(e: KeyboardEvent): void {
    if (el.hidden) return;
    if (e.key === 'Escape') {
      swallow(e);
      if (view !== 'menu') show('menu');
      return;
    }
    if (view !== 'menu') trapTab(e, pane);
  }

  function safeDynasty(): DynastyEntry[] { try { return ctx.app.dynasty() ?? []; } catch { return []; } }

  return {
    el,
    pauses: false,
    open(arg?: unknown) {
      const pend = pendingView && pendingView.until > Date.now() ? pendingView : null;
      const asked = isView(arg) ? arg : pend ? pend.view : null;
      presetMode = pend?.mode ?? null;
      pendingView = null;
      releaseKeys?.(); releaseKeys = captureKeys(onKey);
      // opened again while already showing, with nothing new asked: leave the player's half-filled charter alone
      if (!el.hidden && !asked) return;
      el.hidden = false;
      view = asked === 'menu' || !asked ? 'new' : 'menu'; // so show() always rebuilds the chosen view
      show(asked ?? 'menu', true);
    },
    close() {
      el.hidden = true;
      releaseKeys?.(); releaseKeys = null;
      clear(pane);
    },
  };
}

function pickRealm(current: string): string {
  const pool = REALM_NAMES.length ? REALM_NAMES : ['Mudlark Hollow'];
  if (pool.length === 1) return pool[0]!;
  let next = current;
  for (let i = 0; i < 8 && next === current; i++) next = pool[Math.floor(Math.random() * pool.length)]!;
  return next;
}
function cap1(s: string): string { return s ? s[0]!.toUpperCase() + s.slice(1) : s; }
