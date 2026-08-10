// The Attention Ledger is the governing reading of where the operator's finite
// attention goes.  Escape remains an experimental diagnostic elsewhere; it
// does not decide this ledger.  Records carry the observed facts and the
// ledger folds them into a current reading â€” no status or score is stored.

export type AttentionRequirement = 'human-required' | 'machine-candidate';
export type AttentionAvoidability = 'avoidable' | 'unavoidable' | 'unknown';
export type AttentionReversibility = 'reversible' | 'irreversible';
export type ExceptionBurden = 'none' | 'routine' | 'material';
export type EscalationAttribution =
  | 'policy'
  | 'evidence'
  | 'capability'
  | 'external'
  | 'system'
  | 'unknown';

export type AttentionEvidenceKind = 'record' | 'policy' | 'test' | 'external';

export interface AttentionEvidence {
  /** Opaque reference to evidence, never the evidence's client-bearing body. */
  ref: string;
  kind: AttentionEvidenceKind;
}

export type AttentionEventKind = 'opened' | 'classified' | 'escalated' | 'resolved' | 'reversed';

/**
 * An append-only observation about one unit of work.  Classification is a
 * deliberate record, not stored status: later classification events correct
 * earlier ones without editing history.  A reversal reopens a resolved unit.
 */
export interface AttentionEvent {
  id: string;
  at: string;
  workId: string;
  kind: AttentionEventKind;
  requirement?: AttentionRequirement;
  avoidability?: AttentionAvoidability;
  reversibility?: AttentionReversibility;
  exceptionBurden?: ExceptionBurden;
  escalationAttribution?: EscalationAttribution;
  confidence?: number;
  evidence?: AttentionEvidence[];
  /** Identifies the event reversed by this record. */
  reverses?: string;
}

export type AttentionLog = AttentionEvent[];

export interface AttentionEntry {
  workId: string;
  status: 'open' | 'resolved';
  openedAt: string;
  lastAt: string;
  requirement: AttentionRequirement | null;
  avoidability: AttentionAvoidability | null;
  reversibility: AttentionReversibility | null;
  exceptionBurden: ExceptionBurden | null;
  escalationAttribution: EscalationAttribution | null;
  escalationCount: number;
  confidence: number | null;
  evidence: AttentionEvidence[];
  /** Why this item needs attention before another; facts, not a synthetic score. */
  priorityReasons: string[];
}

export interface AttentionTotals {
  open: number;
  humanRequired: number;
  machineCandidate: number;
  avoidableHuman: number;
  irreversibleHuman: number;
  routineExceptions: number;
  materialExceptions: number;
  escalated: number;
  unattributedEscalations: number;
  lowConfidence: number;
  evidenceGaps: number;
  unclassified: number;
}

export interface AttentionLedger {
  entries: AttentionEntry[];
  open: AttentionEntry[];
  totals: AttentionTotals;
}

const MACHINE_CANDIDATE_CONFIDENCE = 0.8; // fact:attention-confidence-floor

const byTimeThenId = (a: AttentionEvent, b: AttentionEvent): number =>
  a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at);

function latestDefined<K extends keyof AttentionEvent>(
  events: AttentionEvent[],
  field: K,
): AttentionEvent[K] | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index][field] !== undefined) return events[index][field];
  }
  return undefined;
}

const KINDS = new Set<AttentionEventKind>(['opened', 'classified', 'escalated', 'resolved', 'reversed']);
const REQUIREMENTS = new Set<AttentionRequirement>(['human-required', 'machine-candidate']);
const AVOIDABILITY = new Set<AttentionAvoidability>(['avoidable', 'unavoidable', 'unknown']);
const REVERSIBILITY = new Set<AttentionReversibility>(['reversible', 'irreversible']);
const EXCEPTIONS = new Set<ExceptionBurden>(['none', 'routine', 'material']);
const ATTRIBUTIONS = new Set<EscalationAttribution>(['policy', 'evidence', 'capability', 'external', 'system', 'unknown']);
const EVIDENCE_KINDS = new Set<AttentionEvidenceKind>(['record', 'policy', 'test', 'external']);
const BASE_FIELDS = ['id', 'at', 'workId', 'kind'] as const;
const FIELDS_BY_KIND: Record<AttentionEventKind, ReadonlySet<string>> = {
  opened: new Set(BASE_FIELDS),
  classified: new Set([...BASE_FIELDS, 'requirement', 'avoidability', 'reversibility', 'exceptionBurden', 'confidence', 'evidence']),
  escalated: new Set([...BASE_FIELDS, 'escalationAttribution']),
  resolved: new Set(BASE_FIELDS),
  reversed: new Set([...BASE_FIELDS, 'reverses']),
};

function statusOf(events: AttentionEvent[]): 'open' | 'resolved' {
  let status: 'open' | 'resolved' = 'open';
  let activeResolution: string | null = null;
  for (const event of events) {
    if (event.kind === 'resolved' && status === 'open') {
      status = 'resolved';
      activeResolution = event.id;
    }
    if (event.kind === 'reversed' && status === 'resolved' && event.reverses === activeResolution) {
      status = 'open';
      activeResolution = null;
    }
  }
  return status;
}

function priorityReasons(entry: Omit<AttentionEntry, 'priorityReasons'>): string[] {
  const reasons: string[] = [];
  if (entry.status === 'resolved') return reasons;
  if (entry.requirement == null) reasons.push('classification-missing');
  if (entry.reversibility === 'irreversible') reasons.push('irreversible');
  if (entry.exceptionBurden === 'material') reasons.push('material-exception');
  if (entry.requirement === 'human-required' && entry.avoidability === 'avoidable') {
    reasons.push('avoidable-human-attention');
  }
  if (entry.escalationCount > 0) reasons.push('escalated');
  if (entry.escalationCount > 0 && entry.escalationAttribution === 'unknown') {
    reasons.push('escalation-unattributed');
  }
  if (entry.confidence == null || entry.confidence < MACHINE_CANDIDATE_CONFIDENCE) reasons.push('low-confidence');
  if (entry.evidence.length === 0) reasons.push('evidence-missing');
  return reasons;
}

function rank(entry: AttentionEntry): number[] {
  return [
    entry.status === 'open' ? 1 : 0,
    entry.reversibility === 'irreversible' ? 1 : 0,
    entry.exceptionBurden === 'material' ? 1 : 0,
    entry.requirement === 'human-required' ? 1 : 0,
    entry.avoidability === 'avoidable' ? 1 : 0,
    entry.escalationCount > 0 ? 1 : 0,
    entry.confidence == null ? 1 : 1 - entry.confidence,
  ];
}

function compareRank(a: AttentionEntry, b: AttentionEntry): number {
  const left = rank(a);
  const right = rank(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return a.workId.localeCompare(b.workId);
}

/** Validate records before treating their fold as evidence. */
export function validateAttentionLog(log: AttentionLog): string[] {
  const failures: string[] = [];
  const ids = new Set<string>();
  const work = new Map<string, AttentionEvent[]>();
  for (const event of log) {
    if (!event || typeof event !== 'object' || !KINDS.has(event.kind)) {
      failures.push('event kind is missing or unknown');
      continue;
    }
    for (const key of Object.keys(event)) {
      if (!FIELDS_BY_KIND[event.kind].has(key)) failures.push(`field is not permitted on ${event.kind}: ${event.id || '(missing)'}.${key}`);
    }
    if (!event.id || !event.workId) failures.push('event identity is missing');
    if (ids.has(event.id)) failures.push(`duplicate event id: ${event.id}`);
    ids.add(event.id);
    if (!Number.isFinite(Date.parse(event.at))) failures.push(`invalid timestamp: ${event.id}`);
    if (event.confidence !== undefined && (event.confidence < 0 || event.confidence > 1)) {
      failures.push(`confidence outside 0..1: ${event.id}`);
    }
    if (event.kind === 'classified') {
      if (!event.requirement) failures.push(`classification lacks requirement: ${event.id}`);
      else if (!REQUIREMENTS.has(event.requirement)) failures.push(`classification has unknown requirement: ${event.id}`);
      if (!event.avoidability) failures.push(`classification lacks avoidability: ${event.id}`);
      else if (!AVOIDABILITY.has(event.avoidability)) failures.push(`classification has unknown avoidability: ${event.id}`);
      if (!event.reversibility) failures.push(`classification lacks reversibility: ${event.id}`);
      else if (!REVERSIBILITY.has(event.reversibility)) failures.push(`classification has unknown reversibility: ${event.id}`);
      if (!event.exceptionBurden) failures.push(`classification lacks exception burden: ${event.id}`);
      else if (!EXCEPTIONS.has(event.exceptionBurden)) failures.push(`classification has unknown exception burden: ${event.id}`);
      if (event.confidence === undefined) failures.push(`classification lacks confidence: ${event.id}`);
      if (!event.evidence?.length) failures.push(`classification lacks evidence: ${event.id}`);
      for (const evidence of event.evidence ?? []) {
        if (
          !evidence ||
          typeof evidence !== 'object' ||
          Object.keys(evidence).some((key) => key !== 'ref' && key !== 'kind') ||
          typeof evidence.ref !== 'string' ||
          !EVIDENCE_KINDS.has(evidence.kind)
        ) failures.push(`classification has invalid evidence: ${event.id}`);
      }
      if (event.requirement === 'machine-candidate' && event.reversibility === 'irreversible') {
        failures.push(`irreversible work cannot be a machine candidate: ${event.id}`);
      }
    }
    if (event.kind === 'escalated' && !event.escalationAttribution) {
      failures.push(`escalation lacks attribution: ${event.id}`);
    } else if (event.kind === 'escalated' && !ATTRIBUTIONS.has(event.escalationAttribution!)) {
      failures.push(`escalation has unknown attribution: ${event.id}`);
    }
    if (event.kind === 'reversed' && !event.reverses) {
      failures.push(`reversal lacks target: ${event.id}`);
    }
    const events = work.get(event.workId) ?? [];
    events.push(event);
    work.set(event.workId, events);
  }

  for (const [workId, events] of work) {
    const sorted = [...events].sort(byTimeThenId);
    const openings = sorted.filter((event) => event.kind === 'opened');
    if (openings.length !== 1 || sorted[0]?.kind !== 'opened') failures.push(`work must open exactly once before other events: ${workId}`);
    let open = openings.length === 1 && sorted[0]?.kind === 'opened';
    let activeResolution: string | null = null;
    const reversedTargets = new Set<string>();
    for (const event of sorted) {
      if (event.kind === 'opened') continue;
      if (event.kind === 'resolved') {
        if (!open) failures.push(`work resolved while already closed: ${event.id}`);
        open = false;
        activeResolution = event.id;
        continue;
      }
      if (event.kind === 'reversed') {
        if (open || !event.reverses || event.reverses !== activeResolution || reversedTargets.has(event.reverses)) {
          failures.push(`reversal target is not the active unreversed resolution: ${event.id}`);
        } else {
          reversedTargets.add(event.reverses);
          open = true;
          activeResolution = null;
        }
        continue;
      }
      if (!open) failures.push(`closed work received another event: ${event.id}`);
    }
  }
  return failures;
}

/** Fold the append-only attention records into the operator's current ledger. */
export function readAttentionLedger(log: AttentionLog): AttentionLedger {
  const workIds = [...new Set(log.map((event) => event.workId))];
  const entries = workIds.map((workId): AttentionEntry => {
    const events = log.filter((event) => event.workId === workId).sort(byTimeThenId);
    const classifications = events.filter((event) => event.kind === 'classified');
    const escalations = events.filter((event) => event.kind === 'escalated');
    const evidence = latestDefined(classifications, 'evidence') ?? [];
    const base: Omit<AttentionEntry, 'priorityReasons'> = {
      workId,
      status: statusOf(events),
      openedAt: events.find((event) => event.kind === 'opened')?.at ?? events[0]?.at ?? '',
      lastAt: events.at(-1)?.at ?? '',
      requirement: latestDefined(classifications, 'requirement') ?? null,
      avoidability: latestDefined(classifications, 'avoidability') ?? null,
      reversibility: latestDefined(classifications, 'reversibility') ?? null,
      exceptionBurden: latestDefined(classifications, 'exceptionBurden') ?? null,
      escalationAttribution: latestDefined(escalations, 'escalationAttribution') ?? null,
      escalationCount: escalations.length,
      confidence: latestDefined(classifications, 'confidence') ?? null,
      evidence,
    };
    return { ...base, priorityReasons: priorityReasons(base) };
  }).sort(compareRank);

  const open = entries.filter((entry) => entry.status === 'open');
  const totals: AttentionTotals = {
    open: open.length,
    humanRequired: open.filter((entry) => entry.requirement === 'human-required').length,
    machineCandidate: open.filter((entry) => entry.requirement === 'machine-candidate').length,
    avoidableHuman: open.filter(
      (entry) => entry.requirement === 'human-required' && entry.avoidability === 'avoidable',
    ).length,
    irreversibleHuman: open.filter(
      (entry) => entry.requirement === 'human-required' && entry.reversibility === 'irreversible',
    ).length,
    routineExceptions: open.filter((entry) => entry.exceptionBurden === 'routine').length,
    materialExceptions: open.filter((entry) => entry.exceptionBurden === 'material').length,
    escalated: open.filter((entry) => entry.escalationCount > 0).length,
    unattributedEscalations: open.filter(
      (entry) => entry.escalationCount > 0 && entry.escalationAttribution === 'unknown',
    ).length,
    lowConfidence: open.filter(
      (entry) => entry.confidence == null || entry.confidence < MACHINE_CANDIDATE_CONFIDENCE,
    ).length,
    evidenceGaps: open.filter((entry) => entry.evidence.length === 0).length,
    unclassified: open.filter(
      (entry) =>
        entry.requirement == null ||
        entry.avoidability == null ||
        entry.reversibility == null ||
        entry.exceptionBurden == null,
    ).length,
  };
  return { entries, open, totals };
}

/**
 * The narrow act lane: only a reversible, evidenced machine candidate with no
 * exception may move.  Returning null is the fail-closed decision.
 */
export function boundedMachineCandidate(log: AttentionLog): AttentionEntry | null {
  if (validateAttentionLog(log).length > 0) return null;
  const ledger = readAttentionLedger(log);
  return ledger.open.find(
    (entry) =>
      entry.requirement === 'machine-candidate' &&
      entry.reversibility === 'reversible' &&
      entry.exceptionBurden === 'none' &&
      entry.confidence !== null &&
      entry.confidence >= MACHINE_CANDIDATE_CONFIDENCE &&
      entry.evidence.length > 0,
  ) ?? null;
}
