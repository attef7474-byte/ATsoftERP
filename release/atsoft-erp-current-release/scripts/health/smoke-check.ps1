param(
  [string]$BaseUrl = "http://localhost:4000/api/v1",
  [string]$WebUrl = "http://localhost:3000",
  [string]$Email = "admin@atsofterp.com",
  [string]$Password = "",
  [switch]$Quiet
)

if ([string]::IsNullOrEmpty($Password)) {
  $Password = Read-Host "Enter admin password"
}

$ErrorActionPreference = "Stop"
$passed = 0; $failed = 0

function Write-Step($msg) { if (-not $Quiet) { Write-Host "`n>> $msg" -ForegroundColor Cyan } }
function Write-Pass($msg) { if (-not $Quiet) { Write-Host "  PASS: $msg" -ForegroundColor Green }; $script:passed++ }
function Write-Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor Red; $script:failed++ }

if (-not $Quiet) { Write-Host "=== Smoke Check ===" -ForegroundColor Cyan }

# 1. Web homepage
Write-Step "Web: homepage"
try {
  $resp = Invoke-WebRequest -Uri $WebUrl -UseBasicParsing -TimeoutSec 10
  Write-Pass "Web returned $($resp.StatusCode) ($($resp.RawContentLength)B)"
} catch {
  Write-Fail "Web unreachable: $_"
}

# 2. Web login page
Write-Step "Web: login page"
try {
  $resp = Invoke-WebRequest -Uri "$WebUrl/login" -UseBasicParsing -TimeoutSec 10
  Write-Pass "Login page returned $($resp.StatusCode)"
} catch {
  Write-Fail "Login page unreachable: $_"
}

# 3. API login
Write-Step "API: login"
try {
  $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
  $loginResp = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
  if ($loginResp.accessToken) {
    Write-Pass "Login OK (token: ${($loginResp.accessToken).Substring(0,20)}...)"
  } else {
    Write-Fail "Login response missing accessToken"
  }
  $token = $loginResp.accessToken
  $authHeaders = @{ Authorization = "Bearer $token" }
} catch {
  Write-Fail "Login failed: $_"
  exit 1
}

# 4. API: users
Write-Step "API: GET /users"
try {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/users?page=1&limit=5" -Headers $authHeaders -UseBasicParsing
  Write-Pass "Users endpoint OK (data count: $($resp.data.Count))"
} catch {
  Write-Fail "Users endpoint: $_"
}

# 5. API: products
Write-Step "API: GET /products"
try {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/products?page=1&limit=5" -Headers $authHeaders -UseBasicParsing
  Write-Pass "Products endpoint OK (data count: $($resp.data.Count))"
} catch {
  Write-Fail "Products endpoint: $_"
}

# 6. API: roles
Write-Step "API: GET /roles"
try {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/roles" -Headers $authHeaders -UseBasicParsing
  Write-Pass "Roles endpoint OK (data count: $($resp.data.Count))"
} catch {
  Write-Fail "Roles endpoint: $_"
}

# 7. API: current user profile
Write-Step "API: GET /auth/me"
try {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/auth/me" -Headers $authHeaders -UseBasicParsing
  Write-Pass "Profile endpoint OK (email: $($resp.email))"
} catch {
  Write-Fail "Profile endpoint: $_"
}

# 8. API: Swagger docs
Write-Step "API: Swagger docs"
try {
  $resp = Invoke-WebRequest -Uri "http://localhost:4000/api/docs" -UseBasicParsing -TimeoutSec 10
  Write-Pass "Swagger docs returned $($resp.StatusCode)"
} catch {
  Write-Fail "Swagger docs: $_"
}

# Summary
Write-Step "--- SUMMARY ---"
Write-Host "Passed: $passed | Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -gt 0) { exit 1 }
exit 0
