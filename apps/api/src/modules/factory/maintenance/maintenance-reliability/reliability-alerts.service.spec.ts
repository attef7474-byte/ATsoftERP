import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { ReliabilityAlertsService } from './reliability-alerts.service';
import { InstalledPartReliabilityService, ReliabilityRow } from './installed-part-reliability.service';
import { ReliabilityAlertThresholdsService } from './reliability-alert-thresholds.service';
import { ExpectedLife } from './reliability-calculations';

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

function expLife(over: Partial<ExpectedLife> = {}): ExpectedLife {
  return {
    configured: true,
    unit: 'DAYS',
    progress: 0.5,
    consumedPercent: 50,
    remainingMs: 50 * DAY,
    remainingReading: null,
    totalMs: 100 * DAY,
    band: 'NORMAL',
    expectedExpiryDate: new Date('2026-12-01T00:00:00.000Z'),
    expectedExpiryReading: null,
    ...over,
  };
}

function row(over: any = {}): ReliabilityRow {
  const current =
    over.current !== undefined
      ? over.current
      : {
          id: over.installedPartId ?? 'ip1',
          status: 'ACTIVE',
          installedAt: new Date('2026-06-01T00:00:00.000Z'),
          installedQuantity: 1,
          serialNumber: null,
          batchNumber: null,
          lifeStartReading: null,
          currentReading: null,
          installedCondition: 'NEW',
          serviceLife: { state: 'OK', ms: 10 * DAY },
          expectedLife: over.expectedLife ?? expLife(),
        };
  return {
    key: over.key ?? 'm1::s1',
    machine: over.machine ?? { id: 'm1', code: 'M-1', name: 'Machine One' },
    productionLine: over.productionLine ?? null,
    machineComponent: over.machineComponent === undefined ? { id: 'comp1', code: 'C-1', name: 'Comp One' } : over.machineComponent,
    sparePart: over.sparePart ?? {
      id: 's1', code: 'SP-1', name: 'Bearing', partNumber: 'B-100', manufacturer: 'ACME', isCritical: false, unit: 'PCS',
      defaultExpectedLifeValue: null, defaultExpectedLifeUnit: null, defaultWarningThresholdPercent: null,
    },
    current,
    lastFailureAt: over.lastFailureAt ?? null,
    replacementCount: over.replacementCount ?? 0,
    replacementDates: over.replacementDates ?? [],
    failureEventCount: over.failureEventCount ?? 0,
    prematureFailureCount: over.prematureFailureCount ?? 0,
    repeatedEarlyFailure: over.repeatedEarlyFailure ?? false,
    mtbf: { status: 'INSUFFICIENT_DATA', eventCount: 0, mtbfMs: null, mtbfDays: null, totalServiceMs: 0 },
    mttr: { status: 'INSUFFICIENT_DATA', samples: 0, openRepairs: 0, mttrMs: null, mttrHours: null, laborMs: 0, downtimeMs: 0 },
  };
}

const NO_THRESHOLDS = { replacementFrequencyWindowDays: null, replacementFrequencyMaxCount: null };

describe('ReliabilityAlertsService', () => {
  let prisma: any;
  let reliability: any;
  let thresholds: any;
  let maintenanceRequests: any;
  let audit: any;
  let service: ReliabilityAlertsService;

  beforeEach(() => {
    prisma = {
      machineComponent: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceRequest: { findMany: jest.fn().mockResolvedValue([]) },
      machineInstalledPart: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      sparePartReplacementHistory: { findMany: jest.fn().mockResolvedValue([]) },
      sparePart: { findUnique: jest.fn().mockResolvedValue(null) },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([]) },
      machineInstalledPartReading: { count: jest.fn().mockResolvedValue(0) },
    };
    reliability = { buildRows: jest.fn().mockResolvedValue([]) };
    thresholds = { load: jest.fn().mockResolvedValue(NO_THRESHOLDS) };
    maintenanceRequests = { create: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new ReliabilityAlertsService(
      prisma as PrismaService,
      reliability as InstalledPartReliabilityService,
      thresholds as ReliabilityAlertThresholdsService,
      maintenanceRequests as any,
      audit as any,
    );
  });

  describe('listAlerts', () => {
    it('delegates tenant scoping to the canonical reliability layer (never trusts a frontend filter)', async () => {
      await service.listAlerts({}, ctx);
      expect(reliability.buildRows).toHaveBeenCalledWith({}, ctx);
    });

    it('paginates the derived alerts and reports meta totals', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', machine: { id: 'm1', code: 'A', name: 'A' }, sparePart: { ...row().sparePart, id: 's1', code: 'A' }, expectedLife: expLife({ band: 'WARNING' }) }),
        row({ key: 'k2', machine: { id: 'm2', code: 'B', name: 'B' }, sparePart: { ...row().sparePart, id: 's2', code: 'B' }, expectedLife: expLife({ band: 'DUE' }) }),
        row({ key: 'k3', machine: { id: 'm3', code: 'C', name: 'C' }, sparePart: { ...row().sparePart, id: 's3', code: 'C' }, expectedLife: expLife({ band: 'EXPIRED' }) }),
      ]);

      const result = await service.listAlerts({ page: 1, limit: 2 }, ctx);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
      // highest severity first
      expect(result.data[0].alertType).toBe('LIFE_OVERDUE');
    });

    it('filters by alertType', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', expectedLife: expLife({ band: 'WARNING' }) }),
        row({ key: 'k2', sparePart: { ...row().sparePart, id: 's2' }, expectedLife: expLife({ band: 'EXPIRED' }) }),
      ]);

      const result = await service.listAlerts({ alertType: 'LIFE_APPROACHING_DUE' }, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].alertType).toBe('LIFE_APPROACHING_DUE');
    });

    it('filters by severity', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', expectedLife: expLife({ band: 'WARNING' }) }),
        row({ key: 'k2', sparePart: { ...row().sparePart, id: 's2' }, expectedLife: expLife({ band: 'DUE' }) }),
        row({ key: 'k3', sparePart: { ...row().sparePart, id: 's3' }, expectedLife: expLife({ band: 'EXPIRED' }) }),
      ]);

      const result = await service.listAlerts({ severity: 'HIGH' }, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].severity).toBe('HIGH');
      expect(result.data[0].dueState).toBe('DUE');
    });

    it('filters by dueState', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', expectedLife: expLife({ band: 'WARNING' }) }),
        row({ key: 'k2', sparePart: { ...row().sparePart, id: 's2' }, expectedLife: expLife({ band: 'EXPIRED' }) }),
      ]);

      const result = await service.listAlerts({ dueState: 'EXPIRED' }, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].dueState).toBe('EXPIRED');
    });

    it('filters to critical populations only when isCritical=true', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', expectedLife: expLife({ band: 'DUE' }) }),
        row({ key: 'k2', sparePart: { ...row().sparePart, id: 's2', isCritical: true }, expectedLife: expLife({ band: 'DUE' }) }),
      ]);

      const result = await service.listAlerts({ isCritical: 'true' }, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].criticalitySource).toBe('SPARE_PART_CRITICAL');
    });

    it('searches without leaking raw ids', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', machine: { id: 'm1', code: 'M-1', name: 'Press' }, expectedLife: expLife({ band: 'DUE' }) }),
        row({ key: 'k2', machine: { id: 'm2', code: 'M-2', name: 'Lathe' }, sparePart: { ...row().sparePart, id: 's2', code: 'SP-2', name: 'Belt' }, expectedLife: expLife({ band: 'DUE' }) }),
      ]);

      const result = await service.listAlerts({ search: 'lathe' }, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].machine.name).toBe('Lathe');
    });

    it('reads component criticality in one batched query (no N+1)', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', machineComponent: { id: 'comp1', code: 'C', name: 'C' }, expectedLife: expLife({ band: 'DUE' }) }),
        row({ key: 'k2', machineComponent: { id: 'comp1', code: 'C', name: 'C' }, sparePart: { ...row().sparePart, id: 's2' }, expectedLife: expLife({ band: 'DUE' }) }),
      ]);
      await service.listAlerts({}, ctx);
      expect(prisma.machineComponent.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.machineComponent.findMany.mock.calls[0][0].where).toMatchObject({
        id: { in: ['comp1'] },
        OR: [
          { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
          { companyId: null, branchId: null },
        ],
      });
    });

    it('scopes bulk action-status lookups to the active tenant and branch', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ band: 'DUE' }) })]);

      await service.listAlerts({}, ctx);

      const machineScope = { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] };
      expect(prisma.maintenanceRequest.findMany.mock.calls[0][0].where).toMatchObject({
        machine: machineScope,
        machineId: { in: ['m1'] },
        deletedAt: null,
      });
      expect(prisma.maintenanceSchedule.findMany.mock.calls[0][0].where).toMatchObject({
        machine: machineScope,
        machineId: { in: ['m1'] },
      });
    });
  });

  describe('getSummary', () => {
    it('aggregates counts by type and severity honestly', async () => {
      reliability.buildRows.mockResolvedValue([
        row({ key: 'k1', expectedLife: expLife({ band: 'WARNING' }) }),
        row({ key: 'k2', sparePart: { ...row().sparePart, id: 's2' }, expectedLife: expLife({ band: 'DUE' }) }),
        row({ key: 'k3', sparePart: { ...row().sparePart, id: 's3' }, expectedLife: expLife({ band: 'EXPIRED' }) }),
      ]);

      const sum = await service.getSummary({}, ctx);
      expect(sum.totalAlerts).toBe(3);
      expect(sum.approaching).toBe(1);
      expect(sum.due).toBe(1);
      expect(sum.overdue).toBe(1);
      expect(sum.hasAnyEligibleSignal).toBe(true);
      expect(sum.byType.LIFE_DUE).toBe(1);
    });

    it('reports no eligible signal when nothing qualifies', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ configured: false, band: 'UNKNOWN' }) })]);
      const sum = await service.getSummary({}, ctx);
      expect(sum.totalAlerts).toBe(0);
      expect(sum.hasAnyEligibleSignal).toBe(false);
    });
  });

  describe('getDataQuality', () => {
    it('explains WHY nothing is eligible (populations, unknown life, unconfigured threshold)', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ configured: false, band: 'UNKNOWN' }) })]);
      const dq = await service.getDataQuality({}, ctx);
      expect(dq.notEligibleReasons).toContain('EXPECTED_LIFE_UNKNOWN');
      expect(dq.notEligibleReasons).toContain('REPLACEMENT_FREQUENCY_THRESHOLD_NOT_CONFIGURED');
      expect(dq.replacementFrequencyThresholdConfigured).toBe(false);
      expect(dq.unknownExpectedLife).toBe(1);
    });

    it('flags an empty population set', async () => {
      reliability.buildRows.mockResolvedValue([]);
      const dq = await service.getDataQuality({}, ctx);
      expect(dq.notEligibleReasons).toContain('NO_POPULATIONS');
      expect(dq.populations).toBe(0);
    });

    it('omits the unconfigured threshold reason once a threshold exists', async () => {
      thresholds.load.mockResolvedValue({ replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 3 });
      reliability.buildRows.mockResolvedValue([row({ replacementCount: 1, replacementDates: [new Date()] })]);
      const dq = await service.getDataQuality({}, ctx);
      expect(dq.replacementFrequencyThresholdConfigured).toBe(true);
      expect(dq.notEligibleReasons).not.toContain('REPLACEMENT_FREQUENCY_THRESHOLD_NOT_CONFIGURED');
    });
  });

  describe('getPlanningCandidate', () => {
    it('requires machineId and sparePartId', async () => {
      await expect(service.getPlanningCandidate({ machineId: 'm1' }, ctx)).rejects.toThrow(BadRequestException);
      await expect(service.getPlanningCandidate({ sparePartId: 's1' }, ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown machine/part population (tenant-safe)', async () => {
      reliability.buildRows.mockResolvedValue([]);
      await expect(service.getPlanningCandidate({ machineId: 'm1', sparePartId: 's1' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('returns a prefill for the existing canonical preventive form plus duplicate detection', async () => {
      reliability.buildRows.mockResolvedValue([row({ key: 'm1::s1', expectedLife: expLife({ band: 'DUE' }) })]);
      prisma.maintenanceSchedule.findMany.mockResolvedValue([
        { id: 'sch1', title: 'PM existing', type: 'PREVENTIVE', frequency: 'MONTHLY', status: 'ACTIVE', nextDueDate: new Date('2026-11-01T00:00:00.000Z') },
      ]);

      const cand = await service.getPlanningCandidate({ machineId: 'm1', sparePartId: 's1', alertType: 'LIFE_DUE' }, ctx);

      expect(cand.prefill).toMatchObject({
        machineId: 'm1',
        sparePartId: 's1',
        type: 'PREVENTIVE',
      });
      expect(cand.prefill.description).toContain('source=reliability-alerts');
      expect(cand.prefill.description.match(/source=reliability-alerts/g)).toHaveLength(1);
      expect(cand.prefill.description).toContain('alertType=LIFE_DUE');
      expect(cand.recommendedAction).toBe('REPLACE');
      expect(cand.recommendedDate).toBe('2026-12-01T00:00:00.000Z');
      expect(cand.hasExistingOpenPlan).toBe(true);
      expect(cand.existingOpenPlans).toHaveLength(1);
      expect(prisma.maintenanceSchedule.findMany.mock.calls[0][0].where).toMatchObject({
        machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
        machineId: 'm1',
        status: 'ACTIVE',
        type: 'PREVENTIVE',
      });
    });

    it('rejects a client-supplied installed part outside the scoped machine/part population', async () => {
      reliability.buildRows.mockResolvedValue([row({ key: 'm1::s1' })]);
      prisma.machineInstalledPart.findFirst.mockResolvedValue(null);

      await expect(
        service.getPlanningCandidate({ machineId: 'm1', sparePartId: 's1', installedPartId: 'foreign-part' }, ctx),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.machineInstalledPart.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'foreign-part',
          machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
          sparePartId: 's1',
        },
        select: { id: true },
      });
    });

    it('defaults to LIFE_DUE and reports no existing plan when the machine has none', async () => {
      reliability.buildRows.mockResolvedValue([row({ key: 'm1::s1' })]);
      prisma.maintenanceSchedule.findMany.mockResolvedValue([]);

      const cand = await service.getPlanningCandidate({ machineId: 'm1', sparePartId: 's1' }, ctx);
      expect(cand.alertType).toBe('LIFE_DUE');
      expect(cand.recommendedAction).toBe('REPLACE');
      expect(cand.hasExistingOpenPlan).toBe(false);
    });

    it('never writes: only reads (no create/update/delete calls)', async () => {
      reliability.buildRows.mockResolvedValue([row({ key: 'm1::s1' })]);
      await service.getPlanningCandidate({ machineId: 'm1', sparePartId: 's1' }, ctx);
      for (const model of Object.values(prisma) as any[]) {
        for (const fn of Object.values(model) as any[]) {
          expect(fn).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.anything() }));
        }
      }
    });
  });

  describe('§63 alert lifecycle', () => {
    it('is DERIVED_ALERTS_ONLY: acknowledge/defer/dismiss are NOT_APPLICABLE (no such API)', () => {
      expect((service as any).acknowledge).toBeUndefined();
      expect((service as any).defer).toBeUndefined();
      expect((service as any).dismiss).toBeUndefined();
      expect((service as any).resolve).toBeUndefined();
    });
  });

  describe('alert action bridge', () => {
    const user: any = { id: 'u1' };
    const alertId = 'ip1:LIFE_OVERDUE';

    it('creates a canonical request with prefilled context and audits the alert source', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ band: 'EXPIRED' }) })]);
      maintenanceRequests.create.mockResolvedValue({
        id: 'req1', requestNumber: 'MR-1', title: 'Machine / part', status: 'OPEN', priority: 'URGENT', type: 'CORRECTIVE',
      });

      const result = await service.createMaintenanceRequestFromAlert(
        { alertId, description: 'Overdue bearing replacement' }, user, ctx,
      );

      expect(result.created).toBe(true);
      expect(result.sourceToken).toContain(`alertId=${alertId}`);
      expect(maintenanceRequests.create).toHaveBeenCalledTimes(1);
      expect(maintenanceRequests.create.mock.calls[0][0]).toMatchObject({
        machineId: 'm1',
        // A proactive alert must never implicitly open a machine downtime.
        machineStopped: false,
        type: 'CORRECTIVE',
        priority: 'URGENT',
      });
      expect(maintenanceRequests.create.mock.calls[0][0].description).toBe('Overdue bearing replacement');
      expect(maintenanceRequests.create.mock.calls[0][0].description).not.toContain('source=reliability-alerts');
      expect(maintenanceRequests.create.mock.calls[0][0].notes).toContain(`alertId=${alertId}`);
      expect(maintenanceRequests.create.mock.calls[0][0].requiredParts[0]).toMatchObject({
        sparePartId: 's1', machineId: 'm1', quantity: 1, isPrimary: true,
      });
      expect(audit.log).toHaveBeenCalledWith(
        'u1',
        'CREATE_MAINTENANCE_REQUEST_FROM_ALERT',
        'MaintenanceRequest',
        'req1',
        expect.stringContaining(alertId),
      );
    });

    it('returns the existing linked request on a repeated click (no duplicate)', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ band: 'EXPIRED' }) })]);
      const linked = { id: 'req1', requestNumber: 'MR-1', title: 'Machine / part', status: 'OPEN', priority: 'URGENT', type: 'CORRECTIVE' };
      prisma.maintenanceRequest.findMany.mockResolvedValue([linked]);

      const result = await service.createMaintenanceRequestFromAlert({ alertId }, user, ctx);

      expect(result.created).toBe(false);
      expect(result.request).toEqual(linked);
      expect(maintenanceRequests.create).not.toHaveBeenCalled();
      expect(prisma.maintenanceRequest.findMany.mock.calls[0][0].where).toMatchObject({
        machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
        machineId: 'm1',
        deletedAt: null,
      });
    });

    it('rejects an alert id from another tenant through the scoped reliability layer', async () => {
      reliability.buildRows.mockResolvedValue([]);
      await expect(service.createMaintenanceRequestFromAlert({ alertId: 'other:LIFE_DUE' }, user, ctx))
        .rejects.toThrow(NotFoundException);
      expect(reliability.buildRows).toHaveBeenCalledWith({}, ctx);
      expect(maintenanceRequests.create).not.toHaveBeenCalled();
    });

    it('derives action status from linked canonical documents only', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ band: 'EXPIRED' }) })]);
      prisma.maintenanceRequest.findMany.mockResolvedValue([]);
      prisma.maintenanceSchedule.findMany.mockResolvedValue([]);
      expect((await service.getActionStatus({ alertId }, ctx)).status).toBe('NO_ACTION');
      prisma.maintenanceSchedule.findMany.mockResolvedValue([{ id: 'sch1', title: 'PM', type: 'PREVENTIVE', status: 'ACTIVE' }]);
      expect((await service.getActionStatus({ alertId }, ctx)).status).toBe('SCHEDULED');
    });

    it('shows each failed instance its own applied life and scopes linked history', async () => {
      reliability.buildRows.mockResolvedValue([row({ expectedLife: expLife({ band: 'EXPIRED' }) })]);
      prisma.machineInstalledPart.findMany.mockResolvedValue([{
        id: 'failed1',
        installedAt: new Date('2026-01-01T00:00:00.000Z'),
        removedAt: new Date('2026-02-01T00:00:00.000Z'),
        status: 'FAILED',
        serialNumber: null,
        batchNumber: null,
        expectedLifeValue: 17,
        expectedLifeUnit: 'DAYS',
        lifeStartDate: new Date('2026-01-01T00:00:00.000Z'),
        lifeStartReading: null,
        currentReading: null,
        warningThresholdPercent: 80,
        removedReason: 'WEAR',
        maintenanceRequest: null,
      }]);

      const detail = await service.getAlertDetail({ alertId }, ctx);

      expect(detail.failureHistory[0]).toMatchObject({
        installedPartId: 'failed1',
        expectedLifeValue: 17,
        expectedLifeUnit: 'DAYS',
      });
      expect(prisma.machineInstalledPart.findMany.mock.calls[0][0].where).toMatchObject({
        machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
        machineId: 'm1',
        status: 'FAILED',
      });
      expect(prisma.sparePartReplacementHistory.findMany.mock.calls[0][0].where).toMatchObject({
        machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
        machineId: 'm1',
      });
    });
  });
});
