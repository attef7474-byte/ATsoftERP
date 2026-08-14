import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MaintenanceSparePartRequestLinesService } from './maintenance-spare-part-request-lines.service'

describe('maintenance-spare-part-request-lines tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
      machine: { findFirst: jest.fn() },
      machineComponent: { findUnique: jest.fn() },
      downtimeLog: { findUnique: jest.fn() },
      maintenanceRequestRequiredPart: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    return tx
  }

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId })
  const requestOf = (companyId: string, branchId: string, status = 'OPEN') => ({
    id: 'req-1',
    status,
    machineId: 'm-1',
    machine: machineOf(companyId, branchId),
  })
  const audit: any = { log: jest.fn() }
  const notification: any = { notifyPartRequested: jest.fn(), notifyPartApproved: jest.fn(), notifyPartRejected: jest.fn(), notifyPartReserved: jest.fn(), notifyPartUsed: jest.fn() }

  it('rejects create when the request is outside the active context before any write', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.create('req-9', { sparePartId: 'sp-1', quantity: 1 } as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled()
  })

  it('rejects create when a client-supplied machine is outside the active context', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-a', 'branch-a'))
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1', status: 'ACTIVE' })
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null)
    db.machine.findFirst.mockResolvedValue(null)
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.create('req-1', { sparePartId: 'sp-1', quantity: 1, machineId: 'm-b' } as any, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled()
  })

  it('rejects create when a client-supplied component is outside the active context', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-a', 'branch-a'))
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1', status: 'ACTIVE' })
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null)
    db.machineComponent.findUnique.mockResolvedValue({ id: 'mc-b', machine: machineOf('company-b', 'branch-b') })
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.create('req-1', { sparePartId: 'sp-1', quantity: 1, machineComponentId: 'mc-b' } as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestRequiredPart.create).not.toHaveBeenCalled()
  })

  it('creates only after request ownership and references validate', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-a', 'branch-a'))
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1', status: 'ACTIVE' })
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue(null)
    db.maintenanceRequestRequiredPart.create.mockResolvedValue({ id: 'line-1' })
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await service.create('req-1', { sparePartId: 'sp-1', quantity: 1 } as any, 'user-1', ctx)
    expect(db.maintenanceRequestRequiredPart.create).toHaveBeenCalled()
  })

  it('rejects findAll for a foreign request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.findAll('req-9', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestRequiredPart.findMany).not.toHaveBeenCalled()
  })

  it('rejects findOne for a foreign request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.findOne('req-9', 'line-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects approve for a foreign request before any write', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.approve('req-9', 'line-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled()
  })

  it('rejects cancel for a foreign request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.cancel('req-9', 'line-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled()
  })

  it('rejects markUsed for a foreign request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue(requestOf('company-b', 'branch-b'))
    const service = new MaintenanceSparePartRequestLinesService(db, audit, notification)

    await expect(service.markUsed('req-9', 'line-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled()
  })
})
