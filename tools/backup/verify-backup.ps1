param(
  [string]$BackupFile,
  [string]$Server = "localhost:50079",
  [string]$User = "sa",
  [string]$Password = "",
  [switch]$Detailed,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

if (-not $BackupFile -or -not (Test-Path $BackupFile)) {
  Write-Host "ERROR: Provide a valid backup file path via -BackupFile." -ForegroundColor Red
  exit 1
}

if (-not $Password) {
  Write-Host "ERROR: Provide -Password (or set env SQL_SA_PASSWORD)." -ForegroundColor Red
  exit 1
}

function Write-Step { if (-not $Quiet) { Write-Host "  $msg" -ForegroundColor Cyan } }
function Write-Pass { if (-not $Quiet) { Write-Host "  PASS: $msg" -ForegroundColor Green } }
function Write-Fail { Write-Host "  FAIL: $msg" -ForegroundColor Red }

# Check 1 — File existence and size
if (-not $Quiet) { Write-Host "Checking backup file..." -ForegroundColor Cyan }
$fileInfo = Get-Item $BackupFile
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
if ($fileInfo.Length -eq 0) {
  Write-Fail "Backup file is empty."
  exit 1
}
Write-Pass "File exists, size: ${sizeMB}MB"

# Check 2 — RESTORE VERIFYONLY with CHECKSUM
if (-not $Quiet) { Write-Host "Running RESTORE VERIFYONLY with CHECKSUM..." -ForegroundColor Cyan }
$verifySql = "RESTORE VERIFYONLY FROM DISK = N'$BackupFile' WITH CHECKSUM;"
$verifyOut = sqlcmd -S $Server -U $User -P $Password -Q $verifySql 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Fail "VERIFYONLY failed: $verifyOut"
  exit 1
}
Write-Pass "VERIFYONLY passed (backup is readable and checksums match)"

# Check 3 — Header info
if (-not $Quiet) { Write-Host "Reading backup header..." -ForegroundColor Cyan }
$headerSql = "RESTORE HEADERONLY FROM DISK = N'$BackupFile';"
$headerOut = sqlcmd -S $Server -U $User -P $Password -Q $headerSql -h-1 -W 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Fail "HEADERONLY failed: $headerOut"
  exit 1
}
if (-not $Quiet) {
  $headerOut -split "`n" | ForEach-Object { Write-Host "  $_" }
}
Write-Pass "Header info readable"

# Check 4 — File list
if (-not $Quiet) { Write-Host "Reading file list..." -ForegroundColor Cyan }
$filelistSql = "RESTORE FILELISTONLY FROM DISK = N'$BackupFile';"
$filelistOut = sqlcmd -S $Server -U $User -P $Password -Q $filelistSql -h-1 -W 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Fail "FILELISTONLY failed: $filelistOut"
  exit 1
}
if (-not $Quiet) {
  $filelistOut -split "`n" | ForEach-Object { Write-Host "  $_" }
}
Write-Pass "File list readable"

# Summary
if (-not $Quiet) {
  Write-Host "`n=== VERIFICATION SUMMARY ===" -ForegroundColor Green
  Write-Host "File : $BackupFile"
  Write-Host "Size : ${sizeMB}MB"
  Write-Host "Status: VALID" -ForegroundColor Green
}

exit 0
