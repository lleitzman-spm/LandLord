/**
 * The ledger: an open book on the war table. Two facing parchment pages,
 * ribbon tabs down the side. The one place for numbers, so it is built to be
 * read quickly: accounts, households, standing orders, oaths, policies and a
 * census of the realm. OWNER: ui-screens-c.
 *
 * open(arg): arg may name a tab ('accounts' | 'households' | 'orders' |
 * 'oaths' | 'policies' | 'realm'); otherwise the last tab read is reopened.
 */
import type { Screen, UICtx } from '../api';
import {
  DAYS_PER_MONTH, DECISION_OPTIONS,
  type GameState, type SimEvent, type Tenant, type Building, type MonthBook, type StandingOrder, type Oath,
  type Condition, type IncomeCat, type ExpenseCat, type DecisionType, type DecisionOption, type LateStage,
  type StaffMember, type Id, type Herald, type Policies, type Action, type BuildingCategory,
} from '../../sim/types';
import { h, addStyle, clear, fromHTML, num, signed, crowns, plural, cap, esc, meter, tag, button } from '../kit';
import { SCREENS_C_CSS } from '../css/screens-c';
import { iconSvg } from '../icons';
import { dropCap, doodle, flourish, MARGINALIA_CSS, type DoodleKind } from '../marginalia';
import { createPortrait, type Portrait, type PortraitSpec } from '../portraits';
import { fmtDate, dateOf, ordinal } from '../../sim/core';
import { marketRent } from '../../sim/economy';
import {
  BUILDINGS, RANKS, BAL, TRAIT_DEFS, SPECIES_DEFS, TRADE_DEFS, INCIDENT_BY_ID, MONTH_NAMES, ROLE_TITLES, RANK_TITLES,
} from '../../data';
import type { TenantTag, TraitId, Species, IconId, BuildingType } from '../../data/ids';

// ───────────────────────────── tabs and remembered choices ─────────────────────────────

export type LedgerTab = 'accounts' | 'households' | 'orders' | 'oaths' | 'policies' | 'realm';
const TABS: { id: LedgerTab; label: string; title: string; icon: IconId; doodle: DoodleKind }[] = [
  { id: 'accounts', label: 'Accounts', title: 'Accounts', icon: 'coin', doodle: 'mouse_coin' },
  { id: 'households', label: 'Households', title: 'Households', icon: 'people', doodle: 'owl_ledger' },
  { id: 'orders', label: 'Orders', title: 'Standing Orders', icon: 'scroll', doodle: 'fox_scribe' },
  { id: 'oaths', label: 'Oaths', title: 'The Ledger of Oaths', icon: 'seal', doodle: 'goose_bishop' },
  { id: 'policies', label: 'Policies', title: 'Policies of the Realm', icon: 'scales', doodle: 'snail_knight' },
  { id: 'realm', label: 'The Realm', title: 'The Realm', icon: 'castle', doodle: 'hound_horn' },
];
const TAB_ALIASES: Record<string, LedgerTab> = { standing_orders: 'orders', order: 'orders', oath: 'oaths', policy: 'policies', census: 'realm', money: 'accounts', tenants: 'households' };

let lastTab: LedgerTab = 'accounts';
let period: number | 'year' | null = null;
type SortKey = 'name' | 'home' | 'months' | 'rent' | 'market' | 'hap' | 'owe' | 'lease';
let sort: { key: SortKey; dir: 1 | -1 } = { key: 'home', dir: 1 };
/** renown / favour movements seen in events while the ledger exists (exact amounts, with reasons) */
const moves: { kind: 'renown' | 'favor'; amount: number; reason: string; day: number }[] = [];

// ───────────────────────────── words ─────────────────────────────

const INCOME_ORDER: IncomeCat[] = ['rent', 'fees', 'deposits_kept', 'windfall', 'loan'];
const EXPENSE_ORDER: ExpenseCat[] = ['wages', 'upkeep', 'repairs', 'construction', 'land', 'tribute', 'interest', 'loan_repaid', 'deposits_returned', 'court', 'gifts', 'bribes', 'other'];
const CAT_LABEL: Record<IncomeCat | ExpenseCat, string> = {
  rent: 'Rent', fees: 'Late fees', deposits_kept: 'Sureties kept', windfall: 'Windfalls', loan: 'Borrowed',
  construction: 'Building works', repairs: 'Repairs', wages: 'Wages', upkeep: 'Upkeep', tribute: 'Tribute to the Crown',
  interest: 'Interest', deposits_returned: 'Sureties returned', bribes: 'Bribes', gifts: 'Gifts', court: 'Court costs',
  land: 'Land', loan_repaid: 'Loans repaid', other: 'Sundries',
};
const MONTH_ABBR = ['Thaw', 'Seed', 'Bloom', 'High', 'Gold', 'Drag', 'Harv', 'Leaf', 'Mist', 'Frost', 'Deep', 'Cand'];

const STAGE_WORD: Record<LateStage, string> = { none: '', grace: 'in grace', late: 'late', plan: 'on a plan', noticed: 'served notice', court: 'in court', writ: 'writ granted' };
const STAGE_RANK: Record<LateStage, number> = { none: 0, grace: 1, plan: 2, late: 3, noticed: 4, court: 5, writ: 6 };

const DECISION_WHEN: Record<DecisionType, string> = {
  custom: 'When the matter comes up',
  late_rent: 'When rent is late',
  eviction_ready: 'When the court has ruled on an eviction',
  repair: 'When something needs mending',
  applicant: 'When an applicant has been shown round',
  move_out_deposit: 'When a household leaves and the surety is due',
  squatters: 'When squatters settle in an empty house',
  pet: 'When a household asks about a pet',
  rent_renewal: 'When a lease comes up for renewal',
};
const OPTION_VERB: Record<DecisionOption, string> = {
  wait: 'give them more time', late_fee: 'charge the late fee', payment_plan: 'offer a payment plan', forgive: 'forgive the debt',
  notice: 'serve Notice to Quit', cash_for_keys: 'offer coin for keys', evict: 'send the Bailiff to put them out', mercy: 'tear up the writ',
  fix: 'mend it properly', patch: 'patch it', defer: 'leave it for later', bill_tenant: 'mend it and bill the household',
  accept: 'welcome them in', reject: 'turn them away', screen: 'ask their last landlord first', counter: 'ask a higher rent',
  return_all: 'return the whole surety', fair: 'keep only what the damage cost', keep_all: 'keep the whole surety',
  oust: 'have them thrown out', bribe: 'pay them to go', lease: 'offer them a lease', ignore: 'leave them be',
  allow: 'allow it', pet_rent: 'charge pet rent', ban: 'forbid it',
  hold: 'hold the rent where it is', raise: 'raise the rent', lower: 'lower the rent',
};
const TAG_PHRASE: Record<TenantTag, [string, boolean]> = {
  widow: ['a widow', false], elder: ['an elder', false], veteran: ['a veteran', false], newlyweds: ['newlyweds', true],
  large_family: ['a large family', false], scholar: ['a scholar', false], noble_born: ['noble born', false],
  stranger: ['strangers here', true], apprentice: ['an apprentice', false], pilgrim: ['a pilgrim', false],
};
const TRAIT_NOUN: Partial<Record<TraitId, string>> = {
  deadbeat: 'a deadbeat', ghost: 'one who vanishes', haggler: 'a haggler', complainer: 'a complainer', hoarder: 'a hoarder',
  musician: 'a musician', gossip: 'a gossip', pet_lover: 'a lover of animals', secret_pet: 'hiding a pet', pyromaniac: 'fond of fire',
  subletter: 'letting rooms on the side', entrepreneur: 'an entrepreneur', gardener: 'a gardener', brawler: 'a brawler',
  saint: 'a saint', snitch: 'an informer', sleepwalker: 'a sleepwalker',
};

const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const countWord = (n: number) => NUM_WORDS[n] ?? num(n);
const andList = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const an = (w: string) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const lc = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const human = (id: string) => id.replace(/_/g, ' ');
function speciesAdj(sp: Species): string { const d = SPECIES_DEFS[sp]; return (d?.adjective || sp).toLowerCase(); }
function tradeName(t: string): string { return (TRADE_DEFS[t as keyof typeof TRADE_DEFS]?.name || human(t)).toLowerCase(); }
function traitPhrase(t: TraitId): string { return TRAIT_NOUN[t] ?? (TRAIT_DEFS[t]?.name || human(t)).toLowerCase(); }
function condWord(c: number): string { return c >= 85 ? 'Sound' : c >= 65 ? 'Fair' : c >= 45 ? 'Tired' : c >= 25 ? 'Shabby' : c > 0 ? 'Held up by habit' : 'A ruin'; }
function staffFor(s: GameState, role: string): StaffMember | null { return Object.values(s.staff).find(m => m.role === role) ?? null; }
function fmtK(v: number, sign = true): string {
  const a = Math.abs(Math.round(v));
  const body = a >= 1000 ? (a / 1000).toFixed(a < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k' : String(a);
  return (v < 0 ? '−' : sign && v > 0 ? '+' : '') + body;
}
function shortDate(day: number): string { const d = dateOf(day); return `${d.dom} ${MONTH_ABBR[d.month]}`; }
function monthLabel(idx: number): string { const m = ((idx % 12) + 12) % 12; return `${MONTH_NAMES[m]}, Year ${Math.floor(idx / 12) + 1}`; }
function agoText(days: number): string {
  const d = Math.max(0, Math.floor(days));
  if (d === 0) return 'today'; if (d === 1) return 'yesterday';
  if (d < 45) return `${d} days ago`;
  return `${Math.round(d / 30)} months ago`;
}
function untilText(days: number): string {
  const d = Math.ceil(days);
  if (d <= 0) return 'today'; if (d === 1) return 'tomorrow';
  if (d < 60) return `in ${d} days`;
  return `in ${Math.round(d / 30)} months`;
}

// ───────────────────────────── numbers ─────────────────────────────

const EMPTY_INCOME = (): Record<IncomeCat, number> => ({ rent: 0, fees: 0, deposits_kept: 0, windfall: 0, loan: 0 });
const EMPTY_EXPENSE = (): Record<ExpenseCat, number> => ({ construction: 0, repairs: 0, wages: 0, upkeep: 0, tribute: 0, interest: 0, deposits_returned: 0, bribes: 0, gifts: 0, court: 0, land: 0, loan_repaid: 0, other: 0 });
const sumRec = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
const curMonthIdx = (s: GameState) => Math.floor(Math.max(0, s.day) / DAYS_PER_MONTH);

interface Books { cur: MonthBook; hist: MonthBook[]; curIdx: number }
function books(s: GameState): Books {
  const curIdx = curMonthIdx(s);
  const byIdx = new Map<number, MonthBook>();
  for (const b of s.ledger.months) byIdx.set(b.index, b);
  const cur = byIdx.get(curIdx) ?? { index: curIdx, income: EMPTY_INCOME(), expense: EMPTY_EXPENSE(), closing: s.gold, rentDue: 0, rentCollected: 0 };
  const hist = [...byIdx.values()].filter(b => b.index < curIdx).sort((a, b) => a.index - b.index).slice(-12);
  return { cur, hist, curIdx };
}
function combine(list: MonthBook[]): { income: Record<IncomeCat, number>; expense: Record<ExpenseCat, number>; rentDue: number; rentCollected: number } {
  const income = EMPTY_INCOME(), expense = EMPTY_EXPENSE(); let rentDue = 0, rentCollected = 0;
  for (const b of list) {
    for (const k of INCOME_ORDER) income[k] += b.income[k] ?? 0;
    for (const k of EXPENSE_ORDER) expense[k] += b.expense[k] ?? 0;
    rentDue += b.rentDue; rentCollected += b.rentCollected;
  }
  return { income, expense, rentDue, rentCollected };
}
function housed(s: GameState): Tenant[] { return Object.values(s.tenants).filter(t => t.status === 'housed' && t.buildingId && s.buildings[t.buildingId]); }
function rentRoll(s: GameState): number { return housed(s).reduce((a, t) => a + (t.lease?.rent ?? 0), 0); }
function safeMarket(s: GameState, b: Building): number { try { const v = marketRent(s, b); return Number.isFinite(v) ? Math.round(v) : BUILDINGS[b.type].baseRent; } catch { return BUILDINGS[b.type].baseRent; } }
function typicalRent(s: GameState): number {
  const r = housed(s).map(t => t.lease?.rent ?? 0).filter(v => v > 0).sort((a, b) => a - b);
  return r.length ? r[Math.floor(r.length / 2)]! : 12;
}
function nextTribute(s: GameState): { idx: number; day: number; amount: number } {
  const cur = curMonthIdx(s); let n = cur + 1;
  const months: readonly number[] = BAL.tributeMonths;
  while (!months.includes(((n % 12) + 12) % 12) && n < cur + 13) n++;
  return { idx: n, day: n * DAYS_PER_MONTH, amount: RANKS[s.realm.rank].tribute };
}
interface Projection { net: number; soFar: number; purses: number; expectedRent: number; moreOut: number; ratio: number }
function project(s: GameState, b: Books): Projection {
  const cur = b.cur;
  const soFar = sumRec(cur.income) - sumRec(cur.expense);
  const d = dateOf(s.day);
  let purses = 0;
  for (const bd of Object.values(s.buildings)) for (const u of bd.units) purses += u.purse || 0;
  const due = cur.rentDue > 0 ? cur.rentDue : d.dom <= 3 ? rentRoll(s) : 0;
  const recent = b.hist.filter(m => m.rentDue > 0).slice(-3);
  const dueSum = recent.reduce((a, m) => a + m.rentDue, 0), gotSum = recent.reduce((a, m) => a + m.rentCollected, 0);
  const ratio = dueSum > 0 ? Math.max(0.3, Math.min(1, gotSum / dueSum)) : 0.9;
  const outstanding = Math.max(0, due - cur.rentCollected);
  const expectedRent = Math.round(Math.min(outstanding, purses) + Math.max(0, outstanding - purses) * ratio);
  const wages = Object.values(s.staff).reduce((a, m) => a + m.wage, 0);
  const upkeep = Object.values(s.buildings).filter(x => x.state === 'ready').reduce((a, x) => a + (BUILDINGS[x.type]?.upkeep ?? 0), 0);
  const interest = s.loans.reduce((a, l) => a + l.principal * l.ratePctMonth / 100, 0);
  const moreOut = Math.round(Math.max(0, wages - cur.expense.wages) + Math.max(0, upkeep - cur.expense.upkeep) + Math.max(0, interest - cur.expense.interest));
  return { net: Math.round(soFar + expectedRent - moreOut), soFar, purses, expectedRent, moreOut, ratio };
}

// ───────────────────────────── charts (SVG, drawn to scale) ─────────────────────────────

let chartSeq = 0;
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function ticksFor(lo: number, hi: number, target = 3): { lo: number; hi: number; step: number; ticks: number[] } {
  if (hi - lo < 1e-9) hi = lo + 10;
  const step = Math.max(1, niceStep((hi - lo) / target));
  const l = Math.floor(lo / step) * step, u = Math.ceil(hi / step) * step;
  const ticks: number[] = []; for (let v = l; v <= u + step / 2; v += step) ticks.push(Math.round(v));
  return { lo: l, hi: u, step, ticks };
}
interface NetPoint { label: string; value: number; current: boolean; title: string }
function netChart(pts: NetPoint[], W: number): string {
  const id = 'ldgh' + (++chartSeq);
  const anyNeg = pts.some(p => p.value < 0);
  const padL = 40, padR = 4, n = Math.max(1, pts.length), slot = (W - padL - padR) / n;
  const roomy = slot >= 26, stagger = slot < 36;
  const padT = 18, padB = (anyNeg ? 14 : 0) + (stagger ? 32 : 20), H = 100 + padT + padB;
  const vals = pts.map(p => p.value);
  const t = ticksFor(Math.min(0, ...vals), Math.max(0, ...vals));
  const ph = H - padT - padB, bw = Math.min(26, slot * 0.62);
  const y = (v: number) => padT + (t.hi - v) / (t.hi - t.lo) * ph;
  let maxI = 0, minI = 0; vals.forEach((v, i) => { if (v > vals[maxI]!) maxI = i; if (v < vals[minI]!) minI = i; });
  const monY = (i: number) => (stagger && (n - 1 - i) % 2 === 1 ? H - 18 : H - 5);
  let out = `<svg class="ldg-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc('Net by month: ' + pts.map(p => `${p.title} ${fmtK(p.value)}`).join(', '))}">`;
  out += `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="#5a4633"/></pattern><pattern id="${id}r" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="#9e2b25"/></pattern></defs>`;
  for (const tv of t.ticks) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}"/>`;
    out += `<text class="tick" x="${padL - 6}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end">${esc(fmtK(tv, false))}</text>`;
  }
  pts.forEach((p, i) => {
    const cx = padL + slot * i + slot / 2, x = cx - bw / 2, y0 = y(0), yv = y(p.value);
    const top = Math.min(y0, yv), hgt = Math.max(p.value === 0 ? 0 : 1.5, Math.abs(yv - y0));
    const cls = p.value < 0 ? 'neg' : 'pos';
    if (p.current) out += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" fill="url(#${id}${p.value < 0 ? 'r' : ''})" stroke="${p.value < 0 ? '#9e2b25' : '#5a4633'}" stroke-width="1"/>`;
    else out += `<rect class="${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" rx="1"/>`;
    if (roomy || p.current || i === maxI || i === minI || i === n - 2) {
      const ly = p.value < 0 ? yv + 13 : yv - 5;
      out += `<text class="val${p.value < 0 ? ' neg-t' : ''}" x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${esc(fmtK(p.value))}</text>`;
    }
    out += `<text class="mon${p.current ? ' now' : ''}" x="${cx.toFixed(1)}" y="${monY(i)}" text-anchor="middle">${esc(p.label)}</text>`;
    out += `<rect class="hit" x="${(padL + slot * i).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${ph}"><title>${esc(`${p.title}: net ${fmtK(p.value)} crowns${p.current ? ' so far' : ''}`)}</title></rect>`;
  });
  out += `<line class="ax" x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`;
  return out + '</svg>';
}
interface RentPoint { label: string; due: number; got: number; current: boolean; title: string }
function rentChart(pts: RentPoint[], W: number): string {
  const padL = 40, padR = 4, n = Math.max(1, pts.length), slot = (W - padL - padR) / n;
  const roomy = slot >= 26, stagger = slot < 36;
  const padT = 18, padB = stagger ? 32 : 20, H = 80 + padT + padB;
  const t = ticksFor(0, Math.max(1, ...pts.map(p => Math.max(p.due, p.got))));
  const ph = H - padT - padB, bw = Math.min(26, slot * 0.66);
  const y = (v: number) => padT + (t.hi - v) / (t.hi - t.lo) * ph;
  const monY = (i: number) => (stagger && (n - 1 - i) % 2 === 1 ? H - 18 : H - 5);
  let out = `<svg class="ldg-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc('Rent due against collected: ' + pts.map(p => `${p.title} ${p.got} of ${p.due}`).join(', '))}">`;
  for (const tv of t.ticks) {
    out += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(tv).toFixed(1)}" y2="${y(tv).toFixed(1)}"/>`;
    out += `<text class="tick" x="${padL - 6}" y="${(y(tv) + 4).toFixed(1)}" text-anchor="end">${esc(fmtK(tv, false))}</text>`;
  }
  pts.forEach((p, i) => {
    const cx = padL + slot * i + slot / 2, x = cx - bw / 2;
    if (p.due > 0) out += `<rect class="due" x="${x.toFixed(1)}" y="${y(p.due).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(p.due)).toFixed(1)}"/>`;
    if (p.got > 0) out += `<rect class="got${p.current ? ' cur' : ''}" x="${(x + 3).toFixed(1)}" y="${y(p.got).toFixed(1)}" width="${Math.max(1, bw - 6).toFixed(1)}" height="${(y(0) - y(p.got)).toFixed(1)}"/>`;
    if (p.due > 0 && (roomy || p.current)) {
      const pct = Math.round(100 * p.got / p.due);
      out += `<text class="val${pct < 80 ? ' neg-t' : ''}" x="${cx.toFixed(1)}" y="${(y(Math.max(p.due, p.got)) - 5).toFixed(1)}" text-anchor="middle">${pct}%</text>`;
    }
    out += `<text class="mon${p.current ? ' now' : ''}" x="${cx.toFixed(1)}" y="${monY(i)}" text-anchor="middle">${esc(p.label)}</text>`;
    out += `<rect class="hit" x="${(padL + slot * i).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${ph}"><title>${esc(`${p.title}: ${p.got} of ${p.due} crowns collected${p.current ? ' so far' : ''}`)}</title></rect>`;
  });
  out += `<line class="ax" x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`;
  return out + '</svg>';
}
function tallySvg(n: number, cls: string): string {
  const shown = Math.min(n, 50), groups = Math.ceil(shown / 5);
  const w = Math.max(8, groups * 30);
  let d = '';
  for (let g = 0; g < groups; g++) {
    const x0 = g * 30 + 3, inGroup = Math.min(5, shown - g * 5);
    for (let k = 0; k < Math.min(4, inGroup); k++) {
      const x = x0 + k * 5 + ((g * 7 + k * 3) % 3) * 0.3;
      d += `M${x.toFixed(1)} ${3 + ((k + g) % 2) * 0.6}L${(x + 0.6).toFixed(1)} 21`;
    }
    if (inGroup === 5) d += `M${x0 - 2} 17L${x0 + 19} 6`;
  }
  return `<svg class="${cls}" viewBox="0 0 ${w} 24" width="${w}" height="24" aria-hidden="true"><path d="${d}" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`;
}

// ───────────────────────────── standing orders in plain words ─────────────────────────────

function cmpAmount(op: string): string { return ({ '<': 'less than', '<=': 'at most', '>': 'more than', '>=': 'at least', '==': 'exactly', '!=': 'other than' } as Record<string, string>)[op] ?? op; }
function cmpLevel(op: string): string { return ({ '<': 'below', '<=': 'at most', '>': 'above', '>=': 'at least', '==': 'exactly', '!=': 'not' } as Record<string, string>)[op] ?? op; }
function cmpCount(op: string): string { return ({ '<': 'fewer than', '<=': 'at most', '>': 'more than', '>=': 'at least', '==': 'exactly', '!=': 'other than' } as Record<string, string>)[op] ?? op; }
function condText(s: GameState, c: Condition): string {
  const neg = c.op === '!=' || c.op === 'excludes';
  const v = c.value, n = Number(v);
  const is = neg ? 'is not' : 'is';
  switch (c.field) {
    case 'season': return `it ${is} ${String(v).toLowerCase()}`;
    case 'month': {
      const name = typeof v === 'number' || /^\d+$/.test(String(v)) ? MONTH_NAMES[((Number(v) % 12) + 12) % 12] ?? String(v) : String(v);
      if (c.op === '<' || c.op === '<=') return `it is before ${name}`;
      if (c.op === '>' || c.op === '>=') return `it is after ${name}`;
      return `it ${is} ${name}`;
    }
    case 'gold': return `the coffers hold ${cmpAmount(c.op)} ${num(n)} crowns`;
    case 'renown': return `your renown is ${cmpLevel(c.op)} ${n}`;
    case 'cost': return `it would cost ${cmpAmount(c.op)} ${num(n)} crowns`;
    case 'tenant.species': return `the household ${is} ${speciesAdj(String(v) as Species)}`;
    case 'tenant.trade': return `the household ${is} ${an(tradeName(String(v)))}`;
    case 'tenant.tags': {
      const p = TAG_PHRASE[String(v) as TenantTag] ?? [an(human(String(v))), false];
      return `the household ${p[1] ? (neg ? 'are not' : 'are') : is} ${p[0]}`;
    }
    case 'tenant.traits': return `the household ${neg ? 'is not' : 'is'} known to be ${traitPhrase(String(v) as TraitId)}`;
    case 'tenant.monthsHoused': return `they have lived there ${cmpCount(c.op)} ${plural(n, 'month')}`;
    case 'tenant.daysLate': return `the rent is ${cmpCount(c.op)} ${plural(n, 'day')} late`;
    case 'tenant.arrears': return `they owe ${cmpAmount(c.op)} ${num(n)} crowns`;
    case 'tenant.happiness': return `their happiness is ${cmpLevel(c.op)} ${n}`;
    case 'tenant.household': return `${cmpCount(c.op)} ${n} live under the roof`;
    case 'tenant.hasPets': { const yes = (v === true || v === 'true' || v === 1) !== neg; return yes ? 'they keep a pet' : 'they keep no pets'; }
    case 'tenant.name': return `the household ${is} ${String(v)}`;
    case 'building.type': return `the home ${is} ${an((BUILDINGS[String(v) as BuildingType]?.name ?? human(String(v))).toLowerCase())}`;
    case 'building.condition': return `the building's condition is ${cmpLevel(c.op)} ${n}`;
    case 'building.id': return `the building ${is} ${s.buildings[String(v)]?.name ?? 'the one named'}`;
    case 'building.rent': return `the asking rent is ${cmpAmount(c.op)} ${num(n)} crowns`;
  }
  return `${human(String(c.field))} ${c.op} ${String(v)}`;
}
/** "When rent is late, and the household is a widow, and it is winter: never serve Notice to Quit." */
export function orderInWords(s: GameState, o: StandingOrder): string {
  const def = o.incidentDef ? INCIDENT_BY_ID[o.incidentDef] : null;
  const when = def ? `When “${def.title}” comes up` : o.incidentDef ? `When “${cap(human(o.incidentDef))}” comes up` : DECISION_WHEN[o.decision ?? 'custom'];
  let what = 'decide as you see fit';
  if (o.option && OPTION_VERB[o.option]) what = OPTION_VERB[o.option];
  else if (o.outcomeId) {
    const oc = def?.outcomes.find(x => x.id === o.outcomeId);
    what = oc ? lc(oc.label) : human(o.outcomeId);
  }
  const conds = o.when.map(c => condText(s, c));
  return `${when}${conds.length ? ', and ' + conds.join(', and ') : ''}: ${o.rule === 'never' ? 'never' : 'always'} ${what}.`;
}

function oathWhat(s: GameState, o: Oath): string {
  const first = o.toTenantId ? s.tenants[o.toTenantId]?.first ?? o.toName : o.toName;
  switch (o.kind) {
    case 'repair': return `Mend ${(o.buildingId && s.buildings[o.buildingId]?.name) || 'their home'}`;
    case 'no_rent_raise': return `No rise in ${first}'s rent`;
    case 'no_evict': return `No notice and no eviction for ${first}`;
    case 'build': return `Build ${an((o.buildingType ? BUILDINGS[o.buildingType]?.name : 'something') ?? 'something').toLowerCase()}`;
    case 'pay': return `Pay ${first} ${o.amount ?? 'some'} crowns`;
    case 'rent_cap': return `Keep ${first}'s rent at ${o.amount ?? 'its'} crowns or less`;
    default: return 'Your word, as given';
  }
}

// ───────────────────────────── the screen ─────────────────────────────

/** A portrait, or a plain roundel if the painter is having a bad day. */
function safePortrait(spec: PortraitSpec): Portrait {
  try { return createPortrait(spec); } catch (err) {
    console.warn('[portrait]', err);
    const el = document.createElement('div');
    el.className = 'ldg-noface'; el.style.width = el.style.height = spec.size + 'px';
    return { el, setMood() {}, setTalking() {}, lookAt() {}, dispose() {} };
  }
}

export function create(ctx: UICtx): Screen {
  addStyle('screens-c', SCREENS_C_CSS);
  if (MARGINALIA_CSS) addStyle('marginalia', MARGINALIA_CSS);

  let tab: LedgerTab = lastTab;
  let isOpen = false;
  let lastSig = '';
  let confirmKey: string | null = null;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  // ── frame
  const rh = [h('span'), h('span')], folio = [h('span'), h('span')];
  const content = h('div', { class: 'ldg-content' });
  const spread = h('div', { class: 'ldg-spread', role: 'tabpanel', tabindex: '-1' }, content);
  const pages = h('div', { class: 'ldg-pages' }, h('div', { class: 'ldg-heads' }, rh), spread, h('div', { class: 'ldg-gutter', 'aria-hidden': 'true' }), h('div', { class: 'ldg-folios', 'aria-hidden': 'true' }, folio));
  const closeBtn = h('button', { class: 'll-seal ll-close ldg-close', type: 'button', title: 'Close the ledger', 'aria-label': 'Close the ledger', onclick: () => ctx.close('ledger') }, '✕');
  const book = h('div', { class: 'ldg-book' }, pages, closeBtn);
  const ribbons = h('nav', { class: 'ldg-ribbons', role: 'tablist', 'aria-label': 'Ledger sections', 'aria-orientation': 'vertical' });
  const ribBtns = new Map<LedgerTab, HTMLButtonElement>();
  for (const t of TABS) {
    const b = h('button', {
      class: 'ldg-rib', type: 'button', role: 'tab', dataset: { tab: t.id }, title: t.title,
      onclick: () => setTab(t.id, true),
      onkeydown: (e: KeyboardEvent) => {
        const i = TABS.findIndex(x => x.id === t.id);
        const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); const nt = TABS[(i + d + TABS.length) % TABS.length]!; setTab(nt.id, true); ribBtns.get(nt.id)?.focus(); }
      },
    }, fromHTML(iconSvg(t.icon)), h('span', null, t.label), h('span', { class: 'badge', hidden: true }));
    ribBtns.set(t.id, b); ribbons.appendChild(b);
  }
  const wrap = h('div', { class: 'ldg-wrap' }, book, ribbons);
  const el = h('div', { class: 'll-veil ldg-veil', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'The Ledger' }, wrap);
  el.addEventListener('pointerdown', e => { if (e.target === el) ctx.close('ledger'); });

  // ── portraits, cached across renders
  const portraits = new Map<string, Portrait>();
  let used = new Set<string>();
  function portrait(key: string, spec: PortraitSpec): HTMLElement {
    used.add(key);
    let p = portraits.get(key);
    if (!p) { p = safePortrait(spec); portraits.set(key, p); }
    return p.el;
  }
  function sweepPortraits(): void { for (const [k, p] of portraits) if (!used.has(k)) { p.dispose(); portraits.delete(k); } }
  function disposeAll(): void { for (const p of portraits.values()) p.dispose(); portraits.clear(); }

  function act(a: Action): void { ctx.act(a); lastSig = ''; render(); }
  function confirmAsk(key: string): void {
    confirmKey = key; if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { confirmKey = null; if (isOpen) render(); }, 5000);
    render();
  }

  function setTab(t: LedgerTab, sound: boolean): void {
    if (t !== tab) { tab = t; lastTab = t; confirmKey = null; spread.scrollTop = 0; if (sound) ctx.audio.sfx('page', { volume: 0.6 }); }
    render();
  }

  // ── bands
  type Kids = (Node | string | null | undefined | false)[];
  const band = (left: Kids, right: Kids) => h('div', { class: 'ldg-band' }, h('div', { class: 'ldg-L' }, left), h('div', { class: 'ldg-R' }, right));
  const spanBand = (...kids: Kids) => h('div', { class: 'ldg-band' }, h('div', { class: 'ldg-S' }, kids));
  function heading(title: string, lede?: string | Node): HTMLElement {
    const first = title.replace(/^The /, '');
    const prefix = title.startsWith('The ') ? 'The ' : '';
    const letter = first[0] ?? '';
    const capEl = h('span', { class: 'ldg-cap', 'aria-hidden': 'true' });
    try { capEl.innerHTML = dropCap(letter, 52); } catch { capEl.innerHTML = `<span class="ll-black">${esc(letter)}</span>`; }
    const hEl = h('h2', { class: 'ldg-h', 'aria-label': title }, prefix ? h('span', { style: 'margin-right:8px' }, prefix.trim()) : null, capEl, h('span', null, first.slice(1)));
    return h('div', { class: 'ldg-block' }, hEl, lede ? h('p', { class: 'ldg-lede' }, lede) : null);
  }
  const h2 = (text: string, aside?: string) => h('h3', { class: 'ldg-h2' }, text, aside ? h('span', { class: 'ldg-aside' }, aside) : null);
  const flour = (seed: number) => { const d = h('div', { class: 'ldg-flourish', 'aria-hidden': 'true' }); try { d.innerHTML = flourish(220, seed); } catch { d.innerHTML = '<hr class="ll-rule">'; } return d; };
  function doodleEl(kind: DoodleKind, seed: number, size: number): HTMLElement | null {
    let svg = '';
    try { svg = doodle(kind, seed, size); } catch { svg = ''; }
    if (!svg) return null;
    const d = h('div', { class: 'ldg-doodle', 'aria-hidden': 'true' }); d.innerHTML = svg; return d;
  }
  function line(k: string, v: string, cls = ''): HTMLElement {
    return h('div', { class: 'ldg-line ' + cls }, h('span', { class: 'k' }, k), h('span', { class: 'lead' }), h('span', { class: 'v' }, v));
  }
  function chartWidth(): number {
    const w = content.clientWidth || 0;
    const narrow = typeof matchMedia === 'function' && matchMedia('(max-width:760px)').matches;
    const col = narrow ? w : w * 0.45;
    return Math.max(260, Math.round(col || 440));
  }

  // ═════════════ Accounts ═════════════
  function renderAccounts(s: GameState): HTMLElement[] {
    const b = books(s);
    const options: (number | 'year')[] = [...b.hist.map(m => m.index), b.curIdx];
    if (period === null || (period !== 'year' && !options.includes(period))) period = b.curIdx;
    const isYear = period === 'year';
    const sel: MonthBook[] = isYear ? (b.hist.length ? b.hist : [b.cur]) : [period === b.curIdx ? b.cur : b.hist.find(m => m.index === period)!];
    const isCurrent = !isYear && period === b.curIdx;
    const sum = combine(sel);
    const inTotal = sumRec(sum.income), outTotal = sumRec(sum.expense), net = inTotal - outTotal;
    const pLabel = isYear ? (b.hist.length ? `The last ${plural(b.hist.length, 'month')}` : 'This month so far') : monthLabel(period as number) + (isCurrent ? ', so far' : '');
    const d = dateOf(s.day);

    // period stepper
    const pos = isYear ? -1 : options.indexOf(period as number);
    const stepTo = (i: number) => { period = options[Math.max(0, Math.min(options.length - 1, i))]!; render(); };
    const periodRow = h('div', { class: 'ldg-period' },
      button('‹', () => stepTo((pos < 0 ? options.length - 1 : pos) - 1), { class: 'ldg-step', title: 'The month before', disabled: !isYear && pos <= 0 }),
      h('span', { class: 'ldg-pname', 'aria-live': 'polite' }, isYear ? 'The twelvemonth' : monthLabel(period as number)),
      button('›', () => stepTo(pos + 1), { class: 'ldg-step', title: 'The month after', disabled: isYear || pos >= options.length - 1 }),
      h('span', { class: 'll-grow' }),
      h('button', { class: 'ldg-chip' + (isCurrent ? ' is-on' : ''), type: 'button', onclick: () => { period = b.curIdx; render(); } }, 'This month'),
      b.hist.length ? h('button', { class: 'ldg-chip' + (isYear ? ' is-on' : ''), type: 'button', title: 'The last twelve closed months together', onclick: () => { period = 'year'; render(); } }, 'Twelve months') : null,
    );

    const inLines = INCOME_ORDER.filter(k => (sum.income[k] ?? 0) !== 0).map(k => line(CAT_LABEL[k], num(sum.income[k])));
    const outLines = EXPENSE_ORDER.filter(k => (sum.expense[k] ?? 0) !== 0).map(k => line(CAT_LABEL[k], num(sum.expense[k])));
    const acct = h('div', { class: 'ldg-acct' },
      h('div', { class: 'ldg-lines' }, h('div', { class: 'ldg-colh' }, 'Received'), inLines.length ? inLines : line('Nothing yet', '0', 'is-empty'), line('Total', num(inTotal), 'is-total')),
      h('div', { class: 'ldg-lines' }, h('div', { class: 'ldg-colh' }, 'Paid out'), outLines.length ? outLines : line('Nothing yet', '0', 'is-empty'), line('Total', num(outTotal), 'is-total')),
    );
    const netBox = h('div', { class: 'ldg-net' }, h('span', { class: 'k' }, isCurrent ? 'Net, so far' : 'Net'), h('span', { class: 'v ' + (net > 0 ? 'ldg-good' : net < 0 ? 'ldg-bad' : '') }, signed(net) + (Math.abs(Math.round(net)) === 1 ? ' crown' : ' crowns')));
    const pct = sum.rentDue > 0 ? Math.round(100 * sum.rentCollected / sum.rentDue) : null;
    const rentLine = h('p', { class: 'ldg-p ldg-small' },
      sum.rentDue > 0
        ? [`Rent due ${num(sum.rentDue)}, collected ${num(sum.rentCollected)}: `, h('b', { class: pct! >= 90 ? 'ldg-good' : pct! >= 70 ? 'ldg-warn' : 'ldg-bad' }, `${pct}%`), pct! < 100 ? `. ${num(sum.rentDue - sum.rentCollected)} crowns not yet in.` : '. Every crown of it.']
        : isCurrent && d.dom <= 1 ? 'Rent Day is today. The purses are on their way.' : 'No rent fell due in this period.');

    // tribute and the moneylender
    const trib = nextTribute(s);
    const tribBox = h('div', { class: 'ldg-box' },
      h('span', { class: 'bk' }, 'Next tribute'),
      trib.amount > 0
        ? [h('span', { class: 'bv' }, crowns(trib.amount)),
          h('span', { class: 'bn' }, `Due the 1st of ${MONTH_NAMES[((trib.idx % 12) + 12) % 12]}, ${untilText(trib.day - s.day)}. `,
            s.gold >= trib.amount ? h('span', { class: 'ldg-good' }, 'The coffers would cover it today.') : h('span', { class: 'ldg-bad' }, `The coffers are ${num(trib.amount - Math.max(0, s.gold))} crowns short.`))]
        : h('span', { class: 'bn' }, 'The Crown asks no tribute of you.'),
    );
    const debt = s.loans.reduce((a, l) => a + l.principal, 0);
    const interest = s.loans.reduce((a, l) => a + l.principal * l.ratePctMonth / 100, 0);
    const capAmt = BAL.loan.maxByRank[s.realm.rank];
    const rate = s.loans[0]?.ratePctMonth ?? BAL.loan.ratePctMonth;
    const repay = Math.min(Math.floor(Math.max(0, s.gold)), Math.ceil(debt));
    const debtBox = h('div', { class: 'ldg-box' },
      h('span', { class: 'bk' }, 'Owed to the moneylender'),
      h('span', { class: 'bv ' + (debt > 0 ? 'ldg-bad' : '') }, crowns(debt)),
      debt > 0
        ? h('span', { class: 'bn' }, `Interest ${crowns(Math.round(interest))} a month at ${rate}%. `, s.mode === 'iron' ? `Past ${num(capAmt * BAL.bankruptcyMult)} owed, the Iron Crown ends your reign.` : `Past ${num(capAmt)} for three months, the Crown takes a rank.`)
        : h('span', { class: 'bn' }, `Nothing owed. He would lend up to ${num(capAmt)} at ${rate}% a month, and says so often.`),
      debt > 0 && repay > 0 ? button(repay >= debt ? `Repay it all (${num(repay)})` : `Repay ${num(repay)}`, () => act({ type: 'repay_loan', amount: repay }), { title: 'Pay down the debt from the coffers' }) : null,
    );

    // day book
    const txns = s.ledger.txns.slice(-7).reverse();
    const daybook = h('div', { class: 'ldg-daybook' },
      txns.length ? txns.map(t => h('div', { class: 'ldg-dayrow' },
        h('span', { class: 'd' }, shortDate(t.day)), h('span', { class: 'm', title: t.memo }, t.memo || CAT_LABEL[t.cat] || human(t.cat)),
        h('span', { class: 'a ' + (t.amount >= 0 ? 'ldg-good' : 'ldg-bad') }, signed(t.amount)))) : h('p', { class: 'ldg-empty' }, 'Nothing entered yet.'));

    // right page: coffers, projection, charts
    const proj = project(s, b);
    const pj = proj.net;
    const projText = Math.abs(pj) < 1 ? [`At this rate you end the month `, h('b', null, 'about even'), '.'] : [`At this rate you end the month `, h('b', { class: pj > 0 ? 'ldg-good' : 'ldg-bad' }, `${num(Math.abs(pj))} ${Math.abs(pj) === 1 ? 'crown' : 'crowns'} ${pj > 0 ? 'up' : 'down'}`), '.'];
    const projParts: string[] = [];
    if (proj.purses > 0) projParts.push(`${num(proj.purses)} in purses still at doors`);
    if (proj.expectedRent - Math.min(proj.purses, proj.expectedRent) > 0) projParts.push(`${num(proj.expectedRent - Math.min(proj.purses, proj.expectedRent))} more rent expected at ${Math.round(proj.ratio * 100)}% paying`);
    if (proj.moreOut > 0) projParts.push(`${num(proj.moreOut)} in wages, upkeep and interest still to go out`);
    const endCoffers = Math.round(s.gold + (pj - proj.soFar));

    const W = chartWidth();
    const series = [...b.hist, b.cur];
    const netPts: NetPoint[] = series.map(m => ({ label: MONTH_ABBR[((m.index % 12) + 12) % 12]!, value: Math.round(sumRec(m.income) - sumRec(m.expense)), current: m.index === b.curIdx, title: monthLabel(m.index) }));
    const rentPts: RentPoint[] = series.map(m => ({ label: MONTH_ABBR[((m.index % 12) + 12) % 12]!, due: Math.round(m.rentDue), got: Math.round(m.rentCollected), current: m.index === b.curIdx, title: monthLabel(m.index) }));
    const netSvg = fromHTML(netChart(netPts, W)), rentSvg = fromHTML(rentChart(rentPts, W));

    // the twelvemonth at a glance (closed months only)
    const closed = b.hist;
    let yearBlock: HTMLElement;
    if (closed.length) {
      const nets = closed.map(m => ({ m, v: Math.round(sumRec(m.income) - sumRec(m.expense)) }));
      const best = nets.reduce((a, x) => (x.v > a.v ? x : a)), worst = nets.reduce((a, x) => (x.v < a.v ? x : a));
      const avg = nets.reduce((a, x) => a + x.v, 0) / nets.length;
      const yr = combine(closed);
      const yPct = yr.rentDue > 0 ? Math.round(100 * yr.rentCollected / yr.rentDue) : null;
      const upMonths = nets.filter(x => x.v > 0).length;
      const opening = closed[0]!.closing - (sumRec(closed[0]!.income) - sumRec(closed[0]!.expense));
      const kv: [string, Node | string, string?][] = [
        ['Best month', `${signed(best.v)} in ${MONTH_NAMES[((best.m.index % 12) + 12) % 12]}`, best.v > 0 ? 'ldg-good' : ''],
        ['Worst month', `${signed(worst.v)} in ${MONTH_NAMES[((worst.m.index % 12) + 12) % 12]}`, worst.v < 0 ? 'ldg-bad' : ''],
        ['Average, a month', signed(avg) + (Math.abs(Math.round(avg)) === 1 ? ' crown' : ' crowns'), avg < 0 ? 'ldg-bad' : ''],
        ['Months in profit', `${upMonths} of ${closed.length}`],
        ['Rent collected', yPct === null ? 'none fell due' : `${num(yr.rentCollected)} of ${num(yr.rentDue)} (${yPct}%)`, yPct !== null && yPct < 80 ? 'ldg-warn' : ''],
        ['Spent on building', crowns(yr.expense.construction + yr.expense.land)],
        ['Tribute paid', crowns(yr.expense.tribute)],
        ['Coffers then and now', `${num(Math.round(opening))} to ${num(s.gold)}`],
      ];
      yearBlock = h('div', { class: 'ldg-block' }, h2('The twelvemonth', `${plural(closed.length, 'closed month')}`),
        h('div', { class: 'ldg-kv' }, kv.flatMap(([k, v, cls]) => [h('span', { class: 'k' }, k), h('span', { class: 'v ' + (cls ?? '') }, v)])));
    } else {
      yearBlock = h('div', { class: 'ldg-block' }, h2('The twelvemonth'), h('p', { class: 'ldg-empty' }, 'No month has closed yet. The books open properly after the first Rent Day.'));
    }

    const coin = h('span', { class: 'ldg-coin', 'aria-hidden': 'true' }); coin.innerHTML = iconSvg('coin');
    return [
      band([
        heading('Accounts', `${fmtDate(s.day)}. Day ${d.dom} of ${DAYS_PER_MONTH}.`),
        periodRow,
        h('div', { class: 'ldg-block' }, h2(pLabel), acct),
        netBox,
        rentLine,
        h('div', { class: 'ldg-boxes' }, tribBox, debtBox),
      ], [
        h('div', { class: 'ldg-block', style: 'margin-top:8px' },
          h('div', { class: 'ldg-coffers' }, coin, h('div', null, h('div', { class: 'ldg-small', style: 'font-family:var(--f-head);letter-spacing:.1em' }, 'In the coffers'), h('div', { class: 'ldg-big ' + (s.gold < 0 ? 'ldg-bad' : '') }, crowns(s.gold))))),
        h('div', { class: 'ldg-block' },
          h('p', { class: 'ldg-proj' }, projText, h('span', { class: 'ldg-small', style: 'display:block;margin-top:3px;font-style:normal' },
            `${signed(proj.soFar)} so far this month${projParts.length ? ', with ' + projParts.join(', ') : ''}. Coffers at month end: about ${num(endCoffers)}.`))),
        h('div', { class: 'ldg-block' }, h2('Net, month by month', series.length > 1 ? `crowns, ${series.length} months` : 'crowns, this month'), netSvg,
          h('div', { class: 'ldg-legend' }, h('span', null, h('i', { class: 'sw-pos' }), 'Gain'), h('span', null, h('i', { class: 'sw-neg' }), 'Loss'), h('span', null, h('i', { class: 'sw-cur' }), 'This month so far'))),
        h('div', { class: 'ldg-block' }, h2('Rent due against collected', 'crowns'), rentSvg,
          h('div', { class: 'ldg-legend' }, h('span', null, h('i', { class: 'sw-due' }), 'Due'), h('span', null, h('i', { class: 'sw-got' }), 'Collected'), h('span', { class: 'ldg-faint' }, 'Figure above: share collected'))),
      ]),
      band([h('div', { class: 'ldg-block' }, h2('The day book', 'latest first'), daybook)], [yearBlock]),
    ];
  }

  // ═════════════ Households ═════════════
  interface Row { t: Tenant; b: Building; market: number; months: number; leaseEnd: number | null; home: string }
  function renderHouseholds(s: GameState): HTMLElement[] {
    const rows: Row[] = housed(s).map(t => {
      const b = s.buildings[t.buildingId!]!;
      return { t, b, market: safeMarket(s, b), months: Math.max(0, Math.floor((s.day - t.movedInDay) / DAYS_PER_MONTH)),
        leaseEnd: t.lease ? t.lease.startDay + t.lease.termMonths * DAYS_PER_MONTH : null,
        home: b.name + (b.units.length > 1 ? ` ${t.unit + 1}` : '') };
    });
    const key: Record<SortKey, (r: Row) => number | string> = {
      name: r => r.t.name.toLowerCase(), home: r => r.home.toLowerCase(), months: r => r.months, rent: r => r.t.lease?.rent ?? 0,
      market: r => r.market, hap: r => r.t.happiness, owe: r => r.t.arrears * 10 + STAGE_RANK[r.t.lateStage], lease: r => r.leaseEnd ?? 1e9,
    };
    const k = key[sort.key];
    rows.sort((a, b2) => { const x = k(a), y = k(b2); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.t.name.localeCompare(b2.t.name); });

    const cols: { k: SortKey; label: string; w: string; n?: boolean; side: 'L' | 'R' }[] = [
      { k: 'name', label: 'Household', w: '23%', side: 'L' }, { k: 'home', label: 'Home', w: '14%', side: 'L' }, { k: 'months', label: 'Months', w: '8%', n: true, side: 'L' },
      { k: 'rent', label: 'Rent', w: '6.5%', n: true, side: 'R' }, { k: 'market', label: 'Market', w: '8%', n: true, side: 'R' }, { k: 'hap', label: 'Content', w: '11%', n: true, side: 'R' },
      { k: 'owe', label: 'Owing', w: '9.5%', n: true, side: 'R' }, { k: 'lease', label: 'Lease ends', w: '10%', side: 'R' },
    ];
    const setSort = (c: SortKey) => { sort = sort.key === c ? { key: c, dir: (sort.dir === 1 ? -1 : 1) } : { key: c, dir: c === 'owe' || c === 'hap' || c === 'rent' || c === 'months' ? -1 : 1 }; render(); };
    const th = (c: typeof cols[number]) => h('th', {
      class: 'sortable' + (c.n ? ' n' : '') + (sort.key === c.k ? ' is-sorted' : ''), scope: 'col', tabindex: '0',
      'aria-sort': sort.key === c.k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none',
      onclick: () => setSort(c.k), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSort(c.k); } },
      dataset: { fk: 'sort-' + c.k },
    }, c.n ? h('span', { class: 'arr' }, sort.key === c.k ? (sort.dir === 1 ? '▴' : '▾') : '') : null, c.label, !c.n ? h('span', { class: 'arr' }, sort.key === c.k ? (sort.dir === 1 ? '▴' : '▾') : '') : null);
    const pick = (r: Row) => { ctx.close('ledger'); ctx.select({ tenantId: r.t.id }); try { ctx.renderer.focus({ buildingId: r.b.id }, { ms: 600 }); } catch { /* the table may be busy */ } };

    const body = rows.map(r => {
      const t = r.t, rent = t.lease?.rent ?? 0;
      const ratio = r.market > 0 ? rent / r.market : 1;
      const tags = t.tags.map(x => human(x)).join(', ');
      const sub = [speciesAdj(t.species), tradeName(t.trade), plural(t.household, 'soul'), tags].filter(Boolean).join(' · ');
      const daysToEnd = r.leaseEnd !== null ? r.leaseEnd - s.day : null;
      const owe = t.arrears > 0 || t.lateStage !== 'none'
        ? h('td', { class: 'n', 'data-c': 'owe', 'data-lab': 'Owing' }, h('span', { class: t.arrears > 0 ? 'ldg-bad' : '' }, num(t.arrears)),
          t.lateStage !== 'none' ? h('span', { class: 'ldg-stage ' + (STAGE_RANK[t.lateStage] >= 4 ? 'ldg-rub' : 'ldg-warn') }, t.lateStage === 'court' && t.courtDay !== null ? `court ${untilText(t.courtDay - s.day)}` : t.lateStage === 'plan' && t.plan ? `plan, ${t.plan.left} × ${t.plan.each}` : STAGE_WORD[t.lateStage]) : null)
        : h('td', { class: 'n', 'data-c': 'owe' }, h('span', { class: 'ldg-paid' }, 'paid up'));
      const row = h('tr', { tabindex: '0', title: `Find ${t.name} on the table`, dataset: { fk: 'hh-' + t.id },
        onclick: () => pick(r), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); } } },
        h('td', { 'data-c': 'who' }, h('div', { class: 'ldg-who' }, h('span', { class: 'pt' }, portrait('t' + t.id, { species: t.species, seed: t.portraitSeed, trade: t.trade, size: 34, frame: true })),
          h('span', { class: 'tx' }, h('span', { class: 'nm' }, t.name), h('span', { class: 'ldg-sub' }, sub)))),
        h('td', { 'data-c': 'home', title: `${r.b.name}, ${BUILDINGS[r.b.type].name.toLowerCase()}` }, r.home, h('span', { class: 'ldg-sub' }, BUILDINGS[r.b.type].name)),
        h('td', { class: 'n', 'data-c': 'months', 'data-lab': 'Months' }, String(r.months)),
        h('td', { class: 'gut', 'aria-hidden': 'true' }),
        h('td', { class: 'n', 'data-c': 'rent', title: ratio > 1.1 ? `${Math.round((ratio - 1) * 100)}% above market` : ratio < 0.9 ? `${Math.round((1 - ratio) * 100)}% below market` : 'At market' },
          h('span', { class: ratio > 1.1 ? 'ldg-over' : ratio < 0.9 ? 'ldg-under' : '' }, num(rent)), h('span', { class: 'ldg-sub' }, ratio > 1.1 ? 'over' : ratio < 0.9 ? 'under' : ' ')),
        h('td', { class: 'n ldg-faint', 'data-c': 'market' }, num(r.market)),
        h('td', { class: 'n', 'data-c': 'hap' }, h('div', { class: 'ldg-hap' }, meter(t.happiness, { title: `Happiness ${Math.round(t.happiness)}` }), h('span', { class: 'num' }, String(Math.round(t.happiness))))),
        owe,
        h('td', { 'data-c': 'lease', 'data-lab': 'Lease ends' }, r.leaseEnd === null ? h('span', { class: 'ldg-faint' }, 'no lease') :
          [h('span', { class: daysToEnd !== null && daysToEnd <= 30 ? 'ldg-warn' : '' }, `${MONTH_ABBR[dateOf(r.leaseEnd).month]} Y${dateOf(r.leaseEnd).year}`), h('span', { class: 'ldg-sub' }, untilText(daysToEnd ?? 0))]),
      );
      return row;
    });

    const n = rows.length;
    const roll = rows.reduce((a, r) => a + (r.t.lease?.rent ?? 0), 0), mkt = rows.reduce((a, r) => a + r.market, 0);
    const avgHap = n ? rows.reduce((a, r) => a + r.t.happiness, 0) / n : 0;
    const owing = rows.reduce((a, r) => a + r.t.arrears, 0);
    const ending = rows.filter(r => r.leaseEnd !== null && r.leaseEnd - s.day <= 60).length;
    const avgMonths = n ? rows.reduce((a, r) => a + r.months, 0) / n : 0;
    const table = h('table', { class: 'ldg-htable' },
      h('colgroup', null, cols.filter(c => c.side === 'L').map(c => h('col', { style: `width:${c.w}` })), h('col', { style: 'width:10%' }), cols.filter(c => c.side === 'R').map(c => h('col', { style: `width:${c.w}` }))),
      h('thead', null, h('tr', null, cols.filter(c => c.side === 'L').map(th), h('th', { class: 'gut', 'aria-hidden': 'true' }), cols.filter(c => c.side === 'R').map(th))),
      h('tbody', null, body),
      n ? h('tfoot', null, h('tr', null,
        h('td', null, plural(n, 'household')), h('td', null, ''), h('td', { class: 'n', title: 'Average months housed' }, avgMonths.toFixed(0)),
        h('td', { class: 'gut' }), h('td', { class: 'n', title: 'Rent roll a month' }, num(roll)), h('td', { class: 'n', title: 'Market rent for the same homes' }, num(mkt)),
        h('td', { class: 'n', title: 'Average happiness' }, String(Math.round(avgHap))), h('td', { class: 'n ' + (owing > 0 ? 'ldg-bad' : '') }, num(owing)),
        h('td', null, ending ? `${ending} within 60 days` : ''))) : null,
    );
    const sortbar = h('div', { class: 'ldg-sortbar' }, h('span', { class: 'ldg-small' }, 'Sort by'),
      cols.filter(c => c.k !== 'market').map(c => h('button', { class: 'ldg-chip' + (sort.key === c.k ? ' is-on' : ''), type: 'button', onclick: () => setSort(c.k) }, c.label + (sort.key === c.k ? (sort.dir === 1 ? ' ▴' : ' ▾') : ''))));

    // vacancies and departures
    const vac: { b: Building; unit: number; days: number }[] = [];
    for (const b of Object.values(s.buildings)) if (b.state === 'ready') b.units.forEach((u, i) => { if (!u.tenantId) vac.push({ b, unit: i, days: u.vacantSince !== null ? Math.max(0, s.day - u.vacantSince) : 0 }); });
    vac.sort((a, b2) => b2.days - a.days);
    const homes = Object.values(s.buildings).filter(b => b.state === 'ready').reduce((a, b) => a + b.units.length, 0);
    const vacList = vac.length ? h('div', { class: 'ldg-list' }, vac.map(v => {
      const u = v.b.units[v.unit]!; const m = safeMarket(s, v.b);
      const app = Object.values(s.applicants).find(a => a.buildingId === v.b.id && a.unit === v.unit);
      return h('button', { class: 'ldg-item', type: 'button', title: `Find ${v.b.name} on the table`, onclick: () => { ctx.close('ledger'); ctx.select({ buildingId: v.b.id }); try { ctx.renderer.focus({ buildingId: v.b.id }, { ms: 600 }); } catch { /* fine */ } } },
        h('span', { class: 't' }, v.b.name + (v.b.units.length > 1 ? `, unit ${v.unit + 1}` : '')),
        h('span', { class: 'r ' + (v.days >= 40 ? 'ldg-bad' : v.days >= 20 ? 'ldg-warn' : '') }, v.days < 1 ? 'empty since today' : `empty ${plural(Math.floor(v.days), 'day')}`),
        h('span', { class: 's' }, `${BUILDINGS[v.b.type].name}, asking ${v.b.rent} (market ${m})`,
          u.listed ? tag('listed', 'lapis') : tag('not listed'),
          v.b.squatters ? tag(`${human(v.b.squatters.kind)} in residence`, 'bad') : null,
          app ? tag(`${app.household.first} is waiting`, 'gold') : null,
          v.days >= 40 && !v.b.squatters ? h('span', { class: 'ldg-bad' }, 'Squatters notice these things.') : null));
    })) : h('p', { class: 'ldg-empty' }, 'Every home is let. Enjoy it while it lasts.');
    const gone = Object.values(s.tenants).filter(t => t.status !== 'housed' && t.leftDay !== null && s.day - t.leftDay <= 60).sort((a, b2) => (b2.leftDay ?? 0) - (a.leftDay ?? 0));
    const goneList = gone.length ? h('div', { class: 'ldg-list' }, gone.slice(0, 6).map(t => h('div', { class: 'ldg-item' },
      h('span', { class: 't' }, t.name), h('span', { class: 'r ldg-faint' }, agoText(s.day - (t.leftDay ?? s.day))),
      h('span', { class: 's' }, t.status === 'evicted' ? tag('evicted', 'bad') : tag('left'), t.arrears > 0 ? h('span', { class: 'ldg-bad' }, `left owing ${t.arrears}`) : null)))) : null;

    const lates = rows.filter(r => r.t.lateStage !== 'none' && r.t.lateStage !== 'grace').length;
    const summary = h('div', { class: 'ldg-kv' },
      h('span', { class: 'k' }, 'Homes let'), h('span', { class: 'v' }, `${homes - vac.length} of ${homes}` + (homes ? ` (${Math.round(100 * (homes - vac.length) / homes)}%)` : '')),
      h('span', { class: 'k' }, 'Rent roll'), h('span', { class: 'v' }, crowns(roll) + ' a month'),
      h('span', { class: 'k' }, 'Against market'), h('span', { class: 'v ' + (mkt && roll > mkt * 1.05 ? 'ldg-warn' : '') }, mkt ? (Math.abs(roll - mkt) / mkt < 0.02 ? 'at market' : `${Math.round(Math.abs(roll - mkt) / mkt * 100)}% ${roll > mkt ? 'over' : 'under'}`) : 'nil'),
      h('span', { class: 'k' }, 'Owing'), h('span', { class: 'v ' + (owing ? 'ldg-bad' : '') }, owing ? `${crowns(owing)}, ${plural(lates, 'household')} behind` : 'nobody'),
      h('span', { class: 'k' }, 'Content'), h('span', { class: 'v' }, n ? `${Math.round(avgHap)} on average` : 'nil'),
    );
    return [
      band([heading('Households', n ? h('span', null, h('span', { class: 'ldg-wide' }, 'Names on this page; figures on the facing one. '), 'Choose a household to find them on the table.') : 'Nobody lives here yet. The mud is not complaining.'),
        n ? h('p', { class: 'ldg-p ldg-small ldg-key' }, 'Rent in ', h('span', { class: 'ldg-under' }, 'green'), ' is under market; in ', h('span', { class: 'ldg-over' }, 'amber'), ', over it. Content runs from 0 to 100, and the least content are the first to leave. Owing shows arrears and how far the matter has gone.') : null],
        [h('div', { class: 'ldg-block', style: 'margin-top:14px' }, h2('In sum'), summary)]),
      spanBand(sortbar, n ? table : null),
      band([h('div', { class: 'ldg-block' }, h2('Vacancies', vac.length ? plural(vac.length, 'empty home') : undefined), vacList)],
        [goneList ? h('div', { class: 'ldg-block' }, h2('Departed lately'), goneList) : null]),
    ];
  }

  // ═════════════ Standing orders ═════════════
  function exampleSayings(s: GameState): HTMLElement[] {
    const nm = (role: string, fallback: string) => staffFor(s, role)?.first ?? fallback;
    return [
      h('p', { class: 'ldg-saying' }, `${nm('bailiff', 'Bailiff')}, never serve notice on a widow in winter.`, h('small', null, 'Governs late rent. Strikes one choice, for one kind of household, in one season.')),
      h('p', { class: 'ldg-saying' }, `${nm('mason', 'Mason')}, always mend leaks properly. No patching.`, h('small', null, 'Governs repairs. Picks the proper repair every time, and its price.')),
      h('p', { class: 'ldg-saying' }, `${nm('crier', 'Crier')}, ask the last landlord of anyone who applies.`, h('small', null, 'Governs applicants. Slower lettings; fewer surprises.')),
    ];
  }
  function renderOrders(s: GameState): HTMLElement[] {
    const orders = [...s.orders].sort((a, b) => b.createdDay - a.createdDay);
    if (!orders.length) {
      return [band([
        heading('Standing Orders', 'Said once, they hold until you revoke them.'),
        h('p', { class: 'ldg-p' }, 'You have given none. Standing orders are made by speaking: say a rule aloud to one of your household, or to the court, and once they have read it back and you have said aye, it is written here.'),
        h('p', { class: 'ldg-p' }, 'Thereafter, whenever the matter comes up and nobody has asked you, the rule decides. An order to never do a thing strikes that choice; an order to always do it makes the choice for them.'),
        h('p', { class: 'ldg-p ldg-small ldg-em' }, 'A bad outcome is your wording, never a coin flip. Choose words as you would choose a mason.'),
      ], [h('div', { class: 'ldg-block', style: 'margin-top:14px' }, h2('Things a ruler might say'), ...exampleSayings(s))])];
    }
    const entry = (o: StandingOrder) => {
      const m = o.to === 'all' ? null : staffFor(s, o.to);
      const toText = o.to === 'all' ? 'To the whole household' : m ? `To ${m.name}, ${ROLE_TITLES[o.to]}` : `To the ${ROLE_TITLES[o.to]} (the post is empty)`;
      const ck = 'revoke-' + o.id;
      const asking = confirmKey === ck;
      return h('article', { class: 'ldg-order' },
        h('div', { class: 'to' }, m ? h('span', { class: 'pt' }, portrait('o' + o.id, { species: m.species, seed: m.portraitSeed, role: m.role, size: 26, frame: true })) : null, toText, h('span', { class: 'when' }, `Given ${fmtDate(o.createdDay)}`)),
        h('p', { class: 'ldg-words' }, o.text),
        o.gist ? h('p', { class: 'ldg-gist' }, h('b', null, (m?.first ?? (o.to === 'all' ? 'The household' : ROLE_TITLES[o.to as keyof typeof ROLE_TITLES])) + ':'), ` “${o.gist}”`) : null,
        h('p', { class: 'ldg-governs' }, h('span', { class: 'hand', 'aria-hidden': 'true' }, '☞'), h('span', null, orderInWords(s, o))),
        h('div', { class: 'foot' }, h('span', null, o.uses === 0 ? 'Not yet used' : o.uses === 1 ? 'Used once' : `Used ${num(o.uses)} times`),
          asking
            ? [button('Keep it', () => { confirmKey = null; render(); }, { kind: 'quiet', class: 'ldg-keep' }), button('Revoke it', () => { confirmKey = null; act({ type: 'revoke_order', orderId: o.id }); }, { kind: 'danger', title: 'Strike this order from the book' })]
            : button('Revoke', () => confirmAsk(ck), { title: 'Strike this order from the book' })));
    };
    const L: HTMLElement[] = [], R: HTMLElement[] = [];
    orders.forEach((o, i) => (i % 2 === 0 ? L : R).push(entry(o)));
    const counts = new Map<string, number>();
    for (const o of orders) counts.set(o.to, (counts.get(o.to) ?? 0) + 1);
    const nameOf = (role: string) => role === 'all' ? 'the whole household' : staffFor(s, role)?.first ?? 'the ' + ROLE_TITLES[role as keyof typeof ROLE_TITLES];
    const byCount = new Map<number, string[]>();
    for (const [role, c] of counts) { const l = byCount.get(c) ?? []; l.push(nameOf(role)); byCount.set(c, l); }
    const who = [...byCount.entries()].sort((a, b) => b[0] - a[0]).map(([c, names], i) => {
      const list = andList(names), many = names.length > 1;
      return i === 0 ? `${cap(list)} ${many ? 'are' : 'is'} bound by ${countWord(c)}${many ? ' each' : ''}` : `${list} by ${countWord(c)}${many ? ' each' : ''}`;
    }).join('; ');
    const usedTotal = orders.reduce((a, o) => a + o.uses, 0);
    const idle = orders.filter(o => o.uses === 0).length;
    return [
      band([heading('Standing Orders', 'Said once, they hold until you revoke them.')],
        [h('div', { class: 'ldg-block', style: 'margin-top:14px' }, h2('In sum'),
          h('p', { class: 'ldg-p' }, `${cap(countWord(orders.length))} ${orders.length === 1 ? 'order' : 'orders'} in force, used ${usedTotal === 0 ? 'not once yet' : usedTotal === 1 ? 'once' : countWord(usedTotal) + ' times'} in all${idle ? `; ${countWord(idle)} still waiting for their moment` : ''}. ${who}.`))]),
      band(L, R),
      spanBand(flour(3), h('p', { class: 'ldg-p ldg-small ldg-em', style: 'text-align:center;margin-top:6px' }, 'New orders are made by speaking. Say the rule to whoever it concerns, and say aye when they read it back.')),
    ];
  }

  // ═════════════ Oaths ═════════════
  function renderOaths(s: GameState): HTMLElement[] {
    const open = s.oaths.filter(o => o.state === 'open').sort((a, b) => a.dueDay - b.dueDay);
    const done = s.oaths.filter(o => o.state !== 'open').sort((a, b) => (b.settledDay ?? b.dueDay) - (a.settledDay ?? a.dueDay));
    const kept = Math.max(s.stats.oathsKept, s.oaths.filter(o => o.state === 'kept').length);
    const broke = Math.max(s.stats.oathsBroken, s.oaths.filter(o => o.state === 'broken').length);
    const openCards = open.map(o => {
      const left = o.dueDay - s.day, urgent = left <= 10;
      const span = Math.max(1, o.dueDay - o.madeDay), elapsed = Math.max(0, Math.min(1, (s.day - o.madeDay) / span));
      const t = o.toTenantId ? s.tenants[o.toTenantId] : null;
      const ck = 'release-' + o.id, asking = confirmKey === ck;
      return h('div', { class: 'ldg-oath' + (urgent ? ' is-urgent' : '') },
        h('div', { class: 'top' },
          t ? h('span', { class: 'pt' }, portrait('w' + o.id, { species: t.species, seed: t.portraitSeed, trade: t.trade, size: 34, frame: true })) : null,
          h('span', { class: 'who' }, `To ${o.toName}`, h('span', { class: 'what' }, oathWhat(s, o))),
          h('span', { class: 'left ' + (urgent ? 'ldg-rub' : '') }, left <= -1 ? 'Past due' : left <= 0 ? 'Due today' : plural(Math.ceil(left), 'day') + ' left', h('small', null, `by ${fmtDate(o.dueDay)}`))),
        h('p', { class: 'ldg-words', style: 'font-size:16px' }, o.text),
        meter(elapsed * 100, { kind: urgent ? 'bad' : 'gold', title: `${Math.round(elapsed * 100)}% of the time given has passed` }),
        h('div', { class: 'acts' }, asking
          ? h('div', { class: 'cnc-confirm', style: 'width:100%' }, h('p', null, `Ask ${t?.first ?? o.toName} to let you off? If they are not pleased with you, it counts as broken, and the street will hear of it.`),
            h('div', { class: 'cnc-acts' }, button('Never mind', () => { confirmKey = null; render(); }, { kind: 'quiet' }), button('Ask them', () => { confirmKey = null; act({ type: 'release_oath', oathId: o.id }); }, { kind: 'danger' })))
          : button('Ask to be released', () => confirmAsk(ck), { kind: 'quiet', title: 'They may let you off, or not' })));
    });
    const recs = done.slice(0, 30).map(o => h('div', { class: 'ldg-rec' },
      h('span', { class: 'ldg-stamp ' + o.state }, o.state === 'released' ? 'Let off' : o.state),
      h('span', { class: 'tx ' + (o.state === 'broken' ? 'broken' : '') }, `“${o.text}”`),
      h('span', { class: 'mt' }, `To ${o.toName}. Sworn ${shortDate(o.madeDay)}, ${o.state === 'kept' ? 'kept' : o.state === 'broken' ? 'broken' : 'released'} ${o.settledDay !== null ? shortDate(o.settledDay) : ''}.`)));
    const urgentN = open.filter(o => o.dueDay - s.day <= 10).length;
    return [band([
      heading('The Ledger of Oaths', open.length ? `${plural(open.length, 'promise')} outstanding${urgentN ? `, ${urgentN} nearly due` : ''}.` : 'Nothing outstanding.'),
      open.length ? h('div', { class: 'ldg-block' }, h2('Sworn and open', 'soonest first'), ...openCards)
        : h('p', { class: 'ldg-empty' }, 'You have sworn nothing that is still owed. Promises are made in conversation: an audience, a visit, a word at the door. They are written here the moment you make them.'),
    ], [
      h('div', { class: 'ldg-block', style: 'margin-top:14px' }, h2('The running tally'),
        h('div', { class: 'ldg-tally' },
          h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Kept'), h('span', { html: kept ? tallySvg(kept, 'kept') : '<span class="ldg-faint ldg-small">none yet</span>' }), h('span', { class: 'cnt ldg-good' }, String(kept))),
          h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Broken'), h('span', { html: broke ? tallySvg(broke, 'broke') : '<span class="ldg-faint ldg-small">none, so far</span>' }), h('span', { class: 'cnt ldg-rub' }, String(broke)))),
        h('p', { class: 'ldg-p ldg-small' }, kept + broke === 0 ? 'Your word has not yet been tested.' : broke === 0 ? 'Not one broken. People have begun to repeat your promises to each other as if they were facts.' : kept >= broke * 3 ? 'Mostly kept. The broken ones are remembered more vividly.' : 'The street has started to say "a lord\'s promise" the way it says "a dry summer".')),
      h('div', { class: 'ldg-block' }, h2('The record', done.length ? 'newest first' : undefined), recs.length ? recs : h('p', { class: 'ldg-empty' }, 'No oath has yet come due.')),
    ])];
  }

  // ═════════════ Policies ═════════════
  function renderPolicies(s: GameState): HTMLElement[] {
    const p = s.policies, R = typicalRent(s);
    const hasSteward = !!staffFor(s, 'steward');
    const set = (patch: Partial<Policies>) => act({ type: 'set_policy', policy: patch });
    const stepper = (fk: string, value: number, label: string, min: number, max: number, step: number, key: keyof Policies) =>
      h('span', { class: 'ldg-stepper', role: 'group', 'aria-label': fk },
        h('button', { type: 'button', 'aria-label': 'Less', disabled: value <= min, dataset: { fk: fk + '-dn' }, onclick: () => set({ [key]: Math.max(min, Math.round((value - step) * 100) / 100) } as Partial<Policies>) }, '−'),
        h('span', { class: 'val', 'aria-live': 'polite' }, label),
        h('button', { type: 'button', 'aria-label': 'More', disabled: value >= max, dataset: { fk: fk + '-up' }, onclick: () => set({ [key]: Math.min(max, Math.round((value + step) * 100) / 100) } as Partial<Policies>) }, '+'));
    const seg = <T extends string>(fk: string, value: T, opts: [T, string][], key: keyof Policies) =>
      h('span', { class: 'ldg-seg', role: 'radiogroup', 'aria-label': fk }, opts.map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), class: v === value ? 'is-on' : '', dataset: { fk: fk + '-' + v }, onclick: () => { if (v !== value) set({ [key]: v } as Partial<Policies>); } }, l)));
    const pol = (name: string, control: HTMLElement, cons: (Node | string)[]) => h('div', { class: 'ldg-pol' }, h('div', { class: 'hd' }, h('span', { class: 'nm' }, name), control), h('p', { class: 'cons' }, cons));
    const B = (t: string) => h('b', null, t);

    const g = p.graceDays;
    const graceCons = g <= 0 ? ['Rent is late the moment Rent Day ends. Strict, and the street will call it that.']
      : [`Rent counts as late from the `, B(ordinal(g + 1)), `. Anyone short has ${plural(g, 'day')} to find it before you hear of it.`, g > 7 ? ' Generous. Some will use every day of it.' : ''];
    const f = p.lateFeePct, fee = Math.max(1, Math.round(R * f / 100));
    const feeCons = f <= 0 ? ['No fee. A late payer owes the rent and nothing more.']
      : ['When a fee is charged, a late payer on a ', B(`${R}-crown`), ' rent owes ', B(`${fee} ${fee === 1 ? 'crown' : 'crowns'} more`), '. Fees bring coin and cost goodwill.', f >= 25 ? ' Steep. Expect it to be mentioned at the well.' : ''];
    const cpct = p.renewalCapPct, capped = R + Math.floor(R * cpct / 100);
    const capCons = cpct <= 0 ? ['Rents never rise at renewal. Households love it. The coffers notice.']
      : ['At renewal no rent rises more than ', B(`${cpct}%`), ` a year: a ${R}-crown rent can become at most `, B(String(capped)), '.', cpct >= 20 ? ' The Crown\'s cap is rather a loose one.' : ''];
    const a = p.askPct;
    const askCons: (Node | string)[] = [hasSteward ? 'Your Steward lists vacancies at ' : 'Vacancies will be listed at ', B(`${a}% of market`), '. ',
      a < 95 ? 'A bargain. They fill fast and settle happy.' : a > 105 ? 'Steep. Slower to fill, quicker to sour.' : 'A fair price, let fairly quickly.',
      hasSteward ? '' : ' This applies once you keep a Steward; until then, set asking rents by hand on each building.'];
    const dm = p.depositMonths, dep = Math.round(R * dm);
    const depCons = dm <= 0 ? ['No surety asked. Easier to let; nothing held against damage.']
      : ['New households hand over ', B(`${dm} ${dm === 1 ? 'month' : 'months'} of rent`), ` as surety: ${dep} crowns on a ${R}-crown rent. Larger sureties cover more damage and put off poorer applicants.`];
    const petN = housed(s).filter(t => t.pets.length > 0).length;
    const petCons: (Node | string)[] = [p.pets === 'allow' ? 'Pets are welcome. That includes, in time, a griffin.' : p.pets === 'pet_rent' ? 'Pets are allowed, for a little extra rent and a surety against the thatch.' : 'No pets. Most households comply. Some acquire a very quiet cat.',
      ` ${petN === 0 ? 'No household keeps one now.' : `${plural(petN, 'household')} ${petN === 1 ? 'keeps' : 'keep'} one now.`}`];
    const scrCons = p.screening === 'always' ? ['Every applicant\'s last landlord is asked before they sign. Slower; you learn their habits first.'] : ['You take applicants as they come. Faster, and full of surprises.'];

    return [band([
      heading('Policies of the Realm', 'Your household follows these unless a standing order says otherwise.'),
      h('div', { class: 'ldg-block' }, h2('Rent and lateness'),
        pol('Grace days', stepper('grace', g, plural(g, 'day'), 0, 14, 1, 'graceDays'), graceCons),
        pol('Late fee', stepper('fee', f, f ? `${f}% of rent` : 'none', 0, 50, 5, 'lateFeePct'), feeCons),
        pol('Cap on rises', stepper('cap', cpct, cpct ? `${cpct}% a year` : 'no rises', 0, 30, 1, 'renewalCapPct'), capCons)),
    ], [
      h('div', { class: 'ldg-block', style: 'margin-top:14px' }, h2('Letting'),
        pol('Asking rent', stepper('ask', a, `${a}% of market`, 60, 160, 5, 'askPct'), askCons),
        pol('Surety', stepper('dep', dm, dm ? `${dm} ${dm === 1 ? 'month' : 'months'}` : 'none', 0, 3, 0.5, 'depositMonths'), depCons),
        pol('Pets', seg('pets', p.pets, [['allow', 'Allowed'], ['pet_rent', 'Pet rent'], ['ban', 'Forbidden']], 'pets'), petCons),
        pol('Asking after them', seg('screen', p.screening, [['never', 'Take them as they come'], ['always', 'Always ask']], 'screening'), scrCons)),
      h('p', { class: 'ldg-p ldg-small ldg-em' }, `Figures above use a typical rent in ${s.realm.name} of ${R} crowns. Policies can also be set by speaking: "three days' grace, then the fee."`),
    ])];
  }

  // ═════════════ The realm ═════════════
  function renderRealm(s: GameState): HTMLElement[] {
    const CAT_NAME: Record<BuildingCategory, string> = { housing: 'Homes', commercial: 'Trades', amenity: 'Amenities', staff: 'The household', seat: 'Your seat' };
    const cats: BuildingCategory[] = ['housing', 'commercial', 'amenity', 'staff', 'seat'];
    const all = Object.values(s.buildings);
    const rowsByCat = cats.map(c => {
      const types = new Map<BuildingType, Building[]>();
      for (const b of all) if (BUILDINGS[b.type]?.category === c) { const l = types.get(b.type) ?? []; l.push(b); types.set(b.type, l); }
      return { c, types: [...types.entries()].sort((a, b) => b[1].length - a[1].length) };
    }).filter(x => x.types.length);
    const ready = all.filter(b => b.state === 'ready');
    const avgCond = ready.length ? ready.reduce((a, b) => a + b.condition, 0) / ready.length : 0;
    const census = h('table', { class: 'ldg-census' },
      h('thead', null, h('tr', null, h('th', null, 'Building'), h('th', { class: 'n' }, 'Count'), h('th', null, 'Condition'), h('th', { class: 'n' }, 'Worst'))),
      h('tbody', null, rowsByCat.flatMap(({ c, types }) => [
        h('tr', { class: 'cat' }, h('td', { colspan: '4' }, CAT_NAME[c])),
        ...types.map(([type, list]) => {
          const rd = list.filter(b => b.state === 'ready'), bld = list.filter(b => b.state === 'building').length, ru = list.filter(b => b.state === 'ruined').length;
          const avg = rd.length ? rd.reduce((a, b) => a + b.condition, 0) / rd.length : 0;
          const worst = rd.length ? Math.min(...rd.map(b => b.condition)) : null;
          const def = BUILDINGS[type];
          const extra = [bld ? `${bld} going up` : '', ru ? `${ru} ruined` : ''].filter(Boolean).join(', ');
          return h('tr', null,
            h('td', null, type === 'seat' ? (def.levelNames?.[(list[0]?.level ?? 1) - 1] ?? def.name) : (rd.length === 1 && !extra ? def.name : def.plural), extra ? h('span', { class: 'cw' }, ` (${extra})`) : null),
            h('td', { class: 'n' }, String(rd.length)),
            h('td', null, rd.length ? [meter(avg), h('span', { class: 'cw' }, condWord(avg))] : h('span', { class: 'cw' }, 'nil')),
            h('td', { class: 'n ' + (worst !== null && worst < 35 ? 'ldg-bad' : '') }, worst === null ? '' : String(Math.round(worst))));
        })])));
    const owned = s.map.parcels.filter(p => p.owned).length;
    const people = housed(s);
    const bySp = new Map<Species, Tenant[]>();
    for (const t of people) { const l = bySp.get(t.species) ?? []; l.push(t); bySp.set(t.species, l); }
    const souls = people.reduce((a, t) => a + t.household, 0);
    const avgHap = people.length ? people.reduce((a, t) => a + t.happiness, 0) / people.length : 0;
    const content = people.filter(t => t.happiness >= 60).length, sour = people.filter(t => t.happiness < 35).length;
    const peoples = h('table', { class: 'ldg-census' },
      h('thead', null, h('tr', null, h('th', null, 'People'), h('th', { class: 'n' }, 'Households'), h('th', { class: 'n' }, 'Souls'), h('th', null, 'Content'))),
      h('tbody', null, [...bySp.entries()].sort((a, b) => b[1].length - a[1].length).map(([sp, list]) => {
        const hap = list.reduce((a, t) => a + t.happiness, 0) / list.length;
        return h('tr', null, h('td', null, SPECIES_DEFS[sp]?.plural ?? cap(sp)), h('td', { class: 'n' }, String(list.length)), h('td', { class: 'n' }, String(list.reduce((a, t) => a + t.household, 0))),
          h('td', null, meter(hap), h('span', { class: 'cw' }, String(Math.round(hap)))));
      })));

    // standing: renown and favour, and what has moved them lately
    const recentH = (kinds: Herald['kind'][], max: number) => s.heralds.filter(x => kinds.includes(x.kind)).slice(-max).reverse();
    const arrowFor = (k: Herald['kind'], text: string): ['up' | 'dn' | 'eq', string] => {
      if (k === 'good') return ['up', '▲']; if (k === 'bad' || k === 'rival' || k === 'urgent') return ['dn', '▼'];
      if (k === 'oath') return /broke|broken|did not/i.test(text) ? ['dn', '▼'] : ['up', '▲'];
      return ['eq', '◆'];
    };
    const moveList = (kind: 'renown' | 'favor', kinds: Herald['kind'][]) => {
      const exact = moves.filter(m => m.kind === kind && m.reason).slice(-3).reverse();
      const items: HTMLElement[] = exact.map(m => h('li', null, h('span', { class: 'ar ' + (m.amount > 0 ? 'up' : 'dn') }, m.amount > 0 ? '▲' : '▼'), h('span', null, `${signed(m.amount)}: ${m.reason}`), h('span', { class: 'ago' }, agoText(s.day - m.day))));
      for (const hd of recentH(kinds, 4 - Math.min(3, items.length))) {
        const [c, g] = arrowFor(hd.kind, hd.text);
        items.push(h('li', null, h('span', { class: 'ar ' + c }, g), h('span', null, hd.text), h('span', { class: 'ago' }, agoText(s.day - hd.day))));
      }
      return items.length ? h('ul', { class: 'ldg-moves' }, items) : h('p', { class: 'ldg-empty', style: 'padding:2px 0' }, 'Nothing of note lately.');
    };
    const rival = s.rival;
    const diff = s.renown - rival.renown;
    const tug = h('div', { class: 'ldg-stand' }, h('div', { class: 'hd' }, h('span', { class: 'nm' }, `Against ${rival.name}`)),
      h('div', { class: 'ldg-tug', title: `Your renown ${Math.round(s.renown)}, his ${Math.round(rival.renown)}` }, h('i', { style: { left: `${50 + Math.max(-48, Math.min(48, diff))}%` } })),
      h('div', { class: 'ldg-tug-l' }, h('span', null, `You, ${Math.round(s.renown)}`), h('span', null, `${rival.seat}, ${Math.round(rival.renown)}`)),
      h('p', { class: 'ldg-p ldg-small' }, diff >= 15 ? 'Your name outshines his. His tenants have begun to look over the hedge.' : diff >= 0 ? 'You lead, narrowly. He is aware of it.' : 'His name stands above yours. He may come for your unhappiest household.',
        rival.poached ? ` He has taken ${plural(rival.poached, 'household')} from you so far.` : ''));

    const st = s.stats;
    const tallies = h('div', { class: 'ldg-kv' }, ([
      ['Rent collected, all told', crowns(st.rentCollected)], ['Highest rent roll', crowns(st.peakRentRoll) + ' a month'], ['Households housed', num(st.tenantsHoused)],
      ['Evictions', num(st.evictions)], ['Oaths kept', num(st.oathsKept)], ['Oaths broken', num(st.oathsBroken)],
      ['Matters settled', num(st.incidentsResolved)], ['Matters left to run', num(st.incidentsIgnored)], ['Words spoken to the court', num(st.wordsSpoken)],
      ['Days in debt', num(st.daysInDebt)],
    ] as [string, string][]).flatMap(([k, v]) => [h('span', { class: 'k' }, k), h('span', { class: 'v' }, v)]));

    const d = dateOf(s.day);
    const yearsText = `${ordinal(d.year)} year of the reign`;
    return [band([
      heading('The Realm', `${s.realm.name}, ${RANKS[s.realm.rank].realm.toLowerCase()} of ${RANK_TITLES[s.realm.rank]} ${s.realm.ruler}. The ${yearsText}, under ${s.mode === 'iron' ? 'the Iron Crown' : 'the Steward’s Peace'}.`),
      h('div', { class: 'ldg-block' }, h2('Buildings', `${ready.length} standing, ${condWord(avgCond).toLowerCase()} on the whole`), census,
        h('p', { class: 'ldg-p ldg-small' }, `Land: ${owned} of ${s.map.parcels.length} parcels held; a ${RANK_TITLES[s.realm.rank]} may hold ${RANKS[s.realm.rank].maxParcels}.`)),
      h('div', { class: 'ldg-block' }, h2('Peoples', `${plural(people.length, 'household')}, ${plural(souls, 'soul')}`), people.length ? peoples : h('p', { class: 'ldg-empty' }, 'Nobody yet.')),
    ], [
      h('div', { class: 'ldg-block', style: 'margin-top:14px' }, h2('Contentment'),
        h('div', { class: 'ldg-stand' }, h('div', { class: 'hd' }, h('span', { class: 'nm' }, 'Average happiness'), h('span', { class: 'v' }, people.length ? String(Math.round(avgHap)) : 'nil')), meter(avgHap),
          h('p', { class: 'ldg-p ldg-small' }, people.length ? `${content} content, ${people.length - content - sour} middling, ${sour} sour.${sour ? ' The sour ones talk to the rival.' : ''}` : 'There is nobody to be unhappy yet.'))),
      h('div', { class: 'ldg-block' }, h2('Standing'),
        h('div', { class: 'ldg-stand' }, h('div', { class: 'hd' }, h('span', { class: 'nm' }, 'Renown'), h('span', { class: 'v' }, String(Math.round(s.renown)))), meter(s.renown, { kind: 'gold' }), h('span', { class: 'ldg-small' }, 'Your name among tenants. What is being said:'), moveList('renown', ['good', 'bad', 'oath', 'rival'])),
        h('div', { class: 'ldg-stand' }, h('div', { class: 'hd' }, h('span', { class: 'nm' }, 'Favour of the Crown'), h('span', { class: 'v ' + (s.favor < 25 ? 'ldg-bad' : '') }, String(Math.round(s.favor)))), meter(s.favor, { kind: s.favor < 25 ? 'bad' : 'gold' }), h('span', { class: 'ldg-small' }, s.mode === 'iron' ? 'At nothing, the charter is revoked and the reign ends. From the Crown, lately:' : 'At nothing, the charter is in danger. From the Crown, lately:'), moveList('favor', ['crown'])),
        tug),
      h('div', { class: 'ldg-block' }, h2('Lifetime tallies'), tallies),
    ])];
  }

  // ── render
  function render(): void {
    if (!isOpen) return;
    const s = ctx.state();
    const t = TABS.find(x => x.id === tab)!;
    const keepScroll = spread.scrollTop;
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.fk ?? null;
    used = new Set();
    let bands: HTMLElement[] = [];
    try {
      bands = tab === 'accounts' ? renderAccounts(s) : tab === 'households' ? renderHouseholds(s) : tab === 'orders' ? renderOrders(s)
        : tab === 'oaths' ? renderOaths(s) : tab === 'policies' ? renderPolicies(s) : renderRealm(s);
    } catch (err) {
      console.error('[ledger]', err);
      bands = [spanBand(h('p', { class: 'ldg-empty' }, 'This page is smudged. The clerk has been spoken to.'))];
    }
    // the margin doodle sits at the foot of the facing page, in its own room, never over the figures
    const dd = doodleEl(t.doodle, s.seed + TABS.indexOf(t), 76);
    clear(content);
    for (const b of bands) content.appendChild(b);
    if (dd) content.appendChild(h('div', { class: 'ldg-band ldg-foot', 'aria-hidden': 'true' }, h('div', { class: 'ldg-R' }, dd)));
    sweepPortraits();
    spread.scrollTop = keepScroll;
    if (focusKey) (content.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`) as HTMLElement | null)?.focus({ preventScroll: true });

    // frame
    const ti = TABS.indexOf(t);
    rh[0]!.textContent = s.realm.name;
    rh[1]!.textContent = `${t.title}, ${monthLabel(curMonthIdx(s))}`;
    folio[0]!.textContent = `fol. ${ti + 1}v`;
    folio[1]!.textContent = `fol. ${ti + 2}r`;
    for (const [id, b] of ribBtns) {
      const on = id === tab;
      b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      const badge = b.querySelector('.badge') as HTMLElement;
      let n = 0;
      if (id === 'households') n = housed(s).filter(x => x.lateStage !== 'none' && x.lateStage !== 'grace').length;
      if (id === 'oaths') n = s.oaths.filter(o => o.state === 'open' && o.dueDay - s.day <= 10).length;
      badge.hidden = n === 0; badge.textContent = String(n);
      badge.title = id === 'households' ? 'Households behind with the rent' : 'Oaths nearly due';
    }
    // on a narrow page the ribbons are a scrolling row: keep the open one in sight
    const onRib = ribBtns.get(tab);
    if (onRib && ribbons.scrollWidth > ribbons.clientWidth + 1) {
      const l = onRib.offsetLeft, r = l + onRib.offsetWidth;
      if (l < ribbons.scrollLeft) ribbons.scrollLeft = Math.max(0, l - 8);
      else if (r > ribbons.scrollLeft + ribbons.clientWidth) ribbons.scrollLeft = r - ribbons.clientWidth + 8;
    }
    lastSig = sig(s);
  }

  function sig(s: GameState): string {
    let ten = 0; for (const t of Object.values(s.tenants)) ten += (t.status === 'housed' ? 1 : 0) + t.arrears * 3 + t.happiness * 7 + STAGE_RANK[t.lateStage];
    return [Math.floor(s.day), Math.round(s.gold), s.orders.length, s.orders.reduce((a, o) => a + o.uses, 0), s.oaths.map(o => o.state[0]).join(''),
      JSON.stringify(s.policies), Math.round(ten), Object.keys(s.buildings).length, s.loans.length, s.ledger.txns.length, s.heralds.length, Math.round(s.renown), Math.round(s.favor)].join('|');
  }

  let resizeT: ReturnType<typeof setTimeout> | null = null;
  const onResize = () => { if (resizeT) clearTimeout(resizeT); resizeT = setTimeout(() => { if (isOpen) render(); }, 140); };

  return {
    el,
    pauses: true,
    open(arg?: unknown) {
      if (typeof arg === 'string') {
        const a = arg.toLowerCase();
        const t = (TABS.find(x => x.id === a)?.id) ?? TAB_ALIASES[a];
        if (t) { tab = t; lastTab = t; }
      }
      isOpen = true; el.hidden = false; confirmKey = null;
      spread.scrollTop = 0;
      render();
      addEventListener('resize', onResize);
      ctx.audio.sfx('page', { volume: 0.7 });
      requestAnimationFrame(() => { if (isOpen) { render(); ribBtns.get(tab)?.focus({ preventScroll: true }); } });
    },
    close() {
      isOpen = false; el.hidden = true; confirmKey = null;
      removeEventListener('resize', onResize);
      disposeAll();
    },
    update(state: GameState) {
      if (!isOpen) return;
      if (sig(state) !== lastSig) render();
    },
    handleEvents(events: SimEvent[], state: GameState) {
      for (const ev of events) {
        if (ev.type === 'renown' || ev.type === 'favor') {
          moves.push({ kind: ev.type, amount: ev.amount, reason: ev.reason ?? '', day: state.day });
          if (moves.length > 24) moves.splice(0, moves.length - 24);
        }
      }
    },
  };
}

