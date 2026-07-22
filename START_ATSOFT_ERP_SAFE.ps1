<#
.SYNOPSIS
  Launch ATsoft ERP (API + Web) in separate windows with safer error handling.
.DESCRIPTION
  This PowerShell script provides better error handling and logging than the
  batch file version. It starts the API and Web servers in separate CMD windows
  and opens the browser.
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSCommandPath
Set-Location $Root

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ATsoft ERP - Starting Application" -ForegroundColor Cyan
Write-Host "  شغّل تطبيق ATsoft ERP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ---- Verify node ----
try {
    $nodeVer = node --version
    Write-Host "[PASS] Node.js $nodeVer found" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Node.js not found. Please install Node.js first." -ForegroundColor Red
    Write-Host "[FAIL] لم يتم العثور على Node.js. يرجى تثبيته أولاً." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ---- Verify npm ----
try {
    $npmVer = npm --version
    Write-Host "[PASS] npm $npmVer found" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] npm not found." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ---- Verify project files ----
$files = @("package.json", "apps/api/package.json", "apps/web/package.json")
foreach ($f in $files) {
    if (-not (Test-Path $f)) {
        Write-Host "[FAIL] $f not found in $Root" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[PASS] $f found" -ForegroundColor Green
}

# ---- Check .env ----
if (-not (Test-Path "apps/api/.env")) {
    Write-Host "[WARN] apps/api/.env not found — API may fail to connect to database." -ForegroundColor Yellow
    Write-Host "[WARN] ملف .env غير موجود — قد يفشل الاتصال بقاعدة البيانات." -ForegroundColor Yellow
} else {
    Write-Host "[PASS] apps/api/.env found" -ForegroundColor Green
}
Write-Host ""

# ---- Start API ----
Write-Host "Starting API server..." -ForegroundColor Yellow
Write-Host "جارٍ تشغيل خادم API..." -ForegroundColor Yellow
try {
    Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$Root`" && npm run start:dev --workspace apps/api" -WindowStyle Normal
    Start-Sleep -Seconds 2
    $apiProcs = Get-Process -Name "cmd" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*ATsoft ERP API*" }
    if (-not $apiProcs) {
        Write-Host "[WARN] API window may not have opened. Check manually." -ForegroundColor Yellow
    } else {
        Write-Host "[PASS] API window opened" -ForegroundColor Green
    }
} catch {
    Write-Host "[FAIL] Failed to launch API: $_" -ForegroundColor Red
}
Write-Host ""

# ---- Wait before starting Web ----
Write-Host "Waiting for API to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# ---- Start Web ----
Write-Host "Starting Web server..." -ForegroundColor Yellow
Write-Host "جارٍ تشغيل خادم الويب..." -ForegroundColor Yellow
try {
    Start-Process -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$Root`" && npm run dev --workspace apps/web"
    Start-Sleep -Seconds 2
    $webProcs = Get-Process -Name "cmd" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*ATsoft ERP Web*" }
    if (-not $webProcs) {
        Write-Host "[WARN] Web window may not have opened. Check manually." -ForegroundColor Yellow
    } else {
        Write-Host "[PASS] Web window opened" -ForegroundColor Green
    }
} catch {
    Write-Host "[FAIL] Failed to launch Web: $_" -ForegroundColor Red
}
Write-Host ""

# ---- Wait before opening browser ----
Start-Sleep -Seconds 5

# ---- Open browser ----
try {
    Start-Process "http://localhost:3000"
    Write-Host "[PASS] Browser opened to http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not open browser automatically: $_" -ForegroundColor Yellow
}
Write-Host ""

# ---- Print URLs ----
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ATsoft ERP - Running" -ForegroundColor Cyan
Write-Host "  التطبيق قيد التشغيل" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API:       http://localhost:4000" -ForegroundColor White
Write-Host "  Swagger:   http://localhost:4000/api/docs" -ForegroundColor White
Write-Host "  Web:       http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  To stop, close the two CMD windows" -ForegroundColor Gray
Write-Host "  See STOP_ATSOFT_ERP_HELP.txt for details." -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to close this window"
