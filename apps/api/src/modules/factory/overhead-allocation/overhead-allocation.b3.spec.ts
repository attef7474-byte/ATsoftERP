import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { OverheadAllocationService } from './overhead-allocation.service';
import { overheadAllocationBoundary } from '../../../common/cost-purpose/overhead-allocation-boundary';
import { OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE, OVERHEAD_EVENT_TYPE } from '../production-cost/production-cost.constants';

const ctx: any = { companyId: 'company', branchId: 'branch' };
const row = { id: 'allocation', companyId: 'company', branchId: 'branch', companyKey: 'company', branchKey: 'branch', status: 'FINAL', currencyCode: 'USD', finalizedAt: new Date('2026-02-01'), periodTo: new Date('2026-02-01'), _count: { lines: 2, sources: 1 } };
const line1 = { id: 'line1', allocationId: 'allocation', productionRunId: 'run1', destinationCostCenterId: 'cc', costPurpose: 'PRODUCTION', allocatedAmount: new Prisma.Decimal('100.0000'), currencyCode: null, companyKey: 'company', branchKey: 'branch' };
const line0 = { id: 'line0', allocationId: 'allocation', productionRunId: 'run0', destinationCostCenterId: 'cc', costPurpose: 'PRODUCTION', allocatedAmount: new Prisma.Decimal('0.0000'), currencyCode: null, companyKey: 'company', branchKey: 'branch' };
const baseEntries = { entryRole: 'PRIMARY_COST', status: 'POSTED', reversedAt: null, clientRequestId: 'overhead-allocation:allocation:line1:1:post', amount: new Prisma.Decimal('100.0000'), currencyCode: 'USD' };

describe('COST-R2D-B3 ledger posting/reversal/reconciliation matrix', () => {
  let db: any, audit: any, productionCost: any, reconciliation: any, service: OverheadAllocationService;
  beforeEach(() => {
    db = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]),
      company: { findFirst: jest.fn().mockResolvedValue({ operationalCurrencyCode: 'USD' }) },
      operationalOverheadPeriodAllocation: { findFirst: jest.fn().mockResolvedValue({ ...row }) },
      operationalOverheadAllocationLine: { findMany: jest.fn().mockResolvedValue([line1, line0]), findFirst: jest.fn().mockResolvedValue(line1) },
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    };
    db.$transaction = jest.fn((fn: any) => fn(db));
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    productionCost = {
      postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({ transaction: { id: 'entry1', currencyCode: 'USD' }, replay: false }),
      reverseLedgerEntry: jest.fn().mockResolvedValue({ transaction: { id: 'reversal1' }, updatedOriginal: { id: 'entry1', reversedAt: new Date('2026-02-02') } }),
    };
    reconciliation = { reconcileOverheadAllocation: jest.fn().mockResolvedValue({ decision: { status: 'ALL_CLEAN', reconciled: true }, counts: { lineDefectCount: 0, eligibleLineCount: 1, postedLineCount: 1 }, aggregate: {} }) };
    service = new OverheadAllocationService(db as any, audit as any, productionCost as any, reconciliation as any);
  });

  it('uses the same B1/B2 lock identity and Serializable transaction for every B3 operation', async () => {
    const expected = 'ATSOFT:OVERHEAD:PERIODS:' + createHash('sha256').update(JSON.stringify(['company','branch'])).digest('hex');
    await service.postToLedger('allocation', 'user', ctx);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.$queryRaw.mock.calls[0][1]).toBe(expected);
    expect(db.$transaction.mock.calls[0][1].isolationLevel).toBe('Serializable');
  });

  it('rejects posting a non-FINAL allocation with no writer call', async () => {
    db.operationalOverheadPeriodAllocation.findFirst.mockResolvedValue({ ...row, status: 'DRAFT' });
    await expect(service.postToLedger('allocation', 'user', ctx)).rejects.toMatchObject({ response: { messageKey: 'overheadAllocation.postingRequiresFinal' } });
    expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('rejects posting when the allocation currency drifts from the operational currency', async () => {
    db.company.findFirst.mockResolvedValue({ operationalCurrencyCode: 'SAR' });
    await expect(service.postToLedger('allocation', 'user', ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
  });

  it('posts every eligible positive line through the canonical writer with full provenance', async () => {
    db.operationalOverheadAllocationLine.findMany.mockResolvedValue([line1, { ...line0, allocatedAmount: new Prisma.Decimal('0.5000') }]);
    const result = await service.postToLedger('allocation', 'user', ctx);
    expect(productionCost.postLedgerEntryWithinTransaction).toHaveBeenCalledTimes(2);
    for (const args of productionCost.postLedgerEntryWithinTransaction.mock.calls) {
      const opts = args[1];
      expect(opts.tx).toBeUndefined();
      expect(opts.eventType).toBe(OVERHEAD_EVENT_TYPE);
      expect(opts.sourceType).toBe(OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE);
      expect(opts.sourceId).toBe('allocation');
      expect(opts.costNature).toBe('ACTUAL');
      expect(opts.entryRole).toBe('PRIMARY_COST');
      expect(opts.quantity).toBe(1);
      expect(opts.unit).toBe('AMOUNT');
      expect(opts.rate).toEqual(opts.amount);
      expect(opts.currencyCode).toBe('USD');
      expect(opts.occurredAt).toEqual(row.finalizedAt);
      expect(opts.postedAt).toBeInstanceOf(Date);
      expect(opts.requestPayloadFingerprint).toBe(`OVERHEAD|${OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE}|allocation|${opts.sourceLineId}`);
      expect(opts.sourceFingerprint).toMatch(new RegExp(`^${OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE}:allocation:${opts.sourceLineId}:OVERHEAD$`));
      expect(opts.refs).toEqual({ productionRunId: expect.anything(), costCenterId: 'cc' });
      expect(opts.createdById).toBe('user');
      expect(opts.ctx).toEqual(ctx);
    }
    expect(result).toEqual({ allocationId: 'allocation', status: 'POSTED', currencyCode: 'USD', counts: { lineCount: 2, postedCount: 2, alreadyPostedCount: 0, zeroLineCount: 0 }, lines: expect.arrayContaining([
      expect.objectContaining({ lineId: 'line1', status: 'POSTED', generation: 1, ledgerEntryId: 'entry1' }),
    ]) });
    expect(audit.logWithClient).toHaveBeenCalledWith(db, expect.objectContaining({ action: 'OVERHEAD_ALLOCATION_LEDGER_POST', entityId: 'allocation', details: expect.objectContaining({ postedCount: 2, alreadyPostedCount: 0, zeroLineCount: 0 }) }));
  });

  it('skips zero-amount lines as SKIPPED_ZERO and never writes an entry for them', async () => {
    const result = await service.postToLedger('allocation', 'user', ctx);
    expect(productionCost.postLedgerEntryWithinTransaction).toHaveBeenCalledTimes(1);
    expect(productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1].sourceLineId).toBe('line1');
    expect(result.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ lineId: 'line0', status: 'SKIPPED_ZERO' }),
    ]));
    expect(result.counts).toEqual(expect.objectContaining({ postedCount: 1, zeroLineCount: 1 }));
  });

  it('fails closed on a negative allocated line before any writer call', async () => {
    db.operationalOverheadAllocationLine.findMany.mockResolvedValue([{ ...line1, allocatedAmount: new Prisma.Decimal('-1.0000') }]);
    await expect(service.postToLedger('allocation', 'user', ctx)).rejects.toMatchObject({ response: { messageKey: 'overheadAllocation.invalidInputs' } });
    expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('reports an already-posted line idempotently without double-posting (exactly-once)', async () => {
    db.operationalCostTransaction.findMany.mockResolvedValue([{ ...baseEntries, id: 'entry1', sourceLineId: 'line1' }]);
    const result = await service.postToLedger('allocation', 'user', ctx);
    expect(productionCost.postLedgerEntryWithinTransaction).toHaveBeenCalledTimes(0);
    expect(result.counts).toEqual(expect.objectContaining({ postedCount: 0, alreadyPostedCount: 1, zeroLineCount: 1 }));
    expect(result.lines).toEqual(expect.arrayContaining([expect.objectContaining({ lineId: 'line1', status: 'ALREADY_POSTED', generation: 1, ledgerEntryId: 'entry1' })]));
    expect(audit.logWithClient).toHaveBeenCalled();
  });

  it('re-posts under a new generation after a reversal (replacement) with a fresh fingerprint identity', async () => {
    db.operationalCostTransaction.findMany.mockResolvedValue([{ ...baseEntries, id: 'entry1', sourceLineId: 'line1', reversedAt: new Date('2026-02-02'), clientRequestId: 'overhead-allocation:allocation:line1:1:post' }]);
    await service.postToLedger('allocation', 'user', ctx);
    const opts = productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1];
    expect(opts.sourceLineId).toBe('line1');
    expect(opts.clientRequestId).toBe('overhead-allocation:allocation:line1:2:post');
    expect(opts.sourceFingerprint).toBe(`${OVERHEAD_ALLOCATION_LINE_SOURCE_TYPE}:allocation:line1:OVERHEAD`);
  });

  it('rejects reversing a non-FINAL allocation', async () => {
    db.operationalOverheadPeriodAllocation.findFirst.mockResolvedValue({ ...row, status: 'DRAFT' });
    await expect(service.reverseLedger('allocation', { allocationLineId: 'line1', reason: 'correction' }, 'user', ctx)).rejects.toMatchObject({ response: { messageKey: 'overheadAllocation.postingRequiresFinal' } });
    expect(productionCost.reverseLedgerEntry).not.toHaveBeenCalled();
  });

  it('rejects reversal of a line with no active posting', async () => {
    db.operationalCostTransaction.findFirst.mockResolvedValue(null);
    await expect(service.reverseLedger('allocation', { allocationLineId: 'line1', reason: 'correction' }, 'user', ctx)).rejects.toMatchObject({ response: { messageKey: 'overheadAllocation.ledgerLineNotPosted' } });
    expect(productionCost.reverseLedgerEntry).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('rejects an unknown line id as NotFound before any writer call', async () => {
    db.operationalOverheadAllocationLine.findFirst.mockResolvedValue(null);
    await expect(service.reverseLedger('allocation', { allocationLineId: 'ghost', reason: 'x' }, 'user', ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(productionCost.reverseLedgerEntry).not.toHaveBeenCalled();
  });

  it('reverses a live posting carrying the same generation as the original and audits the reason', async () => {
    db.operationalCostTransaction.findFirst.mockResolvedValue({ ...baseEntries, id: 'entry1', sourceLineId: 'line1' });
    db.operationalCostTransaction.findMany.mockResolvedValue([{ ...baseEntries, id: 'entry1', sourceLineId: 'line1' }]);
    const result = await service.reverseLedger('allocation', { allocationLineId: 'line1', reason: 'wrong driver split' }, 'user', ctx);
    expect(productionCost.reverseLedgerEntry).toHaveBeenCalledTimes(1);
    const [tx, original, opts] = productionCost.reverseLedgerEntry.mock.calls[0];
    expect(tx).toBe(db);
    expect(original.id).toBe('entry1');
    expect(opts).toEqual(expect.objectContaining({ reason: 'wrong driver split', clientRequestId: 'overhead-allocation:allocation:line1:1:reverse', createdById: 'user', ctx }));
    expect(result).toEqual(expect.objectContaining({ allocationId: 'allocation', allocationLineId: 'line1', originalId: 'entry1', reversalId: 'reversal1', generation: 1 }));
    expect(audit.logWithClient).toHaveBeenCalledWith(db, expect.objectContaining({ action: 'OVERHEAD_ALLOCATION_LEDGER_REVERSE', entityId: 'allocation', details: expect.objectContaining({ allocationLineId: 'line1', originalId: 'entry1', reason: 'wrong driver split' }) }));
  });

  it('propagates writer double-reversal rejection without writing success audit', async () => {
    db.operationalCostTransaction.findFirst.mockResolvedValue({ ...baseEntries, id: 'entry1', sourceLineId: 'line1' });
    productionCost.reverseLedgerEntry.mockRejectedValue(new ConflictException({ messageKey: 'productionCostTransaction.alreadyReversed' }));
    await expect(service.reverseLedger('allocation', { allocationLineId: 'line1', reason: 'x' }, 'user', ctx)).rejects.toMatchObject({ response: { messageKey: 'productionCostTransaction.alreadyReversed' } });
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('returns the R1C reconciliation report unchanged and audits a reconcile action', async () => {
    const report = await service.reconciliation('allocation', 'user', ctx);
    expect(report).toEqual({ decision: { status: 'ALL_CLEAN', reconciled: true }, counts: { lineDefectCount: 0, eligibleLineCount: 1, postedLineCount: 1 }, aggregate: {} });
    expect(reconciliation.reconcileOverheadAllocation).toHaveBeenCalledWith('allocation', ctx, db);
    expect(audit.logWithClient).toHaveBeenCalledWith(db, expect.objectContaining({ action: 'OVERHEAD_ALLOCATION_LEDGER_RECONCILE', entityId: 'allocation', details: expect.objectContaining({ decision: 'ALL_CLEAN', aggregateEqual: true }) }));
  });

  it('scopes foreign allocation IDs to NotFound without leaking existence', async () => {
    db.operationalOverheadPeriodAllocation.findFirst.mockResolvedValue(null);
    await expect(service.postToLedger('allocation', 'user', ctx)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.reverseLedger('allocation', { allocationLineId: 'line1', reason: 'x' }, 'user', ctx)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.reconciliation('allocation', 'user', ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.operationalOverheadPeriodAllocation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'allocation', ...ctx, companyKey: 'company', branchKey: 'branch' } }));
  });

  it('rejects a lock conflict as overhead.concurrencyConflict with no writer call', async () => {
    db.$queryRaw.mockResolvedValue([{ result: -2 }]);
    await expect(service.postToLedger('allocation', 'user', ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
  });
});