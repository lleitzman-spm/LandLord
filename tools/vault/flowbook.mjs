// READING THE FLOW BOOK — the operational graph, found rather than authored.
//
// WHY THIS FILE EXISTS
// `knowledge/artifacts.json` has always declared a KIND axis with `operational` on
// it, and the Great Book has never had a single operational page. The five paths
// carrying that kind are whole directories — `src`, `data`, `supabase` — which is
// the coarsest possible use of the axis and teaches a reader nothing. Meanwhile
// `src/domain/flows.ts` holds `FOUNDING_FLOWS`: five real event-driven workflows,
// forty-six steps, each with a holder, a board, a timing edge and an SLA. The
// operational graph was in the tree the whole time and nothing mined it.
//
// That makes this graph better evidenced than a hand-authored one could be. Every
// place, arrow and guard below comes from a declaration the application itself
// reads at runtime — so `built` is honest, and a step renamed in the code renames
// its page on the next compile instead of quietly disagreeing with it.
//
// HOW IT IS READ, AND WHY NOT WITH A REGEX
// The flow book is TypeScript, and the rest of `tools/vault/` is dependency-free
// pure Node with no build step (the CI job runs it without `npm ci`, on purpose).
// Rather than guess at the source with a regular expression — which would drift
// silently the first time somebody used a computed value — this evaluates the real
// module in a child process under Node 22's `--experimental-strip-types`, with a
// tiny resolver hook for the repo's extensionless imports. Still no dependency;
// still nothing to install. If that fails for any reason the miner returns a GAP
// rather than a guess, exactly as an absent knowledge file does.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO, makeNode, slugify } from './lib.mjs';

const FLOWS_TS = 'src/domain/flows.ts';

/** Node resolves `./events` only if it is written `./events.ts`; the repo writes it
 *  extensionless. Fifteen lines of resolver hook, no dependency. */
const HOOK = `
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL?.startsWith('file:')) {
    const base = path.dirname(fileURLToPath(ctx.parentURL));
    const abs = path.resolve(base, spec);
    for (const c of [abs + '.ts', abs + '.tsx', path.join(abs, 'index.ts')]) {
      if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true };
    }
  }
  return next(spec, ctx);
}`;

const CATALOG_TS = 'src/domain/catalog.ts';
const CENSUS_TS = 'src/domain/census.ts';

/** Evaluate the three declarations the operational graph is built from, in ONE child
 *  process: the flow book, the catalog (the event taxonomy every step references by
 *  key) and the census (the hands a step is held by). The last two are mined as
 *  knowledge, not as machinery — they are what the flows CONSUME, and without them
 *  every step's `catalogRow` and `holder` would point at nothing. */
export function readFlowBook() {
  const abs = path.join(REPO, FLOWS_TS);
  if (!fs.existsSync(abs)) return { book: null, reason: `${FLOWS_TS} is not on disk` };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowbook-'));
  try {
    const hook = path.join(dir, 'hook.mjs');
    const entry = path.join(dir, 'dump.mjs');
    fs.writeFileSync(hook, HOOK);
    fs.writeFileSync(
      entry,
      `import { register } from 'node:module';\n` +
        `register(${JSON.stringify(pathUrl(hook))}, import.meta.url);\n` +
        `const m = await import(${JSON.stringify(pathUrl(abs))});\n` +
        `let catalog = [], people = [];\n` +
        `try { catalog = (await import(${JSON.stringify(pathUrl(path.join(REPO, CATALOG_TS)))})).FOUNDING_CATALOG ?? []; } catch {}\n` +
        `try { people = ((await import(${JSON.stringify(pathUrl(path.join(REPO, CENSUS_TS)))})).census ?? {}).people ?? []; } catch {}\n` +
        `process.stdout.write(JSON.stringify({ book: m.FOUNDING_FLOWS ?? null, catalog, people }));\n`,
    );
    const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', entry], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    });
    const parsed = JSON.parse(out);
    if (!Array.isArray(parsed.book)) return { book: null, reason: `${FLOWS_TS} exports no FOUNDING_FLOWS array` };
    return { book: parsed.book, catalog: parsed.catalog || [], people: parsed.people || [], reason: '' };
  } catch (e) {
    return { book: null, reason: `${FLOWS_TS} could not be evaluated: ${String(e.message || e).split('\n')[0]}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Read a source for line numbers; absent is not fatal, the page just carries none. */
function safeRead(rel) {
  try {
    return fs.readFileSync(path.join(REPO, rel), 'utf8');
  } catch {
    return '';
  }
}

function pathUrl(p) {
  return new URL(`file://${p}`).href;
}

/** Best-effort line for a step or flow key, so a page can point at the source. */
function lineOf(raw, key) {
  const at = raw.indexOf(`'${key}'`);
  if (at === -1) return null;
  return raw.slice(0, at).split('\n').length;
}

/** A timing edge in plain words. `after: -14, before: -7` is "between fourteen and
 *  seven days BEFORE the event" — negative offsets run backwards from the trigger,
 *  which is the single most misreadable thing in the flow book. */
export function edgeInWords(edge, slaDays, repeatEveryDays) {
  const e = edge || {};
  const day = (n) => (n === 0 ? 'the day it fires' : n < 0 ? `${-n} day${-n === 1 ? '' : 's'} BEFORE the event` : `day ${n}`);
  const parts = [];
  if (e.after !== undefined && e.before !== undefined) parts.push(`between ${day(e.after)} and ${day(e.before)}`);
  else if (e.after !== undefined) parts.push(`on or after ${day(e.after)}`);
  else if (e.before !== undefined) parts.push(`no later than ${day(e.before)}`);
  if (e.onOrAfterDayOfMonth !== undefined) parts.push(`on or after the ${e.onOrAfterDayOfMonth}th of the month`);
  if (e.beforeDayOfMonth !== undefined) parts.push(`before the ${e.beforeDayOfMonth}th of the month`);
  if (!parts.length) parts.push('as soon as the step before it is done');
  if (repeatEveryDays) parts.push(`then again every ${repeatEveryDays} days`);
  if (slaDays !== undefined) parts.push(`and it is BREACHED if it sits ${slaDays} day${slaDays === 1 ? '' : 's'} past that`);
  return parts.join(', ');
}

/** EVERY GOVERNING NUMBER IN THE FLOW BOOK, AS A FIRST-CLASS OBJECT.
 *
 *  There are 116 of them — every SLA, every day offset, every calendar edge and
 *  repeat interval — and until now each was a bare integer sitting in a step. A
 *  bare integer has no room to say what KIND of quantity it is, what date it is
 *  measured from, or who decided it. `slaDays: 5` cannot tell you whether five
 *  days is a statutory deadline, a client promise, or somebody's preference from
 *  a meeting, and it cannot tell you it disagrees with the five somewhere else.
 *
 *  Note what this deliberately does NOT do: it does not move the numbers out of
 *  the flow book. The flow book IS the configuration — the whole design is that
 *  no branch of code knows the word "move-out" — so a number living there is
 *  already declared rather than buried in an expression. What was missing was
 *  identity and provenance, and that is what a fact adds.
 *
 *  `anchor` is the field this repo learned the hard way. A day offset is
 *  meaningless without the date it counts from; leaving it implicit made one step
 *  read as permanently breached. Every day-offset fact below carries it. */
function timingFactNodes(book, raw) {
  const nodes = [];
  const flowsByKey = new Map(book.map((t) => [t.key, t]));
  const push = (flowKey, step, kind, field, value, unit, anchor, why) => {
    const t = flowsByKey.get(flowKey);
    nodes.push(
      makeNode({
        id: `fact:flow-${slugify(flowKey)}-${slugify(step.key)}-${slugify(field)}`,
        type: 'fact',
        label: `${t ? t.title : flowKey} · ${step.key} · ${field}`,
        standing: 'built',
        standing_source: 'derived',
        summary: why,
        source_path: FLOWS_TS,
        source_line: lineOf(raw, step.key),
        quote: `key: '${step.key}'`,
        origin: 'derived',
        edges: [
          { to: `place:${slugify(flowKey)}-${slugify(step.key)}`, why: 'the step this number governs' },
          { to: `flow:${slugify(flowKey)}`, why: 'declared in this flow' },
          { to: `module:${FLOWS_TS}`, why: 'declared in this module' },
        ],
        extra: { factKind: kind, value, unit, anchor, field, flowKey, stepKey: step.key },
      }),
    );
  };
  for (const t of book) {
    for (const step of t.steps || []) {
      const e = step.edge || {};
      const anchor = e.anchor === 'target' ? "the case's target date" : 'the day the case opened';
      for (const f of ['after', 'before']) {
        if (typeof e[f] !== 'number') continue;
        push(t.key, step, 'day-offset', f, e[f], 'days', anchor,
          `${f === 'after' ? 'Earliest' : 'Latest'} this step may start: ${e[f]} day(s) from ${anchor}.`);
      }
      for (const f of ['onOrAfterDayOfMonth', 'beforeDayOfMonth']) {
        if (typeof e[f] !== 'number') continue;
        push(t.key, step, 'calendar-deadline', f, e[f], 'day-of-month', 'the calendar month',
          `A calendar edge: the step is bound to the ${e[f]}th of the month. Money steps carry these so a payment lands in the right disbursement.`);
      }
      if (typeof step.slaDays === 'number')
        push(t.key, step, 'duration-threshold', 'slaDays', step.slaDays, 'days', "this step's own edge",
          `The wait: ${step.slaDays} day(s) past its edge before the reading calls this step breached.`);
      if (typeof step.repeatEveryDays === 'number')
        push(t.key, step, 'cadence', 'repeatEveryDays', step.repeatEveryDays, 'days', "this step's own edge",
          `Repeats every ${step.repeatEveryDays} day(s)${step.condition ? ` ${step.condition}` : ''}.`);
    }
  }
  return nodes;
}

/** The whole operational graph, as nodes. Places are steps; arrows are the declared
 *  cascade order (the `steps` array IS the order the application walks); guards are
 *  the timing edges and SLAs; tokens are what a case carries while it moves. */
export function flowBookNodes() {
  const { book, catalog, people, reason } = readFlowBook();
  if (!book) return { nodes: [], present: false, reason };
  const raw = fs.readFileSync(path.join(REPO, FLOWS_TS), 'utf8');
  const nodes = [];

  // ── the knowledge the flows consume ───────────────────────────────────────
  // Mined here rather than in `knowledgeNodes` because these two declarations are
  // the ONLY reason a step's `catalogRow` and `holder` mean anything. Without them
  // the operational graph's roads out would all point at strangers — which is
  // exactly what happened on the first run of this miner: 92 dropped links, every
  // one of them a step reaching for a task or a hand that had no page.
  const catRaw = safeRead(CATALOG_TS);
  for (const row of catalog) {
    if (!row || !row.key) continue;
    nodes.push(
      makeNode({
        id: `task:${slugify(row.key)}`,
        type: 'task',
        label: row.title || row.key,
        standing: 'built',
        standing_source: 'derived',
        summary: row.note || `${row.class ? `A ${row.class} task` : 'A task'}${row.mode ? `, ${row.mode}` : ''}${row.domain ? `, in ${row.domain}` : ''}.`,
        source_path: CATALOG_TS,
        source_line: catRaw ? lineOf(catRaw, row.key) : null,
        quote: `key: '${row.key}'`,
        origin: 'derived',
        edges: [{ to: `module:${CATALOG_TS}`, why: 'declared in this module' }],
        extra: { row },
      }),
    );
  }

  // Every holder a flow actually names. A census person is a real hand; anything
  // else is a QUEUE — a role nobody holds yet, which the flow book says outright
  // ("the queue reads as the holder until a setting maps it"). Naming the queues
  // as such is the point: an unstaffed role is a finding, not a blank.
  const censusRaw = safeRead(CENSUS_TS);
  const byPerson = new Map((people || []).map((p) => [p.id, p]));
  const handLabel = (h) => (byPerson.get(h) ? byPerson.get(h).name || h : h);
  const namedHolders = new Set();
  for (const t of book) for (const s of t.steps || []) if (s.holder) namedHolders.add(s.holder);
  for (const h of [...namedHolders].sort()) {
    const person = byPerson.get(h);
    nodes.push(
      makeNode({
        id: `hand:${slugify(h)}`,
        type: 'hand',
        label: person ? person.name || h : h,
        standing: 'built',
        standing_source: 'derived',
        summary: person
          ? `A hand in the census${person.pledge ? `, pledged ${person.pledge}` : ''}.`
          : 'A QUEUE, not a person — a role nobody holds yet. It reads as the holder until a setting maps it to somebody.',
        source_path: person ? CENSUS_TS : FLOWS_TS,
        source_line: person && censusRaw ? lineOf(censusRaw, h) : lineOf(raw, h),
        quote: person ? `id: '${h}'` : `holder: '${h}'`,
        origin: 'derived',
        edges: [{ to: `module:${person ? CENSUS_TS : FLOWS_TS}`, why: 'declared in this module' }],
        extra: { person: person || null, isQueue: !person },
      }),
    );
  }

  for (const t of book) {
    const fid = `flow:${slugify(t.key)}`;
    const steps = Array.isArray(t.steps) ? t.steps : [];
    const edges = [];
    const boards = [...new Set(steps.map((s) => s.board).filter(Boolean))];
    const holders = [...new Set(steps.map((s) => s.holder).filter(Boolean))];

    for (const s of steps) edges.push({ to: `place:${slugify(t.key)}-${slugify(s.key)}`, why: `a step of this flow` });
    edges.push({ to: `module:${FLOWS_TS}`, why: 'declared in this module' });

    nodes.push(
      makeNode({
        id: fid,
        type: 'flow',
        label: t.title || t.key,
        standing: 'built',
        standing_source: 'derived',
        summary: `Triggered by: ${t.trigger}. ${steps.length} steps across ${boards.length} board(s), ${holders.length} hand(s).`,
        source_path: FLOWS_TS,
        source_line: lineOf(raw, t.key),
        quote: `key: '${t.key}'`,
        origin: 'derived',
        edges,
        extra: { flow: t, boards, holders, stepCount: steps.length, handLabels: Object.fromEntries(holders.map((h) => [h, handLabel(h)])) },
      }),
    );

    steps.forEach((s, i) => {
      const pid = `place:${slugify(t.key)}-${slugify(s.key)}`;
      const pEdges = [];
      // The catalog row and the holder are the two roads OUT of the operational
      // graph and into the knowledge graph — the whole point of the KIND axis.
      // Both are literal ids, so both are found rather than asserted.
      if (s.catalogRow) pEdges.push({ to: `task:${slugify(s.catalogRow)}`, why: `its \`catalogRow\` names \`${s.catalogRow}\` by id` });
      if (s.holder) pEdges.push({ to: `hand:${slugify(s.holder)}`, why: `its \`holder\` names \`${s.holder}\` by id` });
      pEdges.push({ to: fid, why: 'a step of this flow' });
      pEdges.push({ to: `module:${FLOWS_TS}`, why: 'declared in this module' });

      nodes.push(
        makeNode({
          id: pid,
          type: 'place',
          label: `${t.title || t.key}: ${s.key}`,
          standing: 'built',
          standing_source: 'derived',
          summary: s.note || s.condition || `Held by ${s.holder} on the ${s.board} board.`,
          source_path: FLOWS_TS,
          source_line: lineOf(raw, s.key),
          quote: `key: '${s.key}'`,
          origin: 'derived',
          edges: pEdges,
          extra: { step: s, flowKey: t.key, index: i, holderLabel: handLabel(s.holder), timing: edgeInWords(s.edge, s.slaDays, s.repeatEveryDays) },
        }),
      );

      // ── the arrow ─────────────────────────────────────────────────────────
      // The `steps` array is the declared cascade: this is the order the running
      // application walks, so consecutive steps are a found edge, not a guess at
      // one. The last step has no arrow out — it is where a case comes to rest.
      const next = steps[i + 1];
      if (next) {
        const nid = `place:${slugify(t.key)}-${slugify(next.key)}`;
        const gid = `guard:${slugify(t.key)}-${slugify(next.key)}`;
        nodes.push(
          makeNode({
            id: `transition:${slugify(t.key)}-${slugify(s.key)}-to-${slugify(next.key)}`,
            type: 'transition',
            label: `${s.key} → ${next.key}`,
            standing: 'built',
            standing_source: 'derived',
            summary: `The case leaves ${s.key} for ${next.key}, ${edgeInWords(next.edge, next.slaDays, next.repeatEveryDays)}.`,
            source_path: FLOWS_TS,
            source_line: lineOf(raw, next.key),
            quote: `key: '${next.key}'`,
            origin: 'derived',
            edges: [
              { to: pid, why: 'the step it leaves' },
              { to: nid, why: 'the step it arrives at' },
              { to: gid, why: 'the timing that must hold first' },
              { to: fid, why: 'an arrow of this flow' },
              { to: `module:${FLOWS_TS}`, why: 'declared in this module' },
            ],
            extra: { from: s.key, to: next.key, flowKey: t.key, timing: edgeInWords(next.edge, next.slaDays, next.repeatEveryDays), handover: s.holder !== next.holder ? `${s.holder} → ${next.holder}` : '' },
          }),
        );
        nodes.push(
          makeNode({
            id: gid,
            type: 'guard',
            label: `when ${next.key} may start`,
            standing: 'built',
            standing_source: 'derived',
            summary: edgeInWords(next.edge, next.slaDays, next.repeatEveryDays),
            source_path: FLOWS_TS,
            source_line: lineOf(raw, next.key),
            quote: `key: '${next.key}'`,
            origin: 'derived',
            edges: [
              { to: fid, why: 'a condition inside this flow' },
              { to: `module:${FLOWS_TS}`, why: 'declared in this module' },
            ],
            extra: { edge: next.edge || {}, slaDays: next.slaDays, repeatEveryDays: next.repeatEveryDays, condition: next.condition || '' },
          }),
        );
      }
    });
  }
  nodes.push(...timingFactNodes(book, raw));
  return { nodes, present: true, reason: '' };
}
