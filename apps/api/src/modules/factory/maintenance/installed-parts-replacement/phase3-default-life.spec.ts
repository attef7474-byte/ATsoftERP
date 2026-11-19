import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { InstalledPartsReplacementService, buildInstalledPartLifeView } from './installed-parts-replacement.service';
import { CreateSparePartDto, UpdateSparePartDto } from '../spare-parts/dto/create-spare-part.dto';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { EXCEL_DEFINITIONS } from '../../master-data-excel/excel.definitions';

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

const baseInstall = {
  machineId: 'm1',
  sparePartId: 'sp1',
  installedQuantity: 1,
  installedCondition: 'NEW',
  installedByUserId: 'u1',
};

const makeTx = (catalog: any) => ({
  sparePart: { findUnique: jest.fn().mockResolvedValue(catalog) },
  machineInstalledPart: {
    create: jest.fn(async ({ data }: any) => ({ id: `ip-${data.expectedLifeValue ?? 'none'}`, ...data })),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  machineInstalledPartReading: { findMany: jest.fn(), create: jest.fn() },
  // Explicit sentinels: Phase 3 snapshotting must never call an inventory writer.
  inventoryMovement: { create: jest.fn(), update: jest.fn() },
  inventoryBalance: { update: jest.fn(), upsert: jest.fn() },
  product: { update: jest.fn() },
});

const makeInstalledService = () =>
  new InstalledPartsReplacementService({} as PrismaService, {} as NumberingService, { log: jest.fn() } as any);

const createCall = (tx: any) => tx.machineInstalledPart.create.mock.calls[0][0].data;

describe('Phase 3 — catalog default expected life (SparePart)', () => {
  let service: SparePartsService;
  let tx: any;
  let audit: any;

  beforeEach(() => {
    audit = { logWithClient: jest.fn() };
    service = new SparePartsService({} as PrismaService, audit as AuditService, {} as NumberingService);
    jest.spyOn(service, 'validateMasterInTx').mockResolvedValue(undefined);
    tx = {
      sparePart: {
        create: jest.fn(async ({ data }: any) => ({ id: 'sp1', code: 'SP-1', ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 'sp1', code: 'SP-1', ...data })),
      },
    };
  });

  it('persists a configured standard life with all three canonical fields and audits the snapshot', async () => {
    await service.createInTx(tx, {
      name: 'Bearing',
      defaultExpectedLifeValue: 8000,
      defaultExpectedLifeUnit: 'HOURS',
      defaultWarningThresholdPercent: 75,
    } as CreateSparePartDto, 'u1');

    expect(tx.sparePart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        defaultExpectedLifeValue: 8000,
        defaultExpectedLifeUnit: 'HOURS',
        defaultWarningThresholdPercent: 75,
      }),
    });
    expect(audit.logWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'CREATE',
      entity: 'SparePart',
      details: expect.objectContaining({
        defaultLife: { value: 8000, unit: 'HOURS', warningThresholdPercent: 75 },
      }),
    }));
  });

  it('keeps NULL as a valid legacy standard and never fabricates a life value', async () => {
    await service.createInTx(tx, {
      name: 'Legacy part',
      defaultExpectedLifeValue: null,
      defaultExpectedLifeUnit: null,
      defaultWarningThresholdPercent: null,
    } as any, 'u1');

    expect(tx.sparePart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        defaultExpectedLifeValue: null,
        defaultExpectedLifeUnit: null,
        defaultWarningThresholdPercent: null,
      }),
    });
  });

  it.each([
    [0, 'HOURS', 80, 'spareParts.defaultLifeValueInvalid'],
    [-1, 'HOURS', 80, 'spareParts.defaultLifeValueInvalid'],
    [8000, 'MINUTES', 80, 'spareParts.defaultLifeUnitInvalid'],
    [8000, null, 80, 'spareParts.defaultLifeUnitRequired'],
    [8000, 'HOURS', 0, 'spareParts.defaultWarningThresholdInvalid'],
    [8000, 'HOURS', 100, 'spareParts.defaultWarningThresholdInvalid'],
  ])('rejects invalid catalog life (%s, %s, %s)', async (value, unit, warning, messageKey) => {
    await expect(service.createInTx(tx, {
      name: 'Invalid',
      defaultExpectedLifeValue: value,
      defaultExpectedLifeUnit: unit,
      defaultWarningThresholdPercent: warning,
    } as any, 'u1')).rejects.toMatchObject({ response: { messageKey } });
    expect(tx.sparePart.create).not.toHaveBeenCalled();
  });

  it('audits a catalog default change with previous and current values', async () => {
    const existing = {
      id: 'sp1', code: 'SP-1',
      defaultExpectedLifeValue: 8000,
      defaultExpectedLifeUnit: 'HOURS',
      defaultWarningThresholdPercent: 80,
    };
    await service.updateInTx(tx, 'sp1', { defaultExpectedLifeValue: 10000 } as UpdateSparePartDto, existing, 'u1');

    expect(tx.sparePart.update).toHaveBeenCalledWith({
      where: { id: 'sp1' },
      data: expect.objectContaining({
        defaultExpectedLifeValue: 10000,
        defaultExpectedLifeUnit: 'HOURS',
        defaultWarningThresholdPercent: 80,
      }),
    });
    const details = audit.logWithClient.mock.calls[0][1].details;
    expect(details.defaultLife).toEqual({
      previous: { value: 8000, unit: 'HOURS', warningThresholdPercent: 80 },
      current: { value: 10000, unit: 'HOURS', warningThresholdPercent: 80 },
    });
  });

  it('accepts explicit NULL values in the DTO without validation errors', async () => {
    const dto = plainToInstance(CreateSparePartDto, {
      name: 'Legacy part',
      defaultExpectedLifeValue: null,
      defaultExpectedLifeUnit: null,
      defaultWarningThresholdPercent: null,
    });
    expect(await validate(dto)).toEqual([]);
  });
});

describe('Phase 3 — immutable installed-part snapshot inheritance', () => {
  it('inherits 8000 HOURS on install A, keeps it after the catalog changes, and gives install B 10000', async () => {
    const service = makeInstalledService();
    const txA = makeTx({ defaultExpectedLifeValue: 8000, defaultExpectedLifeUnit: 'HOURS', defaultWarningThresholdPercent: 80 });
    const a: any = await service.recordInstalledPartInTx(txA, baseInstall as any);

    expect(createCall(txA)).toMatchObject({
      expectedLifeValue: 8000,
      expectedLifeUnit: 'HOURS',
      warningThresholdPercent: 80,
      lifeStartReading: null,
      currentReading: null,
    });
    expect(a.expectedLifeValue).toBe(8000);

    // Simulate the catalog update through the same shared boundary: a different
    // transaction observes the new SparePart row. Install A is never revisited.
    const txB = makeTx({ defaultExpectedLifeValue: 10000, defaultExpectedLifeUnit: 'HOURS', defaultWarningThresholdPercent: 80 });
    const b: any = await service.recordInstalledPartInTx(txB, baseInstall as any);

    expect(createCall(txA).expectedLifeValue).toBe(8000);
    expect(createCall(txB).expectedLifeValue).toBe(10000);
    expect(b.expectedLifeValue).toBe(10000);
    expect(txA.sparePart.findUnique).toHaveBeenCalledTimes(1);
    expect(txB.sparePart.findUnique).toHaveBeenCalledTimes(1);
  });

  it('snapshots DAYS from installation date and never creates meter fields', async () => {
    const service = makeInstalledService();
    const installedAt = new Date('2026-03-01T00:00:00.000Z');
    const tx = makeTx({ defaultExpectedLifeValue: 30, defaultExpectedLifeUnit: 'DAYS', defaultWarningThresholdPercent: 70 });
    await service.recordInstalledPartInTx(tx, { ...baseInstall, installedAt } as any);

    const data = createCall(tx);
    expect(data.lifeStartDate).toEqual(installedAt);
    expect(data.expectedExpiryDate).toEqual(new Date('2026-03-31T00:00:00.000Z'));
    expect(data.lifeStartReading).toBeNull();
    expect(data.currentReading).toBeNull();
    expect(data.expectedExpiryReading).toBeNull();
    expect(data.warningThresholdPercent).toBe(70);
  });

  it('snapshots an HOURS standard as UNKNOWN until a first reading is recorded', async () => {
    const service = makeInstalledService();
    const tx = makeTx({ defaultExpectedLifeValue: 8000, defaultExpectedLifeUnit: 'HOURS', defaultWarningThresholdPercent: null });
    await service.recordInstalledPartInTx(tx, baseInstall as any);

    expect(createCall(tx)).toMatchObject({
      expectedLifeValue: 8000,
      expectedLifeUnit: 'HOURS',
      lifeStartReading: null,
      currentReading: null,
      lifeStatus: 'UNKNOWN',
      alertThresholdReached: 'NONE',
      warningThresholdPercent: 80,
    });
  });

  it('snapshots a CYCLES override with an explicit starting counter', async () => {
    const service = makeInstalledService();
    const tx = makeTx({ defaultExpectedLifeValue: 8000, defaultExpectedLifeUnit: 'HOURS', defaultWarningThresholdPercent: 80 });
    await service.recordInstalledPartInTx(tx, {
      ...baseInstall,
      expectedLifeValue: 500,
      expectedLifeUnit: 'CYCLES',
      lifeStartReading: 100,
      currentReading: 150,
      warningThresholdPercent: 70,
    } as any);

    const data = createCall(tx);
    expect(data).toMatchObject({
      expectedLifeValue: 500,
      expectedLifeUnit: 'CYCLES',
      lifeStartReading: 100,
      currentReading: 150,
      expectedExpiryReading: 600,
      warningThresholdPercent: 70,
      lifeStatus: 'NORMAL',
    });
  });

  it('rejects a snapshot whose current reading is lower than its life start reading', async () => {
    const service = makeInstalledService();
    const tx = makeTx({ defaultExpectedLifeValue: 100, defaultExpectedLifeUnit: 'HOURS', defaultWarningThresholdPercent: 80 });

    await expect(service.recordInstalledPartInTx(tx, {
      ...baseInstall, lifeStartReading: 100, currentReading: 90,
    } as any)).rejects.toMatchObject({ response: { messageKey: 'maintenance.readingCannotDecrease' } });
    expect(tx.machineInstalledPart.create).not.toHaveBeenCalled();
  });

  it('does not create an inventory movement, balance change or product update', async () => {
    const service = makeInstalledService();
    const tx = makeTx({ defaultExpectedLifeValue: 100, defaultExpectedLifeUnit: 'DAYS', defaultWarningThresholdPercent: 80 });
    await service.recordInstalledPartInTx(tx, baseInstall as any);

    expect(tx.machineInstalledPart.create).toHaveBeenCalledTimes(1);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.update).not.toHaveBeenCalled();
    expect(tx.inventoryBalance.update).not.toHaveBeenCalled();
    expect(tx.inventoryBalance.upsert).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('builds a read model that distinguishes catalog standard from applied snapshot', () => {
    const part = {
      expectedLifeValue: 500, expectedLifeUnit: 'CYCLES', warningThresholdPercent: 70,
      lifeStartReading: 100, currentReading: 150, lifeStartDate: null,
      lastEvaluatedAt: null,
    };
    const standard = { defaultExpectedLifeValue: 8000, defaultExpectedLifeUnit: 'HOURS', defaultWarningThresholdPercent: 80 };
    const view = buildInstalledPartLifeView(part, standard, new Date('2026-03-01T00:00:00.000Z'));

    expect(view).toMatchObject({
      standardExpectedLifeValue: 8000,
      standardExpectedLifeUnit: 'HOURS',
      appliedExpectedLifeValue: 500,
      appliedExpectedLifeUnit: 'CYCLES',
      consumed: 50,
      remaining: 450,
      progressPercent: 10,
      isOverridden: true,
      lifeStatus: 'NORMAL',
    });
  });
});

describe('Phase 3 — reading history, tenant denial and removal safety', () => {
  let prisma: any;
  let audit: any;
  let service: InstalledPartsReplacementService;

  const part = {
    id: 'ip1', machineId: 'm1', status: 'ACTIVE',
    machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
    expectedLifeValue: 100,
    expectedLifeUnit: 'HOURS',
    lifeStartReading: 0,
    currentReading: 60,
    warningThresholdPercent: 80,
    alertThresholdReached: 'NONE',
    lastEvaluatedAt: null,
    expectedExpiryDate: null,
    expectedExpiryReading: null,
  };

  beforeEach(() => {
    prisma = {
      machineInstalledPart: {
        findUnique: jest.fn().mockResolvedValue(part),
        update: jest.fn().mockResolvedValue(part),
        findMany: jest.fn(),
      },
      machineInstalledPartReading: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r2', readingValue: 0, isReset: true },
          { id: 'r1', readingValue: 60, isReset: false },
        ]),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn() };
    service = new InstalledPartsReplacementService(prisma as PrismaService, {} as NumberingService, audit as AuditService);
  });

  it('returns the complete ordered reading history, including explicit resets', async () => {
    const history = await service.getReadings('ip1', ctx);

    expect(prisma.machineInstalledPartReading.findMany).toHaveBeenCalledWith({
      where: { installedPartId: 'ip1' },
      orderBy: { recordedAt: 'desc' },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
    expect(history.map((r: any) => r.id)).toEqual(['r2', 'r1']);
    expect(history[0].isReset).toBe(true);
  });

  it('denies reading recording on another company’s installed part', async () => {
    prisma.machineInstalledPart.findUnique.mockResolvedValue({
      ...part,
      machine: { id: 'mX', companyId: 'c2', branchId: 'b1' },
    });

    await expect(service.recordReading('ip1', { readingType: 'HOURS', readingValue: 70 } as any, 'u1', ctx))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.machineInstalledPartReading.create).not.toHaveBeenCalled();
  });

  it('keeps the life snapshot untouched when an installed part is removed', async () => {
    const tx = makeTx(null);
    tx.machineInstalledPart.update = jest.fn(async ({ data }: any) => ({ id: 'ip1', ...data }));
    await service.markInstalledPartRemovedInTx(tx, 'ip1', { removedByUserId: 'u1' });

    const data = tx.machineInstalledPart.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'REMOVED', removedByUserId: 'u1' });
    expect(data).not.toHaveProperty('expectedLifeValue');
    expect(data).not.toHaveProperty('currentReading');
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.inventoryBalance.update).not.toHaveBeenCalled();
  });
});

describe('Phase 3 — limited Excel round-trip columns', () => {
  it('exports the three Spare Part standard-life columns and no installed-part reading columns', () => {
    const fields = EXCEL_DEFINITIONS['spare-parts'].columns.map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining([
      'defaultExpectedLifeValue',
      'defaultExpectedLifeUnit',
      'defaultWarningThresholdPercent',
    ]));
    expect(fields).not.toContain('lifeStartReading');
    expect(fields).not.toContain('currentReading');
  });

  it('restricts the Excel unit column to the canonical units', () => {
    const column = EXCEL_DEFINITIONS['spare-parts'].columns.find((c) => c.field === 'defaultExpectedLifeUnit')!;
    expect(column.type).toBe('enum');
    expect(column.values).toEqual(['DAYS', 'HOURS', 'CYCLES']);
  });
});
