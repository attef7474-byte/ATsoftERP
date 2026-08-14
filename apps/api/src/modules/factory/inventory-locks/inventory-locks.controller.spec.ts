import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'
import { InventoryLocksController } from './inventory-locks.controller'
import { InventoryLocksService } from './inventory-locks.service'

describe('InventoryLocksController active-context forwarding', () => {
  const ctx = { companyId: 'c1', branchId: 'b1' } as ActiveOperationalContext
  let service: any
  let controller: InventoryLocksController

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      remove: jest.fn(),
      checkLock: jest.fn(),
    }
    controller = new InventoryLocksController(service as InventoryLocksService)
  })

  it('passes the validated active context to every CRUD and check service boundary', () => {
    const createDto: any = { code: 'LOCK-1' }
    const updateDto: any = { reason: 'Changed reason' }
    const query: any = { page: 1 }
    const checkDto: any = { date: '2026-08-15T00:00:00.000Z' }

    controller.create(createDto, 'u1', ctx)
    controller.findAll(query, ctx)
    controller.findOne('lock-1', ctx)
    controller.update('lock-1', updateDto, 'u1', ctx)
    controller.activate('lock-1', 'u1', ctx)
    controller.deactivate('lock-1', 'u1', ctx)
    controller.remove('lock-1', 'u1', ctx)
    controller.check(checkDto, ctx)

    expect(service.create).toHaveBeenCalledWith(createDto, 'u1', ctx)
    expect(service.findAll).toHaveBeenCalledWith(query, ctx)
    expect(service.findOne).toHaveBeenCalledWith('lock-1', ctx)
    expect(service.update).toHaveBeenCalledWith('lock-1', updateDto, 'u1', ctx)
    expect(service.activate).toHaveBeenCalledWith('lock-1', 'u1', ctx)
    expect(service.deactivate).toHaveBeenCalledWith('lock-1', 'u1', ctx)
    expect(service.remove).toHaveBeenCalledWith('lock-1', 'u1', ctx)
    expect(service.checkLock).toHaveBeenCalledWith(checkDto, ctx)
  })
})
