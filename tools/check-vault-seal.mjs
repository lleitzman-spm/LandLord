/**
 * Is the vault still sealed? — a guard, not a report.
 *
 *   node tools/check-vault-seal.mjs
 *
 * LandLord's tables run RLS with NO policies on purpose: a publishable key
 * opens nothing, and every read the app makes goes through `/api/chronicle`
 * with the secret key. That is the whole security model of the vault.
 *
 * It is now a per-table property rather than a property of the project. a firm's
 * `spm_tracker_state` shares this database and carries four `anon` policies by
 * design (their operator console reads it directly), and a firm's agent tables
 * — `agent_run`, `agent_event`, `watcher_heartbeat` — are landing the same way
 * under the cooperation pact. That is agreed and fine. What must never happen
 * is one of OUR tables quietly gaining a policy: not this week by anyone
 * careless, but in a year, by someone reasonable, with nobody watching.
 *
 * So this asserts the BEHAVIOUR rather than the implementation. It does not
 * count policies — it takes a publishable key, the same class of key any
 * browser could hold, and tries to read each sealed table. Rows coming back is
 * the failure. That catches a bad policy, a disabled RLS flag, and a table
 * exposed through a view alike, none of which a policy count would.
 *
 * Credentials come from the environment and are never committed:
 *   SUPABASE_URL              https://<ref>.supabase.co
 *   SUPABASE_PUBLISHABLE_KEY  a publishable / anon key — NOT the secret key
 * Without them the check SKIPS rather than passing quietly, because a guard
 * that silently no-ops is worse than no guard.
 *
 * Exit 0 = sealed (or skipped), 1 = a table gave up rows.
 */

/** Ours. RLS on, zero policies, and it must stay that way. */
const SEALED = ['chronicle', 'chronicle_history', 'court_roll', 'court_session', 'border_arrivals'];
/**
 * The positive control. It is NOT a readable table: the obvious candidate,
 * a firm's anon-readable `spm_tracker_state`, is currently EMPTY, so it answers
 * `200 []` — character for character what a sealed table answers. A control
 * that cannot be told apart from a failure is not a control.
 *
 * Asking for a table that does not exist separates the two cases cleanly:
 * PostgREST answers 404 only once it has ACCEPTED the key (a bad key is 401
 * before routing). So 404 here proves the endpoint is live and the key is
 * good, without reading a row or writing anything.
 */
const CONTROL_MISSING_TABLE = '__vault_seal_probe_no_such_table__';
/** The vault this check may aim at, named by the OPERATOR, never by this file.
 *  An earlier version pinned a project ref in source; that is exactly the kind
 *  of thing a public repository must not carry, and a working "reach the
 *  private database" command is worse than a leaked string. So the target comes
 *  from the environment and the guard refuses to run without it — the original
 *  lesson (a guard that can be silently aimed elsewhere is not a guard) is kept
 *  by making the aim EXPLICIT rather than compiled in. */
const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!url) {
  console.log('SKIP  vault-seal: set SUPABASE_URL to the project you mean to check.');
  console.log('      This repository names no database. Point it at yours, deliberately.');
  process.exit(0);
}
if (!key) {
  console.log('SKIP  vault-seal: set SUPABASE_PUBLISHABLE_KEY to run.');
  console.log('      (a publishable key, never the secret key — this check proves');
  console.log('       a public key opens nothing, so a secret key would prove nothing.)');
  process.exit(0);
}
if (key.startsWith('sb_secret') || key.startsWith('service_role')) {
  console.error('FAIL  that is a SECRET key. This check is meaningless with one — it must');
  console.error('      run with the key an attacker could plausibly hold.');
  process.exit(1);
}

const get = (table) =>
  fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });

// ── Positive control, before any conclusion is drawn ──────────────────────
const ctl = await get(CONTROL_MISSING_TABLE);
if (ctl.status === 401 || ctl.status === 403) {
  console.error(`INCONCLUSIVE  the key was rejected (HTTP ${ctl.status}).`);
  console.error('      Every "sealed" result below would just be that rejection, so');
  console.error('      NOTHING was verified. This is not a pass.');
  process.exit(1);
}
if (ctl.status !== 404) {
  console.error(`INCONCLUSIVE  control expected HTTP 404 for a nonexistent table, got ${ctl.status}.`);
  console.error('      The endpoint is not behaving like the PostgREST we think it is;');
  console.error('      no conclusion can be drawn about the vault.');
  process.exit(1);
}
console.log('  ctl   key accepted, routing live (404 on a nonexistent table) — probe works\n');

/**
 * The stronger check, when a secret key is present: prove each sealed table
 * actually HOLDS rows. Without this, "the publishable key returned nothing"
 * could equally mean the table is simply empty — which is exactly the trap
 * `spm_tracker_state` fell into above. An empty table proves nothing.
 */
const secret = process.env.SUPABASE_SECRET_KEY || '';
const rowsWithSecret = {};
if (secret) {
  for (const table of SEALED) {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: secret, authorization: `Bearer ${secret}` },
    });
    try {
      const p = JSON.parse(await r.text());
      rowsWithSecret[table] = Array.isArray(p) ? p.length : null;
    } catch { rowsWithSecret[table] = null; }
  }
} else {
  console.log('  note  no SUPABASE_SECRET_KEY: cannot prove the sealed tables hold data,');
  console.log('        so an empty table would read as sealed. Set it for the full check.\n');
}

let bad = 0;
for (const table of SEALED) {
  const res = await get(table);
  let rows = null;
  let body = '';
  try {
    body = await res.text();
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) rows = parsed.length;
  } catch {
    /* a non-JSON body */
  }

  if (res.status === 404) {
    // The table is MISSING, not sealed. Silence is not safety: this is how the
    // first version passed against a project that had none of our tables.
    console.error(`  FAIL  ${table.padEnd(18)} HTTP 404 — table absent. Sealed and absent`);
    console.error('        are not the same answer, and this check will not conflate them.');
    bad++;
  } else if (rows === null) {
    // denied outright — 401/403 or an error object: RLS doing its job
    console.log(`  ok    ${table.padEnd(18)} refused (HTTP ${res.status})`);
  } else if (rows === 0) {
    // 200 with an empty set: RLS is on and no policy grants a row — but only
    // meaningful if the table has something to withhold.
    const held = rowsWithSecret[table];
    if (secret && held === 0) {
      console.error(`  FAIL  ${table.padEnd(18)} yields nothing — but it is EMPTY, so that`);
      console.error('        proves nothing about RLS. Seal unverified for this table.');
      bad++;
    } else if (secret && held === null) {
      console.error(`  FAIL  ${table.padEnd(18)} secret key could not read it either — the`);
      console.error('        check cannot tell a seal from an outage.');
      bad++;
    } else {
      const proof = secret ? ' (and it does hold data)' : '';
      console.log(`  ok    ${table.padEnd(18)} withheld everything${proof}`);
    }
  } else {
    console.error(`  FAIL  ${table.padEnd(18)} RETURNED ${rows} ROW(S) to a publishable key`);
    console.error(`        ${body.slice(0, 160)}`);
    bad++;
  }
}

if (bad) {
  console.error('');
  console.error(`VAULT UNSEALED — ${bad} of ${SEALED.length} table(s) gave data to a public key.`);
  console.error('Something granted a policy, disabled RLS, or exposed a view. Find it before');
  console.error('anything else: every one of these tables holds a real identity\'s records.');
  process.exit(1);
}

console.log(`\nSEALED — all ${SEALED.length} LandLord tables opened nothing to a publishable key.`);
