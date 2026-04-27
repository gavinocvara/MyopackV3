$ErrorActionPreference = 'SilentlyContinue'

$ports = @(3000, 3001, 3002)
$pids = @()

foreach ($port in $ports) {
  $lines = netstat -ano | Select-String -Pattern ":$port\s+.*LISTENING\s+(\d+)"
  foreach ($line in $lines) {
    if ($line.Matches.Count -gt 0) {
      $pids += [int]$line.Matches[0].Groups[1].Value
    }
  }
}

$pids |
  Where-Object { $_ -and $_ -ne $PID } |
  Select-Object -Unique |
  ForEach-Object {
    Stop-Process -Id $_ -Force
  }
