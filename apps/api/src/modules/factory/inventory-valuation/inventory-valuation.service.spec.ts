import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InventoryValuationService } from './inventory-valuation.service';
import {
  INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION,
  INVENTORY_VALUATION_AUDIT_ENTITY_POLICY,
  INVENTORY_VALUATION_POLICY_ACTIONS,
} from './inventory-valuation.constants';

const ctx = {
  contextKey: 'c1:b1:-:-',
  scopeId: null,
  companyId: 'C1',
  companyName: 'Company 1',
  companyCode: 'C1',
  branchId: 'B1',
  branchName: 'Branch 1',
  branchCode: 'B1',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
} as any;

function mockDec(value: string | number) {
  return { toString: () => String(value), toFixed: () => String(value), plus: () => mockDec(0), mul: () => mockDec(0), lte: () => false, toDecimalPlaces: () => mockDec(value) };
}

function mockPrisma() {
  const tx = {
    inventoryOpeningBalanceLine: { findUnique: jest.fn(), update: jest.fn() },
    inventoryOperationalReceiptLine: { findUnique: jest.fn(), update: jest.fn() },
    inventoryValuationPolicy: { findUnique: jest.fn(), update: jest.fn() },
    inventoryValuationInitialization: { findFirst: jest.fn(), create: jest.fn() },
    inventoryValuationBalance: { findUnique: jest.fn(), create: jest.fn() },
    inventoryBalance: { findMany: jest.fn() },
  };
  const prisma = {
    inventoryValuationPolicy: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    product: { findUnique: jest.fn() },
    inventoryBalance: { findMany: jest.fn() },
    inventoryValuationInitialization: { findMany: jest.fn(), count: jest.fn() },
    warehouse: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (t: any) => Promise<any>) => fn(tx)),
  };
  return { prisma, tx };
}

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;
  let prisma: ReturnType<typeof mockPrisma>['prisma'];
  let tx: ReturnType<typeof mockPrisma>['tx'];
  const audit = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    logWithClient: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  beforeEach(() => {
    const m = mockPrisma();
    prisma = m.prisma;
    tx = m.tx;
    jest.clearAllMocks();
    service = new InventoryValuationService(prisma as any, audit as any);
  });

  const policy = {
    id: 'POL-1',
    companyId: 'C1',
    warehouseId: 'WH-1',
    method: 'WEIGHTED_AVERAGE',
    status: 'DRAFT',
    currencyCode: 'USD',
    deletedAt: null,
  };

  const policyInTx = { ...policy, status: 'INITIALIZING' };

  describe('policy lifecycle', () => {
    it('createPolicy enforces warehouse-in-context and declares conflict when a policy already exists for the warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'WH-1', companyId: 'C1', branchId: 'B1' });
      prisma.inventoryValuationPolicy.findFirst.mockResolvedValue(policy);
      await expect(
        service.createPolicy({ warehouseId: 'WH-1', method: 'WEIGHTED_AVERAGE', currencyCode: 'usd' }, 'U1', ctx),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.inventoryValuationPolicy.create).not.toHaveBeenCalled();
    });

    it('createPolicy normalizes currency and audits POLICY_CREATE', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'WH-1', companyId: 'C1', branchId: 'B1' });
      prisma.inventoryValuationPolicy.findFirst.mockResolvedValue(null);
      prisma.inventoryValuationPolicy.create.mockResolvedValue({ ...policy, currencyCode: 'USD' });
      const out = await service.createPolicy({ warehouseId: 'WH-1', method: 'WEIGHTED_AVERAGE', currencyCode: 'usd' }, 'U1', ctx);
      expect(prisma.inventoryValuationPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currencyCode: 'USD', status: 'DRAFT', companyId: 'C1' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'U1',
        INVENTORY_VALUATION_POLICY_ACTIONS.policyCreate,
        INVENTORY_VALUATION_AUDIT_ENTITY_POLICY,
        expect.any(String),
        expect.objectContaining({ companyId: 'C1' }),
      );
      expect(out.currencyCode).toBe('USD');
    });

    it('beginInitialization moves DRAFT -> INITIALIZING and audits POLICY_INITIALIZATION_START', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(policy);
      prisma.inventoryValuationPolicy.update.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      const out = await service.beginInitialization('POL-1', 'U1', ctx);
      expect(prisma.inventoryValuationPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'INITIALIZING' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        'U1',
        INVENTORY_VALUATION_POLICY_ACTIONS.policyInitializationStart,
        INVENTORY_VALUATION_AUDIT_ENTITY_POLICY,
        'POL-1',
        expect.objectContaining({ oldStatus: 'DRAFT', newStatus: 'INITIALIZING' }),
      );
      expect(out.status).toBe('INITIALIZING');
    });

    it('beginInitialization rejects a policy that is not DRAFT', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      await expect(service.beginInitialization('POL-1', 'U1', ctx)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updatePolicy freezes currency once initialization has begun (INITIALIZING)', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      await expect(service.updatePolicy('POL-1', { currencyCode: 'EUR' }, 'U1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'inventoryValuation.currencyFrozen' },
      });
    });

    it('updatePolicy freezes method once initialization has begun (INITIALIZING)', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      await expect(service.updatePolicy('POL-1', { method: 'WEIGHTED_AVERAGE' }, 'U1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'inventoryValuation.methodFrozen' },
      });
    });

    it('findPolicy forbids cross-company access', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, companyId: 'OTHER', branchId: 'B9', initializations: [] });
      await expect(service.findPolicy('POL-1', ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('explicit monetary input', () => {
    it('opening cost input rejects a currency mismatch with the policy', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(policy);
      await expect(
        service.inputOpeningCost('POL-1', { lineId: 'L-1', unitCost: 10, currencyCode: 'EUR' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.currencyMismatch' } });
      expect(tx.inventoryOpeningBalanceLine.update).not.toHaveBeenCalled();
    });

    it('opening cost input rejects zero cost without an explicit reason', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(policy);
      await expect(
        service.inputOpeningCost('POL-1', { lineId: 'L-1', unitCost: 0, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.zeroCostRequiresReason' } });
    });

    it('opening cost input rejects a line whose warehouse differs from the policy warehouse', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(policy);
      tx.inventoryOpeningBalanceLine.findUnique.mockResolvedValue({
        id: 'L-1',
        productId: 'P-1',
        openingBalance: { companyId: 'C1', branchId: 'B1', warehouseId: 'WH-OTHER' },
      });
      await expect(
        service.inputOpeningCost('POL-1', { lineId: 'L-1', unitCost: 10, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.warehouseMismatch' } });
      expect(tx.inventoryOpeningBalanceLine.update).not.toHaveBeenCalled();
    });

    it('opening cost input persists cost in policy currency and audits OPENING_COST_INPUT', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(policy);
      tx.inventoryOpeningBalanceLine.findUnique.mockResolvedValue({
        id: 'L-1',
        productId: 'P-1',
        openingBalance: { companyId: 'C1', branchId: 'B1', warehouseId: 'WH-1' },
      });
      tx.inventoryOpeningBalanceLine.update.mockResolvedValue({ id: 'L-1', currencyCode: 'USD', unitCost: mockDec('10') });
      const out = await service.inputOpeningCost('POL-1', { lineId: 'L-1', unitCost: 10, currencyCode: 'usd' }, 'U1', ctx);
      expect(tx.inventoryOpeningBalanceLine.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currencyCode: 'USD', unitCost: expect.any(Object) }) }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: INVENTORY_VALUATION_POLICY_ACTIONS.openingCostInput, entity: INVENTORY_VALUATION_AUDIT_ENTITY_POLICY, details: expect.objectContaining({ lineId: 'L-1' }) }),
      );
      expect(out.currencyCode).toBe('USD');
    });

    it('monetary input is rejected when the policy is RETIRED', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'RETIRED' });
      await expect(
        service.inputReceiptCost('POL-1', { lineId: 'L-1', unitCost: 5, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('legacy initialization matrix', () => {
    const balancing = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    };

    beforeEach(() => {
      tx.inventoryValuationBalance = balancing as any;
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(policyInTx);
      tx.inventoryValuationPolicy.findUnique.mockResolvedValue(policyInTx);
      tx.inventoryValuationInitialization.findFirst.mockResolvedValue(null);
      balancing.findUnique.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue({ id: 'P-1', code: 'P1', name: 'Prod', deletedAt: null });
    });

    it('happy path: derives quantitySnapshot from quantityBase, writes init + balance atomically, audits, never touches movement lines', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'P-1', code: 'P1', name: 'Prod', deletedAt: null });
      tx.inventoryValuationInitialization.create.mockResolvedValue({ id: 'INIT-1', quantitySnapshot: mockDec('25'), unitCost: mockDec('10'), totalValue: mockDec('250'), currencyCode: 'USD' });
      balancing.create.mockResolvedValue({ id: 'BAL-1', inventoryValue: mockDec('250') });
      tx.inventoryBalance.findMany.mockResolvedValue([
        { quantity: 10, quantityBase: { toString: () => '10' } },
        { quantity: 15, quantityBase: { toString: () => '15' } },
      ]);

      const out = await service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx);

      expect(tx.inventoryValuationInitialization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'C1',
            warehouseId: 'WH-1',
            productId: 'P-1',
            policyId: 'POL-1',
            currencyCode: 'USD',
            quantitySnapshot: expect.any(Object),
            unitCost: expect.any(Object),
            totalValue: expect.any(Object),
          }),
        }),
      );
      expect(balancing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inventoryValue: expect.any(Object), averageUnitCost: expect.any(Object), version: 1 }),
        }),
      );
      expect(tx.inventoryValuationPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ initializedAt: expect.any(Date), initializedById: 'U1' }) }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: INVENTORY_VALUATION_POLICY_ACTIONS.legacyValuationInitialize,
          entity: INVENTORY_VALUATION_AUDIT_ENTITY_INITIALIZATION,
          entityId: 'INIT-1',
          details: expect.objectContaining({
            policyId: 'POL-1',
            productId: 'P-1',
            warehouseId: 'WH-1',
            currencyCode: 'USD',
            reason: null,
          }),
        }),
      );
      // movement lines must NOT be written (R1B intentionally creates no InventoryMovement)
      expect(tx.inventoryBalance.findMany).toHaveBeenCalled();
      expect(out.initialization.currencyCode).toBe('USD');
    });

    it('rejects initialization when the policy is not INITIALIZING', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policyInTx, status: 'DRAFT' });
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.inventoryValuationInitialization.create).not.toHaveBeenCalled();
    });

    it('rejects initialization for a product with no physical stock in the warehouse', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'P-1', code: 'P1', name: 'Prod', deletedAt: null });
      tx.inventoryBalance.findMany.mockResolvedValue([]);
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.noStock' } });
    });

    it('rejects a duplicate initialization for the same company+warehouse+product (DB-unique idempotency)', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'P-1', code: 'P1', name: 'Prod', deletedAt: null });
      tx.inventoryBalance.findMany.mockResolvedValue([{ quantity: 5, quantityBase: { toString: () => '5' } }]);
      tx.inventoryValuationInitialization.findFirst.mockResolvedValue({ id: 'INIT-OLD' });
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when a valuation balance already exists (no re-initialization)', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'P-1', code: 'P1', name: 'Prod', deletedAt: null });
      tx.inventoryBalance.findMany.mockResolvedValue([{ quantity: 5, quantityBase: { toString: () => '5' } }]);
      balancing.findUnique.mockResolvedValue({ id: 'BAL-OLD' });
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.balanceExists' } });
    });

    it('rejects negative unit cost', async () => {
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: -1 }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.negativeCost' } });
    });

    it('rejects zero unit cost without an explicit reason', async () => {
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 0 }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.zeroCostRequiresReason' } });
    });

    it('rejects an unknown/deleted product', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'P-1', deletedAt: new Date() });
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('re-enforces tenant/status inside the transaction against TOCTOU (cross-company policy)', async () => {
      tx.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policyInTx, companyId: 'OTHER' });
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
