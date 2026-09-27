import { ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
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

describe('InventoryService updateLocation tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryBalance: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('LOC-0001') };
    service = new InventoryService(prisma as unknown as PrismaService, numbering as unknown as NumberingService);
  });

  it('rejects re-pointing a location to a foreign-company warehouse', async () => {
    prisma.warehouseLocation.findUnique.mockResolvedValue({
      id: 'loc1',
      warehouseId: 'w1',
      code: 'L1',
      name: 'Loc 1',
      status: 'ACTIVE',
    });
    prisma.warehouse.findUnique
      .mockResolvedValueOnce({ id: 'w1', companyId: 'c1', branchId: 'b1' })
      .mockResolvedValueOnce({ id: 'w-foreign', companyId: 'c2', branchId: 'b9' });

    await expect(
      service.updateLocation('loc1', { warehouseId: 'w-foreign' } as any, ctx),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.warehouseLocation.update).not.toHaveBeenCalled();
  });

  it('allows re-pointing to a same-company warehouse', async () => {
    prisma.warehouseLocation.findUnique.mockResolvedValue({
      id: 'loc1',
      warehouseId: 'w1',
      code: 'L1',
      name: 'Loc 1',
      status: 'ACTIVE',
    });
    prisma.warehouse.findUnique
      .mockResolvedValueOnce({ id: 'w1', companyId: 'c1', branchId: 'b1' })
      .mockResolvedValueOnce({ id: 'w2', companyId: 'c1', branchId: 'b1' });
    prisma.warehouseLocation.update.mockResolvedValue({ id: 'loc1', warehouseId: 'w2' });

    const result = await service.updateLocation('loc1', { warehouseId: 'w2' } as any, ctx);
    expect(result.warehouseId).toBe('w2');
  });

  it('scopes the warehouse list to the active company and branch, ignoring client companyId', async () => {
    prisma.warehouse.findMany = jest.fn().mockResolvedValue([]);
    prisma.warehouse.count = jest.fn().mockResolvedValue(0);

    await service.findAllWarehouses({ companyId: 'c2', search: 'saw', warehouseType: 'SPARE_PARTS' } as any, ctx);

    expect(prisma.warehouse.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.warehouse.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      deletedAt: null,
      companyId: 'c1',
      // company/branch scope must survive the search predicate
      OR: [{ branchId: 'b1' }, { branchId: null }],
      AND: [{ OR: [{ code: { contains: 'saw' } }, { name: { contains: 'saw' } }] }],
      warehouseType: 'SPARE_PARTS',
    });
    expect(where.companyId).not.toBe('c2');
  });

  it('scopes the location list to active-company warehouses', async () => {
    prisma.warehouseLocation.findMany = jest.fn().mockResolvedValue([]);
    prisma.warehouseLocation.count = jest.fn().mockResolvedValue(0);

    await service.findAllLocations({} as any, ctx);

    expect(prisma.warehouseLocation.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.warehouseLocation.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      warehouse: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
    });
  });

  it('rejects a location list scoped to a foreign-company warehouse', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({ id: 'w-foreign', companyId: 'c2', branchId: 'b9' });

    await expect(
      service.findAllLocations({ warehouseId: 'w-foreign' } as any, ctx),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.warehouseLocation.findMany).not.toHaveBeenCalled();
  });
});

/**
 * R2-F pre-work: the shared warehouse F9 lookup (warehouseAdapter) advertises
 * searchFields ['code', 'name'], but the list endpoint searched `name` only, so
 * typing a warehouse code produced "No records found".
 *
 * These cases are behavioural, not just structural: the composed Prisma `where`
 * clause is evaluated against a fixture warehouse set, which proves that a code
 * search matches, that a name search still matches, and — most importantly — that
 * the company/branch scope and the warehouse-type filter still hold.
 */
describe('InventoryService findAllWarehouses search by code and name', () => {
  let prisma: any;
  let numbering: any;
  let service: InventoryService;

  // Fixture set: an in-scope spare-part warehouse whose code differs from its
  // (Arabic) name, an in-scope differently typed warehouse, an out-of-branch
  // warehouse, a foreign-company warehouse and a soft-deleted warehouse.
  const fixtures = [
    { id: 'w-spare', code: 'WH-000001', name: 'مخزن قطع الغيار', warehouseType: 'SPARE_PART', companyId: 'c1', branchId: 'b1', deletedAt: null },
    { id: 'w-other', code: 'WH-000002', name: 'Main Warehouse', warehouseType: null, companyId: 'c1', branchId: 'b1', deletedAt: null },
    { id: 'w-global', code: 'WH-000003', name: 'Company Wide Warehouse', warehouseType: null, companyId: 'c1', branchId: null, deletedAt: null },
    { id: 'w-foreign', code: 'WH-900001', name: 'Foreign Warehouse', warehouseType: 'SPARE_PART', companyId: 'c2', branchId: 'b1', deletedAt: null },
    { id: 'w-otherbranch', code: 'WH-800001', name: 'Other Branch Warehouse', warehouseType: null, companyId: 'c1', branchId: 'b9', deletedAt: null },
    { id: 'w-deleted', code: 'WH-000001', name: 'مخزن قطع الغيار', warehouseType: 'SPARE_PART', companyId: 'c1', branchId: 'b1', deletedAt: new Date() },
  ];

  /** Minimal evaluator for the subset of Prisma operators this query uses. */
  const matches = (row: any, where: any): boolean => {
    if (where.deletedAt === null && row.deletedAt !== null) return false;
    if (where.companyId !== undefined && row.companyId !== where.companyId) return false;
    if (where.warehouseType !== undefined && row.warehouseType !== where.warehouseType) return false;
    if (where.OR) {
      const ok = where.OR.some((c: any) => matches(row, c));
      if (!ok) return false;
    }
    if (where.AND) {
      const ok = where.AND.every((c: any) => matches(row, c));
      if (!ok) return false;
    }
    if (where.code?.contains !== undefined && !String(row.code).includes(where.code.contains)) return false;
    if (where.name?.contains !== undefined && !String(row.name).includes(where.name.contains)) return false;
    if (where.branchId !== undefined && row.branchId !== where.branchId) return false;
    return true;
  };

  /** Runs the service and returns the fixture rows its `where` clause selects. */
  const select = async (query: any) => {
    let captured: any;
    prisma.warehouse.findMany.mockImplementation((args: any) => {
      captured = args.where;
      return Promise.resolve(fixtures.filter((r) => matches(r, args.where)));
    });
    prisma.warehouse.count.mockImplementation((args: any) => Promise.resolve(fixtures.filter((r) => matches(r, args.where)).length));
    const res = await service.findAllWarehouses(query, ctx);
    return { where: captured, ids: res.data.map((r: any) => r.id) };
  };

  beforeEach(() => {
    prisma = {
      warehouse: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn() };
    service = new InventoryService(prisma as unknown as PrismaService, numbering as unknown as NumberingService);
  });

  it('1. search by exact warehouse code matches, even when the name does not contain it', async () => {
    const { ids, where } = await select({ search: 'WH-000001' });
    expect(ids).toContain('w-spare');
    // the code predicate is present, and the name is not the only match path
    expect(JSON.stringify(where.AND)).toContain('"code"');
    expect(JSON.stringify(where.AND)).toContain('"name"');
    // the deleted twin is never selectable
    expect(ids).not.toContain('w-deleted');
  });

  it('2. search by partial warehouse code matches', async () => {
    const { ids } = await select({ search: 'WH-00000' });
    expect(ids).toEqual(expect.arrayContaining(['w-spare', 'w-other', 'w-global']));
  });

  it('3. search by name still matches', async () => {
    const { ids } = await select({ search: 'Main Warehouse' });
    expect(ids).toContain('w-other');
  });

  it('4. a foreign-company or other-branch warehouse is still excluded when searching by its own code', async () => {
    const foreign = await select({ search: 'WH-900001' });
    expect(foreign.ids).not.toContain('w-foreign');
    const otherBranch = await select({ search: 'WH-800001' });
    expect(otherBranch.ids).not.toContain('w-otherbranch');
    // and the scope is still expressed, not merely absent from the fixtures
    expect(foreign.where.companyId).toBe('c1');
    expect(foreign.where.OR).toEqual([{ branchId: 'b1' }, { branchId: null }]);
  });

  it('5. the warehouseType filter is still respected together with a code search', async () => {
    const { ids, where } = await select({ search: 'WH-000001', warehouseType: 'SPARE_PART' });
    expect(ids).toContain('w-spare');
    expect(ids).not.toContain('w-other');
    expect(where.warehouseType).toBe('SPARE_PART');
  });

  it('6. behaviour without a search term is unchanged', async () => {
    const { ids, where } = await select({});
    expect(where).toEqual({ deletedAt: null, companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] });
    expect(where.AND).toBeUndefined();
    expect(where.name).toBeUndefined();
    expect(ids).toEqual(expect.arrayContaining(['w-spare', 'w-other', 'w-global']));
    expect(ids).not.toContain('w-foreign');
    expect(ids).not.toContain('w-otherbranch');
    expect(ids).not.toContain('w-deleted');
  });
});
