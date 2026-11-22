import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1', scopeId: 'b1', companyId: 'c1', companyName: 'Company One', companyCode: 'C1',
  branchId: 'b1', branchName: 'Branch One', branchCode: 'B1', administrationId: null,
  administrationName: null, administrationCode: null, departmentId: null,
  departmentName: null, departmentCode: null, isDefault: true, source: 'EXPLICIT_SCOPE',
};

const ownedMachine = { id: 'm1', companyId: 'c1', branchId: 'b1' };

const schedule = (overrides: any = {}) => ({
  id: 's1', title: 'Weekly lube', type: 'PREVENTIVE', frequency: 'WEEKLY', intervalDays: null,
  startDate: new Date('2026-08-01'), endDate: null, status: 'ACTIVE', machineId: 'm1',
  machine: { id: 'm1', code: 'M-001', name: 'Lathe', status: 'ACTIVE', companyId: 'c1', branchId: 'b1' },
  request: null, checklistItems: [], ...overrides,
});

const technicianUser = {
  id: 'u1',
  operationalPeople: [{
    id: 'op1', code: 'TECH-1', name: 'Technician One',
    maintenancePersonnel: { id: 'mp1', role: 'TECHNICIAN', specialty: null, isActive: true },
    assignments: [{ department: null, jobTitle: null, branch: null }],
  }],
};

describe('MaintenanceSchedulesService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let duplicateGuard: any;
  let service: MaintenanceSchedulesService;

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      maintenanceRequest: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      maintenanceChecklistItem: {
        findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(),
        createMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
      },
      maintenanceChecklistExecution: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      user: { findFirst: jest.fn().mockResolvedValue(technicianUser) },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined), logWithClient: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('REQ-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('REQ-0001'),
    };
    duplicateGuard = {
      fingerprint: jest.fn(), acquireLock: jest.fn().mockResolvedValue(undefined),
      findEquivalentActive: jest.fn().mockResolvedValue(null),
      assertNoEquivalentActive: jest.fn().mockResolvedValue(null),
    };
    service = new MaintenanceSchedulesService(
      prisma as PrismaService, audit as AuditService, numbering as NumberingService, duplicateGuard,
    );
  });

  describe('Phase 7 — atomic schedule + checklist template create', () => {
    const dto: any = {
      machineId: 'm1', type: 'PREVENTIVE', frequency: 'WEEKLY', startDate: '2026-08-01', title: 'Weekly lube',
      checklistItems: [
        { title: 'Pressure', sortOrder: 2, resultType: 'NUMBER', minValue: 5, maxValue: 15, unit: 'bar' },
        { title: 'Leak check', sortOrder: 1, resultType: 'PASS_FAIL' },
      ],
    };

    it('creates the schedule and all checklist items in one transaction with deterministic order', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      prisma.maintenanceSchedule.create.mockResolvedValue({ id: 's1' });

      await service.create(dto, 'u1', ctx);

      expect(prisma.maintenanceSchedule.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ checklistItems: expect.anything() }),
      });
      expect(prisma.maintenanceChecklistItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ scheduleId: 's1', title: 'Leak check', sortOrder: 1, isActive: true }),
          expect.objectContaining({ scheduleId: 's1', title: 'Pressure', sortOrder: 2, isActive: true, unit: 'bar' }),
        ]),
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects a blank checklist item title before any write', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      await expect(service.create({ ...dto, checklistItems: [{ title: '   ' }] } as any, 'u1', ctx))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.maintenanceSchedule.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid result range before any write', async () => {
      prisma.machine.findUnique.mockResolvedValue(ownedMachine);
      await expect(service.create({
        ...dto, checklistItems: [{ title: 'Pressure', resultType: 'NUMBER', minValue: 20, maxValue: 10 }],
      } as any, 'u1', ctx)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.maintenanceSchedule.create).not.toHaveBeenCalled();
    });
  });

  describe('Phase 7 — atomic edit via set reconciliation', () => {
    it('updates existing items, adds new items, reorders, and soft-retires omitted items', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ checklistItems: [] }));
      prisma.maintenanceSchedule.update.mockResolvedValue({ id: 's1' });
      prisma.maintenanceChecklistItem.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      prisma.maintenanceChecklistItem.findFirst.mockImplementation(async ({ where }: any) => ({ id: where.id }));

      await service.update('s1', {
        checklistItems: [
          { id: 'b', title: 'B updated', sortOrder: 1, resultType: 'PASS_FAIL' },
          { id: 'a', title: 'A reordered', sortOrder: 2, resultType: 'PASS_FAIL' },
          { title: 'D added', sortOrder: 3, resultType: 'PASS_FAIL' },
        ],
      } as any, 'u1', ctx);

      expect(prisma.maintenanceChecklistItem.updateMany).toHaveBeenCalledWith({
        where: { scheduleId: 's1', id: { in: ['c'] } },
        data: { isActive: false },
      });
      expect(prisma.maintenanceChecklistItem.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: expect.objectContaining({ title: 'B updated', sortOrder: 1, isActive: true }),
      });
      expect(prisma.maintenanceChecklistItem.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: expect.objectContaining({ title: 'A reordered', sortOrder: 2, isActive: true }),
      });
      expect(prisma.maintenanceChecklistItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ scheduleId: 's1', title: 'D added', sortOrder: 3, isActive: true }),
      });
      expect(prisma.maintenanceChecklistItem.delete).toBeUndefined();
    });

    it('rejects an item id that belongs to another schedule', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ checklistItems: [] }));
      prisma.maintenanceSchedule.update.mockResolvedValue({ id: 's1' });
      prisma.maintenanceChecklistItem.findMany.mockResolvedValue([]);
      prisma.maintenanceChecklistItem.findFirst.mockResolvedValue(null);

      await expect(service.update('s1', {
        checklistItems: [{ id: 'foreign', title: 'Foreign', resultType: 'PASS_FAIL' }],
      } as any, 'u1', ctx)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
    });

    it('blocks execution while another execution is in progress', async () => {
      prisma.maintenanceChecklistExecution.findFirst.mockResolvedValue({ id: 'eX', status: 'IN_PROGRESS' });
      await expect(service.execute('s1', undefined, 'u1', ctx)).rejects.toThrow(ConflictException);
    });

    it('creates an execution with server-derived starter identity and snapshots', async () => {
      prisma.maintenanceChecklistExecution.findFirst.mockResolvedValue(null);
      prisma.maintenanceChecklistItem.findMany.mockResolvedValue([
        { id: 'c1', title: 'Pressure', sortOrder: 1, isMandatory: true, resultType: 'NUMBER', minValue: 5, maxValue: 15, unit: 'bar' },
      ]);
      prisma.maintenanceChecklistExecution.create.mockResolvedValue({ id: 'e1', items: [] });

      await service.execute('s1', undefined, 'u1', ctx);

      expect(prisma.maintenanceChecklistExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduleId: 's1', status: 'IN_PROGRESS', startedById: 'u1', completedById: null,
          items: { create: [expect.objectContaining({
            checklistItemId: 'c1', status: 'PENDING', itemTitleSnapshot: 'Pressure',
            resultTypeSnapshot: 'NUMBER', minValueSnapshot: 5, maxValueSnapshot: 15, unitSnapshot: 'bar',
          })] },
        }),
        include: { items: { orderBy: { itemSortOrderSnapshot: 'asc' } } },
      });
      expect(audit.log).toHaveBeenCalledWith('u1', 'EXECUTE', 'MaintenanceSchedule', 's1', expect.anything());
    });

    it('rejects execution of a schedule outside the operational context', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(
        schedule({ id: 'sX', machine: { id: 'mX', companyId: 'c2', branchId: 'b1' } }),
      );
      const promise = service.execute('sX', undefined, 'u1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const error: any = await promise.catch((e) => e);
      expect(error.getResponse().messageKey).toBe('maintenance.scheduleNotFound');
    });
  });

  describe('generateRequest', () => {
    it('rejects request generation on an inactive schedule', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ status: 'INACTIVE' }));
      await expect(service.generateRequest('s1', 'u1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('blocks generation while an active request exists', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      prisma.maintenanceRequest.findFirst.mockResolvedValue({ id: 'rX', status: 'OPEN' });
      await expect(service.generateRequest('s1', 'u1', ctx)).rejects.toThrow(ConflictException);
    });

    it('generates a request, advances the next due date and audits', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
      prisma.maintenanceRequest.create.mockResolvedValue({ id: 'r1', requestNumber: 'REQ-0001', status: 'OPEN' });

      const result = await service.generateRequest('s1', 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('MAINTENANCE_REQUEST', prisma);
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
      expect(prisma.maintenanceSchedule.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({ lastGeneratedAt: expect.any(Date), nextDueDate: expect.any(Date) }),
      });
      expect(prisma.maintenanceRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ machineId: 'm1', status: 'OPEN', requestedById: 'u1', title: 'Preventive: Weekly lube' }),
      });
      expect(audit.log).toHaveBeenCalledWith('u1', 'GENERATE', 'MaintenanceSchedule', 's1', expect.anything());
      expect(result.id).toBe('r1');
    });

    it('advances the next due date by the interval in days', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ intervalDays: 30 }));
      prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
      prisma.maintenanceRequest.create.mockResolvedValue({ id: 'r2', requestNumber: 'REQ-0002' });
      await service.generateRequest('s1', 'u1', ctx);
      const updateCall = prisma.maintenanceSchedule.update.mock.calls[0][0];
      const nextDue = (updateCall.data.nextDueDate as Date).getTime();
      expect(Math.abs(nextDue - Date.now() - 30 * 86400000)).toBeLessThan(5000);
    });
  });

  it('does not expose schedules of another company', async () => {
    prisma.maintenanceSchedule.findUnique.mockResolvedValue(
      schedule({ id: 'sX', machine: { id: 'mX', companyId: 'c2', branchId: 'b1' } }),
    );
    const promise = service.findOne('sX', ctx);
    await expect(promise).rejects.toThrow(NotFoundException);
    const error: any = await promise.catch((e) => e);
    expect(error.getResponse().messageKey).toBe('maintenance.scheduleNotFound');
  });
});
