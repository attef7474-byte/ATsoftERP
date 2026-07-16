param(
  [string]$ServiceName = "ATsoftERP_Web",
  [string]$DeployPath = "C:\ATsoftERP\App\current",
  [string]$DisplayName = "ATsoftERP Web Server",
  [string]$Description = "Next.js web server for ATsoft ERP",
  [string]$NodePath = "",
  [string]$Username = "",
  [string]$Password = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $NodePath) { $NodePath = (Get-Command node).Source }

$webDir = Join-Path $DeployPath "web"
$entryPoint = Join-Path $webDir "node_modules\next\dist\bin\next"
$startCommand = "node node_modules\next\dist\bin\next start -p 3000"

if (-not (Test-Path $webDir)) {
  Write-Host "ERROR: Web directory not found: $webDir" -ForegroundColor Red
  exit 1
}

Write-Host "=== Install Web Service ===" -ForegroundColor Cyan
Write-Host "Service Name : $ServiceName"
Write-Host "Display Name : $DisplayName"
Write-Host "Node Path    : $NodePath"
Write-Host "Working Dir  : $webDir"

$binaryPath = "${NodePath} ${startCommand}"

if ($DryRun) {
  Write-Host "[DRY-RUN] Would create service with sc.exe:" -ForegroundColor Yellow
  Write-Host "  sc create $ServiceName binPath= `"$binaryPath`" start= auto DisplayName= `"$DisplayName`""
  Write-Host "  sc description $ServiceName `"$Description`""
  Write-Host "  sc failure $ServiceName reset= 86400 actions= restart/30000/restart/60000/restart/120000"
  exit 0
}

$createArgs = @(
  "create", $ServiceName
  "binPath=", $binaryPath
  "start=", "auto"
  "DisplayName=", $DisplayName
)
if ($Username) {
  $createArgs += "obj=", $Username
  $createArgs += "password=", $Password
}

$result = & sc.exe $createArgs 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to create service: $result" -ForegroundColor Red
  exit 1
}
Write-Host "Service created." -ForegroundColor Green

sc.exe description $ServiceName $Description 2>&1 | Out-Null
sc.exe failure $ServiceName reset= 86400 actions= restart/30000/restart/60000/restart/120000 2>&1 | Out-Null

Write-Host "Service '$ServiceName' installed successfully." -ForegroundColor Green
Write-Host "Start with: Start-Service $ServiceName" -ForegroundColor Gray
exit 0
