# Handover Document 7: Troubleshooting Guide

## 1. Common Error Patterns

### "ECONNREFUSED — SQL Server not running"

**Symptoms**: API fails to start, health check shows database as disconnected.

**Causes**:
- SQL Server Express service not started
- Wrong port (verify `127.0.0.1:50079`)
- Firewall blocking port

**Solutions**:
```powershell
# Check if SQL Server is running
Get-Service -Name MSSQL$SQLEXPRESS

# Start if stopped
Start-Service -Name MSSQL$SQLEXPRESS

# Verify connection
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -Q "SELECT 1"
```

### "Invalid Prisma Client — generate"

**Symptoms**: API fails with `@prisma/client` import errors.

**Causes**: Prisma client stale after schema changes.

**Solution**:
```powershell
cd apps/api
npx prisma generate
```

### "Table not found — migration not applied"

**Symptoms**: API queries fail with invalid object name errors.

**Causes**: New migration script was not executed against the database.

**Solution**:
```powershell
# Apply the migration
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -d ATsoftERP_DB -i migration.sql

# Verify tables exist
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -d ATsoftERP_DB -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
```

### "401 Unauthorized — JWT expired / invalid"

**Symptoms**: API returns 401 on protected endpoints.

**Causes**:
- Token expired (default 1 hour)
- Invalid token (malformed or wrong secret)
- Missing `Authorization` header

**Solutions**:
```powershell
# Login to get new token
curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@atsofterp.com","password":"..."}' http://localhost:3000/api/auth/login

# Verify token format in request
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/profile
```

### "403 Forbidden — missing permission"

**Symptoms**: API returns 403 on endpoints the user can access but lacks specific permission.

**Causes**: User's role does not include the required permission.

**Solutions**:
1. Check user's roles in Auth module
2. Assign required permission via Access Control UI
3. Verify permission seed exists in `seed.ts`

### "500 Internal Server Error"

**Symptoms**: API returns 500 with error details.

**Causes**: Various (validation, DB constraints, unexpected errors).

**Solution**:
1. Check API console logs for stack trace
2. Check Audit module for the operation
3. Reproduce with exact request payload
4. Look for Prisma errors (usually `prisma:error` in logs)

## 2. API Error Structure

All user-facing errors follow this format:

```json
{
  "statusCode": 400,
  "messageKey": "namespace.errorKey",
  "message": "الرسالة باللغة العربية",
  "details": {},
  "timestamp": "2026-07-29T04:00:00.000Z",
  "path": "/api/maintenance/requests"
}
```

**Key fields**:
- `messageKey`: Stable key for frontend i18n lookup
- `message`: Already localized by API (Arabic or English based on request)
- `details`: Additional context (field name, constraint violated, etc.) — never contains secrets

**Internal server errors** (500) may still show stack traces in development mode. In production, these are suppressed.

## 3. Logging

### API Logs
- **Framework**: NestJS built-in logger
- **Levels**: log, warn, error, debug, verbose
- **Output**: Console (stdout)
- **Prisma**: Queries logged at debug level when `DEBUG=prisma:*` set
- **Audit**: All data mutations logged to `Audit` table (viewable via UI/API)

### Frontend Logs
- **Console**: Browser dev tools
- **Network**: All API requests visible in Network tab
- **React errors**: Console shows component errors with stack traces

## 4. Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach API",
      "port": 9229,
      "restart": true
    }
  ]
}
```

Then start API with:
```powershell
cd apps/api
npm run start:dev
```

### Console Debugging

For quick debugging in API controllers/services:
```typescript
console.log('Debug:', JSON.stringify({ key: 'value' }, null, 2));
```

In frontend components:
```typescript
console.log('Debug:', variable);
```

## 5. Common Data Issues

### Numbering Sequence Exhausted

**Symptom**: `NumberingService.generateNumberAtomic()` throws error.

**Solution**:
```sql
-- Reset the sequence (or change format/prefix via seed update)
UPDATE numberSequence 
SET currentNumber = 0, 
    lastGeneratedCode = NULL 
WHERE entityType = 'MAINTENANCE_REQUEST';
```

### Stock Balance Discrepancy

**Symptom**: UI shows different quantity than expected.

**Investigation**:
```sql
-- Check InventoryBalance
SELECT * FROM InventoryBalance WHERE productId = <productId>;

-- Check InventoryMovement
SELECT * FROM InventoryMovement WHERE productId = <productId> ORDER BY createdAt DESC;

-- Check SparePartConditionBalance
SELECT * FROM SparePartConditionBalance WHERE sparePartId = <sparePartId>;

-- Check SparePartConditionMovement
SELECT * FROM SparePartConditionMovement WHERE sparePartId = <sparePartId> ORDER BY createdAt DESC;
```

### Duplicate Installed Parts

**Symptom**: Machine shows duplicate installed part entries.

**Investigation**: Check `MachineInstalledPart` for the machine — duplicate guard should prevent this. If duplicates exist, check the guard logic in the stock issue service.

### Stuck Workflow Status

**Symptom**: Repair order or maintenance request cannot advance status.

**Investigation**:
1. Check status transition rules in the service
2. Verify user has permission for the transition
3. Check if required conditions are met (e.g., all actions completed before repair order can be marked complete)
4. Manual fix via direct API call or DB update (if absolutely necessary)

## 6. Support Contacts

| Issue | Contact |
|-------|---------|
| Technical / Code | ATsoft ERP Development Team |
| Database | ATsoft ERP DBA |
| Permissions | System Administrator |
| Data correction | System Administrator (DB-level fixes require approval) |

Report bugs and issues via GitHub Issues repository.
