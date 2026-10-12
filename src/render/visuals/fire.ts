/**
 * fire: the roof is alight. Flames on the thatch and licking out of the
 * windows, embers going up, smoke leaning with the wind, and a warm glow that
 * pulses on the ground and carries the scene at night.
 * black_smoke: the chimney (and a window or two) pouring thick black smoke.
 * No lights are used: the glow is emissive paint and additive discs.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, billboard, bone, clamp, disc, glowDisc, glowMat, glowSprite, live, noise, quad, smooth, span, SHAPE, Swarm,
  type Build, type Frame,
} from './kit';

const fract = (v: number): number => v - Math.floor(v);

export const fire: Build = (s) => {
  const rnd = s.rnd;
  const outerM = mat(PAL.fire, { emissive: PAL.fire, emissiveIntensity: 1.5 });
  const innerM = mat(PAL.flameCore, { emissive: PAL.flame, emissiveIntensity: 1.9 });
  const emberM = mat(PAL.flame, { emissive: PAL.flame, emissiveIntensity: 2.2 });
  const smokeM = mat(PAL.soot, { transparent: true, opacity: 0.55, rough: 1 });

  // where it burns: along the ridge, two places on the slopes, and out of the windows
  type Site = { x: number; y: number; z: number; w: number; h: number; lx: number; lz: number };
  const sites: Site[] = [];
  const scorch = s.holder();
  const roofSite = (x: number, z: number, size: number): void => {
    const r = s.roofAt(x, z);
    sites.push({ x: r.p.x, y: r.p.y - 0.03, z: r.p.z, w: 0.17 * size, h: 0.44 * size, lx: 0, lz: 0 });
    scorch.add(aim(disc(mat(PAL.soot), 0.085 * size, 0.07 * size, r.p.x + r.n.x * 0.012, r.p.y + r.n.y * 0.012, r.p.z + r.n.z * 0.012, rnd() * 3), r.n.x, r.n.y, r.n.z));
  };
  const rl = Math.max(0.12, s.ridgeLen * 0.62);
  roofSite(s.perch.x, s.perch.z, 1.3);
  if (!s.peaked) for (const k of [-1, -0.5, 0.5, 1]) { const a = s.ridgeAt(rl * k); roofSite(a.x, a.z, 0.8 + rnd() * 0.45); }
  const dn = s.doorSpot.n, tx = dn.z, tz = -dn.x;
  for (const [u, v] of [[-0.5, 0.5], [0.42, 0.58], [0.0, 0.3], [0.1, -0.5], [-0.45, -0.4]]) {
    roofSite(s.perch.x + tx * u * s.lat(s.doorSpot.face) + dn.x * v * s.ext[s.doorSpot.face], s.perch.z + tz * u * s.lat(s.doorSpot.face) + dn.z * v * s.ext[s.doorSpot.face], 0.8 + rnd() * 0.3);
  }
  const wins = s.windows.slice(0, 3);
  for (const w of wins) {
    sites.push({ x: w.p.x + w.n.x * 0.05, y: w.p.y - 0.08, z: w.p.z + w.n.z * 0.05, w: 0.13, h: 0.34, lx: w.n.x, lz: w.n.z });
    scorch.add(quad(mat(PAL.soot), 0.2, 0.16, w.p.x + w.n.x * 0.012, w.p.y + 0.17, w.p.z + w.n.z * 0.012, 0, w.yaw, 0));
  }
  const NS = sites.length;
  const outer = new Swarm(SHAPE.flame(), outerM, NS * 2, s.own), inner = new Swarm(SHAPE.flame(), innerM, NS, s.own);
  const embers = new Swarm(SHAPE.oct(), emberM, 16, s.own), smoke = new Swarm(SHAPE.ico(), smokeM, 9, s.own);
  smoke.mesh.renderOrder = 3;
  s.group.add(outer.mesh, inner.mesh, embers.mesh, smoke.mesh);

  // glow: a pool on the ground and a soft ball of light round the roof
  const poolM = glowMat(PAL.fire, 0.4, true), haloM = glowMat(mix(PAL.fire, PAL.flame, 0.4), 0.3, true);
  s.own.push(poolM, haloM);
  const pool = glowDisc(poolM, Math.max(s.w, s.h) * 0.75 + 0.9, 0, 0.03, 0); s.group.add(pool);
  const haloY = s.eave + (s.ridgeY - s.eave) * 0.7;
  const halo = glowSprite(haloM, Math.max(0.5, haloY - 0.06), s.perch.x, haloY, s.perch.z); s.group.add(halo);

  return {
    exitDur: 1.5,
    update(f: Frame): void {
      const { env, t, age, out } = f;
      const grow = smooth(span(age, 0, 0.9)) * (out >= 0 ? 1 - smooth(out) : 1);
      const wind = env.wind;
      for (let i = 0; i < NS; i++) {
        const st = sites[i];
        const fl = 0.78 + 0.3 * noise(t * 6.5 + i * 7.3, 1) + 0.1 * Math.sin(t * 23 + i * 2);
        const wob = noise(t * 3.1 + i * 3.7, 2), lean = wind * 0.3;
        const h = st.h * fl * grow, w = st.w * (1.05 - 0.2 * (fl - 0.8)) * grow;
        outer.put(i * 2, st.x, st.y, st.z, w, h, w, wob * 0.16, t * 1.7 + i, -lean + wob * 0.12);
        const fl2 = 0.7 + 0.4 * noise(t * 8 + i * 5.1, 3);
        outer.put(i * 2 + 1, st.x + st.lx * 0.03 + wob * 0.03 + lean * 0.12, st.y + h * 0.55, st.z + st.lz * 0.03 + noise(t * 2.7 + i, 5) * 0.03, w * 0.55, h * 0.62 * fl2, w * 0.55, 0, -t * 2.2 + i, -lean * 1.4);
        inner.put(i, st.x + st.lx * 0.012, st.y + 0.005, st.z + st.lz * 0.012, w * 0.56, h * 0.6 * (0.85 + 0.25 * fl2), w * 0.56, 0, -t * 1.3 + i * 2, -lean * 0.7);
      }
      outer.commit(); inner.commit();
      for (let j = 0; j < 16; j++) {
        const p = fract(t * (0.42 + (j % 5) * 0.06) + j * 0.61803), st = sites[j % NS];
        const sc = 0.017 * (1 - p) * grow * (p < 0.05 ? p * 20 : 1);
        embers.put(j, st.x + Math.sin(p * 7 + j * 1.7) * 0.13 * p + wind * p * p * 0.7, st.y + 0.12 + p * (0.75 + (j % 3) * 0.18), st.z + Math.cos(p * 5 + j) * 0.13 * p, sc, sc, sc, p * 9, j, 0);
      }
      embers.commit();
      for (let j = 0; j < 9; j++) {
        const p = fract(t * 0.23 + j / 9);
        const sc = (0.07 + 0.2 * p) * Math.sin(Math.min(1, p * 5) * Math.PI / 2) * (1 - smooth(span(p, 0.72, 1))) * (0.4 + 0.6 * grow);
        smoke.put(j, s.perch.x + Math.sin(j * 2.4 + p * 3) * 0.14 + wind * p * 1.0, s.perch.y + 0.22 + p * 1.35, s.perch.z + Math.cos(j * 1.3 + p * 4) * 0.14, sc, sc * 0.9, sc, p * 2, j, 0);
      }
      smoke.commit();
      const pulse = 0.8 + 0.2 * noise(t * 7, 9) + 0.08 * Math.sin(t * 19);
      poolM.opacity = (0.16 + 0.5 * env.night) * pulse * grow;
      haloM.opacity = (0.16 + 0.3 * env.night) * pulse * grow;
      halo.scale.setScalar(0.94 + 0.08 * pulse); billboard(halo, s.ctx.camera);
    },
  };
};

export const blackSmoke: Build = (s) => {
  const smokeM = mat(mix(PAL.soot, PAL.clothBlack, 0.5), { transparent: true, opacity: 0.86, rough: 1 });
  const top = s.stack();
  const N = 13;
  const sw = new Swarm(SHAPE.ico1(), smokeM, N + 6, s.own); sw.mesh.renderOrder = 3; s.group.add(sw.mesh);
  // soot round the chimney pot and over a window
  const soot = s.holder();
  soot.add(ball(mat(PAL.soot), 0.13, 0.03, 0.13, top.x, top.y + 0.005, top.z));
  const seep = s.windows.slice(0, 2);
  for (const w of seep) soot.add(quad(mat(PAL.soot), 0.22, 0.2, w.p.x + w.n.x * 0.012, w.p.y + 0.18, w.p.z + w.n.z * 0.012, 0, w.yaw, 0));
  const seed = s.seed % 50;
  return {
    exitDur: 1.4,
    update(f: Frame): void {
      const { env, t, age, out } = f;
      const k = smooth(span(age, 0, 1.2)) * (out >= 0 ? 1 - smooth(out) : 1), wind = env.wind;
      for (let j = 0; j < N; j++) {
        const p = fract(t * 0.2 + j / N);
        const billow = 0.09 + 0.27 * Math.pow(p, 0.8);
        const sc = billow * Math.sin(Math.min(1, p * 6) * Math.PI / 2) * (1 - smooth(span(p, 0.78, 1))) * k;
        const sway = noise(t * 0.6 + j * 2.1, seed) * 0.12 * p;
        sw.put(j, top.x + Math.sin(j * 2.4) * 0.05 + sway + wind * (p * 0.5 + p * p * 1.1), top.y + 0.03 + p * 1.9, top.z + Math.cos(j * 1.9) * 0.05 + noise(t * 0.5 + j, seed + 1) * 0.1 * p, sc, sc * 0.92, sc, p * 1.5 + j, j * 1.3, 0);
      }
      for (let j = 0; j < 6; j++) {
        const w = seep[j % Math.max(1, seep.length)];
        if (!w) { sw.hide(N + j); continue; }
        const p = fract(t * 0.4 + j / 6);
        const sc = (0.035 + 0.055 * p) * Math.sin(Math.min(1, p * 5) * Math.PI / 2) * (1 - smooth(span(p, 0.5, 1))) * k;
        sw.put(N + j, w.p.x + w.n.x * (0.04 + 0.07 * p) + Math.sin(j * 3 + p * 4) * 0.03 + wind * p * 0.2, w.p.y + 0.08 + p * 0.42, w.p.z + w.n.z * (0.04 + 0.07 * p) + Math.cos(j * 2 + p * 3) * 0.03, sc, sc, sc, j, p * 2, 0);
      }
      sw.commit();
    },
  };
};
