# Corrective Prisma @Map Audit — AF-AG

## Issue

`GET /reports/maintenance/costs/analysis` and `GET /maintenance/repair-orders` return **500 Internal Server Error** because Prisma queries for camelCase column names (`actualRepairCost`) but SQL Server stores them as snake_case (`actual_repair_cost`).

## Root Cause

The AD-AE migration script (batch `c4b87ff`) created tables with **snake_case column names**. The Prisma schema uses **camelCase field names** without `@map(...)` annotations, causing Prisma to generate SQL with camelCase column lookups that fail against the existing snake_case columns.

## Affected Tables

All 4 tables created by AD-AE migration use 100% snake_case columns:

| Table | Columns | Naming Convention |
|-------|---------|-------------------|
| `spare_part_repair_orders` | 48 | All snake_case ❌ |
| `spare_part_repair_actions` | 12 | All snake_case ❌ |
| `machine_installed_parts` | 26 | All snake_case ❌ |
| `spare_part_replacement_histories` | 24 | All snake_case ❌ |

## Pre-Existing Tables (Reference)

Older tables like `maintenance_requests`, `downtime_logs`, `machines` use **camelCase columns** matching Prisma field names — no @map needed.

## Solution

Add `@map("snake_case_name")` to every Prisma field in the 4 affected models where the DB column name differs from the Prisma field name.

## No Destructive DB Changes

- No column rename
- No table recreation
- No data loss
- No `prisma db push`
- No `prisma migrate dev`
- No `prisma migrate reset`
