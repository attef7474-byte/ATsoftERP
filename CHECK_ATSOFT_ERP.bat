@echo off
title ATsoft ERP - Health Check
chcp 65001 >nul

setlocal enabledelayedexpansion

echo ============================================
echo   ATsoft ERP - Health Check
echo   فحص صحة التطبيق
echo ============================================
echo.

set "PASS_COUNT=0"
set "FAIL_COUNT=0"

:: ---- Check SQL Server port 50079 ----
echo [1/6] Checking SQL Server port 50079 ...
powershell -NoProfile -Command "try { $t=New-Object Net.Sockets.TcpClient; $t.ConnectAsync('localhost',50079).Wait(3000); if($t.Connected){Write-Output 'PASS'}else{Write-Output 'FAIL'}; $t.Close() } catch { Write-Output 'FAIL' }" >"%TEMP%\atsoft_sqlcheck.tmp" 2>&1
set /p SQL_RESULT=<"%TEMP%\atsoft_sqlcheck.tmp"
if "!SQL_RESULT!"=="PASS" (
    echo   [PASS] SQL Server is reachable on port 50079
    set /a PASS_COUNT+=1
) else (
    echo   [FAIL] SQL Server port 50079 is not reachable
    set /a FAIL_COUNT+=1
)
del "%TEMP%\atsoft_sqlcheck.tmp" 2>nul
echo.

:: ---- Check API port 4000 ----
echo [2/6] Checking API port 4000 ...
netstat -ano | findstr ":4000" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [PASS] API is listening on port 4000
    set /a PASS_COUNT+=1
) else (
    echo   [FAIL] API is NOT listening on port 4000
    set /a FAIL_COUNT+=1
)
echo.

:: ---- Check Web port 3000 ----
echo [3/6] Checking Web port 3000 ...
netstat -ano | findstr ":3000" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [PASS] Web is listening on port 3000
    set /a PASS_COUNT+=1
) else (
    echo   [FAIL] Web is NOT listening on port 3000
    set /a FAIL_COUNT+=1
)
echo.

:: ---- Check API health endpoint ----
echo [4/6] Checking API health endpoint ...
powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://localhost:4000/api/v1/health' -TimeoutSec 5; if($r.status -eq 'ok'){Write-Output 'PASS'}else{Write-Output 'FAIL'} } catch { Write-Output 'FAIL' }" >"%TEMP%\atsoft_health.tmp" 2>&1
set /p HEALTH_RESULT=<"%TEMP%\atsoft_health.tmp"
if "!HEALTH_RESULT!"=="PASS" (
    echo   [PASS] API health endpoint returns OK
    set /a PASS_COUNT+=1
) else (
    echo   [FAIL] API health endpoint is not responding
    set /a FAIL_COUNT+=1
)
del "%TEMP%\atsoft_health.tmp" 2>nul
echo.

:: ---- Check Swagger docs ----
echo [5/6] Checking Swagger docs ...
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:4000/api/docs' -UseBasicParsing -TimeoutSec 5; if($r.StatusCode -eq 200 -or $r.StatusCode -eq 301 -or $r.StatusCode -eq 302){Write-Output 'PASS'}else{Write-Output 'FAIL'} } catch { Write-Output 'FAIL' }" >"%TEMP%\atsoft_swagger.tmp" 2>&1
set /p SWAGGER_RESULT=<"%TEMP%\atsoft_swagger.tmp"
if "!SWAGGER_RESULT!"=="PASS" (
    echo   [PASS] Swagger docs are reachable
    set /a PASS_COUNT+=1
) else (
    echo   [FAIL] Swagger docs are not reachable
    set /a FAIL_COUNT+=1
)
del "%TEMP%\atsoft_swagger.tmp" 2>nul
echo.

:: ---- Check Web server ----
echo [6/6] Checking Web server ...
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 10; if($r.StatusCode -eq 200){Write-Output 'PASS'}else{Write-Output 'FAIL'} } catch { Write-Output 'FAIL' }" >"%TEMP%\atsoft_webcheck.tmp" 2>&1
set /p WEB_RESULT=<"%TEMP%\atsoft_webcheck.tmp"
if "!WEB_RESULT!"=="PASS" (
    echo   [PASS] Web server returns 200 OK
    set /a PASS_COUNT+=1
) else (
    echo   [FAIL] Web server is not responding with 200
    set /a FAIL_COUNT+=1
)
del "%TEMP%\atsoft_webcheck.tmp" 2>nul
echo.

:: ---- Summary ----
echo ============================================
echo   Results — النتائج
echo ============================================
echo   PASSED: !PASS_COUNT! / 6
echo   FAILED: !FAIL_COUNT! / 6
echo.

if !FAIL_COUNT! gtr 0 (
    echo   Some checks failed. See messages above.
    echo   بعض الفحوصات فشلت. انظر الرسائل أعلاه.
    echo.
    echo   Troubleshooting — حل المشاكل:
    echo   - Run START_ATSOFT_ERP.bat first
    echo   - Check STOP_ATSOFT_ERP_HELP.txt
    echo   - Ensure SQL Server WINCC is running
) else (
    echo   All checks passed! The application is running.
    echo   جميع الفحوصات ناجحة! التطبيق قيد التشغيل.
    echo.
    echo   API:       http://localhost:4000
    echo   Swagger:   http://localhost:4000/api/docs
    echo   Web:       http://localhost:3000
)
echo.
pause
