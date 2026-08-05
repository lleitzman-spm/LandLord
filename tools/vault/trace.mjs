// TRACE — one subject across every layer at once.
// `node tools/vault/trace.mjs "<subject>"`   (see `docs/WRIT-THE-GREAT-BOOK.md`)
//
// THROUGH NPM THE `--` IS REQUIRED — npm eats everything after the script name unless you
// separate it, so the subject silently vanishes and you get the usage banner:
//     npm run book:trace -- "late fee"        ✔ the subject reaches this tool
//     npm run book:trace "late fee"           ✘ npm keeps it; trace sees no argument
// Called directly (`node tools/vault/trace.mjs "late fee"`) no separator is needed.
//
// WHY THIS EXISTS
// This is the verb that replaces grepping, and it exists because grep answers the wrong
// question. Grep finds a string. It does not tell you that the thing you are about to
// write already has a LAW governing it, a WRIT specifying it, a MODULE implementing it, a
// TEST forbidding the change you were about to make, a FACT holding the number you were
// about to type, and a DECISION that already settled the argument. Every session in this
// kingdom has paid that tax; the leasing clerk was built twice by two hands who could not
// see each other's work. One subject, every layer, one screen.
//
// HOW IT MATCHES — literals only, same as the compiler:
//   ids · labels · exported symbols · source paths · summaries · verbatim quotes.
// Never prose similarity. A hit is a hit because a word is really there.
//
// HONEST LIMITS
//   · It ranks by how many LAYERS a subject touches, so a subject that is only a module
//     name will rank below one that also has a law and a test. That is deliberate — the
//     wide answer is the one you came for — but it means a narrow, correct hit can sit
//     below a broad, looser one. Both are printed.
//   · The "connected" rows are ONE HOP from a direct hit along a found edge. They are
//     neighbours, not matches. They are marked, and near is never the same as proves.
//   · It re-derives the graph from the tree on every run and does NOT read the compiled
//     pages, so it is never stale — but it will not know about a page you hand-wrote.
//
// Pure Node. No install, ever.

import fs from 'node:fs';
import path from 'node:path';
import { REPO, buildGraph, degree, escapeRe, normalizeWs } from './lib.mjs';

/** A page with more roads than this is a HUB — `HANDOFF.md` touches nearly everything.
 *  Its neighbours tell you nothing about your subject, so trace does not walk out of one.
 *  HONEST LIMIT: a genuine neighbour reachable only through a hub will not be shown. */
const HUB_DEGREE = 40;

const LAYERS = [
  ['law', 'LAWS that govern it'],
  ['writ', 'WRITS that specify it'],
  ['decision', 'DECISIONS that touched it'],
  ['fact', 'FACTS it depends on'],
  ['entity', 'ENTITIES'],
  ['term', 'TERMS'],
  ['act', 'ACTS'],
  ['module', 'MODULES that implement it'],
  ['surface', 'SURFACES that show it'],
  ['invariant', 'INVARIANTS that enforce it'],
];

const LOUD = { proposed: 'PROPOSED — not built', contested: 'CONTESTED', retired: 'RETIRED' };

function scoreNode(node, terms) {
  const fields = [
    [node.id, 10, 'id'],
    [node.label, 8, 'label'],
    [(node.extra.symbols || []).join(' '), 7, 'exported symbol'],
    [node.source_path, 5, 'path'],
    [node.summary, 3, 'summary'],
    [node.quote, 2, 'quote'],
    [node.body, 2, 'body'],
    [(node.extra.ancestry || []).join(' '), 3, 'suite'],
    [(node.extra.headings || []).map((h) => h.text).join(' '), 2, 'heading'],
  ];
  let total = 0;
  const hitTerms = new Set();
  const why = new Set();
  for (const t of terms) {
    let best = 0;
    let bestWhy = '';
    for (const [text, weight, name] of fields) {
      if (!text) continue;
      const hay = String(text).toLowerCase();
      if (!t.re.test(hay)) continue;
      if (weight > best) {
        best = weight;
        bestWhy = name;
      }
    }
    if (best) {
      total += best;
      hitTerms.add(t.raw);
      why.add(bestWhy);
    }
  }
  return { total, matched: hitTerms.size, why: [...why] };
}

function excerpt(node, terms) {
  const pools = [node.summary, node.quote, node.body].filter(Boolean);
  for (const p of pools) {
    const flat = normalizeWs(p);
    for (const t of terms) {
      const i = flat.toLowerCase().indexOf(t.plain);
      if (i === -1) continue;
      const from = Math.max(0, i - 40);
      return (from ? '…' : '') + flat.slice(from, from + 130) + (flat.length > from + 130 ? '…' : '');
    }
  }
  return normalizeWs(node.summary || node.label).slice(0, 130);
}

function main() {
  const subject = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!subject) {
    console.log('trace — one subject across every layer of the Great Book');
    console.log('  usage: node tools/vault/trace.mjs "<subject>"');
    console.log('  e.g.:  node tools/vault/trace.mjs "late fee"');
    console.log('         node tools/vault/trace.mjs normalizeChronicle');
    console.log('         node tools/vault/trace.mjs src/domain/economy.ts');
    process.exit(2);
  }
  const wide = process.argv.includes('--all');
  const cap = wide ? 40 : 8;

  const terms = subject
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, plain: raw.toLowerCase(), re: new RegExp(escapeRe(raw.toLowerCase()), 'i') }));

  const graph = buildGraph();
  const scored = [];
  for (const n of graph.nodes) {
    const s = scoreNode(n, terms);
    if (s.matched) scored.push({ node: n, ...s });
  }
  // Every term present beats some terms present — but if nothing holds them all, take
  // what there is rather than answer "nothing found" to a real subject.
  const full = scored.filter((s) => s.matched === terms.length);
  const direct = full.length ? full : scored;
  direct.sort((a, b) => b.total - a.total || a.node.id.localeCompare(b.node.id));

  if (!direct.length) {
    console.log(`trace "${subject}" — nothing in the Book names it.`);
    console.log('  Nothing found is a real answer: no law, no writ, no module, no test, no fact, no decision.');
    console.log('  Before you build it, that means there is no prior art AND no permission. Check `docs/HANDOFF.md`.');
    process.exit(0);
  }

  // One hop out along found edges — neighbours, never matches.
  const directIds = new Set(direct.map((d) => d.node.id));
  const near = new Map();
  let hubsSkipped = 0;
  for (const d of direct.slice(0, 12)) {
    if (degree(d.node) > HUB_DEGREE) {
      hubsSkipped++;
      continue; // a hub's roads lead everywhere and so mean nothing here
    }
    for (const e of d.node.edges) if (!directIds.has(e.to)) near.set(e.to, { via: d.node, why: e.why });
    for (const b of d.node.backlinks) if (!directIds.has(b.from)) near.set(b.from, { via: d.node, why: b.why });
  }

  const layersHit = new Set(direct.map((d) => d.node.type));
  console.log(`trace "${subject}"`);
  console.log(
    `  ${direct.length} direct hit${direct.length === 1 ? '' : 's'} across ${layersHit.size} layer${layersHit.size === 1 ? '' : 's'}` +
      `  ·  ${near.size} one hop away` +
      (hubsSkipped ? `  ·  ${hubsSkipped} hub page(s) not walked out of` : '') +
      (full.length ? '' : '  ·  no page holds every word — showing partial matches'),
  );

  const warnings = direct.filter((d) => LOUD[d.node.standing]);
  if (warnings.length) {
    console.log('');
    console.log('  ⚠ READ THE STANDING BEFORE YOU ACT');
    for (const w of warnings.slice(0, 6)) {
      console.log(`      ${LOUD[w.node.standing]} — ${w.node.label.slice(0, 84)}  (${w.node.source_path})`);
    }
    if (warnings.length > 6) console.log(`      …and ${warnings.length - 6} more`);
  }

  const known = new Set(LAYERS.map(([t]) => t));
  const extraTypes = [...new Set(direct.map((d) => d.node.type))].filter((t) => !known.has(t)).map((t) => [t, t.toUpperCase()]);

  for (const [type, title] of [...LAYERS, ...extraTypes]) {
    const rows = direct.filter((d) => d.node.type === type);
    const hops = [...near.entries()]
      .map(([id, v]) => ({ node: graph.byId.get(id), ...v }))
      .filter((h) => h.node && h.node.type === type);
    if (!rows.length && !hops.length) continue;
    console.log(`\n  ${title}  (${rows.length}${hops.length ? ` + ${hops.length} near` : ''})`);
    for (const r of rows.slice(0, cap)) {
      const where = r.node.source_path ? `${r.node.source_path}${r.node.source_line ? `:${r.node.source_line}` : ''}` : '—';
      const flag = LOUD[r.node.standing] ? ` [${r.node.standing.toUpperCase()}]` : '';
      console.log(`    · ${r.node.label.slice(0, 96)}${flag}`);
      console.log(`        ${where}   (${r.node.standing}, matched on ${r.why.join('+')})`);
      const ex = excerpt(r.node, terms);
      if (ex && ex !== r.node.label) console.log(`        ${ex}`);
      if (r.node.file && fs.existsSync(path.join(REPO, r.node.file))) console.log(`        page: ${r.node.file}`);
    }
    if (rows.length > cap) console.log(`    · …and ${rows.length - cap} more direct hit(s) — re-run with --all`);
    const nearCap = wide ? 12 : 3;
    for (const h of hops.slice(0, nearCap)) {
      console.log(`    ~ ${h.node.label.slice(0, 88)}   (near: ${h.why})`);
    }
    if (hops.length > nearCap) console.log(`    ~ …and ${hops.length - nearCap} more one hop away`);
  }

  const missing = LAYERS.filter(([t]) => !layersHit.has(t) && graph.nodes.some((n) => n.type === t)).map(([t]) => t);
  if (missing.length) {
    console.log(`\n  NO ${missing.map((m) => m.toUpperCase()).join(', ')} NAMES this subject (some may still stand one hop away, marked ~).`);
    if (missing.includes('invariant')) console.log('      Nothing in the test suite enforces it — a change here breaks no test.');
    if (missing.includes('fact')) console.log('      No governing number is declared for it in `knowledge/facts.json`.');
    if (missing.includes('law')) console.log('      No ratified law governs it; you are on open ground.');
  }
  console.log('');
}

main();
