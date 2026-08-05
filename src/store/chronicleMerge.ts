// Conflict recovery for the whole-document write. When a writer's PUT is
// rejected because the vault moved under it (a concurrent writer got there
// first), the two documents are merged rather than one clobbering the other —
// so no record APPENDED by either side is ever lost (the R2 hazard).
//
// The doctrine is "records in, readings out": every book here is a set of
// records, and the append-only streams (events, money) are the fiduciary spine.
//
// The merge is a 3-way reconcile against the common BASE (the last vault state
// both sides descend from). Knowing the base is what lets it tell a real
// deletion from a never-had: a record present in base but gone from one side
// was STRUCK there (a revocation — "removal of a record IS revocation"), so the
// union must NOT resurrect it from the other side. Appends (present on a side,
// absent from base) always survive. When the base is unknown, it falls back to
// the old additive union — safe on appends, but it cannot honor a deletion.
import type { Chronicle } from '../domain/chronicle';

/** Union two arrays of records by `id`, remote first, then the local records
 *  the remote does not already carry — so neither side's appends are lost. The
 *  base-blind fallback: additive, never drops, but cannot honor a strike. */
export function unionById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const seen = new Set(remote.map((x) => x.id));
  return [...remote, ...local.filter((x) => !seen.has(x.id))];
}

/** 3-way reconcile of an id-keyed book against the common `base`.
 *  - present on both sides            → kept (the local session's version wins)
 *  - absent from a side, present in base → that side STRUCK it → dropped
 *  - absent from a side, absent in base  → the other side APPENDED it → kept
 *  So a strike survives the merge (S2) and no append is ever lost (R2). */
export function reconcileById<T extends { id: string }>(local: T[], remote: T[], base: T[]): T[] {
  const baseIds = new Set(base.map((x) => x.id));
  const remoteIds = new Set(remote.map((x) => x.id));
  const localById = new Map(local.map((x) => [x.id, x]));
  const out: T[] = [];
  for (const r of remote) {
    if (localById.has(r.id)) out.push(localById.get(r.id)!); // both have it → local's version
    else if (!baseIds.has(r.id)) out.push(r); // remote appended it → keep
    // else: it was in base and local dropped it → local struck it → omit
  }
  for (const l of local) {
    if (remoteIds.has(l.id)) continue; // already emitted above
    if (baseIds.has(l.id)) continue; // it was in base and remote dropped it → remote struck it → omit
    out.push(l); // local appended it → keep
  }
  return out;
}

/** Keyed, non-id books (catalog / flows / economy / the war banner): the side
 *  that CHANGED the field from base wins — so a muster deployed or reset in one
 *  session isn't clobbered by the other's stale copy (S1). If only one side
 *  moved, take that side; if neither or both moved, the writing session wins. */
function pick3<T>(base: T, local: T, remote: T): T {
  return JSON.stringify(local) === JSON.stringify(base) ? remote : local;
}

/** Merge the local document with the remote it conflicted against, 3-way against
 *  the common `base` when known (honors strikes + keeps non-log state coherent),
 *  else additive-union (safe on appends, base-blind). */
export function mergeOnConflict(local: Chronicle, remote: Chronicle, base?: Chronicle): Chronicle {
  const merge = <T extends { id: string }>(l: T[], r: T[], b: T[] | undefined): T[] =>
    b ? reconcileById(l, r, b) : unionById(r, l);
  // Whether a common base is KNOWN is a fact about the merge, not about any one
  // field — and it must be asked once, here. It used to be inferred per field
  // from `b === undefined`, which works for every book that always exists and
  // is silently wrong for the one that does not: `economySetting` is optional,
  // so `base?.economySetting` is `undefined` both when the base is unknown AND
  // in the ordinary case where the base simply carried no setting. The sentinel
  // could not tell those apart, took the local branch, and returned `undefined`
  // — so a session whose base predated an attended load would ERASE that load
  // from the vault on its next conflicting write, while the loading session's
  // UI still said a setting stood. Real figures, silently reverted to founding.
  // (The same field was once missing from this merge entirely; it was added
  // with a guard that could not fire. Found by an adversarial audit, 2026-07-27.)
  const hasBase = base !== undefined;
  const keyed = <T>(l: T, r: T, b: T | undefined): T => (hasBase ? pick3(b as T, l, r) : l);
  return {
    // The append-only streams — the fiduciary spine. Appends never lost; a strike
    // (e.g. Reset removing a game's wg-marked events) is honored, not resurrected.
    events: merge(local.events, remote.events, base?.events),
    money: merge(local.money, remote.money, base?.money),
    // The record books — a grant/appointment/arrival appended on either side
    // survives; a revoked one struck on either side stays struck.
    marches: {
      arrivals: merge(local.marches.arrivals, remote.marches.arrivals, base?.marches.arrivals),
      dispatches: merge(local.marches.dispatches, remote.marches.dispatches, base?.marches.dispatches),
      turnaways: merge(local.marches.turnaways, remote.marches.turnaways, base?.marches.turnaways),
    },
    treasury: { upkeeps: merge(local.treasury.upkeeps, remote.treasury.upkeeps, base?.treasury.upkeeps) },
    acts: {
      grants: merge(local.acts.grants, remote.acts.grants, base?.acts.grants),
      appointments: merge(local.acts.appointments, remote.acts.appointments, base?.acts.appointments),
      postings: merge(local.acts.postings, remote.acts.postings, base?.acts.postings),
      fealties: merge(local.acts.fealties, remote.acts.fealties, base?.acts.fealties),
    },
    census: {
      people: merge(local.census.people, remote.census.people, base?.census.people),
      territories: merge(local.census.territories, remote.census.territories, base?.census.territories),
    },
    // Keyed loadable books + the war banner — the side that moved them from base
    // wins, so a deploy/reset in one session stays coherent with the events that
    // reference it (no orphaned boards). The estate roster + the economy setting
    // overlay are loadable the same way — the side that loaded one keeps it (an
    // attended load in one session isn't clobbered by the other's stale copy).
    catalog: keyed(local.catalog, remote.catalog, base?.catalog),
    flows: keyed(local.flows, remote.flows, base?.flows),
    economy: keyed(local.economy, remote.economy, base?.economy),
    estates: keyed(local.estates, remote.estates, base?.estates),
    economySetting: keyed(local.economySetting, remote.economySetting, base?.economySetting),
    wargame: keyed(local.wargame, remote.wargame, base?.wargame),
  };
}
