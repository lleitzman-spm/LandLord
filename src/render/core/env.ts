/**
 * The month is the table's day. This turns the calendar into light:
 * dawn on Rent Day, a long warm afternoon, an orange dusk near phase 0.75,
 * a short blue night, then dawn again. It also keeps the slow things that
 * re-dress the table: season, lying snow, wind, overcast.
 */
import * as THREE from 'three';
import type { Env } from '../api';
import type { GameState, Season, WeatherKind } from '../../sim/types';
import { dateOf } from '../../sim/core';
import { clamp01, lerp, smoothstep, vnoise, damp, DEG } from './util';

/** Everything the light rig and the table dressing need beyond the public Env. */
export interface Sky {
  /** unit vector from the board toward the key light */
  sunDir: THREE.Vector3;
  keyColor: THREE.Color;
  keyIntensity: number;
  fillColor: THREE.Color;
  fillIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  /** multiplier on the candle point lights (they matter most at night) */
  candle: number;
  exposure: number;
  /** 0 fresh candles on the 1st .. 1 stubs at month end (eased, so the swap is a small event) */
  burn: number;
  /** 0 clear .. 1 heavy cloud */
  overcast: number;
  /** 0..1 daylight strength, for things that fade with the sun */
  day: number;
  /** season index 0..3 plus progress, e.g. 1.5 = midsummer */
  seasonF: number;
  year: number;
}

interface Stop { p: number; c: THREE.Color; i: number; el: number }
const K = (p: number, hex: number, i: number, el: number): Stop => ({ p, c: new THREE.Color(hex), i, el });
/** key light through the "day" part of the month (phase may be negative: first light before the 1st) */
const SUN: Stop[] = [
  K(-0.036, 0xff8466, 0.0, 6),
  K(-0.012, 0xffb08a, 1.7, 12),
  K(0.0, 0xffc496, 3.2, 19),      // dawn: Rent Day
  K(0.05, 0xffd4a6, 3.4, 27),
  K(0.16, 0xffe2bd, 3.4, 40),
  K(0.36, 0xfff0d6, 3.5, 57),
  K(0.56, 0xffdfb2, 3.4, 44),     // the long warm afternoon
  K(0.68, 0xffc587, 3.2, 27),
  K(0.75, 0xffa364, 3.0, 17),     // orange dusk
  K(0.80, 0xf6846a, 1.8, 11),
  K(0.842, 0xc0587e, 0.0, 5),
];
const SUN_START = SUN[0]!.p, SUN_END = SUN[SUN.length - 1]!.p;
const MOON_DIR = new THREE.Vector3(-0.46, 0.78, -0.42).normalize();
const MOON_COLOR = new THREE.Color(0x9ab4ff);

const SEASON_INDEX: Record<Season, number> = { spring: 0, summer: 1, autumn: 2, winter: 3 };
/** per season: light tint, sun elevation offset (deg), key strength */
const SEASON_LIGHT: { tint: THREE.Color; el: number; k: number }[] = [
  { tint: new THREE.Color(1.0, 1.0, 0.98), el: 0, k: 1.0 },
  { tint: new THREE.Color(1.03, 1.0, 0.93), el: 5, k: 1.04 },
  { tint: new THREE.Color(1.06, 0.97, 0.86), el: -4, k: 0.97 },
  { tint: new THREE.Color(0.94, 0.98, 1.07), el: -9, k: 0.9 },
];
const OVERCAST: Record<WeatherKind, number> = { clear: 0, heat: -0.15, rain: 0.55, storm: 0.85, snow: 0.5, fog: 0.62, hail: 0.6 };
const WIND: Record<WeatherKind, number> = { clear: 0.22, heat: 0.06, rain: 0.5, storm: 1.0, snow: 0.3, fog: 0.05, hail: 0.72 };

const DAY_SKY = new THREE.Color(0xb9cdf0), DUSK_SKY = new THREE.Color(0xa58fc4), DAWN_SKY = new THREE.Color(0xe6cdb6), NIGHT_SKY = new THREE.Color(0x4460b0);
const DAY_GROUND = new THREE.Color(0x76553a), DUSK_GROUND = new THREE.Color(0x6a4a44), NIGHT_GROUND = new THREE.Color(0x23203a);
const DAY_FILL = new THREE.Color(0x8fa9dc), NIGHT_FILL = new THREE.Color(0x5674c8);
const GREY = new THREE.Color(0x9aa3b0);
const _c = new THREE.Color();

export function nightOf(p: number): number {
  return smoothstep(0.795, 0.868, p) * (1 - smoothstep(0.945, 0.988, p));
}

export class EnvModel {
  readonly env: Env = { time: 0, dt: 0, monthPhase: 0, night: 0, season: 'spring', seasonT: 0, snow: 0, wind: 0.2, weather: 'clear', speed: 1 };
  readonly sky: Sky = {
    sunDir: new THREE.Vector3(0.5, 0.7, 0.5).normalize(), keyColor: new THREE.Color(0xffe2bd), keyIntensity: 3,
    fillColor: new THREE.Color(), fillIntensity: 0.4, hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiIntensity: 0.7,
    candle: 1, exposure: 1, burn: 0, overcast: 0, day: 1, seasonF: 0, year: 1,
  };
  private lastDay = -1e9;
  private snowReady = false;

  /** the next update snaps the slow things (snow, wind, candles) instead of easing them */
  jump(): void { this.lastDay = -1e9; }

  /** call once per frame with the live state */
  update(state: GameState | null, dt: number, time: number): void {
    const env = this.env, sky = this.sky;
    env.time = time; env.dt = dt;
    const day = state ? state.day : 0;
    const d = dateOf(day);
    const p = d.monthPhase;
    env.monthPhase = p;
    env.season = d.season;
    const dos = (d.month % 3) * 30 + d.dayOfMonthFloat;
    env.seasonT = dos / 90;
    env.speed = state ? state.speed : 1;
    env.weather = state ? state.weather : 'clear';
    env.night = nightOf(p);
    sky.seasonF = SEASON_INDEX[d.season] + env.seasonT;
    sky.year = d.year;

    // ── slow weather feelings
    const jumped = Math.abs(day - this.lastDay) > 1.5 || !this.snowReady;
    const dtDays = Math.max(0, day - this.lastDay);
    this.lastDay = day;
    const oc = OVERCAST[env.weather] ?? 0;
    sky.overcast = jumped ? oc : damp(sky.overcast, oc, 0.7, dt);
    const gust = vnoise(time * 0.11, 3.7) * 0.5 + vnoise(time * 0.37, 9.1) * 0.25;
    const windGoal = clamp01((WIND[env.weather] ?? 0.2) * (0.7 + gust) + gust * 0.08);
    env.wind = jumped ? windGoal : damp(env.wind, windGoal, 1.2, dt);

    // ── lying snow: settles through Firstfrost, lies all winter, melts in the first days of spring
    let snowGoal = 0;
    if (d.season === 'winter') snowGoal = smoothstep(3, 14, dos);
    else if (d.season === 'spring' && d.monthIndex >= 12) snowGoal = 1 - smoothstep(0, 11, dos);
    if (env.weather === 'snow') snowGoal = Math.max(snowGoal, 0.9);
    if (jumped) { env.snow = snowGoal; this.snowReady = true; }
    else env.snow = clamp01(snowGoal + (env.snow - snowGoal) * Math.exp(-dtDays * 0.9));

    // ── candles burn down across the month
    const burnGoal = p;
    // on the 1st a fresh candle is set in the holder: ease up to it instead of popping
    sky.burn = jumped || burnGoal >= sky.burn - 0.015 ? burnGoal : damp(sky.burn, burnGoal, 3.5, dt);

    // ── the key light
    const s0 = SEASON_LIGHT[SEASON_INDEX[d.season]]!;
    const s1 = SEASON_LIGHT[(SEASON_INDEX[d.season] + 1) % 4]!;
    const sb = smoothstep(0.8, 1.0, env.seasonT);   // lean into the next season near its end
    const elOff = lerp(s0.el, s1.el, sb), kMul = lerp(s0.k, s1.k, sb);
    const sp = p > 0.9 ? p - 1 : p;    // first light belongs to the coming month
    let moon = 0;
    if (sp >= SUN_START && sp <= SUN_END) {
      let a = SUN[0]!, b = SUN[1]!;
      for (let i = 0; i < SUN.length - 1; i++) { if (sp >= SUN[i]!.p) { a = SUN[i]!; b = SUN[i + 1]!; } }
      const t = clamp01((sp - a.p) / (b.p - a.p));
      sky.keyColor.copy(a.c).lerp(b.c, t);
      sky.keyIntensity = lerp(a.i, b.i, t) * kMul;
      const el = Math.max(9, lerp(a.el, b.el, t) + elOff * smoothstep(0, 0.1, sp) * (1 - smoothstep(0.7, 0.8, sp))) * DEG;
      const dayT = (sp - SUN_START) / (SUN_END - SUN_START);
      const az = lerp(16, 174, dayT) * DEG;   // east-south-east, round by the south, to the west
      sky.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
      sky.keyColor.r *= lerp(s0.tint.r, s1.tint.r, sb); sky.keyColor.g *= lerp(s0.tint.g, s1.tint.g, sb); sky.keyColor.b *= lerp(s0.tint.b, s1.tint.b, sb);
    } else {
      moon = smoothstep(0.85, 0.885, p) * (1 - smoothstep(0.93, 0.958, p));
      sky.sunDir.copy(MOON_DIR);
      sky.keyColor.copy(MOON_COLOR);
      sky.keyIntensity = 1.5 * moon;
    }
    sky.day = clamp01(1 - smoothstep(0.76, 0.85, p) + smoothstep(0.962, 1.0, p));

    // overcast flattens and cools the key
    const ocP = Math.max(0, sky.overcast), heat = Math.max(0, -sky.overcast);
    if (moon === 0) {
      sky.keyColor.lerp(GREY, ocP * 0.55);
      sky.keyIntensity *= 1 - ocP * 0.62 + heat * 0.5;
    } else sky.keyIntensity *= 1 - ocP * 0.5;

    // ── ambient: hemisphere + cool fill. When the sun is low the sky does more of the work,
    //    so the table never goes murkier at dawn than it is at night.
    const n = env.night;
    const dawnTint = p > 0.9 ? smoothstep(0.955, 1.0, p) : 1 - smoothstep(0.0, 0.06, p);
    const dusk = clamp01((smoothstep(0.66, 0.79, p) + dawnTint) * (1 - n));
    sky.hemiSky.copy(DAY_SKY).lerp(dawnTint > 0 ? DAWN_SKY : DUSK_SKY, dusk).lerp(NIGHT_SKY, n).lerp(GREY, ocP * 0.4 * (1 - n));
    sky.hemiGround.copy(DAY_GROUND).lerp(DUSK_GROUND, dusk).lerp(NIGHT_GROUND, n);
    if (env.snow > 0) sky.hemiGround.lerp(_c.set(0x8d9bb5), env.snow * 0.6 * (1 - n * 0.5));   // snow bounces cold light up
    sky.hemiIntensity = lerp(lerp(0.76, 1.2 + 0.28 * dawnTint, dusk), 0.95, n) * (1 + ocP * 0.3) * (1 + env.snow * 0.12);
    sky.fillColor.copy(DAY_FILL).lerp(NIGHT_FILL, Math.max(n, (dusk - dawnTint * 0.6) * 0.5));
    sky.fillIntensity = lerp(lerp(0.46, 0.8 + 0.12 * dawnTint, dusk), 0.72, n) * (1 + ocP * 0.25);
    sky.candle = 0.58 + 0.85 * Math.max(n, dusk * 0.45) + ocP * 0.15;
    sky.exposure = lerp(lerp(1.02, 1.2, dusk), 1.28, n) * (1 - ocP * 0.04) * (1 - 0.1 * env.snow * sky.day);
  }
}
