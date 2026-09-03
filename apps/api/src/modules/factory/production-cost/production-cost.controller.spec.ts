import { ProductionCostController } from './production-cost.controller';
import { PRODUCTION_COST_PERMISSION_KEYS } from './production-cost.constants';

describe('COST-R1B ProductionCostController contract', () => {
  const postTransaction = jest.fn().mockResolvedValue({ id: 'tx-1' });
  const findLedgerEntries = jest.fn().mockResolvedValue({ data: [], meta: {} });
  const getLedgerTotals = jest.fn().mockResolvedValue({ totals: [], netTotal: '0', currencyCode: null, entryCount: 0 });
  const reconcile = jest.fn().mockResolvedValue({ meta: { readOnly: true }, decision: { status: 'ALL_CLEAN' } });

  const service = { postTransaction, findLedgerEntries, getLedgerTotals } as any;
  const reconciliation = { reconcile } as any;
  const controller = new ProductionCostController(service, reconciliation);

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

  it('COST-R1C GET /production/cost-transactions/reconciliation requires the transaction:read permission', () => {
    expect(Reflect.getMetadata('permissions', controller.reconcile)).toEqual([
      PRODUCTION_COST_PERMISSION_KEYS.transactionRead,
    ]);
  });

  it('reconcile declares the literal path (never the :id catch-all) so it cannot be shadowed', () => {
    const path = Reflect.getMetadata('path', controller.reconcile);
    expect(path).toBe('cost-transactions/reconciliation');
  });

  it('reconcile is declared before the :id route to preserve literal matching', () => {
    const paths = Reflect.getMetadata('path', controller.findOneTransaction);
    expect(paths).toBe('cost-transactions/:id');
    const reconcilePath = Reflect.getMetadata('path', controller.reconcile);
    expect(reconcilePath).toBe('cost-transactions/reconciliation');
  });

  it('reconcile forwards the query and active tenant context to the reconciliation service and returns the report', async () => {
    const query = { costPurpose: 'PRODUCTION' } as any;
    const ctx = { companyId: 'c1', branchId: 'b1' } as any;
    const result = await controller.reconcile(query, ctx);
    expect(reconcile).toHaveBeenCalledWith(query, ctx);
    expect(result).toEqual({ meta: { readOnly: true }, decision: { status: 'ALL_CLEAN' } });
  });
});
