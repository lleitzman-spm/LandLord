// The deployed command door. The request names an act, never an event or a
// document replacement. The trusted grant and current policy/evidence versions
// come from Worker secrets; the pure kernel mints the append-only records.

import { evaluateCommand } from '../domain/authority';
import { normalizeChronicle } from '../domain/chronicle';
import { commitAppend, revOf, vaultCasWrite, vaultReadDoc, type AppendDoc } from './vault';

export interface CommandEnv {
  LANDLORD_AUTHORITY_GRANTS?: string;
  LANDLORD_EVIDENCE_VERSION?: string;
  LANDLORD_POLICY_VERSION?: string;
}

interface CommandVault {
  rest: string;
  headers: Record<string, string>;
  docId: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function grantById(encoded: string | undefined, grantId: unknown): unknown {
  if (!encoded || typeof grantId !== 'string') return undefined;
  try {
    const grants = JSON.parse(encoded) as unknown;
    if (!Array.isArray(grants)) return undefined;
    return grants.find(
      (grant) =>
        typeof grant === 'object' &&
        grant !== null &&
        (grant as { id?: unknown }).id === grantId,
    );
  } catch {
    return undefined;
  }
}

function refusalStatus(code: string): number {
  if (code === 'malformed-command') return 400;
  if (
    code === 'stale-chronicle' ||
    code === 'stale-case' ||
    code === 'stale-flow' ||
    code === 'replay' ||
    code === 'wrong-step' ||
    code === 'wrong-attempt' ||
    code === 'engine-refused'
  ) {
    return 409;
  }
  return 403;
}

/** Handle one typed command after Access authentication. `principal` is the
 * verified identity and cannot be supplied by the request. */
export async function handleCommand(
  request: Request,
  env: CommandEnv,
  principal: string,
  vault: CommandVault,
): Promise<Response> {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!env.LANDLORD_EVIDENCE_VERSION || !env.LANDLORD_POLICY_VERSION) {
    return json({ error: 'the authority setting is not configured' }, 503);
  }

  let raw: unknown;
  try {
    raw = JSON.parse((await request.text()) || '{}');
  } catch {
    return json({ error: 'not json' }, 400);
  }

  const read = await vaultReadDoc(vault.rest, vault.headers, vault.docId);
  if (read.status === 'error') return json({ error: 'vault read refused' }, 502);
  if (read.status === 'absent') return json({ error: 'the named case is not in the Chronicle' }, 409);

  const doc = read.doc as AppendDoc;
  const commandRecord =
    typeof raw === 'object' && raw !== null ? (raw as { grantId?: unknown }) : {};
  const grant = grantById(env.LANDLORD_AUTHORITY_GRANTS, commandRecord.grantId);
  const decision = await evaluateCommand(raw, {
    chronicle: normalizeChronicle(doc),
    chronicleVersion: revOf(doc),
    authenticatedPrincipal: principal,
    currentEvidenceVersion: env.LANDLORD_EVIDENCE_VERSION,
    currentPolicyVersion: env.LANDLORD_POLICY_VERSION,
    now: new Date().toISOString(),
    id: () => crypto.randomUUID(),
    grant,
  });
  if (!decision.ok) {
    return json(
      { accepted: false, refusal: { code: decision.code, message: decision.message } },
      refusalStatus(decision.code),
    );
  }

  // Typed acts never replay onto a document they were not evaluated against,
  // including proposal-only batches. Re-evaluation, not transport folklore, is
  // the only safe retry after a conflict.
  const committed = await commitAppend({
    base: doc,
    events: decision.events,
    read: async () => null,
    write: (next, baseRev) =>
      vaultCasWrite(vault.rest, vault.headers, vault.docId, next, baseRev),
    attempts: 1,
  });
  if (committed === 'error') return json({ error: 'vault write refused' }, 502);
  if (committed === 'conflict') {
    return json(
      {
        accepted: false,
        refusal: {
          code: 'stale-chronicle',
          message: 'the Chronicle moved before the accepted batch could commit',
        },
      },
      409,
    );
  }

  return json(
    {
      accepted: true,
      chronicleVersion: revOf(doc) + 1,
      eventIds: decision.events.map((event) => event.id),
    },
    201,
  );
}
