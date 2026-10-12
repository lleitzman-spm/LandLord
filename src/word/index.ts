/**
 * The Word: the ruler speaks, someone at court reads it back, and it is done.
 *
 *   const word = createWord({ getState: () => sim.state, dispatch: a => sim.dispatch(a) });
 *   const ex = await word.speak('Agnes, never evict a widow in winter.', { to: 'court' });
 *   if (ex.status === 'needs_confirm') ex.confirm();
 *
 * speech → digest + prompt → model → strict JSON → validated Actions → the sim.
 * With no model (or when one fails) the offline parser takes the same road.
 */
import type { Exchange, MicAPI, ModelClient, SpeakTarget, WordAPI, WordDeps } from './api';
import type { Id } from '../sim/types';
import { detectModel, ModelError, NO_MODEL, type CourtModel, type Engine, type ModelErrorCode } from './model';
import { buildOrderPrompt } from './prompts';
import { exchangeFromModel, exchangeOffline, type WordCtx } from './interpret';
import { openAudienceSession } from './audience';
import { createMic } from './mic';

export type * from './api';
export { detectModel, ModelError, NO_MODEL, type CourtModel, type Engine, type ModelErrorCode } from './model';
export { buildOrderPrompt, listenerBlock, ORDER_SYSTEM, ORDER_SYSTEM_LEAN, SPOKEN_ACTIONS, SPOKEN_JOBS } from './prompts';
export { buildDigest } from './digest';
export { parseOffline, describeAction, weigh } from './offline';
export { parseReply, validateActions, exchangeFromModel, exchangeOffline } from './interpret';

const LOG_CAP = 30;

export interface WordOptions {
  /** skip detection and use this transport (tests, harnesses) */
  model?: ModelClient | Promise<ModelClient>;
  /** 'quick' (default) or 'default' for the stronger, slower tier */
  tier?: 'quick' | 'default';
  mic?: MicAPI;
}

/** WordAPI plus what the settings screen wants. */
export interface CourtWord extends WordAPI {
  /** "Wit of the court": which model tier answers */
  setWit(tier: 'quick' | 'default'): void;
  /** the server asks for a court key and ours is missing or was refused */
  needsCourtKey(): boolean;
  /** which family of model answers free speech just now; null when none does */
  engine(): Engine | null;
}

function asCourt(m: ModelClient): CourtModel {
  const c = m as Partial<CourtModel>;
  if (typeof c.usable === 'function' && typeof c.needsKey === 'function') return m as CourtModel;
  return { kind: m.kind, engine: c.engine, complete: (req, signal) => m.complete(req, signal), usable: () => m.kind !== 'none', needsKey: () => false };
}

export function createWord(deps: WordDeps, opts: WordOptions = {}): CourtWord {
  let model: CourtModel = NO_MODEL;
  let tier: 'quick' | 'default' = opts.tier ?? 'quick';
  let counter = 0;
  const log: Exchange[] = [];
  const listeners = new Set<() => void>();

  const notify = (): void => { for (const cb of [...listeners]) { try { cb(); } catch (e) { console.error('[word] listener failed', e); } } };
  /** the transport that can actually answer right now */
  const live = (): CourtModel => (model.kind !== 'none' && model.usable() ? model : NO_MODEL);
  const ctx: WordCtx = { deps, notify, nextId: () => `x${(++counter).toString(36)}` };

  const ready: Promise<void> = Promise.resolve(opts.model ?? detectModel())
    .then(m => { model = asCourt(m); }, () => { model = NO_MODEL; })
    .then(notify);

  const keep = (ex: Exchange): Exchange => {
    log.push(ex);
    if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
    notify();
    return ex;
  };

  async function speak(text: string, target: SpeakTarget): Promise<Exchange> {
    const said = String(text ?? '').trim();
    // detection takes a moment at most; never keep the ruler waiting on it
    await Promise.race([ready, new Promise<void>(res => setTimeout(res, 3000))]);
    const m = live();
    if (m.kind === 'none' || !said) return keep(exchangeOffline(said, target, ctx));
    let failure: ModelErrorCode, prose: string | undefined;
    try {
      // a smaller model gets the short instructions and a tighter digest
      const req = buildOrderPrompt(deps.getState(), said, target, { recent: log.slice(-2), tier, lean: m.engine === 'workers-ai' });
      const raw = await m.complete(req);
      const ex = exchangeFromModel(raw, said, target, ctx);
      if (ex) return keep(ex);
      failure = 'bad_response'; prose = raw;
    } catch (e) {
      failure = e instanceof ModelError ? e.code : 'network';
      if (!(e instanceof ModelError)) console.warn('[word] the model call failed', e);
    }
    // one failed call, one graceful fallback. No retry.
    return keep(exchangeOffline(said, target, ctx, failure, prose));
  }

  return {
    transport: () => live().kind,
    ready,
    speak,
    openAudience: (incidentId: Id) => openAudienceSession(incidentId, deps, live, notify),
    mic: opts.mic ?? createMic(),
    log: () => log.slice(),
    onChange(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    setWit(t) { tier = t === 'default' ? 'default' : 'quick'; },
    needsCourtKey: () => model.needsKey(),
    engine: () => { const m = live(); return m.kind === 'none' ? null : m.engine ?? 'claude'; },
  };
}
