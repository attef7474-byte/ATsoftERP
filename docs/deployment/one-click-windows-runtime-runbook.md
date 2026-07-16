# One-Click Windows Runtime Runbook

## Overview

This runbook describes how to install, start, stop, monitor, backup, and migrate the ATsoft ERP local runtime on a Windows machine — all without Docker.

## Prerequisites

- Windows 10/11 or Windows Server 2019+
- PowerShell 7+ (`$PSVersionTable.PSVersion`)
- Node.js 20+ (`node --version`)
- SQL Server (local or remote) with a valid `atsofterp_app` login
- Administrator privileges for service/shortcut operations

## Quick Start

```powershell
# From the repo root:
npm run runtime:install
```

This runs: prerequisites check → folder creation → config copy → release extraction → shortcut creation → migration prompt.

## Commands

| Command | Description |
|---------|-------------|
| `npm run runtime:start` | Start API + Web (process or service mode) |
| `npm run runtime:stop` | Stop API + Web |
| `npm run runtime:restart` | Restart API + Web |
| `npm run runtime:status` | Full status with health checks |
| `npm run runtime:open` | Open Web UI in browser |
| `npm run runtime:backup` | Create a SQL Server backup |
| `npm run runtime:migrate` | Run Prisma migrations (with pre-backup) |
| `npm run installer:check` | Validate prerequisites |
| `npm run installer:shortcuts` | Create desktop/Start Menu shortcuts |

## Desktop Launcher

Double-click `tools\runtime\ATsoftERP-Launcher.cmd` for a text menu:

```
1. Start ERP
2. Stop ERP
3. Status
4. Open Web
5. Backup Now
6. Exit
```

## One-Click Scripts

Each `.ps1` in `tools/runtime/` can be run directly from a PowerShell prompt or via the `.cmd` wrappers.

| File | Purpose |
|------|---------|
| `atsofterp-install.ps1` | Full installation |
| `atsofterp-start.ps1` | Start processes/services |
| `atsofterp-stop.ps1` | Stop processes/services |
| `atsofterp-restart.ps1` | Restart processes/services |
| `atsofterp-status.ps1` | Status + health |
| `atsofterp-open.ps1` | Open browser |
| `atsofterp-backup-now.ps1` | Database backup |
| `atsofterp-run-migrations.ps1` | Prisma migrate deploy |

## Process Mode vs Service Mode

By default, runtimes start as **processes** (visible in console). To run as Windows services:

1. Set `"runtime.runAsService": true` in `deploy/windows/service-config.example.json`
2. Ensure nssm is installed (via `winget install nssm`)
3. Use `tools/installer/install-runtime.ps1` to install services

## Logs

All logs are written to `C:\ATsoftERP\Logs\`:

- `api-stdout.log`, `api-stderr.log`
- `web-stdout.log`, `web-stderr.log`
- `runtime.log` (script output)

## Database Backups

Backups go to `C:\ATsoftERP\Backups\` by default. Each backup is verified automatically after creation. Use `npm run runtime:backup` for an on-demand backup.

## Migrations

Running `npm run runtime:migrate` will:

1. Create a pre-migration database backup (CopyOnly)
2. Validate the Prisma schema
3. Check `DATABASE_URL`
4. Run `prisma migrate deploy`
