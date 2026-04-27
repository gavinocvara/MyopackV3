$ErrorActionPreference = 'Stop'

& "$PSScriptRoot\stop-dev.ps1"

$nextPath = Join-Path (Resolve-Path "$PSScriptRoot\..") '.next'
if (Test-Path -LiteralPath $nextPath) {
  Remove-Item -LiteralPath $nextPath -Recurse -Force
}

npx next dev
