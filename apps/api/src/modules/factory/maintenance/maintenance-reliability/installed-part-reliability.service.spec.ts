import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { InstalledPartReliabilityService } from './installed-part-reliability.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1',
  scopeId: 'b1',
  companyId: 'c1',
  companyName: 'Company One',
  companyCode: 'C1',
  branchId: 'b1',
  branchName: 'Branch One',
  branchCode: 'B1',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const DAY = 86_400_000;

function part(over: any = {}) {
  return {
    id: over.id ?? 'p1',
    machineId: over.machineId ?? 'm1',
    sparePartId: over.sparePartId ?? 's1',
    machineComponentId: over.machineComponentId ?? 'comp1',
    maintenanceRequestId: over.maintenanceRequestId ?? null,
    status: over.status ?? 'ACTIVE',
    installedAt: over.installedAt ?? new Date('2026-09-01T00:00:00.000Z'),
    removedAt: over.removedAt ?? null,
    installedQuantity: over.installedQuantity ?? 1,
    serialNumber: over.serialNumber ?? null,
    installedCondition: over.installedCondition ?? 'NEW',
    removedCondition: over.removedCondition ?? null,
    expectedLifeValue: over.expectedLifeValue ?? null,
    expectedLifeUnit: over.expectedLifeUnit ?? null,
    lifeStartDate: over.lifeStartDate ?? null,
    lifeStartReading: over.lifeStartReading ?? null,
    currentReading: over.currentReading ?? null,
    warningThresholdPercent: over.warningThresholdPercent ?? 80,
    lifeStatus: over.lifeStatus ?? 'UNKNOWN',
    machine: over.machine ?? {
      id: 'm1',
      code: 'M-1',
      name: 'Machine One',
      productionLine: { id: 'line1', code: 'L-1', name: 'Line One' },
    },
    machineComponent: over.machineComponent ?? { id: 'comp1', code: 'C-1', name: 'Comp One' },
    sparePart: over.sparePart ?? {
      id: 's1', code: 'SP-1', name: 'Bearing', partNumber: 'B-100', manufacturer: 'ACME', isCritical: true, unit: 'PCS',
    },
  };
}

describe('InstalledPartReliabilityService', () => {
  let prisma: any;
  let service: InstalledPartReliabilityService;

  beforeEach(() => {
    prisma = {
      machine: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'line1' }) },
      sparePart: { findUnique: jest.fn().mockResolvedValue({ id: 's1', code: 'SP-1', name: 'Bearing' }) },
      machineInstalledPart: { findMany: jest.fn().mockResolvedValue([]) },
      sparePartReplacementHistory: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceExecutionPartUsage: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceTask: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceExecutionSession: { findMany: jest.fn().mockResolvedValue([]) },
      downtimeLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new InstalledPartReliabilityService(prisma as PrismaService);
  });

  describe('buildRows', () => {
    it('groups by machine+spare part and never counts an ACTIVE part as a failure', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([part()]);

      const rows = await service.buildRows({}, ctx);

      expect(rows).toHaveLength(1);
      expect(rows[0].current?.status).toBe('ACTIVE');
      expect(rows[0].failureEventCount).toBe(0);
      expect(rows[0].mtbf.status).toBe('INSUFFICIENT_DATA');
      expect(rows[0].mttr.status).toBe('INSUFFICIENT_DATA');
    });

    it('counts a REMOVED part linked to a classified downtime log as a failure event', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ status: 'REMOVED', maintenanceRequestId: 'req1', removedAt: new Date('2026-09-11T00:00:00.000Z') }),
      ]);
      prisma.downtimeLog.findMany.mockResolvedValue([
        { id: 'd1', machineId: 'm1', requestId: 'req1', executionId: null, failureCategory: 'MECHANICAL', startTime: new Date('2026-09-10T00:00:00.000Z'), endTime: new Date('2026-09-10T02:00:00.000Z'), durationMinutes: 120 },
      ]);

      const rows = await service.buildRows({}, ctx);

      expect(rows[0].failureEventCount).toBe(1);
      expect(rows[0].lastFailureAt?.toISOString()).toBe('2026-09-11T00:00:00.000Z');
      expect(rows[0].mtbf.status).toBe('INSUFFICIENT_DATA');
    });

    it('scopes every read through the owning machine for the active company/branch', async () => {
      await service.buildRows({}, ctx);

      const where = prisma.machineInstalledPart.findMany.mock.calls[0][0].where;
      expect(where.machine).toEqual({ companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] });
    });

    it('rejects a machine from another tenant', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.buildRows({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects a production line from another tenant', async () => {
      prisma.productionLine.findFirst.mockResolvedValue(null);

      await expect(service.buildRows({ productionLineId: 'lineForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('fails before loading an oversized population set', async () => {
      const many = Array.from({ length: 2001 }, (_, i) =>
        part({ id: `p${i}`, machineId: `m${i}`, sparePartId: `s${i}` }),
      );
      prisma.machineInstalledPart.findMany.mockResolvedValue(many);

      await expect(service.buildRows({}, ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.sparePartReplacementHistory.findMany).not.toHaveBeenCalled();
    });

    it('computes MTBF from the service lives of two failure events', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ id: 'p1', status: 'FAILED', installedAt: new Date('2026-08-01T00:00:00.000Z'), removedAt: new Date('2026-08-11T00:00:00.000Z') }),
        part({ id: 'p2', status: 'FAILED', installedAt: new Date('2026-08-15T00:00:00.000Z'), removedAt: new Date('2026-08-25T00:00:00.000Z') }),
      ]);

      const rows = await service.buildRows({}, ctx);

      expect(rows[0].failureEventCount).toBe(2);
      expect(rows[0].mtbf.status).toBe('OK');
      expect(rows[0].mtbf.mtbfDays).toBe(10);
    });

    it('derives MTTR from elapsed execution time and keeps labor and downtime separate', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ id: 'p1', status: 'FAILED', installedAt: new Date('2026-08-01T00:00:00.000Z'), removedAt: new Date('2026-08-05T00:00:00.000Z') }),
      ]);
      prisma.maintenanceExecutionPartUsage.findMany.mockResolvedValue([
        { id: 'u1', executionId: 'exec1', installedPartId: 'p1', replacementHistoryId: null, usageType: 'INSTALLED', usedAt: new Date('2026-08-01T00:00:00.000Z') },
      ]);
      prisma.maintenanceTask.findMany.mockResolvedValue([
        { id: 'exec1', startedAt: new Date('2026-08-04T08:00:00.000Z'), completedAt: new Date('2026-08-04T10:00:00.000Z'), status: 'COMPLETED' },
      ]);
      prisma.maintenanceExecutionSession.findMany.mockResolvedValue([
        { executionId: 'exec1', startedAt: new Date('2026-08-04T08:00:00.000Z'), endedAt: new Date('2026-08-04T09:00:00.000Z') },
      ]);

      const rows = await service.buildRows({}, ctx);

      expect(rows[0].mttr.status).toBe('OK');
      expect(rows[0].mttr.mttrHours).toBeCloseTo(2, 5);
      expect(rows[0].mttr.laborMs).toBe(3_600_000);
    });

    it('flags a repeated early failure only with two failures and two premature failures', async () => {
      const expected = { expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: new Date('2026-01-01T00:00:00.000Z') };
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ id: 'p1', status: 'FAILED', installedAt: new Date('2026-09-01T00:00:00.000Z'), removedAt: new Date('2026-09-05T00:00:00.000Z'), ...expected }),
        part({ id: 'p2', status: 'FAILED', installedAt: new Date('2026-09-10T00:00:00.000Z'), removedAt: new Date('2026-09-12T00:00:00.000Z'), ...expected }),
      ]);

      const rows = await service.buildRows({}, ctx);

      expect(rows[0].prematureFailureCount).toBe(2);
      expect(rows[0].repeatedEarlyFailure).toBe(true);
    });
  });

  describe('listReliability', () => {
    it('paginates and reports meta totals', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ id: 'p1', sparePartId: 's1' }),
        part({ id: 'p2', sparePartId: 's2' }),
        part({ id: 'p3', sparePartId: 's3' }),
      ]);

      const result = await service.listReliability({ page: 2, limit: 2 }, ctx);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });
  });

  describe('getSummary', () => {
    it('reports totals and never fabricates metrics', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ id: 'p1', status: 'ACTIVE' }),
        part({ id: 'p2', status: 'REMOVED', removedAt: new Date('2026-09-11T00:00:00.000Z') }),
      ]);

      const result = await service.getSummary({}, ctx);

      expect(result.populations).toBe(1);
      expect(result.activeInstalledParts).toBe(1);
      expect(result.hasExpectedLifeData).toBe(false);
    });
  });

  describe('getDataQuality', () => {
    it('counts missing lifecycle and expected-life data honestly', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        { id: 'p1', status: 'ACTIVE', installedAt: new Date('2026-09-01T00:00:00.000Z'), removedAt: null, expectedLifeValue: 100, expectedLifeUnit: 'DAYS' },
        { id: 'p2', status: 'REMOVED', installedAt: new Date('2026-09-01T00:00:00.000Z'), removedAt: null, expectedLifeValue: null, expectedLifeUnit: null },
        { id: 'p3', status: 'ACTIVE', installedAt: null, removedAt: null, expectedLifeValue: null, expectedLifeUnit: null },
      ]);

      const q = await service.getDataQuality({}, ctx);

      expect(q.installedPartsTotal).toBe(3);
      expect(q.withoutInstalledAt).toBe(1);
      expect(q.removedMissingRemovedAt).toBe(1);
      expect(q.withExpectedLife).toBe(1);
      expect(q.withoutExpectedLife).toBe(2);
    });
  });

  describe('getPopulationDetail', () => {
    it('rejects a machine outside the tenant before loading history', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getPopulationDetail('mForeign', 's1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('returns the instance timeline for a machine and spare part', async () => {
      prisma.machineInstalledPart.findMany.mockResolvedValue([
        part({ id: 'p1', status: 'REMOVED', machineComponent: { id: 'comp1', code: 'C-1', name: 'Comp One' }, maintenanceRequest: { id: 'req1', requestNumber: 'REQ-1', title: 'Fix' } }),
      ]);

      const detail = await service.getPopulationDetail('m1', 's1', ctx);

      expect(detail.machine?.id).toBe('m1');
      expect(detail.sparePart?.id).toBe('s1');
      expect(detail.timeline).toHaveLength(1);
      expect(detail.timeline[0].instance.status).toBe('REMOVED');
    });
  });
});
