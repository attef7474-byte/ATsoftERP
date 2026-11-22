import { WorkOrderAssignmentsService } from './work-order-assignments.service';

describe('work order planning assignment foundation', () => {
  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  let p: any, audit: any, service: WorkOrderAssignmentsService;
  beforeEach(() => {
    p = { $queryRaw: jest.fn(), maintenanceWorkOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'wo', status: 'DRAFT' }) },
      maintenancePersonnel: { findFirst: jest.fn().mockResolvedValue({ id: 'mp' }) },
      maintenanceWorkOrderAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'a1' }), update: jest.fn().mockResolvedValue({ cancelledAt: new Date() }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    p.$transaction = jest.fn((fn: any) => fn(p)); audit = { logWithClientBusiness: jest.fn() };
    service = new WorkOrderAssignmentsService(p, audit);
  });
  it('derives tenant and actor, checks current personnel placement and audits in the transaction', async () => {
    await service.assign('wo', { maintenancePersonnelId: 'mp' }, 'actor', ctx);
    expect(p.maintenanceWorkOrder.findFirst).toHaveBeenCalledWith({ where: { id: 'wo', ...ctx, deletedAt: null } });
    expect(p.maintenancePersonnel.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'mp', isActive: true, operationalPerson: { isActive: true, assignments: { some: { ...ctx, deletedAt: null, effectiveFrom: { lte: expect.any(Date) }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: expect.any(Date) } }] } } } });
    expect(p.maintenanceWorkOrderAssignment.create).toHaveBeenCalledWith({ data: { workOrderId: 'wo', maintenancePersonnelId: 'mp', ...ctx, cancelledAt: null, assignedById: 'actor', notes: undefined } });
    expect(audit.logWithClientBusiness).toHaveBeenCalledWith(p, expect.objectContaining({ userId: 'actor', ...ctx, action: 'ASSIGN' }));
  });
  it('rejects missing or foreign order before looking up personnel', async () => {
    p.maintenanceWorkOrder.findFirst.mockResolvedValue(null);
    await expect(service.assign('foreign', { maintenancePersonnelId: 'mp' }, 'actor', ctx)).rejects.toMatchObject({ status: 404 });
    expect(p.maintenancePersonnel.findFirst).not.toHaveBeenCalled();
  });
  it('rejects personnel without active current tenant placement', async () => {
    p.maintenancePersonnel.findFirst.mockResolvedValue(null);
    await expect(service.assign('wo', { maintenancePersonnelId: 'foreign' }, 'actor', ctx)).rejects.toMatchObject({ status: 404 });
    expect(p.maintenanceWorkOrderAssignment.create).not.toHaveBeenCalled();
  });
  it.each(['COMPLETED', 'CANCELLED'])('rejects assignments on terminal %s', async status => {
    p.maintenanceWorkOrder.findFirst.mockResolvedValue({ status });
    await expect(service.assign('wo', { maintenancePersonnelId: 'mp' }, 'actor', ctx)).rejects.toMatchObject({ status: 400 });
  });
  it('prevents duplicate active assignment without deleting history', async () => {
    p.maintenanceWorkOrderAssignment.findFirst.mockResolvedValue({ id: 'old' });
    await expect(service.assign('wo', { maintenancePersonnelId: 'mp' }, 'actor', ctx)).rejects.toMatchObject({ status: 409 });
    expect(p.maintenanceWorkOrderAssignment.create).not.toHaveBeenCalled();
  });
  it('cancels only an owned relation and preserves authenticated cancellation actor', async () => {
    p.maintenanceWorkOrderAssignment.findFirst.mockResolvedValue({ id: 'a1', maintenancePersonnelId: 'mp', cancelledAt: null });
    await service.cancel('wo', 'a1', 'actor', ctx);
    expect(p.maintenanceWorkOrderAssignment.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', workOrderId: 'wo', ...ctx } });
    expect(p.maintenanceWorkOrderAssignment.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { cancelledAt: expect.any(Date), cancelledById: 'actor' } });
    expect(audit.logWithClientBusiness).toHaveBeenCalledWith(p, expect.objectContaining({ action: 'CANCEL_ASSIGNMENT', previous: { maintenancePersonnelId: 'mp', cancelledAt: null } }));
  });
  it('rejects unrelated assignment cancellation', async () => {
    await expect(service.cancel('wo', 'foreign', 'actor', ctx)).rejects.toMatchObject({ status: 404 });
  });
  it('pages scoped history without filtering cancelled rows away', async () => {
    await service.list('wo', { page: 2, limit: 10 }, ctx);
    expect(p.maintenanceWorkOrderAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workOrderId: 'wo', ...ctx }, skip: 10, take: 10 }));
  });
  it('refuses a missing operational context', async () => {
    await expect(service.list('wo', {}, {} as any)).rejects.toMatchObject({ status: 400 });
  });
});
