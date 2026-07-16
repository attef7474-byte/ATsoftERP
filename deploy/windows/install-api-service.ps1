param(
  [string]$ServiceName = "ATsoftERP_API",
  [string]$DeployPath = "C:\ATsoftERP\App\current",
  [string]$DisplayName = "ATsoftERP API Server",
  [string]$Description = "NestJS API server for ATsoft ERP",
  [string]$NodePath = "",
  [string]$Username = "",
  [string]$Password = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $NodePath) { $NodePath = (Get-Command node).Source }

$entryPoint = Join-Path $DeployPath "api\main.js"
$appDir = Join-Path $DeployPath "api"

if (-not (Test-Path $entryPoint)) {
  Write-Host "ERROR: Entry point not found: $entryPoint" -ForegroundColor Red
  Write-Host "Make sure -DeployPath points to a valid release with built API." -ForegroundColor Yellow
  exit 1
}

Write-Host "=== Install API Service ===" -ForegroundColor Cyan
Write-Host "Service Name : $ServiceName"
Write-Host "Display Name : $DisplayName"
Write-Host "Node Path    : $NodePath"
Write-Host "Entry Point  : $entryPoint"
Write-Host "Working Dir  : $appDir"

$binaryPath = "${NodePath} ${entryPoint}"

if ($DryRun) {
  Write-Host "[DRY-RUN] Would create service with sc.exe:" -ForegroundColor Yellow
  Write-Host "  sc create $ServiceName binPath= `"$binaryPath`" start= auto DisplayName= `"$DisplayName`""
  Write-Host "  sc description $ServiceName `"$Description`""
  Write-Host "  sc failure $ServiceName reset= 86400 actions= restart/30000/restart/60000/restart/120000"
  if ($Username) { Write-Host "  sc config $ServiceName obj= `"$Username`" password= `"****`"" }
  exit 0
}

# Create service using sc.exe
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

# Set description
sc.exe description $ServiceName $Description 2>&1 | Out-Null

# Set failure recovery (restart after 30s, 60s, 120s)
sc.exe failure $ServiceName reset= 86400 actions= restart/30000/restart/60000/restart/120000 2>&1 | Out-Null

Write-Host "Service '$ServiceName' installed successfully." -ForegroundColor Green
Write-Host "Start with: Start-Service $ServiceName" -ForegroundColor Gray
exit 0
