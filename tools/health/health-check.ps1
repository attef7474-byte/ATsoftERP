param(
  [string]$ApiUrl = "http://localhost:4000",
  [string]$WebUrl = "http://localhost:3000",
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$passed = 0; $failed = 0

function Check($name, $cond) {
  if (& $cond) {
    if (-not $Quiet) { Write-Host "  PASS: $name" -ForegroundColor Green }
    $script:passed++
  } else {
    Write-Host "  FAIL: $name" -ForegroundColor Red
    $script:failed++
  }
}

if (-not $Quiet) { Write-Host "=== Health Check ===" -ForegroundColor Cyan }

# API reachable
try {
  $resp = Invoke-WebRequest -Uri "$ApiUrl/api/v1/auth/login" -Method OPTIONS -UseBasicParsing -TimeoutSec 10
  Check "API reachable on :4000" { $resp.StatusCode -eq 200 -or $resp.StatusCode -eq 204 }
} catch {
  Check "API reachable on :4000" { $false }
}

# Web reachable
try {
  $resp = Invoke-WebRequest -Uri $WebUrl -UseBasicParsing -TimeoutSec 10
  Check "Web reachable on :3000" { $resp.StatusCode -eq 200 }
} catch {
  Check "Web reachable on :3000" { $false }
}

# API Swagger docs
try {
  $resp = Invoke-WebRequest -Uri "$ApiUrl/api/docs" -UseBasicParsing -TimeoutSec 10
  Check "Swagger docs reachable" { $resp.StatusCode -eq 200 -or $resp.StatusCode -eq 301 -or $resp.StatusCode -eq 302 }
} catch {
  Check "Swagger docs reachable" { $false }
}

# Port 50079 (SQL Server)
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.ConnectAsync("localhost", 50079).Wait(3000) | Out-Null
  Check "SQL Server port 50079 open" { $tcp.Connected }
  $tcp.Close()
} catch {
  Check "SQL Server port 50079 open" { $false }
}

# Disk space
$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -gt 0 }
foreach ($d in $drives) {
  $freeGB = [math]::Round($d.Free / 1GB, 1)
  $pctFree = [math]::Round($d.Free / $d.Used * 100, 1)
  if (-not $Quiet) {
    Write-Host "  INFO: Drive $($d.Name) — ${freeGB}GB free (${pctFree}% of used)" -ForegroundColor Gray
  }
  if ($freeGB -lt 1) {
    Write-Host "  FAIL: Drive $($d.Name) critically low on space (${freeGB}GB free)" -ForegroundColor Red
    $script:failed++
  }
}

# Memory
$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$pctFreeMem = [math]::Round($freeGB / $totalGB * 100, 1)
if (-not $Quiet) {
  Write-Host "  INFO: Memory — ${freeGB}GB free / ${totalGB}GB total (${pctFreeMem}%)" -ForegroundColor Gray
}
if ($pctFreeMem -lt 10) {
  Write-Host "  WARN: Low memory (${pctFreeMem}% free)" -ForegroundColor Yellow
}

# Node processes
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
if (-not $Quiet) {
  Write-Host "  INFO: Node processes running: $nodeProcs" -ForegroundColor Gray
}
if ($nodeProcs -eq 0) {
  Write-Host "  WARN: No Node.js processes running" -ForegroundColor Yellow
}

# Summary
if (-not $Quiet) {
  Write-Host "`n=== RESULTS ===" -ForegroundColor Cyan
  Write-Host "Passed: $passed | Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
}
if ($failed -gt 0) { exit 1 }
exit 0
