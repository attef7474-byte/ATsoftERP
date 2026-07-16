param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json"
)

$ErrorActionPreference = "Stop"
$failed = 0

function ConvertFrom-JsonToHashtable {
  param([string]$Path)
  $obj = Get-Content $Path -Raw | ConvertFrom-Json
  $ht = @{}
  $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
  return $ht
}

$cfg = @{}
if (Test-Path $ConfigPath) {
  $cfg = ConvertFrom-JsonToHashtable -Path $ConfigPath
}

$runAsService = $cfg["runAsService"] -eq $true
$apiPort = if ($cfg["apiPort"]) { $cfg["apiPort"] } else { 4000 }
$webPort = if ($cfg["webPort"]) { $cfg["webPort"] } else { 3000 }
$logRoot = if ($cfg["logRoot"]) { $cfg["logRoot"] } else { "C:\ATsoftERP\Logs" }
$tempDir = if ($cfg["installRoot"]) { Join-Path $cfg["installRoot"] "Temp" } else { "C:\ATsoftERP\Temp" }

Write-Host "=== ATsoft ERP — Status ===" -ForegroundColor Cyan

# Services / Process mode
if ($runAsService) {
  Write-Host "`nMode: Windows Service" -ForegroundColor Cyan
  foreach ($svcName in @("ATsoftERP_API", "ATsoftERP_Web")) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc) {
      $color = if ($svc.Status -eq "Running") { "Green" } else { "Red" }
      Write-Host "  $svcName : $($svc.Status)" -ForegroundColor $color
      if ($svc.Status -ne "Running") { $failed++ }
    } else {
      Write-Host "  $svcName : NOT INSTALLED" -ForegroundColor Yellow
    }
  }
} else {
  Write-Host "`nMode: Local Process (development)" -ForegroundColor Cyan
  $pidFiles = @(
    @{ Name = "API"; File = Join-Path $tempDir "api.pid"; Port = $apiPort }
    @{ Name = "Web"; File = Join-Path $tempDir "web.pid"; Port = $webPort }
  )
  foreach ($p in $pidFiles) {
    if (Test-Path $p.File) {
      $pid = Get-Content $p.File -Raw -ErrorAction SilentlyContinue
      $proc = $null
      if ($pid -match '\d+') { $proc = Get-Process -Id ([int]$Matches[0]) -ErrorAction SilentlyContinue }
      if ($proc) {
        Write-Host "  $($p.Name) : RUNNING (PID $($proc.Id))" -ForegroundColor Green
      } else {
        Write-Host "  $($p.Name) : PID FILE STALE ($pid)" -ForegroundColor Yellow
        Remove-Item $p.File -Force -ErrorAction SilentlyContinue
      }
    } else {
      # Check if running independently (e.g. via npm run dev)
      $portCheck = $false
      try { $t = New-Object System.Net.Sockets.TcpClient; $portCheck = $t.ConnectAsync("localhost",$p.Port).Wait(1000); $t.Close() } catch {}
      if ($portCheck) {
        Write-Host "  $($p.Name) : RUNNING (port $($p.Port) open, no PID file)" -ForegroundColor Green
      } else {
        Write-Host "  $($p.Name) : STOPPED" -ForegroundColor Red
        $failed++
      }
    }
  }
}

# API health
Write-Host "`nHealth:" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri "http://localhost:$apiPort/api/docs" -UseBasicParsing -TimeoutSec 5
  Write-Host "  API : OK ($($r.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host "  API : DOWN" -ForegroundColor Red
  $failed++
}
try {
  $r = Invoke-WebRequest -Uri "http://localhost:$webPort" -UseBasicParsing -TimeoutSec 5
  Write-Host "  Web : OK ($($r.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host "  Web : DOWN" -ForegroundColor Red
  $failed++
}

# SQL Server
try {
  $t = New-Object System.Net.Sockets.TcpClient; $ok = $t.ConnectAsync("localhost",50079).Wait(2000); $t.Close()
  if ($ok) { Write-Host "  SQL Server : REACHABLE (port 50079)" -ForegroundColor Green }
  else { Write-Host "  SQL Server : UNREACHABLE" -ForegroundColor Red; $failed++ }
} catch {
  Write-Host "  SQL Server : ERROR ($_)" -ForegroundColor Red; $failed++
}

# Logs
Write-Host "`nLogs:" -ForegroundColor Cyan
if (Test-Path $logRoot) {
  Get-ChildItem $logRoot -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime | ForEach-Object {
    Write-Host "  $($_.Name) ($($_.Length)B, $($_.LastWriteTime))" -ForegroundColor Gray
  }
} else {
  Write-Host "  Log directory: NOT FOUND" -ForegroundColor Yellow
}

# Current release
$currentLink = if ($cfg["currentReleasePath"]) { $cfg["currentReleasePath"] } else { "C:\ATsoftERP\App\current" }
if (Test-Path $currentLink) {
  $target = (Get-Item $currentLink -ErrorAction SilentlyContinue).Target
  Write-Host "`nRelease: $(if ($target) { $target } else { $currentLink })" -ForegroundColor Cyan
}

Write-Host "`n---" -ForegroundColor Gray
if ($failed -gt 0) {
  Write-Host "Status: $failed component(s) DOWN" -ForegroundColor Red
  exit 1
} else {
  Write-Host "Status: ALL RUNNING" -ForegroundColor Green
  exit 0
}
