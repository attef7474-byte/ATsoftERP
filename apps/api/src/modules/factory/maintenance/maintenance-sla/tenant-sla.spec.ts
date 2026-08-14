import { NotFoundException } from '@nestjs/common'
import { MaintenanceSlaService } from './maintenance-sla.service'

describe('maintenance-sla tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      maintenanceSlaRule: { findFirst: jest.fn().mockResolvedValue(null) },
      maintenanceSlaState: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    }
    return tx
  }

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId })
  const requestOf = (companyId: string, branchId: string) => ({
    id: 'req-1',
    priority: 'HIGH',
    type: 'CORRECTIVE',
    machine: machineOf(companyId, branchId),
  })

  it('rejects calculate (createSlaState) for a foreign request before any write', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSlaService(db)

    await expect(service.createSlaState('req-9', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceSlaState.upsert).not.toHaveBeenCalled()
    expect(db.maintenanceRequest.update).not.toHaveBeenCalled()
  })

  it('rejects recalculate for a foreign request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSlaService(db)

    await expect(service.recalculateSla('req-9', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceSlaState.update).not.toHaveBeenCalled()
  })

  it('rejects getSlaSummary for a foreign request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSlaService(db)

    await expect(service.getSlaSummary('req-9', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceSlaState.findUnique).not.toHaveBeenCalled()
  })

  it('scopes overdue requests to the active company/branch via machine', async () => {
    const db = buildDb()
    const service = new MaintenanceSlaService(db)
    await service.getOverdueRequests(ctx)
    expect(db.maintenanceRequest.findMany.mock.calls[0][0].where.machine).toEqual({
      companyId: 'company-a',
      OR: [{ branchId: 'branch-a' }, { branchId: null }],
    })
  })

  it('scopes SLA stats to the active company/branch via machine', async () => {
    const db = buildDb()
    const service = new MaintenanceSlaService(db)
    await service.getSlaStats(ctx)
    const machine = { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] }
    for (const call of db.maintenanceRequest.count.mock.calls) {
      expect(call[0].where.machine).toEqual(machine)
    }
  })
})
