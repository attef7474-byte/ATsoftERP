import { BadRequestException } from '@nestjs/common'
import { ComponentSparePartsService } from '../component-spare-parts/component-spare-parts.service'
import { MachineSparePartsService } from './machine-spare-parts.service'

describe('machine/component spare-part tenant links', () => {
  const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any

  const buildDb = () => {
    const tx: any = {
      machine: { findFirst: jest.fn() },
      machineComponent: { findFirst: jest.fn() },
      sparePart: { findFirst: jest.fn().mockResolvedValue({ id: 'spare-1' }) },
      machineSparePart: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      componentSparePart: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    }
    const db: any = {
      ...tx,
      machineSparePart: { ...tx.machineSparePart, findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      componentSparePart: { ...tx.componentSparePart, findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    }
    return { db, tx }
  }

  it('scopes both link lists through the owning machine', async () => {
    const { db } = buildDb()
    const audit: any = { logWithClient: jest.fn() }
    await new MachineSparePartsService(db, audit).findAll({}, ctx)
    await new ComponentSparePartsService(db, audit).findAll({}, ctx)
    const machineScope = { companyId: 'company-a', deletedAt: null, OR: [{ branchId: 'branch-a' }, { branchId: null }] }
    expect(db.machineSparePart.findMany.mock.calls[0][0].where.machine).toEqual(machineScope)
    expect(db.componentSparePart.findMany.mock.calls[0][0].where.component.machine).toEqual(machineScope)
  })

  it('rejects a foreign machine inside the write transaction with zero side effects', async () => {
    const { db, tx } = buildDb()
    tx.machine.findFirst.mockResolvedValue(null)
    const audit: any = { logWithClient: jest.fn() }
    const service = new MachineSparePartsService(db, audit)

    await expect(service.create({ machineId: 'machine-b', sparePartId: 'spare-1', quantity: 1 } as any, 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.machineSparePart.create).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })

  it('rejects a component whose parent machine is outside the active context', async () => {
    const { db, tx } = buildDb()
    tx.machineComponent.findFirst.mockResolvedValue(null)
    const audit: any = { logWithClient: jest.fn() }
    const service = new ComponentSparePartsService(db, audit)

    await expect(service.create({ componentId: 'component-b', sparePartId: 'spare-1', quantity: 1 } as any, 'user-a', ctx)).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.componentSparePart.create).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })
})
