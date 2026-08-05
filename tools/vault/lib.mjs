// The vault's shared hands — everything the compile, lint and query verbs of the
// Great Book need in common (see `docs/WRIT-THE-GREAT-BOOK.md`, the ratified writ).
//
// WHY THIS EXISTS
// Every session in this kingdom pays the grep tax. Grep finds a string; it does not
// tell you that the thing you are about to write already has a law governing it, a
// writ specifying it, a module implementing it and a test forbidding the change. This
// file builds the one graph all three verbs read, so the compiler, the linter and the
// tracer can never disagree about what the repo contains.
//
// HONEST LIMITS — read these before you trust an edge:
//   1. LINKS ARE FOUND, NEVER INVENTED. An edge exists only where a LITERAL identifier
//      matched — an id, a file path, an exported symbol, a declared link. Where a source
//      states a relationship only in prose, there is no edge. A graph that suggests a
//      false kinship is worse than a sparse one.
//   2. A test-file import is a SHARED-SOURCE COINCIDENCE, not a semantic claim. When an
//      invariant points at a module it means "the file this test lives in imports that
//      module" — NOT "this one test exercises that module". Every page that carries such
//      an edge says so on its face.
//   3. The describe-ancestry of a test is read by INDENTATION, not by parsing TypeScript.
//      Prettier-shaped code (which this repo is) reads true; hand-mangled indentation
//      would not. And an invariant page is one SOURCE SITE, not one runtime case: an
//      `it()` inside a `for` loop, or an `it.each([…])` over a table, is one page here and
//      several tests when vitest runs it. Expect the Book's invariant count to sit BELOW
//      the runner's test count, and never read the difference as a missing test.
//   4. Exported symbols are found by regex over `export …`. A symbol exported through a
//      clever re-export or built at runtime is missed. It errs toward missing an edge,
//      never toward inventing one.
//   5. A DEFAULTED standing is not a declared one. Where `knowledge/artifacts.json` does
//      not declare a path, the page says its standing was defaulted and the map counts it.
//
// Pure Node — `node:fs`, `node:path`, `node:child_process` only. No install, ever.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BOOK = path.join(REPO, 'book');
export const GENERATOR = 'tools/vault/emit.mjs';

/** A label shorter than this is never matched literally inside a document — "King"
 *  appears on every page and an edge from it would mean nothing. Ids and file paths
 *  are matched at any length, because they are unambiguous by construction. */
export const LABEL_MIN = 10;
/** An exported symbol shorter than this is not hunted in prose (`id`, `at`, `now`). */
export const SYMBOL_MIN = 6;

/** A symbol is only hunted in prose when its SHAPE marks it as an identifier rather than
 *  an ordinary word of the kingdom's vocabulary: an inner capital (`foldIntoFief`,
 *  `readFlow`), an underscore (`FOUNDING_FLOWS`), or sheer length. Without this, `census`
 *  and `FOUNDING` — both real exports and both plain English here — would tie every
 *  document to every module and the graph would mean nothing.
 *  HONEST LIMIT: a single-word lowercase export can therefore never be found in prose. */
export function isIdentifierShaped(s) {
  if (s.length < SYMBOL_MIN) return false;
  if (s.includes('_') || s.includes('$')) return true;
  if (/^[a-z]+[A-Z]/.test(s)) return true; // camelCase
  if (/^[A-Z][a-z]+[A-Z]/.test(s)) return true; // PascalCase, two words up
  return s.length >= 12;
}

/** The kinds of page the Book holds, and the shelf each one stands on. */
export const TYPE_DIRS = {
  law: 'laws',
  act: 'acts',
  module: 'modules',
  invariant: 'invariants',
  writ: 'writs',
  fact: 'facts',
  decision: 'decisions',
  surface: 'surfaces',
  entity: 'entities',
  term: 'terms',
  artifact: 'artifacts',
  map: 'maps',
};

export const STANDINGS = ['canon', 'built', 'proposed', 'contested', 'retired', 'settled'];

/** What each standing MEANS, rendered on the face of every page. The five-session
 *  blocker lie happened because a proposed claim and a built one sat side by side in
 *  plain prose and looked the same. */
export const STANDING_BANNER = {
  canon: 'Ratified in the constitution. Wins until amended; changing it is an amendment, not an edit.',
  built: 'Implemented in code and checkable against the tree.',
  proposed:
    'NOT BUILT. A writ, a plan, a design. This page may NEVER be cited as evidence that something works.',
  contested: 'Two sources disagree and no decision has been made. Do not act on it as settled.',
  retired: 'Superseded. Kept for history, never cited as current.',
  settled: 'Decided by Edwin. Not open, not a finding. Do not raise it as a question.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Small hands — the file drudgery
// ─────────────────────────────────────────────────────────────────────────────

export function readText(abs) {
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

export function readJson(abs) {
  const raw = readText(abs);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { __parseError: String(err && err.message ? err.message : err) };
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-operator', 'dist-ssr', 'dist-wargame']);

/** Every file under `dir`, repo-relative, sorted, with the noisy places skipped. */
export function walkFiles(dir, { ext = null } = {}) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const here = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(here, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(here, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(abs);
      } else if (e.isFile()) {
        if (ext && !ext.some((x) => e.name.endsWith(x))) continue;
        out.push(path.relative(REPO, abs));
      }
    }
  }
  return out.sort();
}

/** Whitespace-normalised, for the quote check — markdown wraps, and a wrapped quote
 *  is still the same words in the same order. Nothing else is normalised: a quote is
 *  verbatim or it is a hallucination with a schema. */
export function normalizeWs(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s, max = 80) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '') || 'page'
  );
}

export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip line and block comments and string bodies, so a scanner sees CODE only.
 *  Lengths are preserved (everything becomes spaces) so line/column stay true. */
export function stripCommentsAndStrings(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      let j = i;
      while (j < src.length && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
    } else if (c === '/' && n === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? src.length : j + 2;
      blank(i, j);
      i = j;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') j += 2;
        else if (src[j] === c) break;
        else j++;
      }
      blank(i + 1, Math.min(j, src.length));
      i = Math.min(j + 1, src.length);
    } else {
      i++;
    }
  }
  return out.join('');
}

function lineOf(src, index) {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// The node record — the one shape everything uses
// ─────────────────────────────────────────────────────────────────────────────

/** id is always `<type>:<slug>`. Edges carry a REASON so a page can say why the road
 *  exists, and a reader can judge it. */
export function makeNode(fields) {
  return {
    id: fields.id,
    type: fields.type,
    label: fields.label ?? fields.id,
    standing: STANDINGS.includes(fields.standing) ? fields.standing : 'proposed',
    standing_source: fields.standing_source ?? 'defaulted',
    summary: fields.summary ?? '',
    body: fields.body ?? '',
    source_path: fields.source_path ?? '',
    source_line: fields.source_line ?? null,
    quote: fields.quote ?? '',
    tags: fields.tags ?? [],
    edges: fields.edges ?? [], // [{ to, why }]
    extra: fields.extra ?? {}, // type-specific detail, rendered on the page
    origin: fields.origin ?? 'derived', // 'mined' (a knowledge file) | 'derived' (the tree)
  };
}

/** `kind` separates an IDEA-level road from a FILE-level one. A document that names
 *  `docs/KINGDOM.md` has a relationship with the FILE, not with each of the twenty-five
 *  laws mined out of it — those citations are collapsed onto the file's own page and
 *  rendered apart, so they never drown the roads that carry meaning. */
function addEdge(node, to, why, kind = 'idea') {
  if (!to || to === node.id) return;
  if (node.edges.some((e) => e.to === to && e.why === why)) return;
  node.edges.push({ to, why, kind });
}

// ─────────────────────────────────────────────────────────────────────────────
// The hand-mined half — knowledge/*.json
// ─────────────────────────────────────────────────────────────────────────────

export const KNOWLEDGE_FILES = ['laws.json', 'facts.json', 'decisions.json', 'entities.json', 'artifacts.json'];

/** The mined files are written by another hand and may arrive in any of three honest
 *  shapes: a bare array, `{ items|nodes|laws|facts|… : [...] }`, or an object keyed by
 *  id. All three are read; nothing is authored here. */
export function normalizeKnowledgeDoc(doc) {
  if (!doc || doc.__parseError) return [];
  if (Array.isArray(doc)) return doc.filter((x) => x && typeof x === 'object');
  const arrayKey = Object.keys(doc).find((k) => Array.isArray(doc[k]));
  if (arrayKey) return doc[arrayKey].filter((x) => x && typeof x === 'object');
  return Object.entries(doc)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([k, v]) => (v.id ? v : { id: k, ...v }));
}

/** Read whatever knowledge exists. Returns the records AND the roll of what was absent,
 *  so the compile verb can report the gap instead of hiding it. */
export function loadKnowledge() {
  const dir = path.join(REPO, 'knowledge');
  const present = {};
  const missing = [];
  const broken = [];
  for (const name of KNOWLEDGE_FILES) {
    const abs = path.join(dir, name);
    if (!fs.existsSync(abs)) {
      missing.push(`knowledge/${name}`);
      continue;
    }
    const doc = readJson(abs);
    if (doc && doc.__parseError) {
      broken.push(`knowledge/${name}: ${doc.__parseError}`);
      continue;
    }
    present[name] = normalizeKnowledgeDoc(doc);
  }
  // Anything else the mining hand chose to write is read too.
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.json') || present[name] || KNOWLEDGE_FILES.includes(name)) continue;
      const doc = readJson(path.join(dir, name));
      if (doc && doc.__parseError) broken.push(`knowledge/${name}: ${doc.__parseError}`);
      else present[name] = normalizeKnowledgeDoc(doc);
    }
  }
  return { present, missing, broken };
}

const FILE_DEFAULT_TYPE = {
  'laws.json': 'law',
  'facts.json': 'fact',
  'decisions.json': 'decision',
  'entities.json': 'entity',
};

/** The manifest declares every root path on two axes. Read it into a plain
 *  `path → { kind, standing }` map, whatever shape it arrived in. */
export function artifactDeclarations(knowledge) {
  const rows = knowledge.present['artifacts.json'] || [];
  const byPath = new Map();
  for (const r of rows) {
    // The mining hand may name the path in any of these; `source_path` is the node
    // record's own field and is the one this repo actually writes.
    let p = r.path || r.file || r.root || r.source_path || '';
    if (!p && typeof r.id === 'string' && r.id.includes(':')) p = r.id.slice(r.id.indexOf(':') + 1);
    if (!p) continue;
    p = String(p).replace(/^\.\//, '').replace(/\/+$/, '');
    byPath.set(p, { kind: r.kind || r.type || '', standing: r.standing || '', raw: r });
  }
  return byPath;
}

function knowledgeNodes(knowledge) {
  const nodes = [];
  for (const [file, rows] of Object.entries(knowledge.present)) {
    // The manifest is read twice over: once here, so every declared root path gets a page
    // saying what it IS, and once as `artifactDeclarations` for kind and standing lookup.
    const fallbackType = FILE_DEFAULT_TYPE[file] || file.replace(/\.json$/, '').replace(/s$/, '');
    for (const r of rows) {
      let id = r.id;
      let type = r.type || fallbackType;
      if (typeof id === 'string' && id.includes(':')) type = r.type || id.slice(0, id.indexOf(':'));
      else if (id) id = `${type}:${slugify(String(id))}`;
      else id = `${type}:${slugify(r.label || r.name || 'unnamed')}`;
      const node = makeNode({
        id,
        type,
        label: r.label || r.name || id,
        standing: r.standing,
        // Name the file the standing actually came from — crediting the wrong source is a
        // small lie of exactly the kind this Book exists to stop.
        standing_source: r.standing ? `knowledge/${file}` : 'defaulted',
        summary: r.summary || r.meaning || '',
        body: r.body || '',
        source_path: r.source_path || (r.sources && r.sources[0] && r.sources[0].doc) || '',
        source_line: r.source_line ?? null,
        quote: r.quote || (r.sources && r.sources[0] && r.sources[0].quote) || '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        origin: 'mined',
        // The file this record was mined out of. It is PROVENANCE, not a road: every law
        // is named by `knowledge/laws.json` by construction, so an edge from it carries
        // no information and — worse — guarantees no mined node can ever read as an
        // orphan. Suppressed in the stitch; the frontmatter and footer already say it.
        extra: { ...minedExtra(r), mined_from: `knowledge/${file}` },
      });
      for (const to of Array.isArray(r.links) ? r.links : []) addEdge(node, to, `declared in \`knowledge/${file}\``);
      nodes.push(node);
    }
  }
  return nodes;
}

function minedExtra(r) {
  const keep = ['kind', 'value', 'unit', 'scope', 'default', 'band', 'successor', 'superseded_by', 'decided', 'date'];
  const out = {};
  for (const k of keep) if (r[k] !== undefined) out[k] = r[k];
  if (Array.isArray(r.sources) && r.sources.length > 1) out.sources = r.sources;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// The derived half — what the filesystem can prove
// ─────────────────────────────────────────────────────────────────────────────

const CODE_EXT = ['.ts', '.tsx', '.mts', '.mjs'];

/** A module node exists only for code under `src/`. A stylesheet, a JSON fixture or a
 *  harness script is a real import and a real file, but there is no page for it — so
 *  there is no edge either. It is recorded on the page as an asset instead of being
 *  dropped silently or dangled. */
function isModuleFile(rel) {
  return !!rel && rel.startsWith('src/') && CODE_EXT.some((e) => rel.endsWith(e));
}

function exportedSymbols(src) {
  const names = new Set();
  const decl =
    /^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = decl.exec(src))) names.add(m[1]);
  const braced = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;
  while ((m = braced.exec(src))) {
    for (const part of m[1].split(',')) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits[1] || bits[0] || '').trim().replace(/^type\s+/, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default') names.add(name);
    }
  }
  if (/^export\s+default\s+function\s*\(/m.test(src)) names.add('default');
  return [...names].sort();
}

function importSpecifiers(src) {
  const out = new Set();
  const re = /(?:^|\n)\s*(?:import|export)[\s\S]{0,300}?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  const bare = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
  while ((m = bare.exec(src))) out.add(m[1]);
  const dyn = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dyn.exec(src))) out.add(m[1]);
  return [...out];
}

/** Resolve a relative specifier to a real file in the tree, or null. Only real files
 *  become edges — an unresolved specifier (a package, a virtual module) is dropped. */
function resolveImport(fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(REPO, path.dirname(fromRel), spec);
  const tries = [base];
  for (const e of CODE_EXT) tries.push(base + e);
  for (const e of CODE_EXT) tries.push(path.join(base, 'index' + e));
  if (/\.jsx?$/.test(base)) for (const e of CODE_EXT) tries.push(base.replace(/\.jsx?$/, e));
  for (const t of tries) {
    try {
      if (fs.statSync(t).isFile()) return path.relative(REPO, t);
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/** A file the tree can read, turned into a page. `adopted` marks a file OUTSIDE `src/`
 *  that only exists here because a hand-mined record named it — a law that leans on a
 *  workflow file, say. Adopting it is better than a road to nowhere. */
function moduleNodeFor(rel, declByPath, { adopted = false } = {}) {
  const abs = path.join(REPO, rel);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  const huge = stat.size > 2_000_000;
  const src = huge ? '' : readText(abs) || '';
  const lines = huge ? null : src.split('\n').length;
  const symbols = huge ? [] : exportedSymbols(src);
  const resolved = huge
    ? []
    : importSpecifiers(src)
        .map((s) => ({ spec: s, rel: resolveImport(rel, s) }))
        .filter((x) => x.rel);
  const imports = resolved.filter((x) => isModuleFile(x.rel));
  const assets = resolved.filter((x) => !isModuleFile(x.rel)).map((x) => x.rel);
  const decl = declByPath.get(rel) || declByPath.get(rel.split('/')[0]);
  const node = makeNode({
    id: `module:${rel}`,
    type: 'module',
    label: rel,
    standing: decl && decl.standing ? decl.standing : 'built',
    standing_source: decl && decl.standing ? 'knowledge/artifacts.json' : 'derived',
    summary: huge
      ? `${Math.round(stat.size / 1024)} KB — too large to read; only its existence is claimed here.`
      : `${lines} lines · ${symbols.length} exported symbol${symbols.length === 1 ? '' : 's'}.`,
    source_path: rel,
    source_line: 1,
    origin: 'derived',
    extra: { lines, symbols, imports: imports.map((i) => i.rel), assets, doc: huge ? '' : leadingDoc(src), adopted, bytes: stat.size },
  });
  for (const i of imports) addEdge(node, `module:${i.rel}`, 'imported by this file');
  // A `.d.ts`/`.d.mts` declaration is the type-face of one implementation file. Same
  // stem, same folder — a literal match, not a guess.
  const twin = rel.match(/^(.*)\.d\.(m?)ts$/);
  if (twin) {
    for (const e of [`.${twin[2]}js`, `.${twin[2]}ts`, '.ts', '.mjs']) {
      const cand = twin[1] + e;
      if (cand !== rel && fs.existsSync(path.join(REPO, cand))) {
        addEdge(node, `module:${cand}`, 'the implementation this declaration file describes (same stem)');
        break;
      }
    }
  }
  return node;
}

function moduleNodes(declByPath) {
  return walkFiles(path.join(REPO, 'src'), { ext: CODE_EXT })
    .map((rel) => moduleNodeFor(rel, declByPath))
    .filter(Boolean);
}

/** The comment block at the head of a file, if it wrote one — the author's own word
 *  about what the module is for. Never invented; empty when absent. */
function leadingDoc(src) {
  const m = src.match(/^(?:﻿)?(?:\/\*\*?([\s\S]*?)\*\/|((?:\/\/[^\n]*\n){1,12}))/);
  if (!m) return '';
  const raw = m[1] || m[2] || '';
  return raw
    .split('\n')
    .map((l) => l.replace(/^\s*(\*+|\/\/)\s?/, '').trimEnd())
    .join('\n')
    .trim()
    .slice(0, 600);
}

/** Read a quoted string that begins at `open` (the quote character itself), following
 *  it across lines if it is a template literal. Returns the RAW source slice — verbatim,
 *  escapes and all — because the quote check re-reads the file and demands it back. */
function readQuoted(src, open) {
  const q = src[open];
  let i = open + 1;
  while (i < src.length) {
    if (src[i] === '\\') i += 2;
    else if (src[i] === q) return { raw: src.slice(open + 1, i), end: i };
    else if (src[i] === '\n' && q !== '`') return null;
    else i++;
  }
  return null;
}

function unescapeJs(s) {
  return s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, ' ');
}

/** Find the name of a table-driven call — `it.each([...])( 'name %s', … )`. The name sits
 *  after the table, not after the opening paren, so the plain match misses it. Look a
 *  short way ahead for the `)(` that opens the real call and take the quote that follows.
 *  Bounded on purpose: it will not chase a name written a page away. */
function eachName(src, from) {
  const window = src.slice(from, from + 600);
  const m = window.match(/\)\s*\(\s*(['"`])/);
  if (!m) return null;
  return readQuoted(src, from + m.index + m[0].length - 1);
}

/** One node per `it(…)` / `test(…)` in `test/*.test.ts`. These are the rules the
 *  kingdom actually ENFORCES — the only claims in the repo that a machine re-checks
 *  every run. Ancestry is read by indentation (see honest limit 3). */
function invariantNodes() {
  const files = walkFiles(path.join(REPO, 'test'), { ext: ['.test.ts', '.test.tsx'] });
  const nodes = [];
  for (const rel of files) {
    const src = readText(path.join(REPO, rel)) || '';
    const lines = src.split('\n');
    const direct = importSpecifiers(src)
      .map((s) => resolveImport(rel, s))
      .filter(Boolean);
    const imports = direct.filter(isModuleFile).map((r) => ({ rel: r, via: null }));
    // One hop through a test helper (`test/invariants.ts`, `test/fixtures.ts`): the suite
    // reaches the domain through it, and without this hop those suites look untethered.
    for (const helper of direct.filter((r) => r.startsWith('test/'))) {
      const hsrc = readText(path.join(REPO, helper));
      if (!hsrc) continue;
      for (const r of importSpecifiers(hsrc).map((s) => resolveImport(helper, s)).filter(isModuleFile)) {
        if (!imports.some((i) => i.rel === r)) imports.push({ rel: r, via: helper });
      }
    }
    const stack = []; // [{ indent, name }]
    let seq = 0;
    let offset = 0;
    for (let ln = 0; ln < lines.length; ln++) {
      const line = lines[ln];
      const lineStart = offset;
      offset += line.length + 1;
      const m = line.match(/^(\s*)(describe|it|test)((?:\.\w+)*)\s*\(\s*(['"`])?/);
      if (!m) continue;
      const indent = m[1].length;
      let got;
      if (m[4]) {
        got = readQuoted(src, lineStart + line.indexOf(m[4], m[1].length + m[2].length + m[3].length));
      } else if (m[3]) {
        // `it.each([…])('name', …)` — the name sits after the table.
        got = eachName(src, lineStart + m[0].length - 1);
      }
      if (!got) continue;
      const raw = got.raw;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      if (m[2] === 'describe') {
        stack.push({ indent, name: unescapeJs(raw) });
        continue;
      }
      const ancestry = stack.map((s) => s.name);
      const name = unescapeJs(raw);
      const node = makeNode({
        id: `invariant:${slugify(path.basename(rel, '.test.ts'))}-${String(++seq).padStart(3, '0')}-${slugify(name, 48)}`,
        type: 'invariant',
        label: name,
        standing: 'built',
        standing_source: 'derived',
        summary: ancestry.length ? `${ancestry.join(' › ')} — ${name}` : name,
        source_path: rel,
        source_line: ln + 1,
        quote: raw,
        origin: 'derived',
        extra: { ancestry, suite: rel, imports: imports.map((i) => i.rel) },
      });
      for (const im of imports) {
        addEdge(
          node,
          `module:${im.rel}`,
          im.via
            ? `reached by the test FILE through its helper \`${im.via}\` (shared source, not a claim about this one test)`
            : 'imported by the test FILE (shared source, not a claim about this one test)',
        );
      }
      nodes.push(node);
    }
  }
  return nodes;
}

function docTitle(src, rel) {
  const m = src.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : path.basename(rel, '.md');
}

/** The first real paragraph after the title — the doc's own statement of purpose,
 *  taken verbatim so the quote check can hold it to account. */
function firstParagraph(src) {
  const body = src.replace(/^#\s+.+$/m, '');
  const blocks = body.split(/\n\s*\n/);
  for (const b of blocks) {
    const t = b.trim();
    if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('```')) continue;
    return t;
  }
  return '';
}

function writNodes(declByPath) {
  const dir = path.join(REPO, 'docs');
  const rels = walkFiles(dir, { ext: ['.md'] });
  const nodes = [];
  for (const rel of rels) {
    const src = readText(path.join(REPO, rel)) || '';
    const base = path.basename(rel);
    const decl = declByPath.get(rel) || declByPath.get('docs');
    let standing = decl && decl.standing ? decl.standing : null;
    let standingSource = standing ? 'knowledge/artifacts.json' : 'defaulted';
    if (!standing) standing = base === 'KINGDOM.md' ? 'canon' : 'proposed';
    const title = docTitle(src, rel);
    const para = firstParagraph(src);
    const headings = [...src.matchAll(/^(#{2,6})\s+(.+)$/gm)].map((m) => ({ depth: m[1].length, text: m[2].trim() }));
    nodes.push(
      makeNode({
        id: `writ:${rel}`,
        type: 'writ',
        label: title,
        standing,
        standing_source: standingSource,
        summary: normalizeWs(para).slice(0, 300),
        source_path: rel,
        source_line: 1,
        quote: para,
        origin: 'derived',
        extra: { headings, file: rel, lines: src.split('\n').length },
      }),
    );
  }
  return nodes;
}

/** A surface is a top-level React view — the places a person actually stands. A surface
 *  node and the module node for the same file are two projections of one file, and each
 *  page says so. */
function surfaceNodes() {
  const rels = walkFiles(path.join(REPO, 'src'), { ext: ['.tsx'] });
  const nodes = [];
  for (const rel of rels) {
    const base = path.basename(rel, '.tsx');
    const topLevel = rel.split('/').length === 2;
    const isView = /View$/.test(base) || base === 'App' || (topLevel && /^[A-Z]/.test(base));
    if (!isView) continue;
    const src = readText(path.join(REPO, rel)) || '';
    const imports = importSpecifiers(src)
      .map((s) => resolveImport(rel, s))
      .filter(isModuleFile);
    const node = makeNode({
      id: `surface:${rel}`,
      type: 'surface',
      label: base,
      standing: 'built',
      standing_source: 'derived',
      summary: `React view in \`${rel}\` — ${src.split('\n').length} lines.`,
      source_path: rel,
      source_line: 1,
      origin: 'derived',
      extra: { file: rel, doc: leadingDoc(src) },
    });
    addEdge(node, `module:${rel}`, 'the same file, read as code');
    for (const im of imports) addEdge(node, `module:${im}`, 'imported by this view');
    nodes.push(node);
  }
  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// The literal-match pass — where the halves are stitched, and only there
// ─────────────────────────────────────────────────────────────────────────────

const NOISE_LABELS = new Set(['the kingdom', 'the crown', 'the court', 'handoff', 'kingdom']);

/** Cross-link on LITERAL identifiers only: an id, a source path, an exported symbol.
 *  Never on prose similarity — the writ forbids invented edges. */
function stitch(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const targets = [...byId.values()];

  // Ids are unambiguous — hunted at any length, in any text.
  const idNeedles = targets.map((n) => ({ node: n, needle: n.id }));
  // A PATH names a FILE. It resolves only to the node that IS that file — its module,
  // its writ, its surface, its manifest artifact — and NEVER to the laws, facts, entities
  // or decisions extracted out of it. Fanning a path citation across every extract was
  // true and useless: because `docs/KINGDOM.md` is the constitution, nearly every document
  // cites it, so nearly everything backlinked to nearly every law mined from it and the
  // real roads drowned. The citations now collapse onto the file's own page, once.
  const WHOLE_FILE_TYPES = new Set(['module', 'writ', 'surface', 'artifact']);
  // A bare directory name (`src`, `test`, `data`) matches ordinary prose everywhere; a
  // path with a slash or a file extension does not.
  const isPathNeedle = (p) => p.includes('/') || /\.[A-Za-z0-9]+$/.test(p);
  const pathNeedles = targets
    .filter((n) => WHOLE_FILE_TYPES.has(n.type) && n.source_path && isPathNeedle(n.source_path))
    .map((n) => ({ node: n, needle: n.source_path }));
  // Labels only for the kinds whose label is a NAME, never for invariants (whose
  // label is a whole prose sentence and would match nothing but noise).
  const labelNeedles = targets
    .filter(
      (n) =>
        ['law', 'fact', 'decision', 'entity', 'act'].includes(n.type) &&
        n.label &&
        n.label.length >= LABEL_MIN &&
        !NOISE_LABELS.has(n.label.toLowerCase()),
    )
    .map((n) => ({ node: n, re: new RegExp(`(?:^|[^\\w-])${escapeRe(n.label)}(?:$|[^\\w-])`, 'i') }));
  // Exported symbols, for docs and tests that name the code by its true name.
  const symbolNeedles = [];
  for (const n of targets) {
    if (n.type !== 'module') continue;
    for (const s of n.extra.symbols || []) {
      if (!isIdentifierShaped(s)) continue;
      symbolNeedles.push({ node: n, symbol: s, re: new RegExp(`(?:^|[^\\w$])${escapeRe(s)}(?:$|[^\\w$])`) });
    }
  }

  const scanText = (src, from, why) => {
    for (const { node, needle } of idNeedles) if (node !== from && src.includes(needle)) addEdge(from, node.id, `${why} names \`${needle}\` literally`);
    for (const { node, needle } of pathNeedles) if (node !== from && src.includes(needle)) addEdge(from, node.id, `${why} names the file \`${needle}\` by path`, 'file');
    for (const { node, re } of labelNeedles) if (node !== from && re.test(src)) addEdge(from, node.id, `${why} names "${node.label}" literally`);
    for (const { node, symbol, re } of symbolNeedles) if (node !== from && re.test(src)) addEdge(from, node.id, `${why} names the exported symbol \`${symbol}\``);
  };

  // Writs read the whole tree's vocabulary.
  for (const n of targets) {
    if (n.type !== 'writ') continue;
    const src = readText(path.join(REPO, n.source_path));
    if (src) scanText(src, n, 'this writ');
  }
  // Code names ids (a `fact:` reference in a guard, a `law:` in a comment).
  for (const n of targets) {
    if (n.type !== 'module') continue;
    const src = readText(path.join(REPO, n.source_path));
    if (!src) continue;
    for (const { node, needle } of idNeedles) {
      if (node === n || node.type === 'module' || node.type === 'invariant') continue;
      // Never let a record's OWN defining file count as a road to it. `knowledge/laws.json`
      // names every law id by construction; an edge from it is provenance wearing a road's
      // clothes, and it would make every mined page un-orphanable no matter how truly
      // unreferenced it is. Provenance already stands in the frontmatter and the footer.
      if (node.extra && node.extra.mined_from === n.source_path) continue;
      if (src.includes(needle)) addEdge(n, node.id, `this module names \`${needle}\` literally`);
    }
  }
  // A test's own name may cite an id outright.
  for (const n of targets) {
    if (n.type !== 'invariant') continue;
    const hay = `${n.label} ${n.summary}`;
    for (const { node, needle } of idNeedles) {
      if (node === n || node.type === 'invariant') continue;
      if (hay.includes(needle)) addEdge(n, node.id, `the test name cites \`${needle}\``);
    }
  }
  // Mined nodes point at code by path or symbol; honour what they wrote.
  for (const n of targets) {
    if (n.origin !== 'mined') continue;
    const hay = `${n.summary}\n${n.body}\n${n.quote}`;
    for (const { node, needle } of pathNeedles) if (node !== n && hay.includes(needle)) addEdge(n, node.id, `names the file \`${needle}\` by path`, 'file');
    for (const { node, symbol, re } of symbolNeedles) if (node !== n && re.test(hay)) addEdge(n, node.id, `names the exported symbol \`${symbol}\``);
  }

  // Two pages about the SAME FILE are two views of one thing — the manifest's artifact
  // and the doc's writ, a surface and its module. Same path is a literal match by
  // definition, not a guess. Invariants are held out: hundreds of them share one test
  // file, and linking each to each would be noise, not knowledge.
  const byPath = new Map();
  for (const n of targets) {
    if (!n.source_path || n.type === 'invariant') continue;
    if (!byPath.has(n.source_path)) byPath.set(n.source_path, []);
    byPath.get(n.source_path).push(n);
  }
  for (const [p, group] of byPath) {
    if (group.length < 2 || group.length > 12) continue;
    for (const a of group) {
      for (const b of group) {
        if (a === b || a.type === b.type) continue;
        addEdge(a, b.id, `the same file \`${p}\`, seen as a ${b.type} rather than a ${a.type}`);
      }
    }
  }

  // Drop edges to nodes that do not exist (a mined `links` entry may name a stranger).
  const unresolved = [];
  for (const n of targets) {
    const kept = [];
    for (const e of n.edges) {
      if (byId.has(e.to)) kept.push(e);
      else unresolved.push({ from: n.id, to: e.to });
    }
    n.edges = kept;
  }
  return unresolved;
}

/** Every page needs a name no other page holds — collisions are broken by type, then
 *  by a slice of the id, deterministically, so two runs name the same page the same. */
export function assignPages(nodes) {
  const byName = new Map();
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  for (const n of sorted) {
    let name = String(n.label || n.id).replace(/[\[\]|#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || n.id;
    if (byName.has(name)) name = `${name} (${n.type})`;
    if (byName.has(name)) name = `${name} ${n.id.split(':').pop().slice(0, 12)}`;
    let guard = 2;
    while (byName.has(name)) name = `${name} ${guard++}`;
    byName.set(name, n);
    n.page = name;
  }
  const bySlug = new Map();
  for (const n of sorted) {
    const dir = TYPE_DIRS[n.type] || `${n.type}s`;
    let slug = slugify(n.page);
    let key = `${dir}/${slug}`;
    let guard = 2;
    while (bySlug.has(key)) key = `${dir}/${slug}-${guard++}`;
    bySlug.set(key, n);
    n.file = `book/${key}.md`;
  }
  return byName;
}

// ─────────────────────────────────────────────────────────────────────────────
// The whole graph, in one call
// ─────────────────────────────────────────────────────────────────────────────

export function buildGraph() {
  const knowledge = loadKnowledge();
  const declByPath = artifactDeclarations(knowledge);
  const nodes = [
    ...knowledgeNodes(knowledge),
    ...moduleNodes(declByPath),
    ...invariantNodes(),
    ...writNodes(declByPath),
    ...surfaceNodes(),
  ];
  // Two hands may mint the same id; the mined record wins, being the deliberate one.
  const byId = new Map();
  const duplicates = [];
  for (const n of nodes) {
    const seen = byId.get(n.id);
    if (!seen) byId.set(n.id, n);
    else if (n.origin === 'mined' && seen.origin !== 'mined') byId.set(n.id, n);
    else duplicates.push(n.id);
  }
  let kept = [...byId.values()];
  // A mined record may lean on a real file outside `src/` — a workflow, a harness script,
  // a data fixture. The file exists, so adopt it as a page rather than drop the road.
  const adopted = [];
  for (const n of kept) {
    if (n.origin !== 'mined') continue;
    for (const e of n.edges) {
      if (!e.to.startsWith('module:') || byId.has(e.to)) continue;
      const rel = e.to.slice('module:'.length);
      if (adopted.some((a) => a.id === e.to)) continue;
      const made = moduleNodeFor(rel, declByPath, { adopted: true });
      if (made) {
        byId.set(made.id, made);
        adopted.push(made);
      }
    }
  }
  kept = kept.concat(adopted);
  const unresolved = stitch(kept);
  const backlinks = new Map(kept.map((n) => [n.id, []]));
  for (const n of kept) for (const e of n.edges) backlinks.get(e.to).push({ from: n.id, why: e.why, kind: e.kind });
  for (const n of kept) n.backlinks = backlinks.get(n.id);
  assignPages(kept);
  return {
    nodes: kept,
    byId,
    knowledge,
    declByPath,
    missingKnowledge: knowledge.missing,
    brokenKnowledge: knowledge.broken,
    unresolvedLinks: unresolved,
    duplicateIds: duplicates,
  };
}

export function countBy(nodes, key) {
  const out = {};
  for (const n of nodes) out[n[key]] = (out[n[key]] || 0) + 1;
  return out;
}

/** Degree = roads in plus roads out. The load-bearing nodes are the ones the rest of
 *  the kingdom leans on, and the map names them first. */
export function degree(n) {
  return n.edges.length + (n.backlinks ? n.backlinks.length : 0);
}

export function lineNumberOf(src, index) {
  return lineOf(src, index);
}
