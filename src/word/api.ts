/**
 * The Word: the ruler rules by speaking. Speech (mic or typed) goes to a
 * language model that INTERPRETS it into Actions the sim validates. The model
 * never changes the world directly and never invents numbers.
 *
 * Transports, tried in this order:
 *   'server'  POST /api/word on the game's own origin (the deployed Worker holds the key)
 *   'claude'  window.claude.use('sample') when the page runs inside a Claude artifact viewer
 *   'none'    offline: a keyword parser + the pre-written whispers. The game stays fully playable.
 */
import type { Action, ActionResult, Id, StaffRole, StandingOrder, Oath, GameState } from '../sim/types';
import type { Species, TraitId, NpcId } from '../data/ids';

export type Mood = 'neutral' | 'pleased' | 'delighted' | 'worried' | 'annoyed' | 'angry' | 'smug' | 'sad' | 'afraid';

export interface Speaker {
  kind: 'staff' | 'tenant' | 'applicant' | 'npc' | 'herald';
  name: string;
  first: string;
  species: Species;
  portraitSeed: number;
  role?: StaffRole;
  staffId?: Id;
  tenantId?: Id;
  applicantId?: Id;
  npc?: NpcId;
  mood: Mood;
}

export type SpeakTarget =
  | { to: StaffRole }              // addressed to one delegate
  | { to: 'court' }                // said to the room: the model routes it to whoever it concerns
  | { tenantId: Id }               // said to a household (a visit, a promise, a warning)
  | { buildingId: Id };            // said about a building ("fix this", "raise the rent here")

export interface Exchange {
  id: string;
  day: number;
  text: string;                    // what the ruler said
  target: SpeakTarget;
  speaker: Speaker;                // who answered
  reply: string;                   // their read-back, in their voice and temperament
  /** done: applied · needs_confirm: weighty, waiting on confirm() · refused: the sim said no ·
   *  unclear: they did not understand · error: transport failed (reply holds a graceful line) */
  status: 'done' | 'needs_confirm' | 'refused' | 'unclear' | 'error';
  applied: { action: Action; result: ActionResult }[];
  pending: Action[];
  /** orders / oaths created by this exchange (after apply) */
  orders: StandingOrder[];
  oaths: Oath[];
  via: 'model' | 'offline';
  /** apply `pending` now */
  confirm(): void;
  /** drop `pending` */
  cancel(): void;
}

export interface AudienceLine { who: 'ruler' | 'petitioner' | 'steward'; text: string }

export interface AudienceTurn {
  reply: string;
  mood: Mood;
  /** set once the ruler's words amount to a ruling */
  outcomeId: string | null;
  done: boolean;
  resultText: string | null;
  oaths: Oath[];
  revealed: TraitId[];
  via: 'model' | 'offline';
}

/** One conversation with a petitioner about one incident. */
export interface AudienceSession {
  incidentId: Id;
  title: string;
  speaker: Speaker;
  /** transcript so far; starts with the petitioner's opening line */
  lines: AudienceLine[];
  /** the Steward's whispered suggestions — click to fill the box (or to rule directly when offline) */
  whispers: { outcomeId: string; label: string; say: string }[];
  busy: boolean;
  done: boolean;
  outcomeId: string | null;
  /** speak to the petitioner; resolves with their answer (and the ruling, if one was made) */
  say(text: string): Promise<AudienceTurn>;
  /** rule directly by outcome (whisper clicked while offline, or the timer ran out) */
  choose(outcomeId: string): AudienceTurn;
  /** walk away without ruling; the incident stays open */
  leave(): void;
}

export interface MicAPI {
  /** the browser can do speech recognition here */
  supported: boolean;
  listening: boolean;
  /** begin listening; partial transcripts stream to onPartial; onFinal fires once with the full text */
  start(handlers: { onPartial?: (text: string) => void; onFinal: (text: string) => void; onError?: (code: 'denied' | 'unsupported' | 'no_speech' | 'error') => void }): void;
  stop(): void;
}

export interface WordAPI {
  transport(): 'server' | 'claude' | 'none';
  /** resolves when transport detection has finished */
  ready: Promise<void>;
  speak(text: string, target: SpeakTarget): Promise<Exchange>;
  openAudience(incidentId: Id): AudienceSession | null;
  mic: MicAPI;
  /** recent exchanges, newest last */
  log(): Exchange[];
  onChange(cb: () => void): () => void;
}

export interface WordDeps {
  getState(): GameState;
  dispatch(action: Action): ActionResult;
}

/** Low-level model call shared by transports. */
export interface ModelRequest {
  /** fixed instructions (the server prepends its own guard rails as well) */
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  /** 'quick' = fastest tier (default); 'default' = stronger, slower */
  tier?: 'quick' | 'default';
}
export interface ModelClient {
  kind: 'server' | 'claude' | 'none';
  complete(req: ModelRequest, signal?: AbortSignal): Promise<string>;
}
