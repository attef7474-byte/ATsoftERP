param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json",
  [string]$Server = "tcp:localhost,50079",
  [string]$Database = "ATsoftERP_DB",
  [string]$User = "atsofterp_app",
  [string]$Password = "",
  [string]$BackupDir = "",
  [switch]$CopyOnly,
  [switch]$NoCompression,
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

if (-not $BackupDir) { $BackupDir = if ($cfg["backupRoot"]) { $cfg["backupRoot"] } else { "C:\ATsoftERP\Backups" } }

# Prompt for password if not provided
if (-not $Password) {
  $secPwd = Read-Host -Prompt "Enter SQL Server password for user '$User'" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPwd)
  $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

Write-Host "=== ATsoft ERP — Backup Now ===" -ForegroundColor Cyan

$backupScript = "$PSScriptRoot\..\backup\backup-sqlserver.ps1"
if (-not (Test-Path $backupScript)) {
  Write-Host "ERROR: Backup script not found: $backupScript" -ForegroundColor Red
  exit 1
}

$params = @{
  Server = $Server
  Database = $Database
  User = $User
  Password = $Password
  OutputDir = $BackupDir
  CopyOnly = $CopyOnly
  NoCompression = $NoCompression
  DryRun = $DryRun
}

& $backupScript @params

if ($LASTEXITCODE -ne 0) {
  Write-Host "Backup failed." -ForegroundColor Red
  exit 1
}

# Verify backup
Write-Host "`nVerifying backup..." -ForegroundColor Cyan
$latestBak = Get-ChildItem $BackupDir -Filter "*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if ($latestBak -and -not $DryRun) {
  & "$PSScriptRoot\..\backup\verify-backup.ps1" -BackupFile $latestBak -Server $Server -User $User -Password $Password -Quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup verified: $latestBak" -ForegroundColor Green
  } else {
    Write-Host "WARN: Backup verification had issues." -ForegroundColor Yellow
  }
}

Write-Host "`nBackup complete." -ForegroundColor Green
