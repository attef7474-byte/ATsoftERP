import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { MaintenanceChecklistStartAuthorityService } from './maintenance-checklist-start-authority.service';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1', scopeId: 'b1', companyId: 'c1', companyName: 'Company One', companyCode: 'C1',
  branchId: 'b1', branchName: 'Branch One', branchCode: 'B1', administrationId: null,
  administrationName: null, administrationCode: null, departmentId: null,
  departmentName: null, departmentCode: null, isDefault: true, source: 'EXPLICIT_SCOPE',
};

const schedule = (overrides: any = {}) => ({
  id: 's1', machineId: 'm1', machine: { id: 'm1', companyId: 'c1', branchId: 'b1' }, ...overrides,
});

const technicianUser = (id = 'u1') => ({
  id,
  operationalPeople: [{
    id: 'op1', code: 'TECH-1', name: 'Technician One',
    maintenancePersonnel: { id: 'mp1', role: 'TECHNICIAN', specialty: null, isActive: true },
    assignments: [{ department: { name: 'Maintenance' }, jobTitle: null, branch: { name: 'Branch One' } }],
  }],
});

function setup(overrides: any = {}) {
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((fn: any) => fn(prisma)),
    maintenanceSchedule: { findUnique: jest.fn().mockResolvedValue(schedule()) },
    maintenanceRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    maintenanceWorkOrder: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceWorkOrderAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
    maintenanceChecklistExecution: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    maintenanceChecklistItem: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findFirst: jest.fn().mockResolvedValue(technicianUser()) },
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  prisma.maintenanceChecklistExecution.create.mockResolvedValue({ id: 'e1', items: [] });
  const audit: any = { log: jest.fn().mockResolvedValue(undefined), logWithClient: jest.fn().mockResolvedValue(undefined) };
  return { prisma, audit, service: new MaintenanceChecklistStartAuthorityService(prisma as PrismaService, audit as AuditService) };
}

describe('MaintenanceChecklistStartAuthorityService', () => {
  it('records the authenticated starter and clears completion identity at start', async () => {
    const { prisma, service } = setup();
    prisma.maintenanceChecklistItem.findMany.mockResolvedValue([
      { id: 'c1', title: 'Pressure', sortOrder: 1, isMandatory: true, resultType: 'NUMBER', minValue: 5, maxValue: 15, unit: 'bar' },
    ]);

    await service.start({ scheduleId: 's1', userId: 'u1', ctx, source: 'SCHEDULE' });

    const data = prisma.maintenanceChecklistExecution.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({
      scheduleId: 's1', status: 'IN_PROGRESS', startedById: 'u1', completedById: null, completedAt: null,
    }));
    expect(data.startedAt).toBeInstanceOf(Date);
    expect(data.items.create[0]).toEqual(expect.objectContaining({
      checklistItemId: 'c1', itemTitleSnapshot: 'Pressure', unitSnapshot: 'bar', status: 'PENDING',
    }));
  });

  it('snapshots only active current template items', async () => {
    const { prisma, service } = setup();
    await service.start({ scheduleId: 's1', userId: 'u1', ctx, source: 'SCHEDULE' });
    expect(prisma.maintenanceChecklistItem.findMany).toHaveBeenCalledWith({
      where: { scheduleId: 's1', isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  });

  it('takes an UPDLOCK/HOLDLOCK on the in-scope schedule row', async () => {
    const { prisma, service } = setup();
    await service.start({ scheduleId: 's1', userId: 'u1', ctx, source: 'SCHEDULE' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = JSON.stringify(prisma.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('UPDLOCK, HOLDLOCK');
    expect(sql).toContain('maintenance_schedules');
  });

  it('rejects a concurrent second active execution', async () => {
    const { prisma, service } = setup();
    prisma.maintenanceChecklistExecution.findFirst.mockResolvedValue({ id: 'e-existing' });
    await expect(service.start({ scheduleId: 's1', userId: 'u1', ctx, source: 'SCHEDULE' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.maintenanceChecklistExecution.create).not.toHaveBeenCalled();
  });

  it('denies an actor without the canonical maintenance technician chain', async () => {
    const { prisma, service } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.start({ scheduleId: 's1', userId: 'uX', ctx, source: 'SCHEDULE' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.maintenanceChecklistExecution.create).not.toHaveBeenCalled();
  });

  it('denies a schedule from another company', async () => {
    const { prisma, service } = setup();
    prisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule({
      id: 'sX', machine: { id: 'mX', companyId: 'c2', branchId: 'b1' },
    }));
    await expect(service.start({ scheduleId: 'sX', userId: 'u1', ctx, source: 'SCHEDULE' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('authorizes request-linked starts through Phase 5/6 active team membership', async () => {
    const { prisma, service } = setup();
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: 'r1', machineId: 'm1', status: 'IN_PROGRESS', requestedById: 'other', assignedToId: null,
    });
    prisma.maintenanceWorkOrder.findMany.mockResolvedValue([{ id: 'w1' }]);
    prisma.maintenanceWorkOrderAssignment.findFirst.mockResolvedValue({ id: 'a1' });

    const result = await service.start({ scheduleId: 's1', requestId: 'r1', userId: 'u1', ctx, source: 'REQUEST' });
    expect(result.id).toBe('e1');
    expect(prisma.maintenanceWorkOrderAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ maintenancePersonnelId: 'mp1', cancelledAt: null }),
    }));
  });

  it('denies a request-linked start to an actor outside the request team', async () => {
    const { prisma, service } = setup();
    prisma.maintenanceRequest.findFirst.mockResolvedValue({
      id: 'r1', machineId: 'm1', status: 'IN_PROGRESS', requestedById: 'other', assignedToId: null,
    });
    await expect(service.start({ scheduleId: 's1', requestId: 'r1', userId: 'u1', ctx, source: 'REQUEST' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('writes the start audit atomically inside the transaction', async () => {
    const { audit, service } = setup();
    await service.start({ scheduleId: 's1', userId: 'u1', ctx, source: 'SCHEDULE' });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'u1', action: 'START', entity: 'MaintenanceChecklistExecution',
    }));
  });

  it('never derives the actor from a client payload field', async () => {
    const { prisma, service } = setup();
    await service.start({ scheduleId: 's1', userId: 'u1', ctx, source: 'SCHEDULE' } as any);
    const data = prisma.maintenanceChecklistExecution.create.mock.calls[0][0].data;
    expect(data.startedById).toBe('u1');
    expect(JSON.stringify(data)).not.toContain('startedByIdFromBody');
  });
});
