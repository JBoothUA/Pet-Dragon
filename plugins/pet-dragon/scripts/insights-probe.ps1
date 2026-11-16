param([string]$AppId, [int]$Minutes = 15)
# Counts exceptions and failed requests in an Application Insights app over the last N minutes (needs az, logged in).
# One JSON object on stdout: { ex, fr } or { error }.
$ErrorActionPreference = 'Stop'
try {
  $q = "print ex=toscalar(exceptions | where timestamp > ago(${Minutes}m) | count), fr=toscalar(requests | where timestamp > ago(${Minutes}m) and success == false | count)"
  $raw = az monitor app-insights query --app $AppId --analytics-query $q -o json 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($raw | Out-String).Trim() }
  $row = ($raw | Out-String | ConvertFrom-Json).tables[0].rows[0]
  @{ ex = $row[0]; fr = $row[1] } | ConvertTo-Json -Compress
} catch {
  @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
}
