// The border scribe. Raw data in, structure out (law 2): when something is
// logged at the Marches, the scribe reads the text against the census and
// offers structure back — people it recognizes, names it does not, and the
// territory the arrival probably belongs to, derived from where the
// recognized people serve. The scribe only ever suggests: every reading is
// computed fresh from the records, nothing is stored, and the Regent
// confirms or overrules at the border.

import type { Kingdom, Person, Territory } from './types';

export interface KnownMention {
  person: Person;
  territory: Territory | null;
  /** How the person serves there: "lord of", "garrisoned in", … */
  how: string;
}

export interface ScribeReading {
  known: KnownMention[];
  /** Capitalized names in the title that the census does not know. */
  newNames: string[];
  suggestedTerritoryId: string | null;
  /** The scribe's reasoning, one plain sentence per line. */
  lines: string[];
}

/** Where a person serves, by the first record that names them: authority
 *  first (grant, keeper appointment), then service (posting, fealty). */
function serviceOf(
  kingdom: Kingdom,
  personId: string,
): { territory: Territory | null; how: string } | null {
  const territory = (id: string) =>
    kingdom.territories.find((t) => t.id === id) ?? null;
  const grant = kingdom.grants.find((g) => g.personId === personId);
  if (grant) {
    // The third case the role alone cannot tell: a `lord` grant on a CROWN
    // OFFICE seats a CHANCELLOR, not a lord — the office is not land. Read the
    // territory, not just the stored role (the role's value stays `'lord'`;
    // renaming it would be a vault migration).
    const seat = territory(grant.territoryId);
    return {
      territory: seat,
      how:
        seat?.kind === 'office'
          ? 'Chancellor of'
          : grant.role === 'lord'
            ? 'lord of'
            : 'mayor of',
    };
  }
  const appointment = kingdom.appointments.find((a) => a.personId === personId);
  if (appointment) {
    return { territory: territory(appointment.territoryId), how: 'keeper of' };
  }
  const posting = kingdom.postings.find((p) => p.personId === personId);
  if (posting) {
    return { territory: territory(posting.territoryId), how: 'garrisoned in' };
  }
  const fealty = kingdom.fealties.find((f) => f.personId === personId);
  if (fealty) {
    return { territory: territory(fealty.territoryId), how: 'sworn in' };
  }
  return null;
}

/** A capitalized given name, possibly a two-word full name. */
const NAME_SHAPE = /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/;

/** New names are read from the title only, and only when the whole title is
 *  a list of name-shaped parts ("Bram and Osgood", "Ann, Bob & Cara") — a
 *  sentence like "Roof leak reported" never qualifies. Conservative on
 *  purpose: the scribe suggests, the Regent decides. */
function readNewNames(kingdom: Kingdom, title: string): string[] {
  const parts = title
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  if (!parts.every((p) => NAME_SHAPE.test(p))) return [];
  const knownNames = new Set(kingdom.people.map((p) => p.name.toLowerCase()));
  return parts.filter((p) => !knownNames.has(p.toLowerCase()));
}

export function readArrivalText(
  kingdom: Kingdom,
  title: string,
  note?: string,
): ScribeReading {
  const text = `${title} ${note ?? ''}`;
  const known: KnownMention[] = kingdom.people
    .filter((p) => new RegExp(`\\b${p.name}\\b`, 'i').test(text))
    .map((p) => {
      const service = serviceOf(kingdom, p.id);
      return { person: p, territory: service?.territory ?? null, how: service?.how ?? '' };
    });

  const newNames = readNewNames(kingdom, title);

  // Suggest a destination only when the recognized people point one way.
  const territories = [
    ...new Map(
      known.filter((k) => k.territory != null).map((k) => [k.territory!.id, k.territory!]),
    ).values(),
  ];
  const suggested = territories.length === 1 ? territories[0] : null;

  const lines: string[] = [];
  if (newNames.length > 0) {
    lines.push(
      `${newNames.length === 1 ? 'A name' : `${newNames.length} names`} not on the census: ${newNames.join(', ')}.`,
    );
  }
  for (const k of known) {
    lines.push(
      k.territory
        ? `${k.person.name} is ${k.how} ${k.territory.name}.`
        : `${k.person.name} is on the census, with no territory on record.`,
    );
  }
  if (suggested) lines.push(`Suggested destination: ${suggested.name}.`);

  return {
    known,
    newNames,
    suggestedTerritoryId: suggested?.id ?? null,
    lines,
  };
}
