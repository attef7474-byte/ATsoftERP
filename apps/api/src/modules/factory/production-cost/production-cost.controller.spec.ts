import { ProductionCostController } from './production-cost.controller';
import { PRODUCTION_COST_PERMISSION_KEYS } from './production-cost.constants';

describe('COST-R1B ProductionCostController contract', () => {
  const postTransaction = jest.fn().mockResolvedValue({ id: 'tx-1' });
  const findLedgerEntries = jest.fn().mockResolvedValue({ data: [], meta: {} });
  const getLedgerTotals = jest.fn().mockResolvedValue({ totals: [], netTotal: '0', currencyCode: null, entryCount: 0 });

  const service = { postTransaction, findLedgerEntries, getLedgerTotals } as any;
  const controller = new ProductionCostController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /production/cost-transactions requires the transaction:post permission', () => {
    expect(Reflect.getMetadata('permissions', controller.postTransaction)).toEqual([
      PRODUCTION_COST_PERMISSION_KEYS.transactionPost,
    ]);
  });

  it('GET /production/ledger requires the transaction:read permission', () => {
    expect(Reflect.getMetadata('permissions', controller.findLedger)).toEqual([
      PRODUCTION_COST_PERMISSION_KEYS.transactionRead,
    ]);
  });

  it('GET /production/ledger/totals requires the transaction:read permission', () => {
    expect(Reflect.getMetadata('permissions', controller.getLedgerTotals)).toEqual([
      PRODUCTION_COST_PERMISSION_KEYS.transactionRead,
    ]);
  });

  it('postTransaction forwards the DTO, actor, and active tenant context to the service and returns the result', async () => {
    const dto = { clientRequestId: 'r1b-c-1' } as any;
    const ctx = { companyId: 'c1', branchId: 'b1' } as any;
    const result = await controller.postTransaction(dto, 'user-1', ctx);
    expect(postTransaction).toHaveBeenCalledWith(dto, 'user-1', ctx);
    expect(result).toEqual({ id: 'tx-1' });
  });

  it('findLedger forwards the ledger query and the active tenant context to the service and returns the result', async () => {
    const query = { costPurpose: 'PRODUCTION' } as any;
    const ctx = { companyId: 'c1', branchId: 'b1' } as any;
    const result = await controller.findLedger(query, ctx);
    expect(findLedgerEntries).toHaveBeenCalledWith(query, ctx);
    expect(result).toEqual({ data: [], meta: {} });
  });

  it('getLedgerTotals forwards the totals query and the active tenant context to the service and returns the result', async () => {
    const query = { dateFrom: '2026-02-01T00:00:00Z' } as any;
    const ctx = { companyId: 'c1', branchId: 'b1' } as any;
    const result = await controller.getLedgerTotals(query, ctx);
    expect(getLedgerTotals).toHaveBeenCalledWith(query, ctx);
    expect(result).toEqual({ totals: [], netTotal: '0', currencyCode: null, entryCount: 0 });
  });
});
