param(
  [int]$Port = 5236,
  [string]$RepoRoot = ''
)
# Reports whether local CoreAPI is listening and which SQL Server it most likely talks to.
# Output: one JSON object on stdout. Best-effort; every check is wrapped so the probe never throws.
$ErrorActionPreference = 'SilentlyContinue'
$result = [ordered]@{
  up = $false; pid = $null; process = $null
  db = 'unknown'; dbEvidence = @(); dataSource = $null; dataSourceFrom = $null
  sqlService = $null; dockerSql = $null
}

function Get-DataSource([string]$json) {
  if (-not $json) { return $null }
  $m = [regex]::Match($json, '"Facility"\s*:\s*"[^"]*?Data Source=([^;"]+)', 'IgnoreCase')
  if (-not $m.Success) { $m = [regex]::Match($json, 'Data Source=([^;"]+)', 'IgnoreCase') }
  if ($m.Success) { return $m.Groups[1].Value.Trim() }
  return $null
}

# Config precedence (lowest -> highest): appsettings.json, appsettings.Development.json, user secrets, env var
if ($RepoRoot) {
  $apiDir = Join-Path $RepoRoot 'core-api\CoreAPI'
  foreach ($f in 'appsettings.json', 'appsettings.Development.json') {
    $ds = Get-DataSource (Get-Content (Join-Path $apiDir $f) -Raw)
    if ($ds) { $result.dataSource = $ds; $result.dataSourceFrom = $f }
  }
  $csproj = Get-Content (Get-ChildItem $apiDir -Filter *.csproj | Select-Object -First 1).FullName -Raw
  $sid = [regex]::Match("$csproj", '<UserSecretsId>([^<]+)</UserSecretsId>').Groups[1].Value
  if ($sid) {
    $ds = Get-DataSource (Get-Content (Join-Path $env:APPDATA "Microsoft\UserSecrets\$sid\secrets.json") -Raw)
    if ($ds) { $result.dataSource = $ds; $result.dataSourceFrom = 'user secrets' }
  }
}
if ($env:ConnectionStrings__Facility) {
  $ds = Get-DataSource $env:ConnectionStrings__Facility
  if ($ds) { $result.dataSource = $ds; $result.dataSourceFrom = 'env var' }
}

$svc = Get-Service MSSQLSERVER
if ($svc) { $result.sqlService = "$($svc.Status)" }

if (Get-Command docker) {
  $names = & docker ps --filter 'publish=1433' --format '{{.Names}}' 2>$null
  if ($LASTEXITCODE -eq 0) { $result.dockerSql = (@($names) -join ',') } else { $result.dockerSql = 'daemon-off' }
}

$listen = Get-NetTCPConnection -LocalPort $Port -State Listen | Select-Object -First 1
if ($listen) {
  $result.up = $true
  $result.pid = $listen.OwningProcess
  $result.process = (Get-Process -Id $listen.OwningProcess).ProcessName

  # Which process owns the SQL listener on 1433: sqlservr = local install, docker/wsl relay = container
  $sqlOwner = $null
  $sqlListen = Get-NetTCPConnection -LocalPort 1433 -State Listen | Select-Object -First 1
  if ($sqlListen) { $sqlOwner = (Get-Process -Id $sqlListen.OwningProcess).ProcessName }

  $conns = @(Get-NetTCPConnection -OwningProcess $listen.OwningProcess -State Established | Where-Object RemotePort -eq 1433)
  if ($conns.Count -gt 0) {
    $result.dbEvidence += "CoreAPI has $($conns.Count) TCP connection(s) to :1433"
    if ($sqlOwner -match '^sqlservr$') { $result.db = 'local'; $result.dbEvidence += 'port 1433 is owned by sqlservr' }
    elseif ($sqlOwner -match 'docker|wslrelay|vpnkit') { $result.db = 'docker'; $result.dbEvidence += "port 1433 is owned by $sqlOwner" }
    elseif ("$($conns[0].RemoteAddress)" -notmatch '^(127\.|::1|0\.0\.0\.0)') { $result.db = 'remote'; $result.dbEvidence += "remote $($conns[0].RemoteAddress)" }
  }

  if ($result.db -eq 'unknown') {
    # 'Data Source=.' uses shared memory, which leaves no TCP trace: infer from config + what is running
    $ds = "$($result.dataSource)"
    $isLocalName = ($ds -match '^(\.|\(local\)|localhost|127\.0\.0\.1)(,1433)?$') -or ($ds -ieq $env:COMPUTERNAME)
    $dockerUp = $result.dockerSql -and $result.dockerSql -ne 'daemon-off'
    if (($ds -match '^(\.|\(local\))$') -and $result.sqlService -eq 'Running') {
      $result.db = 'local'; $result.dbEvidence += "Data Source=$ds (shared memory) and MSSQLSERVER is running"
    } elseif ($isLocalName -and $result.sqlService -eq 'Running' -and -not $dockerUp) {
      $result.db = 'local'; $result.dbEvidence += "Data Source=$ds, MSSQLSERVER is running and no SQL container is up"
    } elseif ($isLocalName -and $dockerUp -and $result.sqlService -ne 'Running') {
      $result.db = 'docker'; $result.dbEvidence += "Data Source=$ds and container $($result.dockerSql) publishes 1433"
    } elseif ($ds -and -not $isLocalName) {
      $result.db = 'remote'; $result.dbEvidence += "Data Source=$ds"
    } else {
      $result.dbEvidence += 'no TCP evidence; could not tell'
    }
  }
}

$result | ConvertTo-Json -Compress
