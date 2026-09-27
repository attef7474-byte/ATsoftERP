/**
 * R2-G — the repair-order read/mutation surface the operator pages share.
 *
 * Every lifecycle call goes through `submitWorkflowAction`, which posts to the
 * route segment the BACKEND named in its workflow answer. The browser therefore
 * never hard-codes a transition: it asks `/workflow` what the order supports and
 * posts to exactly that route, so a renamed or newly guarded route fails loudly
 * here instead of being silently re-implemented in the UI.
 */

import { api } from '../../../../lib/api';

/** The 13 modelled repair-order statuses, kept only for filter option lists. */
export const REPAIR_STATUS_OPTIONS = [
  'DRAFT', 'OPEN', 'IN_INSPECTION', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR',
  'UNDER_REPAIR', 'WAITING_PARTS', 'UNDER_TEST', 'COMPLETED_SERVICEABLE',
  'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE', 'SCRAPPED', 'CANCELLED',
] as const;

export const TERMINAL_REPAIR_STATUSES = [
  'COMPLETED_SERVICEABLE', 'COMPLETED_PARTIAL', 'COMPLETED_NOT_REPAIRABLE',
  'SCRAPPED', 'CANCELLED',
] as const;

/** Conditions a repair order may be created from. */
export const REPAIR_SOURCE_CONDITIONS = ['USED_REPAIRABLE', 'DAMAGED_REPAIRABLE'] as const;

/** Conditions a tested part may be returned as. */
export const REPAIR_TARGET_CONDITIONS = ['USED_SERVICEABLE', 'USED_REPAIRABLE'] as const;

export const REPAIR_ACTION_TYPES = [
  'INSPECTION', 'DIAGNOSIS', 'REPAIR', 'OVERHAUL', 'PART_REPLACED',
  'CLEANING', 'TEST', 'SCRAP_DECISION', 'STATUS_CHANGE', 'NOTE',
] as const;

export const REPAIR_ACTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE', 'FAILED', 'CANCELLED'] as const;

export interface NamedRef {
  id: string;
  code?: string | null;
  name?: string | null;
}

export interface RepairOrderAction {
  id: string;
  actionType: string;
  actionStatus?: string | null;
  description?: string | null;
  result?: string | null;
  performedByUserId?: string | null;
  performedAt?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface RepairOrderSummary {
  id: string;
  repairOrderNumber?: string | null;
  status: string;
  sparePartId: string;
  sourceCondition: string;
  sourceQuantity: number;
  reservedQuantity?: number | null;
  repairedQuantity?: number | null;
  scrappedQuantity?: number | null;
  remainingQuantity?: number | null;
  targetCondition?: string | null;
  estimatedRepairCost?: number | null;
  actualRepairCost?: number | null;
  openedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sparePart?: NamedRef | null;
  warehouse?: NamedRef | null;
  machine?: NamedRef | null;
  machineComponent?: NamedRef | null;
  maintenanceRequest?: { id: string; requestNumber?: string | null; title?: string | null } | null;
  /** R2-G — action keys the backend says this order currently supports. */
  availableActionKeys?: string[];
}

export interface RepairOrderDetail extends RepairOrderSummary {
  productId?: string | null;
  failureDescription?: string | null;
  repairDescription?: string | null;
  inspectionResult?: string | null;
  testResult?: string | null;
  testNotes?: string | null;
  externalRepair?: boolean | null;
  externalRepairProviderName?: string | null;
  notes?: string | null;
  cancelReason?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  maintenanceRequestId?: string | null;
  replacementHistoryId?: string | null;
  installedPartId?: string | null;
  conditionInMovementId?: string | null;
  conditionOutMovementId?: string | null;
  inventoryScrapMovementId?: string | null;
  machineId?: string | null;
  machineComponentId?: string | null;
  openedByUserId?: string | null;
  inspectedByUserId?: string | null;
  repairedByUserId?: string | null;
  testedByUserId?: string | null;
  closedByUserId?: string | null;
  inspectionStartedAt?: string | null;
  repairStartedAt?: string | null;
  testStartedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  actions?: RepairOrderAction[];
}

export interface WorkflowAction {
  key: string;
  route: string;
  permission: string;
  sources: string[];
  targets: string[];
  requiresInput: boolean;
  danger?: boolean;
}

export interface RepairWorkflow {
  repairOrderId: string;
  status: string;
  isTerminal: boolean;
  actions: WorkflowAction[];
}

export interface ConditionBalance {
  id: string;
  warehouseId: string;
  condition: string;
  quantity: number;
  availableQuantity?: number | null;
  warehouse?: NamedRef | null;
}

export interface QueueExactReturnSource {
  movementId: string;
  movementNumber?: string | null;
  sparePartId?: string | null;
  productId?: string | null;
  warehouseId: string;
  warehouse?: NamedRef | null;
  condition?: string | null;
  direction?: string | null;
  quantity?: number | null;
}

export interface InstalledPartContext {
  id: string;
  status?: string | null;
  installedQuantity?: number | null;
  installedCondition?: string | null;
  installedAt?: string | null;
  removedAt?: string | null;
  removedCondition?: string | null;
  removedQuantity?: number | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  sparePart?: NamedRef | null;
}

export interface RepairableQueueItem {
  replacementHistoryId: string;
  replacementNumber?: string | null;
  replacedAt?: string | null;
  replacementAction?: string | null;
  sparePart?: NamedRef | null;
  installedPart?: InstalledPartContext | null;
  removedCondition?: string | null;
  removedQuantity?: number | null;
  conditionInMovementId?: string | null;
  exactReturnSource?: QueueExactReturnSource | null;
  newSparePart?: NamedRef | null;
  newInstalledPart?: InstalledPartContext | null;
  machine?: NamedRef | null;
  machineComponent?: NamedRef | null;
  maintenanceRequest?: { id: string; requestNumber?: string | null; title?: string | null } | null;
  availableBalances?: ConditionBalance[];
  existingRepairOrder?: { id: string; status: string; repairOrderNumber?: string | null } | null;
}

export interface RepairOrderListFilters {
  status?: string;
  sourceCondition?: string;
  warehouseId?: string;
  sparePartId?: string;
  machineId?: string;
  maintenanceRequestId?: string;
  limit?: number;
}

export interface RepairableQueueFilters {
  condition?: string;
  machineId?: string;
  sparePartId?: string;
  limit?: number;
}

export async function fetchRepairOrders(filters: RepairOrderListFilters): Promise<RepairOrderSummary[]> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params[key] = value as string | number;
  }
  const result = await api.get<RepairOrderSummary[]>('/maintenance/repair-orders', { params });
  return Array.isArray(result) ? result : [];
}

export async function fetchRepairOrder(id: string): Promise<RepairOrderDetail> {
  return api.get<RepairOrderDetail>(`/maintenance/repair-orders/${id}`);
}

export async function fetchRepairWorkflow(id: string): Promise<RepairWorkflow> {
  return api.get<RepairWorkflow>(`/maintenance/repair-orders/${id}/workflow`);
}

export async function fetchRepairableQueue(filters: RepairableQueueFilters): Promise<RepairableQueueItem[]> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params[key] = value as string | number;
  }
  const result = await api.get<RepairableQueueItem[]>('/maintenance/repair-orders/queue', { params });
  return Array.isArray(result) ? result : [];
}

export async function fetchRepairActions(id: string): Promise<RepairOrderAction[]> {
  const result = await api.get<RepairOrderAction[]>(`/maintenance/repair-orders/${id}/actions`);
  return Array.isArray(result) ? result : [];
}

/**
 * Create a repair order from a removed replacement part.
 *
 * This is the only creation path the operator UI exposes: the backend derives
 * the removed part, the exact return warehouse and the stock-in movement from
 * the replacement history, so no source can be invented by hand.
 */
export async function createRepairOrderFromReplacement(
  replacementHistoryId: string,
  notes?: string,
): Promise<RepairOrderDetail> {
  return api.post<RepairOrderDetail>('/maintenance/repair-orders/from-replacement-history', {
    replacementHistoryId,
    ...(notes ? { notes } : {}),
  });
}

export interface RepairActionPayload {
  actionType: string;
  actionStatus?: string;
  description?: string;
  result?: string;
  performedAt?: string;
  durationMinutes?: number;
  notes?: string;
}

export async function createRepairAction(
  id: string,
  payload: RepairActionPayload,
): Promise<RepairOrderAction> {
  return api.post<RepairOrderAction>(`/maintenance/repair-orders/${id}/actions`, payload);
}

/**
 * Post a lifecycle transition to the exact route the backend published in its
 * workflow answer. The route is a parameter rather than a constant so the UI can
 * never call a transition the backend did not offer for this status.
 */
export async function submitWorkflowAction(
  id: string,
  route: string,
  payload: Record<string, unknown>,
): Promise<RepairOrderDetail> {
  return api.post<RepairOrderDetail>(`/maintenance/repair-orders/${id}/${route}`, payload);
}
