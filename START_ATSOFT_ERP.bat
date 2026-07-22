@echo off
title ATsoft ERP Launcher
chcp 65001 >nul

setlocal enabledelayedexpansion

:: ---- Resolve project root ----
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

:: ---- Print header ----
echo ============================================
echo   ATsoft ERP - Starting Application
echo   شغّل تطبيق ATsoft ERP
echo ============================================
echo.

:: ---- Verify node ----
where node >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js not found - please install Node.js first.
    echo [FAIL] لم يتم العثور على Node.js. يرجى تثبيته أولاً.
    pause
    exit /b 1
)
echo [PASS] Node.js found
echo.

:: ---- Verify npm ----
where npm >nul 2>&1
if errorlevel 1 (
    echo [FAIL] npm not found - please install Node.js first.
    echo [FAIL] لم يتم العثور على npm. يرجى تثبيته أولاً.
    pause
    exit /b 1
)
echo [PASS] npm found
echo.

:: ---- Verify project files ----
if not exist "package.json" (
    echo [FAIL] package.json not found in %ROOT%
    echo [FAIL] ملف package.json غير موجود
    pause
    exit /b 1
)
echo [PASS] package.json found

if not exist "apps\api\package.json" (
    echo [FAIL] apps/api/package.json not found
    pause
    exit /b 1
)
echo [PASS] apps/api/package.json found

if not exist "apps\web\package.json" (
    echo [FAIL] apps/web/package.json not found
    pause
    exit /b 1
)
echo [PASS] apps/web/package.json found
echo.

:: ---- Check .env ----
if not exist "apps\api\.env" (
    echo [WARN] apps/api/.env not found — API may fail to connect to database.
    echo [WARN] ملف .env غير موجود — قد يفشل الاتصال بقاعدة البيانات.
) else (
    echo [PASS] apps/api/.env found
)
echo.

:: ---- Start API ----
echo Starting API server...
echo جارٍ تشغيل خادم API...
start "ATsoft ERP API - Port 4000" /D "%ROOT%" cmd /k "npm run start:dev --workspace apps/api"
if errorlevel 1 (
    echo [FAIL] Failed to start API server
    pause
    exit /b 1
)
echo [PASS] API server launching...
echo.

:: ---- Wait before starting Web ----
echo Waiting for API to initialize...
echo جارٍ انتظار تهيئة API...
timeout /t 8 /nobreak >nul
echo.

:: ---- Start Web ----
echo Starting Web server...
echo جارٍ تشغيل خادم الويب...
start "ATsoft ERP Web - Port 3000" /D "%ROOT%" cmd /k "npm run dev --workspace apps/web"
if errorlevel 1 (
    echo [FAIL] Failed to start Web server
    pause
    exit /b 1
)
echo [PASS] Web server launching...
echo.

:: ---- Wait before opening browser ----
timeout /t 5 /nobreak >nul

:: ---- Open browser ----
echo Opening browser...
echo جارٍ فتح المتصفح...
start "" "http://localhost:3000"
echo.

:: ---- Print URLs ----
echo ============================================
echo   ATsoft ERP - Running
echo   التطبيق قيد التشغيل
echo ============================================
echo.
echo   API:       http://localhost:4000
echo   Swagger:   http://localhost:4000/api/docs
echo   Web:       http://localhost:3000
echo.
echo ============================================
echo   To stop, close the two CMD windows or press Ctrl+C
echo   للإيقاف، أغلق نافذتي CMD أو اضغط Ctrl+C
echo.
echo   See STOP_ATSOFT_ERP_HELP.txt for details.
echo ============================================
echo.
pause
