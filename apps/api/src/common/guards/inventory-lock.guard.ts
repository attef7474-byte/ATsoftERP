import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ActiveContextService } from '../operational-context/active-context.service'
import { ActiveOperationalContext, OperationalContextSelection } from '../operational-context/operational-context.types'

@Injectable()
export class InventoryLockGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private activeContextService: ActiveContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    if (['GET', 'HEAD', 'OPTIONS'].includes(String(request.method || '').toUpperCase())) return true
    const ctx = request.activeContext || await this.resolveContext(request)
    const body = request.body || {}
    const warehouseIds = this.collectIds(body, [
      'warehouseId',
      'fromWarehouseId',
      'toWarehouseId',
      'sourceWarehouseId',
      'destinationWarehouseId',
    ])
    const locationIds = this.collectIds(body, [
      'locationId',
      'warehouseLocationId',
      'fromLocationId',
      'toLocationId',
      'sourceLocationId',
      'destinationLocationId',
    ])
    const productIds = this.collectIds(body, ['productId', 'itemId'])
    const sparePartIds = this.collectIds(body, ['sparePartId'])

    // A location operation is also governed by locks on its parent warehouse.
    // Only tenant-compatible location parents are derived; foreign references
    // remain the responsibility of the mutation service's reference guard.
    if (locationIds.length > 0) {
      const locations = await this.prisma.warehouseLocation.findMany({
        where: {
          id: { in: locationIds },
          warehouse: {
            companyId: ctx.companyId,
            OR: [{ branchId: ctx.branchId }, { branchId: null }],
            deletedAt: null,
          },
        },
        select: { warehouseId: true },
      })
      for (const location of locations) warehouseIds.push(location.warehouseId)
    }

    const checkDate = this.operationDate(body)
    const orConditions: any[] = [
      { lockType: 'PERIOD_LOCK' },
      { lockType: 'GLOBAL_INVENTORY_LOCK' },
    ]
    const uniqueWarehouseIds = [...new Set(warehouseIds)]
    if (uniqueWarehouseIds.length > 0) {
      orConditions.push({ lockType: 'WAREHOUSE_LOCK', warehouseId: { in: uniqueWarehouseIds } })
    }
    if (locationIds.length > 0) {
      orConditions.push({ lockType: 'LOCATION_LOCK', locationId: { in: locationIds } })
    }
    if (productIds.length > 0) {
      orConditions.push({ lockType: 'ITEM_LOCK', productId: { in: productIds } })
    }
    if (sparePartIds.length > 0) {
      orConditions.push({ lockType: 'ITEM_LOCK', sparePartId: { in: sparePartIds } })
    }

    const lock = await this.prisma.inventoryLock.findFirst({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        status: 'ACTIVE',
        dateFrom: { lte: checkDate },
        dateTo: { gte: checkDate },
        OR: orConditions,
      },
      select: { id: true },
    })
    if (lock) {
      throw new ForbiddenException({ messageKey: 'common.forbidden', message: 'common.forbidden' })
    }
    return true
  }

  private async resolveContext(request: any): Promise<ActiveOperationalContext> {
    const userId = request.user?.id || request.user?.sub
    const selection: Partial<OperationalContextSelection> = {
      companyId: this.header(request.headers?.['x-active-company-id']),
      branchId: this.header(request.headers?.['x-active-branch-id']),
      administrationId: this.header(request.headers?.['x-active-administration-id']) || null,
      departmentId: this.header(request.headers?.['x-active-department-id']) || null,
    }
    if (!userId || !selection.companyId || !selection.branchId) {
      throw new ForbiddenException({
        messageKey: 'operationalContext.headersRequired',
        message: 'operationalContext.headersRequired',
      })
    }
    return this.activeContextService.validate(userId, selection as OperationalContextSelection)
  }

  private collectIds(body: any, fields: string[]): string[] {
    const values = new Set<string>()
    const nested = [body, ...(Array.isArray(body.lines) ? body.lines : []), ...(Array.isArray(body.items) ? body.items : [])]
    for (const item of nested) {
      if (!item || typeof item !== 'object') continue
      for (const field of fields) {
        const value = item[field]
        if (typeof value === 'string' && value.trim()) values.add(value.trim())
      }
    }
    return [...values]
  }

  private operationDate(body: any): Date {
    const candidate = body.date || body.documentDate || body.dateFrom || body.createdAt
    const parsed = candidate ? new Date(candidate) : new Date()
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  private header(value: string | string[] | undefined): string | undefined {
    const candidate = Array.isArray(value) ? value[0] : value
    return candidate?.trim() || undefined
  }
}
