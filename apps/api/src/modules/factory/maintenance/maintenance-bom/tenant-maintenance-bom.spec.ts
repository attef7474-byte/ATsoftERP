import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MaintenanceBomService } from './maintenance-bom.service'

describe('maintenance-bom tenant isolation', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      maintenanceBom: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      maintenanceBomVersion: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      maintenanceBomItem: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      machine: { findFirst: jest.fn() },
      machineComponent: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    }
    return tx
  }

  const numbering: any = { generateNumberAtomic: jest.fn().mockResolvedValue('BOM-1') }
  const audit: any = { log: jest.fn() }
  const buildService = (db: any) => new MaintenanceBomService(db, numbering, audit)

  const machineOf = (companyId: string, branchId: string) => ({ id: 'm-1', companyId, branchId })
  const bomScopedByMachine = (companyId: string, branchId: string) => ({
    id: 'bom-1',
    deletedAt: null,
    machine: machineOf(companyId, branchId),
    component: null,
  })
  const bomScopedByComponent = (companyId: string, branchId: string) => ({
    id: 'bom-1',
    deletedAt: null,
    machine: null,
    component: { id: 'c-1', machine: machineOf(companyId, branchId) },
  })

  it('scopes findAll through machine or component.machine', async () => {
    const db = buildDb()
    const service = buildService(db)
    await service.findAll({ page: 1, limit: 20 }, ctx)
    const where = db.maintenanceBom.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] } },
      { component: { machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] } } },
    ])
  })

  it('rejects findById for a machine-scoped BOM outside the active context', async () => {
    const db = buildDb()
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByMachine('company-b', 'branch-b'))
    const service = buildService(db)
    await expect(service.findById('bom-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects findById for a component-scoped BOM outside the active context', async () => {
    const db = buildDb()
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByComponent('company-b', 'branch-b'))
    const service = buildService(db)
    await expect(service.findById('bom-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('allows findById for an in-scope machine BOM and an in-scope component BOM', async () => {
    const db = buildDb()
    db.maintenanceBom.findUnique
      .mockResolvedValueOnce(bomScopedByMachine('company-a', 'branch-a'))
      .mockResolvedValueOnce(bomScopedByMachine('company-a', 'branch-a'))
      .mockResolvedValueOnce(bomScopedByComponent('company-a', 'branch-a'))
      .mockResolvedValueOnce(bomScopedByComponent('company-a', 'branch-a'))
    const service = buildService(db)
    await expect(service.findById('bom-1', ctx)).resolves.toMatchObject({ id: 'bom-1' })
    await expect(service.findById('bom-1', ctx)).resolves.toMatchObject({ id: 'bom-1' })
  })

  it('rejects create when the machine is outside the active context before any write', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue(null)
    const service = buildService(db)
    await expect(service.create({ name: 'BOM', machineId: 'm-9' } as any, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.maintenanceBom.create).not.toHaveBeenCalled()
  })

  it('rejects create when the component machine is outside the active context', async () => {
    const db = buildDb()
    db.machineComponent.findFirst.mockResolvedValue(null)
    const service = buildService(db)
    await expect(service.create({ name: 'BOM', componentId: 'c-9' } as any, 'user-1', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(db.maintenanceBom.create).not.toHaveBeenCalled()
  })

  it('creates a BOM only after the machine is validated in-context', async () => {
    const db = buildDb()
    db.machine.findFirst.mockResolvedValue(machineOf('company-a', 'branch-a'))
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByMachine('company-a', 'branch-a'))
    db.maintenanceBom.create.mockResolvedValue({ id: 'bom-1' })
    const service = buildService(db)
    await service.create({ name: 'BOM', machineId: 'm-1' } as any, 'user-1', ctx)
    expect(db.maintenanceBom.create).toHaveBeenCalled()
  })

  it('scopes getByMachine and getByComponent through the machine relation', async () => {
    const db = buildDb()
    const service = buildService(db)
    await service.getByMachine('m-1', ctx)
    expect(db.maintenanceBom.findMany.mock.calls[0][0].where).toEqual({
      machineId: 'm-1',
      deletedAt: null,
      machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] },
    })
    await service.getByComponent('c-1', ctx)
    expect(db.maintenanceBom.findMany.mock.calls[1][0].where).toEqual({
      componentId: 'c-1',
      deletedAt: null,
      component: { machine: { companyId: 'company-a', OR: [{ branchId: 'branch-a' }, { branchId: null }] } },
    })
  })

  it('rejects update/activate/deactivate/remove for a foreign BOM before any write', async () => {
    const db = buildDb()
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByMachine('company-b', 'branch-b'))
    const service = buildService(db)
    await expect(service.update('bom-1', { name: 'x' } as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.activate('bom-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.deactivate('bom-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.remove('bom-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceBom.update).not.toHaveBeenCalled()
  })

  it('rejects getVersions and createVersion for a foreign BOM', async () => {
    const db = buildDb()
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByMachine('company-b', 'branch-b'))
    const service = buildService(db)
    await expect(service.getVersions('bom-1', {}, ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.createVersion('bom-1', {} as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('rejects addItem when the version belongs to a foreign BOM', async () => {
    const db = buildDb()
    db.maintenanceBomVersion.findUnique.mockResolvedValue({ id: 'v-1', bomId: 'bom-9' })
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByMachine('company-b', 'branch-b'))
    const service = buildService(db)
    await expect(service.addItem('v-1', { sparePartId: 'sp-1', quantity: 1 } as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceBomItem.create).not.toHaveBeenCalled()
  })

  it('rejects updateItem and removeItem when the item belongs to a foreign BOM', async () => {
    const db = buildDb()
    db.maintenanceBomItem.findUnique.mockResolvedValue({ id: 'i-1', bomVersionId: 'v-9' })
    db.maintenanceBomVersion.findUnique.mockResolvedValue({ id: 'v-9', bomId: 'bom-9' })
    db.maintenanceBom.findUnique.mockResolvedValue(bomScopedByMachine('company-b', 'branch-b'))
    const service = buildService(db)
    await expect(service.updateItem('i-1', { quantity: 2 } as any, 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.removeItem('i-1', 'user-1', ctx)).rejects.toBeInstanceOf(NotFoundException)
    expect(db.maintenanceBomItem.update).not.toHaveBeenCalled()
    expect(db.maintenanceBomItem.delete).not.toHaveBeenCalled()
  })
})
