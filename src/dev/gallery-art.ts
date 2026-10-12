/**
 * OWNER: ui-art agent. Dev gallery for the scriptorium: every icon at 16, 24
 * and 40px, every seal, each doodle at three seeds, the alphabet of drop caps,
 * flourishes, a dozen crests and a sample illuminated panel.
 *   node tools/shot.mjs src/dev/gallery-art.ts .tmp/ui-art-gallery.png --h 1400
 * Not shipped.
 */
import { BASE_CSS } from '../ui/css/base';
import { ICONS, type IconId } from '../data/ids';
import { iconSvg, sealSvg } from '../ui/icons';
import { doodle, dropCap, flourish, crest, MARGINALIA_CSS, type DoodleKind } from '../ui/marginalia';

const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = 'https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&display=swap';
document.head.appendChild(fonts);

const css = document.createElement('style');
css.textContent = BASE_CSS + MARGINALIA_CSS + `
#gal{position:fixed;inset:0;overflow:auto;background:radial-gradient(120% 80% at 50% 0%,#2a1c12,#0e0a08 70%);padding:28px 16px 60px}
.ga-page{max-width:1240px;margin:0 auto;padding:26px 30px 40px}
.ga-page h1{font-family:var(--f-black);font-weight:400;font-size:46px;color:var(--rubric);margin:0;line-height:1}
.ga-page h2{font-family:var(--f-head);font-weight:400;font-size:22px;letter-spacing:.06em;color:var(--rubric);margin:26px 0 10px;border-bottom:1px solid var(--parch-edge);padding-bottom:4px}
.ga-intro{color:var(--ink-2);font-style:italic;margin:6px 0 0}
.ga-icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px 8px;color:var(--ink)}
.ga-cell{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px 4px;border:1px dotted rgba(138,116,90,.45);border-radius:3px}
.ga-sizes{display:flex;align-items:flex-end;gap:9px;height:42px}
.ga-id{font-family:var(--f-head);font-size:12px;letter-spacing:.06em;color:var(--ink-2)}
.ga-dark{display:flex;flex-wrap:wrap;gap:10px 14px;padding:10px 14px;margin-top:10px;background:#1d140e;border-radius:3px;color:var(--parch)}
.ga-dark .ga-g{color:var(--gold-2)} .ga-dark .ga-r{color:#d0574c}
.ga-seals{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;justify-items:center}
.ga-row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:12px}
.ga-doodles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 14px}
.ga-dk{display:flex;flex-direction:column;align-items:center;border:1px dotted rgba(138,116,90,.45);border-radius:3px;padding:4px 2px}
.ga-dk>div{display:flex;gap:2px}
.ga-caps{display:grid;grid-template-columns:repeat(13,1fr);gap:8px;justify-items:center}
.ga-flo{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;align-items:center}
.ga-crests{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;justify-items:center}
.ga-sample{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap;margin-top:8px}
.ga-panel{width:420px}
.ga-panel p{margin:0 0 6px}
.ga-vinecol{width:300px;padding-top:6px;padding-bottom:6px;min-height:260px}
`;
document.head.appendChild(css);

const el = (tag: string, cls: string, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const app = document.getElementById('app')!;
app.innerHTML = '';
const gal = el('div', ''); gal.id = 'gal'; app.appendChild(gal);
const page = el('div', 'll-parch ga-page'); gal.appendChild(page);
page.appendChild(el('h1', '', 'The Scriptorium'));
page.appendChild(el('p', 'ga-intro', 'Every mark the clerks may use, drawn by one hand on a good day.'));

const section = (id: string, title: string) => { const h = el('h2', '', title); h.id = id; page.appendChild(h); };

// ── icons
section('sec-icons', `Icons (${ICONS.length}) at 16, 24 and 40 pixels`);
const grid = el('div', 'ga-icons');
for (const id of ICONS) {
  grid.appendChild(el('div', 'ga-cell', `<div class="ga-sizes">${iconSvg(id, { size: 16 })}${iconSvg(id, { size: 24 })}${iconSvg(id, { size: 40, title: id })}</div><div class="ga-id">${id}</div>`));
}
page.appendChild(grid);
const dark = el('div', 'ga-dark');
const darkIds: IconId[] = ['coin', 'crown', 'bell', 'hammer', 'house', 'scroll', 'heart', 'warning', 'flame', 'drop', 'pause', 'play', 'fast', 'faster', 'mic', 'send', 'gear', 'close', 'check', 'ledger', 'people', 'map'];
darkIds.forEach((id, i) => dark.appendChild(el('span', i % 3 === 1 ? 'ga-g' : i % 3 === 2 ? 'ga-r' : '', iconSvg(id, { size: i % 2 ? 24 : 18 }))));
page.appendChild(dark);

// ── seals
section('sec-seals', 'Seals');
const seals = el('div', 'ga-seals');
for (const id of ICONS) seals.appendChild(el('span', '', sealSvg(id, 'var(--rubric)', 34)));
page.appendChild(seals);
const row = el('div', 'ga-row');
const colors = ['var(--rubric)', 'var(--gold)', 'var(--lapis)', 'var(--verdigris)', '#2a1d14', 'var(--parch-3)'];
const sealIds: IconId[] = ['coin', 'hammer', 'scroll', 'bell', 'key', 'house', 'crown', 'warning'];
sealIds.forEach((id, i) => row.appendChild(el('span', '', sealSvg(id, colors[i % colors.length]!, 52))));
page.appendChild(row);

// ── doodles
section('sec-doodles', 'Marginalia');
const kinds: DoodleKind[] = ['snail_knight', 'rabbit_joust', 'goose_bishop', 'cat_lute', 'fox_scribe', 'griffin', 'goblin_scroll', 'dragon_small', 'mouse_coin', 'owl_ledger', 'hound_horn', 'vine'];
const dg = el('div', 'ga-doodles');
for (const k of kinds) dg.appendChild(el('div', 'ga-dk', `<div>${[1, 2, 3].map(s => doodle(k, s, 96)).join('')}</div><div class="ga-id">${k}</div>`));
page.appendChild(dg);

// ── drop caps
section('sec-caps', 'Initials');
const caps = el('div', 'ga-caps');
for (let c = 65; c <= 90; c++) caps.appendChild(el('span', '', dropCap(String.fromCharCode(c), 72)));
page.appendChild(caps);

// ── flourishes
section('sec-flo', 'Flourishes');
const flo = el('div', 'ga-flo');
for (let s = 0; s < 8; s++) flo.appendChild(el('div', '', flourish(520, s)));
page.appendChild(flo);

// ── crests
section('sec-crests', 'Arms');
const cr = el('div', 'ga-crests');
for (let s = 1; s <= 12; s++) cr.appendChild(el('span', '', crest(s * 7919 + 13, 104)));
page.appendChild(cr);

// ── sample panel
section('sec-panel', 'An illuminated panel');
const sample = el('div', 'ga-sample');
sample.appendChild(el('div', 'll-panel ll-illum ga-panel', `
  <div class="ll-panel-head"><h2 class="ll-title">The Ledger of Oaths</h2><button class="ll-seal" aria-label="Close">✕</button></div>
  <div class="ll-panel-body">
    <p class="ll-body">${dropCap('T', 58).replace('<svg', '<svg style="float:left;margin:2px 10px 0 0"')}he Reeve swore before witnesses to mend the miller's roof before the rains. The rains have been informed. The miller has also been informed, twice, in writing.</p>
    ${flourish(360, 3)}
    <div class="ll-row"><span class="ll-tag ll-tag-gold">kept</span><span class="ll-note">Two oaths kept, none broken. The pigeons remain unconvinced.</span>${doodle('snail_knight', 4, 64)}</div>
  </div>`));
sample.appendChild(el('div', 'll-parch ll-vine-r ga-vinecol', `<p class="ll-body" style="margin:0 0 8px 12px">The same vine on the other margin, for a scribe who writes the other way round.</p>${doodle('any', 17, 120)}`));
sample.appendChild(el('div', 'll-parch ll-vine-l ga-vinecol', `<p class="ll-body" style="margin:0 12px 8px 0">A vine runs down the margin of this page, as vines do when the scribe has run out of things to say about rent.</p><p class="ll-note" style="margin:0 12px 0 0">Tenants: four. Griffins: one, unauthorized.</p>${crest(4242, 72)}`));
const narrow = el('div', 'll-panel ll-illum', `<div class="ll-panel-body"><p class="ll-body" style="margin:0">A small illuminated note.</p></div>`);
narrow.style.width = '200px';
sample.appendChild(narrow);
page.appendChild(sample);

// ── a dark strip: the same art on the table's dark wood, as the HUD shows it
section('sec-dark', 'On the dark of the table');
const darkRow = el('div', 'ga-dark');
darkRow.style.alignItems = 'center';
darkRow.innerHTML = [crest(77, 48), crest(1234, 48), sealSvg('bell', 'var(--gold)', 40), sealSvg('scroll', 'var(--rubric)', 40), dropCap('L', 48), doodle('any', 5, 64), flourish(200, 1)].join('');
page.appendChild(darkRow);

const w = window as unknown as { __gal?: (id: string) => void; __zoom?: () => void; __detail?: (what: string, from?: number, count?: number, px?: number) => void };
w.__gal = (id: string) => { const t = document.getElementById(id); if (t) gal.scrollTop = t.offsetTop - 8; };
/** Everything at close-up sizes on one long page, for a single tall screenshot to be cropped. */
w.__zoom = () => {
  page.innerHTML = '';
  const block = (title: string, px: number, cells: [string, string][]) => {
    page.appendChild(el('h2', '', title));
    const g = el('div', '');
    g.style.cssText = `display:grid;grid-template-columns:repeat(auto-fill,minmax(${px + 14}px,1fr));gap:6px;color:var(--ink);align-items:end`;
    for (const [svg, label] of cells) g.appendChild(el('div', 'ga-cell', `${svg}<div class="ga-id">${label}</div>`));
    page.appendChild(g);
  };
  block('Icons at 64', 64, ICONS.map(id => [iconSvg(id, { size: 64 }), id]));
  block('Seals at 56', 56, ICONS.map((id, i) => [sealSvg(id, colors[i % colors.length]!, 56), id]));
  block('Marginalia at 180', 180, kinds.flatMap(k => [4, 9].map(sd => [doodle(k, sd, 180), `${k} ${sd}`] as [string, string])));
  block('Initials at 110', 110, Array.from({ length: 26 }, (_, i) => [dropCap(String.fromCharCode(65 + i), 110), String.fromCharCode(65 + i)]));
  block('Arms at 130', 130, Array.from({ length: 16 }, (_, i) => [crest(i * 7919 + 13, 130), String(i + 1)]));
  page.appendChild(el('h2', '', 'Flourishes at full width'));
  for (let sd = 0; sd < 5; sd++) page.appendChild(el('div', '', flourish(1100, sd)));
  gal.scrollTop = 0;
};
/** Close-up views for inspection: icons / seals / doodles / caps / crests at a large size. */
w.__detail = (what: string, from = 0, count = 999, px = 80) => {
  page.innerHTML = '';
  const g = el('div', '');
  g.style.cssText = `display:grid;grid-template-columns:repeat(auto-fill,minmax(${px + 16}px,1fr));gap:8px;color:var(--ink)`;
  const cell = (svg: string, label: string) => g.appendChild(el('div', 'ga-cell', `${svg}<div class="ga-id">${label}</div>`));
  if (what === 'icons') ICONS.slice(from, from + count).forEach(id => cell(iconSvg(id, { size: px }), id));
  if (what === 'seals') ICONS.slice(from, from + count).forEach((id, i) => cell(sealSvg(id, colors[i % colors.length]!, px), id));
  if (what === 'doodles') kinds.slice(from, from + count).forEach(k => [1, 2, 3].forEach(s => cell(doodle(k, s, px), `${k} ${s}`)));
  if (what === 'caps') for (let c = 65 + from; c <= Math.min(90, 65 + from + count - 1); c++) cell(dropCap(String.fromCharCode(c), px), String.fromCharCode(c));
  if (what === 'crests') for (let s = 1 + from; s <= from + count && s <= 24; s++) cell(crest(s * 7919 + 13, px), String(s));
  page.appendChild(g);
  gal.scrollTop = 0;
};
