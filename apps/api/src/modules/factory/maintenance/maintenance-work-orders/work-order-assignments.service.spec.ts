import { WorkOrderAssignmentsService } from './work-order-assignments.service';

describe('work order multi-technician assignments', () => {
  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  let p: any, audit: any, technicians: any, service: WorkOrderAssignmentsService;

  beforeEach(() => {
    p = {
      $queryRaw: jest.fn(),
      maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'wo', status: 'DRAFT' }) },
      maintenanceWorkOrderAssignment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'a-new', assignedAt: new Date(), ...data })),
        update: jest.fn().mockResolvedValue({ id: 'a-ended', cancelledAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    p.$transaction = jest.fn((fn: any) => fn(p));
    audit = { logWithClientBusiness: jest.fn() };
    technicians = {
      byPersonnel: jest.fn().mockImplementation(async (id: string) =>
        ['mp1', 'mp2', 'mp3'].includes(id)
          ? { maintenancePersonnelId: id, userId: `user-${id}`, operationalPersonId: `op-${id}`, code: id, name: id, role: 'TECHNICIAN', specialty: null, placement: null }
          : null),
      candidates: jest.fn(),
      candidate: jest.fn(),
    };
    service = new WorkOrderAssignmentsService(p, audit, technicians);
  });

  it('resolves the technician canonically, derives tenant/actor and audits in the transaction', async () => {
    await service.assign('wo', { maintenancePersonnelId: 'mp1' }, 'actor', ctx);
    expect(p.maintenanceWorkOrder.findFirst).toHaveBeenCalledWith({ where: { id: 'wo', ...ctx, deletedAt: null } });
    expect(technicians.byPersonnel).toHaveBeenCalledWith('mp1', ctx, p);
    expect(p.maintenanceWorkOrderAssignment.create).toHaveBeenCalledWith({ data: { workOrderId: 'wo', maintenancePersonnelId: 'mp1', ...ctx, cancelledAt: null, assignedById: 'actor', notes: undefined } });
    expect(audit.logWithClientBusiness).toHaveBeenCalledWith(p, expect.objectContaining({ userId: 'actor', ...ctx, action: 'ASSIGN' }));
  });

  it('rejects a missing or foreign order before looking up personnel', async () => {
    p.maintenanceWorkOrder.findFirst.mockResolvedValue(null);
    await expect(service.assign('foreign', { maintenancePersonnelId: 'mp1' }, 'actor', ctx)).rejects.toMatchObject({ status: 404 });
    expect(technicians.byPersonnel).not.toHaveBeenCalled();
  });

  it('rejects personnel without an active current tenant placement', async () => {
    technicians.byPersonnel.mockResolvedValue(null);
    await expect(service.assign('wo', { maintenancePersonnelId: 'foreign' }, 'actor', ctx)).rejects.toMatchObject({ status: 404 });
    expect(p.maintenanceWorkOrderAssignment.create).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'CANCELLED'])('rejects assignments on terminal %s', async status => {
    p.maintenanceWorkOrder.findFirst.mockResolvedValue({ status });
    await expect(service.assign('wo', { maintenancePersonnelId: 'mp1' }, 'actor', ctx)).rejects.toMatchObject({ status: 400 });
  });

  it('prevents duplicate active assignments without deleting history', async () => {
    p.maintenanceWorkOrderAssignment.findFirst.mockResolvedValue({ id: 'old' });
    await expect(service.assign('wo', { maintenancePersonnelId: 'mp1' }, 'actor', ctx)).rejects.toMatchObject({ status: 409 });
    expect(p.maintenanceWorkOrderAssignment.create).not.toHaveBeenCalled();
  });

  it('cancels only an owned relation and preserves the authenticated cancellation actor', async () => {
    p.maintenanceWorkOrderAssignment.findFirst.mockResolvedValue({ id: 'a1', maintenancePersonnelId: 'mp1', cancelledAt: null });
    await service.cancel('wo', 'a1', 'actor', ctx);
    expect(p.maintenanceWorkOrderAssignment.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', workOrderId: 'wo', ...ctx } });
    expect(p.maintenanceWorkOrderAssignment.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', companyId: ctx.companyId, branchId: ctx.branchId, cancelledAt: null }, data: { cancelledAt: expect.any(Date), cancelledById: 'actor' } });
    expect(audit.logWithClientBusiness).toHaveBeenCalledWith(p, expect.objectContaining({ action: 'CANCEL_ASSIGNMENT', previous: { maintenancePersonnelId: 'mp1', cancelledAt: null } }));
  });

  it('rejects unrelated assignment cancellation', async () => {
    await expect(service.cancel('wo', 'foreign', 'actor', ctx)).rejects.toMatchObject({ status: 404 });
  });

  it('pages scoped history without filtering cancelled rows away', async () => {
    await service.list('wo', { page: 2, limit: 10 }, ctx);
    expect(p.maintenanceWorkOrderAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workOrderId: 'wo', ...ctx }, skip: 10, take: 10 }));
  });

  it('reconciles toAdd/toKeep/toEnd by ending history rows instead of deleting them', async () => {
    p.maintenanceWorkOrderAssignment.findMany.mockResolvedValue([
      { id: 'a1', maintenancePersonnelId: 'mp1', assignedAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'a2', maintenancePersonnelId: 'mp3', assignedAt: new Date('2026-01-02T00:00:00Z') },
    ]);
    const result: any = await service.reconcile('wo', { technicianPersonnelIds: ['mp1', 'mp2'] }, 'actor', ctx);
    expect(result).toMatchObject({ toAdd: ['mp2'], toKeep: ['mp1'], toEnd: ['a2'], technicianPersonnelIds: ['mp1', 'mp2'] });
    expect(p.maintenanceWorkOrderAssignment.updateMany).toHaveBeenCalledTimes(1);
    expect(p.maintenanceWorkOrderAssignment.updateMany).toHaveBeenCalledWith({ where: { id: 'a2', companyId: ctx.companyId, branchId: ctx.branchId, cancelledAt: null }, data: { cancelledAt: expect.any(Date), cancelledById: 'actor' } });
    expect(p.maintenanceWorkOrderAssignment.create).toHaveBeenCalledTimes(1);
    expect(p.maintenanceWorkOrderAssignment.create.mock.calls[0][0].data).toMatchObject({ maintenancePersonnelId: 'mp2', assignedById: 'actor' });
  });

  it('re-adding a cancelled technician creates a valid current row and keeps prior history', async () => {
    p.maintenanceWorkOrderAssignment.findMany.mockResolvedValue([]);
    const result: any = await service.reconcile('wo', { technicianPersonnelIds: ['mp1'] }, 'actor', ctx);
    expect(result.toAdd).toEqual(['mp1']);
    expect(p.maintenanceWorkOrderAssignment.create).toHaveBeenCalledTimes(1);
    expect(p.maintenanceWorkOrderAssignment.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate active rows instead of silently choosing one', async () => {
    p.maintenanceWorkOrderAssignment.findMany.mockResolvedValue([
      { id: 'a1', maintenancePersonnelId: 'mp1' },
      { id: 'a2', maintenancePersonnelId: 'mp1' },
    ]);
    await expect(service.reconcile('wo', { technicianPersonnelIds: ['mp1'] }, 'actor', ctx)).rejects.toMatchObject({ status: 409 });
    expect(p.maintenanceWorkOrderAssignment.update).not.toHaveBeenCalled();
  });

  it('rejects a candidate that does not resolve in the active tenant context', async () => {
    await expect(service.reconcile('wo', { technicianPersonnelIds: ['foreign'] }, 'actor', ctx)).rejects.toMatchObject({ status: 404 });
    expect(p.maintenanceWorkOrderAssignment.create).not.toHaveBeenCalled();
  });

  it('refuses a missing operational context', async () => {
    await expect(service.list('wo', {}, {} as any)).rejects.toMatchObject({ status: 400 });
  });
});
