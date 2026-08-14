import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryCountsService } from './inventory-counts.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'company-a:branch-a:-:-',
  scopeId: 'scope-a',
  companyId: 'company-a',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'branch-a',
  branchName: 'Branch A',
  branchCode: 'BA',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const warehouse = (overrides: Record<string, unknown> = {}) => ({
  id: 'warehouse-a',
  companyId: 'company-a',
  branchId: 'branch-a',
  deletedAt: null,
  ...overrides,
});

const countDocument = (overrides: Record<string, unknown> = {}) => ({
  id: 'count-a',
  countNumber: 'IC-0001',
  companyId: 'company-a',
  branchId: 'branch-a',
  warehouseId: 'warehouse-a',
  status: 'DRAFT',
  deletedAt: null,
  lines: [],
  ...overrides,
});

describe('InventoryCountsService tenant isolation', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: InventoryCountsService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      inventoryCount: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      inventoryCountLine: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(
        async (operation: (tx: any) => Promise<unknown>) =>
          operation(prisma),
      ),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomicWithClient: jest
        .fn()
        .mockResolvedValue('IC-0001'),
    };
    service = new InventoryCountsService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
    );
  });

  it('creates from active context, ignores hostile DTO tenant fields, and revalidates in the transaction', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(
      warehouse({ branchId: null }),
    );
    prisma.inventoryCount.create.mockImplementation(
      async ({ data }: any) => countDocument(data),
    );

    const result = await service.create(
      {
        companyId: 'company-foreign',
        branchId: 'branch-foreign',
        warehouseId: 'warehouse-a',
        notes: 'Cycle count',
      },
      'user-a',
      ctx,
    );

    expect(prisma.warehouse.findUnique).toHaveBeenCalledTimes(2);
    expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith(
      'INVENTORY_COUNT',
      prisma,
    );
    expect(prisma.inventoryCount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-a',
        branchId: 'branch-a',
        warehouseId: 'warehouse-a',
        createdById: 'user-a',
      }),
    });
    expect(result.companyId).toBe('company-a');
    expect(result.branchId).toBe('branch-a');
  });

  it('rejects a foreign-company warehouse before numbering or creating', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(
      warehouse({ companyId: 'company-b' }),
    );

    await expect(
      service.create(
        {
          companyId: 'company-a',
          branchId: 'branch-a',
          warehouseId: 'warehouse-b',
        },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
    expect(prisma.inventoryCount.create).not.toHaveBeenCalled();
  });

  it('rejects a same-company warehouse assigned to another branch', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(
      warehouse({ branchId: 'branch-b' }),
    );

    await expect(
      service.create(
        {
          companyId: 'company-a',
          branchId: 'branch-a',
          warehouseId: 'warehouse-b',
        },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ignores hostile list tenant filters and always scopes documents to the exact active branch', async () => {
    await service.findAll(
      {
        companyId: 'company-b',
        branchId: 'branch-b',
        search: 'IC',
      } as any,
      ctx,
    );

    const where = prisma.inventoryCount.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      companyId: 'company-a',
      branchId: 'branch-a',
      deletedAt: null,
      warehouse: {
        companyId: 'company-a',
        deletedAt: null,
      },
    });
    expect(where.warehouse.AND).toEqual([
      {
        OR: [{ branchId: null }, { branchId: 'branch-a' }],
      },
    ]);
    expect(JSON.stringify(where)).not.toContain('company-b');
    expect(JSON.stringify(where)).not.toContain('branch-b');
  });

  it('uses a tenant-and-branch-scoped by-id predicate and returns not found for an inaccessible id', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(null);

    await expect(service.findOne('count-b', ctx)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inventoryCount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'count-b',
          companyId: 'company-a',
          branchId: 'branch-a',
          deletedAt: null,
          warehouse: expect.objectContaining({
            companyId: 'company-a',
          }),
        }),
      }),
    );
  });

  it('does not mutate a foreign by-id document during a state transition', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(null);

    await expect(
      service.start('count-b', 'user-a', ctx),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryCount.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects warehouse re-pointing to another branch with zero update side effects', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(countDocument());
    prisma.warehouse.findUnique.mockResolvedValue(
      warehouse({ id: 'warehouse-b', branchId: 'branch-b' }),
    );

    await expect(
      service.update(
        'count-a',
        { warehouseId: 'warehouse-b' },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.inventoryCount.update).not.toHaveBeenCalled();
  });

  it('rejects warehouse re-pointing after lines exist so locations and system quantities cannot become stale', async () => {
    prisma.inventoryCount.findFirst.mockResolvedValue(countDocument());
    prisma.warehouse.findUnique.mockResolvedValue(
      warehouse({ id: 'warehouse-a2', branchId: null }),
    );
    prisma.inventoryCountLine.findFirst.mockResolvedValue({ id: 'line-a' });

    await expect(
      service.update(
        'count-a',
        { warehouseId: 'warehouse-a2' },
        'user-a',
        ctx,
      ),
    ).rejects.toThrow(
      'Cannot change the inventory count warehouse after count lines exist',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.inventoryCount.update).not.toHaveBeenCalled();
  });
});
