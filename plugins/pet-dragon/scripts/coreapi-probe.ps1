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
  sqlService = $null; dockerSql = $null; repoRoot = $null; exePath = $null; startTime = $null
}

function Get-DataSource([string]$json) {
  if (-not $json) { return $null }
  $m = [regex]::Match($json, '"Facility"\s*:\s*"[^"]*?Data Source=([^;"]+)', 'IgnoreCase')
  if (-not $m.Success) { $m = [regex]::Match($json, 'Data Source=([^;"]+)', 'IgnoreCase') }
  if ($m.Success) { return $m.Groups[1].Value.Trim() }
  return $null
}

# The session may start in a subfolder (e.g. phoenix-ui), so walk up to the folder that holds core-api\CoreAPI
function Find-RepoRoot([string]$start) {
  $d = $start
  while ($d -and -not (Test-Path (Join-Path $d 'core-api\CoreAPI'))) { $d = Split-Path $d -Parent }
  return $d
}
$RepoRoot = Find-RepoRoot $RepoRoot
if (-not $RepoRoot) {
  # Session folder is outside the repo: use where the running CoreAPI's exe lives (bin\Debug\... under the repo)
  $l = Get-NetTCPConnection -LocalPort $Port -State Listen | Select-Object -First 1
  if ($l) {
    $exe = (Get-Process -Id $l.OwningProcess).Path
    if ($exe) { $RepoRoot = Find-RepoRoot (Split-Path $exe -Parent) }
  }
}
$result.repoRoot = $RepoRoot

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
  $proc = Get-Process -Id $listen.OwningProcess
  $result.process = $proc.ProcessName
  $result.exePath = $proc.Path
  $result.startTime = if ($proc.StartTime) { $proc.StartTime.ToString('HH:mm:ss') } else { $null }

  $dockerUp0 = [bool]$result.dockerSql -and $result.dockerSql -ne 'daemon-off'
  # Ground truth for the local server: does it hold a session from this very process? Shared memory ("lpc:.", what
  # use-local-db.ps1 sets) leaves no TCP trace, and the config files cannot see the env vars the process was started with.
  if ($result.sqlService -eq 'Running') {
    try {
      $cn = New-Object System.Data.SqlClient.SqlConnection 'Data Source=lpc:.;Initial Catalog=master;Integrated Security=True;TrustServerCertificate=True;Connect Timeout=3'
      $cn.Open()
      $cmd = $cn.CreateCommand()
      $cmd.CommandText = "select count(*) from sys.dm_exec_sessions where host_process_id = $($listen.OwningProcess) and program_name like '%SqlClient%'"
      $n = [int]$cmd.ExecuteScalar()
      $cn.Dispose()
      if ($n -gt 0) { $result.db = 'local'; $result.dbEvidence += "$n session(s) from this process on the local SQL Server" }
    } catch { }
  }

  # Which process owns the SQL listener on 1433: sqlservr = local install, docker/wsl relay = container
  # Docker Desktop shows as two listeners (wslrelay + com.docker.backend), so look at every owner, not the first
  $sqlOwner = $null
  $owners = @(Get-NetTCPConnection -LocalPort 1433 -State Listen | ForEach-Object { (Get-Process -Id $_.OwningProcess).ProcessName } | Select-Object -Unique)
  if ($owners -contains 'sqlservr') { $sqlOwner = 'sqlservr' }
  elseif ($owners.Count -gt 0) { $sqlOwner = $owners -join ',' }

  $conns = @(Get-NetTCPConnection -OwningProcess $listen.OwningProcess -State Established | Where-Object RemotePort -eq 1433)
  if ($result.db -eq 'unknown' -and $conns.Count -gt 0) {
    $result.dbEvidence += "CoreAPI has $($conns.Count) TCP connection(s) to :1433"
    if ($sqlOwner -match '^sqlservr$') { $result.db = 'local'; $result.dbEvidence += 'port 1433 is owned by sqlservr' }
    elseif ($sqlOwner -match 'docker|wslrelay|vpnkit') { $result.db = 'docker'; $result.dbEvidence += "port 1433 is owned by $sqlOwner" }
    elseif ("$($conns[0].RemoteAddress)" -notmatch '^(127\.|::1|0\.0\.0\.0)') { $result.db = 'remote'; $result.dbEvidence += "remote $($conns[0].RemoteAddress)" }
  }

  # No connection yet: trust the marker Dragon wrote when it last switched databases, if it was for this very process
  if ($result.db -eq 'unknown') {
    $mf = Join-Path $env:LOCALAPPDATA 'pet-dragon\core-db.json'
    if (Test-Path $mf) {
      $m = Get-Content $mf -Raw | ConvertFrom-Json
      if ($m -and [int]$m.pid -eq [int]$listen.OwningProcess -and ($m.target -eq 'local' -or $m.target -eq 'docker')) {
        $result.db = $m.target
        $result.dbEvidence += "started by use-$($m.target)-db.ps1 at $($m.at); no connection yet to confirm"
      }
    }
  }

  # An explicit port (".,1433") means TCP even to this machine, so the listener's owner is the answer with no open connection
  if ($result.db -eq 'unknown' -and $sqlOwner -and "$($result.dataSource)" -match ',1433$' -and -not ($result.sqlService -eq 'Running' -and $dockerUp0)) {
    if ($sqlOwner -match '^sqlservr$') { $result.db = 'local'; $result.dbEvidence += 'port 1433 is owned by sqlservr' }
    elseif ($sqlOwner -match 'docker|wslrelay|vpnkit') { $result.db = 'docker'; $result.dbEvidence += "port 1433 is owned by $sqlOwner" }
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
      $result.dbEvidence += $(if ($result.sqlService -eq 'Running' -and $dockerUp0) { 'local SQL and Docker SQL are both up and CoreAPI has no connection yet; cannot tell' } else { 'no TCP evidence; could not tell' })
    }
  }
}

$result | ConvertTo-Json -Compress
