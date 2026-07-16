# Windows Installer Operator Guide

## Overview

This guide covers the Windows installer scripts in `tools/installer/` for operators who need to install, uninstall, or reconfigure ATsoft ERP on Windows machines.

## Scripts

### `check-prerequisites.ps1`

Validates the environment before installation:

- Windows OS check
- Node.js (≥20) + npm (≥10)
- SQL Server port (localhost:50079) reachable
- Administrator privileges (when needed)
- Port 3000/4000 availability

```powershell
.\tools\installer\check-prerequisites.ps1
```

Exit codes: 0 = pass, 1 = fail.

### `create-shortcuts.ps1`

Creates desktop and Start Menu shortcuts for the runtime scripts.

```powershell
.\tools\installer\create-shortcuts.ps1 -Confirm
```

Parameters:
- `-Confirm`: Prompt before each shortcut
- `-DryRun`: Show what would be created

### `remove-shortcuts.ps1`

Removes all ATsoft ERP shortcuts from Desktop and Start Menu.

```powershell
.\tools\installer\remove-shortcuts.ps1 -Confirm
```

### `install-runtime.ps1`

Full installation script:

1. Creates folder structure (`C:\ATsoftERP\`)
2. Copies config template
3. Extracts release archive
4. Installs shortcuts (optional)
5. Installs services (optional)

```powershell
.\tools\installer\install-runtime.ps1 -ConfirmInstall -ServiceMode
```

Parameters:
- `-ReleaseZip`: Path to release archive (default: `C:\ATsoftERP\Temp\release.zip`)
- `-ServiceMode`: Install as Windows services (requires nssm)
- `-Shortcuts`: Install desktop shortcuts
- `-StartMenu`: Install Start Menu items
- `-ConfirmInstall`: Confirm installation
- `-DryRun`: Preview only

### `uninstall-runtime.ps1`

Safe uninstall — preserves `C:\ATsoftERP\Backups\`, `C:\ATsoftERP\Logs\`, and config by default.

```powershell
.\tools\installer\uninstall-runtime.ps1 -ConfirmUninstall
```

Parameters:
- `-RemoveAll`: Remove everything including backups, logs, and config
- `-ConfirmUninstall`: Required to proceed

## Folder Layout (C:\ATsoftERP)

```
C:\ATsoftERP\
├── App\            # Application releases
│   └── current\    # Currently active release
├── Backups\        # Database backups (preserved on uninstall)
├── Config\         # Configuration files
├── Logs\           # Runtime logs (preserved on uninstall)
└── Temp\           # Temporary files
```

## Service Management

Services are managed via `deploy/windows/`:

- `install-api-service.ps1` — Install the API as a Windows service (via nssm)
- `install-web-service.ps1` — Install the Web as a Windows service
- `uninstall-services.ps1` — Remove both services

```powershell
.\deploy\windows\install-api-service.ps1 -ServiceName ATsoftERP_API -DisplayName "ATsoftERP API Server" -NodePath "C:\Program Files\nodejs\node.exe" -ScriptPath "C:\ATsoftERP\App\current\api\main.js"
```
