import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ActiveContextService } from '../operational-context/active-context.service'
import { ActiveOperationalContext } from '../operational-context/operational-context.types'
import { InventoryLockGuard } from './inventory-lock.guard'

const ctx = {
  companyId: 'c1',
  branchId: 'b1',
} as ActiveOperationalContext

describe('InventoryLockGuard tenant scope', () => {
  let prisma: any
  let activeContextService: any
  let guard: InventoryLockGuard

  const executionContext = (request: any) => ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as ExecutionContext

  beforeEach(() => {
    prisma = {
      inventoryLock: { findFirst: jest.fn().mockResolvedValue(null) },
      warehouseLocation: { findMany: jest.fn().mockResolvedValue([]) },
    }
    activeContextService = { validate: jest.fn().mockResolvedValue(ctx) }
    guard = new InventoryLockGuard(
      prisma as PrismaService,
      activeContextService as ActiveContextService,
    )
  })

  it('resolves context before the global interceptor and queries only exact-owned locks', async () => {
    const request = {
      user: { id: 'u1' },
      method: 'POST',
      headers: { 'x-active-company-id': 'c1', 'x-active-branch-id': 'b1' },
      body: {},
    }

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true)

    expect(activeContextService.validate).toHaveBeenCalledWith('u1', {
      companyId: 'c1',
      branchId: 'b1',
      administrationId: null,
      departmentId: null,
    })
    expect(prisma.inventoryLock.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        companyId: 'c1',
        branchId: 'b1',
        status: 'ACTIVE',
        OR: [{ lockType: 'PERIOD_LOCK' }, { lockType: 'GLOBAL_INVENTORY_LOCK' }],
      }),
      select: { id: true },
    })
  })

  it('enforces a tenant global/period lock even when the request has no reference IDs', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue({ id: 'lock-1' })
    const request = { activeContext: ctx, method: 'POST', body: {} }

    await expect(guard.canActivate(executionContext(request))).rejects.toThrow(ForbiddenException)
  })

  it('does not turn an operational posting lock into a read denial', async () => {
    const request = { method: 'GET', body: {} }

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true)
    expect(activeContextService.validate).not.toHaveBeenCalled()
    expect(prisma.inventoryLock.findFirst).not.toHaveBeenCalled()
  })

  it('derives parent warehouses for nested line locations and checks both lock levels', async () => {
    prisma.warehouseLocation.findMany.mockResolvedValue([{ warehouseId: 'w1' }])
    const request = {
      activeContext: ctx,
      method: 'POST',
      body: { lines: [{ locationId: 'loc-1', productId: 'p1' }] },
    }

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true)

    expect(prisma.warehouseLocation.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['loc-1'] },
        warehouse: {
          companyId: 'c1',
          OR: [{ branchId: 'b1' }, { branchId: null }],
          deletedAt: null,
        },
      },
      select: { warehouseId: true },
    })
    const where = prisma.inventoryLock.findFirst.mock.calls[0][0].where
    expect(where.OR).toEqual(expect.arrayContaining([
      { lockType: 'WAREHOUSE_LOCK', warehouseId: { in: ['w1'] } },
      { lockType: 'LOCATION_LOCK', locationId: { in: ['loc-1'] } },
      { lockType: 'ITEM_LOCK', productId: { in: ['p1'] } },
    ]))
  })

  it('fails closed before any lock query when required context headers are absent', async () => {
    const request = { user: { id: 'u1' }, method: 'POST', headers: {}, body: { warehouseId: 'w1' } }

    await expect(guard.canActivate(executionContext(request))).rejects.toThrow(ForbiddenException)
    expect(prisma.inventoryLock.findFirst).not.toHaveBeenCalled()
  })
})
