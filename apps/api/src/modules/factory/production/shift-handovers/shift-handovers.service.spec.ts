import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShiftHandoversService } from './shift-handovers.service';

describe('ShiftHandoversService', () => {
  let prisma: any;
  let auditService: any;
  let notificationsService: any;
  let service: ShiftHandoversService;

  const ctx = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as any;

  const shiftA = { id: 'shift-a', companyId: 'company-a', code: 'S1', name: 'Morning' };
  const shiftB = { id: 'shift-b', companyId: 'company-a', code: 'S2', name: 'Evening' };

  beforeEach(() => {
      prisma = {
      productionShift: { findFirst: jest.fn() },
      operationalPerson: { findUnique: jest.fn() },
      operationalPersonAssignment: { findFirst: jest.fn(), findUnique: jest.fn() },
      supervisorAssignment: { findFirst: jest.fn() },
      productionOrder: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      maintenanceRequest: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      downtimeLog: { count: jest.fn().mockResolvedValue(0) },
      maintenanceSchedule: { count: jest.fn().mockResolvedValue(0) },
      branch: { findFirst: jest.fn() },
      department: { findFirst: jest.fn() },
      machine: { findFirst: jest.fn() },
      sparePart: { findFirst: jest.fn() },
      productionNonconformance: { findFirst: jest.fn() },
      shiftHandover: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      shiftHandoverItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { log: jest.fn() };
    notificationsService = { dispatch: jest.fn() };
    service = new ShiftHandoversService(prisma, auditService, notificationsService);

    prisma.productionShift.findFirst.mockImplementation((args: any) => {
      if (args.where.id === 'shift-a') return Promise.resolve(shiftA);
      if (args.where.id === 'shift-b') return Promise.resolve(shiftB);
      return Promise.resolve(null);
    });
  });

  const baseDto = () => ({
    handoverDate: '2025-08-17',
    outgoingShiftId: 'shift-a',
    incomingShiftId: 'shift-b',
  });

  describe('create', () => {
    it('rejects when outgoing and incoming shifts are the same', async () => {
      const promise = service.create({ ...baseDto(), incomingShiftId: 'shift-a' } as any, 'user-1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
    });

    it('creates handover with DRAFT status and audit', async () => {
      prisma.shiftHandover.create.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });

      const result = await service.create(baseDto() as any, 'user-1', ctx);

      expect(prisma.shiftHandover.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'ShiftHandover', userId: 'user-1' }),
      );
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('findAll', () => {
    it('returns paginated results scoped to company', async () => {
      prisma.shiftHandover.findMany.mockResolvedValue([]);
      prisma.shiftHandover.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);

      expect(prisma.shiftHandover.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing', ctx)).rejects.toThrow(NotFoundException);
    });

    it('returns handover when found', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });
      const result = await service.findOne('ho1', ctx);
      expect(result.id).toBe('ho1');
    });
  });

  describe('same-company cross-branch isolation', () => {
    it('findAll restricts to the active branch plus shared null-branch records', async () => {
      prisma.shiftHandover.findMany.mockResolvedValue([]);
      prisma.shiftHandover.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);

      const call = prisma.shiftHandover.findMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ companyId: 'company-a', branchId: { in: ['branch-a', null] } });
    });

    it('findOne restricts to the active branch plus shared null-branch records', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue(null);

      const promise = service.findOne('ho-other-branch', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);

      const call = prisma.shiftHandover.findFirst.mock.calls[0][0];
      expect(call.where).toMatchObject({ branchId: { in: ['branch-a', null] } });
    });
  });

  describe('submit', () => {
    it('rejects submit when status is not DRAFT', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.submit('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('transitions DRAFT to SUBMITTED with audit', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', incomingPersonId: null });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });

      const result = await service.submit('ho1', 'user-1', ctx);

      expect(prisma.shiftHandover.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMIT', entity: 'ShiftHandover' }),
      );
    });
  });

  describe('acknowledge', () => {
    it('rejects acknowledge when status is not SUBMITTED', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });
      await expect(service.acknowledge('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('transitions SUBMITTED to ACKNOWLEDGED with audit', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED', outgoingPersonId: null });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'ACKNOWLEDGED' });

      const result = await service.acknowledge('ho1', 'user-1', ctx);

      expect(prisma.shiftHandover.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACKNOWLEDGED' }) }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ACKNOWLEDGE', entity: 'ShiftHandover' }),
      );
    });
  });

  describe('remove', () => {
    it('rejects delete when status is not DRAFT', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.remove('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('soft-deletes DRAFT handover with audit', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', deletedAt: new Date() });

      const result = await service.remove('ho1', 'user-1', ctx);

      expect(prisma.shiftHandover.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entity: 'ShiftHandover' }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('addItem', () => {
    it('rejects adding items to non-DRAFT handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.addItem('ho1', { category: 'MACHINE', entityType: 'MACHINE', entityId: 'm1' } as any, 'user-1', ctx))
        .rejects.toThrow(BadRequestException);
    });

    it('validates entity type and creates item with audit', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });
      prisma.machine.findFirst.mockResolvedValue({ id: 'm1', code: 'M-1' });
      prisma.shiftHandoverItem.create.mockResolvedValue({ id: 'item1', category: 'MACHINE' });

      const result = await service.addItem('ho1', { category: 'MACHINE', entityType: 'MACHINE', entityId: 'm1' } as any, 'user-1', ctx);

      expect(prisma.shiftHandoverItem.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'ShiftHandoverItem' }),
      );
      expect(result.category).toBe('MACHINE');
    });

    it('rejects invalid entity type', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });
      await expect(service.addItem('ho1', { category: 'OTHER', entityType: 'INVALID', entityId: 'x' } as any, 'user-1', ctx))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('removeItem', () => {
    it('throws NotFoundException when item not found', async () => {
      prisma.shiftHandoverItem.findFirst.mockResolvedValue(null);
      await expect(service.removeItem('item1', 'user-1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects removing items from non-DRAFT handover', async () => {
      prisma.shiftHandoverItem.findFirst.mockResolvedValue({ id: 'item1', shiftHandoverId: 'ho1', handover: { id: 'ho1', status: 'SUBMITTED' } });
      await expect(service.removeItem('item1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('soft-deletes item from DRAFT handover with audit', async () => {
      prisma.shiftHandoverItem.findFirst.mockResolvedValue({ id: 'item1', shiftHandoverId: 'ho1', handover: { id: 'ho1', status: 'DRAFT' } });
      prisma.shiftHandoverItem.update.mockResolvedValue({ id: 'item1', deletedAt: new Date() });

      const result = await service.removeItem('item1', 'user-1', ctx);

      expect(prisma.shiftHandoverItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entity: 'ShiftHandoverItem' }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('listItems', () => {
    it('returns items scoped to company', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });
      prisma.shiftHandoverItem.findMany.mockResolvedValue([{ id: 'i1' }, { id: 'i2' }]);

      const result = await service.listItems('ho1', ctx);

      expect(prisma.shiftHandoverItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('tenant isolation', () => {
    it('findOne does not return handovers from other companies', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue(null);
      await expect(service.findOne('other-company-ho', ctx)).rejects.toThrow(NotFoundException);

      expect(prisma.shiftHandover.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a' }) }),
      );
    });
  });

  describe('SNAPSHOT IMMUTABILITY', () => {
    it('snapshot fields are frozen after creation and not exposed in UpdateShiftHandoverDto', async () => {
      const handover = {
        id: 'ho1', status: 'DRAFT',
        activeProductionOrders: 5, openMaintenanceRequests: 3,
        stoppedMachines: 2, pendingMaintenance: 1,
        notes: 'original',
      };
      prisma.shiftHandover.findFirst.mockResolvedValue(handover);
      prisma.shiftHandover.update.mockResolvedValue({ ...handover, notes: 'updated' });

      await service.update('ho1', { notes: 'updated' } as any, 'user-1', ctx);

      const updateCall = prisma.shiftHandover.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('activeProductionOrders');
      expect(updateCall.data).not.toHaveProperty('openMaintenanceRequests');
      expect(updateCall.data).not.toHaveProperty('stoppedMachines');
      expect(updateCall.data).not.toHaveProperty('pendingMaintenance');
      expect(updateCall.data).toHaveProperty('notes', 'updated');
    });

    it('create sets snapshot values from live counts', async () => {
      prisma.productionOrder.count.mockResolvedValue(5);
      prisma.maintenanceRequest.count.mockResolvedValue(3);
      prisma.downtimeLog.count.mockResolvedValue(2);
      prisma.maintenanceSchedule.count.mockResolvedValue(1);
      prisma.shiftHandover.create.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });

      await service.create(baseDto() as any, 'user-1', ctx);

      expect(prisma.shiftHandover.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeProductionOrders: 5,
            openMaintenanceRequests: 3,
            stoppedMachines: 2,
            pendingMaintenance: 1,
          }),
        }),
      );
    });

    it('stores 0 when there are zero active production orders', async () => {
      prisma.productionOrder.count.mockResolvedValue(0);
      prisma.maintenanceRequest.count.mockResolvedValue(0);
      prisma.downtimeLog.count.mockResolvedValue(0);
      prisma.maintenanceSchedule.count.mockResolvedValue(0);
      prisma.shiftHandover.create.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });

      await service.create(baseDto() as any, 'user-1', ctx);

      expect(prisma.shiftHandover.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeProductionOrders: 0,
            openMaintenanceRequests: 0,
            stoppedMachines: 0,
            pendingMaintenance: 0,
          }),
        }),
      );
    });
  });

  describe('LIFECYCLE — invalid transitions', () => {
    it('rejects DRAFT -> ACKNOWLEDGED (skipping SUBMITTED)', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', outgoingPersonId: null });
      await expect(service.acknowledge('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects SUBMITTED -> DRAFT (no downgrade path)', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.update('ho1', { notes: 'x' } as any, 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate submit (SUBMITTED -> SUBMITTED)', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.submit('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate acknowledge (ACKNOWLEDGED -> ACKNOWLEDGED)', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'ACKNOWLEDGED' });
      await expect(service.acknowledge('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });
  });

  describe('LIFECYCLE — post-SUBMITTED immutability', () => {
    it('rejects update (metadata edit) on SUBMITTED handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.update('ho1', { notes: 'x' } as any, 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects addItem on SUBMITTED handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.addItem('ho1', { category: 'MACHINE', entityType: 'MACHINE', entityId: 'm1' } as any, 'user-1', ctx))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects removeItem on SUBMITTED handover', async () => {
      prisma.shiftHandoverItem.findFirst.mockResolvedValue({
        id: 'item1', shiftHandoverId: 'ho1',
        handover: { id: 'ho1', status: 'SUBMITTED' },
      });
      await expect(service.removeItem('item1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects delete on SUBMITTED handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      await expect(service.remove('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });
  });

  describe('LIFECYCLE — post-ACKNOWLEDGED immutability', () => {
    it('rejects update on ACKNOWLEDGED handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'ACKNOWLEDGED' });
      await expect(service.update('ho1', { notes: 'x' } as any, 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects addItem on ACKNOWLEDGED handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'ACKNOWLEDGED' });
      await expect(service.addItem('ho1', { category: 'MACHINE', entityType: 'MACHINE', entityId: 'm1' } as any, 'user-1', ctx))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects delete on ACKNOWLEDGED handover', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'ACKNOWLEDGED' });
      await expect(service.remove('ho1', 'user-1', ctx)).rejects.toThrow(BadRequestException);
    });
  });

  describe('ITEM ENTITY VALIDATION — all 5 types + SparePart global catalog', () => {
    const mkHandoverDraft = () => prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT' });

    it('validates MAINTENANCE_REQUEST belongs to tenant machine', async () => {
      mkHandoverDraft();
      prisma.maintenanceRequest.findFirst.mockResolvedValue({ id: 'mr-1', requestNumber: 'MR-1' });
      prisma.shiftHandoverItem.create.mockResolvedValue({ id: 'i1' });
      await service.addItem('ho1', { category: 'MAINTENANCE_REQUEST', entityType: 'MAINTENANCE_REQUEST', entityId: 'mr-1' } as any, 'u', ctx);
      expect(prisma.maintenanceRequest.findFirst).toHaveBeenCalled();
    });

    it('validates MACHINE belongs to tenant', async () => {
      mkHandoverDraft();
      prisma.machine.findFirst.mockResolvedValue({ id: 'm-1', code: 'M-1' });
      prisma.shiftHandoverItem.create.mockResolvedValue({ id: 'i1' });
      await service.addItem('ho1', { category: 'MACHINE', entityType: 'MACHINE', entityId: 'm-1' } as any, 'u', ctx);
      expect(prisma.machine.findFirst).toHaveBeenCalled();
    });

    it('validates PRODUCTION_ORDER belongs to tenant+branch', async () => {
      mkHandoverDraft();
      prisma.productionOrder.findFirst.mockResolvedValue({ id: 'po-1', orderNumber: 'PO-1' });
      prisma.shiftHandoverItem.create.mockResolvedValue({ id: 'i1' });
      await service.addItem('ho1', { category: 'PRODUCTION_ORDER', entityType: 'PRODUCTION_ORDER', entityId: 'po-1' } as any, 'u', ctx);
      expect(prisma.productionOrder.findFirst).toHaveBeenCalled();
    });

    it('validates PRODUCTION_NONCONFORMANCE belongs to tenant+branch', async () => {
      mkHandoverDraft();
      prisma.productionNonconformance.findFirst.mockResolvedValue({ id: 'nc-1', ncrNumber: 'NCR-1' });
      prisma.shiftHandoverItem.create.mockResolvedValue({ id: 'i1' });
      await service.addItem('ho1', { category: 'QUALITY_ISSUE', entityType: 'PRODUCTION_NONCONFORMANCE', entityId: 'nc-1' } as any, 'u', ctx);
      expect(prisma.productionNonconformance.findFirst).toHaveBeenCalled();
    });

    it('validates SPARE_PART existence (global catalog — no tenant scoping)', async () => {
      mkHandoverDraft();
      prisma.sparePart.findFirst.mockResolvedValue({ id: 'sp-1', code: 'SP-1' });
      prisma.shiftHandoverItem.create.mockResolvedValue({ id: 'i1' });
      await service.addItem('ho1', { category: 'MAINTENANCE_REQUEST', entityType: 'SPARE_PART', entityId: 'sp-1' } as any, 'u', ctx);
      expect(prisma.sparePart.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sp-1' } }),
      );
    });

    it('rejects cross-company MACHINE entity', async () => {
      mkHandoverDraft();
      prisma.machine.findFirst.mockResolvedValue(null);
      await expect(
        service.addItem('ho1', { category: 'MACHINE', entityType: 'MACHINE', entityId: 'foreign-m' } as any, 'u', ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('NOTIFICATIONS', () => {
    const mkSupervisorChain = (supervisorUserId: string | null) => {
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({ id: 'opa-person', personnelId: 'op-in', companyId: 'company-a' })
        .mockResolvedValueOnce(null);
      prisma.supervisorAssignment.findFirst.mockResolvedValue({
        id: 'sa-1',
        assignmentId: 'opa-person',
        supervisorAssignmentId: 'opa-supervisor',
        isActive: true,
        status: 'ACTIVE',
      });
      prisma.operationalPersonAssignment.findUnique.mockResolvedValue({
        id: 'opa-supervisor',
        personnelId: 'op-supervisor',
      });
      prisma.operationalPerson.findUnique.mockResolvedValue(
        supervisorUserId ? { userId: supervisorUserId } : null,
      );
    };

    it('submit notifies incoming person supervisor via notification service', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', incomingPersonId: 'op-in' });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      mkSupervisorChain('user-supervisor');

      await service.submit('ho1', 'user-1', ctx);

      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-supervisor' }),
      );
    });

    it('acknowledge notifies outgoing person supervisor via notification service', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED', outgoingPersonId: 'op-out' });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'ACKNOWLEDGED' });
      prisma.operationalPersonAssignment.findFirst
        .mockResolvedValueOnce({ id: 'opa-out', personnelId: 'op-out', companyId: 'company-a' });
      prisma.supervisorAssignment.findFirst.mockResolvedValue({
        id: 'sa-2',
        assignmentId: 'opa-out',
        supervisorAssignmentId: 'opa-supervisor-out',
        isActive: true,
        status: 'ACTIVE',
      });
      prisma.operationalPersonAssignment.findUnique.mockResolvedValue({
        id: 'opa-supervisor-out',
        personnelId: 'op-supervisor-out',
      });
      prisma.operationalPerson.findUnique.mockResolvedValue({ userId: 'user-supervisor-out' });

      await service.acknowledge('ho1', 'user-1', ctx);

      expect(notificationsService.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-supervisor-out' }),
      );
    });

    it('submit does not fail when incoming person has no supervisor', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', incomingPersonId: 'op-in' });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      prisma.operationalPersonAssignment.findFirst.mockResolvedValue(null);

      const result = await service.submit('ho1', 'user-1', ctx);
      expect(result.status).toBe('SUBMITTED');
      expect(notificationsService.dispatch).not.toHaveBeenCalled();
    });

    it('submit does not fail when incoming person has no userId', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', incomingPersonId: 'op-in' });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      mkSupervisorChain(null);

      const result = await service.submit('ho1', 'user-1', ctx);
      expect(result.status).toBe('SUBMITTED');
      expect(notificationsService.dispatch).not.toHaveBeenCalled();
    });

    it('submit does not fail when no incoming person is set', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', incomingPersonId: null });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });

      const result = await service.submit('ho1', 'user-1', ctx);
      expect(result.status).toBe('SUBMITTED');
      expect(notificationsService.dispatch).not.toHaveBeenCalled();
    });

    it('does not notify the person directly when a distinct supervisor exists', async () => {
      prisma.shiftHandover.findFirst.mockResolvedValue({ id: 'ho1', status: 'DRAFT', incomingPersonId: 'op-in' });
      prisma.shiftHandover.update.mockResolvedValue({ id: 'ho1', status: 'SUBMITTED' });
      mkSupervisorChain('user-supervisor');

      await service.submit('ho1', 'user-1', ctx);

      expect(notificationsService.dispatch).toHaveBeenCalledTimes(1);
      const call = notificationsService.dispatch.mock.calls[0][0];
      expect(call.userId).toBe('user-supervisor');
      expect(call.userId).not.toBe('user-in');
    });
  });
});
