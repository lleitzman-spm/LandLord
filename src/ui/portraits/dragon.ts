/**
 * Portraits: the dragon adjuster. He is in fact a small dragon with a ledger.
 * Everything that moves on him (eyes, brow ridges, mouth, the fins that droop
 * when the claim is bad) is the same machinery as everyone else's face; only
 * the still parts are his own: horns, fins, a muzzle, folded wings, a stiff
 * collar, a very small hat between the horns, and a quill in the other claw.
 */
import { mirror, ellipse, mixc, shadeOf, f, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome, FrameAttrs } from './types';
import type { Pen } from './pen';
import { drawBlush, drawMoodOverlays, drawSpecs, type Geo } from './head';
import { faceMarkup } from './features';
import { drawHat, tubePts, cw } from './headwear';
import { drawTool, heldAt } from './tools';

export function drawDragon(g: Genome, geo0: Geo, pen: Pen, fr: FrameAttrs): { markup: string; top: number } {
  const cx = geo0.cx, T = geo0.top, nb = geo0.nb;
  const skin = g.skin, shade = g.skinShade, belly = g.garb.c2, bone = '#e9dcb8';
  const dark = shadeOf(skin, 0.42), membrane = mixc(skin, '#e8a058', 0.5);
  const at = (key: string, name: string): string => (fr[key] ? ` ${name}="${fr[key]}"` : '');

  // his own head: broad across the brow, drawn in to a blunt muzzle
  const R: Pt[] = ([[12, 1], [26, 7], [35, 20], [38, 34], [33, 46], [27.5, 56], [25.5, 66], [17, 75]] as Pt[]).map(p => [cx + p[0], T + p[1]] as Pt);
  const outline: Pt[] = [[cx, T] as Pt, ...R, [cx, T + 78] as Pt, ...mirror(R, cx).reverse()];
  const geo: Geo = { ...geo0, outline };

  // ── behind everything: wings, folded
  let wings = '';
  for (const sd of [-1, 1]) {
    const W = (u: number, y: number): Pt => [cx + sd * u, y];
    wings += pen.blob(cw([W(28, nb + 12), W(48, 118), W(63, 95), W(70, 99), W(80, 128), W(89, 152), W(79, 150), W(77, 176), W(68, 168), W(60, 194), W(40, 186)]), shade, { w: 1.5, shade: dark, sx: -3 * sd, sy: -2 });
    if (pen.mid) {
      for (const tipP of [W(89, 152), W(77, 176), W(60, 194)]) wings += pen.line([W(66, 97), [(W(66, 97)[0] + tipP[0]) / 2 + sd * 3, (97 + tipP[1]) / 2 - 3], tipP], 1.1, { c: dark, tp: 'out', op: 0.9 });
      wings += pen.fill([W(52, 124), W(64, 110), W(72, 132), W(66, 158), W(52, 172), W(44, 150)], membrane, 0.3);
    }
    wings += pen.blob(cw([W(62, 97), W(66, 86), W(70.5, 96)]), bone, { w: 1 });
  }

  // ── horns ride with the head
  let horns = '';
  for (const sd of [-1, 1]) {
    const spine: Pt[] = [[cx + sd * 15, T + 7], [cx + sd * 20, T - 8], [cx + sd * 28, T - 19], [cx + sd * 35, T - 25]];
    horns += pen.blob(cw(tubePts(spine, [6, 4.6, 2.9, 0.5])), bone, { w: 1.4, shade: '#cdbd92', sx: 1.6, sy: -1 });
    if (pen.mid) for (const t of [0.2, 0.42, 0.62]) {
      const x = cx + sd * (15 + 20 * t * (0.6 + 0.5 * t)), y = T + 7 - 32 * t * (1.25 - 0.3 * t);
      horns += pen.line([[x - sd * 4 * (1 - t), y - 1.5], [x + sd * 3.6 * (1 - t), y + 2.2]], 0.8, { op: 0.5, tp: 'both' });
    }
  }

  // ── fins where another clerk would have ears
  const fin = (sd: 1 | -1): string => {
    const W = (u: number, y: number): Pt => [cx + sd * u, y];
    const ey = g.ears.y;
    let o = pen.blob(cw([W(33, ey - 13), W(46, ey - 21), W(57, ey - 27), W(54, ey - 15), W(62, ey - 8), W(55, ey - 3), W(57, ey + 7), W(47, ey + 6), W(34, ey + 8)]), membrane, { w: 1.4, shade: mixc(membrane, shade, 0.5), sx: 2.4 * sd, sy: 2 });
    if (pen.mid) for (const tipP of [W(57, ey - 27), W(62, ey - 8), W(57, ey + 7)]) o += pen.line([W(35, ey - 3), tipP], 1, { c: dark, tp: 'out' });
    return `<g data-k="${sd < 0 ? 'earL' : 'earR'}"${at((sd < 0 ? 'earL' : 'earR') + '.transform', 'transform')}>${o}</g>`;
  };

  // ── neck and shoulders, with the belly plates showing down the front
  const sw = g.garb.shW, nw = g.garb.neckW;
  let body = pen.blob(cw([[cx - nw, T + 62], [cx - nw - 1.5, nb], [cx - nw * 1.6, nb + 16], [cx + nw * 1.6, nb + 16], [cx + nw + 1.5, nb], [cx + nw, T + 62]]), mixc(skin, shade, 0.5), { w: 1.4 });
  body += pen.blob(cw([[cx - sw - 8, 220], [cx - sw, nb + 28], [cx - sw * 0.62, nb + 12], [cx - nw * 1.2, nb + 3], [cx, nb + 6], [cx + nw * 1.2, nb + 3], [cx + sw * 0.62, nb + 12], [cx + sw, nb + 28], [cx + sw + 8, 220], [cx, 224]]), skin, { w: 1.6, shade, shadeLod: 1, sx: 5, sy: 4 });
  const plate = (y: number, w: number, h: number): string => pen.blob(cw([[cx - w, y], [cx - w * 0.5, y - 1.6], [cx + w * 0.5, y - 1.6], [cx + w, y], [cx + w * 0.86, y + h], [cx, y + h + 1.6], [cx - w * 0.86, y + h]]), belly, { w: 1.05, wob: 0.2 });
  for (let i = 0; i < 3; i++) body += plate(T + 80 + i * 6.4, nw * 0.72 + i * 0.6, 5.2);
  for (let i = 0; i < 5; i++) body += plate(nb + 17 + i * 9, nw * 0.9 + i * 0.9, 7.6);
  if (pen.fine) {
    let sc = '';
    for (let j = 0; j < 4; j++) for (const sd of [-1, 1]) for (let i = 0; i < 3 - (j > 2 ? 1 : 0); i++) {
      const x = cx + sd * (nw * 1.5 + 9 + i * 8 + (j % 2) * 4 + j * 2), y = nb + 24 + j * 9;
      sc += `M${f(x - 3)} ${f(y)}a3 2.7 0 0 0 6 0`;
    }
    body += `<path d="${sc}" fill="none" stroke="${dark}" stroke-width=".8" opacity=".5"/>`;
  }
  // a clerk's collar, starched, and a bow
  const cy = nb + 3;
  for (const sd of [-1, 1]) body += pen.blobPoly(cw([[cx + sd * 1, cy + 4], [cx + sd * (nw + 3), cy - 6], [cx + sd * (nw + 6.5), cy + 7], [cx + sd * 6, cy + 12.5]]), PIG.linen, { w: 1.2 });
  if (g.garb.extras.includes('bowtie')) {
    const y = cy + 8.5;
    body += pen.blob(cw([[cx, y], [cx - 8.6, y - 4.8], [cx - 9.2, y + 4.8]]), PIG.black, { w: 1 }) + pen.blob(cw([[cx, y], [cx + 8.6, y - 4.8], [cx + 9.2, y + 4.8]]), PIG.black, { w: 1 }) + pen.bead(cx, y, 2, PIG.gold, 0.7);
  }

  // ── the head
  const head = pen.blob(outline, skin, { w: 1.75, shade, shadeLod: 1, sx: 5.5, sy: 3.5, wob: pen.lod === 2 ? 0.4 : 0.2 });
  const ov = drawMoodOverlays(g, geo, pen, fr);
  const my = g.mouth.y;
  let muzzle = pen.fill([[cx - 21, T + 49], [cx - 11, T + 43.6], [cx, T + 42], [cx + 11, T + 43.6], [cx + 21, T + 49], [cx + 23.4, T + 64], [cx + 15, T + 73.6], [cx, T + 76.2], [cx - 15, T + 73.6], [cx - 23.4, T + 64]], mixc(skin, belly, 0.5), 0.9);
  if (pen.mid) muzzle += pen.line([[cx - 20, T + 49.6], [cx - 10.6, T + 44], [cx, T + 42.6], [cx + 10.6, T + 44], [cx + 20, T + 49.6]], 0.9, { op: 0.4 });
  let detail = '';
  // nostrils
  for (const sd of [-1, 1]) detail += `<ellipse cx="${f(cx + sd * 6.6)}" cy="${f(g.noseY + 1.6)}" rx="2.7" ry="1.7" fill="${pen.ink}" opacity=".85" transform="rotate(${sd * -22} ${f(cx + sd * 6.6)} ${f(g.noseY + 1.6)})"/>`;
  if (pen.mid) detail += pen.line([[cx - 11, g.noseY - 1.6], [cx - 7, g.noseY - 4], [cx - 2.6, g.noseY - 2.4]], 0.9, { op: 0.55 }) + pen.line([[cx + 11, g.noseY - 1.6], [cx + 7, g.noseY - 4], [cx + 2.6, g.noseY - 2.4]], 0.9, { op: 0.55 });
  // a row of small spines over the crown
  for (const dx of [-8.5, 0, 8.5]) detail += pen.blob(cw([[cx + dx - 3.4, T + 2.6 + Math.abs(dx) * 0.22], [cx + dx, T - 6 + Math.abs(dx) * 0.3], [cx + dx + 3.4, T + 2.6 + Math.abs(dx) * 0.22]]), dark, { w: 1 });
  if (pen.fine) {
    // scales, where there is room for them
    let sc = '';
    for (let j = 0; j < 3; j++) for (let i = -2; i <= 2; i++) {
      const x = cx + i * 7.4 + (j % 2) * 3.7, y = T + 8.6 + j * 5;
      if (Math.abs(x - cx) < 22 - j * 2) sc += `M${f(x - 2.7)} ${f(y)}a2.7 2.4 0 0 0 5.4 0`;
    }
    for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      const x = cx + sd * (27 + i * 5.4 - j * 2 + (j % 2) * 2.7), y = T + 40 + j * 5;
      sc += `M${f(x - 2.7)} ${f(y)}a2.7 2.4 0 0 0 5.4 0`;
    }
    detail += `<path d="${sc}" fill="none" stroke="${dark}" stroke-width=".8" opacity=".5"/>`;
    detail += pen.line([[cx - 9.6, my + 9], [cx, my + 11], [cx + 9.6, my + 9]], 0.8, { op: 0.4 });
  }
  // a thread of smoke from one nostril; two snorts of it when crossed
  let smoke = '';
  if (pen.mid) {
    smoke += `<g class="llp-smoke">${pen.line([[cx + 5.6, g.noseY - 1], [cx + 2.4, g.noseY - 8], [cx + 5, g.noseY - 15], [cx + 2, g.noseY - 23]], 1.3, { c: '#efe9dc', op: 0.6, tp: 'in' })}</g>`;
    let snort = '';
    for (const sd of [-1, 1]) snort += pen.line([[cx + sd * 9, g.noseY + 2.6], [cx + sd * 17, g.noseY + 6.6], [cx + sd * 24, g.noseY + 2.6], [cx + sd * 30, g.noseY + 6]], 2.6, { c: '#efe9dc', op: 0.85, tp: 'in' });
    smoke += `<g data-k="furrow" opacity="${fr['furrow.opacity'] ?? 0}">${snort}</g>`;
  }

  const hat = drawHat(g, geo, pen);
  const face = faceMarkup(g, pen, fr);
  const tool = pen.lod === 0 ? { back: '', front: '' } : drawTool(g, geo, pen);

  const backG = `<g data-k="hb"${at('hb.transform', 'transform')}>${horns}${hat.back}</g>`;
  const headG = `<g data-k="hd"${at('hd.transform', 'transform')}>` + fin(-1) + fin(1) + head + ov.under + muzzle
    + drawBlush(g, geo, pen, fr['blush.opacity'] ?? '0.3') + detail
    + face.eyes + face.brows + face.mouth + face.special + drawSpecs(g, geo, pen) + hat.front + smoke + ov.over + '</g>';

  // ── claws: the ledger in one, the quill in the other
  let hands = '';
  if (pen.lod > 0) {
    const s = g.toolSide;
    const claw = (x: number, y: number, dir: number): string => {
      let o = '';
      for (let i = 0; i < 3; i++) {
        const yy = y - 6.4 + i * 6.4;
        o += pen.blob(ellipse(x, yy, 5.6, 2.9, 7), skin, { w: 1.1, wob: 0.2 });
        o += pen.blobPoly(cw([[x + dir * 4.6, yy - 1.5], [x + dir * 9.6, yy + 0.6], [x + dir * 4.6, yy + 1.7]]), bone, { w: 0.8 });
      }
      return o;
    };
    // ledger side: three claws hooked over the near edge of the book
    const h = heldAt(g, geo);
    const edge = cx + s * h.u - s * 15.5 * h.k * (s > 0 ? 1 : 0.94), by = h.y - 6 * h.k + 3;
    hands += pen.blob(cw(tubePts([[cx + s * 6, nb + 44], [cx + s * 11, nb + 33], [edge - s * 2, by + 4]], [5.6, 5, 4.2])), skin, { w: 1.3 });
    hands += claw(edge + s * 2.5, by + 1, s);
    // quill side
    const qx = cx - s * 37, qy = nb + 22;
    const q0: Pt = [qx + s * 5, qy + 15], q1: Pt = [qx - s * 12, qy - 44];
    const vane: Pt[] = [[qx - s * 2, qy - 14], [qx - s * 14.6, qy - 22], [q1[0] - s * 4, q1[1] + 5], q1, [q1[0] + s * 6.6, q1[1] + 13], [qx + s * 2.6, qy - 18]];
    hands += pen.blob(cw(vane), PIG.linen, { w: 1.1, shade: '#cfc5aa', sx: -2 * s, sy: 0 });
    hands += pen.line([q0, [qx - s * 4, qy - 16], q1], 1.1, { tp: 'flat' });
    if (pen.fine) for (const t of [0.5, 0.62, 0.74, 0.86]) {
      const x = q0[0] + (q1[0] - q0[0]) * t, y = q0[1] + (q1[1] - q0[1]) * t;
      hands += pen.line([[x, y], [x - s * 5, y - 2.6]], 0.5, { tp: 'out', op: 0.55 }) + pen.line([[x, y], [x + s * 3.6, y - 4.6]], 0.5, { tp: 'out', op: 0.55 });
    }
    hands += pen.dot(q0[0] + s * 0.4, q0[1] + 1, 1.3, '#26304a');
    hands += pen.blob(cw(tubePts([[cx - s * 14, nb + 40], [cx - s * 23, nb + 32], [qx + s * 3, qy + 5]], [5.6, 5, 4.2])), skin, { w: 1.3 });
    hands += claw(qx + s * 1, qy + 3, -s);
  }

  const horn = T - 27;
  return { markup: wings + backG + tool.back + body + headG + tool.front + hands, top: Math.min(horn, hat.top) };
}
