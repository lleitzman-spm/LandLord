/**
 * A fief — one SceneFief drawn as a TERRITORY, not a village (Edwin,
 * 2026-07-27: "this looks like a village around one big house"). A fief is a
 * stretch of LAND with a hand-drawn ink border, its name lettered on it,
 * holding fields and woods and lanes — and ONE modest town: the knight's
 * keep, a banner in the fief's health colour, and a close cluster of houses.
 * The rest of the doors spread through the land as farmsteads. The land
 * dominates; the town is a mark on the region, never the region.
 *
 *   thriving → green   strained → amber   failing → red
 *
 * This is the fief you click for onSelectFief; individual houses inside it
 * carry their own onSelectBuilding.
 */

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneFief } from './scene';
import {
  fiefAnchor,
  territoryOutline,
  territoryRadius,
  townLocal,
  fieldPlots,
  fiefTreeAt,
  FIEF_TREES,
  propLocal,
  buildingLocal,
  hash1,
  landHeight,
} from './deriveLayout';
import { BANNER, BANNER_TRIM, MAT, TOKEN, canopyColor, faithTint, softDiscTexture } from './palette';
import { Houses } from './Building';
import { SmokeColumn, Flame } from './Effects';

export function Fief({
  fief,
  index,
  count,
  onSelectFief,
  onSelectBuilding,
}: {
  fief: SceneFief;
  index: number;
  count: number;
  onSelectFief?: (id: string) => void;
  onSelectBuilding?: (fiefId: string, doorId: string) => void;
}) {
  const anchor = fiefAnchor(fief.id, index, count);
  const town = townLocal(fief.id);
  const townY = landHeight(anchor.x + town.x, anchor.z + town.z);
  const [hover, setHover] = useState(false);

  // The keep grows a little with the town's doors; faith tints its warmth.
  const keepScale = 0.9 + Math.min(0.5, fief.doorsHeld * 0.03);
  const lush = faithTint(fief.faith, TOKEN.townGreen, TOKEN.townGreenDrab);

  return (
    <group position={[anchor.x, 0, anchor.z]}>
      {/* The land the fief holds: border, name, fields, woods. */}
      <TerritoryBorder fief={fief} count={count} anchor={anchor} />
      <FiefName fief={fief} count={count} anchor={anchor} />
      <Fields fief={fief} count={count} anchor={anchor} />
      <FiefWoods fief={fief} count={count} anchor={anchor} />

      {/* The one town: tended ground, the keep, the banner, and its houses. */}
      <group position={[town.x, townY - 0.04, town.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <circleGeometry args={[3.4, 24]} />
          <meshBasicMaterial
            color={lush}
            map={softDiscTexture()}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
        <Keep
          fief={fief}
          scale={keepScale}
          onClick={() => onSelectFief?.(fief.id)}
          onHover={setHover}
        />
        <Banner color={BANNER[fief.health]} height={2.9 * keepScale} />
        {hover && (
          <Html position={[0, 3.4, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
            <div className="rl-tip rl-tip--fief">
              <strong>{fief.name}</strong>
              <span>
                {fief.seatLabel ? `${fief.seatLabel} · ` : ''}
                {fief.doorsHeld} door{fief.doorsHeld === 1 ? '' : 's'} held ·{' '}
                {fief.health}
              </span>
            </div>
          </Html>
        )}
      </group>

      {/* The doors — town houses close in, farmsteads out on the land. */}
      <Houses fief={fief} anchor={anchor} onSelect={onSelectBuilding} />

      {/* The fief's life — smoke over held chimneys, trouble over crises. */}
      <FiefLife fief={fief} anchor={anchor} />
    </group>
  );
}

// ── The territory's ink border ─────────────────────────────────────────────

/** The fief's border, drawn as a mapmaker draws one: a firm hand-wobbled ink
 *  loop lying ON the land, riding the terrain. */
function TerritoryBorder({
  fief,
  count,
  anchor,
}: {
  fief: SceneFief;
  count: number;
  anchor: { x: number; z: number };
}) {
  const geom = useMemo(() => {
    const pts = territoryOutline(fief.id, count);
    const positions: number[] = [];
    const indices: number[] = [];
    const halfW = 0.13;
    const n = pts.length;
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n];
      const prev = pts[(i - 1 + n) % n];
      const next = pts[(i + 1) % n];
      // The loop's tangent, for a perpendicular ribbon.
      let tx = next.x - prev.x;
      let tz = next.z - prev.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      const y = Math.max(0.08, landHeight(anchor.x + p.x, anchor.z + p.z)) + 0.14;
      positions.push(p.x - tz * halfW, y, p.z + tx * halfW);
      positions.push(p.x + tz * halfW, y, p.z - tx * halfW);
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [fief.id, count, anchor.x, anchor.z]);
  return <mesh geometry={geom} material={MAT.borderInk} />;
}

// ── The fief's name, lettered on its land ──────────────────────────────────

function FiefName({
  fief,
  count,
  anchor,
}: {
  fief: SceneFief;
  count: number;
  anchor: { x: number; z: number };
}) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = TOKEN.letteringLand;
    ctx.font = 'italic 700 66px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    // Gently letter-spaced, as a surveyor letters a district.
    const name = fief.name.toUpperCase();
    const widths = name.split('').map((g) => ctx.measureText(g).width);
    const gap = 6;
    const total = widths.reduce((a, b) => a + b + gap, -gap);
    let x = (c.width - total) / 2;
    name.split('').forEach((g, i) => {
      ctx.fillText(g, x + widths[i] / 2, c.height / 2);
      x += widths[i] + gap;
    });
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }, [fief.name]);

  // Lettered across the open land, away from the town.
  const town = townLocal(fief.id);
  const r = territoryRadius(fief.id, count);
  const tl = Math.hypot(town.x, town.z) || 1;
  const lx = (-town.x / tl) * r * 0.42;
  const lz = (-town.z / tl) * r * 0.42 * 0.7;
  const y = Math.max(0.1, landHeight(anchor.x + lx, anchor.z + lz)) + 0.16;
  const w = 3.8 + fief.name.length * 0.36;
  return (
    <mesh position={[lx, y, lz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, w / 4]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

// ── The fields ─────────────────────────────────────────────────────────────

/** Tilled strips of dark loam (with furrows) and pasture, laid through the
 *  territory — the land at WORK, which is what a fief is. */
function Fields({
  fief,
  count,
  anchor,
}: {
  fief: SceneFief;
  count: number;
  anchor: { x: number; z: number };
}) {
  const { plots, furrows } = useMemo(() => {
    const plots = fieldPlots(fief.id, count);
    const furrows: { x: number; z: number; y: number; rotY: number; len: number }[] = [];
    for (const p of plots) {
      if (!p.tilled) continue;
      const y = Math.max(0.06, landHeight(anchor.x + p.x, anchor.z + p.z));
      const cos = Math.cos(p.rotY);
      const sin = Math.sin(p.rotY);
      for (let f = -1.5; f <= 1.5; f++) {
        const off = (f * p.w) / 4.4;
        furrows.push({
          x: p.x + cos * off,
          z: p.z - sin * off,
          y,
          rotY: p.rotY,
          len: p.d * 0.86,
        });
      }
    }
    return { plots, furrows };
  }, [fief.id, count, anchor.x, anchor.z]);

  const plotMesh = useMemo(() => {
    const geom = new THREE.BoxGeometry(1, 0.12, 1);
    const mesh = new THREE.InstancedMesh(geom, MAT.field, plots.length); // 0 draws nothing
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const tilled = new THREE.Color(TOKEN.fieldTilled);
    const pastureBase = new THREE.Color(TOKEN.pasture);
    const pastureDrab = new THREE.Color(TOKEN.pastureDrab);
    const col = new THREE.Color();
    plots.forEach((p, i) => {
      const y = Math.max(0.06, landHeight(anchor.x + p.x, anchor.z + p.z));
      e.set(0, p.rotY, 0);
      q.setFromEuler(e);
      s.set(p.w, 1, p.d);
      m.compose(new THREE.Vector3(p.x, y + 0.02, p.z), q, s);
      mesh.setMatrixAt(i, m);
      if (p.tilled) col.copy(tilled);
      else col.copy(pastureDrab).lerp(pastureBase, 0.3 + hash1(i * 17 + 3) * 0.7);
      // Faith dims the fields too — a failing fief's land looks tired.
      col.lerp(new THREE.Color(TOKEN.fieldFurrow), (1 - fief.faith / 100) * 0.25);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [plots, anchor.x, anchor.z, fief.faith]);

  const furrowMesh = useMemo(() => {
    const geom = new THREE.BoxGeometry(0.07, 0.035, 1);
    const mesh = new THREE.InstancedMesh(geom, MAT.furrow, furrows.length); // 0 draws nothing
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    furrows.forEach((f, i) => {
      e.set(0, f.rotY, 0);
      q.setFromEuler(e);
      s.set(1, 1, f.len);
      m.compose(new THREE.Vector3(f.x, f.y + 0.1, f.z), q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [furrows]);

  return (
    <group>
      <primitive object={plotMesh} receiveShadow />
      <primitive object={furrowMesh} />
    </group>
  );
}

// ── The fief's woods ───────────────────────────────────────────────────────

function FiefWoods({
  fief,
  count,
  anchor,
}: {
  fief: SceneFief;
  count: number;
  anchor: { x: number; z: number };
}) {
  const meshes = useMemo(() => {
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.06, 0.11, 0.6, 5),
      MAT.trunk,
      FIEF_TREES,
    );
    const canopies = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.4, 1.35, 6),
      MAT.canopy,
      FIEF_TREES,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < FIEF_TREES; i++) {
      const t = fiefTreeAt(fief.id, i, count);
      const h = landHeight(anchor.x + t.x, anchor.z + t.z);
      if (h <= 0) {
        s.setScalar(0);
        m.compose(new THREE.Vector3(t.x, -10, t.z), q, s);
        trunks.setMatrixAt(i, m);
        canopies.setMatrixAt(i, m);
        continue;
      }
      q.setFromEuler(new THREE.Euler(0, t.rotY, 0));
      s.setScalar(t.s);
      m.compose(new THREE.Vector3(t.x, h + 0.25 * t.s, t.z), q, s);
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, h + 1.1 * t.s, t.z), q, s);
      canopies.setMatrixAt(i, m);
      canopies.setColorAt(i, canopyColor(t.hue, col));
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    return { trunks, canopies };
  }, [fief.id, count, anchor.x, anchor.z]);
  return (
    <group>
      <primitive object={meshes.trunks} castShadow />
      <primitive object={meshes.canopies} castShadow />
    </group>
  );
}

// ── The keep ───────────────────────────────────────────────────────────────

function Keep({
  fief,
  scale,
  onClick,
  onHover,
}: {
  fief: SceneFief;
  scale: number;
  onClick: () => void;
  onHover: (b: boolean) => void;
}) {
  const troubled = fief.health === 'failing';
  return (
    <group
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      {/* The hall */}
      <mesh castShadow receiveShadow material={MAT.keepWall} position={[0, 0.55, 0]}>
        <boxGeometry args={[1.5, 1.1, 1.3]} />
      </mesh>
      {/* Timber corners */}
      <mesh castShadow material={MAT.timber} position={[0.72, 0.55, 0.62]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
      </mesh>
      <mesh castShadow material={MAT.timber} position={[-0.72, 0.55, 0.62]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
      </mesh>
      {/* The tower */}
      <mesh castShadow material={MAT.stone} position={[0, 1.1, -0.4]}>
        <cylinderGeometry args={[0.4, 0.46, 2.2, 8]} />
      </mesh>
      <mesh castShadow material={MAT.roofSolid} position={[0, 2.4, -0.4]}>
        <coneGeometry args={[0.52, 0.7, 8]} />
      </mesh>
      {/* The hall's roof */}
      <mesh castShadow material={MAT.roofSolid} position={[0, 1.35, 0.15]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.15, 0.8, 4]} />
      </mesh>
      {/* Warm windows if any door is held, dark if the town is failing. */}
      <mesh material={troubled ? MAT.windowDark : MAT.windowLit} position={[0, 0.6, 0.66]}>
        <planeGeometry args={[0.5, 0.3]} />
      </mesh>
      {troubled && <Flame position={[0, 2.8, -0.4]} />}
    </group>
  );
}

// ── The banner ─────────────────────────────────────────────────────────────

function Banner({ color, height }: { color: string; height: number }) {
  return (
    <group position={[0.9, 0, 0.9]}>
      <mesh castShadow material={MAT.bannerPole} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, height, 5]} />
      </mesh>
      {/* The cloth — the fief's health, writ large and TILTED toward the sky:
          the survey camera looks down, and a vertical cloth foreshortens to a
          sliver. This glance matters more than anything else here. */}
      <mesh position={[0.72, height - 0.42, 0.16]} rotation={[-0.85, 0, 0]}>
        <planeGeometry args={[1.4, 0.85]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.72, height - 0.02, 0.02]} rotation={[-0.85, 0, 0]}>
        <planeGeometry args={[1.44, 0.09]} />
        <meshBasicMaterial color={BANNER_TRIM} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── The fief's life (smoke & trouble) ──────────────────────────────────────

function FiefLife({ fief, anchor }: { fief: SceneFief; anchor: { x: number; z: number } }) {
  const bits = useMemo(() => {
    const arr: React.ReactNode[] = [];
    fief.buildings.forEach((b, i) => {
      // Skip the manor (index 0) — the keep carries its own trouble.
      if (i === 0) return;
      const house = buildingLocal(fief.id, b.id, i, fief.buildings.length, b.kind);
      const y = Math.max(0, landHeight(anchor.x + house.x, anchor.z + house.z));
      if (b.state === 'held' && i % 5 === 0) {
        const p = propLocal(fief.id, b.id, 0);
        arr.push(
          <SmokeColumn key={`s${b.id}`} origin={[house.x + p.x, y + 1.0, house.z + p.z]} count={2} />,
        );
      }
      if (b.state === 'crisis') {
        arr.push(
          <SmokeColumn key={`c${b.id}`} origin={[house.x, y + 0.9, house.z]} count={3} dark spread={0.4} />,
          <Flame key={`f${b.id}`} position={[house.x, y + 0.8, house.z]} />,
        );
      }
    });
    return arr;
  }, [fief, anchor.x, anchor.z]);
  return <group>{bits}</group>;
}
