import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { PreventiveScheduleDuplicateGuard } from './preventive-schedule-duplicate.guard';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1',
  scopeId: 'b1',
  companyId: 'c1',
  companyName: 'Company One',
  companyCode: 'C1',
  branchId: 'b1',
  branchName: 'Branch One',
  branchCode: 'B1',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const ownedMachine = { id: 'm1', companyId: 'c1', branchId: 'b1', code: 'M-001', name: 'Lathe', status: 'ACTIVE' };
const foreignMachine = { id: 'mF', companyId: 'c2', branchId: 'b1', code: 'X', name: 'X', status: 'ACTIVE' };

const schedule = (overrides: any = {}) => ({
  id: 's1',
  title: 'Weekly lube',
  type: 'PREVENTIVE',
  frequency: 'WEEKLY',
  intervalDays: null,
  startDate: new Date('2026-08-01'),
  endDate: null,
  status: 'ACTIVE',
  machineId: 'm1',
  machine: { id: 'm1', code: 'M-001', name: 'Lathe', status: 'ACTIVE', companyId: 'c1', branchId: 'b1' },
  request: null,
  checklistItems: [],
  ...overrides,
});

const dto = (overrides: any = {}) => ({
  machineId: 'm1',
  type: 'PREVENTIVE',
  frequency: 'MONTHLY',
  intervalDays: 30,
  startDate: '2026-08-01',
  title: 'Monthly PM',
  ...overrides,
});

async function expectConflict(promise: Promise<unknown>) {
  const error: any = await promise.then(() => null, (e) => e);
  expect(error).toBeInstanceOf(ConflictException);
  const body = error.getResponse();
  expect(body.messageKey).toBe('maintenance.preventiveScheduleDuplicateActive');
  return body;
}

describe('MaintenanceSchedulesService — duplicate prevention', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: MaintenanceSchedulesService;
  let existingActive: any;

  beforeEach(() => {
    existingActive = null;
    prisma = {
      machine: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'mF' ? foreignMachine : ownedMachine)) },
      maintenanceRequest: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      maintenanceSchedule: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(existingActive)),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new1', ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      maintenanceChecklistItem: { findMany: jest.fn() },
      maintenanceChecklistExecution: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ result: 0 }]),
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('REQ-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('REQ-0001'),
    };
    const guard = new PreventiveScheduleDuplicateGuard(prisma as PrismaService);
    service = new MaintenanceSchedulesService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
      guard,
    );
  });

  describe('create', () => {
    it('C1: creates a unique active schedule', async () => {
      const created = await service.create(dto(), 'u1', ctx);
      expect(created.id).toBe('new1');
      expect(prisma.maintenanceSchedule.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MaintenanceSchedule', 'new1', expect.anything());
    });

    it('C2: rejects an exact active duplicate with 409 and existing reference', async () => {
      existingActive = { id: 'sDup', title: 'Existing Monthly' };
      const body = await expectConflict(service.create(dto(), 'u1', ctx));
      expect(body.params.existingScheduleId).toBe('sDup');
      expect(prisma.maintenanceSchedule.create).not.toHaveBeenCalled();
    });

    it('C3: same machine but different type is allowed', async () => {
      existingActive = null; // guard finds nothing for CORRECTIVE
      const created = await service.create(dto({ type: 'CORRECTIVE' }), 'u1', ctx);
      expect(created.id).toBe('new1');
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.type).toBe('CORRECTIVE');
    });

    it('C5: same target but different frequency is allowed', async () => {
      await service.create(dto({ frequency: 'YEARLY' }), 'u1', ctx);
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.frequency).toBe('YEARLY');
      expect(where.status).toBe('ACTIVE');
    });

    it('C5b: different intervalDays within same frequency is allowed (distinct recurrence)', async () => {
      await service.create(dto({ intervalDays: 60 }), 'u1', ctx);
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.intervalDays).toBe(60);
    });

    it('C6: same semantics on a different machine (tenant) is independently allowed', async () => {
      await service.create(dto({ machineId: 'm1' }), 'u1', ctx);
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.machineId).toBe('m1');
    });

    it('C7: an inactive equivalent does not block a new active schedule', async () => {
      // findFirst (filtered to status ACTIVE) returns null because only INACTIVE exists
      existingActive = null;
      const created = await service.create(dto(), 'u1', ctx);
      expect(created.id).toBe('new1');
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
    });

    it('T3: foreign machine cannot create a schedule', async () => {
      await expect(service.create(dto({ machineId: 'mF' }), 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('null-safe intervalDays is part of the identity predicate', async () => {
      await service.create(dto({ intervalDays: undefined }), 'u1', ctx);
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.intervalDays).toBeNull();
    });
  });

  describe('update', () => {
    it('U1: update of self without semantic change does not conflict (self excluded)', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      existingActive = null;
      await service.update('s1', { title: 'New title' }, 'u1', ctx);
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 's1' });
      expect(prisma.maintenanceSchedule.update).toHaveBeenCalled();
    });

    it('U2: update into a collision with another active schedule returns 409', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ id: 's1', frequency: 'WEEKLY' }));
      existingActive = { id: 's2', title: 'Other' };
      const body = await expectConflict(service.update('s1', { frequency: 'MONTHLY', intervalDays: 30 }, 'u1', ctx));
      expect(body.params.existingScheduleId).toBe('s2');
    });

    it('U3: update of description only is allowed', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      existingActive = null;
      await service.update('s1', { description: 'updated' }, 'u1', ctx);
      expect(prisma.maintenanceSchedule.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { description: 'updated' } });
    });

    it('U5: no partial mutation occurs after a duplicate rejection', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ id: 's1' }));
      existingActive = { id: 's2', title: 'Other' };
      await expectConflict(service.update('s1', { title: 'x' }, 'u1', ctx));
      expect(prisma.maintenanceSchedule.update).not.toHaveBeenCalled();
    });

    it('U-inactive: editing an inactive schedule does not run the active guard', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ status: 'INACTIVE' }));
      await service.update('s1', { title: 'x' }, 'u1', ctx);
      expect(prisma.maintenanceSchedule.findFirst).not.toHaveBeenCalled();
      expect(prisma.maintenanceSchedule.update).toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('R1: reactivates when no equivalent active row exists', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ status: 'INACTIVE' }));
      existingActive = null;
      await service.activate('s1', 'u1', ctx);
      const where = prisma.maintenanceSchedule.findFirst.mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 's1' });
      expect(where.status).toBe('ACTIVE');
      expect(prisma.maintenanceSchedule.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'ACTIVE' } });
    });

    it('R2: reactivation colliding with an equivalent active row returns 409', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ id: 's1', status: 'INACTIVE' }));
      existingActive = { id: 's9', title: 'Active twin' };
      const body = await expectConflict(service.activate('s1', 'u1', ctx));
      expect(body.params.existingScheduleId).toBe('s9');
      expect(prisma.maintenanceSchedule.update).not.toHaveBeenCalled();
    });

    it('R3: reactivation audit records the transition', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ status: 'INACTIVE' }));
      existingActive = null;
      await service.activate('s1', 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'ACTIVATE', 'MaintenanceSchedule', 's1', { oldStatus: 'INACTIVE', newStatus: 'ACTIVE' });
    });
  });

  describe('acquireLock', () => {
    it('throws 409 when the application lock cannot be acquired (concurrent equivalent write)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ result: -1 }]);
      await expectConflict(service.create(dto(), 'u1', ctx));
      expect(prisma.maintenanceSchedule.create).not.toHaveBeenCalled();
    });
  });
});
