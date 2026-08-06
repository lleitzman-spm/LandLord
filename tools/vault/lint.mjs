// LINT — every way the Great Book can quietly rot, in one command.
// `node tools/vault/lint.mjs [--strict]`   (see `docs/WRIT-THE-GREAT-BOOK.md`)
//
// WHY THIS EXISTS
// Three "beta blockers" sat in `HANDOFF.md` marked open for FIVE SESSIONS after they were
// closed, built and deployed — a line copied forward that nobody re-checked, because
// checking meant reading the code and the live systems and comparing them to the prose by
// eye. This command is that eye, and it never gets tired. It re-derives the evidence
// against the source of truth so a fan-out of many builders can be trusted without reading
// many reports: builders return counts, this re-checks the counts.
//
// WHAT IT LOOKS FOR
//   1. DANGLING LINKS  — a wikilink with no target. Fatal: a road that goes nowhere.
//   2. ORPHANS         — a page nothing points at. Checked HERE AND NOWHERE ELSE, and it
//                        matters most: a dangling link gets caught because it looks broken;
//                        an orphan never looks like anything. It exists, it is correct, and
//                        no reader will ever reach it, so they conclude the subject is not
//                        covered — and build it a second time. (The leasing clerk was built
//                        twice exactly this way.)
//   3. UNDECLARED PATHS— a root path on disk absent from `knowledge/artifacts.json`, and a
//                        declaration pointing at nothing.
//   4. QUOTES          — every `source_path` is re-read off disk and its `quote` must
//                        appear verbatim, whitespace-normalised (markdown wraps). NO QUOTE,
//                        NO OBJECT: a quote that does not appear is not a weak claim, it is
//                        a hallucination with a schema.
//   5. STANDING DRIFT  — anything `proposed` whose own text claims it is done; anything
//                        `built` with no module or invariant beneath it; anything `retired`
//                        that names no successor.
//   6. LITERALS IN GUARDS — a governing number typed into an expression instead of declared
//                        in `knowledge/facts.json`. A bare number has nowhere to put "varies
//                        by contract", so whoever writes each site picks a value and moves
//                        on, and the drift is invisible.
//
// HONEST LIMITS
//   · The literal scan reads shapes, not meaning. It blanks comments and strings first, so
//     it will not flag a number in prose — but it cannot tell a fee cap from a retry count.
//     It is a WARNING on purpose: this repo predates the rule and a wall of red helps
//     nobody. It counts them and names the worst offenders so the debt has a size.
//   · The "claims it is done" scan is word-spotting. It finds the shape of the HANDOFF lie,
//     not the lie itself. Read every hit; some are innocent.
//   · Orphan-hunting counts a link in a Backlinks section as a road, because a reader can
//     walk it — but it reports those separately, since nothing DELIBERATELY points there.
//
// Exit 0 on warnings, 1 on fatal findings. `--strict` makes everything fatal.
// Pure Node. No install, ever.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  REPO,
  BOOK,
  buildGraph,
  readText,
  walkFiles,
  normalizeWs,
  stripCommentsAndStrings,
  artifactDeclarations,
} from './lib.mjs';

const STRICT = process.argv.includes('--strict');
const findings = { fatal: [], warn: [] };
const say = (level, check, msg) => findings[STRICT ? 'fatal' : level].push({ check, msg });
const fatal = (check, msg) => findings.fatal.push({ check, msg });
const warn = (check, msg) => say('warn', check, msg);

/** Numbers that govern nothing: an empty count, a single step, a not-found, a percentage
 *  whole. Everything else in a guard is a decision somebody made in silence. */
const HARMLESS = new Set(['0', '1', '-1', '100', '0.0', '1.0']);

// ─────────────────────────────────────────────────────────────────────────────
// Reading the Book off disk (never from the compiler's memory — the pages are
// what a reader actually gets)
// ─────────────────────────────────────────────────────────────────────────────

function parseFrontmatter(src) {
  if (!src.startsWith('---')) return {};
  const end = src.indexOf('\n---', 3);
  if (end === -1) return {};
  const out = {};
  let key = null;
  for (const line of src.slice(4, end).split('\n')) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      (out[key] = Array.isArray(out[key]) ? out[key] : []).push(unq(item[1]));
      continue;
    }
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    key = m[1];
    out[key] = m[2].trim() === '' ? [] : unq(m[2]);
  }
  return out;
}

function unq(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return JSON.parse(s.replace(/^'|'$/g, '"'));
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

function loadBookPages() {
  if (!fs.existsSync(BOOK)) return [];
  return walkFiles(BOOK, { ext: ['.md'] }).map((rel) => {
    const src = readText(path.join(REPO, rel)) || '';
    const fm = parseFrontmatter(src);
    const h1 = (src.match(/^#\s+(.+)$/m) || [])[1];
    const title = fm.title || h1 || path.basename(rel, '.md');
    const names = new Set([title]);
    for (const a of Array.isArray(fm.aliases) ? fm.aliases : fm.aliases ? [fm.aliases] : []) names.add(a);
    if (fm.id) names.add(fm.id);
    return { rel, src, fm, title, names, type: fm.type || 'page' };
  });
}

/** Pull every wikilink out of a page, remembering the heading it stood under — a link in a
 *  Backlinks section is a road a reader can walk, but nothing DELIBERATELY put it there. */
function linksOf(page) {
  const out = [];
  let heading = '';
  let inBacklinks = false;
  for (const line of page.src.split('\n')) {
    const h = line.match(/^(#{2,6})\s+(.*)$/);
    if (h) {
      heading = h[2].trim();
      // Only a top-level `##` opens or closes a reverse-listing region — its `###`
      // sub-headings (Modules, Invariants…) stand INSIDE it and must not escape.
      // "Documents that cite this source" is a reverse listing too: it names the pages
      // that point HERE, so a link in it is not this page deliberately pointing there.
      if (h[1].length === 2) inBacklinks = /^(backlinks|documents that cite this source)$/i.test(heading);
    }
    for (const m of line.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
      out.push({ target: m[1].trim(), heading, backRoad: inBacklinks });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 + 2 — dangling links and orphans
// ─────────────────────────────────────────────────────────────────────────────


/** ORPHANS THAT ARE EXPECTED, WITH REASONS — and the strong temptation not to.
 *
 *  The obvious way to clear an orphan is to have every source document link the
 *  objects mined from it. That was tried in the sibling repo and it is a trap: it
 *  makes every mined page un-orphanable by construction, and the orphan check —
 *  the one check that catches a page nobody can reach — silently stops meaning
 *  anything. It was removed there for exactly that reason and is not coming back
 *  here.
 *
 *  So orphans get classified, never manufactured. Repo furniture is genuinely
 *  unreferenced and always will be: nothing in a property-management Book has any
 *  business linking to `.gitignore`. Naming those keeps the count honest, so the
 *  ones that remain are real — a decision or a law nothing cites is a live signal
 *  that it is disconnected from the work, and that is worth seeing. */
const EXPECTED_ORPHANS = {
  'book/artifacts/contributing-md.md': 'repo furniture — contribution process, not domain knowledge',
  'book/artifacts/github.md': 'repo furniture — CI configuration',
  'book/artifacts/gitignore.md': 'repo furniture — nothing in a Book links to an ignore file',
  'book/artifacts/license.md': 'repo furniture — the licence governs the repo, not the domain',
  'book/artifacts/security-md.md': 'repo furniture — disclosure policy',
  'book/artifacts/tsconfig-json.md': 'repo furniture — compiler configuration',
  'book/artifacts/vite-config-ts.md': 'repo furniture — bundler configuration',
  'book/artifacts/vitest-config-ts.md': 'repo furniture — test-runner configuration',
};

function checkLinksAndOrphans(pages) {
  const byName = new Map();
  for (const p of pages) for (const n of p.names) if (!byName.has(n)) byName.set(n, p);

  const inbound = new Map(pages.map((p) => [p.rel, { hard: new Set(), back: new Set() }]));
  let dangling = 0;
  for (const p of pages) {
    for (const l of linksOf(p)) {
      const target = byName.get(l.target);
      if (!target) {
        dangling++;
        fatal('dangling', `${p.rel} → [[${l.target}]] resolves to nothing`);
        continue;
      }
      if (target.rel === p.rel) continue;
      inbound.get(target.rel)[l.backRoad ? 'back' : 'hard'].add(p.rel);
    }
  }

  // The map and the start page point by rule, not by meaning; they cannot rescue a page
  // from orphanhood or the check would always pass.
  const byRule = (rel) => /^book\/maps\/INDEX\.md$/.test(rel) || /^book\/00 START HERE\.md$/.test(rel);
  const orphans = [];
  const backOnly = [];
  // The sharpest measure of the three: a page whose own Backlinks section is EMPTY. It may
  // still be reachable — some other page's reverse listing may name it — but nothing in
  // the Book points at the IDEA. This is the number that path-coincidence edges used to
  // hide, and it is the one to watch.
  const unpointed = [];
  for (const p of pages) {
    if (byRule(p.rel)) continue;
    const inb = inbound.get(p.rel);
    const hard = [...inb.hard].filter((r) => !byRule(r));
    const back = [...inb.back].filter((r) => !byRule(r));
    if (!hard.length && !back.length) orphans.push(p);
    else if (!hard.length) backOnly.push(p);
    const after = p.src.split(/^## Backlinks$/m)[1];
    if (after !== undefined && !/^- \[\[/m.test(after.split(/^## /m)[0])) unpointed.push(p);
  }
  const byType = (list) => {
    const m = {};
    for (const p of list) m[p.type] = (m[p.type] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ') || 'none';
  };
  const expected = orphans.filter((p) => EXPECTED_ORPHANS[p.rel]);
  const unexpected = orphans.filter((p) => !EXPECTED_ORPHANS[p.rel]);
  // A declaration that stops being true is worse than no declaration: if a page
  // named here gains a road, the entry is stale and says so.
  for (const rel of Object.keys(EXPECTED_ORPHANS)) {
    const p = pages.find((x) => x.rel === rel);
    if (p && !orphans.includes(p)) {
      warn('orphans', `${rel} is declared an EXPECTED orphan but something now points at it — drop the declaration`);
    }
  }
  if (expected.length) {
    warn('orphans', `${expected.length} expected orphan(s) — repo furniture, declared with reasons, not counted as debt`);
  }
  if (unexpected.length) {
    warn('orphans', `${unexpected.length} page(s) nothing points at — ${byType(unexpected)}`);
    for (const p of unexpected.slice(0, 25)) warn('orphans', `    ${p.rel}`);
    if (unexpected.length > 25) warn('orphans', `    …and ${unexpected.length - 25} more`);
  }
  if (backOnly.length) {
    warn('orphans', `${backOnly.length} page(s) reachable ONLY through a Backlinks section — ${byType(backOnly)}`);
  }
  if (unpointed.length) {
    warn('orphans', `${unpointed.length} page(s) whose Backlinks section is EMPTY — nothing in the Book points at the idea — ${byType(unpointed)}`);
  }
  return { dangling, orphans: unexpected.length, expectedOrphans: expected.length, backOnly: backOnly.length, unpointed: unpointed.length, pages: pages.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — undeclared paths
// ─────────────────────────────────────────────────────────────────────────────

function gitIgnored(names) {
  if (!names.length) return new Set();
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: REPO,
      input: names.join('\n'),
      encoding: 'utf8',
    });
    return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
  } catch (err) {
    // git exits 1 when nothing is ignored — that is an answer, not a failure.
    const out = err && err.stdout ? String(err.stdout) : '';
    return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean));
  }
}

function checkDeclarations(graph) {
  const declared = artifactDeclarations(graph.knowledge);
  if (!declared.size) {
    warn(
      'manifest',
      'knowledge/artifacts.json declares nothing (absent or empty) — the two-axes check is SKIPPED, not passed. Every root path is meant to be declared on kind and standing.',
    );
    return { undeclared: null, phantom: null };
  }
  const onDisk = fs
    .readdirSync(REPO, { withFileTypes: true })
    .map((e) => e.name)
    .filter((n) => n !== '.git' && n !== 'node_modules');
  const ignored = gitIgnored(onDisk);
  const live = onDisk.filter((n) => !ignored.has(n));

  let undeclared = 0;
  for (const name of live.sort()) {
    if (declared.has(name)) continue;
    undeclared++;
    say('warn', 'manifest', `undeclared at the root: \`${name}\` — declare its kind and standing in knowledge/artifacts.json`);
  }
  let phantom = 0;
  for (const p of [...declared.keys()].sort()) {
    if (fs.existsSync(path.join(REPO, p))) continue;
    phantom++;
    say('warn', 'manifest', `declared but not on disk: \`${p}\` — a declaration pointing at nothing`);
  }
  return { undeclared, phantom };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 — no quote, no object
// ─────────────────────────────────────────────────────────────────────────────

function checkQuotes(graph) {
  const cache = new Map();
  const readNorm = (rel) => {
    if (!cache.has(rel)) {
      const src = readText(path.join(REPO, rel));
      cache.set(rel, src === null ? null : normalizeWs(src));
    }
    return cache.get(rel);
  };
  const isDirOnDisk = (p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  let checked = 0;
  let failed = 0;
  let unsourced = 0;
  for (const n of graph.nodes) {
    if (!n.quote) {
      // A DIRECTORY has no line to quote, and demanding one would be a rule
      // misapplied rather than a rule enforced. `no quote, no object` exists to
      // stop a claim ABOUT something being invented; a manifest row for `src/`
      // makes no such claim — it declares kind and standing, and both are
      // checkable by walking the tree. So a declaration whose source_path is a
      // directory on disk is exempt, and only that. A missing FILE still fails
      // below, and a mined claim with no quote is still fatal.
      const isDirectoryDeclaration =
        n.source_path && isDirOnDisk(path.join(REPO, n.source_path));
      if (n.origin === 'mined' && !isDirectoryDeclaration) {
        unsourced++;
        fatal('quote', `${n.id} carries no quote — no quote, no object`);
      }
      continue;
    }
    if (!n.source_path) {
      failed++;
      fatal('quote', `${n.id} quotes something but names no source_path`);
      continue;
    }
    const hay = readNorm(n.source_path);
    if (hay === null) {
      failed++;
      fatal('quote', `${n.id} cites \`${n.source_path}\`, which is not on disk`);
      continue;
    }
    checked++;
    if (!hay.includes(normalizeWs(n.quote))) {
      failed++;
      fatal(
        'quote',
        `${n.id} — quote not found in \`${n.source_path}\`: "${normalizeWs(n.quote).slice(0, 90)}…"`,
      );
    }
  }
  return { checked, failed, unsourced };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 — standing drift
// ─────────────────────────────────────────────────────────────────────────────

const DONE_WORDS =
  /\b(is (?:now )?(?:built|shipped|live|done|deployed|implemented|complete)|was (?:built|shipped|deployed|implemented)|has shipped|already (?:built|shipped|live)|verified end-to-end|BUILT ✅|DONE ✅)\b/i;

function checkStanding(graph) {
  const out = { claimsDone: 0, unbacked: 0, noSuccessor: 0 };
  for (const n of graph.nodes) {
    const text = `${n.summary}\n${n.body}\n${n.quote}`;
    if (n.standing === 'proposed' && DONE_WORDS.test(text)) {
      out.claimsDone++;
      warn('standing', `${n.id} is PROPOSED but its own text claims it is done — "${(text.match(DONE_WORDS) || [''])[0]}" (${n.source_path})`);
    }
    // A file needs nothing "under it" — it IS the thing, and its own existence is checked
    // by the quote and manifest passes. This check is for CLAIMS: a law, a fact, a
    // decision, a writ that says `built` while nothing in the tree answers for it.
    const isThingItself = ['module', 'invariant', 'surface', 'artifact'].includes(n.type);
    if (n.standing === 'built' && !isThingItself) {
      const near = [...n.edges.map((e) => e.to), ...n.backlinks.map((b) => b.from)];
      const backed = near.some((id) => id.startsWith('module:') || id.startsWith('invariant:') || id.startsWith('surface:'));
      if (!backed) {
        out.unbacked++;
        warn('standing', `${n.id} is BUILT but no module, surface or invariant stands under it — what is the claim checkable against?`);
      }
    }
    if (n.standing === 'retired') {
      const named =
        n.extra.successor ||
        n.extra.superseded_by ||
        /supersed|replaced by|successor/i.test(text) ||
        n.edges.length > 0;
      if (!named) {
        out.noSuccessor++;
        warn('standing', `${n.id} is RETIRED and names no successor — history with no forwarding address`);
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 — literals in guards
// ─────────────────────────────────────────────────────────────────────────────

const OP = /(?<![=!<>+\-*/%&|^])(<=|>=|===|!==|==|!=|<|>)(?![=>])/g;
const NUM_AFTER = /^\s*(-?\d+(?:\.\d+)?)(?![\w.])/;
const NUM_BEFORE = /(?<![\w.$])(-?\d+(?:\.\d+)?)\s*$/;

function checkLiterals(graph) {
  const files = walkFiles(path.join(REPO, 'src', 'domain'), { ext: ['.ts', '.tsx', '.mjs'] }).filter(
    (f) => !f.endsWith('.d.ts') && !f.endsWith('.d.mts'),
  );
  const knownFacts = new Set(graph.nodes.filter((n) => n.type === 'fact').map((n) => n.id));
  const sites = [];
  for (const rel of files) {
    const raw = readText(path.join(REPO, rel)) || '';
    const rawLines = raw.split('\n');
    const code = stripCommentsAndStrings(raw);
    const codeLines = code.split('\n');
    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i];
      OP.lastIndex = 0;
      let m;
      while ((m = OP.exec(line))) {
        const after = line.slice(m.index + m[1].length).match(NUM_AFTER);
        const before = line.slice(0, m.index).match(NUM_BEFORE);
        for (const hit of [after, before]) {
          if (!hit) continue;
          const lit = hit[1];
          if (HARMLESS.has(lit)) continue;
          // A `fact:` named on the line or either side of it discharges the site.
          const near = rawLines.slice(Math.max(0, i - 2), i + 3).join('\n');
          const cited = near.match(/fact:[a-z0-9-]+/i);
          if (cited) {
            if (knownFacts.size && !knownFacts.has(cited[0])) {
              warn('literals', `${rel}:${i + 1} cites \`${cited[0]}\`, which is not in knowledge/facts.json`);
            }
            continue;
          }
          sites.push({ rel, line: i + 1, lit, text: rawLines[i].trim().slice(0, 96) });
          break;
        }
      }
    }
  }
  if (sites.length) {
    const byFile = {};
    for (const s of sites) byFile[s.rel] = (byFile[s.rel] || 0) + 1;
    const worst = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
    warn(
      'literals',
      `${sites.length} numeric literal(s) in comparisons under src/domain/ with no \`fact:\` reference, across ${worst.length} file(s).`,
    );
    warn('literals', `    worst offenders: ${worst.slice(0, 6).map(([f, c]) => `${f} (${c})`).join(', ')}`);
    for (const s of sites.slice(0, 12)) warn('literals', `    ${s.rel}:${s.line}  ${s.lit}   ${s.text}`);
    if (sites.length > 12) warn('literals', `    …and ${sites.length - 12} more`);
  }
  return { sites: sites.length, files: new Set(sites.map((s) => s.rel)).size };
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// EVERY TABLE IS RESOLVED. No page may depend on a plugin to have content.
//
// The Book is a folder of ordinary markdown, so pointing Obsidian at it works with no
// build and no install. That is only true while the pages carry ANSWERS. The tempting
// alternative is to write a Dataview query and let the reader's plugin run it — the
// generator has already evaluated the same thing to build the index, so a query is
// strictly less work and strictly worse: it renders as a grey code block for anyone
// without the plugin, and a vault that is blank until you install something is a vault
// people abandon. It also breaks the one-source rule, because the HTML view and the
// folder view would then compute their tables in two different places at two different
// times.
//
// So the rule is: if the generator can answer it, the generator WRITES the answer. This
// check exists because that property was true by habit and habit is not a guarantee.
function checkResolvedTables(pages) {
  // Fenced blocks whose whole purpose is deferred evaluation by a reader's plugin.
  const DEFERRED = /^```\s*(dataview|dataviewjs|query|tasks|chart|dbfolder)\b/gim;
  let offenders = 0;
  for (const p of pages) {
    DEFERRED.lastIndex = 0;
    const m = p.src.match(DEFERRED);
    if (!m) continue;
    offenders++;
    fatal(
      'resolved',
      `${p.rel} defers ${m.length} table(s) to a plugin (${[...new Set(m.map((s) => s.replace(/^```\s*/, '').trim()))].join(', ')}) — the generator must write the answer instead`,
    );
  }
  return { offenders };
}

/** THE CASCADE MUST AGREE WITH ITS OWN CLOCK.
 *
 *  A flow declares its steps in order, and each step declares WHEN it may start.
 *  Those are two independent statements about the same thing, and until the
 *  operational graph existed nothing had ever compared them. This does: walk each
 *  flow in declared order and flag a step whose earliest start is BEFORE the step it
 *  comes after.
 *
 *  It found real ones on its first run. `move-out-relay` puts `deposit-accounting` at
 *  days 21–30 and then `deposit-transfer` — the very next step — at days 10–12. Read
 *  in order, that is a case moving backwards in time.
 *
 *  WARNING, not fatal, and the reason is itself the finding: `TimingEdge` carries no
 *  ANCHOR. A positive offset counts forward from the trigger and a negative one counts
 *  back from the event, so a flow legitimately mixing "day 3 after notice" with "seven
 *  days before the vacate date" trips this without being wrong. The check cannot be
 *  made exact until the model says which clock each edge hangs off — and naming the
 *  pairs is how a reader discovers that question exists at all. */
function checkCascadeOrder(graph) {
  const flows = graph.nodes.filter((n) => n.type === 'flow');
  let backwards = 0;
  let mixed = 0;
  const start = (s) => {
    const e = (s && s.edge) || {};
    return e.after !== undefined ? e.after : e.before !== undefined ? e.before : null;
  };
  for (const f of flows) {
    const t = (f.extra || {}).flow;
    const steps = t && Array.isArray(t.steps) ? t.steps : [];
    // `TimingEdge.anchor` now says which date an offset counts from, so a flow
    // mixing clocks is only a finding when a step LEAVES IT UNDECLARED. A negative
    // offset with no anchor is the shape that made `pre-inspection` read as
    // permanently breached: the engine defaults it to the case's open date, which
    // is the one date it certainly is not measured from.
    const unanchored = steps.filter((x) => {
      const v = start(x);
      return v !== null && v < 0 && !(x.edge && x.edge.anchor);
    });
    if (unanchored.length) {
      mixed++;
      warn(
        'cascade',
        `${f.id} has ${unanchored.length} step(s) with a NEGATIVE offset and no declared anchor (${unanchored
          .map((x) => `\`${x.key}\``)
          .join(', ')}) — the engine will count them forward from the case's open date, which is the one date they are certainly not measured from, and they will read as breached from the moment they are handed`,
      );
    }
    // A CASCADE IS NOT ONE LINE. A flow runs PARALLEL TRACKS — the move-out board,
    // the deposit board and the leasing board advance alongside each other, and a
    // step on one is not "after" a step on another just because it is written
    // lower in the array. Comparing across boards manufactured findings that were
    // never real (a deposit transfer at day 21 "before" a final walk at day 10 —
    // two different tracks, both correct). Compare within a track, and a track is
    // a board on one clock.
    const trackOf = (x) => `${x.board || ''}|${(x.edge && x.edge.anchor) || 'opened'}`;
    const tracks = new Map();
    for (const x of steps) {
      if (!tracks.has(trackOf(x))) tracks.set(trackOf(x), []);
      tracks.get(trackOf(x)).push(x);
    }
    for (const steps2 of tracks.values()) {
    for (let i = 1; i < steps2.length; i++) {
      const prev = start(steps2[i - 1]);
      const cur = start(steps2[i]);
      if (prev === null || cur === null) continue;
      const steps = steps2;
      if (cur < prev) {
        backwards++;
        warn(
          'cascade',
          `${f.id}: on the ${steps[i].board} board, \`${steps[i].key}\` may start at ${cur} but \`${steps[i - 1].key}\` before it starts at ${prev} — the declared order runs backwards against the clock`,
        );
      }
    }
    }
  }
  return { flows: flows.length, backwards, mixed };
}


/** NO TIMING LITERAL IN THE FLOW BOOK.
 *
 *  All 116 governing numbers now live in `knowledge/facts.json` and `flows.ts`
 *  reads them at load. That is only true until somebody adds a step and types
 *  `slaDays: 5` because it is quicker — and one literal is all it takes for the
 *  file to become a second home, which is the exact shape that put the
 *  owner-approval cap in seven places carrying two values.
 *
 *  FATAL, and cheap: a new step costs one line in `facts.json`. Retrofitting a
 *  hundred does not. */
const TIMING_LITERAL = /\b(slaDays|repeatEveryDays|after|before|onOrAfterDayOfMonth|beforeDayOfMonth)\s*:\s*-?\d/g;
function checkFlowLiterals() {
  const rel = 'src/domain/flows.ts';
  const src = readText(path.join(REPO, rel));
  if (!src) return { sites: 0 };
  // Only the authored template block — the interface declares these names, and
  // the resolver assigns them from variables, and neither is a literal.
  const start = src.indexOf('export const FOUNDING_FLOWS');
  if (start === -1) return { sites: 0 };
  const body = src.slice(start);
  const lines = body.split('\n');
  let sites = 0;
  for (let i = 0; i < lines.length; i++) {
    const code = stripCommentsAndStrings(lines[i]);
    TIMING_LITERAL.lastIndex = 0;
    let m;
    while ((m = TIMING_LITERAL.exec(code))) {
      sites++;
      fatal(
        'flow-literals',
        `${rel}: a timing number is typed into the flow book — \`${m[0].trim()}\`. Every governing number belongs in knowledge/facts.json; the flow book reads them at load.`,
      );
    }
  }
  return { sites };
}

function main() {
  const graph = buildGraph();
  const pages = loadBookPages();
  if (!pages.length) {
    console.log('lint — the Great Book');
    console.log('  no pages on disk. Compile first: `npm run book`.');
    process.exit(1);
  }

  const links = checkLinksAndOrphans(pages);
  const manifest = checkDeclarations(graph);
  const quotes = checkQuotes(graph);
  const standing = checkStanding(graph);
  const literals = checkLiterals(graph);
  const resolved = checkResolvedTables(pages);
  const cascade = checkCascadeOrder(graph);
  const flowLits = checkFlowLiterals();

  for (const b of graph.brokenKnowledge) fatal('knowledge', `unreadable: ${b}`);
  for (const u of graph.unresolvedLinks) {
    warn('knowledge', `declared link to a stranger: ${u.from} → ${u.to} (dropped by the compiler, never dangled)`);
  }
  for (const m of graph.missingKnowledge) warn('knowledge', `absent: ${m} — that half of the graph is simply not mined yet`);

  console.log('lint — the Great Book' + (STRICT ? '   [--strict: every finding is fatal]' : ''));
  console.log(`  pages            ${links.pages}`);
  console.log(`  dangling links   ${links.dangling}`);
  console.log(`  orphans          ${links.orphans} unreachable  ·  ${links.unpointed} with an EMPTY Backlinks section (nothing points at the idea)  ·  ${links.backOnly} reachable only through a reverse listing`);
  console.log(
    `  manifest         ${manifest.undeclared === null ? 'SKIPPED — nothing declared' : `${manifest.undeclared} undeclared on disk, ${manifest.phantom} declared but absent`}`,
  );
  console.log(`  quotes           ${quotes.checked} checked, ${quotes.failed} failed, ${quotes.unsourced} mined objects with no quote at all`);
  console.log(
    `  resolved tables  ${resolved.offenders === 0 ? 'every page carries answers, not queries — no plugin needed to read the Book' : `${resolved.offenders} page(s) defer a table to a reader's plugin`}`,
  );
  console.log(
    `  standing drift   ${standing.claimsDone} proposed-but-claims-done, ${standing.unbacked} built-with-nothing-under-it, ${standing.noSuccessor} retired-with-no-successor`,
  );
  console.log(`  literals in guards ${literals.sites} site(s) across ${literals.files} file(s) — WARNING, this repo predates the rule`);

  console.log(
    cascade.flows === 0
      ? '  cascades         no flows mined — the operational graph is not built'
      : `  cascades         ${cascade.flows} flow(s)  ·  ${cascade.backwards} step(s) running backwards against the clock, ${cascade.mixed} flow(s) mixing two unanchored clocks`,
  );
  console.log(
    flowLits.sites === 0
      ? '  flow literals    none — every timing number lives in knowledge/facts.json'
      : `  flow literals    ${flowLits.sites} timing number(s) typed into the flow book — see FATAL below`,
  );

  const groups = {};
  for (const f of findings.fatal) (groups[f.check] = groups[f.check] || []).push(f.msg);
  const wgroups = {};
  for (const f of findings.warn) (wgroups[f.check] = wgroups[f.check] || []).push(f.msg);

  if (findings.fatal.length) {
    console.log(`\nFATAL (${findings.fatal.length})`);
    for (const [check, msgs] of Object.entries(groups)) {
      console.log(`  ${check} — ${msgs.length}`);
      for (const m of msgs.slice(0, 20)) console.log(`    ${m}`);
      if (msgs.length > 20) console.log(`    …and ${msgs.length - 20} more`);
    }
  }
  if (findings.warn.length) {
    console.log(`\nWARN (${findings.warn.length})`);
    for (const [check, msgs] of Object.entries(wgroups)) {
      console.log(`  ${check} — ${msgs.length}`);
      for (const m of msgs.slice(0, 20)) console.log(`    ${m}`);
      if (msgs.length > 20) console.log(`    …and ${msgs.length - 20} more`);
    }
  }
  if (!findings.fatal.length && !findings.warn.length) console.log('\nThe Book is sound.');

  process.exit(findings.fatal.length ? 1 : 0);
}

main();
