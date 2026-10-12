/**
 * ghost: a pale figure in what is very probably a sheet.
 * It comes out through a wall, hovers, peers about, now and then raises its
 * arms at nobody in particular, turns, and drifts back in through the wall.
 * Next time it tries a different wall. Faint by day; at night it glows.
 * Dismissed, it rises, thins and is gone.
 */
import * as THREE from 'three';
import { PAL, mat } from '../palette';
import {
  ball, bone, bump, clamp, glowDisc, glowMat, lerp, live, noise, smooth, span, spike, TAU,
  type Build, type Frame, type Spot,
} from './kit';

const PERIOD = 9.5, EXIT = 1.7;

export const ghost: Build = (s) => {
  const rnd = s.rnd;
  const body = mat(PAL.ghost, { emissive: PAL.ghost, emissiveIntensity: 0.45, transparent: true, opacity: 0.8, rough: 1 }, true);
  s.own.push(body);
  const dark = mat(PAL.window);

  // the sheet: a lathe with a hem that ripples
  const prof = [[0.14, 0], [0.122, 0.085], [0.113, 0.17], [0.11, 0.255], [0.092, 0.315], [0.052, 0.355], [0.001, 0.37]];   // hem first
  const SEG = 12, NP = prof.length;
  const lathe = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), SEG);
  s.own.push(lathe);
  const pos = lathe.attributes.position as THREE.BufferAttribute;
  const base = (pos.array as Float32Array).slice();

  const G = bone(s.group); G.visible = false;
  const sheet = live(new THREE.Mesh(lathe, body)); sheet.renderOrder = 4; G.add(sheet);
  const face = bone(G, 0, 0.255, 0.098);
  face.add(ball(dark, 0.02, 0.03, 0.012, -0.036, 0.012, 0, -0.1, -0.3, 0), ball(dark, 0.02, 0.03, 0.012, 0.036, 0.012, 0, -0.1, 0.3, 0), ball(dark, 0.015, 0.02, 0.012, 0, -0.05, 0.008));
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const a = bone(G, sx * 0.095, 0.2, 0.02);
    const m = live(spike(body, 0.04, 0.13, 0, 0, 0, 0, 0, 0, 5)); m.renderOrder = 4; a.add(m);
    arms.push(a);
  }
  const poolM = glowMat(PAL.ghost, 0.3, true); s.own.push(poolM);
  const pool = glowDisc(poolM, 0.34, 0, 0.02, 0); s.group.add(pool); pool.visible = false;

  // the walls it uses: by the door, and the two sides
  const df = s.doorSpot.face;
  const doorU = s.lateral(df, s.door);
  const side = doorU > 0 ? -1 : 1;
  const spots: Spot[] = [
    s.wall(df, clamp(doorU + side * (s.doorW * 0.5 + 0.3), -s.lat(df) + 0.12, s.lat(df) - 0.12), 0.3),
    s.wall((df + 1) % 4, (rnd() - 0.5) * s.lat((df + 1) % 4) * 0.8, 0.3),
    s.wall((df + 3) % 4, (rnd() - 0.5) * s.lat((df + 3) % 4) * 0.8, 0.3),
  ];
  let cycle = -1, spot = spots[0], drift = 0, fade = 0;

  return {
    exitDur: EXIT, keepHolders: true,
    update(f: Frame): void {
      const { env, t, dt, out } = f;
      const leaving = out >= 0;
      const ph = t / PERIOD, c = Math.floor(ph), k = ph - c;
      if (c !== cycle && !leaving) { cycle = c; spot = spots[((c % 3) + 3) % 3]; drift = (rnd() - 0.5) * 0.3; }

      // where along the in-and-out path
      const outD = 0.5, inD = -0.32;
      let d: number, turn = 0, boo = 0;
      if (k < 0.16) d = lerp(inD, outD, smooth(k / 0.16));
      else if (k < 0.56) { d = outD + 0.05 * Math.sin((k - 0.16) * 20); turn = smooth(span(k, 0.44, 0.56)); boo = bump(k, 0.27, 0.37); }
      else if (k < 0.72) { d = lerp(outD, inD, smooth((k - 0.56) / 0.16)); turn = 1; }
      else { d = inD; turn = 1; }
      const hidden = k >= 0.72 && !leaving;
      fade = clamp(fade + (hidden ? -dt * 4 : dt * 2.5));
      const side2 = (k - 0.36) * drift * 2;
      const bob = 0.1 + 0.035 * Math.sin(t * 1.9) + 0.02 * Math.sin(t * 3.1);
      let lift = 0, thin = 1, vis = fade;
      if (leaving) { lift = 1.3 * out * out; thin = 1 - 0.6 * out; vis = fade * (1 - smooth(out)); }
      G.visible = vis > 0.01;
      const px = spot.p.x + spot.n.x * d + spot.n.z * side2, pz = spot.p.z + spot.n.z * d - spot.n.x * side2;
      G.position.set(px, bob + lift, pz);
      G.rotation.set(0.08 * Math.sin(t * 1.3) + (d < outD - 0.05 && k < 0.5 ? 0.12 : 0), spot.yaw + turn * Math.PI + noise(t * 0.8, 2) * 0.5 * (1 - turn) * (k > 0.16 ? 1 : 0), 0.06 * Math.sin(t * 1.7));
      G.scale.set(thin * (1 + boo * 0.12), (1 + boo * 0.1) * (1 + (leaving ? out * 0.7 : 0)), thin * (1 + boo * 0.12));
      arms[0].rotation.z = 2.0 - boo * 1.3 + 0.12 * Math.sin(t * 2.3);
      arms[1].rotation.z = -2.0 + boo * 1.3 - 0.12 * Math.sin(t * 2.3 + 1);
      face.scale.y = 1 + boo * 0.5;

      // hem
      const arr = pos.array as Float32Array;
      for (let i = 0; i <= SEG; i++) {
        const a = (i / SEG) * TAU, wv = Math.sin(a * 4 + t * 5.5), wv2 = Math.sin(a * 3 - t * 4);
        for (let j = 0; j < 2; j++) {
          const q = (i * NP + j) * 3, amt = j === 0 ? 1 : 0.4;
          arr[q] = base[q] * (1 + 0.12 * wv2 * amt); arr[q + 2] = base[q + 2] * (1 + 0.12 * wv2 * amt);
          arr[q + 1] = base[q + 1] + 0.024 * wv * amt;
        }
      }
      pos.needsUpdate = true;

      const night = env.night;
      body.opacity = vis * (0.62 + 0.3 * night);
      body.emissiveIntensity = 0.3 + 0.75 * night + 0.1 * Math.sin(t * 3.3);
      pool.visible = G.visible && d > -0.1;
      if (pool.visible) { pool.position.set(px, 0.02, pz); poolM.opacity = vis * (0.1 + 0.4 * night) * (0.85 + 0.15 * Math.sin(t * 3.3)); }
    },
  };
};
