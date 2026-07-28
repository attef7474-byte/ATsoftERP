import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class InventoryLockGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const body = request.body || {}

    const operationDate = body.date || body.dateFrom || body.createdAt || new Date().toISOString()
    const checkDate = new Date(operationDate)
    const warehouseId = body.warehouseId || body.fromWarehouseId || body.toWarehouseId
    const locationId = body.locationId || body.fromLocationId || body.toLocationId
    const productId = body.productId || body.itemId

    if (!warehouseId && !locationId && !productId) return true

    const where: any = {
      status: 'ACTIVE',
      dateFrom: { lte: checkDate },
      dateTo: { gte: checkDate },
      OR: [],
    }

    const lockTypes: string[] = []
    if (warehouseId) {
      lockTypes.push('WAREHOUSE_LOCK', 'GLOBAL_INVENTORY_LOCK')
    }
    if (locationId) {
      lockTypes.push('LOCATION_LOCK', 'GLOBAL_INVENTORY_LOCK')
    }
    if (productId) {
      lockTypes.push('ITEM_LOCK', 'GLOBAL_INVENTORY_LOCK')
    }
    lockTypes.push('PERIOD_LOCK')

    const lockWhere: any[] = []
    const seen = new Set<string>()
    for (const lt of lockTypes) {
      if (!seen.has(lt)) {
        seen.add(lt)
        const condition: any = { lockType: lt }
        if (lt === 'WAREHOUSE_LOCK' && warehouseId) condition.warehouseId = warehouseId
        if (lt === 'LOCATION_LOCK' && locationId) condition.locationId = locationId
        if (lt === 'ITEM_LOCK' && productId) condition.productId = productId
        lockWhere.push(condition)
      }
    }
    where.OR = lockWhere

    const locks = await this.prisma.inventoryLock.findMany({ where, take: 1 })
    if (locks.length > 0) {
      throw new ForbiddenException('Operation blocked by active inventory lock')
    }
    return true
  }
}
