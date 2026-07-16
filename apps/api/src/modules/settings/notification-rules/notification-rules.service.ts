import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'

@Injectable()
export class NotificationRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 20, eventType?: string, enabled?: string) {
    const skip = (page - 1) * pageSize
    const where: any = {}
    if (eventType) where.eventType = eventType
    if (enabled !== undefined) where.enabled = enabled === 'true'
    const [data, total] = await Promise.all([
      this.prisma.notificationRule.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.notificationRule.count({ where }),
    ])
    return { data, total, page, pageSize }
  }

  async findOne(id: string) {
    const rule = await this.prisma.notificationRule.findUnique({ where: { id } })
    if (!rule) throw new NotFoundException('Notification rule not found')
    return rule
  }

  async create(dto: { code: string; nameAr: string; nameEn: string; description?: string; eventType: string; channel?: string; severity?: string; enabled?: boolean; targetRoleId?: string; targetPermission?: string }) {
    return this.prisma.notificationRule.create({ data: { code: dto.code, nameAr: dto.nameAr, nameEn: dto.nameEn, description: dto.description, eventType: dto.eventType, channel: dto.channel || 'IN_APP', severity: dto.severity || 'INFO', enabled: dto.enabled ?? true, targetRoleId: dto.targetRoleId, targetPermission: dto.targetPermission } })
  }

  async update(id: string, dto: Partial<{ nameAr: string; nameEn: string; description: string; eventType: string; channel: string; severity: string; enabled: boolean; targetRoleId: string; targetPermission: string }>) {
    await this.findOne(id)
    return this.prisma.notificationRule.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.notificationRule.delete({ where: { id } })
  }

  async activate(id: string) {
    await this.findOne(id)
    return this.prisma.notificationRule.update({ where: { id }, data: { enabled: true } })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.notificationRule.update({ where: { id }, data: { enabled: false } })
  }
}
