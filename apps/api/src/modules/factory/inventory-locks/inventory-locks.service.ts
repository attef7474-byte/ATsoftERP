import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditService } from '../../../common/audit/audit.service'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'
import { CreateInventoryLockDto } from './dto/create-lock.dto'
import { UpdateInventoryLockDto } from './dto/update-lock.dto'
import { LockCheckDto, LockQueryDto } from './dto/lock-query.dto'

type LockReferences = {
  warehouseId: string | null
  locationId: string | null
  productId: string | null
  sparePartId: string | null
}

@Injectable()
export class InventoryLocksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateInventoryLockDto, userId: string, ctx: ActiveOperationalContext) {
    const dateFrom = this.parseDate(dto.dateFrom, 'dateFrom')
    const dateTo = this.parseDate(dto.dateTo, 'dateTo')
    this.assertDateRange(dateFrom, dateTo)
    const code = this.requiredText(dto.code, 'code', 2)
    const reason = this.requiredText(dto.reason, 'reason', 5)

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryLock.findFirst({
        where: { ...this.tenantWhere(ctx), code },
        select: { id: true },
      })
      if (existing) throw this.conflict('code', 'Lock code already exists in the active context')

      const references = await this.resolveReferences(tx, dto, ctx)
      this.assertLockReferenceContract(dto.lockType, references)

      const lock = await tx.inventoryLock.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          code,
          lockType: dto.lockType,
          status: 'ACTIVE',
          dateFrom,
          dateTo,
          ...references,
          reason,
          notes: this.optionalText(dto.notes),
          createdByUserId: userId,
        },
      })
      await this.audit.logWithClient(tx, {
        userId,
        action: 'CREATE',
        entity: 'inventory-lock',
        entityId: lock.id,
        details: { code, lockType: dto.lockType, companyId: ctx.companyId, branchId: ctx.branchId },
      })
      return lock
    })
  }

  async findAll(query: LockQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit
    const where: any = this.tenantWhere(ctx)
    if (query.status) where.status = query.status
    if (query.lockType) where.lockType = query.lockType
    if (query.warehouseId) where.warehouseId = query.warehouseId.trim()
    if (query.locationId) where.locationId = query.locationId.trim()
    if (query.productId) where.productId = query.productId.trim()
    if (query.sparePartId) where.sparePartId = query.sparePartId.trim()
    if (query.dateFrom) where.dateTo = { gte: this.parseDate(query.dateFrom, 'dateFrom') }
    if (query.dateTo) where.dateFrom = { lte: this.parseDate(query.dateTo, 'dateTo') }

    const [data, total] = await Promise.all([
      this.prisma.inventoryLock.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.inventoryLock.count({ where }),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    return this.findOwnedWithClient(this.prisma, id, ctx)
  }

  async update(id: string, dto: UpdateInventoryLockDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOwnedWithClient(tx, id, ctx)
      const code = dto.code === undefined ? current.code : this.requiredText(dto.code, 'code', 2)
      const reason = dto.reason === undefined ? current.reason : this.requiredText(dto.reason, 'reason', 5)
      const lockType = dto.lockType ?? current.lockType
      const dateFrom = dto.dateFrom === undefined ? current.dateFrom : this.parseDate(dto.dateFrom, 'dateFrom')
      const dateTo = dto.dateTo === undefined ? current.dateTo : this.parseDate(dto.dateTo, 'dateTo')
      this.assertDateRange(dateFrom, dateTo)

      const duplicate = await tx.inventoryLock.findFirst({
        where: { ...this.tenantWhere(ctx), code, id: { not: id } },
        select: { id: true },
      })
      if (duplicate) throw this.conflict('code', 'Lock code already exists in the active context')

      const references = await this.resolveReferences(tx, {
        warehouseId: dto.warehouseId === undefined ? current.warehouseId : dto.warehouseId,
        locationId: dto.locationId === undefined ? current.locationId : dto.locationId,
        productId: dto.productId === undefined ? current.productId : dto.productId,
        sparePartId: dto.sparePartId === undefined ? current.sparePartId : dto.sparePartId,
      }, ctx)
      this.assertLockReferenceContract(lockType, references)

      const mutation = await tx.inventoryLock.updateMany({
        where: { id, ...this.tenantWhere(ctx) },
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          code,
          lockType,
          dateFrom,
          dateTo,
          ...references,
          reason,
          notes: dto.notes === undefined ? current.notes : this.optionalText(dto.notes),
        },
      })
      if (mutation.count !== 1) throw this.notFound()

      const updated = await this.findOwnedWithClient(tx, id, ctx)
      await this.audit.logWithClient(tx, {
        userId,
        action: 'UPDATE',
        entity: 'inventory-lock',
        entityId: id,
        details: { code: updated.code, companyId: ctx.companyId, branchId: ctx.branchId },
      })
      return updated
    })
  }

  async activate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.setActivation(id, 'ACTIVE', userId, ctx)
  }

  async deactivate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.setActivation(id, 'INACTIVE', userId, ctx)
  }

  async remove(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const lock = await this.findOwnedWithClient(tx, id, ctx)
      const mutation = await tx.inventoryLock.deleteMany({ where: { id, ...this.tenantWhere(ctx) } })
      if (mutation.count !== 1) throw this.notFound()
      await this.audit.logWithClient(tx, {
        userId,
        action: 'DELETE',
        entity: 'inventory-lock',
        entityId: id,
        details: { code: lock.code, companyId: ctx.companyId, branchId: ctx.branchId },
      })
      return { message: 'Lock deleted successfully' }
    })
  }

  async checkLock(dto: LockCheckDto, ctx: ActiveOperationalContext): Promise<{ locked: boolean; locks: any[]; message?: string }> {
    const checkDate = this.parseDate(dto.date, 'date')
    const references = await this.resolveReferences(this.prisma, dto, ctx)
    const orConditions: any[] = [
      { lockType: 'PERIOD_LOCK' },
      { lockType: 'GLOBAL_INVENTORY_LOCK' },
    ]
    if (references.warehouseId) {
      orConditions.push({ lockType: 'WAREHOUSE_LOCK', warehouseId: references.warehouseId })
    }
    if (references.locationId) {
      orConditions.push({ lockType: 'LOCATION_LOCK', locationId: references.locationId })
    }
    if (references.productId) {
      orConditions.push({ lockType: 'ITEM_LOCK', productId: references.productId })
    }
    if (references.sparePartId) {
      orConditions.push({ lockType: 'ITEM_LOCK', sparePartId: references.sparePartId })
    }

    const locks = await this.prisma.inventoryLock.findMany({
      where: {
        ...this.tenantWhere(ctx),
        status: 'ACTIVE',
        dateFrom: { lte: checkDate },
        dateTo: { gte: checkDate },
        OR: orConditions,
      },
    })
    if (locks.length > 0) {
      return { locked: true, locks, message: 'Operation blocked by active inventory lock(s)' }
    }
    return { locked: false, locks: [] }
  }

  private async setActivation(id: string, status: 'ACTIVE' | 'INACTIVE', userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const lock = await this.findOwnedWithClient(tx, id, ctx)
      if (lock.status === status) {
        throw this.validationError('status', 'validation.invalidValue', `Lock is already ${status.toLowerCase()}`)
      }
      const now = new Date()
      const data = status === 'ACTIVE'
        ? { status, activatedByUserId: userId, activatedAt: now }
        : { status, deactivatedByUserId: userId, deactivatedAt: now }
      const mutation = await tx.inventoryLock.updateMany({
        where: { id, ...this.tenantWhere(ctx) },
        data,
      })
      if (mutation.count !== 1) throw this.notFound()
      const updated = await this.findOwnedWithClient(tx, id, ctx)
      await this.audit.logWithClient(tx, {
        userId,
        action: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE',
        entity: 'inventory-lock',
        entityId: id,
        details: { code: lock.code, companyId: ctx.companyId, branchId: ctx.branchId },
      })
      return updated
    })
  }

  private async findOwnedWithClient(client: any, id: string, ctx: ActiveOperationalContext) {
    const lock = await client.inventoryLock.findFirst({ where: { id, ...this.tenantWhere(ctx) } })
    if (!lock) throw this.notFound()
    return lock
  }

  private async resolveReferences(
    client: any,
    input: Partial<LockReferences>,
    ctx: ActiveOperationalContext,
  ): Promise<LockReferences> {
    let warehouseId = this.optionalId(input.warehouseId)
    const locationId = this.optionalId(input.locationId)
    const productId = this.optionalId(input.productId)
    const sparePartId = this.optionalId(input.sparePartId)

    if (locationId) {
      const location = await client.warehouseLocation.findUnique({ where: { id: locationId } })
      if (!location || (location.status != null && location.status !== 'ACTIVE')) {
        throw this.validationError('locationId', 'validation.invalidReference', 'Location not found or inactive')
      }
      if (warehouseId && warehouseId !== location.warehouseId) {
        throw this.validationError('locationId', 'validation.invalidReference', 'Location does not belong to the selected warehouse')
      }
      await this.assertWarehouseInContext(client, location.warehouseId, ctx)
      warehouseId = location.warehouseId
    } else if (warehouseId) {
      await this.assertWarehouseInContext(client, warehouseId, ctx)
    }

    if (productId) {
      const product = await client.product.findUnique({ where: { id: productId } })
      if (!product || product.deletedAt != null || (product.status != null && product.status !== 'ACTIVE')) {
        throw this.validationError('productId', 'validation.invalidReference', 'Product not found, deleted, or inactive')
      }
    }
    if (sparePartId) {
      const sparePart = await client.sparePart.findUnique({ where: { id: sparePartId } })
      if (!sparePart || sparePart.deletedAt != null || (sparePart.status != null && sparePart.status !== 'ACTIVE')) {
        throw this.validationError('sparePartId', 'validation.invalidReference', 'Spare part not found, deleted, or inactive')
      }
    }

    return { warehouseId, locationId, productId, sparePartId }
  }

  private async assertWarehouseInContext(client: any, warehouseId: string, ctx: ActiveOperationalContext) {
    const warehouse = await client.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse || warehouse.deletedAt != null || (warehouse.status != null && warehouse.status !== 'ACTIVE')) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse not found, deleted, or inactive')
    }
    if (warehouse.companyId !== ctx.companyId || (warehouse.branchId != null && warehouse.branchId !== ctx.branchId)) {
      throw this.validationError('warehouseId', 'validation.invalidReference', 'Warehouse is outside the active operational context')
    }
    return warehouse
  }

  private assertLockReferenceContract(lockType: string, references: LockReferences) {
    if (lockType === 'WAREHOUSE_LOCK' && !references.warehouseId) {
      throw this.validationError('warehouseId', 'validation.required', 'Warehouse is required for a warehouse lock')
    }
    if (lockType === 'LOCATION_LOCK' && !references.locationId) {
      throw this.validationError('locationId', 'validation.required', 'Location is required for a location lock')
    }
    if (lockType === 'ITEM_LOCK' && !references.productId && !references.sparePartId) {
      throw this.validationError('productId', 'validation.required', 'Product or spare part is required for an item lock')
    }
  }

  private tenantWhere(ctx: ActiveOperationalContext) {
    return { companyId: ctx.companyId, branchId: ctx.branchId }
  }

  private optionalId(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized || null
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized || null
  }

  private requiredText(value: string, field: string, minimumLength: number): string {
    const normalized = value.trim()
    if (normalized.length < minimumLength) {
      throw this.validationError(field, 'validation.tooShort', `${field} is too short`)
    }
    return normalized
  }

  private parseDate(value: string, field: string): Date {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw this.validationError(field, 'validation.invalidDate', 'Invalid date')
    }
    return parsed
  }

  private assertDateRange(dateFrom: Date, dateTo: Date) {
    if (dateTo <= dateFrom) {
      throw this.validationError('dateTo', 'validation.invalidDate', 'dateTo must be after dateFrom')
    }
  }

  private validationError(field: string, code: string, message: string) {
    return new BadRequestException({
      messageKey: 'common.validationFailed',
      message: 'common.validationFailed',
      errors: [{ field, code, messageKey: code, message }],
    })
  }

  private conflict(field: string, message: string) {
    return new ConflictException({
      messageKey: 'common.conflict',
      message: 'common.conflict',
      errors: [{ field, code: 'validation.duplicateValue', messageKey: 'validation.duplicateValue', message }],
    })
  }

  private notFound() {
    return new NotFoundException({ messageKey: 'common.notFound', message: 'common.notFound' })
  }
}
