param(
  [string]$BackupDir,
  [string]$Database = "ATsoftERP_DB",
  [int]$RetentionDays = 14,
  [string]$Pattern = "*.bak",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $BackupDir -or -not (Test-Path $BackupDir)) {
  Write-Host "ERROR: Provide a valid backup directory via -BackupDir." -ForegroundColor Red
  exit 1
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
$files = Get-ChildItem $BackupDir -Filter $Pattern -File | Where-Object { $_.CreationTime -lt $cutoff }

Write-Host "=== BACKUP CLEANUP ===" -ForegroundColor Cyan
Write-Host "Directory    : $BackupDir"
Write-Host "Pattern      : $Pattern"
Write-Host "Retention    : $RetentionDays day(s)"
Write-Host "Cutoff date  : $($cutoff.ToString('yyyy-MM-dd HH:mm'))"
Write-Host "Files found  : $($files.Count)"
if ($DryRun) { Write-Host "Mode         : DRY-RUN (no files will be deleted)" -ForegroundColor Yellow }
Write-Host ""

if ($files.Count -eq 0) {
  Write-Host "No files older than $RetentionDays day(s) to clean." -ForegroundColor Green
  exit 0
}

$totalSize = 0
foreach ($f in $files | Sort-Object CreationTime) {
  $ageDays = [math]::Round(((Get-Date) - $f.CreationTime).TotalDays, 1)
  $sizeMB = [math]::Round($f.Length / 1MB, 2)
  $totalSize += $f.Length
  if ($DryRun) {
    Write-Host "[DRY-RUN] Would delete: $($f.Name) (${ageDays}d old, ${sizeMB}MB)" -ForegroundColor Yellow
  } else {
    Remove-Item -Path $f.FullName -Force
    Write-Host "Deleted: $($f.Name) (${ageDays}d old, ${sizeMB}MB)" -ForegroundColor Red
  }
}

$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
if ($DryRun) {
  Write-Host "`n[DRY-RUN] Would free ${totalSizeMB}MB across $($files.Count) file(s)." -ForegroundColor Yellow
  Write-Host "Re-run without -DryRun to execute." -ForegroundColor Gray
} else {
  Write-Host "`nFreed ${totalSizeMB}MB across $($files.Count) file(s)." -ForegroundColor Green
}

exit 0
