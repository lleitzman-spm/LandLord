/** OWNER: audio agent. Placeholder: silence. */
import type { AudioAPI } from './api';
export function createAudio(): AudioAPI {
  const v = { master: 0.8, music: 0.5, sfx: 0.8, voice: 0.7 };
  return { unlock() {}, sfx() {}, handleEvents() {}, update() {}, setMood() {}, voice() { return { stop() {} }; }, setVolumes(n) { Object.assign(v, n); }, volumes() { return { ...v }; }, dispose() {} };
}
export type * from './api';
