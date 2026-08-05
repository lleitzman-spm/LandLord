// The one soundness checker for the money-dimension — folds the invariants that
// must ALWAYS hold over any chronicle's economy, and returns the list of
// violations (empty ⇒ sound). These are the identities already encoded in the
// domain; here they become a single reusable assertion the whole suite (and
// later shots) fold any doc through.
import { normalizeChronicle, type Chronicle } from '../src/domain/chronicle';
import {
  readPostings,
  postingsFor,
  booksBalance,
  bridgeCheck,
  readSolvency,
  readCompliance,
  readOwnerStatement,
  ownersInLog,
  balanceOf,
  type MoneyLog,
  type EconomyBook,
} from '../src/domain/economy';

export interface SoundnessOptions {
  /** The state clock, for the time-dependent fee-aging check. When omitted the
   *  aging check is skipped (it can legitimately flag on a stale clock and is
   *  not a structural corruption). */
  now?: string;
}

/** Every way the money books can be internally inconsistent, as plain strings.
 *  Structural — independent of the wall clock unless `now` is passed. */
export function chronicleSoundnessViolations(doc: unknown, opts: SoundnessOptions = {}): string[] {
  const c: Chronicle = normalizeChronicle(doc);
  const money = c.money;
  const economy = c.economy;
  const v: string[] = [];

  // R1 — no money event silently drops to postingsFor's `default: []`. A real
  // kind with no posting case understates every book with no error.
  for (const e of money) {
    if (postingsFor(e).length === 0) {
      v.push(`money event ${e.id} (kind "${e.kind}") produced no postings — silent drop`);
    }
  }

  const postings = readPostings(money);

  // Double-entry: each book balances (Σdebits = Σcredits).
  const bb = booksBalance(postings);
  if (!bb.balanced) {
    v.push(`books do not balance — trust ${bb.trust}, corporate ${bb.corporate} (expected 0/0)`);
  }

  // The bridge ties: fees owed to the company in trust == the company's receivable.
  const bridge = bridgeCheck(economy, money);
  if (!bridge.tied) {
    v.push(`bridge untied — dueToMgmt ${bridge.dueToMgmt} ≠ dueFromTrust ${bridge.dueFromTrust}`);
  }

  // Trust solvency identity: variance ≡ AP − AR always (the engine is consistent).
  const s = readSolvency(economy, money);
  if (!s.reconciles) {
    v.push(`solvency identity broken — variance ${s.variance} ≠ apVendors ${s.apVendors} − arTenants ${s.arTenants}`);
  }

  // The domain's own compliance guards (owner not overdrawn, trust bank not
  // overdrawn, deposits intact). Fee aging is time-dependent — only enforced
  // when a clock is supplied.
  const compliance = readCompliance(economy, money, opts.now);
  for (const check of compliance.checks) {
    if (check.ok) continue;
    if (check.key === 'fee_aging' && opts.now == null) continue;
    v.push(`compliance "${check.label}" failed — ${check.detail}`);
  }

  return v;
}

/** Throws with a legible report if the doc's money books are unsound. */
export function assertChronicleSound(doc: unknown, opts: SoundnessOptions = {}): void {
  const v = chronicleSoundnessViolations(doc, opts);
  if (v.length) {
    throw new Error(`chronicle unsound (${v.length}):\n  - ${v.join('\n  - ')}`);
  }
}

// ── Fiduciary soundness — the layer above self-consistency ────────────────────
// assertChronicleSound proves the books are internally consistent; it can't see
// the failures that actually destroy trust accounting, because they leave the
// AGGREGATE clean: money allocated to the wrong owner/tenant while totals tie,
// an over-sweep that drives the fee bridge equally negative, and a trust bank
// that is overdrawn MID-history but cured by the end-state fold. This layer folds
// PER PARTY and (optionally) POINT-IN-TIME to catch that class. (Surfaced by a
// cross-vendor K3 adversarial review of the Shot-0 checker, 2026-07-22.)

const TRUST_CASH_ROLES = ['trust_cash_rent', 'trust_cash_deposits', 'owner_reserve_cash'];

/** Every way the books can be internally clean yet a FIDUCIARY breach — folded
 *  over one money slice (a full log, or a prefix during temporal replay). */
function fiduciaryViolationsAt(economy: EconomyBook, money: MoneyLog, tag = ''): string[] {
  const v: string[] = [];
  const at = tag ? ` (${tag})` : '';
  const p = readPostings(money);

  // No trust bank overdrawn — spending money that is not there.
  for (const role of TRUST_CASH_ROLES) {
    const bal = balanceOf(economy, p, role);
    if (bal < 0) v.push(`trust bank ${role} overdrawn: ${bal}${at}`);
  }

  // No over-sweep — a fee_sweep larger than fees earned drives the bridge
  // equally negative (it still "ties"); the company would be holding owner money.
  const dueToMgmt = balanceOf(economy, p, 'due_to_mgmt');
  const dueFromTrust = balanceOf(economy, p, 'due_from_trust');
  if (dueToMgmt < 0) v.push(`over-swept — due_to_mgmt negative: ${dueToMgmt}${at}`);
  if (dueFromTrust < 0) v.push(`over-swept — due_from_trust negative: ${dueFromTrust}${at}`);

  // No owner overdrawn — a negative owner net is, by definition, spending another
  // owner's money (commingling). Per owner, not aggregate.
  for (const owner of ownersInLog(money)) {
    const net = readOwnerStatement(economy, money, owner).endingCents;
    if (net < 0) v.push(`owner ${owner} overdrawn: ${net}${at}`);
  }

  // No tenant's deposit overdrawn — refunding tenant A out of B's deposit leaves
  // the aggregate whole but B's subledger negative.
  const tenants = [...new Set(money.map((e) => e.tenantId).filter((t): t is string => !!t))];
  for (const tenant of tenants) {
    const held = balanceOf(economy, p, 'security_deposits_held', (x) => x.tenantId === tenant);
    if (held < 0) v.push(`tenant ${tenant} deposit overdrawn: ${held}${at}`);
  }

  return v;
}

export interface FiduciaryOptions extends SoundnessOptions {
  /** Replay the log prefix-by-prefix (causal/append order) and check every
   *  boundary — catches a breach that exists mid-history but is cured by the
   *  end state. O(N²); meant for CI / batch audits and small fixtures, not the
   *  write hot-path. Off by default (the aggregate end-state check is O(N)). */
  temporal?: boolean;
}

/** Fiduciary breaches the self-consistency checker can't see. Aggregate by
 *  default; `temporal: true` adds point-in-time replay. */
export function fiduciaryViolations(doc: unknown, opts: FiduciaryOptions = {}): string[] {
  const c: Chronicle = normalizeChronicle(doc);
  const v = fiduciaryViolationsAt(c.economy, c.money, '');
  if (opts.temporal) {
    // Replay in the log's own (causal) order — never re-sorted, so an event
    // cannot be judged before one that legitimately preceded it.
    for (let i = 1; i <= c.money.length; i++) {
      const at = c.money[i - 1]?.at ?? `#${i}`;
      for (const breach of fiduciaryViolationsAt(c.economy, c.money.slice(0, i), `after ${at}`)) {
        if (!v.includes(breach)) v.push(breach);
      }
    }
  }
  return v;
}

/** Throws with a legible report if any party's subledger is breached. */
export function assertFiduciarySound(doc: unknown, opts: FiduciaryOptions = {}): void {
  const v = fiduciaryViolations(doc, opts);
  if (v.length) {
    throw new Error(`fiduciary breach (${v.length}):\n  - ${v.join('\n  - ')}`);
  }
}
