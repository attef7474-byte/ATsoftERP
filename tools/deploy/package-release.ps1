param(
  [string]$ReleaseDir,
  [string]$OutputDir = "",
  [string]$Version = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $ReleaseDir -or -not (Test-Path $ReleaseDir)) {
  Write-Host "ERROR: Provide a valid release directory via -ReleaseDir." -ForegroundColor Red
  exit 1
}

$releaseName = Split-Path $ReleaseDir -Leaf
if (-not $Version) { $Version = $releaseName }

if (-not $OutputDir) { $OutputDir = (Resolve-Path "$ReleaseDir/..") }

$zipName = "atsoft-erp-${Version}.zip"
$zipPath = Join-Path $OutputDir $zipName

Write-Host "=== PACKAGE RELEASE ===" -ForegroundColor Cyan
Write-Host "Release dir: $ReleaseDir"
Write-Host "Output zip : $zipPath"
Write-Host ""

if ($DryRun) {
  Write-Host "[DRY-RUN] Would create: $zipPath" -ForegroundColor Yellow
  exit 0
}

# Compress
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$ReleaseDir/*" -DestinationPath $zipPath -CompressionLevel Optimal

# SHA256
$shaFile = "${zipPath}.sha256"
$hash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
$hash | Set-Content $shaFile -Encoding UTF8
Write-Host "SHA256: $hash"

# Size
$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

# Generate manifest
$manifest = @{
  package = $zipName
  version = $Version
  sizeMB = $sizeMB
  sha256 = $hash
  generated = (Get-Date -Format "o")
} | ConvertTo-Json
$manifest | Set-Content (Join-Path $OutputDir "${zipName}.manifest.json") -Encoding UTF8

Write-Host "Package created: $zipPath (${sizeMB}MB)" -ForegroundColor Green
Write-Host "Manifest: ${zipName}.manifest.json" -ForegroundColor Green
exit 0
