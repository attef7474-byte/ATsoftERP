import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionDowntimeService } from './production-downtime.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const machine = (overrides: Record<string, any> = {}) => ({
  id: 'm1', code: 'M1', name: 'Machine 1', companyId: 'c1', branchId: 'b1', deletedAt: null, ...overrides,
});

const segment = (overrides: Record<string, any> = {}) => ({
  id: 'seg1',
  companyId: 'c1',
  branchId: 'b1',
  downtimeLogId: 'log1',
  productionRunId: null,
  productionOrderId: null,
  shiftId: null,
  productionLineId: 'l1',
  machineId: 'm1',
  startedAt: new Date('2026-03-01T08:00:00.000Z'),
  endedAt: null,
  durationMinutes: new Prisma.Decimal('0'),
  reasonId: null,
  planned: false,
  severity: 'MINOR',
  ownerDomain: 'PRODUCTION',
  maintenanceRequestId: null,
  maintenanceWorkOrderId: null,
  sourceType: 'MANUAL',
  status: 'OPEN',
  requestId: 'req-open-1',
  correctsSegmentId: null,
  correctionReason: null,
  notes: null,
  recordedById: 'u1',
  closedById: null,
  cancelledById: null,
  createdAt: new Date('2026-03-01T08:00:00.000Z'),
  updatedAt: new Date('2026-03-01T08:00:00.000Z'),
  downtimeLog: { id: 'log1', machineId: 'm1', startTime: new Date('2026-03-01T08:00:00.000Z') },
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    downtimeSegment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    downtimeLog: { create: jest.fn(), update: jest.fn() },
    machine: { findFirst: jest.fn() },
    productionLine: { findFirst: jest.fn() },
    productionShift: { findFirst: jest.fn() },
    productionRun: { findFirst: jest.fn() },
    productionOrder: { findFirst: jest.fn() },
    operationalLossReason: { findFirst: jest.fn() },
    maintenanceRequest: { findFirst: jest.fn() },
    maintenanceWorkOrder: { findFirst: jest.fn() },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const service = new ProductionDowntimeService(prisma, audit);
  return { prisma, audit, service };
}

describe('ProductionDowntimeService', () => {
  describe('open', () => {
    it('returns the existing segment when the requestId already produced one', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValueOnce(segment());
      const result = await service.open({ requestId: 'req-open-1', machineId: 'm1' } as any, 'u1', ctxA);
      expect(result.id).toBe('seg1');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a downtime log and segment, then audits', async () => {
      const { prisma, audit, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.downtimeSegment.findMany.mockResolvedValue([]);
      prisma.downtimeLog.create.mockResolvedValue({ id: 'log1' });
      prisma.downtimeSegment.create.mockResolvedValue(segment());

      const result = await service.open({ requestId: 'req-open-1', machineId: 'm1', planned: true, severity: 'MAJOR' } as any, 'u1', ctxA);

      expect(result.id).toBe('seg1');
      const logData = prisma.downtimeLog.create.mock.calls[0][0].data;
      expect(logData.companyId).toBe('c1');
      expect(logData.branchId).toBe('b1');
      expect(logData.machineId).toBe('m1');
      expect(logData.sourceType).toBe('PRODUCTION');
      expect(logData.status).toBe('OPEN');
      const segData = prisma.downtimeSegment.create.mock.calls[0][0].data;
      expect(segData.status).toBe('OPEN');
      expect(segData.planned).toBe(true);
      expect(segData.severity).toBe('MAJOR');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects a segment overlapping an existing one for the same machine', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.downtimeSegment.findMany.mockResolvedValue([
        { id: 'segX', startedAt: new Date('2026-03-01T08:00:00Z'), endedAt: null },
      ]);

      await expect(
        service.open({ requestId: 'req-open-2', machineId: 'm1', startedAt: '2026-03-01T09:00:00Z' } as any, 'u1', ctxA),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects end time before start time', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.downtimeSegment.findMany.mockResolvedValue([]);

      await expect(
        service.open({ requestId: 'req-open-3', machineId: 'm1', startedAt: '2026-03-01T10:00:00Z', endedAt: '2026-03-01T09:00:00Z' } as any, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a machine from another company', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(null);
      await expect(
        service.open({ requestId: 'req-open-4', machineId: 'm-foreign' } as any, 'u1', ctxB),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects opening without a maintenance request when the reason policy is REQUIRED', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue({
        id: 'r1', code: 'BREAKDOWN', plannedDefault: false, severityDefault: 'CRITICAL', maintenanceRequestPolicy: 'REQUIRED',
      });
      await expect(
        service.open({ requestId: 'req-open-5', machineId: 'm1', reasonId: 'r1' } as any, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects opening with a maintenance request when the reason policy is FORBIDDEN', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue({
        id: 'r2', code: 'SETUP', plannedDefault: true, severityDefault: 'MINOR', maintenanceRequestPolicy: 'FORBIDDEN',
      });
      await expect(
        service.open({ requestId: 'req-open-6', machineId: 'm1', reasonId: 'r2', maintenanceRequestId: 'mreq1' } as any, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a maintenance request that does not belong to the segment machine', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
      await expect(
        service.open({ requestId: 'req-open-7', machineId: 'm1', maintenanceRequestId: 'mreq-other' } as any, 'u1', ctxA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a maintenance request from another company', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.maintenanceRequest.findFirst.mockResolvedValue({ id: 'mreq-x', machineId: 'm1', machine: machine({ companyId: 'c2' }) });
      await expect(
        service.open({ requestId: 'req-open-8', machineId: 'm1', maintenanceRequestId: 'mreq-x' } as any, 'u1', ctxA),
      ).rejects.toThrow(NotFoundException);
    });

    it('links a matching maintenance request on the log and segment when provided', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      prisma.productionRun.findFirst.mockResolvedValue(null);
      prisma.machine.findFirst.mockResolvedValue(machine());
      prisma.productionLine.findFirst.mockResolvedValue({ id: 'l1', companyId: 'c1', branchId: 'b1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.operationalLossReason.findFirst.mockResolvedValue({
        id: 'r1', code: 'BREAKDOWN', plannedDefault: false, severityDefault: 'CRITICAL', maintenanceRequestPolicy: 'REQUIRED',
      });
      prisma.maintenanceRequest.findFirst.mockResolvedValue({ id: 'mreq1', machineId: 'm1', machine: machine() });
      prisma.downtimeSegment.findMany.mockResolvedValue([]);
      prisma.downtimeLog.create.mockResolvedValue({ id: 'log1' });
      prisma.downtimeSegment.create.mockResolvedValue(segment());

      const result = await service.open(
        { requestId: 'req-open-9', machineId: 'm1', reasonId: 'r1', maintenanceRequestId: 'mreq1' } as any, 'u1', ctxA,
      );

      expect(result.id).toBe('seg1');
      const logData = prisma.downtimeLog.create.mock.calls[0][0].data;
      expect(logData.requestId).toBe('mreq1');
      const segData = prisma.downtimeSegment.create.mock.calls[0][0].data;
      expect(segData.maintenanceRequestId).toBe('mreq1');
    });
  });

  describe('close', () => {
    it('closes an open segment, recomputes the log header and audits', async () => {
      const { prisma, audit, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment());
      prisma.downtimeSegment.update.mockResolvedValue(segment({ status: 'CLOSED', endedAt: new Date('2026-03-01T09:00:00Z') }));
      prisma.downtimeSegment.findMany.mockResolvedValue([
        { startedAt: new Date('2026-03-01T08:00:00Z'), endedAt: new Date('2026-03-01T09:00:00Z'), durationMinutes: new Prisma.Decimal('60'), status: 'CLOSED' },
      ]);
      prisma.downtimeLog.update.mockResolvedValue({});

      const result = await service.close('seg1', { endedAt: '2026-03-01T09:00:00Z' }, 'u1', ctxA);

      expect(result.status).toBe('CLOSED');
      expect(Number(prisma.downtimeSegment.update.mock.calls[0][0].data.durationMinutes)).toBe(60);
      expect(prisma.downtimeLog.update).toHaveBeenCalled();
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects closing an already closed segment', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment({ status: 'CLOSED' }));
      await expect(service.close('seg1', {}, 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('rejects closing a segment that is not owned by the active context', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(null);
      await expect(service.close('seg-foreign', {}, 'u1', ctxB)).rejects.toThrow(NotFoundException);
    });
  });

  describe('correct', () => {
    it('supersedes the original and creates a compensating segment', async () => {
      const { prisma, audit, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment());
      prisma.downtimeSegment.findMany.mockResolvedValue([]);
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      prisma.downtimeSegment.create.mockResolvedValue(segment({ id: 'seg2', correctsSegmentId: 'seg1', status: 'CLOSED' }));
      prisma.downtimeSegment.update.mockResolvedValue(segment({ status: 'SUPERSEDED' }));
      prisma.downtimeLog.update.mockResolvedValue({});

      const result = await service.correct('seg1', { reason: 'Wrong interval', endedAt: '2026-03-01T10:00:00Z' } as any, 'u1', ctxA);

      expect(result.id).toBe('seg2');
      expect(prisma.downtimeSegment.create.mock.calls[0][0].data.correctsSegmentId).toBe('seg1');
      expect(prisma.downtimeSegment.create.mock.calls[0][0].data.correctionReason).toBe('Wrong interval');
      expect(prisma.downtimeSegment.update.mock.calls[0][0].data.status).toBe('SUPERSEDED');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects correcting a cancelled segment', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment({ status: 'CANCELLED' }));
      await expect(service.correct('seg1', { reason: 'x' }, 'u1', ctxA)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('cancels an open segment and audits', async () => {
      const { prisma, audit, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment());
      prisma.downtimeSegment.update.mockResolvedValue(segment({ status: 'CANCELLED' }));
      prisma.downtimeSegment.findMany.mockResolvedValue([
        { startedAt: new Date('2026-03-01T08:00:00Z'), endedAt: null, durationMinutes: new Prisma.Decimal('0'), status: 'CANCELLED' },
      ]);
      prisma.downtimeLog.update.mockResolvedValue({});

      const result = await service.cancel('seg1', { reason: 'Wrong entry' }, 'u1', ctxA);

      expect(result.status).toBe('CANCELLED');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects cancelling a closed segment', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment({ status: 'CLOSED' }));
      await expect(service.cancel('seg1', { reason: 'x' }, 'u1', ctxA)).rejects.toThrow(ConflictException);
    });
  });

  describe('linkMaintenance', () => {
    it('links a scoped maintenance request and mirrors it on the log', async () => {
      const { prisma, audit, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment());
      prisma.maintenanceRequest.findFirst.mockResolvedValue({
        id: 'mreq1',
        machineId: 'm1',
        machine: machine(),
      });
      prisma.downtimeSegment.update.mockResolvedValue(segment({ maintenanceRequestId: 'mreq1' }));
      prisma.downtimeLog.update.mockResolvedValue({});

      const result = await service.linkMaintenance('seg1', { maintenanceRequestId: 'mreq1', reason: 'Link to request' }, 'u1', ctxA);

      expect(result.maintenanceRequestId).toBe('mreq1');
      expect(prisma.downtimeLog.update.mock.calls[0][0].data.requestId).toBe('mreq1');
      expect(audit.logWithClient).toHaveBeenCalled();
    });

    it('rejects a maintenance request from a different company', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment());
      prisma.maintenanceRequest.findFirst.mockResolvedValue({ id: 'mreq-x', machineId: 'm1', machine: machine({ companyId: 'c2' }) });
      await expect(
        service.linkMaintenance('seg1', { maintenanceRequestId: 'mreq-x', reason: 'link' }, 'u1', ctxA),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a different already-linked request without silent reassignment', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findFirst.mockResolvedValue(segment({ maintenanceRequestId: 'mreq1' }));
      await expect(
        service.linkMaintenance('seg1', { maintenanceRequestId: 'mreq2', reason: 'link' }, 'u1', ctxA),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll tenant isolation', () => {
    it('always scopes by company and branch', async () => {
      const { prisma, service } = makeService();
      prisma.downtimeSegment.findMany.mockResolvedValue([]);
      prisma.downtimeSegment.count.mockResolvedValue(0);
      await service.findAll({}, ctxA);
      const where = prisma.downtimeSegment.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('c1');
      expect(where.branchId).toBe('b1');
    });
  });
});
