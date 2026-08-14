import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types'

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logWithClient(client: any, params: { userId?: string; action: string; entity: string; entityId?: string; details?: string | Record<string, any>; ip?: string; userAgent?: string }) {
    const details = typeof params.details === 'string' ? params.details : params.details ? JSON.stringify(params.details) : undefined
    return client.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    })
  }

  async log(userIdOrParams: string | undefined | { userId?: string; action: string; entity: string; entityId?: string; details?: string; ip?: string; userAgent?: string }, action?: string, entity?: string, entityId?: string, details?: string | Record<string, any>) {
    if (typeof userIdOrParams === 'string' || userIdOrParams === undefined) {
      const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details
      return this.prisma.auditLog.create({ data: { userId: userIdOrParams, action: action || '', entity: entity || '', entityId, details: detailsStr, ip: undefined, userAgent: undefined } })
    }
    const params = userIdOrParams
    return this.prisma.auditLog.create({ data: { userId: params.userId, action: params.action, entity: params.entity, entityId: params.entityId, details: params.details, ip: params.ip, userAgent: params.userAgent } })
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

  async exportCsv(query: { userId?: string; entity?: string; action?: string; startDate?: string; endDate?: string }, ctx: ActiveOperationalContext) {
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
    return header + rows
  }

  private sanitizeDetails(details: any): any {
    if (!details) return details
    let obj: any
    if (typeof details === 'string') { try { obj = JSON.parse(details) } catch { return details } } else { obj = details }
    const sensitiveKeys = ['password', 'secret', 'token', 'jwt', 'authorization', 'credential', 'apiKey', 'apiSecret', 'passwordHash', 'twoFactorSecret', 'DATABASE_URL', 'JWT_SECRET', 'refreshToken', 'accessToken']
    const redact = (val: any, key?: string): any => {
      if (key && sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) return '***'
      if (Array.isArray(val)) return val.map(v => redact(v))
      if (val && typeof val === 'object') { const r: Record<string, any> = {}; for (const [k, v] of Object.entries(val)) r[k] = redact(v, k); return r }
      return val
    }
    return redact(obj)
  }

  private tenantWhere(ctx: ActiveOperationalContext) {
    // AuditLog has no direct tenant columns. Ownership is deterministically
    // derived from the actor user. Rows without an actor remain hidden rather
    // than being exposed globally or guessed into a tenant.
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
}
