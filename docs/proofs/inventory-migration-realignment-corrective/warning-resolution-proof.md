# Warning Resolution Proof — Inventory Migration Realignment Corrective

## SQL Server NVARCHAR Index Warnings

**Original issue (DEF-001 from Batch R):** SQL Server key length warnings on NVARCHAR(1000) indexes. Max key length is 900 bytes (for clustered) or 1700 bytes (for non-clustered) but NVARCHAR(1000) can be up to 2000 bytes.

**Decision:** No change to NVARCHAR(1000) column lengths.

**Rationale:**
1. All ID columns use CUID values (25 characters × 2 bytes = 50 bytes), well under limits
2. Changing to NVARCHAR(255) in the migration would create a mismatch with schema.prisma `String` default mapping, triggering future ALTER COLUMN migrations
3. The warning is cosmetic and does not affect runtime behavior
4. DEF-001 remains documented as accepted low-severity limitation

**Verification:**
- All existing migrations use NVARCHAR(1000) for ID columns
- The new migration follows the same pattern for consistency
- No runtime impact on Batch R transfer operations
