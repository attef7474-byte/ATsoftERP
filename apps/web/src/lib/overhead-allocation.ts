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
/** Display only: preserve exact decimal text without Number/parseFloat coercion. */
export function allocationAmountText(value: string): string {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) return value;
  const [whole, fraction = ''] = value.split('.');
  return whole + '.' + fraction.padEnd(4, '0');
}
export function canFinalizeAllocation(status: string, previewLoaded: boolean, allowed: boolean, busy: boolean): boolean {
  return status === 'DRAFT' && previewLoaded && allowed && !busy;
}
