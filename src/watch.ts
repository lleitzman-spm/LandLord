// The watchtower — someone outside the browser who sees the kingdom fail.
//
// The constitution's fail-quiet habit is the thing this exists to break. A
// write to the vault can be refused and, until now, the ONLY witness was a
// `saveStatus` the screen never read: the record was lost, the store knew, and
// nobody was told (docs/HANDOFF.md, blocker one). A closed beta makes that
// worse, not better — an outside user who loses a record cannot see the console
// and will not file a report; they will simply believe the kingdom forgot.
//
// So the watchtower is deliberately narrow. It reports FAILURES to Sentry. It
// does not measure the user, it does not replay the session, and it carries no
// record CONTENTS — the doors, the tenants, the money and the names never leave
// the browser (the data gate, docs/KINGDOM.md). What goes out is the shape of a
// failure: what was attempted, what answered, how big the document was. Enough
// to fix it, never enough to read the kingdom's books off the wire.

import * as Sentry from '@sentry/react';

/** The ingest endpoint. NOT a secret — a Sentry DSN is write-only by design and
 *  is meant to sit in browser code; it can post events and read nothing back.
 *  It still travels as config rather than a literal so a fork, a fresh clone or
 *  a preview build reports somewhere else (or nowhere) without a code change. */
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let raised = false;

export function raiseTheWatchtower(): void {
  if (raised) return;
  raised = true;
  if (!DSN) {
    // Say so, out loud, in EVERY build. A watchtower that quietly fails to man
    // itself is the same fault this file exists to fix, one level up — and the
    // warning used to be gated to DEV, so the one build where it mattered (the
    // deployed one, built with no DSN in the environment) was the one build
    // that said nothing. `npm run guard:watchtower` is the real answer, since a
    // console line nobody opens is not a witness; this is the last word.
    console.warn('[watchtower] VITE_SENTRY_DSN is unset — failures are going nowhere.');
    return;
  }
  Sentry.init({
    dsn: DSN,
    // THE ALARM MUST SURVIVE THE THING IT IS REPORTING.
    //
    // Edwin found this by testing it the obvious way: turn the wifi off, make a
    // change, watch it fail. The banner appeared exactly as it should — and
    // nothing ever reached us, because the browser could not reach Sentry
    // either. The default transport drops what it cannot send.
    //
    // That is the worst possible gap, because `unreachable` is the COMMON
    // failure. A refused write means the vault answered and said no; an
    // unreachable one usually means the connection went away — and a connection
    // that is gone takes the report with it. So the single most likely way a
    // beta user loses work was the single case we would never hear about.
    //
    // The offline transport queues failed envelopes in IndexedDB (30 deep) and
    // flushes them when the browser fires `online`; `flushAtStartup` sends what
    // is still queued the next time the app is opened, so a report survives the
    // tab being closed while the connection is down.
    // `flushAtStartup` is the OFFLINE transport's own option, so it is given
    // where that transport is BUILT. Passing it through `init`'s
    // `transportOptions` does not typecheck: that field is typed for the plain
    // browser transport, and swapping the transport does not swap the type.
    transport: (options) =>
      Sentry.makeBrowserOfflineTransport()({ ...options, flushAtStartup: true }),
    // The environment tells a beta user's broken write apart from our own.
    environment: import.meta.env.DEV ? 'development' : 'production',
    // No session replay, no profiling, no performance traces. Failures only:
    // the point is to hear the kingdom break, not to watch anyone use it.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // The data gate, enforced at the wire rather than trusted. A stack frame
      // or a URL can carry a query string, and a query string can carry an
      // address. Strip what we never meant to send.
      if (event.request?.query_string) delete event.request.query_string;
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

/** A write to the vault was refused. This is the failure that matters most —
 *  it is the one that silently loses a record.
 *
 *  `detail` is the server's own words where we have them. It is deliberately
 *  passed in rather than read here, because the store is the only thing that
 *  knows WHICH attempt failed and against what revision. */
export function reportLostWrite(detail: {
  /** 'refused' = the vault answered and said no. 'unreachable' = no answer. */
  kind: 'refused' | 'unreachable';
  /** The HTTP status, when there was one to have. */
  status?: number;
  /** The revision we were writing against — the conflict's whole story. */
  base?: number;
  /** How large the document was, in bytes. Size, never contents. */
  bytes?: number;
  /** The thrown error, when the fetch never landed. */
  cause?: unknown;
}): void {
  const message =
    detail.kind === 'refused'
      ? `the vault refused a write (${detail.status ?? 'no status'})`
      : 'the vault could not be reached';
  Sentry.captureException(detail.cause instanceof Error ? detail.cause : new Error(message), {
    level: 'error',
    tags: { failure: 'lost-write', kind: detail.kind },
    // Numbers and statuses only — no document, no records, no names.
    extra: { status: detail.status, base: detail.base, bytes: detail.bytes },
  });
}
