/**
 * OWNER: ui-portraits agent. Dev gallery for the faces: each species across
 * many seeds, a hat for every trade, the household, the ruler by rank, the
 * fifteen visitors to court, one face in all nine moods, and the same face
 * at 40, 96 and 360px. Everything on the page is alive (blinking, glancing).
 *
 *   node tools/shot.mjs src/dev/gallery-portraits.ts .tmp/ui-portraits-g.png --w 1500 --h 1300 \
 *        --eval "__gallery.show('species')"          (species | trades | court | moods | sizes | all)
 *   ... --eval "__gallery.show('moods'); __gallery.talk(true)" --shots 4 --every 170
 *
 * Not shipped.
 */
import { BASE_CSS } from '../ui/css/base';
import { SPECIES, TRADES, NPCS, type Species, type TradeId } from '../data/ids';
import type { Mood } from '../word/api';
import { createPortrait, PORTRAIT_MOODS, type Portrait, type PortraitSpec } from '../ui/portraits';

const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&display=swap';
document.head.appendChild(fonts);

const css = document.createElement('style');
css.textContent = BASE_CSS + `
#gal{position:fixed;inset:0;overflow:auto;background:radial-gradient(120% 80% at 50% 0%,#2a1c12,#0e0a08 70%);padding:22px 14px 60px}
.gp-page{max-width:1460px;margin:0 auto;padding:20px 26px 34px}
.gp-page h1{font-family:var(--f-black);font-weight:400;font-size:42px;color:var(--rubric);margin:0;line-height:1}
.gp-page h2{font-family:var(--f-head);font-weight:400;font-size:21px;letter-spacing:.06em;color:var(--rubric);margin:22px 0 10px;border-bottom:1px solid var(--parch-edge);padding-bottom:4px}
.gp-intro{color:var(--ink-2);font-style:italic;margin:6px 0 0}
.gp-grid{display:grid;gap:12px 8px;justify-items:center}
.gp-cell{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.gp-cap{font-family:var(--f-head);font-size:12px;letter-spacing:.05em;color:var(--ink-2);text-align:center;line-height:1.15;max-width:150px}
.gp-rowhead{font-family:var(--f-head);font-size:15px;letter-spacing:.08em;color:var(--ink);align-self:center;justify-self:end;padding-right:6px}
.gp-sizes{display:flex;align-items:flex-end;gap:34px;flex-wrap:wrap}
.gp-list{display:flex;flex-direction:column;gap:2px;width:330px}
.gp-li{display:flex;align-items:center;gap:10px;padding:4px 8px;border-bottom:1px dotted rgba(138,116,90,.5)}
.gp-li b{font-family:var(--f-head);font-weight:400;letter-spacing:.04em;color:var(--ink);font-size:15px}
.gp-li span{color:var(--ink-2);font-size:13px;font-style:italic}
.gp-li .ll-num{margin-left:auto;font-style:normal;color:var(--ink)}
.gp-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.gp-tools button{font-family:var(--f-head);letter-spacing:.06em;font-size:14px;padding:4px 12px;background:var(--parch-2);border:1px solid var(--parch-edge);border-radius:3px;color:var(--ink);cursor:pointer}
.gp-tools button[aria-pressed="true"]{background:var(--rubric);color:var(--parch);border-color:var(--rubric-2)}
.gp-hide{display:none}
`;
document.head.appendChild(css);

const app = document.getElementById('app') as HTMLElement;
const canvas = document.getElementById('c');
if (canvas) canvas.style.display = 'none';
const gal = document.createElement('div');
gal.id = 'gal';
app.appendChild(gal);
const page = document.createElement('div');
page.className = 'll-parch gp-page';
gal.appendChild(page);

const all: Portrait[] = [];
const talkers: Portrait[] = [];
let talkButton: HTMLButtonElement | null = null;
let following = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function face(spec: PortraitSpec, caption?: string, mood?: Mood): { cell: HTMLElement; p: Portrait } {
  const p = createPortrait(spec);
  if (mood) p.setMood(mood);
  all.push(p);
  const cell = el('div', 'gp-cell');
  cell.appendChild(p.el);
  if (caption) cell.appendChild(el('div', 'gp-cap', caption));
  return { cell, p };
}
const nice = (s: string): string => s.replace(/_/g, ' ');
const sections = new Map<string, HTMLElement>();
function section(id: string, title: string, intro?: string): HTMLElement {
  const sec = el('section');
  sec.appendChild(el('h2', undefined, title));
  if (intro) sec.appendChild(el('p', 'gp-intro', intro));
  page.appendChild(sec);
  sections.set(id, sec);
  return sec;
}
function grid(cols: string): HTMLElement {
  const g = el('div', 'gp-grid');
  g.style.gridTemplateColumns = cols;
  return g;
}

page.appendChild(el('h1', undefined, 'A Gallery of Faces'));
page.appendChild(el('p', 'gp-intro', 'Every tenant, delegate and visitor to court, drawn by the same hand. No two alike; all of them watching.'));

// ───────────── each species, many seeds ─────────────
{
  const sec = section('species', 'The six peoples', 'Ten of each, taken as they came through the gate.');
  const g = grid('92px repeat(10, 1fr)');
  SPECIES.forEach((sp, si) => {
    g.appendChild(el('div', 'gp-rowhead', sp));
    for (let i = 0; i < 10; i++) g.appendChild(face({ species: sp, seed: 1009 + i * 7919 + si * 104729, size: 124, frame: true }).cell);
  });
  sec.appendChild(g);
}

// ───────────── trades, household, ruler ─────────────
{
  const sec = section('trades', 'By their hats', 'One sign for each of the twenty-eight trades, on a human and on whoever else was in the shop.');
  const others: Species[] = ['halfling', 'dwarf', 'goblin', 'elf', 'ogre', 'human'];
  const g = grid('repeat(14, 1fr)');
  TRADES.forEach((t: TradeId, i) => {
    g.appendChild(face({ species: 'human', seed: 300 + i * 131, trade: t, size: 96, frame: true }, nice(t)).cell);
    const sp = others[(i * 5 + 1) % others.length];
    g.appendChild(face({ species: sp, seed: 9000 + i * 977, trade: t, size: 96, frame: true }, sp + ' ' + nice(t)).cell);
  });
  sec.appendChild(g);

  const sec2 = section('trades2', 'The household, and yourself by rank');
  const g2 = grid('repeat(13, 1fr)');
  const roles = ['mason', 'bailiff', 'crier', 'steward'] as const;
  const roleSp: Species[] = ['human', 'dwarf', 'human', 'halfling', 'goblin', 'human', 'elf', 'human'];
  roles.forEach((role, i) => {
    g2.appendChild(face({ species: roleSp[i * 2], seed: 4242 + i * 613, role, size: 104, frame: true }, role).cell);
    g2.appendChild(face({ species: roleSp[i * 2 + 1], seed: 7001 + i * 389, role, size: 104, frame: true }, roleSp[i * 2 + 1] + ' ' + role).cell);
  });
  (['reeve', 'knight', 'baron', 'duke', 'king'] as const).forEach(rank => {
    g2.appendChild(face({ species: 'human', seed: 1234, role: 'ruler', rank, size: 104, frame: true }, rank).cell);
  });
  sec2.appendChild(g2);
  sections.set('trades', wrap(sec, sec2));
}

// ───────────── the court's visitors ─────────────
{
  const sec = section('court', 'Visitors to court', 'Fixed and memorable. The adjuster is in fact a small dragon.');
  const g = grid('repeat(8, 1fr)');
  NPCS.forEach(id => {
    g.appendChild(face({ species: id === 'goblin_chief' ? 'goblin' : 'human', seed: 77, npc: id, size: 168, frame: true }, nice(id)).cell);
  });
  g.appendChild(face({ species: 'human', seed: 31337, npc: 'rival_lord', size: 168, frame: true }, 'rival lord, another reign').cell);
  sec.appendChild(g);
}

// ───────────── one face, nine moods ─────────────
const moodFaces: { p: Portrait; mood: Mood }[] = [];
{
  const sec = section('moods', 'Nine moods', 'Each must read at a glance, on any face.');
  const who: [string, PortraitSpec][] = [
    ['a baker', { species: 'human', seed: 300 + 4 * 131, trade: 'baker', size: 132, frame: true }],
    ['a halfling', { species: 'halfling', seed: 1009 + 4 * 7919 + 104729, size: 132, frame: true }],
    ['a dwarf', { species: 'dwarf', seed: 1009 + 0 * 7919 + 2 * 104729, size: 132, frame: true }],
    ['the chief', { species: 'goblin', seed: 77, npc: 'goblin_chief', size: 132, frame: true }],
    ['an elf', { species: 'elf', seed: 1009 + 5 * 7919 + 4 * 104729, size: 132, frame: true }],
    ['an ogre', { species: 'ogre', seed: 1009 + 7 * 7919 + 5 * 104729, size: 132, frame: true }],
    ['the adjuster', { species: 'human', seed: 77, npc: 'dragon_adjuster', size: 132, frame: true }],
  ];
  const g = grid('92px repeat(9, 1fr)');
  g.appendChild(el('div'));
  for (const m of PORTRAIT_MOODS) g.appendChild(el('div', 'gp-rowhead', m)).setAttribute('style', 'justify-self:center;padding:0');
  for (const [name, spec] of who) {
    g.appendChild(el('div', 'gp-rowhead', name));
    for (const m of PORTRAIT_MOODS) {
      const f = face(spec, undefined, m);
      g.appendChild(f.cell);
      moodFaces.push({ p: f.p, mood: m });
      talkers.push(f.p);
    }
  }
  sec.appendChild(g);
}

// ───────────── sizes ─────────────
let big: Portrait | null = null;
{
  const sec = section('sizes', 'At 40, 96 and 360', 'The same faces as a list entry, a card, and an audience.');
  const row = el('div', 'gp-sizes');
  const specs: PortraitSpec[] = [
    { species: 'human', seed: 77, npc: 'your_mother', size: 40, frame: true },
    { species: 'goblin', seed: 9000 + 5 * 977, trade: 'tax_clerk', size: 40, frame: true },
  ];
  for (const base of specs) {
    for (const size of [40, 96, 360]) {
      const f = face({ ...base, size }, size + 'px');
      row.appendChild(f.cell);
      talkers.push(f.p);
      if (size === 360 && !big) big = f.p;
    }
  }
  sec.appendChild(row);

  sec.appendChild(el('h2', undefined, 'As they sit in a ledger'));
  const cols = el('div', 'gp-sizes');
  cols.style.alignItems = 'flex-start';
  const names = ['Wat Thatcher', 'Lobelia Underbough', 'Borin Deepdelve', 'Snik', 'Aelindra', 'Grub', 'Agnes Miller', 'Pim Butterbur', 'Dain Ironfoot', 'Quill', 'Old Tom', 'Hilda Brewer', 'Ffion', 'Osric the Smith', 'Mabel Candlewick'];
  const sps: Species[] = ['human', 'halfling', 'dwarf', 'goblin', 'elf', 'ogre', 'human', 'halfling', 'dwarf', 'goblin', 'human', 'human', 'elf', 'human', 'halfling'];
  const tr: TradeId[] = ['farmer', 'baker', 'blacksmith', 'scribe', 'herbalist', 'laborer', 'miller', 'innkeeper', 'guard', 'tax_clerk', 'gravedigger', 'brewer', 'wizard', 'blacksmith', 'candlemaker'];
  for (let c = 0; c < 3; c++) {
    const list = el('div', 'gp-list');
    for (let i = c * 5; i < c * 5 + 5; i++) {
      const li = el('div', 'gp-li');
      const p = createPortrait({ species: sps[i], seed: 811 + i * 2713, trade: tr[i], size: 40, frame: true });
      all.push(p);
      if (i % 4 === 1) p.setMood('worried');
      if (i % 5 === 2) p.setMood('pleased');
      if (i % 7 === 3) p.setMood('angry');
      li.appendChild(p.el);
      const txt = el('div');
      txt.appendChild(el('b', undefined, names[i]));
      txt.appendChild(el('br'));
      txt.appendChild(el('span', undefined, nice(tr[i])));
      li.appendChild(txt);
      li.appendChild(el('span', 'll-num', String(12 + ((i * 7) % 23)) + ' cr'));
      list.appendChild(li);
    }
    cols.appendChild(list);
  }
  sec.appendChild(cols);

  // things to press when looking at this page by hand
  const tools = el('div', 'gp-tools');
  const bTalk = el('button', undefined, 'Everyone talks');
  bTalk.type = 'button';
  bTalk.setAttribute('aria-pressed', 'false');
  bTalk.onclick = () => api.talk(bTalk.getAttribute('aria-pressed') !== 'true');
  tools.appendChild(bTalk);
  for (const m of PORTRAIT_MOODS) {
    const b = el('button', undefined, m);
    b.type = 'button';
    b.onclick = () => api.mood(m);
    tools.appendChild(b);
  }
  const bFollow = el('button', undefined, 'Eyes follow the pointer');
  bFollow.type = 'button';
  bFollow.setAttribute('aria-pressed', 'false');
  bFollow.onclick = () => { const on = bFollow.getAttribute('aria-pressed') !== 'true'; bFollow.setAttribute('aria-pressed', String(on)); following = on; if (!on) for (const p of all) p.lookAt(null); };
  tools.appendChild(bFollow);
  sec.appendChild(tools);
  talkButton = bTalk;
}

window.addEventListener('pointermove', ev => {
  if (!following) return;
  for (const p of all) {
    const r = p.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    // a point far outside the box simply pins the eyes to that side
    p.lookAt((ev.clientX - r.left) / r.width / 6 + 0.5 - 1 / 12, (ev.clientY - r.top) / r.height / 6 + 0.42 - 0.07);
  }
});

function wrap(...secs: HTMLElement[]): HTMLElement {
  const w = el('div');
  secs[0].parentElement?.insertBefore(w, secs[0]);
  for (const s of secs) w.appendChild(s);
  return w;
}

const api = {
  /** show one section (or 'all') */
  show(id: string): string {
    for (const [k, sec] of sections) {
      if (k === 'trades2') continue;
      sec.classList.toggle('gp-hide', id !== 'all' && k !== id);
    }
    gal.scrollTop = 0;
    return id;
  },
  /** everyone in the moods and sizes sections talks (or stops) */
  talk(on: boolean): void {
    for (const p of talkers) p.setTalking(on);
    talkButton?.setAttribute('aria-pressed', String(on));
  },
  /** put every face on the page in one mood; pass nothing to restore the moods grid */
  mood(m?: Mood): void {
    if (m) for (const p of all) p.setMood(m);
    else for (const f of moodFaces) f.p.setMood(f.mood);
  },
  look(x: number | null, y?: number): void { for (const p of all) p.lookAt(x, y); },
  dispose(): void { for (const p of all) p.dispose(); },
  count: all.length,
  big,
};
(window as unknown as { __gallery: typeof api }).__gallery = api;
