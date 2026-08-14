import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MaintenancePartAccountabilityService } from './maintenance-part-accountability.service'

describe('maintenance-part-accountability tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceRequest: { findUnique: jest.fn() },
      maintenanceRequestRequiredPart: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
      maintenancePersonnel: { findUnique: jest.fn() },
      maintenancePartAccountability: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    return tx
  }

  const record = (machine: any) => ({
    id: 'pa-1',
    maintenanceRequest: { id: 'req-1', requestNumber: 'MR-1', title: 'Fix', status: 'OPEN', machine },
    maintenancePersonnel: { id: 'p-1', role: 'ENGINEER', specialty: null, operationalPerson: { id: 'op-1', code: 'OP1', name: 'P' } },
  })

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId })

  it('scopes list through maintenanceRequest.machine', async () => {
    const db = buildDb()
    const service = new MaintenancePartAccountabilityService(db)
    await service.findAll({ maintenanceRequestId: 'req-1', machineId: 'm-1', status: 'ISSUED' }, ctx)
    expect(db.maintenancePartAccountability.findMany.mock.calls[0][0].where).toEqual({
      maintenanceRequest: {
        machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }], id: 'm-1' },
        id: 'req-1',
      },
      status: 'ISSUED',
    })
  })

  it('rejects create when the maintenance request machine is outside the active context', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-9', machine: machineOf('company-b', 'branch-b') })
    const service = new MaintenancePartAccountabilityService(db)

    await expect(service.create({ maintenanceRequestId: 'req-9', requiredPartId: 'rp-1', sparePartId: 'sp-1', maintenancePersonnelId: 'p-1', quantity: 1 } as any, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.maintenancePartAccountability.create).not.toHaveBeenCalled()
  })

  it('rejects create when required part belongs to a different request', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-1', machine: machineOf('company-a', 'branch-a') })
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1' })
    db.maintenancePersonnel.findUnique.mockResolvedValue({ id: 'p-1' })
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({ id: 'rp-1', maintenanceRequestId: 'req-9' })
    const service = new MaintenancePartAccountabilityService(db)

    await expect(service.create({ maintenanceRequestId: 'req-1', requiredPartId: 'rp-1', sparePartId: 'sp-1', maintenancePersonnelId: 'p-1', quantity: 1 } as any, ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.maintenancePartAccountability.create).not.toHaveBeenCalled()
  })

  it('creates only after all references validate', async () => {
    const db = buildDb()
    db.maintenanceRequest.findUnique.mockResolvedValue({ id: 'req-1', machine: machineOf('company-a', 'branch-a') })
    db.sparePart.findUnique.mockResolvedValue({ id: 'sp-1' })
    db.maintenancePersonnel.findUnique.mockResolvedValue({ id: 'p-1' })
    db.maintenanceRequestRequiredPart.findUnique.mockResolvedValue({ id: 'rp-1', maintenanceRequestId: 'req-1' })
    db.maintenancePartAccountability.create.mockResolvedValue(record(machineOf('company-a', 'branch-a')))
    const service = new MaintenancePartAccountabilityService(db)

    await service.create({ maintenanceRequestId: 'req-1', requiredPartId: 'rp-1', sparePartId: 'sp-1', maintenancePersonnelId: 'p-1', quantity: 1 } as any, ctx)
    expect(db.maintenancePartAccountability.create).toHaveBeenCalled()
  })

  it('allows reading an in-context record and rejects foreign ones with 404', async () => {
    const db = buildDb()
    db.maintenancePartAccountability.findUnique
      .mockResolvedValueOnce(record(machineOf('company-b', 'branch-b')))
      .mockResolvedValueOnce(record(machineOf('company-a', 'branch-a')))
    const service = new MaintenancePartAccountabilityService(db)

    await expect(service.findOne('pa-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.findOne('pa-1', ctx)).resolves.toMatchObject({ id: 'pa-1' })
  })

  it('rejects update of a foreign record before any write', async () => {
    const db = buildDb()
    db.maintenancePartAccountability.findUnique.mockResolvedValue(record(machineOf('company-b', 'branch-b')))
    const service = new MaintenancePartAccountabilityService(db)

    await expect(service.update('pa-1', { status: 'ISSUED' } as any, ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenancePartAccountability.update).not.toHaveBeenCalled()
  })

  it('rejects remove of a foreign record', async () => {
    const db = buildDb()
    db.maintenancePartAccountability.findUnique.mockResolvedValue(record(machineOf('company-b', 'branch-b')))
    const service = new MaintenancePartAccountabilityService(db)

    await expect(service.remove('pa-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenancePartAccountability.update).not.toHaveBeenCalled()
  })
})
