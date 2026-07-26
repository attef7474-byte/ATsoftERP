# Frontend UI Proof: Preventive + Emergency Execution Flow

## Schedule Detail Page (`schedules/[id]/page.tsx`)
- **Added "Generate Request" action button** in admin action bar (when status = ACTIVE)
- **Added clickable "Generate Request" card** below the main card
- **Displays new fields:**
  - `nextDueDate` — locale-formatted date or `-`
  - `lastGeneratedAt` — locale-formatted date or `-`
- All existing functionality preserved: activate, deactivate, execute, history, related request

## Schedule List Page (`schedules/page.tsx`)
- **Added `nextDueDate` column** to the data grid showing locale date or `-`

## Request Detail Page (`requests/[id]/page.tsx`)
- **Displays emergency badge** when `isEmergency = true`:
  - Label: "Emergency" (en) / "طارئ" (ar)
  - Styled as red badge

## New Request Page (`requests/new/page.tsx`)
- **Already supports EMERGENCY type** in REQUEST_TYPES dropdown

## i18n Keys Added

### English (`en/maintenance.ts`)
- `nextDueDate`: "Next Due Date"
- `lastGeneratedAt`: "Last Generated"
- `intervalDays`: "Interval (Days)"
- `isEmergency`: "Emergency"
- `generateRequest`: "Generate Request"
- `requestGenerated`: "Request generated successfully"

### Arabic (`ar/maintenance.ts`)
- `nextDueDate`: "تاريخ الاستحقاق القادم"
- `lastGeneratedAt`: "آخر توليد"
- `intervalDays`: "الفاصل (أيام)"
- `isEmergency`: "طارئ"
- `generateRequest`: "توليد طلب"
- `requestGenerated`: "تم توليد الطلب بنجاح"

## Build Verification
- `npm run build` (Web): ✅ Passed (0 errors)
