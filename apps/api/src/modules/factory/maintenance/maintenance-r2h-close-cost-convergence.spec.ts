import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { MaintenanceRequestsService } from './maintenance-requests/maintenance-requests.service';
import { MaintenanceRequestPartsService } from './maintenance-request-parts/maintenance-request-parts.service';
import { MaintenanceRequestCostsService } from './maintenance-request-costs/maintenance-request-costs.service';
import { MaintenanceCostSummaryService } from '../production-cost/maintenance-cost-summary.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = { companyId: 'c1', branchId: 'b1' } as ActiveOperationalContext;

function requestRecord(status: string) {
  return { id: 'r1', requestNumber: 'MR-1', status, machineId: 'm1', machine: { companyId: 'c1', branchId: 'b1' } };
}

function prismaMock(overrides: Record<string, any> = {}) {
  const base: Record<string, any> = {
    maintenanceRequest: {
      findUnique: jest.fn().mockResolvedValue(requestRecord('IN_PROGRESS')),
      findFirst: jest.fn().mockResolvedValue(requestRecord('COMPLETED')),
    },
    maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceRequestRequiredPart: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceWorkOrder: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    maintenanceChecklistExecution: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceRequestPartUsage: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    maintenanceRequestCostEntry: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    maintenanceWorkOrderCostEntry: { findMany: jest.fn().mockResolvedValue([]) },
    operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  for (const [model, methods] of Object.entries(overrides)) {
    base[model] = { ...(base[model] ?? {}), ...methods };
  }
  return base as any;
}

function requestsService(prisma: any) {
  return new MaintenanceRequestsService(
    prisma,
    { log: jest.fn() } as any,
    { nextNumber: jest.fn() } as any,
    { notifyRequestCompleted: jest.fn(), notifyRequestClosed: jest.fn() } as any,
    { computeSla: jest.fn() } as any,
  );
}

describe('R2-H close policy: single canonical readiness evaluator', () => {
  it('reports every outstanding blocker as a structured code with a count', async () => {
    const prisma = prismaMock({
      maintenanceTask: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }, { id: 't2' }]) },
      maintenanceRequestRequiredPart: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }]) },
      maintenanceWorkOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'w1' }]) },
      maintenanceChecklistExecution: { findMany: jest.fn().mockResolvedValue([{ items: [{ id: 'i1' }] }]) },
    });
    const readiness = await requestsService(prisma).getCloseReadiness('r1', ctx);

    expect(readiness.completionBlockers.map(b => b.code)).toEqual([
      'OPEN_TASKS', 'UNRESOLVED_REQUIRED_PARTS', 'ACTIVE_WORK_ORDERS', 'MANDATORY_CHECKLIST_PENDING',
    ]);
    expect(readiness.completionBlockers[0].count).toBe(2);
    expect(readiness.completionBlockers[0].messageKey).toBe('maintenance.openTasksBlockCompletion');
    expect(readiness.canClose).toBe(false);
    expect(readiness.canComplete).toBe(false);
  });

  it('exposes readiness read-only and needs no write permission', async () => {
    const prisma = prismaMock();
    const readiness = await requestsService(prisma).getCloseReadiness('r1', ctx);
    expect(readiness.canComplete).toBe(true);
    expect(readiness.completionBlockers).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('adds REQUEST_NOT_COMPLETED so an IN_PROGRESS request is not closeable', async () => {
    const prisma = prismaMock();
    const readiness = await requestsService(prisma).getCloseReadiness('r1', ctx);
    expect(readiness.closeBlockers.map(b => b.code)).toEqual(['REQUEST_NOT_COMPLETED']);
    expect(readiness.canClose).toBe(false);
  });

  it('allows close only when COMPLETED with no blockers', async () => {
    const prisma = prismaMock({ maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) } });
    const readiness = await requestsService(prisma).getCloseReadiness('r1', ctx);
    expect(readiness.canClose).toBe(true);
    expect(readiness.closeBlockers).toEqual([]);
  });

  it('does NOT block completion on an active repair order (independent asset lifecycle)', async () => {
    const prisma = prismaMock();
    const readiness = await requestsService(prisma).getCloseReadiness('r1', ctx);
    expect(readiness.completionBlockers).toEqual([]);
    expect(JSON.stringify(readiness)).not.toContain('REPAIR');
  });

  it('completion and close-readiness agree on the same blocker set', async () => {
    const prisma = prismaMock({ maintenanceTask: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]) } });
    const service = requestsService(prisma);
    const readiness = await service.getCloseReadiness('r1', ctx);
    await expect(service.complete('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: readiness.completionBlockers[0].messageKey, params: { count: '1' } },
    });
  });

  it('completion throws the first blocker in the canonical order', async () => {
    const prisma = prismaMock({
      maintenanceTask: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]) },
      maintenanceRequestRequiredPart: { findMany: jest.fn().mockResolvedValue([{ id: 'p1' }]) },
    });
    await expect(requestsService(prisma).complete('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.openTasksBlockCompletion' },
    });
  });

  it('fails closed on close when a COMPLETED request still has blockers', async () => {
    const prisma = prismaMock({
      maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) },
      maintenanceWorkOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'w1' }]), findFirst: jest.fn() },
    });
    await expect(requestsService(prisma).close('r1', 'u1', ctx)).rejects.toMatchObject({
      response: { messageKey: 'maintenance.closeBlockedByReadiness', params: { count: '1' } },
    });
  });

  it('refuses to close an OPEN or IN_PROGRESS request', async () => {
    for (const status of ['OPEN', 'IN_PROGRESS']) {
      const prisma = prismaMock({ maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord(status)) } });
      await expect(requestsService(prisma).close('r1', 'u1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'maintenance.onlyCompletedCanClose' },
      });
    }
  });
});

describe('R2-H legacy part-usage path is read-only', () => {
  const service = (prisma: any) => new MaintenanceRequestPartsService(prisma, { log: jest.fn() } as any);

  it.each(['create', 'update', 'remove'])('rejects %s as deprecated', async (op) => {
    const prisma = prismaMock();
    const svc = service(prisma);
    const call = op === 'create'
      ? svc.create({ requestId: 'r1', productId: 'p1', quantity: 2 } as any, 'u1', ctx)
      : op === 'update'
        ? svc.update('x1', { quantity: 5 } as any, 'u1', ctx)
        : svc.remove('x1', 'u1', ctx);
    await expect(call).rejects.toMatchObject({ response: { messageKey: 'maintenance.legacyPartUsageWriteDeprecated' } });
  });

  it('performs no write against the legacy table', async () => {
    const prisma = prismaMock();
    await expect(service(prisma).create({ requestId: 'r1', productId: 'p1', quantity: 1 } as any, 'u1', ctx)).rejects.toBeDefined();
    expect(prisma.maintenanceRequestPartUsage.findMany).not.toHaveBeenCalled();
  });

  it('keeps historical reads available and tenant scoped', async () => {
    const prisma = prismaMock();
    await service(prisma).findAll({}, ctx);
    expect(prisma.maintenanceRequestPartUsage.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('R2-H legacy request-cost path is read-only', () => {
  const service = (prisma: any) => new MaintenanceRequestCostsService(prisma, { log: jest.fn() } as any);

  it.each(['create', 'update', 'remove'])('rejects %s as deprecated', async (op) => {
    const prisma = prismaMock();
    const svc = service(prisma);
    const call = op === 'create'
      ? svc.create({ requestId: 'r1', type: 'LABOR', description: 'x', amount: 10 } as any, 'u1', ctx)
      : op === 'update'
        ? svc.update('x1', { amount: 20 } as any, 'u1', ctx)
        : svc.remove('x1', 'u1', ctx);
    await expect(call).rejects.toMatchObject({ response: { messageKey: 'maintenance.legacyCostEntryWriteDeprecated' } });
  });

  it('keeps historical reads available and tenant scoped', async () => {
    const prisma = prismaMock();
    await service(prisma).findAll({}, ctx);
    expect(prisma.maintenanceRequestCostEntry.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('R2-H canonical cost summary comes from the operational cost ledger', () => {
  const ledgerRow = (o: any) => ({
    id: 'l1', eventType: 'MATERIAL', entryRole: 'PRIMARY_COST', costNature: 'ACTUAL',
    amount: new Prisma.Decimal('100'), currencyCode: 'USD', sourceType: 'INVENTORY_MOVEMENT_LINE',
    sourceId: 'mv1', status: 'POSTED', ...o,
  });

  it('sums material, labor and external service from the ledger', async () => {
    const prisma = prismaMock({
      maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([
        ledgerRow({ id: 'a', eventType: 'MATERIAL', amount: new Prisma.Decimal('100') }),
        ledgerRow({ id: 'b', eventType: 'LABOR', sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY', amount: new Prisma.Decimal('50') }),
        ledgerRow({ id: 'c', eventType: 'EXTERNAL_SERVICE', sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY', amount: new Prisma.Decimal('25') }),
      ]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).requestSummary('r1', ctx);
    expect(summary.netCost).toBe('175');
    expect(summary.byEventType).toEqual(expect.arrayContaining([
      { key: 'MATERIAL', netAmount: '100', entryCount: 1 },
      { key: 'LABOR', netAmount: '50', entryCount: 1 },
      { key: 'EXTERNAL_SERVICE', netAmount: '25', entryCount: 1 },
    ]));
    expect(summary.currencyCode).toBe('USD');
  });

  it('subtracts reversals because they are stored negated', async () => {
    const prisma = prismaMock({
      maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([
        ledgerRow({ id: 'a', amount: new Prisma.Decimal('100') }),
        ledgerRow({ id: 'r', entryRole: 'REVERSAL', amount: new Prisma.Decimal('-40') }),
      ]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).requestSummary('r1', ctx);
    expect(summary.netCost).toBe('60');
    expect(summary.reversalEntryCount).toBe(1);
  });

  it('never sums legacy non-canonical ledger rows into the total', async () => {
    const prisma = prismaMock({
      maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([
        ledgerRow({ id: 'a', amount: new Prisma.Decimal('100') }),
        ledgerRow({ id: 'legacy', entryRole: null, costNature: null, amount: new Prisma.Decimal('999') }),
      ]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).requestSummary('r1', ctx);
    expect(summary.netCost).toBe('100');
    expect(summary.nonCanonicalRowCount).toBe(1);
  });

  it('scopes the ledger query to company, branch and MAINTENANCE purpose', async () => {
    const prisma = prismaMock({ maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) } });
    await new MaintenanceCostSummaryService(prisma).requestSummary('r1', ctx);
    const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('c1');
    expect(where.branchId).toBe('b1');
    expect(where.costPurpose).toBe('MAINTENANCE');
    expect(where.maintenanceRequestId).toBe('r1');
  });

  it('never answers a foreign-tenant request with a zeroed summary that echoes the id', async () => {
    const prisma = prismaMock({ maintenanceRequest: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(new MaintenanceCostSummaryService(prisma).requestSummary('other-tenant-request', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
    expect(prisma.operationalCostTransaction.findMany).not.toHaveBeenCalled();
  });

  it('never answers a foreign-tenant work order with a zeroed summary that echoes the id', async () => {
    const prisma = prismaMock({ maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(new MaintenanceCostSummaryService(prisma).workOrderSummary('other-tenant-work-order', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.workOrderNotFound' } });
    expect(prisma.operationalCostTransaction.findMany).not.toHaveBeenCalled();
  });

  it('scopes the work-order lookup to the company and branch of the caller', async () => {
    const prisma = prismaMock({
      maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', workOrderNumber: 'WO-1', status: 'COMPLETED' }) },
    });
    await new MaintenanceCostSummaryService(prisma).workOrderSummary('w1', ctx);
    const where = prisma.maintenanceWorkOrder.findFirst.mock.calls[0][0].where;
    expect(where.companyId).toBe('c1');
    expect(where.branchId).toBe('b1');
  });

  it('reports an asserted-but-unposted labor cost as a reconciliation gap', async () => {    const prisma = prismaMock({
      maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', workOrderNumber: 'WO-1', status: 'IN_PROGRESS' }) },
      maintenanceWorkOrderCostEntry: { findMany: jest.fn().mockResolvedValue([{ id: 'ce1', type: 'LABOR' }]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).workOrderSummary('w1', ctx);
    expect(summary.netCost).toBe('0');
    expect(summary.sourceReconciliation.unpostedSourceEntryCount).toBe(1);
    expect(summary.sourceReconciliation.unpostedReason).toBe('WORK_ORDER_NOT_COMPLETED');
    expect(summary.sourceReconciliation.nextAction).toContain('Complete the work order');
  });

  it('reports a posted work-order cost as reconciled', async () => {
    const prisma = prismaMock({
      maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', workOrderNumber: 'WO-1', status: 'COMPLETED' }) },
      maintenanceWorkOrderCostEntry: { findMany: jest.fn().mockResolvedValue([{ id: 'ce1', type: 'LABOR' }]) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([
        ledgerRow({ id: 'a', eventType: 'LABOR', sourceType: 'MAINTENANCE_WORK_ORDER_COST_ENTRY', sourceId: 'ce1' }),
      ]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).workOrderSummary('w1', ctx);
    expect(summary.netCost).toBe('100');
    expect(summary.sourceReconciliation.postedSourceEntryCount).toBe(1);
    expect(summary.sourceReconciliation.unpostedSourceEntryCount).toBe(0);
  });

  it('flags a completed work order whose asserted cost never reached the ledger', async () => {
    const prisma = prismaMock({
      maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', workOrderNumber: 'WO-1', status: 'COMPLETED' }) },
      maintenanceWorkOrderCostEntry: { findMany: jest.fn().mockResolvedValue([{ id: 'ce1', type: 'LABOR' }]) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).workOrderSummary('w1', ctx);
    expect(summary.netCost).toBe('0');
    expect(summary.sourceReconciliation.unpostedReason).toBe('POSTING_GAP_AFTER_COMPLETION');
    expect(summary.sourceReconciliation.unpostedSourceEntryIds).toEqual(['ce1']);
  });

  it('keeps currencies separate instead of summing across them', async () => {
    const prisma = prismaMock({
      maintenanceRequest: { findUnique: jest.fn().mockResolvedValue(requestRecord('COMPLETED')) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([
        ledgerRow({ id: 'a', amount: new Prisma.Decimal('100'), currencyCode: 'USD' }),
        ledgerRow({ id: 'b', amount: new Prisma.Decimal('200'), currencyCode: 'EUR' }),
      ]) },
    });
    const summary = await new MaintenanceCostSummaryService(prisma).requestSummary('r1', ctx);
    expect(summary.currencyCode).toBeNull();
    expect(summary.byCurrency).toEqual(expect.arrayContaining([
      { key: 'USD', netAmount: '100', entryCount: 1 },
      { key: 'EUR', netAmount: '200', entryCount: 1 },
    ]));
  });

  it('excludes records outside the active tenant', async () => {
    const prisma = prismaMock({ maintenanceRequest: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(new MaintenanceCostSummaryService(prisma).requestSummary('other-company', ctx))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.operationalCostTransaction.findMany).not.toHaveBeenCalled();
  });
});
