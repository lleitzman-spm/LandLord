/**
 * Keeping the running reign across a hot update of the page.
 *
 * Some hosts (a Claude artifact viewer, for one) can swap the page's script
 * for a newer build without the player asking. When such a host offers
 * `window.claude.hot`, the shell uses it like this, and every step is
 * feature-detected because nothing about the host is promised:
 *
 *   1. At boot, `hotHandover()` asks for whatever the previous instance left:
 *      `hot.data` (a value), or `hot.restore()` / `hot.get()` (functions).
 *      If it is a string that parses as a save, main.ts boots straight into
 *      that reign instead of the title page.
 *   2. After boot, `hotRegister(fn)` registers `fn` with `hot.snapshot(fn)`
 *      (or `hot.onSnapshot` / `hot.dispose`, whichever exists). The host calls
 *      it just before replacing the page; `fn` returns `Sim.save()` or null.
 *
 * A second road needs no host at all: the same string is put in
 * sessionStorage on `pagehide` under a short-lived key, but only when a hot
 * API was seen, so an ordinary reload still lands on the title page.
 */

const STASH = 'll.hot';
const STASH_MAX_AGE_MS = 15000;

type Hot = Record<string, unknown>;

function hot(): Hot | null {
  try {
    const c = (window as unknown as { claude?: { hot?: unknown } }).claude;
    const h = c && typeof c === 'object' ? c.hot : null;
    return h && (typeof h === 'object' || typeof h === 'function') ? (h as Hot) : null;
  } catch { return null; }
}

function asSave(v: unknown): string | null {
  const s = typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { save?: unknown }).save === 'string' ? (v as { save: string }).save : null;
  return s && s.length > 2 && s.charAt(0) === '{' ? s : null;
}

/** The reign the previous page instance handed over, if a hot host is present and left one. */
export function hotHandover(): string | null {
  const h = hot();
  if (!h) return null;
  try {
    for (const key of ['data', 'restore', 'get'] as const) {
      const v = h[key];
      const got = asSave(typeof v === 'function' ? (v as () => unknown).call(h) : v);
      if (got) return got;
    }
  } catch { /* the host changed its mind */ }
  try {
    const raw = sessionStorage.getItem(STASH);
    if (!raw) return null;
    sessionStorage.removeItem(STASH);
    const j = JSON.parse(raw) as { at?: number; save?: string };
    if (typeof j.at === 'number' && Date.now() - j.at < STASH_MAX_AGE_MS) return asSave(j.save);
  } catch { /* no stash */ }
  return null;
}

/** Offer the host a way to take the running reign with it. Does nothing without a hot host. */
export function hotRegister(snapshot: () => string | null): void {
  const h = hot();
  if (!h) return;
  const give = (): { save: string } | null => {
    try { const save = snapshot(); return save ? { save } : null; } catch { return null; }
  };
  try {
    for (const key of ['snapshot', 'onSnapshot', 'dispose'] as const) {
      const fn = h[key];
      if (typeof fn === 'function') { (fn as (cb: () => unknown) => void).call(h, give); break; }
    }
  } catch { /* the host did not want it */ }
  window.addEventListener('pagehide', () => {
    try {
      const g = give();
      if (g) sessionStorage.setItem(STASH, JSON.stringify({ at: Date.now(), save: g.save }));
    } catch { /* storage is off */ }
  });
}
