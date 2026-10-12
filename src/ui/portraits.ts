/**
 * OWNER: ui-portraits agent. Code-drawn, animated ink-and-wash faces.
 *
 * A portrait is one SVG assembled from parts by `seed` (see ./portraits/):
 * head and shoulders in a roundel, in the manner of a manuscript miniature.
 * This file is the living half: it puts the drawing in the page and keeps it
 * alive. Faces blink at their own intervals, glance about or follow a point,
 * breathe, flap their mouths while talking, and reshape brows, lids, mouth
 * and cheeks for each of the nine moods.
 *
 * One shared animation loop serves every portrait. A face is only stepped
 * while it is on screen and attached, and only repainted when something on
 * it is actually moving. `prefers-reduced-motion` gets still faces that
 * change expression at once.
 */
import type { Species, TradeId, NpcId } from '../data/ids';
import type { StaffRole, RankId } from '../sim/types';
import type { Mood } from '../word/api';
import { buildPortrait, composeSvg } from './portraits/build';
import { faceFrame, withRest, type Pose } from './portraits/features';
import { moodExpr } from './portraits/genome';
import { makeRand, clamp, lerp, ease, type Rand } from './portraits/util';
import type { Expr, FrameAttrs, Genome, Lod } from './portraits/types';

export interface PortraitSpec {
  species: Species;
  seed: number;
  trade?: TradeId;
  role?: StaffRole | 'ruler';
  rank?: RankId;
  npc?: NpcId;
  /** hints from CharacterDef / NpcDef */
  look?: { hair?: string; beard?: boolean; hat?: string; feature?: string };
  /** CSS pixels (square). Portraits must read at 40px (lists) and at 360px (audience). */
  size: number;
  /** draw the roundel frame (gold ring, lapis ground) */
  frame?: boolean;
}
export interface Portrait {
  el: HTMLElement;
  setMood(mood: Mood): void;
  /** mouth flaps while true */
  setTalking(on: boolean): void;
  /** eyes follow a point in the element's own box, 0..1 (null = wander) */
  lookAt(x: number | null, y?: number): void;
  dispose(): void;
}

export const PORTRAIT_MOODS: readonly Mood[] = ['neutral', 'pleased', 'delighted', 'worried', 'annoyed', 'angry', 'smug', 'sad', 'afraid'];

/** A still portrait as one self-contained SVG string (no animation). */
export function portraitSvg(spec: PortraitSpec, mood: Mood = 'neutral'): string {
  return composeSvg(buildPortrait(spec, mood), spec.size);
}

// ───────────── the page side ─────────────

const CSS = `
.llp{position:relative;display:inline-block;flex:none;line-height:0;border-radius:50%;vertical-align:middle;user-select:none;-webkit-user-select:none}
.llp>svg{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden}
.llp .llp-b{transform-origin:100px 206px;animation:llp-breathe 4.8s ease-in-out infinite}
.llp.llp-l1 .llp-b{animation-name:llp-breathe1}
.llp.llp-l0 .llp-b{animation:none}
.llp .llp-flame{transform-box:fill-box;transform-origin:50% 100%;animation:llp-flick 1.1s ease-in-out infinite}
.llp .llp-glow{animation:llp-glow 2.8s ease-in-out infinite}
.llp .llp-smoke{animation:llp-smoke 3.6s ease-in-out infinite}
.llp .llp-bub{animation:llp-bub 1.9s ease-in infinite}
.llp .llp-bee{animation:llp-bee 2.6s ease-in-out infinite}
.llp .llp-tail{animation:llp-tail 4.2s ease-in-out infinite}
.llp .llp-sand{animation:llp-sand .8s linear infinite;stroke-dasharray:1.5 1.5}
.llp.llp-talk .llp-ring{animation:llp-swing .46s ease-in-out infinite alternate}
.llp.llp-off *{animation-play-state:paused!important}
@keyframes llp-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-1px) scale(1.007,1.012)}}
@keyframes llp-breathe1{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-1.5px) scale(1.01,1.016)}}
@keyframes llp-flick{0%,100%{transform:scale(1) skewX(0)}30%{transform:scale(.92,1.08) skewX(-5deg)}60%{transform:scale(1.05,.94) skewX(4deg)}80%{transform:scale(.97,1.04) skewX(-2deg)}}
@keyframes llp-glow{0%,100%{opacity:.2}50%{opacity:.5}}
@keyframes llp-smoke{0%{opacity:0;transform:translateY(3px)}35%{opacity:1}100%{opacity:0;transform:translateY(-5px)}}
@keyframes llp-bub{0%{opacity:0;transform:translateY(3px)}30%{opacity:1}100%{opacity:0;transform:translateY(-5px)}}
@keyframes llp-bee{0%,100%{transform:translate(0,0)}25%{transform:translate(2.5px,-3px)}50%{transform:translate(-1.5px,-1px)}75%{transform:translate(1.5px,2.5px)}}
@keyframes llp-tail{0%,100%{transform:rotate(0)}40%{transform:rotate(7deg)}70%{transform:rotate(-5deg)}}
@keyframes llp-sand{to{stroke-dashoffset:-3}}
@keyframes llp-swing{from{transform:rotate(-13deg)}to{transform:rotate(13deg)}}
@media (prefers-reduced-motion:reduce){.llp *{animation:none!important}}
`;

let cssDone = false;
function ensureCss(): void {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  if (document.getElementById('llp-css')) return;
  const st = document.createElement('style');
  st.id = 'llp-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

const reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = (): boolean => !!reduceMq && reduceMq.matches;

// ───────────── one loop for every face ─────────────

const live = new Set<Face>();
const byEl = new WeakMap<Element, Face>();
let raf = 0;
let io: IntersectionObserver | null = null;
let ioTried = false;

function observer(): IntersectionObserver | null {
  if (ioTried) return io;
  ioTried = true;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(entries => {
      for (const en of entries) byEl.get(en.target)?.seen(en.isIntersecting);
    }, { rootMargin: '48px' });
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  return io;
}
function wake(): void {
  if (raf || !live.size || typeof requestAnimationFrame !== 'function') return;
  if (typeof document !== 'undefined' && document.hidden) return;
  raf = requestAnimationFrame(tick);
}
function tick(now: number): void {
  raf = 0;
  for (const p of live) p.step(now);
  wake();
}

/** Mouth shapes for speech: [open, wide, teeth]. A handful is enough to read as talking. */
const VISEMES: readonly (readonly [number, number, number])[] = [
  [0.5, 1, 0.4], [0.16, 1.08, 0.2], [0.74, 0.9, 0.5], [0.06, 1, 0], [0.36, 0.7, 0], [0.6, 1.1, 0.6], [0.24, 0.84, 0.1], [0.44, 0.96, 0.3],
];
const EXPR_KEYS: (keyof Expr)[] = ['browIn', 'browOut', 'browArch', 'browSkew', 'lid', 'squint', 'pupil', 'gazeX', 'gazeY', 'smile', 'open', 'wide', 'skew', 'wob', 'teeth', 'blush', 'flush', 'pale', 'tilt', 'dx', 'dy', 'shake', 'sweat', 'tear', 'furrow'];
/** how often each mood blinks, as a multiplier on the gap between blinks */
const BLINK_PACE: Record<string, number> = { neutral: 1, pleased: 1, delighted: 1.2, worried: 0.6, annoyed: 1.5, angry: 1.7, smug: 1.6, sad: 0.8, afraid: 0.45 };

class Face implements Portrait {
  readonly el: HTMLElement;
  private readonly g: Genome;
  private readonly lod: Lod;
  private readonly rnd: Rand;
  private readonly parts = new Map<string, Element[]>();
  private readonly slots = new Map<string, [Element[], string]>();
  private last: FrameAttrs;
  private mood: Mood = 'neutral';
  private cur: Expr;
  private from: Expr;
  private to: Expr;
  private tweenAt = -1;
  private tweenMs = 0;
  // blink
  private blinkAt = 0;
  private blinkT0 = -1;
  private blinkAgain = false;
  private blink = 0;
  // gaze
  private gx = 0; private gy = 0; private tx = 0; private ty = 0;
  private gazeAt = 0;
  private follow: { x: number; y: number } | null = null;
  // talk
  private talking = false;
  private env = 0;
  private vFrom: readonly [number, number, number] = [0, 1, 0];
  private vTo: readonly [number, number, number] = [0, 1, 0];
  private vT0 = 0; private vMs = 110; private vCount = 0;
  // housekeeping
  private visible: boolean;
  private gone = false;
  private dirty = false;
  private lastNow = 0;
  private lastPaint = 0;
  private started = false;

  constructor(spec: PortraitSpec) {
    ensureCss();
    const size = Math.max(8, Math.round(spec.size) || 40);
    const b = buildPortrait({ ...spec, size });
    this.g = b.g; this.lod = b.lod; this.last = { ...b.frame };
    this.rnd = makeRand((b.g.seed ^ 0x2c1b3c6d) + size);
    this.cur = withRest(b.g.rest, moodExpr('neutral'));
    this.from = this.cur; this.to = this.cur;

    const el = document.createElement('div');
    el.className = 'llp llp-l' + b.lod;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.dataset.mood = 'neutral';
    const clip = b.uid + 'rc';
    const breathe = `animation-duration:${(4.2 + this.rnd() * 1.4).toFixed(2)}s;animation-delay:${(-this.rnd() * 5).toFixed(2)}s`;
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">`
      + `<defs><clipPath id="${clip}"><circle cx="100" cy="100" r="${b.framed ? 97 : 99}"/></clipPath></defs>`
      + b.ground + `<g clip-path="url(#${clip})"><g class="llp-b" style="${breathe}">${b.bust}</g></g>` + b.ring + '</svg>';
    el.querySelectorAll('[data-k]').forEach(n => {
      const k = n.getAttribute('data-k') as string;
      const list = this.parts.get(k);
      if (list) list.push(n); else this.parts.set(k, [n]);
    });
    this.el = el;
    byEl.set(el, this);
    const ob = observer();
    // without an observer, assume on screen and let isConnected decide
    this.visible = !ob;
    if (ob) ob.observe(el); else this.enlist();
  }

  // ── the public face
  setMood(mood: Mood): void {
    if (this.gone || mood === this.mood) return;
    this.mood = mood;
    this.el.dataset.mood = mood;
    this.from = this.cur;
    this.to = withRest(this.g.rest, moodExpr(mood));
    // off screen (or newly made) there is nobody to watch the change: just be in the new mood
    if (reduced() || !this.visible) { this.cur = this.to; this.tweenAt = -1; this.paint(this.lastNow); return; }
    this.tweenAt = -2; // start on the next step
    this.tweenMs = mood === 'afraid' || mood === 'angry' ? 190 : 300;
    // people blink when their face changes
    if (this.blinkT0 < 0 && this.rnd() < 0.6) this.blinkAt = 0;
    this.poke();
  }
  setTalking(on: boolean): void {
    if (this.gone || on === this.talking) return;
    this.talking = on;
    this.el.classList.toggle('llp-talk', on);
    if (on) { this.vFrom = [0, 1, 0]; this.vTo = VISEMES[0]; this.vT0 = -1; this.vCount = 0; }
    if (reduced()) { this.env = on ? 1 : 0; this.vFrom = this.vTo = on ? [0.3, 1, 0.2] : [0, 1, 0]; this.paint(this.lastNow); return; }
    this.poke();
  }
  lookAt(x: number | null, y?: number): void {
    if (this.gone) return;
    if (x === null || x === undefined || Number.isNaN(x)) { this.follow = null; this.gazeAt = 0; }
    else this.follow = { x: clamp((x - 0.5) * 2.4, -1, 1), y: clamp(((y ?? 0.42) - 0.42) * 2.2, -1, 1) };
    if (reduced()) { if (this.follow) { this.gx = this.follow.x; this.gy = this.follow.y; } else { this.gx = 0; this.gy = 0; } this.paint(this.lastNow); return; }
    this.poke();
  }
  dispose(): void {
    if (this.gone) return;
    this.gone = true;
    this.talking = false;
    live.delete(this);
    io?.unobserve(this.el);
    byEl.delete(this.el);
    this.el.classList.add('llp-off');
    this.el.classList.remove('llp-talk');
  }

  // ── the loop's side
  seen(on: boolean): void {
    if (this.gone) return;
    this.visible = on;
    this.el.classList.toggle('llp-off', !on);
    if (on) this.enlist(); else live.delete(this);
  }
  private enlist(): void {
    if (this.gone) return;
    live.add(this);
    this.started = false;
    this.dirty = true;
    wake();
  }
  private poke(): void {
    this.dirty = true;
    if (this.visible) { live.add(this); wake(); }
  }

  step(now: number): void {
    if (this.gone) { live.delete(this); return; }
    if (!this.el.isConnected) { if (!io) return; live.delete(this); return; }
    if (!this.started) {
      // first frame on screen: set the clocks from here so nobody blinks in unison
      this.started = true;
      this.lastNow = now;
      if (this.blinkAt <= 0 || this.blinkAt < now - 4000) this.blinkAt = now + 500 + this.rnd() * 4200;
      if (this.gazeAt <= 0) this.gazeAt = now + 600 + this.rnd() * 2600;
    }
    const dt = Math.min(100, now - this.lastNow);
    this.lastNow = now;
    const still = reduced();
    let moving = this.dirty;

    // mood
    if (this.tweenAt !== -1) {
      if (this.tweenAt === -2) this.tweenAt = now;
      const t = still ? 1 : clamp((now - this.tweenAt) / this.tweenMs, 0, 1);
      this.cur = t >= 1 ? this.to : mixExpr(this.from, this.to, ease(t));
      if (t >= 1) this.tweenAt = -1;
      moving = true;
    }
    if (!still) {
      // blink
      if (this.blinkT0 < 0 && now >= this.blinkAt) { this.blinkT0 = now; this.blinkAgain = this.rnd() < 0.14; }
      if (this.blinkT0 >= 0) {
        const t = now - this.blinkT0;
        const b = t < 70 ? ease(t / 70) : t < 105 ? 1 : t < 230 ? 1 - ease((t - 105) / 125) : 0;
        if (t >= 230) {
          this.blinkT0 = -1;
          const pace = BLINK_PACE[this.mood] ?? 1;
          this.blinkAt = this.blinkAgain ? now + 90 : now + (1700 + this.rnd() * 4600 + (this.rnd() < 0.2 ? 2600 : 0)) * pace;
          this.blinkAgain = false;
        }
        if (b !== this.blink) { this.blink = b; moving = true; }
      }
      // gaze: quick hops, long rests, mostly at the viewer
      if (this.follow) { this.tx = this.follow.x; this.ty = this.follow.y; }
      else if (now >= this.gazeAt) {
        const roll = this.rnd();
        if (roll < 0.5) { this.tx = 0; this.ty = 0; }
        else if (roll < 0.86) { this.tx = (this.rnd() < 0.5 ? -1 : 1) * (0.35 + this.rnd() * 0.5); this.ty = (this.rnd() - 0.5) * 0.5; }
        else { this.tx = (this.rnd() - 0.5) * 0.6; this.ty = this.rnd() < 0.6 ? 0.55 : -0.5; }
        this.gazeAt = now + (this.tx === 0 ? 1400 + this.rnd() * 3200 : 500 + this.rnd() * 1300);
      }
      const ddx = this.tx - this.gx, ddy = this.ty - this.gy;
      if (Math.abs(ddx) > 0.004 || Math.abs(ddy) > 0.004) {
        const k = Math.min(1, dt * (this.follow ? 0.012 : 0.02));
        this.gx += ddx * k; this.gy += ddy * k;
        moving = true;
      } else if (ddx || ddy) { this.gx = this.tx; this.gy = this.ty; moving = true; }
      // speech
      const want = this.talking ? 1 : 0;
      if (this.env !== want) { this.env = want > this.env ? Math.min(1, this.env + dt / 90) : Math.max(0, this.env - dt / 140); moving = true; }
      if (this.talking) {
        if (this.vT0 < 0) this.vT0 = now;
        if (now - this.vT0 >= this.vMs) {
          this.vFrom = this.vTo;
          this.vCount++;
          // every few syllables, a breath
          const rest = this.vCount > 4 && this.rnd() < 0.2;
          if (rest) { this.vTo = [0.02, 1, 0]; this.vMs = 130 + this.rnd() * 190; this.vCount = 0; }
          else { let n = VISEMES[Math.floor(this.rnd() * VISEMES.length)]; if (n === this.vFrom) n = VISEMES[(VISEMES.indexOf(n) + 3) % VISEMES.length]; this.vTo = n; this.vMs = 80 + this.rnd() * 75; }
          this.vT0 = now;
        }
        moving = true;
      }
      if (this.cur.shake > 0.02) moving = true;
    }
    if (!moving) return;
    // small faces need not repaint at full rate
    const gap = this.lod === 0 ? 66 : this.lod === 1 ? 30 : 0;
    if (gap && now - this.lastPaint < gap && this.tweenAt === -1) { this.dirty = true; return; }
    this.paint(now);
  }

  private paint(now: number): void {
    this.dirty = false;
    this.lastPaint = now;
    let e = this.cur;
    const pose: Pose = { blink: this.blink, gx: this.gx, gy: this.gy };
    const still = reduced();
    if (this.env > 0.001) {
      const vt = this.vT0 < 0 || still ? 1 : clamp((now - this.vT0) / this.vMs, 0, 1), k = ease(vt), en = this.env;
      const vo = lerp(this.vFrom[0], this.vTo[0], k), vw = lerp(this.vFrom[1], this.vTo[1], k), vth = lerp(this.vFrom[2], this.vTo[2], k);
      e = { ...e };
      e.open = lerp(e.open, Math.max(vo, e.open * 0.35 * vo), en);
      e.wide = e.wide * lerp(1, vw, en);
      e.teeth = Math.max(e.teeth, vth * en);
      e.smile = e.smile * (1 - 0.3 * en * vo);
      e.wob = e.wob * (1 - 0.6 * en);
      if (!still) {
        pose.nod = en * Math.sin(now / 170) * 0.55 * (this.lod === 0 ? 1.6 : 1);
        e.browArch += en * 0.7 * Math.max(0, Math.sin(now / 510 + this.g.seed));
        e.tilt += en * 0.7 * Math.sin(now / 730 + this.g.seed);
      }
    }
    if (e.shake > 0.02 && !still) {
      pose.jx = Math.sin(now * 0.052) * 0.75 * e.shake;
      pose.jy = Math.cos(now * 0.071) * 0.4 * e.shake;
    }
    const fr = faceFrame(this.g, this.lod, e, pose);
    const last = this.last;
    for (const key in fr) {
      const v = fr[key];
      if (last[key] === v) continue;
      last[key] = v;
      let slot = this.slots.get(key);
      if (!slot) {
        const i = key.lastIndexOf('.');
        slot = [this.parts.get(key.slice(0, i)) ?? [], key.slice(i + 1)];
        this.slots.set(key, slot);
      }
      for (const n of slot[0]) n.setAttribute(slot[1], v);
    }
  }
}

function mixExpr(a: Expr, b: Expr, t: number): Expr {
  const o = { ...a };
  for (const k of EXPR_KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

export function createPortrait(spec: PortraitSpec): Portrait {
  return new Face(spec);
}
