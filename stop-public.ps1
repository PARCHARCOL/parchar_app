$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $root ".runtime"
$pidsFile = Join-Path $runtimeDir "pids.json"

if (Test-Path $pidsFile) {
  $pids = Get-Content $pidsFile -Raw | ConvertFrom-Json
  foreach ($pid in @($pids.nodePid, $pids.tunnelPid)) {
    if ($pid) {
      Stop-Process -Id $pid
    }
  }
  Remove-Item $pidsFile -Force
}

Write-Output "Parchar publico detenido."
