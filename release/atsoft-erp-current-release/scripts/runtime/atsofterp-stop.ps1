param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json"
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
$tempDir = if ($cfg["installRoot"]) { Join-Path $cfg["installRoot"] "Temp" } else { "C:\ATsoftERP\Temp" }
$logDir = if ($cfg["logRoot"]) { $cfg["logRoot"] } else { "C:\ATsoftERP\Logs" }

Write-Host "=== ATsoft ERP — Stop ===" -ForegroundColor Cyan

if ($runAsService) {
  $svcs = @("ATsoftERP_API", "ATsoftERP_Web")
  foreach ($svc in $svcs) {
    $existing = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($existing -and $existing.Status -eq "Running") {
      Stop-Service -Name $svc -Force
      Write-Host "  Service '$svc' stopped." -ForegroundColor Green
    } else {
      Write-Host "  Service '$svc' not running." -ForegroundColor Gray
    }
  }
} else {
  # Kill processes by PID file (safe — only kill our own tracked processes)
  $pidFiles = @(
    @{ Name = "API"; File = Join-Path $tempDir "api.pid"; Port = 4000 }
    @{ Name = "Web"; File = Join-Path $tempDir "web.pid"; Port = 3000 }
  )

  foreach ($p in $pidFiles) {
    if (Test-Path $p.File) {
      $pid = Get-Content $p.File -Raw -ErrorAction SilentlyContinue
      if ($pid -match '\d+') {
        $pid = [int]$Matches[0]
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
          Write-Host "  $($p.Name) (PID $pid) stopped." -ForegroundColor Green
        } else {
          Write-Host "  $($p.Name) (PID $pid) not running." -ForegroundColor Gray
        }
      }
      Remove-Item $p.File -Force -ErrorAction SilentlyContinue
    } else {
      Write-Host "  $($p.Name): no PID file found." -ForegroundColor Gray
    }
  }

  # Also kill any node processes that match our known app directories (safety bound)
  $releaseDir = if ($cfg["currentReleasePath"]) { $cfg["currentReleasePath"] } else { "" }
  $knownDirs = @()
  if ($releaseDir) { $knownDirs = @((Join-Path $releaseDir "api"), (Join-Path $releaseDir "web")) }
  else { $knownDirs = @("C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api", "C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\web") }
  foreach ($dir in $knownDirs) {
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
      $_.CommandLine -match [regex]::Escape($dir)
    } | Stop-Process -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "`nATsoft ERP stopped." -ForegroundColor Green
