/**
 * Does the rendered Book actually work? — a guard, not a report.
 *
 *   node tools/vault/html-check.mjs [--render renders/BOOK.html]
 *
 * The failure this exists to kill: a render that LOOKS fine. A page that
 * loads a script from a CDN looks fine on a connected machine and publishes
 * as an empty shell everywhere else. A page whose markdown collapsed in the
 * parser looks fine from the front page. A wikilink that stopped resolving
 * looks exactly like a wikilink. A search with a broken index looks like a
 * search box. None of these announce themselves — so this check opens the
 * real file in a real browser and makes each one announce itself.
 *
 * What FAILS the check:
 *   - any JavaScript exception, or any console error (CSP violations land
 *     here too — the page ships its own strict CSP);
 *   - any network request the page makes to anything but itself. file:,
 *     data: and about: are the page's own substance; everything else is
 *     the empty-shell failure in the making;
 *   - any RESOURCE reference to an external host — script src, stylesheet,
 *     image, iframe, media, CSS url() — even one the browser never fired;
 *   - a page whose rendered body collapsed to a fraction of its text, or
 *     leaked raw fence markers, or lost its template entirely;
 *   - a wikilink marked dead whose target actually exists (resolution
 *     regressed), or a live wikilink pointing at no page;
 *   - a search that returns nothing for terms provably present in pages;
 *   - a deep link (#page-id opened cold) that does not land on its page;
 *   - a backlink road that vanished, a theme toggle that throws.
 *
 * Honest limit: plain <a href="https://…"> links in prose do NOT fail the
 * check — following one is a reader's choice, not a page load, and the
 * sources legitimately cite outside documents. They are counted and shown,
 * so an eye can still catch one that shouldn't be there.
 *
 * Exit 0 = the Book works. 1 = it does not, and the reasons are printed.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// ── arguments ─────────────────────────────────────────────────────────
let renderPath = 'renders/BOOK.html';
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--render') renderPath = argv[++i] ?? renderPath;
  }
}
const target = resolve(ROOT, renderPath);
if (!existsSync(target)) {
  console.error(`FAIL  nothing to check at ${renderPath} — render the Book first:`);
  console.error('      node tools/vault/html.mjs');
  process.exit(1);
}

// ── find the chromium this environment carries ────────────────────────
function findChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const dir of readdirSync(base).sort().reverse()) {
      for (const tail of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome']) {
        const p = resolve(base, dir, tail);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

// the same normal form the renderer folds names to — kept in step by hand;
// if the two ever drift, dead-link verdicts here go wrong, so change both
const norm = (s) =>
  String(s).toLowerCase().normalize('NFKD')
    .replace(/[^\p{L}\p{N}:]+/gu, '-')
    .replace(/^-+|-+$/g, '');

// ── read the render and its embedded data, before any browser ─────────
const html = readFileSync(target, 'utf8');
const dataMatch = html.match(/<script type="application\/json" id="book-data">([\s\S]*?)<\/script>/);
if (!dataMatch) {
  console.error('FAIL  the render carries no embedded book-data — it is not a Book this check knows.');
  process.exit(1);
}
const data = JSON.parse(dataMatch[1]);
const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ok    ${msg}`);

const exe = findChromium();
if (!exe) {
  console.error('FAIL  no chromium found under /opt/pw-browsers (set CHROMIUM_PATH to point at one).');
  console.error('      This check only means anything in a real browser; there is no static fallback.');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: exe, headless: true });
try {
  const page = await browser.newPage();

  // every exception and console error is a verdict, not a log line
  page.on('pageerror', (e) => fail(`JS exception: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') fail(`console error: ${m.text()}`); });

  // any request beyond the file itself is the empty-shell failure
  const outward = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(file:|data:|about:|chrome-error:)/.test(u)) outward.push(u);
  });

  await page.goto(pathToFileURL(target).href);
  await page.waitForFunction(() => window.__BOOK_READY__ === true, null, { timeout: 15000 })
    .catch(() => fail('the client never reported ready — initialisation died or hung'));
  ok(`opened in chromium (${data.pages.length} pages declared)`);

  // ── external references, requested or merely written ────────────────
  if (outward.length) fail(`the page REQUESTED ${outward.length} external URL(s): ${outward.slice(0, 3).join(', ')}`);
  const refScan = await page.evaluate(() => {
    const bad = [];
    const anchors = [];
    const externalish = (v) => /^(https?:)?\/\//i.test(v || '');
    const scan = (rootNode) => {
      for (const el of rootNode.querySelectorAll('script[src], link[href], img[src], iframe[src], object[data], embed[src], source[src], video[src], audio[src], [srcset]')) {
        const v = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('data') || el.getAttribute('srcset') || '';
        if (externalish(v)) bad.push(`<${el.tagName.toLowerCase()}> → ${v.slice(0, 90)}`);
      }
      for (const a of rootNode.querySelectorAll('a[href]')) {
        if (externalish(a.getAttribute('href'))) anchors.push(a.getAttribute('href'));
      }
      for (const t of rootNode.querySelectorAll('template')) scan(t.content);
    };
    scan(document);
    if (document.querySelector('base[href]')) bad.push('<base> tag present');
    if (document.querySelector('meta[http-equiv="refresh"]')) bad.push('<meta refresh> present');
    for (const s of document.querySelectorAll('style')) {
      if (/url\(\s*['"]?https?:/i.test(s.textContent)) bad.push('external url() inside a <style>');
    }
    return { bad, anchorCount: anchors.length, anchorSample: anchors.slice(0, 5) };
  });
  for (const b of refScan.bad) fail(`external resource reference: ${b}`);
  if (!refScan.bad.length && !outward.length) ok('self-contained — zero external requests, zero external resource references');
  if (refScan.anchorCount) notes.push(`${refScan.anchorCount} outward <a> link(s) in prose (allowed, never loaded): ${refScan.anchorSample.join(', ')}`);

  // ── every declared page has a body that survived the parser ─────────
  const collapse = await page.evaluate((pages) => {
    const out = [];
    const tpl = new Map();
    document.querySelectorAll('template[data-page]').forEach((t) => tpl.set(t.dataset.page, t));
    pages.forEach((p, i) => {
      const t = tpl.get(p.id);
      if (!t) { out.push({ id: p.id, why: 'template missing' }); return; }
      const textLen = t.content.textContent.length;
      const elCount = t.content.childElementCount;
      out.push({ id: p.id, textLen, elCount, fence: /```/.test(t.content.textContent) });
    });
    return out;
  }, data.pages);
  let collapsed = 0;
  collapse.forEach((c, i) => {
    const corpusLen = (data.corpus[i] || '').length;
    if (c.why) { fail(`page "${c.id}": ${c.why}`); collapsed++; return; }
    if (c.fence) { fail(`page "${c.id}": raw \`\`\` fence leaked into the rendered body`); collapsed++; }
    if (corpusLen > 200 && c.textLen < corpusLen * 0.5) {
      fail(`page "${c.id}": rendered body holds ${c.textLen} chars of ${corpusLen} in the corpus — the parser ate it`);
      collapsed++;
    }
    if (corpusLen > 0 && c.elCount === 0) { fail(`page "${c.id}": body rendered to zero elements`); collapsed++; }
  });
  if (!collapsed) ok(`no page collapsed in the parser (${collapse.length} bodies checked against their own text)`);

  // ── wikilinks: the live must point somewhere, the dead must be dead ──
  const links = await page.evaluate(() => {
    const live = [], dead = [];
    const scan = (rootNode) => {
      rootNode.querySelectorAll('a.wl[data-target]').forEach((a) => live.push(a.dataset.target));
      rootNode.querySelectorAll('.wl-dead[data-raw]').forEach((s) => dead.push(s.dataset.raw));
      rootNode.querySelectorAll('template').forEach((t) => scan(t.content));
    };
    scan(document);
    return { live, dead };
  });
  const idSet = new Set(data.pages.map((p) => p.id));
  const nameSet = new Set();
  for (const p of data.pages) { nameSet.add(norm(p.id)); nameSet.add(norm(p.title)); }
  for (const f of data.factRows) nameSet.add(norm(f));
  let badLinks = 0;
  for (const t of new Set(links.live)) {
    if (!idSet.has(t) && !data.factRows.includes(t)) { fail(`live wikilink aims at "${t}" — no such page or fact`); badLinks++; }
  }
  for (const d of new Set(links.dead)) {
    if (nameSet.has(norm(d))) { fail(`wikilink to "${d}" rendered DEAD but the target exists — resolution regressed`); badLinks++; }
  }
  if (!badLinks) ok(`wikilinks hold (${new Set(links.live).size} distinct live, ${new Set(links.dead).size} declared dead and honestly so)`);

  // ── routing: pages open by hash, cold and warm ──────────────────────
  const real = data.pages.filter((p) => !p.synthetic);
  const sample = real.length <= 120 ? real : [
    ...real.slice(0, 5), ...real.slice(-5),
    ...Array.from({ length: 50 }, () => real[Math.floor(Math.random() * real.length)]),
  ];
  let routeBad = 0;
  for (const p of new Map(sample.map((s) => [s.id, s])).values()) {
    await page.evaluate((id) => window.__book.go(id), p.id);
    const landed = await page
      .waitForFunction((t) => document.querySelector('.page-title')?.textContent === t, p.title, { timeout: 3000 })
      .then(() => true).catch(() => false);
    if (!landed) { fail(`routing: #${p.id} did not land on "${p.title}"`); routeBad++; }
  }
  if (!routeBad) ok(`routing holds (${new Map(sample.map((s) => [s.id, s])).size} pages opened by hash)`);

  // a cold deep link: a fresh load with the fragment already in the URL
  if (real.length) {
    const p = real[Math.floor(real.length / 2)];
    await page.goto(pathToFileURL(target).href + '#' + encodeURIComponent(p.id));
    await page.waitForFunction(() => window.__BOOK_READY__ === true, null, { timeout: 15000 }).catch(() => {});
    const cold = await page.evaluate(() => document.querySelector('.page-title')?.textContent);
    if (cold !== p.title) fail(`deep link: opening the file at #${p.id} cold landed on "${cold}", not "${p.title}"`);
    else ok(`deep links hold (#${p.id} opened cold)`);
  }

  // ── search: terms provably on a page must find that page ────────────
  // terms are drawn from the corpus itself, so this works on any book,
  // not just the fixture this check grew up on. A term on ONE page must
  // surface that page; a term on half the book only owes us SOMETHING —
  // results cap at 40, and no page is owed a slot in a crowd of hundreds.
  const spread = (term) => {
    const t = term.toLowerCase();
    let n = 0;
    for (const c of data.corpus) if (c && c.toLowerCase().includes(t)) n++;
    return n;
  };
  const terms = [];
  for (const [i, p] of data.pages.entries()) {
    if (p.synthetic || terms.length >= 10) continue;
    const words = (data.corpus[i] || '').match(/[a-zA-Z][a-zA-Z0-9]{6,}/g);
    if (!words) continue;
    // hunt a distinctive word for this page; settle for a common one if
    // the page truly has nothing rare to its name
    let pick = null, pickSpread = Infinity;
    for (const w of [words[Math.floor(words.length / 2)], ...words.slice(0, 8)]) {
      const s = spread(w);
      if (s < pickSpread) { pick = w; pickSpread = s; }
      if (s <= 3) break;
    }
    terms.push({ id: p.id, term: pick, spread: pickSpread });
  }
  let searchBad = 0;
  for (const { id, term, spread: sp } of terms) {
    const hits = await page.evaluate((t) => window.__book.search(t).map((r) => r.id), term);
    if (!hits.length) { fail(`search: "${term}" (present on ${id}) returned NOTHING`); searchBad++; }
    else if (sp <= 25 && !hits.includes(id)) {
      fail(`search: "${term}" is on only ${sp} page(s), ${id} among them, yet the results never name it`);
      searchBad++;
    }
  }
  const noise = await page.evaluate(() => window.__book.search('zzqqvvxxyyww').length);
  if (noise !== 0) fail(`search: pure noise returned ${noise} result(s) — the ranking is lying`);
  if (!searchBad && noise === 0) ok(`search answers (${terms.length} known-present terms found their pages; noise found nothing)`);

  // ── backlinks: a road in the graph must show on the far page ────────
  const edge = (() => {
    for (const [i, outs] of data.graph.entries()) {
      for (const t of outs) if (!data.pages[t]?.synthetic && !data.pages[i]?.synthetic) return { from: i, to: t };
    }
    return null;
  })();
  if (edge) {
    await page.evaluate((id) => window.__book.go(id), data.pages[edge.to].id);
    await page.waitForFunction((t) => document.querySelector('.page-title')?.textContent === t, data.pages[edge.to].title, { timeout: 3000 }).catch(() => {});
    const backs = await page.evaluate(() => [...document.querySelectorAll('.backlinks a')].map((a) => a.textContent));
    if (!backs.includes(data.pages[edge.from].title)) {
      fail(`backlinks: ${data.pages[edge.from].id} links to ${data.pages[edge.to].id}, but the far page does not cite it back`);
    } else ok(`backlinks computed both ways (${data.pages[edge.to].id} cites ${data.pages[edge.from].id})`);
    const svg = await page.evaluate(() => !!document.querySelector('.local-graph svg'));
    if (!svg) fail('local graph: a page with links drew no SVG neighbourhood');
    else ok('local graph drawn (inline SVG, no library)');
  } else notes.push('no page-to-page edges in this book — backlink and graph checks had nothing to bite');

  // ── the chrome: theme toggle and the search overlay by keyboard ─────
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'auto');
  await page.click('#theme-toggle');
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'auto');
  if (before === after) fail('theme toggle: clicking it changed nothing');
  else ok(`theme toggle works (${before} → ${after})`);

  if (terms.length) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('/');
    await page.waitForSelector('#search-input', { state: 'visible', timeout: 3000 }).catch(() => fail('keyboard: / did not open the search'));
    await page.keyboard.type(terms[0].term);
    await page.waitForSelector('.sr', { timeout: 3000 }).catch(() => fail('keyboard: typing a known term showed no results'));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const nav = await page.evaluate(() => location.hash.length > 1);
    if (!nav) fail('keyboard: Enter on a search result did not navigate');
    else ok('keyboard path works (/ → type → arrow → enter opened a page)');
  }
} finally {
  await browser.close();
}

// ── the verdict ────────────────────────────────────────────────────────
for (const n of notes) console.log(`  note  ${n}`);
if (failures.length) {
  console.error(`\nBROKEN — ${failures.length} failure(s) in ${renderPath}:`);
  for (const f of failures) console.error(`  FAIL  ${f}`);
  console.error('\nA render that fails here LOOKS fine. That is exactly why it must not ship.');
  process.exit(1);
}
console.log(`\nSOUND — ${renderPath} works as one self-contained file.`);
