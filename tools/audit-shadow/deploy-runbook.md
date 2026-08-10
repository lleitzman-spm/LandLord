# Bounded activation proof

This lane proves only that reviewed, names-free bytes can reach a new isolated
Cloudflare Worker and that one opaque value can make a reversible round trip in
a new temporary KV namespace. It does not prove an Operating Instrument, touch
the vault, use an identity, load an operating graph, or apply an act.

## Fixed resources

- Worker: `landlord-audit-shadow-20260809-v1`
- Reachability: its account `workers.dev` address only
- Routes and custom domains: none
- Version preview URLs: disabled
- Worker bindings, variables, assets, and secrets: none
- Temporary KV namespace: `audit-shadow-kv-20260809-a9f3c7d2`
- Temporary KV key/value: `proof/a9f3c7d2` / `ok-a9f3c7d2`

The KV namespace is not bound to the Worker or to any existing resource. The
proof script refuses to reuse a namespace with the fixed name, then deletes the
key and namespace in `finally`.

## Local proof before any Cloudflare mutation

Run from the repository root:

```powershell
node tools/audit-shadow/deploy-check.mjs
npm.cmd test -- --run test/audit-shadow-worker.test.ts
$out = Join-Path ([System.IO.Path]::GetTempPath()) 'landlord-audit-shadow-dry-run'
npx.cmd --yes wrangler@4.97.0 deploy --config wrangler.audit-shadow.jsonc --dry-run --outdir $out
```

Inspect the dry-run binding summary. It must list no bindings. Do not deploy if
Wrangler reports a route, custom domain, asset, variable, secret, KV namespace,
database, queue, service, AI binding, or another resource.

## Preflight: the Worker name must be new

```powershell
npx.cmd --yes wrangler@4.97.0 deployments list --name landlord-audit-shadow-20260809-v1 --json
```

The expected result is Cloudflare's script-not-found response. Any returned
deployment means the name is already in use: stop. An authentication, account,
or network error is not evidence that the name is free.

## Deploy and verify

```powershell
npx.cmd --yes wrangler@4.97.0 deploy --config wrangler.audit-shadow.jsonc --message "Bounded static audit proof v1"
node tools/audit-shadow/deploy-verify.mjs https://landlord-audit-shadow-20260809-v1.<ACCOUNT_SUBDOMAIN>.workers.dev
npx.cmd --yes wrangler@4.97.0 secret list --name landlord-audit-shadow-20260809-v1 --format json
```

Record the exact URL printed by `deploy`; substitute its account subdomain in
the verification command. The secret list must be `[]`. The verifier proves the
static response, `applied: false`, and refusal of `POST /proof`.

## One bounded reversible external-state act

Only after the static proof passes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/audit-shadow/deploy-kv-proof.ps1
```

The script creates the new namespace, writes one opaque value, reads it back,
deletes the key, and deletes the namespace even when the middle of the proof
fails. If creation succeeds but no namespace id can be parsed, it stops and
prints the exact namespace name for manual cleanup.

## Roll back the Worker

```powershell
npx.cmd --yes wrangler@4.97.0 delete --name landlord-audit-shadow-20260809-v1 --config wrangler.audit-shadow.jsonc
npx.cmd --yes wrangler@4.97.0 deployments list --name landlord-audit-shadow-20260809-v1 --json
```

Confirm deletion when Wrangler asks. The second command must return the same
script-not-found result as the preflight; an auth or network error is not proof
of deletion. Also confirm that the temporary KV namespace name is absent from:

```powershell
npx.cmd --yes wrangler@4.97.0 kv namespace list --config wrangler.audit-shadow.jsonc
```

## Residual risk

- The Worker is intentionally public during the proof window. Its static bytes
  are non-sensitive, but the worker name and account `workers.dev` subdomain are
  externally observable and may persist in third-party DNS or HTTP records.
- Requests and the KV operations can incur Cloudflare usage. Keep the window
  short and remove both resources when the receipt is captured.
- KV is eventually consistent. A just-deleted key can briefly be observed from
  a distant cache; deleting the entire isolated namespace is the final cleanup.
- A crash after namespace creation but before the script reads its generated id
  can leave the fixed namespace behind. The script names it explicitly and will
  refuse to reuse it; remove it manually before any retry.
- `wrangler delete` is irreversible for that isolated Worker. The fixed-name
  preflight is what keeps the target from overlapping an existing service.
