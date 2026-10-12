/**
 * Atmosphere, always on: dust motes turning in the candlelight above the whole
 * table, falling leaves in autumn, blossom petals in spring, fireflies on
 * summer nights, and now and then a few birds crossing by day. The motes keep
 * drifting while the game is paused; the rest follows world time loosely.
 */
import { PAL, mix } from '../palette';
import { F_MOTE, F_GLOW } from './atlas';
import { T_LEAF, T_PETAL } from './atlas';
import { type SpriteLayer, K_GENERIC, K_FIREFLY, M_FACE, S_CONST, A_BLINK } from './sprites';
import { type Tumblers, TB_LEAF, TB_PETAL } from './tumblers';
import type { Birds } from './birds';
import type { Weather } from './weather';
import { type FxFrame, BOARD_HX, BOARD_HZ, TABLE_HX, TABLE_HZ, rand, linList, smooth } from './util';

const MOTE_COL = linList([mix(PAL.flameCore, PAL.flame, 0.35)]);
const FIREFLY_COL = new Float32Array([1.7, 2.1, 0.55]);
const LEAF_COLS = linList([PAL.leafAutumn, PAL.leafAutumn2, mix(PAL.leafAutumn, PAL.field, 0.5), mix(PAL.leafAutumn2, PAL.trunk, 0.3), PAL.goldDark]);
const PETAL_COLS = linList([mix(PAL.parchment, PAL.crimson, 0.42), mix(PAL.parchment, PAL.crimson, 0.32), mix(PAL.parchment, PAL.clothPlum, 0.4), mix(PAL.parchment, PAL.crimson, 0.18)]);

export class Atmos {
  private accMote = 0;
  private accFly = 0;
  private accLeaf = 0;
  private accPetal = 0;
  private birdT = rand(4, 10);

  constructor(private glow: SpriteLayer, private tumblers: Tumblers, private birds: Birds, private weather: Weather) {}

  private mote(ageFrac: number, night: number): void {
    const L = this.glow;
    const i = L.spawn(K_GENERIC, F_MOTE, M_FACE, false);
    if (i < 0) return;
    const life = rand(9, 16);
    L.pos(i, rand(-TABLE_HX, TABLE_HX), rand(0.4, 6), rand(-TABLE_HZ, TABLE_HZ));
    L.vel(i, rand(-0.06, 0.06), rand(-0.01, 0.035), rand(-0.06, 0.06));
    const s = Math.random() < 0.12 ? rand(0.07, 0.11) : rand(0.035, 0.065);
    L.size(i, s, s, 1);
    L.smode[i] = S_CONST;
    L.col(i, MOTE_COL, 0, (0.3 + 0.35 * night) * rand(0.6, 1.1), 0);
    L.fade(i, life, 0.25, 0.3);
    L.swayA[i] = rand(0.03, 0.07); L.swayF[i] = rand(0.3, 0.8);
    L.twA[i] = 0.55; L.twF[i] = rand(0.8, 2.4);
    L.age[i] = ageFrac * life;
  }

  private firefly(ageFrac: number): void {
    const L = this.glow;
    // a soft gaussian: additive, its middle saturates to a hot core and the rest is the glow
    const i = L.spawn(K_FIREFLY, F_GLOW, M_FACE, true);
    if (i < 0) return;
    const life = rand(8, 14);
    // the anchor lives in the velocity slots
    L.vel(i, rand(-BOARD_HX + 1, BOARD_HX - 1), rand(0.25, 1.3), rand(-BOARD_HZ + 1, BOARD_HZ - 1));
    L.pos(i, L.vx[i], L.vy[i], L.vz[i]);
    const s = rand(0.3, 0.42);
    L.size(i, s, s, 1);
    L.smode[i] = S_CONST;
    L.amode[i] = A_BLINK;
    L.col(i, FIREFLY_COL, 0, 0.95, 0);
    L.fade(i, life, 0.12, 0.2);
    L.age[i] = ageFrac * life;
  }

  private leaf(): void {
    const T = this.tumblers;
    const i = T.spawn(TB_LEAF, T_LEAF, true);
    if (i < 0) return;
    T.x[i] = rand(-BOARD_HX, BOARD_HX); T.y[i] = rand(2.6, 4.4); T.z[i] = rand(-BOARD_HZ, BOARD_HZ);
    const w = rand(0.17, 0.25);
    T.w[i] = w; T.h[i] = w * 1.2;
    const c = Math.floor(Math.random() * 5) * 3;
    T.r[i] = LEAF_COLS[c]; T.g[i] = LEAF_COLS[c + 1]; T.b[i] = LEAF_COLS[c + 2];
    T.grav[i] = -3; T.drag[i] = 1.1; T.term[i] = rand(0.42, 0.62);
    T.swayA[i] = rand(0.35, 0.6); T.swayF[i] = rand(1.1, 2.0); T.windR[i] = 0.8;
    T.wx[i] = rand(-4.5, 4.5); T.wy[i] = rand(-2, 2); T.wz[i] = rand(-3, 3);
    T.linger[i] = rand(4, 7);
  }

  private petal(): void {
    const T = this.tumblers;
    const i = T.spawn(TB_PETAL, T_PETAL, true);
    if (i < 0) return;
    T.x[i] = rand(-BOARD_HX, BOARD_HX); T.y[i] = rand(2.4, 4.2); T.z[i] = rand(-BOARD_HZ, BOARD_HZ);
    const w = rand(0.13, 0.17);
    T.w[i] = w; T.h[i] = w * 1.15;
    const c = Math.floor(Math.random() * 4) * 3;
    T.r[i] = PETAL_COLS[c]; T.g[i] = PETAL_COLS[c + 1]; T.b[i] = PETAL_COLS[c + 2];
    T.grav[i] = -2.5; T.drag[i] = 1.4; T.term[i] = rand(0.28, 0.42);
    T.swayA[i] = rand(0.4, 0.7); T.swayF[i] = rand(1.3, 2.4); T.windR[i] = 1.0;
    T.wx[i] = rand(-5, 5); T.wy[i] = rand(-3, 3); T.wz[i] = rand(-4, 4);
    T.linger[i] = rand(3, 5);
  }

  private moteTarget(f: FxFrame): number { return 150 * f.density; }
  private flyTarget(f: FxFrame): number {
    const env = f.env;
    const season = env.season === 'summer' ? 1 : env.season === 'spring' ? smooth(0.55, 1, env.seasonT) * 0.5 : 0;
    return 80 * f.density * season * smooth(0.3, 0.75, env.night) * (1 - this.weather.wet());
  }

  prewarm(f: FxFrame): void {
    const nm = Math.round(this.moteTarget(f));
    for (let k = 0; k < nm; k++) this.mote(Math.random(), f.env.night);
    const nf = Math.round(this.flyTarget(f));
    for (let k = 0; k < nf; k++) this.firefly(Math.random());
  }

  update(f: FxFrame): void {
    const env = f.env;
    // dust motes: real time, always
    this.accMote += (this.moteTarget(f) / 12.5) * f.dtR;
    while (this.accMote >= 1) { this.accMote -= 1; this.mote(0, env.night); }

    const dt = f.dtW;
    const wet = this.weather.wet();
    this.accFly += (this.flyTarget(f) / 11) * dt;
    while (this.accFly >= 1) { this.accFly -= 1; this.firefly(0); }

    if (env.season === 'autumn') {
      const s = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, env.seasonT * 1.1));
      const rate = 8 * f.density * s * (0.6 + 1.6 * env.wind) * (1 - wet * 0.35);
      this.accLeaf += rate * dt;
      while (this.accLeaf >= 1) { this.accLeaf -= 1; this.leaf(); }
    } else if (env.season === 'spring') {
      const s = 1 - env.seasonT * 0.75;
      const rate = 9 * f.density * s * (1 - wet * 0.6);
      this.accPetal += rate * dt;
      while (this.accPetal >= 1) { this.accPetal -= 1; this.petal(); }
    }

    // birds cross by day, in decent weather
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = rand(14, 38);
      if (env.night < 0.35 && wet < 0.45 && this.weather.stormy() < 0.2) {
        const size = env.season === 'winter' ? 2 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 4);
        this.birds.launch(size, 30);
      }
    }
  }
}
