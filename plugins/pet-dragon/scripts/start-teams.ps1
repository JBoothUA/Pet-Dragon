# Starts Microsoft Teams: the new app by its msteams: protocol, else the classic install. Prints what it started.
$ErrorActionPreference = 'SilentlyContinue'
if (Get-Process ms-teams, Teams) { 'already running'; exit 0 }
Start-Process 'msteams:'
Start-Sleep -Seconds 2
if (Get-Process ms-teams) { 'started new Teams'; exit 0 }
$classic = Join-Path $env:LOCALAPPDATA 'Microsoft\Teams\Update.exe'
if (Test-Path $classic) { Start-Process $classic -ArgumentList '--processStart', 'Teams.exe'; 'started classic Teams'; exit 0 }
'could not find Teams'
exit 1
