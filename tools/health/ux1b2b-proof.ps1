$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api/v1'
if ([string]::IsNullOrEmpty($env:SEED_ADMIN_EMAIL)) { throw 'SEED_ADMIN_EMAIL environment variable is required' }
if ([string]::IsNullOrEmpty($env:SEED_ADMIN_PASSWORD)) { throw 'SEED_ADMIN_PASSWORD environment variable is required' }
$companyA = 'cmru455nm0000a895rtmc2m6h'
$branchA  = 'cmrl31uw10001ok95yiz5wb42'
$companyB = 'cmrvaph2200009g95oj1o8m1j'
$branchB  = 'cmrvaph4100019g95kisacppa'
$results = New-Object System.Collections.Generic.List[string]

function HeadersA($token, $locale = 'en') {
  @{ Authorization = "Bearer $token"; 'x-active-company-id' = $companyA; 'x-active-branch-id' = $branchA; 'x-locale' = $locale; 'Content-Type' = 'application/json' }
}
function HeadersB($token, $locale = 'en') {
  @{ Authorization = "Bearer $token"; 'x-active-company-id' = $companyB; 'x-active-branch-id' = $branchB; 'x-locale' = $locale; 'Content-Type' = 'application/json' }
}
function Api($method, $path, $token, $headers, $body = $null) {
  try {
    $params = @{ Method = $method; Uri = "$base$path"; Headers = $headers; TimeoutSec = 20 }
    if ($null -ne $body) { $params.Body = ($body | ConvertTo-Json -Depth 8) }
    $resp = Invoke-RestMethod @params
    return @{ ok = $true; status = 200; body = $resp }
  } catch {
    $status = 0
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    $msg = $_.ErrorDetails.Message
    if (-not $msg) { $msg = $_.Exception.Message }
    return @{ ok = $false; status = $status; body = $null; raw = $msg }
  }
}
function Check($name, $ok, $detail = '') {
  $results.Add("$($(if ($ok) {'PASS'} else {'FAIL'})) | $name | $detail")
}

$login = @{ email = $env:SEED_ADMIN_EMAIL; password = $env:SEED_ADMIN_PASSWORD } | ConvertTo-Json
$auth = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $login -TimeoutSec 20
$token = $auth.accessToken
$ha = HeadersA $token
$hb = HeadersB $token

# 1. Machine discovery (list is unscoped, so filter for machine owned by the fixture context)
$machines = Api 'Get' '/maintenance/machines?page=1&limit=100' $token $ha
$machine = $null
if ($machines.ok) {
  $list = $machines.body.data -as [array]
  if (-not $list -or $list.Count -eq 0) { $list = $machines.body -as [array] }
  $machine = @($list | Where-Object { $_.companyId -eq $companyA -and ($_.branchId -eq $branchA -or $null -eq $_.branchId) }) | Select-Object -First 1
}
Check 'discover machine owned by fixture context' ($null -ne $machine) $(if ($machine) { "machineId=$($machine.id) company=$($machine.companyId)" } else { 'none owned' })

if (-not $machine) { Write-Host "NO MACHINE - cannot continue"; $results | ForEach-Object { $_ }; exit }

$mId = $machine.id
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$requestBody = @{
  machineId = $mId
  type = 'BREAKDOWN'
  priority = 'HIGH'
  title = "UX1B2B-Proof request $stamp"
  description = 'Runtime proof fixture - canonical foundation'
}

# 2. Create request
$req = Api 'Post' '/maintenance/requests' $token $ha $requestBody
Check 'create request (POST)' ($req.ok -and $req.body.id) "status=$($req.body.status) number=$($req.body.requestNumber)"
$reqId = $req.body.id
Check 'request created OPEN' ($req.body.status -eq 'OPEN') "status=$($req.body.status)"

# 3. Workflow superset
$wf = Api 'Get' "/maintenance/requests/$reqId/workflow" $token $ha
$hasTransitions = $wf.ok -and ($wf.body.transitions -is [array])
$hasStart = $hasTransitions -and (($wf.body.transitions | Where-Object { $_.action -eq 'start' -and $_.fromStatus -eq 'OPEN' -and $_.toStatus -eq 'IN_PROGRESS' -and $_.permission -eq 'maintenance-request:start' }).Count -eq 1)
$hasCancel = $hasTransitions -and (($wf.body.transitions | Where-Object { $_.action -eq 'cancel' -and $_.fromStatus -eq 'OPEN' -and $_.toStatus -eq 'CANCELLED' }).Count -eq 1)
Check 'workflow superset: currentStatus+transitions' ($wf.ok -and $wf.body.currentStatus -eq 'OPEN') "currentStatus=$($wf.body.currentStatus)"
Check 'workflow transitions include start (from/to/permission)' $hasStart 'start OPEN->IN_PROGRESS'
Check 'workflow transitions include cancel' $hasCancel 'cancel OPEN->CANCELLED'
Check 'workflow history present' ($wf.ok -and (@($wf.body.history).Count -ge 1)) "historyCount=$(@($wf.body.history).Count)"

# 4. Canonical error: complete on OPEN (EN + AR)
$errEn = Api 'Patch' "/maintenance/requests/$reqId/complete" $token (HeadersA $token 'en') $null
$errArW = Invoke-WebRequest -Method Patch -Uri "$base/maintenance/requests/$reqId/complete" -Headers (HeadersA $token 'ar') -SkipHttpErrorCheck -TimeoutSec 20
$arArabic = ($errArW.Content.ToCharArray() | Where-Object { [int]$_ -ge 0x600 -and [int]$_ -le 0x6FF }).Count -gt 0
Check 'guard: complete on OPEN rejected' (-not $errEn.ok -and $errEn.status -eq 400) "status=$($errEn.status)"
Check 'guard: canonical messageKey en' ($errEn.raw -match 'maintenance.onlyInProgressCanComplete') $errEn.raw
Check 'guard: localized AR message' ($arArabic -and $errArW.StatusCode -eq 400) 'Arabic message present'

# 5. start -> IN_PROGRESS
$start = Api 'Patch' "/maintenance/requests/$reqId/start" $token $ha $null
Check 'start request -> IN_PROGRESS' ($start.ok -and $start.body.status -eq 'IN_PROGRESS') "status=$($start.body.status)"

# 6. Tasks
$task = Api 'Post' '/maintenance/tasks' $token $ha @{ requestId = $reqId; title = "UX1B2B task $stamp" }
Check 'create task' ($task.ok -and $task.body.id) "status=$($task.body.status)"
$tId = $task.body.id
$tStart = Api 'Patch' "/maintenance/tasks/$tId/start" $token $ha $null
Check 'task start -> IN_PROGRESS' ($tStart.ok -and $tStart.body.status -eq 'IN_PROGRESS') "status=$($tStart.body.status)"
$tDone = Api 'Patch' "/maintenance/tasks/$tId/complete" $token $ha $null
Check 'task complete -> DONE' ($tDone.ok -and $tDone.body.status -eq 'DONE') "status=$($tDone.body.status)"

# 7. Assignment (create personnel if none)
$personnel = Api 'Get' '/maintenance/personnel?page=1&limit=5' $token $ha
$p = @($personnel.body.data -as [array]) | Select-Object -First 1
if (-not $p) {
  $created = Api 'Post' '/maintenance/personnel' $token $ha @{ code = "UX$stamp"; name = 'UX1B2B Technician'; role = 'TECHNICIAN'; status = 'ACTIVE' }
  $p = $created.body
}
$assign = Api 'Post' '/maintenance/request-assignments' $token $ha @{ maintenanceRequestId = $reqId; maintenancePersonnelId = $p.id; assignmentRole = 'TECHNICIAN' }
Check 'assignment create with validation+audit' ($assign.ok -and $assign.body.status -eq 'ACTIVE') "status=$($assign.body.status)"
$badAssign = Api 'Post' '/maintenance/request-assignments' $token $ha @{ maintenanceRequestId = $reqId; maintenancePersonnelId = 'nonexistent-id'; assignmentRole = 'TECHNICIAN' }
Check 'assignment rejects unknown personnel (invalidReference)' (-not $badAssign.ok -and $badAssign.raw -match 'validation.invalidReference') $badAssign.raw

# 8. Downtime with EMPTY requestId (normalization fix)
# 8a. Fixture hygiene: end+close any stale active downtime on this machine first
$current = Api 'Get' '/maintenance/downtime-logs/current?limit=50' $token $ha
if ($current.ok) {
  $staleActives = @($current.body.data -as [array]) | Where-Object { $_.machineId -eq $mId }
  foreach ($stale in $staleActives) {
    Api 'Patch' "/maintenance/downtime-logs/$($stale.id)/end" $token $ha $null | Out-Null
  }
}
$dt = Api 'Post' '/maintenance/downtime-logs' $token $ha @{ machineId = $mId; requestId = ''; reason = 'UX1B2B downtime' }
Check 'downtime create with requestId="" succeeds' ($dt.ok -and $dt.body.id) $(if ($dt.raw) { $dt.raw } else { "status=$($dt.body.status)" })
$dtId = $dt.body.id
$dtEnd = Api 'Patch' "/maintenance/downtime-logs/$dtId/end" $token $ha @{ endTime = (Get-Date).ToString('o') }
Check 'downtime end' ($dtEnd.ok -and $null -ne $dtEnd.body.endTime) "endTime=$($dtEnd.body.endTime) status=$($dtEnd.body.status)"
$dtClass = Api 'Patch' "/maintenance/downtime-logs/$dtId/classify" $token $ha @{ reason = 'Mechanical'; category = 'PUMPS' }
Check 'downtime classify (reason+category)' ($dtClass.ok -and $dtClass.body.failureCategory -eq 'PUMPS') "category=$($dtClass.body.failureCategory)"
$dtGuard = Api 'Patch' "/maintenance/downtime-logs/$dtId/end" $token $ha @{ endTime = (Get-Date).ToString('o') }
Check 'guard: downtime already ended' (-not $dtGuard.ok -and $dtGuard.raw -match 'maintenance.downtimeAlreadyEnded') $dtGuard.raw

# 9. Attachments: upload + download + list via request endpoint
$probePath = Join-Path $env:TEMP "ux1b2b-attach-$stamp.txt"
Set-Content -LiteralPath $probePath -Value "UX1B2B attachment proof $stamp" -Encoding utf8
try {
  $upload = Invoke-RestMethod -Method Post -Uri "$base/attachments" -Headers @{ Authorization = "Bearer $token"; 'x-active-company-id' = $companyA; 'x-active-branch-id' = $branchA } -Form @{ file = Get-Item $probePath; entityName = 'MAINTENANCE_REQUEST'; entityId = $reqId }
  Check 'attachment upload' ($null -ne $upload.id) "id=$($upload.id) name=$($upload.originalName)"
  $attId = $upload.id
  $attList = Api 'Get' "/maintenance/requests/$reqId/attachments" $token $ha
  Check 'request attachments list (real fields)' ($attList.ok -and @($attList.body)[0].originalName -match 'ux1b2b-attach') "count=$(@($attList.body).Count)"
  $dl = Invoke-WebRequest -Method Get -Uri "$base/attachments/$attId/download" -Headers @{ Authorization = "Bearer $token"; 'x-active-company-id' = $companyA; 'x-active-branch-id' = $branchA } -TimeoutSec 20
  $dlText = $dl.Content
  Check 'attachment download (authenticated blob)' ($dl.StatusCode -eq 200 -and $dlText -match 'UX1B2B attachment proof') "bytes=$($dl.RawContentLength)"
  $attDel = Api 'Delete' "/attachments/$attId" $token $ha $null
  Check 'attachment cleanup delete' $attDel.ok $attDel.raw
} catch {
  Check 'attachment upload' $false $_.Exception.Message
}
Remove-Item -LiteralPath $probePath -ErrorAction SilentlyContinue

# 10. Print aliases + activity
$print = Api 'Get' "/maintenance/requests/$reqId/print" $token $ha
Check 'print aliases present' ($print.ok -and $null -ne $print.body.partsUsed -and $null -ne $print.body.costEntries -and $null -ne $print.body.downtimeLogs) "partsUsed/costEntries/downtimeLogs"
$activity = Api 'Get' "/maintenance/requests/$reqId/activity" $token $ha
Check 'activity endpoint' ($activity.ok -and ($activity.body.data -is [array] -or $activity.body -is [array])) ""

# 11. Complete + close request
$done = Api 'Patch' "/maintenance/requests/$reqId/complete" $token $ha $null
Check 'request complete -> COMPLETED' ($done.ok -and $done.body.status -eq 'COMPLETED') "status=$($done.body.status)"
$closed = Api 'Patch' "/maintenance/requests/$reqId/close" $token $ha $null
Check 'request close -> CLOSED' ($closed.ok -and $closed.body.status -eq 'CLOSED') "status=$($closed.body.status)"

# 12. Tenant isolation: company B cannot read/act
$isoRead = Api 'Get' "/maintenance/requests/$reqId" $token $hb
Check 'tenant: company B cannot read request by id' (-not $isoRead.ok) "status=$($isoRead.status)"
$isoAct = Api 'Patch' "/maintenance/requests/$reqId/cancel" $token $hb $null
Check 'tenant: company B cannot act on request' (-not $isoAct.ok) "status=$($isoAct.status)"
$isoWf = Api 'Get' "/maintenance/requests/$reqId/workflow" $token $hb
Check 'tenant: company B workflow denied' (-not $isoWf.ok) "status=$($isoWf.status)"
$isoList = Api 'Get' "/maintenance/requests?search=$([uri]::EscapeDataString("UX1B2B-Proof request $stamp"))" $token $hb
$leaked = $isoList.ok -and (@($isoList.body.data -as [array]) | Where-Object { $_.id -eq $reqId }).Count -gt 0
Check 'tenant: company B search does not leak request' (-not $leaked) "leaked=$leaked"
$isoDt = Api 'Get' "/maintenance/downtime-logs/$dtId" $token $hb
Check 'tenant: company B cannot read downtime by id' (-not $isoDt.ok) "status=$($isoDt.status)"

# 13. Cleanup
$dl1 = Api 'Delete' "/maintenance/downtime-logs/$dtId" $token $ha $null
$tl1 = Api 'Delete' "/maintenance/tasks/$tId" $token $ha $null
$al1 = Api 'Delete' "/maintenance/request-assignments/$($assign.body.id)" $token $ha $null
$rl1 = Api 'Delete' "/maintenance/requests/$reqId" $token $ha $null
Check 'cleanup: downtime deleted' $dl1.ok $dl1.raw
Check 'cleanup: task deleted' $tl1.ok $tl1.raw
Check 'cleanup: assignment deleted' $al1.ok $al1.raw
Check 'cleanup: request deleted' $rl1.ok $rl1.raw
$gone = Api 'Get' "/maintenance/requests/$reqId" $token $ha
Check 'cleanup verified: request gone' (-not $gone.ok) "status=$($gone.status)"

Write-Host "=== UX1B2B RUNTIME PROOF SUMMARY ==="
$results | ForEach-Object { Write-Host $_ }
$fails = @($results | Where-Object { $_ -like 'FAIL*' })
Write-Host "TOTAL: $($results.Count)  PASS: $(@($results | Where-Object { $_ -like 'PASS*' }).Count)  FAIL: $($fails.Count)"
