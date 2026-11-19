# Application Insights health for several MoveDocs environments, as one JSON object keyed by environment.
# Usage: ai-probe.ps1 -Apps "prod=<AppId>;qa=<AppId>"
# Uses the signed-in `az` account for a token (never logs in itself). Each environment reports
#   health:   last 15 minutes of requests against the previous 24 hours (volume, failures, p95)
#   top:      the endpoints failing most right now (only when something is failing)
#   hangfire: Hangfire-related errors in the last 6 hours
param([string]$Apps)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
  $token = (az account get-access-token --resource https://api.applicationinsights.io --query accessToken -o tsv 2>$null)
  if (-not $token) { throw 'no token' }
} catch {
  @{ _error = 'az is not signed in (run: az login)' } | ConvertTo-Json -Compress
  exit 0
}

$headers = @{ Authorization = "Bearer $token" }

function Invoke-Kql($appId, $kql) {
  $body = @{ query = $kql } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "https://api.applicationinsights.io/v1/apps/$appId/query" -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 25
  $t = $r.tables[0]
  $names = @($t.columns | ForEach-Object { $_.name })
  foreach ($row in $t.rows) {
    $o = [ordered]@{}
    for ($i = 0; $i -lt $names.Count; $i++) { $o[$names[$i]] = $row[$i] }
    [pscustomobject]$o
  }
}

$healthKql = @'
requests
| where timestamp > ago(24h)
| extend cur = timestamp > ago(15m)
| summarize n = countif(cur), f = countif(cur and success == false), p95 = percentile(iif(cur, duration, real(null)), 95),
            bn = countif(not(cur)), bf = countif(not(cur) and success == false), bp95 = percentile(iif(not(cur), duration, real(null)), 95)
'@
$topKql = @'
requests
| where timestamp > ago(15m) and success == false
| summarize c = count() by name
| top 3 by c desc
'@
$hangfireKql = @'
union traces, exceptions
| where timestamp > ago(6h)
| where (itemType == 'trace' and severityLevel >= 3 and (message has 'Hangfire' or tostring(customDimensions.SourceContext) has 'Hangfire'))
     or (itemType == 'exception' and (outerMessage has 'Hangfire' or tostring(details) has 'Hangfire' or operation_Name has 'Hangfire'))
| summarize c = count(), lastAt = max(timestamp), msg = any(coalesce(message, outerMessage))
'@

$depsKql = @'
dependencies
| where timestamp > ago(24h)
| extend cur = timestamp > ago(15m)
| summarize n = countif(cur), f = countif(cur and success == false), bn = countif(not(cur)), bf = countif(not(cur) and success == false) by target, type
| where f > 0
| top 5 by f desc
'@

$out = [ordered]@{}
foreach ($pair in ($Apps -split ';')) {
  $name, $id = $pair -split '=', 2
  if (-not $id) { continue }
  try {
    $h = Invoke-Kql $id $healthKql | Select-Object -First 1
    $top = @()
    if ($h -and $h.f -gt 0) { $top = @(Invoke-Kql $id $topKql | ForEach-Object { @{ name = $_.name; count = $_.c } }) }
    $hf = Invoke-Kql $id $hangfireKql | Select-Object -First 1
    $deps = @(Invoke-Kql $id $depsKql | ForEach-Object { @{ target = $_.target; type = $_.type; n = [int]$_.n; f = [int]$_.f; bn = [int]$_.bn; bf = [int]$_.bf } })
    $out[$name] = @{
      n = [int]$h.n; f = [int]$h.f; p95 = $h.p95; bn = [int]$h.bn; bf = [int]$h.bf; bp95 = $h.bp95
      top = $top
      deps = $deps
      hangfire = @{ count = [int]$hf.c; last = $hf.lastAt; msg = $hf.msg }
    }
  } catch {
    $out[$name] = @{ error = ([string]$_.Exception.Message).Substring(0, [Math]::Min(120, ([string]$_.Exception.Message).Length)) }
  }
}
$out | ConvertTo-Json -Compress -Depth 6
