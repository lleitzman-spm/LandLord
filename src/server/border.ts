// The border book. When the Regent one day appoints an outside producer
// (email → arrivals, or any other), it never touches the chronicle doc —
// that is a whole-document write, last writer wins, and a foreign hand
// would clobber the book. Instead the producer drops rows into the vault's
// border_arrivals table, and the keyholder alone reconciles them: on every
// read it folds unabsorbed rows into the doc's arrivals, and once a written
// doc carries a row it marks that row absorbed so it retires from the
// merge. Everything is keyed by id, so the fold is idempotent — a failed
// absorb only means a harmless retry on the next write. Shared by the two
// keyholders: vite.config.ts (dev) and src/worker.ts (deployed).

export interface BorderRow {
  id: string;
  title: string;
  note: string | null;
  arrived_on: string;
}

/** Unabsorbed rows waiting at the border, oldest first. Null when the book
 *  refuses or cannot be reached — the doc must still be served without it. */
export async function fetchBorderRows(
  restUrl: string,
  headers: Record<string, string>,
): Promise<BorderRow[] | null> {
  try {
    const res = await fetch(
      `${restUrl}/border_arrivals?absorbed_at=is.null&select=id,title,note,arrived_on&order=logged_at.asc`,
      { headers },
    );
    if (!res.ok) return null;
    return (await res.json()) as BorderRow[];
  } catch {
    return null;
  }
}

/** Fold border rows into the doc's arrivals, skipping any id the doc
 *  already carries. Leaves every other shelf of the doc untouched; returns
 *  the doc as-is when there is nothing to fold in. */
export function mergeBorderArrivals(rawDoc: unknown, rows: BorderRow[]): unknown {
  if (rows.length === 0) return rawDoc;
  const doc = { ...((rawDoc ?? {}) as Record<string, unknown>) };
  const marches = { ...((doc.marches ?? {}) as Record<string, unknown>) };
  const arrivals = Array.isArray(marches.arrivals) ? [...marches.arrivals] : [];
  const carried = new Set(
    arrivals.map((a) => (a as { id?: unknown } | null)?.id).filter((id) => typeof id === 'string'),
  );
  for (const row of rows) {
    if (carried.has(row.id)) continue;
    arrivals.push({
      id: row.id,
      title: row.title,
      ...(row.note ? { note: row.note } : {}),
      arrivedOn: row.arrived_on,
    });
  }
  marches.arrivals = arrivals;
  doc.marches = marches;
  return doc;
}

/** The arrival ids a written doc carries — the rows it can absorb. */
export function carriedArrivalIds(rawDoc: unknown): string[] {
  const doc = (rawDoc ?? {}) as { marches?: { arrivals?: unknown } };
  const arrivals = doc.marches?.arrivals;
  if (!Array.isArray(arrivals)) return [];
  return arrivals
    .map((a) => (a as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === 'string');
}

// Border rows are keyed by uuid (the table says so); only uuid-shaped ids
// can name one, and only such ids are safe to splice into a filter.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark absorbed every unabsorbed border row the written doc carries.
 *  Best-effort: false means the rows stay live and simply fold in again on
 *  the next read — nothing is lost, the retry is free. */
export async function absorbBorderRows(
  restUrl: string,
  headers: Record<string, string>,
  carriedIds: string[],
  absorbedAt: string,
): Promise<boolean> {
  const ids = carriedIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return true;
  try {
    const res = await fetch(
      `${restUrl}/border_arrivals?absorbed_at=is.null&id=in.(${ids.join(',')})`,
      {
        method: 'PATCH',
        headers: { ...headers, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify({ absorbed_at: absorbedAt }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
