/**
 * The guild halls — each of the realm's guilds has a hall on the continent,
 * manned (its master's standard raised) or vacant (a bare, shuttered hall).
 * Clicking a hall calls onSelectGuild.
 */

import { useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneGuild } from './scene';
import { guildHallPlot, landHeight } from './deriveLayout';
import { MAT, PALETTE } from './palette';
import { SmokeColumn } from './Effects';

export function GuildHalls({
  guilds,
  onSelect,
}: {
  guilds: SceneGuild[];
  onSelect?: (id: string) => void;
}) {
  return (
    <group>
      {guilds.map((g, i) => (
        <GuildHall key={g.id} guild={g} index={i} onSelect={onSelect} />
      ))}
    </group>
  );
}

function GuildHall({
  guild,
  index,
  onSelect,
}: {
  guild: SceneGuild;
  index: number;
  onSelect?: (id: string) => void;
}) {
  // The hall stands on the Capital's commons — world plot, world ground,
  // turned to face the seat it serves.
  const hl = guildHallPlot(index);
  const y = Math.max(0.1, landHeight(hl.hx, hl.hz));
  const [hover, setHover] = useState(false);
  const manned = guild.manned;

  return (
    <group
      position={[hl.hx, y, hl.hz]}
      rotation={[0, hl.rotY, 0]}
      scale={0.72}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(guild.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      {/* A broad, low hall — grander than a cottage, humbler than a keep. */}
      <mesh castShadow receiveShadow material={manned ? MAT.keepWall : MAT.stoneDark} position={[0, 0.58, 0]}>
        <boxGeometry args={[1.8, 1.16, 1.4]} />
      </mesh>
      <mesh castShadow material={MAT.roofGuild} position={[0, 1.42, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.5, 0.95, 4]} />
      </mesh>
      {/* A brass finial — the mark of the realm's own offices, read from above. */}
      <mesh material={MAT.goldTrim} position={[0, 2.02, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
      </mesh>
      {/* Windows: lit if manned, shuttered if vacant. */}
      <mesh material={manned ? MAT.windowLit : MAT.windowDark} position={[0, 0.5, 0.71]}>
        <planeGeometry args={[0.8, 0.35]} />
      </mesh>
      {/* The master's standard — raised when manned, furled when vacant. */}
      <group position={[1.1, 0, 0]}>
        <mesh castShadow material={MAT.bannerPole} position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 2.2, 5]} />
        </mesh>
        {manned ? (
          // Tilted toward the sky — the survey camera looks DOWN; a straight
          // vertical cloth would foreshorten to a sliver.
          <mesh position={[0.02, 1.85, 0.1]} rotation={[-0.9, 0, 0]}>
            <planeGeometry args={[0.66, 0.44]} />
            <meshBasicMaterial color={PALETTE.brass} side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <mesh material={MAT.board} position={[0, 1.7, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.1, 0.5, 0.06]} />
          </mesh>
        )}
      </group>
      {manned && <SmokeColumn origin={[0.5, 1.4, -0.3]} count={2} />}
      {hover && (
        <Html position={[0, 2.8, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
          <div className="rl-tip">
            <strong>{guild.name}</strong>
            <span>{manned ? `${guild.masterName} holds the bench` : 'The bench stands vacant'}</span>
          </div>
        </Html>
      )}
    </group>
  );
}
