import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditService } from '../../../common/audit/audit.service'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'
import { InventoryLocksService } from './inventory-locks.service'

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 'scope-1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'Branch 1',
  branchCode: 'B1',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
}

const lock = (overrides: Record<string, any> = {}) => ({
  id: 'lock-1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'LOCK-1',
  lockType: 'WAREHOUSE_LOCK',
  status: 'ACTIVE',
  dateFrom: new Date('2026-08-01T00:00:00.000Z'),
  dateTo: new Date('2026-08-31T00:00:00.000Z'),
  warehouseId: 'w1',
  locationId: null,
  productId: null,
  sparePartId: null,
  reason: 'Month close',
  notes: null,
  createdByUserId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  activatedByUserId: null,
  activatedAt: null,
  deactivatedByUserId: null,
  deactivatedAt: null,
  ...overrides,
})

describe('InventoryLocksService tenant ownership', () => {
  let prisma: any
  let audit: any
  let service: InventoryLocksService

  beforeEach(() => {
    prisma = {
      inventoryLock: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(prisma)),
    }
    audit = { logWithClient: jest.fn().mockResolvedValue(undefined) }
    service = new InventoryLocksService(prisma as PrismaService, audit as AuditService)
  })

  it('writes exact active company and branch ownership for a new warehouse lock', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(null)
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'w1', companyId: 'c1', branchId: null, status: 'ACTIVE', deletedAt: null,
    })
    prisma.inventoryLock.create.mockResolvedValue(lock())

    await service.create({
      code: ' LOCK-1 ',
      lockType: 'WAREHOUSE_LOCK',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-31T00:00:00.000Z',
      warehouseId: 'w1',
      reason: 'Month close',
    }, 'u1', ctx)

    expect(prisma.inventoryLock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'c1',
        branchId: 'b1',
        code: 'LOCK-1',
        warehouseId: 'w1',
      }),
    })
    expect(audit.logWithClient).toHaveBeenCalledWith(prisma, expect.objectContaining({
      action: 'CREATE', entityId: 'lock-1',
    }))
  })

  it('owns a product-only item lock by context while validating the global product reference', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(null)
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', status: 'ACTIVE', deletedAt: null })
    prisma.inventoryLock.create.mockResolvedValue(lock({ lockType: 'ITEM_LOCK', warehouseId: null, productId: 'p1' }))

    await service.create({
      code: 'ITEM-1',
      lockType: 'ITEM_LOCK',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-31T00:00:00.000Z',
      productId: 'p1',
      reason: 'Product blocked',
    }, 'u1', ctx)

    expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' } })
    expect(prisma.inventoryLock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: 'c1', branchId: 'b1', productId: 'p1' }),
    })
  })

  it('rejects a foreign-branch warehouse before create or audit side effects', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(null)
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'w2', companyId: 'c1', branchId: 'b2', status: 'ACTIVE', deletedAt: null,
    })

    await expect(service.create({
      code: 'LOCK-X',
      lockType: 'WAREHOUSE_LOCK',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-31T00:00:00.000Z',
      warehouseId: 'w2',
      reason: 'Month close',
    }, 'u1', ctx)).rejects.toThrow(BadRequestException)

    expect(prisma.inventoryLock.create).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })

  it('rejects a location whose parent conflicts with the supplied warehouse with zero writes', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(null)
    prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc-1', warehouseId: 'w1', status: 'ACTIVE' })

    await expect(service.create({
      code: 'LOC-X',
      lockType: 'LOCATION_LOCK',
      dateFrom: '2026-08-01T00:00:00.000Z',
      dateTo: '2026-08-31T00:00:00.000Z',
      warehouseId: 'w2',
      locationId: 'loc-1',
      reason: 'Location close',
    }, 'u1', ctx)).rejects.toThrow(BadRequestException)

    expect(prisma.inventoryLock.create).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })

  it('lists only exact-context rows so NULL and foreign legacy ownership remain hidden', async () => {
    prisma.inventoryLock.findMany.mockResolvedValue([])
    prisma.inventoryLock.count.mockResolvedValue(0)

    await service.findAll({ page: 1, limit: 20 }, ctx)

    expect(prisma.inventoryLock.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'c1', branchId: 'b1' },
    }))
    expect(prisma.inventoryLock.count).toHaveBeenCalledWith({
      where: { companyId: 'c1', branchId: 'b1' },
    })
  })

  it('uses exact tenant scope for direct reads', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(lock())

    await service.findOne('lock-1', ctx)

    expect(prisma.inventoryLock.findFirst).toHaveBeenCalledWith({
      where: { id: 'lock-1', companyId: 'c1', branchId: 'b1' },
    })
  })

  it('denies a foreign or NULL-owned update with zero mutation and audit side effects', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(null)

    await expect(service.update('foreign-lock', { reason: 'Changed reason' }, 'u1', ctx))
      .rejects.toThrow(NotFoundException)

    expect(prisma.inventoryLock.updateMany).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })

  it('denies a foreign or NULL-owned delete with zero mutation and audit side effects', async () => {
    prisma.inventoryLock.findFirst.mockResolvedValue(null)

    await expect(service.remove('foreign-lock', 'u1', ctx)).rejects.toThrow(NotFoundException)

    expect(prisma.inventoryLock.deleteMany).not.toHaveBeenCalled()
    expect(audit.logWithClient).not.toHaveBeenCalled()
  })

  it('scopes lock checks exactly and always evaluates tenant period/global locks', async () => {
    prisma.inventoryLock.findMany.mockResolvedValue([])

    const result = await service.checkLock({ date: '2026-08-15T00:00:00.000Z' }, ctx)

    expect(result).toEqual({ locked: false, locks: [] })
    expect(prisma.inventoryLock.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        companyId: 'c1',
        branchId: 'b1',
        status: 'ACTIVE',
        OR: [{ lockType: 'PERIOD_LOCK' }, { lockType: 'GLOBAL_INVENTORY_LOCK' }],
      }),
    })
  })

  it('derives a location parent warehouse and evaluates both location and warehouse locks', async () => {
    prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc-1', warehouseId: 'w1', status: 'ACTIVE' })
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE', deletedAt: null,
    })
    prisma.inventoryLock.findMany.mockResolvedValue([])

    await service.checkLock({ date: '2026-08-15T00:00:00.000Z', locationId: 'loc-1' }, ctx)

    const where = prisma.inventoryLock.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ companyId: 'c1', branchId: 'b1' })
    expect(where.OR).toEqual(expect.arrayContaining([
      { lockType: 'WAREHOUSE_LOCK', warehouseId: 'w1' },
      { lockType: 'LOCATION_LOCK', locationId: 'loc-1' },
    ]))
  })

  it('rejects a foreign warehouse check before querying locks', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'w2', companyId: 'c2', branchId: 'b2', status: 'ACTIVE', deletedAt: null,
    })

    await expect(service.checkLock({
      date: '2026-08-15T00:00:00.000Z',
      warehouseId: 'w2',
    }, ctx)).rejects.toThrow(BadRequestException)

    expect(prisma.inventoryLock.findMany).not.toHaveBeenCalled()
  })
})
