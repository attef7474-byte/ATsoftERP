import { BadRequestException } from '@nestjs/common';
import { InventoryReportsService } from './inventory-reports.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

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

const operationalScope = {
  companyId: ctx.companyId,
  deletedAt: null,
  OR: [{ branchId: ctx.branchId }, { branchId: null }],
};

const movement = (id: string, movementDate: Date) => ({
  id,
  movementNumber: `IM-${id}`,
  movementDate,
  status: 'POSTED',
});

function inRange(row: any, range: any): boolean {
  if (!range) return true;
  const time = row.movementDate.getTime();
  if (range.gte && time < range.gte.getTime()) return false;
  if (range.lt && time >= range.lt.getTime()) return false;
  if (range.lte && time > range.lte.getTime()) return false;
  return true;
}

describe('InventoryReportsService — inventory movements report hardening', () => {
  let prisma: any;
  let service: InventoryReportsService;

  beforeEach(() => {
    prisma = {
      inventoryMovement: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryMovementLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      },
    };
    service = new InventoryReportsService(prisma);
  });

  const useMovements = (rows: any[]) => {
    prisma.inventoryMovement.findMany.mockImplementation(
      async ({ skip = 0, take = 20, where }: any) =>
        rows.filter((row) => inRange(row, where?.movementDate)).slice(skip, skip + take),
    );
    prisma.inventoryMovement.count.mockImplementation(
      async ({ where }: any) =>
        rows.filter((row) => inRange(row, where?.movementDate)).length,
    );
  };

  it('ILH-P03 orders same-timestamp movements deterministically', async () => {
    const stamp = new Date('2026-11-13T12:00:00.000Z');
    useMovements([
      movement('mv-d', stamp),
      movement('mv-c', stamp),
      movement('mv-b', stamp),
      movement('mv-a', stamp),
    ]);

    await service.getInventoryMovementsReport({ page: 1, pageSize: 10 } as any, ctx);

    expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ movementDate: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('ILH-P04 paginates same-timestamp rows without duplicates or gaps', async () => {
    const stamp = new Date('2026-11-13T12:00:00.000Z');
    useMovements([
      movement('mv-d', stamp),
      movement('mv-c', stamp),
      movement('mv-b', stamp),
      movement('mv-a', stamp),
    ]);

    const page1 = await service.getInventoryMovementsReport({ page: 1, pageSize: 2 } as any, ctx);
    const page2 = await service.getInventoryMovementsReport({ page: 2, pageSize: 2 } as any, ctx);
    const page1Again = await service.getInventoryMovementsReport({ page: 1, pageSize: 2 } as any, ctx);

    expect(page1.rows.map((row: any) => row.id)).toEqual(['mv-d', 'mv-c']);
    expect(page2.rows.map((row: any) => row.id)).toEqual(['mv-b', 'mv-a']);
    const combined = [...page1.rows, ...page2.rows].map((row: any) => row.id);
    expect(new Set(combined).size).toBe(4);
    expect(page1Again.rows.map((row: any) => row.id)).toEqual(['mv-d', 'mv-c']);
  });

  it('ILH-P07 includes late same-day movements for a date-only dateTo', async () => {
    useMovements([
      movement('next-day', new Date('2026-11-14T00:00:00.000Z')),
      movement('late', new Date('2026-11-13T23:59:59.999Z')),
      movement('midday', new Date('2026-11-13T12:00:00.000Z')),
      movement('early', new Date('2026-11-13T00:00:00.000Z')),
    ]);

    const result = await service.getInventoryMovementsReport(
      { dateTo: '2026-11-13', page: 1, pageSize: 10 } as any,
      ctx,
    );

    expect(result.rows.map((row: any) => row.id)).toEqual(['late', 'midday', 'early']);
    expect(prisma.inventoryMovement.findMany.mock.calls[0][0].where.movementDate).toEqual({
      lt: new Date('2026-11-14T00:00:00.000Z'),
    });
  });

  it('ILH-P08 excludes the next-day midnight movement for a date-only dateTo', async () => {
    useMovements([
      movement('next-day', new Date('2026-11-14T00:00:00.000Z')),
      movement('late', new Date('2026-11-13T23:59:59.999Z')),
    ]);

    const result = await service.getInventoryMovementsReport(
      { dateTo: '2026-11-13', page: 1, pageSize: 10 } as any,
      ctx,
    );

    expect(result.rows.map((row: any) => row.id)).toEqual(['late']);
  });

  it('ILH-P11/P12 keeps company and branch scope from the active context', async () => {
    useMovements([]);

    await service.getInventoryMovementsReport({ page: 1, pageSize: 10 } as any, ctx);

    const where = prisma.inventoryMovement.findMany.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining(operationalScope));
    expect(where).not.toHaveProperty('branchId');
  });

  it('rejects invalid dates and inverted ranges without querying', async () => {
    await expect(
      service.getInventoryMovementsReport({ dateTo: 'not-a-date' } as any, ctx),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getInventoryMovementsReport(
        { dateFrom: '2026-11-14', dateTo: '2026-11-13' } as any,
        ctx,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
  });

  it('keeps the report payload shape and status filter parameter intact', async () => {
    useMovements([]);

    const result = await service.getInventoryMovementsReport(
      { status: 'POSTED', page: 1, pageSize: 20 } as any,
      ctx,
    );

    expect(prisma.inventoryMovement.findMany.mock.calls[0][0].where.status).toBe('POSTED');
    expect(result).toEqual(
      expect.objectContaining({ total: 0, page: 1, pageSize: 20, totalPages: 0 }),
    );
    expect(result.cards.map((card: any) => card.label)).toEqual([
      'totalMovements',
      'postedMovements',
      'draftMovements',
      'cancelledMovements',
      'totalMovedQty',
    ]);
  });
});
