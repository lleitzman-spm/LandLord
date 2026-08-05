// The court roll, from the app's side — the one shared surface, spoken to
// through /api/court (the worker alone holds the key and enforces the law).
//
// One-sided transparency, as the wall reports it: the answer says whether THIS
// identity is the sovereign, and carries only what they are permitted to see.
// The app never decides that; it renders what the door returns. A UI that
// filtered for itself would be a second copy of the law — and the copy that
// drifts is the one that leaks.

import { useCallback, useEffect, useState } from 'react';

export interface RollMatter {
  id: string;
  submitted_by: string;
  subject: string;
  asks: string;
  submitted_at: string;
  queued_at: string | null;
  heard_at: string | null;
  heard_by: string | null;
  answer: string | null;
}

export interface CourtRoll {
  /** True when the wall's identity holds the Crown. */
  sovereign: boolean;
  /** Who the wall says you are — null in dev, or behind no wall. */
  identity: string | null;
  court: { open: boolean; opened_at: string | null; opened_by: string | null };
  /** What you may see: everything, if you are the Crown; else your own. */
  matters: RollMatter[];
}

const EMPTY: CourtRoll = {
  sovereign: false,
  identity: null,
  court: { open: false, opened_at: null, opened_by: null },
  matters: [],
};

export interface CourtActions {
  roll: CourtRoll;
  /** Null while the roll has never answered — the door may not be there (dev). */
  reachable: boolean;
  refresh: () => void;
  petition: (subject: string, asks: string, queued: boolean) => Promise<string | null>;
  answer: (id: string, answer: string) => Promise<string | null>;
  hold: (open: boolean) => Promise<string | null>;
}

/** The roll, read fresh. Polled while court sits so a petition raised in the
 *  hall reaches the Crown without a reload — the office-hours signal. */
export function useCourtRoll(): CourtActions {
  const [roll, setRoll] = useState<CourtRoll>(EMPTY);
  const [reachable, setReachable] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch('/api/court');
        if (!res.ok) {
          setReachable(false);
          return;
        }
        setRoll((await res.json()) as CourtRoll);
        setReachable(true);
      } catch {
        setReachable(false);
      }
    })();
  }, []);

  useEffect(refresh, [refresh]);
  // While court SITS, the hall is live: look again every 20s so a matter
  // queued mid-session comes up. Closed, the roll is read on demand only —
  // no reason to poll a quiet hall.
  useEffect(() => {
    if (!roll.court.open) return;
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [roll.court.open, refresh]);

  const post = useCallback(
    async (body: unknown): Promise<string | null> => {
      try {
        const res = await fetch('/api/court', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const b = (await res.json().catch(() => ({}))) as { error?: string };
          return b.error ?? `the court's door answered ${res.status}`;
        }
        refresh();
        return null;
      } catch (err) {
        return `the court's door could not be reached: ${(err as Error).message}`;
      }
    },
    [refresh],
  );

  return {
    roll,
    reachable,
    refresh,
    petition: (subject, asks, queued) => post({ subject, asks, queued }),
    answer: (id, answer) => post({ act: 'answer', id, answer }),
    hold: (open) => post({ act: open ? 'open' : 'close' }),
  };
}
