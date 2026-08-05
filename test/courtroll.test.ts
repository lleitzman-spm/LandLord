// The court roll's law: ONE-SIDED TRANSPARENCY (Edwin, 2026-07-27 — "keep in
// mind the one sided transparency/subordination. Nothing is *private* from the
// King").
//
// This is the first surface in LandLord that crosses between identities, so it
// is the first place a leak is possible at all. Every other table is walled off
// per-user by construction; this one is walled off by a rule, and a rule is
// only as good as its tests. So the law is tested from BOTH sides: that the
// Crown sees everything, and that a subject sees nothing but their own.
import { describe, it, expect } from 'vitest';
import {
  dockedOrder,
  mayAnswer,
  mayHoldCourt,
  maySubmit,
  parsePetition,
  petitionerOf,
  sovereigns,
  visibleTo,
  MAX_ASKS,
  MAX_SUBJECT,
  type CourtRollRow,
} from '../src/server/courtroll';

const row = (over: Partial<CourtRollRow> = {}): CourtRollRow => ({
  id: over.id ?? 'm1',
  realm: 'the-realm',
  submitted_by: over.submitted_by ?? 'mabel@example.com',
  subject: over.subject ?? 'A door in trouble',
  asks: over.asks ?? 'Asks the Crown for a word.',
  submitted_at: over.submitted_at ?? '2026-07-27T10:00:00.000Z',
  queued_at: over.queued_at ?? null,
  heard_at: over.heard_at ?? null,
  heard_by: over.heard_by ?? null,
  answer: over.answer ?? null,
});

const CROWN = sovereigns('steward@example.com');
const king = petitionerOf('steward@example.com', CROWN);
const mabel = petitionerOf('mabel@example.com', CROWN);
const osric = petitionerOf('osric@example.com', CROWN);
const nobody = petitionerOf(null, CROWN);

const ROLL = [
  row({ id: 'a', submitted_by: 'mabel@example.com' }),
  row({ id: 'b', submitted_by: 'osric@example.com' }),
  row({ id: 'c', submitted_by: 'steward@example.com' }),
  row({ id: 'd', submitted_by: 'mabel@example.com', heard_at: '2026-07-27T12:00:00.000Z' }),
];

describe('the court roll — nothing is private from the King', () => {
  it('the Crown sees EVERY matter, from every petitioner, answered or standing', () => {
    const seen = visibleTo(king, ROLL);
    expect(seen).toHaveLength(ROLL.length);
    expect(new Set(seen.map((r) => r.submitted_by)).size).toBe(3);
    // Including who brought it and every word of it — no redaction, ever.
    for (const r of seen) {
      expect(r.submitted_by).toBeTruthy();
      expect(r.asks).toBeTruthy();
    }
  });

  it('a subject sees ONLY their own — never another subject’s matter', () => {
    const seen = visibleTo(mabel, ROLL);
    expect(seen.map((r) => r.id).sort()).toEqual(['a', 'd']);
    expect(seen.every((r) => r.submitted_by === 'mabel@example.com')).toBe(true);
    // Osric's matter is not merely hidden from the list — it is not there.
    expect(JSON.stringify(seen)).not.toContain('osric@example.com');
  });

  it('a subject cannot see the CROWN’s own matters either — the roll is one-sided', () => {
    expect(visibleTo(osric, ROLL).map((r) => r.id)).toEqual(['b']);
  });

  it('an unnamed request (the service token) sees nothing at all', () => {
    expect(visibleTo(nobody, ROLL)).toEqual([]);
    expect(maySubmit(nobody)).toBe(false);
    expect(mayAnswer(nobody)).toBe(false);
  });

  it('FAILS CLOSED: with no sovereign configured, no one is crowned', () => {
    const none = sovereigns(undefined);
    const wouldBeKing = petitionerOf('steward@example.com', none);
    expect(wouldBeKing.sovereign).toBe(false);
    expect(mayAnswer(wouldBeKing)).toBe(false);
    expect(mayHoldCourt(wouldBeKing)).toBe(false);
    // ...and they fall back to a subject's own view, not to everything.
    expect(visibleTo(wouldBeKing, ROLL).map((r) => r.id)).toEqual(['c']);
    expect(sovereigns('').size).toBe(0);
  });

  it('the Crown is recognised however the wall cased the email', () => {
    const crown = sovereigns('  Steward@example.com , other@example.org ');
    expect(petitionerOf('steward@example.com', crown).sovereign).toBe(true);
    expect(petitionerOf('  STEWARD@example.com  ', crown).sovereign).toBe(true);
    expect(petitionerOf('mabel@example.com', crown).sovereign).toBe(false);
  });

  it('any named identity may petition; only the Crown may answer or hold court', () => {
    expect(maySubmit(mabel)).toBe(true);
    expect(maySubmit(king)).toBe(true); // the Crown may put a matter to its own court
    expect(mayAnswer(mabel)).toBe(false);
    expect(mayHoldCourt(mabel)).toBe(false);
    expect(mayAnswer(king)).toBe(true);
    expect(mayHoldCourt(king)).toBe(true);
  });

  it('a petition is validated at the door — nothing half-accepted, nothing unbounded', () => {
    expect(parsePetition({ subject: 'A door', asks: 'A word.' })).toMatchObject({ ok: true, queued: false });
    expect(parsePetition({ subject: 'A door', asks: 'A word.', queued: true })).toMatchObject({ queued: true });
    expect(parsePetition({ subject: '  ', asks: 'A word.' }).ok).toBe(false);
    expect(parsePetition({ subject: 'A door', asks: '   ' }).ok).toBe(false);
    expect(parsePetition(null).ok).toBe(false);
    expect(parsePetition('a petition').ok).toBe(false);
    expect(parsePetition({ subject: 'x'.repeat(MAX_SUBJECT + 1), asks: 'A word.' }).ok).toBe(false);
    expect(parsePetition({ subject: 'A door', asks: 'x'.repeat(MAX_ASKS + 1) }).ok).toBe(false);
    // The petitioner never names themselves — the wall does. A forged
    // submitted_by is simply not read.
    const p = parsePetition({ subject: 'A door', asks: 'A word.', submitted_by: 'steward@example.com' });
    expect(Object.keys(p)).not.toContain('submitted_by');
  });

  it('the docket hears those standing in the hall first, then the longest wait', () => {
    const queuedLate = row({ id: 'q', submitted_at: '2026-07-27T18:00:00.000Z', queued_at: '2026-07-27T18:01:00.000Z' });
    const waitingLong = row({ id: 'w', submitted_at: '2026-07-01T09:00:00.000Z' });
    const answered = row({ id: 'x', submitted_at: '2026-06-01T09:00:00.000Z', heard_at: '2026-06-02T09:00:00.000Z' });
    const order = dockedOrder([answered, waitingLong, queuedLate]).map((r) => r.id);
    // Queued first (they are in the hall), then the longest-waiting, and an
    // answered matter falls to the back — it is history, not a docket.
    expect(order).toEqual(['q', 'w', 'x']);
  });

  it('the law is TOTAL — every petitioner is either the Crown or sees only their own', () => {
    // A property, not an example: for any roll and any identity, a non-sovereign
    // sees exactly the rows they submitted. Nothing leaks through an edge.
    const identities = ['mabel@example.com', 'osric@example.com', 'piers@example.com', ''];
    const roll = identities.flatMap((id, i) => (id ? [row({ id: `r${i}`, submitted_by: id })] : []));
    for (const id of identities) {
      const who = petitionerOf(id, CROWN);
      const seen = visibleTo(who, roll);
      if (who.sovereign) continue;
      expect(seen.every((r) => r.submitted_by === who.identity)).toBe(true);
      expect(seen).toHaveLength(roll.filter((r) => r.submitted_by === who.identity).length);
    }
  });
});
