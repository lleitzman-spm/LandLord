# Attention shadow lane

This lane proves the Attention Ledger without touching an operating writer. It
accepts only the `synthetic-demo-only` input schema, rejects identity-bearing
fields, imports the same pure fold exposed to operators, and writes reports only
beneath the operating-system temp directory.

Build and run the names-free shadow from a clean commit:

```powershell
npm.cmd run build:operator
$taskSha = (git rev-parse HEAD).Trim()
$shadowLine = node tools/audit-shadow/run-audit-shadow.mjs --shadow --commit $taskSha
$shadow = $shadowLine | ConvertFrom-Json
```

The proof is `applied: false`. To exercise the one bounded act and its reversal
against an in-memory copy of the bundled demo fixture:

```powershell
node tools/audit-shadow/run-audit-shadow.mjs --act --proof $shadow.report --commit $taskSha
```

That receipt remains `applied: false` and `simulated: true`: it records an
in-memory demo transition and inverse event, proves the original reading was
restored, and reports `externalEffects: false`. It has no network client,
credential input, or route to the vault.

The shadow refuses unless every gate passes: synthetic input, names-free shape,
valid append-only records, complete classification, evidence, confidence, and
at least one reversible, exception-free machine candidate. The act separately
requires the exact clean commit, input digest, proof digest, and successful gate
set.

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | Proof or bounded demo act completed |
| 2 | Invalid argument, schema, record, or runtime input |
| 3 | Identity-bearing or client-shaped input refused |
| 4 | Output boundary refused |
| 5 | A shadow evidence gate did not pass |
| 6 | Commit or proof is missing, stale, mismatched, or tampered |
| 7 | No proved bounded act remains admissible, or reversal failed |
