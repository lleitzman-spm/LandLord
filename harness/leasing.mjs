// The leasing knowledge — the leasing clerk's working fluid (WRIT-TASK-LANGUAGE,
// the third reasoning seat, following the va-desk vendor clerk and the lp-queue
// price clerk). A working-fluid market-rent baseline and the renewal / vacancy
// MOVES the osric clerk chooses among — enough to price a renewal (hold, raise, or
// a concession to keep a good tenant) or set a vacant door's ask, so the clerk can
// then read the economy's leasing/renewal FEE RULES against the reasoned rent.
//
// NOT any firm's real rents, comps, or renewal matrix: when the AppFolio data gate
// opens, the firm's actual rent roll + renewal policy load here as a setting and
// replace this — the twin of how vendors.mjs's roster gives way to the real vendor
// list. General/founding, the machine's working fluid (a sibling of the vendor
// roster and economy's sampleLedger). Names and labels keep the kingdom's plain-
// English voice.

/** dollars → cents, the leasing convention (the economy speaks cents). */
const d = (dollars) => Math.round(dollars * 100);

/** The working-fluid market rent for a door (~the founding RENT_PER_DOOR of
 *  $1,500). A door's own current rent spreads around this; the real rent roll
 *  loads at the gate. */
export const MARKET_RENT_CENTS = d(1500);

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid: it
 *  lets a door's rent vary reproducibly (no Math.random, so a verify run is
 *  stable). The twin of vendors.mjs's caseFraction. */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** A sane monthly rent, in cents — the clamp that catches a brain's runaway number
 *  before it reaches the fee reading. $200 floor, $20,000 ceiling. */
export function clampRentCents(cents) {
  const floor = d(200);
  const ceil = d(20000);
  if (!Number.isFinite(cents)) return null;
  return Math.min(ceil, Math.max(floor, Math.round(cents)));
}

/** The door's current monthly rent — a working-fluid spread around market (±12%),
 *  stable per case. What a renewal raises from, and roughly where a vacancy
 *  re-lists. The real rent roll replaces this at the gate. */
export function baseRentCents(caseId) {
  const f = caseFraction(caseId);
  const spread = (f - 0.5) * 0.24; // −12%…+12% around market
  return clampRentCents(Math.round(MARKET_RENT_CENTS * (1 + spread)));
}

/** The renewal moves the clerk weighs — hold a good tenant, a modest raise, a
 *  raise toward market, or a concession to retain. `deltaBps` applies to the
 *  door's current rent. The bands straddle a hold on purpose, so the renewal-fee
 *  reading and the owner's return both read sensibly either way. */
export const RENEWAL_MOVES = [
  { key: 'hold', label: 'hold the rent', deltaBps: 0 },
  { key: 'raise-modest', label: 'a modest raise', deltaBps: 300 },
  { key: 'raise-market', label: 'raise toward market', deltaBps: 600 },
  { key: 'concession', label: 'a concession to retain', deltaBps: -200 },
];

/** The vacancy moves the clerk weighs on a door to re-list — list at market, ask a
 *  premium, or grant a concession to fill a door that would otherwise sit.
 *  `deltaBps` applies to the door's market rent. */
export const VACANCY_MOVES = [
  { key: 'market', label: 'list at market', deltaBps: 0 },
  { key: 'premium', label: 'ask a premium', deltaBps: 300 },
  { key: 'concession', label: 'a concession to fill faster', deltaBps: -300 },
];

/** The move menu for a commitment mode ('renewal' | 'vacancy'). */
export function movesFor(mode) {
  return mode === 'vacancy' ? VACANCY_MOVES : RENEWAL_MOVES;
}

/** A move by its key within a mode, or null (an unknown key → the caller's
 *  deterministic fallback). */
export function moveByKey(mode, key) {
  if (!key) return null;
  return movesFor(mode).find((m) => m.key === key) ?? null;
}

/** Apply a move to a base rent → the resulting monthly rent in cents (clamped). */
export function applyMove(baseCents, move) {
  return clampRentCents(Math.round(baseCents * (1 + (move?.deltaBps ?? 0) / 10000)));
}
