import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionRunsService } from './production-runs.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const run = (overrides: Record<string, any> = {}) => ({
  id: 'run1',
  runNumber: 'RUN-000001',
  clientRequestId: 'req-1',
  companyId: 'c1',
  branchId: 'b1',
  productionOrderId: 'po1',
  status: 'RUNNING',
  lockVersion: 0,
  productionUnitId: 'u1',
  productionLineId: 'l1',
  machineId: 'm1',
  productionProductDefinitionId: 'p1',
  productionVersionId: 'v1',
  productionPackagingId: null,
  costCenterId: 'cc1',
  issueWarehouseId: null,
  receiptWarehouseId: null,
  orderNumberSnapshot: 'PO-000001',
  plannedQuantitySnapshot: '1000.0000',
  quantityUnitSnapshot: 'UNIT',
  capacityStandardCodeSnapshot: 'PCS-000001',
  capacityStandardRevisionSnapshot: 1,
  standardRateSnapshot: '100.0000',
  outputUnitSnapshot: 'UNIT',
  timeBasisSnapshot: 'HOUR',
  targetEfficiencyPercentSnapshot: '90.0000',
  expectedYieldPercentSnapshot: '98.0000',
  snapshotFrozenAtSnapshot: null,
  startedById: 'u1',
  startedAt: new Date('2026-02-01T08:00:00.000Z'),
  pausedById: null,
  pausedAt: null,
  pauseReason: null,
  endedById: null,
  endedAt: null,
  abortReason: null,
  assignmentResolutionSource: 'RESOURCE',
  assignmentResolutionNote: null,
  notes: null,
  createdById: 'maker',
  updatedById: 'maker',
  createdAt: new Date('2026-02-01T07:00:00.000Z'),
  updatedAt: new Date('2026-02-01T07:00:00.000Z'),
  deletedAt: null,
  productionOrder: { id: 'po1', orderNumber: 'PO-000001', status: 'IN_PROGRESS', priority: 'NORMAL' },
  productionUnit: { id: 'u1', code: 'UNIT', name: 'Unit', abbreviation: 'U' },
  productionLine: { id: 'l1', code: 'L1', name: 'Line 1' },
  machine: { id: 'm1', code: 'M1', name: 'Machine 1' },
  costCenter: { id: 'cc1', code: 'CC1', name: 'Cost Center' },
  ...overrides,
});

const order = (overrides: Record<string, any> = {}) => ({
  id: 'po1',
  orderNumber: 'PO-000001',
  status: 'RELEASED',
  lockVersion: 0,
  companyId: 'c1',
  branchId: 'b1',
  productionProductDefinitionId: 'p1',
  productionVersionId: 'v1',
  productionPackagingId: null,
  productionUnitId: 'u1',
  productionLineId: 'l1',
  machineId: 'm1',
  costCenterId: 'cc1',
  issueWarehouseId: null,
  receiptWarehouseId: null,
  plannedQuantity: '1000.0000',
  quantityUnit: 'UNIT',
  capacityStandardCodeSnapshot: 'PCS-000001',
  capacityStandardRevisionSnapshot: 1,
  standardRateSnapshot: '100.0000',
  outputUnitSnapshot: 'UNIT',
  timeBasisSnapshot: 'HOUR',
  targetEfficiencyPercentSnapshot: '90.0000',
  expectedYieldPercentSnapshot: '98.0000',
  snapshotFrozenAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const point = (overrides: Record<string, any> = {}) => ({
  id: 'mp1',
  code: 'MP-1',
  name: 'Point 1',
  status: 'ACTIVE',
  companyId: 'c1',
  branchId: 'b1',
  productionLineId: 'l1',
  machineId: 'm1',
  role: 'FINAL_OUTPUT',
  source: 'MANUAL',
  unit: 'UNIT',
  isAuthoritativeFinal: true,
  counterModulus: null,
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  ...overrides,
});

const event = (overrides: Record<string, any> = {}) => ({
  id: 'ev1',
  companyId: 'c1',
  branchId: 'b1',
  productionRunId: 'run1',
  measurementPointId: 'mp1',
  eventType: 'PRODUCTION',
  classification: 'FINAL_OUTPUT',
  sourceType: 'MANUAL',
  quantity: '100.0000',
  goodQuantity: '95.0000',
  rejectQuantity: '5.0000',
  unit: 'UNIT',
  occurredAt: new Date('2026-02-01T09:00:00.000Z'),
  requestId: 'req-o1',
  previousRawCount: null,
  rawCount: null,
  resetValue: null,
  correctsEventId: null,
  reason: null,
  notes: null,
  createdById: 'u2',
  createdAt: new Date('2026-02-01T09:00:00.000Z'),
  measurementPoint: { id: 'mp1', code: 'MP-1', name: 'Point 1', role: 'FINAL_OUTPUT', source: 'MANUAL', unit: 'UNIT', isAuthoritativeFinal: true },
  correctsEvent: null,
  ...overrides,
});

const startDto: any = { clientRequestId: 'req-1', productionOrderId: 'po1' };
const outputDto: any = { requestId: 'req-o1', measurementPointId: 'mp1', eventType: 'PRODUCTION', quantity: '100', goodQuantity: '95', rejectQuantity: '5' };
const correctionDto: any = { requestId: 'req-c1', quantity: '10', goodQuantity: '9', rejectQuantity: '1', reason: 'measured again' };

describe('ProductionRunsService', () => {
  let prisma: any;
  let model: any;
  let audit: any;
  let numbering: any;
  let service: ProductionRunsService;

  beforeEach(() => {
    model = { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
    prisma = {
      productionRun: model,
      productionRunTransition: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      productionRunSession: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
      productionOutputEvent: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      productionOrder: { findFirst: jest.fn(), updateMany: jest.fn() },
      productionOrderTransition: { create: jest.fn() },
      productionMeasurementPoint: { findFirst: jest.fn() },
      productionOperationalAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
      productionShiftAssignment: { findFirst: jest.fn() },
      productionShift: { findFirst: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('RUN-000001') };
    service = new ProductionRunsService(prisma, audit, numbering);
  });

  describe('start', () => {
    it('starts a released order as a RUNNING run with snapshots, session, transitions, and audit', async () => {
      model.findFirst.mockResolvedValue(null);
      model.create.mockImplementation(({ data }: any) => Promise.resolve(run({ ...data, id: 'run1' })));
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([]);

      const result = await service.start(startDto, 'maker', ctxA);

      expect(result.status).toBe('RUNNING');
      expect(result.runNumber).toBe('RUN-000001');
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            status: 'RUNNING',
            orderNumberSnapshot: 'PO-000001',
            plannedQuantitySnapshot: '1000.0000',
            assignmentResolutionSource: 'RESOURCE',
          }),
        }),
      );
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('PRODUCTION_RUN', prisma);
      expect(prisma.productionRunSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productionRunId: 'run1', companyId: 'c1' }) }));
      expect(prisma.productionOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'po1', status: 'RELEASED' }), data: expect.objectContaining({ status: 'IN_PROGRESS' }) }));
      expect(prisma.productionOrderTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RUN_START', fromStatus: 'RELEASED', toStatus: 'IN_PROGRESS', requestId: 'req-1' }) }));
      expect(prisma.productionRunTransition.create).toHaveBeenCalledTimes(2);
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'START' }));
    });

    it('forces tenant ownership from the active context and ignores client tenant fields', async () => {
      model.findFirst.mockResolvedValue(null);
      model.create.mockImplementation(({ data }: any) => Promise.resolve(run({ ...data, id: 'run1' })));
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([]);

      await service.start({ ...startDto, companyId: 'evil', branchId: 'evil' }, 'maker', ctxA);

      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }));
    });

    it('returns the existing run when the same start intent is replayed', async () => {
      model.findFirst.mockResolvedValue(run());
      const result = await service.start(startDto, 'maker', ctxA);
      expect(result.id).toBe('run1');
      expect(model.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects starting an order outside the active tenant', async () => {
      model.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(null);
      await expect(service.start(startDto, 'maker', ctxA)).rejects.toBeInstanceOf(NotFoundException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('rejects starting a non-released order', async () => {
      model.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order({ status: 'DRAFT' }));
      await expect(service.start(startDto, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('rejects starting when the order already has an active run', async () => {
      model.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(run({ productionOrderId: 'po1' }));
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      await expect(service.start(startDto, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('rejects starting when the line already has an active run', async () => {
      model.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(run({ productionOrderId: 'po-other' }));
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      await expect(service.start(startDto, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('requires a reason for an explicit operational assignment override', async () => {
      model.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      await expect(service.start({ clientRequestId: 'req-1', productionOrderId: 'po1', operationalAssignmentId: 'oa1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('rejects ambiguous resource assignment resolution', async () => {
      model.findFirst.mockResolvedValue(null);
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([
        { id: 'oa1', code: 'OA-1', isPrimary: false, shiftId: null },
        { id: 'oa2', code: 'OA-2', isPrimary: false, shiftId: null },
      ]);
      await expect(service.start(startDto, 'maker', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(model.create).not.toHaveBeenCalled();
    });

    it('returns the raced run on a duplicate request id instead of throwing', async () => {
      model.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(null);
      model.create.mockRejectedValue({ code: 'P2002' });
      prisma.productionOrder.findFirst.mockResolvedValue(order());
      prisma.productionOrder.updateMany.mockResolvedValue({ count: 1 });
      prisma.productionOperationalAssignment.findMany.mockResolvedValue([]);
      model.findFirst.mockResolvedValue(null);

      const error: any = await service.start(startDto, 'maker', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.duplicate' }));
    });
  });

  describe('transitions', () => {
    it('pauses a RUNNING run, closes the session, writes transition and audit', async () => {
      model.findFirst.mockResolvedValueOnce(run({ status: 'RUNNING' })).mockResolvedValueOnce(run({ status: 'PAUSED', lockVersion: 1, pausedAt: new Date() }));
      model.updateMany.mockResolvedValue({ count: 1 });
      prisma.productionRunSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.pause('run1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA);

      expect(result.status).toBe('PAUSED');
      expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'run1', status: 'RUNNING', lockVersion: 0 }), data: expect.objectContaining({ status: 'PAUSED', lockVersion: { increment: 1 } }) }));
      expect(prisma.productionRunSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productionRunId: 'run1', closedAt: null }) }));
      expect(prisma.productionRunTransition.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromStatus: 'RUNNING', toStatus: 'PAUSED', action: 'PAUSE' }) }));
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'PAUSE' }));
    });

    it('rejects pausing a run that is not RUNNING', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'PAUSED' }));
      const error: any = await service.pause('run1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.pauseStateInvalid' }));
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('resumes a PAUSED run and opens a new session', async () => {
      model.findFirst.mockResolvedValueOnce(run({ status: 'PAUSED' })).mockResolvedValueOnce(run({ status: 'RUNNING', lockVersion: 1 }));
      model.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resume('run1', { requestId: 'req-r', lockVersion: 0 }, 'u2', ctxA);

      expect(result.status).toBe('RUNNING');
      expect(prisma.productionRunSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productionRunId: 'run1', companyId: 'c1' }) }));
    });

    it('rejects resuming a run that is not PAUSED', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'RUNNING' }));
      const error: any = await service.resume('run1', { requestId: 'req-r', lockVersion: 0 }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.resumeStateInvalid' }));
    });

    it('completes a RUNNING run and stamps the end time', async () => {
      model.findFirst.mockResolvedValueOnce(run({ status: 'RUNNING' })).mockResolvedValueOnce(run({ status: 'COMPLETED', lockVersion: 1, endedAt: new Date() }));
      model.updateMany.mockResolvedValue({ count: 1 });
      prisma.productionRunSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.complete('run1', { requestId: 'req-c', lockVersion: 0 }, 'u2', ctxA);

      expect(result.status).toBe('COMPLETED');
      expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', endedAt: expect.any(Date) }) }));
    });

    it('protects a completed run from a second completion', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'COMPLETED' }));
      const error: any = await service.complete('run1', { requestId: 'req-c2', lockVersion: 1 }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.completeStateInvalid' }));
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('requires a reason when aborting a run', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'READY' }));
      const error: any = await service.abort('run1', { requestId: 'req-a', lockVersion: 0 }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.abortReasonRequired' }));
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('aborts a READY run when a reason is provided', async () => {
      model.findFirst.mockResolvedValueOnce(run({ status: 'READY' })).mockResolvedValueOnce(run({ status: 'ABORTED', lockVersion: 1, endedAt: new Date() }));
      model.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.abort('run1', { requestId: 'req-a', lockVersion: 0, reason: 'no material' } as any, 'u2', ctxA);

      expect(result.status).toBe('ABORTED');
      expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ABORTED', abortReason: 'no material' }) }));
    });

    it('rejects a stale lock version update', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'RUNNING' }));
      model.updateMany.mockResolvedValue({ count: 0 });
      const error: any = await service.pause('run1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.staleVersion' }));
    });

    it('replays an identical action request idempotently', async () => {
      prisma.productionRunTransition.findFirst.mockResolvedValue({ id: 't1', action: 'PAUSE' });
      model.findFirst.mockResolvedValue(run());
      const result = await service.pause('run1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA);
      expect(result.id).toBe('run1');
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an action replay with a different action', async () => {
      prisma.productionRunTransition.findFirst.mockResolvedValue({ id: 't1', action: 'COMPLETE' });
      model.findFirst.mockResolvedValue(run());
      const error: any = await service.pause('run1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.idempotencyConflict' }));
    });
  });

  describe('recordOutput', () => {
    beforeEach(() => {
      model.findFirst.mockResolvedValue(run({ status: 'RUNNING' }));
      prisma.productionOutputEvent.findFirst.mockResolvedValue(null);
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point());
      prisma.productionOutputEvent.create.mockImplementation(({ data }: any) => Promise.resolve(event({ ...data, id: 'ev1' })));
    });

    it('records a manual final output with good/reject split and audits it', async () => {
      const result = await service.recordOutput('run1', outputDto, 'u2', ctxA);
      expect(result.eventType).toBe('PRODUCTION');
      expect(result.classification).toBe('FINAL_OUTPUT');
      expect(prisma.productionOutputEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productionRunId: 'run1', companyId: 'c1', measurementPointId: 'mp1', eventType: 'PRODUCTION', quantity: expect.any(Prisma.Decimal) }) }));
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'OUTPUT_CREATE' }));
    });

    it('rejects recording output on a run that is not RUNNING', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'PAUSED' }));
      const error: any = await service.recordOutput('run1', outputDto, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.outputRequiresRunning' }));
    });

    it('replays a duplicate request id by returning the existing event', async () => {
      prisma.productionOutputEvent.findFirst.mockResolvedValue(event());
      const result = await service.recordOutput('run1', outputDto, 'u2', ctxA);
      expect(result.id).toBe('ev1');
      expect(prisma.productionOutputEvent.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive or missing measurement point', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(null);
      const error: any = await service.recordOutput('run1', outputDto, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.pointInvalid' }));
    });

    it('rejects a point that belongs to a different production line', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ productionLineId: 'l-other' }));
      const error: any = await service.recordOutput('run1', outputDto, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.pointLineMismatch' }));
    });

    it('rejects a point bound to a different machine', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ machineId: 'm-other' }));
      const error: any = await service.recordOutput('run1', outputDto, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.pointMachineMismatch' }));
    });

    it('rejects a point that is not yet effective', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ effectiveFrom: new Date('2099-01-01T00:00:00.000Z') }));
      const error: any = await service.recordOutput('run1', outputDto, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.pointNotEffectiveYet' }));
    });

    it('rejects an expired point', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ effectiveFrom: new Date('2020-01-01T00:00:00.000Z'), effectiveTo: new Date('2025-12-31T00:00:00.000Z') }));
      const error: any = await service.recordOutput('run1', outputDto, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.pointExpired' }));
    });

    it('allows good/reject only on FINAL_OUTPUT points', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ role: 'WASTE' }));
      const error: any = await service.recordOutput('run1', { ...outputDto, goodQuantity: '5' }, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.goodRejectFinalOnly' }));
    });

    it('derives the counter delta from the previous raw count', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ role: 'WASTE', source: 'COUNTER', unit: 'KG' }));
      prisma.productionOutputEvent.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'prev', eventType: 'PRODUCTION', rawCount: '100', resetValue: null });
      const result = await service.recordOutput('run1', { requestId: 'req-o2', measurementPointId: 'mp1', eventType: 'PRODUCTION', rawCount: '150' }, 'u2', ctxA);
      expect(result.quantity.toString()).toBe('50');
      expect(result.previousRawCount.toString()).toBe('100');
    });

    it('rejects a backwards counter reading without a modulus', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ role: 'WASTE', source: 'COUNTER', unit: 'KG', counterModulus: null }));
      prisma.productionOutputEvent.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'prev', eventType: 'PRODUCTION', rawCount: '100', resetValue: null });
      const error: any = await service.recordOutput('run1', { requestId: 'req-o3', measurementPointId: 'mp1', eventType: 'PRODUCTION', rawCount: '90' }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.counterBackwardsWithoutModulus' }));
    });

    it('rejects a reset on a manual measurement point', async () => {
      const error: any = await service.recordOutput('run1', { requestId: 'req-o4', measurementPointId: 'mp1', eventType: 'RESET', rawCount: '5', resetValue: '5' }, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.resetRequiresCounter' }));
    });

    it('records a counter reset as a zero-quantity event', async () => {
      prisma.productionMeasurementPoint.findFirst.mockResolvedValue(point({ role: 'WASTE', source: 'COUNTER', unit: 'KG' }));
      const result = await service.recordOutput('run1', { requestId: 'req-o5', measurementPointId: 'mp1', eventType: 'RESET', rawCount: '150', resetValue: '150' }, 'u2', ctxA);
      expect(result.eventType).toBe('RESET');
      expect(result.quantity.toString()).toBe('0');
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'OUTPUT_RESET' }));
    });

    it('rejects a future occurredAt timestamp', async () => {
      const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const error: any = await service.recordOutput('run1', { ...outputDto, occurredAt: future }, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.occurredAtFuture' }));
    });

    it('rejects an occurredAt before the run start', async () => {
      const error: any = await service.recordOutput('run1', { ...outputDto, occurredAt: '2026-01-01T00:00:00.000Z' }, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.occurredAtBeforeStart' }));
    });

    it('requires a reason when backdating an event', async () => {
      const backdated = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const error: any = await service.recordOutput('run1', { ...outputDto, occurredAt: backdated }, 'u2', ctxA).catch((e) => e);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.backdateReasonRequired' }));
    });
  });

  describe('correctOutput', () => {
    const originalEvent = event({ id: 'ev1', requestId: 'req-orig' });

    beforeEach(() => {
      prisma.productionOutputEvent.findFirst
        .mockResolvedValueOnce(originalEvent)
        .mockResolvedValueOnce(null);
      model.findFirst.mockResolvedValue(run({ status: 'RUNNING' }));
      prisma.productionOutputEvent.findMany.mockResolvedValue([]);
      prisma.productionOutputEvent.create.mockImplementation(({ data }: any) => Promise.resolve(event({ ...data, id: 'corr1', eventType: 'CORRECTION', correctsEventId: 'ev1' })));
    });

    it('creates a correction referencing the original event and audits it', async () => {
      const result = await service.correctOutput('ev1', correctionDto, 'u2', ctxA);
      expect(result.eventType).toBe('CORRECTION');
      expect(result.correctsEventId).toBe('ev1');
      expect(prisma.productionOutputEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'CORRECTION', classification: 'FINAL_OUTPUT', correctsEventId: 'ev1', companyId: 'c1' }) }));
      expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({ action: 'OUTPUT_CORRECT' }));
    });

    it('rejects correcting a missing event', async () => {
      prisma.productionOutputEvent.findFirst.mockReset();
      prisma.productionOutputEvent.findFirst.mockResolvedValue(null);
      await expect(service.correctOutput('ev-missing', correctionDto, 'u2', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows corrections only on PRODUCTION events', async () => {
      prisma.productionOutputEvent.findFirst.mockReset();
      prisma.productionOutputEvent.findFirst
        .mockResolvedValueOnce(event({ eventType: 'RESET', quantity: '0', goodQuantity: '0', rejectQuantity: '0' }))
        .mockResolvedValueOnce(null);
      const error: any = await service.correctOutput('ev-reset', correctionDto, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.correctProductionOnly' }));
    });

    it('rejects corrections on a run that is not RUNNING', async () => {
      model.findFirst.mockResolvedValue(run({ status: 'COMPLETED' }));
      const error: any = await service.correctOutput('ev1', correctionDto, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.outputRequiresRunning' }));
    });

    it('replays a duplicate correction request by returning the existing event', async () => {
      prisma.productionOutputEvent.findFirst.mockReset();
      prisma.productionOutputEvent.findFirst
        .mockResolvedValueOnce(originalEvent)
        .mockResolvedValueOnce(event({ id: 'corr1', eventType: 'CORRECTION' }));
      const result = await service.correctOutput('ev1', correctionDto, 'u2', ctxA);
      expect(result.id).toBe('corr1');
      expect(prisma.productionOutputEvent.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive correction quantity', async () => {
      const error: any = await service.correctOutput('ev1', { ...correctionDto, quantity: '0' }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.correctionPositive' }));
    });

    it('rejects a correction exceeding the remaining original quantity', async () => {
      const error: any = await service.correctOutput('ev1', { ...correctionDto, quantity: '200' }, 'u2', ctxA).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRun.correctionExceeds' }));
    });
  });

  describe('reads and tenant isolation', () => {
    it('returns tenant-scoped run lists', async () => {
      model.findMany.mockResolvedValue([]);
      model.count.mockResolvedValue(0);
      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);
      expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }) }));
      expect(result.meta).toEqual(expect.objectContaining({ page: 1, limit: 10, total: 0, totalPages: 0 }));
    });

    it('denies reads across tenants by id', async () => {
      model.findFirst.mockResolvedValueOnce(run()).mockResolvedValueOnce(null);
      expect((await service.findOne('run1', ctxA)).id).toBe('run1');
      await expect(service.findOne('run1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(model.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'run1', companyId: 'c2', branchId: 'b2' }) }));
    });

    it('scopes the ledger by tenant', async () => {
      model.findFirst.mockResolvedValue(run());
      prisma.productionOutputEvent.findMany.mockResolvedValue([]);
      prisma.productionOutputEvent.count.mockResolvedValue(0);
      const result = await service.ledger('run1', { page: 1, limit: 50 }, ctxA);
      expect(prisma.productionOutputEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productionRunId: 'run1', companyId: 'c1', branchId: 'b1' }) }));
      expect(result.meta).toEqual(expect.objectContaining({ total: 0, totalPages: 0 }));
    });

    it('returns tenant-scoped history with transitions and audits', async () => {
      model.findFirst.mockResolvedValue(run());
      prisma.productionRunTransition.findMany.mockResolvedValue([{ id: 't1', action: 'START' }]);
      const result = await service.history('run1', ctxA);
      expect(result.runNumber).toBe('RUN-000001');
      expect(prisma.productionRunTransition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productionRunId: 'run1', companyId: 'c1', branchId: 'b1' }) }));
    });

    it('serves the live view with sessions, recent events, and derived totals', async () => {
      model.findFirst.mockResolvedValue(run());
      prisma.productionRunSession.findMany.mockResolvedValue([{ id: 's1', startedAt: new Date('2026-02-01T08:00:00.000Z'), closedAt: null }]);
      prisma.productionOutputEvent.findMany.mockResolvedValue([event()]);

      const live = await service.live('run1', ctxA);

      expect(live.run.id).toBe('run1');
      expect(live.run.id).toBe('run1');
      expect(live.run.openSession).toBeDefined();
      expect(live.recentEvents).toHaveLength(1);
      expect(live.totals.finalOutputTotal).toBe('100');
      expect(live.totals.wasteTotal).toBe('0');
      expect(live.totals.reworkTotal).toBe('0');
      expect(live.totals.correctionsTotal).toBe('0');
      expect(live.totals.progressPercent).toBe('10');
      expect(prisma.productionOutputEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ productionRunId: 'run1', companyId: 'c1', branchId: 'b1' }) }));
    });

    it('denies tenant-owned operations across tenants', async () => {
      model.findFirst.mockResolvedValue(null);
      await expect(service.pause('run1', { requestId: 'req-p', lockVersion: 0 }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.complete('run1', { requestId: 'req-c', lockVersion: 0 }, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.history('run1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.ledger('run1', { page: 1, limit: 50 }, ctxB)).rejects.toBeInstanceOf(NotFoundException);
      expect(model.updateMany).not.toHaveBeenCalled();
    });
  });
});
