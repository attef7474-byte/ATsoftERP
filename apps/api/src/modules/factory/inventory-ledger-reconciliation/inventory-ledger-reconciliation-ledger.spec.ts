import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryLedgerReconciliationService } from './inventory-ledger-reconciliation.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const branchScope = { OR: [{ branchId: null }, { branchId: ctx.branchId }] };
const warehouseScope = { companyId: ctx.companyId, deletedAt: null, AND: [branchScope] };
const movementScope = {
  companyId: ctx.companyId,
  deletedAt: null,
  warehouse: warehouseScope,
  AND: [branchScope],
};

const movement = (id: string, movementDate: Date) => ({
  id,
  movementNumber: `IM-${id}`,
  companyId: ctx.companyId,
  branchId: ctx.branchId,
  warehouseId: 'wh1',
  movementType: 'MANUAL',
  status: 'POSTED',
  direction: 'IN',
  movementDate,
  lines: [],
});

function inRange(row: any, range: any): boolean {
  if (!range) return true;
  const time = row.movementDate.getTime();
  if (range.gte && time < range.gte.getTime()) return false;
  if (range.lt && time >= range.lt.getTime()) return false;
  if (range.lte && time > range.lte.getTime()) return false;
  return true;
}

describe('InventoryLedgerReconciliationService — ledger source hardening', () => {
  let prisma: any;
  let service: InventoryLedgerReconciliationService;

  beforeEach(() => {
    prisma = {
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'wh1' }) },
      warehouseLocation: { findFirst: jest.fn() },
      inventoryMovement: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new InventoryLedgerReconciliationService(prisma);
  });

  const useMovements = (rows: any[]) => {
    prisma.inventoryMovement.findMany.mockImplementation(
      async ({ skip = 0, take = 100, where }: any) =>
        rows.filter((row) => inRange(row, where?.movementDate)).slice(skip, skip + take),
    );
    prisma.inventoryMovement.count.mockImplementation(
      async ({ where }: any) =>
        rows.filter((row) => inRange(row, where?.movementDate)).length,
    );
  };

  it('ILH-P01 applies a deterministic same-timestamp ordering', async () => {
    const stamp = new Date('2026-11-13T12:00:00.000Z');
    useMovements([
      movement('mv-d', stamp),
      movement('mv-c', stamp),
      movement('mv-b', stamp),
      movement('mv-a', stamp),
    ]);

    await service.findAllLedgerMovements({ page: 1, limit: 10 }, ctx);

    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ movementDate: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('ILH-P02 paginates same-timestamp rows without duplicates or gaps and stays stable', async () => {
    const stamp = new Date('2026-11-13T12:00:00.000Z');
    useMovements([
      movement('mv-d', stamp),
      movement('mv-c', stamp),
      movement('mv-b', stamp),
      movement('mv-a', stamp),
    ]);

    const page1 = await service.findAllLedgerMovements({ page: 1, limit: 2 }, ctx);
    const page2 = await service.findAllLedgerMovements({ page: 2, limit: 2 }, ctx);
    const page1Again = await service.findAllLedgerMovements({ page: 1, limit: 2 }, ctx);

    expect(page1.data.map((row: any) => row.id)).toEqual(['mv-d', 'mv-c']);
    expect(page2.data.map((row: any) => row.id)).toEqual(['mv-b', 'mv-a']);
    const combined = [...page1.data, ...page2.data].map((row: any) => row.id);
    expect(new Set(combined).size).toBe(4);
    expect(page1Again.data.map((row: any) => row.id)).toEqual(['mv-d', 'mv-c']);
  });

  it('ILH-P05 includes late same-day movements for a date-only dateTo', async () => {
    const rows = [
      movement('next-day', new Date('2026-11-14T00:00:00.000Z')),
      movement('late', new Date('2026-11-13T23:59:59.999Z')),
      movement('midday', new Date('2026-11-13T12:00:00.000Z')),
      movement('early', new Date('2026-11-13T00:00:00.000Z')),
    ];
    useMovements(rows);

    const result = await service.findAllLedgerMovements(
      { dateTo: '2026-11-13', page: 1, limit: 10 },
      ctx,
    );

    expect(result.data.map((row: any) => row.id)).toEqual(['late', 'midday', 'early']);
    const where = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
    expect(where.movementDate).toEqual({
      lt: new Date('2026-11-14T00:00:00.000Z'),
    });
  });

  it('ILH-P06 excludes the next-day midnight movement for a date-only dateTo', async () => {
    const rows = [
      movement('next-day', new Date('2026-11-14T00:00:00.000Z')),
      movement('late', new Date('2026-11-13T23:59:59.999Z')),
    ];
    useMovements(rows);

    const result = await service.findAllLedgerMovements(
      { dateTo: '2026-11-13', page: 1, limit: 10 },
      ctx,
    );

    expect(result.data.map((row: any) => row.id)).toEqual(['late']);
  });

  it('ILH-P09 keeps dateFrom as an inclusive start-of-day lower bound', async () => {
    const rows = [
      movement('late', new Date('2026-11-13T23:59:59.999Z')),
      movement('early', new Date('2026-11-13T00:00:00.000Z')),
      movement('before', new Date('2026-11-12T23:59:59.999Z')),
    ];
    useMovements(rows);

    const result = await service.findAllLedgerMovements(
      { dateFrom: '2026-11-13', page: 1, limit: 10 },
      ctx,
    );

    expect(result.data.map((row: any) => row.id)).toEqual(['late', 'early']);
    expect(prisma.inventoryMovement.findMany.mock.calls[0][0].where.movementDate).toEqual({
      gte: new Date('2026-11-13T00:00:00.000Z'),
    });
  });

  it('ILH-P10 supports the same date for dateFrom and dateTo', async () => {
    const rows = [
      movement('next-day', new Date('2026-11-14T00:00:00.000Z')),
      movement('late', new Date('2026-11-13T23:00:00.000Z')),
    ];
    useMovements(rows);

    const result = await service.findAllLedgerMovements(
      { dateFrom: '2026-11-13', dateTo: '2026-11-13', page: 1, limit: 10 },
      ctx,
    );

    expect(result.data.map((row: any) => row.id)).toEqual(['late']);
    expect(prisma.inventoryMovement.findMany.mock.calls[0][0].where.movementDate).toEqual({
      gte: new Date('2026-11-13T00:00:00.000Z'),
      lt: new Date('2026-11-14T00:00:00.000Z'),
    });
  });

  it('rejects invalid date values and inverted ranges without querying', async () => {
    await expect(
      service.findAllLedgerMovements({ dateTo: 'not-a-date' }, ctx),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.findAllLedgerMovements({ dateFrom: '2026-02-31' }, ctx),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.findAllLedgerMovements(
        { dateFrom: '2026-11-14', dateTo: '2026-11-13' },
        ctx,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
  });

  it('ILH-P11 preserves company scope from the active operational context', async () => {
    useMovements([]);

    await service.findAllLedgerMovements({ page: 1, limit: 10 }, ctx);

    const where = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining({ companyId: 'c1', deletedAt: null }));
    expect(where.warehouse).toEqual(warehouseScope);
  });

  it('ILH-P12 preserves branch scope from the active operational context', async () => {
    useMovements([]);

    await service.findAllLedgerMovements({ page: 1, limit: 10 }, ctx);

    const where = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([branchScope]);
    expect(where).not.toHaveProperty('branchId');
  });

  it('ILH-P13 validates a requested warehouse inside the active context before filtering', async () => {
    useMovements([]);

    await service.findAllLedgerMovements({ warehouseId: 'wh1' }, ctx);

    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
      where: { id: 'wh1', ...warehouseScope },
      select: { id: true },
    });
    const where = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
    expect(where.warehouseId).toBe('wh1');
  });

  it('rejects a warehouse that is outside the active context', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.findAllLedgerMovements({ warehouseId: 'foreign' }, ctx),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
  });

  it('keeps the ledger payload shape intact', async () => {
    useMovements([movement('mv-1', new Date('2026-11-13T10:00:00.000Z'))]);

    const result = await service.findAllLedgerMovements({ page: 1, limit: 20 }, ctx);

    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.data[0]).toEqual(expect.objectContaining({ id: 'mv-1', movementNumber: 'IM-mv-1' }));
  });
});
