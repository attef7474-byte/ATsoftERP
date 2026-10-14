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
  let service: ReliabilityAlertsService;

  beforeEach(() => {
    prisma = {
      machineComponent: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceSchedule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    reliability = { buildRows: jest.fn().mockResolvedValue([]) };
    thresholds = { load: jest.fn().mockResolvedValue(NO_THRESHOLDS) };
    service = new ReliabilityAlertsService(
      prisma as PrismaService,
      reliability as InstalledPartReliabilityService,
      thresholds as ReliabilityAlertThresholdsService,
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
        row({ key: 'k2', sparePart: { ...row().sparePart, id: 's2' }, expectedLife: expLife({ band: 'EXPIRED' }) }),
      ]);

      const result = await service.listAlerts({ severity: 'HIGH' }, ctx);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].severity).toBe('HIGH');
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
      expect(cand.prefill.description).toContain('alertType=LIFE_DUE');
      expect(cand.recommendedAction).toBe('REPLACE');
      expect(cand.recommendedDate).toBe('2026-12-01T00:00:00.000Z');
      expect(cand.hasExistingOpenPlan).toBe(true);
      expect(cand.existingOpenPlans).toHaveLength(1);
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
});
