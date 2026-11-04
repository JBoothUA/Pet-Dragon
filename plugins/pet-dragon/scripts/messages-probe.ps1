# Unread Outlook mail and whether Teams is running, as one JSON object on stdout.
# Never starts Outlook: COM is only touched when Outlook is already running.
$ErrorActionPreference = 'SilentlyContinue'
$result = [ordered]@{
  outlook = 'off'; outlookUnread = $null; outlookError = $null
  teams = 'off'
}

if (Get-Process OUTLOOK) {
  try {
    $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
    $result.outlookUnread = $ol.GetNamespace('MAPI').GetDefaultFolder(6).UnReadItemCount
    $result.outlook = 'on'
  } catch {
    $result.outlook = 'error'; $result.outlookError = $_.Exception.Message
  }
} elseif (Get-Process olk) {
  $result.outlook = 'new-outlook'
}

if (@(Get-Process ms-teams, Teams).Count -gt 0) { $result.teams = 'on' }

$result | ConvertTo-Json -Compress
