# SQL Server Configuration

> Admin Guide — Section 3

## Instance Details

| Parameter | Value |
|-----------|-------|
| Instance | WINCC |
| Host | localhost |
| Port | 50079 |
| Database | ATsoftERP_DB |
| Authentication | SQL Server Authentication |

## Connection String Format

The connection string is stored in the `.env` file (never committed):

```
DATABASE_URL=sqlserver://localhost:50079;database=ATsoftERP_DB;user=USERNAME;password=PASSWORD;trustServerCertificate=true;encrypt=false
```

**Do not share or commit the actual connection string with passwords.**

## Required SQL Login

Create a SQL login with `db_datareader` and `db_datawriter` roles:

```sql
CREATE LOGIN app_user WITH PASSWORD = 'your_secure_password';
CREATE USER app_user FOR LOGIN app_user;
ALTER ROLE db_datareader ADD MEMBER app_user;
ALTER ROLE db_datawriter ADD MEMBER app_user;
```

## Verifying Connectivity

```powershell
# Test TCP connection
Test-NetConnection -ComputerName localhost -Port 50079
```

Expected: `TcpTestSucceeded: True`

## Prisma Configuration

```powershell
# Validate schema
npx prisma validate --schema apps/api/prisma/schema.prisma

# Generate client
npx prisma generate --schema apps/api/prisma/schema.prisma
```

## Important Notes

- **Do not run** `prisma db push` against the production database
- **Do not run** `prisma migrate reset` — this drops all data
- **Do not run** destructive SQL commands
- The database schema is managed through Prisma migrations (if present) or manual SQL scripts
