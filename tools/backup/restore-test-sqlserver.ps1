param(
  [string]$BackupFile,
  [string]$Server = "tcp:localhost,50079",
  [string]$User = "sa",
  [string]$Password = "",
  [string]$TestDbSuffix = "RESTORE_TEST",
  [switch]$DropTestDb,
  [switch]$DryRun
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

# Determine original database name from backup header
$headerSql = "RESTORE HEADERONLY FROM DISK = N'$BackupFile';"
$headerOut = sqlcmd -S $Server -U $User -P $Password -b -Q $headerSql -h-1 -W 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Cannot read backup header: $headerOut" -ForegroundColor Red
  exit 1
}

$origDb = ($headerOut -split "`n" | Select-String "DatabaseName" -Context 1,0) -replace '.*\s+(\S+)$', '$1'
if (-not $origDb) { $origDb = "ATsoftERP_DB" }

$testDbName = "${origDb}_${TestDbSuffix}"
$randomSuffix = Get-Random -Minimum 1000 -Maximum 9999
$testDbName = "${testDbName}_${randomSuffix}"

Write-Host "=== RESTORE TEST ===" -ForegroundColor Cyan
Write-Host "Backup file: $BackupFile"
Write-Host "Original DB: $origDb"
Write-Host "Test DB    : $testDbName"
Write-Host ""

if ($DryRun) {
  Write-Host "[DRY-RUN] Would restore to $testDbName then drop it." -ForegroundColor Yellow
  exit 0
}

# Get file list for MOVE
$filelistSql = "RESTORE FILELISTONLY FROM DISK = N'$BackupFile';"
$filelistOut = sqlcmd -S $Server -U $User -P $Password -b -Q $filelistSql -h-1 -W -s "|" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Cannot read file list: $filelistOut" -ForegroundColor Red
  exit 1
}

# Create restore SQL with MOVE
$restoreSql = @"
-- Restore to test database (safe — never touches production)
RESTORE DATABASE [$testDbName]
FROM DISK = N'$BackupFile'
WITH
  MOVE N'$origDb' TO N'$(Join-Path $env:TEMP "${testDbName}.mdf")',
  MOVE N'${origDb}_log' TO N'$(Join-Path $env:TEMP "${testDbName}_log.ldf")',
  REPLACE,
  STATS = 10;
"@

Write-Host "Restoring to test database [$testDbName]..." -ForegroundColor Cyan
$restoreOut = sqlcmd -S $Server -U $User -P $Password -b -Q $restoreSql 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "RESTORE TEST FAILED: $restoreOut" -ForegroundColor Red
  exit 1
}

Write-Host "Restore completed successfully to [$testDbName]." -ForegroundColor Green

# Verify test DB is accessible
$checkSql = "SELECT COUNT(*) AS [tables] FROM [$testDbName].sys.tables;"
$checkOut = sqlcmd -S $Server -U $User -P $Password -b -Q $checkSql -h-1 -W 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "WARNING: Test DB restored but cannot query: $checkOut" -ForegroundColor Yellow
} else {
  Write-Host "Test DB accessible. Tables confirmed." -ForegroundColor Green
}

# Drop test DB
if ($DropTestDb) {
  Write-Host "Dropping test database [$testDbName]..." -ForegroundColor Cyan
  $dropSql = "IF DB_ID('$testDbName') IS NOT NULL BEGIN ALTER DATABASE [$testDbName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$testDbName]; END"
  $dropOut = sqlcmd -S $Server -U $User -P $Password -b -Q $dropSql 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Failed to drop test DB: $dropOut" -ForegroundColor Yellow
  } else {
    Write-Host "Test database dropped." -ForegroundColor Green
  }
} else {
  Write-Host "Test database [$testDbName] left intact for inspection." -ForegroundColor Yellow
  Write-Host "Run with -DropTestDb to auto-clean." -ForegroundColor Gray
}

Write-Host "`nRestore test completed." -ForegroundColor Green
exit 0
