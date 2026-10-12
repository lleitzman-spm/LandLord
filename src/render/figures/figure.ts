/**
 * A living figurine: a turned peg, a painted face that moves, two floating
 * mittens. Six draw calls, one shared material, and a frame update that is a
 * page of arithmetic.
 *
 *   group                 placed by whoever owns the figure (never rotated here)
 *   ├ ring / base / emote selection ring, the ruler's gilded base, the sign over the head
 *   └ turn                heading (and the figure's own scale)
 *     └ sway              the waddle: rock, hop, squash
 *       ├ body
 *       ├ head ── head mesh, crown, face
 *       ├ handL ─ mitten (+ off-hand prop)
 *       └ handR ─ mitten, prop
 */
import * as THREE from 'three';
import type { Figure, FigureSpec, RenderCtx, Env } from '../api';
import type { AnimId, EmoteId } from '../../data/ids';
import { PAL, mat } from '../palette';
import { resolveLook, radiusAt, type Look, type PropId } from './look';
import { buildBody, buildHead, buildCrown } from './parts';
import { propModel, type PropModel } from './props';
import { Face } from './face';
import {
  ANIM, REACT_DUR, applyReact, rest, POSE_N, type AnimCtx, type ReactKind,
  Y, SQ, ROLL, PITCH, YAW, FWD, HYAW, HPITCH, HROLL, LX, LY, LZ, RX, RY, RZ, LROT, RROT, PROP, PROPR,
  BLINK, LID, SMILE, MOUTH, CURVE, WIDE, BROW, TILT, SKEW, GAZEX, GAZEY,
} from './anim';
import { emoteQuad, emoteMaterial } from './emotes';
import { Sculpt } from './sculpt';
import { TAU, clamp, clamp01, damp, dampAngle, ease, easeBack, hash01, wrapPi } from './util';

export interface LivingFigure extends Figure {
  readonly look: Look;
  /** pick radius, world units */
  readonly radius: number;
  readonly anim: AnimId;
  /** a third argument gives the height of the thing looked at (the camera, a griffin on a roof) */
  lookAt(wx: number | null, wz?: number, wy?: number): void;
  setHeading(rad: number, snap?: boolean): void;
  heading(): number;
  /** accepts the trade tools as well as the public prop list */
  setProp(prop: PropId): void;
  /** pop a small sign above the head */
  emote(id: EmoteId): void;
  /** 0 calm .. 1 shifting from foot to foot (a petitioner kept waiting) */
  setRestless(v: number): void;
  /** settle down where they stand (a doorstep, the rim of the well) */
  setSit(on: boolean): void;
  /** null: gait follows real movement. A number: walk on the spot at that speed (galleries). */
  setGait(speed: number | null): void;
}

// ───────────── shared resources ─────────────

let _mat: THREE.Material | null = null;
/** the one material every figurine is painted with */
export function figureMaterial(): THREE.Material {
  return _mat ?? (_mat = mat(0xffffff, { vertexColors: true, flat: false, rough: 0.74 }));
}
let _gold: THREE.Material | null = null;
function goldMaterial(): THREE.Material {
  return _gold ?? (_gold = mat(0xffffff, { vertexColors: true, flat: false, rough: 0.3, metal: 0.25, emissive: PAL.goldDark, emissiveIntensity: 0.5 }));
}
const hands = new Map<number, THREE.BufferGeometry>();
function handGeo(skin: number): THREE.BufferGeometry {
  let g = hands.get(skin);
  if (!g) {
    // a left mitten: thumb toward the body and a little forward
    g = new Sculpt().ball(1, skin, 0, 0, 0, 0.9, 1.12, 0.84, false, 1).ball(0.44, skin, -0.68, 0.22, 0.42, 1, 1.1, 1, false, 1).build();
    hands.set(skin, g);
  }
  return g;
}
let _ringGeo: THREE.BufferGeometry | null = null, _ringMat: THREE.Material | null = null, _baseGeo: THREE.BufferGeometry | null = null;
function ringGeo(): THREE.BufferGeometry {
  if (!_ringGeo) {
    // a dashed ring, so its turning can be seen
    const s = new Sculpt();
    for (let i = 0; i < 8; i++) s.add(new THREE.RingGeometry(0.86, 1, 5, 1, i / 8 * TAU, TAU / 8 * 0.72), PAL.gold, true, new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    _ringGeo = s.build();
  }
  return _ringGeo;
}
function ringMat(): THREE.Material {
  return _ringMat ?? (_ringMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false, fog: false }));
}
function baseGeo(): THREE.BufferGeometry {
  if (!_baseGeo) {
    const s = new Sculpt();
    s.lathe([{ r: 1.06, y: 0 }, { r: 1.08, y: 0.045, crease: true }, { r: 0.96, y: 0.085, crease: true }, { r: 0.0, y: 0.09 }], 20, PAL.gold, true);
    _baseGeo = s.build();
  }
  return _baseGeo;
}

const HAT_RISE: Partial<Record<Look['hat'], number>> = {
  wizard: 2.0, tallhat: 1.3, mitre: 1.5, toque: 1.0, crown_great: 1.3, crown: 0.6, coronet: 0.35, plumed: 1.1, pot: 0.7, feathercap: 0.9, straw: 0.4, veil: 0.4,
  kettle: 0.25, helm: 0.4, beret: 0.3, flatcap: 0.25, bowler: 0.5, singed: 0.4, hood: 0.2, deephood: 0.25, wig: 0.15,
};
/** these are work: they slow and stop with the game clock. The rest are talk and feeling, and run in real time. */
const WORK: Partial<Record<AnimId, true>> = { hammer: true, sweep: true, count: true, knock: true };

const _q = new THREE.Quaternion();
/** where a head rests when nothing has its attention (see anim.ts) */
const HEAD_REST = -0.12;

export function createLivingFigure(spec: FigureSpec, ctx: RenderCtx): LivingFigure {
  const L = resolveLook(spec);
  const M = figureMaterial();
  const group = new THREE.Group();
  const turn = new THREE.Group(); turn.scale.setScalar(L.scale); group.add(turn);
  const sway = new THREE.Group(); sway.rotation.order = 'YXZ'; turn.add(sway);

  const body = new THREE.Mesh(buildBody(L), M); body.castShadow = true; body.receiveShadow = true; sway.add(body);
  const head = new THREE.Group(); head.rotation.order = 'YXZ'; head.position.y = L.headY;
  head.scale.set(L.headR * L.headSX, L.headR * L.headSY, L.headR); sway.add(head);
  const headMesh = new THREE.Mesh(buildHead(L), M); headMesh.castShadow = true; headMesh.receiveShadow = true; head.add(headMesh);
  const crownGeo = buildCrown(L);
  if (crownGeo) { const c = new THREE.Mesh(crownGeo, goldMaterial()); c.castShadow = true; head.add(c); }
  const face = new Face(L.face, M); head.add(face.mesh);

  const hg = handGeo(L.skin);
  const handL = new THREE.Group(), handR = new THREE.Group();
  const mL = new THREE.Mesh(hg, M); mL.scale.setScalar(L.handR); mL.receiveShadow = true; handL.add(mL);
  const mR = new THREE.Mesh(hg, M); mR.scale.set(-L.handR, L.handR, L.handR); mR.receiveShadow = true; handR.add(mR);
  sway.add(handL, handR);
  const holder = new THREE.Group(); holder.scale.setScalar(L.propScale); handR.add(holder);
  const propMesh = new THREE.Mesh(hg, M); propMesh.visible = false; holder.add(propMesh);
  let glowMesh: THREE.Mesh | null = null;
  let prop: PropId = 'none', model: PropModel | null = null;
  // the off hand (a steward's quill, a chief's scroll)
  const off = propModel(L.offProp);
  if (off) { const o = new THREE.Mesh(off.geo, M); o.scale.setScalar(L.propScale); o.rotation.z = -0.25; handL.add(o); }

  let base: THREE.Mesh | null = null;
  if (L.base) {
    base = new THREE.Mesh(baseGeo(), goldMaterial());
    base.scale.set(L.bodyR * L.scale * 1.32, L.bodyR * L.scale * 2.2, L.bodyR * L.scale * 1.32); base.receiveShadow = true; base.castShadow = true;
    group.add(base);
  }
  const baseLift = L.base ? L.bodyR * 0.195 : 0;

  const hatRise = (HAT_RISE[L.hat] ?? 0) * (L.tinyHat ? 0.5 : 1);
  const height = (L.headY + L.headR * L.headSY * (1 + hatRise) + baseLift) * L.scale;
  const radius = Math.max(L.bodyR, L.headR * L.headSX) * 1.2 * L.scale;
  const H = L.bodyH, R = L.bodyR, side = radiusAt(L, 0.5) + L.handR * 1.12;
  const stride = clamp((L.bodyH + L.headR) * L.scale / 0.33, 0.55, 1.6);

  // ── state ──
  const seed = L.seed;
  const c: AnimCtx = {
    T: hash01(seed + 5) * 20, ph: hash01(seed + 11) * TAU, mood: 0.6, wp: hash01(seed + 3) * TAU, ga: 0, speed: 0, restless: 0, sit: false,
    yHead: L.headY / H, yTop: (L.headY + L.headR * L.headSY) / H, long: false, hangs: false, tilt: 2.1, side: hash01(seed + 7) < 0.5 ? -1 : 1,
  };
  let anim: AnimId = 'idle', animT = hash01(seed + 2) * 3, blend = 1;
  const from = new Float32Array(POSE_N), cur = new Float32Array(POSE_N), out = new Float32Array(POSE_N);
  rest(out);
  let headingNow = 0, headingGoal = 0;
  let lookOn = false, lookX = 0, lookZ = 0, lookY = NaN, lookYaw = 0, lookPitch = 0;
  let moodGoal = 0.6;
  let nextBlink = c.T + 0.5 + hash01(seed + 21) * 4, blinkT = 9, blinkN = 0;
  let nextGaze = c.T + hash01(seed + 23) * 3, gazeGX = 0, gazeGY = 0, gazeX = 0, gazeY = 0;
  let reactKind: ReactKind | null = null, reactT = 0;
  let lastX = NaN, lastZ = 0, gait: number | null = null;
  let selected = false, ring: THREE.Mesh | null = null;
  let emoteMesh: THREE.Mesh | null = null, emoteT = -1, emoteLife = 2;
  let nextAuto = c.T + 1.5;
  let rnd = (seed * 2654435761) >>> 0;
  const rand = () => { rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0; return rnd / 4294967296; };
  let disposed = false;

  function setProp(p: PropId): void {
    if (p === prop) return;
    prop = p; model = propModel(p);
    if (!model) { propMesh.visible = false; if (glowMesh) glowMesh.visible = false; c.long = false; c.hangs = false; return; }
    propMesh.geometry = model.geo; propMesh.visible = true;
    if (model.glow && model.glowMat) {
      if (!glowMesh) { glowMesh = new THREE.Mesh(model.glow, model.glowMat); holder.add(glowMesh); }
      glowMesh.geometry = model.glow; glowMesh.material = model.glowMat; glowMesh.visible = true;
    } else if (glowMesh) glowMesh.visible = false;
    c.long = model.long; c.hangs = model.hangs;
    c.tilt = Math.PI - Math.acos(clamp(0.98 * H / (model.reach * L.propScale), 0.25, 1));
  }
  setProp(L.prop);

  function emote(id: EmoteId): void {
    const m = emoteMaterial();
    if (!m) return;
    if (!emoteMesh) { emoteMesh = new THREE.Mesh(emoteQuad(id), m); emoteMesh.renderOrder = 20; emoteMesh.frustumCulled = false; group.add(emoteMesh); }
    emoteMesh.geometry = emoteQuad(id); emoteMesh.visible = true; emoteT = 0; emoteLife = id === 'zzz' ? 2.6 : 2.1;
  }

  const fig: LivingFigure = {
    group, height, look: L, radius,
    get anim() { return anim; },
    setAnim(a: AnimId) {
      if (a === anim) return;
      from.set(out); blend = 0; anim = a; animT = 0;
      nextAuto = c.T + 0.6;
    },
    lookAt(wx: number | null, wz?: number, wy?: number) {
      if (wx === null || wz === undefined) { lookOn = false; return; }
      lookOn = true; lookX = wx; lookZ = wz; lookY = wy === undefined ? NaN : wy;
    },
    setHeading(rad: number, snap?: boolean) { headingGoal = rad; if (snap) { headingNow = rad; turn.rotation.y = rad; } },
    heading() { return headingNow; },
    setProp,
    setMood(m: number) { moodGoal = clamp01(m); },
    react(kind: ReactKind) { reactKind = kind; reactT = 0; },
    setSelected(on: boolean) {
      if (on === selected) return;
      selected = on;
      if (on) {
        if (!ring) { ring = new THREE.Mesh(ringGeo(), ringMat()); ring.position.y = 0.012; ring.renderOrder = 5; group.add(ring); }
        ring.visible = true; reactKind = 'hop'; reactT = 0;
      } else if (ring) ring.visible = false;
    },
    emote,
    setRestless(v: number) { c.restless = clamp01(v); },
    setSit(on: boolean) { c.sit = on; },
    setGait(v: number | null) { gait = v; },

    update(env: Env) {
      if (disposed) return;
      const dt = env.dt > 0.1 ? 0.1 : env.dt;
      c.T += dt;
      const T = c.T;

      // ── how fast are we really going? ──
      const px = group.position.x, pz = group.position.z;
      let v = 0;
      if (gait !== null) v = gait;
      else if (lastX === lastX && dt > 1e-5) { const d = Math.hypot(px - lastX, pz - lastZ); v = d > 1.5 ? 0 : d / dt; }
      lastX = px; lastZ = pz;
      c.speed = damp(c.speed, v, 12, dt);
      const sp = c.speed;
      const cadence = Math.min(sp * 2.4 / stride, (1.1 + 1.5 * Math.tanh(sp / 1.8)) / Math.sqrt(stride));
      c.wp += cadence * TAU * dt;
      if (c.wp > 1e4) c.wp -= TAU * 1000;
      c.ga = ease((sp - 0.02) / 0.2);
      c.mood = damp(c.mood, moodGoal, 2.5, dt);

      // ── the pose ──
      const rate = WORK[anim] ? (env.speed >= 1 ? 1 + (env.speed - 1) * 0.22 : env.speed <= 0 ? 0 : 0.35 + env.speed * 0.65) : 1;
      animT += dt * rate;
      rest(cur);
      ANIM[anim](cur, animT, c);
      if (blend < 1) {
        blend += dt / 0.2;
        const k = ease(blend);
        for (let i = 0; i < POSE_N; i++) out[i] = from[i]! + (cur[i]! - from[i]!) * k;
      } else out.set(cur);

      // ── life on top ──
      const m = c.mood;
      const slump = ease((0.36 - m) / 0.3), perk = ease((m - 0.7) / 0.25);
      out[PITCH]! += 0.07 * slump; out[HPITCH]! += 0.2 * slump - 0.04 * perk; out[SQ]! -= 0.02 * slump;
      out[LY]! -= 0.05 * slump; out[RY]! -= 0.05 * slump;
      out[CURVE]! += clamp((m - 0.58) * 1.7, -0.95, 0.65);
      out[TILT]! += slump * 0.75; out[LID]! -= slump * 0.28; out[BROW]! += perk * 0.15;
      if (out[SMILE]! < perk * 0.22) out[SMILE] = perk * 0.22;
      const br = Math.sin(T * 1.7 + c.ph) * 0.011;
      out[SQ]! += br; out[LY]! += br; out[RY]! += br;
      if (c.sit) { out[SQ]! -= 0.11; out[PITCH]! -= 0.06; }

      // blink
      if (T >= nextBlink) { blinkT = 0; blinkN++; nextBlink = T + (rand() < 0.14 ? 0.26 : 1.6 + rand() * 4.2); }
      if (blinkT < 0.15) { blinkT += dt; const b = Math.sin(clamp01(blinkT / 0.15) * Math.PI); if (b > out[BLINK]!) out[BLINK] = b; }

      // look-at: eyes first, then the head, then (lazily) the rest
      let yawGoal = 0, pitchGoal = 0;
      if (lookOn) {
        const dx = lookX - px, dz = lookZ - pz, dist = Math.hypot(dx, dz);
        if (dist > 0.05) {
          const rel = wrapPi(Math.atan2(dx, dz) - headingNow - out[YAW]!);
          yawGoal = clamp(rel, -1.2, 1.2);
          if (c.ga < 0.2 && Math.abs(rel) > 0.5) headingGoal = headingNow + rel * 0.6;
          if (lookY === lookY) pitchGoal = clamp(-Math.atan2(lookY - (group.position.y + L.headY * L.scale), dist), -0.75, 0.4) - HEAD_REST;
        }
        const lead = clamp((yawGoal - lookYaw) * 2.2, -1, 1);
        gazeGX = lead; gazeGY = clamp(-(pitchGoal - lookPitch) * 2, -1, 1);
      } else if (T >= nextGaze) {
        nextGaze = T + 0.9 + rand() * 3.2;
        if (rand() < 0.42) { gazeGX = 0; gazeGY = 0; } else { gazeGX = rand() * 2 - 1; gazeGY = rand() * 1.2 - 0.6; }
      }
      lookYaw = damp(lookYaw, yawGoal, 6.5, dt); lookPitch = damp(lookPitch, pitchGoal, 6.5, dt);
      gazeX = damp(gazeX, gazeGX, 16, dt); gazeY = damp(gazeY, gazeGY, 16, dt);

      if (reactKind) {
        reactT += dt;
        const u = reactT / REACT_DUR[reactKind];
        if (u >= 1) reactKind = null; else applyReact(out, reactKind, u);
      }

      // ── onto the wood ──
      headingNow = dampAngle(headingNow, headingGoal, 9, dt);
      turn.rotation.y = headingNow;
      const roll = out[ROLL]!, pitch = out[PITCH]!, sq = out[SQ]!;
      // a peg rocks on the rim of its base; it never sinks into the table
      const lift = R * 0.93 * (Math.abs(Math.sin(roll)) + Math.abs(Math.sin(pitch)));
      sway.position.set(0, out[Y]! + lift + baseLift, out[FWD]! * H);
      sway.rotation.set(pitch, out[YAW]!, roll);
      sway.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
      head.rotation.set(out[HPITCH]! + lookPitch, out[HYAW]! * (lookOn ? 0.25 : 1) + lookYaw, out[HROLL]!);
      handL.position.set(out[LX]! * side, out[LY]! * H, out[LZ]! * R); handL.rotation.z = out[LROT]!;
      handR.position.set(-out[RX]! * side, out[RY]! * H, out[RZ]! * R); handR.rotation.z = -out[RROT]!;
      holder.rotation.set(out[PROP]!, 0, out[PROPR]!);

      face.blink = out[BLINK]!; face.lid = 1 + out[LID]!; face.smile = out[SMILE]!;
      face.gazeX = out[GAZEX]! + gazeX; face.gazeY = out[GAZEY]! + gazeY;
      face.browRaise = out[BROW]!; face.browTilt = out[TILT]!; face.browSkew = out[SKEW]!;
      face.mouthOpen = out[MOUTH]!; face.mouthCurve = out[CURVE]!; face.mouthWide = 1 + out[WIDE]!;
      face.update();

      // ── trimmings ──
      if (selected && ring) {
        ring.rotation.y += dt * 0.9;
        const s = radius * 1.75 * (1 + Math.sin(T * 4.2) * 0.05);
        ring.scale.set(s, 1, s);
      }
      if (T >= nextAuto) {
        if (anim === 'sleep') { emote('zzz'); nextAuto = T + 3.4 + rand() * 1.5; }
        else if (anim === 'dance') { if (rand() < 0.6) emote('music'); nextAuto = T + 2.6 + rand() * 2; }
        else nextAuto = T + 1;
      }
      if (emoteMesh && emoteT >= 0) {
        emoteT += dt;
        if (emoteT >= emoteLife) { emoteMesh.visible = false; emoteT = -1; }
        else {
          const a = easeBack(emoteT / 0.24), z = emoteT > emoteLife - 0.22 ? clamp01((emoteLife - emoteT) / 0.22) : 1;
          const s = 0.2 * a * z * (0.85 + 0.15 * L.scale);
          emoteMesh.scale.set(s, s, s);
          emoteMesh.position.set(0, height + 0.1 + emoteT * 0.035 + Math.sin(T * 5) * 0.006 + out[Y]!, 0);
          group.getWorldQuaternion(_q).invert();
          emoteMesh.quaternion.copy(_q).multiply(ctx.camera.quaternion);
        }
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      body.geometry.dispose(); headMesh.geometry.dispose(); face.dispose();
      if (crownGeo) crownGeo.dispose();
    },
  };
  void blinkN;
  return fig;
}

/** The contract's factory: every figurine in the game comes through here. */
export function createFigure(spec: FigureSpec, ctx: RenderCtx): Figure {
  return createLivingFigure(spec, ctx);
}
