/**
 * Transports for the Word, tried in this order:
 *
 *   'server'  the game's own origin answers GET /api/court with { ok, model, gated, engine }
 *             and POST /api/word with { text }. The deployed Worker holds the key, or with
 *             no key answers from Cloudflare's own models (engine 'workers-ai').
 *   'claude'  the page runs inside a Claude artifact viewer: window.claude.use('sample').
 *   'none'    nobody at court can hear free speech. The offline parser and the whispers carry the game.
 *
 * Detection never throws and never blocks the game. A failed call rejects
 * with a ModelError; callers fall back to the offline parser for that call.
 * Nothing here retries.
 */
import type { ModelClient, ModelRequest } from './api';

export type ModelErrorCode =
  | 'court_key'      // the server wants a court key and ours is missing or wrong (HTTP 401)
  | 'rate_limited'   // asked too often; back off
  | 'denied'         // the viewer or their plan does not allow it; do not ask again this session
  | 'cancelled'      // our own signal aborted
  | 'timeout' | 'network' | 'server' | 'bad_response'
  | 'refused'        // the model declined or produced nothing
  | 'unavailable';   // there is no model

export class ModelError extends Error {
  readonly code: ModelErrorCode;
  /** true when asking again this session is pointless */
  readonly permanent: boolean;
  constructor(code: ModelErrorCode, message?: string, permanent = false) {
    super(message ?? code);
    this.name = 'ModelError';
    this.code = code;
    this.permanent = permanent;
  }
}

/** Who is behind the transport. Smaller models get shorter instructions (see prompts.ts). */
export type Engine = 'claude' | 'workers-ai';

/** A ModelClient that also knows whether asking it is worth the trip right now. */
export interface CourtModel extends ModelClient {
  /** which family of model answers, when the transport says */
  engine?: Engine;
  /** false while the transport cannot answer (no court key, key rejected, permission denied, cooling off) */
  usable(): boolean;
  /** the server is gated and the stored court key is missing or was rejected */
  needsKey(): boolean;
}

export const COURT_KEY_STORAGE = 'll.courtKey';
const SERVER_TIMEOUT_MS = 25_000;
const PROBE_TIMEOUT_MS = 2_500;

export const NO_MODEL: CourtModel = {
  kind: 'none',
  complete: () => Promise.reject(new ModelError('unavailable', 'No model is available.', true)),
  usable: () => false,
  needsKey: () => false,
};

export interface DetectEnv {
  /** defaults to the global fetch */
  fetch?: typeof fetch;
  /** defaults to the page's location; the server is only probed over http(s) */
  protocol?: string;
  /** defaults to window.claude */
  claude?: { use?: (name: string) => Promise<unknown> } | null;
  /** defaults to localStorage */
  readKey?: () => string;
  probeTimeoutMs?: number;
}

function storedKey(): string {
  try {
    const ls = (globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage;
    return (ls?.getItem(COURT_KEY_STORAGE) ?? '').trim();
  } catch { return ''; }
}

/** Abort when either the caller's signal or our own timer fires. */
function linked(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const ctl = new AbortController();
  let timed = false;
  const timer = setTimeout(() => { timed = true; ctl.abort(); }, timeoutMs);
  const onAbort = () => ctl.abort();
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  return { signal: ctl.signal, timedOut: () => timed, done: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); } };
}

async function probeServer(f: typeof fetch, timeoutMs: number): Promise<{ gated: boolean; engine: Engine } | null> {
  const link = linked(undefined, timeoutMs);
  try {
    const r = await f('/api/court', { method: 'GET', headers: { accept: 'application/json' }, signal: link.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json() as { ok?: unknown; model?: unknown; gated?: unknown; engine?: unknown } | null;
    if (!j || typeof j !== 'object' || j.ok !== true || j.model !== true) return null;
    // an engine we have not heard of is treated as the smaller kind: short instructions suit every model
    const engine: Engine = j.engine === undefined || j.engine === 'claude' ? 'claude' : 'workers-ai';
    return { gated: j.gated === true, engine };
  } catch { return null; } finally { link.done(); }
}

function serverModel(f: typeof fetch, gated: boolean, readKey: () => string, engine: Engine = 'claude'): CourtModel {
  let rejected: string | null = null;        // a key the server has already said no to
  let coolUntil = 0;
  let cachedKey = '', cachedAt = -1e9;
  const key = (fresh = false): string => {
    const now = Date.now();
    if (fresh || now - cachedAt > 1000) { cachedKey = readKey(); cachedAt = now; }
    return cachedKey;
  };
  const needsKey = () => { const k = key(); return (gated && !k) || (rejected !== null && k === rejected); };
  return {
    kind: 'server',
    engine,
    usable: () => !needsKey() && Date.now() >= coolUntil,
    needsKey,
    async complete(req: ModelRequest, signal?: AbortSignal): Promise<string> {
      const k = key(true);
      if ((gated && !k) || (rejected !== null && k === rejected)) throw new ModelError('court_key', 'The court key is missing or was refused.');
      const body = JSON.stringify({ system: req.system, messages: req.messages, maxTokens: req.maxTokens ?? 500, tier: req.tier ?? 'quick', ...(k ? { key: k } : {}) });
      const link = linked(signal, SERVER_TIMEOUT_MS);
      let r: Response;
      try {
        r = await f('/api/word', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body, signal: link.signal, cache: 'no-store' });
      } catch (e) {
        link.done();
        if (signal?.aborted) throw new ModelError('cancelled');
        if (link.timedOut()) throw new ModelError('timeout', 'The court took too long to answer.');
        throw new ModelError('network', e instanceof Error ? e.message : 'network');
      }
      try {
        if (r.status === 401) { rejected = k || '\u0000'; throw new ModelError('court_key', 'The court key was refused.'); }
        if (r.status === 429) { coolUntil = Date.now() + 15_000; throw new ModelError('rate_limited', 'Too many words too quickly.'); }
        const j = await r.json().then(x => x as { text?: unknown; error?: unknown; code?: unknown } | null, () => null);
        if (!r.ok) throw new ModelError('server', typeof j?.code === 'string' ? j.code : `HTTP ${r.status}`);
        // some engines hand back the JSON they were asked for already parsed
        const text = j && typeof j.text === 'object' && j.text !== null ? JSON.stringify(j.text) : j?.text;
        if (typeof text !== 'string' || !text.trim()) throw new ModelError('bad_response', 'The court answered with nothing.');
        return text;
      } catch (e) {
        if (e instanceof ModelError) throw e;
        if (signal?.aborted) throw new ModelError('cancelled');
        if (link.timedOut()) throw new ModelError('timeout');
        throw new ModelError('network', e instanceof Error ? e.message : 'network');
      } finally { link.done(); }
    },
  };
}

type SampleFn = (input: { role: 'user' | 'assistant'; content: string }[], options?: { modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean; signal?: AbortSignal }) => Promise<{ text?: unknown } | string>;

const GONE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

function claudeModel(sample: SampleFn): CourtModel {
  let gone = false;
  let coolUntil = 0;
  return {
    kind: 'claude',
    engine: 'claude',
    usable: () => !gone && Date.now() >= coolUntil,
    needsKey: () => false,
    async complete(req: ModelRequest, signal?: AbortSignal): Promise<string> {
      if (gone) throw new ModelError('denied', 'Not allowed in this view.', true);
      if (Date.now() < coolUntil) throw new ModelError('rate_limited');
      // there is no system role: standing instructions go in a leading user turn, and the list must end on a user turn
      const turns = [{ role: 'user' as const, content: req.system }, ...req.messages.filter(m => m.content.trim())];
      if (turns[turns.length - 1]!.role !== 'user') turns.push({ role: 'user', content: 'Go on.' });
      try {
        const res = await sample(turns, { modelTier: req.tier === 'default' ? 'default' : 'quick', cache: false, ...(signal ? { signal } : {}) });
        const text = typeof res === 'string' ? res : res?.text;
        if (typeof text !== 'string' || !text.trim()) throw new ModelError('bad_response');
        return text;
      } catch (e) {
        if (e instanceof ModelError) throw e;
        const code = (e as { code?: unknown } | null)?.code;
        const c = typeof code === 'string' ? code : '';
        if (c === 'cancelled' || signal?.aborted) throw new ModelError('cancelled');
        if (GONE.has(c)) { gone = true; throw new ModelError('denied', c, true); }
        if (c === 'rate_limited') { coolUntil = Date.now() + 20_000; throw new ModelError('rate_limited', c); }
        if (c === 'session_expired') { coolUntil = Date.now() + 60_000; throw new ModelError('denied', c); }
        if (c === 'refused' || c === 'empty_completion') throw new ModelError('refused', c);
        throw new ModelError('server', c || 'upstream_error');
      }
    },
  };
}

async function probeClaude(claude: DetectEnv['claude']): Promise<SampleFn | null> {
  if (!claude || typeof claude.use !== 'function') return null;
  try {
    const waited = await Promise.race([
      claude.use('sample'),
      new Promise<null>(res => setTimeout(() => res(null), 12_000)),
    ]);
    return typeof waited === 'function' ? waited as SampleFn : null;
  } catch { return null; }
}

/**
 * Find out who at court can hear free speech. Resolves (never rejects) with
 * the best transport available: the game's own server, then a Claude artifact
 * viewer, then none.
 */
export async function detectModel(env: DetectEnv = {}): Promise<CourtModel> {
  try {
    const g = globalThis as { fetch?: typeof fetch; location?: { protocol?: string }; claude?: DetectEnv['claude'] };
    const f = env.fetch ?? (typeof g.fetch === 'function' ? g.fetch.bind(globalThis) : undefined);
    const protocol = env.protocol ?? g.location?.protocol ?? '';
    if (f && /^https?:$/.test(protocol)) {
      const court = await probeServer(f, env.probeTimeoutMs ?? PROBE_TIMEOUT_MS);
      if (court) return serverModel(f, court.gated, env.readKey ?? storedKey, court.engine);
    }
    const sample = await probeClaude(env.claude !== undefined ? env.claude : g.claude);
    if (sample) return claudeModel(sample);
  } catch { /* detection never throws */ }
  return NO_MODEL;
}
