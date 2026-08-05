// The court roll — the realm's first shared surface, and the law that governs
// who may see what on it (Edwin, 2026-07-27).
//
// Every identity behind the wall keeps its own isolated vault, so until now no
// user could see another's realm at all. Court needs exactly one crossing of
// that line, and Edwin named its shape: **one-sided transparency**. A subject
// may submit a matter and see their own; **nothing is private from the King**.
//
// THE LAW, stated once so it can be tested once:
//
//   1. The sovereign sees EVERY row of the roll — every petitioner, every word,
//      answered or standing. There is no hidden matter, no private channel, no
//      redaction. This is a subordination, not a partnership.
//   2. A subject sees ONLY the matters they themselves submitted, and the
//      Crown's answer to them. Never another subject's matter; never the docket.
//   3. Any authenticated identity may submit, and may ask to be heard while
//      court sits.
//   4. Only the sovereign may answer a matter, or open and close the court.
//
// The law lives HERE, pure and total, rather than being spelled out at each
// route — a visibility rule copied into three handlers is a rule that will be
// enforced in two of them. The worker holds the vault key and calls it.

export interface CourtRollRow {
  id: string;
  realm: string;
  submitted_by: string;
  subject: string;
  asks: string;
  submitted_at: string;
  queued_at: string | null;
  heard_at: string | null;
  heard_by: string | null;
  answer: string | null;
}

/** Who is asking, as the wall knows them. A request with no Access identity
 *  (the service token) is nobody: it may read nothing and submit nothing. */
export type Petitioner = { identity: string | null; sovereign: boolean };

/** The identities that hold the Crown, from the worker's `SOVEREIGN_EMAILS`
 *  (comma-separated, any casing). Empty ⇒ NO ONE is sovereign, which fails
 *  CLOSED: the roll shows each subject only their own, and no one can answer.
 *  A misconfigured secret must never accidentally crown someone. */
export function sovereigns(configured: string | undefined): Set<string> {
  return new Set(
    (configured ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Read the petitioner off the request the wall authenticated. */
export function petitionerOf(email: string | null | undefined, crown: Set<string>): Petitioner {
  const identity = email?.trim().toLowerCase() || null;
  return { identity, sovereign: identity != null && crown.has(identity) };
}

/** THE LAW (1) and (2): what this petitioner may see of the roll.
 *  The sovereign sees all; a subject sees only their own; nobody sees nothing. */
export function visibleTo(who: Petitioner, rows: CourtRollRow[]): CourtRollRow[] {
  if (who.sovereign) return rows;
  if (!who.identity) return [];
  return rows.filter((r) => r.submitted_by === who.identity);
}

/** THE LAW (3): may this petitioner put a matter before the court? Any
 *  authenticated identity may — including the sovereign, who may put a matter
 *  to their own court. A request with no identity may not. */
export function maySubmit(who: Petitioner): boolean {
  return who.identity != null;
}

/** THE LAW (4): only the Crown answers a matter, or opens and closes court. */
export function mayAnswer(who: Petitioner): boolean {
  return who.sovereign;
}
export const mayHoldCourt = mayAnswer;

/** A matter as the petitioner submitted it, validated at the door. Refuses
 *  rather than half-accepting: an empty petition is not a petition, and the
 *  roll is a shared surface, so nothing unbounded is written to it. */
export const MAX_SUBJECT = 120;
export const MAX_ASKS = 2000;

export function parsePetition(
  body: unknown,
): { ok: true; subject: string; asks: string; queued: boolean } | { ok: false; why: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, why: 'no petition was sent' };
  const b = body as { subject?: unknown; asks?: unknown; queued?: unknown };
  const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
  const asks = typeof b.asks === 'string' ? b.asks.trim() : '';
  if (!subject) return { ok: false, why: 'a matter must name its subject' };
  if (!asks) return { ok: false, why: 'a matter must say what it asks' };
  if (subject.length > MAX_SUBJECT) return { ok: false, why: `the subject runs past ${MAX_SUBJECT} letters` };
  if (asks.length > MAX_ASKS) return { ok: false, why: `the asking runs past ${MAX_ASKS} letters` };
  return { ok: true, subject, asks, queued: b.queued === true };
}

/** The order the Crown hears them in: those queued to be heard live first
 *  (they are standing in the hall), then the longest-waiting. Answered matters
 *  fall to the back — they are history, not a docket. */
export function dockedOrder(rows: CourtRollRow[]): CourtRollRow[] {
  return [...rows].sort((a, b) => {
    const heard = Number(a.heard_at != null) - Number(b.heard_at != null);
    if (heard !== 0) return heard;
    const queued = Number(b.queued_at != null) - Number(a.queued_at != null);
    if (queued !== 0) return queued;
    return a.submitted_at < b.submitted_at ? -1 : a.submitted_at > b.submitted_at ? 1 : 0;
  });
}

// ── The vault door ────────────────────────────────────────────────────────
// Plain REST against the roll. The worker alone holds the key; RLS is on with
// no policies, so nothing else can reach this table at all.

const REALM = 'the-realm';

export async function fetchRoll(
  rest: string,
  headers: Record<string, string>,
  realm = REALM,
): Promise<CourtRollRow[] | null> {
  try {
    const res = await fetch(
      `${rest}/court_roll?realm=eq.${encodeURIComponent(realm)}&select=*&order=submitted_at.asc`,
      { headers },
    );
    if (!res.ok) return null;
    return (await res.json()) as CourtRollRow[];
  } catch {
    return null;
  }
}

export async function submitPetition(
  rest: string,
  headers: Record<string, string>,
  petition: { submitted_by: string; subject: string; asks: string; queued: boolean },
  realm = REALM,
): Promise<CourtRollRow | null> {
  try {
    const res = await fetch(`${rest}/court_roll`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({
        realm,
        submitted_by: petition.submitted_by,
        subject: petition.subject,
        asks: petition.asks,
        queued_at: petition.queued ? new Date().toISOString() : null,
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as CourtRollRow[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function answerMatter(
  rest: string,
  headers: Record<string, string>,
  id: string,
  by: string,
  answer: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${rest}/court_roll?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ heard_at: new Date().toISOString(), heard_by: by, answer }),
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export interface CourtSession {
  open: boolean;
  opened_at: string | null;
  opened_by: string | null;
}

export async function fetchSession(
  rest: string,
  headers: Record<string, string>,
  realm = REALM,
): Promise<CourtSession | null> {
  try {
    const res = await fetch(
      `${rest}/court_session?realm=eq.${encodeURIComponent(realm)}&select=open,opened_at,opened_by`,
      { headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as CourtSession[];
    return rows[0] ?? { open: false, opened_at: null, opened_by: null };
  } catch {
    return null;
  }
}

export async function setSession(
  rest: string,
  headers: Record<string, string>,
  open: boolean,
  by: string,
  realm = REALM,
): Promise<boolean> {
  try {
    const res = await fetch(`${rest}/court_session?realm=eq.${encodeURIComponent(realm)}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({
        open,
        opened_at: open ? new Date().toISOString() : null,
        opened_by: open ? by : null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
