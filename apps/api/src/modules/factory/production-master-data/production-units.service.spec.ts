import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionUnitsService } from './production-units.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctxA: ActiveOperationalContext = {
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

const ctxB: ActiveOperationalContext = {
  ...ctxA,
  contextKey: 'c2:b2:-:-',
  companyId: 'c2',
  companyName: 'Company B',
  branchId: 'b2',
  branchName: 'HQ2',
};

const unit = (overrides: Record<string, any> = {}) => ({
  id: 'u1',
  code: 'KG',
  name: 'Kilogram',
  abbreviation: 'kg',
  description: null,
  decimals: 2,
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionUnitsService', () => {
  let prisma: any;
  let audit: any;
  let service: ProductionUnitsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      productionUnit: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      productionProductDefinition: { count: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ProductionUnitsService(prisma, audit);
  });

  describe('create', () => {
    it('creates a unit scoped to the active tenant and ignores client-provided tenant ids', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionUnit.findFirst.mockResolvedValue(null);
      prisma.productionUnit.create.mockImplementation(({ data }: any) => Promise.resolve(unit(data)));

      await service.create(
        { code: 'TON', name: 'Tonne', abbreviation: 't', description: '', decimals: 3 },
        'u1',
        ctxA,
      );

      expect(prisma.productionUnit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionUnit', 'u1', expect.anything());
    });

    it('rejects a duplicate code within the same tenant', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionUnit.findFirst.mockResolvedValue(unit());

      await expect(
        service.create({ code: 'KG', name: 'Kilogram' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows the same code in a different company (tenant scoped uniqueness)', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c2' });
      prisma.productionUnit.findFirst.mockResolvedValue(null);
      prisma.productionUnit.create.mockImplementation(({ data }: any) => Promise.resolve(unit(data)));

      await service.create({ code: 'KG', name: 'Kilogram' }, 'u1', ctxB);

      expect(prisma.productionUnit.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }) }),
      );
      expect(prisma.productionUnit.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns a unit owned by the tenant', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(unit());
      prisma.productionUnit.findUnique.mockResolvedValue(unit());

      const result = await service.findOne('u1', ctxA);
      expect(result?.id).toBe('u1');
    });

    it('does not leak a unit from another company (404)', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(null);

      await expect(service.findOne('u1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not return soft-deleted units', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(null);

      await expect(service.findOne('u1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects a code change that collides with another unit in the tenant', async () => {
      prisma.productionUnit.findFirst
        .mockResolvedValueOnce(unit()) // findOwned
        .mockResolvedValueOnce(unit({ id: 'u2', code: 'TON' })); // duplicate check

      await expect(
        service.update('u1', { code: 'TON' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('keeps existing values when only partial data is provided', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(unit());
      prisma.productionUnit.update.mockImplementation(({ data }: any) =>
        Promise.resolve(unit({ name: data.name ?? 'Kilogram' })),
      );

      const result = await service.update('u1', { abbreviation: 'k' }, 'u1', ctxA);
      expect(result.name).toBe('Kilogram');
      expect(prisma.productionUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ abbreviation: 'k' }) }),
      );
    });
  });

  describe('remove', () => {
    it('soft deletes the unit and audits the deletion', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(unit());
      prisma.productionProductDefinition.count.mockResolvedValue(0);
      prisma.productionUnit.update.mockImplementation(({ data }: any) => Promise.resolve(unit(data)));

      await service.remove('u1', 'u1', ctxA);

      expect(prisma.productionUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionUnit', 'u1');
    });

    it('blocks deletion when the unit is referenced by product definitions', async () => {
      prisma.productionUnit.findFirst.mockResolvedValue(unit());
      prisma.productionProductDefinition.count.mockResolvedValue(3);

      await expect(service.remove('u1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.productionUnit.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes the list query to the tenant and does not include deleted units', async () => {
      prisma.productionUnit.findMany.mockResolvedValue([unit()]);
      prisma.productionUnit.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.productionUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });
});
