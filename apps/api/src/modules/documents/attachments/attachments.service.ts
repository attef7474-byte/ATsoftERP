import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import * as path from 'path'
import * as fs from 'fs'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'

@Injectable()
export class AttachmentsService {
  private uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), '../../storage/uploads')

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true })
    }
  }

  async findAll(ctx: ActiveOperationalContext, page = 1, pageSize = 20, entityType?: string, mimeType?: string) {
    const skip = (page - 1) * pageSize
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId }
    if (entityType === 'ProductionOrder') return { data: [], total: 0, page, pageSize }
    if (entityType) where.entityName = entityType
    else where.entityName = { not: 'ProductionOrder' }
    if (mimeType) where.mimeType = { startsWith: mimeType }
    const [data, total] = await Promise.all([
      this.prisma.attachment.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' }, include: { uploadedBy: { select: { id: true, name: true } } } }),
      this.prisma.attachment.count({ where }),
    ])
    return { data, total, page, pageSize }
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const attachment = await this.prisma.attachment.findFirst({ where: { id, companyId: ctx.companyId, branchId: ctx.branchId }, include: { uploadedBy: { select: { id: true, name: true } } } })
    if (!attachment) throw new NotFoundException('Attachment not found')
    return attachment
  }

  async create(file: Express.Multer.File, entityName: string, entityId: string, description: string | undefined, userId: string | undefined, ctx: ActiveOperationalContext) {
    if (!file) throw new BadRequestException('File is required')
    await this.assertEntityOwned(entityName, entityId, ctx)
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(this.uploadRoot, safeName)
    fs.writeFileSync(filePath, file.buffer)
    return this.prisma.attachment.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        entityName: entityName || 'general',
        entityId: entityId || 'general',
        originalName: file.originalname,
        filePath: safeName,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: userId || null,
      },
    })
  }

  async update(id: string, dto: { entityName?: string; entityId?: string; description?: string }, ctx: ActiveOperationalContext) {
    const current = await this.findOne(id, ctx)
    const entityName = dto.entityName ?? current.entityName
    const entityId = dto.entityId ?? current.entityId
    await this.assertEntityOwned(entityName, entityId, ctx)
    return this.prisma.attachment.update({ where: { id }, data: { entityName, entityId } })
  }

  async remove(id: string, ctx: ActiveOperationalContext) {
    const attachment = await this.findOne(id, ctx)
    const fullPath = path.join(this.uploadRoot, attachment.filePath)
    try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath) } catch {}
    return this.prisma.attachment.delete({ where: { id } })
  }

  async findByEntity(entityType: string, entityId: string, ctx: ActiveOperationalContext) {
    if (entityType === 'ProductionOrder') return []
    await this.assertEntityOwned(entityType, entityId, ctx)
    return this.prisma.attachment.findMany({ where: { companyId: ctx.companyId, branchId: ctx.branchId, entityName: entityType, entityId }, orderBy: { createdAt: 'desc' } })
  }

  getFilePath(attachment: { filePath: string }): string {
    return path.join(this.uploadRoot, attachment.filePath)
  }

  private async assertEntityOwned(entityName: string, entityId: string, ctx: ActiveOperationalContext): Promise<void> {
    if (!entityName || !entityId) throw new BadRequestException({ messageKey: 'attachments.entityRequired' })
    const machineScope = { companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }] }
    let owned: { id: string } | null = null
    switch (entityName.toUpperCase()) {
      case 'MACHINE':
        owned = await this.prisma.machine.findFirst({ where: { id: entityId, ...machineScope }, select: { id: true } })
        break
      case 'MAINTENANCE_REQUEST':
        owned = await this.prisma.maintenanceRequest.findFirst({ where: { id: entityId, machine: machineScope }, select: { id: true } })
        break
      case 'PRODUCTIONORDER':
      case 'PRODUCTION_ORDER':
        owned = await this.prisma.productionOrder.findFirst({ where: { id: entityId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null }, select: { id: true } })
        break
      case 'PRODUCTIONNONCONFORMANCE':
      case 'PRODUCTION_NONCONFORMANCE':
        owned = await this.prisma.productionNonconformance.findFirst({ where: { id: entityId, companyId: ctx.companyId, branchId: ctx.branchId }, select: { id: true } })
        break
      case 'SHIFT_HANDOVER':
        owned = await this.prisma.shiftHandover.findFirst({ where: { id: entityId, companyId: ctx.companyId, deletedAt: null }, select: { id: true } })
        break
      default:
        throw new BadRequestException({ messageKey: 'attachments.unsupportedEntityType' })
    }
    if (!owned) throw new BadRequestException({ messageKey: 'attachments.invalidEntityReference' })
  }
}
