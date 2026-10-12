/**
 * Content linter. Run:  npx tsx tools/validate-content.ts [fileFilter]
 * Checks every IncidentDef (and other content) against the rules in
 * docs/STYLE.md and data/schema.ts. Exit 1 on errors. Pass a substring of an
 * incident id prefix or category to narrow the report.
 */
import { INCIDENTS } from '../src/data/incidents/index';
import { ICONS, VISUALS, BUILDING_TYPES, SPECIES, TRADES, TRAITS, TENANT_TAGS, PET_KINDS, NPCS } from '../src/data/ids';
import { DECISION_OPTIONS, RANK_ORDER } from '../src/sim/types';
import type { IncidentDef, Effect } from '../src/data/schema';

const filter = process.argv[2] ?? '';
const errs: string[] = []; const warns: string[] = [];
const ids = new Map<string, number>();
for (const d of INCIDENTS) ids.set(d.id, (ids.get(d.id) ?? 0) + 1);
const TENANT_PH = ['tenant', 'first', 'trade', 'species', 'pet'];
const BUILDING_PH = ['building', 'btype', 'rent'];
const ALWAYS_PH = ['ruler', 'title', 'realm', 'rival', 'season', 'month', 'amount', 'staff'];
const DASH = /[—–]/;
const CAPS = { title: 48, herald: 150, opening: 240, reply: 200, label: 32, result: 170, say: 160, expireText: 170 };

function texts(d: IncidentDef): [string, string, number][] {
  const out: [string, string, number][] = [['title', d.title, CAPS.title], ['herald', d.herald, CAPS.herald]];
  for (const o of d.opening ?? []) out.push(['opening', o, CAPS.opening]);
  if (d.expireText) out.push(['expireText', d.expireText, CAPS.expireText]);
  for (const o of d.outcomes) { out.push([`${o.id}.label`, o.label, CAPS.label], [`${o.id}.say`, o.say, CAPS.say], [`${o.id}.reply`, o.reply, CAPS.reply], [`${o.id}.result`, o.result, CAPS.result]); }
  return out;
}
function checkEffects(d: IncidentDef, where: string, effects: Effect[], E: (m: string) => void) {
  for (const e of effects) {
    if (e.t === 'spawn' && !ids.has(e.id)) E(`${where}: spawn target "${e.id}" does not exist`);
    if ((e.t === 'late' || e.t === 'evict' || e.t === 'leave' || e.t === 'rent' || e.t === 'arrears' || e.t === 'memory' || e.t === 'trait' || e.t === 'pet' || e.t === 'deposit') && d.target !== 'tenant' && d.target !== 'building' && !(d.target === 'vacant' && d.decision === 'applicant'))
      E(`${where}: effect "${e.t}" needs target 'tenant' or 'building' (this incident targets '${d.target}')`);
    if (e.t === 'condition' && d.target === 'realm') E(`${where}: effect "condition" needs a building target`);
    if (e.t === 'visual' && ((e.add && !VISUALS.includes(e.add)) || (e.remove && !VISUALS.includes(e.remove)))) E(`${where}: unknown visual`);
    if (e.t === 'gold' && Math.abs(e.amount) > 400) warns.push(`${d.id} ${where}: large gold effect ${e.amount}`);
    if (e.t === 'memory' && DASH.test(e.text)) E(`${where}: memory text has a dash`);
  }
}
let n = 0;
for (const d of INCIDENTS) {
  if (filter && !d.id.includes(filter) && d.category !== filter) continue;
  n++;
  const E = (m: string) => errs.push(`${d.id}: ${m}`);
  if (!/^[a-z][a-z0-9_]*$/.test(d.id)) E('id must be snake_case');
  if ((ids.get(d.id) ?? 0) > 1) E('duplicate id');
  if (!ICONS.includes(d.icon)) E(`unknown icon "${d.icon}"`);
  if (d.visual && !VISUALS.includes(d.visual)) E(`unknown visual "${d.visual}"`);
  if (!RANK_ORDER.includes(d.minRank)) E('bad minRank');
  if (d.outcomes.length < 2 || d.outcomes.length > 5) E(`needs 2-4 outcomes (has ${d.outcomes.length})`);
  const oids = new Set<string>();
  for (const o of d.outcomes) {
    if (oids.has(o.id)) E(`duplicate outcome id "${o.id}"`); oids.add(o.id);
    if (d.decision !== 'custom') { if (!o.option) E(`outcome "${o.id}" needs an option tag (decision ${d.decision})`); else if (!DECISION_OPTIONS[d.decision].includes(o.option)) E(`outcome "${o.id}" option "${o.option}" is not valid for decision ${d.decision}`); }
    if (!o.intent || o.intent.length < 12) E(`outcome "${o.id}" needs an intent sentence`);
    checkEffects(d, `outcome ${o.id}`, o.effects, E);
    if (o.job && o.job.days > 6) warns.push(`${d.id}: outcome ${o.id} job is long (${o.job.days} days)`);
  }
  checkEffects(d, 'onExpire', d.onExpire, E);
  if (!d.audience && d.outcomes.filter(o => o.default).length !== 1) E('non-audience incidents need exactly one outcome with default: true');
  if (d.audience) {
    if (!d.petitioner) E('audience incidents need a petitioner');
    if (!d.opening || d.opening.length < 2) E('audience incidents need 2-3 opening lines');
    if (!d.stance || d.stance.length < 30) E('audience incidents need a stance');
    if (d.petitioner === 'tenant' && d.target !== 'tenant') E("petitioner 'tenant' needs target 'tenant'");
    if (typeof d.petitioner === 'object' && !NPCS.includes(d.petitioner.npc)) E('unknown npc');
  }
  if (d.timerDays <= 0 && d.onExpire.length) warns.push(`${d.id}: onExpire never fires (timerDays 0)`);
  if (d.system && d.decision === 'custom') E('system incidents need a decision type');
  const r = d.requires;
  if (r) {
    for (const b of [...(r.buildingType ?? []), ...(r.hasBuilding ?? []), ...(r.lacksBuilding ?? [])]) if (!BUILDING_TYPES.includes(b)) E(`requires: unknown building ${b}`);
    for (const x of r.species ?? []) if (!SPECIES.includes(x)) E(`requires: unknown species ${x}`);
    for (const x of r.trade ?? []) if (!TRADES.includes(x)) E(`requires: unknown trade ${x}`);
    for (const x of r.trait ?? []) if (!TRAITS.includes(x)) E(`requires: unknown trait ${x}`);
    for (const x of r.tag ?? []) if (!TENANT_TAGS.includes(x)) E(`requires: unknown tag ${x}`);
    for (const x of r.pet ?? []) if (!PET_KINDS.includes(x)) E(`requires: unknown pet ${x}`);
    if ((r.species || r.trade || r.trait || r.tag || r.hasPet !== undefined || r.pet || r.happinessBelow !== undefined || r.happinessAbove !== undefined || r.monthsHousedAbove !== undefined) && d.target !== 'tenant') E(`requires uses household conditions but target is '${d.target}'`);
    if (r.vacantDaysAbove !== undefined && d.target !== 'vacant') E("requires.vacantDaysAbove needs target 'vacant'");
  }
  for (const [where, text, cap] of texts(d)) {
    if (!text || !text.trim()) { E(`${where}: empty`); continue; }
    if (DASH.test(text)) E(`${where}: contains an em/en dash`);
    if (text.length > cap) E(`${where}: ${text.length} chars (cap ${cap})`);
    for (const m of text.matchAll(/\{(\w+)\}/g)) {
      const k = m[1]!;
      if (ALWAYS_PH.includes(k)) continue;
      if (TENANT_PH.includes(k)) { if (d.target !== 'tenant' && !(d.target === 'vacant' && d.decision === 'applicant' && k !== 'pet')) E(`${where}: {${k}} needs target 'tenant'`); if (k === 'pet' && !(r?.hasPet || r?.pet) && d.decision !== 'pet') E(`${where}: {pet} needs requires.hasPet`); continue; }
      if (BUILDING_PH.includes(k)) { if (d.target === 'realm') E(`${where}: {${k}} needs a building target`); continue; }
      E(`${where}: unknown placeholder {${k}}`);
    }
  }
}
const cats = new Map<string, number>();
for (const d of INCIDENTS) cats.set(d.category, (cats.get(d.category) ?? 0) + 1);
console.log(`checked ${n} of ${INCIDENTS.length} incidents. by category: ${[...cats].map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (warns.length) console.log('\nWARNINGS\n' + warns.join('\n'));
if (errs.length) { console.log('\nERRORS\n' + errs.join('\n')); console.log(`\n${errs.length} error(s).`); process.exit(1); }
console.log('content OK');
