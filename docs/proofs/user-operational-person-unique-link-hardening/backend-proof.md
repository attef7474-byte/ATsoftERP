# Backend Proof: User ↔ OperationalPerson Unique Link

## Status: COMPLETE

### Changes Made

#### Schema (prisma/schema.prisma)
- New `OperationalPerson` model: id, code, name, category, userId, isActive, phone, email, notes, createdAt, updatedAt
- `MaintenancePersonnel` refactored: removed columns code, name, phone, email, notes, userId
- `MaintenancePersonnel` now has `operationalPersonId` (unique FK → OperationalPerson)
- `User.operationalPeople` relation (1:many at Prisma level, 1:1 enforced by app+index)

#### Backend Services (5 files refactored)
1. `maintenance-personnel.service.ts` — Create/update splits fields across OperationalPerson + MaintenancePersonnel in transactions
2. `machine-responsibility-assignments.service.ts` — Personnel display via `maintenancePersonnel.operationalPerson`
3. `maintenance-part-accountability.service.ts` — Same pattern
4. `maintenance-request-assignments.service.ts` — Same pattern
5. `maintenance-dashboard.service.ts` — Same pattern

### API Compatibility
- All responses map nested `operationalPerson` fields to flat structure (code, name, phone, email, userId, etc.)
- Frontend F9/adapter/pages require zero changes
- Assignment DTOs still use `maintenancePersonnelId`

### Verified
- `tsc --noEmit` ✅ 0 errors
- `npm run build:api` ✅ PASS
- API running on port 4000
- List /maintenance/personnel returns 17 records with flat code/name/role
