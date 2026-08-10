/**
 * A separate, names-free deployment proof.
 *
 * This Worker cannot read or change the kingdom: it has no bindings, secrets,
 * routes, assets, identity, vault, or agent seam.  Its one response proves only
 * that these reviewed bytes reached an isolated workers.dev address.
 */

declare const AUDIT_SOURCE_COMMIT: string | undefined;
declare const AUDIT_SOURCE_TREE: string | undefined;

const sourceCommit = typeof AUDIT_SOURCE_COMMIT === 'string' ? AUDIT_SOURCE_COMMIT : 'local-unpinned';
const sourceTree = typeof AUDIT_SOURCE_TREE === 'string' ? AUDIT_SOURCE_TREE : 'local-unpinned';

export const AUDIT_SHADOW_PROOF = Object.freeze({
  schema: 'audit-activation-proof/v1',
  provenance: 'SIMULATION',
  purpose: 'isolated-static-deployment-proof',
  sourceCommit,
  sourceTree,
  applied: false,
  bindings: 0,
  deploymentExternalState: 'worker-script-only',
  operationalExternalEffects: 'none',
} as const);

const PROOF_PATH = '/proof';
const SAFE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
});

function empty(status: number, allow?: string): Response {
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (allow) headers.set('allow', allow);
  return new Response(null, { status, headers });
}

export function createAuditShadowWorker() {
  return {
    async fetch(request: Request): Promise<Response> {
      const { pathname } = new URL(request.url);
      if (pathname !== PROOF_PATH) return empty(404);
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return empty(405, 'GET, HEAD');
      }

      return new Response(
        request.method === 'HEAD' ? null : `${JSON.stringify(AUDIT_SHADOW_PROOF)}\n`,
        { status: 200, headers: SAFE_HEADERS },
      );
    },
  };
}

export default createAuditShadowWorker();
