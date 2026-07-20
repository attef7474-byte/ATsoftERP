param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json",
  [switch]$Api
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

$webUrl = if ($cfg["webBaseUrl"]) { $cfg["webBaseUrl"] } else { "http://localhost:3000" }
$apiUrl = if ($cfg["apiBaseUrl"]) { $cfg["apiBaseUrl"] } else { "http://localhost:4000" }

$target = if ($Api) { "$apiUrl/api/docs" } else { $webUrl }

Write-Host "Opening: $target" -ForegroundColor Cyan

try {
  Start-Process $target
  Write-Host "Browser opened." -ForegroundColor Green
} catch {
  Write-Host "WARN: Could not open browser. URL: $target" -ForegroundColor Yellow
}
