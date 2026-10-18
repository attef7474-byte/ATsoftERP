import { BadRequestException } from '@nestjs/common';
import { ProductionMeasurementPointsService } from './production-measurement-points.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const baseDto = {
  machineIds: ['m1', 'm2'],
  productionLineId: 'l1',
  productionUnitId: 'u1',
  name: 'Output counter',
  role: 'FINAL_OUTPUT',
  source: 'MANUAL',
  unit: 'UNIT',
  effectiveFrom: '2026-03-01T00:00:00.000Z',
};

const point = (overrides: Record<string, any> = {}) => ({
  id: 'mp1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'MP-000001',
  name: 'Output counter',
  description: null,
  productionLineId: 'l1',
  machineId: 'm1',
  machineComponentId: null,
  productionUnitId: 'u1',
  role: 'FINAL_OUTPUT',
  source: 'MANUAL',
  unit: 'UNIT',
  isAuthoritativeFinal: false,
  counterModulus: null,
  effectiveFrom: new Date('2026-03-01T00:00:00.000Z'),
  effectiveTo: null,
  status: 'DRAFT',
  createdById: 'u1',
  updatedById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionMeasurementPointsService.createBatch', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionMeasurementPointsService;

  beforeEach(() => {
    prisma = {
      productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'l1' }) },
      machine: { findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: where.id })) },
      machineComponent: { findFirst: jest.fn() },
      productionUnit: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }) },
      productionMeasurementPoint: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(point({ id: `mp-${data.machineId}`, machineId: data.machineId, code: data.code }))),
      },
      $transaction: jest.fn((fn: any, _opts?: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined), logWithClient: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('MP-000001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('MP-000001'),
    };
    service = new ProductionMeasurementPointsService(prisma, audit, numbering);
  });

  it('creates one measurement point per unique machine (deduplicated)', async () => {
    const result = await service.createBatch({ ...baseDto, machineIds: ['m1', 'm1', 'm2'] } as any, 'u1', ctxA);

    expect(prisma.productionMeasurementPoint.create).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it('applies the shared line, unit, role, source, unit-of-measure and effective window to each row', async () => {
    await service.createBatch({ ...baseDto } as any, 'u1', ctxA);

    const calls = prisma.productionMeasurementPoint.create.mock.calls;
    for (const call of calls) {
      expect(call[0].data).toMatchObject({
        productionLineId: 'l1',
        productionUnitId: 'u1',
        role: 'FINAL_OUTPUT',
        source: 'MANUAL',
        unit: 'UNIT',
        status: 'DRAFT',
        companyId: 'c1',
        branchId: 'b1',
        isAuthoritativeFinal: false,
      });
      expect(call[0].data.effectiveFrom).toEqual(new Date('2026-03-01T00:00:00.000Z'));
    }
  });

  it('generates a distinct code per row and audits each created row with batch:true', async () => {
    numbering.generateNumberAtomicWithClient
      .mockResolvedValueOnce('MP-000010')
      .mockResolvedValueOnce('MP-000011');

    await service.createBatch({ ...baseDto } as any, 'u1', ctxA);

    expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledTimes(2);
    expect(prisma.productionMeasurementPoint.create.mock.calls[0][0].data.code).toBe('MP-000010');
    expect(prisma.productionMeasurementPoint.create.mock.calls[1][0].data.code).toBe('MP-000011');
    expect(audit.logWithClient).toHaveBeenCalledTimes(2);
    for (const call of audit.logWithClient.mock.calls) {
      expect(call[1]).toMatchObject({ action: 'CREATE', entity: 'ProductionMeasurementPoint', details: { batch: true, companyId: 'c1', branchId: 'b1' } });
    }
  });

  it('rejects an empty machine selection', async () => {
    await expect(service.createBatch({ ...baseDto, machineIds: [] } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects a machine that does not belong to the requested line (no partial writes)', async () => {
    prisma.machine.findFirst.mockImplementation(({ where }: any) => Promise.resolve(where.id === 'm1' ? { id: 'm1' } : null));

    await expect(service.createBatch({ ...baseDto } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive or cross-tenant line', async () => {
    prisma.productionLine.findFirst.mockResolvedValue(null);

    await expect(service.createBatch({ ...baseDto } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive or cross-tenant unit', async () => {
    prisma.productionUnit.findFirst.mockResolvedValue(null);

    await expect(service.createBatch({ ...baseDto } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects machineComponentId when more than one machine is selected', async () => {
    await expect(service.createBatch({ ...baseDto, machineComponentId: 'mc1' } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects an authoritative final-output flag when more than one machine is selected', async () => {
    await expect(service.createBatch({ ...baseDto, isAuthoritativeFinal: true } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('allows machineComponentId for a single machine and persists it', async () => {
    prisma.machineComponent.findFirst.mockResolvedValue({ id: 'mc1', machineId: 'm1' });

    const result = await service.createBatch({ ...baseDto, machineIds: ['m1'], machineComponentId: 'mc1' } as any, 'u1', ctxA);

    expect(result.count).toBe(1);
    expect(prisma.productionMeasurementPoint.create.mock.calls[0][0].data.machineComponentId).toBe('mc1');
  });

  it('rejects a component that does not belong to the selected machine', async () => {
    prisma.machineComponent.findFirst.mockResolvedValue(null);

    await expect(service.createBatch({ ...baseDto, machineIds: ['m1'], machineComponentId: 'mc9' } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('requires a counter modulus when the source is COUNTER', async () => {
    await expect(service.createBatch({ ...baseDto, source: 'COUNTER' } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects a non-positive counter modulus', async () => {
    await expect(service.createBatch({ ...baseDto, source: 'COUNTER', counterModulus: '0' } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('rejects an effective window that ends before it starts', async () => {
    await expect(service.createBatch({ ...baseDto, effectiveFrom: '2026-03-10T00:00:00.000Z', effectiveTo: '2026-03-01T00:00:00.000Z' } as any, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionMeasurementPoint.create).not.toHaveBeenCalled();
  });

  it('runs the batch at Serializable isolation', async () => {
    await service.createBatch({ ...baseDto } as any, 'u1', ctxA);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('scopes every created row to the active tenant (company B context)', async () => {
    await service.createBatch({ ...baseDto, machineIds: ['m9'] } as any, 'u2', ctxB);

    expect(prisma.productionMeasurementPoint.create.mock.calls[0][0].data).toMatchObject({ companyId: 'c2', branchId: 'b2' });
    expect(prisma.productionLine.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }) }));
  });
});
