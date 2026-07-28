import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditService } from '../../../common/audit/audit.service'
import { CreateInventoryLockDto } from './dto/create-lock.dto'
import { UpdateInventoryLockDto } from './dto/update-lock.dto'
import { LockQueryDto, LockCheckDto } from './dto/lock-query.dto'

@Injectable()
export class InventoryLocksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateInventoryLockDto, userId: string) {
    if (new Date(dto.dateTo) <= new Date(dto.dateFrom)) {
      throw new BadRequestException('dateTo must be after dateFrom')
    }
    const code = dto.code.trim()
    const existing = await this.prisma.inventoryLock.findFirst({ where: { code } })
    if (existing) throw new ConflictException('Lock code already exists')
    const lock = await this.prisma.inventoryLock.create({
      data: {
        code,
        lockType: dto.lockType,
        status: 'ACTIVE',
        dateFrom: new Date(dto.dateFrom),
        dateTo: new Date(dto.dateTo),
        warehouseId: dto.warehouseId ?? null,
        locationId: dto.locationId ?? null,
        productId: dto.productId ?? null,
        sparePartId: dto.sparePartId ?? null,
        reason: dto.reason,
        notes: dto.notes ?? null,
        createdByUserId: userId,
      },
    })
    await this.audit.log({ userId, action: 'CREATE', entity: 'inventory-lock', entityId: lock.id, details: `Created lock ${code} of type ${dto.lockType}` })
    return lock
  }

  async findAll(query: LockQueryDto) {
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.lockType) where.lockType = query.lockType
    if (query.warehouseId) where.warehouseId = query.warehouseId
    if (query.locationId) where.locationId = query.locationId
    if (query.productId) where.productId = query.productId
    if (query.dateFrom || query.dateTo) {
      where.dateFrom = {}
      if (query.dateFrom) where.dateFrom.gte = new Date(query.dateFrom)
    }
    const [data, total] = await Promise.all([
      this.prisma.inventoryLock.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.inventoryLock.count({ where }),
    ])
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async findOne(id: string) {
    const lock = await this.prisma.inventoryLock.findUnique({ where: { id } })
    if (!lock) throw new NotFoundException('Inventory lock not found')
    return lock
  }

  async update(id: string, dto: UpdateInventoryLockDto, userId: string) {
    const lock = await this.findOne(id)
    const data: any = {}
    if (dto.code !== undefined) data.code = dto.code.trim()
    if (dto.lockType !== undefined) data.lockType = dto.lockType
    if (dto.reason !== undefined) data.reason = dto.reason
    if (dto.notes !== undefined) data.notes = dto.notes
    if (dto.dateFrom !== undefined) data.dateFrom = new Date(dto.dateFrom)
    if (dto.dateTo !== undefined) {
      data.dateTo = new Date(dto.dateTo)
      const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : lock.dateFrom
      if (data.dateTo <= dateFrom) throw new BadRequestException('dateTo must be after dateFrom')
    }
    if (dto.warehouseId !== undefined) data.warehouseId = dto.warehouseId ?? null
    if (dto.locationId !== undefined) data.locationId = dto.locationId ?? null
    if (dto.productId !== undefined) data.productId = dto.productId ?? null
    if (dto.sparePartId !== undefined) data.sparePartId = dto.sparePartId ?? null
    const updated = await this.prisma.inventoryLock.update({ where: { id }, data })
    await this.audit.log({ userId, action: 'UPDATE', entity: 'inventory-lock', entityId: id, details: `Updated lock ${updated.code}` })
    return updated
  }

  async activate(id: string, userId: string) {
    const lock = await this.findOne(id)
    if (lock.status === 'ACTIVE') throw new BadRequestException('Lock is already active')
    const updated = await this.prisma.inventoryLock.update({
      where: { id },
      data: { status: 'ACTIVE', activatedByUserId: userId, activatedAt: new Date() },
    })
    await this.audit.log({ userId, action: 'ACTIVATE', entity: 'inventory-lock', entityId: id, details: `Activated lock ${updated.code}` })
    return updated
  }

  async deactivate(id: string, userId: string) {
    const lock = await this.findOne(id)
    if (lock.status === 'INACTIVE') throw new BadRequestException('Lock is already inactive')
    const updated = await this.prisma.inventoryLock.update({
      where: { id },
      data: { status: 'INACTIVE', deactivatedByUserId: userId, deactivatedAt: new Date() },
    })
    await this.audit.log({ userId, action: 'DEACTIVATE', entity: 'inventory-lock', entityId: id, details: `Deactivated lock ${updated.code}` })
    return updated
  }

  async remove(id: string, userId: string) {
    const lock = await this.findOne(id)
    await this.prisma.inventoryLock.delete({ where: { id } })
    await this.audit.log({ userId, action: 'DELETE', entity: 'inventory-lock', entityId: id, details: `Deleted lock ${lock.code}` })
    return { message: 'Lock deleted successfully' }
  }

  async checkLock(dto: LockCheckDto): Promise<{ locked: boolean; locks: any[]; message?: string }> {
    const checkDate = new Date(dto.date)
    const where: any = {
      status: 'ACTIVE',
      dateFrom: { lte: checkDate },
      dateTo: { gte: checkDate },
    }
    const orConditions: any[] = []
    if (dto.warehouseId) {
      orConditions.push({ warehouseId: dto.warehouseId, lockType: { in: ['WAREHOUSE_LOCK', 'GLOBAL_INVENTORY_LOCK'] } })
    }
    if (dto.locationId) {
      orConditions.push({ locationId: dto.locationId, lockType: { in: ['LOCATION_LOCK', 'GLOBAL_INVENTORY_LOCK'] } })
    }
    if (dto.productId) {
      orConditions.push({ productId: dto.productId, lockType: { in: ['ITEM_LOCK', 'GLOBAL_INVENTORY_LOCK'] } })
    }
    if (dto.sparePartId) {
      orConditions.push({ sparePartId: dto.sparePartId, lockType: { in: ['ITEM_LOCK', 'GLOBAL_INVENTORY_LOCK'] } })
    }
    orConditions.push({ lockType: 'PERIOD_LOCK' })
    orConditions.push({ lockType: 'GLOBAL_INVENTORY_LOCK' })
    where.OR = orConditions
    const locks = await this.prisma.inventoryLock.findMany({ where })
    if (locks.length > 0) {
      return { locked: true, locks, message: 'Operation blocked by active inventory lock(s)' }
    }
    return { locked: false, locks: [] }
  }
}
