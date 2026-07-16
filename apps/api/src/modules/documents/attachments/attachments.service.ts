import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class AttachmentsService {
  private uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), '../../storage/uploads')

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true })
    }
  }

  async findAll(page = 1, pageSize = 20, entityType?: string, mimeType?: string) {
    const skip = (page - 1) * pageSize
    const where: any = {}
    if (entityType) where.entityName = entityType
    if (mimeType) where.mimeType = { startsWith: mimeType }
    const [data, total] = await Promise.all([
      this.prisma.attachment.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' }, include: { uploadedBy: { select: { id: true, name: true } } } }),
      this.prisma.attachment.count({ where }),
    ])
    return { data, total, page, pageSize }
  }

  async findOne(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id }, include: { uploadedBy: { select: { id: true, name: true } } } })
    if (!attachment) throw new NotFoundException('Attachment not found')
    return attachment
  }

  async create(file: Express.Multer.File, entityName: string, entityId: string, description?: string, userId?: string) {
    if (!file) throw new BadRequestException('File is required')
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(this.uploadRoot, safeName)
    fs.writeFileSync(filePath, file.buffer)
    return this.prisma.attachment.create({
      data: {
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

  async update(id: string, dto: { entityName?: string; entityId?: string; description?: string }) {
    await this.findOne(id)
    return this.prisma.attachment.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    const attachment = await this.findOne(id)
    const fullPath = path.join(this.uploadRoot, attachment.filePath)
    try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath) } catch {}
    return this.prisma.attachment.delete({ where: { id } })
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.attachment.findMany({ where: { entityName: entityType, entityId }, orderBy: { createdAt: 'desc' } })
  }

  getFilePath(attachment: { filePath: string }): string {
    return path.join(this.uploadRoot, attachment.filePath)
  }
}
