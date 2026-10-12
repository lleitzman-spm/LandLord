/**
 * Renderer contract. The diorama: the realm as a miniature on a candle-lit
 * war table. three.js only lives under src/render.
 *
 * World space: 1 tile = 1 unit, y up. Tile (x, y) spans world x in
 * [x - MAP_W/2, x + 1 - MAP_W/2], z likewise with MAP_H. Ground (board top) is y = 0.
 * Building meshes are authored in LOCAL space: footprint centred on the origin,
 * w along +x, h along +z, door on the +z side, ground at y = 0. The scene
 * rotates the group by  -rot * PI/2  about y.
 */
import type * as THREE from 'three';
import type {
  GameState, SimEvent, Id, Season, WeatherKind, RankId, StaffRole, BuildingState,
} from '../sim/types';
import type {
  BuildingType, Species, TradeId, VisualId, EmoteId, NpcId, AnimId, SquatterKind,
} from '../data/ids';

// ───────────── shared environment ─────────────

/** Recomputed every frame by render/index and passed to every update(). */
export interface Env {
  time: number;          // real seconds since the renderer started
  dt: number;            // this frame, seconds (already clamped)
  monthPhase: number;    // 0..1 through the month: 0 dawn (Rent Day) → 0.75 dusk → night → dawn
  night: number;         // 0 full day .. 1 deep night (windows glow, figures sleep)
  season: Season;
  /** 0..1 how far into the season, for blending palettes */
  seasonT: number;
  snow: number;          // 0..1 snow lying on roofs and ground
  wind: number;          // 0..1
  weather: WeatherKind;
  /** game speed right now (0, 0.1, 1, 2, 4) — animation may follow it loosely */
  speed: number;
}

export type Quality = 'low' | 'medium' | 'high';

/** Handed to every factory so all pieces share one look. */
export interface RenderCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  env: Env;
  quality: Quality;
}

// ───────────── buildings (render/buildings) ─────────────

export interface BuildingLook {
  type: BuildingType;
  level: number;
  variant: number;                 // seed for cosmetic variation
  w: number; h: number;            // UNROTATED footprint (from BuildingDef)
  state: BuildingState;
  progress: number;                // 0..1 while 'building'
  condition: number;               // 0..100
  /** per unit: is someone living there (smoke, lit windows, flowers) */
  occupied: boolean[];
  /** at least one unit advertised: show the "TO LET" shingle */
  toLet: boolean;
  squatters: SquatterKind | null;
  /** building flags worth showing: 'purple', 'haunted', 'gargoyles', 'hearth_right'... */
  flags: string[];
}

export interface BuildingVisual {
  group: THREE.Group;
  /** apply changes cheaply (only rebuild what changed) */
  set(look: BuildingLook): void;
  update(env: Env): void;
  /** local-space points other systems attach to */
  anchors: {
    door: THREE.Vector3;           // ground point just outside the door
    roof: THREE.Vector3;           // a perch on the roof ridge (griffins sit here)
    chimney: THREE.Vector3 | null; // smoke rises from here
    top: number;                   // highest y — pins float above this
    windows: THREE.Vector3[];      // faces peek out of these
  };
  dispose(): void;
}

// ───────────── figures (render/figures) ─────────────

export type FigureProp = 'none' | 'hammer' | 'trowel' | 'broom' | 'sack' | 'purse' | 'scroll' | 'bell' | 'keys'
  | 'ledger' | 'lute' | 'pitchfork' | 'loaf' | 'mug' | 'staff' | 'crook' | 'basket' | 'lantern' | 'sword' | 'fish';

export interface FigureSpec {
  species: Species;
  seed: number;                    // face, colours, small proportions
  trade?: TradeId;                 // townsfolk: hat, apron, default prop
  role?: StaffRole | 'ruler';      // staff livery; the ruler wears rank
  rank?: RankId;                   // ruler only: circlet → coronet → crown
  npc?: NpcId;                     // court visitors with fixed looks
  child?: boolean;                 // small ambient family members
}

export interface Figure {
  group: THREE.Group;              // origin at the feet
  height: number;                  // world units, for bubbles and pins
  setAnim(anim: AnimId): void;
  /** turn the head (and slowly the body) toward a world point; null = look ahead */
  lookAt(wx: number | null, wz?: number): void;
  /** body heading in radians, 0 = facing +z (south) */
  setHeading(rad: number): void;
  setProp(prop: FigureProp): void;
  /** 0 miserable .. 1 delighted — brows, mouth, posture */
  setMood(m: number): void;
  /** play a one-shot reaction on top of the current anim (hop, startle, nod) */
  react(kind: 'hop' | 'startle' | 'nod' | 'shake' | 'flinch'): void;
  setSelected(on: boolean): void;
  update(env: Env): void;
  dispose(): void;
}

// ───────────── incident visuals & creatures (render/visuals) ─────────────

export interface VisualHost { look: BuildingLook; visual: BuildingVisual; /** footprint centre in world space */ wx: number; wz: number; rotY: number }
export interface VisualHandle { group: THREE.Group; update(env: Env): void; /** play a short exit (fly off, pop) then call done */ leave(done: () => void): void; dispose(): void }

// ───────────── effects (render/fx) ─────────────

export interface Fx {
  /** coins arc from one world point to another (rent flying to the coffer) */
  coins(from: THREE.Vector3, to: THREE.Vector3, count: number): void;
  puff(at: THREE.Vector3, color?: number, count?: number): void;       // dust / poof
  sparkle(at: THREE.Vector3, color?: number): void;                    // magic, success
  hearts(at: THREE.Vector3): void;
  confetti(at: THREE.Vector3): void;
  /** continuous chimney smoke; returns a stopper */
  smoke(at: THREE.Vector3, opts?: { dark?: boolean; rate?: number }): { stop(): void; move(at: THREE.Vector3): void };
  setWeather(kind: WeatherKind): void;
  /** 0..1 lightning flash right now (storms); the renderer adds it to its fill light */
  flash: number;
  update(env: Env): void;
  dispose(): void;
}

// ───────────── the renderer (render/index) ─────────────

export type Tool =
  | { kind: 'select' }
  | { kind: 'place'; btype: BuildingType; rot: 0 | 1 | 2 | 3 }
  | { kind: 'road' }
  | { kind: 'unroad' }
  | { kind: 'clear' }
  | { kind: 'demolish' };

export type TableProp = 'coffer' | 'ledger' | 'charter' | 'candle' | 'seal' | 'map_scroll' | 'bell';

export type PickResult =
  | { kind: 'building'; buildingId: Id }
  | { kind: 'actor'; actorId: Id }
  | { kind: 'townsperson'; tenantId: Id }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'prop'; prop: TableProp }
  | { kind: 'none' };

export type AnchorRef =
  | { buildingId: Id; unit?: number; at?: 'top' | 'door' }
  | { actorId: Id }
  | { tenantId: Id }
  | { tile: [number, number] }
  | { prop: TableProp };

export interface Anchor {
  x: number; y: number;            // CSS pixels relative to the canvas's top-left
  visible: boolean;                // in front of the camera and on screen
  scale: number;                   // ~1 at default zoom; shrink pins when far
}

export interface RendererEvents {
  pick: (hit: PickResult, ev: { button: number; shift: boolean }) => void;
  hover: (hit: PickResult) => void;
  /** tool 'place': the player clicked a valid spot */
  place: (btype: BuildingType, x: number, y: number, rot: 0 | 1 | 2 | 3) => void;
  /** tool 'road' / 'unroad': tiles painted in one drag */
  paint: (tool: 'road' | 'unroad', tiles: [number, number][]) => void;
  clear: (x: number, y: number) => void;
  demolish: (buildingId: Id) => void;
  /** right-click / Esc while a tool is active */
  cancel: () => void;
}

export interface RendererDeps {
  canvas: HTMLCanvasElement;
  /** placement validity for the ghost (cheap; called on hover) */
  canPlace: (btype: BuildingType, x: number, y: number, rot: number) => boolean;
  quality?: Quality;
}

export type SceneMode = 'title' | 'play' | 'audience' | 'ceremony';

export interface Renderer {
  /** build the whole scene from this state (new game / load) */
  reset(state: GameState): void;
  /** every frame, before frame(): cheap reconcile against the live state */
  sync(state: GameState): void;
  handleEvents(events: SimEvent[], state: GameState): void;
  frame(dtSeconds: number): void;
  resize(): void;
  setTool(tool: Tool): void;
  /** 'title': slow orbit, no input. 'audience': camera settles on the seat, depth of field up. */
  setMode(mode: SceneMode): void;
  focus(target: { buildingId?: Id; actorId?: Id; tile?: [number, number]; overview?: boolean }, opts?: { zoom?: number; ms?: number }): void;
  anchor(ref: AnchorRef): Anchor;
  setSelection(sel: { buildingId?: Id; actorId?: Id } | null): void;
  /** highlight tiles (e.g. parcels for sale) */
  setHighlight(tiles: [number, number][] | null, color?: number): void;
  on<K extends keyof RendererEvents>(type: K, cb: RendererEvents[K]): void;
  setQuality(q: Quality): void;
  stats(): { fps: number; calls: number; tris: number };
  dispose(): void;
}
