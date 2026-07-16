param(
  [string]$BaseUrl = "http://localhost:4000/api/v1",
  [string]$Email = "admin@atsofterp.com",
  [string]$Password = "Admin@123456",
  [int]$ThresholdMs = 3000,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$results = @()
$passed = 0
$failed = 0

function Write-Step($msg) { if (-not $Quiet) { Write-Host "`n>> $msg" -ForegroundColor Cyan } }
function Write-Pass($msg) { if (-not $Quiet) { Write-Host "  PASS: $msg" -ForegroundColor Green }; $script:passed++ }
function Write-Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red; $script:failed++ }

function Measure-Endpoint($name, $method, $url, $body, $headers) {
  try {
    $params = @{ Uri = $url; Method = $method; UseBasicParsing = $true }
    if ($headers) { $params.Headers = $headers }
    if ($body) { $params.Body = $body; $params.ContentType = "application/json" }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-WebRequest @params
    $sw.Stop()
    $ms = $sw.ElapsedMilliseconds
    $size = $resp.RawContentLength
    $code = $resp.StatusCode
    $ok = $code -eq 200 -and $ms -lt $ThresholdMs
    $msg = "$name — ${code} | ${ms}ms | ${size}B"
    if ($ok) { Write-Pass $msg } else { Write-Fail "$msg (exceeds ${ThresholdMs}ms or bad status)" }
    return @{ name = $name; code = $code; ms = $ms; size = $size; ok = $ok }
  } catch {
    $ms = -1
    Write-Fail "$name — EXCEPTION: $_"
    return @{ name = $name; code = 0; ms = $ms; size = 0; ok = $false }
  }
}

# --- Auth ---
Write-Step "Authenticating"
$login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" `
  -Body (@{ email = $Email; password = $Password } | ConvertTo-Json) -UseBasicParsing
$token = $login.accessToken
$authHeaders = @{ Authorization = "Bearer $token" }
Write-Pass "Login OK (token length: $($token.Length))"

# --- Endpoints ---
$endpointTests = @(
  @{ name = "GET /users"; method = "GET"; url = "$BaseUrl/users?page=1&limit=10" },
  @{ name = "GET /products"; method = "GET"; url = "$BaseUrl/products?page=1&limit=10" },
  @{ name = "GET /roles"; method = "GET"; url = "$BaseUrl/roles" },
  @{ name = "GET /permissions/matrix"; method = "GET"; url = "$BaseUrl/permissions/matrix" },
  @{ name = "GET /companies"; method = "GET"; url = "$BaseUrl/companies" }
)

Write-Step "Testing core endpoints"
foreach ($t in $endpointTests) {
  $r = Measure-Endpoint $t.name $t.method $t.url $null $authHeaders
  $results += $r
}

# --- Reports (without extra query params to avoid DTO rejection) ---
$reportTests = @(
  @{ name = "GET /reports/maintenance/overview"; method = "GET"; url = "$BaseUrl/reports/maintenance/overview" },
  @{ name = "GET /reports/inventory/overview"; method = "GET"; url = "$BaseUrl/reports/inventory/overview" }
)

Write-Step "Testing report endpoints"
foreach ($t in $reportTests) {
  $r = Measure-Endpoint $t.name $t.method $t.url $null $authHeaders
  $results += $r
}

# --- Summary ---
Write-Step "--- SUMMARY ---"
Write-Host "Passed: $passed | Failed: $failed | Total: $($results.Count)" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($results.Count -gt 0) {
  $avgMs = ($results | Where-Object { $_.ms -ge 0 } | Measure-Object ms -Average).Average
  Write-Host "Average response time: $([math]::Round($avgMs, 1))ms"
  $maxMs = ($results | Measure-Object ms -Maximum).Maximum
  Write-Host "Max response time: ${maxMs}ms"
  $totalSize = ($results | Measure-Object size -Sum).Sum
  Write-Host "Total payload: $([math]::Round($totalSize / 1024, 1))KB"
}

if ($failed -gt 0) { exit 1 }
