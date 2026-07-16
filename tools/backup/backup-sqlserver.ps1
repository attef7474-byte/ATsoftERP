param(
  [string]$ConfigPath = "$PSScriptRoot\backup-config.json",
  [string]$OutputDir = "",
  [string]$Server = "",
  [string]$Database = "",
  [string]$User = "",
  [string]$Password = "",
  [switch]$CopyOnly,
  [int]$RetentionDays = -1,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Load config ---
$cfg = @{}
if (Test-Path $ConfigPath) {
  $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json -AsHashtable
}

$server = if ($Server) { $Server } else { $cfg["server"] }
$database = if ($Database) { $Database } else { $cfg["database"] }
$user = if ($User) { $User } else { $cfg["user"] }
$pass = if ($Password) { $Password } else { $cfg["password"] }
$backupRoot = if ($OutputDir) { $OutputDir } else { $cfg["outputDir"] }
$retentionDays = if ($RetentionDays -ge 0) { $RetentionDays } else { $cfg["retentionDays"] }
$isCopyOnly = if ($CopyOnly) { $true } else { $cfg["copyOnly"] -eq $true }

if (-not $server -or -not $database -or -not $backupRoot) {
  Write-Host "ERROR: Missing required config. Provide -Server, -Database, -OutputDir or a config file." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "${database}_${timestamp}.bak"
$filepath = Join-Path $backupRoot $filename

$connStr = "Server=$server;Database=$database;"
if ($user) { $connStr += "User Id=$user;Password=$pass;" }
else { $connStr += "Integrated Security=True;" }
$connStr += "TrustServerCertificate=True;"

$copyOnlyFlag = if ($isCopyOnly) { ", COPY_ONLY" } else { "" }

$sql = @"
BACKUP DATABASE [$database]
TO DISK = N'$filepath'
WITH
  COMPRESSION,
  CHECKSUM,
  FORMAT,
  INIT,
  NAME = N'$database-Full Database Backup',
  DESCRIPTION = N'ATsoft ERP — Full backup taken at $timestamp'
  $copyOnlyFlag;
"@

$verifySql = "RESTORE VERIFYONLY FROM DISK = N'$filepath' WITH CHECKSUM;"

if ($DryRun) {
  Write-Host "[DRY-RUN]" -ForegroundColor Yellow
  Write-Host "Server : $server"
  Write-Host "Database: $database"
  Write-Host "Output : $filepath"
  Write-Host "CopyOnly: $isCopyOnly"
  Write-Host "SQL:" -NoNewline
  Write-Host $sql
  exit 0
}

Write-Host "Starting backup of [$database] on [$server]..." -ForegroundColor Cyan
Write-Host "Output: $filepath"

# Execute backup
$output = sqlcmd -S $server -U $user -P $pass -Q $sql 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "BACKUP FAILED: $output" -ForegroundColor Red
  exit 1
}
Write-Host "Backup completed successfully." -ForegroundColor Green

# Verify backup
Write-Host "Verifying backup with CHECKSUM..." -ForegroundColor Cyan
$verifyOut = sqlcmd -S $server -U $user -P $pass -Q $verifySql 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "VERIFY FAILED: $verifyOut" -ForegroundColor Red
  exit 1
}
Write-Host "Backup verified successfully." -ForegroundColor Green

# File info
$fileInfo = Get-Item $filepath
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
Write-Host "Backup size: ${sizeMB}MB"

# --- Retention cleanup ---
if ($retentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$retentionDays)
  $oldFiles = Get-ChildItem $backupRoot -Filter "${database}_*.bak" | Where-Object { $_.CreationTime -lt $cutoff }
  if ($oldFiles.Count -gt 0) {
    Write-Host "Cleaning $($oldFiles.Count) backup(s) older than $retentionDays day(s)..." -ForegroundColor Cyan
    foreach ($f in $oldFiles) {
      Remove-Item -Path $f.FullName -Force
      Write-Host "  Removed: $($f.Name)"
    }
  } else {
    Write-Host "No backups older than $retentionDays day(s) to clean." -ForegroundColor Gray
  }
}

# --- Metadata ---
$metadata = @{
  timestamp = $timestamp
  server = $server
  database = $database
  file = $filepath
  sizeMB = $sizeMB
  copyOnly = $isCopyOnly
  retentionDays = $retentionDays
} | ConvertTo-Json
$metaPath = "$filepath.meta.json"
$metadata | Set-Content $metaPath -Encoding UTF8
Write-Host "Metadata written: $metaPath"

Write-Host "Backup process completed successfully." -ForegroundColor Green
