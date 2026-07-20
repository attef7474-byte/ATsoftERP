# SQL Server Integration Log

> Batch 37 — SQL Server connectivity and API integration verification

## Connection Details

| Parameter | Value |
|-----------|-------|
| Instance | WINCC |
| Host | localhost |
| Port | 50079 |
| Database | ATsoftERP_DB |
| Authentication | SQL Login (`atsofterp_dev`) |

## Connectivity Verification

| Check | Result | Detail |
|-------|--------|--------|
| TCP Port 50079 | ✅ Reachable | `Test-NetConnection -ComputerName localhost -Port 50079` → TcpTestSucceeded: True |
| Prisma Schema Validation | ✅ Passed | `npx prisma validate` — no errors |
| Prisma Client Generation | ✅ Passed | `npx prisma generate` — PrismaMssql datasource |

## Prisma Configuration

The `DATABASE_URL` connection string is configured as:
```
sqlserver://localhost:50079;database=ATsoftERP_DB;user=atsofterp_dev;password=********;trustServerCertificate=true;encrypt=false
```

The `PrismaService` passes this connection string directly to the `PrismaMssql` adapter:
```typescript
constructor() {
  super({
    datasources: { db: { url: process.env.DATABASE_URL } },
    adapter: new PrismaMssql(process.env.DATABASE_URL),
  });
}
```

## SQL Login

| Property | Value |
|----------|-------|
| Login Name | `atsofterp_dev` |
| Default Database | `ATsoftERP_DB` |
| Server Roles | `public` |
| Database Roles | `db_datareader`, `db_datawriter` |

## Health Check

API health endpoint confirms application is running with SQL Server connectivity:
```
GET /api/v1/health → 200 {"status":"ok"}
```
