import { MaintenanceRequestAssignmentsService } from './maintenance-request-assignments.service';

describe('MaintenanceRequestAssignmentsService validation and audit', () => {
  let service: MaintenanceRequestAssignmentsService;
  let prisma: any;
  let audit: any;

  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  const ownedRequest = { id: 'r1', machine: { id: 'm1', companyId: 'c1', branchId: 'b1' } };
  const foreignRequest = { id: 'r9', machine: { id: 'm9', companyId: 'c2', branchId: 'b2' } };

  const personnelIncludeResult = (overrides: any = {}) => ({
    id: 'p1',
    role: 'technician',
    specialty: null,
    operationalPerson: { id: 'op1', code: 'P1', name: 'Person A', phone: null, email: null },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      maintenanceRequest: { findUnique: jest.fn() },
      maintenancePersonnel: { findUnique: jest.fn() },
      maintenanceRequestAssignment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new MaintenanceRequestAssignmentsService(prisma, audit);
  });

  it('rejects create when the maintenance request does not exist (field error)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(null);
    const promise = service.create({ maintenanceRequestId: 'r1', maintenancePersonnelId: 'p1', assignmentRole: 'technician' } as any, 'u1', ctx);
    await expect(promise).rejects.toMatchObject({
      response: {
        messageKey: 'common.validationFailed',
        errors: [{ field: 'maintenanceRequestId', code: 'validation.invalidReference' }],
      },
    });
  });

  it('rejects create when the personnel does not exist (field error)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(ownedRequest);
    prisma.maintenancePersonnel.findUnique.mockResolvedValue(null);
    const promise = service.create({ maintenanceRequestId: 'r1', maintenancePersonnelId: 'p9', assignmentRole: 'technician' } as any, 'u1', ctx);
    await expect(promise).rejects.toMatchObject({
      response: {
        messageKey: 'common.validationFailed',
        errors: [{ field: 'maintenancePersonnelId', code: 'validation.invalidReference' }],
      },
    });
  });

  it('rejects create when the request belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(foreignRequest);
    const promise = service.create({ maintenanceRequestId: 'r9', maintenancePersonnelId: 'p1', assignmentRole: 'technician' } as any, 'u1', ctx);
    await expect(promise).rejects.toMatchObject({
      response: {
        messageKey: 'common.validationFailed',
        errors: [{ field: 'maintenanceRequestId', code: 'validation.invalidReference' }],
      },
    });
  });

  it('defaults status to ACTIVE and audits CREATE', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue(ownedRequest);
    prisma.maintenancePersonnel.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.maintenanceRequestAssignment.create.mockResolvedValue({
      id: 'a1',
      maintenanceRequest: { id: 'r1', requestNumber: 'MR-1', title: 'T', status: 'OPEN' },
      maintenancePersonnel: personnelIncludeResult(),
    });
    await service.create({ maintenanceRequestId: 'r1', maintenancePersonnelId: 'p1', assignmentRole: 'technician' } as any, 'u1', ctx);
    const data = prisma.maintenanceRequestAssignment.create.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'MaintenanceRequestAssignment', 'a1', expect.objectContaining({ maintenanceRequestId: 'r1' }));
  });

  it('soft-cancels on remove and audits CANCEL', async () => {
    prisma.maintenanceRequestAssignment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
      maintenanceRequest: { id: 'r1', requestNumber: 'MR-1', title: 'T', status: 'OPEN', description: null, priority: 'MEDIUM', startDate: null, endDate: null },
      maintenancePersonnel: personnelIncludeResult(),
    });
    prisma.maintenanceRequest.findUnique.mockResolvedValue(ownedRequest);
    prisma.maintenanceRequestAssignment.update.mockResolvedValue({ id: 'a1', status: 'CANCELLED' });
    await service.remove('a1', 'u1', ctx);
    expect(prisma.maintenanceRequestAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED', cancelledAt: expect.any(Date) } }),
    );
    expect(audit.log).toHaveBeenCalledWith('u1', 'CANCEL', 'MaintenanceRequestAssignment', 'a1', expect.objectContaining({ oldStatus: 'ACTIVE', newStatus: 'CANCELLED' }));
  });

  it('audits UPDATE with old and new status', async () => {
    prisma.maintenanceRequestAssignment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
      maintenanceRequest: { id: 'r1', requestNumber: 'MR-1', title: 'T', status: 'OPEN', description: null, priority: 'MEDIUM', startDate: null, endDate: null },
      maintenancePersonnel: personnelIncludeResult(),
    });
    prisma.maintenanceRequest.findUnique.mockResolvedValue(ownedRequest);
    prisma.maintenanceRequestAssignment.update.mockResolvedValue({
      id: 'a1',
      status: 'IN_PROGRESS',
      maintenancePersonnel: personnelIncludeResult(),
    });
    await service.update('a1', { status: 'IN_PROGRESS' } as any, 'u1', ctx);
    expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'MaintenanceRequestAssignment', 'a1', expect.objectContaining({ oldStatus: 'ACTIVE', newStatus: 'IN_PROGRESS' }));
  });

  it('cannot read an assignment whose request belongs to another company (tenant isolation)', async () => {
    prisma.maintenanceRequestAssignment.findUnique.mockResolvedValue({
      id: 'a1',
      status: 'ACTIVE',
      maintenanceRequestId: 'r9',
      maintenanceRequest: { id: 'r9', requestNumber: 'MR-9', title: 'T', status: 'OPEN', description: null, priority: 'MEDIUM', startDate: null, endDate: null },
      maintenancePersonnel: personnelIncludeResult(),
    });
    prisma.maintenanceRequest.findUnique.mockResolvedValue(foreignRequest);
    await expect(service.findOne('a1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.assignmentNotFound' } });
  });

  it('not found error uses canonical messageKey', async () => {
    prisma.maintenanceRequestAssignment.findUnique.mockResolvedValue(null);
    await expect(service.findOne('a1', ctx)).rejects.toMatchObject({ response: { messageKey: 'maintenance.assignmentNotFound' } });
  });
});
