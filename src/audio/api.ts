/** Audio contract. All sound is synthesised with WebAudio at runtime — no audio files. */
import type { GameState, SimEvent } from '../sim/types';
import type { SfxId } from '../data/ids';

export type MusicMood = 'title' | 'calm' | 'busy' | 'rent_day' | 'tense' | 'court' | 'winter' | 'triumph' | 'defeat' | 'off';

export interface AudioAPI {
  /** call from the first user gesture; safe to call repeatedly */
  unlock(): void;
  sfx(id: SfxId, opts?: { volume?: number; pan?: number; rate?: number }): void;
  /** react to sim events (coins on rent, hammer on jobs, horn on heralds...) */
  handleEvents(events: SimEvent[], state: GameState): void;
  /** pick the music mood from the state each frame (cheap); crossfades */
  update(state: GameState, dtSeconds: number): void;
  setMood(mood: MusicMood): void;
  /**
   * Speech blips for dialogue: a short run of pitched syllables matched to
   * the text length, voiced by a seed (each character sounds like themselves).
   * Returns a stopper.
   */
  voice(seed: number, text: string, opts?: { pitch?: number; rate?: number }): { stop(): void };
  setVolumes(v: { master?: number; music?: number; sfx?: number; voice?: number }): void;
  volumes(): { master: number; music: number; sfx: number; voice: number };
  dispose(): void;
}
