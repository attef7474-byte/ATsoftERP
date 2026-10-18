import { BadRequestException } from '@nestjs/common';
import { ProductionCapacityStandardsService } from './production-capacity-standards.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const rowFrom = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || `cs-${Math.random().toString(36).slice(2, 8)}`,
  code: 'PCS-000001', revision: 1, companyId: 'c1', branchId: 'b1',
  productionProductId: 'p1', productionVersionId: null, productionPackagingId: null,
  productionLineId: 'l1', machineId: null, standardRate: '100.0000', outputUnit: 'UNIT', timeBasis: 'HOUR',
  standardCycleTimeMinutes: null, setupMinutes: '0', changeoverMinutes: '0', cleaningMinutes: '0',
  startupAllowanceMinutes: '0', shutdownAllowanceMinutes: '0', targetEfficiencyPercent: '90.0000',
  expectedYieldPercent: '98.0000', sourceType: 'MEASURED', sourceReference: null, notes: null,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, status: 'DRAFT',
  supersedesId: null, lastMateriallyEditedById: 'maker', createdById: 'maker', updatedById: 'maker', deletedAt: null,
  ...overrides,
});

describe('ProductionCapacityStandardsService.createBatch', () => {
  let prisma: any;
  let model: any;
  let audit: any;
  let numbering: any;
  let service: ProductionCapacityStandardsService;
  let txOptions: any;
  let seq: number;

  beforeEach(() => {
    seq = 0;
    txOptions = undefined;
    model = { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
    model.create.mockImplementation(({ data }: any) => Promise.resolve(rowFrom({ id: `created-${++seq}`, ...data })));
    prisma = {
      productionCapacityStandard: model,
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      productionVersion: { findFirst: jest.fn() },
      productionPackaging: { findFirst: jest.fn() },
      productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'l1' }) },
      machine: { findFirst: jest.fn() },
      productionEligibility: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: any, opts: any) => { txOptions = opts; return fn(prisma); }),
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn().mockResolvedValue({}) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('PCS-000001'),
      generateNumberAtomicWithClient: jest.fn().mockImplementation(() => Promise.resolve(`PCS-${String(++seq).padStart(6, '0')}`)),
    };
    service = new ProductionCapacityStandardsService(prisma, audit, numbering);
  });

  const shared = {
    productionProductId: 'p1',
    standardRate: '100.0000', outputUnit: 'UNIT', timeBasis: 'HOUR',
    setupMinutes: '5', changeoverMinutes: '7', cleaningMinutes: '0', startupAllowanceMinutes: '0', shutdownAllowanceMinutes: '0',
    targetEfficiencyPercent: '90.0000', expectedYieldPercent: '98.0000', sourceType: 'MEASURED',
    effectiveFrom: '2026-01-01T00:00:00Z',
  };
  const machineBatch = (machineIds: string[], extra: Record<string, any> = {}) =>
    ({ ...shared, scope: 'MACHINE', productionLineId: 'l1', machineIds, ...extra } as any);
  const lineBatch = (lineIds: string[], extra: Record<string, any> = {}) =>
    ({ ...shared, scope: 'LINE', lineIds, ...extra } as any);

  it('C1 creates exactly one tenant-owned draft row for a single machine target', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm1' });
    const result = await service.createBatch(machineBatch(['m1']), 'maker', ctxA);
    expect(result.count).toBe(1);
    expect(model.create).toHaveBeenCalledTimes(1);
    const data = model.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ status: 'DRAFT', companyId: 'c1', branchId: 'b1', machineId: 'm1', productionLineId: 'l1', code: 'PCS-000001' }));
  });

  it('C2 creates one independent row per machine and ignores client tenant fields', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    const result = await service.createBatch(machineBatch(['m1', 'm2', 'm3'], { companyId: 'evil', branchId: 'evil' }), 'maker', ctxA);
    expect(result.count).toBe(3);
    const machineIds = model.create.mock.calls.map((c: any) => c[0].data.machineId);
    expect(machineIds).toEqual(['m1', 'm2', 'm3']);
    for (const call of model.create.mock.calls) {
      expect(call[0].data.companyId).toBe('c1');
      expect(call[0].data.branchId).toBe('b1');
    }
  });

  it('C3 creates one line-scoped row per selected line with a null machineId', async () => {
    const result = await service.createBatch(lineBatch(['l1', 'l2']), 'maker', ctxA);
    expect(result.count).toBe(2);
    const rows = model.create.mock.calls.map((c: any) => c[0].data);
    expect(rows.map((r: any) => r.productionLineId)).toEqual(['l1', 'l2']);
    expect(rows.every((r: any) => r.machineId === null)).toBe(true);
  });

  it('C4 applies shared defaults (rate, efficiency, yield, setup, changeover) to every row', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    for (const call of model.create.mock.calls) {
      const data = call[0].data;
      expect(String(data.standardRate)).toBe('100');
      expect(String(data.setupMinutes)).toBe('5');
      expect(String(data.changeoverMinutes)).toBe('7');
      expect(String(data.targetEfficiencyPercent)).toBe('90');
      expect(String(data.expectedYieldPercent)).toBe('98');
    }
  });

  it('C5 honours a per-target override without disturbing other targets', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1', 'm2'], { overrides: [{ targetId: 'm2', standardRate: '55.0000', targetEfficiencyPercent: '80.0000' }] }), 'maker', ctxA);
    const byMachine: Record<string, any> = {};
    for (const call of model.create.mock.calls) byMachine[call[0].data.machineId] = call[0].data;
    expect(String(byMachine.m1.standardRate)).toBe('100');
    expect(String(byMachine.m1.targetEfficiencyPercent)).toBe('90');
    expect(String(byMachine.m2.standardRate)).toBe('55');
    expect(String(byMachine.m2.targetEfficiencyPercent)).toBe('80');
  });

  it('C6 deduplicates repeated target ids so a repeated id yields a single row', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    const result = await service.createBatch(machineBatch(['m1', 'm1', 'm2']), 'maker', ctxA);
    expect(result.count).toBe(2);
    expect(model.create.mock.calls.map((c: any) => c[0].data.machineId)).toEqual(['m1', 'm2']);
  });

  it('C7 rolls back the whole request when any target is invalid (0 rows written)', async () => {
    prisma.machine.findFirst.mockResolvedValueOnce({ id: 'm1' }).mockResolvedValueOnce(null);
    await expect(service.createBatch(machineBatch(['m1', 'm-bad']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('C7b rejects a duplicate override for the same target before any write', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await expect(service.createBatch(machineBatch(['m1'], { overrides: [{ targetId: 'm1', standardRate: '1' }, { targetId: 'm1', standardRate: '2' }] }), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('C8 rejects a target line that is not active in the current company/branch', async () => {
    prisma.productionLine.findFirst.mockResolvedValue(null);
    await expect(service.createBatch(machineBatch(['m1']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionLine.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', id: 'l1' }) }));
    expect(model.create).not.toHaveBeenCalled();
  });

  it('C8b rejects a machine that does not belong to the selected line in the current context', async () => {
    prisma.machine.findFirst.mockResolvedValue(null);
    await expect(service.createBatch(machineBatch(['m1']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.machine.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', productionLineId: 'l1' }) }));
  });

  it('C9 rejects packaging that does not belong to the selected product', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.productionPackaging.findFirst.mockResolvedValue(null);
    await expect(service.createBatch(machineBatch(['m1'], { productionPackagingId: 'pkg-x' }), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('C10 preserves the ProductUom quantity basis (packaging id, output unit, raw rate) without conversion math', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.productionPackaging.findFirst.mockResolvedValue({ id: 'pkg1' });
    await service.createBatch(machineBatch(['m1'], { productionPackagingId: 'pkg1', outputUnit: 'PACK', standardRate: '5.0000' }), 'maker', ctxA);
    const data = model.create.mock.calls[0][0].data;
    expect(data.productionPackagingId).toBe('pkg1');
    expect(data.outputUnit).toBe('PACK');
    expect(String(data.standardRate)).toBe('5');
  });

  it('C11 keeps the canonical initial state DRAFT and never auto-approves', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    for (const call of model.create.mock.calls) expect(call[0].data.status).toBe('DRAFT');
    expect(model.update).not.toHaveBeenCalled();
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('C12 prevents duplicate canonical rows inside a request and creates no active/current standard', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    const result = await service.createBatch(machineBatch(['m1', 'm1']), 'maker', ctxA);
    expect(result.count).toBe(1);
    const created = model.create.mock.calls.map((c: any) => c[0].data);
    expect(created.filter((r: any) => r.status === 'APPROVED')).toHaveLength(0);
    expect(created.every((r: any) => r.status === 'DRAFT')).toBe(true);
  });

  it('C13 runs the whole batch in a Serializable transaction for concurrency safety', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
  });

  it('C14 writes one audit entry per created row inside the transaction', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    expect(audit.logWithClient).toHaveBeenCalledTimes(2);
    for (const call of audit.logWithClient.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ userId: 'maker', action: 'CREATE', entity: 'ProductionCapacityStandard', details: expect.objectContaining({ batch: true, companyId: 'c1', branchId: 'b1' }) }));
    }
  });

  it('C15 never mutates or deletes existing capacity standards', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    expect(model.update).not.toHaveBeenCalled();
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a scope/target mismatch and empty target sets', async () => {
    await expect(service.createBatch({ ...shared, scope: 'LINE', lineIds: ['l1'], machineIds: ['m1'] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch({ ...shared, scope: 'LINE', lineIds: [] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch({ ...shared, scope: 'MACHINE', productionLineId: 'l1', machineIds: [] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch({ ...shared, scope: 'MACHINE', machineIds: ['m1'] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('C15b scopes the created rows to the caller tenant (ctxB) never the client payload', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm' });
    await service.createBatch(machineBatch(['m1'], { companyId: 'spoof', branchId: 'spoof' }), 'maker', ctxB);
    expect(model.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ companyId: 'c2', branchId: 'b2' }));
  });
});
