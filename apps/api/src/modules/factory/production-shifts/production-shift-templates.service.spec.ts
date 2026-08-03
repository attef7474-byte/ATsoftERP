import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionShiftTemplatesService } from './production-shift-templates.service';
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

const template = (overrides: Record<string, any> = {}) => ({
  id: 't1',
  code: 'PST-WEEKDAYS',
  name: 'Weekdays',
  description: null,
  companyId: 'c1',
  branchId: 'b1',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionShiftTemplatesService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionShiftTemplatesService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      productionShiftTemplate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      productionShiftTemplateDay: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
      productionShift: { findFirst: jest.fn() },
      productionShiftCalendar: { count: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PST-000001') };
    service = new ProductionShiftTemplatesService(prisma, audit, numbering);
  });

  describe('create', () => {
    it('creates a template with days scoped to the tenant', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(null);
      prisma.productionShiftTemplate.create.mockImplementation(({ data }: any) => Promise.resolve(template(data)));

      await service.create(
        { name: 'Weekdays', days: [{ dayOfWeek: 0, shiftId: 's1' }, { dayOfWeek: 1, shiftId: 's1', isWorkDay: false }] },
        'u1',
        ctxA,
      );

      expect(prisma.productionShiftTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE' }),
        }),
      );
      expect(prisma.productionShiftTemplateDay.createMany).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionShiftTemplate', 't1', expect.anything());
    });

    it('rejects duplicate day of week entries', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });

      await expect(
        service.create(
          { name: 'Bad', days: [{ dayOfWeek: 0, shiftId: 's1' }, { dayOfWeek: 0, shiftId: 's1' }] },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a shift from another company in template days', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShift.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Bad', days: [{ dayOfWeek: 0, shiftId: 'foreign-shift' }] }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows the same code in another company (tenant scoped uniqueness)', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c2' });
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(null);
      prisma.productionShiftTemplate.create.mockImplementation(({ data }: any) => Promise.resolve(template(data)));

      await service.create({ name: 'Weekdays', days: [{ dayOfWeek: 0, shiftId: 's1' }] }, 'u1', ctxB);

      expect(prisma.productionShiftTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }) }),
      );
    });
  });

  describe('findOne', () => {
    it('does not leak a template from another company (404)', async () => {
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('t1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('replaces days when provided', async () => {
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(template());
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.productionShiftTemplate.update.mockImplementation(({ data }: any) => Promise.resolve(template(data)));

      await service.update('t1', { days: [{ dayOfWeek: 2, shiftId: 's1' }] }, 'u1', ctxA);

      expect(prisma.productionShiftTemplateDay.deleteMany).toHaveBeenCalledWith({ where: { templateId: 't1' } });
      expect(prisma.productionShiftTemplateDay.createMany).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'ProductionShiftTemplate', 't1', expect.anything());
    });
  });

  describe('remove', () => {
    it('blocks deletion when referenced by calendars', async () => {
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(template());
      prisma.productionShiftCalendar.count.mockResolvedValue(1);

      await expect(service.remove('t1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.productionShiftTemplate.update).not.toHaveBeenCalled();
    });

    it('soft deletes an unreferenced template', async () => {
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(template());
      prisma.productionShiftCalendar.count.mockResolvedValue(0);
      prisma.productionShiftTemplate.update.mockResolvedValue(template());

      await service.remove('t1', 'u1', ctxA);

      expect(prisma.productionShiftTemplateDay.deleteMany).toHaveBeenCalledWith({ where: { templateId: 't1' } });
      expect(prisma.productionShiftTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionShiftTemplate', 't1');
    });
  });

  describe('findAll', () => {
    it('scopes the list query to the tenant and excludes deleted templates', async () => {
      prisma.productionShiftTemplate.findMany.mockResolvedValue([template()]);
      prisma.productionShiftTemplate.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.productionShiftTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });
});
