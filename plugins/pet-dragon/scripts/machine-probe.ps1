# How loaded this computer is: RAM, CPU and the system drive, plus the three programs holding the most memory.
# One JSON object on stdout.
$ErrorActionPreference = 'SilentlyContinue'
$os = Get-CimInstance Win32_OperatingSystem
$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
$drive = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='" + $env:SystemDrive + "'")
$top = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 3 | ForEach-Object {
  [ordered]@{ name = $_.ProcessName; mb = [math]::Round($_.WorkingSet64 / 1MB) }
}
[ordered]@{
  ramTotalMb = [math]::Round($os.TotalVisibleMemorySize / 1KB)
  ramFreeMb  = [math]::Round($os.FreePhysicalMemory / 1KB)
  cpuPct     = [math]::Round([double]$cpu)
  diskTotalGb = if ($drive) { [math]::Round($drive.Size / 1GB) } else { $null }
  diskFreeGb  = if ($drive) { [math]::Round($drive.FreeSpace / 1GB) } else { $null }
  drive      = $env:SystemDrive
  top        = @($top)
} | ConvertTo-Json -Compress -Depth 4
