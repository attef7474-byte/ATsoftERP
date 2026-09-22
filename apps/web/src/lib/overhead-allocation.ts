import { api } from './api';

export interface AllocationMeta { page: number; limit: number; total: number; totalPages: number }
export interface AllocationPage<T> { data: T[]; meta: AllocationMeta }
export interface OverheadAllocation {
  id: string; periodId: string; status: 'DRAFT' | 'FINAL'; version: number;
  notes: string | null; currencyCode: string; periodFrom: string; periodTo: string;
  period: { code: string }; finalizedAt: string | null;
  _count: { lines: number; sources: number };
}
export interface OverheadAllocationLine {
  id?: string; productionRunId: string; costPurpose: string; driverQuantity: string;
  driverUnit: string; runNumberSnapshot: string; costCenterCodeSnapshot: string;
  poolAmount: string; allocatedAmount: string; currencyCode: string; runCostClosedAt: string;
}
export interface OverheadAllocationPreview extends AllocationPage<OverheadAllocationLine> {
  sourceAmount: string; sourceCount: number; targetCount: number; purposeCount: number;
}
export interface LedgerPostLine {
  lineId: string; productionRunId: string; status: 'POSTED' | 'ALREADY_POSTED' | 'SKIPPED_ZERO';
  amount: string; generation?: number; ledgerEntryId?: string; currencyCode?: string;
}
export interface LedgerPostResult {
  allocationId: string; status: 'POSTED'; currencyCode: string;
  counts: { lineCount: number; postedCount: number; alreadyPostedCount: number; zeroLineCount: number };
  lines: LedgerPostLine[];
}
export interface LedgerReversalResult {
  allocationId: string; allocationLineId: string; originalId: string; reversalId: string;
  generation: number; reversedAt: string | null;
}
export interface LedgerReportLine {
  lineId: string; productionRunId: string; costPurpose: string; allocatedAmount: string;
  eligible: boolean; status: string; reversed: boolean; livePrimaryCount: number;
  generation: number; ledgerEntryId: string | null; currencyMatch: boolean; satisfied: boolean;
  defects: string[];
}
export interface OverheadAllocationReconciliation {
  meta: { allocationId: string; allocationStatus: string; currencyCode: string; readOnly: boolean };
  aggregate: {
    sourceTotal: string; poolTotal: string; postedEligibleTotal: string; zeroTotal: string;
    activePostedTotal: string; sourcePoolConserved: boolean; poolFullyValued: boolean;
  };
  counts: {
    eligibleLineCount: number; zeroLineCount: number; postedLineCount: number; missingLineCount: number;
    ledgerPrimaryCount: number; ledgerReversalCount: number; lineDefectCount: number;
  };
  lines: LedgerReportLine[];
  decision: { status: 'ALL_CLEAN' | 'ISSUES_DETECTED'; totalDefectCount: number; lineDefectCount: number; reconciled: boolean; note: string };
}
/** Display only: preserve exact decimal text without Number/parseFloat coercion. */
export function allocationAmountText(value: string): string {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) return value;
  const [whole, fraction = ''] = value.split('.');
  return whole + '.' + fraction.padEnd(4, '0');
}
export function canFinalizeAllocation(status: string, previewLoaded: boolean, allowed: boolean, busy: boolean): boolean {
  return status === 'DRAFT' && previewLoaded && allowed && !busy;
}
export function canPostAllocationToLedger(status: string, allowed: boolean, busy: boolean): boolean {
  return status === 'FINAL' && allowed && !busy;
}
export function canReverseLedgerLine(status: string, allowed: boolean, busy: boolean): boolean {
  return status === 'POSTED' && allowed && !busy;
}
/** COST-R2D-B3: post every eligible FINAL line through the canonical cost-ledger writer. */
export function postAllocationToLedger(id: string): Promise<LedgerPostResult> {
  return api.post<LedgerPostResult>(`/production/overhead-allocations/${id}/post-to-ledger`, {});
}
/** COST-R2D-B3: read-only R1C allocation-scoped ledger reconciliation report. */
export function getAllocationReconciliation(id: string): Promise<OverheadAllocationReconciliation> {
  return api.get<OverheadAllocationReconciliation>(`/production/overhead-allocations/${id}/reconciliation`);
}
/** COST-R2D-B3: reverse a live line posting with an audited reason. */
export function reverseAllocationLedgerLine(id: string, allocationLineId: string, reason: string): Promise<LedgerReversalResult> {
  return api.post<LedgerReversalResult>(`/production/overhead-allocations/${id}/ledger-reversal`, { allocationLineId, reason });
}
