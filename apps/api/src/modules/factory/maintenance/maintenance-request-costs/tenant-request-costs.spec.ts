import { NotFoundException } from '@nestjs/common'
import { MaintenanceRequestCostsService } from './maintenance-request-costs.service'

describe('maintenance-request-costs tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: { findUnique: jest.fn() },
      maintenanceRequestCostEntry: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }
    return tx
  }

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId })
  const entry = (machine: any) => ({
    id: 'c-1',
    request: { id: 'req-1', requestNumber: 'MR-1', title: 'Fix', machine },
  })

  it('scopes list through maintenanceRequest.machine and merges requestId inside scope', async () => {
    const db = buildDb()
    const audit: any = { log: jest.fn() }; const service = new MaintenanceRequestCostsService(db, audit)
    await service.findAll({ requestId: 'req-1', type: 'LABOR' }, ctx)
    expect(db.maintenanceRequestCostEntry.findMany.mock.calls[0][0].where).toEqual({
      request: { machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] }, id: 'req-1' },
      type: 'LABOR',
    })
  })

  it('rejects create outright because legacy request cost is read-only (R2-H)', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-9', requestNumber: 'MR-9', machine: machineOf('company-b', 'branch-b') })
    const audit: any = { log: jest.fn() }; const service = new MaintenanceRequestCostsService(db, audit)

    await expect(service.create({ requestId: 'req-9', type: 'LABOR', amount: 100 } as any, 'user-1', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.legacyCostEntryWriteDeprecated' } })
    expect(db.maintenanceRequestCostEntry.create).not.toHaveBeenCalled()
  })

  it('never writes a cost entry, not even for an in-context request (R2-H)', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-1', requestNumber: 'MR-1', machine: machineOf('company-a', 'branch-a') })
    db.maintenanceRequestCostEntry.create.mockResolvedValue(entry(machineOf('company-a', 'branch-a')))
    const audit: any = { log: jest.fn() }; const service = new MaintenanceRequestCostsService(db, audit)

    await expect(service.create({ requestId: 'req-1', type: 'MATERIAL', amount: 50 } as any, 'user-1', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.legacyCostEntryWriteDeprecated' } })
    expect(db.maintenanceRequestCostEntry.create).not.toHaveBeenCalled()
  })

  it('allows reading an in-context entry and rejects foreign ones with 404', async () => {
    const db = buildDb()
    db.maintenanceRequestCostEntry.findUnique
      .mockResolvedValueOnce(entry(machineOf('company-b', 'branch-b')))
      .mockResolvedValueOnce(entry(machineOf('company-a', 'branch-a')))
    const audit: any = { log: jest.fn() }; const service = new MaintenanceRequestCostsService(db, audit)

    await expect(service.findOne('c-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findOne('c-1', ctx)).resolves.toMatchObject({ id: 'c-1' })
  })

  it('rejects update of a foreign entry before any write (R2-H: writes are retired)', async () => {
    const db = buildDb()
    db.maintenanceRequestCostEntry.findUnique.mockResolvedValue(entry(machineOf('company-b', 'branch-b')))
    const audit: any = { log: jest.fn() }; const service = new MaintenanceRequestCostsService(db, audit)

    await expect(service.update('c-1', { amount: 999 } as any, 'user-1', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.legacyCostEntryWriteDeprecated' } })
    expect(db.maintenanceRequestCostEntry.update).not.toHaveBeenCalled()
  })

  it('rejects delete of a foreign entry (R2-H: writes are retired)', async () => {
    const db = buildDb()
    db.maintenanceRequestCostEntry.findUnique.mockResolvedValue(entry(machineOf('company-b', 'branch-b')))
    const audit: any = { log: jest.fn() }; const service = new MaintenanceRequestCostsService(db, audit)

    await expect(service.remove('c-1', 'user-1', ctx))
      .rejects.toMatchObject({ response: { messageKey: 'maintenance.legacyCostEntryWriteDeprecated' } })
    expect(db.maintenanceRequestCostEntry.delete).not.toHaveBeenCalled()
  })
})
