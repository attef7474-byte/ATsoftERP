import { SparePartsService } from './spare-parts.service';

/**
 * Phase 1: the SparePart -> Product link is the authoritative technical/stock
 * bridge, so it may only point at a Product classified SPARE_PART. These focused
 * tests exercise `validateMasterInTx` directly with an in-memory tx mock.
 */
describe('SparePartsService product-link itemType compatibility', () => {
  const product = (itemType: string | null) => ({ id: 'prd1', code: 'PRD-1', status: 'ACTIVE', itemType });

  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: SparePartsService;
  let tx: any;

  beforeEach(() => {
    prisma = {};
    numbering = { generateNumberAtomic: jest.fn() };
    audit = { logWithClient: jest.fn() };
    service = new SparePartsService(prisma, audit, numbering);
    tx = {
      product: { findFirst: jest.fn() },
      sparePart: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      unit: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', isActive: true }) },
    };
  });

  it('accepts a link to a Product classified SPARE_PART', async () => {
    tx.product.findFirst.mockResolvedValue(product('SPARE_PART'));
    await expect(
      service.validateMasterInTx(tx, { name: 'Bearing', productId: 'prd1', partNumber: 'BRG-1' } as any),
    ).resolves.toBeUndefined();
  });

  it('rejects a link to a FINISHED_GOOD Product with a stable error key', async () => {
    tx.product.findFirst.mockResolvedValue(product('FINISHED_GOOD'));
    await expect(
      service.validateMasterInTx(tx, { name: 'Snack', productId: 'prd1', partNumber: 'FG-1' } as any),
    ).rejects.toMatchObject({ response: { messageKey: 'spareParts.productItemTypeConflict' } });
  });

  it('rejects a link to a RAW_MATERIAL Product', async () => {
    tx.product.findFirst.mockResolvedValue(product('RAW_MATERIAL'));
    await expect(
      service.validateMasterInTx(tx, { name: 'Flour', productId: 'prd1', partNumber: 'RM-1' } as any),
    ).rejects.toMatchObject({ response: { messageKey: 'spareParts.productItemTypeConflict' } });
  });

  it('rejects a link to an unclassified (NULL) Product', async () => {
    tx.product.findFirst.mockResolvedValue(product(null));
    await expect(
      service.validateMasterInTx(tx, { name: 'Unknown', productId: 'prd1', partNumber: 'UN-1' } as any),
    ).rejects.toMatchObject({ response: { messageKey: 'spareParts.productItemTypeConflict' } });
  });

  it('still rejects a link to a missing/deleted Product', async () => {
    tx.product.findFirst.mockResolvedValue(null);
    await expect(
      service.validateMasterInTx(tx, { name: 'Ghost', productId: 'missing' } as any),
    ).rejects.toThrow();
  });
});
