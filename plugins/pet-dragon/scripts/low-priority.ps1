# Runs a command at BelowNormal priority so a long test run never starves the terminal. Children inherit the priority class.
# Usage: low-priority.ps1 <exe> [args...]; exits with the command's exit code.
try { (Get-Process -Id $PID).PriorityClass = 'BelowNormal' } catch {}
$exe = $args[0]
$rest = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }
& $exe @rest
exit $LASTEXITCODE
