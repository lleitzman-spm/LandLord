// The catalog — the operating model's task taxonomy, made a loadable ontology.
// A factory component (docs/KINGDOM.md, "The synergy brief: the catalog is the
// event taxonomy"): LandLord provides the mechanism — a set of task-type rows,
// each an event's `catalogRow` key resolves to — and a factory setting loads
// the rows. A real firm's catalog (class RUN/ACQ/FIRM, mode ⚙/◆) is one such
// instance, loaded at the AppFolio-gated merge; until then a small working-fluid
// founding catalog exercises the machine. Nothing here names any real firm — that is the
// leash: LandLord holds the shape, the setting pours in the rows.
//
// Records in, readings out: the catalog is a book like any other — rows loaded
// or struck — and the title a key resolves to, or the rows grouped by class,
// are readings folded fresh, never stored.

/** The class a task-type belongs to — RUN / ACQ / FIRM, kept general.
 *  Optional: a factory setting may leave a row unclassed. */
export type CatalogClass = 'run' | 'acq' | 'firm';

/** How the work is done: by a human hand (◆) or run by the machine (⚙). The
 *  clerk layer reads this to know where it may act and where it must stop. */
export type CatalogMode = 'human' | 'auto';

/** The work-order Type — the top structural field a maintenance word carries in
 *  the system of record: is it the firm's own upkeep ('internal'), a resident's
 *  reported trouble ('resident'), or the make-ready of a vacated door
 *  ('unit-turn')? This is the platform's own field shape (AppFolio names its WO
 *  Types exactly these three), so it is leash-safe structure — the mechanism,
 *  not a setting: a factory's real per-row Types load at the gate. Optional: a
 *  row that is not a work order simply carries none. */
export type WoType = 'internal' | 'resident' | 'unit-turn';

/** The work-order Priority — the pace the door needs the hand at, the system's
 *  own three-rung field (Low / Normal / Urgent). Leash-safe structure like
 *  WoType; optional, absent where urgency has no meaning. */
export type WoPriority = 'low' | 'normal' | 'urgent';

/** The work-order Status — the lifecycle stage the system of record tracks a
 *  work order through, from intake to close. This is the platform's own
 *  field shape (every WO tracker walks some version of this arc), so it is
 *  leash-safe structure like WoType/WoPriority — the mechanism, not a
 *  setting's figure: a factory's real status vocabulary loads at the gate.
 *  Optional: a row that is not a work order, or one not yet worked, simply
 *  carries none. */
export type WoStatus = 'new' | 'assigned' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'canceled';

/** The SLA band — the target-response class a work order is held to, keyed
 *  off its Priority (an urgent leak wants a same-day hand; routine service
 *  can wait a week). General/working-fluid, like WoStatus: the shape is the
 *  platform's, the true bands a setting's figure at the gate. Optional. */
export type SlaBand = 'same-day' | '3-day' | '7-day' | 'scheduled';

export interface CatalogRow {
  /** The stable key an event references. Never shown raw when a title exists.
   *  May be dotted for legibility ("maintenance.hvac.no-cooling"); flat old
   *  keys ("work-order") resolve the same. */
  key: string;
  /** The human-legible name of the task-type. */
  title: string;
  class?: CatalogClass;
  mode?: CatalogMode;
  note?: string;
  /** The top facet of the task-language — one of the ~8 domains of the work
   *  ("maintenance", "leasing", …). Optional: a row may sit un-domained. */
  domain?: string;
  /** The mid facet — a system within its domain ("hvac" within
   *  "maintenance"). */
  system?: string;
  /** The work-order Type facet — set on the words that are work orders
   *  (maintenance calls, unit turns): who the work serves. Absent on non-WO
   *  rows. Leash-safe: the platform's field, not a setting's figure. */
  woType?: WoType;
  /** The work-order Priority facet — the pace the word runs at. Absent where
   *  urgency has no meaning (a rent posting is not urgent, it is a date). */
  priority?: WoPriority;
  /** The work-order Status facet — where the word sits in the WO lifecycle.
   *  Absent on non-WO rows and on rows not yet carried into the system. */
  status?: WoStatus;
  /** The SLA band facet — the target-response class the word is held to.
   *  Absent where response time has no meaning. */
  slaBand?: SlaBand;
  /** The binding: a FlowTemplate.key this task-type triggers to complete.
   *  Absent → the task is atomic; a single `done` closes it. */
  completes?: string;
  /** The word filling a grammar — the letters ({ trade, urgency, … }) the
   *  bound flow's `{token}`s render from. */
  params?: Record<string, string>;
}

export type Catalog = CatalogRow[];

/** The classes in the order the readings show them, and their plain labels. */
export const CLASS_ORDER: CatalogClass[] = ['run', 'acq', 'firm'];

export const CLASS_LABEL: Record<CatalogClass, string> = {
  run: 'Run',
  acq: 'Acquire',
  firm: 'Firm',
};

/** The mode marks — the machine's gear, the human's mark. */
export const MODE_MARK: Record<CatalogMode, string> = {
  auto: '⚙',
  human: '◆',
};

/** The work-order Types in the order the readings show them, and their plain
 *  labels — the platform's three-way split (internal upkeep, a resident's
 *  request, a unit turn). */
export const WO_TYPE_ORDER: WoType[] = ['internal', 'resident', 'unit-turn'];

export const WO_TYPE_LABEL: Record<WoType, string> = {
  internal: 'Internal',
  resident: 'Resident',
  'unit-turn': 'Unit turn',
};

/** The Priorities, hottest first (the tide reads by urgency), with their plain
 *  labels and a mark for the unit card. */
export const PRIORITY_ORDER: WoPriority[] = ['urgent', 'normal', 'low'];

export const PRIORITY_LABEL: Record<WoPriority, string> = {
  urgent: 'Urgent',
  normal: 'Normal',
  low: 'Low',
};

export const PRIORITY_MARK: Record<WoPriority, string> = {
  urgent: '⚠',
  normal: '•',
  low: '·',
};

/** The WO Statuses in lifecycle order (the arc from intake to close), with
 *  their plain labels and a mark for the unit card. */
export const STATUS_ORDER: WoStatus[] = ['new', 'assigned', 'scheduled', 'in-progress', 'on-hold', 'completed', 'canceled'];

export const STATUS_LABEL: Record<WoStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  'on-hold': 'On hold',
  completed: 'Completed',
  canceled: 'Canceled',
};

export const STATUS_MARK: Record<WoStatus, string> = {
  new: '○',
  assigned: '◐',
  scheduled: '◑',
  'in-progress': '●',
  'on-hold': '⏸',
  completed: '✓',
  canceled: '✗',
};

/** The SLA bands, tightest first (the tide reads by how soon the clock runs
 *  out), with their plain labels. */
export const SLA_ORDER: SlaBand[] = ['same-day', '3-day', '7-day', 'scheduled'];

export const SLA_LABEL: Record<SlaBand, string> = {
  'same-day': 'Same-day',
  '3-day': '3-day',
  '7-day': '7-day',
  scheduled: 'Scheduled window',
};

// A small DEMO alphabet — not any firm's real rows (a deployment's load at the
// gate), but enough shape to exercise the machine across all three classes,
// both modes, and the domain/system tree. The alphabet: eight domains named,
// one fully worked (Maintenance, ~6 systems, HVAC fully leafed), the other
// domains shown by a representative row apiece — and the old rows kept, their
// keys untouched, now wearing facets (the correctness landmine: readFlow
// matches by catalogRow+holder, so a rename silently breaks the relay and the
// War Game). Data is working fluid: never curated toward reality (see
// CLAUDE.md).
//
// The maintenance leaves and the unit-turn rows also wear the work-order
// taxonomy — a Type (internal / resident / unit-turn), a Priority (low /
// normal / urgent), a Status (the lifecycle stage) and an SLA band (the
// target-response class), the system-of-record's own four WO fields.
// Leash-safe: the FIELDS are the mechanism (every leaf could carry them); the
// working-fluid alphabet fills a few in to exercise the reading. A setting's
// real rows load the true Type, Priority, Status and SLA per word at the
// gate.
export const FOUNDING_CATALOG: Catalog = [
  // ── Collections ──
  {
    key: 'rent-post',
    title: 'Post monthly rent',
    class: 'run',
    mode: 'auto',
    domain: 'collections',
  },
  {
    key: 'delinquency',
    title: 'Delinquency follow-up',
    class: 'run',
    mode: 'human',
    domain: 'collections',
  },
  // ── Maintenance ──
  {
    key: 'work-order',
    title: 'Triage a work order',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    note: 'Raw intake — walk it down the tree (system → leaf) to put it in motion.',
  },
  // Owner/Accounting.
  {
    key: 'owner-statement',
    title: 'Send the owner statement',
    class: 'run',
    mode: 'auto',
    domain: 'owner-accounting',
  },
  // ── Leasing ──
  {
    key: 'lead-intake',
    title: 'Intake a new-owner lead',
    class: 'acq',
    mode: 'auto',
    domain: 'leasing',
  },
  {
    key: 'list-unit',
    title: 'List a vacant unit',
    class: 'acq',
    mode: 'human',
    domain: 'leasing',
  },
  // ── Move-out ── the rows the founding move-out → re-list relay
  // (FOUNDING_FLOWS) steps reference — keys untouched, facets added; working
  // fluid, like the rest; a setting's real rows load at the gate.
  {
    key: 'notice-received',
    title: 'Log a tenant notice',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
  },
  {
    key: 'confirm-vacate-date',
    title: 'Confirm the vacate date',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
  },
  {
    key: 'schedule-pre-inspection',
    title: 'Schedule the pre-inspection',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
  },
  {
    key: 'move-out-inspection',
    title: 'Walk the move-out inspection',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
  },
  {
    key: 'scope-the-turn',
    title: 'Scope and price the turn',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
    woType: 'unit-turn',
    priority: 'normal',
    status: 'new',
    slaBand: '7-day',
  },
  {
    key: 'work-the-turn',
    title: 'Work the turn to rent-ready',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
    woType: 'unit-turn',
    priority: 'normal',
    status: 'in-progress',
    slaBand: '7-day',
  },
  {
    key: 'deposit-accounting',
    title: 'Itemize the deposit accounting',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
  },
  {
    key: 'transfer-the-deposit',
    title: 'Transfer the deposit',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
  },
  {
    key: 'owner-reserve',
    title: 'Request the owner reserve',
    class: 'run',
    mode: 'human',
    domain: 'move-out',
    note: 'A money step — only inside the open window of the circuit.',
  },
  {
    key: 'final-walk',
    title: 'Verify rent-ready (final walk)',
    class: 'acq',
    mode: 'human',
    domain: 'leasing',
  },
  {
    key: 'show-and-screen',
    title: 'Show and screen applicants',
    class: 'acq',
    mode: 'human',
    domain: 'leasing',
  },
  {
    key: 'vacancy-price-drop',
    title: 'Drop the vacancy price',
    class: 'acq',
    mode: 'auto',
    domain: 'leasing',
    note: 'The weekly loop — repeats until leased.',
  },
  // ── Compliance ──
  {
    key: 'reconcile',
    title: 'Reconcile the trust account',
    class: 'firm',
    mode: 'human',
    domain: 'compliance',
  },
  // The violation / notice word — the trigger row for the violation-notice
  // workflow (FOUNDING_FLOWS, workflow three). HOA / owner / vendor notice.
  {
    key: 'violation-notice',
    title: 'Handle a violation or notice',
    class: 'firm',
    mode: 'human',
    domain: 'compliance',
    system: 'violations',
    completes: 'violation-notice',
    note: 'HOA / owner / vendor notice — classify, decide, serve, follow to cure.',
  },
  // ── Renewals ──
  // The renewal word now binds its completion flow (FOUNDING_FLOWS, workflow
  // four): identifying a lease at term triggers the T-90 renewal cascade.
  {
    key: 'renewal',
    title: 'Work a lease renewal',
    class: 'firm',
    mode: 'human',
    domain: 'renewals',
    completes: 'lease-renewal',
    note: 'The T-90 renewal cadence.',
  },
  // ── Onboarding ── the trigger row for the owner-onboarding workflow
  // (FOUNDING_FLOWS, workflow five). A property won.
  {
    key: 'owner-onboarding',
    title: 'Onboard a won property',
    class: 'acq',
    mode: 'human',
    domain: 'onboarding',
    completes: 'owner-onboarding',
    note: 'A property won — intake, agreement, setup, walkthrough, go-live.',
  },

  // ── The step words of the three added workflows ──────────────────────────
  // Each step of the violation-notice / lease-renewal / owner-onboarding
  // cascades is its own word (a distinct catalog row), the way the move-out
  // relay's steps are — so the fold reads each step cleanly (readFlow matches
  // by catalogRow + holder) and the Ledger shows a title, not a raw key. The
  // mode marks where a human hand is required (◆) and where the machine runs
  // it (⚙). Working fluid; a setting swaps the real steps at the gate.
  //
  // violation-notice — HOA / owner / vendor notice worked to cure.
  { key: 'violation.classify', title: 'Classify the notice', class: 'firm', mode: 'auto', domain: 'compliance', system: 'violations' },
  { key: 'violation.decide', title: 'Decide the violation', class: 'firm', mode: 'human', domain: 'compliance', system: 'violations' },
  { key: 'violation.draft', title: 'Draft the cure notice', class: 'firm', mode: 'auto', domain: 'compliance', system: 'violations' },
  { key: 'violation.serve', title: 'Serve the notice', class: 'firm', mode: 'human', domain: 'compliance', system: 'violations' },
  { key: 'violation.cure', title: 'Work the cure window', class: 'firm', mode: 'human', domain: 'compliance', system: 'violations' },
  { key: 'violation.close', title: 'Close the violation', class: 'firm', mode: 'human', domain: 'compliance', system: 'violations' },
  // lease-renewal — the T-90 renewal cascade.
  { key: 'renewal.price', title: 'Set the renewal rent', class: 'firm', mode: 'human', domain: 'renewals' },
  { key: 'renewal.draft-offer', title: 'Draft the renewal offer', class: 'firm', mode: 'auto', domain: 'renewals' },
  { key: 'renewal.send-offer', title: 'Send the renewal offer', class: 'firm', mode: 'auto', domain: 'renewals' },
  { key: 'renewal.owner-window', title: 'Owner authorization window', class: 'firm', mode: 'auto', domain: 'renewals' },
  { key: 'renewal.tenant-response', title: 'Chase the tenant to sign', class: 'firm', mode: 'auto', domain: 'renewals' },
  { key: 'renewal.countersign', title: 'Countersign the renewal', class: 'firm', mode: 'human', domain: 'renewals' },
  { key: 'renewal.fee', title: 'Post the renewal fee', class: 'firm', mode: 'auto', domain: 'renewals' },
  { key: 'renewal.record', title: 'Record the renewal', class: 'firm', mode: 'auto', domain: 'renewals' },
  // owner-onboarding — a won property brought onto the books.
  { key: 'onboarding.agreement', title: 'Sign the management agreement', class: 'acq', mode: 'human', domain: 'onboarding' },
  { key: 'onboarding.setup', title: 'Set up the records', class: 'acq', mode: 'auto', domain: 'onboarding' },
  { key: 'onboarding.walkthrough', title: 'Walk the property', class: 'acq', mode: 'human', domain: 'onboarding' },
  { key: 'onboarding.insurance', title: 'Verify owner insurance', class: 'acq', mode: 'auto', domain: 'onboarding' },
  { key: 'onboarding.make-ready', title: 'Batch the make-ready', class: 'acq', mode: 'human', domain: 'onboarding', woType: 'unit-turn', priority: 'normal', status: 'scheduled', slaBand: 'scheduled' },
  { key: 'onboarding.lockbox', title: 'Hang the lockbox', class: 'acq', mode: 'human', domain: 'onboarding' },
  { key: 'onboarding.report', title: 'Send the first owner report', class: 'acq', mode: 'auto', domain: 'onboarding' },
  { key: 'onboarding.go-live', title: 'List and syndicate', class: 'acq', mode: 'auto', domain: 'onboarding' },

  // ── The Maintenance tree, leafed ─────────────────────────────────────────
  // Dotted leaf keys for legibility ("maintenance.hvac.no-cooling") — NEW keys
  // only; nothing above is renamed. Each leaf binds the vendor-dispatch
  // grammar (FOUNDING_FLOWS) and carries the letters its notes render from
  // ({trade}, {urgency}).
  //
  // HVAC — fully leafed, five leaves.
  {
    key: 'maintenance.hvac.no-cooling',
    title: 'No cooling',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'hvac',
    woType: 'resident',
    priority: 'urgent',
    status: 'new',
    slaBand: 'same-day',
    completes: 'vendor-dispatch',
    params: { trade: 'HVAC', urgency: 'emergency' },
  },
  {
    key: 'maintenance.hvac.no-heating',
    title: 'No heating',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'hvac',
    woType: 'resident',
    priority: 'urgent',
    status: 'assigned',
    slaBand: 'same-day',
    completes: 'vendor-dispatch',
    params: { trade: 'HVAC', urgency: 'emergency' },
  },
  {
    key: 'maintenance.hvac.refrigerant-leak',
    title: 'Refrigerant leak',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'hvac',
    woType: 'resident',
    priority: 'urgent',
    status: 'scheduled',
    slaBand: 'same-day',
    completes: 'vendor-dispatch',
    params: { trade: 'HVAC', urgency: 'urgent' },
  },
  {
    key: 'maintenance.hvac.thermostat',
    title: 'Thermostat fault',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'hvac',
    woType: 'resident',
    priority: 'normal',
    status: 'in-progress',
    slaBand: '3-day',
    completes: 'vendor-dispatch',
    params: { trade: 'HVAC', urgency: 'routine' },
  },
  {
    key: 'maintenance.hvac.routine-service',
    title: 'Routine HVAC service',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'hvac',
    woType: 'internal',
    priority: 'low',
    status: 'on-hold',
    slaBand: '7-day',
    completes: 'vendor-dispatch',
    params: { trade: 'HVAC', urgency: 'routine' },
  },
  // Plumbing — one leaf, so the second letter visibly varies.
  {
    key: 'maintenance.plumbing.leak',
    title: 'Active leak',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'plumbing',
    woType: 'resident',
    priority: 'urgent',
    status: 'completed',
    slaBand: 'same-day',
    completes: 'vendor-dispatch',
    params: { trade: 'plumbing', urgency: 'emergency' },
  },
  // Appliance — one leaf.
  {
    key: 'maintenance.appliance.refrigerator',
    title: 'Refrigerator down',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'appliance',
    woType: 'resident',
    priority: 'urgent',
    status: 'canceled',
    slaBand: 'same-day',
    completes: 'vendor-dispatch',
    params: { trade: 'appliance', urgency: 'urgent' },
  },
  // Electrical / Exterior / Interior — systems named, leaves load at the gate.

  // ── The escalation — what the rising tide spawns ─────────────────────────
  // The consequence engine (KINGDOM.md, "The task-language"): a crisis left
  // unattended on `advance` rises into one of these — a habitability alarm, a
  // higher-severity typed task that worsens its door's harm and its Patron's
  // faith until it is worked. Working fluid, like the rest.
  {
    key: 'maintenance.escalation.habitability',
    title: 'Habitability alarm',
    class: 'run',
    mode: 'human',
    domain: 'maintenance',
    system: 'escalation',
    woType: 'resident',
    priority: 'urgent',
    status: 'new',
    slaBand: 'same-day',
    note: 'The rising tide — a neglected crisis come due. Work it before the Patron recalls the estate.',
  },
];

// ── Readings ────────────────────────────────────────────────────────────────
// Folded fresh from the loaded catalog; nothing here is stored.

/** The row a key names, or undefined — an event may carry a key the loaded
 *  catalog does not know (a setting swapped out from under old events); the
 *  reading tolerates the gap rather than reject it. */
export function findRow(catalog: Catalog, key: string | null | undefined): CatalogRow | undefined {
  if (!key) return undefined;
  return catalog.find((r) => r.key === key);
}

/** A key resolved to its title — the tag the Ledger shows. Falls back to the
 *  raw key when the catalog does not know it, never to nothing. */
export function titleOf(catalog: Catalog, key: string | null | undefined): string {
  if (!key) return '';
  return findRow(catalog, key)?.title ?? key;
}

export interface CatalogGroup {
  class: CatalogClass | null; // null: the unclassed bucket
  rows: CatalogRow[];
}

/** The loaded rows grouped by class, in CLASS_ORDER, with any unclassed rows
 *  gathered last. Empty groups are dropped. */
export function rowsByClass(catalog: Catalog): CatalogGroup[] {
  const groups: CatalogGroup[] = CLASS_ORDER.map((cls) => ({
    class: cls,
    rows: catalog.filter((r) => r.class === cls),
  }));
  const unclassed = catalog.filter((r) => !r.class);
  if (unclassed.length) groups.push({ class: null, rows: unclassed });
  return groups.filter((g) => g.rows.length > 0);
}

/** True while the catalog still reads exactly as loaded at the founding — the
 *  census-migration test, so a founding-state chronicle is recognized as such
 *  (matches actsAtFounding / censusAtFounding in court.ts). */
export function catalogAtFounding(catalog: Catalog): boolean {
  return JSON.stringify(catalog) === JSON.stringify(FOUNDING_CATALOG);
}

// ── The tree readings ───────────────────────────────────────────────────────
// The task-language's alphabet, folded from the facets: which domains exist,
// which systems a domain holds, and which rows fill a system. Folded fresh,
// never stored — and a row without facets simply does not appear, so old flat
// rows and swapped-in setting rows tolerate the tree without breaking it.

export interface DomainGroup {
  domain: string;
  systems: { system: string; rows: CatalogRow[] }[];
  /** Rows wearing the domain but no system facet. */
  unassigned: CatalogRow[];
}

/** The loaded rows grouped by domain, then by system within each domain.
 *  Domains appear in first-appearance order; a domain's systems likewise.
 *  Rows with no domain are not in the tree (rowsByClass still shows them). */
export function rowsByDomain(catalog: Catalog): DomainGroup[] {
  const groups: DomainGroup[] = [];
  for (const row of catalog) {
    if (!row.domain) continue;
    let g = groups.find((x) => x.domain === row.domain);
    if (!g) {
      g = { domain: row.domain, systems: [], unassigned: [] };
      groups.push(g);
    }
    if (!row.system) {
      g.unassigned.push(row);
      continue;
    }
    let s = g.systems.find((x) => x.system === row.system);
    if (!s) {
      s = { system: row.system, rows: [] };
      g.systems.push(s);
    }
    s.rows.push(row);
  }
  return groups;
}

/** The alphabet at the top level — every domain named, in first-appearance
 *  order. */
export function domainsOf(catalog: Catalog): string[] {
  return rowsByDomain(catalog).map((g) => g.domain);
}

/** The alphabet within a domain — its systems, in first-appearance order. */
export function systemsOf(catalog: Catalog, domain: string): string[] {
  return rowsByDomain(catalog).find((g) => g.domain === domain)?.systems.map((s) => s.system) ?? [];
}

/** The flow a task-type binds — the grammar that completes the word — or null
 *  when the row is atomic (or the key unknown). The seat and the clerks read
 *  this to know whether triggering opens a cascade or a single typed task. */
export function flowKeyFor(catalog: Catalog, key: string | null | undefined): string | null {
  return findRow(catalog, key)?.completes ?? null;
}

// ── The work-order taxonomy readings ─────────────────────────────────────────
// The platform's two WO fields — Type (internal / resident / unit-turn) and
// Priority (low / normal / urgent) — resolved from a key or folded into groups.
// Leash-safe structure: LandLord holds the field shape; a setting's rows fill in
// which Type and Priority each real word carries. Rows without the facet simply
// do not appear, so old flat rows and swapped-in setting rows tolerate the
// reading without breaking it.

export interface WoTypeGroup {
  woType: WoType;
  rows: CatalogRow[];
}

/** The work orders in the loaded catalog — rows carrying a WoType — grouped by
 *  Type in WO_TYPE_ORDER, each group's rows in the hottest-first Priority order.
 *  Empty groups are dropped; a row with no WoType is not a work order and does
 *  not appear. */
export function rowsByWoType(catalog: Catalog): WoTypeGroup[] {
  const rank = (p?: WoPriority) => (p ? PRIORITY_ORDER.indexOf(p) : PRIORITY_ORDER.length);
  return WO_TYPE_ORDER.map((woType) => ({
    woType,
    rows: catalog.filter((r) => r.woType === woType).sort((a, b) => rank(a.priority) - rank(b.priority)),
  })).filter((g) => g.rows.length > 0);
}

// ── The WO status / SLA readings ──────────────────────────────────────────
// The platform's other two WO fields — Status (the lifecycle stage) and SLA
// band (the target-response class) — resolved from a key or folded into
// groups, the same tolerant way as woType/priority above: rows without the
// facet simply do not appear, so old flat rows and swapped-in setting rows
// carry no gap.

/** The Status a key's row carries, or undefined — absent on non-WO rows and
 *  on rows the catalog does not know. */
export function statusOf(catalog: Catalog, key: string | null | undefined): WoStatus | undefined {
  return findRow(catalog, key)?.status;
}

/** The SLA band a key's row carries, or undefined — absent where response
 *  time has no meaning, or the catalog does not know the key. */
export function slaOf(catalog: Catalog, key: string | null | undefined): SlaBand | undefined {
  return findRow(catalog, key)?.slaBand;
}

export interface StatusGroup {
  status: WoStatus;
  rows: CatalogRow[];
}

/** The loaded rows grouped by Status in STATUS_ORDER (the lifecycle arc).
 *  Empty groups are dropped; a row with no Status does not appear. */
export function rowsByStatus(catalog: Catalog): StatusGroup[] {
  return STATUS_ORDER.map((status) => ({
    status,
    rows: catalog.filter((r) => r.status === status),
  })).filter((g) => g.rows.length > 0);
}
