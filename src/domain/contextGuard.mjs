/**
 * The one model-context boundary, shared by browser builds, the Worker, and
 * the Node harness. Provider transports stay private behind `guardComplete`;
 * callers can construct only a client that scans before it sends.
 */

/** What was found, and enough context to locate it without repeating it. */
export class IdentityLeakError extends Error {
  constructor(findings) {
    super(
      `refusing to send identity to a model: ${findings
        .map((f) => `${f.kind} in ${f.where} (${f.masked})`)
        .join('; ')}`,
    );
    this.name = 'IdentityLeakError';
    this.findings = findings;
  }
}

/** Show enough to locate a value, never enough to use it. */
function mask(value) {
  const text = value.trim();
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${text.slice(0, 2)}${'*'.repeat(Math.max(3, text.length - 4))}${text.slice(-2)}`;
}

function luhn(digits) {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (alt) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function aba(digits) {
  if (!/^\d{9}$/.test(digits)) return false;
  const d = [...digits].map(Number);
  const sum =
    3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + d[2] + d[5] + d[8];
  return sum % 10 === 0 && sum !== 0;
}

/**
 * Detectors are intentionally about direct identity, not a provider. In
 * addition to financial/contact identifiers, the boundary rejects locations,
 * unit designators, and names in the forms that can enter LandLord prompts.
 * A model gets operational facts and opaque references, never the person or
 * door those facts belong to.
 */
const DIRECT_IDENTIFIER_DETECTORS = [
  { kind: 'government-id', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    kind: 'payment-card',
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    verify: (hit) => luhn(hit.replace(/[ -]/g, '')),
  },
  { kind: 'bank-account', re: /\b\d{9}\b/g, verify: aba },
  { kind: 'email', re: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'phone', re: /(?:\+1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g },
  {
    // Compact phone numbers are ambiguous by themselves (invoice/case
    // numbers often have ten digits), but a contact verb or label makes the
    // meaning unambiguous.
    kind: 'phone',
    re: /\b(?:phone|tel|telephone|mobile|cell|call|text)\s*[:=]?\s*(?:\+?1[ .-]*)?\d{10}\b/gi,
  },
];

const MODEL_ONLY_DETECTORS = [
  {
    kind: 'street-address',
    re: /\b\d{1,6}\s+(?:[A-Za-z][\w'-]*\s+){0,5}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Way|Drive|Dr|Court|Ct|Boulevard|Blvd|Close|Row|Place|Pl|Trail|Trl)\b(?:\s*,?\s*(?:unit|apt|apartment|suite|#)\s*[A-Za-z0-9-]+)?/gi,
  },
  {
    kind: 'unit-address',
    re: /\b(?:unit|apt|apartment|suite)\s*(?:number\s*)?[A-Za-z0-9-]+\b/gi,
  },
  {
    kind: 'person-name',
    re: /\b(?:tenant|resident|owner|applicant|petitioner|contact|customer|name)\s*[:=]\s*[A-Z][A-Za-z'-]+(?:\s+(?:the\s+)?[A-Z][A-Za-z'-]+){1,4}\b/g,
  },
  {
    kind: 'person-name',
    re: /\b(?:tenant|resident|owner|applicant|petitioner|contact|customer)\s+(?:named\s+)?[A-Z][A-Za-z'-]+\s+[A-Z][A-Za-z'-]+(?=\s+(?:reports?|says?|requests?|called|emailed|occupies|owns|applied)\b|[,.;]|$)/g,
  },
  {
    kind: 'person-name',
    re: /(?:^|[—–]\s*)[A-Z][A-Za-z'-]+\s+the\s+[A-Z][A-Za-z'-]+\b/gm,
  },
];

function findWith(detectors, text, where) {
  const findings = [];
  if (!text) return findings;
  for (const detector of detectors) {
    detector.re.lastIndex = 0;
    for (const match of text.matchAll(detector.re)) {
      const hit = match[0];
      if (detector.verify && !detector.verify(hit)) continue;
      findings.push({ kind: detector.kind, masked: mask(hit), where });
    }
  }
  return findings;
}

const STRONG_IDENTITY_FIELD =
  /^(?:full name|(?:tenant|resident|owner|applicant|petitioner|contact|customer)(?: name)?|address|unit|email(?: address)?|(?:phone|tel|telephone|mobile|cell)(?: number)?)$/;
const PERSON_NAME_VALUE =
  /^[A-Z][A-Za-z'-]+(?:\s+(?:the\s+)?[A-Z][A-Za-z'-]+){1,4}$/;

function normalizedFieldName(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function isJsonSchemaNode(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.type === 'string' &&
    /^(?:string|number|integer|boolean|object|array|null)$/.test(value.type)
  );
}

function isIdentityField(key, entry) {
  // A property definition is metadata about a possible future argument, not
  // an argument value. Its key may legitimately be `tenant`, `contact`, etc.
  if (isJsonSchemaNode(entry)) return false;
  const field = normalizedFieldName(key);
  if (STRONG_IDENTITY_FIELD.test(field)) return entry != null && entry !== '';

  // `name` is ubiquitous in provider tool schemas, JSON Schema, and other
  // structural metadata. Treat it as identity only when its value itself has
  // the shape of a person's full name. Labeled free text is still caught by
  // MODEL_ONLY_DETECTORS.
  return (
    field === 'name' &&
    typeof entry === 'string' &&
    PERSON_NAME_VALUE.test(entry.trim())
  );
}

/**
 * Scan durable intake for unambiguous private identifiers. Opaque case/door
 * references remain legal Chronicle data; the stricter model scan below still
 * prevents those location-like references crossing the provider boundary.
 */
export function findPersistentIdentity(text, where = 'payload') {
  return findWith(DIRECT_IDENTIFIER_DETECTORS, text, where);
}

/** Scan one blob of outgoing model text, including direct location/name forms. */
export function findIdentity(text, where = 'payload') {
  return findWith(
    [...DIRECT_IDENTIFIER_DETECTORS, ...MODEL_ONLY_DETECTORS],
    text,
    where,
  );
}

function scan(value, where, findings, seen) {
  if (typeof value === 'string') {
    findings.push(...findIdentity(value, where));
    return;
  }
  if (value == null || typeof value !== 'object') return;
  if (seen.has(value)) throw new IdentityLeakError([
    { kind: 'unscannable-payload', masked: 'circular value', where },
  ]);
  seen.add(value);
  if (typeof value.toJSON === 'function') {
    let serialized;
    try {
      serialized = value.toJSON();
    } catch {
      throw new IdentityLeakError([
        { kind: 'unscannable-payload', masked: 'toJSON failed', where },
      ]);
    }
    if (serialized !== value) scan(serialized, `${where}.toJSON()`, findings, seen);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scan(entry, `${where}[${index}]`, findings, seen));
  } else {
    for (const [key, entry] of Object.entries(value)) {
      if (isIdentityField(key, entry)) {
        findings.push({
          kind: 'identity-field',
          masked: mask(key),
          where: `${where}.${key}`,
        });
      }
      scan(entry, `${where}.${key}`, findings, seen);
    }
  }
  seen.delete(value);
}

/** Scan every string that will cross the provider boundary, including tools. */
export function assertNoIdentity(payload) {
  const findings = [];
  scan(payload, 'payload', findings, new WeakSet());
  if (findings.length) throw new IdentityLeakError(findings);
}

function unscannable(masked, where = 'payload') {
  return new IdentityLeakError([
    { kind: 'unscannable-payload', masked, where },
  ]);
}

function freezeDeep(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) freezeDeep(entry);
  return value;
}

/**
 * Materialize the JSON-bound model arguments exactly once. Stateful `toJSON`
 * methods and getters therefore cannot show the scanner one value and the
 * provider's later JSON serialization another.
 *
 * `signal` is the sole transport control accepted by both provider clients. It
 * never enters their request body, so preserve the original AbortSignal beside
 * (not inside) the frozen, scanned JSON representation.
 */
function materializeModelPayload(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw unscannable('payload is not an object');
  }

  const serializable = {};
  let signal;
  let hasSignal = false;
  try {
    for (const key of Object.keys(payload)) {
      const entry = payload[key];
      if (key === 'signal') {
        signal = entry;
        hasSignal = true;
      } else {
        serializable[key] = entry;
      }
    }
    const json = JSON.stringify(serializable);
    if (json == null) throw new Error('no JSON representation');
    const modelPayload = JSON.parse(json);
    if (modelPayload == null || typeof modelPayload !== 'object' || Array.isArray(modelPayload)) {
      throw new Error('JSON representation is not an object');
    }
    freezeDeep(modelPayload);
    return { modelPayload, signal, hasSignal };
  } catch (error) {
    if (error instanceof IdentityLeakError) throw error;
    throw unscannable('serialization failed');
  }
}

/**
 * Construct the only provider-facing client. `onBlocked` lets a route remember
 * that a clerk swallowed the exception for fallback; the route can then reject
 * the whole run before any proposal is persisted.
 */
/** Marks a transport that already has the identity boundary in front of it. */
export const IDENTITY_GUARDED = Symbol.for('landlord.identityGuarded');

/** True when `fn` is already wrapped by `guardComplete`. */
export function isIdentityGuarded(fn) {
  return typeof fn === 'function' && fn[IDENTITY_GUARDED] === true;
}

export function guardComplete(complete, options = {}) {
  const guarded = async (payload) => {
    let prepared;
    try {
      prepared = materializeModelPayload(payload);
      assertNoIdentity(prepared.modelPayload);
    } catch (error) {
      if (error instanceof IdentityLeakError) options.onBlocked?.(error);
      throw error;
    }
    const exactPayload = prepared.hasSignal
      ? Object.freeze({ ...prepared.modelPayload, signal: prepared.signal })
      : prepared.modelPayload;
    return complete(exactPayload);
  };
  // A visible mark that this transport has the boundary in front of it. Read
  // by `harness/agents/rig.mjs`, which must guarantee "no agent reaches
  // identity" for every agent it deploys but is handed its `complete` by the
  // caller. Without a mark the rig can only choose between wrapping blindly —
  // which would swallow the FIRST leak and so bypass an inner `onBlocked`,
  // silently defeating `runGuardedModelWork`'s poison flag — and trusting the
  // caller. The mark lets it wrap only what is genuinely unguarded.
  Object.defineProperty(guarded, IDENTITY_GUARDED, { value: true });
  return guarded;
}
