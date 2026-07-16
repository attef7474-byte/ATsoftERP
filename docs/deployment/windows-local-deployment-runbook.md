# Windows Local Deployment Runbook

## Overview

This runbook describes how to deploy the ATsoft ERP application to a Windows production environment without Docker. The deployment targets `C:\ATsoftERP\App` with versioned release folders and a `current` symlink for zero-downtime switchover.

## Deployment Architecture

```
C:\ATsoftERP\
├── App\
│   ├── 1.0.0-20260716-abc1234\     # Versioned release
│   │   ├── api\                     # NestJS built API
│   │   ├── web\                     # Next.js built web
│   │   ├── scripts\                 # Management scripts
│   │   ├── prisma\                  # Prisma schema
│   │   ├── package.json
│   │   ├── release-manifest.json
│   │   └── .env                     # Runtime config (copied from Config)
│   ├── _previous\                   # Previous release backup
│   └── current -> 1.0.0-20260716-abc1234\   # Active symlink
├── Config\
│   ├── .env                         # API config
│   ├── .env.local                   # Web config
│   └── service-config.json          # Service definitions
├── Backups\                         # Database backups
└── Logs\
```

## Prerequisites

- Windows Server 2019/2022 or Windows 10/11 Pro
- Node.js 22+ installed and on PATH
- npm 10+ installed
- SQL Server (local or remote) reachable
- `sqlcmd.exe` available
- PowerShell 7+
- Symlink creation rights (usually requires admin)

## Step-by-Step Deployment

### 1. Validate Environment

```powershell
.\tools\deploy\validate-env.ps1
```

This checks:
- Node.js, npm, PowerShell, sqlcmd availability
- `.env` file correctness (DATABASE_URL, JWT_SECRET)
- No placeholder secrets
- No PostgreSQL references

### 2. Preflight Check

```powershell
.\tools\deploy\preflight-windows.ps1
```

This checks:
- Git working tree clean, on `main` branch
- Prisma schema valid, generated
- API and Web builds pass
- TypeScript compiles clean
- i18n checks pass
- API and Web are running

### 3. Build Release

```powershell
.\tools\deploy\build-release.ps1 -Version "1.2.3"
```

Or without specifying a version (auto-generated from timestamp + commit hash):

```powershell
.\tools\deploy\build-release.ps1
```

Output goes to `./releases/<version>/`.

### 4. Package Release

```powershell
.\tools\deploy\package-release.ps1 -ReleaseDir "./releases/1.2.3"
```

This creates:
- `atsoft-erp-1.2.3.zip`
- `atsoft-erp-1.2.3.zip.sha256`
- `atsoft-erp-1.2.3.zip.manifest.json`

### 5. Deploy to Production

```powershell
.\tools\deploy\deploy-local-windows.ps1 -ReleaseZip "./atsoft-erp-1.2.3.zip" -DeployRoot "C:\ATsoftERP\App"
```

This performs:
1. Extracts release to versioned folder
2. Saves previous release to `_previous`
3. Creates `current` symlink to new release
4. Copies runtime config from `C:\ATsoftERP\Config`
5. Runs `npm install --production`
6. Runs `prisma migrate deploy`
7. Restarts Windows services

### 6. Verify Deployment

```powershell
.\tools\health\health-check.ps1
.\tools\health\smoke-check.ps1
```

## First-Time Setup

If deploying for the first time:

1. Create directory structure:
   ```powershell
   New-Item -ItemType Directory -Path "C:\ATsoftERP\App" -Force
   New-Item -ItemType Directory -Path "C:\ATsoftERP\Config" -Force
   New-Item -ItemType Directory -Path "C:\ATsoftERP\Backups" -Force
   New-Item -ItemType Directory -Path "C:\ATsoftERP\Logs" -Force
   ```

2. Copy configuration files:
   ```powershell
   Copy-Item "apps/api/.env" "C:\ATsoftERP\Config\.env"
   Copy-Item "apps/web/.env.local" "C:\ATsoftERP\Config\.env.local"
   ```

3. Install Windows services:
   ```powershell
   .\deploy\windows\install-api-service.ps1
   .\deploy\windows\install-web-service.ps1
   ```

4. Start services:
   ```powershell
   Start-Service ATsoftERP_API
   Start-Service ATsoftERP_Web
   ```

## Service Management

### Start/Stop Status

```powershell
Get-Service ATsoftERP_API, ATsoftERP_Web
Start-Service ATsoftERP_API, ATsoftERP_Web
Stop-Service ATsoftERP_API, ATsoftERP_Web
```

### View Logs

API logs: `C:\ATsoftERP\Logs\api.log`
Web logs: `C:\ATsoftERP\Logs\web.log`

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|-----------|
| Service won't start | Node path incorrect | Verify with `Get-Command node` |
| API returns 503 | Port conflict | Check `netstat -ano | findstr :4000` |
| DB connection failed | DATABASE_URL wrong | Validate in `C:\ATsoftERP\Config\.env` |
| Web shows white screen | NEXT_PUBLIC_API_URL wrong | Check `.env.local` |
| Symlink not created | Missing admin rights | Run PowerShell as Administrator |
