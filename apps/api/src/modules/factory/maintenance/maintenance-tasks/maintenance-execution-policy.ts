import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { assertMachineComponentBelongsToMachine } from '../../../../common/operational-context/tenant-guards';

export const EXECUTION_SOURCE_TYPES = ['MAINTENANCE_REQUEST', 'WORK_ORDER', 'DIRECT'] as const;
export const EXECUTION_SCOPE_TYPES = ['MACHINE', 'PRODUCTION_LINE', 'GENERAL'] as const;
export const EXECUTABLE_REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS'];
export const EXECUTABLE_WORK_ORDER_STATUSES = ['DRAFT', 'PLANNED', 'IN_PROGRESS'];

export function executionError(messageKey: string): BadRequestException {
  return new BadRequestException({ messageKey, message: messageKey });
}

export function assertExecutionSource(source: { sourceType: string; requestId?: string | null; workOrderId?: string | null }): void {
  const valid = source.sourceType === 'MAINTENANCE_REQUEST' && !!source.requestId && !source.workOrderId
    || source.sourceType === 'WORK_ORDER' && !!source.workOrderId && !source.requestId
    || source.sourceType === 'DIRECT' && !source.requestId && !source.workOrderId;
  if (!valid) throw executionError('maintenance.executionInvalidSource');
}

export function assertExecutionScope(scope: { scopeType: string; machineId?: string | null; productionLineId?: string | null; machineComponentId?: string | null }): void {
  const valid = scope.scopeType === 'MACHINE' && !!scope.machineId
    || scope.scopeType === 'PRODUCTION_LINE' && !!scope.productionLineId && !scope.machineId && !scope.machineComponentId
    || scope.scopeType === 'GENERAL' && !scope.productionLineId && !scope.machineId && !scope.machineComponentId;
  if (!valid) throw executionError('maintenance.executionInvalidScope');
}

export async function resolveExecutionScope(client: any, input: any, ctx: ActiveOperationalContext) {
  if (!ctx?.companyId || !ctx?.branchId) throw executionError('maintenance.executionContextRequired');
  const result = {
    scopeType: input.scopeType ?? (input.machineId ? 'MACHINE' : input.productionLineId ? 'PRODUCTION_LINE' : 'GENERAL'),
    machineId: input.machineId || null,
    productionLineId: input.productionLineId || null,
    machineComponentId: input.machineComponentId || null,
    workLocation: input.workLocation?.trim() || null,
    costCenterId: input.costCenterId || null,
  };
  assertExecutionScope(result);
  if (result.machineId) {
    const machine = await client.machine.findFirst({ where: { id: result.machineId, companyId: ctx.companyId, deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] } });
    if (!machine) throw new NotFoundException({ messageKey: 'maintenance.machineNotFound' });
    if (result.productionLineId && result.productionLineId !== machine.productionLineId) throw executionError('maintenance.productionLineMachineMismatch');
    result.productionLineId = machine.productionLineId || null;
    result.costCenterId = result.costCenterId ?? machine.defaultCostCenterId ?? null;
    if (result.machineComponentId) {
      await assertMachineComponentBelongsToMachine(client, result.machineComponentId, machine.id, ctx);
      const component = await client.machineComponent.findFirst({ where: { id: result.machineComponentId, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
      if (!component) throw new NotFoundException({ messageKey: 'maintenance.componentNotFound' });
    }
  }
  if (result.productionLineId) {
    const line = await client.productionLine.findFirst({ where: { id: result.productionLineId, companyId: ctx.companyId, branchId: ctx.branchId, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    if (!line) throw new NotFoundException({ messageKey: 'maintenance.productionLineNotFound' });
  }
  if (result.costCenterId) {
    const center = await client.costCenter.findFirst({ where: { id: result.costCenterId, companyId: ctx.companyId, status: 'ACTIVE', deletedAt: null, OR: [{ branchId: ctx.branchId }, { branchId: null }] }, select: { id: true } });
    if (!center) throw new NotFoundException({ messageKey: 'maintenance.costCenterNotFound' });
  }
  return result;
}

export function executionMetrics(execution: any, now = new Date()) {
  const minutes = (start?: Date | string | null, end?: Date | string | null) => start ? Math.max(0, (new Date(end ?? now).getTime() - new Date(start).getTime()) / 60000) : 0;
  return {
    elapsedMinutes: minutes(execution.startedAt, execution.completedAt ?? execution.cancelledAt),
    totalLaborMinutes: (execution.sessions ?? []).reduce((sum: number, s: any) => sum + minutes(s.startedAt, s.endedAt), 0),
    downtimeMinutes: (execution.downtimeLogs ?? []).filter((d: any) => !d.cancelledAt && d.machineStopped).reduce((sum: number, d: any) => sum + minutes(d.startTime, d.endTime), 0),
    waitingForContinuation: execution.status === 'IN_PROGRESS' && !(execution.sessions ?? []).some((s: any) => !s.endedAt),
  };
}
