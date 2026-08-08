import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionCapacityStandardsService } from './production-capacity-standards.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };
const record = (overrides: Record<string, any> = {}) => ({
  id: 'cs1', code: 'PCS-000001', revision: 1, companyId: 'c1', branchId: 'b1',
  productionProductId: 'p1', productionVersionId: null, productionPackagingId: null,
  productionLineId: 'l1', machineId: null, standardRate: '100.0000', outputUnit: 'UNIT', timeBasis: 'HOUR',
  standardCycleTimeMinutes: null, setupMinutes: '0', changeoverMinutes: '0', cleaningMinutes: '0',
  startupAllowanceMinutes: '0', shutdownAllowanceMinutes: '0', targetEfficiencyPercent: '90.0000',
  expectedYieldPercent: '98.0000', sourceType: 'MEASURED', sourceReference: null, notes: null,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: null, status: 'DRAFT',
  supersedesId: null, lastMateriallyEditedById: 'maker', createdById: 'maker', updatedById: 'maker', deletedAt: null,
  ...overrides,
});

describe('ProductionCapacityStandardsService', () => {
  let prisma: any;
  let model: any;
  let audit: any;
  let numbering: any;
  let service: ProductionCapacityStandardsService;

  beforeEach(() => {
    model = { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
    prisma = {
      productionCapacityStandard: model,
      productionProductDefinition: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      productionVersion: { findFirst: jest.fn() }, productionPackaging: { findFirst: jest.fn() },
      productionLine: { findFirst: jest.fn().mockResolvedValue({ id: 'l1' }) },
      machine: { findFirst: jest.fn() },
      productionEligibility: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PCS-000001') };
    service = new ProductionCapacityStandardsService(prisma, audit, numbering);
  });

  const createDto: any = {
    productionProductId: 'p1', productionLineId: 'l1', standardRate: '100.0000', outputUnit: 'UNIT', timeBasis: 'HOUR',
    setupMinutes: '0', changeoverMinutes: '0', cleaningMinutes: '0', startupAllowanceMinutes: '0', shutdownAllowanceMinutes: '0',
    targetEfficiencyPercent: '90.0000', expectedYieldPercent: '98.0000', sourceType: 'MEASURED', effectiveFrom: '2026-01-01T00:00:00Z',
  };

  it('creates a tenant-owned draft, ignores client tenant fields, and audits it', async () => {
    model.create.mockImplementation(({ data }: any) => Promise.resolve(record({ id: 'created', ...data })));
    const result = await service.create({ ...createDto, companyId: 'evil', branchId: 'evil' }, 'maker', ctxA);
    expect(result.status).toBe('DRAFT');
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', code: 'PCS-000001' }) }));
    expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('PRODUCTION_CAPACITY_STANDARD');
    expect(audit.log).toHaveBeenCalledWith('maker', 'CREATE', 'ProductionCapacityStandard', 'created', expect.objectContaining({ companyId: 'c1', branchId: 'b1' }));
  });

  it('validates percentages and effective dates with Decimal-safe rules', async () => {
    await expect(service.create({ ...createDto, targetEfficiencyPercent: '100.0001' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ ...createDto, effectiveTo: '2025-12-31T00:00:00Z' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires exact line eligibility', async () => {
    prisma.productionEligibility.findFirst.mockResolvedValue(null);
    await expect(service.create(createDto, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionEligibility.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ resourceType: 'LINE', productionLineId: 'l1' }) });
  });

  it('requires exact machine eligibility after verifying that the machine belongs to the line', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm1' });
    prisma.productionEligibility.findFirst.mockResolvedValue(null);
    await expect(service.create({ ...createDto, machineId: 'm1' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.machine.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', productionLineId: 'l1' }) });
    expect(prisma.productionEligibility.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ resourceType: 'MACHINE', machineId: 'm1' }) });
  });

  it('rejects versions and packaging that do not belong to the selected definition', async () => {
    prisma.productionVersion.findFirst.mockResolvedValue(null);
    await expect(service.create({ ...createDto, productionVersionId: 'v-other' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    prisma.productionPackaging.findFirst.mockResolvedValue(null);
    await expect(service.create({ ...createDto, productionPackagingId: 'pkg-other' }, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a production definition outside the current company and branch', async () => {
    prisma.productionProductDefinition.findFirst.mockResolvedValue(null);
    await expect(service.create(createDto, 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('scopes direct reads by company and branch and returns not found across tenants', async () => {
    model.findFirst.mockResolvedValue(null);
    await expect(service.findOne('cs1', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cs1', companyId: 'c2', branchId: 'b2' }) }));
  });

  it('enforces maker-checker approval', async () => {
    model.findFirst.mockResolvedValue(record());
    await expect(service.approve('cs1', 'maker', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows a different checker to approve and invokes audit', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce(null);
    model.update.mockResolvedValue(record({ status: 'APPROVED', approvedById: 'checker' }));
    const approved = await service.approve('cs1', 'checker', ctxA);
    expect(approved.status).toBe('APPROVED');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith('checker', 'APPROVE', 'ProductionCapacityStandard', 'cs1', expect.anything());
  });

  it('rejects overlapping approved standards on the exact business key', async () => {
    model.findFirst.mockResolvedValueOnce(record()).mockResolvedValueOnce({ id: 'overlap' });
    await expect(service.approve('cs1', 'checker', ctxA)).rejects.toBeInstanceOf(ConflictException);
    expect(model.findFirst.mock.calls[1][0].where).toEqual(expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'APPROVED', machineId: null }));
    expect(model.findFirst.mock.calls[1][0].where.effectiveFrom).toBeUndefined();
  });

  it('suspends and reactivates through dedicated state transitions', async () => {
    model.findFirst.mockResolvedValueOnce(record({ status: 'APPROVED' }));
    model.update.mockResolvedValueOnce(record({ status: 'SUSPENDED', suspensionReason: 'maintenance' }));
    expect((await service.suspend('cs1', 'maintenance', 'u2', ctxA)).status).toBe('SUSPENDED');
    model.findFirst.mockResolvedValueOnce(record({ status: 'SUSPENDED' })).mockResolvedValueOnce(null);
    model.update.mockResolvedValueOnce(record({ status: 'APPROVED' }));
    expect((await service.reactivate('cs1', 'u2', ctxA)).status).toBe('APPROVED');
  });

  it('preserves the approved record while creating a new draft revision', async () => {
    model.findFirst.mockResolvedValueOnce(record({ status: 'APPROVED' })).mockResolvedValueOnce(record({ status: 'APPROVED', revision: 1 }));
    model.create.mockImplementation(({ data }: any) => Promise.resolve(record({ id: 'rev2', ...data })));
    const revision = await service.revise('cs1', 'editor2', ctxA);
    expect(revision).toEqual(expect.objectContaining({ status: 'DRAFT', revision: 2, supersedesId: 'cs1' }));
    expect(model.update).not.toHaveBeenCalled();
  });

  it('archives the superseded revision atomically when its replacement is approved', async () => {
    model.findFirst.mockResolvedValueOnce(record({ id: 'rev2', revision: 2, supersedesId: 'cs1', lastMateriallyEditedById: 'editor2' })).mockResolvedValueOnce(null);
    model.update.mockResolvedValue(record({ id: 'rev2', revision: 2, status: 'APPROVED' }));
    await service.approve('rev2', 'checker', ctxA);
    expect(model.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'cs1' }), data: expect.objectContaining({ status: 'ARCHIVED' }) }));
  });

  it('denies cross-tenant update and archive without revealing the record', async () => {
    model.findFirst.mockResolvedValue(null);
    await expect(service.update('cs1', {}, 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.archive('cs1', 'obsolete', 'u2', ctxB)).rejects.toBeInstanceOf(NotFoundException);
    expect(model.update).not.toHaveBeenCalled();
  });

  it('resolves a machine-specific standard before a line-wide standard', async () => {
    prisma.machine.findFirst.mockResolvedValue({ id: 'm1' });
    model.findMany.mockResolvedValueOnce([record({ id: 'machine', status: 'APPROVED', machineId: 'm1' })]);
    const resolved = await service.resolve({ productionProductId: 'p1', productionLineId: 'l1', machineId: 'm1', outputUnit: 'UNIT', timeBasis: 'HOUR', requestedAt: '2026-02-01T00:00:00Z' }, ctxA);
    expect(resolved.id).toBe('machine');
    expect(resolved.matchedScope).toBe('MACHINE');
    expect(model.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to the line-wide standard and returns a canonical miss otherwise', async () => {
    model.findMany.mockResolvedValueOnce([record({ id: 'line', status: 'APPROVED' })]);
    const resolved = await service.resolve({ productionProductId: 'p1', productionLineId: 'l1', outputUnit: 'UNIT', timeBasis: 'HOUR', requestedAt: '2026-02-01T00:00:00Z' }, ctxA);
    expect(resolved.matchedScope).toBe('LINE');
    model.findMany.mockResolvedValueOnce([]);
    await expect(service.resolve({ productionProductId: 'p1', productionLineId: 'l1', outputUnit: 'UNIT', timeBasis: 'HOUR', requestedAt: '2026-02-01T00:00:00Z' }, ctxA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a machine that does not belong to the selected tenant line', async () => {
    prisma.machine.findFirst.mockResolvedValue(null);
    await expect(service.resolve({ productionProductId: 'p1', productionLineId: 'l1', machineId: 'm1', outputUnit: 'UNIT', timeBasis: 'HOUR', requestedAt: '2026-02-01T00:00:00Z' }, ctxA)).rejects.toBeInstanceOf(BadRequestException);
  });
});
