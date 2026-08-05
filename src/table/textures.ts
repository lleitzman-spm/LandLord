/**
 * The table's cloth and timber — canvas-painted textures, built once.
 * Wood, felt, paper, and the brass dial face: the four honest materials
 * (plus painted lead, which lives in sprites.ts). All wobble deterministic.
 */

import * as THREE from 'three';
import { T, INK, NAMED, mix, lighten, darken } from './palette';

function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

function canvasTex(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Long walnut boards, running with the table's length. */
export function woodTexture(): THREE.CanvasTexture {
  return canvasTex(1024, 1024, (ctx) => {
    const r = stream(41);
    ctx.fillStyle = T.wood;
    ctx.fillRect(0, 0, 1024, 1024);
    const boardH = 1024 / 9;
    for (let b = 0; b < 9; b++) {
      const y = b * boardH;
      // each board its own stain
      const tone = (r() - 0.5) * 0.05;
      ctx.fillStyle = tone > 0 ? lighten(T.wood, tone) : darken(T.wood, -tone);
      ctx.fillRect(0, y, 1024, boardH);
      // grain: long sinuous strokes
      const grains = 16 + Math.floor(r() * 10);
      for (let g = 0; g < grains; g++) {
        const gy = y + r() * boardH;
        const amp = 1 + r() * 3.5;
        const period = 180 + r() * 380;
        const phase = r() * Math.PI * 2;
        ctx.strokeStyle = r() < 0.25 ? T.woodSheen : T.woodGrain;
        ctx.globalAlpha = 0.09 + r() * 0.14;
        ctx.lineWidth = 0.8 + r() * 1.6;
        ctx.beginPath();
        for (let x = 0; x <= 1024; x += 16) {
          const yy = gy + Math.sin(x / period * Math.PI * 2 + phase) * amp;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // an occasional knot
      if (r() < 0.55) {
        const kx = r() * 1024;
        const ky = y + boardH * (0.25 + r() * 0.5);
        for (let k = 4; k > 0; k--) {
          ctx.beginPath();
          ctx.ellipse(kx, ky, k * 3.2, k * 1.7, 0.2, 0, Math.PI * 2);
          ctx.strokeStyle = T.woodGrain;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // the seam
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = darken(T.wood, 0.08);
      ctx.fillRect(0, y + boardH - 1.5, 1024, 3);
      ctx.globalAlpha = 1;
    }
  });
}

/** Fine felt nap — a cloth, not a color fill. */
export function feltTexture(): THREE.CanvasTexture {
  return canvasTex(512, 512, (ctx) => {
    const r = stream(42);
    ctx.fillStyle = darken(T.felt, 0.02);
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26000; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const v = r();
      ctx.fillStyle = v < 0.5 ? T.feltDark : lighten(T.felt, 0.03 + v * 0.05);
      ctx.globalAlpha = 0.12 + r() * 0.12;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  });
}

/** A hand-lettered scrap of paper — an OBJECT on the table (§10.5). */
export function paperTexture(lines: string[]): THREE.CanvasTexture {
  return canvasTex(512, 320, (ctx) => {
    const r = stream(43);
    ctx.fillStyle = T.paper;
    ctx.fillRect(0, 0, 512, 320);
    // deckled darker edges
    ctx.strokeStyle = darken(T.paper, 0.12);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 8;
    ctx.strokeRect(2, 2, 508, 316);
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = darken(T.paper, 0.06);
      ctx.fillRect(r() * 512, r() * 320, 30 + r() * 90, 1.5);
    }
    ctx.globalAlpha = 1;
    // a ruled ink border
    ctx.strokeStyle = T.paperInk;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(18, 18, 476, 284);
    ctx.strokeRect(24, 24, 464, 272);
    // the hand
    ctx.fillStyle = T.paperInk;
    ctx.textAlign = 'center';
    const fonts = ['700 52px Georgia, serif', 'italic 32px Georgia, serif', '600 36px Georgia, serif'];
    lines.forEach((line, i) => {
      ctx.font = fonts[Math.min(i, fonts.length - 1)];
      ctx.fillText(line, 256 + (r() - 0.5) * 6, 100 + i * 72 + (r() - 0.5) * 4);
    });
  });
}

/**
 * The room, as a reflection: ONE hot lamp west-and-high in a near-black
 * room, a faint warm ceiling bounce, the dimmest cool floor. This is what
 * the brass, the water and the waxed wood SEE — a single blown highlight
 * and darkness everywhere else. Without it nothing in the frame shone, and
 * matte-everything is what made the render read as a render.
 */
export function lampEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pm = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.background = new THREE.Color(0.004, 0.0025, 0.0015);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(13, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(7.0, 4.6, 2.3) }),
  );
  lamp.position.set(-40, 30, 8);
  room.add(lamp);
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(85, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.38, 0.27, 0.15), side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 62, 4);
  room.add(ceiling);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(90, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.03, 0.05), side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -14;
  room.add(floor);
  const tex = pm.fromScene(room, 0.04).texture;
  pm.dispose();
  return tex;
}

/**
 * The dial of the weeks — THE signature element (§11). A brass face let
 * into the table rim: 52 week teeth, 13 bold, the four seasons lettered
 * around, one blued-steel hand. "Advance a week" is a physical act on
 * this dial; nothing about it is a button.
 */
export function dialTexture(week: number): THREE.CanvasTexture {
  return canvasTex(1024, 1024, (ctx) => {
    const r = stream(44);
    const cx = 512, cy = 512;
    // brushed brass: radial gradient + fine arcs
    const g = ctx.createRadialGradient(cx - 130, cy - 150, 60, cx, cy, 560);
    g.addColorStop(0, lighten(NAMED.brass, 0.16));
    g.addColorStop(0.45, NAMED.brass);
    g.addColorStop(0.8, T.brassDeep);
    g.addColorStop(1, darken(T.brassDeep, 0.08));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 260; i++) {
      const rad = 40 + r() * 470;
      const a0 = r() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, a0, a0 + 0.5 + r() * 1.6);
      ctx.strokeStyle = r() < 0.5 ? lighten(NAMED.brass, 0.07) : T.brassDeep;
      ctx.globalAlpha = 0.07 + r() * 0.08;
      ctx.lineWidth = 1 + r() * 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // engraved rings
    const ring = (rad: number, w: number, color: string) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.stroke();
    };
    ring(492, 10, T.brassDeep);
    ring(480, 3, darken(T.brassDeep, 0.1));
    ring(378, 3, darken(T.brassDeep, 0.08));
    ring(230, 3, darken(T.brassDeep, 0.08));

    // 52 week teeth, 13 bold
    for (let wk = 0; wk < 52; wk++) {
      const a = (wk / 52) * Math.PI * 2 - Math.PI / 2;
      const bold = wk % 4 === 0;
      const rOut = 472, rIn = bold ? 414 : 440;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
      ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
      ctx.strokeStyle = darken(T.brassDeep, bold ? 0.24 : 0.14);
      ctx.lineWidth = bold ? 13 : 6;
      ctx.stroke();
    }

    // the four seasons, lettered small-caps around the inner ring
    const seasons = ['SEEDTIME', 'HAYTIDE', 'HARVEST', 'FROSTFALL'];
    ctx.fillStyle = darken(T.brassDeep, 0.26);
    ctx.textAlign = 'center';
    ctx.font = '700 52px Georgia, serif';
    seasons.forEach((name, si) => {
      const centerA = ((si * 13 + 6.5) / 52) * Math.PI * 2 - Math.PI / 2;
      const chars = name.split('');
      const arc = 0.052 * (chars.length - 1);
      chars.forEach((ch, i) => {
        const a = centerA - arc / 2 + i * 0.052;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * 328, cy + Math.sin(a) * 328);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      });
    });

    // the legend
    ctx.font = '700 44px Georgia, serif';
    ctx.fillText('THE TURNING', cx, cy - 64);
    ctx.fillText('OF THE WEEKS', cx, cy - 16);
    ctx.font = 'italic 38px Georgia, serif';
    ctx.fillText('Year I', cx, cy + 48);

    // the hand — blued steel, pointing at the living week
    const handA = (week / 52) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(handA);
    ctx.fillStyle = mix(T.steelBlue, INK, 0.35);
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(0, -34);
    ctx.lineTo(18, 0);
    ctx.lineTo(10, 70);
    ctx.lineTo(0, 452);
    ctx.lineTo(-10, 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    // a glint down the left of the hand
    ctx.strokeStyle = mix(T.steelBlue, '#cfd8e8', 0.6);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-4, 20);
    ctx.lineTo(-1, 400);
    ctx.stroke();
    ctx.restore();

    // the boss
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = lighten(NAMED.brass, 0.1);
    ctx.fill();
    ctx.strokeStyle = darken(T.brassDeep, 0.1);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 9, 9, 0, Math.PI * 2);
    ctx.fillStyle = lighten(NAMED.brass, 0.24);
    ctx.fill();
  });
}
