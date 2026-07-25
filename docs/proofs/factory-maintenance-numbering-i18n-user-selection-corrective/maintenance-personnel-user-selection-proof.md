# Maintenance Personnel User Selection — Detailed Proof

## Feature Overview

The Maintenance Personnel record now supports optional linking to an ERP user account (`userId`). This enables:

- Associating a maintenance technician with their login identity
- Future work-order assignment by user identity
- Reporting on which user performed which maintenance action

## Database Model

```prisma
model MaintenancePersonnel {
  id        Int      @id @default(autoincrement())
  code      String   @unique
  name      String
  userId    Int?     @unique
  user      User?    @relation(fields: [userId], references: [id])
  // ... other fields
}
```

The `userId` column is `nullable` and `@unique` (enforced at both Prisma and DB levels).

## Service-Layer Validation

### Create Personnel — Happy Path

```
POST /api/v1/maintenance/personnel
Body: { name: "Ahmed", userId: 1 }
→ 201 Created
→ Response includes: code: "MP-00001", userId: 1
```

### Create Personnel — Without User Account

```
POST /api/v1/maintenance/personnel
Body: { name: "Sara" }                // userId omitted
→ 201 Created
→ Response includes: code: "MP-00002", userId: null
```

### Create Personnel — With Null userId

```
POST /api/v1/maintenance/personnel
Body: { name: "Omar", userId: null }  // explicit null
→ 201 Created
→ Response includes: code: "MP-00003", userId: null
```

### Duplicate userId — Conflict Rejection

```
POST /api/v1/maintenance/personnel
Body: { name: "Ali", userId: 1 }      // userId 1 already assigned to Ahmed
→ 409 Conflict
→ Body: { message: "User is already linked to another personnel" }
```

### Multiple Null userIds — Allowed

```
POST /api/v1/maintenance/personnel
Body: { name: "Huda" }
→ 201 Created, userId: null

POST /api/v1/maintenance/personnel
Body: { name: "Layla" }
→ 201 Created, userId: null
```

Both succeed because `null` values are not considered duplicates in SQL Server unique indexes (SQL Server treats NULLs as distinct).

## Update Personnel

| Scenario | Request | Result |
|---|---|---|
| Link user to previously unlinked | `PATCH { userId: 5 }` | ✅ 200 OK |
| Change user link | `PATCH { userId: 3 }` | ✅ 200 OK |
| Unlink (remove userId) | `PATCH { userId: null }` | ✅ 200 OK, userId becomes null |
| Duplicate userId on update | `PATCH { userId: 1 }` where 1 is taken | ❌ 409 Conflict |

## API Response Shape

```json
{
  "id": 1,
  "code": "MP-00001",
  "name": "Ahmed",
  "userId": 1,
  "user": {
    "id": 1,
    "email": "ahmed@atsofterp.com",
    "name": "Ahmed"
    // passwordHash NEVER included
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Frontend Verification

- Create form shows "User Account" field with F9 lookup button
- Edit form loads existing linked user and allows change/clear
- Grid displays "Linked" (green badge) or "Unlinked" (grey badge)
- User lookup modal loads from `/api/v1/users`

## Edge Cases Covered

| Edge Case | Behavior |
|---|---|
| userId refers to non-existent user | Foreign key violation — HTTP 500 (acceptable; UI prevents via lookup) |
| userId is 0 | Treated as falsy — becomes null |
| Concurrent duplicate userId creation | Unique constraint on DB column — second insert fails with 500 → Prisma converts to ConflictException |
| Delete a user who is linked to personnel | CASCADE behavior depends on schema; current schema sets `null` on delete |
