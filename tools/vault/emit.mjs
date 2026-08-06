// COMPILE — sources into pages. The first of the Great Book's four verbs
// (`docs/WRIT-THE-GREAT-BOOK.md`). Run it with `node tools/vault/emit.mjs`.
//
// WHY THIS EXISTS
// The knowledge in this kingdom is real but scattered: the canon in `KINGDOM.md`, the
// state of play in a three-thousand-line `HANDOFF.md`, the truth in the TypeScript, the
// invariants only in the tests. Grep finds a string. It does not tell you that the thing
// you are about to write already has a law governing it, a writ specifying it, a module
// implementing it and a test forbidding the change. This compiler projects all of it into
// one backlinked Book where every claim carries the source it came from and the standing
// it holds.
//
// THE ONE RULE: never edit a page in the Book. Every page here is generated and will be
// overwritten on the next run — silently, having looked right for however long. Find the
// source, fix the SOURCE, re-compile. The footer of every page names its source.
//
// HONEST LIMITS
//   · Half this Book is DERIVED from the tree and cannot go stale. The other half is
//     hand-mined into `knowledge/*.json` by another hand; where those files are absent
//     this compiler emits what exists and REPORTS the gap rather than inventing it.
//   · An edge from an invariant to a module means "the test FILE imports that module" —
//     a shared-source coincidence at file granularity, not a claim that this one test
//     exercises that module. Every such page says so on its face.
//   · A standing marked `defaulted` was never declared in `knowledge/artifacts.json`.
//     It is this compiler's guess, and the map counts every one of them so the gap is
//     visible rather than believed.
//   · An invariant page is one SOURCE SITE, not one runtime case. An `it()` inside a loop
//     or an `it.each([…])` over a table is one page here and several tests when vitest
//     runs it, so this count sits below the runner's — never read the gap as a lost test.
//   · Only `book/00 START HERE.md` survives a run. Everything else in the shelves this
//     compiler owns is deleted and rewritten.
//
// Pure Node. No install, ever. Prints COUNTS, never page bodies — this output lands in
// an orchestrating session's context and a wall of prose there is a tax on every reader.

import fs from 'node:fs';
import path from 'node:path';
import { edgeInWords } from './flowbook.mjs';
import {
  REPO,
  BOOK,
  GENERATOR,
  TYPE_DIRS,
  STANDING_BANNER,
  buildGraph,
  countBy,
  degree,
  slugify,
} from './lib.mjs';

const NOW = new Date().toISOString();
const MARKER = '.generated-by-emit';

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

const y = (v) => JSON.stringify(v == null ? '' : String(v));

function frontmatter(fields) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${y(item)}`);
    } else if (typeof v === 'number') lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${y(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function standingBanner(node) {
  const s = node.standing;
  const gloss = STANDING_BANNER[s] || '';
  const loud = s === 'proposed' || s === 'contested';
  const head = `**STANDING — ${s.toUpperCase()}${loud ? ' ⚠' : ''}**`;
  const src =
    node.standing_source === 'derived'
      ? 'Derived from the tree — the code is there to be read.'
      : node.standing_source === 'defaulted'
        ? "NOT declared anywhere; this is the compiler's default. Declare it in `knowledge/artifacts.json`."
        : `Declared in \`${node.standing_source}\`.`;
  return `> ${head}  \n> ${gloss}  \n> *${src}*\n`;
}

const SECTION_TITLE = {
  law: 'Laws that govern it',
  writ: 'Writs that specify it',
  module: 'Modules',
  invariant: 'Invariants that enforce it',
  fact: 'Facts it depends on',
  decision: 'Decisions that touched it',
  surface: 'Surfaces',
  entity: 'Entities',
  act: 'Acts',
};

/** Every link is validated before it is written. What does not resolve is downgraded to
 *  plain code text and reported — never left dangling. A dangling link is a lie that
 *  looks like a road. */
function makeLinker(validPages, report) {
  return (page, fromId) => {
    if (validPages.has(page)) return `[[${page}]]`;
    report.push({ from: fromId, page });
    return `\`${page}\``;
  };
}

/** No road is silently dropped: a truncated Backlinks section makes a page look like an
 *  orphan when it is not, and the orphan check is the one that matters most. High enough
 *  that truncation never happens in this repo; the '…and N more' line remains as a guard. */
const ROAD_CAP = 600;

const ROAD_ORDER = ['law', 'writ', 'fact', 'decision', 'entity', 'act', 'module', 'surface', 'invariant'];

/** One road per far end, however many literals found it. Five reasons for the same road
 *  is a fact about the search, not five roads. */
function collapse(pairs, byId) {
  const m = new Map();
  for (const p of pairs) {
    const t = byId.get(p.id);
    if (!t) continue;
    if (!m.has(t.id)) m.set(t.id, { target: t, whys: [] });
    const row = m.get(t.id);
    if (!row.whys.includes(p.why)) row.whys.push(p.why);
  }
  for (const row of m.values()) row.whys.sort((a, b) => a.localeCompare(b));
  return [...m.values()];
}

function renderRoads(out, node, rows, link, level, cap) {
  const byType = new Map();
  for (const r of rows) {
    if (!byType.has(r.target.type)) byType.set(r.target.type, []);
    byType.get(r.target.type).push(r);
  }
  const types = [...byType.keys()].sort((a, b) => {
    const ia = ROAD_ORDER.indexOf(a), ib = ROAD_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  for (const t of types) {
    const group = byType.get(t).sort((a, b) => a.target.page.localeCompare(b.target.page));
    out.push(`${level} ${SECTION_TITLE[t] || t}\n`);
    if (t === 'invariant' || (node.type === 'invariant' && t === 'module')) {
      out.push(
        '*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*\n',
      );
    }
    for (const r of group.slice(0, cap)) {
      const why = r.whys.length > 2 ? `${r.whys.slice(0, 2).join('; ')}; +${r.whys.length - 2} more` : r.whys.join('; ');
      out.push(`- ${link(r.target.page, node.id)} — *${why}*`);
    }
    if (group.length > cap) out.push(`- *…and ${group.length - cap} more.*`);
    out.push('');
  }
}

/** One flat, sorted list — no type grouping, no per-row reason. A file citation carries
 *  no meaning worth spelling out twenty-five times; the section's own note says it once. */
function renderCitations(out, node, rows, byId, link, title, note) {
  const pages = [...new Set(rows.map((r) => byId.get(r.to ?? r.from)).filter(Boolean).map((t) => t.page))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!pages.length) return;
  out.push(`## ${title}\n`);
  out.push(`*${note.join(' ')}*\n`);
  for (const p of pages.slice(0, ROAD_CAP)) out.push(`- ${link(p, node.id)}`);
  if (pages.length > ROAD_CAP) out.push(`- *…and ${pages.length - ROAD_CAP} more.*`);
  out.push('');
}

function renderNode(node, byId, link) {
  const out = [];
  out.push(
    frontmatter({
      type: node.type,
      id: node.id,
      title: node.page,
      standing: node.standing,
      standing_source: node.standing_source,
      source_path: node.source_path,
      source_line: node.source_line,
      origin: node.origin,
      // NO TIMESTAMP ON A PAGE. A clock in the frontmatter rewrites all 769 files on
      // every compile, and then `git diff book/` answers "what changed when I edited a
      // source?" with "everything" — the one true statement rendered indistinguishably
      // from the one that matters, which is the exact failure this Book was built to kill.
      // The build stamp lives in `book/maps/INDEX.md` alone, which may churn freely.
      generator: GENERATOR,
      tags: node.tags,
      aliases: [node.id],
    }),
  );
  out.push(`# ${node.page}\n`);
  out.push(standingBanner(node));
  if (node.summary) out.push(`${node.summary}\n`);
  if (node.quote) {
    out.push('## The source, verbatim\n');
    out.push(
      node.quote
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n') + '\n',
    );
    out.push(
      `*Verified against \`${node.source_path}\`${node.source_line ? `:${node.source_line}` : ''} on every lint — no quote, no object.*\n`,
    );
  }
  if (node.body) out.push(`## Body\n\n${node.body}\n`);

  const extra = renderExtra(node);
  if (extra) out.push(extra);

  // Outbound roads, grouped by what stands at the far end. Several reasons for the same
  // road collapse onto one line — a road is a road, however many literals found it.
  const ideaOut = node.edges.filter((e) => e.kind !== 'file');
  const fileOut = node.edges.filter((e) => e.kind === 'file');
  const ideaIn = node.backlinks.filter((b) => b.kind !== 'file');
  const fileIn = node.backlinks.filter((b) => b.kind === 'file');

  renderRoads(out, node, collapse(ideaOut.map((e) => ({ id: e.to, why: e.why })), byId), link, '##', ROAD_CAP);
  out.push('## Backlinks\n');
  if (!ideaIn.length) {
    out.push(
      '*Nothing in the Book points here. An orphan page is worse than a missing one — it exists, it is correct, and no reader will ever reach it. `npm run book:lint` counts these.*\n',
    );
  } else {
    renderRoads(out, node, collapse(ideaIn.map((b) => ({ id: b.from, why: b.why })), byId), link, '###', ROAD_CAP);
  }

  // FILE-level citations, kept apart from the roads above and never mixed into them. A
  // document naming this file by path has a relationship with the FILE — not with any
  // particular idea inside it, and not with the other ideas mined out of it.
  renderCitations(out, node, fileIn, byId, link, 'Documents that cite this source', [
    'These name this FILE by its path. That is a citation of the source, not a claim about any',
    'one idea inside it — do not read a path citation as agreement, dependence or implementation.',
  ]);
  renderCitations(out, node, fileOut, byId, link, 'Sources this page cites', [
    'Files this page names by path. Again: a citation of the file, nothing more.',
  ]);

  out.push('---\n');
  out.push(
    `*Generated by \`${GENERATOR}\` from \`${node.source_path || '(no source on disk)'}\`${node.source_line ? `:${node.source_line}` : ''}. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (\`npm run book\`).*`,
  );
  return out.join('\n') + '\n';
}

/** A FLOW PAGE DRAWS ITS CASCADE. Every other page in the Book describes a thing;
 *  this one has to show a shape, and a list of fields is not a shape. Everything
 *  below is read back out of the flow's own declaration — the same object the
 *  running application walks — so the picture cannot drift from the machine.
 *
 *  The timing column is the reason this page has to exist at all. A step written
 *  `edge: { after: -14, before: -7 }` means "between fourteen and seven days BEFORE
 *  the event", and a negative day offset is the single most misreadable thing in the
 *  flow book. Nobody should have to know that to read their own workflow. */
function renderFlowExtra(node) {
  const t = (node.extra || {}).flow;
  if (!t || !Array.isArray(t.steps)) return '';
  const out = [];
  const steps = t.steps;
  const label = (s) => `[[${t.title || t.key}: ${s.key}]]`;
  const hands = (node.extra || {}).handLabels || {};
  const hand = (h) => `[[${hands[h] || h}]]`;

  out.push('## The cascade\n');
  out.push(`**Trigger — ${escapeCell(t.trigger)}.** ${steps.length} steps, ${new Set(steps.map((s) => s.holder)).size} hand(s), ${new Set(steps.map((s) => s.board)).size} board(s).\n`);
  out.push('```text');
  steps.forEach((s, i) => {
    const mark = i === 0 ? '▶' : i === steps.length - 1 ? '■' : '·';
    out.push(`${mark} ${s.key}   [${s.board}]  — ${s.holder}`);
    if (i < steps.length - 1) {
      const n = steps[i + 1];
      const hand = s.holder !== n.holder ? `   ⇢ handover ${s.holder} → ${n.holder}` : '';
      out.push(`   └─▶ ${edgeInWords(n.edge, n.slaDays, n.repeatEveryDays)}${hand}`);
    }
  });
  out.push('```\n');
  out.push('*▶ where a case enters  ·  ■ where it comes to rest*\n');

  out.push('## Every step\n');
  out.push('| # | step | board | held by | when it may start | breached after | what it is |', '|---:|---|---|---|---|---|---|');
  steps.forEach((s, i) => {
    out.push(
      `| ${i + 1} | ${label(s)} | ${escapeCell(s.board)} | ${hand(s.holder)} | ${escapeCell(edgeInWords(s.edge, undefined, s.repeatEveryDays))} ` +
        `| ${s.slaDays === undefined ? '*no SLA*' : `${s.slaDays} day${s.slaDays === 1 ? '' : 's'}`} | ${escapeCell(s.note || s.condition || '—')} |`,
    );
  });
  out.push('');

  // A handover is where work is dropped in the real world — every one of them is a
  // moment the case stops being somebody's problem and starts being somebody else's.
  const handovers = steps.slice(1).filter((s, i) => steps[i].holder !== s.holder);
  if (handovers.length) {
    out.push('## Where it changes hands\n');
    out.push(
      `*${handovers.length} handover${handovers.length === 1 ? '' : 's'} in this flow. Each one is a moment the case stops being somebody's problem and starts being somebody else's — which is where work is actually dropped.*\n`,
    );
    steps.slice(1).forEach((s, i) => {
      if (steps[i].holder === s.holder) return;
      out.push(`- **${escapeCell(steps[i].holder)} → ${escapeCell(s.holder)}** at ${label(s)}${s.slaDays !== undefined ? ` — ${s.slaDays} day SLA` : ' — *no SLA on the receiving step*'}`);
    });
    out.push('');
  }
  return out.join('\n');
}

function escapeCell(s) {
  return String(s ?? '—').replace(/\|/g, '\\|');
}

function renderExtra(node) {
  const e = node.extra || {};
  const out = [];
  if (node.type === 'flow') return renderFlowExtra(node);
  if (node.type === 'place' || node.type === 'transition' || node.type === 'guard') {
    if (e.timing) out.push(`## When\n\n${e.timing}\n`);
    const s = e.step;
    if (s) {
      out.push('## The step\n');
      out.push(`- **Board:** ${escapeCell(s.board)}`);
      out.push(`- **Held by:** [[${escapeCell(e.holderLabel || s.holder)}]]`);
      out.push(`- **Task type:** \`${escapeCell(s.catalogRow)}\``);
      if (s.slaDays !== undefined) out.push(`- **Breached after:** ${s.slaDays} day${s.slaDays === 1 ? '' : 's'} past its edge`);
      if (s.repeatEveryDays) out.push(`- **Repeats:** every ${s.repeatEveryDays} days${s.condition ? ` ${escapeCell(s.condition)}` : ''}`);
      if (s.condition) out.push(`- **Condition:** ${escapeCell(s.condition)}`);
      out.push('');
    }
    if (e.handover) out.push(`## It changes hands here\n\n**${escapeCell(e.handover)}** — a moment the case stops being one person's problem and becomes another's.\n`);
    return out.join('\n');
  }
  if (node.type === 'task') {
    const r = e.row || {};
    out.push('## The task type\n');
    out.push(`- **Key:** \`${escapeCell(r.key)}\``);
    if (r.class) out.push(`- **Class:** ${escapeCell(r.class)}`);
    if (r.mode) out.push(`- **Mode:** ${escapeCell(r.mode)}${r.mode === 'human' ? ' — a judgement the machine must never cross' : ''}`);
    if (r.domain) out.push(`- **Domain:** ${escapeCell(r.domain)}`);
    if (r.note) out.push(`- **Note:** ${escapeCell(r.note)}`);
    out.push('');
    return out.join('\n');
  }
  if (node.type === 'hand') {
    if (e.isQueue) {
      out.push(
        '> **This is a QUEUE, not a person.** A role nobody holds yet — it reads as the holder until a setting maps it to somebody. Every step below is work with no name against it.\n',
      );
    } else if (e.person) {
      out.push('## The hand\n');
      out.push(`- **Id:** \`${escapeCell(e.person.id)}\``);
      if (e.person.pledge) out.push(`- **Pledge:** ${escapeCell(e.person.pledge)}`);
      out.push('');
    }
    return out.join('\n');
  }
  if (node.type === 'module') {
    if (e.adopted) {
      out.push(
        '> **Adopted page.** This file sits OUTSIDE `src/`, so the compiler would not normally make a page for it. It has one because a hand-mined record in `knowledge/` leans on it by name, and a road to a real file beats a road to nowhere. Read it as "a file the kingdom depends on", not as "a module of the app".\n',
      );
    }
    if (e.doc) out.push(`## What the file says of itself\n\n${e.doc.split('\n').map((l) => `> ${l}`).join('\n')}\n`);
    out.push(`## Shape\n`);
    out.push(`- **Lines:** ${e.lines}`);
    out.push(`- **Exported symbols (${(e.symbols || []).length}):** ${(e.symbols || []).length ? (e.symbols || []).map((s) => `\`${s}\``).join(', ') : '*none*'}`);
    if ((e.assets || []).length) {
      out.push(
        `- **Assets it pulls in (no page, so no road):** ${[...e.assets].sort().map((a) => `\`${a}\``).join(', ')}`,
      );
    }
    out.push('');
  } else if (node.type === 'invariant') {
    out.push('## Where it is enforced\n');
    out.push(`- **Suite:** \`${e.suite}:${node.source_line}\``);
    if ((e.ancestry || []).length) out.push(`- **Under:** ${e.ancestry.map((a) => `*${a}*`).join(' › ')}`);
    out.push('');
  } else if (node.type === 'writ') {
    if ((e.headings || []).length) {
      out.push('## Outline\n');
      for (const h of e.headings.slice(0, 60)) out.push(`${'  '.repeat(Math.max(0, h.depth - 2))}- ${h.text}`);
      if (e.headings.length > 60) out.push(`- *…and ${e.headings.length - 60} more headings.*`);
      out.push('');
    }
  } else if (node.type === 'fact') {
    const rows = [];
    for (const k of ['kind', 'value', 'unit', 'scope', 'default', 'band']) {
      if (e[k] !== undefined) rows.push(`- **${k}:** ${e[k] === null ? '*unknown*' : `\`${JSON.stringify(e[k])}\``}`);
    }
    if (rows.length) out.push(`## The governing number\n\n${rows.join('\n')}\n`);
  } else if (node.type === 'surface') {
    out.push(`## Where it lives\n\n- **File:** \`${e.file}\`\n`);
    if (e.doc) out.push(`${e.doc.split('\n').map((l) => `> ${l}`).join('\n')}\n`);
  }
  if (e.successor || e.superseded_by) out.push(`## Successor\n\n- ${e.successor || e.superseded_by}\n`);
  return out.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// The map of content
// ─────────────────────────────────────────────────────────────────────────────

function renderIndex(nodes, byId, link, graph, indexPage) {
  const out = [];
  out.push(
    frontmatter({
      type: 'map',
      id: 'map:index',
      title: indexPage,
      standing: 'built',
      standing_source: 'derived',
      source_path: GENERATOR,
      generated: NOW,
      generator: GENERATOR,
      aliases: ['map:index'],
    }),
  );
  out.push(`# ${indexPage}\n`);
  out.push(
    '*Every page below is GENERATED. Never edit one — find the source named in its footer, fix that, and re-compile. The only hand-written page in the Book is `00 START HERE.md`.*\n',
  );

  const byType = countBy(nodes, 'type');
  const byStanding = countBy(nodes, 'standing');
  out.push('## The count\n');
  out.push('| kind | pages |', '|---|---:|');
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
    out.push(`| ${t} | ${c} |`);
  out.push(`| **all** | **${nodes.length}** |`, '');
  out.push('| standing | pages |', '|---|---:|');
  for (const [s, c] of Object.entries(byStanding).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
    out.push(`| ${s} | ${c} |`);
  out.push('');

  const defaulted = nodes.filter((n) => n.standing_source === 'defaulted');
  if (defaulted.length) {
    out.push(
      `> **${defaulted.length} page${defaulted.length === 1 ? '' : 's'} carry a DEFAULTED standing** — nothing declared them in \`knowledge/artifacts.json\`, so the compiler guessed. A guess is not a declaration. Declare them.\n`,
    );
  }

  const proposed = nodes.filter((n) => n.standing === 'proposed');
  out.push('## PROPOSED — not built, and never evidence that anything works ⚠\n');
  out.push(
    '*A proposed claim rendered beside a built one, both in plain prose, is exactly how three closed blockers sat open in `HANDOFF.md` for five sessions. These are designs. None of them is a build.*\n',
  );
  if (!proposed.length) out.push('*None.*\n');
  for (const n of proposed.sort((a, b) => a.page.localeCompare(b.page)).slice(0, 200)) {
    out.push(`- ${link(n.page, 'map:index')} — \`${n.source_path}\``);
  }
  if (proposed.length > 200) out.push(`- *…and ${proposed.length - 200} more.*`);
  out.push('');

  const contested = nodes.filter((n) => n.standing === 'contested');
  out.push('## CONTESTED — two sources disagree, nobody has ruled\n');
  if (!contested.length) out.push('*None. (That is not the same as everything agreeing — it means nothing has been marked.)*\n');
  for (const n of contested.sort((a, b) => a.page.localeCompare(b.page))) {
    out.push(`- ${link(n.page, 'map:index')} — \`${n.source_path}\``);
  }
  out.push('');

  const retired = nodes.filter((n) => n.standing === 'retired');
  if (retired.length) {
    out.push('## RETIRED — kept for history, never cited as current\n');
    for (const n of retired.sort((a, b) => a.page.localeCompare(b.page))) out.push(`- ${link(n.page, 'map:index')}`);
    out.push('');
  }

  out.push('## Load-bearing — what the rest of the kingdom leans on\n');
  out.push('*Ranked by roads in plus roads out. A high count means many things would move if this one did.*\n');
  out.push('| page | kind | standing | roads |', '|---|---|---|---:|');
  for (const n of [...nodes].sort((a, b) => degree(b) - degree(a) || a.page.localeCompare(b.page)).slice(0, 30)) {
    out.push(`| ${link(n.page, 'map:index')} | ${n.type} | ${n.standing} | ${degree(n)} |`);
  }
  out.push('');

  out.push('## Ways in\n');
  const entries = [];
  const kingdom = byId.get('writ:docs/KINGDOM.md');
  if (kingdom) entries.push([kingdom, 'the constitution — it wins until amended']);
  const handoff = byId.get('writ:docs/HANDOFF.md');
  if (handoff) entries.push([handoff, 'where things stand and what is pending']);
  const greatBook = byId.get('writ:docs/WRIT-THE-GREAT-BOOK.md');
  if (greatBook) entries.push([greatBook, 'the law that keeps this Book honest']);
  for (const n of nodes.filter((n) => n.type === 'surface').sort((a, b) => a.page.localeCompare(b.page))) {
    entries.push([n, 'a place a person actually stands']);
  }
  for (const [n, why] of entries) out.push(`- ${link(n.page, 'map:index')} — *${why}*`);
  out.push('');

  out.push('## Every shelf\n');
  for (const [type, dir] of Object.entries(TYPE_DIRS)) {
    const count = nodes.filter((n) => n.type === type).length;
    if (!count && type !== 'map') continue;
    out.push(`- \`book/${dir}/\` — ${count} ${type} page${count === 1 ? '' : 's'}`);
  }
  out.push('');

  if (graph.missingKnowledge.length || graph.brokenKnowledge.length || graph.unresolvedLinks.length) {
    out.push('## What the compiler could not read\n');
    for (const m of graph.missingKnowledge) out.push(`- **absent:** \`${m}\` — nothing mined from it, and nothing invented in its place.`);
    for (const b of graph.brokenKnowledge) out.push(`- **unreadable:** ${b}`);
    const un = [...graph.unresolvedLinks].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).slice(0, 20);
    for (const u of un) out.push(`- **declared link to a stranger:** \`${u.from}\` → \`${u.to}\` (dropped, never dangled).`);
    if (graph.unresolvedLinks.length > 20) out.push(`- *…and ${graph.unresolvedLinks.length - 20} more dropped links.*`);
    out.push('');
  }

  out.push('---\n');
  out.push(
    `*Generated by \`${GENERATOR}\` at ${NOW}. This is the ONLY page carrying a build time — the rest hold no clock, so \`git diff book/\` shows what actually changed. Re-compile with \`npm run book\`; check it with \`npm run book:lint\`; ask it a question with \`npm run book:trace -- "<subject>"\` — the \`--\` is npm's, not ours, and without it npm swallows the subject.*`,
  );
  return out.join('\n') + '\n';
}

const START_HERE = `# Start here — the Great Book

*This is the ONLY hand-written page in the Book. The compiler wrote it once and will never
touch it again. Everything else under \`book/\` is generated and will be overwritten on the
next run — a correction made to a generated page is gone at the next compile, and gone
silently, having looked right for however long.*

**Find the source, fix the source, re-compile.** The footer of every page names its source.

## The four verbs

| verb | command | what it does |
|---|---|---|
| **compile** | \`npm run book\` | sources → pages. Deletes and rewrites its own shelves. |
| **query** | \`npm run book:trace "<subject>"\` | one subject across every layer at once — law, writ, module, test, fact. |
| **lint** | \`npm run book:lint\` | dangling links, orphans, undeclared paths, missing quotes, standing drift, literals in guards. |
| **read** | \`npm run book:html\` | the whole Book as one self-contained page. |
| **fix** | *— edit a source, then compile* | there is no fix-in-place. |

## Where to change a thing

| To change… | Edit |
|---|---|
| a design law, a territory, the census | \`docs/KINGDOM.md\` — the constitution |
| what a surface is *meant* to do | that surface's \`docs/WRIT-*.md\` |
| a governing number (a cap, a rate, a split) | \`knowledge/facts.json\` — **never a literal in the code** |
| a ratified decision | \`knowledge/decisions.json\` |
| what the code actually does | the code; then re-compile and the page follows |
| the standing of anything | the manifest, \`knowledge/artifacts.json\` |

## Read the standing before you believe the page

Every page renders its standing on its face. \`canon\` is ratified and wins until amended.
\`built\` is in the tree and checkable. **\`proposed\` is a design and may NEVER be cited as
evidence that something works.** \`contested\` means two sources disagree and nobody has ruled.
\`retired\` is history. \`settled\` was decided by Edwin and is not open.

→ [[Map of the Great Book]]

*This page is yours. A durable hand-written note goes here, or it goes in a source.*
`;

// ─────────────────────────────────────────────────────────────────────────────
// Writing — delete and rewrite the shelves this compiler owns, and nothing else
// ─────────────────────────────────────────────────────────────────────────────

function sweepShelves() {
  if (!fs.existsSync(BOOK)) return 0;
  let swept = 0;
  const owned = new Set(Object.values(TYPE_DIRS));
  for (const e of fs.readdirSync(BOOK, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const abs = path.join(BOOK, e.name);
    const isOwned = owned.has(e.name) || fs.existsSync(path.join(abs, MARKER));
    if (!isOwned) continue; // never sweep a shelf this compiler did not build
    fs.rmSync(abs, { recursive: true, force: true });
    swept++;
  }
  return swept;
}

function main() {
  const graph = buildGraph();
  const { nodes, byId } = graph;

  const indexPage = 'Map of the Great Book';
  const validPages = new Set(nodes.map((n) => n.page));
  validPages.add(indexPage);
  validPages.add('Start here — the Great Book');
  // Pages already on disk that this compiler will not overwrite count as resolvable.
  if (fs.existsSync(path.join(BOOK, '00 START HERE.md'))) validPages.add('Start here — the Great Book');

  const downgraded = [];
  const link = makeLinker(validPages, downgraded);

  const written = [];
  for (const n of nodes) written.push([n.file, renderNode(n, byId, link)]);
  written.push([`book/${TYPE_DIRS.map}/INDEX.md`, renderIndex(nodes, byId, link, graph, indexPage)]);

  sweepShelves();
  fs.mkdirSync(BOOK, { recursive: true });
  const dirs = new Set();
  for (const [rel, body] of written) {
    const abs = path.join(REPO, rel);
    const dir = path.dirname(abs);
    if (!dirs.has(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, MARKER), `written by ${GENERATOR}; this whole shelf is deleted and rewritten every compile\n`);
      dirs.add(dir);
    }
    fs.writeFileSync(abs, body);
  }

  // Written once, never again. A hand-written note lives here or in a source.
  const startHere = path.join(BOOK, '00 START HERE.md');
  let startHereMade = false;
  if (!fs.existsSync(startHere)) {
    fs.writeFileSync(startHere, START_HERE);
    startHereMade = true;
  }

  // ── the report: counts only ──
  const byType = countBy(nodes, 'type');
  const byStanding = countBy(nodes, 'standing');
  const edges = nodes.reduce((a, n) => a + n.edges.length, 0);
  // Reachability is measured on the RENDERED pages, exactly as `lint` measures it — a
  // road a reader can walk, not an entry in a data structure.
  const inbound = new Map();
  for (const [rel, body] of written) {
    for (const m of body.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
      const page = m[1].trim();
      if (!inbound.has(page)) inbound.set(page, new Set());
      inbound.get(page).add(rel);
    }
  }
  const orphans = nodes.filter((n) => {
    const froms = inbound.get(n.page);
    return !froms || ![...froms].some((f) => f !== n.file);
  }).length;

  const pad = (s, w) => String(s).padEnd(w);
  console.log(`compile — the Great Book · ${NOW}`);
  console.log(`  pages written   ${written.length}   (${Object.keys(byType).length} kinds, ${edges} roads)`);
  console.log('  by kind        ' + Object.entries(byType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log('  by standing    ' + Object.entries(byStanding).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log(`  mined / derived ${nodes.filter((n) => n.origin === 'mined').length} / ${nodes.filter((n) => n.origin === 'derived').length}`);
  console.log(`  defaulted standing ${nodes.filter((n) => n.standing_source === 'defaulted').length}`);
  console.log(`  orphan pages    ${orphans}   (nothing points at them — see \`book:lint\`)`);
  console.log(`  links downgraded ${downgraded.length}   (unresolvable, written as plain text, never dangled)`);
  for (const d of downgraded.slice(0, 10)) console.log(`      ${pad(d.from, 40)} → ${d.page}`);
  if (graph.duplicateIds.length) console.log(`  duplicate ids   ${graph.duplicateIds.length} (mined record kept)`);
  if (graph.unresolvedLinks.length) console.log(`  dropped links   ${graph.unresolvedLinks.length} (declared at a node that does not exist)`);
  for (const m of graph.missingKnowledge) console.log(`  ABSENT          ${m} — emitted nothing for it, invented nothing in its place`);
  for (const b of graph.brokenKnowledge) console.log(`  UNREADABLE      ${b}`);
  if (startHereMade) console.log('  wrote           book/00 START HERE.md (once — never overwritten again)');
  console.log(`  map             book/${TYPE_DIRS.map}/INDEX.md`);
}

main();
