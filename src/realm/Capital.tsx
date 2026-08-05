/**
 * The Capital — the walled city and its castle on the central hill, the seat
 * of the realm and CLEARLY grander than any fief's town (Edwin, 2026-07-27:
 * the Capital "must be clearly grander"): a double-tiered curtain wall with
 * many towers and a gatehouse, a dense city of roofs inside it, an inner
 * bailey, the great keep and its tall donjon over all, and the realm's brass
 * banner. Every stone is placed by hash — drawn, never rolled.
 */

import { useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CAPITAL_HILL, hash1, landHeight } from './deriveLayout';
import { MAT, PALETTE, TOKEN, faithTint } from './palette';
import { useInstanced, type Placement } from './instancing';
import { SmokeColumn } from './Effects';

const WALL_R = 6.4;
/** The gate faces south — the map's eye enters from the bottom. */
const GATE_ANGLE = Math.PI / 2;

/** The seat of the realm. It named itself on hover and opened nothing — the
 *  grandest object on the board was the one named thing that was not a door,
 *  while every keep, house, hall and rail seat around it opened something.
 *  (Audit, 2026-07-27.) */
export function Capital({ name, onSelect }: { name?: string; onSelect?: () => void }) {
  const [hover, setHover] = useState(false);
  const y = landHeight(CAPITAL_HILL.x, CAPITAL_HILL.z);
  return (
    <group
      position={[CAPITAL_HILL.x, y - 0.05, CAPITAL_HILL.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <Mound />
      <CurtainWall />
      <InnerCity />
      <InnerBailey />
      <GreatKeep />
      {/* The city's own smoke — a lived-in capital. */}
      <SmokeColumn origin={[2.2, 2.0, 1.4]} count={3} />
      <SmokeColumn origin={[-2.6, 1.8, -1.2]} count={2} />
      <SmokeColumn origin={[3.4, 1.8, -2.0]} count={2} />
      {hover && (
        <Html position={[0, 8.5, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
          <div className="rl-tip rl-tip--fief">
            <strong>{name ?? 'The Capital'}</strong>
            <span>The seat of the realm{onSelect ? ' — enter' : ''}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** The city's own rise — a broad stone-flagged mound the walls stand on, so
 *  the Capital reads as raised even where the hill is gentle. */
function Mound() {
  return (
    // The city's rise blends into the meadow it stands on — kept ground,
    // never a painted disc.
    <mesh receiveShadow position={[0, -0.14, 0]}>
      <cylinderGeometry args={[WALL_R + 1.4, WALL_R + 3.2, 0.9, 28]} />
      <meshToonMaterial color={TOKEN.land} />
    </mesh>
  );
}

function CurtainWall() {
  const segs = 34;
  // The wall — panels all round, save the gate's two panels.
  const placements = useMemo<Placement[]>(() => {
    const arr: Placement[] = [];
    const gate = Math.round((GATE_ANGLE / (Math.PI * 2)) * segs);
    for (let i = 0; i < segs; i++) {
      if (i === gate || i === (gate + 1) % segs) continue;
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      arr.push({ x: Math.cos(a) * WALL_R, y: 0.3, z: Math.sin(a) * WALL_R, rotY: -a + Math.PI / 2 });
    }
    return arr;
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BoxGeometry(1.24, 1.5, 0.44);
    g.translate(0, 0.75, 0);
    return g;
  }, []);
  const wall = useInstanced(geom, MAT.stone, placements);

  // The crenels — a thin toothed cap riding the wall top.
  const crenels = useMemo<Placement[]>(() => {
    const arr: Placement[] = [];
    const gate = Math.round((GATE_ANGLE / (Math.PI * 2)) * segs);
    for (let i = 0; i < segs; i++) {
      if (i === gate || i === (gate + 1) % segs) continue;
      for (let c = 0; c < 3; c++) {
        const a = ((i + 0.2 + c * 0.3) / segs) * Math.PI * 2;
        arr.push({ x: Math.cos(a) * WALL_R, y: 1.84, z: Math.sin(a) * WALL_R, rotY: -a + Math.PI / 2, scale: 1 });
      }
    }
    return arr;
  }, []);
  const crenelGeom = useMemo(() => new THREE.BoxGeometry(0.24, 0.24, 0.48), []);
  const crenelMesh = useInstanced(crenelGeom, MAT.stone, crenels);

  // The towers — twelve around the ring, none in the gate's mouth.
  const towers = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      const nearGate =
        Math.abs(((a - GATE_ANGLE + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.26;
      if (nearGate) continue;
      arr.push({
        x: Math.cos(a) * WALL_R,
        y: 0.3,
        z: Math.sin(a) * WALL_R,
        scale: 0.94 + hash1(101 + i) * 0.18,
      });
    }
    return arr;
  }, []);
  const towerGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.38, 0.5, 2.5, 7);
    g.translate(0, 1.25, 0);
    return g;
  }, []);
  const towerMesh = useInstanced(towerGeom, MAT.stoneDark, towers);

  return (
    <group>
      <primitive object={wall} castShadow receiveShadow />
      <primitive object={crenelMesh} castShadow />
      <primitive object={towerMesh} castShadow />
      {/* Tower caps — slate cones over the wall, oxblood kept for the keep. */}
      {towers.map((t, i) => (
        <mesh
          key={i}
          material={MAT.roofSolid}
          castShadow
          position={[t.x, 0.3 + 2.5 * t.scale, t.z]}
        >
          <coneGeometry args={[0.5 * t.scale, 0.66 * t.scale, 7]} />
        </mesh>
      ))}
      <Gatehouse />
    </group>
  );
}

/** The gatehouse — twin drum towers flanking the south gate, an arch of
 *  timber between them: the mouth every ink road runs toward. */
function Gatehouse() {
  const gx = Math.cos(GATE_ANGLE) * WALL_R;
  const gz = Math.sin(GATE_ANGLE) * WALL_R;
  const side = 0.84;
  const sx = -Math.sin(GATE_ANGLE);
  const sz = Math.cos(GATE_ANGLE);
  return (
    <group position={[gx, 0.3, gz]}>
      {[1, -1].map((dir) => (
        <group key={dir} position={[sx * side * dir, 0, sz * side * dir]}>
          <mesh castShadow material={MAT.stone} position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.46, 0.58, 2.6, 7]} />
          </mesh>
          <mesh castShadow material={MAT.roofSolid} position={[0, 2.95, 0]}>
            <coneGeometry args={[0.6, 0.78, 7]} />
          </mesh>
        </group>
      ))}
      {/* The lintel over the gate. */}
      <mesh castShadow material={MAT.timber} position={[0, 1.85, 0]} rotation={[0, GATE_ANGLE, 0]}>
        <boxGeometry args={[0.38, 0.34, 1.8]} />
      </mesh>
    </group>
  );
}

/** The city inside the walls — three rings of close-set roofs around the
 *  keep, every plot hashed, so the Capital reads as a CITY and no fief's
 *  cluster comes near it. */
function InnerCity() {
  const houses = useMemo<Placement[]>(() => {
    const arr: Placement[] = [];
    let i = 0;
    for (const ring of [
      { r: 2.9, n: 11 },
      { r: 4.0, n: 15 },
      { r: 5.1, n: 19 },
    ]) {
      for (let k = 0; k < ring.n; k++) {
        const a = (k / ring.n) * Math.PI * 2 + ring.r;
        // Keep the gate's approach clear.
        if (Math.abs(((a - GATE_ANGLE + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.4) continue;
        const jr = ring.r + (hash1(700 + i * 13) - 0.5) * 0.45;
        arr.push({
          x: Math.cos(a) * jr,
          y: 0.3,
          z: Math.sin(a) * jr * 0.96,
          rotY: hash1(720 + i * 7) * Math.PI * 2,
          scale: 0.6 + hash1(740 + i * 11) * 0.32,
        });
        i++;
      }
    }
    return arr;
  }, []);

  const wallGeom = useMemo(() => {
    const g = new THREE.BoxGeometry(0.8, 0.6, 0.7);
    g.translate(0, 0.3, 0);
    return g;
  }, []);
  const roofGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(0.62, 0.5, 4);
    g.rotateY(Math.PI / 4);
    g.translate(0, 0.85, 0);
    return g;
  }, []);
  const wallCols = useMemo(
    () => houses.map((_, i) => faithTint(70 + hash1(760 + i * 3) * 30, TOKEN.houseWall, TOKEN.houseWallDrab)),
    [houses],
  );
  const roofCols = useMemo(
    () => houses.map((_, i) => faithTint(60 + hash1(780 + i * 5) * 40, TOKEN.roofTile, TOKEN.roofTileDrab)),
    [houses],
  );
  const walls = useInstanced(wallGeom, MAT.wall, houses, wallCols);
  const roofs = useInstanced(roofGeom, MAT.roof, houses, roofCols);
  return (
    <group>
      <primitive object={walls} castShadow receiveShadow />
      <primitive object={roofs} castShadow />
    </group>
  );
}

/** A low inner wall about the castle itself — the second tier that makes the
 *  seat read as a CASTLE within a CITY, which no town has. */
function InnerBailey() {
  const segs = 14;
  const R = 2.1;
  const placements = useMemo<Placement[]>(() => {
    const arr: Placement[] = [];
    const gate = Math.round((GATE_ANGLE / (Math.PI * 2)) * segs);
    for (let i = 0; i < segs; i++) {
      if (i === gate) continue;
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      arr.push({ x: Math.cos(a) * R, y: 0.3, z: Math.sin(a) * R, rotY: -a + Math.PI / 2 });
    }
    return arr;
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BoxGeometry(1.0, 0.8, 0.3);
    g.translate(0, 0.4, 0);
    return g;
  }, []);
  const wall = useInstanced(geom, MAT.stoneDark, placements);
  return <primitive object={wall} castShadow receiveShadow />;
}

function GreatKeep() {
  return (
    <group position={[0, 0.3, 0]}>
      {/* The great hall */}
      <mesh castShadow receiveShadow material={MAT.keepWall} position={[0, 1.1, 0]}>
        <boxGeometry args={[2.9, 2.2, 2.4]} />
      </mesh>
      <mesh castShadow material={MAT.roofSolid} position={[0, 2.75, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.3, 1.1, 4]} />
      </mesh>
      {/* Corner towers on the hall */}
      {[
        [1.3, 1.0],
        [-1.3, 1.0],
        [-1.3, -1.0],
      ].map(([cx, cz], i) => (
        <group key={i}>
          <mesh castShadow material={MAT.stone} position={[cx, 1.6, cz]}>
            <cylinderGeometry args={[0.34, 0.42, 3.2, 7]} />
          </mesh>
          <mesh castShadow material={MAT.roofSolid} position={[cx, 3.5, cz]}>
            <coneGeometry args={[0.44, 0.6, 7]} />
          </mesh>
        </group>
      ))}
      {/* The tall donjon */}
      <mesh castShadow material={MAT.stone} position={[0.7, 2.6, -0.6]}>
        <cylinderGeometry args={[0.72, 0.88, 5.2, 8]} />
      </mesh>
      <mesh castShadow material={MAT.roofSolid} position={[0.7, 5.7, -0.6]}>
        <coneGeometry args={[0.94, 1.1, 8]} />
      </mesh>
      {/* Brass trim and the realm's banner. */}
      <mesh material={MAT.goldTrim} position={[0.7, 6.35, -0.6]}>
        <sphereGeometry args={[0.14, 8, 8]} />
      </mesh>
      <mesh position={[0.7, 6.75, -0.6]}>
        <planeGeometry args={[1.1, 0.6]} />
        <meshBasicMaterial color={PALETTE.brass} side={THREE.DoubleSide} />
      </mesh>
      {/* Warm windows — the capital never sleeps. */}
      <mesh material={MAT.windowLit} position={[0, 1.1, 1.21]}>
        <planeGeometry args={[1.3, 0.6]} />
      </mesh>
      <mesh material={MAT.windowLit} position={[0.7, 3.6, 0.28]}>
        <planeGeometry args={[0.34, 0.46]} />
      </mesh>
    </group>
  );
}
