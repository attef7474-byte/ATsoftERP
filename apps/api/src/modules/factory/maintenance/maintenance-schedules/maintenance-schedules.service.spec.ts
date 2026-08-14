import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
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

const ownedMachine = { id: 'm1', companyId: 'c1', branchId: 'b1' };

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

describe('MaintenanceSchedulesService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: MaintenanceSchedulesService;

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      maintenanceRequest: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      maintenanceChecklistItem: { findMany: jest.fn() },
      maintenanceChecklistExecution: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('REQ-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('REQ-0001'),
    };
    service = new MaintenanceSchedulesService(prisma as PrismaService, audit as AuditService, numbering as NumberingService);
  });

  describe('execute', () => {
    it('blocks execution while another execution is in progress', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      prisma.maintenanceChecklistExecution.findFirst.mockResolvedValue({ id: 'eX', status: 'IN_PROGRESS' });

      await expect(service.execute('s1', undefined, 'u1', ctx)).rejects.toThrow(ConflictException);
    });

    it('creates an execution with checklist snapshots and audits', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      prisma.maintenanceChecklistExecution.findFirst.mockResolvedValue(null);
      prisma.maintenanceChecklistItem.findMany.mockResolvedValue([
        { id: 'c1', title: 'Pressure', sortOrder: 1, isMandatory: true, resultType: 'NUMBER', minValue: 5, maxValue: 15 },
      ]);
      prisma.maintenanceChecklistExecution.create.mockResolvedValue({ id: 'e1', items: [] });

      await service.execute('s1', undefined, 'u1', ctx);

      expect(prisma.maintenanceChecklistExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduleId: 's1',
          status: 'IN_PROGRESS',
          items: {
            create: [
              expect.objectContaining({
                checklistItemId: 'c1',
                status: 'PENDING',
                itemTitleSnapshot: 'Pressure',
                resultTypeSnapshot: 'NUMBER',
                minValueSnapshot: 5,
                maxValueSnapshot: 15,
              }),
            ],
          },
        }),
        include: { items: true },
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
        data: expect.objectContaining({
          lastGeneratedAt: expect.any(Date),
          nextDueDate: expect.any(Date),
        }),
      });
      expect(prisma.maintenanceRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ machineId: 'm1', status: 'OPEN', requestedById: 'u1', title: 'Preventive: Weekly lube' }),
      });
      expect(audit.log).toHaveBeenCalledWith('u1', 'GENERATE', 'MaintenanceSchedule', 's1', expect.anything());
      expect(result.id).toBe('r1');
    });

    it('advances the next due date by the interval in days', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(
        schedule({ intervalDays: 30, machine: { id: 'm1', code: 'M-001', name: 'Lathe', status: 'ACTIVE', companyId: 'c1', branchId: 'b1' } }),
      );
      prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
      prisma.maintenanceRequest.create.mockResolvedValue({ id: 'r2', requestNumber: 'REQ-0002' });

      await service.generateRequest('s1', 'u1', ctx);
      const updateCall = prisma.maintenanceSchedule.update.mock.calls[0][0];
      const nextDue = (updateCall.data.nextDueDate as Date).getTime();
      const intervalMs = 30 * 86400000;
      expect(Math.abs(nextDue - Date.now() - intervalMs)).toBeLessThan(5000);
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
