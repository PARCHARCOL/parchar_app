$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$runtimeDir = Join-Path $root ".runtime"
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$nodeOut = Join-Path $runtimeDir "node.out.log"
$nodeErr = Join-Path $runtimeDir "node.err.log"
$tunOut = Join-Path $runtimeDir "tunnel.out.log"
$tunErr = Join-Path $runtimeDir "tunnel.err.log"
$pidsFile = Join-Path $runtimeDir "pids.json"
$urlFile = Join-Path $runtimeDir "public-url.txt"

# Stop previous runtime if it exists.
if (Test-Path $pidsFile) {
  try {
    $prev = Get-Content $pidsFile -Raw | ConvertFrom-Json
    foreach ($pid in @($prev.nodePid, $prev.tunnelPid)) {
      if ($pid) {
        Stop-Process -Id $pid -ErrorAction SilentlyContinue
      }
    }
  } catch {
    # Ignore stale file.
  }
}

Remove-Item $nodeOut, $nodeErr, $tunOut, $tunErr, $urlFile -ErrorAction SilentlyContinue

$env:PORT = "9098"
$nodeProc = Start-Process node -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $nodeOut -RedirectStandardError $nodeErr
Start-Sleep -Seconds 2

$tunnelArgs = @(
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ServerAliveInterval=30",
  "-R", "80:localhost:9098",
  "nokey@localhost.run"
)
$tunProc = Start-Process ssh -ArgumentList $tunnelArgs -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $tunOut -RedirectStandardError $tunErr

$publicUrl = $null
for ($i = 0; $i -lt 80; $i++) {
  Start-Sleep -Milliseconds 500

  $content = ""
  if (Test-Path $tunOut) {
    $content += Get-Content $tunOut -Raw -ErrorAction SilentlyContinue
  }
  if (Test-Path $tunErr) {
    $content += "`n" + (Get-Content $tunErr -Raw -ErrorAction SilentlyContinue)
  }

  $lineMatch = [regex]::Match($content, "tunneled with tls termination,\s*(https?://[a-zA-Z0-9.-]+)")
  if ($lineMatch.Success) {
    $publicUrl = $lineMatch.Groups[1].Value
  } else {
    $allMatches = [regex]::Matches($content, "https?://[a-zA-Z0-9.-]+")
    $candidates = @()
    foreach ($m in $allMatches) {
      $url = $m.Value
      if ($url -match "https?://localhost\.run/?$") { continue }
      if ($url -match "https?://localhost\.run/docs/") { continue }
      $candidates += $url
    }
    if ($candidates.Count -gt 0) {
      $publicUrl = $candidates[$candidates.Count - 1]
    }
  }

  if ($publicUrl) {
    try {
      $health = Invoke-WebRequest -UseBasicParsing "$publicUrl/api/health" -TimeoutSec 5
      if ($health.StatusCode -eq 200) {
        break
      }
    } catch {
      # Keep waiting until tunnel is active.
    }
  }
}

[pscustomobject]@{
  nodePid = $nodeProc.Id
  tunnelPid = $tunProc.Id
  port = 9098
  startedAt = (Get-Date).ToString("s")
  publicUrl = $publicUrl
} | ConvertTo-Json | Set-Content $pidsFile

if (-not $publicUrl) {
  Write-Output "No se pudo obtener URL publica. Revisa .runtime\\tunnel.out.log"
  exit 1
}

Set-Content -Path $urlFile -Value $publicUrl
Write-Output "PUBLIC_URL=$publicUrl"
