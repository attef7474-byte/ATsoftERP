param(
  [string]$ApiEnvPath = "apps/api/.env",
  [string]$WebEnvPath = "apps/web/.env.local",
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$passed = 0; $failed = 0; $warnings = 0

function Check($name, $cond, $isWarning = $false) {
  if (& $cond) {
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

if (-not $Quiet) { Write-Host "=== Environment Validation ===" -ForegroundColor Cyan }

# --- Tools ---
Check "node --version" { & { $v = node --version 2>&1; $LASTEXITCODE -eq 0 -and $v -match 'v(\d+)' -and [int]$Matches[1] -ge 20 } }
Check "npm --version" { & { $v = npm --version 2>&1; $LASTEXITCODE -eq 0 -and $v -match '(\d+)' -and [int]$Matches[1] -ge 10 } }
Check "powershell 7+" { $PSVersionTable.PSVersion.Major -ge 7 }
Check "sqlcmd available" { & { Get-Command "sqlcmd" -ErrorAction SilentlyContinue } }

# --- API .env ---
if (Test-Path $ApiEnvPath) {
  $apiEnv = Get-Content $ApiEnvPath -Raw
  Check "API .env: DATABASE_URL present" { $apiEnv -match 'DATABASE_URL=' }
  Check "API .env: JWT_SECRET set" { $apiEnv -match 'JWT_SECRET=' }
  Check "API .env: JWT_SECRET != placeholder" { $apiEnv -notmatch 'JWT_SECRET="?change-this' } $true
  Check "API .env: DATABASE_URL uses sqlserver" { $apiEnv -match 'sqlserver://' }
  Check "API .env: DATABASE_URL not using postgresql" { $apiEnv -notmatch 'postgresql://' }
} else {
  Check "API .env file exists" { $false }
}

# --- Web .env.local ---
if (Test-Path $WebEnvPath) {
  $webEnv = Get-Content $WebEnvPath -Raw
  Check "Web .env.local: NEXT_PUBLIC_API_URL present" { $webEnv -match 'NEXT_PUBLIC_API_URL=' }
} else {
  Check "Web .env.local exists" { $false } $true
}

# --- Secrets check---
$allEnvFiles = Get-ChildItem -Recurse -Filter ".env*" -File | Where-Object { $_.Name -notmatch '\.example' }
$exposedSecrets = @()
foreach ($f in $allEnvFiles) {
  $content = Get-Content $f.FullName -Raw
  if ($content -match "(?i)(password|secret|key|token)\s*=\s*[""']?[^""'\s]{8,}") {
    $exposedSecrets += $f.FullName
  }
}
if ($exposedSecrets.Count -eq 0) {
  Check "No secrets exposed in env files" { $true }
} else {
  foreach ($s in $exposedSecrets) {
    Write-Host "  WARN: Potential secrets in $s" -ForegroundColor Yellow
  }
  $script:warnings++
}

# --- Summary ---
if (-not $Quiet) {
  Write-Host "`n=== RESULTS ===" -ForegroundColor Cyan
  Write-Host "Passed : $passed" -ForegroundColor Green
  Write-Host "Failed : $failed" -ForegroundColor Red
  Write-Host "Warnings: $warnings" -ForegroundColor Yellow
}

if ($failed -gt 0) { exit 1 }
exit 0
