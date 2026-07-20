param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json"
)

$ErrorActionPreference = "Stop"

Write-Host "=== ATsoft ERP — Restart ===" -ForegroundColor Cyan

Write-Host "Stopping..." -ForegroundColor Cyan
& "$PSScriptRoot\atsofterp-stop.ps1"
Start-Sleep -Seconds 3

Write-Host "Starting..." -ForegroundColor Cyan
& "$PSScriptRoot\atsofterp-start.ps1"
