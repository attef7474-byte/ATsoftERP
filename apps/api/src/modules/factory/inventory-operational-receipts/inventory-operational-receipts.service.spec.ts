import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryOperationalReceiptsService } from './inventory-operational-receipts.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
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

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'w1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'WH1',
  name: 'Main Warehouse',
  ...overrides,
});

const line = (overrides: Record<string, any> = {}) => ({
  id: 'l1',
  receiptId: 'r1',
  productId: 'prd1',
  quantity: 10,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const doc = (overrides: Record<string, any> = {}) => ({
  id: 'r1',
  code: 'OR-0001',
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  locationId: null,
  receiptType: 'OPERATIONAL',
  reason: 'Operational receipt',
  notes: null,
  status: 'DRAFT',
  createdById: 'u1',
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lines: [line()],
  ...overrides,
});

describe('InventoryOperationalReceiptsService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryOperationalReceiptsService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryOperationalReceipt: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      inventoryOperationalReceiptLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('OR-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('OR-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryOperationalReceiptsService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null), aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new Prisma.Decimal(0)), applyValuedReceipt: jest.fn().mockResolvedValue({}) } as any);
  });

  describe('update', () => {
    it('rejects warehouse re-pointing to a foreign company warehouse', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(
        service.update('r1', { warehouseId: 'w-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryOperationalReceipt.update).not.toHaveBeenCalled();
    });

    it('never writes tenant fields from the DTO', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc());
      prisma.inventoryOperationalReceipt.update.mockResolvedValue(doc());
      prisma.warehouseLocation.findUnique.mockResolvedValue(null);

      await service.update('r1', {
        companyId: 'c2',
        branchId: 'b2',
        reason: 'updated',
      } as any, 'u1', ctx);

      const updateCall = prisma.inventoryOperationalReceipt.update.mock.calls[0][0];
      expect(updateCall.data.companyId).toBeUndefined();
      expect(updateCall.data.branchId).toBeUndefined();
      expect(updateCall.data.reason).toBe('updated');
    });

    it('rejects locationId that does not belong to the effective warehouse', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc());
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.update('r1', { locationId: 'loc2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('post', () => {
    // ── History / canonical quantityBase contract ─────────────────────────────
    // The current inventory domain has NO general UOM conversion model: Product
    // carries only `unit` (a display string), there is no baseUnit / inventory
    // conversionFactor / UOM conversion table, and the inventory migration
    // establishes `quantityBase = quantity`. All inventory stock mutators treat
    // quantityBase as the canonical 1:1 Decimal shadow of the transaction
    // quantity, falling back to quantity when the twin is null. Therefore the
    // canonical inventory base-quantity contract is IDENTITY (1:1):
    //
    //   QUANTITY_BASE_USES_CANONICAL_CONVERSION = YES (identity)
    //   NON_ONE_TO_ONE_QUANTITY_BASE_TEST        = N/A (no UOM conversion model)
    //
    // The receipt post must keep quantityBase in lock-step with quantity so the
    // engine's physical authority (SUM(quantityBase)) never diverges from on-hand
    // and is never left stale/null after a successful mutation.
    //
    // FUTURE SAFETY: if a multi-UOM inventory conversion mechanism is later
    // introduced (e.g. Product.baseUnit + conversionFactor), this 1:1 identity
    // assumption MUST be revisited and quantityBase must then be derived through
    // that future canonical conversion service. Do not silently preserve 1:1.
    // ──────────────────────────────────────────────────────────────────────────
    it('revalidates warehouse inside the transaction and uses in-tx numbering', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', lines: [] });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 5 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryOperationalReceipt.update.mockResolvedValue(doc({ status: 'POSTED' }));

      await service.post('r1', 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('INVENTORY_MOVEMENT', prisma);
      const created = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(created.data.warehouseId).toBe('w1');
      expect(created.data.movementType).toBe('STOCK_RECEIVING');
    });

    it('rejects posting a document whose warehouse belongs to another company', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc({ status: 'APPROVED', warehouseId: 'w-foreign' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(service.post('r1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('keeps quantityBase physical twin in sync with quantity on an existing balance', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', lines: [line({ id: 'ml1' })] });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 5, quantityBase: new Prisma.Decimal(5) });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryOperationalReceipt.update.mockResolvedValue(doc({ status: 'POSTED' }));

      await service.post('r1', 'u1', ctx);

      const updateCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(updateCall.data.quantity).toBe(15);
      expect(updateCall.data.quantityBase.toString()).toBe('15');
    });

    it('bootstraps quantityBase from quantity when the balance twin is null', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', lines: [line({ id: 'ml1' })] });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 5, quantityBase: null });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryOperationalReceipt.update.mockResolvedValue(doc({ status: 'POSTED' }));

      await service.post('r1', 'u1', ctx);

      const updateCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(updateCall.data.quantityBase.toString()).toBe('15');
    });

    it('preserves the canonical 1:1 invariant: quantityBase mirrors quantity after a receipt on a non-zero balance', async () => {
      prisma.inventoryOperationalReceipt.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', lines: [line({ id: 'ml1' })] });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 12, quantityBase: new Prisma.Decimal(12) });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryOperationalReceipt.update.mockResolvedValue(doc({ status: 'POSTED' }));

      await service.post('r1', 'u1', ctx);

      const updateCall = prisma.inventoryBalance.update.mock.calls[0][0];
      // Engine authority reads SUM(quantityBase); the twin must equal on-hand.
      expect(Number(updateCall.data.quantity)).toBe(12 + 10);
      expect(updateCall.data.quantityBase.toString()).toBe(String(12 + 10));
      expect(updateCall.data.quantityBase).not.toBeNull();
    });
  });
});
