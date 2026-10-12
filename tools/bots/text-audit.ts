/**
 * Text audit bot: plays reigns with a simple busy bot, captures every line of text the sim
 * shows the player, and flags the ones that come out wrong.
 * Run: npx tsx tools/bots/text-audit.ts [--seeds 12] [--years 6] [--all]
 */
import { Sim } from '../../src/sim/index';
import type { GameState, SimEvent, Incident } from '../../src/sim/types';
import { baseVars } from '../../src/sim/core';
import { fillText } from '../../src/sim/effects';
import { spawnIncident, fitsTarget, defOf } from '../../src/sim/incidents';
import { writeEpitaph } from '../../src/sim/modes';
import { INCIDENTS } from '../../src/data/incidents/index';
import { SPECIES } from '../../src/data/ids';

const argv = process.argv.slice(2);
const arg = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? Number(argv[i + 1]) : d; };
const SEEDS = arg('--seeds', 12);
const YEARS = arg('--years', 6);
const SHOW_ALL = argv.includes('--all');

type Kind = 'herald' | 'say' | 'memory' | 'oath' | 'epitaph' | 'incident' | 'refusal';
const lines = new Map<string, { kind: Kind; src: string; cap: number }>();
function capture(kind: Kind, text: unknown, src: string, cap = 0): void {
  if (typeof text !== 'string') { lines.set(`[non-string ${String(text)}]`, { kind, src, cap }); return; }
  if (!lines.has(text)) lines.set(text, { kind, src, cap });
}

let rng = 12345;
const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)]!;

function varsFor(s: GameState, inc: Incident): Record<string, string | number> {
  return { ...baseVars(s, inc.buildingId ? s.buildings[inc.buildingId] : null, inc.tenantId ? s.tenants[inc.tenantId] : null), ...inc.vars };
}

const seenInc = new Set<string>();
function fillIncident(s: GameState, inc: Incident): void {
  const def = defOf(inc); if (!def) return;
  const v = varsFor(s, inc);
  const tag = (f: string) => `${def.id}.${f}`;
  capture('incident', fillText(def.title, v), tag('title'), 48);
  capture('incident', fillText(def.herald, v), tag('herald'), 150);
  (def.opening ?? []).forEach((o, i) => capture('incident', fillText(o, v), tag(`opening[${i}]`), 240));
  for (const o of def.outcomes) {
    capture('incident', fillText(o.label, v), tag(`${o.id}.label`), 32);
    capture('incident', fillText(o.say, v), tag(`${o.id}.say`), 0);
    capture('incident', fillText(o.reply, v), tag(`${o.id}.reply`), 200);
    capture('incident', fillText(o.result, v), tag(`${o.id}.result`), 170);
  }
  if (def.expireText) capture('incident', fillText(def.expireText, v), tag('expireText'), 170);
  seenInc.add(def.id);
}

function absorb(evs: SimEvent[], s: GameState): void {
  for (const e of evs) {
    if (e.type === 'herald') capture('herald', e.herald.text, `herald:${e.herald.kind}`, 150);
    else if (e.type === 'say') capture('say', e.text, 'say', 0);
  }
  for (const t of Object.values(s.tenants)) for (const m of t.memory) capture('memory', m.text, `memory:${t.id}`, 0);
  for (const o of s.oaths) capture('oath', o.text, `oath:${o.kind}`, 0);
}

function bot(sim: Sim): void {
  const s = sim.state;
  const d = (a: Parameters<Sim['dispatch']>[0]) => {
    const r = sim.dispatch(a);
    if (!r.ok) capture('refusal', r.reason, `refusal:${a.type}:${r.code}`, 0);
    return r;
  };
  d({ type: 'collect_all' });
  for (const inc of Object.values(s.incidents)) {
    if (inc.state !== 'open') continue;
    fillIncident(s, inc);
    const def = defOf(inc); if (!def) continue;
    let o = pick(def.outcomes);
    if (def.decision === 'applicant' && rand() < 0.7) o = def.outcomes.find(x => /accept|lease|house/.test(x.id + (x.option ?? ''))) ?? o;
    const r = d({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o.id });
    if (!r.ok) for (const o2 of def.outcomes) { if (d({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o2.id }).ok) break; }
  }
  for (const b of Object.values(s.buildings)) {
    if (b.condition < 60 && rand() < 0.3) d({ type: 'order_job', kind: 'repair', buildingId: b.id });
    for (const u of b.units ?? []) if (!u.tenantId && !u.listed && rand() < 0.5) d({ type: 'set_listed', buildingId: b.id, listed: true });
  }
  for (const a of Object.values(s.applicants)) if (rand() < 0.3) d({ type: 'order_job', kind: 'show', applicantId: a.id, buildingId: (a as { buildingId?: string }).buildingId });
  if (s.charter.ready) d({ type: 'accept_promotion' });
  if (s.candidates.length && rand() < 0.2) d({ type: 'hire', candidateId: pick(s.candidates).id });
  if (s.gold > 150 && rand() < 0.15) {
    const btype = pick(['hovel', 'cottage', 'burrow', 'longhouse'] as const);
    const own = s.map.parcels.filter(p => (p as { owned?: boolean }).owned);
    for (let k = 0; k < 20; k++) {
      const x = Math.floor(rand() * s.map.w), y = Math.floor(rand() * s.map.h);
      void own;
      if (sim.dispatch({ type: 'place_building', btype, x, y, rot: 0 }).ok) break;
    }
  }
  const tenants = Object.values(s.tenants).filter(t => t.status === 'housed');
  if (tenants.length && rand() < 0.05) {
    const t = pick(tenants);
    const kind = pick(['word', 'repair', 'no_rent_raise', 'no_evict', 'pay'] as const);
    d({ type: 'swear_oath', oath: { kind, text: pick(['I will see to it.', `I will mend your roof by spring.`, 'Your rent will not rise this year.']), toTenantId: t.id, toName: t.name, buildingId: t.buildingId, buildingType: null, amount: kind === 'pay' ? 20 : null, dueDay: s.day + 20 + Math.floor(rand() * 60) } as never });
    if (rand() < 0.4) { const o = pick(s.oaths); if (o) d({ type: 'release_oath', oathId: o.id }); }
  }
  if (tenants.length && rand() < 0.05) { const t = pick(tenants); d({ type: 'set_rent', buildingId: t.buildingId!, rent: Math.round((t.lease?.rent ?? 10) * 1.3) }); }
  if (tenants.length && rand() < 0.04) d({ type: 'gift', tenantId: pick(tenants).id, amount: 5 });
  if (rand() < 0.01) d({ type: 'hold_feast' });
}

for (let seed = 1; seed <= SEEDS; seed++) {
  for (const mode of ['peace', 'iron'] as const) {
    rng = seed * 7919 + (mode === 'iron' ? 1 : 0);
    let sim: Sim;
    try { sim = Sim.create({ seed: seed * 1013, mode, ruler: pick(['Aldous', 'Brother Hugh', 'Edwina']) }); } catch (e) { console.error('create failed', seed, mode, e); continue; }
    absorb(sim.drain(), sim.state);
    const days = YEARS * 12 * 30;
    for (let day = 0; day < days && !sim.state.ended; day++) {
      try { absorb(sim.advanceDays(1), sim.state); bot(sim); absorb(sim.drain(), sim.state); } catch (e) { console.error('step failed', seed, mode, day, (e as Error).message); break; }
    }
    if (sim.state.ended) capture('epitaph', sim.state.ended.epitaph, 'epitaph:ended', 0);
    for (const c of ['bankrupt', 'charter_revoked', 'abdicated', 'demoted_debt', 'demoted_favor'] as const) {
      try { capture('epitaph', writeEpitaph(sim.state, c as never, { from: 'knight', to: 'reeve', debt: 300 }), `epitaph:${c}`, 0); } catch { /* */ }
    }
    // direct fills: every incident def against a fitting target in this state
    const s = sim.state;
    const targets: { buildingId?: string; unit?: number; tenantId?: string; applicantId?: string }[] = [];
    for (const t of Object.values(s.tenants)) if (t.status === 'housed') targets.push({ tenantId: t.id, buildingId: t.buildingId ?? undefined, unit: t.unit ?? undefined });
    for (const b of Object.values(s.buildings)) { targets.push({ buildingId: b.id }); (b.units ?? []).forEach((u, i) => { if (!u.tenantId) targets.push({ buildingId: b.id, unit: i }); }); }
    for (const a of Object.values(s.applicants)) targets.push({ applicantId: a.id, buildingId: (a as { buildingId?: string }).buildingId });
    targets.push({});
    for (const def of INCIDENTS) {
      const fit = targets.filter(t => { try { return fitsTarget(s, def, t); } catch { return false; } });
      const tries = fit.length ? [pick(fit), pick(fit)] : targets.slice(0, 3);
      for (const t of tries) {
        const copy = JSON.parse(JSON.stringify(s)) as GameState;
        try {
          const inc = spawnIncident(copy, def.id, t);
          if (inc) { fillIncident(copy, inc); for (const e of copy._events) if (e.type === 'herald') capture('herald', e.herald.text, `herald:${def.id}`, 150); }
        } catch (e) { capture('refusal', `[spawn threw ${def.id}: ${(e as Error).message}]`, def.id, 0); }
      }
    }
  }
}

// ───────────── checks ─────────────
const AN_OK = /^(hour|honest|honou?r|heir|herb)/i;              // silent h
const A_OK = /^(uni|use|usu|uto|eu|ewe|one|once|ur[ai]|u[bcfgklmnprstv][aeiou]|u$)/i; // consonant-sound vowels
function articleProblems(t: string): string[] {
  const out: string[] = [];
  const re = /\b(a|an|A|An)\s+([A-Za-z][\w'-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const art = m[1]!.toLowerCase(), w = m[2]!;
    if (/^[A-Z]$/.test(w)) continue;
    const vowel = /^[aeiou]/i.test(w) ? !A_OK.test(w) : AN_OK.test(w);
    if (art === 'a' && vowel) out.push(`a ${w}`);
    if (art === 'an' && !vowel) out.push(`an ${w}`);
  }
  return out;
}
const PLURALS: [RegExp, string][] = [
  [/\b1 (crowns|households|days|months|years|tenants|weeks|coins|souls|goblins|dwarves|elves|ogres|halflings|humans|rooms|units|nights)\b/i, '1 + plural'],
  [/\b(?:[02-9]|\d{2,}) (crown|household|day|month|year|tenant|week)\b(?![-'])/i, 'n + singular'],
  [/\bDwarfs\b|\bElfs\b|\bdwarfs\b|\belfs\b|\bhalfling's\b(?= are)/, 'species plural'],
  [/\b(dwarfs|elfs|goblin|ogre|halfling|human|elf|dwarf)s?\b households?\b/i, ''],
];
function check(t: string, cap: number): string[] {
  const f: string[] = [];
  if (/[{}]/.test(t)) f.push('braces');
  if (/\b(undefined|null|NaN)\b|\[object/.test(t)) f.push('undefined/null/NaN');
  if (/ {2,}/.test(t)) f.push('double space');
  if (/\s[,.;:!?]/.test(t)) f.push('space before punct');
  for (const a of articleProblems(t)) f.push(`article "${a}"`);
  for (const [re, n] of PLURALS) if (n && re.test(t)) f.push(n + ': ' + (t.match(re)?.[0] ?? ''));
  if (/^[a-z]/.test(t) && !/^(my lord|a |an )/.test('')) f.push('lower-case start');
  const sent = t.replace(/\.\.\.|…/g, '…').match(/[.!?]["']?\s+[a-z]\w*/g);
  if (sent) for (const x of sent) if (!/\b(e\.g|i\.e|etc|vs)\./i.test(x)) f.push(`lower-case sentence "${x.trim()}"`);
  const dbl = t.replace(/-To to\b/g, '-To').match(/\b(\w+)\s+\1\b/i); if (dbl && !/^(had|that|ha|very|no|knock|tap|lo|bye|on|out|far|again|round|well|hush|there|more)$/i.test(dbl[1]!)) f.push(`doubled word "${dbl[0]}"`);
  if (/\.\.(?!\.)|\.,|,\.|,,|\.\s*\.(?!\.)/.test(t.replace(/\.\.\./g, '…'))) f.push('doubled punct');
  if (/[–—]/.test(t)) f.push('dash');
  if (cap && t.length > cap) f.push(`over cap ${t.length}/${cap}`);
  if (/\bthe\s+(household|family|tenant)\b/.test(t) && /\bthe\s{2,}/.test(t)) f.push('name missing');
  if (/\b(the|a|an|your|of|to|for|with)\s+[,.;:!?]/i.test(t) || /\b(the|a|an|your)\s*$/i.test(t)) f.push('missing word after article');
  if (/(^|\s)'s\b/.test(t)) f.push("orphan 's (blank name)");
  if (/\b(staff|pet)\b/.test(t) && /\{(staff|pet)\}/.test(t)) f.push('pet/staff unfilled');
  if (/^\s|\s$/.test(t)) f.push('edge whitespace');
  if (t.length === 0) f.push('empty');
  return f;
}

let flagged = 0;
const byClass = new Map<string, number>();
const kinds = new Map<string, number>();
for (const [t, info] of lines) {
  kinds.set(info.kind, (kinds.get(info.kind) ?? 0) + 1);
  const f = check(t, info.cap);
  if (!f.length) { if (SHOW_ALL) console.log(`ok   [${info.src}] ${t}`); continue; }
  flagged++;
  for (const x of f) { const k = x.replace(/[:"].*$/, '').replace(/ \d+\/\d+$/, '').trim(); byClass.set(k, (byClass.get(k) ?? 0) + 1); }
  console.log(`FLAG [${info.src}] {${f.join('; ')}} ${t}`);
}
console.log('\n---');
console.log(`distinct lines: ${lines.size}  flagged: ${flagged}`);
console.log('by kind:', Object.fromEntries(kinds));
console.log('by class:', Object.fromEntries(byClass));
const missing = INCIDENTS.filter(d => !seenInc.has(d.id)).map(d => d.id);
console.log(`incident defs filled: ${seenInc.size}/${INCIDENTS.length}${missing.length ? ' missing: ' + missing.join(', ') : ''}`);
void SPECIES;
