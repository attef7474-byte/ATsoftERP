import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PreventiveSparePartPlanService } from './preventive-spare-part-plan.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
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

const machine = (overrides: Record<string, any> = {}) => ({
  id: 'm1',
  companyId: 'c1',
  branchId: 'b1',
  name: 'Machine 1',
  code: 'M1',
  ...overrides,
});

const schedule = (overrides: Record<string, any> = {}) => ({
  id: 'sch1',
  machineId: 'm1',
  machine: machine(),
  ...overrides,
});

const plan = (overrides: Record<string, any> = {}) => ({
  id: 'p1',
  title: 'Plan 1',
  planNumber: 'PP-0001',
  companyId: 'c1',
  branchId: 'b1',
  machineId: 'm1',
  scheduleId: 'sch1',
  status: 'DRAFT',
  intervalDays: 30,
  quantity: 1,
  notes: null,
  machine: machine(),
  schedule: schedule(),
  items: [],
  ...overrides,
});

describe('PreventiveSparePartPlanService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: PreventiveSparePartPlanService;

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn() },
      preventiveSparePartPlan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('PP-0001') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PreventiveSparePartPlanService(
      prisma as unknown as PrismaService,
      numbering as unknown as NumberingService,
      audit as unknown as AuditService,
    );
  });

  describe('findById', () => {
    it('rejects a plan whose machine belongs to another company', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(
        plan({ machine: machine({ id: 'm-foreign', companyId: 'c2' }) }),
      );

      await expect(service.findById('p1', ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update with machineId only', () => {
    it('rejects re-pointing the plan to a foreign-company machine when only machineId is provided', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(plan());
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule());
      prisma.machine.findUnique.mockResolvedValue(machine({ id: 'm-foreign', companyId: 'c2' }));
      prisma.preventiveSparePartPlan.update.mockResolvedValue(plan());

      await expect(
        service.update('p1', { machineId: 'm-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.preventiveSparePartPlan.update).not.toHaveBeenCalled();
    });

    it('rejects re-pointing to a machine that does not match the plan schedule', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(plan());
      prisma.machine.findUnique.mockResolvedValue(machine({ id: 'm2', companyId: 'c1', branchId: 'b1' }));
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ machineId: 'm1' }));

      await expect(
        service.update('p1', { machineId: 'm2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.preventiveSparePartPlan.update).not.toHaveBeenCalled();
    });

    it('allows machineId-only update when the machine is in-context and matches the schedule', async () => {
      prisma.preventiveSparePartPlan.findUnique
        .mockResolvedValueOnce(plan())
        .mockResolvedValueOnce(plan({ machineId: 'm2', machine: machine({ id: 'm2' }) }));
      prisma.machine.findUnique.mockResolvedValue(machine({ id: 'm2', companyId: 'c1', branchId: 'b1' }));
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ machineId: 'm2' }));
      prisma.preventiveSparePartPlan.update.mockResolvedValue(plan({ machineId: 'm2' }));

      const result = await service.update('p1', { machineId: 'm2' } as any, 'u1', ctx);
      expect(result.machineId).toBe('m2');
      expect(prisma.preventiveSparePartPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ machineId: 'm2' }) }),
      );
    });
  });

  describe('update with scheduleId', () => {
    it('rejects when the schedule belongs to another company machine', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(plan());
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({ id: 'sch-foreign', machineId: 'm1' }));
      prisma.machine.findUnique.mockResolvedValue(machine({ id: 'm1', companyId: 'c2' }));

      await expect(
        service.update('p1', { scheduleId: 'sch-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.preventiveSparePartPlan.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when schedule does not exist', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(plan());
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(null);

      await expect(
        service.update('p1', { scheduleId: 'nope' } as any, 'u1', ctx),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateFromSchedule', () => {
    it('rejects a schedule whose machine belongs to another company', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(
        schedule({ id: 'sch-foreign', machineId: 'm-foreign', machine: machine({ id: 'm-foreign', companyId: 'c2' }) }),
      );

      await expect(
        service.generateFromSchedule('sch-foreign', {} as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('copyToRequest R2-D (DRAFT birth + idempotency)', () => {
    const req = (overrides: Record<string, any> = {}) => ({
      id: 'req-1',
      status: 'OPEN',
      machineId: 'm1',
      machine: machine(),
      ...overrides,
    });
    const planRecord = (overrides: Record<string, any> = {}) =>
      plan({
        items: [
          { id: 'pi1', sparePartId: 'sp1', plannedQuantity: 2, unit: 'pcs' },
          { id: 'pi2', sparePartId: 'sp2', plannedQuantity: 1, unit: 'pcs' },
        ],
        ...overrides,
      });

    beforeEach(() => {
      prisma.maintenanceRequest = { findUnique: jest.fn() };
      prisma.maintenanceRequestRequiredPart = {
        findUnique: jest.fn(),
        create: jest.fn(),
      };
      prisma.preventiveSparePartPlanItem = { update: jest.fn() };
    });

    it('creates every required part in DRAFT and links the plan items back', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(planRecord());
      prisma.maintenanceRequest.findUnique.mockResolvedValue(req());
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequestRequiredPart.create.mockResolvedValue({ id: 'rp1', status: 'DRAFT' });
      prisma.preventiveSparePartPlanItem.update.mockResolvedValue({});
      prisma.preventiveSparePartPlan.update.mockResolvedValue(planRecord({ status: 'ACTIVE' }));

      const result = await service.copyToRequest('p1', { requestId: 'req-1' } as any, 'u1', ctx);
      expect(result).toMatchObject({ success: true, createdParts: 2 });
      expect(prisma.maintenanceRequestRequiredPart.create).toHaveBeenCalledTimes(2);
      expect(prisma.maintenanceRequestRequiredPart.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT', machineId: 'm1', maintenanceRequestId: 'req-1' }),
        }),
      );
      expect(prisma.preventiveSparePartPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'COPY_TO_REQUEST', 'PreventiveSparePartPlan', 'p1',
        expect.objectContaining({ requestId: 'req-1', itemCount: 2 }));
    });

    it('skips parts already live on the request (idempotent) and reports only newly created parts', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(planRecord());
      prisma.maintenanceRequest.findUnique.mockResolvedValue(req());
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({ id: 'rp-existing', status: 'REQUESTED' });
      prisma.maintenanceRequestRequiredPart.create.mockResolvedValue({ id: 'rp1', status: 'DRAFT' });

      await expect(
        service.copyToRequest('p1', { requestId: 'req-1' } as any, 'u1', ctx),
      ).rejects.toMatchObject({ response: { message: 'maintenance.noItemsToCopy' } });
      expect(prisma.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled();
      expect(prisma.preventiveSparePartPlan.update).not.toHaveBeenCalled();
    });

    it('treats a mixed run (one P2002 race, one live duplicate) as a partial idempotent copy', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(planRecord());
      prisma.maintenanceRequest.findUnique.mockResolvedValue(req());
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequestRequiredPart.create
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ id: 'rp-sp2', status: 'DRAFT' });
      prisma.preventiveSparePartPlanItem.update.mockResolvedValue({});

      const result = await service.copyToRequest('p1', { requestId: 'req-1' } as any, 'u1', ctx);
      expect(result.createdParts).toBe(1);
    });

    it('never leaks a raw P2002 to the user when every part hits the unique race', async () => {
      prisma.preventiveSparePartPlan.findUnique.mockResolvedValue(planRecord());
      prisma.maintenanceRequest.findUnique.mockResolvedValue(req());
      prisma.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null);
      prisma.maintenanceRequestRequiredPart.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.copyToRequest('p1', { requestId: 'req-1' } as any, 'u1', ctx),
      ).rejects.toMatchObject({ response: { message: 'maintenance.noItemsToCopy' } });
      expect(prisma.preventiveSparePartPlan.update).not.toHaveBeenCalled();
    });
  });
});
