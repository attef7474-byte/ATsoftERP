# ATsoft ERP — Production Hardening Smoke Check
# Run from repo root: pwsh tools/regression/smoke-check.ps1
# Requires: Node.js, npm, PowerShell 7+
# This script checks build/static regression. Runtime API checks require DB.

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/../.."
$passed = 0
$failed = 0
$skipped = 0
$results = @{}

function Check-Step {
    param($Name, $ScriptBlock)
    Write-Host "  → $Name..." -NoNewline
    try {
        & $ScriptBlock
        Write-Host " PASS" -ForegroundColor Green
        $script:passed++
        $results[$Name] = "PASS"
    } catch {
        Write-Host " FAIL" -ForegroundColor Red
        Write-Host "      $_" -ForegroundColor DarkRed
        $script:failed++
        $results[$Name] = "FAIL: $_"
    }
}

function Check-Skipped {
    param($Name, $Reason)
    Write-Host "  → $Name... SKIPPED ($Reason)" -ForegroundColor Yellow
    $script:skipped++
    $results[$Name] = "SKIPPED: $Reason"
}

Write-Host "=== ATsoft ERP — Production Hardening Smoke Check ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host ""

# === BUILD CHECKS ===
Write-Host "[Build]" -ForegroundColor Cyan

Check-Step "prisma validate" {
    Push-Location "$root/apps/api"
    $out = npx prisma validate 2>&1
    if ($LASTEXITCODE -ne 0) { throw "prisma validate failed: $out" }
    Pop-Location
}

Check-Step "prisma generate" {
    Push-Location "$root/apps/api"
    $out = npx prisma generate 2>&1
    if ($LASTEXITCODE -ne 0) { throw "prisma generate failed: $out" }
    Pop-Location
}

Check-Step "api typecheck (tsc --noEmit)" {
    Push-Location "$root/apps/api"
    $out = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) { throw "api typecheck failed: $out" }
    Pop-Location
}

Check-Step "api build (tsc)" {
    Push-Location "$root/apps/api"
    $out = npx tsc 2>&1
    if ($LASTEXITCODE -ne 0) { throw "api build failed: $out" }
    Pop-Location
}

Check-Step "web build (next build)" {
    Push-Location "$root/apps/web"
    $out = npx next build 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $out -notmatch "Compiled successfully") { throw "web build failed" }
    Pop-Location
}

Check-Step "shared packages build" {
    Push-Location "$root"
    $out = npm run build --workspace packages/shared 2>&1
    if ($LASTEXITCODE -ne 0) { throw "shared build failed: $out" }
}

Check-Step "i18n check" {
    Push-Location "$root"
    $out = npm run i18n:check 2>&1
    if ($LASTEXITCODE -ne 0) { throw "i18n check failed: $out" }
}

# === ROUTE EXISTENCE ===
Write-Host "[Route Existence]" -ForegroundColor Cyan

$routeChecks = @(
    # Core
    "/admin/dashboard"
    "/admin/core/companies"
    "/admin/core/branches"
    "/admin/core/departments"
    "/admin/access/users"
    "/admin/access/roles"
    "/admin/access/permissions"
    # Inventory
    "/admin/inventory/products"
    "/admin/inventory/products/new"
    "/admin/inventory/product-categories"
    "/admin/inventory/warehouses"
    "/admin/inventory/locations"
    "/admin/inventory/balances"
    "/admin/inventory/counts"
    "/admin/inventory/counts/new"
    "/admin/inventory/movements"
    "/admin/inventory/adjustments"
    # Maintenance
    "/admin/maintenance/machine-categories"
    "/admin/maintenance/machines"
    "/admin/maintenance/machines/new"
    "/admin/maintenance/machine-parts"
    "/admin/maintenance/machine-documents"
    "/admin/maintenance/requests"
    "/admin/maintenance/requests/new"
    "/admin/maintenance/tasks"
    "/admin/maintenance/schedules"
    "/admin/maintenance/checklist-items"
    "/admin/maintenance/downtime-logs"
    "/admin/maintenance/downtime-logs/new"
    # Barcode
    "/admin/barcodes/generate"
    "/admin/barcodes/print"
    "/admin/barcodes/scan"
    # System
    "/admin/settings"
    "/admin/settings/numbering"
    "/admin/settings/audit"
    "/admin/notifications"
    "/admin/profile"
    "/admin/profile/password"
    # Reports
    "/admin/reports/maintenance"
    "/admin/reports/maintenance/requests"
    "/admin/reports/maintenance/downtime"
    "/admin/reports/maintenance/costs"
    "/admin/reports/maintenance/schedules"
    "/admin/reports/inventory"
    "/admin/reports/inventory/balances"
    "/admin/reports/inventory/count-variance"
    "/admin/reports/inventory/movements"
    "/admin/reports/inventory/adjustments"
    "/admin/reports/barcodes/scans"
    # Dynamic routes (check [id] patterns exist)
    "/admin/inventory/products/[id]"
    "/admin/inventory/products/[id]/edit"
    "/admin/inventory/counts/[id]"
    "/admin/inventory/counts/[id]/edit"
    "/admin/inventory/counts/[id]/execute"
    "/admin/inventory/counts/[id]/review"
    "/admin/inventory/counts/[id]/approve"
    "/admin/inventory/counts/[id]/adjust"
    "/admin/inventory/movements/[id]"
    "/admin/inventory/adjustments/[id]"
    "/admin/maintenance/machines/[id]"
    "/admin/maintenance/machines/[id]/edit"
    "/admin/maintenance/machines/[id]/qr"
    "/admin/maintenance/machines/[id]/maintenance-log"
    "/admin/maintenance/machines/[id]/downtime"
    "/admin/maintenance/requests/[id]"
    "/admin/maintenance/requests/[id]/edit"
    "/admin/maintenance/requests/[id]/assign"
    "/admin/maintenance/requests/[id]/parts"
    "/admin/maintenance/requests/[id]/cost"
    "/admin/maintenance/schedules/[id]/checklist"
    "/admin/maintenance/downtime-logs/[id]/edit"
)

foreach ($route in $routeChecks) {
    $relativePath = $route.TrimStart('/')
    $dirPath = "$root/apps/web/src/app/$relativePath"
    $exists = Test-Path -LiteralPath "$dirPath/page.tsx" -PathType Leaf
    if (-not $exists) {
        $exists = Test-Path -LiteralPath "$dirPath" -PathType Container
    }
    $routeLabel = $route -replace '\[id\]', ':id'
    if ($exists) {
        Write-Host "  → $routeLabel... PASS" -ForegroundColor Green
        $passed++
        $results["route:$routeLabel"] = "PASS"
    } else {
        Write-Host "  → $routeLabel... FAIL (page not found at $dirPath)" -ForegroundColor Red
        $failed++
        $results["route:$routeLabel"] = "FAIL: page not found"
    }
}

# === SUMMARY ===
Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Cyan
Write-Host "Passed : $passed" -ForegroundColor Green
Write-Host "Failed : $failed" -ForegroundColor Red
Write-Host "Skipped: $skipped" -ForegroundColor Yellow
Write-Host ""

if ($failed -eq 0) {
    Write-Host "All checks PASSED. System is regression-clean for build/static." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failed check(s) FAILED. Review details above." -ForegroundColor Red
    exit 1
}
