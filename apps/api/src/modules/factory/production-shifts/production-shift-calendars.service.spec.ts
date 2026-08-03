import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductionShiftCalendarsService } from './production-shift-calendars.service';
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

const calendar = (overrides: Record<string, any> = {}) => ({
  id: 'cal1',
  code: 'PSC-2026',
  name: 'Factory Calendar',
  description: null,
  templateId: null,
  companyId: 'c1',
  branchId: 'b1',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe('ProductionShiftCalendarsService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: ProductionShiftCalendarsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      productionShiftCalendar: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      productionShiftCalendarEntry: {
        createMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
      productionShiftTemplate: { findFirst: jest.fn() },
      productionShift: { findFirst: jest.fn() },
      productionShiftTemplateDay: { findUnique: jest.fn() },
      productionShiftAssignment: { count: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PSC-000001') };
    service = new ProductionShiftCalendarsService(prisma, audit, numbering);
  });

  describe('create', () => {
    it('creates a calendar scoped to the tenant', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(null);
      prisma.productionShiftCalendar.create.mockImplementation(({ data }: any) => Promise.resolve(calendar(data)));

      await service.create({ name: 'Calendar', effectiveFrom: '2026-01-01' }, 'u1', ctxA);

      expect(prisma.productionShiftCalendar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', status: 'ACTIVE' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionShiftCalendar', 'cal1', expect.anything());
    });

    it('rejects a template from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShiftTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Calendar', templateId: 'foreign-template', effectiveFrom: '2026-01-01' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects effectiveTo before effectiveFrom', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });

      await expect(
        service.create({ name: 'Calendar', effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate entry dates', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(null);
      prisma.productionShiftCalendar.create.mockImplementation(({ data }: any) => Promise.resolve(calendar(data)));

      await expect(
        service.create(
          {
            name: 'Calendar',
            effectiveFrom: '2026-01-01',
            entries: [{ date: '2026-01-05', shiftId: 's1' }, { date: '2026-01-05', shiftId: 's2' }],
          },
          'u1',
          ctxA,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('does not leak a calendar from another company (404)', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(null);

      await expect(service.findOne('cal1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  const entry = (overrides: Record<string, any> = {}) => ({
    id: 'e1',
    calendarId: 'cal1',
    date: new Date('2026-01-05T00:00:00.000Z'),
    shiftId: 's1',
    isWorkDay: true,
    notes: null,
    shift: { id: 's1', code: 'SH-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ...overrides,
  });

  describe('resolveDay', () => {
    it('returns the entry shift when an override exists', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar());
      prisma.productionShiftCalendarEntry.findUnique.mockResolvedValue(entry());

      const result = await service.resolveDay('cal1', '2026-01-05', 'u1', ctxA);
      expect(result.source).toBe('ENTRY');
      expect(result.shift?.id).toBe('s1');
      expect(audit.log).toHaveBeenCalledWith('u1', 'RESOLVE', 'ProductionShiftCalendar', 'cal1', expect.anything());
    });

    it('falls back to the template day when no entry exists', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar({ templateId: 't1' }));
      prisma.productionShiftCalendarEntry.findUnique.mockResolvedValue(null);
      prisma.productionShiftTemplateDay.findUnique.mockResolvedValue({
        id: 'd1',
        templateId: 't1',
        dayOfWeek: 1,
        shiftId: 's1',
        isWorkDay: true,
        shift: { id: 's1', code: 'SH-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      });

      const result = await service.resolveDay('cal1', '2026-01-05', 'u1', ctxA);
      expect(result.source).toBe('TEMPLATE');
      expect(result.shift?.id).toBe('s1');
    });

    it('rejects dates outside the effective range', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar({ effectiveTo: new Date('2026-03-01T00:00:00.000Z') }));

      await expect(service.resolveDay('cal1', '2026-06-01', 'u1', ctxA)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not leak resolution across companies', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(null);

      await expect(service.resolveDay('cal1', '2026-01-05', 'u1', ctxA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addEntry', () => {
    it('rejects a shift from another company', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar());
      prisma.productionShift.findFirst.mockResolvedValue(null);

      await expect(
        service.addEntry('cal1', { date: '2026-01-05', shiftId: 'foreign' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects entries outside the effective range', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar({ effectiveTo: new Date('2026-03-01T00:00:00.000Z') }));

      await expect(
        service.addEntry('cal1', { date: '2026-06-01', shiftId: 's1' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate entry dates', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar());
      prisma.productionShiftCalendarEntry.findUnique.mockResolvedValue({ id: 'e1' });

      await expect(
        service.addEntry('cal1', { date: '2026-01-05', shiftId: 's1' }, 'u1', ctxA),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates an entry for a valid date', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar());
      prisma.productionShift.findFirst.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      prisma.productionShiftCalendarEntry.findUnique.mockResolvedValue(null);
      prisma.productionShiftCalendarEntry.create.mockImplementation(({ data }: any) => Promise.resolve(entry(data)));

      const result = await service.addEntry('cal1', { date: '2026-01-05', shiftId: 's1' }, 'u1', ctxA);
      expect(result.calendarId).toBe('cal1');
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'ProductionShiftCalendarEntry', 'e1', expect.anything());
    });
  });

  describe('remove', () => {
    it('blocks deletion when referenced by shift assignments', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar());
      prisma.productionShiftAssignment.count.mockResolvedValue(1);

      await expect(service.remove('cal1', 'u1', ctxA)).rejects.toBeInstanceOf(ConflictException);
    });

    it('soft deletes an unreferenced calendar and its entries', async () => {
      prisma.productionShiftCalendar.findFirst.mockResolvedValue(calendar());
      prisma.productionShiftAssignment.count.mockResolvedValue(0);
      prisma.productionShiftCalendar.update.mockResolvedValue(calendar());

      await service.remove('cal1', 'u1', ctxA);

      expect(prisma.productionShiftCalendarEntry.deleteMany).toHaveBeenCalledWith({ where: { calendarId: 'cal1' } });
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'ProductionShiftCalendar', 'cal1');
    });
  });

  describe('findAll', () => {
    it('scopes the list query to the tenant and excludes deleted calendars', async () => {
      prisma.productionShiftCalendar.findMany.mockResolvedValue([calendar()]);
      prisma.productionShiftCalendar.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.productionShiftCalendar.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });
});
