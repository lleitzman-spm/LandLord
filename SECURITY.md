# Security

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** on this repository
rather than opening a public issue.

**Do not include a live credential in a report.** If you found one, say where it
is and what kind it is — not what it is.

## If a secret was ever committed

Removing a secret from the working tree does not remove it from a public git
history, and it does not remove it from the clones, forks, caches and mirrors
that already have it. A secret that has been pushed to a public repository must
be treated as compromised.

The order is:

1. **Rotate it at the source** — revoke the old value and issue a new one.
2. Remove it from the tree and from the history if you are rewriting anyway.
3. Work out how it got in, and whether `tools/leakcheck.mjs` should have caught
   it. If it should have and did not, that is a bug in the scanner worth fixing.

Rotating first matters more than cleaning first. A cleaned history with a live
key in it is worse than a dirty history with a dead one.

## What this repository is, security-wise

LandLord ships **no deployment and no credentials**. `wrangler.jsonc` is a
disarmed template with no route and no identifiers; `.env.example` contains only
placeholders; there is no database, no account and no key in the tree, and the
application runs fully without any of them.

Two things are worth knowing if you deploy it:

- **The vault expects row security enabled with no policies.** Publishable and
  anon keys then open nothing at all, and only the secret key passes. The secret
  key must never reach the browser — only the dev server and the deployed Worker
  read it. `tools/check-vault-seal.mjs` proves the seal from the outside, aimed
  at whatever `SUPABASE_URL` you give it. It names no project of its own.
- **If you put an identity wall in front of a deployment, the Worker verifies
  its assertions** rather than trusting a header, and refuses its private APIs
  when the wall is not configured. Stand the wall up *before* the route exists,
  and verify from a logged-out browser that the wall answers, not the app.

## Automated checks

`tools/leakcheck.mjs` runs as the first CI job on every push and pull request,
before dependencies are installed, so it still answers when the tree does not
build. It matches *shapes* — addresses outside reserved documentation domains,
ingest keys, database hosts, key prefixes, JWTs, private-key blocks, telephone
numbers outside the fiction-reserved range — and holds no list of real values,
because such a list would itself be the leak.

It cannot review images or binaries, and it says so. A picture can carry a place
name in its pixels and an elevation file can carry coordinates in its header.
Those get human eyes.
