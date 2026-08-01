import { MaintenanceTasksService } from './maintenance-tasks.service';

describe('MaintenanceTasksService canonical errors', () => {
  let service: MaintenanceTasksService;
  let prisma: any;
  let audit: any;

  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  const ownedRequest = { id: 'r1', status: 'OPEN', machine: { id: 'm1', companyId: 'c1', branchId: 'b1' } };
  const foreignRequest = { id: 'r9', status: 'OPEN', machine: { id: 'm9', companyId: 'c2', branchId: 'b2' } };
  const ownedTask = (overrides: any = {}) => ({
    id: 't1',
    requestId: 'r1',
    status: 'PENDING',
    assignedToId: null,
    request: { id: 'r1', requestNumber: 'MR-1', title: 'T', status: 'OPEN', machine: { id: 'm1', companyId: 'c1', branchId: 'b1' } },
    assignedTo: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      maintenanceRequest: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      maintenanceTask: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new MaintenanceTasksService(prisma, audit);
  });

  it('cannot add tasks to a COMPLETED request', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue({ ...ownedRequest, status: 'COMPLETED' });
    await expect(
      service.create({ requestId: 'r1', title: 't' } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotAddTaskTerminalRequest' } });
  });

  it('cannot add tasks to a CANCELLED request', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue({ ...ownedRequest, status: 'CANCELLED' });
    await expect(
      service.create({ requestId: 'r1', title: 't' } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotAddTaskTerminalRequest' } });
  });

  it('only PENDING tasks can be started', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ status: 'IN_PROGRESS' }));
    await expect(service.start('t1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyPendingCanStart' } });
  });

  it('only IN_PROGRESS tasks can be completed', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ status: 'PENDING' }));
    await expect(service.complete('t1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyInProgressTaskCanComplete' } });
  });

  it('only PENDING or IN_PROGRESS tasks can be cancelled', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ status: 'DONE' }));
    await expect(service.cancel('t1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.onlyPendingInProgressCanCancelTask' } });
  });

  it('cannot delete an in-progress task', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ status: 'IN_PROGRESS' }));
    await expect(service.remove('t1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotDeleteInProgressTask' } });
  });

  it('cannot assign a DONE task', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ status: 'DONE' }));
    await expect(service.assignTask('t1', 'u9', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.cannotAssignTerminalTask' } });
  });

  it('assigned user must exist with canonical user not-found', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ status: 'PENDING' }));
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.assignTask('t1', 'u9', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'organization.userNotFound' } });
  });

  it('not found error uses canonical messageKey', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(null);
    await expect(service.findOne('t1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.taskNotFound' } });
  });

  it('cannot create a task on a request belonging to another company (tenant isolation)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(foreignRequest);
    await expect(
      service.create({ requestId: 'r9', title: 't' } as any, 'u1', ctx),
    ).rejects.toMatchObject({ response: { messageKey: 'maintenance.requestNotFound' } });
  });

  it('cannot start a task whose request belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ request: foreignRequest }));
    await expect(service.start('t1', 'u1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.taskNotFound' } });
  });

  it('cannot read a task whose request belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceTask.findUnique.mockResolvedValue(ownedTask({ request: foreignRequest }));
    await expect(service.findOne('t1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.taskNotFound' } });
  });
});
