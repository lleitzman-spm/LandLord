import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from 'jose';

export interface AccessEnv {
  /** Full Access team origin, e.g. https://<your-team>.cloudflareaccess.com. */
  TEAM_DOMAIN?: string;
  /** The Access application's audience tag. */
  POLICY_AUD?: string;
  /**
   * Optional public JWKS JSON. This is a cryptographic test/offline seam, not
   * an identity override: assertions still need a valid signature, issuer,
   * audience, expiry, and email claim.
   */
  CF_ACCESS_JWKS?: string;
  /** Separate bearer capability for the machine-only canonical Chronicle door. */
  CANONICAL_CAPABILITY_TOKEN?: string;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
}

/** A distinct machine capability; missing user identity never implies this role. */
export async function authenticateCanonicalCapability(
  request: Request,
  env: AccessEnv,
): Promise<AccessIdentity> {
  const configured = env.CANONICAL_CAPABILITY_TOKEN;
  if (!configured) {
    return { ok: false, status: 503, message: 'canonical capability not configured' };
  }
  const authorization = request.headers.get('Authorization') ?? '';
  const presented = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!presented) {
    return { ok: false, status: 401, message: 'canonical capability required' };
  }
  const [left, right] = await Promise.all([digest(configured), digest(presented)]);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0
    ? { ok: true, email: 'canonical-service' }
    : { ok: false, status: 401, message: 'canonical capability invalid' };
}

export type AccessIdentity =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 503; message: string };

const remoteKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function teamOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname !== '/') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function keySet(env: AccessEnv, origin: string): JWTVerifyGetKey {
  if (env.CF_ACCESS_JWKS) {
    const parsed = JSON.parse(env.CF_ACCESS_JWKS) as JSONWebKeySet;
    if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) {
      throw new Error('CF_ACCESS_JWKS has no signing keys');
    }
    return createLocalJWKSet(parsed);
  }
  let keys = remoteKeys.get(origin);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${origin}/cdn-cgi/access/certs`));
    remoteKeys.set(origin, keys);
  }
  return keys;
}

/**
 * Authenticate the assertion Cloudflare Access places on an origin request.
 * The convenience email header is deliberately ignored: identity is derived
 * only from claims whose signature, issuer, audience, and time bounds verify.
 */
export async function authenticateAccess(
  request: Request,
  env: AccessEnv,
): Promise<AccessIdentity> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, status: 401, message: 'Access assertion required' };

  const origin = teamOrigin(env.TEAM_DOMAIN);
  const audience = env.POLICY_AUD?.trim();
  if (!origin || !audience) {
    return { ok: false, status: 503, message: 'Access verifier not configured' };
  }

  // Built OUTSIDE the try below: a malformed CF_ACCESS_JWKS is OUR broken
  // configuration, and reporting it as "assertion invalid" sends whoever is
  // setting the wall up to look at the caller's token instead of at the env.
  let keys: JWTVerifyGetKey;
  try {
    keys = keySet(env, origin);
  } catch {
    return { ok: false, status: 503, message: 'Access verifier not configured' };
  }

  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer: origin,
      audience,
      // `exp` is only ENFORCED when the claim is present — a token carrying no
      // expiry at all would otherwise verify and never go stale. Access always
      // sets it; requiring it means a forged or hand-rolled assertion cannot
      // opt out of expiry by omission.
      requiredClaims: ['exp'],
    });
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!emailShape.test(email)) {
      return { ok: false, status: 401, message: 'Access identity invalid' };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, status: 401, message: 'Access assertion invalid' };
  }
}
