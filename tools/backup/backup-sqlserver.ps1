param(
  [string]$ConfigPath = "$PSScriptRoot\backup-config.json",
  [string]$OutputDir = "",
  [string]$Server = "",
  [string]$Database = "",
  [string]$User = "",
  [string]$Password = "",
  [switch]$CopyOnly,
  [switch]$NoCompression,
  [int]$RetentionDays = -1,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function ConvertFrom-JsonToHashtable {
  param([string]$Path)
  $obj = Get-Content $Path -Raw | ConvertFrom-Json
  $ht = @{}
  $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
  return $ht
}

$cfg = @{}
if (Test-Path $ConfigPath) {
  $cfg = ConvertFrom-JsonToHashtable -Path $ConfigPath
}

$server = if ($Server) { $Server } else { $cfg["server"] }
$database = if ($Database) { $Database } else { $cfg["database"] }
$user = if ($User) { $User } else { $cfg["user"] }
$pass = if ($Password) { $Password } else { $cfg["password"] }
$backupRoot = if ($OutputDir) { $OutputDir } else { $cfg["outputDir"] }
$retentionDays = if ($RetentionDays -ge 0) { $RetentionDays } else { $cfg["retentionDays"] }
$isCopyOnly = if ($CopyOnly) { $true } else { $cfg["copyOnly"] -eq $true }
$compressionDisabled = if ($NoCompression) { $true } else { $cfg["noCompression"] -eq $true }

if (-not $server -or -not $database -or -not $backupRoot) {
  Write-Host "ERROR: Missing required config. Provide -Server, -Database, -OutputDir or a config file." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "${database}_${timestamp}.bak"
$filepath = Join-Path $backupRoot $filename

$copyOnlyFlag = if ($isCopyOnly) { ", COPY_ONLY" } else { "" }
$compressionOption = if (-not $compressionDisabled) { "COMPRESSION," } else { "" }

$sql = @"
BACKUP DATABASE [$database]
TO DISK = N'$filepath'
WITH
  $compressionOption
  CHECKSUM,
  FORMAT,
  INIT,
  NAME = N'$database-Full Database Backup',
  DESCRIPTION = N'ATsoft ERP — Full backup taken at $timestamp'
  $copyOnlyFlag;
"@

$verifySql = "RESTORE VERIFYONLY FROM DISK = N'$filepath' WITH CHECKSUM;"

$sqlcmdArgs = @("-S", $server, "-U", $user, "-P", $pass, "-b")

if ($DryRun) {
  Write-Host "[DRY-RUN]" -ForegroundColor Yellow
  Write-Host "Server : $server"
  Write-Host "Database: $database"
  Write-Host "Output : $filepath"
  Write-Host "CopyOnly: $isCopyOnly"
  Write-Host "Compression: $(if ($compressionDisabled) { 'OFF' } else { 'ON' })"
  Write-Host "SQL:" -NoNewline
  Write-Host $sql
  exit 0
}

Write-Host "Starting backup of [$database] on [$server]..." -ForegroundColor Cyan
Write-Host "Output: $filepath"
if ($compressionDisabled) { Write-Host "Compression disabled (Express Edition compat)" -ForegroundColor Yellow }

$output = & "sqlcmd" @sqlcmdArgs "-Q" $sql 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "BACKUP FAILED: $output" -ForegroundColor Red
  exit 1
}
Write-Host "Backup completed successfully." -ForegroundColor Green

Write-Host "Verifying backup with CHECKSUM..." -ForegroundColor Cyan
$verifyOut = & "sqlcmd" @sqlcmdArgs "-Q" $verifySql 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "VERIFY FAILED: $verifyOut" -ForegroundColor Red
  exit 1
}
Write-Host "Backup verified successfully." -ForegroundColor Green

if (-not (Test-Path $filepath)) {
  Write-Host "ERROR: Backup file not found at expected path: $filepath" -ForegroundColor Red
  Write-Host "Check SQL Server permissions and disk space." -ForegroundColor Yellow
  exit 1
}

$fileInfo = Get-Item $filepath
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
Write-Host "Backup size: ${sizeMB}MB"

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

$metadata = @{
  timestamp = $timestamp
  server = $server
  database = $database
  file = $filepath
  sizeMB = $sizeMB
  copyOnly = $isCopyOnly
  compression = (-not $compressionDisabled)
  retentionDays = $retentionDays
} | ConvertTo-Json
$metaPath = "$filepath.meta.json"
$metadata | Set-Content $metaPath -Encoding UTF8
Write-Host "Metadata written: $metaPath"

Write-Host "Backup process completed successfully." -ForegroundColor Green
