/**
 * The shaped continent on its slate sea.
 *
 * The continent is ONE low-poly landform (the writ's leash: one, never an
 * archipelago). Its rim is a hand-drawn wobble derived from a deterministic
 * hash stream — never Math.random() — so the same realm always draws the
 * same shore. The Capital's hill stands at the centre; the fief territories
 * ring it; the sea is cool slate water running to the frame's edge.
 *
 * The ground is LAND — meadow green and dark loam, never sand, never
 * parchment (Edwin, 2026-07-27). The ink linework stays: coast, contours,
 * borders — a map's linework is good; the vellum ground is banished.
 *
 * Also here: the sea itself, the compass rose set into the sea, the wild
 * woods between the holdings, and the realm's hand-lettered name — all
 * things that exist BEFORE the muster (the map is drawn even when
 * unrevealed).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  CAPITAL_HILL,
  CAPITAL_CLEAR_R,
  COMPASS_ROSE,
  treeAt,
  landHeight,
  hash1,
} from './deriveLayout';
import { MAT, TOKEN, canopyColor, toonRamp } from './palette';

// ── Deterministic shore wobble ─────────────────────────────────────────────

/** The drawn coast's reach at an angle — the ONE truth of where land ends;
 *  the shoreline ink and the landform both ask it. */
export function shoreRadius(angle: number): number {
  // A few low-frequency harmonics with hashed phases — a coast, not a circle.
  const a1 = hash1(911) * Math.PI * 2;
  const a2 = hash1(313) * Math.PI * 2;
  const a3 = hash1(517) * Math.PI * 2;
  const base = 44;
  return (
    base *
    (1 +
      0.08 * Math.sin(angle * 3 + a1) +
      0.05 * Math.sin(angle * 5 + a2) +
      0.03 * Math.sin(angle * 8 + a3))
  );
}

/** The coast's ellipse — the continent is a wide land for a wide frame. */
const COAST_X = 1.15;
const COAST_Z = 0.72;

// ── The wild country ───────────────────────────────────────────────────────

/**
 * The land BEYOND the realm — not sea. Edwin, 2026-07-27: "not sea, don't make
 * us look so lopped off. We're a kingdom in the middle of the continent
 * there's tons of land to expand into."
 *
 * So the realm is not an island. What surrounds it is unclaimed country —
 * wilder and cooler than the tilled fiefs, rolling on past the frame with no
 * edge at all. It reads as room to grow, which is the truthful picture: the
 * kingdom holds a few fiefs of a continent that goes on.
 *
 * A vertex-painted radial sheet: no texture, one draw.
 */
export function Sea() {
  const geo = useMemo(() => {
    const rings = 12;
    const segs = 48;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const inner = new THREE.Color(TOKEN.wildNear);
    const outer = new THREE.Color(TOKEN.wildFar);
    const col = new THREE.Color();
    positions.push(0, 0, 0);
    colors.push(inner.r, inner.g, inner.b);
    for (let r = 1; r <= rings; r++) {
      const t = r / rings;
      const radius = 260 * t * t; // tight near the realm, running far past the frame
      // The near country still green from the realm's own weather, cooling and
      // greying with distance the way land does — never stopping, never an edge.
      col.copy(inner).lerp(outer, THREE.MathUtils.smoothstep(radius, 62, 220));
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let s = 0; s < segs; s++) indices.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < segs; s++) {
        const a = 1 + r * segs + s;
        const b = 1 + r * segs + ((s + 1) % segs);
        const c = 1 + (r + 1) * segs + s;
        const d = 1 + (r + 1) * segs + ((s + 1) % segs);
        indices.push(a, d, c, a, b, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} position={[0, -0.06, 0]} receiveShadow>
      <meshToonMaterial vertexColors gradientMap={toonRamp()} />
    </mesh>
  );
}

// ── The continent landform ─────────────────────────────────────────────────

/**
 * The land's paint at a point — grass and loam, never paper: dark wet earth
 * at the waterline, meadow greens across the middle ground, moss and pine
 * dark toward the heights. A hashed per-vertex mottle keeps it painterly,
 * never one flat coat.
 */
function landColor(x: number, z: number, h: number, t: number, out: THREE.Color): void {
  const shore = new THREE.Color(TOKEN.landShore);
  const low = new THREE.Color(TOKEN.landLow);
  const land = new THREE.Color(TOKEN.land);
  const meadow = new THREE.Color(TOKEN.landMeadow);
  const high = new THREE.Color(TOKEN.landHigh);

  // Height paints the land: wet shore earth, low moss, the common meadow, a
  // sunlit meadow wash, then the dark high ground the pines hold.
  const hh = THREE.MathUtils.clamp(h / 3.2, 0, 1);
  if (hh < 0.1) out.copy(shore).lerp(low, hh / 0.1);
  else if (hh < 0.34) out.copy(low).lerp(land, (hh - 0.1) / 0.24);
  else if (hh < 0.66) out.copy(land).lerp(meadow, (hh - 0.34) / 0.32);
  else out.copy(meadow).lerp(high, (hh - 0.66) / 0.34);

  // The last breath before the waterline — a narrow strip of wet earth.
  if (t > 0.985) out.lerp(new THREE.Color(TOKEN.landShore), ((t - 0.985) / 0.015) * 0.7);

  // The painterly mottle — a deterministic hash, a few percent either way.
  const m = hash1(Math.round(x * 7.3) * 131 + Math.round(z * 7.3) * 37) - 0.5;
  out.offsetHSL(m * 0.014, m * 0.05, m * 0.022);
}

export function Continent() {
  const geo = useMemo(() => {
    const segs = 112;
    const rings = 24;
    const skirt = 2; // rings past the realm's bound, level with the wild country
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const col = new THREE.Color();
    // The ground just past the realm's bound is WILD COUNTRY, not shallows —
    // it was painted the old water colour, which left a slate band hugging the
    // land and made the kingdom look cut out (Edwin: "don't make us look so
    // lopped off"). Painted as the near wild, the tilled land now runs out into
    // the open country with no seam at all.
    const shallows = new THREE.Color(TOKEN.wildNear);
    // Ring 0 is the centre (the Capital's hill); each outward ring steps
    // toward the shore, easing off in height so the land falls to the sea;
    // the skirt rings run on past it, flat at sea level, painted the sea's
    // own slate so the coast meets the water cleanly.
    for (let r = 0; r <= rings + skirt; r++) {
      const t = Math.min(1, r / rings); // 0 centre → 1 shore
      const over = Math.max(0, r - rings); // skirt steps past the shore
      for (let s = 0; s < segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        const rr = shoreRadius(angle) * t + over * 2.6;
        const x = Math.cos(angle) * rr * COAST_X;
        const z = Math.sin(angle) * rr * COAST_Z;
        // The land's own height field — the very one deriveLayout lays
        // fiefs, trees, and roads on, so everything sits on the same ground.
        const h = over > 0 ? 0.02 : Math.max(0.1, landHeight(x, z));
        positions.push(x, h, z);
        if (over > 0) col.copy(shallows);
        else landColor(x, z, h, t, col);
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let r = 0; r < rings + skirt; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * segs + s;
        const b = r * segs + ((s + 1) % segs);
        const c = (r + 1) * segs + s;
        const d = (r + 1) * segs + ((s + 1) % segs);
        indices.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group position={[CAPITAL_HILL.x, 0, CAPITAL_HILL.z]}>
      <mesh geometry={geo} receiveShadow>
        <meshToonMaterial vertexColors gradientMap={toonRamp()} />
      </mesh>
      {/* The shore — a thin ink rim where the land meets the sea. */}
      <ShoreLine />
    </group>
  );
}

/**
 * The coastline, drawn as a mapmaker draws it: a firm ink stroke at the
 * water's edge and a second, fainter line offset into the sea — the
 * hand-drawn double line every old atlas wears. Ribbons, not GL lines
 * (GL lines are one pixel and vanish).
 */
function ShoreLine() {
  const strokes = useMemo(() => {
    const build = (offset: number, halfW: number) => {
      const segs = 160;
      const positions: number[] = [];
      const indices: number[] = [];
      for (let s = 0; s <= segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        const rr = shoreRadius(angle) + offset;
        const x = Math.cos(angle) * rr * COAST_X;
        const z = Math.sin(angle) * rr * COAST_Z;
        // Push outward along the radial — near enough to the normal for a
        // gently wobbling coast.
        const ox = Math.cos(angle) * halfW;
        const oz = Math.sin(angle) * halfW;
        positions.push(x - ox, 0.09, z - oz, x + ox, 0.09, z + oz);
        if (s > 0) {
          const a = (s - 1) * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    };
    return [build(0.35, 0.12)];
  }, []);
  // Faint engraved contours inland of the coast — the mapmaker's linework
  // that gives the bare land its structure before any fief is drawn.
  const contours = useMemo(() => {
    const build = (inset: number) => {
      const segs = 112;
      const positions: number[] = [];
      const indices: number[] = [];
      for (let s = 0; s <= segs; s++) {
        const angle = (s / segs) * Math.PI * 2;
        const rr = Math.max(5, shoreRadius(angle) - inset);
        const x = Math.cos(angle) * rr * COAST_X;
        const z = Math.sin(angle) * rr * COAST_Z;
        const y = Math.max(0.05, landHeight(x, z)) + 0.12;
        const ox = Math.cos(angle) * 0.07;
        const oz = Math.sin(angle) * 0.07;
        positions.push(x - ox, y, z - oz, x + ox, y, z + oz);
        if (s > 0) {
          const a = (s - 1) * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    };
    return [build(4.5), build(10), build(16)];
  }, []);
  return (
    <group>
      <mesh geometry={strokes[0]} material={MAT.inkLine} />
      <mesh geometry={strokes[1]}>
        <meshBasicMaterial color={TOKEN.coastInk} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {contours.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color={TOKEN.coastInk}
            transparent
            opacity={0.14}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── The ground's tooth ─────────────────────────────────────────────────────

/**
 * A whisper of grain multiplied over land and sea alike, so the whole map
 * reads as paint on a surface instead of smooth plastic. One texture, one
 * draw, no fetch (leash 2). Kept faint — this is texture, not vellum.
 */
export function PaperGrain() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      // Two octaves of hashed noise — enough tooth, no pattern.
      const x = i % 256;
      const y = (i / 256) | 0;
      const n =
        hash1(x * 131 + y * 519) * 0.6 +
        hash1(((x >> 2) * 37 + (y >> 2) * 91) | 0) * 0.4;
      const v = 236 + n * 19; // barely-there: multiply blending
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(16, 16);
    return t;
  }, []);
  return (
    <mesh position={[0, 6.2, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[300, 300]} />
      <meshBasicMaterial
        map={tex}
        transparent
        premultipliedAlpha
        blending={THREE.MultiplyBlending}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// ── The compass rose ───────────────────────────────────────────────────────

export function CompassRose() {
  const star = useMemo(() => {
    // An eight-pointed rose drawn as a flat shape.
    const shape = new THREE.Shape();
    const R = 3.4;
    const r = 1.05;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const rad = i % 2 === 0 ? R : r;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  return (
    <group
      position={[COMPASS_ROSE.x, 0.02, COMPASS_ROSE.z]}
      rotation={[-Math.PI / 2, 0, COMPASS_ROSE.rotY]}
    >
      <mesh geometry={star}>
        <meshBasicMaterial color={TOKEN.lettering} transparent opacity={0.55} />
      </mesh>
      <mesh>
        <ringGeometry args={[3.8, 4.05, 48]} />
        <meshBasicMaterial color={TOKEN.letteringDim} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

// ── The wild woods ─────────────────────────────────────────────────────────

const TREE_COUNT = 220;

/** The pine masses and turning groves BETWEEN the holdings — the land wears
 *  woods before any fief is drawn on it. */
export function Trees() {
  const trunks = useMemo(
    () => new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.12, 0.7, 5), MAT.trunk, TREE_COUNT),
    [],
  );
  const canopies = useMemo(
    () => new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 1.5, 6), MAT.canopy, TREE_COUNT),
    [],
  );

  useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < TREE_COUNT; i++) {
      const t = treeAt(i);
      const h = landHeight(t.x, t.z);
      // Trees stand where the land does — inside the DRAWN coast (the height
      // dome runs past it), never in the water, and clear of the Capital's
      // commons (the city holds that ground).
      const re = Math.hypot(t.x / COAST_X, t.z / COAST_Z);
      const ang = Math.atan2(t.z / COAST_Z, t.x / COAST_X);
      const offshore = re > shoreRadius(ang) - 2.5;
      if (h <= 0 || offshore || Math.hypot(t.x, t.z * 1.5) < CAPITAL_CLEAR_R) {
        s.setScalar(0);
        m.compose(new THREE.Vector3(t.x, -10, t.z), q, s);
        trunks.setMatrixAt(i, m);
        canopies.setMatrixAt(i, m);
        continue;
      }
      q.setFromEuler(new THREE.Euler(0, hash1(i * 31 + 7) * Math.PI, 0));
      s.setScalar(t.s);
      m.compose(new THREE.Vector3(t.x, h + 0.3 * t.s, t.z), q, s);
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, h + (0.6 + 0.65) * t.s, t.z), q, s);
      canopies.setMatrixAt(i, m);
      // The autumn range — pine greens through russet, copper and old gold.
      canopies.setColorAt(i, canopyColor(t.hue, col));
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  }, [trunks, canopies]);

  return (
    <group>
      <primitive object={trunks} castShadow />
      <primitive object={canopies} castShadow />
    </group>
  );
}

// ── The hand-lettered realm name ───────────────────────────────────────────

/**
 * The realm's name lettered by hand onto the sea north of the continent.
 * Drawn to a canvas at build time (procedural, self-contained — leash 2) and
 * laid flat as a decal. Exists before AND after the muster: the map is the
 * map, revealed or not.
 */
export function RealmName({ name }: { name: string }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 192;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = TOKEN.lettering;
    ctx.font = '600 92px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.95;
    // A slight hand-drawn wobble: letter the name with a faint rotation per glyph.
    const glyphs = name.split('');
    const total = ctx.measureText(name).width;
    let x = (c.width - total) / 2;
    for (let gi = 0; gi < glyphs.length; gi++) {
      const g = glyphs[gi];
      const w = ctx.measureText(g).width;
      ctx.save();
      ctx.translate(x + w / 2, c.height / 2);
      ctx.rotate((hash1(gi * 17 + 5) - 0.5) * 0.06);
      ctx.fillText(g, 0, 0);
      ctx.restore();
      x += w;
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }, [name]);

  return (
    // On the water above the north coast — inside the survey frame.
    <mesh position={[0, 0.05, -37]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[34, 6.6]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}
