$ErrorActionPreference = 'Continue'
$base = 'http://localhost:4000/api/v1'
if ([string]::IsNullOrEmpty($env:SEED_ADMIN_EMAIL)) { throw 'SEED_ADMIN_EMAIL environment variable is required' }
if ([string]::IsNullOrEmpty($env:SEED_ADMIN_PASSWORD)) { throw 'SEED_ADMIN_PASSWORD environment variable is required' }

Write-Output "=== UX-1B-2D Maintenance Analytics KPIs / Dashboard Runtime Proof ==="
Write-Output ("Started: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

# ── Auth ──────────────────────────────────────────────────────────────
$login = Invoke-RestMethod -Method Post -Uri ($base + '/auth/login') -ContentType 'application/json' -Body (@{ email = $env:SEED_ADMIN_EMAIL; password = $env:SEED_ADMIN_PASSWORD } | ConvertTo-Json)
$t = $login.accessToken
Write-Output ("LOGIN_OK token=" + $t.Substring(0, 20) + "...")

$ctxs = (Invoke-RestMethod -Method Get -Uri ($base + '/auth/contexts') -Headers @{ Authorization = "Bearer $t" }).contexts

# Tenant A = COM-000001 / HQ, Tenant B = QA_CORP / QA_BRN
$ctxA = $ctxs | Where-Object { $_.companyCode -eq 'COM-000001' } | Select-Object -First 1
$ctxB = $ctxs | Where-Object { $_.companyCode -eq 'QA_CORP' } | Select-Object -First 1
if (-not $ctxA -or -not $ctxB) { Write-Output "PROBE_ABORT: could not find tenant A or tenant B contexts"; exit 1 }

function Hdrs($companyId, $branchId) {
  return @{ Authorization = "Bearer $t"; 'x-active-company-id' = $companyId; 'x-active-branch-id' = $branchId }
}

$script:results = @()
function Check($label, $method, $path, $companyId, $branchId, $expectedOk = $true) {
  try {
    $r = Invoke-WebRequest -Method $method -Uri ($base + $path) -Headers (Hdrs $companyId $branchId) -UseBasicParsing -SkipHttpErrorCheck -TimeoutSec 30
    $ok = if ($expectedOk) { $r.StatusCode -lt 300 } else { $r.StatusCode -ge 400 }
    $script:results += [PSCustomObject]@{ Label = $label; Status = $r.StatusCode; Path = $path; Pass = $ok }
    Write-Output ("[" + $(if ($ok) { 'PASS' } else { 'FAIL' }) + "] HTTP " + $r.StatusCode + "  " + $label)
    Write-Output ("       " + $path)
    return $r
  } catch {
    $script:results += [PSCustomObject]@{ Label = $label; Status = -1; Path = $path; Pass = $false }
    Write-Output ("[FAIL] ERROR  " + $label + " -> " + $_.Exception.Message)
    Write-Output ("       " + $path)
    return $null
  }
}

function Summary($json) {
  if (-not $json) { return 'null' }
  $keys = $json.PSObject.Properties.Name | Select-Object -First 6
  return ($keys | ForEach-Object { "$_=$($json.$_)" }) -join ', '
}

# ── Machines per tenant ───────────────────────────────────────────────
function ListMachines($companyId, $branchId, $label) {
  try {
    $r = Invoke-WebRequest -Method Get -Uri ($base + '/maintenance/machines?page=1&pageSize=100') -Headers (Hdrs $companyId $branchId) -UseBasicParsing -TimeoutSec 30
    $j = $r.Content | ConvertFrom-Json
    $items = @($j.data)
    Write-Host ("MACHINES[" + $label + "]=" + $items.Count)
    return ,$items
  } catch {
    Write-Host ("MACHINES[" + $label + "]=ERROR " + $_.Exception.Message)
    return @()
  }
}

$mA = ListMachines $ctxA.companyId $ctxA.branchId 'A'
$mB = ListMachines $ctxB.companyId $ctxB.branchId 'B'
$mAid = if ($mA.Count -gt 0) { $mA[0].id } else { $null }
$mBid = if ($mB.Count -gt 0) { $mB[0].id } else { $null }
Write-Output ("PROBE machines: A=" + $mA.Count + " B=" + $mB.Count)
if (-not $mAid) { Write-Output "PROBE_ABORT: tenant A has no machines to run scoped proofs"; exit 1 }

# ── 1. Dashboard summary (tenant A) ───────────────────────────────────
$r = Check 'dashboard summary' 'Get' '/maintenance/dashboard/summary' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       summary: open=$($j.openRequests) critical=$($j.criticalRequests) cost=$($j.totalCost) mttr=$($j.reliability.mttr) mtbf=$($j.reliability.mtbf) downtime=$($j.reliability.totalDowntimeHours)") }

# ── 2. Reliability KPIs (tenant A) ────────────────────────────────────
$r = Check 'reliability mttr' 'Get' '/maintenance/reliability/mttr?days=365' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       mttrHours=" + $j.mttrHours + " events=" + $j.totalEvents) }
$r = Check 'reliability mtbf' 'Get' '/maintenance/reliability/mtbf?days=365' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       mtbfHours=" + $j.mtbfHours + " events=" + $j.totalEvents) }
$r = Check 'reliability total-downtime' 'Get' '/maintenance/reliability/total-downtime?days=365' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       totalHours=" + $j.totalHours + " events=" + $j.totalEvents) }
$r = Check 'reliability repeat-failure-rate' 'Get' '/maintenance/reliability/repeat-failure-rate?days=365' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       repeatRate=" + $j.repeatFailureRate + " total=" + $j.totalEvents) }
$r = Check 'reliability availability' 'Get' ('/maintenance/reliability/availability?dateFrom=' + (Get-Date '2026-01-01').ToString('yyyy-MM-dd') + '&dateTo=' + (Get-Date).ToString('yyyy-MM-dd')) $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       availability=" + $j.availabilityPercent + " downtimeH=" + $j.downtimeHours) }

# ── 3. Cost analytics ─────────────────────────────────────────────────
$r = Check 'reports maintenance costs/analysis' 'Get' '/reports/maintenance/costs/analysis' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       totalCost=" + $j.executiveSummary.totalCost + " machines=" + $j.executiveSummary.totalMachines + " byMachineRows=" + @($j.costByMachine).Count) }
$r = Check 'dashboard cost-kpis' 'Get' '/maintenance/dashboard/cost-kpis' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       totalCost=" + $j.totalCost + " monthly=" + $j.monthlyCost + " top=" + @($j.topRequestsByCost).Count) }

# ── 4. Reports ────────────────────────────────────────────────────────
$r = Check 'reports maintenance requests' 'Get' '/reports/maintenance/requests?page=1&pageSize=5' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       total=" + $j.total + " rows=" + @($j.rows).Count) }
$r = Check 'reports kpi-overview' 'Get' '/reports/maintenance/kpi-overview' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       cards=" + @($j.cards).Count) }
$r = Check 'reports backlog-trend' 'Get' '/reports/maintenance/backlog-trend' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       backlogByMonth=" + @($j.backlogByMonth).Count) }
$r = Check 'reports schedule-compliance' 'Get' '/reports/maintenance/schedule-compliance' $ctxA.companyId $ctxA.branchId
if ($r) { $j = $r.Content | ConvertFrom-Json; Write-Output ("       cards=" + @($j.cards).Count) }

# ── 5. Exports ────────────────────────────────────────────────────────
$r = Check 'export CSV requests' 'Get' '/reports/export/csv/maintenance/requests?page=1&pageSize=5' $ctxA.companyId $ctxA.branchId
if ($r -and $r.Content) { Write-Output ("       csv bytes=" + $r.RawContentLength + " head=" + $r.Content.Substring(0, [Math]::Min(80, $r.Content.Length)).Replace("`n", ' ')) }
$r = Check 'export Excel requests' 'Get' '/reports/export/excel/maintenance/requests?page=1&pageSize=5' $ctxA.companyId $ctxA.branchId
if ($r) { Write-Output ("       excel bytes=" + $r.RawContentLength) }

# ── 6. Tenant isolation ───────────────────────────────────────────────
# Tenant B attempts to access tenant A's machine by ID -> must be rejected (404)
if ($mAid) {
  $r = Check 'B reads machine by A id' 'Get' ('/maintenance/machines/' + $mAid) $ctxB.companyId $ctxB.branchId $false
  if ($r) { Write-Output ("       body=" + $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)).Replace("`n", ' ')) }
  $r = Check 'B filters by A machine (dashboard open-requests)' 'Get' ('/maintenance/dashboard/open-requests?machineId=' + $mAid) $ctxB.companyId $ctxB.branchId $false
  if ($r) { Write-Output ("       body=" + $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)).Replace("`n", ' ')) }
  $r = Check 'B filters by A machine (reliability mttr)' 'Get' ('/maintenance/reliability/mttr?machineId=' + $mAid) $ctxB.companyId $ctxB.branchId $false
  if ($r) { Write-Output ("       body=" + $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)).Replace("`n", ' ')) }
  $r = Check 'B filters by A machine (reports requests)' 'Get' ('/reports/maintenance/requests?machineId=' + $mAid) $ctxB.companyId $ctxB.branchId $false
  if ($r) { Write-Output ("       body=" + $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)).Replace("`n", ' ')) }
}
# Tenant B's own machine list must not contain tenant A machines
if ($mAid) {
  $bIds = @($mB | ForEach-Object { $_.id })
  $leak = $bIds -contains $mAid
  $script:results += [PSCustomObject]@{ Label = 'machine cross-tenant leak check'; Status = $(if ($leak) { 500 } else { 200 }); Path = 'tenant B machine list'; Pass = (-not $leak) }
  Write-Output ("[" + $(if (-not $leak) { 'PASS' } else { 'FAIL' }) + "] tenant B machine list must not contain tenant A machines (leak=" + $leak + ")")
}

# ── Summary ───────────────────────────────────────────────────────────
$pass = @($script:results | Where-Object { $_.Pass }).Count
$fail = @($script:results | Where-Object { -not $_.Pass }).Count
Write-Output ""
Write-Output ("RESULT: " + $pass + " passed, " + $fail + " failed, " + $script:results.Count + " total")
Write-Output ("Finished: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
if ($fail -gt 0) { exit 1 } else { exit 0 }
