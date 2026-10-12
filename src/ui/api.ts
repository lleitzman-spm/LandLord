/**
 * UI contract. The interface is an illuminated manuscript laid over the
 * table: parchment panels, ink, rubric red, gold leaf. Plain DOM + CSS — no
 * framework. All UI lives under src/ui.
 */
import type { GameState, SimEvent, Action, ActionResult, Id, Mode, Speed } from '../sim/types';
import type { Renderer } from '../render/api';
import type { WordAPI } from '../word/api';
import type { AudioAPI } from '../audio/api';

/** What the UI needs from the sim (the real Sim satisfies this; so does the dev fake). */
export interface SimLike {
  readonly state: GameState;
  dispatch(action: Action): ActionResult;
  setSpeed(speed: Speed): void;
}

export interface DynastyEntry { ruler: string; realm: string; rank: string; mode: Mode; years: number; households: number; peakRentRoll: number; epitaph: string; endedAt: string; heirloom: string | null }

export interface Settings { quality: 'low' | 'medium' | 'high'; master: number; music: number; sfx: number; voice: number; wit: 'quick' | 'default'; courtKey: string; hints: boolean }

/** What the app shell (main.ts) offers the UI. */
export interface AppAPI {
  newGame(opts: { ruler: string; realm: string; mode: Mode; seed?: number }): void;
  hasSave(): boolean;
  continueGame(): boolean;
  saveNow(): void;
  /** back to the title screen (saves first) */
  toTitle(): void;
  dynasty(): DynastyEntry[];
  settings(): Settings;
  setSettings(patch: Partial<Settings>): void;
  /** true while a game is running (state is a real reign, not the title diorama) */
  inGame(): boolean;
}

export type ScreenName = 'title' | 'audience' | 'ledger' | 'council' | 'charter' | 'gameover' | 'settings' | 'help';

export interface UICtx {
  root: HTMLElement;
  sim: SimLike;
  /** always the current state (sim may be replaced on new game / load) */
  state(): GameState;
  renderer: Renderer;
  word: WordAPI;
  audio: AudioAPI;
  app: AppAPI;
  /** dispatch + show the refusal reason as a toast when it fails */
  act(action: Action): ActionResult;
  open(screen: ScreenName, arg?: unknown): void;
  close(screen?: ScreenName): void;
  isOpen(screen: ScreenName): boolean;
  toast(text: string, kind?: 'info' | 'good' | 'bad'): void;
  /** select + inspect something on the map */
  select(sel: { buildingId?: Id; tenantId?: Id } | null): void;
  /** crawl the world while the ruler is speaking; call release() when done */
  holdCrawl(): () => void;
}

/** A full-screen or large modal surface (see src/ui/screens). */
export interface Screen {
  el: HTMLElement;
  open(arg?: unknown): void;
  close(): void;
  /** called every frame while open */
  update?(state: GameState, dtSeconds: number): void;
  handleEvents?(events: SimEvent[], state: GameState): void;
  /** does this screen pause the world while open? (ledger: yes; audience: crawl, handled itself) */
  pauses?: boolean;
}

export interface UI {
  update(state: GameState, dtSeconds: number): void;
  handleEvents(events: SimEvent[], state: GameState): void;
  open(screen: ScreenName, arg?: unknown): void;
  close(screen?: ScreenName): void;
  /** the sim was replaced (new game / load / back to title) */
  rebind(sim: SimLike): void;
  dispose(): void;
}

export interface UIDeps { root: HTMLElement; sim: SimLike; renderer: Renderer; word: WordAPI; audio: AudioAPI; app: AppAPI }
