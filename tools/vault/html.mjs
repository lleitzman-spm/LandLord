/**
 * The READ verb of the Great Book — one self-contained page for the whole Book.
 *
 *   node tools/vault/html.mjs
 *   node tools/vault/html.mjs --book codex --out renders/CODEX.html \
 *     --title "The Codex" --subtitle "Another Repository" --accent "#2b6a8a"
 *
 * Takes the directory of generated pages (`book/` here, `codex/` in the sister
 * repo), plus `knowledge/facts.json` where it exists, and binds the lot into
 * ONE html file that opens by double-click. No server, no plugin, no install,
 * no network: every style, every script, every byte of every page is inlined,
 * and the file ships its own Content-Security-Policy so that even a mistake
 * cannot reach out. A page that quietly loads from a CDN publishes as an empty
 * shell that still looks fine at a glance — that whole class of failure is
 * what this file and its verifier (html-check.mjs) exist to keep dead.
 *
 * What the renderer does, in order:
 *   1. walks the book directory for markdown pages, reads their frontmatter
 *      (type, id, standing, source_path, generated — all tolerated missing);
 *   2. converts each body with its OWN small markdown converter — headings,
 *      lists, tables, fences, blockquotes, callouts, links and wikilinks.
 *      No library, on purpose: the read verb must never gain a dependency;
 *   3. resolves every [[Wikilink]] against the union of page ids, titles,
 *      filename stems and fact ids. What resolves becomes a working link;
 *      what does not is rendered VISIBLY dead and reported — never left
 *      looking like a link that merely forgot to work;
 *   4. projects `knowledge/facts.json` straight into a ledger page — the
 *      governing numbers live there as their canonical home, and emitting
 *      separate fact pages would make a second copy that could drift;
 *   5. builds the front page as a spine, not a dump: laws, writs, the
 *      numbers, what is contested, what is merely proposed, the modules —
 *      with everything else reachable through the shelves, not front-loaded;
 *   6. embeds a search corpus and the link graph as JSON, page bodies as
 *      inert <template> elements, and the client script from html.client.js.
 *
 * Standing is rendered on the FACE of every page — chips everywhere the page
 * is named, and a banner across proposed / contested / retired / settled
 * pages. A `proposed` claim sitting next to a `built` one in plain prose is
 * exactly how the HANDOFF blocker lie survived five sessions; here they are
 * never dressed alike.
 *
 * Honest limits, so nobody discovers them the hard way:
 *   - The markdown converter covers the subset the emitter writes. Raw HTML
 *     in a source is ESCAPED, not passed through; reference-style links,
 *     footnotes and setext headings are not understood.
 *   - Images cannot travel inside one file unless they are data: URIs, so
 *     any other image renders as a labelled figure box naming its path.
 *   - External [text](https://…) links in prose stay clickable — following
 *     one is a reader's choice, not a page load — but they are the ONLY
 *     outward references the file may contain, and the verifier counts them.
 *   - Frontmatter parsing is a deliberate flat subset of YAML: scalars,
 *     quoted strings, inline [a, b] lists and simple `- item` blocks.
 *     Nested maps are ignored rather than guessed at.
 *
 * Exit 0 = rendered; 1 = the book directory is missing or unreadable.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, basename, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// ── The writ's standings. Anything else renders neutrally as "unmarked" ──
const STANDINGS = ['canon', 'built', 'proposed', 'contested', 'retired', 'settled'];

// ─────────────────────────────────────────────────────────────────────────
// Arguments — parameterised so the sister repo can pass its own name and
// colour without touching this file. Defaults are LandLord's.
// ─────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {
    book: 'book',
    facts: 'knowledge/facts.json',
    out: 'renders/BOOK.html',
    title: 'The Great Book',
    subtitle: 'LandLord',
    accent: '#8a5a2b', // a bookbinder's leather brown; calm, not theme-park
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const take = () => argv[++i] ?? '';
    if (k === '--book') a.book = take();
    else if (k === '--facts') a.facts = take();
    else if (k === '--out') a.out = take();
    else if (k === '--title') a.title = take();
    else if (k === '--subtitle') a.subtitle = take();
    else if (k === '--accent') a.accent = take();
    else if (k === '--help' || k === '-h') {
      console.log('usage: node tools/vault/html.mjs [--book DIR] [--facts FILE] [--out FILE]');
      console.log('                                 [--title T] [--subtitle S] [--accent #hex]');
      process.exit(0);
    }
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────
// Small shared helpers
// ─────────────────────────────────────────────────────────────────────────
const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A slug for heading anchors and derived ids. */
const slug = (s) =>
  String(s).toLowerCase().normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'x';

/**
 * The normal form every wikilink target and every registered name is folded
 * to before matching. Colons survive because ids like `law:1` and
 * `fact:late-fee-split` carry them; everything else that is not a letter or
 * number collapses to a dash, so `[[Law 1 — Recognizable Words]]` finds the
 * page titled "Law 1 — recognizable words".
 */
const norm = (s) =>
  String(s).toLowerCase().normalize('NFKD')
    .replace(/[^\p{L}\p{N}:]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/**
 * The standing chip — the same small badge everywhere a page is named, so a
 * proposed thing can never dress as a built one. An unknown standing gets a
 * neutral chip carrying its own word; a missing one reads "unmarked". Neither
 * is hidden, because hiding is how the HANDOFF lie survived.
 */
const chip = (standing) => {
  const s = String(standing || '');
  const cls = STANDINGS.includes(s) ? `s-${s}` : s ? 's-other' : 's-none';
  return `<span class="chip ${cls}">${escapeHtml(s || 'unmarked')}</span>`;
};

// ─────────────────────────────────────────────────────────────────────────
// Frontmatter — a flat, forgiving subset of YAML. The emitter writes simple
// scalars and simple lists; anything fancier is somebody's bug, and this
// parser refuses to guess at it rather than silently misread it.
// ─────────────────────────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith('---')) return { meta: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: text }; // an unclosed fence is a body, not a header
  const head = text.slice(text.indexOf('\n') + 1, end);
  const body = text.slice(text.indexOf('\n', end + 1) + 1);
  const meta = {};
  let listKey = null;
  for (const line of head.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && listKey) { meta[listKey].push(unquote(li[1])); continue; }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue; // an indented nested map, or noise — tolerated, ignored
    const [, key, rawVal] = kv;
    listKey = null;
    if (rawVal === '') { meta[key] = []; listKey = key; continue; }
    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      meta[key] = rawVal.slice(1, -1).split(',').map((v) => unquote(v.trim())).filter(Boolean);
      continue;
    }
    meta[key] = unquote(rawVal);
  }
  return { meta, body };
}
const unquote = (v) => {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
};

// ─────────────────────────────────────────────────────────────────────────
// Markdown → HTML. Line-based, no lookbehind tricks, no library.
// The converter takes a `ctx` so wikilinks can be resolved and recorded as
// they are met — links are found during rendering, never invented after.
// ─────────────────────────────────────────────────────────────────────────

/** Stash-and-restore placeholders keep code spans out of the way of the
 *  other inline rules (a `**` inside backticks must stay literal). */
const PH_OPEN = '\uE000', PH_CLOSE = '\uE001'; // private-use: no source text contains these
const BR = '\uE002';       // stands in for markdown's two-trailing-space hard break

function renderInline(text, ctx) {
  let out = escapeHtml(text);
  const stash = [];
  const put = (html) => { stash.push(html); return PH_OPEN + (stash.length - 1) + PH_CLOSE; };

  // code spans first, so nothing inside them is touched again
  out = out.replace(/`([^`\n]+)`/g, (_, code) => put(`<code>${code}</code>`));

  // wikilinks: [[Target]], [[Target|Label]], [[Target#Section]].
  // The text was HTML-escaped above, so a target like "profile & wielding"
  // arrives as "profile &amp; wielding" — unescape before resolving, or a
  // real page renders dead (the real book caught exactly this).
  const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  out = out.replace(/\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]+))?\]\]/g, (_, target, section, label) => {
    const t = unesc(target).trim();
    const shown = unesc(label || target).trim();
    const hit = ctx.resolve(t);
    if (hit) {
      ctx.recordLink(hit);
      const anchor = section ? '@' + slug(section) : '';
      return put(`<a class="wl" data-target="${escapeHtml(hit.id)}" href="#${escapeHtml(encodeURIComponent(hit.id))}${anchor}">${escapeHtml(shown)}</a>`);
    }
    ctx.recordDead(t);
    // Visibly dead: a reader must see at a glance that the road ends here.
    return put(`<span class="wl-dead" data-raw="${escapeHtml(t)}" title="No page answers to “${escapeHtml(t)}”">${escapeHtml(shown)}</span>`);
  });

  // images. One file cannot carry a neighbouring image, so only data: URIs
  // render; anything else becomes an honest labelled box, never a broken icon.
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const url = src.trim().split(/\s+/)[0];
    if (/^data:image\//i.test(url)) return put(`<img alt="${alt}" src="${url}">`);
    return put(`<span class="img-ref" title="Images cannot travel inside one file">▤ figure: ${alt || url}</span>`);
  });

  // ordinary links. Internal #anchors and relative paths keep their href;
  // external ones are marked so the eye (and the verifier) can count them.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, dest) => {
    const url = dest.trim().split(/\s+/)[0];
    if (/^(https?:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
      ctx.recordExternal(url);
      return put(`<a class="ext" href="${url}" rel="noopener noreferrer">${label}<span class="ext-mark" aria-hidden="true">↗</span></a>`);
    }
    if (url.startsWith('#')) return put(`<a href="${url}">${label}</a>`);
    // A relative path is a pointer into the repo — real, but not walkable
    // from inside one file. Shown as a path, styled as a reference.
    return put(`<span class="path-ref" title="A path in the repo, not a page in the Book">${label}</span>`);
  });

  out = out
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return out.replace(new RegExp(PH_OPEN + '(\\d+)' + PH_CLOSE, 'g'), (_, i) => stash[+i]);
}

const plainOfInline = (t) => t
  .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b || a))
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[`*_~]+/g, '');

function renderBlocks(lines, ctx) {
  const html = [];
  const text = []; // the plain text twin, for the search corpus
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // fenced code
    const fence = line.match(/^(\s*)(```|~~~)\s*(\S*)\s*$/);
    if (fence) {
      const close = fence[2];
      const lang = fence[3];
      const buf = [];
      i++;
      while (i < n && !lines[i].trim().startsWith(close)) { buf.push(lines[i]); i++; }
      i++; // past the closing fence (or the end — an unclosed fence swallows to EOF, honestly)
      html.push(`<pre class="code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      text.push(buf.join('\n'));
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const inner = renderInline(h[2], ctx);
      const plain = plainOfInline(h[2]);
      html.push(`<h${level} id="${slug(plain)}">${inner}</h${level}>`);
      text.push(plain);
      ctx.recordHeading?.(level, plain);
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    // blockquote — and the callout dressed as one
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < n && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      const callout = buf[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout) {
        const kind = callout[1].toLowerCase();
        const known = ['note', 'tip', 'important', 'warning', 'caution'].includes(kind) ? kind : 'note';
        const title = callout[2].trim() || callout[1][0] + callout[1].slice(1).toLowerCase();
        const inner = renderBlocks(buf.slice(1), ctx);
        html.push(`<aside class="callout c-${known}"><p class="callout-title">${escapeHtml(title)}</p>${inner.html}</aside>`);
        text.push(title, inner.text);
      } else {
        const inner = renderBlocks(buf, ctx);
        html.push(`<blockquote>${inner.html}</blockquote>`);
        text.push(inner.text);
      }
      continue;
    }

    // table: a pipe row followed by the |---|---| separator
    if (line.includes('|') && i + 1 < n && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const splitRow = (row) => {
        // pipes inside code spans must not split cells
        const guarded = row.replace(/`[^`]*`/g, (m) => m.replace(/\|/g, PH_OPEN));
        return guarded.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
          .split('|').map((c) => c.replace(new RegExp(PH_OPEN, 'g'), '|').trim());
      };
      const headCells = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) =>
        /^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : '');
      i += 2;
      const rows = [];
      while (i < n && lines[i].includes('|') && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
      const td = (cells, tag) => '<tr>' + cells.map((c, j) =>
        `<${tag}${aligns[j] ? ` style="text-align:${aligns[j]}"` : ''}>${renderInline(c, ctx)}</${tag}>`).join('') + '</tr>';
      html.push('<div class="table-wrap"><table><thead>' + td(headCells, 'th') + '</thead><tbody>'
        + rows.map((r) => td(r, 'td')).join('') + '</tbody></table></div>');
      text.push(headCells.map(plainOfInline).join(' '), ...rows.map((r) => r.map(plainOfInline).join(' ')));
      continue;
    }

    // list — unordered or ordered, one style of nesting: deeper indent
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+/);
    if (li) {
      const { html: listHtml, textParts, next } = parseList(lines, i, li[1].length, ctx);
      html.push(listHtml);
      text.push(...textParts);
      i = next;
      continue;
    }

    // paragraph: gather until a blank line or the start of any other block
    const buf = [line];
    i++;
    while (i < n && lines[i].trim()
      && !/^(#{1,6})\s/.test(lines[i]) && !/^\s*>/.test(lines[i])
      && !/^(\s*)(```|~~~)/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i])
      && !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    const para = buf.map((l) => l.replace(/\s{2,}$/, BR)).join(' ');
    html.push(`<p>${renderInline(para, ctx).replace(new RegExp(BR, 'g'), '<br>')}</p>`);
    text.push(plainOfInline(buf.join(' ')));
  }

  return { html: html.join('\n'), text: text.join('\n') };
}

function parseList(lines, start, baseIndent, ctx) {
  const items = [];
  const marker = lines[start].match(/^\s*([-*+]|\d+[.)])/)[1];
  const ordered = /\d/.test(marker);
  let i = start;
  let cur = null;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (m && m[1].length === baseIndent) {
      if (cur) items.push(cur);
      cur = { head: m[3], kids: [] };
      i++;
    } else if (m && m[1].length > baseIndent) {
      cur?.kids.push(line); i++;
    } else if (!line.trim()) {
      // a blank line ends the list unless another item of ours follows
      const nx = lines[i + 1]?.match(/^(\s*)([-*+]|\d+[.)])\s+/);
      const cont = lines[i + 1] && /^\s+\S/.test(lines[i + 1]) && (!nx || nx[1].length > baseIndent);
      if ((nx && nx[1].length >= baseIndent) || cont) { i++; continue; }
      break;
    } else if (/^\s+\S/.test(line) && line.match(/^(\s*)/)[1].length > baseIndent) {
      cur?.kids.push(line); i++; // continuation prose inside the item
    } else break;
  }
  if (cur) items.push(cur);

  const textParts = [];
  const body = items.map((it) => {
    let inner = renderInline(it.head, ctx);
    textParts.push(plainOfInline(it.head));
    if (it.kids.length) {
      const dedent = Math.min(...it.kids.filter((k) => k.trim()).map((k) => k.match(/^(\s*)/)[1].length));
      const sub = renderBlocks(it.kids.map((k) => k.slice(dedent)), ctx);
      inner += '\n' + sub.html;
      textParts.push(sub.text);
    }
    return `<li>${inner}</li>`;
  }).join('\n');

  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${body}</${tag}>`, textParts, next: i };
}

// ─────────────────────────────────────────────────────────────────────────
// Reading the book off disk
// ─────────────────────────────────────────────────────────────────────────
function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) found.push(...walk(p));
    else if (extname(name).toLowerCase() === '.md') found.push(p);
  }
  return found;
}

function loadPages(bookDir) {
  const pages = [];
  for (const path of walk(bookDir)) {
    const rel = relative(bookDir, path);
    const stem = basename(path, extname(path));
    let meta = {}, body = '';
    try {
      ({ meta, body } = parseFrontmatter(readFileSync(path, 'utf8')));
    } catch (e) {
      console.error(`  warn  could not read ${rel}: ${e.message} — skipped`);
      continue;
    }
    const firstH1 = body.match(/^#\s+(.+)$/m);
    const dirName = dirname(rel) === '.' ? '' : dirname(rel).split('/')[0];
    const isStart = /^00[\s-]/.test(stem);
    const page = {
      id: String(meta.id || (isStart ? 'start-here' : slug(stem))),
      title: String(meta.title || (firstH1 ? plainOfInline(firstH1[1]) : stem.replace(/^00[\s-]+/, ''))),
      // frontmatter wins over the shelf it sits on; the shelf is the fallback
      type: String(meta.type || (dirName ? dirName.replace(/s$/, '') : isStart ? 'note' : 'page')),
      standing: STANDINGS.includes(meta.standing) ? meta.standing : (meta.standing ? String(meta.standing) : ''),
      source: String(meta.source_path || ''),
      generated: String(meta.generated || ''),
      stem, rel, bodyMd: body,
      pinned: isStart,
    };
    pages.push(page);
  }
  // deterministic order: shelf, then id — so a re-render with no change
  // produces an identical file
  pages.sort((a, b) => (a.type + '\0' + a.id).localeCompare(b.type + '\0' + b.id));
  return pages;
}

function loadFacts(factsPath) {
  if (!existsSync(factsPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(factsPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw.facts) ? raw.facts : [];
    return list.filter((f) => f && typeof f === 'object');
  } catch (e) {
    console.error(`  warn  ${factsPath} exists but did not parse (${e.message}) — the ledger will be empty`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// The build
// ─────────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));
  const bookDir = resolve(ROOT, args.book);
  const factsPath = resolve(ROOT, args.facts);
  const outPath = resolve(ROOT, args.out);

  if (!existsSync(bookDir)) {
    console.error(`FAIL  no book at ${args.book}/ — run the compile verb first (npm run book),`);
    console.error('      or point --book at the directory of generated pages.');
    process.exit(1);
  }

  const pages = loadPages(bookDir);
  const facts = loadFacts(factsPath);
  if (!pages.length) console.error('  warn  the book directory holds no pages — rendering the shell anyway');

  // ── The name registry every wikilink resolves against ──────────────────
  // Ids, titles and filename stems all answer; first claim on a name wins
  // and a collision is reported, because a silently re-aimed link is worse
  // than a dead one.
  const registry = new Map(); // norm(name) → { id, kind }
  const collisions = [];
  const claim = (name, id, kind) => {
    const k = norm(name);
    if (!k) return;
    const prior = registry.get(k);
    if (prior && prior.id !== id) { collisions.push({ name, held: prior.id, wanted: id }); return; }
    registry.set(k, { id, kind });
  };

  const FACTS_PAGE_ID = 'facts-ledger';
  for (const p of pages) { claim(p.id, p.id, 'page'); }
  for (const p of pages) { claim(p.title, p.id, 'page'); claim(p.stem, p.id, 'page'); }
  // an emitter may write per-fact PAGES as well; when one already holds the
  // fact's id, the page wins quietly — that is a choice, not a collision
  for (const f of facts) { if (f.id && !registry.has(norm(f.id))) claim(f.id, FACTS_PAGE_ID, 'fact'); }

  // ── Render every page body, recording links as they are found ──────────
  const deadLinks = []; // { page, target }
  const externals = []; // { page, url }
  const idToIndex = new Map();

  const rendered = pages.map((p, idx) => {
    idToIndex.set(p.id, idx);
    const links = new Set();     // page ids this page reaches
    const factRefs = new Set();  // fact ids this page cites
    const ctx = {
      resolve: (target) => {
        const hit = registry.get(norm(target));
        if (!hit) return null;
        if (hit.kind === 'fact') return { id: norm(target), fact: true };
        return { id: hit.id };
      },
      recordLink: (hit) => { if (hit.fact) factRefs.add(hit.id); else if (hit.id !== p.id) links.add(hit.id); },
      recordDead: (target) => deadLinks.push({ page: p.id, target }),
      recordExternal: (url) => externals.push({ page: p.id, url }),
    };
    // resolve() for facts hands back the normalised fact id and the client
    // routes `#fact:x` to the ledger row — one copy of every number, always.
    const { html, text } = renderBlocks(p.bodyMd.split('\n'), ctx);
    return { html, text, links, factRefs };
  });

  // ── The facts ledger — knowledge/facts.json projected, not copied ──────
  const factRows = facts.map((f) => {
    const id = String(f.id || '');
    const standing = STANDINGS.includes(f.standing) ? f.standing : '';
    const value = f.value === null || f.value === undefined || f.value === ''
      ? `<span class="fact-unknown" title="No value has been ratified">unknown</span>`
      : `<span class="fact-value">${escapeHtml(String(f.value))}${f.unit ? ` <span class="fact-unit">${escapeHtml(String(f.unit))}</span>` : ''}</span>`;
    const sources = (Array.isArray(f.sources) ? f.sources : []).map((s) => {
      const doc = escapeHtml(String(s.doc || s.path || ''));
      const quote = s.quote ? `<q>${escapeHtml(String(s.quote))}</q>` : '';
      return `<div class="fact-source"><span class="path-ref">${doc}</span> ${quote}</div>`;
    }).join('');
    return `<tr id="fr-${escapeHtml(norm(id))}" data-fact="${escapeHtml(norm(id))}">
      <td><div class="fact-label">${escapeHtml(String(f.label || id || '(unlabelled)'))}</div><div class="fact-id">${escapeHtml(id)}</div></td>
      <td>${value}${f.kind ? `<div class="fact-kind">${escapeHtml(String(f.kind))}</div>` : ''}</td>
      <td class="fact-scope">${escapeHtml(String(f.scope || ''))}</td>
      <td>${chip(standing)}</td>
      <td>${sources}</td>
    </tr>`;
  });

  const factsLedgerHtml = facts.length
    ? `<p class="ledger-note">Every governing number, projected straight from <span class="path-ref">${escapeHtml(args.facts)}</span> — its one canonical home. To change a number, change it there and re-render; a copy would only learn to drift.</p>
       <div class="table-wrap"><table class="facts-table">
       <thead><tr><th>Fact</th><th>Value</th><th>Scope</th><th>Standing</th><th>Sources</th></tr></thead>
       <tbody>${factRows.join('\n')}</tbody></table></div>`
    : `<p class="ledger-note">No <span class="path-ref">${escapeHtml(args.facts)}</span> was found, so the ledger stands empty. The governing numbers live there when it exists.</p>`;

  // ── The front page: a spine, not a dump ─────────────────────────────────
  const byType = new Map();
  for (const p of pages) {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type).push(p);
  }
  const numOf = (p) => { const m = p.id.match(/(\d+)\s*$/) || p.title.match(/(\d+)/); return m ? +m[1] : 1e9; };
  const sortLawful = (list) => [...list].sort((a, b) => numOf(a) - numOf(b) || a.title.localeCompare(b.title));

  const pageRow = (p) =>
    `<li class="spine-row"><a class="wl" data-target="${escapeHtml(p.id)}" href="#${escapeHtml(encodeURIComponent(p.id))}">${escapeHtml(p.title)}</a> ${chip(p.standing)}</li>`;
  const section = (heading, body, note) => body
    ? `<section class="spine-sec"><h2>${escapeHtml(heading)}</h2>${note ? `<p class="spine-note">${note}</p>` : ''}${body}</section>` : '';
  const listOf = (arr) => arr?.length ? `<ul class="spine-list">${arr.map(pageRow).join('\n')}</ul>` : '';

  const contestedPages = pages.filter((p) => p.standing === 'contested');
  const contestedFacts = facts.filter((f) => f.standing === 'contested');
  const proposedPages = pages.filter((p) => p.standing === 'proposed');
  const startPage = pages.find((p) => p.pinned);
  const spineTypes = new Set(['law', 'writ', 'module', 'fact']);
  const shelfLinks = [...byType.entries()]
    .filter(([t]) => !spineTypes.has(t))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([t, list]) =>
      `<a class="shelf-link" href="#browse:type=${escapeHtml(encodeURIComponent(t))}">${escapeHtml(t)}<span class="shelf-count">${list.length}</span></a>`)
    .join('');

  const startInlined = startPage
    ? `<section class="spine-sec start-sec">${rendered[idToIndex.get(startPage.id)].html}</section>`
    : '';

  const contestedBody = (contestedPages.length || contestedFacts.length)
    ? listOf(contestedPages) + (contestedFacts.length
      ? `<ul class="spine-list">${contestedFacts.map((f) =>
          `<li class="spine-row"><a class="wl" data-target="${FACTS_PAGE_ID}" href="#fact:${escapeHtml(encodeURIComponent(norm(f.id || '')))}">${escapeHtml(String(f.label || f.id))}</a> ${chip('contested')}</li>`).join('\n')}</ul>` : '')
    : '<p class="spine-note quiet">Nothing stands contested.</p>';

  const homeHtml = `
    ${startInlined}
    ${section('The Laws', listOf(sortLawful(byType.get('law') || [])),
      'The constitution’s rulings. Canon wins until amended.')}
    ${section('The Writs', listOf(sortLawful(byType.get('writ') || [])),
      'What each surface is meant to do. A writ is a spec, not proof that anything works.')}
    ${section('The Governing Numbers',
      facts.length
        ? `<p class="spine-note">${facts.length} number${facts.length === 1 ? '' : 's'} on the ledger — <a class="wl" data-target="${FACTS_PAGE_ID}" href="#${FACTS_PAGE_ID}">open the full ledger</a>.</p>`
        : (byType.get('fact')?.length ? listOf(byType.get('fact')) : '<p class="spine-note quiet">No ledger yet.</p>'))}
    ${section('Contested', contestedBody, contestedPages.length || contestedFacts.length
      ? 'Two sources disagree and no decision has been made. Settle these before citing either side.' : '')}
    ${section('Merely Proposed', proposedPages.length ? listOf(proposedPages) : '<p class="spine-note quiet">Nothing merely proposed.</p>',
      proposedPages.length ? 'Designs not yet built. May never be cited as evidence that something works.' : '')}
    ${section('The Load-Bearing Modules', listOf(byType.get('module') || []),
      'The code the kingdom actually runs on.')}
    ${shelfLinks ? `<section class="spine-sec"><h2>The Rest of the Shelves</h2>
      <p class="spine-note">Reachable, not front-loaded.</p>
      <div class="shelf-row">${shelfLinks}</div></section>` : ''}`;

  // ── Assemble the data the client needs ──────────────────────────────────
  const pagesMeta = pages.map((p, i) => ({
    id: p.id, title: p.title, type: p.type, standing: p.standing,
    source: p.source, generated: p.generated,
  }));
  // synthetic surfaces ride along at the end: the ledger and the front page
  pagesMeta.push({ id: FACTS_PAGE_ID, title: 'The Ledger of Governing Numbers', type: 'ledger', standing: '', source: args.facts, generated: '', synthetic: true });
  pagesMeta.push({ id: 'home', title: args.title, type: 'spine', standing: '', source: '', generated: '', synthetic: true });

  // Search corpus: title + full body text per page, capped per page so one
  // pathological page cannot bloat the file. 60k chars of prose is ~10x the
  // longest real page today; the cap is a fuse, not a feature.
  const corpus = rendered.map((r) => r.text.slice(0, 60000));
  corpus.push(facts.map((f) => [f.id, f.label, f.scope, f.kind, f.value, ...(f.sources || []).map((s) => s.quote)].filter(Boolean).join(' ')).join('\n'));
  corpus.push(''); // home searches by its title alone

  // Link graph as index adjacency; fact citations point at the ledger page.
  const ledgerIdx = pagesMeta.length - 2;
  const graph = rendered.map((r) => {
    const out = [...r.links].map((id) => idToIndex.get(id)).filter((x) => x !== undefined);
    if (r.factRefs.size) out.push(ledgerIdx);
    return [...new Set(out)];
  });
  graph.push([], []);

  const data = {
    title: args.title, subtitle: args.subtitle,
    generated: new Date().toISOString(),
    standings: STANDINGS,
    pages: pagesMeta, corpus, graph,
    factRows: facts.map((f) => norm(String(f.id || ''))),
    startId: startPage ? startPage.id : null,
  };

  // ── Templates: every page body inert until the router mounts it ────────
  const templates = pages.map((p, i) =>
    `<template data-page="${escapeHtml(p.id)}">${rendered[i].html}</template>`);
  templates.push(`<template data-page="${FACTS_PAGE_ID}">${factsLedgerHtml}</template>`);
  templates.push(`<template data-page="home">${homeHtml}</template>`);

  // ── The shell ───────────────────────────────────────────────────────────
  const css = readFileSync(join(HERE, 'html.css'), 'utf8');
  const clientJs = readFileSync(join(HERE, 'html.client.js'), 'utf8');
  const jsonSafe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

  // The page carries its own strict CSP: even a bug cannot phone out.
  // Inline style and script are the ONLY things allowed, plus data: images —
  // which is precisely the shape of a self-contained file.
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;">
<title>${escapeHtml(args.title)} — ${escapeHtml(args.subtitle)}</title>
<style>
:root { --accent: ${escapeHtml(args.accent)}; }
${css}
</style>
</head>
<body>
<div class="app">
  <nav class="spine-nav" id="spine-nav" aria-label="The Book">
    <div class="brand">
      <a href="#home" class="brand-title">${escapeHtml(args.title)}</a>
      <div class="brand-sub">${escapeHtml(args.subtitle)}</div>
    </div>
    <div class="nav-search">
      <button id="search-open" class="search-hint" title="Search the whole Book ( / )">Search… <kbd>/</kbd></button>
    </div>
    <div class="nav-links" id="nav-links"></div>
    <div class="nav-foot">
      <button id="theme-toggle" title="Cycle theme: follow the system, light, dark">theme: <span id="theme-name">auto</span></button>
      <div class="key-help">
        <kbd>/</kbd> search &nbsp;<kbd>j</kbd><kbd>k</kbd> move &nbsp;<kbd>⏎</kbd> open<br>
        <kbd>g</kbd> then <kbd>h</kbd>ome <kbd>b</kbd>rowse <kbd>l</kbd>aws <kbd>w</kbd>rits<br>
        <kbd>m</kbd>odules <kbd>f</kbd>acts <kbd>c</kbd>ontested <kbd>p</kbd>roposed
      </div>
      <div class="colophon">rendered ${escapeHtml(data.generated.slice(0, 10))} · ${pages.length} pages</div>
    </div>
  </nav>
  <main class="page-pane" id="page-pane">
    <article id="page-root" class="page" aria-live="polite"></article>
  </main>
</div>
<div id="search-layer" class="search-layer" hidden>
  <div class="search-box" role="dialog" aria-label="Search">
    <input id="search-input" type="search" placeholder="Search titles and text…" autocomplete="off" spellcheck="false">
    <div id="search-results" class="search-results" role="listbox"></div>
    <div class="search-foot"><kbd>↑</kbd><kbd>↓</kbd> or <kbd>j</kbd><kbd>k</kbd> move · <kbd>⏎</kbd> open · <kbd>esc</kbd> close</div>
  </div>
</div>
${templates.join('\n')}
<script type="application/json" id="book-data">${jsonSafe(data)}</script>
<script>
${clientJs}
</script>
</body>
</html>
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, doc);

  // ── The reckoning ───────────────────────────────────────────────────────
  const typeCounts = [...byType.entries()].map(([t, l]) => `${t} ${l.length}`).join(', ');
  console.log(`RENDERED  ${relative(ROOT, outPath)}  (${(doc.length / 1024).toFixed(0)} KB)`);
  console.log(`  pages   ${pages.length}${typeCounts ? `  (${typeCounts})` : ''}`);
  console.log(`  facts   ${facts.length}${existsSync(factsPath) ? '' : '  (no ledger file — tolerated)'}`);
  if (collisions.length) {
    console.log(`  note    ${collisions.length} name collision(s) — first claim held:`);
    for (const c of collisions.slice(0, 10)) console.log(`          "${c.name}" stays with ${c.held}; ${c.wanted} also answers to it`);
  }
  if (deadLinks.length) {
    console.log(`  dead    ${deadLinks.length} wikilink(s) resolve to nothing — rendered visibly dead:`);
    for (const d of deadLinks.slice(0, 20)) console.log(`          ${d.page} → [[${d.target}]]`);
    if (deadLinks.length > 20) console.log(`          …and ${deadLinks.length - 20} more`);
  }
  if (externals.length) {
    console.log(`  ext     ${externals.length} outward link(s) in prose (clickable, never loaded):`);
    for (const e of externals.slice(0, 10)) console.log(`          ${e.page} → ${e.url}`);
  }
}

main();
