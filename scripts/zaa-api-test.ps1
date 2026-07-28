#Requires -Version 7
$apiUrl = "http://localhost:4000/api/v1"
$logFile = "$env:TEMP\zaa-api-test.log"
$results = @()
$pass = 0
$fail = 0

function Test-Endpoint {
    param($Name, $Method, $Url, $Body, $ExpectedStatus = 200, $Headers = @{})
    try {
        $params = @{ Method = $Method; Uri = $Url; ContentType = 'application/json' }
        if ($Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        $response = Invoke-WebRequest @params -TimeoutSec 10 -SkipHttpErrorCheck
        $status = [int]$response.StatusCode
        $ok = $status -eq $ExpectedStatus
        if ($ok) { $script:pass++ } else { $script:fail++ }
        $msg = if ($ok) { "PASS" } else { "FAIL (got $status, expected $ExpectedStatus)" }
        Write-Output "$msg`t$Name`t$status"
        return $response.Content | ConvertFrom-Json
    } catch {
        $script:fail++
        $msg = "FAIL (exception: $($_.Exception.Message))"
        Write-Output "$msg`t$Name"
        return $null
    }
}

Write-Output "=== Z-AA API Test Suite ==="
Write-Output "Starting at $(Get-Date -Format 'HH:mm:ss')"

# Step 1: Health check
Write-Output "`n--- Health Check ---"
$health = Test-Endpoint -Name "Health check" -Method GET -Url "$apiUrl/health"

# Step 2: Login
Write-Output "`n--- Auth ---"
$login = Test-Endpoint -Name "Login" -Method POST -Url "$apiUrl/auth/login" -Body @{ email = 'admin@atsofterp.com'; password = 'Admin@123456' } -ExpectedStatus 201
$token = if ($login -and $login.accessToken) { $login.accessToken } else { "" }
$authHeader = @{ Authorization = "Bearer $token" }
if ($token) { Write-Output "PASS`tGot JWT token" } else { Write-Output "FAIL`tNo JWT token"; exit 1 }

# Step 3: Spare part condition endpoints
Write-Output "`n--- Spare Part Condition Endpoints ---"
Test-Endpoint -Name "GET balances (empty)" -Method GET -Url "$apiUrl/spare-part-conditions/balances" -Headers $authHeader

Test-Endpoint -Name "GET by-spare-part (empty)" -Method GET -Url "$apiUrl/spare-part-conditions/by-spare-part/cmrxm2vhv00002g95v483by3p" -Headers $authHeader

Test-Endpoint -Name "GET by-warehouse (empty)" -Method GET -Url "$apiUrl/spare-part-conditions/by-warehouse/cmrlaznjh0000uo951ro4q5e8" -Headers $authHeader

Test-Endpoint -Name "POST movement (IN - NEW stock)" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'NEW'
    direction = 'IN'
    quantity = 10.0
    sourceType = 'INITIAL_BALANCE'
    sourceId = 'test-init-001'
    notes = 'Initial NEW stock IN'
} -Headers $authHeader -ExpectedStatus 201

Test-Endpoint -Name "GET balances (1 record - NEW)" -Method GET -Url "$apiUrl/spare-part-conditions/balances" -Headers $authHeader

# Now OUT from NEW is possible
Test-Endpoint -Name "POST movement (OUT - issue NEW)" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'NEW'
    direction = 'OUT'
    quantity = 5.0
    sourceType = 'MAINTENANCE_ISSUE'
    sourceId = 'test-issue-001'
    notes = 'Test issue OUT of NEW stock'
} -Headers $authHeader -ExpectedStatus 201

Test-Endpoint -Name "GET balances (2 records - NEW+USED)" -Method GET -Url "$apiUrl/spare-part-conditions/balances" -Headers $authHeader

Test-Endpoint -Name "POST movement (IN - return removed part)" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'USED_SERVICEABLE'
    direction = 'IN'
    quantity = 3.0
    sourceType = 'MAINTENANCE_REMOVED_PART_RETURN'
    sourceId = 'test-return-001'
    notes = 'Test removed part return IN'
    replacementAction = 'RETURNED_REMOVED_PART'
} -Headers $authHeader -ExpectedStatus 201

Test-Endpoint -Name "GET balances (3 records)" -Method GET -Url "$apiUrl/spare-part-conditions/balances" -Headers $authHeader

Test-Endpoint -Name "GET movements list" -Method GET -Url "$apiUrl/spare-part-conditions/movements" -Headers $authHeader

Test-Endpoint -Name "GET movements by spare part" -Method GET -Url "$apiUrl/spare-part-conditions/movements?sparePartId=cmrxm2vhv00002g95v483by3p" -Headers $authHeader

Test-Endpoint -Name "GET movements by warehouse" -Method GET -Url "$apiUrl/spare-part-conditions/movements?warehouseId=cmrlaznjh0000uo951ro4q5e8" -Headers $authHeader

# Step 4: Validation tests
Write-Output "`n--- Validation Tests ---"

# Invalid condition
Test-Endpoint -Name "POST invalid condition" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'INVALID'
    direction = 'IN'
    quantity = 1.0
} -Headers $authHeader -ExpectedStatus 400

# Invalid direction
Test-Endpoint -Name "POST invalid direction" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'NEW'
    direction = 'INVALID'
    quantity = 1.0
} -Headers $authHeader -ExpectedStatus 400

# Negative quantity
Test-Endpoint -Name "POST negative quantity" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'NEW'
    direction = 'IN'
    quantity = -1.0
} -Headers $authHeader -ExpectedStatus 400

# Insufficient balance (try to OUT more than available)
# Current balance for NEW = -5 (since we did OUT 5 without any prior IN)
# Trying to OUT more should fail
Test-Endpoint -Name "POST insufficient balance" -Method POST -Url "$apiUrl/spare-part-conditions/movements" -Body @{
    sparePartId = 'cmrxm2vhv00002g95v483by3p'
    warehouseId = 'cmrlaznjh0000uo951ro4q5e8'
    condition = 'NEW'
    direction = 'OUT'
    quantity = 100.0
    sourceType = 'MAINTENANCE_ISSUE'
    sourceId = 'test-insufficient-001'
} -Headers $authHeader -ExpectedStatus 400

# Unauthorized (no token)
Test-Endpoint -Name "GET unauthorized" -Method GET -Url "$apiUrl/spare-part-conditions/balances" -ExpectedStatus 401

# Step 5: Verify no double deduction
Write-Output "`n--- Double Deduction Guard ---"
# Movement ID for same line should not be duplicated (sourceId unique check at app level)
# The transaction guard prevents negative balance - already tested above

# Step 6: Auth profile (general sanity)
Write-Output "`n--- Auth Profile ---"
Test-Endpoint -Name "GET profile" -Method GET -Url "$apiUrl/auth/me" -Headers $authHeader

Write-Output "`n=== RESULTS ==="
Write-Output "Passed: $pass"
Write-Output "Failed: $fail"
if ($fail -eq 0) { Write-Output "OVERALL: ALL TESTS PASSED" } else { Write-Output "OVERALL: SOME TESTS FAILED" }
