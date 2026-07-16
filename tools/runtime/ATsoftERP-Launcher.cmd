@echo off
title ATsoft ERP Launcher
echo =======================================
echo      ATsoft ERP — Local Launcher
echo =======================================
echo.
echo 1. Start ERP
echo 2. Stop ERP
echo 3. Status
echo 4. Open Web
echo 5. Backup Now
echo 6. Exit
echo.
choice /c 123456 /n /m "Select option (1-6): "
if errorlevel 6 exit /b
if errorlevel 5 goto backup
if errorlevel 4 goto open
if errorlevel 3 goto status
if errorlevel 2 goto stop
if errorlevel 1 goto start

:start
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0atsofterp-start.ps1"
pause
goto menu

:stop
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0atsofterp-stop.ps1"
pause
goto menu

:status
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0atsofterp-status.ps1"
pause
goto menu

:open
start http://localhost:3000
goto menu

:backup
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0atsofterp-backup-now.ps1"
pause
goto menu

:menu
cls
goto top
