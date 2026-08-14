import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MaintenanceRequestPartsService } from './maintenance-request-parts.service'

describe('maintenance-request-parts tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      maintenanceRequestPartUsage: {
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
  const part = (machine: any) => ({
    id: 'u-1',
    request: { id: 'req-1', requestNumber: 'MR-1', title: 'Fix', machine },
    product: { id: 'prod-1' },
  })

  it('scopes list through maintenanceRequest.machine', async () => {
    const db = buildDb()
    const audit: any = { log: jest.fn() }
    const service = new MaintenanceRequestPartsService(db, audit)
    await service.findAll({ requestId: 'req-1', productId: 'prod-1' }, ctx)
    expect(db.maintenanceRequestPartUsage.findMany.mock.calls[0][0].where).toEqual({
      request: { machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] }, id: 'req-1' },
      productId: 'prod-1',
    })
  })

  it('rejects create when the maintenance request is outside the active context', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-9', requestNumber: 'MR-9', machine: machineOf('company-b', 'branch-b') })
    const audit: any = { log: jest.fn() }
    const service = new MaintenanceRequestPartsService(db, audit)

    await expect(service.create({ requestId: 'req-9', productId: 'prod-1', quantity: 2 } as any, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.maintenanceRequestPartUsage.create).not.toHaveBeenCalled()
  })

  it('creates only after request ownership and product validation pass', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-1', requestNumber: 'MR-1', machine: machineOf('company-a', 'branch-a') })
    db.product.findUnique.mockResolvedValue({ id: 'prod-1' })
    db.maintenanceRequestPartUsage.create.mockResolvedValue(part(machineOf('company-a', 'branch-a')))
    const audit: any = { log: jest.fn() }
    const service = new MaintenanceRequestPartsService(db, audit)

    await service.create({ requestId: 'req-1', productId: 'prod-1', quantity: 2 } as any, 'user-1', ctx)
    expect(db.maintenanceRequestPartUsage.create).toHaveBeenCalled()
  })

  it('allows reading an in-context usage and rejects foreign ones with 404', async () => {
    const db = buildDb()
    db.maintenanceRequestPartUsage.findUnique
      .mockResolvedValueOnce(part(machineOf('company-b', 'branch-b')))
      .mockResolvedValueOnce(part(machineOf('company-a', 'branch-a')))
    const audit: any = { log: jest.fn() }
    const service = new MaintenanceRequestPartsService(db, audit)

    await expect(service.findOne('u-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findOne('u-1', ctx)).resolves.toMatchObject({ id: 'u-1' })
  })

  it('rejects update of a foreign usage before any write', async () => {
    const db = buildDb()
    db.maintenanceRequestPartUsage.findUnique.mockResolvedValue(part(machineOf('company-b', 'branch-b')))
    const audit: any = { log: jest.fn() }
    const service = new MaintenanceRequestPartsService(db, audit)

    await expect(service.update('u-1', { quantity: 9 } as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestPartUsage.update).not.toHaveBeenCalled()
  })

  it('rejects delete of a foreign usage', async () => {
    const db = buildDb()
    db.maintenanceRequestPartUsage.findUnique.mockResolvedValue(part(machineOf('company-b', 'branch-b')))
    const audit: any = { log: jest.fn() }
    const service = new MaintenanceRequestPartsService(db, audit)

    await expect(service.remove('u-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceRequestPartUsage.delete).not.toHaveBeenCalled()
  })
})
