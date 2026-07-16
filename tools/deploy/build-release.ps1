param(
  [string]$RootDir = (Resolve-Path "$PSScriptRoot/../.."),
  [string]$OutputDir = "",
  [string]$Version = "",
  [switch]$SkipBuild,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not $Version) {
  $commitHash = (git -C $RootDir rev-parse --short HEAD 2>$null) ? "g$(git -C $RootDir rev-parse --short HEAD)" : "local"
  $Version = "1.0.0-${timestamp}-${commitHash}"
}

if (-not $OutputDir) { $OutputDir = Join-Path $RootDir "releases\$Version" }

Write-Host "=== BUILD RELEASE ===" -ForegroundColor Cyan
Write-Host "Version : $Version"
Write-Host "Output  : $OutputDir"
Write-Host ""

if ($DryRun) {
  Write-Host "[DRY-RUN] Would build and stage release to: $OutputDir" -ForegroundColor Yellow
  exit 0
}

# Create output structure
@(
  "api",
  "web",
  "scripts",
  "prisma"
) | ForEach-Object {
  New-Item -ItemType Directory -Path (Join-Path $OutputDir $_) -Force | Out-Null
}

# --- Build API ---
if (-not $SkipBuild) {
  Write-Host "Building API..." -ForegroundColor Cyan
  Push-Location "$RootDir/apps/api"
  $out = npm run build 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Host "API build failed: $out" -ForegroundColor Red; exit 1 }
  Pop-Location
  Write-Host "API build OK." -ForegroundColor Green

  Write-Host "Building Web..." -ForegroundColor Cyan
  Push-Location "$RootDir/apps/web"
  $out = npm run build 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Host "Web build failed: $out" -ForegroundColor Red; exit 1 }
  Pop-Location
  Write-Host "Web build OK." -ForegroundColor Green
}

# --- Stage files ---
Write-Host "Staging release files..." -ForegroundColor Cyan

# API
Copy-Item "$RootDir/apps/api/dist/*" (Join-Path $OutputDir "api") -Recurse -Force
Copy-Item "$RootDir/apps/api/package.json" (Join-Path $OutputDir "api") -Force
Copy-Item "$RootDir/apps/api/.env" (Join-Path $OutputDir "api\.env.example") -Force
Copy-Item "$RootDir/apps/api/prisma/schema.prisma" (Join-Path $OutputDir "prisma") -Force

# Web
Copy-Item "$RootDir/apps/web/.next/*" (Join-Path $OutputDir "web\.next") -Recurse -Force
Copy-Item "$RootDir/apps/web/package.json" (Join-Path $OutputDir "web") -Force
Copy-Item "$RootDir/apps/web/public/*" (Join-Path $OutputDir "web\public") -Recurse -Force
Copy-Item "$RootDir/apps/web/next.config.mjs" (Join-Path $OutputDir "web") -Force
Copy-Item "$RootDir/apps/web/.env.local" (Join-Path $OutputDir "web\.env.example") -Force

# Scripts
Copy-Item "$RootDir/scripts/*" (Join-Path $OutputDir "scripts") -Recurse -Force

# Root package files
Copy-Item "$RootDir/package.json" (Join-Path $OutputDir "package.json") -Force
Copy-Item "$RootDir/package-lock.json" (Join-Path $OutputDir "package-lock.json") -Force

# --- Generate version manifest ---
$manifest = @{
  version = $Version
  timestamp = (Get-Date -Format "o")
  commit = (git -C $RootDir rev-parse HEAD 2>$null)
  branch = (git -C $RootDir rev-parse --abbrev-ref HEAD 2>$null)
  node = (node --version)
  npm = (npm --version)
} | ConvertTo-Json
$manifest | Set-Content (Join-Path $OutputDir "release-manifest.json") -Encoding UTF8

Write-Host "Release staged to: $OutputDir" -ForegroundColor Green
Write-Host "Manifest written." -ForegroundColor Green
exit 0
