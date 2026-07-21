# Current State

## Frontend Page
- Route: `/admin/settings/numbering`
- Component: `NumberingPage` in `apps/web/src/app/admin/settings/numbering/page.tsx`
- Table columns: 8 columns (code, name, prefix, currentNumber, padding, scope, status, nextPreview)
- Missing columns: suffix, nextNumber, increment, resetPolicy, lastGeneratedCode, modelName, operationName
- Edit modal: Only prefix, suffix, padding (missing: increment, nextNumber, resetPolicy, status)
- Preview: Uses frontend `computePreview()` function instead of backend endpoint

## Backend API
- Controller: `/api/v1/numbering` (versioned v1)
- Endpoints:
  - POST /numbering (create)
  - GET /numbering (list with pagination)
  - GET /numbering/:id (detail)
  - GET /numbering/:id/preview (preview next number)
  - GET /numbering/code/:code (find by code)
  - PATCH /numbering/:id (update)
  - POST /numbering/generate (generate number)

## Database Model (Prisma)
```prisma
model NumberSequence {
  id            String    @id @default(cuid())
  code          String    @unique
  name          String
  prefix        String
  suffix        String?
  currentNumber Int       @default(0)
  padding       Int       @default(6)
  scope         String    @default("GLOBAL")
  companyId     String?
  branchId      String?
  branch        Branch?   @relation(...)
  resetPolicy   String    @default("NEVER")
  lastResetAt   DateTime?
  status        String    @default("ACTIVE")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  @@map("number_sequences")
}
```
Missing fields: `increment`, `operationName`, `modelName`, `lastGeneratedCode`

## Seed Data
Current approved sequences (7):
1. MAINTENANCE_REQUEST - MR-
2. MACHINE - MCH-
3. PRODUCT - PRD-
4. INVENTORY_COUNT - IC-
5. INVENTORY_MOVEMENT - IM-
6. INVENTORY_ADJUSTMENT - IA-
7. BARCODE_LABEL - BCL-

Rejected sequences (3 - from seed-business-partner-permissions.ts):
8. BUSINESS_PARTNER - BP- (Sales/Purchasing - REJECTED)
9. CUSTOMER - CUS- (Sales - REJECTED)
10. SUPPLIER - SUP- (Purchasing - REJECTED)

## i18n Translations (ar.ts)
Current numbering section:
- padding: "المساحة" (WRONG - should be "عدد الخانات")
- Missing: increment, nextNumber, resetPolicy values, status values, scope values, operationName, modelName, lastGeneratedCode