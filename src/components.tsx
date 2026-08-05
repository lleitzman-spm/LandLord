import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FiefState, HamletState, Person, Territory } from './domain/types';
import type { Catalog } from './domain/catalog';
import { PRIORITY_LABEL, PRIORITY_MARK } from './domain/catalog';
import { caseBadge, caseLabel } from './domain/caselabel';
import { useDetail } from './detail';
import { useNav } from './nav';

export const PLEDGE_LABEL: Record<Person['pledge'], string> = {
  king: 'King',
  steward: 'Regent',
  vassal: 'Vassal',
  squire: 'Squire',
  sellsword: 'Artisan',
};

/** What each pledge means, in a breath — the Census's fine print. Kept beside
 *  the labels rather than inside a panel, so the glossary outlives whichever
 *  surface is showing it. */
export const PLEDGE_HINT: Record<Person['pledge'], string> = {
  king: 'The sovereign. The kingdom is his.',
  steward: 'Administers the kingdom for the King. Catch-basin for everything undelegated.',
  vassal:
    'An internal subject — a Chancellor of a craft, or an agent who may hold land by grant.',
  squire: 'Pledged to a person, not a fief. Travels with their knight.',
  sellsword:
    'A hand from an outside guild — a trade the Crown does not staff. Works the land, can even keep it, can never hold it.',
};

export const PLEDGE_ORDER: Person['pledge'][] = [
  'king',
  'steward',
  'vassal',
  'squire',
  'sellsword',
];

export function StateDot({ state }: { state: FiefState | HamletState }) {
  return <span className={`dot dot-${state}`} aria-hidden="true" />;
}

/** A person's name anywhere in the court opens their page. */
export function PersonChip({ person, role }: { person: Person; role?: string }) {
  const nav = useNav();
  return (
    <button
      type="button"
      className={`chip chip-${person.pledge}`}
      title={person.note}
      onClick={() => nav.goToPerson(person.id)}
    >
      <strong>{person.name}</strong>
      <em>{role ?? PLEDGE_LABEL[person.pledge]}</em>
    </button>
  );
}

/** A case id rendered as a name in the world, not a database row: a per-type
 *  glyph, the type's title, the door, and the person. Clean by default; in
 *  detail mode the raw id shows beneath. The full id always rides in the
 *  tooltip. With `card` it reads as a unit-card — glyph on a tinted square,
 *  the type as a small colored chip, the door and person a quiet subtitle. */
export function CaseName({
  caseId,
  catalog,
  card,
  kind,
}: {
  caseId: string;
  catalog: Catalog;
  card?: boolean;
  /** The case's event-carried catalogRow key — refines the badge when the id's
   *  own type segment is coarser than the leaf (the muster's typed deals). */
  kind?: string | null;
}) {
  const detail = useDetail();
  const l = caseLabel(caseId, catalog);
  const b = caseBadge(l, catalog, kind);
  if (card) {
    return (
      <span className="casename casecard" title={l.raw}>
        <span className={`cn-g tone-${b.tone}`} aria-hidden="true">
          {b.glyph}
        </span>
        <span className="cn-body">
          <span className="cn-head">
            <strong>{l.head}</strong>
            {b.chip && <span className={`cn-chip tone-${b.tone}`}>{b.chip}</span>}
            {b.priority && (
              <span className={`cn-pri pri-${b.priority}`} title={`${PRIORITY_LABEL[b.priority]} priority`}>
                {PRIORITY_MARK[b.priority]} {PRIORITY_LABEL[b.priority]}
              </span>
            )}
          </span>
          {(l.place || l.who) && (
            <span className="cn-sub">{[l.place, l.who].filter(Boolean).join(' · ')}</span>
          )}
          {detail && <span className="casename-raw">{l.raw}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="casename" title={l.raw}>
      <span className={`cn-g cn-g-sm tone-${b.tone}`} aria-hidden="true">
        {b.glyph}
      </span>{' '}
      <strong>{l.head}</strong>
      {l.place && <span className="casename-at"> · {l.place}</span>}
      {l.who && <span className="casename-who"> · {l.who}</span>}
      {detail && <span className="casename-raw"> · {l.raw}</span>}
    </span>
  );
}

/** Explainer / teaching prose. Hidden in clean mode (the game shows, it does
 *  not lecture); revealed in detail mode. The knowledge is never lost — it is
 *  one flip away. */
export function Explain({ children, className }: { children: ReactNode; className?: string }) {
  const detail = useDetail();
  if (!detail) return null;
  return <p className={className ?? 'fine'}>{children}</p>;
}

/** An inline link-styled button for names within prose. */
export function InlineLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="link" onClick={onClick}>
      {children}
    </button>
  );
}

/** Display name for a territory; hamlets carry their fief's name. */
export function territoryLabel(territories: Territory[], id: string): string {
  const t = territories.find((x) => x.id === id);
  if (!t) return id;
  if (t.kind === 'hamlet' && t.parentId) {
    const parent = territories.find((x) => x.id === t.parentId);
    return parent ? `${parent.name} ↳ ${t.name}` : t.name;
  }
  return t.name;
}

/** A deliberate act, offered where its record would stand (design law 6):
 *  pick a person, press the verb, and the record is made. */
export function ActForm({
  label,
  people,
  verb,
  onAct,
}: {
  label: string;
  people: Person[];
  verb: string;
  onAct: (personId: string) => void;
}) {
  const [personId, setPersonId] = useState('');
  return (
    <form
      className="arrival-form act-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!personId) return;
        onAct(personId);
        setPersonId('');
      }}
    >
      <select
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        aria-label={label}
      >
        <option value="">{label}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.pledge === 'steward' ? ' (the Regent)' : ''}
            {p.pledge === 'sellsword' ? ' (artisan)' : ''}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!personId}>
        {verb}
      </button>
    </form>
  );
}
