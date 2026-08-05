// The deployed keyholder. What vite.config.ts's chronicleStore does for the
// dev server, this worker does for the deployed castle: the browser speaks
// only to /api/chronicle, and behind that door the worker alone holds the
// vault key — Supabase Postgres, row security with no policies, so only the
// secret key passes (see docs/KINGDOM.md, "The vault"). Per the walls ruling
// this worker runs only behind the Cloudflare Access wall — wall first, route
// second, deploy third — and the key arrives by `npx wrangler secret put
// SUPABASE_SECRET_KEY`, never in git and never in the browser. There is no
// repo ledger out here: with no key configured the door answers 503, the
// store treats non-ok as null, and the app lives on its localStorage mirror,
// exactly as promised. Every other path is the castle itself: static assets.

// Typed against the DOM lib's Request/Response on purpose, so the app build
// needs no @cloudflare/workers-types; the bindings the worker actually uses
// are declared here by hand.
import {
  absorbBorderRows,
  carriedArrivalIds,
  fetchBorderRows,
  mergeBorderArrivals,
} from './server/border';
import {
  CANONICAL_DOC_ID,
  commitAppend,
  revOf,
  vaultCasWrite,
  vaultRead,
  vaultReadDoc,
} from './server/vault';
import type { AppendDoc } from './server/vault';
import {
  authenticateAccess,
  authenticateCanonicalCapability,
  type AccessEnv,
} from './server/access';
import {
  answerMatter,
  dockedOrder,
  fetchRoll,
  fetchSession,
  mayAnswer,
  mayHoldCourt,
  maySubmit,
  parsePetition,
  petitionerOf,
  setSession,
  sovereigns,
  submitPetition,
  visibleTo,
} from './server/courtroll';
import { makeComplete as makeGuardedComplete } from './server/brain';
// The fleet run + its brain doctrine live in the harness (shared with the Node
// terminal fleet); the Worker calls the SAME runFleet against a user's vault.
// eslint-disable-next-line import/extensions
import { runFleet } from '../harness/run-fleet.mjs';
// eslint-disable-next-line import/extensions
import { brainFor } from '../harness/brain-doctrine.mjs';
import { runGuardedModelWork } from '../harness/run-guard.mjs';
import * as core from './operator-core';

export interface Env extends AccessEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  /** Who holds the Crown — comma-separated Access emails. Absent ⇒ NO ONE is
   *  sovereign, and the court roll fails CLOSED: every identity sees only its
   *  own petitions and none may answer. A missing secret must never crown
   *  someone by accident. */
  SOVEREIGN_EMAILS?: string;
  /** The clerks' brain, a Worker secret (`npx wrangler secret put MOONSHOT_API_KEY`).
   *  Absent ⇒ the fleet route answers 503; the rest of the castle is unaffected. */
  MOONSHOT_API_KEY?: string;
  MOONSHOT_BASE_URL?: string;
  ASSETS: { fetch(r: Request): Promise<Response> };
}

/** Which vault document this verified Access identity reads and writes. Missing
 *  identity is a refusal, never an instruction to use the canonical Chronicle. */
function docIdFor(identity: string): string {
  return `chronicle:${identity}`;
}

interface WorkerDeps {
  runFleet: typeof runFleet;
  makeComplete: typeof makeGuardedComplete;
}

export function createWorker(
  deps: WorkerDeps = { runFleet, makeComplete: makeGuardedComplete },
) {
  const fetch = async (request: Request, env: Env): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const isCanonical = pathname === '/api/canonical/chronicle';
    const isPrivateApi =
      pathname === '/api/chronicle' || pathname === '/api/court' || pathname === '/api/fleet';
    let identity = '';
    if (isCanonical) {
      const access = await authenticateCanonicalCapability(request, env);
      if (!access.ok) return new Response(access.message, { status: access.status });
    } else if (isPrivateApi) {
      const access = await authenticateAccess(request, env);
      if (!access.ok) return new Response(access.message, { status: access.status });
      identity = access.email;
    }
    if (pathname === '/api/court') {
      // The court roll — the realm's one shared surface, one-sided.
      return handleCourt(request, env, identity);
    }
    if (pathname === '/api/fleet') {
      // The fleet's door: run the clerks against this identity's vault.
      return handleFleet(request, env, identity, deps);
    }
    if (pathname !== '/api/chronicle' && !isCanonical) {
      // Not the chronicle's door — the castle itself answers.
      return env.ASSETS.fetch(request);
    }

    const url = env.SUPABASE_URL?.replace(/\/+$/, '');
    const key = env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      // No key at the gate. Honest refusal; the app falls back to its mirror.
      return new Response('vault not configured', { status: 503 });
    }

    const rest = `${url}/rest/v1`;
    const headers: Record<string, string> = {
      apikey: key,
      // Legacy service_role keys are JWTs and travel as a bearer token too;
      // sb_secret_* keys use the apikey header alone.
      ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
    };

    // The document this verified identity owns.
    const docId = isCanonical ? CANONICAL_DOC_ID : docIdFor(identity);

    if (request.method === 'GET') {
      const read = await vaultReadDoc(rest, headers, docId);
      if (read.status === 'error') {
        return new Response('vault read refused', { status: 502 });
      }
      // A new identity has no row yet: serve founding (an empty doc the client
      // normalizes to the founding chronicle), so its first write bootstraps it.
      const doc = read.status === 'absent' ? {} : read.doc;
      // The border book is a shared, canonical-only mechanism (an outside
      // producer drops arrivals into the shared demo). NEVER fold it into a
      // per-identity sandbox — that would hand one identity another's
      // arrivals. The audit that hardened this door trimmed the warning; it is
      // restored, because the rule is invisible in the code that obeys it.
      const rows = isCanonical ? await fetchBorderRows(rest, headers) : null;
      return new Response(JSON.stringify(mergeBorderArrivals(doc, rows ?? []), null, 2), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.method === 'PUT') {
      let doc: unknown;
      try {
        doc = JSON.parse(await request.text());
      } catch {
        return new Response('not json', { status: 400 });
      }
      // Compare-and-set: the doc carries rev = base + 1; it commits only if the
      // stored rev still equals base (no concurrent writer got there first).
      const base = revOf(doc) - 1;
      const result = await vaultCasWrite(rest, headers, docId, doc, base);
      if (result === 'error') {
        return new Response('vault write refused', { status: 502 });
      }
      if (result === 'conflict') {
        // Someone advanced the rev. Hand back the fresh doc so the client can
        // merge its appends in and retry — never overwrite.
        const fresh = await vaultRead(rest, headers, docId);
        return new Response(JSON.stringify(fresh ?? {}), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        });
      }
      // Committed. Retire the border rows this write carried (canonical only,
      // best-effort — a refusal only means they fold in again next read).
      if (isCanonical) {
        await absorbBorderRows(rest, headers, carriedArrivalIds(doc), new Date().toISOString());
      }
      return new Response('ok');
    }

    return new Response('method not allowed', { status: 405 });
  };
  return { fetch };
}

export default createWorker();

/** The court roll: the realm's shared surface, governed by one-sided
 *  transparency (src/server/courtroll.ts). A subject may submit a matter and
 *  read their OWN; the sovereign reads every row of it, always. The law lives
 *  in courtroll.ts and is applied here at the one door that holds the key. */
async function handleCourt(request: Request, env: Env, identity: string): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  const url = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response('vault not configured', { status: 503 });
  const rest = `${url}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: key,
    ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
  };

  const who = petitionerOf(identity, sovereigns(env.SOVEREIGN_EMAILS));

  if (request.method === 'GET') {
    const [rows, session] = await Promise.all([
      fetchRoll(rest, headers),
      fetchSession(rest, headers),
    ]);
    if (rows === null) return new Response('roll unreadable', { status: 502 });
    // THE LAW: the sovereign sees all; a subject sees only their own.
    return json({
      sovereign: who.sovereign,
      identity: who.identity,
      court: session ?? { open: false, opened_at: null, opened_by: null },
      matters: dockedOrder(visibleTo(who, rows)),
    });
  }

  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let body: unknown;
  try {
    body = JSON.parse((await request.text()) || '{}');
  } catch {
    return json({ error: 'not json' }, 400);
  }
  const act = (body as { act?: unknown }).act;

  // Opening and closing the court, and answering a matter, are the Crown's.
  if (act === 'open' || act === 'close') {
    if (!mayHoldCourt(who)) return json({ error: 'only the Crown may hold court' }, 403);
    const ok = await setSession(rest, headers, act === 'open', who.identity!);
    return ok ? json({ open: act === 'open' }) : new Response('roll write refused', { status: 502 });
  }
  if (act === 'answer') {
    if (!mayAnswer(who)) return json({ error: 'only the Crown may answer a matter' }, 403);
    const { id, answer } = body as { id?: string; answer?: string };
    if (!id) return json({ error: 'which matter?' }, 400);
    const ok = await answerMatter(rest, headers, id, who.identity!, (answer ?? '').trim());
    return ok ? json({ answered: id }) : new Response('roll write refused', { status: 502 });
  }

  // Otherwise a subject puts a matter before the court.
  if (!maySubmit(who)) return json({ error: 'only a named identity may petition the court' }, 403);
  const petition = parsePetition(body);
  if (!petition.ok) return json({ error: petition.why }, 400);
  const row = await submitPetition(rest, headers, {
    submitted_by: who.identity!,
    subject: petition.subject,
    asks: petition.asks,
    queued: petition.queued,
  });
  return row ? json({ matter: row }) : new Response('roll write refused', { status: 502 });
}

/** Run the clerk fleet against this identity's vault and commit its proposals —
 *  the deployed twin of the dev plugin's /api/fleet. Reads the doc behind the
 *  wall (per-identity sandbox), runs the SHARED runFleet with a fetch-based
 *  brain on the `MOONSHOT_API_KEY` secret, and CAS-writes the batch back through
 *  the same door as any other write. The clerks only PROPOSE (`agent:<seat>`,
 *  `awaiting` the Regent) — no clerk self-approves — so a fleet run never
 *  crosses a human judgment. Capped 1–5 (default 3) so one request stays bounded. */
async function handleFleet(
  request: Request,
  env: Env,
  identity: string,
  deps: WorkerDeps,
): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const url = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response('vault not configured', { status: 503 });
  if (!env.MOONSHOT_API_KEY) return json({ error: 'the clerks have no brain here — set the MOONSHOT_API_KEY secret' }, 503);

  const rest = `${url}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: key,
    ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
  };
  const docId = docIdFor(identity);

  let cap = 3;
  try {
    const parsed = JSON.parse((await request.text()) || '{}') as { cap?: number };
    if (Number.isFinite(parsed.cap)) cap = Math.max(1, Math.min(5, Number(parsed.cap)));
  } catch {
    /* no body — keep the default cap */
  }

  const read = await vaultReadDoc(rest, headers, docId);
  if (read.status === 'error') return new Response('vault read refused', { status: 502 });
  const doc = (read.status === 'absent' ? {} : read.doc) as {
    wargame?: { seed?: string; now?: string };
    events?: unknown[];
  };
  if (!doc.wargame?.seed) return json({ error: 'no muster stands — deploy one, then let the clerks work' }, 409);
  const now = doc.wargame.now ?? new Date().toISOString();

  let result: { events: unknown[]; perClerk: unknown[]; proposals: number };
  try {
    const guardedRun = await runGuardedModelWork(
      ({ onBlocked }) => deps.makeComplete(env, onBlocked),
      (complete) => deps.runFleet({ doc, now, core, complete, brainFor, cap }),
    );
    if (guardedRun.status === 'blocked') {
      return json({ error: 'model context refused; no clerk proposal was written' }, 422);
    }
    result = guardedRun.result;
  } catch (err) {
    return json({ error: `the fleet faltered: ${(err as Error).message}` }, 502);
  }

  if (!result.events.length) return json({ proposals: 0, perClerk: result.perClerk });

  // A minute of reasoning is not thrown away because the board wrote while the
  // clerks worked — the batch is replayed onto a fresh read (see commitAppend).
  const write = await commitAppend({
    base: doc,
    events: result.events,
    read: () => freshDoc(rest, headers, docId),
    write: (next, baseRev) => vaultCasWrite(rest, headers, docId, next, baseRev),
  });
  if (write === 'error') return new Response('vault write refused', { status: 502 });
  if (write === 'conflict') {
    return json(
      { error: 'the vault kept moving under the fleet — the proposals could not be parked' },
      409,
    );
  }
  return json({ proposals: result.proposals, perClerk: result.perClerk });
}

/** The document as the vault holds it right now, or null if it cannot be read.
 *  An absent row reads as an empty doc — the same founding the GET door serves. */
async function freshDoc(
  rest: string,
  headers: Record<string, string>,
  docId: string,
): Promise<AppendDoc | null> {
  const read = await vaultReadDoc(rest, headers, docId);
  if (read.status === 'error') return null;
  return (read.status === 'absent' ? {} : read.doc) as AppendDoc;
}
