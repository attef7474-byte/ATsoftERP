import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { OverheadAllocationService } from './overhead-allocation.service';
import { overheadAllocationBoundary } from '../../../common/cost-purpose/overhead-allocation-boundary';

const ctx: any = { companyId: 'company', branchId: 'branch' };
const period = { id: 'period', ...ctx, companyKey: 'company', branchKey: 'branch', status: 'CLOSED', closedAt: new Date('2026-02-01'), closedById: 'user', periodFrom: new Date('2026-01-01'), periodTo: new Date('2026-02-01') };
const header = { id: 'allocation', ...period, periodId: 'period', status: 'DRAFT', version: 1, currencyCode: 'USD', notes: 'note', clientRequestId: 'request', _count: { lines: 0, sources: 0 } };
describe('B2 service boundaries (SQL runtime proof is separate)', () => {
  let db: any, audit: any, service: OverheadAllocationService;
  beforeEach(() => {
    db = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]),
      operationalOverheadPeriodAllocation: { findFirst: jest.fn().mockResolvedValue({ ...header }), update: jest.fn().mockResolvedValue({ ...header, status: 'FINAL' }), create: jest.fn().mockResolvedValue({ ...header }) },
      operationalOverheadPeriod: { findFirst: jest.fn().mockResolvedValue({ ...period }) },
      company: { findFirst: jest.fn().mockResolvedValue({ operationalCurrencyCode: 'USD' }) },
      operationalOverheadEntry: { findMany: jest.fn().mockResolvedValue([{ id: 'source', ...ctx, status: 'FINALIZED', finalizedAt: new Date('2026-01-02'), finalizedById: 'user', incurredAt: new Date('2026-01-02'), amount: new Prisma.Decimal('100'), currencyCode: 'USD', costPurpose: 'PRODUCTION' }]) },
      productionRun: { findMany: jest.fn().mockResolvedValue([1,2,3].map(i => ({ id: 'run'+i, ...ctx, runNumber: 'RUN'+i, costCenterId: 'cc', costClosedAt: new Date('2026-01-05'), outputUnitSnapshot: 'UNIT', costSnapshot: { id: 'snap'+i, ...ctx, productionRunId: 'run'+i, finalGoodQuantity: new Prisma.Decimal('1'), currencyCode: 'USD' } }))) },
      costCenter: { findMany: jest.fn().mockResolvedValue([{ id: 'cc', code: 'CC' }]) },
      operationalOverheadAllocationLine: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
      operationalOverheadAllocationSource: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    db.$transaction = jest.fn((fn: any) => fn(db));
    audit = { logWithClient: jest.fn().mockResolvedValue({}) };
    service = new OverheadAllocationService(db, audit);
  });
  it('uses B1-identical lock identity and Serializable transaction', async () => {
    const expected = 'ATSOFT:OVERHEAD:PERIODS:' + createHash('sha256').update(JSON.stringify(['company','branch'])).digest('hex');
    expect(overheadAllocationBoundary(ctx)).toBe(expected);
    await service.calculate('allocation', {}, ctx);
    expect(db.$queryRaw.mock.calls[0][1]).toBe(expected);
    expect(db.$transaction.mock.calls[0][1].isolationLevel).toBe('Serializable');
  });
  it('stateless calculation changes neither source nor allocation/audit', async () => {
    const result = await service.calculate('allocation', {}, ctx);
    expect(result.data.map(l => l.allocatedAmount)).toEqual(['33.3334','33.3333','33.3333']);
    expect(db.operationalOverheadAllocationLine.createMany).not.toHaveBeenCalled();
    expect(db.operationalOverheadPeriodAllocation.update).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });
  it('finalizes full lines and source claims and audits inside the transaction', async () => {
    await service.finalize('allocation', 'user', ctx);
    expect(db.operationalOverheadAllocationSource.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ sourceEntryId: 'source', allocationId: 'allocation', companyKey: 'company', branchKey: 'branch' })] });
    expect(db.operationalOverheadAllocationLine.createMany.mock.calls[0][0].data).toHaveLength(3);
    expect(audit.logWithClient).toHaveBeenCalledWith(db, expect.objectContaining({ action: 'OVERHEAD_ALLOCATION_FINALIZE', entityId: 'allocation', details: expect.objectContaining({ sourceAmount: '100.0000', lineCount: 3 }) }));
  });
  it('returns FINAL idempotently without a second line set or success audit', async () => {
    db.operationalOverheadPeriodAllocation.findFirst.mockResolvedValue({ ...header, status: 'FINAL' });
    expect((await service.finalize('allocation','user',ctx)).status).toBe('FINAL');
    expect(db.operationalOverheadAllocationLine.createMany).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });
  it('cases 13–15: unrepresentable amounts fail before ALL successful writes', async () => {
    const rows = await db.operationalOverheadEntry.findMany();
    rows[0].amount = new Prisma.Decimal('0.0001');
    await expect(service.finalize('allocation','user',ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.operationalOverheadAllocationSource.createMany).not.toHaveBeenCalled();
    expect(db.operationalOverheadAllocationLine.createMany).not.toHaveBeenCalled();
    expect(db.operationalOverheadPeriodAllocation.update).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('FINALIZED');
    expect(rows[0].amount.toFixed(4)).toBe('0.0001');
  });
  it.each([-1,-2,-3,-999])('rejects failed lock %s before state reads', async result => {
    db.$queryRaw.mockResolvedValue([{ result }]);
    await expect(service.finalize('allocation','user',ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(db.operationalOverheadPeriodAllocation.findFirst).not.toHaveBeenCalled();
  });
  it.each([{},{ companyId: 'company' },{ companyId: 'x'.repeat(201), branchId: 'branch' }])('missing/over-bound context fails closed', async context => {
    await expect(service.finalize('allocation','user',context as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([{ companyId: 'foreign', branchId: 'branch' }, { companyId: 'company', branchId: 'foreign' }])('scopes foreign allocation IDs without leaking existence', async context => {
    db.operationalOverheadPeriodAllocation.findFirst.mockResolvedValue(null);
    await expect(service.findOne('allocation',context as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.operationalOverheadPeriodAllocation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'allocation', ...context, companyKey: context.companyId, branchKey: context.branchId } }));
  });
  it('rejects a closed period whose membership window has not ended', async () => {
    db.operationalOverheadPeriod.findFirst.mockResolvedValue({ ...period, periodTo: new Date('2999-01-01') });
    await expect(service.calculate('allocation',{},ctx)).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects a non-finalized source', async () => {
    (await db.operationalOverheadEntry.findMany())[0].status = 'DRAFT';
    await expect(service.finalize('allocation','user',ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(db.operationalOverheadAllocationLine.createMany).not.toHaveBeenCalled();
  });
  it('rejects a foreign/inactive/deleted destination, with no fallback', async () => {
    db.costCenter.findMany.mockResolvedValue([]);
    await expect(service.calculate('allocation',{},ctx)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects foreign snapshot scope', async () => {
    (await db.productionRun.findMany())[0].costSnapshot.companyId = 'foreign';
    await expect(service.calculate('allocation',{},ctx)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects currency drift', async () => {
    db.company.findFirst.mockResolvedValue({ operationalCurrencyCode: 'YER' });
    await expect(service.finalize('allocation','user',ctx)).rejects.toBeInstanceOf(ConflictException);
  });
  it('FINAL notes and calculation are immutable', async () => {
    db.operationalOverheadPeriodAllocation.findFirst.mockResolvedValue({ ...header, status: 'FINAL' });
    await expect(service.update('allocation',{notes:'change'},'user',ctx)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.calculate('allocation',{},ctx)).rejects.toBeInstanceOf(ConflictException);
  });
  it('propagates audit failure instead of claiming a successful transaction', async () => {
    audit.logWithClient.mockRejectedValue(new Error('audit unavailable'));
    await expect(service.finalize('allocation','user',ctx)).rejects.toThrow('audit unavailable');
  });
  it('keeps source/target predicates tenant-scoped and half-open', async () => {
    await service.calculate('allocation',{},ctx);
    expect(db.productionRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ...ctx, deletedAt: null, costClosedAt: { gte: period.periodFrom, lt: period.periodTo } } }));
    expect(db.operationalOverheadEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ...ctx, companyKey:'company',branchKey:'branch',periodId:'period',deletedAt:null } }));
  });
});
