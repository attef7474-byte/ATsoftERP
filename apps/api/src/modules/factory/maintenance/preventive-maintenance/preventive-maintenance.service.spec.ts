import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';
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

describe('PreventiveMaintenanceService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let service: PreventiveMaintenanceService;

  beforeEach(() => {
    prisma = {
      maintenanceSchedule: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      maintenanceChecklistExecution: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      maintenanceRequest: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('MR-0001') };
    service = new PreventiveMaintenanceService(prisma as PrismaService, audit as AuditService, numbering as NumberingService);
  });

  describe('getExecutionHistory', () => {
    it('scopes executions through the owning machine of the schedule', async () => {
      prisma.maintenanceChecklistExecution.findMany.mockResolvedValue([]);
      prisma.maintenanceChecklistExecution.count.mockResolvedValue(0);

      await service.getExecutionHistory({}, ctx);

      expect(prisma.maintenanceChecklistExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            schedule: {
              machine: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
            },
          },
        }),
      );
    });

    it('rejects a schedule that belongs to a foreign company', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue({
        id: 'sForeign',
        machine: { companyId: 'c2', branchId: 'b2' },
      });

      await expect(service.getExecutionHistory({ scheduleId: 'sForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('filters by scheduleId after verifying schedule access', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue({
        id: 's1',
        machine: { companyId: 'c1', branchId: 'b1' },
      });
      prisma.maintenanceChecklistExecution.findMany.mockResolvedValue([]);
      prisma.maintenanceChecklistExecution.count.mockResolvedValue(0);

      await service.getExecutionHistory({ scheduleId: 's1' }, ctx);

      const where = prisma.maintenanceChecklistExecution.findMany.mock.calls[0][0].where;
      expect(where.scheduleId).toBe('s1');
      expect(where.schedule.machine.companyId).toBe('c1');
    });
  });

  describe('getCalendar', () => {
    it('groups active schedules by start date within the month and scopes by machine', async () => {
      const day = new Date('2026-08-10T00:00:00.000Z');
      prisma.maintenanceSchedule.findMany.mockResolvedValue([
        { id: 's1', startDate: day, status: 'ACTIVE', machine: { id: 'm1', name: 'Lathe' } },
        { id: 's2', startDate: day, status: 'ACTIVE', machine: { id: 'm1', name: 'Lathe' } },
      ]);

      const result = await service.getCalendar({ year: 2026, month: 8 }, ctx);

      const where = prisma.maintenanceSchedule.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
      expect(where.machine).toEqual({ companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] });
      expect(result.total).toBe(2);
      expect(Object.keys(result.calendar)).toEqual(['2026-08-10']);
      expect(result.calendar['2026-08-10']).toHaveLength(2);
    });
  });

  describe('generateDueTasks', () => {
    it('skips schedules that already have an open or in-progress request for the machine and type', async () => {
      prisma.maintenanceSchedule.findMany.mockResolvedValue([
        { id: 's1', machineId: 'm1', type: 'PREVENTIVE', startDate: new Date('2026-07-01'), machine: { id: 'm1' } },
      ]);
      prisma.maintenanceRequest.findFirst.mockResolvedValue({ id: 'r1', status: 'OPEN' });

      const result = await service.generateDueTasks('u1', ctx);

      expect(result.created).toBe(0);
      expect(prisma.maintenanceRequest.create).not.toHaveBeenCalled();
    });
  });
});
