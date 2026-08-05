/**
 * Smoke and fire — the lively bits that make a held house read alive and a
 * crisis house read in trouble. Sprites on a shared soft-disc texture,
 * drifting upward in a useFrame loop. Deterministic phase from the building
 * id, never Math.random().
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { softDiscTexture, TOKEN } from './palette';
import { hash1 } from './deriveLayout';

export interface Puff {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  scale: number;
}

/** A drifting column of smoke wisp sprites. */
export function SmokeColumn({
  origin,
  count,
  dark,
  spread,
}: {
  origin: [number, number, number];
  count: number;
  dark?: boolean;
  spread?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo<Puff[]>(() => {
    const arr: Puff[] = [];
    const base = Math.floor(origin[0] * 97 + origin[2] * 131 + 1000);
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (hash1(base + i * 11) - 0.5) * (spread ?? 0.2),
        y: i * 0.4,
        z: (hash1(base + i * 23) - 0.5) * (spread ?? 0.2),
        phase: hash1(base + i * 37) * Math.PI * 2,
        speed: 0.5 + hash1(base + i * 53) * 0.4,
        scale: 0.3 + (i / count) * (dark ? 1.1 : 0.5),
      });
    }
    return arr;
  }, [origin, count, dark, spread]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.children.forEach((child, i) => {
      const p = puffs[i];
      const rise = ((t * p.speed + p.phase) % 2.4);
      child.position.set(
        p.x + Math.sin(t * 0.6 + p.phase) * 0.12,
        rise,
        p.z,
      );
      const s = p.scale * (0.6 + rise * 0.4);
      child.scale.setScalar(s);
      const mat = (child as THREE.Sprite).material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, (dark ? 0.6 : 0.4) * (1 - rise / 2.4));
    });
  });

  return (
    <group position={origin}>
      <group ref={group}>
        {puffs.map((_, i) => (
          <sprite key={i}>
            <spriteMaterial
              map={softDiscTexture()}
              color={dark ? TOKEN.smokeDark : TOKEN.smoke}
              transparent
              opacity={0.3}
              depthWrite={false}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}

/** A licking flame at a crisis house's roof. */
export function Flame({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const s = ref.current;
    if (!s) return;
    const t = clock.getElapsedTime();
    const flicker = 0.7 + Math.abs(Math.sin(t * 9) * 0.3) + Math.sin(t * 23) * 0.08;
    s.scale.set(0.5 * flicker, 0.7 * flicker, 1);
    const mat = s.material as THREE.SpriteMaterial;
    mat.opacity = 0.75 + Math.sin(t * 11) * 0.2;
  });
  return (
    <sprite ref={ref} position={position}>
      <spriteMaterial map={softDiscTexture()} color={TOKEN.flame} transparent opacity={0.8} depthWrite={false} />
    </sprite>
  );
}
