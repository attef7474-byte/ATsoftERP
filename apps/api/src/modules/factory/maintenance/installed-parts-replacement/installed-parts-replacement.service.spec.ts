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
    numbering = {
      generateNumberAtomic: jest.fn(),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('REP-0001'),
    };
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

  it('generates the replacement number on the transaction client, never the root client', async () => {
    prisma.sparePartReplacementHistory = { create: jest.fn().mockResolvedValue({ id: 'rep1' }) };
    const tx = prisma;

    const result = await service.recordReplacementInTx(tx, {
      machineId: 'm1',
      maintenanceRequestId: 'req1',
      requiredPartId: 'line1',
      newInstalledPartId: 'ip1',
      newSparePartId: 'sp1',
      issuedCondition: 'NEW',
      issuedQuantity: 2,
      replacementAction: 'RETURNED_REMOVED_PART',
      inventoryOutMovementId: 'im1',
      replacedByUserId: 'u1',
    });

    expect(result).toEqual({ id: 'rep1' });
    expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('SPARE_PART_REPLACEMENT', tx);
    expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
    expect(prisma.sparePartReplacementHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ machineId: 'm1', newSparePartId: 'sp1', inventoryOutMovementId: 'im1' }),
      }),
    );
  });
});

describe('InstalledPartsReplacementService (installed part lookup)', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InstalledPartsReplacementService;

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      machineInstalledPart: { findMany: jest.fn(), count: jest.fn() },
    };
    numbering = { generateNumberAtomic: jest.fn(), generateNumberAtomicWithClient: jest.fn() };
    audit = { log: jest.fn() };
    service = new InstalledPartsReplacementService(prisma as PrismaService, numbering as NumberingService, audit as AuditService);
    prisma.machineInstalledPart.findMany.mockResolvedValue([]);
    prisma.machineInstalledPart.count.mockResolvedValue(0);
  });

  it('scopes the lookup to the active company and branch even without filters', async () => {
    await service.lookupInstalledParts({}, ctx);

    expect(prisma.machineInstalledPart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] } },
      }),
    );
  });

  it('restricts the lookup to ACTIVE parts when status is requested', async () => {
    await service.lookupInstalledParts({ status: 'ACTIVE' } as any, ctx);

    const where = prisma.machineInstalledPart.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.machine).toEqual({ companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] });
  });

  it('applies machine, component and spare-part filters together', async () => {
    prisma.machine.findUnique.mockResolvedValue(ownedMachine);

    await service.lookupInstalledParts({ machineId: 'm1', machineComponentId: 'mc1', sparePartId: 'sp1' } as any, ctx);

    const where = prisma.machineInstalledPart.findMany.mock.calls[0][0].where;
    expect(where.machineId).toBe('m1');
    expect(where.machineComponentId).toBe('mc1');
    expect(where.sparePartId).toBe('sp1');
  });

  it('refuses to look up parts of a machine owned by another company', async () => {
    prisma.machine.findUnique.mockResolvedValue({ id: 'mX', companyId: 'c2', branchId: 'b1' });

    const promise = service.lookupInstalledParts({ machineId: 'mX' } as any, ctx);
    await expect(promise).rejects.toThrow(NotFoundException);
    expect(prisma.machineInstalledPart.findMany).not.toHaveBeenCalled();
  });

  it('paginates the lookup', async () => {
    prisma.machineInstalledPart.count.mockResolvedValue(42);

    const result = await service.lookupInstalledParts({ page: 3, limit: 10 } as any, ctx);

    expect(prisma.machineInstalledPart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    expect(result).toEqual(expect.objectContaining({
      data: [],
      meta: { page: 3, limit: 10, total: 42, totalPages: 5 },
    }));
  });
});

describe('InstalledPartsReplacementService (installed-part component/machine invariant)', () => {
  let service: InstalledPartsReplacementService;
  let numbering: any;
  let tx: any;

  const baseData = {
    machineId: 'm1',
    machineComponentId: 'mc1',
    sparePartId: 'sp1',
    maintenanceRequestId: 'req1',
    requiredPartId: 'line1',
    inventoryMovementId: 'mv1',
    installedQuantity: 1,
    installedCondition: 'NEW',
    installedByUserId: 'u1',
  };

  const replacementData = {
    machineId: 'm1',
    machineComponentId: 'mc1',
    maintenanceRequestId: 'req1',
    requiredPartId: 'line1',
    newInstalledPartId: 'ip2',
    newSparePartId: 'sp1',
    issuedCondition: 'NEW',
    issuedQuantity: 1,
    replacementAction: 'RETURNED_REMOVED_PART',
    inventoryOutMovementId: 'mv1',
    replacedByUserId: 'u1',
  };

  beforeEach(() => {
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('REP-0001') };
    service = new InstalledPartsReplacementService({} as PrismaService, numbering as NumberingService, { log: jest.fn() } as any);
    tx = {
      machineComponent: { findUnique: jest.fn() },
      machineInstalledPart: { create: jest.fn().mockResolvedValue({ id: 'ip1' }) },
      sparePartReplacementHistory: { create: jest.fn().mockResolvedValue({ id: 'rep1' }) },
    };
  });

  it('records the installed part when the component belongs to the machine', async () => {
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'mc1', machineId: 'm1', machine: { companyId: null, branchId: null } });

    await service.recordInstalledPartInTx(tx, baseData);

    expect(tx.machineInstalledPart.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an installed part whose component belongs to another machine', async () => {
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'mc1', machineId: 'm2', machine: { companyId: null, branchId: null } });

    const promise = service.recordInstalledPartInTx(tx, baseData);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.machineComponentMachineMismatch');
    expect(tx.machineInstalledPart.create).not.toHaveBeenCalled();
  });

  it('rejects when the referenced component does not exist', async () => {
    tx.machineComponent.findUnique.mockResolvedValue(null);

    await expect(service.recordInstalledPartInTx(tx, baseData)).rejects.toThrow(NotFoundException);
    expect(tx.machineInstalledPart.create).not.toHaveBeenCalled();
  });

  it('does not load a component when the installed part is machine-level', async () => {
    await service.recordInstalledPartInTx(tx, { ...baseData, machineComponentId: null });

    expect(tx.machineComponent.findUnique).not.toHaveBeenCalled();
    expect(tx.machineInstalledPart.create).toHaveBeenCalledTimes(1);
  });

  // TEST A — valid machine/component pair.
  it('records the replacement history when the component belongs to the machine', async () => {
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'mc1', machineId: 'm1', machine: { companyId: null, branchId: null } });

    const result = await service.recordReplacementInTx(tx, replacementData);

    expect(result).toEqual({ id: 'rep1' });
    expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('SPARE_PART_REPLACEMENT', tx);
    expect(tx.sparePartReplacementHistory.create).toHaveBeenCalledTimes(1);
  });

  // TEST B — same-tenant component that belongs to a DIFFERENT machine.
  it('rejects a replacement whose component belongs to another machine (400)', async () => {
    tx.machineComponent.findUnique.mockResolvedValue({ id: 'mc1', machineId: 'm2', machine: { companyId: null, branchId: null } });

    const promise = service.recordReplacementInTx(tx, replacementData);
    await expect(promise).rejects.toThrow(BadRequestException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.machineComponentMachineMismatch');
    // TEST F — the guard fails closed before any replacement-history mutation.
    expect(tx.sparePartReplacementHistory.create).not.toHaveBeenCalled();
    expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
  });

  // TEST D — missing component.
  it('rejects a replacement when the referenced component does not exist (404)', async () => {
    tx.machineComponent.findUnique.mockResolvedValue(null);

    await expect(service.recordReplacementInTx(tx, replacementData)).rejects.toThrow(NotFoundException);
    expect(tx.sparePartReplacementHistory.create).not.toHaveBeenCalled();
  });

  // TEST E — nullable component (whole-machine replacement).
  it('accepts a machine-level replacement with no component', async () => {
    const result = await service.recordReplacementInTx(tx, { ...replacementData, machineComponentId: null });

    expect(result).toEqual({ id: 'rep1' });
    expect(tx.machineComponent.findUnique).not.toHaveBeenCalled();
    expect(tx.sparePartReplacementHistory.create).toHaveBeenCalledTimes(1);
  });
});

// TEST C — foreign / out-of-context component. This low-level writer has no active
// context and operates only on server-derived, tenant-validated identities
// (findPartLineOrFail loads the requirement line tenant-scoped and validates the
// machine; the component id comes from that line, never from the client). The 404
// "foreign component" contract is therefore enforced upstream at the tenant-facing
// boundary. That boundary is covered by
// maintenance-spare-part-request-lines/tenant-spare-part-request-lines.spec.ts
// ("rejects create when a client-supplied component is outside the active context").
