import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionProductDefinitionsService } from './production-product-definitions.service';
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

const definition = (overrides: Record<string, any> = {}) => ({
  id: 'd1',
  code: 'PP-000001',
  name: 'Soda Bottle',
  description: null,
  productId: 'prd1',
  defaultUnitId: null,
  defaultLineId: null,
  defaultWarehouseId: null,
  defaultCostCenterId: null,
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  createdById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionProductDefinitionsService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionProductDefinitionsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      productionUnit: { findFirst: jest.fn() },
      productionLine: { findFirst: jest.fn() },
      warehouse: { findUnique: jest.fn() },
      costCenter: { findUnique: jest.fn() },
      machine: { findUnique: jest.fn() },
      productionProductDefinition: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      productionSpecification: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      productionVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      productionPackaging: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      productionEligibility: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PP-000042') };
    service = new ProductionProductDefinitionsService(prisma, audit, numbering);
  });

  describe('create', () => {
    it('auto-generates the code and defaults the name from the product when not provided', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Soda Bottle', code: 'SODA', status: 'ACTIVE' });
      prisma.productionProductDefinition.findFirst.mockResolvedValue(null);
      prisma.productionProductDefinition.create.mockImplementation(({ data }: any) => Promise.resolve(definition(data)));

      const result = await service.create({ productId: 'prd1' }, 'u1', ctxA);

      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('PRODUCTION_PRODUCT');
      expect(prisma.productionProductDefinition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'PP-000042', name: 'Soda Bottle', companyId: 'c1', branchId: 'b1' }),
        }),
      );
      expect(result.code).toBe('PP-000042');
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionProductDefinition', 'd1', expect.anything());
    });

    it('rejects an inactive product', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'X', code: 'X', status: 'INACTIVE' });

      await expect(service.create({ productId: 'prd1' }, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a default unit that belongs to another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'X', code: 'X', status: 'ACTIVE' });
      prisma.productionUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ productId: 'prd1', defaultUnitId: 'other-company-unit' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productionProductDefinition.create).not.toHaveBeenCalled();
    });

    it('rejects a warehouse from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'X', code: 'X', status: 'ACTIVE' });
      prisma.productionUnit.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w2', companyId: 'c2', branchId: 'b2' });

      await expect(
        service.create({ productId: 'prd1', defaultWarehouseId: 'w2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a cost center from another branch', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'X', code: 'X', status: 'ACTIVE' });
      prisma.productionUnit.findFirst.mockResolvedValue(null);
      prisma.costCenter.findUnique.mockResolvedValue({ id: 'cc2', companyId: 'c1', branchId: 'b9' });

      await expect(
        service.create({ productId: 'prd1', defaultCostCenterId: 'cc2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('does not leak a definition from another company (404)', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(null);

      await expect(service.findOne('d1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the definition with children for an owned record', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.productionProductDefinition.findUnique.mockResolvedValue(definition({ specifications: [], versions: [], packagings: [], eligibilities: [] }));

      const result = await service.findOne('d1', ctxA);
      expect(result?.id).toBe('d1');
    });
  });

  describe('eligibility children', () => {
    it('rejects a MACHINE eligibility that carries a productionLineId', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());

      await expect(
        service.addEligibility('d1', { resourceType: 'MACHINE', machineId: 'm1', productionLineId: 'l1' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a MACHINE eligibility whose machine belongs to another company', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.machine.findUnique.mockResolvedValue({ id: 'm2', companyId: 'c2', branchId: null });

      await expect(
        service.addEligibility('d1', { resourceType: 'MACHINE', machineId: 'm2' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a LINE eligibility whose line is outside the tenant', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.productionLine.findFirst.mockResolvedValue(null);

      await expect(
        service.addEligibility('d1', { resourceType: 'LINE', productionLineId: 'l9' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a valid MACHINE eligibility and audits it', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.productionEligibility.findFirst.mockResolvedValue(null);
      prisma.productionEligibility.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'e1', ...data, machine: { id: 'm1' }, productionLine: null }),
      );

      const result = await service.addEligibility('d1', { resourceType: 'MACHINE', machineId: 'm1', priority: 1 }, 'u1', ctxA);

      expect(result.id).toBe('e1');
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionEligibility', 'e1', expect.anything());
    });
  });

  describe('version children', () => {
    it('auto-computes versionNumber as max + 1 and blocks duplicates', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.productionVersion.findFirst.mockResolvedValue({ versionNumber: 2 });

      const dupError = await service
        .addVersion('d1', { versionNumber: 2, versionLabel: 'V2' }, 'u1', ctxA)
        .catch((e: any) => e);
      expect(dupError).toBeInstanceOf(BadRequestException);

      prisma.productionVersion.findFirst
        .mockResolvedValueOnce({ versionNumber: 2 })
        .mockResolvedValueOnce(null);
      prisma.productionVersion.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'v3', ...data }));

      const result = await service.addVersion('d1', { versionLabel: 'V3' }, 'u1', ctxA);
      expect(result.versionNumber).toBe(3);
    });

    it('blocks deletion of the current version', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.productionVersion.findFirst.mockResolvedValue({ id: 'v1', productionProductId: 'd1', isCurrent: true });

      await expect(service.removeVersion('d1', 'v1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('packaging children', () => {
    it('rejects a packQuantity of zero or less', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());

      await expect(
        service.addPackaging('d1', { packagingType: 'BOX', packQuantity: 0 }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deactivates all children and soft deletes the definition in one transaction', async () => {
      prisma.productionProductDefinition.findFirst.mockResolvedValue(definition());
      prisma.productionProductDefinition.update.mockResolvedValue(definition({ deletedAt: new Date() }));

      await service.remove('d1', 'u1', ctxA);

      expect(prisma.productionSpecification.updateMany).toHaveBeenCalledWith({
        where: { productionProductId: 'd1' },
        data: { status: 'INACTIVE' },
      });
      expect(prisma.productionVersion.updateMany).toHaveBeenCalled();
      expect(prisma.productionPackaging.updateMany).toHaveBeenCalled();
      expect(prisma.productionEligibility.updateMany).toHaveBeenCalled();
      expect(prisma.productionProductDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionProductDefinition', 'd1');
    });
  });
});
