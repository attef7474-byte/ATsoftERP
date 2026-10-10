import type { MaintenanceTask } from './admin-types';

export type ExecutionSourceType = 'MAINTENANCE_REQUEST' | 'WORK_ORDER' | 'DIRECT';
export type ExecutionScopeType = 'MACHINE' | 'PRODUCTION_LINE' | 'GENERAL';

export interface ExecutionPartInput {
  clientRequestId: string;
  sparePartId?: string;
  productId?: string;
  warehouseId: string;
  warehouseLocationId?: string;
  quantity: number;
  usageType: 'CONSUMED' | 'INSTALLED' | 'REPLACED';
  executionSessionId?: string;
  issuedStockCondition?: string;
  replacementAction?: string;
  oldInstalledPartId?: string;
  removedPartCondition?: string;
  removedPartWarehouseId?: string;
  removedPartQuantity?: number;
  noReturnReason?: string;
  notes?: string;
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
