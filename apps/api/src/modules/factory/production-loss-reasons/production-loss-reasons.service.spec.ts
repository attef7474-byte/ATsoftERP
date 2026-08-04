import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionLossReasonsService } from './production-loss-reasons.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const reason = (overrides: Record<string, any> = {}) => ({
  id: 'r1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'WTR',
  nameAr: 'هدر',
  nameEn: 'Waste',
  description: null,
  parentId: null,
  lossCategory: 'WASTE',
  plannedDefault: false,
  severityDefault: null,
  maintenanceRequestPolicy: 'OPTIONAL',
  effectiveFrom: new Date('2026-01-01'),
  effectiveTo: null,
  status: 'ACTIVE',
  deletedAt: null,
  ...overrides,
});

function makeService() {
  const prisma: any = {
    operationalLossReason: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    downtimeSegment: { count: jest.fn() },
    productionLossQuantityEvent: { count: jest.fn() },
  };
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const service = new ProductionLossReasonsService(prisma, audit);
  return { prisma, audit, service };
}

const createDto = (overrides: Record<string, any> = {}) => ({
  code: 'wtr',
  nameAr: 'هدر',
  nameEn: 'Waste',
  lossCategory: 'WASTE',
  maintenanceRequestPolicy: 'OPTIONAL',
  ...overrides,
});

describe('ProductionLossReasonsService', () => {
  describe('create', () => {
    it('creates a reason with tenant scope and normalized code', async () => {
      const { prisma, audit, service } = makeService();
      prisma.operationalLossReason.create.mockResolvedValue(reason());
      const result = await service.create(createDto(), 'u1', ctxA);
      const data = prisma.operationalLossReason.create.mock.calls[0][0].data;
      expect(data.companyId).toBe('c1');
      expect(data.branchId).toBe('b1');
      expect(data.code).toBe('WTR');
      expect(data.status).toBe('DRAFT');
      expect(result.code).toBe('WTR');
      expect(audit.log).toHaveBeenCalled();
    });

    it('rejects an effective range where end is not after start', async () => {
      const { service } = makeService();
      await expect(
        service.create(createDto({ effectiveFrom: '2026-02-01', effectiveTo: '2026-01-01' }), 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a parent outside the tenant', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      await expect(service.create(createDto({ parentId: 'p-x' }), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('maps a duplicate code to a conflict error', async () => {
      const { prisma, service } = makeService();
      const err = new Error('dup') as any;
      err.code = 'P2002';
      prisma.operationalLossReason.create.mockRejectedValue(err);
      await expect(service.create(createDto(), 'u1', ctxA)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll tenant isolation', () => {
    it('always scopes by company and branch', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findMany.mockResolvedValue([]);
      prisma.operationalLossReason.count.mockResolvedValue(0);
      await service.findAll({}, ctxA);
      const where = prisma.operationalLossReason.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('c1');
      expect(where.branchId).toBe('b1');
      expect(where.deletedAt).toBe(null);
    });

    it('rejects a foreign reason on findOne', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(null);
      await expect(service.findOne('r-foreign', ctxB)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects a self-parent cycle', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(reason());
      await expect(
        service.update('r1', { parentId: 'r1' } as any, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a parent cycle through an ancestor', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst
        .mockResolvedValueOnce(reason())
        .mockResolvedValueOnce(reason({ id: 'p1' }));
      prisma.operationalLossReason.findFirst
        .mockResolvedValueOnce({ id: 'p1', parentId: 'r1' });
      await expect(
        service.update('r1', { parentId: 'p1' } as any, 'u1', ctxA),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates and audits', async () => {
      const { prisma, audit, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(reason());
      prisma.operationalLossReason.update.mockResolvedValue(reason({ nameEn: 'Waste updated' }));
      const result = await service.update('r1', { nameEn: 'Waste updated' } as any, 'u1', ctxA);
      expect(result.nameEn).toBe('Waste updated');
      expect(prisma.operationalLossReason.update.mock.calls[0][0].where.id).toBe('r1');
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('activate / deactivate', () => {
    it('deactivates an active reason', async () => {
      const { prisma, audit, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(reason({ status: 'ACTIVE' }));
      prisma.operationalLossReason.update.mockResolvedValue(reason({ status: 'INACTIVE' }));
      await service.deactivate('r1', 'u1', ctxA);
      expect(prisma.operationalLossReason.update.mock.calls[0][0].data.status).toBe('INACTIVE');
      expect(audit.log).toHaveBeenCalledWith('u1', 'DEACTIVATE', expect.any(String), 'r1', expect.any(Object));
    });

    it('rejects activating when the parent is not active', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst
        .mockResolvedValueOnce(reason({ status: 'DRAFT', parentId: 'p1' }))
        .mockResolvedValueOnce(reason({ id: 'p1', status: 'INACTIVE' }));
      await expect(service.activate('r1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects re-activating an already active reason', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(reason({ status: 'ACTIVE' }));
      await expect(service.activate('r1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('refuses to delete a referenced reason', async () => {
      const { prisma, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(reason());
      prisma.downtimeSegment.count.mockResolvedValue(1);
      await expect(service.remove('r1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('soft deletes an unreferenced reason', async () => {
      const { prisma, audit, service } = makeService();
      prisma.operationalLossReason.findFirst.mockResolvedValue(reason());
      prisma.downtimeSegment.count.mockResolvedValue(0);
      prisma.productionLossQuantityEvent.count.mockResolvedValue(0);
      prisma.operationalLossReason.count.mockResolvedValue(0);
      prisma.operationalLossReason.update.mockResolvedValue(reason({ deletedAt: new Date(), status: 'INACTIVE' }));
      const result = await service.remove('r1', 'u1', ctxA);
      expect(result.deletedAt).toBeTruthy();
      expect(prisma.operationalLossReason.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
      expect(audit.log).toHaveBeenCalled();
    });
  });
});
