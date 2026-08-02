import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import {
  InstalledPartsReplacementService,
  computeExpectedLifeState,
  DUE_PROGRESS_THRESHOLD,
} from './installed-parts-replacement.service';
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

const ownedMachine = { id: 'm1', companyId: 'c1', branchId: 'b1' };

describe('computeExpectedLifeState (pure)', () => {
  const NOW = new Date('2026-03-01T00:00:00.000Z');

  it('returns UNKNOWN when no expected life value is configured', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: null, expectedLifeUnit: null, lifeStartDate: null, lifeStartReading: null, currentReading: null, warningThresholdPercent: null }, NOW);
    expect(state.lifeStatus).toBe('UNKNOWN');
    expect(state.alertThresholdReached).toBe('NONE');
    expect(state.progress).toBeNull();
  });

  it('returns UNKNOWN for DAYS unit without a start date', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: null, lifeStartReading: null, currentReading: null, warningThresholdPercent: 80 }, NOW);
    expect(state.lifeStatus).toBe('UNKNOWN');
    expect(state.progress).toBeNull();
  });

  it('returns UNKNOWN for HOURS unit without readings', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'HOURS', lifeStartDate: null, lifeStartReading: null, currentReading: null, warningThresholdPercent: 80 }, NOW);
    expect(state.lifeStatus).toBe('UNKNOWN');
    expect(state.progress).toBeNull();
  });

  it('computes DAYS progress and expected expiry date', () => {
    const start = new Date('2026-01-10T00:00:00.000Z');
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: start, lifeStartReading: null, currentReading: null, warningThresholdPercent: 80 }, NOW);
    expect(state.lifeStatus).toBe('NORMAL');
    expect(state.alertThresholdReached).toBe('NONE');
    expect(state.progress).toBeCloseTo(0.5, 5);
    expect(state.expectedExpiryDate).toEqual(new Date('2026-04-20T00:00:00.000Z'));
  });

  it('flags WARNING above the configured threshold', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'HOURS', lifeStartDate: null, lifeStartReading: 0, currentReading: 85, warningThresholdPercent: 80 }, NOW);
    expect(state.lifeStatus).toBe('WARNING');
    expect(state.alertThresholdReached).toBe('WARNING');
    expect(state.progress).toBeCloseTo(0.85, 5);
    expect(state.expectedExpiryReading).toBe(100);
  });

  it('respects a custom warning threshold percent', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'HOURS', lifeStartDate: null, lifeStartReading: 0, currentReading: 70, warningThresholdPercent: 60 }, NOW);
    expect(state.lifeStatus).toBe('WARNING');
    expect(state.alertThresholdReached).toBe('WARNING');
  });

  it('flags DUE at or above the due progress threshold', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'CYCLES', lifeStartDate: null, lifeStartReading: 0, currentReading: 92, warningThresholdPercent: 80 }, NOW);
    expect(state.lifeStatus).toBe('DUE');
    expect(state.alertThresholdReached).toBe('DUE');
    expect(state.progress).toBeGreaterThanOrEqual(DUE_PROGRESS_THRESHOLD);
  });

  it('flags EXPIRED at 100% progress', () => {
    const state = computeExpectedLifeState({ expectedLifeValue: 100, expectedLifeUnit: 'HOURS', lifeStartDate: null, lifeStartReading: 0, currentReading: 100, warningThresholdPercent: 80 }, NOW);
    expect(state.lifeStatus).toBe('EXPIRED');
    expect(state.alertThresholdReached).toBe('EXPIRED');
  });
});

describe('InstalledPartsReplacementService (expected life lifecycle)', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InstalledPartsReplacementService;

  const activePart = {
    id: 'p1',
    machineId: 'm1',
    machine: ownedMachine,
    status: 'ACTIVE',
    expectedLifeValue: 100,
    expectedLifeUnit: 'HOURS',
    lifeStartDate: null,
    lifeStartReading: 0,
    currentReading: 85,
    warningThresholdPercent: 80,
    alertThresholdReached: 'NONE',
    lastEvaluatedAt: null,
    expectedExpiryDate: null,
    expectedExpiryReading: null,
    expectedLifeAlertAt: null,
  };

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      machineInstalledPart: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      machineInstalledPartReading: { create: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InstalledPartsReplacementService(prisma as PrismaService, numbering as NumberingService, audit as AuditService);
  });

  it('rejects expected-life configuration on a non-ACTIVE part', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue({ ...activePart, status: 'REMOVED' });
    const promise = service.setExpectedLife('p1', { expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: '2026-01-01' } as any, 'u1', ctx);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.partNotActive');
  });

  it('requires a life start date for DAYS-based expected life', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue(activePart);
    const promise = service.setExpectedLife('p1', { expectedLifeValue: 100, expectedLifeUnit: 'DAYS' } as any, 'u1', ctx);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.lifeStartDateRequired');
  });

  it('requires a life start reading for HOURS/CYCLES-based expected life', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue(activePart);
    const promise = service.setExpectedLife('p1', { expectedLifeValue: 100, expectedLifeUnit: 'HOURS' } as any, 'u1', ctx);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.lifeStartReadingRequired');
  });

  it('configures expected life, audits and evaluates the part', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue(activePart);
    prisma.machineInstalledPart.update.mockResolvedValue({ ...activePart, lifeStatus: 'NORMAL' });

    await service.setExpectedLife('p1', { expectedLifeValue: 100, expectedLifeUnit: 'HOURS', lifeStartReading: 0, currentReading: 50 } as any, 'u1', ctx);

    expect(prisma.machineInstalledPart.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ expectedLifeValue: 100, expectedLifeUnit: 'HOURS', warningThresholdPercent: 80 }),
    });
    expect(audit.log).toHaveBeenCalledWith('u1', 'EXPECTED_LIFE_CONFIGURED', 'MachineInstalledPart', 'p1', expect.objectContaining({ expectedLifeUnit: 'HOURS' }));
  });

  it('rejects readings on a non-ACTIVE part', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue({ ...activePart, status: 'REMOVED' });
    const promise = service.recordReading('p1', { readingType: 'HOURS', readingValue: 55 }, 'u1', ctx);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.partNotActive');
  });

  it('rejects readings before expected life is configured', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue({ ...activePart, expectedLifeUnit: null });
    const promise = service.recordReading('p1', { readingType: 'HOURS', readingValue: 55 }, 'u1', ctx);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.expectedLifeNotConfigured');
  });

  it('rejects a reading type that does not match the configured unit', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue({ ...activePart, expectedLifeUnit: 'CYCLES' });
    const promise = service.recordReading('p1', { readingType: 'HOURS', readingValue: 55 }, 'u1', ctx);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.readingTypeMismatch');
  });

  it('records a reading in a transaction, updates the counter and audits', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue(activePart);
    prisma.machineInstalledPartReading.create.mockResolvedValue({ id: 'r1' });
    prisma.machineInstalledPart.update.mockResolvedValue({ ...activePart, currentReading: 55 });

    await service.recordReading('p1', { readingType: 'HOURS', readingValue: 55 }, 'u1', ctx);

    expect(prisma.machineInstalledPartReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ installedPartId: 'p1', readingType: 'HOURS', readingValue: 55, recordedByUserId: 'u1' }),
    });
    expect(prisma.machineInstalledPart.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ currentReading: 55 }),
    });
    expect(audit.log).toHaveBeenCalledWith('u1', 'INSTALLED_PART_READING_RECORDED', 'MachineInstalledPart', 'p1', expect.objectContaining({ readingValue: 55 }));
  });

  it('resets the counter when a reset reading is recorded', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue(activePart);
    prisma.machineInstalledPartReading.create.mockResolvedValue({ id: 'r2' });
    prisma.machineInstalledPart.update.mockResolvedValue({ ...activePart, currentReading: 0, lifeStartReading: 0 });

    await service.recordReading('p1', { readingType: 'HOURS', readingValue: 50, isReset: true }, 'u1', ctx);

    expect(prisma.machineInstalledPart.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ currentReading: 0, lifeStartReading: 0 }),
    });
  });

  it('does not expose installed parts of another company', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue({
      ...activePart,
      id: 'pX',
      machine: { id: 'mX', companyId: 'c2', branchId: 'b1' },
    });
    const promise = service.getInstalledPartById('pX', ctx);
    await expect(promise).rejects.toThrow(NotFoundException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.installedPartNotFound');
  });

  it('evaluates part life idempotently and audits only on threshold upgrade', async () => {
    prisma.machineInstalledPart.findUnique
      .mockResolvedValueOnce(activePart)
      .mockResolvedValueOnce({ ...activePart, alertThresholdReached: 'WARNING' });
    prisma.machineInstalledPart.update.mockResolvedValue({ ...activePart, alertThresholdReached: 'WARNING' });

    const first = await service.evaluatePartLife('p1', ctx, 'u1');
    expect(first.changed).toBe(true);
    expect(audit.log).toHaveBeenCalledWith('u1', 'EXPECTED_LIFE_ALERT', 'MachineInstalledPart', 'p1', expect.objectContaining({ previousThreshold: 'NONE', newThreshold: 'WARNING' }));

    audit.log.mockClear();
    const second = await service.evaluatePartLife('p1', ctx, 'u1');
    expect(second.changed).toBe(false);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('evaluateAll only returns parts whose threshold was upgraded', async () => {
    prisma.machineInstalledPart.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    prisma.machineInstalledPart.findUnique
      .mockResolvedValueOnce({ ...activePart })
      .mockResolvedValueOnce({ ...activePart, id: 'p2', currentReading: 30 });
    prisma.machineInstalledPart.update.mockResolvedValue({ ...activePart, alertThresholdReached: 'WARNING' });

    const result = await service.evaluateAll(ctx);
    expect(result.evaluated).toBe(1);
    expect(result.results[0].id).toBe('p1');
  });
});
