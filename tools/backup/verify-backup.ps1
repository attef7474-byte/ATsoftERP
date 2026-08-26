param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ConfigPath = "C:\ATsoftERP\Config\backup-credentials.json",
  [string]$Server = "",
  [string]$EvidenceFile = "",
  [switch]$Detailed,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Write-Pass {
  param([string]$Message)
  if (-not $Quiet) { Write-Host "PASS: $Message" -ForegroundColor Green }
}

function Stop-Verification {
  param([string]$Code)
  Write-Host "BACKUP_VERIFICATION=FAIL CODE=$Code" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
  Stop-Verification "BACKUP_FILE_NOT_FOUND"
}

$fileInfo = Get-Item -LiteralPath $BackupFile
if ($fileInfo.Length -le 0) {
  Stop-Verification "BACKUP_FILE_EMPTY"
}

$config = $null
if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
  try {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  } catch {
    Stop-Verification "BACKUP_CONFIG_INVALID"
  }
}

$resolvedServer = if ($Server) {
  $Server
} elseif ($config -and $config.server) {
  [string]$config.server
} else {
  "tcp:localhost,50079"
}

$verifySql = "RESTORE VERIFYONLY FROM DISK = N'$($fileInfo.FullName)' WITH CHECKSUM;"
$verifyOut = sqlcmd -S $resolvedServer -E -b -Q $verifySql 2>&1
if ($LASTEXITCODE -ne 0) {
  Stop-Verification "RESTORE_VERIFYONLY_FAILED"
}
Write-Pass "RESTORE VERIFYONLY WITH CHECKSUM passed"

$headerSql = "RESTORE HEADERONLY FROM DISK = N'$($fileInfo.FullName)';"
$headerOut = sqlcmd -S $resolvedServer -E -b -Q $headerSql -h-1 -W 2>&1
if ($LASTEXITCODE -ne 0) {
  Stop-Verification "RESTORE_HEADERONLY_FAILED"
}
Write-Pass "RESTORE HEADERONLY passed"

$filelistSql = "RESTORE FILELISTONLY FROM DISK = N'$($fileInfo.FullName)';"
$filelistOut = sqlcmd -S $resolvedServer -E -b -Q $filelistSql -h-1 -W 2>&1
if ($LASTEXITCODE -ne 0) {
  Stop-Verification "RESTORE_FILELISTONLY_FAILED"
}
Write-Pass "RESTORE FILELISTONLY passed"

$evidence = [ordered]@{
  status = "PASS"
  method = "RESTORE VERIFYONLY WITH CHECKSUM"
  backupPath = $fileInfo.FullName
  backupLengthBytes = $fileInfo.Length
  backupLastWriteUtc = $fileInfo.LastWriteTimeUtc.ToString("o")
  verifiedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}

if ($EvidenceFile) {
  $parent = Split-Path -Parent $EvidenceFile
  if ($parent -and -not (Test-Path -LiteralPath $parent -PathType Container)) {
    Stop-Verification "EVIDENCE_DIRECTORY_NOT_FOUND"
  }
  $evidence | ConvertTo-Json | Set-Content -LiteralPath $EvidenceFile -Encoding ASCII
}

Write-Host "BACKUP_VERIFICATION=PASS"
exit 0
