# Unread Outlook mail and whether Teams is running, as one JSON object on stdout.
# Never starts Outlook: COM is only touched when Outlook is already running.
$ErrorActionPreference = 'SilentlyContinue'
$result = [ordered]@{
  outlook = 'off'; outlookUnread = $null; outlookError = $null; meetings = $null; meetingsError = $null
  teams = 'off'
}

if (Get-Process OUTLOOK) {
  try {
    $ol = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
    $result.outlookUnread = $ol.GetNamespace('MAPI').GetDefaultFolder(6).UnReadItemCount
    $result.outlook = 'on'
    # Today's and tomorrow's appointments (recurring ones expanded), local times
    try {
      $inv = [Globalization.CultureInfo]::InvariantCulture
      $items = $ol.GetNamespace('MAPI').GetDefaultFolder(9).Items
      $items.IncludeRecurrences = $true
      $items.Sort('[Start]')
      $from = (Get-Date).Date
      $filter = "[Start] >= '" + $from.ToString('MM/dd/yyyy hh:mm tt', $inv) + "' AND [Start] < '" + $from.AddDays(2).ToString('MM/dd/yyyy hh:mm tt', $inv) + "'"
      $list = @()
      foreach ($it in $items.Restrict($filter)) {
        if ($list.Count -ge 60) { break }
        if ($it.MeetingStatus -eq 5 -or $it.MeetingStatus -eq 7) { continue }
        $list += [ordered]@{ start = $it.Start.ToString('yyyy-MM-ddTHH:mm'); end = $it.End.ToString('yyyy-MM-ddTHH:mm'); subject = [string]$it.Subject; location = [string]$it.Location; allDay = [bool]$it.AllDayEvent }
      }
      $result.meetings = @($list)
    } catch { $result.meetingsError = $_.Exception.Message }
  } catch {
    $result.outlook = 'error'; $result.outlookError = $_.Exception.Message
  }
} elseif (Get-Process olk) {
  $result.outlook = 'new-outlook'
}

if (@(Get-Process ms-teams, Teams).Count -gt 0) { $result.teams = 'on' }

$result | ConvertTo-Json -Compress
