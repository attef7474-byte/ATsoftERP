import { NotFoundException } from '@nestjs/common'
import { MaintenanceCalendarWorkloadService } from './maintenance-calendar-workload.service'

describe('maintenance-calendar-workload tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      maintenanceSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      machine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      productionLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      maintenancePersonnel: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      maintenanceRequestAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    }
    return tx
  }

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId })
  const requestOf = (machine: any) => ({ id: 'req-1', requestNumber: 'MR-1', title: 'Fix', notes: null, status: 'OPEN', machine })

  it('scopes calendar request events through machine relation', async () => {
    const db = buildDb()
    const service = new MaintenanceCalendarWorkloadService(db)
    await service.getCalendarEvents({ startDate: '2026-01-01', endDate: '2026-01-31' } as any, ctx)
    expect(db.maintenanceRequest.findMany.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
  })

  it('scopes calendar schedule events through machine relation', async () => {
    const db = buildDb()
    const service = new MaintenanceCalendarWorkloadService(db)
    await service.getCalendarEvents({ startDate: '2026-01-01', endDate: '2026-01-31' } as any, ctx)
    expect(db.maintenanceSchedule.findMany.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
  })

  it('scopes workload summary requests, assignments, machines and production lines', async () => {
    const db = buildDb()
    const service = new MaintenanceCalendarWorkloadService(db)
    await service.getWorkloadSummary(undefined, ctx)
    expect(db.maintenanceRequest.findMany.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.maintenanceRequestAssignment.findMany.mock.calls[0][0].where.maintenanceRequest.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.maintenanceRequest.count.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.machine.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.productionLine.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      companyId: 'company-a',
      branchId: 'branch-a',
    })
  })

  it('scopes calendar filter machines and production lines', async () => {
    const db = buildDb()
    const service = new MaintenanceCalendarWorkloadService(db)
    await service.getCalendarFilters(ctx)
    expect(db.machine.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.productionLine.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      companyId: 'company-a',
      branchId: 'branch-a',
    })
  })

  it('scopes unassigned/overdue/sla-due work and conflicts through machine relation', async () => {
    const db = buildDb()
    const service = new MaintenanceCalendarWorkloadService(db)

    await service.getUnassignedWork(1, 10, ctx)
    expect(db.maintenanceRequest.findMany.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.maintenanceRequestAssignment.findMany.mock.calls[0][0].where.maintenanceRequest.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })

    await service.getOverduePlannedWork(1, 10, ctx)
    expect(db.maintenanceRequest.findMany.mock.calls[1][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })

    await service.getSlaDueWork(1, 10, ctx)
    expect(db.maintenanceRequest.findMany.mock.calls[2][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })

    db.maintenanceRequestAssignment.findMany.mockClear()
    await service.getConflicts(undefined, undefined, ctx)
    expect(db.maintenanceRequestAssignment.findMany.mock.calls[0][0].where.maintenanceRequest.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
    expect(db.maintenanceRequest.findMany.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
  })

  it('rejects updatePlanning for a request outside the active context before any write', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf(machineOf('company-b', 'branch-b')))
    const service = new MaintenanceCalendarWorkloadService(db)

    await expect(service.updatePlanning('req-9', { plannedStartAt: '2026-02-01' }, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequest.update).not.toHaveBeenCalled()
  })

  it('allows updatePlanning for an in-context request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf(machineOf('company-a', 'branch-a')))
    db.maintenanceRequest.update.mockResolvedValue({ id: 'req-1' })
    const service = new MaintenanceCalendarWorkloadService(db)

    await service.updatePlanning('req-1', { plannedStartAt: '2026-02-01' }, ctx)
    expect(db.maintenanceRequest.update).toHaveBeenCalled()
  })

  it('rejects reschedule for a request outside the active context before any write', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf(machineOf('company-b', 'branch-b')))
    const service = new MaintenanceCalendarWorkloadService(db)

    await expect(service.reschedule('req-9', { plannedStartAt: '2026-02-01', plannedEndAt: '2026-02-02' } as any, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequest.update).not.toHaveBeenCalled()
  })

  it('rejects assignPlannedWork for a request outside the active context before any assignment', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf(machineOf('company-b', 'branch-b')))
    const service = new MaintenanceCalendarWorkloadService(db)

    await expect(service.assignPlannedWork('req-9', 'personnel-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestAssignment.create).not.toHaveBeenCalled()
  })
})
