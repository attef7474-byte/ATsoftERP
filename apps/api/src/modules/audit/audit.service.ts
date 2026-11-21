import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types'

const AUDIT_DETAILS_SCHEMA_VERSION = 1
const EXPORT_ACTION = 'EXPORT'
const EXPORT_ENTITY = 'AuditLog'
const EXPORT_REASON = 'AUDIT_LOG_CSV_EXPORT'
const REDACTED = '***'

// Single source of truth for both writer-side redaction and read sanitization.
const SENSITIVE_DETAIL_KEYS = [
  'password', 'secret', 'token', 'jwt', 'authorization', 'credential', 'apiKey', 'apiSecret', 'passwordHash', 'twoFactorSecret', 'DATABASE_URL', 'JWT_SECRET', 'refreshToken', 'accessToken',
]

export interface AuditLogWriteParams {
  userId?: string
  action: string
  entity: string
  entityId?: string
  details?: string | Record<string, any>
  ip?: string
  userAgent?: string
}

export interface BusinessAuditParams {
  userId?: string
  action: string
  entity: string
  entityId?: string
  companyId: string
  branchId?: string | null
  employeeId?: string | null
  previous?: unknown
  next?: unknown
  reason?: string
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logWithClient(client: any, params: AuditLogWriteParams) {
    this.assertAuditIdentity(params.action, params.entity)
    return client.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: this.serializeDetails(params.details),
        ip: params.ip,
        userAgent: params.userAgent,
      },
    })
  }

  async log(userIdOrParams: string | undefined | AuditLogWriteParams, action?: string, entity?: string, entityId?: string, details?: string | Record<string, any>) {
    if (typeof userIdOrParams === 'string' || userIdOrParams === undefined) {
      this.assertAuditIdentity(action, entity)
      return this.prisma.auditLog.create({ data: { userId: userIdOrParams, action: action as string, entity: entity as string, entityId, details: this.serializeDetails(details), ip: undefined, userAgent: undefined } })
    }
    return this.logWithClient(this.prisma, userIdOrParams)
  }

  async logBusiness(params: BusinessAuditParams) {
    return this.logWithClientBusiness(this.prisma, params)
  }

  async logWithClientBusiness(client: any, params: BusinessAuditParams) {
    this.assertAuditIdentity(params.action, params.entity)
    this.assertBusinessScope(params.companyId)
    const details = {
      schemaVersion: AUDIT_DETAILS_SCHEMA_VERSION,
      scope: { companyId: params.companyId, branchId: params.branchId ?? null },
      actor: { userId: params.userId ?? null, employeeId: params.employeeId ?? null },
      previous: params.previous ?? null,
      next: params.next ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    }
    return client.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: this.serializeDetails(details),
        ip: params.ip,
        userAgent: params.userAgent,
      },
    })
  }

  async findAll(query: { page?: number; limit?: number; userId?: string; entity?: string; action?: string; startDate?: string; endDate?: string; search?: string }, ctx: ActiveOperationalContext) {
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit
    const where: any = this.tenantWhere(ctx)
    if (query.userId) where.userId = query.userId
    if (query.entity) where.entity = query.entity
    if (query.action) where.action = query.action
    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }
    if (query.search) {
      where.OR = [{ entity: { contains: query.search } }, { action: { contains: query.search } }, { entityId: { contains: query.search } }]
    }
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, email: true, name: true } } } }),
      this.prisma.auditLog.count({ where }),
    ])
    return { data: data.map(log => ({ ...log, details: this.sanitizeDetails(log.details) })), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async findOne(id: string, ctx: ActiveOperationalContext) {
    const log = await this.prisma.auditLog.findFirst({ where: { id, ...this.tenantWhere(ctx) }, include: { user: { select: { id: true, email: true, name: true } } } })
    if (!log) throw new NotFoundException('Audit log not found')
    return { ...log, details: this.sanitizeDetails(log.details) }
  }

  async getSummary(ctx: ActiveOperationalContext) {
    const where = this.tenantWhere(ctx)
    const [total, actions, entities, today] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: true, orderBy: { _count: { id: 'desc' } } }),
      this.prisma.auditLog.groupBy({ by: ['entity'], where, _count: true, orderBy: { _count: { id: 'desc' } } }),
      this.prisma.auditLog.count({ where: { ...where, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ])
    return { total, today, actions, entities }
  }

  async findUserActivity(userId: string, query: { page?: number; limit?: number }, ctx: ActiveOperationalContext) {
    return this.findAll({ ...query, userId }, ctx)
  }

  async findLoginHistory(userId: string, page = 1, limit = 20, ctx: ActiveOperationalContext) {
    const skip = (page - 1) * limit
    const where = { ...this.tenantWhere(ctx), userId, action: { in: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] } }
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, email: true, name: true } } } }),
      this.prisma.auditLog.count({ where }),
    ])
    return { data: data.map(log => ({ ...log, details: this.sanitizeDetails(log.details) })), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async exportCsv(query: { userId?: string; entity?: string; action?: string; startDate?: string; endDate?: string }, ctx: ActiveOperationalContext, actorUserId?: string) {
    const where: any = this.tenantWhere(ctx)
    if (query.userId) where.userId = query.userId
    if (query.entity) where.entity = query.entity
    if (query.action) where.action = query.action
    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }
    const logs = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true, name: true } } }, take: 10000 })
    const header = 'timestamp,user,email,action,entity,entityId,ip,userAgent\n'
    const rows = logs.map(l => `${l.createdAt.toISOString()},"${l.user?.name || ''}","${l.user?.email || ''}",${l.action},${l.entity},${l.entityId || ''},${l.ip || ''},"${(l.userAgent || '').replace(/"/g, '""')}"`).join('\n')
    if (actorUserId) {
      const scope = await this.resolveBusinessScope(ctx, actorUserId)
      await this.logBusiness({
        userId: actorUserId,
        action: EXPORT_ACTION,
        entity: EXPORT_ENTITY,
        companyId: scope.companyId,
        branchId: scope.branchId,
        reason: EXPORT_REASON,
        metadata: { filters: { ...query }, rowCount: logs.length },
      })
    }
    return header + rows
  }

  private assertAuditIdentity(action: unknown, entity: unknown): void {
    if (typeof action !== 'string' || action.trim().length === 0) {
      throw new BadRequestException({ messageKey: 'audit.invalidAction', message: 'Audit action must be a non-empty string' })
    }
    if (typeof entity !== 'string' || entity.trim().length === 0) {
      throw new BadRequestException({ messageKey: 'audit.invalidEntity', message: 'Audit entity must be a non-empty string' })
    }
  }

  private assertBusinessScope(companyId: unknown): void {
    if (typeof companyId !== 'string' || companyId.trim().length === 0) {
      throw new BadRequestException({ messageKey: 'audit.invalidCompanyScope', message: 'Business audit requires a company scope' })
    }
  }

  private serializeDetails(details?: string | Record<string, any>): string | undefined {
    if (details === undefined || details === null) return undefined
    if (typeof details === 'string') {
      if (!details.trim()) return details
      try { return JSON.stringify(this.redactSensitive(JSON.parse(details))) } catch { return details }
    }
    return JSON.stringify(this.redactSensitive(details))
  }

  private isSensitiveKey(key: string): boolean {
    return SENSITIVE_DETAIL_KEYS.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))
  }

  private redactSensitive(value: any): any {
    if (Array.isArray(value)) return value.map(item => this.redactSensitive(item))
    if (value && typeof value === 'object') {
      if (value instanceof Date) return value.toISOString()
      if (typeof value.toJSON === 'function') return value.toJSON()
      const redacted: Record<string, any> = {}
      for (const [key, nested] of Object.entries(value)) {
        redacted[key] = this.isSensitiveKey(key) ? REDACTED : this.redactSensitive(nested)
      }
      return redacted
    }
    return value
  }

  private sanitizeDetails(details: any): any {
    if (!details) return details
    if (typeof details === 'string') {
      try { return this.redactSensitive(JSON.parse(details)) } catch { return details }
    }
    return this.redactSensitive(details)
  }

  private tenantWhere(ctx: ActiveOperationalContext) {
    // AuditLog has no direct tenant columns. Ownership is deterministically
    // derived from the actor user. Rows without an actor remain hidden rather
    // than being exposed globally or guessed into a tenant.
    if (!ctx?.companyId || !ctx?.branchId) {
      throw new BadRequestException({ messageKey: 'audit.missingOperationalContext', message: 'Audit reads require an active company and branch context' })
    }
    return {
      user: {
        is: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          deletedAt: null,
        },
      },
    }
  }

  private async resolveBusinessScope(ctx: ActiveOperationalContext | undefined, actorUserId: string): Promise<{ companyId: string; branchId: string }> {
    if (ctx?.companyId && ctx?.branchId) return { companyId: ctx.companyId, branchId: ctx.branchId }
    const user = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { companyId: true, branchId: true } })
    if (!user?.companyId || !user?.branchId) {
      throw new BadRequestException({ messageKey: 'audit.actorScopeUnavailable', message: 'Cannot resolve company and branch for the audit actor' })
    }
    return { companyId: user.companyId, branchId: user.branchId }
  }
}
