import type { MaintenanceTask } from './admin-types';

export type ExecutionSourceType = 'MAINTENANCE_REQUEST' | 'WORK_ORDER' | 'DIRECT';
export type ExecutionScopeType = 'MACHINE' | 'PRODUCTION_LINE' | 'GENERAL';

export interface ExecutionPartInput {
  clientRequestId: string;
  sparePartId?: string;
  productId?: string;
  warehouseId: string;
  quantity: number;
  usageType: 'CONSUMED' | 'INSTALLED' | 'REPLACED';
  issuedStockCondition?: string;
  replacementAction?: string;
  oldInstalledPartId?: string;
  removedPartCondition?: string;
  removedPartWarehouseId?: string;
  removedPartQuantity?: number;
  noReturnReason?: string;
  notes?: string;
}

/**
 * Canonical request body for issuing/using an execution part. Only the fields
 * validated by the API are sent; the optional storage-location and per-technician
 * attribution inputs are intentionally omitted so the backend resolves the
 * deterministic warehouse-level balance and the canonical execution-level
 * (shared) usage attribution.
 */
export function buildExecutionPartPayload(part: ExecutionPartInput) {
  return {
    clientRequestId: part.clientRequestId,
    ...(part.sparePartId ? { sparePartId: part.sparePartId } : {}),
    ...(part.productId ? { productId: part.productId } : {}),
    warehouseId: part.warehouseId,
    quantity: part.quantity,
    usageType: part.usageType,
    ...(part.issuedStockCondition ? { issuedStockCondition: part.issuedStockCondition } : {}),
    ...(part.replacementAction ? { replacementAction: part.replacementAction } : {}),
    ...(part.oldInstalledPartId ? { oldInstalledPartId: part.oldInstalledPartId } : {}),
    ...(part.removedPartCondition ? { removedPartCondition: part.removedPartCondition } : {}),
    ...(part.removedPartWarehouseId ? { removedPartWarehouseId: part.removedPartWarehouseId } : {}),
    ...(part.removedPartQuantity != null ? { removedPartQuantity: part.removedPartQuantity } : {}),
    ...(part.noReturnReason ? { noReturnReason: part.noReturnReason } : {}),
    ...(part.notes ? { notes: part.notes } : {}),
  };
}

/** Clear every value derived from a previous scope before another scope is selected. */
export function emptyExecutionScope(scopeType: ExecutionScopeType) {
  return { scopeType, productionLineId: '', machineId: '', machineComponentId: '' };
}

export function executionSourceReference(sourceType: ExecutionSourceType, sourceId: string) {
  if (sourceType === 'MAINTENANCE_REQUEST') return { sourceType, requestId: sourceId };
  if (sourceType === 'WORK_ORDER') return { sourceType, workOrderId: sourceId };
  return { sourceType };
}

export function isExecutionSourceEligible(status: string): boolean {
  return ['OPEN', 'DRAFT', 'PLANNED', 'IN_PROGRESS'].includes(status);
}

export function isValidHistoricalInterval(startedAt: string, completedAt: string, now = Date.now()) {
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end && end <= now;
}

export function canInstallExecutionPart(scopeType: ExecutionScopeType, machineId?: string | null) {
  return scopeType === 'MACHINE' && !!machineId;
}

export function executionWaitingForContinuation(execution: Pick<MaintenanceTask, 'status' | 'sessions'>) {
  return execution.status === 'IN_PROGRESS'
    && Array.isArray(execution.sessions)
    && execution.sessions.every((session) => !!session.endedAt);
}

/**
 * A usage line is submittable only when it resolves to an inventory product.
 * The product is either chosen directly or derived from the linked canonical
 * spare part by the editor; an unlinked spare with no product cannot be issued.
 */
export function validateExecutionParts(parts: ExecutionPartInput[]) {
  return parts.every((part) => !!part.productId
    && !!part.warehouseId && Number.isFinite(part.quantity) && part.quantity >= 0.0001 && Number.isInteger(Number((part.quantity * 10000).toFixed(6)))
    && (part.usageType !== 'REPLACED' || (!!part.oldInstalledPartId
      && (part.replacementAction === 'NO_REMOVED_PART' ? !!part.noReturnReason?.trim()
        : !!part.removedPartCondition && !!part.removedPartWarehouseId && (part.removedPartQuantity ?? 0) > 0))));
}

/**
 * Canonical result payload for a checklist item pass/fail toggle. The API
 * derives the item status ("COMPLETED") and the PASS_FAIL result token
 * ("OK"/"NOT_OK") from `passed`; sending a literal status such as "COMPLETED"
 * or "FAILED" is rejected by the checklist contract.
 */
export function checklistItemResultPayload(passed: boolean): { passed: boolean } {
  return { passed };
}
