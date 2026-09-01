import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import { InstalledPartsReplacementService } from '../installed-parts-replacement/installed-parts-replacement.service';
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

const machine = (overrides: Record<string, any> = {}) => ({
  id: 'm1',
  companyId: 'c1',
  branchId: 'b1',
  name: 'Machine 1',
  code: 'M1',
  productionLineId: null,
  departmentId: null,
  defaultCostCenterId: null,
  ...overrides,
});

const partLine = (overrides: Record<string, any> = {}) => ({
  id: 'line1',
  maintenanceRequestId: 'req1',
  status: 'APPROVED',
  approvedQuantity: 10,
  requestedQuantity: 10,
  quantity: 10,
  issuedQuantity: 0,
  returnedQuantity: 0,
  machineComponentId: null,
  machineComponent: null,
  sparePart: {
    id: 'sp1',
    productId: 'prod1',
    code: 'SP1',
    name: 'Spare Part 1',
    technicalClassification: null,
    usageType: null,
    nature: null,
    importance: null,
  },
  maintenanceRequest: { machine: machine() },
  ...overrides,
});

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  name: 'Warehouse 1',
  code: 'WH1',
  warehouseType: 'SPARE_PARTS',
  ...overrides,
});

describe('MaintenanceStockIssueService tenant isolation', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let conditionService: any;
  let installedPartsService: any;
  let service: MaintenanceStockIssueService;

  beforeEach(() => {
    prisma = {
      maintenanceRequestRequiredPart: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      warehouse: { findUnique: jest.fn() },
      machine: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      inventoryBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      sparePartConditionBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sparePartConditionMovement: {
        create: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      userRole: { findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('IM-0001') };
    conditionService = {};
    installedPartsService = {
      recordInstalledPartInTx: jest.fn().mockResolvedValue({ id: 'ip1' }),
      recordReplacementInTx: jest.fn().mockResolvedValue({ id: 'rep1' }),
    };
    service = new MaintenanceStockIssueService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      numbering as unknown as NumberingService,
      conditionService as unknown as SparePartConditionService,
      installedPartsService as unknown as InstalledPartsReplacementService,
      { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null) } as any,
    );
  });

  const baseIssueDto = {
    warehouseId: 'wh1',
    issuedQuantity: 2,
    replacementAction: 'NEW_INSTALLATION',
  };

  describe('issue - foreign request', () => {
    it('rejects issuing a part line that belongs to another request', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({ maintenanceRequestId: 'req-other' }),
      );

      await expect(
        service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('issue - foreign line machine', () => {
    it('rejects issuing a part line whose machine belongs to another company', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({
          maintenanceRequest: {
            machine: machine({ id: 'm-foreign', companyId: 'c2' }),
          },
        }),
      );

      await expect(
        service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('rejects issuing a part line whose machine belongs to another branch', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({
          maintenanceRequest: {
            machine: machine({ id: 'm-otherbranch', branchId: 'b2' }),
          },
        }),
      );

      await expect(
        service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('issue - foreign warehouse', () => {
    it('rejects issuing from a foreign-company warehouse before any mutation', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'wh-foreign', companyId: 'c2' }));

      await expect(
        service.issue('req1', 'line1', { ...baseIssueDto, warehouseId: 'wh-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionMovement.create).not.toHaveBeenCalled();
    });

    it('rejects issuing from a foreign-company removedPartWarehouse before any mutation', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(warehouse())
        .mockResolvedValueOnce(warehouse({ id: 'wh-removed-foreign', companyId: 'c2' }));

      await expect(
        service.issue('req1', 'line1', {
          ...baseIssueDto,
          replacementAction: 'RETURNED_REMOVED_PART',
          removedPartCondition: 'USED_REPAIRABLE',
          removedPartWarehouseId: 'wh-removed-foreign',
          removedPartQuantity: 1,
        } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.sparePartConditionBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('issue - foreign warehouse location', () => {
    it('rejects a warehouseLocationId that belongs to a different warehouse', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc-other', warehouseId: 'wh-other' });

      await expect(
        service.issue('req1', 'line1', { ...baseIssueDto, warehouseLocationId: 'loc-other' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('returnStock - foreign request', () => {
    it('rejects returning a part line that belongs to another request', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({ maintenanceRequestId: 'req-other' }),
      );

      await expect(
        service.returnStock('req1', 'line1', { returnQuantity: 2 } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('returnStock - foreign/legacy stored warehouse', () => {
    const issuedLine = (overrides: Record<string, any> = {}) =>
      partLine({ issuedQuantity: 5, returnedQuantity: 0, ...overrides });

    it('rejects returning to a foreign-company stored warehouse before any mutation', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique
        .mockResolvedValueOnce(issuedLine())
        .mockResolvedValueOnce(issuedLine({ warehouseId: 'wh-foreign' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'wh-foreign', companyId: 'c2' }));

      await expect(
        service.returnStock('req1', 'line1', { returnQuantity: 2 } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects returning to a foreign-branch stored warehouse before any mutation', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique
        .mockResolvedValueOnce(issuedLine())
        .mockResolvedValueOnce(issuedLine({ warehouseId: 'wh-otherbranch' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'wh-otherbranch', branchId: 'b2' }));

      await expect(
        service.returnStock('req1', 'line1', { returnQuantity: 2 } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects returning when the stored part line has no warehouse', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique
        .mockResolvedValueOnce(issuedLine())
        .mockResolvedValueOnce(issuedLine({ warehouseId: null }));

      await expect(
        service.returnStock('req1', 'line1', { returnQuantity: 2 } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('issue - in-transaction machine revalidation', () => {
    it('re-rejects a machine that becomes foreign between pre-validation and the transaction', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.machine.findUnique.mockResolvedValue(machine({ id: 'm1', companyId: 'c2' }));

      await expect(
        service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.machine.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled();
    });

    it('revalidates the machine inside the transaction on a successful issue', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.machine.findUnique.mockResolvedValue(machine());
      prisma.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal1',
        sparePartId: 'sp1',
        productId: 'prod1',
        warehouseId: 'wh1',
        condition: 'NEW',
        quantity: 10,
        availableQuantity: 10,
      });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'bal1' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'im1', movementNumber: 'IM-0001', lines: [] });
      prisma.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line1' });
      prisma.sparePartConditionBalance.findFirst.mockResolvedValue({
        id: 'cb1',
        sparePartId: 'sp1',
        productId: 'prod1',
        warehouseId: 'wh1',
        condition: 'NEW',
        quantity: 10,
        availableQuantity: 10,
      });
      prisma.sparePartConditionBalance.update.mockResolvedValue({ id: 'cb1' });
      prisma.sparePartConditionMovement.create.mockResolvedValue({ id: 'scm1' });

      const result = await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

      expect(result).toEqual(partLine());
      expect(prisma.machine.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(prisma.inventoryMovement.create).toHaveBeenCalled();
      expect(prisma.maintenanceRequestRequiredPart.update).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith('u1', 'ISSUE_STOCK', 'MaintenanceRequestRequiredPart', 'line1', expect.any(Object));
    });
  });

  describe('issue - cost purpose override RBAC', () => {
    const fullIssueMocks = () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.machine.findUnique.mockResolvedValue(machine());
      prisma.inventoryBalance.findFirst.mockResolvedValue({
        id: 'bal1', sparePartId: 'sp1', productId: 'prod1', warehouseId: 'wh1', condition: 'NEW', quantity: 10, availableQuantity: 10,
      });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'bal1' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'im1', movementNumber: 'IM-0001', lines: [] });
      prisma.maintenanceRequestRequiredPart.update.mockResolvedValue({ id: 'line1' });
      prisma.sparePartConditionBalance.findFirst.mockResolvedValue({
        id: 'cb1', sparePartId: 'sp1', productId: 'prod1', warehouseId: 'wh1', condition: 'NEW', quantity: 10, availableQuantity: 10,
      });
      prisma.sparePartConditionBalance.update.mockResolvedValue({ id: 'cb1' });
      prisma.sparePartConditionMovement.create.mockResolvedValue({ id: 'scm1' });
    };

    it('rejects overriding the default MAINTENANCE cost purpose without the cost-purpose:override permission', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.userRole.findMany.mockResolvedValue([]);

      await expect(
        service.issue('req1', 'line1', { ...baseIssueDto, costPurpose: 'PRODUCTION', costPurposeOverrideReason: 'project overhead' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.userRole.findMany).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('rejects an override without a mandatory reason even when permission is granted', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.userRole.findMany.mockResolvedValue([
        { role: { status: 'ACTIVE', code: 'MAINT', permissions: [{ permission: { status: 'ACTIVE', key: 'cost-purpose:override' } }] } },
      ]);

      await expect(
        service.issue('req1', 'line1', { ...baseIssueDto, costPurpose: 'QUALITY', costPurposeOverrideReason: '' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('accepts an authorized override with a reason, persists the purpose, and audits the override', async () => {
      fullIssueMocks();
      prisma.userRole.findMany.mockResolvedValue([
        { role: { status: 'ACTIVE', code: 'COST', permissions: [{ permission: { status: 'ACTIVE', key: 'cost-purpose:override' } }] } },
      ]);

      await service.issue('req1', 'line1', { ...baseIssueDto, costPurpose: 'PROJECT', costPurposeOverrideReason: 'external project' } as any, 'u1', ctx);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith('u1', 'COST_PURPOSE_OVERRIDE', 'MaintenanceRequestRequiredPart', 'line1', expect.objectContaining({
        sourceDefaultPurpose: 'MAINTENANCE',
        finalPurpose: 'PROJECT',
        overrideReason: 'external project',
      }));
    });
  });

  describe('returnStock - in-transaction machine revalidation', () => {
    const issuedLine = (overrides: Record<string, any> = {}) =>
      partLine({ issuedQuantity: 5, returnedQuantity: 0, ...overrides });

    it('re-rejects a machine that becomes foreign during the return transaction', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique
        .mockResolvedValueOnce(issuedLine())
        .mockResolvedValueOnce(issuedLine({ warehouseId: 'wh1' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.machine.findUnique.mockResolvedValue(machine({ id: 'm1', companyId: 'c2' }));

      await expect(
        service.returnStock('req1', 'line1', { returnQuantity: 2 } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.machine.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('getIssues', () => {
    it('rejects listing issues for a part line whose machine belongs to another company', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({
          maintenanceRequest: { machine: machine({ id: 'm-foreign', companyId: 'c2' }) },
        }),
      );

      await expect(
        service.getIssues('line1', 'req1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryMovement.findMany).not.toHaveBeenCalled();
    });
  });
});
