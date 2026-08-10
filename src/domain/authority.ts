// The authority kernel: one pure refusal point between an outside command and
// the append-only Chronicle. Authentication names a principal; it does not
// grant an act. This module receives the already-authenticated principal, the
// current record, and an expiring grant from the server's trusted setting. It
// either mints the complete event batch or mints nothing.
//
// This governs the deployed external command seam only. The game's internal
// helpers remain simulation machinery, not equivalent enforcement, and the
// untyped fleet route stays disabled until it speaks this protocol.

import type { Chronicle } from './chronicle';
import type { Catalog } from './catalog';
import type { KingdomEvent } from './events';
import {
  approveStep,
  completeStep,
  overrideStep,
  paramsOf,
  proposeStep,
  readFlow,
  mayRunUnattended,
  type FlowTemplate,
} from './flows';

export type CommandKind =
  | 'complete-step'
  | 'propose-step'
  | 'approve-step'
  | 'override-step';

export type AuthorityCapability =
  | 'step:complete'
  | 'step:propose'
  | 'step:approve'
  | 'step:override';

export interface GrantedFlow {
  key: string;
  version: string;
  sha256: string;
}

export interface GrantedStepPolicy {
  flowKey: string;
  stepKey: string;
  purpose: string;
  money: boolean;
}

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
  causeRef: string;
  idempotencyKey: string;
  evidenceVersion: string;
  policyVersion: string;
  purpose: string;
  amountCents: number | null;
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
  catalogSha256: string;
  flows: GrantedFlow[];
  stepPolicies: GrantedStepPolicy[];
  origins: string[];
  causeRefs: string[];
  issuedAt: string;
  expiresAt: string;
  maxAmountCents: number | null;
  ordinaryAmountCents: number | null;
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
  | 'flow-digest-mismatch'
  | 'catalog-digest-mismatch'
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
  | 'wrong-cause'
  | 'wrong-purpose'
  | 'amount-refused'
  | 'human-only'
  | 'stale-evidence'
  | 'stale-policy'
  | 'replay'
  | 'unattended-refused'
  | 'proposal-already-pending'
  | 'proposal-requires-ratification'
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
  causeRef: string;
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
  'causeRef',
  'idempotencyKey',
  'evidenceVersion',
  'policyVersion',
  'purpose',
  'amountCents',
] as const;

const GRANT_KEYS = [
  'id',
  'principal',
  'subject',
  'actorKind',
  'capabilities',
  'caseIds',
  'catalogSha256',
  'flows',
  'stepPolicies',
  'origins',
  'causeRefs',
  'issuedAt',
  'expiresAt',
  'maxAmountCents',
  'ordinaryAmountCents',
  'evidenceVersions',
  'policyVersions',
] as const;

const KINDS: ReadonlySet<string> = new Set([
  'complete-step',
  'propose-step',
  'approve-step',
  'override-step',
]);
const CAPABILITIES: ReadonlySet<string> = new Set([
  'step:complete',
  'step:propose',
  'step:approve',
  'step:override',
]);

const CAPABILITY_FOR: Record<CommandKind, AuthorityCapability> = {
  'complete-step': 'step:complete',
  'propose-step': 'step:propose',
  'approve-step': 'step:approve',
  'override-step': 'step:override',
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

function sha256Text(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
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

const FLOW_GRANT_KEYS = ['key', 'version', 'sha256'] as const;
const STEP_POLICY_KEYS = ['flowKey', 'stepKey', 'purpose', 'money'] as const;

function grantedFlows(value: unknown): value is GrantedFlow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        exactKeys(item, FLOW_GRANT_KEYS) &&
        text(item.key) &&
        text(item.version) &&
        sha256Text(item.sha256),
    ) &&
    new Set(value.map((item) => `${(item as GrantedFlow).key}\0${(item as GrantedFlow).version}`)).size ===
      value.length
  );
}

function grantedStepPolicies(value: unknown): value is GrantedStepPolicy[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        exactKeys(item, STEP_POLICY_KEYS) &&
        text(item.flowKey) &&
        text(item.stepKey) &&
        text(item.purpose) &&
        typeof item.money === 'boolean',
    ) &&
    new Set(
      value.map(
        (item) => `${(item as GrantedStepPolicy).flowKey}\0${(item as GrantedStepPolicy).stepKey}`,
      ),
    ).size === value.length
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
    !sha256Text(raw.expectedCaseVersion) ||
    !text(raw.actor) ||
    !text(raw.grantId) ||
    !text(raw.origin) ||
    !text(raw.causeRef) ||
    !text(raw.idempotencyKey) ||
    !text(raw.evidenceVersion) ||
    !text(raw.policyVersion) ||
    !text(raw.purpose) ||
    !nullableInteger(raw.amountCents)
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
    !sha256Text(raw.catalogSha256) ||
    !grantedFlows(raw.flows) ||
    !grantedStepPolicies(raw.stepPolicies) ||
    !stringArray(raw.origins) ||
    !stringArray(raw.causeRefs) ||
    !text(raw.issuedAt) ||
    !text(raw.expiresAt) ||
    !nullableInteger(raw.maxAmountCents) ||
    !nullableInteger(raw.ordinaryAmountCents) ||
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

/** Collision-resistant canonical digest, using the Web Crypto primitive shared
 * by Workers and current Node. It is async so no runtime substitutes a small,
 * non-cryptographic hash at an authority boundary. */
async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Exact version of the one case as it stands. A command reasoned against a
 * different sequence has no claim on the present record. */
export async function caseVersion(
  events: readonly KingdomEvent[],
  caseId: string,
): Promise<string> {
  return sha256(events.filter((event) => event.caseId === caseId));
}

/** Digest the complete loaded flow shape. The trusted grant binds both its
 * declared version and this digest; changing bytes without changing a label is
 * therefore a refusal, not a silent policy rewrite. */
export async function flowDigest(template: FlowTemplate): Promise<string> {
  return sha256(template);
}

/** The catalog supplies inherited execution modes. Binding its complete bytes
 * prevents a catalog-only human-to-auto flip from widening a standing grant. */
export async function catalogDigest(catalog: Catalog): Promise<string> {
  return sha256(catalog);
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
    causeRef: command.causeRef,
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
  };
}

/** Evaluate one outside command. The ordering is intentional: protocol and
 * authority refuse before domain work, and no branch returns a partial batch. */
export async function evaluateCommand(
  raw: unknown,
  context: AuthorityContext,
): Promise<AuthorityDecision> {
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
  if (!grant.caseIds.includes(command.caseId)) {
    return refuse('out-of-scope', 'the case lies outside the grant');
  }
  if (!grant.capabilities.includes(CAPABILITY_FOR[command.type])) {
    return refuse('missing-capability', 'the grant does not carry this capability');
  }
  if (!grant.origins.includes(command.origin)) {
    return refuse('wrong-origin', 'the command origin lies outside the grant');
  }
  if (!/^[a-z][a-z0-9._/-]{2,127}$/.test(command.causeRef) || !grant.causeRefs.includes(command.causeRef)) {
    return refuse('wrong-cause', 'the cause reference is malformed or outside the grant');
  }
  if (
    command.type === 'approve-step' ||
    command.type === 'override-step'
  ) {
    if (grant.actorKind !== 'human') {
      return refuse('human-only', 'approval and override remain the human ratchet');
    }
  }

  const stepPolicy = grant.stepPolicies.find(
    (policy) => policy.flowKey === command.flowKey && policy.stepKey === command.stepKey,
  );
  if (!stepPolicy || stepPolicy.purpose !== command.purpose) {
    return refuse('wrong-purpose', 'the trusted step policy does not grant this purpose');
  }
  if (stepPolicy.money && command.amountCents === null) {
    return refuse('amount-refused', 'this money-affecting step requires an exact amount');
  }
  if (!stepPolicy.money && command.amountCents !== null) {
    return refuse('amount-refused', 'this step is not classified to carry money');
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
  if (command.expectedCaseVersion !== (await caseVersion(context.chronicle.events, command.caseId))) {
    return refuse('stale-case', 'the case moved after the command was formed');
  }

  const template = context.chronicle.flows.find((flow) => flow.key === command.flowKey);
  if (!template || !command.caseId.startsWith(`${command.flowKey}: `)) {
    return refuse('wrong-flow', 'the case does not belong to the named flow');
  }
  const flowVersion = declaredFlowVersion(template);
  if (!flowVersion) return refuse('unversioned-flow', 'this historical flow has no operational version');
  const grantedFlow = grant.flows.find(
    (entry) => entry.key === command.flowKey && entry.version === command.flowVersion,
  );
  if (!grantedFlow) {
    return refuse('out-of-scope', 'the exact flow version lies outside the grant');
  }
  if (command.flowVersion !== flowVersion) {
    return refuse('stale-flow', 'the command was formed against another flow version');
  }
  if ((await flowDigest(template)) !== grantedFlow.sha256) {
    return refuse('flow-digest-mismatch', 'the loaded flow bytes do not match the trusted grant');
  }
  if ((await catalogDigest(context.chronicle.catalog)) !== grant.catalogSha256) {
    return refuse(
      'catalog-digest-mismatch',
      'the loaded catalog bytes do not match the trusted grant',
    );
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

  if (command.type === 'propose-step' && reading.next.kind === 'proposed') {
    return refuse('proposal-already-pending', 'this step already has a proposal awaiting judgment');
  }

  if (command.type === 'complete-step' && reading.next.kind === 'proposed') {
    return refuse(
      'proposal-requires-ratification',
      'a proposed step may advance only through approve or override with that capability',
    );
  }

  if (command.type === 'complete-step' && grant.actorKind === 'agent') {
    const modes = new Map(context.chronicle.catalog.map((row) => [row.key, row.mode]));
    if (!mayRunUnattended(reading.next.step, modes)) {
      return refuse(
        'unattended-refused',
        'an agent may complete only an auto step with no outside wait or unresolved mode',
      );
    }
  }

  const prior = context.chronicle.events as AuthorizedKingdomEvent[];
  if (prior.some((event) => event.authority?.idempotencyKey === command.idempotencyKey)) {
    return refuse('replay', 'the idempotency key has already been accepted');
  }

  const opts = {
    at: context.now,
    id: context.id,
    note: command.causeRef,
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
  } else {
    minted = overrideStep(template, command.caseId, command.stepIndex, opts, params);
  }
  if (!minted.length) return refuse('engine-refused', 'the flow engine refused this act');

  const commandId = context.id();
  const authority = eventAuthority(command, context, commandId);
  const events = minted.map((event) => ({ ...event, authority }));
  return { ok: true, command, events };
}
