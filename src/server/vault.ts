// The vault's read + compare-and-set write, shared by the dev vite plugin and
// the deployed Worker so the two keyholders can never drift (the same faithful-
// reuse discipline the operator-core bundle keeps for the engine).
//
// The chronicle is one jsonb row; concurrent whole-document writers used to
// clobber (last writer wins, silent event loss — R2). The fix is optimistic
// concurrency with the version riding INSIDE the doc (`doc.rev`, a number) — no
// schema change, backward-compatible with the one pre-rev row. A write commits
// only if the stored rev still equals the base the writer read; otherwise it is
// a conflict and the caller reconciles (union the append-only streams, never
// overwrite). The domain ignores the `rev` field (normalizeChronicle drops it).

/** The version a doc carries, or 0 for the pre-rev row / a malformed value. */
export function revOf(doc: unknown): number {
  const r = (doc as { rev?: unknown } | null | undefined)?.rev;
  return typeof r === 'number' && Number.isFinite(r) ? r : 0;
}

/** The vault's canonical document — the shared founding/demo chronicle, the one
 *  the service token and the dev server read. Per-identity sandboxes take their
 *  own id (`chronicle:<email>`); see `docIdFor` in the worker. */
export const CANONICAL_DOC_ID = 'the-chronicle';

/** How the vault read distinguishes a missing row from a real failure: `absent`
 *  means the id has no row yet (a new user — the caller serves founding so the
 *  first write bootstraps it), `error` means the read itself failed. */
export type VaultRead =
  | { status: 'ok'; doc: unknown }
  | { status: 'absent' }
  | { status: 'error' };

/** Read the raw doc for `docId` (rev included), telling absent from failure.
 *  Uses an array select so zero rows is a clean empty list, not a 406. */
export async function vaultReadDoc(
  rest: string,
  headers: Record<string, string>,
  docId: string,
): Promise<VaultRead> {
  try {
    const res = await fetch(`${rest}/chronicle?id=eq.${encodeURIComponent(docId)}&select=doc`, {
      headers: { ...headers, accept: 'application/json' },
    });
    if (!res.ok) return { status: 'error' };
    const rows = (await res.json()) as { doc: unknown }[];
    return Array.isArray(rows) && rows.length > 0 ? { status: 'ok', doc: rows[0].doc } : { status: 'absent' };
  } catch {
    return { status: 'error' };
  }
}

/** Read the raw doc for `docId`, or null on absent/failure. The conflict path's
 *  reconcile source — a null there just yields an empty doc to merge into. */
export async function vaultRead(
  rest: string,
  headers: Record<string, string>,
  docId: string = CANONICAL_DOC_ID,
): Promise<unknown | null> {
  const r = await vaultReadDoc(rest, headers, docId);
  return r.status === 'ok' ? r.doc : null;
}

export type CasResult = 'ok' | 'conflict' | 'error';

/** The PostgREST filter matching the row iff its stored rev equals `base`. The
 *  jsonb-path operator is URL-encoded (`->>` → `-%3E%3E`). At base 0 the pre-rev
 *  row's rev is NULL, so match null OR 0 (the one-time bootstrap). */
export function revFilter(base: number): string {
  const path = 'doc-%3E%3Erev';
  return base === 0 ? `or=(${path}.is.null,${path}.eq.0)` : `${path}=eq.${base}`;
}

/** Compare-and-set write for `docId`: set the row's doc iff its stored rev still
 *  equals `base`. The outgoing `doc` must already carry rev = base + 1. Returns
 *  'conflict' when another writer advanced the rev first (0 rows matched).
 *
 *  At base 0 the row may not exist yet — a new identity's first write, or the
 *  pre-rev bootstrap row. So base 0 first tries to CREATE the row; a primary-key
 *  409 means it already exists, and the write falls through to the rev-gated
 *  PATCH (which matches the pre-rev NULL rev, and safely loses the race to a
 *  concurrent create — the loser gets 'conflict' and retries against the fresh
 *  rev, never overwriting). base ≥ 1 is a plain rev-gated PATCH as before. */
export async function vaultCasWrite(
  rest: string,
  headers: Record<string, string>,
  docId: string,
  doc: unknown,
  base: number,
): Promise<CasResult> {
  const id = encodeURIComponent(docId);
  try {
    if (base === 0) {
      const ins = await fetch(`${rest}/chronicle`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', prefer: 'return=representation' },
        body: JSON.stringify({ id: docId, doc }),
      });
      if (ins.ok) {
        const rows = (await ins.json()) as unknown[];
        if (Array.isArray(rows) && rows.length > 0) return 'ok';
      } else if (ins.status !== 409) {
        // A real insert failure (not a duplicate-key). Don't mask it as conflict.
        return 'error';
      }
      // 409 → the row already exists; reconcile against it via the PATCH below.
    }
    const res = await fetch(`${rest}/chronicle?id=eq.${id}&${revFilter(base)}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ doc }),
    });
    if (!res.ok) return 'error';
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0 ? 'ok' : 'conflict';
  } catch {
    return 'error';
  }
}

// ── Appending a long job's work without losing it to a conflict ────────────
//
// The clerk fleet reasons for a MINUTE before it has a single event to write,
// and the Regent's own board is live on the same document the whole time — one
// edit, or the store's own persist, moves the rev out from under it. A naive
// read-then-CAS answers that by throwing the whole minute of reasoning away
// ("the clerks could not work: the vault moved under the fleet" — Edwin hit it
// on the live castle, 2026-07-27).
//
// It never needs to. The fleet's output is pure APPEND — new events, each with
// its own id — so replaying it onto whatever the vault holds NOW is exactly
// what the client's own merge would do, and is the same answer the clerks
// already reasoned. So a conflict means re-read and re-append, never re-reason
// and never overwrite the writer that got there first.

export interface AppendDoc {
  events?: unknown[];
  [k: string]: unknown;
}

/** Commit `events` onto the document, replaying onto a fresh read whenever a
 *  concurrent writer moves the rev. `read` returns the document as it stands
 *  now (null ⇒ unreadable); `write` is the compare-and-set. Pure of transport:
 *  the Worker and the dev server both hand it their own two doors. */
export async function commitAppend({
  base,
  events,
  read,
  write,
  attempts = 4,
}: {
  /** The document the job already read — attempt one writes onto this. */
  base: AppendDoc;
  events: unknown[];
  read: () => Promise<AppendDoc | null>;
  write: (next: AppendDoc, baseRev: number) => Promise<CasResult>;
  attempts?: number;
}): Promise<CasResult> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let doc = base;
    if (attempt > 0) {
      const fresh = await read();
      if (fresh === null) return 'error';
      doc = fresh;
    }
    const next: AppendDoc = {
      ...doc,
      events: [...(doc.events ?? []), ...events],
      rev: revOf(doc) + 1,
    };
    const result = await write(next, revOf(next) - 1);
    if (result !== 'conflict') return result;
  }
  return 'conflict';
}
