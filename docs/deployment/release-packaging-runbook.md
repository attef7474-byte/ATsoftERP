# Release Packaging Runbook

## Overview

This runbook describes the release packaging pipeline for ATsoft ERP. The process builds, stages, and packages the application into a distributable ZIP archive with integrity verification.

## Packaging Pipeline

```
Source Code
    → Build (API + Web)
    → Stage (versioned directory under releases/)
    → Package (ZIP + SHA256 + manifest)
    → Deploy (extract to C:\ATsoftERP\App)
```

## Scripts

### 1. Build Release: `tools/deploy/build-release.ps1`

```powershell
.\tools\deploy\build-release.ps1 [-Version "x.y.z"] [-OutputDir "path"] [-SkipBuild] [-DryRun]
```

**Stages:**
- Compiles TypeScript (API) and builds Next.js (Web)
- Copies `dist/`, `.next/`, `public/`, scripts, prisma schema, and root package files
- Generates `release-manifest.json`:

```json
{
  "version": "1.2.3-20260716-abc1234",
  "timestamp": "2026-07-16T02:00:00.000Z",
  "commit": "abc1234def5678...",
  "branch": "main",
  "node": "v22.17.1",
  "npm": "11.16.0"
}
```

### 2. Package Release: `tools/deploy/package-release.ps1`

```powershell
.\tools\deploy\package-release.ps1 -ReleaseDir "./releases/1.2.3" [-OutputDir "path"] [-Version "x.y.z"] [-DryRun]
```

**Creates:**
- `atsoft-erp-<version>.zip` — compressed archive
- `atsoft-erp-<version>.zip.sha256` — SHA-256 checksum
- `atsoft-erp-<version>.zip.manifest.json` — package metadata

## Output Structure

```
releases/
└── 1.2.3-20260716-abc1234/
    ├── api/
    │   ├── main.js
    │   ├── *.js (compiled modules)
    │   └── package.json
    ├── web/
    │   ├── .next/
    │   ├── public/
    │   ├── package.json
    │   └── next.config.mjs
    ├── scripts/
    ├── prisma/
    │   └── schema.prisma
    ├── package.json
    ├── package-lock.json
    ├── release-manifest.json
    └── .env.example
```

## Versioning Convention

- **Format**: `<major>.<minor>.<patch>-<YYYYMMDD>-g<commit>`
- **Example**: `1.2.3-20260716-abc1234`
- Auto-generated from the current date and git short hash when `-Version` is omitted

## Integrity Verification

After packaging, verify integrity:

```powershell
# Check SHA-256
$expected = Get-Content "atsoft-erp-1.2.3.zip.sha256"
$actual = (Get-FileHash "atsoft-erp-1.2.3.zip" -Algorithm SHA256).Hash.ToLower()
if ($expected -eq $actual) { Write-Host "Integrity check PASSED" } else { Write-Host "Integrity check FAILED" }

# Check manifest
Get-Content "atsoft-erp-1.2.3.zip.manifest.json" | ConvertFrom-Json
```

## CI Integration

For automated builds, add to CI pipeline:

```yaml
steps:
  - script: |
      pwsh -NoProfile tools/deploy/preflight-windows.ps1
      pwsh -NoProfile tools/deploy/build-release.ps1
      pwsh -NoProfile tools/deploy/package-release.ps1 -ReleaseDir "./releases/*"
    displayName: 'Build & Package Release'
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails | Missing dependencies | Run `npm ci` first |
| Release dir not found | Wrong path | Verify with `Get-ChildItem ./releases/` |
| ZIP corrupt | Disk full | Check free space with `Get-PSDrive C` |
| SHA-256 mismatch | File modified in transit | Re-download and re-verify |
