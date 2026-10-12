/**
 * OWNER: word-audience agent.
 *
 * The microphone: speech recognition behind MicAPI, over the browser's Web
 * Speech API (`SpeechRecognition`, or `webkitSpeechRecognition` on Chrome and
 * Safari). Hold to talk: `start()` on press, `stop()` on release.
 *
 * The game records and stores no audio. It only ever sees the text the
 * browser's recogniser hands back; where that recognising happens (on the
 * device or with the browser vendor's service) is the browser's affair.
 *
 * Behaviour
 *  - `supported` is plain feature detection, made once.
 *  - `start` streams the transcript so far to `onPartial` and calls `onFinal`
 *    exactly once per run with everything heard. A run that hears nothing
 *    reports `no_speech` through `onError` instead.
 *  - `listening` is true from an accepted `start()` until `stop()` is called
 *    or the recogniser ends on its own, whichever is first.
 *  - A second `start()` while listening adopts the new handlers and does not
 *    restart anything. A `start()` while the last run is still finishing
 *    wraps that run up first.
 */
import type { MicAPI } from './api';

type MicError = 'denied' | 'unsupported' | 'no_speech' | 'error';
type MicHandlers = Parameters<MicAPI['start']>[0];

interface RecAlternative { transcript: string }
interface RecResult { isFinal: boolean; length: number; [index: number]: RecAlternative }
interface RecResultList { length: number; [index: number]: RecResult }
interface RecEvent { results: RecResultList; resultIndex?: number }
interface RecErrorEvent { error?: string; message?: string }
/** The slice of SpeechRecognition this file uses. */
export interface RecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((ev: unknown) => void) | null;
  onresult: ((ev: RecEvent) => void) | null;
  onerror: ((ev: RecErrorEvent) => void) | null;
  onend: ((ev: unknown) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecCtor = new () => RecLike;
/** What `createMic` needs from the page. Defaults to `globalThis`; tests pass a fake. */
export interface MicScope {
  SpeechRecognition?: RecCtor;
  webkitSpeechRecognition?: RecCtor;
  navigator?: { language?: string };
}

/** After `stop()`, how long to wait for the recogniser's last words before taking what we have. */
const FINALISE_MS = 1500;
const FALLBACK_LANG = 'en-US';

function mapError(code: string | undefined): MicError | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed': return 'denied';
    case 'no-speech': return 'no_speech';
    case 'aborted': return null;                 // we, or another start, cut it short: not worth a message
    default: return 'error';                     // audio-capture, network, bad-grammar, language-not-supported...
  }
}

/** Join recognised pieces. Some Android builds repeat everything heard so far in each new final piece. */
function joinPieces(pieces: string[]): string {
  let all = '';
  for (const raw of pieces) {
    const p = raw.replace(/\s+/g, ' ').trim();
    if (!p) continue;
    if (!all) { all = p; continue; }
    const a = all.toLowerCase(), b = p.toLowerCase();
    if (b.startsWith(a)) all = p;                // the piece restates the lot, and adds to it
    else if (a.endsWith(b)) continue;            // a plain repeat
    else all = all + ' ' + p;
  }
  return all;
}

interface Run {
  rec: RecLike;
  handlers: MicHandlers;
  text: string;            // finals + interim, as last heard
  lastPartial: string;
  error: MicError | null;
  stopped: boolean;        // stop() was called
  finished: boolean;       // onFinal / onError has been delivered
  retryLang: boolean;      // the language was refused: go again in en-US
  triedFallback: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createMic(scope: MicScope = globalThis as unknown as MicScope): MicAPI {
  let Ctor: RecCtor | undefined;
  try { Ctor = scope?.SpeechRecognition ?? scope?.webkitSpeechRecognition; } catch { Ctor = undefined; }
  let run: Run | null = null;

  const mic: MicAPI = { supported: typeof Ctor === 'function', listening: false, start, stop };

  /** The browser's language as a clean tag ("en-GB"); POSIX leftovers like "en_US.UTF-8" or "en-US@posix" are tidied. */
  function language(): string {
    let raw = '';
    try { raw = String(scope?.navigator?.language ?? ''); } catch { raw = ''; }
    const tag = raw.split(/[@.]/)[0]!.replace(/_/g, '-').trim();
    return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(tag) ? tag : FALLBACK_LANG;
  }

  /** Deliver the one result of a run. Safe to call twice; only the first counts. */
  function finish(r: Run): void {
    if (r.finished) return;
    r.finished = true;
    if (r.timer !== null) { clearTimeout(r.timer); r.timer = null; }
    r.rec.onstart = r.rec.onresult = r.rec.onerror = r.rec.onend = null;
    if (run === r) { run = null; mic.listening = false; }
    const text = r.text.trim();
    try {
      if (text) r.handlers.onFinal(text);
      else r.handlers.onError?.(r.error ?? 'no_speech');
    } catch (e) { console.error('[mic] handler failed', e); }
  }

  function begin(handlers: MicHandlers, lang: string, triedFallback: boolean): void {
    let rec: RecLike;
    try { rec = new Ctor!(); } catch { mic.listening = false; handlers.onError?.('error'); return; }
    const r: Run = { rec, handlers, text: '', lastPartial: '', error: null, stopped: false, finished: false, retryLang: false, triedFallback, timer: null };
    rec.lang = lang;
    rec.continuous = true;             // keep listening through pauses for as long as the seal is held
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      if (r.finished) return;
      const finals: string[] = [];
      let interim = '';
      const list = ev?.results;
      for (let i = 0; list && i < list.length; i++) {
        const res = list[i];
        const said = res?.[0]?.transcript ?? '';
        if (res?.isFinal) finals.push(said); else interim += ' ' + said;
      }
      r.text = joinPieces([...finals, interim]);
      if (r.text && r.text !== r.lastPartial) {
        r.lastPartial = r.text;
        try { r.handlers.onPartial?.(r.text); } catch (e) { console.error('[mic] handler failed', e); }
      }
    };
    rec.onerror = (ev) => {
      if (r.finished) return;
      if (ev?.error === 'language-not-supported' && !r.triedFallback && lang !== FALLBACK_LANG) { r.retryLang = true; r.error = 'error'; return; }
      const code = mapError(ev?.error);
      if (code && !(code === 'no_speech' && r.text)) r.error = code;
      // the recogniser fires `end` next; a denial may never get that far on some browsers, so wrap up now
      if (code === 'denied') finish(r);
    };
    rec.onend = () => {
      if (r.finished) return;
      if (r.retryLang && !r.stopped) {
        r.finished = true;
        rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
        begin(r.handlers, FALLBACK_LANG, true);
        return;
      }
      finish(r);
    };

    run = r;
    mic.listening = true;
    try { rec.start(); } catch {
      r.error = 'error';
      finish(r);
    }
  }

  function start(handlers: MicHandlers): void {
    if (!Ctor) { handlers.onError?.('unsupported'); return; }
    if (run && !run.finished) {
      if (!run.stopped) { run.handlers = handlers; return; }     // already listening: a double start changes nothing
      const old = run;                                           // still finalising the last run: take what it has
      try { old.rec.abort(); } catch { /* already gone */ }
      finish(old);
    }
    begin(handlers, language(), false);
  }

  function stop(): void {
    const r = run;
    if (!r || r.finished || r.stopped) return;
    r.stopped = true;
    mic.listening = false;
    try { r.rec.stop(); } catch { finish(r); return; }
    // the recogniser now hands over its last words and ends; if it never does, take what we have
    r.timer = setTimeout(() => {
      r.timer = null;
      if (r.finished) return;
      try { r.rec.abort(); } catch { /* already gone */ }
      finish(r);
    }, FINALISE_MS);
  }

  return mic;
}
