/**
 * The inspector: what is selected, as a compact parchment sheet.
 * A building, a household, a delegate or an applicant. Everything here updates
 * live and nothing here pauses the world.
 *
 * The sheet is rebuilt only when its *structure* changes (someone moves in, an
 * incident opens, a job starts). Numbers that drift (condition, happiness,
 * days left, progress) are refreshed in place a few times a second, so a
 * button is never swapped out from under the pointer.
 *
 * Selection arrives through `onSelect` (buildings and townsfolk from the
 * frame). Delegates and applicants can also be reached from inside a sheet.
 */
import type { UICtx } from '../api';
import type { Part } from './part';
import type {
  GameState, SimEvent, Id, Building, Tenant, StaffMember, Applicant, Incident, Job, Oath, JobKind, StaffRole,
} from '../../sim/types';
import { DAYS_PER_MONTH } from '../../sim/types';
import { fmtDate } from '../../sim/core';
import { desirability } from '../../sim/world';
import { marketRent } from '../../sim/economy';
import * as economySim from '../../sim/economy';
import * as buildingsSim from '../../sim/buildings';
import type { IconId, TraitId, PetKind, Species, TradeId } from '../../data/ids';
import { ROLE_TITLES } from '../../data/ids';
import type { BuildingDef, IncidentDef, OutcomeDef } from '../../data/schema';
import { BUILDINGS, BAL, TRAIT_DEFS, TAG_DEFS, TRADE_DEFS, SPECIES_DEFS, TEMPERAMENT_DEFS, INCIDENT_BY_ID, CHARACTERS } from '../../data';
import { h, clear, fromHTML, addStyle, setText, setClass, num, crowns, plural, cap, button, tag } from '../kit';
import { iconSvg } from '../icons';
import { createPortrait, type Portrait, type PortraitSpec } from '../portraits';
import type { Mood } from '../../word/api';
import { TOOLS_CSS } from '../css/tools';
import { pictogram } from './buildmenu';
import { speakTo } from './wordbar';

type View = { kind: 'building' | 'tenant' | 'staff' | 'applicant'; id: Id };
type AnySel = { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id };
type Child = Node | string | number | null | false | undefined | Child[];

// ───────────────────────── words ─────────────────────────

const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numWord = (n: number): string => NUM_WORDS[n] ?? String(n);
const aAn = (word: string): string => (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;
const days = (n: number): string => plural(Math.max(0, Math.ceil(n)), 'day');

function conditionWord(b: Building): string {
  if (b.state === 'ruined') return 'A ruin';
  const c = b.condition;
  return c >= 90 ? 'Handsome' : c >= 75 ? 'Sound' : c >= 55 ? 'Weathered' : c >= 40 ? 'Shabby' : c >= 25 ? 'Sagging' : c >= 10 ? 'Held up by habit' : 'Mostly a memory';
}
const desirWord = (d: number): string => (d >= 80 ? 'Coveted' : d >= 65 ? 'Pleasant' : d >= 45 ? 'Middling' : d >= 30 ? 'Unlovely' : 'Shunned');
const happyWord = (v: number): string => (v >= 85 ? 'Delighted' : v >= 70 ? 'Content' : v >= 55 ? 'Settled' : v >= 40 ? 'Grumbling' : v >= 25 ? 'Unhappy' : 'Packing, in spirit');
const loyalWord = (v: number): string => (v >= 80 ? 'Devoted' : v >= 60 ? 'Steady' : v >= 40 ? 'Wavering' : v >= 20 ? 'Sullen' : 'Reading other notice boards');
const meterKind = (v: number): string => (v >= 60 ? 'good' : v >= 35 ? 'warn' : 'bad');
const moodOf = (v: number): Mood => (v >= 80 ? 'delighted' : v >= 62 ? 'pleased' : v >= 42 ? 'neutral' : v >= 25 ? 'worried' : 'annoyed');

function rentRead(rent: number, market: number): string {
  const r = rent / Math.max(1, market);
  return r <= 0.75 ? 'A bargain. They will queue.'
    : r <= 0.93 ? 'Keen. It will not stand empty long.'
    : r <= 1.07 ? 'Fair. About what the market bears.'
    : r <= 1.25 ? 'Dear. Fewer will knock.'
    : r <= 1.5 ? 'Steep. Expect a wait.'
    : 'Fanciful. The shingle will fade before anyone signs.';
}

const AUTHORITY = ['Handles the routine. Asks you about the rest.', 'May rule on matters in their own domain.', 'Trusted with full judgment.'];
const IDLE: Record<StaffRole, string> = {
  mason: 'At liberty. Leaning on something, professionally.',
  bailiff: 'At liberty. Polishing the keys.',
  crier: 'At liberty. Resting the voice, mercifully.',
  steward: 'At liberty. Counting it again, to be sure.',
};
const JOB_DOING: Record<JobKind, string> = {
  build: 'raising', repair: 'mending', renovate: 'renovating', demolish: 'pulling down', clear_land: 'clearing land near',
  collect: 'collecting the purse at', show: 'showing', screen: 'asking after references for', serve_notice: 'nailing a notice to',
  evict: 'putting out the household at', inspect: 'inspecting', incident: 'seeing to a matter at', visit: 'paying a call at',
};
const PET_NAMES: Record<PetKind, string> = {
  cat: 'a cat', dog: 'a dog', goat: 'a goat', chicken: 'chickens', pig: 'a pig', owl: 'an owl', griffin: 'a griffin',
  small_dragon: 'a small dragon', mimic: 'a mimic', giant_snail: 'a giant snail', wolf: 'a wolf',
};
function listWords(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}
const peopleLine = (species: Species, trade: TradeId): string => `${cap(SPECIES_DEFS[species].adjective)} ${TRADE_DEFS[trade].name.toLowerCase()}`;
const sizeLine = (n: number): string => (n <= 1 ? 'living alone' : `a household of ${numWord(n)}`);

// ───────────────────────── derived numbers ─────────────────────────

function desirOf(st: GameState, b: Building): number {
  try { const v = desirability(st, b); if (Number.isFinite(v)) return Math.max(0, Math.min(100, v)); } catch { /* fall through to our own estimate */ }
  let d = 50 + (b.condition - 60) / 4;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (const o of Object.values(st.buildings)) {
    const aura = BUILDINGS[o.type].aura;
    if (!aura || o.id === b.id || o.state !== 'ready') continue;
    const dist = Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy);
    if (dist <= aura.radius) d += aura.amount * (1 - dist / (aura.radius + 1));
  }
  return Math.max(0, Math.min(100, d));
}
function marketOf(st: GameState, b: Building): number {
  try { const v = marketRent(st, b); if (Number.isFinite(v) && v > 0) return Math.round(v); } catch { /* fall through */ }
  const base = BUILDINGS[b.type].baseRent;
  return Math.max(1, Math.round(base * (0.6 + 0.8 * desirOf(st, b) / 100) * (0.7 + 0.3 * b.condition / 100)));
}
/** The highest rent the sim will accept for this building (it owns that rule); a generous guess if it does not say. */
function rentCeiling(b: Building): number {
  const fn = (economySim as unknown as { maxAskingRent?: (b: Building) => number }).maxAskingRent;
  try { const v = fn?.(b); if (typeof v === 'number' && Number.isFinite(v) && v >= 1) return Math.round(v); } catch { /* fall through */ }
  return Math.max(2, BUILDINGS[b.type].baseRent * 5);
}
interface Quote { cost: number; days: number; restores: number }
/** What the sim would charge for work on this building right now, when it will say. */
function quoteFor(kind: 'repair' | 'renovate' | 'demolish', st: GameState, b: Building): Quote | null {
  const fn = (buildingsSim as unknown as Record<string, unknown>)[kind + 'Quote'];
  if (typeof fn !== 'function') return null;
  try {
    const q = (fn as (s: GameState, b: Building) => Quote)(st, b);
    return q && Number.isFinite(q.cost) && Number.isFinite(q.days) ? { cost: Math.max(0, Math.round(q.cost)), days: q.days, restores: q.restores } : null;
  } catch { return null; }
}
const workDays = (d: number): string => (d <= 1.2 ? 'a day or so' : `about ${plural(Math.round(d), 'day')}`);
const openAt = (st: GameState, buildingId: Id): Incident[] =>
  Object.values(st.incidents).filter(i => i.buildingId === buildingId && (i.state === 'open' || i.state === 'in_progress'));
const openFor = (st: GameState, tenantId: Id): Incident[] =>
  Object.values(st.incidents).filter(i => i.tenantId === tenantId && (i.state === 'open' || i.state === 'in_progress'));
const jobsAt = (st: GameState, buildingId: Id): Job[] =>
  Object.values(st.jobs).filter(j => j.buildingId === buildingId && (j.state === 'queued' || j.state === 'traveling' || j.state === 'working'));
const staffByRole = (st: GameState, role: StaffRole): StaffMember | null => Object.values(st.staff).find(m => m.role === role) ?? null;

function workerName(st: GameState, job: Job): string {
  if (!job.assignee) return '';
  const a = st.actors[job.assignee];
  if (!a) return '';
  if (a.kind === 'ruler') return 'You';
  const m = a.refId ? st.staff[a.refId] : null;
  return m ? `${m.first} the ${ROLE_TITLES[m.role]}` : 'Someone';
}
function jobLine(st: GameState, job: Job): string {
  const who = workerName(st, job);
  if (!who) return job.kind === 'build' ? 'The timber is stacked. Waiting for a free pair of hands.' : 'Waiting for a free pair of hands.';
  const are = who === 'You';
  const doing: Partial<Record<JobKind, string>> = { build: 'raising it', repair: 'mending it', renovate: 'renovating it', demolish: 'pulling it down', collect: 'collecting the purse', show: 'showing the place', inspect: 'inspecting it', incident: 'seeing to it', visit: 'paying a call', serve_notice: 'nailing up the notice', evict: 'at the door with the writ', screen: 'asking after references' };
  const what = doing[job.kind] ?? 'at work';
  return job.state === 'working' ? `${who} ${are ? 'are' : 'is'} ${what}.` : `${who} ${are ? 'are' : 'is'} on the way.`;
}

function lateWords(st: GameState, t: Tenant): { text: string; bad: boolean } {
  const owes = t.arrears > 0 ? ` They owe ${crowns(t.arrears)}.` : '';
  switch (t.lateStage) {
    case 'grace': return { text: 'The rent is due. Still within the grace days.', bad: false };
    case 'late': return { text: `Late by ${days(t.daysLate)}.${owes}`, bad: true };
    case 'plan': return { text: t.plan ? `Paying it off: ${plural(t.plan.left, 'instalment')} of ${t.plan.each} to come.` : `Paying it off in pieces.${owes}`, bad: false };
    case 'noticed': return { text: `A Notice to Quit is on the door.${t.courtDay !== null ? ` The Reeve's Court sits in ${days(t.courtDay - st.day)}.` : ''}${owes}`, bad: true };
    case 'court': return { text: `Before the Reeve's Court.${t.courtDay !== null ? ` A ruling in ${days(t.courtDay - st.day)}.` : ''}${owes}`, bad: true };
    case 'writ': return { text: `The court has ruled against them. The writ is yours to use.${owes}`, bad: true };
    default: return t.arrears > 0 ? { text: `They owe ${crowns(t.arrears)} from before.`, bad: true } : { text: 'Paid up.', bad: false };
  }
}

/** three purses, sized to what the household pays: a kindness, half a month, a month */
function giftSizes(t: Tenant): number[] {
  const rent = Math.max(4, t.lease?.rent ?? 8);
  return [Math.max(2, Math.round(rent / 4)), Math.max(3, Math.round(rent / 2)), rent];
}
function reasonsFor(st: GameState, t: Tenant): { good: boolean; text: string }[] {
  const out: { good: boolean; text: string }[] = [];
  const b = t.buildingId ? st.buildings[t.buildingId] : null;
  if (t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') out.push({ good: false, text: 'A Notice to Quit hangs on their door.' });
  for (const inc of openFor(st, t.id).slice(0, 2)) {
    const def = INCIDENT_BY_ID[inc.defId];
    if (def && def.decision !== 'late_rent' && def.decision !== 'eviction_ready') out.push({ good: false, text: `Waiting on you: ${def.title}.` });
  }
  if (st.oaths.some(o => o.toTenantId === t.id && o.state === 'broken' && o.settledDay !== null && st.day - o.settledDay < 180)) out.push({ good: false, text: 'You broke your word to them.' });
  if (b) {
    if (b.condition < 35) out.push({ good: false, text: 'The house is coming down around them.' });
    else if (b.condition < 55) out.push({ good: false, text: 'The house is shabby.' });
    else if (b.condition >= 85) out.push({ good: true, text: 'The house is in fine repair.' });
    if (t.lease) {
      const r = t.lease.rent / Math.max(1, marketOf(st, b));
      if (r > 1.2) out.push({ good: false, text: 'The rent is steep for what it is.' });
      else if (r < 0.85) out.push({ good: true, text: 'The rent is kind.' });
    }
    const d = desirOf(st, b);
    if (d >= 70) out.push({ good: true, text: 'A pleasant spot to live.' });
    else if (d < 35) out.push({ good: false, text: 'A poor spot, with nothing nice nearby.' });
  }
  const recent = t.memory.filter(m => st.day - m.day < 120);
  const last = recent[recent.length - 1];
  if (last) out.push({ good: last.valence > 0, text: last.valence > 0 ? 'A kindness, lately remembered.' : 'A grievance, lately remembered.' });
  if (st.oaths.some(o => o.toTenantId === t.id && o.state === 'kept' && o.settledDay !== null && st.day - o.settledDay < 180)) out.push({ good: true, text: 'You kept your word to them.' });
  if (t.revealed.includes('complainer')) out.push({ good: false, text: 'A complainer by temperament.' });
  if (t.revealed.includes('stoic')) out.push({ good: true, text: 'Stoic. Says it is fine.' });
  return out.slice(0, 4);
}

// ───────────────────────── small drawings ─────────────────────────

/** The same face a household wears everywhere else: seed, trade, and a named character's own looks. */
function householdFace(hh: { species: Species; portraitSeed: number; trade: TradeId; character: string | null }, size: number): PortraitSpec {
  const spec: PortraitSpec = { species: hh.species, seed: hh.portraitSeed, trade: hh.trade, size, frame: true };
  const ch = hh.character ? CHARACTERS.find(c => c.id === hh.character) : undefined;
  if (ch) spec.look = ch.look;
  return spec;
}

const ico = (id: IconId): HTMLElement => fromHTML(iconSvg(id));
function faceSvg(level: number): string {
  const mouth = ['M7 14.8q3-3.2 6 0', 'M7.4 14.2q2.6-1.5 5.2 0', 'M7.5 13.5h5', 'M7.2 12.7q2.8 2.3 5.6 0', 'M6.9 12.2q3.1 4 6.2 0Z'][level]!;
  const brows = level === 0 ? '<path d="M5.5 6.4l2.7 1.1M14.5 6.4l-2.7 1.1"/>' : level === 4 ? '<path d="M5.7 6.5q1.3-1 2.5-.2M11.8 6.3q1.2-.8 2.5.2"/>' : '';
  const wash = ['#dba392', '#e3c59c', '#ecdfb6', '#d3dfb0', '#bdd69d'][level]!;
  return `<svg class="ll-face" viewBox="0 0 20 20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8.3" fill="${wash}"/><circle cx="7.3" cy="9" r=".95" fill="currentColor" stroke="none"/><circle cx="12.7" cy="9" r=".95" fill="currentColor" stroke="none"/>${brows}<path d="${mouth}"/></g></svg>`;
}
const faceLevel = (v: number): number => (v < 20 ? 0 : v < 40 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4);
const HEART = '<svg class="ll-in-mark is-heart" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.6C3.4 10.2 1.8 7.6 2.6 5.2 3.4 2.9 6.5 2.6 8 5c1.5-2.4 4.6-2.1 5.4.2.8 2.4-.8 5-5.4 8.4Z" fill="var(--rubric)" stroke="var(--rubric-2)" stroke-width="1" stroke-linejoin="round"/></svg>';
const THORN = '<svg class="ll-in-mark is-thorn" viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="var(--ink-2)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13.4Q7 11 14 2.6"/><path d="M5 11.6L3.4 8.4M7.6 9.4L10.8 10.4M9.8 6.8L8.4 3.8M11.8 4.6L14.4 5.6"/></g></svg>';
const QSEAL = '<span class="ll-in-qseal" aria-hidden="true">?</span>';

// ───────────────────────── the part ─────────────────────────

export interface InspectorPart extends Part {
  /** Esc: close what is open inside the sheet, and say so (clearing the selection is the frame's) */
  escape(): boolean;
  /** the sim was replaced */
  reset(): void;
  dispose(): void;
}

export function mount(ctx: UICtx): InspectorPart {
  addStyle('tools', TOOLS_CSS);

  const head = h('header', { class: 'll-in-head' });
  const body = h('div', { class: 'll-in-body ll-scrollbox' });
  // what you can do stays in reach at the foot of the sheet, however long the sheet runs
  const foot = h('footer', { class: 'll-in-foot' });
  const sheet = h('section', { class: 'll-in-sheet ll-parch', 'aria-label': 'Selected' }, head, body, foot);
  const el = h('div', { class: 'll-part-inspector', hidden: true }, sheet);

  let view: View | null = null;
  let shownKey = '';
  let sig = '';
  let live: (() => void)[] = [];
  let visible = true;
  let acc = 0;
  let holding = false;       // a pointer is down inside the sheet
  let busy = false;          // renaming, or dragging the rent
  let giftOpen = false;
  const faces = new Map<string, Portrait>();
  const usedFaces = new Set<string>();

  sheet.addEventListener('pointerdown', () => { holding = true; });
  const release = (): void => { holding = false; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // ── pieces
  function face(key: string, spec: PortraitSpec, mood?: Mood): HTMLElement {
    let p = faces.get(key);
    if (!p) { p = createPortrait(spec); faces.set(key, p); }
    usedFaces.add(key);
    if (mood) { try { p.setMood(mood); } catch { /* a portrait still being painted */ } }
    return h('span', { class: 'll-in-face', style: { width: spec.size + 'px', height: spec.size + 'px' } }, p.el);
  }
  function sec(title: string | null, ...kids: Child[]): HTMLElement {
    return h('section', { class: 'll-in-sec' }, title ? h('h3', { class: 'll-sub ll-in-h' }, title) : null, kids);
  }
  function liveText(cls: string, get: (st: GameState) => string): HTMLElement {
    const n = h('span', { class: cls });
    live.push(() => setText(n, get(ctx.state())));
    return n;
  }
  function liveMeter(get: (st: GameState) => number, kind?: 'gold' | 'ink'): HTMLElement {
    const bar = h('i');
    const m = h('div', { class: 'll-meter', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar);
    let lastCls = '';
    live.push(() => {
      const v = Math.max(0, Math.min(100, get(ctx.state())));
      const w = v.toFixed(0) + '%';
      if (bar.style.width !== w) { bar.style.width = w; m.setAttribute('aria-valuenow', v.toFixed(0)); }
      const cls = 'll-meter-' + (kind ?? meterKind(v));
      if (cls !== lastCls) { if (lastCls) m.classList.remove(lastCls); m.classList.add(cls); lastCls = cls; }
    });
    return m;
  }
  function liveFace(get: (st: GameState) => number): HTMLElement {
    const box = h('span', { class: 'll-in-facebox' });
    let lvl = -1;
    live.push(() => { const l = faceLevel(get(ctx.state())); if (l !== lvl) { lvl = l; box.innerHTML = faceSvg(l); } });
    return box;
  }
  /** label, word and bar on one line: "Condition   Sound  ▓▓▓▓░" */
  function gauge(label: string, word: (st: GameState) => string, value: (st: GameState) => number, tip?: string, kind?: 'gold' | 'ink'): HTMLElement {
    return h('div', { class: 'll-in-gauge', 'data-tip': tip },
      h('span', { class: 'll-stat-k' }, label), liveText('ll-in-word', word), liveMeter(value, kind));
  }
  function line(label: string, value: Child, cls = ''): HTMLElement {
    return h('div', { class: 'll-stat ll-in-line ' + cls }, h('span', { class: 'll-stat-k' }, label), h('span', { class: 'll-stat-v' }, value));
  }
  function act(label: string | Child[], onClick: () => void, opts: { kind?: 'primary' | 'plain' | 'danger' | 'quiet'; tip?: string; disabled?: boolean; icon?: IconId } = {}): HTMLButtonElement {
    const b = button(opts.icon ? [ico(opts.icon), ' ', label] : label, () => onClick(), { kind: opts.kind, disabled: opts.disabled, class: 'll-in-act' });
    if (opts.tip) b.setAttribute('data-tip', opts.tip);
    return b;
  }
  /** a weighty button asks once before it acts */
  function askBtn(label: string, ask: string, onYes: () => void, opts: { tip?: string; disabled?: boolean } = {}): HTMLButtonElement {
    let armedAt = -1e9, timer = 0;
    const reset = (): void => { armedAt = -1e9; b.textContent = label; b.classList.remove('is-asking'); };
    const b = button(label, () => {
      if (performance.now() - armedAt < 4500) { window.clearTimeout(timer); reset(); onYes(); return; }
      armedAt = performance.now(); b.textContent = ask; b.classList.add('is-asking');
      timer = window.setTimeout(reset, 4500);
    }, { kind: 'danger', disabled: opts.disabled, class: 'll-in-act ll-in-grave' });
    if (opts.tip) b.setAttribute('data-tip', opts.tip);
    return b;
  }
  function rowBtn(onClick: () => void, ...kids: Child[]): HTMLElement {
    return h('div', {
      class: 'll-in-row is-link', role: 'button', tabIndex: 0,
      onclick: () => onClick(),
      onkeydown: (e: KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } },
    }, kids);
  }
  function go(v: View | null): void { view = v; giftOpen = false; render(); }
  /** select through the frame (so the table's ring follows), then make sure we are showing it */
  const selectAny = ctx.select as (sel: AnySel | null) => void;
  function pick(sel: AnySel): void {
    const want: View | null = sel.applicantId ? { kind: 'applicant', id: sel.applicantId } : sel.staffId ? { kind: 'staff', id: sel.staffId }
      : sel.tenantId ? { kind: 'tenant', id: sel.tenantId } : sel.buildingId ? { kind: 'building', id: sel.buildingId } : null;
    if (!want) return;
    try { selectAny(sel); } catch { /* a frame that only knows buildings and households */ }
    if (!view || view.kind !== want.kind || view.id !== want.id) go(want);
  }
  function focusOn(target: { buildingId?: Id; actorId?: Id }): void {
    try { ctx.renderer.focus(target); } catch { /* no table yet */ }
  }
  function setHead(vignette: HTMLElement, title: HTMLElement, sub: Child[], find?: () => void): void {
    head.append(
      vignette,
      h('div', { class: 'll-in-titles' }, title, h('p', { class: 'll-sub ll-in-sub' }, sub)),
      h('div', { class: 'll-in-headbtns' },
        find ? h('button', { class: 'll-in-find', type: 'button', 'aria-label': 'Show on the table', 'data-tip': 'Show on the table', onclick: find }, ico('eye')) : null,
        h('button', { class: 'll-seal ll-close', type: 'button', 'aria-label': 'Close', onclick: () => { view = null; ctx.select(null); render(); } }, '✕')));
  }
  const linkTo = (label: string, onClick: () => void): HTMLElement => h('button', { class: 'll-in-link', type: 'button', onclick: onClick }, label);

  // ── building
  function renderBuilding(st: GameState, b: Building | undefined): boolean {
    if (!b) return false;
    const def = BUILDINGS[b.type];
    const id = b.id;
    const B = (s2: GameState): Building | undefined => s2.buildings[id];
    const typeName = b.type === 'seat' ? (def.levelNames?.[b.level - 1] ?? def.name) : def.name;
    const kind = def.category === 'housing' ? (def.units > 1 ? `home to ${numWord(def.units)} households` : 'a home for one household')
      : def.category === 'commercial' ? 'let to a trade'
      : def.category === 'amenity' ? 'an amenity'
      : def.category === 'staff' ? `where your ${ROLE_TITLES[def.staffRole ?? 'mason']} stands`
      : 'your seat';

    // name, click to rename
    const title = h('h2', { class: 'll-title ll-in-name', tabIndex: 0, role: 'button', 'data-tip': 'Click to rename' }, h('span', null, b.name), ico('quill'));
    const startRename = (): void => {
      if (busy) return;
      busy = true;
      const input = h('input', { class: 'll-input ll-in-rename', type: 'text', value: b.name, maxLength: 40, 'aria-label': 'Name of this building' });
      let done = false;
      const finish = (commit: boolean): void => {
        if (done) return; done = true; busy = false;
        const name = input.value.trim().replace(/\s+/g, ' ');
        if (commit && name && name !== b.name) ctx.act({ type: 'rename_building', buildingId: id, name });
        sig = ''; render();
      };
      input.addEventListener('keydown', (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); });
      input.addEventListener('blur', () => finish(true));
      title.replaceWith(input);
      input.focus(); input.select();
    };
    title.addEventListener('click', startRename);
    title.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startRename(); } });
    setHead(h('span', { class: 'll-in-vig', html: pictogram(b.type, b.level) }), title,
      [b.name === typeName ? cap(kind) : `${typeName}, ${kind}`], () => focusOn({ buildingId: id }));

    // state
    const jobs = jobsAt(st, id);
    if (b.state === 'building') {
      const job = jobs.find(j => j.kind === 'build');
      body.append(sec(null,
        h('div', { class: 'll-in-gauge' }, h('span', { class: 'll-stat-k' }, 'Rising'),
          liveText('ll-in-word ll-num', s2 => Math.round((B(s2)?.progress ?? 1) * 100) + ' in the hundred'),
          liveMeter(s2 => (B(s2)?.progress ?? 1) * 100, 'gold')),
        h('p', { class: 'll-note' }, job ? jobLine(st, job) : 'The timber is stacked. Waiting for a free pair of hands.')));
    } else if (b.state === 'ruined') {
      body.append(sec(null, h('p', { class: 'll-in-warn' }, 'A ruin. Nothing short of a renovation will bring it back.')));
    } else {
      const s1 = sec(null, gauge('Condition', s2 => { const x = B(s2); return x ? conditionWord(x) : ''; }, s2 => B(s2)?.condition ?? 0,
        'How well it is holding together. Disrepair breeds complaints, and worse.'));
      if (def.units > 0) s1.append(gauge('The spot', s2 => { const x = B(s2); return x ? desirWord(desirOf(s2, x)) : ''; }, s2 => { const x = B(s2); return x ? desirOf(s2, x) : 0; },
        'Desirability: what stands nearby, the road, the state of the place. It sets what the market will pay.', 'ink'));
      for (const j of jobs) if (j.kind !== 'incident') s1.append(h('p', { class: 'll-note ll-in-job' }, ico('hammer'), ' ', jobLine(st, j)));
      body.append(s1);
    }
    if (b.squatters) {
      const since = b.squatters.sinceDay;
      body.append(sec(null, h('p', { class: 'll-in-warn' }, ico('goblin'), ' ', `${cap(b.squatters.kind.replace(/_/g, ' '))} are in residence, without a lease. `,
        liveText('', s2 => `${days(s2.day - since)} now. After a year and a day it is hearth-right.`))));
    }

    // matters at this door
    const incs = openAt(st, id);
    if (incs.length) body.append(sec('Matters at this door', incs.map(inc => incidentBlock(st, inc))));

    // who lives here
    if (def.units > 0 && b.state === 'ready') {
      const apps = Object.values(st.applicants).filter(a => a.buildingId === id);
      const rows: HTMLElement[] = [];
      b.units.forEach((u, i) => {
        const t = u.tenantId ? st.tenants[u.tenantId] : null;
        if (t) {
          const tid = t.id;
          const late = t.lateStage !== 'none' && t.lateStage !== 'grace';
          rows.push(rowBtn(() => pick({ tenantId: tid }),
            face('t' + tid + ':40', householdFace(t, 40), moodOf(t.happiness)),
            h('div', { class: 'll-in-rowtext' },
              h('div', { class: 'll-in-rowname' }, t.name),
              h('div', { class: 'll-in-rowsub' }, `rent ${t.lease?.rent ?? 0}`,
                late ? tag(t.lateStage === 'plan' ? 'paying it off' : t.lateStage === 'late' ? `late ${days(t.daysLate)}` : 'notice served', 'bad') : t.arrears > 0 ? tag(`owes ${num(t.arrears)}`, 'bad') : null)),
            u.purse > 0 ? h('button', {
              class: 'll-in-purse', type: 'button', 'data-tip': 'A purse waits on the step. Send for it.', 'aria-label': `Collect the purse of ${u.purse}`,
              onclick: (e: Event) => { e.stopPropagation(); ctx.act({ type: 'collect_purse', buildingId: id, unit: i }); },
            }, ico('purse'), String(u.purse)) : null,
            liveFace(s2 => s2.tenants[tid]?.happiness ?? 50)));
        } else {
          const since = u.vacantSince;
          rows.push(h('div', { class: 'll-in-row is-vacant' },
            h('span', { class: 'll-in-shingle' + (u.listed ? ' is-out' : '') }, u.listed ? 'To let' : 'Shut'),
            h('div', { class: 'll-in-rowtext' },
              h('div', { class: 'll-in-rowname' }, b.squatters ? 'Occupied, after a fashion' : 'Vacant'),
              since !== null ? liveText('ll-in-rowsub', s2 => `${days(Math.floor(s2.day - since))} empty`) : null)));
          for (const a of apps.filter(x => x.unit === i)) {
            const aid = a.id;
            rows.push(rowBtn(() => pick({ applicantId: aid }),
              face('p' + aid + ':40', householdFace(a.household, 40)),
              h('div', { class: 'll-in-rowtext' },
                h('div', { class: 'll-in-rowname' }, a.household.name),
                h('div', { class: 'll-in-rowsub' }, a.shown ? 'Has seen it. Awaits your word.' : 'Has applied. Waiting to be shown round.')),
              tag('applicant', 'lapis')));
          }
        }
      });
      body.append(sec(def.category === 'commercial' ? 'Who trades here' : 'Who lives here', rows));
      body.append(rentBlock(st, b, def));
    }

    // what it is for
    if (def.aura && def.category !== 'seat') {
      body.append(sec(null, h('p', { class: 'll-in-plain' }, `${def.aura.amount >= 0 ? 'Lifts' : 'Lowers'} the homes within ${numWord(def.aura.radius)} tiles by up to ${Math.abs(def.aura.amount)}.`)));
    }
    if (def.staffRole) {
      const m = staffByRole(st, def.staffRole);
      if (m) {
        const mid = m.id;
        body.append(sec('The post', rowBtn(() => pick({ staffId: mid }),
          face('s' + mid + ':40', { species: m.species, seed: m.portraitSeed, role: m.role, size: 40, frame: true }),
          h('div', { class: 'll-in-rowtext' }, h('div', { class: 'll-in-rowname' }, m.name), h('div', { class: 'll-in-rowsub' }, `${ROLE_TITLES[m.role]}, ${TEMPERAMENT_DEFS[m.temperament].name.toLowerCase()}`)))));
      } else {
        body.append(sec('The post', h('p', { class: 'll-note' }, b.state === 'ready' ? `Nobody holds it. A ${ROLE_TITLES[def.staffRole]} may be hired at the council.` : `Once it stands, a ${ROLE_TITLES[def.staffRole]} may be hired.`),
          b.state === 'ready' ? h('div', { class: 'll-in-acts' }, act('To the council', () => ctx.open('council'), { icon: 'people' })) : null));
      }
    }
    if (b.type === 'seat') {
      const waiting = Object.values(st.incidents).filter(i => i.state === 'open' && INCIDENT_BY_ID[i.defId]?.audience);
      body.append(sec('Waiting to be heard', waiting.length
        ? waiting.map(inc => { const d = INCIDENT_BY_ID[inc.defId]!; const iid = inc.id; return rowBtn(() => ctx.open('audience', iid),
          h('span', { class: 'll-in-incico' }, ico(d.icon)),
          h('div', { class: 'll-in-rowtext' }, h('div', { class: 'll-in-rowname' }, d.title), inc.vars.tenant ? h('div', { class: 'll-in-rowsub' }, String(inc.vars.tenant)) : null),
          timerText(inc)); })
        : [h('p', { class: 'll-note' }, 'Nobody. Enjoy it.')]));
    }

    // what you can do
    const occupied = b.units.some(u => u.tenantId);
    const first = b.units.find(u => u.tenantId)?.tenantId ?? null;
    const acts: Child[] = [];
    const sound = b.condition >= 99.5;
    const mending = jobs.some(j => j.kind === 'repair' || j.kind === 'renovate');
    const priced = (label: string, q: Quote | null): Child[] => (q ? [label, ' ', h('span', { class: 'll-in-cost ll-num' + (st.gold < q.cost ? ' is-short' : '') }, `(${q.cost})`)] : [label]);
    const terms = (q: Quote | null): string => (q ? ` ${cap(crowns(q.cost))}, ${workDays(q.days)}.` : '');
    if (b.state === 'ready') {
      const rq = sound ? null : quoteFor('repair', st, b), nq = sound ? null : quoteFor('renovate', st, b);
      acts.push(act(priced('Repair', rq), () => ctx.act({ type: 'order_job', kind: 'repair', buildingId: id }), { icon: 'hammer', disabled: sound || mending,
        tip: sound ? 'Nothing wants mending.' : mending ? 'It is already being seen to.' : 'Send someone to mend the worst of it.' + terms(rq) }));
      acts.push(act(priced('Renovate', nq), () => ctx.act({ type: 'order_job', kind: 'renovate', buildingId: id }), { icon: 'trowel', disabled: sound || jobs.some(j => j.kind === 'renovate'),
        tip: sound ? 'It is as good as it will ever be.' : 'Strip it back and do it properly. It comes back as new.' + terms(nq) }));
      acts.push(act('Visit', () => {
        if (first) ctx.act({ type: 'order_job', kind: 'visit', buildingId: id, tenantId: first });
        else { const dir = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as const)[b.rot] ?? [0, 1]; ctx.act({ type: 'go_to', x: b.x + b.w / 2 + dir[0] * (b.w / 2 + 0.5), y: b.y + b.h / 2 + dir[1] * (b.h / 2 + 0.5) }); }
      }, { icon: 'door', tip: occupied ? 'Call in person. They notice when you do.' : 'Walk over and look at it yourself.' }));
    } else if (b.state === 'ruined') {
      const nq = quoteFor('renovate', st, b);
      acts.push(act(priced('Renovate', nq), () => ctx.act({ type: 'order_job', kind: 'renovate', buildingId: id }), { icon: 'trowel', kind: 'primary', disabled: jobs.some(j => j.kind === 'renovate'), tip: 'Rebuild it from the footings.' + terms(nq) }));
    }
    if (b.type !== 'seat') {
      const razing = jobs.some(j => j.kind === 'demolish');
      const dq = b.state === 'building' ? null : quoteFor('demolish', st, b);
      acts.push(askBtn(b.state === 'building' ? 'Abandon' : 'Demolish', b.state === 'building' ? 'Truly abandon it?' : 'Truly pull it down?', () => { ctx.act({ type: 'demolish', buildingId: id }); },
        { disabled: occupied || razing, tip: occupied ? 'Someone lives here. It must stand empty first.' : razing ? 'It is already marked to come down.'
          : b.state === 'building' ? 'Stop the work. The timber is sold back at the usual loss.' : 'Pull it down and clear the plot.' + terms(dq) }));
    }
    if (acts.length) foot.append(h('div', { class: 'll-in-acts' }, acts));
    return true;
  }

  function timerText(inc: Incident): HTMLElement {
    if (inc.expiresDay === null) return h('span', { class: 'll-in-timer' });
    const exp = inc.expiresDay;
    const n = h('span', { class: 'll-in-timer ll-num' });
    live.push(() => { const left = exp - ctx.state().day; setText(n, left <= 0 ? 'now' : days(left)); setClass(n, 'is-soon', left <= 3); });
    return n;
  }
  function outcomeTip(st: GameState, o: OutcomeDef): string {
    const bits: string[] = [];
    if (o.job) {
      const role = o.job.role;
      const who = role === 'ruler' ? 'You go yourself' : role === 'any' ? 'Whoever is free goes' : staffByRole(st, role) ? `${staffByRole(st, role)!.first} the ${ROLE_TITLES[role]} goes` : 'You go yourself';
      bits.push(`${who}. ${o.job.days <= 1 ? 'A day or less' : plural(Math.ceil(o.job.days), 'day')}${o.job.cost > 0 ? ', ' + crowns(o.job.cost) : ''}.`);
    }
    bits.push(`“${o.say}”`);
    return bits.join(' ');
  }
  function incidentBlock(st: GameState, inc: Incident): HTMLElement {
    const def: IncidentDef | undefined = INCIDENT_BY_ID[inc.defId];
    const iid = inc.id;
    const box = h('div', { class: 'll-in-inc' + (def && def.urgency >= 3 ? ' is-urgent' : '') },
      h('div', { class: 'll-in-inctop' }, h('span', { class: 'll-in-incico' }, ico(def?.icon ?? 'warning')), h('span', { class: 'll-in-inctitle' }, def?.title ?? 'A matter'), timerText(inc)));
    if (inc.state === 'in_progress') {
      const job = inc.jobId ? st.jobs[inc.jobId] : null;
      box.append(h('p', { class: 'll-note' }, job ? jobLine(st, job) : 'In hand.'));
    } else if (def?.audience) {
      box.append(h('div', { class: 'll-in-acts' }, act('Hear them', () => ctx.open('audience', iid), { kind: 'primary', icon: 'speech', tip: 'They are waiting at your seat. Talk it out.' })));
    } else if (def) {
      const outs = [...def.outcomes].sort((a, b) => Number(!!b.default) - Number(!!a.default));
      box.append(h('div', { class: 'll-in-acts' }, outs.map(o => {
        const btn = act(o.job && o.job.cost > 0 ? `${o.label} (${o.job.cost})` : o.label, () => { ctx.act({ type: 'resolve_incident', incidentId: iid, outcomeId: o.id }); }, { kind: o.default ? 'primary' : 'plain', tip: outcomeTip(st, o) });
        return btn;
      })));
    }
    return box;
  }

  function rentBlock(st: GameState, b: Building, def: BuildingDef): HTMLElement {
    const id = b.id;
    const market = marketOf(st, b);
    const lo = Math.max(1, Math.floor(Math.min(market, b.rent) * 0.45));
    const hi = Math.max(lo + 1, b.rent, Math.min(rentCeiling(b), Math.max(Math.ceil(market * 2.1), Math.ceil(b.rent * 1.15), lo + 4)));
    const valueEl = h('b', { class: 'll-num' }, String(b.rent));
    const read = h('p', { class: 'll-in-read' }, rentRead(b.rent, market));
    const range = h('input', { class: 'll-in-range', type: 'range', min: String(lo), max: String(hi), step: '1', value: String(b.rent), 'aria-label': 'Asking rent, crowns a month' });
    const pct = (v: number): string => (((Math.max(lo, Math.min(hi, v)) - lo) / Math.max(1, hi - lo)) * 100).toFixed(1) + '%';
    range.style.setProperty('--fill', pct(b.rent));
    range.addEventListener('pointerdown', () => { busy = true; });
    range.addEventListener('input', () => {
      const v = Number(range.value);
      valueEl.textContent = String(v); read.textContent = rentRead(v, market); range.style.setProperty('--fill', pct(v));
    });
    const commit = (): void => {
      busy = false;
      const v = Number(range.value);
      if (v !== ctx.state().buildings[id]?.rent) ctx.act({ type: 'set_rent', buildingId: id, rent: v });
    };
    range.addEventListener('change', commit);
    range.addEventListener('pointerup', () => { window.setTimeout(() => { busy = false; }, 0); });
    range.addEventListener('blur', () => { busy = false; });
    const vacant = b.units.filter(u => !u.tenantId);
    const listed = vacant.length > 0 && vacant.every(u => u.listed);
    return sec(null,
      h('div', { class: 'll-in-rentrow' }, h('span', { class: 'll-stat-k' }, 'Asking rent'), h('span', { class: 'll-in-rentval' }, valueEl, ' a month')),
      h('div', { class: 'll-in-slider' }, range,
        h('span', { class: 'll-in-tick', style: { left: `calc(9px + (100% - 18px) * ${((market - lo) / Math.max(1, hi - lo)).toFixed(4)})` }, 'data-tip': 'What a typical household would pay for it today.' }, h('i'), h('em', { class: 'll-num' }, `market ${market}`))),
      read,
      h('p', { class: 'll-note ll-in-small' }, 'New leases sign at this. Sitting tenants keep their own.'),
      vacant.length ? h('div', { class: 'll-in-listrow' },
        h('span', { class: 'll-in-plain' }, listed ? 'The TO LET shingle is out.' : 'Not advertised. Nobody will come.'),
        act(listed ? 'Take it down' : 'Hang the shingle', () => { ctx.act({ type: 'set_listed', buildingId: id, listed: !listed }); }, { kind: listed ? 'plain' : 'primary', icon: 'sign' })) : null);
  }

  // ── household
  function traitBlock(all: TraitId[], revealed: TraitId[], hiddenNote: string): HTMLElement {
    const hidden = Math.max(0, all.length - revealed.filter(x => all.includes(x)).length);
    return sec('Their ways',
      revealed.map(tid => { const d = TRAIT_DEFS[tid]; return h('div', { class: 'll-in-trait ' + (d.good ? 'is-good' : 'is-bad') }, h('b', null, d.name), d.blurb ? h('span', null, ' ' + d.blurb) : null); }),
      hidden ? h('div', { class: 'll-in-hidden', 'data-tip': hiddenNote }, fromHTML('<span class="ll-in-qseals">' + QSEAL.repeat(Math.min(4, hidden)) + '</span>'),
        h('span', { class: 'll-note' }, hidden === 1 ? 'One thing you have yet to learn.' : `${cap(numWord(hidden))} things you have yet to learn.`)) : null,
      !revealed.length && !hidden ? h('p', { class: 'll-note' }, 'Nothing out of the ordinary. So far.') : null);
  }
  function oathRow(st: GameState, o: Oath): HTMLElement {
    const due = o.dueDay;
    return h('div', { class: 'll-in-oath is-' + o.state },
      h('span', { class: 'll-in-oathico' }, ico('handshake')),
      h('div', { class: 'll-in-rowtext' },
        h('div', { class: 'll-in-quote' }, `“${o.text}”`),
        o.state === 'open'
          ? liveText('ll-in-rowsub', s2 => { const left = due - s2.day; return left <= 0 ? 'Falls due today.' : `By the ${fmtDate(due)}. ${cap(days(left))} left.`; })
          : h('div', { class: 'll-in-rowsub' }, o.state === 'kept' ? 'Kept.' : o.state === 'broken' ? 'Broken. They have not forgotten.' : 'Released.')));
  }

  function renderTenant(st: GameState, t: Tenant | undefined): boolean {
    if (!t || t.status !== 'housed') return false;
    const id = t.id;
    const T = (s2: GameState): Tenant | undefined => s2.tenants[id];
    const b = t.buildingId ? st.buildings[t.buildingId] : null;
    const actor = Object.values(st.actors).find(a => a.refId === id);
    setHead(
      face('t' + id + ':64', householdFace(t, 64), moodOf(t.happiness)),
      h('h2', { class: 'll-title ll-in-name is-plain' }, t.name),
      [`${peopleLine(t.species, t.trade)}, ${sizeLine(t.household)}`],
      () => focusOn(actor ? { actorId: actor.id } : b ? { buildingId: b.id } : {}));

    const where = h('p', { class: 'll-in-plain ll-in-where' });
    if (b) {
      const bid = b.id;
      where.append('At ', linkTo(b.name, () => pick({ buildingId: bid })), ', ',
        liveText('', s2 => {
          const m = Math.floor((s2.day - t.movedInDay) / DAYS_PER_MONTH), y = Math.floor(m / 12);
          return m <= 0 ? 'since this month.' : m === 1 ? 'this past month.' : m < 12 ? `these ${numWord(m)} months.` : y === 1 ? 'a year and more.' : `${numWord(y)} years and more.`;
        }));
    }
    const tags = t.tags.map(tg => { const d = TAG_DEFS[tg]; const n = tag(d.name, 'gold'); if (d.blurb) n.setAttribute('data-tip', d.blurb); return n; });
    body.append(sec(null, where, tags.length ? h('div', { class: 'll-in-tags' }, tags) : null));

    // mood
    const why = reasonsFor(st, t);
    body.append(sec(null,
      h('div', { class: 'll-in-gauge has-face' }, liveFace(s2 => T(s2)?.happiness ?? 50), h('span', { class: 'll-stat-k' }, 'Happiness'),
        liveText('ll-in-word', s2 => happyWord(T(s2)?.happiness ?? 50)), liveMeter(s2 => T(s2)?.happiness ?? 50)),
      why.length ? h('ul', { class: 'll-in-why' }, why.map(r => h('li', { class: r.good ? 'is-good' : 'is-bad' }, r.text))) : null));

    // lease and money
    const late = lateWords(st, t);
    const lease = t.lease;
    body.append(sec('The lease',
      lease ? line('Rent', [h('b', { class: 'll-num' }, String(lease.rent)), ' a month']) : h('p', { class: 'll-note' }, 'No lease. They stay on sufferance.'),
      lease ? line('Runs', liveText('', s2 => { const left = lease.termMonths - Math.floor((s2.day - lease.startDay) / DAYS_PER_MONTH); return left <= 0 ? 'Run out. Month to month.' : `${plural(left, 'month')} more`; })) : null,
      lease ? line('Surety held', lease.deposit > 0 ? crowns(lease.deposit) : 'None') : null,
      h('p', { class: 'll-in-plain ' + (late.bad ? 'll-bad' : 'll-in-ok') }, late.text),
      t.pets.length ? h('p', { class: 'll-in-plain' }, ico('paw'), ' Keeps ', listWords(t.pets.map(p => PET_NAMES[p])), '.') : null));

    body.append(traitBlock(t.traits, t.revealed, 'Hidden ways come out with time, a visit, or a word with their last landlord.'));

    // memory
    const mem = [...t.memory].reverse();
    body.append(sec('What they remember',
      mem.length ? mem.slice(0, 6).map(m => h('div', { class: 'll-in-mem ' + (m.valence > 0 ? 'is-fond' : 'is-sore') },
        fromHTML(`<span class="ll-in-marks">${(m.valence > 0 ? HEART : THORN).repeat(Math.abs(m.valence))}</span>`),
        h('div', { class: 'll-in-rowtext' }, h('div', null, m.text), h('div', { class: 'll-in-rowsub' }, fmtDate(m.day))))) : h('p', { class: 'll-note' }, 'Nothing yet. You are, to them, a name on a lease.'),
      mem.length > 6 ? h('p', { class: 'll-note ll-in-small' }, `And ${numWord(mem.length - 6)} older ${mem.length - 6 === 1 ? 'thing' : 'things'}.`) : null));

    // oaths
    const oaths = st.oaths.filter(o => o.toTenantId === id && (o.state === 'open' || (o.settledDay !== null && st.day - o.settledDay < 180)));
    if (oaths.length) body.append(sec('Your word to them', oaths.map(o => oathRow(st, o))));

    // matters
    const incs = openFor(st, id);
    if (incs.length) body.append(sec('Matters with them', incs.map(inc => incidentBlock(st, inc))));

    // actions
    const sworn = st.oaths.find(o => o.toTenantId === id && o.state === 'open' && o.kind === 'no_evict');
    const served = t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ';
    const owing = t.arrears > 0 || t.lateStage === 'late' || t.lateStage === 'plan';
    const acts = h('div', { class: 'll-in-acts' },
      act('Speak to them', () => speakTo({ tenantId: id }), { kind: 'primary', icon: 'speech', tip: 'Address the Word bar to this household.' }),
      act('Visit', () => ctx.act({ type: 'order_job', kind: 'visit', tenantId: id, buildingId: t.buildingId ?? undefined }), { icon: 'door', tip: 'Call in person. They notice when you do.' }),
      act('Gift', () => { giftOpen = !giftOpen; sig = ''; render(); }, { icon: 'coin', tip: 'A purse from your own coffers. They will remember it.' }),
      askBtn('Serve notice', sworn ? 'You swore not to. Nail it up anyway?' : 'Nail a Notice to Quit to the door?', () => { ctx.act({ type: 'order_job', kind: 'serve_notice', tenantId: id, buildingId: t.buildingId ?? undefined }); },
        { disabled: served || !owing, tip: served ? 'Served already. The Reeve\'s Court has it in hand, slowly.' : !owing ? 'They owe nothing. The Reeve\'s Court would laugh, and it does not laugh often.'
          : 'Begin the road to the Reeve\'s Court. It is slow, and the street will hear of it.' }));
    if (giftOpen) {
      const tips = ['A small kindness.', 'Half a month of their rent.', 'A month of their rent. Word of that gets round.'];
      acts.append(h('div', { class: 'll-in-gift' }, h('span', { class: 'll-stat-k' }, 'A gift of'),
        giftSizes(t).map((n, i) => act(String(n), () => { giftOpen = false; ctx.act({ type: 'gift', tenantId: id, amount: n }); sig = ''; render(); }, { disabled: st.gold < n, tip: st.gold < n ? 'The coffers will not stretch to it.' : tips[i] })),
        h('span', { class: 'll-note' }, 'crowns')));
    }
    foot.append(acts);
    return true;
  }

  // ── delegate
  function renderStaff(st: GameState, m: StaffMember | undefined): boolean {
    if (!m) return false;
    const id = m.id;
    const M = (s2: GameState): StaffMember | undefined => s2.staff[id];
    const temp = TEMPERAMENT_DEFS[m.temperament];
    setHead(
      face('s' + id + ':64', { species: m.species, seed: m.portraitSeed, role: m.role, size: 64, frame: true }, moodOf(m.loyalty)),
      h('h2', { class: 'll-title ll-in-name is-plain' }, m.name),
      [`Your ${ROLE_TITLES[m.role]}, ${SPECIES_DEFS[m.species].name.toLowerCase()}`],
      () => focusOn(m.actorId ? { actorId: m.actorId } : {}));

    body.append(sec(null,
      h('p', { class: 'll-in-temper' }, h('b', null, temp.name), temp.epithet ? ', ' + temp.epithet : '', '. ', h('span', null, temp.blurb || 'It colours how they hear you.')),
      h('p', { class: 'll-note' }, AUTHORITY[m.authority] ?? AUTHORITY[0]!)));

    const fair = BAL.wageBySkill[m.skill] ?? m.wage;
    const pips = h('span', { class: 'll-in-pips', role: 'img', 'aria-label': `Skill ${m.skill} of 5` }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= m.skill ? 'is-on' : '' })));
    const wageBtn = (d: number, label: string): HTMLElement => h('button', {
      class: 'll-in-step', type: 'button', 'aria-label': label, disabled: m.wage + d < 1,
      onclick: () => { ctx.act({ type: 'set_wage', staffId: id, wage: Math.max(1, (M(ctx.state())?.wage ?? m.wage) + d) }); },
    }, d < 0 ? '−' : '+');
    body.append(sec(null,
      line('Skill', pips),
      h('div', { class: 'll-stat ll-in-line' }, h('span', { class: 'll-stat-k' }, 'Wage'),
        h('span', { class: 'll-in-wage' }, wageBtn(-1, 'Lower the wage'), h('b', { class: 'll-num' }, String(m.wage)), ' a month', wageBtn(1, 'Raise the wage'))),
      h('p', { class: 'll-note ll-in-small' }, m.wage < fair ? `Under the going rate of ${fair} for this skill. Loyalty frays.` : m.wage > fair ? `Above the going rate of ${fair}. Loyalty likes it.` : 'The going rate for this skill.'),
      gauge('Loyalty', s2 => loyalWord(M(s2)?.loyalty ?? 50), s2 => M(s2)?.loyalty ?? 50, 'Wages, kept oaths, and not being countermanded.'),
      line('Jobs done', num(m.jobsDone))));

    const actor = m.actorId ? st.actors[m.actorId] : null;
    const job = actor?.jobId ? st.jobs[actor.jobId] : null;
    const jb = job?.buildingId ? st.buildings[job.buildingId] : null;
    const jid = job?.id;
    body.append(sec('At present',
      job ? h('p', { class: 'll-in-plain' }, job.state === 'working' ? cap(JOB_DOING[job.kind]) : `On the way: ${JOB_DOING[job.kind]}`, ' ',
        jb ? linkTo(jb.name, () => pick({ buildingId: jb.id })) : 'the realm', '.') : h('p', { class: 'll-in-plain' }, IDLE[m.role]),
      job && jid ? liveMeter(s2 => (s2.jobs[jid]?.progress ?? 1) * 100, 'gold') : null));

    const orders = st.orders.filter(o => o.to === m.role || o.to === 'all');
    body.append(sec('Standing orders',
      orders.length ? orders.map(o => h('div', { class: 'll-in-order' },
        h('div', { class: 'll-in-quote' }, `“${o.text}”`),
        h('div', { class: 'll-in-rowsub' }, o.gist, ' ', h('span', { class: 'll-in-uses' }, o.uses === 0 ? 'Not yet called on.' : `Called on ${o.uses === 1 ? 'once' : numWord(o.uses) + ' times'}.`))))
        : h('p', { class: 'll-note' }, `None. Say one aloud: “${m.first}, always…” or “${m.first}, never…”`)));

    foot.append(h('div', { class: 'll-in-acts' },
      act('Speak', () => speakTo({ to: m.role }), { kind: 'primary', icon: 'speech', tip: `Address the Word bar to ${m.first}.` }),
      act('Council', () => ctx.open('council'), { icon: 'people' }),
      askBtn('Dismiss', `Truly dismiss ${m.first}?`, () => { ctx.act({ type: 'dismiss_staff', staffId: id }); })));
    return true;
  }

  // ── applicant
  function renderApplicant(st: GameState, a: Applicant | undefined): boolean {
    if (!a) return false;
    const id = a.id, hh = a.household;
    const b = st.buildings[a.buildingId];
    setHead(
      face('p' + id + ':64', householdFace(hh, 64)),
      h('h2', { class: 'll-title ll-in-name is-plain' }, hh.name),
      [`${peopleLine(hh.species, hh.trade)}, ${sizeLine(hh.household)}`],
      () => focusOn(a.actorId ? { actorId: a.actorId } : b ? { buildingId: b.id } : {}));
    const tags = hh.tags.map(tg => { const d = TAG_DEFS[tg]; const n = tag(d.name, 'gold'); if (d.blurb) n.setAttribute('data-tip', d.blurb); return n; });
    const where = h('p', { class: 'll-in-plain ll-in-where' }, 'Seeks a roof');
    if (b) { const bid = b.id; where.append(' at ', linkTo(b.name, () => pick({ buildingId: bid })), '.'); } else where.append('.');
    body.append(sec(null, where, tags.length ? h('div', { class: 'll-in-tags' }, tags) : null));
    const ask = b?.rent ?? 0;
    body.append(sec('What they will pay',
      h('p', { class: 'll-in-plain' }, ask <= a.maxRent ? ['Will sign at the asking rent of ', h('b', { class: 'll-num' }, String(ask)), ' a month.'] : ['Will not go above ', h('b', { class: 'll-num' }, String(a.maxRent)), '. You are asking ', String(ask), '.']),
      line('Earns', ['about ', String(hh.income), ' a month']),
      liveText('ll-note', s2 => { const left = a.leavesDay - s2.day; return left <= 1 ? 'About to give up and try the next lord.' : `Will wait ${days(left)} more.`; })));
    body.append(traitBlock(hh.traits, hh.revealed, 'Ask their last landlord, when you hear them, and these come out.'));
    const inc = Object.values(st.incidents).find(i => i.applicantId === id && i.state === 'open');
    const iid = inc?.id;
    foot.append(h('div', { class: 'll-in-acts' },
      !a.shown ? act('Show the place', () => { ctx.act({ type: 'order_job', kind: 'show', applicantId: id, buildingId: a.buildingId }); }, { kind: 'primary', icon: 'key', tip: staffByRole(st, 'crier') ? 'The Crier will walk them round.' : 'Someone must walk them round. Without a Crier, that is you.' })
        : iid ? act('Hear them', () => ctx.open('audience', iid), { kind: 'primary', icon: 'speech', tip: 'Welcome them, haggle, ask after them, or turn them away.' })
        : h('span', { class: 'll-note' }, 'They are thinking it over.'),
      b ? act('The house', () => pick({ buildingId: b.id }), { icon: 'house' }) : null));
    return true;
  }

  // ── structure signature: rebuild only when this changes
  function structSig(st: GameState, v: View): string {
    const p: unknown[] = [v.kind, v.id, giftOpen];
    if (v.kind === 'building') {
      const b = st.buildings[v.id];
      if (!b) return 'gone';
      p.push(b.name, b.state, b.level, b.rent, b.squatters?.kind, b.condition >= 99.5, marketOf(st, b));
      if (b.state !== 'building') for (const k of ['repair', 'renovate', 'demolish'] as const) { const q = quoteFor(k, st, b); p.push(q?.cost, q ? st.gold >= q.cost : 0); }
      for (const u of b.units) {
        const t = u.tenantId ? st.tenants[u.tenantId] : null;
        p.push(u.tenantId, u.purse, u.listed, u.vacantSince === null, t ? [t.lateStage, t.arrears, t.daysLate, t.lease?.rent] : 0);
      }
      for (const i of openAt(st, b.id)) p.push(i.id, i.state, i.jobId);
      for (const j of jobsAt(st, b.id)) p.push(j.id, j.state, j.assignee);
      for (const a of Object.values(st.applicants)) if (a.buildingId === b.id) p.push(a.id, a.shown);
      const role = BUILDINGS[b.type].staffRole;
      if (role) p.push(staffByRole(st, role)?.id);
      if (b.type === 'seat') for (const i of Object.values(st.incidents)) if (i.state === 'open') p.push(i.id);
    } else if (v.kind === 'tenant') {
      const t = st.tenants[v.id];
      if (!t || t.status !== 'housed') return 'gone';
      p.push(t.buildingId, t.lease?.rent, t.lease?.deposit, t.lease?.termMonths, t.lateStage, t.arrears, t.daysLate, t.plan?.left, t.courtDay !== null && Math.ceil(t.courtDay - st.day),
        t.revealed.join(), t.traits.length, t.tags.join(), t.pets.join(), t.memory.length, giftOpen && giftSizes(t).map(n => st.gold >= n).join(), reasonsFor(st, t).map(r => r.text).join('|'));
      for (const o of st.oaths) if (o.toTenantId === t.id) p.push(o.id, o.state);
      for (const i of openFor(st, t.id)) p.push(i.id, i.state, i.jobId);
    } else if (v.kind === 'staff') {
      const m = st.staff[v.id];
      if (!m) return 'gone';
      const actor = m.actorId ? st.actors[m.actorId] : null;
      const job = actor?.jobId ? st.jobs[actor.jobId] : null;
      p.push(m.wage, m.skill, m.authority, m.temperament, m.jobsDone, job?.id, job?.state);
      for (const o of st.orders) if (o.to === m.role || o.to === 'all') p.push(o.id, o.uses);
    } else {
      const a = st.applicants[v.id];
      if (!a) return 'gone';
      p.push(a.shown, a.screened, a.household.revealed.join(), st.buildings[a.buildingId]?.rent, !!staffByRole(st, 'crier'));
      for (const i of Object.values(st.incidents)) if (i.applicantId === a.id) p.push(i.id, i.state);
    }
    return JSON.stringify(p);
  }

  function render(): void {
    const st = ctx.state();
    live = [];
    usedFaces.clear();
    const key = view ? view.kind + view.id : '';
    const keep = key === shownKey ? body.scrollTop : 0;
    clear(head); clear(body); clear(foot);
    let ok = false;
    if (view) {
      try {
        ok = view.kind === 'building' ? renderBuilding(st, st.buildings[view.id])
          : view.kind === 'tenant' ? renderTenant(st, st.tenants[view.id])
          : view.kind === 'staff' ? renderStaff(st, st.staff[view.id])
          : renderApplicant(st, st.applicants[view.id]);
      } catch (err) {
        console.error('[inspector]', err);
        clear(head); clear(body); clear(foot); ok = false;
      }
    }
    if (!ok) view = null;
    shownKey = view ? key : '';
    sheet.dataset.kind = view?.kind ?? '';
    el.hidden = !view || !visible;
    for (const [k, p] of faces) if (!usedFaces.has(k)) { try { p.dispose(); } catch { /* already gone */ } faces.delete(k); }
    sig = view ? structSig(st, view) : '';
    for (const fn of live) fn();
    body.scrollTop = keep;
  }

  return {
    el,
    update(st: GameState, dt: number): void {
      if (!view || !visible) return;
      acc += dt;
      if (acc < 0.2) return;
      acc = 0;
      const now = structSig(st, view);
      if (now === 'gone') { const had = view; view = null; render(); if (had.kind === 'building' || had.kind === 'tenant') ctx.select(null); return; }
      if (now !== sig) { if (!holding && !busy) render(); return; }
      for (const fn of live) fn();
    },
    handleEvents(events: SimEvent[]): void {
      if (!view) return;
      for (const ev of events) {
        if ((ev.type === 'building_removed' && view.kind === 'building' && ev.buildingId === view.id)
          || (ev.type === 'tenant_out' && view.kind === 'tenant' && ev.tenantId === view.id)
          || (ev.type === 'applicant_gone' && view.kind === 'applicant' && ev.applicantId === view.id)
          || (ev.type === 'staff_left' && view.kind === 'staff' && ev.staffId === view.id)) { acc = 1; break; }
      }
    },
    onSelect(sel: { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id } | null): void {
      const next: View | null = !sel ? null
        : sel.applicantId ? { kind: 'applicant', id: sel.applicantId }
        : sel.staffId ? { kind: 'staff', id: sel.staffId }
        : sel.tenantId ? { kind: 'tenant', id: sel.tenantId }
        : sel.buildingId ? { kind: 'building', id: sel.buildingId }
        : null;
      if (next && view && next.kind === view.kind && next.id === view.id) return;
      busy = false; holding = false;
      go(next);
    },
    setVisible(on: boolean): void {
      visible = on;
      el.hidden = !view || !on;
      if (on && view) render();
    },
    escape(): boolean {
      if (!giftOpen) return false;
      giftOpen = false; sig = ''; render();
      return true;
    },
    reset(): void { busy = false; holding = false; go(null); },
    dispose(): void {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      for (const p of faces.values()) { try { p.dispose(); } catch { /* already gone */ } }
      faces.clear(); live = [];
    },
  };
}
