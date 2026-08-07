import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  commitAppend,
  revOf,
  vaultCasWrite,
  vaultRead,
} from './src/server/vault';
import type { CourtRollRow } from './src/server/courtroll';
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
} from './src/server/courtroll';
import type { AppendDoc } from './src/server/vault';

// The chronicle's master copy rests in the vault — Supabase Postgres behind
// its own locked door: row security with no policies, so only the secret key
// passes, and that key lives in .env on kingdom machines (see docs/KINGDOM.md,
// "The chronicle"). The dev server is the sole keyholder; the browser speaks
// only to /api/chronicle and never sees a key. The repo file remains the
// backup ledger and the courier of last resort: with no key configured,
// everything works as it did when git carried the records.
function chronicleStore(env: Record<string, string>): Plugin {
  const file = resolve(__dirname, 'data/chronicle.json');
  const url = env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SECRET_KEY;
  const rest = url && key ? `${url}/rest/v1` : null;
  const vault = rest ? `${rest}/chronicle` : null;
  const headers: Record<string, string> = {
    apikey: key ?? '',
    // Legacy service_role keys are JWTs and travel as a bearer token too;
    // sb_secret_* keys use the apikey header alone.
    ...(key?.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
  };
  const devIdentity = (env.DEV_IDENTITY || 'dev@landlord.local').trim().toLowerCase();
  const devDocId = `chronicle:${devIdentity}`;

  const readLedger = () => (existsSync(file) ? readFileSync(file, 'utf8') : '{}');
  const writeLedger = (text: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text.endsWith('\n') ? text : text + '\n');
  };

  // Vault when reachable, ledger otherwise. A successful vault read also
  // refreshes the backup ledger, so the repo copy trails the truth closely.
  // A local browser is assigned the explicit DEV_IDENTITY sandbox. Even when a
  // developer has a vault key, a headerless dev request is never interpreted
  // as authority to read the canonical Chronicle.
  async function readChronicle(): Promise<string> {
    if (vault && rest) {
      try {
        const res = await fetch(`${vault}?id=eq.${encodeURIComponent(devDocId)}&select=doc`, {
          headers: { ...headers, accept: 'application/vnd.pgrst.object+json' },
        });
        if (res.ok) {
          const { doc } = (await res.json()) as { doc: unknown };
          const text = JSON.stringify(doc, null, 2);
          writeLedger(text);
          return text;
        }
        console.warn(`[chronicle] vault read refused (${res.status}); serving the repo ledger`);
      } catch {
        console.warn('[chronicle] vault unreachable; serving the repo ledger');
      }
    }
    return readLedger();
  }

  type WriteResult = { status: 'ok' } | { status: 'conflict'; fresh: unknown } | { status: 'error' };

  async function writeChronicle(text: string): Promise<WriteResult> {
    writeLedger(text);
    // No vault → the repo file is the sole writer; no concurrency to guard.
    if (!vault || !rest) return { status: 'ok' };
    const doc = JSON.parse(text);
    // Compare-and-set: the doc carries rev = base + 1; commit only if the
    // stored rev still equals base (no concurrent writer got there first).
    const base = revOf(doc) - 1;
    // The dev server sits behind no wall, so its explicit DEV_IDENTITY owns the
    // same per-identity sandbox shape the deployed Worker enforces.
    const result = await vaultCasWrite(rest, headers, devDocId, doc, base);
    if (result === 'error') {
      console.warn('[chronicle] vault write refused; the repo ledger holds the record');
      return { status: 'error' };
    }
    if (result === 'conflict') {
      // Hand the fresh doc back so the client merges its appends and retries.
      return { status: 'conflict', fresh: await vaultRead(rest, headers, devDocId) };
    }
    return { status: 'ok' };
  }

  // Run the clerk fleet against the current doc and commit its proposals — the
  // dev-side of "let the clerks work". The Node dev server holds the same tools
  // the harness does, so it runs the SHARED runFleet (harness/run-fleet.mjs)
  // with the live brain, then writes the batch back through the same CAS door
  // as any other write. Capped low so one request returns in a reasonable time;
  // the clerks only ever PROPOSE — no clerk self-approves, so this never crosses
  // a human judgment. The Worker mirrors this at POST /api/fleet for deployed
  // users behind the wall.
  async function runFleetOnce(cap: number): Promise<
    | { status: 'ok'; proposals: number; swept: number; perClerk: unknown[] }
    | { status: 'no-muster' }
    | { status: 'conflict' }
    | { status: 'error'; message: string }
  > {
    let doc: { wargame?: { seed?: string; now?: string }; events?: unknown[] };
    try {
      doc = JSON.parse(await readChronicle());
    } catch (err) {
      return { status: 'error', message: `chronicle unreadable: ${(err as Error).message}` };
    }
    if (!doc.wargame?.seed) return { status: 'no-muster' };
    const now = doc.wargame.now ?? new Date().toISOString();
    let mods;
    try {
      const [runFleetMod, brainMod, doctrineMod, core, runGuardMod] = await Promise.all([
        import('./harness/run-fleet.mjs'),
        import('./harness/moonshot.mjs'),
        import('./harness/brain-doctrine.mjs'),
        import('./dist-operator/operator-core.mjs'),
        import('./harness/run-guard.mjs'),
      ]);
      mods = {
        runFleet: runFleetMod.runFleet,
        makeComplete: brainMod.makeComplete,
        brainFor: doctrineMod.brainFor,
        core,
        runGuardedModelWork: runGuardMod.runGuardedModelWork,
      };
    } catch (err) {
      return { status: 'error', message: `operator core not built — run \`npm run build:operator\` (${(err as Error).message})` };
    }
    const guardedRun = await mods.runGuardedModelWork(
      mods.makeComplete,
      (complete: (payload: unknown) => Promise<unknown>) =>
        mods.runFleet({
          doc,
          now,
          core: mods.core,
          complete,
          brainFor: mods.brainFor,
          cap,
        }),
    );
    if (guardedRun.status === 'blocked') {
      return {
        status: 'error',
        message: 'model context refused; no clerk proposal was written',
      };
    }
    const { events, perClerk, proposals, swept } = guardedRun.result;
    if (!events.length) return { status: 'ok', proposals: 0, swept: 0, perClerk };
    // A minute of reasoning is not thrown away because the board wrote while
    // the clerks worked: the batch is replayed onto a fresh read by the one
    // law both doors keep (commitAppend — the Worker's door does the same).
    const committed = await commitAppend({
      base: doc,
      events,
      read: async () => {
        try {
          return JSON.parse(await readChronicle()) as AppendDoc;
        } catch {
          return null;
        }
      },
      write: async (next) => {
        const w = await writeChronicle(JSON.stringify(next, null, 2));
        return w.status === 'ok' ? 'ok' : w.status === 'conflict' ? 'conflict' : 'error';
      },
    });
    if (committed === 'error') return { status: 'error', message: 'vault write refused' };
    if (committed === 'conflict') return { status: 'conflict' };
    return { status: 'ok', proposals, swept, perClerk };
  }

  // The court roll in dev. There is no Access wall here to name the caller, so
  // the identity comes from the environment: DEV_IDENTITY (default a plain dev
  // subject), and DEV_SOVEREIGN to test the Crown's side. The LAW is the same
  // module the worker uses — dev must never enforce a softer rule than live, or
  // it stops being a rehearsal.
  const devCrown = sovereigns(env.SOVEREIGN_EMAILS ?? env.DEV_SOVEREIGN);

  // With no vault key, dev keeps the roll in a repo file exactly as the
  // chronicle falls back to its ledger — so the court can be driven locally.
  // The LAW is unchanged either way; only where the rows rest differs.
  const rollFile = resolve(__dirname, 'data/court-roll.json');
  type LocalRoll = { rows: CourtRollRow[]; session: { open: boolean; opened_at: string | null; opened_by: string | null } };
  const readLocal = (): LocalRoll =>
    existsSync(rollFile)
      ? (JSON.parse(readFileSync(rollFile, 'utf8')) as LocalRoll)
      : { rows: [], session: { open: false, opened_at: null, opened_by: null } };
  const writeLocal = (r: LocalRoll) => {
    mkdirSync(dirname(rollFile), { recursive: true });
    writeFileSync(rollFile, JSON.stringify(r, null, 2));
  };

  async function courtDoor(method: string, body: string): Promise<{ status: number; body: unknown }> {
    const who = petitionerOf(devIdentity, devCrown);
    if (!rest) {
      // The file-backed rehearsal. Same law, same shapes.
      const local = readLocal();
      if (method === 'GET') {
        return {
          status: 200,
          body: {
            sovereign: who.sovereign,
            identity: who.identity,
            court: local.session,
            matters: dockedOrder(visibleTo(who, local.rows)),
          },
        };
      }
      if (method !== 'POST') return { status: 405, body: 'method not allowed' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        return { status: 400, body: { error: 'not json' } };
      }
      const act = (parsed as { act?: unknown }).act;
      if (act === 'open' || act === 'close') {
        if (!mayHoldCourt(who)) return { status: 403, body: { error: 'only the Crown may hold court' } };
        local.session = {
          open: act === 'open',
          opened_at: act === 'open' ? new Date().toISOString() : null,
          opened_by: act === 'open' ? who.identity : null,
        };
        writeLocal(local);
        return { status: 200, body: { open: act === 'open' } };
      }
      if (act === 'answer') {
        if (!mayAnswer(who)) return { status: 403, body: { error: 'only the Crown may answer a matter' } };
        const { id, answer } = parsed as { id?: string; answer?: string };
        const hit = local.rows.find((r) => r.id === id);
        if (!hit) return { status: 400, body: { error: 'which matter?' } };
        hit.heard_at = new Date().toISOString();
        hit.heard_by = who.identity;
        hit.answer = (answer ?? '').trim();
        writeLocal(local);
        return { status: 200, body: { answered: id } };
      }
      if (!maySubmit(who)) return { status: 403, body: { error: 'only a named identity may petition' } };
      const petition = parsePetition(parsed);
      if (!petition.ok) return { status: 400, body: { error: petition.why } };
      const made: CourtRollRow = {
        id: `local-${local.rows.length + 1}-${Date.now().toString(36)}`,
        realm: 'the-realm',
        submitted_by: who.identity!,
        subject: petition.subject,
        asks: petition.asks,
        submitted_at: new Date().toISOString(),
        queued_at: petition.queued ? new Date().toISOString() : null,
        heard_at: null,
        heard_by: null,
        answer: null,
      };
      local.rows.push(made);
      writeLocal(local);
      return { status: 200, body: { matter: made } };
    }
    if (method === 'GET') {
      const [rows, session] = await Promise.all([fetchRoll(rest, headers), fetchSession(rest, headers)]);
      if (rows === null) return { status: 502, body: 'roll unreadable' };
      return {
        status: 200,
        body: {
          sovereign: who.sovereign,
          identity: who.identity,
          court: session ?? { open: false, opened_at: null, opened_by: null },
          matters: dockedOrder(visibleTo(who, rows)),
        },
      };
    }
    if (method !== 'POST') return { status: 405, body: 'method not allowed' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      return { status: 400, body: { error: 'not json' } };
    }
    const act = (parsed as { act?: unknown }).act;
    if (act === 'open' || act === 'close') {
      if (!mayHoldCourt(who)) return { status: 403, body: { error: 'only the Crown may hold court' } };
      const ok = await setSession(rest, headers, act === 'open', who.identity!);
      return ok ? { status: 200, body: { open: act === 'open' } } : { status: 502, body: 'roll write refused' };
    }
    if (act === 'answer') {
      if (!mayAnswer(who)) return { status: 403, body: { error: 'only the Crown may answer a matter' } };
      const { id, answer } = parsed as { id?: string; answer?: string };
      if (!id) return { status: 400, body: { error: 'which matter?' } };
      const ok = await answerMatter(rest, headers, id, who.identity!, (answer ?? '').trim());
      return ok ? { status: 200, body: { answered: id } } : { status: 502, body: 'roll write refused' };
    }
    if (!maySubmit(who)) return { status: 403, body: { error: 'only a named identity may petition' } };
    const petition = parsePetition(parsed);
    if (!petition.ok) return { status: 400, body: { error: petition.why } };
    const row = await submitPetition(rest, headers, {
      submitted_by: who.identity!,
      subject: petition.subject,
      asks: petition.asks,
      queued: petition.queued,
    });
    return row ? { status: 200, body: { matter: row } } : { status: 502, body: 'roll write refused' };
  }

  return {
    name: 'chronicle-store',
    configureServer(server) {
      server.middlewares.use('/api/court', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          void courtDoor(req.method ?? 'GET', body).then((r) => {
            res.statusCode = r.status;
            res.setHeader('content-type', 'application/json');
            res.end(typeof r.body === 'string' ? JSON.stringify({ error: r.body }) : JSON.stringify(r.body));
          });
        });
      });
      // Say plainly which persistence the court is running on — silence
      // must never be ambiguous between "vault open" and "no key at all".
      console.log(
        vault
          ? `  [chronicle] vault key found — records go to ${url}`
          : '  [chronicle] no vault key in .env — records stay in the repo ledger, git is the courier',
      );
      server.middlewares.use('/api/chronicle', (req, res) => {
        if (req.method === 'GET') {
          void readChronicle().then((text) => {
            res.setHeader('content-type', 'application/json');
            res.end(text);
          });
        } else if (req.method === 'PUT') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              JSON.parse(body);
            } catch {
              res.statusCode = 400;
              res.end('not json');
              return;
            }
            void writeChronicle(body).then((r) => {
              if (r.status === 'conflict') {
                res.statusCode = 409;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(r.fresh ?? {}));
              } else if (r.status === 'error') {
                res.statusCode = 502;
                res.end('vault write refused');
              } else {
                res.end('ok');
              }
            });
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });

      // The fleet's door: POST to run the clerks against the standing muster and
      // commit their proposals. Body may carry { cap } (1–5, default 3) to bound
      // how many cases each clerk proposes this run.
      server.middlewares.use('/api/fleet', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          let cap = 3;
          try {
            const b = body ? (JSON.parse(body) as { cap?: number }) : {};
            if (Number.isFinite(b.cap)) cap = Math.max(1, Math.min(5, Number(b.cap)));
          } catch {
            /* no body, or not json — keep the default cap */
          }
          void runFleetOnce(cap).then((r) => {
            res.setHeader('content-type', 'application/json');
            if (r.status === 'no-muster') {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: 'no muster stands — deploy one, then let the clerks work' }));
            } else if (r.status === 'conflict') {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: 'the vault moved under the fleet — try again' }));
            } else if (r.status === 'error') {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: r.message }));
            } else {
              res.end(JSON.stringify({ proposals: r.proposals, swept: r.swept, perClerk: r.perClerk }));
            }
          });
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), chronicleStore(loadEnv(mode, __dirname, ''))],
}));
