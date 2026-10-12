/** OWNER: word-audience agent. Speech recognition (Web Speech API) behind MicAPI. Placeholder: unsupported. */
import type { MicAPI } from './api';
export function createMic(): MicAPI { return { supported: false, listening: false, start(h) { h.onError?.('unsupported'); }, stop() {} }; }
