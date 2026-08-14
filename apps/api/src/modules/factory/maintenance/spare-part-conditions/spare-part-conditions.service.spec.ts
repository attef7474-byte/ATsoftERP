import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SparePartConditionService } from './spare-part-conditions.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

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

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  name: 'Warehouse 1',
  code: 'WH1',
  warehouseType: 'SPARE_PARTS',
  ...overrides,
});

const balance = (overrides: Record<string, any> = {}) => ({
  id: 'b1',
  sparePartId: 'sp1',
  productId: 'prod1',
  warehouseId: 'wh1',
  condition: 'NEW',
  quantity: 10,
  availableQuantity: 10,
  ...overrides,
});

describe('SparePartConditionService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: SparePartConditionService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      maintenanceRequest: { findUnique: jest.fn() },
      inventoryMovement: { findUnique: jest.fn() },
      sparePartConditionBalance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sparePartConditionMovement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      sparePart: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('SCM-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('SCM-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new SparePartConditionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      numbering as unknown as NumberingService,
    );
  });

  describe('recordMovement', () => {
    it('rejects a foreign-company warehouse with no balance or movement side effects', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'wh-foreign', companyId: 'c2' }));

      await expect(
        service.recordMovement(
          {
            sparePartId: 'sp1',
            productId: 'prod1',
            warehouseId: 'wh-foreign',
            condition: 'NEW',
            direction: 'IN',
            quantity: 5,
          } as any,
          'u1',
          ctx,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.sparePartConditionBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a maintenance request whose machine belongs to another company', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.maintenanceRequest.findUnique.mockResolvedValue({
        id: 'req-foreign',
        machine: { id: 'm-foreign', companyId: 'c2', branchId: 'b1' },
      });

      await expect(
        service.recordMovement(
          {
            sparePartId: 'sp1',
            productId: 'prod1',
            warehouseId: 'wh1',
            condition: 'NEW',
            direction: 'IN',
            quantity: 5,
            maintenanceRequestId: 'req-foreign',
          } as any,
          'u1',
          ctx,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.sparePartConditionBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a maintenance request that does not exist', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.recordMovement(
          {
            sparePartId: 'sp1',
            productId: 'prod1',
            warehouseId: 'wh1',
            condition: 'NEW',
            direction: 'IN',
            quantity: 5,
            maintenanceRequestId: 'req-nope',
          } as any,
          'u1',
          ctx,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.sparePartConditionBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionMovement.create).not.toHaveBeenCalled();
    });

    it('rejects an inventory movement reference from another company', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.findUnique.mockResolvedValue({
        id: 'mov-foreign',
        companyId: 'c2',
      });

      await expect(
        service.recordMovement(
          {
            sparePartId: 'sp1',
            productId: 'prod1',
            warehouseId: 'wh1',
            condition: 'NEW',
            direction: 'IN',
            quantity: 5,
            inventoryMovementId: 'mov-foreign',
          } as any,
          'u1',
          ctx,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.sparePartConditionBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionMovement.create).not.toHaveBeenCalled();
    });

    it('allows an in-context movement and updates balance atomically', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.sparePartConditionBalance.findFirst.mockResolvedValue(balance());
      prisma.sparePartConditionBalance.update.mockResolvedValue(balance());
      prisma.sparePartConditionMovement.create.mockResolvedValue({ id: 'scm1' });

      const result = await service.recordMovement(
        {
          sparePartId: 'sp1',
          productId: 'prod1',
          warehouseId: 'wh1',
          condition: 'NEW',
          direction: 'OUT',
          quantity: 5,
        } as any,
        'u1',
        ctx,
      );

      expect(result).toEqual({ id: 'scm1' });
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('SPARE_PART_CONDITION_MOVEMENT', prisma);
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 5, availableQuantity: 5 }) }),
      );
      expect(prisma.sparePartConditionMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warehouseId: 'wh1',
            condition: 'NEW',
            direction: 'OUT',
            quantity: 5,
            createdByUserId: 'u1',
          }),
        }),
      );
    });
  });

  describe('getBalanceById', () => {
    it('rejects a balance whose warehouse belongs to another company', async () => {
      prisma.sparePartConditionBalance.findUnique.mockResolvedValue(
        balance({ warehouse: warehouse({ id: 'wh-foreign', companyId: 'c2' }) }),
      );

      await expect(service.getBalanceById('b1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the balance does not exist', async () => {
      prisma.sparePartConditionBalance.findUnique.mockResolvedValue(null);

      await expect(service.getBalanceById('nope', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBalancesByWarehouse', () => {
    it('rejects a foreign-company warehouse before listing balances', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'wh-foreign', companyId: 'c2' }));

      await expect(service.getBalancesByWarehouse('wh-foreign', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.sparePartConditionBalance.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getMovementById', () => {
    it('rejects a movement whose warehouse belongs to another company', async () => {
      prisma.sparePartConditionMovement.findUnique.mockResolvedValue(
        {
          id: 'scm1',
          warehouse: warehouse({ id: 'wh-foreign', companyId: 'c2' }),
        },
      );

      await expect(service.getMovementById('scm1', ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
