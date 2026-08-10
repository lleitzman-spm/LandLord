[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workerConfig = Join-Path $PSScriptRoot '..\..\wrangler.audit-shadow.jsonc'
$namespaceName = 'audit-shadow-kv-20260809-a9f3c7d2'
$key = 'proof/a9f3c7d2'
$value = 'ok-a9f3c7d2'
$namespaceId = $null

function Invoke-Wrangler {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $output = & npx.cmd --yes wrangler@4.97.0 @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler failed ($LASTEXITCODE):`n$($output -join "`n")"
  }
  return $output
}

# A fixed opaque name makes cleanup auditable. Refuse a pre-existing namespace:
# it was not created by this invocation and therefore is not ours to delete.
$existing = Invoke-Wrangler kv namespace list --config $workerConfig
if (($existing -join "`n") -match [regex]::Escape($namespaceName)) {
  throw "Refusing to reuse existing namespace: $namespaceName"
}

try {
  $created = Invoke-Wrangler kv namespace create $namespaceName --config $workerConfig --experimental-provision=false --experimental-auto-create=false
  $match = [regex]::Match(($created -join "`n"), '(?i)\b[0-9a-f]{32}\b')
  if (-not $match.Success) {
    throw "Namespace was created but its id could not be read. Inspect Cloudflare and delete '$namespaceName' manually.`n$($created -join "`n")"
  }
  $namespaceId = $match.Value

  Invoke-Wrangler kv key put $key $value --namespace-id $namespaceId --remote --config $workerConfig | Out-Null
  $read = Invoke-Wrangler kv key get $key --namespace-id $namespaceId --remote --text --config $workerConfig
  if (($read -join "`n").Trim() -ne $value) {
    throw 'Remote KV read did not return the exact opaque proof value.'
  }

  Invoke-Wrangler kv key delete $key --namespace-id $namespaceId --remote --config $workerConfig --force | Out-Null
  Write-Output (ConvertTo-Json -Compress @{
    ok = $true
    requestedNamespaceName = $namespaceName
    namespaceId = $namespaceId
    key = $key
    wrote = $true
    read = $true
    deletedKey = $true
  })
}
finally {
  if ($namespaceId) {
    Invoke-Wrangler kv namespace delete --namespace-id $namespaceId --skip-confirmation --config $workerConfig | Out-Null
    Write-Output (ConvertTo-Json -Compress @{
      cleanup = $true
      requestedNamespaceName = $namespaceName
      deletedNamespaceId = $namespaceId
    })
  }
}
