import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditService } from '../../../common/audit/audit.service'
import * as path from 'path'
import * as fs from 'fs'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'

type AuditActor = { id?: string; sub?: string; employeeId?: string | null }

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
]

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.js', '.vbs', '.vbe', '.wsf', '.wsh', '.ps1', '.psm1',
  '.sh', '.bash', '.csh', '.ksh',
  '.jar', '.class', '.py', '.rb', '.pl',
  '.dll', '.so', '.dylib',
  '.php', '.asp', '.aspx', '.jsp', '.cgi',
  '.hta', '.cpl', '.inf', '.reg', '.scr',
])

const MAX_UPLOAD_SIZE_BYTES = (() => {
  const mb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10)
  return (isNaN(mb) || mb < 1 ? 10 : mb) * 1024 * 1024
})()

@Injectable()
export class AttachmentsService {
  private uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), '../../storage/uploads')

  constructor(
    private readonly prisma: PrismaService,
    // Optional injection: modules are owned by another integration step.
    @Optional() private auditService?: AuditService,
  ) {
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true })
    }
  }

  private get audit(): AuditService | undefined {
    // Guard test doubles that omit auditLog; real PrismaService always exposes it.
    if (!this.auditService && (this.prisma as any).auditLog?.create) this.auditService = new AuditService(this.prisma)
    return this.auditService
  }

  private auditIdentity(userId: string | null | undefined, ctx: ActiveOperationalContext, actor?: AuditActor) {
    const candidate = actor ?? (ctx as any)?.actor ?? (ctx as any)?.user
    return {
      userId: actor?.id ?? actor?.sub ?? userId ?? (ctx as any)?.userId ?? (ctx as any)?.actorUserId,
      employeeId: candidate?.employeeId ?? null,
    }
  }

  private auditScope(ctx: ActiveOperationalContext) {
    return {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      scope: ctx.source ?? 'EXPLICIT_SCOPE',
    }
  }

  static getMaxUploadSize(): number {
    return MAX_UPLOAD_SIZE_BYTES
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('File is required')

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException({
        messageKey: 'attachments.fileTooLarge',
        message: `File size exceeds maximum allowed size of ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB`,
      })
    }

    const ext = path.extname(file.originalname).toLowerCase()
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new BadRequestException({
        messageKey: 'attachments.fileTypeBlocked',
        message: `File type '${ext}' is not allowed`,
      })
    }

    const mimeAllowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
      file.mimetype === prefix || file.mimetype.startsWith(prefix + ';'),
    )
    if (!mimeAllowed) {
      throw new BadRequestException({
        messageKey: 'attachments.invalidMimeType',
        message: `MIME type '${file.mimetype}' is not allowed`,
      })
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

  async create(file: Express.Multer.File, entityName: string, entityId: string, description: string | undefined, userId: string | undefined, ctx: ActiveOperationalContext, actor?: AuditActor) {
    this.validateFile(file)
    await this.assertEntityOwned(entityName, entityId, ctx)
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(this.uploadRoot, safeName)
    fs.writeFileSync(filePath, file.buffer)
    const created = await this.prisma.attachment.create({
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
    const identity = this.auditIdentity(userId, ctx, actor)
    await this.audit?.log(identity.userId, 'CREATE', 'Attachment', created.id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: description || undefined,
      next: { entityName: created.entityName, entityId: created.entityId, originalName: created.originalName, mimeType: created.mimeType, size: created.size },
    })
    return created
  }

  async update(id: string, dto: { entityName?: string; entityId?: string; description?: string }, ctx: ActiveOperationalContext, actor?: AuditActor) {
    const current = await this.findOne(id, ctx)
    const entityName = dto.entityName ?? current.entityName
    const entityId = dto.entityId ?? current.entityId
    await this.assertEntityOwned(entityName, entityId, ctx)
    const updated = await this.prisma.attachment.update({ where: { id }, data: { entityName, entityId } })
    const identity = this.auditIdentity(current.uploadedById, ctx, actor)
    await this.audit?.log(identity.userId, 'UPDATE', 'Attachment', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: dto.description || undefined,
      previous: { entityName: current.entityName, entityId: current.entityId },
      next: { entityName: updated.entityName, entityId: updated.entityId },
    })
    return updated
  }

  async remove(id: string, ctx: ActiveOperationalContext, actor?: AuditActor) {
    const attachment = await this.findOne(id, ctx)
    const fullPath = path.join(this.uploadRoot, attachment.filePath)
    try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath) } catch {}
    const deleted = await this.prisma.attachment.delete({ where: { id } })
    const identity = this.auditIdentity(attachment.uploadedById, ctx, actor)
    await this.audit?.log(identity.userId, 'DELETE', 'Attachment', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'ATTACHMENT_DELETED',
      previous: { entityName: attachment.entityName, entityId: attachment.entityId, originalName: attachment.originalName },
    })
    return deleted
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
        // Prisma rejects `in: [branchId, null]` for a nullable field
        // (PrismaClientValidationError), so the branch-or-null scope must be
        // expressed as an explicit OR (same shape as `machineScope`).
        owned = await this.prisma.shiftHandover.findFirst({ where: { id: entityId, companyId: ctx.companyId, OR: [{ branchId: ctx.branchId }, { branchId: null }], deletedAt: null }, select: { id: true } })
        break
      default:
        throw new BadRequestException({ messageKey: 'attachments.unsupportedEntityType' })
    }
    if (!owned) throw new BadRequestException({ messageKey: 'attachments.invalidEntityReference' })
  }
}
