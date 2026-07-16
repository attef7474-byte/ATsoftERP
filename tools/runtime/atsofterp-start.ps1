param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json",
  [switch]$NoBrowser,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

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
$logDir = if ($cfg["logRoot"]) { $cfg["logRoot"] } else { "C:\ATsoftERP\Logs" }
$tempDir = if ($cfg["installRoot"]) { Join-Path $cfg["installRoot"] "Temp" } else { "C:\ATsoftERP\Temp" }
$releaseDir = if ($cfg["currentReleasePath"]) { $cfg["currentReleasePath"] } else { "" }
$apiDir = if ($releaseDir) { Join-Path $releaseDir "api" } else { "C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api" }
$webDir = if ($releaseDir) { Join-Path $releaseDir "web" } else { "C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\web" }

New-Item -ItemType Directory -Path $logDir -Force -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Path $tempDir -Force -ErrorAction SilentlyContinue | Out-Null

function Write-Log { param($msg) $msg | Out-File -FilePath (Join-Path $logDir "start.log") -Append -Encoding UTF8 }

Write-Host "=== ATsoft ERP — Start ===" -ForegroundColor Cyan

if ($runAsService) {
  # Service mode
  $svcs = @("ATsoftERP_API", "ATsoftERP_Web")
  foreach ($svc in $svcs) {
    $existing = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if (-not $existing) {
      Write-Host "  ERROR: Service '$svc' not installed. Run install-runtime with -InstallServices first." -ForegroundColor Red
      exit 1
    }
    if ($existing.Status -ne "Running") {
      Start-Service -Name $svc
      Write-Host "  Service '$svc' started." -ForegroundColor Green
      Write-Log "Service '$svc' started"
    } else {
      Write-Host "  Service '$svc' already running." -ForegroundColor Gray
    }
  }
} else {
  # Process mode — requires npm/dev environment
  # Check port availability
  $apiBusy = $false
  try { $t = New-Object System.Net.Sockets.TcpClient; $apiBusy = $t.ConnectAsync("localhost",$apiPort).Wait(500); $t.Close() } catch {}
  $webBusy = $false
  try { $t = New-Object System.Net.Sockets.TcpClient; $webBusy = $t.ConnectAsync("localhost",$webPort).Wait(500); $t.Close() } catch {}

  # API
  if ($apiBusy) {
    Write-Host "  API already running on port $apiPort." -ForegroundColor Gray
  } else {
    Write-Host "  Starting API (port $apiPort)..." -NoNewline
    $apiLog = Join-Path $logDir "api-start.log"
    try {
      $proc = Start-Process -NoNewWindow -FilePath "node.exe" -ArgumentList "dist\main.js" -WorkingDirectory $apiDir -PassThru -RedirectStandardOutput $apiLog -RedirectStandardError $apiLog
      $proc.Id | Out-File (Join-Path $tempDir "api.pid") -Encoding UTF8
      Write-Host " PID $($proc.Id)" -ForegroundColor Green
      Write-Log "API started, PID $($proc.Id)"
      Start-Sleep -Seconds 5
    } catch {
      Write-Host " FAILED: $_" -ForegroundColor Red
    }
  }

  # Web
  if ($webBusy) {
    Write-Host "  Web already running on port $webPort." -ForegroundColor Gray
  } else {
    Write-Host "  Starting Web (port $webPort)..." -NoNewline
    $webLog = Join-Path $logDir "web-start.log"
    try {
      $proc = Start-Process -NoNewWindow -FilePath "node.exe" -ArgumentList "node_modules\next\dist\bin\next start -p $webPort" -WorkingDirectory $webDir -PassThru -RedirectStandardOutput $webLog -RedirectStandardError $webLog
      $proc.Id | Out-File (Join-Path $tempDir "web.pid") -Encoding UTF8
      Write-Host " PID $($proc.Id)" -ForegroundColor Green
      Write-Log "Web started, PID $($proc.Id)"
      Start-Sleep -Seconds 8
    } catch {
      Write-Host " FAILED: $_" -ForegroundColor Red
    }
  }
}

# Verify
Write-Host "`nVerifying..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
$apiOk = $false; $webOk = $false
try { $r = Invoke-WebRequest -Uri "http://localhost:$apiPort/api/docs" -UseBasicParsing -TimeoutSec 5; $apiOk = $r.StatusCode -eq 200 } catch {}
try { $r = Invoke-WebRequest -Uri "http://localhost:$webPort" -UseBasicParsing -TimeoutSec 5; $webOk = $r.StatusCode -eq 200 } catch {}

if ($apiOk) { Write-Host "  API: OK (port $apiPort)" -ForegroundColor Green } else { Write-Host "  API: DOWN (port $apiPort)" -ForegroundColor Red }
if ($webOk) { Write-Host "  Web: OK (port $webPort)" -ForegroundColor Green } else { Write-Host "  Web: DOWN (port $webPort)" -ForegroundColor Red }

# Open browser
if ($webOk -and -not $NoBrowser -and $cfg["openBrowserAfterStart"] -ne $false) {
  try {
    Start-Process "http://localhost:$webPort"
    Write-Host "  Browser opened." -ForegroundColor Gray
  } catch {
    Write-Host "  Could not open browser." -ForegroundColor Yellow
  }
}

if ($apiOk -or $webOk) {
  Write-Host "`nATsoft ERP started." -ForegroundColor Green
  exit 0
} else {
  Write-Host "`nATsoft ERP failed to start." -ForegroundColor Red
  exit 1
}
