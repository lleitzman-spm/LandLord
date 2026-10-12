/**
 * The digest: a compact text snapshot of the realm that a model can act on.
 *
 * Token-thrifty and stable in shape. Everything the model may refer to carries
 * its id, written with a leading # (ids are short base-36 strings, and some of
 * them spell words: "to", "be", "by"). When the realm is large the digest is
 * scoped: whatever the ruler's words or the addressee make relevant is written
 * out in full, and the rest is kept as a one-line index of ids and names so
 * nothing named is ever unknown.
 */
import type { GameState, Building, Tenant, StaffRole, Incident, Id, Season } from '../sim/types';
import { STAFF_ROLES, RANK_ORDER } from '../sim/types';
import { BUILDINGS, RANKS, BAL, TEMPERAMENT_DEFS, ROLE_TITLES } from '../data';
import { dateOf, fmtDate } from '../sim/core';
import type { SpeakTarget } from './api';
import { defOf, openIncidents, housedTenants, staffByRole, tenantsIn, mentioned, mid, clip, costOf, DECISION_ROLE } from './offline';

export const DIGEST_CAP = 6000;
/** The cap used for smaller models with smaller windows. */
export const DIGEST_CAP_LEAN = 3400;

/** How an id is written for the model: "#b7". interpret.ts strips the mark again. */
export const ref = (id: Id): string => '#' + id;

export function happinessBand(h: number): string { return h < 25 ? 'miserable' : h < 45 ? 'unhappy' : h < 70 ? 'content' : h < 88 ? 'happy' : 'delighted'; }
export function conditionBand(c: number): string { return c <= 0 ? 'a ruin' : c < 25 ? 'falling down' : c < 50 ? 'shabby' : c < 75 ? 'worn' : 'sound'; }
export function monthsHoused(t: Tenant, day: number): number { return Math.max(0, Math.floor((day - t.movedInDay) / 30)); }
const spoken = (id: string) => id.replace(/_/g, ' ');

function lateWord(t: Tenant): string {
  switch (t.lateStage) {
    case 'grace': return 'in grace days';
    case 'late': return `${Math.round(t.daysLate)} days late`;
    case 'plan': return `on a payment plan (${t.plan?.left ?? 0} left)`;
    case 'noticed': return 'served Notice to Quit';
    case 'court': return "before the Reeve's Court";
    case 'writ': return 'writ granted';
    default: return t.daysLate > 0 ? `${Math.round(t.daysLate)} days late` : '';
  }
}

function header(s: GameState): string[] {
  const d = dateOf(s.day), today = Math.floor(s.day);
  const yearStart = today - (today % 360);
  const next = (doy: number) => { let x = yearStart + doy; while (x <= today) x += 360; return x; };
  const seasons: [Season, number][] = [['spring', next(0)], ['summer', next(90)], ['autumn', next(180)], ['winter', next(270)]];
  seasons.sort((a, b) => a[1] - b[1]);
  const rentDay = today - (today % 30) + 30;
  const rank = RANKS[s.realm.rank];
  const roll = housedTenants(s).reduce((n, t) => n + (t.lease?.rent ?? 0), 0);
  const debt = s.loans.reduce((n, l) => n + l.principal, 0);
  const p = s.policies;
  return [
    `TODAY is day ${today}: the ${fmtDate(s.day)} (${d.season}). A month is 30 days, a year 360. Next Rent Day: day ${rentDay}. ${seasons.map(([n, x]) => `${n} begins day ${x}`).join(', ')}.`,
    `RULER ${s.realm.ruler}, ${rank.title} of ${s.realm.name || 'the realm'}. Addressed as "${rank.address}".`,
    `COFFERS ${Math.round(s.gold)} crowns (a tenth is ${Math.max(0, Math.round(s.gold / 10))}). Rent roll ${roll} a month. Renown ${Math.round(s.renown)}, Crown favour ${Math.round(s.favor)}. A feast costs ${BAL.feastCost[s.realm.rank]}.${debt > 0 ? ` Owed to the moneylender: ${Math.round(debt)}.` : ''}`,
    `POLICIES graceDays ${p.graceDays}, lateFeePct ${p.lateFeePct}, depositMonths ${p.depositMonths}, askPct ${p.askPct}, renewalCapPct ${p.renewalCapPct}, pets ${p.pets}, screening ${p.screening}.`,
  ];
}

function delegates(s: GameState): string[] {
  const out: string[] = ['DELEGATES'];
  const rankIdx = RANK_ORDER.indexOf(s.realm.rank);
  let any = false;
  for (const role of STAFF_ROLES) {
    const m = staffByRole(s, role);
    if (!m) {
      const from = RANK_ORDER.find(r => RANKS[r].staff.includes(role));
      const locked = from !== undefined && RANK_ORDER.indexOf(from) > rankIdx;
      out.push(` ${role}: none${locked ? ` (not permitted until ${RANKS[from!].title})` : ' hired; the ruler does that work in person'}`);
      continue;
    }
    any = true;
    const actor = m.actorId ? s.actors[m.actorId] : null;
    const job = actor?.jobId ? s.jobs[actor.jobId] : null;
    const where = job?.buildingId ? s.buildings[job.buildingId]?.name : null;
    const busy = job ? `busy (${spoken(job.kind)}${where ? ' at ' + mid(where) : ''})` : actor?.state === 'working' ? 'busy' : 'free';
    const temper = TEMPERAMENT_DEFS[m.temperament];
    out.push(` ${role}: ${m.first} (${m.name}, ${ref(m.id)}), ${temper?.name || m.temperament}, skill ${m.skill}, wage ${m.wage}, loyalty ${Math.round(m.loyalty)}, ${busy}`);
  }
  if (!any) out.push(' No one is hired. The ruler does every job in person, and the herald reads back.');
  return out;
}

function matterLine(inc: Incident, s: GameState): string | null {
  const def = defOf(inc);
  if (!def) return null;
  const b = inc.buildingId ? s.buildings[inc.buildingId] : null;
  const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
  const a = inc.applicantId ? s.applicants[inc.applicantId] : null;
  const where = [b ? `at ${ref(b.id)} ${b.name}` : '', t ? `household ${ref(t.id)} ${t.name}` : '', a ? `applicant ${ref(a.id)} ${a.household.name}` : ''].filter(Boolean).join(', ');
  const left = inc.expiresDay !== null ? `, ${Math.max(0, Math.ceil(inc.expiresDay - s.day))} days left` : '';
  const outs = def.outcomes.map(o => {
    const cost = costOf({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o.id }, s);
    const tag = o.option && o.option !== o.id ? ` [${o.option}]` : '';
    return `${o.id} = ${o.label}${tag}${cost > 0 ? ` (${cost} cr)` : ''}${o.default ? ' (usual)' : ''}`;
  }).join(' | ');
  // a matter with no decision type can only be ruled on, or bound by a standing order, under its own def id
  const kind = def.decision !== 'custom' ? def.decision : `def ${def.id}`;
  const whose = DECISION_ROLE[def.decision];
  return ` ${ref(inc.id)} "${def.title}" [${kind}${whose ? ', ' + whose : ''}${def.audience ? ', petitioner waiting' : ''}] ${where}${left}. Outcomes: ${outs}`;
}

/** " (stone hall)" unless the name already says what kind of building it is. */
function kindNote(b: Building): string {
  if (b.type === 'seat') return " (the ruler's seat)";
  const flat = (x: string) => x.toLowerCase().replace(/[^a-z]/g, '');
  const named = flat(b.name), plain = BUILDINGS[b.type].name.toLowerCase();
  return named.includes(flat(b.type)) || named.includes(flat(plain)) ? '' : ` (${plain})`;
}

function buildingFull(b: Building, s: GameState): string {
  const def = BUILDINGS[b.type];
  const bits: string[] = [`${ref(b.id)} ${b.name}${kindNote(b)}`];
  if (b.state === 'building') bits.push(`being built (${Math.round(b.progress * 100)}%)`);
  else bits.push(`condition ${Math.round(b.condition)} (${conditionBand(b.condition)})`);
  if (b.units.length) {
    bits.push(`asks ${b.rent}/month`);
    b.units.forEach((u, i) => {
      const t = u.tenantId ? s.tenants[u.tenantId] : null;
      const tag = b.units.length > 1 ? `unit ${i}: ` : '';
      if (t) bits.push(`${tag}home of ${ref(t.id)} ${t.name}${u.purse > 0 ? `, purse of ${u.purse} at the door` : ''}`);
      else if (b.state === 'ready') bits.push(`${tag}VACANT${u.vacantSince !== null ? ` ${Math.max(0, Math.floor(s.day - u.vacantSince))} days` : ''}, ${u.listed ? 'listed' : 'not listed'}`);
    });
  }
  if (b.squatters) bits.push(`squatters: ${spoken(b.squatters.kind)}`);
  if (b.visuals.length) bits.push(b.visuals.map(spoken).join(', '));
  const flags = Object.keys(b.flags).filter(k => b.flags[k]);
  if (flags.length) bits.push(flags.slice(0, 3).map(spoken).join(', '));
  return ' ' + bits[0] + ': ' + bits.slice(1).join('; ');
}
function buildingBrief(b: Building): string {
  return `${ref(b.id)} ${b.name}${kindNote(b)} c${Math.round(b.condition)}${b.units.length ? ` r${b.rent}` : ''}`;
}

function tenantFull(t: Tenant, s: GameState, deep: boolean): string {
  const bits: string[] = [`${ref(t.id)} ${t.name}: ${t.species} ${spoken(t.trade)}, household of ${t.household}`];
  if (t.tags.length) bits.push(t.tags.map(spoken).join(', '));
  if (t.revealed.length) bits.push(`known to be ${t.revealed.map(spoken).join(', ')}`);
  if (t.pets.length) bits.push(`keeps ${t.pets.map(spoken).join(', ')}`);
  if (t.status !== 'housed') bits.push(t.status === 'evicted' ? 'evicted' : 'moved out');
  else {
    bits.push(`rent ${t.lease?.rent ?? 0}`);
    const late = lateWord(t);
    if (t.arrears > 0 || late) bits.push(`owes ${t.arrears}${late ? ', ' + late : ''}`);
    bits.push(happinessBand(t.happiness));
    const mo = monthsHoused(t, s.day);
    bits.push(`housed ${mo} month${mo === 1 ? '' : 's'}`);
    if (t.buildingId) bits.push(`in ${ref(t.buildingId)}`);
  }
  if (deep) {
    if (t.lease) bits.push(`surety held ${t.lease.deposit}`);
    const mem = t.memory.slice(-3).map(m => `"${clip(m.text, 80)}"`);
    if (mem.length) bits.push(`remembers ${mem.join(' ')}`);
  }
  return ' ' + bits.join('; ');
}
function tenantBrief(t: Tenant): string { return `${ref(t.id)} ${t.name}${t.buildingId ? ' in ' + ref(t.buildingId) : ''}${t.arrears > 0 ? ', owes ' + t.arrears : ''}`; }

/** What the addressee and the ruler's words make worth writing out in full. Higher first. */
function relevance(s: GameState, target: SpeakTarget, text: string): { b: Map<Id, number>; t: Map<Id, number> } {
  const b = new Map<Id, number>(), t = new Map<Id, number>();
  const bump = (m: Map<Id, number>, id: Id | null | undefined, n: number) => { if (id) m.set(id, (m.get(id) ?? 0) + n); };
  const role: StaffRole | 'court' | null = 'to' in target ? target.to : null;
  if ('tenantId' in target) { bump(t, target.tenantId, 1000); bump(b, s.tenants[target.tenantId]?.buildingId, 600); }
  if ('buildingId' in target) { bump(b, target.buildingId, 1000); const bd = s.buildings[target.buildingId]; if (bd) for (const x of tenantsIn(s, bd)) bump(t, x.id, 600); }
  if (text) {
    const hit = mentioned(s, text);
    // whoever lives in the first house named is as much the subject as the house
    hit.buildings.forEach((id, i) => { bump(b, id, 500 - i); const bd = s.buildings[id]; if (bd && i < 3) for (const x of tenantsIn(s, bd)) bump(t, x.id, i === 0 ? 420 : 200); });
    hit.tenants.forEach((id, i) => { bump(t, id, 500 - i); if (i < 3) bump(b, s.tenants[id]?.buildingId, i === 0 ? 420 : 200); });
  }
  for (const inc of openIncidents(s)) { bump(b, inc.buildingId, 60); bump(t, inc.tenantId, 60); }
  for (const bd of Object.values(s.buildings)) {
    if (bd.state !== 'ready') { bump(b, bd.id, role === 'mason' ? 30 : 5); continue; }
    const shabby = Math.max(0, 70 - bd.condition);
    bump(b, bd.id, role === 'mason' ? shabby * 2 : shabby / 2);
    const empty = bd.units.some(u => !u.tenantId);
    if (empty) bump(b, bd.id, role === 'crier' ? 80 : 25);
    if (bd.squatters) bump(b, bd.id, role === 'bailiff' ? 80 : 30);
    if (bd.units.some(u => u.purse > 0)) bump(b, bd.id, role === 'bailiff' ? 40 : 10);
    if (bd.units.length) bump(b, bd.id, role === 'steward' ? 12 : 4);
  }
  for (const x of housedTenants(s)) {
    if (x.arrears > 0 || (x.lateStage !== 'none' && x.lateStage !== 'grace')) bump(t, x.id, role === 'bailiff' ? 90 : 40);
    if (x.happiness < 40) bump(t, x.id, 15);
    bump(t, x.id, role === 'steward' ? 8 : 3);
  }
  for (const o of s.oaths) if (o.state === 'open') { bump(t, o.toTenantId, 20); bump(b, o.buildingId, 20); }
  return { b, t };
}

/**
 * Build the digest. `text` is what the ruler said (so that whatever they
 * named is written out in full); `cap` is the size limit in characters.
 * A cap at or under DIGEST_CAP_LEAN also shortens the lists, for smaller models.
 */
export function buildDigest(s: GameState, target: SpeakTarget, text = '', cap = DIGEST_CAP): string {
  const lean = cap <= DIGEST_CAP_LEAN;
  const fixed: string[] = [...header(s), ...delegates(s)];

  const incs = openIncidents(s);
  const rel = relevance(s, target, text);
  const maxMatters = lean ? 6 : 9, maxOrders = lean ? 6 : 12, maxOaths = lean ? 5 : 8;
  const matterLines = incs
    .map(i => ({ i, score: (i.tenantId ? rel.t.get(i.tenantId) ?? 0 : 0) + (i.buildingId ? rel.b.get(i.buildingId) ?? 0 : 0) }))
    .sort((a, b) => b.score - a.score || a.i.startedDay - b.i.startedDay)
    .map(x => matterLine(x.i, s)).filter((x): x is string => !!x);
  const matters = ['MATTERS (open; settle one with resolve_incident and one of ITS outcome ids)', ...(matterLines.length ? matterLines.slice(0, maxMatters) : [' none'])];
  if (matterLines.length > maxMatters) matters.push(` and ${matterLines.length - maxMatters} more, less pressing`);

  const role = 'to' in target && target.to !== 'court' ? target.to : null;
  const orders = s.orders.slice().sort((a, b) => Number(b.to === role) - Number(a.to === role) || b.createdDay - a.createdDay);
  const orderLines = ['STANDING ORDERS (they bind the delegates until revoked)', ...(orders.length ? orders.slice(0, maxOrders).map(o => ` ${ref(o.id)} to ${o.to}: ${clip(o.gist || o.text, 90)}`) : [' none'])];
  if (orders.length > maxOrders) orderLines.push(` and ${orders.length - maxOrders} more`);

  const open = s.oaths.filter(o => o.state === 'open').sort((a, b) => a.dueDay - b.dueDay);
  const oathLines = ['OATHS the ruler has sworn (open)', ...(open.length ? open.slice(0, maxOaths).map(o => ` ${ref(o.id)} ${o.kind} to ${o.toTenantId ? ref(o.toTenantId) + ' ' : ''}${o.toName}${o.buildingId ? ' about ' + ref(o.buildingId) : ''}${o.amount !== null ? ', ' + o.amount + ' crowns' : ''}, due day ${Math.round(o.dueDay)}: "${clip(o.text, 80)}"`) : [' none'])];
  if (open.length > maxOaths) oathLines.push(` and ${open.length - maxOaths} more`);

  const apps = Object.values(s.applicants);
  const appLines = apps.length ? ['APPLICANTS waiting', ...apps.slice(0, lean ? 5 : 8).map(a => {
    const h = a.household, home = s.buildings[a.buildingId];
    return ` ${ref(a.id)} ${h.name}: ${h.species} ${spoken(h.trade)}, household of ${h.household}${h.tags.length ? ', ' + h.tags.map(spoken).join(', ') : ''}${h.revealed.length ? ', known to be ' + h.revealed.map(spoken).join(', ') : ''}; wants ${ref(a.buildingId)}${home ? ' ' + home.name : ''}; ${a.shown ? 'has seen it' : 'not yet shown round'}${a.screened ? ', references checked' : ''}; gives up in ${Math.max(0, Math.ceil(a.leavesDay - s.day))} days`;
  })] : [];

  const cands = s.candidates;
  const wantsHire = /\b(hire|engage|employ|appoint|take on|send for|candidates?|who (can|could|is there)|looking for work)\b/i.test(text) || (!!text && mentioned(s, text).candidates.length > 0);
  const candLines = !cands.length ? []
    : wantsHire || (!lean && cands.length <= 4)
      ? ['CANDIDATES for hire', ...cands.slice(0, 12).map(c => ` ${ref(c.id)} ${c.name}: ${c.role}, skill ${c.skill}, wage ${c.wage}, temperament ${c.temperamentKnown ? TEMPERAMENT_DEFS[c.temperament]?.name || c.temperament : 'unknown'}`)]
      : [`CANDIDATES for hire: ${cands.slice(0, lean ? 6 : 12).map(c => `${ref(c.id)} ${c.name} (${ROLE_TITLES[c.role]}, wage ${c.wage})`).join('; ')}`];

  const base = [...fixed, ...matters, ...orderLines, ...oathLines, ...appLines, ...candLines].join('\n');

  // buildings and households: all in brief, then upgraded to full lines in order of relevance while room remains
  const bs = Object.values(s.buildings), ts = housedTenants(s);
  const extraT = Object.values(s.tenants).filter(t => t.status !== 'housed' && incs.some(i => i.tenantId === t.id));
  const allT = [...ts, ...extraT];
  const deepId = 'tenantId' in target ? target.tenantId : null;
  // a smaller model is spared the wells and statues unless something is the matter with one
  const listed = lean ? bs.filter(b => b.units.length > 0 || (rel.b.get(b.id) ?? 0) >= 60) : bs;
  const entries = [
    ...listed.map(b => ({ kind: 'b' as const, id: b.id, score: rel.b.get(b.id) ?? 0, full: buildingFull(b, s), brief: buildingBrief(b) })),
    ...allT.map(t => ({ kind: 't' as const, id: t.id, score: (rel.t.get(t.id) ?? 0) + 1, full: tenantFull(t, s, t.id === deepId), brief: tenantBrief(t) })),
  ].sort((a, b) => b.score - a.score);
  const H_B = 'BUILDINGS', H_T = 'HOUSEHOLDS', H_BI = 'OTHER BUILDINGS (id name, c = condition, r = asking rent): ', H_TI = 'OTHER HOUSEHOLDS (id name, home): ';
  let size = base.length + H_B.length + H_T.length + H_BI.length + H_TI.length + 8 + entries.reduce((n, e) => n + e.brief.length + 2, 0);
  const full = new Set<string>();
  for (const e of entries) {
    const delta = e.full.length + 1 - (e.brief.length + 2);
    // what the ruler named or pointed at is always written out, a little over the cap if need be
    if (size + delta > cap) { if (e.score >= 400 && size + delta <= cap + 600) { full.add(e.kind + e.id); size += delta; } continue; }
    full.add(e.kind + e.id); size += delta;
  }
  const byId = (a: { id: Id }, b: { id: Id }) => a.id.length - b.id.length || (a.id < b.id ? -1 : 1);
  const bFull = entries.filter(e => e.kind === 'b' && full.has('b' + e.id)).sort(byId).map(e => e.full);
  const bBrief = entries.filter(e => e.kind === 'b' && !full.has('b' + e.id)).sort(byId).map(e => e.brief);
  const tFull = entries.filter(e => e.kind === 't' && full.has('t' + e.id)).sort(byId).map(e => e.full);
  const tBrief = entries.filter(e => e.kind === 't' && !full.has('t' + e.id)).sort(byId).map(e => e.brief);

  const parts = [
    ...fixed, H_B, ...(bFull.length ? bFull : [' none in full']), ...(bBrief.length ? [H_BI + bBrief.join('; ')] : []),
    H_T, ...(tFull.length ? tFull : [allT.length ? ' none in full' : ' none']), ...(tBrief.length ? [H_TI + tBrief.join('; ')] : []),
    ...appLines, ...matters, ...orderLines, ...oathLines, ...candLines,
  ];
  return parts.join('\n');
}
