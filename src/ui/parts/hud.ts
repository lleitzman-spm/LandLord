/**
 * OWNER: ui-shell agent. The HUD plaque: whose realm this is, what day it is,
 * how fast the world turns, and the five numbers that matter. Under 700px it
 * folds into one row across the top; touching the row unfolds the plaque.
 */
import { RANK_ORDER, type GameState, type SimEvent, type Speed, type Season } from '../../sim/types';
import { dateOf, fmtDate, ordinal } from '../../sim/core';
import { RANKS, BAL, MONTH_NAMES, RANK_TITLES, REALM_NOUNS } from '../../data';
import type { IconId } from '../../data/ids';
import type { UICtx } from '../api';
import type { Part } from './part';
import type { ShellCtx, ShellPart } from '../index';
import { h, clear, fromHTML, setText, setClass, setAttr, num, signed, crowns, plural } from '../kit';
import { iconSvg } from '../icons';
import { crest } from '../marginalia';

const icon = (id: IconId): HTMLElement => fromHTML(iconSvg(id));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (a: number, b: number, v: number): number => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): string => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

/** the sky over the month: dawn on Rent Day, a long gold afternoon, dusk near 0.75, a short night */
const SKY: [number, RGB][] = [
  [0, [236, 190, 150]], [0.07, [229, 211, 168]], [0.3, [176, 203, 211]], [0.56, [231, 203, 132]], [0.72, [208, 132, 106]],
  [0.8, [88, 86, 136]], [0.88, [31, 43, 80]], [0.95, [40, 50, 92]], [0.985, [150, 112, 132]], [1, [236, 190, 150]],
];
const LAND: Record<Season, RGB> = { spring: [108, 124, 64], summer: [92, 108, 58], autumn: [140, 104, 52], winter: [214, 218, 206] };
const NIGHT_LAND: RGB = [22, 27, 44];
const SEASON_ICON: Record<Season, IconId> = { spring: 'flower', summer: 'sun', autumn: 'leaf', winter: 'snow' };
const SEASON_WORD: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
const WEATHER_WORD: Record<GameState['weather'], string> = {
  clear: 'The sky is clear.', rain: 'It is raining.', storm: 'There is a storm.', snow: 'It is snowing.',
  heat: 'It is hot enough to regret thatch.', fog: 'There is fog.', hail: 'It is hailing.',
};

let dialSeq = 0;
/** The month as a small wheel: the hand goes round once, Rent Day (the gold coin) is at the top, and the sun and moon cross the sky inside. */
function makeDial(): { el: HTMLElement; set(phase: number, season: Season): void } {
  const id = 'll-dial-' + (++dialSeq);
  let ticks = '';
  for (let i = 1; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 - Math.PI / 2;
    const r1 = i % 5 === 0 ? 22.4 : 23.8;
    ticks += `<line x1="${(29 + Math.cos(a) * r1).toFixed(2)}" y1="${(29 + Math.sin(a) * r1).toFixed(2)}" x2="${(29 + Math.cos(a) * 26.2).toFixed(2)}" y2="${(29 + Math.sin(a) * 26.2).toFixed(2)}"/>`;
  }
  const el = h('span', { class: 'll-dial', html: `<svg viewBox="0 0 58 58" aria-hidden="true">
<defs><clipPath id="${id}"><circle cx="29" cy="29" r="19.6"/></clipPath></defs>
<circle cx="29" cy="29" r="28.3" fill="#e9dab3" stroke="#8a745a"/>
<g stroke="#5a4633" stroke-width="1" stroke-linecap="round" opacity=".8">${ticks}</g>
<circle cx="29" cy="4.4" r="2.7" fill="#e3c05a" stroke="#7a5e12" stroke-width=".9"/>
<g clip-path="url(#${id})">
<rect class="sky" x="9" y="9" width="40" height="40" fill="#b0cbd3"/>
<g class="stars" fill="#f6ecd0" opacity="0"><circle cx="17" cy="19" r=".9"/><circle cx="33" cy="14" r=".7"/><circle cx="41" cy="23" r=".9"/><circle cx="25" cy="26" r=".6"/><circle cx="13" cy="29" r=".6"/><circle cx="37" cy="31" r=".5"/></g>
<g class="sun"><circle r="7.6" fill="#f6e2a0" opacity=".4"/><circle r="4.7" fill="#f0c245" stroke="#b5761f" stroke-width=".9"/></g>
<g class="moon" transform="translate(29 70)"><path d="M2.4-4.6a5.1 5.1 0 1 0 0 9.2a6.2 6.2 0 0 1 0-9.2z" fill="#f6ecd0" stroke="#b8a878" stroke-width=".6"/></g>
<path class="land" d="M8 40q7-5.6 14-2.2q4-3.4 9-1.6q6-3.6 19 .8v14H8z" fill="#5c6c3a"/>
<path d="M23.9 37.7v-3.3l2.9-2.5l2.9 2.5v3.6z" fill="#2a1d14"/>
<rect class="lamp" x="26.1" y="34.9" width="1.4" height="1.6" fill="#ffd77a" opacity="0"/>
</g>
<circle cx="29" cy="29" r="19.6" fill="none" stroke="#7a5e12" stroke-width="1.7"/>
<circle cx="29" cy="29" r="20.9" fill="none" stroke="#e3c05a" stroke-width=".8"/>
<g class="hand"><path d="M29 8.6l-3-6h6z" fill="#9e2b25" stroke="#5e1512" stroke-width=".8" stroke-linejoin="round"/></g>
</svg>` });
  const q = (sel: string): SVGElement => el.querySelector(sel) as SVGElement;
  const sky = q('.sky'), stars = q('.stars'), sun = q('.sun'), moon = q('.moon'), land = q('.land'), lamp = q('.lamp'), hand = q('.hand');
  let last = -1, lastSeason: Season | null = null;
  return {
    el,
    set(phase, season) {
      const p = Math.max(0, Math.min(0.9999, phase));
      if (Math.abs(p - last) < 0.0012 && season === lastSeason) return;
      last = p; lastSeason = season;
      let i = 1; while (i < SKY.length - 1 && SKY[i]![0] < p) i++;
      const a = SKY[i - 1]!, b = SKY[i]!;
      sky.setAttribute('fill', mix(a[1], b[1], (p - a[0]) / (b[0] - a[0])));
      const night = smooth(0.76, 0.87, p) * (1 - smooth(0.955, 1, p));
      stars.setAttribute('opacity', night.toFixed(2));
      lamp.setAttribute('opacity', night.toFixed(2));
      land.setAttribute('fill', mix(LAND[season], NIGHT_LAND, night * 0.82));
      if (p < 0.79) { const t = p / 0.78; sun.setAttribute('transform', `translate(${(29 - 16 * Math.cos(Math.PI * t)).toFixed(1)} ${(39.5 - 21 * Math.sin(Math.PI * Math.min(1, t))).toFixed(1)})`); }
      else sun.setAttribute('transform', 'translate(29 70)');
      if (p > 0.755) { const t = (p - 0.76) / 0.24; moon.setAttribute('transform', `translate(${(29 - 14 * Math.cos(Math.PI * t)).toFixed(1)} ${(39.5 - 19.5 * Math.sin(Math.PI * Math.max(0, t))).toFixed(1)})`); }
      else moon.setAttribute('transform', 'translate(29 70)');
      hand.setAttribute('transform', `rotate(${(p * 360).toFixed(1)} 29 29)`);
    },
  };
}

const still = window.matchMedia('(prefers-reduced-motion: reduce)');
function flash(el: HTMLElement, up: boolean): void {
  if (still.matches || typeof el.animate !== 'function') return;
  el.animate([{ color: up ? '#8a6a10' : '#a3331f', textShadow: up ? '0 0 9px rgba(227,192,90,.95)' : '0 0 9px rgba(163,51,31,.5)' }, {}], { duration: 950, easing: 'ease-out' });
}
/** a number that counts toward its new value instead of jumping, and flashes when it moves */
class Ticker {
  private shown = 0; private target = 0; private live = false;
  constructor(private els: HTMLElement[], private fmt: (n: number) => string = num) {}
  set(v: number): void {
    if (!this.live) { this.live = true; this.shown = this.target = v; this.paint(); return; }
    if (v === this.target) return;
    const up = v > this.target;
    this.target = v;
    for (const el of this.els) flash(el, up);
  }
  step(dt: number): void {
    if (this.shown === this.target) return;
    const gap = this.target - this.shown;
    this.shown = Math.abs(gap) < 0.6 ? this.target : this.shown + gap * Math.min(1, dt * 8);
    this.paint();
  }
  snap(): void { this.live = false; }
  private paint(): void { const t = this.fmt(Math.round(this.shown)); for (const el of this.els) setText(el, t); }
}

function crestMarkup(seed: number): string {
  let art = '';
  try { art = crest(seed, 48); } catch (e) { console.error('[hud] the crest would not draw', e); }
  if (art) return art;
  const field = ['#9e2b25', '#2f4a7a', '#4f7a5a', '#3a2a1c'][Math.abs(seed) % 4]!;   // a plain shield until the heralds paint a better one
  return `<svg viewBox="0 0 42 50" aria-hidden="true"><path d="M3 3h36v22c0 11-8 18-18 22C11 43 3 36 3 25z" fill="${field}" stroke="#2a1d14" stroke-width="1.6" stroke-linejoin="round"/><path d="M3.8 15h34.4" stroke="#e3c05a" stroke-width="5"/><circle cx="21" cy="31" r="5" fill="#e3c05a" stroke="#7a5e12"/></svg>`;
}
const rulerStyle = (s: GameState): string => `${s.realm.rank === 'knight' ? 'Sir' : RANK_TITLES[s.realm.rank]} ${s.realm.ruler}`;
function renownWord(v: number): string {
  return v >= 80 ? 'spoken of warmly' : v >= 60 ? 'well regarded' : v >= 40 ? 'tolerated' : v >= 20 ? 'muttered about at the well' : 'used to frighten children';
}
function favourWord(v: number): string {
  return v >= 80 ? 'The Crown is pleased, which is rare.' : v >= 55 ? 'The Crown has no complaint.' : v >= 30 ? 'The Crown has begun to frown.' : 'The Crown is drafting a letter.';
}

const SPEEDS: { speed: Speed; icon: IconId; head: string; tip: string }[] = [
  { speed: 0, icon: 'pause', head: 'Stop the clock', tip: 'Key: Space. Nothing ages, nothing leaks.' },
  { speed: 1, icon: 'play', head: 'Ordinary time', tip: 'Key: 1. A month in a minute and a half.' },
  { speed: 2, icon: 'fast', head: 'Double time', tip: 'Key: 2.' },
  { speed: 4, icon: 'faster', head: 'Fourfold time', tip: 'Key: 3. For quiet months.' },
];

export function mount(ctx: UICtx): Part {
  const shell = (ctx as Partial<ShellCtx>).shell;
  const setSpeed = (sp: Speed): void => { if (shell) shell.setSpeed(sp); else ctx.act({ type: 'set_speed', speed: sp }); };

  // ── the condensed row (phones)
  const barDial = makeDial();
  const barDate = h('span', { class: 'll-hud-bar-date' });
  const barGold = h('span', { class: 'll-fig-n' });
  const barHouse = h('span', { class: 'll-fig-n' });
  const barGoldFig = h('span', { class: 'll-fig ll-fig-coin' }, icon('coin'), barGold);
  const barSeal = h('button', { class: 'll-seal', type: 'button', 'aria-label': 'Stop or start the clock' });
  const bar = h('div', { class: 'll-hud-bar ll-parch', role: 'button', tabindex: '0', 'aria-expanded': 'false', 'aria-label': 'The realm at a glance. Open for the full account.' },
    barDial.el, barDate, barGoldFig, h('span', { class: 'll-fig ll-fig-house' }, icon('house'), barHouse), barSeal);

  // ── the plaque
  const crestEl = h('div', { class: 'll-hud-crest' });
  const realmEl = h('div', { class: 'll-hud-realm' });
  const rulerName = h('span');
  const ironEl = h('span', { hidden: true, dataset: { tipH: 'Iron Crown', tip: 'One reign. One save. When the coffers fail, so do you.' } }, icon('crown'));
  const seasonEl = h('span');
  const dateText = h('span');
  const rentEl = h('div', { class: 'll-hud-rent' });
  const dial = makeDial();
  const head = h('div', { class: 'll-hud-head' }, crestEl,
    h('div', { class: 'll-hud-names' }, realmEl, h('div', { class: 'll-hud-ruler' }, rulerName, ironEl), h('div', { class: 'll-hud-date' }, seasonEl, dateText), rentEl),
    dial.el);

  // each figure: the number with its icon, and a line beneath saying what kind of number it is
  const goldN = h('span', { class: 'll-fig-n' });
  const goldS = h('span', { class: 'll-fig-s' });
  const owedEl = h('span', { class: 'll-fig-owed' }, icon('chain'));
  const figGold = h('div', { class: 'll-fig ll-fig-coin', dataset: { tipH: 'Coffers' } }, h('span', { class: 'll-fig-top' }, icon('coin'), goldN, owedEl), goldS);
  const rollN = h('span', { class: 'll-fig-n' });
  const figRoll = h('div', { class: 'll-fig', dataset: { tipH: 'Rent roll' } }, h('span', { class: 'll-fig-top' }, icon('scroll'), rollN), h('span', { class: 'll-fig-s' }, 'rent a month'));
  const houseN = h('span', { class: 'll-fig-n' });
  const houseS = h('span', { class: 'll-fig-s' });
  const figHouse = h('div', { class: 'll-fig', dataset: { tipH: 'Households' } }, h('span', { class: 'll-fig-top' }, icon('house'), houseN), houseS);

  const mkMeter = (label: string, tipH: string): { row: HTMLElement; bar: HTMLElement; fill: HTMLElement; val: HTMLElement } => {
    const fill = h('i');
    const mbar = h('div', { class: 'll-meter ll-meter-good', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': tipH }, fill);
    const val = h('span', { class: 'll-hud-meter-v' });
    return { row: h('div', { class: 'll-hud-meter', dataset: { tipH } }, h('span', { class: 'll-hud-meter-k' }, label), mbar, val), bar: mbar, fill, val };
  };
  const renown = mkMeter('Renown', 'Renown');
  const favour = mkMeter('Favour', 'Crown favour');

  const speedBtns = SPEEDS.map(sp => h('button', {
    class: 'll-seal', type: 'button', 'aria-label': sp.head, dataset: { tipH: sp.head, tip: sp.tip },
    onclick: () => setSpeed(sp.speed),
  }, icon(sp.icon)));
  const stateEl = h('span', { class: 'll-hud-state', 'aria-live': 'polite' });
  const pipsEl = h('span', { class: 'll-row', style: 'gap:4px;flex-wrap:nowrap' });
  const charterBtn = h('button', { class: 'll-hud-charter', type: 'button', 'aria-label': 'Open the charter', dataset: { tipH: 'The charter' }, onclick: () => ctx.open('charter') }, icon('scroll'), pipsEl);
  const gearBtn = h('button', { class: 'll-hud-gear', type: 'button', 'aria-label': 'Settings', dataset: { tipH: 'Settings' }, onclick: () => ctx.open('settings') }, icon('gear'));
  const plaque = h('div', { class: 'll-plaque ll-parch' },
    head,
    h('hr', { class: 'll-rule' }),
    h('div', { class: 'll-hud-figs' }, figGold, figRoll, figHouse),
    h('div', { class: 'll-hud-meters' }, renown.row, favour.row),
    h('hr', { class: 'll-rule' }),
    h('div', { class: 'll-hud-band' }, h('div', { class: 'll-hud-speeds', role: 'group', 'aria-label': 'The speed of the world' }, speedBtns), stateEl, charterBtn, gearBtn));

  // ── ribbon tags
  const collectLabel = h('span');
  const collectTag = h('button', { class: 'll-hud-tag', type: 'button', hidden: true, dataset: { tipH: 'Collect the purses' }, onclick: () => { ctx.act({ type: 'collect_all' }); } },
    h('span', { class: 'll-seal is-on' }, icon('purse')), collectLabel);
  const crownTag = h('button', { class: 'll-hud-tag is-crown', type: 'button', hidden: true, dataset: { tipH: 'The charter is met', tip: 'Every goal is done. Hear the herald and take what is yours.' }, onclick: () => ctx.open('charter') },
    h('span', { class: 'll-seal is-on' }, icon('crown')), h('span', null, 'The Crown’s herald awaits'));
  const tags = h('div', { class: 'll-hud-tags' }, crownTag, collectTag);

  const el = h('div', { class: 'll-hud' }, bar, plaque, tags);

  // ── phones: fold and unfold
  let isOpen = false;
  function setOpen(on: boolean): void {
    if (on === isOpen) return;
    isOpen = on;
    setClass(el, 'is-open', on);
    bar.setAttribute('aria-expanded', String(on));
    if (on) document.addEventListener('pointerdown', onOutside, true); else document.removeEventListener('pointerdown', onOutside, true);
  }
  function onOutside(e: Event): void { if (!(e.target instanceof Node && el.contains(e.target))) setOpen(false); }
  bar.addEventListener('click', e => { if (!(e.target instanceof Node && barSeal.contains(e.target))) setOpen(!isOpen); });
  bar.addEventListener('keydown', e => { if (e.target === bar && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(!isOpen); } });
  barSeal.addEventListener('click', () => { if (shell) shell.togglePause(); else setSpeed(ctx.state().speed === 0 ? 1 : 0); });

  // ── live
  const tGold = new Ticker([goldN, barGold], n => (n < 0 ? '−' + num(-n) : num(n)));
  const tRoll = new Ticker([rollN]);
  const tHouse = new Ticker([houseN, barHouse]);
  const tRenown = new Ticker([renown.val]);
  const tFavour = new Ticker([favour.val]);
  const tickers = [tGold, tRoll, tHouse, tRenown, tFavour];
  let lastState: GameState | null = null;
  let slow = 1, visible = true;
  let crestSeed: number | null = null, lastSeason: Season | null = null, lastBarIcon: IconId | null = null;
  let pipCount = -1, pipRank = '', tagCount = -1;

  function setMeter(m: { bar: HTMLElement; fill: HTMLElement }, v: number, kind: string): void {
    const pct = Math.max(0, Math.min(100, v));
    const w = pct.toFixed(0) + '%';
    if (m.fill.style.width !== w) m.fill.style.width = w;
    const cls = 'll-meter ll-meter-' + kind;
    if (m.bar.className !== cls) m.bar.className = cls;
    setAttr(m.bar, 'aria-valuenow', pct.toFixed(0));
  }

  function clock(s: GameState): void {
    const d = dateOf(s.day);
    dial.set(d.monthPhase, d.season); barDial.set(d.monthPhase, d.season);
    const user = shell ? shell.userSpeed() : (s.speed === 0.1 ? 1 : s.speed);
    SPEEDS.forEach((sp, i) => setClass(speedBtns[i]!, 'is-on', sp.speed === user));
    setText(stateEl, s.speed === 0.1 ? 'crawl' : s.speed === 0 ? 'stopped' : '');
    const want: IconId = user === 0 ? 'play' : 'pause';
    if (want !== lastBarIcon) { lastBarIcon = want; clear(barSeal); barSeal.appendChild(icon(want)); setClass(barSeal, 'is-on', user === 0); }
  }

  function derive(s: GameState): void {
    const d = dateOf(s.day);
    const rank = s.realm.rank, def = RANKS[rank];

    // who and when
    if (crestSeed !== s.realm.crest) { crestSeed = s.realm.crest; clear(crestEl); const art = fromHTML(crestMarkup(s.realm.crest)); if (art) crestEl.appendChild(art); }
    setText(realmEl, s.realm.name);
    setText(rulerName, rulerStyle(s));
    ironEl.hidden = s.mode !== 'iron';
    setAttr(crestEl, 'data-tip-h', s.realm.name);
    setAttr(crestEl, 'data-tip', `${rulerStyle(s)}, ${RANK_TITLES[rank]} of the ${REALM_NOUNS[rank]} of ${s.realm.name}.`
      + (s.realm.reign > 1 ? ` The ${ordinal(s.realm.reign)} of the line.` : '')
      + (s.realm.heirloom ? ` Heirloom: ${s.realm.heirloom}.` : ''));
    if (lastSeason !== d.season) { lastSeason = d.season; clear(seasonEl); seasonEl.appendChild(icon(SEASON_ICON[d.season])); }
    const date = fmtDate(s.day);
    setText(dateText, date);
    setText(barDate, `${ordinal(d.dom)} ${MONTH_NAMES[d.month]}`);
    const toRent = 31 - d.dom;
    setText(rentEl, d.dom === 1 ? 'Rent Day' : toRent === 1 ? 'Rent Day tomorrow' : `Rent Day in ${toRent} days`);
    setClass(rentEl, 'is-today', d.dom === 1);
    const dialTip = `${SEASON_WORD[d.season]}. ${WEATHER_WORD[s.weather]}\nThe wheel turns once a month. Rent falls due at the top of it.`;
    for (const dl of [dial.el, barDial.el]) { setAttr(dl, 'data-tip-h', date); setAttr(dl, 'data-tip', dialTip); }

    // the count
    let households = 0, rentRoll = 0;
    for (const id in s.tenants) { const t = s.tenants[id]!; if (t.status === 'housed' && t.buildingId) { households++; rentRoll += t.lease?.rent ?? 0; } }
    const fetching = new Set<string>();
    for (const id in s.jobs) {
      const j = s.jobs[id]!;
      if (j.kind === 'collect' && j.buildingId && (j.state === 'queued' || j.state === 'traveling' || j.state === 'working')) fetching.add(j.buildingId + ':' + (j.unit ?? '*'));
    }
    let vacant = 0, purses = 0, purseGold = 0;
    for (const id in s.buildings) {
      const b = s.buildings[id]!;
      if (b.state !== 'ready') continue;
      for (let u = 0; u < b.units.length; u++) {
        const unit = b.units[u]!;
        if (!unit.tenantId) vacant++;
        if (unit.purse > 0 && !fetching.has(id + ':' + u) && !fetching.has(id + ':*')) { purses++; purseGold += unit.purse; }
      }
    }
    let debt = 0;
    for (const l of s.loans) debt += l.principal;
    let net: number | null = null, book = null as GameState['ledger']['months'][number] | null;
    for (const m of s.ledger.months) {
      if (m.index === d.monthIndex) book = m;
      if (m.index < d.monthIndex) {
        let v = 0;
        for (const k in m.income) if (k !== 'loan') v += m.income[k as keyof typeof m.income];
        for (const k in m.expense) if (k !== 'loan_repaid') v -= m.expense[k as keyof typeof m.expense];
        net = v;
      }
    }

    tGold.set(Math.round(s.gold)); tRoll.set(rentRoll); tHouse.set(households);
    tRenown.set(Math.round(s.renown)); tFavour.set(Math.round(s.favor));
    setClass(figGold, 'is-debt', s.gold < 0); setClass(barGoldFig, 'is-debt', s.gold < 0);
    setClass(figGold, 'has-loan', debt > 0);
    setText(goldS, net === null ? 'first month' : `${signed(net)} last month`);
    setClass(goldS, 'll-good', net !== null && net > 0); setClass(goldS, 'll-bad', net !== null && net < 0);
    setAttr(figGold, 'data-tip', `${crowns(s.gold)} to hand.`
      + (net === null ? ' The first month is not yet counted.' : ` Last month came out ${signed(net)} after wages, upkeep and tribute.`)
      + (debt > 0 ? `\nThe moneylender holds your note for ${crowns(debt)}.` : s.gold < 0 ? '\nThe coffer is empty and the moneylender has noticed.' : ''));
    setAttr(figRoll, 'data-tip', `${crowns(rentRoll)} a month, if every household pays.`
      + (book && book.rentDue > 0 ? `\nThis month: ${num(book.rentCollected)} of ${num(book.rentDue)} collected.` : ''));
    setText(houseS, vacant ? `housed, ${vacant} to let` : 'housed, none to let');
    setAttr(figHouse, 'data-tip', `${plural(households, 'household')} under your roofs. ${vacant ? `${plural(vacant, 'door')} ${vacant === 1 ? 'stands' : 'stand'} empty.` : 'Not a door stands empty.'}`);

    setMeter(renown, s.renown, s.renown >= 60 ? 'good' : s.renown >= 35 ? 'warn' : 'bad');
    setMeter(favour, s.favor, s.favor >= 35 ? 'gold' : 'bad');
    setAttr(renown.row, 'data-tip', `Your name among the tenants: ${renownWord(s.renown)}. It brings more applicants, and better ones.`
      + (s.rival.name ? `\n${s.rival.name} stands at ${Math.round(s.rival.renown)}.` : ''));
    let tribute = '';
    if (def.tribute > 0) {
      const months = BAL.tributeMonths as readonly number[];
      if (d.dom === 1 && months.includes(d.month)) tribute = `\nTribute of ${crowns(def.tribute)} falls due today.`;
      else {
        let ahead = 12;
        for (const m of months) { const gap = (m - d.month + 12) % 12 || 12; if (gap < ahead) ahead = gap; }
        tribute = `\nTribute of ${crowns(def.tribute)} falls due in ${plural(ahead * 30 - (d.dom - 1), 'day')}.`;
      }
    }
    setAttr(favour.row, 'data-tip', `${favourWord(s.favor)} Pay the tribute and satisfy the assessor. At nothing, the charter is revoked.${tribute}`);

    // the charter
    const goals = s.charter.goals;
    if (goals.length !== pipCount || rank !== pipRank) {
      pipCount = goals.length; pipRank = rank;
      clear(pipsEl);
      for (let i = 0; i < goals.length; i++) pipsEl.appendChild(h('i', { class: 'll-pip' }));
    }
    const lines: string[] = [];
    goals.forEach((g, i) => {
      const pip = pipsEl.children[i] as HTMLElement | undefined;
      if (pip) {
        setClass(pip, 'is-done', g.done);
        const p = String(g.done ? 100 : Math.round(Math.max(0, Math.min(1, g.target ? g.value / g.target : 0)) * 100));
        if (pip.style.getPropertyValue('--p') !== p) pip.style.setProperty('--p', p);
      }
      const text = def.goals.find(x => x.id === g.id)?.text ?? g.id;
      lines.push(`${text}: ${g.done ? 'done' : `${num(g.value)} of ${num(g.target)}`}.`);
    });
    const next = RANK_ORDER[RANK_ORDER.indexOf(rank) + 1];
    charterBtn.hidden = goals.length === 0;
    setAttr(charterBtn, 'data-tip', (next ? `To be made ${RANK_TITLES[next]}:\n` : '') + lines.join('\n'));

    // tags
    crownTag.hidden = !s.charter.ready;
    collectTag.hidden = purses < 2;
    const hanging = (s.charter.ready ? 1 : 0) + (purses >= 2 ? 1 : 0);
    if (hanging !== tagCount) { tagCount = hanging; ctx.root.style.setProperty('--ll-tags-h', (hanging ? hanging * 43 + 1 : 0) + 'px'); }
    if (purses >= 2) {
      setText(collectLabel, `Collect ${purses} purses`);
      const bailiff = Object.values(s.staff).find(m => m.role === 'bailiff');
      setAttr(collectTag, 'data-tip', `${crowns(purseGold)} are sitting on doorsteps. ${bailiff ? `${bailiff.first} will walk the round.` : 'You will walk the round yourself.'}\nA purse left too long is spent at the tavern.`);
    }
  }

  function reset(): void { for (const t of tickers) t.snap(); slow = 1; crestSeed = null; }

  const part: ShellPart = {
    el,
    update(state, dt) {
      if (state !== lastState) { lastState = state; reset(); }
      clock(state);
      slow += dt;
      if (slow >= 0.25) { slow = 0; derive(state); }
      for (const t of tickers) t.step(dt);
    },
    handleEvents(events: SimEvent[]) {
      for (const ev of events) {
        if (ev.type === 'promotion' || ev.type === 'demotion' || ev.type === 'charter_ready' || ev.type === 'rent_day') slow = 1;
      }
    },
    setVisible(on) {
      if (on === visible) return;
      visible = on;
      if (on) reset(); else setOpen(false);
    },
    escape() { if (!isOpen) return false; setOpen(false); return true; },
    reset() { lastState = null; setOpen(false); },
  };
  return part;
}
