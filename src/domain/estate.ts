// The estate roster — a loadable book of real properties, the stable identity
// that per-estate spend caps and fee rules key on (docs/WRIT-ECONOMY.md, the
// gate). LandLord holds the machinery; the real properties load attended, the
// same way the catalog and the economy chart do — so no real address ever lives
// in this repo's code. `id` is the stable slug every surface keys on
// (`MoneyEvent.estateId`, `KingdomEvent.estateId`, `estateSpendCaps`, a
// per-estate `FeeRule`); `label` is the human address, for display only.
//
// Founding is EMPTY on purpose: the working-fluid grand muster carries its own
// synthetic estate ids inline (a door's address), so it needs no roster. The
// book exists purely as the attended landing zone for the real `{id,label}`
// rows — the leash, exactly like `economySetting.ts`'s synthesized-only header.

export interface EstateRecord {
  /** The stable estate slug — the key `estateSpendCaps`, a per-estate `FeeRule`,
   *  a case's `estateId`, and a money event's `estateId` all share. Never a real
   *  address in code; the real slugs load attended. */
  id: string;
  /** The human label (the property's address/name), for display only. */
  label: string;
}

export type EstateBook = EstateRecord[];

/** The founding roster: EMPTY. The synthetic muster keys on inline door
 *  addresses; the real roster loads attended into this shelf. */
export const FOUNDING_ESTATES: EstateBook = [];

/** True when the estate roster is still at its founding (empty) — one clause of
 *  `isFoundingChronicle`, mirroring `catalogAtFounding`. */
export function estatesAtFounding(estates: EstateBook): boolean {
  return estates.length === 0;
}

/** An estate's human label by its stable id — falls back to the raw id when the
 *  roster does not name it (the `titleOf` fallback pattern: a reading never
 *  rejects a record just because its roster row is missing). */
export function estateLabel(estates: EstateBook, id: string | null | undefined): string {
  if (!id) return '';
  return estates.find((e) => e.id === id)?.label ?? id;
}

export type EstateBookParse = { ok: true; roster: EstateBook } | { ok: false; error: string };

/** Read a pasted estate roster — the attended gate the real property list pours
 *  through (the `parseEconomySetting` pattern: validate hard at the door, so a
 *  malformed paste is refused with a plain reason and nothing half-loads).
 *  Accepts a JSON array of `{id, label}` rows; ids must be non-empty, unique
 *  text (the stable slugs everything keys on), labels non-empty text (the
 *  human address). Unknown fields on a row are refused rather than silently
 *  dropped — a typo'd field name should be heard, not swallowed. */
export function parseEstateBook(text: string): EstateBookParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON — paste a JSON array of {"id", "label"} rows.' };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'The roster must be a JSON array of {"id", "label"} rows.' };
  }
  const roster: EstateBook = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      return { ok: false, error: `Row ${i + 1} is not an object — each row is {"id", "label"}.` };
    }
    const r = row as Record<string, unknown>;
    for (const k of Object.keys(r)) {
      if (k !== 'id' && k !== 'label') {
        return { ok: false, error: `Row ${i + 1} carries an unknown field "${k}" — only "id" and "label" are read.` };
      }
    }
    if (typeof r.id !== 'string' || !r.id.trim()) {
      return { ok: false, error: `Row ${i + 1} needs a non-empty "id" — the stable slug caps and cases key on.` };
    }
    if (typeof r.label !== 'string' || !r.label.trim()) {
      return { ok: false, error: `Row ${i + 1} ("${r.id}") needs a non-empty "label" — the human address.` };
    }
    const id = r.id.trim();
    if (seen.has(id)) {
      return { ok: false, error: `The id "${id}" appears twice — every estate's slug must be unique.` };
    }
    seen.add(id);
    roster.push({ id, label: r.label.trim() });
  }
  return { ok: true, roster };
}
