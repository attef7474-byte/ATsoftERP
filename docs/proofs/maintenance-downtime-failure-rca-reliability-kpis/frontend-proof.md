# Frontend Implementation Proof — Maintenance Downtime + Failure + RCA + Reliability KPIs

## Files Changed

### 1. Type Definitions
**`apps/web/src/lib/admin-types/maintenance.ts`**
- `DowntimeLog` interface extended with: failureCause, failureCategory, rootCause, correctiveAction, preventiveAction, detectedAt, responseStartedAt, repairStartedAt, repairCompletedAt, isRepeatFailure, repeatedFailureGroupId, machineStopped, productionImpact, rcaStatus, rcaCompletedBy, rcaCompletedAt
- New interfaces added: `RcaData`, `ReliabilityMttr`, `ReliabilityMtbf`, `ReliabilityTotalDowntime`, `ReliabilityByMachine`, `ReliabilityByCause`, `ReliabilityEmergencyResponseTime`

### 2. Dashboard Page
**`apps/web/src/app/admin/maintenance/dashboard/page.tsx`**
- New reliability KPI cards row below existing KPI cards:
  - MTTR card (Mean Time To Repair)
  - MTBF card (Mean Time Between Failures)
  - Total Downtime card
  - Reliability KPIs summary card
- Data sourced from dashboard summary endpoint (`reliability` object)

### 3. Downtime Detail Page
**`apps/web/src/app/admin/maintenance/downtime-logs/[id]/page.tsx`**
- New RCA section below main detail card showing:
  - Failure Cause
  - Failure Category
  - RCA Status (badge)
  - Root Cause
  - Corrective Action
  - Preventive Action
  - RCA Completed By
  - RCA Completed At
  - Is Repeat Failure
  - Machine Stopped
  - Production Impact
- Section only visible when at least one RCA field has data

### 4. i18n — English

**`apps/web/src/lib/i18n/locales/en/maintenance.ts`**
New keys added to `maintenance` namespace:
- `failureCause`, `failureCategory`, `rootCause`, `correctiveAction`, `preventiveAction`
- `completeRca`, `rcaStatus`, `rcaPending`, `rcaInProgress`, `rcaCompleted`
- `isRepeatFailure`, `machineStopped`, `productionImpact`
- `detectedAt`, `responseStartedAt`, `repairStartedAt`, `repairCompletedAt`
- `setFailureCause`, `setRootCause`, `setCorrectiveAction`, `setPreventiveAction`
- `reliabilityKpis`, `totalDowntime`, `mttr`, `mtbf`
- `avgResponseTime`, `topDowntimeMachines`, `topFailureCauses`
- `repeatFailures`, `downtimeByMachine`, `downtimeByLine`, `downtimeByCause`
- `noRcaData`, `rcaCompletedBy`, `rcaCompletedAt`
- `emergencyResponseTime`, `reliabilityDashboard`

### 5. i18n — Arabic
Same keys as English with Arabic translations:
- سبب العطل, تصنيف العطل, السبب الجذري, الإجراء التصحيحي, الإجراء الوقائي
- إكمال تحليل السبب الجذري, حالة تحليل السبب الجذري, etc.

### 6. i18n Check
- 2437 keys in en.ts and ar.ts — fully synchronized
- i18n check: ✅ PASS

## UI Rules Preserved
- No fake cards
- No mock counts
- All UI values from real API
- Action bar behavior preserved
- Edit prefill preserved
- Code immutability preserved
- Delete preserved
