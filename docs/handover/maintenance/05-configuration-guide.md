# Handover Document 5: Configuration Guide

## 1. Environment Variables

### API (`apps/api/.env`)
```env
DATABASE_URL="sqlserver://127.0.0.1:50079;database=ATsoftERP_DB;user=atsofterp_app;password=<password>;trustServerCertificate=true"
JWT_SECRET=<jwt-secret>
JWT_EXPIRES_IN=3600
PORT=3000
```

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=ATsoft ERP
```

## 2. Prisma Connection String

Format:
```
sqlserver://HOST:PORT;database=DB_NAME;user=USER;password=PASS;trustServerCertificate=true
```

- **Host**: `127.0.0.1`
- **Port**: `50079`
- **Database**: `ATsoftERP_DB`
- **User**: `atsofterp_app`
- **SSL**: `trustServerCertificate=true` (self-signed cert)

## 3. JWT Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for token signing | (required) |
| `JWT_EXPIRES_IN` | Token expiry in seconds | `3600` (1 hour) |

Tokens are issued at login and verified on every protected API call. Refresh tokens are supported but not currently exposed via UI.

## 4. Maintenance Settings (UI-Configurable)

The following entities are configurable via the maintenance settings UI:

| Entity | Route | Description |
|--------|-------|-------------|
| Operation Types | `/admin/maintenance/settings/operation-types` | Types of maintenance operations |
| Cost Centers | `/admin/maintenance/settings/cost-centers` | Cost center codes |
| Production Lines | `/admin/maintenance/settings/production-lines` | Line codes and descriptions |
| SLA | `/admin/maintenance/settings/sla` | Service level agreements |

All settings support standard CRUD with permission checks.

## 5. Numbering Sequences Configuration

**Backend service**: `NumberingService` (apps/api/src/numbering/)

**Data model**: `numberSequence` table seeded with 46 entity types (38 active).

**Key configuration fields per sequence**:

| Field | Description |
|-------|-------------|
| `entityType` | Unique code (e.g., `MAINTENANCE_REQUEST`) |
| `prefix` | Prefix string (e.g., `REQ-`) |
| `suffix` | Optional suffix |
| `currentNumber` | Current counter value |
| `lastGeneratedCode` | Last generated full code |
| `format` | Zero-padded format length |
| `status` | `ACTIVE` or `DISABLED` |
| `description` | Human-readable description |

**Adding a new sequence**: Seed via `seed.ts` then call `NumberingService.generateNumberAtomic()`.

**UI**: Sequence filter under settings covers all 38 active entity types.

## 6. Permission Configuration

- **Backend seed**: `apps/api/prisma/seed/seed.ts`
- **Permission format**: `resource:action` (e.g., `machines:read`, `requests:create`)
- **Role assignment**: UI-based via `/admin/access-control`
- **Default roles**: Admin, Manager, Supervisor, Technician, Viewer

### Maintenance Permissions (sample)

| Permission Key | Description |
|---------------|-------------|
| `machines:read` | View machines |
| `machines:create` | Create machines |
| `machines:update` | Update machines |
| `machines:delete` | Delete machines |
| `requests:read` | View requests |
| `requests:create` | Create requests |
| `requests:manage` | Manage/assign requests |
| `spare-parts:read` | View spare parts |
| `stock-issue:create` | Issue spare parts |
| `repair-orders:read` | View repair orders |
| `repair-orders:manage` | Manage repair orders |
| `repair-orders:complete` | Complete repair orders |
| `repair-orders:scrap` | Scrap repair orders |

## 7. i18n Key Management

### File Locations

```
apps/web/src/lib/i18n/locales/en/   # English keys
apps/web/src/lib/i18n/locales/ar/   # Arabic keys
```

### Adding a New Key

1. Add key-value pair to the appropriate file in both `en/` and `ar/`
2. Convention: `namespace.keyName` (e.g., `maintenance.machineName`)
3. Use dot notation in templates: `t('maintenance.machineName')`
4. API messages go in `api-messages.ts`
5. Run `npm run build` to verify no type errors

### Adding a New API Message

Add to both:
- `apps/api/src/i18n/en/api-messages.ts`
- `apps/api/src/i18n/ar/api-messages.ts`

Then use in service:
```typescript
throw new BadRequestException({
  messageKey: 'maintenance.stock.insufficientQuantity',
  message: this.i18nService.translate('maintenance.stock.insufficientQuantity', lang),
});
```

## 8. System Settings

Configurable via UI at `/admin/settings/`:

| Setting | Description |
|---------|-------------|
| Company Profile | Company name, logo, contact info |
| Language | System default language (Arabic/English) |
| Appearance | Theme, RTL/LTR direction |
| Security | Password policy, session timeout |
| Notification Rules | Notification triggers and channels |

## 9. Configuration Files Locations

| File | Purpose |
|------|---------|
| `apps/api/.env` | API environment variables |
| `apps/web/.env.local` | Frontend environment variables |
| `apps/api/prisma/schema.prisma` | Database schema |
| `apps/api/prisma/seed/seed.ts` | Seed data |
| `apps/api/src/app.module.ts` | Module registry |
| `apps/api/src/numbering/numbering.constants.ts` | Entity type codes |
| `apps/web/src/lib/i18n/locales/` | Translation files |
| `AGENTS.md` | Project rules and context |
