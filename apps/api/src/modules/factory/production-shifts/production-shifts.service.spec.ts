import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionShiftsService } from './production-shifts.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const ctxA: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const ctxB: ActiveOperationalContext = {
  ...ctxA,
  contextKey: 'c2:b2:-:-',
  companyId: 'c2',
  companyName: 'Company B',
  branchId: 'b2',
  branchName: 'HQ2',
};

const shift = (overrides: Record<string, any> = {}) => ({
  id: 's1',
  code: 'SH-MORNING',
  name: 'Morning',
  description: null,
  startTime: '06:00',
  endTime: '14:00',
  durationMinutes: 480,
  breakMinutes: 30,
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionShiftsService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionShiftsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      productionShift: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      productionShiftTemplateDay: { count: jest.fn() },
      productionShiftCalendarEntry: { count: jest.fn() },
      productionShiftAssignment: { count: jest.fn() },
      productionOperationalAssignment: { count: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PS-000001') };
    service = new ProductionShiftsService(prisma, audit, numbering);
  });

  describe('create', () => {
    it('creates a shift scoped to the active tenant and ignores client tenant ids', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.productionShift.create.mockImplementation(({ data }: any) => Promise.resolve(shift(data)));

      await service.create({ name: 'Evening', startTime: '14:00', endTime: '22:00', breakMinutes: 30 }, 'u1', ctxA);

      expect(prisma.productionShift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE', durationMinutes: 480 }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionShift', 's1', expect.anything());
    });

    it('rejects a duplicate code within the same tenant', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue(shift());

      await expect(
        service.create({ code: 'SH-MORNING', name: 'Morning', startTime: '06:00', endTime: '14:00' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows the same code in another company (tenant scoped uniqueness)', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c2' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.productionShift.create.mockImplementation(({ data }: any) => Promise.resolve(shift(data)));

      await service.create({ code: 'SH-MORNING', name: 'Morning', startTime: '06:00', endTime: '14:00' }, 'u1', ctxB);

      expect(prisma.productionShift.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }) }),
      );
    });

    it('rejects an invalid HH:mm start time', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });

      await expect(
        service.create({ name: 'Bad', startTime: '25:00', endTime: '14:00' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects break minutes >= duration', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });

      await expect(
        service.create({ name: 'Bad', startTime: '06:00', endTime: '08:00', breakMinutes: 120 }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('computes duration across midnight', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);
      prisma.productionShift.create.mockImplementation(({ data }: any) => Promise.resolve(shift(data)));

      await service.create({ name: 'Night', startTime: '22:00', endTime: '06:00' }, 'u1', ctxA);

      expect(prisma.productionShift.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ durationMinutes: 480 }) }),
      );
    });
  });

  describe('findOne', () => {
    it('does not leak a shift from another company (404)', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(null);

      await expect(service.findOne('s1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a shift owned by the tenant', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(shift());
      prisma.productionShift.findUnique.mockResolvedValue(shift());

      const result = await service.findOne('s1', ctxA);
      expect(result?.id).toBe('s1');
    });
  });

  describe('update', () => {
    it('rejects a code change colliding with another shift in the tenant', async () => {
      prisma.productionShift.findFirst
        .mockResolvedValueOnce(shift())
        .mockResolvedValueOnce(shift({ id: 's2', code: 'SH-NIGHT' }));

      await expect(service.update('s1', { code: 'SH-NIGHT' }, 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recomputes duration when times change', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(shift());
      prisma.productionShift.update.mockImplementation(({ data }: any) => Promise.resolve(shift(data)));

      const result = await service.update('s1', { startTime: '08:00', endTime: '16:00' }, 'u1', ctxA);
      expect(prisma.productionShift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ durationMinutes: 480 }) }),
      );
      expect(result).toBeTruthy();
    });
  });

  describe('remove', () => {
    it('soft deletes an unreferenced shift and audits', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(shift());
      prisma.productionShiftTemplateDay.count.mockResolvedValue(0);
      prisma.productionShiftCalendarEntry.count.mockResolvedValue(0);
      prisma.productionShiftAssignment.count.mockResolvedValue(0);
      prisma.productionOperationalAssignment.count.mockResolvedValue(0);
      prisma.productionShift.update.mockResolvedValue(shift());

      await service.remove('s1', 'u1', ctxA);

      expect(prisma.productionShift.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionShift', 's1');
    });

    it('blocks deletion when the shift is referenced by an assignment', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(shift());
      prisma.productionShiftTemplateDay.count.mockResolvedValue(0);
      prisma.productionShiftCalendarEntry.count.mockResolvedValue(0);
      prisma.productionShiftAssignment.count.mockResolvedValue(2);
      prisma.productionOperationalAssignment.count.mockResolvedValue(0);

      await expect(service.remove('s1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('scopes the list query to the tenant and excludes deleted shifts', async () => {
      prisma.productionShift.findMany.mockResolvedValue([shift()]);
      prisma.productionShift.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.productionShift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });

  describe('activate/deactivate', () => {
    it('activates a shift and audits', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(shift({ status: 'INACTIVE' }));
      prisma.productionShift.update.mockResolvedValue(shift({ status: 'ACTIVE' }));

      const result = await service.activate('s1', 'u1', ctxA);
      expect(result.status).toBe('ACTIVE');
      expect(audit.log).toHaveBeenCalledWith('u1', 'ACTIVATE', 'ProductionShift', 's1');
    });

    it('deactivates a shift and audits', async () => {
      prisma.productionShift.findFirst.mockResolvedValue(shift());
      prisma.productionShift.update.mockResolvedValue(shift({ status: 'INACTIVE' }));

      const result = await service.deactivate('s1', 'u1', ctxA);
      expect(result.status).toBe('INACTIVE');
      expect(audit.log).toHaveBeenCalledWith('u1', 'DEACTIVATE', 'ProductionShift', 's1');
    });
  });
});
