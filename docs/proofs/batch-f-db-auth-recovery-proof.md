# Batch F — Database Authentication Recovery Proof

| Field | Value |
|-------|-------|
| Batch | F |
| Scope | Database driver fallback for Batch F import |
| Date | 2026-08-19 |
| Status | AUTHORIZED FALLBACK (Batch F only) |

---

## 1. Problem

The application's standard database driver (`mssql@12.7.0` / `tedious`) cannot authenticate to the local SQL Server instance using Windows Integrated Authentication on this machine. This affects both the Prisma client and the raw `mssql` package.

### Affected Components

| Component | Driver | Status |
|-----------|--------|--------|
| `PrismaMssql` (apps/api) | Prisma 7.8.0 + tedious | FAILS Windows Integrated Auth |
| `mssql` package | mssql@12.7.0 / tedious@11.0.4 | FAILS Windows Integrated Auth |
| `mssql/msnodesqlv8` wrapper | mssql + msnodesqlv8 binding | FAILS (wrapper issue) |
| Raw `msnodesqlv8` | msnodesqlv8 direct | **WORKS** |
| `sqlcmd` (ODBC Driver 17) | ODBC Driver 17 for SQL Server | **WORKS** |

---

## 2. Root Cause

The `tedious` driver (used by both Prisma and `mssql` package) implements its own TDS protocol authentication. On this machine (DESKTOP-HJALRR4, SQL Server 2016 SP2-GDR, instance `DESKTOP-HJALRR4\WINCC`), the tedious authentication handshake fails with Windows Integrated Authentication.

The `msnodesqlv8` driver delegates authentication to the ODBC Driver 17 for SQL Server, which correctly handles Windows Integrated Authentication via the Windows SSPI subsystem.

---

## 3. Resolution

### For Batch F Import Only

Used raw `msnodesqlv8` driver with direct ODBC connection string:

```
Driver={ODBC Driver 17 for SQL Server};Server=localhost,50079;Database=ATsoftERP_DB;Trusted_Connection=yes;
```

This bypasses the `mssql` package wrapper (which also fails) and connects directly via ODBC.

### Application DB Adapter

The application's `PrismaService` / `PrismaModule` / `PrismaMssql` / `DATABASE_URL` remain **UNCHANGED**. The Batch F import script (`batch-f-importer.js`) is a standalone script that does not use the application's Prisma client.

```
APPLICATION_DB_ADAPTER        = UNCHANGED
PRISMA_SERVICE                = UNCHANGED
PRISMA_MODULE                 = UNCHANGED
DATABASE_URL                  = UNCHANGED
NO_SQL_AUTH_ENABLED           = CONFIRMED
```

---

## 4. Verification

| Check | Result |
|-------|--------|
| Raw msnodesqlv8 connects | **PASS** |
| Parameterized queries work (? binding) | **PASS** |
| Transactions (BEGIN/COMMIT/ROLLBACK) work | **PASS** |
| SERIALIZABLE isolation works | **PASS** |
| Arabic UTF-8 text inserts correctly | **PASS** |
| DateTime2, Bit, NULL parameters work | **PASS** |
| Application Prisma client unaffected | **CONFIRMED** |
| No SQL Authentication enabled | **CONFIRMED** |

---

## 5. Scope Limitation

This fallback is authorized for **Batch F import only**. It does not affect:
- The application's runtime database access (PrismaService)
- Any API endpoints or services
- The development workflow
- Any other batch operations

The Batch F import script (`batch-f-importer.js`) will not be used for ongoing application operations.

---

## 6. Ongoing Application Access

The application continues to use PrismaMssql for all runtime operations. The Windows Integrated Authentication issue with tedious is a known environment-specific problem that does not affect production deployment (where SQL Authentication or a different environment may be used).

---

Generated: 2026-08-19
Status: **AUTHORIZED FALLBACK (Batch F only)**
