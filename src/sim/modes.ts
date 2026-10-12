/**
 * OWNER: sim-crown agent.
 * Pressure and failure: the Crown's tribute, the moneylender, interest, demotion
 * (Steward's Peace) and the end (Iron Crown), abdication, and the small meta
 * handlers (speed, hints seen, flags).
 *
 * How the money works
 *  - Tribute (`RANKS[rank].tribute`) falls due on the 1st of months 0, 3, 6, 9.
 *    Affordable: paid, favor +2. Not affordable: favor -12 and the moneylender
 *    settles it with the Crown, so it lands on your debt.
 *  - The coffers never stay below zero: once a day any shortfall becomes a loan.
 *    Up to the rank's cap he lends at `BAL.loan.ratePctMonth`; past it he still
 *    covers you, at the hard rate, and starts counting months.
 *  - Interest is charged on the 1st. If the coffers cannot meet it, it compounds.
 *  - Steward's Peace: three months running past the cap, or favor at zero, costs
 *    a rank (never below Reeve) and wipes the debt. The reign never ends unasked.
 *  - Iron Crown: debt past cap x `BAL.bankruptcyMult`, or favor at zero, ends it.
 *
 * This file also holds the small text helpers the four crown modules share
 * (`proclaim`, `numWord`, `crowns`, `spanText`), because it sits last in the order,
 * and what the app wants at the end of a reign (`reignRecord`, `heirloomOf`, `lastDemotion`).
 * At the start of the next one, `heirloomBoon` (called from `init`) pays an heir a
 * modest windfall for the heirloom handed down, once.
 */
import {
  DAYS_PER_MONTH, DAYS_PER_YEAR, MONTHS_PER_YEAR,
  type GameState, type SimModule, type ActionResult, type EndState, type Herald, type HeraldKind,
  type Id, type Loan, type Mode, type RankId, type Speed,
} from './types';
import { emit, herald, fill, hash01, dateOf, rulerTitle, fmtDate } from './core';
import { earn, spend, canAfford } from './economy';
import { changeFavor, changeRenown } from './renown';
import { householdCount } from './tenants';
import { countBuildings } from './buildings';
import { demote } from './rank';
import { BAL } from '../data/balance';
import { RANKS } from '../data/ranks';
import { RANK_TITLES } from '../data/ids';
import { NPC_DEFS } from '../data/characters';

export const TUNE = {
  /** favor for a tribute paid on the day / missed */
  tributePaidFavor: 2,
  tributeUnpaidFavor: -12,
  /** monthly pull of favor toward `favorRest`, from above and from below */
  favorRest: 50,
  favorDriftDown: 0.5,
  favorDriftUp: 1,
  /** rate the moneylender charges on anything past the rank's cap */
  hardRatePctMonth: 10,
  /** Steward's Peace: months running past the cap before the Crown steps in */
  overCapMonths: 3,
  /** favor and renown cost of a demotion; favor is then lifted to at least `favorAfterDemotion` */
  demotionFavor: -10,
  demotionRenown: -4,
  favorAfterDemotion: 25,
  /** a Reeve cannot be made less: the moneylender forecloses instead */
  foreclosureRenown: -10,
  foreclosureFavor: -10,
  creditShutDays: DAYS_PER_YEAR,
  /** least days between "he has covered more" heralds */
  coverHeraldGapDays: 15,
  /** interest paid on an unchanged debt is only worth a line this often */
  interestHeraldGapDays: 85,
  /** day of the month on which a tribute the coffers cannot meet is warned of */
  tributeWarnDom: 24,
  heraldCap: 150,
  /** an heir's boon: this share of the starting coffers, and never more than the cap */
  heirloomBoonShare: 0.25,
  heirloomBoonCap: 40,
  /** how far back in the feed a line's wording is remembered, so as not to repeat it */
  heraldRecall: 80,
} as const;

/** Keys this module keeps in `state.flags`. */
export const FLAGS = {
  overMonths: 'debt.overMonths',
  coverHeraldDay: 'debt.heraldDay',
  interestHeraldDay: 'debt.interestDay',
  interestHeraldSum: 'debt.interestSum',
  shutUntil: 'debt.shutUntil',
  tributesPaid: 'tribute.paid',
  tributesMissed: 'tribute.missed',
  demotionDay: 'demotion.day',
  demotionFrom: 'demotion.from',
  demotionTo: 'demotion.to',
  demotionCause: 'demotion.cause',
  demotionEpitaph: 'demotion.epitaph',
  demotionCount: 'demotion.count',
  heirloomRedeemed: 'heirloom.redeemed',
} as const;

const SPEEDS: readonly Speed[] = [0, 0.1, 1, 2, 4];
/** Flag keys the crown modules keep for themselves; `set_flag` will not write to them. */
const RESERVED_FLAGS = /^(?:oath|charter|rival|debt|tribute|demotion)\./;

// ───────────────────────────── shared text helpers ─────────────────────────────

const SMALL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** Whole number with thousands separators: 1240 → "1,240". Locale-free, so saves and tests agree. */
export function crowns(n: number): string {
  const v = Math.round(Math.abs(n));
  const body = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 && v > 0 ? '-' + body : body;
}
/** A sum with its unit: "1 crown", "1,240 crowns". */
export function crownsOf(n: number): string {
  return `${crowns(n)} ${Math.round(Math.abs(n)) === 1 ? 'crown' : 'crowns'}`;
}
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** Numbers under a hundred as words ("three", "thirty-six"), larger ones as figures ("1,240"). Zero is "no". */
export function numWord(n: number): string {
  const v = Math.round(n);
  if (v < 0 || v > 99) return crowns(v);
  if (v <= 20) return SMALL[v]!;
  return TENS[Math.floor(v / 10)]! + (v % 10 ? '-' + SMALL[v % 10]! : '');
}
export function capFirst(text: string): string { return text ? text.charAt(0).toUpperCase() + text.slice(1) : text; }
const plural = (n: number, one: string, many: string): string => (Math.round(n) === 1 ? one : many);

/** "two years and three months", "eleven months", "less than a month". */
export function spanText(days: number): string {
  const whole = Math.max(0, Math.floor(days));
  const years = Math.floor(whole / DAYS_PER_YEAR);
  const months = Math.floor((whole % DAYS_PER_YEAR) / DAYS_PER_MONTH);
  const y = years ? `${numWord(years)} ${plural(years, 'year', 'years')}` : '';
  const m = months ? `${numWord(months)} ${plural(months, 'month', 'months')}` : '';
  if (y && m) return `${y} and ${m}`;
  return y || m || 'less than a month';
}
const article = (word: string): string => (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;

/** The words that stand in for a character in a line: `{he}`, `{He}`, `{his}`, `{His}`, `{him}`. */
export interface Pronouns { he: string; He: string; his: string; His: string; him: string }
const HE: Pronouns = { he: 'he', He: 'He', his: 'his', His: 'His', him: 'him' };
const SHE: Pronouns = { he: 'she', He: 'She', his: 'her', His: 'Her', him: 'her' };
const HER_STYLES = /^(?:the\s+|old\s+)*(?:lady|dame|baroness|countess|duchess|marchioness|viscountess|queen|princess|empress|mistress|madam|madame|mother|widow|goodwife|goody|sister|abbess|prioress|granny|aunt|auntie|miss|mrs|ms)\b/i;
/**
 * How to speak of someone the sim knows only by a styled name ("Baroness Hale",
 * "Baron Aldous Vane"): "she" for Lady, Dame, Baroness and the like, or when a
 * line or two `about` them (a bio) says so; otherwise "he".
 */
export function pronounsFor(name: string, about = ''): Pronouns {
  if (HER_STYLES.test(name.trim())) return SHE;
  const count = (re: RegExp): number => (about.match(re) ?? []).length;
  return count(/\b(?:she|her|hers|herself)\b/gi) > count(/\b(?:he|him|his|himself)\b/gi) ? SHE : HE;
}

/** Last resort for a line no variant of which fits (very long names): keep whole sentences up to the cap. */
export function clipLine(text: string, cap: number = TUNE.heraldCap): string {
  if (text.length <= cap) return text;
  const sentences = text.split(/(?<=[.!?]["']?)\s+/);
  let out = '';
  for (const sentence of sentences) {
    const next = out ? out + ' ' + sentence : sentence;
    if (next.length > cap) break;
    out = next;
  }
  if (out) return out;
  const cut = text.slice(0, cap - 1);
  const space = cut.lastIndexOf(' ');
  return (space > cap * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '') + '.';
}

const signatures = new Map<string, string>();
/** The longest fixed stretch of a line's wording: enough to recognise it in the feed whatever names it carried. */
function signature(template: string): string {
  let sig = signatures.get(template);
  if (sig === undefined) {
    sig = template.split(/\{\w+\}/).reduce((a, b) => (b.trim().length > a.length ? b.trim() : a), '');
    signatures.set(template, sig);
  }
  return sig;
}

/**
 * Send one herald line chosen from `lines`, filled with `vars`. The variant used
 * least recently in the feed is preferred, so a recurring event (a tribute, the
 * rival's monthly mischief) does not repeat itself; ties fall to a stateless
 * hash, so flavour never disturbs the gameplay rng. A variant that would run
 * past the herald cap with the names in full is said with their short forms
 * (`vars.name_short` for `{name}`, and so on); one that still does not fit is
 * passed over for one that does.
 */
export function proclaim(
  s: GameState, kind: HeraldKind, lines: readonly string[], vars: Record<string, string | number | undefined> = {},
  refs: { buildingId?: Id; tenantId?: Id; incidentId?: Id; staffId?: Id } = {},
): Herald {
  const write = (l: string, v: Record<string, string | number | undefined>): string =>
    capFirst(fill(l, v).replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\b(1|[Oo]ne) crowns\b/g, '$1 crown'));
  let brief: Record<string, string | number | undefined> | null = null;
  for (const k of Object.keys(vars)) {
    if (!k.endsWith('_short') || vars[k] === undefined) continue;
    brief ??= { ...vars };
    brief[k.slice(0, -6)] = vars[k];
  }
  const texts = lines.map(l => {
    const full = write(l, vars);
    return full.length > TUNE.heraldCap && brief ? write(l, brief) : full;
  });
  const n = texts.length;
  const start = n ? Math.floor(hash01(s.nextId * 7919 + Math.floor(s.day * 4) * 31 + n) * n) : 0;
  const from = Math.max(0, s.heralds.length - TUNE.heraldRecall);
  let chosen = '';
  let bestAge = Infinity;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const text = texts[i]!;
    if (text.length > TUNE.heraldCap) continue;
    // where in the recent feed this wording was last heard (-1: not lately)
    const sig = signature(lines[i]!);
    let last = -1;
    if (sig.length >= 10) {
      for (let j = s.heralds.length - 1; j >= from; j--) if (s.heralds[j]!.text.includes(sig)) { last = j; break; }
    }
    if (last < bestAge) { bestAge = last; chosen = text; if (last < 0) break; }
  }
  if (!chosen) chosen = clipLine(texts.reduce((a, b) => (b.length < a.length ? b : a), texts[0] ?? ''));
  const clean: { buildingId?: Id; tenantId?: Id; incidentId?: Id; staffId?: Id } = {};
  if (refs.buildingId) clean.buildingId = refs.buildingId;
  if (refs.tenantId) clean.tenantId = refs.tenantId;
  if (refs.incidentId) clean.incidentId = refs.incidentId;
  if (refs.staffId) clean.staffId = refs.staffId;
  const h = herald(s, kind, chosen, clean);
  ear?.(h);
  return h;
}

let ear: ((h: Herald) => void) | null = null;
/** Test seam: hear every line the crown modules send through `proclaim` (pass null to stop). */
export function overhear(fn: ((h: Herald) => void) | null): void { ear = fn; }

const numFlag = (s: GameState, key: string): number => {
  const v = s.flags[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

/** How the feed names the moneylender: by name once the cast has one, else by trade. */
function lender(): string {
  const def = NPC_DEFS.moneylender;
  const name = (def?.name ?? '').trim();
  return name && !/^(the )?money.?lender$/i.test(name) ? name : 'the moneylender';
}
function lenderPronouns(): Pronouns {
  const def = NPC_DEFS.moneylender;
  return pronounsFor(lender() === 'the moneylender' ? '' : lender(), `${def?.bio ?? ''} ${def?.voice ?? ''}`);
}
function lenderVars(s: GameState, extra: Record<string, string | number> = {}): Record<string, string | number> {
  const who = lender();
  const v: Record<string, string | number> = {
    lender: who, Lender: capFirst(who), ...lenderPronouns(), title: rulerTitle(s), ruler: s.realm.ruler, realm: s.realm.name, ...extra,
  };
  // a long name gives way to his trade when a line would not otherwise fit
  if (who !== 'the moneylender') { v.lender_short = 'the moneylender'; v.Lender_short = 'The moneylender'; }
  return v;
}
/**
 * For the line that opens an account: his name and his trade together ("Ambrose
 * Wendle the moneylender"), so that a name new to the feed is not a stranger's.
 * Where that will not fit the line, the name alone.
 */
function introduced(v: Record<string, string | number>): Record<string, string | number> {
  const who = String(v.lender);
  if (who === 'the moneylender') return v;
  return { ...v, lender: `${who} the moneylender`, Lender: `${capFirst(who)} the moneylender`, lender_short: who, Lender_short: capFirst(who) };
}

// ───────────────────────────── debt ─────────────────────────────

/** Total owed to the moneylender. */
export function debtOf(s: GameState): number { return s.loans.reduce((a, l) => a + l.principal, 0); }
/** The most the moneylender will lend this rank before he starts counting months. */
export function loanCap(s: GameState): number { return BAL.loan.maxByRank[s.realm.rank]; }
/** What `take_loan` could still borrow today (0 when at the cap or when he is not lending). */
export function creditLeft(s: GameState): number {
  if (creditShut(s)) return 0;
  return Math.max(0, loanCap(s) - debtOf(s));
}
/** After a foreclosure he will cover shortfalls but will not lend on request for a year. */
export function creditShut(s: GameState): boolean { return numFlag(s, FLAGS.shutUntil) > s.day; }
/** Interest that will fall due on the next 1st, at today's debt. */
export function monthlyInterest(s: GameState): number {
  return s.loans.reduce((a, l) => a + interestOn(l), 0);
}
/** Iron Crown: the debt at which the reign ends. Infinity in Steward's Peace. */
export function bankruptcyLine(s: GameState): number {
  return s.mode === 'iron' ? Math.round(loanCap(s) * BAL.bankruptcyMult) : Infinity;
}
/** The next tribute: when it falls due and how much (amount 0 for a King, who pays no one). */
export function nextTribute(s: GameState): { day: number; amount: number } {
  let mi = Math.floor(Math.max(0, s.day) / DAYS_PER_MONTH) + 1;
  while (!isTributeMonth(mi)) mi++;
  return { day: mi * DAYS_PER_MONTH, amount: RANKS[s.realm.rank].tribute };
}
/**
 * The last demotion in Steward's Peace, shaped so the end-of-reign screen can show it.
 * (`GameState.ended` stays null: the reign goes on.) Null if there has been none.
 */
export function lastDemotion(s: GameState): { day: number; from: RankId; to: RankId; cause: 'debt' | 'favor'; epitaph: string } | null {
  const epitaph = s.flags[FLAGS.demotionEpitaph];
  const from = s.flags[FLAGS.demotionFrom];
  const to = s.flags[FLAGS.demotionTo];
  if (typeof epitaph !== 'string' || typeof from !== 'string' || typeof to !== 'string') return null;
  if (!(from in RANKS) || !(to in RANKS)) return null;
  return {
    day: numFlag(s, FLAGS.demotionDay), from: from as RankId, to: to as RankId,
    cause: s.flags[FLAGS.demotionCause] === 'favor' ? 'favor' : 'debt', epitaph,
  };
}

const isTributeMonth = (monthIndex: number): boolean =>
  (BAL.tributeMonths as readonly number[]).includes(((monthIndex % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR);

function interestOn(l: Loan): number {
  return l.principal > 0 ? Math.max(1, Math.ceil((l.principal * l.ratePctMonth) / 100)) : 0;
}

/** Add to the loan at this rate (one loan per rate, so the ledger stays readable). No gold moves. */
function addPrincipal(s: GameState, amount: number, ratePctMonth: number): void {
  if (amount <= 0) return;
  const loan = s.loans.find(l => l.ratePctMonth === ratePctMonth);
  if (loan) loan.principal += amount;
  else s.loans.push({ principal: amount, ratePctMonth, takenDay: s.day });
}

/** Borrow `amount`, the part under the cap at the ordinary rate and the rest at the hard rate. Returns the hard part. */
function borrow(s: GameState, amount: number, memo: string): number {
  const need = Math.ceil(amount);
  if (need <= 0) return 0;
  const room = Math.max(0, loanCap(s) - debtOf(s));
  const soft = Math.min(need, room);
  const hard = need - soft;
  addPrincipal(s, soft, BAL.loan.ratePctMonth);
  addPrincipal(s, hard, TUNE.hardRatePctMonth);
  earn(s, need, 'loan', memo);
  return hard;
}

/** Turn a negative balance into debt. The moneylender mentions it, though not every time. */
function coverShortfall(s: GameState): void {
  if (!(s.gold < 0)) return;
  const before = debtOf(s);
  const need = Math.ceil(-s.gold);
  const hard = borrow(s, need, 'Advanced by the moneylender');
  const debt = debtOf(s);
  const vars = lenderVars(s, { amount: crowns(need), debt: crowns(debt), rate: TUNE.hardRatePctMonth });
  const crossedCap = hard > 0 && before <= loanCap(s);
  const quiet = s.day - numFlag(s, FLAGS.coverHeraldDay) < TUNE.coverHeraldGapDays && s.flags[FLAGS.coverHeraldDay] !== undefined;
  if (before <= 0 && creditShut(s)) {
    // he said he would not lend, and is not lending: this is something else, at the same interest
    proclaim(s, 'bad', [
      '{Lender} is not lending to you. {He} has, however, mislaid {amount} crowns in your coffers, and made a note of where.',
      'The coffers ran dry again. {Lender} will not call it a loan. {He} calls the {amount} crowns "a courtesy". It bears interest.',
    ], introduced(vars));
  } else if (before <= 0) {
    proclaim(s, 'bad', [
      'The coffers ran dry, so {lender} has quietly made up the {amount} crowns. "No need to thank me," {he} says. "Not yet."',
      'The coffers are empty. {Lender} has covered {amount} crowns unasked. "We are friends now," {he} explains, softly.',
    ], introduced(vars));
  } else if (crossedCap) {
    proclaim(s, 'urgent', [
      '{Lender} has covered {amount} crowns, which is past what {he} lends a {title}. "At {rate} in the hundred," {he} says. "For my nerves."',
      'You now owe {debt} crowns, more than {lender} lends a {title}. {He} has started a fresh page, in smaller handwriting.',
    ], vars);
  } else if (!quiet) {
    proclaim(s, 'bad', [
      '{Lender} has covered a further {amount} crowns. You owe {him} {debt}. {He} asks after your health, in some detail.',
      'Another {amount} crowns from {lender}. The sum stands at {debt}. "Take all the time you need," {he} says. "I do."',
    ], vars);
  } else {
    return;
  }
  s.flags[FLAGS.coverHeraldDay] = s.day;
}

/** The page is closed: forget what was last said about the interest, so a new debt is news again. */
function closeAccount(s: GameState): void {
  delete s.flags[FLAGS.interestHeraldDay];
  delete s.flags[FLAGS.interestHeraldSum];
}

/** Pay down what is owed, dearest loan first. No gold moves here. */
function reducePrincipal(s: GameState, amount: number): void {
  let left = amount;
  const byRate = [...s.loans].sort((a, b) => b.ratePctMonth - a.ratePctMonth);
  for (const l of byRate) {
    const pay = Math.min(l.principal, left);
    l.principal -= pay; left -= pay;
    if (left <= 0) break;
  }
  s.loans = s.loans.filter(l => l.principal > 0);
}

// ───────────────────────────── tribute, interest, favor ─────────────────────────────

function collectTribute(s: GameState): void {
  const amount = RANKS[s.realm.rank].tribute;
  if (amount <= 0) return;
  const vars = lenderVars(s, { amount: crowns(amount) });
  if (canAfford(s, amount)) {
    spend(s, amount, 'tribute', 'Quarterly tribute to the Crown');
    s.flags[FLAGS.tributesPaid] = numFlag(s, FLAGS.tributesPaid) + 1;
    changeFavor(s, TUNE.tributePaidFavor, 'tribute paid');
    emit(s, { type: 'tribute', amount, paid: true });
    proclaim(s, 'crown', [
      'The quarterly tribute of {amount} crowns has gone to the Crown. A receipt came back. It is very small and very official.',
      'The Crown\'s cart took {amount} crowns in tribute and left a receipt, a wheel rut, and no thanks.',
      'Tribute paid: {amount} crowns. The tax clerk counted it three times and seemed sorry to find it all there.',
      'The tribute went to the Crown on the day: {amount} crowns. The Crown did not write to say thank you. It never does.',
      'The tax cart came, was given {amount} crowns of tribute, and left. It is the most agreeable thing it does.',
    ], vars);
    return;
  }
  // Unpaid: the Crown is displeased, and the moneylender settles it so that you owe him instead.
  s.flags[FLAGS.tributesMissed] = numFlag(s, FLAGS.tributesMissed) + 1;
  changeFavor(s, TUNE.tributeUnpaidFavor, 'tribute unpaid');
  emit(s, { type: 'tribute', amount, paid: false });
  proclaim(s, 'urgent', [
    'The tribute of {amount} crowns fell due and the coffers could not meet it. The Crown has written the date down.',
    'The Crown\'s cart came for {amount} crowns and left empty. The driver said nothing, in a way that will be reported.',
  ], vars);
  const owedBefore = debtOf(s);
  const room = Math.max(0, loanCap(s) - owedBefore);
  addPrincipal(s, Math.min(amount, room), BAL.loan.ratePctMonth);
  addPrincipal(s, amount - Math.min(amount, room), TUNE.hardRatePctMonth);
  earn(s, amount, 'loan', 'Tribute settled by the moneylender');
  spend(s, amount, 'tribute', 'Quarterly tribute to the Crown, paid late');
  proclaim(s, 'bad', [
    '{Lender} has settled the tribute on your behalf. "A small thing between friends," {he} says, and opens a new page.',
    'The tribute is paid after all, by {lender}. You owe {him} {debt} crowns now. {He} seems pleased for you both.',
  ], owedBefore <= 0
    ? introduced(lenderVars(s, { amount: crowns(amount), debt: crowns(debtOf(s)) }))
    : lenderVars(s, { amount: crowns(amount), debt: crowns(debtOf(s)) }));
  s.flags[FLAGS.coverHeraldDay] = s.day;
}

function warnOfTribute(s: GameState, day: number): void {
  const d = dateOf(day);
  if (d.dom !== TUNE.tributeWarnDom || !isTributeMonth(d.monthIndex + 1)) return;
  const amount = RANKS[s.realm.rank].tribute;
  if (amount <= 0 || canAfford(s, amount)) return;
  proclaim(s, 'crown', [
    'The tribute of {amount} crowns falls due on the 1st. The coffers hold {gold}. The Crown does not take apologies as coin.',
    'A reminder from the Crown: {amount} crowns of tribute on the 1st. The coffers hold {gold}, and a moth.',
  ], { amount: crowns(amount), gold: crowns(Math.max(0, Math.floor(s.gold))) });
}

function chargeInterest(s: GameState): void {
  const due = monthlyInterest(s);
  if (due <= 0) return;
  if (canAfford(s, due)) {
    spend(s, due, 'interest', 'Interest to the moneylender');
    // a standing debt is not news every month: he is heard from when the sum changes, and otherwise once a quarter
    const told = s.flags[FLAGS.interestHeraldDay];
    if (typeof told === 'number' && numFlag(s, FLAGS.interestHeraldSum) === due && s.day - told < TUNE.interestHeraldGapDays) return;
    s.flags[FLAGS.interestHeraldDay] = s.day;
    s.flags[FLAGS.interestHeraldSum] = due;
    proclaim(s, 'info', [
      'Interest of {amount} crowns went to {lender}. {He} sends {his} regards, and a note of what remains: {debt}.',
      '{Lender} collected {amount} crowns of interest in person. {He} admired the hall. {He} admired it carefully.',
      '{Amount} crowns of interest paid. {Lender} says you are {his} favourite, and that {he} says this to no one else this week.',
      'The month\'s interest, {amount} crowns, is paid. {Lender} wrote the receipt and blew on the ink for a long time.',
      '{Lender} called for {his} {amount} crowns of interest and stayed to count the chairs. {debt} crowns are still owing.',
    ], lenderVars(s, { amount: crowns(due), Amount: capFirst(numWord(due)), debt: crowns(debtOf(s)) }));
    return;
  }
  // It compounds, each loan at its own rate. Booked as borrowed and spent so the ledger stays honest.
  for (const l of s.loans) l.principal += interestOn(l);
  earn(s, due, 'loan', 'Interest added to the debt');
  spend(s, due, 'interest', 'Interest to the moneylender, unpaid');
  proclaim(s, 'bad', [
    'The interest of {amount} crowns went unpaid, so {lender} added it to the sum. "Think nothing of it. I shall think of it for us both."',
    'No coin for the interest. {Lender} has folded {amount} crowns into the debt, now {debt}. {He} was very understanding. Too understanding.',
    'The interest was not met. You owe {debt} crowns. {Lender} was understanding about it, which was the alarming part.',
  ], lenderVars(s, { amount: crowns(due), debt: crowns(debtOf(s)) }));
}

function driftFavor(s: GameState): void {
  const gap = s.favor - TUNE.favorRest;
  if (gap > 0) changeFavor(s, -Math.min(gap, TUNE.favorDriftDown), 'drift');
  else if (gap < 0) changeFavor(s, Math.min(-gap, TUNE.favorDriftUp), 'drift');
}

// ───────────────────────────── epitaphs ─────────────────────────────

type Cause = EndState['reason'] | 'demoted_debt' | 'demoted_favor';

/**
 * Two or three dry sentences on how it went, built from the record: rank, how long,
 * who was housed and who was put out, oaths, and the cause.
 */
export function writeEpitaph(s: GameState, cause: Cause, ctx: { from?: RankId; to?: RankId; debt?: number } = {}): string {
  const from = ctx.from ?? s.realm.rank;
  const title = RANK_TITLES[from];
  const who = `${title} ${s.realm.ruler}`;
  const realm = s.realm.name || 'the realm';
  const span = spanText(s.day);
  const debt = Math.round(ctx.debt ?? debtOf(s));
  const missed = numFlag(s, FLAGS.tributesMissed);
  const st = s.stats;
  const here = householdCount(s);
  const housed = Math.max(st.tenantsHoused, here);

  let opener: string;
  switch (cause) {
    case 'bankrupt':
      opener = `${who} of ${realm} ruled ${span} and was undone by arithmetic, owing the moneylender ${crownsOf(debt)}.`;
      break;
    case 'charter_revoked':
      opener = missed > 0
        ? `The Crown withdrew the charter of ${realm} from ${who} after ${span}. The tribute went unpaid ${numWord(missed)} ${plural(missed, 'time', 'times')}, and the Crown can count.`
        : `The Crown withdrew the charter of ${realm} from ${who} after ${span}, its favour having run out before its paperwork did.`;
      break;
    case 'abdicated':
      opener = debt > 0
        ? `${who} laid down the charter of ${realm} after ${span} and left by the gate, owing ${crownsOf(debt)}. The moneylender waved, at length.`
        : `${who} laid down the charter of ${realm} after ${span} and left by the gate, owing nothing to anyone.`;
      break;
    case 'demoted_debt':
      opener = `After ${span}, ${who} of ${realm} is ${article(RANK_TITLES[ctx.to ?? 'reeve'])} again. The moneylender forgave ${crownsOf(debt)} and kept the receipt.`;
      break;
    default:
      opener = `After ${span}, the Crown has made ${who} of ${realm} ${article(RANK_TITLES[ctx.to ?? 'reeve'])} again, having run out of other ways to express itself.`;
  }

  const ended = cause === 'bankrupt' || cause === 'charter_revoked' || cause === 'abdicated';
  let tally: string;
  if (housed <= 0) {
    tally = 'No household was ever housed, which is a record of a kind.';
  } else {
    const h = `${capFirst(numWord(housed))} ${plural(housed, 'household was', 'households were')} housed in that time`;
    const out = st.evictions <= 0 ? 'not one was put out' : `${numWord(st.evictions)} ${plural(st.evictions, 'was', 'were')} put out`;
    // a reign that goes on still has its tenants to face
    const still = !ended && here > 0 && here < housed ? ` ${capFirst(numWord(here))} ${plural(here, 'remains', 'remain')}.` : '';
    tally = `${h} and ${out}.${still}`;
  }

  let closer: string;
  if (st.oathsBroken >= 3) {
    closer = `${capFirst(numWord(st.oathsBroken))} oaths were broken, and the well kept count.`;
  } else if (st.evictions >= 5) {
    closer = 'The Bailiff carried out a great many beds. The beds are remembered.';
  } else if (st.oathsKept >= 5 && st.oathsBroken === 0) {
    closer = cause === 'bankrupt'
      ? `Every oath was kept, all ${numWord(st.oathsKept)} of them. The moneylender found this beside the point.`
      : `Every oath was kept, all ${numWord(st.oathsKept)} of them. It is the part worth carving.`;
  } else if (st.oathsBroken > 0) {
    closer = `${capFirst(numWord(st.oathsBroken))} ${plural(st.oathsBroken, 'oath was', 'oaths were')} broken. It is the part people mention.`;
  } else if (s.renown >= 70) {
    closer = 'The tenants were sorry about it and said so, which tenants rarely do.';
  } else if (s.renown <= 30) {
    closer = 'The tenants took the news calmly. Several took it with cake.';
  } else if (st.rentCollected > 0) {
    closer = st.rentCollected === 1
      ? 'In all, one crown of rent was collected. It was on time.'
      : `In all, ${crowns(st.rentCollected)} crowns of rent were collected, most of them on time.`;
  } else {
    closer = 'The rent, on the whole, was collected.';
  }
  return `${opener} ${tally} ${closer}`.replace(/\s{2,}/g, ' ').trim();
}

/**
 * The one thing that passes to the heir (Iron Crown), chosen by what the reign
 * was known for. A noun phrase with no full stop, ready to follow "Heirloom:".
 */
export function heirloomOf(s: GameState): string {
  const st = s.stats;
  if (st.oathsKept >= 5 && st.oathsBroken === 0) return 'the Ledger of Oaths, every page of it kept';
  if (st.oathsBroken >= 3) return 'the Ledger of Oaths, heavily underlined';
  if (st.evictions >= 5) return 'the Bailiff\'s second-best crowbar';
  if (countBuildings(s, 'statue') > 0) return 'the head of a statue of your predecessor';
  if (s.renown >= 70) return 'a seed cake, left at the gate by the tenants';
  switch (s.ended?.reason) {
    case 'bankrupt': return 'a coffer with an excellent lock and nothing in it';
    case 'charter_revoked': return 'the ribbon from the charter, the Crown having kept the rest';
    case 'abdicated': return 'the keys to the seat, on a piece of string';
    default: return 'a rent ledger, mostly balanced';
  }
}

/**
 * What the Dynasty Hall records of this reign. The app adds the date it was
 * written down; everything else is read from the state as it stands.
 */
export function reignRecord(s: GameState): {
  ruler: string; realm: string; rank: RankId; mode: Mode; years: number; households: number; peakRentRoll: number;
  epitaph: string; heirloom: string;
} {
  return {
    ruler: s.realm.ruler, realm: s.realm.name, rank: s.realm.rank, mode: s.mode,
    years: Math.round(((s.ended?.day ?? s.day) / DAYS_PER_YEAR) * 10) / 10,
    households: Math.max(st0(s.stats.tenantsHoused), householdCount(s)),
    peakRentRoll: Math.round(st0(s.stats.peakRentRoll)),
    epitaph: s.ended?.epitaph ?? writeEpitaph(s, 'abdicated'),
    heirloom: heirloomOf(s),
  };
}
const st0 = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * The heir's starting boon (a reign after the first, with an heirloom handed
 * down): a modest sum into the coffers and one line in the feed. Called once at
 * the start of a reign; it marks the state so that it can never pay twice.
 * Returns the crowns paid (0 when there is nothing to pay or it is already paid).
 */
export function heirloomBoon(s: GameState): number {
  const heirloom = (s.realm.heirloom ?? '').trim().replace(/[.\s]+$/, '').slice(0, 80);
  if (!heirloom || !(s.realm.reign > 1) || s.ended) return 0;
  if (s.flags[FLAGS.heirloomRedeemed] !== undefined) return 0;
  const amount = Math.max(1, Math.min(TUNE.heirloomBoonCap, Math.round(BAL.startGold * TUNE.heirloomBoonShare)));
  s.flags[FLAGS.heirloomRedeemed] = amount;
  earn(s, amount, 'windfall', 'An heirloom, pawned and redeemed');
  const brief = heirloom.split(',')[0]!.trim();
  proclaim(s, 'good', [
    'Handed down: {heirloom}. Pawned for {amount} crowns and redeemed the same week. Nobody will say by whom.',
    'You inherit {heirloom}. It was pawned once, for {amount} crowns, and came home anyway. The crowns stayed.',
  ], { heirloom, heirloom_short: brief && brief !== heirloom ? brief : undefined, amount: crowns(amount) });
  return amount;
}

// ───────────────────────────── demotion and the end ─────────────────────────────

function endReign(s: GameState, reason: EndState['reason']): void {
  if (s.ended) return;
  const epitaph = writeEpitaph(s, reason);
  s.ended = { reason, day: s.day, epitaph };
  const vars = lenderVars(s);
  if (reason === 'bankrupt') {
    proclaim(s, 'urgent', [
      '{Lender} has called in the debt. The charter of {realm} passes to {him}, then to the Crown, then to somebody else.',
    ], vars);
  } else if (reason === 'charter_revoked') {
    proclaim(s, 'crown', [
      'The Crown has withdrawn the charter of {realm}. The herald read it out twice, in case anyone enjoyed it the first time.',
    ], vars);
  } else {
    proclaim(s, 'crown', [
      '{title} {ruler} has laid down the charter of {realm} and walked out by the gate. The geese saw it and will not be discreet.',
    ], vars);
  }
  emit(s, { type: 'sfx', id: 'gavel' });
  emit(s, { type: 'game_over', reason });
}

/** Steward's Peace: down a rank, debts wiped, a written account of it. At Reeve the moneylender forecloses instead. */
function reduceRank(s: GameState, cause: 'debt' | 'favor'): void {
  const from = s.realm.rank;
  const debt = debtOf(s);
  const vars = lenderVars(s, { old: RANK_TITLES[from], debt: crowns(debt) });
  s.flags[FLAGS.overMonths] = 0;

  if (from === 'reeve') {
    if (cause === 'debt') {
      s.loans = [];
      closeAccount(s);
      s.flags[FLAGS.shutUntil] = s.day + TUNE.creditShutDays;
      changeRenown(s, TUNE.foreclosureRenown, 'foreclosure');
      changeFavor(s, TUNE.foreclosureFavor, 'foreclosure');
      proclaim(s, 'urgent', [
        'A Reeve cannot be made less. {Lender} has taken the table, the good candlesticks and a year of your credit, and called it square.',
        '{Lender} has forgiven the debt and taken the furniture. {He} will not lend again this year. The hamlet watched {him} load the cart.',
      ], vars);
      emit(s, { type: 'sfx', id: 'gavel' });
    } else {
      changeRenown(s, TUNE.demotionRenown, 'crown displeased');
      proclaim(s, 'crown', [
        'The Crown cannot demote a Reeve, so it has sent a long letter instead. The gist is disappointment. So is the rest.',
      ], vars);
    }
    if (s.favor < TUNE.favorAfterDemotion) changeFavor(s, TUNE.favorAfterDemotion - s.favor, 'a fresh start');
    return;
  }

  const to = demote(s);
  if (!to) return;
  const epitaph = writeEpitaph(s, cause === 'debt' ? 'demoted_debt' : 'demoted_favor', { from, to, debt });
  s.loans = [];
  closeAccount(s);
  changeRenown(s, TUNE.demotionRenown, 'demotion');
  if (cause === 'debt') changeFavor(s, TUNE.demotionFavor, 'demotion');
  if (s.favor < TUNE.favorAfterDemotion) changeFavor(s, TUNE.favorAfterDemotion - s.favor, 'a fresh start');
  s.flags[FLAGS.demotionDay] = s.day;
  s.flags[FLAGS.demotionFrom] = from;
  s.flags[FLAGS.demotionTo] = to;
  s.flags[FLAGS.demotionCause] = cause;
  s.flags[FLAGS.demotionEpitaph] = epitaph;
  s.flags[FLAGS.demotionCount] = numFlag(s, FLAGS.demotionCount) + 1;
  const v = { ...vars, new: RANK_TITLES[to] };
  if (cause === 'debt') {
    proclaim(s, 'crown', [
      'By order of the Crown, {old} {ruler} is {new} once more. {Lender} has torn up the debt, slowly, so that you could watch.',
      '{old} {ruler} is {new} again, by proclamation. The debt of {debt} crowns is struck out. So is a good deal else.',
    ], v);
  } else {
    proclaim(s, 'crown', [
      'The Crown\'s patience is spent. {old} {ruler} is {new} once more, by a proclamation notable for its brevity.',
    ], v);
  }
  emit(s, { type: 'sfx', id: 'gavel' });
  emit(s, { type: 'demotion', rank: to });
}

/** Monthly: is the debt past the cap, and for how long? Peace counts to demotion; Iron only warns (the end is checked daily). */
function judgeDebt(s: GameState): void {
  const debt = debtOf(s);
  const cap = loanCap(s);
  if (debt <= cap) { if (numFlag(s, FLAGS.overMonths) !== 0) s.flags[FLAGS.overMonths] = 0; return; }
  const months = numFlag(s, FLAGS.overMonths) + 1;
  s.flags[FLAGS.overMonths] = months;
  const vars = lenderVars(s, { debt: crowns(debt), cap: crowns(cap), limit: crowns(bankruptcyLine(s)) });
  if (s.mode === 'iron') {
    if (debt > bankruptcyLine(s)) return;                // past warning: the end is judged next
    proclaim(s, 'urgent', [
      'You owe {debt} crowns. {Lender} has begun to look at your furniture the way a heron looks at a pond.',
      '"There is a figure past which I stop being patient," says {lender}. "It is {limit}. You are at {debt}. I say it as a friend."',
    ], vars);
    return;
  }
  if (months >= TUNE.overCapMonths) { reduceRank(s, 'debt'); return; }
  // He says what happens next, so that it is the ruler's choice and not a surprise.
  const reeve = s.realm.rank === 'reeve';
  const left = TUNE.overCapMonths - months;
  if (months === 1) {
    proclaim(s, 'urgent', reeve ? [
      '"{debt} crowns is more than I lend a {title}," says {lender}, gently. "Shall we say {span}. Then I send a cart for the furniture."',
    ] : [
      '"{debt} crowns is more than I lend a {title}," says {lender}, gently. "Shall we say {span}. After that the Crown hears of it."',
    ], { ...vars, span: `${numWord(left + 1)} months` });
  } else if (reeve) {
    proclaim(s, 'urgent', [
      '{Lender} has brought {his} own chair to your hall, sat in it, and looked at yours. "{Left} more," {he} says.',
      '"{debt} crowns, and {left} left," says {lender}. "I have measured your table for the cart. It will fit. I am so glad."',
    ], { ...vars, left: left === 1 ? 'one month' : `${numWord(left)} months`, Left: left === 1 ? 'One month' : `${capFirst(numWord(left))} months` });
  } else {
    proclaim(s, 'urgent', [
      '{Lender} has brought {his} own chair to your hall. "{Left} more," {he} says. "Then the Crown pays me, and takes it out of your title."',
      '"{debt} crowns, and {left} left," says {lender}. "Then the Crown settles with me and takes a rank from you. I shall miss our talks."',
    ], { ...vars, left: left === 1 ? 'one month' : `${numWord(left)} months`, Left: left === 1 ? 'One month' : `${capFirst(numWord(left))} months` });
  }
}

function judgeDaily(s: GameState): void {
  if (s.ended) return;
  if (s.mode === 'iron') {
    if (s.favor <= 0) endReign(s, 'charter_revoked');
    else if (debtOf(s) > bankruptcyLine(s)) endReign(s, 'bankrupt');
  } else if (s.favor <= 0) {
    reduceRank(s, 'favor');
  }
}

// ───────────────────────────── handlers ─────────────────────────────

const refuse = (code: Extract<ActionResult, { ok: false }>['code'], reason: string): ActionResult => ({ ok: false, code, reason });
const wholeAmount = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0);

export const modesModule: SimModule = {
  name: 'modes',

  init(s) {
    heirloomBoon(s);                        // last in module order: the coffers are open and the proclamation read
  },

  onDay(s, day) {
    if (s.ended) return;
    coverShortfall(s);
    if (debtOf(s) > 0) s.stats.daysInDebt += 1;
    warnOfTribute(s, day);
    judgeDaily(s);
  },

  onMonth(s, monthIndex) {
    if (s.ended) return;
    chargeInterest(s);                      // on what was owed through the month just gone
    if (isTributeMonth(monthIndex)) collectTribute(s);
    coverShortfall(s);
    judgeDebt(s);
    driftFavor(s);
    judgeDaily(s);
  },

  handlers: {
    take_loan(s, a) {
      const amount = wholeAmount(a.amount);
      if (amount <= 0) return refuse('invalid', `Name a sum in whole crowns, ${rulerTitle(s)}.`);
      if (creditShut(s)) {
        return refuse('blocked', `${capFirst(lender())} is not lending to you until the ${fmtDate(numFlag(s, FLAGS.shutUntil))}. ${lenderPronouns().He} says it is nothing personal, and means that it is.`);
      }
      const room = creditLeft(s);
      if (amount > room) {
        return refuse('blocked', room > 0
          ? `${capFirst(lender())} will lend ${article(rulerTitle(s))} ${crownsOf(room)} more and not a crown beyond. ${lenderPronouns().He} says it kindly.`
          : `${capFirst(lender())} will go no higher than ${crowns(loanCap(s))} crowns for ${article(rulerTitle(s))}. ${lenderPronouns().He} says it very kindly.`);
      }
      const fresh = debtOf(s) <= 0;
      addPrincipal(s, amount, BAL.loan.ratePctMonth);
      earn(s, amount, 'loan', 'Borrowed from the moneylender');
      emit(s, { type: 'sfx', id: 'coins' });
      proclaim(s, 'info', [
        '{Lender} counts out {amount} crowns. "{rate} in the hundred, monthly," {he} says. "There is no hurry. There is never any hurry."',
        '{Lender} lends you {amount} crowns and writes it down twice. "Once for the ledger," {he} says, "and once for me."',
      ], fresh
        ? introduced(lenderVars(s, { amount: crowns(amount), rate: capFirst(numWord(BAL.loan.ratePctMonth)) }))
        : lenderVars(s, { amount: crowns(amount), rate: capFirst(numWord(BAL.loan.ratePctMonth)) }));
      return { ok: true };
    },

    repay_loan(s, a) {
      const asked = wholeAmount(a.amount);
      if (asked <= 0) return refuse('invalid', `Name a sum in whole crowns, ${rulerTitle(s)}.`);
      const debt = debtOf(s);
      if (debt <= 0) return refuse('invalid', `You owe ${lender()} nothing. ${lenderPronouns().He} seems a little sad about it.`);
      const amount = Math.min(asked, Math.ceil(debt));
      if (!canAfford(s, amount)) {
        return refuse('no_gold', `The coffers hold but ${crownsOf(Math.max(0, Math.floor(s.gold)))}, ${rulerTitle(s)}.`);
      }
      spend(s, amount, 'loan_repaid', 'Repaid to the moneylender');
      reducePrincipal(s, amount);
      const left = debtOf(s);
      if (left <= loanCap(s) && numFlag(s, FLAGS.overMonths) !== 0) s.flags[FLAGS.overMonths] = 0;
      if (left <= 0) {
        closeAccount(s);
        proclaim(s, 'good', [
          'The debt is paid in full. {Lender} shakes your hand for slightly too long and says {his} door is always open.',
          'You owe {lender} nothing. {He} has closed the page with great care, and left a ribbon in it.',
        ], lenderVars(s));
      } else {
        proclaim(s, 'info', [
          '{Lender} accepts {amount} crowns and crosses out a number. {debt} remain. {He} hopes you are sleeping well.',
          '{Amount} crowns repaid, {debt} still owing. {Lender} thanks you, and remarks that it is a start.',
        ], lenderVars(s, { amount: crowns(amount), Amount: capFirst(numWord(amount)), debt: crowns(left) }));
      }
      return { ok: true };
    },

    abdicate(s) {
      if (s.ended) return refuse('ended', 'The reign is over.');
      endReign(s, 'abdicated');
      return { ok: true };
    },

    set_speed(s, a) {
      if (!SPEEDS.includes(a.speed)) return refuse('invalid', 'Time does not run at that pace.');
      s.speed = a.speed;
      return { ok: true };
    },

    mark_seen(s, a) {
      if (typeof a.key !== 'string' || !a.key || a.key.length > 80) return refuse('invalid', 'That is not a thing one can have seen.');
      s.seen[a.key] = true;
      return { ok: true };
    },

    set_flag(s, a) {
      if (typeof a.key !== 'string' || !a.key || a.key.length > 80) return refuse('invalid', 'The clerk cannot file that.');
      // the engine's own books (debts, charters, oaths, the rival) are not to be written in from outside
      if (RESERVED_FLAGS.test(a.key)) return refuse('blocked', 'That page is kept by the Crown\'s clerk, and by no one else.');
      const v = a.value;
      const ok = typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 400);
      if (!ok) return refuse('invalid', 'The clerk cannot file that.');
      s.flags[a.key] = v;
      return { ok: true };
    },
  },
};
