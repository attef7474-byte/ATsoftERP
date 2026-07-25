# Backend Changes — Proof Summary

## DTO Changes

### CreateMachineCategoryDto
```typescript
// Before
@IsString()
@IsNotEmpty()
code: string;

// After
@IsOptional()  // <-- code is now auto-generated
code?: string;
```

### CreateSparePartDto
```typescript
// Before
@IsString()
@IsNotEmpty()
code: string;

// After
@IsOptional()
code?: string;
```

### CreateMaintenancePersonnelDto
```typescript
// Before
@IsString()
@IsNotEmpty()
code: string;

// After
@IsOptional()
code?: string;
```

## Service Changes

### MachineCategoryService
- Injects `NumberingService` via constructor
- `create()` calls `this.numberingService.generateNumberAtomic(SequenceKey.MACHINE_CATEGORY)` and assigns result to DTO's `code` before persisting

### SparePartService
- Injects `NumberingService` via constructor
- `create()` calls `this.numberingService.generateNumberAtomic(SequenceKey.SPARE_PART)` and assigns result to DTO's `code` before persisting

### MaintenancePersonnelService
- Injects `NumberingService` via constructor
- `create()` calls `this.numberingService.generateNumberAtomic(SequenceKey.MAINTENANCE_PERSONNEL)` and assigns result to DTO's `code`
- **userId conflict check**: Before creating, queries existing personnel with same `userId`. If found, throws `ConflictException` (HTTP 409) with message "User is already linked to another personnel"
- Uses `prisma.$transaction` to atomically create `operationalPerson` and `maintenancePersonnel` records

### NumberingService
```typescript
async generateNumberAtomic(key: SequenceKey): Promise<string> {
  return this.prisma.$transaction(async (tx) => {
    const seq = await tx.numberingSequence.upsert({
      where: { key },
      create: { key, prefix: this.getPrefix(key), nextNumber: 1 },
      update: { nextNumber: { increment: 1 } },
    });
    const num = seq.nextNumber - 1; // value before increment
    return `${seq.prefix}${String(num).padStart(5, '0')}`;
  });
}
```

## Controller Changes

No controller-level changes were needed. The existing `@Post()` decorators on `MachineCategoriesController`, `SparePartsController`, and `MaintenancePersonnelController` pass the DTO directly to the service, which now handles code generation transparently.

## Sequence Key Enum

```typescript
enum SequenceKey {
  MACHINE_CATEGORY = 'MACHINE_CATEGORY',
  SPARE_PART = 'SPARE_PART',
  MAINTENANCE_PERSONNEL = 'MAINTENANCE_PERSONNEL',
  // ... other keys
}
```

Added to `settings.ts` operation maps for consistent key resolution.

## Database Schema Impact

- No schema migrations required. The `NumberingSequence` table already existed.
- The `MaintenancePersonnel.userId` column already existed in Prisma schema.
- Seeds add three rows to `NumberingSequence`.

## Verification

All backend endpoints pass their test suites. See `api-proof.md` for full test results.
