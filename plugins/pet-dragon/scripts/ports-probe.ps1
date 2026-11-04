param([string]$Ports = '7102,7201')
# For each port: is something listening on it, and which process. One JSON object on stdout, keyed by port.
$ErrorActionPreference = 'SilentlyContinue'
$result = [ordered]@{}
foreach ($port in ($Ports -split ',' | Where-Object { $_ })) {
  $entry = [ordered]@{ up = $false; pid = $null; process = $null }
  $listen = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen | Select-Object -First 1
  if ($listen) {
    $entry.up = $true
    $entry.pid = $listen.OwningProcess
    $entry.process = (Get-Process -Id $listen.OwningProcess).ProcessName
  }
  $result["$port"] = $entry
}
$result | ConvertTo-Json -Compress
