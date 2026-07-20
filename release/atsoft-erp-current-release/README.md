# ATsoft ERP — Current Release

## System Overview

ATsoft ERP is a smart factory ERP system for Windows local runtime with SQL Server backend. It covers inventory management, maintenance (CMMS), barcodes/QR, reporting, and system administration.

## Approved Scope

- Auth (JWT + bcrypt)
- Access Control (users, roles, permissions)
- Core (companies, branches, departments)
- Dashboard
- Alerts / Notifications
- Settings
- Audit
- Attachments
- Warehouses / Locations
- Products / Categories
- Inventory (balances, movements, counts)
- CMMS / Maintenance (machines, parts, documents, requests, tasks, preventive, downtime)
- Barcodes / QR
- Reports (export CSV/Excel, print-to-PDF)
- Unified Search (F9)
- Backup/Restore/runtime tools
- Flutter mobile source (Flutter SDK limitation)
- Documentation and training package

## Runtime Environment

- **OS**: Windows local runtime only
- **Database**: SQL Server (WINCC instance, port 50079)
- **Backend**: NestJS (TypeScript)
- **Frontend**: Next.js App Router + Tailwind
- **ORM**: Prisma 7.8.0
- **Auth**: JWT + bcrypt
- **i18n**: Arabic + English (1917/1917 keys)

## Quick Start

```powershell
# Prisma generate
npx prisma generate --schema apps/api/prisma/schema.prisma

# Start API
npm run start:dev --workspace apps/api

# Build web
npm run build:web

# Start web (production)
npm start --workspace apps/web
```

## Validation Summary

| Check | Result |
|-------|--------|
| Prisma validate | PASS |
| Prisma generate | PASS |
| API build | PASS |
| Typecheck | PASS |
| Web build (124 pages) | PASS |
| i18n check (1917 keys) | PASS |
| Health check (3/4) | PASS (Web not running in dev) |
| Smoke check (6/8 API) | PASS (Web failures dev-mode only) |
| API regression (Batch 38) | 99/99 PASS |
| Permission checks (Batch 38) | 93/93 PASS |
| Browser pages (Batch 38) | 14/14 PASS |

## Support / Troubleshooting

- Admin guide: `docs/admin-guide/08-troubleshooting.md`
- Operations quick ref: `docs/operations/admin-quick-reference.md`
- GitHub tags: `atsoft-erp-batch39-*`, `atsoft-erp-current-release-final`
