param([Parameter(Mandatory)][string]$Url)
# Opens a URL in Chrome; falls back to the default browser when Chrome is not found.
$ErrorActionPreference = 'SilentlyContinue'
$chrome = (Get-Command chrome.exe).Source
if (-not $chrome) {
  $chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if ($chrome) { Start-Process -FilePath $chrome -ArgumentList $Url } else { Start-Process $Url }
