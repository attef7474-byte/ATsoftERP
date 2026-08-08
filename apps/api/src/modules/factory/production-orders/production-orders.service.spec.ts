import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionOrdersService } from './production-orders.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const record = (overrides: Record<string, any> = {}) => ({
  id: 'po1', orderNumber: 'PO-000001', clientRequestId: 'req-1', companyId: 'c1', branchId: 'b1',
  productionProductDefinitionId: 'p1', productionVersionId: 'v1', productionPackagingId: null,
  productionUnitId: 'u1', productionLineId: 'l1', machineId: null,
  plannedQuantity: '1000.0000', quantityUnit: 'UNIT', capacityTimeBasis: 'HOUR',
  plannedStartAt: new Date('2026-02-01T08:00:00.000Z'), plannedEndAt: new Date('2026-02-01T16:00:00.000Z'),
  priority: 'NORMAL', sourceType: 'MANUAL', sourceReference: null, costCenterId: 'cc1',
  issueWarehouseId: null, receiptWarehouseId: null,
  capacityStandardId: 'cs1', capacityStandardCodeSnapshot: 'PCS-000001', capacityStandardRevisionSnapshot: 1,
  standardRateSnapshot: '100.0000', outputUnitSnapshot: 'UNIT', timeBasisSnapshot: 'HOUR',
  standardCycleTimeMinutesSnapshot: null, setupMinutesSnapshot: '0', changeoverMinutesSnapshot: '0',
  cleaningMinutesSnapshot: '0', startupAllowanceMinutesSnapshot: '0', shutdownAllowanceMinutesSnapshot: '0',
  targetEfficiencyPercentSnapshot: '90.0000', expectedYieldPercentSnapshot: '98.0000',
  capacityEffectiveFromSnapshot: new Date('2026-01-01T00:00:00Z'), capacityEffectiveToSnapshot: null,
  plannedGrossQuantity: '1000', plannedRunMinutes: '600', plannedAllowanceMinutes: '0', plannedDurationMinutes: '600',
  durationCalculationVersion: 'PHASE_1_4_V1', snapshotFrozenAt: null,
  status: 'DRAFT', lockVersion: 0,
  plannedById: null, plannedAt: null, releasedById: null, releasedAt: null,
  cancelledById: null, cancelledAt: null, cancellationReason: null,
  archivedById: null, archivedAt: null, archiveReason: null,
  closedById: null, closedAt: null, closureReason: null,
  notes: null, createdById: 'maker', updatedById: 'maker',
  createdAt: new Date('2026-02-01T07:00:00.000Z'), updatedAt: new Date('2026-02-01T07:00:00.000Z'), deletedAt: null,
  ...overrides,
});

describe('ProductionOrdersService', () => {
  let prisma: any;
  let model: any;
  let audit: any;
  let numbering: any;
  let capacityStandards: any;
  let attachments: any;
  let materialRequirements: any;
  let service: ProductionOrdersService;

  beforeEach(() => {
    model = { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
    prisma = {
      productionOrder: model,
      productionOrderTransition: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      productionOrderAttachment: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', code: 'PROD-1', name: 'Product 1', status: 'ACTIVE' }) },
      productionVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'v1', versionNumber: 1, versionLabel: 'v1' }) },
      productionPackaging: { findFirst: jest.fn().mockResolvedValue({ id: 'pkg1' }) },
      productionUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', code: 'UNIT', name: 'Unit' }) },
      productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'l1', code: 'L1', name: 'Line 1' }) },
      machine: { findFirst: jest.fn().mockResolvedValue(null) },
      productionEligibility: { findFirst: jest.fn().mockResolvedValue({ id: 'e1', resourceType: 'LINE', productionLineId: 'l1' }) },
      costCenter: { findFirst: jest.fn().mockResolvedValue({ id: 'cc1' }) },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'w1' }) },
      productionRun: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('PO-000001') };
    capacityStandards = {
      resolveWithClient: jest.fn().mockResolvedValue({
        id: 'cs1', code: 'PCS-000001', revision: 1,
        productionProductId: 'p1', productionVersionId: 'v1', productionPackagingId: null,
        productionLineId: 'l1', machineId: null,
        standardRate: '100.0000', outputUnit: 'UNIT', timeBasis: 'HOUR',
        standardCycleTimeMinutes: null, setupMinutes: '0', changeoverMinutes: '0', cleaningMinutes: '0',
        startupAllowanceMinutes: '0', shutdownAllowanceMinutes: '0',
        targetEfficiencyPercent: '90.0000', expectedYieldPercent: '98.0000',
        effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null,
      }),
    };
    attachments = {
      create: jest.fn().mockResolvedValue({ id: 'att1', originalName: 'spec.pdf' }),
      remove: jest.fn().mockResolvedValue({}),
      getFilePath: jest.fn().mockReturnValue('/tmp/spec.pdf'),
    };
    materialRequirements = { freezeForRelease: jest.fn().mockResolvedValue(null) };
    service = new ProductionOrdersService(prisma, audit, numbering, capacityStandards, attachments, materialRequirements);
  });

  const createDto: any = {
    clientRequestId: 'req-1',
    productionProductDefinitionId: 'p1',
    productionVersionId: 'v1',
    productionPackagingId: undefined,
    productionUnitId: 'u1',
    productionLineId: 'l1',
    machineId: undefined,
    plannedQuantity: '1000.0000',
    capacityTimeBasis: 'HOUR',
    plannedStartAt: '2026-02-01T08:00:00.000Z',
    plannedEndAt: '2026-02-01T16:00:00.000Z',
    priority: 'NORMAL',
    sourceType: 'MANUAL',
    sourceReference: undefined,
    costCenterId: 'cc1',
    issueWarehouseId: undefined,
    receiptWarehouseId: undefined,
    notes: undefined,
  };

  it('creates a tenant-owned DRAFT with snapshot, transition, and audit', async () => {
    model.create.mockImplementation(({ data }: any) => Promise.resolve(record({ id: 'po-created', ...data })));
    const result = await service.create({ ...createDto, companyId: 'evil', branchId: 'evil' }, 'maker', ctxA);
    expect(result.status).toBe('DRAFT');
    expect(result.orderNumber).toBe('PO-000001');
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'DRAFT', capacityStandardCodeSnapshot: 'PCS-000001' }) }));
    expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('PRODUCTION_ORDER', prisma);
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'NONE', toStatus: 'DRAFT', action: 'CREATE', requestId: 'req-1' }) }));
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'CREATE', entity: 'ProductionOrder', entityId: 'po-created' }));
  });

  it('returns the existing order when the same create intent is replayed', async () => {
    model.findFirst.mockResolvedValue(record());
    const result = await service.create(createDto, 'maker', ctxA);
    expect(result.id).toBe('po1');
    expect(model.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a replay with a different create intent', async () => {
    model.findFirst.mockResolvedValue(record({ plannedQuantity: '500.0000' }));
    await expect(service.create(createDto, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects references outside the active tenant', async () => {
    prisma.productionProductDefinition.findFirst.mockResolvedValue(null);
    await expect(service.create(createDto, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('rejects a machine that does not belong to the tenant line', async () => {
    prisma.machine.findFirst.mockResolvedValue(null);
    await expect(service.create({ ...createDto, machineId: 'm-other' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.machine.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', productionLineId: 'l1' }) });
  });

  it('requires exact machine or line eligibility', async () => {
    prisma.productionEligibility.findFirst.mockResolvedValue(null);
    await expect(service.create(createDto, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-positive quantity and invalid windows', async () => {
    await expect(service.create({ ...createDto, plannedQuantity: '0' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ ...createDto, plannedStartAt: '2026-02-01T16:00:00.000Z', plannedEndAt: '2026-02-01T08:00:00.000Z' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes direct reads by company and branch and returns not found across tenants', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce(null);
    expect((await service.findOne('po1', ctxA)).id).toBe('po1');
    await expect(service.findOne('po1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'po1', companyId: 'c2', branchId: 'b2', deletedAt: null }) }));
  });

  it('scopes the list query by tenant and applies filters', async () => {
    model.findMany.mockResolvedValue([]);
    model.count.mockResolvedValue(0);
    const result = await service.findAll({ page: 1, limit: 10, status: 'DRAFT' }, ctxA);
    expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'DRAFT', deletedAt: null }) }));
    expect(result.meta).toEqual(expect.objectContaining({ page: 1, limit: 10, total: 0, totalPages: 0 }));
  });

  it('previews the plan without creating or numbering', async () => {
    const preview = await service.preview(createDto, ctxA);
    expect(preview.capacityStandardCode).toBe('PCS-000001');
    expect(preview.plannedDurationMinutes).toBeDefined();
    expect(model.create).not.toHaveBeenCalled();
    expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
  });

  it('updates only editable DRAFT/PLANNED orders and increments the lock version', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce(record({ lockVersion: 1 }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const updated = await service.update('po1', { lockVersion: 0, notes: 'new note' }, 'u2', ctxA);
    expect(updated.lockVersion).toBe(1);
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'po1', companyId: 'c1', branchId: 'b1', lockVersion: 0 }),
      data: expect.objectContaining({ lockVersion: { increment: 1 }, notes: 'new note' }),
    }));
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'UPDATE' }));
  });

  it('rejects updates on non-editable statuses', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'RELEASED' }));
    await expect(service.update('po1', { lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('rejects updates with a stale lock version', async () => {
    model.findFirst.mockResolvedValue(record({ lockVersion: 1 }));
    await expect(service.update('po1', { lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('plans a DRAFT order with a transition and audit', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce(record({ status: 'PLANNED', lockVersion: 1 }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const planned = await service.plan('po1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA);
    expect(planned.status).toBe('PLANNED');
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'DRAFT' }) }));
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'DRAFT', toStatus: 'PLANNED', action: 'PLAN', requestId: 'req-p' }) }));
  });

  it('rejects planning an order that is not DRAFT', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'PLANNED' }));
    await expect(service.plan('po1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays an identical action request idempotently', async () => {
    prisma.productionOrderTransition.findFirst.mockResolvedValue({ id: 't1', action: 'PLAN' });
    model.findFirst.mockResolvedValue(record());
    const result = await service.plan('po1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA);
    expect(result.id).toBe('po1');
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an action replay with a different action', async () => {
    prisma.productionOrderTransition.findFirst.mockResolvedValue({ id: 't1', action: 'RELEASE' });
    model.findFirst.mockResolvedValue(record());
    await expect(service.plan('po1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('releases a PLANNED order when readiness passes', async () => {
    model.findFirst.mockResolvedValueOnce(record({ status: 'PLANNED' })).mockResolvedValueOnce(record({ status: 'RELEASED', lockVersion: 1, snapshotFrozenAt: new Date() }));
    model.updateMany.mockResolvedValue({ count: 1 });
    prisma.productionOrder.findMany.mockResolvedValue([]);
    const released = await service.release('po1', { requestId: 'req-r', lockVersion: 0 }, 'u2', ctxA);
    expect(released.status).toBe('RELEASED');
    expect(prisma.productionOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'RELEASED', productionLineId: 'l1', companyId: 'c1', branchId: 'b1' }) }));
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'PLANNED', toStatus: 'RELEASED', action: 'RELEASE' }) }));
    expect(materialRequirements.freezeForRelease).toHaveBeenCalledWith('po1', 'u2', ctxA, prisma);
  });

  it('rejects release from a non-PLANNED state', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'DRAFT' }));
    await expect(service.release('po1', { requestId: 'req-r', lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks release when readiness fails', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'PLANNED' }));
    prisma.productionProductDefinition.findFirst.mockResolvedValue(null);
    await expect(service.release('po1', { requestId: 'req-r', lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('cancels allowed statuses with a reason', async () => {
    model.findFirst.mockResolvedValueOnce(record({ status: 'RELEASED' })).mockResolvedValueOnce(record({ status: 'CANCELLED', lockVersion: 1 }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const cancelled = await service.cancel('po1', { requestId: 'req-c', lockVersion: 0, reason: 'no demand' }, 'u2', ctxA);
    expect(cancelled.status).toBe('CANCELLED');
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', cancellationReason: 'no demand' }) }));
  });

  it('rejects cancellation from a disallowed status', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'CLOSED' }));
    await expect(service.cancel('po1', { requestId: 'req-c', lockVersion: 0, reason: 'x' }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('archives DRAFT/PLANNED/CANCELLED orders with a reason', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce(record({ status: 'ARCHIVED', lockVersion: 1 }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const archived = await service.archive('po1', { requestId: 'req-a', lockVersion: 0, reason: 'obsolete' }, 'u2', ctxA);
    expect(archived.status).toBe('ARCHIVED');
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ARCHIVED', archiveReason: 'obsolete' }) }));
  });

  it('rejects archiving a RELEASED order', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'RELEASED' }));
    await expect(service.archive('po1', { requestId: 'req-a', lockVersion: 0, reason: 'x' }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('closes a COMPLETED order with a reason, stamped actor and audit', async () => {
    model.findFirst.mockResolvedValueOnce(record({ status: 'COMPLETED' })).mockResolvedValueOnce(record({ status: 'CLOSED', lockVersion: 1, closedById: 'u2', closedAt: new Date('2026-02-02T10:00:00Z'), closureReason: 'done' }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const closed = await service.close('po1', { requestId: 'req-cl', lockVersion: 0, reason: 'done' }, 'u2', ctxA);
    expect(closed.status).toBe('CLOSED');
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'po1', status: 'COMPLETED', lockVersion: 0, companyId: 'c1', branchId: 'b1' }),
      data: expect.objectContaining({ status: 'CLOSED', closedById: 'u2', closedAt: expect.any(Date), closureReason: 'done' }),
    }));
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'COMPLETED', toStatus: 'CLOSED', action: 'CLOSE', reason: 'done' }) }));
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'CLOSE', entity: 'ProductionOrder' }));
  });

  it('rejects closing an order that is not COMPLETED', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'IN_PROGRESS' }));
    const error: any = await service.close('po1', { requestId: 'req-cl', lockVersion: 0, reason: 'done' }, 'u2', ctxA).catch((e) => e);
    expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionOrder.closeStateInvalid' }));
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('reopens a CLOSED order and clears the closure stamp with an audit trail', async () => {
    model.findFirst.mockResolvedValueOnce(record({ status: 'CLOSED' })).mockResolvedValueOnce(record({ status: 'COMPLETED', lockVersion: 1, closedById: null, closedAt: null, closureReason: null }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const reopened = await service.reopen('po1', { requestId: 'req-re', lockVersion: 0, reason: 'more work' }, 'u2', ctxA);
    expect(reopened.status).toBe('COMPLETED');
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'po1', status: 'CLOSED', lockVersion: 0 }),
      data: expect.objectContaining({ status: 'COMPLETED', closedById: null, closedAt: null, closureReason: null }),
    }));
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'CLOSED', toStatus: 'COMPLETED', action: 'REOPEN', reason: 'more work' }) }));
  });

  it('rejects reopening an order that is not CLOSED', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'COMPLETED' }));
    const error: any = await service.reopen('po1', { requestId: 'req-re', lockVersion: 0, reason: 'x' }, 'u2', ctxA).catch((e) => e);
    expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionOrder.reopenStateInvalid' }));
  });

  it('replays a close with the same request id idempotently', async () => {
    prisma.productionOrderTransition.findFirst.mockResolvedValue({ id: 't1', action: 'CLOSE' });
    model.findFirst.mockResolvedValue(record({ status: 'CLOSED', lockVersion: 1 }));
    const closed = await service.close('po1', { requestId: 'req-cl', lockVersion: 1, reason: 'done' }, 'u2', ctxA);
    expect(closed.status).toBe('CLOSED');
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('finalizes an IN_PROGRESS order to COMPLETED when the last run ends', async () => {
    const orderRow = record({ status: 'IN_PROGRESS' });
    prisma.productionOrder.findFirst.mockResolvedValueOnce(orderRow).mockResolvedValueOnce(record({ status: 'COMPLETED', lockVersion: 1 }));
    prisma.productionRun.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.productionOrder.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.finalizeOrderAfterLastRun('po1', 'req-order-end', 'u2', ctxA, prisma, { runId: 'run1', runNumber: 'RUN-000001', action: 'COMPLETE' });
    expect(result?.status).toBe('COMPLETED');
    expect(prisma.productionOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'po1', status: 'IN_PROGRESS', companyId: 'c1', branchId: 'b1' }),
      data: expect.objectContaining({ status: 'COMPLETED', updatedById: 'u2' }),
    }));
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', action: 'RUN_END', requestId: 'req-order-end' }) }));
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'AUTO_COMPLETE', entity: 'ProductionOrder' }));
  });

  it('does not finalize while another run is still active', async () => {
    prisma.productionOrder.findFirst.mockResolvedValue(record({ status: 'IN_PROGRESS' }));
    prisma.productionRun.count.mockResolvedValueOnce(1);
    const result = await service.finalizeOrderAfterLastRun('po1', 'req-order-end', 'u2', ctxA, prisma, { runId: 'run1', runNumber: 'RUN-000001', action: 'ABORT' });
    expect(result).toBeNull();
    expect(prisma.productionOrder.updateMany).not.toHaveBeenCalled();
    expect(prisma.productionOrderTransition.create).not.toHaveBeenCalled();
  });

  it('leaves the order IN_PROGRESS when every run ended aborted', async () => {
    prisma.productionOrder.findFirst.mockResolvedValue(record({ status: 'IN_PROGRESS' }));
    prisma.productionRun.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    const result = await service.finalizeOrderAfterLastRun('po1', 'req-order-end', 'u2', ctxA, prisma, { runId: 'run1', runNumber: 'RUN-000001', action: 'ABORT' });
    expect(result).toBeNull();
    expect(prisma.productionOrder.updateMany).not.toHaveBeenCalled();
  });

  it('does not finalize an order outside the active tenant', async () => {
    prisma.productionOrder.findFirst.mockResolvedValue(null);
    const result = await service.finalizeOrderAfterLastRun('po1', 'req-order-end', 'u2', ctxB, prisma, { runId: 'run1', runNumber: 'RUN-000001', action: 'COMPLETE' });
    expect(result).toBeNull();
    expect(prisma.productionOrder.updateMany).not.toHaveBeenCalled();
  });

  it('soft-deletes DRAFT orders only', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'PLANNED' }));
    await expect(service.remove('po1', 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
    model.findFirst.mockResolvedValue(record());
    model.update.mockResolvedValue(record({ deletedAt: new Date() }));
    const removed = await service.remove('po1', 'u2', ctxA);
    expect(model.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'po1' }, data: expect.objectContaining({ deletedAt: expect.any(Date), lockVersion: { increment: 1 } }) }));
    expect(removed.deletedAt).toBeInstanceOf(Date);
  });

  it('recalculates editable orders and freezes a new snapshot', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce(record({ lockVersion: 1 }));
    model.updateMany.mockResolvedValue({ count: 1 });
    const recalculated = await service.recalculate('po1', { requestId: 'req-x', lockVersion: 0 }, 'u2', ctxA);
    expect(recalculated.lockVersion).toBe(1);
    expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RECALCULATE', fromStatus: 'DRAFT', toStatus: 'DRAFT' }) }));
  });

  it('rejects recalculate on a released order', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'RELEASED' }));
    await expect(service.recalculate('po1', { requestId: 'req-x', lockVersion: 0 }, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports readiness blockers for non-PLANNED orders', async () => {
    model.findFirst.mockResolvedValue(record());
    model.findMany.mockResolvedValue([]);
    const result = await service.readiness('po1', ctxA);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'productionOrder.readiness.statusNotPlanned' })]));
  });

  it('warns on released-order overlap inside the tenant line', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'PLANNED' }));
    prisma.productionOrder.findMany.mockResolvedValue([{ id: 'po2', orderNumber: 'PO-000002' }]);
    const result = await service.readiness('po1', ctxA);
    expect(result.ready).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'productionOrder.readiness.overlapDetected' })]));
  });

  it('returns tenant-scoped history with transitions and audits', async () => {
    model.findFirst.mockResolvedValue(record());
    prisma.productionOrderTransition.findMany.mockResolvedValue([{ id: 't1', action: 'PLAN' }]);
    const history = await service.history('po1', ctxA);
    expect(history.orderNumber).toBe('PO-000001');
    expect(history.transitions).toHaveLength(1);
    expect(prisma.productionOrderTransition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productionOrderId: 'po1', companyId: 'c1', branchId: 'b1' }) }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ entity: 'ProductionOrder', entityId: 'po1' }) }));
  });

  it('blocks attachments on archived orders', async () => {
    model.findFirst.mockResolvedValue(record({ status: 'ARCHIVED' }));
    await expect(service.addAttachment('po1', { originalname: 'x.pdf' } as any, undefined, 'u2', ctxA)).rejects.toBeInstanceOf(ConflictException);
    expect(attachments.create).not.toHaveBeenCalled();
  });

  it('adds an attachment through the shared attachments service with audit', async () => {
    model.findFirst.mockResolvedValue(record());
    prisma.productionOrderAttachment.create.mockResolvedValue({ id: 'link1', attachment: { id: 'att1' } });
    const link = await service.addAttachment('po1', { originalname: 'x.pdf', size: 10 } as any, 'spec', 'u2', ctxA);
    expect(attachments.create).toHaveBeenCalledWith(expect.objectContaining({}), 'ProductionOrder', 'po1', 'spec', 'u2');
    expect(prisma.productionOrderAttachment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productionOrderId: 'po1', companyId: 'c1', branchId: 'b1', attachmentId: 'att1' }) }));
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'ATTACH' }));
    expect(link.attachment.id).toBe('att1');
  });

  it('denies every tenant-owned operation across tenants', async () => {
    model.findFirst.mockResolvedValue(null);
    await expect(service.update('po1', { lockVersion: 0 }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.plan('po1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.release('po1', { requestId: 'req-r', lockVersion: 0 }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel('po1', { requestId: 'req-c', lockVersion: 0, reason: 'x' }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.archive('po1', { requestId: 'req-a', lockVersion: 0, reason: 'x' }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.close('po1', { requestId: 'req-cl', lockVersion: 0, reason: 'x' }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.reopen('po1', { requestId: 'req-re', lockVersion: 0, reason: 'x' }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('po1', 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.history('po1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    expect(model.updateMany).not.toHaveBeenCalled();
    expect(model.update).not.toHaveBeenCalled();
  });
});
