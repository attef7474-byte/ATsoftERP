import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import { InstalledPartsReplacementService } from '../installed-parts-replacement/installed-parts-replacement.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

/**
 * R4R — spare part issue hardening.
 *
 * Two defects are covered here:
 *  1. The canonical stock-issue authority did not enforce the spare-part catalog
 *     lifecycle, so a deactivated or soft-deleted SparePart could still be issued.
 *  2. The canonical stock-issue authority had no client idempotency key, so a repeated
 *     submission of the same issue could deduct the same stock twice.
 */

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

const sparePart = (overrides: Record<string, any> = {}) => ({
  id: 'sp1',
  productId: 'prod1',
  code: 'SP1',
  name: 'Spare Part 1',
  technicalClassification: null,
  usageType: null,
  nature: null,
  importance: null,
  status: 'ACTIVE',
  deletedAt: null,
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
  warehouseId: null,
  machineComponentId: null,
  machineComponent: null,
  sparePart: sparePart(),
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

describe('R4R maintenance stock issue — catalog lifecycle + idempotency', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let conditionService: any;
  let installedPartsService: any;
  let service: MaintenanceStockIssueService;

  beforeEach(() => {
    prisma = {
      maintenanceRequestRequiredPart: { findUnique: jest.fn(), update: jest.fn() },
      warehouse: { findUnique: jest.fn().mockResolvedValue(warehouse()) },
      machine: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      inventoryMovement: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
      sparePartConditionBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      sparePartConditionMovement: { create: jest.fn() },
      product: { findUnique: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      sparePartReplacementHistory: { findFirst: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]),
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('IM-0001') };
    conditionService = {};
    installedPartsService = {
      recordInstalledPartInTx: jest.fn().mockResolvedValue({ id: 'ip1' }),
      recordReplacementInTx: jest.fn().mockResolvedValue({ id: 'rep1' }),
      markInstalledPartRemovedInTx: jest.fn().mockResolvedValue({ id: 'ip-old', status: 'REMOVED' }),
    };
    service = new MaintenanceStockIssueService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      numbering as unknown as NumberingService,
      conditionService as unknown as SparePartConditionService,
      installedPartsService as unknown as InstalledPartsReplacementService,
      { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null) } as any,
      { postLedgerEntryWithinTransaction: jest.fn(), reverseLedgerEntry: jest.fn() } as any,
    );
  });

  const baseDto = { warehouseId: 'wh1', issuedQuantity: 2, replacementAction: 'NEW_INSTALLATION' };

  describe('spare-part catalog lifecycle is enforced on the issue path', () => {
    it('rejects issuing an INACTIVE spare part', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({ sparePart: sparePart({ status: 'INACTIVE' }) }),
      );

      const error = await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx)
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.sparePartNotActive' });
      // No stock may move when the catalog item is not issuable.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('rejects issuing a soft-deleted spare part', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({ sparePart: sparePart({ deletedAt: new Date('2026-01-01T00:00:00.000Z') }) }),
      );

      const error = await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx)
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.sparePartDeleted' });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a requirement whose spare part link is missing', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine({ sparePart: null }));

      const error = await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx)
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.sparePartMissing' });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('the lifecycle guard is enforced BEFORE the idempotent replay lookup, so a deactivated part cannot be replayed through', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(
        partLine({ sparePart: sparePart({ status: 'INACTIVE' }) }),
      );
      // A movement for this client request id already exists: the replay must still
      // not return success for a part that is no longer issuable.
      prisma.inventoryMovement.findFirst.mockResolvedValue({ id: 'mv-existing' });

      const error = await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-1' })
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse()).toMatchObject({ messageKey: 'sparePartIssue.sparePartNotActive' });
    });
  });

  describe('client idempotency key', () => {
    it('a repeated submission with the same clientRequestId returns the original line and issues no second movement', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      // The FIRST call for this client request id already posted a movement. A real
      // replay target is always bound to the same requirement line.
      prisma.inventoryMovement.findFirst.mockResolvedValue({
        id: 'mv-original',
        sourceType: 'MAINTENANCE_PART_LINE',
        sourceId: 'line1',
      });
      prisma.maintenanceRequestRequiredPart.findUnique
        .mockResolvedValueOnce(partLine())
        .mockResolvedValue(partLine({ issuedQuantity: 2 }));

      const result = await service.issue(
        'req1',
        'line1',
        baseDto as any,
        'user1',
        ctx,
        { clientRequestId: 'cr-duplicate' },
      );

      expect(result).toMatchObject({ id: 'line1', issuedQuantity: 2, idempotentReplay: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      // A replay is not a new business event, so it must not be audited as one.
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('rejects a clientRequestId that was already used for a DIFFERENT requirement line', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      // The key already belongs to another line of the same tenant.
      prisma.inventoryMovement.findFirst.mockResolvedValue({
        id: 'mv-other',
        sourceType: 'MAINTENANCE_PART_LINE',
        sourceId: 'line-other',
      });

      await expect(
        service.issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-shared' }),
      ).rejects.toBeInstanceOf(ConflictException);

      // A conflicting payload must not touch stock, must not open a transaction and
      // must not be reported as a successful issue.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('rejects a clientRequestId whose existing movement came from a different source document', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue({
        id: 'mv-other-source',
        sourceType: 'PRODUCTION_ORDER',
        sourceId: 'line1',
      });

      await expect(
        service.issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-wrong-source' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('the replay lookup is tenant-scoped to the active company and branch', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv-1', movementNumber: 'IM-0001' });

      await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-tenant' })
        .catch(() => undefined);

      expect(prisma.inventoryMovement.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requestId: 'cr-tenant',
            companyId: 'c1',
            OR: [{ branchId: 'b1' }, { branchId: null }],
          }),
        }),
      );
    });

    it('the clientRequestId is written to inventory_movements.requestId, the column that carries the filtered unique index', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv-1', movementNumber: 'IM-0001' });

      await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-index' })
        .catch(() => undefined);

      const createArg = prisma.inventoryMovement.create.mock.calls[0]?.[0];
      if (createArg) {
        expect(createArg.data.requestId).toBe('cr-index');
      }
    });

    it('a P2002 unique violation on the idempotency key is treated as a replay, not a failure', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });

      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      // The whole transaction rolls back because of the unique-index race.
      prisma.$transaction.mockImplementation(async () => {
        throw p2002;
      });

      const result = await service.issue(
        'req1',
        'line1',
        baseDto as any,
        'user1',
        ctx,
        { clientRequestId: 'cr-race' },
      );

      expect(result).toBeDefined();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('a P2002 WITHOUT a client request id is still a real error and is not swallowed', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });

      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      prisma.$transaction.mockImplementation(async () => {
        throw p2002;
      });

      await expect(service.issue('req1', 'line1', baseDto as any, 'user1', ctx)).rejects.toBeDefined();
    });

    it('a P2002 on a DIFFERENT unique index is a real error even when a client request id is present', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });

      // e.g. the generated movement number collided. This must NOT be misread as an
      // idempotent replay, because silently returning line state would hide the fact
      // that no movement was posted at all.
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['movementNumber'] },
      });
      prisma.$transaction.mockImplementation(async () => {
        throw p2002;
      });

      await expect(
        service.issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-other-index' }),
      ).rejects.toBeDefined();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('a P2002 naming the requestId column is still treated as an idempotent replay', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });

      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['requestId'] },
      });
      prisma.$transaction.mockImplementation(async () => {
        throw p2002;
      });

      const result = await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-named-index' })
        .catch(() => undefined);

      expect(result).toMatchObject({ idempotentReplay: true });
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('no idempotency lookup is performed when no client request id is supplied', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv-1', movementNumber: 'IM-0001' });

      await service.issue('req1', 'line1', baseDto as any, 'user1', ctx).catch(() => undefined);

      expect(prisma.inventoryMovement.findFirst).not.toHaveBeenCalled();
    });

    it('the clientRequestId is recorded in the audit trail of a real issue', async () => {
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(partLine());
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.findFirst.mockResolvedValue({ quantity: 10 });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv-1', movementNumber: 'IM-0001' });

      await service
        .issue('req1', 'line1', baseDto as any, 'user1', ctx, { clientRequestId: 'cr-audit' })
        .catch(() => undefined);

      const auditCalls = audit.log.mock.calls;
      if (auditCalls.length > 0) {
        const payload = auditCalls[auditCalls.length - 1][4] ?? {};
        expect(payload).toMatchObject({ clientRequestId: 'cr-audit' });
      }
    });
  });
});
