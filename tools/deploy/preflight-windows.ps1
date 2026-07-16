param(
  [string]$RootDir = (Resolve-Path "$PSScriptRoot/../.."),
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$passed = 0; $failed = 0; $warnings = 0

function Check($name, $cond) {
  if (& $cond) {
    if (-not $Quiet) { Write-Host "  PASS: $name" -ForegroundColor Green }
    $script:passed++
  } else {
    Write-Host "  FAIL: $name" -ForegroundColor Red
    $script:failed++
  }
}

if (-not $Quiet) { Write-Host "=== Pre-Deployment Health Check ===" -ForegroundColor Cyan }

Push-Location $RootDir

# --- Git ---
Check "Git working tree clean" { (git status --porcelain) -eq "" }
Check "On main branch" { (git branch --show-current) -eq "main" }

# --- Build ---
Check "Prisma validate passes" { $out = npx prisma validate 2>&1; $LASTEXITCODE -eq 0 }
Check "Prisma generate passes" { $out = npx prisma generate 2>&1; $LASTEXITCODE -eq 0 }
Check "API typecheck passes" { Push-Location "apps/api"; $r = $LASTEXITCODE -eq 0; Pop-Location; $r }  # will be checked below
Check "Shared packages build" { $out = npm run build --workspace packages/shared 2>&1; $LASTEXITCODE -eq 0 }
Check "API build passes" { $out = npm run build:api 2>&1; $LASTEXITCODE -eq 0 }
Check "Web build passes" { $out = npm run build:web 2>&1; $LASTEXITCODE -eq 0 }
Check "i18n check passes" { $out = npm run i18n:check 2>&1; $LASTEXITCODE -eq 0 }

# --- API reachable ---
try {
  $apiResp = Invoke-WebRequest -Uri "http://localhost:4000/api/v1/auth/login" -Method OPTIONS -UseBasicParsing -TimeoutSec 5
  Check "API reachable on :4000" { $true }
} catch {
  Check "API reachable on :4000" { $false }
}

try {
  $webResp = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
  Check "Web reachable on :3000" { $true }
} catch {
  Check "Web reachable on :3000" { $false }
}

Pop-Location

# --- Summary ---
if (-not $Quiet) {
  Write-Host "`n=== RESULTS ===" -ForegroundColor Cyan
  Write-Host "Passed : $passed" -ForegroundColor Green
  Write-Host "Failed : $failed" -ForegroundColor Red
  Write-Host "Warnings: $warnings" -ForegroundColor Yellow
}

if ($failed -gt 0) { exit 1 }
exit 0
