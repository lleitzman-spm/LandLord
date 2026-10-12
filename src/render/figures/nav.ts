/**
 * The figures' own map sense: a walkability grid over `state.map.tiles` and a
 * small A* that prefers roads and worn grass, so townsfolk keep to the lanes
 * and the desire paths the way people do. Cosmetic only; the sim never sees it.
 *
 * Everything is in TILE space (x east, y south, floats; the centre of tile
 * (3, 4) is (3.5, 4.5)). World space is x - HALF_W, z = y - HALF_H.
 * No allocation after construction.
 */
import { MAP_W, MAP_H, type GameState, type Building } from '../../sim/types';

export const HALF_W = MAP_W / 2, HALF_H = MAP_H / 2;
const N = MAP_W * MAP_H;
const HEAP = 8192;

export const K_GRASS = 0, K_ROAD = 1, K_FIELD = 2, K_BLOCK = 3, K_WOOD = 4, K_WATER = 5;

const FRONT: readonly (readonly [number, number])[] = [[0, 1], [-1, 0], [0, -1], [1, 0]];
/** which way a building's door faces, as a tile-space step */
export function frontOf(rot: number): readonly [number, number] { return FRONT[rot & 3]!; }

const NX = [1, -1, 0, 0, 1, 1, -1, -1], NY = [0, 0, 1, -1, 1, -1, 1, -1];

export class Nav {
  /** cost of stepping onto a tile; 0 = cannot */
  readonly cost = new Float32Array(N);
  readonly kind = new Uint8Array(N);
  /** bumped whenever the grid is rebuilt */
  version = 0;
  /** where newcomers walk in and the departed walk out */
  gateX = 0.5; gateY = MAP_H / 2 + 0.5;
  /** walkable field tiles, grass beside the woods, road tiles (indices), for people with business there */
  readonly fields: number[] = [];
  readonly woodside: number[] = [];
  readonly roads: number[] = [];

  private readonly g = new Float32Array(N);
  private readonly from = new Int16Array(N);
  private readonly seen = new Uint16Array(N);
  private readonly done = new Uint16Array(N);
  private gen = 0;
  private readonly hf = new Float32Array(HEAP);
  private readonly hi = new Int16Array(HEAP);
  private hn = 0;
  private readonly back = new Int16Array(N);

  build(state: GameState): void {
    const tiles = state.map.tiles;
    this.fields.length = 0; this.woodside.length = 0; this.roads.length = 0;
    for (let i = 0; i < N; i++) {
      const t = tiles[i];
      let c = 0, k = K_BLOCK;
      if (t && !t.b) {
        switch (t.t) {
          case 'road': case 'bridge': c = 1; k = K_ROAD; break;
          case 'grass': c = 1.75 - 0.6 * (t.wear > 0 ? Math.min(1, t.wear) : 0); k = K_GRASS; break;
          case 'field': c = 2.6; k = K_FIELD; break;
          case 'forest': k = K_WOOD; break;
          case 'water': k = K_WATER; break;
          default: break;
        }
      }
      this.cost[i] = c; this.kind[i] = k;
    }
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x, k = this.kind[i]!;
      if (k === K_FIELD) this.fields.push(i);
      else if (k === K_ROAD) this.roads.push(i);
      else if (k === K_GRASS) {
        let wood = false;
        for (let n = 0; n < 4 && !wood; n++) { const xx = x + NX[n]!, yy = y + NY[n]!; if (xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H && this.kind[yy * MAP_W + xx] === K_WOOD) wood = true; }
        if (wood) this.woodside.push(i);
      }
    }
    this.findGate();
    this.version++;
  }

  /** the road that meets the edge of the board (the west edge for choice); failing that, anywhere a person could step on */
  private findGate(): void {
    let best = -1, bestScore = Infinity;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (x !== 0 && y !== 0 && x !== MAP_W - 1 && y !== MAP_H - 1) continue;
      const i = y * MAP_W + x;
      if (!this.cost[i]) continue;
      const score = (this.kind[i] === K_ROAD ? 0 : 100) + (x === 0 ? 0 : 12) + Math.abs((x === 0 || x === MAP_W - 1 ? y - MAP_H / 2 : x - MAP_W / 2)) * 0.2;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) { this.gateX = (best % MAP_W) + 0.5; this.gateY = Math.floor(best / MAP_W) + 0.5; }
    else { this.gateX = 0.5; this.gateY = MAP_H / 2 + 0.5; }
  }

  walkable(x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && this.cost[ty * MAP_W + tx]! > 0;
  }
  kindAt(x: number, y: number): number {
    const tx = Math.floor(x), ty = Math.floor(y);
    return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H ? this.kind[ty * MAP_W + tx]! : K_BLOCK;
  }

  /** index of the walkable tile nearest to (x, y), or -1 if the board is solid */
  nearest(x: number, y: number): number {
    const cx = Math.min(MAP_W - 1, Math.max(0, Math.floor(x))), cy = Math.min(MAP_H - 1, Math.max(0, Math.floor(y)));
    if (this.cost[cy * MAP_W + cx]! > 0) return cy * MAP_W + cx;
    let best = -1, bd = Infinity;
    for (let r = 1; r < 10 && best < 0; r++) {
      for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
        if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
        if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r) continue;
        const i = yy * MAP_W + xx;
        if (!this.cost[i]) continue;
        const d = (xx + 0.5 - x) * (xx + 0.5 - x) + (yy + 0.5 - y) * (yy + 0.5 - y);
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }

  private push(f: number, i: number): void {
    if (this.hn >= HEAP) return;
    const hf = this.hf, hi = this.hi;
    let n = this.hn++;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (hf[p]! <= f) break;
      hf[n] = hf[p]!; hi[n] = hi[p]!; n = p;
    }
    hf[n] = f; hi[n] = i;
  }
  private pop(): number {
    const hf = this.hf, hi = this.hi;
    const top = hi[0]!;
    const f = hf[--this.hn]!, i = hi[this.hn]!;
    let n = 0;
    const half = this.hn >> 1;
    while (n < half) {
      let c = n * 2 + 1;
      if (c + 1 < this.hn && hf[c + 1]! < hf[c]!) c++;
      if (hf[c]! >= f) break;
      hf[n] = hf[c]!; hi[n] = hi[c]!; n = c;
    }
    hf[n] = f; hi[n] = i;
    return top;
  }

  /**
   * A way from (x0, y0) to (x1, y1). Writes corner points (x, y pairs) into `out`
   * and returns how many. When there is no way round: with `loose` the answer is
   * the straight line (figurines are resourceful); without it, 0.
   */
  find(x0: number, y0: number, x1: number, y1: number, out: Float32Array, loose = true): number {
    const max = out.length >> 1;
    const s = this.nearest(x0, y0), e = this.nearest(x1, y1);
    if (s < 0 || e < 0 || max < 2) { out[0] = x1; out[1] = y1; return 1; }
    const exact = Math.floor(x1) === e % MAP_W && Math.floor(y1) === Math.floor(e / MAP_W);
    const fx = exact ? x1 : (e % MAP_W) + 0.5, fy = exact ? y1 : Math.floor(e / MAP_W) + 0.5;
    if (s === e) { out[0] = fx; out[1] = fy; return 1; }

    if (++this.gen >= 65535) { this.seen.fill(0); this.done.fill(0); this.gen = 1; }
    const gen = this.gen, g = this.g, from = this.from, seen = this.seen, done = this.done, cost = this.cost;
    const ex = e % MAP_W, ey = Math.floor(e / MAP_W);
    this.hn = 0;
    g[s] = 0; from[s] = -1; seen[s] = gen;
    this.push(0, s);
    let found = false;
    while (this.hn > 0) {
      const cur = this.pop();
      if (done[cur] === gen) continue;
      done[cur] = gen;
      if (cur === e) { found = true; break; }
      const cx = cur % MAP_W, cy = Math.floor(cur / MAP_W), gc = g[cur]!;
      for (let n = 0; n < 8; n++) {
        const xx = cx + NX[n]!, yy = cy + NY[n]!;
        if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
        const j = yy * MAP_W + xx, cj = cost[j]!;
        if (!cj || done[j] === gen) continue;
        // no cutting corners between two buildings
        if (n >= 4 && (!cost[cy * MAP_W + xx] || !cost[yy * MAP_W + cx])) continue;
        const ng = gc + cj * (n >= 4 ? Math.SQRT2 : 1);
        if (seen[j] === gen && ng >= g[j]!) continue;
        g[j] = ng; from[j] = cur; seen[j] = gen;
        const dx = Math.abs(xx - ex), dy = Math.abs(yy - ey);
        this.push(ng + (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy), j);
      }
    }
    if (!found) { if (!loose) return 0; out[0] = x1; out[1] = y1; return 1; }

    // walk it back, then keep only the corners
    const back = this.back;
    let n = 0;
    for (let c = e; c >= 0 && n < N; c = from[c]!) back[n++] = c;
    let count = 0, pdx = 9, pdy = 9;
    for (let k = n - 2; k >= 0; k--) {             // back[n - 1] is where we already stand
      const a = back[k + 1]!, b = back[k]!;
      const dx = (b % MAP_W) - (a % MAP_W), dy = Math.floor(b / MAP_W) - Math.floor(a / MAP_W);
      if (k < n - 2 && (dx !== pdx || dy !== pdy)) {
        if (count < max - 1) { out[count * 2] = (a % MAP_W) + 0.5; out[count * 2 + 1] = Math.floor(a / MAP_W) + 0.5; count++; }
      }
      pdx = dx; pdy = dy;
    }
    out[count * 2] = fx; out[count * 2 + 1] = fy; count++;
    return count;
  }
}

/** tile-space centre of a building's footprint */
export function centreX(b: Building): number { return b.x + b.w / 2; }
export function centreY(b: Building): number { return b.y + b.h / 2; }
