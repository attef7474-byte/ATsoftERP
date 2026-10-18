import { BadRequestException } from '@nestjs/common';
import { ProductionPerformanceTargetsService } from './production-performance-targets.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const rowFrom = (overrides: Record<string, any> = {}) => ({
  id: overrides.id || `pt-${Math.random().toString(36).slice(2, 8)}`,
  code: 'PPT-000001', revision: 1, companyId: 'c1', branchId: 'b1',
  scopeType: 'MACHINE', productionUnitId: null, productionLineId: null, machineId: 'm1', productionProductDefinitionId: null,
  availabilityTarget: '95.0000', performanceTarget: '95.0000', qualityTarget: '98.0000', oeeTarget: '85.0000',
  effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, approvalNote: null, notes: null,
  status: 'DRAFT', supersedesId: null, createdById: 'maker', updatedById: 'maker', deletedAt: null,
  ...overrides,
});

describe('ProductionPerformanceTargetsService.createBatch', () => {
  let prisma: any;
  let model: any;
  let audit: any;
  let numbering: any;
  let service: ProductionPerformanceTargetsService;
  let txOptions: any;
  let seq: number;

  beforeEach(() => {
    seq = 0;
    txOptions = undefined;
    model = { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
    model.create.mockImplementation(({ data }: any) => Promise.resolve(rowFrom({ id: `created-${++seq}`, ...data })));
    prisma = {
      productionPerformanceTarget: model,
      productionUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }) },
      productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'l1' }) },
      machine: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      $transaction: jest.fn((fn: any, opts: any) => { txOptions = opts; return fn(prisma); }),
    };
    audit = { log: jest.fn().mockResolvedValue({}), logWithClient: jest.fn().mockResolvedValue({}) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('PPT-000001'),
      generateNumberAtomicWithClient: jest.fn().mockImplementation(() => Promise.resolve(`PPT-${String(++seq).padStart(6, '0')}`)),
    };
    service = new ProductionPerformanceTargetsService(prisma, audit, numbering);
  });

  const shared = {
    availabilityTarget: '95', performanceTarget: '95', qualityTarget: '98', oeeTarget: '85',
    effectiveFrom: '2026-01-01T00:00:00Z',
  };
  const machineBatch = (machineIds: string[], extra: Record<string, any> = {}) =>
    ({ ...shared, scopeType: 'MACHINE', targets: machineIds.map((id) => ({ machineId: id })), ...extra } as any);
  const lineBatch = (lineIds: string[], extra: Record<string, any> = {}) =>
    ({ ...shared, scopeType: 'LINE', targets: lineIds.map((id) => ({ productionLineId: id })), ...extra } as any);
  const productBatch = (productIds: string[], extra: Record<string, any> = {}) =>
    ({ ...shared, scopeType: 'PRODUCT', targets: productIds.map((id) => ({ productionProductDefinitionId: id })), ...extra } as any);
  const unitBatch = (unitIds: string[], extra: Record<string, any> = {}) =>
    ({ ...shared, scopeType: 'UNIT', targets: unitIds.map((id) => ({ productionUnitId: id })), ...extra } as any);

  it('PT1 creates exactly one tenant-owned draft row for a single machine target', async () => {
    const result = await service.createBatch(machineBatch(['m1']), 'maker', ctxA);
    expect(result).toHaveLength(1);
    expect(model.create).toHaveBeenCalledTimes(1);
    const data = model.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ status: 'DRAFT', companyId: 'c1', branchId: 'b1', machineId: 'm1', scopeType: 'MACHINE', code: 'PPT-000001' }));
  });

  it('PT2 creates one independent row per selected machine', async () => {
    const result = await service.createBatch(machineBatch(['m1', 'm2', 'm3']), 'maker', ctxA);
    expect(result).toHaveLength(3);
    expect(model.create.mock.calls.map((c: any) => c[0].data.machineId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('PT3 creates one line-scoped row per selected line', async () => {
    const result = await service.createBatch(lineBatch(['l1', 'l2']), 'maker', ctxA);
    expect(result).toHaveLength(2);
    const rows = model.create.mock.calls.map((c: any) => c[0].data);
    expect(rows.map((r: any) => r.productionLineId)).toEqual(['l1', 'l2']);
    expect(rows.every((r: any) => r.scopeType === 'LINE')).toBe(true);
  });

  it('PT4 creates one product-scoped row per selected product', async () => {
    const result = await service.createBatch(productBatch(['p1', 'p2']), 'maker', ctxA);
    expect(result).toHaveLength(2);
    expect(model.create.mock.calls.map((c: any) => c[0].data.productionProductDefinitionId)).toEqual(['p1', 'p2']);
  });

  it('PT4b creates one unit-scoped row per selected unit', async () => {
    const result = await service.createBatch(unitBatch(['u1', 'u2']), 'maker', ctxA);
    expect(result).toHaveLength(2);
    expect(model.create.mock.calls.map((c: any) => c[0].data.productionUnitId)).toEqual(['u1', 'u2']);
  });

  it('PT5 rejects duplicate targets inside one request before any write', async () => {
    await expect(service.createBatch(machineBatch(['m1', 'm1']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch(machineBatch(['m1', 'm1']), 'maker', ctxA)).rejects.toMatchObject({ response: { errors: [expect.objectContaining({ code: 'performanceTarget.duplicateTargetInRequest' })] } });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('PT6 aborts the whole batch when any target is invalid (0 rows written)', async () => {
    prisma.machine.findFirst.mockResolvedValueOnce({ id: 'm1' }).mockResolvedValueOnce(null);
    await expect(service.createBatch(machineBatch(['m1', 'm-bad']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('PT7 rejects a target that is not active in the current company/branch (cross-context)', async () => {
    prisma.machine.findFirst.mockResolvedValue(null);
    await expect(service.createBatch(machineBatch(['m1']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.machine.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', id: 'm1' }) }));
    expect(model.create).not.toHaveBeenCalled();
  });

  it('PT7b scopes created rows to the caller tenant (ctxB) never the client payload', async () => {
    await service.createBatch(machineBatch(['m1'], { companyId: 'spoof', branchId: 'spoof' }), 'maker', ctxB);
    expect(model.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ companyId: 'c2', branchId: 'b2' }));
  });

  it('PT8 copies the shared target values and effective period onto every row', async () => {
    await service.createBatch(machineBatch(['m1', 'm2'], { effectiveTo: '2026-12-31T00:00:00Z', notes: 'shared-note' }), 'maker', ctxA);
    for (const call of model.create.mock.calls) {
      const data = call[0].data;
      expect(String(data.availabilityTarget)).toBe('95');
      expect(String(data.performanceTarget)).toBe('95');
      expect(String(data.qualityTarget)).toBe('98');
      expect(String(data.oeeTarget)).toBe('85');
      expect(data.effectiveFrom.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(data.effectiveTo.toISOString()).toBe('2026-12-31T00:00:00.000Z');
      expect(data.notes).toBe('shared-note');
    }
  });

  it('PT9 keeps the canonical initial state DRAFT and never auto-submits or auto-approves', async () => {
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    for (const call of model.create.mock.calls) expect(call[0].data.status).toBe('DRAFT');
    expect(model.update).not.toHaveBeenCalled();
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('PT10 generates a unique code per created row', async () => {
    await service.createBatch(machineBatch(['m1', 'm2', 'm3']), 'maker', ctxA);
    const codes = model.create.mock.calls.map((c: any) => c[0].data.code);
    expect(new Set(codes).size).toBe(3);
    expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(3);
  });

  it('PT11 writes one CREATE audit entry per row with batch:true inside the transaction', async () => {
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    expect(audit.logWithClient).toHaveBeenCalledTimes(2);
    for (const call of audit.logWithClient.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({
        userId: 'maker', action: 'CREATE', entity: 'ProductionPerformanceTarget',
        details: expect.objectContaining({ batch: true, companyId: 'c1', branchId: 'b1' }),
      }));
    }
  });

  it('PT12 runs the whole batch in a Serializable transaction for concurrency safety', async () => {
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
  });

  it('PT13 does not run approval-time overlap guards at draft create (matches single create)', async () => {
    model.findFirst.mockResolvedValue(null);
    await service.createBatch(machineBatch(['m1']), 'maker', ctxA);
    expect(model.findFirst).not.toHaveBeenCalled();
  });

  it('PT14 concurrent duplicate safety: repeated target in the same request is caught before any write', async () => {
    await expect(service.createBatch(machineBatch(['m1', 'm2', 'm1']), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('PT15 never mutates or deletes existing targets', async () => {
    await service.createBatch(machineBatch(['m1', 'm2']), 'maker', ctxA);
    expect(model.update).not.toHaveBeenCalled();
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an empty target set and out-of-range percentages before any write', async () => {
    await expect(service.createBatch({ ...shared, scopeType: 'MACHINE', targets: [] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch(machineBatch(['m1'], { oeeTarget: '120' }), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch(machineBatch(['m1'], { availabilityTarget: '0' }), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('rejects a scope/dimension mismatch before any write', async () => {
    await expect(service.createBatch({ ...shared, scopeType: 'MACHINE', targets: [{ productionLineId: 'l1' }] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createBatch({ ...shared, scopeType: 'COMPANY', targets: [{ machineId: 'm1' }] } as any, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid effective range before any write', async () => {
    await expect(service.createBatch(machineBatch(['m1'], { effectiveTo: '2025-12-31T00:00:00Z' }), 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });
});
