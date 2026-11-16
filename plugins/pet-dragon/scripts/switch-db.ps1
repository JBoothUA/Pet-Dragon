param([ValidateSet('docker', 'local')][string]$Target, [string]$Dir = '', [int]$Port = 5236)
# Runs the use-<target>-db.ps1 script (default: on your Desktop). That script stops CoreAPI, points its connection
# strings at the chosen database and restarts it. One JSON object on stdout: { ok, script, tail } or { ok:false, error }.
$ErrorActionPreference = 'Stop'
try {
  if (-not $Dir) { $Dir = [Environment]::GetFolderPath('Desktop') }
  $file = Join-Path $Dir "use-$Target-db.ps1"
  if (-not (Test-Path $file)) { throw "Script not found: $file" }
  $log = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $file 2>&1 | Out-String
  $up = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  $tail = (($log -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 3) -join ' | ')
  @{ ok = $up; script = $file; tail = $tail } | ConvertTo-Json -Compress
} catch {
  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
}
