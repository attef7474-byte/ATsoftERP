import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

@Injectable()
export class InventoryLedgerReconciliationService {
  constructor(private prisma: PrismaService) {}

  // ── Ledger ──────────────────────────────────────────────────────

  async findAllLedgerMovements(query: {
    page?: number; limit?: number; search?: string; companyId?: string; branchId?: string;
    warehouseId?: string; movementType?: string; status?: string; direction?: string;
    productId?: string; sourceType?: string; sourceId?: string; locationId?: string;
    dateFrom?: string; dateTo?: string;
  }) {
    const page = Number(query.page) || 1; const limit = Number(query.limit) || 20; const skip = (page - 1) * limit
    const where: any = { deletedAt: null }
    if (query.search) { where.OR = [{ movementNumber: { contains: query.search } }, { notes: { contains: query.search } }] }
    if (query.companyId) where.companyId = query.companyId
    if (query.branchId) where.branchId = query.branchId
    if (query.warehouseId) where.warehouseId = query.warehouseId
    if (query.movementType) where.movementType = query.movementType
    if (query.status) where.status = query.status
    if (query.sourceType) where.sourceType = query.sourceType
    if (query.sourceId) where.sourceId = query.sourceId
    if (query.productId) where.lines = { some: { productId: query.productId } }
    if (query.locationId) where.lines = { some: { warehouseLocationId: query.locationId } }
    if (query.direction) where.lines = { some: { direction: query.direction } }
    if (query.dateFrom || query.dateTo) {
      where.movementDate = {}
      if (query.dateFrom) where.movementDate.gte = new Date(query.dateFrom)
      if (query.dateTo) where.movementDate.lte = new Date(query.dateTo)
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where, skip, take: limit, orderBy: { movementDate: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          company: { select: { id: true, name: true } },
          lines: {
            include: { product: { select: { id: true, code: true, name: true, unit: true } } },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async findLedgerMovement(id: string) {
    const movement = await this.prisma.inventoryMovement.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, name: true } },

        lines: {
          include: {
            product: { select: { id: true, code: true, name: true, unit: true } },
            warehouseLocation: { select: { id: true, code: true, name: true } },
          },
        },
      },
    })
    if (!movement || movement.deletedAt) throw new NotFoundException('Movement not found')
    return movement
  }

  async findByProduct(productId: string, query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1; const limit = Number(query.limit) || 20; const skip = (page - 1) * limit
    const where = { deletedAt: null, lines: { some: { productId } } }
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where, skip, take: limit, orderBy: { movementDate: 'desc' },
        include: { warehouse: { select: { id: true, code: true, name: true } }, lines: { where: { productId }, include: { product: { select: { id: true, code: true, name: true, unit: true } } } } },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async findByWarehouse(warehouseId: string, query: { page?: number; limit?: number }) {
    const page = Number(query.page) || 1; const limit = Number(query.limit) || 20; const skip = (page - 1) * limit
    const where = { deletedAt: null, warehouseId }
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where, skip, take: limit, orderBy: { movementDate: 'desc' },
        include: { lines: { include: { product: { select: { id: true, code: true, name: true, unit: true } } } } },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ])
    const summary = {
      totalMovements: total,
      totalInQty: 0, totalOutQty: 0,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    }
    for (const m of data) {
      summary.byType[m.movementType] = (summary.byType[m.movementType] || 0) + 1
      summary.byStatus[m.status] = (summary.byStatus[m.status] || 0) + 1
      for (const l of m.lines) {
        if (l.direction === 'IN') summary.totalInQty += l.quantity
        else summary.totalOutQty += l.quantity
      }
    }
    return { data, summary, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async findByLocation(locationId: string) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { deletedAt: null, lines: { some: { warehouseLocationId: locationId } } },
      orderBy: { movementDate: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: { where: { warehouseLocationId: locationId }, include: { product: { select: { id: true, code: true, name: true, unit: true } } } },
      },
    })
    return { data: movements, total: movements.length }
  }

  async findBySource(sourceType: string, sourceId: string) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { deletedAt: null, sourceType, sourceId },
      orderBy: { movementDate: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: { include: { product: { select: { id: true, code: true, name: true, unit: true } } } },
      },
    })
    return { data: movements, total: movements.length }
  }

  // ── Reconciliation ──────────────────────────────────────────────

  private async computeExpectedBalance(productId: string, warehouseId: string, locationId?: string | null) {
    const lineWhere: any = { productId, movement: { status: 'POSTED', deletedAt: null, warehouseId } }
    if (locationId) lineWhere.warehouseLocationId = locationId
    else lineWhere.warehouseLocationId = null

    const inSum = await this.prisma.inventoryMovementLine.aggregate({
      where: { ...lineWhere, direction: 'IN' },
      _sum: { quantity: true },
    })
    const outSum = await this.prisma.inventoryMovementLine.aggregate({
      where: { ...lineWhere, direction: 'OUT' },
      _sum: { quantity: true },
    })
    const inQty = inSum._sum.quantity || 0
    const outQty = outSum._sum.quantity || 0
    return inQty - outQty
  }

  async reconciliationSummary() {
    const balances = await this.prisma.inventoryBalance.findMany({
      include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } } },
    })

    let matched = 0; let differences = 0; let negativeBalances = 0
    let totalCurrentQty = 0; let totalExpectedQty = 0
    const detail: any[] = []

    for (const bal of balances) {
      const expected = await this.computeExpectedBalance(bal.productId, bal.warehouseId, bal.locationId)
      const diff = bal.quantity - expected
      totalCurrentQty += bal.quantity
      totalExpectedQty += expected

      const line = {
        productId: bal.productId, productName: bal.product?.name,
        warehouseId: bal.warehouseId, warehouseName: bal.warehouse?.name,
        locationId: bal.locationId,
        currentBalance: bal.quantity, expectedBalance: expected, difference: diff,
        status: diff === 0 ? 'MATCHED' : bal.quantity < 0 ? 'NEGATIVE_BALANCE' : 'DIFFERENCE',
      }
      detail.push(line)
      if (diff === 0) matched++
      else if (bal.quantity < 0) negativeBalances++
      else differences++
    }

    const totalMovements = await this.prisma.inventoryMovement.count({ where: { status: 'POSTED', deletedAt: null } })
    const totalBalances = balances.length

    return {
      summary: { totalBalances, totalMovements, matched, differences, negativeBalances, totalCurrentQty, totalExpectedQty, totalDifference: totalCurrentQty - totalExpectedQty },
      detail,
    }
  }

  async reconciliationDetails(query: { page?: number; limit?: number; status?: string; warehouseId?: string; productId?: string }) {
    const page = Number(query.page) || 1; const limit = Number(query.limit) || 20; const skip = (page - 1) * limit
    const where: any = {}
    if (query.warehouseId) where.warehouseId = query.warehouseId
    if (query.productId) where.productId = query.productId

    const allBalances = await this.prisma.inventoryBalance.findMany({
      where,
      include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } } },
    })

    const lines: any[] = []
    for (const bal of allBalances) {
      const expected = await this.computeExpectedBalance(bal.productId, bal.warehouseId, bal.locationId)
      const diff = bal.quantity - expected
      const status = diff === 0 ? 'MATCHED' : bal.quantity < 0 ? 'NEGATIVE_BALANCE' : 'DIFFERENCE'
      if (query.status && status !== query.status) continue
      lines.push({
        productId: bal.productId, productName: bal.product?.name, productCode: bal.product?.code,
        warehouseId: bal.warehouseId, warehouseName: bal.warehouse?.name,
        locationId: bal.locationId,
        currentBalance: bal.quantity, expectedBalance: expected, difference: diff,
        status,
      })
    }

    const total = lines.length
    const paginated = lines.slice(skip, skip + limit)
    return { data: paginated, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async reconciliationByProduct(productId: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { productId },
      include: { warehouse: { select: { id: true, code: true, name: true } }, product: { select: { id: true, code: true, name: true } } },
    })
    const lines = []
    for (const bal of balances) {
      const expected = await this.computeExpectedBalance(bal.productId, bal.warehouseId, bal.locationId)
      const diff = bal.quantity - expected
      lines.push({
        warehouseId: bal.warehouseId, warehouseName: bal.warehouse?.name,
        locationId: bal.locationId,
        currentBalance: bal.quantity, expectedBalance: expected, difference: diff,
        status: diff === 0 ? 'MATCHED' : 'DIFFERENCE',
      })
    }
    const totalCurrent = lines.reduce((s, l) => s + l.currentBalance, 0)
    const totalExpected = lines.reduce((s, l) => s + l.expectedBalance, 0)
    return { productId, productName: balances[0]?.product?.name, warehouses: lines, totalCurrentBalance: totalCurrent, totalExpectedBalance: totalExpected, totalDifference: totalCurrent - totalExpected }
  }

  async reconciliationByWarehouse(warehouseId: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      include: { product: { select: { id: true, code: true, name: true } } },
    })
    const lines = []
    for (const bal of balances) {
      const expected = await this.computeExpectedBalance(bal.productId, bal.warehouseId, bal.locationId)
      const diff = bal.quantity - expected
      lines.push({
        productId: bal.productId, productName: bal.product?.name,
        locationId: bal.locationId,
        currentBalance: bal.quantity, expectedBalance: expected, difference: diff,
        status: diff === 0 ? 'MATCHED' : 'DIFFERENCE',
      })
    }
    const totalCurrent = lines.reduce((s, l) => s + l.currentBalance, 0)
    const totalExpected = lines.reduce((s, l) => s + l.expectedBalance, 0)
    return { warehouseId, products: lines, totalCurrentBalance: totalCurrent, totalExpectedBalance: totalExpected, totalDifference: totalCurrent - totalExpected }
  }

  async reconciliationDifferences(query: { page?: number; limit?: number; warehouseId?: string }) {
    const full = await this.reconciliationDetails({ page: 1, limit: 10000, warehouseId: query.warehouseId })
    const diffs = full.data.filter((l: any) => l.status === 'DIFFERENCE' || l.status === 'NEGATIVE_BALANCE')
    const page = Number(query.page) || 1; const limit = Number(query.limit) || 20; const skip = (page - 1) * limit
    const paginated = diffs.slice(skip, skip + limit)
    return { data: paginated, meta: { page, limit, total: diffs.length, totalPages: Math.ceil(diffs.length / limit) } }
  }

  async reconciliationOrphans() {
    const balanceProductWarehouses = await this.prisma.inventoryBalance.findMany({
      select: { productId: true, warehouseId: true },
      distinct: ['productId', 'warehouseId'],
    })

    const orphanBalances: any[] = []
    for (const bw of balanceProductWarehouses) {
      const count = await this.prisma.inventoryMovement.count({
        where: { status: 'POSTED', deletedAt: null, warehouseId: bw.warehouseId, lines: { some: { productId: bw.productId } } },
      })
      if (count === 0) {
        const bal = await this.prisma.inventoryBalance.findFirst({
          where: { productId: bw.productId, warehouseId: bw.warehouseId },
          include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } } },
        })
        if (bal && bal.quantity !== 0) {
          orphanBalances.push({ productId: bw.productId, productName: bal.product?.name, warehouseId: bw.warehouseId, warehouseName: bal.warehouse?.name, currentBalance: bal.quantity, status: 'ORPHAN_BALANCE' })
        }
      }
    }

    const movementProductWarehouses = await this.prisma.inventoryMovement.findMany({
      where: { status: 'POSTED', deletedAt: null },
      select: { warehouseId: true, lines: { select: { productId: true } } },
    })
    const mvtPairs = new Set<string>()
    for (const m of movementProductWarehouses) {
      for (const l of m.lines) mvtPairs.add(`${m.warehouseId}:${l.productId}`)
    }

    const orphanMovements: any[] = []
    for (const pair of mvtPairs) {
      const [whId, prodId] = pair.split(':')
      const bal = await this.prisma.inventoryBalance.findFirst({ where: { warehouseId: whId, productId: prodId } })
      if (!bal) {
        orphanMovements.push({ warehouseId: whId, productId: prodId, status: 'ORPHAN_MOVEMENT' })
      }
    }

    return { orphanBalances, orphanMovements, totalOrphanBalances: orphanBalances.length, totalOrphanMovements: orphanMovements.length }
  }

  async reconciliationNegativeBalances() {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { quantity: { lt: 0 } },
      include: { product: { select: { id: true, code: true, name: true } }, warehouse: { select: { id: true, code: true, name: true } } },
      orderBy: { quantity: 'asc' },
    })
    const lines = []
    for (const bal of balances) {
      const expected = await this.computeExpectedBalance(bal.productId, bal.warehouseId, bal.locationId)
      lines.push({
        productId: bal.productId, productName: bal.product?.name,
        warehouseId: bal.warehouseId, warehouseName: bal.warehouse?.name,
        currentBalance: bal.quantity, expectedBalance: expected, difference: bal.quantity - expected,
        status: 'NEGATIVE_BALANCE',
      })
    }
    return { data: lines, total: lines.length }
  }
}
