/**
 * From a model's reply (or the offline parser's reading) to an Exchange.
 *
 * Parse tolerantly, validate every proposed Action against the types and the
 * state, hold the weighty ones for the ruler's "aye", dispatch the rest
 * through the sim, and voice any refusal in the speaker's own manner.
 *
 * The model is never trusted: unknown kinds are dropped, ids must exist,
 * numbers are coerced and bounded, and what is weighty is decided here.
 */
import {
  DECISION_OPTIONS, STAFF_ROLES,
  type Action, type ActionResult, type GameState, type StaffRole, type Condition, type CondField, type CondOp,
  type DecisionType, type DecisionOption, type OathKind, type Policies, type StandingOrder, type Oath, type JobKind, type Id, type Incident,
} from '../sim/types';
import { INCIDENT_BY_ID, BUILDINGS, BUILDING_TYPES, SPECIES, TRADES, TRAITS, TENANT_TAGS, MONTH_NAMES } from '../data';
import type { BuildingType } from '../data/ids';
import type { Exchange, Mood, Speaker, SpeakTarget, WordDeps } from './api';
import type { ModelErrorCode } from './model';
import { SPOKEN_ACTIONS, SPOKEN_JOBS } from './prompts';
import {
  parseOffline, weigh, describeAction, domainRole, orderGist, readBack, grumbleOf, resolveRef, defaultDue, defOf, openIncidents,
  staffByRole, titleOf, tidy, clip, mid, pickStable, DECISION_ROLE,
} from './offline';

// ───────────────────────── reading the reply ─────────────────────────

export interface RawReply { speaker: string; reply: string; mood: string; understood: boolean; actions: unknown[]; confirm: boolean }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** A lookup table with no inherited keys: "constructor" and "__proto__" are words a model may write. */
const dict = <T>(o: Record<string, T>): Record<string, T> => Object.assign(Object.create(null) as Record<string, T>, o);
const owns = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const tryJson = (t: string): unknown => { try { return JSON.parse(t); } catch { return undefined; } };

/** Which quotes may close a string opened by each kind of quote (models mix straight and curly). */
const CLOSERS = dict<string>({ '"': '"”', "'": "'’", '“': '”"', '‘': "’'", '`': '`' });
const BARE = dict<string>({ true: 'true', false: 'false', null: 'null', none: 'null', undefined: 'null', nan: 'null' });

/**
 * Rewrite almost-JSON as JSON: single, curly or unescaped quotes, unquoted
 * keys and bare words, Python's True/False/None, comments, trailing commas,
 * line breaks inside strings, a string left open at the end. What a smaller
 * model writes when it means JSON.
 */
export function loosen(t: string): string {
  const n = t.length;
  let out = '';
  /** after a closing quote, well-formed JSON has only , : } ] or the end */
  const closes = (i: number): boolean => { let j = i; while (j < n && /\s/.test(t[j]!)) j++; return j >= n || ',:}]'.includes(t[j]!); };
  const nextIs = (i: number, chars: string): boolean => { let j = i; while (j < n && /\s/.test(t[j]!)) j++; return j < n && chars.includes(t[j]!); };
  for (let i = 0; i < n;) {
    const ch = t[i]!, closers = CLOSERS[ch];
    if (closers) {
      let j = i + 1, body = '';
      for (; j < n; j++) {
        const c = t[j]!;
        if (c === '\\') {
          const nx = t[j + 1];
          if (nx === "'") { body += "'"; j++; } else if (nx !== undefined && '"\\/bfnrtu'.includes(nx)) { body += c + nx; j++; } else body += '\\\\';
          continue;
        }
        if (closers.includes(c) && closes(j + 1)) break;
        body += c === '"' ? '\\"' : c === '\n' || c === '\r' || c === '\t' ? ' ' : c < ' ' ? '' : c;
      }
      out += `"${body}"`; i = j + 1; continue;
    }
    if (ch === '/' && t[i + 1] === '/') { while (i < n && t[i] !== '\n') i++; continue; }
    if (ch === '/' && t[i + 1] === '*') { const e = t.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(t[i + 1] ?? ''))) {
      const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(t.slice(i, i + 40))!;
      out += m[0]; i += m[0].length; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1; while (j < n && /[\w$.]/.test(t[j]!)) j++;
      const word = t.slice(i, j);
      out += nextIs(j, ':') ? JSON.stringify(word) : BARE[word.toLowerCase()] ?? JSON.stringify(word);
      i = j; continue;
    }
    if (ch === ',' && nextIs(i + 1, '}]')) { i++; continue; }
    if (ch === '…' || (ch === '.' && t[i + 1] === '.')) { i++; continue; }
    out += ch; i++;
  }
  return out;
}

/** The first balanced {...} starting at `from`, minding strings. */
function balanced(t: string, from: number): string | null {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < t.length; i++) {
    const ch = t[i]!;
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') { depth--; if (depth === 0) return t.slice(from, i + 1); }
  }
  return null;
}
/** Close what a cut-off reply left open, so that the complete part can still be read. */
function closeOpen(t: string): string {
  const stack: string[] = []; let inStr = false, esc = false;
  for (const ch of t) {
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === '{') stack.push('}'); else if (ch === '[') stack.push(']'); else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = t; if (inStr) out += '"';
  out = out.replace(/[,:]\s*$/, m => (m.trim() === ':' ? ': null' : ''));
  return out + stack.reverse().join('');
}
function lastComma(t: string): number {
  let at = -1, inStr = false, esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === ',') at = i;
  }
  return at;
}
const parseLoose = (t: string): unknown => { const v = tryJson(t); return v !== undefined ? v : tryJson(loosen(t)); };
/** A reply that ran out of tokens: keep everything up to the last thing that was finished. */
function salvage(t: string): unknown {
  let cur = loosen(t);
  for (let k = 0; k < 8 && cur.length > 1; k++) {
    const v = tryJson(closeOpen(cur));
    if (v !== undefined) return v;
    const cut = lastComma(cur);
    if (cut <= 0) break;
    cur = cur.slice(0, cut);
  }
  return undefined;
}

const camel = (k: string): string => (k === k.toUpperCase() ? k.toLowerCase() : k).trim()
  .replace(/[\s_-]+([a-zA-Z0-9])/g, (_m, c: string) => c.toUpperCase()).replace(/^[A-Z]/, c => c.toLowerCase());
/** Keys as the contract spells them: building_id, BuildingId and "building id" all become buildingId. */
function canon(v: unknown, depth = 0): unknown {
  if (Array.isArray(v)) return depth > 7 ? [] : v.slice(0, 64).map(x => canon(x, depth + 1));
  if (!isObj(v)) return v;
  if (depth > 7) return {};
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) { const key = camel(k); if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue; if (!(key in out) || out[key] === null || out[key] === undefined) out[key] = canon(x, depth + 1); }
  return out;
}
const have = (o: Record<string, unknown>, ...keys: string[]): unknown => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };

const REPLY_KEYS = ['reply', 'readBack', 'readback', 'say', 'says', 'line', 'speech', 'text', 'response', 'message', 'answer'];
const ACTION_KEYS = ['actions', 'moves', 'action', 'move', 'orders'];
const WRAPPERS = ['response', 'result', 'output', 'json', 'answer', 'data', 'message', 'content'];

/** How much an object looks like the reply we asked for. 0: it is something else. */
function replyScore(o: Record<string, unknown>): number {
  let n = 0;
  if (typeof have(o, ...REPLY_KEYS) === 'string') n += 2;
  const acts = have(o, ...ACTION_KEYS);
  if (Array.isArray(acts) || isObj(acts)) n += 2;
  if (typeof o.speaker === 'string') n += 1;
  if (o.understood !== undefined) n += 1;
  if (o.confirm !== undefined) n += 1;
  return n;
}
/** {"response": {...}} and {"result": "{...}"}: the answer is one level down. */
function unwrap(v: unknown): Record<string, unknown> | null {
  let cur = v;
  for (let k = 0; k < 3; k++) {
    if (Array.isArray(cur)) { const first = cur.find(isObj); if (!first) return null; cur = cur.every(x => isObj(x) && looksLikeMove(x)) ? { actions: cur } : first; }
    if (!isObj(cur)) return null;
    const o = canon(cur) as Record<string, unknown>;
    if (replyScore(o) >= 3) return o;
    let inner: unknown;
    for (const w of WRAPPERS) {
      const x = o[w];
      if (isObj(x) || Array.isArray(x)) { inner = x; break; }
      if (typeof x === 'string' && x.includes('{')) { const a = x.indexOf('{'); const b = balanced(x, a); const y = b ? parseLoose(b) : undefined; if (isObj(y)) { inner = y; break; } }
    }
    if (inner === undefined) return o;
    cur = inner;
  }
  return isObj(cur) ? canon(cur) as Record<string, unknown> : null;
}
const looksLikeMove = (o: Record<string, unknown>): boolean => {
  const t = have(canon(o) as Record<string, unknown>, 'type', 'action', 'kind');
  return typeof t === 'string' && /^[a-z_ ]{3,30}$/i.test(t.trim());
};

/** What reasoning models and chat templates leave lying about. */
function strip(raw: string): string {
  return raw.replace(/^\uFEFF/, '')
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ' ').replace(/^[\s\S]*<\/think(?:ing)?>/i, ' ')
    .replace(/<\|[a-z_]+\|>|<\/?s>|\[\/?INST\]/gi, ' ').trim();
}

/**
 * Find the JSON object in whatever the model wrote: fenced, wrapped in prose,
 * loosely quoted, cut off, nested in a wrapper, or one of several. Null when
 * there is none to be had.
 */
export function parseReply(raw: string): RawReply | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = strip(raw).replace(/```[a-zA-Z0-9]*/g, ' ');
  // every object in the text, in order; the one that looks most like our reply wins, the earlier on a tie
  const found: Record<string, unknown>[] = [], loose: Record<string, unknown>[] = [];
  let cutOff = -1;
  for (let from = 0, tries = 0; tries < 48; tries++) {
    const a = t.indexOf('{', from);
    if (a < 0) break;
    const body = balanced(t, a);
    const v = body ? parseLoose(body) : undefined;
    if (body && isObj(v)) {
      const o = unwrap(v);
      // an envelope, or (when a model sends its moves bare) one move
      const score = o ? replyScore(o) : 0, move = !!o && looksLikeMove(o);
      if (o && (score >= 3 || (score > 0 && !move))) found.push(o); else if (o && move) loose.push(o);
      from = a + body.length; continue;
    }
    if (!body && cutOff < 0) cutOff = a;
    from = a + 1;
  }
  let best = found.slice().sort((x, y) => replyScore(y) - replyScore(x))[0] ?? null;
  if ((!best || replyScore(best) < 3) && cutOff >= 0) {
    const o = unwrap(salvage(t.slice(cutOff)));
    if (o && replyScore(o) > (best ? replyScore(best) : 0)) best = o;
  }
  // no envelope, only moves: [{"type":"collect_all"}, ...]
  if (!best && loose.length) best = { actions: loose };
  if (!best) return null;
  const o = best;
  let acts = have(o, ...ACTION_KEYS);
  if (typeof acts === 'string' && /[{[]/.test(acts)) acts = parseLoose(acts.slice(acts.search(/[{[]/)));
  const actions = Array.isArray(acts) ? acts : isObj(acts) || (typeof acts === 'string' && acts.trim()) ? [acts] : [];
  const replyRaw = have(o, ...REPLY_KEYS);
  const reply = typeof replyRaw === 'string' ? replyRaw : '';
  if (!reply && !actions.length && o.understood === undefined && o.speaker === undefined) return null;
  const truthy = (x: unknown) => x === true || x === 1 || (typeof x === 'string' && /^(true|yes|y|aye|1)$/i.test(x.trim()));
  return {
    speaker: typeof o.speaker === 'string' ? o.speaker.toLowerCase().trim() : '',
    reply, mood: typeof o.mood === 'string' ? o.mood.toLowerCase().trim() : '',
    understood: o.understood === undefined ? (actions.length > 0 || reply.length > 0) : truthy(o.understood),
    actions, confirm: truthy(have(o, 'confirm', 'needsConfirm', 'confirmation')),
  };
}

/**
 * When a model answered in plain words with no JSON at all: is it a line the
 * listener could have said? Used only for talk, never to do anything.
 */
export function proseLine(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  let t = strip(raw).replace(/```[\s\S]*?```/g, ' ').replace(/\*[^*\n]{0,80}\*/g, ' ').replace(/[*_#>`]+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:the\s+)?[A-Z]?[a-z]{2,14}(?:\s+[A-Z][a-z]+)?\s*:\s*/, '').replace(/^["“']+|["”']+$/g, '').trim();
  if (t.length < 2 || t.length > 420 || /[{}[\]<>|]/.test(t)) return null;
  if (/\b(AI|JSON|language model|assistant|prompt|chatbot|as an? (?:ai|model)|i (?:cannot|can't|can not|am unable|am not able|won't) (?:help|assist|comply|provide|fulfil|do that)|i'?m sorry|i apologi[sz]e|here (?:is|are) (?:the|my|a|your)|sure[,!]|certainly[,!]|the (?:game|player|user|model))\b/i.test(t)) return null;
  if (/^(?:the |a )?(?:mason|bailiff|crier|steward|herald|listener|ruler|tenant)\b[^.?!]{0,60}\b(?:nods|says|replies|answers|bows|sighs|looks|reads|would)\b/i.test(t)) return null;
  return t;
}

// ───────────────────────── validating moves ─────────────────────────

export type DropWhy = 'by_hand' | 'not_by_word' | 'unknown_kind' | 'unknown_id' | 'malformed' | 'too_much';
export interface Dropped { type: string; why: DropWhy; note: string }
export interface Validated { actions: Action[]; dropped: Dropped[] }

const BY_HAND = new Set(['place_building', 'demolish', 'upgrade_building', 'place_road', 'remove_road', 'clear_tile', 'buy_parcel', 'build', 'clear_land', 'construct', 'build_building', 'place', 'buy_land', 'build_road']);
const NOT_BY_WORD = new Set(['cancel_job', 'go_to', 'dismiss_incident', 'refresh_candidates', 'release_oath', 'reveal_trait', 'remember', 'take_loan', 'repay_loan', 'accept_promotion', 'abdicate', 'set_speed', 'mark_seen', 'set_flag']);
const COND_FIELDS: CondField[] = ['season', 'month', 'gold', 'renown', 'cost', 'tenant.species', 'tenant.trade', 'tenant.tags', 'tenant.traits', 'tenant.monthsHoused', 'tenant.daysLate', 'tenant.arrears', 'tenant.happiness', 'tenant.household', 'tenant.hasPets', 'tenant.name', 'building.type', 'building.condition', 'building.id', 'building.rent'];
const NUM_FIELDS = new Set<CondField>(['gold', 'renown', 'cost', 'tenant.monthsHoused', 'tenant.daysLate', 'tenant.arrears', 'tenant.happiness', 'tenant.household', 'building.condition', 'building.rent']);
const COND_OPS: CondOp[] = ['==', '!=', '<', '<=', '>', '>=', 'includes', 'excludes'];
const OATH_KINDS: OathKind[] = ['repair', 'no_rent_raise', 'no_evict', 'build', 'pay', 'rent_cap', 'word'];
const MOODS: Mood[] = ['neutral', 'pleased', 'delighted', 'worried', 'annoyed', 'angry', 'smug', 'sad', 'afraid'];

const squash = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]/g, '');
const NO_MOVE = new Set(['none', 'noaction', 'noop', 'nothing', 'null', 'na', 'talk', 'reply', 'say', 'speak', 'answer', 'respond', 'chat']);
/** Other names a model reaches for. Keys are squashed (lower case, letters and digits only). */
const TYPE_ALIAS = dict<string>({
  job: 'order_job', orderjob: 'order_job', dispatch: 'order_job', sendjob: 'order_job',
  resolve: 'resolve_incident', settle: 'resolve_incident', resolvematter: 'resolve_incident', settlematter: 'resolve_incident', settleincident: 'resolve_incident', rule: 'resolve_incident', ruling: 'resolve_incident',
  rent: 'set_rent', raiserent: 'set_rent', lowerrent: 'set_rent', changerent: 'set_rent', setaskingrent: 'set_rent',
  list: 'set_listed', listbuilding: 'set_listed', listvacancy: 'set_listed', unlist: 'set_listed', delist: 'set_listed', unlistbuilding: 'set_listed',
  collect: 'collect_all', collectrent: 'collect_all', collectrents: 'collect_all', collectpurses: 'collect_all', collecteverything: 'collect_all',
  policy: 'set_policy', setpolicies: 'set_policy', policies: 'set_policy',
  standingorder: 'add_order', addstandingorder: 'add_order', neworder: 'add_order', order: 'add_order',
  revoke: 'revoke_order', cancelorder: 'revoke_order', removeorder: 'revoke_order', revokestandingorder: 'revoke_order', strikeorder: 'revoke_order',
  oath: 'swear_oath', swear: 'swear_oath', promise: 'swear_oath', vow: 'swear_oath', makeoath: 'swear_oath',
  give: 'gift', givegift: 'gift', givegold: 'gift', givecrowns: 'gift',
  feast: 'hold_feast', holdafeast: 'hold_feast', throwfeast: 'hold_feast',
  hirestaff: 'hire', hirecandidate: 'hire',
  dismiss: 'dismiss_staff', fire: 'dismiss_staff', sack: 'dismiss_staff', dismissdelegate: 'dismiss_staff',
  wage: 'set_wage', setwages: 'set_wage', changewage: 'set_wage',
  rename: 'rename_building',
});
const JOB_ALIAS = dict<JobKind>({
  fix: 'repair', mend: 'repair', patch: 'repair', restore: 'renovate', rebuild: 'renovate', renovation: 'renovate',
  notice: 'serve_notice', servenoticetoquit: 'serve_notice', noticetoquit: 'serve_notice', eviction: 'evict',
  call: 'visit', callon: 'visit', references: 'screen', checkreferences: 'screen', showround: 'show', showing: 'show', inspection: 'inspect', survey: 'inspect',
});
const OATH_ALIAS = dict<OathKind>({
  norentincrease: 'no_rent_raise', noraise: 'no_rent_raise', norentrise: 'no_rent_raise', rentfreeze: 'no_rent_raise', freezerent: 'no_rent_raise',
  noeviction: 'no_evict', noevicting: 'no_evict', cap: 'rent_cap', rentceiling: 'rent_cap', payment: 'pay', gift: 'pay',
  fix: 'repair', mend: 'repair', promise: 'word', other: 'word', general: 'word', pledge: 'word',
});
const FIELD_ALIAS = dict<CondField>({
  species: 'tenant.species', trade: 'tenant.trade', tags: 'tenant.tags', tag: 'tenant.tags', tenanttag: 'tenant.tags', traits: 'tenant.traits', trait: 'tenant.traits', tenanttrait: 'tenant.traits',
  monthshoused: 'tenant.monthsHoused', dayslate: 'tenant.daysLate', arrears: 'tenant.arrears', happiness: 'tenant.happiness', household: 'tenant.household', householdsize: 'tenant.household',
  haspets: 'tenant.hasPets', pets: 'tenant.hasPets', tenantpets: 'tenant.hasPets', name: 'tenant.name', tenant: 'tenant.name',
  buildingkind: 'building.type', condition: 'building.condition', building: 'building.id', coffers: 'gold',
});
const OP_ALIAS = dict<CondOp>({
  '=': '==', '===': '==', is: '==', eq: '==', equals: '==', equal: '==',
  '<>': '!=', '!==': '!=', not: '!=', neq: '!=', isnot: '!=', isnt: '!=', notequal: '!=',
  in: 'includes', has: 'includes', contains: 'includes', include: 'includes',
  notin: 'excludes', lacks: 'excludes', notincludes: 'excludes', exclude: 'excludes', notcontains: 'excludes', hasnot: 'excludes',
  lt: '<', lessthan: '<', under: '<', below: '<', gt: '>', greaterthan: '>', morethan: '>', over: '>', above: '>',
  lte: '<=', atmost: '<=', gte: '>=', atleast: '>=',
});
const RULE_ALIAS = dict<'choose' | 'never'>({
  always: 'choose', must: 'choose', do: 'choose', prefer: 'choose', require: 'choose', pick: 'choose',
  forbid: 'never', forbidden: 'never', ban: 'never', dont: 'never', donot: 'never', avoid: 'never', not: 'never',
});
const MOOD_ALIAS = dict<Mood>({
  happy: 'pleased', content: 'pleased', glad: 'pleased', amused: 'pleased', satisfied: 'pleased', proud: 'smug', joyful: 'delighted', thrilled: 'delighted',
  concerned: 'worried', anxious: 'worried', nervous: 'worried', uneasy: 'worried', wary: 'worried', hesitant: 'worried', doubtful: 'worried', cautious: 'worried',
  irritated: 'annoyed', grumpy: 'annoyed', displeased: 'annoyed', exasperated: 'annoyed', stern: 'annoyed', gruff: 'annoyed', resigned: 'annoyed', weary: 'annoyed', tired: 'annoyed', grudging: 'annoyed',
  furious: 'angry', outraged: 'angry', unhappy: 'sad', sorrowful: 'sad', disappointed: 'sad', scared: 'afraid', fearful: 'afraid', frightened: 'afraid',
  calm: 'neutral', dry: 'neutral', deadpan: 'neutral', matteroffact: 'neutral', composed: 'neutral', businesslike: 'neutral',
});

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && isFinite(v) ? String(v) : null);
/** An id as a model may write it ("#i9", "i9 (the leak)", "[o1]"), looked up in a table. */
function keyIn<T>(table: Record<string, T>, v: unknown): string | null {
  const x = str(v); if (!x) return null;
  const bare = x.replace(/^[\s"'`([<#]+|[\s"'`)\]>.,;:]+$/g, '');
  if (Object.prototype.hasOwnProperty.call(table, bare)) return bare;
  const first = bare.split(/[\s:,(=]+/)[0] ?? '';
  if (first && Object.prototype.hasOwnProperty.call(table, first)) return first;
  const lower = first.toLowerCase();
  return /\d/.test(first) && Object.prototype.hasOwnProperty.call(table, lower) ? lower : null;
}
function numv(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = /-?\d+(?:\.\d+)?/.exec(v.replace(/(\d),(\d{3})/g, '$1$2'));
  return m ? Number(m[0]) : null;
}
function boolv(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 1 || (typeof v === 'string' && /^(true|yes|y|1)$/i.test(v.trim()))) return true;
  if (v === 0 || (typeof v === 'string' && /^(false|no|n|0)$/i.test(v.trim()))) return false;
  return null;
}
/** Match loosely against a fixed list: case, spaces, underscores and plurals do not matter ("Stone Hall", "widows", "dwarves"). */
const oneOf = <T extends string>(v: unknown, list: readonly T[], alias?: Record<string, T>): T | null => {
  if (Array.isArray(v) && v.length === 1) v = v[0];
  if (typeof v !== 'string') return null;
  const q = squash(v);
  if (!q) return null;
  const forms = [q, q.replace(/s$/, ''), q.replace(/es$/, ''), q.replace(/ves$/, 'f'), q.replace(/ies$/, 'y')];
  for (const f of forms) { const hit = list.find(x => squash(x) === f); if (hit) return hit; }
  for (const f of forms) if (alias && owns(alias, f)) return alias[f]!;
  return null;
};
const BUILDING_ALIAS = dict<BuildingType>(Object.fromEntries(BUILDING_TYPES.map(t => [squash(BUILDINGS[t]?.name ?? t), t])));
const cleanName = (v: unknown, max: number): string => (typeof v === 'string' ? tidy(v.replace(/[<>{}[\]\\]/g, '')).slice(0, max).trim() : '');

/**
 * One proposed move as the contract shapes it, whatever shape the model gave
 * it: a bare name, a function call, parameters nested one level down, a
 * single key holding the arguments, snake_case keys.
 */
function shapeMove(raw: unknown, depth = 0): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{') && depth < 2) return shapeMove(parseLoose(t), depth + 1);
    return /^[A-Za-z_ ]{3,30}$/.test(t) ? { type: t } : null;
  }
  if (!isObj(raw)) return null;
  let o = canon(raw) as Record<string, unknown>;
  if (isObj(o.function)) o = { ...o.function, ...o };
  for (const k of ['params', 'parameters', 'args', 'arguments', 'input', 'payload', 'data', 'details']) {
    let inner = o[k];
    if (typeof inner === 'string' && inner.trim().startsWith('{')) inner = canon(parseLoose(inner));
    if (isObj(inner)) o = { ...inner, ...o };
  }
  if (typeof o.type !== 'string') {
    const alt = [o.action, o.move, o.tool, o.name, o.act].find(x => typeof x === 'string');
    if (typeof alt === 'string') o.type = alt;
    else {
      // {"set_rent": {"buildingId": "#b7", "rent": 18}}
      const keys = Object.keys(o);
      const k = keys.length === 1 ? keys[0]! : '';
      const known = k && ((SPOKEN_ACTIONS as string[]).includes(snake(k)) || TYPE_ALIAS[squash(k)] || (SPOKEN_JOBS as string[]).includes(snake(k)));
      if (known) o = { ...(isObj(o[k]) ? o[k] as Record<string, unknown> : {}), type: k };
    }
  }
  return o;
}
const snake = (k: string): string => k.trim().replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[\s-]+/g, '_');

function condField(v: unknown): CondField | null {
  if (typeof v !== 'string') return null;
  const q = squash(v);
  return COND_FIELDS.find(f => squash(f) === q) ?? FIELD_ALIAS[q] ?? null;
}
function condOp(v: unknown): CondOp | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return COND_OPS.find(o => o === t) ?? OP_ALIAS[t] ?? OP_ALIAS[squash(t)] ?? null;
}

function validCondition(raw: unknown, s: GameState): Condition | null {
  if (!isObj(raw)) return null;
  const field = condField(have(raw, 'field', 'f', 'key', 'on'));
  if (!field) return null;
  const opRaw = have(raw, 'op', 'operator', 'comparison', 'cmp', 'test');
  let op = opRaw === undefined ? (field === 'tenant.tags' || field === 'tenant.traits' ? 'includes' : '==') as CondOp : condOp(opRaw);
  if (!op) return null;
  let v = have(raw, 'value', 'v', 'val', 'is', 'equals');
  if (Array.isArray(v) && v.length === 1) v = v[0];
  const eq = op === '==' || op === '!=', set = op === 'includes' || op === 'excludes';
  const asEq = (): CondOp => (op === 'includes' ? '==' : op === 'excludes' ? '!=' : op!);
  const asSet = (): CondOp => (op === '==' ? 'includes' : op === '!=' ? 'excludes' : op!);
  if (NUM_FIELDS.has(field)) { const n = numv(v); return n === null || set ? null : { field, op, value: n }; }
  switch (field) {
    case 'season': { const x = oneOf(typeof v === 'string' && /^fall$/i.test(v.trim()) ? 'autumn' : v, ['spring', 'summer', 'autumn', 'winter'] as const); return x && (eq || set) ? { field, op: asEq(), value: x } : null; }
    case 'month': {
      let n = typeof v === 'number' ? v : null;
      if (n === null && typeof v === 'string') { const i = MONTH_NAMES.findIndex(m => squash(m) === squash(v as string)); n = i >= 0 ? i : numv(v); }
      return n !== null && Number.isInteger(n) && n >= 0 && n <= 11 && !set ? { field, op, value: n } : null;
    }
    case 'tenant.species': { const x = oneOf(v, SPECIES); return x && (eq || set) ? { field, op: asEq(), value: x } : null; }
    case 'tenant.trade': { const x = oneOf(v, TRADES); return x && (eq || set) ? { field, op: asEq(), value: x } : null; }
    case 'tenant.tags': { const x = oneOf(v, TENANT_TAGS, { widower: 'widow', elderly: 'elder', old: 'elder', newlywed: 'newlyweds', noble: 'noble_born', largefamilie: 'large_family', family: 'large_family' }); return x && (eq || set) ? { field, op: asSet(), value: x } : null; }
    case 'tenant.traits': { const x = oneOf(v, TRAITS); return x && (eq || set) ? { field, op: asSet(), value: x } : null; }
    case 'tenant.hasPets': { const b = boolv(v); if (op === 'includes') op = '=='; else if (op === 'excludes') op = '!='; return b !== null && (eq || set) ? { field, op, value: b } : null; }
    case 'tenant.name': {
      // the rule is kept by name, so a name written out in full needs no telling apart
      const exact = typeof v === 'string' ? Object.values(s.tenants).find(t => t.name.toLowerCase() === v.trim().toLowerCase())?.name ?? null : null;
      const id = exact ? null : resolveRef(s, 'tenant', v); const name = exact ?? (id ? s.tenants[id]!.name : null);
      return name && (eq || set) ? { field, op: asEq(), value: name } : null;
    }
    case 'building.type': { const x = oneOf(v, BUILDING_TYPES, BUILDING_ALIAS); return x && (eq || set) ? { field, op: asEq(), value: x } : null; }
    case 'building.id': { const id = resolveRef(s, 'building', v); return id && (eq || set) ? { field, op: asEq(), value: id } : null; }
    default: return null;
  }
}
/**
 * The conditions of a rule, however the model laid them out: a list, one
 * object, or a map like {"season":"winter","tenant.tags":"widow"}. Null when
 * any part of it cannot be read: a rule with a condition lost is a broader
 * rule than the ruler spoke, so it is refused whole.
 */
function validWhen(raw: unknown, s: GameState): Condition[] | null {
  if (raw === undefined || raw === null || raw === '' || raw === 'always') return [];
  let list: unknown[];
  if (Array.isArray(raw)) list = raw;
  else if (isObj(raw)) list = have(raw, 'field', 'f', 'key') !== undefined ? [raw] : Object.entries(raw).map(([field, value]) => (isObj(value) ? { field, ...value } : { field, value }));
  else return null;
  if (list.length > 8) return null;
  const out: Condition[] = [];
  for (const c of list) { const ok = validCondition(c, s); if (!ok) return null; out.push(ok); }
  return out;
}

/**
 * Check every proposed move against the Action types and the state. Unknown
 * kinds are dropped, numbers coerced, ids checked (a name given in place of an
 * id is resolved when it can mean only one thing), options checked against
 * their decision. Shapes are read forgivingly; meanings are not: nothing is
 * ever guessed into being a different or a broader move. `text` is the
 * ruler's utterance: a standing order's `text` is always the ruler's own words.
 */
export function validateActions(rawActions: unknown, s: GameState, text: string): Validated {
  const actions: Action[] = [], dropped: Dropped[] = [];
  const title = titleOf(s);
  const list = Array.isArray(rawActions) ? rawActions.slice(0, 16) : rawActions === undefined || rawActions === null ? [] : [rawActions];
  const said = text.replace(/\s+/g, ' ').trim();
  for (const item of list) {
    const raw = shapeMove(item);
    if (!raw) { if (item !== null && item !== undefined && item !== '') dropped.push({ type: '?', why: 'malformed', note: '' }); continue; }
    const given = typeof raw.type === 'string' ? raw.type.trim() : '';
    // "no move" said the long way round: {"type":"none"}, {}
    if (!Object.keys(raw).length || NO_MOVE.has(squash(given))) continue;
    let type = snake(given);
    let jobKind: JobKind | null = null;
    const kindRaw = typeof raw.kind === 'string' ? raw.kind : typeof raw.job === 'string' ? raw.job : typeof raw.jobKind === 'string' ? raw.jobKind : typeof raw.task === 'string' ? raw.task : null;
    const asJob = (v: string | null): JobKind | null => (v ? oneOf(v, SPOKEN_JOBS, JOB_ALIAS) : null);
    if (!(SPOKEN_ACTIONS as string[]).includes(type) && !BY_HAND.has(type) && !NOT_BY_WORD.has(type)) {
      const alias = TYPE_ALIAS[squash(given)];
      if (asJob(given) && (!alias || !isObj(raw.order))) { jobKind = asJob(given); type = 'order_job'; }
      else if (alias === 'add_order' && !isObj(raw.order) && asJob(kindRaw)) type = 'order_job';
      else if (alias) {
        type = alias;
        if (alias === 'set_listed' && raw.listed === undefined) raw.listed = !/^(un|de)/i.test(given);
        if (alias === 'collect_all' && (raw.buildingId ?? raw.building) !== undefined) type = 'collect_purse';
      } else if (!given && asJob(kindRaw)) type = 'order_job';
    }
    const drop = (why: DropWhy, note = '') => { dropped.push({ type: type || '?', why, note }); };
    if (BY_HAND.has(type) || (type === 'order_job' && kindRaw && BY_HAND.has(snake(kindRaw)))) { drop('by_hand', /road/.test(type) ? `Roads are laid by hand, ${title}.` : /parcel|land/.test(type) ? `Land is bought at the map, ${title}.` : `Buildings are placed by hand, ${title}.`); continue; }
    if (NOT_BY_WORD.has(type)) { drop('not_by_word', `That is not a thing done by word, ${title}.`); continue; }
    if (!(SPOKEN_ACTIONS as string[]).includes(type)) { drop('unknown_kind'); continue; }
    const building = (v: unknown) => resolveRef(s, 'building', v);
    const tenant = (v: unknown) => resolveRef(s, 'tenant', v);
    const bRef = have(raw, 'buildingId', 'building', 'buildingName', 'house', 'at');
    const tRef = have(raw, 'tenantId', 'tenant', 'household', 'householdId', 'tenantName');
    switch (type) {
      case 'order_job': {
        const kind = jobKind ?? asJob(kindRaw);
        if (!kind) { drop(kindRaw ? 'not_by_word' : 'malformed', `That is not a thing done by word, ${title}.`); break; }
        let b = building(bRef), t = tenant(tRef);
        let ap = resolveRef(s, 'applicant', have(raw, 'applicantId', 'applicant'));
        const role = oneOf(raw.role, [...STAFF_ROLES, 'ruler', 'any'] as const);
        if (kind === 'repair' || kind === 'renovate' || kind === 'inspect') {
          if (!b && t) b = s.tenants[t]?.buildingId ?? null;
          if (!b) { drop('unknown_id', `I know no such house, ${title}.`); break; }
          actions.push({ type: 'order_job', kind, buildingId: b, ...(role ? { role } : {}) });
        } else if (kind === 'serve_notice' || kind === 'evict' || kind === 'visit') {
          if (!t && b) { const occ = s.buildings[b]!.units.map(u => u.tenantId).filter((x): x is Id => !!x); if (occ.length === 1) t = occ[0]!; }
          if (!t || s.tenants[t]!.status !== 'housed') { drop('unknown_id', `I know no such household, ${title}.`); break; }
          const home = s.tenants[t]!.buildingId ?? undefined;
          actions.push({ type: 'order_job', kind, tenantId: t, ...(home ? { buildingId: home } : {}), ...(kind === 'visit' ? { role: 'ruler' as const } : role ? { role } : {}) });
        } else if (kind === 'show') {
          if (!ap) ap = resolveRef(s, 'applicant', tRef);
          if (!ap && b) ap = Object.values(s.applicants).find(a => a.buildingId === b)?.id ?? null;
          if (!ap) { drop('unknown_id', `No such applicant is waiting, ${title}.`); break; }
          actions.push({ type: 'order_job', kind, applicantId: ap, buildingId: s.applicants[ap]!.buildingId, ...(role ? { role } : {}) });
        } else {   // screen
          if (!ap && !t) ap = resolveRef(s, 'applicant', tRef);
          if (ap) actions.push({ type: 'order_job', kind, applicantId: ap, buildingId: s.applicants[ap]!.buildingId, ...(role ? { role } : {}) });
          else if (t) actions.push({ type: 'order_job', kind, tenantId: t, ...(role ? { role } : {}) });
          else drop('unknown_id', `I know of no one by that name to ask after, ${title}.`);
        }
        break;
      }
      case 'resolve_incident': {
        const want = str(have(raw, 'outcomeId', 'outcome', 'option', 'choice', 'ruling'));
        const pick = (inc: Incident) => {
          const def = defOf(inc); if (!def || !want) return null;
          const q = squash(want.replace(/^#/, ''));
          return def.outcomes.find(o => o.id === want) ?? def.outcomes.find(o => squash(o.id) === q) ?? def.outcomes.find(o => o.option === want || (o.option && squash(o.option) === q)) ?? def.outcomes.find(o => squash(o.label) === q) ?? null;
        };
        const id = keyIn(s.incidents, have(raw, 'incidentId', 'incident', 'matterId', 'matter', 'id'));
        let inc = id ? s.incidents[id] : undefined;
        if (!inc || inc.state !== 'open') {
          // the place or household was named in place of the matter: taken when it can mean only one
          const b = building(bRef), t = tenant(tRef), ap = resolveRef(s, 'applicant', have(raw, 'applicantId', 'applicant'));
          const near = b || t || ap ? openIncidents(s).filter(i => ((b && i.buildingId === b) || (t && i.tenantId === t) || (ap && i.applicantId === ap)) && !!pick(i)) : [];
          inc = near.length === 1 ? near[0] : undefined;
        }
        if (!inc || inc.state !== 'open') { drop('unknown_id', `No such matter is open, ${title}.`); break; }
        const out = pick(inc);
        if (!out) { drop('unknown_id', `That is not one of the ways the matter can go, ${title}.`); break; }
        actions.push({ type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id });
        break;
      }
      case 'set_rent': {
        const b = building(bRef) ?? (tenant(tRef) ? s.tenants[tenant(tRef)!]!.buildingId : null);
        const rent = numv(have(raw, 'rent', 'amount', 'value', 'to', 'newRent'));
        if (!b || !s.buildings[b]!.units.length) { drop('unknown_id', `I know no such house to let, ${title}.`); break; }
        if (rent === null || rent < 1 || rent > 100000) { drop('malformed'); break; }
        actions.push({ type: 'set_rent', buildingId: b, rent: Math.round(rent) });
        break;
      }
      case 'set_listed': {
        const b = building(bRef); const listed = boolv(raw.listed ?? raw.value ?? true);
        if (!b || !s.buildings[b]!.units.length) { drop('unknown_id', `I know no such house to let, ${title}.`); break; }
        if (listed === null) { drop('malformed'); break; }
        actions.push({ type: 'set_listed', buildingId: b, listed });
        break;
      }
      case 'collect_all': actions.push({ type: 'collect_all' }); break;
      case 'collect_purse': {
        const b = building(bRef) ?? (tenant(tRef) ? s.tenants[tenant(tRef)!]!.buildingId : null);
        if (!b) { drop('unknown_id', `I know no such door, ${title}.`); break; }
        const unit = numv(raw.unit);
        actions.push({ type: 'collect_purse', buildingId: b, ...(unit !== null && Number.isInteger(unit) && unit >= 0 && unit < s.buildings[b]!.units.length ? { unit } : {}) });
        break;
      }
      case 'add_order': {
        const o = isObj(raw.order) ? raw.order : isObj(raw.standingOrder) ? raw.standingOrder : raw;
        const rule = oneOf(o.rule, ['choose', 'never'] as const, RULE_ALIAS);
        const named = oneOf(o.decision, Object.keys(DECISION_OPTIONS) as DecisionType[]);
        let decision: DecisionType | null = named && named !== 'custom' ? named : null;
        let option: DecisionOption | null = null, incidentDef: string | null = null, outcomeId: string | null = null;
        const defId = str(o.incidentDef)?.replace(/^(def\s+|#)/i, '') ?? null;
        if (defId && owns(INCIDENT_BY_ID, defId)) {
          const def = INCIDENT_BY_ID[defId]!; const want = str(o.outcomeId ?? o.option);
          const out = def.outcomes.find(x => x.id === want) ?? def.outcomes.find(x => x.option === want);
          if (out) { incidentDef = def.id; outcomeId = out.id; }
        }
        if (decision) { option = oneOf(o.option, DECISION_OPTIONS[decision]); if (!option) decision = null; }
        else if (!named && !incidentDef) {
          // no decision that we know was named: the option names it, when it belongs to exactly one
          const all = (Object.keys(DECISION_OPTIONS) as DecisionType[]).filter(d => oneOf(o.option, DECISION_OPTIONS[d]));
          if (all.length === 1) { decision = all[0]!; option = oneOf(o.option, DECISION_OPTIONS[all[0]!]); }
        }
        if (!rule || (!decision && !incidentDef)) { drop('malformed', `That is a rule I cannot keep a tally of, ${title}.`); break; }
        const when = validWhen(have(o, 'when', 'conditions', 'if', 'condition'), s);
        if (!when) { drop('malformed', `One of the conditions on that rule made no sense to me, ${title}.`); break; }
        const to = oneOf(o.to, [...STAFF_ROLES, 'all'] as const) ?? (decision ? DECISION_ROLE[decision] : null) ?? 'all';
        const core = { to, decision, incidentDef, when, rule, option, outcomeId: incidentDef ? outcomeId : null };
        // `text` is the ruler's verbatim words: the model's excerpt is kept only if the ruler really said it
        const excerpt = typeof o.text === 'string' ? o.text.replace(/\s+/g, ' ').trim() : '';
        const verbatim = excerpt.length >= 6 && said.toLowerCase().includes(excerpt.toLowerCase().replace(/[.!?]+$/, '')) ? excerpt : said;
        const gist = clip(scrubIds(cleanName(o.gist, 160), s), 120) || orderGist(core, s);
        actions.push({ type: 'add_order', order: { ...core, text: clip(verbatim, 240), gist } });
        break;
      }
      case 'revoke_order': {
        const table = Object.fromEntries(s.orders.map(o => [o.id, o]));
        const id = keyIn(table, have(raw, 'orderId', 'order', 'id'));
        if (!id) { drop('unknown_id', `There is no such standing order, ${title}.`); break; }
        actions.push({ type: 'revoke_order', orderId: id });
        break;
      }
      case 'set_policy': {
        const p = isObj(raw.policy) ? raw.policy : isObj(raw.policies) ? raw.policies : raw; const out: Partial<Policies> = {};
        const ranged = (k: 'graceDays' | 'lateFeePct' | 'depositMonths' | 'askPct' | 'renewalCapPct', lo: number, hi: number, step: number, ...also: string[]) => {
          const n = numv(have(p, k, ...also)); if (n !== null) out[k] = Math.max(lo, Math.min(hi, Math.round(n / step) * step));
        };
        ranged('graceDays', 0, 30, 1, 'grace', 'gracePeriod'); ranged('lateFeePct', 0, 100, 1, 'lateFee', 'lateFeePercent');
        ranged('depositMonths', 0, 6, 0.5, 'deposit', 'surety', 'suretyMonths'); ranged('askPct', 50, 200, 1, 'askPercent'); ranged('renewalCapPct', 0, 100, 1, 'renewalCap');
        const pets = oneOf(have(p, 'pets', 'petPolicy'), ['allow', 'pet_rent', 'ban'] as const, { allowed: 'allow', yes: 'allow', banned: 'ban', none: 'ban', no: 'ban', forbid: 'ban', rent: 'pet_rent' }); if (pets) out.pets = pets;
        const scr = oneOf(have(p, 'screening', 'references'), ['never', 'always'] as const, { yes: 'always', no: 'never' }); if (scr) out.screening = scr;
        if (!Object.keys(out).length) { drop('malformed'); break; }
        actions.push({ type: 'set_policy', policy: out });
        break;
      }
      case 'swear_oath': {
        const o = isObj(raw.oath) ? raw.oath : raw;
        let kind = oneOf(o.kind, OATH_KINDS, OATH_ALIAS);
        if (!kind) { drop('malformed'); break; }
        const t = tenant(have(o, 'toTenantId', 'tenantId', 'tenant', 'to')); let b = building(have(o, 'buildingId', 'building'));
        const btype = oneOf(o.buildingType, BUILDING_TYPES, BUILDING_ALIAS);
        let amount = numv(o.amount); if (amount !== null) amount = Math.round(amount);
        if (kind === 'repair' && !b && t) b = s.tenants[t]?.buildingId ?? null;
        // a promise that lacks what its kind needs is still a promise: it is kept as plain word
        if ((kind === 'repair' && !b) || (kind === 'build' && !btype) || ((kind === 'no_rent_raise' || kind === 'no_evict' || kind === 'pay' || kind === 'rent_cap') && !t) || ((kind === 'pay' || kind === 'rent_cap') && (amount === null || amount < 1))) kind = 'word';
        const today = Math.floor(s.day);
        let due = numv(have(o, 'dueDay', 'due'));
        const rel = numv(have(o, 'dueInDays', 'days', 'inDays')) ?? (numv(o.months) !== null ? numv(o.months)! * 30 : null);
        if (due === null && rel !== null) due = today + rel;
        if (due === null || due <= s.day) due = defaultDue(kind, s.day);
        due = Math.min(Math.round(due), today + 3600);
        const occupant = !t && b ? s.buildings[b]!.units.map(u => u.tenantId).find(x => !!x) ?? null : null;
        const to = t ?? occupant;
        const words = clip(scrubIds(cleanName(o.text, 240), s) || said, 160);
        if (!words) { drop('malformed'); break; }
        actions.push({ type: 'swear_oath', oath: {
          kind, text: words, toTenantId: to, toName: to ? s.tenants[to]!.name : cleanName(o.toName, 60) || 'the realm',
          buildingId: kind === 'repair' ? b : null, buildingType: kind === 'build' ? btype : null,
          amount: kind === 'pay' || kind === 'rent_cap' ? amount : null, dueDay: due,
        } });
        break;
      }
      case 'gift': {
        const t = tenant(have(raw, 'tenantId', 'tenant', 'household', 'to')); const amount = numv(have(raw, 'amount', 'crowns', 'gold', 'value'));
        if (!t || s.tenants[t]!.status !== 'housed') { drop('unknown_id', `I know no such household, ${title}.`); break; }
        if (amount === null || amount < 1) { drop('malformed'); break; }
        if (amount > Math.max(0, s.gold)) { drop('too_much', `The coffers hold but ${Math.max(0, Math.round(s.gold))} crowns, ${title}.`); break; }
        actions.push({ type: 'gift', tenantId: t, amount: Math.round(amount) });
        break;
      }
      case 'hold_feast': actions.push({ type: 'hold_feast' }); break;
      case 'hire': {
        const ref = have(raw, 'candidateId', 'candidate', 'name', 'who');
        const role = oneOf(have(raw, 'role', 'candidateId', 'candidate'), STAFF_ROLES);
        const pool = role ? s.candidates.filter(c => c.role === role) : [];
        const c = resolveRef(s, 'candidate', ref) ?? (pool.length === 1 ? pool[0]!.id : null);
        if (!c) { drop('unknown_id', `No one of that description is asking for work, ${title}.`); break; }
        actions.push({ type: 'hire', candidateId: c });
        break;
      }
      case 'dismiss_staff': case 'set_wage': {
        const ref = have(raw, 'staffId', 'staff', 'who', 'name');
        const role = oneOf(have(raw, 'role', 'staffId', 'staff'), STAFF_ROLES);
        const id = resolveRef(s, 'staff', ref) ?? (role ? staffByRole(s, role)?.id ?? null : null);
        if (!id) { drop('unknown_id', `No such person is in your household, ${title}.`); break; }
        if (type === 'dismiss_staff') { actions.push({ type: 'dismiss_staff', staffId: id }); break; }
        const wage = numv(have(raw, 'wage', 'amount', 'value'));
        if (wage === null || wage < 0 || wage > 9999) { drop('malformed'); break; }
        actions.push({ type: 'set_wage', staffId: id, wage: Math.round(wage) });
        break;
      }
      case 'rename_building': {
        const b = building(bRef); const name = cleanName(have(raw, 'name', 'newName', 'to'), 40);
        if (!b) { drop('unknown_id', `I know no such house, ${title}.`); break; }
        if (name.length < 2 || !/[A-Za-z]/.test(name)) { drop('malformed'); break; }
        actions.push({ type: 'rename_building', buildingId: b, name });
        break;
      }
      default: drop('unknown_kind');
    }
  }
  return { actions, dropped };
}

/**
 * Ids have no place in anything a player reads. Where a model let one slip
 * ("#b7", "(#t5)") it becomes the name it stands for.
 */
export function scrubIds(text: string, s: GameState): string {
  if (!text.includes('#')) return text;
  const nameOf = (id: string): string | null => {
    const b = s.buildings[id]; if (b) return mid(b.name);
    const t = s.tenants[id]; if (t) return t.name;
    const m = s.staff[id]; if (m) return m.first;
    const a = s.applicants[id]; if (a) return a.household.name;
    const c = s.candidates.find(x => x.id === id); if (c) return c.name;
    const inc = s.incidents[id]; const def = inc ? defOf(inc) : null; if (def) return `the matter of ${def.title}`;
    if (s.orders.some(o => o.id === id)) return 'that standing order';
    if (s.oaths.some(o => o.id === id)) return 'that oath';
    return null;
  };
  return text
    .replace(/([A-Za-z,'’]) \(#([0-9a-z]{1,8})\)/g, '$1')
    .replace(/#([0-9a-z]{1,8})\b/g, (_m, id: string) => nameOf(id) ?? 'that')
    .replace(/\s{2,}/g, ' ').trim();
}

// ───────────────────────── exchanges ─────────────────────────

export interface WordCtx {
  deps: WordDeps;
  /** call on every change to any exchange */
  notify: () => void;
  nextId: () => string;
}

const HERALD_SEED = 7;
function heraldSpeaker(mood: Mood): Speaker { return { kind: 'herald', name: 'The Herald', first: 'Herald', species: 'human', portraitSeed: HERALD_SEED, mood }; }
function staffSpeaker(s: GameState, role: StaffRole, mood: Mood): Speaker {
  const m = staffByRole(s, role);
  return m ? { kind: 'staff', name: m.name, first: m.first, species: m.species, portraitSeed: m.portraitSeed, role, staffId: m.id, mood } : heraldSpeaker(mood);
}
function tenantSpeaker(s: GameState, id: Id, mood: Mood): Speaker {
  const t = s.tenants[id];
  return t ? { kind: 'tenant', name: t.name, first: t.first, species: t.species, portraitSeed: t.portraitSeed, tenantId: t.id, mood } : heraldSpeaker(mood);
}
const voiceOf = (sp: Speaker): StaffRole | 'herald' | 'tenant' => (sp.kind === 'staff' && sp.role ? sp.role : sp.kind === 'tenant' ? 'tenant' : 'herald');
const mayExclaim = (sp: Speaker) => sp.species === 'goblin' || sp.role === 'crier';

/** Make a model's line fit the page: no dashes, no stray marks, 200 characters, exclamations only where the style allows. */
export function cleanReply(text: string, sp: Speaker, s?: GameState): string {
  let t = String(text ?? '').replace(/\*[^*\n]{0,60}\*/g, ' ').replace(/[*_`]{1,3}/g, '');   // *sucks teeth*, **bold**
  t = tidy(t).replace(/^["'“]+|["'”]+$/g, '').trim();
  // "Agnes: ..." where Agnes is the one speaking
  const label = /^([A-Z][A-Za-z' ]{1,30}):\s+(?=\S)/.exec(t);
  if (label && [sp.name, sp.first, sp.role ?? '', 'herald', 'the herald'].some(n => n && n.toLowerCase() === label[1]!.toLowerCase())) t = t.slice(label[0].length).replace(/^["'“]+|["'”]+$/g, '');
  if (s) t = scrubIds(t, s);
  if (!mayExclaim(sp)) t = t.replace(/!+/g, '.');
  return clip(t.replace(/\.{2}(?!\.)/g, '.'), 200);
}

/** reply + the speaker's grumble + the sim's reason, within reach of the 200-character cap. */
function withRefusal(reply: string, grumble: string, reasons: string[], keepReply: boolean): string {
  const why = [...new Set(reasons.map(r => tidy(r)).filter(Boolean))].join(' ') || 'It cannot be done.';
  const tail = tidy(`${grumble} ${why}`);
  if (!keepReply || !reply) return clip(tail, 240);
  if (reply.length + tail.length + 1 <= 210) return `${reply} ${tail}`;
  const first = /^.*?[.!?](?=\s|$)/.exec(reply)?.[0] ?? '';
  return first && first.length + tail.length + 1 <= 210 ? `${first} ${tail}` : clip(tail, 240);
}

/** A read-back with its closing "Is that your word?" taken off. */
function withoutQuestion(reply: string): string {
  return reply.replace(/(^|[.!:;]\s+)[^.!?:;]*\?\s*$/, '$1').trim();
}

interface Draft {
  text: string; target: SpeakTarget; speaker: Speaker; reply: string; via: 'model' | 'offline';
  actions: Action[]; confirm: boolean;
  /** when there is nothing to do: is that because it was only talk (done), not understood (unclear), or refused? */
  idle: 'done' | 'unclear' | 'refused' | 'error';
}

function makeExchange(d: Draft, ctx: WordCtx): Exchange {
  const s = ctx.deps.getState();
  const seed = `${d.text}|${Math.floor(s.day)}`;
  const ex: Exchange = {
    id: ctx.nextId(), day: s.day, text: d.text, target: d.target, speaker: d.speaker, reply: d.reply,
    status: 'done', applied: [], pending: [], orders: [], oaths: [], via: d.via,
    confirm() {
      if (ex.status !== 'needs_confirm') return;
      const todo = ex.pending; ex.pending = [];
      // the question has had its answer: what is left is the order as it was read back
      const st = ctx.deps.getState();
      ex.reply = withoutQuestion(ex.reply) || `${todo.map((a, i) => { const d = describeAction(a, st); return i ? d[0]!.toLowerCase() + d.slice(1) : d; }).join('; ')}.`;
      run(todo, true);
      ctx.notify();
    },
    cancel() {
      if (ex.status !== 'needs_confirm') return;
      ex.pending = []; ex.status = 'unclear';
      ex.reply = `As you were, ${titleOf(ctx.deps.getState())}. Nothing is done.`;
      ctx.notify();
    },
  };
  function run(actions: Action[], keepReply: boolean): void {
    const reasons: string[] = [];
    for (const a of actions) {
      const st = ctx.deps.getState();
      const hadOrders = new Set(st.orders.map(o => o.id)), hadOaths = new Set(st.oaths.map(o => o.id));
      let result: ActionResult;
      try { result = ctx.deps.dispatch(a); } catch { result = { ok: false, code: 'invalid', reason: 'Something went awry in the doing of it.' }; }
      ex.applied.push({ action: a, result });
      if (!result.ok) { reasons.push(result.reason || 'It cannot be done.'); continue; }
      const now = ctx.deps.getState();
      if (a.type === 'add_order') { const o: StandingOrder | undefined = now.orders.find(x => x.id === result.id) ?? now.orders.find(x => !hadOrders.has(x.id)); if (o && !ex.orders.includes(o)) ex.orders.push(o); }
      if (a.type === 'swear_oath') { const o: Oath | undefined = now.oaths.find(x => x.id === result.id) ?? now.oaths.find(x => !hadOaths.has(x.id)); if (o && !ex.oaths.includes(o)) ex.oaths.push(o); }
    }
    if (reasons.length) {
      ex.status = 'refused';
      ex.speaker.mood = 'annoyed';
      ex.reply = withRefusal(ex.reply, grumbleOf(ctx.deps.getState(), voiceOf(ex.speaker), seed), reasons, keepReply);
    } else ex.status = 'done';
  }
  if (!d.actions.length) ex.status = d.idle;
  else if (d.confirm) { ex.pending = d.actions.slice(); ex.status = 'needs_confirm'; }
  else run(d.actions, true);
  return ex;
}

function speakerFrom(s: GameState, want: string, target: SpeakTarget, actions: Action[], mood: Mood): Speaker {
  // a role, "the bailiff", "Bailiff Agnes", or the delegate's own name
  const w = want.replace(/^the\s+/, '').trim();
  const role = STAFF_ROLES.find(r => r === w) ?? STAFF_ROLES.find(r => new RegExp(`\\b${r}\\b`).test(w))
    ?? (w ? STAFF_ROLES.find(r => { const m = staffByRole(s, r); return !!m && (m.first.toLowerCase() === w || m.name.toLowerCase() === w); }) : undefined);
  if (role && staffByRole(s, role)) return staffSpeaker(s, role, mood);
  if ('tenantId' in target && s.tenants[target.tenantId]) {
    const t = s.tenants[target.tenantId]!;
    if (/\b(tenant|household|petitioner)\b/.test(w) || w === t.first.toLowerCase() || w === t.name.toLowerCase()) return tenantSpeaker(s, t.id, mood);
  }
  if (/\b(herald|clerk|court)\b/.test(w)) return heraldSpeaker(mood);
  if ('to' in target && target.to !== 'court' && staffByRole(s, target.to)) return staffSpeaker(s, target.to, mood);
  const owner = actions.map(a => domainRole(a, s)).find((r): r is StaffRole => !!r && !!staffByRole(s, r));
  return owner ? staffSpeaker(s, owner, mood) : heraldSpeaker(mood);
}

const CONFIRM_ASK = ['Is that your word, {title}?', 'Your aye, {title}?', 'Do I have it right, {title}?'];

/**
 * Turn a model's raw reply into an Exchange (validated, and applied or held).
 * Null when the reply cannot be read at all: the caller falls back to the offline parser.
 */
export function exchangeFromModel(raw: string, text: string, target: SpeakTarget, ctx: WordCtx): Exchange | null {
  const parsed = parseReply(raw);
  if (!parsed) return null;
  const s = ctx.deps.getState(), title = titleOf(s), seed = `${text}|${Math.floor(s.day)}`;
  const v = validateActions(parsed.actions, s, text);
  const mood = MOODS.find(m => m === parsed.mood) ?? MOOD_ALIAS[squash(parsed.mood)] ?? 'neutral';
  const speaker = speakerFrom(s, parsed.speaker, target, v.actions, mood);
  const voice = voiceOf(speaker);
  let reply = cleanReply(parsed.reply, speaker, s);
  const says = v.actions.map(a => describeAction(a, s));
  const lostLine = `I could not make out what you meant by that, ${title}. Name the house or the household plainly.`;

  if (!parsed.understood) {
    return makeExchange({ text, target, speaker, reply: reply || lostLine, via: 'model', actions: [], confirm: false, idle: 'unclear' }, ctx);
  }
  if (!v.actions.length) {
    if (!v.dropped.length) return makeExchange({ text, target, speaker, reply: reply || `${title[0]!.toUpperCase()}${title.slice(1)}.`, via: 'model', actions: [], confirm: false, idle: 'done' }, ctx);
    // everything proposed was struck: what was said about doing it no longer holds
    const firm = v.dropped.find(d => d.why === 'by_hand' || d.why === 'too_much' || d.why === 'not_by_word');
    if (firm) {
      speaker.mood = 'annoyed';
      const line = firm.why === 'by_hand' ? firm.note : `${grumbleOf(s, voice, seed)} ${firm.note}`;
      return makeExchange({ text, target, speaker, reply: clip(line, 200), via: 'model', actions: [], confirm: false, idle: 'refused' }, ctx);
    }
    // the model meant something and garbled it. If the words were a plain order, the plain reading stands in.
    const plain = parseOffline(text, target, s);
    if (plain.understood && plain.moves.length) return exchangeOffline(text, target, ctx);
    const note = v.dropped.find(d => d.note)?.note;
    return makeExchange({ text, target, speaker, reply: note ? clip(`${note} Say it again, plainly.`, 200) : lostLine, via: 'model', actions: [], confirm: false, idle: 'unclear' }, ctx);
  }

  const weight = weigh(v.actions, s);
  const confirm = parsed.confirm || weight.confirm;
  if (!reply) reply = readBack(s, voice === 'tenant' ? 'herald' : voice, says, confirm, seed);
  // part of what was proposed was struck: the read-back must not claim it
  const firm = v.dropped.find(d => d.why === 'by_hand' || d.why === 'too_much');
  if (v.dropped.length) reply = clip(readBack(s, voice === 'tenant' ? 'herald' : voice, says, false, seed), 150) + ' ' + (firm?.note ?? `The rest I could not make out, ${title}.`);
  for (const w of weight.warnings) if (!/\b(swore|sworn|oath|promis|your word|vow)/i.test(reply) && reply.length + w.length < 280) reply = `${reply} ${w}`;
  if (confirm && !/\?\s*$/.test(reply)) reply = `${reply} ${pickStable(CONFIRM_ASK, seed).replace('{title}', title)}`;
  return makeExchange({ text, target, speaker, reply: tidy(reply), via: 'model', actions: v.actions, confirm, idle: 'done' }, ctx);
}

const TRANSPORT_LINE: Partial<Record<ModelErrorCode, string>> = {
  court_key: 'The court is barred to free speech, {title}: the court key is wanting or wrong. Until it is set I follow plain orders only, such as {hint}.',
  rate_limited: 'Too many words at once, {title}. The clerk\'s hand has cramped. Plain orders still reach me: {hint}.',
  denied: 'No one at court can take free speech down just now, {title}. Plain orders still reach me: {hint}.',
};
const TRANSPORT_DEFAULT = 'I lost that somewhere between the door and the table, {title}. Say it plainly and I can still act: {hint}.';

/**
 * Understand the words with no model. `failure` is set when a model was asked
 * and could not answer: a plain order still goes through; anything else comes
 * back as `error` with a graceful line in place of a dead end. `prose` is
 * what the model wrote when it wrote no JSON at all: if the ruler's words
 * were not an order and the prose is a line the listener could have said, it
 * is their answer, and nothing is done.
 */
export function exchangeOffline(text: string, target: SpeakTarget, ctx: WordCtx, failure?: ModelErrorCode, prose?: string): Exchange {
  const s = ctx.deps.getState(), title = titleOf(s);
  const res = parseOffline(text, target, s);
  const v = validateActions(res.moves.map(m => m.action), s, text);
  const actions = v.dropped.length ? [] : v.actions;
  const speaker = res.speaker === 'tenant' && res.tenantId ? tenantSpeaker(s, res.tenantId, res.mood)
    : res.speaker === 'herald' || res.speaker === 'tenant' ? heraldSpeaker(res.mood) : staffSpeaker(s, res.speaker, res.mood);
  let reply = res.reply, idle: Draft['idle'] = res.understood && !v.dropped.length ? 'done' : 'unclear';
  let via: Exchange['via'] = 'offline';
  if (v.dropped.length) reply = v.dropped.find(d => d.note)?.note ?? `I could not make that out, ${title}.`;
  if (failure && idle === 'unclear') {
    const said = failure === 'bad_response' && prose ? proseLine(prose) : null;
    const line = said ? cleanReply(said, speaker, s) : '';
    if (line) { reply = line; idle = 'done'; via = 'model'; speaker.mood = 'neutral'; }
    else {
      const hint = /"[^"]+"/.exec(res.reply)?.[0] ?? '"collect the rents"';
      reply = clip((TRANSPORT_LINE[failure] ?? TRANSPORT_DEFAULT).replace('{title}', title).replace('{hint}', hint), 220);
      idle = 'error';
    }
  }
  return makeExchange({ text, target, speaker, reply, via, actions, confirm: res.confirm, idle }, ctx);
}
