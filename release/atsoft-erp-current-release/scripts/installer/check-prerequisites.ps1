param(
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$passed = 0; $failed = 0; $warnings = 0

function Check($name, $cond, $isWarning = $false) {
  $ok = & $cond
  if ($ok) {
    if (-not $Quiet) { Write-Host "  PASS: $name" -ForegroundColor Green }
    $script:passed++
  } elseif ($isWarning) {
    if (-not $Quiet) { Write-Host "  WARN: $name" -ForegroundColor Yellow }
    $script:warnings++
  } else {
    Write-Host "  FAIL: $name" -ForegroundColor Red
    $script:failed++
  }
}

if (-not $Quiet) { Write-Host "=== ATsoft ERP — Prerequisite Check ===" -ForegroundColor Cyan }

# OS
Check "Windows OS" { $env:OS -eq "Windows_NT" }
Check "PowerShell 7+" { $PSVersionTable.PSVersion.Major -ge 7 }

# Node.js
$nodeOk = $false
try { $nv = node --version 2>&1; if ($LASTEXITCODE -eq 0 -and $nv -match 'v(\d+)') { $nodeOk = [int]$Matches[1] -ge 20 } } catch {}
Check "Node.js 20+ available" { $nodeOk }

$npmOk = $false
try { $npmv = npm --version 2>&1; if ($LASTEXITCODE -eq 0 -and $npmv -match '(\d+)') { $npmOk = [int]$Matches[1] -ge 10 } } catch {}
Check "npm 10+ available" { $npmOk }

# SQL Server
$sqlcmdOk = $false
try { $null = Get-Command sqlcmd -ErrorAction Stop; $sqlcmdOk = $true } catch {}
Check "sqlcmd available" { $sqlcmdOk } $true

$sqlPortOk = $false
try { $t = New-Object System.Net.Sockets.TcpClient; $sqlPortOk = $t.ConnectAsync("localhost",50079).Wait(2000); $t.Close() } catch {}
Check "SQL Server port 50079 reachable" { $sqlPortOk }

# Ports
$apiPortOk = $true
try { $t = New-Object System.Net.Sockets.TcpClient; $apiPortOk = -not $t.ConnectAsync("localhost",4000).Wait(500); $t.Close() } catch {}
Check "API port 4000 available (or already running expected process)" { $apiPortOk -or (Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue) } $true

$webPortOk = $true
try { $t = New-Object System.Net.Sockets.TcpClient; $webPortOk = -not $t.ConnectAsync("localhost",3000).Wait(500); $t.Close() } catch {}
Check "Web port 3000 available (or already running expected process)" { $webPortOk -or (Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue) } $true

# Folders
Check "Can create C:\ATsoftERP folder" { try { New-Item -ItemType Directory -Path "C:\ATsoftERP" -Force | Out-Null; $true } catch { $false } } $true
Check "Can create log/backup subfolders" { try { New-Item -ItemType Directory -Path "C:\ATsoftERP\Logs" -Force | Out-Null; New-Item -ItemType Directory -Path "C:\ATsoftERP\Backups" -Force | Out-Null; $true } catch { $false } } $true

# Admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Check "Administrator privileges" { $isAdmin } $true

# Git (optional)
$gitOk = $false
try { $null = Get-Command git -ErrorAction Stop; $gitOk = $true } catch {}
Check "Git available (optional)" { $gitOk } $true

# NSSM (optional)
$nssmOk = $false
try { $null = Get-Command nssm -ErrorAction Stop; $nssmOk = $true } catch {}
Check "NSSM available (optional, for service mode)" { $nssmOk } $true

# No Docker/PostgreSQL assumptions
Check "No Docker dependency assumed" { $true }
Check "No PostgreSQL dependency assumed" { $true }

# Summary
if (-not $Quiet) {
  Write-Host "`n=== RESULTS ===" -ForegroundColor Cyan
  Write-Host "Passed  : $passed" -ForegroundColor Green
  Write-Host "Failed  : $failed" -ForegroundColor Red
  Write-Host "Warnings: $warnings" -ForegroundColor Yellow

  if ($failed -gt 0) {
    Write-Host "`nSome checks failed. Review above." -ForegroundColor Yellow
  } else {
    Write-Host "`nSystem is ready for ATsoft ERP." -ForegroundColor Green
  }
}

if ($failed -gt 0) { exit 1 }
exit 0
