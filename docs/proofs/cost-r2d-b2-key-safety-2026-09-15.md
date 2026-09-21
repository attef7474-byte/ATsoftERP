# B2 SQL Server key-safety matrix

Design date 2026-09-15. Physical runtime catalog verification remains a separate gate.

| Table | Object | Ordered columns / declared types | Bytes | Kind | Unique | Limit | Result |
|---|---|---|---:|---|---|---:|---|
| operational_overhead_period_allocations | ohoa_pk | id NVARCHAR(200) | 400 | clustered PK | true | 900 | SAFE |
| operational_overhead_period_allocations | ohoa_period_uq | periodId NVARCHAR(200) | 400 | unique | true | 1700 | SAFE |
| operational_overhead_period_allocations | ohoa_request_uq | companyKey NVARCHAR(200); branchKey NVARCHAR(200); clientRequestId NVARCHAR(200) | 1200 | unique | true | 1700 | SAFE |
| operational_overhead_period_allocations | ohoa_scope_ix | companyKey NVARCHAR(200); branchKey NVARCHAR(200); status NVARCHAR(10); createdAt DATETIME2(7) | 828 | index | false | 1700 | SAFE |
| operational_overhead_allocation_lines | ohol_pk | id NVARCHAR(200) | 400 | clustered PK | true | 900 | SAFE |
| operational_overhead_allocation_lines | ohol_target_purpose_uq | allocationId NVARCHAR(200); productionRunKey NVARCHAR(200); costPurpose NVARCHAR(30) | 860 | unique | true | 1700 | SAFE |
| operational_overhead_allocation_sources | ohos_pk | sourceEntryId NVARCHAR(200) | 400 | clustered PK | true | 900 | SAFE |
| operational_overhead_allocation_sources | ohos_allocation_ix | allocationId NVARCHAR(200); sourceEntryId NVARCHAR(200) | 800 | index | false | 1700 | SAFE |

8 keys, zero unsafe. NVARCHAR uses 2 bytes per declared character; DATETIME2(7) 8 bytes. No INCLUDE columns. Legacy FK columns remain NVARCHAR(1000), not directly indexed. Eight exact bounded mirrors. Three new tables, 50 columns, 14 FKs and 18 CHECKs. All FKs NO ACTION. Cross-table conservation is enforced transactionally, not by a misleading CHECK. B1/MIG-PROV physical objects unchanged.

## 2026-09-16 physical replay correction — BLOCKED

The earlier generic statement about legacy FK widths is not true for the snapshot ID parent: `production_run_cost_snapshots.id` is physically NVARCHAR(191), while the authored B2 `costSnapshotId` is NVARCHAR(1000). Fresh replay failed with SQL1753 and rolled back all three B2 tables. The eight-key arithmetic above remains design accounting only; it is not FK/catalog acceptance. The text-only FK test incorrectly assumed the same legacy-parent width and does not establish compatibility. No source repair or retry was made after the strict stop. See [the current strict-stop report](cost-r2d-b2-strict-stop-2026-09-16.md).
