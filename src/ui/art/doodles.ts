/**
 * OWNER: ui-art agent. The margin creatures. Each is drawn in its own small
 * frame (mostly 100 units square) by the loose marginal pen, ink line first
 * and colour washed in after, a little off the line. The seed varies pose,
 * pigments and small particulars; the joke stays the same.
 */
import { Pen, pick, type P } from './ink';
import { C, tint, coin, crownedHead, note, zzz, tuft, ground, sweat, burst, ribbon, smoke, vine, bezant, tendril } from './paint';

export type CreatureKind = 'snail_knight' | 'rabbit_joust' | 'goose_bishop' | 'cat_lute' | 'fox_scribe' | 'griffin' | 'goblin_scroll' | 'dragon_small' | 'mouse_coin' | 'owl_ledger' | 'hound_horn' | 'vine';
export interface DoodleDef { w: number; h: number; draw: (p: Pen, d: () => number) => void }

const chance = (d: () => number, v: number) => d() < v;

// ───────────────────────── snail knight ─────────────────────────
const snail_knight: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const shell = pick(d, [C.ochre, C.brown, C.verd, C.rubric]);
    const accent = pick(d, [C.rubric, C.lapis, C.gold, C.verd].filter(c => c !== shell));
    const tilt = -5 + d() * 8, plume = chance(d, 0.6), forked = chance(d, 0.5), bend = d() * 3 - 1.5, spirals = 2.1 + d() * 0.4;
    ground(p, d, 2, 98, 88);
    tuft(p, 4, 88, 1.1); tuft(p, 95, 88, 0.9);
    const foot = 'M5 86.5C12 84 22 82.5 34 82.5L64 82C69 80 71 72 72.5 60L87.5 60C88.5 70 90 79 96 84C97 86 95 87 92 87L8 87.2Z';
    p.wash(foot, C.flesh, 0.5, 0.4);
    p.s('M5 86.5C12 84 22 82.5 34 82.5L64 82C69 80 71 72 72.5 60');
    p.s('M87.5 60C88.5 70 90 79 96 84C97 86 95 87 92 87L8 87.2C6 87.2 4.6 86.8 5 86.5', 0.9);
    for (const x of [44, 52, 60, 77, 83]) p.s(`M${x} 86.4L${x + 1.6} 84.4`, 0.4);
    // the shell, and a great deal of house on one's back
    p.washE(42, 57, 25, 24, -6, shell, 0.5, 0.5);
    p.e(42, 57, 25, 24, -6, 1.1);
    p.spiral(44, 59, 2, 20.5, spirals, 200, 0.85, 1);
    for (let i = 0; i < 9; i++) { const a = (160 + i * 24) * Math.PI / 180; p.s(`M${42 + Math.cos(a) * 21.8} ${57 + Math.sin(a) * 21}L${42 + Math.cos(a) * 24.4} ${57 + Math.sin(a) * 23.4}`, 0.4); }
    // the great helm, with the eyes coming out of the top
    const helm = 'M71 60L71 42C71 38.4 89 38.4 89 42L89 60Z';
    p.wash(helm, C.steel, 0.55, 0.4);
    p.s(helm, 0.95);
    p.s('M71.4 44.4L88.6 44.4', 0.45);
    p.s('M78.6 47.8L88.8 47.6', 1);
    p.dot(85.4, 52.6, 0.55); p.dot(87.4, 54.6, 0.55); p.dot(85.4, 56.4, 0.55);
    p.dot(73, 42.2, 0.4); p.dot(77, 42, 0.4); p.dot(81, 42, 0.4); p.dot(85, 42.2, 0.4);
    p.s(`M77 39.2C76.4 35 ${75 + bend} 32 ${73.6 + bend} 28.4`, 0.62); p.dot(73.4 + bend, 27.8, 1.55);
    p.s('M83 39C83.8 35 85.2 31.6 86.8 28.6', 0.62); p.dot(87, 28, 1.55);
    if (plume) {
      p.wash('M72 40C66 37 61 32 59.6 25.4C64 29 68 31.4 73.2 38.2Z', accent, 0.55);
      p.s('M72.4 39.6C66 36.6 61.4 31.6 59.6 25.4', 0.7);
      p.s('M70 37.6C66.4 35 63.6 32 62.4 29.4', 0.35);
    }
    // the lance, couched under the chin, with a pennon
    p.layer();
    p.around(18, 78, { r: tilt }, () => {
      p.shape('M17.7 76.5L99 62L18.3 79.5Z', C.wood, 0.75, 0.92);
      p.shape('M30.5 73.9L34.9 70.6Q36.6 74.5 36.4 78.4L31.1 77.1Z', C.steel, 0.7, 0.95);
      const pen = forked ? 'M93 63.2L93.6 70.2Q86 69.6 78.6 73.2L82.6 68.6L77.4 65.8Q85.2 65.4 93 63.2Z' : 'M93 63.2L93.6 70.4Q85 69.4 75.6 68.4Q84.6 65.8 93 63.2Z';
      p.shape(pen, accent, 0.65, 0.92);
    });
  },
};

// ───────────────────────── rabbits jousting ─────────────────────────
interface RabbitOpts { fur: string; coat: string; shield: string; charge: string; device: number; hat: 0 | 1 | 2; flop: boolean; broken: boolean }
/** A rabbit in a surcoat, upright and charging to the right; lance tip at (70, 43). */
function rabbit(p: Pen, o: RabbitOpts): void {
  // the back leg, kicked out behind, and the tail
  p.s('M27 71C22 75 17 79.6 12 83.6C10 85 9 87.2 11.4 87.8C14 88.2 16.4 86.2 18.4 84.4', 0.85);
  p.washE(21.6, 64.6, 3.8, 3.6, 0, C.white, 0.9); p.e(21.6, 64.6, 3.8, 3.6, 0, 0.5);
  // surcoat, dagged at the hem
  const coat = 'M30 38.6C26 44 24 52 23 60C22.6 64 22.4 68 23 71L26 73.4L29 71L32 73.4L35 71L38 73.4L41 71L44 73.4L45 71C45 64 44.4 56 43 50C42 45 40.4 41 38 38.8Z';
  p.wash(coat, o.coat, 0.6, 0.4);
  p.s('M30 38.6C26 44 24 52 23 60C22.6 64 22.4 68 23 71', 0.95);
  p.s('M38 38.8C40.4 41 42 45 43 50C44.4 56 45 64 45 71', 0.85);
  p.s('M23 71L26 73.4L29 71L32 73.4L35 71L38 73.4L41 71L44 73.4L45 71', 0.55);
  p.s('M24 58.4C30 60 38 60 44.4 58.4', 0.5);
  // the front leg, striding, with a great deal of foot
  p.s('M38 72.6C44 74 47.4 78 47.4 83.4C47.4 86 48.4 88 51.4 88L58.4 88C60.4 88 60.6 86 58.8 85.4L51 84.2', 0.9);
  // head and ears
  const head = 'M28 30C28 23 33 19.5 39 19.5C45 19.5 49 23 50 28C50.6 31 49.6 34 47 36C44 38.6 38 39.4 33.6 38C30 36.8 28 33.6 28 30Z';
  p.wash(head, o.fur, 0.48, 0.4);
  p.s(head);
  const e1 = 'M33 21C29 14 26 7 27 2.4C31 4 35 11 37.6 19.4';
  p.wash(e1 + 'Z', o.fur, 0.45); p.s(e1, 0.85);
  p.ink(C.rose, () => p.s('M33.4 18.4C30.6 13 28.8 8.4 28.6 5.4', 0.6));
  const e2 = o.flop ? 'M38.6 19.4C42 14 48 11.6 54 12.4C52.4 16 47.6 19.4 42.6 21' : 'M38.6 19.4C39 12 41.6 5 45.6 1.8C47 7 45 14 42.4 20.4';
  p.wash(e2 + 'Z', o.fur, 0.45); p.s(e2, 0.85);
  p.dot(42.4, 26.4, 1.25); p.dot(42, 25.9, 0.35, C.white);
  p.s('M40 23.6C41.4 22.8 43.2 22.8 44.4 23.8', 0.38);
  p.dot(50, 29.4, 0.95, C.rose);
  p.s('M49.6 31.4C49 33.2 47.6 33.6 46.4 33', 0.4);
  p.s('M47.4 29.6L54.4 27.8', 0.28); p.s('M47.6 31L54.6 31.4', 0.28);
  p.s('M31 33.6C30 34.6 29.6 36 30 37.4', 0.3);
  if (o.hat === 1) {
    // a kettle hat, with holes made for the ears
    p.wash('M27.6 24.6C32 20.8 42 20 48.6 22.6C46 21 46.4 16 40 15.6C34.6 15.4 31.6 18.6 31.4 23Z', C.steel, 0.65);
    p.s('M27.4 24.8C32 21 42 20.2 48.8 22.8', 0.85);
    p.s('M31.4 23C31.6 18.6 34.6 15.4 40 15.6C45 15.8 46.6 18.4 46.4 21.4', 0.75);
  } else if (o.hat === 2) {
    // a chaperon, its tail flying
    p.wash('M28.8 31C27 24 31.6 18.6 38.4 18.6C43 18.6 46 20.6 47.4 23C42 21.8 36.4 23 32.6 26.4C31 28 30.4 30 30.6 32.4Z', o.coat, 0.65);
    p.s('M28.8 31C27 24 31.6 18.6 38.4 18.6C43 18.6 46 20.6 47.4 23', 0.75);
    p.s('M30 22.4C24 21.4 18.6 23.6 13.6 28.6', 0.75); p.s('M30.8 24.4C25.4 24 20.6 26 16 30', 0.45);
  }
  // the lance, couched, passing behind the shield
  p.layer();
  if (!o.broken) p.shape('M24.4 49.6L70.4 42.6L24.8 52.6Z', C.wood, 0.7, 0.95);
  else p.shape('M24.4 49.6L57.6 44.6L56.2 46.2L58.4 46.6L56.8 47.6L24.8 52.6Z', C.wood, 0.7, 0.95);
  // the shield, on the near arm, with arms upon it
  p.layer();
  const sh = 'M29 42.6L43 42.6L43 49.6C43 55.2 40 58.6 36 60.6C32 58.6 29 55.2 29 49.6Z';
  p.shape(sh, o.shield, 0.85, 0.95);
  p.ink(o.charge, () => {
    if (o.device === 0) { p.s('M36 44.6L36 58', 1.3); p.s('M30.6 49.4L41.4 49.4', 1.3); }
    else if (o.device === 1) p.s('M30.4 44L42 57', 1.6);
    else p.s('M29.8 49L36 54.6L42.2 49', 1.4);
  });
  p.s('M29.8 43.6L42.2 43.6', 0.35);
}

const rabbit_joust: DoodleDef = {
  w: 140, h: 100,
  draw(p, d) {
    const furs = [C.flesh, C.grey, tint(C.brown, 0.25), C.white];
    const coats = [C.rubric, C.lapis, C.verd];
    const ca = pick(d, coats), cb = pick(d, coats.filter(t => t !== ca));
    const loser = chance(d, 0.5) ? 0 : 1;
    const metal = () => (d() < 0.6 ? C.goldL : C.white);
    const A: RabbitOpts = { fur: pick(d, furs), coat: ca, shield: cb, charge: metal(), device: Math.floor(d() * 3), hat: Math.floor(d() * 3) as 0 | 1 | 2, flop: chance(d, 0.5), broken: loser === 0 };
    const B: RabbitOpts = { fur: pick(d, furs.filter(f => f !== A.fur)), coat: cb, shield: ca, charge: metal(), device: Math.floor(d() * 3), hat: Math.floor(d() * 3) as 0 | 1 | 2, flop: chance(d, 0.5), broken: loser === 1 };
    ground(p, d, 2, 138, 88.4);
    tuft(p, 70, 88.4, 1.1); tuft(p, 4, 88.4, 0.8);
    const la = 1 + d() * 4, lb = 1 + d() * 4;
    p.around(30, 88, { r: la }, () => rabbit(p, A));
    p.at({ x: 140, flip: true }, () => p.around(30, 88, { r: lb }, () => rabbit(p, B)));
    // the moment of impact, which the herald will record as a draw
    p.layer();
    burst(p, 70, 43, 0, 330, 12, 3.2, 7.6, 0.42);
    const sx = loser === 0 ? -1 : 1;
    for (let i = 0; i < 6; i++) {
      const x = 70 + sx * (1 + d() * 10), y = 34 + d() * 16, a = d() * 180;
      p.around(x, y, { r: a }, () => p.s(`M${x - 1.8} ${y}L${x + 1.8} ${y}`, 0.6));
    }
  },
};

// ───────────────────────── goose in a mitre ─────────────────────────
const goose_bishop: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const white = chance(d, 0.6);
    const mitre = pick(d, [C.white, C.white, C.rubric, C.lapis]);
    const open = chance(d, 0.5), tiltH = -5 + d() * 10;
    const body = white ? tint(C.grey, 0.55) : C.grey;
    ground(p, d, 30, 96, 90.2);
    tuft(p, 86, 90.2, 0.9);
    // the crozier, a gilded staff with a crook
    p.dual('M74.6 92L73.2 21.6', 2.6, C.goldL, 0.52);
    p.dual(chance(d, 0.5) ? 'M73.2 22.4C72.6 12 80 7.2 84.4 11.4C88 15 84.6 20.6 80.4 18.6C77.8 17.4 78.6 13.6 81.4 14.2' : 'M73.2 22.4C73.4 12.4 66 7.4 61.8 11.6C58.4 15.2 61.8 20.6 66 18.6C68.6 17.4 67.8 13.6 65 14.2', 2.4, C.goldL, 0.52);
    p.shapeE(73.4, 25.2, 2.4, 1.7, 0, C.gold, 0.6);
    p.layer();
    // body and neck
    const all = 'M25 34.2C26.6 40 23.6 46 25.6 52C26.8 56 28.8 59 31 62C30 70 38 78 52 79C66 79 80 72 84 63C87 58 89 51 90 45C84 50 74 50 64 50C54 50 46 52 43 56C40 55 37 53 36 50C34 45 38.4 39 35.8 32.6Z';
    p.wash(all, body, white ? 0.45 : 0.5, 0.4);
    p.s('M25 34.2C26.6 40 23.6 46 25.6 52C26.8 56 28.8 59 31 62');
    p.s('M31 62C30 70 38 78 52 79C66 79 80 72 84 63C87 58 89 51 90 45');
    p.s('M90 45C84 50 74 50 64 50C54 50 46 52 43 56', 0.85);
    p.s('M43 56C40 55 37 53 36 50C34 45 38.4 39 35.8 32.6', 0.85);
    p.s('M86 47.6L88.6 53', 0.4); p.s('M83.4 49.4L85.6 56', 0.4);
    // the wing, gripping the crozier as best a wing can
    const wing = 'M44 57C54 53 68 54 80 56C76 61 68 67 58 69C52 68 47 63 44 57Z';
    p.wash(wing, white ? C.grey : C.ink2, white ? 0.3 : 0.32);
    p.s(wing, 0.8);
    p.s('M58 69C60 66 62.6 65.8 64 67.6', 0.45); p.s('M64 67.6C66 64.6 68.6 64.2 70 66', 0.45); p.s('M70 66C71.4 63 73.6 62.4 75.4 63.6', 0.45);
    p.s('M50 58.6C56 57 62 57.4 68 58.6', 0.35);
    p.s('M70.6 55.6C73 55 75.8 55.8 76.8 57.6', 0.6); p.s('M70 59C72.8 58.8 75.4 59.8 76.2 61.4', 0.6);
    // legs, which are orange and know it
    p.s('M50 78.6L48.6 87.8', 0.75); p.s('M60.4 78L62.4 87.8', 0.75);
    p.shape('M43.2 89L48.6 87.4L53.6 89.2L48.4 90Z', C.ochre, 0.55);
    p.shape('M57.4 88.8L62.4 87.4L67.6 89L62.4 90Z', C.ochre, 0.55);
    // head, beak and mitre
    p.around(30, 34, { r: tiltH }, () => {
      p.wash('M24 25.4C22 27.4 22.2 32 25 34.2C28 36.4 33.6 35.6 35.8 32.4C37.2 30.2 37.2 27.2 36.2 25Z', body, white ? 0.45 : 0.5);
      p.s('M24 25.4C22 27.4 22.2 32 25 34.2', 0.9); p.s('M35.8 32.4C37.2 30.2 37.2 27.2 36.2 25', 0.9);
      if (!open) {
        p.shape('M23.6 28.4C19.6 28 15 29 11.4 30.8C14.8 32.6 19.6 33 24 31.8Z', C.ochre, 0.7, 0.85);
        p.s('M12.4 30.9C16 30.6 20 30.4 23.6 30.2', 0.35);
      } else {
        p.shape('M23.6 28.4C19.6 27.6 15 27.4 11.4 28.4C14.6 29.6 19.4 30.2 23.8 30.2Z', C.ochre, 0.7, 0.85);
        p.shape('M23.8 31.2C19.8 31.8 15.6 33 12.6 34.8C16.6 34.8 20.6 34.2 24 32.8Z', C.ochre, 0.7, 0.85);
        burst(p, 9, 31.6, 150, 210, 3, 1.4, 4.4, 0.35);
      }
      p.dot(28.4, 28.6, 0.95);
      p.s('M26.4 26.6C27.6 26 29 26 30.2 26.6', 0.35);
      // the mitre: two peaks seen edge-on, banded in gold, lappets behind
      p.wash('M35.6 24.4C38.4 30 39.2 36 37.6 42.4L40.4 42C41.6 35.6 40.6 29.6 37.4 24Z', mitre === C.white ? C.gold : mitre, 0.6);
      p.s('M35.6 24.4C38.4 30 39.2 36 37.6 42.4', 0.5); p.s('M37.4 24C40.6 29.6 41.6 35.6 40.4 42', 0.5);
      p.s('M37.6 42.4L37.4 44', 0.3); p.s('M38.6 42.3L38.6 44', 0.3); p.s('M39.6 42.2L39.8 43.8', 0.3);
      const m = 'M24 25.2C22.6 18 25 11 31 5C36 11 38 18 36.4 24.6C32.4 23.6 28 23.8 24 25.2Z';
      p.shape(m, mitre, 0.85, mitre === C.white ? 0.95 : 0.8);
      p.ink(C.goldD, () => { p.s('M24.4 23C28.2 21.8 32.4 21.6 36.6 22.4', 0.9); p.s('M30.4 21.8L31 6.4', 0.8); });
      p.ink(C.gold, () => { p.s('M24.4 23C28.2 21.8 32.4 21.6 36.6 22.4', 0.55); p.s('M30.4 21.8L31 6.4', 0.45); });
    });
  },
};

// ───────────────────────── cat with a lute ─────────────────────────
const cat_lute: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const fur = pick(d, [C.ochre, C.grey, C.ink2, tint(C.brown, 0.2)]);
    const closed = chance(d, 0.65), tabby = chance(d, 0.6), notes = 2 + Math.floor(d() * 3);
    const lute = pick(d, [C.wood, C.brown, C.ochre]);
    ground(p, d, 18, 98, 88.4);
    // tail curled round the feet
    p.s('M70 86C80 88.4 90 86 92 78C93 72 88 70 86 74', 1);
    p.s('M71 83.6C79 85 87 83 88.6 77.6', 0.4);
    const body = 'M30 88C26 78 28 62 36 52C40 46 46 44 52 44C60 44 66 48 70 56C76 68 76 80 72 88Z';
    p.wash(body, fur, 0.42, 0.4);
    p.s('M30 88C26 78 28 62 36 52C40 46 46 44 52 44C60 44 66 48 70 56C76 68 76 80 72 88');
    p.s('M60 70C68 71 72 79 70 87.6', 0.7);
    p.s('M30 88L72 88', 0.5);
    if (tabby) for (const [x, y] of [[66, 60], [70, 66], [72.6, 73]] as const) p.s(`M${x} ${y}L${x + 3} ${y + 1.6}`, 0.5);
    // head
    const head = 'M37 30C37 22 43 17 50 17C57 17 63 22 63 30C63 38 57 42 50 42C43 42 37 38 37 30Z';
    p.wash(head, fur, 0.42);
    p.s(head);
    p.wash('M39 23L37 10L46 18Z', fur, 0.42); p.wash('M54 18L63 10L61 23Z', fur, 0.42);
    p.s('M39 23L37 10L46 18', 0.85); p.s('M54 18L63 10L61 23', 0.85);
    p.ink(C.rose, () => { p.s('M39.6 19.6L38.6 13.4L43 17', 0.5); p.s('M57 17L61.4 13.4L60.4 19.6', 0.5); });
    if (closed) { p.s('M42.4 29C44 27.4 46 27.4 47.2 29', 0.6); p.s('M52.8 29C54 27.4 56 27.4 57.6 29', 0.6); }
    else { p.e(44.8, 28.6, 2.3, 1.7, 0, 0.5); p.e(55.2, 28.6, 2.3, 1.7, 0, 0.5); p.s('M44.8 27.2L44.8 30', 0.6); p.s('M55.2 27.2L55.2 30', 0.6); }
    p.solid('M48.6 32.2L51.4 32.2L50 33.8Z', C.rose);
    p.s('M48 35C49 36 50 35.8 50 34.2C50 35.8 51 36 52 35', 0.4);
    p.s('M46 33.4L37.6 32', 0.28); p.s('M46 34.6L38 35.6', 0.28); p.s('M54 33.4L62.4 32', 0.28); p.s('M54 34.6L62 35.6', 0.28);
    if (tabby) { p.s('M47 18.4L47.8 21.8', 0.45); p.s('M50 17.6L50 21.4', 0.45); p.s('M53 18.4L52.2 21.8', 0.45); }
    // the lute, held with more feeling than skill
    p.layer();
    p.dual('M45 60L23.6 43.2', 4.8, tint(lute, 0.25), 0.64);
    p.dual('M24.2 43.8L18.4 46', 4.2, tint(lute, 0.25), 0.6);
    p.s('M20.8 43.2L19.6 41.6', 0.5); p.s('M22.6 46.6L21.6 48.6', 0.5); p.s('M18.6 44L17.4 42.6', 0.5);
    p.shapeE(55, 67, 14.6, 10.6, -32, tint(lute, 0.12), 0.95, 0.95);
    p.e(56.5, 66, 3, 3, 0, 0.5);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.dot(56.5 + Math.cos(a) * 1.5, 66 + Math.sin(a) * 1.5, 0.35); }
    p.s('M59.8 72.4L64 69.4', 0.8);
    p.s('M61.6 71.6L24.6 43.4', 0.25); p.s('M62.6 70.8L25.6 42.8', 0.25);
    // paws
    p.layer();
    p.s('M38 52C35 50 33.4 49.6 31.8 49.6', 0.8);
    p.washE(31, 49.6, 3.4, 2.8, -30, fur, 0.6); p.e(31, 49.6, 3.4, 2.8, -30, 0.6);
    p.s('M64 54C66 60 64.4 66 61.4 68.4', 0.8);
    p.washE(60.4, 69, 3.2, 2.7, 20, fur, 0.6); p.e(60.4, 69, 3.2, 2.7, 20, 0.6);
    p.s('M64.8 72.6L67.6 74.4', 0.35); p.s('M65.4 70.6L68.6 71.2', 0.35);
    // and the music, such as it is
    const spots: [number, number][] = [[74, 26], [83, 15], [88, 30], [70, 12]];
    for (let i = 0; i < notes; i++) note(p, spots[i]![0], spots[i]![1], 0.9 + d() * 0.3, d() < 0.6);
  },
};

// ───────────────────────── fox at the writing desk ─────────────────────────
const fox_scribe: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const robe = pick(d, [C.lapis, C.rubric, C.verd, C.brown]);
    const specs = chance(d, 0.55), tongue = chance(d, 0.5);
    const fox = C.ochre;
    ground(p, d, 4, 96, 88.4);
    // tail, before anything else
    const tail = 'M20 62C8 64 2 74 6 82C10 88 20 86 24 80C18 80 14 76 16 70C17 67 19 65 20 62Z';
    p.wash(tail, fox, 0.55, 0.4);
    p.wash('M6 82C8.8 86.4 15 87.4 20 84C16 83 12 80 10.4 75.4C8 76.6 6.4 79 6 82Z', C.white, 0.85);
    p.s(tail, 0.9);
    p.s('M10 76.6C12.6 80.4 16 83 20.4 84', 0.35);
    // stool
    p.wash('M14 66.5C20 65.5 34 65.5 42 66.5L41.6 68.4C34 67.6 20 67.6 14.4 68.4Z', C.wood, 0.55);
    p.s('M14 66.5C20 65.5 34 65.5 42 66.5', 0.85);
    p.s('M18 67.6L14 88', 0.75); p.s('M38 67.6L42 88', 0.75); p.s('M28 67.8L28.6 88', 0.6);
    // the scribe, in a robe
    const body = 'M20 66C16 56 20 44 30 40C36 38 43 40 47 46C51 52 50 60 46 66Z';
    p.wash(body, robe, 0.55, 0.4);
    p.s(body);
    p.s('M40 66C44 72 46 78 45 84C44.6 86 47 86.6 50.4 86.2', 0.75);
    p.s('M33 41C34 48 33 56 30 65.6', 0.35);
    // head
    const head = 'M38 34C36 26 40 20 46 20C50 20 53 22 55 25L65 29.6C66.4 30.4 65.6 32.4 63.6 32.4C59.6 33 55.6 34 51.6 36C47.6 38 41 38 38 34Z';
    p.wash(head, fox, 0.55, 0.4);
    p.wash('M51.4 36.2C55.6 34.2 59.6 33.2 63.4 32.4C60 35 56 36.8 51.4 37.4Z', C.white, 0.9);
    p.s(head);
    p.wash('M40 23.4L38.6 12L45.6 19.8Z', fox, 0.55); p.wash('M46 19.6L49.6 10L52.4 21Z', fox, 0.55);
    p.s('M40 23.4L38.6 12L45.6 19.8', 0.8); p.s('M46 19.6L49.6 10L52.4 21', 0.8);
    p.solid('M40.2 19.6L39.6 14.6L42.6 18.2Z'); p.solid('M48 18.6L49.6 13.6L50.8 18.8Z');
    p.s('M48.6 25.4C49.6 24.4 51.4 24.4 52.4 25.4', 0.5); p.dot(50.6, 25.6, 0.8);
    p.dot(65.6, 30.8, 1.1);
    p.s('M56 33.4C58.6 33.2 61 32.8 63.4 32.2', 0.35);
    if (specs) { p.o(50.8, 25.8, 2.9, 0.42); p.s('M48 25.2C45 24.8 43 25.2 41.4 26.4', 0.3); }
    if (tongue) p.shape('M57.2 33.8C57.8 35.8 59.6 36.2 60.2 34.2Z', C.rose, 0.35);
    // the desk, the page, the ink
    const board = 'M56 52L82 40L86 46L60 58Z';
    p.wash(board, C.wood, 0.5);
    p.s(board, 0.8);
    p.shape('M59.6 52.2L80 42.8L82.6 46.4L62.4 55.6Z', C.white, 0.45, 0.9);
    for (let i = 0; i < 3; i++) p.s(`M${62.4 + i * 0.9} ${52.2 + i * 1.1}L${78.6 + i * 0.9 - (i === 2 ? 5 : 0)} ${44.6 + i * 1.1 + (i === 2 ? 2.3 : 0)}`, 0.28);
    p.s('M72 50.6L72 88', 0.85); p.s('M64 88L80.4 88', 0.8);
    p.shape('M83.6 40.4L88.6 38.4L86.6 44.8Z', C.ink2, 0.5);
    p.s('M86.4 39.2L90 30.4', 0.4);
    // the sleeve, the paw, the quill
    p.layer();
    p.wash('M41.6 43.4C48 47.4 53.4 49.6 58.6 50C58.4 52 58 53 57 53.6C52 53 46 50.6 40.6 47Z', robe, 0.55);
    p.s('M41.6 43.4C48 47.4 53.4 49.6 58.6 50', 0.75); p.s('M40.6 47C46 50.6 52 53 57 53.6', 0.6);
    p.washE(59.4, 51.6, 2.2, 2, 0, fox, 0.7); p.e(59.4, 51.6, 2.2, 2, 0, 0.55);
    p.s('M61 54.6L71.4 35.6', 0.42);
    p.shape('M63.2 50.2C64 44.6 67 39.6 72.4 35.6C71.8 40.8 68.8 45.6 63.2 50.2Z', C.white, 0.5, 0.92);
  },
};

// ───────────────────────── griffin ─────────────────────────
const griffin: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const wingC = pick(d, [C.gold, C.lapis, C.verd, C.rubric]);
    const prop = Math.floor(d() * 3); // 0 nothing, 1 weathervane in beak, 2 coin in claw
    const raise = -6 + d() * 10;
    ground(p, d, 4, 98, 88.2);
    tuft(p, 92, 88.2, 1); tuft(p, 20, 88.2, 0.8);
    // the wing, raised
    p.around(46, 52, { r: raise }, () => {
      const wing = 'M46 52C45 36 52 18 66 6C70 10 74 16 76 22C77 26 79 30 78 33C76 37 75 40 72 42C70 45 66 47 62 48C58 50 53 51 48 53Z';
      p.wash(wing, wingC, 0.5, 0.4);
      p.s('M46 52C45 36 52 18 66 6');
      p.s('M66 6C70 10 74 16 76 22C77 26 79 30 78 33C76 37 75 40 72 42C70 45 66 47 62 48C58 50 53 51 48 53', 0.8);
      p.s('M53 34C61 30 69 26 76 22', 0.45); p.s('M53 40C61 37.4 70 35 78 33', 0.45); p.s('M53 45.6C60 43.6 66 42.6 72 42', 0.45);
      for (const [x, y] of [[50, 30], [52.6, 24], [56, 18.6]] as const) p.s(`M${x} ${y}C${x + 1.6} ${y - 1.6} ${x + 3.4} ${y - 1.4} ${x + 4} ${y + 0.4}`, 0.35);
    });
    // the lion half
    const body = 'M44 52C54 50 70 50 78 56C84 61 84 68 80 72C78 76 80 82 84 87L77 87C74 82 72 78 70 74C64 76 60 76 56 75C56 80 58 84 61 87L54 87C52 83 50 79 49 74C46 72 44 70 42 68';
    p.wash(body + 'Z', C.ochre, 0.4, 0.4);
    p.s(body);
    p.s('M80 58C90 56 94 46 90 38C88.6 34.6 91 31.6 94 32.6', 0.8);
    p.wash('M94 32.6C96.6 30 97 27 95 25.4C94.6 28 93 29.6 91.4 30.6Z', C.ochre, 0.6);
    p.s('M94 32.6C96.6 30 97 27 95 25.4C94.6 28 93 29.6 91.4 30.6', 0.6);
    p.s('M66 60C70 62 72 66 70.6 70', 0.35);
    // the eagle half
    const fore = 'M42 68C34 62 29 54 27 46C26 42 25 40 22.6 38C20.6 32 24 26.4 30 26.2C35 26 37.4 30 36 34.6C36.6 42 40 48 46 54Z';
    p.wash(fore, C.white, 0.75);
    p.s('M42 68C34 62 29 54 27 46C26 42 25 40 22.6 38');
    p.s('M22.6 38C20.6 32 24 26.4 30 26.2C35 26 37.4 30 36 34.6', 0.9);
    p.s('M46 54C40 48 36.6 42 35.4 36', 0.8);
    for (const [x, y] of [[29.6, 46], [32, 52], [35.4, 58], [31.4, 40.6]] as const) p.s(`M${x} ${y}C${x + 1.5} ${y - 1.5} ${x + 3} ${y - 1.5} ${x + 4} ${y}`, 0.38);
    p.shape('M22.6 36.6C17 35.4 12.6 37.4 12.4 40.4C12.4 42.2 14 43.2 15.2 42.2C15.4 40.2 17.4 39.6 22.8 40.6Z', C.gold, 0.75);
    p.dot(28.6, 31.4, 0.9); p.s('M26 29.4C27.6 28.4 29.6 28.4 31 29.4', 0.45);
    p.s('M33.4 27.2L36.6 19.6L36.8 28.2', 0.7);
    // legs and claws
    p.s('M42 68C40 74 38 80 36 86', 0.85);
    p.s('M36 86C34 86.4 32 87 30.6 88', 0.5); p.s('M36.4 86.2L35.6 88.6', 0.5); p.s('M36.8 86C38.6 86.4 40 87 41 88.4', 0.5);
    p.s('M44 66C38 64 33 62 30 58', 0.85);
    p.s('M30 58C28 57.4 26.4 57.8 25.6 59', 0.5); p.s('M30 58C29.4 56 28 55 26.6 55', 0.5); p.s('M30.2 58.4C30 60 29 61.4 27.8 62', 0.5);
    if (prop === 2) coin(p, 25.4, 57, 3.4, 3.4, 0, 0.6);
    if (prop === 1) {
      // somebody's weathervane
      p.layer();
      p.s('M3 44.6L21 38.8', 0.6);
      p.solid('M2 45L6.4 41.8L6.2 46.4Z');
      p.s('M18.4 39.8L20.6 36.6', 0.4); p.s('M19.6 39.4L21.8 37', 0.4); p.s('M18.8 40L22 41.6', 0.4);
      p.shape('M8.4 42.2C8 39.8 9.4 38 11.2 38.2L12.4 36.6L12.8 38.4C14.2 38.6 15.4 39.6 15.4 40.6Z', C.gold, 0.45);
    }
  },
};

// ───────────────────────── goblin with a very long scroll ─────────────────────────
const goblin_scroll: DoodleDef = {
  w: 130, h: 100,
  draw(p, d) {
    const tunic = pick(d, [C.rubric, C.lapis, C.ochre, C.brown]);
    const hat = Math.floor(d() * 3), specs = chance(d, 0.65), twist = 1.5 + d() * 1.1, ph = d() * 0.5;
    const skin = '#8fa35a';
    ground(p, d, 4, 128, 88.2);
    // the scroll, which has been unrolled to the relevant clause and some way past it
    const pts: P[] = [[42.6, 54], [52, 57], [57.6, 67], [61, 79], [67, 85.4], [80, 85.6], [94, 86.4], [108, 85.4], [121, 86.2]];
    const fall = 0.27 + d() * 0.05;
    const rb = ribbon(p, pts, t => t < fall ? 17 - 11.6 * Math.pow(t / fall, 0.8) : 5.4 + Math.sin(t * twist * 9) * 0.5, C.white, '#e2d2a6', { op: 0.9, wm: 0.7 });
    // writing on the face of it, in a hand that admits no appeal
    const n = rb.mid.length;
    for (let i = 3; i < n - 5; i += 5) {
      const w = rb.ws[i]!, rows = w > 6 ? [0.28, 0.5, 0.72] : [0.36, 0.66];
      if (d() < 0.12) continue;
      for (const f of rows) {
        const a = rb.left[i]!, b = rb.right[i]!, a2 = rb.left[i + 3]!, b2 = rb.right[i + 3]!;
        p.line([[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], [a2[0] + (b2[0] - a2[0]) * f, a2[1] + (b2[1] - a2[1]) * f]], 0.24, 0.6, 0.6);
      }
    }
    const end = rb.mid[n - 1]!;
    p.spiral(end[0] + 1.4, end[1] - 2.4, 0.6, 3, 1.4, 120, 0.55, 1);
    p.shapeE(end[0] - 8, end[1] + 0.2, 2.4, 1.3, 0, C.rubric, 0.5);
    p.s(`M${end[0] - 8.6} ${end[1] + 1.4}L${end[0] - 9.8} ${end[1] + 3}`, 0.4); p.s(`M${end[0] - 7.4} ${end[1] + 1.4}L${end[0] - 6.4} ${end[1] + 3}`, 0.4);
    // the goblin
    p.layer();
    p.s('M16 86L9.6 87.2C8.4 87.4 8.2 86 9.4 85.6', 0.8); p.s('M28 86L34.6 87.4C35.8 87.6 36 86.2 34.8 85.8', 0.8);
    p.s('M18 73L16 86', 0.8); p.s('M26 73L28 86', 0.8);
    const coat = 'M13 74C12 66 15 56 22 52C29 56 32 66 31 74C25 76 19 76 13 74Z';
    p.wash(coat, tunic, 0.55, 0.4); p.s(coat, 0.9);
    p.s('M14.2 66C19 67.6 25 67.6 30.2 66', 0.6);
    p.shape('M25.6 67.4L29.4 67.2L29 71L26 71Z', C.brown, 0.45);
    const head = 'M10 36C10 28 16 22 22 22C28 22 34 28 34 36C34 44 28 48 22 48C16 48 10 44 10 36Z';
    p.wash(head, skin, 0.55, 0.4);
    p.wash('M11 33L1.4 25.6C2.2 30 5.6 36 11 39.4Z', skin, 0.55); p.wash('M33 33L42.6 25.6C41.8 30 38.4 36 33 39.4Z', skin, 0.55);
    p.s(head);
    p.s('M11 33L1.4 25.6C2.2 30 5.6 36 11 39.4', 0.8); p.s('M33 33L42.6 25.6C41.8 30 38.4 36 33 39.4', 0.8);
    p.dot(20.8, 33.6, 0.95); p.dot(28.4, 33.6, 0.95);
    if (specs) { p.o(20.8, 33.6, 3, 0.4); p.o(28.4, 33.6, 3, 0.4); p.s('M23.8 33.4L25.4 33.4', 0.35); }
    p.s('M17.6 29.2L22.6 28.4', 0.5); p.s('M26.6 28.2L31.2 29.4', 0.5);
    p.s('M25 35C27.6 37.6 28 40 24.4 40.6', 0.6);
    p.s('M19 43.2C21.6 44.4 25 44.4 27.4 43', 0.55); p.s('M22.6 43.8L23 45.2', 0.4);
    if (hat === 1) {
      p.shape('M15 23.6L15.4 17.4C19.6 16.2 25 16.2 29 17.4L29.2 23.6C25 22.4 19.4 22.4 15 23.6Z', C.rubric, 0.7, 0.85);
      p.s('M28 18L33 9.4', 0.5);
      p.shape('M29.6 15.2C30 12 31.4 10 33.4 9C33.6 11.6 32.4 13.8 29.6 15.2Z', C.white, 0.35);
    } else if (hat === 2) {
      p.shape('M13.6 26C14 18 18 12 26 8C28 14 31 20 31 26C25 23.6 19 23.6 13.6 26Z', C.lapis, 0.7, 0.8);
      p.dot(26, 7.4, 1.2, C.gold);
    } else { p.s('M20 22.4C19.4 19.4 18 18 16.4 17.6', 0.35); p.s('M23 22C23.4 19 24.6 17.4 26.4 17', 0.35); p.s('M21.6 22.2L21.8 18.4', 0.35); }
    // the roll and the hands that hold it
    p.layer();
    p.shape('M38.4 45L43 45L43 63L38.4 63Z', tint(C.ochre, 0.55), 0, 1);
    p.s('M38.4 45L38.4 63', 0.6); p.s('M43 45L43 63', 0.6);
    p.e(40.7, 45, 2.3, 1, 0, 0.5); p.e(40.7, 63, 2.3, 1, 0, 0.5);
    p.s('M40.7 44L40.7 41', 0.6); p.dot(40.7, 40.4, 1.1); p.s('M40.7 64L40.7 67', 0.6); p.dot(40.7, 67.6, 1.1);
    p.s('M25 55C30 57 34 57.6 38 56', 0.75); p.s('M19 57C23 61 31 61.4 38 59.6', 0.75);
    p.washE(38.6, 55.8, 2, 1.8, 0, skin, 0.7); p.e(38.6, 55.8, 2, 1.8, 0, 0.5);
    p.washE(38.4, 59.8, 2, 1.8, 0, skin, 0.7); p.e(38.4, 59.8, 2, 1.8, 0, 0.5);
  },
};

// ───────────────────────── small dragon asleep on its hoard ─────────────────────────
const dragon_small: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const hide = pick(d, [C.verd, C.rubric, C.lapis, C.green]);
    const sleep = chance(d, 0.55), item = Math.floor(d() * 3);
    // the hoard
    p.wash('M4 89C10 77 26 69 50 67C74 69 90 77 96 89Z', C.gold, 0.4);
    p.s('M4 89C10 78 20 72 30 69.6', 0.5); p.s('M74 69.4C84 72 92 78 96 89', 0.5);
    p.s('M2 89.4L98 89.4', 0.45);
    const top = (x: number) => 89 - 22 * Math.pow(Math.max(0, 1 - Math.pow((x - 50) / 46, 2)), 0.8);
    for (let i = 0; i < 22; i++) {
      const x = 8 + d() * 84, t = top(x);
      const y = t + 1.6 + d() * (89 - t - 2);
      if (x > 18 && x < 84 && y < 78) continue;
      if (d() < 0.18) coin(p, x, y - 1.4, 1.7, 3, d() * 20 - 10, 0.5);
      else coin(p, x, y, 3.2, 1.3, d() * 24 - 12, 0.5);
    }
    if (item === 1) {
      p.shape('M78 72.6L86 72.6C86 76 84 77.6 82.8 78L82.8 81L85 82L79 82L81.2 81L81.2 78C80 77.6 78 76 78 72.6Z', C.gold, 0.55);
      p.dot(82, 74.6, 0.6, C.rubric);
    } else if (item === 2) {
      p.shape('M74 80L73 74L76 76.4L78 72.6L80 76.4L83 74L82 80Z', C.gold, 0.55);
      p.dot(78, 78.2, 0.6, C.lapis);
    }
    for (const [x, y] of [[8, 90.6], [91, 90.8], [14, 91.4]] as const) coin(p, x, y, 3, 1.2, 0, 0.5);
    // the dragon
    p.layer();
    p.dual('M80 66C84 74 76 79.4 62 79.4C50 79.4 42 77.4 38.6 73.8', 3.8, tint(hide, 0.45), 0.56);
    p.shape('M38.8 73.8L33.4 71.4L33.8 76.4Z', tint(hide, 0.3), 0.55);
    const body = 'M30 66C26 54 38 44 54 44C70 44 82 52 82 61C82 68 74 72 64 72L36 72C33 71 31 69 30 66Z';
    p.wash(body, hide, 0.5, 0.4);
    p.s('M30 66C26 54 38 44 54 44C70 44 82 52 82 61C82 68 74 72 64 72', 0.95);
    p.wash('M36 70C46 72 58 72 66 70.4L64.6 72.2L36.6 72.4Z', C.ochre, 0.5);
    for (let x = 40; x < 64; x += 4) p.s(`M${x} 70.6L${x + 0.6} 72.2`, 0.3);
    for (const [x, y, a] of [[32, 56, -150], [37, 50, -125], [43.4, 46.2, -105], [74.6, 47.6, -55], [79.4, 52, -35], [81.8, 57, -15]] as const) {
      const r = a * Math.PI / 180, nx = Math.cos(r), ny = Math.sin(r), tx = -ny, ty = nx;
      p.shape(`M${x - tx * 2.2} ${y - ty * 2.2}L${x + nx * 4.6} ${y + ny * 4.6}L${x + tx * 2.2} ${y + ty * 2.2}Z`, tint(hide, 0.2), 0.45);
    }
    // a folded bat's wing
    const wing = 'M50 46C51 38 53 32 56 27.6C58.6 30.4 61 30.2 64 29.6C66 32.4 68 33.4 70.6 33.8C71.6 36.4 73 38.2 74.6 39.8C70 42.6 62 45 50 46Z';
    p.wash(wing, tint(hide, 0.3), 0.65);
    p.s('M50 46C51 38 53 32 56 27.6', 0.75);
    p.s('M56 27.6C58.6 30.4 61 30.2 64 29.6C66 32.4 68 33.4 70.6 33.8C71.6 36.4 73 38.2 74.6 39.8', 0.55);
    p.s('M51 45L64 29.8', 0.4); p.s('M52 45.4L70.4 34', 0.4); p.s('M53 45.6L74.4 40', 0.4);
    // a little hind leg, tucked
    p.s('M68 71.4C71 66.6 77.4 66 80.6 69.6C82.4 71.8 81 74.2 77.6 74.4', 0.6);
    p.s('M77.6 74.4L76.6 76', 0.4); p.s('M79.6 74L79.2 75.8', 0.4);
    // head, resting on the hoard
    const head = 'M10 67C9.4 64.6 11 62.6 14 62L20 60.4C23 58 27.6 57 31 58.4C34.6 59.8 36.4 63 35.6 66.4C34.8 69.6 30.6 71.4 25.6 71.4L15.6 71C12.4 70.8 10.4 69.4 10 67Z';
    p.wash(head, hide, 0.5);
    p.s(head, 0.9);
    p.shape('M28.6 58.4C31.6 54.6 35 52.6 39.6 52C37 54.2 34.8 57 33.4 60.4Z', tint(hide, 0.15), 0.55);
    p.shape('M25.6 58C27 54.6 29.4 52.6 32.4 51.8C30.8 54 29.6 56.2 29 58.6Z', tint(hide, 0.15), 0.5);
    p.shape('M32 61.4L37 59.8L35 62.8L38 63.8L34.8 65.2Z', tint(hide, 0.3), 0.45);
    p.s('M12 62.6C12.6 61.6 13.8 61.4 14.8 62.2', 0.45); p.dot(13.6, 63.4, 0.55);
    p.s('M23.6 60.4C25.2 59.4 27.6 59.4 29.2 60.6', 0.55);
    p.s('M24.4 62.6C25.6 63.6 27.4 63.6 28.6 62.4', 0.5);
    p.s('M11 67.4C16 68.4 22 68.6 28 67.6', 0.42);
    p.shape('M15.4 68.1L16.6 68.2L16 70Z', C.white, 0.3);
    p.s('M26 71.2C30 73 36 73 40 71.2', 0.6); p.s('M26.6 71.6L25 73.4', 0.4); p.s('M29.4 72.4L28.4 74.2', 0.4);
    if (sleep) zzz(p, 14, 52, 0.85); else smoke(p, 11.6, 61.4, 14, -1);
  },
};

// ───────────────────────── mouse with a coin twice its size ─────────────────────────
const mouse_coin: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const fur = pick(d, [C.grey, tint(C.brown, 0.15), C.flesh]);
    const tip = -6 + d() * 10, tongue = chance(d, 0.5), drops = 1 + Math.floor(d() * 2);
    ground(p, d, 2, 98, 89);
    tuft(p, 96, 89, 0.8);
    // the coin, which is the point
    p.around(57, 68, { r: tip }, () => {
      p.shapeE(44, 44, 26, 26, 0, C.gold, 1.15, 0.85);
      p.washE(48, 48, 21, 21, 0, C.goldD, 0.16);
      p.e(44, 44, 22, 22, 0, 0.45, 0.94);
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; p.dot(44 + Math.cos(a) * 24, 44 + Math.sin(a) * 24, 0.5); }
      p.at({ x: 44 - 12 * 1.9, y: 44 - 12 * 1.9, s: 1.9 }, () => crownedHead(p, C.goldD));
    });
    // the mouse, beneath it
    p.layer();
    p.s('M38 80C28 82 20 88 12 84C8 82 9.4 76.6 13.4 78', 0.7);
    const body = 'M38 80C40 72 50 67 60 67.6C69 68 75 72 77 78C75 82.6 67 84.6 58 84.6C48 84.6 40 83.6 38 80Z';
    p.wash(body, fur, 0.5, 0.4); p.s(body);
    const head = 'M72 70.6C76 66.6 83.6 66.4 87.6 71.6L94 74.6C95.2 75.4 94.6 77 92.8 77.4C88.6 78.8 82.4 80 76.4 79.4Z';
    p.wash(head, fur, 0.5); p.s('M72 70.6C76 66.6 83.6 66.4 87.6 71.6L94 74.6C95.2 75.4 94.6 77 92.8 77.4C88.6 78.8 82.4 80 76.4 79.4', 0.9);
    p.washE(77.4, 65.4, 4.6, 5, 10, C.rose, 0.5); p.e(77.4, 65.4, 4.6, 5, 10, 0.8);
    p.s('M82 71.6C83 70.6 84.6 70.6 85.4 71.6', 0.55);
    p.s('M81.4 69.4L84 68.6', 0.35);
    p.dot(94.6, 75.4, 0.85);
    p.s('M91 75.4L98 73.4', 0.28); p.s('M91 76.6L98.2 77.4', 0.28);
    if (tongue) p.shape('M90.4 77.6C90.6 79.6 92.4 80 92.8 78.2Z', C.rose, 0.35);
    p.s('M70 83L73.4 88.6L77.6 88.8', 0.75); p.s('M46 83L42.6 88.6L38.8 89', 0.75);
    p.s('M54 84L53 88.6', 0.6);
    p.s('M64.4 70C63.4 66 62.2 63.2 60.4 60.8', 0.75); p.washE(60, 60.2, 2, 1.8, 0, fur, 0.7); p.e(60, 60.2, 2, 1.8, 0, 0.5);
    sweat(p, 92, 62, -40, 0.9);
    if (drops > 1) sweat(p, 97, 68.4, -5, 0.75);
    burst(p, 44, 88, 200, 250, 2, 2, 5, 0.32);
  },
};

// ───────────────────────── owl with a ledger ─────────────────────────
const owl_ledger: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const cover = pick(d, [C.rubric, C.lapis, C.verd, C.brown]);
    const specs = chance(d, 0.5), squint = chance(d, 0.4), quill = chance(d, 0.5);
    const feather = pick(d, [C.brown, tint(C.brown, 0.2), C.grey]);
    // a perch
    p.s('M6 89C30 87 70 87 95 89.6', 1);
    p.s('M8 91C24 89.4 40 89.2 52 89.4', 0.35);
    p.at({ x: 88, y: 88.6, r: -30 }, () => p.s('M0 0C3 -2.4 6.4 -2.6 9 0C6.4 2.6 3 2.4 0 0Z', 0.5));
    // body and tufts
    const body = 'M50 16C66 16 76 30 76 50C76 70 66 86 50 86C34 86 24 70 24 50C24 30 34 16 50 16Z';
    p.wash(body, feather, 0.42, 0.4);
    p.wash('M33 24L27.6 10L40 19.6Z', feather, 0.5); p.wash('M60 19.6L72.4 10L67 24Z', feather, 0.5);
    p.s(body);
    p.s('M33 24L27.6 10L40 19.6', 0.8); p.s('M60 19.6L72.4 10L67 24', 0.8);
    if (quill) { p.s('M64 23L80 4', 0.4); p.shape('M70.6 15.4C72 10.6 75 7 79.6 4.4C79 9 76.4 12.8 70.6 15.4Z', C.white, 0.42); }
    const disc = 'M50 26C44 22 32 24 30 34C28 44 36 50 44 50C47 50 49 49 50 48C51 49 53 50 56 50C64 50 72 44 70 34C68 24 56 22 50 26Z';
    p.wash(disc, C.white, 0.6);
    p.s(disc, 0.45);
    // the eyes, which have seen your accounts
    p.shapeE(41, 37, 8, 8, 0, C.goldL, 0.85, 0.85); p.shapeE(59, 37, 8, 8, 0, C.goldL, 0.85, 0.85);
    p.dot(41.6, 38.8, 3.6); p.dot(59.6, 38.8, 3.6);
    p.dot(40.4, 37.4, 0.8, C.white); p.dot(58.4, 37.4, 0.8, C.white);
    if (squint) { p.wash('M33 37C35 29.6 47 29.6 49 37C45 34.6 37 34.6 33 37Z', feather, 0.85); p.s('M33 37C37 34.6 45 34.6 49 37', 0.7); }
    p.s('M32.6 27.6L46 31.4', 0.7); p.s('M54 31.4L67.4 27.6', 0.7);
    if (specs) { p.o(41, 37, 10.2, 0.4); p.o(59, 37, 10.2, 0.4); p.s('M48 32.4C49.4 31.4 50.6 31.4 52 32.4', 0.35); }
    p.shape('M50 42L53 45.4C52.4 48.4 50.6 50.6 49.6 49.4C48.6 48 47.4 46.4 47 45.4Z', C.ochre, 0.55);
    for (const [x, y] of [[40, 54], [50, 55.4], [60, 54], [35, 59], [65, 59]] as const) p.s(`M${x - 1.6} ${y - 1}L${x} ${y + 0.6}L${x + 1.6} ${y - 1}`, 0.35);
    // the ledger
    p.layer();
    p.wash('M23.4 62.4C34 58 44 60 50 63C56 60 66 58 76.6 62.4L77.4 79.4C66 76 56 77 50 80C44 77 34 76 22.6 79.4Z', cover, 0.75);
    p.s('M23.4 62.4L22.6 79.4C34 76 44 77 50 80C56 77 66 76 77.4 79.4L76.6 62.4', 0.7);
    p.shape('M26 61.4C35 58.6 44 60 50 63L50 78.6C44 75.8 35 75 26 77Z', C.white, 0.6, 0.95);
    p.shape('M74 61.4C65 58.6 56 60 50 63L50 78.6C56 75.8 65 75 74 77Z', C.white, 0.6, 0.95);
    for (let i = 0; i < 5; i++) { const y = 64.2 + i * 2.6; p.s(`M29 ${y - 0.6}C34 ${y - 1.6} 40 ${y - 1.2} 47 ${y + 0.6}`, 0.25); }
    p.s('M41.4 61.2L41.4 76.4', 0.25);
    for (let i = 0; i < 4; i++) { const y = 64.6 + i * 2.6; p.s(`M54 ${y + 0.4}L58.6 ${y - 0.4}`, 0.3); p.s(`M64 ${y - 1.2}L70 ${y - 1.6}`, 0.3); }
    p.s('M63 74.2L71 73.6', 0.45); p.s('M63 75.6L71 75', 0.45);
    p.dot(76.8, 70.6, 1.2, C.gold);
    // wings holding it, and feet holding on
    p.layer();
    p.s('M26 44C19 52 18 64 24 74C25 76 27 76 27.6 74', 0.85); p.s('M24 70.4L28.6 69.4', 0.45); p.s('M23 66L27.8 65.4', 0.45);
    p.s('M74 44C81 52 82 64 76 74C75 76 73 76 72.4 74', 0.85); p.s('M76 70.4L71.4 69.4', 0.45); p.s('M77 66L72.2 65.4', 0.45);
    for (const x of [43, 46, 49, 52, 55, 58]) p.s(`M${x} 85.6L${x + (x < 50 ? -0.8 : 0.8)} 88.6`, 0.5);
  },
};

// ───────────────────────── hound blowing a horn ─────────────────────────
const hound_horn: DoodleDef = {
  w: 100, h: 100,
  draw(p, d) {
    const coat = pick(d, [C.white, tint(C.ochre, 0.4), C.flesh]);
    const patch = pick(d, [C.brown, C.ink2, C.ochre]);
    const collar = pick(d, [C.rubric, C.lapis, C.verd]);
    const banner = chance(d, 0.5), notes = chance(d, 0.4);
    ground(p, d, 6, 96, 88);
    tuft(p, 10, 88, 0.9);
    p.s('M24 66C16 62 12 54 13 46C13.4 43 15 42 16 43.6', 0.85);
    const body = 'M40 42C32 46 26 54 23 64C21 72 22 82 27 87.6L58 87.6C56 80 55 70 55 62C55 54 52 46 48 42Z';
    p.wash(body, coat, coat === C.white ? 0.8 : 0.5, 0.4);
    p.wash('M30 52C36 47.6 44 49.6 46 56C44 62.4 36 64 30 60Z', patch, 0.45);
    p.s('M40 42C32 46 26 54 23 64C21 72 22 82 27 87.6', 1);
    p.s('M48 42C52 46 55 54 55 62C55 70 56 80 58 87.6', 0.85);
    p.s('M28 76C30 68 38 64 44 68C49 72 48 82 44 87.6L33 87.6', 0.75);
    p.s('M55.4 87.6L60.6 87.6', 0.7);
    // head and the ear that will not stay down
    const head = 'M42 34C40 26 44 20 50 20C54 20 57 22 59 25L67 27C69 28 69.4 31 67 32.4C63 34.4 57.6 36 53.6 37.6C49.6 39.6 44.6 38.4 42 34Z';
    p.wash(head, coat, coat === C.white ? 0.8 : 0.5);
    p.s(head);
    const earA = -14 + d() * 22;
    p.around(48, 24, { r: earA }, () => {
      const ear = 'M47 23C41 24 37 30 37 38C37 44 41 46 43 42C44 36 47 30 49 26Z';
      p.wash(ear, patch, 0.6); p.s(ear, 0.8);
    });
    p.s('M51.4 25.2C52.6 24.2 54.2 24.4 55 25.4', 0.6); p.s('M52 23.2L55.4 22.6', 0.4);
    p.s('M56 26.6L57.4 27.6', 0.3);
    p.arc(61.4, 31.4, 3.2, 200, 330, 0.5);
    p.dot(67.6, 28.6, 1.25);
    p.dual('M40.6 41.4C43.6 43.6 47 43.8 49.8 42.4', 2.8, collar, 0.6);
    p.o(45.4, 45.6, 1.4, 0.45);
    // the horn, a hunting horn, blown with conviction
    p.layer();
    const hp: P[] = [[66.6, 30.4], [74, 30.4], [81.4, 26.6], [86.6, 19.8], [89.2, 13]];
    const rb = ribbon(p, hp, t => 2.2 + 6 * t * t, tint(C.gold, 0.15), tint(C.gold, 0.15), { op: 0.85, wm: 0.75, ends: false });
    const n = rb.mid.length, e0 = rb.left[n - 1]!, e1 = rb.right[n - 1]!;
    const mx = (e0[0] + e1[0]) / 2, my = (e0[1] + e1[1]) / 2, ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]) * 180 / Math.PI;
    p.shapeE(mx, my, Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) / 2 + 0.6, 1.9, ang, tint(C.goldD, 0.3), 0.7, 0.9);
    for (const f of [0.32, 0.66]) { const i = Math.floor(n * f); p.ink(C.goldD, () => p.line([rb.left[i]!, rb.right[i]!], 0.9, 0.9, 0.9)); }
    p.e(66.4, 30.4, 1, 1.6, 0, 0.5);
    if (banner) {
      const i = Math.floor(n * 0.45), a = rb.right[i]!;
      p.shape(`M${a[0]} ${a[1]}L${a[0] + 9} ${a[1] - 2}L${a[0] + 9.6} ${a[1] + 8}L${a[0] + 4.6} ${a[1] + 6}L${a[0] + 0.6} ${a[1] + 9}Z`, collar, 0.6, 0.85);
      p.dot(a[0] + 5, a[1] + 3, 1.1, C.gold);
    }
    burst(p, mx, my, -80, 10, 4, 5, 10, 0.42);
    if (notes) { note(p, 93, 30, 0.8); note(p, 78, 10, 0.75, false); }
    // the raised forepaw keeping it steady
    p.layer();
    p.s('M50 50C58 46 66 40 72 34.2', 0.8); p.s('M54 55C61 51 68 45 74.4 37.4', 0.8);
    p.washE(74.4, 34.8, 2.8, 2.4, -30, coat, 0.85); p.e(74.4, 34.8, 2.8, 2.4, -30, 0.6);
  },
};

// ───────────────────────── vine ─────────────────────────
const vineDoodle: DoodleDef = {
  w: 60, h: 140,
  draw(p, d) {
    const ph = d() * Math.PI * 2, amp = 7 + d() * 4, turns = 1.9 + d() * 0.8;
    const cols = [C.verd, C.verd, C.green, pick(d, [C.lapis, C.rubric])];
    vine(p, d, { at: t => [30 + Math.sin(t * Math.PI * turns + ph) * amp, 136 - t * 126], len: 140, leafEvery: 13, leafSize: 11, colors: cols, bezants: true, flower: pick(d, [C.rubric, C.lapis, C.rubric]), stemW: 1 });
    tendril(p, 30 + Math.sin(ph) * amp, 136, -150, 9, -1.4, 0.4);
    bezant(p, 30 + Math.sin(Math.PI * turns * 0.5 + ph) * amp + (d() < 0.5 ? -9 : 9), 72, 1.8);
  },
};

export const DOODLES: Record<CreatureKind, DoodleDef> = {
  snail_knight, rabbit_joust, goose_bishop, cat_lute, fox_scribe, griffin, goblin_scroll, dragon_small, mouse_coin, owl_ledger, hound_horn, vine: vineDoodle,
};

export const CREATURES: CreatureKind[] = ['snail_knight', 'rabbit_joust', 'goose_bishop', 'cat_lute', 'fox_scribe', 'griffin', 'goblin_scroll', 'dragon_small', 'mouse_coin', 'owl_ledger', 'hound_horn'];
