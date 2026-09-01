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
    inventoryValuationInitialization: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    inventoryValuationBalance: { findUnique: jest.fn(), create: jest.fn() },
    inventoryBalance: { findMany: jest.fn() },
    inventoryMovementLine: { findFirst: jest.fn() },
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
    service = new InventoryValuationService(prisma as any, audit as any, {
      coverageGatePasses: () => ({ pass: true, unprotected: [] }),
    } as any);
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

  describe('ACTIVE receipt cost input (post-activation valued receipts)', () => {
    const activePolicy = { ...policy, status: 'ACTIVE' };
    const unpostedReceipt = { id: 'R-1', companyId: 'C1', branchId: 'B1', warehouseId: 'WH-1', status: 'APPROVED' };
    const receiptLine = (receipt: any) => ({ id: 'LINE-1', productId: 'P-1', receipt });

    it('ALLOWS receipt-cost input for a NEW unposted receipt line on an ACTIVE policy', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      tx.inventoryOperationalReceiptLine.findUnique.mockResolvedValue(receiptLine(unpostedReceipt));
      tx.inventoryMovementLine.findFirst.mockResolvedValue(null);
      tx.inventoryOperationalReceiptLine.update.mockResolvedValue({ id: 'LINE-1', currencyCode: 'USD', unitCost: mockDec('20') });
      const out = await service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: 20, currencyCode: 'USD' }, 'U1', ctx);
      expect(tx.inventoryMovementLine.findFirst).toHaveBeenCalled();
      expect(tx.inventoryOperationalReceiptLine.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ unitCost: expect.any(Object), currencyCode: 'USD' }) }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: INVENTORY_VALUATION_POLICY_ACTIONS.receiptCostInput, details: expect.objectContaining({ lineId: 'LINE-1' }) }),
      );
      expect(out.currencyCode).toBe('USD');
    });

    it('BLOCKS re-price of an already POSTED receipt line (rewriting historical evidence)', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      tx.inventoryOperationalReceiptLine.findUnique.mockResolvedValue(receiptLine({ ...unpostedReceipt, status: 'POSTED' }));
      await expect(
        service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: 30, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.receiptLineFinalized' } });
      expect(tx.inventoryOperationalReceiptLine.update).not.toHaveBeenCalled();
    });

    it('BLOCKS re-price when a valued movement-line monetary snapshot already exists for the receipt', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      tx.inventoryOperationalReceiptLine.findUnique.mockResolvedValue(receiptLine(unpostedReceipt));
      tx.inventoryMovementLine.findFirst.mockResolvedValue({ id: 'ML-1', unitCost: mockDec('20') });
      await expect(
        service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: 30, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.receiptLineFinalized' } });
      expect(tx.inventoryOperationalReceiptLine.update).not.toHaveBeenCalled();
    });

    it('BLOCKS receipt-cost input on an ACTIVE policy for a currency mismatch', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      await expect(
        service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: 20, currencyCode: 'EUR' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.currencyMismatch' } });
      expect(tx.inventoryOperationalReceiptLine.update).not.toHaveBeenCalled();
    });

    it('BLOCKS negative receipt cost on an ACTIVE policy', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      await expect(
        service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: -5, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.negativeCost' } });
      expect(tx.inventoryOperationalReceiptLine.update).not.toHaveBeenCalled();
    });

    it('BLOCKS zero receipt cost without an explicit reason on an ACTIVE policy', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      await expect(
        service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: 0, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.zeroCostRequiresReason' } });
      expect(tx.inventoryOperationalReceiptLine.update).not.toHaveBeenCalled();
    });

    it('ALLOWS zero receipt cost with an explicit reason on an ACTIVE policy', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      tx.inventoryOperationalReceiptLine.findUnique.mockResolvedValue(receiptLine(unpostedReceipt));
      tx.inventoryMovementLine.findFirst.mockResolvedValue(null);
      tx.inventoryOperationalReceiptLine.update.mockResolvedValue({ id: 'LINE-1', currencyCode: 'USD', unitCost: mockDec('0') });
      const out = await service.inputReceiptCost('POL-1', { lineId: 'LINE-1', unitCost: 0, currencyCode: 'USD', reason: 'Gratis' }, 'U1', ctx);
      expect(tx.inventoryOperationalReceiptLine.update).toHaveBeenCalled();
      expect(out.id).toBe('LINE-1');
    });

    it('BLOCKS legacy opening-balance cost rewrite on an ACTIVE policy (config remains frozen)', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      tx.inventoryOpeningBalanceLine.findUnique.mockResolvedValue({
        id: 'L-1', productId: 'P-1', openingBalance: { companyId: 'C1', branchId: 'B1', warehouseId: 'WH-1' },
      });
      await expect(
        service.inputOpeningCost('POL-1', { lineId: 'L-1', unitCost: 10, currencyCode: 'USD' }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.policyNotEditable' } });
      expect(tx.inventoryOpeningBalanceLine.update).not.toHaveBeenCalled();
    });

    it('BLOCKS legacy stock initialization on an ACTIVE policy (INITIALIZING only)', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue(activePolicy);
      await expect(
        service.initializeProduct('POL-1', { productId: 'P-1', unitCost: 10 }, 'U1', ctx),
      ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.policyNotInInitializing' } });
      expect(tx.inventoryValuationInitialization.create).not.toHaveBeenCalled();
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

  describe('VAL-R1C activation', () => {
    const readyBalance = { productId: 'P-1', quantity: 5, quantityBase: { toString: () => '5' } };

    function setupActivePolicy() {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      tx.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING', currencyCode: 'USD' });
      tx.inventoryBalance.findMany.mockResolvedValue([readyBalance]);
      tx.inventoryValuationInitialization.findMany.mockResolvedValue([{ productId: 'P-1' }, { productId: 'P-2' }]);
      tx.inventoryValuationPolicy.update.mockResolvedValue({ ...policy, status: 'ACTIVE' });
    }

    it('happy path: INITIALIZING with all products initialized and coverage gate passing => ACTIVE + activatedAt + audit', async () => {
      setupActivePolicy();
      const out = await service.activate('POL-1', 'U1', ctx);

      const updateCall = tx.inventoryValuationPolicy.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('ACTIVE');
      expect(updateCall.data.activatedAt).toBeInstanceOf(Date);
      expect(updateCall.data.activatedById).toBe('U1');
      expect(audit.logWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: INVENTORY_VALUATION_POLICY_ACTIONS.policyActivate,
          entity: INVENTORY_VALUATION_AUDIT_ENTITY_POLICY,
          entityId: 'POL-1',
          details: expect.objectContaining({ warehouseId: 'WH-1', oldStatus: 'INITIALIZING', newStatus: 'ACTIVE', currencyCode: 'USD' }),
        }),
      );
      expect(out.status).toBe('ACTIVE');
    });

    it('refuses activation when the policy is not INITIALIZING', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'DRAFT' });
      tx.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'DRAFT', currencyCode: 'USD' });
      await expect(service.activate('POL-1', 'U1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'inventoryValuation.policyNotInInitializing' },
      });
      expect(tx.inventoryValuationPolicy.update).not.toHaveBeenCalled();
    });

    it('refuses activation when a product with stock is not yet initialized (derived readiness)', async () => {
      setupActivePolicy();
      tx.inventoryValuationInitialization.findMany.mockResolvedValue([]); // P-1 has stock but no init
      await expect(service.activate('POL-1', 'U1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'inventoryValuation.notReadyToActivate' },
      });
      expect(tx.inventoryValuationPolicy.update).not.toHaveBeenCalled();
    });

    it('refuses activation when no frozen currency is present', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      tx.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING', currencyCode: '' });
      await expect(service.activate('POL-1', 'U1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'inventoryValuation.currencyMissing' },
      });
    });

    it('refuses activation when the coverage gate reports an unprotected mutator', async () => {
      service = new InventoryValuationService(
        prisma as any,
        audit as any,
        { coverageGatePasses: () => ({ pass: false, unprotected: [{ key: 'X', classification: 'LEGACY' }] }) } as any,
      );
      setupActivePolicy();
      await expect(service.activate('POL-1', 'U1', ctx)).rejects.toMatchObject({
        response: { messageKey: 'inventoryValuation.unprotectedMutator' },
      });
      expect(tx.inventoryValuationPolicy.update).not.toHaveBeenCalled();
    });

    it('TOCTOU: re-read policy with a foreign company is rejected inside the transaction', async () => {
      prisma.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING' });
      tx.inventoryValuationPolicy.findUnique.mockResolvedValue({ ...policy, status: 'INITIALIZING', companyId: 'OTHER' });
      await expect(service.activate('POL-1', 'U1', ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
