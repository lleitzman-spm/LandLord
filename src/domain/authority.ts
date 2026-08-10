// The authority kernel: one pure refusal point between an outside command and
// the append-only Chronicle. Authentication names a principal; it does not
// grant an act. This module receives the already-authenticated principal, the
// current record, and an expiring grant from the server's trusted setting. It
// either mints the complete event batch or mints nothing.

import type { Chronicle } from './chronicle';
import type { KingdomEvent } from './events';
import {
  approveStep,
  completeStep,
  overrideStep,
  paramsOf,
  proposeStep,
  readFlow,
  type FlowTemplate,
} from './flows';

export type CommandKind =
  | 'complete-step'
  | 'propose-step'
  | 'approve-step'
  | 'override-step'
  | 'correct-event';

export type AuthorityCapability =
  | 'step:complete'
  | 'step:propose'
  | 'step:approve'
  | 'step:override'
  | 'event:correct';

/** Every field is required deliberately. `null` says "not applicable"; an
 * omitted field says the caller and kernel disagree about the protocol. */
export interface ExternalCommand {
  type: CommandKind;
  caseId: string;
  flowKey: string;
  flowVersion: string;
  stepKey: string;
  stepIndex: number;
  attempt: number;
  expectedChronicleVersion: number;
  expectedCaseVersion: string;
  actor: string;
  grantId: string;
  origin: string;
  cause: string;
  idempotencyKey: string;
  evidenceVersion: string;
  policyVersion: string;
  correctionTarget: string | null;
  purpose: string;
  amountCents: number | null;
  note: string | null;
}

/** Grants are trusted setting, never request body. A principal is the identity
 * at the wall; `subject` is the actor written to the record. Keeping both
 * prevents a service identity from impersonating an arbitrary knight. */
export interface AuthorityGrant {
  id: string;
  principal: string;
  subject: string;
  actorKind: 'human' | 'agent';
  capabilities: AuthorityCapability[];
  caseIds: string[];
  flowKeys: string[];
  origins: string[];
  purposes: string[];
  issuedAt: string;
  expiresAt: string;
  maxAmountCents: number | null;
  ordinaryAmountCents: number | null;
  amountRequiredPurposes: string[];
  evidenceVersions: string[];
  policyVersions: string[];
}

export interface AuthorityContext {
  chronicle: Chronicle;
  chronicleVersion: number;
  authenticatedPrincipal: string;
  currentEvidenceVersion: string;
  currentPolicyVersion: string;
  now: string;
  id: () => string;
  grant: unknown;
}

export type AuthorityRefusalCode =
  | 'malformed-command'
  | 'malformed-grant'
  | 'unknown-command'
  | 'unversioned-flow'
  | 'wrong-flow'
  | 'stale-flow'
  | 'missing-case'
  | 'stale-chronicle'
  | 'stale-case'
  | 'wrong-step'
  | 'wrong-attempt'
  | 'forged-actor'
  | 'wrong-grant'
  | 'expired-grant'
  | 'out-of-scope'
  | 'missing-capability'
  | 'wrong-origin'
  | 'wrong-purpose'
  | 'amount-refused'
  | 'human-only'
  | 'stale-evidence'
  | 'stale-policy'
  | 'replay'
  | 'wrong-correction-target'
  | 'engine-refused';

export type AuthorityDecision =
  | {
      ok: true;
      command: ExternalCommand;
      events: AuthorizedKingdomEvent[];
    }
  | {
      ok: false;
      code: AuthorityRefusalCode;
      message: string;
    };

export interface EventAuthority {
  commandId: string;
  grantId: string;
  principal: string;
  actor: string;
  origin: string;
  cause: string;
  idempotencyKey: string;
  flowKey: string;
  flowVersion: string;
  stepKey: string;
  stepIndex: number;
  attempt: number;
  expectedChronicleVersion: number;
  expectedCaseVersion: string;
  evidenceVersion: string;
  policyVersion: string;
  purpose: string;
  amountCents: number | null;
  correctionTarget: string | null;
}

export interface AuthorizedKingdomEvent extends KingdomEvent {
  authority: EventAuthority;
}

const COMMAND_KEYS = [
  'type',
  'caseId',
  'flowKey',
  'flowVersion',
  'stepKey',
  'stepIndex',
  'attempt',
  'expectedChronicleVersion',
  'expectedCaseVersion',
  'actor',
  'grantId',
  'origin',
  'cause',
  'idempotencyKey',
  'evidenceVersion',
  'policyVersion',
  'correctionTarget',
  'purpose',
  'amountCents',
  'note',
] as const;

const GRANT_KEYS = [
  'id',
  'principal',
  'subject',
  'actorKind',
  'capabilities',
  'caseIds',
  'flowKeys',
  'origins',
  'purposes',
  'issuedAt',
  'expiresAt',
  'maxAmountCents',
  'ordinaryAmountCents',
  'amountRequiredPurposes',
  'evidenceVersions',
  'policyVersions',
] as const;

const KINDS: ReadonlySet<string> = new Set([
  'complete-step',
  'propose-step',
  'approve-step',
  'override-step',
  'correct-event',
]);
const CAPABILITIES: ReadonlySet<string> = new Set([
  'step:complete',
  'step:propose',
  'step:approve',
  'step:override',
  'event:correct',
]);

const CAPABILITY_FOR: Record<CommandKind, AuthorityCapability> = {
  'complete-step': 'step:complete',
  'propose-step': 'step:propose',
  'approve-step': 'step:approve',
  'override-step': 'step:override',
  'correct-event': 'event:correct',
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nullableText(value: unknown): value is string | null {
  return value === null || text(value);
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function nullableInteger(value: unknown): value is number | null {
  return value === null || integer(value);
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(text) &&
    new Set(value).size === value.length
  );
}

function parseCommand(raw: unknown): ExternalCommand | null {
  if (!record(raw) || !exactKeys(raw, COMMAND_KEYS)) return null;
  if (!text(raw.type) || !KINDS.has(raw.type)) return null;
  if (
    !text(raw.caseId) ||
    !text(raw.flowKey) ||
    !text(raw.flowVersion) ||
    !text(raw.stepKey) ||
    !integer(raw.stepIndex) ||
    !integer(raw.attempt) ||
    raw.attempt < 1 ||
    !integer(raw.expectedChronicleVersion) ||
    !text(raw.expectedCaseVersion) ||
    !text(raw.actor) ||
    !text(raw.grantId) ||
    !text(raw.origin) ||
    !text(raw.cause) ||
    !text(raw.idempotencyKey) ||
    !text(raw.evidenceVersion) ||
    !text(raw.policyVersion) ||
    !nullableText(raw.correctionTarget) ||
    !text(raw.purpose) ||
    !nullableInteger(raw.amountCents) ||
    !(raw.note === null || typeof raw.note === 'string')
  ) {
    return null;
  }
  return raw as unknown as ExternalCommand;
}

function parseGrant(raw: unknown): AuthorityGrant | null {
  if (!record(raw) || !exactKeys(raw, GRANT_KEYS)) return null;
  if (
    !text(raw.id) ||
    !text(raw.principal) ||
    !text(raw.subject) ||
    (raw.actorKind !== 'human' && raw.actorKind !== 'agent') ||
    !stringArray(raw.capabilities) ||
    !raw.capabilities.every((capability) => CAPABILITIES.has(capability)) ||
    !stringArray(raw.caseIds) ||
    !stringArray(raw.flowKeys) ||
    !stringArray(raw.origins) ||
    !stringArray(raw.purposes) ||
    !text(raw.issuedAt) ||
    !text(raw.expiresAt) ||
    !nullableInteger(raw.maxAmountCents) ||
    !nullableInteger(raw.ordinaryAmountCents) ||
    !stringArray(raw.amountRequiredPurposes) ||
    !stringArray(raw.evidenceVersions) ||
    !stringArray(raw.policyVersions)
  ) {
    return null;
  }
  return raw as unknown as AuthorityGrant;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A small deterministic record fingerprint. It is a concurrency identity,
 * not a credential: the server still protects the authoritative Chronicle
 * with compare-and-set. */
function fingerprint(value: unknown): string {
  const source = canonical(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Exact version of the one case as it stands. A command reasoned against a
 * different sequence has no claim on the present record. */
export function caseVersion(events: readonly KingdomEvent[], caseId: string): string {
  return `case-v1:${fingerprint(events.filter((event) => event.caseId === caseId))}`;
}

/** Flow versions are declarations, not guesses. Historical unversioned books
 * remain readable, but the operational command seam refuses them. */
export function declaredFlowVersion(template: FlowTemplate): string | null {
  const version = (template as FlowTemplate & { version?: unknown }).version;
  return text(version) && version !== 'legacy-unversioned' ? version : null;
}

function refuse(code: AuthorityRefusalCode, message: string): AuthorityDecision {
  return { ok: false, code, message };
}

function eventAuthority(
  command: ExternalCommand,
  context: AuthorityContext,
  commandId: string,
): EventAuthority {
  return {
    commandId,
    grantId: command.grantId,
    principal: context.authenticatedPrincipal,
    actor: command.actor,
    origin: command.origin,
    cause: command.cause,
    idempotencyKey: command.idempotencyKey,
    flowKey: command.flowKey,
    flowVersion: command.flowVersion,
    stepKey: command.stepKey,
    stepIndex: command.stepIndex,
    attempt: command.attempt,
    expectedChronicleVersion: command.expectedChronicleVersion,
    expectedCaseVersion: command.expectedCaseVersion,
    evidenceVersion: command.evidenceVersion,
    policyVersion: command.policyVersion,
    purpose: command.purpose,
    amountCents: command.amountCents,
    correctionTarget: command.correctionTarget,
  };
}

/** Evaluate one outside command. The ordering is intentional: protocol and
 * authority refuse before domain work, and no branch returns a partial batch. */
export function evaluateCommand(raw: unknown, context: AuthorityContext): AuthorityDecision {
  const command = parseCommand(raw);
  if (!command) return refuse('malformed-command', 'the command has missing or unknown fields');
  if (!KINDS.has(command.type)) return refuse('unknown-command', 'the command kind is unknown');

  const grant = parseGrant(context.grant);
  if (!grant) return refuse('malformed-grant', 'the trusted grant is unreadable');
  if (grant.id !== command.grantId) return refuse('wrong-grant', 'the command names another grant');
  if (
    grant.principal !== context.authenticatedPrincipal ||
    grant.subject !== command.actor
  ) {
    return refuse('forged-actor', 'the authenticated principal may not speak as this actor');
  }

  const now = Date.parse(context.now);
  const issued = Date.parse(grant.issuedAt);
  const expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(issued) || !Number.isFinite(expires) || now < issued || now >= expires) {
    return refuse('expired-grant', 'the authority grant is not in force');
  }
  if (!grant.caseIds.includes(command.caseId) || !grant.flowKeys.includes(command.flowKey)) {
    return refuse('out-of-scope', 'the case or flow lies outside the grant');
  }
  if (!grant.capabilities.includes(CAPABILITY_FOR[command.type])) {
    return refuse('missing-capability', 'the grant does not carry this capability');
  }
  if (!grant.origins.includes(command.origin)) {
    return refuse('wrong-origin', 'the command origin lies outside the grant');
  }
  if (!grant.purposes.includes(command.purpose)) {
    return refuse('wrong-purpose', 'the command purpose lies outside the grant');
  }
  if (
    command.type === 'approve-step' ||
    command.type === 'override-step'
  ) {
    if (grant.actorKind !== 'human') {
      return refuse('human-only', 'approval and override remain the human ratchet');
    }
  }

  if (grant.amountRequiredPurposes.includes(command.purpose) && command.amountCents === null) {
    return refuse('amount-refused', 'this granted purpose requires an exact amount');
  }
  if (command.amountCents !== null) {
    if (grant.maxAmountCents === null || command.amountCents > grant.maxAmountCents) {
      return refuse('amount-refused', 'the amount exceeds the grant');
    }
    const ordinary = grant.ordinaryAmountCents;
    if (ordinary === null || command.amountCents > ordinary) {
      if (grant.actorKind !== 'human') {
        return refuse('human-only', 'exceptional money remains the human ratchet');
      }
    }
  }

  if (
    command.evidenceVersion !== context.currentEvidenceVersion ||
    !grant.evidenceVersions.includes(command.evidenceVersion)
  ) {
    return refuse('stale-evidence', 'the evidence version is not current and granted');
  }
  if (
    command.policyVersion !== context.currentPolicyVersion ||
    !grant.policyVersions.includes(command.policyVersion)
  ) {
    return refuse('stale-policy', 'the policy version is not current and granted');
  }
  if (command.expectedChronicleVersion !== context.chronicleVersion) {
    return refuse('stale-chronicle', 'the Chronicle moved after the command was formed');
  }
  if (command.expectedCaseVersion !== caseVersion(context.chronicle.events, command.caseId)) {
    return refuse('stale-case', 'the case moved after the command was formed');
  }

  const template = context.chronicle.flows.find((flow) => flow.key === command.flowKey);
  if (!template || !command.caseId.startsWith(`${command.flowKey}: `)) {
    return refuse('wrong-flow', 'the case does not belong to the named flow');
  }
  const flowVersion = declaredFlowVersion(template);
  if (!flowVersion) return refuse('unversioned-flow', 'this historical flow has no operational version');
  if (command.flowVersion !== flowVersion) {
    return refuse('stale-flow', 'the command was formed against another flow version');
  }

  const reading = readFlow(template, context.chronicle.events, command.caseId, context.now);
  if (!reading) return refuse('missing-case', 'the named case is not in the Chronicle');
  if (
    !reading.next ||
    reading.next.step.key !== command.stepKey ||
    reading.next.index - 1 !== command.stepIndex
  ) {
    return refuse('wrong-step', 'only the exact step in hand may be acted');
  }
  if (command.attempt !== reading.next.failures + 1) {
    return refuse('wrong-attempt', 'the command names another attempt');
  }

  const prior = context.chronicle.events as AuthorizedKingdomEvent[];
  if (prior.some((event) => event.authority?.idempotencyKey === command.idempotencyKey)) {
    return refuse('replay', 'the idempotency key has already been accepted');
  }

  if (command.type === 'correct-event') {
    if (!command.correctionTarget) {
      return refuse('wrong-correction-target', 'a correction must name the event it reverses');
    }
    const target = context.chronicle.events.find(
      (event) => event.id === command.correctionTarget && event.caseId === command.caseId,
    );
    if (
      !target ||
      prior.some((event) => event.authority?.correctionTarget === command.correctionTarget)
    ) {
      return refuse('wrong-correction-target', 'the target is absent, cross-case, or already corrected');
    }
  } else if (command.correctionTarget !== null) {
    return refuse('wrong-correction-target', 'only a correction may name a correction target');
  }

  const opts = {
    at: context.now,
    id: context.id,
    note: command.note ?? undefined,
    actor: command.actor,
    log: context.chronicle.events,
  };
  const params = paramsOf(context.chronicle.events, command.caseId);
  let minted: KingdomEvent[];
  if (command.type === 'complete-step') {
    minted = completeStep(template, command.caseId, command.stepIndex, opts, params);
  } else if (command.type === 'propose-step') {
    const proposal = proposeStep(
      template,
      command.caseId,
      command.stepIndex,
      command.actor,
      opts,
    );
    minted = proposal ? [proposal] : [];
  } else if (command.type === 'approve-step') {
    minted = approveStep(template, command.caseId, command.stepIndex, opts, params);
  } else if (command.type === 'override-step') {
    minted = overrideStep(template, command.caseId, command.stepIndex, opts, params);
  } else {
    const step = template.steps[command.stepIndex];
    minted = [
      {
        id: context.id(),
        at: context.now,
        caseId: command.caseId,
        kind: 'noted',
        catalogRow: step.catalogRow,
        holder: step.holder,
        actor: command.actor,
        note: `Step ${command.stepIndex + 1}/${template.steps.length} · correction recorded`,
      },
    ];
  }
  if (!minted.length) return refuse('engine-refused', 'the flow engine refused this act');

  const commandId = context.id();
  const authority = eventAuthority(command, context, commandId);
  const events = minted.map((event) => ({ ...event, authority }));
  return { ok: true, command, events };
}
