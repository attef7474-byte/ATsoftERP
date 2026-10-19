import { ForbiddenException } from '@nestjs/common';
import { ProductAggregateService } from './product-aggregate.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

/**
 * Focused tests for the single canonical Product aggregate.
 *
 * They prove the hard requirements of the product/production identity mandate:
 *  - one create writes the product AND its production configuration in ONE transaction,
 *  - the production configuration is optional (no second identity form),
 *  - the production permission is enforced server-side on the same call,
 *  - the definition name mirrors the authoritative product name,
 *  - the production reference is generated only when a new definition is needed,
 *  - a failure in either write aborts the whole operation (atomic),
 *  - the tenant context is threaded through to every tenant-scoped write/read.
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

describe('ProductAggregateService', () => {
  let prisma: any;
  let products: any;
  let definitions: any;
  let permissions: any;
  let service: ProductAggregateService;
  let txCalls: number;

  const createdProduct = {
    id: 'prd-new',
    code: 'PRD-0001',
    name: 'Soda Bottle',
    status: 'ACTIVE',
    unit: 'PCS',
    unitId: 'u-pcs',
    productionDefinitions: [],
  };

  beforeEach(() => {
    txCalls = 0;
    prisma = {
      $transaction: jest.fn((fn: any) => {
        txCalls += 1;
        return fn(prisma);
      }),
    };
    products = {
      generateProductCode: jest.fn().mockResolvedValue('PRD-0001'),
      createInTx: jest.fn().mockResolvedValue(createdProduct),
      updateInTx: jest.fn().mockResolvedValue(createdProduct),
      findOne: jest.fn().mockResolvedValue({ ...createdProduct, productionDefinitions: [] }),
      findOneInTx: jest.fn().mockResolvedValue(createdProduct),
      // Shared, stable error mapper (mirrors ProductsService.rethrowUomError).
      rethrowUomError: jest.fn((error: unknown): never => {
        throw error;
      }),
    };
    definitions = {
      generateDefinitionCode: jest.fn().mockResolvedValue('PP-000001'),
      hasDefinitionFor: jest.fn().mockResolvedValue(false),
      applyForProductInTx: jest.fn().mockResolvedValue({ id: 'def1' }),
    };
    permissions = { assertAll: jest.fn().mockResolvedValue(undefined) };
    service = new ProductAggregateService(prisma, products, definitions, permissions);
  });

  describe('create', () => {
    it('C01: writes the product and its production configuration in one transaction', async () => {
      await service.create(
        {
          name: 'Soda Bottle',
          unitId: 'u-pcs',
          production: { enabled: true, defaultLineId: 'line1', notes: 'fill at 4C' },
        } as any,
        'u1',
        ctx,
      );

      expect(txCalls).toBe(1);
      expect(products.createInTx).toHaveBeenCalledWith(prisma, expect.objectContaining({ name: 'Soda Bottle' }), 'u1', 'PRD-0001');
      expect(definitions.applyForProductInTx).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          productId: 'prd-new',
          productName: 'Soda Bottle',
          enabled: true,
          code: 'PP-000001',
          notes: 'fill at 4C',
          defaultLineId: 'line1',
        }),
        'u1',
        ctx,
      );
    });

    it('C02: does not touch production when no production payload is sent (backward compatible)', async () => {
      await service.create({ name: 'Bolt', unitId: 'u-pcs' } as any, 'u1', ctx);

      expect(definitions.applyForProductInTx).not.toHaveBeenCalled();
      expect(definitions.generateDefinitionCode).not.toHaveBeenCalled();
      expect(txCalls).toBe(1);
    });

    it('C03: denies the call server-side when the production permission is missing', async () => {
      permissions.assertAll.mockRejectedValue(new ForbiddenException({ messageKey: 'auth.insufficientPermissions' }));

      await expect(
        service.create({ name: 'X', unitId: 'u-pcs', production: { enabled: true } } as any, 'u1', ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(permissions.assertAll).toHaveBeenCalledWith('u1', ['production-product:create']);
      expect(txCalls).toBe(0);
      expect(products.createInTx).not.toHaveBeenCalled();
    });

    it('C04: a failing production write aborts the whole operation (atomic, single transaction)', async () => {
      definitions.applyForProductInTx.mockRejectedValue(new Error('production reference collision'));

      await expect(
        service.create({ name: 'X', unitId: 'u-pcs', production: { enabled: true } } as any, 'u1', ctx),
      ).rejects.toThrow('production reference collision');

      expect(txCalls).toBe(1);
      expect(products.findOneInTx).not.toHaveBeenCalled();
    });

    it('C05: enabled=false still routes through the production service (to de-activate), never creates a second identity', async () => {
      await service.create({ name: 'X', unitId: 'u-pcs', production: { enabled: false } } as any, 'u1', ctx);

      expect(definitions.applyForProductInTx).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ enabled: false, code: null }),
        'u1',
        ctx,
      );
      expect(definitions.generateDefinitionCode).not.toHaveBeenCalled();
    });

    it('C06: maps a domain/constraint failure through the shared error contract (never leaks a raw 500)', async () => {
      const mapped = new Error('products.uomInvalidBaseUnit');
      products.createInTx.mockRejectedValue(new Error('ProductUomValidationError: invalid base unit'));
      products.rethrowUomError.mockImplementation((error: unknown): never => {
        throw mapped;
      });

      await expect(
        service.create({ name: 'X', unitId: 'bad-unit', production: { enabled: true } } as any, 'u1', ctx),
      ).rejects.toBe(mapped);

      expect(products.rethrowUomError).toHaveBeenCalledTimes(1);
      expect(txCalls).toBe(1);
    });
  });

  describe('update', () => {
    it('U01: mirrors the authoritative product name and reuses the existing definition (no new code)', async () => {
      definitions.hasDefinitionFor.mockResolvedValue(true);

      await service.update('prd1', { name: 'Renamed', production: { enabled: true, notes: 'n' } } as any, 'u1', ctx);

      expect(permissions.assertAll).toHaveBeenCalledWith('u1', ['production-product:update']);
      expect(definitions.generateDefinitionCode).not.toHaveBeenCalled();
      expect(definitions.applyForProductInTx).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ productId: 'prd1', productName: 'Renamed', enabled: true, code: null }),
        'u1',
        ctx,
      );
    });

    it('U02: generates a production reference only when enabling a product without a definition', async () => {
      definitions.hasDefinitionFor.mockResolvedValue(false);

      await service.update('prd1', { production: { enabled: true } } as any, 'u1', ctx);

      expect(definitions.generateDefinitionCode).toHaveBeenCalledTimes(1);
      expect(definitions.applyForProductInTx).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ code: 'PP-000001', enabled: true }),
        'u1',
        ctx,
      );
    });

    it('U03: denies the update when the production update permission is missing', async () => {
      permissions.assertAll.mockRejectedValue(new ForbiddenException({ messageKey: 'auth.insufficientPermissions' }));

      await expect(
        service.update('prd1', { production: { enabled: true } } as any, 'u1', ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(txCalls).toBe(0);
      expect(products.updateInTx).not.toHaveBeenCalled();
    });

    it('U04: a plain product update does not touch production and returns the aggregate read in-tx', async () => {
      await service.update('prd1', { minStock: 5 } as any, 'u1', ctx);

      expect(definitions.hasDefinitionFor).not.toHaveBeenCalled();
      expect(definitions.applyForProductInTx).not.toHaveBeenCalled();
      expect(products.findOneInTx).toHaveBeenCalledWith(prisma, 'prd1', ctx);
      expect(txCalls).toBe(1);
    });

    it('U05: maps a locked-base-unit failure through the shared error contract (never leaks a raw 500)', async () => {
      const mapped = new Error('products.uomBaseUnitLocked');
      products.updateInTx.mockRejectedValue(new Error('ProductUomValidationError: base unit locked'));
      products.rethrowUomError.mockImplementation((error: unknown): never => {
        throw mapped;
      });

      await expect(service.update('prd1', { unitId: 'u-kg' } as any, 'u1', ctx)).rejects.toBe(mapped);

      expect(products.rethrowUomError).toHaveBeenCalledTimes(1);
      expect(txCalls).toBe(1);
    });
  });
});
