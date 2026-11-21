import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditService } from '../../../common/audit/audit.service'
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types'

type AuditActor = { id?: string; sub?: string; employeeId?: string | null }

@Injectable()
export class NotificationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    // Optional injection: modules are owned by another integration step.
    @Optional() private auditService?: AuditService,
  ) {}

  private get audit(): AuditService | undefined {
    // Guard test doubles that omit auditLog; real PrismaService always exposes it.
    if (!this.auditService && (this.prisma as any).auditLog?.create) this.auditService = new AuditService(this.prisma)
    return this.auditService
  }

  private auditIdentity(actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const candidate = actor ?? (ctx as any)?.actor ?? (ctx as any)?.user
    return {
      userId: actor?.id ?? actor?.sub ?? (ctx as any)?.userId ?? (ctx as any)?.actorUserId,
      employeeId: candidate?.employeeId ?? null,
    }
  }

  private auditScope(ctx?: ActiveOperationalContext) {
    return {
      companyId: ctx?.companyId ?? null,
      branchId: ctx?.branchId ?? null,
      scope: ctx ? ctx.source : 'GLOBAL',
    }
  }

  private ruleSnapshot(rule: any) {
    return {
      code: rule?.code ?? null,
      eventType: rule?.eventType ?? null,
      channel: rule?.channel ?? null,
      severity: rule?.severity ?? null,
      enabled: rule?.enabled ?? null,
      targetRoleId: rule?.targetRoleId ?? null,
      targetPermission: rule?.targetPermission ?? null,
    }
  }

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

  async create(dto: { code: string; nameAr: string; nameEn: string; description?: string; eventType: string; channel?: string; severity?: string; enabled?: boolean; targetRoleId?: string; targetPermission?: string }, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const created = await this.prisma.notificationRule.create({ data: { code: dto.code, nameAr: dto.nameAr, nameEn: dto.nameEn, description: dto.description, eventType: dto.eventType, channel: dto.channel || 'IN_APP', severity: dto.severity || 'INFO', enabled: dto.enabled ?? true, targetRoleId: dto.targetRoleId, targetPermission: dto.targetPermission } })
    const identity = this.auditIdentity(actor, ctx)
    await this.audit?.log(identity.userId, 'CREATE', 'NotificationRule', created.id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: dto.description || undefined,
      next: this.ruleSnapshot(created),
    })
    return created
  }

  async update(id: string, dto: Partial<{ nameAr: string; nameEn: string; description: string; eventType: string; channel: string; severity: string; enabled: boolean; targetRoleId: string; targetPermission: string }>, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id)
    const updated = await this.prisma.notificationRule.update({ where: { id }, data: dto })
    const identity = this.auditIdentity(actor, ctx)
    await this.audit?.log(identity.userId, 'UPDATE', 'NotificationRule', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: dto.description || undefined,
      previous: this.ruleSnapshot(before),
      next: this.ruleSnapshot(updated),
      changedFields: Object.keys(dto),
    })
    return updated
  }

  async remove(id: string, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id)
    const deleted = await this.prisma.notificationRule.delete({ where: { id } })
    const identity = this.auditIdentity(actor, ctx)
    await this.audit?.log(identity.userId, 'DELETE', 'NotificationRule', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'NOTIFICATION_RULE_DELETED',
      previous: this.ruleSnapshot(before),
    })
    return deleted
  }

  async activate(id: string, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id)
    const updated = await this.prisma.notificationRule.update({ where: { id }, data: { enabled: true } })
    const identity = this.auditIdentity(actor, ctx)
    await this.audit?.log(identity.userId, 'ACTIVATE', 'NotificationRule', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'NOTIFICATION_RULE_ACTIVATED',
      previous: { enabled: before.enabled },
      next: { enabled: updated.enabled },
    })
    return updated
  }

  async deactivate(id: string, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id)
    const updated = await this.prisma.notificationRule.update({ where: { id }, data: { enabled: false } })
    const identity = this.auditIdentity(actor, ctx)
    await this.audit?.log(identity.userId, 'DEACTIVATE', 'NotificationRule', id, {
      ...this.auditScope(ctx),
      ...identity,
      reason: 'NOTIFICATION_RULE_DEACTIVATED',
      previous: { enabled: before.enabled },
      next: { enabled: updated.enabled },
    })
    return updated
  }
}
