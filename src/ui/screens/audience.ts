/**
 * The audience: a petitioner stands before the ruler and they talk it out.
 * Opened with an incident id. The word layer owns the conversation
 * (AudienceSession); this screen stages it: the petitioner's portrait and
 * what the ruler knows of them, the matter, the transcript, the ruler's
 * word, the Steward's whispers in the margin, and the seal when it is ruled.
 *
 * Also exports a few small pieces the charter screen shares (typed text,
 * the wax seal, art holders).
 */
import type { Screen, UICtx } from '../api';
import type { GameState, Id, Incident, RankId, SimEvent, Tenant } from '../../sim/types';
import type { AudienceSession, AudienceTurn, Mood, Speaker } from '../../word/api';
import type { IncidentDef } from '../../data/schema';
import type { IconId, TraitId } from '../../data/ids';
import { h, append, clear, addStyle, setText, setClass, button, stat, tag, crowns, plural, num, fromHTML } from '../kit';
import { iconSvg } from '../icons';
import { doodle, dropCap, MARGINALIA_CSS, type DoodleKind } from '../marginalia';
import { createPortrait, type Portrait, type PortraitSpec } from '../portraits';
import {
  INCIDENT_BY_ID, RANKS, NPC_DEFS, CHARACTERS, SPECIES_DEFS, TRADE_DEFS, TRAIT_DEFS, TAG_DEFS,
  TEMPERAMENT_DEFS, ROLE_TITLES, RANK_TITLES,
} from '../../data';
import { fill, baseVars, fmtDate } from '../../sim/core';
import { SCREENS_B_CSS } from '../css/screens-b';

// ───────────────────────── shared small pieces ─────────────────────────

/** Dev pages set `instant` so typed text lands at once (screenshots). */
export const TYPING = { instant: false };

export function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** A holder for inline art (drop caps, doodles, crests). Empty art takes no room. */
export function art(html: string, cls = ''): HTMLElement {
  return h('span', { class: 'll-art ' + cls, html: html || '', 'aria-hidden': 'true' });
}

export function icon(id: IconId): HTMLElement {
  return fromHTML(iconSvg(id)) ?? h('span');
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** "three" for small whole numbers, digits beyond twelve. */
export function numberWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 12 ? NUMBER_WORDS[n]! : num(n);
}

/** "Sir Luke", "Baron Luke" */
export function styledRuler(rank: RankId, ruler: string): string {
  return rank === 'knight' ? `Sir ${ruler}` : `${RANK_TITLES[rank]} ${ruler}`;
}

export function hashStr(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

export interface Typer { done: Promise<void>; skip(): void; stop(): void }

/**
 * Type `text` into `el` a letter at a time. The untyped remainder is laid
 * out invisibly from the start, so lines never reflow while typing.
 */
export function typeOut(el: HTMLElement, text: string, opts: { cps?: number; onEnd?: () => void } = {}): Typer {
  const typed = h('span', { class: 'll-typed' });
  const rest = h('span', { class: 'll-untyped', 'aria-hidden': 'true' }, text);
  clear(el); el.append(typed, rest);
  el.setAttribute('aria-label', text);
  const cps = opts.cps ?? 38;
  let i = 0, timer = 0, over = false;
  let resolve: () => void = () => {};
  const done = new Promise<void>(r => { resolve = r; });
  const end = (complete: boolean) => {
    if (over) return; over = true;
    window.clearTimeout(timer);
    if (complete) { typed.textContent = text; rest.textContent = ''; }
    opts.onEnd?.(); resolve();
  };
  const step = () => {
    if (over) return;
    i = Math.min(text.length, i + 1);
    typed.textContent = text.slice(0, i); rest.textContent = text.slice(i);
    if (i >= text.length) { end(true); return; }
    const c = text[i - 1]!;
    timer = window.setTimeout(step, /[.!?]/.test(c) ? 250 : /[,;:]/.test(c) ? 120 : 1000 / cps);
  };
  if (TYPING.instant || reducedMotion() || !text) end(true);
  else timer = window.setTimeout(step, 40);
  return { done, skip: () => end(true), stop: () => end(false) };
}

let waxCount = 0;
/** An irregular wax seal with an icon pressed into it. Sized by its box; the icon by font-size. */
export function waxSeal(iconId: IconId, seed = 1, opts: { gold?: boolean } = {}): HTMLElement {
  let r = (seed >>> 0) || 1;
  const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
  const n = 11;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.26;
    const rad = 42.5 + rnd() * 6 - (rnd() < 0.22 ? 3.5 : 0);
    pts.push([50 + Math.cos(a) * rad, 50 + Math.sin(a) * rad]);
  }
  const f = (v: number) => v.toFixed(1);
  const mid = (i: number): [number, number] => { const p = pts[i % n]!, q = pts[(i + 1) % n]!; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  let d = `M${f(mid(0)[0])} ${f(mid(0)[1])}`;
  for (let i = 1; i <= n; i++) { const c = pts[i % n]!, m = mid(i); d += `Q${f(c[0])} ${f(c[1])} ${f(m[0])} ${f(m[1])}`; }
  d += 'Z';
  const id = 'llwax' + (++waxCount);
  const stops = opts.gold ? ['#f3e09a', '#c9a227', '#7a5e12'] : ['#d2594c', '#9e2b25', '#58120f'];
  const ring = opts.gold ? 'rgba(84,62,6,.4)' : 'rgba(60,10,8,.38)';
  const svg = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx=".36" cy=".3" r=".82">` +
    `<stop offset="0" stop-color="${stops[0]}"/><stop offset=".5" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/></radialGradient></defs>` +
    `<path d="${d}" fill="url(#${id})"/><path d="${d}" fill="none" stroke="rgba(255,225,205,.34)" stroke-width="1.3" transform="translate(-.7 -.9) scale(.992)"/>` +
    `<circle cx="50" cy="50" r="30.5" fill="rgba(40,8,6,.08)" stroke="${ring}" stroke-width="1.7"/>` +
    `<circle cx="50" cy="51" r="30.5" fill="none" stroke="rgba(255,225,200,.3)" stroke-width="1"/></svg>`;
  return h('span', { class: 'll-wax' + (opts.gold ? ' is-gold' : ''), 'aria-hidden': 'true' }, fromHTML(svg), h('span', { class: 'll-wax-icon', html: iconSvg(iconId) }));
}

/** Who speaks for an incident, worked out from the state alone (queue portraits, and the fallback session). */
export function speakerOf(state: GameState, inc: Incident, def: IncidentDef | undefined): Speaker {
  const pet = def?.petitioner ?? 'tenant';
  if (typeof pet === 'object') {
    const n = NPC_DEFS[pet.npc];
    return { kind: 'npc', name: n.name, first: n.name, species: n.species, portraitSeed: hashStr(pet.npc) % 100000, npc: pet.npc, mood: 'neutral' };
  }
  const a = inc.applicantId ? state.applicants[inc.applicantId] : undefined;
  if (a && (pet === 'applicant' || !inc.tenantId)) {
    return { kind: 'applicant', name: a.household.name, first: a.household.first, species: a.household.species, portraitSeed: a.household.portraitSeed, applicantId: a.id, mood: 'neutral' };
  }
  if (pet === 'staff') {
    const s = Object.values(state.staff)[0];
    if (s) return { kind: 'staff', name: s.name, first: s.first, species: s.species, portraitSeed: s.portraitSeed, role: s.role, staffId: s.id, mood: 'neutral' };
  }
  const t = inc.tenantId ? state.tenants[inc.tenantId] : undefined;
  if (t) return { kind: 'tenant', name: t.name, first: t.first, species: t.species, portraitSeed: t.portraitSeed, tenantId: t.id, mood: t.happiness >= 70 ? 'pleased' : t.happiness >= 40 ? 'neutral' : t.happiness >= 20 ? 'worried' : 'annoyed' };
  return { kind: 'herald', name: 'A petitioner', first: 'The petitioner', species: 'human', portraitSeed: hashStr(inc.id) % 100000, mood: 'neutral' };
}

/** The portrait spec for a speaker, with trade and look hints where the state has them. */
export function portraitSpec(sp: Speaker, state: GameState, size: number): PortraitSpec {
  const spec: PortraitSpec = { species: sp.species, seed: sp.portraitSeed, size, frame: true };
  if (sp.npc) { spec.npc = sp.npc; spec.look = NPC_DEFS[sp.npc]?.look; }
  if (sp.role) spec.role = sp.role;
  const hh = sp.tenantId ? state.tenants[sp.tenantId] : sp.applicantId ? state.applicants[sp.applicantId]?.household : undefined;
  if (hh) {
    spec.trade = hh.trade;
    const ch = hh.character ? CHARACTERS.find(c => c.id === hh.character) : undefined;
    if (ch) spec.look = ch.look;
  }
  return spec;
}

// ───────────────────────── local helpers ─────────────────────────

const MOOD_WORD: Record<Mood, string> = {
  neutral: 'composed', pleased: 'pleased', delighted: 'delighted', worried: 'worried', annoyed: 'annoyed',
  angry: 'angry', smug: 'smug', sad: 'downcast', afraid: 'afraid',
};
const HEART = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14S2 10 2 5.8C2 3.7 3.6 2.4 5.2 2.4c1.2 0 2.2.7 2.8 1.7.6-1 1.6-1.7 2.8-1.7 1.6 0 3.2 1.3 3.2 3.4C14 10 8 14 8 14z" fill="currentColor"/></svg>';
const THORN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14C6 11 10 7 14 2M6.2 10.6 3.2 8.8M9.6 7.2 7.4 3.8M11.2 5.4l3.2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lower = (s: string) => s.toLowerCase();
const inSentence = (name: string) => name.replace(/^The /, 'the ');
const sentence = (s: string) => (/[.!?…”"']$/.test(s.trim()) ? s.trim() : s.trim() + '.');

function happinessWord(v: number): string {
  return v >= 80 ? 'Thriving' : v >= 60 ? 'Content' : v >= 40 ? 'Getting by' : v >= 20 ? 'Grumbling' : 'Miserable';
}
function happinessFace(v: number): HTMLElement {
  const m = (clamp(v, 0, 100) - 50) / 50;
  const col = v >= 60 ? 'var(--good)' : v >= 35 ? 'var(--warn)' : 'var(--bad)';
  const y0 = (11.4 - m * 0.9).toFixed(1), y1 = (11.4 + m * 3.2).toFixed(1);
  return fromHTML(`<svg class="ll-aud-hface" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7.6" fill="rgba(255,250,235,.6)" stroke="${col}" stroke-width="1.4"/><circle cx="6.3" cy="7.2" r="1" fill="${col}"/><circle cx="11.7" cy="7.2" r="1" fill="${col}"/><path d="M5.6 ${y0}Q9 ${y1} 12.4 ${y0}" fill="none" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/></svg>`);
}
function tenure(days: number): string {
  const months = Math.floor(days / 30);
  if (months < 1) return 'Newly arrived at';
  if (months === 1) return 'One month at';
  if (months < 12) return `${numberWord(months)[0]!.toUpperCase()}${numberWord(months).slice(1)} months at`;
  if (months < 24) return 'Over a year at';
  const y = numberWord(Math.floor(months / 12));
  return `${y[0]!.toUpperCase()}${y.slice(1)} years at`;
}
function doodleFor(def: IncidentDef | null): DoodleKind {
  switch (def?.icon) {
    case 'griffin': return 'griffin';
    case 'goblin': return 'goblin_scroll';
    case 'dragon': case 'flame': return 'dragon_small';
    case 'coin': case 'purse': case 'sack': return 'mouse_coin';
    case 'ledger': case 'book': case 'scales': return 'owl_ledger';
    case 'scroll': case 'quill': case 'seal': case 'gavel': return 'fox_scribe';
    case 'horn': case 'bell': case 'crown': return 'hound_horn';
    case 'music': case 'mug': return 'cat_lute';
    case 'sword': case 'shield': return 'snail_knight';
    default: return 'any';
  }
}
function audienceIncidents(state: GameState): Incident[] {
  return Object.values(state.incidents)
    .filter(i => i.state === 'open' && INCIDENT_BY_ID[i.defId]?.audience === true)
    .sort((a, b) => (a.expiresDay ?? 1e9) - (b.expiresDay ?? 1e9) || a.startedDay - b.startedDay);
}

/**
 * A plain session built from the incident's own outcomes, used only when the
 * word layer has no session to give. Whispers rule directly; free speech
 * rules only when it repeats one of them.
 */
function localSession(ctx: UICtx, inc: Incident, def: IncidentDef, speaker: Speaker): AudienceSession {
  const vars = () => {
    const s = ctx.state();
    return { ...baseVars(s, inc.buildingId ? s.buildings[inc.buildingId] : null, inc.tenantId ? s.tenants[inc.tenantId] : null), ...inc.vars };
  };
  const address = RANKS[ctx.state().realm.rank].address;
  const openings = def.opening?.length ? def.opening : [def.herald];
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const turn = (reply: string, mood: Mood): AudienceTurn => ({ reply, mood, outcomeId: null, done: false, resultText: null, oaths: [], revealed: [], via: 'offline' });
  const s: AudienceSession = {
    incidentId: inc.id, title: def.title, speaker,
    lines: [{ who: 'petitioner', text: fill(openings[hashStr(inc.id) % openings.length]!, vars()) }],
    whispers: def.outcomes.map(o => ({ outcomeId: o.id, label: fill(o.label, vars()), say: fill(o.say, vars()) })),
    busy: false, done: false, outcomeId: null,
    say(text: string): Promise<AudienceTurn> {
      const said = norm(text);
      const hit = s.whispers.find(w => said && (norm(w.say) === said || norm(w.label) === said));
      if (hit) { s.lines.push({ who: 'ruler', text }); return Promise.resolve(rule(hit.outcomeId)); }
      const reply = `Plainly, ${address}. What is it to be?`;
      s.lines.push({ who: 'ruler', text }, { who: 'petitioner', text: reply });
      return Promise.resolve(turn(reply, speaker.mood));
    },
    choose(outcomeId: string): AudienceTurn {
      const w = s.whispers.find(x => x.outcomeId === outcomeId);
      if (w) s.lines.push({ who: 'ruler', text: w.say });
      return rule(outcomeId);
    },
    leave() { /* nothing is held */ },
  };
  function rule(outcomeId: string): AudienceTurn {
    const o = def.outcomes.find(x => x.id === outcomeId);
    if (!o) return turn(`I did not follow that, ${address}.`, 'worried');
    const res = ctx.act({ type: 'resolve_incident', incidentId: inc.id, outcomeId });
    if (!res.ok) { s.lines.push({ who: 'petitioner', text: res.reason }); return turn(res.reason, 'worried'); }
    let glad = 0;
    for (const e of o.effects) {
      if (e.t === 'happiness' && (!e.scope || e.scope === 'tenant')) glad += e.amount;
      if (e.t === 'leave' || e.t === 'evict') glad -= 20;
    }
    const reply = fill(o.reply, vars());
    s.lines.push({ who: 'petitioner', text: reply });
    s.done = true; s.outcomeId = outcomeId;
    return { reply, mood: glad > 8 ? 'delighted' : glad > 0 ? 'pleased' : glad < -8 ? 'sad' : glad < 0 ? 'annoyed' : 'neutral', outcomeId, done: true, resultText: fill(o.result, vars()), oaths: [], revealed: [], via: 'offline' };
  }
  return s;
}

// ───────────────────────── the screen ─────────────────────────

export function create(ctx: UICtx): Screen {
  if (MARGINALIA_CSS) addStyle('marginalia', MARGINALIA_CSS);
  addStyle('screens-b', SCREENS_B_CSS);

  // top bar
  const whereEl = h('span', { class: 'll-lbx-dim' });
  const queueEl = h('div', { class: 'll-aud-queue', hidden: true });
  const leaveTop = h('button', { class: 'll-lbx-btn ll-aud-leave-top', type: 'button', onclick: () => requestClose() }, 'Bid them wait');
  const top = h('div', { class: 'll-lbx is-top' }, h('span', { class: 'll-lbx-kicker' }, 'An Audience'), whereEl, queueEl, leaveTop);

  // the petitioner
  const faceHold = h('div', { class: 'll-aud-portrait' });
  const nameEl = h('h3', { class: 'll-aud-name' });
  const descEl = h('p', { class: 'll-aud-desc' });
  const moodWord = h('b');
  const moodEl = h('span', { class: 'll-aud-mood', 'aria-live': 'polite' }, 'Seems ', moodWord);
  const factsToggle = h('button', { class: 'll-aud-facts-toggle', type: 'button', onclick: () => who.classList.toggle('is-facts') }, 'What you know');
  const plate = h('div', { class: 'll-aud-plate ll-parch' }, nameEl, descEl, h('div', null, moodEl, factsToggle));
  const factsEl = h('div', { class: 'll-aud-facts ll-parch' });
  const who = h('section', { class: 'll-aud-who', 'aria-label': 'The petitioner' }, faceHold, plate, factsEl);

  // the document
  const capEl = h('span', { class: 'll-art ll-aud-cap', 'aria-hidden': 'true' });
  const titleEl = h('h2', { class: 'll-aud-title' });
  const heraldEl = h('p', { class: 'll-aud-herald' });
  const timerText = h('span');
  const timerFill = h('i');
  const timerEl = h('div', { class: 'll-aud-timer', hidden: true, title: 'Say nothing, and custom decides the matter for you.' },
    h('span', { class: 'll-aud-timer-row' }, icon('hourglass'), timerText),
    h('div', { class: 'll-meter ll-meter-ink' }, timerFill));
  const matter = h('header', { class: 'll-aud-matter' }, capEl, titleEl, timerEl, heraldEl);

  const doodleEl = h('span', { class: 'll-art ll-aud-doodle', 'aria-hidden': 'true' });
  const scroll = h('div', { class: 'll-aud-scroll', role: 'log', 'aria-live': 'polite', 'aria-label': 'What has been said' });

  const whispersEl = h('div', { class: 'll-aud-whispers', hidden: true });

  const wordNote = h('span', { class: 'll-aud-word-note' });
  const box = h('textarea', { class: 'll-input ll-aud-box', rows: 2, 'aria-label': 'Your word', autocomplete: 'off', spellcheck: false, enterkeyhint: 'send' });
  const micBtn = h('button', { class: 'll-seal ll-aud-mic', type: 'button', title: 'Hold to speak aloud', 'aria-label': 'Hold to speak aloud', hidden: true, html: iconSvg('mic') });
  const sendBtn = h('button', { class: 'll-seal ll-aud-send', type: 'button', title: 'Speak (Enter)', 'aria-label': 'Speak', html: iconSvg('send'), onclick: () => { void speak(); } });
  const wordHint = h('div', { class: 'll-note ll-aud-word-hint' });
  const word = h('div', { class: 'll-aud-word' },
    h('div', { class: 'll-aud-word-head' }, h('label', { class: 'll-aud-word-label' }, 'Your word'), wordNote),
    h('div', { class: 'll-aud-word-row' }, micBtn, box, sendBtn),
    wordHint);
  const ruling = h('div', { class: 'll-aud-ruling', hidden: true });
  const doc = h('section', { class: 'll-aud-doc ll-parch', 'aria-label': 'The matter' }, matter, scroll, whispersEl, word, ruling);

  const stage = h('div', { class: 'll-aud-stage' }, who, doc);

  // bottom bar
  const leaveNote = h('span', { class: 'll-lbx-note' });
  const leaveBtn = h('button', { class: 'll-lbx-btn', type: 'button', onclick: () => requestClose() }, 'Bid them wait');
  const bottom = h('div', { class: 'll-lbx is-bottom' },
    h('span', { class: 'll-lbx-note' }, 'The realm slows to a crawl while you speak.'),
    h('div', { class: 'll-aud-foot-right' }, leaveNote, leaveBtn));

  const el = h('div', { class: 'll-aud', hidden: true, role: 'dialog', 'aria-label': 'An audience' }, top, stage, bottom);

  // ── state ──
  let isOpen = false;
  let session: AudienceSession | null = null;
  let incId: Id | null = null;
  let def: IncidentDef | null = null;
  let speaker: Speaker | null = null;
  let local = false;                 // the fallback session is in use
  let plain = false;                 // whispers rule directly
  let ended: 'ruled' | 'settled' | 'nobody' | null = null;
  let waiting = false;               // a reply is on its way
  let waitingSince = 0;
  let token = 0;
  let mood: Mood = 'neutral';
  let portrait: Portrait | null = null;
  let portraitSize = 0;
  let queuePortraits: Portrait[] = [];
  let typing: { t: Typer | null; over: boolean } | null = null;
  let dotsLine: HTMLElement | null = null;
  let lastWho: string | null = null;
  let releaseCrawl: (() => void) | null = null;
  let unsubWord: (() => void) | null = null;
  let enterTimer = 0;
  let tick = 0;
  let dirty = true;
  let factsSig = '', queueSig = '';
  let lastPointerAt = 0, lookRaf = 0, lookX = 0, lookY = 0;
  let micOn = false, micBase = '', micKeyHeld = false;

  const sfx = (id: Parameters<UICtx['audio']['sfx']>[0], volume?: number) => { try { ctx.audio.sfx(id, volume === undefined ? undefined : { volume }); } catch { /* silence is fine */ } };
  const narrow = () => el.clientWidth <= 760;
  const address = () => RANKS[ctx.state().realm.rank].address;
  const you = () => styledRuler(ctx.state().realm.rank, ctx.state().realm.ruler);

  // ── portrait ──
  function wantedPortraitSize(): number {
    if (narrow()) return 92;
    const avail = el.clientHeight - 2 * 54 - 48;
    return Math.round(clamp(avail * 0.41, 96, 300) / 4) * 4;
  }
  function mountPortrait(): void {
    if (!speaker) return;
    const size = wantedPortraitSize();
    if (portrait && size === portraitSize) return;
    portrait?.dispose();
    clear(faceHold);
    portraitSize = size;
    portrait = createPortrait(portraitSpec(speaker, ctx.state(), size));
    portrait.el.classList.add('ll-aud-face');
    faceHold.appendChild(portrait.el);
    portrait.setMood(mood);
    if (typing) portrait.setTalking(true);
  }
  function dropPortrait(): void { portrait?.dispose(); portrait = null; portraitSize = 0; clear(faceHold); }
  function setMood(m: Mood): void {
    mood = m;
    portrait?.setMood(m);
    setText(moodWord, MOOD_WORD[m] ?? 'composed');
    setClass(moodEl, 'is-warm', m === 'pleased' || m === 'delighted');
    setClass(moodEl, 'is-cold', m === 'annoyed' || m === 'angry');
  }
  function lookToward(clientX: number, clientY: number): void {
    lookX = clientX; lookY = clientY;
    if (lookRaf) return;
    lookRaf = requestAnimationFrame(() => {
      lookRaf = 0;
      if (!portrait) return;
      const r = portrait.el.getBoundingClientRect();
      if (!r.width) return;
      const nx = clamp((lookX - (r.left + r.width / 2)) / Math.max(1, el.clientWidth * 0.45), -1, 1);
      const ny = clamp((lookY - (r.top + r.height / 2)) / Math.max(1, el.clientHeight * 0.45), -1, 1);
      portrait.lookAt(0.5 + nx * 0.5, 0.5 + ny * 0.5);
    });
  }
  function lookAtBox(): void {
    const r = box.getBoundingClientRect();
    lastPointerAt = performance.now();
    lookToward(r.left + r.width * 0.5, r.top + r.height * 0.5);
  }
  const onPointerMove = (ev: PointerEvent) => { lastPointerAt = performance.now(); lookToward(ev.clientX, ev.clientY); };

  // ── transcript ──
  function toBottom(): void {
    scroll.scrollTop = scroll.scrollHeight;
    // the margin doodle keeps the blank page company, and bows out once the writing reaches it
    const last = scroll.lastElementChild as HTMLElement | null;
    const written = last && last !== doodleEl ? last.offsetTop + last.offsetHeight : 0;
    setClass(doodleEl, 'is-under', written > scroll.clientHeight - doodleEl.offsetHeight - 20);
  }
  function stopTyping(complete: boolean): void {
    const run = typing; if (!run) return;
    if (complete) run.t?.skip(); else run.t?.stop();
  }
  function lineEl(whoIs: 'ruler' | 'petitioner' | 'steward'): { line: HTMLElement; p: HTMLParagraphElement } {
    const p = h('p');
    const by = whoIs === 'ruler' ? you() : whoIs === 'petitioner' ? (speaker?.first ?? '') : '';
    const line = h('div', { class: 'll-aud-line ' + (whoIs === 'ruler' ? 'is-you' : whoIs === 'petitioner' ? 'is-them' : 'is-steward') },
      by && lastWho !== whoIs ? h('span', { class: 'll-aud-by' }, by) : null, p);
    lastWho = whoIs;
    if (dotsLine?.parentNode === scroll) scroll.insertBefore(line, dotsLine); else scroll.appendChild(line);
    return { line, p };
  }
  function addLine(whoIs: 'ruler' | 'petitioner' | 'steward', text: string, typed = false): Promise<void> {
    stopTyping(true);
    const { line, p } = lineEl(whoIs);
    if (!(typed && whoIs === 'petitioner')) { p.textContent = text; toBottom(); return Promise.resolve(); }
    line.classList.add('is-typing');
    line.title = 'Click to hear the rest at once';
    let voice = { stop() { /* nothing playing */ } };
    try { if (speaker && !TYPING.instant) voice = ctx.audio.voice(speaker.portraitSeed, text); } catch { /* silence is fine */ }
    portrait?.setTalking(true);
    // typeOut may finish before it returns (instant typing), so the handle exists first
    const run: { t: Typer | null; over: boolean } = { t: null, over: false };
    const t = typeOut(p, text, {
      onEnd: () => {
        run.over = true;
        if (typing === run) typing = null;
        line.classList.remove('is-typing'); line.removeAttribute('title'); line.onclick = null;
        voice.stop(); portrait?.setTalking(false);
      },
    });
    run.t = t;
    if (!run.over) { typing = run; line.onclick = () => t.skip(); }
    toBottom();
    return t.done;
  }
  function addRecord(label: string, text: string, small?: string): void {
    stopTyping(true);
    const { p } = lineEl('steward');
    p.append(h('b', null, label + ' '), text, small ? h('span', null, ' ' + small) : '');
    lastWho = null;
    toBottom();
  }
  /** The usher's line as the petitioner comes in. */
  function shownIn(state: GameState): string {
    const sp = speaker; if (!sp) return '';
    if (sp.staffId && sp.role) return `${sp.name}, your ${ROLE_TITLES[sp.role]}, asks a word.`;
    const t = sp.tenantId ? state.tenants[sp.tenantId] : undefined;
    const b = t?.buildingId ? state.buildings[t.buildingId] : undefined;
    if (t && b) return `${sp.name}, of ${inSentence(b.name)}, is shown in.`;
    if (sp.applicantId) return `${sp.name}, a stranger seeking rooms, is shown in.`;
    return `${sp.name} is announced.`;
  }
  function addUsher(text: string): void {
    if (!text) return;
    const { line, p } = lineEl('steward');
    line.classList.add('is-usher');
    p.textContent = text;
    lastWho = null;
  }
  function setListening(on: boolean): void {
    if (on === !!dotsLine) return;
    if (!on) { dotsLine?.remove(); dotsLine = null; return; }
    dotsLine = h('div', { class: 'll-aud-line is-them', role: 'status', 'aria-label': `${speaker?.first ?? 'The petitioner'} is listening` },
      lastWho !== 'petitioner' ? h('span', { class: 'll-aud-by' }, speaker?.first ?? '') : null,
      h('span', { class: 'll-aud-dots' }, h('i'), h('i'), h('i')));
    scroll.appendChild(dotsLine);
    toBottom();
  }

  // ── who they are, what you know ──
  function describe(state: GameState): string {
    const sp = speaker; if (!sp) return '';
    if (sp.npc) { const n = NPC_DEFS[sp.npc]; return n.title && n.title !== n.name ? sentence(n.title) : 'Come to court on business.'; }
    if (sp.staffId) {
      const s = state.staff[sp.staffId];
      if (s) { const td = TEMPERAMENT_DEFS[s.temperament]; return `Your ${ROLE_TITLES[s.role]}${td ? `, ${td.name} ${td.epithet}` : ''}.`; }
    }
    const t = sp.tenantId ? state.tenants[sp.tenantId] : undefined;
    const hh = t ?? (sp.applicantId ? state.applicants[sp.applicantId]?.household : undefined);
    if (!hh) return `${SPECIES_DEFS[sp.species]?.name ?? 'A stranger'}, come to be heard.`;
    const tags = hh.tags.map(g => lower(TAG_DEFS[g]?.name ?? g));
    const parts = [`${SPECIES_DEFS[hh.species]?.name ?? hh.species} ${lower(TRADE_DEFS[hh.trade]?.name ?? hh.trade)}${tags.length ? ', ' + tags.join(', ') : ''}`];
    parts.push(hh.household <= 1 ? 'Lives alone' : `Household of ${numberWord(hh.household)}`);
    if (t) {
      const b = t.buildingId ? state.buildings[t.buildingId] : undefined;
      if (b) parts.push(`${tenure(state.day - t.movedInDay)} ${inSentence(b.name)}`);
    } else if (sp.applicantId) {
      const b = state.buildings[state.applicants[sp.applicantId]?.buildingId ?? ''];
      if (b) parts.push(`Asking after ${inSentence(b.name)}`);
    }
    return parts.join('. ') + '.';
  }
  function traitTags(revealed: TraitId[], hiddenCount: number): HTMLElement {
    const wrap = h('span', { class: 'll-aud-traits' });
    for (const id of revealed) {
      const d = TRAIT_DEFS[id];
      const tg = tag(d?.name ?? id, d?.good ? 'good' : 'plain');
      if (d?.blurb) { tg.title = d.blurb; tg.dataset.tip = d.blurb; }
      wrap.appendChild(tg);
    }
    if (hiddenCount > 0) {
      const q = tag(revealed.length ? 'and more' : 'Not yet known');
      q.title = 'There is more to them than you know. Talk, and it may come out.'; q.dataset.tip = q.title;
      wrap.appendChild(q);
    }
    return wrap;
  }
  function memoryBlock(t: Tenant): HTMLElement[] {
    const head = h('h4', { class: 'll-aud-mem-h' }, 'They remember');
    const recent = t.memory.slice(-3).reverse();
    if (!recent.length) return [head, h('div', { class: 'll-aud-mem-none' }, 'Nothing of you yet, for good or ill.')];
    return [head, h('ul', { class: 'll-aud-mem' }, recent.map(m =>
      h('li', { class: m.valence > 0 ? 'is-fond' : 'is-bitter' }, fromHTML(m.valence > 0 ? HEART : THORN), h('span', null, m.text))))];
  }
  function renderFacts(state: GameState): void {
    const sp = speaker; if (!sp) return;
    const t = sp.tenantId ? state.tenants[sp.tenantId] : undefined;
    const a = sp.applicantId ? state.applicants[sp.applicantId] : undefined;
    const s = sp.staffId ? state.staff[sp.staffId] : undefined;
    const sig = t ? ['t', t.lease?.rent, t.arrears, t.daysLate, Math.round(t.happiness / 4), t.revealed.join(), t.traits.length, t.memory.length, t.pets.join()].join('|')
      : a ? ['a', a.shown, a.screened, a.household.revealed.join(), state.buildings[a.buildingId]?.rent].join('|')
      : s ? ['s', s.wage, Math.round(s.loyalty / 4), s.skill].join('|') : 'n' + (sp.npc ?? '');
    if (sig === factsSig) return;
    factsSig = sig;
    clear(factsEl);
    if (t) {
      factsEl.append(
        stat('Rent', t.lease ? `${crowns(t.lease.rent)} a month` : 'No lease'),
        stat('Arrears', t.arrears > 0 ? `${crowns(t.arrears)}${t.daysLate > 0 ? `, ${plural(Math.round(t.daysLate), 'day')} late` : ''}` : 'None', { class: t.arrears > 0 ? 'll-bad' : '' }),
        stat('Happiness', [happinessFace(t.happiness), happinessWord(t.happiness)]),
      );
      if (t.pets.length) factsEl.append(stat('Keeps', t.pets.map(p => 'a ' + p.replace(/_/g, ' ')).join(', ')));
      factsEl.append(stat('Known for', traitTags(t.revealed, t.traits.length - t.revealed.length)));
      factsEl.append(...memoryBlock(t));
    } else if (a) {
      const b = state.buildings[a.buildingId];
      factsEl.append(
        stat('Seeks', b?.name ?? 'A roof'),
        stat('Asking rent', b ? `${crowns(b.rent)} a month` : 'Unset'),
        stat('Seen the place', a.shown ? 'Yes' : 'Not yet'),
        stat('Last landlord', a.screened ? 'Asked' : 'Not asked'),
        stat('Known for', traitTags(a.household.revealed, a.screened ? 0 : 1)),
      );
    } else if (s) {
      factsEl.append(
        stat('Office', ROLE_TITLES[s.role]),
        stat('Wage', `${crowns(s.wage)} a month`),
        stat('Skill', `${numberWord(s.skill)} of five`),
        stat('Loyalty', s.loyalty >= 70 ? 'Steadfast' : s.loyalty >= 40 ? 'Dutiful' : 'Wavering'),
      );
    } else {
      const bio = sp.npc ? NPC_DEFS[sp.npc]?.bio : '';
      factsEl.append(h('div', { class: 'll-note' }, bio || 'Not one of your households. They answer to someone else, and will say so.'));
    }
  }

  // ── the matter ──
  function renderMatter(state: GameState, inc: Incident | null, title: string): void {
    const first = title.charAt(0);
    const isLetter = /[A-Za-z]/.test(first);
    capEl.innerHTML = isLetter ? dropCap(first.toUpperCase(), 54) : '';
    setText(titleEl, isLetter ? title.slice(1) : title);
    titleEl.setAttribute('aria-label', title);
    let line = '';
    if (inc) {
      for (let i = state.heralds.length - 1; i >= 0; i--) if (state.heralds[i]!.incidentId === inc.id) { line = state.heralds[i]!.text; break; }
      if (!line && def) line = fill(def.herald, { ...baseVars(state, inc.buildingId ? state.buildings[inc.buildingId] : null, inc.tenantId ? state.tenants[inc.tenantId] : null), ...inc.vars });
    }
    setText(heraldEl, line);
    heraldEl.hidden = !line;
    doodleEl.innerHTML = doodle(doodleFor(def), inc ? hashStr(inc.id) % 97 : 0, 84);
  }
  function renderClock(state: GameState): void {
    const seat = Object.values(state.buildings).find(b => b.type === 'seat');
    setText(whereEl, `${seat ? 'At the ' + seat.name.replace(/^the /i, '') + ', ' : ''}${fmtDate(state.day)}`);
    const inc = incId ? state.incidents[incId] : undefined;
    const open = !!inc && inc.state === 'open' && !ended;
    if (!open || inc!.expiresDay === null) {
      timerEl.hidden = true;
      setText(leaveNote, open ? 'They will wait at your door until you send for them.' : '');
      return;
    }
    const left = Math.max(0, inc!.expiresDay! - state.day);
    const days = Math.ceil(left);
    timerEl.hidden = false;
    setText(timerText, days <= 1 ? 'Settles itself today' : `${days} days to rule`);
    setClass(timerEl, 'is-soon', left <= 3);
    timerFill.style.width = clamp((left / Math.max(1, inc!.expiresDay! - inc!.startedDay)) * 100, 0, 100).toFixed(1) + '%';
    setText(leaveNote, days <= 1 ? 'Leave now and custom decides the matter today.' : `They will wait at your door. In ${numberWord(days)} days, custom decides for you.`);
  }

  // ── the queue ──
  function renderQueue(state: GameState): void {
    const waitingNow = audienceIncidents(state);
    const sig = waitingNow.map(i => i.id).join() + '>' + (incId ?? '') + (ended ?? '');
    if (sig === queueSig) return;
    queueSig = sig;
    for (const p of queuePortraits) p.dispose();
    queuePortraits = [];
    clear(queueEl);
    const others = waitingNow.filter(i => i.id !== incId);
    queueEl.hidden = others.length === 0;
    if (!others.length) return;
    queueEl.appendChild(h('span', { class: 'll-aud-queue-label' }, 'At your door'));
    for (const inc of waitingNow) {
      const d = INCIDENT_BY_ID[inc.defId];
      const sp = speakerOf(state, inc, d);
      const p = createPortrait(portraitSpec(sp, state, 36));
      queuePortraits.push(p);
      const now = inc.id === incId;
      const tip = `${sp.name}: ${d?.title ?? 'a matter'}${now ? ' (before you now)' : ''}`;
      queueEl.appendChild(h('button', {
        class: 'll-aud-qbtn' + (now ? ' is-now' : '') + (inc.expiresDay !== null && inc.expiresDay - state.day <= 3 ? ' is-urgent' : ''),
        type: 'button', title: tip, 'aria-label': tip, dataset: { tip }, disabled: now,
        onclick: () => hop(inc.id),
      }, p.el));
    }
  }

  // ── the whispers ──
  function stewardName(state: GameState): string | null {
    return Object.values(state.staff).find(s => s.role === 'steward')?.first ?? null;
  }
  function renderWhispers(): void {
    clear(whispersEl);
    const s = session;
    if (!s || ended || !s.whispers.length) { whispersEl.hidden = true; return; }
    whispersEl.hidden = false;
    setClass(whispersEl, 'is-plain', plain);
    const st = stewardName(ctx.state());
    whispersEl.appendChild(h('p', { class: 'll-aud-whispers-cap' }, plain
      ? h('span', null, h('b', null, 'Plain choices.'), h('i', null, 'Pick one and it is ruled.'))
      : h('span', null, st ? h('b', null, `${st} whispers.`) : h('b', null, 'A whisper', h('span', { class: 'll-aud-wide' }, ' at your shoulder'), '.'), h('i', null, 'You might say:'))));
    for (const w of s.whispers.slice(0, 4)) {
      whispersEl.appendChild(h('button', {
        class: 'll-aud-whisper', type: 'button', disabled: waiting,
        title: plain ? 'Rule so, at once' : 'Put these words in your mouth. You may change them before you speak.',
        onclick: () => { if (plain) void ruleByWhisper(w); else fillBox(w.say); },
      }, h('b', null, w.label), h('span', null, plain ? w.say : `“${w.say}”`)));
    }
  }
  function fillBox(text: string): void {
    box.value = text;
    box.classList.remove('is-filled'); void box.offsetWidth; box.classList.add('is-filled');
    sfx('page', 0.6);
    box.focus();
    try { box.setSelectionRange(text.length, text.length); } catch { /* not focusable yet */ }
    lookAtBox();
  }
  function refreshPlain(): void {
    let offline = false;
    try { offline = ctx.word.transport() === 'none'; } catch { offline = true; }
    const next = local || offline;
    const changed = next !== plain;
    plain = next;
    const addr = address();
    box.placeholder = plain ? `Choose one of the notes, ${addr}, or say it plainly.` : `Speak, ${addr}. Ask, haggle, promise, or rule.`;
    if (!micOn) {
      setText(wordNote, plain ? 'Plain choices are all the court can hear just now.' : '');
      setClass(wordNote, 'is-warn', false);
    }
    setText(wordHint, plain ? 'Pick a note to rule at once. Or say one of them in plain words, and press Enter.' : 'Enter to speak. What you promise here is entered in the Ledger of Oaths.');
    if (changed) renderWhispers();
  }

  // ── speaking ──
  function setWaiting(on: boolean): void {
    waiting = on;
    waitingSince = on ? performance.now() : 0;
    sendBtn.disabled = on || !!ended;
    micBtn.disabled = on || !!ended;
    leaveBtn.disabled = on; leaveTop.disabled = on;
    for (const b of Array.from(whispersEl.querySelectorAll('button'))) b.disabled = on;
    for (const b of Array.from(queueEl.querySelectorAll('button'))) if (!b.classList.contains('is-now')) b.disabled = on;
    setListening(on);
    if (on) { portrait?.setTalking(false); lookAtBox(); }
  }
  function stumble(): AudienceTurn {
    return { reply: `Forgive me, ${address()}. The words went past me. Say it again?`, mood: 'worried', outcomeId: null, done: false, resultText: null, oaths: [], revealed: [], via: 'offline' };
  }
  async function speak(): Promise<void> {
    const s = session;
    if (!s || ended || waiting) return;
    const text = box.value.trim();
    if (!text) { box.focus(); return; }
    stopMic();
    box.value = '';
    sendBtn.classList.remove('is-ready');
    void addLine('ruler', text);
    sfx('quill', 0.7);
    const tok = ++token;
    setWaiting(true);
    const t0 = performance.now();
    let turn: AudienceTurn;
    try { turn = await s.say(text); } catch { turn = stumble(); }
    const lag = 520 - (performance.now() - t0);
    if (lag > 0 && !TYPING.instant) await wait(lag);
    if (tok !== token || !isOpen) return;
    setWaiting(false);
    await present(turn, tok);
  }
  async function ruleByWhisper(w: { outcomeId: string; say: string }): Promise<void> {
    const s = session;
    if (!s || ended || waiting) return;
    void addLine('ruler', w.say);
    sfx('quill', 0.7);
    const tok = ++token;
    setWaiting(true);
    let turn: AudienceTurn;
    try { turn = s.choose(w.outcomeId); } catch { turn = stumble(); }
    if (!TYPING.instant) await wait(650);
    if (tok !== token || !isOpen) return;
    setWaiting(false);
    await present(turn, tok);
  }
  async function present(turn: AudienceTurn, tok: number): Promise<void> {
    setMood(turn.mood);
    if (turn.done) {
      ended = 'ruled';
      sendBtn.disabled = true; micBtn.disabled = true; box.disabled = true;
      whispersEl.hidden = true;
      queueSig = '';
    }
    if (turn.reply.trim()) await addLine('petitioner', turn.reply, true);
    if (tok !== token || !isOpen) return;
    if (turn.done) {
      if (!TYPING.instant) await wait(420);
      if (tok !== token || !isOpen) return;
      seal(turn);
      return;
    }
    for (const o of turn.oaths) { addRecord('Entered among your oaths:', `“${o.text}”`); sfx('quill', 0.6); }
    for (const tr of turn.revealed) addRecord(`Learned of ${speaker?.first ?? 'them'}:`, learned(tr));
    if (turn.revealed.length) factsSig = '';
    if (!narrow()) box.focus();
  }
  function learned(tr: TraitId): string {
    const d = TRAIT_DEFS[tr];
    return `${d?.name ?? tr.replace(/_/g, ' ')}.${d?.blurb ? ' ' + d.blurb : ''}`;
  }

  // ── endings ──
  function closingActions(label: string): HTMLElement {
    const state = ctx.state();
    const next = audienceIncidents(state).find(i => i.id !== incId);
    const primary = button(label, () => requestClose(), { kind: 'primary' });
    window.setTimeout(() => { if (isOpen && primary.isConnected) primary.focus(); }, TYPING.instant ? 0 : 900);
    return h('div', { class: 'll-aud-ruling-actions' },
      next ? button('Hear the next petitioner', () => hop(next.id), { kind: 'quiet' }) : null, primary);
  }
  function seal(turn: AudienceTurn): void {
    ended = 'ruled';
    word.hidden = true; whispersEl.hidden = true;
    leaveBtn.hidden = true; leaveTop.hidden = true;
    clear(ruling);
    ruling.className = 'll-aud-ruling';
    const entries = h('ul', { class: 'll-aud-entries' });
    let delay = 0.75;
    const entry = (ic: IconId, label: string, body: (Node | string)[], small?: string) => {
      entries.appendChild(h('li', { style: `animation-delay:${delay.toFixed(2)}s` }, icon(ic),
        h('span', null, h('b', null, label + ' '), body, small ? h('small', null, ' ' + small) : null)));
      delay += 0.28;
    };
    for (const o of turn.oaths) entry('quill', 'Entered among your oaths:', [h('em', null, `“${o.text}”`)], `To be kept by the ${fmtDate(o.dueDay)}.`);
    for (const tr of turn.revealed) entry('eye', `Learned of ${speaker?.first ?? 'them'}:`, [learned(tr)]);
    const actions = closingActions('So ruled');
    actions.style.animationDelay = (delay + 0.1).toFixed(2) + 's';
    append(ruling, [
      waxSeal('gavel', hashStr(incId ?? 'seal')),
      h('div', { class: 'll-aud-kicker' }, 'So it is ruled'),
      h('p', { class: 'll-aud-result' }, turn.resultText ?? 'It is done, and entered in the rolls.'),
      entries.childElementCount ? entries : null,
      actions,
    ]);
    ruling.hidden = false;
    factsSig = ''; queueSig = ''; dirty = true;
    toBottom();
    const tok = token;
    window.setTimeout(() => {
      if (tok !== token || !isOpen) return;
      sfx('stamp');
      doc.classList.add('is-thump');
      window.setTimeout(() => doc.classList.remove('is-thump'), 260);
    }, TYPING.instant ? 0 : 250);
    if (turn.oaths.length) window.setTimeout(() => { if (tok === token && isOpen) sfx('quill', 0.6); }, 900);
    window.requestAnimationFrame(toBottom);
  }
  function plainEnding(kind: 'settled' | 'nobody', kicker: string, text: string): void {
    ended = kind;
    stopMic();
    setListening(false);
    word.hidden = true; whispersEl.hidden = true;
    leaveBtn.hidden = true; leaveTop.hidden = true;
    clear(ruling);
    ruling.className = 'll-aud-ruling is-plain';
    ruling.append(h('div', { class: 'll-aud-kicker' }, kicker), h('p', { class: 'll-aud-result' }, text), closingActions('Very well'));
    ruling.hidden = false;
    queueSig = ''; dirty = true;
    toBottom();
  }
  function settledElsewhere(state: GameState): void {
    let text = '';
    for (let i = state.heralds.length - 1; i >= 0 && i >= state.heralds.length - 12; i--) {
      const hd = state.heralds[i]!;
      if (hd.incidentId === incId && hd.day >= state.day - 2) { text = hd.text; break; }
    }
    plainEnding('settled', 'Settled without you', text || 'The matter was settled before you could rule on it. The record will show who did.');
  }

  // ── the microphone ──
  function startMic(): void {
    const mic = ctx.word.mic;
    if (micOn || !mic.supported || waiting || ended || !session) return;
    micOn = true;
    micBase = box.value.trim() ? box.value.trim() + ' ' : '';
    setClass(micBtn, 'is-on', true); setClass(box, 'is-hearing', true);
    setText(wordNote, 'Listening. Let go when you have said it.'); setClass(wordNote, 'is-warn', false);
    sfx('click', 0.5);
    lookAtBox();
    const endMic = (note: string, warn = false) => {
      micOn = false;
      setClass(micBtn, 'is-on', false); setClass(box, 'is-hearing', false);
      setText(wordNote, note || (plain ? 'Plain choices are all the court can hear just now.' : '')); setClass(wordNote, 'is-warn', warn);
    };
    try {
      mic.start({
        onPartial: text => { if (micOn) { box.value = micBase + text; box.scrollTop = box.scrollHeight; } },
        onFinal: text => {
          const said = (micBase + text).trim();
          endMic(said ? 'Heard. Press Enter to say it, or mend it first.' : '');
          if (said) { box.value = said; sendBtn.classList.add('is-ready'); if (!narrow()) box.focus(); }
        },
        onError: code => {
          if (code === 'denied' || code === 'unsupported') micBtn.hidden = true;
          endMic(code === 'denied' ? 'The court\'s ear is stopped. Type your word instead.' : code === 'no_speech' ? 'Nothing was heard. Try again, or type.' : 'The court did not catch that. Type your word instead.', true);
        },
      });
    } catch { endMic('The court did not catch that. Type your word instead.', true); }
  }
  function stopMic(): void {
    if (!micOn) return;
    try { ctx.word.mic.stop(); } catch { /* already stopped */ }
  }
  micBtn.addEventListener('pointerdown', ev => { ev.preventDefault(); try { micBtn.setPointerCapture(ev.pointerId); } catch { /* fine */ } startMic(); });
  micBtn.addEventListener('pointerup', () => stopMic());
  micBtn.addEventListener('pointercancel', () => stopMic());
  micBtn.addEventListener('contextmenu', ev => ev.preventDefault());
  micBtn.addEventListener('keydown', ev => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); startMic(); } });
  micBtn.addEventListener('keyup', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); stopMic(); } });

  box.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); void speak(); return; }
    if (ev.key.length === 1) lookAtBox();
  });
  box.addEventListener('input', () => sendBtn.classList.remove('is-ready'));
  box.addEventListener('focus', () => lookAtBox());

  // keys for the whole screen: Esc leaves; hold backquote to talk
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); requestClose(); return; }
    if (ev.key === '`' && ctx.word.mic.supported) { ev.preventDefault(); if (!ev.repeat) { micKeyHeld = true; startMic(); } return; }
    ev.stopPropagation();   // typing here must never reach the table's hotkeys
  });
  el.addEventListener('keyup', ev => {
    if (ev.key === '`' && micKeyHeld) { micKeyHeld = false; stopMic(); }
    ev.stopPropagation();
  });

  // ── opening a matter ──
  function show(id: Id | null): void {
    token++;
    stopTyping(false);
    stopMic();
    window.clearTimeout(enterTimer);
    dotsLine = null; lastWho = null; waiting = false; ended = null; typing = null;
    dropPortrait();
    clear(scroll); scroll.appendChild(doodleEl);
    clear(ruling); ruling.hidden = true;
    word.hidden = false; box.disabled = false; box.value = '';
    sendBtn.disabled = false; micBtn.disabled = false; leaveBtn.disabled = false; leaveTop.disabled = false;
    who.classList.remove('is-facts');
    factsSig = ''; queueSig = ''; dirty = true;

    const state = ctx.state();
    const inc = id ? state.incidents[id] : undefined;
    const d = inc ? INCIDENT_BY_ID[inc.defId] : undefined;
    let s: AudienceSession | null = null;
    local = false;
    if (inc && inc.state === 'open') {
      try { s = ctx.word.openAudience(inc.id); } catch { s = null; }
      if (!s && d) { s = localSession(ctx, inc, d, speakerOf(state, inc, d)); local = true; }
    }
    session = s; incId = inc?.id ?? null; def = d ?? null; speaker = s?.speaker ?? null;

    el.classList.remove('is-entering'); void el.offsetWidth; el.classList.add('is-entering');
    enterTimer = window.setTimeout(() => el.classList.remove('is-entering'), 2200);

    if (!s || !inc) {
      who.style.visibility = 'hidden';
      leaveBtn.hidden = true; leaveTop.hidden = true;
      renderMatter(state, null, 'The Yard Is Empty');
      renderClock(state); renderQueue(state); renderWhispers();
      plainEnding('nobody', 'No one is waiting', 'No one waits on that matter. It may have settled itself, or been settled for you.');
      return;
    }
    who.style.visibility = '';
    leaveBtn.hidden = false; leaveTop.hidden = false;
    setText(nameEl, s.speaker.name);
    setText(descEl, describe(state));
    mood = s.speaker.mood;
    mountPortrait();
    setMood(mood);
    renderMatter(state, inc, s.title || d?.title || 'A Matter');
    renderFacts(state);
    renderClock(state);
    renderQueue(state);
    micBtn.hidden = !ctx.word.mic.supported;
    plain = false;
    refreshPlain();
    renderWhispers();

    if (s.done) {     // already ruled elsewhere while we were away
      for (const ln of s.lines) if (ln.text.trim()) void addLine(ln.who, ln.text);
      plainEnding('settled', 'Already ruled', 'This matter has had its ruling. There is nothing more to say.');
      return;
    }
    const fresh = s.lines.length <= 1;
    if (!fresh) { for (const ln of s.lines) if (ln.text.trim()) void addLine(ln.who, ln.text); }
    else {
      addUsher(shownIn(state));
      const first = s.lines[0]?.text ?? '';
      const tok = token;
      const begin = () => { if (tok === token && isOpen && first) void addLine('petitioner', first, true); };
      if (TYPING.instant || reducedMotion()) begin(); else window.setTimeout(begin, 750);
    }
    if (!narrow()) window.setTimeout(() => { if (isOpen && !ended) box.focus(); }, 60);
  }
  function hop(id: Id): void {
    if (!isOpen || id === incId || waiting) return;
    leaveSession(false);
    sfx('page', 0.6);
    show(id);
  }
  function leaveSession(tell: boolean): void {
    const s = session;
    if (!s || ended) return;
    try { s.leave(); } catch { /* the word layer will forget them on its own */ }
    if (tell && speaker) ctx.toast(`${speaker.first} will wait at your door.`, 'info');
  }
  function requestClose(): void {
    if (waiting && performance.now() - waitingSince < 12000) return;
    ctx.close('audience');
  }

  const resizer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (isOpen && speaker) { mountPortrait(); toBottom(); } }) : null;

  return {
    el,
    open(arg?: unknown): void {
      const asked = typeof arg === 'string' ? arg : (arg && typeof arg === 'object' && 'incidentId' in arg ? String((arg as { incidentId: unknown }).incidentId) : null);
      if (isOpen) { if (asked && asked !== incId) hop(asked); return; }
      isOpen = true;
      el.hidden = false;
      try { releaseCrawl = ctx.holdCrawl(); } catch { releaseCrawl = null; }
      try { ctx.renderer.setMode('audience'); } catch { /* no table to dim */ }
      try { ctx.audio.setMood('court'); } catch { /* silence is fine */ }
      sfx('door', 0.7);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      resizer?.observe(el);
      try { unsubWord = ctx.word.onChange(() => { if (isOpen && !ended) refreshPlain(); }); } catch { unsubWord = null; }
      try { void ctx.word.ready.then(() => { if (isOpen && !ended) refreshPlain(); }); } catch { /* stays as it is */ }
      show(asked ?? audienceIncidents(ctx.state())[0]?.id ?? null);
    },
    close(): void {
      if (!isOpen) { el.hidden = true; return; }
      isOpen = false;
      token++;
      window.clearTimeout(enterTimer);
      stopMic();
      stopTyping(false);
      leaveSession(true);
      session = null; speaker = null; incId = null; def = null; ended = null; waiting = false; typing = null;
      window.removeEventListener('pointermove', onPointerMove);
      resizer?.disconnect();
      try { unsubWord?.(); } catch { /* gone already */ }
      unsubWord = null;
      try { releaseCrawl?.(); } catch { /* the shell will restore speed */ }
      releaseCrawl = null;
      try { ctx.renderer.setMode('play'); } catch { /* no table */ }
      dropPortrait();
      for (const p of queuePortraits) p.dispose();
      queuePortraits = []; queueSig = '';
      clear(queueEl);
      el.hidden = true;
    },
    update(state: GameState, dt: number): void {
      if (!isOpen) return;
      tick += dt;
      if (!dirty && tick < 0.3) return;
      tick = 0; dirty = false;
      renderClock(state);
      if (speaker) { renderFacts(state); setText(descEl, describe(state)); }
      renderQueue(state);
      if (!ended && !waiting && incId) {
        const inc = state.incidents[incId];
        if (!inc || inc.state !== 'open') settledElsewhere(state);
      }
      if (waiting && performance.now() - waitingSince > 12000) { leaveBtn.disabled = false; leaveTop.disabled = false; }
      if (portrait && !typing && performance.now() - lastPointerAt > 4500) portrait.lookAt(null);
    },
    handleEvents(events: SimEvent[]): void {
      if (!isOpen) return;
      for (const e of events) {
        if (e.type === 'incident' || e.type === 'incident_resolved' || e.type === 'incident_expired' || e.type === 'tenant_out' || e.type === 'oath') { dirty = true; factsSig = ''; }
      }
    },
  };
}
