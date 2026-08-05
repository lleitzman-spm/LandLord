// Humanizing the case id — the reading that turns a machine identity into a
// name a person reads. A case id is a structured key doing double duty as a
// label: `wg/<seed> · <type> #<n> · <123 Some Street, unit D> — <Person>`. On
// the board that must read like a thing in the world, not a database row:
//
//   wg/ledger-verify · rent-billing-cycle #258 · 132 Millstone Close, unit D — Audrey the Carter
//     →  head "Monthly rent cycle" · place "132 Millstone Close #D" · who "Audrey the Carter"
//
// Nothing is stored — this folds the label fresh from the id and the loaded
// catalog (records in, readings out). The raw id rides along for detail mode.

import type { Catalog, SlaBand, WoPriority, WoStatus } from './catalog';
import { findRow, titleOf } from './catalog';

export interface CaseLabel {
  /** The primary human label — the type's title, or the complaint for raw intake. */
  head: string;
  /** The door the case sits on, tidied ("132 Millstone Close, unit D" → "132 Millstone Close #D"). */
  place?: string;
  /** The person the case names — a tenant or owner. Absent for raw intake (its tail is the complaint). */
  who?: string;
  /** The type key, resolved or raw ('intake' for untriaged tickets). */
  kind?: string;
  /** The untouched id, for detail mode and tooltips. */
  raw: string;
}

const WAR = /^.*?wg\/[^·]+ · /;
const DISCRIMINATOR = /^(d-\d+|#\d+|d-\d+ #\d+)$/;
const ADDRESS = /,\s*(unit|apt|suite|ste|#)\b/i;

/** "rent-billing-cycle" → "Rent billing cycle" — the fallback when the loaded
 *  catalog does not know the key (an off-catalog word should still read
 *  plainly, dotted leaf keys included). */
function humanize(key: string): string {
  const words = key.replace(/[-_.]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/** A catalog key resolved to its title, humanized when the loaded catalog does
 *  not know it — the clean board's fallback: a machine key never shows raw.
 *  (catalog.ts titleOf falls back to the raw key; this reading dresses it.) */
export function titleFor(catalog: Catalog, key: string | null | undefined): string {
  if (!key) return '';
  return findRow(catalog, key)?.title ?? humanize(key);
}

/** "132 Millstone Close, unit D" → "132 Millstone Close #D". */
function tidyPlace(place: string): string {
  return place.replace(/,\s*unit\s+/i, ' #').replace(/,\s*(apt|suite|ste)\s+/i, ' #');
}

/** Fold the human label from a case id and the loaded catalog. Tolerant of
 *  every shape the generator and the seat emit — it identifies segments by
 *  what they look like (an address, a discriminator, a type key) rather than
 *  hard-coding one grammar. */
export function caseLabel(caseId: string, catalog: Catalog): CaseLabel {
  const raw = caseId;
  // Drop the war mark (and any "prefix: " that rides before it), then the
  // trailing " — <name/complaint>".
  let body = caseId.replace(WAR, '');
  let tail: string | undefined;
  const em = body.lastIndexOf(' — ');
  if (em >= 0) {
    tail = body.slice(em + 3).trim();
    body = body.slice(0, em);
  }

  const segs = body
    .split(' · ')
    .map((s) => s.trim())
    .filter(Boolean);

  let place: string | undefined;
  let typeKey: string | undefined;
  for (const s of segs) {
    if (ADDRESS.test(s) || /^\d+\s+\S.*,/.test(s)) {
      place = s;
      continue;
    }
    if (DISCRIMINATOR.test(s)) continue;
    if (s === 'intake') {
      typeKey = 'intake';
      continue;
    }
    // A type key may carry a trailing discriminator ("rent-billing-cycle #258").
    const key = s.replace(/\s+#\d+$/, '').replace(/\s+d-\d+$/, '').trim();
    if (!typeKey && key) typeKey = key;
  }

  let head: string;
  let who: string | undefined;
  if (typeKey === 'intake') {
    // Raw intake: the tail IS the complaint, and that is the useful label.
    head = tail ?? 'A new report';
  } else if (typeKey) {
    head = findRow(catalog, typeKey) ? titleOf(catalog, typeKey) : humanize(typeKey);
    who = tail;
  } else {
    head = tail ?? (body || raw);
  }

  return {
    head,
    place: place ? tidyPlace(place) : undefined,
    who,
    kind: typeKey,
    raw,
  };
}

// ── The badge — a glyph and a tone for the unit-card ────────────────────────
// The Civ/Tropico reading: every kind of work wears a small per-type glyph and
// a colored chip, so a row is known at a glance before a word is read. One
// central map, keyed off the loaded catalog's domain/system facets with a
// keyword fallback for keys the catalog does not know — never scattered
// through the views. Folded fresh like everything else; nothing stored.

export interface CaseBadge {
  /** The per-type glyph — the unit's crest. */
  glyph: string;
  /** The tone class suffix the CSS colors by (tone-<tone>). */
  tone: string;
  /** The small chip's word — the catalog domain when known, else nothing. */
  chip?: string;
  /** The work-order Priority the catalog row carries (the Lane-B taxonomy), when
   *  it is a work order — so the card can wear a hot/normal/quiet pill. */
  priority?: WoPriority;
  /** The work-order Status the catalog row carries — the lifecycle stage, when
   *  the row is a work order not yet closed off the board. */
  status?: WoStatus;
  /** The SLA band the catalog row carries — the target-response class the
   *  word is held to. */
  slaBand?: SlaBand;
}

/** Domain → badge. Covers the founding alphabet and the grand muster's
 *  domains; an unknown domain falls through to the keyword read. */
const DOMAIN_BADGE: Record<string, { glyph: string; tone: string }> = {
  maintenance: { glyph: '🔧', tone: 'craft' },
  collections: { glyph: '🪙', tone: 'coin' },
  tenancy: { glyph: '🏠', tone: 'folk' },
  accounting: { glyph: '🧾', tone: 'coin' },
  'owner-accounting': { glyph: '🧾', tone: 'coin' },
  leasing: { glyph: '🔑', tone: 'lease' },
  'move-in': { glyph: '🚪', tone: 'lease' },
  'move-out': { glyph: '📦', tone: 'turn' },
  turns: { glyph: '📦', tone: 'turn' },
  renewals: { glyph: '📅', tone: 'folk' },
  compliance: { glyph: '⚖️', tone: 'law' },
  legal: { glyph: '⚖️', tone: 'law' },
  inspections: { glyph: '🔍', tone: 'survey' },
  onboarding: { glyph: '🤝', tone: 'folk' },
};

/** "domain/system" overrides where the system says more than its domain. */
const SYSTEM_BADGE: Record<string, { glyph: string; tone: string }> = {
  'maintenance/hvac': { glyph: '❄️', tone: 'craft' },
  'maintenance/plumbing': { glyph: '💧', tone: 'craft' },
  'maintenance/electrical': { glyph: '⚡', tone: 'craft' },
  'maintenance/escalation': { glyph: '🚨', tone: 'alarm' },
  'tenancy/billing': { glyph: '🪙', tone: 'coin' },
  'tenancy/collections': { glyph: '🪙', tone: 'coin' },
  'tenancy/eviction': { glyph: '⚖️', tone: 'law' },
  'compliance/eviction': { glyph: '⚖️', tone: 'law' },
};

/** The fallback for a key no loaded catalog claims: read the words themselves,
 *  most specific first. Deliberately conservative — better plain than wrong. */
const KEYWORD_BADGE: [RegExp, { glyph: string; tone: string }][] = [
  [/habitab|escalat|emergenc/, { glyph: '🚨', tone: 'alarm' }],
  [/hvac|cooling|heating/, { glyph: '❄️', tone: 'craft' }],
  [/plumb|leak/, { glyph: '💧', tone: 'craft' }],
  [/electric/, { glyph: '⚡', tone: 'craft' }],
  [/maint|work.?order|repair|vendor|appliance/, { glyph: '🔧', tone: 'craft' }],
  [/evict|legal|violation|non.?renew/, { glyph: '⚖️', tone: 'law' }],
  [/rent|delinq|collect|billing|payment|deposit/, { glyph: '🪙', tone: 'coin' }],
  [/owner|statement|draw|reserve|reconcil/, { glyph: '🧾', tone: 'coin' }],
  [/move.?out|turn/, { glyph: '📦', tone: 'turn' }],
  [/move.?in/, { glyph: '🚪', tone: 'lease' }],
  [/leas|list|showing|screen|vacan|applica/, { glyph: '🔑', tone: 'lease' }],
  [/renew/, { glyph: '📅', tone: 'folk' }],
  [/inspect|walk/, { glyph: '🔍', tone: 'survey' }],
  [/notice|compl/, { glyph: '⚖️', tone: 'law' }],
];

/** Fold the badge for a folded label. The chip is honest: it names the loaded
 *  catalog's domain facet when one exists, and stays silent otherwise. `kind`
 *  is an optional refinement — the case's event-carried catalogRow key, which
 *  is often more precise than the id's own type segment (the muster deals ids
 *  by flow shape but types the events by leaf). */
export function caseBadge(label: CaseLabel, catalog: Catalog, kind?: string | null): CaseBadge {
  if (label.kind === 'intake') return { glyph: '✉️', tone: 'plain', chip: 'intake' };
  const row = findRow(catalog, label.kind) ?? findRow(catalog, kind);
  const priority = row?.priority;
  const status = row?.status;
  const slaBand = row?.slaBand;
  if (row?.domain) {
    const sys = row.system ? SYSTEM_BADGE[`${row.domain}/${row.system}`] : undefined;
    const dom = sys ?? DOMAIN_BADGE[row.domain];
    if (dom) return { ...dom, chip: row.domain, priority, status, slaBand };
  }
  const words = `${label.kind ?? ''} ${kind ?? ''} ${label.head}`.toLowerCase();
  for (const [re, badge] of KEYWORD_BADGE) {
    if (re.test(words)) return { ...badge, chip: row?.domain, priority, status, slaBand };
  }
  return { glyph: '▣', tone: 'plain', chip: row?.domain, priority, status, slaBand };
}

// ── The spend-gate signal — a proposal note read as a chip ──────────────────
// The clerks write the owner-approval spend gate and the settlement
// reconciliation into their proposal notes ("over the $400 NTE cap — the owner's
// word is needed", "clear to pay"). This folds that line into a small chip so
// the Regent sees, at a glance on the step in hand, whether a proposal is the
// clerk's to wave through or the owner's to weigh. Pure reading off the note —
// nothing stored; the note is the record.

export interface SpendSignal {
  /** The short chip word. */
  label: string;
  /** 'warn' when the owner's word is needed (gate or overrun); 'ok' when it is
   *  within the clerk's authority / clear to pay. */
  tone: 'warn' | 'ok';
}

/** Read a clerk proposal note for its spend-gate / reconciliation signal, or
 *  null when the note carries none (an ordinary step). */
export function spendSignal(note: string | null | undefined): SpendSignal | null {
  if (!note) return null;
  if (/owner's (word|approval) is (needed|required)|needs owner approval|held for the owner/i.test(note))
    return { label: '⚠ owner approval', tone: 'warn' };
  if (/within the clerk's authority|clerk may proceed/i.test(note))
    return { label: '✓ within authority', tone: 'ok' };
  if (/clear to pay/i.test(note)) return { label: '✓ clear to pay', tone: 'ok' };
  return null;
}

// ── Seat labels — the queue ids read plainly ────────────────────────────────
// A work-holder is a person, or a queue id (`pm-desk`, `va-desk`, `lp-queue`)
// the game and the founding flows deal to. On a clean board a machine id never
// shows; the queue reads as the desk it is. Labels follow the in-repo truth
// (guilds.ts SEAT_GUILD maps each queue to its craft) — nothing invented.

const SEAT_LABEL: Record<string, string> = {
  'pm-desk': "the manager's desk",
  'va-desk': "the vendors' desk",
  'lp-queue': 'the accounting queue',
  // The reasoning clerks' own seats — the four desks the clerk layer proposes
  // from (`agent:<seat>`). Named for the work each does, in the same plain
  // words as the desks above.
  'turn-desk': 'the make-ready yard', // scopes a vacated door's turn
  'acct-desk': 'the reckoning desk', // squares a move-out deposit
  'res-desk': "the residents' parley", // hears a notice, drafts the reply
  'bd-desk': "the envoy's desk", // weighs an owner come knocking
  'col-desk': "the collector's desk", // runs the ladder on a late tithe
  'viol-desk': "the warden's desk", // grades a breach, sets the notice
  tenant: 'the tenant',
  owner: 'the owner',
};

/** A holder id read plainly: the known desks by name, a dashed key humanized,
 *  anything else (a person's already-resolved name) untouched. */
export function seatLabel(holder: string): string {
  const known = SEAT_LABEL[holder];
  if (known) return known;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(holder)) return humanize(holder);
  return holder;
}
