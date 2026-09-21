import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionRunCostAggregationService } from './production-run-cost-aggregation.service';

const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'output-1', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT',
  quantity: new Prisma.Decimal('5'), goodQuantity: new Prisma.Decimal('5'), rejectQuantity: new Prisma.Decimal('0'),
  correctsEventId: null, measurementPointId: 'point-1', measurementPoint: { isAuthoritativeFinal: true }, ...overrides,
});

describe('Valuation close authoritative measurement-point propagation', () => {
  let prisma: any;
  let service: ProductionRunCostAggregationService;
  beforeEach(() => {
    prisma = {
      productionRun: { findFirst: jest.fn().mockResolvedValue({ id: 'run-1', ...ctx, costClosedAt: null, productionProductDefinitionId: 'definition-1', issueWarehouseId: 'issue-1', receiptWarehouseId: 'receipt-1' }) },
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'definition-1', productId: 'product-1' }) },
      productionOutputEvent: { findMany: jest.fn().mockResolvedValue([event()]) },
      productionMaterialDocument: { findMany: jest.fn().mockResolvedValue([]) },
      productionFinishedGoodsReceipt: { findMany: jest.fn().mockResolvedValue([]) },
      productionRunCostSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new ProductionRunCostAggregationService(prisma, { findActivePolicyForWarehouse: jest.fn().mockResolvedValue({ currencyCode: 'USD' }) } as any);
  });

  it('A: loads only the authoritative flag and passes the actual relation into real totals', async () => {
    const result = await service.validateClosePreconditions('run-1', ctx);
    expect(result.finalGoodQuantity.toFixed(4)).toBe('5.0000');
    expect(result.currencyCode).toBe('USD');
    expect(result.finalProductId).toBe('product-1');
    expect(prisma.productionOutputEvent.findMany).toHaveBeenCalledWith({
      where: { productionRunId: 'run-1', companyId: 'company-a', branchId: 'branch-a' },
      include: { measurementPoint: { select: { isAuthoritativeFinal: true } } },
    });
  });

  it.each([
    ['B: non-authoritative FINAL_OUTPUT', { measurementPoint: { isAuthoritativeFinal: false } }],
    ['C: null relation despite a point ID', { measurementPoint: null }],
    ['C: missing relation despite a point ID', { measurementPoint: undefined }],
    ['D: INTERMEDIATE at an authoritative point', { classification: 'INTERMEDIATE' }],
  ])('%s remains zeroOutput', async (_name, overrides) => {
    prisma.productionOutputEvent.findMany.mockResolvedValue([event(overrides)]);
    const error = await service.validateClosePreconditions('run-1', ctx).catch(value => value);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ messageKey: 'productionRunCostAggregation.zeroOutput' }));
    expect(prisma.productionRunCostSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it('E: authoritative production output retains existing correction netting', async () => {
    prisma.productionOutputEvent.findMany.mockResolvedValue([
      event(), event({ id: 'correction-1', eventType: 'CORRECTION', correctsEventId: 'output-1', quantity: '2', goodQuantity: '2' }),
    ]);
    expect((await service.validateClosePreconditions('run-1', ctx)).finalGoodQuantity.toFixed(4)).toBe('3.0000');
  });

  it('F: only authoritative FINAL_OUTPUT contributes among mixed events', async () => {
    prisma.productionOutputEvent.findMany.mockResolvedValue([
      event(), event({ id: 'output-2', quantity: '7', goodQuantity: '7' }),
      event({ id: 'not-authoritative', quantity: '100', goodQuantity: '100', measurementPoint: { isAuthoritativeFinal: false } }),
      event({ id: 'intermediate', classification: 'INTERMEDIATE', quantity: '200', goodQuantity: '200' }),
      event({ id: 'missing', quantity: '300', goodQuantity: '300', measurementPoint: null }),
    ]);
    expect((await service.validateClosePreconditions('run-1', ctx)).finalGoodQuantity.toFixed(4)).toBe('12.0000');
  });

  it('fully corrected authoritative output still fails zeroOutput', async () => {
    prisma.productionOutputEvent.findMany.mockResolvedValue([
      event(), event({ id: 'correction-all', eventType: 'CORRECTION', correctsEventId: 'output-1', quantity: '5', goodQuantity: '5' }),
    ]);
    await expect(service.validateClosePreconditions('run-1', ctx)).rejects.toMatchObject({ response: expect.objectContaining({ messageKey: 'productionRunCostAggregation.zeroOutput' }) });
  });
});
