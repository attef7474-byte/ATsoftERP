# Troubleshooting

> Admin Guide — Section 8

## Common Issues

### Port 4000 Already in Use

**Error**: `EADDRINUSE` or `listen EADDRINUSE :::4000`

**Solution**:
```powershell
# Find and kill the process on port 4000
$conn = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
# Then restart the API
npm run start:dev --workspace apps/api
```

### Port 3000 Already in Use

Same as above, but for port 3000.

### SQL Server Unreachable

**Error**: API fails to start, Prisma connection error

**Check**:
```powershell
Test-NetConnection -ComputerName localhost -Port 50079
```

If unreachable:
1. Verify SQL Server (WINCC instance) is running
2. Check SQL Server Browser service is running
3. Verify port 50079 is allowed in Windows Firewall

### Prisma Client Not Generated

**Error**: `Cannot find module '@prisma/client'`

**Solution**:
```powershell
npx prisma generate --schema apps/api/prisma/schema.prisma
```

### API Build Fails

**Error**: TypeScript compilation errors

**Solution**:
```powershell
# Check TypeScript version
npx tsc --version

# Run build with verbose output
npm run build:api 2>&1

# Fix any reported errors, then retry
```

### Web Build Fails

**Error**: Next.js build errors

**Solution**:
```powershell
# Clean the .next cache
Remove-Item -Path "apps/web/.next" -Recurse -Force

# Retry build
npm run build:web
```

### Login Fails

**Issue**: Cannot log in with valid credentials

**Check**:
1. API is running: `curl http://localhost:4000/api/v1/health`
2. User account exists in the database
3. Account is active
4. Password is correct

### 401 / 403 Permission Issue

**Issue**: Authenticated user gets 401 or 403

**Check**:
1. Token is valid (not expired)
2. User's role has the required permission
3. The endpoint is not in the public allowlist

### Browser Blank Page

**Issue**: Web page loads but shows blank content

**Check**:
1. Open browser developer console (F12)
2. Look for API errors (401/403/500)
3. Clear the `.next` cache and restart the web server:
```powershell
Remove-Item -Path "apps/web/.next" -Recurse -Force
npm run dev --workspace apps/web
```
