// The sellsword roster — the vendor clerk's working knowledge (WRIT-TASK-LANGUAGE,
// "the full clerk fleet"; the reasoning-clerk depth). A working-fluid list of
// vendors by trade, each with a plain medieval name and a typical price band —
// enough for the va-desk reasoning clerk to CHOOSE a vendor and sanity-check a
// quote against the spend gate. NOT any firm's real vendors: when the AppFolio data
// gate opens, the firm's actual vendor list + rates load here as a setting and
// replace this. General/founding, the machine's working fluid (a sibling of
// economy's sampleLedger). Names keep the kingdom's plain-English voice
// (recognizable trade words, never glossary flavor).

/** dollars → cents, the roster's convention (the economy speaks cents). */
const d = (dollars) => Math.round(dollars * 100);

/** By trade: the sellswords who work it, each with a typical low/high the
 *  reasoning clerk quotes within (and the tool fallback picks the first). The
 *  bands straddle the founding $400 NTE cap on purpose, so the gate gates both
 *  ways on a reasoned quote, not only on the urgency band. */
export const VENDOR_ROSTER = {
  HVAC: [
    { name: 'Ser Emrick the Bellows-smith', lowCents: d(180), highCents: d(1800) },
    { name: 'Dame Ysolde the Ductwright', lowCents: d(150), highCents: d(1400) },
  ],
  plumbing: [
    { name: 'Ser Palin the Pipewright', lowCents: d(120), highCents: d(1600) },
    { name: 'Goodwife Bree the Drain-clearer', lowCents: d(90), highCents: d(700) },
  ],
  appliance: [
    { name: 'Osha the Tinker', lowCents: d(110), highCents: d(900) },
    { name: 'Ser Cade the Whitegood-wright', lowCents: d(130), highCents: d(1100) },
  ],
  electrical: [
    { name: 'Ser Dunstan the Spark-wright', lowCents: d(160), highCents: d(2000) },
  ],
  roofing: [
    { name: 'Ser Alder the Roof-wright', lowCents: d(400), highCents: d(4200) },
  ],
  general: [
    { name: 'Toby the Handyman', lowCents: d(80), highCents: d(600) },
    { name: 'Ser Fix the Artisan', lowCents: d(120), highCents: d(900) },
  ],
};

/** The sellswords for a trade — the trade's own roster, else the general hands.
 *  Case-tolerant on the trade key (the catalog says 'HVAC', a setting may vary). */
export function rosterTrade(trade) {
  if (!trade) return 'general';
  return (
    Object.keys(VENDOR_ROSTER).find(
      (key) => key.toLowerCase() === String(trade).toLowerCase(),
    ) ?? 'general'
  );
}

export function rosterFor(trade) {
  return VENDOR_ROSTER[rosterTrade(trade)];
}

/** A sane sellsword's fee, in cents — the working-fluid clamp that catches a
 *  brain's runaway quote before it reaches the gate. $40 floor, $8,000 ceiling. */
export function clampFeeCents(cents) {
  const floor = d(40);
  const ceil = d(8000);
  if (!Number.isFinite(cents)) return null;
  return Math.min(ceil, Math.max(floor, Math.round(cents)));
}

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid: it
 *  lets the invoice vary per case reproducibly (no Math.random, so a verify run
 *  is stable). */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** The invoice a vendor actually submits against an authorized quote — the WORLD's
 *  fact the settlement clerk reconciles, NOT the clerk's judgment. Working-fluid:
 *  most jobs bill at or near the quote, ~1 in 3 run over (10–55%) for unforeseen
 *  work. Deterministic per case. When the data gate opens, the real invoice
 *  from the vendor bill replaces this. */
export function invoiceFor(authorizedCents, caseId) {
  const f = caseFraction(caseId);
  if (f < 0.34) {
    const overrun = 0.1 + (f / 0.34) * 0.45; // 10%–55% over
    return Math.round(authorizedCents * (1 + overrun));
  }
  const drift = ((f - 0.34) / 0.66) * 0.08 - 0.04; // −4%…+4% around the quote
  return Math.max(d(40), Math.round(authorizedCents * (1 + drift)));
}
