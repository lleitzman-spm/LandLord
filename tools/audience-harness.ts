/**
 * Audience harness. Prints the exact prompt an audience would send to the
 * model for a fixture household, so it can be tried against real models.
 *
 *   npx tsx tools/audience-harness.ts <incidentDefId> "<what the ruler says>" [options]
 *
 *   --rank reeve|knight|baron   fixture to stage it in (default: knight, or baron for baron-only matters)
 *   --prior "ruler: ..."        an earlier line of the conversation (repeatable, in order);
 *   --prior "them: ..."         prefixes: ruler, them, steward
 *   --turn N                    which ruler turn this is (default: one more than the prior ruler lines)
 *   --json                      print the ModelRequest as JSON and nothing else (pipe it to a model)
 *   --offline                   also show what the court hears with no model at all
 *   --answer '<raw text>'       what a model sent back (or @file, or - for stdin): show what the
 *                               court makes of it. Any model's raw output can be tried this way,
 *                               however untidy: chatter, code fences, half an object, plain speech.
 *
 *   npx tsx tools/audience-harness.ts --list             every incident id (audiences marked)
 *   npx tsx tools/audience-harness.ts --audit [filter]   offline ear: does each outcome's own `say`
 *                                                        line select that outcome? Lists the ones that do not.
 *
 * The model must answer with one JSON object:
 *   { "reply": string, "mood": Mood, "outcome": id | null, "oaths": [...], "revealed": [...] }
 *
 * Trying a real model, end to end:
 *   npx tsx tools/audience-harness.ts sys_late_rent "You have a week." --json > req.json
 *   (send req.json's system and messages to the model; save its raw text as out.txt)
 *   npx tsx tools/audience-harness.ts sys_late_rent "You have a week." --answer @out.txt
 */
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { makeFixtureState } from '../src/dev/fixture';
import { INCIDENTS, INCIDENT_BY_ID, BUILDINGS } from '../src/data';
import type { IncidentDef, Requires } from '../src/data/schema';
import type { GameState, Incident, Tenant, Building, Applicant, RankId } from '../src/sim/types';
import { baseVars, fill } from '../src/sim/core';
import type { Action, ActionResult } from '../src/sim/types';
import type { AudienceLine, WordDeps, ModelClient } from '../src/word/api';
import { openAudienceSession, audienceRequest, matchOutcomeOffline, resolveCast, audienceVars } from '../src/word/audience';
import { parseAudienceReply } from '../src/word/audience-prompt';

type FixtureRank = 'reeve' | 'knight' | 'baron';

// ───────────────────────────── staging an incident on the fixture ─────────────────────────────

function fits(r: Requires | undefined, t: Tenant | null, b: Building | null, s: GameState): number {
  if (!r) return 0;
  let miss = 0;
  if (r.buildingType && !(b && r.buildingType.includes(b.type))) miss += 4;
  if (r.buildingCategory && !(b && r.buildingCategory.includes(BUILDINGS[b.type].category))) miss += 4;
  if (r.conditionBelow !== undefined && !(b && b.condition < r.conditionBelow)) miss++;
  if (r.conditionAbove !== undefined && !(b && b.condition > r.conditionAbove)) miss++;
  if (r.species && !(t && r.species.includes(t.species))) miss += 2;
  if (r.trade && !(t && r.trade.includes(t.trade))) miss++;
  if (r.trait && !(t && r.trait.some(x => t.traits.includes(x)))) miss++;
  if (r.tag && !(t && r.tag.some(x => t.tags.includes(x)))) miss++;
  if (r.hasPet !== undefined && !(t && (t.pets.length > 0) === r.hasPet)) miss++;
  if (r.pet && !(t && r.pet.some(x => t.pets.includes(x)))) miss++;
  if (r.happinessBelow !== undefined && !(t && t.happiness < r.happinessBelow)) miss++;
  if (r.happinessAbove !== undefined && !(t && t.happiness > r.happinessAbove)) miss++;
  if (r.monthsHousedAbove !== undefined && !(t && (s.day - t.movedInDay) / 30 > r.monthsHousedAbove)) miss++;
  return miss;
}

/** Bend a fixture household until the incident's requirements hold. It is a harness: the fixture can take it. */
function coerce(r: Requires | undefined, t: Tenant | null, b: Building | null, s: GameState): void {
  if (!r) return;
  if (b) {
    if (r.conditionBelow !== undefined && b.condition >= r.conditionBelow) b.condition = Math.max(0, r.conditionBelow - 8);
    if (r.conditionAbove !== undefined && b.condition <= r.conditionAbove) b.condition = Math.min(100, r.conditionAbove + 8);
  }
  if (!t) return;
  if (r.species && !r.species.includes(t.species)) t.species = r.species[0]!;
  if (r.trade && !r.trade.includes(t.trade)) t.trade = r.trade[0]!;
  if (r.trait && !r.trait.some(x => t.traits.includes(x))) t.traits.push(r.trait[0]!);
  if (r.tag && !r.tag.some(x => t.tags.includes(x))) t.tags.push(r.tag[0]!);
  if (r.pet && !r.pet.some(x => t.pets.includes(x))) t.pets.unshift(r.pet[0]!);
  else if (r.hasPet === true && !t.pets.length) t.pets.push('cat');
  else if (r.hasPet === false) t.pets.length = 0;
  if (r.happinessBelow !== undefined && t.happiness >= r.happinessBelow) t.happiness = Math.max(0, r.happinessBelow - 6);
  if (r.happinessAbove !== undefined && t.happiness <= r.happinessAbove) t.happiness = Math.min(100, r.happinessAbove + 6);
  if (r.monthsHousedAbove !== undefined && (s.day - t.movedInDay) / 30 <= r.monthsHousedAbove) t.movedInDay = s.day - (r.monthsHousedAbove + 2) * 30;
}

/** The fixture's vacancies are all spoken for (goblins, scaffolding), so finish a house and send someone to see it. */
function inventApplicant(s: GameState): Applicant | null {
  const all = Object.values(s.buildings).filter(b => b.units.length > 0 && b.units.some(u => !u.tenantId));
  const b = all.find(x => x.state === 'ready' && !x.squatters) ?? all.find(x => x.state === 'building') ?? all.find(x => x.state === 'ready');
  if (!b) return null;
  if (b.state === 'building') { b.state = 'ready'; b.progress = 1; b.condition = 96; }
  const unit = b.units.findIndex(u => !u.tenantId);
  const a: Applicant = {
    id: 'ph_jory', buildingId: b.id, unit, arrivedDay: s.day - 1, leavesDay: s.day + 7, maxRent: b.rent + 3, shown: true, screened: false, actorId: null,
    household: {
      id: 'th_jory', name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 4242,
      household: 3, traits: ['handy', 'haggler'], revealed: [], tags: ['newlyweds'], pets: [], income: 44, reliability: 0.8,
    },
  };
  s.applicants[a.id] = a;
  return a;
}

/**
 * Put an open incident of this definition into a fixture state, on the
 * household or building that fits it best, and return it. Reuses one the
 * fixture already has (the griffin, the goblins, the leak).
 */
export function stageIncident(s: GameState, defId: string): Incident | null {
  const def = INCIDENT_BY_ID[defId];
  if (!def) return null;
  const existing = Object.values(s.incidents).find(i => i.defId === defId && i.state === 'open');
  if (existing) return existing;

  const housed = Object.values(s.tenants).filter(t => t.status === 'housed' && t.buildingId);
  const buildingOf = (t: Tenant | null): Building | null => (t?.buildingId ? s.buildings[t.buildingId] ?? null : null);
  let tenant: Tenant | null = null;
  let building: Building | null = null;
  let unit: number | null = null;
  let applicantId: string | null = null;
  const vars: Record<string, string | number> = {};

  if (def.decision === 'applicant' || def.petitioner === 'applicant') {
    const a = Object.values(s.applicants)[0] ?? inventApplicant(s);
    if (!a) return null;
    a.shown = true;
    applicantId = a.id; building = s.buildings[a.buildingId] ?? null; unit = a.unit;
    Object.assign(vars, { tenant: a.household.name, first: a.household.first, trade: a.household.trade.replace(/_/g, ' '), species: a.household.species });
  } else if (def.target === 'tenant') {
    const want = (t: Tenant): number => {
      let miss = fits(def.requires, t, buildingOf(t), s);
      if (def.decision === 'late_rent' || def.decision === 'eviction_ready' || def.category === 'payment') miss += t.arrears > 0 ? 0 : 1;
      if (Object.values(s.incidents).some(i => i.tenantId === t.id)) miss += 0.5;
      return miss;
    };
    tenant = housed.slice().sort((a, b) => want(a) - want(b))[0] ?? null;
    if (!tenant) return null;
    building = buildingOf(tenant); unit = tenant.unit;
    coerce(def.requires, tenant, building, s);
    if ((def.decision === 'late_rent' || def.decision === 'eviction_ready') && tenant.arrears <= 0) {
      tenant.arrears = tenant.lease?.rent ?? 8; tenant.daysLate = 6; tenant.lateStage = 'late';
    }
    if (def.decision === 'eviction_ready') { tenant.lateStage = 'writ'; tenant.arrears = (tenant.lease?.rent ?? 8) * 3; tenant.daysLate = 60; }
    if (def.decision === 'move_out_deposit' && def.system && building) {
      const u = building.units[tenant.unit];
      if (u) { u.tenantId = null; u.vacantSince = s.day - 2; u.listed = true; }
      tenant.status = 'left'; tenant.leftDay = s.day - 2; tenant.buildingId = null;
    }
  } else if (def.target === 'vacant') {
    building = Object.values(s.buildings).find(b => b.squatters && b.units.some(u => !u.tenantId))
      ?? Object.values(s.buildings).find(b => b.state === 'ready' && b.units.some(u => !u.tenantId)) ?? null;
    if (!building) return null;
    unit = building.units.findIndex(u => !u.tenantId);
    coerce(def.requires, null, building, s);
  } else if (def.target === 'building') {
    const all = Object.values(s.buildings).filter(b => b.state === 'ready');
    const occ = (b: Building): Tenant | null => { const id = b.units.find(u => u.tenantId)?.tenantId; return id ? s.tenants[id] ?? null : null; };
    building = all.slice().sort((a, b) => fits(def.requires, occ(a), a, s) - fits(def.requires, occ(b), b, s) + (occ(a) ? 0 : 0.5) - (occ(b) ? 0 : 0.5))[0] ?? null;
    if (!building) return null;
    tenant = occ(building); unit = 0;
    coerce(def.requires, tenant, building, s);
  }

  Object.assign(vars, baseVars(s, building, tenant), vars);
  if (vars.amount === undefined) vars.amount = 12;
  if (vars.pet === undefined && (def.decision === 'pet' || def.requires?.hasPet || def.requires?.pet)) vars.pet = (def.requires?.pet?.[0] ?? tenant?.pets[0] ?? 'cat').replace(/_/g, ' ');
  const role = def.requires?.hasStaff?.[0];
  const staff = Object.values(s.staff).find(m => !role || m.role === role) ?? Object.values(s.staff)[0];
  if (staff && vars.staff === undefined) vars.staff = staff.name;

  const inc: Incident = {
    id: 'ih_' + defId, defId, state: 'open', buildingId: building?.id ?? null, unit, tenantId: tenant?.id ?? null, applicantId,
    startedDay: s.day - 1, expiresDay: def.timerDays > 0 ? s.day + def.timerDays : null, vars, outcomeId: null, resolvedBy: null,
    jobId: null, actorId: null, reported: false,
  };
  s.incidents[inc.id] = inc;
  return inc;
}

/** The fixture rank a definition is best staged in. */
export function rankFor(def: IncidentDef, asked?: string): FixtureRank {
  if (asked === 'reeve' || asked === 'knight' || asked === 'baron') return asked;
  const needsSteward = def.requires?.hasStaff?.includes('steward') || def.requires?.hasBuilding?.includes('counting_house');
  const baronOnly: RankId[] = ['baron', 'duke', 'king'];
  return baronOnly.includes(def.minRank) || needsSteward ? 'baron' : 'knight';
}

// ───────────────────────────── the offline audit ─────────────────────────────

export interface AuditMiss {
  defId: string; outcomeId: string; say: string; heard: string | null; stage: 'exact' | 'fuzzy';
  /** another outcome of the same incident with the very same whisper: no ear could tell them apart */
  twin: string | null;
}

/** For every outcome of every incident: does its own `say` line select it offline? */
export function auditOfflineEar(filter = ''): { outcomes: number; exactMisses: AuditMiss[]; fuzzyMisses: AuditMiss[] } {
  const exactMisses: AuditMiss[] = [], fuzzyMisses: AuditMiss[] = [];
  let outcomes = 0;
  for (const def of INCIDENTS) {
    if (filter && !def.id.includes(filter) && def.category !== filter) continue;
    const s = makeFixtureState(rankFor(def));
    const inc = stageIncident(s, def.id);
    const vars = inc ? audienceVars(s, inc, resolveCast(s, inc, def)) : baseVars(s);
    const plainWords = (t: string): string => fill(t, vars).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    for (const o of def.outcomes) {
      outcomes++;
      const say = fill(o.say, vars);
      const twin = def.outcomes.find(x => x.id !== o.id && (plainWords(x.say) === plainWords(o.say) || plainWords(x.label) === plainWords(o.say)))?.id ?? null;
      const exact = matchOutcomeOffline(def, say, vars);
      if (exact.outcomeId !== o.id) exactMisses.push({ defId: def.id, outcomeId: o.id, say, heard: exact.outcomeId, stage: 'exact', twin });
      const fuzzy = matchOutcomeOffline(def, say, vars, { exact: false });
      if (fuzzy.outcomeId !== o.id) fuzzyMisses.push({ defId: def.id, outcomeId: o.id, say, heard: fuzzy.outcomeId, stage: 'fuzzy', twin });
    }
  }
  return { outcomes, exactMisses, fuzzyMisses };
}

// ───────────────────────────── command line ─────────────────────────────

/** One line per thing the session asked the sim to do. */
function describe(a: Action): string {
  switch (a.type) {
    case 'resolve_incident': return `resolve_incident  outcome "${a.outcomeId}"`;
    case 'swear_oath': return `swear_oath        ${a.oath.kind}${a.oath.amount !== null ? ` (${a.oath.amount})` : ''}, to ${a.oath.toName}, due day ${Math.round(a.oath.dueDay)}: "${a.oath.text}"`;
    case 'reveal_trait': return `reveal_trait      ${a.trait}`;
    case 'remember': return `remember          ${a.valence > 0 ? '+' : ''}${a.valence} "${a.text}"`;
    default: return a.type;
  }
}

async function main(argv: string[]): Promise<number> {
  const flags: Record<string, string | boolean> = {};
  const priors: string[] = [];
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--prior') { priors.push(argv[++i] ?? ''); continue; }
    if (a === '--rank' || a === '--turn' || a === '--answer') { flags[a.slice(2)] = argv[++i] ?? ''; continue; }
    if (a === '--audit') { flags.audit = argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[++i]! : true; continue; }
    if (a.startsWith('--')) { flags[a.slice(2)] = true; continue; }
    pos.push(a);
  }

  if (flags.list) {
    for (const d of INCIDENTS) console.log(`${d.audience ? 'audience' : 'pin     '}  ${d.id.padEnd(34)} ${d.minRank.padEnd(7)} ${d.title}`);
    return 0;
  }
  if (flags.audit) {
    const r = auditOfflineEar(typeof flags.audit === 'string' ? flags.audit : '');
    console.log(`Offline ear over ${r.outcomes} outcomes.`);
    console.log(`  Word for word (the whisper as written): ${r.outcomes - r.exactMisses.length} of ${r.outcomes} select their own outcome.`);
    for (const m of r.exactMisses) console.log(`    MISS ${m.defId}.${m.outcomeId}: heard ${m.heard ?? 'nothing'} for "${m.say}"${m.twin ? ` (the same words as its outcome "${m.twin}": the content needs two different whispers)` : ''}`);
    console.log(`  By weight of words alone (as if paraphrased): ${r.outcomes - r.fuzzyMisses.length} of ${r.outcomes}.`);
    for (const m of r.fuzzyMisses) console.log(`    weak ${m.defId}.${m.outcomeId}: heard ${m.heard ?? 'nothing'} for "${m.say}"`);
    return r.exactMisses.length ? 1 : 0;
  }

  const [defId, said] = pos;
  if (!defId || said === undefined) {
    console.error('usage: npx tsx tools/audience-harness.ts <incidentDefId> "<what the ruler says>" [--rank knight] [--prior "them: ..."] [--json] [--offline] [--answer \'<raw model text>\' | @file | -]\n       npx tsx tools/audience-harness.ts --list | --audit [filter]');
    return 2;
  }
  const def = INCIDENT_BY_ID[defId];
  if (!def) { console.error(`No incident "${defId}". Try --list.`); return 2; }
  const rank = rankFor(def, typeof flags.rank === 'string' ? flags.rank : undefined);
  const state = makeFixtureState(rank);
  const inc = stageIncident(state, defId);
  if (!inc) { console.error(`Could not stage "${defId}" on the ${rank} fixture.`); return 1; }

  const deps: WordDeps = { getState: () => state, dispatch: () => ({ ok: true }) };
  const none: ModelClient = { kind: 'none', complete: async () => '' };
  const session = openAudienceSession(inc.id, deps, () => none, () => undefined);
  if (!session) { console.error('The incident is not open.'); return 1; }

  const lines: AudienceLine[] = session.lines.slice();
  for (const p of priors) {
    const m = /^\s*(ruler|them|steward)\s*:\s*(.*)$/i.exec(p);
    if (!m) { console.error(`--prior needs "ruler: ...", "them: ..." or "steward: ...". Got: ${p}`); return 2; }
    const who = m[1]!.toLowerCase();
    lines.push({ who: who === 'ruler' ? 'ruler' : who === 'steward' ? 'steward' : 'petitioner', text: m[2]! });
  }
  const turn = typeof flags.turn === 'string' && Number(flags.turn) > 0 ? Math.floor(Number(flags.turn)) : lines.filter(l => l.who === 'ruler').length + 1;
  const req = audienceRequest(state, inc.id, lines, said, turn);
  if (!req) { console.error('No request could be built.'); return 1; }

  if (flags.json) { console.log(JSON.stringify(req, null, 2)); return 0; }

  if (typeof flags.answer === 'string') {
    const src = flags.answer;
    const raw = src === '-' ? readFileSync(0, 'utf8') : src.startsWith('@') ? readFileSync(src.slice(1), 'utf8') : src;
    const actions: Action[] = [];
    const court: WordDeps = { getState: () => state, dispatch: (a: Action): ActionResult => { actions.push(a); return { ok: true }; } };
    const model: ModelClient = { kind: 'server', complete: async () => raw };
    const live = openAudienceSession(inc.id, court, () => model, () => undefined);
    if (!live) { console.error('The incident is not open.'); return 1; }
    live.lines.push(...lines.slice(1));
    const turn = await live.say(said);
    const parsed = parseAudienceReply(raw);
    console.log(`# incident   ${def.id}: "${live.title}", ${live.speaker.name} before the ${rank} fixture's seat`);
    console.log(`# the ruler  "${said}"`);
    console.log(`# the model  ${JSON.stringify(raw.length > 300 ? raw.slice(0, 300) + ' ...' : raw)}`);
    console.log('\n================ WHAT THE COURT MAKES OF IT ================\n');
    if (!parsed) console.log('read as:  nothing usable (the turn is answered without the model)');
    else console.log(`read as:  outcome ${parsed.outcome ?? 'null'}, mood ${parsed.mood ?? 'none'}, ${parsed.oaths.length} oath(s), revealed [${parsed.revealed.join(', ')}]${parsed.salvaged ? ', reply cut short' : ''}${parsed.loose ? ', says nothing either way about a ruling' : ''}`);
    console.log(`answered: by the ${turn.via === 'model' ? 'model' : 'court itself (offline line)'}; mood ${turn.mood}`);
    console.log(`reply:    "${turn.reply}"`);
    console.log(`ruling:   ${turn.done ? `${turn.outcomeId}. ${turn.resultText ?? ''}` : 'none yet; the audience stays open'}`);
    if (turn.oaths.length) console.log(`oaths:    ${turn.oaths.map(o => `${o.kind} "${o.text}"`).join('; ')}`);
    if (turn.revealed.length) console.log(`learned:  ${turn.revealed.join(', ')}`);
    console.log(actions.length ? `\ndispatched:\n${actions.map(a => '  ' + describe(a)).join('\n')}` : '\ndispatched: nothing');
    return 0;
  }

  const sp = session.speaker;
  console.log(`# incident   ${def.id}: "${session.title}" (${def.audience ? 'audience' : 'map pin'}), staged on the ${rank} fixture`);
  console.log(`# petitioner ${sp.name} (${sp.kind}, ${sp.species}), mood ${sp.mood}`);
  console.log(`# opening    ${session.lines[0]!.text}`);
  for (const w of session.whispers) console.log(`# whisper    [${w.outcomeId}] ${w.label}: "${w.say}"`);
  console.log(`# request    tier ${req.tier ?? 'quick'}, maxTokens ${req.maxTokens}, system ${req.system.length} chars, user ${req.messages[0]!.content.length} chars`);
  console.log('\n=================== SYSTEM ===================\n');
  console.log(req.system);
  console.log('\n==================== USER ====================\n');
  console.log(req.messages.map(m => m.content).join('\n\n'));
  if (flags.offline) {
    const m = matchOutcomeOffline(def, said, audienceVars(state, inc, resolveCast(state, inc, def)));
    console.log('\n================= WITH NO MODEL =================\n');
    console.log(`heard: ${m.outcomeId ?? 'no ruling'} (${m.how})${m.between ? `, torn between ${m.between.join(' and ')}` : ''}`);
    console.log(`scores: ${Object.entries(m.scores).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(e); process.exit(1); });
}
